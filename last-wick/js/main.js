'use strict';
// Game state machine, loop, rooms, saving
G.Main = (function () {
  const SAVE_KEY = 'lastwick_save_v1';
  const Rn = G.Render, ctx = Rn.ctx;
  let mode = 'loading', room = null, player = null, enemies = [], boss = null, t = 0, modeT = 0;
  let fade = { a: 1, target: 0, speed: 2 }, trans = null, deathT = 0, bossT = 0, endT = 0, titleSel = 0, introI = 0;
  const params = new URLSearchParams(location.search);

  function freshState() {
    return { room: 'c1', benchRoom: 'c1', benchX: 6 * TILE, benchY: 15 * TILE, hp: 5, hpMax: 5, soul: 0, soulMax: 99, tallow: 0, needle: 1, spellMul: 1,
      abil: { dash: false, djump: false, wall: false, spell: false, glide: false, shadow: false }, bosses: {}, picked: {}, visited: {}, talked: {}, shop: {}, cinder: null,
      deaths: 0, time: 0, lastArea: null, muted: false, started: false };
  }
  G.state = freshState();
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); } catch (e) { } }
  function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) { G.state = Object.assign(freshState(), s); return true; } } catch (e) { } return false; }

  // ---------- asset loading ----------
  function roomImg(id) { const a = window.ROOMART[id]; if (a && a.img) G.Assets.load('room_' + id, a.img); }
  function areaImgs(area) { const b = window.BGS[area]; if (b) for (const L of b.layers) G.Assets.load('bg_' + area + '_' + L.id, L.img); }
  function neighbors(id) {
    const r = window.WORLD.rooms[id], out = [];
    for (const k in window.WORLD.rooms) { if (k === id) continue; const o = window.WORLD.rooms[k];
      if (o.gx <= r.gx + r.w && o.gx + o.w >= r.gx && o.gy <= r.gy + r.h && o.gy + o.h >= r.gy) out.push(k); }
    return out;
  }
  function preloadAll() {
    for (const a in window.ATLAS) G.Assets.load(a, 'assets/sprites/' + a + '.webp');
    for (const p in window.PROPS) G.Assets.load('prop_' + p, window.PROPS[p].img);
    for (const [k, src] of G.Scenery.images()) if (src) G.Assets.load(k, src);
    for (const r in (window.RIGS || {})) G.Assets.load(window.RIGS[r].atlas, window.RIGS[r].src);
    areaImgs('crypts');
    const s = hasSave() ? JSON.parse(localStorage.getItem(SAVE_KEY)).room : 'c1'; roomImg(s || 'c1');
  }

  // ---------- rooms ----------
  function enterRoom(id, px, py, keepVel) {
    const prev = room ? room.id : null;
    room = new G.World.Room(id); G.state.room = id; G.state.visited[id] = true;
    roomImg(id); areaImgs(room.area); for (const n of neighbors(id)) { roomImg(n); areaImgs(window.WORLD.rooms[n].area); }
    enemies = []; boss = null; G.FX.reset(); G.Objects.build(room); G.Main.bossCam = null;
    for (const e of room.ents) {
      if (e.t === 'enemy') { const en = new G.Enemies.Enemy(e.kind, e.x, e.y); enemies.push(en); }
      if (e.t === 'boss' && !G.state.bosses[e.kind]) { boss = G.Bosses.create(e.kind, e.x, e.y); if (boss) enemies.push(boss); }
    }
    const vx = player ? player.vx : 0, vy = player ? player.vy : 0, face = player ? player.facing : 1;
    player = new G.Player.Player(px, py); player.facing = face;
    if (keepVel) { player.vx = vx; player.vy = vy; }
    Rn.camUpdate(0, room, player, true);
    // area card + music
    if (G.state.lastWorld !== room.world) { G.UI.worldCard(room.world); G.state.lastWorld = room.world; G.state.lastArea = room.area; }
    else if (G.state.lastArea !== room.area) { G.UI.areaCard(room.area); G.state.lastArea = room.area; }
    if (!boss || !boss.active) G.Sound.music(musicFor(room.area));
    bossT = 0;
  }
  function checkTransition() {
    const p = player; if (trans || p.dead) return;
    let gx = null, gy = null, dir = null;
    if (p.cx < 0) { gx = room.gx - 0.5; gy = room.gy + p.cy / TILE; dir = 'W'; }
    else if (p.cx > room.pw) { gx = room.gx + room.w + 0.5; gy = room.gy + p.cy / TILE; dir = 'E'; }
    else if (p.y + p.h * 0.3 < 0) { gx = room.gx + p.cx / TILE; gy = room.gy - 0.5; dir = 'N'; }
    else if (p.y + p.h * 0.5 > room.ph) { gx = room.gx + p.cx / TILE; gy = room.gy + room.h + 0.5; dir = 'S'; }
    if (dir === null) return;
    const id = G.World.roomAt(Math.floor(gx), Math.floor(gy), room.world);
    if (!id) { // clamp back
      p.x = clamp(p.x, 0, room.pw - p.w); if (p.y > room.ph) { p.y = room.ph - p.h - 10; p.vy = -400; } return; }
    const R2 = window.WORLD.rooms[id];
    let lx = (gx - R2.gx) * TILE, ly = (gy - R2.gy) * TILE;
    if (dir === 'E') lx = 12; if (dir === 'W') lx = R2.w * TILE - 12;
    if (dir === 'N') ly = R2.h * TILE - 10; if (dir === 'S') ly = p.h + 4;
    const feetY = dir === 'E' || dir === 'W' ? ly + p.h / 2 : (dir === 'N' ? R2.h * TILE - 4 : ly);
    trans = { id, x: lx, y: feetY, dir, t: 0 };
    fade.target = 1; fade.speed = 5;
  }
  function doTransition() {
    const tr = trans; const vx = player.vx, vy = player.vy;
    enterRoom(tr.id, tr.x, tr.y, true);
    if (tr.dir === 'P') { player.vx = 0; player.vy = 0; save(); }
    if (tr.dir === 'N') { player.vy = Math.min(vy, -1050); }
    if (tr.dir === 'E' || tr.dir === 'W') { player.vy = Math.min(player.vy, 0); }
    trans = null; fade.target = 0; fade.speed = 4;
  }

  const MUSIC_FALLBACK = { shore: 'nave', galleon: 'crypts', lighthouse: 'spire', paper: 'gardens', clock: 'spire', core: 'hearth' };
  function musicFor(area) { const want = (window.WORLD.areas[area] || {}).music || area; const have = G.Sound.tracks ? G.Sound.tracks() : null; return have && have.indexOf(want) < 0 ? (MUSIC_FALLBACK[area] || 'crypts') : want; }
  function portalTo(id, tx, ty) {
    if (trans) return; G.Sound.sfx('ability', { vol: 0.6 }); G.FX.flash('#e8d8ff', 0.6, 0.8);
    trans = { id, x: tx * TILE, y: ty * TILE, dir: 'P', t: 0 }; fade.target = 1; fade.speed = 2.5;
  }
  // ---------- gameplay hooks ----------
  function hitPlayer(box, fromX) { if (!player.dead && overlap(box, player.hitbox())) player.damage(1, fromX); }
  function addEnemy(e) { enemies.push(e); }
  function flames() { const b = G.state.bosses; return ['knight', 'moth', 'angler', 'vesper'].filter(k => b[k]).length; }
  function grant(kind, id) {
    const S = G.state; if (id) S.picked[id] = true;
    if (kind === 'spell') S.abil.spell = true;
    if (kind === 'heart') { S.hpMax++; S.hp = S.hpMax; }
    if (kind === 'vessel') S.soulMax += 33;
    if (kind === 'dash') S.abil.dash = true;
    if (kind === 'djump') S.abil.djump = true;
    if (kind === 'wall') S.abil.wall = true;
    if (kind === 'moon') S.needle += 0.5;
    if (kind === 'glide') S.abil.glide = true;
    if (kind === 'shadow') S.abil.shadow = true;
    if (kind === 'spellup') { S.spellMul = Math.max(S.spellMul || 1, 1.8); S.abil.spell = true; }
    G.FX.flash('#fff2d8', 0.6, 0.8); G.FX.burst(player.cx, player.cy, 40, { speed: 500, life: 1, size: 3, c: [255, 220, 160], kind: 'ember' });
    G.UI.ability(kind, () => save());
    save();
  }
  function sitBench(o) {
    const S = G.state; player.sitting = true; player.x = o.x - player.w / 2; player.vx = 0;
    S.hp = S.hpMax; S.benchRoom = room.id; S.benchX = o.x; S.benchY = o.y; save();
    G.Sound.sfx('bench'); G.UI.toast(G.T('rest')); G.FX.burst(o.x, o.y - 100, 30, { speed: 200, life: 1.2, size: 2.5, c: [255, 200, 130], kind: 'ember' });
    // respawn enemies like a real rest
    enemies = enemies.filter(e => e.isBoss); for (const e of room.ents) if (e.t === 'enemy') enemies.push(new G.Enemies.Enemy(e.kind, e.x, e.y));
  }
  function onPlayerDeath() { deathT = 0; G.state.deaths++; G.Sound.music(null); }
  function respawn() {
    const S = G.state;
    if (S.tallow > 0) { S.cinder = { room: room.id, x: player.safe.x + player.w / 2, y: player.safe.y + player.h - 20, amount: S.tallow }; }
    const lost = S.tallow; S.tallow = 0; S.hp = S.hpMax; S.soul = 0;
    enterRoom(S.benchRoom, S.benchX, S.benchY);
    player.sitting = true; save();
    if (lost) G.UI.toast(G.T('lost', lost), 3.5);
    fade.a = 1; fade.target = 0; fade.speed = 1;
  }
  function startBoss() {
    boss.active = true; boss.set('wait'); G.Objects.lockArena(room, true);
    G.UI.bossCard(boss.kind); G.Sound.music(boss.kind === 'extinguisher' ? 'boss_final' : 'boss'); G.Sound.sfx('boss_roar'); G.FX.shake(14, 0.8);
  }
  function onBossDeath(b) { b.deathTimer = 0; }
  function bossAftermath(dt) {
    if (!boss || !boss.dead) return;
    boss.deathTimer += dt;
    if (boss.deathTimer > 3.2 && !boss.rewarded) {
      boss.rewarded = true; const S = G.state; S.bosses[boss.kind] = true;
      G.Objects.lockArena(room, false);
      enemies = enemies.filter(e => e !== boss);
      if (boss.kind === 'firstflame') { setMode('ending'); G.Sound.music('victory'); save(); return; }
      const reward = { knight: 'dash', moth: 'djump', angler: 'wall', vesper: 'moon', choir: 'heart', colossus: 'spellup', extinguisher: 'hearthlit', leviathan: 'glide', captain: 'shadow', keeper: 'heart', paperking: 'vessel', clockmaker: 'heart' }[boss.kind];
      for (const k in room.over) delete room.over[k]; G.Objects.build(room);
      if (boss.kind === 'vesper') G.Objects.openSeals(room);
      G.UI.toast(G.T('boss_defeated'), 3);
      grant(reward); G.Sound.music(room.area);
    }
  }

  // ---------- modes ----------
  function setMode(m) { mode = m; modeT = 0; G.Input.clear(); }
  function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } G.state = freshState(); G.state.muted = G.Sound.muted; setMode('intro'); introI = 0; G.Sound.music('title'); }
  function continueGame() { load(); if (G.state.muted !== G.Sound.muted) G.Sound.toggleMute(); startPlay(G.state.benchRoom, G.state.benchX, G.state.benchY, true); }
  function startPlay(id, x, y, sit) {
    G.state.lastArea = null; G.state.lastWorld = null; enterRoom(id, x, y); player.sitting = !!sit; setMode('play'); fade.a = 1; fade.target = 0; fade.speed = 0.8; G.state.started = true; save();
  }
  function toTitle() { save(); setMode('title'); G.Sound.music('title'); fade.a = 1; fade.target = 0; }
  function debugStart() {
    const S = G.state;
    if (params.get('abil') === 'all') { S.abil = { dash: true, djump: true, wall: true, spell: true, glide: true, shadow: true }; S.soul = 99; }
    if (params.get('boss') === 'dead') for (const k of ['knight', 'moth', 'angler', 'vesper']) S.bosses[k] = true;
    const id = params.get('room'); const r = window.WORLD.rooms[id];
    let x = (+params.get('x') || r.w / 2) * TILE, y = (+params.get('y') || 0) * TILE;
    const tmp = new G.World.Room(id); if (!params.get('y')) { for (let ty = 1; ty < r.h; ty++) if (tmp.solid(Math.floor(x / TILE), ty) && !tmp.solid(Math.floor(x / TILE), ty - 1)) { y = ty * TILE; } }
    startPlay(id, x, y, false);
  }

  // ---------- update ----------
  function update(dt) {
    t += dt; modeT += dt;
    G.Input.poll();
    fade.a = approach(fade.a, fade.target, fade.speed * dt);
    if (mode === 'loading') {
      if (G.Assets.progress() >= 1 && modeT > 0.5) { if (params.get('room')) debugStart(); else setMode('title'); }
    } else if (mode === 'title') updateTitle(dt);
    else if (mode === 'intro') updateIntro(dt);
    else if (mode === 'play') updatePlay(dt);
    else if (mode === 'ending') updateEnding(dt);
    G.UI.handleTap(); G.UI.clearTaps();
    G.Input.endFrame();
  }
  function updateTitle(dt) {
    G.FX.update(dt);
    if (Math.random() < dt * 20) G.FX.spawn({ x: rand(0, Rn.VW), y: Rn.VH + 10, vx: rand(-20, 20), vy: rand(-60, -20), life: rand(5, 10), size: rand(1, 2.5), kind: 'mote', ph: rand(6), a: rand(0.4, 0.9), c: [255, 170, 90], add: true });
    const opts = titleOpts(); const I = G.Input;
    if (I.p('down')) { titleSel = (titleSel + 1) % opts.length; G.Sound.sfx('ui_move'); }
    if (I.p('up')) { titleSel = (titleSel + opts.length - 1) % opts.length; G.Sound.sfx('ui_move'); }
    if (modeT > 0.4 && (I.p('jump') || I.p('attack') || I.p('confirm'))) { G.Sound.init(); G.Sound.sfx('ui_select'); opts[titleSel].go(); }
    if (modeT > 0.3 && !titleMusic) { titleMusic = true; G.Sound.music('title'); }
  }
  let titleMusic = false, controlsOpen = false;
  function titleOpts() {
    const o = [];
    if (hasSave()) o.push({ s: G.T('continue'), go: continueGame });
    o.push({ s: G.T('new_game'), go: newGame });
    o.push({ s: G.T('controls'), go: () => { controlsOpen = !controlsOpen; } });
    o.push({ s: G.T('sound') + ': ' + (G.Sound.muted ? G.T('off') : G.T('on')), go: () => { G.Sound.toggleMute(); } });
    return o;
  }
  function updateIntro(dt) {
    const I = G.Input;
    if (modeT > 0.8 && (I.p('jump') || I.p('attack') || I.p('confirm') || I.tap())) { introI++; modeT = 0; G.Sound.sfx('ui_move'); }
    if (modeT > 6) { introI++; modeT = 0.01; }
    if (introI >= G.TEXT.intro.length) startPlay('c1', 6 * TILE, 15 * TILE, true);
  }
  function updatePlay(dt) {
    if (trans) { if (fade.a >= 0.99) doTransition(); }
    if (G.UI.update(dt)) { G.FX.update(dt * 0.0); return; }
    const I = G.Input;
    if (I.p('pause')) { G.UI.pause(); return; }
    if (I.p('map')) { G.UI.map(); return; }
    if (G.FX.S.stop > 0) { G.FX.S.stop -= dt; return; }
    G.state.time += dt;
    G.FX.clearLights();
    Rn.roomLights(room, t);
    player.update(dt, room);
    // player light
    if (player.tip) { const S = G.state; const k = player.dead ? Math.max(0, 1 - player.deadT) : 0.6 + 0.4 * S.hp / S.hpMax; G.FX.light(player.tip.x, player.tip.y - 10, (360 + Math.sin(t * 13) * 8) * k * (player.focusing ? 1.3 : 1), [255, 170, 90], 1); }
    for (const e of enemies) e.update(dt, room, player);
    enemies = enemies.filter(e => !(e.dead && !e.isBoss && e.deadT > 0.5));
    if (boss && boss.dead) enemies = enemies.filter(e => !e.isPart);
    G.Objects.update(dt, room, player);
    // boss
    if (boss && !boss.active && !boss.dead && !player.dead) {
      bossT += dt; const inX = player.cx > 4 * TILE && player.cx < room.pw - 4 * TILE;
      if (inX && player.ground && bossT > 0.3) startBoss();
    }
    if (boss && boss.active && !boss.dead && boss.cx > 0) G.Main.bossCam = { x: lerp(player.cx, boss.cx, 0.25) };
    else G.Main.bossCam = null;
    bossAftermath(dt);
    G.FX.update(dt); Rn.ambient(dt, room);
    Rn.camUpdate(dt, room, player);
    checkTransition();
    if (player.dead) { deathT += dt; if (deathT > 1.8 && fade.target === 0) { fade.target = 1; fade.speed = 1.2; } if (deathT > 3) respawn(); }
  }
  function updateEnding(dt) {
    G.FX.update(dt);
    if (Math.random() < dt * 40) G.FX.spawn({ x: rand(0, Rn.VW), y: Rn.VH + 10, vx: rand(-20, 20), vy: rand(-90, -30), life: rand(5, 10), size: rand(1, 3), kind: 'mote', ph: rand(6), a: 1, c: [255, 190, 110], add: true });
    if (modeT > 26 && (G.Input.p('jump') || G.Input.p('attack') || G.Input.tap())) { toTitle(); }
  }

  // ---------- draw ----------
  function draw() {
    const sc = Rn.scale; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, Rn.cv.width, Rn.cv.height);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    if (mode === 'loading') drawLoading();
    else if (mode === 'title') drawTitle();
    else if (mode === 'intro') drawIntro();
    else if (mode === 'play') drawPlay();
    else if (mode === 'ending') drawEnding();
    if (fade.a > 0.001) { ctx.fillStyle = `rgba(3,2,5,${fade.a})`; ctx.fillRect(0, 0, Rn.VW + 2, Rn.VH + 2); }
  }
  function drawLoading() {
    const VW = Rn.VW, VH = Rn.VH;
    G.FX.flame(ctx, VW / 2, VH / 2, 8, t, {});
    G.UI.text(ctx, G.T('loading'), VW / 2, VH / 2 + 80, { size: 30, a: 0.8 });
    ctx.fillStyle = 'rgba(255,220,180,0.15)'; ctx.fillRect(VW / 2 - 150, VH / 2 + 120, 300, 3);
    ctx.fillStyle = 'rgba(255,220,180,0.8)'; ctx.fillRect(VW / 2 - 150, VH / 2 + 120, 300 * G.Assets.progress(), 3);
  }
  function drawTitleBG() {
    const VW = Rn.VW, VH = Rn.VH;
    const im = G.Assets.get('bg_crypts_far') || null;
    const tb = G.Assets.get('title_bg');
    if (tb) { const s = Math.max(VW / tb.width, VH / tb.height) * 1.06; const ox = (VW - tb.width * s) / 2 + Math.sin(t * 0.1) * 15, oy = (VH - tb.height * s) / 2; ctx.drawImage(tb, ox, oy, tb.width * s, tb.height * s); G.FX.flame(ctx, ox + 523.0 * s, oy + 521.6 * s + 4, 6 * s, t, { glow: 1.2 }); }
    else { Rn.drawBG({ area: 'crypts', pw: VW + 400, ph: VH }, t); }
    const g = ctx.createRadialGradient(VW / 2, VH * 0.42, 50, VW / 2, VH * 0.45, VW * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  function drawTitle() {
    const VW = Rn.VW, VH = Rn.VH; drawTitleBG();
    G.FX.drawParts(ctx, true);
    const a = Math.min(1, modeT * 0.8);
    G.FX.glow(ctx, VW / 2, VH * 0.27, 420, [255, 150, 70], 0.25 * a);
    G.FX.flame(ctx, VW / 2, VH * 0.17, 7, t, { glow: 1.4, alpha: a });
    G.UI.text(ctx, G.T('title'), VW / 2, VH * 0.3, { size: 120, w: 900, a, blur: 30, c: '#f6ecdf' });
    G.UI.text(ctx, G.T('subtitle'), VW / 2, VH * 0.3 + 92, { size: 30, en: true, a: a * 0.8, spacing: 14, c: '#d8c3a5' });
    G.UI.ornament(ctx, VW / 2, VH * 0.3 + 130, 520, a);
    const opts = titleOpts(); titleSel = Math.min(titleSel, opts.length - 1);
    opts.forEach((o, i) => { const y = VH * 0.58 + i * 62; const sel = i === titleSel;
      G.UI.text(ctx, o.s, VW / 2, y, { size: 36, a: a * (sel ? 1 : 0.6), c: sel ? '#ffe3bd' : '#e6dccd' });
      if (sel) { G.FX.flame(ctx, VW / 2 + 150, y + 14, 3.2, t + i, {}); G.FX.flame(ctx, VW / 2 - 150, y + 14, 3.2, t + i + 2, {}); }
      G.UI.tapRegion(VW / 2 - 200, y - 28, 400, 56, () => { G.Sound.init(); titleSel = i; G.Sound.sfx('ui_select'); o.go(); });
    });
    if (controlsOpen) {
      G.UI.panel(ctx, VW / 2 - 360, VH * 0.2, 720, VH * 0.62, 0.95);
      const keys = G.Input.isTouch ? G.TEXT.keys_touch : G.TEXT.keys;
      G.UI.text(ctx, G.T('controls'), VW / 2, VH * 0.2 + 50, { size: 40, w: 700 });
      keys.forEach((k, i) => { const y = VH * 0.2 + 120 + i * 46; G.UI.text(ctx, k[0], VW / 2 - 40, y, { size: 26, align: 'right', c: '#f0d9b5', en: /^[A-Za-z]/.test(k[0]) }); G.UI.text(ctx, k[1], VW / 2 + 300, y, { size: 26, align: 'right', a: 0.8 }); });
      G.UI.tapRegion(0, 0, VW, VH, () => { controlsOpen = false; });
    }
    G.UI.text(ctx, 'v1.0', VW - 40, VH - 26, { size: 16, en: true, a: 0.3, align: 'right' });
  }
  function drawIntro() {
    const VW = Rn.VW, VH = Rn.VH; ctx.fillStyle = '#030204'; ctx.fillRect(0, 0, VW, VH);
    const s = G.TEXT.intro[Math.min(introI, G.TEXT.intro.length - 1)]; const a = Math.min(1, modeT * 1.2) * Math.min(1, Math.max(0, 6 - modeT));
    const lines = G.UI.wrap(ctx, s, Math.min(1100, VW - 120), 40);
    lines.forEach((l, i) => G.UI.text(ctx, l, VW / 2, VH / 2 - (lines.length - 1) * 28 + i * 56, { size: 40, a }));
    if (introI === G.TEXT.intro.length - 1) G.FX.flame(ctx, VW / 2, VH / 2 - 90, 5 * a, t, { alpha: a });
  }
  function drawPlay() {
    const VW = Rn.VW, VH = Rn.VH, cam = Rn.cam;
    const sh = G.FX.S.shakeT > 0 ? G.FX.S.shake : 0;
    const sx = sh ? rand(-sh, sh) * 0.6 : 0, sy = sh ? rand(-sh, sh) * 0.6 : 0;
    ctx.save(); ctx.translate(sx, sy);
    Rn.drawBG(room, t);
    Rn.drawProps(room, 'back', t);
    Rn.drawTerrain(room);
    Rn.drawLighting(room, boss && boss.dark ? boss.dark : 0);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    G.Objects.drawBack(ctx, t);
    for (const e of enemies) if (!e.isBoss) e.draw(ctx, t);
    if (boss) boss.draw(ctx, t);
    player.draw(ctx);
    G.Objects.drawFront(ctx, t);
    G.FX.drawParts(ctx, false);
    ctx.restore();
    Rn.drawWater(room, t);
    Rn.drawFlames(room, t);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    for (const e of enemies) if (e.drawGlow) e.drawGlow(ctx);
    G.FX.drawParts(ctx, true); G.FX.drawRings(ctx); G.FX.drawSlashes(ctx);
    player.drawFlame(ctx, t);
    ctx.restore();
    Rn.drawProps(room, 'front', t);
    G.Scenery.drawFront(ctx, room, Rn.cam, VW, VH, t);
    Rn.drawFog(room, t);
    ctx.restore();
    if (G.FX.S.flashA > 0) { ctx.globalAlpha = G.FX.S.flashA; ctx.fillStyle = G.FX.S.flashC; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    if (player.dead) { const a = Math.min(1, player.deadT * 0.8); G.UI.text(ctx, G.T('died'), VW / 2, VH * 0.42, { size: 56, a: a * 0.9 }); G.UI.text(ctx, G.T('died2'), VW / 2, VH * 0.42 + 60, { size: 26, a: a * 0.6 }); }
    if (!G.UI.modal || G.UI.modal.kind === 'talk') G.UI.hud(ctx, t);
    G.UI.drawCard(ctx, 1 / 60);
    G.UI.drawToasts(ctx);
    G.UI.drawModal(ctx);
  }
  function drawEnding() {
    const VW = Rn.VW, VH = Rn.VH; ctx.fillStyle = '#0a0503'; ctx.fillRect(0, 0, VW, VH);
    const glowA = Math.min(1, modeT / 4);
    G.FX.glow(ctx, VW / 2, VH * 0.35, 700 * glowA, [255, 140, 60], 0.6); G.FX.flame(ctx, VW / 2, VH * 0.33, 22 * glowA, t, { glow: 2 });
    G.FX.drawParts(ctx, true);
    const L = G.TEXT.ending; const i = Math.min(L.length - 1, Math.floor(modeT / 5)); const k = modeT - i * 5;
    if (modeT < L.length * 5) { const a = Math.min(1, k) * Math.min(1, Math.max(0, 5 - k));
      G.UI.wrap(ctx, L[i], VW - 200, 38).forEach((l, j) => G.UI.text(ctx, l, VW / 2, VH * 0.6 + j * 52, { size: 38, a })); }
    else { const a = Math.min(1, modeT - L.length * 5);
      G.UI.text(ctx, G.T('title'), VW / 2, VH * 0.58, { size: 80, w: 900, a });
      G.UI.text(ctx, G.T('thanks'), VW / 2, VH * 0.58 + 70, { size: 32, a: a * 0.8 });
      const S = G.state, mm = Math.floor(S.time / 60), ss = Math.floor(S.time % 60);
      G.UI.text(ctx, `${G.T('stats_time')}: ${mm}:${String(ss).padStart(2, '0')}   ·   ${G.T('stats_deaths')}: ${S.deaths}`, VW / 2, VH * 0.58 + 130, { size: 24, a: a * 0.6 }); }
  }

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; acc += dt;
    const step = 1 / 60; let n = 0;
    while (acc >= step && n < 5) { if (!api.frozen) update(step); acc -= step; n++; }
    if (n === 5) acc = 0;
    draw();
    requestAnimationFrame(frame);
  }
  function boot() {
    G.Input.setupTouch(); preloadAll(); G.Assets.load('title_bg', 'assets/title.webp');
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.muted && !G.Sound.muted) G.Sound.toggleMute(); } catch (e) { }
    requestAnimationFrame(frame);
  }
  const api = {
    enemies: () => enemies, addEnemy, hitPlayer, grant, sitBench, onPlayerDeath, onBossDeath, save, flames, toTitle,
    fadeOut(s) { fade.target = 1; fade.speed = 1 / s; }, fadeIn(s) { fade.target = 0; fade.speed = 1 / s; },
    get player() { return player; }, get room() { return room; }, get boss() { return boss; }, get mode() { return mode; },
    bossCam: null, portalTo, musicFor, boot, enterRoom, setMode, frozen: false, step(n) { for (let i = 0; i < n; i++) update(1 / 60); }, get enemiesList() { return enemies; }
  };
  return api;
})();
G.Main.boot();
