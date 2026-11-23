const { chromium } = require('playwright');
const arenas = [['c8', 6, 17, 'choir'], ['g6', 8, 18, 'colossus'], ['c7', 5, 14, 'none'], ['g4', 5, 21, 'none'], ['s5', 30, 17, 'none'], ['n5', 9, 19, 'none']];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  for (const [room, x, y, boss] of arenas) {
    await p.goto(`file:///home/user/yehali-stickers/last-wick/index.html?room=${room}&x=${x}&y=${y}&abil=all`);
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const M = G.Main, I = G.Input; M.frozen = true; G.state.hpMax = 9999; G.state.hp = 9999;
      const K = ['left', 'right', 'jump', 'attack', 'dash', 'up', 'down', 'focus'];
      let hits = 0, minHp = 9999, phases = new Set(), states = new Set();
      for (let f = 0; f < 60 * 70; f++) {
        if (f % 8 === 0) { for (const k of K) I.release(k); const P = M.player, B = M.boss;
          const dir = B && !B.dead ? Math.sign(B.cx - P.cx) : (Math.random() < 0.5 ? -1 : 1);
          I.press(Math.random() < 0.7 ? (dir > 0 ? 'right' : 'left') : (dir > 0 ? 'left' : 'right'));
          if (Math.random() < 0.6) I.press('attack'); if (Math.random() < 0.3) I.press('jump'); if (Math.random() < 0.1) I.press('dash'); if (Math.random() < 0.15) I.press('up'); if (Math.random() < 0.1) I.press('down'); }
        G.state.hp = Math.max(G.state.hp, 9000);
        if (M.player.dead) { break; }
        M.step(1);
        const B = M.boss; if (B) { phases.add(B.phase); states.add(B.state); }
      }
      const B = M.boss;
      return { room: M.room.id, boss: B ? B.kind : null, bossHp: B ? +(B.hp.toFixed(1)) + '/' + B.maxHp : '-', dead: B ? B.dead : null, active: B ? B.active : null, phases: [...phases], states: [...states].join(','), playerDmgTaken: 9999 - G.state.hp, mode: M.mode, enemies: M.enemiesList.length };
    });
    console.log(JSON.stringify(r));
  }
  console.log(errs.slice(0, 20).join('\n'));
  await b.close();
})();
