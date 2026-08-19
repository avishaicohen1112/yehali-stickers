/* ============================================================
   utils.js — מתמטיקה, אקראיות והנחות עזר
   ============================================================ */
'use strict';

const U = {

  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },

  lerp(a, b, t) { return a + (b - a) * t; },

  /* השתטחות מסגרת-בלתי-תלויה: מחליק ערך לעבר יעד בקצב יציב
     ללא קשר לקצב הפריימים. rate = כמה מהמרחק נסגר בשנייה. */
  damp(a, b, rate, dt) { return U.lerp(a, b, 1 - Math.pow(1 - rate, dt * 60)); },

  rand(a, b) { return a + Math.random() * (b - a); },

  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },

  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  chance(p) { return Math.random() < p; },

  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },

  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },

  angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },

  /* מנרמל וקטור, מחזיר {x,y,len} */
  norm(x, y) {
    const l = Math.hypot(x, y);
    if (l < 1e-6) return { x: 0, y: 0, len: 0 };
    return { x: x / l, y: y / l, len: l };
  },

  /* --- easing --- */
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInCubic(t) { return t * t * t; },
  easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutElastic(t) {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },

  /* עיגול מלבן עם רדיוס — לשימוש חוזר בציור */
  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  },

  /* עיגול/אליפסה מהירה */
  circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
  },

  /* התנגשות עיגול מול מלבן — מחזיר וקטור דחיפה או null */
  circleVsRect(cx, cy, cr, rx, ry, rw, rh) {
    const nx = U.clamp(cx, rx, rx + rw);
    const ny = U.clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 > cr * cr) return null;

    const d = Math.sqrt(d2);
    if (d > 1e-6) {
      return { x: (dx / d) * (cr - d), y: (dy / d) * (cr - d) };
    }
    /* המרכז בתוך המלבן — נדחוף לצלע הקרובה ביותר */
    const left = cx - rx, right = rx + rw - cx;
    const top = cy - ry, bottom = ry + rh - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left)  return { x: -(left + cr), y: 0 };
    if (m === right) return { x:  (right + cr), y: 0 };
    if (m === top)   return { x: 0, y: -(top + cr) };
    return { x: 0, y: (bottom + cr) };
  },

  /* עיצוב זמן mm:ss */
  timeStr(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  },

  /* מספרים עם פסיקים */
  numStr(n) { return Math.floor(n).toLocaleString('en-US'); },

  /* אחסון מקומי בטוח — לא מפיל את המשחק אם חסום */
  store: {
    get(key, def) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* לא נורא */ }
    }
  }
};
