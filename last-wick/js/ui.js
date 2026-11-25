'use strict';
// HUD, menus, dialogue, cards
G.UI = (function () {
  const R = () => G.Render, I = G.Input;
  const HE = '"Noto Serif Hebrew", "Frank Ruhl Libre", "David", serif', EN = '"Cinzel", "Times New Roman", serif';
  const HT = HE;   // one family for everything: titles just use a heavier cut
  let toasts = [], tallowShow = 0, tallowDisp = 0;
  let card = null;      // area / boss title card {lines, t, dur, kind}
  let modal = null;     // dialogue / lore / ability / shop / pause / map
  let taps = [];        // clickable regions this frame
  // player settings (saved locally): volumes 0..10, screen shake, mouse buttons for attack/dash
  const SET = { music: 7, sfx: 9, shake: 1, mouse: 1 };
  try { Object.assign(SET, JSON.parse(localStorage.getItem('lastwick_settings')) || {}); } catch (e) { }
  function applySettings() { try { G.Sound.setVolumes(SET.music / 10, SET.sfx / 10); } catch (e) { } I.mouse = !!SET.mouse; G.FX.S.shakeMul = SET.shake ? 1 : 0; }
  function saveSettings() { try { localStorage.setItem('lastwick_settings', JSON.stringify(SET)); } catch (e) { } applySettings(); }
  setTimeout(applySettings, 0);
  function text(c, s, x, y, o = {}) {
    c.save(); c.font = `${o.w || 400} ${o.size || 28}px ${o.en ? EN : o.title ? HT : HE}`; c.textAlign = o.align || 'center'; c.textBaseline = o.base || 'middle';
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
    c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 30;
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(22,17,24,${a})`); g.addColorStop(1, `rgba(9,7,11,${a})`);
    c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, 18); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = 'rgba(232,206,165,0.32)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x + 7, y + 7, w - 14, h - 14, 13); c.stroke();
    const D = G.Assets.get('prop_ui_divider'); if (D) { const dw = Math.min(w * 0.5, 420), dh = dw * D.height / D.width; c.globalAlpha = 0.9; c.drawImage(D, x + (w - dw) / 2, y - dh * 0.45, dw, dh); }
    c.restore();
  }
  // a feathered pool of shadow behind text: reads as the text sitting in the dark, not as a box pasted on the picture
  function shade(c, x, y, rx, ry, a) {
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(6,4,8,${a})`); g.addColorStop(0.55, `rgba(6,4,8,${a * 0.75})`); g.addColorStop(1, 'rgba(6,4,8,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill(); c.restore();
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
    const RI = window.PROPS.ui_ring && G.Assets.get('prop_ui_ring');
    if (RI) { const s = (r * 2 + 26) / Math.max(RI.width, RI.height); c.drawImage(RI, cx - RI.width * s / 2, cy - RI.height * s / 2, RI.width * s, RI.height * s); } else {
    c.lineWidth = 4; c.strokeStyle = '#d9cbb4'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = '#1a1418'; c.beginPath(); c.arc(cx, cy, r + 3, 0, 7); c.stroke();
    // little horns of the vessel (wax drips)
    c.fillStyle = '#d9cbb4'; for (const a of [-2.3, -0.85]) { c.beginPath(); c.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, 9, a + 1.57, 0, 7); c.fill(); } }
    if (S.soul >= 33) { G.FX.glow(c, cx, cy, r * 1.4, [255, 210, 150], 0.18 + Math.sin(t * 4) * 0.06); }
    if (S.spect) text(c, '👁 ' + G.T('spectator'), x0 + 2, y0 + r * 2 + 36, { size: 17, align: 'left', c: '#cdb8ff', a: 0.8, blur: 6 });
    // masks (little candles)
    for (let i = 0; i < S.hpMax; i++) {
      const mx = cx + r + 30 + i * 36, my = y0 + 30; const full = i < S.hp;
      const MI = G.Assets.get(full ? 'prop_ui_mask' : 'prop_ui_mask_empty');
      if (MI) { const s = 46 / MI.height; c.save(); c.translate(mx, my); if (!full) c.globalAlpha = 0.6; c.drawImage(MI, -MI.width * s / 2, -22, MI.width * s, 46); c.globalAlpha = 1;
        if (full) G.FX.flame(c, 0, -24, 2.1, t * 1.3 + i * 0.7, { glow: 0.5 }); c.restore(); continue; }
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
    const DI = G.Assets.get('prop_item_drop');
    if (DI) { const s = 26 / DI.height; c.drawImage(DI, tx - DI.width * s / 2, ty - 15, DI.width * s, 26); } else {
    c.fillStyle = '#e8d2ae'; c.beginPath(); c.moveTo(tx, ty - 11); c.bezierCurveTo(tx + 9, ty - 3, tx + 8, ty + 8, tx, ty + 8); c.bezierCurveTo(tx - 8, ty + 8, tx - 9, ty - 3, tx, ty - 11); c.fill(); }
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
    if (modal) return;
    if (!I.isTouch && s[0] === '↑') s = '[' + I.keyName(I.binds().interact[0]) + '] ' + s.slice(2);   // keyboard: show the real key
    const tt = performance.now() / 1000, yy = y + Math.sin(tt * 3) * 3;
    c.save(); c.font = `400 22px ${HE}`; const w = c.measureText(s).width; c.restore();
    shade(c, x, yy, w * 0.75 + 30, 26, 0.55);
    text(c, s, x, yy + 1, { size: 22, c: '#f6e9d3', blur: 6, a: 0.96 });
    G.FX.glow(c, x, yy - 20, 10, [255, 210, 150], 0.35 + Math.sin(tt * 3) * 0.1);
  }
  function toast(s, dur = 2.6) { toasts.push({ s, t: 0, dur }); }
  function tallowPing() { tallowShow = 2; }
  // ------------- cards -------------
  function areaCard(area) { const a = G.TEXT.areas[area]; card = { kind: 'area', l1: a[0], l2: a[1], t: 0, dur: 4.2 }; }
  function worldCard(w) { const W = window.WORLD.worlds[w]; card = { kind: 'world', l1: W.name, l2: W.en, t: 0, dur: 5.5 }; }
  function bossCard(kind) { const b = G.TEXT.bosses[kind]; card = { kind: 'boss', l1: b[0], l2: b[1], t: 0, dur: 3.6 }; }
  function drawCard(c, dt) {
    if (!card || modal) return; card.t += dt; const k = card.t / card.dur;   // the area title waits behind dialogue / menus instead of overlapping them
    if (k >= 1) { card = null; return; }
    const a = k < 0.2 ? k / 0.2 : k > 0.75 ? (1 - k) / 0.25 : 1; const VW = R().VW, VH = R().VH;
    if (card.kind === 'world') {
      const vg = c.createRadialGradient(VW / 2, VH * 0.27, 10, VW / 2, VH * 0.27, VW * 0.32); vg.addColorStop(0, `rgba(0,0,0,${0.32 * a})`); vg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = vg; c.fillRect(0, 0, VW, VH);
      text(c, card.l2, VW / 2, VH * 0.2, { size: 15, en: true, a: a * 0.7, spacing: 10, c: '#e2cfae' });
      text(c, card.l1, VW / 2, VH * 0.27, { size: 54, w: 600, title: true, a, blur: 24, c: '#f6ead6' });
      ornament(c, VW / 2, VH * 0.27 + 40, 340, a * 0.9);
    } else if (card.kind === 'area') {
      text(c, card.l1, VW / 2, VH * 0.22, { size: 40, w: 600, title: true, a: a * 0.95, blur: 20, c: '#f6ead6' });
      ornament(c, VW / 2, VH * 0.22 + 30, 260, a * 0.85);
      text(c, card.l2, VW / 2, VH * 0.22 + 54, { size: 13, en: true, a: a * 0.65, spacing: 8, c: '#e2cfae' });
    } else {
      const y = VH * 0.26;   // up top: never over the hero or the boss's health bar
      text(c, card.l2, VW / 2, y - 40, { size: 15, en: true, a: a * 0.75, spacing: 9, c: '#e2cfae' });
      text(c, card.l1, VW / 2, y + 4, { size: 58, w: 600, title: true, a, blur: 26, c: '#f6e4cc' });
      ornament(c, VW / 2, y + 44, 380, a);
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
  function advanceTalk(m) {
    if (modal !== m || m.t < 0.2) return;
    const full = m.lines[m.i] || ''; if (m.t * 55 < full.length) { m.t = full.length / 55 + 0.21; return; }   // first tap: show the whole line
    m.i++; m.t = 0; G.Sound.sfx('ui_move');
    if (m.i >= m.lines.length) { modal = null; if (m.after) m.after(); }
  }
  function ability(kind, cb) { modal = { kind: 'ability', ab: kind, t: 0, cb }; G.Sound.sfx('ability'); G.Sound.duck(0.2, 4); }
  function openShop() { modal = { kind: 'shop', sel: 0, t: 0, msg: '' }; }
  function pause() { modal = { kind: 'pause', sel: 0, t: 0 }; G.Sound.sfx('ui_select'); }
  function map() { modal = { kind: 'map', t: 0 }; G.Sound.sfx('ui_move'); }
  function settings(back) { modal = { kind: 'settings', sel: 0, t: 0, back }; G.Sound.sfx('ui_select'); }
  function settingRows() {
    const r = [{ k: 'music' }, { k: 'sfx' }, { k: 'shake' }];
    if (!I.isTouch) { r.push({ k: 'mouse' }); for (const a of I.ACTIONS) r.push({ k: 'bind', a }); r.push({ k: 'reset' }); }
    r.push({ k: 'back' }); return r;
  }
  function settingAct(row, dir) {   // dir: +1/-1 from left/right, 0 = confirm
    const S = SET;
    if (row.k === 'music' || row.k === 'sfx') { S[row.k] = clamp(S[row.k] + (dir || 1), 0, 10); if (!dir && S[row.k] === 10 && dir === 0) { } saveSettings(); G.Sound.sfx('ui_move'); }
    else if (row.k === 'shake' || row.k === 'mouse') { S[row.k] = S[row.k] ? 0 : 1; saveSettings(); G.Sound.sfx('ui_select'); }
    else if (row.k === 'bind' && !dir) { I.listen(row.a); G.Sound.sfx('ui_select'); }
    else if (row.k === 'reset' && !dir) { I.resetBinds(); Object.assign(S, { music: 7, sfx: 9, shake: 1, mouse: 1 }); saveSettings(); G.Sound.sfx('ui_select'); }
    else if (row.k === 'back' && !dir) closeSettings();
  }
  function closeSettings() { const m = modal; modal = m && m.back === 'pause' ? { kind: 'pause', sel: 2, t: 0.3 } : null; G.Sound.sfx('ui_move'); }
  function confirmP() { return I.p('jump') || I.p('attack') || I.p('confirm') || I.p('interact'); }
  function update(dt) {
    if (!modal) { for (const t of toasts) t.t += dt; toasts = toasts.filter(t => t.t < t.dur); }   // messages wait while a window is open
    if (!modal) return false;
    modal.t += dt; const m = modal;
    if (m.kind === 'talk') {
      m.T = (m.T || 0) + dt;
      if (m.t > 0.2 && confirmP()) advanceTalk(m);
    } else if (m.kind === 'ability') {
      if (m.t > 1.4 && (confirmP() || I.tap())) { modal = null; G.Sound.sfx('ui_select'); if (m.cb) m.cb(); }
    } else if (m.kind === 'shop') {
      const items = G.TEXT.shop; const n = items.length + 1;
      if (I.p('down')) { m.sel = (m.sel + 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('up')) { m.sel = (m.sel + n - 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('pause') || I.p('dash')) { modal = null; return true; }
      if (m.t > 0.2 && confirmP()) buy(m.sel);
    } else if (m.kind === 'settings') {
      if (I.listening) return true;   // waiting for the new key
      const rows = settingRows(), n = rows.length;
      if (I.p('down')) { m.sel = (m.sel + 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('up')) { m.sel = (m.sel + n - 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('left') || I.p('right')) { const r = rows[m.sel]; if (r.k === 'music' || r.k === 'sfx') settingAct(r, I.p('right') ? 1 : -1); }
      if ((I.p('pause') || I.p('map')) && m.t > 0.15) { I.consume('pause'); closeSettings(); return true; }
      if (m.t > 0.15 && (I.p('jump') || I.p('confirm') || I.p('interact'))) settingAct(rows[m.sel], 0);
    } else if (m.kind === 'pause') {
      const n = 4;
      if (I.p('down')) { m.sel = (m.sel + 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('up')) { m.sel = (m.sel + n - 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('pause') && m.t > 0.1) { modal = null; return true; }
      if (m.t > 0.15 && confirmP()) pauseSelect(m.sel);
    } else if (m.kind === 'map') {
      if ((I.p('map') || I.p('pause')) && m.t > 0.1) { modal = null; I.consume('pause'); }
      else if (m.t > 0.15 && (I.p('jump') || I.p('confirm') || I.p('interact'))) travel();
      else if ((I.p('left') || I.p('right')) && m.ws && m.ws.length > 1) { const i = m.ws.indexOf(m.w); m.w = m.ws[(i + (I.p('left') ? 1 : m.ws.length - 1)) % m.ws.length]; G.Sound.sfx('ui_move'); }
    } else if (m.kind === 'travel') {
      const E = m.E; if (!E.length) { if ((confirmP() || I.p('pause') || I.p('map')) && m.t > 0.15) { modal = { kind: 'map', t: 0.3 }; I.consume('pause'); } return true; }
      const col = E[m.c].col;
      if (I.p('down')) { m.r = (m.r + 1) % col.length; G.Sound.sfx('ui_move'); }
      if (I.p('up')) { m.r = (m.r + col.length - 1) % col.length; G.Sound.sfx('ui_move'); }
      if (I.p('left') || I.p('right')) { m.c = (m.c + (I.p('left') ? 1 : E.length - 1)) % E.length; m.r = Math.min(m.r, E[m.c].col.length - 1); G.Sound.sfx('ui_move'); }
      if ((I.p('pause') || I.p('map')) && m.t > 0.1) { modal = { kind: 'map', t: 0.3 }; I.consume('pause'); }
      else if (m.t > 0.2 && (I.p('jump') || I.p('confirm') || I.p('interact'))) goTravel(E[m.c].col[m.r]);
    } else if (m.kind === 'profiles') {
      const n = m.rows.length;
      if (I.p('down')) { m.sel = (m.sel + 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('up')) { m.sel = (m.sel + n - 1) % n; G.Sound.sfx('ui_move'); }
      if (I.p('pause') && m.t > 0.1) { modal = null; I.consume('pause'); }
      else if (m.t > 0.2 && (I.p('jump') || I.p('confirm') || I.p('interact'))) m.rows[m.sel].go();
    } else if (m.kind === 'name') {
    }
    return true;
  }
  function pauseSelect(i) {
    G.Sound.sfx('ui_select');
    if (i === 0) modal = null;
    else if (i === 1) modal = { kind: 'map', t: 0 };
    else if (i === 2) settings('pause');
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
      // no box: the bottom of the screen sinks into shadow and the words rise out of it, revealed like a candle-lit page
      const A = Math.min(1, (m.T || 0) * 3.5), full = m.lines[m.i] || '', shown = full.slice(0, Math.floor(m.t * 55));
      const tw = Math.min(900, VW - 220), lines = wrap(c, full, tw, 31), LH = 48;
      const blockH = lines.length * LH + (m.name ? 62 : 0), y0 = VH - 70 - blockH;
      const g = c.createLinearGradient(0, y0 - 120, 0, VH); g.addColorStop(0, 'rgba(5,4,7,0)'); g.addColorStop(0.45, `rgba(5,4,7,${0.62 * A})`); g.addColorStop(1, `rgba(5,4,7,${0.86 * A})`);
      c.fillStyle = g; c.fillRect(0, y0 - 120, VW, VH - y0 + 120);
      let ty = y0;
      if (m.name) {
        text(c, m.name, VW / 2, ty + 4, { size: 34, title: true, w: 600, c: '#f3cf92', blur: 14, a: A });
        ornament(c, VW / 2, ty + 34, 300, A * 0.9);
        ty += 62;
      }
      // reveal the line letter by letter, keeping each wrapped line in place
      let left = shown.length;
      lines.forEach((l, k) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1;
        if (part) text(c, part, VW / 2 + (c.measureText ? 0 : 0), ty + k * LH + 20, { size: 31, c: '#f2e8d8', blur: 10, a: A, align: 'center' }); });
      if (shown.length >= full.length) G.FX.flame(c, VW / 2, VH - 30, 2.2, m.T * 1.3, { glow: 0.5 });
      tapRegion(0, 0, VW, VH, () => advanceTalk(m));
    } else if (m.kind === 'ability') {
      const a = Math.min(1, m.t * 1.5); const ab = G.TEXT.abil[m.ab];
      c.fillStyle = `rgba(0,0,0,${0.75 * a})`; c.fillRect(0, 0, VW, VH);
      G.FX.glow(c, VW / 2, VH * 0.4, 400 * a, [255, 170, 90], 0.5 * a);
      G.FX.flame(c, VW / 2, VH * 0.42, 14 * a, m.t * 1.2, { glow: 1.5 });
      text(c, ab[0], VW / 2, VH * 0.56, { size: 72, w: 600, title: true, a });
      ornament(c, VW / 2, VH * 0.56 + 54, 480, a);
      text(c, ab[1], VW / 2, VH * 0.56 + 100, { size: 30, a: a * 0.9 });
      if (ab[2]) text(c, ab[2], VW / 2, VH * 0.56 + 150, { size: 24, a: a * 0.6, c: '#d9b88f' });
      tapRegion(0, 0, VW, VH, () => { if (m.t > 1.4) { modal = null; if (m.cb) m.cb(); } });
    } else if (m.kind === 'shop') {
      const items = G.TEXT.shop, w = Math.min(900, VW - 60), h = 120 + items.length * 74 + 80, x = (VW - w) / 2, y = (VH - h) / 2;
      panel(c, x, y, w, h, 0.93);
      text(c, G.T('shop_title'), VW / 2, y + 44, { size: 40, w: 600, title: true, c: '#f0d9b5' }); ornament(c, VW / 2, y + 78, 360);
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
      text(c, G.T('paused'), VW / 2, VH * 0.18, { size: 64, w: 600, title: true }); ornament(c, VW / 2, VH * 0.18 + 50, 360);
      const opts = [G.T('resume'), G.T('mapt'), G.T('settings'), G.T('quit')];
      opts.forEach((o, i) => { const yy = VH * 0.36 + i * 70; text(c, o, VW / 2, yy, { size: 36, c: m.sel === i ? '#ffe2b8' : '#cfc4b4' }); if (m.sel === i) { G.FX.flame(c, VW / 2 + 150, yy + 12, 3, m.t, {}); G.FX.flame(c, VW / 2 - 150, yy + 12, 3, m.t + 2, {}); } tapRegion(VW / 2 - 200, yy - 30, 400, 60, () => { m.sel = i; pauseSelect(i); }); });
    } else if (m.kind === 'map') drawMap(c, m);
    else if (m.kind === 'settings') drawSettings(c, m);
    else if (m.kind === 'travel') drawTravel(c, m);
    else if (m.kind === 'profiles') drawProfiles(c, m);
  }
  const ACT_NAME = { left: 'הליכה שמאלה', right: 'הליכה ימינה', up: 'למעלה (מכה למעלה)', down: 'למטה (מכה למטה באוויר)', jump: 'קפיצה (פעמיים: קפיצה כפולה)',
    attack: 'מכה', dash: 'זינוק', focus: 'ריפוי (החזקה) / להבה (הקשה)', interact: 'דיבור · קריאה · פתיחה', map: 'מפה', dance: 'ריקוד', pause: 'תפריט' };
  function drawSettings(c, m) {
    const VW = R().VW, VH = R().VH, rows = settingRows(), touch = I.isTouch;
    c.fillStyle = 'rgba(4,3,6,0.72)'; c.fillRect(0, 0, VW, VH);
    const w = Math.min(1180, VW - 60), h = Math.min(VH - 50, touch ? 420 : 660), x = (VW - w) / 2, y = (VH - h) / 2 + 10;
    panel(c, x, y, w, h, 0.95);
    text(c, G.T('settings'), VW / 2, y + 52, { size: 42, w: 600, title: true, c: '#f3dfbf' });
    // right column (first in Hebrew): sound, shake, mouse, reset, back - left column: the key for every action
    const colR = touch ? x + w / 2 + 230 : x + w - 50, colW = touch ? 460 : w * 0.38, colL = x + w * 0.56;
    const rowY = (i) => y + 120 + i * 58;
    let gi = 0, bi = 0;
    rows.forEach((r, i) => {
      const sel = m.sel === i, col = sel ? '#ffe2b8' : '#d6cab8';
      let ry, rx, rw;
      if (r.k === 'bind') { ry = y + 112 + bi * 40; rx = colL; rw = colL - (x + 40); bi++;
        if (sel) { c.fillStyle = 'rgba(255,200,140,0.10)'; c.beginPath(); c.roundRect(x + 30, ry - 18, rw + 20, 36, 8); c.fill(); }
        text(c, ACT_NAME[r.a], rx, ry, { size: 21, align: 'right', c: col, blur: 0 });
        const B = I.binds()[r.a], listen = I.listening === r.a;
        let ks = listen ? 'לחץ על מקש…' : B.map(I.keyName).join('  ·  ');
        if (!listen && SET.mouse && r.a === 'attack') ks += '  ·  עכבר שמאלי'; if (!listen && SET.mouse && r.a === 'dash') ks += '  ·  עכבר ימני';
        text(c, ks, x + 50, ry, { size: 20, align: 'left', c: listen ? '#ffd27a' : '#f0d9b5', blur: 0 });
        tapRegion(x + 30, ry - 18, rw + 20, 36, () => { m.sel = i; settingAct(r, 0); });
        return;
      }
      ry = r.k === 'back' || r.k === 'reset' ? y + h - (r.k === 'back' ? 50 : 110) : rowY(gi++); rx = colR; rw = colW;
      if (sel) { c.fillStyle = 'rgba(255,200,140,0.10)'; c.beginPath(); c.roundRect(rx - rw, ry - 24, rw + 20, 48, 10); c.fill(); }
      if (r.k === 'music' || r.k === 'sfx') {
        text(c, r.k === 'music' ? 'מוזיקה' : 'צלילים', rx, ry, { size: 26, align: 'right', c: col, blur: 0 });
        const bx = rx - rw + 20, bw = rw * 0.5, v = SET[r.k] / 10;
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.roundRect(bx, ry - 4, bw, 8, 4); c.fill();
        c.fillStyle = '#e8b878'; c.beginPath(); c.roundRect(bx, ry - 4, bw * v, 8, 4); c.fill();
        c.fillStyle = '#ffe2b8'; c.beginPath(); c.arc(bx + bw * v, ry, 10, 0, 7); c.fill();
        tapRegion(bx - 10, ry - 22, bw + 20, 44, () => { m.sel = i; const p = I.tapPos(), sc = R().scale, dpr = R().cv.width / innerWidth, lx = p.x * dpr / sc; SET[r.k] = clamp(Math.round((lx - bx) / bw * 10), 0, 10); saveSettings(); });
      } else if (r.k === 'shake' || r.k === 'mouse') {
        text(c, r.k === 'shake' ? 'רעידות מסך' : 'עכבר: שמאלי מכה, ימני זינוק', rx, ry, { size: 24, align: 'right', c: col, blur: 0 });
        const on = !!SET[r.k], tx = rx - rw + 20;
        c.fillStyle = on ? 'rgba(232,184,120,0.9)' : 'rgba(255,255,255,0.15)'; c.beginPath(); c.roundRect(tx, ry - 13, 52, 26, 13); c.fill();
        c.fillStyle = '#fff3e0'; c.beginPath(); c.arc(tx + (on ? 39 : 13), ry, 10, 0, 7); c.fill();
        tapRegion(rx - rw, ry - 24, rw + 20, 48, () => { m.sel = i; settingAct(r, 0); });
      } else {
        text(c, r.k === 'reset' ? 'איפוס לברירת המחדל' : 'חזרה', rx - rw / 2 + 10, ry, { size: 26, c: col, blur: 0 });
        tapRegion(rx - rw, ry - 24, rw + 20, 48, () => { m.sel = i; settingAct(r, 0); });
      }
    });
    if (touch) G.TEXT.keys_touch.forEach((k, i) => { const yy = rowY(3) + 10 + i * 34; text(c, k[1], colR, yy, { size: 20, align: 'right', a: 0.8, blur: 0 }); text(c, k[0], colR - colW + 20, yy, { size: 20, align: 'left', c: '#f0d9b5', blur: 0 }); });
    else text(c, 'לשינוי מקש: בחר פעולה ולחץ על המקש החדש', x + w * 0.3, y + h - 30, { size: 17, a: 0.55, blur: 0 });
  }
  let mapCanvas = null, mapInfo = null;
  // ---------- users ----------
  function profiles() {
    const P = G.Main.PROF, rows = [];
    for (const p of P.list) rows.push({ label: (P.cur && P.cur.id === p.id ? '✦ ' : '') + p.name, go: () => { P.select(p.id); modal = null; G.Sound.sfx('ui_select'); } });
    rows.push({ label: '+ ' + G.T('new_user'), go: () => askName(n => { P.create(n); }) });
    if (P.cur) rows.push({ label: 'מחיקת המשתמש "' + P.cur.name + '"', del: true, go: () => { const r = modal.rows[modal.sel]; if (!r.sure) { r.sure = true; r.label = 'בטוח? כל השמירות שלו יימחקו — לחץ שוב'; return; } P.remove(P.cur.id); modal = null; } });
    rows.push({ label: 'חזרה', go: () => { modal = null; } });
    modal = { kind: 'profiles', rows, sel: 0, t: 0 }; G.Sound.sfx('ui_select');
  }
  function askName(cb) {   // a real text field over the canvas, so any keyboard (Hebrew too) can type a name
    if (document.getElementById('nameBox')) return;
    const w = document.createElement('div'); w.id = 'nameBox';
    w.innerHTML = '<div class="nb"><div class="nbT">איך קוראים לך?</div><input maxlength="18" dir="rtl" autocomplete="off" spellcheck="false"><div class="nbB"><button data-a="ok">יצירה</button><button data-a="no">ביטול</button></div></div>';
    document.body.appendChild(w); const inp = w.querySelector('input'); setTimeout(() => inp.focus(), 40);
    modal = { kind: 'name', t: 0 };
    const done = ok => { const v = inp.value.trim(); w.remove(); modal = null; if (ok && v) { cb(v); G.Sound.sfx('ui_select'); } };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
    w.querySelector('[data-a=ok]').onclick = () => done(true); w.querySelector('[data-a=no]').onclick = () => done(false);
  }
  function drawProfiles(c, m) {
    const VW = R().VW, VH = R().VH, w = Math.min(620, VW - 60), h = 150 + m.rows.length * 62, x = (VW - w) / 2, y = (VH - h) / 2;
    c.fillStyle = 'rgba(4,3,6,0.6)'; c.fillRect(0, 0, VW, VH); panel(c, x, y, w, h, 0.95);
    text(c, 'משתמשים', VW / 2, y + 52, { size: 40, w: 600, title: true, c: '#f3dfbf' });
    m.rows.forEach((r, i) => { const yy = y + 120 + i * 62, sel = m.sel === i;
      if (sel) { c.fillStyle = 'rgba(255,200,140,0.10)'; c.beginPath(); c.roundRect(x + 40, yy - 25, w - 80, 50, 12); c.fill(); }
      text(c, r.label, VW / 2, yy, { size: r.del ? 22 : 28, c: r.del ? (r.sure ? '#ff9a7a' : '#c98a7a') : sel ? '#ffe2b8' : '#d6cab8', blur: 0 });
      tapRegion(x + 40, yy - 25, w - 80, 50, () => { m.sel = i; r.go(); }); });
  }
  // ---------- fast travel ----------
  function travelEntries() {
    const S = G.state, W = window.WORLD, out = [];
    for (const wk of Object.keys(W.worlds)) {
      const col = [], bosses = [];
      for (const id in W.rooms) { const r = W.rooms[id]; if (r.world !== wk) continue;
        for (const e of r.ents) {
          if (e.t === 'bench' && (S.spect || (S.benches && S.benches[id]) || S.benchRoom === id)) col.push({ id, x: e.x, y: e.y, label: r.name || W.areas[r.area].name, kind: 'bench', area: r.area });
          if (e.t === 'boss' && S.spect) bosses.push({ id, x: 4, label: G.TEXT.bosses[e.kind][0], kind: 'boss', area: r.area, done: !!S.bosses[e.kind] });
        } }
      const all = col.concat(bosses); if (all.length) out.push({ w: wk, name: W.worlds[wk].name, col: all });
    }
    return out;
  }
  function travel() { const E = travelEntries(), here = G.Main.room ? G.Main.room.world : null; let c0 = Math.max(0, E.findIndex(e => e.w === here));
    modal = { kind: 'travel', E, c: c0, r: 0, t: 0 }; G.Sound.sfx('ui_select'); }
  function goTravel(e) { if (!e) return; if (e.kind === 'bench') G.Main.travelTo(e.id, e.x, e.y); else G.Main.travelTo(e.id, e.x); }
  function drawTravel(c, m) {
    const VW = R().VW, VH = R().VH, E = m.E, AC = MAPC;
    c.fillStyle = 'rgba(4,3,6,0.82)'; c.fillRect(0, 0, VW, VH);
    const n = Math.max(1, E.length), rows = Math.max(1, ...E.map(e => e.col.length));
    const w = Math.min(1240, VW - 50), h = Math.min(VH - 40, 170 + rows * 38), x = (VW - w) / 2, y = (VH - h) / 2;
    panel(c, x, y, w, h, 0.96);
    text(c, G.T('travel'), VW / 2, y + 50, { size: 40, w: 600, title: true, c: '#f3dfbf' });
    if (!E.length) { text(c, 'עוד לא נחת ליד אף מזבח. שב ליד מזבח (נרות) כדי שתוכל לחזור אליו מכל מקום.', VW / 2, y + h / 2 + 10, { size: 22, c: '#d6cab8', blur: 0 }); return; }
    const cw = (w - 40) / n;
    E.forEach((col, ci) => { const cx = x + w - 20 - ci * cw - cw / 2;   // first world on the right
      text(c, col.name, cx, y + 104, { size: 24, w: 600, title: true, c: '#f0cf98', blur: 0 }); ornament(c, cx, y + 124, Math.min(200, cw - 30), 0.7);
      col.col.forEach((e, ri) => { const yy = y + 158 + ri * 36, sel = m.c === ci && m.r === ri, here = G.Main.room && G.Main.room.id === e.id;
        if (sel) { c.fillStyle = 'rgba(255,200,140,0.12)'; c.beginPath(); c.roundRect(cx - cw / 2 + 10, yy - 16, cw - 20, 32, 8); c.fill(); }
        const ic = e.kind === 'bench' ? '🕯' : e.done ? '✓' : '✕';
        text(c, ic, cx + cw / 2 - 30, yy, { size: 16, c: e.kind === 'boss' ? (e.done ? '#bfa46a' : '#ff7a5a') : '#ffd08a', blur: 0 });
        text(c, e.label + (here ? '  •' : ''), cx + cw / 2 - 52, yy, { size: 19, align: 'right', c: sel ? '#ffe2b8' : e.kind === 'boss' ? '#d9b8a8' : AC[e.area] || '#d6cab8', blur: 0 });
        tapRegion(cx - cw / 2 + 10, yy - 16, cw - 20, 32, () => { m.c = ci; m.r = ri; goTravel(e); }); });
    });
    text(c, '[Enter] קפיצה   ·   [← →] עולם   ·   [Esc] חזרה למפה', VW / 2, y + h - 26, { size: 17, a: 0.55, blur: 0 });
  }
  // ---------- map ----------
  const MAPC = { crypts: '#d9a274', gardens: '#7fd8b4', nave: '#86a6ea', spire: '#c9a6f4', hearth: '#e98058', shore: '#ff9f60', galleon: '#b0a2ea', lighthouse: '#ffc878', paper: '#f2e6cc', clock: '#e6c878', core: '#ffb868', theatre: '#ea7484' };
  function touching(a, b) { return a.gx <= b.gx + b.w && a.gx + a.w >= b.gx && a.gy <= b.gy + b.h && a.gy + a.h >= b.gy; }
  function drawMap(c, m) {
    const VW = R().VW, VH = R().VH, S = G.state, W = window.WORLD, t = m.t;
    m.ws = Object.keys(W.worlds).filter(wk => Object.keys(W.rooms).some(id => W.rooms[id].world === wk && S.visited[id]));
    if (!m.w) m.w = G.Main.room ? G.Main.room.world : 'lumen'; if (m.ws.length && !m.ws.includes(m.w)) m.w = m.ws[0];
    const curW = m.w;
    const bg = c.createRadialGradient(VW / 2, VH / 2, VH * 0.15, VW / 2, VH / 2, VW * 0.75); bg.addColorStop(0, '#1a1418'); bg.addColorStop(1, '#050406');
    c.fillStyle = bg; c.fillRect(0, 0, VW, VH);
    const all = Object.entries(W.rooms).filter(([, r]) => r.world === curW), shown = all.filter(([id]) => S.visited[id]);
    const ghosts = all.filter(([id, r]) => !S.visited[id] && shown.some(([, o]) => touching(o, r)));   // the next rooms you could walk into
    const B = shown.length ? shown.concat(ghosts) : all; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [, r] of B) { x0 = Math.min(x0, r.gx); y0 = Math.min(y0, r.gy); x1 = Math.max(x1, r.gx + r.w); y1 = Math.max(y1, r.gy + r.h); }
    const sc = Math.min(13, (VW - 160) / (x1 - x0), (VH - 250) / (y1 - y0));
    const ox = (VW - (x1 - x0) * sc) / 2 - x0 * sc, oy = 135 + (VH - 245 - (y1 - y0) * sc) / 2 - y0 * sc;
    // title + worlds
    text(c, W.worlds[curW].name, VW / 2, 56, { size: 44, w: 600, title: true, c: '#f6e6cc' });
    text(c, W.worlds[curW].en, VW / 2, 92, { size: 13, en: true, spacing: 8, a: 0.6, c: '#e2cfae' }); ornament(c, VW / 2, 110, 280, 0.8);
    if (m.ws.length > 1) { text(c, '›', VW / 2 + 230, 58, { size: 40, a: 0.6 }); text(c, '‹', VW / 2 - 230, 58, { size: 40, a: 0.6 });
      tapRegion(VW / 2 + 190, 20, 80, 70, () => { const i = m.ws.indexOf(m.w); m.w = m.ws[(i + m.ws.length - 1) % m.ws.length]; });
      tapRegion(VW / 2 - 270, 20, 80, 70, () => { const i = m.ws.indexOf(m.w); m.w = m.ws[(i + 1) % m.ws.length]; }); }
    // unexplored neighbours: a faint dashed outline with a question mark
    c.save(); c.setLineDash([6, 6]); c.strokeStyle = 'rgba(230,210,180,0.22)'; c.lineWidth = 1.5;
    for (const [, r] of ghosts) { c.beginPath(); c.roundRect(ox + r.gx * sc, oy + r.gy * sc, r.w * sc, r.h * sc, 6); c.stroke();
      text(c, '?', ox + (r.gx + r.w / 2) * sc, oy + (r.gy + r.h / 2) * sc, { size: Math.min(30, sc * 3), a: 0.3, blur: 0 }); }
    c.restore();
    // explored rooms: dark slab with a soft glow of the area colour, the walkable shape inside, a clean outline
    for (const [id, r] of shown) {
      const X = ox + r.gx * sc, Y = oy + r.gy * sc, cw = r.w * sc, ch = r.h * sc, col = MAPC[r.area] || '#ccc';
      c.save(); c.shadowColor = col; c.shadowBlur = 16; c.fillStyle = 'rgba(16,13,16,0.96)'; c.beginPath(); c.roundRect(X, Y, cw, ch, 5); c.fill(); c.restore();
      c.save(); c.beginPath(); c.roundRect(X, Y, cw, ch, 5); c.clip(); c.fillStyle = col; c.globalAlpha = 0.34; c.beginPath();   // one path, one fill: no seams
      for (let yy = 0; yy < r.h; yy++) { let run = -1; const row = r.rows[yy];
        for (let xx = 0; xx <= r.w; xx++) { const open = xx < r.w && row[xx] !== '#' && row[xx] !== 'x';
          if (open && run < 0) run = xx; if (!open && run >= 0) { c.rect(X + run * sc, Y + yy * sc, (xx - run) * sc + 0.5, sc + 0.5); run = -1; } } }
      c.fill(); c.restore();
      c.strokeStyle = col; c.globalAlpha = 0.85; c.lineWidth = 1.6; c.beginPath(); c.roundRect(X, Y, cw, ch, 5); c.stroke(); c.globalAlpha = 1;
      for (const e of r.ents) { const ex = X + e.x * sc, ey = Y + (e.y - 1) * sc;
        if (e.t === 'bench') { G.FX.glow(c, ex, ey, 16, [255, 190, 110], 0.7); G.FX.flame(c, ex, ey + 4, 1.5, t + e.x, { glow: 0.4 }); }
        else if (e.t === 'boss') { const done = S.bosses[e.kind]; c.fillStyle = done ? 'rgba(190,160,100,0.5)' : 'rgba(140,30,20,0.9)'; c.beginPath(); c.arc(ex, ey - 4, 9, 0, 7); c.fill();
          text(c, done ? '✓' : '✕', ex, ey - 3, { size: 13, c: done ? '#2a2016' : '#ffd8c8', blur: 0, w: 700 }); }
        else if (e.t === 'chest' && !S.picked[e.id]) { c.fillStyle = '#f0c060'; c.save(); c.translate(ex, ey); c.rotate(Math.PI / 4); c.fillRect(-4, -4, 8, 8); c.restore(); }
        else if (e.t === 'pickup' && !S.picked[e.id]) { G.FX.glow(c, ex, ey, 10, [255, 250, 230], 0.9); } }
    }
    // area names over their explored rooms
    const areas = {}; for (const [, r] of shown) { const a = areas[r.area] = areas[r.area] || { x: 0, y: 0, n: 0 }; a.x += r.gx + r.w / 2; a.y += r.gy + r.h / 2; a.n++; }
    for (const k in areas) { const a = areas[k]; text(c, W.areas[k].name, ox + a.x / a.n * sc, oy + a.y / a.n * sc, { size: 18, w: 600, c: MAPC[k], blur: 10, a: 0.95 }); }
    // you are here
    const room = G.Main.room, p = G.Main.player;
    if (room && p && room.world === curW) { const px = ox + (room.gx + p.cx / TILE) * sc, py = oy + (room.gy + p.cy / TILE) * sc;
      G.FX.glow(c, px, py, 34 + Math.sin(t * 4) * 6, [255, 190, 110], 0.9); c.fillStyle = '#fff4e0'; c.beginPath(); c.arc(px, py, 5.5, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,230,190,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py, 11 + (t * 14) % 14, 0, 7); c.globalAlpha = 1 - ((t * 14) % 14) / 14; c.stroke(); c.globalAlpha = 1; }
    // legend + travel button
    const ly = VH - 44; let lx = VW - 60;
    const leg = [['●', '#fff4e0', 'אתה כאן'], ['🕯', '#ffd08a', 'מזבח'], ['✕', '#ff7a5a', 'בוס'], ['◆', '#f0c060', 'תיבה'], ['?', '#cbbca6', 'לא נחקר']];
    for (const [ic, cl, lb] of leg) { text(c, ic, lx, ly, { size: 18, c: cl, blur: 0 }); text(c, lb, lx - 16, ly, { size: 17, align: 'right', a: 0.75, blur: 0 }); c.save(); c.font = `400 17px ${HE}`; lx -= c.measureText(lb).width + 64; c.restore(); }
    const bw = 230, bx = 50, by = VH - 66;
    c.fillStyle = 'rgba(255,200,140,0.14)'; c.beginPath(); c.roundRect(bx, by, bw, 44, 22); c.fill(); c.strokeStyle = 'rgba(240,214,170,0.45)'; c.lineWidth = 1; c.stroke();
    text(c, '✦ ' + G.T('travel') + '  [Enter]', bx + bw / 2, by + 22, { size: 20, c: '#ffe2b8', blur: 0 });
    tapRegion(bx, by, bw, 44, () => travel());
    text(c, '[Esc] סגירה', VW / 2, VH - 20, { size: 15, a: 0.45, blur: 0 });
  }
  function drawToasts(c) {
    if (modal) return;
    const VW = R().VW, VH = R().VH; let y = VH * 0.8;
    for (const t of toasts) { const a = Math.min(1, t.t * 4, (t.dur - t.t) * 2);
      const ls = wrap(c, t.s, Math.min(900, VW - 240), 25); c.save(); c.font = `400 25px ${HE}`; const w = Math.max(...ls.map(l => c.measureText(l).width)); c.restore();
      const hh = (ls.length - 1) * 38; shade(c, VW / 2, y - hh / 2, w * 0.7 + 60, 34 + hh * 0.7, 0.6 * a);
      ls.forEach((l, k) => text(c, l, VW / 2, y - hh + k * 38 + 1, { size: 25, a, c: '#f6e9d3', blur: 8 }));
      y -= hh + 52; }
  }
  return { clearTaps: () => { taps = []; }, hud, prompt, toast, tallowPing, areaCard, worldCard, bossCard, drawCard, talk, lore, ability, openShop, pause, map, settings, profiles, askName, travel, update, drawModal, drawToasts, handleTap, tapRegion, text, ornament, panel, wrap,
    get modal() { return modal; }, set modal(v) { modal = v; }, get card() { return card; }, HE, EN };
})();
