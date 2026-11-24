'use strict';
// Particles, lights, slashes, screen effects
G.FX = (function () {
  const parts = [], slashes = [], rings = [];
  let lights = [];
  const S = { shake: 0, shakeT: 0, stop: 0, flashC: '#fff', flashA: 0, flashD: 0.2, slowmo: 0 };
  // glow sprite cache
  const glowCache = {};
  function glowSprite(c) {
    const k = c.join(','); if (glowCache[k]) return glowCache[k];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); g.addColorStop(0.18, `rgba(${c[0]},${c[1]},${c[2]},0.55)`);
    g.addColorStop(0.45, `rgba(${c[0]},${c[1]},${c[2]},0.16)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); glowCache[k] = cv; return cv;
  }
  function glow(ctx, x, y, r, c, a = 1) {
    if (a <= 0.01 || r <= 0) return;
    const prev = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSprite(c), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = prev;
  }
  function spawn(p) {
    p.life = p.life || 1; p.t = 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.g = p.g || 0; p.drag = p.drag || 0;
    p.size = p.size || 3; p.c = p.c || [255, 220, 180]; p.rot = p.rot || 0; p.vr = p.vr || 0;
    if (parts.length > 900) parts.shift();
    parts.push(p); return p;
  }
  function burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = (o.angle !== undefined ? o.angle : rand(Math.PI * 2)) + rand(-(o.spread || Math.PI), o.spread || Math.PI);
      const sp = rand(o.speed * 0.3, o.speed);
      spawn({ x: x + rand(-(o.jx || 0), o.jx || 0), y: y + rand(-(o.jy || 0), o.jy || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(o.life * 0.5, o.life), size: rand(o.size * 0.5, o.size), c: o.c, g: o.g || 0, drag: o.drag || 2, kind: o.kind || 'spark', add: o.add !== false });
    }
  }
  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d;
      if (p.kind === 'mote') { p.vx += Math.sin(p.t * 1.3 + p.ph) * 6 * dt; p.vy += Math.cos(p.t * 0.9 + p.ph) * 5 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = slashes.length - 1; i >= 0; i--) { const s = slashes[i]; s.t += dt; if (s.t > s.dur) slashes.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; if (r.t > r.dur) rings.splice(i, 1); }
    if (S.shakeT > 0) S.shakeT -= dt; else S.shake = 0;
    if (S.flashA > 0) S.flashA = Math.max(0, S.flashA - dt / S.flashD);
  }
  function drawParts(ctx, additive) {
    for (const p of parts) {
      if (!!p.add !== additive) continue;
      const k = 1 - p.t / p.life;
      if (p.kind === 'spark' || p.kind === 'ember' || p.kind === 'mote') {
        const a = p.kind === 'mote' ? Math.sin(Math.PI * p.t / p.life) * (p.a || 0.8) : k;
        if (p.kind === 'spark') {
          ctx.globalAlpha = a; ctx.strokeStyle = rgba(p.c, 1); ctx.lineWidth = p.size * k + 0.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        } else {
          ctx.globalAlpha = a; ctx.fillStyle = rgba(p.c, 1);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'ember' ? k : 1), 0, 7); ctx.fill();
          glow(ctx, p.x, p.y, p.size * 6, p.c, a * 0.5);
        }
      } else if (p.kind === 'curl') {  // wind swirl: a growing, fading spiral arc
        const im = p.img && G.Assets.get(p.img);
        ctx.globalAlpha = Math.sin(Math.PI * p.t / p.life) * (p.a || 0.4);
        if (im) { const s = p.size / 40; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.2); ctx.drawImage(im, -im.width * s / 2, -im.height * s / 2, im.width * s, im.height * s); ctx.restore(); }
        else { ctx.strokeStyle = rgba(p.c, 1); ctx.lineWidth = 2; ctx.lineCap = 'round'; const r = p.size * (0.6 + p.t / p.life);
          ctx.beginPath(); ctx.arc(p.x, p.y, r, p.rot, p.rot + 4.2); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x + r * 0.35, p.y, r * 0.55, p.rot + 1, p.rot + 4.6); ctx.stroke(); }
      } else if (p.kind === 'streak') {  // wind streak: thin line along velocity, fades in and out
        ctx.globalAlpha = Math.sin(Math.PI * p.t / p.life) * (p.a || 0.5); ctx.strokeStyle = rgba(p.c, 1); ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.09, p.y - p.vy * 0.09); ctx.stroke();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = k * (p.a || 0.35); ctx.fillStyle = rgba(p.c, 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, 7); ctx.fill();
      } else if (p.kind === 'chunk') {
        ctx.globalAlpha = Math.min(1, k * 3); ctx.fillStyle = rgba(p.c, 1);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath();
        ctx.moveTo(-p.size, -p.size * 0.6); ctx.lineTo(p.size * 0.8, -p.size * 0.8); ctx.lineTo(p.size, p.size * 0.5); ctx.lineTo(-p.size * 0.4, p.size); ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (p.kind === 'shard') {
        ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = rgba(p.c, 0.9);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -p.size * 1.6); ctx.lineTo(p.size * 0.5, 0); ctx.lineTo(0, p.size * 1.6); ctx.lineTo(-p.size * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  // HK-style slash crescent
  function slash(x, y, dir, facing, o = {}) { const s = { x, y, dir, facing, t: 0, dur: o.dur || 0.16, big: o.big || 1, c: o.c || [255, 244, 225], follow: o.follow }; if (o.follow) { s.ox = x - o.follow.cx; s.oy = y - o.follow.cy; } slashes.push(s); }
  function drawSlashes(ctx) {
    for (const s of slashes) {
      const k = s.t / s.dur, a = 1 - k * k;
      let x = s.x, y = s.y; if (s.follow) { x = s.follow.cx + s.ox; y = s.follow.cy + s.oy; }
      ctx.save(); ctx.translate(x, y);
      let base = 0; if (s.dir === 'up') base = -Math.PI / 2; else if (s.dir === 'down') base = Math.PI / 2;
      if (s.dir === 'side') ctx.scale(s.facing, 1); else ctx.scale(s.facing, 1);
      ctx.rotate(base);
      const R = 78 * s.big * (0.92 + 0.15 * ease.out(k)), sweep = 1.25;
      const a0 = -sweep + (s.dir === 'side' ? -0.25 : 0), a1 = sweep * (0.35 + 0.65 * ease.out(Math.min(1, k * 2.2)));
      ctx.globalCompositeOperation = 'lighter';
      for (let pass = 0; pass < 2; pass++) {
        const th = pass === 0 ? 0.42 : 0.2;
        ctx.beginPath(); ctx.arc(0, 0, R, a0, a1, false);
        ctx.arc(R * th * 0.55, 0, R * (1 - th * 0.55), a1, a0, true); ctx.closePath();
        const g = ctx.createLinearGradient(0, -R, 0, R);
        if (pass === 0) { g.addColorStop(0, rgba(s.c, 0)); g.addColorStop(0.5, rgba(s.c, 0.35 * a)); g.addColorStop(1, rgba(s.c, 0.05 * a)); }
        else { g.addColorStop(0, rgba([255, 255, 255], 0)); g.addColorStop(0.55, rgba([255, 255, 255], 0.95 * a)); g.addColorStop(1, rgba([255, 255, 255], 0.2 * a)); }
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function ring(x, y, r0, r1, c, dur, w) { rings.push({ x, y, r0, r1, c, dur, w: w || 6, t: 0 }); }
  function drawRings(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const r of rings) { const k = r.t / r.dur; ctx.strokeStyle = rgba(r.c, (1 - k) * 0.8); ctx.lineWidth = r.w * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, ease.out(k)), 0, 7); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // candle flame
  function flame(ctx, x, y, size, t, o = {}) {
    const fl = Math.sin(t * 17) * 0.08 + Math.sin(t * 29 + 1) * 0.06 + Math.sin(t * 7.3) * 0.05;
    const h = size * (2.4 + fl * 2.2), w = size * (0.95 + fl * 0.4);
    const lean = (o.lean || 0) + Math.sin(t * 5.1) * 0.15 * size;
    glow(ctx, x, y - h * 0.35, size * 9 * (o.glow || 1), o.c || [255, 150, 60], 0.55 * (o.alpha ?? 1));
    glow(ctx, x, y - h * 0.3, size * 3.2, [255, 220, 150], 0.7 * (o.alpha ?? 1));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = o.alpha ?? 1;
    const path = (sc) => { ctx.beginPath(); ctx.moveTo(x, y + w * 0.25 * sc);
      ctx.bezierCurveTo(x + w * sc, y + w * 0.1, x + w * 0.7 * sc, y - h * 0.45 * sc, x + lean, y - h * sc);
      ctx.bezierCurveTo(x - w * 0.7 * sc + lean * 0.3, y - h * 0.45 * sc, x - w * sc, y + w * 0.1, x, y + w * 0.25 * sc); };
    path(1); let g = ctx.createLinearGradient(x, y, x, y - h);
    g.addColorStop(0, 'rgba(255,120,40,0.9)'); g.addColorStop(0.5, 'rgba(255,90,20,0.55)'); g.addColorStop(1, 'rgba(255,60,10,0)'); ctx.fillStyle = g; ctx.fill();
    path(0.62); g = ctx.createLinearGradient(x, y, x, y - h * 0.62);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.6, 'rgba(255,230,150,0.9)'); g.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + w * 0.05, w * 0.32, w * 0.42, 0, 0, 7); ctx.fillStyle = 'rgba(90,140,255,0.35)'; ctx.fill();
    ctx.restore();
  }
  return {
    parts, lights: () => lights, S,
    spawn, burst, update, drawParts, slash, drawSlashes, ring, drawRings, glow, flame,
    light(x, y, r, c, i = 1) { lights.push({ x, y, r, c, i }); },
    clearLights() { lights = []; },
    shake(a, t) { if (a >= S.shake) { S.shake = a; S.shakeT = t; } },
    stop(t) { S.stop = Math.max(S.stop, t); },
    flash(c, a, d) { S.flashC = c; S.flashA = a; S.flashD = d || 0.25; },
    reset() { parts.length = 0; slashes.length = 0; rings.length = 0; lights = []; }
  };
})();
