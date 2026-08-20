/* ============================================================
   entities.js — שחקן, חברה, שדרוגים וקליעים
   ============================================================ */
'use strict';

/* ---------- עזרי פיזיקה משותפים ---------- */
const Phys = {

  /* מחזיק שחקן/יריב בתוך הזירה.
     עובד מול גודל המפה הנוכחית (worldW/worldH), לא מול גודל החלון. */
  clampArena(a) {
    const w = CFG.WALL + 4;
    const top = CFG.WALL_TOP + 4;
    if (a.x < w + a.r) { a.x = w + a.r; a.vx = Math.max(0, a.vx); }
    if (a.x > CFG.worldW - w - a.r) { a.x = CFG.worldW - w - a.r; a.vx = Math.min(0, a.vx); }
    if (a.y < top + a.r) { a.y = top + a.r; a.vy = Math.max(0, a.vy); }
    if (a.y > CFG.worldH - w - a.r) { a.y = CFG.worldH - w - a.r; a.vy = Math.min(0, a.vy); }
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
    this.x = CFG.worldW / 2;
    this.y = CFG.worldH * 0.72;
    this.vx = 0; this.vy = 0;
    this.r = p.r;
    this.dir = 1;
    this.walk = 0;
    this.slow = 1;           // מכפיל מהירות משלוליות של ה'דביק'
    this.pizzaTimer = 0;     // שעון הזריקה של יהלי פיצה
    this.trail = '#ffcc3d';  // צבע השובל — נדרס לפי מה שקנוי ומצויד בחנות
    this.shirt = null;       // צבע חולצה מהחנות (null = ברירת המחדל של Art)

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
      colors: [this.trail, 'rgba(255,255,255,.6)', 'rgba(180,160,255,.6)']
    });
    FX.ring(this.x, this.y + 8, { r0: 6, r1: 56, life: 0.32, color: this.trail, width: 3 });
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
      const target = p.speed * this.speedMult * this.slow;
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

    /* --- שלוליות של ה'דביק' מאטות --- */
    this.slow = 1;
    for (const pd of game.puddles) {
      if (U.dist2(this.x, this.y, pd.x, pd.y) < (pd.r + this.r * 0.5) * (pd.r + this.r * 0.5)) {
        this.slow = CFG.foes.sticky.slow;
        break;
      }
    }

    /* --- יהלי פיצה: זורק לבד על הקרוב ביותר --- */
    if (game.powers.pizza) {
      this.pizzaTimer -= dt;
      if (this.pizzaTimer <= 0) {
        this.pizzaTimer = CFG.pizzaShot.every;
        game.throwPizza();
      }
    } else {
      this.pizzaTimer = 0;
    }

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
        colors: [this.trail, 'rgba(255,255,255,.28)']
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

    /* סקין מהחנות — רק צבע החולצה מוחלף, שאר הדמות זהה */
    let cols = Art.YEHALI;
    if (this.shirt) {
      if (!this._skinCache || this._skinCache.shirt !== this.shirt) {
        this._skinCache = Object.assign({}, Art.YEHALI, {
          shirt: this.shirt,
          shirtDark: Art.darken(this.shirt, 0.72)
        });
      }
      cols = this._skinCache;
    }

    Art.person(ctx, {
      x: this.x, y: this.y,
      dir: this.dir,
      walk: this.walk,
      scale: 1,
      squash: this.squash,
      colors: cols,
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

    /* קופץ */
    this.hopCd = U.rand(0.6, d.hopEvery || 2);
    this.hopT = 0;              // >0 => באוויר
    this.hopZ = 0;              // גובה נוכחי מעל הרצפה (לציור)
    /* דביק */
    this.dropCd = U.rand(0.2, 1);

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

    /* --- קריאות מדי פעם, ותשובה של יהלי --- */
    this.tauntCd -= dt;
    if (this.tauntCd <= 0) {
      this.tauntCd = U.rand(6, 14);
      if (U.dist(this.x, this.y, p.x, p.y) < 300 && game.foes.length < 8) {
        const line = U.pick(CFG.taunts);
        FX.text(this.x, this.y - 62, line, {
          size: 15, color: '#ffffff', life: 1.1, vy: -30
        });
        game.yehaliReply(line);
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

      /* חוסם: מכוון לאן שהשחקן *יהיה*, לא לאן שהוא נמצא.
         לכן בריחה בקו ישר דווקא מכניסה אותך לזרועותיו. */
      case 'blocker': {
        const lead = this.def.lead;
        const tx = p.x + p.vx * lead;
        const ty = p.y + p.vy * lead;
        desire = U.norm(tx - this.x, ty - this.y);
        this.aimX = tx; this.aimY = ty;
        break;
      }

      /* דביק: הולך ישר, אבל מטפטף שלוליות שמאטות את יהלי */
      case 'sticky': {
        desire = U.norm(p.x - this.x, p.y - this.y);
        this.dropCd -= dt;
        if (this.dropCd <= 0) {
          this.dropCd = this.def.dropEvery;
          if (game.puddles.length < 26) game.puddles.push(new Puddle(this.x, this.y));
        }
        break;
      }

      /* קופץ: צובר, מזנק בקשת, ונוחת עם גל הדף.
         באוויר לא נוגעים בו — הנחיתה היא החלון שלך. */
      case 'hopper': {
        const n = U.norm(p.x - this.x, p.y - this.y);

        if (this.hopT > 0) {
          /* באוויר — טס בקו ישר, בלי היגוי */
          this.hopT -= dt;
          const k = 1 - this.hopT / this.def.hopTime;
          this.hopZ = Math.sin(k * Math.PI) * this.def.hopHeight;
          if (this.hopT <= 0) {
            this.hopZ = 0;
            this.hopCd = this.def.hopEvery * U.rand(0.8, 1.25);
            FX.ring(this.x, this.y + 20, {
              r0: 8, r1: 86, life: 0.36, color: 'rgba(209,78,160,.75)', width: 4
            });
            FX.burst(this.x, this.y + 18, 10, {
              speedMin: 50, speedMax: 210, rMin: 2, rMax: 5,
              lifeMin: 0.2, lifeMax: 0.45, grav: 300,
              colors: [this.def.color, '#ffffff']
            });
            Sound.tone(150, 0.12, { type: 'sine', vol: 0.09, filter: 900 });
          }
        } else {
          this.hopCd -= dt;
          desire = n;
          if (this.hopCd <= 0 && n.len < this.def.hopRange) {
            this.hopT = this.def.hopTime;
            const sp = n.len / this.def.hopTime;
            this.vx = n.x * sp;
            this.vy = n.y * sp;
            Sound.tone(420, 0.1, { type: 'square', vol: 0.06, filter: 1800 });
          }
        }
        break;
      }
    }

    /* --- הרכבת כוחות ---
       זינוק (ספרינטר) וקפיצה (קופץ) הם בליסטיים: אין היגוי באמצע. */
    if (this.state !== 'charge' && this.hopT <= 0) {
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

    /* בזמן קפיצה הוא באוויר — עובר מעל מכשולים, אבל עדיין בתוך המפה */
    if (this.hopT <= 0) Phys.resolveObstacles(this, game.obstacles);
    Phys.clampArena(this);

    /* אנימציה */
    const sp = Math.hypot(this.vx, this.vy);
    this.walk += dt * (4 + sp * 0.03);
    if (Math.abs(this.vx) > 8) this.dir = this.vx > 0 ? 1 : -1;
  }

  /* האם אפשר לגעת בו כרגע — קופץ באוויר חסין */
  get untouchable() { return this.hopT > 0; }

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

    /* --- חוסם: מסמן את הנקודה שאליה הוא מיירט --- */
    if (this.type === 'blocker' && this.frozen <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(time * 6) * 0.12;
      ctx.strokeStyle = this.def.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      U.circle(ctx, this.aimX, this.aimY, 22);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* --- קופץ: צל על הרצפה, הדמות עולה באוויר --- */
    if (this.hopZ > 1) {
      ctx.save();
      ctx.globalAlpha = 0.34 * (1 - this.hopZ / (this.def.hopHeight * 1.6));
      ctx.fillStyle = '#000';
      ctx.beginPath();
      const sh = 1 - this.hopZ / (this.def.hopHeight * 2.2);
      ctx.ellipse(this.x, this.y + 22, 17 * sh, 6 * sh, 0, 0, Math.PI * 2);
      ctx.fill();
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
      x: this.x, y: this.y - this.hopZ,
      dir: this.dir,
      walk: this.frozen > 0 ? 0 : this.walk,
      scale: scale * (this.def.r / 19),
      squash: this.state === 'charge' ? 1.16 : (this.hopT > 0 ? 1.14 : 1),
      colors: this.colors,
      style: 'friend',
      big: this.type === 'tank',
      blink: this.blink || this.frozen > 0,
      angry: this.state === 'windup' || this.state === 'charge' || this.hopT > 0,
      mouthOpen: this.state === 'charge' || this.hopT > 0,
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
    if (this.x < CFG.WALL || this.x > CFG.worldW - CFG.WALL ||
        this.y < CFG.WALL_TOP || this.y > CFG.worldH - CFG.WALL) return false;
    for (const ob of game.obstacles) {
      if (U.circleVsRect(this.x, this.y, this.r, ob.x, ob.y, ob.w, ob.h)) return false;
    }
    return this.age < CFG.shot.life;
  }

  draw(ctx) {
    Art.shot(ctx, this.x, this.y, this.rot, this.r, Assets.img(this.imgIndex));
  }
}


/* ============================================================
   שלולית של ה'דביק' — מאטה את יהלי כשהוא עובר בה
   ============================================================ */
class Puddle {

  constructor(x, y) {
    const d = CFG.foes.sticky;
    this.x = x; this.y = y + 14;
    this.r = d.puddleR;
    this.age = 0;
    this.life = d.puddleLife;
    this.seed = U.rand(0, 6.283);
  }

  update(dt) { this.age += dt; return this.age < this.life; }

  draw(ctx, time) {
    /* דוהה בשליש האחרון של החיים כדי שיהיה ברור שהיא נגמרת */
    const left = 1 - this.age / this.life;
    const a = U.clamp(left * 3, 0, 1) * 0.55;
    const grow = U.clamp(this.age * 4, 0, 1);

    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#c98a2b';
    ctx.beginPath();
    /* צורה לא-עגולה, שלא ייראה כמו עוד עיגול */
    for (let i = 0; i <= 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      const wob = 1 + Math.sin(ang * 3 + this.seed + time * 1.4) * 0.13;
      const rr = this.r * grow * wob;
      const px = this.x + Math.cos(ang) * rr;
      const py = this.y + Math.sin(ang) * rr * 0.42;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = a * 0.6;
    ctx.strokeStyle = '#e8b44f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}


/* ============================================================
   סטיקר לאיסוף — הדרך החדשה לפתוח סטיקרים באוסף
   ------------------------------------------------------------
   פעם סטיקר נפתח כשחטפת אותו (כלומר על הפסד). עכשיו הוא צף
   בזירה וצריך להגיע אליו לפני שהוא נעלם — כלומר על *ניצחון*.
   הסיכון הוא הדרך: להיחשף לחברה תוך כדי.
   ============================================================ */
class Collectible {

  constructor(index, x, y) {
    this.index = index;
    this.st = CFG.stickers[index];
    this.tier = (this.st && this.st.tier) || 'רגיל';
    this.def = CFG.rarity.tiers[this.tier] || CFG.rarity.tiers['רגיל'];
    this.x = x; this.y = y;
    this.r = CFG.collect.r;
    this.age = 0;
    this.life = CFG.collect.life;
  }

  get expiring() { return this.life - this.age < 3.2; }

  update(dt) {
    this.age += dt;
    if (this.def.glow && Math.random() < dt * (6 + this.def.glow * 8)) {
      FX.burst(this.x + U.rand(-20, 20), this.y + U.rand(-24, 24), 1, {
        speedMin: 4, speedMax: 26, rMin: 1.5, rMax: 3.4,
        lifeMin: 0.4, lifeMax: 0.9, shape: 'star',
        colors: [this.def.color, '#ffffff']
      });
    }
    return this.age < this.life;
  }

  draw(ctx, time) {
    const bob = Math.sin(time * 2.6 + this.x * 0.01) * 6;
    let alpha = 1;
    if (this.expiring) alpha = 0.4 + 0.6 * (Math.sin(time * 15) * 0.5 + 0.5);

    const y = this.y + bob;
    const w = 46, h = w * 1.33;

    ctx.save();
    ctx.globalAlpha = alpha;

    /* הילה בצבע הנדירות — ככל שנדיר יותר, בולט יותר */
    const gr = 46 + this.def.glow * 16;
    const g = ctx.createRadialGradient(this.x, y, 4, this.x, y, gr);
    g.addColorStop(0, this.def.color + 'bb');
    g.addColorStop(1, this.def.color + '00');
    ctx.fillStyle = g;
    U.circle(ctx, this.x, y, gr); ctx.fill();

    /* הכרטיס עצמו */
    ctx.save();
    ctx.translate(this.x, y);
    ctx.rotate(Math.sin(time * 1.7) * 0.09);
    ctx.fillStyle = '#fdfaf2';
    U.roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();

    const img = Assets.img(this.index);
    const pad = 3;
    ctx.save();
    U.roundRect(ctx, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2, 4);
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      Art._cover(ctx, img, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2);
    } else {
      ctx.fillStyle = '#3a2f5e';
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();

    ctx.strokeStyle = this.def.color;
    ctx.lineWidth = 2.5;
    U.roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.stroke();
    ctx.restore();

    /* שם הדרגה */
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.font = '900 12px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8,6,16,.9)';
    ctx.strokeText(this.tier, this.x, y + h / 2 + 17);
    ctx.fillStyle = this.def.color;
    ctx.fillText(this.tier, this.x, y + h / 2 + 17);

    ctx.restore();
  }
}


/* ============================================================
   פיצה — יהלי זורק, החבר יורד
   ============================================================ */
class Pizza {

  constructor(x, y, dx, dy) {
    const c = CFG.pizzaShot;
    this.x = x; this.y = y;
    this.vx = dx * c.speed;
    this.vy = dy * c.speed;
    this.r = c.r;
    this.age = 0;
    this.rot = 0;
  }

  update(dt, game) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += dt * 13;

    if (this.x < CFG.WALL || this.x > CFG.worldW - CFG.WALL ||
        this.y < CFG.WALL_TOP || this.y > CFG.worldH - CFG.WALL) return false;
    for (const ob of game.obstacles) {
      if (U.circleVsRect(this.x, this.y, this.r, ob.x, ob.y, ob.w, ob.h)) return false;
    }
    return this.age < 2.4;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    ctx.fillStyle = '#e8a94f';
    U.circle(ctx, 0, 0, this.r); ctx.fill();
    ctx.fillStyle = '#ffcf7a';
    U.circle(ctx, 0, 0, this.r * 0.82); ctx.fill();
    ctx.fillStyle = '#d8442f';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      U.circle(ctx, Math.cos(a) * this.r * 0.42, Math.sin(a) * this.r * 0.42, this.r * 0.19);
      ctx.fill();
    }
    ctx.restore();
  }
}
