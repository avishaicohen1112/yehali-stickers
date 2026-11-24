'use strict';
// Giant bosses of the Shadow Theatre (world 4): screen-filling, 3 phases each, and every fight has its own stage trick
// for the hero (valve wheels, lanterns, strings, spotlight consoles, paper-crane flight).
// Art: each body part is drawn from a painted prop 'gb_<boss>_<part>' when it exists (ART_BRIEF part 3), otherwise a
// plain stand-in shape so the fight is fully playable before the art arrives.
G.Giants = (function () {
  const { Boss, fireball } = G.Bosses;
  const P = () => G.Main.player;
  const IMG = (k) => window.PROPS[k] && G.Assets.get('prop_' + k) ? [G.Assets.get('prop_' + k), window.PROPS[k]] : null;

  // A hittable body part that forwards damage to its owner (or runs its own onHit). Lives in the enemy list.
  class Part {
    constructor(owner, name, o = {}) { this.owner = owner; this.name = name; this.isPart = true; this.mult = o.mult ?? 1; this.onHit = o.onHit; this.noSoul = !!o.noSoul; this.box = null; this.off = false; this.dead = false; this.x = 0; this.y = 0; this.w = 1; this.h = 1; }
    get cx() { return this.box ? this.box.x + this.box.w / 2 : 0; } get cy() { return this.box ? this.box.y + this.box.h / 2 : 0; }
    hurtbox() { return this.off || !this.box || this.owner.dead || !this.owner.active ? null : this.box; }
    hurt(d, dx, dy, src) { if (!this.hurtbox()) return false; if (this.onHit) return this.onHit(d, src) !== false; return this.owner.hurt(d * this.mult, dx, dy, src); }
    update() { } draw() { }
  }

  class Giant extends Boss {
    constructor(kind, tx, ty, o) { super(kind, tx, ty, o); this.FY = ty * TILE; this.tel = []; this.parts = []; this.haz = []; this.mul = 1; this.invuln = false; }
    part(name, o) { const p = new Part(this, name, o); this.parts.push(p); G.Main.addEnemy(p); return p; }
    hurt(d, dx, dy, src) {
      if (this.invuln) { if (src === 'needle') { G.Sound.sfx('clank', { pitch: 0.7 }); } return false; }
      return super.hurt(d * this.mul, dx, dy);
    }
    // telegraphs: 'col' {x,w}, 'lane' {y,h}, 'circle' {x,y,r}, 'rect' {x,y,w,h}
    warn(kind, o, dur) { const w = Object.assign({ kind, t: 0, dur }, o); this.tel.push(w); return w; }
    hazard(box, dur, o = {}) { const h = Object.assign({ box, t: 0, dur }, o); this.haz.push(h); return h; }
    tick(dt) {
      for (const w of this.tel) w.t += dt; this.tel = this.tel.filter(w => w.t < w.dur);
      for (const h of this.haz) { h.t += dt; if (h.t > (h.delay || 0)) G.Main.hitPlayer(h.box, h.box.x + h.box.w / 2); }
      this.haz = this.haz.filter(h => h.t < h.dur);
    }
    drawTel(ctx, t) {
      const R = G.Render, top = R.cam.y, bot = R.cam.y + R.VH, left = R.cam.x, right = R.cam.x + R.VW;
      for (const w of this.tel) {
        const k = w.t / w.dur, a = (0.18 + 0.22 * Math.abs(Math.sin(t * 14))) * Math.min(1, k * 4);
        ctx.fillStyle = rgba(w.c || [255, 90, 60], a);
        if (w.kind === 'col') ctx.fillRect(w.x - w.w / 2, top, w.w, bot - top);
        else if (w.kind === 'lane') ctx.fillRect(left, w.y - w.h / 2, right - left, w.h);
        else if (w.kind === 'rect') ctx.fillRect(w.x, w.y, w.w, w.h);
        else if (w.kind === 'circle') { ctx.beginPath(); ctx.arc(w.x, w.y, w.r * (0.6 + 0.4 * k), 0, 7); ctx.fill(); }
      }
      for (const h of this.haz) if (h.draw) h.draw(ctx, h, t);
    }
    img(name, x, y, w, h, rot, fb, o = {}) {  // painted part if available, else stand-in
      const I = IMG('gb_' + this.kind + '_' + name);
      ctx_save(o.ctx); const c = o.ctx; c.translate(x, y); if (rot) c.rotate(rot); if (o.flip) c.scale(-1, 1);
      if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
      if (I) { const pv = o.pivot || [0.5, 0.5]; c.drawImage(I[0], -pv[0] * w, -pv[1] * h, w, h); }
      else fb(c);
      if (this.flash > 0 && !o.noflash) { c.globalCompositeOperation = 'source-atop'; }
      c.restore();
    }
    wheelPrompt(ctx, x, y, label) { if (Math.abs(P().cx - x) < 70 && P().ground) G.UI.prompt(ctx, x, y - 140, G.T(label)); }
    // stage device the hero works by holding up (valve wheel) or tapping up (spotlight console)
    useDevice(dev, dt, hold) {
      const p = P(), near = Math.abs(p.cx - dev.x) < 60 && Math.abs(p.feet - dev.y) < 40 && p.ground && !p.dead;
      dev.cd = Math.max(0, (dev.cd || 0) - dt);
      if (!near || dev.cd > 0) { dev.prog = Math.max(0, (dev.prog || 0) - dt * 2); return false; }
      if (hold) {
        if (G.Input.h('up')) { dev.prog = (dev.prog || 0) + dt; p.lock = 0.08; p.leverT = 0.15; p.vx = 0; dev.ang = (dev.ang || 0) + dt * 6; if (dev.prog >= hold) { dev.prog = 0; return true; } }
        else dev.prog = Math.max(0, (dev.prog || 0) - dt * 2);
        return false;
      }
      if (G.Input.p('up')) { G.Input.consume('up'); p.pointT = 0.6; p.lock = 0.35; p.vx = 0; p.facing = sign(this.cx - p.cx) || 1; return true; }
      return false;
    }
  }
  function ctx_save(c) { c.save(); }
  const ink = '#14101a';

  // ======================================================================================
  // T01 — THE WAX MOTHER: a giant wax face rising from a boiling wax pool, two huge hands.
  // Stage trick: two valve wheels (hold ↑). Turn both within 10 s -> cold steam freezes her: face sinks, 1.6x damage.
  // ======================================================================================
  class WaxMother extends Giant {
    constructor(tx, ty) {
      super('waxmother', tx, ty, { w: 320, h: 380, maxHp: 140, glowC: [255, 170, 90], phases: [0.66, 0.33] });
      this.fx = tx * TILE; this.hiY = this.FY - 470; this.loY = this.FY - 260; this.faceY = this.FY + 200; this.open = 0;
      this.hands = [-1, 1].map(s => ({ s, rx: this.fx + s * 560, ry: this.FY - 300, x: this.fx + s * 560, y: this.FY - 300, st: 'rest', t: 0 }));
      this.valves = [{ x: 7 * TILE, y: this.FY }, { x: 29 * TILE, y: this.FY }]; this.frozen = 0; this.wax = this.FY + 40; this.waxT = this.FY + 40;
    }
    setFace() { this.x = this.fx - this.w / 2; this.y = this.faceY - this.h / 2; }
    hurtbox() { if (this.dead || !this.active || this.faceY > this.FY - 100) return null; return { x: this.fx - 140, y: this.faceY - 170, w: 280, h: 330 }; }
    hitboxes() { return []; }
    onPhase(ph) { this.faceY += 60; G.FX.burst(this.fx, this.faceY, 60, { speed: 600, life: 1, size: 5, c: [255, 220, 170], kind: 'chunk', g: 1500, add: false }); }
    update(dt, room, p) {
      this.common(dt); this.tick(dt); this.setFace();
      if (!this.hp_parts) { this.hp_parts = this.hands.map(h => (h.part = this.part('hand', { mult: 0.6 }))); }
      if (this.dead) { this.deathFX(dt); this.faceY += dt * 120; this.tel = []; this.haz = []; this.waxT = this.FY + 40; this.wax = approach(this.wax, this.waxT, 200 * dt); return; }
      if (!this.active) { this.faceY = this.FY + 200; return; }
      const sp = 1 + (this.phase - 1) * 0.22; this.mul = this.frozen > 0 ? 1.6 : this.state === 'inhale' ? 1.25 : 1;
      // valves
      for (const v of this.valves) if (this.useDevice(v, dt, 0.9)) {
        v.cd = 12; v.done = this.t; G.Sound.sfx('splash', { pitch: 0.7 }); G.FX.burst(v.x, v.y - 60, 40, { speed: 500, life: 1, size: 9, c: [220, 235, 255], kind: 'smoke', angle: -Math.PI / 2, spread: 0.6, add: false });
        if (this.state === 'wave') { this.waxT = this.FY + 40; this.set('idle'); G.UI.toast(G.T('wax_hard'), 1.5); }
        if (this.valves.every(o => o.done && this.t - o.done < 10)) { this.frozen = 4.5; this.valves.forEach(o => o.done = 0); this.set('frozen'); G.Sound.sfx('boss_roar', { pitch: 0.6 }); G.FX.flash('#dff0ff', 0.4, 0.6); }
      }
      const target = this.state === 'frozen' ? this.loY + 40 : this.state === 'inhale' ? this.loY : this.state === 'rise' ? this.hiY : this.hiY + Math.sin(this.t * 0.9) * 25;
      this.faceY = approach(this.faceY, target, (this.state === 'rise' ? 260 : 380) * dt);
      this.open = approach(this.open, this.state === 'inhale' ? 1 : 0, dt * 3);
      switch (this.state) {
        case 'wait': this.set('rise'); G.Sound.sfx('boss_roar', { pitch: 0.5 }); break;
        case 'rise': if (this.st > 1.6) this.set('idle'); break;
        case 'idle': if (this.st > 1.25 / sp) {
          const o = ['slam', 'slam', 'drops', 'inhale']; if (this.phase > 1) o.push('wave', 'double'); if (this.phase > 2) o.push('jet', 'jet');
          let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n); this.k = 0; } break;
        case 'slam': if (this.st < 0.02) this.slam(this.hands[p.cx < this.fx ? 0 : 1], p.cx, 0.85 / sp); if (this.st > 2.6) this.set('idle'); break;
        case 'double': if (this.st < 0.02) { this.slam(this.hands[0], p.cx - 260, 0.9 / sp); this.slam(this.hands[1], p.cx + 260, 1.3 / sp); } if (this.st > 3.1) this.set('idle'); break;
        case 'drops':
          if (this.st > this.k * 0.28 / sp && this.k < 5 + this.phase * 2) { this.k++; const x = clamp((this.k % 2 ? p.cx : rand(3, 33) * TILE) + rand(-90, 90), 2 * TILE, 34 * TILE);
            this.warn('col', { x, w: 90, c: [255, 140, 60] }, 0.75);
            fireball(x, room.ph * 0 + this.FY - 900, 0, 0, { g: 0, vy: 0, r: 18, life: 3, c: [255, 190, 110], ghost: true, hold: true, wait: 0.75,
              update: (pr, d) => { if (pr.t > pr.wait) { pr.vy = 1500; pr.hold = false; } if (pr.y > this.FY - 18) { pr.t = 99; G.FX.burst(pr.x, this.FY - 10, 14, { speed: 300, life: 0.5, size: 4, c: [255, 200, 130], kind: 'ember', angle: -Math.PI / 2, spread: 1.2 }); } } }); }
          if (this.st > 3.2) this.set('idle'); break;
        case 'inhale':  // face sinks low and sucks the hero toward the boiling centre (punish window: 1.25x damage)
          if (this.st > 0.5 && this.st < 2.9) { p.pullV = sign(this.fx - p.cx) * 330; if (Math.random() < 0.6) G.FX.spawn({ x: this.fx + rand(-700, 700), y: this.FY - rand(20, 400), vx: 0, vy: 0, life: 0.6, size: 1.6, kind: 'streak', c: [255, 220, 170], a: 0.6, add: true, update: null });
            this.hazard({ x: this.fx - 70, y: this.FY - 70, w: 140, h: 70 }, dt * 1.5); }
          if (this.st > 3.3) this.set('idle'); break;
        case 'wave':  // boiling wax rises to just below the platforms
          if (this.st < 0.02) this.warn('rect', { x: 0, y: this.FY - 150, w: 36 * TILE, h: 150, c: [255, 120, 40] }, 1.3);
          this.waxT = this.st > 1.3 && this.st < 3.8 ? this.FY - 150 : this.FY + 40;
          if (this.st > 4.4) this.set('idle'); break;
        case 'jet':  // phase 3: the eye sweeps a flame beam at one of two heights
          if (this.st < 0.02) { this.jy = Math.random() < 0.5 ? this.FY - 45 : this.FY - 175; this.warn('lane', { y: this.jy, h: 70, c: [255, 100, 40] }, 0.9); }
          if (this.st > 0.9 && this.st < 1.7) { this.hazard({ x: 0, y: this.jy - 35, w: 36 * TILE, h: 70 }, dt * 1.5); if (Math.random() < 0.8) G.FX.spawn({ x: rand(0, 36 * TILE), y: this.jy + rand(-25, 25), vx: rand(-200, 200), vy: rand(-60, 0), life: 0.4, size: 4, kind: 'ember', c: [255, 150, 60], add: true }); }
          if (this.st > 2.2) this.set('idle'); break;
        case 'frozen': this.frozen -= dt; if (Math.random() < dt * 20) G.FX.spawn({ x: this.fx + rand(-150, 150), y: this.faceY + rand(-150, 150), vx: 0, vy: -20, life: 1, size: 2, kind: 'mote', ph: rand(6), c: [210, 235, 255], a: 0.8, add: true });
          if (this.frozen <= 0) { this.set('idle'); G.Sound.sfx('boss_roar', { pitch: 0.8 }); } break;
      }
      // wax pool + hands
      this.wax = approach(this.wax, this.waxT, 260 * dt);
      if (this.wax < this.FY - 10) this.hazard({ x: 0, y: this.wax + 8, w: 36 * TILE, h: this.FY - this.wax }, dt * 1.5);
      for (const h of this.hands) this.updHand(h, dt);
      G.FX.light(this.fx, this.faceY, 600, this.frozen > 0 ? [200, 230, 255] : [255, 170, 90], 0.9);
    }
    slam(h, x, tw) { h.st = 'aim'; h.t = 0; h.tx = clamp(x, 2 * TILE, 34 * TILE); h.tw = tw; this.warn('col', { x: h.tx, w: 230, c: [255, 120, 60] }, tw + 0.25); }
    updHand(h, dt) {
      h.t += dt; const part = h.part;
      if (h.st === 'rest' || this.state === 'frozen') { h.x = approach(h.x, h.rx, 900 * dt); h.y = approach(h.y, h.ry + Math.sin(this.t * 1.3 + h.s) * 18, 900 * dt); if (h.st !== 'rest' && this.state === 'frozen') h.st = 'rest'; }
      else if (h.st === 'aim') { h.x = approach(h.x, h.tx, 2200 * dt); h.y = approach(h.y, this.FY - 560, 1400 * dt); if (h.t > h.tw) { h.st = 'fall'; h.t = 0; } }
      else if (h.st === 'fall') { h.y += 2600 * dt; if (h.y >= this.FY - 70) { h.y = this.FY - 70; h.st = 'stuck'; h.t = 0; G.Sound.sfx('boss_slam'); G.FX.shake(18, 0.4);
          G.FX.burst(h.x, this.FY - 5, 30, { speed: 500, life: 0.6, size: 6, c: [255, 210, 150], kind: 'chunk', g: 1400, add: false });
          for (const d of [-1, 1]) fireball(h.x + d * 90, this.FY - 22, d * (520 + this.phase * 60), 0, { r: 22, life: 2.4, ghost: true, c: [255, 200, 130], light: [255, 170, 80, 140] }); }
        this.hazard({ x: h.x - 100, y: h.y - 80, w: 200, h: 140 }, dt * 1.5); }
      else if (h.st === 'stuck') { if (h.t > 1.25) { h.st = 'rest'; h.t = 0; } }
      part.box = { x: h.x - 100, y: h.y - 75, w: 200, h: 150 }; part.off = h.st !== 'stuck';
    }
    draw(ctx, t) {
      const c = ctx; this.drawTel(c, t);
      // body + face
      const fy = this.faceY, ph = this.phase, fr = this.frozen > 0;
      this.img('body', this.fx, fy + 330, 760, 520, 0, (c) => { c.fillStyle = fr ? '#9fb2c4' : '#d9c4a2'; c.beginPath(); c.ellipse(0, 0, 360, 240, 0, Math.PI, 0); c.fill(); }, { ctx: c, pivot: [0.5, 0.5] });
      const face = ph === 1 ? 'face' : ph === 2 ? 'face2' : 'eye3';
      this.img(face, this.fx, fy, 320, 380, Math.sin(this.t * 0.7) * 0.03, (c) => {
        c.fillStyle = this.flash > 0.3 ? '#fff' : fr ? '#cfe3f2' : ph < 3 ? '#efe1c6' : '#2a1a14';
        c.beginPath(); c.ellipse(0, 0, 150, 185, 0, 0, 7); c.fill();
        if (ph < 3) { c.fillStyle = ink; c.beginPath(); c.ellipse(-55, -30, 26, 34, 0, 0, 7); c.ellipse(55, -30, 26, 34, 0, 0, 7); c.fill();
          c.beginPath(); c.ellipse(0, 85, 40 + this.open * 30, 12 + this.open * 45, 0, 0, 7); c.fill();
          if (ph === 2) { c.fillStyle = '#e8d2ac'; for (let i = 0; i < 6; i++) c.fillRect(-120 + i * 45, 120 + (i % 2) * 20, 16, 70); } }
        else { c.fillStyle = '#f3ead6'; c.beginPath(); c.ellipse(0, 0, 95, 70, 0, 0, 7); c.fill(); const a = Math.atan2(P().cy - fy, P().cx - this.fx);
          c.fillStyle = '#c0301c'; c.beginPath(); c.arc(Math.cos(a) * 40, Math.sin(a) * 25, 30, 0, 7); c.fill(); }
      }, { ctx: c });
      if (!this.dead) for (let i = -2; i <= 2; i++) G.FX.flame(c, this.fx + i * 55, fy - 190 - (2 - Math.abs(i)) * 18, ph === 3 ? 7 : 4.5, t + i, { glow: 0.6 });
      // hands
      for (const h of this.hands) this.img(h.s < 0 ? 'handL' : 'handR', h.x, h.y, 230, 190, h.st === 'stuck' ? 0 : Math.sin(this.t + h.s) * 0.08, (c) => {
        c.fillStyle = this.flash > 0.3 ? '#fff' : fr ? '#bfd3e2' : '#e6d3b0'; c.beginPath(); c.ellipse(0, 10, 100, 70, 0, 0, 7); c.fill();
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-66 + i * 44, -60, 18, 42, 0, 0, 7); c.fill(); } }, { ctx: c, flip: h.s > 0 });
      // valves
      for (const v of this.valves) {
        this.img('valve', v.x, v.y - 70, 110, 110, v.ang || 0, (c) => { c.strokeStyle = v.cd > 0 ? '#5c6670' : '#b08a4a'; c.lineWidth = 9; c.beginPath(); c.arc(0, 0, 46, 0, 7); c.stroke();
          for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-46, 0); c.lineTo(46, 0); c.stroke(); } }, { ctx: c });
        if (v.prog > 0) { c.fillStyle = 'rgba(210,235,255,0.8)'; c.fillRect(v.x - 40, v.y - 150, 80 * Math.min(1, v.prog / 0.9), 6); }
        if (!v.cd && this.active && !this.dead) this.wheelPrompt(c, v.x, v.y, 'spin');
      }
      // wax pool
      const y = this.wax; if (y < this.FY + 30) { c.fillStyle = 'rgba(255,150,60,0.85)'; c.beginPath(); c.moveTo(0, this.FY + 100); for (let x = 0; x <= 36 * TILE; x += 40) c.lineTo(x, y + Math.sin(x * 0.02 + t * 4) * 8); c.lineTo(36 * TILE, this.FY + 100); c.fill(); }
    }
  }

  // ======================================================================================
  // T03 — THE LANTERN QUEEN: a giant moth whose body is a tower of lanterns.
  // Stage trick: hit hanging lanterns to light them (your flame). Enough lit lanterns lure her: she crashes into them and
  // lies stunned on the stage (1.4x damage). Phase 2: torn wings, low charges + moth swarms. Phase 3: burning, fire trails.
  // ======================================================================================
  class LanternQueen extends Giant {
    constructor(tx, ty) {
      super('lanternqueen', tx, ty, { w: 260, h: 200, maxHp: 130, glowC: [255, 220, 150], phases: [0.6, 0.3] });
      this.qx = tx * TILE; this.qy = this.FY - 600; this.lan = [[4, 13], [32, 13], [7, 10], [29, 10], [18, 7], [13, 13]].map(([x, y]) => ({ x: x * TILE, y: y * TILE, lit: 0 }));
    }
    hurtbox() { if (this.dead || !this.active) return null; const s = this.state === 'stunned'; return { x: this.qx - (s ? 170 : 110), y: this.qy - (s ? 120 : 80), w: s ? 340 : 220, h: s ? 220 : 160 }; }
    hitboxes() { return []; }
    update(dt, room, p) {
      this.common(dt); this.tick(dt); this.x = this.qx - this.w / 2; this.y = this.qy - this.h / 2;
      if (!this.lparts) this.lparts = this.lan.map(l => { const pt = this.part('lantern', { noSoul: true, onHit: () => { if (l.lit <= 0) { G.Sound.sfx('heal', { pitch: 1.5 }); G.FX.burst(l.x, l.y + 30, 18, { speed: 260, life: 0.5, size: 3, c: [255, 220, 140], kind: 'ember' }); } l.lit = 8; return true; } });
        pt.box = { x: l.x - 30, y: l.y - 10, w: 60, h: 80 }; return pt; });
      for (const l of this.lan) { l.lit = Math.max(0, l.lit - dt); if (l.lit > 0) G.FX.light(l.x, l.y + 40, 260, [255, 210, 130], 1); }
      if (this.dead) { this.deathFX(dt); this.qy = approach(this.qy, this.FY - 100, 300 * dt); this.tel = []; return; }
      if (!this.active) return;
      const sp = 1 + (this.phase - 1) * 0.2, need = this.phase === 1 ? 2 : 3, lit = this.lan.filter(l => l.lit > 0);
      this.mul = this.state === 'stunned' ? 1.4 : 1;
      if (['idle', 'dust'].includes(this.state) && lit.length >= need) { this.lure = lit.reduce((a, b) => Math.hypot(b.x - this.qx, b.y - this.qy) < Math.hypot(a.x - this.qx, a.y - this.qy) ? b : a); this.set('lured'); G.Sound.sfx('swoop', { pitch: 0.5 }); }
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle': {  // drift in a slow figure-eight over the stage
          const tx = 18 * TILE + Math.sin(this.t * 0.6) * 11 * TILE, ty = this.FY - (this.phase > 1 ? 380 : 560) + Math.sin(this.t * 1.2) * 90;
          this.qx = approach(this.qx, tx, 420 * dt); this.qy = approach(this.qy, ty, 300 * dt);
          if (this.st > 1.5 / sp) { const o = ['dive', 'dive', 'dust']; if (this.phase > 1) o.push('charge', 'swarm'); let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n + '_w'); }
          break; }
        case 'dive_w': if (this.st < 0.02) { this.dt_ = { x: p.cx, y: Math.min(p.cy, this.FY - 90) }; this.warn('circle', { x: this.dt_.x, y: this.dt_.y, r: 140, c: [255, 120, 60] }, 0.75 / sp); }
          this.qy = approach(this.qy, this.qy - 1, 1); if (this.st > 0.75 / sp) { this.set('dive'); this.d0 = { x: this.qx, y: this.qy }; G.Sound.sfx('swoop', { pitch: 0.7 }); } break;
        case 'dive': { const k = Math.min(1, this.st / 0.45); this.qx = lerp(this.d0.x, this.dt_.x, ease.in(k)); this.qy = lerp(this.d0.y, this.dt_.y, ease.in(k));
          this.hazard({ x: this.qx - 110, y: this.qy - 70, w: 220, h: 140 }, dt * 1.5); if (this.phase > 2 && Math.random() < 0.6) this.fire(this.qx);
          if (this.st > 0.8) this.set('idle'); break; }
        case 'dust_w': if (this.st > 0.3) { this.set('dust'); this.k = 0; this.dir = this.qx < 18 * TILE ? 1 : -1; } break;
        case 'dust': this.qx += this.dir * 620 * dt; this.qy = approach(this.qy, this.FY - 560, 400 * dt);
          if (this.st > this.k * 0.3) { this.k++; const x = this.qx; this.warn('col', { x, w: 120, c: [210, 230, 255] }, 0.6);
            this.hazard({ x: x - 60, y: this.FY - 260, w: 120, h: 260 }, 3, { delay: 0.6, draw: (c, h) => { if (h.t < 0.6) return; c.fillStyle = `rgba(230,240,255,${0.35 * (1 - (h.t - 0.6) / 2.4)})`; c.beginPath(); c.ellipse(h.box.x + 60, h.box.y + 140, 80, 130, 0, 0, 7); c.fill(); } }); }
          if (this.qx < 3 * TILE || this.qx > 33 * TILE) this.set('idle'); break;
        case 'charge_w': if (this.st < 0.02) { this.side = p.cx < 18 * TILE ? 1 : -1; this.warn('lane', { y: this.FY - 110, h: 200, c: [255, 120, 60] }, 0.9 / sp); }
          this.qx = approach(this.qx, this.side > 0 ? 38 * TILE : -2 * TILE, 1800 * dt); this.qy = approach(this.qy, this.FY - 110, 1400 * dt);
          if (this.st > 0.9 / sp) { this.set('charge'); G.Sound.sfx('swoop'); } break;
        case 'charge': this.qx -= this.side * 1500 * sp * dt; this.hazard({ x: this.qx - 130, y: this.qy - 80, w: 260, h: 160 }, dt * 1.5); if (this.phase > 2) this.fire(this.qx);
          if ((this.side > 0 && this.qx < -2 * TILE) || (this.side < 0 && this.qx > 38 * TILE)) { this.qx = 18 * TILE; this.qy = this.FY - 900; this.set('idle'); } break;
        case 'swarm_w': if (this.st > 0.5) { this.set('swarm'); G.Sound.sfx('spore', { pitch: 1.4 });
            for (let i = 0; i < 5 + this.phase; i++) G.Objects.spawnProj({ x: this.qx, y: this.qy, vx: rand(-300, 300), vy: rand(-300, 100), r: 12, life: 5, dmg: 1, c: [230, 225, 200],
              update: (pr, d) => { if (pr.t > 0.7) { const a = Math.atan2(P().cy - pr.y, P().cx - pr.x); pr.vx = approach(pr.vx, Math.cos(a) * 260, 500 * d); pr.vy = approach(pr.vy, Math.sin(a) * 260, 500 * d); } },
              draw: (c, pr) => { c.fillStyle = '#e9e2cf'; const f = Math.sin(pr.t * 30) * 8; c.beginPath(); c.ellipse(pr.x - 7, pr.y, 9, 4 + f * 0.5, 0.5, 0, 7); c.ellipse(pr.x + 7, pr.y, 9, 4 - f * 0.5, -0.5, 0, 7); c.fill(); } }); } break;
        case 'swarm': if (this.st > 1) this.set('idle'); break;
        case 'lured': this.qx = approach(this.qx, this.lure.x, 900 * dt); this.qy = approach(this.qy, this.lure.y + 20, 900 * dt);
          if (Math.hypot(this.qx - this.lure.x, this.qy - this.lure.y - 20) < 10) { this.set('crash'); G.Sound.sfx('boss_slam'); G.FX.shake(14, 0.4); this.lan.forEach(l => l.lit = 0);
            G.FX.burst(this.qx, this.qy, 40, { speed: 500, life: 0.8, size: 4, c: [255, 220, 150], kind: 'shard', g: 1200, add: false }); } break;
        case 'crash': this.qy = Math.min(this.FY - 100, this.qy + 1400 * dt); if (this.qy >= this.FY - 100) { this.set('stunned'); G.UI.toast(G.T('queen_down'), 1.4); } break;
        case 'stunned': if (this.st > 3.6) { this.set('idle'); G.Sound.sfx('boss_roar', { pitch: 1.2 }); } break;
      }
      G.FX.light(this.qx, this.qy, 520, [255, 220, 150], 0.9);
    }
    fire(x) { this.hazard({ x: x - 40, y: this.FY - 50, w: 80, h: 50 }, 2.6, { delay: 0.25, draw: (c, h) => { if (Math.random() < 0.3) G.FX.flame(c, h.box.x + 40, this.FY - 4, 4, h.t * 3, { glow: 0.5 }); } }); }
    draw(ctx, t) {
      const c = ctx; this.drawTel(c, t);
      for (const l of this.lan) {  // hanging lanterns (the stage trick)
        c.strokeStyle = '#4a3a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(l.x, 0); c.lineTo(l.x, l.y); c.stroke();
        this.img(l.lit > 0 ? 'lantern_lit' : 'lantern', l.x, l.y + 35, 60, 80, Math.sin(t + l.x) * 0.05, (c) => { c.fillStyle = '#3a2c22'; c.fillRect(-26, -36, 52, 72); c.fillStyle = l.lit > 0 ? '#ffd98a' : '#2a2430'; c.fillRect(-18, -26, 36, 52); }, { ctx: c, pivot: [0.5, 0.1] });
        if (l.lit > 0) G.FX.flame(c, l.x, l.y + 50, 3, t + l.x, { glow: 1 });
      }
      const st = this.state === 'stunned' || this.state === 'crash', fl = Math.sin(t * (st ? 2 : 16)) * (st ? 0.1 : 0.5), ph = this.phase;
      for (const s of [-1, 1]) this.img(ph > 1 ? 'wing_torn' : 'wing', this.qx + s * 40, this.qy - 10, 300, 240, s * (0.35 + fl), (c) => {
        c.fillStyle = ph > 2 ? '#e0782e' : '#d8cfb8'; c.globalAlpha *= 0.9; c.beginPath(); c.ellipse(s * 140, -40, 150, ph > 1 ? 70 : 110, s * 0.3, 0, 7); c.fill();
        c.fillStyle = '#6fd0ff'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(s * (90 + i * 40), -40 + (i % 2) * 30, 14, 0, 7); c.fill(); } }, { ctx: c, pivot: [0.5, 0.5] });
      this.img('body', this.qx, this.qy, 200, 300, st ? 1.2 : Math.sin(t * 2) * 0.05, (c) => {
        c.fillStyle = this.flash > 0.3 ? '#fff' : '#3a2c22'; c.fillRect(-45, -120, 90, 240); c.fillStyle = '#ffd98a'; for (let i = 0; i < 4; i++) c.fillRect(-30, -105 + i * 55, 60, 38);
        c.fillStyle = '#efe6d2'; c.beginPath(); c.ellipse(0, -150, 60, 50, 0, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.ellipse(-22, -150, 14, 18, 0, 0, 7); c.ellipse(22, -150, 14, 18, 0, 0, 7); c.fill(); }, { ctx: c });
      if (ph > 2 && !this.dead) G.FX.flame(c, this.qx, this.qy - 190, 8, t, { glow: 1 });
    }
  }

  // ======================================================================================
  // T04 — THE PUPPETEER: a giant hand on strings works a giant knight marionette.
  // Stage trick: cut the four strings (jump + up-slash). Each cut costs the boss HP and a limb: sword arm -> no swings,
  // legs -> no leaps/stomps. Phase 2 (marionette collapses): the hand fights itself — snips, floor grabs, thread rain.
  // ======================================================================================
  class Puppeteer extends Giant {
    constructor(tx, ty) {
      super('puppeteer', tx, ty, { w: 260, h: 200, maxHp: 140, glowC: [255, 230, 200], phases: [0.55, 0.25] });
      this.hx = tx * TILE; this.hy = 2.4 * TILE; this.mx = tx * TILE; this.mst = 'idle'; this.mt = 0; this.mvx = 0; this.mjump = 0;
      this.strings = ['head', 'sword', 'shield', 'legs'].map((k, i) => ({ k, hp: 7, cut: false, fx: (i - 1.5) * 60 }));
    }
    attach(s) { const x = this.mx, y = this.FY - 420 - this.mjump; return { head: [x, y + 20], sword: [x + 120, y + 170], shield: [x - 110, y + 170], legs: [x + 40, y + 330] }[s.k]; }
    hurtbox() { if (this.dead || !this.active || this.mst !== 'fallen') return null; return { x: this.hx - 130, y: this.hy - 90, w: 260, h: 190 }; }
    hitboxes() { return []; }
    onPhase(ph) { if (ph === 2) this.collapse(); }
    collapse() { if (this.mst === 'fallen') return; this.mst = 'fallen'; this.strings.forEach(s => s.cut = true); G.Sound.sfx('boss_slam'); G.FX.shake(20, 0.6); this.set('idle');
      G.FX.burst(this.mx, this.FY - 100, 50, { speed: 500, life: 1, size: 6, c: [150, 130, 110], kind: 'chunk', g: 1400, add: false }); }
    update(dt, room, p) {
      this.common(dt); this.tick(dt); this.x = this.hx - this.w / 2; this.y = this.hy - this.h / 2;
      if (!this.sparts) {
        this.sparts = this.strings.map(s => this.part('string', { noSoul: false, onHit: (d) => { if (s.cut) return false; s.hp -= d; G.FX.burst(this.attach(s)[0], p.cy, 8, { speed: 300, life: 0.3, size: 2, c: [255, 240, 220], kind: 'spark' });
          if (s.hp <= 0) { s.cut = true; G.Sound.sfx('slash', { pitch: 0.6 }); this.hurt(12, 0, 0); G.UI.toast(G.T('string_cut'), 1.2); if (this.strings.filter(q => q.cut).length >= 3) this.collapse(); } return true; } }));
        this.body = this.part('marionette', { mult: 0.45 });
      }
      if (this.dead) { this.deathFX(dt); this.hy += dt * 200; this.tel = []; return; }
      if (!this.active) return;
      const sp = 1 + (this.phase - 1) * 0.22, S = this.strings, has = k => !S.find(s => s.k === k).cut;
      // strings' hitboxes follow the line hand -> attach point (we test a tall thin box around its middle third)
      S.forEach((s, i) => { const a = this.attach(s), hx = this.hx + s.fx, top = this.hy + 40; const pt = this.sparts[i];
        pt.off = s.cut || this.mst === 'fallen'; const y0 = top + (a[1] - top) * 0.4, k = 0.7; pt.box = { x: lerp(hx, a[0], k) - 30, y: y0, w: 60, h: a[1] - y0 }; });
      this.body.off = this.mst === 'fallen'; this.body.box = { x: this.mx - 110, y: this.FY - 420 - this.mjump, w: 220, h: 420 };
      if (this.mst !== 'fallen') {  // ---- phase 1: the marionette fights, the hand hovers over it
        this.hx = approach(this.hx, this.mx, 700 * dt); this.hy = approach(this.hy, 2.4 * TILE + Math.sin(this.t * 2) * 15, 300 * dt);
        this.mt += dt; const dx = p.cx - this.mx; this.mface = sign(dx) || 1;
        switch (this.mst) {
          case 'idle': this.mx = approach(this.mx, clamp(p.cx - this.mface * 260, 4 * TILE, 32 * TILE), 160 * sp * dt);
            if (this.mt > 1.3 / sp) { const o = []; if (has('sword')) o.push('swing_w', 'swing_w'); if (has('legs')) o.push('leap_w', 'stomp_w'); if (has('shield')) o.push('bash_w'); if (!o.length) o.push('stomp_w');
              this.mst = pick(o); this.mt = 0; if (this.mst === 'swing_w') this.warn('rect', { x: this.mface > 0 ? this.mx : this.mx - 420, y: this.FY - 300, w: 420, h: 300, c: [255, 110, 70] }, 0.8 / sp); } break;
          case 'swing_w': if (this.mt > 0.8 / sp) { this.mst = 'swing'; this.mt = 0; G.Sound.sfx('slash', { pitch: 0.5 }); G.FX.slash(this.mx + this.mface * 220, this.FY - 160, 'side', this.mface, { big: 3.2, dur: 0.25 }); } break;
          case 'swing': this.hazard({ x: this.mface > 0 ? this.mx : this.mx - 420, y: this.FY - 300, w: 420, h: 300 }, dt * 1.5); if (this.mt > 0.35) { this.mst = 'idle'; this.mt = 0; } break;
          case 'bash_w': if (this.mt > 0.55 / sp) { this.mst = 'bash'; this.mt = 0; this.mvx = this.mface * 900; } break;
          case 'bash': this.mx = clamp(this.mx + this.mvx * dt, 3 * TILE, 33 * TILE); this.hazard({ x: this.mx - 140, y: this.FY - 330, w: 280, h: 330 }, dt * 1.5); if (this.mt > 0.45) { this.mst = 'idle'; this.mt = 0; } break;
          case 'stomp_w': if (this.mt < 0.02) this.warn('lane', { y: this.FY - 30, h: 60, c: [255, 120, 60] }, 0.8 / sp); if (this.mt > 0.8 / sp) { this.mst = 'stomp'; this.mt = 0; G.Sound.sfx('boss_slam'); G.FX.shake(14, 0.3);
              for (const d of [-1, 1]) fireball(this.mx + d * 100, this.FY - 22, d * 600, 0, { r: 20, life: 2, ghost: true, c: [220, 200, 170] }); } break;
          case 'stomp': if (this.mt > 0.6) { this.mst = 'idle'; this.mt = 0; } break;
          case 'leap_w': if (this.mt < 0.02) { this.ltx = clamp(p.cx, 4 * TILE, 32 * TILE); this.warn('col', { x: this.ltx, w: 260, c: [255, 120, 60] }, 1.1 / sp); } if (this.mt > 0.5 / sp) { this.mst = 'leap'; this.mt = 0; this.lx0 = this.mx; } break;
          case 'leap': { const k = Math.min(1, this.mt / (0.7 / sp)); this.mx = lerp(this.lx0, this.ltx, k); this.mjump = Math.sin(k * Math.PI) * 380;
            if (k >= 1) { this.mjump = 0; this.mst = 'stomp'; this.mt = 0; G.Sound.sfx('boss_slam'); G.FX.shake(18, 0.4); this.hazard({ x: this.mx - 150, y: this.FY - 200, w: 300, h: 200 }, 0.15);
              for (const d of [-1, 1]) fireball(this.mx + d * 100, this.FY - 22, d * 650, 0, { r: 20, life: 2, ghost: true, c: [220, 200, 170] }); } break; }
        }
        if (this.mst !== 'swing' && this.mst !== 'bash' && this.mst !== 'leap') this.hazard({ x: this.mx - 60, y: this.FY - 400 - this.mjump, w: 120, h: 220 }, dt * 1.5);
      } else {  // ---- phase 2/3: the hand itself
        this.mul = this.state === 'rest' ? 1.3 : 1;
        switch (this.state) {
          case 'wait': case 'idle': this.hx = approach(this.hx, clamp(p.cx, 5 * TILE, 31 * TILE), 500 * dt); this.hy = approach(this.hy, 3 * TILE + Math.sin(this.t * 2) * 30, 500 * dt);
            if (this.st > 1.1 / sp) { const o = ['snip', 'grab', 'grab', 'threads']; let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n); } break;
          case 'snip': if (this.st < 0.02) { this.ly = [this.FY - 45, this.FY - 175, this.FY - 300].filter(() => Math.random() < 0.67).slice(0, 2); if (!this.ly.length) this.ly = [this.FY - 45]; this.ly.forEach(y => this.warn('lane', { y, h: 60, c: [255, 90, 90] }, 0.85 / sp)); }
            if (this.st > 0.85 / sp && this.st < 1.1 / sp) { this.ly.forEach(y => this.hazard({ x: 0, y: y - 30, w: 36 * TILE, h: 60 }, dt * 1.5)); if (this.st - dt <= 0.85 / sp) G.Sound.sfx('slash', { pitch: 1.4 }); }
            if (this.st > 1.5) this.set('idle'); break;
          case 'grab': if (this.st < 0.02) { this.side = p.cx < 18 * TILE ? 1 : -1; this.warn('lane', { y: this.FY - 70, h: 140, c: [255, 110, 70] }, 1.0 / sp); }
            if (this.st < 1.0 / sp) { this.hx = approach(this.hx, this.side > 0 ? 34 * TILE : 2 * TILE, 2500 * dt); this.hy = approach(this.hy, this.FY - 80, 1600 * dt); }
            else { this.hx -= this.side * 1300 * sp * dt; this.hazard({ x: this.hx - 130, y: this.FY - 150, w: 260, h: 150 }, dt * 1.5); if (this.phase > 2) this.hazard({ x: this.hx - 30, y: this.FY - 40, w: 60, h: 40 }, 2, { delay: 0.2 });
              if (this.hx < 2 * TILE || this.hx > 34 * TILE) this.set('rest'); } break;
          case 'rest': this.hy = approach(this.hy, this.FY - 90, 900 * dt); if (this.st > 1.4) this.set('idle'); break;  // punish window
          case 'threads': if (this.st < 0.02) { this.tx_ = [p.cx, p.cx - 260, p.cx + 260, rand(3, 33) * TILE]; this.tx_.forEach(x => this.warn('col', { x, w: 70, c: [255, 240, 220] }, 0.8 / sp)); }
            if (this.st > 0.8 / sp && this.st < 1.25 / sp) this.tx_.forEach(x => this.hazard({ x: x - 35, y: 0, w: 70, h: this.FY }, dt * 1.5));
            if (this.st > 1.6) this.set('idle'); break;
        }
        if (this.state !== 'rest' && this.state !== 'grab') this.hazard({ x: this.hx - 100, y: this.hy - 70, w: 200, h: 140 }, dt * 1.5);
      }
      G.FX.light(this.hx, this.hy, 420, [255, 230, 200], 0.7);
    }
    draw(ctx, t) {
      const c = ctx; this.drawTel(c, t); const fallen = this.mst === 'fallen';
      // strings
      for (const s of this.strings) { if (s.cut && !fallen) { continue; } if (fallen) continue; const a = this.attach(s);
        c.strokeStyle = 'rgba(240,232,215,0.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(this.hx + s.fx, this.hy + 40); c.lineTo(a[0], a[1]); c.stroke(); }
      // marionette knight
      const my = this.FY - this.mjump;
      this.img(fallen ? 'marionette_fallen' : 'marionette', this.mx, my, 300, 440, fallen ? 0 : this.mst === 'swing' ? this.mface * 0.15 : Math.sin(this.t * 3) * 0.04, (c) => {
        c.fillStyle = '#4a4048'; c.fillRect(-80, fallen ? -120 : -380, 160, fallen ? 120 : 300); c.fillStyle = '#c9b89a'; if (!fallen) { c.beginPath(); c.arc(0, -400, 45, 0, 7); c.fill(); }
        if (!fallen && !this.strings[1].cut) { c.fillStyle = '#9aa6b2'; c.fillRect(this.mface * 90 - 8, -360, 16, 260); } }, { ctx: c, pivot: [0.5, 1], flip: this.mface < 0 });
      // the hand
      this.img('hand', this.hx, this.hy, 300, 230, Math.sin(this.t * 1.5) * 0.06, (c) => {
        c.fillStyle = this.flash > 0.3 ? '#fff' : this.phase > 2 ? '#d87a3a' : '#e8dccb'; c.beginPath(); c.ellipse(0, -10, 110, 75, 0, 0, 7); c.fill();
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-70 + i * 46, 70, 17, 48, 0, 0, 7); c.fill(); } c.beginPath(); c.ellipse(-120, 0, 20, 50, 0.6, 0, 7); c.fill(); }, { ctx: c });
      if (this.phase > 2 && !this.dead) G.FX.flame(c, this.hx, this.hy - 80, 7, t, { glow: 0.8 });
    }
  }

  // ======================================================================================
  // T05 — THE DIRECTOR: hides in the shadows (invulnerable). Stage trick: spotlight consoles at both wings — tap ↑ to
  // point the spotlight at him: stunned for a moment, vulnerable while lit. Phase 2: scene change (trapdoors, sandbags).
  // Phase 3: he becomes a giant shadow on the back curtain; the spotlight burns the shadow.
  // ======================================================================================
  class Director extends Giant {
    constructor(tx, ty) {
      super('director', tx, ty, { w: 120, h: 300, maxHp: 150, glowC: [255, 245, 220], phases: [0.6, 0.3] });
      this.dx = tx * TILE; this.lit = 0; this.cons = [{ x: 7 * TILE, y: this.FY }, { x: 29 * TILE, y: this.FY }]; this.beam = 0;
    }
    hurtbox() { if (this.dead || !this.active) return null; if (this.phase > 2) return { x: 18 * TILE - 260, y: this.FY - 640, w: 520, h: 460 }; return { x: this.dx - 70, y: this.FY - 300, w: 140, h: 300 }; }
    hitboxes() { return []; }
    onPhase(ph) { G.FX.flash('#000', 0.7, 0.8); this.lit = 0; this.set('idle'); G.UI.toast(G.T(ph === 2 ? 'scene2' : 'scene3'), 2); }
    update(dt, room, p) {
      this.common(dt); this.tick(dt); this.x = this.dx - this.w / 2; this.y = this.FY - this.h;
      if (this.dead) { this.deathFX(dt); this.tel = []; this.haz = []; return; }
      if (!this.active) return;
      const sp = 1 + (this.phase - 1) * 0.2; this.lit = Math.max(0, this.lit - dt); this.invuln = this.lit <= 0;
      for (const c of this.cons) if (this.useDevice(c, dt, 0)) { c.cd = 7; this.lit = 4.5; this.stun = 0.7; G.Sound.sfx('ability', { pitch: 1.4, vol: 0.6 }); G.FX.flash('#fff6dd', 0.25, 0.3); }
      if (this.phase > 2 && this.lit > 0) { this.hp -= 2.2 * dt; if (this.hp <= 0) this.die(); }  // the light burns the shadow
      this.stun = Math.max(0, (this.stun || 0) - dt); if (this.stun > 0) return;
      const tx = this.phase > 2 ? 18 * TILE : clamp(p.cx + (p.cx < 18 * TILE ? 380 : -380), 5 * TILE, 31 * TILE);
      this.dx = approach(this.dx, tx, (this.state === 'idle' ? 150 : 60) * dt);
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle': if (this.st > 1.3 / sp) { const o = ['pages', 'shout']; if (this.phase > 1) o.push('trap', 'bags'); if (this.phase > 2) o.push('hands', 'hands'); if (Math.abs(p.cx - this.dx) < 200 && this.phase < 3) o.push('baton');
            let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n); } break;
        case 'pages': if (this.st > 0.4 && !this.k) { this.k = 1; G.Sound.sfx('swoop', { pitch: 1.5 });
            for (let i = 0; i < 4 + this.phase; i++) G.Objects.spawnProj({ x: this.dx, y: this.FY - 250, vx: rand(-350, 350), vy: rand(-450, -150), r: 13, life: 4.5, dmg: 1, c: [245, 240, 225],
              update: (pr, d) => { if (pr.t > 0.8) { const a = Math.atan2(P().cy - pr.y, P().cx - pr.x); pr.vx = approach(pr.vx, Math.cos(a) * 330, 600 * d); pr.vy = approach(pr.vy, Math.sin(a) * 330, 600 * d); } else pr.vy += 600 * d; },
              draw: (c, pr) => { c.save(); c.translate(pr.x, pr.y); c.rotate(pr.t * 7); c.fillStyle = '#f4efe2'; c.fillRect(-11, -14, 22, 28); c.fillStyle = '#8a8070'; c.fillRect(-7, -8, 14, 2); c.fillRect(-7, -2, 14, 2); c.restore(); } }); }
          if (this.st > 1.4) { this.k = 0; this.set('idle'); } break;
        case 'shout': if (this.st < 0.02) { this.sy = Math.random() < 0.5 ? this.FY - 50 : this.FY - 190; this.warn('lane', { y: this.sy, h: 90, c: [255, 230, 180] }, 0.85 / sp); }
          if (this.st > 0.85 / sp && this.st < 1.3 / sp) { this.hazard({ x: 0, y: this.sy - 45, w: 36 * TILE, h: 90 }, dt * 1.5); if (this.st - dt <= 0.85 / sp) { G.Sound.sfx('boss_roar', { pitch: 1.5 }); G.FX.ring(this.dx, this.sy, 20, 1400, [255, 235, 190], 0.5, 10); } }
          if (this.st > 1.7) this.set('idle'); break;
        case 'baton': if (this.st < 0.02) this.warn('circle', { x: this.dx, y: this.FY - 120, r: 230, c: [255, 120, 80] }, 0.5); if (this.st > 0.5 && this.st < 0.7) this.hazard({ x: this.dx - 230, y: this.FY - 260, w: 460, h: 260 }, dt * 1.5); if (this.st > 1) this.set('idle'); break;
        case 'trap': if (this.st < 0.02) { this.traps = [4, 11, 18, 25].filter(() => Math.random() < 0.6).map(x => x + randi(0, 3)); if (!this.traps.length) this.traps = [Math.round(p.cx / TILE) - 2]; this.traps.forEach(x => this.warn('rect', { x: x * TILE, y: this.FY - 30, w: 5 * TILE, h: 30, c: [255, 80, 60] }, 1.0 / sp)); }
          if (this.st > 1.0 / sp && this.st < 3.2) this.traps.forEach(x => this.hazard({ x: x * TILE, y: this.FY - 12, w: 5 * TILE, h: 12 }, dt * 1.5, { draw: (c, h) => { c.fillStyle = '#05030a'; c.fillRect(h.box.x, this.FY - 4, h.box.w, 8); } }));
          if (this.st > 3.4) this.set('idle'); break;
        case 'bags': if (this.st > this.k * 0.35 && this.k < 4 + this.phase) { this.k = (this.k || 0) + 1; const x = clamp(p.cx + rand(-200, 200), 2 * TILE, 34 * TILE); this.warn('col', { x, w: 100, c: [255, 160, 90] }, 0.7);
            fireball(x, this.FY - 900, 0, 0, { r: 26, life: 3, ghost: true, hold: true, c: [190, 160, 120], light: null, wait: 0.7, update: (pr) => { if (pr.t > pr.wait) { pr.hold = false; pr.vy = 1300; } if (pr.y > this.FY - 26) { pr.t = 99; G.FX.shake(6, 0.15); } },
              draw: (c, pr) => { c.strokeStyle = '#b9ab90'; c.beginPath(); c.moveTo(pr.x, pr.y - 900); c.lineTo(pr.x, pr.y - 26); c.stroke(); c.fillStyle = '#8a7656'; c.beginPath(); c.ellipse(pr.x, pr.y, 24, 30, 0, 0, 7); c.fill(); } }); }
          if (this.st > 3) { this.k = 0; this.set('idle'); } break;
        case 'hands': if (this.st < 0.02) { this.hy_ = Math.random() < 0.5 ? this.FY - 60 : this.FY - 200; this.side = Math.random() < 0.5 ? 1 : -1; this.warn('lane', { y: this.hy_, h: 120, c: [120, 90, 160] }, 1.0 / sp); }
          if (this.st > 1.0 / sp) { this.hxp = (this.hxp ?? (this.side > 0 ? -3 * TILE : 39 * TILE)) + this.side * 1500 * dt; this.hazard({ x: this.hxp - 160, y: this.hy_ - 60, w: 320, h: 120 }, dt * 1.5);
            if (this.hxp < -4 * TILE || this.hxp > 40 * TILE) { this.hxp = null; this.set('idle'); } } break;
      }
      G.FX.light(this.dx, this.FY - 200, this.lit > 0 ? 520 : 160, [255, 245, 220], this.lit > 0 ? 1 : 0.4);
    }
    draw(ctx, t) {
      const c = ctx; this.drawTel(c, t);
      for (const k of this.cons) { this.img('console', k.x, k.y - 45, 90, 90, 0, (c) => { c.fillStyle = '#3a3036'; c.fillRect(-40, -40, 80, 80); c.fillStyle = k.cd > 0 ? '#555' : '#ffe8a0'; c.beginPath(); c.arc(0, -10, 18, 0, 7); c.fill(); }, { ctx: c });
        if (!k.cd && this.active && !this.dead) this.wheelPrompt(c, k.x, k.y, 'point'); }
      if (this.lit > 0) { const g = c.createLinearGradient(this.dx, 0, this.dx, this.FY); g.addColorStop(0, 'rgba(255,250,225,0.05)'); g.addColorStop(1, 'rgba(255,250,225,0.35)');
        c.fillStyle = g; c.beginPath(); c.moveTo(this.dx - 30, 0); c.lineTo(this.dx + 30, 0); c.lineTo(this.dx + (this.phase > 2 ? 330 : 170), this.FY); c.lineTo(this.dx - (this.phase > 2 ? 330 : 170), this.FY); c.fill(); }
      if (this.phase > 2) {  // giant shadow on the back curtain
        this.img('shadow', 18 * TILE, this.FY - 420, 700, 620, Math.sin(t * 0.8) * 0.04, (c) => { c.fillStyle = this.lit > 0 ? 'rgba(60,20,30,0.85)' : 'rgba(10,5,15,0.85)'; c.beginPath(); c.ellipse(0, 60, 240, 260, 0, 0, 7); c.fill(); c.beginPath(); c.arc(0, -230, 110, 0, 7); c.fill();
          c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(-40, -240, 14, 0, 7); c.arc(40, -240, 14, 0, 7); c.fill(); }, { ctx: c });
        if (this.state === 'hands' && this.hxp != null) this.img('shadow_hand', this.hxp, this.hy_, 320, 140, 0, (c) => { c.fillStyle = 'rgba(15,8,20,0.9)'; c.beginPath(); c.ellipse(0, 0, 150, 55, 0, 0, 7); c.fill(); }, { ctx: c, flip: this.side < 0 });
      } else {
        const a = this.lit > 0 ? 1 : 0.35;
        this.img('director', this.dx, this.FY, 170, 320, Math.sin(t * 1.4) * 0.03, (c) => { c.fillStyle = this.flash > 0.3 ? '#fff' : '#1e1820'; c.fillRect(-55, -260, 110, 260); c.fillStyle = '#c9b892'; c.beginPath(); c.moveTo(-40, -300); c.lineTo(40, -330); c.lineTo(40, -250); c.lineTo(-40, -270); c.fill(); c.fillStyle = '#fff3c8'; c.beginPath(); c.arc(30, -290, 12, 0, 7); c.fill(); }, { ctx: c, pivot: [0.5, 1], alpha: a });
      }
    }
  }

  // ======================================================================================
  // T02 — THE CLOCKWORK WHALE (flight fight: the hero rides a paper crane, darts on attack, dodge on dash).
  // Phase 1: gear volleys, steam lanes, homing brass fish. Phase 2: the belly opens (weak spot), drifting mines.
  // Phase 3: only the head and heart — it charges across the sky along telegraphed lanes.
  // ======================================================================================
  class Whale extends Giant {
    constructor(tx, ty) {
      super('whale', tx, ty, { w: 360, h: 260, maxHp: 160, glowC: [255, 215, 150], phases: [0.6, 0.3] });
      this.wx = 46 * TILE; this.wy = 8 * TILE; this.ent = 0;
    }
    hurtbox() { if (this.dead || !this.active) return null;
      if (this.phase === 2 && this.state !== 'charge') return { x: this.wx - 140, y: this.wy + 40, w: 280, h: 150 };  // open belly
      return { x: this.wx - 400, y: this.wy - 120, w: 230, h: 240 }; }                                           // head / eye
    hitboxes() { return []; }
    onPhase(ph) { this.mul = ph === 2 ? 1.25 : 1; G.FX.burst(this.wx, this.wy, 60, { speed: 600, life: 1, size: 5, c: [220, 180, 110], kind: 'chunk', g: 900, add: false }); }
    update(dt, room, p) {
      this.common(dt); this.tick(dt); this.x = this.wx - this.w / 2; this.y = this.wy - this.h / 2;
      if (this.dead) { this.deathFX(dt); this.wy += dt * 150; this.tel = []; return; }
      if (!this.active) { this.wx = approach(this.wx, 31 * TILE, 260 * dt); return; }
      const sp = 1 + (this.phase - 1) * 0.2;
      if (this.state !== 'charge' && this.state !== 'charge_w') { this.wx = approach(this.wx, 31 * TILE, 300 * dt); this.wy = approach(this.wy, 8 * TILE + Math.sin(this.t * 0.8) * 3 * TILE, 160 * dt); }
      if (this.state !== 'charge') this.hazard({ x: this.wx - 380, y: this.wy - 160, w: 760, h: 320 }, dt * 1.5);  // body contact
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle': if (this.st > 1.1 / sp) { const o = ['gears', 'steam', 'fish']; if (this.phase > 1) o.push('mines', 'mines'); if (this.phase > 2) o.push('charge_w', 'charge_w');
            let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n); this.k = 0; } break;
        case 'gears': if (this.st > this.k * 0.32 && this.k < 3) { this.k++; G.Sound.sfx('clank', { pitch: 1.3 }); const a0 = Math.atan2(p.cy - this.wy, p.cx - (this.wx - 300));
            for (let i = -2; i <= 2; i++) fireball(this.wx - 300, this.wy, Math.cos(a0 + i * 0.2) * 420, Math.sin(a0 + i * 0.2) * 420, { r: 16, life: 4, ghost: true, c: [220, 180, 100], light: null,
              draw: (c, pr) => { c.save(); c.translate(pr.x, pr.y); c.rotate(pr.t * 8); c.fillStyle = '#b8924e'; for (let j = 0; j < 8; j++) { c.rotate(Math.PI / 4); c.fillRect(-3, -19, 6, 8); } c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill(); c.restore(); } }); }
          if (this.st > 1.5) this.set('idle'); break;
        case 'steam': if (this.st < 0.02) { this.sy = clamp(p.cy, 2 * TILE, 15 * TILE); this.warn('lane', { y: this.sy, h: 110, c: [235, 240, 255] }, 0.9 / sp); }
          if (this.st > 0.9 / sp && this.st < 1.6 / sp) { this.hazard({ x: 0, y: this.sy - 55, w: this.wx - 300, h: 110 }, dt * 1.5); if (Math.random() < 0.9) G.FX.spawn({ x: rand(0, this.wx - 300), y: this.sy + rand(-40, 40), vx: -400, vy: rand(-40, 40), life: 0.4, size: rand(10, 18), kind: 'smoke', c: [235, 240, 255], a: 0.5, drag: 1 }); }
          if (this.st > 2) this.set('idle'); break;
        case 'fish': if (this.st > 0.3 && !this.k) { this.k = 1; for (let i = 0; i < 3 + this.phase; i++) G.Objects.spawnProj({ x: this.wx - 100, y: this.wy + 80, vx: rand(-300, -100), vy: rand(-200, 200), r: 14, life: 5, dmg: 1, c: [220, 180, 100],
              update: (pr, d) => { const a = Math.atan2(P().cy - pr.y, P().cx - pr.x); pr.vx = approach(pr.vx, Math.cos(a) * 300, 420 * d); pr.vy = approach(pr.vy, Math.sin(a) * 300, 420 * d); },
              draw: (c, pr) => { c.save(); c.translate(pr.x, pr.y); c.rotate(Math.atan2(pr.vy, pr.vx)); c.fillStyle = '#c79a52'; c.beginPath(); c.ellipse(0, 0, 18, 9, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-14, 0); c.lineTo(-26, -9 + Math.sin(pr.t * 20) * 3); c.lineTo(-26, 9); c.fill(); c.restore(); } }); }
          if (this.st > 1.6) this.set('idle'); break;
        case 'mines': if (this.st > this.k * 0.4 && this.k < 3) { this.k++; const m = fireball(this.wx, this.wy + 120, rand(-260, -120), rand(-60, 60), { r: 20, life: 3.2, ghost: true, c: [255, 200, 120], light: [255, 190, 90, 120],
              update: (pr) => { pr.vx *= 0.985; pr.vy *= 0.985; if (pr.t > 3.1 && !pr.boom) { pr.boom = 1; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; fireball(pr.x, pr.y, Math.cos(a) * 380, Math.sin(a) * 380, { r: 10, life: 2, ghost: true }); } } } }); }
          if (this.st > 1.8) this.set('idle'); break;
        case 'charge_w': if (this.st < 0.02) { this.cy_ = clamp(p.cy, 3 * TILE, 14 * TILE); this.warn('lane', { y: this.cy_, h: 300, c: [255, 110, 70] }, 1.1); }
          this.wx = approach(this.wx, 46 * TILE, 1800 * dt); this.wy = approach(this.wy, this.cy_, 1200 * dt); if (this.st > 1.1) { this.set('charge'); G.Sound.sfx('boss_roar', { pitch: 0.6 }); } break;
        case 'charge': this.wx -= 1500 * dt; this.hazard({ x: this.wx - 380, y: this.wy - 150, w: 760, h: 300 }, dt * 1.5);
          if (this.wx < -10 * TILE) { this.wx = 50 * TILE; this.wy = 8 * TILE; this.set('idle'); } break;
      }
      G.FX.light(this.wx - 250, this.wy, 500, [255, 215, 150], 0.7);
    }
    draw(ctx, t) {
      const c = ctx; this.drawTel(c, t); const ph = this.phase;
      this.img(ph === 3 ? 'head' : ph === 2 ? 'body_open' : 'body', this.wx, this.wy, 820, 420, Math.sin(this.t * 0.8) * 0.04, (c) => {
        c.fillStyle = this.flash > 0.3 ? '#fff' : '#6b5032'; if (ph < 3) { c.beginPath(); c.ellipse(0, 0, 400, 170, 0, 0, 7); c.fill(); } else { c.beginPath(); c.ellipse(-260, 0, 170, 150, 0, 0, 7); c.fill(); }
        c.fillStyle = '#c79a52'; c.beginPath(); c.arc(-300, -40, 26, 0, 7); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(-300, -40, 12, 0, 7); c.fill();
        if (ph === 2) { c.fillStyle = '#ffcf7a'; c.beginPath(); c.ellipse(0, 100, 130, 60, 0, 0, 7); c.fill(); }
        if (ph === 3) { c.fillStyle = '#ff9a4a'; c.beginPath(); c.arc(-120, 20, 40 + Math.sin(t * 8) * 5, 0, 7); c.fill(); } }, { ctx: c });
      if (ph < 3) for (let i = 0; i < 2; i++) if (Math.random() < 0.4) G.FX.spawn({ x: this.wx + 80 + i * 90, y: this.wy - 170, vx: rand(-20, 20), vy: -120, life: 1, size: 12, kind: 'smoke', c: [90, 85, 90], a: 0.4 });
    }
  }

  const K = { waxmother: WaxMother, lanternqueen: LanternQueen, puppeteer: Puppeteer, director: Director, whale: Whale };
  return { has: k => !!K[k], create: (k, tx, ty) => new K[k](tx, ty), Part, Giant };
})();
