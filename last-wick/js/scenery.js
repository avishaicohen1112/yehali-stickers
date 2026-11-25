'use strict';
// Layered, animated backgrounds ("scenery"). Data-driven per area via window.SCENES[area]:
// {
//   sky: ['#top', '#mid', '#bottom'],
//   layers: [            // drawn back to front
//     { img:'scn_crypts_far', p:0.08, py:0.05, y:0, h:1.15, tile:true, alpha:1, tint:null },
//     { kind:'fog', color:[r,g,b], a:0.18, p:0.2, speed:12, y:0.55, h:0.5, img:'fog' },     // scrolling fog band
//     { kind:'rays', color:[r,g,b], a:0.06, count:4 },                                        // god rays
//     { img:'scn_crypts_mid', p:0.3, tile:true, y:0.1, h:1.0,
//       items: [ { img:'el_chain', x:400, y:0, sway:[0.05,0.7], pivot:[0.5,0] } ] }          // animated elements in layer space
//   ]
// }
// Element animations: sway:[amp,speed] (rotation around pivot), bob:[amp,speed], flicker:[min,max,speed],
// drift:[vx,vy,wrap], spin:speed, pulse:[min,max,speed] (scale), glow:[r,g,b,radius], frames:{imgs:[],fps}, chain:{segs,amp,speed}
G.Scenery = (function () {
  const fogCache = {};
  function fogTex(key) {
    if (fogCache[key]) return fogCache[key];
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
    const rnd = mulberry(hashStr(key));
    for (let i = 0; i < 60; i++) {
      const cx = rnd() * 512, cy = 60 + rnd() * 136, r = 40 + rnd() * 110;
      for (const dx of [-512, 0, 512]) {
        const g = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(cx + dx - r, cy - r, r * 2, r * 2);
      }
    }
    fogCache[key] = cv; return cv;
  }
  function elementDraw(ctx, it, X, Y, s, t, L) {
    const im = G.Assets.get(it.img); if (!im && !it.frames) return;
    let img = L ? depthImg({ img: it.img, id: L.id, dim: L.dim }) || im : im;
    if (it.frames) { const f = Math.floor(t * it.frames.fps + (it.ph || 0)) % it.frames.imgs.length, fk = it.frames.imgs[f];
      img = L ? depthImg({ img: fk, id: L.id, dim: L.dim }) : G.Assets.get(fk); if (!img) return; }
    const w = img.width * s * (it.s || 1), h = img.height * s * (it.s || 1);
    const pv = it.pivot || [0.5, 1];
    let x = X, y = Y, rot = 0, sc = 1, a = it.a ?? 1;
    const ph = it.ph || (it.x * 0.013);
    if (it.travel) {   // crosses the layer slowly and wraps around (bats, moths, ghost fish)
      const span = it.travel[1] * s, ix = it.x * s, u = ((((ix + t * it.travel[0] * s) % span) + span) % span) / span; x = X - ix + u * span;
      a *= Math.min(1, u / 0.08, (1 - u) / 0.08);   // fades in and out at the ends of its path (never pops into place)
    }
    if (it.bob) y += Math.sin(t * it.bob[1] + ph) * it.bob[0] * s;
    const wk = G.Wind ? G.Wind.sway() : 1;  // gusts make hanging/standing elements swing harder
    if (it.sway) rot += Math.sin(t * it.sway[1] * (0.8 + wk * 0.2) + ph) * it.sway[0] * wk;
    if (it.spin) rot += t * it.spin;
    if (it.pulse) sc *= it.pulse[0] + (it.pulse[1] - it.pulse[0]) * (0.5 + 0.5 * Math.sin(t * it.pulse[2] + ph));
    if (it.flicker) a *= it.flicker[0] + (it.flicker[1] - it.flicker[0]) * (0.5 + 0.5 * Math.sin(t * it.flicker[2] + ph) * Math.sin(t * it.flicker[2] * 2.3 + ph * 2));
    if (it.glow) G.FX.glow(ctx, x + (0.5 - pv[0]) * w, y + (0.5 - pv[1]) * h, it.glow[3] * s, [it.glow[0], it.glow[1], it.glow[2]], (it.glow[4] ?? 0.5) * a);
    ctx.save(); ctx.globalAlpha *= a; if (it.blend) ctx.globalCompositeOperation = it.blend;
    ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sc !== 1) ctx.scale(sc, sc); if (it.flip) ctx.scale(-1, 1);
    if (it.parts) for (const q of it.parts) {   // chains above a hanging thing, or a stand under a swinging bell, drawn behind
      if (q.len !== undefined) { const ci = G.Assets.get(q.img); if (ci) { const cw = ci.width * s * (it.s || 1) * 0.8, ch = ci.height * cw / ci.width, n = Math.ceil(q.len * s / ch);
        for (let k = 1; k <= n; k++) ctx.drawImage(ci, -cw / 2, -k * ch, cw, ch + 1); } }
    }
    if (it.chain) chainDraw(ctx, img, w, h, pv, wk > 1.05 ? Object.assign({}, it.chain, { amp: (it.chain.amp || 0.05) * wk }) : it.chain, t + ph);
    else ctx.drawImage(img, -pv[0] * w, -pv[1] * h, w, h);
    if (it.parts) for (const q of it.parts) {   // clock hands turning on the face, a flower head on its stem, a bell on its arm
      if (q.len !== undefined) continue; const qi = G.Assets.get(q.img); if (!qi) continue;
      const qs = s * (q.s || 1), qw = qi.width * qs, qh = qi.height * qs, qp = q.pv || [0.5, 0.5];
      ctx.save(); ctx.translate(q.dx * w, q.top ? -pv[1] * h : q.dy * h);
      if (q.spin) ctx.rotate(t * q.spin + ph); if (q.swing) ctx.rotate(Math.sin(t * q.swing[1] + ph) * q.swing[0] * wk);
      ctx.drawImage(qi, -qp[0] * qw, q.top ? -qh * 0.85 : -qp[1] * qh, qw, qh); ctx.restore();
    }
    ctx.restore();
  }
  function chainDraw(ctx, img, w, h, pv, C, t) {
    const segs = C.segs || 8, sh = img.height / segs, dh = h / segs;
    ctx.translate(-pv[0] * w + w / 2, -pv[1] * h);
    for (let i = 0; i < segs; i++) {
      const k = (i + 1) / segs; ctx.rotate(Math.sin(t * (C.speed || 1) - k * 2.5) * (C.amp || 0.05) * k);
      ctx.drawImage(img, 0, i * sh, img.width, sh + 1, -w / 2, 0, w, dh + 1); ctx.translate(0, dh);
    }
  }
  // draw all layers for a room; cam: {x,y}; VW/VH view size; room: {pw,ph,area}
  function draw(ctx, room, cam, VW, VH, t, front) {
    const S = window.SCENES && window.SCENES[room.area]; if (!S) return false;
    if (!front) { const g = ctx.createLinearGradient(0, 0, 0, VH); const sk = S.sky || ['#000', '#111', '#000'];
    g.addColorStop(0, sk[0]); g.addColorStop(0.55, sk[1]); g.addColorStop(1, sk[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
    const roomX = Math.max(0, room.pw - VW), roomY = Math.max(0, room.ph - VH);
    const kx = roomX ? cam.x / roomX : 0.5, ky = roomY ? cam.y / roomY : 0.5;
    for (const L of S.layers) {
      if (!!L.front !== !!front) continue;
      const p = L.p ?? 0.2, py = L.py ?? p * 0.4;   // gentle vertical parallax: jumping doesn't make the backdrop bob
      if (L.kind === 'fog') {
        const tex = fogTex(room.area + (L.seed || '')); const h = VH * (L.h || 0.5), w = h * 2;
        let ox = (-(cam.x * p) - t * (L.speed || 10)) % w; if (ox > 0) ox -= w;
        const y = VH * (L.y ?? 0.5) - cam.y * py * 0.3;
        ctx.save(); ctx.globalAlpha = L.a ?? 0.2; ctx.globalCompositeOperation = L.blend || 'lighter';
        if (!fogCache['tint' + L.color]) { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); x.drawImage(tex, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = `rgb(${L.color.join(',')})`; x.fillRect(0, 0, 512, 256); fogCache['tint' + L.color] = c; }
        const ft = fogCache['tint' + L.color];
        for (let x = ox; x < VW; x += w) ctx.drawImage(ft, x, y, w + 1, h);
        ctx.restore(); continue;
      }
      if (L.kind === 'rays') { drawRays(ctx, room, cam, VW, VH, t, L); continue; }
      if (L.kind === 'motes') { continue; }
      const im = depthImg(L);
      // layer height in view px; layer scrolls by parallax over room travel
      const travelX = roomX * p, travelY = roomY * py;
      const dh = L.front ? VH * (L.h || 1.0) : Math.max(VH * (L.h || 1.1), VH + travelY + 2);
      // a front frame must always span the whole view (it is wider-than-tall art framing the screen edges)
      const s = im ? (L.front ? Math.max(dh / im.height, VW * 1.02 / im.width) : dh / im.height) : 1, dw = im ? im.width * s : VW;
      const ox = L.tile ? -(cam.x * p) : -(kx * Math.max(0, dw - VW));
      const oy = L.front ? (L.y || 0) * VH - (cam.y * (p - 1)) % VH * 0 : -(ky * (dh - VH)) + (L.y || 0) * VH;
      ctx.save(); if (L.alpha !== undefined) ctx.globalAlpha = L.alpha; if (L.blend) ctx.globalCompositeOperation = L.blend;
      if (im && L.front) {
        // frame pieces keep their painted proportions: on a wide screen the left half hugs the left edge and the right half
        // the right edge (the middle of the art is empty anyway), instead of stretching the whole picture sideways
        const fs = dh / im.height, fw = im.width * fs, hw = im.width / 2;
        if (fw <= VW) { ctx.drawImage(im, 0, 0, hw, im.height, 0, oy, fw / 2, dh); ctx.drawImage(im, hw, 0, hw, im.height, VW - fw / 2, oy, fw / 2, dh); }
        else ctx.drawImage(im, (VW - fw) / 2, oy, fw, dh);
      } else if (im) {
        if (L.tile) {  // mirrored tiling: every other copy is flipped, so the seams always match
          let x0 = ox % dw; if (x0 > 0) x0 -= dw; let k = Math.round((x0 - ox) / dw);
          for (let x = x0; x < VW; x += dw, k++) { if (k & 1) { ctx.save(); ctx.translate(x + dw, oy); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, dw + 1, dh); ctx.restore(); } else ctx.drawImage(im, x, oy, dw + 1, dh); } }
        else ctx.drawImage(im, ox, oy, dw, dh);
      }
      if (L.items) for (const it of L.items) {
        const ix = it.x * s, iy = it.y * s;
        if (L.tile) { let x0 = (ox % dw); if (x0 > 0) x0 -= dw; for (let x = x0; x < VW + dw; x += dw) { const X = x + ix; if (X > -300 && X < VW + 300) elementDraw(ctx, it, X, oy + iy, s, t, L); } }
        else elementDraw(ctx, it, ox + ix, oy + iy, s, t, L);
      }
      ctx.restore();
    }
    return true;
  }
  // painted layers are pushed back in depth (darker, flatter, softer) so the playable ground and characters read
  // clearly in front of them. L.dim overrides the default per layer: [brightness, saturation, blur px].
  const DEPTH = { far: [0.62, 0.8, 1.2], sil: [0.48, 0.7, 0.8], mid: [0.56, 0.78, 0.6], front: [0.16, 0.35, 1.2] };
  const depthCache = {};
  function depthImg(L) {
    const im = G.Assets.get(L.img); if (!im) return null;
    const d = L.dim || DEPTH[L.id]; if (!d) return im;
    const k = L.img + d.join(','); if (depthCache[k]) return depthCache[k];
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
    x.filter = `brightness(${d[0]}) saturate(${d[1]})${d[2] ? ` blur(${d[2]}px)` : ''}`; x.drawImage(im, 0, 0);
    return (depthCache[k] = c);
  }
  function drawRays(ctx, room, cam, VW, VH, t, L) {
    const seed = hashStr(room.id || room.area); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < (L.count || 4); i++) {
      const r = mulberry(seed + i * 77)(); const x = ((r * 1.3 + i * 0.27) % 1) * VW * 1.2 - VW * 0.1 - cam.x * (L.p || 0.18);
      const w = 90 + r * 160, a = (L.a || 0.06) * (0.6 + 0.4 * Math.sin(t * (0.2 + r * 0.3) + i * 2));
      const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, rgba(L.color, a * 1.6)); g.addColorStop(0.7, rgba(L.color, a * 0.5)); g.addColorStop(1, rgba(L.color, 0));
      ctx.fillStyle = g; ctx.beginPath(); const sk = 220 + r * 200;
      ctx.moveTo(x, -10); ctx.lineTo(x + w, -10); ctx.lineTo(x + w + sk, VH); ctx.lineTo(x + sk - w * 0.3, VH); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function images() { const out = []; if (!window.SCENES) return out; for (const a in window.SCENES) for (const L of window.SCENES[a].layers) { if (L.img) out.push([L.img, L.src]); if (L.items) for (const it of L.items) { if (it.img && it.src) out.push([it.img, it.src]); if (it.frames) it.frames.imgs.forEach((k, i) => out.push([k, it.frames.srcs[i]])); if (it.parts) for (const q of it.parts) out.push([q.img, q.src]); } } return out; }
  // the painted foreground frame is retired: on wide/phone screens it hid the play area and showed the room through it.
  // the screen edges are darkened by the vignette instead
  function drawFront() { return false; }
  return { draw, drawFront, images, elementDraw };
})();
