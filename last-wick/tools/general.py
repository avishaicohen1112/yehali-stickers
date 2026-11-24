"""General painted items (ART_BRIEF J01-J06) -> props + HUD/item images.
  J01 save altar  -> prop 'bench' (+ candle flame points)      J02 lore tablet -> prop 'tablet'
  J03 great brazier -> prop 'brazier' (+ 4 bowl flame points)    J06 world portal arch -> prop 'portal'
  J04 items (heart, soul jar, fire orb, wax drop) -> props item_heart, item_vessel, item_spell, item_drop
  J05 UI (soul ring, mask full, mask empty, divider) -> props ui_ring, ui_mask, ui_mask_empty, ui_divider
python3 tools/general.py ; then tools/build_data.py
"""
import os, sys, json, glob
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from ingest import load_rgba, remove_bg, trim, split

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PROPS = os.path.join(ROOT, 'assets/props')


def src(i):
    c = sorted(glob.glob(os.path.join(ROOT, 'art_src', i + '.*'))); return c[0] if c else None


def keyed(p):
    a = load_rgba(p); return remove_bg(a) if a[..., 3].min() > 250 else a


def save(a, name, h_game):
    """store at 2x game resolution; returns manifest entry (w,h in game px, anchor bottom-centre)"""
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    s = h_game * 2 / im.height; im = im.resize((max(1, round(im.width * s)), round(h_game * 2)), Image.LANCZOS)
    im.save(os.path.join(PROPS, name + '.webp'), 'WEBP', quality=90, method=5)
    w, h = im.width / 2, im.height / 2
    return {'img': f'assets/props/{name}.webp', 'w': round(w, 1), 'h': round(h, 1), 'ax': round(w / 2, 1), 'ay': round(h, 1)}, s / 2


def peaks(a, n, band=0.35):
    """x positions (image px) + top y of the n highest separate bumps of the silhouette top (candle wicks, bowls)"""
    al = a[..., 3] > 60; H, W = al.shape
    top = np.where(al.any(0), al.argmax(0), H)
    cand = []; order = np.argsort(top)
    for x in order:
        if top[x] >= H * band + top.min(): break
        if all(abs(x - c[0]) > W * 0.09 for c in cand): cand.append((int(x), int(top[x])))
        if len(cand) == n: break
    return sorted(cand)


def main():
    man = json.load(open(os.path.join(PROPS, 'manifest.json')))
    p = src('J01')
    if p:
        a, _ = trim(keyed(p)); e, k = save(a, 'bench', 165)
        e['flame'] = [[round((x - a.shape[1] / 2) * k), round((y - a.shape[0]) * k) + 4] for x, y in peaks(a, 5)]
        man['bench'] = e; print('bench', e['w'], e['h'], e['flame'])
    p = src('J02')
    if p: a, _ = trim(keyed(p)); man['tablet'] = save(a, 'tablet', 115)[0]; print('tablet')
    p = src('J03')
    if p:
        a, _ = trim(keyed(p)); e, k = save(a, 'brazier', 150)
        # bowls: the 4 widest runs of the silhouette's upper band
        al = a[..., 3] > 60; H, W = al.shape; top = np.where(al.any(0), al.argmax(0), H); band = top < top.min() + H * 0.18
        runs, x = [], 0
        while x < W:
            if band[x]:
                x0 = x
                while x < W and band[x]: x += 1
                runs.append((x - x0, (x0 + x) // 2))
            else: x += 1
        bowls = sorted(c for _, c in sorted(runs, reverse=True)[:4])
        e['bowls'] = [[round((c - W / 2) * k), round((top[c] - H) * k) + 6] for c in bowls]
        man['brazier'] = e; print('brazier', e['w'], e['h'], e['bowls'])
    p = src('J06')
    if p: a, _ = trim(keyed(p)); man['portal'] = save(a, 'portal', 270)[0]; print('portal')
    for sid, names, hgt in (('J04', ['item_heart', 'item_vessel', 'item_spell', 'item_drop'], [40, 46, 40, 26]),
                            ('J05', ['ui_ring', 'ui_mask', 'ui_mask_empty', 'ui_divider'], [100, 44, 44, 24])):
        p = src(sid)
        if not p: continue
        a = keyed(p); boxes = split(a, 16)
        if len(boxes) != len(names): print(f'  ! {sid}: {len(boxes)} pieces, expected {len(names)}')
        for nm, hh, b in zip(names, hgt, boxes):
            pc, _ = trim(a[b[1]:b[1] + b[3], b[0]:b[0] + b[2]].copy()); e, _ = save(pc, nm, hh); e['ay'] = round(e['h'] / 2, 1); man[nm] = e
        print(sid, 'ok')
    json.dump(man, open(os.path.join(PROPS, 'manifest.json'), 'w'), indent=1)


if __name__ == '__main__' and len(sys.argv) == 1:
    main()


def pieces(sid, names, heights, center=True):
    """split a parts sheet in reading order into props (anchored at centre unless center=False)"""
    p = src(sid)
    if not p: return
    man = json.load(open(os.path.join(PROPS, 'manifest.json')))
    a = keyed(p); boxes = split(a, 16)
    if len(boxes) != len(names): print(f'  ! {sid}: {len(boxes)} pieces, expected {len(names)}')
    for nm, hh, b in zip(names, heights, boxes):
        pc, _ = trim(a[b[1]:b[1] + b[3], b[0]:b[0] + b[2]].copy()); e, _ = save(pc, nm, hh)
        if center: e['ay'] = round(e['h'] / 2, 1)
        man[nm] = e
    json.dump(man, open(os.path.join(PROPS, 'manifest.json'), 'w'), indent=1); print(sid, '->', names)


def bosses():
    pieces('D06', ['gb_choir_s0', 'gb_choir_s1', 'gb_choir_s2', 'gb_choir_note'], [130, 105, 85, 34], center=False)
    pieces('D08-parts', ['gb_leviathan_head', 'gb_leviathan_seg0', 'gb_leviathan_seg1', 'gb_leviathan_seg2', 'gb_leviathan_tail'], [150, 120, 100, 80, 110])
    for i, (sid, nm, h) in enumerate((('D13-form1', 'gb_firstflame_wisp', 170), ('D13-form2', 'gb_firstflame_mirror', 130), ('D13-form3', 'gb_firstflame_sun', 480))):
        pieces(sid, [nm], [h])
    pieces('D13-effects', ['gb_firstflame_fireball', 'gb_firstflame_ring', 'gb_firstflame_meteor'], [60, 120, 60])


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'bosses':
    bosses()
