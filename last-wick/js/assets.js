'use strict';
// Image loading + atlas sprite drawing
G.Assets = (function () {
  const imgs = {};
  let total = 0, done = 0;
  function load(name, src) {
    if (imgs[name]) return imgs[name].p;
    total++;
    const im = new Image();
    const rec = { im, ok: false };
    rec.p = new Promise(res => {
      im.onload = () => { rec.ok = true; done++; res(im); };
      im.onerror = () => { console.warn('missing', src); done++; res(null); };
    });
    im.src = src; imgs[name] = rec; return rec.p;
  }
  function get(name) { const r = imgs[name]; return r && r.ok ? r.im : null; }
  return { load, get, progress: () => total ? done / total : 1, imgs };
})();

// Sprite drawing from ATLAS metas. World scale: px per Blender unit (default 50)
G.Sprite = (function () {
  const tmp = document.createElement('canvas'); const tctx = tmp.getContext('2d');
  function meta(atlas) { return window.ATLAS[atlas]; }
  function frameOf(atlas, anim, t, loopOverride) {
    const m = meta(atlas); if (!m) return 0; const a = m.anims[anim]; if (!a) return 0;
    const f = Math.floor(t * a.fps);
    const loop = loopOverride === undefined ? a.loop : loopOverride;
    return loop ? f % a.n : Math.min(f, a.n - 1);
  }
  function animDur(atlas, anim) { const m = meta(atlas); const a = m && m.anims[anim]; return a ? a.n / a.fps : 0; }
  // draw frame; x,y = world position of origin (feet). opts: {flip, scale, alpha, flash (0..1 white), tint, rot}
  function draw(ctx, atlas, anim, fi, x, y, o) {
    o = o || {};
    const m = meta(atlas), im = G.Assets.get(atlas); if (!m || !im) return false;
    const a = m.anims[anim] || m.anims[Object.keys(m.anims)[0]];
    const i = clamp(fi, 0, a.n - 1), f = a.f[i];
    // v2 atlases (tools/posesheet.py): f=[x,y,w,h] + per-frame anchor a.o[i]; v1: uniform cell + m.origin
    const cw = f.length > 2 ? f[2] : m.cell[0], ch = f.length > 2 ? f[3] : m.cell[1];
    const [ox, oy] = a.o ? a.o[i] : m.origin;
    const s = (o.ppu || 50) / m.unitPx * (o.scale || 1);
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.flip ? -s : s, s * (o.sy || 1));
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (o.flash > 0 || o.tint) {
      if (tmp.width < cw || tmp.height < ch) { tmp.width = Math.max(tmp.width, cw); tmp.height = Math.max(tmp.height, ch); }
      tctx.clearRect(0, 0, cw, ch); tctx.globalCompositeOperation = 'source-over';
      tctx.drawImage(im, f[0], f[1], cw, ch, 0, 0, cw, ch);
      tctx.globalCompositeOperation = 'source-atop';
      if (o.tint) { tctx.globalAlpha = o.tint[3]; tctx.fillStyle = `rgb(${o.tint[0]},${o.tint[1]},${o.tint[2]})`; tctx.fillRect(0, 0, cw, ch); }
      if (o.flash > 0) { tctx.globalAlpha = o.flash; tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, cw, ch); }
      tctx.globalAlpha = 1;
      ctx.drawImage(tmp, 0, 0, cw, ch, -ox, -oy, cw, ch);
    } else ctx.drawImage(im, f[0], f[1], cw, ch, -ox, -oy, cw, ch);
    ctx.restore();
    return true;
  }
  // point in frame (pixel coords in cell) -> world coords
  // o.anim + o.fi select the per-frame anchor of v2 atlases
  function point(atlas, p, x, y, o) {
    o = o || {}; const m = meta(atlas); if (!m || !p) return { x, y };
    const s = (o.ppu || 50) / m.unitPx * (o.scale || 1);
    const a = o.anim && m.anims[o.anim];
    const org = a && a.o ? a.o[clamp(o.fi || 0, 0, a.n - 1)] : m.origin;
    const dx = (p[0] - org[0]) * s, dy = (p[1] - org[1]) * s * (o.sy || 1);
    return { x: x + (o.flip ? -dx : dx), y: y + dy };
  }
  function has(atlas, anim) { const m = meta(atlas); return !!(m && m.anims[anim]); }
  return { draw, frameOf, animDur, meta, point, has };
})();
