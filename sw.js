/* ============================================================
   sw.js — Service Worker: מאפשר התקנה כאפליקציה ומשחק אופליין.
   קאש-פירסט על כל קבצי המשחק (הכל סטטי, אין קריאות רשת בזמן ריצה).
   ============================================================ */
'use strict';

const CACHE = 'yehali-stickers-v3';

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/utils.js',
  './js/config.js',
  './js/audio.js',
  './js/input.js',
  './js/assets.js',
  './js/sprites.js',
  './js/particles.js',
  './js/entities.js',
  './js/game.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
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
