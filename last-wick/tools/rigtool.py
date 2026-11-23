"""Build a puppet rig from separate part images + a rig spec.
python3 rigtool.py SPEC.json
SPEC: {
  "name": "wick", "parts_dir": "assets/art/wick/parts", "scale": 0.5,
  "parts": { "body": {"img": "body.png", "pivot": "bc"|[x,y]|[fx,fy] (fractions if <=1.0), "parent": null, "at": "parent:anchorName"|[x,y], "z": 1, "chain": {...}},
             ... },
  "anchors": { "body": {"neck": [fx,fy], "hipL": [fx,fy]} },   # attachment points as fractions of the parent image
  "clips": {...}, "springs": {...}, "points": {"tip": ["head", fx, fy]}
}
Pivot keywords: tl tc tr ml mc mr bl bc br (top/middle/bottom x left/center/right).
Writes assets/sprites/r_<name>.webp + assets/rigs/<name>.json (atlas rects resolved, all coordinates in atlas pixels).
"""
import sys, os, json, math
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')
KW = {'tl': (0, 0), 'tc': (0.5, 0), 'tr': (1, 0), 'ml': (0, 0.5), 'mc': (0.5, 0.5), 'mr': (1, 0.5), 'bl': (0, 1), 'bc': (0.5, 1), 'br': (1, 1)}

def resolve(v, w, h):
    if isinstance(v, str): f = KW[v]; return [f[0] * w, f[1] * h]
    if all(abs(c) <= 1.0 for c in v): return [v[0] * w, v[1] * h]
    return list(v)

def main(spec_path):
    S = json.load(open(spec_path)); name = S['name']; d = os.path.join(ROOT, S['parts_dir'])
    imgs = {}
    for pn, P in S['parts'].items():
        im = Image.open(os.path.join(d, P['img'])).convert('RGBA')
        if P.get('scale'): im = im.resize((round(im.width * P['scale']), round(im.height * P['scale'])), Image.LANCZOS)
        imgs[pn] = im
    # shelf-pack
    order = sorted(imgs, key=lambda k: -imgs[k].height); W = 2048; x = y = rowh = 0; rects = {}
    for k in order:
        im = imgs[k]
        if x + im.width + 2 > W: x = 0; y += rowh + 2; rowh = 0
        rects[k] = [x, y, im.width, im.height]; x += im.width + 2; rowh = max(rowh, im.height)
    H = y + rowh; atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for k, r in rects.items(): atlas.paste(imgs[k], (r[0], r[1]))
    os.makedirs(os.path.join(ROOT, 'assets/sprites'), exist_ok=True); os.makedirs(os.path.join(ROOT, 'assets/rigs'), exist_ok=True)
    atlas.save(os.path.join(ROOT, f'assets/sprites/r_{name}.webp'), 'WEBP', quality=92, method=5)
    out = {'atlas': f'r_{name}', 'src': f'assets/sprites/r_{name}.webp', 'scale': S.get('scale', 0.5), 'parts': {}, 'clips': S.get('clips', {}), 'springs': S.get('springs', {}), 'points': {}}
    anchors = S.get('anchors', {})
    for pn, P in S['parts'].items():
        w, h = rects[pn][2], rects[pn][3]
        piv = resolve(P.get('pivot', 'mc'), w, h)
        at = P.get('at', [0, 0])
        if isinstance(at, str):  # "parent:anchor" -> anchor fraction of parent image, relative to parent's pivot
            par = P['parent']; an = anchors[par][at.split(':')[1]]; pw, ph = rects[par][2], rects[par][3]
            ppiv = resolve(S['parts'][par].get('pivot', 'mc'), pw, ph); ax, ay = resolve(an, pw, ph); at = [ax - ppiv[0], ay - ppiv[1]]
        e = {'rect': rects[pn], 'pivot': piv, 'parent': P.get('parent'), 'at': at, 'z': P.get('z', 0)}
        if P.get('chain'): e['chain'] = P['chain']
        if P.get('hidden'): e['hidden'] = True
        out['parts'][pn] = e
    for k, (pn, fx, fy) in S.get('points', {}).items():
        w, h = rects[pn][2], rects[pn][3]; piv = out['parts'][pn]['pivot']; px, py = resolve([fx, fy], w, h)
        out['points'][k] = [pn, px - piv[0], py - piv[1]]
    json.dump(out, open(os.path.join(ROOT, f'assets/rigs/{name}.json'), 'w'), indent=1)
    print('rig', name, 'atlas', W, 'x', H, 'parts', len(rects))

if __name__ == '__main__':
    main(sys.argv[1])
