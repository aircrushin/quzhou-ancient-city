import bpy
import bmesh
import math
import os
import numpy as np
from mathutils import Vector, Matrix, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MODEL_DIR = os.path.join(ROOT, 'assets', 'models')
PBR_DIR = os.path.join(ROOT, 'assets', 'pbr')
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(PBR_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def make_mat(name, base_color=(0.8, 0.8, 0.8, 1.0), metallic=0.0, roughness=0.5,
             emissive=(0.0, 0.0, 0.0), emissive_strength=0.0, alpha=1.0,
             coat=0.0, coat_rough=0.1, use_vcol=False):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base_color[:3], 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if use_vcol:
        vc = nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Color'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    if 'Emission Color' in bsdf.inputs:
        bsdf.inputs['Emission Color'].default_value = (*emissive, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emissive_strength
    if 'Alpha' in bsdf.inputs and alpha < 0.999:
        bsdf.inputs['Alpha'].default_value = alpha
        mat.blend_method = 'BLEND'
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = coat_rough
    return mat


def set_smooth(obj):
    mesh = obj.data
    n = len(mesh.polygons)
    if n:
        mesh.polygons.foreach_set('use_smooth', [True] * n)
    mesh.update()


def add_subsurf(obj, levels=1):
    mod = obj.modifiers.new(name='Subsurf', type='SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def link_obj(name, mesh, mat=None):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat is not None:
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat
    return obj


def export_glb(filename):
    path = os.path.join(MODEL_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_texcoords=True,
        export_materials='EXPORT',
    )
    size_kb = os.path.getsize(path) / 1024.0
    print(f'EXPORTED {filename}: {size_kb:.1f} KB')


# Convert Three.js (x right, y up, z forward) -> Blender (x right, -z back, y up)
def pt(x, y, z):
    return Vector((x, -z, y))


def build_loft(name, rings, mat, cap_start=True, cap_end=True, smooth=True):
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
        try:
            bm.faces.new(list(reversed(v_rings[0])))
        except ValueError:
            pass
    if cap_end:
        try:
            bm.faces.new(v_rings[-1])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = link_obj(name, mesh, mat)
    if smooth:
        set_smooth(obj)
    return obj


def add_box_to_bm(bm, center, size, rot=(0, 0, 0), bevel_w=0.0):
    sx, sy, sz = size
    mat_scale = Matrix.Diagonal((sx, sz, sy, 1.0))
    mat_rot = Euler((rot[0], -rot[2], rot[1]), 'XYZ').to_matrix().to_4x4()
    mat_trans = Matrix.Translation(pt(*center))
    ret = bmesh.ops.create_cube(bm, size=1.0, matrix=mat_trans @ mat_rot @ mat_scale)
    if bevel_w > 0:
        edges = list({e for v in ret['verts'] for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel_w, segments=2, affect='EDGES', clamp_overlap=True)
    return ret['verts']


def add_cyl_to_bm(bm, center, r1, r2, depth, segs=24, axis='Y'):
    if axis == 'Y':
        rot = Matrix.Identity(4)
    elif axis == 'X':
        rot = Euler((0, math.pi / 2, 0), 'XYZ').to_matrix().to_4x4()
    else:
        rot = Euler((math.pi / 2, 0, 0), 'XYZ').to_matrix().to_4x4()
    mat_trans = Matrix.Translation(pt(*center))
    ret = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs,
        radius1=r1, radius2=r2, depth=depth, matrix=mat_trans @ rot
    )
    return ret['verts']


# -------------------------------------------------------------
# 1. HERO SPORTS GT CAR (hero-gt.glb)
# -------------------------------------------------------------
def build_hero_gt():
    clear_scene()
    m_paint = make_mat('paint', (0.16, 0.42, 0.46, 1.0), metallic=0.72, roughness=0.14, coat=1.0, coat_rough=0.04)
    m_trim = make_mat('trim', (0.08, 0.09, 0.11, 1.0), metallic=0.48, roughness=0.36)
    m_chrome = make_mat('chrome', (0.80, 0.84, 0.88, 1.0), metallic=0.94, roughness=0.12)
    m_glass = make_mat('glass', (0.05, 0.10, 0.14, 1.0), metallic=0.22, roughness=0.05, alpha=0.56, coat=1.0, coat_rough=0.03)
    m_head = make_mat('head', (1.0, 0.96, 0.86, 1.0), metallic=0.1, roughness=0.1, emissive=(1.0, 0.95, 0.82), emissive_strength=3.8)
    m_rear = make_mat('rear', (0.95, 0.08, 0.06, 1.0), metallic=0.1, roughness=0.12, emissive=(1.0, 0.10, 0.06), emissive_strength=3.4)
    m_rubber = make_mat('rubber', (0.045, 0.05, 0.055, 1.0), metallic=0.04, roughness=0.80)
    m_caliper = make_mat('caliper', (0.82, 0.10, 0.08, 1.0), metallic=0.58, roughness=0.26)

    wheelbase = 1.46

    def arch_cut(z):
        d = min(abs(z - wheelbase), abs(z + wheelbase))
        if d < 0.43:
            return 0.42 * math.sqrt(max(0.0, 1.0 - (d / 0.43) ** 2))
        return 0.0

    stations = [
        (-2.27, 0.68, 0.78, 0.72, 0.36, 0.58, 0.84),
        (-2.16, 0.82, 0.92, 0.84, 0.31, 0.64, 0.96),
        (-1.95, 0.89, 0.98, 0.88, 0.27, 0.68, 1.01),
        (-1.68, 0.92, 1.02, 0.90, 0.26, 0.69, 1.02),
        (-1.46, 0.93, 1.03, 0.91, 0.26, 0.70, 1.02),
        (-1.18, 0.91, 1.01, 0.89, 0.25, 0.69, 1.01),
        (-0.75, 0.88, 0.97, 0.86, 0.25, 0.67, 0.99),
        ( 0.00, 0.88, 0.97, 0.86, 0.25, 0.66, 0.97),
        ( 0.75, 0.89, 0.98, 0.87, 0.25, 0.65, 0.95),
        ( 1.15, 0.91, 1.01, 0.89, 0.26, 0.64, 0.93),
        ( 1.46, 0.92, 1.02, 0.90, 0.26, 0.63, 0.90),
        ( 1.76, 0.89, 0.99, 0.86, 0.27, 0.60, 0.84),
        ( 2.04, 0.82, 0.91, 0.78, 0.28, 0.55, 0.74),
        ( 2.20, 0.70, 0.80, 0.68, 0.30, 0.48, 0.64),
        ( 2.27, 0.56, 0.66, 0.56, 0.32, 0.44, 0.56),
    ]
    body_rings = []
    for z, wl, wm, ws, yb, ym, yt in stations:
        lift = arch_cut(z)
        yb_l = min(ym - 0.06, yb + lift * 0.78)
        w_flare = 0.045 * (lift / 0.42) if lift > 0 else 0.0
        wm2 = wm + w_flare
        ws2 = ws + w_flare * 0.6
        ring = [
            (-wl * 0.78, yb, z),
            ( wl * 0.78, yb, z),
            ( wl + w_flare * 0.4, yb_l + 0.02, z),
            ( wm2, (yb_l + ym) * 0.55, z),
            ( wm2 + 0.012, ym + 0.08, z),
            ( ws2, yt - 0.06, z),
            ( ws2 * 0.78, yt + 0.015, z),
            ( 0.0, yt + 0.032, z),
            (-ws2 * 0.78, yt + 0.015, z),
            (-ws2, yt - 0.06, z),
            (-wm2 - 0.012, ym + 0.08, z),
            (-wm2, (yb_l + ym) * 0.55, z),
            (-wl - w_flare * 0.4, yb_l + 0.02, z),
        ]
        body_rings.append(ring)
    paint_body = build_loft('paint_body', body_rings, m_paint, True, True, True)
    add_subsurf(paint_body, 1)

    cabin_stations = [
        (-1.82, 0.80, 0.62, 0.99, 1.07),
        (-1.42, 0.82, 0.66, 1.00, 1.24),
        (-0.92, 0.82, 0.66, 0.99, 1.38),
        (-0.30, 0.81, 0.65, 0.97, 1.41),
        ( 0.35, 0.80, 0.63, 0.95, 1.37),
        ( 0.86, 0.79, 0.61, 0.93, 1.18),
        ( 1.24, 0.78, 0.62, 0.91, 0.95),
    ]
    glass_rings = []
    for z, w0, w1, y0, y1 in cabin_stations:
        glass_rings.append([
            (-w0, y0, z), (w0, y0, z), (w1 + 0.04, (y0 + y1) * 0.55, z),
            (w1, y1 - 0.02, z), (0.0, y1 + 0.028, z), (-w1, y1 - 0.02, z),
            (-w1 - 0.04, (y0 + y1) * 0.55, z),
        ])
    glass_obj = build_loft('glass', glass_rings, m_glass, True, True, True)
    add_subsurf(glass_obj, 1)

    roof_rings = []
    for z, w1, y1 in [(-1.35, 0.61, 1.27), (-0.92, 0.64, 1.39), (-0.30, 0.64, 1.425), (0.35, 0.61, 1.385), (0.52, 0.58, 1.32)]:
        roof_rings.append([
            (-w1, y1 - 0.015, z), (w1, y1 - 0.015, z),
            (w1 * 0.72, y1 + 0.025, z), (0.0, y1 + 0.042, z), (-w1 * 0.72, y1 + 0.025, z),
        ])
    roof_obj = build_loft('paint_roof', roof_rings, m_paint, True, True, True)
    add_subsurf(roof_obj, 1)

    bm_p = bmesh.new()
    add_box_to_bm(bm_p, (0.0, 1.03, -2.14), (1.58, 0.05, 0.19), rot=(0.14, 0, 0), bevel_w=0.015)
    for side in (-1, 1):
        add_box_to_bm(bm_p, (side * 0.99, 1.03, 0.62), (0.22, 0.10, 0.14), rot=(0, -side * 0.15, 0), bevel_w=0.025)
    bmesh.ops.recalc_face_normals(bm_p, faces=bm_p.faces)
    m_p_extra = bpy.data.meshes.new('paint_extra')
    bm_p.to_mesh(m_p_extra)
    bm_p.free()
    paint_extra = link_obj('paint_extra', m_p_extra, m_paint)
    set_smooth(paint_extra)

    bpy.ops.object.select_all(action='DESELECT')
    for o in (paint_body, roof_obj, paint_extra):
        o.select_set(True)
    bpy.context.view_layer.objects.active = paint_body
    bpy.ops.object.join()
    paint_body.name = 'paint'

    bm_t = bmesh.new()
    add_box_to_bm(bm_t, (0.0, 0.27, 2.22), (1.72, 0.06, 0.24), bevel_w=0.015)
    add_box_to_bm(bm_t, (0.0, 0.45, 2.25), (1.28, 0.22, 0.09), bevel_w=0.015)
    for s in (-1, 1):
        add_box_to_bm(bm_t, (s * 0.72, 0.43, 2.21), (0.34, 0.16, 0.08), rot=(0, s * 0.22, 0), bevel_w=0.012)
        add_box_to_bm(bm_t, (s * 0.92, 0.25, 0.0), (0.10, 0.08, 2.15), bevel_w=0.015)
        add_box_to_bm(bm_t, (s * 0.87, 0.99, 0.65), (0.14, 0.04, 0.06), bevel_w=0.008)
        add_box_to_bm(bm_t, (s * 0.96, 0.88, -0.35), (0.03, 0.035, 0.18), bevel_w=0.006)
        for az in (-wheelbase, wheelbase):
            add_cyl_to_bm(bm_t, (s * 0.78, 0.40, az), 0.41, 0.41, 0.34, segs=18, axis='X')
    add_box_to_bm(bm_t, (0.0, 0.30, -2.23), (1.68, 0.16, 0.18), bevel_w=0.02)
    for fx in (-0.36, -0.18, 0.0, 0.18, 0.36):
        add_box_to_bm(bm_t, (fx, 0.28, -2.27), (0.025, 0.13, 0.16), bevel_w=0.005)
    add_box_to_bm(bm_t, (0.0, 0.24, 0.0), (1.52, 0.08, 4.10))
    add_box_to_bm(bm_t, (0.0, 0.94, 0.58), (1.36, 0.22, 0.44), bevel_w=0.03)
    add_box_to_bm(bm_t, (0.0, 0.78, -0.10), (0.24, 0.26, 1.32), bevel_w=0.02)
    for sx in (-0.38, 0.38):
        add_box_to_bm(bm_t, (sx, 0.96, -0.22), (0.42, 0.56, 0.14), rot=(-0.22, 0, 0), bevel_w=0.035)
        add_box_to_bm(bm_t, (sx, 1.26, -0.30), (0.20, 0.18, 0.10), bevel_w=0.025)
    for ex in (-0.64, -0.50, 0.50, 0.64):
        add_cyl_to_bm(bm_t, (ex, 0.30, -2.29), 0.048, 0.048, 0.14, segs=14, axis='Z')
    bmesh.ops.recalc_face_normals(bm_t, faces=bm_t.faces)
    m_t = bpy.data.meshes.new('trim')
    bm_t.to_mesh(m_t)
    bm_t.free()
    trim_obj = link_obj('trim', m_t, m_trim)
    set_smooth(trim_obj)

    bm_h = bmesh.new()
    for s in (-1, 1):
        add_box_to_bm(bm_h, (s * 0.69, 0.68, 2.15), (0.36, 0.075, 0.16), rot=(0.06, s * 0.34, 0), bevel_w=0.015)
        add_box_to_bm(bm_h, (s * 0.73, 0.63, 2.18), (0.32, 0.026, 0.08), rot=(0.04, s * 0.34, 0), bevel_w=0.005)
    bmesh.ops.recalc_face_normals(bm_h, faces=bm_h.faces)
    m_h = bpy.data.meshes.new('head')
    bm_h.to_mesh(m_h)
    bm_h.free()
    set_smooth(link_obj('head', m_h, m_head))

    bm_r = bmesh.new()
    add_box_to_bm(bm_r, (0.0, 0.84, -2.24), (1.58, 0.048, 0.08), bevel_w=0.012)
    for s in (-1, 1):
        add_box_to_bm(bm_r, (s * 0.72, 0.84, -2.21), (0.32, 0.085, 0.14), rot=(0, -s * 0.25, 0), bevel_w=0.015)
    bmesh.ops.recalc_face_normals(bm_r, faces=bm_r.faces)
    m_r = bpy.data.meshes.new('rear')
    bm_r.to_mesh(m_r)
    bm_r.free()
    set_smooth(link_obj('rear', m_r, m_rear))

    def make_wheel(name, side_sign):
        bm_w = bmesh.new()
        segs = 28
        r_out = 0.365
        r_in = 0.245
        half_w = 0.135
        profile = [
            (r_in, -half_w * 0.90), (r_out * 0.93, -half_w), (r_out, -half_w * 0.78),
            (r_out,  half_w * 0.78), (r_out * 0.93,  half_w), (r_in,  half_w * 0.90),
            (r_in * 0.92, half_w * 0.65), (r_in * 0.92, -half_w * 0.65),
        ]
        rings = []
        for i in range(segs):
            ang = 2 * math.pi * i / segs
            ca, sa = math.cos(ang), math.sin(ang)
            rings.append([bm_w.verts.new(pt(xw, r * ca, r * sa)) for r, xw in profile])
        for i in range(segs):
            r0, r1 = rings[i], rings[(i + 1) % segs]
            for j in range(len(profile)):
                jn = (j + 1) % len(profile)
                bm_w.faces.new((r0[j], r1[j], r1[jn], r0[jn]))
        bmesh.ops.recalc_face_normals(bm_w, faces=bm_w.faces)
        mt = bpy.data.meshes.new(name + '_tire')
        bm_w.to_mesh(mt)
        bm_w.free()
        tire_obj = link_obj(name + '_tire', mt, m_rubber)
        set_smooth(tire_obj)

        bm_rim = bmesh.new()
        add_cyl_to_bm(bm_rim, (0.0, 0.0, 0.0), 0.242, 0.242, 0.21, segs=24, axis='X')
        add_cyl_to_bm(bm_rim, (side_sign * 0.06, 0.0, 0.0), 0.072, 0.055, 0.07, segs=16, axis='X')
        for k in range(10):
            ang = 2 * math.pi * k / 10.0
            cy = math.cos(ang) * 0.145
            cz = math.sin(ang) * 0.145
            mat_s = Matrix.Translation(pt(side_sign * 0.088, cy, cz)) @ Euler((ang, 0, 0), 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((0.026, 0.024, 0.175, 1.0))
            bmesh.ops.create_cube(bm_rim, size=1.0, matrix=mat_s)
        bmesh.ops.recalc_face_normals(bm_rim, faces=bm_rim.faces)
        mr = bpy.data.meshes.new(name + '_rim')
        bm_rim.to_mesh(mr)
        bm_rim.free()
        rim_obj = link_obj(name + '_rim', mr, m_chrome)
        set_smooth(rim_obj)

        bpy.ops.object.select_all(action='DESELECT')
        tire_obj.select_set(True)
        rim_obj.select_set(True)
        bpy.context.view_layer.objects.active = tire_obj
        bpy.ops.object.join()
        tire_obj.name = name
        return tire_obj

    make_wheel('wheel_l', -1)
    make_wheel('wheel_r', 1)

    for name, s in (('caliper_l', -1), ('caliper_r', 1)):
        bm_c = bmesh.new()
        add_box_to_bm(bm_c, (s * 0.03, 0.04, -0.15), (0.09, 0.15, 0.08), bevel_w=0.015)
        bmesh.ops.recalc_face_normals(bm_c, faces=bm_c.faces)
        mc = bpy.data.meshes.new(name)
        bm_c.to_mesh(mc)
        bm_c.free()
        set_smooth(link_obj(name, mc, m_caliper))

    export_glb('hero-gt.glb')


# -------------------------------------------------------------
# 2. ORNATE QUZHOU WATERFRONT STREET LAMP (street-lamp.glb)
# -------------------------------------------------------------
def build_street_lamp():
    clear_scene()
    m_iron = make_mat('lamp_iron', (0.09, 0.11, 0.13, 1.0), metallic=0.80, roughness=0.32)
    m_bronze = make_mat('lamp_bronze', (0.52, 0.39, 0.22, 1.0), metallic=0.85, roughness=0.26)
    m_glow = make_mat('lamp_glow', (1.0, 0.88, 0.62, 1.0), metallic=0.0, roughness=0.16, emissive=(1.0, 0.72, 0.34), emissive_strength=5.2)

    bm_i = bmesh.new()
    add_cyl_to_bm(bm_i, (0, 0.14, 0), 0.30, 0.26, 0.28, segs=8, axis='Y')
    add_cyl_to_bm(bm_i, (0, 0.42, 0), 0.23, 0.17, 0.30, segs=8, axis='Y')
    add_cyl_to_bm(bm_i, (0, 0.76, 0), 0.15, 0.12, 0.42, segs=12, axis='Y')
    add_cyl_to_bm(bm_i, (0, 2.55, 0), 0.105, 0.068, 3.25, segs=14, axis='Y')
    pts = [(0.0, 4.05), (0.14, 4.55), (0.46, 4.92), (0.94, 5.06), (1.38, 4.96), (1.68, 4.72)]
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        ang = math.atan2(dx, dy)
        mat_t = Matrix.Translation(pt((x0 + x1) * 0.5, (y0 + y1) * 0.5, 0)) @ Euler((0, ang, 0), 'XYZ').to_matrix().to_4x4()
        bmesh.ops.create_cone(bm_i, cap_ends=True, segments=10, radius1=0.052, radius2=0.044, depth=L * 1.08, matrix=mat_t)
    lx, ly = 1.68, 4.62
    add_cyl_to_bm(bm_i, (lx, ly + 0.14, 0), 0.38, 0.16, 0.15, segs=6, axis='Y')
    add_cyl_to_bm(bm_i, (lx, ly + 0.25, 0), 0.14, 0.03, 0.12, segs=6, axis='Y')
    add_cyl_to_bm(bm_i, (lx, ly - 0.32, 0), 0.11, 0.21, 0.10, segs=6, axis='Y')
    add_cyl_to_bm(bm_i, (lx, ly - 0.42, 0), 0.02, 0.08, 0.12, segs=6, axis='Y')
    for k in range(6):
        a = k * math.pi / 3.0
        add_cyl_to_bm(bm_i, (lx + math.cos(a) * 0.22, ly - 0.10, math.sin(a) * 0.22), 0.015, 0.018, 0.38, segs=6, axis='Y')
    bmesh.ops.recalc_face_normals(bm_i, faces=bm_i.faces)
    mi = bpy.data.meshes.new('lamp_iron')
    bm_i.to_mesh(mi)
    bm_i.free()
    set_smooth(link_obj('lamp_iron', mi, m_iron))

    bm_b = bmesh.new()
    for ry, rr in [(0.58, 0.21), (0.98, 0.14), (2.30, 0.115), (4.05, 0.10)]:
        add_cyl_to_bm(bm_b, (0, ry, 0), rr, rr, 0.06, segs=14, axis='Y')
    add_cyl_to_bm(bm_b, (lx, ly + 0.34, 0), 0.04, 0.01, 0.12, segs=8, axis='Y')
    bmesh.ops.recalc_face_normals(bm_b, faces=bm_b.faces)
    mb = bpy.data.meshes.new('lamp_bronze')
    bm_b.to_mesh(mb)
    bm_b.free()
    set_smooth(link_obj('lamp_bronze', mb, m_bronze))

    bm_g = bmesh.new()
    add_cyl_to_bm(bm_g, (lx, ly - 0.10, 0), 0.18, 0.23, 0.36, segs=6, axis='Y')
    bmesh.ops.recalc_face_normals(bm_g, faces=bm_g.faces)
    mg = bpy.data.meshes.new('lamp_glow')
    bm_g.to_mesh(mg)
    bm_g.free()
    set_smooth(link_obj('lamp_glow', mg, m_glow))

    export_glb('street-lamp.glb')


# -------------------------------------------------------------
# 3. SCULPTED ANCIENT CAMPHOR TREE (tree-camphor.glb)
# -------------------------------------------------------------
def build_camphor_tree():
    clear_scene()
    m_bark = make_mat('tree_bark', (0.29, 0.22, 0.17, 1.0), metallic=0.0, roughness=0.92)
    m_leaf = make_mat('tree_foliage', (0.34, 0.50, 0.24, 1.0), metallic=0.0, roughness=0.64, use_vcol=True)

    rng = np.random.default_rng(202605)
    bm_bark = bmesh.new()

    def add_branch(pts_rad, segs=8):
        rings = []
        for i, (p, rad) in enumerate(pts_rad):
            p_v = pt(*p)
            if i < len(pts_rad) - 1:
                tang = (pt(*pts_rad[i + 1][0]) - p_v).normalized()
            else:
                tang = (p_v - pt(*pts_rad[i - 1][0])).normalized()
            up = Vector((0, 0, 1)) if abs(tang.z) < 0.9 else Vector((1, 0, 0))
            u = tang.cross(up).normalized()
            v = tang.cross(u).normalized()
            ring = []
            for s in range(segs):
                a = 2 * math.pi * s / segs
                flute = 1.0 + (0.18 * math.sin(4 * a) if i == 0 else 0.05 * math.sin(3 * a + i))
                pos = p_v + (u * math.cos(a) + v * math.sin(a)) * (rad * flute)
                ring.append(bm_bark.verts.new(pos))
            rings.append(ring)
        for i in range(len(rings) - 1):
            r0, r1 = rings[i], rings[i + 1]
            for s in range(segs):
                sn = (s + 1) % segs
                bm_bark.faces.new((r0[s], r0[sn], r1[sn], r1[s]))
        bm_bark.faces.new(rings[-1])

    add_branch([
        ((0.0, -0.02, 0.0), 0.088),
        ((0.012, 0.08, 0.008), 0.056),
        ((0.024, 0.22, -0.010), 0.048),
        ((0.010, 0.36, -0.018), 0.042),
        ((-0.006, 0.48, 0.006), 0.034),
    ], segs=10)

    canopy_centers = []
    for k in range(6):
        ang = k * (2 * math.pi / 6.0) + rng.uniform(-0.22, 0.22)
        y_start = 0.36 + (k % 3) * 0.055
        reach = 0.28 + (k % 2) * 0.09
        y_end = 0.66 + (k % 3) * 0.07
        dx, dz = math.cos(ang), math.sin(ang)
        add_branch([
            ((dx * 0.015, y_start, dz * 0.015), 0.029),
            ((dx * reach * 0.48, (y_start + y_end) * 0.48, dz * reach * 0.48), 0.022),
            ((dx * reach, y_end, dz * reach), 0.013),
            ((dx * reach * 1.24, y_end + 0.07, dz * reach * 1.24), 0.007),
        ], segs=7)
        canopy_centers.append((dx * reach * 1.05, y_end + 0.06, dz * reach * 1.05, 0.21 + rng.uniform(-0.02, 0.03)))
        ang2 = ang + (0.48 if k % 2 == 0 else -0.48)
        dx2, dz2 = math.cos(ang2), math.sin(ang2)
        add_branch([
            ((dx * reach * 0.50, (y_start + y_end) * 0.50, dz * reach * 0.50), 0.017),
            ((dx * reach * 0.50 + dx2 * 0.16, y_end + 0.09, dz * reach * 0.50 + dz2 * 0.16), 0.008),
        ], segs=6)
        canopy_centers.append((dx * reach * 0.52 + dx2 * 0.17, y_end + 0.11, dz * reach * 0.52 + dz2 * 0.17, 0.185))

    canopy_centers.extend([
        (0.0, 0.88, 0.0, 0.24),
        (0.11, 0.83, -0.09, 0.20),
        (-0.12, 0.81, 0.08, 0.20),
        (0.04, 0.72, 0.14, 0.19),
        (-0.08, 0.74, -0.14, 0.19),
    ])

    bmesh.ops.recalc_face_normals(bm_bark, faces=bm_bark.faces)
    m_b = bpy.data.meshes.new('tree_bark')
    bm_bark.to_mesh(m_b)
    bm_bark.free()
    set_smooth(link_obj('tree_bark', m_b, m_bark))

    bm_leaf = bmesh.new()
    for cx, cy, cz, rad in canopy_centers:
        for sub in range(3):
            ox = cx + rng.uniform(-0.07, 0.07)
            oy = cy + rng.uniform(-0.04, 0.05)
            oz = cz + rng.uniform(-0.07, 0.07)
            r_s = rad * rng.uniform(0.68, 0.92)
            ret = bmesh.ops.create_icosphere(
                bm_leaf, subdivisions=2, radius=r_s,
                matrix=Matrix.Translation(pt(ox, oy, oz)) @ Matrix.Diagonal((1.12, 1.12, 0.76, 1.0))
            )
            for v in ret['verts']:
                p = v.co
                n_val = math.sin(p.x * 26.0 + p.y * 19.0) * math.cos(p.z * 23.0 - p.x * 15.0)
                v.co += (v.co - pt(ox, oy, oz)).normalized() * (r_s * 0.14 * n_val)

    bmesh.ops.recalc_face_normals(bm_leaf, faces=bm_leaf.faces)
    m_f = bpy.data.meshes.new('tree_foliage')
    bm_leaf.to_mesh(m_f)
    bm_leaf.free()

    col_attr = m_f.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    verts = m_f.vertices
    for poly in m_f.polygons:
        for li in poly.loop_indices:
            v = verts[m_f.loops[li].vertex_index]
            h = max(0.0, min(1.0, (v.co.z - 0.48) / 0.56))
            r_out = max(0.0, min(1.0, math.hypot(v.co.x, v.co.y) / 0.48))
            ao = 0.44 + 0.56 * (h * 0.72 + r_out * 0.28)
            sun_tip = max(0.0, h - 0.50) * 0.48
            r = min(1.0, (0.30 + sun_tip * 0.46) * ao + 0.04)
            g = min(1.0, (0.50 + sun_tip * 0.36) * ao + 0.06)
            b = min(1.0, (0.22 + sun_tip * 0.12) * ao + 0.03)
            col_attr.data[li].color = (r, g, b, 1.0)

    set_smooth(link_obj('tree_foliage', m_f, m_leaf))
    export_glb('tree-camphor.glb')


# -------------------------------------------------------------
# 4. WATERFRONT TEAK & CAST-IRON BENCH (bench-promenade.glb)
# -------------------------------------------------------------
def build_promenade_bench():
    clear_scene()
    m_iron = make_mat('bench_iron', (0.10, 0.13, 0.15, 1.0), metallic=0.78, roughness=0.34)
    m_teak = make_mat('bench_teak', (0.48, 0.31, 0.18, 1.0), metallic=0.05, roughness=0.54)

    bm_i = bmesh.new()
    for zs in (-1.12, 0.0, 1.12):
        add_box_to_bm(bm_i, (0.24, 0.24, zs), (0.065, 0.48, 0.07), rot=(0, 0, -0.08), bevel_w=0.012)
        add_box_to_bm(bm_i, (-0.28, 0.24, zs), (0.065, 0.48, 0.07), rot=(0, 0, 0.12), bevel_w=0.012)
        add_box_to_bm(bm_i, (-0.02, 0.44, zs), (0.60, 0.06, 0.07), bevel_w=0.012)
        add_box_to_bm(bm_i, (-0.34, 0.72, zs), (0.06, 0.56, 0.065), rot=(0, 0, 0.22), bevel_w=0.012)
        if zs != 0.0:
            add_box_to_bm(bm_i, (0.0, 0.68, zs), (0.56, 0.048, 0.065), bevel_w=0.012)
            add_box_to_bm(bm_i, (0.24, 0.56, zs), (0.055, 0.24, 0.065), bevel_w=0.010)
    bmesh.ops.recalc_face_normals(bm_i, faces=bm_i.faces)
    mi = bpy.data.meshes.new('bench_iron')
    bm_i.to_mesh(mi)
    bm_i.free()
    set_smooth(link_obj('bench_iron', mi, m_iron))

    bm_t = bmesh.new()
    for i in range(6):
        x = -0.24 + i * 0.098
        y = 0.49 + 0.015 * math.sin(i * 0.6)
        add_box_to_bm(bm_t, (x, y, 0.0), (0.080, 0.036, 2.76), bevel_w=0.008)
    for i in range(4):
        x = -0.31 - i * 0.030
        y = 0.65 + i * 0.095
        add_box_to_bm(bm_t, (x, y, 0.0), (0.034, 0.076, 2.76), rot=(0, 0, 0.22), bevel_w=0.008)
    bmesh.ops.recalc_face_normals(bm_t, faces=bm_t.faces)
    mt = bpy.data.meshes.new('bench_teak')
    bm_t.to_mesh(mt)
    bm_t.free()
    set_smooth(link_obj('bench_teak', mt, m_teak))
    export_glb('bench-promenade.glb')


# -------------------------------------------------------------
# 5. TRADITIONAL CHINESE FLYING-EAVE GATE PAVILION (shuitingmen-pavilion.glb)
# -------------------------------------------------------------
def build_eave_roof_bm(bm, base_y, w, d, h, flare=1.35, curve_up=0.85):
    nx, nz = 12, 8
    grid = []
    for iz in range(nz + 1):
        vz = iz / nz
        row = []
        for ix in range(nx + 1):
            vx = ix / nx
            ux = (vx - 0.5) * 2.0
            uz = (vz - 0.5) * 2.0
            edge_t = max(abs(ux) * 0.72, abs(uz))
            y = base_y + h * ((1.0 - edge_t) ** 1.45)
            corner = max(0.0, (abs(ux) * abs(uz) - 0.45) / 0.55) ** 1.8
            y += corner * curve_up
            x = ux * (w * 0.5) * (1.0 + (flare - 1.0) * (edge_t ** 1.5))
            z = uz * (d * 0.5) * (1.0 + (flare - 1.0) * (edge_t ** 1.5))
            row.append(bm.verts.new(pt(x, y, z)))
        grid.append(row)
    for iz in range(nz):
        for ix in range(nx):
            bm.faces.new((grid[iz][ix], grid[iz][ix + 1], grid[iz + 1][ix + 1], grid[iz + 1][ix]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.28)


def build_shuitingmen_pavilion():
    clear_scene()
    m_tile = make_mat('pav_tile', (0.14, 0.17, 0.21, 1.0), metallic=0.18, roughness=0.44)
    m_red = make_mat('pav_red', (0.58, 0.14, 0.11, 1.0), metallic=0.08, roughness=0.40, coat=0.35, coat_rough=0.25)
    m_gold = make_mat('pav_gold', (0.84, 0.64, 0.26, 1.0), metallic=0.80, roughness=0.26)
    m_glow = make_mat('pav_glow', (1.0, 0.80, 0.44, 1.0), metallic=0.0, roughness=0.18, emissive=(1.0, 0.64, 0.26), emissive_strength=3.6)

    bm_roof = bmesh.new()
    build_eave_roof_bm(bm_roof, 4.35, 22.4, 13.6, 2.3, flare=1.12, curve_up=0.95)
    build_eave_roof_bm(bm_roof, 8.20, 17.6, 10.6, 3.6, flare=1.15, curve_up=1.25)
    bmesh.ops.recalc_face_normals(bm_roof, faces=bm_roof.faces)
    mr = bpy.data.meshes.new('pav_tile')
    bm_roof.to_mesh(mr)
    bm_roof.free()
    set_smooth(link_obj('pav_tile', mr, m_tile))

    bm_red = bmesh.new()
    add_box_to_bm(bm_red, (0, 2.2, 0), (15.4, 4.4, 8.2), bevel_w=0.06)
    add_box_to_bm(bm_red, (0, 6.7, 0), (12.0, 3.2, 6.6), bevel_w=0.06)
    for ix in (-8.6, -5.2, -1.8, 1.8, 5.2, 8.6):
        for iz in (-5.0, 5.0):
            add_cyl_to_bm(bm_red, (ix, 2.25, iz), 0.30, 0.27, 4.5, segs=12, axis='Y')
    for ix in (-6.6, -3.3, 0.0, 3.3, 6.6):
        for iz in (-3.9, 3.9):
            add_cyl_to_bm(bm_red, (ix, 6.8, iz), 0.24, 0.22, 3.2, segs=12, axis='Y')
    for iz in (-4.4, 4.4):
        add_box_to_bm(bm_red, (0, 5.65, iz), (14.4, 0.16, 0.16), bevel_w=0.02)
    bmesh.ops.recalc_face_normals(bm_red, faces=bm_red.faces)
    mred = bpy.data.meshes.new('pav_red')
    bm_red.to_mesh(mred)
    bm_red.free()
    set_smooth(link_obj('pav_red', mred, m_red))

    bm_gold = bmesh.new()
    add_box_to_bm(bm_gold, (0, 11.95, 0), (11.2, 0.42, 0.38), bevel_w=0.05)
    for s in (-1, 1):
        add_box_to_bm(bm_gold, (s * 5.7, 12.45, 0), (0.65, 1.05, 0.42), bevel_w=0.06)
    for x in np.linspace(-8.2, 8.2, 11):
        for z in (-5.1, 5.1):
            add_box_to_bm(bm_gold, (float(x), 4.25, z), (0.34, 0.36, 0.56), bevel_w=0.03)
    for x in np.linspace(-6.4, 6.4, 9):
        for z in (-4.0, 4.0):
            add_box_to_bm(bm_gold, (float(x), 8.15, z), (0.30, 0.32, 0.48), bevel_w=0.03)
    for z in (-5.22, 5.22):
        add_box_to_bm(bm_gold, (0, 3.65, z), (3.6, 1.35, 0.18), bevel_w=0.04)
    bmesh.ops.recalc_face_normals(bm_gold, faces=bm_gold.faces)
    mgold = bpy.data.meshes.new('pav_gold')
    bm_gold.to_mesh(mgold)
    bm_gold.free()
    set_smooth(link_obj('pav_gold', mgold, m_gold))

    bm_gl = bmesh.new()
    for ix in (-5.2, -2.6, 0.0, 2.6, 5.2):
        for iz in (-4.18, 4.18):
            add_box_to_bm(bm_gl, (ix, 2.15, iz), (1.45, 2.25, 0.12))
    for ix in (-3.6, 0.0, 3.6):
        for iz in (-3.38, 3.38):
            add_box_to_bm(bm_gl, (ix, 6.75, iz), (1.35, 1.65, 0.12))
    for sx in (-1, 1):
        for sz in (-1, 1):
            add_cyl_to_bm(bm_gl, (sx * 10.6, 3.9, sz * 6.4), 0.32, 0.36, 0.72, segs=10, axis='Y')
            add_cyl_to_bm(bm_gl, (sx * 8.4, 7.8, sz * 5.0), 0.28, 0.32, 0.62, segs=10, axis='Y')
    bmesh.ops.recalc_face_normals(bm_gl, faces=bm_gl.faces)
    mgl = bpy.data.meshes.new('pav_glow')
    bm_gl.to_mesh(mgl)
    bm_gl.free()
    set_smooth(link_obj('pav_glow', mgl, m_glow))

    export_glb('shuitingmen-pavilion.glb')


# -------------------------------------------------------------
# 6. TIANWANG 7-TIER OCTAGONAL PAGODA (tianwang-pagoda.glb)
# -------------------------------------------------------------
def build_tianwang_pagoda():
    clear_scene()
    m_brick = make_mat('pag_brick', (0.70, 0.65, 0.58, 1.0), metallic=0.0, roughness=0.84)
    m_tile = make_mat('pag_tile', (0.14, 0.18, 0.22, 1.0), metallic=0.16, roughness=0.45)
    m_wood = make_mat('pag_wood', (0.48, 0.16, 0.12, 1.0), metallic=0.06, roughness=0.48)
    m_gold = make_mat('pag_gold', (0.86, 0.67, 0.28, 1.0), metallic=0.88, roughness=0.22)
    m_glow = make_mat('pag_glow', (1.0, 0.82, 0.45, 1.0), metallic=0.0, roughness=0.18, emissive=(1.0, 0.66, 0.24), emissive_strength=4.0)

    bm_br = bmesh.new()
    bm_ti = bmesh.new()
    bm_wd = bmesh.new()
    bm_go = bmesh.new()
    bm_gl = bmesh.new()

    add_cyl_to_bm(bm_br, (0, 0.8, 0), 8.2, 7.8, 1.6, segs=8, axis='Y')
    add_cyl_to_bm(bm_br, (0, 2.2, 0), 6.9, 6.6, 1.4, segs=8, axis='Y')

    cur_y = 2.9
    for tier in range(7):
        r_core = 5.4 - tier * 0.48
        h_core = 4.6 - tier * 0.24
        r_eave = r_core + 1.85 - tier * 0.11
        add_cyl_to_bm(bm_br, (0, cur_y + h_core * 0.5, 0), r_core, r_core * 0.96, h_core, segs=8, axis='Y')
        for k in range(8):
            a = k * math.pi / 4.0 + math.pi / 8.0
            add_cyl_to_bm(bm_wd, (math.cos(a) * (r_core + 0.12), cur_y + h_core * 0.5, math.sin(a) * (r_core + 0.12)),
                          0.18, 0.16, h_core, segs=8, axis='Y')
        for k in range(4):
            a = k * math.pi / 2.0
            nx, nz = math.cos(a) * (r_core * 0.95), math.sin(a) * (r_core * 0.95)
            add_box_to_bm(bm_gl, (nx, cur_y + h_core * 0.48, nz), (0.95 - tier * 0.06, h_core * 0.52, 0.95 - tier * 0.06))
        y_eave = cur_y + h_core
        segs = 8
        r_ring_inner = [bm_ti.verts.new(pt(math.cos(k * math.pi / 4) * r_core * 0.92, y_eave + 0.92, math.sin(k * math.pi / 4) * r_core * 0.92)) for k in range(segs)]
        r_ring_mid = [bm_ti.verts.new(pt(math.cos(k * math.pi / 4) * (r_core + r_eave) * 0.5, y_eave + 0.22, math.sin(k * math.pi / 4) * (r_core + r_eave) * 0.5)) for k in range(segs)]
        r_ring_out = [bm_ti.verts.new(pt(math.cos(k * math.pi / 4) * r_eave, y_eave + 0.58, math.sin(k * math.pi / 4) * r_eave)) for k in range(segs)]
        for k in range(segs):
            kn = (k + 1) % segs
            bm_ti.faces.new((r_ring_inner[k], r_ring_inner[kn], r_ring_mid[kn], r_ring_mid[k]))
            bm_ti.faces.new((r_ring_mid[k], r_ring_mid[kn], r_ring_out[kn], r_ring_out[k]))
        if tier < 5:
            for k in range(0, 8, 2):
                a = k * math.pi / 4.0
                add_cyl_to_bm(bm_gl, (math.cos(a) * (r_eave - 0.15), y_eave - 0.18, math.sin(a) * (r_eave - 0.15)), 0.18, 0.22, 0.42, segs=8, axis='Y')
        cur_y += h_core + 0.58

    add_cyl_to_bm(bm_ti, (0, cur_y + 1.4, 0), 2.8, 0.35, 2.8, segs=8, axis='Y')
    add_cyl_to_bm(bm_go, (0, cur_y + 3.0, 0), 0.72, 0.45, 0.7, segs=12, axis='Y')
    add_cyl_to_bm(bm_go, (0, cur_y + 4.8, 0), 0.22, 0.06, 3.4, segs=10, axis='Y')
    for ry in (3.7, 4.3, 4.9, 5.5):
        add_cyl_to_bm(bm_go, (0, cur_y + ry, 0), 0.48 - (ry - 3.7) * 0.12, 0.48 - (ry - 3.7) * 0.12, 0.12, segs=12, axis='Y')

    bmesh.ops.solidify(bm_ti, geom=bm_ti.faces[:], thickness=0.22)
    for bm, name, mat in ((bm_br, 'pag_brick', m_brick), (bm_ti, 'pag_tile', m_tile),
                          (bm_wd, 'pag_wood', m_wood), (bm_go, 'pag_gold', m_gold), (bm_gl, 'pag_glow', m_glow)):
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        m = bpy.data.meshes.new(name)
        bm.to_mesh(m)
        bm.free()
        set_smooth(link_obj(name, m, mat))
    export_glb('tianwang-pagoda.glb')


# -------------------------------------------------------------
# 7. HIGH-RES 1024x1024 SEAMLESS PBR TEXTURE SUITE (assets/pbr/)
# -------------------------------------------------------------
def periodic_noise(size, freqs, weights, seed):
    rng = np.random.default_rng(seed)
    grid = np.zeros((size, size), dtype=np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    for freq, w in zip(freqs, weights):
        base = rng.random((freq, freq)).astype(np.float32)
        fx = (xx / size) * freq
        fy = (yy / size) * freq
        ix = np.floor(fx).astype(np.int32) % freq
        iy = np.floor(fy).astype(np.int32) % freq
        tx = fx - np.floor(fx)
        ty = fy - np.floor(fy)
        sx = tx * tx * (3.0 - 2.0 * tx)
        sy = ty * ty * (3.0 - 2.0 * ty)
        ix1 = (ix + 1) % freq
        iy1 = (iy + 1) % freq
        v00 = base[iy, ix]
        v10 = base[iy, ix1]
        v01 = base[iy1, ix]
        v11 = base[iy1, ix1]
        interp = (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy
        grid += interp * w
    grid = (grid - grid.min()) / max(1e-6, (grid.max() - grid.min()))
    return grid


def height_to_normal(h, strength=4.0):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nz = np.ones_like(h)
    length = np.sqrt(dx * dx + dy * dy + nz * nz)
    nx = (-dx / length) * 0.5 + 0.5
    ny = (-dy / length) * 0.5 + 0.5
    nz = (nz / length) * 0.5 + 0.5
    return np.stack([nx, ny, nz], axis=-1)


def save_png(arr_rgb, filename, srgb=True):
    h, w, _ = arr_rgb.shape
    img = bpy.data.images.new(filename, width=w, height=h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(arr_rgb, 0.0, 1.0)
    img.pixels.foreach_set(rgba[::-1].ravel())
    path = os.path.join(PBR_DIR, filename)
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    print(f'SAVED PBR {filename}: {os.path.getsize(path) / 1024:.1f} KB')


def build_pbr_textures():
    N = 1024
    n_coarse = periodic_noise(N, [4, 8, 16], [0.55, 0.30, 0.15], 101)
    n_med = periodic_noise(N, [32, 64], [0.6, 0.4], 102)
    n_fine = periodic_noise(N, [128, 256], [0.55, 0.45], 103)
    h_asphalt = n_coarse * 0.25 + n_med * 0.35 + n_fine * 0.40
    base_l = 0.24 + n_coarse * 0.08 + n_med * 0.07 + (n_fine - 0.5) * 0.16
    asph_rgb = np.stack([base_l * 0.96, base_l * 0.99, base_l * 1.05], axis=-1)
    save_png(asph_rgb, 'asphalt_albedo.png', True)
    save_png(height_to_normal(h_asphalt, strength=9.5), 'asphalt_normal.png', False)

    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    rows, cols = 8, 4
    row_idx = np.floor(yy / (N / rows)).astype(np.int32)
    x_off = (xx + (row_idx % 2) * (N / cols * 0.5)) % N
    col_idx = np.floor(x_off / (N / cols)).astype(np.int32)
    u_cell = (x_off % (N / cols)) / (N / cols)
    v_cell = (yy % (N / rows)) / (N / rows)
    edge_x = np.minimum(u_cell, 1.0 - u_cell)
    edge_y = np.minimum(v_cell, 1.0 - v_cell)
    groove = np.clip(np.minimum(edge_x * 26.0, edge_y * 16.0), 0.0, 1.0)
    stone_grain = periodic_noise(N, [16, 48, 128, 256], [0.35, 0.30, 0.20, 0.15], 201)
    tile_var = ((row_idx * 17 + col_idx * 31) % 13) / 13.0
    h_stone = groove * (0.72 + stone_grain * 0.28) + (1.0 - groove) * 0.12
    st_base = (0.34 + tile_var * 0.10 + (stone_grain - 0.5) * 0.14) * (0.48 + 0.52 * groove)
    stone_rgb = np.stack([st_base * 0.90, st_base * 0.96, st_base * 1.02], axis=-1)
    save_png(stone_rgb, 'bluestone_albedo.png', True)
    save_png(height_to_normal(h_stone, strength=12.0), 'bluestone_normal.png', False)

    h_plaster = periodic_noise(N, [6, 16, 48, 128], [0.45, 0.30, 0.15, 0.10], 301)
    save_png(height_to_normal(h_plaster, strength=5.0), 'plaster_normal.png', False)


if __name__ == '__main__':
    build_hero_gt()
    build_street_lamp()
    build_camphor_tree()
    build_promenade_bench()
    build_shuitingmen_pavilion()
    build_tianwang_pagoda()
    build_pbr_textures()
    print('ALL_AAA_ASSETS_COMPLETE')
