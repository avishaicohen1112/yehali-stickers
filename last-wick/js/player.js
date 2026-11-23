'use strict';
// The protagonist: Wick
G.Player = (function () {
  const C = {
    RUN: 340, ACC_G: 5200, ACC_A: 3400, GRAV: 2500, FALL_MULT: 1.4, MAXFALL: 1050, JUMP: 940, DJUMP: 840,
    COYOTE: 0.1, BUFFER: 0.13, DASH_V: 1000, DASH_T: 0.19, DASH_CD: 0.42, WALL_SLIDE: 230, WJ_VX: 470, WJ_VY: 900,
    ATK_T: 0.29, ATK_CD: 0.36, POGO: 830, HURT_INV: 1.35, FOCUS_T: 0.85, SPELL_COST: 33, HEAL_COST: 33
  };
  class Player {
    constructor(x, y) {
      this.w = 30; this.h = 82; this.x = x - this.w / 2; this.y = y - this.h;
      this.vx = 0; this.vy = 0; this.facing = 1; this.ground = false; this.coyote = 0; this.buffer = 0;
      this.djumped = false; this.dashT = 0; this.dashCd = 0; this.airDashed = false; this.jumpHeld = false; this.cut = false;
      this.atkT = 0; this.atkCd = 0; this.atkDir = 'side'; this.atkHit = new Set();
      this.inv = 0; this.hurtT = 0; this.lock = 0; this.wall = 0; this.wallJumpT = 0;
      this.focusHold = 0; this.focusT = 0; this.focusing = false; this.castT = 0;
      this.anim = 'idle'; this.animT = 0; this.landT = 0; this.dead = false; this.deadT = 0; this.sitting = false;
      this.safe = { x: this.x, y: this.y }; this.safeT = 0; this.stepT = 0; this.recoilT = 0; this.flameT = 0;
      this.hazardT = 0; this.djumpT = 0; this.runPhase = 0;
      this.pup = window.RIGS && window.RIGS.wick ? new G.Puppet.Puppet('wick') : null;
    }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    get feet() { return this.y + this.h; }
    hitbox() { return { x: this.x + 3, y: this.y + 14, w: this.w - 6, h: this.h - 16 }; }
    setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }
    update(dt, room) {
      const I = G.Input, S = G.state, A = S.abil;
      this.animT += dt; this.flameT += dt; if (this.anim === 'run') this.runPhase += dt * Math.abs(this.vx);
      if (this.dead) { this.deadT += dt; this.vx *= 0.9; this.vy = Math.min(this.vy + C.GRAV * dt, C.MAXFALL); room.moveY(this, this.vy * dt); this.setAnim('death'); return; }
      if (this.hazardT > 0) { this.hazardT -= dt; if (this.hazardT <= 0) { this.x = this.safe.x; this.y = this.safe.y; this.vx = this.vy = 0; this.inv = Math.max(this.inv, 0.8); G.Main.fadeIn(0.3); } return; }
      if (this.sitting) {
        this.setAnim('sit'); this.vx = 0;
        if (I.p('left') || I.p('right') || I.p('jump') || I.p('down') || I.p('attack')) { this.sitting = false; I.consume('jump'); }
        return;
      }
      this.inv = Math.max(0, this.inv - dt); this.lock = Math.max(0, this.lock - dt); this.hurtT = Math.max(0, this.hurtT - dt);
      this.dashCd = Math.max(0, this.dashCd - dt); this.atkCd = Math.max(0, this.atkCd - dt); this.castT = Math.max(0, this.castT - dt);
      this.wallJumpT = Math.max(0, this.wallJumpT - dt); this.landT = Math.max(0, this.landT - dt); this.djumpT = Math.max(0, this.djumpT - dt); this.recoilT = Math.max(0, this.recoilT - dt);
      const L = I.h('left'), R = I.h('right'), U = I.h('up'), D = I.h('down');
      let mx = (R ? 1 : 0) - (L ? 1 : 0);
      if (this.lock > 0) mx = 0;
      // ---- focus / spell
      if (I.h('focus') && this.lock <= 0 && this.dashT <= 0) {
        this.focusHold += dt;
        if (this.focusHold > 0.22 && this.ground && S.soul >= C.HEAL_COST && S.hp < S.hpMax) {
          if (!this.focusing) { this.focusing = true; this.focusT = 0; G.Sound.sfx('focus'); }
          this.focusT += dt;
          if (Math.random() < dt * 40) G.FX.spawn({ x: this.cx + rand(-40, 40), y: this.feet - rand(0, 20), vx: 0, vy: rand(-120, -60), life: 0.8, size: 2.2, kind: 'ember', c: [255, 190, 110], add: true });
          if (this.focusT >= C.FOCUS_T) {
            S.soul -= C.HEAL_COST; S.hp = Math.min(S.hpMax, S.hp + 1); this.focusT = 0; G.Sound.sfx('heal');
            G.FX.burst(this.cx, this.y + 10, 24, { speed: 260, life: 0.7, size: 3, c: [255, 210, 140], kind: 'ember', drag: 3 });
            G.FX.ring(this.cx, this.cy, 10, 120, [255, 200, 120], 0.5, 8); G.FX.flash('#ffd7a0', 0.15, 0.3);
            if (S.soul < C.HEAL_COST || S.hp >= S.hpMax) { this.focusing = false; }
          }
        } else if (this.focusing && !(S.soul >= C.HEAL_COST && S.hp < S.hpMax)) this.focusing = false;
      } else {
        if (this.focusHold > 0 && this.focusHold <= 0.22 && !this.focusing) this.tryCast(room);
        this.focusHold = 0; this.focusing = false; this.focusT = 0;
      }
      if (this.focusing) mx = 0;
      // ---- facing
      if (mx && this.atkT <= 0 && this.dashT <= 0 && this.wallJumpT <= 0) this.facing = mx;
      // ---- dash
      if (I.p('dash') && A.dash && this.dashCd <= 0 && this.dashT <= 0 && this.lock <= 0 && !(this.airDashed && !this.ground) && !this.focusing) {
        if (this.wall && !this.ground) this.facing = -this.wall;
        this.dashT = C.DASH_T; this.dashCd = C.DASH_CD; if (!this.ground) this.airDashed = true;
        this.atkT = 0; G.Sound.sfx('dash'); this.setAnim('dash');
        for (let i = 0; i < 10; i++) G.FX.spawn({ x: this.cx, y: this.cy + rand(-25, 25), vx: -this.facing * rand(100, 400), vy: rand(-30, 30), life: 0.45, size: rand(6, 14), kind: 'smoke', c: [40, 34, 50], a: 0.5, drag: 4 });
      }
      if (this.dashT > 0) {
        this.dashT -= dt; this.vx = this.facing * C.DASH_V; this.vy = 0;
        if (A.shadow) { this.inv = Math.max(this.inv, 0.06); if (Math.random() < 0.9) G.FX.spawn({ x: this.cx - this.facing * rand(0, 30), y: this.cy + rand(-30, 30), vx: -this.facing * rand(20, 120), vy: rand(-30, 30), life: 0.5, size: rand(8, 16), kind: 'smoke', c: [20, 10, 30], a: 0.6 }); }
        if (Math.random() < 0.8) G.FX.spawn({ x: this.cx - this.facing * 20, y: this.cy + rand(-30, 30), vx: -this.facing * 60, vy: rand(-20, 20), life: 0.3, size: 2, kind: 'ember', c: [255, 170, 90], add: true });
        if (this.dashT <= 0) this.vx = this.facing * C.RUN * 0.8;
      } else {
        // ---- horizontal
        if (this.wallJumpT <= 0 && this.recoilT <= 0) {
          const acc = this.ground ? C.ACC_G : C.ACC_A;
          this.vx = approach(this.vx, mx * C.RUN, acc * dt);
        } else if (this.recoilT > 0) this.vx = approach(this.vx, 0, 2000 * dt);
        // ---- gravity
        const grav = C.GRAV * (this.vy > 0 ? C.FALL_MULT : 1);
        this.vy = Math.min(this.vy + grav * dt, C.MAXFALL);
        this.gliding = A.glide && !this.ground && this.vy > 0 && I.h('jump') && this.wallJumpT <= 0 && !this.wall;
        if (this.gliding) { this.vy = Math.min(this.vy, 150); if (Math.random() < dt * 14) G.FX.spawn({ x: this.cx + rand(-24, 24), y: this.y + 10, vx: rand(-20, 20), vy: -30, life: 0.7, size: 2, kind: 'mote', ph: rand(6), a: 0.8, c: [255, 200, 140], add: true }); }
        // wall slide
        this.wall = 0;
        if (A.wall && !this.ground && this.lock <= 0) {
          const pushR = mx > 0 && room.solidAt(this.x + this.w + 3, this.cy) && room.solidAt(this.x + this.w + 3, this.y + 18);
          const pushL = mx < 0 && room.solidAt(this.x - 3, this.cy) && room.solidAt(this.x - 3, this.y + 18);
          if (pushR) this.wall = 1; if (pushL) this.wall = -1;
          if (this.wall && this.vy > 0) {
            this.vy = Math.min(this.vy, C.WALL_SLIDE); this.djumped = false; this.airDashed = false;
            if (Math.random() < dt * 20) G.FX.spawn({ x: this.wall > 0 ? this.x + this.w : this.x, y: this.y + 30, vx: -this.wall * rand(10, 60), vy: rand(-40, 10), life: 0.4, size: 2, kind: 'chunk', c: [120, 110, 100], g: 600 });
          }
        }
        // ---- jump
        if (I.p('jump')) this.buffer = C.BUFFER; else this.buffer = Math.max(0, this.buffer - dt);
        if (this.buffer > 0 && this.lock <= 0 && !this.focusing) {
          if (this.ground || this.coyote > 0) {
            this.vy = -C.JUMP; this.ground = false; this.coyote = 0; this.buffer = 0; this.cut = false; G.Sound.sfx('jump');
            G.FX.burst(this.cx, this.feet, 6, { speed: 120, life: 0.4, size: 7, c: [70, 62, 70], kind: 'smoke', angle: -Math.PI / 2, spread: 1.2, add: false });
          } else if (this.wall && A.wall) {
            this.vy = -C.WJ_VY; this.vx = -this.wall * C.WJ_VX; this.facing = -this.wall; this.wallJumpT = 0.16; this.buffer = 0; this.cut = false;
            this.wall = 0; G.Sound.sfx('walljump');
          } else if (A.djump && !this.djumped) {
            this.vy = -C.DJUMP; this.djumped = true; this.djumpT = 0.3; this.buffer = 0; this.cut = false; G.Sound.sfx('djump');
            for (let i = 0; i < 2; i++) for (let k = 0; k < 7; k++) G.FX.spawn({ x: this.cx + (i ? 1 : -1) * rand(8, 40), y: this.cy + rand(0, 30), vx: (i ? 1 : -1) * rand(60, 200), vy: rand(60, 220), life: 0.5, size: rand(2, 3.5), kind: 'mote', ph: rand(6), a: 1, c: [230, 235, 255], add: true });
          }
        }
        if (!I.h('jump') && this.vy < 0 && !this.cut && this.wallJumpT <= 0) { this.vy *= 0.45; this.cut = true; }
      }
      // ---- attack
      if (I.p('attack') && this.atkCd <= 0 && this.dashT <= 0 && !this.focusing && this.lock <= 0) {
        this.atkDir = U ? 'up' : (D && !this.ground ? 'down' : 'side');
        this.atkT = C.ATK_T; this.atkCd = C.ATK_CD; this.atkHit = new Set(); this.atkAlt = !this.atkAlt;
        G.Sound.sfx('slash', { pitch: rand(0.9, 1.1) });
        const o = this.atkDir === 'up' ? [0, -62] : this.atkDir === 'down' ? [0, 58] : [this.facing * 52, -2];
        G.FX.slash(this.cx + o[0], this.cy + o[1], this.atkDir, this.facing, { follow: this, big: this.atkDir === 'side' ? 1.05 : 1 });
      }
      if (this.atkT > 0) {
        this.atkT -= dt;
        const el = C.ATK_T - this.atkT;
        if (el > 0.015 && el < 0.14) this.doHits(room);
      }
      // ---- integrate
      const wasGround = this.ground;
      const dropThrough = D && I.p('jump') && false;
      room.shadowPass = this.dashT > 0 && A.shadow;
      const hx = room.moveX(this, this.vx * dt);
      if (hx && this.dashT > 0) { this.dashT = 0; }
      if (hx) this.vx = 0;
      const hy = room.moveY(this, this.vy * dt, dropThrough);
      // never end a shadow dash inside a shadow gate: keep dashing through
      if (room.shadowPass && room.touches(this, 'x', 2)) { this.dashT = Math.max(this.dashT, 0.03); }
      room.shadowPass = false;
      if (hy > 0) { this.vy = 0; } else if (hy < 0) { this.vy = Math.max(this.vy, 60); }
      this.ground = hy > 0 || (this.vy >= 0 && room.onGroundAt(this));
      if (this.ground) { this.coyote = C.COYOTE; this.djumped = false; this.airDashed = false; }
      else this.coyote = Math.max(0, this.coyote - dt);
      if (this.ground && !wasGround) {
        this.landT = 0.12; G.Sound.sfx('land', { vol: 0.6 });
        G.FX.burst(this.cx, this.feet, 8, { speed: 150, life: 0.45, size: 8, c: [60, 55, 64], kind: 'smoke', angle: -Math.PI / 2, spread: 1.4, add: false });
      }
      // footsteps
      if (this.ground && Math.abs(this.vx) > 50 && this.dashT <= 0) {
        this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.28; G.Sound.sfx('step', { vol: 0.5, pitch: rand(0.9, 1.1) });
          if (Math.random() < 0.6) G.FX.spawn({ x: this.cx - this.facing * 10, y: this.feet - 2, vx: -this.facing * 40, vy: -30, life: 0.5, size: 5, kind: 'smoke', c: [60, 55, 64], a: 0.3, drag: 3 }); }
      }
      // ---- safe spot for hazard respawn
      if (this.ground && this.dashT <= 0) {
        this.safeT += dt;
        const probeL = { x: this.x - 30, y: this.y, w: this.w + 60, h: this.h + 4 };
        if (this.safeT > 0.15 && !room.touches(probeL, '^~', 0) && room.onGroundAt({ x: this.x - 20, y: this.y, w: this.w + 40, h: this.h })) this.safe = { x: this.x, y: this.y };
      } else this.safeT = 0;
      // ---- hazards
      const hz = room.touches(this, '^~');
      if (hz && this.hazardT <= 0) {
        if (hz === '~') { G.Sound.sfx('splash'); G.FX.burst(this.cx, this.feet, 20, { speed: 300, life: 0.6, size: 3, c: [120, 160, 255], kind: 'spark', g: 900, angle: -Math.PI / 2, spread: 0.8 }); }
        this.damage(1, 0, true);
        if (!this.dead) { this.hazardT = 0.45; this.vx = 0; this.vy = 0; G.Main.fadeOut(0.25); }
      }
      // ---- interact
      if ((I.p('up') || I.p('interact')) && this.ground && this.atkT <= 0) G.Objects.interact(this);
      this.pickAnim();
      if (this.pup) this.pup.update(dt, { vx: this.vx, vy: this.vy, facing: this.facing });
    }
    tryCast(room) {
      const S = G.state; if (!S.abil.spell || S.soul < C.SPELL_COST || this.castT > 0 || this.lock > 0) return;
      S.soul -= C.SPELL_COST; this.castT = 0.32; this.setAnim('cast'); G.Sound.sfx('cast');
      G.Objects.spawnProj({ kind: 'bolt', x: this.cx + this.facing * 30, y: this.cy - 18, vx: this.facing * 1150, vy: 0, friendly: true, dmg: 2.5 * (S.spellMul || 1), r: 22, life: 1.2 });
      this.vx = -this.facing * 220; this.recoilT = 0.12; G.FX.shake(5, 0.15);
    }
    doHits(room) {
      const d = this.atkDir; let hb;
      if (d === 'side') hb = { x: this.facing > 0 ? this.cx : this.cx - 112, y: this.cy - 48, w: 112, h: 86 };
      else if (d === 'up') hb = { x: this.cx - 55, y: this.y - 92, w: 110, h: 112 };
      else hb = { x: this.cx - 50, y: this.cy, w: 100, h: 120 };
      const dmg = G.state.needle;
      let any = false;
      for (const e of G.Main.enemies()) {
        if (e.dead || this.atkHit.has(e) || !e.hurtbox) continue;
        const ehb = e.hurtbox(); if (!ehb || !overlap(hb, ehb)) continue;
        this.atkHit.add(e); any = true;
        const dx = d === 'side' ? this.facing : 0, dy = d === 'up' ? -1 : d === 'down' ? 1 : 0;
        const res = e.hurt(dmg, dx, dy, 'needle');
        if (res !== false && !e.noSoul) G.state.soul = Math.min(G.state.soulMax, G.state.soul + 11);
        const hx = clamp(this.cx + dx * 60, ehb.x, ehb.x + ehb.w), hy = clamp(this.cy + dy * 60, ehb.y, ehb.y + ehb.h);
        G.FX.burst(hx, hy, 12, { speed: 520, life: 0.25, size: 2.5, c: [255, 240, 220], kind: 'spark', angle: Math.atan2(dy, dx || (dy ? 0 : this.facing)), spread: 0.9 });
        G.FX.ring(hx, hy, 6, 50, [255, 235, 200], 0.18, 5);
      }
      // objects (breakables, levers)
      if (G.Objects.hit(hb, this)) any = true;
      if (any) {
        G.FX.stop(0.045); G.FX.shake(4, 0.1);
        if (d === 'down') { this.vy = -C.POGO; this.djumped = false; this.airDashed = false; this.cut = true; this.atkT = Math.min(this.atkT, 0.1); }
        else if (d === 'side') { this.vx = -this.facing * 260; this.recoilT = 0.08; }
      } else {
        // clang on walls
        if (d === 'side' && this.atkT > C.ATK_T - 0.04) {
          const wx = this.cx + this.facing * 70;
          if (room.solidAt(wx, this.cy) && !this.clanged) { this.clanged = true; G.Sound.sfx('clank'); G.FX.burst(wx - this.facing * 8, this.cy, 8, { speed: 300, life: 0.2, size: 2, c: [255, 220, 170], kind: 'spark', angle: this.facing > 0 ? Math.PI : 0, spread: 0.8 }); }
        }
      }
      if (this.atkT < C.ATK_T - 0.1) this.clanged = false;
    }
    damage(n, fromX, hazard) {
      if (this.dead || (!hazard && this.inv > 0)) return false;
      const S = G.state; S.hp -= n; this.focusing = false; this.focusT = 0; this.dashT = 0; this.sitting = false;
      G.Sound.sfx('hurt'); G.FX.stop(0.16); G.FX.shake(12, 0.3); G.FX.flash('#ffffff', 0.35, 0.35);
      G.FX.burst(this.cx, this.cy, 26, { speed: 520, life: 0.6, size: 3, c: [20, 18, 30], kind: 'chunk', g: 1200, add: false });
      G.FX.burst(this.cx, this.cy, 14, { speed: 420, life: 0.35, size: 3, c: [255, 250, 240], kind: 'spark' });
      this.inv = C.HURT_INV;
      if (S.hp <= 0) { S.hp = 0; this.die(); return true; }
      if (!hazard) {
        const dir = fromX === undefined || fromX === null ? -this.facing : sign(this.cx - fromX) || -this.facing;
        this.vx = dir * 420; this.vy = -520; this.lock = 0.22; this.recoilT = 0; this.hurtT = 0.3; this.atkT = 0;
      }
      return true;
    }
    die() {
      this.dead = true; this.deadT = 0; this.setAnim('death'); G.Sound.sfx('death'); G.FX.stop(0.3); G.Main.onPlayerDeath();
    }
    pickAnim() {
      let a;
      if (this.hurtT > 0) a = 'hurt';
      else if (this.dashT > 0) a = 'dash';
      else if (this.castT > 0) a = 'cast';
      else if (this.atkT > 0) a = this.atkDir === 'up' ? 'slashup' : this.atkDir === 'down' ? 'slashdown' : 'slash';
      else if (this.focusing) a = 'focus';
      else if (!this.ground) a = this.wall && this.vy > 0 ? 'wall' : this.gliding ? 'glide' : this.djumpT > 0 && this.vy < 0 ? 'djump' : this.vy < 0 ? 'jump' : 'fall';
      else if (this.landT > 0) a = 'land';
      else a = Math.abs(this.vx) > 30 ? 'run' : 'idle';
      // poses that only the painted (v2) atlas has fall back to the nearest older one
      if (!G.Sprite.has('wick', a)) a = ({ glide: 'fall', djump: 'jump', lookup: 'idle', slashup: 'slash', slashdown: 'slash', wall: 'fall', cast: 'focus', sit: 'idle', death: 'hurt' })[a] || a;
      this.setAnim(a);
    }
    draw(ctx) {
      if (this.pup) {
        const flip = (this.anim === 'wall' ? -this.wall : this.facing) < 0, fx = this.cx, fy = this.feet + 1;
        const blink = this.inv > 0 && !this.dead && Math.floor(this.inv * 14) % 2 === 0;
        this.pup.play(this.anim);
        const T = window.RIGS.wick.points && window.RIGS.wick.points.tip;
        this.tip = T ? this.pup.point(T[0], T[1], T[2], fx, fy, flip) : { x: fx, y: this.y };
        if (this.hazardT > 0) return;
        this.pup.draw(ctx, fx, fy, { flip, alpha: blink ? 0.45 : 1, flash: this.hurtT > 0.2 ? 0.8 : 0 });
        return;
      }
      const meta = G.Sprite.meta('wick');
      const an = meta && meta.anims[this.anim];
      // run cadence follows real speed (feet don't skate when slowing down)
      let fi;
      if (an && an.speed && this.anim === 'run') fi = Math.floor(this.runPhase * an.speed) % an.n;
      else fi = G.Sprite.frameOf('wick', this.anim, this.animT);
      // painted sheets have few idle poses: add a soft breath around the feet
      const sy = meta && meta.v === 2 && this.anim === 'idle' ? 1 + Math.sin(this.flameT * 1.9) * 0.012 : 1;
      const blink = this.inv > 0 && !this.dead && Math.floor(this.inv * 14) % 2 === 0;
      const fx = this.cx, fy = this.feet + 1;
      const flip = (this.anim === 'wall' ? -this.wall : this.facing) < 0;
      // flame tip
      const tip = an && an.tip ? G.Sprite.point('wick', an.tip[fi], fx, fy, { flip, anim: this.anim, fi, sy }) : { x: fx, y: this.y };
      this.tip = tip;
      if (this.hazardT > 0) return;
      G.Sprite.draw(ctx, 'wick', this.anim, fi, fx, fy, { flip, sy, alpha: blink ? 0.45 : 1, flash: this.hurtT > 0.2 ? 0.8 : 0 });
    }
    drawFlame(ctx, t) {
      if (!this.tip || this.hazardT > 0) return;
      const S = G.state; const hpK = this.dead ? Math.max(0, 1 - this.deadT * 1.2) : 0.55 + 0.45 * (S.hp / S.hpMax);
      const sz = 5.2 * hpK * (this.focusing ? 1.35 : 1) * (this.castT > 0 ? 1.4 : 1);
      if (sz > 0.3) G.FX.flame(ctx, this.tip.x, this.tip.y + 3, sz, t, { lean: -this.vx * 0.012 * sz, glow: 1 });
    }
  }
  return { Player, C };
})();
