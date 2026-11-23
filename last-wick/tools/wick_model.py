import bpy, bmesh, math, random
from mathutils import Vector
import bl

def cloak_mesh(name, rings=10, seg=40, h=0.85, r0=0.46, r1=0.17, z0=0.12, jag=0.2, seed=3):
    rnd = random.Random(seed)
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    verts = []
    jags = [rnd.uniform(0, jag) * (1 if i % 2 else 0.35) for i in range(seg)]
    for i in range(rings+1):
        t = i / rings
        z = z0 + h * t
        # bell-ish profile
        r = r1 + (r0 - r1) * (1 - t) ** 1.6
        row = []
        for j in range(seg):
            a = 2*math.pi*j/seg
            rr = r * (1 + 0.07*(1-t)**1.5*math.sin(a*7+1.3) + 0.04*(1-t)*math.sin(a*13))
            zz = z + (jags[j] * (1 - t) ** 3 if i == 0 else 0)
            if i == 0: zz = z0 + jags[j]
            row.append(bm.verts.new((rr*math.cos(a)*1.0, rr*math.sin(a)*0.8, zz)))
        verts.append(row)
    for i in range(rings):
        for j in range(seg):
            bm.faces.new((verts[i][j], verts[i][(j+1)%seg], verts[i+1][(j+1)%seg], verts[i+1][j]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    for f in o.data.polygons: f.use_smooth = True
    sol = o.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.025
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    return o

SCARF_W = [0.16, 0.15, 0.14, 0.12, 0.1, 0.07, 0.03]
def scarf_path(t, wind=1.0, lift=0.0, phase=0.0):
    pts = []
    for i in range(7):
        u = i / 6
        x = -0.12 - 0.85 * u * wind
        z = 0.97 - 0.18 * u * (1 - lift) + lift * 0.25 * u + 0.07 * u * math.sin(t * 2 * math.pi + phase - u * 5)
        pts.append((x, 0.1 + 0.05 * u, z))
    return pts

def build():
    M = {}
    M['wax'] = bl.mat('wax', (0.94, 0.88, 0.76), rough=0.38, sss=0.55, sss_radius=(1.0, 0.45, 0.2), sss_scale=0.12, coat=0.15)
    bl.noise_bump(M['wax'], scale=14, strength=0.12)
    M['cloak'] = bl.mat('cloak', (0.012, 0.014, 0.03), rough=0.85, sheen=0.25)
    bl.noise_bump(M['cloak'], scale=30, strength=0.25)
    M['scarf'] = bl.mat('scarf', (0.32, 0.02, 0.03), rough=0.8, sheen=0.4)
    bl.noise_bump(M['scarf'], scale=40, strength=0.3)
    M['dark'] = bl.mat('dark', (0.015, 0.015, 0.025), rough=0.6)
    M['eye'] = bl.mat('eye', (0.0, 0.0, 0.0), rough=0.15, coat=1.0)
    M['wick'] = bl.mat('wickm', (0.02, 0.015, 0.01), rough=0.7, emit=(1.0, 0.35, 0.05), emit_strength=0.0)
    M['brass'] = bl.mat('brass', (0.85, 0.6, 0.3), rough=0.28, metal=1.0)

    root = bl.empty('root')
    body = bl.empty('body', parent=root)
    cl = cloak_mesh('cloak'); bl.assign(cl, M['cloak']); cl.parent = body
    # collar / hood scarf
    col = bl.tube('collar', [(-0.2, 0, 0.98), (0, -0.2, 0.92), (0.2, 0, 0.98), (0, 0.2, 1.02)], [0.09,0.1,0.09,0.08], cyclic=True)
    col = bl.to_mesh(col); bl.assign(col, M['scarf']); col.parent = body
    tail = bl.ribbon('scarftail', scarf_path(0), SCARF_W); bl.assign(tail, M['scarf']); tail.parent = body
    # head pivot
    headp = bl.empty('headp', (0, 0, 1.0), parent=body)
    head = bl.sphere('head', (0, 0, 0.42), (0.40, 0.36, 0.47)); bl.assign(head, M['wax']); bl.smooth(head, 1)
    bl.parent(head, headp)
    # flattened candle top rim (melt pool lip)
    rim = bl.tube('rim', [(0.27*math.cos(a), 0.24*math.sin(a), 0.80 + 0.02*math.sin(3*a)) for a in [i*2*math.pi/8 for i in range(8)]], [0.05]*8, cyclic=True)
    rim = bl.to_mesh(rim); bl.assign(rim, M['wax']); bl.parent(rim, headp)
    # drips hugging the ellipsoid surface
    rnd = random.Random(7)
    def surf(a, z, off=0.012):
        k = max(0.0, 1 - ((z - 0.42) / 0.47) ** 2) ** 0.5
        return ((0.40 * k + off) * math.cos(a), (0.36 * k + off) * math.sin(a), z)
    for k, a in enumerate([-2.5, -2.0, -1.25, -0.75, -0.2, 0.5, 1.4, 2.3, 2.9]):
        L = rnd.uniform(0.1, 0.36)
        zs = [0.80 - L * u for u in (0, 0.35, 0.7, 1.0)]
        pts = [surf(a, z) for z in zs]
        d = bl.tube(f'drip{k}', pts, [0.04, 0.03, 0.028, 0.042], res=10)
        d = bl.to_mesh(d); bl.assign(d, M['wax']); bl.parent(d, headp)
    # eyes (front = -Y), shifted toward facing (+X)
    for s, ex in (('L', -0.06), ('R', 0.19)):
        e = bl.sphere('eye'+s, (ex, -0.30, 0.42), (0.085, 0.06, 0.15), rot=(0, -0.25 if s=='L' else 0.15, 0)); bl.assign(e, M['eye']); bl.parent(e, headp)
    # wick
    tip = bl.empty('wicktip', (0.065, 0, 1.0), parent=headp)
    w = bl.tube('wick', [(0, 0, 0.82), (0.02, 0, 0.92), (0.06, 0, 0.99)], [0.022, 0.02, 0.016]); w = bl.to_mesh(w); bl.assign(w, M['wick']); bl.parent(w, headp)
    # legs
    legs = []
    for s, lx in (('L', -0.12), ('R', 0.12)):
        hip = bl.empty('hip'+s, (lx, 0.0, 0.32), parent=body)
        lg = bl.tube('leg'+s, [(0, 0, 0), (0.0, 0, -0.18), (0.02, 0, -0.32)], [0.045, 0.035, 0.03])
        lg = bl.to_mesh(lg); bl.assign(lg, M['dark']); lg.parent = hip; lg.location = (0, 0, 0)
        foot = bl.tube('foot'+s, [(-0.02, 0, -0.32), (0.06, 0, -0.34), (0.13, 0, -0.33)], [0.04, 0.03, 0.01])
        foot = bl.to_mesh(foot); bl.assign(foot, M['dark']); foot.parent = hip
        legs.append(hip)
    # needle (weapon) on a hand pivot, hidden by default
    hand = bl.empty('hand', (0.25, -0.05, 0.62), parent=body)
    nd = bl.tube('needle', [(0, 0, 0), (0.45, 0, 0.0), (0.95, 0, 0.0)], [0.035, 0.022, 0.003], bevel_res=4)
    nd = bl.to_mesh(nd); bl.assign(nd, M['brass']); nd.parent = hand
    guard = bl.sphere('guard', (0.02, 0, 0), (0.05, 0.08, 0.05)); bl.assign(guard, M['brass']); guard.parent = hand; guard.location = (0.02, 0, 0)
    return dict(root=root, body=body, head=headp, hips=legs, hand=hand, tip=tip, cloak=cl, scarf=tail, needle=[nd, guard], M=M)

def lights():
    bl.world_color((0.03, 0.035, 0.06), 1.0)
    k = bl.light('AREA', (-2.5, -5, 4), 260, (1.0, 0.92, 0.82), size=4, name='key'); bl.look_at(k, (0, 0, 0.9))
    r = bl.light('AREA', (3.5, 4, 2.5), 700, (0.55, 0.7, 1.0), size=3, name='rim'); bl.look_at(r, (0, 0, 0.9))
    r2 = bl.light('AREA', (-3.5, 4, 2.0), 450, (0.55, 0.7, 1.0), size=3, name='rim2'); bl.look_at(r2, (0, 0, 0.9))
    f = bl.light('POINT', (0.06, -0.05, 2.12), 10, (1.0, 0.6, 0.25), size=0.05, name='flame')
    return f
