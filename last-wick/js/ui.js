'use strict';
// HUD, menus, dialogue, cards
G.UI = (function () {
  const R = () => G.Render, I = G.Input;
  const HE = '"Frank Ruhl Libre", "David", serif', EN = '"Cinzel", "Times New Roman", serif';
  let toasts = [], tallowShow = 0, tallowDisp = 0;
  let card = null;      // area / boss title card {lines, t, dur, kind}
  let modal = null;     // dialogue / lore / ability / shop / pause / map
  let taps = [];        // clickable regions this frame
  function text(c, s, x, y, o = {}) {
    c.save(); c.font = `${o.w || 400} ${o.size || 28}px ${o.en ? EN : HE}`; c.textAlign = o.align || 'center'; c.textBaseline = o.base || 'middle';
    c.direction = o.en ? 'ltr' : 'rtl';
    if (o.spacing) c.letterSpacing = o.spacing + 'px';
    if (o.shadow !== false) { c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = o.blur ?? 12; }
    c.globalAlpha = o.a ?? 1; c.fillStyle = o.c || '#efe6da'; c.fillText(s, x, y);
    c.restore();
  }
  function wrap(c, s, maxW, size, en) {
    c.save(); c.font = `400 ${size}px ${en ? EN : HE}`; const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); c.restore(); return lines;
  }
  function ornament(c, x, y, w, a = 1) {
    c.save(); c.globalAlpha = a; c.strokeStyle = 'rgba(232,214,190,0.75)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w / 4, y - 6, x - 14, y); c.moveTo(x + w / 2, y); c.quadraticCurveTo(x + w / 4, y - 6, x + 14, y); c.stroke();
    c.fillStyle = 'rgba(255,220,170,0.9)'; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 7, y); c.lineTo(x, y + 8); c.lineTo(x - 7, y); c.closePath(); c.fill();
    c.restore();
  }
  function panel(c, x, y, w, h, a = 0.85) {
    c.save(); const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(10,8,14,${a})`); g.addColorStop(1, `rgba(4,3,6,${a})`);
    c.fillStyle = g; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(220,200,170,0.25)'; c.lineWidth = 1; c.strokeRect(x + 6, y + 6, w - 12, h - 12);
    c.restore();
  }
  // ---------------- HUD ----------------
  function hud(c, t) {
    const S = G.state; const x0 = 40, y0 = 34;
    // soul vessel
    const r = 44, cx = x0 + r, cy = y0 + r, fill = S.soul / S.soulMax;
    c.save();
    G.FX.glow(c, cx, cy, r * 2.2, [255, 170, 90], 0.15 + fill * 0.3);
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = 'rgba(8,6,10,0.85)'; c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r - 5, 0, 7); c.clip();
    const ly = cy + r - fill * (2 * r - 10) - 5;
    const lg = c.createLinearGradient(0, ly, 0, cy + r); lg.addColorStop(0, '#fff3dc'); lg.addColorStop(0.15, '#ffbe72'); lg.addColorStop(1, '#a8401a');
    c.fillStyle = lg; c.beginPath(); c.moveTo(cx - r, cy + r);
    for (let i = 0; i <= 20; i++) { const xx = cx - r + i * r / 10; c.lineTo(xx, ly + Math.sin(t * 3 + i * 0.7) * 2.5 * (fill > 0.02 ? 1 : 0)); }
    c.lineTo(cx + r, cy + r); c.closePath(); c.fill();
    c.restore();
    const rg = c.createRadialGradient(cx - 14, cy - 16, 2, cx, cy, r); rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.03)'); rg.addColorStop(1, 'rgba(255,255,255,0.12)');
    c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, r - 4, 0, 7); c.fill();
    c.lineWidth = 4; c.strokeStyle = '#d9cbb4'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = '#1a1418'; c.beginPath(); c.arc(cx, cy, r + 3, 0, 7); c.stroke();
    // little horns of the vessel (wax drips)
    c.fillStyle = '#d9cbb4'; for (const a of [-2.3, -0.85]) { c.beginPath(); c.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, 9, a + 1.57, 0, 7); c.fill(); }
    if (S.soul >= 33) { G.FX.glow(c, cx, cy, r * 1.4, [255, 210, 150], 0.18 + Math.sin(t * 4) * 0.06); }
    // masks (little candles)
    for (let i = 0; i < S.hpMax; i++) {
      const mx = cx + r + 30 + i * 36, my = y0 + 30; const full = i < S.hp;
      c.save(); c.translate(mx, my);
      c.fillStyle = full ? '#f2e8d8' : 'rgba(30,26,32,0.9)'; c.strokeStyle = full ? '#1a1418' : 'rgba(200,190,170,0.35)'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-11, -10); c.quadraticCurveTo(-12, 16, -9, 20); c.lineTo(9, 20); c.quadraticCurveTo(12, 16, 11, -10);
      c.quadraticCurveTo(6, -14, 0, -12); c.quadraticCurveTo(-6, -14, -11, -10); c.closePath(); c.fill(); c.stroke();
      if (full) {
        c.fillStyle = '#f2e8d8'; c.beginPath(); c.ellipse(-8, 0, 3, 7, 0, 0, 7); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.ellipse(-4, 3, 2.6, 4.5, 0, 0, 7); c.ellipse(4, 3, 2.6, 4.5, 0, 0, 7); c.fill();
        G.FX.flame(c, 0, -14, 2.1, t * 1.3 + i * 0.7, { glow: 0.5 });
      }
      c.restore();
    }
    // tallow
    tallowDisp = approach(tallowDisp, S.tallow, Math.max(1, Math.abs(S.tallow - tallowDisp)) * 0.1 + 0.5);
    tallowShow = Math.max(0, tallowShow - 1 / 60);
    const tx = cx + r + 24, ty = y0 + 74;
    c.fillStyle = '#e8d2ae'; c.beginPath(); c.moveTo(tx, ty - 11); c.bezierCurveTo(tx + 9, ty - 3, tx + 8, ty + 8, tx, ty + 8); c.bezierCurveTo(tx - 8, ty + 8, tx - 9, ty - 3, tx, ty - 11); c.fill();
    text(c, String(Math.round(tallowDisp)), tx + 18, ty, { size: 24, align: 'left', en: true, c: '#efe6da', w: 700 });
    c.restore();
    // boss bar
    const b = G.Main.boss;
    if (b && b.active && !b.dead) {
      const W = Math.min(900, R().VW * 0.6), bx = (R().VW - W) / 2, by = R().VH - 60;
      b.barDisp = approach(b.barDisp ?? 1, b.hp / b.maxHp, 0.01);
      c.fillStyle = 'rgba(5,4,8,0.8)'; c.fillRect(bx - 4, by - 4, W + 8, 16);
      c.fillStyle = 'rgba(255,240,220,0.5)'; c.fillRect(bx, by, W * b.barDisp, 8);
      const g = c.createLinearGradient(bx, 0, bx + W, 0); g.addColorStop(0, '#7a1f14'); g.addColorStop(1, '#e0703a');
      c.fillStyle = g; c.fillRect(bx, by, W * Math.max(0, b.hp / b.maxHp), 8);
      text(c, G.TEXT.bosses[b.kind][0], R().VW / 2, by - 22, { size: 24, c: '#e9dccb' });
    }
  }
  function prompt(c, x, y, s) {
    const tt = performance.now() / 1000;
    c.save(); c.globalAlpha = 0.85 + Math.sin(tt * 4) * 0.15;
    text(c, s, x, y + Math.sin(tt * 3) * 3, { size: 24, c: '#f4ead8' }); c.restore();
  }
  function toast(s, dur = 2.6) { toasts.push({ s, t: 0, dur }); }
  function tallowPing() { tallowShow = 2; }
  // ------------- cards -------------
  function areaCard(area) { const a = G.TEXT.areas[area]; card = { kind: 'area', l1: a[0], l2: a[1], t: 0, dur: 4.2 }; }
  function worldCard(w) { const W = window.WORLD.worlds[w]; card = { kind: 'world', l1: W.name, l2: W.en, t: 0, dur: 5.5 }; }
  function bossCard(kind) { const b = G.TEXT.bosses[kind]; card = { kind: 'boss', l1: b[0], l2: b[1], t: 0, dur: 3.6 }; }
  function drawCard(c, dt) {
    if (!card) return; card.t += dt; const k = card.t / card.dur; if (k >= 1) { card = null; return; }
    const a = k < 0.2 ? k / 0.2 : k > 0.75 ? (1 - k) / 0.25 : 1; const VW = R().VW, VH = R().VH;
    if (card.kind === 'world') {
      c.fillStyle = `rgba(0,0,0,${0.35 * a})`; c.fillRect(0, VH * 0.18, VW, VH * 0.26);
      text(c, card.l2, VW / 2, VH * 0.24, { size: 22, en: true, a: a * 0.8, spacing: 12 });
      text(c, card.l1, VW / 2, VH * 0.31, { size: 92, w: 900, a, blur: 30 });
      ornament(c, VW / 2, VH * 0.31 + 62, 620, a);
    } else if (card.kind === 'area') {
      ornament(c, VW / 2, VH * 0.27 + 46, 420, a);
      text(c, card.l1, VW / 2, VH * 0.27 - 8, { size: 64, w: 700, a, blur: 20 });
      text(c, card.l2, VW / 2, VH * 0.27 + 80, { size: 20, en: true, a: a * 0.8, spacing: 6 });
    } else {
      const y = VH * 0.74;
      text(c, card.l2, VW / 2, y - 52, { size: 22, en: true, a: a * 0.85, spacing: 8, c: '#d8c8b0' });
      text(c, card.l1, VW / 2, y + 6, { size: 86, w: 900, a, blur: 26 });
      ornament(c, VW / 2, y + 64, 560, a);
    }
  }
  // ------------- modals -------------
  function talk(npc) {
    const d = G.TEXT.npc[npc.id]; const S = G.state;
    const seen = S.talked[npc.id] || 0; const set = d.lines[Math.min(seen, d.lines.length - 1)];
    S.talked[npc.id] = seen + 1;
    modal = { kind: 'talk', npc: npc.id, name: d.name, lines: set, i: 0, t: 0, after: d.shop ? () => openShop() : null };
    G.Sound.sfx('ui_select');
  }
  function lore(id) { modal = { kind: 'talk', name: '', lines: G.TEXT.lore[id], i: 0, t: 0 }; G.Sound.sfx('ui_select'); }
  function ability(kind, cb) { modal = { kind: 'ability', ab: kind, t: 0, cb }; G.Sound.sfx('ability'); G.Sound.duck(0.2, 4); }
  function openShop() { modal = { kind: 'shop', sel: 0, t: 0, msg: '' }; }
  function pause() { modal = { kind: 'pause', sel: 0, t: 0 }; G.Sound.sfx('ui_select'); }
  function map() { modal = { kind: 'map', t: 0 }; G.Sound.sfx('ui_move'); }
  function confirmP() { return I.p('jump') || I.p('attack') || I.p('confirm') || I.p('interact'); }
  function update(dt) {
    for (const t of toasts) t.t += dt; toasts = toasts.filter(t => t.t < t.dur);
    if (!modal) return false;
    modal.t += dt; const m = modal;
    if (m.kind === 'talk') {
      if (m.t > 0.25 && (confirmP() || I.tap())) {
        m.i++; m.t = 0; G.Sound.sfx('ui_move');
        if (m.i >= m.lines.length) { modal = null; if (m.after) m.after(); }
      }
    } else if (m.kind === 'ability') {
      if (m.t > 1.4 && (confirmP() || I.tap())) { modal = null; G.Sound.sfx('ui_select'); if (m.cb) m.cb(); }
    } else if (m.kind === 'shop') {
      const items = G.TEXT.shop; const n = items.length + 1;
      if (I.p('down')) { m.sel = (m.sel + 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('up')) { m.sel = (m.sel + n - 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('pause') || I.p('dash')) { modal = null; return true; }
      if (m.t > 0.2 && confirmP()) buy(m.sel);
    } else if (m.kind === 'pause') {
      const n = 4;
      if (I.p('down')) { m.sel = (m.sel + 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('up')) { m.sel = (m.sel + n - 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('pause') && m.t > 0.1) { modal = null; return true; }
      if (m.t > 0.15 && confirmP()) pauseSelect(m.sel);
    } else if (m.kind === 'map') {
      if ((I.p('map') || I.p('pause') || confirmP()) && m.t > 0.1) { modal = null; I.consume('pause'); }
    }
    return true;
  }
  function pauseSelect(i) {
    G.Sound.sfx('ui_select');
    if (i === 0) modal = null;
    else if (i === 1) modal = { kind: 'map', t: 0 };
    else if (i === 2) { G.Sound.toggleMute(); G.state.muted = G.Sound.muted; }
    else if (i === 3) { modal = null; G.Main.toTitle(); }
  }
  function buy(i) {
    const S = G.state, items = G.TEXT.shop, m = modal;
    if (i >= items.length) { modal = null; return; }
    const it = items[i]; if (S.shop[it.id]) return;
    if (S.tallow < it.price) { m.msg = G.T('shop_poor'); G.Sound.sfx('clank'); return; }
    S.tallow -= it.price; S.shop[it.id] = 1; G.Sound.sfx('ability');
    if (it.kind === 'heart') { S.hpMax++; S.hp = S.hpMax; }
    if (it.kind === 'vessel') { S.soulMax += 33; }
    if (it.kind === 'edge') { S.needle += 0.5; }
    if (it.kind === 'ember') { S.spellMul = 1.6; }
    m.msg = G.T('shop_sold') + ': ' + it.name; G.Main.save();
  }
  function tapRegion(x, y, w, h, cb) { taps.push({ x, y, w, h, cb }); }
  function handleTap() {
    if (!I.tap()) return; const p = I.tapPos(); if (!p) return;
    const sc = R().scale, dpr = R().cv.width / innerWidth;
    const lx = p.x * dpr / sc, ly = p.y * dpr / sc;
    for (const r of taps) if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) { r.cb(); return true; }
  }
  function drawModal(c) {
    const VW = R().VW, VH = R().VH; const m = modal; if (!m) return;
    if (m.kind === 'talk') {
      const w = Math.min(1100, VW - 80), h = 210, x = (VW - w) / 2, y = VH - h - 40;
      panel(c, x, y, w, h, 0.88);
      if (m.name) { text(c, m.name, VW / 2, y + 34, { size: 30, w: 700, c: '#f0d9b5' }); ornament(c, VW / 2, y + 62, 300); }
      const lines = wrap(c, m.lines[m.i] || '', w - 120, 30);
      lines.forEach((l, k) => text(c, l, VW / 2, y + (m.name ? 102 : 70) + k * 40, { size: 30 }));
      if (m.t > 0.4) text(c, '▼', VW / 2, y + h - 22, { size: 18, a: 0.5 + Math.sin(m.t * 5) * 0.3, en: true });
      tapRegion(0, 0, VW, VH, () => { m.i++; m.t = 0; if (m.i >= m.lines.length) { modal = null; if (m.after) m.after(); } });
    } else if (m.kind === 'ability') {
      const a = Math.min(1, m.t * 1.5); const ab = G.TEXT.abil[m.ab];
      c.fillStyle = `rgba(0,0,0,${0.75 * a})`; c.fillRect(0, 0, VW, VH);
      G.FX.glow(c, VW / 2, VH * 0.4, 400 * a, [255, 170, 90], 0.5 * a);
      G.FX.flame(c, VW / 2, VH * 0.42, 14 * a, m.t * 1.2, { glow: 1.5 });
      text(c, ab[0], VW / 2, VH * 0.56, { size: 72, w: 900, a });
      ornament(c, VW / 2, VH * 0.56 + 54, 480, a);
      text(c, ab[1], VW / 2, VH * 0.56 + 100, { size: 30, a: a * 0.9 });
      if (ab[2]) text(c, ab[2], VW / 2, VH * 0.56 + 150, { size: 24, a: a * 0.6, c: '#d9b88f' });
      tapRegion(0, 0, VW, VH, () => { if (m.t > 1.4) { modal = null; if (m.cb) m.cb(); } });
    } else if (m.kind === 'shop') {
      const items = G.TEXT.shop, w = Math.min(900, VW - 60), h = 120 + items.length * 74 + 80, x = (VW - w) / 2, y = (VH - h) / 2;
      panel(c, x, y, w, h, 0.93);
      text(c, G.T('shop_title'), VW / 2, y + 44, { size: 40, w: 700, c: '#f0d9b5' }); ornament(c, VW / 2, y + 78, 360);
      items.forEach((it, i) => {
        const iy = y + 120 + i * 74, sold = G.state.shop[it.id], sel = m.sel === i;
        if (sel) { c.fillStyle = 'rgba(255,200,140,0.1)'; c.fillRect(x + 30, iy - 30, w - 60, 64); }
        text(c, it.name, x + w - 60, iy - 6, { size: 30, align: 'right', a: sold ? 0.35 : 1, c: sel ? '#ffe2b8' : '#efe6da' });
        text(c, it.desc, x + w - 60, iy + 22, { size: 20, align: 'right', a: sold ? 0.3 : 0.7 });
        text(c, sold ? G.T('shop_sold') : String(it.price), x + 70, iy, { size: 28, align: 'left', en: !sold, a: sold ? 0.35 : G.state.tallow >= it.price ? 1 : 0.45, c: '#e8d2ae' });
        tapRegion(x + 30, iy - 30, w - 60, 64, () => { m.sel = i; buy(i); });
      });
      const ey = y + 120 + items.length * 74; const sel = m.sel === items.length;
      text(c, G.T('shop_exit'), VW / 2, ey + 6, { size: 28, c: sel ? '#ffe2b8' : '#efe6da' }); tapRegion(VW / 2 - 100, ey - 24, 200, 56, () => { modal = null; });
      text(c, m.msg, VW / 2, y + h - 22, { size: 22, c: '#d9b88f' });
      text(c, String(G.state.tallow), x + 70, y + 44, { size: 26, align: 'left', en: true, c: '#e8d2ae' });
    } else if (m.kind === 'pause') {
      c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(0, 0, VW, VH);
      text(c, G.T('paused'), VW / 2, VH * 0.18, { size: 64, w: 700 }); ornament(c, VW / 2, VH * 0.18 + 50, 360);
      const opts = [G.T('resume'), G.T('mapt'), G.T('sound') + ': ' + (G.Sound.muted ? G.T('off') : G.T('on')), G.T('quit')];
      opts.forEach((o, i) => { const yy = VH * 0.32 + i * 64; text(c, o, VW / 2, yy, { size: 34, c: m.sel === i ? '#ffe2b8' : '#cfc4b4' }); if (m.sel === i) { G.FX.flame(c, VW / 2 + 150, yy + 12, 3, m.t, {}); } tapRegion(VW / 2 - 200, yy - 28, 400, 56, () => { m.sel = i; pauseSelect(i); }); });
      const keys = I.isTouch ? G.TEXT.keys_touch : G.TEXT.keys;
      keys.forEach((k, i) => { const yy = VH * 0.62 + i * 30; text(c, k[0], VW / 2 - 20, yy, { size: 20, align: 'right', c: '#f0d9b5', en: /^[A-Za-z]/.test(k[0]) }); text(c, k[1], VW / 2 + 20 + 260, yy, { size: 20, align: 'right', a: 0.75 }); });
    } else if (m.kind === 'map') drawMap(c, m);
  }
  let mapCanvas = null, mapInfo = null;
  function drawMap(c, m) {
    const VW = R().VW, VH = R().VH, S = G.state, W = window.WORLD;
    c.fillStyle = 'rgba(6,5,8,0.92)'; c.fillRect(0, 0, VW, VH);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const curW = G.Main.room ? G.Main.room.world : 'lumen';
    for (const id in W.rooms) { const r = W.rooms[id]; if (r.world !== curW) continue; x0 = Math.min(x0, r.gx); y0 = Math.min(y0, r.gy); x1 = Math.max(x1, r.gx + r.w); y1 = Math.max(y1, r.gy + r.h); }
    const sc = Math.min((VW - 160) / (x1 - x0), (VH - 200) / (y1 - y0));
    const ox = (VW - (x1 - x0) * sc) / 2 - x0 * sc, oy = 120 + (VH - 200 - (y1 - y0) * sc) / 2 - y0 * sc;
    text(c, W.worlds[curW].name, VW / 2, 60, { size: 46, w: 700 }); ornament(c, VW / 2, 98, 260);
    const AC = { crypts: '#c8956a', gardens: '#7fd1b0', nave: '#7f9ee0', spire: '#c4a0f0', hearth: '#e07050', shore: '#ff9a5a', galleon: '#a898e0', lighthouse: '#ffc070', paper: '#efe2c8', clock: '#e0c070', core: '#ffb060' };
    for (const id in W.rooms) {
      if (!S.visited[id]) continue; const r = W.rooms[id]; if (r.world !== curW) continue;
      c.save(); c.translate(ox + r.gx * sc, oy + r.gy * sc);
      c.fillStyle = 'rgba(30,26,30,0.9)'; c.fillRect(0, 0, r.w * sc, r.h * sc);
      c.fillStyle = AC[r.area];
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const ch = r.rows[y][x]; if (ch !== '#' && ch !== 'x') { c.globalAlpha = ch === '~' ? 0.3 : 0.55; c.fillRect(x * sc, y * sc, sc + 0.3, sc + 0.3); } }
      c.globalAlpha = 1; c.strokeStyle = AC[r.area]; c.lineWidth = 1.5; c.strokeRect(0, 0, r.w * sc, r.h * sc);
      for (const e of r.ents) { if (e.t === 'bench') { c.fillStyle = '#ffd08a'; c.beginPath(); c.arc(e.x * sc, (e.y - 1) * sc, 5, 0, 7); c.fill(); } if (e.t === 'boss' && !S.bosses[e.kind]) { c.fillStyle = '#ff5040'; c.font = `bold ${Math.max(12, sc * 3)}px serif`; c.fillText('✕', e.x * sc - 6, (e.y - 2) * sc); } }
      c.restore();
    }
    const room = G.Main.room, p = G.Main.player;
    if (room && p) { const px = ox + (room.gx + p.cx / TILE) * sc, py = oy + (room.gy + p.cy / TILE) * sc; G.FX.glow(c, px, py, 30, [255, 180, 100], 0.8); c.fillStyle = '#fff4e0'; c.beginPath(); c.arc(px, py, 5 + Math.sin(m.t * 6), 0, 7); c.fill(); }
    tapRegion(0, 0, VW, VH, () => { modal = null; });
  }
  function drawToasts(c) {
    const VW = R().VW, VH = R().VH;
    toasts.forEach((t, i) => { const a = Math.min(1, t.t * 4, (t.dur - t.t) * 2); text(c, t.s, VW / 2, VH * 0.86 - i * 40, { size: 28, a, c: '#f2e2c8' }); });
  }
  return { clearTaps: () => { taps = []; }, hud, prompt, toast, tallowPing, areaCard, worldCard, bossCard, drawCard, talk, lore, ability, openShop, pause, map, update, drawModal, drawToasts, handleTap, tapRegion, text, ornament, panel, wrap,
    get modal() { return modal; }, set modal(v) { modal = v; }, get card() { return card; }, HE, EN };
})();
