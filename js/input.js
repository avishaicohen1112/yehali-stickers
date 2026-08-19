/* ============================================================
   input.js — מקלדת, ג'ויסטיק מגע, כפתור דאש
   ============================================================ */
'use strict';

const Input = {

  keys: Object.create(null),
  pressed: Object.create(null),   // נלחץ בפריים הזה
  axis: { x: 0, y: 0 },           // כיוון מנורמל מהג'ויסטיק
  dashQueued: false,
  isTouch: false,

  _stickActive: false,
  _stickId: null,
  _stickOrigin: { x: 0, y: 0 },

  init() {
    /* --- מקלדת --- */
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'spacebar'].includes(k)) {
        e.preventDefault();
      }
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;

      if (k === ' ' || k === 'spacebar') this.dashQueued = true;
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = Object.create(null);
      this.axis.x = this.axis.y = 0;
      this._stickActive = false;
    });

    /* --- זיהוי מגע --- */
    const markTouch = () => {
      if (this.isTouch) return;
      this.isTouch = true;
      document.getElementById('touch').classList.add('on');
    };
    window.addEventListener('touchstart', markTouch, { once: true, passive: true });

    this._initStick();
    this._initDashBtn();
  },

  _initStick() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const RADIUS = 48;

    const setKnob = (dx, dy) => {
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      this._stickId = t.identifier != null ? t.identifier : 'mouse';
      const r = stick.getBoundingClientRect();
      this._stickOrigin.x = r.left + r.width / 2;
      this._stickOrigin.y = r.top + r.height / 2;
      this._stickActive = true;
      move(e);
    };

    const move = (e) => {
      if (!this._stickActive) return;
      let t = e;
      if (e.changedTouches) {
        t = null;
        for (const c of e.changedTouches) {
          if (c.identifier === this._stickId) { t = c; break; }
        }
        if (!t) return;
      }
      e.preventDefault();

      let dx = t.clientX - this._stickOrigin.x;
      let dy = t.clientY - this._stickOrigin.y;
      const len = Math.hypot(dx, dy);

      if (len > RADIUS) { dx = dx / len * RADIUS; dy = dy / len * RADIUS; }
      setKnob(dx, dy);

      /* אזור מת קטן כדי שלא ירעד */
      const n = U.norm(dx, dy);
      const mag = U.clamp((n.len - 5) / (RADIUS - 5), 0, 1);
      this.axis.x = n.x * mag;
      this.axis.y = n.y * mag;
    };

    const end = (e) => {
      if (e.changedTouches) {
        let found = false;
        for (const c of e.changedTouches) if (c.identifier === this._stickId) found = true;
        if (!found) return;
      }
      this._stickActive = false;
      this.axis.x = this.axis.y = 0;
      setKnob(0, 0);
    };

    stick.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });

    stick.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  },

  _initDashBtn() {
    const btn = document.getElementById('dashBtn');
    const fire = (e) => { e.preventDefault(); this.dashQueued = true; };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  },

  /* וקטור התנועה הרצוי (מנורמל, אורך <= 1) */
  moveVector() {
    let x = 0, y = 0;

    if (this.keys['arrowleft'] || this.keys['a']) x -= 1;
    if (this.keys['arrowright'] || this.keys['d']) x += 1;
    if (this.keys['arrowup'] || this.keys['w']) y -= 1;
    if (this.keys['arrowdown'] || this.keys['s']) y += 1;

    if (x || y) {
      const n = U.norm(x, y);
      return { x: n.x, y: n.y };
    }

    /* ג'ויסטיק */
    const len = Math.hypot(this.axis.x, this.axis.y);
    if (len > 0.02) {
      const m = Math.min(1, len);
      return { x: this.axis.x / len * m, y: this.axis.y / len * m };
    }
    return { x: 0, y: 0 };
  },

  /* נצרך פעם אחת */
  consumeDash() {
    if (!this.dashQueued) return false;
    this.dashQueued = false;
    return true;
  },

  wasPressed(k) { return !!this.pressed[k]; },

  /* נקרא בסוף כל פריים */
  endFrame() {
    this.pressed = Object.create(null);
  }
};
