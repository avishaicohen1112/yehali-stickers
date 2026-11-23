/*
 * The Last Wick - procedural audio engine.
 *
 * Everything is synthesized at runtime with the WebAudio API: no audio files,
 * no libraries. Classic script (no modules) so it works from file://.
 *
 *   Sound.init()                 create / resume the AudioContext (call on a user gesture)
 *   Sound.music(name)            crossfade to a looping track ('title', 'crypts', 'gardens',
 *                                'nave', 'spire', 'hearth', 'boss', 'boss_final', 'victory',
 *                                World 2: 'shore', 'galleon', 'lighthouse', 'boss_sea',
 *                                World 3: 'paper', 'clock', 'core', 'boss_dream'),
 *                                null / '' fades out
 *   Sound.sfx(name, opts)        one-shot, opts = {vol, pitch, pan}
 *   Sound.setVolumes(m, s)       0..1 each
 *   Sound.toggleMute()           returns the new muted state; Sound.muted is readable/writable
 *   Sound.duck(amount, seconds)  lower the music by `amount` (0..1) for `seconds`
 *
 * If WebAudio is unavailable every method is a harmless no-op.
 */
(function (global) {
  'use strict';

  var AC = global.AudioContext || global.webkitAudioContext;

  var ctx = null;
  var N = {};                 // fixed graph nodes
  var timer = null;
  var noiseBuf = null, brownBuf = null, distCurve = null;

  var musicVol = 0.7, sfxVol = 0.9, muted = false;
  var MUSIC_GAIN = 0.55, SFX_GAIN = 1.0;

  var tracks = [];            // live track instances (current + fading ones)
  var current = null, currentName = null;
  var pendingMusic;           // music requested before init()

  var mV = 0, sV = 0;         // live voice counters
  var MAX_M = 48, MAX_S = 40;
  var lastT = {};
  var warned = false;

  // ------------------------------------------------------------------ utils

  function noop() {}
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function rngMaker(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function G(v) { var g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; }
  function F(type, freq, q) {
    var f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  }
  function O(type, freq) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; }

  // attack (linear) -> hold -> exponential release
  function adsr(p, t, a, peak, hold, rel) {
    peak = Math.max(peak, 0.0002);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) p.setValueAtTime(peak, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  // two-stage percussive decay (piano-ish)
  function pk2(p, t, a, peak, knee, d) {
    peak = Math.max(peak, 0.0002);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(peak * 0.35, t + a + knee);
    p.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function reg(src, list, kind) {
    if (kind === 'm') mV++; else if (kind === 's') sV++;
    src.onended = function () {
      if (kind === 'm') mV--; else if (kind === 's') sV--;
      for (var i = 0; i < list.length; i++) { try { list[i].disconnect(); } catch (e) { /* ignore */ } }
    };
  }
  function startStop(oscs, t, end) {
    for (var i = 0; i < oscs.length; i++) { oscs[i].start(t); oscs[i].stop(end); }
  }
  function disconnectLater(list, sec) {
    setTimeout(function () {
      for (var i = 0; i < list.length; i++) { try { list[i].disconnect(); } catch (e) { /* ignore */ } }
    }, Math.max(100, sec * 1000));
  }

  function setPath(p, t, v0, v1, dur, path) {
    p.setValueAtTime(v0, t);
    if (path) {
      for (var i = 0; i < path.length; i++) p.exponentialRampToValueAtTime(Math.max(1, path[i][1]), t + path[i][0]);
    } else if (v1) {
      p.exponentialRampToValueAtTime(Math.max(1, v1), t + dur);
    }
  }

  // Generic oscillator voice.
  // o: type f f2 sw(sweep time) a h d vol det ft ff ff2 fs fq kind
  function T(dest, t, o) {
    var a = o.a || 0.004, h = o.h || 0, d = o.d || 0.2, end = t + a + h + d + 0.05;
    var osc = O(o.type || 'sine', o.f);
    if (o.f2) setPath(osc.frequency, t, o.f, o.f2, o.sw || (a + h + d));
    if (o.det) osc.detune.value = o.det;
    var chain = [osc], last = osc;
    if (o.ft) {
      var fl = F(o.ft, o.ff, o.fq);
      if (o.ff2) setPath(fl.frequency, t, o.ff, o.ff2, o.fs || (a + h + d));
      last.connect(fl); last = fl; chain.push(fl);
    }
    var g = G(0);
    last.connect(g); g.connect(dest); chain.push(g);
    adsr(g.gain, t, a, o.vol == null ? 0.3 : o.vol, h, d);
    osc.start(t); osc.stop(end);
    reg(osc, chain, o.kind || 's');
    return osc;
  }

  // Generic noise voice.
  // o: brown rate a h d vol ft ff ff2 fs fp(path) fq hp kind
  function Z(dest, t, o) {
    var a = o.a || 0.003, h = o.h || 0, d = o.d || 0.1, end = t + a + h + d + 0.05;
    var src = ctx.createBufferSource();
    src.buffer = o.brown ? brownBuf : noiseBuf;
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    var chain = [src], last = src;
    if (o.ft) {
      var f = F(o.ft, o.ff, o.fq);
      setPath(f.frequency, t, o.ff, o.ff2, o.fs || (a + h + d), o.fp);
      last.connect(f); last = f; chain.push(f);
    }
    if (o.hp) { var hp = F('highpass', o.hp, 0.7); last.connect(hp); last = hp; chain.push(hp); }
    var g = G(0);
    last.connect(g); g.connect(dest); chain.push(g);
    adsr(g.gain, t, a, o.vol == null ? 0.3 : o.vol, h, d);
    src.start(t, Math.random() * 1.5);
    src.stop(end);
    reg(src, chain, o.kind || 's');
    return g;
  }

  function crackle(dest, t, span, n, amp, kind) {
    for (var i = 0; i < n; i++) {
      Z(dest, t + Math.random() * span, {
        ft: 'bandpass', ff: rnd(1500, 6000), fq: 2, a: 0.001, d: rnd(0.006, 0.026),
        vol: amp * rnd(0.5, 1.4), kind: kind
      });
    }
  }

  // ------------------------------------------------------------ buffers / IR

  function makeNoise() {
    var sr = ctx.sampleRate, len = Math.floor(sr * 2);
    noiseBuf = ctx.createBuffer(1, len, sr);
    brownBuf = ctx.createBuffer(1, len, sr);
    var w = noiseBuf.getChannelData(0), b = brownBuf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var x = Math.random() * 2 - 1;
      w[i] = x;
      last = (last + 0.02 * x) / 1.02;
      b[i] = last * 3.5;
    }
    // smooth the loop seam of the brown buffer
    var fade = Math.floor(sr * 0.05);
    for (var j = 0; j < fade; j++) {
      var k = j / fade;
      b[len - fade + j] = b[len - fade + j] * (1 - k) + b[j] * k;
    }
    var n = 1024;
    distCurve = new Float32Array(n);
    for (var c = 0; c < n; c++) {
      var xx = c * 2 / n - 1;
      distCurve[c] = (1 + 6) * xx / (1 + 6 * Math.abs(xx));
    }
  }

  // Convolution reverb impulse: decaying noise that darkens over time, plus early taps.
  function makeIR(sec) {
    var sr = ctx.sampleRate, len = Math.floor(sr * sec);
    var buf = ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0, pre = Math.floor(sr * (0.012 + ch * 0.007));
      for (var i = 0; i < len; i++) {
        var x = i / len;
        var env = Math.exp(-x * 6.2) * (1 - x);
        var coef = 0.9 - 0.82 * Math.sqrt(x);
        lp += coef * ((Math.random() * 2 - 1) - lp);
        d[i] = i < pre ? 0 : lp * env;
      }
      for (var k = 0; k < 7; k++) {
        var at = pre + Math.floor(sr * rnd(0.005, 0.08));
        if (at < len) d[at] += (Math.random() < 0.5 ? -1 : 1) * rnd(0.3, 0.7);
      }
    }
    return buf;
  }

  // ---------------------------------------------------------------- graph

  function build() {
    makeNoise();
    N.master = G(muted ? 0 : 1);
    N.comp = ctx.createDynamicsCompressor();
    N.comp.threshold.value = -16; N.comp.knee.value = 12; N.comp.ratio.value = 3;
    N.comp.attack.value = 0.006; N.comp.release.value = 0.22;
    N.lim = ctx.createDynamicsCompressor();
    N.lim.threshold.value = -2.5; N.lim.knee.value = 0; N.lim.ratio.value = 20;
    N.lim.attack.value = 0.002; N.lim.release.value = 0.09;
    N.out = G(0.92);
    N.master.connect(N.comp); N.comp.connect(N.lim); N.lim.connect(N.out); N.out.connect(ctx.destination);

    // reverb send
    N.verbIn = F('highpass', 140, 0.6);
    N.conv = ctx.createConvolver();
    N.conv.buffer = makeIR(3.6);
    N.verbLp = F('lowpass', 7000, 0.5);
    N.verbOut = G(0.9);
    N.verbIn.connect(N.conv); N.conv.connect(N.verbLp); N.verbLp.connect(N.verbOut); N.verbOut.connect(N.master);

    // music: dry & wet both go through duck + volume
    N.musicDry = G(1); N.duckD = G(1); N.mVolD = G(musicVol * MUSIC_GAIN);
    N.musicWet = G(1); N.duckW = G(1); N.mVolW = G(musicVol * MUSIC_GAIN);
    N.musicDry.connect(N.duckD); N.duckD.connect(N.mVolD); N.mVolD.connect(N.master);
    N.musicWet.connect(N.duckW); N.duckW.connect(N.mVolW); N.mVolW.connect(N.verbIn);

    // sfx
    N.sfxDry = G(sfxVol * SFX_GAIN); N.sfxDry.connect(N.master);
    N.sfxWet = G(sfxVol * SFX_GAIN); N.sfxWet.connect(N.verbIn);
  }

  // ============================================================ instruments
  // All music voices take (dest, t, ...). Melodic ones respect the voice cap.

  function busy() { return mV > MAX_M; }

  function vPiano(dest, t, m, vel) {
    if (busy()) return;
    var f = mtof(m), dec = clamp(4.6 - (m - 40) * 0.07, 0.9, 4.6), end = t + dec + 0.06;
    var o1 = O('triangle', f), o2 = O('sine', f * 2.002), o3 = O('sine', f * 3.006);
    var g1 = G(0), g2 = G(0), g3 = G(0), lp = F('lowpass', Math.min(f * 8, 12000), 0.4), out = G(vel * 0.42);
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(lp); g2.connect(lp); g3.connect(lp); lp.connect(out); out.connect(dest);
    pk2(g1.gain, t, 0.004, 1, 0.3, dec);
    pk2(g2.gain, t, 0.003, 0.45, 0.15, dec * 0.5);
    adsr(g3.gain, t, 0.002, 0.2, 0, dec * 0.18);
    lp.frequency.setValueAtTime(Math.min(f * 8, 12000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.7, 260), t + dec * 0.6);
    startStop([o1, o2, o3], t, end);
    reg(o1, [o1, o2, o3, g1, g2, g3, lp, out], 'm');
  }

  function vMusicBox(dest, t, m, vel) {
    if (busy()) return;
    var f = mtof(m), dec = 2.2, end = t + dec + 0.05;
    var o1 = O('sine', f), o2 = O('sine', f * 3.0), o3 = O('sine', f * 6.27);
    var g1 = G(0), g2 = G(0), g3 = G(0), out = G(vel * 0.32);
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(out); g2.connect(out); g3.connect(out); out.connect(dest);
    adsr(g1.gain, t, 0.002, 1, 0, dec);
    adsr(g2.gain, t, 0.002, 0.25, 0, 0.35);
    adsr(g3.gain, t, 0.001, 0.12, 0, 0.07);
    startStop([o1, o2, o3], t, end);
    reg(o1, [o1, o2, o3, g1, g2, g3, out], 'm');
  }

  var BELL_R = [1, 2.0, 2.76, 5.4, 0.5], BELL_A = [1, 0.35, 0.5, 0.2, 0.45], BELL_D = [1, 0.6, 0.4, 0.15, 1.3];
  function vBell(dest, t, m, vel, dec, hum) {
    if (busy()) return;
    dec = dec || 3;
    var f = mtof(m), n = hum ? 5 : 4, out = G(vel * 0.22), oscs = [], list = [out], end = t + dec * (hum ? 1.3 : 1) + 0.06;
    out.connect(dest);
    for (var i = 0; i < n; i++) {
      var o = O('sine', f * BELL_R[i]), g = G(0);
      o.detune.value = rnd(-3, 3);
      o.connect(g); g.connect(out);
      adsr(g.gain, t, 0.002, BELL_A[i], 0, dec * BELL_D[i]);
      oscs.push(o); list.push(o, g);
    }
    startStop(oscs, t, end);
    reg(oscs[0], list, 'm');
  }

  function vGlass(dest, t, m, vel) {
    if (busy()) return;
    var f = mtof(m), o1 = O('sine', f), o2 = O('sine', f * 2.76), g1 = G(0), g2 = G(0), end = t + 0.7;
    o1.connect(g1); o2.connect(g2); g1.connect(dest); g2.connect(dest);
    adsr(g1.gain, t, 0.002, vel, 0, 0.6);
    adsr(g2.gain, t, 0.001, vel * 0.4, 0, 0.2);
    startStop([o1, o2], t, end);
    reg(o1, [o1, o2, g1, g2], 'm');
  }

  // plucked string / harp / spiccato
  function vPluck(dest, t, m, vel, dec, bright) {
    if (busy()) return;
    dec = dec || 1.4; bright = bright || 5;
    var f = mtof(m), end = t + dec + 0.05;
    var o1 = O('sawtooth', f), o2 = O('sine', f), lp = F('lowpass', Math.min(f * bright, 10000), 2.2), g = G(0), g2 = G(0.6);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(dest);
    lp.frequency.setValueAtTime(Math.min(f * bright, 10000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.1, 120), t + dec * 0.4);
    adsr(g.gain, t, 0.003, vel * 0.3, 0, dec);
    startStop([o1, o2], t, end);
    reg(o1, [o1, o2, lp, g, g2], 'm');
  }

  // bowed string (cello / high strings)
  function vBowed(dest, t, m, dur, vel, bright) {
    var f = mtof(m), a = Math.min(0.35, dur * 0.3), r = Math.min(0.7, dur * 0.4), end = t + dur + 0.05;
    var o1 = O('sawtooth', f), o2 = O('sawtooth', f), lfo = O('sine', rnd(4.6, 5.6)), lg = G(0);
    o1.detune.value = -6; o2.detune.value = 6;
    var lp = F('lowpass', clamp(f * (bright || 3), 200, 4200), 0.8), g = G(0);
    lfo.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune);
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + Math.min(0.9, dur * 0.6));
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.16, t + a);
    g.gain.setValueAtTime(vel * 0.16, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    startStop([o1, o2, lfo], t, end);
    reg(o1, [o1, o2, lfo, lg, lp, g], 'm');
  }

  // evolving pad: detuned oscillators through an LFO'd lowpass
  function vPad(dest, t, ms, dur, o) {
    var cut = o.cut || 900, a = Math.min(o.a || 1, dur * 0.45), r = Math.min(o.r || 1.5, dur * 0.5);
    var lp = F('lowpass', cut, o.q || 0.7), g = G(0), lfo = O('sine', o.lfo || rnd(0.08, 0.2)), lg = G(cut * 0.35);
    lfo.connect(lg); lg.connect(lp.frequency); lp.connect(g); g.connect(dest);
    var oscs = [lfo], list = [lfo, lg, lp, g], det = o.det == null ? 8 : o.det;
    for (var i = 0; i < ms.length; i++) {
      for (var k = 0; k < 2; k++) {
        var osc = O(o.type || 'sawtooth', mtof(ms[i]));
        osc.detune.value = (k ? det : -det) + rnd(-2, 2);
        osc.connect(lp); oscs.push(osc); list.push(osc);
      }
    }
    var peak = (o.vol || 0.05) / Math.sqrt(ms.length * 2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    startStop(oscs, t, t + dur + 0.05);
    reg(oscs[1], list, 'm');
  }

  // choir "aah/ooh": saws through parallel formant bandpasses, morphing vowel
  var VOWELS = [[730, 1090, 2440], [570, 840, 2410], [400, 800, 2300], [660, 1700, 2400]];
  function vChoir(dest, t, ms, dur, o) {
    var a = Math.min(o.a || 1, dur * 0.45), r = Math.min(o.r || 1.5, dur * 0.5);
    var mix = G(1 / Math.sqrt(ms.length * 2)), vib = O('sine', rnd(4.4, 5.2)), vg = G(0), g = G(0);
    vib.connect(vg);
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(11, t + Math.min(1.2, dur * 0.5));
    var oscs = [vib], list = [vib, vg, mix, g];
    for (var i = 0; i < ms.length; i++) {
      for (var k = 0; k < 2; k++) {
        var osc = O('sawtooth', mtof(ms[i]));
        osc.detune.value = (k ? 9 : -9) + rnd(-3, 3);
        vg.connect(osc.detune); osc.connect(mix); oscs.push(osc); list.push(osc);
      }
    }
    var v0 = VOWELS[Math.floor(Math.random() * 2)], v1 = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    var fg = [1.6, 1.0, 0.45], fq = [7, 9, 11];
    for (var j = 0; j < 3; j++) {
      var bp = F('bandpass', v0[j], fq[j]), bg = G(fg[j]);
      bp.frequency.setValueAtTime(v0[j], t);
      bp.frequency.linearRampToValueAtTime(v1[j], t + dur);
      mix.connect(bp); bp.connect(bg); bg.connect(g); list.push(bp, bg);
    }
    var body = F('lowpass', 420, 0.5), bodyG = G(0.35);
    mix.connect(body); body.connect(bodyG); bodyG.connect(g); list.push(body, bodyG);
    g.connect(dest);
    var peak = o.vol || 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    startStop(oscs, t, t + dur + 0.05);
    reg(oscs[1], list, 'm');
  }

  // pipe organ: additive sines
  var ORG_R = [1, 2, 3, 4], ORG_A = [1, 0.5, 0.18, 0.22];
  function vOrgan(dest, t, ms, dur, vol, att) {
    var a = Math.min(att || 0.25, dur * 0.4), r = Math.min(0.9, dur * 0.4);
    var g = G(0), lp = F('lowpass', 3200, 0.5), oscs = [], list = [g, lp];
    lp.connect(g); g.connect(dest);
    for (var i = 0; i < ms.length; i++) {
      var f = mtof(ms[i]);
      for (var k = 0; k < ORG_R.length; k++) {
        if (f * ORG_R[k] > 8000) continue;
        var osc = O('sine', f * ORG_R[k]), og = G(ORG_A[k]);
        osc.connect(og); og.connect(lp); oscs.push(osc); list.push(osc, og);
      }
    }
    if (!oscs.length) return;
    var peak = (vol || 0.05) / Math.sqrt(ms.length);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    startStop(oscs, t, t + dur + 0.05);
    reg(oscs[0], list, 'm');
  }

  // low brass swell
  function vBrass(dest, t, m, dur, vel) {
    var f = mtof(m), a = dur * 0.4, end = t + dur + 0.05;
    var o1 = O('sawtooth', f), o2 = O('sawtooth', f), lp = F('lowpass', f, 1.3), g = G(0);
    o1.detune.value = -5; o2.detune.value = 5;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
    lp.frequency.setValueAtTime(f * 0.8, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * 5, 5000), t + a);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 80), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.2, t + a);
    g.gain.linearRampToValueAtTime(vel * 0.14, t + dur * 0.75);
    g.gain.linearRampToValueAtTime(0, t + dur);
    startStop([o1, o2], t, end);
    reg(o1, [o1, o2, lp, g], 'm');
  }

  function vTimp(dest, t, m, vel) {
    var f = mtof(m);
    T(dest, t, { f: f * 1.5, f2: f, sw: 0.07, a: 0.002, d: 1.1, vol: vel * 0.8, kind: 'm' });
    T(dest, t, { f: f * 1.51, a: 0.002, d: 0.35, vol: vel * 0.22, kind: 'm' });
    Z(dest, t, { ft: 'bandpass', ff: 260, fq: 1.2, a: 0.001, d: 0.14, vol: vel * 0.55, kind: 'm' });
  }

  function vSnare(dest, t, vel) {
    Z(dest, t, { ft: 'bandpass', ff: 1900, fq: 0.8, a: 0.001, d: 0.13, vol: vel * 0.45, kind: 'm' });
    T(dest, t, { type: 'triangle', f: 210, f2: 140, a: 0.001, d: 0.07, vol: vel * 0.3, kind: 'm' });
  }

  function vBoom(dest, t, vel) {
    T(dest, t, { f: 95, f2: 42, sw: 0.25, a: 0.002, d: 0.6, vol: vel, kind: 'm' });
    Z(dest, t, { ft: 'lowpass', ff: 420, a: 0.001, d: 0.16, vol: vel * 0.5, kind: 'm' });
  }

  function vHeart(dest, t, vel) {
    T(dest, t, { f: 68, f2: 40, sw: 0.15, a: 0.008, d: 0.24, vol: vel, kind: 'm' });
    T(dest, t, { type: 'triangle', f: 120, f2: 70, sw: 0.1, a: 0.006, d: 0.12, vol: vel * 0.25, kind: 'm' });
    T(dest, t + 0.27, { f: 60, f2: 38, sw: 0.15, a: 0.008, d: 0.2, vol: vel * 0.6, kind: 'm' });
    Z(dest, t, { ft: 'lowpass', ff: 200, a: 0.004, d: 0.1, vol: vel * 0.35, kind: 'm' });
  }

  // ---- World 2 / World 3 timbres

  // distant horn call: saw + triangle, scooped onset, slow bloom, late vibrato
  function vHorn(dest, t, m, dur, vel) {
    if (busy()) return;
    var f = mtof(m), a = Math.min(0.5, dur * 0.35), r = Math.min(1.2, dur * 0.5), end = t + dur + 0.05;
    var o1 = O('sawtooth', f), o2 = O('triangle', f), vib = O('sine', rnd(4.2, 5)), vg = G(0);
    var lp = F('lowpass', f * 1.2, 0.9), g = G(0);
    o1.detune.value = -4; o2.detune.value = 4;
    vib.connect(vg); vg.connect(o1.detune); vg.connect(o2.detune);
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(7, t + dur * 0.7);
    o1.frequency.setValueAtTime(f * 0.95, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.18);
    o2.frequency.setValueAtTime(f * 0.95, t); o2.frequency.exponentialRampToValueAtTime(f, t + 0.18);
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * 3.2, 3000), t + a);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.4, 120), t + dur);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.2, t + a);
    g.gain.linearRampToValueAtTime(vel * 0.15, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    startStop([o1, o2, vib], t, end);
    reg(o1, [o1, o2, vib, vg, lp, g], 'm');
  }

  // squeezebox / harmonium reed: musette-detuned saw + square per note, nasal formant, bellows tremolo
  function vReed(dest, t, ms, dur, o) {
    var a = Math.min(o.a || 0.3, dur * 0.45), r = Math.min(o.r || 0.5, dur * 0.5);
    var hp = F('highpass', 180, 0.6), pk = F('peaking', 1150, 1.6), lp = F('lowpass', o.cut || 2000, 0.7);
    var trem = G(1), g = G(0), tl = O('sine', o.trem || rnd(4.6, 5.6)), tg = G(o.depth == null ? 0.18 : o.depth);
    pk.gain.value = 7;
    tl.connect(tg); tg.connect(trem.gain);
    hp.connect(pk); pk.connect(lp); lp.connect(trem); trem.connect(g); g.connect(dest);
    var oscs = [tl], list = [hp, pk, lp, trem, g, tl, tg], det = o.det == null ? 13 : o.det;
    for (var i = 0; i < ms.length; i++) {
      var f = mtof(ms[i]), s1 = O('sawtooth', f), s2 = O('square', f), sg = G(0.45);
      s1.detune.value = -det + rnd(-2, 2); s2.detune.value = det + rnd(-2, 2);
      s1.connect(hp); s2.connect(sg); sg.connect(hp);
      oscs.push(s1, s2); list.push(s1, s2, sg);
    }
    var peak = (o.vol || 0.05) / Math.sqrt(ms.length * 2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(peak * 0.8, t + dur - r);
    g.gain.linearRampToValueAtTime(0, t + dur);
    startStop(oscs, t, t + dur + 0.05);
    reg(oscs[1], list, 'm');
  }

  // celesta: pure hammered sine with a quick bright 4th partial
  function vCelesta(dest, t, m, vel) {
    if (busy()) return;
    var f = mtof(m), dec = clamp(2.6 - (m - 72) * 0.05, 0.8, 2.6), end = t + dec + 0.05;
    var o1 = O('sine', f), o2 = O('sine', f * 4.0), o3 = O('triangle', f * 2.0);
    var g1 = G(0), g2 = G(0), g3 = G(0), out = G(vel * 0.3);
    o2.detune.value = rnd(-5, 5);
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    g1.connect(out); g2.connect(out); g3.connect(out); out.connect(dest);
    adsr(g1.gain, t, 0.002, 1, 0, dec);
    adsr(g2.gain, t, 0.001, 0.22, 0, 0.12);
    adsr(g3.gain, t, 0.002, 0.18, 0, dec * 0.3);
    startStop([o1, o2, o3], t, end);
    reg(o1, [o1, o2, o3, g1, g2, g3, out], 'm');
  }

  // clockwork tick: a tiny resonant click plus a pitched "tink"
  function vTick(dest, t, vel, f) {
    Z(dest, t, { ft: 'bandpass', ff: f * 1.8, fq: 3, a: 0.0005, d: 0.012, vol: vel * 0.6, kind: 'm' });
    T(dest, t, { type: 'triangle', f: f, a: 0.0008, d: 0.03, vol: vel * 0.25, kind: 'm' });
  }

  // surf: noise blooming through a lowpass that opens and closes, foam hiss on top
  function vSurf(dest, t, rise, fall, vel) {
    Z(dest, t, { ft: 'lowpass', ff: 160, fp: [[rise, 700 + vel * 1100], [rise + fall, 140]], fq: 0.6,
      a: rise, d: fall, vol: vel * 0.2, kind: 'm' });
    Z(dest, t + rise * 0.4, { ft: 'bandpass', ff: 2200, fp: [[rise * 0.6, 4200], [rise * 0.6 + fall * 0.8, 1500]], fq: 0.5,
      a: rise * 0.6, d: fall * 0.8, vol: vel * 0.035, kind: 'm' });
  }

  // wooden creak: a slow click train (very low saw) ringing through a narrow drifting band
  function vCreak(dest, t, vel) {
    var f = rnd(12, 24), ff = rnd(450, 950), dur = rnd(0.5, 1.2);
    T(dest, t, { type: 'sawtooth', f: f, f2: f * rnd(1.3, 2.2), sw: dur, ft: 'bandpass', ff: ff, ff2: ff * rnd(0.8, 1.3),
      fq: 9, a: dur * 0.4, h: dur * 0.2, d: dur * 0.4, vol: vel, kind: 'm' });
  }

  // a "distant" send for a track: lowpassed, mostly reverb, a little dry
  function far(tr, cut, dry) {
    var lp = F('lowpass', cut, 0.5), d = G(dry);
    lp.connect(tr.verb); lp.connect(d); d.connect(tr.in);
    tr.pn.push(lp, d);
    return lp;
  }

  // persistent noise bed (lives for the track's lifetime)
  function bed(tr, o) {
    var src = ctx.createBufferSource();
    src.buffer = o.brown ? brownBuf : noiseBuf; src.loop = true;
    var f = F(o.ft || 'bandpass', o.ff, o.fq || 0.7), g = G(o.vol);
    var l = O('sine', o.lr || 0.07), lg = G(o.ld || o.ff * 0.4);
    src.connect(f); f.connect(g); g.connect(o.dest || tr.in);
    l.connect(lg); lg.connect(f.frequency);
    src.start(tr.t0, Math.random()); l.start(tr.t0);
    tr.persist.push(src, l); tr.pn.push(src, f, g, l, lg);
  }

  // persistent drone oscillators
  function drone(tr, o) {
    var lp = F('lowpass', o.cut, o.q || 1), g = G(o.vol), l = O('sine', o.lr || 0.06), lg = G(o.ld || o.cut * 0.5);
    l.connect(lg); lg.connect(lp.frequency); lp.connect(g); g.connect(tr.in);
    l.start(tr.t0); tr.persist.push(l); tr.pn.push(lp, g, l, lg);
    for (var i = 0; i < o.freqs.length; i++) {
      var osc = O(o.type || 'sawtooth', o.freqs[i]);
      osc.detune.value = rnd(-4, 4);
      osc.connect(lp); osc.start(tr.t0);
      tr.persist.push(osc); tr.pn.push(osc);
    }
    if (o.trem) {
      var tl = O('sine', o.trem), tg = G(o.vol * 0.5);
      tl.connect(tg); tg.connect(g.gain); tl.start(tr.t0);
      tr.persist.push(tl); tr.pn.push(tl, tg);
    }
  }

  // =============================================================== tracks

  var AEOL = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], LYD = [0, 2, 4, 6, 7, 9, 11];
  var PHRY = [0, 1, 3, 5, 7, 8, 10], HARM = [0, 2, 3, 5, 7, 8, 11], MAJ = [0, 2, 4, 5, 7, 9, 11];
  var WT = [0, 2, 4, 6, 8, 10], PHRYD = [0, 1, 4, 5, 7, 8, 10];

  function Track(name, def) {
    var t0 = ctx.currentTime + 0.08;
    this.name = name; this.def = def; this.t0 = t0;
    this.rng = rngMaker(((def.seed || 1) * 7919) ^ Math.floor(Math.random() * 65536));
    this.stepDur = 60 / def.bpm / def.spb;
    this.spBar = def.spb * def.bpb;
    this.barDur = this.stepDur * this.spBar;
    this.step = 0; this.next = t0; this.cycle = 0; this.pi = -1;
    this.persist = []; this.pn = [];
    this.dead = false; this.killAt = 0; this.endAt = def.oneShot ? t0 + def.oneShot : 0;

    this.in = G(def.vol); this.fade = G(0); this.send = G(def.wet); this.fadeW = G(0); this.verb = G(1);
    this.in.connect(this.fade); this.fade.connect(N.musicDry);
    this.in.connect(this.send); this.send.connect(this.fadeW);
    this.verb.connect(this.fadeW); this.fadeW.connect(N.musicWet);
    var fi = def.fadeIn == null ? 2 : def.fadeIn;
    var gs = [this.fade, this.fadeW];
    for (var i = 0; i < 2; i++) {
      gs[i].gain.setValueAtTime(0.0001, t0);
      gs[i].gain.linearRampToValueAtTime(1, t0 + fi);
    }
    this.prog = def.pick ? def.pick(this, 0) : def.progs[0];
    this.chordDeg = this.prog[0];
    if (def.setup) def.setup(this);
    tracks.push(this);
  }

  Track.prototype.deg = function (d) {
    var sc = this.def.scale, n = sc.length, o = Math.floor(d / n);
    return this.def.root + 12 * o + sc[d - o * n];
  };
  Track.prototype.chord = function (oct, count) {
    var out = [];
    for (var k = 0; k < count; k++) out.push(this.deg(this.chordDeg + 2 * k) + 12 * oct);
    return out;
  };
  Track.prototype.snap = function (d) {
    var c = this.chordDeg, n = this.def.scale.length, offs = [0, -1, 1, -2, 2];
    for (var k = 0; k < offs.length; k++) {
      var x = d + offs[k], r = (((x - c) % n) + n) % n;
      if (r === 0 || r === 2 || r === 4) return x;
    }
    return d;
  };
  Track.prototype.pickRand = function () {
    var p = this.def.progs;
    return p[Math.floor(this.rng() * p.length)];
  };
  Track.prototype.run = function (silent) {
    var d = this.def, s = this.step, bar = Math.floor(s / this.spBar), sib = s % this.spBar, chg = false;
    if (sib === 0 && bar % d.bpc === 0) {
      this.pi++;
      if (this.pi >= this.prog.length) {
        this.pi = 0; this.cycle++;
        this.prog = d.pick ? d.pick(this, this.cycle) : this.pickRand();
      }
      this.chordDeg = this.prog[this.pi];
      chg = true;
    }
    if (!silent && d.step) d.step(this, this.next, s, bar, sib, chg);
    this.next += this.stepDur;
    this.step++;
  };
  Track.prototype.kill = function (ft) {
    if (this.dead) return;
    this.dead = true;
    var now = ctx.currentTime, gs = [this.fade, this.fadeW];
    for (var i = 0; i < 2; i++) {
      var p = gs[i].gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(Math.max(0.0001, p.value), now);
      p.linearRampToValueAtTime(0.0001, now + ft);
    }
    this.killAt = now + ft + 0.1;
  };
  Track.prototype.destroy = function () {
    this.dead = true; this.destroyed = true;
    var i;
    for (i = 0; i < this.persist.length; i++) { try { this.persist[i].stop(); } catch (e) { /* ignore */ } }
    var all = this.pn.concat([this.in, this.fade, this.send, this.fadeW, this.verb]);
    for (i = 0; i < all.length; i++) { try { all[i].disconnect(); } catch (e) { /* ignore */ } }
    this.persist = []; this.pn = [];
  };

  // ---- generative motif melody: phrase = A, A', B, (A-head | rest)
  function Melody(tr, o) { this.tr = tr; this.o = o; this.A = null; this.B = null; this.cur = null; this.rest = false; }
  Melody.prototype.gen = function () {
    var tr = this.tr, o = this.o, r = tr.rng, n = o.len, spb = tr.def.spb, spBar = tr.spBar;
    var at = new Array(n), list = [], d = Math.round((o.lo + o.hi) / 2 + (r() - 0.5) * 3);
    for (var i = 0; i < n; i++) {
      var p = o.density * (i % spBar === 0 ? 1.7 : (i % spb === 0 ? 1.1 : 0.45));
      if (i >= n - spb) p *= 0.15;
      if (r() < p) {
        var mv = r() < 0.55 ? 1 : (r() < 0.7 ? 2 : 3);
        if (r() < 0.5) mv = -mv;
        if (r() < 0.12) mv = 0;
        d += mv;
        if (d > o.hi) d -= 2 * Math.abs(mv) + 1;
        if (d < o.lo) d += 2 * Math.abs(mv) + 1;
        d = clamp(d, o.lo, o.hi);
        var nt = { i: i, d: d };
        at[i] = nt; list.push(nt);
      }
    }
    if (!list.length) { at[0] = { i: 0, d: d }; list.push(at[0]); }
    for (var k = 0; k < list.length; k++) list[k].len = (k + 1 < list.length ? list[k + 1].i : n) - list[k].i;
    return { at: at, list: list };
  };
  Melody.prototype.vary = function (m) {
    var r = this.tr.rng, o = this.o, at = new Array(m.at.length), list = [];
    for (var k = 0; k < m.list.length; k++) {
      var src = m.list[k], nt = { i: src.i, d: src.d, len: src.len };
      if (k >= m.list.length - 2 && r() < 0.7) nt.d = clamp(nt.d + (r() < 0.5 ? -1 : 1) * (r() < 0.6 ? 1 : 2), o.lo, o.hi);
      if (k > 0 && k < m.list.length - 1 && r() < 0.12) continue;
      at[nt.i] = nt; list.push(nt);
    }
    return { at: at, list: list };
  };
  Melody.prototype.step = function (t, s) {
    var o = this.o, tr = this.tr, n = o.len, pos = s % n, seg = Math.floor(s / n) % 4;
    if (pos === 0) {
      if (!this.A || (seg === 0 && tr.rng() < 0.35)) this.A = this.gen();
      if (seg === 2 && (!this.B || tr.rng() < 0.6)) this.B = this.gen();
      this.rest = seg === 3 && tr.rng() < 0.5;
      this.cur = seg === 0 ? this.A : seg === 1 ? this.vary(this.A) : seg === 2 ? (this.B || this.A) : this.A;
    }
    if (!this.cur || this.rest) return;
    if (seg === 3 && pos >= n / 2) return;
    var nt = this.cur.at[pos];
    if (!nt) return;
    var d = nt.d;
    if (pos % tr.def.spb === 0) d = tr.snap(d);
    var vel = (o.vel || 0.5) * (pos % tr.spBar === 0 ? 1 : 0.8) * (0.88 + tr.rng() * 0.24);
    o.voice(t, tr.deg(d), vel, nt.len * tr.stepDur);
  };

  // Title theme: [step, degree, lengthInSteps] over 8 bars of eighths (D minor).
  var THEME = (function () {
    var src = [
      [0, 11, 3], [3, 10, 1], [4, 9, 2], [6, 8, 2],
      [8, 7, 4], [12, 9, 2], [14, 12, 2],
      [16, 11, 3], [19, 12, 1], [20, 13, 4],
      [24, 10, 6],
      [32, 11, 3], [35, 10, 1], [36, 9, 2], [38, 11, 2],
      [40, 14, 4], [44, 13, 2], [46, 12, 2],
      [48, 11, 2], [50, 10, 2], [52, 12, 2], [54, 11, 2],
      [56, 8, 6]
    ];
    var arr = [];
    for (var i = 0; i < src.length; i++) arr[src[i][0]] = [src[i][1], src[i][2]];
    return arr;
  })();

  // Galleon shanty fragment: [step, degree, lengthInSteps] over 8 bars of 3/4 eighths (G minor).
  var SHANTY = (function () {
    var src = [
      [0, 11, 3], [3, 10, 1], [4, 9, 2],
      [6, 8, 2], [8, 7, 2], [10, 8, 2],
      [12, 9, 3], [15, 10, 1], [16, 11, 2],
      [18, 8, 6],
      [24, 11, 3], [27, 10, 1], [28, 9, 2],
      [30, 8, 2], [32, 7, 2], [34, 6, 2],
      [36, 7, 3], [39, 8, 1], [40, 9, 2],
      [42, 7, 6]
    ];
    var arr = [];
    for (var i = 0; i < src.length; i++) arr[src[i][0]] = [src[i][1], src[i][2]];
    return arr;
  })();

  // Ash Shore horn calls: [stepOffset, degree, lengthInSteps]
  var HORN_CALLS = [
    [[0, 7, 3], [3, 11, 6]],
    [[0, 11, 3], [3, 10, 2], [5, 7, 7]],
    [[0, 9, 4], [4, 7, 8]],
    [[0, 4, 2], [2, 7, 2], [4, 6, 6]]
  ];

  // Lighthouse beacon: the same four notes, forever (Bb, Cb, Bb, F)
  var BEACON = [14, 15, 14, 11];

  function intensity(bar, cycleLen) {
    var c = bar % cycleLen;
    if (c < 4) return bar < cycleLen ? 0 : 1;
    if (c < 12) return 1;
    if (c < cycleLen - 10) return 2;
    if (c < cycleLen - 4) return 3;
    if (c < cycleLen - 2) return -1;
    return 1;
  }

  var TRACKS = {
    // ---------------------------------------------------------------- title
    title: {
      bpm: 56, spb: 2, bpb: 4, bpc: 1, root: 50, scale: AEOL, vol: 0.85, wet: 0.45, seed: 7,
      progs: [[0, 5, 2, 6, 0, 5, 3, 4], [0, 3, 5, 4, 0, 3, 6, 4], [0, 5, 6, 4, 0, 5, 3, 4]],
      pick: function (tr, cyc) {
        return cyc % 2 === 0 ? tr.def.progs[0] : tr.def.progs[1 + Math.floor(tr.rng() * 2)];
      },
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 9, hi: 16, len: 16, density: 0.3, vel: 0.42,
          voice: function (t, m, v) { vPiano(tr.in, t, m + 12, v * 0.8); }
        });
        bed(tr, { brown: 1, ff: 300, fq: 0.6, vol: 0.05, lr: 0.05 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur;
        if (chg) {
          vPad(tr.in, t, tr.chord(0, 3), bd * 1.25, { type: 'sawtooth', cut: 750, vol: 0.06, a: bd * 0.35, r: bd * 0.5, det: 7 });
          vPiano(tr.in, t, tr.deg(c) - 12, 0.42);
        }
        if (sib === 4) vPiano(tr.in, t, tr.deg(c + 4) - 12, 0.24);
        if ((sib === 2 || sib === 6) && tr.rng() < 0.55) vPiano(tr.in, t, tr.deg(c + (sib === 2 ? 2 : 4)), 0.16);
        var local = s % (tr.spBar * 8);
        if (tr.cycle % 2 === 0) {
          var nn = THEME[local];
          if (nn) vPiano(tr.in, t, tr.deg(nn[0]), 0.55);
        } else {
          tr.mel.step(t, local);
        }
      }
    },

    // --------------------------------------------------------------- crypts
    crypts: {
      bpm: 70, spb: 2, bpb: 3, bpc: 2, root: 48, scale: AEOL, vol: 0.9, wet: 0.42, seed: 21,
      progs: [[0, 5, 3, 4], [0, 3, 5, 6], [0, 6, 5, 4], [0, 5, 2, 6]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 21, len: 12, density: 0.38, vel: 0.5,
          voice: function (t, m, v) { vMusicBox(tr.in, t, m, v); }
        });
        bed(tr, { brown: 1, ff: 380, fq: 0.8, vol: 0.07, lr: 0.06 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur;
        if (chg) {
          vBowed(tr.in, t, tr.deg(c) - 12, bd * 2.1, 0.55, 2.6);
          if (tr.rng() < 0.5) vBowed(tr.in, t + bd, tr.deg(c + 4) - 12, bd * 1.15, 0.3, 2.6);
          vPad(tr.in, t, tr.chord(0, 3), bd * 2.3, { type: 'triangle', cut: 950, vol: 0.07, a: bd * 0.6, r: bd * 0.8, det: 6 });
        }
        tr.mel.step(t, s);
        if (sib % 2 === 0 && tr.rng() < 0.15) vMusicBox(tr.in, t, tr.deg(c + [0, 2, 4][Math.floor(tr.rng() * 3)]) + 12, 0.22);
      }
    },

    // -------------------------------------------------------------- gardens
    gardens: {
      bpm: 84, spb: 2, bpb: 4, bpc: 2, root: 53, scale: LYD, vol: 1.3, wet: 0.45, seed: 33,
      progs: [[0, 1, 0, 4], [0, 1, 5, 4], [0, 2, 1, 4], [5, 1, 4, 0], [0, 6, 1, 0]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 22, len: 16, density: 0.24, vel: 0.5,
          voice: function (t, m, v) { vPluck(tr.in, t, m, v * 0.9, 1.8, 3.5); vGlass(tr.verb, t, m + 12, v * 0.05); }
        });
        bed(tr, { ff: 1400, fq: 0.6, vol: 0.022, lr: 0.09, ld: 600 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur;
        var ARP = [0, 2, 4, 7, 9, 7, 4, 2];
        if (chg) {
          var notes = tr.chord(0, 3); notes.push(tr.deg(c + 8));
          vPad(tr.in, t, notes, bd * 2.3, { type: 'triangle', cut: 2200, vol: 0.05, a: bd * 0.6, r: bd, det: 10, lfo: 0.12 });
          vPluck(tr.in, t, tr.deg(c) - 12, 0.4, 2.6, 2.5);
        }
        if (tr.rng() < (sib === 0 ? 0.9 : 0.55)) vPluck(tr.in, t, tr.deg(c + ARP[sib]) + 12, 0.17, 1.5, 4.5);
        tr.mel.step(t, s);
        if (tr.rng() < 0.035) vBell(tr.verb, t, tr.deg(c + [0, 2, 4][Math.floor(tr.rng() * 3)]) + 24, 0.18, 2.5);
      }
    },

    // ----------------------------------------------------------------- nave
    nave: {
      bpm: 46, spb: 1, bpb: 4, bpc: 2, root: 45, scale: DOR, vol: 0.9, wet: 0.65, seed: 44,
      progs: [[0, 3, 6, 0], [0, 2, 3, 4], [0, 6, 2, 3], [0, 3, 0, 4]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 9, hi: 15, len: 8, density: 0.45, vel: 0.5,
          voice: function (t, m, v, dur) { vOrgan(tr.in, t, [m], Math.max(0.8, dur * 0.95), 0.035 * v * 2, 0.15); }
        });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 260, fq: 0.5, vol: 0.09, lr: 0.04 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur;
        if (chg) {
          vChoir(tr.in, t, tr.chord(1, 3), bd * 2.35, { vol: 0.16, a: bd * 0.6, r: bd * 0.8 });
          vOrgan(tr.in, t, [tr.deg(c) - 12], bd * 2.05, 0.06, 0.8);
          if (tr.pi % 2 === 1) vOrgan(tr.in, t + bd, tr.chord(1, 3), bd * 1.1, 0.03, 1.2);
        }
        if (bar % 8 === 0 && sib === 0) vBell(tr.verb, t, tr.deg(0), 0.5, 7, true);
        if (bar % 8 >= 2) tr.mel.step(t, s);
      }
    },

    // ---------------------------------------------------------------- spire
    spire: {
      bpm: 76, spb: 2, bpb: 4, bpc: 2, root: 52, scale: PHRY, vol: 0.8, wet: 0.6, seed: 55,
      progs: [[0, 1, 0, 5], [0, 5, 6, 1], [0, 3, 1, 0], [0, 6, 5, 1]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 21, len: 16, density: 0.28, vel: 0.5,
          voice: function (t, m, v) { vBell(tr.in, t, m, v, 3.2); }
        });
        bed(tr, { ff: 3200, fq: 9, vol: 0.03, lr: 0.03, ld: 1600 });
        drone(tr, { freqs: [mtof(40), mtof(47) * 1.003], type: 'sine', cut: 500, vol: 0.09, lr: 0.05, trem: 0.21 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur;
        if (chg) {
          vPad(tr.in, t, tr.chord(1, 3), bd * 2.3, { type: 'triangle', cut: 3400, vol: 0.035, a: bd * 0.6, r: bd, det: 14, lfo: 0.3 });
        }
        if (sib === 0 && bar % 4 === 2 && tr.rng() < 0.6) {
          var arp = [0, 2, 4, 7, 9, 11, 14];
          for (var i = 0; i < arp.length; i++) vGlass(tr.verb, t + i * 0.075, tr.deg(c + arp[i]) + 12, 0.07 * (1 - i / 9));
        }
        tr.mel.step(t, s);
      }
    },

    // --------------------------------------------------------------- hearth
    hearth: {
      bpm: 54, spb: 2, bpb: 4, bpc: 4, root: 37, scale: PHRY, vol: 0.95, wet: 0.35, seed: 66,
      progs: [[0, 1], [0, 5], [0, 1, 0, 6], [0, 6]],
      setup: function (tr) {
        drone(tr, { freqs: [mtof(37), mtof(37) * 1.004, mtof(44)], cut: 200, q: 1.5, vol: 0.09, lr: 0.06, ld: 100 });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 150, fq: 0.5, vol: 0.1, lr: 0.05, ld: 50 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur;
        if ((sib === 0 || sib === 4) && tr.rng() > 0.1) vHeart(tr.in, t, sib === 0 ? 0.55 : 0.38);
        if (chg) {
          vBowed(tr.in, t, tr.deg(c), bd * 4.1, 0.4, 2);
          vBrass(tr.in, t + bd, tr.deg(c) + 12, bd * 2.5, 0.35);
        }
        if (sib % 2 === 0 && tr.rng() < 0.08) {
          vPiano(tr.in, t, tr.deg([0, 1, 4, 3, 7][Math.floor(tr.rng() * 5)]) + 12, 0.28);
        }
        if (tr.rng() < 0.35) {
          Z(tr.in, t + tr.rng() * tr.stepDur, { ft: 'bandpass', ff: rnd(2000, 6000), fq: 3, a: 0.001, d: rnd(0.006, 0.02), vol: rnd(0.03, 0.08), kind: 'm' });
        }
      }
    },

    // ----------------------------------------------------------------- boss
    boss: {
      bpm: 142, spb: 2, bpb: 4, bpc: 2, root: 38, scale: HARM, vol: 0.8, wet: 0.25, seed: 77,
      progs: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 5, 0, 4], [0, 3, 0, 4]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 21, len: 16, density: 0.5, vel: 0.5,
          voice: function (t, m, v, dur) { vBowed(tr.in, t, m, Math.max(0.2, dur * 0.95), v * 0.55, 4); }
        });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, I = intensity(bar, 32), cyc = bar % 32;
        var OST = [0, 0, 2, 0, 3, 0, 2, 1], CT = [0, 2, 4, 7];
        if (I >= 0) {
          var m = tr.deg(c + CT[OST[sib]]) + 12, acc = sib === 0 || sib === 3 || sib === 6;
          vPluck(tr.in, t, m, acc ? 0.34 : 0.2, 0.25, acc ? 7 : 5);
          if (I >= 3) vPluck(tr.in, t + tr.stepDur / 2, m + 12, 0.1, 0.14, 6);
        }
        if (sib === 0 || sib === 6) vTimp(tr.in, t, tr.deg(c), I >= 0 ? 0.6 : 0.45);
        if (I >= 1 && sib === 3) vTimp(tr.in, t, tr.deg(c), 0.38);
        if ((cyc === 29 || cyc === 31) && sib >= 4) {
          vTimp(tr.in, t, tr.deg(0), 0.3 + (sib - 4) * 0.08);
          vTimp(tr.in, t + tr.stepDur / 2, tr.deg(0), 0.3 + (sib - 4) * 0.08);
        }
        if (I >= 2 && (sib === 2 || sib === 6)) vSnare(tr.in, t, I >= 3 ? 0.35 : 0.25);
        if (chg) {
          vBowed(tr.in, t, tr.deg(c), bd * 2, 0.45, 2);
          if (I >= 1 || I === -1) {
            vBrass(tr.in, t, tr.deg(c), bd * 2, 0.45);
            vBrass(tr.in, t, tr.deg(c + 4), bd * 2, 0.3);
          }
        }
        if (I >= 3 && cyc === 22 && sib === 0) Z(tr.in, t, { hp: 4000, ft: 'lowpass', ff: 12000, a: 0.002, d: 1.6, vol: 0.12, kind: 'm' });
        if (I >= 2) tr.mel.step(t, s);
      }
    },

    // ----------------------------------------------------------- boss_final
    boss_final: {
      bpm: 116, spb: 3, bpb: 2, bpc: 2, root: 36, scale: PHRY, vol: 0.8, wet: 0.3, seed: 88,
      progs: [[0, 1, 0, 6], [0, 5, 1, 0], [0, 3, 1, 6], [0, 5, 6, 1]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 21, len: 12, density: 0.55, vel: 0.5,
          voice: function (t, m, v, dur) { vBowed(tr.in, t, m, Math.max(0.2, dur * 0.95), v * 0.55, 4); }
        });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 160, vol: 0.06, lr: 0.08 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, I = intensity(bar, 32), cyc = bar % 32;
        var OST = [0, 2, 1, 0, 2, 3], CT = [0, 2, 4, 7];
        if (I >= 0) {
          var dd = c + CT[OST[sib]];
          if (sib === 5 && tr.rng() < 0.3) dd = c + 1;
          var m = tr.deg(dd) + 12, acc = sib % 3 === 0;
          vPluck(tr.in, t, m, acc ? 0.34 : 0.2, 0.22, acc ? 7 : 5);
          if (I >= 2 && acc) vPluck(tr.in, t, m - 12, 0.22, 0.3, 4);
          if (I >= 3) vPluck(tr.in, t + tr.stepDur / 2, m + 12, 0.08, 0.12, 6);
        }
        if (sib === 0 || sib === 3) vTimp(tr.in, t, tr.deg(c) + 12, sib === 0 ? 0.6 : 0.45);
        if (I >= 2 && sib === 5) vTimp(tr.in, t, tr.deg(c) + 12, 0.3);
        if (I >= 1 && sib === 0) vBoom(tr.in, t, 0.5);
        if (I >= 3 && sib === 3) vSnare(tr.in, t, 0.32);
        if ((cyc === 29 || cyc === 31) && sib >= 3) vTimp(tr.in, t + tr.stepDur / 2, tr.deg(0) + 12, 0.35);
        if (chg) {
          vChoir(tr.in, t, tr.chord(1, 3), bd * tr.def.bpc * 1.1, { vol: 0.13, a: 0.4, r: 0.8 });
          if (I >= 1 || I === -1) {
            vBrass(tr.in, t, tr.deg(c) + 12, bd * 2, 0.45);
            vBrass(tr.in, t, tr.deg(c + 4) + 12, bd * 2, 0.3);
          }
          if (I === -1) vBowed(tr.in, t, tr.deg(c), bd * 2, 0.5, 2);
        }
        if (I >= 2) tr.mel.step(t, s);
      }
    },

    // ===================================================== World 2: Ember Sea
    // ---------------------------------------------------------------- shore
    // F dorian, very slow. Surf swells every 6-9 s, low drone, far horn calls, sparse harp.
    shore: {
      bpm: 50, spb: 2, bpb: 4, bpc: 2, root: 41, scale: DOR, vol: 0.95, wet: 0.55, seed: 101, fadeIn: 3,
      progs: [[0, 6, 3, 0], [0, 2, 6, 4], [0, 3, 2, 6], [0, 6, 2, 3]],
      setup: function (tr) {
        tr.far = far(tr, 1300, 0.3);
        tr.mel = new Melody(tr, {
          lo: 11, hi: 18, len: 16, density: 0.2, vel: 0.5,
          voice: function (t, m, v) { vPluck(tr.in, t, m, v * 0.8, 2.6, 3); }
        });
        drone(tr, { freqs: [mtof(29), mtof(36) * 1.003, mtof(41) * 0.998], type: 'triangle', cut: 240, q: 0.8, vol: 0.1, lr: 0.035, ld: 90 });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 320, fq: 0.5, vol: 0.06, lr: 0.03, ld: 140 });
        bed(tr, { ff: 900, fq: 0.5, vol: 0.01, lr: 0.11, ld: 500 });
        tr.waveAt = tr.t0 + 1.2; tr.call = null;
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, sd = tr.stepDur, i;
        if (chg) {
          vPad(tr.in, t, tr.chord(0, 3), bd * 2.3, { type: 'sawtooth', cut: 520, vol: 0.065, a: bd * 0.7, r: bd, det: 9, lfo: 0.07 });
          vBowed(tr.in, t, tr.deg(c) - 12, bd * 2.1, 0.4, 1.8);
          if (tr.rng() < 0.4) {
            for (i = 0; i < 4; i++) vPluck(tr.in, t + bd * 0.5 + i * 0.17, tr.deg(c + 2 * i) + 12, 0.16, 2.4, 3);
          }
        }
        // the surf
        if (t >= tr.waveAt) {
          vSurf(tr.in, t, 2 + tr.rng() * 1.6, 3 + tr.rng() * 2, 0.6 + tr.rng() * 0.4);
          tr.waveAt = t + 6 + tr.rng() * 3;
        }
        // horn calls across the water, sometimes answered an octave down
        var b8 = bar % 8, call;
        if (sib === 0 && b8 === 3 && tr.rng() < 0.75) tr.call = HORN_CALLS[Math.floor(tr.rng() * HORN_CALLS.length)];
        if (sib === 0 && tr.call && (b8 === 3 || (b8 === 5 && tr.rng() < 0.45))) {
          call = tr.call;
          for (i = 0; i < call.length; i++) {
            vHorn(tr.far, t + call[i][0] * sd, tr.deg(call[i][1]) - (b8 === 5 ? 12 : 0), call[i][2] * sd, b8 === 5 ? 0.4 : 0.6);
          }
          if (b8 === 5) tr.call = null;
        }
        if (b8 !== 3) tr.mel.step(t, s);
        // embers drifting up off the sea
        if (tr.rng() < 0.06) crackle(tr.in, t, 0.4, 2, 0.035, 'm');
      }
    },

    // -------------------------------------------------------------- galleon
    // G minor, lilting 3/4. Shanty fragment on a detuned music box over a squeezebox, creaking timbers.
    galleon: {
      bpm: 88, spb: 2, bpb: 3, bpc: 2, root: 43, scale: AEOL, vol: 0.9, wet: 0.5, seed: 112,
      progs: [[0, 4, 6, 0], [0, 4, 0, 4], [0, 5, 4, 0], [0, 6, 4, 0], [0, 3, 4, 0]],
      pick: function (tr, cyc) {
        return cyc % 2 === 0 ? tr.def.progs[0] : tr.def.progs[1 + Math.floor(tr.rng() * 4)];
      },
      setup: function (tr) {
        tr.box = function (t, m, v) {
          vMusicBox(tr.in, t, m + (tr.rng() - 0.5) * 0.3, v);
          if (tr.rng() < 0.35) vMusicBox(tr.verb, t + 0.012, m + 0.2, v * 0.45);
        };
        tr.mel = new Melody(tr, {
          lo: 7, hi: 13, len: 12, density: 0.36, vel: 0.5,
          voice: function (t, m, v) { tr.box(t, m + 12, v); }
        });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 220, fq: 0.6, vol: 0.09, lr: 0.045, ld: 90 });
        tr.creakAt = tr.t0 + 2; tr.half = false;
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, sd = tr.stepDur;
        if (chg) {
          vReed(tr.in, t, tr.chord(0, 3), bd * 2.05, { vol: 0.07, a: bd * 0.5, r: bd * 0.6, cut: 1700 });
          if (tr.rng() < 0.3) vChoir(tr.verb, t + bd * 0.5, tr.chord(1, 2), bd * 1.8, { vol: 0.05, a: bd * 0.7, r: bd * 0.8 });
        }
        // oom-pah-pah: bass on 1, soft reed chords on 2 and 3
        if (sib === 0) vPluck(tr.in, t, tr.deg(c), 0.42, 1.6, 2.2);
        if (sib === 2 || (sib === 4 && tr.rng() < 0.7)) {
          vReed(tr.in, t, tr.chord(1, 3), sd * 1.4, { vol: 0.035, a: 0.03, r: 0.12, cut: 2200, depth: 0.05 });
        }
        // the shanty on even cycles (sometimes only its first half), a drifting tune otherwise
        var local = s % (tr.spBar * 8);
        if (local === 0) tr.half = tr.rng() < 0.4;
        if (tr.cycle % 2 === 0) {
          var nn = SHANTY[local];
          if (nn && !(tr.half && local >= tr.spBar * 4)) tr.box(t, tr.deg(nn[0]) + 12, 0.55);
        } else {
          tr.mel.step(t, local);
        }
        // creaking timbers, a groaning hull
        if (t >= tr.creakAt) {
          vCreak(tr.in, t, 0.5);
          if (tr.rng() < 0.4) vCreak(tr.in, t + 0.3 + tr.rng() * 0.5, 0.35);
          tr.creakAt = t + 2.5 + tr.rng() * 4;
        }
        if (bar % 4 === 2 && sib === 0 && tr.rng() < 0.5) {
          T(tr.in, t, { type: 'sawtooth', f: 38, f2: 33, ft: 'lowpass', ff: 140, fq: 2, a: 1.2, h: 0.4, d: 1.4, vol: 0.06, kind: 'm' });
        }
      }
    },

    // ----------------------------------------------------------- lighthouse
    // Bb phrygian. Heartbeat on every beat, tension rising over 24 bars then breaking; the beacon motif on bells.
    lighthouse: {
      bpm: 66, spb: 2, bpb: 4, bpc: 2, root: 46, scale: PHRY, vol: 0.9, wet: 0.5, seed: 123,
      progs: [[0, 1, 0, 6], [0, 5, 1, 0], [0, 6, 5, 1], [0, 1, 5, 6]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 11, hi: 17, len: 16, density: 0.22, vel: 0.5,
          voice: function (t, m, v, dur) { vBowed(tr.in, t, m, Math.max(0.5, dur * 0.95), v * 0.5, 3); }
        });
        drone(tr, { freqs: [mtof(34), mtof(41) * 1.003], type: 'sawtooth', cut: 160, q: 1.2, vol: 0.07, lr: 0.05, ld: 60 });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 260, vol: 0.05, lr: 0.06 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, cyc = bar % 24, ten = cyc / 21, calm = cyc >= 22;
        if (sib % 2 === 0 && !calm) vHeart(tr.in, t, (sib === 0 ? 0.42 : 0.3) + ten * 0.22);
        if (chg) {
          vPad(tr.in, t, tr.chord(0, 3), bd * 2.3, { type: 'sawtooth', cut: 450 + Math.min(ten, 1) * 2200, vol: 0.05 + Math.min(ten, 1) * 0.03,
            a: bd * 0.6, r: bd * 0.8, det: 8 + ten * 10, lfo: 0.1 + ten * 0.4 });
          vBowed(tr.in, t, tr.deg(c) - 12, bd * 2.1, 0.4, 2);
          if (ten > 0.5 && !calm) vBowed(tr.in, t, tr.deg(c + 7) + 12, bd * 2.1, 0.2 + ten * 0.2, 4);
          if (ten > 0.75 && !calm) vBrass(tr.in, t + bd, tr.deg(c) + 12, bd * 1.1, 0.35);
          if (cyc === 22) vChoir(tr.in, t, tr.chord(1, 3), bd * 2.2, { vol: 0.09, a: bd * 0.5, r: bd });
        }
        // the beacon
        if (bar % 2 === 0 && sib % 2 === 0) {
          var bm = tr.deg(BEACON[sib >> 1]);
          vBell(tr.in, t, bm, 0.45, 3.5);
          if (ten > 0.4) vGlass(tr.verb, t + 0.01, bm + 12, 0.05);
        }
        // the beam sweeping past
        if (bar % 2 === 1 && sib === 0) {
          Z(tr.verb, t, { ft: 'bandpass', ff: 300, fp: [[1.6, 2600], [3.6, 300]], fq: 1.2, a: 1.6, d: 2, vol: 0.05, kind: 'm' });
        }
        if (tr.rng() < 0.03 + ten * 0.05) vBell(tr.verb, t, tr.deg(c + [0, 2, 4][Math.floor(tr.rng() * 3)]) + 24, 0.2, 2.5);
        if (ten > 0.8 && !calm && sib === 6) vTimp(tr.in, t, tr.deg(c) + 12, 0.3);
        if (ten > 0.25 && !calm && bar % 2 === 1) tr.mel.step(t, s);
        if (tr.rng() < 0.25) crackle(tr.in, t, tr.stepDur, 1, 0.04, 'm');
      }
    },

    // =================================================== World 3: Dreaming Wick
    // ---------------------------------------------------------------- paper
    // D lydian. Pizzicato, celesta, soft rustling, page turns.
    paper: {
      bpm: 76, spb: 2, bpb: 4, bpc: 2, root: 50, scale: LYD, vol: 1.15, wet: 0.5, seed: 134,
      progs: [[0, 1, 5, 1], [0, 4, 1, 0], [0, 2, 1, 5], [0, 1, 0, 6]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 21, len: 16, density: 0.3, vel: 0.5,
          voice: function (t, m, v) { vCelesta(tr.in, t, m + 12, v * 0.9); }
        });
        bed(tr, { ff: 5200, fq: 0.8, vol: 0.008, lr: 0.13, ld: 2200 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, i;
        var PZ = [0, 4, 2, 4, 7, 4, 2, 4];
        if (chg) {
          var notes = tr.chord(0, 3); notes.push(tr.deg(c + 6));
          vPad(tr.in, t, notes, bd * 2.3, { type: 'triangle', cut: 1500, vol: 0.045, a: bd * 0.7, r: bd, det: 5, lfo: 0.09 });
          vPluck(tr.in, t, tr.deg(c) - 12, 0.38, 0.9, 2.2);
        }
        if (sib === 4) vPluck(tr.in, t, tr.deg(c + 4) - 12, 0.26, 0.7, 2.2);
        if (tr.rng() < (sib % 2 === 0 ? 0.6 : 0.3)) vPluck(tr.in, t, tr.deg(c + PZ[sib]), 0.2, 0.35, 2.8);
        if (bar % 4 === 3 && sib === 4 && tr.rng() < 0.6) {
          var R = [0, 2, 4, 7];
          for (i = 0; i < R.length; i++) vCelesta(tr.verb, t + i * 0.09, tr.deg(c + R[i]) + 24, 0.2);
        }
        if (bar % 8 >= 1) tr.mel.step(t, s);
        // rustling leaves, the odd page turning
        if (tr.rng() < 0.3) {
          Z(tr.in, t + tr.rng() * tr.stepDur, { ft: 'bandpass', ff: rnd(2500, 7500), fq: 1.5, a: 0.008, d: rnd(0.03, 0.1), vol: rnd(0.01, 0.03), kind: 'm' });
        }
        if (bar % 8 === 7 && sib === 2) {
          Z(tr.in, t, { ft: 'bandpass', ff: 900, fp: [[0.25, 5200], [0.6, 2000]], fq: 0.9, a: 0.25, d: 0.35, vol: 0.045, kind: 'm' });
        }
      }
    },

    // ---------------------------------------------------------------- clock
    // B whole-tone. Tick-tock on quarters, a second gear in threes, music-box arpeggios, organ; the clock stalls every 8 bars.
    clock: {
      bpm: 92, spb: 4, bpb: 4, bpc: 2, root: 47, scale: WT, vol: 0.9, wet: 0.45, seed: 145,
      progs: [[0, 1, 0, 5], [0, 2, 1, 5], [0, 5, 4, 1], [0, 3, 2, 1]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 12, hi: 18, len: 32, density: 0.12, vel: 0.5,
          voice: function (t, m, v) { vBell(tr.in, t, m, v * 0.7, 2.2); }
        });
        drone(tr, { freqs: [mtof(35), mtof(35) * 1.004], type: 'sawtooth', cut: 150, vol: 0.05, lr: 0.05, ld: 50 });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 240, vol: 0.04 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, stall = bar % 8 === 7 && sib >= 8;
        var ARP = [0, 2, 4, 6, 8, 6, 4, 2];
        if (!stall) {
          if (sib % 4 === 0) vTick(tr.in, t, sib % 8 === 0 ? 0.5 : 0.38, sib % 8 === 0 ? 2600 : 1900);
          else if (tr.rng() < 0.45) vTick(tr.in, t, 0.1, 4200);
          if (s % 3 === 0) vTick(tr.in, t + 0.004, 0.16, 3300);
          if (s % 10 === 0) {
            T(tr.in, t, { type: 'triangle', f: 420, f2: 380, a: 0.001, d: 0.07, vol: 0.12, kind: 'm' });
            Z(tr.in, t, { ft: 'bandpass', ff: 700, fq: 2, a: 0.001, d: 0.03, vol: 0.12, kind: 'm' });
          }
          if (sib % 2 === 0 && bar % 8 < 6) {
            var k = sib >> 1, d = c + ARP[bar % 2 ? 7 - k : k];
            vMusicBox(tr.in, t, tr.deg(d) + 24 + Math.sin(s * 0.05) * 0.12, 0.24);
          }
        }
        if (chg) {
          vOrgan(tr.in, t, tr.chord(1, 3), bd * 2.05, 0.045, 0.6);
          vOrgan(tr.in, t, [tr.deg(c)], bd * 2.05, 0.05, 0.4);
        }
        if (bar % 8 === 0 && sib === 0) vBell(tr.verb, t, tr.deg(3), 0.35, 6, true);
        if (bar % 8 >= 2) tr.mel.step(t, s);
      }
    },

    // ----------------------------------------------------------------- core
    // Eb major, very slow. Choir, organ, sub swells; layers enter over ~2 minutes, then breathe in a long arc.
    core: {
      bpm: 40, spb: 1, bpb: 4, bpc: 2, root: 39, scale: MAJ, vol: 0.9, wet: 0.6, seed: 156, fadeIn: 4,
      progs: [[0, 5, 3, 4], [0, 3, 5, 4], [5, 3, 0, 4], [0, 4, 5, 3], [3, 0, 4, 0]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 7, hi: 13, len: 8, density: 0.4, vel: 0.5,
          voice: function (t, m, v, dur) {
            vHorn(tr.in, t, m, Math.max(1, dur * 0.95), v * 0.8);
            if (tr.lvl >= 4) vBowed(tr.in, t, m + 12, Math.max(1, dur * 0.95), v * 0.35, 3.5);
          }
        });
        drone(tr, { freqs: [mtof(27), mtof(34) * 1.002, mtof(39)], type: 'sine', cut: 300, vol: 0.12, lr: 0.03, ld: 60 });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 200, vol: 0.06, lr: 0.03, ld: 60 });
        tr.lvl = 0;
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, L;
        if (bar < 20) L = Math.floor(bar / 4);
        else { var k = (bar - 20) % 24; L = k < 12 ? 4 : k < 18 ? 3 : k < 22 ? 2 : 3; }
        tr.lvl = L;
        if (chg) {
          T(tr.in, t, { f: mtof(tr.deg(c) - 12), a: bd * 0.8, h: bd * 0.4, d: bd * 0.9, vol: 0.2 + L * 0.03, kind: 'm' });
          vOrgan(tr.in, t, [tr.deg(c)], bd * 2.05, 0.07, 1.5);
          if (L >= 1) vChoir(tr.in, t, tr.chord(1, 3), bd * 2.3, { vol: 0.12 + L * 0.01, a: bd * 0.6, r: bd * 0.8 });
          if (L >= 2) vOrgan(tr.in, t + bd, tr.chord(1, 3), bd * 1.05, 0.035, 1.5);
          if (L >= 3) vBowed(tr.in, t, tr.deg(c + 7) + 12, bd * 2.1, 0.3, 3.5);
          if (L >= 4) {
            vChoir(tr.in, t + bd * 0.25, tr.chord(2, 3), bd * 2, { vol: 0.06, a: bd * 0.6, r: bd * 0.8 });
            vTimp(tr.in, t, tr.deg(c) + 12, 0.35);
          }
        }
        if (sib === 0 && (L >= 4 || bar % 8 === 0)) vBell(tr.verb, t, tr.deg(0) + (L >= 4 ? 24 : 12), L >= 4 ? 0.25 : 0.35, 6, true);
        if (L >= 2 && bar % 8 >= 1) tr.mel.step(t, s);
      }
    },

    // ------------------------------------------------------------- boss_sea
    // B minor, driving 6/8. Rocking low-string ostinato, timpani, low brass, breaking waves.
    boss_sea: {
      bpm: 100, spb: 3, bpb: 2, bpc: 2, root: 35, scale: AEOL, vol: 0.8, wet: 0.28, seed: 167,
      progs: [[0, 5, 6, 0], [0, 3, 5, 6], [0, 6, 5, 4], [0, 5, 3, 4]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 21, len: 12, density: 0.5, vel: 0.5,
          voice: function (t, m, v, dur) { vBowed(tr.in, t, m, Math.max(0.2, dur * 0.95), v * 0.55, 4); }
        });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 180, vol: 0.07, lr: 0.11, ld: 120 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, I = intensity(bar, 32), cyc = bar % 32;
        var OST = [0, 2, 1, 3, 1, 2], CT = [0, 2, 4, 7];
        if (I >= 0) {
          var m = tr.deg(c + CT[OST[sib]]) + 12, acc = sib % 3 === 0;
          vPluck(tr.in, t, m, acc ? 0.34 : 0.2, 0.26, acc ? 6 : 4.5);
          if (acc) vPluck(tr.in, t, tr.deg(c), 0.3, 0.4, 3);
          if (I >= 3) vPluck(tr.in, t + tr.stepDur / 2, m + 12, 0.08, 0.12, 6);
        }
        if (sib === 0) vTimp(tr.in, t, tr.deg(c) + 12, I >= 0 ? 0.65 : 0.5);
        if (sib === 3) vTimp(tr.in, t, tr.deg(c + 4), 0.42);
        if (I >= 2 && sib === 5) vTimp(tr.in, t, tr.deg(c) + 12, 0.3);
        if (I >= 2 && sib === 0 && bar % 2 === 0) vBoom(tr.in, t, 0.45);
        if ((cyc === 29 || cyc === 31) && sib >= 3) {
          vTimp(tr.in, t, tr.deg(0) + 12, 0.3 + (sib - 3) * 0.08);
          vTimp(tr.in, t + tr.stepDur / 2, tr.deg(0) + 12, 0.3 + (sib - 3) * 0.08);
        }
        if (chg) {
          vBowed(tr.in, t, tr.deg(c), bd * 2, 0.5, 2);
          if (I >= 1 || I === -1) {
            vBrass(tr.in, t, tr.deg(c) + 12, bd * 2, 0.5);
            vBrass(tr.in, t, tr.deg(c + 2) + 12, bd * 2, 0.3);
            if (I >= 2) vBrass(tr.in, t, tr.deg(c), bd * 2, 0.3);
          }
        }
        if (I >= 3 && bar % 2 === 1 && sib === 3) {
          vBrass(tr.in, t, tr.deg(c) + 12, 0.55, 0.4);
          vBrass(tr.in, t, tr.deg(c + 4) + 12, 0.55, 0.3);
        }
        if (I >= 1 && cyc % 4 === 3 && sib === 0) vSurf(tr.in, t, bd * 0.9, 1.6, 0.8);
        if (I >= 2) tr.mel.step(t, s);
      }
    },

    // ----------------------------------------------------------- boss_dream
    // E phrygian-dominant, 7/8 alternating 2+2+3 / 3+2+2. bpm counts eighths; steps are sixteenths.
    // Clockwork ticks, plucked ostinato, timpani on the groups, choir stabs.
    boss_dream: {
      bpm: 300, spb: 2, bpb: 7, bpc: 2, root: 40, scale: PHRYD, vol: 0.8, wet: 0.3, seed: 178,
      progs: [[0, 1, 0, 6], [0, 5, 1, 0], [0, 3, 1, 6], [0, 1, 5, 4]],
      setup: function (tr) {
        tr.mel = new Melody(tr, {
          lo: 14, hi: 21, len: 28, density: 0.32, vel: 0.5,
          voice: function (t, m, v, dur) { vBowed(tr.in, t, m, Math.max(0.15, dur * 0.95), v * 0.55, 4); }
        });
        bed(tr, { brown: 1, ft: 'lowpass', ff: 170, vol: 0.05, lr: 0.09 });
      },
      step: function (tr, t, s, bar, sib, chg) {
        var c = tr.chordDeg, bd = tr.barDur, I = intensity(bar, 32), cyc = bar % 32;
        var grp = bar % 2 === 0 ? [0, 4, 8] : [0, 6, 10];
        var gi = grp.indexOf(sib), acc = gi >= 0, even = sib % 2 === 0;
        vTick(tr.in, t, acc ? 0.4 : (even ? 0.2 : 0.1), acc ? 2400 : (even ? 3000 : 4200));
        if (even && I >= 0) {
          var g = sib >= grp[2] ? 2 : sib >= grp[1] ? 1 : 0, pos = (sib - grp[g]) >> 1;
          var m = tr.deg(c + [0, 4, 1][pos] + (g === 1 && pos === 0 ? 2 : 0)) + 12;
          vPluck(tr.in, t, m, acc ? 0.32 : 0.2, 0.2, acc ? 7 : 5);
          if (I >= 1 && acc) vMusicBox(tr.in, t, m + 24, 0.18);
          if (I >= 3) vPluck(tr.in, t + tr.stepDur, m + 12, 0.08, 0.12, 6);
        }
        if (acc) vTimp(tr.in, t, tr.deg(c) + 12, gi === 0 ? 0.6 : 0.4);
        if (I >= 1 && sib === 0) vBoom(tr.in, t, 0.45);
        if (I >= 2 && sib === grp[2]) vSnare(tr.in, t, 0.3);
        if ((cyc === 29 || cyc === 31) && sib >= 8 && even) vTimp(tr.in, t, tr.deg(0) + 12, 0.3 + (sib - 8) * 0.04);
        if (I >= 1 && acc && (gi > 0 || I >= 3)) vChoir(tr.in, t, tr.chord(1, 3), 0.32, { vol: 0.12, a: 0.015, r: 0.14 });
        if (chg) {
          vBowed(tr.in, t, tr.deg(c), bd * 2, 0.45, 2);
          if (I >= 1 || I === -1) {
            vBrass(tr.in, t, tr.deg(c) + 12, bd * 2, 0.42);
            vBrass(tr.in, t, tr.deg(c + 4) + 12, bd * 2, 0.28);
          }
          if (I === -1) vChoir(tr.in, t, tr.chord(1, 3), bd * 2, { vol: 0.12, a: 0.5, r: 0.8 });
        }
        if (bar % 8 === 4 && sib === 0) vBell(tr.verb, t, tr.deg(c) + 24, 0.25, 3);
        if (I >= 2) tr.mel.step(t, s);
      }
    },

    // -------------------------------------------------------------- victory
    victory: {
      oneShot: 7, fadeIn: 0.03, bpm: 60, spb: 1, bpb: 4, bpc: 1, root: 48, scale: MAJ, vol: 0.9, wet: 0.5, seed: 99,
      progs: [[0]],
      setup: function (tr) {
        var t = tr.t0 + 0.05, I = tr.in, t2 = t + 1.1, i;
        var chords = [[44, 51, 56, 60], [46, 53, 58, 62], [48, 55, 60, 64, 67]];
        var times = [t, t + 0.55, t2], durs = [0.62, 0.62, 4.4];
        vTimp(I, t, 44, 0.45); vTimp(I, t + 0.55, 46, 0.5); vTimp(I, t2, 48, 0.85); vBoom(I, t2, 0.6);
        for (var k = 0; k < 3; k++) {
          for (i = 0; i < chords[k].length; i++) {
            vBrass(I, times[k], chords[k][i], durs[k], (k === 2 ? 0.5 : 0.42) * (i === 0 ? 1.2 : 1));
          }
        }
        vChoir(I, t2, [60, 64, 67], 4.6, { vol: 0.12, a: 0.4, r: 2.6 });
        vPad(I, t2, [48, 55, 64, 72], 5, { type: 'sawtooth', cut: 1800, vol: 0.06, a: 0.3, r: 3 });
        var arp = [60, 64, 67, 72, 76, 79, 84, 88];
        for (i = 0; i < arp.length; i++) vPluck(I, t + 0.2 + i * 0.11, arp[i] - (i < 4 ? 0 : 0), 0.26, 1.6, 6);
        vBell(tr.verb, t2 + 0.05, 84, 0.4, 4);
        vBell(tr.verb, t2 + 0.4, 91, 0.3, 4);
        vBell(I, t2, 72, 0.25, 5);
      }
    }
  };

  // ================================================================== sfx
  // Each f(dest, t, pitch) builds the sound and returns its duration (s).
  // w = reverb send, v = base volume, min = re-trigger guard, jit = random pitch, low = droppable

  var SFX = {
    slash: { w: 0.15, jit: 0.08, f: function (d, t, p) {
      Z(d, t, { ft: 'bandpass', ff: 3400 * p, ff2: 850 * p, fq: 1.3, a: 0.004, d: 0.13, vol: 0.6 });
      Z(d, t, { ft: 'highpass', ff: 5500, a: 0.002, d: 0.05, vol: 0.22 });
      T(d, t, { type: 'triangle', f: 1900 * p, f2: 1200 * p, a: 0.002, d: 0.08, vol: 0.07 });
      return 0.2;
    } },
    hit: { w: 0.12, jit: 0.08, min: 0.03, f: function (d, t, p) {
      T(d, t, { f: 240 * p, f2: 70 * p, sw: 0.1, a: 0.002, d: 0.12, vol: 0.6 });
      Z(d, t, { ft: 'bandpass', ff: 1400 * p, fq: 1.2, a: 0.001, d: 0.07, vol: 0.55 });
      Z(d, t, { ft: 'lowpass', ff: 650, a: 0.001, d: 0.1, vol: 0.4 });
      T(d, t, { type: 'square', f: 900 * p, f2: 380 * p, a: 0.001, d: 0.03, vol: 0.06 });
      return 0.2;
    } },
    clank: { w: 0.25, jit: 0.05, f: function (d, t, p) {
      var fr = [523, 1307, 2204, 3170], dc = [0.35, 0.25, 0.18, 0.12], vv = [0.14, 0.11, 0.08, 0.06];
      for (var i = 0; i < 4; i++) T(d, t, { type: i ? 'sine' : 'triangle', f: fr[i] * p, a: 0.001, d: dc[i], vol: vv[i] });
      Z(d, t, { ft: 'highpass', ff: 3000, a: 0.001, d: 0.045, vol: 0.35 });
      T(d, t, { f: 180 * p, f2: 90, a: 0.001, d: 0.06, vol: 0.22 });
      return 0.4;
    } },
    jump: { w: 0.05, jit: 0.04, f: function (d, t, p) {
      T(d, t, { f: 260 * p, f2: 520 * p, sw: 0.08, a: 0.005, d: 0.12, vol: 0.16 });
      Z(d, t, { ft: 'bandpass', ff: 1800, fq: 1, a: 0.003, d: 0.06, vol: 0.12 });
      return 0.15;
    } },
    djump: { w: 0.1, f: function (d, t, p) {
      for (var k = 0; k < 2; k++) {
        Z(d, t + k * 0.075, { ft: 'lowpass', ff: 2200 * p, ff2: 380, fq: 1, a: 0.008, d: 0.09, vol: 0.38 - k * 0.08, rate: 0.8 });
      }
      T(d, t, { f: 420 * p, f2: 760 * p, a: 0.01, d: 0.15, vol: 0.07 });
      return 0.25;
    } },
    land: { w: 0.03, jit: 0.06, min: 0.05, f: function (d, t, p) {
      T(d, t, { f: 130 * p, f2: 45, sw: 0.08, a: 0.002, d: 0.12, vol: 0.4 });
      Z(d, t, { ft: 'lowpass', ff: 520, a: 0.002, d: 0.07, vol: 0.3 });
      return 0.15;
    } },
    dash: { w: 0.12, f: function (d, t, p) {
      Z(d, t, { ft: 'bandpass', ff: 500 * p, ff2: 3200 * p, fq: 0.9, a: 0.02, d: 0.2, vol: 0.5 });
      Z(d, t, { ft: 'highpass', ff: 6000, a: 0.01, d: 0.1, vol: 0.1 });
      T(d, t, { f: 180 * p, f2: 90, a: 0.005, d: 0.15, vol: 0.12 });
      return 0.25;
    } },
    walljump: { w: 0.06, jit: 0.04, f: function (d, t, p) {
      Z(d, t, { ft: 'bandpass', ff: 2400 * p, fq: 1.4, a: 0.001, d: 0.05, vol: 0.3 });
      T(d, t, { type: 'triangle', f: 330 * p, f2: 660 * p, a: 0.004, d: 0.1, vol: 0.12 });
      return 0.12;
    } },
    hurt: { w: 0.35, min: 0.1, f: function (d, t, p) {
      T(d, t, { f: 110 * p, f2: 32, sw: 0.3, a: 0.003, d: 0.5, vol: 0.95 });
      Z(d, t, { ft: 'lowpass', ff: 1400, ff2: 150, a: 0.002, d: 0.3, vol: 0.7 });
      T(d, t, { type: 'sawtooth', f: 220 * p, f2: 55, a: 0.002, d: 0.25, vol: 0.16, ft: 'lowpass', ff: 1200 });
      T(d, t + 0.01, { f: 2637 * p, a: 0.01, d: 1.4, vol: 0.11 });
      T(d, t + 0.01, { f: 2651 * p, a: 0.01, d: 1.4, vol: 0.09 });
      T(d, t + 0.01, { f: 3951 * p, a: 0.01, d: 0.8, vol: 0.04 });
      return 1.5;
    } },
    heal: { w: 0.5, f: function (d, t, p) {
      var semis = [0, 4, 7, 12, 16];
      for (var i = 0; i < semis.length; i++) {
        var f = 523.25 * Math.pow(2, semis[i] / 12) * p;
        T(d, t + i * 0.07, { type: 'triangle', f: f, a: 0.02, d: 0.9, vol: 0.11 });
        T(d, t + i * 0.07, { f: f * 2, a: 0.01, d: 0.45, vol: 0.035 });
      }
      T(d, t, { f: 261.6 * p, f2: 523.25 * p, a: 0.25, d: 0.9, vol: 0.1 });
      Z(d, t, { ft: 'highpass', ff: 7000, a: 0.3, d: 0.6, vol: 0.05 });
      return 1.4;
    } },
    focus: { w: 0.3, min: 0.3, f: function (d, t, p) {
      T(d, t, { f: 196 * p, f2: 784 * p, sw: 1.0, a: 0.15, h: 0.65, d: 0.25, vol: 0.18 });
      T(d, t, { f: 199 * p, f2: 790 * p, sw: 1.0, a: 0.15, h: 0.65, d: 0.25, vol: 0.12 });
      T(d, t, { type: 'triangle', f: 392 * p, f2: 1568 * p, sw: 1.0, a: 0.2, h: 0.6, d: 0.25, vol: 0.05 });
      Z(d, t, { ft: 'bandpass', ff: 800, ff2: 4000, fq: 3, a: 0.8, d: 0.25, vol: 0.06 });
      return 1.15;
    } },
    cast: { w: 0.2, f: function (d, t, p) {
      Z(d, t, { ft: 'bandpass', ff: 300 * p, ff2: 2600 * p, fs: 0.15, fq: 1.2, a: 0.03, d: 0.3, vol: 0.6 });
      T(d, t, { type: 'sawtooth', f: 160 * p, f2: 70, a: 0.01, d: 0.3, vol: 0.18, ft: 'lowpass', ff: 800 });
      T(d, t, { f: 900 * p, f2: 1800 * p, a: 0.005, d: 0.08, vol: 0.06 });
      crackle(d, t + 0.05, 0.25, 4, 0.12);
      return 0.4;
    } },
    explode: { w: 0.3, f: function (d, t, p) {
      Z(d, t, { ft: 'lowpass', ff: 4000 * p, ff2: 250, a: 0.003, d: 0.45, vol: 0.8 });
      T(d, t, { f: 140 * p, f2: 38, a: 0.002, d: 0.35, vol: 0.6 });
      Z(d, t, { ft: 'bandpass', ff: 900, fq: 1, a: 0.002, d: 0.15, vol: 0.3 });
      crackle(d, t + 0.03, 0.4, 7, 0.15);
      return 0.6;
    } },
    pickup: { w: 0.3, jit: 0.03, min: 0.03, low: true, f: function (d, t, p) {
      T(d, t, { f: 1568 * p, a: 0.002, d: 0.18, vol: 0.13 });
      T(d, t + 0.045, { f: 2349 * p, a: 0.002, d: 0.25, vol: 0.1 });
      T(d, t, { f: 4699 * p, a: 0.001, d: 0.05, vol: 0.03 });
      return 0.35;
    } },
    ability: { w: 0.55, min: 0.5, f: function (d, t, p) {
      var ch = [50, 57, 62, 66, 69, 74, 78, 81], i;
      for (i = 0; i < ch.length; i++) {
        T(d, t, { type: 'sawtooth', f: mtof(ch[i]) * p, det: rnd(-9, 9), a: 0.25, h: 0.8, d: 1.8, vol: 0.045,
          ft: 'lowpass', ff: 400, ff2: 5000, fs: 1.2 });
      }
      var bells = [74, 78, 81, 86, 90, 93];
      for (i = 0; i < bells.length; i++) {
        T(d, t + 0.12 + i * 0.13, { f: mtof(bells[i]) * p, a: 0.002, d: 1.4, vol: 0.07 });
        T(d, t + 0.12 + i * 0.13, { f: mtof(bells[i]) * 2.76 * p, a: 0.001, d: 0.4, vol: 0.025 });
      }
      Z(d, t, { ft: 'highpass', ff: 6000, a: 0.6, h: 0.3, d: 1.5, vol: 0.06 });
      T(d, t, { f: 73.4 * p, f2: 55, a: 0.01, d: 1.5, vol: 0.32 });
      Z(d, t, { ft: 'lowpass', ff: 600, a: 0.002, d: 0.4, vol: 0.3 });
      return 3.2;
    } },
    bench: { w: 0.5, min: 0.5, f: function (d, t, p) {
      Z(d, t, { ft: 'bandpass', ff: 2600, fq: 1.5, a: 0.002, d: 0.08, vol: 0.32 });
      Z(d, t + 0.05, { ft: 'lowpass', ff: 1600, ff2: 600, fq: 1, a: 0.05, d: 0.35, vol: 0.16 });
      T(d, t + 0.15, { f: 1318.5 * p, a: 0.003, d: 1.3, vol: 0.09 });
      T(d, t + 0.15, { f: 2637 * p, a: 0.002, d: 0.4, vol: 0.025 });
      T(d, t + 0.32, { f: 1975.5 * p, a: 0.003, d: 1.3, vol: 0.065 });
      var org = [53, 60, 64, 67, 69];
      for (var i = 0; i < org.length; i++) {
        var f = mtof(org[i]) * p;
        T(d, t + 0.2, { f: f, a: 0.8, h: 0.8, d: 1.4, vol: 0.04 });
        T(d, t + 0.2, { f: f * 2, a: 0.8, h: 0.8, d: 1.2, vol: 0.018 });
      }
      return 3.3;
    } },
    door: { w: 0.3, min: 0.3, f: function (d, t, p) {
      var J = G(0.55), lfo = O('square', 13 * p), lg = G(0.4);
      lfo.connect(lg); lg.connect(J.gain); J.connect(d);
      lfo.start(t); lfo.stop(t + 1.35);
      reg(lfo, [lfo, lg, J], 0);
      Z(J, t, { brown: 1, ft: 'lowpass', ff: 380, fq: 2, a: 0.1, h: 0.9, d: 0.3, vol: 1.0 });
      Z(J, t, { ft: 'bandpass', ff: 900, fq: 2, a: 0.1, h: 0.9, d: 0.3, vol: 0.12 });
      T(d, t, { f: 48 * p, a: 0.1, h: 0.9, d: 0.4, vol: 0.3 });
      T(d, t + 1.2, { f: 90 * p, f2: 35, a: 0.002, d: 0.4, vol: 0.7 });
      Z(d, t + 1.2, { ft: 'lowpass', ff: 420, a: 0.002, d: 0.25, vol: 0.5 });
      return 1.8;
    } },
    enemy_die: { w: 0.25, jit: 0.06, f: function (d, t, p) {
      T(d, t, { f: 700 * p, f2: 140 * p, sw: 0.09, a: 0.002, d: 0.1, vol: 0.35 });
      Z(d, t, { ft: 'bandpass', ff: 1800 * p, fq: 1, a: 0.001, d: 0.08, vol: 0.3 });
      T(d, t, { type: 'triangle', f: 300 * p, f2: 120, a: 0.003, d: 0.25, vol: 0.1 });
      crackle(d, t + 0.04, 0.35, 6, 0.1);
      return 0.5;
    } },
    boss_roar: { w: 0.35, min: 0.5, f: function (d, t, p) {
      var dur = 1.5, end = t + dur + 0.1;
      var env = G(0), ws = ctx.createWaveShaper(), pre = G(0.5);
      ws.curve = distCurve; ws.oversample = '2x';
      var lp = F('lowpass', 600, 2.5);
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.linearRampToValueAtTime(1700, t + 0.3);
      lp.frequency.exponentialRampToValueAtTime(320, t + dur);
      var trem = G(1), tl = O('sine', 23), tlg = G(0.35);
      tl.connect(tlg); tlg.connect(trem.gain);
      var pl = O('sine', 6.5), plg = G(40);
      pl.connect(plg);
      var fr = [55, 58.5, 82.4, 110], oscs = [tl, pl], list = [env, ws, pre, lp, trem, tl, tlg, pl, plg];
      for (var i = 0; i < fr.length; i++) {
        var f = fr[i] * p, o = O('sawtooth', f);
        o.frequency.setValueAtTime(f * 0.92, t);
        o.frequency.linearRampToValueAtTime(f * 1.08, t + 0.25);
        o.frequency.exponentialRampToValueAtTime(f * 0.75, t + dur);
        plg.connect(o.detune); o.connect(pre); oscs.push(o); list.push(o);
      }
      pre.connect(ws); ws.connect(lp); lp.connect(trem); trem.connect(env); env.connect(d);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.5, t + 0.2);
      env.gain.linearRampToValueAtTime(0.42, t + 1.0);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      startStop(oscs, t, end);
      reg(oscs[2], list, 's');
      Z(d, t, { brown: 1, ft: 'lowpass', ff: 500, a: 0.15, h: 0.9, d: 0.5, vol: 0.7 });
      Z(d, t, { ft: 'bandpass', ff: 700, fq: 1.5, a: 0.1, h: 0.6, d: 0.6, vol: 0.12 });
      return dur + 0.2;
    } },
    boss_slam: { w: 0.25, min: 0.08, f: function (d, t, p) {
      T(d, t, { f: 85 * p, f2: 26, sw: 0.5, a: 0.002, d: 0.9, vol: 1.0 });
      Z(d, t, { ft: 'lowpass', ff: 320, a: 0.002, d: 0.35, vol: 0.8 });
      Z(d, t, { ft: 'bandpass', ff: 1200, fq: 1, a: 0.001, d: 0.05, vol: 0.3 });
      T(d, t, { type: 'triangle', f: 60 * p, f2: 30, a: 0.002, d: 0.5, vol: 0.3 });
      return 1.0;
    } },
    boss_die: { w: 0.7, min: 1, f: function (d, t, p) {
      Z(d, t, { ft: 'lowpass', ff: 8000, ff2: 200, fs: 2.5, a: 0.005, d: 3, vol: 0.7 });
      Z(d, t, { brown: 1, ft: 'lowpass', ff: 300, a: 0.01, d: 3.5, vol: 0.6 });
      T(d, t, { f: 70 * p, f2: 20, a: 0.003, d: 3, vol: 0.7 });
      var seq = [86, 84, 81, 79, 77, 76, 74, 72, 69, 67, 65, 62];
      for (var i = 0; i < seq.length; i++) {
        var f = mtof(seq[i]) * p, tt = t + 0.3 + i * 0.22, v = 0.1 * (1 - i / 16);
        T(d, tt, { type: 'triangle', f: f, a: 0.003, d: 1.4, vol: v });
        T(d, tt, { f: f * 2.76, a: 0.002, d: 0.4, vol: v * 0.3 });
      }
      return 4.5;
    } },
    swoop: { w: 0.15, f: function (d, t, p) {
      Z(d, t, { ft: 'bandpass', ff: 400 * p, fp: [[0.18, 2200 * p], [0.42, 500 * p]], fq: 2, a: 0.15, d: 0.3, vol: 0.45 });
      return 0.5;
    } },
    shard: { w: 0.4, jit: 0.05, f: function (d, t, p) {
      var r = [1, 2.76, 5.4, 8.93], dc = [0.6, 0.35, 0.2, 0.1], vv = [0.12, 0.08, 0.05, 0.03];
      for (var i = 0; i < 4; i++) T(d, t, { f: 1760 * p * r[i], a: 0.001, d: dc[i], vol: vv[i] });
      Z(d, t, { ft: 'highpass', ff: 8000, a: 0.001, d: 0.02, vol: 0.1 });
      return 0.7;
    } },
    splash: { w: 0.2, f: function (d, t, p) {
      Z(d, t, { ft: 'lowpass', ff: 2500 * p, ff2: 600, a: 0.005, d: 0.35, vol: 0.5 });
      Z(d, t, { ft: 'bandpass', ff: 1200 * p, fq: 1, a: 0.002, d: 0.15, vol: 0.3 });
      for (var i = 0; i < 4; i++) {
        var f = rnd(500, 1100) * p;
        T(d, t + rnd(0.02, 0.3), { f: f, f2: f * 1.8, a: 0.003, d: 0.06, vol: 0.06 });
      }
      return 0.5;
    } },
    spore: { w: 0.15, jit: 0.1, low: true, f: function (d, t, p) {
      Z(d, t, { ft: 'lowpass', ff: 900 * p, ff2: 300, a: 0.02, d: 0.18, vol: 0.25 });
      T(d, t, { f: 300 * p, f2: 200 * p, a: 0.01, d: 0.1, vol: 0.04 });
      return 0.25;
    } },
    ui_move: { w: 0, min: 0.03, f: function (d, t, p) {
      T(d, t, { type: 'triangle', f: 1400 * p, a: 0.001, d: 0.035, vol: 0.1 });
      return 0.06;
    } },
    ui_select: { w: 0.3, f: function (d, t, p) {
      T(d, t, { f: 880 * p, a: 0.003, d: 0.6, vol: 0.16 });
      T(d, t, { f: 1762 * p, a: 0.002, d: 0.3, vol: 0.06 });
      T(d, t, { f: 2637 * p, a: 0.001, d: 0.15, vol: 0.03 });
      return 0.7;
    } },
    death: { w: 0.55, min: 1, f: function (d, t, p) {
      Z(d, t, { ft: 'highpass', ff: 5000, a: 0.005, d: 0.25, vol: 0.08 });
      Z(d, t, { ft: 'lowpass', ff: 1800, ff2: 300, a: 0.03, d: 0.4, vol: 0.4 });
      T(d, t, { type: 'triangle', f: 440 * p, f2: 98 * p, sw: 1.8, a: 0.02, h: 0.3, d: 1.6, vol: 0.22,
        ft: 'lowpass', ff: 2200, ff2: 180, fs: 1.8 });
      T(d, t, { f: 220 * p, f2: 49 * p, sw: 1.8, a: 0.02, h: 0.3, d: 1.6, vol: 0.2 });
      T(d, t + 0.05, { f: 80, f2: 40, a: 0.003, d: 0.6, vol: 0.3 });
      return 2.5;
    } },
    step: { w: 0, jit: 0.25, min: 0.07, low: true, f: function (d, t, p) {
      Z(d, t, { ft: 'bandpass', ff: 900 * p, fq: 1.5, a: 0.002, d: 0.045, vol: 0.16 });
      return 0.06;
    } }
  };

  // ============================================================ scheduler

  function tick() {
    if (!ctx) return;
    var now = ctx.currentTime;
    var hidden = typeof document !== 'undefined' && document.hidden;
    var ahead = hidden ? 1.5 : 0.2;
    for (var i = tracks.length - 1; i >= 0; i--) {
      var tr = tracks[i];
      if ((tr.killAt && now >= tr.killAt) || (tr.endAt && now >= tr.endAt)) {
        tr.destroy();
        tracks.splice(i, 1);
        if (tr === current) current = null;
        continue;
      }
      if (tr.endAt) continue;   // one-shot: everything was scheduled up front
      try {
        if (tr.next < now - 0.25) {
          var k = Math.ceil((now - tr.next) / tr.stepDur);
          while (k-- > 0) tr.run(true);
        }
        var guard = 0;
        while (tr.next < now + ahead && guard++ < 256) tr.run(false);
      } catch (e) {
        if (!warned) { warned = true; if (global.console) console.warn('Sound: track error', e); }
        tr.next = now + ahead;
      }
    }
  }

  function startTrack(name) {
    var def = TRACKS[name];
    if (current) { current.kill(name === 'victory' ? 0.8 : 2.0); current = null; }
    currentName = name;
    if (def) current = new Track(name, def);
  }

  function sfxOut(vol, pan, wet) {
    var g = G(vol), last = g, nodes = [g];
    if (pan && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p); last = p; nodes.push(p);
    }
    last.connect(N.sfxDry);
    if (wet > 0) { var w = G(wet); last.connect(w); w.connect(N.sfxWet); nodes.push(w); }
    return { input: g, nodes: nodes };
  }

  function setMusicGain() {
    if (!ctx) return;
    var now = ctx.currentTime, v = musicVol * MUSIC_GAIN;
    N.mVolD.gain.setTargetAtTime(v, now, 0.05);
    N.mVolW.gain.setTargetAtTime(v, now, 0.05);
  }
  function setSfxGain() {
    if (!ctx) return;
    var now = ctx.currentTime, v = sfxVol * SFX_GAIN;
    N.sfxDry.gain.setTargetAtTime(v, now, 0.05);
    N.sfxWet.gain.setTargetAtTime(v, now, 0.05);
  }
  function applyMute() {
    if (!ctx) return;
    N.master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
  }

  // ================================================================= API

  var Sound = {
    init: function () {
      if (!AC) return;
      try {
        if (!ctx) {
          ctx = new AC();
          build();
          timer = setInterval(tick, 25);
          if (pendingMusic !== undefined) {
            var pm = pendingMusic; pendingMusic = undefined;
            if (pm) startTrack(pm);
          }
        }
        if (ctx.state === 'suspended' && ctx.resume) {
          var pr = ctx.resume();
          if (pr && pr.catch) pr.catch(noop);
        }
      } catch (e) {
        if (global.console) console.warn('Sound: WebAudio init failed', e);
        if (timer) clearInterval(timer);
        timer = null; ctx = null;
      }
    },

    music: function (name) {
      if (!AC) return;
      name = name || null;
      if (name && !TRACKS[name]) { if (global.console) console.warn('Sound: unknown track', name); return; }
      if (!ctx) { pendingMusic = name; return; }
      if (name === currentName) return;
      try { startTrack(name); } catch (e) { if (global.console) console.warn('Sound.music', e); }
    },

    sfx: function (name, opts) {
      if (!ctx || muted || ctx.state !== 'running') return;
      var def = SFX[name];
      if (!def) return;
      try {
        var now = ctx.currentTime, lt = lastT[name];
        if (lt != null && now - lt < (def.min || 0.02)) return;
        if (sV > MAX_S && (def.low || sV > MAX_S * 2)) return;
        lastT[name] = now;
        opts = opts || {};
        var vol = (opts.vol == null ? 1 : +opts.vol) * (def.v || 1);
        if (!(vol > 0)) return;
        var p = opts.pitch > 0 ? +opts.pitch : 1;
        if (def.jit) p *= 1 + (Math.random() - 0.5) * def.jit;
        var b = sfxOut(Math.min(vol, 2), +opts.pan || 0, def.w || 0);
        var dur = def.f(b.input, now + 0.005, p) || 1;
        disconnectLater(b.nodes, dur + 1);
      } catch (e) {
        if (global.console) console.warn('Sound.sfx', name, e);
      }
    },

    setVolumes: function (m, s) {
      if (m != null && !isNaN(m)) musicVol = clamp(+m, 0, 1);
      if (s != null && !isNaN(s)) sfxVol = clamp(+s, 0, 1);
      try { setMusicGain(); setSfxGain(); } catch (e) { /* ignore */ }
    },

    toggleMute: function () {
      muted = !muted;
      try { applyMute(); } catch (e) { /* ignore */ }
      return muted;
    },

    get muted() { return muted; },
    set muted(v) { muted = !!v; try { applyMute(); } catch (e) { /* ignore */ } },

    duck: function (amount, seconds) {
      if (!ctx) return;
      try {
        amount = clamp(amount == null ? 0.5 : +amount, 0, 1);
        seconds = seconds == null ? 1 : Math.max(0, +seconds);
        var now = ctx.currentTime, target = Math.max(0.0001, 1 - amount), gs = [N.duckD, N.duckW];
        for (var i = 0; i < 2; i++) {
          var p = gs[i].gain;
          p.cancelScheduledValues(now);
          p.setValueAtTime(p.value, now);
          p.linearRampToValueAtTime(target, now + 0.15);
          p.setValueAtTime(target, now + 0.15 + seconds);
          p.linearRampToValueAtTime(1, now + 0.15 + seconds + 0.8);
        }
      } catch (e) { /* ignore */ }
    },

    // Read-only info, handy for debugging / tests.
    get available() { return !!AC; },
    get currentMusic() { return ctx ? currentName : (pendingMusic || null); },
    _debug: function () {
      return { ctx: ctx, out: N.out, musicVoices: mV, sfxVoices: sV, tracks: tracks.length };
    }
  };

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : this);
