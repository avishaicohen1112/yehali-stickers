'use strict';
window.G = window.G || {};
const TILE = 50;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const ease = { out: t => 1 - (1 - t) * (1 - t), in: t => t * t, io: t => t * t * (3 - 2 * t), back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
