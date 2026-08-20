/* ============================================================
   config.js — כל המספרים והתוכן במקום אחד
   ============================================================ */
'use strict';

const CFG = {

  /* --- מידות התצוגה (הקנבס מתוח לגודל החלון) ---
     W/H הם גודל ה"חלון" שרואים, ולא גודל המפה.
     מפה גדולה מהחלון => המצלמה עוקבת אחרי יהלי. */
  W: 1280,
  H: 720,

  /* גודל המפה הנוכחית — נדרס ע"י Game.loadMap() בכל התחלת ריצה.
     כל לוגיקת העולם (גבולות, הופעות, קליעים) עובדת מול אלה, לא מול W/H. */
  worldW: 1280,
  worldH: 720,

  WALL: 26,            // מסגרת שמאל/ימין/למטה
  WALL_TOP: 100,       // עד לאן דמויות מורשות לעלות — משאיר את ה-HUD קריא
  FRAME_TOP: 32,       // איפה מצוירת מסגרת הזירה. גבוה מ-WALL_TOP
                       // כדי שראשי הדמויות לא יבלטו אל מחוץ למסגרת.

  /* --- מצלמה --- */
  cam: {
    follow: 0.12,      // כמה מהר המצלמה סוגרת מרחק (damp rate)
    lookAhead: 0.28    // כמה היא מקדימה את כיוון התנועה
  },

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
    },

    /* --- שלושה סוגים חדשים. כל אחד עם התנהגות שלא חופפת לארבעת הוותיקים --- */

    /* חוסם: לא רודף אחריך — רודף לאן שאתה *עומד להיות*.
       מיירט במקום לעקוב, ולכן "לברוח בקו ישר" מפסיק לעבוד. */
    blocker: {
      name: 'חוסם', r: 19, speed: 116, grow: 4.0, maxSpeed: 194,
      unlock: 5, weight: 6, color: '#2f9e8f',
      lead: 0.85          // כמה שניות קדימה הוא מנחש
    },

    /* דביק: איטי, אבל מטפטף שלוליות שמאטות אותך.
       שולט בשטח במקום לתפוס — נהיה מסוכן דווקא במפות הגדולות. */
    sticky: {
      name: 'דביק', r: 20, speed: 78, grow: 2.0, maxSpeed: 118,
      unlock: 7, weight: 5, color: '#c98a2b',
      dropEvery: 0.9,     // כל כמה זמן נופלת שלולית
      puddleR: 44,
      puddleLife: 6.5,
      slow: 0.52          // מכפיל מהירות לשחקן בתוך שלולית
    },

    /* קופץ: מזנק בקשת. באוויר אי אפשר לפגוע בו והוא לא נעצר —
       הנחיתה היא ההזדמנות שלך, וגם הסכנה. */
    hopper: {
      name: 'קופץ', r: 18, speed: 88, grow: 2.6, maxSpeed: 132,
      unlock: 4, weight: 6, color: '#d14ea0',
      hopEvery: 2.3,      // מרווח בין קפיצות
      hopTime: 0.72,      // משך הקפיצה
      hopRange: 330,
      hopHeight: 78
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

  /* --- שדרוגים ---
     weight : משקל בהגרלה. ככל שגבוה יותר — מופיע יותר.
              עד עכשיו כל השדרוגים הופיעו בהסתברות שווה; המשקלים
              הם מה שמאפשר לעשות נרף לפאנישר בלי לגעת בלוגיקה.
     weight=0 => לא מוגרל אקראית (מגיע רק בדרך ייעודית). */
  power: {
    duo:    { name: 'דואלינגו',   dur: 3.4, color: '#8ee34a', glyph: 'duo',   weight: 12 },
    duoPro: { name: 'דואלינגו+',  dur: 7.2, color: '#5fd900', glyph: 'duo',   weight: 3, rare: true },
    boeing: { name: 'בואינג 737', dur: 5.0, color: '#6ce0ff', glyph: 'plane', weight: 10 },
    pizza:  { name: 'יהלי פיצה',  dur: 6.5, color: '#ff8a3d', glyph: 'pizza', weight: 9 },
    goulash:{ name: 'גולאש',      dur: 0,   color: '#e0563b', glyph: 'fist',  weight: 8 },
    wagyu:  { name: 'וואגיו A5',  dur: 0,   color: '#ff7a9c', glyph: 'meat',  weight: 0 },
    pun:    { name: 'פאנישר',     dur: 4.2, color: '#f0f0f0', glyph: 'skull', weight: 4 },
    sey:    { name: 'סיישל',      dur: 0,   color: '#ffd93d', glyph: 'star',  weight: 0 }
  },

  boeingMult: 1.55,      // מכפיל מהירות תחת בואינג

  /* --- יהלי פיצה: זורק פיצה על הקרוב ביותר, לבד --- */
  pizzaShot: {
    every: 0.85,         // כל כמה זמן נזרקת פיצה
    range: 460,
    speed: 520,
    r: 15
  },

  /* --- גולאש: אגרוף בטן שמפיל את כל מי שקרוב --- */
  goulash: {
    radius: 235,
    knockback: 620
  },

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

  /* ============================================================
     מפות
     ------------------------------------------------------------
     w/h    : גודל המפה. גדול מ-W/H => המצלמה עוקבת אחרי יהלי.
     cost   : כמה גביעים צריך כדי לפתוח (0 = פתוח מהתחלה)
     pal    : צבעי הרצפה/המסגרת של המפה
     foes   : אילו סוגי חברה מופיעים כאן. לא כולם בכל מפה — זה מה
              שגורם למפה להרגיש שונה ולא רק להיראות שונה.
     obstacles: יחסי (0..1) לגודל המפה
     ============================================================ */
  maps: [
    {
      id: 'salon',
      name: 'הסלון של יהלי',
      sub: 'איפה שהכל התחיל',
      w: 1280, h: 720,
      cost: 0,
      pal: { a: '#2a2340', b: '#1d1830', c: '#120e20', grid: '#c9b6ff', glow: '#ff9d1f', frame: '255,204,61' },
      foes: ['chaser', 'sprinter', 'photog', 'tank'],
      obstacles: [
        { x: 0.5,  y: 0.5,  w: 190, h: 96,  kind: 'table' },
        { x: 0.17, y: 0.24, w: 128, h: 82,  kind: 'couch' },
        { x: 0.83, y: 0.24, w: 128, h: 82,  kind: 'couch' },
        { x: 0.17, y: 0.77, w: 104, h: 104, kind: 'plant' },
        { x: 0.83, y: 0.77, w: 104, h: 104, kind: 'plant' }
      ]
    },

    {
      id: 'boeing',
      name: 'הבואינג 737',
      sub: 'ארוך, צר, ואין לאן לברוח',
      w: 2040, h: 760,
      cost: 8,
      pal: { a: '#1b2c3a', b: '#132231', c: '#0b1620', grid: '#8fd4ff', glow: '#49d6ff', frame: '108,224,255' },
      foes: ['chaser', 'sprinter', 'hopper', 'photog'],
      obstacles: [
        { x: 0.12, y: 0.30, w: 150, h: 70, kind: 'couch' },
        { x: 0.12, y: 0.70, w: 150, h: 70, kind: 'couch' },
        { x: 0.34, y: 0.30, w: 150, h: 70, kind: 'couch' },
        { x: 0.34, y: 0.70, w: 150, h: 70, kind: 'couch' },
        { x: 0.56, y: 0.30, w: 150, h: 70, kind: 'couch' },
        { x: 0.56, y: 0.70, w: 150, h: 70, kind: 'couch' },
        { x: 0.78, y: 0.30, w: 150, h: 70, kind: 'couch' },
        { x: 0.78, y: 0.70, w: 150, h: 70, kind: 'couch' },
        { x: 0.93, y: 0.50, w: 120, h: 150, kind: 'table' }
      ]
    },

    {
      id: 'romania',
      name: 'יהלי ברומניה',
      sub: 'רחוב אבנים, המון פינות',
      w: 1900, h: 1080,
      cost: 22,
      pal: { a: '#3a2d24', b: '#2a2019', c: '#171110', grid: '#ffd0a0', glow: '#ff9d1f', frame: '255,180,90' },
      foes: ['chaser', 'blocker', 'sprinter', 'tank', 'sticky'],
      obstacles: [
        { x: 0.20, y: 0.22, w: 160, h: 120, kind: 'table' },
        { x: 0.50, y: 0.18, w: 220, h: 90,  kind: 'couch' },
        { x: 0.80, y: 0.22, w: 160, h: 120, kind: 'table' },
        { x: 0.15, y: 0.55, w: 110, h: 110, kind: 'plant' },
        { x: 0.50, y: 0.52, w: 260, h: 120, kind: 'table' },
        { x: 0.85, y: 0.55, w: 110, h: 110, kind: 'plant' },
        { x: 0.28, y: 0.84, w: 190, h: 90,  kind: 'couch' },
        { x: 0.72, y: 0.84, w: 190, h: 90,  kind: 'couch' }
      ]
    },

    {
      id: 'duolingo',
      name: 'האי של דואולינגו',
      sub: 'הינשוף רואה הכל',
      w: 2100, h: 1150,
      cost: 45,
      pal: { a: '#1e3a24', b: '#162b1b', c: '#0c1810', grid: '#9bff5b', glow: '#8ee34a', frame: '155,255,91' },
      foes: ['chaser', 'hopper', 'blocker', 'photog', 'sticky'],
      obstacles: [
        { x: 0.50, y: 0.50, w: 240, h: 240, kind: 'plant' },
        { x: 0.18, y: 0.20, w: 140, h: 140, kind: 'plant' },
        { x: 0.82, y: 0.20, w: 140, h: 140, kind: 'plant' },
        { x: 0.18, y: 0.80, w: 140, h: 140, kind: 'plant' },
        { x: 0.82, y: 0.80, w: 140, h: 140, kind: 'plant' },
        { x: 0.50, y: 0.14, w: 200, h: 80,  kind: 'couch' },
        { x: 0.50, y: 0.86, w: 200, h: 80,  kind: 'couch' }
      ]
    },

    {
      id: 'seychelles',
      name: 'סיישל',
      sub: 'הכי גדולה. הכי מסוכנת.',
      w: 2300, h: 1250,
      cost: 75,
      pal: { a: '#2b2a52', b: '#1d1c3d', c: '#101028', grid: '#ffe98a', glow: '#ffd93d', frame: '255,217,61' },
      foes: ['chaser', 'sprinter', 'photog', 'tank', 'blocker', 'sticky', 'hopper'],
      obstacles: [
        { x: 0.50, y: 0.50, w: 300, h: 140, kind: 'table' },
        { x: 0.22, y: 0.26, w: 150, h: 150, kind: 'plant' },
        { x: 0.78, y: 0.26, w: 150, h: 150, kind: 'plant' },
        { x: 0.22, y: 0.74, w: 150, h: 150, kind: 'plant' },
        { x: 0.78, y: 0.74, w: 150, h: 150, kind: 'plant' },
        { x: 0.50, y: 0.16, w: 240, h: 90,  kind: 'couch' },
        { x: 0.50, y: 0.84, w: 240, h: 90,  kind: 'couch' },
        { x: 0.10, y: 0.50, w: 100, h: 200, kind: 'table' },
        { x: 0.90, y: 0.50, w: 100, h: 200, kind: 'table' }
      ]
    }
  ],

  /* --- גביעים: עולים על ריצה טובה, יורדים על ריצה חלשה --- */
  trophy: {
    perWave: 1,          // גביע לכל גל שעברת מעל הסף
    freeWaves: 2,        // עד גל כזה לא מרוויחים (וגם לא מפסידים)
    lossOnBad: -2,       // כמה יורד כשלא עברת את הסף
    max: 999
  },

  /* --- מטבעות --- */
  coin: {
    perWave: 4,          // על כל גל שהושלם
    perCombo: 2,         // על כל "כמעט!" בקומבו מקסימלי
    per1000: 3,          // על כל 1000 נקודות
    firstClear: 25       // בונוס חד-פעמי על פתיחת מפה חדשה
  },

  /* --- כינויים (למסך "נפסלת") --- */
  nicknames: ['גולד', 'סיישל', 'יהלי ג׳מאלי', 'יהלי פיצה'],

  /* ============================================================
     נדירות סטיקרים — 5 דרגות, מהנפוץ לנדיר ביותר
     ------------------------------------------------------------
     weight : משקל בהגרלה. נמוך יותר = נדיר יותר.
     הנדירות בפועל = weight של הדרגה × mult של הסט שהסטיקר שייך אליו.
     ============================================================ */
  rarity: {
    order: ['רגיל', 'נדיר', 'גולש', 'סיישל', 'אולטרה סיישל'],
    tiers: {
      'רגיל':          { weight: 100, color: '#b9b3c7', glow: 0 },
      'נדיר':          { weight: 40,  color: '#49d6ff', glow: 0 },
      'גולש':          { weight: 15,  color: '#9bff5b', glow: 1 },
      'סיישל':         { weight: 5,   color: '#ffd93d', glow: 1 },
      'אולטרה סיישל':  { weight: 1,   color: '#ff3b6b', glow: 2 }
    }
  },

  /* ============================================================
     סטים
     ------------------------------------------------------------
     mult : מכפיל נדירות של הסט כולו. קטן מ-1 = כל הסט נדיר יותר.
            כך "רגיל" בתוך סט נדיר באמת נדיר יותר מ"רגיל" בסט רגיל.
     map  : null = מופיע בכל מפה. אחרת — רק במפה הזו.
     ============================================================ */
  sets: {
    klasi:  { name: 'הקלאסיקות', mult: 1,    map: null },
    tinok:  { name: 'יהלי תינוק', mult: 0.55, map: null },
    romania:{ name: 'יהלי ברומניה', mult: 0.4,  map: 'romania' },
    sey:    { name: 'סיישל', mult: 0.25, map: 'seychelles' }
  },

  /* --- הסטיקרים ---
     file    : שם הקובץ ב-assets/stickers/
     caption : הכיתוב שבתמונה
     set     : מפתח מתוך CFG.sets למעלה
     tier    : אחת מ-5 הדרגות ב-CFG.rarity.order
     media   : 'image' (ברירת מחדל) או 'video' לסטיקרי וידאו עתידיים
               (וידאו: הקובץ יושב ב-assets/stickers-video/) */
  stickers: [
    { file: 'st_duolingo.jpg', caption: 'ששש אני לומד דואלינגו', set: 'klasi', tier: 'רגיל' },
    { file: 'st_flag.jpg',     caption: 'לבאט פלאג יש שלט ואז זה עושה ככה חזק יותר', set: 'klasi', tier: 'רגיל' },
    { file: 'st_punisher.jpg', caption: 'אני הכי אהבתי את הפאנישר באודיסאה!', set: 'klasi', tier: 'נדיר' },
    { file: 'st_sticker.jpg',  caption: 'איזה סטיקר המ אההאהא', set: 'klasi', tier: 'רגיל' },
    { file: 'st_zuz.jpg',      caption: 'דיי זוז הוא יעשה לי סטיקרר', set: 'klasi', tier: 'רגיל' },
    { file: 'st_boeing.jpg',   caption: 'זה בואינג 737', set: 'klasi', tier: 'נדיר' },
    { file: 'st_wagyu.jpg',    caption: 'אני וואגיו A5!', set: 'klasi', tier: 'גולש' },
    { file: 'st_yad.jpg',      caption: 'הבא לפה, הבא לפה, תביא ביד', set: 'klasi', tier: 'רגיל' },
    { file: 'st_million.jpg',  caption: 'בשביל מליון שקלים היית מזיין גבר?', set: 'klasi', tier: 'נדיר' },
    { file: 'st_tzalem.jpg',   caption: 'תפסיק לצלם אותי יא נוד כלוא!', set: 'klasi', tier: 'גולש' }
  ],

  /* --- איך זוכים בסטיקר לאוסף ---
     כבר לא ע"י חטיפה. שני ערוצים: מיומנות (פריט שצף בזירה) ומזל טהור. */
  collect: {
    firstAt: 14,         // מתי מופיע פריט האיסוף הראשון
    every: [17, 26],     // טווח בין הופעות
    life: 13,            // כמה זמן נשאר בזירה
    r: 22,
    luckyChance: 0.055,  // "בפוקס" — סיכוי לנפילה אקראית בכל גל
    luckyMinWave: 3
  },

  /* ============================================================
     חנות — קוסמטיקה בלבד. לא משפיע על קושי או כוח.
     cat: skin | trail | stamp
     ============================================================ */
  shopItems: [
    { id: 'trail_gold',  cat: 'trail', name: 'שובל זהב',    cost: 40,  color: '#ffcc3d' },
    { id: 'trail_ice',   cat: 'trail', name: 'שובל קרח',    cost: 60,  color: '#49d6ff' },
    { id: 'trail_lime',  cat: 'trail', name: 'שובל ליים',   cost: 60,  color: '#9bff5b' },
    { id: 'trail_hot',   cat: 'trail', name: 'שובל ורוד',   cost: 90,  color: '#ff3b6b' },
    { id: 'skin_classic',cat: 'skin',  name: 'יהלי קלאסי',  cost: 0,   shirt: '#ffcc3d' },
    { id: 'skin_night',  cat: 'skin',  name: 'יהלי לילה',   cost: 120, shirt: '#6a5acd' },
    { id: 'skin_pizza',  cat: 'skin',  name: 'יהלי פיצה',   cost: 150, shirt: '#ff8a3d' },
    { id: 'skin_sey',    cat: 'skin',  name: 'יהלי סיישל',  cost: 250, shirt: '#ffd93d' },
    { id: 'stamp_gold',  cat: 'stamp', name: 'חותמת זהב',   cost: 80,  color: '#ffcc3d' },
    { id: 'stamp_lime',  cat: 'stamp', name: 'חותמת ליים',  cost: 80,  color: '#9bff5b' }
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

  /* ============================================================
     יהלי עונה
     ------------------------------------------------------------
     כשחבר צועק משהו, יהלי לפעמים מחזיר — והצורה האייקונית היא
     "אמאשך" + בדיוק מה שהוא אמר ("בוא לפה" => "אמאשך בוא לפה").
     ============================================================ */
  yehaliTalk: {
    chance: 0.55,        // כמה מהקריאות זוכות לתשובה
    delay: [0.35, 0.8],  // השהיה לפני התשובה — שלא ידברו יחד
    prefix: 'אמאשך ',
    solo: [              // תשובות עצמאיות, לא הדהוד
      'אמאשך',
      'אמאשך מה אתה רוצה',
      'אמאשך תעזוב אותי',
      'אמאשך די כבר'
    ]
  },

  /* --- דואלינגו: יהלי לומד ספרדית. עם שגיאות. --- */
  duoLines: [
    'אעממ… מנזנס זה מלפפון',
    'אגואה',
    'אבא',
    'אמא',
    'אעממ… רגע',
    'קומו סה דיסה…'
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
    muted: 'yehali_muted_v1',
    coins: 'yehali_coins_v1',
    trophies: 'yehali_trophies_v1',
    owned: 'yehali_owned_v1',
    equipped: 'yehali_equipped_v1',
    mapsOpen: 'yehali_maps_open_v1',
    bestMap: 'yehali_best_map_v1'   // שיא לכל מפה בנפרד
  }
};
