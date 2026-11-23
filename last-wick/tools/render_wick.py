"""Render protagonist animation frames. Usage: python3 render_wick.py OUTDIR [anim ...]"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(__file__))
import bpy, bl, wick_model
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = sys.argv[1]; only = sys.argv[2:]
CELL = 288; UNITS = 2.88; CZ = 1.0
sc = bl.reset(samples=20, res=(CELL, CELL))
m = wick_model.build(); flame = wick_model.lights()
flame.parent = m['head']; flame.location = (0.07, -0.05, 1.12)
cam = bl.ortho_cam((0, CZ), UNITS)
cl = m['cloak']; base = [v.co.copy() for v in cl.data.vertices]
zmin = min(c.z for c in base); zmax = max(c.z for c in base)
P = math.pi

def cloak(trail=0.0, flare=1.0, lift=0.0, wave=0.0, ph=0.0, squash=1.0):
    for v, b in zip(cl.data.vertices, base):
        t = (b.z - zmin) / (zmax - zmin); w = (1 - t) ** 2
        x = b.x * (1 + (flare - 1) * w) - trail * w * 0.35
        y = b.y * (1 + (flare - 1) * w)
        z = b.z * squash + lift * w * 0.25 + wave * w * 0.04 * math.sin(math.atan2(b.y, b.x) * 3 + ph)
        v.co = (x, y, z)
    cl.data.update()

def scarf(t, wind=1.0, lift=0.0, ph=0.0):
    bl.set_ribbon(m['scarf'], wick_model.scarf_path(t, wind, lift, ph), wick_model.SCARF_W)

def pose(root=(0, 0, 0), lean=0.0, headrot=0.0, headtilt=0.0, legs=(0.0, 0.0), legz=(0, 0), needle=None, body_sq=1.0):
    m['root'].location = root
    m['root'].rotation_euler = (0, lean, 0)
    m['root'].scale = (1 / math.sqrt(body_sq), 1, body_sq)
    m['head'].rotation_euler = (0, headtilt, headrot)
    for hp, a, dz in zip(m['hips'], legs, legz):
        hp.rotation_euler = (0, a, 0); hp.location.z = 0.32 + dz
    show = needle is not None
    for o in m['needle']: o.hide_render = not show
    if show:
        ang, hx, hz = needle
        m['hand'].location = (hx, -0.05, hz); m['hand'].rotation_euler = (0, ang, 0)

def ease(t): return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t

ANIMS = {}
def anim(name, n, loop=True, fps=12):
    def deco(f): ANIMS[name] = (n, f, loop, fps); return f
    return deco

@anim('idle', 8)
def _(i, n):
    t = i / n; s = math.sin(t * 2 * P)
    pose(root=(0, 0, 0.01 * s), headrot=0.35, headtilt=0.03 * s, body_sq=1 + 0.015 * s)
    cloak(trail=0.05, flare=1 + 0.02 * s, wave=1, ph=t * 2 * P); scarf(t, wind=0.55, lift=-0.4)

@anim('run', 8, fps=14)
def _(i, n):
    t = i / n; s = math.sin(t * 2 * P); c = math.cos(t * 2 * P)
    pose(root=(0, 0, 0.04 * abs(math.sin(t * 2 * P))), lean=0.18, headrot=0.45, headtilt=-0.05 + 0.03 * c,
         legs=(0.75 * s, -0.75 * s), legz=(0.05 * max(0, c), 0.05 * max(0, -c)))
    cloak(trail=0.5 + 0.08 * s, flare=1.05, wave=2, ph=t * 4 * P); scarf(t * 2, wind=1.0, lift=0.2)

@anim('jump', 3, loop=False)
def _(i, n):
    t = i / max(1, n - 1)
    pose(root=(0, 0, 0), lean=-0.05, headrot=0.4, headtilt=0.1, legs=(0.5, -0.2), legz=(0.12, 0.06), body_sq=1.06 - 0.04 * t)
    cloak(trail=0.15, flare=0.92, lift=-0.3, squash=1.0); scarf(t, wind=0.6, lift=-0.8)

@anim('fall', 4)
def _(i, n):
    t = i / n; s = math.sin(t * 2 * P)
    pose(root=(0, 0, 0), lean=0.03, headrot=0.4, headtilt=-0.1, legs=(-0.25, 0.35), legz=(0.06, 0.1))
    cloak(trail=0.2, flare=1.25 + 0.04 * s, lift=1.0, wave=2, ph=t * 2 * P); scarf(t, wind=0.7, lift=1.0)

@anim('land', 2, loop=False, fps=14)
def _(i, n):
    sq = [0.82, 0.93][i]
    pose(root=(0, 0, 0), headrot=0.35, legs=(0.2, -0.2), body_sq=sq, headtilt=0.05)
    cloak(trail=0.0, flare=1.15, squash=1.0); scarf(0, wind=0.5, lift=-0.6)

@anim('dash', 4, loop=False, fps=16)
def _(i, n):
    t = i / (n - 1)
    pose(root=(0, 0, 0.1), lean=0.6, headrot=0.5, headtilt=-0.25, legs=(-0.9, -0.6), legz=(0.1, 0.1), body_sq=0.92)
    cloak(trail=1.3, flare=0.85, lift=0.4, wave=2, ph=t * 3); scarf(t, wind=1.25, lift=0.6)

@anim('slash', 5, loop=False, fps=18)
def _(i, n):
    t = ease(i / (n - 1)); a = lerp(-1.9, 0.75, t)
    pose(root=(0, 0, 0), lean=lerp(-0.1, 0.25, t), headrot=0.45, headtilt=lerp(0.05, -0.1, t),
         legs=(0.3, -0.35), needle=(a, 0.2, 0.75))
    cloak(trail=lerp(0.1, -0.2, t), flare=1.08, wave=1, ph=t * 3); scarf(t, wind=0.8, lift=0.2)

@anim('slashup', 5, loop=False, fps=18)
def _(i, n):
    t = ease(i / (n - 1)); a = lerp(-0.2, -2.9, t)
    pose(root=(0, 0, 0), lean=lerp(0.05, -0.15, t), headrot=0.4, headtilt=lerp(0, 0.2, t),
         legs=(0.2, -0.2), needle=(a, 0.05, 1.0))
    cloak(trail=0.1, flare=1.05); scarf(t, wind=0.7, lift=-0.3)

@anim('slashdown', 5, loop=False, fps=18)
def _(i, n):
    t = ease(i / (n - 1)); a = lerp(0.6, 2.4, t)
    pose(root=(0, 0, 0.1), lean=0.1, headrot=0.4, headtilt=-0.2, legs=(0.6, -0.4), legz=(0.15, 0.1), needle=(a, 0.05, 0.5))
    cloak(trail=0.1, flare=1.2, lift=0.6); scarf(t, wind=0.7, lift=0.8)

@anim('wall', 4)
def _(i, n):
    t = i / n; s = math.sin(t * 2 * P)
    # facing away from wall (wall is behind, at -X)
    pose(root=(-0.12, 0, 0.0), lean=-0.08, headrot=0.5, headtilt=0.05, legs=(1.0, 0.6), legz=(0.12, 0.0))
    cloak(trail=-0.25, flare=0.95, lift=0.5, wave=1, ph=t * 2 * P); scarf(t, wind=0.5, lift=1.0)

@anim('hurt', 2, loop=False, fps=10)
def _(i, n):
    pose(root=(0, 0, 0.05), lean=-0.4, headrot=0.1, headtilt=0.35, legs=(-0.5, -0.8), body_sq=0.95)
    cloak(trail=-0.6, flare=1.2, lift=0.5, wave=2, ph=i); scarf(i * 0.3, wind=0.6, lift=0.8)

@anim('focus', 6, fps=10)
def _(i, n):
    t = i / n; s = math.sin(t * 2 * P)
    pose(root=(0, 0, -0.04), lean=0.0, headrot=0.0, headtilt=-0.12 + 0.02 * s, legs=(0.35, -0.35), body_sq=0.9 + 0.015 * s)
    cloak(trail=0.0, flare=1.22 + 0.04 * s, lift=0.45 + 0.1 * s, wave=2, ph=t * 2 * P); scarf(t, wind=0.3, lift=1.3 + 0.2 * s)

@anim('cast', 4, loop=False, fps=14)
def _(i, n):
    t = i / (n - 1)
    lean = [-0.25, -0.3, 0.35, 0.2][i]
    pose(root=(0, 0, 0), lean=lean, headrot=0.5, headtilt=[0.2, 0.3, -0.2, -0.1][i], legs=(0.4, -0.5), body_sq=[0.95, 0.92, 1.05, 1.0][i])
    cloak(trail=[-0.2, -0.3, 0.6, 0.4][i], flare=1.1, wave=1, ph=i); scarf(t, wind=0.9, lift=0.4)

@anim('sit', 1, loop=False)
def _(i, n):
    pose(root=(0, 0, -0.12), headrot=0.0, headtilt=-0.05, legs=(-1.3, -1.2), legz=(0.0, 0.0), body_sq=0.94)
    cloak(trail=0.0, flare=1.1); scarf(0, wind=0.3, lift=-1.0)

@anim('death', 8, loop=False, fps=10)
def _(i, n):
    t = ease(i / (n - 1))
    pose(root=(0, 0, -0.35 * t), lean=-0.15 * t, headrot=0.2, headtilt=lerp(0, 1.2, t), legs=(lerp(0, -1.4, t), lerp(0, -1.3, t)), body_sq=lerp(1, 0.55, t))
    cloak(trail=0.1, flare=lerp(1, 1.6, t), lift=0.0, wave=1, ph=t); scarf(t, wind=lerp(0.6, 0.4, t), lift=-1.2 * t)

def px(obj_or_vec):
    v = obj_or_vec if isinstance(obj_or_vec, Vector) else obj_or_vec.matrix_world.translation
    co = world_to_camera_view(sc, cam, v)
    return [round(co.x * CELL, 1), round((1 - co.y) * CELL, 1)]

meta = {'cell': CELL, 'unitPx': CELL / UNITS, 'origin': px(Vector((0, 0, 0))), 'anims': {}}
os.makedirs(OUT, exist_ok=True)
for name, (n, f, loop, fps) in ANIMS.items():
    if only and name not in only: continue
    tips = []
    for i in range(n):
        f(i, n)
        bpy.context.view_layer.update()
        tips.append(px(m['tip']))
        bl.render(os.path.join(OUT, f'{name}_{i:02d}.png'))
    meta['anims'][name] = {'n': n, 'loop': loop, 'fps': fps, 'tip': tips}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
