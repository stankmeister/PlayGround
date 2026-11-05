/* Tiny procedural WebAudio engine — no external assets. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.42;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
  }

  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.started = true;
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.03);
    }
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  tone({ freq = 440, endFreq = null, dur = 0.12, type = 'sine', gain = 0.2, delay = 0, attack = 0.005, dest = null }) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, gain = 0.18, filter = 900, q = 1, delay = 0, type = 'lowpass' }) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = type;
    biquad.frequency.setValueAtTime(filter, t);
    biquad.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    source.connect(biquad);
    biquad.connect(g);
    g.connect(this.sfxGain);
    source.start(t);
  }

  click() {
    this.tone({ freq: 620, endFreq: 880, dur: 0.06, type: 'triangle', gain: 0.1 });
  }

  coin() {
    this.tone({ freq: 1180, endFreq: 1680, dur: 0.09, type: 'sine', gain: 0.13 });
    this.tone({ freq: 1760, endFreq: 2200, dur: 0.07, type: 'triangle', gain: 0.055, delay: 0.035 });
  }

  recruit() {
    this.tone({ freq: 380, endFreq: 590, dur: 0.1, type: 'triangle', gain: 0.12 });
    this.tone({ freq: 590, endFreq: 880, dur: 0.12, type: 'sine', gain: 0.1, delay: 0.07 });
  }

  gate(positive = true, big = false) {
    if (positive) {
      const base = big ? 392 : 330;
      [0, 4, 7, 12].forEach((semi, i) => {
        this.tone({ freq: base * Math.pow(2, semi / 12), dur: 0.13, type: 'triangle', gain: 0.1 - i * 0.012, delay: i * 0.045 });
      });
      this.noise({ dur: 0.24, gain: 0.05, filter: 3200, type: 'highpass', delay: 0.02 });
    } else {
      [0, -3, -7].forEach((semi, i) => {
        this.tone({ freq: 330 * Math.pow(2, semi / 12), dur: 0.15, type: 'sawtooth', gain: 0.065, delay: i * 0.06 });
      });
    }
  }

  hit() {
    this.noise({ dur: 0.26, gain: 0.26, filter: 520 });
    this.tone({ freq: 160, endFreq: 48, dur: 0.25, type: 'sine', gain: 0.22 });
  }

  slice() {
    this.noise({ dur: 0.12, gain: 0.14, filter: 2600, type: 'highpass' });
    this.tone({ freq: 900, endFreq: 260, dur: 0.12, type: 'sawtooth', gain: 0.06 });
  }

  shield() {
    this.tone({ freq: 520, endFreq: 1040, dur: 0.3, type: 'sine', gain: 0.14 });
    this.tone({ freq: 780, endFreq: 1560, dur: 0.35, type: 'triangle', gain: 0.08, delay: 0.05 });
  }

  powerup() {
    [0, 5, 9, 12, 16].forEach((s, i) => {
      this.tone({ freq: 440 * Math.pow(2, s / 12), dur: 0.16, type: 'triangle', gain: 0.09, delay: i * 0.055 });
    });
  }

  clash() {
    this.noise({ dur: 0.2, gain: 0.18, filter: 1400, q: 2 });
    this.tone({ freq: 220, endFreq: 90, dur: 0.18, type: 'square', gain: 0.06 });
  }

  win() {
    [0, 4, 7, 12].forEach((s, i) => {
      this.tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.18, type: 'triangle', gain: 0.1, delay: i * 0.08 });
    });
  }

  bossWarn() {
    this.tone({ freq: 92, endFreq: 62, dur: 0.9, type: 'sawtooth', gain: 0.13, attack: 0.04 });
    this.tone({ freq: 138, endFreq: 92, dur: 0.75, type: 'square', gain: 0.05, delay: 0.28 });
    this.noise({ dur: 0.7, gain: 0.08, filter: 420, q: 1.4, delay: 0.1 });
  }

  bossSlam() {
    this.noise({ dur: 0.32, gain: 0.3, filter: 380, q: 1.2 });
    this.tone({ freq: 86, endFreq: 34, dur: 0.4, type: 'sine', gain: 0.26 });
    this.tone({ freq: 190, endFreq: 60, dur: 0.18, type: 'square', gain: 0.06 });
  }

  bossDown() {
    [0, 5, 7, 12, 16, 24].forEach((s, i) => {
      this.tone({ freq: 262 * Math.pow(2, s / 12), dur: 0.26, type: 'triangle', gain: 0.1, delay: i * 0.075 });
    });
    this.noise({ dur: 1.1, gain: 0.16, filter: 2400, type: 'highpass', delay: 0.1 });
    this.tone({ freq: 70, endFreq: 28, dur: 1.2, type: 'sine', gain: 0.18 });
  }

  fail() {
    [0, -2, -5, -12].forEach((s, i) => {
      this.tone({ freq: 330 * Math.pow(2, s / 12), dur: 0.35, type: 'sawtooth', gain: 0.075, delay: i * 0.15 });
    });
    this.noise({ dur: 0.7, gain: 0.16, filter: 300 });
  }

  perk() {
    [0, 7, 12].forEach((s, i) => {
      this.tone({ freq: 660 * Math.pow(2, s / 12), dur: 0.22, type: 'sine', gain: 0.11, delay: i * 0.09 });
    });
  }

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => this.tickMusic(), 300);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  tickMusic() {
    if (!this.ctx || this.muted) return;
    const step = this.musicStep++;
    // Slow minor-key synthwave arpeggio.
    const roots = [110, 110, 130.81, 98];
    const root = roots[Math.floor(step / 8) % roots.length];
    const pattern = [0, 7, 12, 15, 19, 15, 12, 7];
    const semi = pattern[step % 8];
    const freq = root * Math.pow(2, semi / 12);
    this.tone({ freq, dur: 0.34, type: 'triangle', gain: 0.052, dest: this.musicGain, attack: 0.02 });
    if (step % 8 === 0) {
      this.tone({ freq: root / 2, dur: 1.8, type: 'sine', gain: 0.07, dest: this.musicGain, attack: 0.12 });
      this.tone({ freq: root * 1.5, dur: 1.4, type: 'sine', gain: 0.025, dest: this.musicGain, attack: 0.2 });
    }
    if (step % 4 === 2) {
      this.noise({ dur: 0.04, gain: 0.022, filter: 7000, type: 'highpass' });
    }
  }
}
