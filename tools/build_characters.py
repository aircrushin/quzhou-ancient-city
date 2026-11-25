import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MODEL_DIR = os.path.join(ROOT, 'assets', 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

# Surface kinds encoded in TEXCOORD_1.u = (kind + 0.5) / 8.0
KIND_CLOTH = 0
KIND_LEATHER = 1
KIND_SKIN = 2
KIND_HAIR = 3
KIND_EYE = 4
KIND_METAL = 5
KIND_DENIM = 6
KIND_RUBBER = 7

# Palette slots encoded in TEXCOORD_1.v = (slot + 0.5) / 8.0 (stored as 1-v in Blender for glTF flip)
SLOT_FIXED = 0
SLOT_SKIN = 1
SLOT_HAIR = 2
SLOT_TOP = 3
SLOT_INNER = 4
SLOT_BOTTOM = 5
SLOT_SHOE = 6
SLOT_ACCENT = 7

# Canonical 13-bone order matching vehicles.js rig
BONE_ORDER = [
    'upper', 'chest', 'head',
    'hip_L', 'knee_L', 'boot_L', 'arm_L', 'elbow_L',
    'hip_R', 'knee_R', 'boot_R', 'arm_R', 'elbow_R',
]

# Upright realistic standing proportions matching vehicles.js thigh/shin IK lengths
HIP_Y = 0.946
THIGH_LEN = 0.444
SHIN_LEN = 0.427
KNEE_Y = HIP_Y - THIGH_LEN        # 0.502
BOOT_Y = KNEE_Y - SHIN_LEN        # 0.075 (sole bottom at BOOT_Y - 0.075 = 0.000!)
UPPER_ARM_LEN = 0.277


def clamp(v, lo, hi):
    return lo if v < lo else (hi if v > hi else v)


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(edge0, edge1, x):
    if edge1 == edge0:
        return 0.0 if x < edge0 else 1.0
    t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def bell(x):
    return math.exp(-x * x)


def soft_pow(v, exp):
    return math.copysign(abs(v) ** exp, v)


# Convert Three.js (x=left, y=up, z=forward) -> Blender (x=left, y=-z, z=y)
def pt(x, y, z):
    return Vector((x, -z, y))


def from_pt(v):
    return (v.x, v.z, -v.y)


def hex_to_linear(hex_str):
    s = hex_str.lstrip('#')
    r = int(s[0:2], 16) / 255.0
    g = int(s[2:4], 16) / 255.0
    b = int(s[4:6], 16) / 255.0
    def to_lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (to_lin(r), to_lin(g), to_lin(b))


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for col in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.objects):
        for item in list(col):
            col.remove(item)


def make_base_material():
    mat = bpy.data.materials.new(name='CharacterPBR')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.78
    vc = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Color'
    mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def sample_rows(rows, y):
    if y <= rows[0][0]:
        return rows[0]
    for i in range(1, len(rows)):
        if y <= rows[i][0]:
            a, b = rows[i - 1], rows[i]
            t = clamp((y - a[0]) / max(1e-6, b[0] - a[0]), 0.0, 1.0)
            return [lerp(a[k], b[k], t) for k in range(len(a))]
    return rows[-1]


def create_part_object(name, bm, kind, slot, base_rgb=(1.0, 1.0, 1.0),
                       uv_func=None, color_func=None, subsurf=0, smooth_iters=0,
                       skin_tag='auto', pre_vgroups=None):
    """Convert a bmesh into a Blender object with smooth shading, optional pre-subsurf vgroups, UV0, UV1, Color."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    n_poly = len(mesh.polygons)
    if n_poly:
        mesh.polygons.foreach_set('use_smooth', [True] * n_poly)
    mesh.update()

    if pre_vgroups:
        for vg_name, entries in pre_vgroups.items():
            vg = obj.vertex_groups.new(name=vg_name)
            for vi, wval in entries:
                vg.add([vi], wval, 'REPLACE')

    bpy.context.view_layer.objects.active = obj
    if subsurf > 0:
        mod = obj.modifiers.new('Subsurf', 'SUBSURF')
        mod.levels = subsurf
        mod.render_levels = subsurf
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth_iters > 0:
        mod = obj.modifiers.new('Smooth', 'SMOOTH')
        mod.factor = 0.45
        mod.iterations = smooth_iters
        bpy.ops.object.modifier_apply(modifier=mod.name)

    mesh = obj.data
    if len(mesh.polygons):
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))

    uv0 = mesh.uv_layers.new(name='UVMap')
    uv1 = mesh.uv_layers.new(name='CharMat')
    col_attr = mesh.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')

    u_kind = (kind + 0.5) / 8.0
    v_slot = 1.0 - (slot + 0.5) / 8.0  # glTF flips V -> (slot + 0.5) / 8.0

    verts = mesh.vertices
    for i, v in enumerate(verts):
        x, y, z = from_pt(v.co)
        nx, ny, nz = from_pt(v.normal)
        if color_func is not None:
            c = color_func(x, y, z, nx, ny, nz)
            r, g, b = base_rgb[0] * c[0], base_rgb[1] * c[1], base_rgb[2] * c[2]
        else:
            r, g, b = base_rgb
        col_attr.data[i].color = (clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), 1.0)

    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi = mesh.loops[li].vertex_index
            x, y, z = from_pt(verts[vi].co)
            if uv_func is not None:
                u, v = uv_func(x, y, z)
                uv0.data[li].uv = (u, 1.0 - v)
            else:
                uv0.data[li].uv = (0.0, 1.0)
            uv1.data[li].uv = (u_kind, v_slot)

    obj['skin_tag'] = skin_tag
    return obj


def loft_rings_bmesh(rings, cap_start=True, cap_end=True):
    bm = bmesh.new()
    v_rings = [[bm.verts.new(pt(*p)) for p in ring] for ring in rings]
    bm.verts.ensure_lookup_table()
    nr = len(v_rings)
    nv = len(v_rings[0])
    for i in range(nr - 1):
        r0, r1 = v_rings[i], v_rings[i + 1]
        for j in range(nv):
            jn = (j + 1) % nv
            try:
                bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
            except ValueError:
                pass
    if cap_start:
        c0 = bm.verts.new(sum((v.co for v in v_rings[0]), Vector()) / nv)
        for j in range(nv):
            jn = (j + 1) % nv
            try:
                bm.faces.new((v_rings[0][jn], v_rings[0][j], c0))
            except ValueError:
                pass
    if cap_end:
        c1 = bm.verts.new(sum((v.co for v in v_rings[-1]), Vector()) / nv)
        for j in range(nv):
            jn = (j + 1) % nv
            try:
                bm.faces.new((v_rings[-1][j], v_rings[-1][jn], c1))
            except ValueError:
                pass
    return bm


def ribbon_tube_bmesh(centers, radii_x, radii_y, sides=6, cap=True, ref_point=None):
    """Create a curved organic ribbon/strand along a 3D path (Three.js coords) with elliptical cross-section."""
    bm = bmesh.new()
    n = len(centers)
    rings = []
    prev_up = Vector((0.0, 1.0, 0.0))
    for i in range(n):
        p = Vector(centers[i])
        if i == 0:
            t = (Vector(centers[1]) - p).normalized()
        elif i == n - 1:
            t = (p - Vector(centers[i - 1])).normalized()
        else:
            t = (Vector(centers[i + 1]) - Vector(centers[i - 1])).normalized()
        if t.length < 1e-6:
            t = Vector((0.0, -1.0, 0.0))
        if ref_point is not None:
            ref = p - Vector(ref_point)
        else:
            ref = Vector((p.x, 0.0, p.z))
        if ref.length < 0.01:
            ref = Vector((0.0, 0.0, 1.0))
        else:
            ref.normalize()
        side_vec = t.cross(ref)
        if side_vec.length < 1e-4:
            side_vec = t.cross(prev_up)
        if side_vec.length < 1e-4:
            side_vec = Vector((1.0, 0.0, 0.0))
        side_vec.normalize()
        norm_vec = side_vec.cross(t).normalized()
        prev_up = norm_vec

        rx = radii_x[i]
        ry = radii_y[i]
        ring = []
        for j in range(sides):
            ang = j * math.pi * 2.0 / sides
            ca, sa = math.cos(ang), math.sin(ang)
            pos = p + side_vec * (ca * rx) + norm_vec * (sa * ry)
            ring.append(bm.verts.new(pt(pos.x, pos.y, pos.z)))
        rings.append(ring)

    for i in range(n - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(sides):
            jn = (j + 1) % sides
            try:
                bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
            except ValueError:
                pass
    if cap:
        for end_ring, rev in ((rings[0], True), (rings[-1], False)):
            c = bm.verts.new(sum((v.co for v in end_ring), Vector()) / sides)
            for j in range(sides):
                jn = (j + 1) % sides
                try:
                    if rev:
                        bm.faces.new((end_ring[jn], end_ring[j], c))
                    else:
                        bm.faces.new((end_ring[j], end_ring[jn], c))
                except ValueError:
                    pass
    return bm


# =============================================================================
# 1. REALISTIC ANATOMICAL HEAD, FACE, DEEP-SET EYES, EARS, NECK
# =============================================================================
def get_head_profile(female):
    s_w = 0.93 if female else 1.0
    neck_w = 0.86 if female else 1.0
    # Fuller realistic adult cranium & jaw profile:
    # (raw_dy, half_width_x, front_z, rear_z, z_center, square_exp)
    return [
        (-0.074, 0.090 * neck_w, 0.070, 0.068, -0.003, 0.92),  # Trapezius/collar base
        (-0.044, 0.064 * neck_w, 0.060, 0.061, -0.005, 0.95),  # Lower neck
        (-0.012, 0.056 * neck_w, 0.056, 0.058, -0.005, 0.97),  # Mid neck
        ( 0.018, 0.055 * neck_w, 0.058, 0.060, -0.004, 0.97),  # Upper neck
        ( 0.032, 0.056 * s_w,    0.074, 0.067,  0.001, 0.94),  # Submental under-chin
        ( 0.040, 0.047 * s_w,    0.092, 0.073,  0.005, 0.90),  # Chin bottom
        ( 0.052, 0.058 * s_w,    0.100, 0.079,  0.005, 0.90),  # Chin apex
        ( 0.066, 0.066 * s_w,    0.098, 0.085,  0.004, 0.91),  # Lower jaw
        ( 0.082, 0.071 * s_w,    0.100, 0.090,  0.003, 0.92),  # Mouth line / jaw angle
        ( 0.098, 0.075 * s_w,    0.099, 0.095,  0.002, 0.93),  # Philtrum / lower cheek
        ( 0.115, 0.077 * s_w,    0.098, 0.099,  0.001, 0.94),  # Nose base / mid cheek
        ( 0.132, 0.080 * s_w,    0.098, 0.103,  0.000, 0.94),  # Cheekbone (zygomatic)
        ( 0.150, 0.079 * s_w,    0.095, 0.106, -0.001, 0.94),  # Eye line / temple
        ( 0.170, 0.078 * s_w,    0.097, 0.108, -0.002, 0.93),  # Brow ridge
        ( 0.192, 0.078 * s_w,    0.095, 0.108, -0.003, 0.94),  # Mid forehead
        ( 0.214, 0.075 * s_w,    0.089, 0.105, -0.004, 0.95),  # Hairline
        ( 0.236, 0.066 * s_w,    0.076, 0.094, -0.005, 0.97),  # Upper cranium
        ( 0.252, 0.049 * s_w,    0.055, 0.070, -0.006, 0.98),  # Crown
        ( 0.264, 0.023 * s_w,    0.027, 0.035, -0.006, 1.00),  # Top skull
    ]


def build_head_and_face(cfg):
    objs = []
    female = cfg['female']
    hy = cfg['head_y']
    hz = cfg['head_z']
    s_w = 0.93 if female else 1.0
    s_h = 0.95 if female else 1.0
    profile = get_head_profile(female)

    dy_samples = [
        -0.074, -0.056, -0.038, -0.020, -0.002, 0.014, 0.026, 0.034,
        0.041, 0.048, 0.055, 0.062, 0.069, 0.076, 0.082, 0.088, 0.094, 0.101,
        0.107, 0.114, 0.121, 0.128, 0.135, 0.142, 0.150, 0.157, 0.164,
        0.171, 0.180, 0.191, 0.203, 0.215, 0.228, 0.241, 0.253, 0.264,
    ]
    facets = 48

    def face_disp(x, raw_dy):
        ax = abs(x)
        # Zygomatic cheekbone & soft buccal hollow
        cheek = bell((ax - 0.048 * s_w) / 0.023) * bell((raw_dy - 0.130) / 0.021)
        hollow = bell((ax - 0.048 * s_w) / 0.017) * bell((raw_dy - 0.095) / 0.018)
        # Deep orbital socket so eyeballs sit recessed behind brow & cheekbone!
        socket = bell((ax - 0.032 * s_w) / 0.0165) * bell((raw_dy - 0.150) / 0.014)
        brow_amp = 0.0052 if female else 0.0078
        brow = bell((ax - 0.032 * s_w) / 0.025) * bell((raw_dy - 0.170) / 0.0095)
        glabella = bell(x / 0.011) * bell((raw_dy - 0.159) / 0.008)
        # Sculpted nose: bridge, dorsum, tip, alar wings, nostril recess, philtrum
        bridge = bell(x / (0.0095 * s_w)) * bell((raw_dy - 0.137) / 0.025)
        nose_tip = bell(x / (0.0108 * s_w)) * bell((raw_dy - 0.116) / 0.0095)
        alar = bell((ax - 0.0120 * s_w) / 0.0070) * bell((raw_dy - 0.111) / 0.0062)
        nostril_pit = bell((ax - 0.0078 * s_w) / 0.0040) * bell((raw_dy - 0.107) / 0.0036)
        philtrum = bell(x / 0.0055) * bell((raw_dy - 0.097) / 0.007)
        phil_ridge = bell((ax - 0.0068) / 0.0038) * bell((raw_dy - 0.096) / 0.007)
        # Sculpted mouth: Cupid's bow, parting line, fuller lower lip, chin dimple
        mouth_w = 0.0235 * s_w
        cupid = bell((ax - 0.0060) / 0.006) * bell((raw_dy - 0.0895) / 0.0042)
        u_lip = bell(x / mouth_w) * bell((raw_dy - 0.088) / 0.0050)
        part_line = bell(x / (mouth_w * 1.06)) * bell((raw_dy - 0.0825) / 0.0024)
        mouth_corner = bell((ax - mouth_w * 0.98) / 0.0045) * bell((raw_dy - 0.0825) / 0.0038)
        l_lip = bell(x / (mouth_w * 0.88)) * bell((raw_dy - 0.076) / 0.0058)
        chin_groove = bell(x / 0.018) * bell((raw_dy - 0.064) / 0.006)
        chin_pad = bell(x / (0.018 if female else 0.023)) * bell((raw_dy - 0.052) / 0.012)
        naso = bell((ax - 0.020 - (0.112 - raw_dy) * 0.38) / 0.006) * bell((raw_dy - 0.096) / 0.014)
        scm = bell((ax - 0.019 - (raw_dy + 0.045) * 0.40) / 0.010) * bell((raw_dy + 0.020) / 0.032)

        return (
            0.0058 * cheek
            - (0.0030 if female else 0.0038) * hollow
            - 0.0145 * socket
            + brow_amp * brow
            - 0.0028 * glabella
            + (0.0145 if female else 0.0168) * bridge
            + (0.0205 if female else 0.0228) * nose_tip
            + 0.0095 * alar
            - 0.0065 * nostril_pit
            - 0.0022 * philtrum
            + 0.0014 * phil_ridge
            + 0.0049 * u_lip
            + 0.0025 * cupid
            - 0.0056 * part_line
            - 0.0022 * mouth_corner
            + 0.0059 * l_lip
            - 0.0042 * chin_groove
            + (0.0048 if female else 0.0072) * chin_pad
            - 0.0014 * naso
            + 0.0024 * scm
        )

    def head_front_z(x, raw_dy):
        _, w, front, _, zc, sq = sample_rows(profile, raw_dy)
        ca_abs = clamp(abs(x) / max(1e-5, w), 0.0, 0.99) ** (1.0 / max(0.2, sq))
        sa = math.sqrt(max(0.0, 1.0 - ca_abs * ca_abs))
        return hz + zc + front * soft_pow(sa, sq) + face_disp(x, raw_dy) * sa

    rings = []
    for raw_dy in dy_samples:
        dy = raw_dy * s_h
        _, w, front, rear, zc, sq = sample_rows(profile, raw_dy)
        ring = []
        for i in range(facets):
            t_u = i / facets
            theta = t_u * math.pi * 2.0
            a = theta - 0.14 * math.sin(2.0 * theta)
            ca, sa = math.cos(a), math.sin(a)
            x = w * soft_pow(ca, sq)
            if 0.036 <= raw_dy <= 0.088 and sa > 0:
                jaw_t = 1.0 - smoothstep(0.040, 0.090, raw_dy)
                x *= (1.0 - (0.16 if female else 0.09) * jaw_t * sa)
            turn = max(0.0, sa)
            depth = front if sa >= 0 else rear
            occ_hollow = -0.008 * max(0.0, -sa) * bell((raw_dy - 0.042) / 0.022)
            z = hz + zc + depth * soft_pow(sa, sq) + face_disp(x, raw_dy) * turn + occ_hollow
            ring.append((x, hy + dy, z))
        rings.append(ring)

    bm_head = loft_rings_bmesh(rings, cap_start=False, cap_end=True)

    # Exact UV mapping synchronized with createFaceDetailTexture() in vehicles.js
    def head_uv(x, y, z):
        raw_dy = (y - hy) / s_h
        ang = math.atan2(x, (z - hz) + 0.022)
        u = clamp(0.5 + ang / (math.pi * 1.12), 0.02, 0.98)
        v = clamp((raw_dy - 0.015) / 0.255, 0.02, 0.98)
        return (u, v)

    def head_ao(x, y, z, nx, ny, nz):
        raw_dy = (y - hy) / s_h
        ax = abs(x)
        front = smoothstep(0.0, 0.5, nz)
        under_chin = smoothstep(0.048, 0.014, raw_dy) * smoothstep(-0.2, 0.8, nz)
        orbit_ao = bell((ax - 0.032 * s_w) / 0.018) * bell((raw_dy - 0.153) / 0.014) * front
        brow_under = bell((ax - 0.033 * s_w) / 0.022) * bell((raw_dy - 0.163) / 0.007) * front
        nostril_ao = bell((ax - 0.0078 * s_w) / 0.005) * bell((raw_dy - 0.107) / 0.0042) * front
        mouth_ao = bell(x / (0.024 * s_w)) * bell((raw_dy - 0.0825) / 0.0032) * front
        corner_ao = bell((ax - 0.0235 * s_w) / 0.005) * bell((raw_dy - 0.0825) / 0.0045) * front
        under_lip = bell(x / 0.017) * bell((raw_dy - 0.066) / 0.007) * front
        neck_base = smoothstep(-0.025, -0.070, raw_dy)
        ao = 1.0 - 0.21 * under_chin - 0.16 * orbit_ao - 0.08 * brow_under - 0.44 * nostril_ao - 0.31 * mouth_ao - 0.16 * corner_ao - 0.09 * under_lip - 0.16 * neck_base
        blush = (bell((ax - 0.044 * s_w) / 0.024) * bell((raw_dy - 0.128) / 0.020)
                 + 0.30 * bell(x / 0.012) * bell((raw_dy - 0.116) / 0.014)) * front
        lip_zone = bell(x / (0.022 * s_w)) * bell((raw_dy - 0.082) / 0.009) * front
        r = ao * (1.0 + 0.018 * blush + 0.028 * lip_zone)
        g = ao * (1.0 - 0.018 * blush - 0.145 * lip_zone)
        b = ao * (1.0 - 0.022 * blush - 0.155 * lip_zone)
        return (r, g, b)

    objs.append(create_part_object(
        'Head', bm_head, KIND_SKIN, SLOT_SKIN,
        uv_func=head_uv, color_func=head_ao, subsurf=0, smooth_iters=1, skin_tag='head_neck'
    ))

    # Deep-set glossy eyeballs + sculpted almond eyelid folds + delicate lash line
    eye_x_off = 0.032 * s_w
    eye_y = hy + 0.150 * s_h
    eye_z = hz + 0.0758   # Cornea apex at hz + 0.0878 (cleanly framed inside orbital socket)
    eye_r = 0.0120

    for side in (-1, 1):
        ex = side * eye_x_off
        bm_eye = bmesh.new()
        bmesh.ops.create_uvsphere(bm_eye, u_segments=20, v_segments=14, radius=eye_r,
                                  matrix=Matrix.Translation(pt(ex, eye_y, eye_z)))
        def eye_uv(x, y, z, _ex=ex, _ey=eye_y):
            lx = (x - _ex) / (eye_r * 1.06)
            ly = (y - _ey) / (eye_r * 1.06)
            return (clamp(0.5 + lx * 0.5, 0.0, 1.0), clamp(0.5 + ly * 0.5, 0.0, 1.0))
        objs.append(create_part_object(
            f'Eye_{side}', bm_eye, KIND_EYE, SLOT_FIXED,
            base_rgb=(1.0, 1.0, 1.0), uv_func=eye_uv, skin_tag='head'
        ))

        # Natural open almond eyelid aperture (~10.5mm palpebral fissure, slim anatomical rims)
        for lid_idx, (is_upper, y_bias, amp, rx_base, ry_base, shade) in enumerate([
            (True,   0.0008, 0.0058 if female else 0.0052, 0.0020, 0.0014, (0.83, 0.78, 0.76)),  # Upper lid margin
            (True,   0.0042, 0.0063 if female else 0.0057, 0.0023, 0.0016, (0.90, 0.86, 0.84)),  # Upper eyelid fold/hood
            (False, -0.0011, 0.0044,                       0.0015, 0.0012, (0.93, 0.90, 0.88)),  # Lower lid rim
        ]):
            lid_pts, lid_rx, lid_ry = [], [], []
            n_seg = 11
            for k in range(n_seg):
                u = k / (n_seg - 1)
                t_lat = (u - 0.5) * 2.0
                lx = ex + side * t_lat * 0.0154
                arch = math.sin(u * math.pi)
                if is_upper:
                    ly = eye_y + y_bias + arch * amp + t_lat * 0.0011
                else:
                    ly = eye_y + y_bias - arch * amp + t_lat * 0.0008
                rad_z = eye_r + (0.0015 if lid_idx == 1 else 0.0010)
                lz = eye_z + math.sqrt(max(0.00001, rad_z ** 2 - (lx - ex) ** 2 * 0.56 - (ly - eye_y) ** 2 * 0.52))
                lid_pts.append((lx, ly, lz))
                lid_rx.append(rx_base * (0.65 + 0.45 * arch))
                lid_ry.append(ry_base * (0.65 + 0.45 * arch))
            bm_lid = ribbon_tube_bmesh(lid_pts, lid_rx, lid_ry, sides=6, cap=True, ref_point=(ex, eye_y, eye_z))
            objs.append(create_part_object(
                f'Lid_{side}_{lid_idx}', bm_lid, KIND_SKIN, SLOT_SKIN,
                base_rgb=shade, uv_func=head_uv, skin_tag='head'
            ))

        # Crisp upper eyelash rim proud of upper lid edge so eyes read framed & alive
        lash_pts, lrx, lry = [], [], []
        for k in range(11):
            u = k / 10.0
            t_lat = (u - 0.5) * 2.0
            arch = math.sin(u * math.pi)
            outer_lift = 0.0008 * smoothstep(0.55, 1.0, u) if female else 0.0003 * smoothstep(0.65, 1.0, u)
            lx = ex + side * t_lat * 0.0150
            ly = eye_y + 0.0002 + arch * (0.0055 if female else 0.0049) + t_lat * 0.0011 + outer_lift
            lz = eye_z + math.sqrt(max(0.00001, (eye_r + 0.0021) ** 2 - (lx - ex) ** 2 * 0.56 - (ly - eye_y) ** 2 * 0.52))
            lash_pts.append((lx, ly, lz))
            outer_thick = 0.88 + 0.28 * smoothstep(0.35, 0.85, u)
            lrx.append((0.00075 + 0.00105 * arch * (1.24 if female else 0.98)) * outer_thick)
            lry.append(0.00075 + 0.00068 * arch)
        bm_lash = ribbon_tube_bmesh(lash_pts, lrx, lry, sides=6, cap=True, ref_point=(ex, eye_y, eye_z))
        objs.append(create_part_object(
            f'Lash_{side}', bm_lash, KIND_HAIR, SLOT_FIXED,
            base_rgb=(0.024, 0.018, 0.014), skin_tag='head'
        ))

        # Delicate outer lower-lash shadow line for natural almond eye framing
        ll_pts, llrx, llry = [], [], []
        for k in range(7):
            u = k / 6.0
            t_u = lerp(0.32, 0.96, u)
            t_lat = (t_u - 0.5) * 2.0
            arch = math.sin(t_u * math.pi)
            lx = ex + side * t_lat * 0.0146
            ly = eye_y - 0.0010 - arch * 0.0042 + t_lat * 0.0008
            lz = eye_z + math.sqrt(max(0.00001, (eye_r + 0.0016) ** 2 - (lx - ex) ** 2 * 0.56 - (ly - eye_y) ** 2 * 0.52))
            ll_pts.append((lx, ly, lz))
            fade = math.sin(u * math.pi)
            llrx.append(0.00035 + 0.00042 * fade)
            llry.append(0.00035 + 0.00032 * fade)
        bm_ll = ribbon_tube_bmesh(ll_pts, llrx, llry, sides=5, cap=True, ref_point=(ex, eye_y, eye_z))
        objs.append(create_part_object(
            f'LowerLash_{side}', bm_ll, KIND_HAIR, SLOT_FIXED,
            base_rgb=(0.11, 0.085, 0.075), skin_tag='head'
        ))

        # Anatomically sculpted 3D Eyebrow hugging the exact brow ridge surface (matches hair slot)
        brow_pts, brx, bry = [], [], []
        n_brow = 13
        for k in range(n_brow):
            u = k / (n_brow - 1)
            bx_abs = lerp(0.0130, 0.0520, u) * s_w
            bx = side * bx_abs
            arch_curve = math.sin((u ** 0.78) * math.pi)
            head_taper = smoothstep(0.0, 0.22, u)
            tail_taper = 1.0 - 0.68 * (smoothstep(0.42, 1.0, u) ** 1.4)
            prof_t = (0.38 + 0.62 * head_taper) * tail_taper
            if female:
                b_raw_dy = 0.1688 + 0.0068 * arch_curve + 0.0014 * u * (1.0 - u)
                b_h = 0.0023 * prof_t + 0.00045
            else:
                b_raw_dy = 0.1672 + 0.0054 * arch_curve + 0.0010 * u * (1.0 - u)
                b_h = 0.0030 * prof_t + 0.00055
            bz = head_front_z(bx, b_raw_dy) + 0.0005
            brow_pts.append((bx, hy + b_raw_dy * s_h, bz))
            brx.append(b_h)
            bry.append(0.00125 * prof_t + 0.00045)
        bm_brow = ribbon_tube_bmesh(brow_pts, brx, bry, sides=6, cap=True, ref_point=(0.0, hy + 0.155 * s_h, hz))
        def brow_col(x, y, z, nx, ny, nz, _sw=s_w):
            inner_fade = smoothstep(0.024 * _sw, 0.012 * _sw, abs(x))
            tail = smoothstep(0.036 * _sw, 0.054 * _sw, abs(x))
            shade = 0.80 + 0.12 * tail + 0.10 * inner_fade
            return (shade, shade, shade)
        objs.append(create_part_object(
            f'Brow_{side}', bm_brow, KIND_HAIR, SLOT_HAIR,
            color_func=brow_col, skin_tag='head'
        ))

        # Sculpted 3D Ear tucked naturally against side of head
        ear_rings = []
        ear_y0 = hy + 0.135 * s_h
        ear_z0 = hz - 0.008
        ear_x0 = side * (0.077 * s_w)
        for rv in [0.08, 0.36, 0.66, 0.88, 1.0]:
            ring = []
            for k in range(14):
                ang = k * math.pi * 2.0 / 14.0
                ca, sa = math.cos(ang), math.sin(ang)
                top_w = 1.0 + 0.20 * max(0.0, sa) - 0.22 * max(0.0, -sa)
                ez = ear_z0 - 0.014 * rv * ca * top_w - 0.003 * sa
                ey = ear_y0 + 0.028 * rv * sa
                rim = 0.0068 * bell((rv - 0.84) / 0.20)
                concha = -0.0050 * bell((rv - 0.38) / 0.24) * max(0.0, -ca + 0.4)
                tilt = 0.0065 * max(0.0, -ca) * rv
                ex_p = ear_x0 + side * (0.0015 + tilt + rim + concha)
                ring.append((ex_p, ey, ez))
            ear_rings.append(ring)
        outer_r = ear_rings[-1]
        ear_rings.append([(ear_x0 - side * 0.004, p[1] * 0.998 + ear_y0 * 0.002, p[2] * 0.9 + ear_z0 * 0.1) for p in outer_r])
        bm_ear = loft_rings_bmesh(ear_rings, cap_start=True, cap_end=True)
        def ear_ao(x, y, z, nx, ny, nz, _ex0=ear_x0, _side=side):
            out = clamp((x - _ex0) * _side / 0.014, 0.0, 1.0)
            ao = 0.80 + 0.20 * out
            return (ao * 1.04, ao * 0.95, ao * 0.93)
        objs.append(create_part_object(
            f'Ear_{side}', bm_ear, KIND_SKIN, SLOT_SKIN,
            color_func=ear_ao, subsurf=1, skin_tag='head'
        ))

    return objs


# =============================================================================
# 2. REALISTIC FULL-VOLUME SCULPTED HAIR (SOLID SILHOUETTE + FLUSH LOCKS)
# =============================================================================
def build_hair(cfg):
    objs = []
    female = cfg['female']
    style = cfg['hair_style']  # 'player_layered', 'man_crop', 'man_part', 'woman_bob', 'woman_ponytail'
    hy = cfg['head_y']
    hz = cfg['head_z']
    s_w = 0.93 if female else 1.0
    s_h = 0.95 if female else 1.0
    head_profile = get_head_profile(female)
    top_skull_dy = head_profile[-1][0]  # 0.264
    head_center = (0.0, hy + 0.165 * s_h, hz - 0.005)

    def skull_radii_plus(raw_dy, tx, tf, tb, top_dy_max):
        """Return (rx, rz_front, rz_rear, zc, sq) strictly outside the exact skull profile."""
        if raw_dy <= top_skull_dy:
            _, sw, sf, sb, zc, sq = sample_rows(head_profile, raw_dy)
            return (sw + tx, sf + tf, sb + tb, zc, sq)
        _, sw_t, sf_t, sb_t, zc_t, _ = head_profile[-1]
        dome_t = clamp((raw_dy - top_skull_dy) / max(1e-4, top_dy_max - top_skull_dy), 0.0, 1.0)
        dome_r = math.sqrt(max(0.0, 1.0 - dome_t * dome_t))
        return ((sw_t + tx) * dome_r, (sf_t + tf) * dome_r, (sb_t + tb) * dome_r, zc_t, 1.0)

    def add_lock(name, pts, rx_list, ry_list, shade_mul=1.0, skin_tag='head'):
        bm = ribbon_tube_bmesh(pts, rx_list, ry_list, sides=6, cap=True, ref_point=head_center)
        objs.append(create_part_object(
            name, bm, KIND_HAIR, SLOT_HAIR,
            base_rgb=(shade_mul, shade_mul, shade_mul), subsurf=0, skin_tag=skin_tag
        ))

    # 2a. Sculpted Full-Volume Cranial Hair Shell (guaranteed strictly outside skull — ZERO bald spots!)
    if style == 'woman_bob':
        facets = 40
        bob_rings = []
        bob_top = 0.286
        levels = [
            (-0.042, 0.000, 0.002, 0.001),  # Inner turned-under bob edge (clean thickness)
            (-0.052, 0.011, 0.012, 0.003),  # Softly curved-inward feathered bob tips
            (-0.010, 0.020, 0.020, 0.004),  # Tapered jawline fullness
            ( 0.046, 0.023, 0.023, 0.004),  # Lower cheek / neck
            ( 0.105, 0.022, 0.023, 0.004),  # Mid cheek / ears
            ( 0.158, 0.020, 0.021, 0.003),  # Temples
            ( 0.200, 0.017, 0.019, 0.003),  # Hairline
            ( 0.228, 0.017, 0.019, 0.003),  # Upper cranium
            ( 0.250, 0.016, 0.018, 0.002),  # Crown
            ( 0.264, 0.015, 0.017, 0.001),  # Top skull clearance ring
            ( 0.276, 0.014, 0.016, 0.001),  # Upper dome
            ( 0.285, 0.012, 0.014, 0.000),  # Near-apex
        ]
        for li, (raw_dy, vx, vz, wamp) in enumerate(levels):
            ring = []
            for i in range(facets):
                ang = i * math.pi * 2.0 / facets
                ca, sa = math.cos(ang), math.sin(ang)
                front_open = smoothstep(0.32, 0.88, sa)
                part_shift = -0.018
                cur_dy = raw_dy
                if raw_dy < 0.214:
                    forehead_y = 0.214 - 0.024 * (1.0 - smoothstep(0.55, 0.96, sa))
                    cur_dy = lerp(raw_dy, max(raw_dy, forehead_y), front_open ** 1.15)
                    cur_dy -= 0.012 * max(0.0, -sa) * (1.0 - smoothstep(-0.06, 0.12, raw_dy))
                part_dip = -0.0032 * bell((0.08 * ca - part_shift) / 0.012) * smoothstep(0.20, 0.275, cur_dy)
                eff_dy = cur_dy + part_dip
                # Exact skull radii + strict positive hair thickness
                front_tuck = lerp(0.68, 0.36, front_open * smoothstep(0.18, 0.23, eff_dy))
                srx, srz_f, srz_b, zc, sq = skull_radii_plus(eff_dy, vx, vz * front_tuck, vz, bob_top)
                # Below cheek, sculpt graceful inward C-curve bob drape hugging jawline cleanly
                if eff_dy < 0.135:
                    drape_t = smoothstep(0.135, -0.052, eff_dy)
                    c_curl = 0.16 * (drape_t ** 1.65)
                    bob_w = (0.079 * s_w + vx) * (1.0 - c_curl)
                    bob_b = (0.105 + vz) * (1.0 - 0.14 * (drape_t ** 1.5))
                    srx = max(srx, bob_w)
                    srz_b = max(srz_b, bob_b)
                    srz_f = max(srz_f, (0.090 + vz * 0.45) * (1.0 - 0.12 * drape_t))
                clump = wamp * (0.65 * math.sin(ang * 14.0 + eff_dy * 16.0) + 0.35 * math.cos(ang * 23.0 - eff_dy * 12.0))
                if li == 0:
                    srx *= 0.80
                    srz_b *= 0.80
                    clump = 0.0
                x = (srx + clump) * soft_pow(ca, sq)
                z = hz + zc + ((srz_f if sa >= 0 else srz_b) + clump) * soft_pow(sa, sq)
                if front_open > 0.25 and cur_dy < 0.185:
                    x *= 1.0 + 0.08 * front_open
                    z -= 0.009 * front_open
                ring.append((x, hy + eff_dy * s_h, z))
            bob_rings.append(ring)
        bm_bob = loft_rings_bmesh(bob_rings, cap_start=False, cap_end=True)
        def bob_col(x, y, z, nx, ny, nz):
            h_t = clamp((y - (hy - 0.04)) / 0.30, 0.0, 1.0)
            ang = math.atan2(z - hz, x)
            strand_ao = 0.92 + 0.08 * math.sin(ang * 14.0 + y * 16.0)
            front_root = smoothstep(0.05, 0.10, z - hz) * bell((y - (hy + 0.205 * s_h)) / 0.032)
            shade = (0.76 + 0.16 * h_t - 0.14 * front_root) * strand_ao
            return (shade, shade, shade)
        objs.append(create_part_object(
            'HairBobShell', bm_bob, KIND_HAIR, SLOT_HAIR,
            color_func=bob_col, subsurf=1, skin_tag='hair_long'
        ))
        # Seamless side-parted curtain bangs overlapping cleanly from crown part with zero forehead gap
        for side in (-1, 1):
            for bi in range(5):
                pts, rxs, rys = [], [], []
                part_ang = math.pi * 0.5 + 0.14
                for k in range(9):
                    u = k / 8.0
                    # Sweep smoothly outward past outer brow & cheekbones so BOTH eyes stay 100% clear!
                    a = part_ang - side * lerp(0.06 + bi * 0.11, 1.06 + bi * 0.09, u ** 0.72)
                    ca, sa = math.cos(a), math.sin(a)
                    cur_dy = lerp(0.264, 0.072 + bi * 0.018, u ** 1.12)
                    tuck_in = 0.013 * (1.0 - 0.25 * smoothstep(0.65, 1.0, u))
                    srx, srz_f, srz_b, zc, sq = skull_radii_plus(cur_dy, 0.017, tuck_in, 0.017, bob_top)
                    pts.append((srx * soft_pow(ca, sq), hy + cur_dy * s_h, hz + zc + (srz_f if sa >= 0 else srz_b) * soft_pow(sa, sq)))
                    wt = (0.76 + 0.28 * math.sin(u * math.pi)) * (1.0 - 0.68 * u * u)
                    rxs.append(0.0155 * wt + 0.0020)
                    rys.append(0.0054 * wt + 0.0012)
                add_lock(f'CurtainBang_{side}_{bi}', pts, rxs, rys, shade_mul=0.84 + 0.08 * (bi % 2), skin_tag='hair_long')
        # Softly curved-inward layered bob side/back locks breaking up stiff lower edge
        for li, ang_b in enumerate([-0.35, -0.82, -1.32, -1.82, -2.32, -2.79]):
            pts, rxs, rys = [], [], []
            for k in range(7):
                u = k / 6.0
                a = ang_b + 0.06 * math.sin(u * math.pi) * (1 if li % 2 == 0 else -1)
                ca, sa = math.cos(a), math.sin(a)
                cur_dy = lerp(0.195, -0.046 + 0.010 * (li % 2), u)
                curl_in = 1.0 - 0.14 * (u ** 1.8)
                srx = (0.079 * s_w + 0.016) * curl_in
                srz = (0.105 + 0.016) * curl_in
                pts.append((srx * soft_pow(ca, 0.95), hy + cur_dy * s_h, hz - 0.003 + srz * soft_pow(sa, 0.95)))
                wt = (0.72 + 0.28 * math.sin(u * math.pi)) * (1.0 - 0.58 * u * u)
                rxs.append(0.015 * wt + 0.0020)
                rys.append(0.0046 * wt + 0.0011)
            add_lock(f'BobLayer_{li}', pts, rxs, rys, shade_mul=0.80 + 0.10 * (li % 3) / 2.0, skin_tag='hair_long')
    else:
        # Sculpted Solid Cranial Hair Shell for men & ponytail woman
        # Sampled directly outside get_head_profile() + smooth crown dome -> ZERO bald patches anywhere!
        cap_rings = []
        facets = 40
        t_levels = [0.0, 0.06, 0.14, 0.24, 0.35, 0.47, 0.59, 0.70, 0.80, 0.88, 0.94, 0.985]
        vol_top = 0.024 if style == 'player_layered' else (0.020 if style == 'man_part' else (0.016 if style == 'man_crop' else 0.014))
        vol_side = 0.013 if style == 'player_layered' else (0.011 if style == 'man_part' else (0.009 if style == 'man_crop' else 0.010))
        top_dy = top_skull_dy + vol_top
        part_x = -0.024 if style in ('player_layered', 'man_part') else 0.0
        for t in t_levels:
            ring = []
            for i in range(facets):
                ang = i * math.pi * 2.0 / facets
                ca, sa = math.cos(ang), math.sin(ang)
                front = max(0.0, sa)
                back = max(0.0, -sa)
                # Natural hairline: arched forehead (~0.205), ear cutout around |ca|~0.98, clean low nape (~0.065)!
                ear_arch = 0.022 * bell((abs(ca) - 0.96) / 0.16) * bell((sa + 0.12) / 0.24)
                sideburn = -0.028 * bell((abs(ca) - 0.92) / 0.14) * smoothstep(0.05, 0.45, sa)
                temple_dip = -0.014 * bell((abs(ca) - 0.72) / 0.22) * front
                nape_low = 0.060 if style == 'woman_ponytail' else (0.066 if style == 'player_layered' else 0.070)
                base_line = 0.144 + 0.064 * (front ** 0.85) - (0.144 - nape_low) * (back ** 0.92) + ear_arch + sideburn + temple_dip
                dy = lerp(base_line, top_dy, t ** 0.92)
                part_dip = -0.0035 * bell((0.08 * ca - part_x) / 0.013) * smoothstep(0.32, 0.88, t) if part_x != 0.0 else 0.0
                eff_dy = dy + part_dip
                taper_edge = smoothstep(0.0, 0.18, t)
                top_full = smoothstep(0.28, 0.86, t)
                asym = (0.0045 * smoothstep(-0.02, 0.06, ca * 0.08) * top_full) if style in ('player_layered', 'man_part') else 0.0
                # Strictly positive radial thickness outside exact head profile (+safe margin for subsurf=1)
                tx = 0.0055 + (vol_side + asym) * taper_edge + vol_top * 0.25 * top_full
                tf = 0.0055 + (vol_side * 0.85 + vol_top * 0.35 * top_full) * taper_edge
                tb = 0.0070 + (vol_side * 1.18 + vol_top * 0.35 * top_full) * taper_edge
                srx, srz_f, srz_b, zc, sq = skull_radii_plus(eff_dy, tx, tf, tb, top_dy)
                wave_amp = 0.0024 if style != 'woman_ponytail' else 0.0012
                wave = wave_amp * math.sin(ang * 16.0 + t * 5.0) * math.sin(t * math.pi)
                x = (srx + wave) * soft_pow(ca, sq)
                z = hz + zc + ((srz_f if sa >= 0 else srz_b) + wave) * soft_pow(sa, sq)
                ring.append((x, hy + eff_dy * s_h, z))
            cap_rings.append(ring)
        bm_cap = loft_rings_bmesh(cap_rings, cap_start=False, cap_end=True)
        def cap_col(x, y, z, nx, ny, nz):
            t_h = clamp((y - (hy + 0.06)) / 0.22, 0.0, 1.0)
            ang = math.atan2(z - hz, x)
            clump_ao = 0.93 + 0.07 * math.sin(ang * 16.0 + t_h * 5.0)
            shade = (0.72 + 0.18 * t_h) * clump_ao
            return (shade, shade, shade)
        objs.append(create_part_object(
            'HairShell', bm_cap, KIND_HAIR, SLOT_HAIR,
            color_func=cap_col, subsurf=1, skin_tag='head'
        ))

        # 2b. Flush Layered Accent Locks (hugging the sculpted volume cleanly — NEVER spiky noodles!)
        if style == 'player_layered':
            # Soft overlapping side-swept layered fringe cleanly above eyebrows (zero comb gaps)
            for fi, (a0, sweep, drop_y, w_mul) in enumerate([
                (2.04, -0.36, 0.194, 1.32),
                (1.88, -0.34, 0.190, 1.42),
                (1.72, -0.30, 0.188, 1.40),
                (1.56, -0.26, 0.189, 1.36),
                (1.40, -0.22, 0.192, 1.30),
                (1.24, -0.18, 0.196, 1.22),
                (2.14,  0.24, 0.195, 1.20),
                (2.26,  0.20, 0.188, 1.12),
            ]):
                pts, rxs, rys = [], [], []
                for k in range(7):
                    u = k / 6.0
                    a = a0 + sweep * u
                    ca, sa = math.cos(a), math.sin(a)
                    cur_dy = lerp(0.270, drop_y, u ** 1.15)
                    srx, srz_f, srz_b, zc, sq = skull_radii_plus(cur_dy, 0.014, 0.014, 0.016, top_dy)
                    pts.append((srx * soft_pow(ca, sq), hy + cur_dy * s_h, hz + zc + (srz_f if sa >= 0 else srz_b) * soft_pow(sa, sq)))
                    wt = (0.72 + 0.30 * math.sin(u * math.pi)) * (1.0 - 0.56 * (u ** 2.2))
                    rxs.append(0.0145 * w_mul * wt + 0.0022)
                    rys.append(0.0046 * wt + 0.0011)
                add_lock(f'PlayerFringe_{fi}', pts, rxs, rys, shade_mul=0.80 + 0.10 * (fi % 3) / 2.0)
            # Subtle layered crown-to-back hair flow locks for realistic 3rd-person back silhouette
            for bi, a0 in enumerate([-0.95, -1.25, -1.57, -1.89, -2.19]):
                pts, rxs, rys = [], [], []
                for k in range(6):
                    u = k / 5.0
                    a = a0 + 0.08 * math.sin(u * math.pi) * (1 if bi % 2 == 0 else -1)
                    ca, sa = math.cos(a), math.sin(a)
                    cur_dy = lerp(0.268, 0.125 + 0.012 * (bi % 2), u ** 1.05)
                    srx, srz_f, srz_b, zc, sq = skull_radii_plus(cur_dy, 0.014, 0.014, 0.018, top_dy)
                    pts.append((srx * soft_pow(ca, sq), hy + cur_dy * s_h, hz + zc + srz_b * soft_pow(sa, sq)))
                    wt = (0.65 + 0.35 * math.sin(u * math.pi)) * (1.0 - 0.65 * u * u)
                    rxs.append(0.016 * wt + 0.002)
                    rys.append(0.0055 * wt + 0.0012)
                add_lock(f'PlayerBackLock_{bi}', pts, rxs, rys, shade_mul=0.78 + 0.10 * (bi % 3) / 2.0)
        elif style == 'man_part':
            # Full overlapping swept side-part locks across forehead (zero center gap)
            for fi, (a0, sw, drop_y, wm) in enumerate([
                (2.14,  0.20, 0.197, 1.15),
                (2.00, -0.34, 0.194, 1.32),
                (1.84, -0.32, 0.191, 1.40),
                (1.68, -0.28, 0.190, 1.40),
                (1.52, -0.24, 0.192, 1.35),
                (1.36, -0.20, 0.195, 1.25),
                (1.20, -0.16, 0.198, 1.15),
            ]):
                pts, rxs, rys = [], [], []
                for k in range(6):
                    u = k / 5.0
                    a = a0 + sw * u
                    ca, sa = math.cos(a), math.sin(a)
                    cur_dy = lerp(0.266, drop_y, u ** 1.1)
                    srx, srz_f, srz_b, zc, sq = skull_radii_plus(cur_dy, 0.013, 0.013, 0.014, top_dy)
                    pts.append((srx * soft_pow(ca, sq), hy + cur_dy * s_h, hz + zc + (srz_f if sa >= 0 else srz_b) * soft_pow(sa, sq)))
                    wt = (0.74 + 0.28 * math.sin(u * math.pi)) * (1.0 - 0.56 * u * u)
                    rxs.append(0.0145 * wm * wt + 0.0022)
                    rys.append(0.0046 * wt + 0.0011)
                add_lock(f'PartLock_{fi}', pts, rxs, rys, shade_mul=0.80 + 0.10 * (fi % 2))
        elif style == 'man_crop':
            # Natural overlapping asymmetrically feathered crop locks (no comb-tooth gaps!)
            for fi, (a0, sweep, drop_y, w_mul) in enumerate([
                (2.12, -0.18, 0.197, 1.15),
                (1.98, -0.18, 0.193, 1.32),
                (1.84, -0.16, 0.191, 1.38),
                (1.70, -0.15, 0.192, 1.36),
                (1.56, -0.14, 0.190, 1.40),
                (1.42, -0.13, 0.193, 1.34),
                (1.28, -0.12, 0.196, 1.25),
                (1.14, -0.10, 0.199, 1.12),
            ]):
                pts, rxs, rys = [], [], []
                for k in range(6):
                    u = k / 5.0
                    a = a0 + sweep * u
                    ca, sa = math.cos(a), math.sin(a)
                    cur_dy = lerp(0.264, drop_y, u ** 1.08)
                    srx, srz_f, srz_b, zc, sq = skull_radii_plus(cur_dy, 0.011, 0.011, 0.012, top_dy)
                    pts.append((srx * soft_pow(ca, sq), hy + cur_dy * s_h, hz + zc + (srz_f if sa >= 0 else srz_b) * soft_pow(sa, sq)))
                    wt = (0.74 + 0.28 * math.sin(u * math.pi)) * (1.0 - 0.52 * (u ** 2.2))
                    rxs.append(0.0145 * w_mul * wt + 0.0022)
                    rys.append(0.0042 * wt + 0.0010)
                add_lock(f'CropTuft_{fi}', pts, rxs, rys, shade_mul=0.80 + 0.10 * (fi % 3) / 2.0)
            for bi, a0 in enumerate([-1.05, -1.40, -1.74, -2.08]):
                pts, rxs, rys = [], [], []
                for k in range(5):
                    u = k / 4.0
                    ca, sa = math.cos(a0), math.sin(a0)
                    cur_dy = lerp(0.262, 0.138 + 0.010 * (bi % 2), u)
                    srx, srz_f, srz_b, zc, sq = skull_radii_plus(cur_dy, 0.011, 0.011, 0.014, top_dy)
                    pts.append((srx * soft_pow(ca, sq), hy + cur_dy * s_h, hz + zc + srz_b * soft_pow(sa, sq)))
                    wt = (0.70 + 0.30 * math.sin(u * math.pi)) * (1.0 - 0.62 * u * u)
                    rxs.append(0.016 * wt + 0.002)
                    rys.append(0.0044 * wt + 0.0010)
                add_lock(f'CropBack_{bi}', pts, rxs, rys, shade_mul=0.78 + 0.08 * (bi % 2))
        elif style == 'woman_ponytail':
            tie_y = hy + 0.188 * s_h
            tie_z = hz - 0.122
            # Delicate face-framing temple wisps swept cleanly outside eyes & brows
            for side in (-1, 1):
                for bi in range(2):
                    pts, rxs, rys = [], [], []
                    for k in range(7):
                        u = k / 6.0
                        a = math.pi * 0.5 - side * lerp(0.64 + bi * 0.15, 1.12 + bi * 0.10, u ** 0.82)
                        ca, sa = math.cos(a), math.sin(a)
                        cur_dy = lerp(0.218, 0.106 + bi * 0.014, u)
                        srx, srz_f, srz_b, zc, sq = skull_radii_plus(cur_dy, 0.010, 0.009, 0.010, top_dy)
                        pts.append((srx * soft_pow(ca, sq), hy + cur_dy * s_h, hz + zc + (srz_f if sa >= 0 else srz_b) * soft_pow(sa, sq)))
                        wt = 1.0 - 0.68 * u * u
                        rxs.append(0.0068 * wt + 0.0012)
                        rys.append(0.0034 * wt + 0.0009)
                    add_lock(f'FaceStrand_{side}_{bi}', pts, rxs, rys, shade_mul=0.84)

            # Sculpted fabric scrunchie / hair tie
            bm_tie = bmesh.new()
            bmesh.ops.create_cone(bm_tie, cap_ends=True, segments=16, radius1=0.025, radius2=0.025, depth=0.018,
                                  matrix=Matrix.Translation(pt(0.0, tie_y, tie_z - 0.004)) @ Euler((math.pi * 0.42, 0, 0)).to_matrix().to_4x4())
            objs.append(create_part_object(
                'HairTie', bm_tie, KIND_CLOTH, SLOT_ACCENT, base_rgb=(0.88, 0.88, 0.88), skin_tag='head'
            ))

            # Solid full-volume inner ponytail core + 16 flowing layered outer strands
            core_rings = []
            for k in range(10):
                u = k / 9.0
                cy = tie_y + 0.016 * math.sin(u * math.pi * 0.45) - 0.275 * (u ** 1.15)
                cz = tie_z - 0.014 - 0.056 * math.sin(u * math.pi * 0.62) - 0.016 * u
                rad_x = (0.016 + 0.026 * math.sin(u * math.pi * 0.85)) * (1.0 - 0.72 * (u ** 2.1))
                rad_z = (0.014 + 0.020 * math.sin(u * math.pi * 0.85)) * (1.0 - 0.72 * (u ** 2.1))
                ring = []
                for j in range(14):
                    a = j * math.pi * 2.0 / 14.0
                    rip = 1.0 + 0.12 * math.sin(a * 6.0 + u * 8.0)
                    ring.append((rad_x * rip * math.cos(a), cy, cz + rad_z * rip * math.sin(a)))
                core_rings.append(ring)
            bm_core = loft_rings_bmesh(core_rings, cap_start=True, cap_end=True)
            objs.append(create_part_object(
                'PonytailCore', bm_core, KIND_HAIR, SLOT_HAIR,
                color_func=lambda x, y, z, nx, ny, nz: (0.82 + 0.16 * clamp((y - (hy - 0.10)) / 0.30, 0.0, 1.0),) * 3,
                subsurf=1, skin_tag='hair_long'
            ))
            for ti in range(16):
                a = ti * math.pi * 2.0 / 16.0
                tail_len = lerp(0.23, 0.31, (ti * 5 % 4) / 3.0)
                pts, rxs, rys = [], [], []
                for k in range(9):
                    u = k / 8.0
                    spread = (0.015 + 0.026 * math.sin(u * math.pi * 0.85)) * (1.0 - 0.52 * (u ** 2.0))
                    sway = 0.008 * math.sin(u * math.pi * 1.8 + ti * 0.6)
                    lx = spread * math.cos(a) + sway * 0.35
                    ly = tie_y + 0.018 * math.sin(u * math.pi * 0.45) - tail_len * (u ** 1.16)
                    lz = tie_z - 0.014 - 0.058 * math.sin(u * math.pi * 0.62) - 0.016 * u + spread * 0.72 * math.sin(a)
                    pts.append((lx, ly, lz))
                    wt = (0.68 + 0.38 * math.sin(u * math.pi)) * (1.0 - 0.75 * (u ** 2.2))
                    rxs.append(0.0115 * wt + 0.0016)
                    rys.append(0.0065 * wt + 0.0012)
                add_lock(f'PonytailLock_{ti}', pts, rxs, rys, shade_mul=0.80 + 0.24 * (ti % 4) / 3.0, skin_tag='hair_long')

    return objs


# =============================================================================
# 3. CONTINUOUS WELDED TORSO + SLOPED SHOULDERS + NATURAL A-CARRY SLEEVES
# =============================================================================
def build_welded_upper_garment(cfg):
    """
    Builds a SINGLE CONTINUOUS manifold outerwear mesh (sloped trapezius shoulders,
    anatomical V-taper/hourglass torso, seamless 8-vert armhole bridges into gently
    outward-angled natural sleeves) with pre-subsurf topological sleeve masks so
    flared coat skirts NEVER pick up arm weights!
    """
    objs = []
    female = cfg['female']
    coat_kind = cfg['coat_kind']  # 'field_jacket', 'bomber', 'overcoat', 'cropped_jacket', 'trench'
    arm_x = cfg['arm_x']
    arm_y = cfg['arm_y']
    arm_z = cfg['arm_z']
    wrist_x = cfg['wrist_x']
    wrist_z = cfg['wrist_z']
    hy = cfg['head_y']

    if coat_kind == 'overcoat':
        hem_y = 0.72
    elif coat_kind == 'trench':
        hem_y = 0.73
    elif coat_kind == 'cropped_jacket':
        hem_y = 1.005
    elif coat_kind == 'bomber':
        hem_y = 0.945
    else:  # field_jacket (player)
        hem_y = 0.895

    N_RAD = 16
    w_sc = 0.86 if female else 1.0
    d_sc = 0.90 if female else 1.0

    # Natural sloped shoulder profile: collar base -> mid-trapezius -> acromion -> deltoid!
    # (y, rx, rz_front, rz_rear, z_off)
    if coat_kind in ('overcoat', 'trench'):
        waist_r = 0.132 if female else 0.158
        hip_r = 0.172 if female else 0.178
        hem_r = 0.188 if female else 0.192  # Tailored A-line (clears hips/trousers & arms cleanly!)
        torso_rows = [
            (hem_y,                   hem_r,                0.142, 0.152, -0.005),
            (lerp(hem_y, 0.93, 0.55), lerp(hem_r, hip_r, 0.55), 0.138, 0.149, -0.004),
            (0.935,                   hip_r,                0.134, 0.146, -0.003),
            (1.060,                   waist_r,              0.116, 0.122,  0.000),
            (1.165,                   waist_r + 0.016,      0.122, 0.124,  0.002),
            (1.265,                   0.156 * w_sc + 0.014, (0.142 if female else 0.136) * d_sc + 0.007, 0.126 * d_sc + 0.006, 0.003),
            (arm_y - 0.112,           arm_x - 0.022,        0.130 * d_sc + 0.006, 0.124 * d_sc + 0.006, 0.002),  # armhole bot (idx 6)
            (arm_y - 0.042,           arm_x - 0.014,        0.120 * d_sc + 0.005, 0.116 * d_sc + 0.005, 0.001),  # armhole mid (idx 7)
            (arm_y + 0.024,           arm_x - 0.020,        0.096 * d_sc + 0.004, 0.100 * d_sc + 0.004, 0.000),  # acromion top (idx 8)
            (lerp(arm_y + 0.024, hy - 0.014, 0.48), 0.122 * w_sc, 0.082, 0.084, 0.000),                          # trapezius slope (idx 9)
            (hy - 0.014,              0.074 * w_sc,         0.068, 0.070,  0.001),                               # collar base (idx 10)
        ]
    else:
        hip_w = (0.154 if female else 0.168) * (0.94 if coat_kind == 'cropped_jacket' else 1.0)
        waist_w = 0.126 if female else 0.154
        chest_f = 0.146 if female else 0.138
        torso_rows = [
            (hem_y,                   hip_w,                0.122, 0.126, -0.002),
            (lerp(hem_y, 1.06, 0.45), hip_w + 0.004,        0.124, 0.128, -0.001),
            (1.060,                   waist_w,              0.118, 0.120,  0.001),
            (1.150,                   waist_w + 0.015,      0.124, 0.122,  0.002),
            (1.235,                   0.158 * w_sc + 0.011, chest_f * d_sc + 0.007, 0.126 * d_sc + 0.006, 0.003),
            (1.295,                   0.167 * w_sc + 0.011, (chest_f + 0.004) * d_sc + 0.007, 0.128 * d_sc + 0.006, 0.003),
            (arm_y - 0.112,           arm_x - 0.022,        0.126 * d_sc + 0.006, 0.122 * d_sc + 0.006, 0.002),  # armhole bot (idx 6)
            (arm_y - 0.042,           arm_x - 0.014,        0.118 * d_sc + 0.005, 0.116 * d_sc + 0.005, 0.001),  # armhole mid (idx 7)
            (arm_y + 0.024,           arm_x - 0.020,        0.095 * d_sc + 0.004, 0.098 * d_sc + 0.004, 0.000),  # acromion top (idx 8)
            (lerp(arm_y + 0.024, hy - 0.014, 0.48), 0.120 * w_sc, 0.080, 0.082, 0.000),                          # trapezius slope (idx 9)
            (hy - 0.014,              0.072 * w_sc,         0.066, 0.068,  0.001),                               # collar base (idx 10)
        ]

    def torso_front_z(x, ry):
        _, rx, rzf, _, zc = sample_rows(torso_rows, ry)
        ca = clamp(x / max(1e-4, rx), -0.98, 0.98)
        sa = math.sqrt(max(0.0, 1.0 - ca * ca))
        pectoral = (0.016 if female else 0.009) * bell((abs(x) - 0.058 * w_sc) / 0.040) * sa * bell((ry - (1.275 if female else 1.315)) / 0.055)
        return zc + rzf * soft_pow(sa, 0.86) + sa * pectoral

    def sample_torso_surface(ang, ry, offset=0.0):
        _, rx, rzf, rzr, zc = sample_rows(torso_rows, ry)
        ca, sa = math.cos(ang), math.sin(ang)
        x = rx * soft_pow(ca, 0.88)
        rz = rzf if sa >= 0 else rzr
        spine = -0.008 * bell(x / 0.028) * max(0.0, -sa) * smoothstep(0.98, 1.40, ry)
        scapula = 0.007 * bell((abs(x) - 0.064 * w_sc) / 0.034) * max(0.0, -sa) * bell((ry - 1.34) / 0.09)
        pectoral = (0.016 if female else 0.009) * bell((abs(x) - 0.058 * w_sc) / 0.040) * max(0.0, sa) * bell((ry - (1.275 if female else 1.315)) / 0.055)
        z = zc + rz * soft_pow(sa, 0.86) + sa * pectoral - max(0.0, -sa) * (spine + scapula)
        nx_d, nz_d = ca / max(0.04, rx), sa / max(0.04, rz)
        nl = math.hypot(nx_d, nz_d) or 1.0
        return (x + (nx_d / nl) * offset, ry, z + (nz_d / nl) * offset)

    cfg['_torso_surf'] = sample_torso_surface
    cfg['_torso_front_z'] = torso_front_z
    cfg['_torso_rows'] = torso_rows

    bm = bmesh.new()
    t_rings = []
    torso_verts = []
    for ri, (ry, rx, rzf, rzr, zc) in enumerate(torso_rows):
        ring = []
        for j in range(N_RAD):
            ang = j * math.pi * 2.0 / N_RAD
            ca, sa = math.cos(ang), math.sin(ang)
            x = rx * soft_pow(ca, 0.88)
            rz = rzf if sa >= 0 else rzr
            spine = -0.008 * bell(x / 0.028) * max(0.0, -sa) * smoothstep(0.98, 1.40, ry)
            scapula = 0.007 * bell((abs(x) - 0.064 * w_sc) / 0.034) * max(0.0, -sa) * bell((ry - 1.34) / 0.09)
            pectoral = (0.016 if female else 0.009) * bell((abs(x) - 0.058 * w_sc) / 0.040) * max(0.0, sa) * bell((ry - (1.275 if female else 1.315)) / 0.055)
            v_depth = 0.088 if coat_kind in ('overcoat', 'trench') else 0.062
            v_drop = v_depth * smoothstep(1.38, hy - 0.014, ry) * (max(0.0, sa) ** 4)
            z = zc + rz * soft_pow(sa, 0.86) + sa * pectoral - max(0.0, -sa) * (spine + scapula)
            v = bm.verts.new(pt(x, ry - v_drop, z))
            ring.append(v)
            torso_verts.append(v)
        t_rings.append(ring)

    skip_left = {(6, 15), (6, 0), (7, 15), (7, 0)}
    skip_right = {(6, 7), (6, 8), (7, 7), (7, 8)}
    for ri in range(len(t_rings) - 1):
        r0, r1 = t_rings[ri], t_rings[ri + 1]
        for j in range(N_RAD):
            if (ri, j) in skip_left or (ri, j) in skip_right:
                continue
            jn = (j + 1) % N_RAD
            bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))

    # Turn hem cleanly inward
    hem_in_ring = []
    for v in t_rings[0]:
        x, y, z = from_pt(v.co)
        vin = bm.verts.new(pt(x * 0.90, y + 0.014, z * 0.90))
        hem_in_ring.append(vin)
        torso_verts.append(vin)
    for j in range(N_RAD):
        jn = (j + 1) % N_RAD
        bm.faces.new((hem_in_ring[j], hem_in_ring[jn], t_rings[0][jn], t_rings[0][j]))

    elbow_y = arm_y - UPPER_ARM_LEN
    wrist_y = elbow_y - 0.232
    sl_sc = 0.82 if female else 1.0

    oct_dirs = [
        (-0.707,  0.707),  # k=0: inner-front
        ( 0.000,  1.000),  # k=1: front
        ( 0.707,  0.707),  # k=2: outer-front
        ( 1.000,  0.000),  # k=3: outer (deltoid cap)
        ( 0.707, -0.707),  # k=4: outer-back
        ( 0.000, -1.000),  # k=5: back
        (-0.707, -0.707),  # k=6: inner-back
        (-1.000,  0.000),  # k=7: inner (armpit)
    ]

    sleeve_L_entries = []  # (vert, weight)
    sleeve_R_entries = []

    for side in (-1, 1):
        if side == 1:
            hole_loop = [
                t_rings[6][1], t_rings[7][1], t_rings[8][1], t_rings[8][0],
                t_rings[8][15], t_rings[7][15], t_rings[6][15], t_rings[6][0],
            ]
            s_entries = sleeve_L_entries
        else:
            hole_loop = [
                t_rings[6][7], t_rings[7][7], t_rings[8][7], t_rings[8][8],
                t_rings[8][9], t_rings[7][9], t_rings[6][9], t_rings[6][8],
            ]
            s_entries = sleeve_R_entries

        # Partial arm weight on the armhole seam loop itself for silky smooth deltoid deformation
        for hv in hole_loop:
            s_entries.append((hv, 0.35))

        # Smooth rounded deltoid -> gently outward-angled natural bicep/elbow/forearm -> wrist!
        # Gives a clean daylight silhouette gap outside torso & coat hem!
        sleeve_specs = [
            (side * lerp(arm_x, wrist_x, 0.25), arm_y - 0.014, arm_z + 0.000, 0.052 * sl_sc, 0.055 * sl_sc, 0.42, 0.72),
            (side * lerp(arm_x, wrist_x, 0.55), arm_y - 0.062, arm_z - 0.002, 0.051 * sl_sc, 0.054 * sl_sc, 0.14, 0.94),
            (side * lerp(arm_x, wrist_x, 0.72), arm_y - 0.132, arm_z - 0.004, 0.049 * sl_sc, 0.051 * sl_sc, 0.02, 1.00),
            (side * lerp(arm_x, wrist_x, 0.84), arm_y - 0.208, arm_z - 0.007, 0.046 * sl_sc, 0.048 * sl_sc, 0.00, 1.00),
            (side * lerp(arm_x, wrist_x, 0.90), elbow_y,       arm_z - 0.008, 0.045 * sl_sc, 0.047 * sl_sc, 0.00, 1.00),
            (side * lerp(arm_x, wrist_x, 0.95), elbow_y - 0.076, lerp(arm_z - 0.004, wrist_z, 0.35), 0.043 * sl_sc, 0.045 * sl_sc, 0.00, 1.00),
            (side * lerp(arm_x, wrist_x, 0.99), elbow_y - 0.155, lerp(arm_z, wrist_z, 0.72),         0.039 * sl_sc, 0.041 * sl_sc, 0.00, 1.00),
            (side * wrist_x,                    wrist_y + 0.018, wrist_z,                             0.036 * sl_sc, 0.038 * sl_sc, 0.00, 1.00),
            (side * wrist_x,                    wrist_y,         wrist_z,                             0.034 * sl_sc, 0.036 * sl_sc, 0.00, 1.00),
        ]

        prev_ring = hole_loop
        for si, (cx, cy, cz, r_out, r_fb, tilt, sw_val) in enumerate(sleeve_specs):
            ring = []
            ct, st = math.cos(tilt), math.sin(tilt)
            for k, (ow, fw) in enumerate(oct_dirs):
                dx = side * (ow * r_out * ct)
                dy = ow * r_out * st
                dz = fw * r_fb
                if si == 4:
                    dz -= 0.004
                v = bm.verts.new(pt(cx + dx, cy + dy, cz + dz))
                ring.append(v)
                s_entries.append((v, sw_val))
            for k in range(8):
                kn = (k + 1) % 8
                if side == 1:
                    bm.faces.new((prev_ring[k], prev_ring[kn], ring[kn], ring[k]))
                else:
                    bm.faces.new((prev_ring[kn], prev_ring[k], ring[k], ring[kn]))
            prev_ring = ring

        cuff_in = []
        for v in prev_ring:
            vx, vy, vz = from_pt(v.co)
            vc = bm.verts.new(pt(lerp(vx, side * wrist_x, 0.30), vy + 0.015, lerp(vz, wrist_z, 0.30)))
            cuff_in.append(vc)
            s_entries.append((vc, 1.0))
        for k in range(8):
            kn = (k + 1) % 8
            if side == 1:
                bm.faces.new((prev_ring[k], prev_ring[kn], cuff_in[kn], cuff_in[k]))
            else:
                bm.faces.new((prev_ring[kn], prev_ring[k], cuff_in[k], cuff_in[kn]))

    bm.verts.index_update()
    pre_vg = {
        '__sleeve_L': [(v.index, wv) for v, wv in sleeve_L_entries],
        '__sleeve_R': [(v.index, wv) for v, wv in sleeve_R_entries],
    }

    def garment_color(x, y, z, nx, ny, nz):
        ax = abs(x)
        armpit = bell((ax - (arm_x - 0.022)) / 0.044) * bell((y - (arm_y - 0.105)) / 0.055)
        elbow_crease = bell((y - elbow_y) / 0.032) * smoothstep(arm_x - 0.03, arm_x + 0.02, ax) * smoothstep(-0.2, 0.8, nz)
        waist_fold = 0.055 * math.sin((y - 1.05) * 38.0 + ax * 14.0) * bell((y - 1.08) / 0.14)
        hem_ao = smoothstep(hem_y + 0.08, hem_y, y) * 0.11
        front_placket = bell(x / 0.015) * smoothstep(0.4, 0.9, nz) * 0.10
        collar_ao = bell((y - (hy - 0.048)) / 0.032) * smoothstep(0.115 * w_sc, 0.045 * w_sc, ax) * 0.11
        # Tailored darker upper-shoulder yoke panel & princess/side seam shading for realism!
        yoke_line = 0.0
        yoke_shade = 0.0
        if coat_kind in ('field_jacket', 'bomber'):
            yoke_h = arm_y - 0.032
            yoke_zone = smoothstep(yoke_h - 0.012, yoke_h + 0.012, y) * smoothstep(arm_x + 0.02, arm_x - 0.02, ax)
            yoke_shade = 0.20 * yoke_zone if coat_kind == 'field_jacket' else 0.08 * yoke_zone
            yoke_line = 0.17 * bell((y - yoke_h) / 0.009) * smoothstep(arm_x + 0.02, arm_x - 0.02, ax)
        elif coat_kind in ('overcoat', 'trench'):
            yoke_h = arm_y - 0.055
            yoke_line = 0.11 * bell((y - yoke_h) / 0.010) * smoothstep(arm_x + 0.01, arm_x - 0.03, ax) * smoothstep(-0.3, 0.7, -nz)
        princess_seam = 0.075 * bell((ax - (0.076 if not female else 0.062)) / 0.008) * smoothstep(0.35, 0.85, nz) * smoothstep(hem_y + 0.04, arm_y - 0.05, y)
        shoulder_seam = 0.09 * bell((ax - (arm_x - 0.022)) / 0.010) * smoothstep(arm_y - 0.11, arm_y + 0.03, y)
        side_seam = 0.075 * bell((ax - (0.145 if not female else 0.125)) / 0.012) * bell(nz / 0.35) * smoothstep(hem_y, arm_y - 0.12, y)
        ao = 0.96 - 0.24 * armpit - 0.11 * elbow_crease - hem_ao - front_placket - collar_ao - yoke_shade - yoke_line - princess_seam - shoulder_seam - side_seam + waist_fold
        ao += 0.045 * clamp(ny, 0.0, 1.0)
        return (ao, ao, ao)

    upper_obj = create_part_object(
        'UpperGarment', bm, KIND_CLOTH, SLOT_TOP,
        color_func=garment_color, subsurf=2, smooth_iters=0, skin_tag='upper_body',
        pre_vgroups=pre_vg
    )

    # Sculpt subtle organic cloth drape folds directly onto subdivided vertices
    mesh = upper_obj.data
    vg_sl = upper_obj.vertex_groups.get('__sleeve_L')
    vg_sr = upper_obj.vertex_groups.get('__sleeve_R')
    sl_indices = {vg.index for vg in (vg_sl, vg_sr) if vg is not None}
    for v in mesh.vertices:
        x, y, z = from_pt(v.co)
        nx, ny, nz = from_pt(v.normal)
        sl_w = 0.0
        for g in v.groups:
            if g.group in sl_indices:
                sl_w = max(sl_w, g.weight)
        fold = 0.0
        if sl_w < 0.45:
            # Keep center front placket calm so zippers/buttons never clip into cloth ripples
            placket_calm = 1.0 - smoothstep(0.032, 0.008, abs(x)) * smoothstep(0.2, 0.7, nz)
            fold += 0.0028 * placket_calm * math.sin(y * 34.0 + x * 16.0) * bell((y - 1.06) / 0.12)
            fold += 0.0024 * math.cos(y * 26.0 - abs(x) * 18.0) * bell((y - 1.34) / 0.08) * max(0.0, -nz)
            if coat_kind in ('overcoat', 'trench') and y < 0.98:
                ang = math.atan2(z, x)
                fold += 0.0045 * math.sin(ang * 7.0 + 0.6) * smoothstep(0.98, hem_y, y)
        else:
            fold += 0.0026 * math.sin((y - elbow_y) * 58.0 + z * 28.0) * bell((y - elbow_y) / 0.055)
            fold += 0.0020 * math.sin((y - wrist_y) * 62.0) * bell((y - (wrist_y + 0.04)) / 0.045)
        if abs(fold) > 1e-5:
            v.co = pt(x + nx * fold, y + ny * fold, z + nz * fold)
    mesh.update()
    cfg['_upper_obj'] = upper_obj
    objs.append(upper_obj)

    # 3b. Inner Layer (Tailored Crew-neck Tee / Sweater cleanly visible at open V-neckline)
    inner_rings = []
    for ry_base, rx, rz, front_dip in [
        (hy - 0.175, 0.112 * w_sc, 0.108 * d_sc, 0.000),
        (hy - 0.112, 0.100 * w_sc, 0.098 * d_sc, 0.006),
        (hy - 0.058, 0.081 * w_sc, 0.080 * d_sc, 0.012),
        (hy - 0.028, 0.063 * w_sc, 0.063 * d_sc, 0.016),
        (hy - 0.020, 0.059 * w_sc, 0.059 * d_sc, 0.015),
    ]:
        ring = []
        for j in range(18):
            a = j * math.pi * 2.0 / 18.0
            sa = math.sin(a)
            ring.append((rx * math.cos(a), ry_base - front_dip * max(0.0, sa) ** 1.4, 0.003 + rz * sa))
        inner_rings.append(ring)
    bm_inner = loft_rings_bmesh(inner_rings, cap_start=False, cap_end=False)
    def inner_col(x, y, z, nx, ny, nz):
        rib = bell((y - (hy - 0.036 + 0.012 * clamp(-nz, 0.0, 1.0))) / 0.007)
        v_shadow = smoothstep(0.030 * w_sc, 0.068 * w_sc, abs(x)) * 0.10
        s = 0.94 - 0.09 * rib - v_shadow
        return (s, s, s)
    objs.append(create_part_object(
        'InnerShirt', bm_inner, KIND_DENIM, SLOT_INNER,
        color_func=inner_col,
        subsurf=1, skin_tag='upper_torso'
    ))

    # 3c. Tailored Open-Front Collar Stand & Crisp Flat Folded Collars / Lapels
    # Open C-shaped collar stand wraps around back & sides ONLY — NEVER crosses open front undershirt!
    is_long = coat_kind in ('overcoat', 'trench')
    is_bomber = coat_kind == 'bomber'

    def build_open_collar_band(a_half_span, profile_pts, kind_c, shade_rgb, name_c):
        """Build a clean solid-thickness open horseshoe band along angle [-pi/2 - span .. -pi/2 + span]."""
        n_ang = 20
        n_prof = len(profile_pts)
        bm_c = bmesh.new()
        v_slices = []
        for i in range(n_ang):
            u = i / (n_ang - 1)
            t_sym = (u - 0.5) * 2.0  # -1 right front .. 0 back .. +1 left front
            a = -math.pi * 0.5 + t_sym * a_half_span
            ca, sa = math.cos(a), math.sin(a)
            front_t = smoothstep(-0.15, 0.85, sa)
            end_taper = 1.0 - 0.55 * (abs(t_sym) ** 5)
            ring = []
            for py_off, pr_off in profile_pts:
                cy = (hy + py_off * end_taper) - (0.046 if is_bomber else (0.056 if is_long else 0.042)) * (front_t ** 1.35)
                rx_s = 0.068 * w_sc + pr_off + 0.006 * front_t
                rz_s = 0.066 * d_sc + pr_off + 0.007 * front_t
                ring.append(bm_c.verts.new(pt(rx_s * ca, cy, 0.001 + rz_s * sa)))
            v_slices.append(ring)
        for i in range(n_ang - 1):
            s0, s1 = v_slices[i], v_slices[i + 1]
            for k in range(n_prof):
                kn = (k + 1) % n_prof
                bm_c.faces.new((s0[k], s0[kn], s1[kn], s1[k]))
        for s_end, rev in ((v_slices[0], True), (v_slices[-1], False)):
            c_end = bm_c.verts.new(sum((v.co for v in s_end), Vector()) / n_prof)
            for k in range(n_prof):
                kn = (k + 1) % n_prof
                bm_c.faces.new((s_end[kn], s_end[k], c_end) if rev else (s_end[k], s_end[kn], c_end))
        return create_part_object(name_c, bm_c, kind_c, SLOT_TOP, base_rgb=shade_rgb, subsurf=1, skin_tag='upper_torso')

    if is_bomber:
        # Clean ribbed bomber knit stand collar hugging neck cleanly & stopping neatly at zipper top
        bomber_prof = [
            (-0.022, 0.006), (-0.004, 0.007), (0.011, 0.006),
            ( 0.014, 0.002), ( 0.008, -0.002), (-0.018, -0.002),
        ]
        objs.append(build_open_collar_band(math.pi * 0.78, bomber_prof, KIND_DENIM, (0.76, 0.76, 0.76), 'CollarStand'))
    else:
        stand_prof = [
            (-0.022, 0.005), (-0.004, 0.006), (0.010, 0.005),
            ( 0.013, 0.002), ( 0.006, -0.002), (-0.018, -0.002),
        ]
        objs.append(build_open_collar_band(math.pi * 0.70, stand_prof, KIND_CLOTH, (0.78, 0.78, 0.78), 'CollarStand'))

        # Crisp flat folded turn-down collar / notched lapels lying flush against chest (zero sausage tubes!)
        for side in (-1, 1):
            bm_lap = bmesh.new()
            n_u = 14
            thick = 0.0036 if is_long else 0.0030
            slices = []
            for i in range(n_u):
                u = i / (n_u - 1)
                a = -math.pi * 0.5 + side * u * (math.pi * 0.88)
                ca, sa = math.cos(a), math.sin(a)
                front = smoothstep(0.18, 0.92, sa)
                # Inner fold edge hugs collar stand / V-neck placket
                in_y = (hy + 0.010) - (0.172 if is_long else 0.094) * (front ** 1.45)
                in_x = (0.072 * w_sc * ca) * (1.0 - 0.76 * (front ** 1.6))
                if front > 0.35:
                    in_z = lerp(0.002 + 0.072 * d_sc * sa, torso_front_z(in_x, in_y) + 0.004, smoothstep(0.35, 0.75, front))
                else:
                    in_z = 0.002 + 0.073 * d_sc * sa
                # Outer folded collar / lapel tip lies flat along shoulders & chest
                lap_w = (0.044 if is_long else 0.032) * (0.68 + 0.45 * math.sin(u * math.pi * 0.88))
                if is_long:
                    # Subtle classic coat lapel notch near u ~ 0.62
                    lap_w *= 1.0 - 0.22 * bell((u - 0.60) / 0.065)
                if u > 0.88:
                    lap_w *= lerp(1.0, 0.18, (u - 0.88) / 0.12)
                out_y = in_y - (0.026 * (1.0 - 0.55 * front)) - (0.012 * front if not is_long else 0.006 * front)
                out_x = in_x + side * lap_w * (0.28 + 0.72 * front) + ca * lap_w * (0.35 * (1.0 - front))
                if front > 0.25:
                    out_z = lerp(0.002 + (0.073 * d_sc + lap_w * 0.55) * sa, torso_front_z(out_x, out_y) + 0.0055, smoothstep(0.25, 0.70, front))
                else:
                    out_z = 0.002 + (0.075 * d_sc + lap_w * 0.42) * sa
                # Outward normal direction for crisp 3mm flat cloth thickness
                n_vec = Vector((ca * 0.35, 0.15 * (1.0 - front), sa * 0.90 + 0.25 * front)).normalized()
                p_in = Vector((in_x, in_y, in_z))
                p_out = Vector((out_x, out_y, out_z))
                p_mid = p_in.lerp(p_out, 0.5) + n_vec * (thick * 0.45)
                p_in_b = p_in - n_vec * (thick * 0.55)
                p_out_b = p_out - n_vec * (thick * 0.55)
                ring_pts = [p_in + n_vec * (thick * 0.55), p_mid, p_out + n_vec * (thick * 0.35), p_out_b, p_in_b]
                slices.append([bm_lap.verts.new(pt(q.x, q.y, q.z)) for q in ring_pts])
            for i in range(n_u - 1):
                s0, s1 = slices[i], slices[i + 1]
                for k in range(5):
                    kn = (k + 1) % 5
                    if side == 1:
                        bm_lap.faces.new((s0[k], s0[kn], s1[kn], s1[k]))
                    else:
                        bm_lap.faces.new((s0[kn], s0[k], s1[k], s1[kn]))
            for s_end, flip_e in ((slices[0], side == 1), (slices[-1], side != 1)):
                c_e = bm_lap.verts.new(sum((v.co for v in s_end), Vector()) / 5.0)
                for k in range(5):
                    kn = (k + 1) % 5
                    bm_lap.faces.new((s_end[kn], s_end[k], c_e) if flip_e else (s_end[k], s_end[kn], c_e))
            objs.append(create_part_object(
                f'Collar_{side}', bm_lap, KIND_CLOTH, SLOT_TOP,
                base_rgb=(0.86, 0.86, 0.86), subsurf=1, skin_tag='upper_torso'
            ))

    # 3d. Front Storm Placket, Refined Zipper / Buttons, Tailored Pockets & Ribbed Cuffs
    zip_top = hy - (0.165 if is_long else (0.064 if is_bomber else 0.088))
    zip_bot = hem_y + 0.020
    if coat_kind in ('field_jacket', 'bomber', 'cropped_jacket'):
        # Fine dark gunmetal zipper track + subtle pull tab (replaces thick silver pipe)
        z_pts = []
        for k in range(16):
            u = k / 15.0
            zy = lerp(zip_bot, zip_top, u)
            z_pts.append((0.0, zy, torso_front_z(0.0, zy) + 0.0048))
        bm_zip = ribbon_tube_bmesh(z_pts, [0.0026] * 16, [0.0018] * 16, sides=4, cap=True)
        objs.append(create_part_object(
            'ZipperPlacket', bm_zip, KIND_METAL, SLOT_FIXED,
            base_rgb=(0.30, 0.31, 0.33), skin_tag='upper_torso'
        ))
        bm_pull = bmesh.new()
        bmesh.ops.create_cube(bm_pull, size=1.0,
                              matrix=Matrix.Translation(pt(0.0, zip_top - 0.008, torso_front_z(0.0, zip_top - 0.008) + 0.0062)) @ Matrix.Diagonal((0.0055, 0.0032, 0.013, 1.0)))
        objs.append(create_part_object(
            'ZipperPull', bm_pull, KIND_METAL, SLOT_FIXED,
            base_rgb=(0.42, 0.43, 0.45), skin_tag='upper_torso'
        ))
    else:
        # Tailored double-breasted (trench) or single-breasted (overcoat) buttons
        btn_cols = (-0.024, 0.024) if coat_kind == 'trench' else (0.016,)
        for bxi, bx in enumerate(btn_cols):
            for bi in range(4):
                by = lerp(0.95, 1.26, bi / 3.0)
                bm_btn = bmesh.new()
                bmesh.ops.create_cone(bm_btn, cap_ends=True, segments=10, radius1=0.008, radius2=0.008, depth=0.004,
                                      matrix=Matrix.Translation(pt(bx, by, torso_front_z(bx, by) + 0.006)) @ Euler((math.pi * 0.5, 0, 0)).to_matrix().to_4x4())
                objs.append(create_part_object(
                    f'CoatButton_{bxi}_{bi}', bm_btn, KIND_METAL, SLOT_FIXED,
                    base_rgb=(0.20, 0.17, 0.14), skin_tag='upper_torso'
                ))

    # Trench Waist Belt & Buckle
    if coat_kind == 'trench':
        belt_rings = []
        for dy_b in (-0.017, 0.0, 0.017):
            ring = []
            for j in range(24):
                a = j * math.pi * 2.0 / 24.0
                ca, sa = math.cos(a), math.sin(a)
                rx_b = 0.140 if female else 0.166
                rz_b = 0.126
                ring.append((rx_b * soft_pow(ca, 0.88), 1.060 + dy_b, rz_b * soft_pow(sa, 0.86)))
            belt_rings.append(ring)
        bm_belt = loft_rings_bmesh(belt_rings, cap_start=False, cap_end=False)
        objs.append(create_part_object(
            'TrenchBelt', bm_belt, KIND_CLOTH, SLOT_TOP,
            base_rgb=(0.78, 0.78, 0.78), subsurf=1, skin_tag='upper_torso'
        ))
        bm_bk = bmesh.new()
        bmesh.ops.create_cube(bm_bk, size=1.0, matrix=Matrix.Translation(pt(0.0, 1.060, 0.130)) @ Matrix.Diagonal((0.034, 0.009, 0.038, 1.0)))
        objs.append(create_part_object(
            'TrenchBuckle', bm_bk, KIND_METAL, SLOT_FIXED, base_rgb=(0.70, 0.60, 0.36), skin_tag='upper_torso'
        ))

    # Ribbed Knit Cuffs & Waistband Hem (field jacket / bomber)
    if coat_kind in ('field_jacket', 'bomber'):
        for side in (-1, 1):
            c_rings = []
            for cy_c, cr in ((wrist_y - 0.010, 0.033 * sl_sc), (wrist_y + 0.022, 0.037 * sl_sc)):
                c_rings.append([(side * wrist_x + cr * math.cos(k * math.pi * 2 / 14), cy_c, wrist_z + cr * 1.04 * math.sin(k * math.pi * 2 / 14)) for k in range(14)])
            bm_cf = loft_rings_bmesh(c_rings, cap_start=False, cap_end=False)
            objs.append(create_part_object(
                f'SleeveCuff_{side}', bm_cf, KIND_DENIM, SLOT_TOP,
                base_rgb=(0.68, 0.68, 0.68), skin_tag='elbow_L' if side == 1 else 'elbow_R'
            ))
        # Tailored ribbed bottom waistband for both field_jacket and bomber
        h_rings = []
        h_rx0 = hip_w - 0.004
        h_rx1 = hip_w + 0.005
        for hy_r, hr_x, hr_z in ((hem_y - 0.006, h_rx0, 0.123), (hem_y + 0.036, h_rx1, 0.129)):
            h_rings.append([(hr_x * soft_pow(math.cos(k * math.pi * 2 / 24), 0.88), hy_r, -0.002 + hr_z * soft_pow(math.sin(k * math.pi * 2 / 24), 0.86)) for k in range(24)])
        bm_hem = loft_rings_bmesh(h_rings, cap_start=False, cap_end=False)
        objs.append(create_part_object(
            'JacketHemBand', bm_hem, KIND_DENIM, SLOT_TOP,
            base_rgb=(0.70, 0.70, 0.70), skin_tag='upper_torso'
        ))

    # Helper for flush surface-conforming flat cloth pocket patches & flaps
    def add_flat_pocket_patch(name_p, x0, x1, y0, y1, z_lift, shade_p):
        bm_p = bmesh.new()
        nx_s, ny_s = 5, 4
        front_g, back_g = [], []
        for iy in range(ny_s):
            vy = lerp(y0, y1, iy / (ny_s - 1))
            fr, br = [], []
            for ix in range(nx_s):
                vx = lerp(x0, x1, ix / (nx_s - 1))
                vz = torso_front_z(vx, vy)
                fr.append(bm_p.verts.new(pt(vx, vy, vz + z_lift)))
                br.append(bm_p.verts.new(pt(vx, vy, vz - 0.0010)))
            front_g.append(fr)
            back_g.append(br)
        for iy in range(ny_s - 1):
            for ix in range(nx_s - 1):
                bm_p.faces.new((front_g[iy][ix], front_g[iy][ix + 1], front_g[iy + 1][ix + 1], front_g[iy + 1][ix]))
        for ix in range(nx_s - 1):
            bm_p.faces.new((back_g[0][ix], back_g[0][ix + 1], front_g[0][ix + 1], front_g[0][ix]))
            bm_p.faces.new((front_g[-1][ix], front_g[-1][ix + 1], back_g[-1][ix + 1], back_g[-1][ix]))
        for iy in range(ny_s - 1):
            bm_p.faces.new((back_g[iy][0], front_g[iy][0], front_g[iy + 1][0], back_g[iy + 1][0]))
            bm_p.faces.new((front_g[iy][-1], back_g[iy][-1], back_g[iy + 1][-1], front_g[iy + 1][-1]))
        objs.append(create_part_object(
            name_p, bm_p, KIND_CLOTH, SLOT_TOP,
            base_rgb=(shade_p, shade_p, shade_p), skin_tag='upper_torso'
        ))

    if coat_kind == 'field_jacket':
        for side in (-1, 1):
            # Flat tailored rectangular chest patch pocket + subtle top flap + tiny dark snap
            xa = side * 0.042
            xb = side * 0.098
            x0, x1 = (xa, xb) if xa < xb else (xb, xa)
            add_flat_pocket_patch(f'ChestPocketBody_{side}', x0, x1, 1.242, 1.298, 0.0024, 0.87)
            add_flat_pocket_patch(f'ChestPocketFlap_{side}', x0 - 0.002, x1 + 0.002, 1.284, 1.304, 0.0038, 0.80)
            sx_btn = 0.5 * (x0 + x1)
            bm_sb = bmesh.new()
            bmesh.ops.create_cone(bm_sb, cap_ends=True, segments=8, radius1=0.0038, radius2=0.0038, depth=0.0024,
                                  matrix=Matrix.Translation(pt(sx_btn, 1.290, torso_front_z(sx_btn, 1.290) + 0.0046)) @ Euler((math.pi * 0.5, 0, 0)).to_matrix().to_4x4())
            objs.append(create_part_object(f'ChestSnap_{side}', bm_sb, KIND_METAL, SLOT_FIXED, base_rgb=(0.24, 0.25, 0.27), skin_tag='upper_torso'))
            # Sleek flat slanted lower hip welt pockets
            hp_pts = []
            for k in range(5):
                u = k / 4.0
                hpx = side * (0.068 + u * 0.056)
                hpy = lerp(0.985, 1.032, u)
                hp_pts.append((hpx, hpy, torso_front_z(hpx, hpy) + 0.0024))
            bm_hp = ribbon_tube_bmesh(hp_pts, [0.0052] * 5, [0.0020] * 5, sides=4, cap=True)
            objs.append(create_part_object(
                f'HipPocket_{side}', bm_hp, KIND_CLOTH, SLOT_TOP,
                base_rgb=(0.82, 0.82, 0.82), skin_tag='upper_torso'
            ))
    elif coat_kind in ('bomber', 'cropped_jacket', 'overcoat', 'trench'):
        # Clean flat slanted lower hand-warmer welt pockets (zero bulky chest pills / strap collisions!)
        py_lo = 0.90 if is_long else (1.055 if coat_kind == 'cropped_jacket' else 1.035)
        for side in (-1, 1):
            hp_pts = []
            for k in range(5):
                u = k / 4.0
                hpx = side * (0.062 + u * 0.054) * w_sc
                hpy = lerp(py_lo, py_lo + 0.044, u)
                hp_pts.append((hpx, hpy, torso_front_z(hpx, hpy) + 0.0022))
            bm_hp = ribbon_tube_bmesh(hp_pts, [0.0048] * 5, [0.0018] * 5, sides=4, cap=True)
            objs.append(create_part_object(
                f'HipPocket_{side}', bm_hp, KIND_CLOTH, SLOT_TOP,
                base_rgb=(0.82, 0.82, 0.82), skin_tag='upper_torso'
            ))

    return objs


# =============================================================================
# 4. CONTINUOUS WELDED TROUSERS / JEANS (CLEAN SILHOUETTE & LEG MASKS)
# =============================================================================
def build_welded_trousers(cfg):
    objs = []
    female = cfg['female']
    hip_x = cfg['hip_x']

    N_PELV = 12
    is_cropped = cfg['coat_kind'] == 'cropped_jacket'
    w_w = (0.122 if female else 0.146) if is_cropped else (0.112 if female else 0.138)
    h_w = (0.162 if female else 0.162) if is_cropped else (0.154 if female else 0.158)
    glute_d = (0.124 if female else 0.118) if is_cropped else (0.118 if female else 0.114)

    pelvis_rows = [
        (1.065, w_w,                  0.098, 0.100,  0.000),
        (1.005, lerp(w_w, h_w, 0.55), 0.104, 0.110, -0.003),
        (0.942, h_w,                  0.108, glute_d, -0.005),
        (0.868, h_w - 0.002,          0.104, glute_d - 0.003, -0.004),
    ]

    bm = bmesh.new()
    p_rings = []
    for ry, rx, rzf, rzr, zc in pelvis_rows:
        ring = []
        for j in range(N_PELV):
            ang = j * math.pi * 2.0 / N_PELV
            ca, sa = math.cos(ang), math.sin(ang)
            x = rx * soft_pow(ca, 0.88)
            rz = rzf if sa >= 0 else rzr
            cleft = -0.009 * bell(x / 0.024) * max(0.0, -sa) * smoothstep(1.03, 0.88, ry)
            z = zc + rz * soft_pow(sa, 0.88) - max(0.0, -sa) * cleft
            ring.append(bm.verts.new(pt(x, ry, z)))
        p_rings.append(ring)

    for ri in range(len(p_rings) - 1):
        r0, r1 = p_rings[ri], p_rings[ri + 1]
        for j in range(N_PELV):
            jn = (j + 1) % N_PELV
            bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))

    crotch_mid = bm.verts.new(pt(0.0, 0.822, -0.008))
    leg_sc = 0.96 if female else 1.08
    ankle_r = 0.051 if female else 0.058
    if cfg['coat_kind'] == 'cropped_jacket':
        ankle_r = 0.058  # Stylish relaxed straight-leg trousers

    leg_specs = [
        (0.785, 0.000, -0.004, 0.079 * leg_sc, 0.083 * leg_sc),
        (0.672, 0.000,  0.002, 0.072 * leg_sc, 0.076 * leg_sc),
        (0.568, 0.000,  0.004, 0.064 * leg_sc, 0.068 * leg_sc),
        (KNEE_Y, 0.000, 0.005, 0.059 * leg_sc, 0.063 * leg_sc),
        (0.408, 0.000, -0.006, 0.058 * leg_sc, 0.064 * leg_sc),
        (0.302, 0.000, -0.008, 0.055 * leg_sc, 0.060 * leg_sc),
        (0.200, 0.000, -0.004, ankle_r + 0.003, ankle_r + 0.005),
        (0.136, 0.000,  0.000, ankle_r,         ankle_r + 0.003),
    ]
    left_angs = [2.15, 1.35, 0.58, 0.0, -0.58, -1.35, -2.15, math.pi]

    leg_L_entries = []
    leg_R_entries = []
    for side in (1, -1):
        r3 = p_rings[-1]
        l_entries = leg_L_entries if side == 1 else leg_R_entries
        if side == 1:
            prev = [r3[3], r3[2], r3[1], r3[0], r3[11], r3[10], r3[9], crotch_mid]
        else:
            prev = [r3[3], r3[4], r3[5], r3[6], r3[7], r3[8], r3[9], crotch_mid]
        for pv in prev:
            l_entries.append((pv, 0.5))

        for li, (ly, cx_o, cz, lrx, lrz) in enumerate(leg_specs):
            ring = []
            cx = side * (hip_x + cx_o)
            for k, la in enumerate(left_angs):
                ca, sa = math.cos(la), math.sin(la)
                vx = cx + side * lrx * ca
                vz = cz + lrz * sa
                if li == 3:
                    vz += 0.003 * max(0.0, sa)
                v = bm.verts.new(pt(vx, ly, vz))
                ring.append(v)
                l_entries.append((v, 1.0))
            for k in range(8):
                kn = (k + 1) % 8
                if side == 1:
                    bm.faces.new((prev[kn], prev[k], ring[k], ring[kn]))
                else:
                    bm.faces.new((prev[k], prev[kn], ring[kn], ring[k]))
            prev = ring

        hem_in = []
        for v in prev:
            vx, vy, vz = from_pt(v.co)
            vh = bm.verts.new(pt(lerp(vx, side * hip_x, 0.25), vy + 0.018, lerp(vz, 0.0, 0.25)))
            hem_in.append(vh)
            l_entries.append((vh, 1.0))
        for k in range(8):
            kn = (k + 1) % 8
            if side == 1:
                bm.faces.new((prev[kn], prev[k], hem_in[k], hem_in[kn]))
            else:
                bm.faces.new((prev[k], prev[kn], hem_in[kn], hem_in[k]))

    bm.verts.index_update()
    pre_vg = {
        '__leg_L': [(v.index, wv) for v, wv in leg_L_entries],
        '__leg_R': [(v.index, wv) for v, wv in leg_R_entries],
    }

    def trouser_color(x, y, z, nx, ny, nz):
        crotch_ao = bell(x / 0.044) * bell((y - 0.83) / 0.075) * 0.20
        inner_thigh = smoothstep(0.072, 0.010, abs(x)) * smoothstep(0.48, 0.82, y) * 0.13
        knee_fade = 0.055 * bell((y - KNEE_Y) / 0.085) * smoothstep(0.2, 0.9, nz)
        back_knee = 0.095 * bell((y - KNEE_Y) / 0.045) * smoothstep(0.2, 0.9, -nz)
        back_pocket = 0.075 * bell((abs(x) - 0.078) / 0.036) * bell((y - 0.925) / 0.032) * smoothstep(0.35, 0.85, -nz)
        outseam = 0.055 * bell(nz / 0.22) * smoothstep(0.14, 0.88, y) * smoothstep(0.06, 0.12, abs(x))
        hem_ao = smoothstep(0.18, 0.13, y) * 0.10
        ao = 0.96 - crotch_ao - inner_thigh - back_knee - back_pocket - outseam - hem_ao + knee_fade
        return (ao, ao, ao)

    trouser_obj = create_part_object(
        'Trousers', bm, KIND_DENIM, SLOT_BOTTOM,
        color_func=trouser_color, subsurf=2, skin_tag='lower_body',
        pre_vgroups=pre_vg
    )
    tm = trouser_obj.data
    for v in tm.vertices:
        x, y, z = from_pt(v.co)
        nx, ny, nz = from_pt(v.normal)
        fold = 0.0022 * math.sin((y - KNEE_Y) * 52.0 + z * 24.0) * bell((y - KNEE_Y) / 0.065)
        fold += 0.0024 * math.sin((y - 0.165) * 65.0) * bell((y - 0.175) / 0.045)
        if abs(fold) > 1e-5:
            v.co = pt(x + nx * fold, y + ny * fold, z + nz * fold)
    tm.update()
    objs.append(trouser_obj)

    if cfg['coat_kind'] == 'cropped_jacket':
        b_rings = []
        belt_y = 0.986
        belt_rx = lerp(w_w, h_w, 0.65) + 0.005
        for dy_b in (-0.012, 0.012):
            b_rings.append([(belt_rx * soft_pow(math.cos(j * math.pi * 2 / 20), 0.88),
                             belt_y + dy_b, -0.003 + 0.114 * soft_pow(math.sin(j * math.pi * 2 / 20), 0.88))
                            for j in range(20)])
        bm_wb = loft_rings_bmesh(b_rings, cap_start=False, cap_end=False)
        objs.append(create_part_object(
            'WaistBelt', bm_wb, KIND_LEATHER, SLOT_FIXED,
            base_rgb=hex_to_linear('#2e2520'), skin_tag='pelvis'
        ))
        bm_wbk = bmesh.new()
        bmesh.ops.create_cube(bm_wbk, size=1.0, matrix=Matrix.Translation(pt(0.0, belt_y, 0.114)) @ Matrix.Diagonal((0.028, 0.008, 0.026, 1.0)))
        objs.append(create_part_object(
            'WaistBuckle', bm_wbk, KIND_METAL, SLOT_FIXED,
            base_rgb=(0.64, 0.60, 0.52), skin_tag='pelvis'
        ))

    return objs


# =============================================================================
# 5. REALISTIC 5-FINGER SCULPTED HANDS + WRISTS
# =============================================================================
def build_hands(cfg):
    objs = []
    female = cfg['female']
    wrist_x = cfg['wrist_x']
    wrist_z = cfg['wrist_z']
    arm_y = cfg['arm_y']
    elbow_y = arm_y - UPPER_ARM_LEN
    wrist_y = elbow_y - 0.232
    hs = 0.85 if female else 1.0

    for side in (-1, 1):
        cx = side * wrist_x
        cz = wrist_z
        tag = 'elbow_L' if side == 1 else 'elbow_R'

        palm_rows = [
            (wrist_y + 0.025, 0.026 * hs, 0.023 * hs,  0.000,  0.000),
            (wrist_y + 0.000, 0.024 * hs, 0.021 * hs,  0.000,  0.001),
            (wrist_y - 0.020, 0.021 * hs, 0.030 * hs, -0.001,  0.003),
            (wrist_y - 0.046, 0.020 * hs, 0.038 * hs, -0.003,  0.005),
            (wrist_y - 0.068, 0.018 * hs, 0.039 * hs, -0.006,  0.006),
            (wrist_y - 0.078, 0.015 * hs, 0.036 * hs, -0.008,  0.006),
        ]
        p_rings = []
        for py, pxr, pzr, x_shift, z_shift in palm_rows:
            ring = []
            for k in range(14):
                a = k * math.pi * 2.0 / 14.0
                ca, sa = math.cos(a), math.sin(a)
                ring.append((cx + side * x_shift + pxr * soft_pow(ca, 0.85),
                             py, cz + z_shift + pzr * soft_pow(sa, 0.78)))
            p_rings.append(ring)
        bm_palm = loft_rings_bmesh(p_rings, cap_start=True, cap_end=True)
        def hand_col(x, y, z, nx, ny, nz, _side=side):
            inner_palm = smoothstep(-0.2, 0.8, -_side * nx) * 0.10
            knuckle = bell((y - (wrist_y - 0.072)) / 0.012) * smoothstep(0.1, 0.8, _side * nx) * 0.05
            s = 0.97 - inner_palm + knuckle
            return (s, s * 0.97, s * 0.95)
        objs.append(create_part_object(
            f'Palm_{side}', bm_palm, KIND_SKIN, SLOT_SKIN,
            color_func=hand_col,
            subsurf=1, skin_tag=tag
        ))

        # Naturally relaxed, gently curled fingers (avoids stiff pointy spikes)
        finger_defs = [
            ( 0.025 * hs, 0.056 * hs, 0.0084 * hs, 0.022,  0.002),
            ( 0.008 * hs, 0.061 * hs, 0.0088 * hs, 0.026,  0.001),
            (-0.008 * hs, 0.057 * hs, 0.0084 * hs, 0.029, -0.001),
            (-0.023 * hs, 0.046 * hs, 0.0074 * hs, 0.031, -0.002),
        ]
        for fi, (fz, flen, frad, curl, splay) in enumerate(finger_defs):
            pts, rxs, rys = [], [], []
            for k in range(6):
                u = k / 5.0
                fx = cx + side * (-0.007 - curl * (u ** 1.65))
                fy = wrist_y - 0.072 - flen * math.sin(u * math.pi * 0.44) / math.sin(math.pi * 0.44)
                fzz = cz + 0.006 + fz + splay * u + 0.005 * (u ** 1.6)
                pts.append((fx, fy, fzz))
                taper = 1.0 - 0.28 * (u ** 1.5)
                rxs.append(frad * taper)
                rys.append(frad * taper * 0.94)
            bm_f = ribbon_tube_bmesh(pts, rxs, rys, sides=6, cap=True)
            objs.append(create_part_object(
                f'Finger_{side}_{fi}', bm_f, KIND_SKIN, SLOT_SKIN,
                color_func=lambda x, y, z, nx, ny, nz, _wy=wrist_y: (0.89 + 0.09 * smoothstep(_wy - 0.068, _wy - 0.130, y), 0.86 + 0.07 * smoothstep(_wy - 0.068, _wy - 0.130, y), 0.84 + 0.06 * smoothstep(_wy - 0.068, _wy - 0.130, y)),
                skin_tag=tag
            ))

        t_pts, trx, try_ = [], [], []
        for k in range(6):
            u = k / 5.0
            tx = cx + side * (-0.014 - 0.014 * u + 0.004 * u * u)
            ty = wrist_y - 0.034 - 0.044 * u
            tz = cz + 0.022 + 0.026 * u
            t_pts.append((tx, ty, tz))
            tr = (0.0104 * hs) * (1.0 - 0.30 * u * u)
            trx.append(tr)
            try_.append(tr * 0.92)
        bm_th = ribbon_tube_bmesh(t_pts, trx, try_, sides=6, cap=True)
        objs.append(create_part_object(
            f'Thumb_{side}', bm_th, KIND_SKIN, SLOT_SKIN,
            base_rgb=(0.95, 0.93, 0.91), skin_tag=tag
        ))

    return objs


# =============================================================================
# 6. REALISTIC MULTI-PART FOOTWEAR (SOLE FLUSH AT Y=0.000!)
# =============================================================================
def build_shoes(cfg):
    objs = []
    female = cfg['female']
    hip_x = cfg['hip_x']
    shoe_kind = cfg['shoe_kind']
    sh_w = 0.88 if female else 1.0
    sh_l = 0.90 if female else 1.0

    # Bind-pose boot bone is at y = BOOT_Y (0.075); sole bottom at BOOT_Y - 0.075 = 0.000!
    for side in (-1, 1):
        cx = side * hip_x
        tag = 'boot_L' if side == 1 else 'boot_R'

        sock_rings = []
        for sy in (BOOT_Y + 0.015, BOOT_Y + 0.095):
            sock_rings.append([(cx + 0.038 * sh_w * math.cos(k * math.pi * 2 / 12), sy, 0.040 * sh_w * math.sin(k * math.pi * 2 / 12)) for k in range(12)])
        bm_sock = loft_rings_bmesh(sock_rings, cap_start=False, cap_end=True)
        objs.append(create_part_object(
            f'AnkleSock_{side}', bm_sock, KIND_DENIM, SLOT_INNER,
            base_rgb=(0.45, 0.46, 0.48) if shoe_kind != 'boot' else (0.18, 0.16, 0.15),
            skin_tag=tag
        ))

        top_collar = 0.078 if shoe_kind == 'boot' else 0.052
        last_rows = [
            (-0.075, 0.047 * sh_w, 0.118 * sh_l, 0.046 * sh_l),
            (-0.065, 0.052 * sh_w, 0.128 * sh_l, 0.048 * sh_l),
            (-0.050, 0.053 * sh_w, 0.130 * sh_l, 0.048 * sh_l),
            (-0.032, 0.051 * sh_w, 0.125 * sh_l, 0.046 * sh_l),
            (-0.012, 0.048 * sh_w, 0.114 * sh_l, 0.040 * sh_l),
            ( 0.010, 0.045 * sh_w, 0.091 * sh_l, 0.025 * sh_l),
            ( 0.030, 0.043 * sh_w, 0.068 * sh_l, 0.012 * sh_l),
            ( top_collar, 0.041 * sh_w, 0.051 * sh_l, 0.002 * sh_l),
        ]

        def last_ring(dy, raise_r=0.0, facets=20):
            _, rx, rz, zc = sample_rows(last_rows, dy)
            ring = []
            for k in range(facets):
                a = k * math.pi * 2.0 / facets
                ca, sa = math.cos(a), math.sin(a)
                arch = 0.14 * bell((sa + 0.12) / 0.38) * max(0.0, -side * ca)
                toe_taper = 0.14 * (max(0.0, sa) ** 2)
                vx = cx + 0.003 * side * max(0.0, sa) + ((rx * (1.0 - arch - toe_taper)) + raise_r) * soft_pow(ca, 0.80)
                vz = zc + (rz + raise_r) * soft_pow(sa, 0.84)
                ring.append((vx, BOOT_Y + dy, vz))
            return ring

        bm_out = loft_rings_bmesh([last_ring(d, 0.0018) for d in (-0.075, -0.069, -0.061)], cap_start=True, cap_end=True)
        objs.append(create_part_object(
            f'Outsole_{side}', bm_out, KIND_RUBBER, SLOT_FIXED,
            base_rgb=hex_to_linear('#202426'), skin_tag=tag
        ))

        mid_col = hex_to_linear('#dbd7ce') if shoe_kind == 'sneaker' else hex_to_linear('#262220')
        bm_mid = loft_rings_bmesh([last_ring(d, 0.0022) for d in (-0.061, -0.051, -0.042)], cap_start=True, cap_end=True)
        objs.append(create_part_object(
            f'Midsole_{side}', bm_mid, KIND_RUBBER, SLOT_FIXED,
            base_rgb=mid_col, skin_tag=tag
        ))

        up_dys = [-0.044, -0.032, -0.018, -0.004, 0.012, 0.028, 0.044, top_collar]
        bm_up = loft_rings_bmesh([last_ring(d, 0.0) for d in up_dys], cap_start=True, cap_end=True)
        objs.append(create_part_object(
            f'ShoeUpper_{side}', bm_up, KIND_LEATHER, SLOT_SHOE,
            color_func=lambda x, y, z, nx, ny, nz: (0.94 + 0.06 * max(0.0, ny),) * 3,
            subsurf=1, skin_tag=tag
        ))

        if shoe_kind in ('sneaker', 'derby'):
            lace_col = hex_to_linear('#dcd8cf') if shoe_kind == 'sneaker' else hex_to_linear('#2b2623')
            for li in range(4):
                u = li / 3.0
                lz = lerp(0.062, 0.105, u) * sh_l
                ly = BOOT_Y + lerp(0.035, 0.007, u)
                lw = 0.022 * sh_w
                pts = [(cx - lw, ly - 0.003, lz), (cx, ly + 0.004, lz + 0.004), (cx + lw, ly - 0.003, lz)]
                bm_lc = ribbon_tube_bmesh(pts, [0.0026] * 3, [0.0020] * 3, sides=4, cap=True)
                objs.append(create_part_object(
                    f'Lace_{side}_{li}', bm_lc, KIND_CLOTH, SLOT_FIXED, base_rgb=lace_col, skin_tag=tag
                ))

    return objs


# =============================================================================
# 7. HERO ACCESSORIES (MESSENGER BAG, CROSSBODY PURSE, WRISTWATCH)
# =============================================================================
def build_accessories(cfg):
    objs = []
    acc = cfg.get('accessory', 'none')
    wrist_x = cfg['wrist_x']
    wrist_z = cfg['wrist_z']
    arm_y = cfg['arm_y']

    if acc == 'messenger':
        bag_cx, bag_cy, bag_cz = 0.044, 1.095, -0.166
        b_rows = [
            (-0.102, 0.110, 0.033),
            (-0.085, 0.138, 0.041),
            (-0.052, 0.148, 0.047),
            ( 0.000, 0.150, 0.050),
            ( 0.056, 0.146, 0.046),
            ( 0.092, 0.132, 0.038),
            ( 0.108, 0.102, 0.027),
        ]
        b_rings = []
        for dy, bw, bd in b_rows:
            ring = []
            for k in range(22):
                a = k * math.pi * 2.0 / 22.0
                ca, sa = math.cos(a), math.sin(a)
                lx = bw * soft_pow(ca, 0.56)
                lz = bd * soft_pow(sa, 0.65)
                ring.append((bag_cx + lx, bag_cy + dy - 0.12 * lx, bag_cz + lz))
            b_rings.append(ring)
        bm_bag = loft_rings_bmesh(b_rings, cap_start=True, cap_end=True)
        objs.append(create_part_object(
            'MessengerPouch', bm_bag, KIND_LEATHER, SLOT_ACCENT,
            base_rgb=hex_to_linear('#9b6944'),
            color_func=lambda x, y, z, nx, ny, nz: (0.94 + 0.06 * ny,) * 3,
            subsurf=1, skin_tag='bag'
        ))
        flap_rings = []
        for dy, bw in ((0.000, 0.142), (0.040, 0.149), (0.082, 0.145), (0.112, 0.118)):
            ring = []
            for k in range(16):
                a = k * math.pi * 2.0 / 16.0
                ca, sa = math.cos(a), math.sin(a)
                lx = bw * soft_pow(ca, 0.52)
                lz = (0.012 if sa > 0 else 0.056) * soft_pow(sa, 0.65)
                ring.append((bag_cx + lx, bag_cy + dy - 0.12 * lx, bag_cz - 0.008 + lz))
            flap_rings.append(ring)
        bm_fl = loft_rings_bmesh(flap_rings, cap_start=True, cap_end=True)
        objs.append(create_part_object(
            'MessengerFlap', bm_fl, KIND_LEATHER, SLOT_FIXED,
            base_rgb=hex_to_linear('#b17c52'), subsurf=1, skin_tag='bag'
        ))
        for sx in (-0.066, 0.066):
            bm_t = bmesh.new()
            ty = bag_cy - 0.010 - 0.12 * sx
            bmesh.ops.create_cube(bm_t, size=1.0, matrix=Matrix.Translation(pt(bag_cx + sx, ty, bag_cz - 0.058)) @ Matrix.Diagonal((0.022, 0.008, 0.086, 1.0)))
            objs.append(create_part_object(
                f'BagTab_{sx}', bm_t, KIND_LEATHER, SLOT_FIXED, base_rgb=hex_to_linear('#573f2d'), skin_tag='bag'
            ))
            bm_bc = bmesh.new()
            bmesh.ops.create_cube(bm_bc, size=1.0, matrix=Matrix.Translation(pt(bag_cx + sx, ty - 0.012, bag_cz - 0.062)) @ Matrix.Diagonal((0.026, 0.007, 0.022, 1.0)))
            objs.append(create_part_object(
                f'BagBuckle_{sx}', bm_bc, KIND_METAL, SLOT_FIXED, base_rgb=(0.76, 0.64, 0.36), skin_tag='bag'
            ))

        # Exact post-subsurf mesh-projected leather strap (0 floating, 0 clipping anywhere!)
        upper_obj = cfg.get('_upper_obj')
        def snap_to_garment(px, py, pz, lift):
            hit, loc, nrm, _ = upper_obj.closest_point_on_mesh(pt(px, py, pz))
            if hit:
                p_out = loc + nrm.normalized() * lift
                return from_pt(p_out)
            return (px, py, pz)
        raw_strap = [
            ( 0.165, 1.12, -0.145, 0.010), ( 0.180, 1.10, -0.080, 0.008), ( 0.182, 1.09,  0.000, 0.007),
            ( 0.162, 1.11,  0.080, 0.006), ( 0.122, 1.17,  0.132, 0.006), ( 0.072, 1.23,  0.155, 0.007),
            ( 0.020, 1.29,  0.160, 0.008), (-0.032, 1.35,  0.150, 0.006), (-0.074, 1.41,  0.125, 0.005),
            (-0.098, 1.455, 0.080, 0.0045), (-0.104, 1.482, 0.035, 0.0045), (-0.105, 1.490, -0.002, 0.0045),
            (-0.102, 1.478, -0.042, 0.0045), (-0.092, 1.445, -0.085, 0.005), (-0.062, 1.39, -0.128, 0.006),
            (-0.010, 1.32, -0.145, 0.006), ( 0.048, 1.25, -0.148, 0.007), ( 0.108, 1.18, -0.150, 0.009),
            ( 0.165, 1.12, -0.145, 0.010),
        ]
        strap_pts = [snap_to_garment(rx, ry, rz, lf) for (rx, ry, rz, lf) in raw_strap]
        # One light Chaikin-like midpoint pass re-projected onto mesh for silky-smooth shoulder curve
        smooth_pts = []
        for idx_s in range(len(strap_pts) - 1):
            a_p, b_p = strap_pts[idx_s], strap_pts[idx_s + 1]
            lf_m = 0.5 * (raw_strap[idx_s][3] + raw_strap[idx_s + 1][3])
            smooth_pts.append(a_p)
            smooth_pts.append(snap_to_garment(0.5 * (a_p[0] + b_p[0]), 0.5 * (a_p[1] + b_p[1]), 0.5 * (a_p[2] + b_p[2]), lf_m))
        smooth_pts.append(strap_pts[-1])
        bm_st = ribbon_tube_bmesh(smooth_pts, [0.0180] * len(smooth_pts), [0.0042] * len(smooth_pts), sides=6, cap=False, ref_point=(0.0, 1.24, 0.0))
        objs.append(create_part_object(
            'MessengerStrap', bm_st, KIND_LEATHER, SLOT_FIXED,
            base_rgb=hex_to_linear('#4f4235'), skin_tag='upper_torso'
        ))

        # Minimalist wristwatch on left wrist (+X)
        wy = arm_y - UPPER_ARM_LEN - 0.232
        w_rings = []
        for dy_w in (-0.008, 0.008):
            w_rings.append([(wrist_x + 0.028 * math.cos(k * math.pi * 2 / 14), wy + dy_w,
                             wrist_z + 0.026 * math.sin(k * math.pi * 2 / 14)) for k in range(14)])
        bm_wt = loft_rings_bmesh(w_rings, cap_start=False, cap_end=False)
        objs.append(create_part_object(
            'WatchBand', bm_wt, KIND_LEATHER, SLOT_FIXED, base_rgb=hex_to_linear('#2c241f'), skin_tag='elbow_L'
        ))
        bm_dial = bmesh.new()
        bmesh.ops.create_cone(bm_dial, cap_ends=True, segments=14, radius1=0.013, radius2=0.013, depth=0.006,
                              matrix=Matrix.Translation(pt(wrist_x + 0.029, wy, wrist_z + 0.002)) @ Euler((0, math.pi * 0.5, 0)).to_matrix().to_4x4())
        objs.append(create_part_object(
            'WatchDial', bm_dial, KIND_METAL, SLOT_FIXED, base_rgb=(0.72, 0.74, 0.76), skin_tag='elbow_L'
        ))

    elif acc == 'crossbody_purse':
        # Sleek structured leather crossbody bag tucked behind right/left hip, strap sitting cleanly outside jacket!
        bx, by, bz = 0.132, 0.995, -0.098
        bm_p = bmesh.new()
        bmesh.ops.create_cube(bm_p, size=1.0, matrix=Matrix.Translation(pt(bx, by, bz)) @ Matrix.Diagonal((0.056, 0.130, 0.148, 1.0)))
        bmesh.ops.bevel(bm_p, geom=list(bm_p.edges), offset=0.013, segments=2, affect='EDGES', clamp_overlap=True)
        objs.append(create_part_object(
            'CrossbodyPurse', bm_p, KIND_LEATHER, SLOT_ACCENT,
            base_rgb=hex_to_linear('#6b4836'), skin_tag='bag'
        ))
        # Exact post-subsurf mesh-projected crossbody strap hugging female bust & trapezius seamlessly!
        upper_obj = cfg.get('_upper_obj')
        def snap_w(px, py, pz, lift):
            hit, loc, nrm, _ = upper_obj.closest_point_on_mesh(pt(px, py, pz))
            if hit:
                return from_pt(loc + nrm.normalized() * lift)
            return (px, py, pz)
        raw_w = [
            ( 0.142, 1.06, -0.045, 0.007), ( 0.142, 1.09,  0.035, 0.006), ( 0.114, 1.15,  0.102, 0.006),
            ( 0.068, 1.22,  0.144, 0.006), ( 0.016, 1.28,  0.148, 0.006), (-0.034, 1.35,  0.132, 0.0055),
            (-0.072, 1.41,  0.095, 0.005), (-0.092, 1.448, 0.040, 0.0045), (-0.094, 1.458, -0.002, 0.0045),
            (-0.090, 1.446, -0.046, 0.0045), (-0.068, 1.40, -0.095, 0.005), (-0.024, 1.33, -0.128, 0.0055),
            ( 0.036, 1.24, -0.132, 0.006), ( 0.092, 1.14, -0.125, 0.007),
        ]
        snapped_w = [snap_w(rx, ry, rz, lf) for (rx, ry, rz, lf) in raw_w]
        s_pts = [(bx, by + 0.065, bz)]
        for idx_s in range(len(snapped_w) - 1):
            a_p, b_p = snapped_w[idx_s], snapped_w[idx_s + 1]
            lf_m = 0.5 * (raw_w[idx_s][3] + raw_w[idx_s + 1][3])
            s_pts.append(a_p)
            s_pts.append(snap_w(0.5 * (a_p[0] + b_p[0]), 0.5 * (a_p[1] + b_p[1]), 0.5 * (a_p[2] + b_p[2]), lf_m))
        s_pts.append(snapped_w[-1])
        s_pts.append((bx, by + 0.065, bz))
        bm_ps = ribbon_tube_bmesh(s_pts, [0.0085] * len(s_pts), [0.0038] * len(s_pts), sides=6, cap=False, ref_point=(0.0, 1.22, 0.0))
        objs.append(create_part_object(
            'PurseStrap', bm_ps, KIND_LEATHER, SLOT_FIXED,
            base_rgb=hex_to_linear('#4a3225'), skin_tag='upper_torso'
        ))

    return objs


# =============================================================================
# 8. ARMATURE & TOPOLOGY-AWARE 4-BONE SMOOTH SKIN WEIGHTS
# =============================================================================
def create_armature(cfg):
    arm_x = cfg['arm_x']
    arm_y = cfg['arm_y']
    arm_z = cfg['arm_z']
    hip_x = cfg['hip_x']
    hy = cfg['head_y']
    hz = cfg['head_z']

    arm_data = bpy.data.armatures.new('CharRig')
    arm_obj = bpy.data.objects.new('CharRig', arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    joints = {
        'upper':   ((0.0, HIP_Y, 0.0), None),
        'chest':   ((0.0, HIP_Y, 0.0), 'upper'),
        'head':    ((0.0, hy, hz), 'chest'),
        'hip_L':   (( hip_x, HIP_Y, 0.0), None),
        'knee_L':  (( hip_x, KNEE_Y, 0.0), 'hip_L'),
        'boot_L':  (( hip_x, BOOT_Y, 0.0), 'knee_L'),
        'arm_L':   (( arm_x, arm_y, arm_z), 'chest'),
        'elbow_L': (( arm_x, arm_y - UPPER_ARM_LEN, arm_z), 'arm_L'),
        'hip_R':   ((-hip_x, HIP_Y, 0.0), None),
        'knee_R':  ((-hip_x, KNEE_Y, 0.0), 'hip_R'),
        'boot_R':  ((-hip_x, BOOT_Y, 0.0), 'knee_R'),
        'arm_R':   ((-arm_x, arm_y, arm_z), 'chest'),
        'elbow_R': ((-arm_x, arm_y - UPPER_ARM_LEN, arm_z), 'arm_R'),
    }

    ebones = {}
    for bname in BONE_ORDER:
        pos, parent_name = joints[bname]
        eb = arm_data.edit_bones.new(bname)
        h = pt(*pos)
        eb.head = h
        eb.tail = h + Vector((0.0, 0.0, 0.08))
        if parent_name is not None:
            eb.parent = ebones[parent_name]
        ebones[bname] = eb

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj


def compute_vertex_weights(x, y, z, skin_tag, cfg, aux_w):
    arm_y = cfg['arm_y']
    elbow_y = arm_y - UPPER_ARM_LEN
    hy = cfg['head_y']
    w = {}

    if skin_tag == 'head':
        return {'head': 1.0}

    if skin_tag == 'head_neck':
        t = smoothstep(hy - 0.055, hy + 0.025, y)
        return {'head': t, 'chest': 1.0 - t}

    if skin_tag == 'hair_long':
        t = smoothstep(hy - 0.080, hy + 0.030, y)
        hw = lerp(0.76, 1.0, t)
        return {'head': hw, 'chest': 1.0 - hw}

    if skin_tag in ('elbow_L', 'elbow_R', 'boot_L', 'boot_R'):
        return {skin_tag: 1.0}

    if skin_tag == 'pelvis':
        t = smoothstep(0.97, 1.10, y)
        return {'upper': 1.0 - t, 'chest': t}

    if skin_tag == 'bag':
        return {'chest': 0.78, 'upper': 0.22}

    if skin_tag == 'upper_torso':
        chest_t = smoothstep(0.95, 1.14, y)
        return {'chest': chest_t, 'upper': 1.0 - chest_t}

    if skin_tag == 'upper_body':
        # Exact topology-interpolated sleeve masks guarantee flared coat skirts NEVER get arm weights!
        sl_L = aux_w.get('__sleeve_L', 0.0)
        sl_R = aux_w.get('__sleeve_R', 0.0)
        elb_t = smoothstep(elbow_y + 0.062, elbow_y - 0.062, y)
        arm_total = clamp(sl_L + sl_R, 0.0, 1.0)
        if sl_L > 1e-4:
            w['arm_L'] = sl_L * (1.0 - elb_t)
            w['elbow_L'] = sl_L * elb_t
        if sl_R > 1e-4:
            w['arm_R'] = sl_R * (1.0 - elb_t)
            w['elbow_R'] = sl_R * elb_t
        rem = max(0.0, 1.0 - arm_total)
        if rem > 1e-4:
            if cfg['coat_kind'] in ('overcoat', 'trench') and y < 0.96:
                leg_t = smoothstep(0.96, 0.72, y) * 0.58
                lr_t = smoothstep(-0.045, 0.045, x)
                w_hl = rem * leg_t * lr_t
                w_hr = rem * leg_t * (1.0 - lr_t)
                w_up = rem * (1.0 - leg_t)
                if w_up > 1e-4: w['upper'] = w_up
                if w_hl > 1e-4: w['hip_L'] = w_hl
                if w_hr > 1e-4: w['hip_R'] = w_hr
            else:
                chest_t = smoothstep(0.95, 1.14, y)
                if rem * chest_t > 1e-4: w['chest'] = rem * chest_t
                if rem * (1.0 - chest_t) > 1e-4: w['upper'] = rem * (1.0 - chest_t)
        return w

    if skin_tag == 'lower_body':
        pelvis_t = smoothstep(0.81, 0.985, y)
        waist_chest = smoothstep(1.00, 1.08, y) * 0.35
        w_up = pelvis_t * (1.0 - waist_chest)
        w_ch = pelvis_t * waist_chest
        leg_rem = 1.0 - pelvis_t
        if w_up > 1e-4: w['upper'] = w_up
        if w_ch > 1e-4: w['chest'] = w_ch
        if leg_rem > 1e-4:
            lg_L = aux_w.get('__leg_L', 0.0)
            lg_R = aux_w.get('__leg_R', 0.0)
            s_lr = lg_L + lg_R
            if s_lr > 1e-4:
                l_frac = lg_L / s_lr
                r_frac = lg_R / s_lr
            else:
                sep_w = lerp(0.008, 0.040, smoothstep(0.78, 0.94, y))
                l_frac = smoothstep(-sep_w, sep_w, x)
                r_frac = 1.0 - l_frac
            knee_t = smoothstep(KNEE_Y + 0.085, KNEE_Y - 0.085, y)
            boot_t = smoothstep(0.185, 0.115, y) * 0.35
            for frac, h_name, k_name, b_name in (
                (l_frac, 'hip_L', 'knee_L', 'boot_L'),
                (r_frac, 'hip_R', 'knee_R', 'boot_R'),
            ):
                if frac <= 1e-4:
                    continue
                m = leg_rem * frac
                wh = m * (1.0 - knee_t)
                wk = m * knee_t * (1.0 - boot_t)
                wb = m * knee_t * boot_t
                if wh > 1e-4: w[h_name] = wh
                if wk > 1e-4: w[k_name] = wk
                if wb > 1e-4: w[b_name] = wb
        return w

    return {'chest': 1.0}


def assign_skin_weights(obj, cfg):
    skin_tag = obj.get('skin_tag', 'upper_body')
    aux_names = ['__sleeve_L', '__sleeve_R', '__leg_L', '__leg_R']
    aux_vgs = {n: obj.vertex_groups.get(n) for n in aux_names if obj.vertex_groups.get(n) is not None}
    aux_idx_to_name = {vg.index: n for n, vg in aux_vgs.items()}

    vgroups = {}
    for bname in BONE_ORDER:
        vgroups[bname] = obj.vertex_groups.new(name=bname)

    for v in obj.data.vertices:
        x, y, z = from_pt(v.co)
        aux_w = {}
        if aux_idx_to_name:
            for g in v.groups:
                aname = aux_idx_to_name.get(g.group)
                if aname is not None:
                    aux_w[aname] = g.weight
        weights = compute_vertex_weights(x, y, z, skin_tag, cfg, aux_w)
        items = sorted([(k, val) for k, val in weights.items() if val > 1e-4], key=lambda p: -p[1])[:4]
        total = sum(val for _, val in items)
        if total <= 1e-6:
            items = [('chest', 1.0)]
            total = 1.0
        for bname, val in items:
            vgroups[bname].add([v.index], val / total, 'REPLACE')

    for vg in aux_vgs.values():
        obj.vertex_groups.remove(vg)


# =============================================================================
# 9. BUILD & EXPORT ALL 5 CHARACTER ARCHETYPES
# =============================================================================
ARCHETYPES = [
    {
        'filename': 'char-player.glb',
        'female': False,
        'head_y': 1.530, 'head_z': 0.006,
        'arm_x': 0.198, 'arm_y': 1.448, 'arm_z': 0.000,
        'wrist_x': 0.222, 'wrist_z': 0.012,
        'hip_x': 0.095,
        'hair_style': 'player_layered',
        'coat_kind': 'field_jacket',
        'shoe_kind': 'sneaker',
        'accessory': 'messenger',
    },
    {
        'filename': 'char-man-casual.glb',
        'female': False,
        'head_y': 1.530, 'head_z': 0.006,
        'arm_x': 0.198, 'arm_y': 1.448, 'arm_z': 0.000,
        'wrist_x': 0.222, 'wrist_z': 0.012,
        'hip_x': 0.095,
        'hair_style': 'man_crop',
        'coat_kind': 'bomber',
        'shoe_kind': 'sneaker',
        'accessory': 'none',
    },
    {
        'filename': 'char-man-coat.glb',
        'female': False,
        'head_y': 1.532, 'head_z': 0.006,
        'arm_x': 0.202, 'arm_y': 1.450, 'arm_z': 0.000,
        'wrist_x': 0.226, 'wrist_z': 0.012,
        'hip_x': 0.095,
        'hair_style': 'man_part',
        'coat_kind': 'overcoat',
        'shoe_kind': 'derby',
        'accessory': 'none',
    },
    {
        'filename': 'char-woman-casual.glb',
        'female': True,
        'head_y': 1.502, 'head_z': 0.006,
        'arm_x': 0.172, 'arm_y': 1.422, 'arm_z': 0.000,
        'wrist_x': 0.200, 'wrist_z': 0.012,
        'hip_x': 0.092,
        'hair_style': 'woman_bob',
        'coat_kind': 'cropped_jacket',
        'shoe_kind': 'sneaker',
        'accessory': 'crossbody_purse',
    },
    {
        'filename': 'char-woman-coat.glb',
        'female': True,
        'head_y': 1.504, 'head_z': 0.006,
        'arm_x': 0.176, 'arm_y': 1.424, 'arm_z': 0.000,
        'wrist_x': 0.204, 'wrist_z': 0.012,
        'hip_x': 0.092,
        'hair_style': 'woman_ponytail',
        'coat_kind': 'trench',
        'shoe_kind': 'boot',
        'accessory': 'none',
    },
]


def build_archetype(cfg):
    clear_scene()
    mat = make_base_material()
    arm_obj = create_armature(cfg)

    parts = []
    parts.extend(build_head_and_face(cfg))
    parts.extend(build_hair(cfg))
    parts.extend(build_welded_upper_garment(cfg))
    parts.extend(build_welded_trousers(cfg))
    parts.extend(build_hands(cfg))
    parts.extend(build_shoes(cfg))
    parts.extend(build_accessories(cfg))

    for obj in parts:
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat
        assign_skin_weights(obj, cfg)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    char_obj = bpy.context.view_layer.objects.active
    char_obj.name = 'CharacterMesh'
    char_obj.parent = arm_obj
    mod = char_obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm_obj

    mesh = char_obj.data
    if len(mesh.polygons):
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.update()

    out_path = os.path.join(MODEL_DIR, cfg['filename'])
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_yup=True,
        export_skins=True,
        export_all_vertex_colors=True,
        export_attributes=True,
        export_normals=True,
        export_texcoords=True,
        export_materials='EXPORT',
    )
    kb = os.path.getsize(out_path) / 1024.0
    ys = [from_pt(v.co)[1] for v in mesh.vertices]
    print(f"EXPORTED {cfg['filename']}: {kb:.1f} KB | verts={len(mesh.vertices)} polys={len(mesh.polygons)} Y=[{min(ys):.3f}..{max(ys):.3f}]")


if __name__ == '__main__':
    for arch in ARCHETYPES:
        build_archetype(arch)
    print('ALL_CHARACTERS_COMPLETE')
