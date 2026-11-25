'use strict';
G.Sound = window.Sound || new Proxy({}, { get: (t, k) => k === 'muted' ? false : function () {} });
// Unified input: keyboard, gamepad, touch. Actions: left right up down jump attack dash focus map pause interact
G.Input = (function () {
  const held = {}, pressed = {}, released = {};
  // keyboard + mouse, the usual PC platformer layout: A/D move, W/S aim up/down, Space jump, left mouse (or J) attack,
  // right mouse (or Shift) dash, Q heal / magic, E interact, Tab map, G dance, Esc pause. Every action can be rebound
  // in Settings (saved locally); arrow keys + Z/X/C always work as a second layout.
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'focus', 'interact', 'map', 'dance', 'pause'];
  const DEFAULT = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    jump: ['Space', 'KeyZ'], attack: ['KeyJ', 'KeyX'], dash: ['ShiftLeft', 'KeyC'], focus: ['KeyQ', 'KeyF'], interact: ['KeyE'],
    map: ['Tab', 'KeyM'], dance: ['KeyG'], pause: ['Escape', 'KeyP'] };
  let binds = JSON.parse(JSON.stringify(DEFAULT));
  try { const b = JSON.parse(localStorage.getItem('lastwick_binds')); if (b) for (const a of ACTIONS) if (Array.isArray(b[a]) && b[a].length) binds[a] = b[a]; } catch (e) { }
  let KEYMAP = {};
  function rebuild() { KEYMAP = { Enter: 'confirm', ShiftRight: 'dash', NumpadEnter: 'confirm' }; for (const a of ACTIONS) for (const k of binds[a]) KEYMAP[k] = a; }
  rebuild();
  function saveBinds() { try { localStorage.setItem('lastwick_binds', JSON.stringify(binds)); } catch (e) { } }
  let listening = null;   // settings: the next key pressed becomes this action's main key
  function keyName(code) {
    if (!code) return '—';
    const N = { Space: 'רווח', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter',
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Backspace: '⌫', CapsLock: 'Caps' };
    if (N[code]) return N[code]; if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5); return code;
  }
  let mouseOn = true;
  let lastDevice = 'kb';
  function down(a) { if (!held[a]) { pressed[a] = true; } held[a] = true; }
  function up(a) { if (held[a]) released[a] = true; held[a] = false; }
  const typing = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');   // a name field is open: let keys type
  addEventListener('keydown', e => {
    if (typing(e)) return;
    if (listening) {   // rebinding: this key becomes the action's first key (removed from any other action)
      e.preventDefault(); if (e.code === 'Escape') { listening = null; return; }
      const a = listening; for (const b of ACTIONS) binds[b] = binds[b].filter(k => k !== e.code);
      binds[a] = [e.code].concat(binds[a].filter(k => k !== e.code)).slice(0, 2); rebuild(); saveBinds(); listening = null; return;
    }
    const a = KEYMAP[e.code]; if (!a) return; e.preventDefault(); lastDevice = 'kb';
    if (e.repeat) return; down(a); if (a === 'jump' || a === 'confirm') down('confirm_any');
    if (G.Sound) G.Sound.init();
  });
  addEventListener('keyup', e => { if (typing(e)) return; const a = KEYMAP[e.code]; if (!a) return; up(a); if (a === 'jump' || a === 'confirm') up('confirm_any'); });
  addEventListener('blur', () => { for (const k in held) up(k); });
  // mouse: left button attacks, right button dashes - only while actually playing (in menus a click is a click)
  const inPlay = () => mouseOn && G.Main && G.Main.mode === 'play' && !(G.UI && G.UI.modal);
  addEventListener('mousedown', e => { if (!inPlay()) return; if (e.button === 0) { down('attack'); lastDevice = 'kb'; } else if (e.button === 2) down('dash'); });
  addEventListener('mouseup', e => { if (e.button === 0) up('attack'); else if (e.button === 2) up('dash'); });
  addEventListener('contextmenu', e => e.preventDefault());
  // gamepad
  const PADMAP = { 4: 'dance', 0: 'jump', 2: 'attack', 1: 'focus', 5: 'dash', 7: 'dash', 3: 'interact', 9: 'pause', 8: 'map', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const st = {};
      for (const i in PADMAP) if (p.buttons[i] && p.buttons[i].pressed) st[PADMAP[i]] = true;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.4) st.left = true; if (ax > 0.4) st.right = true; if (ay < -0.5) st.up = true; if (ay > 0.5) st.down = true;
      for (const a of ['jump', 'attack', 'focus', 'dash', 'interact', 'pause', 'map', 'dance', 'up', 'down', 'left', 'right']) {
        if (st[a] && !padPrev[a]) { down(a); lastDevice = 'pad'; if (a === 'jump') down('confirm_any'); }
        if (!st[a] && padPrev[a]) { up(a); if (a === 'jump') up('confirm_any'); }
        padPrev[a] = !!st[a];
      }
    }
  }

  // touch
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  function setupTouch() {
    const ui = document.getElementById('touch'); if (!isTouch) return; ui.classList.remove('hidden');
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let sid = null, cx = 0, cy = 0;
    const setDir = (dx, dy) => {
      const r = stick.clientWidth / 2, m = Math.hypot(dx, dy), k = Math.min(1, m / r);
      const nx = m ? dx / m * k : 0, ny = m ? dy / m * k : 0;
      knob.style.transform = `translate(${nx * r * 0.6}px,${ny * r * 0.6}px)`;
      const L = nx < -0.35, R = nx > 0.35, U = ny < -0.45, D = ny > 0.38;
      L ? down('left') : up('left'); R ? down('right') : up('right'); U ? down('up') : up('up'); D ? down('down') : up('down');
    };
    stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; sid = t.identifier; const b = stick.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; setDir(t.clientX - cx, t.clientY - cy); lastDevice = 'touch'; if (G.Sound) G.Sound.init(); }, { passive: false });
    stick.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === sid) setDir(t.clientX - cx, t.clientY - cy); }, { passive: false });
    const end = e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; setDir(0, 0); } };
    stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
    ui.querySelectorAll('.tb').forEach(b => {
      const k = b.dataset.k;
      b.addEventListener('touchstart', e => { e.preventDefault(); b.classList.add('on'); down(k); if (k === 'jump') down('confirm_any'); lastDevice = 'touch'; if (G.Sound) G.Sound.init(); }, { passive: false });
      const u = e => { e.preventDefault(); b.classList.remove('on'); up(k); if (k === 'jump') up('confirm_any'); };
      b.addEventListener('touchend', u); b.addEventListener('touchcancel', u);
    });
  }
  // generic tap anywhere (for menus)
  let tapped = false, tapPos = null;
  addEventListener('pointerdown', e => { tapped = true; tapPos = { x: e.clientX, y: e.clientY }; if (G.Sound) G.Sound.init();
    if (isTouch && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); });

  return {
    held, setupTouch, isTouch, ACTIONS, keyName,
    binds: () => binds, listen(a) { listening = a; }, get listening() { return listening; },
    resetBinds() { binds = JSON.parse(JSON.stringify(DEFAULT)); rebuild(); saveBinds(); },
    get mouse() { return mouseOn; }, set mouse(v) { mouseOn = !!v; },
    get device() { return lastDevice; },
    p: a => !!pressed[a], h: a => !!held[a], r: a => !!released[a],
    tap() { const t = tapped; return t; }, tapPos: () => tapPos,
    consume(a) { pressed[a] = false; },
    poll: pollPad, press: a => down(a), release: a => up(a),
    endFrame() { for (const k in pressed) pressed[k] = false; for (const k in released) released[k] = false; tapped = false; },
    clear() { for (const k in held) held[k] = false; this.endFrame(); }
  };
})();
