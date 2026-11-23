"""Ingest painted art from an image model.
- Removes flat/green/magenta/white backgrounds (keeps real transparency when present), with soft matte + despill.
- Splits a sheet into separate pieces (connected components), orders them reading-order, names them.
- Trims, optionally rescales, and writes PNGs + a JSON index.

Usage:
  python3 ingest.py sheet  IMG OUTDIR name1,name2,...   [--scale S] [--join PX]
  python3 ingest.py single IMG OUT.png [--scale S] [--keep-bg]
  python3 ingest.py layer  IMG OUT.webp [--tile] [--height H]   (background layers; --tile makes it seamless horizontally)
"""
import sys, os, json, argparse
import numpy as np, cv2
from PIL import Image

def load_rgba(path):
    im = Image.open(path).convert('RGBA'); return np.array(im).astype(np.float32)

def bg_color(a):
    h, w = a.shape[:2]
    border = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
    return np.median(border, axis=0)

def remove_bg(a, tol=None):
    """Return RGBA float array with background keyed out."""
    alpha = a[..., 3]
    if (alpha < 250).mean() > 0.05:  # already has transparency
        return a
    bg = bg_color(a); rgb = a[..., :3]
    if bg.max() - bg.min() > 110:  # saturated chroma background -> colour-difference keyer
        return chroma_key(a, bg)
    d = np.sqrt(((rgb - bg) ** 2).sum(-1))
    if tol is None:
        border = np.concatenate([d[0], d[-1], d[:, 0], d[:, -1]]); tol = max(18.0, np.percentile(border, 98) * 1.6)
    # flood-fill connected background from borders
    cand = (d < tol * 1.8).astype(np.uint8)
    h, w = cand.shape; mask = np.zeros((h + 2, w + 2), np.uint8)
    seeds = [(x, 0) for x in range(0, w, 7)] + [(x, h - 1) for x in range(0, w, 7)] + [(0, y) for y in range(0, h, 7)] + [(w - 1, y) for y in range(0, h, 7)]
    region = np.zeros_like(cand)
    for (x, y) in seeds:
        if cand[y, x] and not region[y, x]:
            m2 = np.zeros((h + 2, w + 2), np.uint8)
            cv2.floodFill(cand.copy(), m2, (x, y), 2, flags=4 | (1 << 8))
            region |= m2[1:-1, 1:-1]
    # also enclosed holes of exact bg colour (e.g. between legs)
    holes = (d < tol * 0.7).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(holes, 8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 60: region |= (lab == i).astype(np.uint8)
    # soft matte: inside region alpha ramps with distance from bg colour
    t = np.clip((d - tol * 0.6) / (tol * 1.2), 0, 1)
    A = np.where(region > 0, t, 1.0)
    A = cv2.GaussianBlur(A.astype(np.float32), (0, 0), 0.6)
    # despill: pull edge colours away from bg colour
    k = (1 - A)[..., None] * 0.9
    rgb2 = np.where(A[..., None] > 0.02, (rgb - bg * k) / np.maximum(1 - k, 0.1), rgb)
    out = np.dstack([np.clip(rgb2, 0, 255), A * 255])
    return out

def chroma_key(a, bg):
    rgb = a[..., :3].copy(); hi = bg > bg.mean()  # dominant channels of the key colour
    dom = rgb[..., hi].min(-1) if hi.sum() > 1 else rgb[..., hi][..., 0]
    oth = rgb[..., ~hi].max(-1) if (~hi).sum() > 0 else np.zeros(rgb.shape[:2])
    key = dom - oth
    kbg = (bg[hi].min() if hi.sum() > 1 else bg[hi][0]) - (bg[~hi].max() if (~hi).sum() else 0)
    A = 1 - np.clip((key - kbg * 0.18) / (kbg * 0.55), 0, 1)
    A = cv2.GaussianBlur(A.astype(np.float32), (0, 0), 0.5)
    # erode matte 1px to kill fringe, then despill dominant channels
    A = np.minimum(A, cv2.erode(A, np.ones((3, 3), np.uint8)) * 0.5 + A * 0.5)
    for c in np.nonzero(hi)[0]: rgb[..., c] = np.minimum(rgb[..., c], oth + 6)
    return np.dstack([rgb, A * 255])

def trim(a, pad=4):
    ys, xs = np.nonzero(a[..., 3] > 6)
    if not len(xs): return a, (0, 0)
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1), max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1)
    return a[y0:y1, x0:x1], (x0, y0)

def save(a, path, scale=1.0):
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    if scale != 1.0: im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    if path.endswith('.webp'): im.save(path, 'WEBP', quality=90, method=5)
    else: im.save(path)
    return im.size

def split(a, join=12, min_area=400):
    A = (a[..., 3] > 40).astype(np.uint8)
    if join: A = cv2.dilate(A, np.ones((join, join), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(A, 8)
    boxes = [st[i] for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > min_area]
    # reading order: rows by y-center band, then x
    boxes.sort(key=lambda b: (b[1] + b[3] / 2))
    rows = []
    for b in boxes:
        cy = b[1] + b[3] / 2
        if rows and abs(cy - rows[-1][0]) < max(b[3], rows[-1][1]) * 0.5: rows[-1][2].append(b); rows[-1][0] = (rows[-1][0] + cy) / 2
        else: rows.append([cy, b[3], [b]])
    ordered = [b for r in rows for b in sorted(r[2], key=lambda b: b[0])]
    return ordered

def make_tileable(a, blend=0.12):
    h, w = a.shape[:2]; bw = int(w * blend)
    left = a[:, :bw].copy(); right = a[:, -bw:].copy()
    k = np.linspace(0, 1, bw)[None, :, None]
    seam = right * (1 - k) + left * k
    out = a[:, bw:].copy(); out[:, -bw:] = seam
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('mode'); ap.add_argument('img'); ap.add_argument('out'); ap.add_argument('names', nargs='?')
    ap.add_argument('--scale', type=float, default=1.0); ap.add_argument('--join', type=int, default=12); ap.add_argument('--keep-bg', action='store_true')
    ap.add_argument('--tile', action='store_true'); ap.add_argument('--height', type=int, default=0); ap.add_argument('--tol', type=float, default=None)
    a_ = ap.parse_args()
    a = load_rgba(a_.img)
    if a_.mode == 'single':
        if not a_.keep_bg: a = remove_bg(a, a_.tol)
        a, _ = trim(a); print(a_.out, save(a, a_.out, a_.scale))
    elif a_.mode == 'sheet':
        a = remove_bg(a, a_.tol); os.makedirs(a_.out, exist_ok=True)
        names = a_.names.split(',') if a_.names else []
        boxes = split(a, a_.join); idx = {}
        for i, b in enumerate(boxes):
            x, y, w, h = b[:4]; piece = a[y:y + h, x:x + w].copy()
            # keep only the main component inside the box (avoid neighbours' bits)
            piece, off = trim(piece)
            nm = names[i] if i < len(names) else f'piece{i:02d}'
            sz = save(piece, os.path.join(a_.out, nm + '.png'), a_.scale)
            idx[nm] = {'src_box': [int(x), int(y), int(w), int(h)], 'size': list(sz)}
        json.dump(idx, open(os.path.join(a_.out, 'index.json'), 'w'), indent=1)
        print(len(boxes), 'pieces ->', a_.out, '(names given: %d)' % len(names))
    elif a_.mode == 'layer':
        if a.shape[2] == 4 and (a[..., 3] < 250).mean() < 0.01 and not a_.keep_bg and a_.out.endswith('png'): pass
        if a_.tile: a = make_tileable(a)
        if a_.height:
            s = a_.height / a.shape[0]
            im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').resize((round(a.shape[1] * s), a_.height), Image.LANCZOS); a = np.array(im).astype(np.float32)
        print(a_.out, save(a, a_.out))
