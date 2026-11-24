'use strict';
// Wind: (1) ambient gusts in every room (particles blow across the view, scenery sways harder);
// (2) gale rooms: room ent {t:'wind', dir, v, on, off, x0, x1} - a pulsing gale that pushes the player.
//     Solid tiles just upwind shelter you (stand behind pillars). Holding into the wind = slow progress,
//     letting go = you get blown back.
G.Wind = (function () {
  const PCOL = { crypts: [210, 185, 150], gardens: [150, 235, 195], nave: [170, 195, 235], spire: [225, 205, 255], hearth: [255, 140, 80],
    shore: [205, 195, 185], galleon: [185, 165, 225], lighthouse: [225, 225, 240], paper: [245, 235, 215], clock: [245, 215, 150], core: [255, 220, 150] };
  let room = null, gale = null, galeK = 0, galeT = 0;
  let g = 0, gTarget = 0, wait = 6, hold = 0, dirA = 1;
  function enter(r) {
    room = r; gale = null; galeK = 0; galeT = 0; g = 0; gTarget = 0; wait = rand(3, 8);
    for (const e of r.ents) if (e.t === 'wind') gale = { dir: e.dir || 1, v: e.v || 560, on: e.on || 3.2, off: e.off || 1.6, x0: (e.x0 ?? 0) * TILE, x1: (e.x1 ?? r.w) * TILE };
    if (gale) galeK = 1;
  }
  function update(dt, cam, VW, VH) {
    if (!room) return;
    // ambient gust envelope: idle -> ramp up -> hold -> fade
    if (gTarget === 0) { wait -= dt; if (wait <= 0) { gTarget = rand(0.5, 1); hold = rand(1.2, 3); dirA = Math.random() < 0.5 ? -1 : 1; } }
    else { if (g >= gTarget - 0.02) { hold -= dt; if (hold <= 0) { gTarget = 0; wait = rand(6, 16); } } }
    g = approach(g, gTarget, dt * (gTarget ? 0.9 : 0.45));
    if (gale) {  // pulsing gale with a calm window
      galeT += dt; const c = gale.on + gale.off, l = galeT % c;
      galeK = approach(galeK, l < gale.on ? 1 : 0.12, dt * (l < gale.on ? 1.6 : 2.2));
    }
    // particles across the view, from the upwind edge
    const col = PCOL[room.area] || [220, 210, 200];
    const D = gale && galeK > 0.2 ? gale.dir : dirA, k = gale ? galeK : g;
    const rate = (gale ? galeK * 70 : g * 16);
    let n = rate * dt; while (n > 0) {
      if (Math.random() < n) {
        const streak = gale ? Math.random() < 0.55 : Math.random() < 0.25, sp = (gale ? 700 : 380) * rand(0.6, 1.2) * (0.5 + k * 0.5);
        G.FX.spawn({ x: cam.x + (D > 0 ? -20 : VW + 20) + rand(-40, 40) - D * rand(0, VW * 0.5), y: cam.y + rand(0, VH), vx: D * sp, vy: rand(-30, 40),
          life: rand(1.2, 2.2), size: streak ? rand(1, 1.8) : rand(1.5, 3), kind: streak ? 'streak' : 'mote', ph: rand(6), a: 0.55 * (0.4 + k * 0.6), c: col, add: true });
      }
      n -= 1;
    }
  }
  function sheltered(ent) {
    const d = gale.dir, x = ent.cx - d * (ent.w / 2 + 4);
    for (let i = 0; i < 4; i++) {
      const sx = x - d * i * TILE;
      if (room.solidAt(sx, ent.y + ent.h * 0.3) && room.solidAt(sx, ent.y + ent.h * 0.85)) return true;
    }
    return false;
  }
  // wind speed (px/s, signed) acting on a body right now; 0 when calm / outside / sheltered
  function force(ent) {
    if (!gale || galeK < 0.05) return 0;
    if (ent.cx < gale.x0 || ent.cx > gale.x1) return 0;
    if (sheltered(ent)) return 0;
    return gale.dir * gale.v * galeK;
  }
  // scenery sway multiplier + lean (for elements and trees)
  function sway() { return 1 + g * 1.8 + (gale ? galeK * 3 : 0); }
  return { enter, update, force, sway, get gust() { return g; }, get gale() { return gale ? galeK : 0; }, get dir() { return gale ? gale.dir : dirA; } };
})();
