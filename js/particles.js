/* ============================================================
   particles.js — חלקיקים, טקסטים מרחפים ורעידת מסך
   ============================================================ */
'use strict';

const FX = {

  parts: [],
  texts: [],
  rings: [],
  shake: 0,
  shakeX: 0,
  shakeY: 0,

  reset() {
    this.parts.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
    this.shake = 0;
  },

  /* ---------------- חלקיקים ---------------- */
  burst(x, y, n, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const a = opts.angle != null
        ? opts.angle + U.rand(-(opts.spread || 0.6), (opts.spread || 0.6))
        : U.rand(0, Math.PI * 2);
      const sp = U.rand(opts.speedMin || 60, opts.speedMax || 240);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: U.rand(opts.rMin || 2, opts.rMax || 5),
        life: U.rand(opts.lifeMin || 0.3, opts.lifeMax || 0.75),
        age: 0,
        color: opts.colors ? U.pick(opts.colors) : (opts.color || '#ffcc3d'),
        grav: opts.grav == null ? 0 : opts.grav,
        drag: opts.drag == null ? 3 : opts.drag,
        shape: opts.shape || 'circle',
        rot: U.rand(0, Math.PI * 2),
        spin: U.rand(-9, 9)
      });
    }
  },

  /* אבק מתחת לרגליים */
  dust(x, y, dir) {
    this.burst(x, y + 20, 4, {
      angle: dir > 0 ? Math.PI : 0, spread: 0.5,
      speedMin: 30, speedMax: 110,
      rMin: 1.5, rMax: 3.5,
      lifeMin: 0.22, lifeMax: 0.45,
      colors: ['rgba(200,190,230,.5)', 'rgba(255,255,255,.32)']
    });
  },

  /* נצנצים לסיישל */
  glitter(x, y, n) {
    this.burst(x, y, n, {
      speedMin: 40, speedMax: 340,
      rMin: 2, rMax: 6,
      lifeMin: 0.6, lifeMax: 1.5,
      grav: 260, drag: 1.4,
      shape: 'star',
      colors: ['#ffd93d', '#fff3b0', '#ff9d1f', '#ffffff', '#ffe98a']
    });
  },

  confetti(x, y, n) {
    this.burst(x, y, n, {
      speedMin: 120, speedMax: 460,
      rMin: 3, rMax: 7,
      lifeMin: 0.8, lifeMax: 1.6,
      grav: 620, drag: 1.1,
      shape: 'rect',
      colors: ['#ff3b6b', '#ffcc3d', '#49d6ff', '#9bff5b', '#a26bff', '#ffffff']
    });
  },

  /* ---------------- טקסט מרחף ---------------- */
  text(x, y, str, opts) {
    opts = opts || {};
    this.texts.push({
      x, y, str,
      vy: opts.vy == null ? -52 : opts.vy,
      life: opts.life || 1.0,
      age: 0,
      size: opts.size || 22,
      color: opts.color || '#ffcc3d',
      stroke: opts.stroke == null ? '#1a1226' : opts.stroke,
      weight: opts.weight || 900
    });
  },

  /* ---------------- טבעת הלם ---------------- */
  ring(x, y, opts) {
    opts = opts || {};
    this.rings.push({
      x, y, age: 0,
      life: opts.life || 0.45,
      r0: opts.r0 || 8,
      r1: opts.r1 || 90,
      color: opts.color || 'rgba(255,204,61,.8)',
      width: opts.width || 4
    });
  },

  /* ---------------- רעידה ---------------- */
  addShake(v) { this.shake = Math.min(30, this.shake + v); },

  /* ---------------- עדכון ---------------- */
  update(dt) {
    /* חלקיקים */
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      const d = 1 - Math.min(1, p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }

    /* טקסטים */
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.age += dt;
      if (t.age >= t.life) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= 1 - Math.min(1, 2.2 * dt);
    }

    /* טבעות */
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age >= r.life) this.rings.splice(i, 1);
    }

    /* רעידה */
    if (this.shake > 0.05) {
      this.shake = U.damp(this.shake, 0, 0.16, dt);
      this.shakeX = U.rand(-this.shake, this.shake);
      this.shakeY = U.rand(-this.shake, this.shake);
    } else {
      this.shake = 0; this.shakeX = 0; this.shakeY = 0;
    }
  },

  /* ---------------- ציור ---------------- */
  drawParticles(ctx) {
    for (const p of this.parts) {
      const k = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);

      if (p.shape === 'rect') {
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r * 0.55, p.r * 2, p.r * 1.1);
      } else if (p.shape === 'star') {
        ctx.rotate(p.rot);
        const r = p.r * (0.6 + k * 0.6);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = i % 2 === 0 ? r : r * 0.36;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
      } else {
        U.circle(ctx, 0, 0, p.r * (0.35 + k * 0.75));
        ctx.fill();
      }
      ctx.restore();
    }
  },

  drawRings(ctx) {
    for (const r of this.rings) {
      const k = r.age / r.life;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.7);
      U.circle(ctx, r.x, r.y, U.lerp(r.r0, r.r1, U.easeOutCubic(k)));
      ctx.stroke();
      ctx.restore();
    }
  },

  drawTexts(ctx) {
    for (const t of this.texts) {
      const k = t.age / t.life;
      const pop = k < 0.16 ? U.easeOutBack(k / 0.16) : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = t.weight + ' ' + t.size + 'px "Segoe UI","Arial Hebrew",Arial,sans-serif';
      if (t.stroke) {
        ctx.lineWidth = Math.max(3, t.size * 0.18);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = t.stroke;
        ctx.strokeText(t.str, 0, 0);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
  }
};
