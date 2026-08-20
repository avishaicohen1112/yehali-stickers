/* ============================================================
   game.js — לולאה ראשית, גלים, התנגשויות, סטיקרים וממשק
   ============================================================ */
'use strict';

/* מיקומי הנחיתה של הסטיקרים על המסך.
   מסודרים מסביב לשדה ומתחת לרצועת ה-HUD העליונה (y > 110),
   כדי שהניקוד, הגל ומוני הסטיקרים יישארו קריאים. */
const SLOTS = [
  { x: 146, y: 250, rot: -0.16, w: 188 },
  { x: 1134, y: 256, rot:  0.14, w: 188 },
  { x: 142, y: 556, rot:  0.13, w: 180 },
  { x: 1138, y: 550, rot: -0.12, w: 180 },
  { x: 640, y: 566, rot:  0.06, w: 176 }
];

const Game = {

  /* ---------------- מצב ---------------- */
  canvas: null,
  ctx: null,
  renderScale: 1,

  state: 'loading',      // loading | menu | playing | paused | over
  time: 0,               // שעון תצוגה (רץ תמיד)
  raf: 0,
  last: 0,

  player: null,
  foes: [],
  shots: [],
  pickups: [],
  spawnMarks: [],
  obstacles: [],
  puddles: [],           // שלוליות של ה'דביק'
  pizzas: [],            // פיצות שיהלי זרק
  collects: [],          // סטיקרים שצפים בזירה לאיסוף

  /* --- מפה ומצלמה --- */
  map: null,             // הגדרת המפה הנוכחית מתוך CFG.maps
  mapIndex: 0,
  cam: { x: 0, y: 0 },

  /* --- כלכלה והתקדמות --- */
  coins: 0,
  trophies: 0,
  runCoins: 0,           // כמה נצברו בריצה הנוכחית
  runTrophies: 0,
  owned: {},             // פריטי חנות שנקנו
  equipped: {},          // cat -> id
  mapsOpen: {},          // מפות שנפתחו בפועל (מעבר לחינמיות)
  bestMap: {},           // שיא לכל מפה

  stickers: [],          // סטיקרים שכבר נדבקו
  slap: null,            // אנימציית ההדבקה הנוכחית
  timeScale: 1,

  score: 0,
  best: 0,
  wave: 1,
  waveTimer: 0,
  runTime: 0,
  combo: 1,
  comboTimer: 0,
  pickupTimer: 0,

  powers: {},            // kind -> שניות שנותרו
  sey: null,             // אירוע "סיישל"
  seyDelay: 0,           // המתנה לפני "סיישל" של תחילת גל
  banner: null,          // הודעת גל
  unlocked: {},          // סטיקרים שנפתחו בגלריה
  usedStickers: [],      // אילו סטיקרים כבר נדבקו בריצה הנוכחית

  /* ============================================================
     אתחול
     ============================================================ */
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    Sound.init();
    Input.init();

    this.best = U.store.get(CFG.keys.best, 0);
    this.unlocked = U.store.get(CFG.keys.unlocked, {});
    this.coins = U.store.get(CFG.keys.coins, 0);
    this.trophies = U.store.get(CFG.keys.trophies, 0);
    this.owned = U.store.get(CFG.keys.owned, { skin_classic: true });
    this.equipped = U.store.get(CFG.keys.equipped, {});
    this.mapsOpen = U.store.get(CFG.keys.mapsOpen, {});
    this.bestMap = U.store.get(CFG.keys.bestMap, {});
    this._syncSoundBtn();
    this.syncWallet();

    /* המפה הראשונה היא ברירת המחדל — גם לרקע החי של התפריט */
    this.setMap(0);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.bindUI();

    /* טעינת הסטיקרים ואז תפריט */
    const fill = document.getElementById('loadFill');
    Assets.load((p) => { fill.style.width = Math.round(p * 100) + '%'; })
      .then(() => {
        this.buildGallery();
        setTimeout(() => {
          this.show('menu');
          this.state = 'menu';
        }, 220);
      });

    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  },

  /* ============================================================
     מפות
     ============================================================ */
  setMap(i) {
    this.mapIndex = U.clamp(i, 0, CFG.maps.length - 1);
    this.map = CFG.maps[this.mapIndex];
    CFG.worldW = this.map.w;
    CFG.worldH = this.map.h;
    this.buildObstacles();
    this.cam.x = 0;
    this.cam.y = 0;
  },

  mapOpen(m) {
    return m.cost === 0 || !!this.mapsOpen[m.id] || this.trophies >= m.cost;
  },

  buildObstacles() {
    this.obstacles = this.map.obstacles.map(o => ({
      x: Math.round(this.map.w * o.x - o.w / 2),
      y: Math.round(this.map.h * o.y - o.h / 2),
      w: o.w, h: o.h, kind: o.kind
    }));
  },

  /* המצלמה עוקבת אחרי יהלי ונעצרת בקצוות המפה.
     מפה בגודל החלון => אין תזוזה בכלל, בדיוק כמו קודם. */
  updateCamera(dt, snap) {
    const p = this.player;
    if (!p) return;
    const maxX = Math.max(0, CFG.worldW - CFG.W);
    const maxY = Math.max(0, CFG.worldH - CFG.H);

    const tx = U.clamp(p.x + p.vx * CFG.cam.lookAhead - CFG.W / 2, 0, maxX);
    const ty = U.clamp(p.y + p.vy * CFG.cam.lookAhead - CFG.H / 2, 0, maxY);

    if (snap) { this.cam.x = tx; this.cam.y = ty; return; }
    this.cam.x = U.damp(this.cam.x, tx, CFG.cam.follow, dt);
    this.cam.y = U.damp(this.cam.y, ty, CFG.cam.follow, dt);
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const padX = window.innerWidth < 700 ? 0 : 34;
    const padY = window.innerWidth < 700 ? 0 : 34;
    const availW = Math.max(320, window.innerWidth - padX);
    const availH = Math.max(240, window.innerHeight - padY);

    const scale = Math.min(availW / CFG.W, availH / CFG.H);
    const cssW = CFG.W * scale, cssH = CFG.H * scale;

    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.renderScale = (cssW * dpr) / CFG.W;
  },

  /* ============================================================
     ממשק
     ============================================================ */
  show(id) {
    ['loading', 'menu', 'how', 'gallery', 'maps', 'shop', 'itemDetail', 'pause', 'over'].forEach(s => {
      document.getElementById(s).classList.toggle('show', s === id);
    });
  },
  hideAll() { this.show('__none__'); },

  bindUI() {
    const click = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('click', () => { Sound.unlock(); Sound.ui(); fn(); });
    };

    const openShop = () => { this.buildShop(); this.show('shop'); };
    const openMaps = () => { this.buildMaps(); this.show('maps'); };

    click('btnPlay', () => this.start());
    click('btnHow', () => this.show('how'));
    click('btnGallery', () => { this.buildGallery(); this.show('gallery'); });
    click('btnMaps', openMaps);
    click('btnMaps2', openMaps);
    click('btnShop', openShop);
    click('btnPortrait', openShop);
    click('btnResume', () => this.resume());
    click('btnQuit', () => this.toMenu());
    click('btnAgain', () => this.start());
    click('btnMenu', () => this.toMenu());
    click('btnOverMaps', () => { this.toMenu(); this.buildMaps(); this.show('maps'); });

    document.querySelectorAll('.close-panel').forEach(b => {
      b.addEventListener('click', () => { Sound.ui(); this.toMenu(); });
    });

    /* חצי הגלילה של השורות — לחיצה מזיזה עמוד שלם.
       ב-RTL הגלילה "קדימה" היא לכיוון שלילי. */
    document.querySelectorAll('.rail-arrow').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.ui();
        const rail = document.getElementById(btn.dataset.rail);
        if (rail) rail.scrollBy({ left: -rail.clientWidth * 0.8, behavior: 'smooth' });
      });
    });

    const backToShop = () => {
      Sound.unlock(); Sound.ui();
      this.buildShop();
      this.show('shop');
    };
    document.getElementById('btnItemBack').addEventListener('click', backToShop);
    document.getElementById('btnItemBack2').addEventListener('click', backToShop);

    /* קנייה/ציוד מתוך עמוד פרטי הפריט — לוגיקה זהה למה שהיה קודם
       ישירות על כרטיס החנות, רק שעכשיו יש עצירה בעמוד ביניים. */
    document.getElementById('btnItemBuy').addEventListener('click', () => {
      Sound.unlock();
      const it = this._detailItem;
      if (!it) return;
      const owned = !!this.owned[it.id] || it.cost === 0;
      const on = this.equipped[it.cat] === it.id;

      if (owned) {
        Sound.ui();
        this.equipped[it.cat] = on ? null : it.id;   // לחיצה שנייה מסירה
        U.store.set(CFG.keys.equipped, this.equipped);
        this.refreshItemBuyBtn();
        return;
      }
      const afford = this.coins >= it.cost;
      if (!afford) { Sound.tone(150, 0.12, { type: 'square', vol: 0.05 }); return; }
      Sound.pickup('sey');
      this.coins -= it.cost;
      this.owned[it.id] = true;
      this.equipped[it.cat] = it.id;
      U.store.set(CFG.keys.coins, this.coins);
      U.store.set(CFG.keys.owned, this.owned);
      U.store.set(CFG.keys.equipped, this.equipped);
      document.getElementById('itemCoins').textContent = U.numStr(this.coins);
      this.refreshItemBuyBtn();
      this.syncWallet();
    });

    document.getElementById('soundBtn').addEventListener('click', () => {
      Sound.unlock();
      Sound.setMuted(!Sound.muted);
      this._syncSoundBtn();
    });

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (k === 'm') {
        Sound.unlock();
        Sound.setMuted(!Sound.muted);
        this._syncSoundBtn();
      }
      if (k === 'enter' && (this.state === 'menu' || this.state === 'over')) this.start();
    });

    /* יציאה מהטאב משהה — שלא נמות בזמן שלא מסתכלים */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
  },

  /* האייקון עצמו קבוע (SVG) — רק מעומעם כשמושתק */
  _syncSoundBtn() {
    const b = document.getElementById('soundBtn');
    if (b) b.classList.toggle('off', Sound.muted);
  },

  /* ============================================================
     יהלי בתצוגה מקדימה
     ------------------------------------------------------------
     התיבה החוסמת של הדמות נמדדה מהפיקסלים בפועל: רוחב 40.25 יחידות
     (‎-20.25..+20‎), גובה 109 (‎-68.75..+40.25‎). לכן קנבס של
     52×121 יחידות עם מוצא ב-y=74 נותן שוליים מאוזנים.
     ============================================================ */
  paintPerson(canvas, shirt, scale, blink) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(52 * scale), h = Math.round(121 * scale);

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    let cols = Art.YEHALI;
    if (shirt) cols = Object.assign({}, Art.YEHALI, { shirt, shirtDark: Art.darken(shirt, 0.72) });

    Art.person(ctx, {
      x: w / 2, y: 74 * scale, dir: 1, walk: 0, scale, squash: 1,
      colors: cols, style: 'yehali', blink: !!blink
    });
  },

  /* הדמות הגדולה על הבמה במסך הבית */
  renderHero() {
    const cv = document.getElementById('heroCanvas');
    if (!cv) return;
    const skin = this.equipped.skin && CFG.shopItems.find(s => s.id === this.equipped.skin);
    const shirt = (skin && skin.shirt) || null;

    /* גודל הדמות נגזר מגובה הבמה בפועל, כדי שתתאים גם לטלפון לרוחב */
    const stage = document.querySelector('#menu .stage');
    const avail = stage ? stage.clientHeight : 380;
    const scale = U.clamp(avail * 0.62 / 121, 1.1, 3.4);

    const blink = Math.sin(this.time * 1.7) > 0.985;
    if (this._heroKey !== shirt + '|' + scale.toFixed(2) + '|' + blink) {
      this._heroKey = shirt + '|' + scale.toFixed(2) + '|' + blink;
      this.paintPerson(cv, shirt, scale, blink);
    }
  },

  /* מערבב hex לכיוון לבן — ליצירת קצה בהיר לגרדיאנט מצבע אקסנט בודד */
  _lighten(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(c + (255 - c) * t);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  /* ============================================================
     אמנות של פריט בתוך כרטיס / עמוד פריט
     ============================================================ */
  fillItemArt(box, it, scale) {
    box.querySelectorAll('.item-art').forEach(n => n.remove());

    if (it.cat === 'skin') {
      const shadow = document.createElement('div');
      shadow.className = 'card-contact item-art';
      box.appendChild(shadow);
      const cv = document.createElement('canvas');
      cv.className = 'item-art';
      box.appendChild(cv);
      this.paintPerson(cv, it.shirt, scale, false);
    } else {
      const d = document.createElement('div');
      d.className = 'item-art ' + (it.cat === 'trail' ? 'art-trail' : 'art-stamp');
      d.style.setProperty('--c', it.color);
      if (it.cat === 'stamp') d.textContent = 'נפסלת!';
      box.appendChild(d);
    }
  },

  /* ============================================================
     אוסף הסטיקרים
     ============================================================ */
  buildGallery() {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    let got = 0;
    CFG.stickers.forEach((s, i) => {
      const has = !!this.unlocked[i];
      if (has) got++;

      const card = document.createElement('div');
      card.className = 'scard' + (has ? '' : ' locked');

      const img = document.createElement('img');
      img.src = 'assets/stickers/' + s.file;
      img.alt = has ? s.caption : 'נעול';
      card.appendChild(img);

      if (!has) {
        const l = document.createElement('div');
        l.className = 'lockq';
        l.textContent = '?';
        card.appendChild(l);
      }

      const n = document.createElement('div');
      n.className = 'num';
      n.textContent = i + 1;
      card.appendChild(n);

      const tier = s.tier || 'רגיל';
      const tdef = CFG.rarity.tiers[tier];
      const r = document.createElement('div');
      r.className = 'rar';
      if (tdef) r.style.setProperty('--rc', tdef.color);
      r.textContent = tier;
      card.appendChild(r);

      card.title = has ? s.caption : 'עוד לא אספת את זה';
      grid.appendChild(card);
    });

    const b = document.getElementById('galBandName');
    if (b) b.textContent = 'נאספו ' + got + ' מתוך ' + CFG.stickers.length;
  },

  /* ============================================================
     בחירת מפה — אותו כרטיס בדיוק כמו בחנות
     ============================================================ */
  buildMaps() {
    const rail = document.getElementById('mapRail');
    rail.innerHTML = '';
    const t = document.getElementById('mapsTrophies');
    if (t) t.textContent = U.numStr(this.trophies);

    let openCount = 0;

    CFG.maps.forEach((m, i) => {
      const open = this.mapOpen(m);
      if (open) openCount++;
      const sel = i === this.mapIndex;
      const best = this.bestMap[m.id] || 0;

      const card = document.createElement('div');
      card.className = 'card' + (sel ? ' on' : '') + (open ? '' : ' locked');

      if (sel) {
        const chk = document.createElement('div');
        chk.className = 'check';
        chk.textContent = '✓';
        card.appendChild(chk);
      }

      const hd = document.createElement('div');
      hd.className = 'card-hd';
      hd.textContent = open ? (sel ? 'נבחרה' : 'פתוחה') : 'נעולה';
      card.appendChild(hd);

      const art = document.createElement('div');
      art.className = 'card-art';
      const inner = document.createElement('div');
      inner.className = 'art-map';
      /* pal.a/pal.c הם צבעי הרצפה בזירה עצמה — כהים ועמומים בכוונה
         כרקע מאחורי הדמות. בכרטיס אפשר לראות "מרובע כמעט שחור" —
         נראה כמו placeholder ריק. משתמשים ב-pal.glow (הצבע הבולט
         שכל מפה כבר מוגדרת איתו) ומדרגה בהירה ממנו, בשביל תמונה
         שבאמת מזהים אותה בכרטיס קטן. */
      inner.style.setProperty('--a', this._lighten(m.pal.glow, 0.55));
      inner.style.setProperty('--c', m.pal.glow);
      art.appendChild(inner);
      card.appendChild(art);

      const nm = document.createElement('div');
      nm.className = 'card-nm';
      nm.textContent = m.name;
      card.appendChild(nm);

      const ft = document.createElement('div');
      ft.className = 'card-ft';
      if (open) {
        ft.innerHTML = '<span class="own">' + (best ? 'שיא ' + U.numStr(best) : m.w + '×' + m.h) + '</span>';
      } else {
        ft.innerHTML = '<span class="lock"><svg><use href="#cup"/></svg>' + m.cost + '</span>';
      }
      card.appendChild(ft);

      if (open) {
        card.addEventListener('click', () => {
          Sound.ui();
          this.setMap(i);
          if (m.cost > 0 && !this.mapsOpen[m.id]) {
            /* פתיחה ראשונה — בונוס חד-פעמי */
            this.mapsOpen[m.id] = true;
            U.store.set(CFG.keys.mapsOpen, this.mapsOpen);
            this.addCoins(CFG.coin.firstClear);
          }
          this.buildMaps();
          this.syncWallet();
        });
      } else {
        card.addEventListener('click', () => Sound.tone(150, 0.12, { type: 'square', vol: 0.05 }));
      }
      rail.appendChild(card);
    });

    const meta = document.getElementById('mapsBandMeta');
    if (meta) meta.textContent = 'נפתחות בגביעים · ' + openCount + ' מתוך ' + CFG.maps.length + ' פתוחות';
    this._syncRailHints();
  },

  /* ============================================================
     חנות — קטגוריה אחת בכל פעם, טאבים למטה, גלילה אופקית.
     לחיצה על כרטיס לא קונה ישר — פותחת עמוד פרטי-פריט.
     ============================================================ */
  shopCat: 'skin',

  buildShop() {
    document.getElementById('shopCoins').textContent = U.numStr(this.coins);

    /* --- טאבים --- */
    const cats = ['skin', 'trail', 'stamp'].filter(c => CFG.shopItems.some(it => it.cat === c));
    const tabs = document.getElementById('shopTabs');
    tabs.innerHTML = '';
    if (!cats.includes(this.shopCat)) this.shopCat = cats[0];

    for (const cat of cats) {
      const b = document.createElement('button');
      b.className = 'tab' + (cat === this.shopCat ? ' on' : '');
      b.textContent = CFG.shopCatInfo[cat].title;
      b.addEventListener('click', () => {
        Sound.ui();
        this.shopCat = cat;
        this.buildShop();
      });
      tabs.appendChild(b);
    }

    /* --- הכרטיסים של הקטגוריה הנבחרת --- */
    const items = CFG.shopItems.filter(it => it.cat === this.shopCat);
    const rail = document.getElementById('shopRail');
    rail.innerHTML = '';

    const ownedCount = items.filter(it => this.owned[it.id] || it.cost === 0).length;
    document.getElementById('shopBandName').textContent = CFG.shopCatInfo[this.shopCat].title;
    document.getElementById('shopBandMeta').textContent =
      items.length + ' פריטים · ' + ownedCount + ' בבעלותך';

    for (const it of items) rail.appendChild(this.buildShopCard(it));
    this._syncRailHints();
  },

  buildShopCard(it) {
    const owned = !!this.owned[it.id] || it.cost === 0;
    const on = this.equipped[it.cat] === it.id;
    const afford = this.coins >= it.cost;
    const rare = !!it.rare;

    const card = document.createElement('div');
    card.className = 'card' + (on ? ' on' : (rare ? ' rare' : '')) +
                     ((owned || afford) ? '' : ' cant');

    if (rare && !on) {
      const sh = document.createElement('div');
      sh.className = 'shine';
      card.appendChild(sh);
    }
    if (on) {
      const chk = document.createElement('div');
      chk.className = 'check';
      chk.textContent = '✓';
      card.appendChild(chk);
    }

    const hd = document.createElement('div');
    hd.className = 'card-hd';
    hd.textContent = on ? 'מצויד' : (owned ? 'בבעלותך' : (rare ? 'נדיר' : 'רגיל'));
    card.appendChild(hd);

    const art = document.createElement('div');
    art.className = 'card-art';
    card.appendChild(art);
    this.fillItemArt(art, it, 2.5);

    const nm = document.createElement('div');
    nm.className = 'card-nm';
    nm.textContent = it.name;
    card.appendChild(nm);

    const ft = document.createElement('div');
    ft.className = 'card-ft';
    if (owned) ft.innerHTML = '<span class="own">' + (on ? '✓ מצויד' : 'בבעלותך') + '</span>';
    else ft.innerHTML = '<svg><use href="#coin"/></svg><b>' + it.cost + '</b>';
    card.appendChild(ft);

    card.addEventListener('click', () => { Sound.ui(); this.openItemDetail(it); });
    return card;
  },

  /* עמוד פרטי-פריט: ערך קוסמטי/משחקי, תיאור, חזרה וקנייה */
  openItemDetail(it) {
    this._detailItem = it;
    /* כדי שכפתור "חזרה" יחזיר לטאב של הפריט ולא לטאב שהיה פתוח לפני */
    this.shopCat = it.cat;

    document.getElementById('itemName').textContent = it.name;
    document.getElementById('itemTitle').textContent = it.name;
    document.getElementById('itemDesc').textContent = it.desc || '';
    document.getElementById('itemCoins').textContent = U.numStr(this.coins);

    const info = CFG.shopCatInfo[it.cat];
    document.getElementById('itemKindTag').textContent = info.tag;
    document.getElementById('itemCosmeticVal').textContent = info.cosmetic;
    document.getElementById('itemGameplayVal').textContent = info.gameplay;

    const rareTag = document.getElementById('itemRare');
    rareTag.hidden = !it.rare;
    rareTag.textContent = 'נדיר';

    const hero = document.getElementById('itemHeroArt');
    hero.classList.toggle('rare', !!it.rare);
    this.fillItemArt(hero, it, 3.4);

    this.refreshItemBuyBtn();
    this.show('itemDetail');
  },

  /* מעדכן את כפתור הקנייה לפי מצב הפריט (בלי לבנות מחדש את כל העמוד) */
  refreshItemBuyBtn() {
    const it = this._detailItem;
    if (!it) return;
    const owned = !!this.owned[it.id] || it.cost === 0;
    const on = this.equipped[it.cat] === it.id;
    const afford = this.coins >= it.cost;

    const btn = document.getElementById('btnItemBuy');
    btn.classList.toggle('cant', !owned && !afford);
    if (on) btn.textContent = 'מצויד — הסר';
    else if (owned) btn.textContent = 'צייד';
    else btn.textContent = 'קנייה · ' + it.cost;
  },

  /* חץ הגלילה ודהיית הקצה מופיעים רק כשבאמת יש לאן לגלול.
     נמדד אחרי layout, ולכן ב-rAF ולא מיד. */
  _syncRailHints() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.railwrap').forEach(wrap => {
        const rail = wrap.querySelector('.rail');
        wrap.classList.toggle('no-scroll', !rail || rail.scrollWidth <= rail.clientWidth + 4);
      });
    });
  },

  /* ============================================================
     ארנק ומסך הבית
     ============================================================ */
  syncWallet() {
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

    set('coinCount', U.numStr(this.coins));
    set('trophyCount', U.numStr(this.trophies));
    set('shopCoins', U.numStr(this.coins));
    set('mapsTrophies', U.numStr(this.trophies));

    if (this.map) {
      set('curMap', this.map.name);
      set('curMapSub', this.map.sub);
      const sw = document.getElementById('curMapSw');
      if (sw) sw.style.background =
        'linear-gradient(150deg,' + this._lighten(this.map.pal.glow, 0.55) + ',' + this.map.pal.glow + ')';
    }

    /* לוחית השם מתחת ליהלי — הסקין המצויד והשיא */
    const skin = this.equipped.skin && CFG.shopItems.find(s => s.id === this.equipped.skin);
    const sub = document.getElementById('plateSub');
    if (sub) {
      sub.innerHTML = (skin ? skin.name + ' · ' : '') + 'שיא <i>' + U.numStr(this.best) + '</i>';
    }

    /* כרטיס האוסף — נתונים אמיתיים, לא ממלא מקום */
    const total = CFG.stickers.length;
    const got = CFG.stickers.reduce((n, _, i) => n + (this.unlocked[i] ? 1 : 0), 0);
    set('collCount', got + ' / ' + total);
    const bar = document.getElementById('collBar');
    if (bar) bar.style.width = (total ? (got / total) * 100 : 0) + '%';
    set('collHint', got >= total ? 'אספת את כולם!' : 'אסוף אותם בזירה כדי לפתוח');
  },

  addCoins(n) {
    this.coins += n;
    U.store.set(CFG.keys.coins, this.coins);
  },

  /* צבע/סקין מהחנות אל תוך השחקן */
  applyCosmetics() {
    if (!this.player) return;
    const find = (id) => CFG.shopItems.find(s => s.id === id);
    const tr = find(this.equipped.trail);
    const sk = find(this.equipped.skin);
    this.player.trail = (tr && tr.color) || '#ffcc3d';
    this.player.shirt = (sk && sk.shirt) || null;
  },

  /* ============================================================
     מחזור חיי משחק
     ============================================================ */
  start() {
    Sound.unlock();

    /* המפה נטענת מחדש בכל ריצה — worldW/H חייבים להיות נכונים
       *לפני* שנוצר השחקן, כי המיקום ההתחלתי נגזר מהם. */
    this.setMap(this.mapIndex);

    this.player = new Player();
    this.applyCosmetics();

    this.foes.length = 0;
    this.shots.length = 0;
    this.pickups.length = 0;
    this.spawnMarks.length = 0;
    this.stickers.length = 0;
    this.puddles.length = 0;
    this.pizzas.length = 0;
    this.collects.length = 0;
    this.slap = null;
    this.timeScale = 1;

    this.score = 0;
    this.wave = 1;
    this.waveTimer = CFG.wave.duration;
    this.runTime = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.pickupTimer = CFG.pickup.firstAt;
    this.collectTimer = CFG.collect.firstAt;
    this.powers = {};
    this.sey = null;
    this.seyDelay = 0;
    this.usedStickers = [];
    this.runCoins = 0;
    this.runTrophies = 0;
    this.coinScoreMark = 0;
    this.duoTalk = null;
    this.replyQueue = [];

    FX.reset();
    Assets.resetBag();
    this.updateCamera(0, true);

    this.hideAll();
    this.state = 'playing';

    this.startWave(true);
    Sound.startMusic();
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.show('pause');
  },

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hideAll();
    this.last = performance.now();
  },

  toMenu() {
    this.state = 'menu';
    Sound.stopMusic();
    this.show('menu');
    this.syncWallet();
    this._heroKey = null;   // מכריח ציור מחדש של הדמות על הבמה
  },

  gameOver() {
    this.state = 'over';
    Sound.stopMusic();
    Sound.gameOver();
    FX.addShake(22);

    const isBest = this.score > this.best;
    if (isBest) {
      this.best = Math.floor(this.score);
      U.store.set(CFG.keys.best, this.best);
    }

    /* שיא לכל מפה בנפרד — כדי שמפה קשה לא "תיראה גרועה" מול הסלון */
    const mid = this.map.id;
    if (this.score > (this.bestMap[mid] || 0)) {
      this.bestMap[mid] = Math.floor(this.score);
      U.store.set(CFG.keys.bestMap, this.bestMap);
    }

    /* --- גביעים: עולים על ריצה טובה, יורדים על ריצה חלשה --- */
    const t = CFG.trophy;
    let dTrophy;
    if (this.wave > t.freeWaves) dTrophy = (this.wave - t.freeWaves) * t.perWave;
    else dTrophy = t.lossOnBad;
    /* לא יורדים מתחת לאפס — שלא ייתקע במינוס ויאבד גישה למפות */
    dTrophy = Math.max(dTrophy, -this.trophies);
    this.trophies = U.clamp(this.trophies + dTrophy, 0, t.max);
    this.runTrophies = dTrophy;
    U.store.set(CFG.keys.trophies, this.trophies);

    /* --- מטבעות שנצברו --- */
    this.addCoins(this.runCoins);

    /* צבע חותמת ה'נפסלת!' — לפי מה שמצויד בחנות (ברירת מחדל: צבע ה-CSS) */
    const stamp = this.equipped.stamp && CFG.shopItems.find(s => s.id === this.equipped.stamp);
    document.getElementById('overStamp').style.color = (stamp && stamp.color) || '';

    document.getElementById('ovScore').textContent = U.numStr(this.score);
    document.getElementById('ovWave').textContent = this.wave;
    document.getElementById('ovTime').textContent = U.timeStr(this.runTime);
    document.getElementById('overNick').textContent = U.pick(CFG.nicknames);
    document.getElementById('ovBest').textContent =
      isBest ? 'שיא חדש!' : 'השיא שלך: ' + U.numStr(this.best);
    document.getElementById('ovCoins').textContent = U.numStr(this.runCoins);

    const tw = document.getElementById('ovTrophyWrap');
    document.getElementById('ovTrophy').textContent = (dTrophy >= 0 ? '+' : '') + dTrophy;
    tw.classList.toggle('down', dTrophy < 0);

    this.syncWallet();
    setTimeout(() => this.show('over'), 620);
  },

  /* ============================================================
     גלים
     ============================================================ */
  startWave(first) {
    if (!first) {
      this.addScore(CFG.score.waveClear, this.player.x, this.player.y - 40,
                    'גל ' + (this.wave - 1) + ' הושלם');
      this.runCoins += CFG.coin.perWave;
      FX.text(this.player.x, this.player.y - 74, '+' + CFG.coin.perWave + ' מטבעות', {
        size: 16, color: '#ffcc3d', life: 1.2, vy: -34
      });

      /* "בפוקס" — סיכוי קטן שסטיקר נדיר פשוט נופל עליך */
      if (this.wave >= CFG.collect.luckyMinWave && U.chance(CFG.collect.luckyChance)) {
        this.spawnCollectible(true);
      }
    }

    /* כמה חברה אמורים להיות בזירה.
       מפה גדולה עם אותה כמות חברה מרגישה ריקה ודווקא *קלה* יותר —
       לכן הכמות והתקרה גדלות ביחס לשטח המפה מול הסלון המקורי. */
    const area = (this.map.w * this.map.h) / (CFG.maps[0].w * CFG.maps[0].h);
    const crowd = Math.min(1.85, Math.sqrt(area));
    const desired = Math.min(
      Math.round(CFG.wave.maxAlive * crowd),
      Math.round((CFG.wave.startCount + CFG.wave.perWave * (this.wave - 1)) * crowd)
    );
    const alive = this.foes.length + this.spawnMarks.length;
    const toSpawn = Math.max(first ? desired : 1, desired - alive);

    /* אילו סוגים פתוחים — רק אלה שהמפה הנוכחית מגדירה.
       זה מה שגורם למפה להרגיש שונה ולא רק להיראות שונה. */
    const roster = this.map.foes;
    const pool = [];
    for (const key of roster) {
      const d = CFG.foes[key];
      if (d && this.wave >= d.unlock) {
        for (let i = 0; i < d.weight; i++) pool.push(key);
      }
    }
    /* גל מוקדם מאוד במפה שאין בה 'רודף' — שלא ייווצר גל ריק */
    if (!pool.length) pool.push(roster[0]);

    for (let i = 0; i < toSpawn; i++) {
      /* בגל שבו סוג חדש נפתח — מבטיחים שהוא יופיע */
      let type = U.pick(pool);
      if (i === 0) {
        for (const key of roster) {
          if (CFG.foes[key] && CFG.foes[key].unlock === this.wave) { type = key; break; }
        }
      }
      this.queueSpawn(type, 0.35 + i * CFG.wave.spawnStagger);
    }

    this.banner = { t: 0, dur: 2.2, wave: this.wave };
    Sound.wave();

    /* "סיישל" בכל גל שלישי — מחכה שהבאנר של הגל יספיק להיקרא,
       אחרת שתי הכותרות נחתכות זו בזו במרכז המסך. */
    if (this.wave % 3 === 0) this.seyDelay = 2.4;   // אחרי שהבאנר נעלם לגמרי

    Sound.setIntensity(U.clamp((this.wave - 1) / 12, 0, 1));
  },

  queueSpawn(type, delay) {
    /* נקודה בטבעת סביב השחקן: רחוק מספיק כדי להיות הוגן, קרוב מספיק
       כדי שלא יבזבזו חצי גל בהליכה. במפה גדולה, הופעה בפינה הרחוקה
       פשוט מרוקנת את הזירה — לכן הטבעת ולא היקף המפה. */
    const m = CFG.WALL + 52;
    const mt = CFG.WALL_TOP + 52;
    let x = 0, y = 0, ok = false;

    for (let tries = 0; tries < 70 && !ok; tries++) {
      const ang = U.rand(0, Math.PI * 2);
      const rad = U.rand(340, 560);
      x = U.clamp(this.player.x + Math.cos(ang) * rad, m, CFG.worldW - m);
      y = U.clamp(this.player.y + Math.sin(ang) * rad, mt, CFG.worldH - m);

      ok = U.dist(x, y, this.player.x, this.player.y) > 290;
      if (ok) {
        for (const ob of this.obstacles) {
          if (U.circleVsRect(x, y, 34, ob.x, ob.y, ob.w, ob.h)) { ok = false; break; }
        }
      }
    }
    this.spawnMarks.push({ x, y, type, t: 0, delay, dur: 0.75 });
  },

  /* ============================================================
     ניקוד ואפקטים
     ============================================================ */
  addScore(n, x, y, label) {
    this.score += n;
    if (x != null) {
      FX.text(x, y, (label ? label + ' ' : '') + '+' + U.numStr(n), {
        size: label ? 19 : 22,
        color: '#ffcc3d',
        life: label ? 1.3 : 0.95
      });
    }
  },

  bumpCombo() {
    this.combo = Math.min(CFG.combo.max, this.combo + 1);
    this.comboTimer = CFG.combo.decay;
    if (this.combo === CFG.combo.max) this.triggerSeychelles(false);
  },

  triggerSeychelles(fromPickup) {
    if (this.sey && this.sey.t < 0.8) return;   // לא להציף
    this.sey = { t: 0, dur: 2.15 };
    Sound.glitter();
    /* מרכז *התצוגה* מומר לקואורדינטות עולם — האפקטים חיים בעולם */
    const wx = this.cam.x + CFG.W / 2, wy = this.cam.y + CFG.H / 2;
    FX.glitter(wx, wy, 70);
    FX.addShake(6);
    if (fromPickup) {
      this.addScore(CFG.score.seychelles, wx, wy + 90);
      FX.confetti(wx, wy, 60);
    }
  },

  /* ============================================================
     חטיפת סטיקר
     ============================================================ */
  takeHit(sourceX, sourceY) {
    const p = this.player;
    if (p.safe || this.slap) return;

    /* כל חמשת הסטיקרים בריצה אחת חייבים להיות שונים */
    let idx = Assets.nextIndex();
    for (let tries = 0; tries < 24 && this.usedStickers.indexOf(idx) !== -1; tries++) {
      idx = Assets.nextIndex();
    }
    this.usedStickers.push(idx);

    const slotIndex = this.stickers.length;
    const slot = SLOTS[Math.min(slotIndex, SLOTS.length - 1)];

    /* שים לב: כאן *לא* נפתח הסטיקר באוסף.
       פתיחה בגלריה עברה ל-collectSticker() — זוכים בניצחון, לא בהפסד. */

    this.slap = {
      index: idx,
      slot,
      slotIndex,
      t: 0,
      dur: 1.35,
      line: U.pick(CFG.hitLines),
      fromX: sourceX == null ? CFG.W / 2 : sourceX,
      fromY: sourceY == null ? CFG.H / 2 : sourceY,
      done: false
    };

    p.iFrames = CFG.player.hitIFrames;
    this.combo = 1;
    this.comboTimer = 0;

    Sound.slap();
    FX.addShake(20);
    FX.burst(p.x, p.y, 22, {
      speedMin: 100, speedMax: 380, rMin: 2, rMax: 6,
      lifeMin: 0.3, lifeMax: 0.75, grav: 300,
      colors: ['#ff3b6b', '#ffffff', '#ffcc3d']
    });
    FX.ring(p.x, p.y, { r0: 10, r1: 130, life: 0.5, color: 'rgba(255,59,107,.85)', width: 6 });
  },

  /* ============================================================
     שדרוגים
     ============================================================ */
  /* מקום פנוי בזירה, לא צמוד לשחקן ולא בתוך מכשול.
     מוגבל לאזור סביב המצלמה כדי שלא ייפול משהו בקצה השני של מפה ענקית. */
  freeSpot(pad, minFromPlayer) {
    const m = CFG.WALL + pad, mt = CFG.WALL_TOP + pad;
    let x = 0, y = 0;
    for (let t = 0; t < 70; t++) {
      x = U.clamp(this.cam.x + U.rand(m, CFG.W - m), m, CFG.worldW - m);
      y = U.clamp(this.cam.y + U.rand(mt, CFG.H - m), mt, CFG.worldH - m);
      if (U.dist(x, y, this.player.x, this.player.y) < minFromPlayer) continue;
      let hit = false;
      for (const ob of this.obstacles) {
        if (U.circleVsRect(x, y, pad, ob.x, ob.y, ob.w, ob.h)) { hit = true; break; }
      }
      if (!hit) return { x, y };
    }
    return { x, y };
  },

  spawnPickup() {
    /* וואגיו הוא מנגנון חזרה למשחק, לא שדרוג שגרתי:
       מופיע רק אחרי שכבר נדבק סטיקר, ולכן weight=0 בטבלה. */
    let kind;
    if (U.chance(CFG.pickup.seychellesChance)) kind = 'sey';
    else if (this.stickers.length >= 1 && U.chance(0.32)) kind = 'wagyu';
    else {
      /* הגרלה משוקללת — כאן חי הנרף לפאנישר (weight נמוך) */
      const pool = [];
      for (const k in CFG.power) {
        const w = CFG.power[k].weight || 0;
        for (let i = 0; i < w; i++) pool.push(k);
      }
      kind = U.pick(pool);
    }

    const s = this.freeSpot(70, 130);
    this.pickups.push(new Pickup(kind, s.x, s.y));
    FX.ring(s.x, s.y, { r0: 4, r1: 60, life: 0.5, color: CFG.power[kind].color + 'cc' });
  },

  /* ============================================================
     סטיקר לאיסוף — הערוץ החדש לפתיחת האוסף
     ============================================================ */
  spawnCollectible(lucky) {
    /* בוחרים סטיקר שעוד לא נאסף. אם הכל נאסף — אין מה להפיל. */
    const pool = [];
    for (let i = 0; i < CFG.stickers.length; i++) {
      if (this.unlocked[i]) continue;
      const st = CFG.stickers[i];
      const set = CFG.sets[st.set] || { mult: 1, map: null };
      /* סט שנעול למפה מסוימת לא יופיע במפה אחרת */
      if (set.map && set.map !== this.map.id) continue;
      const tier = CFG.rarity.tiers[st.tier || 'רגיל'] || CFG.rarity.tiers['רגיל'];
      /* נדירות בפועל = משקל הדרגה × מכפיל הסט */
      const w = Math.max(1, Math.round(tier.weight * (set.mult == null ? 1 : set.mult)));
      for (let k = 0; k < w; k++) pool.push(i);
    }
    if (!pool.length) return;

    const idx = U.pick(pool);
    /* "בפוקס" נוחת ממש לידך; רגיל מופיע בזירה ודורש להגיע אליו */
    const s = lucky ? this.freeSpot(50, 60) : this.freeSpot(60, 190);
    this.collects.push(new Collectible(idx, s.x, s.y));

    const tdef = CFG.rarity.tiers[CFG.stickers[idx].tier || 'רגיל'];
    FX.ring(s.x, s.y, { r0: 6, r1: 90, life: 0.6, color: tdef.color, width: 4 });
    Sound.glitter();
    if (lucky) {
      FX.text(s.x, s.y - 58, 'בפוקס!', { size: 24, color: tdef.color, life: 1.6, vy: -30 });
      FX.confetti(s.x, s.y, 30);
    }
  },

  collectSticker(c) {
    this.unlocked[c.index] = true;
    U.store.set(CFG.keys.unlocked, this.unlocked);

    const bonus = Math.round(60 / Math.max(1, c.def.weight / 12));
    this.runCoins += bonus;
    this.addScore(300, c.x, c.y - 30, c.tier);

    FX.confetti(c.x, c.y, 34);
    FX.ring(c.x, c.y, { r0: 8, r1: 120, life: 0.55, color: c.def.color, width: 5 });
    FX.text(c.x, c.y - 62, 'נוסף לאוסף!', { size: 22, color: c.def.color, life: 1.7, vy: -34 });
    FX.text(c.x, c.y - 92, '+' + bonus + ' מטבעות', { size: 15, color: '#ffcc3d', life: 1.5, vy: -30 });
    Sound.glitter();
    if (c.def.glow >= 1) this.triggerSeychelles(false);
  },

  /* ============================================================
     יהלי עונה לחבר'ה — "אמאשך" + מה שהם אמרו
     ============================================================ */
  yehaliReply(line) {
    if (!U.chance(CFG.yehaliTalk.chance)) return;
    const d = CFG.yehaliTalk.delay;
    const text = U.chance(0.72)
      ? CFG.yehaliTalk.prefix + line.replace(/[!.]+$/, '')
      : U.pick(CFG.yehaliTalk.solo);
    this.replyQueue.push({ t: U.rand(d[0], d[1]), text });
  },

  /* ============================================================
     יהלי פיצה — זריקה אוטומטית על הקרוב ביותר
     ============================================================ */
  throwPizza() {
    const p = this.player;
    let best = null, bestD = CFG.pizzaShot.range;
    for (const f of this.foes) {
      if (f.untouchable) continue;
      const d = U.dist(f.x, f.y, p.x, p.y);
      if (d < bestD) { bestD = d; best = f; }
    }
    if (!best) return;
    const n = U.norm(best.x - p.x, best.y - p.y);
    this.pizzas.push(new Pizza(p.x + n.x * 20, p.y + n.y * 20 - 6, n.x, n.y));
    Sound.tone(520, 0.07, { type: 'triangle', vol: 0.06, filter: 2200 });
  },

  /* ============================================================
     גולאש — אגרוף בטן שמפיל את כל מי שסביב
     ============================================================ */
  goulashSlam() {
    const p = this.player;
    const g = CFG.goulash;
    let hits = 0;

    for (let i = this.foes.length - 1; i >= 0; i--) {
      const f = this.foes[i];
      const d = U.dist(f.x, f.y, p.x, p.y);
      if (d > g.radius) continue;
      f.knockOut();
      this.addScore(CFG.score.knockout * this.combo, f.x, f.y - 40);
      this.foes.splice(i, 1);
      hits++;
    }

    FX.ring(p.x, p.y, { r0: 14, r1: g.radius, life: 0.5, color: 'rgba(224,86,59,.9)', width: 8 });
    FX.ring(p.x, p.y, { r0: 8, r1: g.radius * 0.7, life: 0.34, color: 'rgba(255,255,255,.65)', width: 4 });
    FX.burst(p.x, p.y, 28, {
      speedMin: 120, speedMax: 460, rMin: 2, rMax: 7,
      lifeMin: 0.3, lifeMax: 0.8, grav: 320,
      colors: ['#e0563b', '#ffcc3d', '#ffffff']
    });
    FX.addShake(18);
    Sound.knockout();
    FX.text(p.x, p.y - 60, hits ? 'גולאש! ×' + hits : 'גולאש!', {
      size: 24, color: '#ff7a5c', life: 1.5, vy: -36
    });
  },

  applyPickup(pk) {
    const p = this.player;
    Sound.pickup(pk.kind);
    FX.burst(pk.x, pk.y, 22, {
      speedMin: 60, speedMax: 260, rMin: 2, rMax: 5,
      lifeMin: 0.3, lifeMax: 0.7,
      colors: [pk.def.color, '#ffffff']
    });
    FX.ring(pk.x, pk.y, { r0: 8, r1: 96, life: 0.45, color: pk.def.color });

    switch (pk.kind) {

      /* דואלינגו: כולם עוצרים ומסתכלים על יהלי לומד ספרדית.
         דואלינגו+ הוא אותו דבר בדיוק, רק ארוך בהרבה. */
      case 'duo':
      case 'duoPro': {
        this.powers.duo = pk.def.dur;
        for (const f of this.foes) f.frozen = pk.def.dur;
        FX.text(p.x, p.y - 56, 'רגע, אני לומד דואלינגו', {
          size: pk.kind === 'duoPro' ? 24 : 21, color: pk.def.color, life: 1.7
        });
        /* בועות הספרדית מתחילות אחרי שהכיתוב הראשי נקרא */
        this.duoTalk = { t: 0.9, left: pk.def.dur - 0.6, i: U.randInt(0, CFG.duoLines.length - 1) };
        if (pk.kind === 'duoPro') FX.confetti(p.x, p.y, 26);
        break;
      }

      case 'pizza':
        this.powers.pizza = pk.def.dur;
        p.pizzaTimer = 0.25;
        FX.text(p.x, p.y - 56, 'יהלי פיצה!', { size: 22, color: '#ff8a3d', life: 1.5 });
        break;

      case 'goulash':
        this.goulashSlam();
        break;

      case 'boeing':
        this.powers.boeing = pk.def.dur;
        p.speedMult = CFG.boeingMult;
        p.freeDash = true;
        FX.text(p.x, p.y - 56, 'זה בואינג 737', { size: 21, color: '#6ce0ff', life: 1.5 });
        break;

      case 'wagyu':
        if (this.stickers.length > 0) {
          const s = this.stickers.pop();
          FX.confetti(s.x, s.y, 26);
          FX.text(p.x, p.y - 56, 'קילפת סטיקר!', { size: 22, color: '#ff7a9c', life: 1.5 });
        } else {
          FX.text(p.x, p.y - 56, 'וואגיו A5 נקי', { size: 21, color: '#ff7a9c', life: 1.4 });
        }
        break;

      case 'pun':
        this.powers.pun = pk.def.dur;
        p.invincible = true;
        FX.text(p.x, p.y - 56, 'הפאנישר באודיסאה!', { size: 21, color: '#ffffff', life: 1.5 });
        break;

      case 'sey':
        this.triggerSeychelles(true);
        break;
    }

    if (pk.kind !== 'sey') this.addScore(CFG.score.pickup, pk.x, pk.y - 30);
  },

  spawnShot(x, y, dx, dy) {
    this.shots.push(new Shot(x, y, dx, dy, Assets.nextIndex()));
    Sound.shoot();
  },

  /* ============================================================
     לולאה
     ============================================================ */
  frame(now) {
    this.raf = requestAnimationFrame((t) => this.frame(t));

    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;          // הגנה מקפיצות אחרי טאב מוסתר
    this.time += dt;

    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'over') FX.update(dt);

    this.render();
    Input.endFrame();
  },

  update(dt) {
    /* --- הילוך איטי בזמן הדבקת סטיקר --- */
    if (this.slap) {
      this.slap.t += dt;
      this.timeScale = 0.1;
      if (this.slap.t >= this.slap.dur) {
        const s = this.slap;
        const sl = s.slot;
        this.stickers.push({
          index: s.index, x: sl.x, y: sl.y, rot: sl.rot, w: sl.w,
          settle: 0
        });
        this.slap = null;
        FX.addShake(9);
        if (this.stickers.length >= CFG.maxStickers) { this.gameOver(); return; }
      }
    } else {
      this.timeScale = U.damp(this.timeScale, 1, 0.25, dt);
    }

    const gdt = dt * this.timeScale;

    this.runTime += gdt;
    this.score += CFG.score.perSecond * gdt;

    /* --- שדרוגים פעילים --- */
    for (const k in this.powers) {
      this.powers[k] -= gdt;
      if (this.powers[k] <= 0) {
        delete this.powers[k];
        if (k === 'boeing') { this.player.speedMult = 1; this.player.freeDash = false; }
        if (k === 'pun') this.player.invincible = false;
      }
    }

    /* --- קומבו --- */
    if (this.comboTimer > 0) {
      this.comboTimer -= gdt;
      if (this.comboTimer <= 0 && this.combo > 1) {
        this.combo = Math.max(1, this.combo - 1);
        if (this.combo > 1) this.comboTimer = CFG.combo.decay;
      }
    }

    /* --- גלים --- */
    this.waveTimer -= gdt;
    if (this.waveTimer <= 0) {
      this.wave++;
      this.waveTimer = CFG.wave.duration;
      this.startWave(false);
    }

    /* --- הופעות --- */
    for (let i = this.spawnMarks.length - 1; i >= 0; i--) {
      const m = this.spawnMarks[i];
      m.delay -= gdt;
      if (m.delay > 0) continue;
      m.t += gdt;
      if (m.t >= m.dur) {
        const f = new Foe(m.type, m.x, m.y, this.wave);
        if (this.powers.duo) f.frozen = this.powers.duo;
        this.foes.push(f);
        FX.ring(m.x, m.y, { r0: 10, r1: 70, life: 0.35, color: CFG.foes[m.type].color });
        this.spawnMarks.splice(i, 1);
      }
    }

    /* --- שחקן --- */
    this.player.update(gdt, this);

    /* --- שדרוגים על הרצפה --- */
    this.pickupTimer -= gdt;
    if (this.pickupTimer <= 0) {
      this.pickupTimer = U.rand(CFG.pickup.every[0], CFG.pickup.every[1]);
      if (this.pickups.length < 3) this.spawnPickup();
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (!pk.update(gdt)) { this.pickups.splice(i, 1); continue; }
      if (U.dist(pk.x, pk.y, this.player.x, this.player.y) < pk.r + this.player.r + 4) {
        this.applyPickup(pk);
        this.pickups.splice(i, 1);
      }
    }

    /* --- סטיקרים לאיסוף --- */
    this.collectTimer -= gdt;
    if (this.collectTimer <= 0) {
      this.collectTimer = U.rand(CFG.collect.every[0], CFG.collect.every[1]);
      if (this.collects.length < 2) this.spawnCollectible(false);
    }
    for (let i = this.collects.length - 1; i >= 0; i--) {
      const c = this.collects[i];
      if (!c.update(gdt)) { this.collects.splice(i, 1); continue; }
      if (U.dist(c.x, c.y, this.player.x, this.player.y) < c.r + this.player.r + 6) {
        this.collectSticker(c);
        this.collects.splice(i, 1);
      }
    }

    /* --- שלוליות --- */
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      if (!this.puddles[i].update(gdt)) this.puddles.splice(i, 1);
    }

    /* --- פיצות --- */
    for (let i = this.pizzas.length - 1; i >= 0; i--) {
      const pz = this.pizzas[i];
      if (!pz.update(gdt, this)) {
        FX.burst(pz.x, pz.y, 9, {
          speedMin: 40, speedMax: 170, rMin: 2, rMax: 4,
          lifeMin: 0.2, lifeMax: 0.45, colors: ['#ffcf7a', '#d8442f']
        });
        this.pizzas.splice(i, 1);
        continue;
      }
      /* פיצה מפילה חבר — הדרך של יהלי פיצה לנקות את הזירה */
      let done = false;
      for (let j = this.foes.length - 1; j >= 0 && !done; j--) {
        const f = this.foes[j];
        if (f.untouchable) continue;
        if (U.dist(pz.x, pz.y, f.x, f.y) < pz.r + f.r) {
          f.knockOut();
          this.addScore(CFG.score.knockout * this.combo, f.x, f.y - 40);
          this.foes.splice(j, 1);
          this.pizzas.splice(i, 1);
          FX.addShake(6);
          done = true;
        }
      }
    }

    /* --- יהלי לומד ספרדית (בועות הדואלינגו) --- */
    if (this.duoTalk) {
      this.duoTalk.left -= gdt;
      this.duoTalk.t -= gdt;
      if (this.duoTalk.t <= 0 && this.duoTalk.left > 0.4) {
        this.duoTalk.t = U.rand(1.3, 1.9);
        const line = CFG.duoLines[this.duoTalk.i % CFG.duoLines.length];
        this.duoTalk.i++;
        FX.text(this.player.x, this.player.y - 58, line, {
          size: 18, color: '#9bff5b', life: 1.5, vy: -26
        });
      }
      if (this.duoTalk.left <= 0) this.duoTalk = null;
    }

    /* --- תשובות של יהלי, בהשהיה כדי שלא ידברו יחד --- */
    for (let i = this.replyQueue.length - 1; i >= 0; i--) {
      const r = this.replyQueue[i];
      r.t -= gdt;
      if (r.t <= 0) {
        FX.text(this.player.x, this.player.y - 56, r.text, {
          size: 17, color: '#ffcc3d', life: 1.35, vy: -30
        });
        this.replyQueue.splice(i, 1);
      }
    }

    /* --- מטבעות מניקוד: כל 1000 נקודות --- */
    while (this.score - this.coinScoreMark >= 1000) {
      this.coinScoreMark += 1000;
      this.runCoins += CFG.coin.per1000;
    }

    /* --- חברה --- */
    for (let i = this.foes.length - 1; i >= 0; i--) {
      const f = this.foes[i];
      f.update(gdt, this);
      if (f.dead) { this.foes.splice(i, 1); continue; }

      const d = U.dist(f.x, f.y, this.player.x, this.player.y);
      const touch = f.r + this.player.r - 3;

      /* קופץ באוויר עובר מעליך — לא פוגע ולא נפגע */
      if (f.untouchable) continue;

      if (d < touch) {
        if (this.player.invincible) {
          f.knockOut();
          this.addScore(CFG.score.knockout * this.combo, f.x, f.y - 40);
          this.foes.splice(i, 1);
          FX.addShake(7);
          continue;
        }
        if (!this.player.safe) {
          this.takeHit(f.x, f.y);
          continue;
        }
      }

      /* "כמעט!" — חמק ממש בקצה */
      if (f.frozen <= 0 && !this.player.safe) {
        const gap = d - (f.r + this.player.r);
        if (gap < CFG.combo.nearMissDist) {
          f._near = true;
          f._nearMin = Math.min(f._nearMin == null ? 999 : f._nearMin, gap);
        } else if (f._near) {
          f._near = false;
          if (f._nearMin < CFG.combo.nearMissDist * 0.55) {
            this.bumpCombo();
            this.addScore(CFG.score.nearMiss * this.combo, this.player.x, this.player.y - 46, 'כמעט!');
            /* מטבעות רק בקומבו מקסימלי — תגמול על ביצוע, לא על כל חמיקה */
            if (this.combo >= CFG.combo.max) this.runCoins += CFG.coin.perCombo;
            Sound.nearMiss();
            FX.ring(this.player.x, this.player.y, {
              r0: 18, r1: 58, life: 0.3, color: 'rgba(255,255,255,.45)', width: 2
            });
          }
          f._nearMin = 999;
        }
      }
    }

    /* --- קליעים --- */
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (!s.update(gdt, this)) {
        FX.burst(s.x, s.y, 8, {
          speedMin: 30, speedMax: 130, rMin: 2, rMax: 4,
          lifeMin: 0.2, lifeMax: 0.4, colors: ['rgba(201,139,255,.8)', '#fff']
        });
        this.shots.splice(i, 1);
        continue;
      }
      if (U.dist(s.x, s.y, this.player.x, this.player.y) < s.r + this.player.r - 2) {
        if (this.player.invincible) {
          FX.burst(s.x, s.y, 12, { speedMin: 60, speedMax: 200, colors: ['#fff', '#ffcc3d'] });
          this.shots.splice(i, 1);
        } else if (!this.player.safe) {
          this.takeHit(s.x, s.y);
          this.shots.splice(i, 1);
        }
      }
    }

    /* --- סיישל מושהה של תחילת גל --- */
    if (this.seyDelay > 0) {
      this.seyDelay -= dt;
      if (this.seyDelay <= 0) this.triggerSeychelles(false);
    }

    /* --- אירוע סיישל --- */
    if (this.sey) {
      this.sey.t += dt;
      if (this.sey.t < 1.2 && Math.random() < dt * 34) {
        FX.glitter(this.cam.x + U.rand(0, CFG.W),
                   this.cam.y + U.rand(CFG.H * 0.2, CFG.H * 0.8), 2);
      }
      if (this.sey.t >= this.sey.dur) this.sey = null;
    }

    /* --- באנר גל --- */
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }

    /* --- התיישבות הסטיקרים --- */
    for (const s of this.stickers) {
      if (s.settle < 1) s.settle = Math.min(1, s.settle + dt * 3.2);
    }

    FX.update(dt);
    this.updateCamera(dt, false);

    /* עצימות המוזיקה לפי כמה לחוץ המצב */
    const danger = U.clamp(this.foes.length / 9, 0, 1) * 0.6 +
                   U.clamp(this.stickers.length / CFG.maxStickers, 0, 1) * 0.4;
    Sound.setIntensity(Math.max(U.clamp((this.wave - 1) / 12, 0, 1), danger));
  },

  /* ============================================================
     ציור
     ============================================================ */
  render() {
    /* מסך הבית הוא DOM מלא ומכסה את הקנבס — אין טעם לצייר עולם מתחתיו,
       רק את הדמות שעל הבמה (שהיא קנבס נפרד ב-DOM). */
    if (this.state === 'menu') { this.renderHero(); return; }

    const ctx = this.ctx;
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    ctx.clearRect(0, 0, CFG.W, CFG.H);

    /* ---- עולם (עם רעידה ומצלמה) ----
       כל מה שבתוך הבלוק הזה נמצא בקואורדינטות עולם.
       מה שאחריו (סטיקרים, HUD, באנרים) הוא קואורדינטות מסך. */
    ctx.save();
    ctx.translate(FX.shakeX, FX.shakeY);
    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));

    /* מרווח קטן מסביב לחלון — כדי שרעידת המסך לא תחשוף שוליים לא מצוירים */
    const view = { x: this.cam.x - 40, y: this.cam.y - 40, w: CFG.W + 80, h: CFG.H + 80 };
    Art.floor(ctx, CFG.worldW, CFG.worldH, this.time, this.map && this.map.pal, view);

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'over') {
      this.drawWorld(ctx);
    } else {
      this.drawIdleScene(ctx);
    }
    ctx.restore();

    if (this.state === 'playing') this.drawOffscreenHints(ctx);
    Art.vignette(ctx, CFG.W, CFG.H);
    ctx.restore();

    /* ---- שכבות מסך (בלי רעידה) ---- */
    if (this.state !== 'menu' && this.state !== 'loading') {
      this.drawStickers(ctx);
      this.drawPlayerBeacon(ctx);
      this.drawHUD(ctx);
      if (this.slap) this.drawSlap(ctx);
      if (this.banner) this.drawBanner(ctx);
    }
    if (this.sey) this.drawSeychelles(ctx);
  },

  drawWorld(ctx) {
    /* שלוליות — מתחת לכולם, הן על הרצפה */
    for (const pd of this.puddles) pd.draw(ctx, this.time);

    /* מכשולים */
    for (const ob of this.obstacles) Art.obstacle(ctx, ob);

    /* סימוני הופעה */
    for (const m of this.spawnMarks) {
      if (m.delay > 0) continue;
      const k = m.t / m.dur;
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(this.time * 18) * 0.16;
      ctx.strokeStyle = CFG.foes[m.type].color;
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -this.time * 40;
      U.circle(ctx, m.x, m.y, 30 - k * 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = CFG.foes[m.type].color;
      ctx.textAlign = 'center';
      ctx.font = '900 13px "Segoe UI","Arial Hebrew",Arial,sans-serif';
      ctx.fillText(CFG.foes[m.type].name, m.x, m.y - 40);
      ctx.restore();
    }

    /* שדרוגים וסטיקרים לאיסוף */
    for (const pk of this.pickups) pk.draw(ctx, this.time);
    for (const c of this.collects) c.draw(ctx, this.time);

    FX.drawRings(ctx);

    /* החברה — ממוינים לפי Y לעומק נכון */
    const cast = this.foes.slice().sort((a, b) => a.y - b.y);
    for (const c of cast) c.draw(ctx, this.time);

    /* יהלי מצויר תמיד אחרון, מעל כולם. בערימה של תשעה חברים
       חשוב יותר לראות את עצמך מאשר לשמור על סדר עומק מדויק. */
    if (this.player) {
      this.player.drawMarker(ctx, this.time);
      this.player.draw(ctx, this.time);
    }

    /* קליעים */
    for (const s of this.shots) s.draw(ctx);
    for (const pz of this.pizzas) pz.draw(ctx);

    FX.drawParticles(ctx);
    FX.drawTexts(ctx);
  },

  /* ============================================================
     חיצים בקצה המסך למה שחשוב ונמצא מחוץ לתצוגה.
     בלי זה, מפה גדולה = לחטוף ממישהו שלא ראית, וזה לא הוגן.
     ============================================================ */
  drawOffscreenHints(ctx) {
    const pad = 26;
    const cx = this.cam.x, cy = this.cam.y;

    const mark = (wx, wy, color, size) => {
      const sx = wx - cx, sy = wy - cy;
      if (sx > -40 && sx < CFG.W + 40 && sy > -40 && sy < CFG.H + 40) return;

      /* נקודת החיתוך של הקו מהמרכז אל האובייקט עם מסגרת המסך */
      const mx = CFG.W / 2, my = CFG.H / 2;
      const dx = sx - mx, dy = sy - my;
      const halfW = CFG.W / 2 - pad, halfH = CFG.H / 2 - pad;
      const s = Math.min(halfW / Math.abs(dx || 1e-3), halfH / Math.abs(dy || 1e-3));
      const px = mx + dx * s, py = my + dy * s;
      const ang = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(10,7,18,.8)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.72, size * 0.62);
      ctx.lineTo(-size * 0.72, -size * 0.62);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    };

    /* סטיקרים לאיסוף ושדרוגים — שלא יתפספסו במפה ענקית */
    for (const c of this.collects) mark(c.x, c.y, c.def.color, 13);
    for (const pk of this.pickups) mark(pk.x, pk.y, pk.def.color, 10);
    /* חברה קרובים בלבד — אחרת המסך מתמלא חיצים */
    for (const f of this.foes) {
      if (U.dist(f.x, f.y, this.player.x, this.player.y) < 720) {
        mark(f.x, f.y, f.def.color, 8);
      }
    }
  },

  /* רקע חי לתפריט */
  drawIdleScene(ctx) {
    for (const ob of this.obstacles) Art.obstacle(ctx, ob);
    const t = this.time;

    /* הדמות ברקע התפריט לובשת את הסקין המצויד — אותו קאש כמו ב-Player.draw */
    const skin = this.equipped.skin && CFG.shopItems.find(s => s.id === this.equipped.skin);
    if (skin && skin.shirt) {
      if (!this._idleSkinCache || this._idleSkinCache.shirt !== skin.shirt) {
        this._idleSkinCache = Object.assign({}, Art.YEHALI, {
          shirt: skin.shirt,
          shirtDark: Art.darken(skin.shirt, 0.72)
        });
      }
    } else {
      this._idleSkinCache = null;
    }

    Art.person(ctx, {
      x: this.cam.x + CFG.W / 2 + Math.sin(t * 0.6) * 190,
      y: this.cam.y + CFG.H * 0.66 + Math.cos(t * 0.9) * 28,
      dir: Math.cos(t * 0.6) > 0 ? 1 : -1,
      walk: t * 6.5, scale: 1.35, squash: 1,
      colors: this._idleSkinCache || Art.YEHALI, style: 'yehali',
      blink: (Math.sin(t * 1.7) > 0.985)
    });
    FX.drawParticles(ctx);
  },

  /* ============================================================
     סטיקרים על המסך
     ============================================================ */
  drawSticker(ctx, index, x, y, rot, w, alpha) {
    const h = w * 1.33;
    const img = Assets.img(index);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);

    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fdfaf2';
    U.roundRect(ctx, -w / 2, -h / 2, w, h, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    const pad = w * 0.045;
    ctx.save();
    U.roundRect(ctx, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2, 6);
    ctx.clip();

    if (img && img.complete && img.naturalWidth) {
      Art._cover(ctx, img, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2);
    } else {
      /* גיבוי: כרטיס עם הכיתוב */
      ctx.fillStyle = '#3a2f5e';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      const cap = CFG.stickers[index] ? CFG.stickers[index].caption : '';
      this._wrapText(ctx, cap, 0, -h * 0.08, w * 0.82, w * 0.105, w * 0.13);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,0,0,.16)';
    ctx.lineWidth = 1.5;
    U.roundRect(ctx, -w / 2, -h / 2, w, h, 10);
    ctx.stroke();

    ctx.restore();
  },

  _wrapText(ctx, text, cx, cy, maxW, fontSize, lineH) {
    ctx.font = '800 ' + fontSize + 'px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    const startY = cy - (lines.length - 1) * lineH / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineH));
  },

  drawStickers(ctx) {
    for (const s of this.stickers) {
      const k = U.easeOutBack(s.settle);
      this.drawSticker(ctx, s.index, s.x, s.y, s.rot, s.w * (0.9 + k * 0.1), 0.96);
    }
  },

  /* אם יהלי מתחבא מתחת לסטיקר — מסמנים אותו כדי שלא יהיה לא הוגן.
     הסטיקרים הם שכבת מסך, ולכן ההשוואה נעשית בקואורדינטות מסך. */
  drawPlayerBeacon(ctx) {
    if (this.state !== 'playing' || !this.player) return;
    const px = this.player.x - this.cam.x;
    const py = this.player.y - this.cam.y;

    let covered = false;
    for (const s of this.stickers) {
      const dx = Math.abs(px - s.x), dy = Math.abs(py - s.y);
      if (dx < s.w * 0.62 && dy < s.w * 0.82) { covered = true; break; }
    }
    if (!covered) return;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffcc3d';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -this.time * 40;
    U.circle(ctx, px, py, 28 + Math.sin(this.time * 8) * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffcc3d';
    U.circle(ctx, px, py, 5);
    ctx.fill();
    ctx.restore();
  },

  /* אנימציית ההדבקה */
  drawSlap(ctx) {
    const s = this.slap;
    const k = s.t / s.dur;

    /* עמעום רקע */
    ctx.save();
    let dim = 0;
    if (k < 0.12) dim = (k / 0.12) * 0.5;
    else if (k < 0.68) dim = 0.5;
    else dim = 0.5 * (1 - (k - 0.68) / 0.32);
    ctx.fillStyle = 'rgba(6,4,12,' + dim + ')';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.restore();

    const cx = CFG.W / 2, cy = CFG.H / 2 - 16;
    const bigW = 336;

    let x, y, w, rot, alpha = 1;

    if (k < 0.14) {
      /* טיסה פנימה — גדול ומסתובב.
         fromX/fromY נשמרו בקואורדינטות עולם, כאן הכל מסך. */
      const e = U.easeOutCubic(k / 0.14);
      x = U.lerp(s.fromX - this.cam.x, cx, e);
      y = U.lerp(s.fromY - this.cam.y, cy, e);
      w = U.lerp(bigW * 2.4, bigW, e);
      rot = U.lerp(-0.9, 0.04, e);
      alpha = e;
    } else if (k < 0.70) {
      /* החזקה עם רטט קטן */
      const p = (k - 0.14) / 0.56;
      const wob = Math.sin(p * 26) * (1 - p) * 0.035;
      x = cx; y = cy;
      w = bigW * (1 + Math.sin(p * 20) * (1 - p) * 0.03);
      rot = 0.04 + wob;
    } else {
      /* נסיעה למקום הקבוע */
      const e = U.easeInOutQuad((k - 0.70) / 0.30);
      x = U.lerp(cx, s.slot.x, e);
      y = U.lerp(cy, s.slot.y, e);
      w = U.lerp(bigW, s.slot.w, e);
      rot = U.lerp(0.04, s.slot.rot, e);
    }

    this.drawSticker(ctx, s.index, x, y, rot, w, alpha);

    /* כיתוב "חטפת סטיקר" — מתחת לכרטיס, הרחק מרצועת ה-HUD */
    if (k > 0.16 && k < 0.72) {
      const a = Math.min(1, (k - 0.16) / 0.1) * Math.min(1, (0.72 - k) / 0.1);
      const ty = cy + bigW * 1.33 / 2 + 46;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.font = '900 42px "Segoe UI","Arial Hebrew",Arial,sans-serif';
      ctx.lineWidth = 9; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#140d20';
      ctx.strokeText(s.line, cx, ty);
      ctx.fillStyle = '#ff3b6b';
      ctx.fillText(s.line, cx, ty);
      ctx.restore();
    }
  },

  /* ============================================================
     "סיישל" בענק עם נצנצים
     ============================================================ */
  drawSeychelles(ctx) {
    const s = this.sey;
    const k = s.t / s.dur;

    let scale, alpha;
    if (k < 0.22) { scale = U.easeOutElastic(k / 0.22); alpha = Math.min(0.95, k / 0.08); }
    else if (k < 0.70) { scale = 1; alpha = 0.95; }
    else { const e = (k - 0.70) / 0.30; scale = 1 + e * 0.25; alpha = 0.95 * (1 - e); }

    /* מעט מעל המרכז — כדי שהחלק הפעיל של הזירה יישאר גלוי */
    const cx = CFG.W / 2, cy = CFG.H * 0.36;
    const wob = Math.sin(s.t * 5) * 0.02;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(-0.05 + wob);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';

    const size = 152;
    ctx.font = '900 ' + size + 'px "Segoe UI","Arial Hebrew",Arial,sans-serif';

    /* זוהר */
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.shadowColor = '#ffd93d';
    ctx.shadowBlur = 60;
    ctx.fillStyle = '#ffd93d';
    ctx.fillText('סיישל', 0, 0);
    ctx.restore();

    /* מתאר */
    ctx.lineWidth = 16; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3a2100';
    ctx.strokeText('סיישל', 0, 0);

    /* מילוי זהב מנצנץ */
    const g = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.6);
    const shift = (Math.sin(s.t * 3) * 0.5 + 0.5) * 0.25;
    g.addColorStop(0, '#fffbe6');
    g.addColorStop(U.clamp(0.26 + shift, 0.05, 0.7), '#ffd93d');
    g.addColorStop(U.clamp(0.55 + shift, 0.3, 0.9), '#ff9d1f');
    g.addColorStop(1, '#ffe98a');
    ctx.fillStyle = g;
    ctx.fillText('סיישל', 0, 0);

    /* ניצוצות ארבע־קרניים שרצים על האותיות */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const px = Math.sin(s.t * 3.4 + i * 1.7) * 260;
      const py = Math.cos(s.t * 2.6 + i * 2.3) * 54;
      const twinkle = Math.abs(Math.sin(s.t * 6 + i * 1.1));
      const r = 5 + twinkle * 13;

      const rg = ctx.createRadialGradient(px, py, 0, px, py, r * 0.9);
      rg.addColorStop(0, 'rgba(255,255,255,.9)');
      rg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = rg;
      U.circle(ctx, px, py, r * 0.9);
      ctx.fill();

      /* צלב הקרניים */
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + twinkle * 0.45) + ')';
      ctx.beginPath();
      ctx.moveTo(px, py - r * 2.2); ctx.lineTo(px + r * 0.30, py);
      ctx.lineTo(px, py + r * 2.2); ctx.lineTo(px - r * 0.30, py);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - r * 2.2, py); ctx.lineTo(px, py - r * 0.30);
      ctx.lineTo(px + r * 2.2, py); ctx.lineTo(px, py + r * 0.30);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  },

  /* ============================================================
     באנר גל
     ============================================================ */
  drawBanner(ctx) {
    const b = this.banner;
    const k = b.t / b.dur;
    let a = 1;
    if (k < 0.1) a = k / 0.1;
    else if (k > 0.75) a = (1 - k) / 0.25;

    const slide = k < 0.1 ? (1 - U.easeOutCubic(k / 0.1)) * 90 : 0;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.translate(CFG.W / 2 + slide, CFG.H * 0.30);

    ctx.font = '900 64px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.lineWidth = 12; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#140d20';
    ctx.strokeText('גל ' + b.wave, 0, 0);
    ctx.fillStyle = '#ffcc3d';
    ctx.fillText('גל ' + b.wave, 0, 0);

    /* איזה סוג נפתח עכשיו — רק מתוך הסוגים שקיימים במפה הזו */
    let newType = null;
    for (const key of this.map.foes) {
      if (CFG.foes[key] && CFG.foes[key].unlock === b.wave) newType = CFG.foes[key];
    }
    if (newType) {
      ctx.font = '800 26px "Segoe UI","Arial Hebrew",Arial,sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeText('נכנס למגרש: ' + newType.name, 0, 46);
      ctx.fillStyle = newType.color;
      ctx.fillText('נכנס למגרש: ' + newType.name, 0, 46);
    }
    ctx.restore();
  },

  /* ============================================================
     HUD
     ============================================================ */
  drawHUD(ctx) {
    const pad = 22;
    ctx.save();
    ctx.direction = 'rtl';

    /* ---- כמה סטיקרים חטף (שמאל למעלה) ---- */
    const left = this.stickers.length + (this.slap ? 1 : 0);
    for (let i = 0; i < CFG.maxStickers; i++) {
      const x = pad + 6 + i * 30;
      const y = pad + 8;
      const got = i < left;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(i % 2 ? 0.1 : -0.08);
      if (got) {
        ctx.fillStyle = '#ff3b6b';
        U.roundRect(ctx, -10, -12, 20, 24, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.62)';
        U.roundRect(ctx, -7, -9, 14, 14, 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.09)';
        U.roundRect(ctx, -10, -12, 20, 24, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 1.5;
        U.roundRect(ctx, -10, -12, 20, 24, 3); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.font = '700 12px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.fillText('סטיקרים', pad + 6 + CFG.maxStickers * 30 + 4, pad + 13);

    /* ---- ניקוד (מרכז למעלה) ---- */
    ctx.textAlign = 'center';
    ctx.font = '900 40px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.lineWidth = 8; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,7,18,.8)';
    ctx.strokeText(U.numStr(this.score), CFG.W / 2, pad + 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(U.numStr(this.score), CFG.W / 2, pad + 30);

    /* קומבו */
    if (this.combo > 1) {
      const pulse = 1 + Math.sin(this.time * 10) * 0.05;
      ctx.save();
      ctx.translate(CFG.W / 2, pad + 60);
      ctx.scale(pulse, pulse);
      ctx.font = '900 22px "Segoe UI","Arial Hebrew",Arial,sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(10,7,18,.8)';
      ctx.strokeText('קומבו ×' + this.combo, 0, 0);
      ctx.fillStyle = '#9bff5b';
      ctx.fillText('קומבו ×' + this.combo, 0, 0);
      ctx.restore();

      /* מד דעיכה */
      const kk = U.clamp(this.comboTimer / CFG.combo.decay, 0, 1);
      ctx.fillStyle = 'rgba(155,255,91,.55)';
      ctx.fillRect(CFG.W / 2 - 40, pad + 68, 80 * kk, 3);
    }

    /* ---- גל + טיימר (ימין למעלה) ---- */
    ctx.textAlign = 'right';
    ctx.font = '900 24px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10,7,18,.8)';
    ctx.strokeText('גל ' + this.wave, CFG.W - pad, pad + 22);
    ctx.fillStyle = '#ffcc3d';
    ctx.fillText('גל ' + this.wave, CFG.W - pad, pad + 22);

    const bw = 130;
    const bk = U.clamp(this.waveTimer / CFG.wave.duration, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    U.roundRect(ctx, CFG.W - pad - bw, pad + 32, bw, 6, 3); ctx.fill();
    ctx.fillStyle = '#ffcc3d';
    U.roundRect(ctx, CFG.W - pad - bw * bk, pad + 32, bw * bk, 6, 3); ctx.fill();

    ctx.font = '700 13px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillText(U.timeStr(this.runTime), CFG.W - pad, pad + 58);

    /* מטבעות שנצברו בריצה + שם המפה */
    ctx.font = '800 14px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.fillStyle = '#ffcc3d';
    ctx.fillText('● ' + U.numStr(this.runCoins), CFG.W - pad, pad + 80);
    ctx.font = '700 12px "Segoe UI","Arial Hebrew",Arial,sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.34)';
    ctx.fillText(this.map.name, CFG.W - pad, pad + 99);

    /* ---- שדרוגים פעילים (למטה במרכז) ---- */
    const keys = Object.keys(this.powers).filter(k => CFG.power[k].dur > 0);
    if (keys.length) {
      const bwid = 128, gap = 12;
      const total = keys.length * bwid + (keys.length - 1) * gap;
      let x = CFG.W / 2 - total / 2;
      const y = CFG.H - 52;

      for (const k of keys) {
        const def = CFG.power[k];
        const frac = U.clamp(this.powers[k] / def.dur, 0, 1);

        ctx.fillStyle = 'rgba(10,7,20,.6)';
        U.roundRect(ctx, x, y, bwid, 30, 15); ctx.fill();

        ctx.save();
        U.roundRect(ctx, x, y, bwid, 30, 15); ctx.clip();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = def.color;
        ctx.fillRect(x, y, bwid * frac, 30);
        ctx.restore();

        ctx.strokeStyle = def.color;
        ctx.lineWidth = 1.6;
        U.roundRect(ctx, x, y, bwid, 30, 15); ctx.stroke();

        Art.pickupIcon(ctx, def.glyph, x + 19, y + 15, 10, this.time);

        ctx.textAlign = 'center';
        ctx.font = '800 14px "Segoe UI","Arial Hebrew",Arial,sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(def.name, x + bwid / 2 + 12, y + 20);

        x += bwid + gap;
      }
    }

    /* ---- טיפ בגל הראשון ---- */
    if (this.wave === 1 && this.runTime < 7 && !this.slap) {
      ctx.globalAlpha = U.clamp((7 - this.runTime) / 2, 0, 1) * 0.8;
      ctx.textAlign = 'center';
      ctx.font = '700 17px "Segoe UI","Arial Hebrew",Arial,sans-serif';
      ctx.fillStyle = '#cfc6e0';
      ctx.fillText(Input.isTouch ? 'ג׳ויסטיק לתזוזה · כפתור לדאש'
                                 : 'WASD או חצים לתזוזה · רווח לדאש',
                   CFG.W / 2, CFG.H - 92);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
};

window.addEventListener('load', () => Game.init());
