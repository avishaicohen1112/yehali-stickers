/* ============================================================
   sprites.js — ציור הדמויות, החפצים והזירה
   כל הדמויות נבנות מאותו שלד; יהלי מקבל גוף רחב יותר,
   שיער כהה עם פוני, משקפיים מלבניים, שפם עבה וזקנקן.

   מערכת הצירים של דמות (בקנה מידה 1):
     ראש  ~ -66      מרכז ההתנגשות = 0
     גוף  -28 .. +6
     רגלי +4  .. +32  (הרצפה)
   ============================================================ */
'use strict';

const Art = {

  /* ---------- לוח צבעים ---------- */
  YEHALI: {
    skin: '#c98d5f', skinDark: '#a46f47', skinLight: '#e0ab7c',
    hair: '#181310', hairHi: '#3a2c23',
    shirt: '#7d8a72', shirtDark: '#59634f',
    pants: '#cdc7b9', pantsDark: '#a49e90',
    shoe: '#2a2630',
    frame: '#26252e', lens: 'rgba(196,226,240,.26)',
    facial: '#150f0b'
  },

  /* מכהה צבע hex במכפיל — לגוונים משניים (חולצה כהה וכו') */
  darken(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * k);
    const g = Math.round(((n >> 8) & 255) * k);
    const b = Math.round((n & 255) * k);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  /* ================================================================
     שלד משותף
     ================================================================ */
  person(ctx, o) {
    const s = o.scale || 1;
    const c = o.colors;
    const dir = o.dir >= 0 ? 1 : -1;
    const walk = o.walk || 0;
    const sq = o.squash || 1;

    const swing = Math.sin(walk);
    const bob = -Math.abs(Math.sin(walk)) * 3 * s;

    /* מידות */
    const W = (o.big ? 1.3 : 1);
    const torsoW = 36 * W * s;
    const torsoTop = -28 * s;
    const torsoH = 34 * s;
    const legTop = torsoTop + torsoH - 2 * s;
    const legH = 28 * s;
    const groundY = 32 * s;

    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(o.x, o.y);

    /* --- צל --- */
    ctx.save();
    ctx.globalAlpha *= 0.32;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, groundY + 2 * s, torsoW * 0.56, 6.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.scale(dir, 1);
    ctx.scale(1 / Math.sqrt(sq), sq);
    ctx.translate(0, bob);

    /* ================= רגליים ================= */
    const legW = 12 * W * s;
    const legOff = 8.5 * W * s;

    const drawLeg = (side) => {
      const sw = swing * side;
      const dx = sw * 6.5 * s;
      const lift = Math.max(0, sw) * 5 * s;

      ctx.save();
      ctx.translate(side * legOff + dx, legTop);
      /* מכנס */
      ctx.fillStyle = side > 0 ? c.pants : c.pantsDark;
      U.roundRect(ctx, -legW / 2, 0, legW, legH - lift, legW * 0.42);
      ctx.fill();
      /* נעל */
      ctx.fillStyle = c.shoe || '#2a2630';
      U.roundRect(ctx, -legW / 2 - 1.5 * s, legH - lift - 3 * s,
                  legW + 4 * s, 8 * s, 3.5 * s);
      ctx.fill();
      ctx.restore();
    };

    drawLeg(-1);   /* רגל אחורית */
    drawLeg(1);    /* רגל קדמית */

    /* ================= זרוע אחורית ================= */
    ctx.save();
    ctx.fillStyle = c.skinDark;
    ctx.translate(-torsoW * 0.42, torsoTop + 10 * s);
    ctx.rotate(-swing * 0.36);
    U.roundRect(ctx, -4.4 * s, 0, 8.8 * s, 24 * s, 4.4 * s);
    ctx.fill();
    ctx.restore();

    /* ================= גוף ================= */
    const g = ctx.createLinearGradient(-torsoW / 2, torsoTop, torsoW / 2, torsoTop + torsoH);
    g.addColorStop(0, c.shirt);
    g.addColorStop(1, c.shirtDark);
    ctx.fillStyle = g;

    ctx.beginPath();
    /* כתפיים משופעות ובטן רחבה */
    ctx.moveTo(-torsoW * 0.40, torsoTop + 2 * s);
    ctx.quadraticCurveTo(-torsoW * 0.56, torsoTop + torsoH * 0.55, -torsoW * 0.48, torsoTop + torsoH);
    ctx.lineTo(torsoW * 0.48, torsoTop + torsoH);
    ctx.quadraticCurveTo(torsoW * 0.56, torsoTop + torsoH * 0.55, torsoW * 0.40, torsoTop + 2 * s);
    ctx.quadraticCurveTo(0, torsoTop - 5 * s, -torsoW * 0.40, torsoTop + 2 * s);
    ctx.closePath();
    ctx.fill();

    /* שוליים כהים */
    ctx.save();
    ctx.globalAlpha *= 0.22;
    ctx.fillStyle = '#000';
    U.roundRect(ctx, -torsoW * 0.47, torsoTop + torsoH - 5 * s, torsoW * 0.94, 5 * s, 2.5 * s);
    ctx.fill();
    ctx.restore();

    /* צווארון */
    ctx.save();
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, torsoTop + 2 * s, 8 * s, 3.5 * s, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    /* הדפס על החולצה */
    if (c.logo) {
      ctx.save();
      ctx.globalAlpha *= 0.8;
      ctx.fillStyle = c.logo;
      U.roundRect(ctx, -6.5 * s, torsoTop + 14 * s, 13 * s, 13 * s, 3 * s);
      ctx.fill();
      ctx.restore();
    }

    /* ================= זרוע קדמית ================= */
    ctx.save();
    ctx.fillStyle = c.skin;
    ctx.translate(torsoW * 0.42, torsoTop + 10 * s);
    ctx.rotate(swing * 0.36 + (o.armRaise || 0));
    U.roundRect(ctx, -4.6 * s, 0, 9.2 * s, 24 * s, 4.6 * s);
    ctx.fill();

    if (o.hand === 'sticker') {
      ctx.save();
      ctx.translate(0, 26 * s);
      ctx.rotate(0.3);
      ctx.fillStyle = '#fdfaf2';
      U.roundRect(ctx, -6.5 * s, -5.5 * s, 13 * s, 11 * s, 2 * s);
      ctx.fill();
      ctx.fillStyle = c.shirt;
      U.circle(ctx, 0, 0, 2.8 * s);
      ctx.fill();
      ctx.restore();
    } else if (o.hand === 'phone') {
      ctx.save();
      ctx.translate(0, 26 * s);
      ctx.fillStyle = '#22202b';
      U.roundRect(ctx, -5 * s, -7.5 * s, 10 * s, 15 * s, 2.2 * s);
      ctx.fill();
      ctx.fillStyle = o.phoneLit ? '#ffffff' : '#5b6b8a';
      U.roundRect(ctx, -3.5 * s, -6 * s, 7 * s, 12 * s, 1.5 * s);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    /* ================= צוואר ================= */
    ctx.fillStyle = c.skinDark;
    U.roundRect(ctx, -5.5 * s, torsoTop - 7 * s, 11 * s, 11 * s, 3 * s);
    ctx.fill();

    /* ================= ראש ================= */
    const headY = torsoTop - 21 * s;
    const headR = 17 * s * (o.big ? 1.1 : 1);

    /* סנטר כפול קטן — הוא לא רזה */
    ctx.save();
    ctx.globalAlpha *= 0.4;
    ctx.fillStyle = c.skinDark;
    ctx.beginPath();
    ctx.ellipse(0, headY + headR * 0.80, headR * 0.56, headR * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const hg = ctx.createLinearGradient(-headR, headY - headR, headR * 0.7, headY + headR);
    hg.addColorStop(0, c.skinLight);
    hg.addColorStop(0.5, c.skin);
    hg.addColorStop(1, c.skinDark);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, headY, headR * 0.90, headR * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();

    /* אוזן */
    ctx.fillStyle = c.skinDark;
    ctx.beginPath();
    ctx.ellipse(-headR * 0.86, headY + headR * 0.12, 3.6 * s, 5.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    if (o.style === 'yehali') this._yehaliFace(ctx, s, headY, headR, c, o);
    else this._friendFace(ctx, s, headY, headR, c, o);

    ctx.restore();
  },

  /* ================================================================
     הפנים של יהלי
     ================================================================ */
  _yehaliFace(ctx, s, headY, headR, c, o) {

    const R = headR;

    /* פריסת הפנים אנכית — כל ערך יחסי לרדיוס הראש */
    const BROW_Y  = headY - R * 0.40;
    const EYE_Y   = headY + R * 0.06;
    const NOSE_Y  = headY + R * 0.34;
    const MOUTH_Y = headY + R * 0.76;
    const EX1 = -R * 0.30, EX2 = R * 0.44;   /* מרכזי העיניים (מבט שלושת־רבעי) */

    /* ---------- גבות עבות על המצח ---------- */
    ctx.fillStyle = c.facial;
    const brow = (bx, rot) => {
      ctx.save();
      ctx.translate(bx, BROW_Y);
      ctx.rotate(rot);
      U.roundRect(ctx, -5.2 * s, -1.7 * s, 10.4 * s, 3.4 * s, 1.7 * s);
      ctx.fill();
      ctx.restore();
    };
    brow(EX1, -0.13);
    brow(EX2, 0.06);

    /* ---------- עיניים ---------- */
    const blink = o.blink ? 0.12 : 1;
    ctx.fillStyle = '#f3ece4';
    ctx.beginPath();
    ctx.ellipse(EX1, EYE_Y, 3.8 * s, 3.2 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(EX2, EYE_Y, 4.1 * s, 3.4 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#251a12';
    ctx.beginPath();
    ctx.ellipse(EX1 + 0.6 * s, EYE_Y, 2.1 * s, 2.7 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(EX2 + 0.7 * s, EYE_Y, 2.2 * s, 2.8 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    /* ---------- אף ---------- */
    ctx.save();
    ctx.globalAlpha *= 0.42;
    ctx.fillStyle = c.skinDark;
    ctx.beginPath();
    ctx.ellipse(R * 0.16, NOSE_Y, 3.6 * s, 2.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* ---------- זיפים על הלסת ---------- */
    ctx.save();
    ctx.globalAlpha *= 0.16;
    ctx.fillStyle = c.facial;
    ctx.beginPath();
    ctx.ellipse(R * 0.04, headY + R * 0.62, R * 0.76, R * 0.46, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    /* ---------- שפם עבה (בין האף לפה) ---------- */
    ctx.fillStyle = c.facial;
    ctx.beginPath();
    ctx.moveTo(R * 0.06, headY + R * 0.40);
    /* אגף ימני שיורד החוצה */
    ctx.quadraticCurveTo(R * 0.36, headY + R * 0.36, R * 0.58, headY + R * 0.48);
    ctx.quadraticCurveTo(R * 0.44, headY + R * 0.62, R * 0.14, headY + R * 0.56);
    /* אגף שמאלי */
    ctx.quadraticCurveTo(-R * 0.16, headY + R * 0.62, -R * 0.44, headY + R * 0.54);
    ctx.quadraticCurveTo(-R * 0.30, headY + R * 0.36, R * 0.06, headY + R * 0.40);
    ctx.closePath();
    ctx.fill();

    /* ---------- פה ---------- */
    if (o.mouthOpen) {
      ctx.fillStyle = '#5c2a2c';
      ctx.beginPath();
      ctx.ellipse(R * 0.08, MOUTH_Y, 5 * s, 3.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f0e8';
      U.roundRect(ctx, R * 0.08 - 4 * s, MOUTH_Y - 3.4 * s, 8 * s, 2 * s, 1 * s);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#8a4c3c';
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-R * 0.22, MOUTH_Y - R * 0.03);
      ctx.quadraticCurveTo(R * 0.08, MOUTH_Y + R * 0.09, R * 0.38, MOUTH_Y - R * 0.05);
      ctx.stroke();
    }

    /* ---------- זקנקן מתחת לשפה ---------- */
    ctx.fillStyle = c.facial;
    ctx.beginPath();
    ctx.moveTo(-R * 0.10, headY + R * 0.92);
    ctx.quadraticCurveTo(R * 0.10, headY + R * 0.86, R * 0.30, headY + R * 0.94);
    ctx.quadraticCurveTo(R * 0.22, headY + R * 1.20, R * 0.06, headY + R * 1.17);
    ctx.quadraticCurveTo(-R * 0.08, headY + R * 1.12, -R * 0.10, headY + R * 0.92);
    ctx.closePath();
    ctx.fill();

    /* ---------- משקפיים מלבניים ---------- */
    const gy = EYE_Y;
    const lh = R * 0.40;
    const lw1 = R * 0.50, lw2 = R * 0.56;

    ctx.save();
    ctx.fillStyle = c.lens;
    U.roundRect(ctx, EX1 - lw1 / 2, gy - lh / 2, lw1, lh, R * 0.07); ctx.fill();
    U.roundRect(ctx, EX2 - lw2 / 2, gy - lh / 2, lw2, lh, R * 0.07); ctx.fill();

    ctx.strokeStyle = c.frame;
    ctx.lineWidth = 2.3 * s;
    ctx.lineJoin = 'round';
    U.roundRect(ctx, EX1 - lw1 / 2, gy - lh / 2, lw1, lh, R * 0.07); ctx.stroke();
    U.roundRect(ctx, EX2 - lw2 / 2, gy - lh / 2, lw2, lh, R * 0.07); ctx.stroke();

    /* גשר + זרוע לאוזן */
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(EX1 + lw1 / 2, gy - lh * 0.20);
    ctx.lineTo(EX2 - lw2 / 2, gy - lh * 0.20);
    ctx.moveTo(EX1 - lw1 / 2, gy - lh * 0.24);
    ctx.lineTo(-R * 0.88, gy - lh * 0.42);
    ctx.stroke();

    /* השתקפות */
    ctx.globalAlpha *= 0.42;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(EX2 - lw2 * 0.28, gy + lh * 0.30);
    ctx.lineTo(EX2 + lw2 * 0.14, gy - lh * 0.32);
    ctx.stroke();
    ctx.restore();

    /* ---------- שיער: כיפה עבה עם פוני מעל הגבות ---------- */
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.moveTo(-R * 0.96, headY - R * 0.10);
    ctx.quadraticCurveTo(-R * 1.18, headY - R * 1.02, -R * 0.10, headY - R * 1.16);
    ctx.quadraticCurveTo(R * 1.02, headY - R * 1.12, R * 0.94, headY - R * 0.26);
    /* קצה הפוני — גל שנופל שמאלה, נעצר מעל הגבות */
    ctx.quadraticCurveTo(R * 0.74, headY - R * 0.56, R * 0.30, headY - R * 0.63);
    ctx.quadraticCurveTo(-R * 0.24, headY - R * 0.72, -R * 0.62, headY - R * 0.52);
    ctx.quadraticCurveTo(-R * 0.88, headY - R * 0.36, -R * 0.96, headY - R * 0.10);
    ctx.closePath();
    ctx.fill();

    /* ברק */
    ctx.save();
    ctx.globalAlpha *= 0.42;
    ctx.fillStyle = c.hairHi;
    ctx.beginPath();
    ctx.ellipse(R * 0.16, headY - R * 0.82, R * 0.42, R * 0.14, -0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* פאה מול האוזן */
    ctx.fillStyle = c.hair;
    U.roundRect(ctx, -R * 0.99, headY - R * 0.28, 4.2 * s, 11 * s, 2 * s);
    ctx.fill();
  },

  /* ================================================================
     פנים של חבר
     ================================================================ */
  _friendFace(ctx, s, headY, headR, c, o) {
    const R = headR;
    const blink = o.blink ? 0.14 : 1;

    /* גבות */
    ctx.strokeStyle = '#241a14';
    ctx.lineWidth = 2.4 * s;
    ctx.lineCap = 'round';
    const drop = o.angry ? 4.5 * s : 0;
    ctx.beginPath();
    ctx.moveTo(-R * 0.60, headY - R * 0.26 + drop);
    ctx.lineTo(-R * 0.12, headY - R * 0.34);
    ctx.moveTo(R * 0.20, headY - R * 0.36);
    ctx.lineTo(R * 0.68, headY - R * 0.28 + drop);
    ctx.stroke();

    /* עיניים */
    ctx.fillStyle = '#f3ece4';
    ctx.beginPath();
    ctx.ellipse(-R * 0.34, headY + R * 0.08, 4 * s, 3.4 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.42, headY + R * 0.06, 4 * s, 3.4 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#241a14';
    const look = o.angry ? 0.06 : 0;
    ctx.beginPath();
    ctx.ellipse(-R * (0.30 - look), headY + R * 0.08, 2.2 * s, 2.8 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * (0.46 + look), headY + R * 0.06, 2.2 * s, 2.8 * s * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    /* אף */
    ctx.save();
    ctx.globalAlpha *= 0.32;
    ctx.fillStyle = c.skinDark;
    ctx.beginPath();
    ctx.ellipse(R * 0.14, headY + R * 0.36, 3 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* פה */
    if (o.mouthOpen) {
      ctx.fillStyle = '#5c2a2c';
      ctx.beginPath();
      ctx.ellipse(R * 0.10, headY + R * 0.66, 4.8 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#7c4436';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(-R * 0.18, headY + R * 0.62);
      ctx.quadraticCurveTo(R * 0.10, headY + R * 0.74, R * 0.40, headY + R * 0.60);
      ctx.stroke();
    }

    /* שיער */
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.moveTo(-R * 1.00, headY + R * 0.10);
    ctx.quadraticCurveTo(-R * 1.16, headY - R * 1.04, 0, headY - R * 1.14);
    ctx.quadraticCurveTo(R * 1.14, headY - R * 1.04, R * 0.98, headY + R * 0.10);
    ctx.quadraticCurveTo(R * 0.70, headY - R * 0.50, 0, headY - R * 0.58);
    ctx.quadraticCurveTo(-R * 0.70, headY - R * 0.50, -R * 1.00, headY + R * 0.10);
    ctx.closePath();
    ctx.fill();
  },

  /* ================================================================
     שדרוגים — אייקונים
     ================================================================ */
  pickupIcon(ctx, kind, x, y, r, t) {
    ctx.save();
    ctx.translate(x, y);

    switch (kind) {

      case 'duo': {
        ctx.fillStyle = '#58cc02';
        U.circle(ctx, 0, 0, r * 0.82); ctx.fill();
        ctx.fillStyle = '#89e219';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.24, r * 0.6, r * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        U.circle(ctx, -r * 0.3, -r * 0.16, r * 0.28); ctx.fill();
        U.circle(ctx,  r * 0.3, -r * 0.16, r * 0.28); ctx.fill();
        ctx.fillStyle = '#1c1c1c';
        U.circle(ctx, -r * 0.3, -r * 0.16, r * 0.15); ctx.fill();
        U.circle(ctx,  r * 0.3, -r * 0.16, r * 0.15); ctx.fill();
        ctx.fillStyle = '#ffc200';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.02); ctx.lineTo(-r * 0.15, r * 0.2); ctx.lineTo(r * 0.15, r * 0.2);
        ctx.closePath(); ctx.fill();
        break;
      }

      /* פרוסת פיצה */
      case 'pizza': {
        ctx.rotate(Math.sin(t * 2.2) * 0.16);
        ctx.fillStyle = '#e8a94f';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.95);
        ctx.lineTo(r * 0.82, r * 0.7);
        ctx.lineTo(-r * 0.82, r * 0.7);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcf7a';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.72);
        ctx.lineTo(r * 0.64, r * 0.52);
        ctx.lineTo(-r * 0.64, r * 0.52);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d8442f';
        U.circle(ctx, 0, -r * 0.1, r * 0.17); ctx.fill();
        U.circle(ctx, -r * 0.3, r * 0.32, r * 0.15); ctx.fill();
        U.circle(ctx, r * 0.3, r * 0.32, r * 0.15); ctx.fill();
        break;
      }

      /* אגרוף — גולאש */
      case 'fist': {
        const punch = 1 + Math.sin(t * 7) * 0.07;
        ctx.scale(punch, punch);
        ctx.fillStyle = '#e0b088';
        U.roundRect(ctx, -r * 0.72, -r * 0.6, r * 1.44, r * 1.2, r * 0.36);
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,50,30,.55)';
        ctx.lineWidth = Math.max(1, r * 0.11);
        for (let i = 0; i < 3; i++) {
          const yy = -r * 0.26 + i * r * 0.3;
          ctx.beginPath();
          ctx.moveTo(-r * 0.5, yy); ctx.lineTo(r * 0.38, yy);
          ctx.stroke();
        }
        ctx.fillStyle = '#c98d5f';
        U.roundRect(ctx, -r * 0.86, -r * 0.2, r * 0.34, r * 0.62, r * 0.16);
        ctx.fill();
        break;
      }

      case 'plane': {
        ctx.rotate(-0.35 + Math.sin(t * 2) * 0.08);
        ctx.fillStyle = '#eaf7ff';
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, 0);
        ctx.quadraticCurveTo(0, -r * 0.30, r * 0.92, -r * 0.06);
        ctx.quadraticCurveTo(r * 0.98, 0, r * 0.92, r * 0.08);
        ctx.quadraticCurveTo(0, r * 0.28, -r * 0.9, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6ce0ff';
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, -r * 0.05); ctx.lineTo(-r * 0.5, -r * 0.72);
        ctx.lineTo(-r * 0.15, -r * 0.68); ctx.lineTo(r * 0.24, -r * 0.05);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, r * 0.05); ctx.lineTo(-r * 0.5, r * 0.7);
        ctx.lineTo(-r * 0.15, r * 0.66); ctx.lineTo(r * 0.24, r * 0.05);
        ctx.closePath(); ctx.fill();
        break;
      }

      case 'meat': {
        ctx.fillStyle = '#e8556f';
        ctx.beginPath();
        ctx.moveTo(-r * 0.78, -r * 0.3);
        ctx.quadraticCurveTo(0, -r * 0.9, r * 0.8, -r * 0.36);
        ctx.quadraticCurveTo(r * 0.95, r * 0.3, r * 0.2, r * 0.78);
        ctx.quadraticCurveTo(-r * 0.6, r * 0.86, -r * 0.85, r * 0.1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,235,235,.72)';
        ctx.lineWidth = r * 0.11; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.6 + i * r * 0.34, -r * 0.28 + (i % 2) * r * 0.2);
          ctx.quadraticCurveTo(-r * 0.3 + i * r * 0.34, r * 0.1, -r * 0.55 + i * r * 0.34, r * 0.55);
          ctx.stroke();
        }
        break;
      }

      case 'skull': {
        ctx.fillStyle = '#f2f2f2';
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, -r * 0.2);
        ctx.quadraticCurveTo(-r * 0.62, -r * 0.86, 0, -r * 0.86);
        ctx.quadraticCurveTo(r * 0.62, -r * 0.86, r * 0.62, -r * 0.2);
        ctx.lineTo(r * 0.46, r * 0.28);
        ctx.quadraticCurveTo(r * 0.30, r * 0.84, 0, r * 0.84);
        ctx.quadraticCurveTo(-r * 0.30, r * 0.84, -r * 0.46, r * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#141414';
        ctx.beginPath();
        ctx.ellipse(-r * 0.27, -r * 0.22, r * 0.19, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.27, -r * 0.22, r * 0.19, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        for (let i = -1; i <= 1; i++) {
          U.roundRect(ctx, i * r * 0.2 - r * 0.06, r * 0.3, r * 0.12, r * 0.34, r * 0.04);
          ctx.fill();
        }
        break;
      }

      case 'star': {
        const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#fff9d6');
        g.addColorStop(0.5, '#ffd93d');
        g.addColorStop(1, '#ff9d1f');
        ctx.fillStyle = g;
        ctx.rotate(t * 1.1);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const rad = i % 2 === 0 ? r : r * 0.44;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
    }

    ctx.restore();
  },

  /* ================================================================
     סטיקר מעופף
     ================================================================ */
  shot(ctx, x, y, rot, r, img) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fdfaf2';
    U.roundRect(ctx, -r, -r * 1.25, r * 2, r * 2.5, r * 0.28);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      U.roundRect(ctx, -r * 0.84, -r * 1.1, r * 1.68, r * 2.05, r * 0.2);
      ctx.clip();
      this._cover(ctx, img, -r * 0.84, -r * 1.1, r * 1.68, r * 2.05);
      ctx.restore();
    } else {
      ctx.fillStyle = '#8b52d6';
      U.roundRect(ctx, -r * 0.84, -r * 1.1, r * 1.68, r * 2.05, r * 0.2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.lineWidth = 1.2;
    U.roundRect(ctx, -r, -r * 1.25, r * 2, r * 2.5, r * 0.28);
    ctx.stroke();
    ctx.restore();
  },

  /* מצייר תמונה במילוי "cover" בתוך מלבן */
  _cover(ctx, img, x, y, w, h) {
    const ir = img.naturalWidth / img.naturalHeight;
    const br = w / h;
    let dw, dh;
    if (ir > br) { dh = h; dw = h * ir; }
    else { dw = w; dh = w / ir; }
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  },

  /* ================================================================
     מכשולים
     ================================================================ */
  obstacle(ctx, ob) {
    const { x, y, w, h, kind } = ob;

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#000';
    U.roundRect(ctx, x + 4, y + 9, w, h, 12);
    ctx.fill();
    ctx.restore();

    if (kind === 'table') {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#8a6242'); g.addColorStop(1, '#5d3f28');
      ctx.fillStyle = g;
      U.roundRect(ctx, x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,180,.16)'; ctx.lineWidth = 2;
      U.roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 7); ctx.stroke();
      ctx.fillStyle = '#2f6b45';
      U.roundRect(ctx, x + w * 0.44, y + h * 0.16, 12, 26, 4); ctx.fill();
      ctx.fillStyle = 'rgba(230,245,255,.6)';
      U.circle(ctx, x + w * 0.26, y + h * 0.6, 7); ctx.fill();
      U.circle(ctx, x + w * 0.7, y + h * 0.62, 7); ctx.fill();

    } else if (kind === 'couch') {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#4f6b7a'); g.addColorStop(1, '#33454f');
      ctx.fillStyle = g;
      U.roundRect(ctx, x, y, w, h, 12); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      U.roundRect(ctx, x + 8, y + 8, w - 16, h * 0.44, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      U.roundRect(ctx, x + 8, y + h * 0.58, w - 16, h * 0.32, 7); ctx.fill();

    } else {
      ctx.fillStyle = '#7a4a2c';
      U.roundRect(ctx, x + w * 0.22, y + h * 0.55, w * 0.56, h * 0.42, 7); ctx.fill();
      ctx.fillStyle = '#2f7a41';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.save();
        ctx.translate(x + w / 2, y + h * 0.5);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.24, w * 0.13, h * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#3f9e55';
      U.circle(ctx, x + w / 2, y + h * 0.44, w * 0.17); ctx.fill();
    }
  },

  /* ================================================================
     רצפת הזירה
     ================================================================ */
  /* pal — פלטת המפה הנוכחית (CFG.maps[i].pal). בלעדיה: צבעי הסלון. */
  floor(ctx, w, h, t, pal) {
    const p = pal || {
      a: '#2a2340', b: '#1d1830', c: '#120e20',
      grid: '#c9b6ff', glow: '#ff9d1f', frame: '255,204,61'
    };

    const g = ctx.createRadialGradient(w / 2, h * 0.42, 60, w / 2, h * 0.5, w * 0.72);
    g.addColorStop(0, p.a);
    g.addColorStop(0.55, p.b);
    g.addColorStop(1, p.c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    const T = 80;
    ctx.beginPath();
    for (let x = T; x < w; x += T) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = T; y < h; y += T) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.restore();

    /* כתמי אור על הרצפה — במפה גדולה כתם יחיד במרכז נעלם,
       אז נפרסים כמה לפי הגודל בפועל. */
    ctx.save();
    ctx.globalAlpha = 0.12;
    const cols = Math.max(1, Math.round(w / 900));
    const rows = Math.max(1, Math.round(h / 700));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cx = w * (i + 0.5) / cols, cy = h * (j + 0.5) / rows;
        const rg = ctx.createRadialGradient(cx, cy, 30, cx, cy, 300);
        rg.addColorStop(0, p.glow);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 310, 220, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    const wall = CFG.WALL, top = CFG.FRAME_TOP;
    const aw = w - wall * 2, ah = h - top - wall;
    ctx.save();
    ctx.strokeStyle = 'rgba(' + p.frame + ',.20)';
    ctx.lineWidth = 3;
    U.roundRect(ctx, wall, top, aw, ah, 18);
    ctx.stroke();
    ctx.globalAlpha = 0.5 + Math.sin(t * 1.6) * 0.12;
    ctx.strokeStyle = 'rgba(' + p.frame + ',.10)';
    ctx.lineWidth = 10;
    U.roundRect(ctx, wall, top, aw, ah, 18);
    ctx.stroke();
    ctx.restore();
  },

  vignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.86);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
};
