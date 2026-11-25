"""Living background details (ART_BRIEF_2 stage C, X9 sheets) -> animated items on the area's mid layer.
Each sheet is split in reading order; RECIPES names the pieces, ITEMS composes them into moving things:
  frames  - flapping/swimming animation (several pieces cycled)        travel - crosses the layer slowly, wrapping
  parts   - composite drawn around one anchor (clock face + 2 turning hands, chain + lantern, stand + swinging bell)
python3 tools/life.py E F G
"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from ingest import load_rgba, split, trim
from area import AREAS, src, save_webp

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RECIPES = {
    'E': ['bat0', 'bat1', 'bat2', 'bat3', 'lantern', 'chain', 'banner', 'spider', 'drop', 'moth0', 'moth1', 'moth2', 'moth3'],
    'F': ['moth0', 'moth1', 'moth2', 'moth3', 'fly0', 'fly1', 'flower', 'stem', 'vine', 'cap', 'leaf'],
    'U': ['chandelier', 'chain', 'curtain', 'puppet', 'arm0', 'arm1', 'leg0', 'leg1', 'moth0', 'moth1', 'moth2', 'moth3'],
    'G': ['face', 'hand1', 'hand2', 'chandelier', 'chain', 'fish0', 'fish1', 'fish2', 'fish3', 'banner', 'candle', 'bell', 'stand'],
}
MAXPX = 300   # stored size (layer px) of the largest dimension


def P(area, n): return {'img': f'scn_{area}_lf_{n}', 'src': f'assets/scn/{area}/lf_{n}.webp'}


def frames(area, names, fps):
    return {'fps': fps, 'imgs': [P(area, n)['img'] for n in names], 'srcs': [P(area, n)['src'] for n in names]}


def items_for(L, area, W, H):
    f = lambda *a: frames(area, *a)
    if L == 'E': return [
        dict(P(area, 'bat0'), frames=f(['bat0', 'bat1', 'bat2', 'bat3', 'bat2', 'bat1'], 10), x=W * .2, y=H * .22, s=.32, pivot=[.5, .5], travel=[70, W], bob=[18, 1.6]),
        dict(P(area, 'bat0'), frames=f(['bat1', 'bat2', 'bat3', 'bat2', 'bat1', 'bat0'], 11), x=W * .7, y=H * .3, s=.26, pivot=[.5, .5], travel=[-58, W], bob=[14, 1.3], flip=True),
        dict(P(area, 'lantern'), x=W * .33, y=0, s=.55, pivot=[.5, 0], sway=[.06, .8], parts=[dict(P(area, 'chain'), dx=0, dy=0, len=H * .2)], light=[255, 180, 110]),
        dict(P(area, 'banner'), x=W * .58, y=0, s=.7, pivot=[.5, 0], chain={'segs': 8, 'amp': .05, 'speed': .9}),
        dict(P(area, 'spider'), x=W * .86, y=0, s=.5, pivot=[.5, 0], bob=[30, .5]),
        dict(P(area, 'drop'), x=W * .47, y=H * .1, s=.35, pivot=[.5, 0], bob=[6, 1.3], glow=[255, 200, 130, 40, .4]),
        dict(P(area, 'moth0'), frames=f(['moth0', 'moth1', 'moth2', 'moth3'], 9), x=W * .1, y=H * .5, s=.22, pivot=[.5, .5], travel=[40, W], bob=[22, .9]),
    ]
    if L == 'F': return [
        dict(P(area, 'moth0'), frames=f(['moth0', 'moth1', 'moth2', 'moth3'], 8), x=W * .15, y=H * .35, s=.3, pivot=[.5, .5], travel=[44, W], bob=[24, .8]),
        dict(P(area, 'moth0'), frames=f(['moth1', 'moth2', 'moth3', 'moth0'], 9), x=W * .62, y=H * .5, s=.24, pivot=[.5, .5], travel=[-36, W], bob=[18, 1.1], flip=True),
        dict(P(area, 'fly0'), frames=f(['fly0', 'fly1'], 14), x=W * .4, y=H * .55, s=.16, pivot=[.5, .5], travel=[50, W], bob=[26, 1.7], glow=[180, 255, 120, 30, .6]),
        dict(P(area, 'fly0'), frames=f(['fly1', 'fly0'], 13), x=W * .8, y=H * .4, s=.14, pivot=[.5, .5], travel=[-40, W], bob=[20, 1.4], glow=[180, 255, 120, 30, .6], flip=True),
        dict(P(area, 'stem'), x=W * .27, y=H * .985, s=.8, pivot=[.5, 1], sway=[.04, .7], parts=[dict(P(area, 'flower'), dx=0, dy=-1, top=True, s=.55)], glow=[255, 200, 120, 60, .35]),
        dict(P(area, 'vine'), x=W * .52, y=0, s=.9, pivot=[.5, 0], chain={'segs': 8, 'amp': .06, 'speed': .8}),
        dict(P(area, 'cap'), x=W * .74, y=H * .985, s=.35, pivot=[.5, 1], flicker=[.85, 1, 1.5], glow=[90, 255, 210, 70, .35]),
        dict(P(area, 'leaf'), x=W * .9, y=H * .2, s=.22, pivot=[.5, .5], travel=[-26, W], bob=[40, .5], sway=[.6, .9]),
    ]
    if L == 'G': return [
        dict(P(area, 'face'), x=W * .3, y=H * .28, s=.55, pivot=[.5, .5], parts=[dict(P(area, 'hand1'), dx=0, dy=0, spin=.05, pv=[.5, .9], s=.24), dict(P(area, 'hand2'), dx=0, dy=0, spin=.6, pv=[.5, .88], s=.17)]),
        dict(P(area, 'chandelier'), x=W * .55, y=0, s=.5, pivot=[.5, 0], sway=[.05, .7], parts=[dict(P(area, 'chain'), dx=0, dy=0, len=H * .16)], light=[255, 190, 120]),
        dict(P(area, 'fish0'), frames=f(['fish0', 'fish1', 'fish2', 'fish3'], 6), x=W * .1, y=H * .45, s=.3, pivot=[.5, .5], travel=[30, W], bob=[16, .6], a=.75, glow=[180, 200, 255, 50, .25]),
        dict(P(area, 'fish0'), frames=f(['fish2', 'fish3', 'fish0', 'fish1'], 6), x=W * .7, y=H * .6, s=.24, pivot=[.5, .5], travel=[40, W], bob=[12, .7], a=.65, glow=[180, 200, 255, 40, .2]),
        dict(P(area, 'banner'), x=W * .8, y=0, s=.65, pivot=[.5, 0], chain={'segs': 8, 'amp': .05, 'speed': .9}),
        dict(P(area, 'candle'), x=W * .43, y=H * .4, s=.25, pivot=[.5, .5], bob=[10, .8], glow=[255, 190, 110, 50, .45]),
        dict(P(area, 'stand'), x=W * .92, y=H * .985, s=.6, pivot=[.5, 1], parts=[dict(P(area, 'bell'), dx=.28, dy=-.83, s=.36, pv=[.5, 0], swing=[.18, 1.1])]),
    ]
    if L == 'U': return [
        dict(P(area, 'chandelier'), x=W * .3, y=0, s=.55, pivot=[.5, 0], sway=[.04, .6], parts=[dict(P(area, 'chain'), dx=0, dy=0, len=H * .14)], light=[255, 200, 130]),
        dict(P(area, 'curtain'), x=W * .62, y=0, s=.7, pivot=[.5, 0], chain={'segs': 8, 'amp': .04, 'speed': .7}),
        dict(P(area, 'puppet'), x=W * .82, y=H * .1, s=.45, pivot=[.5, 0], sway=[.12, 1.1], parts=[dict(P(area, 'chain'), dx=0, dy=0, len=H * .1)]),
        dict(P(area, 'moth0'), frames=f(['moth0', 'moth1', 'moth2', 'moth3', 'moth2', 'moth1'], 9), x=W * .12, y=H * .4, s=.26, pivot=[.5, .5], travel=[40, W], bob=[22, .9]),
        dict(P(area, 'moth0'), frames=f(['moth2', 'moth3', 'moth2', 'moth1', 'moth0', 'moth1'], 8), x=W * .55, y=H * .55, s=.2, pivot=[.5, .5], travel=[-32, W], bob=[16, 1.2], flip=True),
    ]
    return []


def run(L):
    area = AREAS[L][0]; p = src(L + '9')
    if not p: return
    a = load_rgba(p).astype(np.float32); a[a[..., 3] < 24] = 0
    boxes = split(a, 14, min_area=1500); names = RECIPES[L]
    if len(boxes) != len(names): print(f'  ! {L}9: {len(boxes)} pieces, expected {len(names)}')
    out = os.path.join(ROOT, 'assets/scn', area)
    for nm, b in zip(names, boxes):
        pc, _ = trim(a[b[1]:b[1] + b[3], b[0]:b[0] + b[2]].copy()); k = min(1.0, MAXPX / max(pc.shape[:2]))
        save_webp(pc, os.path.join(out, f'lf_{nm}.webp'), h=max(8, round(pc.shape[0] * k)))
    S = json.load(open(os.path.join(ROOT, 'assets/scenes.json'))); lay = [l for l in S[area]['layers'] if l.get('id') == 'mid'][0]
    im = Image.open(os.path.join(ROOT, lay['src'])); W, H = im.width, im.height
    its = [it for it in lay.get('items', []) if not it.get('life')]
    for it in items_for(L, area, W, H):
        it['life'] = 1
        if 'travel' in it: it['a'] = round(min(it.get('a', 1), 0.78), 2)
        it['x'] = round(it['x']); it['y'] = round(it['y']); its.append(it)
    lay['items'] = its
    json.dump(S, open(os.path.join(ROOT, 'assets/scenes.json'), 'w'), indent=1); print(L, area, len(boxes), 'pieces')


if __name__ == '__main__':
    for L in sys.argv[1:]: run(L)
