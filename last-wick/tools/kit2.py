"""Part-2 area kits (ART_BRIEF_2 stage C) -> assets/art/<area>/ pieces used by terrain2d.py
  X10 platforms + floors : plat0..plat5.png (6 different platforms), floor0/1.png (floor cover strips)
  X11 second wall texture: wall.png (2D tileable, 512) - deep rock / outside-the-room masonry
  X12 edges/corners/decor: wallL/wallR.png (vertical wall strips), cTL/cTR/cBL/cBR.png (corners), deco0..3.png
python3 tools/kit2.py E F     (area letters as in area.py) ; then terrain2d.py + terrain2d.py --rockfill
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from ingest import load_rgba, split, trim, make_tileable
from area import AREAS, src, u8, tileable2d

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def clean(a):
    a = a.astype(np.float32).copy(); a[a[..., 3] < 24] = 0; return a   # the sheets carry a faint glow halo (alpha < 20)


def pieces(a, join=14):
    return [(b, trim(a[b[1]:b[1] + b[3], b[0]:b[0] + b[2]].copy())[0]) for b in split(a, join, min_area=3000)]


def save(a, path, scale=1.0):
    im = u8(a)
    if scale != 1: im = im.resize((max(4, round(im.width * scale)), max(4, round(im.height * scale))), Image.LANCZOS)
    im.save(path); return im.size


def run(letter):
    area = AREAS[letter][0]; d = os.path.join(ROOT, 'assets/art', area); os.makedirs(d, exist_ok=True); done = []
    p = src(letter + '10')
    if p:
        ps = pieces(clean(load_rgba(p)))
        isf = [x[1].shape[1] > x[1].shape[0] * 7 for x in ps]; floors = [x for x, f in zip(ps, isf) if f]; plats = [x for x, f in zip(ps, isf) if not f]
        for i, (_, pc) in enumerate(plats[:6]): save(pc, os.path.join(d, f'plat{i}.png'))
        for i, (_, pc) in enumerate(sorted(floors, key=lambda x: x[0][1])[:2]):
            pc = make_tileable(pc, 0.06); save(pc, os.path.join(d, f'floor{i}.png'), 1400 / pc.shape[1])
        done.append(f'plats {len(plats)} floors {len(floors)}')
    p = src(letter + '11')
    if p:
        a = load_rgba(p); a[..., 3] = 255; a = tileable2d(a)
        u8(a).resize((512, 512), Image.LANCZOS).save(os.path.join(d, 'wall.png')); done.append('wall')
    p = src(letter + '12')
    if p:
        ps = pieces(clean(load_rgba(p)))
        iss = [x[1].shape[0] > x[1].shape[1] * 2.2 for x in ps]
        strips = sorted([x for x, f in zip(ps, iss) if f], key=lambda x: x[0][0]); rest = [x for x, f in zip(ps, iss) if not f]
        cy = sorted(rest, key=lambda x: x[0][1] + x[0][3] / 2)
        decos = sorted(cy[-4:], key=lambda x: x[0][0]); corners = cy[:-4]
        top = sorted(sorted(corners, key=lambda x: x[0][1])[:2], key=lambda x: x[0][0])
        bot = sorted(sorted(corners, key=lambda x: x[0][1])[2:], key=lambda x: x[0][0])
        man = {}
        for nm, x, sc in [('wallL', strips[0], 0.62), ('wallR', strips[-1], 0.62)] + list(zip(('cTL', 'cTR'), top, (0.62, 0.62))) + \
                list(zip(('cBL', 'cBR'), bot, (0.62, 0.62))) + [(f'deco{i}', x, 0.55) for i, x in enumerate(decos)]:
            man[nm] = save(x[1], os.path.join(d, nm + '.png'), sc)
        json.dump(man, open(os.path.join(d, 'kit2.json'), 'w'))
        done.append(f'edges {len(strips)} corners {len(corners)} decos {len(decos)}')
    print(letter, area, ', '.join(done))


if __name__ == '__main__':
    for L in sys.argv[1:]: run(L)
