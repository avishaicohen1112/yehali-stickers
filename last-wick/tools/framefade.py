"""Front frame layers (X4): dissolve every piece toward the middle of the screen.
The painted frame is two side pieces plus overhangs; where a piece simply stops (the top drips, a rock pile) it
reads as "cut off". Fade alpha by horizontal distance from the nearer side edge, so the frame melts into the view.
  python3 tools/framefade.py assets/scn/*/front.webp      (in place; area.py calls fade() on new fronts)
"""
import sys
import numpy as np
from PIL import Image


def fade(a, start=0.075, end=0.14):
    """keep only the outer band of the frame, solid (no see-through), dissolving over a short band toward the centre"""
    a = a.astype(np.float32).copy(); H, W = a.shape[:2]
    a[..., 3] = np.clip((a[..., 3] - 40) * 1.6, 0, 255)
    d = np.minimum(np.arange(W), W - 1 - np.arange(W)) / W          # 0 at the sides, .5 in the middle
    k = np.clip((d - start) / (end - start), 0, 1); k = k * k * (3 - 2 * k)
    a[..., 3] *= (1 - k)[None, :]
    return a


if __name__ == '__main__':
    for p in sys.argv[1:]:
        a = fade(np.array(Image.open(p).convert('RGBA')))
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(p, 'WEBP', quality=90, method=5); print(p)
