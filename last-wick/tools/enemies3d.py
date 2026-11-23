"""Enemy models + animations. python3 enemies3d.py NAME OUTDIR"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bl
from charkit import *
NAME, OUT = sys.argv[1], sys.argv[2]
random.seed(3)

def wing_mesh(name, pts, mat, thick=0.01):
    import bmesh
    bm = bmesh.new(); vs = [bm.verts.new(p) for p in pts]; bm.faces.new(vs)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    so = o.modifiers.new('s', 'SOLIDIFY'); so.thickness = thick
    sd = o.modifiers.new('sd', 'SUBSURF'); sd.levels = 2; sd.render_levels = 2
    return o

if NAME == 'wickling':
    R = Renderer(160, 1.6, 0.55); m = M()
    root = E('root'); segs = []
    for k in range(5):
        p = E('seg%d' % k, (0.32 - k * 0.17, 0, 0.22), root)
        r = 0.2 - abs(k - 1.2) * 0.025
        s = bl.sphere('b', (0, 0, 0), (r * 1.05, r * 0.9, r)); s.data.materials.append(m['wax']); put(s, p, (0, 0, 0))
        if k < 4:
            for side in (-1, 1):
                lg = bl.tube('lg', [(0, side * 0.1, -0.05), (0.03, side * 0.16, -0.15), (0.06, side * 0.14, -0.22)], [0.022, 0.018, 0.01]); lg.data.materials.append(m['dark']); put(lg, p)
        segs.append(p)
    head = segs[0]
    for ex in (0.12, 0.17):
        e = bl.sphere('e', (ex, -0.13, 0.05), (0.04, 0.03, 0.05)); e.data.materials.append(m['black']); put(e, head)
    for k in (1, 2):
        w = bl.tube('wk', [(0, 0, 0.17), (0.02, 0, 0.27)], [0.012, 0.01]); w.data.materials.append(m['dark']); put(w, segs[k])
        f = bl.sphere('f', (0.02, 0, 0.31), (0.035, 0.035, 0.07), seg=8, rings=6); f.data.materials.append(m['flame']); put(f, segs[k])
    rim_lights((0, 0, 0.3), 0.6); R.camera()
    @R.anim('walk', 6, fps=10)
    def _(i, n):
        t = i / n
        for k, p in enumerate(segs):
            p.location.z = 0.22 + 0.04 * max(0, math.sin(t * 2 * P - k * 1.1))
            p.location.x = 0.32 - k * 0.17 + 0.02 * math.sin(t * 2 * P - k * 1.1)
            p.rotation_euler = (0, 0.15 * math.cos(t * 2 * P - k * 1.1), 0)
    @R.anim('idle', 4, fps=6)
    def _(i, n):
        t = i / n
        for k, p in enumerate(segs): p.location.z = 0.22 + 0.015 * math.sin(t * 2 * P + k); p.location.x = 0.32 - k * 0.17; p.rotation_euler = (0, 0, 0)
    R.run(OUT)

elif NAME == 'husk':
    R = Renderer(256, 2.6, 1.05); m = M()
    root = E('root'); body = E('body', (0, 0, 0.05), root)
    # drooping candle body
    b = bl.cyl('b', (0, 0, 0.85), 0.36, 1.7, verts=24, r2=0.22); b.data.materials.append(m['wax']); bl.displace(b, 0.06, 0.6, subsurf=2); put(b, body)
    for k in range(9):
        a = random.uniform(0, 6.28); z = random.uniform(0.9, 1.65); L = random.uniform(0.2, 0.7)
        d = bl.tube('d', [(math.cos(a) * 0.3, math.sin(a) * 0.3, z), (math.cos(a) * 0.36, math.sin(a) * 0.36, z - L)], [0.06, 0.04]); d.data.materials.append(m['wax']); put(d, body)
    head = E('head', (0, 0, 1.7), body)
    h = bl.sphere('h', (0.05, 0, 0.05), (0.28, 0.25, 0.25)); h.data.materials.append(m['wax']); put(h, head)
    for ex in (0.08, 0.24):
        e = bl.sphere('e', (ex, -0.2, 0.06), (0.05, 0.03, 0.07)); e.data.materials.append(m['eye']); put(e, head)
    mouth = bl.sphere('mo', (0.16, -0.2, -0.08), (0.07, 0.03, 0.04)); mouth.data.materials.append(m['black']); put(mouth, head)
    w = bl.tube('w', [(0, 0, 0.25), (-0.05, 0, 0.4)], [0.02, 0.015]); w.data.materials.append(m['dark']); put(w, head)
    f = bl.sphere('f', (-0.06, 0, 0.47), (0.05, 0.05, 0.1)); f.data.materials.append(m['flame']); put(f, head)
    arms = []
    for side, ay in ((-1, 0.3), (1, -0.3)):
        sh = E('sh', (0.05, ay, 1.35), body)
        a = bl.tube('a', [(0, 0, 0), (0.15, 0, -0.35), (0.25, 0, -0.75)], [0.07, 0.06, 0.05]); a.data.materials.append(m['wax']); put(a, sh)
        hd = bl.sphere('hd', (0.27, 0, -0.8), (0.08, 0.07, 0.1)); hd.data.materials.append(m['waxdark']); put(hd, sh)
        arms.append(sh)
    legs = []
    for side in (-1, 1):
        hp = E('hp', (side * 0.1, 0, 0.25), body)
        lg = bl.tube('l', [(0, 0, 0), (0.02, 0, -0.15), (0.06, 0, -0.27)], [0.08, 0.07, 0.07]); lg.data.materials.append(m['waxdark']); put(lg, hp)
        legs.append(hp)
    rim_lights((0, 0, 1), 1.0); R.camera()
    def pose(lean=0, bob=0, la=(0, 0), aa=(0, 0), ht=0):
        body.rotation_euler = (0, lean, 0); body.location.z = 0.05 + bob
        for hp, a in zip(legs, la): hp.rotation_euler = (0, a, 0)
        for s, a in zip(arms, aa): s.rotation_euler = (0, a, 0)
        head.rotation_euler = (0, ht, 0)
    @R.anim('walk', 6, fps=8)
    def _(i, n):
        t = i / n * 2 * P; pose(0.12, 0.03 * abs(math.sin(t)), (0.4 * math.sin(t), -0.4 * math.sin(t)), (0.3 * math.sin(t) + 0.3, -0.3 * math.sin(t) + 0.3), 0.1)
    @R.anim('idle', 4, fps=5)
    def _(i, n):
        t = i / n * 2 * P; pose(0.08, 0.01 * math.sin(t), (0, 0), (0.25 + 0.05 * math.sin(t), 0.3), 0.05 * math.sin(t))
    @R.anim('windup', 3, loop=False, fps=8)
    def _(i, n):
        k = (i + 1) / n; pose(-0.25 * k, -0.05 * k, (0.3, -0.4), (-1.2 * k, -1.0 * k), -0.3 * k)
    @R.anim('attack', 4, fps=12)
    def _(i, n):
        t = i / n * 2 * P; pose(0.55, 0.05 * abs(math.sin(t)), (0.9 * math.sin(t), -0.9 * math.sin(t)), (1.3, 1.1), 0.2)
    R.run(OUT)

elif NAME in ('emberfly', 'shardwing'):
    R = Renderer(160, 1.6, 0.0); m = M(); glass = NAME == 'shardwing'
    root = E('root'); body = E('body', (0, 0, 0), root)
    th = bl.sphere('th', (0.05, 0, 0.02), (0.13, 0.11, 0.11)); th.data.materials.append(m['crystal'] if glass else m['chitin']); put(th, body)
    ab = bl.sphere('ab', (-0.2, 0, -0.03), (0.2, 0.13, 0.13)); ab.data.materials.append(m['glowviolet'] if glass else m['ember']); put(ab, body)
    hd = bl.sphere('hd', (0.2, 0, 0.04), (0.08, 0.08, 0.08)); hd.data.materials.append(m['chitin']); put(hd, body)
    e = bl.sphere('e', (0.25, -0.06, 0.06), (0.03, 0.02, 0.03)); e.data.materials.append(m['eye']); put(e, body)
    for side in (-1, 1):
        lg = bl.tube('lg', [(0.05, side * 0.05, -0.05), (0.1, side * 0.1, -0.18), (0.15, side * 0.08, -0.25)], [0.012, 0.01, 0.006]); lg.data.materials.append(m['chitin']); put(lg, body)
    wings = []
    for k, (yy, sc) in enumerate(((-0.05, 1.0), (0.08, 0.85))):
        wp = E('wp', (0.04, yy, 0.1), body)
        pts = [(0, 0, 0), (-0.15 * sc, 0, 0.12 * sc), (-0.42 * sc, 0, 0.3 * sc), (-0.5 * sc, 0, 0.22 * sc), (-0.32 * sc, 0, 0.04 * sc)]
        w = wing_mesh('w', pts, m['crystal'] if glass else m['wing']); put(w, wp); wings.append(wp)
    rim_lights((0, 0, 0), 0.6); R.camera()
    @R.anim('fly', 4, fps=16)
    def _(i, n):
        t = i / n * 2 * P
        for k, wp in enumerate(wings): wp.rotation_euler = (0.7 * math.sin(t + k * 0.6), 0, 0)
        body.location.z = 0.03 * math.sin(t)
    R.run(OUT)

elif NAME == 'mothling':
    R = Renderer(192, 2.0, 0.1); m = M()
    root = E('root'); body = E('body', (0, 0, 0), root)
    b = bl.sphere('b', (0, 0, 0), (0.26, 0.13, 0.14)); b.data.materials.append(m['pale']); put(b, body)
    h = bl.sphere('h', (0.26, 0, 0.03), (0.1, 0.1, 0.1)); h.data.materials.append(m['pale']); put(h, body)
    for side in (-1, 1):
        e = bl.sphere('e', (0.32, side * 0.06 - 0.02, 0.05), (0.04, 0.04, 0.04)); e.data.materials.append(m['black']); put(e, body)
        an = bl.tube('an', [(0.3, side * 0.03, 0.1), (0.4, side * 0.06, 0.28), (0.32, side * 0.1, 0.4)], [0.012, 0.01, 0.006]); an.data.materials.append(m['pale']); put(an, body)
    wings = []
    for k, (yy, sc) in enumerate(((-0.08, 1.0), (0.1, 0.9))):
        wp = E('wp', (0.05, yy, 0.08), body)
        pts = [(0.1, 0, 0), (-0.05 * sc, 0, 0.35 * sc), (-0.35 * sc, 0, 0.55 * sc), (-0.6 * sc, 0, 0.4 * sc), (-0.5 * sc, 0, 0.05 * sc), (-0.3 * sc, 0, -0.12 * sc)]
        w = wing_mesh('w', pts, m['pale']); put(w, wp)
        sp = bl.sphere('spot', (-0.3 * sc, -0.015, 0.3 * sc), (0.07, 0.01, 0.07)); sp.data.materials.append(m['glowblue']); put(sp, wp)
        wings.append(wp)
    rim_lights((0, 0, 0.1), 0.7, rim=(0.7, 0.85, 1.0)); R.camera()
    def flap(t, amp=0.9, tilt=0):
        for k, wp in enumerate(wings): wp.rotation_euler = (amp * math.sin(t + k * 0.5), 0, 0)
        body.rotation_euler = (0, tilt, 0)
    @R.anim('fly', 4, fps=12)
    def _(i, n): flap(i / n * 2 * P); body.location.z = 0.04 * math.sin(i / n * 2 * P)
    @R.anim('windup', 2, fps=10)
    def _(i, n): flap(i / n * 2 * P + 1, 1.2, -0.4); body.location.z = 0.08
    @R.anim('attack', 2, fps=10)
    def _(i, n): flap(1.2 + i * 0.2, 0.2, 0.7)
    R.run(OUT)

elif NAME == 'sporecap':
    R = Renderer(192, 1.9, 0.7); m = M()
    root = E('root'); body = E('body', (0, 0, 0), root)
    st = bl.cyl('st', (0, 0, 0.3), 0.2, 0.6, verts=20, r2=0.15); st.data.materials.append(m['pale']); bl.displace(st, 0.03, 0.5, subsurf=2); put(st, body)
    cap = E('cap', (0, 0, 0.62), body)
    c = bl.sphere('c', (0, 0, 0.08), (0.55, 0.5, 0.36)); c.data.materials.append(m['teal']); put(c, cap)
    u = bl.sphere('u', (0, 0, -0.02), (0.5, 0.46, 0.08)); u.data.materials.append(m['glowteal']); put(u, cap)
    for k in range(9):
        a = random.uniform(0.3, 2.8); b2 = random.uniform(0, 6.28)
        p = (0.55 * math.sin(a) * math.cos(b2) * 0.95, 0.5 * math.sin(a) * math.sin(b2) * 0.95, 0.08 + 0.36 * math.cos(a) * 0.95)
        s = bl.sphere('sp', p, (0.06, 0.06, 0.04)); s.data.materials.append(m['glowteal']); put(s, cap)
    for ex in (0.04, 0.14):
        e = bl.sphere('e', (ex, -0.19, 0.42), (0.03, 0.02, 0.045)); e.data.materials.append(m['black']); put(e, body)
    rim_lights((0, 0, 0.5), 0.8, rim=(0.5, 1, 0.8)); R.camera()
    @R.anim('idle', 4, fps=5)
    def _(i, n): t = i / n * 2 * P; cap.scale = (1 + 0.03 * math.sin(t), 1, 1 - 0.03 * math.sin(t)); cap.location.z = 0.62
    @R.anim('windup', 3, loop=False, fps=6)
    def _(i, n): k = (i + 1) / n; cap.scale = (1 + 0.15 * k, 1 + 0.1 * k, 1 + 0.2 * k); cap.location.z = 0.62 - 0.08 * k
    R.run(OUT)

elif NAME == 'jelly':
    R = Renderer(192, 1.9, 0.75); m = M()
    root = E('root'); bell = E('bell', (0, 0, 0.95), root)
    b = bl.sphere('b', (0, 0, 0), (0.48, 0.48, 0.38)); b.data.materials.append(m['jelly']); put(b, bell)
    core = bl.sphere('core', (0, 0, 0.02), (0.18, 0.18, 0.14)); core.data.materials.append(m['glowblue']); put(core, bell)
    tents = []
    for k in range(7):
        a = k / 7 * 6.28; tp = E('t', (math.cos(a) * 0.3, math.sin(a) * 0.3, -0.1), bell); tents.append(tp)
        t = bl.tube('tt', [(0, 0, 0), (0.03, 0, -0.3), (-0.03, 0, -0.6), (0.02, 0, -0.85)], [0.03, 0.025, 0.018, 0.008], res=8); t.data.materials.append(m['jelly']); put(t, tp)
    rim_lights((0, 0, 0.8), 0.8, rim=(0.5, 0.8, 1.0)); R.camera()
    @R.anim('idle', 6, fps=8)
    def _(i, n):
        t = i / n * 2 * P; bell.scale = (1 + 0.08 * math.sin(t), 1 + 0.08 * math.sin(t), 1 - 0.1 * math.sin(t)); bell.location.z = 0.95 + 0.05 * math.sin(t)
        for k, tp in enumerate(tents): tp.rotation_euler = (0, 0.25 * math.sin(t - 1 + k), 0)
    R.run(OUT)

elif NAME == 'acolyte':
    R = Renderer(256, 2.6, 1.05); m = M()
    root = E('root'); body = E('body', (0, 0, 0), root)
    robe = bl.cyl('r', (0, 0, 0.75), 0.42, 1.5, verts=28, r2=0.18); robe.data.materials.append(m['robe']); bl.displace(robe, 0.05, 0.4, subsurf=2); put(robe, body)
    hood = E('hood', (0, 0, 1.55), body)
    hd = bl.sphere('hd', (0, 0, 0.05), (0.27, 0.27, 0.32)); hd.data.materials.append(m['robe']); put(hd, hood)
    face = bl.sphere('face', (0.08, -0.12, 0.0), (0.16, 0.12, 0.2)); face.data.materials.append(m['bone']); put(face, hood)
    for ex in (0.04, 0.14):
        e = bl.sphere('e', (ex, -0.23, 0.03), (0.03, 0.02, 0.05)); e.data.materials.append(m['black']); put(e, hood)
    arm = E('arm', (0.15, -0.15, 1.2), body)
    a = bl.tube('a', [(0, 0, 0), (0.18, 0, -0.2), (0.3, 0, -0.35)], [0.08, 0.07, 0.06]); a.data.materials.append(m['robe']); put(a, arm)
    staff = bl.tube('st', [(0.3, -0.05, -1.1), (0.32, -0.05, 0.4)], [0.03, 0.03]); staff.data.materials.append(m['rust']); put(staff, arm)
    lan = bl.cyl('lan', (0.32, -0.05, 0.55), 0.09, 0.2, verts=8); lan.data.materials.append(m['ember2']); put(lan, arm)
    cage = bl.cyl('cg', (0.32, -0.05, 0.68), 0.1, 0.08, verts=8, r2=0.02); cage.data.materials.append(m['rust']); put(cage, arm)
    blade_arm = E('barm', (-0.05, 0.15, 1.25), body)
    bb = bl.tube('ba', [(0, 0, 0), (0.15, 0, -0.3)], [0.08, 0.06]); bb.data.materials.append(m['robe']); put(bb, blade_arm)
    sickle = bl.tube('sk', [(0.15, 0, -0.3), (0.45, 0, -0.2), (0.65, 0, 0.05), (0.62, 0, 0.25)], [0.03, 0.025, 0.015, 0.003]); sickle.data.materials.append(m['iron']); put(sickle, blade_arm)
    rim_lights((0, 0, 1), 1.0); R.camera()
    def pose(lean=0, bob=0, ba=0, ht=0, sway=0):
        body.rotation_euler = (0, lean, 0); body.location.z = bob; blade_arm.rotation_euler = (0, ba, 0); hood.rotation_euler = (0, ht, 0)
        robe.scale = (1 + sway, 1, 1)
    @R.anim('walk', 6, fps=8)
    def _(i, n): t = i / n * 2 * P; pose(0.08, 0.03 * abs(math.sin(t)), 0.2 * math.sin(t), 0.05, 0.03 * math.sin(t))
    @R.anim('idle', 4, fps=5)
    def _(i, n): t = i / n * 2 * P; pose(0.02, 0.01 * math.sin(t), 0.05 * math.sin(t), 0.04 * math.sin(t))
    @R.anim('windup', 2, loop=False, fps=6)
    def _(i, n): pose(-0.2, 0, -1.6 - i * 0.3, -0.2)
    @R.anim('attack', 3, loop=False, fps=12)
    def _(i, n): pose(0.35, 0, 1.0 + i * 0.4, 0.2)
    R.run(OUT)

elif NAME == 'sentinel':
    R = Renderer(256, 2.6, 1.05); m = M()
    root = E('root'); body = E('body', (0, 0, 0), root)
    def facet(name, loc, scl, mat, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, location=loc, rotation=rot); o = bpy.context.object; o.scale = scl; o.data.materials.append(mat); return o
    put(facet('torso', (0, 0, 1.1), (0.35, 0.3, 0.45), m['crystal']), body)
    put(facet('core', (0.05, -0.12, 1.15), (0.12, 0.12, 0.12), m['glowviolet']), body)
    head = E('head', (0, 0, 1.65), body)
    put(facet('h', (0, 0, 0.1), (0.2, 0.18, 0.28), m['crystal']), head)
    put(facet('crest', (0, 0, 0.42), (0.06, 0.06, 0.25), m['glowviolet']), head)
    e = bl.sphere('e', (0.1, -0.15, 0.12), (0.06, 0.02, 0.03)); e.data.materials.append(m['glowviolet']); put(e, head)
    for side in (-1, 1):
        put(facet('leg', (side * 0.15, 0, 0.38), (0.12, 0.12, 0.38), m['crystal']), body)
    arm = E('arm', (0.25, -0.1, 1.35), body)
    put(facet('arm', (0.15, 0, -0.2), (0.1, 0.1, 0.3), m['crystal'], rot=(0, -0.5, 0)), arm)
    put(facet('blade', (0.45, 0, -0.1), (0.35, 0.04, 0.08), m['glowviolet'], rot=(0, 0.3, 0)), arm)
    rim_lights((0, 0, 1), 1.0, rim=(0.8, 0.65, 1.0)); R.camera()
    @R.anim('idle', 4, fps=5)
    def _(i, n): t = i / n * 2 * P; body.location.z = 0.02 * math.sin(t); arm.rotation_euler = (0, 0.1 * math.sin(t), 0)
    @R.anim('windup', 3, loop=False, fps=6)
    def _(i, n): k = (i + 1) / n; arm.rotation_euler = (0, -1.4 * k, 0); body.rotation_euler = (0, -0.15 * k, 0)
    R.run(OUT)

elif NAME == 'wraith':
    R = Renderer(256, 2.6, 1.0); m = M()
    root = E('root'); body = E('body', (0, 0, 0.2), root)
    cl = bl.cyl('cl', (0, 0, 0.7), 0.45, 1.4, verts=28, r2=0.2); cl.data.materials.append(m['smoke']); bl.displace(cl, 0.12, 0.5, subsurf=2); put(cl, body)
    head = E('head', (0, 0, 1.45), body)
    h = bl.sphere('h', (0, 0, 0.05), (0.3, 0.28, 0.32)); h.data.materials.append(m['smoke']); put(h, head)
    for ex in (0.06, 0.18):
        e = bl.sphere('e', (ex, -0.24, 0.02), (0.045, 0.02, 0.025)); e.data.materials.append(m['eye']); put(e, head)
    claws = []
    for side in (-1, 1):
        a = E('a', (0.1, side * 0.3, 1.1), body); claws.append(a)
        t = bl.tube('t', [(0, 0, 0), (0.3, 0, -0.3), (0.55, 0, -0.45)], [0.08, 0.06, 0.04]); t.data.materials.append(m['smoke']); put(t, a)
        for k in range(3):
            c = bl.tube('c', [(0.55, 0, -0.45), (0.7, 0, -0.45 - 0.05 * k), (0.8, 0, -0.55 - 0.08 * k)], [0.025, 0.015, 0.002]); c.data.materials.append(m['bone']); put(c, a)
    rim_lights((0, 0, 1), 1.0, rim=(1, 0.45, 0.3)); R.camera()
    @R.anim('idle', 4, fps=6)
    def _(i, n): t = i / n * 2 * P; body.location.z = 0.2 + 0.05 * math.sin(t); cl.scale = (1 + 0.05 * math.sin(t * 2), 1, 1); [c.__setattr__('rotation_euler', (0, 0.2 * math.sin(t + k), 0)) for k, c in enumerate(claws)]
    @R.anim('windup', 2, loop=False, fps=6)
    def _(i, n): [c.__setattr__('rotation_euler', (0, -1.5, 0)) for c in claws]; body.rotation_euler = (0, -0.2, 0)
    @R.anim('attack', 2, loop=False, fps=8)
    def _(i, n): [c.__setattr__('rotation_euler', (0, 0.8, 0)) for c in claws]; body.rotation_euler = (0, 0.4, 0)
    R.run(OUT)
