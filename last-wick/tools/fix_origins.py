import json, glob, os
P = {'wick': (2.88, 1.0, 0), 'e_wickling': (1.6, 0.55, 0), 'e_husk': (2.6, 1.05, 0), 'e_emberfly': (1.6, 0.0, 0), 'e_shardwing': (1.6, 0.0, 0),
     'e_mothling': (2.0, 0.1, 0), 'e_sporecap': (1.9, 0.7, 0), 'e_jelly': (1.9, 0.75, 0), 'e_acolyte': (2.6, 1.05, 0), 'e_sentinel': (2.6, 1.05, 0),
     'e_wraith': (2.6, 1.0, 0), 'b_knight': (6.4, 2.6, 0), 'b_moth': (7.6, 1.6, 0), 'b_angler': (8.0, 2.6, 0.4), 'b_vesper': (4.4, 1.8, 0),
     'b_extinguisher': (11.0, 4.6, 0), 'n_merchant': (3.2, 1.3, 0), 'n_gardener': (3.2, 1.3, 0), 'n_monk': (3.2, 1.3, 0), 'n_glassmaker': (3.2, 1.3, 0)}
for f in glob.glob(os.path.join(os.path.dirname(__file__), '../assets/sprites/*.json')):
    n = os.path.basename(f)[:-5]
    if n not in P: continue
    m = json.load(open(f)); units, cz, cx = P[n]; cell = m['cell'][0] / m.get('scale', 1)
    s = m.get('scale', 1)
    m['origin'] = [round(cell * (0.5 - cx / units) * s, 1), round(cell * (0.5 + cz / units) * s, 1)]
    json.dump(m, open(f, 'w'), separators=(',', ':')); print(n, m['origin'])
