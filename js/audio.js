/* ============================================================
   audio.js — סאונד מסונתז ב-WebAudio (בלי קבצים חיצוניים)
   ============================================================ */
'use strict';

const Sound = {

  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  muted: false,
  started: false,
  _noiseBuf: null,
  _musicTimer: null,
  _step: 0,
  _intensity: 0,

  init() {
    this.muted = U.store.get(CFG.keys.muted, false);
  },

  /* חייב להיקרא מתוך אינטראקציה של המשתמש */
  unlock() {
    if (this.started) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);

    /* מאגר רעש לבן לשימוש חוזר */
    const len = this.ctx.sampleRate * 1.2;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.started = true;
  },

  setMuted(m) {
    this.muted = m;
    U.store.set(CFG.keys.muted, m);
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.04);
    }
  },

  get t() { return this.ctx ? this.ctx.currentTime : 0; },

  /* ---------- אבני בניין ---------- */

  tone(freq, dur, opts) {
    if (!this.started || this.muted) return;
    opts = opts || {};
    const t0 = this.t + (opts.delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);

    const vol = (opts.vol == null ? 0.3 : opts.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let node = o;
    if (opts.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f); node = f;
    }
    node.connect(g);
    g.connect(opts.bus || this.sfxGain);

    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },

  noise(dur, opts) {
    if (!this.started || this.muted) return;
    opts = opts || {};
    const t0 = this.t + (opts.delay || 0);
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf;

    const f = this.ctx.createBiquadFilter();
    f.type = opts.filterType || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqTo), t0 + dur);
    f.Q.value = opts.q || 1;

    const g = this.ctx.createGain();
    const vol = (opts.vol == null ? 0.3 : opts.vol);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  },

  /* ---------- אפקטים ---------- */

  dash()      { this.noise(0.26, { freq: 900, freqTo: 180, vol: 0.22, q: 0.7 });
                this.tone(300, 0.16, { type: 'triangle', to: 620, vol: 0.1 }); },

  step()      { this.tone(110, 0.05, { type: 'sine', vol: 0.045 }); },

  pickup(kind) {
    const base = kind === 'sey' ? 660 : 520;
    [0, 0.07, 0.14].forEach((d, i) => {
      this.tone(base * Math.pow(1.26, i), 0.2, { type: 'triangle', vol: 0.2, delay: d });
    });
    if (kind === 'sey') {
      [0.2, 0.27, 0.34, 0.41].forEach((d, i) => {
        this.tone(1320 * Math.pow(1.2, i), 0.3, { type: 'sine', vol: 0.13, delay: d });
      });
    }
  },

  slap() {
    this.noise(0.34, { freq: 2600, freqTo: 260, vol: 0.5, q: 0.5, filterType: 'lowpass' });
    this.tone(150, 0.3, { type: 'square', to: 48, vol: 0.26, filter: 900 });
  },

  shoot()     { this.noise(0.18, { freq: 1700, freqTo: 700, vol: 0.14 }); },

  nearMiss()  { this.tone(1180, 0.1, { type: 'sine', to: 1620, vol: 0.11 }); },

  knockout()  { this.tone(220, 0.22, { type: 'sawtooth', to: 60, vol: 0.2, filter: 1400 });
                this.noise(0.2, { freq: 500, vol: 0.16 }); },

  wave() {
    [523, 659, 784, 1046].forEach((f, i) => {
      this.tone(f, 0.4, { type: 'triangle', vol: 0.17, delay: i * 0.085 });
    });
  },

  glitter() {
    for (let i = 0; i < 9; i++) {
      this.tone(1400 + Math.random() * 2400, 0.34, {
        type: 'sine', vol: 0.075, delay: i * 0.055
      });
    }
  },

  gameOver() {
    [440, 392, 330, 262].forEach((f, i) => {
      this.tone(f, 0.55, { type: 'sawtooth', vol: 0.17, delay: i * 0.17, filter: 1200 });
    });
    this.noise(1.1, { freq: 400, freqTo: 80, vol: 0.13, delay: 0.1 });
  },

  ui()        { this.tone(700, 0.07, { type: 'square', vol: 0.09, filter: 2200 }); },

  /* ---------- מוזיקת רקע ---------- */

  /* בס פשוט + ארפג'יו, עולה בעוצמה ככל שהגלים מתקדמים */
  startMusic() {
    if (!this.started || this._musicTimer) return;
    this.musicGain.gain.setTargetAtTime(0.28, this.t, 0.8);
    this._step = 0;

    const BEAT = 0.26;
    const bass = [55, 55, 73.4, 55, 65.4, 65.4, 49, 49];
    const arp  = [220, 293.7, 349.2, 293.7, 261.6, 329.6, 392, 329.6];

    this._musicTimer = setInterval(() => {
      if (!this.started || this.muted) return;
      const s = this._step % 8;

      /* בס בכל פעימה */
      this.tone(bass[s], BEAT * 1.5, {
        type: 'triangle', vol: 0.16, filter: 500, bus: this.musicGain
      });

      /* היי-האט */
      if (this._step % 2 === 1) {
        this.noise(0.05, { freq: 7500, vol: 0.05 * (0.5 + this._intensity), q: 2 });
      }

      /* ארפג'יו נכנס כשהעצימות עולה */
      if (this._intensity > 0.25 && this._step % 2 === 0) {
        this.tone(arp[s], BEAT * 0.9, {
          type: 'square', vol: 0.05 + 0.05 * this._intensity,
          filter: 1600, bus: this.musicGain
        });
      }

      this._step++;
    }, BEAT * 1000);
  },

  stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(0, this.t, 0.25);
  },

  /* 0..1 — כמה "לוחץ" המשחק כרגע */
  setIntensity(v) { this._intensity = U.clamp(v, 0, 1); }
};
