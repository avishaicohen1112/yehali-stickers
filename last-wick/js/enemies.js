'use strict';
// Regular enemies
G.Enemies = (function () {
  const DEF = {
    wickling: { w: 46, h: 34, hp: 2, tallow: 2, type: 'walker', speed: 75, light: [255, 150, 70, 120], ppu: 50 },
    husk: { w: 48, h: 92, hp: 5, tallow: 6, type: 'charger', speed: 55, light: [255, 140, 60, 160], ppu: 50 },
    emberfly: { w: 40, h: 40, hp: 2, tallow: 3, type: 'flyer', speed: 170, light: [255, 140, 50, 200], ppu: 50 },
    mothling: { w: 56, h: 46, hp: 3, tallow: 4, type: 'diver', speed: 120, light: [190, 230, 255, 140], ppu: 50 },
    sporecap: { w: 64, h: 64, hp: 4, tallow: 5, type: 'shooter', light: [120, 255, 200, 200], ppu: 50 },
    jelly: { w: 54, h: 64, hp: 3, tallow: 4, type: 'floater', speed: 60, light: [90, 220, 255, 260], ppu: 50 },
    acolyte: { w: 46, h: 96, hp: 7, tallow: 8, type: 'lunger', speed: 80, light: [255, 200, 120, 220], ppu: 50 },
    sentinel: { w: 56, h: 100, hp: 6, tallow: 8, type: 'gunner', speed: 0, light: [220, 170, 255, 200], ppu: 50 },
    shardwing: { w: 44, h: 40, hp: 3, tallow: 5, type: 'flyer', speed: 250, light: [230, 190, 255, 160], ppu: 50 },
    crab: { w: 56, h: 40, hp: 3, tallow: 4, type: 'walker', speed: 95, light: [255, 140, 60, 120], ppu: 50 },
    gull: { w: 60, h: 44, hp: 3, tallow: 4, type: 'diver', speed: 130, light: [255, 170, 110, 120], ppu: 50 },
    cinder: { w: 38, h: 38, hp: 2, tallow: 3, type: 'flyer', speed: 200, light: [255, 120, 40, 200], ppu: 50 },
    ghostsailor: { w: 48, h: 96, hp: 7, tallow: 9, type: 'lunger', speed: 85, light: [180, 160, 255, 200], ppu: 50 },
    crane: { w: 56, h: 44, hp: 3, tallow: 5, type: 'diver', speed: 140, light: [255, 245, 225, 120], ppu: 50 },
    papersoldier: { w: 46, h: 96, hp: 6, tallow: 8, type: 'lunger', speed: 90, light: [255, 235, 200, 140], ppu: 50 },
    gear: { w: 64, h: 64, hp: 8, tallow: 9, type: 'charger', speed: 70, light: [255, 210, 130, 140], ppu: 50 },
    clockwisp: { w: 50, h: 56, hp: 4, tallow: 6, type: 'floater', speed: 70, light: [255, 215, 140, 220], ppu: 50 },
    // wind-stage enemies (ART_BRIEF_2 C19-C22)
    gustwraith: { w: 56, h: 80, hp: 5, tallow: 7, type: 'floater', speed: 50, light: [190, 225, 255, 160], ppu: 50 },
    windmoth: { w: 56, h: 44, hp: 3, tallow: 4, type: 'diver', speed: 150, light: [255, 150, 90, 120], ppu: 50 },
    anchorgrub: { w: 54, h: 40, hp: 6, tallow: 6, type: 'walker', speed: 40, light: [255, 140, 70, 110], ppu: 50 },
    barkthrower: { w: 50, h: 70, hp: 4, tallow: 5, type: 'shooter', light: [255, 170, 90, 140], ppu: 50 },
    wraith: { w: 60, h: 90, hp: 8, tallow: 12, type: 'blinker', speed: 0, light: [255, 90, 60, 200], ppu: 50 },
  };
  class Enemy {
    constructor(kind, tx, ty) {
      const d = DEF[kind]; this.kind = kind; this.d = d;
      this.w = d.w; this.h = d.h; this.hp = d.hp; this.maxHp = d.hp;
      this.x = tx * TILE - this.w / 2; this.y = ty * TILE - this.h;
      this.hx = this.x; this.hy = this.y;
      this.vx = 0; this.vy = 0; this.facing = Math.random() < 0.5 ? -1 : 1; this.t = rand(3); this.state = 'idle'; this.st = 0;
      this.flash = 0; this.kbx = 0; this.dead = false; this.deadT = 0; this.anim = 'idle'; this.animT = rand(2);
      this.ground = false; this.alpha = 1;
      if (d.type === 'walker' || d.type === 'charger' || d.type === 'lunger') this.state = 'walk';
    }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    hurtbox() { return this.dead || this.alpha < 0.4 ? null : { x: this.x, y: this.y, w: this.w, h: this.h }; }
    hitbox() { return this.dead || this.alpha < 0.5 ? null : { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 10 }; }
    hurt(dmg, dx, dy) {
      if (this.dead) return false;
      this.hp -= dmg; this.flash = 1; this.hitT = 0.2; this.hitDir = dx || 0; G.Sound.sfx('hit', { pitch: rand(0.9, 1.15) });
      const kb = this.d.type === 'shooter' || this.d.type === 'gunner' ? 0 : 1;
      this.kbx = dx * 240 * kb;  // a short shove, eased out (no teleport-like jump) if (dy && this.d.type !== 'walker') this.vy = dy * 250 * kb;
      if (this.state === 'windup' && this.d.type !== 'charger') { this.state = 'recover'; this.st = 0; }
      if (this.hp <= 0) this.die(dx, dy);
      return true;
    }
    die(dx, dy) {
      this.dead = true; this.deadT = 0; G.Sound.sfx('enemy_die');
      const L = this.d.light;
      G.FX.burst(this.cx, this.cy, 18, { speed: 380, life: 0.5, size: 3, c: [L[0], L[1], L[2]], kind: 'ember' });
      G.FX.burst(this.cx, this.cy, 10, { speed: 300, life: 0.8, size: 5, c: [28, 24, 34], kind: 'chunk', g: 1300, add: false });
      G.FX.ring(this.cx, this.cy, 10, 90, [L[0], L[1], L[2]], 0.35, 6);
      G.FX.stop(0.06); G.FX.shake(6, 0.15);
      G.Objects.dropTallow(this.cx, this.cy, this.d.tallow);
      this.vy = -300; this.kbx = (dx || 0) * 300;
    }
    update(dt, room, p) {
      this.t += dt; this.animT += dt; this.st += dt; this.flash = Math.max(0, this.flash - dt * 9);
      if (this.dead) { this.deadT += dt; return; }
      const d = this.d, dxp = p.cx - this.cx, dyp = p.cy - this.cy, dp = Math.hypot(dxp, dyp);
      const see = dp < 560 && !p.dead && room.los(this.cx, this.cy, p.cx, p.cy);
      this.kbx = approach(this.kbx, 0, 1300 * dt); this.hitT = Math.max(0, (this.hitT || 0) - dt);
      switch (d.type) {
        case 'walker': case 'charger': case 'lunger': this.walkAI(dt, room, p, dxp, dyp, see); break;
        case 'flyer': this.flyAI(dt, room, p, dxp, dyp, dp, see); break;
        case 'diver': this.diveAI(dt, room, p, dxp, dyp, dp, see); break;
        case 'shooter': this.shootAI(dt, room, p, dxp, dyp, dp, see); break;
        case 'floater': this.floatAI(dt, room, p, dxp, dyp, dp); break;
        case 'gunner': this.gunAI(dt, room, p, dxp, dyp, dp, see); break;
        case 'blinker': this.blinkAI(dt, room, p, dxp, dyp, dp); break;
      }
      // contact damage
      const hb = this.hitbox(); if (hb && overlap(hb, p.hitbox())) p.damage(1, this.cx);
      if (d.light) G.FX.light(this.cx, this.cy, d.light[3], [d.light[0], d.light[1], d.light[2]], 0.9);
    }
    gravity(dt, room) {
      this.vy = Math.min(this.vy + 2400 * dt, 1000);
      if (room.moveY(this, this.vy * dt) > 0) this.vy = 0;
      this.ground = room.onGroundAt(this);
    }
    walkAI(dt, room, p, dxp, dyp, see) {
      const d = this.d;
      let vx = 0;
      if (this.state === 'walk') {
        vx = this.facing * d.speed; this.anim = 'walk';
        if (this.ground && (room.wallAhead(this, this.facing) || room.edgeAhead(this, this.facing) || room.hazardAhead(this, this.facing))) this.facing *= -1;
        if (d.type === 'charger' && see && Math.abs(dyp) < 90 && Math.abs(dxp) < 460 && this.st > 0.6) { this.state = 'windup'; this.st = 0; this.facing = sign(dxp) || 1; G.Sound.sfx('boss_roar', { vol: 0.25, pitch: 2.2 }); }
        if (d.type === 'lunger' && see && Math.abs(dyp) < 90 && Math.abs(dxp) < 300 && this.st > 0.8) { this.state = 'windup'; this.st = 0; this.facing = sign(dxp) || 1; }
        if (d.type === 'lunger' && see && Math.abs(dyp) < 90 && Math.abs(dxp) < 600) this.facing = sign(dxp) || this.facing;
      } else if (this.state === 'windup') {
        this.anim = 'windup'; vx = 0;
        if (this.st > (d.type === 'charger' ? 0.45 : 0.4)) { this.state = 'attack'; this.st = 0; if (d.type === 'lunger') { G.Sound.sfx('slash', { pitch: 0.7 }); G.FX.slash(this.cx + this.facing * 55, this.cy - 8, 'side', this.facing, { dur: 0.2, c: [255, 200, 140], follow: this, big: 1.1 }); } }
      } else if (this.state === 'attack') {
        this.anim = 'attack';
        if (d.type === 'charger') { vx = this.facing * 360; if (this.st > 1.3 || room.wallAhead(this, this.facing) || room.edgeAhead(this, this.facing)) { this.state = 'recover'; this.st = 0; } if (Math.random() < 0.3) G.FX.spawn({ x: this.cx, y: this.y + this.h, vx: -this.facing * 80, vy: -40, life: 0.4, size: 6, kind: 'smoke', c: [60, 50, 50], a: 0.4 }); }
        else { vx = this.facing * 520 * Math.max(0, 1 - this.st / 0.3); this.atkBox = { x: this.facing > 0 ? this.cx : this.cx - 90, y: this.y + 20, w: 90, h: 60 };
          if (overlap(this.atkBox, p.hitbox())) p.damage(1, this.cx);
          if (this.st > 0.35) { this.state = 'recover'; this.st = 0; this.atkBox = null; }
          if (room.edgeAhead(this, this.facing)) vx = 0; }
      } else if (this.state === 'recover') { this.anim = 'idle'; vx = 0; if (this.st > 0.6) { this.state = 'walk'; this.st = 0; } }
      else this.state = 'walk';
      room.moveX(this, (vx + this.kbx) * dt);
      this.gravity(dt, room);
    }
    flyAI(dt, room, p, dxp, dyp, dp, see) {
      const d = this.d; this.anim = 'fly';
      if (see && dp < 480) {
        this.vx = approach(this.vx, dxp / dp * d.speed, 300 * dt); this.vy = approach(this.vy, dyp / dp * d.speed, 300 * dt); this.facing = sign(dxp) || this.facing;
      } else {
        this.vx = approach(this.vx, Math.cos(this.t * 0.7) * 40, 100 * dt); this.vy = approach(this.vy, Math.sin(this.t * 1.3) * 40 + (this.hy - this.y) * 0.5, 100 * dt);
      }
      if (room.moveX(this, (this.vx + this.kbx) * dt)) this.vx *= -0.5;
      if (room.moveY(this, this.vy * dt)) this.vy *= -0.5;
    }
    diveAI(dt, room, p, dxp, dyp, dp, see) {
      const d = this.d;
      if (this.state === 'idle') {
        this.anim = 'fly';
        const tx = this.hx + Math.sin(this.t * 0.8) * 60, ty = this.hy + Math.sin(this.t * 1.7) * 25;
        this.vx = approach(this.vx, (tx - this.x) * 2, 400 * dt); this.vy = approach(this.vy, (ty - this.y) * 2, 400 * dt);
        if (see && dp < 520 && this.st > 1.2) { this.state = 'windup'; this.st = 0; this.facing = sign(dxp) || 1; this.tgt = { x: p.cx, y: p.cy }; }
      } else if (this.state === 'windup') {
        this.anim = 'windup'; this.vx *= 0.9; this.vy = approach(this.vy, -60, 600 * dt); this.tgt = { x: p.cx, y: p.cy };
        if (this.st > 0.5) { this.state = 'attack'; this.st = 0; const a = Math.atan2(this.tgt.y - this.cy, this.tgt.x - this.cx); this.vx = Math.cos(a) * 620; this.vy = Math.sin(a) * 620; G.Sound.sfx('swoop'); }
      } else if (this.state === 'attack') {
        this.anim = 'attack'; if (this.st > 0.55) { this.state = 'recover'; this.st = 0; }
      } else { this.anim = 'fly'; this.vx = approach(this.vx, (this.hx - this.x) * 1.5, 900 * dt); this.vy = approach(this.vy, (this.hy - this.y) * 1.5, 900 * dt); if (this.st > 1.0) { this.state = 'idle'; this.st = 0; } }
      if (room.moveX(this, (this.vx + this.kbx) * dt)) { this.vx *= -0.3; if (this.state === 'attack') { this.state = 'recover'; this.st = 0; } }
      if (room.moveY(this, this.vy * dt)) { this.vy *= -0.3; if (this.state === 'attack') { this.state = 'recover'; this.st = 0; } }
      if (Math.abs(this.vx) > 30) this.facing = sign(this.vx);
    }
    shootAI(dt, room, p, dxp, dyp, dp, see) {
      this.anim = this.state === 'windup' ? 'windup' : 'idle'; this.facing = sign(dxp) || 1;
      if (this.state !== 'windup' && see && dp < 650 && this.st > 2.2) { this.state = 'windup'; this.st = 0; }
      if (this.state === 'windup' && this.st > 0.55) {
        this.state = 'idle'; this.st = 0; G.Sound.sfx('spore');
        for (let i = -1; i <= 1; i++) G.Objects.spawnProj({ kind: 'spore', x: this.cx, y: this.y + 10, vx: dxp * 0.9 + i * 170, vy: -620 + Math.abs(i) * 80, g: 1300, r: 14, life: 3, dmg: 1 });
        G.FX.burst(this.cx, this.y + 10, 14, { speed: 200, life: 0.6, size: 6, c: [120, 255, 200], kind: 'smoke', a: 0.3, add: true });
      }
      this.gravity(dt, room);
    }
    floatAI(dt, room, p, dxp, dyp, dp) {
      this.anim = 'idle';
      const ty = this.hy + Math.sin(this.t * 1.1) * 70;
      this.vy = approach(this.vy, (ty - this.y) * 1.5, 300 * dt);
      this.vx = approach(this.vx, dp < 420 ? sign(dxp) * this.d.speed : 0, 60 * dt);
      if (room.moveX(this, (this.vx + this.kbx) * dt)) this.vx *= -1;
      room.moveY(this, this.vy * dt);
      if (this.kind === 'gustwraith') {  // telegraphed blast that shoves the hero away
        if (this.state !== 'windup' && dp < 480 && this.st > 2.6) { this.state = 'windup'; this.st = 0; }
        if (this.state === 'windup') {
          this.anim = 'windup'; this.facing = sign(dxp) || 1;
          if (Math.random() < 0.6) G.FX.spawn({ x: this.cx + rand(-60, 60), y: this.cy + rand(-60, 60), vx: (this.cx - p.cx) * 0.02, vy: 0, life: 0.4, size: 1.5, kind: 'streak', c: [200, 230, 255], a: 0.6, add: true });
          if (this.st > 0.7) {
            this.state = 'idle'; this.st = 0; G.Sound.sfx('swoop', { pitch: 0.6 });
            for (let i = 0; i < 24; i++) G.FX.spawn({ x: this.cx, y: this.cy + rand(-40, 40), vx: this.facing * rand(500, 900), vy: rand(-60, 60), life: 0.6, size: 1.6, kind: 'streak', c: [210, 235, 255], a: 0.8, add: true });
            if (dp < 520 && Math.abs(dyp) < 160 && !p.dead) { p.vx = this.facing * 900; p.vy = Math.min(p.vy, -260); p.recoilT = 0.25; }
          }
        }
      }
    }
    gunAI(dt, room, p, dxp, dyp, dp, see) {
      this.facing = sign(dxp) || 1;
      if (this.state !== 'windup' && see && dp < 760 && this.st > 1.8) { this.state = 'windup'; this.st = 0; }
      this.anim = this.state === 'windup' ? 'windup' : 'idle';
      if (this.state === 'windup' && this.st > 0.6) {
        this.state = 'idle'; this.st = 0; G.Sound.sfx('shard');
        const a = Math.atan2(dyp - 20, dxp);
        for (let i = -1; i <= 1; i++) G.Objects.spawnProj({ kind: 'shard', x: this.cx + this.facing * 20, y: this.y + 30, vx: Math.cos(a + i * 0.16) * 640, vy: Math.sin(a + i * 0.16) * 640, r: 12, life: 2.5, dmg: 1 });
      }
      this.gravity(dt, room);
    }
    blinkAI(dt, room, p, dxp, dyp, dp) {
      if (this.state === 'idle') {
        this.anim = 'idle'; this.alpha = approach(this.alpha, 1, dt * 3);
        this.vx = approach(this.vx, Math.sin(this.t) * 50, 100 * dt); this.vy = approach(this.vy, Math.cos(this.t * 1.3) * 30, 100 * dt);
        if (dp < 700 && this.st > 1.6) { this.state = 'fade'; this.st = 0; }
      } else if (this.state === 'fade') {
        this.alpha = Math.max(0, 1 - this.st * 2.5);
        if (this.st > 0.6) {
          const side = Math.random() < 0.5 ? -1 : 1; let nx = p.cx + side * 190 - this.w / 2, ny = p.cy - 60 - this.h / 2;
          if (room.solidAt(nx + this.w / 2, ny + this.h / 2)) nx = p.cx - side * 190 - this.w / 2;
          if (!room.solidAt(nx + this.w / 2, ny + this.h / 2)) { this.x = nx; this.y = ny; }
          this.state = 'windup'; this.st = 0; this.facing = sign(p.cx - this.cx) || 1;
        }
      } else if (this.state === 'windup') {
        this.anim = 'windup'; this.alpha = Math.min(1, this.st * 3); this.vx = 0; this.vy = 0;
        if (this.st > 0.55) { this.state = 'attack'; this.st = 0; const a = Math.atan2(p.cy - this.cy, p.cx - this.cx); this.vx = Math.cos(a) * 700; this.vy = Math.sin(a) * 700; G.Sound.sfx('swoop', { pitch: 0.7 }); }
      } else if (this.state === 'attack') {
        this.anim = 'attack'; if (this.st > 0.4) { this.state = 'idle'; this.st = 0; }
        if (Math.random() < 0.7) G.FX.spawn({ x: this.cx, y: this.cy, vx: 0, vy: -30, life: 0.6, size: 12, kind: 'smoke', c: [30, 20, 25], a: 0.4 });
      }
      this.vx *= 0.995;
      if (room.moveX(this, (this.vx + this.kbx) * dt)) this.vx = 0;
      if (room.moveY(this, this.vy * dt)) this.vy = 0;
    }
    draw(ctx, t) {
      const fx = this.cx, fy = this.y + this.h;
      let a = this.dead ? Math.max(0, 1 - this.deadT * 2.5) : this.alpha;
      if (a <= 0) return;
      const shake = this.state === 'windup' ? Math.sin(this.t * 60) * 2 : 0;
      const atlas = 'e_' + this.kind;
      if (window.RIGS && window.RIGS[atlas]) {
        if (!this.pup) this.pup = new G.Puppet.Puppet(atlas);
        const R = window.RIGS[atlas]; this.pup.play(R.clips[this.anim] ? this.anim : (R.clips.idle ? 'idle' : Object.keys(R.clips)[0]));
        this.pup.update(1 / 60, { vx: this.vx, vy: this.vy, facing: this.facing });
        this.pup.draw(ctx, fx + shake, fy + (this.dead ? this.deadT * 60 : 0), { flip: this.facing < 0, alpha: a, flash: this.flash * 0.85 });
      } else if (G.Sprite.meta(atlas)) {
        const m = G.Sprite.meta(atlas); let an = m.anims[this.anim] ? this.anim : (m.anims.idle ? 'idle' : Object.keys(m.anims)[0]);
        if (this.anim === 'walk' && !m.anims.walk && m.anims.fly) an = 'fly';
        if (this.hitT > 0 && m.anims.hurt && !this.dead) an = 'hurt';  // painted 'got hit' pose from the 16-pose sheets (C2)
        const fi = G.Sprite.frameOf(atlas, an, this.animT);
        // painted sheets with few poses get a little procedural life: step bob, hover, breathing
        let yo = 0, sy = this.dead ? 1 - this.deadT : 1;
        if (m.v === 2 && !this.dead) { const A = m.anims[an];
          if (an === 'walk' && A.n <= 4) yo = -Math.abs(Math.sin(this.animT * A.fps * Math.PI)) * 3;
          else if (an === 'fly') yo = Math.sin(this.t * 5 + this.x * 0.01) * 3;
          else if (an === 'idle' && A.n <= 2) sy *= 1 + Math.sin(this.t * 2.2 + this.x * 0.01) * 0.02; }
        // hit reaction: a quick squash and a lean away from the blow, warm glint instead of a white silhouette
        const hk = this.hitT > 0 ? Math.sin((1 - this.hitT / 0.2) * Math.PI) : 0;
        const rot = hk * 0.12 * (this.hitDir || 0), sq = 1 - hk * 0.08;
        G.Sprite.draw(ctx, atlas, an, fi, fx + shake, fy + yo + (this.dead ? this.deadT * 60 : 0), { flip: this.facing < 0, alpha: a, flash: this.flash * 0.45, tint: this.flash > 0.05 ? [255, 190, 120, this.flash * 0.35] : null, ppu: this.d.ppu, sy: sy * sq, rot });
      } else {
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = this.flash > 0 ? '#fff' : '#15121c';
        ctx.beginPath(); ctx.ellipse(fx + shake, this.cy, this.w / 2, this.h / 2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = rgba(this.d.light, 1); ctx.beginPath(); ctx.arc(fx + this.facing * this.w * 0.2, this.cy - 4, 4, 0, 7); ctx.fill(); ctx.restore();
      }
    }
    drawGlow(ctx) {
      if (this.dead) return; const L = this.d.light;
      G.FX.glow(ctx, this.cx, this.cy, L[3] * 0.6, [L[0], L[1], L[2]], 0.25 * this.alpha);
    }
  }
  return { Enemy, DEF };
})();
