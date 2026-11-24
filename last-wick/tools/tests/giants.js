// Bot fights each Shadow Theatre giant with infinite HP: random aggressive play + uses the stage trick.
// Reports errors, states/phases seen, boss HP left and time to kill. usage: node tools/tests/giants.js [secs]
const { chromium } = require('playwright');
const SECS = +process.argv[2] || 150;
const arenas = [['tA', 'waxmother'], ['tC', 'lanternqueen'], ['tD', 'puppeteer'], ['tE', 'director'], ['tB', 'whale']];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  for (const [room, kind] of arenas) {
    await p.goto(`file:///home/user/yehali-stickers/last-wick/index.html?room=${room}&x=12&abil=all`);
    await p.waitForFunction(() => window.G && G.Main.mode === 'play', null, { timeout: 20000 });
    const r = await p.evaluate(([SECS, kind]) => {
      const M = G.Main, I = G.Input; M.frozen = true; G.state.hpMax = 9999; G.state.hp = 9999; G.state.needle = 1;
      const K = ['left', 'right', 'jump', 'attack', 'dash', 'up', 'down', 'focus'];
      let states = new Set(), phases = new Set(), f = 0, killedAt = null, hits = 0;
      for (; f < 60 * SECS; f++) {
        const P = M.player, B = M.boss; G.state.hp = 9000;
        const holdUp = kind === 'waxmother' && B && B.valves && B.valves.some(v => !v.cd && Math.abs(P.cx - v.x) < 50);
        if (f % 8 === 0) { for (const k of K) if (!(holdUp && k === 'up')) I.release(k);
          let tx = B ? B.cx : P.cx;
          if (kind === 'waxmother' && B && B.valves) { const v = B.valves.find(v => !v.cd); if (v && (f % 1200) < 500) tx = v.x; }
          if (kind === 'director' && B && B.cons && B.lit <= 0) { const c = B.cons.find(c => !c.cd); if (c) tx = c.x; }
          if (kind === 'lanternqueen' && B && B.lan && B.state !== 'stunned') { const l = B.lan.find(l => l.lit <= 0); if (l) tx = l.x; }
          if (kind === 'puppeteer' && B && B.strings && B.mst !== 'fallen') { const s = B.strings.find(s => !s.cut); if (s) tx = B.attach(s)[0]; }
          const d = Math.sign(tx - P.cx); if (Math.abs(tx - P.cx) > 30) I.press(d > 0 ? 'right' : 'left');
          if (kind === 'whale') { I.press(P.cy > (B ? B.wy : 400) ? 'up' : 'down'); if (P.cx > 700) I.press('left'); I.press('attack'); }
          else if (holdUp) I.press('up'); else { if (Math.random() < 0.6) I.press('attack'); if (Math.random() < 0.35) I.press('jump'); if (Math.random() < 0.5) I.press('up'); if (Math.random() < 0.08) I.press('dash'); }
        }
        M.step(1);
        if (B) { states.add(B.state); phases.add(B.phase); if (B.dead && killedAt === null) { killedAt = f / 60; } }
        if (killedAt !== null && f / 60 > killedAt + 5) break;
      }
      const B = M.boss;
      return { kind, room: M.room.id, boss: B && B.kind, hp: B ? (+B.hp.toFixed(1)) + '/' + B.maxHp : 'gone', killedAt, phases: [...phases].join(','), states: [...states].join(','), dmgTaken: 9999 - G.state.hp, rewardHpMax: G.state.hpMax };
    }, [SECS, kind]);
    console.log(JSON.stringify(r));
  }
  console.log('ERRORS:', errs.length ? '\n' + [...new Set(errs)].slice(0, 15).join('\n') : 'none');
  await b.close();
})();
