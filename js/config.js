/* ============================================================
   config.js — כל המספרים והתוכן במקום אחד
   ============================================================ */
'use strict';

const CFG = {

  /* --- מידות עולם (לוגיות; הקנבס מתוח לגודל החלון) --- */
  W: 1280,
  H: 720,
  WALL: 26,            // מסגרת שמאל/ימין/למטה
  WALL_TOP: 100,       // עד לאן דמויות מורשות לעלות — משאיר את ה-HUD קריא
  FRAME_TOP: 32,       // איפה מצוירת מסגרת הזירה. גבוה מ-WALL_TOP
                       // כדי שראשי הדמויות לא יבלטו אל מחוץ למסגרת.

  /* --- שחקן --- */
  player: {
    r: 21,
    accel: 2300,       // תאוצה px/s²
    speed: 252,        // מהירות מרבית רגילה
    dashSpeed: 780,
    dashTime: 0.17,
    dashCooldown: 1.9,
    dashIFrames: 0.26, // חסינות במהלך הדאש ומעט אחריו
    hitIFrames: 1.9    // חסינות אחרי חטיפת סטיקר
  },

  /* --- חיים = סטיקרים --- */
  maxStickers: 5,

  /* --- גלים --- */
  wave: {
    duration: 18,      // שניות לגל
    startCount: 2,     // כמה חברה בגל הראשון
    perWave: 0.9,      // תוספת חברה לגל (מתעגל)
    maxAlive: 13,      // תקרה קשיחה — שלא ייהפך למרק
    spawnStagger: 0.75 // השהיה בין הופעות באותו גל
  },

  /* --- סוגי חברה ---
     speed  : מהירות בסיס
     grow   : כמה מהירות נוספת לגל (עם תקרה)
     unlock : מאיזה גל הסוג מתחיל להופיע
     weight : משקל בהגרלה                                        */
  foes: {
    chaser: {
      name: 'רודף', r: 19, speed: 108, grow: 4.2, maxSpeed: 186,
      unlock: 1, weight: 10, color: '#3f7fd4'
    },
    sprinter: {
      name: 'ספרינטר', r: 18, speed: 74, grow: 2.4, maxSpeed: 120,
      unlock: 3, weight: 7, color: '#e0762a',
      windup: 0.72,      // זמן סימון לפני הזינוק
      chargeSpeed: 640,
      chargeTime: 0.5,
      restTime: 1.25,
      cycle: 2.1         // כל כמה זמן מנסה שוב
    },
    photog: {
      name: 'צלם', r: 18, speed: 96, grow: 3, maxSpeed: 150,
      unlock: 4, weight: 6, color: '#8b52d6',
      keepDist: 250,     // מרחק שמירה מהשחקן
      shotCooldown: 2.9,
      aimTime: 0.55,
      shotSpeed: 285
    },
    tank: {
      name: 'טנק', r: 29, speed: 68, grow: 2.2, maxSpeed: 112,
      unlock: 6, weight: 4, color: '#b03a44'
    }
  },

  /* --- פרויקטילים (סטיקר מעופף) --- */
  shot: { r: 13, life: 4.2 },

  /* --- שדרוגים --- */
  pickup: {
    r: 20,
    life: 11,            // כמה זמן נשאר על הרצפה
    firstAt: 6.5,        // מתי מופיע הראשון
    every: [9.5, 15],    // טווח זמן בין הופעות
    seychellesChance: 0.11
  },

  power: {
    duo:    { name: 'דואלינגו',   dur: 3.4, color: '#8ee34a', glyph: 'duo' },
    boeing: { name: 'בואינג 737', dur: 5.0, color: '#6ce0ff', glyph: 'plane' },
    wagyu:  { name: 'וואגיו A5',  dur: 0,   color: '#ff7a9c', glyph: 'meat' },
    pun:    { name: 'פאנישר',     dur: 4.2, color: '#f0f0f0', glyph: 'skull' },
    sey:    { name: 'סיישל',      dur: 0,   color: '#ffd93d', glyph: 'star' }
  },

  boeingMult: 1.55,      // מכפיל מהירות תחת בואינג

  /* --- ניקוד --- */
  score: {
    perSecond: 10,
    pickup: 150,
    seychelles: 1500,
    nearMiss: 40,        // כפול מכפיל הקומבו
    waveClear: 200,
    knockout: 90         // הפלה תחת פאנישר
  },

  combo: {
    max: 8,
    decay: 3.1,          // שניות עד שיורד שלב
    nearMissDist: 54     // מרחק "כמעט!" מעבר לרדיוסים
  },

  /* --- מכשולים בזירה (יחסי לגודל העולם) --- */
  obstacles: [
    { x: 0.5,  y: 0.5,  w: 190, h: 96,  kind: 'table' },
    { x: 0.17, y: 0.24, w: 128, h: 82,  kind: 'couch' },
    { x: 0.83, y: 0.24, w: 128, h: 82,  kind: 'couch' },
    { x: 0.17, y: 0.77, w: 104, h: 104, kind: 'plant' },
    { x: 0.83, y: 0.77, w: 104, h: 104, kind: 'plant' }
  ],

  /* --- כינויים (למסך "נפסלת") --- */
  nicknames: ['גולד', 'סיישל', 'יהלי ג׳מאלי', 'יהלי פיצה'],

  /* --- הסטיקרים: קובץ + הכיתוב שבו --- */
  stickers: [
    { file: 'st_duolingo.jpg', caption: 'ששש אני לומד דואלינגו' },
    { file: 'st_flag.jpg',     caption: 'לבאט פלאג יש שלט ואז זה עושה ככה חזק יותר' },
    { file: 'st_punisher.jpg', caption: 'אני הכי אהבתי את הפאנישר באודיסאה!' },
    { file: 'st_sticker.jpg',  caption: 'איזה סטיקר המ אההאהא' },
    { file: 'st_zuz.jpg',      caption: 'דיי זוז הוא יעשה לי סטיקרר' },
    { file: 'st_boeing.jpg',   caption: 'זה בואינג 737' },
    { file: 'st_wagyu.jpg',    caption: 'אני וואגיו A5!' },
    { file: 'st_yad.jpg',      caption: 'הבא לפה, הבא לפה, תביא ביד' },
    { file: 'st_million.jpg',  caption: 'בשביל מליון שקלים היית מזיין גבר?' },
    { file: 'st_tzalem.jpg',   caption: 'תפסיק לצלם אותי יא נוד כלוא!' }
  ],

  /* --- קריאות של החברה כשהם מתקרבים --- */
  taunts: [
    'תפסתי אותך!',
    'בוא הנה!',
    'סטיקר!',
    'אל תזוז!',
    'הבא לפה!',
    'צילמתי!',
    'זהו, נגמר לך'
  ],

  /* --- שורות שמופיעות ברגע חטיפת סטיקר --- */
  hitLines: [
    'חטפת סטיקר!',
    'הודבק.',
    'זה נשאר שם.',
    'תיעוד רשמי.',
    'עלה לקבוצה.'
  ],

  /* --- אחסון --- */
  keys: {
    best: 'yehali_best_v1',
    unlocked: 'yehali_unlocked_v1',
    muted: 'yehali_muted_v1'
  }
};
