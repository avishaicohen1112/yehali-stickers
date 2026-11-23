// node reach.js ROOM ABIL(json) STARTX STARTY  -> BFS over ground states with real physics
const { chromium } = require('playwright');
(async () => {
  const [room, abil, sx, sy] = [process.argv[2], JSON.parse(process.argv[3] || '{}'), +process.argv[4], +process.argv[5]];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file:///home/user/yehali-stickers/last-wick/index.html?room=' + room);
  await p.waitForTimeout(1500);
  const r = await p.evaluate(({ room, abil, sx, sy }) => {
    G.Main.frozen = true; G.Sound.sfx = () => {};
    Object.assign(G.state.abil, abil); G.state.hp = 99; G.state.hpMax = 99;
    const R = new G.World.Room(room); const I = G.Input;
    const fx = G.FX.spawn; G.FX.spawn = () => ({}); G.FX.burst = () => {}; G.FX.ring = () => {}; G.FX.slash = () => {};
    G.Main.fadeOut = () => {}; G.Main.fadeIn = () => {};
    const KEYS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'focus'];
    function sim(x, feet, act) {
      const P = new G.Player.Player(x, feet); P.ground = true; P.inv = 0;
      for (const k of KEYS) I.held[k] = false; I.endFrame();
      let f = 0, left = false;
      while (f < 200) {
        const d = act.dir; I.held.left = d < 0 && f < act.dirF; I.held.right = d > 0 && f < act.dirF;
        if (act.flip && f >= act.flip) { I.held.left = d > 0; I.held.right = d < 0; }
        // press handling
        const press = (k) => { I.held[k] = false; I.press(k); };
        if (act.jump && f === 0) press('jump');
        if (act.jump && f >= act.jumpHold && !(act.j2 && f >= act.j2 && f < act.j2 + act.j2Hold)) I.held.jump = false;
        if (act.j2 && f === act.j2) press('jump');
        if (act.j3 && f === act.j3) press('jump');
        if (act.dash !== undefined && f === act.dash) press('dash'); else I.held.dash = false;
        P.update(1 / 60, R); I.endFrame(); f++;
        if (P.hazardT > 0 || P.dead) return { fail: 'hazard' };
        if (P.cx < 0 || P.cx > R.pw || P.y + P.h * 0.3 < 0 || P.y + P.h * 0.5 > R.ph) return { exit: (P.cx < 0 ? 'W' : P.cx > R.pw ? 'E' : P.y < 0 ? 'N' : 'S') + ':' + Math.round(P.cx / 50) + ',' + Math.round(P.feet / 50) };
        if (f > 3 && P.ground && Math.abs(P.vx) < 1 && !I.held.left && !I.held.right) return { x: P.cx, feet: P.feet };
        if (f > 3 && P.ground && f >= act.dirF && (!act.jump || f > 8)) { if (act.dir === 0 || f >= act.dirF) { /* settle */ } }
        if (f > act.dirF + 2 && P.ground) return { x: P.cx, feet: P.feet };
      }
      return { fail: 'timeout' };
    }
    const acts = [];
    for (const dir of [-1, 1]) {
      acts.push({ dir, dirF: 6 }); acts.push({ dir, dirF: 18 });
      for (const jh of [5, 12, 40]) for (const df of [10, 25, 45]) acts.push({ dir, dirF: df, jump: 1, jumpHold: jh });
      if (abil.djump) for (const j2 of [14, 24]) acts.push({ dir, dirF: 60, jump: 1, jumpHold: 40, j2, j2Hold: 40 });
      if (abil.dash) for (const dsh of [12, 24]) acts.push({ dir, dirF: 60, jump: 1, jumpHold: 40, dash: dsh });
      if (abil.dash && abil.djump) acts.push({ dir, dirF: 70, jump: 1, jumpHold: 40, j2: 22, j2Hold: 40, dash: 12 });
      if (abil.wall) for (const j2 of [16, 26]) acts.push({ dir, dirF: 120, jump: 1, jumpHold: 40, j2, j2Hold: 30, flip: j2 + 9, j3: j2 + 22 });
    }
    acts.push({ dir: 0, dirF: 0, jump: 1, jumpHold: 40 });
    const seen = new Set(), queue = [{ x: sx * 50, feet: sy * 50 }], exits = new Set(); let n = 0;
    const key = s => Math.round(s.x / 15) + ',' + Math.round(s.feet / 10);
    seen.add(key(queue[0]));
    while (queue.length && n < 4000) {
      const s = queue.shift(); n++;
      for (const a of acts) {
        const r = sim(s.x, s.feet, a);
        if (r.exit) exits.add(r.exit);
        else if (r.x !== undefined) { const k = key(r); if (!seen.has(k)) { seen.add(k); queue.push(r); } }
      }
    }
    const ys = {}; for (const k of seen) { const [x, y] = k.split(',').map(Number); const ty = Math.round(y * 10 / 50); ys[ty] = ys[ty] || [1e9, -1e9]; ys[ty][0] = Math.min(ys[ty][0], Math.round(x * 15 / 50)); ys[ty][1] = Math.max(ys[ty][1], Math.round(x * 15 / 50)); }
    return { states: seen.size, expanded: n, exits: [...exits].sort(), floors: ys };
  }, { room, abil, sx, sy });
  console.log(room, JSON.stringify(abil), JSON.stringify(r));
  if (errs.length) console.log(errs.join('\n'));
  await b.close();
})();
