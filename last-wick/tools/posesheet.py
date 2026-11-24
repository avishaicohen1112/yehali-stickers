"""Pose sheets (4x4 etc. from the image model) -> sprite atlas with a separate anchor per frame.

Everything is driven by a spec file (tools/sheets/<atlas>.json) so re-running is one command:

  python3 tools/posesheet.py tools/sheets/wick.json [--debug DIR]
  python3 tools/posesheet.py --all [--debug DIR]

Spec format:
{
  "atlas": "wick",                         // -> assets/sprites/wick.webp + wick.json
  "sources": {"A02": "art_in/A02.png", "A03": "art_in/A03.png"},   // relative to last-wick/
  "grid": [4, 4],                          // cols, rows (per source; may be overridden per source: "grids": {"A03": [4,2]})
  "cells": {"A02": ["idle0", "idle1", ...16 names, null to skip]},
  "scale": {"A02": ["idle0", 106], "A03": ["look", 106]},   // per source: reference frame + its full height in game px
  "unitPx": 100,                           // game draws at ppu(50)/unitPx -> stored at 2x game resolution
  "tip": true,                             // find the wick tip (flame point) per frame
  "anims": {"idle": {"f": ["idle0", "idle1"], "fps": 3, "loop": true}, ...},
  "override": {"run2": {"dx": 0, "dy": 0, "tip": [x, y]}}   // nudge anchor (game px) / force tip (frame px)
}
Anchor per frame: y = feet line (lowest solid row; "anchorY": "center" for flyers keeps the body centre fixed), x = centre of the body core (alpha eroded so thin
needle/scarf/wick do not pull it). Atlas frames: f=[x,y,w,h], o=[ox,oy] (anchor inside the frame), tip=[x,y].
Several atlases may come out of one sheet (enemy sheets: one row per enemy) - write one spec per atlas.
"""
import sys, os, json, glob, argparse
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from ingest import load_rgba, remove_bg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def grid_edges(mass, n):
    """Split a 1D alpha projection into n bands, snapping each inner edge to the emptiest line nearby."""
    L = len(mass); edges = [0]
    for i in range(1, n):
        c = round(i * L / n); r = max(2, int(L / n * 0.18))
        lo, hi = max(1, c - r), min(L - 1, c + r)
        seg = mass[lo:hi]
        mn = seg.min(); idx = np.nonzero(seg <= mn + 1e-6)[0]
        edges.append(lo + int(idx[len(idx) // 2]))  # middle of the emptiest run
    edges.append(L); return edges


def cut_cells(a, cols, rows):
    """Return list of (rgba crop, (x0,y0)) per cell in reading order. Pieces that stick into a neighbour
    cell stay with the cell that owns most of their area; pieces truly split between cells are clipped."""
    A = a[..., 3] > 24
    xe = grid_edges(A.sum(0).astype(np.float32), cols)
    ye = grid_edges(A.sum(1).astype(np.float32), rows)
    n, lab, st, cen = cv2.connectedComponentsWithStats(A.astype(np.uint8), 8)
    cell_of = lambda x, y: (min(rows - 1, np.searchsorted(ye, y, 'right') - 1), min(cols - 1, np.searchsorted(xe, x, 'right') - 1))
    owner = np.full(n, -1)
    H, W = A.shape
    cell_area = (W / cols) * (H / rows)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < cell_area * 0.0004: continue  # specks
        x, y, w, h = st[i, :4]
        sub = lab[y:y + h, x:x + w] == i
        best, cnt = None, {}
        for r in range(rows):
            for c in range(cols):
                ox0, ox1 = max(x, xe[c]), min(x + w, xe[c + 1]); oy0, oy1 = max(y, ye[r]), min(y + h, ye[r + 1])
                if ox1 <= ox0 or oy1 <= oy0: continue
                k = int(sub[oy0 - y:oy1 - y, ox0 - x:ox1 - x].sum())
                if k: cnt[(r, c)] = k
        tot = sum(cnt.values()); best = max(cnt, key=cnt.get)
        owner[i] = -2 if cnt[best] < tot * 0.8 else best[0] * cols + best[1]  # -2 = split: clip at grid
    out = []
    for r in range(rows):
        for c in range(cols):
            k = r * cols + c
            keep = np.isin(lab, np.nonzero(owner == k)[0])
            clip = np.zeros_like(A); clip[ye[r]:ye[r + 1], xe[c]:xe[c + 1]] = True
            keep |= np.isin(lab, np.nonzero(owner == -2)[0]) & clip
            if not keep.any(): out.append((None, (0, 0))); continue
            m = cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0  # keep soft edge pixels
            piece = a.copy(); piece[..., 3] *= m
            ys, xs = np.nonzero(piece[..., 3] > 6)
            x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            out.append((piece[y0:y1, x0:x1], (int(x0), int(y0))))
    return out


def analyse(fr, ref_h):
    """Anchor (feet, body centre) and wick tip for one frame (in frame pixels)."""
    al = fr[..., 3]; A = al > 60
    ko = max(3, int(ref_h * 0.02)) | 1  # opening drops thin needle/scarf tips so they don't count as feet
    Ao = cv2.morphologyEx(A.astype(np.uint8), cv2.MORPH_OPEN, np.ones((ko, ko), np.uint8)) > 0
    rows = (Ao if Ao.sum() > 50 else A).sum(1); ys = np.nonzero(rows >= 2)[0]
    feet = int(ys.max()) + 1 if len(ys) else fr.shape[0]
    k = max(3, int(ref_h * 0.07)) | 1
    core = cv2.erode(A.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    if core.sum() < 50: core = A.astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(core, 8)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])) if n > 1 else 0
    core = (lab == big) if n > 1 else core > 0
    cys, cxs = np.nonzero(core)
    cx = float(np.median(cxs))
    # tip (hero): find the ivory wax head first, then the topmost dark pixel of the wick just above it
    rgb = fr[..., :3]
    headm = ((rgb[..., 0] > 185) & (rgb[..., 1] > 145) & (rgb[..., 0] - rgb[..., 2] > 25) & (al > 200)).astype(np.uint8)
    hn, hl, hs, _ = cv2.connectedComponentsWithStats(headm, 8)
    if hn > 1 and hs[1:, cv2.CC_STAT_AREA].max() > ref_h * ref_h * 0.02:
        hb = 1 + int(np.argmax(hs[1:, cv2.CC_STAT_AREA])); hx, hy, hw, hh = hs[hb, :4]
        x0, x1 = max(0, hx - hw // 6), min(fr.shape[1], hx + hw + hw // 6)
        col = A[:hy + hh // 4, x0:x1]; yy, xx = np.nonzero(col)
        if len(yy):
            ty = int(yy.min()); return {'feet': feet, 'cx': cx, 'cy': float(np.mean(cys)), 'tip': [float(x0 + np.median(xx[yy <= ty + 1])), float(ty)]}
    # fallback: top of the core, then climb the thin wick right above it
    top = int(cys.min()); tx = float(np.median(cxs[cys < top + max(2, k // 2)]))
    win = int(ref_h * 0.07)
    x0, x1 = max(0, int(tx) - win), min(fr.shape[1], int(tx) + win + 1)
    col = A[:top + 1, x0:x1]; yy, xx = np.nonzero(col)
    if len(yy): ty = int(yy.min()); tipx = float(x0 + np.median(xx[yy <= ty + 1]))
    else: ty, tipx = top, tx
    return {'feet': feet, 'cx': cx, 'cy': float(np.mean(cys)), 'tip': [tipx, float(ty)]}


def pack(frames, maxw=4096, pad=2):
    order = sorted(range(len(frames)), key=lambda i: -frames[i].shape[0])
    pos = [None] * len(frames); x = y = rowh = 0; W = 0
    for i in order:
        h, w = frames[i].shape[:2]
        if x + w + pad > maxw: x = 0; y += rowh + pad; rowh = 0
        pos[i] = (x, y); x += w + pad; rowh = max(rowh, h); W = max(W, x)
    H = y + rowh
    sheet = np.zeros((H, W, 4), np.float32)
    for i, (px, py) in enumerate(pos):
        h, w = frames[i].shape[:2]; sheet[py:py + h, px:px + w] = frames[i]
    return sheet, pos


def resize(fr, s):
    if abs(s - 1) < 1e-3: return fr
    im = Image.fromarray(np.clip(fr, 0, 255).astype(np.uint8), 'RGBA')
    # premultiplied resize to avoid dark/colour fringes
    a = np.array(im).astype(np.float32); a[..., :3] *= a[..., 3:] / 255
    h, w = a.shape[:2]; nw, nh = max(1, round(w * s)), max(1, round(h * s))
    r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    r = np.clip(r, 0, 255); al = r[..., 3:]
    r[..., :3] = np.where(al > 0.5, r[..., :3] * 255 / np.maximum(al, 1e-3), 0)
    return np.clip(r, 0, 255)


def build(spec_path, debug=None, outdir=None):
    S = json.load(open(spec_path)); name = S['atlas']; unit = S.get('unitPx', 100)
    frames = {}; info = {}
    for src, path in S['sources'].items():
        p = os.path.join(ROOT, path)
        if not os.path.exists(p):  # any extension will do (art_src/A02 -> A02.png / .webp / .jpg)
            c = sorted(glob.glob(os.path.splitext(p)[0] + '.*')); p = c[0] if c else p
        if not os.path.exists(p): print(f'  [{name}] missing source {src}: {path} - skipped'); continue
        a = remove_bg(load_rgba(p))
        cols, rows = S.get('grids', {}).get(src, S.get('grid', [4, 4]))
        cells = cut_cells(a, cols, rows); names = S['cells'][src]
        raw = {}
        for nm, (fr, off) in zip(names, cells):
            if nm and fr is not None: raw[nm] = fr
            elif nm: print(f'  [{name}] {src}: cell for "{nm}" is empty')
        ref, ref_px = S['scale'][src]
        if ref not in raw: print(f'  [{name}] {src}: reference frame {ref} missing'); continue
        ref_h_src = analyse(raw[ref], raw[ref].shape[0])['feet'] - 0
        top = np.nonzero((raw[ref][..., 3] > 60).sum(1) >= 2)[0].min()
        s = ref_px * unit / 50 / (ref_h_src - top)  # stored px per source px
        for nm, fr in raw.items():
            fr = resize(fr, s); frames[nm] = fr
            info[nm] = analyse(fr, ref_px * unit / 50); info[nm]['src'] = src
        if S.get('anchorY') == 'center':  # flyers: keep the body centre still (wings move the bottom edge)
            r = info[ref]; off = r['feet'] - r['cy']
            for nm in raw: info[nm]['feet'] = info[nm]['cy'] + off
    ov = S.get('override', {})
    names = list(frames)
    margin = 2
    padded = []
    for nm in names:
        fr = frames[nm]; h, w = fr.shape[:2]
        p = np.zeros((h + 2 * margin, w + 2 * margin, 4), np.float32); p[margin:margin + h, margin:margin + w] = fr
        padded.append(p); d = info[nm]
        d['cx'] += margin; d['feet'] += margin; d['tip'] = [d['tip'][0] + margin, d['tip'][1] + margin]
        o = ov.get(nm, {}); g2p = unit / 50
        d['cx'] -= o.get('dx', 0) * g2p; d['feet'] -= o.get('dy', 0) * g2p
        if 'tip' in o: d['tip'] = o['tip']
    if not padded: print(f'  [{name}] nothing built'); return None
    rig = {}
    if S.get('rig'):  # cut-out parts (e.g. NPC head/body): find where each part sits inside the full figure
        base = S['rig']['base']; B = padded[names.index(base)][..., 3]; bo = info[base]
        for part in S['rig']['parts']:
            if part not in names: continue
            Pm = padded[names.index(part)][..., 3]; best = (-1, None, 1)
            for sc in (0.9, 0.95, 1.0, 1.05, 1.1):
                T_ = cv2.resize(Pm, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
                if T_.shape[0] > B.shape[0] or T_.shape[1] > B.shape[1]: continue
                r = cv2.matchTemplate(B, T_, cv2.TM_CCORR_NORMED); _, v, _, loc = cv2.minMaxLoc(r)
                if v > best[0]: best = (v, loc, sc)
            if best[1] is None: continue
            pi = info[part]; sc = best[2]
            rig[part] = [round(best[1][0] + pi['cx'] * sc - bo['cx'], 1), round(best[1][1] + pi['feet'] * sc - bo['feet'], 1), round(best[0], 3)]
        print(f'  [{name}] rig:', rig)
    sheet, pos = pack(padded)
    meta = {'v': 2, 'unitPx': unit, 'scale': 1.0,
            'cell': [int(max(p.shape[1] for p in padded)), int(max(p.shape[0] for p in padded))], 'anims': {}}
    idx = {nm: i for i, nm in enumerate(names)}
    for an, A in S['anims'].items():
        fl = [f for f in A['f'] if f in idx]
        if not fl: continue
        e = {'n': len(fl), 'loop': A.get('loop', False), 'fps': A.get('fps', 10),
             'f': [[pos[idx[f]][0], pos[idx[f]][1], padded[idx[f]].shape[1], padded[idx[f]].shape[0]] for f in fl],
             'o': [[round(info[f]['cx'], 1), round(info[f]['feet'], 1)] for f in fl]}
        if S.get('tip'): e['tip'] = [[round(v, 1) for v in info[f]['tip']] for f in fl]
        for k in ('speed', 'hold'):
            if k in A: e[k] = A[k]
        meta['anims'][an] = e
    first = meta['anims'][next(iter(meta['anims']))]
    meta['origin'] = first['o'][0]
    if rig: meta['rig'] = rig
    out = os.path.join(outdir or os.path.join(ROOT, 'assets/sprites'), name)
    Image.fromarray(np.clip(sheet, 0, 255).astype(np.uint8), 'RGBA').save(out + '.webp', 'WEBP', quality=90, method=5)
    json.dump(meta, open(out + '.json', 'w'), separators=(',', ':'))
    print(f'  [{name}] {len(names)} frames, {len(meta["anims"])} anims -> {out}.webp {sheet.shape[1]}x{sheet.shape[0]}')
    if debug: debug_sheet(name, names, padded, info, S, debug)
    return meta


def debug_sheet(name, names, frames, info, S, d):
    """Contact sheet on dark bg: each frame aligned on its anchor (green line = feet, cross = anchor, dot = tip),
    plus an onion-skin row per animation to spot jitter."""
    os.makedirs(d, exist_ok=True)
    cw = max(int(info[n]['cx']) for n in names) + max(f.shape[1] - int(info[n]['cx']) for n, f in zip(names, frames)) + 8
    up = max(int(info[n]['feet']) for n in names) + 8; dn = max(f.shape[0] - int(info[n]['feet']) for n, f in zip(names, frames)) + 8
    ch = up + dn; cols = 8; rows = (len(names) + cols - 1) // cols
    anims = [a for a in S['anims'] if any(f in names for f in S['anims'][a]['f'])]
    H = ch * (rows + (len(anims) + cols - 1) // cols) + 20
    img = np.zeros((H, cw * cols, 3), np.uint8); img[:] = (28, 22, 30)

    def blit(fr, x, y, alpha=1.0):
        h, w = fr.shape[:2]; x, y = int(round(x)), int(round(y))
        X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(img.shape[1], x + w), min(img.shape[0], y + h)
        if X1 <= X0 or Y1 <= Y0: return
        f = fr[Y0 - y:Y1 - y, X0 - x:X1 - x]; a = f[..., 3:] / 255 * alpha
        img[Y0:Y1, X0:X1] = (img[Y0:Y1, X0:X1] * (1 - a) + f[..., :3] * a).astype(np.uint8)
    for i, (nm, fr) in enumerate(zip(names, frames)):
        ox, oy = (i % cols) * cw + cw // 2, (i // cols) * ch + up; d_ = info[nm]
        cv2.line(img, (ox - cw // 2 + 2, oy), (ox + cw // 2 - 2, oy), (60, 160, 60), 1)
        blit(fr, ox - d_['cx'], oy - d_['feet'])
        cv2.drawMarker(img, (ox, oy), (80, 255, 80), cv2.MARKER_CROSS, 14, 1)
        if S.get('tip'): cv2.circle(img, (int(ox - d_['cx'] + d_['tip'][0]), int(oy - d_['feet'] + d_['tip'][1])), 4, (60, 170, 255), -1)
        cv2.putText(img, nm, (ox - cw // 2 + 4, oy + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)
    base = rows * ch
    for j, an in enumerate(anims):
        ox, oy = (j % cols) * cw + cw // 2, base + (j // cols) * ch + up
        fl = [f for f in S['anims'][an]['f'] if f in names]
        cv2.line(img, (ox - cw // 2 + 2, oy), (ox + cw // 2 - 2, oy), (60, 160, 60), 1)
        for f in fl: blit(frames[names.index(f)], ox - info[f]['cx'], oy - info[f]['feet'], 1.0 / len(fl) ** 0.5)
        cv2.drawMarker(img, (ox, oy), (80, 255, 80), cv2.MARKER_CROSS, 14, 1)
        cv2.putText(img, an, (ox - cw // 2 + 4, oy + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 220, 120), 1)
    p = os.path.join(d, name + '_anchors.png'); cv2.imwrite(p, img[..., ::-1]); print('  debug ->', p)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('spec', nargs='?'); ap.add_argument('--all', action='store_true'); ap.add_argument('--debug'); ap.add_argument('--out')
    a = ap.parse_args()
    # e2_* (full 16-pose enemy sheets) run after e_* (4-pose rows) so they win whenever their source exists
    specs = sorted(glob.glob(os.path.join(ROOT, 'tools/sheets/*.json')), key=lambda p: (os.path.basename(p).startswith('e2_'), p)) if a.all else [a.spec]
    for s in specs: build(s, a.debug, a.out)
