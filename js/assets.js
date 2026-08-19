/* ============================================================
   assets.js — טעינת תמונות הסטיקרים
   ============================================================ */
'use strict';

const Assets = {

  images: {},        // file -> HTMLImageElement (רק כאלה שנטענו)
  ready: [],         // רשימת אינדקסים של סטיקרים שזמינים בפועל
  loaded: 0,
  total: 0,

  /* טוען את כל הסטיקרים. תמונה שנכשלת פשוט לא תיכנס לרשימה —
     המשחק ממשיך לעבוד עם סטיקר מצויר כגיבוי. */
  load(onProgress) {
    this.total = CFG.stickers.length;
    this.loaded = 0;

    const jobs = CFG.stickers.map((s, i) => new Promise((resolve) => {
      const img = new Image();

      const done = (ok) => {
        this.loaded++;
        if (onProgress) onProgress(this.loaded / this.total);
        if (ok) {
          this.images[s.file] = img;
          this.ready.push(i);
        }
        resolve();
      };

      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = 'assets/stickers/' + s.file;
    }));

    return Promise.all(jobs).then(() => {
      this.ready.sort((a, b) => a - b);
      return this.ready.length;
    });
  },

  /* מחזיר את התמונה של סטיקר לפי אינדקס, או null */
  img(i) {
    const s = CFG.stickers[i];
    return s ? (this.images[s.file] || null) : null;
  },

  /* בוחר אינדקס סטיקר אקראי, מעדיף כאלה שעוד לא הופיעו בסבב הנוכחי */
  _bag: [],
  nextIndex() {
    const pool = this.ready.length ? this.ready : CFG.stickers.map((_, i) => i);
    if (!this._bag.length) {
      this._bag = pool.slice();
      /* ערבוב */
      for (let i = this._bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this._bag[i], this._bag[j]] = [this._bag[j], this._bag[i]];
      }
    }
    return this._bag.pop();
  },

  resetBag() { this._bag = []; }
};
