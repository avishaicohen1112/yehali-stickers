'use strict';
// Room objects: benches, NPCs, pickups, gates, projectiles, currency
G.Objects = (function () {
  let list = [], projs = [], coins = [];
  function clear() { list = []; projs = []; coins = []; }
  function add(o) { list.push(o); return o; }

  // ---------- projectiles ----------
  function spawnProj(p) { p.t = 0; p.g = p.g || 0; p.r = p.r || 12; p.life = p.life || 3; projs.push(p); return p; }
  function updateProjs(dt, room, player) {
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]; p.t += dt;
      if (!p.hold) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } else if (p.vx || p.vy) p.hold = false;
      if (p.update) p.update(p, dt);
      let kill = p.t > p.life;
      if (!p.ghost && room.solidAt(p.x, p.y)) kill = true;
      const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
      if (p.friendly) {
        p.hitset = p.hitset || new Set();
        for (const e of G.Main.enemies()) {
          if (e.dead || p.hitset.has(e) || !e.hurtbox) continue; const hb = e.hurtbox();
          if (hb && overlap(box, hb)) { p.hitset.add(e); e.hurt(p.dmg, sign(p.vx), 0, 'spell'); G.FX.burst(p.x, p.y, 16, { speed: 400, life: 0.4, size: 3, c: [255, 170, 80], kind: 'ember' }); G.Sound.sfx('explode', { vol: 0.6 }); }
        }
      } else if (!player.dead && overlap(box, player.hitbox())) { player.damage(p.dmg || 1, p.x); if (!p.pierce) kill = true; }
      // trail particles
      if (p.kind === 'bolt') { G.FX.spawn({ x: p.x - sign(p.vx) * rand(0, 20), y: p.y + rand(-10, 10), vx: -p.vx * 0.1, vy: rand(-60, 20), life: 0.4, size: rand(2, 4), kind: 'ember', c: [255, rand(120, 200) | 0, 60], add: true }); G.FX.light(p.x, p.y, 260, [255, 160, 70], 1); }
      else if (p.kind === 'spore') { if (Math.random() < 0.4) G.FX.spawn({ x: p.x, y: p.y, vx: 0, vy: -20, life: 0.5, size: 5, kind: 'smoke', c: [120, 255, 200], a: 0.25, add: true }); G.FX.light(p.x, p.y, 120, [120, 255, 200], 0.8); }
      else if (p.light) G.FX.light(p.x, p.y, p.light[3], p.light, 0.9);
      if (kill) {
        projs.splice(i, 1);
        const c = p.kind === 'bolt' ? [255, 160, 70] : p.kind === 'spore' ? [120, 255, 200] : p.c || [220, 200, 255];
        G.FX.burst(p.x, p.y, 10, { speed: 250, life: 0.35, size: 2.5, c, kind: 'spark' });
        if (p.kind === 'bolt') G.FX.ring(p.x, p.y, 5, 60, c, 0.25, 5);
      }
    }
  }
  function drawProjs(ctx, t) {
    for (const p of projs) {
      if (p.draw) { p.draw(ctx, p, t); continue; }
      if (p.kind === 'bolt') {
        const d = sign(p.vx);
        G.FX.glow(ctx, p.x, p.y, 90, [255, 140, 50], 0.9);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(p.x, p.y); ctx.scale(d, 1);
        const g = ctx.createLinearGradient(-80, 0, 20, 0); g.addColorStop(0, 'rgba(255,80,20,0)'); g.addColorStop(0.7, 'rgba(255,170,60,0.8)'); g.addColorStop(1, 'rgba(255,255,220,1)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(22, 0); ctx.quadraticCurveTo(0, -20 - Math.sin(t * 40) * 4, -80, -6); ctx.quadraticCurveTo(-30, 0, -80, 6); ctx.quadraticCurveTo(0, 20 + Math.sin(t * 37) * 4, 22, 0); ctx.fill();
        ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(8, 0, 9, 0, 7); ctx.fill(); ctx.restore();
      } else if (p.kind === 'spore') {
        G.FX.glow(ctx, p.x, p.y, 40, [120, 255, 200], 0.8);
        ctx.fillStyle = '#c8ffe8'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, 7); ctx.fill();
      } else if (p.kind === 'shard') {
        const a = Math.atan2(p.vy, p.vx); G.FX.glow(ctx, p.x, p.y, 40, [220, 180, 255], 0.7);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = 'rgba(240,225,255,0.95)'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(0, -6); ctx.lineTo(-18, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        const c = p.c || [255, 200, 150]; G.FX.glow(ctx, p.x, p.y, p.r * 3.5, c, 0.9);
        ctx.fillStyle = rgba([Math.min(255, c[0] + 60), Math.min(255, c[1] + 60), Math.min(255, c[2] + 60)], 1); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, 7); ctx.fill();
      }
    }
  }
  // ---------- tallow (currency) ----------
  function dropTallow(x, y, n) {
    let left = n;
    while (left > 0) { const v = left >= 5 ? 5 : 1; left -= v; coins.push({ x, y, vx: rand(-260, 260), vy: rand(-520, -220), v, t: 0, r: v === 5 ? 9 : 6, rest: false }); }
  }
  function updateCoins(dt, room, p) {
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]; c.t += dt;
      const dx = p.cx - c.x, dy = p.cy - c.y, d = Math.hypot(dx, dy);
      if (c.t > 0.5 && d < 160 && !p.dead) { c.vx += dx / d * 3000 * dt; c.vy += dy / d * 3000 * dt; c.vx *= 0.92; c.vy *= 0.92; c.x += c.vx * dt; c.y += c.vy * dt; }
      else {
        c.vy = Math.min(c.vy + 1800 * dt, 900);
        const b = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
        if (room.moveX(b, c.vx * dt)) c.vx *= -0.5;
        if (room.moveY(b, c.vy * dt) > 0) { if (Math.abs(c.vy) > 120) G.Sound.sfx('pickup', { vol: 0.15, pitch: 1.6 }); c.vy *= -0.35; c.vx *= 0.7; }
        c.x = b.x + c.r; c.y = b.y + c.r;
      }
      if (d < 34 && c.t > 0.3 && !p.dead) { G.state.tallow += c.v; coins.splice(i, 1); G.Sound.sfx('pickup', { pitch: rand(0.95, 1.2) }); G.FX.burst(c.x, c.y, 5, { speed: 120, life: 0.3, size: 2, c: [255, 230, 180], kind: 'spark' }); G.UI.tallowPing(); }
      else if (c.t > 40) coins.splice(i, 1);
    }
  }
  function drawCoins(ctx, t) {
    for (const c of coins) {
      G.FX.glow(ctx, c.x, c.y, c.r * 4, [255, 200, 120], 0.35);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.sin(c.t * 3 + c.x) * 0.4);
      const g = ctx.createRadialGradient(-c.r * 0.3, -c.r * 0.4, 1, 0, 0, c.r * 1.2); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#f0d9b0'); g.addColorStop(1, '#a8794a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -c.r * 1.3); ctx.bezierCurveTo(c.r, -c.r * 0.3, c.r, c.r, 0, c.r); ctx.bezierCurveTo(-c.r, c.r, -c.r, -c.r * 0.3, 0, -c.r * 1.3); ctx.fill();
      ctx.restore();
    }
  }

  // ---------- room objects ----------
  function build(room) {
    clear();
    const S = G.state;
    for (const e of room.ents) {
      const x = e.x * TILE, y = e.y * TILE;
      if (e.t === 'bench') add({ type: 'bench', x, y, w: 120, kind: e.kind || 'bench' });
      else if (e.t === 'npc') add({ type: 'npc', id: e.id, x, y, w: 110, talkI: 0 });
      else if (e.t === 'lore') add({ type: 'lore', text: e.text, x, y, w: 90 });
      else if (e.t === 'pickup') { const id = e.id || e.kind; if (!S.picked[id]) add({ type: 'pickup', kind: e.kind, id, x, y: y - 50, t: 0 }); }
      else if (e.t === 'brazier') add({ type: 'brazier', x, y });
      else if (e.t === 'chest') { const done = !!S.picked[e.id]; add({ type: 'chest', id: e.id, kind: e.kind || 'small', give: e.give, tallow: e.tallow ?? 25, x, y, w: 110, open: done, k: done ? 1 : 0, opening: 0 }); }
      else if (e.t === 'gate') add({ type: 'gate', id: e.id, tx: e.x, ty: e.y - e.h, h: e.h, req: e.req, closed: false, k: 0 });
      else if (e.t === 'seal') add({ type: 'seal', id: e.id, tx: e.x, ty: e.y === 0 ? 0 : e.y, w: e.w, closeOnBoss: e.closeOnBoss, req: e.req || 'vesper', closed: false, k: 0 });
      else if (e.t === 'portal') add({ type: 'portal', id: e.id, x, y, w: 140, to: e.to, tx: e.tx, ty: e.ty, req: e.req, t: 0 });
    }
    if (S.cinder && S.cinder.room === room.id) add({ type: 'cinder', x: S.cinder.x, y: S.cinder.y, t: 0 });
    // seals: s4 sealed until vesper defeated
    for (const o of list) { if (o.type === 'seal' && !o.closeOnBoss) setSeal(room, o, !S.bosses[o.req]); if (o.type === 'gate' && o.req) { setGate(room, o, !S.bosses[o.req]); o.k = o.closed ? 1 : 0; } }
  }
  function setGate(room, g, closed) {
    g.closed = closed;
    for (let j = 0; j < g.h; j++) { const k = g.tx + ',' + (g.ty + j); if (closed) room.over[k] = '#'; else delete room.over[k]; }
  }
  function setSeal(room, s, closed) {
    s.closed = closed; s.k = closed ? 1 : 0;
    for (let i = 0; i < s.w; i++) { const k = (s.tx + i) + ',' + s.ty; if (closed) room.over[k] = '#'; else delete room.over[k]; }
  }
  function lockArena(room, closed) {
    for (const o of list) {
      if (o.type === 'gate') setGate(room, o, closed || (o.req ? !G.state.bosses[o.req] : false));
      if (o.type === 'seal' && o.closeOnBoss) setSeal(room, o, closed);
    }
    if (closed) G.Sound.sfx('door');
  }
  function openSeals(room) { for (const o of list) if (o.type === 'seal') { setSeal(room, o, false); G.FX.burst((o.tx + o.w / 2) * TILE, o.ty * TILE + 25, 40, { speed: 500, life: 1, size: 4, c: [230, 210, 255], kind: 'shard', g: 1200, add: false }); } }

  let nearest = null;
  function update(dt, room, p) {
    const S = G.state; nearest = null; let nd = 1e9;
    for (const o of list) {
      o.t = (o.t || 0) + dt;
      if (o.type === 'gate') o.k = approach(o.k, o.closed ? 1 : 0, dt * 4);
      if (o.type === 'portal') { const open = !o.req || (Array.isArray(o.req) ? o.req.every(k => S.bosses[k]) : S.bosses[o.req]); o.open = open; if (open) { G.FX.light(o.x, o.y - 90, 380, [200, 170, 255], 1); if (Math.random() < dt * 30) G.FX.spawn({ x: o.x + rand(-50, 50), y: o.y - rand(20, 170), vx: 0, vy: rand(-60, -20), life: 1.4, size: rand(1.5, 3), kind: 'mote', ph: rand(6), a: 1, c: [215, 190, 255], add: true }); } }
      if (o.type === 'chest') updateChest(o, dt, p);
      if (o.type === 'bench' || o.type === 'npc' || o.type === 'lore' || o.type === 'portal' || (o.type === 'chest' && !o.open)) {
        const d = Math.abs(p.cx - o.x); if (d < o.w * 0.6 && Math.abs(p.feet - o.y) < 60 && d < nd) { nd = d; nearest = o; }
      }
      if (o.type === 'bench') G.FX.light(o.x, o.y - 70, 420, [255, 170, 90], 1);
      if (o.type === 'pickup') {
        G.FX.light(o.x, o.y, 260, [255, 230, 180], 1);
        if (Math.random() < dt * 8) G.FX.spawn({ x: o.x + rand(-20, 20), y: o.y + rand(-20, 20), vx: 0, vy: -40, life: 1, size: 2, kind: 'mote', ph: rand(6), c: [255, 240, 200], add: true });
        if (Math.hypot(p.cx - o.x, p.cy - o.y) < 60 && !p.dead) { o.dead = true; G.Main.grant(o.kind, o.id); }
      }
      if (o.type === 'cinder') {
        G.FX.light(o.x, o.y, 200, [200, 160, 255], 1);
        if (Math.hypot(p.cx - o.x, p.cy - o.y) < 70 && !p.dead) { o.dead = true; S.tallow += S.cinder.amount; G.Sound.sfx('heal'); G.UI.toast(G.T('cinder_back', S.cinder.amount)); S.cinder = null; G.FX.burst(o.x, o.y, 30, { speed: 300, life: 0.8, size: 3, c: [210, 180, 255], kind: 'ember' }); G.Main.save(); }
      }
      if (o.type === 'brazier') { const n = G.Main.flames(); for (let i = 0; i < 4; i++) if (i < n) G.FX.light(o.x - 75 + i * 50, o.y - 100, 180, [255, 160, 80], 1); }
    }
    list = list.filter(o => !o.dead);
    updateProjs(dt, room, p); updateCoins(dt, room, p);
  }
  function interact(p) {
    const o = nearest; if (!o) return;
    G.Input.consume('up'); G.Input.consume('interact');
    if (o.type === 'bench') G.Main.sitBench(o);
    else if (o.type === 'npc') G.UI.talk(o);
    else if (o.type === 'lore') G.UI.lore(o.text);
    else if (o.type === 'chest') openChest(o, p);
    else if (o.type === 'portal') { if (o.open) G.Main.portalTo(o.to, o.tx, o.ty); else { G.UI.toast(G.T('portal_sealed')); G.Sound.sfx('clank'); } }
  }
  // chests: hero kneels (anim 'open'), lid swings up, wax drops + an optional item spill out
  function openChest(o, p) {
    if (o.open || p.dead) return;
    o.open = true; o.opening = 0.001; G.state.picked[o.id] = true;
    p.facing = sign(o.x - p.cx) || p.facing; p.lock = 0.95; p.openT = 0.95; p.vx = 0;
    G.Sound.sfx('clank', { pitch: 0.8 });
  }
  function updateChest(o, dt, p) {
    if (o.k > 0) G.FX.light(o.x, o.y - 40, 160 + o.k * 120, [255, 200, 120], o.k);
    if (!o.opening) return;
    const t0 = o.opening; o.opening += dt;
    if (o.opening > 0.3) o.k = Math.min(1, o.k + dt * 3.2);
    if (t0 < 0.42 && o.opening >= 0.42) {
      G.Sound.sfx('heal', { pitch: 1.2 }); G.FX.flash('#ffe6b8', 0.12, 0.3);
      G.FX.burst(o.x, o.y - 40, 26, { speed: 320, life: 0.8, size: 3, c: [255, 215, 150], kind: 'ember', angle: -Math.PI / 2, spread: 0.9 });
      if (o.tallow) dropTallow(o.x, o.y - 50, o.tallow);
      if (o.give) G.Main.grant(o.give, o.id); else G.Main.save();
    }
    if (o.opening > 1.2) o.opening = 0;
  }
  function hit(hb, p) { return false; }
  function drawBack(ctx, t) {
    for (const o of list) {
      if (o.type === 'bench') G.Render.drawBench(ctx, o, t);
      else if (o.type === 'npc') G.Render.drawNPC(ctx, o, t);
      else if (o.type === 'lore') G.Render.drawLore(ctx, o, t);
      else if (o.type === 'brazier') G.Render.drawBrazier(ctx, o, t, G.Main.flames());
      else if (o.type === 'gate') G.Render.drawGate(ctx, o, t);
      else if (o.type === 'seal') G.Render.drawSeal(ctx, o, t);
      else if (o.type === 'portal') G.Render.drawPortal(ctx, o, t);
      else if (o.type === 'chest') G.Render.drawChest(ctx, o, t);
    }
  }
  function drawFront(ctx, t) {
    for (const o of list) {
      if (o.type === 'pickup') G.Render.drawPickup(ctx, o, t);
      else if (o.type === 'cinder') G.Render.drawCinder(ctx, o, t);
    }
    drawCoins(ctx, t); drawProjs(ctx, t);
  }
  return { build, update, interact, hit, spawnProj, dropTallow, drawBack, drawFront, lockArena, openSeals, nearest: () => nearest, list: () => list, clearProjs: () => { projs = []; } };
})();
