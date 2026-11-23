// node sim.js : scripted physics scenarios
const { chromium } = require('playwright');
const scen = require(process.argv[2] || './scen.js');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  for (const sc of scen) {
    await p.goto('file:///home/user/yehali-stickers/last-wick/index.html?' + sc.q);
    await p.waitForTimeout(1800);
    const r = await p.evaluate(async (acts) => {
      const M = G.Main, I = G.Input; M.frozen = true; const log = [];
      const pl = () => { const P = M.player; return { room: M.room.id, x: Math.round(P.cx), feet: Math.round(P.feet), tx: +(P.cx / 50).toFixed(1), ty: +(P.feet / 50).toFixed(1), g: P.ground, hp: G.state.hp, dead: P.dead }; };
      for (const a of acts) {
        if (a.hold) for (const k of a.hold) I.press(k);
        if (a.tap) for (const k of a.tap) I.press(k);
        M.step(a.f || 1);
        if (a.tap) for (const k of a.tap) I.release(k);
        if (a.rel) for (const k of a.rel) I.release(k);
        if (a.log) log.push(a.log + ' ' + JSON.stringify(pl()));
        if (a.eval) log.push(a.eval + ' => ' + JSON.stringify(eval(a.eval)));
      }
      return log;
    }, sc.acts);
    console.log('== ' + sc.name); console.log(r.join('\n'));
    if (sc.shot) await p.screenshot({ path: sc.shot });
  }
  console.log(errs.join('\n'));
  await b.close();
})();
