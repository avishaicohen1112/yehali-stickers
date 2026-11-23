'use strict';
// Five bosses
G.Bosses = (function () {
  class Boss {
    constructor(kind, tx, ty, o) {
      this.kind = kind; Object.assign(this, o);
      this.x = tx * TILE - this.w / 2; this.y = ty * TILE - this.h; this.hx = this.x; this.hy = this.y;
      this.hp = this.maxHp; this.vx = 0; this.vy = 0; this.facing = -1; this.t = 0; this.st = 0; this.state = 'wait';
      this.flash = 0; this.dead = false; this.deadT = 0; this.active = false; this.phase = 1; this.anim = 'idle'; this.animT = 0;
      this.isBoss = true; this.noSoul = false; this.hits = []; this.alpha = 1; this.lastAtk = '';
    }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    set(state) { this.state = state; this.st = 0; }
    setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }
    hurtbox() { if (this.dead || !this.active || this.alpha < 0.5 || this.hidden) return null; return { x: this.x + this.w * 0.1, y: this.y + this.h * 0.08, w: this.w * 0.8, h: this.h * 0.9 }; }
    hitboxes() { if (this.dead || !this.active || this.alpha < 0.5 || this.hidden) return []; return [{ x: this.x + this.w * 0.15, y: this.y + this.h * 0.15, w: this.w * 0.7, h: this.h * 0.8 }]; }
    hurt(dmg, dx, dy) {
      if (this.dead || !this.active) return false;
      this.hp -= dmg; this.flash = 1; G.Sound.sfx('hit', { pitch: rand(0.75, 0.9) });
      if (this.onHurt) this.onHurt(dmg);
      const pr = this.hp / this.maxHp;
      for (const th of this.phases || [0.5]) { if (pr <= th && this.phase <= (this.phases || [0.5]).indexOf(th) + 1) { this.phase++; this.onPhase && this.onPhase(this.phase); G.Sound.sfx('boss_roar'); G.FX.shake(16, 0.6); G.FX.flash('#fff', 0.25, 0.4); } }
      if (this.hp <= 0) this.die();
      return true;
    }
    die() {
      this.dead = true; this.deadT = 0; this.hp = 0; G.Sound.sfx('boss_die'); G.Sound.music(null);
      G.FX.stop(0.5); G.FX.shake(25, 1.6); G.FX.flash('#ffffff', 0.9, 1.2);
      G.Main.onBossDeath(this);
    }
    faceP(p) { this.facing = sign(p.cx - this.cx) || this.facing; }
    gravity(dt, room, g = 2600) { this.vy = Math.min(this.vy + g * dt, 1400); const h = room.moveY(this, this.vy * dt); if (h > 0) { this.vy = 0; } this.ground = room.onGroundAt(this); return h; }
    deathFX(dt) {
      this.deadT += dt;
      if (this.deadT < 2.2 && Math.random() < 0.5) { G.FX.burst(this.cx + rand(-this.w / 2, this.w / 2), this.cy + rand(-this.h / 2, this.h / 2), 8, { speed: 400, life: 0.7, size: 3, c: this.glowC || [255, 170, 90], kind: 'ember' }); }
      if (this.deadT < 2.2 && Math.random() < 0.2) { G.FX.ring(this.cx + rand(-60, 60), this.cy + rand(-60, 60), 10, 140, this.glowC || [255, 170, 90], 0.5, 6); G.FX.shake(8, 0.2); }
    }
    sprite(ctx, o = {}) {
      const at = 'b_' + this.kind;
      if (window.RIGS && window.RIGS[at]) {
        if (!this.pup) this.pup = new G.Puppet.Puppet(at);
        const R = window.RIGS[at]; this.pup.play(R.clips[this.anim] ? this.anim : 'idle');
        this.pup.update(1 / 60, { vx: this.vx, vy: this.vy, facing: o.facing ?? this.facing });
        const a = this.dead ? Math.max(0, 1 - Math.max(0, this.deadT - 1.6) * 1.2) : this.alpha;
        this.pup.draw(ctx, (o.x ?? this.cx) + (o.shake || 0), o.y ?? (this.y + this.h), { flip: (o.facing ?? this.facing) < 0, alpha: a * (o.alpha ?? 1), flash: Math.max(this.flash * 0.7, this.dead ? Math.min(1, this.deadT) * 0.6 : 0) });
        return true;
      }
      const m = G.Sprite.meta(at); if (!m) return false;
      const an = m.anims[this.anim] ? this.anim : 'idle';
      const fi = G.Sprite.frameOf(at, an, this.animT, o.loop);
      const a = this.dead ? Math.max(0, 1 - Math.max(0, this.deadT - 1.6) * 1.2) : this.alpha;
      G.Sprite.draw(ctx, at, an, fi, (o.x ?? this.cx) + (o.shake || 0), o.y ?? (this.y + this.h), { flip: (o.facing ?? this.facing) < 0, alpha: a * (o.alpha ?? 1), flash: Math.max(this.flash * 0.7, this.dead ? Math.min(1, this.deadT) * 0.6 : 0), ppu: m.ppu || 50, scale: o.scale, rot: o.rot });
      return true;
    }
    blob(ctx, col) { // fallback
      ctx.save(); ctx.globalAlpha = this.dead ? Math.max(0, 1 - this.deadT * 0.5) : this.alpha; ctx.fillStyle = this.flash > 0.2 ? '#fff' : col;
      ctx.beginPath(); ctx.ellipse(this.cx, this.cy, this.w / 2, this.h / 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.cx + this.facing * this.w * 0.2, this.y + this.h * 0.25, 8, 0, 7); ctx.fill(); ctx.restore();
    }
    common(dt) { this.t += dt; this.st += dt; this.animT += dt; this.flash = Math.max(0, this.flash - dt * 5); }
  }

  // ================= 1. TALLOW KNIGHT =================
  class Knight extends Boss {
    constructor(tx, ty) { super('knight', tx, ty, { w: 120, h: 190, maxHp: 24, glowC: [255, 160, 70], phases: [0.5] }); this.arenaL = TILE * 1; this.arenaR = TILE * 35; }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.gravity(dt, room); this.setAnim('death'); return; }
      const sp = this.phase > 1 ? 1.25 : 1;
      if (this.pending) { for (const p of this.pending) { p.t -= dt; if (p.t <= 0) p.f(); } this.pending = this.pending.filter(p => p.t > 0); }
      if (!this.active) { this.setAnim('idle'); this.gravity(dt, room); return; }
      const dx = p.cx - this.cx, adx = Math.abs(dx);
      this.hits = [];
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle':
          this.setAnim('walk'); this.faceP(p); this.vx = this.facing * 90 * sp;
          if (this.st > (this.phase > 1 ? 0.45 : 0.8)) {
            const opts = adx < 240 ? ['swing', 'swing', 'leap'] : ['charge', 'leap', 'charge'];
            let n = pick(opts); if (n === this.lastAtk && Math.random() < 0.6) n = pick(opts); this.lastAtk = n; this.set(n + '_w'); this.vx = 0;
          } break;
        case 'charge_w': this.setAnim('windup'); this.vx = 0; this.faceP(p); if (this.st > 0.55 / sp) { this.set('charge'); G.Sound.sfx('boss_roar', { vol: 0.5, pitch: 1.3 }); } break;
        case 'charge':
          this.setAnim('charge'); this.vx = this.facing * 760 * sp;
          if (Math.random() < 0.5) G.FX.spawn({ x: this.cx - this.facing * 40, y: this.y + this.h, vx: -this.facing * 100, vy: -60, life: 0.6, size: 12, kind: 'smoke', c: [70, 55, 45], a: 0.45 });
          this.hits.push({ x: this.x, y: this.y + 30, w: this.w, h: this.h - 30 });
          if (room.wallAhead(this, this.facing) || this.st > 2.2) { this.set('stun'); this.vx = -this.facing * 200; this.vy = -300; G.Sound.sfx('boss_slam'); G.FX.shake(14, 0.4); G.FX.burst(this.facing > 0 ? this.x + this.w : this.x, this.cy, 20, { speed: 400, life: 0.6, size: 4, c: [90, 80, 70], kind: 'chunk', g: 1400, add: false }); if (this.phase > 1) this.drips(room, 4); }
          break;
        case 'stun': this.setAnim('stun'); this.vx = approach(this.vx, 0, 800 * dt); if (this.st > 0.9 / sp) this.set('idle'); break;
        case 'swing_w': this.setAnim('windup2'); this.vx = 0; this.faceP(p); if (this.st > 0.5 / sp) { this.set('swing'); G.Sound.sfx('slash', { pitch: 0.55 }); G.FX.slash(this.cx + this.facing * 110, this.cy, 'side', this.facing, { big: 2.4, dur: 0.25, c: [255, 190, 120] }); } break;
        case 'swing': this.setAnim('swing'); if (this.st < 0.18) this.hits.push({ x: this.facing > 0 ? this.cx : this.cx - 270, y: this.y - 20, w: 270, h: this.h + 20 }); if (this.st > 0.5) this.set(this.phase > 1 && Math.random() < 0.5 ? 'leap_w' : 'idle'); break;
        case 'leap_w': this.setAnim('crouch'); this.vx = 0; this.faceP(p); if (this.st > 0.45 / sp) {
          this.set('leap'); const T = 1.0; const tx = clamp(p.cx, this.arenaL + 100, this.arenaR - 100); this.vx = (tx - this.cx) / T; this.vy = -1300; G.Sound.sfx('jump', { pitch: 0.5, vol: 1.5 }); } break;
        case 'leap': this.setAnim('jump'); this.hits.push({ x: this.x + 10, y: this.y + 10, w: this.w - 20, h: this.h - 10 });
          if (this.ground && this.st > 0.2) { this.set('slam'); this.vx = 0; G.Sound.sfx('boss_slam'); G.FX.shake(20, 0.5);
            for (const d of [-1, 1]) this.wave(room, d, sp);
            G.FX.burst(this.cx, this.y + this.h, 30, { speed: 500, life: 0.7, size: 14, c: [80, 70, 60], kind: 'smoke', angle: -Math.PI / 2, spread: 1.5, add: false });
            if (this.phase > 1) this.drips(room, 6); }
          break;
        case 'slam': this.setAnim('slam'); if (this.st > 0.7 / sp) this.set('idle'); break;
      }
      room.moveX(this, this.vx * dt); this.gravity(dt, room, 2800);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      G.FX.light(this.cx, this.y + 40, 380, [255, 170, 90], 1);
    }
    wave(room, d, sp) {
      const y = this.y + this.h;
      G.Objects.spawnProj({ x: this.cx + d * 60, y: y - 34, vx: d * 620 * sp, vy: 0, r: 30, life: 2.2, dmg: 1, ghost: true, c: [255, 150, 70],
        update: (pr, dt) => { if (room.solidAt(pr.x + sign(pr.vx) * 30, pr.y)) pr.t = 99; if (Math.random() < 0.8) G.FX.spawn({ x: pr.x, y: y - rand(0, 50), vx: rand(-40, 40), vy: rand(-260, -120), life: 0.5, size: rand(2, 4), kind: 'ember', c: [255, 150, 60], add: true }); },
        draw: (c, pr, t) => { G.FX.glow(c, pr.x, y - 30, 80, [255, 140, 60], 0.9); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, y, 0, y - 80); g.addColorStop(0, 'rgba(255,200,120,0.9)'); g.addColorStop(1, 'rgba(255,90,30,0)'); c.fillStyle = g;
          c.beginPath(); c.moveTo(pr.x - 30, y); c.quadraticCurveTo(pr.x - 10 * sign(pr.vx), y - 90 - Math.sin(t * 30) * 10, pr.x + 30 * sign(pr.vx), y); c.fill(); c.restore(); } });
    }
    drips(room, n) {
      this.pending = this.pending || [];
      for (let i = 0; i < n; i++) {
        const x = rand(this.arenaL + 60, this.arenaR - 60);
        this.pending.push({ t: i * 0.18 + rand(0, 0.2), f: () => { if (this.dead) return; G.Objects.spawnProj({ x, y: TILE * 1.2, vx: 0, vy: 0, g: 1600, r: 16, life: 3, dmg: 1, c: [255, 225, 180], light: [255, 200, 140, 120],
          draw: (c, pr) => { c.fillStyle = '#efe0c8'; c.beginPath(); c.moveTo(pr.x, pr.y - 26); c.bezierCurveTo(pr.x + 13, pr.y - 4, pr.x + 12, pr.y + 12, pr.x, pr.y + 12); c.bezierCurveTo(pr.x - 12, pr.y + 12, pr.x - 13, pr.y - 4, pr.x, pr.y - 26); c.fill(); } });
          G.FX.burst(x, TILE * 1.2, 6, { speed: 100, life: 0.5, size: 3, c: [200, 180, 160], kind: 'chunk', g: 800, add: false }); } });
      }
    }
    draw(ctx, t) { if (!this.sprite(ctx, { shake: this.state.endsWith('_w') ? Math.sin(t * 70) * 3 : 0 })) this.blob(ctx, '#3a2a22'); }
  }

  // ================= 2. MOTHER MORROW (moth) =================
  class Moth extends Boss {
    constructor(tx, ty) { super('moth', tx, ty, { w: 170, h: 150, maxHp: 28, glowC: [190, 240, 255], phases: [0.5] }); this.y -= 300; this.hy = this.y; }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.vy += 600 * dt; room.moveY(this, this.vy * dt); this.setAnim('death'); return; }
      if (!this.active) { this.setAnim('idle'); this.y = this.hy + Math.sin(this.t) * 20; return; }
      const sp = this.phase > 1 ? 1.25 : 1; this.hits = [];
      const ceil = TILE * 2.5, floor = TILE * 15;
      switch (this.state) {
        case 'wait': this.set('hover'); break;
        case 'hover': {
          this.setAnim('idle'); this.faceP(p);
          const tx = p.cx - this.w / 2 + Math.sin(this.t * 0.9) * 260, ty = ceil + 60 + Math.sin(this.t * 1.7) * 50;
          this.vx = approach(this.vx, (tx - this.x) * 2.2, 1500 * dt); this.vy = approach(this.vy, (ty - this.y) * 2.2, 1500 * dt);
          if (this.st > (this.phase > 1 ? 0.9 : 1.4)) {
            const live = G.Main.enemies().filter(e => !e.isBoss && !e.dead).length;
            const opts = ['dive', 'dive', 'dust', 'sweep']; if (live < 2) opts.push('summon');
            let n = pick(opts); if (n === this.lastAtk) n = pick(opts); this.lastAtk = n; this.set(n + '_w');
          } break; }
        case 'dive_w': this.setAnim('windup'); this.vx *= 0.9; this.vy = approach(this.vy, -120, 1200 * dt); this.faceP(p); this.tgt = { x: p.cx, y: p.cy };
          if (this.st > 0.6 / sp) { this.set('dive'); const a = Math.atan2(this.tgt.y - this.cy, this.tgt.x - this.cx); this.vx = Math.cos(a) * 1150 * sp; this.vy = Math.sin(a) * 1150 * sp; G.Sound.sfx('swoop', { pitch: 0.6 }); } break;
        case 'dive': this.setAnim('dive'); this.hits.push(this.body());
          if (Math.random() < 0.8) G.FX.spawn({ x: this.cx + rand(-40, 40), y: this.cy + rand(-30, 30), vx: -this.vx * 0.1, vy: -this.vy * 0.1, life: 0.8, size: rand(2, 3), kind: 'mote', ph: rand(6), c: [220, 240, 255], a: 1, add: true });
          if (this.st > 0.9 || this.y + this.h > floor - 10 || this.x < TILE * 2 || this.x + this.w > TILE * 38) { this.set('recover'); this.vy = -200; } break;
        case 'recover': this.setAnim('idle'); this.vx = approach(this.vx, 0, 1500 * dt); this.vy = approach(this.vy, -300, 1500 * dt); if (this.st > 0.6) this.set('hover'); break;
        case 'dust_w': this.setAnim('windup'); this.vx *= 0.92; this.vy *= 0.92; if (this.st > 0.5) { this.set('dust'); this.k = 0; } break;
        case 'dust': this.setAnim('dust');
          if (this.st > this.k * 0.45 && this.k < (this.phase > 1 ? 3 : 2)) { this.k++; G.Sound.sfx('spore', { pitch: 0.7 });
            const n = this.phase > 1 ? 14 : 11, off = this.k * 0.3;
            for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + off; G.Objects.spawnProj({ x: this.cx, y: this.cy, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: 15, life: 4, dmg: 1, c: [200, 235, 255], light: [180, 220, 255, 90] }); } }
          if (this.st > 1.5) this.set('hover'); break;
        case 'sweep_w': { this.setAnim('idle'); const side = p.cx < TILE * 20 ? 1 : -1; this.sweepSide = side;
          const tx = side > 0 ? TILE * 36 - this.w : TILE * 4, ty = floor - this.h - 20;
          this.vx = approach(this.vx, (tx - this.x) * 3, 2200 * dt); this.vy = approach(this.vy, (ty - this.y) * 3, 2200 * dt);
          if (this.st > 1.1) { this.set('sweep'); this.facing = -side; G.Sound.sfx('swoop', { pitch: 0.5 }); } break; }
        case 'sweep': this.setAnim('dive'); this.vx = this.facing * 900 * sp; this.vy = Math.sin(this.st * 8) * 60; this.hits.push(this.body());
          if ((this.facing < 0 && this.x < TILE * 3) || (this.facing > 0 && this.x + this.w > TILE * 37)) { this.set('recover'); } break;
        case 'summon_w': this.setAnim('windup'); this.vx *= 0.9; this.vy *= 0.9; if (this.st > 0.7) { this.set('hover');
          for (const d of [-1, 1]) { const e = new G.Enemies.Enemy('mothling', (this.cx + d * 120) / TILE, (this.cy + 40) / TILE); e.hx = e.x; e.hy = e.y; e.st = 0.5; G.Main.addEnemy(e); G.FX.burst(e.cx, e.cy, 20, { speed: 200, life: 0.6, size: 3, c: [220, 240, 255], kind: 'mote', add: true }); } } break;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.x = clamp(this.x, TILE * 1, TILE * 39 - this.w); this.y = clamp(this.y, TILE * 1, floor - this.h);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      if (!this.hits.length) G.Main.hitPlayer(this.body(0.5), this.cx);
      G.FX.light(this.cx, this.cy, 520, [200, 235, 255], 1);
      if (Math.random() < 0.3) G.FX.spawn({ x: this.cx + rand(-70, 70), y: this.cy + rand(-30, 50), vx: rand(-20, 20), vy: rand(10, 60), life: 2, size: rand(1.5, 2.5), kind: 'mote', ph: rand(6), c: [210, 240, 255], a: 0.9, add: true });
    }
    body(k = 0.7) { return { x: this.cx - this.w * k / 2, y: this.cy - this.h * k / 2, w: this.w * k, h: this.h * k }; }
    draw(ctx, t) { if (!this.sprite(ctx, { y: this.y + this.h + Math.sin(t * 6) * 4 })) this.blob(ctx, '#cfd8e0'); }
  }

  // ================= 3. THE DROWNED ANGLER =================
  class Angler extends Boss {
    constructor(tx, ty) {
      super('angler', tx, ty, { w: 300, h: 240, maxHp: 30, glowC: [120, 220, 255], phases: [0.5] });
      this.floorY = 16 * TILE + 12; this.hidden = true; this.lure = { x: 22 * TILE, y: 8 * TILE }; this.alpha = 0;
    }
    hurtbox() { if (this.dead || !this.active || this.hidden || this.alpha < 0.6) return null; return { x: this.x + 20, y: this.y + 20, w: this.w - 40, h: this.h - 40 }; }
    update(dt, room, p) {
      this.common(dt); this.dark = this.active && !this.dead ? 0.3 : 0;
      if (this.dead) { this.deathFX(dt); this.y += 80 * dt; this.setAnim('death'); return; }
      const sp = this.phase > 1 ? 1.3 : 1; this.hits = [];
      const lureTarget = { x: p.cx + Math.sin(this.t * 0.7) * 160, y: 7 * TILE + Math.sin(this.t * 1.3) * 60 };
      if (!this.active) { this.lure.x = lerp(this.lure.x, 22 * TILE + Math.sin(this.t * 0.5) * 300, dt); this.lure.y = 8 * TILE + Math.sin(this.t) * 40; G.FX.light(this.lure.x, this.lure.y, 300, [120, 220, 255], 1); return; }
      switch (this.state) {
        case 'wait': this.set('sub'); break;
        case 'sub': this.hidden = true; this.alpha = approach(this.alpha, 0, dt * 3);
          this.lure.x = lerp(this.lure.x, lureTarget.x, dt * 1.2); this.lure.y = lerp(this.lure.y, lureTarget.y, dt * 1.2);
          if (this.st > (this.phase > 1 ? 0.9 : 1.5)) { let n = pick(['lunge', 'snap', 'snap', 'spit']); if (n === this.lastAtk) n = pick(['lunge', 'snap', 'spit']); this.lastAtk = n; this.set(n + '_w');
            if (n === 'lunge') { this.side = p.cx < 22 * TILE ? 1 : -1; this.lunges = this.phase > 1 ? 2 : 1; }
            if (n === 'snap') { this.snapX = p.cx; } } break;
        case 'lunge_w': { // bubbles at entry side
          const ex = this.side > 0 ? 2 * TILE : 34 * TILE;
          if (Math.random() < 0.6) G.FX.spawn({ x: ex + rand(-60, 60), y: this.floorY + 10, vx: 0, vy: rand(-200, -80), life: 0.6, size: rand(3, 6), kind: 'mote', ph: 0, c: [160, 220, 255], a: 1, add: true });
          if (this.st > 0.3 && this.st - dt <= 0.3) G.Sound.sfx('boss_roar', { vol: 0.5, pitch: 0.6 });
          if (this.st > 0.9 / sp) { this.set('lunge'); this.hidden = false; this.facing = this.side; this.x = this.side > 0 ? -this.w : 36 * TILE; this.y = this.floorY - this.h + 40; this.alpha = 1; G.Sound.sfx('splash'); } break; }
        case 'lunge': this.setAnim('lunge'); this.x += this.facing * 1100 * sp * dt; this.hits.push({ x: this.x + 30, y: this.y + 40, w: this.w - 60, h: this.h - 60 });
          if (Math.random() < 0.7) G.FX.burst(this.cx - this.facing * 120, this.floorY, 3, { speed: 300, life: 0.6, size: 3, c: [140, 200, 255], kind: 'spark', g: 900, angle: -Math.PI / 2, spread: 0.7 });
          if ((this.facing > 0 && this.x > 37 * TILE) || (this.facing < 0 && this.x + this.w < 0)) { this.lunges--; if (this.lunges > 0) { this.side = -this.side; this.set('lunge_w'); this.st = 0.5; } else { this.set('sub'); this.hidden = true; this.alpha = 0; } } break;
        case 'snap_w': this.hidden = true; this.lure.x = lerp(this.lure.x, this.snapX, dt * 4); this.lure.y = lerp(this.lure.y, 12 * TILE, dt * 3);
          if (Math.random() < 0.7) G.FX.spawn({ x: this.snapX + rand(-110, 110), y: this.floorY + 10, vx: 0, vy: rand(-220, -80), life: 0.5, size: rand(3, 6), kind: 'mote', ph: 0, c: [160, 220, 255], a: 1, add: true });
          if (this.st > 1.0 / sp) { this.set('snap'); this.hidden = false; this.x = this.snapX - this.w / 2; this.y = this.floorY; this.facing = sign(p.cx - this.snapX) || 1; G.Sound.sfx('boss_slam'); G.Sound.sfx('splash'); G.FX.shake(12, 0.4); } break;
        case 'snap': { this.setAnim('snap'); this.alpha = 1; const k = Math.min(1, this.st / 0.18); this.y = this.floorY - (this.h + 60) * ease.out(k);
          if (this.st < 0.35) this.hits.push({ x: this.x + 30, y: this.y, w: this.w - 60, h: this.h });
          if (this.st > 1.5) { this.y += 900 * dt; this.hidden = this.y > this.floorY - 40; } if (this.st > 1.9) this.set('sub'); break; }
        case 'spit_w': this.hidden = false; this.x = 22 * TILE - this.w / 2; this.facing = sign(p.cx - this.cx) || 1; this.y = lerp(this.y, this.floorY - this.h * 0.75, dt * 4); if (this.st < dt * 2) this.y = this.floorY;
          this.alpha = Math.min(1, this.st * 3); this.setAnim('idle'); if (this.st > 0.8) { this.set('spit'); this.k = 0; } break;
        case 'spit': this.setAnim('spit');
          if (this.st > this.k * 0.35 && this.k < (this.phase > 1 ? 5 : 3)) { this.k++; G.Sound.sfx('splash', { pitch: 1.5 });
            for (let i = 0; i < 3; i++) G.Objects.spawnProj({ x: this.cx + this.facing * 60, y: this.y + 70, vx: (p.cx - this.cx) * 0.8 + rand(-250, 250), vy: rand(-900, -650), g: 1500, r: 16, life: 3, dmg: 1, c: [140, 230, 255], light: [140, 230, 255, 140] }); }
          if (this.st > 2.0) { this.y += 600 * dt; } if (this.st > 2.4) { this.set('sub'); this.hidden = true; } break;
      }
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      if (!this.hidden) { this.lure.x = this.cx + this.facing * 150; this.lure.y = this.y - 30; }
      G.FX.light(this.lure.x, this.lure.y, 360 + Math.sin(this.t * 4) * 30, [120, 220, 255], 1);
    }
    draw(ctx, t) {
      if (!this.hidden && this.alpha > 0.02) { if (!this.sprite(ctx)) this.blob(ctx, '#18242c'); }
      // lure
      const L = this.lure; G.FX.glow(ctx, L.x, L.y, 110, [130, 225, 255], 0.9);
      ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(L.x, L.y, 9 + Math.sin(t * 5) * 1.5, 0, 7); ctx.fill();
      if (this.hidden) { ctx.strokeStyle = 'rgba(30,40,50,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.quadraticCurveTo(L.x + 30, L.y + 200, L.x + 10, this.floorY + 20); ctx.stroke(); }
    }
  }

  // ================= 4. SISTER VESPER =================
  class Vesper extends Boss {
    constructor(tx, ty) { super('vesper', tx, ty, { w: 64, h: 140, maxHp: 34, glowC: [220, 190, 255], phases: [0.5] }); this.clone = null; }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.gravity(dt, room); this.setAnim('death'); return; }
      if (!this.active) { this.setAnim('idle'); this.gravity(dt, room); this.faceP(p); return; }
      const sp = this.phase > 1 ? 1.2 : 1; this.hits = [];
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle': this.setAnim('idle'); this.faceP(p); this.vx = approach(this.vx, 0, 2000 * dt);
          if (this.st > (this.phase > 1 ? 0.35 : 0.6)) { const o = ['lunge', 'lunge', 'blink', 'fan']; if (this.phase > 1) o.push('mirror', 'blink'); let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n + '_w'); } break;
        case 'lunge_w': this.setAnim('ready'); this.faceP(p); if (this.st < 0.05) G.Sound.sfx('shard', { pitch: 2 }); if (this.st > 0.45 / sp) { this.set('lunge'); G.Sound.sfx('dash', { pitch: 0.8 }); } break;
        case 'lunge': this.setAnim('lunge'); this.vx = this.facing * 1450 * sp; this.hits.push({ x: this.x - 20, y: this.y + 30, w: this.w + 40, h: this.h - 40 });
          G.FX.spawn({ x: this.cx, y: this.cy + rand(-40, 40), vx: 0, vy: 0, life: 0.3, size: 2, kind: 'shard', c: [230, 210, 255], rot: rand(6), add: true });
          if (this.st > 0.32 || room.wallAhead(this, this.facing)) { this.set('recover'); this.vx = this.facing * 300; } break;
        case 'recover': this.setAnim('recover'); this.vx = approach(this.vx, 0, 2000 * dt); if (this.st > 0.55 / sp) this.set('idle'); break;
        case 'blink_w': this.setAnim('ready'); this.alpha = Math.max(0, 1 - this.st * 4); if (this.st > 0.3) { this.set('blink'); this.x = clamp(p.cx - this.w / 2, TILE * 2, TILE * 37 - this.w); this.y = Math.max(TILE * 1.5, p.y - 330); this.vy = 0; this.vx = 0; G.Sound.sfx('shard', { pitch: 1.4 }); } break;
        case 'blink': this.setAnim('plunge'); this.alpha = Math.min(1, this.st * 4); this.vy = 0; if (this.st > 0.42 / sp) { this.set('plunge'); this.vy = 1800; } break;
        case 'plunge': this.setAnim('plunge'); this.hits.push({ x: this.x, y: this.y, w: this.w, h: this.h });
          if (this.ground) { this.set('recover'); G.Sound.sfx('boss_slam', { vol: 0.6 }); G.FX.shake(10, 0.3);
            for (const d of [-1, 1]) for (let k = 0; k < (this.phase > 1 ? 2 : 1); k++) G.Objects.spawnProj({ kind: 'shard', x: this.cx, y: this.y + this.h - 20 - k * 40, vx: d * (700 - k * 150), vy: 0, r: 12, life: 2, dmg: 1 }); } break;
        case 'fan_w': this.setAnim('ready'); this.faceP(p); if (this.st < dt * 1.5) { this.vy = -700; this.vx = -this.facing * 350; } if (this.st > 0.4) { this.set('fan'); G.Sound.sfx('shard');
            const a0 = Math.atan2(p.cy - this.cy, p.cx - this.cx); const n = this.phase > 1 ? 7 : 5;
            for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.17; G.Objects.spawnProj({ kind: 'shard', x: this.cx, y: this.cy - 20, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, r: 12, life: 2.5, dmg: 1 }); } } break;
        case 'fan': this.setAnim('throw'); if (this.ground && this.st > 0.2) this.set('idle'); this.vx = approach(this.vx, 0, 600 * dt); break;
        case 'mirror_w': this.setAnim('ready'); if (this.st < dt * 1.5) { this.clone = { x: (this.cx < 20 * TILE ? 34 : 6) * TILE, facing: this.cx < 20 * TILE ? -1 : 1, t: 0 }; G.Sound.sfx('shard', { pitch: 0.8 }); }
          this.faceP(p); if (this.st > 0.6) { this.set('lunge'); G.Sound.sfx('dash', { pitch: 0.7 }); if (this.clone) this.clone.go = true; } break;
      }
      if (this.clone) { const c = this.clone; c.t += dt;
        if (c.go) { c.x += c.facing * 1300 * sp * dt; G.Main.hitPlayer({ x: c.x - 40, y: this.floorY() - this.h + 30, w: 80, h: this.h - 40 }, c.x); }
        if (c.t > 2 || c.x < 0 || c.x > 40 * TILE) this.clone = null; }
      room.moveX(this, this.vx * dt);
      if (this.state === 'blink' || this.state === 'blink_w') { } else this.gravity(dt, room, this.state === 'plunge' ? 0 : 2600);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      G.FX.light(this.cx, this.cy - 30, 300, [220, 190, 255], 1);
    }
    floorY() { return 14 * TILE; }
    draw(ctx, t) {
      if (this.clone) { const c = this.clone; const m = G.Sprite.meta('b_vesper');
        if (m) G.Sprite.draw(ctx, 'b_vesper', c.go ? 'lunge' : 'ready', 0, c.x, this.floorY(), { flip: c.facing < 0, alpha: 0.55, tint: [190, 160, 255, 0.6], ppu: m.ppu || 50 });
        else { ctx.fillStyle = 'rgba(190,160,255,0.5)'; ctx.fillRect(c.x - 30, this.floorY() - this.h, 60, this.h); } }
      if (!this.sprite(ctx, { shake: this.state === 'lunge_w' ? Math.sin(t * 80) * 2 : 0 })) this.blob(ctx, '#2a2238');
      if (this.state === 'lunge_w') G.FX.glow(ctx, this.cx + this.facing * 30, this.y + 50, 60 + this.st * 80, [255, 255, 255], 0.8);
    }
  }

  // ================= 5. THE EXTINGUISHER =================
  class Extinguisher extends Boss {
    constructor(tx, ty) { super('extinguisher', tx, ty, { w: 280, h: 420, maxHp: 52, glowC: [255, 110, 60], phases: [0.66, 0.33] }); this.y = TILE * 2; this.hy = this.y; this.dark = 0; this.floor = 20 * TILE; }
    hurtbox() { if (this.dead || !this.active) return null; return { x: this.x + 30, y: this.y + 30, w: this.w - 60, h: this.h * 0.8 }; }
    hitboxes() { return []; }
    update(dt, room, p) {
      this.common(dt);
      if (this.dead) { this.deathFX(dt); this.dark = approach(this.dark, 0, dt); this.setAnim('death'); return; }
      if (!this.active) { this.setAnim('idle'); this.y = this.hy + Math.sin(this.t * 0.8) * 15; return; }
      const sp = 1 + (this.phase - 1) * 0.18; this.hits = [];
      switch (this.state) {
        case 'wait': this.set('drift'); break;
        case 'drift': this.setAnim('idle'); this.faceP(p);
          this.vx = approach(this.vx, (p.cx - this.cx) * 0.8, 600 * dt); this.vy = approach(this.vy, (TILE * 2 + Math.sin(this.t) * 30 - this.y) * 2, 600 * dt);
          if (this.st > (1.5 - this.phase * 0.3)) { const o = ['slam', 'slam', 'hands', 'rain']; if (this.phase > 1) o.push('breath'); let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n + '_w'); } break;
        case 'slam_w': this.setAnim('raise'); this.vx = approach(this.vx, (p.cx - this.cx) * 3, 3000 * dt); this.vy = approach(this.vy, (TILE * 1 - this.y) * 3, 1500 * dt);
          if (this.st > 0.85 / sp) { this.set('slam'); this.vx = 0; this.vy = 1900; G.Sound.sfx('swoop', { pitch: 0.4 }); } break;
        case 'slam': this.setAnim('slam'); this.hits.push({ x: this.x + 40, y: this.y + this.h * 0.5, w: this.w - 80, h: this.h * 0.5 });
          if (this.y + this.h >= this.floor) { this.y = this.floor - this.h; this.set('down'); this.vy = 0; G.Sound.sfx('boss_slam'); G.FX.shake(24, 0.6);
            for (const d of [-1, 1]) this.wave(room, d, sp);
            G.FX.burst(this.cx, this.floor, 40, { speed: 600, life: 0.9, size: 18, c: [50, 40, 40], kind: 'smoke', angle: -Math.PI / 2, spread: 1.6, add: false }); } break;
        case 'down': this.setAnim('down'); if (this.st > 1.3 / sp) { this.set('drift'); this.vy = -600; } break;
        case 'hands_w': this.setAnim('cast'); this.vx *= 0.95; this.vy *= 0.95; if (this.st > 0.5) { this.set('hands'); this.k = 0; } break;
        case 'hands': this.setAnim('cast'); this.vx *= 0.95; this.vy *= 0.95;
          if (this.st > this.k * (0.45 / sp) && this.k < 2 + this.phase * 2) { this.k++; this.hand(p.cx + (this.k > 1 ? rand(-160, 160) : 0) + p.vx * 0.3); }
          if (this.st > 3.2) this.set('drift'); break;
        case 'rain_w': this.setAnim('cast'); this.vx *= 0.95; if (this.st > 0.6) { this.set('rain'); this.k = 0; this.gap = rand(6, 40) * TILE; } break;
        case 'rain': this.setAnim('cast');
          if (this.st > this.k * 0.11 && this.st < 2.4) { this.k++; let x; do { x = rand(2, 46) * TILE; } while (Math.abs(x - this.gap) < 160);
            G.Objects.spawnProj({ x, y: TILE * 1, vx: rand(-40, 40), vy: 200, g: 500, r: 14, life: 3, dmg: 1, c: [255, 120, 60], light: [255, 110, 50, 100] }); }
          if (this.st > 2.8) this.set('drift'); break;
        case 'breath_w': this.setAnim('raise'); this.dark = approach(this.dark, 0.3, dt * 0.6); if (this.st > 1.0) { this.set('breath'); this.k = 0; G.Sound.sfx('boss_roar', { pitch: 0.6 }); } break;
        case 'breath': this.setAnim('breath'); this.dark = approach(this.dark, 0.3, dt);
          const push = sign(p.cx - this.cx) || 1; if (!p.dead) p.x += push * 170 * dt * (p.ground ? 1 : 0.6);
          if (Math.random() < 0.6) G.FX.spawn({ x: this.cx + rand(-60, 60), y: this.y + this.h * 0.5, vx: push * rand(300, 700), vy: rand(-80, 120), life: 1.4, size: rand(10, 22), kind: 'smoke', c: [25, 20, 22], a: 0.45 });
          if (this.st > this.k * 0.5 && this.k < 4) { this.k++; const a = Math.atan2(p.cy - this.cy, p.cx - this.cx); G.Objects.spawnProj({ x: this.cx, y: this.cy, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 24, life: 4, dmg: 1, c: [120, 60, 60], light: [255, 90, 40, 120] }); }
          if (this.st > 2.4) { this.set('drift'); } break;
      }
      if (this.state !== 'breath' && this.state !== 'breath_w') this.dark = approach(this.dark, 0, dt * 0.5);
      if (this.state !== 'slam') { this.x += this.vx * dt; this.y += this.vy * dt; } else this.y += this.vy * dt;
      this.x = clamp(this.x, TILE, TILE * 47 - this.w); this.y = clamp(this.y, -TILE * 2, this.floor - this.h);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      G.FX.light(this.cx, this.y + this.h * 0.35, 460, [255, 110, 60], 0.9);
      if (Math.random() < 0.5) G.FX.spawn({ x: this.cx + rand(-120, 120), y: this.y + this.h * rand(0.5, 1), vx: rand(-30, 30), vy: rand(-80, -20), life: 2, size: rand(14, 30), kind: 'smoke', c: [18, 14, 16], a: 0.35 });
    }
    wave(room, d, sp) { Knight.prototype.wave.call({ cx: this.cx + d * 80, y: this.floor - 190, h: 190 }, room, d, sp * 1.1); }
    hand(x) {
      x = clamp(x, 2 * TILE, 46 * TILE); const y = this.floor; const self = this;
      G.FX.ring(x, y, 80, 10, [255, 100, 60], 0.55, 4);
      G.Objects.spawnProj({ x, y: y + 200, vx: 0, vy: 0, r: 1, life: 1.5, dmg: 1, ghost: true,
        update: (pr, dt) => { const k = pr.t; if (k > 0.6 && k < 1.2) { const h = Math.min(1, (k - 0.6) / 0.12) * 300; pr.box = { x: x - 45, y: y - h, w: 90, h }; if (pr.box && !G.Main.player.dead && overlap(pr.box, G.Main.player.hitbox())) G.Main.player.damage(1, x); if (k - dt <= 0.6) { G.Sound.sfx('boss_slam', { vol: 0.4, pitch: 1.6 }); G.FX.shake(6, 0.2); } } else pr.box = null; pr.y = y + 200; },
        draw: (c, pr, t) => { const k = pr.t; if (k < 0.6) { G.FX.glow(c, x, y, 70 * k / 0.6 + 20, [255, 90, 40], 0.6); }
          else if (k < 1.2) { const h = Math.min(1, (k - 0.6) / 0.12) * 300 * (k > 1.0 ? 1 - (k - 1.0) / 0.2 : 1); const g = c.createLinearGradient(0, y, 0, y - h);
            g.addColorStop(0, 'rgba(20,14,16,0.95)'); g.addColorStop(0.8, 'rgba(40,24,24,0.9)'); g.addColorStop(1, 'rgba(255,100,50,0.6)'); c.fillStyle = g;
            c.beginPath(); c.moveTo(x - 46, y); c.bezierCurveTo(x - 50, y - h * 0.6, x - 30, y - h, x - 8, y - h); for (let f = 0; f < 4; f++) { c.lineTo(x - 26 + f * 16, y - h - 30 + Math.abs(f - 1.5) * 10); c.lineTo(x - 18 + f * 16, y - h); } c.bezierCurveTo(x + 30, y - h, x + 50, y - h * 0.6, x + 46, y); c.fill();
            G.FX.glow(c, x, y - h, 60, [255, 100, 50], 0.5); } } });
    }
    draw(ctx, t) { if (!this.sprite(ctx, { y: this.y + this.h })) this.blob(ctx, '#1c1416'); }
  }


  // ================= 6. THE CANDLE CHOIR (optional) =================
  class Singer {
    constructor(boss, i) { this.boss = boss; this.i = i; this.w = 56; this.h = 80; this.x = 0; this.y = 0; this.hp = 9; this.maxHp = 9; this.flash = 0; this.dead = false; this.deadT = 0; this.facing = 1; this.charge = 0; this.isPart = true; this.t = rand(3); }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    hurtbox() { return this.dead || !this.boss.active ? null : { x: this.x, y: this.y, w: this.w, h: this.h }; }
    hitbox() { return this.dead ? null : { x: this.x + 10, y: this.y + 10, w: this.w - 20, h: this.h - 20 }; }
    hurt(dmg) { if (this.dead || !this.boss.active) return false; this.hp -= dmg; this.flash = 1; G.Sound.sfx('hit', { pitch: 1.3 }); this.boss.flash = 0.6;
      if (this.hp <= 0) { this.dead = true; G.Sound.sfx('enemy_die'); G.FX.burst(this.cx, this.cy, 30, { speed: 420, life: 0.7, size: 3, c: [255, 200, 120], kind: 'ember' }); G.FX.ring(this.cx, this.cy, 10, 120, [255, 210, 150], 0.5, 8); G.FX.shake(10, 0.3); this.boss.onSingerDeath(); }
      return true; }
    update(dt) { this.t += dt; this.flash = Math.max(0, this.flash - dt * 5); if (this.dead) this.deadT += dt; }
    draw(ctx, t) {
      if (this.dead) return; const a = 1;
      if (window.RIGS && window.RIGS.b_choir) { if (!this.pup) this.pup = new G.Puppet.Puppet('b_choir'); this.pup.play(this.charge > 0 ? 'sing' : 'idle'); this.pup.update(1 / 60, {}); this.pup.draw(ctx, this.cx, this.y + this.h, { flash: this.flash }); }
      else if (G.Sprite.meta('b_choir')) { const fi = G.Sprite.frameOf('b_choir', 'idle', this.t); G.Sprite.draw(ctx, 'b_choir', 'idle', fi, this.cx, this.y + this.h, { flash: this.flash * 0.8 }); }
      else {
        ctx.save(); ctx.fillStyle = this.flash > 0.3 ? '#fff' : '#efe2c8'; ctx.beginPath(); ctx.roundRect(this.x + 12, this.y + 18, this.w - 24, this.h - 18, 10); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(this.cx - 7, this.y + 40, 4, 7, 0, 0, 7); ctx.ellipse(this.cx + 7, this.y + 40, 4, 7, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(this.cx, this.y + 58, 5, 8 + Math.sin(this.t * 8) * 3, 0, 0, 7); ctx.fill(); ctx.restore();
      }
      G.FX.flame(ctx, this.cx, this.y + 14, 4 + this.charge * 4, t + this.i, { glow: 1 + this.charge });
    }
    drawGlow(ctx) { if (!this.dead) G.FX.glow(ctx, this.cx, this.cy, 140 + this.charge * 120, [255, 190, 110], 0.3 + this.charge * 0.4); }
  }
  class Choir extends Boss {
    constructor(tx, ty) { super('choir', tx, ty, { w: 10, h: 10, maxHp: 27, glowC: [255, 200, 120] }); this.cxp = tx * TILE; this.cyp = 6 * TILE; this.ang = 0; this.singers = [0, 1, 2].map(i => new Singer(this, i)); this.spawned = false; this.noSoul = false; this.y = 6 * TILE; }
    hurtbox() { return null; } hitboxes() { return []; }
    onSingerDeath() { this.hp = this.singers.reduce((s, g) => s + Math.max(0, g.hp), 0); if (this.singers.every(s => s.dead)) this.die(); else { this.phase = 2; G.Sound.sfx('boss_roar', { pitch: 1.6, vol: 0.6 }); } }
    update(dt, room, p) {
      this.common(dt);
      if (!this.spawned) { this.spawned = true; for (const s of this.singers) G.Main.addEnemy(s); }
      this.hp = this.singers.reduce((s, g) => s + Math.max(0, g.hp), 0);
      if (this.dead) { this.deathFX(dt); return; }
      const live = this.singers.filter(s => !s.dead); const sp = this.phase > 1 ? 1.35 : 1;
      if (!this.active) { this.place(dt, 0.6); return; }
      switch (this.state) {
        case 'wait': this.set('circle'); break;
        case 'circle': this.cxp = lerp(this.cxp, p.cx, dt * 0.6); this.cyp = lerp(this.cyp, Math.min(p.cy - 230, 9 * TILE), dt * 0.8); this.ang += dt * 1.3 * sp; this.place(dt, 8);
          for (const s of live) { if ((this.st + s.i * 0.6) % (1.8 / sp) < dt) this.note(s, p); }
          if (this.st > 5) this.set(pick(['line', 'dive', 'line'])); break;
        case 'line': { const xs = [-220, 0, 220]; live.forEach((s, k) => { const tx = clamp(p.cx + xs[k % 3], 2 * TILE, 33 * TILE), ty = 2.5 * TILE; s.x = lerp(s.x, tx - s.w / 2, dt * 4); s.y = lerp(s.y, ty, dt * 4); s.charge = Math.min(1, this.st / 1.0); });
          if (this.st > 1.1 && !this.fired) { this.fired = true; G.Sound.sfx('cast', { pitch: 0.7 }); G.FX.shake(8, 0.4); for (const s of live) this.beam(s.cx); }
          if (this.st > 1.9) { this.fired = false; live.forEach(s => s.charge = 0); this.set('circle'); } break; }
        case 'dive': { const s = live[Math.floor(this.st / 1.1) % live.length]; const k = this.st % 1.1;
          if (k < 0.45) { s.charge = k / 0.45; this.tgt = { x: p.cx, y: p.cy }; } else if (k < 0.8) { s.charge = 0; const a = Math.atan2(this.tgt.y - s.cy, this.tgt.x - s.cx); s.x += Math.cos(a) * 900 * sp * dt; s.y += Math.sin(a) * 900 * sp * dt; }
          this.ang += dt; if (this.st > 1.1 * live.length) { live.forEach(s => s.charge = 0); this.set('circle'); } break; }
      }
      for (const s of live) { const hb = s.hitbox(); if (hb) G.Main.hitPlayer(hb, s.cx); G.FX.light(s.cx, s.y + 20, 260, [255, 190, 110], 1); }
    }
    place(dt, k) { const live = this.singers.filter(s => !s.dead); live.forEach((s, i) => { const a = this.ang + i / live.length * Math.PI * 2; const tx = this.cxp + Math.cos(a) * 170 - s.w / 2, ty = this.cyp + Math.sin(a) * 90; s.x = lerp(s.x || tx, tx, Math.min(1, dt * k)); s.y = lerp(s.y || ty, ty, Math.min(1, dt * k)); }); }
    note(s, p) { const a = Math.atan2(p.cy - s.cy, p.cx - s.cx); G.Sound.sfx('shard', { pitch: 0.8 + s.i * 0.25, vol: 0.5 }); G.Objects.spawnProj({ x: s.cx, y: s.cy, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, r: 13, life: 4, dmg: 1, c: [255, 220, 150], light: [255, 200, 120, 100], update: (pr, dt) => { pr.vy += Math.sin(pr.t * 6) * 30; } }); }
    beam(x) {
      G.Objects.spawnProj({ x, y: 0, vx: 0, vy: 0, r: 1, life: 0.55, dmg: 1, ghost: true,
        update: (pr) => { if (!G.Main.player.dead && overlap({ x: x - 26, y: 0, w: 52, h: 20 * TILE }, G.Main.player.hitbox())) G.Main.player.damage(1, x); },
        draw: (c, pr) => { const k = 1 - pr.t / 0.55; c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(x - 40, 0, x + 40, 0); g.addColorStop(0, 'rgba(255,170,80,0)'); g.addColorStop(0.5, `rgba(255,240,200,${0.9 * k})`); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - 40, 0, 80, 20 * TILE); c.restore(); } });
    }
    draw(ctx, t) {}
  }

  // ================= 7. THE MOSS COLOSSUS (optional) =================
  class Colossus extends Boss {
    constructor(tx, ty) { super('colossus', tx, ty, { w: 170, h: 270, maxHp: 44, glowC: [140, 255, 200], phases: [0.5] }); this.facing = -1; }
    hurtbox() { if (this.dead || !this.active) return null; return { x: this.x + 15, y: this.y, w: this.w - 30, h: this.h }; }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.gravity(dt, room); this.setAnim('death'); return; }
      if (!this.active) { this.setAnim('idle'); this.gravity(dt, room); return; }
      const sp = this.phase > 1 ? 1.25 : 1, dx = p.cx - this.cx; this.hits = [];
      switch (this.state) {
        case 'wait': this.set('walk'); break;
        case 'walk': this.setAnim('walk'); this.faceP(p); this.vx = this.facing * 70 * sp;
          if (this.st > (this.phase > 1 ? 1.0 : 1.6)) { const o = Math.abs(dx) < 300 ? ['sweep', 'stomp'] : ['stomp', 'spawn', 'stomp']; if (this.phase > 1) o.push('roll', 'roll'); let n = pick(o); if (n === 'spawn' && G.Main.enemies().filter(e => e.kind === 'sporecap' && !e.dead).length >= 3) n = 'stomp'; this.set(n + '_w'); this.vx = 0; } break;
        case 'stomp_w': this.setAnim('raise'); if (this.st > 0.7 / sp) { this.set('stomp'); G.Sound.sfx('boss_slam'); G.FX.shake(18, 0.5);
            for (const d of [-1, 1]) G.Bosses.wave(room, this.cx + d * 90, this.y + this.h, d, 560 * sp, [140, 255, 180]);
            for (let i = 0; i < 5 + this.phase * 2; i++) { const x = rand(2, 42) * TILE; G.Objects.spawnProj({ kind: 'spore', x, y: TILE, vx: 0, vy: rand(50, 150), g: 700, r: 14, life: 4, dmg: 1 }); } } break;
        case 'stomp': this.setAnim('stomp'); if (this.st > 0.8) this.set('walk'); break;
        case 'sweep_w': this.setAnim('windup'); this.faceP(p); if (this.st > 0.6 / sp) { this.set('sweep'); G.Sound.sfx('swoop', { pitch: 0.45 }); G.FX.slash(this.cx + this.facing * 150, this.y + this.h - 70, 'side', this.facing, { big: 2.8, dur: 0.3, c: [150, 255, 190] }); } break;
        case 'sweep': this.setAnim('sweep'); if (this.st < 0.25) this.hits.push({ x: this.facing > 0 ? this.cx : this.cx - 330, y: this.y + this.h - 130, w: 330, h: 130 }); if (this.st > 0.7) this.set('walk'); break;
        case 'spawn_w': this.setAnim('raise'); if (this.st > 0.8) { this.set('walk'); for (const d of [-1, 1]) { const e = new G.Enemies.Enemy('sporecap', (this.cx + d * 220) / TILE, (this.y + this.h) / TILE); G.Main.addEnemy(e); G.FX.burst(e.cx, e.cy, 20, { speed: 200, life: 0.6, size: 6, c: [120, 255, 200], kind: 'smoke', a: 0.3 }); } } break;
        case 'roll_w': this.setAnim('curl'); this.faceP(p); if (this.st > 0.6) { this.set('roll'); this.bounces = 1; } break;
        case 'roll': this.setAnim('roll'); this.vx = this.facing * 640; this.hits.push({ x: this.x + 10, y: this.y + 80, w: this.w - 20, h: this.h - 80 });
          if (room.wallAhead(this, this.facing)) { G.Sound.sfx('boss_slam'); G.FX.shake(14, 0.3); if (this.bounces-- > 0) this.facing *= -1; else { this.set('walk'); this.vx = 0; } } break;
      }
      room.moveX(this, this.vx * dt); this.gravity(dt, room);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      G.Main.hitPlayer({ x: this.x + 30, y: this.y + 40, w: this.w - 60, h: this.h - 40 }, this.cx);
      G.FX.light(this.cx, this.y + 60, 420, [140, 255, 200], 0.9);
    }
    draw(ctx, t) { if (!this.sprite(ctx, { shake: this.state.endsWith('_w') ? Math.sin(t * 50) * 3 : 0, rot: this.state === 'roll' ? 0 : 0 })) this.blob(ctx, '#1f3a2a'); }
  }
  function wave(room, x, y, d, speed, c) {
    G.Objects.spawnProj({ x, y: y - 34, vx: d * speed, vy: 0, r: 30, life: 2.2, dmg: 1, ghost: true, c,
      update: (pr) => { if (room.solidAt(pr.x + sign(pr.vx) * 30, pr.y)) pr.t = 99; if (Math.random() < 0.8) G.FX.spawn({ x: pr.x, y: y - rand(0, 50), vx: rand(-40, 40), vy: rand(-260, -120), life: 0.5, size: rand(2, 4), kind: 'ember', c, add: true }); },
      draw: (cx, pr, t) => { G.FX.glow(cx, pr.x, y - 30, 80, c, 0.9); cx.save(); cx.globalCompositeOperation = 'lighter'; const g = cx.createLinearGradient(0, y, 0, y - 80); g.addColorStop(0, rgba(c, 0.9)); g.addColorStop(1, rgba(c, 0)); cx.fillStyle = g; cx.beginPath(); cx.moveTo(pr.x - 30, y); cx.quadraticCurveTo(pr.x - 10 * sign(pr.vx), y - 90 - Math.sin(t * 30) * 10, pr.x + 30 * sign(pr.vx), y); cx.fill(); cx.restore(); } });
  }


  // ---------- shared helpers for the new worlds ----------
  class BossPart { // a hittable sub-body that forwards damage to its boss
    constructor(boss, w, h, o = {}) { this.boss = boss; this.w = w; this.h = h; this.x = -999; this.y = -999; this.isPart = true; this.dead = false; this.flash = 0; this.hittable = o.hittable !== false; this.noSoul = false; this.deadT = 0; }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    hurtbox() { return this.boss.dead || !this.boss.active || !this.hittable || this.hidden ? null : { x: this.x, y: this.y, w: this.w, h: this.h }; }
    hurt(d, dx, dy) { if (!this.hittable) return false; this.flash = 1; return this.boss.hurt(d, dx, dy); }
    update(dt) { this.flash = Math.max(0, this.flash - dt * 5); if (this.boss.dead) { this.dead = true; this.deadT += dt; } }
    draw() {}
  }
  function fireball(x, y, vx, vy, o = {}) { return G.Objects.spawnProj(Object.assign({ x, y, vx, vy, r: 15, life: 4, dmg: 1, c: [255, 140, 60], light: [255, 130, 50, 120] }, o)); }
  function ringShot(x, y, n, sp, off = 0, o = {}) { for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; fireball(x, y, Math.cos(a) * sp, Math.sin(a) * sp, o); } }
  function drawGlowBody(ctx, x, y, r, c, a = 1) { G.FX.glow(ctx, x, y, r * 2.2, c, 0.5 * a); ctx.save(); ctx.globalAlpha = a; const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#fff6e0'); g.addColorStop(0.4, rgba(c, 1)); g.addColorStop(1, rgba([c[0] * 0.3, c[1] * 0.3, c[2] * 0.3], 1)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }

  // ================= W2-1. WAX LEVIATHAN =================
  class Leviathan extends Boss {
    constructor(tx, ty) { super('leviathan', tx, ty, { w: 120, h: 100, maxHp: 46, glowC: [255, 150, 70], phases: [0.5] });
      this.segs = Array.from({ length: 11 }, (_, i) => new BossPart(this, i === 0 ? 120 : 90 - i * 4, i === 0 ? 100 : 80 - i * 4)); this.trail = []; this.hidden = true; this.sea = 15 * TILE; this.spawned = false; this.x = 22 * TILE; this.y = this.sea + 200; }
    hurtbox() { return null; } hitboxes() { return []; }
    update(dt, room, p) {
      this.common(dt); if (!this.spawned) { this.spawned = true; for (const s of this.segs) G.Main.addEnemy(s); }
      for (const s of this.segs) s.update(dt);
      if (this.dead) { this.deathFX(dt); this.y += 120 * dt; this.place(); return; }
      if (!this.active) { this.place(); return; }
      const sp = this.phase > 1 ? 1.3 : 1;
      switch (this.state) {
        case 'wait': this.set('under'); break;
        case 'under': this.y = this.sea + 260; if (this.st > (this.phase > 1 ? 0.7 : 1.2)) { const n = pick(['arc', 'arc', 'rise', 'lunge']); this.set(n + '_w'); this.side = p.cx < 22 * TILE ? -1 : 1; } break;
        case 'arc_w': this.bubbles(this.side < 0 ? 28 * TILE : 16 * TILE); if (this.st > 0.8 / sp) { this.set('arc'); this.x = this.side < 0 ? 28 * TILE : 16 * TILE; this.y = this.sea + 40; this.vx = (this.side < 0 ? -420 : 420) * sp; this.vy = -1350; G.Sound.sfx('splash'); G.Sound.sfx('boss_roar', { vol: 0.5, pitch: 0.8 }); } break;
        case 'arc': this.vy += 1500 * dt; this.x += this.vx * dt; this.y += this.vy * dt; if (Math.random() < 0.4) G.FX.spawn({ x: this.x, y: this.y + 40, vx: rand(-60, 60), vy: rand(-40, 60), life: 0.8, size: rand(2, 4), kind: 'ember', c: [255, 150, 60], add: true });
          if (this.y > this.sea + 260 && this.st > 0.6) { this.set(this.phase > 1 && Math.random() < 0.5 ? 'arc_w' : 'under'); G.Sound.sfx('splash'); } break;
        case 'rise_w': this.bubbles(clamp(p.cx, 15 * TILE, 29 * TILE)); this.rx = clamp(p.cx, 15 * TILE, 29 * TILE); if (this.st > 0.9) { this.set('rise'); G.Sound.sfx('splash'); } break;
        case 'rise': { const k = Math.min(1, this.st / 0.4); this.x = this.rx + Math.sin(this.st * 3) * 40; this.y = lerp(this.sea + 200, this.sea - 330, ease.out(k));
          if (this.st > 0.6 && Math.floor(this.st / (0.55 / sp)) !== Math.floor((this.st - dt) / (0.55 / sp)) && this.st < 2.6) { G.Sound.sfx('cast', { pitch: 0.6 }); for (let i = -1; i <= 1; i++) fireball(this.x, this.y, (p.cx - this.x) * 0.7 + i * 180, -700, { g: 1300 }); }
          if (this.st > 3.2) { this.y += 600 * dt; } if (this.st > 3.8) this.set('under'); break; }
        case 'lunge_w': this.bubbles(this.side < 0 ? 31 * TILE : 13 * TILE); if (this.st > 0.9 / sp) { this.set('lunge'); this.x = this.side < 0 ? 31 * TILE : 13 * TILE; this.y = this.sea - 60; this.vx = (this.side < 0 ? 1 : -1) * 900 * sp; G.Sound.sfx('boss_roar', { pitch: 0.7, vol: 0.6 }); } break;
        case 'lunge': this.x += this.vx * dt; this.y = this.sea - 60 + Math.sin(this.st * 9) * 20; if (this.x < -2 * TILE || this.x > 46 * TILE) this.set('under'); break;
      }
      this.trail.unshift([this.x, this.y]); if (this.trail.length > 90) this.trail.pop();
      this.place();
      for (const s of this.segs) if (!s.hidden) G.Main.hitPlayer({ x: s.x + 12, y: s.y + 12, w: s.w - 24, h: s.h - 24 }, s.cx);
      G.FX.light(this.x, this.y, 420, [255, 140, 60], 1);
    }
    bubbles(x) { if (Math.random() < 0.6) G.FX.spawn({ x: x + rand(-80, 80), y: this.sea + 10, vx: 0, vy: rand(-240, -100), life: 0.6, size: rand(2, 5), kind: 'ember', c: [255, 170, 80], add: true }); }
    place() { this.segs.forEach((s, i) => { const tr = this.trail[Math.min(this.trail.length - 1, i * 6)] || [this.x, this.y]; s.x = tr[0] - s.w / 2; s.y = tr[1] - s.h / 2; s.hidden = s.y > this.sea + 30; }); this.cxv = this.segs[0].cx; }
    get cx() { return this.x; } get cy() { return this.y; }
    draw(ctx, t) {
      for (let i = this.segs.length - 1; i >= 0; i--) { const s = this.segs[i]; if (s.hidden) continue;
        const r = s.w / 2; drawGlowBody(ctx, s.cx, s.cy, r * 0.95, i === 0 ? [255, 190, 110] : [240, 170, 100], this.dead ? Math.max(0, 1 - this.deadT * 0.5) : 1);
        if (s.flash > 0.2) { ctx.globalAlpha = s.flash; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.cx, s.cy, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        if (i === 0) { const d = this.vx >= 0 ? 1 : -1; ctx.fillStyle = '#1a0804'; ctx.beginPath(); ctx.ellipse(s.cx + d * r * 0.45, s.cy - r * 0.2, 10, 14, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffdd88'; ctx.beginPath(); ctx.arc(s.cx + d * r * 0.5, s.cy - r * 0.25, 4, 0, 7); ctx.fill(); }
      }
    }
  }

  // ================= W2-2. CAPTAIN SMOLDER =================
  class Captain extends Boss {
    constructor(tx, ty) { super('captain', tx, ty, { w: 64, h: 140, maxHp: 44, glowC: [190, 160, 255], phases: [0.5] }); }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.gravity(dt, room); this.setAnim('death'); return; }
      if (!this.active) { this.setAnim('idle'); this.gravity(dt, room); this.faceP(p); return; }
      const sp = this.phase > 1 ? 1.25 : 1; this.hits = [];
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle': this.setAnim('walk'); this.faceP(p); this.vx = this.facing * 120 * sp; if (this.st > (this.phase > 1 ? 0.5 : 0.9)) { const o = ['slash', 'slash', 'cannon', 'anchor']; if (G.Main.enemies().filter(e => e.kind === 'ghostsailor' && !e.dead).length < 2) o.push('crew'); if (this.phase > 1) o.push('smoke', 'smoke'); let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n + '_w'); this.vx = 0; } break;
        case 'slash_w': this.setAnim('ready'); this.faceP(p); if (this.st > 0.4 / sp) { this.set('slash'); this.k = 0; } break;
        case 'slash': this.setAnim('slash'); { const ph = Math.floor(this.st / 0.3);
            if (ph !== this.k && ph < (this.phase > 1 ? 3 : 2)) { this.k = ph; this.faceP(p); this.vx = this.facing * 700; G.Sound.sfx('slash', { pitch: 0.75 }); G.FX.slash(this.cx + this.facing * 70, this.cy, 'side', this.facing, { big: 1.7, dur: 0.18, c: [200, 180, 255] }); }
            this.vx = approach(this.vx, 0, 2600 * dt); if (this.st % 0.3 < 0.15) this.hits.push({ x: this.facing > 0 ? this.cx : this.cx - 160, y: this.y + 20, w: 160, h: 100 });
            if (this.st > (this.phase > 1 ? 1.0 : 0.7)) this.set('idle'); } break;
        case 'cannon_w': this.setAnim('cannon'); this.vx = 0; this.faceP(p); if (this.st > 0.6) { this.set('cannon'); this.k = 0; } break;
        case 'cannon': if (this.st > this.k * 0.45 && this.k < 3) { this.k++; G.Sound.sfx('explode'); G.FX.shake(8, 0.2); G.FX.burst(this.cx + this.facing * 50, this.cy, 14, { speed: 300, life: 0.4, size: 8, c: [60, 50, 70], kind: 'smoke', add: false });
            fireball(this.cx + this.facing * 50, this.cy, this.facing * 520, -200, { g: 1100, r: 20, c: [120, 110, 140], light: [200, 180, 255, 100], update: (pr) => { if (pr.vy > 0 && room.solidAt(pr.x, pr.y + 20)) { pr.vy = -Math.abs(pr.vy) * 0.6; } }, ghost: false }); }
          if (this.st > 1.7) this.set('idle'); break;
        case 'anchor_w': this.setAnim('raise'); if (this.st > 0.5) { this.set('anchor'); for (let i = 0; i < 4 + this.phase; i++) { const x = clamp(p.cx + (i - 2) * 190 + rand(-40, 40), 2 * TILE, 37 * TILE); this.anchor(x, i * 0.25); } } break;
        case 'anchor': if (this.st > 1.8) this.set('idle'); break;
        case 'crew_w': this.setAnim('raise'); if (this.st > 0.7) { this.set('idle'); for (const d of [-1, 1]) { const e = new G.Enemies.Enemy('ghostsailor', (this.cx + d * 260) / TILE, 14); G.Main.addEnemy(e); G.FX.burst(e.cx, e.cy, 20, { speed: 200, life: 0.6, size: 10, c: [120, 100, 160], kind: 'smoke', a: 0.4 }); } } break;
        case 'smoke_w': this.setAnim('ready'); this.alpha = Math.max(0, 1 - this.st * 3); if (this.st > 0.4) { this.x = clamp(p.cx - p.facing * 120 - this.w / 2, TILE * 2, 37 * TILE - this.w); this.set('smoke'); G.Sound.sfx('dash', { pitch: 0.6 }); } break;
        case 'smoke': this.alpha = Math.min(1, this.st * 4); this.faceP(p); if (this.st > 0.35) { this.set('slash'); this.k = -1; } break;
      }
      room.moveX(this, this.vx * dt); this.gravity(dt, room);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      G.Main.hitPlayer({ x: this.x + 10, y: this.y + 20, w: this.w - 20, h: this.h - 20 }, this.cx);
      G.FX.light(this.cx, this.y + 30, 300, [190, 160, 255], 1);
    }
    anchor(x, delay) {
      G.Objects.spawnProj({ x, y: TILE, vx: 0, vy: 0, r: 26, life: 3, dmg: 1, ghost: true, c: [130, 120, 150],
        update: (pr, dt) => { if (pr.t < delay + 0.5) { pr.vy = 0; pr.y = TILE; } else pr.vy += 2400 * dt; if (pr.y > 13.5 * TILE) { pr.y = 13.5 * TILE; pr.vy = 0; if (!pr.hitG) { pr.hitG = 1; G.Sound.sfx('boss_slam', { vol: 0.5 }); G.FX.shake(6, 0.15); } } },
        draw: (c, pr) => { if (pr.t < delay + 0.5) { c.strokeStyle = 'rgba(200,180,255,0.35)'; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(x, TILE); c.lineTo(x, 14 * TILE); c.stroke(); c.setLineDash([]); }
          c.strokeStyle = '#3a3448'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, pr.y - 20); c.stroke();
          c.fillStyle = '#4a4258'; c.beginPath(); c.moveTo(x - 4, pr.y - 26); c.lineTo(x + 4, pr.y - 26); c.lineTo(x + 4, pr.y + 10); c.quadraticCurveTo(x + 26, pr.y + 8, x + 30, pr.y - 8); c.lineTo(x + 24, pr.y + 22); c.quadraticCurveTo(x, pr.y + 30, x - 24, pr.y + 22); c.lineTo(x - 30, pr.y - 8); c.quadraticCurveTo(x - 26, pr.y + 8, x - 4, pr.y + 10); c.closePath(); c.fill(); } });
    }
    draw(ctx, t) { if (!this.sprite(ctx)) { this.blob(ctx, '#2a2438'); G.FX.glow(ctx, this.cx, this.y + 30, 50, [190, 160, 255], 0.5 * this.alpha); } }
  }

  // ================= W2-3. LIGHTHOUSE KEEPER =================
  class Keeper extends Boss {
    constructor(tx, ty) { super('keeper', tx, ty, { w: 120, h: 200, maxHp: 50, glowC: [255, 220, 140], phases: [0.5] }); this.y = 2 * TILE; this.hy = this.y; this.ang = Math.PI / 2; this.beamOn = 0; }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.beamOn = 0; this.vy = (this.vy || 0) + 900 * dt; this.y = Math.min(this.y + this.vy * dt, 16 * TILE - this.h); this.setAnim('death'); return; }
      if (!this.active) { this.setAnim('idle'); this.y = this.hy + Math.sin(this.t) * 10; return; }
      const sp = this.phase > 1 ? 1.3 : 1; this.dark = this.phase > 1 ? 0.25 : 0.1;
      switch (this.state) {
        case 'wait': this.set('float'); break;
        case 'float': this.setAnim('idle'); this.x = lerp(this.x, clamp(p.cx - this.w / 2, 4 * TILE, 34 * TILE), dt * 0.8); this.y = lerp(this.y, this.hy + Math.sin(this.t) * 20, dt * 2);
          if (this.st > 1.2) { const n = pick(['beam', 'beam', 'bombs', 'descend']); this.set(n + '_w'); } break;
        case 'beam_w': this.setAnim('glow'); this.beamOn = Math.min(0.3, this.st); this.ang = Math.PI * 0.9; if (this.st > 0.9) { this.set('beam'); G.Sound.sfx('cast', { pitch: 0.5 }); this.dir = p.cx > this.cx ? -1 : 1; this.ang = this.dir < 0 ? Math.PI * 0.95 : Math.PI * 0.05; } break;
        case 'beam': this.beamOn = 1;
          { const d = this.dir; this.ang = d < 0 ? Math.PI * 0.95 - this.st * 0.95 * sp : Math.PI * 0.05 + this.st * 0.95 * sp; }
          this.beamHit(room, p); if (this.st > Math.PI * 0.9 / (0.95 * sp)) { this.beamOn = 0; this.set(this.phase > 1 && Math.random() < 0.5 ? 'beam_w' : 'float'); } break;
        case 'bombs_w': this.setAnim('raise'); if (this.st > 0.5) { this.set('bombs'); for (let i = 0; i < 3 + this.phase; i++) { const tx = clamp(p.cx + (i - 1.5) * 170, 2 * TILE, 37 * TILE); const T = 0.9; fireball(this.cx, this.cy, (tx - this.cx) / T, -500, { g: (2 * (16 * TILE - this.cy + 500 * T)) / (T * T), r: 16, c: [255, 210, 120], onDie: 1, update: (pr) => { if (pr.y > 15.6 * TILE) { pr.t = 99; this.firePool(pr.x); } } }); } } break;
        case 'bombs': if (this.st > 1.2) this.set('float'); break;
        case 'descend_w': this.setAnim('raise'); if (this.st > 0.4) { this.set('descend'); this.vy = 0; } break;
        case 'descend': this.vy = (this.vy || 0) + 2600 * dt; this.y += this.vy * dt; if (this.y + this.h >= 16 * TILE) { this.y = 16 * TILE - this.h; this.set('down'); G.Sound.sfx('boss_slam'); G.FX.shake(18, 0.4); for (const d of [-1, 1]) wave(room, this.cx + d * 70, 16 * TILE, d, 600 * sp, [255, 210, 120]); } break;
        case 'down': this.setAnim('down'); if (this.st > 1.6 / sp) { this.set('up'); } break;
        case 'up': this.y = lerp(this.y, this.hy, dt * 3); if (Math.abs(this.y - this.hy) < 6) this.set('float'); break;
      }
      G.Main.hitPlayer({ x: this.x + 20, y: this.y + 20, w: this.w - 40, h: this.h - 30 }, this.cx);
      G.FX.light(this.cx, this.y + 40, 420 + this.beamOn * 300, [255, 220, 150], 1);
    }
    beamHit(room, p) {
      const ox = this.cx, oy = this.y + 40, dx = p.cx - ox, dy = p.cy - oy, a = Math.atan2(dy, dx);
      let da = Math.abs(((a - this.ang) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (da < 0.07 + 30 / Math.max(80, Math.hypot(dx, dy)) && room.los(ox, oy, p.cx, p.cy)) p.damage(1, ox);
    }
    firePool(x) { G.Sound.sfx('explode', { vol: 0.6 }); G.Objects.spawnProj({ x, y: 15.6 * TILE, vx: 0, vy: 0, r: 40, life: 2.2, dmg: 1, ghost: true, pierce: true, c: [255, 160, 60],
      draw: (c, pr) => { const k = 1 - pr.t / 2.2; G.FX.glow(c, x, 15.6 * TILE, 70, [255, 150, 50], 0.7 * k); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,170,70,${0.6 * k})`; c.beginPath(); c.ellipse(x, 15.8 * TILE, 46, 12 + Math.sin(pr.t * 20) * 3, 0, 0, 7); c.fill(); c.restore(); } }); }
    draw(ctx, t) {
      if (this.beamOn > 0) { const ox = this.cx, oy = this.y + 40, L = 2200; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(ox, oy); ctx.rotate(this.ang);
        const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, `rgba(255,240,200,${0.8 * this.beamOn})`); g.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(L, -90 * this.beamOn); ctx.lineTo(L, 90 * this.beamOn); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.restore(); }
      if (!this.sprite(ctx)) { this.blob(ctx, '#2c2418'); drawGlowBody(ctx, this.cx, this.y + 40, 34, [255, 220, 140]); }
    }
  }

  // ================= W3-1. PAPER KING =================
  class PaperKing extends Boss {
    constructor(tx, ty) { super('paperking', tx, ty, { w: 80, h: 160, maxHp: 50, glowC: [255, 240, 220], phases: [0.5] }); this.copies = []; }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.gravity(dt, room); this.setAnim('death'); this.copies = []; return; }
      if (!this.active) { this.setAnim('idle'); this.gravity(dt, room); this.faceP(p); return; }
      const sp = this.phase > 1 ? 1.25 : 1; this.hits = [];
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle': this.setAnim('idle'); this.faceP(p); this.vx = approach(this.vx, 0, 1500 * dt); if (this.st > (this.phase > 1 ? 0.5 : 0.9)) { const o = ['cranes', 'blade', 'blade', 'rain']; if (this.phase > 1) o.push('split', 'split'); let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n + '_w'); } break;
        case 'cranes_w': this.setAnim('cast'); if (this.st > 0.5) { this.set('cranes'); G.Sound.sfx('swoop', { pitch: 1.4 }); for (let i = 0; i < 4 + this.phase; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; G.Objects.spawnProj({ x: this.cx, y: this.y + 30, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 14, life: 5, dmg: 1, c: [255, 245, 225],
              update: (pr, dt2) => { if (pr.t > 0.6) { const P = G.Main.player, aa = Math.atan2(P.cy - pr.y, P.cx - pr.x), s = 300; pr.vx = approach(pr.vx, Math.cos(aa) * s, 500 * dt2); pr.vy = approach(pr.vy, Math.sin(aa) * s, 500 * dt2); } },
              draw: (c, pr) => { const a2 = Math.atan2(pr.vy, pr.vx); c.save(); c.translate(pr.x, pr.y); c.rotate(a2); c.fillStyle = '#f4ecdc'; c.beginPath(); c.moveTo(16, 0); c.lineTo(-10, -12 - Math.sin(pr.t * 18) * 6); c.lineTo(-4, 0); c.lineTo(-10, 12 + Math.sin(pr.t * 18) * 6); c.closePath(); c.fill(); c.strokeStyle = '#8a7a66'; c.lineWidth = 1; c.stroke(); c.restore(); } }); } } break;
        case 'cranes': if (this.st > 1.0) this.set('idle'); break;
        case 'blade_w': this.setAnim('ready'); this.faceP(p); if (this.st > 0.45 / sp) { this.set('blade'); this.vx = this.facing * 1250 * sp; G.Sound.sfx('slash', { pitch: 1.2 }); } break;
        case 'blade': this.setAnim('dash'); this.hits.push({ x: this.x - 30, y: this.y + 40, w: this.w + 60, h: this.h - 60 }); if (Math.random() < 0.8) G.FX.spawn({ x: this.cx, y: this.cy + rand(-40, 40), vx: -this.vx * 0.1, vy: rand(-40, 40), life: 0.5, size: 3, kind: 'shard', c: [245, 235, 215], rot: rand(6), add: false });
          if (this.st > 0.4 || room.wallAhead(this, this.facing)) { this.vx = 0; this.set('idle'); } break;
        case 'rain_w': this.setAnim('cast'); if (this.st > 0.6) { this.set('rain'); this.k = 0; } break;
        case 'rain': if (this.st > this.k * 0.12 && this.st < 2) { this.k++; fireball(rand(2, 38) * TILE, TILE, 0, 0, { g: 900, r: 12, c: [250, 240, 220], light: null, draw: (c, pr) => { c.save(); c.translate(pr.x, pr.y); c.rotate(pr.t * 12); c.fillStyle = '#efe5d2'; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(14, -4); c.lineTo(4, 0); c.fill(); } c.restore(); } }); } if (this.st > 2.3) this.set('idle'); break;
        case 'split_w': this.setAnim('cast'); this.alpha = Math.max(0.2, 1 - this.st * 2); if (this.st > 0.5) { this.set('split'); const xs = [8, 20, 32].map(v => v * TILE).sort(() => Math.random() - 0.5); this.x = xs[0] - this.w / 2; this.copies = [xs[1], xs[2]].map(x => ({ x, hp: 1, t: 0 })); this.alpha = 1; G.Sound.sfx('swoop'); } break;
        case 'split': this.copies.forEach(c => { c.t += dt; }); if (this.st > 0.9) { this.set('blade_w'); this.copies.forEach(c => { c.lunge = true; c.vx = Math.sign(p.cx - c.x) * 1100; }); } break;
      }
      for (const c of this.copies) { if (c.lunge) { c.x += c.vx * dt; G.Main.hitPlayer({ x: c.x - 40, y: this.y + 40, w: 80, h: this.h - 60 }, c.x); if (c.x < 0 || c.x > 40 * TILE) c.dead = true; } }
      this.copies = this.copies.filter(c => !c.dead && (c.t || 0) < 3);
      room.moveX(this, this.vx * dt); this.gravity(dt, room);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      G.FX.light(this.cx, this.y + 40, 320, [255, 240, 220], 0.8);
    }
    draw(ctx, t) {
      for (const c of this.copies) { ctx.save(); ctx.globalAlpha = 0.55; if (!this.sprite(ctx, { x: c.x, alpha: 0.6 })) { ctx.fillStyle = '#d8ccb4'; ctx.fillRect(c.x - 35, this.y, 70, this.h); } ctx.restore(); }
      if (!this.sprite(ctx, { shake: this.state.endsWith('_w') ? Math.sin(t * 60) * 2 : 0 })) { this.blob(ctx, '#e8dcc4'); }
    }
  }

  // ================= W3-2. THE CLOCKMAKER =================
  class Clockmaker extends Boss {
    constructor(tx, ty) { super('clockmaker', tx, ty, { w: 80, h: 170, maxHp: 54, glowC: [255, 215, 140], phases: [0.5] }); this.pend = null; this.frozen = 0; }
    update(dt, room, p) {
      this.common(dt); if (this.dead) { this.deathFX(dt); this.gravity(dt, room); this.setAnim('death'); this.pend = null; return; }
      if (!this.active) { this.setAnim('idle'); this.gravity(dt, room); this.faceP(p); return; }
      const sp = this.phase > 1 ? 1.25 : 1; this.hits = [];
      switch (this.state) {
        case 'wait': this.set('idle'); break;
        case 'idle': this.setAnim('idle'); this.faceP(p); if (this.st > (this.phase > 1 ? 0.6 : 1.0)) { const o = ['gears', 'needles', 'blink']; if (!this.pend) o.push('pendulum'); let n = pick(o); if (n === this.lastAtk) n = pick(o); this.lastAtk = n; this.set(n + '_w'); } break;
        case 'pendulum_w': this.setAnim('cast'); if (this.st > 0.6) { this.pend = { t: 0, dur: 5 + this.phase }; this.set('idle'); G.Sound.sfx('door'); } break;
        case 'gears_w': this.setAnim('cast'); if (this.st > 0.5) { this.set('idle'); for (const d of [-1, 1]) for (let k = 0; k < this.phase; k++) G.Objects.spawnProj({ x: this.cx + d * 60, y: 15.4 * TILE, vx: d * (420 + k * 160) * sp, vy: 0, r: 28, life: 4, dmg: 1, ghost: true, c: [220, 180, 110],
              update: (pr) => { if (room.solidAt(pr.x + Math.sign(pr.vx) * 32, pr.y)) pr.vx *= -1; },
              draw: (c, pr) => { c.save(); c.translate(pr.x, pr.y); c.rotate(pr.t * pr.vx / 28); c.fillStyle = '#8a6a30'; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 22 : 30; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.fillStyle = '#2a1e10'; c.beginPath(); c.arc(0, 0, 8, 0, 7); c.fill(); c.restore(); } }); } break;
        case 'needles_w': this.setAnim('cast'); if (this.st > 0.4) { this.set('needles'); this.ring = []; for (let i = 0; i < 12 + this.phase * 2; i++) { const a = i / (12 + this.phase * 2) * Math.PI * 2, pr = fireball(p.cx + Math.cos(a) * 260, p.cy + Math.sin(a) * 260, 0, 0, { r: 10, life: 4, c: [255, 220, 150], ghost: true }); pr.hold = true; this.ring.push(pr); } G.Sound.sfx('shard'); } break;
        case 'needles': if (this.st > 1.0 && this.ring) { G.Sound.sfx('cast', { pitch: 1.3 }); for (const pr of this.ring) { const a = Math.atan2(p.cy - pr.y, p.cx - pr.x); pr.vx = Math.cos(a) * 520 * sp; pr.vy = Math.sin(a) * 520 * sp; } this.ring = null; } if (this.st > 1.6) this.set('idle'); break;
        case 'blink_w': this.setAnim('ready'); this.alpha = Math.max(0, 1 - this.st * 3); if (this.st > 0.35) { this.x = clamp(p.cx + (Math.random() < 0.5 ? -1 : 1) * 150 - this.w / 2, 2 * TILE, 37 * TILE - this.w); this.faceP(p); this.set('blink'); } break;
        case 'blink': this.alpha = Math.min(1, this.st * 4); this.setAnim('strike'); if (this.st > 0.35 && this.st < 0.55) this.hits.push({ x: this.facing > 0 ? this.cx : this.cx - 190, y: this.y + 20, w: 190, h: 120 }); if (Math.abs(this.st - 0.35) < dt) { G.Sound.sfx('slash', { pitch: 0.9 }); G.FX.slash(this.cx + this.facing * 80, this.cy - 10, 'side', this.facing, { big: 2, c: [255, 220, 150] }); } if (this.st > 0.9) this.set('idle'); break;
      }
      if (this.pend) { this.pend.t += dt; const P = this.pend, L = 12 * TILE, ax = 20 * TILE, ay = 0, a = Math.sin(P.t * 1.6 * sp) * 1.05; P.bx = ax + Math.sin(a) * L; P.by = ay + Math.cos(a) * L; P.a = a;
        G.Main.hitPlayer({ x: P.bx - 60, y: P.by - 30, w: 120, h: 60 }, P.bx); if (P.t > P.dur) this.pend = null; }
      room.moveX(this, (this.vx || 0) * dt); this.gravity(dt, room);
      for (const h of this.hits) G.Main.hitPlayer(h, this.cx);
      G.FX.light(this.cx, this.y + 30, 320, [255, 215, 140], 0.9);
    }
    draw(ctx, t) {
      if (this.pend) { const P = this.pend; if (P.bx !== undefined) { ctx.strokeStyle = '#5a4420'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(20 * TILE, 0); ctx.lineTo(P.bx, P.by); ctx.stroke();
        ctx.save(); ctx.translate(P.bx, P.by); ctx.rotate(-P.a); ctx.fillStyle = '#b08a40'; ctx.beginPath(); ctx.moveTo(-70, -10); ctx.quadraticCurveTo(0, 50, 70, -10); ctx.lineTo(60, -24); ctx.quadraticCurveTo(0, 20, -60, -24); ctx.closePath(); ctx.fill(); ctx.restore(); G.FX.glow(ctx, P.bx, P.by, 90, [255, 210, 120], 0.4); } }
      if (!this.sprite(ctx)) { this.blob(ctx, '#3a2c18'); drawGlowBody(ctx, this.cx, this.y + 30, 26, [255, 215, 140]); }
    }
  }

  // ================= W3-3. THE FIRST FLAME (final) =================
  class FirstFlame extends Boss {
    constructor(tx, ty) { super('firstflame', tx, ty, { w: 90, h: 90, maxHp: 90, glowC: [255, 190, 90], phases: [0.66, 0.33] }); this.y = 6 * TILE; this.hy = this.y; this.form = 'wisp'; }
    onPhase(ph) { this.form = ph === 2 ? 'mirror' : 'sun'; this.set('shift'); G.FX.flash('#ffe0a0', 0.8, 1); G.Objects.clearProjs(); }
    hurtbox() { if (this.dead || !this.active || this.state === 'shift') return null; if (this.form === 'sun') return this.state === 'core' ? { x: this.cx - 60, y: this.cy - 60, w: 120, h: 120 } : { x: this.cx - 50, y: this.cy - 50, w: 100, h: 100 }; return { x: this.x, y: this.y, w: this.w, h: this.h }; }
    update(dt, room, p) {
      this.common(dt); this.dark = this.form === 'sun' ? 0.2 : 0;
      if (this.dead) { this.deathFX(dt); this.setAnim('death'); return; }
      if (!this.active) { this.y = this.hy + Math.sin(this.t) * 14; return; }
      const sp = 1 + (this.phase - 1) * 0.15;
      if (this.state === 'shift') { this.vx = 0; this.vy = 0; if (this.form === 'mirror') { this.w = 34; this.h = 84; this.y = lerp(this.y, 24 * TILE - this.h, dt * 3); } else { this.w = 220; this.h = 220; this.x = lerp(this.x, 25 * TILE - 110, dt * 2); this.y = lerp(this.y, 3 * TILE, dt * 2); } if (this.st > 1.6) this.set('idle'); return; }
      if (this.form === 'wisp') {
        switch (this.state) {
          case 'wait': case 'idle': { const tx = p.cx + Math.sin(this.t * 0.8) * 300 - this.w / 2, ty = Math.max(3 * TILE, p.cy - 260) + Math.sin(this.t * 1.7) * 70; this.x = lerp(this.x, tx, dt * 1.6); this.y = lerp(this.y, ty, dt * 1.6);
            if (this.st > 1.0) this.set(pick(['spiral', 'dive', 'spiral', 'meteor'])); break; }
          case 'spiral': if (Math.floor(this.st / 0.12) !== Math.floor((this.st - dt) / 0.12)) { const a = this.st * 3.2; for (let k = 0; k < 2; k++) fireball(this.cx, this.cy, Math.cos(a + k * Math.PI) * 300, Math.sin(a + k * Math.PI) * 300, { r: 12 }); } if (this.st > 2.2) this.set('idle'); break;
          case 'dive': if (this.st < 0.5) { this.tgt = { x: p.cx, y: p.cy }; this.y -= 60 * dt; } else { const a = Math.atan2(this.tgt.y - this.cy, this.tgt.x - this.cx); this.x += Math.cos(a) * 1100 * dt; this.y += Math.sin(a) * 1100 * dt; G.Main.hitPlayer(this.hurtbox(), this.cx); } if (this.st > 1.1) this.set('idle'); break;
          case 'meteor': if (this.st > 0.3 && this.st < 2 && Math.random() < 0.25) fireball(rand(2, 48) * TILE, 0, rand(-60, 60), 300, { g: 600, r: 18 }); if (this.st > 2.4) this.set('idle'); break;
        }
        G.Main.hitPlayer({ x: this.x + 15, y: this.y + 15, w: this.w - 30, h: this.h - 30 }, this.cx);
      } else if (this.form === 'mirror') {
        // a flame-copy of Wick: mirrors the player's dash-slashes
        this.vy = Math.min((this.vy || 0) + 2500 * dt, 1000); const g = room.moveY(this, this.vy * dt); if (g > 0) this.vy = 0; this.ground = room.onGroundAt(this);
        switch (this.state) {
          case 'idle': this.faceP(p); this.vx = approach(this.vx || 0, this.facing * 260, 2000 * dt); if (this.st > 0.5) this.set(pick(['dashslash', 'jumpslash', 'bolt'])); break;
          case 'dashslash': if (this.st < 0.25) { this.faceP(p); this.vx = 0; } else if (this.st < 0.45) { this.vx = this.facing * 1050; if (!this.sl) { this.sl = 1; G.Sound.sfx('dash'); } G.Main.hitPlayer(this.hurtbox(), this.cx); } else { this.vx = approach(this.vx, 0, 3000 * dt); if (!this.sl2) { this.sl2 = 1; G.FX.slash(this.cx + this.facing * 50, this.cy, 'side', this.facing, { c: [255, 180, 90] }); G.Main.hitPlayer({ x: this.facing > 0 ? this.cx : this.cx - 110, y: this.y, w: 110, h: 84 }, this.cx); } if (this.st > 0.8) { this.sl = this.sl2 = 0; this.set('idle'); } } break;
          case 'jumpslash': if (this.st < dt * 1.5) { this.vy = -1000; this.faceP(p); this.vx = this.facing * 380; } if (this.vy > 0 && !this.sl) { this.sl = 1; G.FX.slash(this.cx, this.cy + 50, 'down', this.facing, { c: [255, 180, 90] }); } if (this.sl) G.Main.hitPlayer({ x: this.cx - 50, y: this.cy, w: 100, h: 110 }, this.cx); if (this.ground && this.st > 0.3) { this.sl = 0; this.set('idle'); } break;
          case 'bolt': if (this.st < dt * 1.5) { this.faceP(p); G.Sound.sfx('cast'); fireball(this.cx + this.facing * 30, this.cy - 10, this.facing * 900, 0, { r: 20, c: [255, 160, 60] }); } if (this.st > 0.6) this.set('idle'); break;
        }
        room.moveX(this, (this.vx || 0) * dt);
      } else { // sun
        switch (this.state) {
          case 'idle': this.x = lerp(this.x, 25 * TILE - this.w / 2 + Math.sin(this.t * 0.5) * 300, dt); this.y = lerp(this.y, 3 * TILE, dt * 2); if (this.st > 0.8) this.set(pick(['rings', 'rings', 'rain', 'core'])); break;
          case 'rings': if (Math.floor(this.st / 0.45) !== Math.floor((this.st - dt) / 0.45)) ringShot(this.cx, this.cy, 16, 240 * sp, this.st, { r: 13 }); if (this.st > 2.6) this.set('idle'); break;
          case 'rain': if (Math.random() < 0.35) fireball(rand(2, 48) * TILE, 0, 0, 260, { g: 700, r: 16 }); if (this.st > 2.5) this.set('idle'); break;
          case 'core': this.y = lerp(this.y, 15 * TILE, dt * 2.5); if (this.st > 2.6) this.set('idle'); break;
        }
        G.Main.hitPlayer({ x: this.cx - 70, y: this.cy - 70, w: 140, h: 140 }, this.cx);
      }
      G.FX.light(this.cx, this.cy, this.form === 'sun' ? 900 : 420, [255, 180, 90], 1);
      if (Math.random() < 0.6) G.FX.spawn({ x: this.cx + rand(-this.w / 2, this.w / 2), y: this.cy + rand(-this.h / 3, this.h / 3), vx: rand(-30, 30), vy: rand(-140, -60), life: 0.8, size: rand(2, 4), kind: 'ember', c: [255, 190, 90], add: true });
    }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    draw(ctx, t) {
      const a = this.dead ? Math.max(0, 1 - this.deadT * 0.5) : 1;
      if (this.form === 'mirror') { const fl = this.facing < 0; if (G.Sprite.meta('wick')) { const an = this.state === 'dashslash' && this.st > 0.25 ? 'dash' : !this.ground ? 'jump' : Math.abs(this.vx || 0) > 30 ? 'run' : 'idle'; G.Sprite.draw(ctx, 'wick', an, G.Sprite.frameOf('wick', an, this.t), this.cx, this.y + this.h, { flip: fl, alpha: 0.85 * a, tint: [255, 150, 50, 0.75], flash: this.flash }); } G.FX.flame(ctx, this.cx, this.y + 4, 7, t, { glow: 1.5 }); return; }
      if (this.form === 'sun') { const r = this.state === 'core' ? 70 : 110; G.FX.glow(ctx, this.cx, this.cy, r * 4, [255, 150, 60], 0.6 * a); G.FX.flame(ctx, this.cx, this.cy + r * 0.8, r / 5, t, { glow: 2 }); drawGlowBody(ctx, this.cx, this.cy, r * 0.6, [255, 200, 110], a); if (this.flash > 0.2) G.FX.glow(ctx, this.cx, this.cy, r * 1.5, [255, 255, 255], this.flash); return; }
      G.FX.flame(ctx, this.cx, this.cy + 40, 12, t, { glow: 1.6 }); drawGlowBody(ctx, this.cx, this.cy, 26, [255, 210, 130], a); if (this.flash > 0.2) G.FX.glow(ctx, this.cx, this.cy, 80, [255, 255, 255], this.flash);
    }
  }

  function create(kind, tx, ty) {
    const C = { knight: Knight, moth: Moth, angler: Angler, vesper: Vesper, extinguisher: Extinguisher, choir: Choir, colossus: Colossus, leviathan: Leviathan, captain: Captain, keeper: Keeper, paperking: PaperKing, clockmaker: Clockmaker, firstflame: FirstFlame }[kind];
    return C ? new C(tx, ty) : null;
  }
  return { create, wave };
})();
