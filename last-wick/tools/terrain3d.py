"""3D-rendered terrain for rooms (Blender Cycles). python3 terrain3d.py [--samples N] roomid ..."""
import sys, os, json, math, random
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, cv2
from PIL import Image
import bpy, bmesh
from mathutils import Vector
import bl, world
import terrain as T2

U = 100.0  # px per blender unit
OUT = T2.OUT

def shape(r):
    """Organic solid mask S, inside distance dd, grid g."""
    P = T2.PAL[r.area]; seed = int(__import__('hashlib').md5(r.id.encode()).hexdigest()[:6], 16)
    g = T2.grid_of(r); H, W = g.shape[0] * T2.T, g.shape[1] * T2.T
    solid = np.kron((g == '#').astype(np.uint8), np.ones((T2.T, T2.T), np.uint8))
    d_in = cv2.distanceTransform(solid, cv2.DIST_L2, 5); d_out = cv2.distanceTransform(1 - solid, cv2.DIST_L2, 5)
    sdf = cv2.GaussianBlur(d_in - d_out, (0, 0), 6)
    sdf = sdf + (T2.fbm(H, W, 90, 4, seed) - 0.5) * 16 + (T2.fbm(H, W, 22, 3, seed + 1) - 0.5) * 6
    S = (sdf > 0).astype(np.uint8)
    S = cv2.morphologyEx(S, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    dd = cv2.distanceTransform(S, cv2.DIST_L2, 5)
    return g, S, dd, sdf, seed, W, H

def px2w(x, y, W, H):  # image px -> world (x, z)
    return (x - W / 2) / U, (H / 2 - y) / U

def relief(S, dd, W, H, seed, step=6):
    hs = T2.smoothstep(0, 60, dd) * 0.55 + T2.smoothstep(40, 300, dd) * 0.5
    nz = (T2.fbm(H, W, 70, 4, seed + 20) - 0.5) * 0.35 * T2.smoothstep(0, 30, dd)
    h = cv2.GaussianBlur((hs + nz).astype(np.float32), (0, 0), 3)
    Sd = cv2.dilate(S, np.ones((step * 2 + 3, step * 2 + 3), np.uint8))
    ys = np.arange(0, H + step, step); xs = np.arange(0, W + step, step)
    ny, nx = len(ys), len(xs)
    yi = np.clip(ys, 0, H - 1); xi = np.clip(xs, 0, W - 1)
    inside = Sd[np.ix_(yi, xi)] > 0
    hh = h[np.ix_(yi, xi)]
    idx = -np.ones((ny, nx), np.int64); idx[inside] = np.arange(inside.sum())
    X, Y = np.meshgrid(xs, ys)
    vx = (X[inside] - W / 2) / U; vz = (H / 2 - Y[inside]) / U; vy = -hh[inside]
    verts = np.stack([vx, vy, vz], 1)
    a = idx[:-1, :-1]; b = idx[:-1, 1:]; c = idx[1:, 1:]; d = idx[1:, :-1]
    ok = (a >= 0) & (b >= 0) & (c >= 0) & (d >= 0)
    faces = np.stack([a[ok], d[ok], c[ok], b[ok]], 1)
    me = bpy.data.meshes.new('relief')
    me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.astype(np.float32).ravel())
    me.loops.add(faces.size); me.loops.foreach_set('vertex_index', faces.astype(np.int32).ravel())
    me.polygons.add(len(faces)); me.polygons.foreach_set('loop_start', (np.arange(len(faces)) * 4).astype(np.int32)); me.polygons.foreach_set('loop_total', np.full(len(faces), 4, np.int32))
    me.update(calc_edges=True); me.validate()
    me.polygons.foreach_set('use_smooth', np.ones(len(faces), bool))
    o = bpy.data.objects.new('relief', me); bpy.context.collection.objects.link(o)
    return o

# ---------------- materials ----------------
def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        if k in n.inputs: n.inputs[k].default_value = v
        elif hasattr(n, k): setattr(n, k, v)
    return n

def terrain_mat(area):
    m = bpy.data.materials.new('ter_' + area); nt = m.node_tree; L = nt.links
    out = nt.nodes['Material Output']; p = nt.nodes['Principled BSDF']
    tc = node(nt, 'ShaderNodeTexCoord')
    geo = node(nt, 'ShaderNodeNewGeometry')
    sep = node(nt, 'ShaderNodeSeparateXYZ'); L.new(geo.outputs['Normal'], sep.inputs[0])
    mp = node(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.35, 1.0, 2.2); L.new(tc.outputs['Object'], mp.inputs['Vector'])
    n1 = node(nt, 'ShaderNodeTexNoise', Scale=2.2, Detail=10.0, Roughness=0.6); L.new(mp.outputs['Vector'], n1.inputs['Vector'])
    vor = node(nt, 'ShaderNodeTexVoronoi', Scale=2.2); L.new(tc.outputs['Object'], vor.inputs['Vector'])
    ramp = node(nt, 'ShaderNodeValToRGB'); L.new(n1.outputs['Fac'], ramp.inputs['Fac'])
    C = {
        'crypts': [(0.05, 0.035, 0.03), (0.11, 0.08, 0.065)],
        'gardens': [(0.018, 0.035, 0.032), (0.05, 0.09, 0.075)],
        'nave': [(0.03, 0.035, 0.055), (0.08, 0.09, 0.125)],
        'spire': [(0.045, 0.03, 0.07), (0.12, 0.085, 0.18)],
        'hearth': [(0.04, 0.03, 0.028), (0.1, 0.075, 0.065)],
    }[area]
    ramp.color_ramp.elements[0].color = (*C[0], 1); ramp.color_ramp.elements[1].color = (*C[1], 1)
    ramp.color_ramp.elements[0].position = 0.2; ramp.color_ramp.elements[1].position = 0.85
    base_col = ramp.outputs['Color']
    bump_h = n1.outputs['Fac']
    # bump: noise + voronoi cracks
    mix_b = node(nt, 'ShaderNodeMath', operation='ADD'); L.new(n1.outputs['Fac'], mix_b.inputs[0]); 
    vd = node(nt, 'ShaderNodeMath', operation='MULTIPLY'); L.new(vor.outputs['Distance'], vd.inputs[0]); vd.inputs[1].default_value = 0.6
    L.new(vd.outputs[0], mix_b.inputs[1])
    bump = node(nt, 'ShaderNodeBump', Strength=0.55, Distance=0.05); L.new(mix_b.outputs[0], bump.inputs['Height'])
    if area == 'nave':
        br = node(nt, 'ShaderNodeTexBrick', Scale=1.0, Mortar_Size=0.02); br.inputs['Scale'].default_value = 1.0
        br.inputs['Mortar Size'].default_value = 0.025; br.inputs['Brick Width'].default_value = 1.0; br.inputs['Row Height'].default_value = 0.5
        br.inputs['Color1'].default_value = (*C[1], 1); br.inputs['Color2'].default_value = (*C[0], 1); br.inputs['Mortar'].default_value = (0.01, 0.01, 0.015, 1)
        L.new(tc.outputs['Object'], br.inputs['Vector'])
        mm = node(nt, 'ShaderNodeMix'); mm.data_type = 'RGBA'; mm.inputs['Factor'].default_value = 0.55
        L.new(base_col, mm.inputs[6]); L.new(br.outputs['Color'], mm.inputs[7]); base_col = mm.outputs[2]
        bb = node(nt, 'ShaderNodeMath', operation='ADD'); L.new(mix_b.outputs[0], bb.inputs[0]); L.new(br.outputs['Fac'], bb.inputs[1])
        L.new(bb.outputs[0], bump.inputs['Height']); bump.inputs['Strength'].default_value = 0.8
    L.new(base_col, p.inputs['Base Color']); L.new(bump.outputs['Normal'], p.inputs['Normal'])
    p.inputs['Roughness'].default_value = 0.85
    if area == 'hearth':
        vor2 = node(nt, 'ShaderNodeTexVoronoi', Scale=1.4); vor2.feature = 'DISTANCE_TO_EDGE'; L.new(tc.outputs['Object'], vor2.inputs['Vector'])
        cr = node(nt, 'ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.0; cr.inputs['From Max'].default_value = 0.035
        cr.inputs['To Min'].default_value = 6.0; cr.inputs['To Max'].default_value = 0.0; L.new(vor2.outputs['Distance'], cr.inputs['Value'])
        nm = node(nt, 'ShaderNodeTexNoise', Scale=0.6); L.new(tc.outputs['Object'], nm.inputs['Vector'])
        mul = node(nt, 'ShaderNodeMath', operation='MULTIPLY'); L.new(cr.outputs[0], mul.inputs[0]); L.new(nm.outputs['Fac'], mul.inputs[1])
        p.inputs['Emission Color'].default_value = (1.0, 0.32, 0.08, 1); L.new(mul.outputs[0], p.inputs['Emission Strength'])
    # top cap material via world-normal Z
    capf = node(nt, 'ShaderNodeMapRange'); L.new(sep.outputs['Z'], capf.inputs['Value'])
    capf.inputs['From Min'].default_value = 0.5; capf.inputs['From Max'].default_value = 0.85
    cn = node(nt, 'ShaderNodeTexNoise', Scale=3.0, Detail=4.0); L.new(tc.outputs['Object'], cn.inputs['Vector'])
    cm = node(nt, 'ShaderNodeMath', operation='MULTIPLY'); L.new(capf.outputs[0], cm.inputs[0]); 
    cm2 = node(nt, 'ShaderNodeMapRange'); L.new(cn.outputs['Fac'], cm2.inputs['Value']); cm2.inputs['From Min'].default_value = 0.25; cm2.inputs['From Max'].default_value = 0.42
    L.new(cm2.outputs[0], cm.inputs[1])
    cap = nt.nodes.new('ShaderNodeBsdfPrincipled')
    CAP = {'crypts': ((0.62, 0.5, 0.36), 0.5, 0.35), 'gardens': ((0.12, 0.32, 0.14), 0.0, 0.8), 'nave': ((0.06, 0.12, 0.13), 0.0, 0.5),
           'spire': ((0.55, 0.45, 0.85), 0.0, 0.15), 'hearth': ((0.18, 0.16, 0.15), 0.0, 0.95)}[area]
    cap.inputs['Base Color'].default_value = (*CAP[0], 1); cap.inputs['Subsurface Weight'].default_value = CAP[1]
    cap.inputs['Subsurface Radius'].default_value = (1, 0.5, 0.25); cap.inputs['Subsurface Scale'].default_value = 0.05
    cap.inputs['Roughness'].default_value = CAP[2]
    if area == 'gardens': cap.inputs['Sheen Weight'].default_value = 1.0; cap.inputs['Sheen Tint'].default_value = (0.5, 1, 0.7, 1)
    cb = node(nt, 'ShaderNodeBump', Strength=0.4, Distance=0.02); cnn = node(nt, 'ShaderNodeTexNoise', Scale=14.0, Detail=6.0); L.new(tc.outputs['Object'], cnn.inputs['Vector']); L.new(cnn.outputs['Fac'], cb.inputs['Height']); L.new(cb.outputs['Normal'], cap.inputs['Normal'])
    mix = nt.nodes.new('ShaderNodeMixShader'); L.new(cm.outputs[0], mix.inputs[0]); L.new(p.outputs[0], mix.inputs[1]); L.new(cap.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    return m

def mats(area):
    M = {}
    M['wax'] = bl.mat('wax', (0.92, 0.82, 0.64), rough=0.35, sss=0.6, sss_radius=(1, 0.45, 0.2), sss_scale=0.06, coat=0.2)
    M['flame'] = bl.mat('flame', (1, 0.6, 0.2), emit=(1.0, 0.55, 0.15), emit_strength=25)
    M['wick'] = bl.mat('wick', (0.02, 0.015, 0.01), rough=0.8)
    M['stone'] = bl.noise_bump(bl.mat('stone', {'crypts': (0.13, 0.1, 0.08), 'gardens': (0.07, 0.09, 0.07), 'nave': (0.1, 0.11, 0.15), 'spire': (0.25, 0.2, 0.35), 'hearth': (0.09, 0.07, 0.06)}[area], rough=0.8), 6, 0.5)
    M['wood'] = bl.noise_bump(bl.mat('wood', (0.09, 0.06, 0.04), rough=0.75), 9, 0.6)
    M['grass'] = bl.mat('grass', (0.1, 0.35, 0.16), rough=0.6, sheen=0.6)
    M['grass2'] = bl.mat('grass2', (0.18, 0.5, 0.25), rough=0.5, sheen=0.6)
    M['glowcap'] = bl.mat('glowcap', (0.4, 1, 0.8), emit=(0.35, 1.0, 0.75), emit_strength=6, sss=0.3)
    M['stem'] = bl.mat('stem', (0.75, 0.85, 0.8), rough=0.5, sss=0.5, sss_scale=0.03)
    M['vine'] = bl.mat('vine', (0.04, 0.09, 0.06), rough=0.7)
    M['crystal'] = bl.mat('crystal', (0.75, 0.6, 1.0), rough=0.08, transmission=0.6, emit=(0.6, 0.45, 1.0), emit_strength=1.5, ior=1.5, coat=1.0)
    M['ember'] = bl.mat('ember', (0.2, 0.05, 0.02), emit=(1.0, 0.3, 0.06), emit_strength=8)
    M['bone'] = bl.mat('bone', (0.75, 0.66, 0.55), rough=0.45, sss=0.2, sss_scale=0.02)
    M['thorn'] = bl.mat('thorn', (0.12, 0.05, 0.06), rough=0.35, coat=0.6)
    M['algae'] = bl.mat('algae', (0.05, 0.3, 0.35), emit=(0.2, 0.7, 1.0), emit_strength=0.8)
    M['iron'] = bl.noise_bump(bl.mat('iron', (0.12, 0.1, 0.1), rough=0.5, metal=0.9), 20, 0.4)
    return M

# ---------------- decoration builders (bmesh, merged per type) ----------------
class Batch:
    def __init__(s, name, mat): s.bm = bmesh.new(); s.name = name; s.mat = mat
    def add_mesh(s, me_obj):
        me = me_obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        mw = me_obj.matrix_world
        offs = len(s.bm.verts); vs = []
        for v in me.vertices: vs.append(s.bm.verts.new(mw @ v.co))
        s.bm.verts.ensure_lookup_table()
        for f in me.polygons:
            try: nf = s.bm.faces.new([vs[i] for i in f.vertices]); nf.smooth = True
            except ValueError: pass
        me_obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
        bpy.data.objects.remove(me_obj, do_unlink=True)
    def finish(s):
        me = bpy.data.meshes.new(s.name); s.bm.to_mesh(me); s.bm.free()
        o = bpy.data.objects.new(s.name, me); bpy.context.collection.objects.link(o); o.data.materials.append(s.mat)
        return o

def tube_obj(pts, radii, res=8, bev=6):
    o = bl.tube('tmp', pts, radii, bevel_res=bev, res=res); return o

def cone_obj(base, tip, r, verts=8):
    b, t = Vector(base), Vector(tip); d = t - b; L = d.length
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=0, depth=L, location=(b + t) / 2)
    o = bpy.context.object; o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); return o

def waxdrip(b, x, y, z, L, rr, rng):
    xs = rng.uniform(-0.015, 0.015)
    b.add_mesh(tube_obj([(x, y, z), (x + xs * 0.5, y, z - L * 0.45), (x + xs, y, z - L)], [rr * 1.25, rr * 0.75, rr * 0.55], res=10, bev=6))
    b.add_mesh(bl.sphere('bulb', (x + xs, y, z - L - rr * 0.2), (rr * 0.85, rr * 0.85, rr * 1.05), seg=12, rings=8))

def build_decor(r, g, S, dd, W, H, M, rng):
    import terrain as T2
    tops = T2.edge_points(S, dd, None, 'top', 10, rng)
    bots = T2.edge_points(S, dd, None, 'bottom', 18, rng)
    A = r.area; B = {}
    def batch(k, mat):
        if k not in B: B[k] = Batch(k, mat)
        return B[k]
    flames = []; lights = []
    Y0 = -0.08  # in front of relief edge
    def W2(x, y): return px2w(x, y, W, H)
    if A == 'crypts':
        for (x, y) in bots:
            if rng.random() < 0.55:
                wx, wz = W2(x, y - 4); L = rng.uniform(0.12, 0.75); rr = rng.uniform(0.04, 0.085)
                waxdrip(batch('drips', M['wax']), wx, Y0, wz + 0.05, L, rr, rng)
        for (x, y) in tops:
            u = rng.random()
            if u < 0.06:
                wx, wz = W2(x, y + 2); h = rng.uniform(0.15, 0.42); rr = rng.uniform(0.045, 0.075)
                o = bl.cyl('c', (wx, Y0 - 0.05, wz + h / 2 - 0.03), rr, h, verts=16); batch('candles', M['wax']).add_mesh(o)
                o = bl.tube('w', [(wx, Y0 - 0.05, wz + h - 0.03), (wx, Y0 - 0.05, wz + h + 0.06)], [0.008, 0.006]); batch('wicks', M['wick']).add_mesh(o)
                flames.append([x, y - h * U - 8, rng.uniform(2.2, 3.2)])
            elif u < 0.14:
                wx, wz = W2(x, y + 6); L = rng.uniform(0.1, 0.4); rr = rng.uniform(0.04, 0.07)
                waxdrip(batch('drips', M['wax']), wx, Y0 + 0.02, wz, L, rr, rng)
            elif u < 0.2:
                wx, wz = W2(x, y + 4); o = bl.sphere('p', (wx, Y0 + 0.04, wz), (rng.uniform(0.1, 0.22), 0.08, 0.05)); batch('pools', M['wax']).add_mesh(o)
    elif A == 'gardens':
        for (x, y) in tops:
            wx, wz = W2(x, y + 3)
            for k in range(int(rng.integers(2, 5))):
                h = rng.uniform(0.06, 0.32); bx = wx + rng.uniform(-0.05, 0.05); lean = rng.uniform(-0.12, 0.12)
                o = cone_obj((bx, Y0 + rng.uniform(-0.15, 0.05), wz - 0.02), (bx + lean, Y0, wz + h), rng.uniform(0.012, 0.022), 4)
                batch('grass' if rng.random() < 0.6 else 'grass2', M['grass'] if rng.random() < 0.6 else M['grass2']).add_mesh(o)
            if rng.random() < 0.035:
                h = rng.uniform(0.1, 0.3); cr = rng.uniform(0.06, 0.13)
                batch('stems', M['stem']).add_mesh(bl.tube('s', [(wx, Y0 - 0.05, wz - 0.02), (wx + 0.02, Y0 - 0.05, wz + h)], [0.018, 0.014]))
                o = bl.sphere('cap', (wx + 0.02, Y0 - 0.05, wz + h), (cr, cr, cr * 0.5)); batch('caps', M['glowcap']).add_mesh(o)
                lights.append([x, y - h * U, 110, [140, 255, 210]])
        for (x, y) in bots:
            if rng.random() < 0.45:
                wx, wz = W2(x, y - 2); L = rng.uniform(0.2, 1.3); pts = []
                for i in range(6): pts.append((wx + math.sin(i * 1.3 + x) * 0.04, Y0 + 0.02, wz - L * i / 5))
                batch('vines', M['vine']).add_mesh(bl.tube('v', pts, [0.022, 0.018, 0.016, 0.014, 0.012, 0.01], res=6, bev=3))
                if rng.random() < 0.4:
                    batch('caps', M['glowcap']).add_mesh(bl.sphere('b', (pts[-1][0], Y0 + 0.02, pts[-1][2]), (0.035, 0.035, 0.045)))
                    lights.append([x, y + L * U, 70, [140, 255, 210]])
    elif A == 'nave':
        for (x, y) in bots:
            if rng.random() < 0.4:
                wx, wz = W2(x, y - 4); L = rng.uniform(0.1, 0.55)
                batch('stal', M['stone']).add_mesh(cone_obj((wx, Y0, wz + 0.05), (wx + rng.uniform(-0.03, 0.03), Y0, wz - L), rng.uniform(0.04, 0.09), 7))
        for (x, y) in tops:
            if rng.random() < 0.25:
                wx, wz = W2(x, y + 4); batch('algae', M['algae']).add_mesh(bl.sphere('a', (wx, Y0, wz), (rng.uniform(0.05, 0.14), 0.04, 0.03)))
    elif A == 'spire':
        for (x, y) in tops + bots:
            if rng.random() < 0.07:
                up = (x, y) in tops; wx, wz = W2(x, y + (6 if up else -6))
                for k in range(int(rng.integers(2, 6))):
                    L = rng.uniform(0.12, 0.55) * (1 if up else -0.8); ang = rng.uniform(-0.6, 0.6)
                    o = cone_obj((wx + rng.uniform(-0.08, 0.08), Y0 + rng.uniform(-0.1, 0.05), wz), (wx + math.sin(ang) * abs(L), Y0, wz + math.cos(ang) * L), rng.uniform(0.03, 0.07), 6)
                    batch('crys', M['crystal']).add_mesh(o)
                lights.append([x, y - (40 if up else -40), 140, [210, 180, 255]])
    elif A == 'hearth':
        for (x, y) in bots:
            if rng.random() < 0.35:
                wx, wz = W2(x, y - 4); L = rng.uniform(0.1, 0.5)
                batch('stal', M['stone']).add_mesh(cone_obj((wx, Y0, wz + 0.05), (wx, Y0, wz - L), rng.uniform(0.04, 0.08), 6))
        for (x, y) in tops:
            if rng.random() < 0.08:
                wx, wz = W2(x, y + 2); batch('emb', M['ember']).add_mesh(bl.sphere('e', (wx, Y0, wz), (rng.uniform(0.03, 0.08),) * 3, seg=8, rings=6))
                lights.append([x, y, 60, [255, 120, 50]])
    # platforms
    T = T2.T
    for yy in range(g.shape[0]):
        xx = 0
        while xx < g.shape[1]:
            if g[yy, xx] == '=':
                x0 = xx
                while xx < g.shape[1] and g[yy, xx] == '=': xx += 1
                px0, px1 = x0 * T, xx * T; cx = (px0 + px1) / 2
                wx, wz = W2(cx, yy * T + 12); w = (px1 - px0) / U
                mat = {'crypts': M['stone'], 'gardens': M['wood'], 'nave': M['stone'], 'spire': M['crystal'], 'hearth': M['iron']}[A]
                o = bl.cube('pl', (wx, -0.1, wz), (w / 2, 0.22, 0.12)); bv = o.modifiers.new('b', 'BEVEL'); bv.width = 0.05; bv.segments = 3
                bl.displace(o, 0.03, 0.3, subsurf=2)
                batch('plat_' + A, mat).add_mesh(o)
                if A == 'crypts':
                    for k in range(int(rng.integers(2, 5))):
                        dx = rng.uniform(-w / 2 + 0.05, w / 2 - 0.05); L = rng.uniform(0.08, 0.3)
                        waxdrip(batch('drips', M['wax']), wx + dx, -0.33, wz - 0.05, L, 0.04, rng)
                    batch('drips', M['wax']).add_mesh(bl.cube('cap', (wx, -0.12, wz + 0.12), (w / 2 - 0.02, 0.2, 0.025)))
                if A == 'gardens':
                    for k in range(int(w * 18)):
                        bx = wx - w / 2 + k / 18 + rng.uniform(0, 0.04)
                        batch('grass', M['grass']).add_mesh(cone_obj((bx, -0.33, wz + 0.1), (bx + rng.uniform(-0.06, 0.06), -0.33, wz + 0.12 + rng.uniform(0.04, 0.16)), 0.015, 4))
            else: xx += 1
    # spikes
    for yy in range(g.shape[0]):
        for xx in range(g.shape[1]):
            if g[yy, xx] != '^': continue
            for k in range(6):
                bx = xx * T + k * 9 + rng.uniform(-2, 6); h = rng.uniform(32, 54) / U
                wx, wz = W2(bx, (yy + 1) * T + 4)
                o = cone_obj((wx, -0.15 + rng.uniform(-0.1, 0.1), wz), (wx + rng.uniform(-0.1, 0.1), -0.15, wz + h), rng.uniform(0.06, 0.09), 6)
                batch('thorns', M['crystal'] if A == 'spire' else M['thorn']).add_mesh(o)
    objs = [b.finish() for b in B.values()]
    return objs, flames, lights

def setup_lights(area):
    key = {'crypts': (1, 0.8, 0.55), 'gardens': (0.65, 1, 0.85), 'nave': (0.65, 0.78, 1), 'spire': (0.88, 0.75, 1), 'hearth': (1, 0.6, 0.4)}[area]
    k = bl.light('SUN', (0, -10, 10), 2.6, key, size=0.15, name='key'); k.rotation_euler = (math.radians(14), math.radians(-30), 0)
    t = bl.light('SUN', (0, -10, 10), 0.9, (0.85, 0.9, 1.0), size=0.3, name='side'); t.rotation_euler = (math.radians(12), math.radians(70), 0)
    f = bl.light('SUN', (0, -10, 10), 0.22, (0.55, 0.6, 0.85), size=1.0, name='fill'); f.rotation_euler = (math.radians(80), 0, 0)

def render_room(r, samples):
    g, S, dd, sdf, seed, W, H = shape(r)
    sc = bl.reset(samples=samples, res=(W, H))
    sc.cycles.max_bounces = 4
    bl.world_color((0.02, 0.02, 0.03), 1.0)
    rng = np.random.default_rng(seed + 5)
    rel = relief(S, dd, W, H, seed)
    rel.data.materials.append(terrain_mat(r.area))
    M = mats(r.area)
    decor, flames, lights = build_decor(r, g, S, dd, W, H, M, rng)
    setup_lights(r.area)
    cam = bl.ortho_cam((0, 0), W / U, dist=30)
    tmp = os.path.join(OUT, '_tmp_' + r.id)
    bl.render(tmp + '_c.png')
    # decor mask pass: holdout relief, emission-white decor, 2 samples
    rel.is_holdout = True
    white = bl.mat('white', (0, 0, 0), emit=(1, 1, 1), emit_strength=1)
    for o in decor: o.data.materials.clear(); o.data.materials.append(white)
    for o in bpy.data.objects:
        if o.type == 'LIGHT': o.hide_render = True
    sc.cycles.samples = 4; sc.cycles.use_denoising = False; sc.view_settings.view_transform = 'Standard'
    bl.render(tmp + '_m.png')
    # ---------------- composite ----------------
    col = np.array(Image.open(tmp + '_c.png').convert('RGBA')).astype(np.float32)
    msk = np.array(Image.open(tmp + '_m.png').convert('RGBA')).astype(np.float32)[..., 3] / 255.0
    os.remove(tmp + '_c.png'); os.remove(tmp + '_m.png')
    Ssm = np.clip(cv2.GaussianBlur(sdf.astype(np.float32), (0, 0), 0.8) * 0.7 + 0.5, 0, 1) * (cv2.GaussianBlur(S.astype(np.float32), (0, 0), 0.7))
    Ssm = np.clip(Ssm * 1.2, 0, 1)
    P = T2.PAL[r.area]
    deep = T2.smoothstep(25, 190, dd)
    rgb = col[..., :3]
    deepc = np.array(P['deep'], np.float32)
    rgb_t = rgb * (1 - deep[..., None] * 0.93) + deepc * deep[..., None] * 0.7
    # ink edge on terrain
    ink = T2.smoothstep(0, 3, dd)[..., None]
    rgb_t = rgb_t * (0.3 + 0.7 * ink)
    a_t = Ssm
    a_d = msk * (col[..., 3] / 255.0)
    rgb_out = rgb * a_d[..., None] + rgb_t * (1 - a_d[..., None])
    A = np.clip(a_d + a_t * (1 - a_d), 0, 1)
    # contact shadow behind
    sh = cv2.GaussianBlur(S.astype(np.float32), (0, 0), 18) * 0.7 * (1 - A)
    inkc = np.array(P['ink'], np.float32)
    final_rgb = np.where(A[..., None] > 1e-3, rgb_out, inkc)
    A2 = np.clip(A + sh, 0, 1)
    final_rgb = (final_rgb * A[..., None] + inkc * sh[..., None]) / np.maximum(A2[..., None], 1e-3)
    img = np.dstack([np.clip(final_rgb, 0, 255), A2 * 255]).astype(np.uint8)
    pad = T2.PAD
    flames = [[round(float(x) - pad, 1), round(float(y) - pad, 1), round(float(s), 2)] for x, y, s in flames]
    lights = [[round(float(x) - pad, 1), round(float(y) - pad, 1), float(r_), c] for x, y, r_, c in lights]
    return Image.fromarray(img, 'RGBA'), flames, lights

if __name__ == '__main__':
    args = sys.argv[1:]; samples = 24
    if args and args[0] == '--samples': samples = int(args[1]); args = args[2:]
    ids = args or list(world.R.keys())
    mp = os.path.join(OUT, 'manifest.json'); man = json.load(open(mp)) if os.path.exists(mp) else {}
    for id in ids:
        r = world.R[id]
        im, flames, lights = render_room(r, samples)
        f = os.path.join(OUT, id + '.webp'); im.save(f, 'WEBP', quality=90, method=5)
        e = man.get(id, {}); e.update({'img': f'assets/rooms/{id}.webp', 'pad': T2.PAD, 'flames': flames, 'lights': lights}); man[id] = e
        json.dump(man, open(mp, 'w'), indent=1)
        print('ROOM', id, im.size, os.path.getsize(f) // 1024, 'KB', flush=True)
