export class AudioSys {
  constructor(enabled) {
    this.enabled = !!enabled;
    this.ctx = null;
    this.master = null;
    this.engineNodes = null;
    this.alarmNodes = null;
    this.musicNodes = null;
    this.noiseBuf = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.85 : 0;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startMusic();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05);
  }

  startMusic() {
    if (!this.ctx || this.musicNodes) return;
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.value = 0.05;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    filt.Q.value = 0.8;
    const o1 = c.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const o2 = c.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 82.9;
    const o3 = c.createOscillator();
    o3.type = 'sine';
    o3.frequency.value = 110.3;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = c.createGain();
    lfoG.gain.value = 220;
    lfo.connect(lfoG).connect(filt.frequency);
    o1.connect(filt); o2.connect(filt); o3.connect(filt);
    filt.connect(gain).connect(this.master);
    o1.start(); o2.start(); o3.start(); lfo.start();
    this.musicNodes = { o1, o2, o3, lfo, gain };
    this.seq = { next: 0, step: 0, intensity: 0, boost: false, started: false };
  }

  updateMusic(intensity, boost) {
    if (!this.seq) return;
    this.seq.intensity = intensity;
    this.seq.boost = boost;
  }

  update() {
    if (!this.ctx || !this.seq || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (!this.seq.started) { this.seq.next = now + 0.1; this.seq.started = true; }
    while (this.seq.next < now + 0.15) {
      this.scheduleStep(this.seq.next, this.seq.step);
      this.seq.step = (this.seq.step + 1) % 32;
      this.seq.next += 0.24;
    }
  }

  scheduleStep(t, s) {
    const c = this.ctx;
    const bassPat = [55, 55, 41.2, 49];
    if (s % 4 === 0) {
      const o = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 260;
      o.type = 'square';
      o.frequency.value = bassPat[(s / 4) | 0];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09 + this.seq.intensity * 0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(f).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.45);
    }
    if (this.seq.intensity > 0.3 && s % 2 === 1) {
      const scale = [0, 3, 7, 10, 12, 15, 10, 7];
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = 220 * Math.pow(2, scale[(s / 2) % 8] / 12) * (this.seq.intensity > 0.65 ? 2 : 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.028 + this.seq.intensity * 0.03, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.2);
    }
    if (this.seq.boost && s % 2 === 0) {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = c.createGain();
      g.gain.setValueAtTime(0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.06);
    }
    if (this.seq.intensity > 0.75 && s % 16 === 0) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.55);
    }
  }

  engineOn() {
    if (!this.ctx || this.engineNodes) return;
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 300;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 48;
    const noise = c.createBufferSource();
    noise.buffer = this.noiseBuf;
    noise.loop = true;
    const nGain = c.createGain();
    nGain.gain.value = 0.35;
    const nFilt = c.createBiquadFilter();
    nFilt.type = 'bandpass';
    nFilt.frequency.value = 700;
    osc.connect(filt);
    noise.connect(nFilt).connect(nGain).connect(filt);
    filt.connect(gain).connect(this.master);
    osc.start(); noise.start();
    gain.gain.setTargetAtTime(0.16, c.currentTime, 0.4);
    this.engineNodes = { osc, filt, nFilt, gain };
  }

  engineOff() {
    if (!this.engineNodes) return;
    const { osc, gain } = this.engineNodes;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0.0001, t, 0.25);
    setTimeout(() => { try { osc.stop(); } catch (e) {} }, 900);
    this.engineNodes = null;
  }

  setThrottle(v01, boost) {
    if (!this.engineNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const { osc, filt, nFilt } = this.engineNodes;
    osc.frequency.setTargetAtTime(44 + v01 * 70 + (boost ? 26 : 0), t, 0.12);
    filt.frequency.setTargetAtTime(260 + v01 * 720 + (boost ? 500 : 0), t, 0.12);
    nFilt.frequency.setTargetAtTime(600 + v01 * 1600 + (boost ? 1200 : 0), t, 0.12);
  }

  alarm(on) {
    if (!this.ctx) return;
    if (on && !this.alarmNodes) {
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 196;
      const gain = c.createGain();
      gain.gain.value = 0;
      const lfo = c.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 3.2;
      const lfoG = c.createGain();
      lfoG.gain.value = 0.045;
      lfo.connect(lfoG).connect(gain.gain);
      const base = c.createConstantSource();
      base.offset.value = 0.05;
      base.connect(gain.gain);
      osc.connect(gain).connect(this.master);
      osc.start(); lfo.start(); base.start();
      this.alarmNodes = { osc, lfo, base, gain };
    } else if (!on && this.alarmNodes) {
      const { osc, lfo, base, gain } = this.alarmNodes;
      const t = this.ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.08);
      setTimeout(() => { try { osc.stop(); lfo.stop(); base.stop(); } catch (e) {} }, 400);
      this.alarmNodes = null;
    }
  }

  blip(freq, dur = 0.09, type = 'sine', vol = 0.22) {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  click() { this.blip(760, 0.06, 'triangle', 0.14); }

  pickup(combo) {
    const f = 520 * Math.pow(1.04, Math.min(combo, 28));
    this.blip(f, 0.1, 'sine', 0.2);
    setTimeout(() => this.blip(f * 1.5, 0.12, 'sine', 0.14), 45);
  }

  gate() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.18), i * 70));
  }

  whoosh() {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 1.4;
    filt.frequency.setValueAtTime(320, c.currentTime);
    filt.frequency.exponentialRampToValueAtTime(1500, c.currentTime + 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    src.connect(filt).connect(g).connect(this.master);
    src.start();
    src.stop(c.currentTime + 0.55);
  }

  explosion(big = false) {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(big ? 1100 : 800, c.currentTime);
    filt.frequency.exponentialRampToValueAtTime(50, c.currentTime + (big ? 1.3 : 0.7));
    const g = c.createGain();
    g.gain.setValueAtTime(big ? 0.75 : 0.42, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (big ? 1.5 : 0.85));
    src.connect(filt).connect(g).connect(this.master);
    src.start();
    src.stop(c.currentTime + 1.6);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(big ? 130 : 90, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.8);
    const og = c.createGain();
    og.gain.setValueAtTime(0.5, c.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.9);
    o.connect(og).connect(this.master);
    o.start();
    o.stop(c.currentTime + 1);
  }

  countBeep(last = false) {
    this.blip(last ? 880 : 440, last ? 0.4 : 0.12, 'square', 0.16);
  }

  laser() {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(920, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(190, c.currentTime + 0.09);
    g.gain.setValueAtTime(0.09, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(c.currentTime + 0.12);
  }

  overheat() {
    if (!this.ctx) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 2400;
    filt.Q.value = 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.22, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    src.connect(filt).connect(g).connect(this.master);
    src.start();
    src.stop(c.currentTime + 0.55);
  }

  powerup() {
    [440, 660, 880].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'sine', 0.18), i * 60));
  }

  objective() {
    this.blip(660, 0.16, 'triangle', 0.18);
    setTimeout(() => this.blip(990, 0.28, 'triangle', 0.18), 130);
  }

  sectorSfx() {
    [330, 415, 495].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sine', 0.14), i * 110));
  }
}
