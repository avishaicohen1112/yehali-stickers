"""Boss models + animations. python3 bosses3d.py NAME OUTDIR"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bmesh, bl
from charkit import *
NAME, OUT = sys.argv[1], sys.argv[2]
random.seed(11)

def jagged_cone(name, r0, r1, h, seg=40, rings=10, jag=0.25, wav=0.08, seed=1, z0=0.0, flat=0.85):
    rnd = random.Random(seed); bm = bmesh.new(); rows = []
    jags = [rnd.uniform(0, jag) * (1 if i % 2 else 0.4) for i in range(seg)]
    for i in range(rings + 1):
        t = i / rings; r = r1 + (r0 - r1) * (1 - t) ** 1.4; row = []
        for j in range(seg):
            a = 2 * math.pi * j / seg; rr = r * (1 + wav * (1 - t) * math.sin(a * 7 + 1))
            z = z0 + h * t + (jags[j] if i == 0 else 0)
            row.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a) * flat, z)))
        rows.append(row)
    for i in range(rings):
        for j in range(seg): bm.faces.new((rows[i][j], rows[i][(j + 1) % seg], rows[i + 1][(j + 1) % seg], rows[i + 1][j]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    for f in o.data.polygons: f.use_smooth = True
    so = o.modifiers.new('s', 'SOLIDIFY'); so.thickness = 0.04
    sd = o.modifiers.new('sd', 'SUBSURF'); sd.levels = 2; sd.render_levels = 2
    return o

def spiky_ball(name, r, n, L, mat, mat2):
    s = bl.sphere(name, (0, 0, 0), (r, r, r)); s.data.materials.append(mat)
    objs = [s]
    for k in range(n):
        u = (k + 0.5) / n; th = math.acos(1 - 2 * u); ph = k * 2.399
        d = (math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th))
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r * 0.18, radius2=0, depth=L, location=(d[0] * (r + L / 2 - 0.02), d[1] * (r + L / 2 - 0.02), d[2] * (r + L / 2 - 0.02)))
        c = bpy.context.object; c.rotation_euler = Vector(d).to_track_quat('Z', 'Y').to_euler(); c.data.materials.append(mat2); objs.append(c)
    return objs

def wing(name, pts, mat, thick=0.015, sub=2):
    bm = bmesh.new(); vs = [bm.verts.new(p) for p in pts]; bm.faces.new(vs)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    so = o.modifiers.new('s', 'SOLIDIFY'); so.thickness = thick
    sd = o.modifiers.new('sd', 'SUBSURF'); sd.levels = sub; sd.render_levels = sub
    for f in o.data.polygons: f.use_smooth = True
    return o

def moth_wing_mat(base, vein, spot):
    m = bpy.data.materials.new('mw'); nt = m.node_tree; L = nt.links; p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    gr = nt.nodes.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.32, 0.32, 0.32); mp.inputs['Location'].default_value = (0.0, 0, -0.1)
    L.new(tc.outputs['Object'], mp.inputs['Vector']); L.new(mp.outputs['Vector'], gr.inputs['Vector'])
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'RINGS'; wv.inputs['Scale'].default_value = 1.4; wv.inputs['Distortion'].default_value = 3.0; wv.inputs['Detail'].default_value = 3
    L.new(tc.outputs['Object'], wv.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp
    cr.elements[0].color = (0.18, 0.14, 0.16, 1); cr.elements[0].position = 0.0
    cr.elements[1].color = (*base, 1); cr.elements[1].position = 0.55
    e = cr.elements.new(0.8); e.color = (0.95, 0.93, 0.9, 1)
    L.new(gr.outputs['Fac'], ramp.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 0.25
    L.new(ramp.outputs['Color'], mix.inputs[6]); L.new(wv.outputs['Color'], mix.inputs[7])
    L.new(mix.outputs[2], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.7; p.inputs['Sheen Weight'].default_value = 1.0
    p.inputs['Subsurface Weight'].default_value = 0.5; p.inputs['Subsurface Scale'].default_value = 0.08
    return m

# =====================================================================
if NAME == 'knight':
    R = Renderer(512, 6.4, 2.6, samples=24); m = M()
    plate = bl.noise_bump(bl.mat('plate', (0.13, 0.11, 0.1), rough=0.32, metal=0.95, coat=0.3), 14, 0.25)
    trim = m['brass']
    root = E('root'); hips = E('hips', (0, 0, 1.25), root)
    torso = E('torso', (0, 0, 0.1), hips)
    ch = bl.sphere('chest', (0.05, 0, 0.75), (0.72, 0.6, 0.78)); ch.data.materials.append(plate); put(ch, torso)
    for k in range(4):
        b = bl.cyl('band', (0.0, 0, 0.12 - k * 0.12), 0.62 - k * 0.02, 0.1, verts=32); b.data.materials.append(plate if k % 2 else trim); put(b, torso)
    # wax encasing left shoulder and dripping
    wx = bl.sphere('waxmass', (-0.1, -0.35, 1.3), (0.55, 0.5, 0.42)); wx.data.materials.append(m['wax']); bl.displace(wx, 0.12, 0.6, subsurf=2); put(wx, torso)
    for k in range(14):
        a = random.uniform(-1.4, 2.0); z = random.uniform(0.9, 1.4); L = random.uniform(0.3, 1.2); rr = random.uniform(0.04, 0.1)
        x0, y0 = -0.1 + math.cos(a) * 0.55, -0.45 + math.sin(a) * 0.2
        d = bl.tube('dr', [(x0, y0, z), (x0 + 0.02, y0 - 0.05, z - L * 0.6), (x0, y0 - 0.06, z - L)], [rr, rr * 0.6, rr * 0.5]); d.data.materials.append(m['wax']); put(d, torso)
        s = bl.sphere('db', (x0, y0 - 0.06, z - L), (rr * 0.8,) * 3, seg=10, rings=6); s.data.materials.append(m['wax']); put(s, torso)
    # tabard
    tb = jagged_cone('tabard', 0.55, 0.45, 1.0, seg=24, rings=6, jag=0.18, z0=-1.05, flat=0.7); tb.data.materials.append(m['red']); put(tb, torso)
    # pauldron right (front)
    for side, y in ((1, -0.55), (-1, 0.55)):
        pd = bl.sphere('pauld', (0.05, y, 1.3), (0.42, 0.4, 0.3)); pd.data.materials.append(plate); put(pd, torso)
        rim = bl.tube('prim', [(0.05 + 0.42 * math.cos(a), y + 0.4 * math.sin(a), 1.18) for a in [i / 16 * 6.28 for i in range(16)]], [0.04] * 16); rim.data.splines[0].use_cyclic_u = True; rim.data.materials.append(trim); put(rim, torso)
    # head / great helm with candle crown
    head = E('head', (0.12, 0, 1.55), torso)
    hm = bl.cyl('helm', (0, 0, 0.35), 0.36, 0.7, verts=32); hm.data.materials.append(plate); put(hm, head)
    hd = bl.sphere('helmtop', (0, 0, 0.7), (0.36, 0.36, 0.25)); hd.data.materials.append(plate); put(hd, head)
    slit = bl.cube('slit', (0.0, -0.36, 0.42), (0.26, 0.03, 0.035)); slit.data.materials.append(m['black']); put(slit, head)
    for ex in (-0.08, 0.12):
        e = bl.sphere('eye', (ex, -0.37, 0.42), (0.05, 0.02, 0.03)); e.data.materials.append(m['eye']); put(e, head)
    cr = bl.cyl('crown', (0, 0, 0.88), 0.3, 0.12, verts=24); cr.data.materials.append(trim); put(cr, head)
    for k, (cx, h) in enumerate(((-0.18, 0.35), (0.02, 0.5), (0.2, 0.3))):
        c = bl.cyl('cand', (cx, -0.05, 0.92 + h / 2), 0.07, h, verts=14); c.data.materials.append(m['wax']); put(c, head)
        f = bl.sphere('fl', (cx, -0.05, 0.98 + h + 0.05), (0.05, 0.05, 0.12), seg=8, rings=6); f.data.materials.append(m['flame']); put(f, head)
        d = bl.tube('cd', [(cx + 0.06, -0.08, 0.92 + h), (cx + 0.08, -0.1, 0.6)], [0.035, 0.025]); d.data.materials.append(m['wax']); put(d, head)
    flame = bl.light('POINT', (0, -0.3, 1.6), 30, (1, 0.55, 0.2), size=0.2); put(flame, head, (0, -0.3, 1.6))
    # arms: right arm (front, weapon), left arm (back)
    arms = {}
    for side, y in (('R', -0.6), ('L', 0.6)):
        sh = E('sh' + side, (0.05, y, 1.2), torso)
        up = bl.tube('ua', [(0, 0, 0), (0.05, 0, -0.45)], [0.2, 0.17]); up.data.materials.append(plate); put(up, sh)
        el = E('el' + side, (0.05, 0, -0.5), sh)
        fa = bl.tube('fa', [(0, 0, 0), (0.1, 0, -0.45)], [0.17, 0.15]); fa.data.materials.append(plate); put(fa, el)
        g = bl.sphere('gaunt', (0.12, 0, -0.55), (0.2, 0.18, 0.18)); g.data.materials.append(plate); put(g, el)
        arms[side] = (sh, el)
    # censer mace in right hand
    hand = E('hand', (0.12, 0, -0.58), arms['R'][1])
    shaft = bl.tube('shaft', [(0, 0, 0.35), (0, 0, -1.6)], [0.06, 0.06]); shaft.data.materials.append(m['iron']); put(shaft, hand)
    ballp = E('ball', (0, 0, -1.9), hand)
    for o in spiky_ball('mace', 0.36, 16, 0.32, m['iron'], m['iron']): put(o, ballp)
    core = bl.sphere('core', (0, -0.1, 0), (0.25, 0.25, 0.25)); core.data.materials.append(m['ember2']); put(core, ballp)
    cl = bl.light('POINT', (0, -0.6, 0), 60, (1, 0.5, 0.15), size=0.3); put(cl, ballp, (0, -0.6, 0))
    # legs
    legs = []
    for side, y in ((1, -0.3), (-1, 0.3)):
        hp = E('hp', (0, y, 0), hips)
        th = bl.tube('th', [(0, 0, 0), (0.05, 0, -0.6)], [0.3, 0.26]); th.data.materials.append(plate); put(th, hp)
        kn = E('kn', (0.05, 0, -0.62), hp)
        sh_ = bl.tube('shin', [(0, 0, 0), (0, 0, -0.55)], [0.26, 0.22]); sh_.data.materials.append(plate); put(sh_, kn)
        ft = bl.sphere('foot', (0.18, 0, -0.62), (0.38, 0.22, 0.14)); ft.data.materials.append(plate); put(ft, kn)
        kp = bl.sphere('kp', (0.12, 0, 0), (0.14, 0.14, 0.14)); kp.data.materials.append(trim); put(kp, kn)
        legs.append((hp, kn))
    rim_lights((0, 0, 2), 2.0); R.camera()
    def pose(hz=1.25, lean=0.0, hx=0.0, legs_a=(0, 0), knees=(0, 0), sR=(0.3, 0.6), sL=(0.2, 0.4), ht=0.0, mace=0.0, squash=1.0):
        hips.location = (hx, 0, hz); torso.rotation_euler = (0, lean, 0); head.rotation_euler = (0, ht, 0)
        for (hp, kn), a, k in zip(legs, legs_a, knees): hp.rotation_euler = (0, a, 0); kn.rotation_euler = (0, k, 0)
        arms['R'][0].rotation_euler = (0, sR[0], 0); arms['R'][1].rotation_euler = (0, sR[1], 0)
        arms['L'][0].rotation_euler = (0, sL[0], 0); arms['L'][1].rotation_euler = (0, sL[1], 0)
        hand.rotation_euler = (0, mace, 0); root.scale = (1 / math.sqrt(squash), 1, squash)
    @R.anim('idle', 4, fps=5)
    def _(i, n): t = i / n * 2 * P; pose(1.22 + 0.02 * math.sin(t), 0.08, 0, (0.15, -0.15), (-0.2, -0.1), (0.25, 0.55 + 0.05 * math.sin(t)), ht=0.03 * math.sin(t), mace=0.2)
    @R.anim('walk', 6, fps=7)
    def _(i, n): t = i / n * 2 * P; s = math.sin(t); pose(1.2 + 0.04 * abs(math.cos(t)), 0.15, 0, (0.45 * s, -0.45 * s), (-0.3 - 0.3 * max(0, s), -0.3 - 0.3 * max(0, -s)), (0.3 - 0.2 * s, 0.6), (0.2 + 0.2 * s, 0.4), mace=0.3)
    @R.anim('windup', 3, loop=False, fps=6)
    def _(i, n): k = (i + 1) / n; pose(1.2 - 0.25 * k, 0.45 * k, -0.1 * k, (0.6 * k, -0.4 * k), (-0.8 * k, -0.4 * k), (0.7 * k, 0.4), (0.4, 0.6), ht=-0.2 * k, mace=0.6 * k)
    @R.anim('charge', 4, fps=12)
    def _(i, n): t = i / n * 2 * P; s = math.sin(t); pose(1.1 + 0.05 * abs(math.cos(t)), 0.6, 0.1, (0.9 * s, -0.9 * s), (-0.5 - 0.4 * max(0, s), -0.5 - 0.4 * max(0, -s)), (-1.0, -0.3), (0.6, 0.6), ht=-0.3, mace=-0.3)
    @R.anim('stun', 3, fps=6)
    def _(i, n): t = i / n * 2 * P; pose(1.0, -0.35 + 0.05 * math.sin(t), -0.15, (-0.3, 0.4), (-0.6, -0.3), (-0.2, 0.2), (-0.3, 0.2), ht=0.4 + 0.1 * math.sin(t), mace=-0.4)
    @R.anim('windup2', 3, loop=False, fps=6)
    def _(i, n): k = (i + 1) / n; pose(1.2 - 0.1 * k, -0.35 * k, 0, (0.3, -0.3), (-0.3, -0.2), (2.6 * k, 0.4 * k), (-0.6 * k, 0.3), ht=-0.3 * k, mace=0.3 * k)
    @R.anim('swing', 4, loop=False, fps=12)
    def _(i, n): k = ease(min(1, (i + 1) / 2)); pose(1.1, lerp(-0.35, 0.55, k), 0.1, (0.5, -0.4), (-0.5, -0.3), (lerp(2.6, -1.3, k), lerp(0.4, -0.2, k)), (0.6, 0.4), ht=lerp(-0.3, 0.3, k), mace=lerp(0.3, -0.4, k))
    @R.anim('crouch', 2, loop=False, fps=6)
    def _(i, n): k = (i + 1) / n; pose(1.2 - 0.35 * k, 0.3 * k, 0, (0.9 * k, 0.7 * k), (-1.5 * k, -1.3 * k), (-0.6, 0.8), (-0.6, 0.8), ht=-0.2, mace=0.5, squash=1 - 0.05 * k)
    @R.anim('jump', 2, fps=6)
    def _(i, n): pose(1.3, -0.1, 0, (0.6, -0.2), (-1.0, -0.6), (2.5 + i * 0.1, 0.4), (-0.8, 0.5), ht=0.2, mace=0.3, squash=1.05)
    @R.anim('slam', 3, loop=False, fps=8)
    def _(i, n): k = [1, 0.8, 0.5][i]; pose(1.2 - 0.4 * k, 0.6 * k, 0.1, (0.9 * k, -0.6 * k), (-1.4 * k, -0.6 * k), (-1.3, -0.1), (0.8, 0.6), ht=0.3 * k, mace=-0.5, squash=1 - 0.08 * k)
    @R.anim('death', 6, loop=False, fps=6)
    def _(i, n): k = ease(i / (n - 1)); pose(1.2 - 0.75 * k, lerp(0, -0.9, k), -0.4 * k, (lerp(0, 1.4, k), lerp(0, 1.2, k)), (lerp(0, -2.2, k), lerp(0, -2.0, k)), (lerp(0.3, -0.4, k), 0.4), (0.3, 0.6), ht=lerp(0, 0.8, k), mace=lerp(0.2, 1.4, k))
    R.run(OUT)

# =====================================================================
elif NAME == 'moth':
    R = Renderer(640, 7.6, 1.6, samples=24); m = M()
    fur = bl.mat('fur', (0.88, 0.88, 0.9), rough=0.9, sheen=1.0, sss=0.4, sss_scale=0.06)
    bl.noise_bump(fur, 40, 0.8, distance=0.05)
    wm = moth_wing_mat((0.85, 0.83, 0.8), (0.25, 0.2, 0.22), (0.4, 0.8, 1))
    root = E('root'); body = E('body', (0, 0, 1.5), root)
    th = bl.sphere('thorax', (0.2, 0, 0.1), (0.62, 0.55, 0.6)); th.data.materials.append(fur); bl.displace(th, 0.08, 0.15, subsurf=1); put(th, body)
    ab = bl.sphere('abd', (-0.75, 0, -0.25), (0.75, 0.45, 0.45), rot=(0, 0.35, 0)); ab.data.materials.append(fur); put(ab, body)
    for k in range(5):
        r = bl.tube('ring', [(-0.4 - k * 0.22 + 0.25 * math.cos(a) * 0, 0.45 * math.cos(a) * 0.95, -0.12 - k * 0.07 + 0.45 * math.sin(a) * 0.95) for a in [j / 16 * 6.28 for j in range(16)]], [0.03] * 16)
        r.data.splines[0].use_cyclic_u = True; r.data.materials.append(m['pale']); put(r, body)
    head = E('head', (0.75, 0, 0.25), body)
    hh = bl.sphere('h', (0.1, 0, 0), (0.35, 0.33, 0.32)); hh.data.materials.append(fur); put(hh, head)
    for y in (-0.22, 0.22):
        e = bl.sphere('eye', (0.28, y, 0.05), (0.17, 0.15, 0.2)); e.data.materials.append(m['black']); put(e, head)
        hl = bl.sphere('hl', (0.36, y - 0.08, 0.12), (0.03, 0.02, 0.03)); hl.data.materials.append(m['glowblue']); put(hl, head)
        pts = [(0.2, y * 0.5, 0.25), (0.45, y * 1.6, 0.85), (0.35, y * 2.5, 1.4), (0.05, y * 3.0, 1.7)]
        an = bl.tube('ant', pts, [0.03, 0.025, 0.02, 0.01]); an.data.materials.append(m['pale']); put(an, head)
        for k in range(14):  # feathery barbs
            u = (k + 1) / 15; a0 = Vector(pts[0]).lerp(Vector(pts[-1]), u); bz = 0.25 * math.sin(u * P)
            b = bl.tube('barb', [(a0.x, a0.y, a0.z + bz), (a0.x + 0.12, a0.y, a0.z + bz + 0.07)], [0.01, 0.003]); b.data.materials.append(m['pale']); put(b, head)
    # crown of glowing dust
    for k in range(9):
        a = k / 9 * P
        s = bl.sphere('crown', (0.1 + math.cos(a) * 0.45, 0.0, 0.5 + math.sin(a) * 0.3), (0.05,) * 3, seg=8, rings=6); s.data.materials.append(m['glowblue']); put(s, head)
    wings = []
    for k, (y, sc, zf) in enumerate(((-0.35, 1.0, 1.0), (0.4, 0.92, 0.95))):
        fw = E('fw%d' % k, (0.15, y, 0.35), body)
        pts = [(0.3, 0, 0), (0.6, 0, 1.0 * sc), (0.2, 0, 2.3 * sc), (-0.8, 0, 3.0 * sc), (-1.8, 0, 2.6 * sc), (-2.1, 0, 1.6 * sc), (-1.4, 0, 0.6 * sc), (-0.5, 0, -0.05)]
        w = wing('fwing', pts, wm); put(w, fw)
        for (cx, cz, rr) in ((-0.9, 1.9, 0.38), (-0.2, 1.1, 0.18)):
            o = bl.tube('spot', [(cx * sc + rr * math.cos(a), -0.03, cz * sc + rr * math.sin(a)) for a in [j / 20 * 6.28 for j in range(20)]], [0.04] * 20); o.data.splines[0].use_cyclic_u = True; o.data.materials.append(m['glowblue']); put(o, fw)
            c = bl.sphere('spc', (cx * sc, -0.025, cz * sc), (rr * 0.45, 0.01, rr * 0.45)); c.data.materials.append(m['black']); put(c, fw)
        hw = E('hw%d' % k, (-0.3, y, -0.1), body)
        pts2 = [(0.2, 0, 0), (-0.3, 0, -0.4 * sc), (-1.4, 0, -1.2 * sc), (-2.0, 0, -0.9 * sc), (-1.6, 0, -0.2 * sc), (-0.6, 0, 0.1)]
        w2 = wing('hwing', pts2, wm); put(w2, hw)
        tail = bl.tube('tail', [(-1.4 * sc, -0.02, -1.15 * sc), (-1.9, -0.02, -1.6), (-2.1, -0.02, -2.0)], [0.12, 0.07, 0.03]); tail.data.materials.append(wm); put(tail, hw)
        wings.append((fw, hw))
    for k in range(3):  # legs
        for y in (-0.3, 0.3):
            lg = bl.tube('leg', [(0.3 - k * 0.25, y, -0.35), (0.45 - k * 0.25, y * 1.4, -0.75), (0.35 - k * 0.25, y * 1.3, -1.1)], [0.04, 0.03, 0.015]); lg.data.materials.append(m['pale']); put(lg, body)
    rim_lights((0, 0, 1.8), 2.5, rim=(0.65, 0.85, 1.0)); R.camera()
    def pose(t, amp=0.7, base=0.0, tilt=0.0, bob=0.0, hindlag=0.4, ht=0.0):
        for k, (fw, hw) in enumerate(wings):
            a = base + amp * math.sin(t + k * 0.35)
            fw.rotation_euler = (a * (1 if k == 0 else 0.9), 0, 0); hw.rotation_euler = (base + amp * math.sin(t - hindlag + k * 0.35) * 0.8, 0, 0)
        body.rotation_euler = (0, tilt, 0); body.location.z = 1.5 + bob; head.rotation_euler = (0, ht, 0)
    @R.anim('idle', 6, fps=10)
    def _(i, n): t = i / n * 2 * P; pose(t, 0.7, 0.0, -0.05, 0.08 * math.sin(t + 1))
    @R.anim('windup', 4, fps=10)
    def _(i, n): t = i / n * 2 * P; pose(t, 0.35, -0.6, -0.35, 0.15, ht=-0.3)
    @R.anim('dive', 4, fps=12)
    def _(i, n): t = i / n * 2 * P; pose(t * 0.3, 0.12, 0.9, 0.55, 0, ht=0.3)
    @R.anim('dust', 4, fps=10)
    def _(i, n): t = i / n * 2 * P; pose(t, 1.0, -0.2, -0.15, 0.1 * math.sin(t))
    @R.anim('death', 4, loop=False, fps=6)
    def _(i, n): k = i / (n - 1); pose(0, 0.0, lerp(0, 1.3, k), lerp(0, 1.2, k), -0.5 * k, ht=0.6 * k)
    R.run(OUT)

# =====================================================================
elif NAME == 'angler':
    R = Renderer(640, 8.0, 2.6, cx=0.4, samples=24); m = M()
    skin = bl.noise_bump(bl.mat('skin', (0.05, 0.065, 0.075), rough=0.35, coat=0.5, sss=0.2, sss_scale=0.1), 6, 0.6, distance=0.08)
    belly = bl.mat('belly', (0.35, 0.38, 0.36), rough=0.5, sss=0.4, sss_scale=0.1)
    teeth = bl.mat('teeth', (0.9, 0.88, 0.8), rough=0.2, sss=0.3, sss_scale=0.02)
    eyem = bl.mat('eyem', (0.75, 0.85, 0.8), rough=0.05, coat=1, emit=(0.4, 0.8, 0.7), emit_strength=1.0)
    root = E('root'); body = E('body', (0, 0, 2.4), root)
    hd = bl.sphere('head', (0.3, 0, 0.35), (2.0, 1.5, 1.45)); hd.data.materials.append(skin); bl.displace(hd, 0.1, 0.8, subsurf=1); put(hd, body)
    tailp = E('tailp', (-1.6, 0, 0.2), body)
    tl = bl.sphere('tail', (-0.3, 0, 0), (1.6, 0.95, 0.95)); tl.data.materials.append(skin); put(tl, tailp)
    fin = wing('tfin', [(-1.7, 0, 0), (-2.8, 0, 1.0), (-3.0, 0, 0.2), (-2.9, 0, -0.7), (-1.8, 0, -0.2)], skin, 0.04); put(fin, tailp)
    dfin = wing('dfin', [(-0.8, 0, 1.6), (-0.2, 0, 2.3), (0.3, 0, 1.75)], skin, 0.04); put(dfin, body)
    jaw = E('jaw', (1.2, 0, -0.35), body)
    lj = bl.sphere('lowjaw', (0.55, 0, -0.35), (1.35, 1.25, 0.55)); lj.data.materials.append(belly); put(lj, jaw)
    for k in range(11):  # lower teeth
        a = -1.2 + k * 0.24; x = 0.55 + math.cos(a) * 1.2; y = math.sin(a) * 1.0
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.07, radius2=0.0, depth=random.uniform(0.35, 0.75), location=(x, y - 0.25, 0.05)); tt = bpy.context.object; tt.rotation_euler = (0, random.uniform(-0.3, 0.2), 0); tt.data.materials.append(teeth); put(tt, jaw)
    for k in range(11):  # upper teeth
        a = -1.2 + k * 0.24; x = 1.6 + math.cos(a) * 0.9; y = math.sin(a) * 1.0
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.07, radius2=0.0, depth=random.uniform(0.4, 0.9), location=(x, y - 0.25, -0.35)); tt = bpy.context.object; tt.rotation_euler = (P, random.uniform(-0.2, 0.3), 0); tt.data.materials.append(teeth); put(tt, body)
    mouth = bl.sphere('maw', (1.75, -0.2, -0.3), (0.75, 1.05, 0.55)); mouth.data.materials.append(m['black']); put(mouth, body)
    eye = bl.sphere('eye', (1.2, -1.1, 0.95), (0.28, 0.12, 0.28)); eye.data.materials.append(eyem); put(eye, body)
    pup = bl.sphere('pup', (1.24, -1.2, 0.95), (0.06, 0.03, 0.1)); pup.data.materials.append(m['black']); put(pup, body)
    pec = E('pec', (0.0, -1.2, -0.6), body)
    pf = wing('pfin', [(0, 0, 0), (-0.6, 0, -0.9), (-1.3, 0, -0.8), (-0.9, 0, -0.1)], skin, 0.04); put(pf, pec)
    stalk = E('stalk', (1.4, 0, 1.6), body)
    st = bl.tube('st', [(0, 0, 0), (0.4, 0, 0.9), (1.4, 0, 1.3), (2.1, 0, 0.9)], [0.07, 0.06, 0.05, 0.04]); st.data.materials.append(skin); put(st, stalk)
    bulb = bl.sphere('bulb', (2.15, 0, 0.72), (0.18, 0.18, 0.22)); bulb.data.materials.append(m['glowblue']); put(bulb, stalk)
    lure = bl.light('POINT', (2.15, -0.5, 0.6), 200, (0.4, 0.8, 1.0), size=0.3); put(lure, stalk, (2.15, -0.5, 0.6))
    for k in range(20):  # barnacles / scars
        a = random.uniform(0, 6.28); z = random.uniform(-0.3, 1.2)
        s = bl.sphere('bn', (random.uniform(-1.2, 1.0), -1.35 + random.uniform(0, 0.2), z), (random.uniform(0.05, 0.14),) * 3, seg=8, rings=6); s.data.materials.append(belly); put(s, body)
    rim_lights((0, 0, 2.4), 3.0, key=(0.6, 0.75, 0.9), rim=(0.4, 0.75, 1.0)); R.camera()
    R.points = {'lure': bulb}
    def pose(jawa=0.1, tail=0.0, pitch=0.0, bob=0.0, fin=0.0):
        jaw.rotation_euler = (0, jawa, 0); tailp.rotation_euler = (0, 0, tail); body.rotation_euler = (0, pitch, 0); body.location.z = 2.4 + bob; pec.rotation_euler = (0, fin, 0)
        stalk.rotation_euler = (0, -pitch * 0.5 + 0.1 * math.sin(tail * 3), 0)
    @R.anim('idle', 4, fps=6)
    def _(i, n): t = i / n * 2 * P; pose(0.15 + 0.05 * math.sin(t), 0.2 * math.sin(t), 0, 0.06 * math.sin(t), 0.3 * math.sin(t))
    @R.anim('lunge', 4, fps=10)
    def _(i, n): t = i / n * 2 * P; pose(0.45, 0.45 * math.sin(t), 0.05, 0.08 * math.sin(t * 2), 0.5 * math.sin(t))
    @R.anim('snap', 4, loop=False, fps=10)
    def _(i, n): k = [0.2, 0.75, 0.6, 0.1][i]; pose(k, 0.1, -0.5, 0, -0.3)
    @R.anim('spit', 4, fps=8)
    def _(i, n): k = [0.1, 0.5, 0.65, 0.3][i]; pose(k, 0.15 * math.sin(i), -0.25, 0, 0.2)
    @R.anim('death', 4, loop=False, fps=6)
    def _(i, n): k = i / (n - 1); pose(0.5 * k, 0, 0.6 * k, -0.3 * k, 0)
    R.run(OUT)

# =====================================================================
elif NAME == 'vesper':
    R = Renderer(448, 4.4, 1.8, samples=24); m = M()
    white = bl.noise_bump(bl.mat('white', (0.82, 0.8, 0.86), rough=0.85, sheen=0.8), 30, 0.25)
    violet = bl.mat('violet', (0.25, 0.08, 0.4), rough=0.7, sheen=0.6)
    mask = bl.mat('mask', (0.95, 0.93, 0.9), rough=0.25, sss=0.3, sss_scale=0.02, coat=0.6)
    root = E('root'); hips = E('hips', (0, 0, 1.15), root)
    robe = jagged_cone('robe', 0.62, 0.22, 1.25, seg=36, rings=10, jag=0.22, z0=-1.15); robe.data.materials.append(white); put(robe, hips)
    base_co = [v.co.copy() for v in robe.data.vertices]
    torso = E('torso', (0, 0, 0.05), hips)
    ch = bl.sphere('ch', (0, 0, 0.5), (0.22, 0.18, 0.45)); ch.data.materials.append(white); put(ch, torso)
    sash = bl.tube('sash', [(0.22 * math.cos(a), 0.18 * math.sin(a), 0.2) for a in [j / 16 * 6.28 for j in range(16)]], [0.05] * 16); sash.data.splines[0].use_cyclic_u = True; sash.data.materials.append(violet); put(sash, torso)
    capeE = E('capeE', (-0.1, 0, 0.85), torso)
    cape = bl.ribbon('cape', [(0, 0.1, 0), (-0.25, 0.12, -0.4), (-0.4, 0.12, -0.9), (-0.45, 0.12, -1.4), (-0.5, 0.12, -1.8)], [0.5, 0.55, 0.6, 0.6, 0.5], thickness=0.02); cape.data.materials.append(violet); put(cape, capeE)
    head = E('head', (0.02, 0, 1.0), torso)
    hood = bl.sphere('hood', (-0.03, 0, 0.18), (0.2, 0.2, 0.26)); hood.data.materials.append(white); put(hood, head)
    mk = bl.sphere('mask', (0.08, -0.08, 0.16), (0.15, 0.12, 0.22)); mk.data.materials.append(mask); put(mk, head)
    for y, ex in ((-0.17, 0.12), (-0.12, 0.2)):
        e = bl.sphere('eye', (ex, y, 0.17), (0.035, 0.015, 0.06), rot=(0, 0.5, 0)); e.data.materials.append(m['glowviolet']); put(e, head)
    for k in range(9):  # halo of glass shards
        a = P * 0.1 + k / 8 * P * 0.8
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.04, radius2=0, depth=0.35, location=(-0.08 + math.cos(a) * 0.42, 0.15, 0.2 + math.sin(a) * 0.42))
        c = bpy.context.object; c.rotation_euler = (0, P / 2 - a, 0); c.data.materials.append(m['crystal']); put(c, head)
    for side in (-1, 1):  # moth antennae on mask
        an = bl.tube('an', [(0.05, side * 0.05, 0.35), (0.12, side * 0.12, 0.6), (0.02, side * 0.2, 0.75)], [0.015, 0.01, 0.004]); an.data.materials.append(mask); put(an, head)
    armR = E('armR', (0.05, -0.2, 0.85), torso)
    ua = bl.tube('ua', [(0, 0, 0), (0.05, 0, -0.32)], [0.07, 0.06]); ua.data.materials.append(white); put(ua, armR)
    elR = E('elR', (0.05, 0, -0.34), armR)
    fa = bl.tube('fa', [(0, 0, 0), (0.05, 0, -0.3)], [0.06, 0.05]); fa.data.materials.append(white); put(fa, elR)
    hand = E('hand', (0.05, 0, -0.32), elR)
    rap = bl.tube('rapier', [(0, 0, 0), (0.7, 0, 0), (1.5, 0, 0)], [0.03, 0.02, 0.002], bevel_res=3); rap.data.materials.append(m['crystal']); put(rap, hand)
    gd = bl.sphere('guard', (0.02, 0, 0), (0.05, 0.12, 0.08)); gd.data.materials.append(m['glowviolet']); put(gd, hand)
    armL = E('armL', (-0.05, 0.2, 0.85), torso)
    ul = bl.tube('ul', [(0, 0, 0), (0.0, 0, -0.6)], [0.07, 0.05]); ul.data.materials.append(white); put(ul, armL)
    rim_lights((0, 0, 1.5), 1.4, rim=(0.75, 0.6, 1.0)); R.camera()
    def robe_wind(trail=0.0, flare=1.0, lift=0.0):
        zmin = min(c.z for c in base_co); zmax = max(c.z for c in base_co)
        for v, b in zip(robe.data.vertices, base_co):
            t = (b.z - zmin) / (zmax - zmin); w = (1 - t) ** 2
            v.co = (b.x * (1 + (flare - 1) * w) - trail * w * 0.5, b.y * (1 + (flare - 1) * w), b.z + lift * w * 0.3)
        robe.data.update()
    def pose(hz=1.15, lean=0.0, hx=0.0, sR=(0.3, -0.3), wR=0.0, sL=0.2, ht=0.0, cape=0.0, trail=0.0, flare=1.0, lift=0.0):
        hips.location = (hx, 0, hz); torso.rotation_euler = (0, lean, 0); head.rotation_euler = (0, ht, 0)
        armR.rotation_euler = (0, sR[0], 0); elR.rotation_euler = (0, sR[1], 0); hand.rotation_euler = (0, wR, 0); armL.rotation_euler = (0, sL, 0)
        capeE.rotation_euler = (0, cape, 0); robe_wind(trail, flare, lift)
    @R.anim('idle', 4, fps=5)
    def _(i, n): t = i / n * 2 * P; pose(1.15 + 0.015 * math.sin(t), 0.02, 0, (0.5, -0.9), 0.9, 0.15, 0.03 * math.sin(t), -0.1 + 0.05 * math.sin(t), 0.05, 1.0 + 0.02 * math.sin(t))
    @R.anim('ready', 3, fps=6)
    def _(i, n): pose(1.0, 0.25, 0, (-0.3, -0.6), 0.3, -0.5, -0.15, -0.4, 0.2, 1.1)
    @R.anim('lunge', 3, fps=12)
    def _(i, n): pose(0.95, 0.7, 0.1, (1.4, 0.0), 0.15, -1.2, -0.3, -1.1, 1.2, 0.9, 0.4)
    @R.anim('recover', 3, loop=False, fps=6)
    def _(i, n): k = i / (n - 1); pose(1.0 + 0.1 * k, lerp(0.5, 0.1, k), 0, (lerp(1.2, 0.4, k), lerp(0, -0.6, k)), 0.5, -0.3, 0.1, -0.5, lerp(0.6, 0.1, k), 1.05)
    @R.anim('plunge', 2, fps=8)
    def _(i, n): pose(1.2, 0.0, 0, (2.9, 0.0), 0.0, 2.6, 0.2, 0.6, -0.2, 0.8, 1.2)
    @R.anim('throw', 3, loop=False, fps=10)
    def _(i, n): k = i / (n - 1); pose(1.15, lerp(-0.3, 0.3, k), 0, (lerp(-1.5, 0.9, k), -0.2), 0.4, lerp(-1.0, 0.8, k), 0.1, -0.5, 0.3, 1.15, 0.5)
    @R.anim('death', 6, loop=False, fps=6)
    def _(i, n): k = ease(i / (n - 1)); pose(lerp(1.15, 0.45, k), lerp(0, -0.5, k), 0, (lerp(0.4, -0.2, k), -0.4), lerp(0.9, 1.6, k), 0.4, lerp(0, 0.7, k), 0.3, 0.0, lerp(1.0, 1.6, k), 0)
    R.run(OUT)

# =====================================================================
elif NAME == 'extinguisher':
    R = Renderer(640, 11.0, 4.6, samples=24); m = M()
    bronze = bl.noise_bump(bl.mat('bronze', (0.35, 0.2, 0.1), rough=0.38, metal=1.0, coat=0.2), 10, 0.5)
    verd = bl.mat('verd', (0.1, 0.25, 0.2), rough=0.7, metal=0.3)
    cloth = bl.noise_bump(bl.mat('cloth', (0.008, 0.007, 0.009), rough=0.95, sheen=0.25), 15, 0.6)
    root = E('root'); body = E('body', (0, 0, 0), root)
    cloak = jagged_cone('cloak', 2.6, 1.1, 6.3, seg=48, rings=12, jag=0.9, wav=0.12, z0=0.1); cloak.data.materials.append(cloth); put(cloak, body)
    base_co = [v.co.copy() for v in cloak.data.vertices]
    for k in range(9):  # tattered strips
        a = random.uniform(-2.5, 2.5); x0, y0 = math.cos(a) * 2.3, math.sin(a) * 1.6
        rb = bl.ribbon('strip', [(x0, y0 - 0.1, 2.5), (x0 * 1.05, y0 - 0.1, 1.2), (x0 * 1.1, y0 - 0.1, 0.0), (x0 * 1.12, y0 - 0.1, -0.6)], [0.5, 0.45, 0.35, 0.15], thickness=0.03)
        rb.data.materials.append(cloth); put(rb, body)
    collar = bl.cyl('collar', (0, 0, 6.4), 1.3, 0.5, verts=32, r2=1.0); collar.data.materials.append(cloth); put(collar, body)
    head = E('head', (0, 0, 6.6), body)
    bell = bl.cyl('bell', (0, 0, 1.4), 1.55, 2.8, verts=48, r2=0.45); bell.data.materials.append(bronze); put(bell, head)
    lip = bl.tube('lip', [(1.6 * math.cos(a), 1.6 * math.sin(a), 0.02) for a in [j / 32 * 6.28 for j in range(32)]], [0.12] * 32); lip.data.splines[0].use_cyclic_u = True; lip.data.materials.append(bronze); put(lip, head)
    for zz, rr in ((0.9, 1.33), (2.0, 0.85)):
        b = bl.tube('band', [(rr * math.cos(a), rr * math.sin(a), zz) for a in [j / 32 * 6.28 for j in range(32)]], [0.06] * 32); b.data.splines[0].use_cyclic_u = True; b.data.materials.append(verd); put(b, head)
    knob = bl.sphere('knob', (0, 0, 3.0), (0.35, 0.35, 0.35)); knob.data.materials.append(bronze); put(knob, head)
    ring = bl.tube('hring', [(0.25 * math.cos(a), 0, 3.5 + 0.3 * math.sin(a)) for a in [j / 16 * 6.28 for j in range(16)]], [0.07] * 16); ring.data.splines[0].use_cyclic_u = True; ring.data.materials.append(bronze); put(ring, head)
    slit = bl.cube('slit', (0.55, -1.3, 0.85), (0.7, 0.2, 0.07), rot=(0, 0, -0.25)); slit.data.materials.append(m['ember2']); put(slit, head)
    for k in range(12):  # glowing cracks
        a = random.uniform(-1.7, -0.5); z = random.uniform(0.3, 2.3); rr = 1.5 - z * 0.38
        c = bl.tube('crack', [(rr * math.cos(a), rr * math.sin(a) - 0.02, z), (rr * math.cos(a + 0.12), rr * math.sin(a + 0.12) - 0.02, z + random.uniform(-0.3, 0.3))], [0.02, 0.01]); c.data.materials.append(m['ember']); put(c, head)
    hl = bl.light('POINT', (0.5, -2.2, 7.4), 300, (1, 0.4, 0.1), size=0.5); put(hl, head, (0.5, -2.2, 0.8))
    arms = []
    for side, y in ((1, -1.4), (-1, 1.4)):
        sh = E('sh', (0.3, y, 5.6), body)
        sl = jagged_cone('sleeve', 0.8, 0.45, 2.3, seg=24, rings=6, jag=0.5, z0=-2.3, flat=1.0); sl.data.materials.append(cloth); put(sl, sh)
        el = E('el', (0, 0, -2.2), sh)
        fa = bl.tube('bonearm', [(0, 0, 0), (0.1, 0, -1.4)], [0.14, 0.1]); fa.data.materials.append(m['bone']); put(fa, el)
        hd = E('hand', (0.1, 0, -1.5), el)
        for k in range(4):
            f = bl.tube('finger', [(0, 0, 0), (0.25 + k * 0.03, (k - 1.5) * 0.12, -0.35), (0.35, (k - 1.5) * 0.14, -0.8)], [0.06, 0.045, 0.01]); f.data.materials.append(m['bone']); put(f, hd)
        arms.append((sh, el))
    rim_lights((0, 0, 4.5), 4.0, key=(1, 0.75, 0.6), rim=(1, 0.45, 0.25)); R.camera()
    def cloak_wind(trail=0.0, flare=1.0, lift=0.0, ph=0.0):
        zmin = min(c.z for c in base_co); zmax = max(c.z for c in base_co)
        for v, b in zip(cloak.data.vertices, base_co):
            t = (b.z - zmin) / (zmax - zmin); w = (1 - t) ** 2
            v.co = (b.x * (1 + (flare - 1) * w) - trail * w, b.y * (1 + (flare - 1) * w), b.z + lift * w + 0.15 * w * math.sin(math.atan2(b.y, b.x) * 4 + ph))
        cloak.data.update()
    def pose(bob=0.0, lean=0.0, ht=0.0, a1=(0.2, -0.3), a2=(0.1, -0.2), trail=0.2, flare=1.0, lift=0.0, ph=0.0):
        body.location.z = bob; body.rotation_euler = (0, lean, 0); head.rotation_euler = (0, ht, 0)
        arms[0][0].rotation_euler = (0, a1[0], 0); arms[0][1].rotation_euler = (0, a1[1], 0)
        arms[1][0].rotation_euler = (0, a2[0], 0); arms[1][1].rotation_euler = (0, a2[1], 0)
        cloak_wind(trail, flare, lift, ph)
    @R.anim('idle', 6, fps=6)
    def _(i, n): t = i / n * 2 * P; pose(0.1 * math.sin(t), 0.04, 0.03 * math.sin(t), (0.3 + 0.1 * math.sin(t), -0.5), (0.2, -0.4), 0.2, 1.0, 0.1 * math.sin(t), t)
    @R.anim('raise', 3, loop=False, fps=6)
    def _(i, n): k = (i + 1) / n; pose(0.3 * k, -0.2 * k, -0.3 * k, (-2.2 * k, -0.6 * k), (-2.0 * k, -0.5 * k), 0.1, 1.15, 0.4 * k, i)
    @R.anim('slam', 2, fps=8)
    def _(i, n): pose(0, 0.35, 0.4, (1.0, -0.2), (0.9, -0.2), -0.4, 0.85, -0.3, i)
    @R.anim('down', 3, fps=5)
    def _(i, n): t = i / n * 2 * P; pose(-0.3, 0.5, 0.55 + 0.03 * math.sin(t), (1.2, 0.2), (1.1, 0.2), 0.0, 1.35, 0.0, t)
    @R.anim('cast', 4, fps=7)
    def _(i, n): t = i / n * 2 * P; pose(0.15, -0.1, -0.15, (-1.2 + 0.2 * math.sin(t), -1.0), (-0.9 - 0.2 * math.sin(t), -1.1), 0.1, 1.1, 0.3, t)
    @R.anim('breath', 4, fps=8)
    def _(i, n): t = i / n * 2 * P; pose(0.1, 0.25, 0.35, (0.6, -1.4), (0.5, -1.3), -0.6, 1.25, 0.6, t * 2)
    @R.anim('death', 6, loop=False, fps=6)
    def _(i, n): k = ease(i / (n - 1)); pose(-1.5 * k, lerp(0, -0.4, k), lerp(0, 0.9, k), (lerp(0.2, 1.4, k), 0.2), (lerp(0.1, 1.3, k), 0.1), 0.0, lerp(1, 1.8, k), -0.5 * k, k * 3)
    R.run(OUT)
