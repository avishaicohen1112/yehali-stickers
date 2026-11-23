"""Shared helpers for character models + generic frame renderer."""
import sys, os, math, json, random
import bpy, bl
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
P = math.pi

def E(name, loc=(0, 0, 0), parent=None):
    return bl.empty(name, loc, parent)

def put(o, parent, loc=None):
    o.parent = parent
    if loc is not None: o.location = loc
    return o

def M():
    m = {}
    m['wax'] = bl.mat('wax', (0.92, 0.84, 0.68), rough=0.38, sss=0.6, sss_radius=(1, 0.45, 0.2), sss_scale=0.08, coat=0.15)
    m['waxdark'] = bl.mat('waxdark', (0.55, 0.42, 0.3), rough=0.45, sss=0.4, sss_scale=0.05)
    m['dark'] = bl.mat('dark', (0.015, 0.014, 0.02), rough=0.55)
    m['black'] = bl.mat('black', (0.0, 0.0, 0.0), rough=0.2, coat=1.0)
    m['iron'] = bl.noise_bump(bl.mat('iron', (0.1, 0.09, 0.085), rough=0.42, metal=0.95), 18, 0.35)
    m['rust'] = bl.noise_bump(bl.mat('rust', (0.18, 0.08, 0.04), rough=0.7, metal=0.4), 22, 0.5)
    m['brass'] = bl.mat('brass', (0.8, 0.55, 0.25), rough=0.3, metal=1.0)
    m['ember'] = bl.mat('ember', (1, 0.4, 0.1), emit=(1.0, 0.42, 0.08), emit_strength=18)
    m['ember2'] = bl.mat('ember2', (1, 0.6, 0.2), emit=(1.0, 0.65, 0.25), emit_strength=30)
    m['flame'] = bl.mat('flame', (1, 0.6, 0.2), emit=(1.0, 0.55, 0.15), emit_strength=40)
    m['eye'] = bl.mat('eye', (1, 0.5, 0.1), emit=(1.0, 0.45, 0.1), emit_strength=25)
    m['pale'] = bl.mat('pale', (0.85, 0.86, 0.9), rough=0.7, sheen=1.0, sss=0.3, sss_scale=0.05)
    m['wing'] = bl.mat('wing', (0.8, 0.85, 0.95), rough=0.5, sss=0.5, transmission=0.3, alpha=0.9)
    m['teal'] = bl.mat('teal', (0.08, 0.35, 0.32), rough=0.35, sss=0.6, sss_scale=0.1)
    m['glowteal'] = bl.mat('glowteal', (0.3, 1, 0.8), emit=(0.3, 1.0, 0.75), emit_strength=12)
    m['jelly'] = bl.mat('jelly', (0.3, 0.7, 1.0), rough=0.1, transmission=0.8, ior=1.2, emit=(0.25, 0.6, 1.0), emit_strength=2.0, alpha=0.85)
    m['glowblue'] = bl.mat('glowblue', (0.4, 0.8, 1), emit=(0.35, 0.75, 1.0), emit_strength=15)
    m['robe'] = bl.noise_bump(bl.mat('robe', (0.05, 0.06, 0.09), rough=0.9, sheen=0.5), 30, 0.3)
    m['robe2'] = bl.noise_bump(bl.mat('robe2', (0.7, 0.68, 0.75), rough=0.85, sheen=0.6), 30, 0.25)
    m['crystal'] = bl.mat('crystal', (0.75, 0.6, 1.0), rough=0.06, transmission=0.55, ior=1.5, emit=(0.6, 0.45, 1.0), emit_strength=2.5, coat=1)
    m['glowviolet'] = bl.mat('glowviolet', (0.9, 0.7, 1), emit=(0.85, 0.65, 1.0), emit_strength=20)
    m['smoke'] = bl.mat('smoke', (0.03, 0.025, 0.03), rough=0.95, sheen=0.4)
    m['bone'] = bl.mat('bone', (0.8, 0.74, 0.64), rough=0.5, sss=0.2, sss_scale=0.03)
    m['chitin'] = bl.noise_bump(bl.mat('chitin', (0.05, 0.04, 0.045), rough=0.3, coat=0.8), 25, 0.3)
    m['red'] = bl.mat('red', (0.35, 0.03, 0.03), rough=0.8, sheen=0.4)
    return m

def rim_lights(center=(0, 0, 1), scale=1.0, key=(1, 0.92, 0.82), rim=(0.55, 0.7, 1.0)):
    cx, cy, cz = center; s = scale
    bl.world_color((0.03, 0.035, 0.06), 1.0)
    k = bl.light('AREA', (cx - 2.5 * s, -5 * s, cz + 3 * s), 260 * s * s, key, size=4 * s, name='key'); bl.look_at(k, center)
    r = bl.light('AREA', (cx + 3.5 * s, 4 * s, cz + 1.5 * s), 700 * s * s, rim, size=3 * s, name='rim'); bl.look_at(r, center)
    r2 = bl.light('AREA', (cx - 3.5 * s, 4 * s, cz + 1 * s), 450 * s * s, rim, size=3 * s, name='rim2'); bl.look_at(r2, center)

def ease(t): return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t

class Renderer:
    """Usage: R = Renderer(cell, units, cz); @R.anim('idle', 6) def f(i, n): ...; R.run(outdir, points={'name': obj})"""
    def __init__(s, cell, units, cz, cx=0.0, samples=20):
        s.cell, s.units, s.cz, s.cx = cell, units, cz, cx
        s.sc = bl.reset(samples=samples, res=(cell, cell))
        s.anims = {}; s.points = {}
    def camera(s):
        s.cam = bl.ortho_cam((s.cx, s.cz), s.units)
    def anim(s, name, n, loop=True, fps=12):
        def d(f): s.anims[name] = (n, f, loop, fps); return f
        return d
    def px(s, v):
        co = world_to_camera_view(s.sc, s.cam, v)
        return [round(co.x * s.cell, 1), round((1 - co.y) * s.cell, 1)]
    def run(s, out, only=None, ppu=50):
        os.makedirs(out, exist_ok=True)
        bpy.context.view_layer.update()
        meta = {'cell': s.cell, 'unitPx': s.cell / s.units, 'origin': s.px(Vector((0, 0, 0))), 'ppu': ppu, 'anims': {}}
        for name, (n, f, loop, fps) in s.anims.items():
            if only and name not in only: continue
            pts = {k: [] for k in s.points}
            for i in range(n):
                f(i, n); bpy.context.view_layer.update()
                for k, o in s.points.items(): pts[k].append(s.px(o.matrix_world.translation))
                bl.render(os.path.join(out, f'{name}_{i:02d}.png'))
            meta['anims'][name] = {'n': n, 'loop': loop, 'fps': fps, **pts}
        json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
