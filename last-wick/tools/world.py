"""World definition for The Last Wick. Rooms are carved from solid rock on a global tile grid.
Tile = 50px. Chars: '#' solid, '.' air, '=' one-way platform, '^' spikes, '~' deadly black water,
'w' shallow water (visual/slow)."""
import json

WORLDS = {
    'lumen': {'name': 'לומנהולד', 'en': 'LUMENHOLD'},
    'sea':   {'name': 'ים הגחלים', 'en': 'THE EMBER SEA'},
    'dream': {'name': 'עולם החלום', 'en': 'THE DREAMING WICK'},
    'stage': {'name': 'תיאטרון הצללים', 'en': 'THE SHADOW THEATRE'},
}
AREAS = {
    'crypts':  {'name': 'מערות השעווה', 'music': 'crypts', 'world': 'lumen'},
    'gardens': {'name': 'גני העש', 'music': 'gardens', 'world': 'lumen'},
    'nave':    {'name': 'הקתדרלה הטבועה', 'music': 'nave', 'world': 'lumen'},
    'spire':   {'name': 'צריח הזכוכית', 'music': 'spire', 'world': 'lumen'},
    'hearth':  {'name': 'האח הכבויה', 'music': 'hearth', 'world': 'lumen'},
    'shore':   {'name': 'חוף האפר', 'music': 'shore', 'world': 'sea'},
    'galleon': {'name': 'הספינה הטבועה', 'music': 'galleon', 'world': 'sea'},
    'lighthouse': {'name': 'המגדלור הבוער', 'music': 'lighthouse', 'world': 'sea'},
    'paper':   {'name': 'יער הנייר', 'music': 'paper', 'world': 'dream'},
    'clock':   {'name': 'קפלת השעונים', 'music': 'clock', 'world': 'dream'},
    'core':    {'name': 'לב הנר', 'music': 'core', 'world': 'dream'},
    'theatre': {'name': 'תיאטרון הצללים', 'music': 'clock', 'world': 'stage'},
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
        if AREAS[r.area]['world'] != AREAS[o.area]['world']: raise Exception('cross-world link')
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
c3.plat(10, 20, 5).plat(16, 17, 5).plat(9, 14, 5).plat(17, 11, 6).plat(24, 8, 5).plat(19, 5, 5).plat(16, 2, 3).plat(23, 16, 4)   # stepping stone up to the brazier ledge
c3.fill(30, 15, 13, 1).fill(36, 13, 7, 2)
c3.ent('bench', 24, 23).ent('npc', 33, 23, id='merchant').ent('brazier', 40, 13)
c3.ent('lore', 11, 23, text='lore_hub')
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
c6.ent('boss', 12, 13, kind='knight').ent('gate', 35, 13, h=4, id='g_knight').ent('gate', 0, 13, h=4, id='g_knight_w')

# ---------------- GARDENS ----------------
g1 = room('g1', 'gardens', 184, 0, 40, 22, 'שער הגנים')
g1.carve(1, 2, 38, 13).fill(1, 2, 4, 3).fill(14, 2, 9, 3).fill(22, 12, 6, 3).fill(28, 10, 12, 5)
g1.fill(8, 13, 4, 2)
g1.ent('enemy', 16, 15, kind='sporecap').ent('enemy', 12, 6, kind='mothling').ent('enemy', 33, 5, kind='mothling')

g2 = room('g2', 'gardens', 224, -6, 52, 26, 'כר אור העש')
g2.carve(1, 1, 50, 23).fill(1, 16, 12, 8).fill(38, 22, 2, 2).fill(40, 20, 11, 4).fill(46, 14, 5, 2)
g2.plat(42, 17, 4).fill(1, 1, 6, 4).fill(20, 1, 14, 3)
g2.plat(22, 13, 6).plat(30, 9, 6).plat(24, 6, 4)
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
n3.carve(1, 2, 38, 10).fill(1, 2, 5, 2).fill(19, 2, 6, 2)
n3.plat(11, 9, 4).plat(15, 6, 3).plat(14, 3, 3)
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
s1.ent('lore', 11, 39, text='lore_shaft').ent('hint', 0, 0, need='wall', text='hint_wall')

s2 = room('s2', 'spire', 112, -60, 48, 22, 'אולמות הבדולח')
s2.carve(1, 1, 46, 19).fill(1, 1, 6, 4).fill(42, 7, 6, 2).fill(1, 20, 47, 2)
s2.plat(18, 17, 5).plat(26, 14, 5).plat(34, 11, 5).fill(10, 14, 4, 6)
s2.ent('enemy', 24, 20, kind='sentinel').ent('enemy', 30, 5, kind='shardwing').ent('enemy', 12, 5, kind='shardwing')

s3 = room('s3', 'spire', 160, -66, 32, 28, 'מקדש הירח')
s3.carve(1, 1, 30, 23).fill(1, 13, 10, 11)
s3.fill(16, 1, 15, 3).fill(14, 8, 2, 12)
s3.plat(20, 20, 5).plat(25, 16, 5).plat(18, 12, 5).plat(2, 9, 3).plat(7, 5, 3)
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
h2.ent('portal', 24, 20, to='e1', tx=8, ty=16, id='p_sea', req='extinguisher').ent('boss', 34, 20, kind='extinguisher').ent('seal', 14, 20, w=4, id='seal_h2', closeOnBoss=1)


# ---------------- EXPANSION ----------------
c7 = room('c7', 'crypts', 0, 26, 36, 18, 'ספריית העצמות')
c7.carve(1, 2, 34, 12).fill(1, 2, 4, 3).fill(14, 2, 8, 2).fill(8, 10, 6, 4).fill(24, 9, 5, 5)
c7.plat(16, 10, 5).plat(10, 6, 4).plat(28, 5, 5)
c7.ent('lore', 20, 14, text='lore_library').ent('enemy', 12, 10, kind='husk').ent('enemy', 30, 14, kind='wickling')
c7.ent('pickup', 30, 5, kind='heart', id='heart_c7')
c8 = room('c8', 'crypts', 0, 44, 36, 20, 'קודש המקהלה')
c8.carve(1, 1, 34, 16)
c8.plat(5, 12, 6).plat(15, 8, 6).plat(25, 14, 4).plat(30, 11, 4).plat(25, 8, 4).plat(29, 5, 3).plat(31, 2, 3)
c8.ent('boss', 15, 17, kind='choir').ent('seal', 30, 0, w=4, id='seal_choir', closeOnBoss=1)

g4 = room('g4', 'gardens', 230, -30, 70, 24, 'כוורת העשים')
g4.carve(1, 1, 68, 20).fill(1, 1, 8, 4).fill(30, 1, 12, 3).fill(56, 1, 13, 5)
g4.fill(12, 14, 8, 7).fill(34, 12, 6, 9).fill(50, 15, 8, 6)
g4.plat(22, 12, 5).plat(42, 9, 5).plat(60, 12, 6).plat(26, 7, 5).plat(27, 18, 4).plat(21, 15, 4).plat(30, 10, 4).plat(60, 8, 9)
g4.ent('enemy', 16, 8, kind='mothling').ent('enemy', 36, 6, kind='mothling').ent('enemy', 54, 8, kind='mothling').ent('enemy', 26, 21, kind='sporecap').ent('enemy', 46, 21, kind='sporecap')
g4.ent('pickup', 28, 7, kind='vessel', id='vessel_g4').ent('lore', 6, 21, text='lore_hive')
g6 = room('g6', 'gardens', 300, -30, 44, 22, 'מאורת ענק הטחב')
g6.carve(1, 1, 42, 17)
g6.plat(6, 12, 6).plat(32, 12, 6)
g6.ent('boss', 28, 18, kind='colossus').ent('gate', 0, 8, h=4, id='g_colossus')

n5 = room('n5', 'nave', 150, 18, 20, 20, 'מגדל הפעמון הטבוע')
n5.carve(3, 1, 14, 18)
n5.fill(3, 5, 3, 1).fill(14, 9, 3, 1).fill(3, 13, 3, 1)
n5.plat(8, 16, 3).plat(12, 13, 3).plat(7, 10, 3).plat(11, 7, 3)
n5.ent('pickup', 10, 4, kind='heart', id='heart_n5').ent('enemy', 10, 10, kind='jelly').ent('lore', 5, 19, text='lore_bell')

s5 = room('s5', 'spire', 120, -86, 70, 20, 'המצפה')
s5.carve(1, 1, 68, 16).fill(1, 1, 10, 4).fill(58, 1, 11, 5)
s5.fill(20, 12, 8, 5).fill(40, 10, 6, 7)
s5.plat(30, 8, 6).plat(48, 6, 5).plat(10, 10, 6).plat(46, 13, 3).plat(50, 10, 4)
s5.ent('enemy', 24, 12, kind='sentinel').ent('enemy', 34, 5, kind='shardwing').ent('enemy', 54, 4, kind='shardwing').ent('enemy', 62, 17, kind='sentinel')
s5.ent('pickup', 50, 6, kind='vessel', id='vessel_s5').ent('lore', 14, 17, text='lore_observatory').ent('npc', 6, 17, id='astronomer')


# =====================================================================
# WORLD 2 — THE EMBER SEA  ('~' here is burning ember-sea)
# =====================================================================
e1 = room('e1', 'shore', 0, 0, 40, 20, 'מזח ההגעה')
e1.carve(1, 2, 38, 14).fill(1, 2, 6, 3).fill(26, 2, 13, 2).fill(30, 11, 9, 5)
e1.plat(18, 12, 5).plat(24, 8, 4)
e1.ent('portal', 5, 16, to='h2', tx=24, ty=20, id='p_sea_back').ent('bench', 12, 16).ent('npc', 21, 16, id='ferryman')
e1.ent('lore', 34, 11, text='lore_dock')
e2 = room('e2', 'shore', 40, 0, 60, 24, 'חוף האפר')
e2.carve(1, 1, 58, 22).fill(1, 1, 8, 3).fill(22, 1, 14, 2)
e2.fill(1, 16, 12, 8).fill(16, 18, 4, 6).fill(24, 17, 4, 7).fill(32, 14, 4, 10).fill(53, 19, 7, 5).fill(42, 8, 18, 4)
e2.water(1, 20, 58, 4)
e2.plat(14, 12, 5).plat(24, 9, 5).plat(34, 6, 6).plat(44, 5, 6).plat(52, 6, 7)
e2.ent('enemy', 26, 17, kind='crab').ent('enemy', 34, 18, kind='crab').ent('enemy', 20, 8, kind='gull').ent('enemy', 46, 3, kind='gull').ent('enemy', 50, 12, kind='cinder')
e2.ent('lore', 6, 16, text='lore_shore')
e3 = room('e3', 'shore', 100, -10, 44, 18, 'מפרץ הלווייתן')
e3.carve(1, 1, 42, 14).carve(13, 15, 18, 3)
e3.water(13, 15, 18, 3)
e3.plat(15, 10, 5).plat(25, 10, 5).plat(19, 6, 6)
e3.ent('boss', 34, 15, kind='leviathan').ent('gate', 0, 15, h=4, id='g_lev')
k1 = room('k1', 'galleon', 100, 8, 48, 20, 'סיפון הספינה')
k1.carve(1, 1, 46, 10).fill(12, 4, 2, 7).fill(30, 3, 2, 8)
k1.plat(8, 4, 4).plat(14, 7, 5).plat(26, 6, 4).plat(32, 3, 5).plat(38, 7, 6)
k1.ent('enemy', 20, 11, kind='ghostsailor').ent('enemy', 40, 11, kind='ghostsailor').ent('enemy', 24, 3, kind='gull')
k2 = room('k2', 'galleon', 120, 28, 40, 20, 'בטן הספינה')
k2.carve(1, 1, 38, 15).fill(4, 12, 5, 4).fill(30, 11, 6, 5)
k2.plat(14, 12, 6).plat(22, 8, 6).plat(17, 6, 3).plat(11, 4, 3)
k2.ent('bench', 20, 16).ent('enemy', 33, 11, kind='ghostsailor').ent('enemy', 8, 6, kind='cinder').ent('lore', 26, 16, text='lore_hold')
k3 = room('k3', 'galleon', 160, 30, 40, 18, 'תא הקברניט')
k3.carve(1, 1, 38, 13)
k3.plat(6, 9, 6).plat(28, 9, 6).plat(17, 5, 6)
k3.ent('boss', 26, 14, kind='captain').ent('gate', 0, 13, h=4, id='g_captain')
l1 = room('l1', 'lighthouse', -40, -6, 40, 26, 'בסיס המגדלור')
l1.carve(1, 1, 38, 21).fill(1, 1, 8, 4).fill(30, 1, 9, 6)
l1.carve(30, 7, 2, 15, 'x')
l1.plat(10, 18, 5).plat(18, 14, 5).plat(10, 10, 5).plat(18, 6, 4).plat(12, 3, 5)
l1.ent('bench', 6, 22).ent('enemy', 20, 22, kind='crab').ent('lore', 24, 22, text='lore_lighthouse')
l2 = room('l2', 'lighthouse', -36, -46, 24, 40, 'גרם המגדלור')
l2.carve(3, 1, 18, 38)
for y, x, w in ((34, 6, 5), (30, 13, 5), (26, 6, 5), (22, 13, 5), (18, 6, 5), (14, 13, 5), (10, 6, 5), (6, 13, 5), (3, 8, 4)):
    l2.plat(x, y, w)
l2.ent('enemy', 10, 20, kind='cinder').ent('enemy', 14, 8, kind='gull')
l3 = room('l3', 'lighthouse', -44, -66, 40, 20, 'עדשת המגדלור')
l3.carve(1, 1, 38, 15)
l3.plat(5, 11, 6).plat(29, 11, 6).plat(15, 7, 10)
l3.ent('boss', 26, 16, kind='keeper').ent('seal', 14, 16, w=4, id='seal_keeper', closeOnBoss=1).ent('portal', 32, 16, to='p1', tx=6, ty=16, id='p_dream', req='keeper')

# =====================================================================
# WORLD 3 — THE DREAMING WICK
# =====================================================================
p1 = room('p1', 'paper', 0, 0, 40, 20, 'שער החלום')
p1.carve(1, 2, 38, 14).fill(1, 2, 5, 3).fill(28, 12, 11, 4)
p1.plat(16, 12, 5).plat(22, 8, 4)
p1.ent('portal', 4, 16, to='l3', tx=32, ty=16, id='p_dream_back').ent('bench', 12, 16).ent('npc', 20, 16, id='dreamer')
p2 = room('p2', 'paper', 40, -10, 50, 30, 'הסבך המקופל')
p2.carve(1, 1, 48, 27).fill(1, 21, 12, 7).fill(20, 23, 8, 5).fill(36, 20, 13, 8)
p2.carve(36, 24, 2, 4, 'x')
for y, x, w in ((18, 14, 5), (15, 21, 5), (12, 13, 5), (9, 22, 6), (6, 31, 6), (10, 38, 5), (14, 43, 5)):
    p2.plat(x, y, w)
p2.ent('gate', 48, 29, h=4, id='g_p2', req='paperking').ent('enemy', 16, 21, kind='papersoldier').ent('enemy', 24, 5, kind='crane').ent('enemy', 40, 8, kind='crane').ent('enemy', 30, 23, kind='papersoldier')
p3 = room('p3', 'paper', 90, -12, 40, 20, 'אולם הכס המקופל')
p3.carve(1, 1, 38, 15)
p3.plat(6, 11, 6).plat(28, 11, 6).plat(16, 7, 8)
p3.ent('boss', 26, 16, kind='paperking').ent('gate', 0, 14, h=4, id='g_paper')
q1 = room('q1', 'clock', 90, 14, 44, 20, 'אולם המטוטלות')
q1.carve(1, 1, 42, 15).fill(10, 12, 6, 4).fill(28, 10, 6, 6)
q1.plat(18, 10, 5).plat(36, 7, 5).plat(6, 9, 4).plat(1, 6, 4)
q1.ent('bench', 22, 16).ent('enemy', 34, 9, kind='gear').ent('enemy', 14, 6, kind='clockwisp')
q2 = room('q2', 'clock', 134, -16, 22, 50, 'מגדל השעון')
q2.carve(3, 1, 16, 47)
for y, x, w in ((43, 5, 5), (39, 12, 5), (35, 5, 5), (31, 12, 5), (27, 5, 5), (23, 12, 5), (19, 5, 5), (15, 12, 5), (11, 5, 5), (11, 15, 4), (7, 12, 5), (4, 6, 4)):
    q2.plat(x, y, w)
q2.ent('enemy', 10, 30, kind='clockwisp').ent('enemy', 10, 14, kind='clockwisp')
q3 = room('q3', 'clock', 156, -20, 40, 20, 'חדר הקפיץ')
q3.carve(1, 1, 38, 15)
q3.plat(6, 11, 6).plat(28, 11, 6).plat(16, 7, 8)
q3.ent('boss', 26, 16, kind='clockmaker').ent('gate', 0, 15, h=4, id='g_clock').ent('gate', 39, 15, h=4, id='g_clock_e', req='clockmaker')
z1 = room('z1', 'core', 196, -20, 30, 20, 'סף הלב')
z1.carve(1, 1, 28, 15)
z1.ent('bench', 8, 16).ent('lore', 20, 16, text='lore_core')
z2 = room('z2', 'core', 226, -28, 50, 28, 'השלהבת הראשונה')
z2.carve(1, 1, 48, 23)
z2.plat(6, 18, 7).plat(37, 18, 7).plat(20, 13, 10).plat(8, 9, 6).plat(36, 9, 6)
z2.ent('boss', 34, 24, kind='firstflame').ent('gate', 0, 23, h=4, id='g_final')

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
link('c6', 'c7', 35, 4)
link('c7', 'c8', 30, 4)
link('g2', 'g4', 250, 4)
link('g4', 'g6', -26, 4)
link('n3', 'n5', 158, 4)
link('s3', 's5', 166, 4)
link('e1', 'e2', 12, 4)
link('e2', 'e3', 1, 4)
link('e2', 'k1', 14, 4)
link('k1', 'k2', 130, 4)
link('k2', 'k3', 39, 4)
link('e1', 'l1', 12, 4)
link('l1', 'l2', -26, 4)
link('l2', 'l3', -30, 4)
link('p1', 'p2', 12, 4)
# ---- bridge of winds: optional gale gauntlet west of the observatory (chest with a wax heart at the far end)
s6 = room('s6', 'spire', 60, -84, 60, 18, 'גשר הרוחות')
s6.carve(1, 1, 58, 14)
for wx in (13, 24, 36, 47): s6.fill(wx, 13, 2, 2)          # low wind-break walls: hide behind them (downwind = east side)
s6.spikes(19, 14, 3).spikes(42, 14, 2)                       # pits you must hop in the calm
s6.fill(1, 1, 58, 2).plat(28, 9, 5).plat(6, 10, 4)
s6.ent('wind', 0, 0, dir=1, v=600, on=3.0, off=1.7, x0=9, x1=52)
s6.ent('lore', 55, 15, text='lore_winds')
s6.ent('enemy', 40, 8, kind='gustwraith').ent('enemy', 18, 7, kind='gustwraith').ent('enemy', 30, 6, kind='windmoth').ent('enemy', 27, 15, kind='anchorgrub')
s6.ent('chest', 4, 15, id='chest_winds', kind='rare', give='heart', tallow=40)
link('s5', 's6', -73, 4)

# =====================================================================
# WORLD 4 — THE SHADOW THEATRE: a lobby with five stage doors; each door is a giant-boss arena (portal-linked)
# =====================================================================
t1 = room('t1', 'theatre', 0, 0, 62, 20, 'הפואייה')
t1.carve(1, 3, 60, 14).plat(10, 12, 5).plat(47, 12, 5)
t1.ent('portal', 3, 17, to='p1', tx=26, ty=16, id='p_theatre_back').ent('bench', 9, 17).ent('npc', 14, 17, id='usher')
for i, (rid, k) in enumerate((('tA', 'waxmother'), ('tB', 'whale'), ('tC', 'lanternqueen'), ('tD', 'puppeteer'))):
    t1.ent('portal', 21 + i * 8, 17, to=rid, tx=6, ty=16, id='p_' + rid)
t1.ent('portal', 56, 17, to='tE', tx=6, ty=16, id='p_tE', req=['waxmother', 'whale', 'lanternqueen', 'puppeteer'])
def arena(rid, gx, gy, w, h, kind, door, extra=None):
    r = room(rid, 'theatre', gx, gy, w, h, {'waxmother': 'במת השעווה', 'whale': 'שמי החלום', 'lanternqueen': 'אולם הפנסים', 'puppeteer': 'במת הבובות', 'director': 'הבמה הראשית'}[kind])
    r.carve(1, 1, w - 2, h - 3)
    r.ent('boss', w // 2, h - 2, kind=kind).ent('portal', 3, h - 2, to='t1', tx=door, ty=17, id='p_back_' + rid, req=kind)
    if extra: extra(r)
    return r
arena('tA', 0, 30, 36, 18, 'waxmother', 21, lambda r: r.plat(4, 12, 6).plat(15, 11, 6).plat(26, 12, 6))
arena('tB', 40, 30, 40, 18, 'whale', 29, lambda r: r.ent('crane', 0, 0))
arena('tC', 0, -30, 36, 22, 'lanternqueen', 37, lambda r: r.plat(5, 15, 5).plat(26, 15, 5).plat(15, 12, 6))
arena('tD', 40, -30, 36, 18, 'puppeteer', 45, lambda r: r.plat(3, 11, 4).plat(29, 11, 4))
arena('tE', 80, 0, 36, 18, 'director', 56, lambda r: r.plat(10, 12, 5).plat(21, 12, 5))
p1.ent('portal', 26, 16, to='t1', tx=6, ty=17, id='p_theatre', req='clockmaker')

link('p2', 'p3', -2, 4)
link('p2', 'q1', 15, 4)
link('q1', 'q2', 18, 4)
link('q2', 'q3', -9, 4)
link('q3', 'z1', -9, 4)
link('z1', 'z2', -9, 4)
# platforms inside link openings (after carving)
# (no ledge inside the c3 shaft: coming up from c5 the hero is launched clear of the hole instead)
c5.plat(16, 1, 3)
n1.plat(15, 1, 3)

def export():
    out = {'tile': 50, 'areas': AREAS, 'worlds': WORLDS, 'rooms': {}}
    for r in R.values():
        out['rooms'][r.id] = {'area': r.area, 'world': AREAS[r.area]['world'], 'name': r.name, 'gx': r.gx, 'gy': r.gy, 'w': r.w, 'h': r.h,
                              'rows': r.rows(), 'ents': r.ents}
    return out

if __name__ == '__main__':
    import sys
    from PIL import Image, ImageDraw
    d = export()
    wsel = sys.argv[2] if len(sys.argv) > 2 else 'lumen'
    d['rooms'] = {k: v for k, v in d['rooms'].items() if v['world'] == wsel}
    xs = [r['gx'] for r in d['rooms'].values()] + [r['gx'] + r['w'] for r in d['rooms'].values()]
    ys = [r['gy'] for r in d['rooms'].values()] + [r['gy'] + r['h'] for r in d['rooms'].values()]
    X0, Y0 = min(xs), min(ys); S = 4
    im = Image.new('RGB', ((max(xs) - X0) * S, (max(ys) - Y0) * S), (20, 20, 30)); dr = ImageDraw.Draw(im)
    col = {'#': (70, 60, 60), '.': (25, 28, 40), '=': (200, 180, 120), '^': (220, 60, 60), '~': (30, 60, 160), 'w': (60, 120, 200), 'x': (150, 60, 200)}
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
