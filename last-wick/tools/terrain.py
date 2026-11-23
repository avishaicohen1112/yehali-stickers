"""Paint terrain layers for every room. python3 terrain.py [roomid ...]"""
import sys, os, json, math
import numpy as np, cv2
from PIL import Image
import world

T = 50; PADT = 3; PAD = PADT * T
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'rooms')
os.makedirs(OUT, exist_ok=True)

PAL = {  # base (deep), body, rim highlight, top-cap colour, accent
    'crypts':  dict(deep=(9, 7, 9), body=(58, 44, 40), rim=(232, 190, 140), cap=(226, 205, 170), cap2=(170, 140, 110), accent=(255, 150, 60), ink=(6, 4, 6)),
    'gardens': dict(deep=(5, 9, 9), body=(30, 50, 46), rim=(140, 230, 190), cap=(70, 140, 90), cap2=(40, 90, 60), accent=(150, 255, 210), ink=(3, 6, 6)),
    'nave':    dict(deep=(6, 7, 12), body=(42, 48, 66), rim=(150, 180, 235), cap=(70, 90, 110), cap2=(40, 55, 75), accent=(120, 180, 255), ink=(3, 4, 8)),
    'spire':   dict(deep=(9, 7, 13), body=(52, 40, 70), rim=(225, 195, 255), cap=(190, 160, 240), cap2=(120, 90, 170), accent=(230, 200, 255), ink=(5, 3, 8)),
    'hearth':  dict(deep=(9, 6, 6), body=(50, 38, 34), rim=(255, 140, 70), cap=(90, 80, 76), cap2=(60, 50, 48), accent=(255, 110, 40), ink=(6, 3, 3)),
}

def fbm(h, w, scale, octaves=5, seed=0, aniso=(1, 1)):
    rng = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp = 1; tot = 0
    for o in range(octaves):
        s = scale / (2 ** o)
        gh, gw = max(2, int(h / s * aniso[1]) + 3), max(2, int(w / s * aniso[0]) + 3)
        g = rng.random((gh, gw)).astype(np.float32)
        out += cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC) * amp; tot += amp; amp *= 0.5
    out /= tot; return np.clip((out - 0.5) * 1.6 + 0.5, 0, 1)

def voronoi_edges(h, w, cell, seed):
    rng = np.random.default_rng(seed)
    n = int(h * w / (cell * cell)) + 8
    pts = np.stack([rng.uniform(0, w, n), rng.uniform(0, h, n)], 1).astype(np.float32)
    # rasterize nearest-point distance via subdivision
    sub = cv2.Subdiv2D((-w, -h, 3 * w, 3 * h))
    for p in pts: sub.insert((float(p[0]), float(p[1])))
    img = np.zeros((h, w), np.uint8)
    facets, centers = sub.getVoronoiFacetList([])
    ids = np.zeros((h, w), np.int32)
    for i, f in enumerate(facets):
        cv2.fillPoly(ids, [f.astype(np.int32)], i + 1)
        cv2.polylines(img, [f.astype(np.int32)], True, 255, 2)
    return img.astype(np.float32) / 255.0, ids

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def grid_of(r):
    rows = r.rows(); H, W = r.h + 2 * PADT, r.w + 2 * PADT
    g = np.zeros((H, W), '<U1')
    for y in range(H):
        for x in range(W):
            cx, cy = min(max(x - PADT, 0), r.w - 1), min(max(y - PADT, 0), r.h - 1)
            c = rows[cy][cx]
            if (x - PADT) != cx or (y - PADT) != cy:
                c = '#' if c in '#=^' else c
            g[y, x] = c
    return g

def paint(r):
    P = PAL[r.area]; seed = int(__import__('hashlib').md5(r.id.encode()).hexdigest()[:6], 16)
    g = grid_of(r); H, W = g.shape[0] * T, g.shape[1] * T
    solid = np.kron((g == '#').astype(np.uint8), np.ones((T, T), np.uint8))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # ---- organic SDF
    d_in = cv2.distanceTransform(solid, cv2.DIST_L2, 5)
    d_out = cv2.distanceTransform(1 - solid, cv2.DIST_L2, 5)
    sdf = d_in - d_out
    sdf = cv2.GaussianBlur(sdf, (0, 0), 6)
    n1 = fbm(H, W, 90, 4, seed) - 0.5; n2 = fbm(H, W, 22, 3, seed + 1) - 0.5
    sdf2 = sdf + n1 * 16 + n2 * 6
    S = (sdf2 > 0).astype(np.uint8)
    S = cv2.morphologyEx(S, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    dd = cv2.distanceTransform(S, cv2.DIST_L2, 5)
    # bevel height + normals
    hgt = smoothstep(0, 34, dd) + (fbm(H, W, 30, 4, seed + 2) - 0.5) * 0.25 * smoothstep(0, 20, dd)
    hgt = cv2.GaussianBlur(hgt, (0, 0), 2)
    gy, gx = np.gradient(hgt)
    nz = np.full_like(gx, 0.06); nrm = np.sqrt(gx * gx + gy * gy + nz * nz)
    nx, ny, nzz = -gx / nrm, -gy / nrm, nz / nrm
    L = np.array([-0.45, -0.75, 0.5]); L = L / np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nzz * L[2], 0, 1)
    rimdir = np.clip(-ny, 0, 1)  # up-facing
    band = 1 - smoothstep(0, 46, dd)  # near edge
    deep = smoothstep(30, 150, dd)
    # ---- albedo per area
    tex = fbm(H, W, 40, 5, seed + 3)
    body = np.array(P['body'], np.float32); deepc = np.array(P['deep'], np.float32)
    if r.area == 'crypts':
        strata = fbm(H, W, 120, 4, seed + 4, aniso=(0.15, 1.6))
        tex = tex * 0.5 + strata * 0.5
    elif r.area == 'nave':
        bw, bh = 100, 50
        off = ((yy // bh) % 2) * bw / 2
        mort = np.minimum(np.abs(((xx + off) % bw) - 0), np.abs(((xx + off) % bw) - bw))
        mort = np.minimum(mort, np.minimum(yy % bh, bh - yy % bh))
        brick = smoothstep(1, 4, mort)
        tex = tex * 0.6 + 0.4 * brick; tex *= 0.65 + 0.35 * brick
    elif r.area == 'spire':
        ve, _ = voronoi_edges(H, W, 70, seed)
        ve = cv2.GaussianBlur(ve, (0, 0), 1.2)
        tex = tex * 0.7 + 0.3 * (1 - ve); facet = fbm(H, W, 60, 2, seed + 9)
        tex = tex * (0.75 + 0.5 * facet)
    elif r.area == 'hearth':
        ve, _ = voronoi_edges(H, W, 90, seed)
        cracks = cv2.GaussianBlur(ve, (0, 0), 1.5)
    elif r.area == 'gardens':
        roots = fbm(H, W, 60, 4, seed + 5, aniso=(1.8, 0.3))
        tex = tex * 0.6 + 0.4 * roots
    col = body[None, None, :] * (0.55 + 0.75 * tex[..., None])
    col = col * (0.35 + 0.95 * diff[..., None])
    # deep fade to near black
    col = col * (1 - deep[..., None]) + deepc[None, None, :] * (0.7 + 0.6 * tex[..., None]) * deep[..., None]
    # rim highlight on up/left-facing edge
    edge = 1 - smoothstep(0, 7, dd)
    rim = edge * np.clip(rimdir * 1.0 + np.clip(-nx, 0, 1) * 0.45, 0, 1)
    glowband = (1 - smoothstep(0, 40, dd)) * np.clip(rimdir, 0, 1) * (0.6 + 0.4 * tex)
    col = col + np.array(P['rim'], np.float32) * (rim * 0.9 + glowband * 0.22)[..., None]
    # top caps (wax / moss / snow-like)
    upAir = np.zeros((H, W), np.float32)
    capn = fbm(H, W, 30, 3, seed + 6)
    topband = (1 - smoothstep(0, 26 + capn * 26, dd)) * smoothstep(0.35, 0.8, rimdir)
    if r.area in ('crypts', 'gardens', 'spire'):
        capc = np.array(P['cap'], np.float32); cap2 = np.array(P['cap2'], np.float32)
        k = smoothstep(0.25, 0.6, topband)[..., None]
        cc = cap2 + (capc - cap2) * (0.35 + 0.65 * diff[..., None])
        col = col * (1 - k) + cc * k
    if r.area == 'hearth':
        glow = smoothstep(0.5, 0.95, cracks) * smoothstep(8, 40, dd) * (1 - deep * 0.6)
        col = col * (1 - glow[..., None] * 0.2) + np.array(P['accent'], np.float32) * (glow * (0.5 + 0.8 * fbm(H, W, 80, 2, seed + 7)))[..., None]
    # dark ink outline
    ink = smoothstep(0, 2.5, dd)
    col = col * (0.25 + 0.75 * ink[..., None])
    alpha = S.astype(np.float32)
    # soft contact shadow (outside) on background
    sh = cv2.GaussianBlur(S.astype(np.float32), (0, 0), 16) * (1 - alpha) * 0.75
    rgb = col
    A = np.clip(alpha + sh, 0, 1)
    rgb = np.where(alpha[..., None] > 0, rgb, np.array(P['ink'], np.float32)[None, None, :])
    img = np.dstack([np.clip(rgb, 0, 255), A * 255]).astype(np.uint8)
    im = Image.fromarray(img, 'RGBA')
    from PIL import ImageDraw
    dr = ImageDraw.Draw(im, 'RGBA')
    rng = np.random.default_rng(seed + 11)
    decorate(r, g, S, dd, rimdir, im, dr, rng, P)
    platforms(r, g, im, dr, rng, P)
    spikes(r, g, im, dr, rng, P)
    return im

def edge_points(S, dd, rimdir, want, step, rng):
    """Find edge pixels (dd in 1..3) facing a direction: want='top' (air above) or 'bottom' (air below)."""
    H, W = S.shape; pts = []
    for x in range(0, W, step):
        col = S[:, x]
        trans = np.nonzero(np.diff(col.astype(np.int8)))[0]
        for t in trans:
            if want == 'top' and col[t] == 0 and col[t + 1] == 1: pts.append((x + rng.integers(-step // 3, step // 3 + 1), t + 1))
            if want == 'bottom' and col[t] == 1 and col[t + 1] == 0: pts.append((x + rng.integers(-step // 3, step // 3 + 1), t))
    return pts

def decorate(r, g, S, dd, rimdir, im, dr, rng, P):
    H, W = S.shape
    tops = edge_points(S, dd, rimdir, 'top', 9, rng)
    bots = edge_points(S, dd, rimdir, 'bottom', 23, rng)
    a = r.area
    if a == 'crypts':
        # thick wax drips hanging from ceilings
        for (x, y) in bots:
            if rng.random() < 0.5:
                drip(dr, x, y - 6, rng.uniform(14, 75), rng.uniform(7, 15), rng)
        # wax overflowing from ledge tops down the faces
        for (x, y) in tops:
            if rng.random() < 0.10:
                d = rng.uniform(16, 44)
                drip(dr, x, y + 4, d, rng.uniform(8, 14), rng)
            if rng.random() < 0.045:  # candle stubs
                h = rng.uniform(16, 40); w = rng.uniform(9, 14)
                dr.rounded_rectangle([x - w / 2 - 1, y - h - 1, x + w / 2 + 1, y + 5], radius=4, fill=(30, 20, 18, 255))
                dr.rounded_rectangle([x - w / 2, y - h, x + w / 2, y + 4], radius=3, fill=(232, 214, 180, 255))
                dr.line([x - w / 2 + 2, y - h + 3, x - w / 2 + 2, y], fill=(255, 248, 230, 255), width=2)
                dr.line([x, y - h - 6, x, y - h], fill=(30, 20, 15, 255), width=2)
    elif a == 'gardens':
        for (x, y) in tops:
            for k in range(rng.integers(1, 4)):  # grass blades
                h = rng.uniform(8, 30); lean = rng.uniform(-10, 10); xx = x + rng.uniform(-4, 4)
                c = (int(60 + rng.integers(0, 60)), int(150 + rng.integers(0, 80)), int(100 + rng.integers(0, 50)), 255)
                dr.polygon([(xx - 2.5, y + 3), (xx + lean, y - h), (xx + 2.5, y + 3)], fill=c)
            if rng.random() < 0.03:  # glowing mushrooms
                h = rng.uniform(10, 24); cw = rng.uniform(10, 18)
                dr.rectangle([x - 2, y - h, x + 2, y + 2], fill=(200, 230, 215, 255))
                dr.pieslice([x - cw / 2, y - h - cw / 2, x + cw / 2, y - h + cw / 2], 180, 360, fill=(140, 255, 215, 255))
        for (x, y) in bots:
            if rng.random() < 0.5:  # hanging roots / vines
                L = rng.uniform(20, 110); pts = []; cx = x
                for i in range(8): pts.append((cx + math.sin(i * 0.9 + x) * 4, y - 4 + L * i / 7))
                dr.line(pts, fill=(30, 60, 45, 255), width=int(rng.integers(2, 4)))
                if rng.random() < 0.5: dr.ellipse([pts[-1][0] - 4, pts[-1][1] - 4, pts[-1][0] + 4, pts[-1][1] + 4], fill=(150, 255, 210, 255))
    elif a == 'nave':
        for (x, y) in bots:
            if rng.random() < 0.35:  # dripping water stains / stalactites
                L = rng.uniform(10, 40); w = rng.uniform(5, 12)
                dr.polygon([(x - w / 2, y - 4), (x + w / 2, y - 4), (x, y + L)], fill=(38, 44, 62, 255))
                dr.line([(x - w / 4, y), (x, y + L * 0.8)], fill=(130, 160, 220, 120), width=1)
        for (x, y) in tops:
            if rng.random() < 0.12:
                dr.ellipse([x - 6, y - 3, x + 6, y + 3], fill=(60, 80, 100, 255))
    elif a == 'spire':
        for (x, y) in tops + bots:
            if rng.random() < 0.06:  # crystal clusters
                up = (x, y) in tops; n = rng.integers(2, 5)
                for k in range(n):
                    h = rng.uniform(14, 46) * (1 if up else -0.8); w = rng.uniform(5, 10); ang = rng.uniform(-0.5, 0.5)
                    bx = x + rng.uniform(-10, 10); tx = bx + math.sin(ang) * abs(h)
                    c1 = (int(200 + rng.integers(0, 40)), int(170 + rng.integers(0, 40)), 255, 235)
                    dr.polygon([(bx - w / 2, y + 3 * (1 if up else -1)), (tx, y - h), (bx + w / 2, y + 3 * (1 if up else -1))], fill=c1)
                    dr.line([(bx, y), (tx, y - h)], fill=(255, 250, 255, 200), width=1)
    elif a == 'hearth':
        for (x, y) in bots:
            if rng.random() < 0.3:
                L = rng.uniform(10, 50); w = rng.uniform(4, 9)
                dr.polygon([(x - w / 2, y - 4), (x + w / 2, y - 4), (x, y + L)], fill=(30, 22, 20, 255))
        for (x, y) in tops:
            if rng.random() < 0.06:
                dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 140, 60, 255))

def drip(dr, x, y, L, w, rng):
    c = (int(214 + rng.integers(0, 26)), int(192 + rng.integers(0, 22)), int(150 + rng.integers(0, 22)))
    sh = tuple(int(v * 0.62) for v in c)
    neck = w * rng.uniform(0.35, 0.55); bulb = w * rng.uniform(0.55, 0.8)
    pts = [(x - w / 2, y), (x + w / 2, y), (x + neck / 2 + 1, y + L * 0.6), (x + neck / 2, y + L), (x - neck / 2, y + L), (x - neck / 2 - 1, y + L * 0.6)]
    dr.polygon([(px + 1.5, py + 1.5) for px, py in pts], fill=(20, 14, 12, 255))
    dr.polygon(pts, fill=sh + (255,))
    dr.polygon([(x - w / 2, y), (x + w * 0.15, y), (x + neck * 0.1, y + L), (x - neck / 2, y + L), (x - neck / 2 - 1, y + L * 0.6)], fill=c + (255,))
    dr.ellipse([x - bulb - 1, y + L - bulb * 0.9 - 1, x + bulb + 1, y + L + bulb * 1.1 + 1], fill=(20, 14, 12, 255))
    dr.ellipse([x - bulb, y + L - bulb * 0.9, x + bulb, y + L + bulb * 1.1], fill=sh + (255,))
    dr.ellipse([x - bulb * 0.95, y + L - bulb * 0.9, x + bulb * 0.4, y + L + bulb * 0.8], fill=c + (255,))
    dr.ellipse([x - bulb * 0.55, y + L - bulb * 0.4, x - bulb * 0.15, y + L], fill=(255, 250, 238, 255))
    dr.line([x - w * 0.3, y + 2, x - neck * 0.3, y + L * 0.8], fill=(255, 246, 226, 220), width=2)

def platforms(r, g, im, dr, rng, P):
    H, W = g.shape
    for y in range(H):
        x = 0
        while x < W:
            if g[y, x] == '=':
                x0 = x
                while x < W and g[y, x] == '=': x += 1
                x1 = x; px0, px1, py = x0 * T, x1 * T, y * T
                a = r.area
                if a == 'crypts':   top, bot, c = py, py + 22, (70, 56, 50)
                elif a == 'gardens': top, bot, c = py, py + 20, (52, 44, 34)
                elif a == 'nave':   top, bot, c = py, py + 26, (56, 62, 82)
                elif a == 'spire':  top, bot, c = py, py + 18, (110, 90, 150)
                else:               top, bot, c = py, py + 20, (46, 36, 34)
                dr.rounded_rectangle([px0 + 2, top + 2, px1 - 2, bot + 4], radius=8, fill=(0, 0, 0, 90))
                dr.rounded_rectangle([px0, top, px1, bot], radius=7, fill=c + (255,), outline=P['ink'] + (255,), width=2)
                dr.line([px0 + 6, top + 2, px1 - 6, top + 2], fill=P['rim'] + (200,), width=2)
                for k in range(int((px1 - px0) / 18)):
                    xx = px0 + 9 + k * 18 + rng.uniform(-4, 4)
                    dr.line([xx, top + 6, xx + rng.uniform(-3, 3), bot - 3], fill=tuple(int(v * 0.7) for v in c) + (255,), width=1)
                if a == 'crypts':
                    for k in range(rng.integers(2, 5)):
                        xx = rng.uniform(px0 + 8, px1 - 8); L = rng.uniform(8, 30)
                        dr.rounded_rectangle([xx - 3, bot - 4, xx + 3, bot + L], radius=3, fill=(220, 200, 165, 255))
                if a == 'gardens':
                    for k in range(int((px1 - px0) / 6)):
                        xx = px0 + k * 6 + rng.uniform(0, 4); h = rng.uniform(4, 14)
                        dr.line([xx, top + 2, xx + rng.uniform(-4, 4), top - h], fill=(80, 170, 110, 255), width=2)
                if a == 'spire':
                    dr.rectangle([px0 + 4, top + 5, px1 - 4, top + 8], fill=(240, 220, 255, 120))
            else: x += 1

def spikes(r, g, im, dr, rng, P):
    H, W = g.shape
    glass = r.area == 'spire'
    for y in range(H):
        for x in range(W):
            if g[y, x] != '^': continue
            px, py = x * T, y * T
            dr.rectangle([px, py + T - 8, px + T, py + T + 6], fill=(14, 10, 12, 255))
            for k in range(6):
                bx = px + k * 9 + rng.uniform(-2, 6); h = rng.uniform(30, 52); w = rng.uniform(12, 18); lean = rng.uniform(-9, 9)
                tip = (bx + lean, py + T - h)
                dr.polygon([(bx - w / 2 - 1, py + T + 2), (tip[0], tip[1] - 2), (bx + w / 2 + 1, py + T + 2)], fill=(10, 6, 8, 255))
                dr.polygon([(bx - w / 2, py + T + 2), tip, (bx + w / 2, py + T + 2)], fill=(60, 34, 38, 255) if not glass else (120, 90, 180, 255))
                dr.polygon([(bx - w / 2 + 2, py + T), tip, (bx - 1, py + T)], fill=(196, 160, 140, 255) if not glass else (235, 215, 255, 255))
                dr.line([(bx - w / 4, py + T - 4), tip], fill=(255, 240, 225, 200) if not glass else (255, 255, 255, 230), width=1)

def run(ids):
    man = {}
    mp = os.path.join(OUT, 'manifest.json')
    if os.path.exists(mp): man = json.load(open(mp))
    for id in ids:
        r = world.R[id]
        im = paint(r)
        f = os.path.join(OUT, id + '.webp')
        im.save(f, 'WEBP', quality=88, method=5)
        e = man.get(id, {}); e.update({'img': f'assets/rooms/{id}.webp', 'pad': PAD}); man[id] = e
        print(id, im.size, os.path.getsize(f) // 1024, 'KB', flush=True)
    json.dump(man, open(mp, 'w'), indent=1)

if __name__ == '__main__':
    run(sys.argv[1:] or list(world.R.keys()))
