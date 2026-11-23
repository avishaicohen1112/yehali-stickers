import os, json, sys
import numpy as np, cv2
from PIL import Image
import bpy, bl
ROOT = os.path.join(os.path.dirname(__file__), '..')
BGDIR = os.path.join(ROOT, 'assets', 'bg'); os.makedirs(BGDIR, exist_ok=True)

def setup(res=(2640, 1100), samples=64, transparent=False):
    sc = bl.reset(samples=samples, res=res, transparent=transparent)
    sc.cycles.volume_bounces = 1; sc.cycles.max_bounces = 6; sc.cycles.volume_step_rate = 4.0
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Punchy'
    except Exception: pass
    return sc

def finish(area, layer, parallax, tmp, paint=True, cover=1.12, anchor=0.5, quality=86, grade=None):
    im = np.array(Image.open(tmp).convert('RGBA')).astype(np.float32)
    rgb = im[..., :3]; a = im[..., 3:]
    if paint:
        u8 = np.clip(rgb, 0, 255).astype(np.uint8)
        p = cv2.edgePreservingFilter(u8, flags=cv2.RECURS_FILTER, sigma_s=12, sigma_r=0.18)
        rgb = rgb * 0.45 + p.astype(np.float32) * 0.55
        # subtle brush texture
        h, w = rgb.shape[:2]; rng = np.random.default_rng(1)
        n = cv2.resize(rng.random((h // 6, w // 6)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
        n = cv2.GaussianBlur(n, (0, 0), 1.2)
        rgb = rgb * (0.94 + 0.12 * n[..., None])
    # bloom
    lum = rgb.max(axis=2)
    br = np.clip((lum - 170) / 85, 0, 1)[..., None] * rgb
    b1 = cv2.GaussianBlur(br, (0, 0), 8); b2 = cv2.GaussianBlur(br, (0, 0), 30); b3 = cv2.GaussianBlur(br, (0, 0), 80)
    rgb = rgb + b1 * 0.5 + b2 * 0.45 + b3 * 0.35
    if grade: rgb = grade(rgb)
    out = np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)
    f = os.path.join(BGDIR, f'{area}_{layer}.webp')
    mode = 'RGBA' if layer != 'far' else 'RGB'
    Image.fromarray(out if mode == 'RGBA' else out[..., :3], mode).save(f, 'WEBP', quality=quality, method=5)
    mp = os.path.join(BGDIR, 'manifest.json')
    man = json.load(open(mp)) if os.path.exists(mp) else {}
    e = man.setdefault(area, {'layers': []})
    e['layers'] = [L for L in e['layers'] if L['id'] != layer]
    e['layers'].append({'id': layer, 'img': f'assets/bg/{area}_{layer}.webp', 'p': parallax, 'cover': cover, 'anchor': anchor})
    e['layers'].sort(key=lambda L: L['p'])
    json.dump(man, open(mp, 'w'), indent=1)
    os.remove(tmp)
    print('BG', f, os.path.getsize(f) // 1024, 'KB', flush=True)
