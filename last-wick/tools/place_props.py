"""Auto-place decorative props into ROOMART manifest."""
import json, os, random
import world
ROOT = os.path.join(os.path.dirname(__file__), '..')
SETS = {
    'crypts': ['candelabra', 'statue', 'urn', 'candelabra'],
    'gardens': ['bigshroom', 'flower', 'flower', 'bigshroom'],
    'nave': ['pillar', 'lantern', 'pillar'],
    'spire': ['crystals', 'gstatue', 'crystals'],
    'hearth': ['astatue', 'candelabra', 'astatue'],
}
HANG = {'crypts': 'chains', 'hearth': 'chains'}
# painted props from tools/area.py override the old sets; areas with a painted front layer drop the old fg silhouettes
# Only painted props (assets/props/sets.json, written by tools/area.py) are placed now; the old 3D-rendered
# props were retired, so areas without painted props are left untouched.
_sp = os.path.join(ROOT, 'assets/props/sets.json')
SETS = json.load(open(_sp)) if os.path.exists(_sp) else {}
HANG = {}
_sc = os.path.join(ROOT, 'assets/scenes.json')
PAINTED_FRONT = {a_ for a_, S in (json.load(open(_sc)).items() if os.path.exists(_sc) else []) if any(l.get('front') for l in S['layers'])}
PROPS = json.load(open(os.path.join(ROOT, 'assets/props/manifest.json')))
T = 50
mp = os.path.join(ROOT, 'assets/rooms/manifest.json'); man = json.load(open(mp))
for id, r in world.R.items():
    if r.area not in SETS: continue
    rng = random.Random(id); rows = r.rows(); props = []
    def tile(x, y): return rows[y][x] if 0 <= x < r.w and 0 <= y < r.h else '#'
    busy = [e['x'] for e in r.ents if e['t'] in ('bench', 'npc', 'lore', 'brazier', 'boss', 'pickup', 'gate')]
    floors = []
    for y in range(2, r.h):
        for x in range(2, r.w - 2):
            if tile(x, y) == '#' and all(tile(x + dx, y) == '#' for dx in (-1, 1)) and all(tile(x + dx, y - k) == '.' for dx in (-1, 0, 1) for k in range(1, 5)):
                floors.append((x, y))
    rng.shuffle(floors); used = []
    for (x, y) in floors:
        if any(abs(x - u) < 7 for u in used) or any(abs(x - b) < 4 for b in busy): continue
        if len(used) >= max(2, r.w // 9): break
        if not SETS.get(r.area): break
        p = rng.choice(SETS[r.area]); used.append(x)
        far = rng.random() < 0.35
        props.append({'p': p, 'x': x * T + 25, 'y': y * T + 6, 'l': 'back', 's': 0.8 if far else 1.0, 'd': 0.92 if far else 1.0, 'f': rng.random() < 0.5})
    if r.area in HANG:
        for x in range(3, r.w - 3, 9):
            for y in range(0, r.h - 6):
                if tile(x, y) == '#' and all(tile(x, y + k) == '.' for k in range(1, 7)):
                    if rng.random() < 0.6: props.append({'p': HANG[r.area], 'x': x * T + 25, 'y': (y + 1) * T - 6, 'l': 'back', 's': 0.9, 'd': 1.0})
                    break
    # foreground silhouettes along the bottom
    for x in (range(rng.randint(0, 10), r.w, rng.randint(22, 30)) if False else []):
        props.append({'p': 'fg_' + r.area, 'x': x * T, 'y': r.h * T + 120, 'l': 'front', 's': rng.uniform(1.0, 1.4), 'd': 1.25, 'f': rng.random() < 0.5})
    e = man.setdefault(id, {}); e['props'] = props
json.dump(man, open(mp, 'w'), indent=1)
print('placed painted props in areas:', sorted(SETS))
