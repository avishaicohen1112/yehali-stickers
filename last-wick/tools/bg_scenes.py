"""Backgrounds for crypts, gardens, spire, hearth. python3 bg_scenes.py AREA LAYER SAMPLES"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bl, gothic as GT, bgcommon as BC
from mathutils import Vector
AREA, LAYER = sys.argv[1], sys.argv[2]; SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 48
random.seed(hash(AREA) % 1000)
RES = tuple(int(v) for v in os.environ.get('BGRES', '2640x1100').split('x'))
sc = BC.setup(RES, SAMPLES, transparent=(LAYER != 'far'))
OUT = os.path.join(BC.BGDIR, '_tmp_%s_%s.png' % (AREA, LAYER))

def wax_pillar(x, y, h, r, wax):
    o = bl.cyl('wp', (x, y, h / 2), r, h, verts=24); o.data.materials.append(wax)
    bl.displace(o, r * 0.25, 0.8, subsurf=2)
    for k in range(10):
        a = random.uniform(0, 6.28); z = random.uniform(h * 0.3, h)
        L = random.uniform(0.5, 3.0); rr = random.uniform(0.08, 0.2)
        t = bl.tube('d', [(x + math.cos(a) * r, y + math.sin(a) * r, z), (x + math.cos(a) * r * 1.05, y + math.sin(a) * r * 1.05, z - L)], [rr, rr * 0.6], bevel_res=4, res=4)
        t.data.materials.append(wax)
        s = bl.sphere('db', (x + math.cos(a) * r * 1.05, y + math.sin(a) * r * 1.05, z - L), (rr * 0.9,) * 3, seg=10, rings=6); s.data.materials.append(wax)
    return o

def mushroom(x, y, z, h, cr, stem, cap, under):
    t = bl.tube('st', [(x, y, z), (x + random.uniform(-0.3, 0.3) * h, y, z + h * 0.5), (x + random.uniform(-0.2, 0.2) * h, y, z + h)], [cr * 0.16, cr * 0.12, cr * 0.1], bevel_res=4, res=6)
    t.data.materials.append(stem); top = t.data.splines[0].bezier_points[-1].co
    c = bl.sphere('cap', (top.x, y, z + h), (cr, cr, cr * 0.45)); c.data.materials.append(cap)
    u = bl.sphere('und', (top.x, y, z + h - cr * 0.1), (cr * 0.92, cr * 0.92, cr * 0.2)); u.data.materials.append(under)
    return (top.x, y, z + h)

def flower(x, y, z, R, petal, core, n=9):
    for layer in range(2):
        for k in range(n):
            a = k / n * 2 * math.pi + layer * 0.35
            p = bl.sphere('pt', (x + math.cos(a) * R * 0.55, y + math.sin(a) * R * 0.55, z + R * 0.25 + layer * R * 0.12), (R * 0.55, R * 0.22, R * 0.08))
            p.rotation_euler = (0, -0.7 - layer * 0.4, a); p.data.materials.append(petal)
    c = bl.sphere('core', (x, y, z + R * 0.35), (R * 0.25,) * 3); c.data.materials.append(core)

def crystal(x, y, z, L, r, mat, tilt=(0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, radius2=0, depth=L, location=(x, y, z + L / 2))
    o = bpy.context.object; o.rotation_euler = (tilt[0], tilt[1], random.uniform(0, 1)); o.data.materials.append(mat)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, radius2=r, depth=L * 0.25, location=(x, y, z))
    o2 = bpy.context.object; o2.rotation_euler = o.rotation_euler; o2.data.materials.append(mat)
    return o

def hall(stone, stone2, n=12, span=5.0, width=5.2, colh=14, start=1):
    for side in (-1, 1):
        for k in range(start, n + 1):
            GT.column('col', side * width, k * span, -1, colh, 0.55, stone)
        for k in range(start, n):
            pts, apex = GT.pointed_arch_curve(span, 0, 0, n=14)
            p3 = [(side * width, k * span + span / 2 + px, colh - 1 + pz * 0.9) for px, pz in pts[1:-1]]
            t = bl.tube('la', p3, [0.22] * len(p3), bevel_res=3, res=3); t.data.materials.append(stone)
        bl.cube('wallup', (side * (width + 0.4), n * span / 2 + 2, colh + 10), (0.3, n * span / 2 + 4, 10)).data.materials.append(stone2)
    for k in range(start, n + 1):
        GT.rib_vault('tv', -width, width, k * span, colh + 7, 6, stone, r=0.18)

if AREA == 'crypts' and LAYER == 'far':
    stone = GT.stone_mat('stone', (0.12, 0.08, 0.06), (0.25, 0.18, 0.13), 2.5)
    stone2 = GT.stone_mat('stone2', (0.06, 0.04, 0.035), (0.13, 0.09, 0.07), 4)
    wax = bl.mat('wax', (0.9, 0.78, 0.58), rough=0.35, sss=0.6, sss_radius=(1, 0.45, 0.2), sss_scale=0.3)
    flame = GT.emis('flame', (1, 0.5, 0.15), 40)
    ember = GT.emis('ember', (1, 0.4, 0.1), 6)
    bl.world_color((0.01, 0.006, 0.004), 1)
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 40, 0)); f = bpy.context.object; f.data.materials.append(stone2)
    hall(stone, stone2, n=12, span=5.0, width=6.0, colh=12)
    # side walls with niches full of candles
    for side in (-1, 1):
        bl.cube('w', (side * 11, 30, 12), (0.5, 34, 14)).data.materials.append(stone2)
        for k in range(12):
            for row in range(3):
                y = 2 + k * 5; z = 1.5 + row * 3.2
                for j in range(random.randint(3, 6)):
                    GT.candle(side * 10.3, y + random.uniform(-1.6, 1.6), z, random.uniform(0.2, 0.6), 0.08, wax, flame, light=(j == 0 and row == 1), energy=25)
    # the great dead candle at the end
    wax_pillar(0, 66, 26, 4.5, wax)
    bl.cube('endwall', (0, 72, 20), (16, 0.6, 24)).data.materials.append(stone2)
    gl = bl.light('POINT', (0, 61, 4), 20000, (1, 0.45, 0.15), size=3)
    for i in range(40):
        a = random.uniform(0, 6.28); r = random.uniform(5, 9)
        GT.candle(math.cos(a) * r, 64 + math.sin(a) * r * 0.5, 0, random.uniform(0.3, 1.2), random.uniform(0.1, 0.2), wax, flame, light=(i % 6 == 0), energy=60)
    # wax pillars and drip-falls along hall
    for k in range(2, 12, 3):
        for side in (-1, 1):
            wax_pillar(side * random.uniform(2.5, 4), k * 5 + 2.5, random.uniform(2, 6), random.uniform(0.3, 0.7), wax)
    for i in range(70):
        GT.candle(random.uniform(-4.5, 4.5), random.uniform(4, 58), 0, random.uniform(0.2, 0.7), 0.08, wax, flame, light=(i % 7 == 0), energy=30)
    L = bl.light('SPOT', (0, 60, 30), 60000, (1, 0.6, 0.3), size=1); L.data.spot_size = math.radians(30); L.data.spot_blend = 0.9; bl.look_at(L, (0, 20, 0))
    GT.fog_volume((0, 32, 14), (30, 80, 32), 0.03, (1.0, 0.8, 0.6), anis=0.5)
    bl.persp_cam((0, -6, 5), (0, 40, 10), lens=20)

elif AREA == 'gardens' and LAYER == 'far':
    stone = GT.stone_mat('stone', (0.08, 0.11, 0.09), (0.18, 0.24, 0.2), 2.5)
    stone2 = GT.stone_mat('stone2', (0.03, 0.05, 0.045), (0.08, 0.12, 0.1), 4)
    moss = bl.mat('moss', (0.06, 0.22, 0.09), rough=0.9, sheen=1.0)
    stem = bl.mat('stem', (0.6, 0.75, 0.7), rough=0.5, sss=0.6, sss_scale=0.2)
    capm = bl.mat('capm', (0.15, 0.5, 0.45), rough=0.4, sss=0.5, emit=(0.2, 0.9, 0.7), emit_strength=1.5)
    under = GT.emis('under', (0.3, 1.0, 0.8), 6)
    petal = bl.mat('petal', (1.0, 0.85, 0.6), rough=0.4, sss=0.8, sss_scale=0.3, emit=(1.0, 0.7, 0.35), emit_strength=2.5)
    core = GT.emis('core', (1, 0.8, 0.4), 25)
    vine = bl.mat('vine', (0.03, 0.08, 0.04), rough=0.8)
    water = bl.mat('water', (0.02, 0.05, 0.05), rough=0.05, coat=1)
    moth = GT.emis('moth', (0.85, 1.0, 1.0), 12)
    bl.world_color((0.003, 0.012, 0.01), 1)
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 40, 0)); f = bpy.context.object; f.data.materials.append(water)
    hall(stone, stone2, n=11, span=6.0, width=7.0, colh=14)
    # broken roof gaps: remove some upper wall pieces -> simply light from above
    for i in range(14):  # moss mounds
        o = bl.sphere('mound', (random.uniform(-9, 9), random.uniform(5, 60), -0.5), (random.uniform(2, 5), random.uniform(2, 4), random.uniform(0.5, 1.6))); o.data.materials.append(moss)
        bl.displace(o, 0.4, 1.0, subsurf=1)
    lights = []
    for i in range(26):
        x = random.choice([-1, 1]) * random.uniform(2, 9); y = random.uniform(6, 62)
        h = random.uniform(1.5, 8); cr = random.uniform(0.8, 2.6)
        p = mushroom(x, y, 0, h, cr, stem, capm, under)
        if i % 3 == 0: bl.light('POINT', (p[0], p[1], p[2] - cr * 0.5), 400 * cr, (0.3, 1, 0.8), size=cr)
    for i in range(10):
        x = random.choice([-1, 1]) * random.uniform(1, 6); y = random.uniform(8, 50)
        flower(x, y, random.uniform(0, 1.5), random.uniform(0.8, 1.8), petal, core)
        bl.light('POINT', (x, y, 1.8), 300, (1, 0.75, 0.4), size=0.5)
    # giant flower at the end
    flower(0, 64, 2, 6, petal, core, n=12); bl.light('POINT', (0, 62, 5), 12000, (1, 0.75, 0.4), size=3)
    bl.cube('endwall', (0, 70, 20), (16, 0.6, 24)).data.materials.append(stone2)
    for k in range(-2, 3):
        GT.lancet_window('w', k * 3.5, 69.3, 8, 2.4, 12, stone, GT.emis('gw', (0.4, 1.0, 0.8), 3))
    for i in range(50):  # hanging vines
        x = random.uniform(-8, 8); y = random.uniform(2, 64); L = random.uniform(3, 14); z0 = 22
        pts = [(x + math.sin(j * 0.7 + i) * 0.3, y, z0 - L * j / 6) for j in range(7)]
        t = bl.tube('v', pts, [0.06] * 7, bevel_res=2, res=3); t.data.materials.append(vine)
        if random.random() < 0.4: s = bl.sphere('vb', pts[-1], (0.15,) * 3, seg=8, rings=6); s.data.materials.append(under)
    for i in range(80):  # moths
        s = bl.sphere('m', (random.uniform(-7, 7), random.uniform(3, 60), random.uniform(2, 18)), (0.06, 0.06, 0.04), seg=6, rings=4); s.data.materials.append(moth)
    for (x, y) in ((-2, 20), (3, 35), (0, 50)):
        L = bl.light('SPOT', (x, y, 40), 120000, (0.75, 1.0, 0.9), size=0.5); L.data.spot_size = math.radians(9); L.data.spot_blend = 0.5; bl.look_at(L, (x + 1, y - 4, 0))
    GT.fog_volume((0, 34, 15), (34, 80, 36), 0.03, (0.75, 1.0, 0.92), anis=0.5)
    bl.persp_cam((0, -6, 4.5), (0, 40, 11), lens=20)

elif AREA == 'spire' and LAYER == 'far':
    stone = GT.stone_mat('stone', (0.14, 0.11, 0.2), (0.3, 0.24, 0.42), 2.5)
    stone2 = GT.stone_mat('stone2', (0.05, 0.04, 0.08), (0.12, 0.09, 0.18), 4)
    cry = bl.mat('cry', (0.7, 0.55, 1.0), rough=0.05, transmission=0.7, ior=1.45, emit=(0.6, 0.4, 1.0), emit_strength=2.5, coat=1)
    cry2 = GT.emis('cry2', (0.9, 0.7, 1.0), 10)
    floor = bl.mat('floor', (0.03, 0.025, 0.05), rough=0.08, coat=1)
    moon = GT.emis('moon', (0.85, 0.85, 1.0), 25)
    bl.world_color((0.006, 0.004, 0.012), 1)
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 40, 0)); f = bpy.context.object; f.data.materials.append(floor)
    hall(stone, stone2, n=10, span=6.0, width=7.5, colh=18)
    for side in (-1, 1):
        bl.cube('w', (side * 12.5, 30, 15), (0.5, 34, 17)).data.materials.append(stone2)
        for k in range(10):
            GT.lancet_window('lw', side * 12.0, 3 + k * 6, 3, 2.4, 14, stone, GT.emis('lwg', (0.5, 0.4, 1.0), 2.5))
    for o in bpy.data.objects:
        if o.name.startswith('lw'): pass
    bl.cube('endwall', (0, 64, 22), (18, 0.6, 26)).data.materials.append(stone2)
    GT.rose_window('rose', 0, 63.3, 24, 9, stone, [GT.emis('m1', (0.6, 0.5, 1.0), 6), GT.emis('m2', (0.85, 0.75, 1.0), 9), GT.emis('m3', (0.4, 0.3, 0.9), 5)], petals=16)
    s = bl.sphere('moon', (6, 80, 30), (5, 5, 5)); s.data.materials.append(moon)
    for i in range(40):
        side = random.choice([-1, 1]); x = side * random.uniform(3, 11); y = random.uniform(4, 60)
        for k in range(random.randint(3, 7)):
            crystal(x + random.uniform(-1, 1), y + random.uniform(-1, 1), -0.3, random.uniform(1, 7), random.uniform(0.2, 0.7), cry if k % 3 else cry2, (random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5)))
        if i % 4 == 0: bl.light('POINT', (x, y, 2), 600, (0.7, 0.5, 1.0), size=1)
    for i in range(60):  # floating shards
        o = crystal(random.uniform(-7, 7), random.uniform(5, 60), random.uniform(3, 20), random.uniform(0.2, 0.7), 0.08, cry2, (random.uniform(0, 3), random.uniform(0, 3)))
    for (x, z, e) in ((0, 24, 120000), (-3, 22, 30000), (3, 26, 30000)):
        L = bl.light('SPOT', (x, 62.5, z), e, (0.75, 0.7, 1.0), size=0.6); L.data.spot_size = math.radians(22); L.data.spot_blend = 0.8; bl.look_at(L, (x * 1.5, 12, 0))
    GT.fog_volume((0, 32, 18), (34, 76, 40), 0.03, (0.85, 0.8, 1.0), anis=0.55)
    bl.persp_cam((0, -6, 5), (0, 40, 14), lens=20)

elif AREA == 'hearth' and LAYER == 'far':
    stone = GT.stone_mat('stone', (0.1, 0.07, 0.06), (0.22, 0.15, 0.12), 2.5)
    stone2 = GT.stone_mat('stone2', (0.04, 0.03, 0.03), (0.1, 0.07, 0.06), 4)
    ember = GT.emis('ember', (1.0, 0.3, 0.06), 12)
    ash = bl.mat('ash', (0.06, 0.05, 0.05), rough=0.95)
    ring = GT.emis('ring', (1.0, 0.25, 0.08), 40)
    black = bl.mat('black', (0, 0, 0), rough=1)
    iron = bl.mat('iron', (0.08, 0.06, 0.05), rough=0.5, metal=0.9)
    bl.world_color((0.02, 0.004, 0.002), 1)
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 60, 0)); f = bpy.context.object; f.data.materials.append(ash); bl.displace(f, 1.5, 4, subsurf=0)
    # eclipse
    s = bl.sphere('ec', (0, 140, 48), (16, 1, 16)); s.data.materials.append(black)
    t = bl.tube('ring', [(math.cos(a) * 16.4, 141, 48 + math.sin(a) * 16.4) for a in [i / 48 * 6.283 for i in range(48)]], [0.6] * 48, bevel_res=3, res=2); t.data.splines[0].use_cyclic_u = True; t.data.materials.append(ring)
    bl.light('POINT', (0, 139, 48), 400000, (1, 0.3, 0.1), size=10)
    # giant dead brazier on stairs
    for i in range(12):
        bl.cube('step', (0, 40 + i * 1.6, i * 0.8 - 0.4), (14 - i * 0.6, 0.8, 0.4)).data.materials.append(stone)
    bz = bl.cyl('bz', (0, 62, 13), 7, 4, verts=48, r2=4); bz.data.materials.append(iron)
    bl.cyl('bzleg', (0, 62, 6), 1.2, 10, verts=24).data.materials.append(iron)
    for i in range(70):
        a = random.uniform(0, 6.28); r = random.uniform(0, 6)
        o = bl.sphere('coal', (math.cos(a) * r, 62 + math.sin(a) * r * 0.6, 15 + random.uniform(-0.3, 0.6)), (random.uniform(0.3, 0.8),) * 3, seg=8, rings=6); o.data.materials.append(ember if random.random() < 0.35 else ash)
    bl.light('POINT', (0, 60, 17), 30000, (1, 0.3, 0.08), size=4)
    # ruined spires silhouettes
    for i in range(16):
        x = random.choice([-1, 1]) * random.uniform(14, 50); y = random.uniform(60, 130); h = random.uniform(15, 55)
        o = bl.cyl('sp', (x, y, h / 2), random.uniform(1.5, 3.5), h, verts=8); o.data.materials.append(stone2)
        c = bl.cyl('spc', (x, y, h + 4), random.uniform(1.5, 3.5), 8, verts=8, r2=0); c.data.materials.append(stone2)
    # broken columns flanking the path
    for k in range(8):
        for side in (-1, 1):
            h = random.uniform(4, 16); GT.column('c', side * 9, 6 + k * 6, -1, h, 0.7, stone)
    for i in range(160):
        o = bl.sphere('e', (random.uniform(-25, 25), random.uniform(5, 100), random.uniform(0, 30)), (0.05,) * 3, seg=6, rings=4); o.data.materials.append(ember)
    GT.fog_volume((0, 60, 20), (90, 140, 50), 0.018, (1.0, 0.6, 0.45), anis=0.5)
    bl.persp_cam((0, -8, 6), (0, 60, 16), lens=22)

# -------- mid layers (transparent, ortho, near silhouettes) --------
elif LAYER == 'mid':
    pal = {'crypts': ((0.1, 0.07, 0.05), (1, 0.6, 0.3)), 'gardens': ((0.04, 0.07, 0.05), (0.4, 1, 0.8)), 'spire': ((0.08, 0.06, 0.12), (0.75, 0.6, 1.0)), 'hearth': ((0.06, 0.04, 0.035), (1, 0.4, 0.15))}[AREA]
    st = GT.stone_mat('st', pal[0], tuple(c * 2.2 for c in pal[0]), 3)
    rimc = pal[1]
    wax = bl.mat('wax', (0.9, 0.78, 0.58), rough=0.35, sss=0.6, sss_scale=0.2)
    flame = GT.emis('flame', (1, 0.5, 0.15), 40)
    random.seed(7)
    xs = [-10.5, -3, 4.5, 12]
    for x in xs:
        GT.column('mc', x + random.uniform(-1, 1), 0, -6, 22, random.uniform(0.7, 1.1), st)
    if AREA == 'crypts':
        for i in range(14):
            x = random.uniform(-13, 13); L = random.uniform(2, 8)
            t = bl.tube('ch', [(x, -1, 16 - L * j / 6) for j in range(7)], [0.035] * 7, bevel_res=2, res=2); t.data.materials.append(st)
            if random.random() < 0.6:
                c = bl.cyl('cen', (x, -1, 16 - L - 0.4), 0.3, 0.5, verts=12, r2=0.15); c.data.materials.append(st)
                GT.candle(x, -1.3, 16 - L - 0.2, 0.25, 0.07, wax, flame, light=True, energy=10)
        for x in (-7, 1, 8):
            wax_pillar(x, 0.5, random.uniform(3, 8), random.uniform(0.4, 0.8), wax)
    elif AREA == 'gardens':
        vine = bl.mat('vine', (0.03, 0.07, 0.04), rough=0.8); glow = GT.emis('glow', (0.3, 1, 0.8), 8)
        for i in range(30):
            x = random.uniform(-13, 13); L = random.uniform(3, 12)
            pts = [(x + math.sin(j + i) * 0.25, -1, 17 - L * j / 7) for j in range(8)]
            t = bl.tube('v', pts, [0.08, 0.07, 0.06, 0.06, 0.05, 0.05, 0.04, 0.03], bevel_res=2, res=3); t.data.materials.append(vine)
            if random.random() < 0.5: s = bl.sphere('b', pts[-1], (0.14,) * 3, seg=8, rings=6); s.data.materials.append(glow)
        stem = bl.mat('stem', (0.6, 0.75, 0.7), rough=0.5, sss=0.6); capm = bl.mat('capm', (0.1, 0.4, 0.35), rough=0.4, emit=(0.2, 0.9, 0.7), emit_strength=1.0)
        for x in (-8, -1, 7, 13):
            mushroom(x, 0, -6, random.uniform(5, 10), random.uniform(1.2, 2.4), stem, capm, glow)
    elif AREA == 'spire':
        cry = bl.mat('cry', (0.7, 0.55, 1.0), rough=0.05, transmission=0.6, emit=(0.6, 0.4, 1.0), emit_strength=3, coat=1)
        for i in range(10):
            x = random.uniform(-13, 13)
            for k in range(random.randint(2, 5)):
                crystal(x + random.uniform(-0.8, 0.8), 0, -6, random.uniform(2, 8), random.uniform(0.3, 0.8), cry, (random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4)))
    elif AREA == 'hearth':
        em = GT.emis('em', (1, 0.3, 0.06), 10)
        for i in range(12):
            x = random.uniform(-13, 13); L = random.uniform(2, 8)
            t = bl.tube('ch', [(x, -1, 16 - L * j / 6) for j in range(7)], [0.04] * 7, bevel_res=2, res=2); t.data.materials.append(st)
            if random.random() < 0.5:
                c = bl.cyl('cg', (x, -1, 16 - L - 0.5), 0.4, 0.8, verts=10, r2=0.2); c.data.materials.append(st)
                s = bl.sphere('e', (x, -1.2, 16 - L - 0.3), (0.2,) * 3, seg=8, rings=6); s.data.materials.append(em)
    for x0 in (-10.5, 4.5):
        GT.rib_vault('mv', x0, x0 + 7.5, 0, 15, 4, st, r=0.4)
    k = bl.light('AREA', (0, -10, 12), 200, rimc, size=20); bl.look_at(k, (0, 0, 5))
    r = bl.light('AREA', (0, 8, 10), 3500, rimc, size=25); bl.look_at(r, (0, 0, 5))
    bl.ortho_cam((1, 5), 28, dist=30)
    bl.render(OUT); BC.finish(AREA, 'mid', 0.4, OUT, paint=False, cover=1.0)
    sys.exit(0)

bl.render(OUT)
BC.finish(AREA, 'far', 0.12, OUT, cover=1.12)
