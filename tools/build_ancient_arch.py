import bpy
import bmesh
import math
import os
import numpy as np
from mathutils import Vector, Matrix, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MODEL_DIR = os.path.join(ROOT, 'assets', 'models')
os.makedirs(MODEL_DIR, exist_ok=True)


def pt(x, y, z):
    # Three.js (X, Y-up, Z) -> Blender (X, -Z, Y)
    return Vector((x, -z, y))


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def make_mat(name, base_color=(0.8, 0.8, 0.8, 1.0), metallic=0.0, roughness=0.5,
             emissive=(0.0, 0.0, 0.0), emissive_strength=0.0, coat=0.0, coat_rough=0.1):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base_color[:3], 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Emission Color' in bsdf.inputs and emissive_strength > 0.0:
        bsdf.inputs['Emission Color'].default_value = (*emissive, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emissive_strength
    if 'Coat Weight' in bsdf.inputs and coat > 0.0:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = coat_rough
    return mat


def link_bm(name, bm, mat, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth and len(mesh.polygons):
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
        mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def export_glb(filename):
    path = os.path.join(MODEL_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_materials='EXPORT',
        export_normals=True,
        export_texcoords=False,
    )
    print(f'EXPORTED {filename}: {os.path.getsize(path) / 1024:.1f} KB')


def add_box(bm, center, size, rot_y=0.0, rot_x=0.0, rot_z=0.0, bevel=0.0):
    sx, sy, sz = size
    mat = Matrix.Translation(pt(*center))
    if rot_y or rot_x or rot_z:
        # Convert Three.js Y-up rotations to Blender Z-up
        mat = mat @ Euler((rot_x, -rot_z, rot_y), 'XYZ').to_matrix().to_4x4()
    mat = mat @ Matrix.Diagonal((sx, sz, sy, 1.0))
    ret = bmesh.ops.create_cube(bm, size=1.0, matrix=mat)
    if bevel > 0.0:
        verts = ret['verts']
        edges = [e for e in bm.edges if e.verts[0] in verts and e.verts[1] in verts]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect='EDGES', clamp_overlap=True)


def add_cyl(bm, center, r_bot, r_top, height, segs=12, rot_x=0.0, rot_z=0.0):
    mat = Matrix.Translation(pt(*center))
    if rot_x or rot_z:
        mat = mat @ Euler((rot_x, -rot_z, 0.0), 'XYZ').to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r_bot, radius2=r_top, depth=height, matrix=mat)


def add_tapered_box(bm, center, bot_size, top_size, height):
    cx, cy, cz = center
    bx, bz = bot_size[0] * 0.5, bot_size[1] * 0.5
    tx, tz = top_size[0] * 0.5, top_size[1] * 0.5
    y0, y1 = cy - height * 0.5, cy + height * 0.5
    v = [
        bm.verts.new(pt(cx - bx, y0, cz - bz)),
        bm.verts.new(pt(cx + bx, y0, cz - bz)),
        bm.verts.new(pt(cx + bx, y0, cz + bz)),
        bm.verts.new(pt(cx - bx, y0, cz + bz)),
        bm.verts.new(pt(cx - tx, y1, cz - tz)),
        bm.verts.new(pt(cx + tx, y1, cz - tz)),
        bm.verts.new(pt(cx + tx, y1, cz + tz)),
        bm.verts.new(pt(cx - tx, y1, cz + tz)),
    ]
    bm.faces.new((v[0], v[3], v[2], v[1]))
    bm.faces.new((v[4], v[5], v[6], v[7]))
    bm.faces.new((v[0], v[1], v[5], v[4]))
    bm.faces.new((v[1], v[2], v[6], v[5]))
    bm.faces.new((v[2], v[3], v[7], v[6]))
    bm.faces.new((v[3], v[0], v[4], v[7]))


def add_dougong(bm_wood, bm_accent, x, y, z, scale=1.0, rot_y=0.0):
    # 3-tier authentic interlocking Dougong bracket set
    add_box(bm_wood, (x, y, z), (0.34 * scale, 0.16 * scale, 0.34 * scale), rot_y=rot_y)
    add_box(bm_accent, (x, y + 0.14 * scale, z), (0.58 * scale, 0.12 * scale, 0.44 * scale), rot_y=rot_y)
    add_box(bm_wood, (x, y + 0.28 * scale, z), (0.82 * scale, 0.14 * scale, 0.58 * scale), rot_y=rot_y)


def add_lantern(bm_frame, bm_glow, x, y, z, s=1.0):
    # Hanging cord + top cap + hexagonal glowing body + bottom cap & tassel
    add_cyl(bm_frame, (x, y + 0.46 * s, z), 0.025 * s, 0.025 * s, 0.36 * s, segs=6)
    add_cyl(bm_frame, (x, y + 0.25 * s, z), 0.24 * s, 0.14 * s, 0.10 * s, segs=6)
    add_cyl(bm_glow, (x, y, z), 0.26 * s, 0.28 * s, 0.44 * s, segs=6)
    add_cyl(bm_frame, (x, y - 0.25 * s, z), 0.14 * s, 0.22 * s, 0.09 * s, segs=6)
    add_cyl(bm_frame, (x, y - 0.42 * s, z), 0.03 * s, 0.06 * s, 0.26 * s, segs=6)


def add_curved_roof(bm_tile, bm_ridge, base_y, w, d, h, flare=1.14, curve_up=1.05, rib_count_x=22, rib_count_z=14):
    # Concave sweeping Chinese hip-and-gable roof with upturned corners + tile ribs + ridges
    nx, nz = 18, 12
    def roof_pt(ux, uz):
        edge_t = max(abs(ux) * 0.70, abs(uz))
        y = base_y + h * ((1.0 - edge_t) ** 1.55)
        corner = max(0.0, (abs(ux) * abs(uz) - 0.38) / 0.62) ** 1.75
        y += corner * curve_up
        x = ux * (w * 0.5) * (1.0 + (flare - 1.0) * (edge_t ** 1.45))
        z = uz * (d * 0.5) * (1.0 + (flare - 1.0) * (edge_t ** 1.45))
        return x, y, z

    grid_top = []
    grid_bot = []
    thick = 0.24
    for iz in range(nz + 1):
        uz = (iz / nz - 0.5) * 2.0
        rt, rb = [], []
        for ix in range(nx + 1):
            ux = (ix / nx - 0.5) * 2.0
            x, y, z = roof_pt(ux, uz)
            rt.append(bm_tile.verts.new(pt(x, y, z)))
            rb.append(bm_tile.verts.new(pt(x, y - thick, z)))
        grid_top.append(rt)
        grid_bot.append(rb)

    for iz in range(nz):
        for ix in range(nx):
            bm_tile.faces.new((grid_top[iz][ix], grid_top[iz][ix + 1], grid_top[iz + 1][ix + 1], grid_top[iz + 1][ix]))
            bm_tile.faces.new((grid_bot[iz][ix], grid_bot[iz + 1][ix], grid_bot[iz + 1][ix + 1], grid_bot[iz][ix + 1]))
    # Close eave skirt edges
    for ix in range(nx):
        bm_tile.faces.new((grid_top[0][ix], grid_bot[0][ix], grid_bot[0][ix + 1], grid_top[0][ix + 1]))
        bm_tile.faces.new((grid_top[nz][ix + 1], grid_bot[nz][ix + 1], grid_bot[nz][ix], grid_top[nz][ix]))
    for iz in range(nz):
        bm_tile.faces.new((grid_top[iz + 1][0], grid_bot[iz + 1][0], grid_bot[iz][0], grid_top[iz][0]))
        bm_tile.faces.new((grid_top[iz][nx], grid_bot[iz][nx], grid_bot[iz + 1][nx], grid_top[iz + 1][nx]))

    # Sculpted cylindrical ceramic tile ribs (筒瓦楞) running down front & back slopes
    for i in range(rib_count_x):
        ux = -0.94 + (i / max(1, rib_count_x - 1)) * 1.88
        for side in (-1.0, 1.0):
            p0 = roof_pt(ux, side * 0.14)
            p1 = roof_pt(ux, side * 0.99)
            mid = ((p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5 + 0.06, (p0[2] + p1[2]) * 0.5)
            dy, dz = p1[1] - p0[1], p1[2] - p0[2]
            seg_len = math.hypot(dy, dz)
            pitch = math.atan2(dy, abs(dz)) * (-side)
            add_box(bm_tile, mid, (0.14, 0.11, seg_len), rot_x=pitch)
            # Eave-end circular drip tile (瓦当)
            add_cyl(bm_ridge, (p1[0], p1[1] - 0.04, p1[2]), 0.10, 0.10, 0.10, segs=6, rot_x=math.pi * 0.5)

    # Sweeping corner hip ridges (垂脊/戗脊) with upturned ridge figurines
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            steps = 6
            for k in range(steps):
                t0 = k / steps
                t1 = (k + 1) / steps
                p0 = roof_pt(sx * (0.42 + 0.58 * t0), sz * (0.12 + 0.88 * t0))
                p1 = roof_pt(sx * (0.42 + 0.58 * t1), sz * (0.12 + 0.88 * t1))
                mid = ((p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5 + 0.14, (p0[2] + p1[2]) * 0.5)
                add_box(bm_ridge, mid, (0.28, 0.24, 0.28))
            # Upturned corner tip figurine (仙人走兽)
            tip = roof_pt(sx * 0.98, sz * 0.98)
            add_box(bm_ridge, (tip[0], tip[1] + 0.34, tip[2]), (0.26, 0.52, 0.26))

    # Main roof ridge (正脊) + Chiwen dragon finials (吻兽)
    ridge_w = w * 0.54
    ridge_y = base_y + h + 0.22
    add_box(bm_ridge, (0, ridge_y, 0), (ridge_w, 0.44, 0.38), bevel=0.04)
    for sx in (-1.0, 1.0):
        add_box(bm_ridge, (sx * (ridge_w * 0.5 + 0.15), ridge_y + 0.48, 0), (0.62, 1.08, 0.44), bevel=0.05)
        add_box(bm_ridge, (sx * (ridge_w * 0.5 - 0.12), ridge_y + 0.88, 0), (0.38, 0.42, 0.36))


def add_lattice_wall(bm_wood, bm_glow, cx, cy, cz, span, height, axis='Z', panes=4):
    # Carved Chinese wooden lattice door/window panels (隔扇花窗)
    step = span / panes
    for i in range(panes):
        off = -span * 0.5 + (i + 0.5) * step
        if axis == 'Z':
            add_box(bm_glow, (cx + off, cy + height * 0.10, cz), (step * 0.78, height * 0.58, 0.08))
            add_box(bm_wood, (cx + off, cy - height * 0.30, cz), (step * 0.88, height * 0.36, 0.14))
            # Mullion frame & crossbars
            add_box(bm_wood, (cx + off - step * 0.45, cy, cz), (0.10, height, 0.16))
            add_box(bm_wood, (cx + off, cy + height * 0.10, cz), (step * 0.84, 0.07, 0.14))
            add_box(bm_wood, (cx + off, cy + height * 0.26, cz), (step * 0.84, 0.06, 0.14))
            add_box(bm_wood, (cx + off, cy + height * 0.10, cz), (0.06, height * 0.60, 0.14))
        else:
            add_box(bm_glow, (cx, cy + height * 0.10, cz + off), (0.08, height * 0.58, step * 0.78))
            add_box(bm_wood, (cx, cy - height * 0.30, cz + off), (0.14, height * 0.36, step * 0.88))
            add_box(bm_wood, (cx, cy, cz + off - step * 0.45), (0.16, height, 0.10))
            add_box(bm_wood, (cx, cy + height * 0.10, cz + off), (0.14, 0.07, step * 0.84))
            add_box(bm_wood, (cx, cy + height * 0.10, cz + off), (0.14, height * 0.60, 0.06))


# -------------------------------------------------------------
# 1. UPGRADED SHUITINGMEN / DANANMEN DOUBLE-EAVE GATE PAVILION
# -------------------------------------------------------------
def build_shuitingmen_pavilion():
    clear_scene()
    m_tile = make_mat('pav_tile', (0.16, 0.19, 0.23, 1.0), metallic=0.14, roughness=0.48)
    m_red = make_mat('pav_red', (0.56, 0.13, 0.10, 1.0), metallic=0.06, roughness=0.44, coat=0.25, coat_rough=0.28)
    m_wood = make_mat('pav_wood', (0.28, 0.17, 0.12, 1.0), metallic=0.04, roughness=0.72)
    m_stone = make_mat('pav_stone', (0.66, 0.64, 0.60, 1.0), metallic=0.0, roughness=0.88)
    m_gold = make_mat('pav_gold', (0.82, 0.63, 0.25, 1.0), metallic=0.78, roughness=0.28)
    m_glow = make_mat('pav_glow', (1.0, 0.78, 0.42, 1.0), metallic=0.0, roughness=0.22, emissive=(1.0, 0.62, 0.24), emissive_strength=3.2)

    bm_tile, bm_red, bm_wood, bm_stone, bm_gold, bm_glow = [bmesh.new() for _ in range(6)]

    # Double-tier sweeping concave roofs with sculpted tile ribs & ridge beasts
    add_curved_roof(bm_tile, bm_gold, 4.45, 22.8, 13.8, 2.35, flare=1.13, curve_up=1.05, rib_count_x=26)
    add_curved_roof(bm_tile, bm_gold, 8.30, 17.8, 10.8, 3.70, flare=1.16, curve_up=1.35, rib_count_x=22)

    # Core walls
    add_box(bm_red, (0, 2.25, 0), (15.2, 4.4, 8.0), bevel=0.04)
    add_box(bm_red, (0, 6.75, 0), (11.8, 3.2, 6.4), bevel=0.04)
    # Carved wooden lattice doors & windows on all sides
    for sz in (-4.06, 4.06):
        add_lattice_wall(bm_wood, bm_glow, 0, 2.2, sz, 13.2, 3.6, axis='Z', panes=6)
    for sz in (-3.26, 3.26):
        add_lattice_wall(bm_wood, bm_glow, 0, 6.75, sz, 9.6, 2.5, axis='Z', panes=4)
    for sx in (-7.66, 7.66):
        add_lattice_wall(bm_wood, bm_glow, sx, 2.2, 0, 6.0, 3.4, axis='X', panes=3)

    # Lower & upper perimeter vermilion columns + carved drum stone plinths
    for ix in (-8.6, -5.2, -1.8, 1.8, 5.2, 8.6):
        for iz in (-5.0, 5.0):
            add_cyl(bm_stone, (ix, 0.22, iz), 0.44, 0.36, 0.44, segs=10)
            add_cyl(bm_red, (ix, 2.32, iz), 0.29, 0.26, 4.2, segs=12)
            add_dougong(bm_wood, bm_gold, ix, 4.18, iz, scale=0.95)
    for ix in (-6.6, -3.3, 0.0, 3.3, 6.6):
        for iz in (-3.9, 3.9):
            add_cyl(bm_red, (ix, 6.80, iz), 0.23, 0.21, 3.1, segs=12)
            add_dougong(bm_wood, bm_gold, ix, 8.05, iz, scale=0.82)

    # Tie-beams (额枋) & upper veranda carved balustrade railing
    for iz in (-5.0, 5.0):
        add_box(bm_wood, (0, 3.95, iz), (17.8, 0.34, 0.28))
        add_box(bm_gold, (0, 3.62, iz), (17.4, 0.14, 0.30))
    for iz in (-4.55, 4.55):
        add_box(bm_red, (0, 5.85, iz), (14.8, 0.14, 0.14))
        add_box(bm_red, (0, 5.35, iz), (14.8, 0.10, 0.10))
        for rx in np.linspace(-7.2, 7.2, 13):
            add_box(bm_red, (float(rx), 5.60, iz), (0.12, 0.72, 0.12))
            add_box(bm_gold, (float(rx), 6.02, iz), (0.16, 0.14, 0.16))
    # Plaque frames
    for iz in (-5.24, 5.24):
        add_box(bm_gold, (0, 3.55, iz), (3.9, 1.48, 0.16), bevel=0.03)
        add_box(bm_wood, (0, 3.55, iz + (0.04 if iz > 0 else -0.04)), (3.5, 1.15, 0.12))

    # Hanging hexagonal palace lanterns under all 8 flying corners
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            add_lantern(bm_wood, bm_glow, sx * 11.2, 3.85, sz * 6.8, s=1.15)
            add_lantern(bm_wood, bm_glow, sx * 8.9, 7.75, sz * 5.4, s=0.95)

    link_bm('pav_tile', bm_tile, m_tile, smooth=False)
    link_bm('pav_red', bm_red, m_red, smooth=True)
    link_bm('pav_wood', bm_wood, m_wood, smooth=False)
    link_bm('pav_stone', bm_stone, m_stone, smooth=False)
    link_bm('pav_gold', bm_gold, m_gold, smooth=False)
    link_bm('pav_glow', bm_glow, m_glow, smooth=True)
    export_glb('shuitingmen-pavilion.glb')


# -------------------------------------------------------------
# 2. MING DYNASTY ARCHED CITY GATE FORTRESS BASE (city-gate-arch.glb)
#    Unit footprint: 18m (X) x 6.6m (Y) x 14m (Z), tunnel along Z
# -------------------------------------------------------------
def build_city_gate_arch():
    clear_scene()
    m_brick = make_mat('gate_brick', (0.42, 0.45, 0.48, 1.0), metallic=0.0, roughness=0.90)
    m_stone = make_mat('gate_stone', (0.64, 0.62, 0.58, 1.0), metallic=0.0, roughness=0.86)
    m_dark = make_mat('gate_dark', (0.28, 0.30, 0.33, 1.0), metallic=0.0, roughness=0.92)
    m_door = make_mat('gate_door', (0.34, 0.10, 0.08, 1.0), metallic=0.08, roughness=0.58)
    m_brass = make_mat('gate_brass', (0.78, 0.60, 0.24, 1.0), metallic=0.84, roughness=0.26)

    bm_brick, bm_stone, bm_dark, bm_door, bm_brass = [bmesh.new() for _ in range(5)]

    # Left & right battered fortress piers flanking the central 4.8m arched tunnel
    for sx in (-1.0, 1.0):
        add_tapered_box(bm_brick, (sx * 5.8, 3.25, 0), (6.6, 13.8), (6.0, 12.8), 6.5)
        add_tapered_box(bm_stone, (sx * 5.8, 0.45, 0), (6.95, 14.2), (6.75, 13.95), 0.90)
    # Upper spandrel block above the arch (y = 4.2 to 6.5)
    add_tapered_box(bm_brick, (0, 5.35, 0), (5.6, 13.2), (5.4, 12.8), 2.3)
    # Top stone coping cornice (城台压顶石)
    add_box(bm_dark, (0, 6.62, 0), (18.4, 0.36, 13.6), bevel=0.04)

    # True semicircular stone-voussoir arch rings on front & back + tunnel vault
    arch_r = 2.45
    arch_cy = 2.15
    segs = 14
    for i in range(segs):
        a0 = (i / segs) * math.pi
        a1 = ((i + 1) / segs) * math.pi
        am = (a0 + a1) * 0.5
        # Recessed vault ceiling rib
        vx = math.cos(am) * (arch_r + 0.18)
        vy = arch_cy + math.sin(am) * (arch_r + 0.18)
        add_box(bm_dark, (vx, vy, 0), (0.62, 0.34, 12.6), rot_z=am - math.pi * 0.5)
        # Front & back radial carved stone voussoirs (券石)
        is_key = (i == segs // 2 or i == segs // 2 - 1)
        v_rad = arch_r + (0.34 if is_key else 0.24)
        for sz in (-6.65, 6.65):
            fx = math.cos(am) * v_rad
            fy = arch_cy + math.sin(am) * v_rad
            add_box(bm_stone, (fx, fy, sz), (0.58, 0.54 if is_key else 0.42, 0.52), rot_z=am - math.pi * 0.5, bevel=0.02)

    # Recessed dark tunnel side walls + massive studded fortress doors slightly ajar
    for sx in (-2.55, 2.55):
        add_box(bm_dark, (sx, 1.3, 0), (0.28, 2.6, 12.8))
    for sz in (-5.2, 5.2):
        for sx in (-1.0, 1.0):
            add_box(bm_door, (sx * 1.15, 1.95, sz), (2.15, 3.85, 0.24), rot_y=sx * 0.18)
            # Brass door studs (门钉 5x4) & knocker rings
            for r in range(4):
                for c in range(4):
                    bx = sx * (0.45 + c * 0.44)
                    by = 0.75 + r * 0.78
                    add_cyl(bm_brass, (bx, by, sz + (0.16 if sz > 0 else -0.16)), 0.06, 0.04, 0.08, segs=6, rot_x=math.pi * 0.5)

    # Crenellated Ming battlements (女墙垛口) along all 4 top edges
    for sx in np.linspace(-8.2, 8.2, 8):
        for sz in (-6.55, 6.55):
            add_box(bm_brick, (float(sx), 7.25, sz), (1.35, 1.05, 0.46))
            add_box(bm_stone, (float(sx), 7.82, sz), (1.45, 0.14, 0.54))
    for sz in np.linspace(-5.4, 5.4, 5):
        for sx in (-8.95, 8.95):
            add_box(bm_brick, (sx, 7.25, float(sz)), (0.46, 1.05, 1.45))
            add_box(bm_stone, (sx, 7.82, float(sz)), (0.54, 0.14, 1.55))

    link_bm('gate_brick', bm_brick, m_brick)
    link_bm('gate_stone', bm_stone, m_stone)
    link_bm('gate_dark', bm_dark, m_dark)
    link_bm('gate_door', bm_door, m_door)
    link_bm('gate_brass', bm_brass, m_brass, smooth=True)
    export_glb('city-gate-arch.glb')


# -------------------------------------------------------------
# 3. KONGMIAO DACHENG HALL (kongmiao-hall.glb)
#    Unit footprint: ~20m x 13m x 13.5m high
# -------------------------------------------------------------
def build_kongmiao_hall():
    clear_scene()
    m_gold_tile = make_mat('km_gold_tile', (0.76, 0.56, 0.16, 1.0), metallic=0.28, roughness=0.34, coat=0.45, coat_rough=0.18)
    m_gold = make_mat('km_gold', (0.88, 0.68, 0.24, 1.0), metallic=0.84, roughness=0.24)
    m_red = make_mat('km_red', (0.58, 0.12, 0.10, 1.0), metallic=0.05, roughness=0.46, coat=0.22, coat_rough=0.30)
    m_marble = make_mat('km_marble', (0.82, 0.80, 0.76, 1.0), metallic=0.0, roughness=0.78)
    m_wood = make_mat('km_wood', (0.28, 0.16, 0.11, 1.0), metallic=0.04, roughness=0.70)
    m_glow = make_mat('km_glow', (1.0, 0.80, 0.44, 1.0), metallic=0.0, roughness=0.20, emissive=(1.0, 0.66, 0.26), emissive_strength=3.0)

    bm_gt, bm_go, bm_red, bm_mb, bm_wd, bm_gl = [bmesh.new() for _ in range(6)]

    # Carved white-marble Xumi terrace pedestal (汉白玉须弥座)
    add_box(bm_mb, (0, 0.25, 0), (19.6, 0.50, 12.6), bevel=0.04)
    add_box(bm_mb, (0, 0.88, 0), (18.8, 0.85, 11.8))
    add_box(bm_mb, (0, 1.42, 0), (19.4, 0.30, 12.4), bevel=0.04)
    # Grand front staircase + central carved Danbi royal ramp (丹陛御路石)
    for s in range(6):
        add_box(bm_mb, (0, 0.13 + s * 0.24, 6.2 + (5 - s) * 0.42), (7.6, 0.24, 0.48))
    add_box(bm_mb, (0, 0.86, 7.25), (2.2, 0.24, 2.85), rot_x=0.46)
    # Marble balustrades & lotus-bud posts (望柱栏板)
    for px in np.linspace(-9.2, 9.2, 11):
        if abs(px) < 3.6:
            continue
        add_box(bm_mb, (float(px), 2.15, 5.95), (0.24, 1.15, 0.24))
        add_cyl(bm_mb, (float(px), 2.82, 5.95), 0.14, 0.08, 0.24, segs=8)
    add_box(bm_mb, (-6.5, 2.10, 5.95), (5.5, 0.72, 0.12))
    add_box(bm_mb, (6.5, 2.10, 5.95), (5.5, 0.72, 0.12))

    # Main vermilion hall core + carved lattice doors
    add_box(bm_red, (0, 4.15, 0), (14.4, 5.2, 8.0), bevel=0.04)
    add_lattice_wall(bm_wd, bm_gl, 0, 4.0, 4.06, 12.6, 4.2, axis='Z', panes=6)
    add_lattice_wall(bm_wd, bm_gl, 0, 4.0, -4.06, 12.6, 4.2, axis='Z', panes=6)

    # Perimeter vermilion colonnade + marble drum bases + Dougong brackets
    for ix in (-7.6, -4.6, -1.6, 1.6, 4.6, 7.6):
        for iz in (-4.8, 4.8):
            add_cyl(bm_mb, (ix, 1.78, iz), 0.44, 0.36, 0.42, segs=10)
            add_cyl(bm_red, (ix, 4.25, iz), 0.28, 0.25, 4.6, segs=12)
            add_dougong(bm_wd, bm_go, ix, 6.45, iz, scale=0.92)
    for iz in (-4.8, 4.8):
        add_box(bm_wd, (0, 6.20, iz), (15.8, 0.36, 0.28))
        add_box(bm_go, (0, 5.88, iz), (15.4, 0.14, 0.30))

    # Upper clerestory & imperial yellow glazed double-eave roof (重檐庑殿黄琉璃瓦)
    add_box(bm_red, (0, 8.65, 0), (11.2, 2.6, 6.0))
    add_lattice_wall(bm_wd, bm_gl, 0, 8.65, 3.06, 9.2, 2.0, axis='Z', panes=4)
    add_curved_roof(bm_gt, bm_go, 6.70, 20.6, 12.8, 2.25, flare=1.14, curve_up=1.05, rib_count_x=24)
    add_curved_roof(bm_gt, bm_go, 9.85, 16.4, 9.8, 3.45, flare=1.16, curve_up=1.30, rib_count_x=20)

    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            add_lantern(bm_wd, bm_gl, sx * 9.8, 6.0, sz * 6.0, s=1.05)

    link_bm('km_gold_tile', bm_gt, m_gold_tile)
    link_bm('km_gold', bm_go, m_gold)
    link_bm('km_red', bm_red, m_red, smooth=True)
    link_bm('km_marble', bm_mb, m_marble)
    link_bm('km_wood', bm_wd, m_wood)
    link_bm('km_glow', bm_gl, m_glow, smooth=True)
    export_glb('kongmiao-hall.glb')


# -------------------------------------------------------------
# 4. KONGMIAO LINGXINGMEN 4-PILLAR PAIFANG ARCHWAY (kongmiao-paifang.glb)
# -------------------------------------------------------------
def build_kongmiao_paifang():
    clear_scene()
    m_stone = make_mat('pf_stone', (0.78, 0.76, 0.72, 1.0), metallic=0.0, roughness=0.82)
    m_red = make_mat('pf_red', (0.58, 0.13, 0.10, 1.0), metallic=0.06, roughness=0.45)
    m_tile = make_mat('pf_tile', (0.76, 0.56, 0.16, 1.0), metallic=0.28, roughness=0.34, coat=0.40, coat_rough=0.20)
    m_gold = make_mat('pf_gold', (0.88, 0.68, 0.24, 1.0), metallic=0.84, roughness=0.24)

    bm_st, bm_rd, bm_ti, bm_go = [bmesh.new() for _ in range(4)]
    for px in (-4.4, -1.7, 1.7, 4.4):
        h = 7.4 if abs(px) < 2.5 else 6.4
        # Drum-stone bases (抱鼓石)
        add_box(bm_st, (px, 0.45, 0), (0.88, 0.90, 1.65), bevel=0.06)
        add_cyl(bm_st, (px, 0.65, 0.78), 0.36, 0.36, 0.36, segs=10, rot_z=math.pi * 0.5)
        add_cyl(bm_st, (px, 0.65, -0.78), 0.36, 0.36, 0.36, segs=10, rot_z=math.pi * 0.5)
        # Tall stone pillar + cloud-scroll finial (云板)
        add_cyl(bm_st, (px, h * 0.5, 0), 0.28, 0.24, h, segs=12)
        add_box(bm_st, (px, h - 0.55, 0), (1.05, 0.28, 0.14), bevel=0.03)
        add_cyl(bm_go, (px, h + 0.32, 0), 0.22, 0.12, 0.56, segs=8)
    # Carved crossbeams & plaque
    add_box(bm_rd, (0, 5.15, 0), (9.6, 0.72, 0.48), bevel=0.04)
    add_box(bm_go, (0, 5.65, 0), (3.4, 0.44, 0.52), bevel=0.03)
    # 3 upturned mini-roofs (center higher, wings lower)
    add_curved_roof(bm_ti, bm_go, 5.95, 4.6, 2.2, 1.05, flare=1.18, curve_up=0.45, rib_count_x=10)
    for sx in (-3.15, 3.15):
        bm_tmp_t, bm_tmp_r = bmesh.new(), bmesh.new()
        add_curved_roof(bm_tmp_t, bm_tmp_r, 5.15, 3.4, 1.9, 0.85, flare=1.18, curve_up=0.38, rib_count_x=8)
        bmesh.ops.translate(bm_tmp_t, verts=bm_tmp_t.verts, vec=pt(sx, 0, 0))
        bmesh.ops.translate(bm_tmp_r, verts=bm_tmp_r.verts, vec=pt(sx, 0, 0))
        # merge into bm_ti / bm_go
        for src, dst in ((bm_tmp_t, bm_ti), (bm_tmp_r, bm_go)):
            vmap = [dst.verts.new(v.co) for v in src.verts]
            for f in src.faces:
                try:
                    dst.faces.new([vmap[v.index] for v in f.verts])
                except ValueError:
                    pass
            src.free()

    link_bm('pf_stone', bm_st, m_stone, smooth=True)
    link_bm('pf_red', bm_rd, m_red)
    link_bm('pf_tile', bm_ti, m_tile)
    link_bm('pf_gold', bm_go, m_gold)
    export_glb('kongmiao-paifang.glb')


# -------------------------------------------------------------
# 5. QUZHOU BELL TOWER WITH REAL BRONZE BELL (bell-tower.glb)
# -------------------------------------------------------------
def build_bell_tower():
    clear_scene()
    m_brick = make_mat('bt_brick', (0.43, 0.46, 0.49, 1.0), metallic=0.0, roughness=0.90)
    m_stone = make_mat('bt_stone', (0.66, 0.64, 0.60, 1.0), metallic=0.0, roughness=0.86)
    m_tile = make_mat('bt_tile', (0.16, 0.19, 0.23, 1.0), metallic=0.14, roughness=0.48)
    m_red = make_mat('bt_red', (0.56, 0.13, 0.10, 1.0), metallic=0.06, roughness=0.44)
    m_wood = make_mat('bt_wood', (0.28, 0.17, 0.12, 1.0), metallic=0.04, roughness=0.72)
    m_bronze = make_mat('bt_bronze', (0.30, 0.36, 0.30, 1.0), metallic=0.82, roughness=0.34)
    m_gold = make_mat('bt_gold', (0.84, 0.65, 0.26, 1.0), metallic=0.82, roughness=0.26)
    m_glow = make_mat('bt_glow', (1.0, 0.78, 0.42, 1.0), metallic=0.0, roughness=0.20, emissive=(1.0, 0.64, 0.24), emissive_strength=3.2)

    bm_br, bm_st, bm_ti, bm_rd, bm_wd, bm_bz, bm_go, bm_gl = [bmesh.new() for _ in range(8)]

    # Battered brick base with granite plinth & stone cornice
    add_tapered_box(bm_st, (0, 0.45, 0), (16.4, 16.4), (16.0, 16.0), 0.90)
    add_tapered_box(bm_br, (0, 3.05, 0), (15.8, 15.8), (14.8, 14.8), 4.4)
    add_box(bm_st, (0, 5.42, 0), (15.6, 0.38, 15.6), bevel=0.04)
    # Arched stone portals on North & South faces
    for sz in (-7.65, 7.65):
        add_box(bm_wd, (0, 2.0, sz), (3.8, 3.8, 0.36))
        for i in range(10):
            a = (i + 0.5) / 10 * math.pi
            add_box(bm_st, (math.cos(a) * 2.15, 2.0 + math.sin(a) * 2.15, sz), (0.48, 0.42, 0.52), rot_z=a - math.pi * 0.5)

    # 1st floor vermilion pavilion + lattice windows + lower sweeping roof
    add_box(bm_rd, (0, 7.8, 0), (10.6, 4.4, 10.6), bevel=0.04)
    for sz in (-5.35, 5.35):
        add_lattice_wall(bm_wd, bm_gl, 0, 7.8, sz, 8.6, 3.4, axis='Z', panes=4)
    for sx in (-5.35, 5.35):
        add_lattice_wall(bm_wd, bm_gl, sx, 7.8, 0, 8.6, 3.4, axis='X', panes=4)
    for sx in (-5.8, -2.0, 2.0, 5.8):
        for sz in (-5.8, 5.8):
            add_cyl(bm_rd, (sx, 7.8, sz), 0.24, 0.22, 4.4, segs=10)
            add_dougong(bm_wd, bm_go, sx, 9.8, sz, scale=0.80)
    add_curved_roof(bm_ti, bm_go, 10.05, 16.4, 16.4, 2.2, flare=1.15, curve_up=1.05, rib_count_x=18)

    # 2nd floor open belfry (透空悬钟阁) + sculpted ancient bronze temple bell (古铜大钟)
    for sx in (-4.0, 4.0):
        for sz in (-4.0, 4.0):
            add_cyl(bm_rd, (sx, 13.0, sz), 0.26, 0.24, 4.6, segs=10)
            add_dougong(bm_wd, bm_go, sx, 15.1, sz, scale=0.80)
    add_box(bm_wd, (0, 14.9, 0), (8.6, 0.40, 0.40))
    # Sculpted bronze bell (flared skirt, ribbed body, lotus crown, suspension loop)
    add_cyl(bm_bz, (0, 12.25, 0), 1.38, 1.06, 0.65, segs=16)
    add_cyl(bm_bz, (0, 13.15, 0), 1.06, 0.86, 1.25, segs=16)
    add_cyl(bm_bz, (0, 13.95, 0), 0.86, 0.42, 0.42, segs=16)
    add_cyl(bm_go, (0, 14.42, 0), 0.24, 0.24, 0.62, segs=10)
    # Wooden striking beam (撞木)
    add_cyl(bm_wd, (0, 12.2, 2.6), 0.16, 0.16, 3.0, segs=10, rot_x=math.pi * 0.5)

    # Upper sweeping pyramidal roof (攒尖顶) + tall golden finial
    add_curved_roof(bm_ti, bm_go, 15.35, 13.8, 13.8, 3.6, flare=1.18, curve_up=1.25, rib_count_x=16)
    add_cyl(bm_go, (0, 19.8, 0), 0.65, 0.16, 1.4, segs=12)
    add_cyl(bm_go, (0, 21.1, 0), 0.16, 0.05, 1.8, segs=10)
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            add_lantern(bm_wd, bm_gl, sx * 8.1, 9.4, sz * 8.1, s=0.95)
            add_lantern(bm_wd, bm_gl, sx * 6.9, 14.7, sz * 6.9, s=0.85)

    link_bm('bt_brick', bm_br, m_brick)
    link_bm('bt_stone', bm_st, m_stone)
    link_bm('bt_tile', bm_ti, m_tile)
    link_bm('bt_red', bm_rd, m_red, smooth=True)
    link_bm('bt_wood', bm_wd, m_wood)
    link_bm('bt_bronze', bm_bz, m_bronze, smooth=True)
    link_bm('bt_gold', bm_go, m_gold)
    link_bm('bt_glow', bm_gl, m_glow, smooth=True)
    export_glb('bell-tower.glb')


# -------------------------------------------------------------
# 6. HUIZHOU ANCIENT COURTYARD HOUSE (huizhou-house.glb)
#    Unit footprint: 12m (X) x 8m (Z) x 7.5m (Y)
# -------------------------------------------------------------
def build_huizhou_house():
    clear_scene()
    m_white = make_mat('hz_white', (0.86, 0.84, 0.79, 1.0), metallic=0.0, roughness=0.88)
    m_brick = make_mat('hz_brick', (0.44, 0.47, 0.50, 1.0), metallic=0.0, roughness=0.90)
    m_tile = make_mat('hz_tile', (0.17, 0.20, 0.24, 1.0), metallic=0.12, roughness=0.52)
    m_wood = make_mat('hz_wood', (0.26, 0.16, 0.11, 1.0), metallic=0.04, roughness=0.72)
    m_stone = make_mat('hz_stone', (0.64, 0.62, 0.58, 1.0), metallic=0.0, roughness=0.86)
    m_glow = make_mat('hz_glow', (1.0, 0.80, 0.44, 1.0), metallic=0.0, roughness=0.22, emissive=(1.0, 0.64, 0.25), emissive_strength=2.8)
    m_red = make_mat('hz_red', (0.62, 0.14, 0.11, 1.0), metallic=0.04, roughness=0.48)

    bm_wh, bm_br, bm_ti, bm_wd, bm_st, bm_gl, bm_rd = [bmesh.new() for _ in range(7)]

    # Carved stone plinth & blue-brick lower wainscot
    add_box(bm_st, (0, 0.25, 0), (12.4, 0.50, 8.4), bevel=0.03)
    add_box(bm_br, (0, 1.15, 0), (12.1, 1.4, 8.1))
    # White lime-plaster upper body
    add_box(bm_wh, (0, 4.35, 0), (11.8, 5.2, 7.8))
    # Ground-floor carved wooden shopfront + overhanging timber eave (挑檐)
    add_lattice_wall(bm_wd, bm_gl, 0, 1.85, 4.02, 9.8, 3.1, axis='Z', panes=5)
    add_box(bm_ti, (0, 3.55, 4.72), (11.6, 0.22, 1.65), rot_x=0.24)
    for bx in (-4.8, -2.4, 0.0, 2.4, 4.8):
        add_box(bm_wd, (bx, 3.35, 4.35), (0.16, 0.26, 0.92))
    # 2nd-floor carved wooden lattice windows + Meirenkao balcony (美人靠)
    add_lattice_wall(bm_wd, bm_gl, 0, 5.15, 3.96, 8.4, 2.1, axis='Z', panes=4)
    add_lattice_wall(bm_wd, bm_gl, 0, 5.15, -3.96, 8.4, 2.1, axis='Z', panes=4)
    add_box(bm_wd, (0, 4.18, 4.32), (8.8, 0.14, 0.68))
    add_box(bm_wd, (0, 4.78, 4.60), (8.8, 0.10, 0.12))
    for rx in np.linspace(-4.2, 4.2, 11):
        add_box(bm_wd, (float(rx), 4.48, 4.58), (0.08, 0.58, 0.08))

    # Concave pitched grey-tile roof with ribs
    for side in (-1.0, 1.0):
        add_box(bm_ti, (0, 7.45, side * 2.15), (12.2, 0.26, 4.85), rot_x=side * 0.34)
        for rx in np.linspace(-5.6, 5.6, 20):
            add_box(bm_ti, (float(rx), 7.62, side * 2.15), (0.12, 0.10, 4.95), rot_x=side * 0.34)
    add_box(bm_ti, (0, 8.38, 0), (12.0, 0.42, 0.52), bevel=0.04)

    # Authentic 3-tier stepped Huizhou Horse-Head Gable Walls (三叠马头墙) with upturned eaves
    for sx in (-6.12, 6.12):
        add_box(bm_wh, (sx, 4.15, 0), (0.48, 7.8, 8.3))
        add_box(bm_wh, (sx, 8.35, 0), (0.48, 1.35, 5.4))
        add_box(bm_wh, (sx, 9.30, 0), (0.48, 1.10, 2.7))
        # Tiered tile coping caps with upturned corner tips (戗角)
        for cap_y, cap_d in ((8.12, 8.75), (9.10, 5.85), (9.92, 3.15)):
            add_box(bm_ti, (sx, cap_y, 0), (0.94, 0.22, cap_d), bevel=0.03)
            for sz in (-cap_d * 0.48, cap_d * 0.48):
                add_box(bm_ti, (sx, cap_y + 0.18, sz), (0.92, 0.20, 0.38), rot_x=(0.35 if sz > 0 else -0.35))

    # Hanging red lanterns under shopfront eave
    for lx in (-3.6, 0.0, 3.6):
        add_lantern(bm_rd, bm_gl, lx, 2.95, 5.18, s=0.78)

    link_bm('hz_white', bm_wh, m_white)
    link_bm('hz_brick', bm_br, m_brick)
    link_bm('hz_tile', bm_ti, m_tile)
    link_bm('hz_wood', bm_wd, m_wood)
    link_bm('hz_stone', bm_st, m_stone)
    link_bm('hz_glow', bm_gl, m_glow, smooth=True)
    link_bm('hz_red', bm_rd, m_red)
    export_glb('huizhou-house.glb')


# -------------------------------------------------------------
# 7. UPGRADED 7-TIER OCTAGONAL FLYING-EAVE PAGODA (tianwang-pagoda.glb)
# -------------------------------------------------------------
def build_tianwang_pagoda():
    clear_scene()
    m_brick = make_mat('pag_brick', (0.76, 0.72, 0.65, 1.0), metallic=0.0, roughness=0.86)
    m_stone = make_mat('pag_stone', (0.62, 0.60, 0.56, 1.0), metallic=0.0, roughness=0.88)
    m_tile = make_mat('pag_tile', (0.16, 0.19, 0.23, 1.0), metallic=0.14, roughness=0.46)
    m_wood = make_mat('pag_wood', (0.48, 0.15, 0.11, 1.0), metallic=0.05, roughness=0.48)
    m_gold = make_mat('pag_gold', (0.86, 0.67, 0.26, 1.0), metallic=0.86, roughness=0.22)
    m_glow = make_mat('pag_glow', (1.0, 0.82, 0.44, 1.0), metallic=0.0, roughness=0.20, emissive=(1.0, 0.64, 0.24), emissive_strength=3.6)

    bm_br, bm_st, bm_ti, bm_wd, bm_go, bm_gl = [bmesh.new() for _ in range(6)]

    # 2-tier carved octagonal stone Xumi base
    add_cyl(bm_st, (0, 0.75, 0), 8.4, 8.0, 1.5, segs=8)
    add_cyl(bm_st, (0, 2.05, 0), 7.1, 6.7, 1.2, segs=8)

    cur_y = 2.65
    for tier in range(7):
        r_core = 5.3 - tier * 0.46
        h_core = 4.5 - tier * 0.23
        r_eave = r_core + 2.15 - tier * 0.13
        add_cyl(bm_br, (0, cur_y + h_core * 0.5, 0), r_core, r_core * 0.96, h_core, segs=8)
        # 8 corner vermilion columns + Dougong brackets + octagonal balcony railing
        for k in range(8):
            a = k * math.pi / 4.0
            cx, cz = math.cos(a) * (r_core + 0.08), math.sin(a) * (r_core + 0.08)
            add_cyl(bm_wd, (cx, cur_y + h_core * 0.5, cz), 0.17, 0.15, h_core, segs=8)
            add_dougong(bm_wd, bm_go, cx, cur_y + h_core - 0.35, cz, scale=0.68 - tier * 0.04, rot_y=-a)
            # Balcony rail post & bar
            rx, rz = math.cos(a) * (r_core + 0.62), math.sin(a) * (r_core + 0.62)
            add_box(bm_wd, (rx, cur_y + 0.55, rz), (0.14, 0.95, 0.14))
        # Arched glowing Buddha niches on 4 cardinal faces
        for k in range(4):
            a = k * math.pi / 2.0 + math.pi / 8.0
            nx, nz = math.cos(a) * (r_core * 0.94), math.sin(a) * (r_core * 0.94)
            add_box(bm_gl, (nx, cur_y + h_core * 0.48, nz), (0.95 - tier * 0.06, h_core * 0.50, 0.95 - tier * 0.06))
            add_box(bm_wd, (nx, cur_y + h_core * 0.76, nz), (1.15 - tier * 0.06, 0.18, 1.15 - tier * 0.06))

        # Sweeping concave octagonal flying eave roof with upturned corner tips + hip ridges
        y_eave = cur_y + h_core
        rings = [
            (r_core * 0.90, y_eave + 1.05),
            (r_core * 0.98 + (r_eave - r_core) * 0.48, y_eave + 0.24),
            (r_eave, y_eave + 0.72),
        ]
        v_rings = []
        for r, ry in rings:
            v_rings.append([bm_ti.verts.new(pt(math.cos(k * math.pi / 4.0) * r, ry, math.sin(k * math.pi / 4.0) * r)) for k in range(8)])
        for r_idx in range(2):
            for k in range(8):
                kn = (k + 1) % 8
                bm_ti.faces.new((v_rings[r_idx][k], v_rings[r_idx][kn], v_rings[r_idx + 1][kn], v_rings[r_idx + 1][k]))
        # 8 upturned corner hip ridges & hanging lanterns
        for k in range(8):
            a = k * math.pi / 4.0
            tip_x, tip_z = math.cos(a) * r_eave, math.sin(a) * r_eave
            add_box(bm_go, (tip_x, y_eave + 0.95, tip_z), (0.20, 0.38, 0.20))
            if tier < 5 and k % 2 == 0:
                add_lantern(bm_wd, bm_gl, tip_x * 0.96, y_eave - 0.12, tip_z * 0.96, s=0.62)
        cur_y += h_core + 0.62

    # Spire roof + sculpted gilded multi-ring bronze finial (相轮塔刹)
    add_cyl(bm_ti, (0, cur_y + 1.45, 0), 2.75, 0.32, 2.9, segs=8)
    add_cyl(bm_go, (0, cur_y + 3.10, 0), 0.72, 0.42, 0.75, segs=12)
    add_cyl(bm_go, (0, cur_y + 4.95, 0), 0.20, 0.05, 3.6, segs=10)
    for ry in (3.7, 4.2, 4.7, 5.2, 5.7):
        rr = 0.52 - (ry - 3.7) * 0.12
        add_cyl(bm_go, (0, cur_y + ry, 0), rr, rr, 0.11, segs=12)

    bmesh.ops.solidify(bm_ti, geom=bm_ti.faces[:], thickness=0.22)
    link_bm('pag_brick', bm_br, m_brick)
    link_bm('pag_stone', bm_st, m_stone)
    link_bm('pag_tile', bm_ti, m_tile)
    link_bm('pag_wood', bm_wd, m_wood, smooth=True)
    link_bm('pag_gold', bm_go, m_gold, smooth=True)
    link_bm('pag_glow', bm_gl, m_glow, smooth=True)
    export_glb('tianwang-pagoda.glb')


if __name__ == '__main__':
    build_shuitingmen_pavilion()
    build_city_gate_arch()
    build_kongmiao_hall()
    build_kongmiao_paifang()
    build_bell_tower()
    build_huizhou_house()
    build_tianwang_pagoda()
    print('ALL_ANCIENT_ARCH_COMPLETE')
