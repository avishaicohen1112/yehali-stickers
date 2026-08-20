/* ============================================================
   sw.js — Service Worker: מאפשר התקנה כאפליקציה ומשחק אופליין.
   קאש-פירסט על כל קבצי המשחק (הכל סטטי, אין קריאות רשת בזמן ריצה).
   ============================================================ */
'use strict';

/* חובה להעלות את המספר בכל שינוי בקוד/CSS, אחרת מכשירים שכבר התקינו
   ימשיכו לקבל את הגרסה הישנה מהקאש. v10 = עיצוב ממשק מחדש: פונטים
   מקומיים, סולם צבעים, מערכת חומרים, מסך בית, חנות עם טאבים. */
const CACHE = 'yehali-stickers-v10';

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  /* הפונטים חייבים להיות בקאש — בלעדיהם המשחק נופל לפונט מערכת אופליין */
  './assets/fonts/rubik-hebrew.woff2',
  './assets/fonts/rubik-latin.woff2',
  './assets/fonts/suezone-hebrew.woff2',
  './assets/fonts/suezone-latin.woff2',
  './js/utils.js',
  './js/config.js',
  './js/audio.js',
  './js/input.js',
  './js/assets.js',
  './js/sprites.js',
  './js/particles.js',
  './js/entities.js',
  './js/game.js',
  './icon-192-v4.png',
  './icon-512-v4.png',
  './icon-192-maskable-v5.png',
  './icon-512-maskable-v5.png',
  './apple-touch-icon-v4.png',
  './favicon-v4.png',
  './assets/stickers/st_duolingo.jpg',
  './assets/stickers/st_flag.jpg',
  './assets/stickers/st_punisher.jpg',
  './assets/stickers/st_sticker.jpg',
  './assets/stickers/st_zuz.jpg',
  './assets/stickers/st_boeing.jpg',
  './assets/stickers/st_wagyu.jpg',
  './assets/stickers/st_yad.jpg',
  './assets/stickers/st_million.jpg',
  './assets/stickers/st_tzalem.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* קאש-פירסט: אם יש בקאש מגישים מיד, אחרת רשת (ואז שומרים לפעם הבאה) */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
    })
  );
});
