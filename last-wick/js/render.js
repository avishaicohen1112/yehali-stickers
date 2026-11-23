'use strict';
// Camera, layered rendering, dynamic lighting
G.Render = (function () {
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const lc = document.createElement('canvas'), lx = lc.getContext('2d');
  const VH = 900; let VW = 1600, scale = 1, W = 0, H = 0;
  const cam = { x: 0, y: 0, tx: 0, ty: 0, look: 0 };
  // per-area look
  const AREA = {
    crypts: { amb: [6, 5, 12], dark: 0.42, sky: ['#120c10', '#2a1812', '#0b0709'], fog: [120, 70, 40], rock: '#07060a', mote: { c: [255, 170, 90], kind: 'ember', n: 26, vy: -30 } },
    gardens: { amb: [3, 10, 12], dark: 0.34, sky: ['#04100f', '#0d2a26', '#030807'], fog: [60, 160, 140], rock: '#040807', mote: { c: [150, 255, 210], kind: 'mote', n: 46, vy: -8 } },
    nave: { amb: [3, 5, 14], dark: 0.46, sky: ['#04060f', '#0c1630', '#020309'], fog: [60, 90, 170], rock: '#04050b', mote: { c: [140, 180, 255], kind: 'mote', n: 30, vy: -20 } },
    spire: { amb: [8, 5, 14], dark: 0.34, sky: ['#0c0814', '#2a1a3c', '#07050b'], fog: [160, 120, 220], rock: '#08060c', mote: { c: [230, 200, 255], kind: 'mote', n: 36, vy: 6 } },
    shore: { amb: [12, 6, 4], dark: 0.38, sky: ['#1a0c08', '#4a1c0c', '#0c0504'], fog: [255, 120, 60], rock: '#0a0605', mote: { c: [255, 140, 60], kind: 'ember', n: 50, vy: -40 } },
    galleon: { amb: [6, 6, 10], dark: 0.5, sky: ['#08070c', '#1c1626', '#040306'], fog: [150, 130, 200], rock: '#06050a', mote: { c: [190, 170, 255], kind: 'mote', n: 26, vy: -12 } },
    lighthouse: { amb: [10, 6, 4], dark: 0.4, sky: ['#140a06', '#3a1c0a', '#070403'], fog: [255, 190, 110], rock: '#090605', mote: { c: [255, 200, 120], kind: 'ember', n: 34, vy: -30 } },
    paper: { amb: [10, 9, 8], dark: 0.3, sky: ['#151210', '#3a3228', '#0c0a08'], fog: [240, 225, 200], rock: '#0d0b09', mote: { c: [255, 245, 225], kind: 'mote', n: 30, vy: 10 } },
    clock: { amb: [8, 7, 4], dark: 0.4, sky: ['#100c05', '#2e2410', '#080602'], fog: [230, 190, 110], rock: '#0a0805', mote: { c: [255, 215, 140], kind: 'mote', n: 26, vy: -6 } },
    core: { amb: [12, 6, 2], dark: 0.3, sky: ['#1a0a02', '#5a2a08', '#0a0401'], fog: [255, 170, 80], rock: '#0c0603', mote: { c: [255, 200, 120], kind: 'ember', n: 60, vy: -60 } },
    hearth: { amb: [10, 4, 4], dark: 0.42, sky: ['#0c0606', '#2a0e08', '#050202'], fog: [200, 70, 30], rock: '#070404', mote: { c: [255, 110, 50], kind: 'ember', n: 40, vy: -50 } },
  };
  let vignette = null, holeSprite = null;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ww = innerWidth, wh = innerHeight;
    let h = Math.min(wh * dpr, 1200), w = h * ww / wh;
    W = cv.width = Math.round(w); H = cv.height = Math.round(h);
    scale = H / VH; VW = W / scale;
    lc.width = Math.ceil(W / 3); lc.height = Math.ceil(H / 3);
    vignette = document.createElement('canvas'); vignette.width = 256; vignette.height = 256;
    const v = vignette.getContext('2d'), g = v.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); v.fillStyle = g; v.fillRect(0, 0, 256, 256);
  }
  function hole() {
    if (holeSprite) return holeSprite;
    holeSprite = document.createElement('canvas'); holeSprite.width = holeSprite.height = 128; const h = holeSprite.getContext('2d');
    const g = h.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.75)'); g.addColorStop(0.7, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    h.fillStyle = g; h.fillRect(0, 0, 128, 128); return holeSprite;
  }
  addEventListener('resize', resize); resize();

  function camUpdate(dt, room, p, snap) {
    const lookX = p.facing * 90 + p.vx * 0.12;
    cam.look = snap ? lookX : lerp(cam.look, lookX, Math.min(1, dt * 2.5));
    let lookY = 0; if (G.Input.h('down') && p.ground && Math.abs(p.vx) < 10) lookY = 200; if (G.Input.h('up') && p.ground && Math.abs(p.vx) < 10) lookY = -200;
    cam.lookY = snap ? 0 : lerp(cam.lookY || 0, lookY, Math.min(1, dt * 2));
    let tx = p.cx + cam.look - VW / 2, ty = p.cy - VH * 0.55 + cam.lookY + (p.vy > 600 ? 120 : 0);
    if (room.pw <= VW) tx = (room.pw - VW) / 2; else tx = clamp(tx, 0, room.pw - VW);
    if (room.ph <= VH) ty = (room.ph - VH) / 2; else ty = clamp(ty, 0, room.ph - VH);
    if (G.Main.bossCam) { const b = G.Main.bossCam; tx = clamp(lerp(tx, b.x - VW / 2, 0.35), room.pw <= VW ? tx : 0, room.pw <= VW ? tx : room.pw - VW); }
    if (snap) { cam.x = tx; cam.y = ty; }
    else { cam.x = lerp(cam.x, tx, Math.min(1, dt * 6)); cam.y = lerp(cam.y, ty, Math.min(1, dt * (p.vy > 400 ? 9 : 5))); }
  }
  // ---- ambient particles
  let ambT = 0;
  function ambient(dt, room) {
    const A = AREA[room.area]; ambT += dt; const m = A.mote;
    if (Math.random() < dt * m.n * 0.4) {
      G.FX.spawn({ x: cam.x + rand(-100, VW + 100), y: cam.y + rand(0, VH + 50), vx: rand(-15, 15), vy: m.vy * rand(0.5, 1.5), life: rand(4, 8), size: rand(1, m.kind === 'ember' ? 2.6 : 2.2), kind: m.kind === 'ember' ? 'mote' : 'mote', ph: rand(7), a: rand(0.4, 0.9), c: m.c, add: true });
    }
  }
  // ---- background
  function drawBG(room, t) {
    const A = AREA[room.area];
    if (G.Scenery.draw(ctx, room, cam, VW, VH, t)) return;
    const bg = window.BGS[room.area];
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, A.sky[0]); g.addColorStop(0.55, A.sky[1]); g.addColorStop(1, A.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    if (!bg) return;
    for (const L of bg.layers) {
      const im = G.Assets.get('bg_' + room.area + '_' + L.id); if (!im) continue;
      // fit layer height to cover view with parallax travel
      const travelX = Math.max(0, room.pw - VW) * L.p, travelY = Math.max(0, room.ph - VH) * L.p;
      const dh = Math.max(VH * (L.cover || 1.15), VH + travelY + 40); const dw = im.width * dh / im.height;
      let ox = -(cam.x * L.p) - (dw - VW - travelX) / 2, oy = -(cam.y * L.p) - (dh - VH - travelY) * (L.anchor ?? 0.5);
      if (dw < VW + travelX) { // tile horizontally
        for (let x = ox % dw - dw; x < VW; x += dw) ctx.drawImage(im, x, oy, dw + 1, dh);
      } else ctx.drawImage(im, ox, oy, dw, dh);
      if (L.fog) { ctx.fillStyle = rgba(A.fog, L.fog); ctx.fillRect(0, 0, VW, VH); }
      if (L.id === 'far') drawRays(room, t, A);
    }
  }
  // animated volumetric light shafts over the far background
  function drawRays(room, t, A) {
    const seed = hashStr(room.id); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const r = mulberry(seed + i * 77)(); const x = ((r * 1.3 + i * 0.27) % 1) * VW * 1.2 - VW * 0.1 - cam.x * 0.18;
      const w = 90 + r * 160, a = (0.05 + 0.04 * Math.sin(t * (0.2 + r * 0.3) + i * 2)) * (A.rays ?? 1);
      const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, rgba(A.fog, a * 1.6)); g.addColorStop(0.7, rgba(A.fog, a * 0.5)); g.addColorStop(1, rgba(A.fog, 0));
      ctx.fillStyle = g; ctx.beginPath(); const sk = 220 + r * 200;
      ctx.moveTo(x, -10); ctx.lineTo(x + w, -10); ctx.lineTo(x + w + sk, VH); ctx.lineTo(x + sk - w * 0.3, VH); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // ---- props
  let propFlames = [];
  function drawProps(room, layer, t) {
    if (layer === 'back') propFlames = [];
    const art = window.ROOMART[room.id]; if (!art || !art.props) return;
    for (const pr of art.props) {
      if (pr.l !== layer) continue;
      const P = window.PROPS[pr.p]; if (!P) continue;
      const im = G.Assets.get('prop_' + pr.p); if (!im) continue;
      const par = pr.d || 1; // depth parallax
      const sx = pr.x - cam.x * par + (par !== 1 ? (VW / 2) * (par - 1) : 0), sy = pr.y - cam.y * par + (par !== 1 ? (VH / 2) * (par - 1) : 0);
      const s = pr.s || 1, w = P.w * s, h = P.h * s;
      const x = sx - P.ax * s, y = sy - P.ay * s;
      if (x > VW + 50 || x + w < -50 || y > VH + 50 || y + h < -50) continue;
      ctx.save();
      if (pr.f) { ctx.translate(sx * 2, 0); ctx.scale(-1, 1); }
      if (pr.a !== undefined) ctx.globalAlpha = pr.a;
      if (P.sway) { ctx.translate(sx, sy); ctx.rotate(Math.sin(t * 0.8 + pr.x * 0.01) * P.sway); ctx.translate(-sx, -sy); }
      ctx.drawImage(im, x, y, w, h);
      ctx.restore();
      if (P.flame && layer !== 'front') for (const f of P.flame) propFlames.push([sx + (pr.f ? -1 : 1) * f[0] * s, sy + f[1] * s, 2.6 * s * (par < 1 ? par : 1), pr.x + f[0]]);
      if (P.light && layer !== 'front') {
        const L = P.light; const lx2 = pr.x + (pr.f ? -1 : 1) * (L[4] || 0) * s, ly2 = pr.y + (L[5] || 0) * s;
        G.FX.light(lx2 + (par !== 1 ? -cam.x * (par - 1) + (VW / 2) * (par - 1) : 0), ly2 + (par !== 1 ? -cam.y * (par - 1) + (VH / 2) * (par - 1) : 0), L[3] * s, [L[0], L[1], L[2]], P.li || 0.9);
      }
    }
  }
  // flames from terrain candles + props (drawn after lighting, screen space)
  function roomLights(room, t) {
    const art = window.ROOMART[room.id]; if (!art) return;
    if (art.lights) for (const L of art.lights) G.FX.light(L[0], L[1], L[2], L[3], 0.8);
    if (art.flames) for (const f of art.flames) G.FX.light(f[0], f[1], 160, [255, 160, 80], 0.8);
  }
  function drawFlames(room, t) {
    const art = window.ROOMART[room.id];
    if (art && art.flames) for (const f of art.flames) {
      const x = f[0] - cam.x, y = f[1] - cam.y; if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) continue;
      G.FX.flame(ctx, x, y + 4, f[2] * 1.1, t + f[0] * 0.01, { glow: 0.9 });
    }
    for (const f of propFlames) G.FX.flame(ctx, f[0], f[1], f[2], t + f[3] * 0.01, { glow: 0.9 });
  }
  function drawTerrain(room) {
    const art = window.ROOMART[room.id]; const A = AREA[room.area];
    // outside room = rock
    ctx.fillStyle = A.rock;
    if (cam.x < 0) ctx.fillRect(0, 0, -cam.x, VH);
    if (cam.x + VW > room.pw) ctx.fillRect(room.pw - cam.x, 0, VW, VH);
    if (cam.y < 0) ctx.fillRect(0, 0, VW, -cam.y);
    if (cam.y + VH > room.ph) ctx.fillRect(0, room.ph - cam.y, VW, VH);
    const im = art && G.Assets.get('room_' + room.id);
    if (im) {
      const pad = art.pad || 0, sc = art.scale || 1;
      ctx.drawImage(im, -pad - cam.x, -pad - cam.y, im.width * sc, im.height * sc);
    } else {
      const x0 = Math.floor(cam.x / TILE), y0 = Math.floor(cam.y / TILE);
      for (let ty = y0; ty <= y0 + VH / TILE + 1; ty++) for (let tx = x0; tx <= x0 + VW / TILE + 1; tx++) {
        const c = room.tile(tx, ty);
        if (c === '#') { ctx.fillStyle = '#1b1720'; ctx.fillRect(tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1); }
        else if (c === '=') { ctx.fillStyle = '#6b5a48'; ctx.fillRect(tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, 12); }
        else if (c === '^') { ctx.fillStyle = '#4a3036'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(tx * TILE - cam.x + k * 17, ty * TILE - cam.y + TILE); ctx.lineTo(tx * TILE - cam.x + k * 17 + 8, ty * TILE - cam.y + 14); ctx.lineTo(tx * TILE - cam.x + k * 17 + 16, ty * TILE - cam.y + TILE); ctx.fill(); } }
      }
    }
    // dynamic overrides (gates/seals) drawn by objects
  }
  function drawWater(room, t) {
    const x0 = Math.floor(cam.x / TILE), y0 = Math.floor(cam.y / TILE);
    for (let ty = y0; ty <= y0 + VH / TILE + 1; ty++) for (let tx = x0; tx <= x0 + VW / TILE + 1; tx++) {
      const c = room.tile(tx, ty); if (c !== '~' && c !== 'w' && c !== 'x') continue;
      const top = room.tile(tx, ty - 1) !== c;
      const X = tx * TILE - cam.x, Y = ty * TILE - cam.y;
      if (c === 'x') { // shadow gate: swirling void wall
        ctx.save(); const ph = t * 2 + tx * 1.3 + ty * 0.7;
        const g = ctx.createLinearGradient(X, 0, X + TILE, 0); g.addColorStop(0, 'rgba(20,8,35,0.2)'); g.addColorStop(0.5, 'rgba(10,4,20,0.95)'); g.addColorStop(1, 'rgba(20,8,35,0.2)');
        ctx.fillStyle = g; ctx.fillRect(X, Y, TILE, TILE + 1);
        for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(150,90,255,${0.25 + 0.2 * Math.sin(ph + k * 2)})`; ctx.beginPath(); ctx.arc(X + TILE / 2 + Math.sin(ph + k) * 14, Y + ((t * 40 + k * 17 + ty * 13) % TILE), 3 + k, 0, 7); ctx.fill(); }
        ctx.restore(); G.FX.glow(ctx, X + TILE / 2, Y + TILE / 2, 50, [150, 90, 255], 0.15); continue;
      }
      const W2 = window.WORLD.rooms[room.id].world === 'sea';
      if (c === '~' && W2) { // burning ember-sea
        ctx.fillStyle = top ? 'rgba(60,12,4,0.95)' : 'rgba(30,6,2,0.98)'; ctx.fillRect(X, Y + (top ? 10 : 0), TILE + 1, TILE + 1 - (top ? 10 : 0));
        if (top) { const w = Math.sin(t * 1.6 + tx * 0.7) * 3; ctx.fillStyle = 'rgba(255,150,60,0.8)'; ctx.fillRect(X, Y + 8 + w, TILE + 1, 3);
          G.FX.glow(ctx, X + TILE / 2, Y + 14, 60, [255, 110, 40], 0.22); if (Math.random() < 0.02) G.FX.spawn({ x: tx * TILE + rand(0, TILE), y: ty * TILE + 8, vx: rand(-20, 20), vy: rand(-140, -60), life: 1.2, size: 2, kind: 'ember', c: [255, 150, 60], add: true }); }
        continue;
      }
      if (c === '~') {
        ctx.fillStyle = top ? 'rgba(4,8,22,0.92)' : 'rgba(2,4,12,0.97)'; ctx.fillRect(X, Y + (top ? 10 : 0), TILE + 1, TILE + 1 - (top ? 10 : 0));
        if (top) { const w = Math.sin(t * 2 + tx * 0.8) * 2;
          ctx.fillStyle = 'rgba(120,170,255,0.55)'; ctx.fillRect(X, Y + 9 + w, TILE + 1, 2);
          G.FX.glow(ctx, X + TILE / 2, Y + 12, 40, [80, 130, 255], 0.12); }
      } else {
        ctx.fillStyle = 'rgba(30,70,120,0.35)'; ctx.fillRect(X, Y + (top ? 14 : 0), TILE + 1, TILE + 1 - (top ? 14 : 0));
        if (top) { ctx.fillStyle = 'rgba(160,210,255,0.4)'; ctx.fillRect(X, Y + 13 + Math.sin(t * 2.5 + tx) * 1.5, TILE + 1, 2); }
      }
    }
  }
  function drawLighting(room, extraDark) {
    const A = AREA[room.area], L = G.FX.lights(), hs = hole();
    const k = lc.width / VW;
    lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, lc.width, lc.height);
    lx.fillStyle = `rgba(${A.amb[0]},${A.amb[1]},${A.amb[2]},${clamp(A.dark + (extraDark || 0), 0, 0.97)})`; lx.fillRect(0, 0, lc.width, lc.height);
    lx.globalCompositeOperation = 'destination-out';
    for (const l of L) {
      const x = (l.x - cam.x) * k, y = (l.y - cam.y) * k, r = l.r * k;
      if (x < -r || y < -r || x > lc.width + r || y > lc.height + r) continue;
      lx.globalAlpha = clamp(l.i, 0, 1); lx.drawImage(hs, x - r, y - r, r * 2, r * 2);
    }
    lx.globalAlpha = 1;
    ctx.drawImage(lc, 0, 0, VW, VH);
    // colored light tint (additive)
    for (const l of L) { const x = l.x - cam.x, y = l.y - cam.y; if (x < -l.r || y < -l.r || x > VW + l.r || y > VH + l.r) continue; G.FX.glow(ctx, x, y, l.r * 0.8, l.c, 0.13 * l.i); }
  }
  function drawFog(room, t) {
    const A = AREA[room.area];
    const g = ctx.createLinearGradient(0, VH * 0.55, 0, VH); g.addColorStop(0, rgba(A.fog, 0)); g.addColorStop(1, rgba(A.fog, 0.10));
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(vignette, 0, 0, VW, VH);
  }
  // ---------- object drawings (fallbacks if no art) ----------
  function propImg(name) { return G.Assets.get('prop_' + name) ? window.PROPS[name] : null; }
  function drawPropAt(name, x, y, s = 1, flip = false, alpha = 1) {
    const P = window.PROPS[name], im = G.Assets.get('prop_' + name); if (!P || !im) return false;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -P.ax * s, -P.ay * s, P.w * s, P.h * s); ctx.restore(); return true;
  }
  function drawBench(c, o, t) {
    const x = o.x, y = o.y;
    if (!drawPropAt('bench', x, y + 4)) {
      c.fillStyle = '#2a2026'; c.fillRect(x - 60, y - 30, 120, 30); c.fillStyle = '#3a2c30'; c.fillRect(x - 66, y - 36, 132, 8);
    }
    const P = window.PROPS.bench; const fy = P && P.flame ? P.flame : [[-38, -112], [0, -128], [38, -112]];
    for (const f of fy) G.FX.flame(c, x + f[0], y + f[1], 3.2, t + f[0], { glow: 0.8 });
    if (G.Objects.nearest() === o && !G.Main.player.sitting) G.UI.prompt(c, x, y - 170, G.T('sit'));
  }
  function drawNPC(c, o, t) {
    const at = 'n_' + o.id;
    if (G.Sprite.meta(at)) {
      const fi = G.Sprite.frameOf(at, 'idle', t + o.x * 0.01), m = window.ATLAS[at];
      // painted NPCs come as one pose: give them a slow breath around the feet
      const sy = m.v === 2 && m.anims.idle.n === 1 ? 1 + Math.sin(t * 1.6 + o.x * 0.01) * 0.014 : 1;
      G.Sprite.draw(c, at, 'idle', fi, o.x, o.y + 1, { flip: G.Main.player.cx < o.x, ppu: m.ppu || 50, sy });
    } else { c.fillStyle = '#1a1520'; c.beginPath(); c.ellipse(o.x, o.y - 45, 30, 45, 0, 0, 7); c.fill(); c.fillStyle = '#e8dcc8'; c.beginPath(); c.arc(o.x, o.y - 95, 20, 0, 7); c.fill(); }
    if (G.Objects.nearest() === o) G.UI.prompt(c, o.x, o.y - 175, G.T('talk'));
  }
  function drawLore(c, o, t) {
    if (!drawPropAt('tablet', o.x, o.y + 2)) { c.fillStyle = '#29242c'; c.fillRect(o.x - 24, o.y - 70, 48, 70); }
    G.FX.light(o.x, o.y - 50, 140, [200, 210, 255], 0.6);
    G.FX.glow(c, o.x, o.y - 50, 50, [180, 200, 255], 0.25 + Math.sin(t * 2) * 0.08);
    if (G.Objects.nearest() === o) G.UI.prompt(c, o.x, o.y - 120, G.T('read'));
  }
  function drawBrazier(c, o, t, n) {
    if (!drawPropAt('brazier', o.x, o.y + 4)) { c.fillStyle = '#2a2026'; c.fillRect(o.x - 110, o.y - 90, 220, 90); }
    for (let i = 0; i < 4; i++) {
      const fx = o.x - 75 + i * 50, fy = o.y - 90;
      if (i < n) G.FX.flame(c, fx, fy, 4.2, t * 1.1 + i, { glow: 1.1 });
      else { c.fillStyle = 'rgba(40,36,44,0.9)'; c.beginPath(); c.arc(fx, fy + 4, 5, 0, 7); c.fill(); }
    }
  }
  function drawGate(c, o, t) {
    if (o.k <= 0.01) return;
    const x = o.tx * TILE, y = (o.ty + o.h) * TILE, h = o.h * TILE * o.k;
    c.save();
    for (let i = 0; i < 3; i++) {
      const bx = x + 8 + i * 15; const g = c.createLinearGradient(bx, 0, bx + 10, 0);
      g.addColorStop(0, '#1a1418'); g.addColorStop(0.5, '#5a4a48'); g.addColorStop(1, '#141014');
      c.fillStyle = g; c.fillRect(bx, y - h, 10, h);
      c.beginPath(); c.moveTo(bx - 3, y - h); c.lineTo(bx + 5, y - h - 22); c.lineTo(bx + 13, y - h); c.fill();
    }
    c.fillStyle = '#2a2024'; c.fillRect(x + 2, y - h + 30, TILE - 4, 8); c.fillRect(x + 2, y - h * 0.5, TILE - 4, 8);
    c.restore();
  }
  function drawSeal(c, o, t) {
    if (!o.closed) return;
    const x = o.tx * TILE, y = o.ty * TILE;
    c.save(); const g = c.createLinearGradient(x, y, x, y + TILE);
    g.addColorStop(0, 'rgba(200,170,255,0.85)'); g.addColorStop(1, 'rgba(90,60,160,0.85)'); c.fillStyle = g;
    for (let i = 0; i < o.w * 2; i++) { const sx = x + i * TILE / 2; c.beginPath(); c.moveTo(sx, y + TILE); c.lineTo(sx + TILE / 4, y - 10 + Math.sin(i * 1.7) * 6); c.lineTo(sx + TILE / 2, y + TILE); c.fill(); }
    c.restore(); G.FX.light(x + o.w * TILE / 2, y + 25, 200, [190, 150, 255], 0.8);
  }
  function drawPortal(c, o, t) {
    const x = o.x, y = o.y - 100, open = o.open;
    if (drawPropAt('portal', o.x, o.y + 4, 1, false, 1)) { } else {
      c.save(); c.fillStyle = 'rgba(20,16,24,0.95)'; c.beginPath(); c.moveTo(x - 70, o.y); c.lineTo(x - 70, y - 30); c.quadraticCurveTo(x, y - 140, x + 70, y - 30); c.lineTo(x + 70, o.y); c.lineTo(x + 52, o.y); c.lineTo(x + 52, y - 26); c.quadraticCurveTo(x, y - 112, x - 52, y - 26); c.lineTo(x - 52, o.y); c.closePath(); c.fill(); c.restore();
    }
    if (open) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { const r = 40 + i * 14 + Math.sin(t * 2 + i) * 4; c.strokeStyle = `rgba(${200 - i * 20},${170 - i * 20},255,${0.5 - i * 0.1})`; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 20, r * 0.62, r * 1.05, 0, t * (0.5 + i * 0.2), t * (0.5 + i * 0.2) + 5); c.stroke(); }
      c.restore(); G.FX.glow(c, x, y + 20, 160, [190, 150, 255], 0.55 + Math.sin(t * 3) * 0.1);
    } else G.FX.glow(c, x, y + 20, 60, [120, 100, 150], 0.15);
    if (G.Objects.nearest() === o) G.UI.prompt(c, x, y - 110, open ? G.T('enter') : G.T('portal_sealed'));
  }
  function drawPickup(c, o, t) {
    const y = o.y + Math.sin(t * 2.2) * 8;
    G.FX.glow(c, o.x, y, 120, [255, 220, 160], 0.6 + Math.sin(t * 3) * 0.1);
    c.save(); c.translate(o.x, y); c.rotate(t * 0.7);
    c.strokeStyle = 'rgba(255,240,210,0.7)'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, 14); c.lineTo(0, 30); c.stroke(); }
    c.restore();
    const col = o.kind === 'heart' ? '#fff3e8' : o.kind === 'vessel' ? '#ffd28a' : '#ffb070';
    c.fillStyle = col; c.beginPath();
    if (o.kind === 'heart') { c.moveTo(o.x, y - 16); c.bezierCurveTo(o.x + 14, y - 4, o.x + 12, y + 14, o.x, y + 14); c.bezierCurveTo(o.x - 12, y + 14, o.x - 14, y - 4, o.x, y - 16); }
    else c.arc(o.x, y, 12, 0, 7);
    c.fill();
  }
  function drawCinder(c, o, t) {
    const y = o.y - 60 + Math.sin(t * 1.5) * 10;
    G.FX.glow(c, o.x, y, 90, [170, 130, 255], 0.6);
    G.FX.flame(c, o.x, y + 20, 4, t, { c: [150, 110, 255], glow: 0.8 });
  }
  return {
    ctx, cv, cam, AREA, get VW() { return VW; }, VH, get scale() { return scale; }, resize,
    camUpdate, ambient, roomLights, drawFlames, drawBG, drawProps, drawTerrain, drawWater, drawLighting, drawFog,
    drawBench, drawNPC, drawLore, drawPortal, drawBrazier, drawGate, drawSeal, drawPickup, drawCinder, drawPropAt
  };
})();
