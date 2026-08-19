/* ============================================================
   entities.js — שחקן, חברה, שדרוגים וקליעים
   ============================================================ */
'use strict';

/* ---------- עזרי פיזיקה משותפים ---------- */
const Phys = {

  /* מחזיק שחקן/יריב בתוך הזירה */
  clampArena(a) {
    const w = CFG.WALL + 4;
    const top = CFG.WALL_TOP + 4;
    if (a.x < w + a.r) { a.x = w + a.r; a.vx = Math.max(0, a.vx); }
    if (a.x > CFG.W - w - a.r) { a.x = CFG.W - w - a.r; a.vx = Math.min(0, a.vx); }
    if (a.y < top + a.r) { a.y = top + a.r; a.vy = Math.max(0, a.vy); }
    if (a.y > CFG.H - w - a.r) { a.y = CFG.H - w - a.r; a.vy = Math.min(0, a.vy); }
  },

  /* דוחף החוצה ממכשולים ומחליק לאורכם */
  resolveObstacles(a, obstacles) {
    for (const ob of obstacles) {
      const push = U.circleVsRect(a.x, a.y, a.r, ob.x, ob.y, ob.w, ob.h);
      if (!push) continue;
      a.x += push.x;
      a.y += push.y;
      /* מבטל את רכיב המהירות שנכנס לתוך המכשול */
      const n = U.norm(push.x, push.y);
      const into = a.vx * n.x + a.vy * n.y;
      if (into < 0) { a.vx -= n.x * into; a.vy -= n.y * into; }
    }
  },

  /* כוח הדיפה ממכשולים — כדי שהיריבים יעקפו במקום להיתקע */
  avoidForce(a, obstacles, look) {
    let fx = 0, fy = 0;
    for (const ob of obstacles) {
      const nx = U.clamp(a.x, ob.x, ob.x + ob.w);
      const ny = U.clamp(a.y, ob.y, ob.y + ob.h);
      const dx = a.x - nx, dy = a.y - ny;
      const d = Math.hypot(dx, dy);
      const range = a.r + look;
      if (d < range) {
        const n = U.norm(dx || U.rand(-1, 1), dy || U.rand(-1, 1));
        const k = (1 - d / range);
        fx += n.x * k * 1.9;
        fy += n.y * k * 1.9;
        /* רכיב משיקי — עוזר לגלוש סביב הפינה במקום להידחף אחורה */
        fx += -n.y * k * 1.15;
        fy += n.x * k * 1.15;
      }
    }
    return { x: fx, y: fy };
  },

  /* הפרדה בין יריבים כדי שלא ייערמו */
  separation(a, list) {
    let fx = 0, fy = 0;
    for (const b of list) {
      if (b === a || b.dead) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      const min = a.r + b.r + 18;
      if (d2 < min * min && d2 > 1e-4) {
        const d = Math.sqrt(d2);
        const k = (1 - d / min);
        fx += (dx / d) * k * 3.1;
        fy += (dy / d) * k * 3.1;
      }
    }
    return { x: fx, y: fy };
  }
};


/* ============================================================
   שחקן — יהלי
   ============================================================ */
class Player {

  constructor() {
    const p = CFG.player;
    this.x = CFG.W / 2;
    this.y = CFG.H * 0.72;
    this.vx = 0; this.vy = 0;
    this.r = p.r;
    this.dir = 1;
    this.walk = 0;

    this.dashTimer = 0;      // כמה נשאר לדאש הנוכחי
    this.dashCd = 0;         // זמן עד שאפשר שוב
    this.iFrames = 0;
    this.squash = 1;

    this.blinkTimer = U.rand(2, 5);
    this.blink = false;

    this.speedMult = 1;      // בואינג
    this.freeDash = false;
    this.invincible = false; // פאנישר
    this._stepTimer = 0;
  }

  get dashing() { return this.dashTimer > 0; }
  get safe() { return this.iFrames > 0 || this.invincible; }

  tryDash(dirX, dirY) {
    if (this.dashTimer > 0) return false;
    if (this.dashCd > 0 && !this.freeDash) return false;

    let dx = dirX, dy = dirY;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { dx = this.dir; dy = 0; }
    const n = U.norm(dx, dy);

    const p = CFG.player;
    this.dashTimer = p.dashTime;
    this.dashCd = this.freeDash ? 0.22 : p.dashCooldown;
    this.vx = n.x * p.dashSpeed * (this.freeDash ? 1.12 : 1);
    this.vy = n.y * p.dashSpeed * (this.freeDash ? 1.12 : 1);
    this.iFrames = Math.max(this.iFrames, p.dashIFrames);
    this.squash = 1.28;

    FX.burst(this.x, this.y + 12, 12, {
      angle: Math.atan2(-n.y, -n.x), spread: 0.7,
      speedMin: 80, speedMax: 300, rMin: 2, rMax: 5,
      lifeMin: 0.2, lifeMax: 0.5,
      colors: ['rgba(255,214,90,.85)', 'rgba(255,255,255,.6)', 'rgba(180,160,255,.6)']
    });
    FX.ring(this.x, this.y + 8, { r0: 6, r1: 56, life: 0.32, color: 'rgba(255,214,90,.55)', width: 3 });
    Sound.dash();
    return true;
  }

  update(dt, game) {
    const p = CFG.player;

    /* --- טיימרים --- */
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.iFrames > 0) this.iFrames -= dt;
    this.squash = U.damp(this.squash, 1, 0.2, dt);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = !this.blink;
      this.blinkTimer = this.blink ? 0.11 : U.rand(2.2, 5.5);
    }

    /* --- קלט --- */
    const mv = Input.moveVector();

    if (Input.consumeDash()) this.tryDash(mv.x, mv.y);

    if (this.dashing) {
      /* בזמן דאש — שליטה מזערית, המהירות דועכת לאט */
      this.vx = U.damp(this.vx, this.vx * 0.55, 0.06, dt);
      this.vy = U.damp(this.vy, this.vy * 0.55, 0.06, dt);
    } else {
      const target = p.speed * this.speedMult;
      if (mv.x || mv.y) {
        this.vx += mv.x * p.accel * dt;
        this.vy += mv.y * p.accel * dt;
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > target) { this.vx = this.vx / sp * target; this.vy = this.vy / sp * target; }
      } else {
        this.vx = U.damp(this.vx, 0, 0.28, dt);
        this.vy = U.damp(this.vy, 0, 0.28, dt);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    Phys.resolveObstacles(this, game.obstacles);
    Phys.clampArena(this);

    /* --- אנימציה --- */
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 12) {
      this.walk += dt * (5 + sp * 0.028);
      if (Math.abs(this.vx) > 6) this.dir = this.vx > 0 ? 1 : -1;

      this._stepTimer -= dt;
      if (this._stepTimer <= 0 && !this.dashing) {
        this._stepTimer = 0.3;
        Sound.step();
        FX.dust(this.x, this.y, this.dir);
      }
    } else {
      this.walk = U.damp(this.walk, 0, 0.1, dt);
    }

    /* שובל בזמן דאש */
    if (this.dashing) {
      FX.burst(this.x, this.y + 6, 1, {
        speedMin: 0, speedMax: 25, rMin: 3, rMax: 6,
        lifeMin: 0.16, lifeMax: 0.3,
        colors: ['rgba(255,214,90,.4)', 'rgba(255,255,255,.28)']
      });
    }
  }

  /* טבעת הזיהוי — מצוירת אחרי כל שאר הדמויות כדי שיהלי
     לעולם לא ייעלם מתחת לערימת החברה. */
  drawMarker(ctx, time) {
    ctx.save();

    /* טבעת לרגליים */
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = '#ffcc3d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 31, 23 + Math.sin(time * 4) * 1.2, 8.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    /* חץ מעל הראש — הדבר היחיד שאף פעם לא נבלע בהמון.
       מוגבל כלפי מעלה כדי שלא ייצא מהמסך כשיהלי צמוד לקיר העליון. */
    const bob = Math.sin(time * 5) * 3;
    const ay = Math.max(26, this.y - 82 + bob);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#ffcc3d';
    ctx.strokeStyle = 'rgba(20,13,32,.75)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, ay + 11);
    ctx.lineTo(this.x - 9, ay - 5);
    ctx.lineTo(this.x + 9, ay - 5);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  }

  draw(ctx, time) {
    /* הבהוב בזמן חסינות אחרי פגיעה */
    let alpha = 1;
    if (this.iFrames > 0 && !this.dashing && !this.invincible) {
      alpha = 0.35 + 0.65 * (Math.sin(time * 34) * 0.5 + 0.5);
    }

    /* הילה רכה מתחת לרגליים — מקרקעת את הדמות */
    ctx.save();
    ctx.globalAlpha = 0.7;
    const rg = ctx.createRadialGradient(this.x, this.y + 31, 3, this.x, this.y + 31, 30);
    rg.addColorStop(0, 'rgba(255,204,61,.55)');
    rg.addColorStop(0.6, 'rgba(255,157,31,.20)');
    rg.addColorStop(1, 'rgba(255,157,31,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 31, 30, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* הילת פאנישר */
    if (this.invincible) {
      ctx.save();
      const pulse = 0.5 + Math.sin(time * 9) * 0.18;
      const g = ctx.createRadialGradient(this.x, this.y + 4, 6, this.x, this.y + 4, 52);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.30 * pulse) + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      U.circle(ctx, this.x, this.y + 4, 52);
      ctx.fill();
      ctx.restore();
    }
    /* הילת בואינג */
    if (this.speedMult > 1) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(108,224,255,.7)';
      ctx.lineWidth = 2;
      U.circle(ctx, this.x, this.y + 6, 30 + Math.sin(time * 11) * 2.5);
      ctx.stroke();
      ctx.restore();
    }

    Art.person(ctx, {
      x: this.x, y: this.y,
      dir: this.dir,
      walk: this.walk,
      scale: 1,
      squash: this.squash,
      colors: Art.YEHALI,
      style: 'yehali',
      blink: this.blink,
      mouthOpen: this.dashing,
      alpha
    });

    /* מד קירור לדאש */
    if (this.dashCd > 0 && !this.freeDash) {
      const k = 1 - this.dashCd / CFG.player.dashCooldown;
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 3.5;
      U.circle(ctx, this.x, this.y + 30, 15);
      ctx.stroke();
      ctx.strokeStyle = '#ffcc3d';
      ctx.beginPath();
      ctx.arc(this.x, this.y + 30, 15, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}


/* ============================================================
   חבר — היריב
   ============================================================ */
class Foe {

  constructor(type, x, y, wave) {
    const d = CFG.foes[type];
    this.type = type;
    this.def = d;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = d.r;
    this.dir = 1;
    this.walk = 0;
    this.dead = false;

    this.speed = Math.min(d.maxSpeed, d.speed + d.grow * (wave - 1));

    this.state = 'walk';
    this.timer = U.rand(0.4, 1.6);
    this.aimX = 0; this.aimY = 0;
    this.frozen = 0;
    this.flash = 0;
    this.spawnAnim = 0;         // 0..1
    this.blink = false;
    this.blinkTimer = U.rand(1, 5);
    this.tauntCd = U.rand(3, 9);

    /* גיוון ויזואלי בין החברה */
    const hairs = ['#2b2118', '#6b4423', '#c9a227', '#151015', '#8a6a4a'];
    this.colors = {
      skin: '#e0b088', skinDark: '#bd8c66', skinLight: '#f0c8a4',
      hair: hairs[U.randInt(0, hairs.length - 1)],
      shirt: d.color,
      shirtDark: this._darken(d.color, 0.72),
      pants: '#5a6486', pantsDark: '#454e6b', shoe: '#242430',
      frame: '#2c2b34', lens: 'rgba(200,228,240,.4)',
      facial: '#1a140f',
      logo: 'rgba(255,255,255,.22)'
    };
  }

  _darken(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * k);
    const g = Math.round(((n >> 8) & 255) * k);
    const b = Math.round((n & 255) * k);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  knockOut() {
    this.dead = true;
    FX.burst(this.x, this.y, 18, {
      speedMin: 90, speedMax: 340, rMin: 2, rMax: 6,
      lifeMin: 0.35, lifeMax: 0.8, grav: 400,
      colors: [this.def.color, '#ffffff', '#ffcc3d']
    });
    FX.ring(this.x, this.y, { r0: 6, r1: 78, life: 0.38, color: 'rgba(255,255,255,.7)' });
    Sound.knockout();
  }

  update(dt, game) {
    if (this.spawnAnim < 1) this.spawnAnim = Math.min(1, this.spawnAnim + dt * 2.4);
    if (this.flash > 0) this.flash -= dt;

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = !this.blink;
      this.blinkTimer = this.blink ? 0.1 : U.rand(2, 6);
    }

    const p = game.player;

    /* --- קפוא (דואלינגו) --- */
    if (this.frozen > 0) {
      this.frozen -= dt;
      this.vx = U.damp(this.vx, 0, 0.4, dt);
      this.vy = U.damp(this.vy, 0, 0.4, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      Phys.resolveObstacles(this, game.obstacles);
      Phys.clampArena(this);
      return;
    }

    /* --- קריאות מדי פעם --- */
    this.tauntCd -= dt;
    if (this.tauntCd <= 0) {
      this.tauntCd = U.rand(6, 14);
      if (U.dist(this.x, this.y, p.x, p.y) < 260 && game.foes.length < 8) {
        FX.text(this.x, this.y - 62, U.pick(CFG.taunts), {
          size: 15, color: '#ffffff', life: 1.1, vy: -30
        });
      }
    }

    /* --- התנהגות לפי סוג --- */
    let desire = { x: 0, y: 0 };
    let maxSpeed = this.speed;

    switch (this.type) {

      case 'chaser': {
        const n = U.norm(p.x - this.x, p.y - this.y);
        desire = n;
        break;
      }

      case 'tank': {
        const n = U.norm(p.x - this.x, p.y - this.y);
        desire = n;
        break;
      }

      case 'sprinter': {
        const n = U.norm(p.x - this.x, p.y - this.y);
        this.timer -= dt;

        if (this.state === 'walk') {
          desire = n;
          if (this.timer <= 0 && n.len < 460) {
            this.state = 'windup';
            this.timer = this.def.windup;
            this.aimX = n.x; this.aimY = n.y;
            Sound.tone(320, 0.18, { type: 'square', vol: 0.08, filter: 1500 });
          }
        } else if (this.state === 'windup') {
          /* נעצר ומכוון — עוקב מעט אחרי השחקן כדי שיהיה הוגן אך מסוכן */
          this.aimX = U.damp(this.aimX, n.x, 0.06, dt);
          this.aimY = U.damp(this.aimY, n.y, 0.06, dt);
          this.vx = U.damp(this.vx, 0, 0.35, dt);
          this.vy = U.damp(this.vy, 0, 0.35, dt);
          if (this.timer <= 0) {
            this.state = 'charge';
            this.timer = this.def.chargeTime;
            const a = U.norm(this.aimX, this.aimY);
            this.vx = a.x * this.def.chargeSpeed;
            this.vy = a.y * this.def.chargeSpeed;
            FX.burst(this.x, this.y + 14, 8, {
              angle: Math.atan2(-a.y, -a.x), spread: 0.6,
              speedMin: 60, speedMax: 200, lifeMin: 0.2, lifeMax: 0.45,
              colors: ['rgba(255,155,69,.8)', 'rgba(255,255,255,.5)']
            });
          }
        } else if (this.state === 'charge') {
          if (this.timer <= 0) {
            this.state = 'rest';
            this.timer = this.def.restTime;
          }
          this.vx = U.damp(this.vx, this.vx * 0.7, 0.04, dt);
          this.vy = U.damp(this.vy, this.vy * 0.7, 0.04, dt);
        } else { /* rest */
          this.vx = U.damp(this.vx, 0, 0.3, dt);
          this.vy = U.damp(this.vy, 0, 0.3, dt);
          if (this.timer <= 0) {
            this.state = 'walk';
            this.timer = U.rand(this.def.cycle * 0.7, this.def.cycle * 1.3);
          }
        }
        break;
      }

      case 'photog': {
        const n = U.norm(p.x - this.x, p.y - this.y);
        const keep = this.def.keepDist;

        if (this.state === 'aim') {
          this.timer -= dt;
          this.vx = U.damp(this.vx, 0, 0.3, dt);
          this.vy = U.damp(this.vy, 0, 0.3, dt);
          this.aimX = U.damp(this.aimX, n.x, 0.05, dt);
          this.aimY = U.damp(this.aimY, n.y, 0.05, dt);
          if (this.timer <= 0) {
            const a = U.norm(this.aimX, this.aimY);
            game.spawnShot(this.x + a.x * 22, this.y + a.y * 22 - 8, a.x, a.y);
            this.state = 'walk';
            this.timer = this.def.shotCooldown * U.rand(0.85, 1.2);
            this.flash = 0.16;
          }
        } else {
          this.timer -= dt;
          /* שומר טווח: מתקרב אם רחוק, מתרחק אם קרוב מדי */
          if (n.len > keep + 60) desire = n;
          else if (n.len < keep - 60) desire = { x: -n.x, y: -n.y };
          else desire = { x: -n.y * 0.85, y: n.x * 0.85 };  // מקיף

          if (this.timer <= 0 && n.len < 460) {
            this.state = 'aim';
            this.timer = this.def.aimTime;
            this.aimX = n.x; this.aimY = n.y;
          }
        }
        break;
      }
    }

    /* --- הרכבת כוחות --- */
    if (this.state !== 'charge') {
      const avoid = Phys.avoidForce(this, game.obstacles, 44);
      const sep = Phys.separation(this, game.foes);

      let fx = desire.x + avoid.x + sep.x;
      let fy = desire.y + avoid.y + sep.y;
      const n = U.norm(fx, fy);

      const accel = 900;
      this.vx += n.x * accel * dt;
      this.vy += n.y * accel * dt;

      const sp = Math.hypot(this.vx, this.vy);
      const cap = maxSpeed * (this.state === 'aim' ? 0.15 : 1);
      if (sp > cap) { this.vx = this.vx / sp * cap; this.vy = this.vy / sp * cap; }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    Phys.resolveObstacles(this, game.obstacles);
    Phys.clampArena(this);

    /* אנימציה */
    const sp = Math.hypot(this.vx, this.vy);
    this.walk += dt * (4 + sp * 0.03);
    if (Math.abs(this.vx) > 8) this.dir = this.vx > 0 ? 1 : -1;
  }

  draw(ctx, time) {
    const grow = U.easeOutBack(this.spawnAnim);

    /* --- סימון של ספרינטר לפני זינוק --- */
    if (this.type === 'sprinter' && this.state === 'windup') {
      const a = U.norm(this.aimX, this.aimY);
      const k = 1 - this.timer / this.def.windup;
      ctx.save();
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -time * 60;
      ctx.strokeStyle = 'rgba(255,155,69,' + (0.35 + k * 0.5) + ')';
      ctx.lineWidth = 4 + k * 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x + a.x * this.r, this.y + a.y * this.r);
      ctx.lineTo(this.x + a.x * 400, this.y + a.y * 400);
      ctx.stroke();
      ctx.restore();

      /* סימן קריאה */
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(time * 22) * 0.4;
      ctx.fillStyle = '#ff9b45';
      ctx.textAlign = 'center';
      ctx.font = '900 26px "Segoe UI",Arial,sans-serif';
      ctx.fillText('!', this.x, this.y - 62 - grow * 4);
      ctx.restore();
    }

    /* --- סימון של צלם בזמן כיוון --- */
    if (this.type === 'photog' && this.state === 'aim') {
      const a = U.norm(this.aimX, this.aimY);
      const k = 1 - this.timer / this.def.aimTime;
      ctx.save();
      ctx.globalAlpha = 0.28 + k * 0.4;
      ctx.strokeStyle = '#c98bff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(this.x + a.x * this.r, this.y + a.y * this.r - 8);
      ctx.lineTo(this.x + a.x * 340, this.y + a.y * 340 - 8);
      ctx.stroke();
      ctx.restore();
    }

    /* --- הילת קיפאון --- */
    if (this.frozen > 0) {
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = '#8ee34a';
      U.circle(ctx, this.x, this.y - 4, this.r + 16);
      ctx.fill();
      ctx.restore();
    }

    const scale = grow;
    Art.person(ctx, {
      x: this.x, y: this.y,
      dir: this.dir,
      walk: this.frozen > 0 ? 0 : this.walk,
      scale: scale * (this.def.r / 19),
      squash: this.state === 'charge' ? 1.16 : 1,
      colors: this.colors,
      style: 'friend',
      big: this.type === 'tank',
      blink: this.blink || this.frozen > 0,
      angry: this.state === 'windup' || this.state === 'charge',
      mouthOpen: this.state === 'charge',
      hand: this.type === 'photog' ? 'phone' : 'sticker',
      phoneLit: this.type === 'photog' && (this.state === 'aim' || this.flash > 0),
      armRaise: this.type === 'photog' ? -0.9 : 0
    });

    /* הבזק מצלמה */
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash / 0.16 * 0.7;
      ctx.fillStyle = '#fff';
      U.circle(ctx, this.x, this.y - 14, 34);
      ctx.fill();
      ctx.restore();
    }

    /* קיפאון — סימן Z */
    if (this.frozen > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#8ee34a';
      ctx.textAlign = 'center';
      ctx.font = '900 18px "Segoe UI",Arial,sans-serif';
      ctx.fillText('נו־נו', this.x, this.y - 64 + Math.sin(time * 3) * 3);
      ctx.restore();
    }
  }
}


/* ============================================================
   שדרוג על הרצפה
   ============================================================ */
class Pickup {

  constructor(kind, x, y) {
    this.kind = kind;
    this.def = CFG.power[kind];
    this.x = x; this.y = y;
    this.r = CFG.pickup.r;
    this.age = 0;
    this.life = kind === 'sey' ? CFG.pickup.life * 0.75 : CFG.pickup.life;
  }

  get expiring() { return this.life - this.age < 2.6; }

  update(dt) {
    this.age += dt;
    if (this.kind === 'sey' && Math.random() < dt * 14) {
      FX.burst(this.x + U.rand(-16, 16), this.y + U.rand(-16, 16), 1, {
        speedMin: 5, speedMax: 30, rMin: 1.5, rMax: 3.5,
        lifeMin: 0.4, lifeMax: 0.8, shape: 'star',
        colors: ['#ffd93d', '#fff3b0', '#ffffff']
      });
    }
    return this.age < this.life;
  }

  draw(ctx, time) {
    const bob = Math.sin(time * 3 + this.x) * 5;
    let alpha = 1;
    if (this.expiring) alpha = 0.35 + 0.65 * (Math.sin(time * 16) * 0.5 + 0.5);

    ctx.save();
    ctx.globalAlpha = alpha;

    /* צל */
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 22, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* הילה */
    const g = ctx.createRadialGradient(this.x, this.y + bob, 4, this.x, this.y + bob, 40);
    g.addColorStop(0, this.def.color + 'aa');
    g.addColorStop(1, this.def.color + '00');
    ctx.fillStyle = g;
    U.circle(ctx, this.x, this.y + bob, 40);
    ctx.fill();

    /* טבעת */
    ctx.strokeStyle = this.def.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.55;
    U.circle(ctx, this.x, this.y + bob, this.r + 7 + Math.sin(time * 4) * 1.6);
    ctx.stroke();
    ctx.globalAlpha = alpha;

    Art.pickupIcon(ctx, this.def.glyph, this.x, this.y + bob, this.r * 0.92, time);

    /* שם השדרוג */
    ctx.textAlign = 'center';
    ctx.font = '800 12px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,8,18,.85)';
    ctx.strokeText(this.def.name, this.x, this.y + bob + 38);
    ctx.fillStyle = this.def.color;
    ctx.fillText(this.def.name, this.x, this.y + bob + 38);

    ctx.restore();
  }
}


/* ============================================================
   סטיקר מעופף
   ============================================================ */
class Shot {

  constructor(x, y, dx, dy, imgIndex) {
    this.x = x; this.y = y;
    this.vx = dx * CFG.foes.photog.shotSpeed;
    this.vy = dy * CFG.foes.photog.shotSpeed;
    this.r = CFG.shot.r;
    this.age = 0;
    this.rot = Math.atan2(dy, dx);
    this.spin = U.rand(-5, 5);
    this.imgIndex = imgIndex;
  }

  update(dt, game) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;

    if (Math.random() < dt * 20) {
      FX.burst(this.x, this.y, 1, {
        speedMin: 0, speedMax: 20, rMin: 1.5, rMax: 3,
        lifeMin: 0.2, lifeMax: 0.4,
        colors: ['rgba(201,139,255,.6)', 'rgba(255,255,255,.4)']
      });
    }

    /* מתפוצץ על מכשולים וקירות */
    if (this.x < CFG.WALL || this.x > CFG.W - CFG.WALL ||
        this.y < CFG.WALL_TOP || this.y > CFG.H - CFG.WALL) return false;
    for (const ob of game.obstacles) {
      if (U.circleVsRect(this.x, this.y, this.r, ob.x, ob.y, ob.w, ob.h)) return false;
    }
    return this.age < CFG.shot.life;
  }

  draw(ctx) {
    Art.shot(ctx, this.x, this.y, this.rot, this.r, Assets.img(this.imgIndex));
  }
}
