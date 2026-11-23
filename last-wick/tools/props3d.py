"""Static props + NPCs. python3 props3d.py [names...]"""
import sys, os, math, random, json
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bl, gothic as GT
from charkit import *
import numpy as np
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..'); PD = os.path.join(ROOT, 'assets', 'props'); os.makedirs(PD, exist_ok=True)
U = 100  # px per unit in image; drawn at 0.5 => 50 world px/unit

def render_prop(name, build, w_units, h_units, anchor=(0.5, 1.0), light=None, flame=None, sway=0, samples=24, silhouette=False, li=None):
    sc = bl.reset(samples=samples, res=(int(w_units * U), int(h_units * U)))
    m = M(); random.seed(hash(name) % 999)
    build(m)
    if silhouette:
        bl.world_color((0, 0, 0), 0)
        for o in bpy.data.objects:
            if o.type == 'MESH':
                o.data.materials.clear(); o.data.materials.append(bl.mat('sil', (0.006, 0.006, 0.01), rough=0.9))
        r = bl.light('AREA', (0, 6, h_units * 0.6), 400 * h_units, (0.6, 0.7, 1.0), size=6); bl.look_at(r, (0, 0, h_units * 0.4))
    else:
        rim_lights((0, 0, h_units * 0.45), max(1.0, h_units * 0.45))
    cx = (0.5 - anchor[0]) * w_units; cz = (1 - anchor[1]) * h_units
    bl.ortho_cam((cx + 0, h_units / 2 - (anchor[1] - 1) * 0 - (1 - anchor[1]) * h_units), max(w_units, h_units))
    cam = bpy.context.scene.camera
    cam.data.ortho_scale = max(w_units, h_units)
    cam.location = (w_units * (0.5 - anchor[0]), -20, h_units * (1 - anchor[1]) * -1 + h_units / 2)
    sc.render.resolution_x = int(w_units * U); sc.render.resolution_y = int(h_units * U)
    f = os.path.join(PD, name + '.png'); bl.render(f)
    im = Image.open(f).convert('RGBA'); a = np.array(im)
    ys, xs = np.nonzero(a[..., 3] > 4)
    im.save(os.path.join(PD, name + '.webp'), 'WEBP', quality=88, method=5); os.remove(f)
    W, H = im.size
    e = {'img': f'assets/props/{name}.webp', 'w': W / 2, 'h': H / 2, 'ax': W * anchor[0] / 2, 'ay': H * anchor[1] / 2}
    if light: e['light'] = light
    if flame: e['flame'] = flame
    if sway: e['sway'] = sway
    if li: e['li'] = li
    mp = os.path.join(PD, 'manifest.json'); man = json.load(open(mp)) if os.path.exists(mp) else {}
    man[name] = e; json.dump(man, open(mp, 'w'), indent=1); print('PROP', name, im.size, flush=True)

# ------------- builders -------------
def b_bench(m):
    st = GT.stone_mat('st', (0.12, 0.1, 0.09), (0.25, 0.21, 0.18), 3)
    bl.cube('base', (0, 0, 0.25), (1.2, 0.5, 0.25)).data.materials.append(st)
    bl.cube('base2', (0, 0, 0.62), (0.95, 0.42, 0.12)).data.materials.append(st)
    bl.cube('top', (0, 0, 0.82), (1.3, 0.55, 0.08)).data.materials.append(st)
    for x in (-0.9, 0.9):
        GT.column('c', x, -0.3, 0, 0.8, 0.12, st, ribs=6)
    ped = bl.cyl('ped', (0, 0, 1.3), 0.12, 1.0, verts=16); ped.data.materials.append(m['brass'])
    arms = bl.tube('arms', [(-0.76, 0, 2.05), (-0.6, 0, 1.75), (0, 0, 1.75), (0.6, 0, 1.75), (0.76, 0, 2.05)], [0.05] * 5); arms.data.materials.append(m['brass'])
    for x, h in ((-0.76, 0.3), (0, 0.5), (0.76, 0.3)):
        c = bl.cyl('cd', (x, 0, 2.05 + h / 2 if x else 1.8 + h / 2), 0.09, h, verts=16); c.data.materials.append(m['wax'])
        for k in range(3):
            d = bl.tube('dr', [(x + 0.08 * math.cos(k * 2), -0.08 * abs(math.sin(k * 2)) - 0.03, (2.05 + h if x else 1.8 + h) - 0.02), (x + 0.1 * math.cos(k * 2), -0.1, (2.05 + h if x else 1.8 + h) - 0.15 - k * 0.05)], [0.03, 0.02]); d.data.materials.append(m['wax'])
    for k in range(10):
        GT.candle(random.uniform(-1.1, 1.1), random.uniform(-0.45, -0.25), 0.9, random.uniform(0.1, 0.35), 0.05, m['wax'], m['flame'], light=False)
    L = bl.light('POINT', (0, -0.6, 2.6), 60, (1, 0.6, 0.25), size=0.3)

def b_tablet(m):
    st = GT.stone_mat('st', (0.1, 0.1, 0.12), (0.22, 0.22, 0.26), 3)
    o = bl.cube('slab', (0, 0, 0.75), (0.42, 0.12, 0.75)); o.data.materials.append(st); bv = o.modifiers.new('b', 'BEVEL'); bv.width = 0.05
    top = bl.cyl('arch', (0, 0, 1.5), 0.42, 0.24, verts=32, rot=(math.pi / 2, 0, 0)); top.data.materials.append(st)
    glow = GT.emis('rune', (0.6, 0.75, 1.0), 6)
    for k in range(6):
        bl.cube('r', (random.uniform(-0.25, 0.25), -0.13, 0.5 + k * 0.17), (random.uniform(0.06, 0.2), 0.01, 0.015)).data.materials.append(glow)
    bl.cube('base', (0, 0, 0.06), (0.55, 0.2, 0.06)).data.materials.append(st)

def b_brazier(m):
    st = GT.stone_mat('st', (0.12, 0.1, 0.09), (0.25, 0.21, 0.18), 3)
    bl.cube('base', (0, 0, 0.3), (2.3, 0.6, 0.3)).data.materials.append(st)
    bl.cube('mid', (0, 0, 0.9), (2.0, 0.45, 0.35)).data.materials.append(st)
    for i in range(4):
        x = -1.5 + i * 1.0
        b = bl.cyl('bowl', (x, -0.1, 1.6), 0.38, 0.4, verts=24, r2=0.22); b.data.materials.append(m['iron'])
        p = bl.cyl('p', (x, -0.1, 1.3), 0.08, 0.3, verts=12); p.data.materials.append(m['iron'])
        c = bl.sphere('coal', (x, -0.1, 1.82), (0.3, 0.3, 0.06)); c.data.materials.append(m['dark'])
    GT.rose_window('rw', 0, 0.48, 0.9, 0.3, m['brass'], [m['ember']], petals=8)

def b_statue(m):  # hooded mourning statue
    st = GT.stone_mat('st', (0.15, 0.14, 0.13), (0.3, 0.28, 0.26), 4)
    r = bl.cyl('robe', (0, 0, 1.6), 0.7, 3.2, verts=32, r2=0.3); r.data.materials.append(st); bl.displace(r, 0.08, 0.5, subsurf=2)
    h = bl.sphere('hood', (0.05, 0, 3.4), (0.42, 0.4, 0.5)); h.data.materials.append(st)
    f = bl.sphere('face', (0.25, -0.15, 3.35), (0.22, 0.2, 0.3)); f.data.materials.append(m['black'])
    for side in (-1, 1):
        a = bl.tube('arm', [(0.1, side * 0.3, 2.7), (0.45, side * 0.15, 2.3), (0.55, 0, 2.1)], [0.16, 0.14, 0.12]); a.data.materials.append(st)
    cd = bl.cyl('cand', (0.6, -0.05, 2.35), 0.1, 0.4, verts=12); cd.data.materials.append(m['wax'])
    bl.cube('ped', (0, 0, 0.0), (0.9, 0.7, 0.2)).data.materials.append(st)

def b_candelabra(m):
    stand = bl.tube('stand', [(0, 0, 0), (0, 0, 2.2)], [0.07, 0.05]); stand.data.materials.append(m['iron'])
    feet = [bl.tube('ft', [(0, 0, 0.15), (0.35 * math.cos(a), 0.35 * math.sin(a), 0.0)], [0.05, 0.03]) for a in (0.3, 2.4, 4.4)]
    for f in feet: f.data.materials.append(m['iron'])
    arms = bl.tube('arms', [(-0.6, 0, 2.5), (-0.45, 0, 2.15), (0, 0, 2.1), (0.45, 0, 2.15), (0.6, 0, 2.5)], [0.04] * 5); arms.data.materials.append(m['iron'])
    for x in (-0.6, 0, 0.6):
        c = bl.cyl('c', (x, 0, 2.6 if x else 2.35), 0.07, 0.3, verts=12); c.data.materials.append(m['wax'])

def b_urn(m):
    st = GT.stone_mat('st', (0.13, 0.1, 0.08), (0.26, 0.2, 0.16), 4)
    u = bl.sphere('u', (0, 0, 0.55), (0.45, 0.45, 0.55)); u.data.materials.append(st)
    n = bl.cyl('n', (0, 0, 1.1), 0.22, 0.25, verts=20, r2=0.3); n.data.materials.append(st)
    for k in range(5):
        d = bl.tube('d', [(0.25 * math.cos(k), -0.25, 1.2), (0.3 * math.cos(k), -0.42, 0.6 - k * 0.1)], [0.05, 0.035]); d.data.materials.append(m['wax'])

def b_bigshroom(m):
    st = bl.tube('st', [(0, 0, 0), (0.2, 0, 1.2), (0.05, 0, 2.4)], [0.25, 0.18, 0.15]); st.data.materials.append(m['pale'])
    c = bl.sphere('c', (0.05, 0, 2.5), (1.0, 0.9, 0.42)); c.data.materials.append(m['teal'])
    u = bl.sphere('u', (0.05, 0, 2.4), (0.92, 0.85, 0.12)); u.data.materials.append(m['glowteal'])
    for k in range(8):
        a = random.uniform(0.3, 2.8); b = random.uniform(0, 6.28)
        s = bl.sphere('sp', (0.05 + 0.95 * math.sin(a) * math.cos(b), 0.85 * math.sin(a) * math.sin(b), 2.5 + 0.4 * math.cos(a)), (0.08,) * 3); s.data.materials.append(m['glowteal'])

def b_flower(m):
    petal = bl.mat('petal', (1.0, 0.85, 0.6), rough=0.4, sss=0.8, sss_scale=0.1, emit=(1.0, 0.7, 0.35), emit_strength=1.5)
    core = GT.emis('core', (1, 0.8, 0.4), 20)
    st = bl.tube('st', [(0, 0, 0), (0.15, 0, 0.6), (0.05, 0, 1.2)], [0.05, 0.04, 0.035]); st.data.materials.append(m['vine'] if 'vine' in m else m['dark'])
    for layer in range(2):
        for k in range(8):
            a = k / 8 * 6.28 + layer * 0.4
            p = bl.sphere('pt', (0.05 + math.cos(a) * 0.25, math.sin(a) * 0.25, 1.32 + layer * 0.06), (0.28, 0.1, 0.04)); p.rotation_euler = (0, -0.6 - layer * 0.4, a); p.data.materials.append(petal)
    c = bl.sphere('core', (0.05, 0, 1.38), (0.1,) * 3); c.data.materials.append(core)
    for k in range(4):
        lf = bl.sphere('lf', (0.25 * math.cos(k * 1.6), 0.2 * math.sin(k * 1.6), 0.2), (0.35, 0.12, 0.04)); lf.rotation_euler = (0, -0.3, k * 1.6); lf.data.materials.append(bl.mat('leaf', (0.05, 0.25, 0.12), rough=0.6, sheen=0.5))

def b_pillar_broken(m):
    st = GT.stone_mat('st', (0.1, 0.11, 0.15), (0.22, 0.24, 0.3), 3)
    GT.column('c', 0, 0, 0, 2.4, 0.45, st)
    for k in range(4):
        o = bl.sphere('rub', (random.uniform(-0.9, 0.9), random.uniform(-0.3, 0.3), 0.15), (random.uniform(0.15, 0.35),) * 3, seg=8, rings=6); o.data.materials.append(st); bl.displace(o, 0.06, 0.4)
    alg = GT.emis('alg', (0.2, 0.6, 1.0), 2)
    for k in range(6):
        s = bl.sphere('a', (random.uniform(-0.45, 0.45), -0.42, random.uniform(0.2, 2.0)), (0.08, 0.03, 0.06)); s.data.materials.append(alg)

def b_lantern_post(m):
    p = bl.tube('post', [(0, 0, 0), (0, 0, 2.8), (0.35, 0, 3.0), (0.5, 0, 2.85)], [0.06, 0.05, 0.04, 0.03]); p.data.materials.append(m['iron'])
    l = bl.cyl('lan', (0.5, 0, 2.55), 0.15, 0.35, verts=8); l.data.materials.append(GT.emis('lg', (0.5, 0.8, 1.0), 8))
    c = bl.cyl('cap', (0.5, 0, 2.78), 0.2, 0.12, verts=8, r2=0.05); c.data.materials.append(m['iron'])

def b_crystals(m):
    for k in range(7):
        L = random.uniform(0.6, 2.6); r = random.uniform(0.12, 0.3); a = random.uniform(-0.5, 0.5); b = random.uniform(-0.3, 0.3)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, radius2=0, depth=L, location=(random.uniform(-0.6, 0.6), random.uniform(-0.2, 0.2), L / 2 - 0.1))
        o = bpy.context.object; o.rotation_euler = (b, a, random.uniform(0, 1)); o.data.materials.append(m['crystal'] if k % 3 else m['glowviolet'])

def b_glass_statue(m):
    st = bl.mat('gst', (0.6, 0.5, 0.85), rough=0.05, transmission=0.7, ior=1.45, coat=1, emit=(0.5, 0.35, 0.9), emit_strength=0.8)
    r = bl.cyl('r', (0, 0, 1.4), 0.55, 2.8, verts=24, r2=0.2); r.data.materials.append(st)
    h = bl.sphere('h', (0, 0, 3.0), (0.3, 0.28, 0.38)); h.data.materials.append(st)
    for k in range(7):
        a = k / 6 * math.pi
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.05, radius2=0, depth=0.45, location=(math.cos(a) * 0.55, 0.1, 3.05 + math.sin(a) * 0.55))
        c = bpy.context.object; c.rotation_euler = (0, math.pi / 2 - a, 0); c.data.materials.append(m['glowviolet'])
    bl.cube('ped', (0, 0, 0.05), (0.7, 0.5, 0.15)).data.materials.append(m['dark'])

def b_ash_statue(m):
    st = GT.stone_mat('st', (0.08, 0.06, 0.055), (0.16, 0.12, 0.1), 4)
    r = bl.cyl('r', (0, 0, 1.5), 0.65, 3.0, verts=24, r2=0.35); r.data.materials.append(st); bl.displace(r, 0.12, 0.4, subsurf=2)
    h = bl.sphere('h', (0.0, 0, 3.2), (0.38, 0.36, 0.42)); h.data.materials.append(st)
    for k in range(10):
        s = bl.sphere('e', (random.uniform(-0.5, 0.5), -0.5, random.uniform(0.3, 3)), (0.04,) * 3, seg=6, rings=4); s.data.materials.append(m['ember'])

def b_chains(m):
    for k in range(4):
        x = (k - 1.5) * 0.4; L = random.uniform(2, 4.5)
        t = bl.tube('ch', [(x, 0, 5), (x + 0.05, 0, 5 - L)], [0.04, 0.04]); t.data.materials.append(m['iron'])
        if k % 2 == 0:
            c = bl.cyl('cage', (x, 0, 5 - L - 0.35), 0.22, 0.6, verts=8); c.data.materials.append(m['iron'])

def fg(area):
    def b(m):
        random.seed(area)
        if area == 'gardens':
            for k in range(12):
                L = random.uniform(1.5, 4.5); x = random.uniform(-2.5, 2.5)
                lf = bl.sphere('leaf', (x, 0, L / 2), (0.25, 0.05, L / 2)); lf.rotation_euler = (0, random.uniform(-0.5, 0.5), 0)
        elif area == 'spire':
            for k in range(6):
                L = random.uniform(1.5, 4.5); bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=random.uniform(0.2, 0.5), radius2=0, depth=L, location=(random.uniform(-2, 2), 0, L / 2))
                bpy.context.object.rotation_euler = (0, random.uniform(-0.5, 0.5), 0)
        else:
            for k in range(5):
                L = random.uniform(2, 4.5); x = random.uniform(-2.2, 2.2)
                bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=random.uniform(0.3, 0.7), radius2=0.05, depth=L, location=(x, 0, L / 2))
                o = bpy.context.object; o.rotation_euler = (0, random.uniform(-0.25, 0.25), 0); bl.displace(o, 0.12, 0.6, subsurf=2)
            bl.sphere('rock', (0, 0, 0), (3, 1, 0.8))
    return b

# ------------- NPCs (rendered as atlases via Renderer) -------------
def npc(name, out):
    from charkit import Renderer
    R = Renderer(320, 3.2, 1.3); m = M()
    root = E('root'); body = E('body', (0, 0, 0), root)
    if name == 'merchant':
        b = bl.sphere('b', (0, 0, 0.6), (0.6, 0.5, 0.6)); b.data.materials.append(m['robe']); put(b, body)
        pack = bl.sphere('pack', (-0.45, 0.1, 1.0), (0.55, 0.45, 0.6)); pack.data.materials.append(bl.mat('leather', (0.15, 0.08, 0.04), rough=0.7)); put(pack, body)
        for k in range(7):
            c = bl.cyl('pc', (-0.45 + random.uniform(-0.3, 0.3), 0.1 + random.uniform(-0.2, 0.2), 1.6 + random.uniform(0, 0.2)), 0.05, random.uniform(0.3, 0.6), verts=10); c.data.materials.append(m['wax']); put(c, body)
        head = E('head', (0.25, 0, 1.15), body)
        h = bl.sphere('h', (0.05, 0, 0.1), (0.28, 0.26, 0.26)); h.data.materials.append(m['wax']); put(h, head)
        hat = bl.cyl('hat', (0.0, 0, 0.6), 0.35, 0.7, verts=24, r2=0.04); hat.data.materials.append(m['brass']); put(hat, head)
        nose = bl.tube('nose', [(0.25, -0.05, 0.1), (0.5, -0.05, 0.0), (0.6, -0.05, -0.15)], [0.07, 0.05, 0.03]); nose.data.materials.append(m['wax']); put(nose, head)
        for ex in (0.18, 0.3):
            e = bl.sphere('e', (ex, -0.22, 0.18), (0.035, 0.02, 0.035)); e.data.materials.append(m['black']); put(e, head)
        lan = bl.cyl('lan', (0.55, -0.2, 0.55), 0.1, 0.25, verts=8); lan.data.materials.append(m['ember2']); put(lan, body)
        moving = head
    elif name == 'gardener':
        r = bl.cyl('r', (0, 0, 0.75), 0.4, 1.5, verts=24, r2=0.15); r.data.materials.append(bl.mat('gr', (0.2, 0.3, 0.25), rough=0.85, sheen=0.5)); put(r, body)
        head = E('head', (0.05, 0, 1.6), body)
        h = bl.sphere('h', (0, 0, 0.05), (0.2, 0.2, 0.24)); h.data.materials.append(m['pale']); put(h, head)
        hat = bl.cyl('hat', (0, 0, 0.22), 0.5, 0.1, verts=32, r2=0.15); hat.data.materials.append(bl.mat('straw', (0.5, 0.4, 0.2), rough=0.8)); put(hat, head)
        for side in (-1, 1):
            an = bl.tube('an', [(0.05, side * 0.08, 0.2), (0.15, side * 0.2, 0.55), (0.05, side * 0.3, 0.75)], [0.015, 0.012, 0.006]); an.data.materials.append(m['pale']); put(an, head)
        for ex in (0.12, 0.19):
            e = bl.sphere('e', (ex, -0.16, 0.06), (0.04, 0.02, 0.05)); e.data.materials.append(m['black']); put(e, head)
        can = bl.cyl('can', (0.45, -0.1, 0.8), 0.15, 0.25, verts=16); can.data.materials.append(m['brass']); put(can, body)
        gl = bl.sphere('gl', (0.45, -0.1, 0.98), (0.1,) * 3); gl.data.materials.append(m['glowteal']); put(gl, body)
        moving = head
    elif name == 'monk':
        r = bl.cyl('r', (0, 0, 0.55), 0.5, 1.1, verts=24, r2=0.25); r.data.materials.append(m['robe']); bl.displace(r, 0.05, 0.4, subsurf=2); put(r, body)
        head = E('head', (0.1, 0, 1.15), body)
        h = bl.sphere('h', (0, 0, 0.05), (0.26, 0.26, 0.3)); h.data.materials.append(m['robe']); put(h, head)
        f = bl.sphere('f', (0.08, -0.12, 0.0), (0.15, 0.12, 0.18)); f.data.materials.append(m['bone']); put(f, head)
        for ex in (0.04, 0.13):
            e = bl.sphere('e', (ex, -0.22, 0.03), (0.025, 0.02, 0.04)); e.data.materials.append(m['black']); put(e, head)
        bell = bl.cyl('bell', (0.45, -0.1, 0.5), 0.14, 0.22, verts=16, r2=0.06); bell.data.materials.append(m['brass']); put(bell, body)
        lg = bl.sphere('lg', (0.45, -0.25, 0.5), (0.06,) * 3); lg.data.materials.append(m['glowblue']); put(lg, body)
        moving = head
    else:  # glassmaker
        r = bl.cyl('r', (0, 0, 0.7), 0.42, 1.4, verts=24, r2=0.2); r.data.materials.append(bl.mat('apron', (0.25, 0.15, 0.1), rough=0.8)); put(r, body)
        for k in range(5):
            bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.08, radius2=0, depth=random.uniform(0.4, 0.8), location=(-0.3, 0.1 + (k - 2) * 0.08, 1.3))
            c = bpy.context.object; c.rotation_euler = (0, -0.5 - k * 0.1, 0); c.data.materials.append(m['crystal']); put(c, body)
        head = E('head', (0.05, 0, 1.55), body)
        h = bl.sphere('h', (0, 0, 0.05), (0.24, 0.22, 0.25)); h.data.materials.append(m['wax']); put(h, head)
        gg = bl.tube('gog', [(0.12, -0.25, 0.12), (0.26, -0.18, 0.12)], [0.07, 0.07]); gg.data.materials.append(m['brass']); put(gg, head)
        lens = bl.sphere('lens', (0.27, -0.18, 0.12), (0.02, 0.06, 0.06)); lens.data.materials.append(m['glowviolet']); put(lens, head)
        orb = bl.sphere('orb', (0.45, -0.15, 0.9), (0.16,) * 3); orb.data.materials.append(m['glowviolet']); put(orb, body)
        moving = head
    rim_lights((0, 0, 1), 1.0); R.camera()
    @R.anim('idle', 4, fps=4)
    def _(i, n):
        t = i / n * 2 * math.pi; body.scale = (1, 1, 1 + 0.015 * math.sin(t)); moving.rotation_euler = (0, 0.06 * math.sin(t), 0)
    R.run(out)

PROPS = {
    'bench': (b_bench, 3.0, 3.0, (0.5, 1.0), None, [[-38, -121], [0, -119], [38, -121]]),
    'tablet': (b_tablet, 1.4, 2.0, (0.5, 1.0), None, None),
    'brazier': (b_brazier, 5.2, 2.6, (0.5, 1.0), None, None),
    'statue': (b_statue, 2.4, 3.9, (0.5, 1.0), [255, 170, 90, 160, 30, -128], [[30, -128]]),
    'candelabra': (b_candelabra, 1.6, 2.9, (0.5, 1.0), [255, 170, 90, 260, 0, -130], [[-30, -138], [0, -126], [30, -138]]),
    'urn': (b_urn, 1.2, 1.5, (0.5, 1.0), None, None),
    'bigshroom': (b_bigshroom, 2.4, 3.1, (0.5, 1.0), [120, 255, 210, 300, 0, -120], None),
    'flower': (b_flower, 1.4, 1.6, (0.5, 1.0), [255, 200, 120, 160, 0, -68], None),
    'pillar': (b_pillar_broken, 2.2, 2.8, (0.5, 1.0), None, None),
    'lantern': (b_lantern_post, 1.4, 3.2, (0.5, 1.0), [140, 200, 255, 260, 25, -128], None),
    'crystals': (b_crystals, 2.2, 2.8, (0.5, 1.0), [210, 170, 255, 220, 0, -60], None),
    'gstatue': (b_glass_statue, 1.8, 3.8, (0.5, 1.0), [200, 160, 255, 200, 0, -120], None),
    'astatue': (b_ash_statue, 1.8, 3.8, (0.5, 1.0), None, None),
    'chains': (b_chains, 2.0, 5.2, (0.5, 0.0), None, None),
}
if __name__ == '__main__':
    names = sys.argv[1:] or list(PROPS) + ['fg_crypts', 'fg_gardens', 'fg_nave', 'fg_spire', 'fg_hearth', 'npcs']
    for n in names:
        if n == 'npcs':
            for k in ('merchant', 'gardener', 'monk', 'glassmaker'): npc(k, '/tmp/claude-0/-home-user-yehali-stickers/4108e445-a820-59df-aeea-25641abca8d7/scratchpad/frames/npc/' + k)
            continue
        if n.startswith('fg_'):
            render_prop(n, fg(n[3:]), 6.0, 5.0, (0.5, 1.0), silhouette=True, samples=12); continue
        b, w, h, anc, light, flame = PROPS[n]
        render_prop(n, b, w, h, anc, light, flame)
