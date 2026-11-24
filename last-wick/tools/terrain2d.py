"""Paint room terrain from hand-painted texture kits (from the image model).
Kit per area in assets/art/<area>/ :
  rock.png         tileable fill texture (opaque)
  trim_top.png     wide transparent strip that sits ON TOP of floors (moss / wax caps / crystals). Its 'ground line'
                   is at anchor_top (fraction of height, default 0.45): above it hangs up over the air, below sinks into rock.
  trim_bottom.png  wide transparent strip hanging DOWN from ceilings (stalactites / roots / drips). Ground line at 0.25.
  plat.png         a one-way platform (3-sliced horizontally)
  spikes.png       tileable spike strip, base at the bottom
Missing pieces fall back to procedural placeholders, so rooms always render.
python3 terrain2d.py [room ...]
"""
import sys, os, json, hashlib
import numpy as np, cv2
from PIL import Image
import world, terrain as T2

ROOT = os.path.join(os.path.dirname(__file__), '..'); OUT = os.environ.get('ROOM_OUT', os.path.join(ROOT, 'assets', 'rooms')); ART = os.environ.get('ART_DIR', os.path.join(ROOT, 'assets', 'art'))
T = T2.T
KIT_DEFAULT = {'anchor_top': 0.45, 'anchor_bottom': 0.25, 'trim_scale': 1.0, 'rock_scale': 1.0, 'deep': [8, 7, 10], 'rim': [230, 200, 160], 'darken': 0.92, 'tex_mul': 0.42}

def load(path):
    if not os.path.exists(path): return None
    return np.array(Image.open(path).convert('RGBA')).astype(np.float32)

def kit(area):
    d = os.path.join(ART, area); k = dict(KIT_DEFAULT)
    if os.path.exists(os.path.join(d, 'kit.json')): k.update(json.load(open(os.path.join(d, 'kit.json'))))
    for n in ('rock', 'trim_top', 'trim_bottom', 'plat', 'spikes'):
        k[n] = load(os.path.join(d, n + '.png'))
    if k['rock'] is None:  # placeholder: dark noise
        n = T2.fbm(512, 512, 60, 5, 7); c = np.array(T2.PAL[area]['body'], np.float32)
        k['rock'] = np.dstack([c[None, None, :] * (0.5 + n[..., None]), np.full((512, 512), 255.0)])
    if k['rock_scale'] != 1:
        r = k['rock']; k['rock'] = cv2.resize(r, (int(r.shape[1] * k['rock_scale']), int(r.shape[0] * k['rock_scale'])), interpolation=cv2.INTER_AREA)
    for n in ('trim_top', 'trim_bottom', 'plat', 'spikes'):
        if k[n] is not None and k['trim_scale'] != 1 and n.startswith('trim'):
            r = k[n]; k[n] = cv2.resize(r, (int(r.shape[1] * k['trim_scale']), int(r.shape[0] * k['trim_scale'])), interpolation=cv2.INTER_AREA)
    return k

def over(dst, src, x, y):
    """alpha-composite src (h,w,4 float) onto dst at x,y (clipped)."""
    h, w = src.shape[:2]; H, W = dst.shape[:2]
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]; d = dst[y0:y1, x0:x1]
    a = s[..., 3:4] / 255.0; da = d[..., 3:4] / 255.0
    oa = a + da * (1 - a)
    d[..., :3] = np.where(oa > 0, (s[..., :3] * a + d[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-4), 0)
    d[..., 3:4] = oa * 255

def edge_runs(S, top=True):
    """Per column, y of each top (air above solid) or bottom (solid above air) transition."""
    H, W = S.shape; out = []
    for x in range(W):
        col = S[:, x]; tr = np.nonzero(np.diff(col.astype(np.int8)))[0]
        for t in tr:
            if top and col[t] == 0 and col[t + 1] == 1: out.append((x, t + 1))
            if not top and col[t] == 1 and col[t + 1] == 0: out.append((x, t))
    return out

def drape(img, strip, pts, anchor, seed, flip=False):
    """Paint a wide strip following an edge: column x uses strip column (x+off) % w, ground line at anchor."""
    if strip is None or not pts: return
    h, w = strip.shape[:2]; ay = int(h * anchor); rng = np.random.default_rng(seed)
    off = int(rng.integers(0, w)); H, W = img.shape[:2]
    # runs of neighbouring edge points -> distance to the nearest end of the run, used to taper the strip
    pts = sorted(pts); fade = {}; run = []
    def flush():
        n = len(run)
        for i, q in enumerate(run): fade[q] = min(1.0, min(i, n - 1 - i) / 70.0)
    for q in pts:
        if run and (q[0] - run[-1][0] > 1 or abs(q[1] - run[-1][1]) > 8): flush(); run = []
        run.append(q)
    if run: flush()
    # group points per column (multiple edges per column allowed)
    for (x, y) in pts:
        sx = (x + off) % w; col = strip[:, sx:sx + 1]
        y0 = y - ay
        a0, a1 = max(0, y0), min(H, y0 + h)
        if a1 <= a0: continue
        s = col[a0 - y0:a1 - y0, 0]; d = img[a0:a1, x]
        f = fade.get((x, y), 1.0); f = f * f * (3 - 2 * f)
        a = s[:, 3:4] / 255.0 * f; da = d[:, 3:4] / 255.0; oa = a + da * (1 - a)
        d[:, :3] = np.where(oa > 0, (s[:, :3] * a + d[:, :3] * da * (1 - a)) / np.maximum(oa, 1e-4), 0); d[:, 3:4] = oa * 255

def three_slice(img, w_target):
    h, w = img.shape[:2]; cap = int(w * 0.18); mid = img[:, cap:w - cap]
    out = np.zeros((h, w_target, 4), np.float32)
    out[:, :cap] = img[:, :cap]; out[:, w_target - cap:] = img[:, w - cap:]
    x = cap
    while x < w_target - cap:
        n = min(mid.shape[1], w_target - cap - x); out[:, x:x + n] = mid[:, :n]; x += n
    return out

def shape(r):
    """Organic solid mask S, inside distance dd, grid g (same as terrain3d.shape, without Blender)."""
    seed = int(hashlib.md5(r.id.encode()).hexdigest()[:6], 16)
    g = T2.grid_of(r); H, W = g.shape[0] * T2.T, g.shape[1] * T2.T
    solid = np.kron((g == '#').astype(np.uint8), np.ones((T2.T, T2.T), np.uint8))
    d_in = cv2.distanceTransform(solid, cv2.DIST_L2, 5); d_out = cv2.distanceTransform(1 - solid, cv2.DIST_L2, 5)
    sdf = cv2.GaussianBlur(d_in - d_out, (0, 0), 11)   # rounded corners instead of tile-cut 90 degree edges
    # walkable tops stay close to the collision line; walls, cliffs and ceilings get big organic lumps
    gt = g == '#'; above_air = np.vstack([np.zeros((1, gt.shape[1]), bool), ~gt[:-1]])
    fl = np.zeros((H, W), np.uint8)
    for (ty, tx) in zip(*np.nonzero(gt & above_air)): fl[ty * T2.T:ty * T2.T + 3, tx * T2.T:(tx + 1) * T2.T] = 1
    fd = cv2.distanceTransform(1 - fl, cv2.DIST_L2, 5)
    wob = 0.12 + 0.88 * T2.smoothstep(10, 80, fd)
    sdf = sdf + ((T2.fbm(H, W, 150, 4, seed) - 0.5) * 46 + (T2.fbm(H, W, 45, 3, seed + 1) - 0.5) * 14 + (T2.fbm(H, W, 14, 2, seed + 3) - 0.5) * 4) * wob
    S = (sdf > 0).astype(np.uint8)
    S = cv2.morphologyEx(S, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    dd = cv2.distanceTransform(S, cv2.DIST_L2, 5)
    return g, S, dd, sdf, seed, W, H

def paint(r):
    K = kit(r.area); seed = int(hashlib.md5(r.id.encode()).hexdigest()[:6], 16)
    g, S, dd, sdf, _, W, H = shape(r)
    img = np.zeros((H, W, 4), np.float32)
    rock = K['rock']; rh, rw = rock.shape[:2]
    reps = (H // rh + 2, W // rw + 2)
    tiled = np.tile(rock[..., :3], (reps[0], reps[1], 1))[:H, :W]
    deep = T2.smoothstep(18, 150, dd)[..., None]
    # solid rock reads as a dark mass (texture kept only near the lit edges) so it never blends into the painted background
    edge = 1 - T2.smoothstep(6, 60, dd)[..., None]
    rgb = tiled * (K['tex_mul'] + (1 - K['tex_mul']) * edge * 0.6) * (1 - deep * K['darken']) + np.array(K['deep'], np.float32) * deep * 0.6
    # rim light on up-facing edges + ink outline
    gy, gx = np.gradient(cv2.GaussianBlur(S.astype(np.float32), (0, 0), 3))
    up = np.clip(gy * 6, 0, 1)[..., None]
    edge = (1 - T2.smoothstep(0, 9, dd))[..., None]
    edge2 = (1 - T2.smoothstep(0, 16, dd))[..., None]
    rgb = rgb + np.array(K['rim'], np.float32) * (edge * 0.55 + edge2 * 0.35) * up  # walkable tops catch the light
    rgb = rgb * (0.25 + 0.75 * T2.smoothstep(0, 2.5, dd)[..., None])
    Ssm = cv2.GaussianBlur(S.astype(np.float32), (0, 0), 0.8)
    img[..., :3] = rgb; img[..., 3] = Ssm * 255
    # trims follow the organic edges
    drape(img, K['trim_bottom'], edge_runs(S, top=False), K['anchor_bottom'], seed + 2)
    drape(img, K['trim_top'], edge_runs(S, top=True), K['anchor_top'], seed + 1)
    # platforms
    for yy in range(g.shape[0]):
        xx = 0
        while xx < g.shape[1]:
            if g[yy, xx] == '=':
                x0 = xx
                while xx < g.shape[1] and g[yy, xx] == '=': xx += 1
                wpx = (xx - x0) * T + 16
                if K['plat'] is not None:
                    p = K['plat']; s = wpx / p.shape[1] if p.shape[1] < wpx * 0.6 else 1
                    ph = int(p.shape[0] * min(1, (T * 0.9) / p.shape[0] * 1.6))
                    pi = cv2.resize(p, (max(8, int(p.shape[1] * ph / p.shape[0])), ph), interpolation=cv2.INTER_AREA)
                    sl = three_slice(pi, wpx)
                    over(img, sl, x0 * T - 8, yy * T - int(ph * 0.22))
                else:
                    pl = np.zeros((22, wpx, 4), np.float32); pl[...] = [70, 60, 55, 255]; over(img, pl, x0 * T - 8, yy * T)
            else: xx += 1
    # spikes
    if K['spikes'] is not None:
        sp = K['spikes']; sh = int(T * 1.05); spi = cv2.resize(sp, (max(8, int(sp.shape[1] * sh / sp.shape[0])), sh), interpolation=cv2.INTER_AREA)
        for yy in range(g.shape[0]):
            for xx in range(g.shape[1]):
                if g[yy, xx] == '^':
                    seg = spi[:, (xx * T) % max(1, spi.shape[1] - T):][:, :T]
                    if seg.shape[1] < T: seg = spi[:, :T]
                    over(img, seg, xx * T, yy * T + T - sh + 4)
    # soft contact shadow
    Sf = S.astype(np.float32); sh = np.clip(cv2.GaussianBlur(Sf, (0, 0), 10) * 0.55 + cv2.GaussianBlur(Sf, (0, 0), 42) * 0.4, 0, 0.85)  # rock sits in the scene
    a = img[..., 3:4] / 255.0; shade = sh[..., None] * (1 - a)
    A2 = a + shade
    img[..., :3] = np.where(A2 > 0, img[..., :3] * a / np.maximum(A2, 1e-4) + np.array(K['deep'], np.float32) * shade / np.maximum(A2, 1e-4), 0)
    img[..., 3:4] = np.clip(A2, 0, 1) * 255
    # a faint warm light just above every walkable edge, so floors read at a glance
    tl = (np.clip(gy * 6, 0, 1) * (1 - T2.smoothstep(0, 3, dd)) * (S > 0)).astype(np.float32)
    glow = cv2.GaussianBlur(tl, (0, 0), 9); glow = np.roll(glow, -10, axis=0) * (S == 0) * 0.5
    a = img[..., 3:4] / 255.0; g3 = np.clip(glow[..., None], 0, 0.35); A3 = a + g3 * (1 - a)
    img[..., :3] = np.where(A3 > 0, (img[..., :3] * a + np.array(K['rim'], np.float32) * g3 * (1 - a)) / np.maximum(A3, 1e-4), 0)
    img[..., 3:4] = np.clip(A3, 0, 1) * 255
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    ids = sys.argv[1:] or list(world.R.keys())
    mp = os.path.join(OUT, 'manifest.json'); man = json.load(open(mp)) if os.path.exists(mp) else {}
    for id in ids:
        im = paint(world.R[id]); f = os.path.join(OUT, id + '.webp'); im.save(f, 'WEBP', quality=88, method=5)
        e = man.setdefault(id, {}); e.update({'img': f'assets/rooms/{id}.webp', 'pad': T2.PAD}); e.pop('flames', None); e.pop('lights', None)
        json.dump(man, open(mp, 'w'), indent=1); print('ROOM2D', id, im.size, os.path.getsize(f) // 1024, 'KB', flush=True)
