"""World definition for The Last Wick. Rooms are carved from solid rock on a global tile grid.
Tile = 50px. Chars: '#' solid, '.' air, '=' one-way platform, '^' spikes, '~' deadly black water,
'w' shallow water (visual/slow)."""
import json

AREAS = {
    'crypts':  {'name': 'מערות השעווה', 'music': 'crypts'},
    'gardens': {'name': 'גני העש', 'music': 'gardens'},
    'nave':    {'name': 'הקתדרלה הטבועה', 'music': 'nave'},
    'spire':   {'name': 'צריח הזכוכית', 'music': 'spire'},
    'hearth':  {'name': 'האח הכבויה', 'music': 'hearth'},
}

class Room:
    def __init__(s, id, area, gx, gy, w, h, name=''):
        s.id, s.area, s.gx, s.gy, s.w, s.h, s.name = id, area, gx, gy, w, h, name
        s.g = [['#'] * w for _ in range(h)]
        s.ents = []
    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def get(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h: return s.g[y][x]
        return '#'
    def carve(s, x, y, w, h, c='.'):
        for j in range(y, y + h):
            for i in range(x, x + w): s.set(i, j, c)
        return s
    def fill(s, x, y, w, h): return s.carve(x, y, w, h, '#')
    def plat(s, x, y, w): return s.carve(x, y, w, 1, '=')
    def spikes(s, x, y, w): return s.carve(x, y, w, 1, '^')
    def water(s, x, y, w, h, c='~'):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if s.get(i, j) == '.': s.set(i, j, c)
        return s
    def ent(s, t, x, y, **kw):
        d = {'t': t, 'x': x, 'y': y}; d.update(kw); s.ents.append(d); return s
    def rows(s): return [''.join(r) for r in s.g]

R = {}
def room(*a, **k):
    r = Room(*a, **k); R[r.id] = r; return r

def link(a, b, start, length):
    """Carve matching openings on the shared edge of rooms a and b. start/length are global tiles along the edge."""
    A, B = R[a], R[b]
    for r, o in ((A, B), (B, A)):
        if r.gx + r.w == o.gx:   side = 'E'
        elif o.gx + o.w == r.gx: side = 'W'
        elif r.gy + r.h == o.gy: side = 'S'
        elif o.gy + o.h == r.gy: side = 'N'
        else: raise Exception(f'rooms {a},{b} do not share an edge')
        for k in range(start, start + length):
            if side in 'EW':
                y = k - r.gy; xs = range(r.w - 1, -1, -1) if side == 'E' else range(r.w)
                for x in xs:
                    if r.get(x, y) not in '#': break
                    r.set(x, y, '.')
            else:
                x = k - r.gx; ys = range(r.h - 1, -1, -1) if side == 'S' else range(r.h)
                for y in ys:
                    if r.get(x, y) not in '#': break
                    r.set(x, y, '.')

# ---------------- CRYPTS ----------------
c1 = room('c1', 'crypts', 0, 0, 36, 18, 'מקדש היקיצה')
c1.carve(2, 2, 32, 13).fill(18, 2, 6, 2).fill(2, 2, 3, 3).fill(12, 13, 4, 2).fill(24, 12, 10, 3).fill(26, 2, 8, 3)
c1.carve(30, 9, 6, 3)
c1.ent('spawn', 6, 15).ent('bench', 6, 15, kind='altar')
c1.ent('lore', 14, 13, text='lore_c1')

c2 = room('c2', 'crypts', 36, 0, 48, 18, 'מסדרון הפתילים')
c2.carve(1, 3, 46, 12).fill(5, 3, 4, 2).fill(30, 3, 8, 2).fill(1, 3, 2, 6)
c2.carve(14, 15, 3, 1).spikes(14, 15, 3)
c2.fill(26, 10, 4, 5).plat(21, 12, 3).carve(34, 15, 3, 1).spikes(34, 15, 3)
c2.fill(40, 12, 7, 3)
c2.ent('enemy', 10, 15, kind='wickling').ent('enemy', 32, 15, kind='wickling').ent('enemy', 41, 7, kind='emberfly')
c2.ent('lore', 22, 15, text='lore_c2')

c3 = room('c3', 'crypts', 84, -8, 44, 26, 'אולם הפתילים')
c3.carve(1, 1, 42, 22)
c3.fill(1, 1, 8, 3).fill(36, 1, 7, 4).fill(1, 19, 2, 4)
c3.plat(10, 20, 5).plat(16, 17, 5).plat(9, 14, 5).plat(17, 11, 6).plat(24, 8, 5).plat(19, 5, 5).plat(16, 2, 3)
c3.fill(30, 15, 13, 1).fill(36, 13, 7, 2)
c3.ent('bench', 24, 23).ent('npc', 33, 23, id='merchant').ent('brazier', 40, 13)
c3.ent('lore', 6, 23, text='lore_hub')
c3.ent('enemy', 36, 9, kind='emberfly')

c4 = room('c4', 'crypts', 128, 4, 56, 18, 'הגלריה המטפטפת')
c4.carve(1, 2, 54, 9).fill(1, 2, 5, 3).fill(18, 2, 10, 2).fill(46, 2, 9, 3)
c4.fill(14, 9, 5, 2).plat(12, 6, 5).plat(25, 6, 6).fill(32, 8, 4, 3)
c4.carve(40, 11, 7, 2).spikes(40, 12, 7)
c4.ent('enemy', 8, 11, kind='wickling').ent('enemy', 24, 11, kind='husk').ent('enemy', 30, 4, kind='emberfly')
c4.ent('enemy', 50, 11, kind='wickling')
c4.ent('lore', 37, 11, text='lore_gap')

c5 = room('c5', 'crypts', 72, 18, 28, 24, 'מורד הגלוסקמאות')
c5.carve(3, 1, 23, 20).fill(3, 1, 6, 5).fill(23, 1, 3, 2)
c5.plat(17, 18, 4).plat(12, 15, 4).plat(17, 12, 4).plat(12, 9, 4).plat(17, 6, 4).plat(12, 4, 4)
c5.ent('enemy', 8, 21, kind='husk').ent('enemy', 18, 21, kind='wickling')

c6 = room('c6', 'crypts', 36, 26, 36, 18, 'זירת אביר החלב')
c6.carve(1, 1, 34, 12)
c6.ent('boss', 12, 13, kind='knight').ent('gate', 35, 13, h=4, id='g_knight')

# ---------------- GARDENS ----------------
g1 = room('g1', 'gardens', 184, 0, 40, 22, 'שער הגנים')
g1.carve(1, 2, 38, 13).fill(1, 2, 4, 3).fill(14, 2, 9, 3).fill(22, 12, 6, 3).fill(28, 10, 12, 5)
g1.fill(8, 13, 4, 2)
g1.ent('enemy', 16, 15, kind='sporecap').ent('enemy', 12, 6, kind='mothling').ent('enemy', 33, 5, kind='mothling')

g2 = room('g2', 'gardens', 224, -6, 52, 26, 'כר אור העש')
g2.carve(1, 1, 50, 23).fill(1, 16, 12, 8).fill(38, 22, 2, 2).fill(40, 20, 11, 4).fill(46, 14, 5, 2)
g2.plat(42, 17, 4).fill(1, 1, 6, 4).fill(20, 1, 14, 3)
g2.plat(22, 13, 6).plat(30, 9, 6)
g2.carve(30, 24, 5, 2)  # well down to the nave
g2.ent('bench', 9, 16).ent('pickup', 45, 20, kind='spell').ent('npc', 25, 24, id='gardener')
g2.ent('enemy', 19, 24, kind='sporecap').ent('enemy', 14, 8, kind='mothling').ent('enemy', 38, 6, kind='mothling')
g2.ent('pickup', 33, 9, kind='heart', id='heart_g2')

g3 = room('g3', 'gardens', 276, -6, 36, 28, 'מדרון הנבגים')
g3.carve(1, 1, 34, 24).fill(1, 14, 8, 11).fill(26, 1, 9, 6)
g3.plat(12, 18, 6).plat(20, 14, 6).plat(12, 10, 5).plat(3, 6, 5).fill(1, 1, 2, 4)
g3.ent('enemy', 14, 25, kind='sporecap').ent('enemy', 24, 25, kind='sporecap').ent('enemy', 18, 6, kind='mothling')
g3.ent('pickup', 5, 6, kind='vessel', id='vessel_g3')

g5 = room('g5', 'gardens', 312, 4, 40, 22, 'קן אם העש')
g5.carve(1, 1, 38, 14).fill(1, 1, 3, 3).fill(36, 1, 3, 3)
g5.ent('boss', 26, 15, kind='moth').ent('gate', 0, 15, h=4, id='g_moth')

# ---------------- NAVE ----------------
n1 = room('n1', 'nave', 240, 20, 24, 32, 'הבאר')
n1.carve(3, 1, 18, 29)
for y, x, w in ((4, 14, 4), (6, 8, 5), (9, 14, 5), (12, 8, 5), (15, 14, 5), (18, 8, 5), (21, 14, 5), (24, 8, 5), (27, 14, 5)):
    n1.plat(x, y, w)
n1.ent('enemy', 12, 12, kind='jelly')

n2 = room('n2', 'nave', 184, 38, 56, 20, 'המעבר המוצף')
n2.carve(1, 2, 54, 18).fill(48, 11, 8, 9).fill(42, 6, 4, 14).fill(35, 10, 4, 10).fill(27, 9, 5, 11)
n2.fill(18, 10, 5, 10).fill(10, 11, 4, 9).fill(0, 12, 7, 8).fill(1, 2, 4, 4).fill(30, 2, 10, 2)
n2.water(1, 15, 54, 5)
n2.ent('enemy', 33, 6, kind='jelly').ent('enemy', 24, 5, kind='jelly').ent('enemy', 15, 6, kind='jelly')
n2.ent('lore', 52, 11, text='lore_wall')

n3 = room('n3', 'nave', 144, 38, 40, 20, 'קפלת הטובעים')
n3.carve(1, 2, 38, 10).fill(1, 2, 5, 2).fill(16, 2, 8, 2)
n3.ent('bench', 20, 12).ent('npc', 28, 12, id='monk').ent('enemy', 9, 12, kind='acolyte')

n4 = room('n4', 'nave', 100, 36, 44, 24, 'מעמקי הדייג')
n4.carve(1, 1, 42, 17).fill(36, 14, 8, 4)
n4.carve(1, 16, 35, 2, 'w')
n4.plat(7, 12, 6).plat(26, 12, 6).plat(15, 8, 8)
n4.ent('boss', 18, 18, kind='angler').ent('gate', 43, 14, h=4, id='g_angler')

# ---------------- SPIRE ----------------
s1 = room('s1', 'spire', 96, -48, 16, 40, 'פיר הזכוכית')
s1.carve(4, 1, 8, 38).carve(12, 4, 4, 4).fill(10, 8, 6, 1)
s1.fill(4, 30, 2, 1).fill(10, 22, 2, 1).fill(4, 14, 2, 1)
s1.ent('lore', 8, 40, text='lore_shaft')

s2 = room('s2', 'spire', 112, -60, 48, 22, 'אולמות הבדולח')
s2.carve(1, 1, 46, 19).fill(1, 1, 6, 4).fill(42, 7, 6, 2).fill(1, 20, 47, 2)
s2.plat(18, 17, 5).plat(26, 14, 5).plat(34, 11, 5).fill(10, 14, 4, 6)
s2.ent('enemy', 24, 20, kind='sentinel').ent('enemy', 30, 5, kind='shardwing').ent('enemy', 12, 5, kind='shardwing')

s3 = room('s3', 'spire', 160, -66, 32, 28, 'מקדש הירח')
s3.carve(1, 1, 30, 23).fill(1, 13, 10, 11)
s3.fill(16, 1, 15, 3).fill(14, 8, 2, 12)
s3.plat(20, 20, 5).plat(25, 16, 5).plat(18, 12, 5)
s3.ent('bench', 5, 13).ent('npc', 8, 13, id='glassmaker').ent('enemy', 24, 24, kind='sentinel')
s3.ent('pickup', 27, 8, kind='heart', id='heart_s3')

s4 = room('s4', 'spire', 192, -56, 40, 18, 'אולם המראות')
s4.carve(1, 1, 38, 13)
s4.plat(28, 10, 4).plat(31, 6, 4).plat(27, 2, 4)
s4.ent('boss', 20, 14, kind='vesper').ent('gate', 0, 14, h=4, id='g_vesper').ent('seal', 28, 0, w=4, id='seal_s4')

# ---------------- HEARTH ----------------
h1 = room('h1', 'hearth', 200, -90, 28, 34, 'מדרגות האפר')
h1.carve(2, 1, 24, 31).fill(2, 20, 9, 2)
for y, x in ((29, 13), (26, 6), (23, 14), (17, 14), (14, 20), (11, 12), (8, 5), (5, 12), (2, 4)):
    h1.plat(x, y, 5)
h1.ent('bench', 6, 20).ent('enemy', 18, 12, kind='wraith')

h2 = room('h2', 'hearth', 190, -114, 48, 24, 'האח הכבויה')
h2.carve(1, 1, 46, 19)
h2.plat(6, 15, 6).plat(36, 15, 6).plat(20, 11, 8)
h2.ent('boss', 34, 20, kind='extinguisher').ent('seal', 14, 20, w=4, id='seal_h2', closeOnBoss=1)

# ---------------- LINKS ----------------
link('c1', 'c2', 9, 3)
link('c2', 'c3', 11, 4)
link('c3', 'c4', 11, 4)
link('c3', 's1', 100, 6)
link('c3', 'c5', 88, 5)
link('c5', 'c6', 35, 4)
link('c4', 'g1', 11, 4)
link('g1', 'g2', 6, 4)
link('g2', 'g3', 4, 4)
link('g3', 'g5', 15, 4)
link('g2', 'n1', 254, 5)
link('n1', 'n2', 45, 4)
link('n2', 'n3', 46, 4)
link('n3', 'n4', 46, 4)
link('s1', 's2', -44, 4)
link('s2', 's3', -57, 4)
link('s3', 's4', -46, 4)
link('s4', 'h1', 220, 4)
link('h1', 'h2', 204, 4)
# platforms inside link openings (after carving)
c3.plat(4, 24, 3)
c5.plat(16, 1, 3)
n1.plat(15, 1, 3)

def export():
    out = {'tile': 50, 'areas': AREAS, 'rooms': {}}
    for r in R.values():
        out['rooms'][r.id] = {'area': r.area, 'name': r.name, 'gx': r.gx, 'gy': r.gy, 'w': r.w, 'h': r.h,
                              'rows': r.rows(), 'ents': r.ents}
    return out

if __name__ == '__main__':
    import sys
    from PIL import Image, ImageDraw
    d = export()
    xs = [r['gx'] for r in d['rooms'].values()] + [r['gx'] + r['w'] for r in d['rooms'].values()]
    ys = [r['gy'] for r in d['rooms'].values()] + [r['gy'] + r['h'] for r in d['rooms'].values()]
    X0, Y0 = min(xs), min(ys); S = 4
    im = Image.new('RGB', ((max(xs) - X0) * S, (max(ys) - Y0) * S), (20, 20, 30)); dr = ImageDraw.Draw(im)
    col = {'#': (70, 60, 60), '.': (25, 28, 40), '=': (200, 180, 120), '^': (220, 60, 60), '~': (30, 60, 160), 'w': (60, 120, 200)}
    for id, r in d['rooms'].items():
        for y, row in enumerate(r['rows']):
            for x, c in enumerate(row):
                px, py = (r['gx'] + x - X0) * S, (r['gy'] + y - Y0) * S
                dr.rectangle([px, py, px + S - 1, py + S - 1], fill=col[c])
        dr.rectangle([(r['gx'] - X0) * S, (r['gy'] - Y0) * S, (r['gx'] + r['w'] - X0) * S - 1, (r['gy'] + r['h'] - Y0) * S - 1], outline=(90, 90, 140))
        for e in r['ents']:
            px, py = (r['gx'] + e['x'] - X0) * S, (r['gy'] + e['y'] - Y0) * S
            c = {'enemy': (255, 120, 0), 'boss': (255, 0, 255), 'bench': (0, 255, 120), 'pickup': (255, 255, 0)}.get(e['t'], (0, 200, 255))
            dr.ellipse([px - 3, py - 6, px + 3, py], fill=c)
        dr.text(((r['gx'] - X0) * S + 3, (r['gy'] - Y0) * S + 2), id, fill=(255, 255, 255))
    im.save(sys.argv[1] if len(sys.argv) > 1 else 'map.png')
    print(im.size)
