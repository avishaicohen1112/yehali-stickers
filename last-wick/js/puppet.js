'use strict';
// 2D cut-out ("puppet") animation runtime for painted part-based characters.
// A rig (window.RIGS[name]) describes parts with pivots and hierarchy, keyframed clips, and springs
// for secondary motion (cloaks, scarves, antennae, tentacles). Chain parts bend along their length.
//
// Rig format:
// {
//   atlas: 'r_wick',              // image key in G.Assets (atlas) or per-part images via part.src
//   scale: 0.5,                   // world px per image px
//   parts: {
//     body:  { rect:[x,y,w,h], pivot:[px,py], parent:null, at:[0,0], z:1 },
//     head:  { rect:[...], pivot:[...], parent:'body', at:[ax,ay], z:3 },
//     cloak: { rect:[...], pivot:[...], parent:'body', at:[...], z:0, chain:{ segs:6, axis:'y' } },
//   },
//   clips: { idle: { dur:1.2, loop:true, keys: { body:{ y:[[0,0],[0.6,-3,'io'],[1.2,0,'io']] } } } },
//   springs: { cloak:{ k:70, d:9, vx:-0.0016, vy:-0.001, wave:[0.05,2.2], max:0.9 } }
// }
// Channels: x y rot sx sy alpha (numbers, interpolated) and swap (rect index, stepped).
G.Puppet = (function () {
  const EASE = { lin: t => t, io: t => t * t * (3 - 2 * t), in: t => t * t, out: t => 1 - (1 - t) * (1 - t), step: t => 0, back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };
  const CH = ['x', 'y', 'rot', 'sx', 'sy', 'alpha', 'bend'];
  const DEF = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, bend: 0 };
  function sample(track, t) {
    if (!track || !track.length) return undefined;
    if (t <= track[0][0]) return track[0][1];
    for (let i = 1; i < track.length; i++) {
      const a = track[i - 1], b = track[i];
      if (t <= b[0]) { const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]); return a[1] + (b[1] - a[1]) * (EASE[b[2] || 'io'] || EASE.io)(k); }
    }
    return track[track.length - 1][1];
  }
  function sampleStep(track, t) { if (!track) return undefined; let v = track[0][1]; for (const k of track) if (t >= k[0]) v = k[1]; return v; }

  class Puppet {
    constructor(rigName) {
      this.rig = window.RIGS[rigName]; this.name = rigName;
      this.clip = null; this.t = 0; this.prev = null; this.prevT = 0; this.blend = 1; this.blendDur = 0.12;
      this.spring = {}; this.speed = 1; this.done = false;
      const P = this.rig.parts;
      this.order = Object.keys(P).sort((a, b) => (P[a].z || 0) - (P[b].z || 0));
      for (const n in (this.rig.springs || {})) this.spring[n] = { a: 0, w: 0 };
    }
    play(name, opts = {}) {
      if (this.clipName === name && !opts.restart) return;
      if (!this.rig.clips[name]) return;
      this.prev = this.clip; this.prevT = this.t; this.blend = this.prev ? 0 : 1; this.blendDur = opts.blend ?? 0.1;
      this.clip = this.rig.clips[name]; this.clipName = name; this.t = 0; this.done = false; this.speed = opts.speed || 1;
    }
    get duration() { return this.clip ? this.clip.dur : 0; }
    update(dt, motion = {}) {
      if (!this.clip) this.play(Object.keys(this.rig.clips)[0]);
      this.t += dt * this.speed; this.blend = Math.min(1, this.blend + dt / Math.max(0.001, this.blendDur));
      const c = this.clip;
      if (this.t >= c.dur) { if (c.loop) this.t %= c.dur; else { this.t = c.dur; this.done = true; } }
      if (this.prev) { this.prevT += dt; if (this.prev.loop) this.prevT %= this.prev.dur; else this.prevT = Math.min(this.prevT, this.prev.dur); }
      // springs: secondary motion driven by character velocity / acceleration
      const vx = motion.vx || 0, vy = motion.vy || 0, face = motion.facing || 1;
      for (const n in this.spring) {
        const S = this.rig.springs[n], s = this.spring[n];
        const tgt = clamp((S.vx || 0) * vx * face + (S.vy || 0) * vy + (S.wave ? S.wave[0] * Math.sin(performance.now() / 1000 * S.wave[1] + (S.ph || 0)) : 0) + (S.bias || 0), -(S.max || 1.2), S.max || 1.2);
        const acc = (S.k || 60) * (tgt - s.a) - (S.d || 8) * s.w;
        s.w += acc * dt; s.a += s.w * dt;
      }
    }
    pose(clip, t) {
      const out = {}; const keys = clip ? clip.keys : {};
      for (const n of this.order) {
        const k = keys[n] || {}; const o = {};
        for (const ch of CH) { const v = sample(k[ch], t); o[ch] = v === undefined ? DEF[ch] : v; }
        o.swap = sampleStep(k.swap, t);
        out[n] = o;
      }
      return out;
    }
    current() {
      const a = this.pose(this.clip, this.t);
      if (this.prev && this.blend < 1) {
        const b = this.pose(this.prev, this.prevT), k = EASE.io(this.blend);
        for (const n in a) for (const ch of CH) a[n][ch] = b[n][ch] + (a[n][ch] - b[n][ch]) * k;
      }
      return a;
    }
    // draw at world position (x,y) = rig origin (feet). opts: {flip, scale, alpha, flash, tint}
    draw(ctx, x, y, opts = {}) {
      const R = this.rig, img = G.Assets.get(R.atlas); if (!img) return false;
      const pose = this.current(); const sc = (R.scale || 0.5) * (opts.scale || 1);
      const M = {};
      const world = (n) => {
        if (M[n]) return M[n];
        const P = R.parts[n], q = pose[n], parentM = P.parent ? world(P.parent) : null;
        const sp = this.spring[n] ? this.spring[n].a : 0;
        let m = parentM ? parentM.slice() : [1, 0, 0, 1, 0, 0];
        const at = P.at || [0, 0];
        m = mul(m, [1, 0, 0, 1, at[0] + q.x, at[1] + q.y]);
        const r = q.rot + (P.chain ? 0 : sp);
        if (r) m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
        if (q.sx !== 1 || q.sy !== 1) m = mul(m, [q.sx, 0, 0, q.sy, 0, 0]);
        M[n] = m; return m;
      };
      ctx.save(); ctx.translate(x, y); ctx.scale(opts.flip ? -sc : sc, sc);
      const baseA = (opts.alpha ?? 1);
      const passes = opts.flash > 0.05 ? 2 : 1;
      for (let pass = 0; pass < passes; pass++) {
        if (pass === 1) { ctx.globalCompositeOperation = 'lighter'; }
        for (const n of this.order) {
          const P = R.parts[n], q = pose[n]; if (P.hidden && !q.swap) continue;
          const m = world(n);
          const rect = (q.swap !== undefined && P.rects) ? P.rects[q.swap] : P.rect; if (!rect) continue;
          ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
          ctx.globalAlpha = baseA * q.alpha * (pass === 1 ? opts.flash : 1);
          if (P.chain) drawChain(ctx, img, rect, P, q, this.spring[n]);
          else ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], -P.pivot[0], -P.pivot[1], rect[2], rect[3]);
          ctx.restore();
        }
      }
      ctx.restore();
      return true;
    }
    // world-space position of a part-local point (for attaching effects: flames, weapon tips)
    point(part, lx, ly, x, y, flip, scale = 1) {
      const R = this.rig, pose = this.current(); const sc = (R.scale || 0.5) * scale;
      let px = lx, py = ly, n = part;
      while (n) {
        const P = R.parts[n], q = pose[n], at = P.at || [0, 0];
        const r = q.rot + (this.spring[n] && !P.chain ? this.spring[n].a : 0);
        let ax = px * q.sx, ay = py * q.sy; const c = Math.cos(r), s = Math.sin(r);
        px = ax * c - ay * s + at[0] + q.x; py = ax * s + ay * c + at[1] + q.y; n = P.parent;
      }
      return { x: x + (flip ? -px : px) * sc, y: y + py * sc };
    }
  }
  function mul(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  // draw one textured triangle (affine mapping), slightly expanded to hide seams
  function tri(ctx, img, s0, s1, s2, d0, d1, d2) {
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, ex = (p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.7, p[1] + dy / l * 0.7]; };
    const e0 = ex(d0), e1 = ex(d1), e2 = ex(d2);
    ctx.save(); ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.clip();
    const x0 = s0[0], y0 = s0[1], x1 = s1[0] - x0, y1 = s1[1] - y0, x2 = s2[0] - x0, y2 = s2[1] - y0;
    const u1 = d1[0] - d0[0], v1 = d1[1] - d0[1], u2 = d2[0] - d0[0], v2 = d2[1] - d0[1];
    const det = x1 * y2 - x2 * y1; if (Math.abs(det) < 1e-6) { ctx.restore(); return; }
    const a = (u1 * y2 - u2 * y1) / det, c = (u2 * x1 - u1 * x2) / det, b = (v1 * y2 - v2 * y1) / det, dd = (v2 * x1 - v1 * x2) / det;
    ctx.transform(a, b, c, dd, d0[0] - a * x0 - c * y0, d0[1] - b * x0 - dd * y0);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  // bend an image strip along its length with a textured triangle mesh (cloth, tails, tentacles, banners, vines)
  function drawChain(ctx, img, rect, P, q, spring) {
    const C = P.chain, segs = C.segs || 6, vertical = (C.axis || 'y') === 'y';
    const [rx, ry, rw, rh] = rect, len = vertical ? rh : rw, sl = len / segs;
    const now = performance.now() / 1000;
    const bend = (q.bend || 0) + (spring ? spring.a : 0);
    // centreline joints
    const pts = [[0, 0]], ang = []; let a = 0;
    for (let i = 0; i < segs; i++) {
      const k = (i + 1) / segs;
      const w = C.wave ? C.wave[0] * Math.sin(now * C.wave[1] - k * (C.wave[2] || 3)) * k : 0;
      a += (bend * (C.falloff ? Math.pow(k, C.falloff - 1) : 1) + w) / segs * 1.8;
      ang.push(a);
      const dir = vertical ? [-Math.sin(a), Math.cos(a)] : [Math.cos(a), Math.sin(a)];
      const p = pts[i]; pts.push([p[0] + dir[0] * sl, p[1] + dir[1] * sl]);
    }
    // perpendicular offsets at each joint
    const off0 = vertical ? -P.pivot[0] : -P.pivot[1], off1 = (vertical ? rw : rh) + off0;
    const nrm = (i) => { const aa = i === 0 ? ang[0] * 0.5 : i === segs ? ang[segs - 1] : (ang[i - 1] + ang[i]) / 2; return vertical ? [Math.cos(aa), Math.sin(aa)] : [-Math.sin(aa), Math.cos(aa)]; };
    for (let i = 0; i < segs; i++) {
      const n0 = nrm(i), n1 = nrm(i + 1), p0 = pts[i], p1 = pts[i + 1];
      const A = [p0[0] + n0[0] * off0, p0[1] + n0[1] * off0], B = [p0[0] + n0[0] * off1, p0[1] + n0[1] * off1];
      const Cc = [p1[0] + n1[0] * off1, p1[1] + n1[1] * off1], D = [p1[0] + n1[0] * off0, p1[1] + n1[1] * off0];
      let sA, sB, sC, sD;
      if (vertical) { sA = [rx, ry + i * sl]; sB = [rx + rw, ry + i * sl]; sC = [rx + rw, ry + (i + 1) * sl]; sD = [rx, ry + (i + 1) * sl]; }
      else { sA = [rx + i * sl, ry]; sB = [rx + i * sl, ry + rh]; sC = [rx + (i + 1) * sl, ry + rh]; sD = [rx + (i + 1) * sl, ry]; }
      tri(ctx, img, sA, sB, sC, A, B, Cc); tri(ctx, img, sA, sC, sD, A, Cc, D);
    }
  }
  return { Puppet, sample };
})();
