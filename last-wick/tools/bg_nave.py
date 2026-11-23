import sys, os, math, random
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bl, gothic as GT, bgcommon as BC
from mathutils import Vector
random.seed(4)
LAYER = sys.argv[1] if len(sys.argv) > 1 else 'far'
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 64
RES = (2640, 1100) if LAYER == 'far' else (2640, 1100)
sc = BC.setup(RES, SAMPLES, transparent=(LAYER != 'far'))
stone = GT.stone_mat('stone', (0.09, 0.1, 0.14), (0.2, 0.22, 0.3), scale=2.5)
stone2 = GT.stone_mat('stone2', (0.05, 0.055, 0.08), (0.12, 0.13, 0.18), scale=4)
water = bl.mat('water', (0.01, 0.015, 0.03), rough=0.04, coat=1.0)
glass = [GT.emis('g1', (0.2, 0.35, 1.0), 9), GT.emis('g2', (0.55, 0.25, 1.0), 9), GT.emis('g3', (1.0, 0.7, 0.3), 8), GT.emis('g4', (0.3, 0.8, 1.0), 9), GT.emis('g5', (0.8, 0.2, 0.5), 7)]
lw = GT.emis('lw', (0.25, 0.4, 0.9), 1.6)
cloth = bl.mat('cloth', (0.18, 0.08, 0.3), rough=0.9, sheen=0.6)
wax = bl.mat('wax', (0.9, 0.8, 0.62), rough=0.4, sss=0.5, sss_scale=0.05)
flame = GT.emis('flame', (1, 0.55, 0.2), 30)
bl.world_color((0.005, 0.008, 0.02), 1)

if LAYER == 'far':
    # water floor
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 40, 0)); fl = bpy.context.object; fl.data.materials.append(water)
    bl.displace(fl, 0.03, 0.6, subsurf=0)
    # nave columns + arches
    for side in (-1, 1):
        for k in range(1, 13):
            y = k * 5.0; x = side * 5.2
            GT.column('col', x, y, -1, 15, 0.55, stone)
        # longitudinal arches between columns (in YZ plane): build in XZ then rotate
        for k in range(1, 12):
            y0 = k * 5.0
            w = 5.0; pts, apex = GT.pointed_arch_curve(w, 0, 0, n=14)
            p3 = [(side * 5.2, y0 + w / 2 + px, 14 + pz * 0.9) for px, pz in pts[1:-1]]
            t = bl.tube('la', p3, [0.22] * len(p3), bevel_res=3, res=3); t.data.materials.append(stone)
            # clerestory wall above arches
        bl.cube('wallup', (side * 5.6, 30, 25.5), (0.3, 32, 6)).data.materials.append(stone2)
        # side aisle walls with lancet windows
        bl.cube('wall', (side * 10.5, 30, 12), (0.4, 34, 13)).data.materials.append(stone2)
        for k in range(11):
            for o in GT.lancet_window('lw', side * 10.05, 2.5 + k * 5.0, 4, 1.6, 7, stone, lw): o.rotation_euler = (0, 0, side * math.pi / 2); o.location.x = side * 10.05
    # remove stray placeholder arcs
    for o in list(bpy.data.objects):
        if o.name.startswith('arc'): bpy.data.objects.remove(o, do_unlink=True)
    # transverse vault ribs over nave
    for k in range(13):
        GT.rib_vault('tv', -5.2, 5.2, k * 5.0, 22, 6, stone, r=0.18)
    # end wall with rose window
    bl.cube('endwall', (0, 62, 20), (12, 0.6, 22)).data.materials.append(stone2)
    GT.rose_window('rose', 0, 61.3, 21, 7.5, stone, glass, petals=12)
    for x in (-3.2, 3.2):
        GT.lancet_window('elw', x, 61.35, 4.5, 2.2, 9, stone, glass[0])
    GT.lancet_window('elw', 0, 61.35, 3.5, 2.6, 11, stone, glass[1])
    # broken columns in water, debris
    for i in range(9):
        x = random.uniform(-4, 4); y = random.uniform(6, 55); h = random.uniform(0.5, 2.5)
        o = bl.cyl('bc', (x, y, h / 2 - 0.3), random.uniform(0.3, 0.5), h, verts=14, rot=(random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), 0)); o.data.materials.append(stone)
    # floating candles
    for i in range(60):
        x = random.uniform(-4.5, 4.5); y = random.uniform(3, 58); z = random.uniform(3, 14)
        GT.candle(x, y, z, random.uniform(0.25, 0.5), 0.07, wax, flame, light=(i % 3 == 0), energy=3)
    # moonlight beams through rose window
    for (x, z, e, tx) in ((0, 20, 90000, 0), (-2.5, 18, 30000, -3), (2.5, 22, 30000, 3)):
        L = bl.light('SPOT', (x, 60.2, z), e, (0.62, 0.74, 1.0), size=0.6)
        L.data.spot_size = math.radians(22); L.data.spot_blend = 0.8; bl.look_at(L, (tx, 14, 0))
    L = bl.light('AREA', (0, 58, 16), 9000, (0.55, 0.65, 1.0), size=10); bl.look_at(L, (0, 0, 8))
    for k in range(2, 12, 2):
        for side in (-1, 1):
            x = side * 3.6; y = k * 5.0 + 2.5
            o = bl.cyl('stand', (x, y, 1.0), 0.06, 2.0, verts=8); o.data.materials.append(stone2)
            for j in range(5):
                GT.candle(x + (j - 2) * 0.18, y, 2.0, 0.3 + 0.1 * (j % 2), 0.06, wax, flame, light=(j == 2), energy=40)
    # window side light
    for side in (-1, 1):
        L = bl.light('AREA', (side * 13, 30, 10), 3000, (0.4, 0.55, 1.0), size=20); bl.look_at(L, (0, 30, 4))
    GT.fog_volume((0, 32, 14), (30, 76, 32), 0.035, (0.75, 0.82, 1.0), anis=0.55)
    cam = bl.persp_cam((0, -6, 6.5), (0, 40, 13), lens=20)
    out = os.path.join(BC.BGDIR, '_tmp.png'); bl.render(out)
    BC.finish('nave', 'far', 0.12, out, cover=1.12)
else:
    # mid layer: near columns silhouettes + hanging chains, transparent
    for x in (-9, -2.5, 6.5, 13):
        GT.column('mc', x, 0, -6, 20, 0.9, stone2)
    for x0 in (-9, 6.5):
        GT.rib_vault('mv', x0, x0 + 6.5, 0, 14, 4, stone2, r=0.35)
    for i in range(10):
        x = random.uniform(-12, 14); L = random.uniform(3, 9)
        pts = [(x, -1, 16 - L * j / 8) for j in range(9)]
        t = bl.tube('chain', pts, [0.04] * 9, bevel_res=2, res=2); t.data.materials.append(stone2)
        if random.random() < 0.5:
            GT.candle(x, -1, 16 - L - 0.6, 0.4, 0.1, wax, flame, light=True, energy=8)
    L = bl.light('AREA', (0, -10, 12), 300, (0.5, 0.6, 1.0), size=20); bl.look_at(L, (0, 0, 5))
    R = bl.light('AREA', (0, 8, 10), 2500, (0.55, 0.7, 1.0), size=25); bl.look_at(R, (0, 0, 5))
    cam = bl.ortho_cam((2, 6), 26.4, dist=30)
    out = os.path.join(BC.BGDIR, '_tmp.png'); bl.render(out)
    BC.finish('nave', 'mid', 0.4, out, paint=False, cover=1.0)
