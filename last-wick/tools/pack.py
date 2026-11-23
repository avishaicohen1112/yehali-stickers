"""Pack rendered frames into an atlas. python3 pack.py FRAMEDIR OUTBASE [--outline N] [--scale S] [--crop]
Frames are named <anim>_<ii>.png, meta.json carries anim info (n, loop, fps, extra per-frame data)."""
import sys, os, json, glob, math, argparse
import numpy as np, cv2
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('dir'); ap.add_argument('out')
ap.add_argument('--outline', type=float, default=2); ap.add_argument('--scale', type=float, default=1.0)
ap.add_argument('--ink', default='10,8,18'); ap.add_argument('--style', type=float, default=0.0); ap.add_argument('--maxw', type=int, default=4096)
a = ap.parse_args()
meta = json.load(open(os.path.join(a.dir, 'meta.json')))
ink = tuple(int(x) for x in a.ink.split(','))

def post(im):
    arr = np.array(im).astype(np.float32)
    if a.scale != 1.0:
        h, w = arr.shape[:2]
        arr = cv2.resize(arr, (round(w * a.scale), round(h * a.scale)), interpolation=cv2.INTER_AREA)
    al = arr[..., 3] / 255.0
    if a.style > 0:
        # painterly: inner edge shadow, contrast curve, slight saturation boost
        inside = cv2.distanceTransform((al > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
        k = np.clip(inside / (6 * a.style), 0, 1); k = k * k * (3 - 2 * k)
        rgb = arr[..., :3] / 255.0
        rgb = np.clip((rgb - 0.5) * (1 + 0.25 * a.style) + 0.5, 0, 1)
        lum = rgb.mean(axis=2, keepdims=True); rgb = np.clip(lum + (rgb - lum) * (1 + 0.3 * a.style), 0, 1)
        rgb = rgb * (0.45 + 0.55 * k[..., None])
        arr[..., :3] = rgb * 255
    if a.outline > 0:
        r = a.outline; k = int(math.ceil(r)) * 2 + 1
        ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        dil = cv2.dilate(al, ker); dil = cv2.GaussianBlur(dil, (3, 3), 0.6)
        out = np.zeros_like(arr)
        out[..., 0], out[..., 1], out[..., 2] = ink
        out[..., 3] = dil * 255
        # composite original over outline (premultiplied)
        fa = al[..., None]
        rgb = arr[..., :3] * fa + out[..., :3] * (1 - fa) * dil[..., None]
        A = fa[..., 0] + dil * (1 - fa[..., 0])
        rgb = np.where(A[..., None] > 1e-4, rgb / np.maximum(A[..., None], 1e-4), 0)
        arr = np.dstack([rgb, A * 255])
    return np.clip(arr, 0, 255).astype(np.uint8)

frames = []
for name, info in meta['anims'].items():
    for i in range(info['n']):
        frames.append((name, i, post(Image.open(os.path.join(a.dir, f'{name}_{i:02d}.png')).convert('RGBA'))))
ch, cw = frames[0][2].shape[:2]
cols = max(1, min(len(frames), a.maxw // cw)); rows = math.ceil(len(frames) / cols)
atlas = np.zeros((rows * ch, cols * cw, 4), np.uint8)
out = {'cell': [cw, ch], 'scale': a.scale, 'unitPx': meta.get('unitPx', 100) * a.scale,
       'origin': [v * a.scale for v in meta['origin']], 'anims': {}}
for k, (name, i, fr) in enumerate(frames):
    x, y = (k % cols) * cw, (k // cols) * ch
    atlas[y:y + ch, x:x + cw] = fr
    an = out['anims'].setdefault(name, {kk: vv for kk, vv in meta['anims'][name].items()})
    an.setdefault('f', []).append([x, y])
    for kk, vv in meta['anims'][name].items():
        if isinstance(vv, list) and len(vv) == meta['anims'][name]['n'] and isinstance(vv[0], list):
            an[kk] = [[c * a.scale for c in p] for p in vv]
Image.fromarray(atlas).save(a.out + '.webp', 'WEBP', quality=90, method=6)
json.dump(out, open(a.out + '.json', 'w'), separators=(',', ':'))
print(a.out, atlas.shape, os.path.getsize(a.out + '.webp') // 1024, 'KB')
