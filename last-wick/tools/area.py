"""One area's painted art (ART_BRIEF X1..X8) -> scenery layers, animated elements, ground kit, props.

  python3 tools/area.py E            # crypts, reads art_src/E1..E8 (any extension); missing images are skipped
  python3 tools/area.py E --rooms    # also repaint the area's rooms with the new ground kit (terrain2d) + re-place props
  python3 tools/area.py --list

Outputs:
  assets/scn/<area>/{far,sil,mid,front,el_*}.webp  + entry in assets/scenes.json (window.SCENES, used by js/scenery.js)
  assets/art/<area>/{trim_top,trim_bottom,plat,spikes,rock}.png  (kit for tools/terrain2d.py)
  assets/props/<area>_<name>.webp + assets/props/manifest.json + assets/props/sets.json (for tools/place_props.py)
Then run: python3 tools/build_data.py
"""
import sys, os, json, glob, argparse, subprocess
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from ingest import load_rgba, remove_bg, trim, split, make_tileable

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TOOLS = os.path.dirname(os.path.abspath(__file__))
# element kinds: hang = swings from the top (chain-bent), float = bobs in the air (glows), drift = slow drifting mote
AREAS = {
 'E': ('crypts', [('censer', 'hang'), ('chain', 'hang'), ('candles', 'float'), ('drip', 'drip'), ('curtain', 'hang')],
       ['lamp3', 'monk', 'urn', 'skulls', 'lectern', 'tomb']),
 'F': ('gardens', [('vine', 'hang'), ('moss', 'hang'), ('moth', 'drift'), ('flower', 'sway')],
       ['bigshroom', 'lotus', 'ferns', 'mothstatue', 'pot', 'lantern']),
 'G': ('nave', [('chandelier', 'hang'), ('banner', 'hang'), ('weed', 'hang'), ('candle', 'float')],
       ['pillar', 'lamp', 'angel', 'bell', 'pew', 'font']),
 'H': ('spire', [('crystal', 'float'), ('glasslamp', 'hang'), ('shard', 'spin'), ('stars', 'hang')],
       ['crystals', 'nunstatue', 'lens', 'mirror', 'orb', 'shelf']),
 'I': ('hearth', [('cage', 'hang'), ('smoke', 'drift'), ('ember', 'float'), ('flag', 'hang')],
       ['ashstatue', 'brazier', 'column', 'throne', 'bell', 'ashpile']),
 'K': ('shore', [('firewave', 'wave'), ('ropelamp', 'hang'), ('flag', 'hang'), ('spark', 'float')],
       ['anchor', 'barrel', 'pierlamp', 'wreck', 'shells', 'chest']),
 'L': ('galleon', [('lantern', 'hang'), ('rope', 'hang'), ('net', 'hang')],
       ['cannon', 'wheel', 'crates', 'barrels', 'maptable', 'bell']),
 'M': ('lighthouse', [('gear', 'spin'), ('chain', 'hang')],
       ['lens', 'lanterns', 'logbook', 'oilmachine']),
 'N': ('paper', [('crane', 'hang'), ('leaf', 'drift'), ('ribbon', 'hang')],
       ['papertree', 'paperlamp', 'bridge', 'books']),
 'O': ('clock', [('gear', 'spin'), ('pendulum', 'pendulum'), ('hand', 'spin')],
       ['grandclock', 'toolbox', 'bells', 'organ']),
 'P': ('core', [('drop', 'float'), ('sparkle', 'float'), ('flame', 'float')],
       ['plinth', 'altar', 'bigcandle', 'candle1', 'candle2', 'candle3']),
}
PROP_H = 190      # tallest prop on an X8 sheet -> this many game px; the rest keep the sheet's relative scale
TRIM_W = 1400     # ground strips are stored this wide (terrain2d scales by trim_scale)


def src(id_):
    c = sorted(glob.glob(os.path.join(ROOT, 'art_src', id_ + '.*')))
    c = [p for p in c if not p.endswith('.md')]
    return c[0] if c else None


def u8(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def save_webp(a, path, h=None, q=86):
    im = u8(a)
    if h and im.height != h: im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path, 'WEBP', quality=q, method=5); return im.size


def keyed(p):
    """Transparent version of an image (keeps real alpha, keys out green/flat backgrounds)."""
    return remove_bg(load_rgba(p))


def bands(a, n):
    """Split a sheet into n horizontal bands at the n-1 widest empty row gaps."""
    rows = (a[..., 3] > 24).sum(1) > 2
    gaps, y = [], 0
    while y < len(rows):
        if not rows[y]:
            y0 = y
            while y < len(rows) and not rows[y]: y += 1
            if y0 > 0 and y < len(rows): gaps.append((y - y0, y0, y))
        else: y += 1
    cuts = sorted(sorted(gaps, reverse=True)[:n - 1], key=lambda g: g[1])
    edges = [0] + [(g[1] + g[2]) // 2 for g in cuts] + [a.shape[0]]
    return [trim(a[edges[i]:edges[i + 1]], 0)[0] for i in range(len(edges) - 1)]


def sky_from(a):
    h = a.shape[0]; f = lambda y0, y1: '#%02x%02x%02x' % tuple(int(v) for v in a[int(h * y0):int(h * y1), :, :3].reshape(-1, 3).mean(0))
    return [f(0, 0.12), f(0.45, 0.55), f(0.88, 1)]


def tileable2d(a, blend=0.12):
    a = make_tileable(a, blend)
    return make_tileable(a.transpose(1, 0, 2), blend).transpose(1, 0, 2)


def elements(a, names, area, out):
    a = keyed_arr(a); boxes = split(a, 14)
    if len(boxes) != len(names): print(f'  ! elements: found {len(boxes)} pieces, expected {len(names)} - check the sheet')
    res = []
    for i, b in enumerate(boxes):
        x, y, w, h = b[:4]; piece, _ = trim(a[y:y + h, x:x + w].copy())
        nm, kind = names[i] if i < len(names) else (f'piece{i}', 'float')
        sc = min(1.0, 420 / max(piece.shape[:2]))  # elements are drawn in layer space; keep them modest
        sz = save_webp(piece, os.path.join(out, f'el_{nm}.webp'), h=max(8, round(piece.shape[0] * sc)))
        res.append((nm, kind, sz))
    return res


def keyed_arr(a): return remove_bg(a) if a[..., 3].min() > 250 else a


def element_items(els, area, layer_w, layer_h):
    """Spread the elements across the mid layer with an animation per kind."""
    items, rng = [], np.random.default_rng(abs(hash(area)) % 2 ** 31)
    xs = np.linspace(0.08, 0.92, max(1, len(els) * 2))
    k = 0
    for rep in range(2):
        for nm, kind, (w, h) in els:
            x = float(xs[k % len(xs)] * layer_w + rng.uniform(-40, 40)); k += 1
            it = {'img': f'scn_{area}_el_{nm}', 'src': f'assets/scn/{area}/el_{nm}.webp', 'x': round(x), 's': round(float(rng.uniform(0.8, 1.1)), 2)}
            if kind in ('hang', 'pendulum'):
                it.update(y=0, pivot=[0.5, 0], chain={'segs': 8, 'amp': 0.05 if kind == 'hang' else 0.0, 'speed': 0.9})
                if kind == 'pendulum': it.pop('chain'); it['sway'] = [0.35, 1.4]
            elif kind == 'spin': it.update(y=round(float(rng.uniform(0.2, 0.55)) * layer_h), pivot=[0.5, 0.5], spin=round(float(rng.choice([-1, 1]) * rng.uniform(0.15, 0.4)), 2))
            elif kind == 'drift': it.update(y=round(float(rng.uniform(0.2, 0.6)) * layer_h), pivot=[0.5, 0.5], bob=[14, 0.7], sway=[0.08, 0.9])
            elif kind == 'drip': it.update(y=round(float(rng.uniform(0.05, 0.2)) * layer_h), pivot=[0.5, 0], bob=[6, 1.3])
            elif kind == 'sway': it.update(y=round(layer_h * 0.98), pivot=[0.5, 1], sway=[0.05, 0.8])
            elif kind == 'wave': it.update(y=round(layer_h * 0.92), pivot=[0.5, 1], bob=[5, 1.1], flicker=[0.75, 1, 3])
            else: it.update(y=round(float(rng.uniform(0.2, 0.55)) * layer_h), pivot=[0.5, 0.5], bob=[10, 0.8], flicker=[0.8, 1, 2.2])
            items.append(it)
    return items


def build(letter, rooms=False):
    area, el_names, prop_names = AREAS[letter]
    out = os.path.join(ROOT, 'assets/scn', area); kitd = os.path.join(ROOT, 'assets/art', area)
    os.makedirs(out, exist_ok=True); os.makedirs(kitd, exist_ok=True)
    scenes_p = os.path.join(ROOT, 'assets/scenes.json')
    scenes = json.load(open(scenes_p)) if os.path.exists(scenes_p) else {}
    S = scenes.get(area, {'sky': ['#000', '#111', '#000'], 'layers': []})
    L = {l.get('id'): l for l in S['layers'] if l.get('id')}
    fogc = None; done = []
    p = src(letter + '1')
    if p:  # far background: opaque, horizontally tileable
        a = load_rgba(p); a[..., 3] = 255; S['sky'] = sky_from(a); fogc = [int(v) for v in a[int(a.shape[0] * 0.4):int(a.shape[0] * 0.7), :, :3].reshape(-1, 3).mean(0) * 1.6 // 1]
        fogc = [min(255, v) for v in fogc]
        save_webp(make_tileable(a), os.path.join(out, 'far.webp'), h=900, q=84)
        L['far'] = {'id': 'far', 'img': f'scn_{area}_far', 'src': f'assets/scn/{area}/far.webp', 'p': 0.06, 'h': 1.12, 'tile': True}; done.append('far')
    for n, key, par, h, tile in ((2, 'sil', 0.16, 1.05, True), (3, 'mid', 0.32, 1.0, True)):
        p = src(f'{letter}{n}')
        if not p: continue
        a = keyed(p); save_webp(make_tileable(a, 0.08), os.path.join(out, key + '.webp'), h=900)
        L[key] = dict(L.get(key, {}), id=key, img=f'scn_{area}_{key}', src=f'assets/scn/{area}/{key}.webp', p=par, h=h, tile=tile); done.append(key)
    p = src(letter + '4')
    if p:
        a = keyed(p); save_webp(a, os.path.join(out, 'front.webp'), h=900)
        L['front'] = {'id': 'front', 'img': f'scn_{area}_front', 'src': f'assets/scn/{area}/front.webp', 'p': 1.25, 'h': 1.0, 'front': True}; done.append('front')
    p = src(letter + '5')
    if p:
        els = elements(load_rgba(p), el_names, area, out)
        host = L.get('mid') or L.get('sil')
        if host:
            im = Image.open(os.path.join(ROOT, host['src'])); host['items'] = element_items(els, area, im.width, im.height)
        done.append(f'elements({len(els)})')
    p = src(letter + '6')
    if p:  # ground kit: 4 bands top->bottom: floor cap, ceiling hangers, platform, spikes
        b = bands(keyed(p), 4)
        for nm, piece in zip(('trim_top', 'trim_bottom', 'plat', 'spikes'), b):
            im = u8(piece)
            if nm != 'plat': im = im.resize((TRIM_W, max(8, round(im.height * TRIM_W / im.width))), Image.LANCZOS)
            if nm in ('trim_top', 'trim_bottom', 'spikes'): im = u8(make_tileable(np.array(im).astype(np.float32), 0.06))
            im.save(os.path.join(kitd, nm + '.png'))
        if len(b) != 4: print(f'  ! ground kit: found {len(b)} bands, expected 4')
        done.append('kit')
    p = src(letter + '7')
    if p:
        a = load_rgba(p); a[..., 3] = 255; a = tileable2d(a)
        u8(a).resize((512, 512), Image.LANCZOS).save(os.path.join(kitd, 'rock.png')); done.append('rock')
    p = src(letter + '8')
    if p:
        a = keyed(p); boxes = split(a, 16)
        if len(boxes) != len(prop_names): print(f'  ! props: found {len(boxes)} pieces, expected {len(prop_names)}')
        pieces = [trim(a[b[1]:b[1] + b[3], b[0]:b[0] + b[2]].copy())[0] for b in boxes]
        k = PROP_H / max(pc.shape[0] for pc in pieces)
        mp = os.path.join(ROOT, 'assets/props/manifest.json'); man = json.load(open(mp))
        names = []
        for i, pc in enumerate(pieces):
            nm = f'{area}_{prop_names[i] if i < len(prop_names) else "prop%d" % i}'
            w, h = save_webp(pc, os.path.join(ROOT, 'assets/props', nm + '.webp'), h=max(8, round(pc.shape[0] * k * 2)))
            man[nm] = {'img': f'assets/props/{nm}.webp', 'w': round(w / 2, 1), 'h': round(h / 2, 1), 'ax': round(w / 4, 1), 'ay': round(h / 2, 1)}
            names.append(nm)
        json.dump(man, open(mp, 'w'), indent=1)
        sp = os.path.join(ROOT, 'assets/props/sets.json'); sets = json.load(open(sp)) if os.path.exists(sp) else {}
        sets[area] = names; json.dump(sets, open(sp, 'w'), indent=1); done.append(f'props({len(names)})')
    # assemble layer order: far, rays, fog, sil, mid, fog, front
    fc = fogc or (S.get('fog') or [200, 170, 140]); S['fog'] = fc
    order = []
    if 'far' in L: order += [L['far'], {'kind': 'rays', 'color': fc, 'a': 0.05, 'count': 4, 'p': 0.15}, {'kind': 'fog', 'color': fc, 'a': 0.14, 'p': 0.15, 'speed': 9, 'y': 0.45, 'h': 0.6}]
    for k in ('sil', 'mid'):
        if k in L: order.append(L[k])
    order.append({'kind': 'fog', 'color': fc, 'a': 0.1, 'p': 0.5, 'speed': 18, 'y': 0.62, 'h': 0.45, 'seed': 'b'})
    if 'front' in L: order.append(L['front'])
    if any(k in L for k in ('far', 'sil', 'mid', 'front')):
        S['layers'] = order; scenes[area] = S
        json.dump(scenes, open(scenes_p, 'w'), indent=1)
    print(f'[{letter} {area}]', ', '.join(done) or 'no images in art_src')
    if rooms and ('kit' in done or 'rock' in done or any(d.startswith('props') for d in done)):
        import world
        ids = [i for i, r in world.R.items() if r.area == area]
        subprocess.run([sys.executable, 'terrain2d.py', *ids], cwd=TOOLS, check=True)
        subprocess.run([sys.executable, 'place_props.py'], cwd=TOOLS, check=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('letters', nargs='*'); ap.add_argument('--rooms', action='store_true'); ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    if a.list:
        for k, v in AREAS.items(): print(k, v[0], '| elements:', [e[0] for e in v[1]], '| props:', v[2])
        sys.exit()
    for l in a.letters: build(l.upper(), a.rooms)
