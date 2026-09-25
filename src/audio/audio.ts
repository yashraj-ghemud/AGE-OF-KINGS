// Fully procedural audio: a cinematic score kit + game SFX synthesized with Web Audio.
// No audio files are loaded — everything is generated at runtime.

type Osc = OscillatorType;
type FilterSpec = { type: BiquadFilterType; freq: number; to?: number; q?: number; time?: number };

interface ToneOpts {
  type?: Osc;
  freq: number;
  to?: number;
  glide?: number;
  when?: number;
  dur: number;
  gain: number;
  attack?: number;
  bus?: 'music' | 'sfx';
  reverb?: number;
  pan?: number;
  detune?: number;
  filter?: FilterSpec;
  vibrato?: { rate: number; depth: number };
}

interface NoiseOpts {
  when?: number;
  dur: number;
  gain: number;
  attack?: number;
  color?: 'white' | 'pink' | 'brown';
  filter?: FilterSpec;
  bus?: 'music' | 'sfx';
  reverb?: number;
  pan?: number;
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** Raga Bhairav on D: 1 ♭2 3 4 5 ♭6 7 */
const BHAIRAV = [0, 1, 4, 5, 7, 8, 11];
const scaleNote = (root: number, degree: number) => {
  const oct = Math.floor(degree / 7);
  const d = ((degree % 7) + 7) % 7;
  return root + oct * 12 + BHAIRAV[d];
};

export type Sfx =
  | 'clash' | 'swing' | 'bow' | 'arrow' | 'spear' | 'impact' | 'death' | 'hoof' | 'step'
  | 'slam' | 'charge' | 'warcry' | 'horn' | 'roar' | 'fire' | 'shard' | 'lordSlain'
  | 'thunder' | 'shatter' | 'whoosh' | 'uiHover' | 'uiClick' | 'uiConfirm' | 'emberBurst'
  | 'scaryWind' | 'kneel' | 'ash' | 'jump' | 'land' | 'hurt' | 'recruit' | 'cage';

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverbIn!: GainNode;
  /** Reverb send owned by the current music bus generation (so skipping silences tails too). */
  private musicSend!: GainNode;
  private buffers: Record<'white' | 'pink' | 'brown', AudioBuffer> = {} as never;
  private distortion!: WaveShaperNode;
  private musicTimer: number | null = null;
  private musicNodes: AudioScheduledSourceNode[] = [];
  private musicGains: GainNode[] = [];
  private musicMode: 'none' | 'menu' | 'battle' | 'ending' = 'none';
  private nextStep = 0;
  private stepIndex = 0;
  private voiceLog = new Map<string, number>();
  private volumes = { master: 0.85, music: 0.7 };
  battleIntensity = 0;
  listener = { x: 0, y: 0, z: 0, yaw: 0 };

  get ready() {
    return !!this.ctx;
  }
  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.volumes.music;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.makeImpulse(3.6);
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = 0.9;
    this.reverbIn.connect(reverb).connect(this.master);

    this.musicSend = ctx.createGain();
    this.musicSend.connect(this.reverbIn);

    this.buffers.white = this.makeNoise('white');
    this.buffers.pink = this.makeNoise('pink');
    this.buffers.brown = this.makeNoise('brown');

    this.distortion = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.6);
    }
    this.distortion.curve = curve;
    if (ctx.state === 'suspended') void ctx.resume();
  }

  setVolumes(master: number, music: number) {
    this.volumes = { master, music };
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(master, this.ctx.currentTime, 0.1);
    this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.1);
  }

  /** Silence everything already scheduled on the music bus (used when skipping cinematics). */
  resetMusicBus() {
    if (!this.ctx) return;
    this.stopLoop(0.05);
    this.musicMode = 'none';
    const old = this.musicBus;
    const oldSend = this.musicSend;
    old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    oldSend.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    setTimeout(() => {
      old.disconnect();
      oldSend.disconnect();
    }, 300);
    this.musicSend = this.ctx.createGain();
    this.musicSend.connect(this.reverbIn);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.volumes.music;
    this.musicBus.connect(this.master);
  }

  /** Temporarily duck music (e.g. on big impacts / silence beats). */
  duck(amount: number, dur: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.volumes.music * (1 - amount), t + 0.05);
    g.linearRampToValueAtTime(this.volumes.music, t + dur);
  }

  // ───────────────────────────── buffers ─────────────────────────────

  private makeNoise(color: 'white' | 'pink' | 'brown') {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w;
      else if (color === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  private makeImpulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.55 - t * 0.4); // darken the tail
        d[i] = lp * Math.pow(1 - t, 2.4) * (i < 40 ? i / 40 : 1);
      }
    }
    return buf;
  }

  // ───────────────────────────── primitives ─────────────────────────────

  private out(node: AudioNode, o: { bus?: 'music' | 'sfx'; reverb?: number; pan?: number }) {
    const ctx = this.ctx!;
    let tail: AudioNode = node;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      tail.connect(p);
      tail = p;
    }
    tail.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
    if (o.reverb) {
      const s = ctx.createGain();
      s.gain.value = o.reverb;
      tail.connect(s).connect(o.bus === 'music' ? this.musicSend : this.reverbIn);
    }
  }

  private filter(spec: FilterSpec, when: number, dur: number) {
    const f = this.ctx!.createBiquadFilter();
    f.type = spec.type;
    f.Q.value = spec.q ?? 0.8;
    f.frequency.setValueAtTime(spec.freq, when);
    if (spec.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), when + (spec.time ?? dur));
    return f;
  }

  tone(o: ToneOpts) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const when = o.when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, when);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), when + (o.glide ?? o.dur));
    if (o.detune) osc.detune.value = o.detune;
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibrato.rate;
      lg.gain.value = o.vibrato.depth;
      lfo.connect(lg).connect(osc.detune);
      lfo.start(when);
      lfo.stop(when + o.dur + 0.1);
    }
    const g = ctx.createGain();
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(o.gain, when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);
    let head: AudioNode = osc;
    if (o.filter) {
      const f = this.filter(o.filter, when, o.dur);
      head.connect(f);
      head = f;
    }
    head.connect(g);
    this.out(g, o);
    osc.start(when);
    osc.stop(when + o.dur + 0.05);
    return osc;
  }

  noise(o: NoiseOpts) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const when = o.when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers[o.color ?? 'white'];
    src.loop = true;
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(o.gain, when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);
    let head: AudioNode = src;
    if (o.filter) {
      const f = this.filter(o.filter, when, o.dur);
      head.connect(f);
      head = f;
    }
    head.connect(g);
    this.out(g, o);
    src.start(when, Math.random() * 2);
    src.stop(when + o.dur + 0.05);
  }

  // ───────────────────────────── score kit ─────────────────────────────

  heartbeat(when = this.now, gain = 0.9) {
    this.tone({ freq: 62, to: 34, dur: 0.22, gain, when, bus: 'music', reverb: 0.25 });
    this.tone({ freq: 55, to: 30, dur: 0.26, gain: gain * 0.7, when: when + 0.27, bus: 'music', reverb: 0.25 });
    this.noise({ dur: 0.06, gain: gain * 0.15, when, color: 'brown', filter: { type: 'lowpass', freq: 300 }, bus: 'music' });
  }

  taiko(when = this.now, gain = 1, pitch = 1, bus: 'music' | 'sfx' = 'music') {
    this.tone({ freq: 95 * pitch, to: 44 * pitch, glide: 0.35, dur: 1.1, gain, when, bus, reverb: 0.45 });
    this.tone({ freq: 190 * pitch, to: 90 * pitch, glide: 0.1, dur: 0.25, gain: gain * 0.3, when, bus });
    this.noise({ dur: 0.12, gain: gain * 0.35, when, color: 'pink', filter: { type: 'bandpass', freq: 260 * pitch, q: 1.2 }, bus, reverb: 0.3 });
  }

  braam(when = this.now, dur = 4.5, gain = 0.55, root = 38) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(gain, when + 0.06);
    out.gain.exponentialRampToValueAtTime(gain * 0.5, when + dur * 0.4);
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(90, when);
    f.frequency.exponentialRampToValueAtTime(2200, when + 0.35);
    f.frequency.exponentialRampToValueAtTime(380, when + dur);
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.distortion.curve;
    f.connect(shaper).connect(out);
    this.out(out, { bus: 'music', reverb: 0.8 });
    const partials: [number, number][] = [[0, -9], [0, 9], [12, -5], [12, 6], [19, 0], [-12, 0]];
    for (const [semi, cents] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(root + semi);
      o.detune.value = cents;
      o.connect(f);
      o.start(when);
      o.stop(when + dur + 0.1);
    }
    this.tone({ freq: midi(root - 12), dur, gain: gain * 0.8, when, bus: 'music', attack: 0.04 });
  }

  /** Choir-ish pad: detuned saws through vowel formants. */
  choir(notes: number[], when = this.now, dur = 6, gain = 0.12, attack = 1.6) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(gain, when + attack);
    out.gain.setValueAtTime(gain, when + Math.max(attack, dur - 1.8));
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    this.out(out, { bus: 'music', reverb: 0.9 });
    const formants = [
      [730, 1],
      [1090, 0.6],
      [2440, 0.25],
    ];
    const mix = ctx.createGain();
    mix.gain.value = 1;
    for (const [fr, amp] of formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fr;
      bp.Q.value = 6;
      const g = ctx.createGain();
      g.gain.value = amp * 2.4;
      mix.connect(bp).connect(g).connect(out);
    }
    for (const n of notes) {
      for (const cents of [-10, 0, 10]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = cents;
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 4.6 + Math.random();
        lg.gain.value = 7;
        lfo.connect(lg).connect(o.detune);
        o.connect(mix);
        o.start(when);
        lfo.start(when);
        o.stop(when + dur + 0.1);
        lfo.stop(when + dur + 0.1);
      }
    }
  }

  /** Warm low string pad. */
  pad(notes: number[], when = this.now, dur = 8, gain = 0.07, attack = 2) {
    for (const n of notes) {
      for (const cents of [-6, 6]) {
        this.tone({
          type: 'sawtooth', freq: midi(n), detune: cents, when, dur, gain, attack, bus: 'music', reverb: 0.6,
          filter: { type: 'lowpass', freq: 700, q: 0.5 },
        });
      }
    }
  }

  shimmer(when = this.now, gain = 0.06) {
    for (let i = 0; i < 6; i++) {
      const n = scaleNote(74, Math.floor(Math.random() * 10));
      this.tone({ freq: midi(n), dur: 2.6, gain, attack: 0.01, when: when + i * 0.09, bus: 'music', reverb: 0.9 });
    }
  }

  /** Hammered-string pluck (santoor-ish). */
  pluck(note: number, when = this.now, gain = 0.1, bus: 'music' | 'sfx' = 'music') {
    const f = midi(note);
    this.tone({ type: 'triangle', freq: f, dur: 1.4, gain, when, bus, reverb: 0.55 });
    this.tone({ freq: f * 2.01, dur: 0.6, gain: gain * 0.5, when, bus, reverb: 0.4 });
    this.tone({ freq: f * 3.03, dur: 0.25, gain: gain * 0.25, when, bus });
    this.noise({ dur: 0.02, gain: gain * 0.3, when, filter: { type: 'highpass', freq: 3000 }, bus });
  }

  thunder(when = this.now, gain = 0.9) {
    this.noise({ dur: 0.25, gain: gain * 0.7, when, filter: { type: 'highpass', freq: 1200 }, reverb: 0.5 });
    this.noise({ dur: 4.5, gain, attack: 0.05, when: when + 0.05, color: 'brown', filter: { type: 'lowpass', freq: 900, to: 120, time: 4 }, reverb: 0.7 });
    for (let i = 0; i < 5; i++) {
      this.noise({ dur: 0.8, gain: gain * 0.4, when: when + 0.3 + Math.random() * 2, color: 'brown', filter: { type: 'lowpass', freq: 300 }, reverb: 0.6 });
    }
  }

  whoosh(when = this.now, dur = 1.2, gain = 0.3) {
    this.noise({ dur, gain, attack: dur * 0.6, when, color: 'pink', filter: { type: 'bandpass', freq: 300, to: 2600, q: 1.5, time: dur * 0.7 }, reverb: 0.4 });
  }

  shatter(when = this.now, gain = 0.6) {
    for (let i = 0; i < 18; i++) {
      const t = when + Math.random() * 0.45;
      this.noise({ dur: 0.08 + Math.random() * 0.1, gain: gain * 0.4, when: t, filter: { type: 'bandpass', freq: 3000 + Math.random() * 6000, q: 4 }, reverb: 0.6 });
    }
    for (let i = 0; i < 8; i++) {
      this.tone({ freq: 1800 + Math.random() * 4200, dur: 0.8 + Math.random() * 1.2, gain: gain * 0.08, when: when + Math.random() * 0.3, reverb: 0.8 });
    }
  }

  // ───────────────────────────── music loops ─────────────────────────────

  private stopLoop(fade = 1.5) {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const g of this.musicGains) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + fade);
    }
    for (const n of this.musicNodes) {
      try {
        n.stop(t + fade + 0.1);
      } catch {
        /* already stopped */
      }
    }
    this.musicNodes = [];
    this.musicGains = [];
  }

  stopMusic(fade = 1.5) {
    this.stopLoop(fade);
    this.musicMode = 'none';
  }

  private drone(root: number, gain: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.07;
    lg.gain.value = 160;
    lfo.connect(lg).connect(f.frequency);
    f.connect(g);
    this.out(g, { bus: 'music', reverb: 0.5 });
    const srcs: AudioScheduledSourceNode[] = [lfo];
    for (const [semi, type, det] of [[0, 'sine', 0], [0, 'sawtooth', -5], [7, 'sawtooth', 5], [-12, 'sine', 0]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(root + semi);
      o.detune.value = det;
      o.connect(f);
      srcs.push(o);
    }
    srcs.forEach((s) => s.start());
    this.musicNodes.push(...srcs);
    this.musicGains.push(g);
  }

  startMenuMusic() {
    if (!this.ctx || this.musicMode === 'menu') return;
    this.stopLoop(1.2);
    this.musicMode = 'menu';
    this.drone(38, 0.07);
    const chords = [
      [50, 54, 57, 62],
      [55, 58, 62, 67],
      [51, 55, 58, 63],
      [50, 54, 57, 61],
    ];
    const bar = 60 / 64 * 4;
    this.nextStep = this.ctx.currentTime + 0.2;
    this.stepIndex = 0;
    this.musicTimer = window.setInterval(() => {
      const ctx = this.ctx!;
      while (this.nextStep < ctx.currentTime + 0.25) {
        const s = this.stepIndex;
        const t = this.nextStep;
        const step8 = s % 32; // 8 eighth-notes per bar, 4 bars
        if (s % 16 === 0) this.pad(chords[Math.floor(s / 16) % 4], t, bar * 2 + 1.5, 0.028, 2.5);
        if (s % 64 === 0) this.choir(chords[Math.floor(s / 16) % 4].map((n) => n + 12), t, bar * 4, 0.035, 3);
        if (step8 === 0 || step8 === 16) this.taiko(t, 0.28, 0.9);
        if (step8 === 22) this.taiko(t, 0.14, 1.2);
        if (Math.random() < 0.26 && s % 2 === 0) this.pluck(scaleNote(62, Math.floor(Math.random() * 9)), t, 0.05);
        this.stepIndex++;
        this.nextStep += bar / 8;
      }
    }, 50);
  }

  startBattleMusic() {
    if (!this.ctx || this.musicMode === 'battle') return;
    this.stopLoop(1.5);
    this.musicMode = 'battle';
    this.drone(38, 0.05);
    const beat = 60 / 96;
    this.nextStep = this.ctx.currentTime + 0.3;
    this.stepIndex = 0;
    this.musicTimer = window.setInterval(() => {
      const ctx = this.ctx!;
      while (this.nextStep < ctx.currentTime + 0.25) {
        const s = this.stepIndex;
        const t = this.nextStep;
        const k = this.battleIntensity;
        const inBar = s % 8; // eighth notes
        if (s % 64 === 0) this.pad([50, 53, 57], t, beat * 32, 0.02 + k * 0.02, 3);
        if (inBar === 0) this.taiko(t, 0.18 + k * 0.4, 0.85);
        if (inBar === 4 && k > 0.15) this.taiko(t, 0.12 + k * 0.3, 0.9);
        if (inBar === 3 && k > 0.35) this.taiko(t, 0.1 + k * 0.2, 1.15);
        if (k > 0.55 && (inBar === 6 || inBar === 7)) this.taiko(t, 0.08 + k * 0.12, 1.5);
        if (k > 0.7 && s % 64 === 0) this.braam(t, 3.5, 0.18);
        if (k < 0.4 && Math.random() < 0.12 && s % 2 === 0) this.pluck(scaleNote(62, Math.floor(Math.random() * 8)), t, 0.04);
        this.stepIndex++;
        this.nextStep += beat / 2;
      }
    }, 50);
  }

  startEndingMusic() {
    if (!this.ctx) return;
    this.stopLoop(1);
    this.musicMode = 'ending';
    const t = this.ctx.currentTime + 0.1;
    // D major hymn, slow swell
    const prog = [[50, 54, 57, 62], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61], [50, 54, 57, 62]];
    prog.forEach((c, i) => {
      this.choir(c.map((n) => n + 12), t + i * 6, 7.5, 0.05, 2.5);
      this.pad(c, t + i * 6, 7.5, 0.03, 2);
    });
  }

  // ───────────────────────────── sfx ─────────────────────────────

  setListener(x: number, y: number, z: number, yaw: number) {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  /** Positional one-shot: attenuated by distance, panned by bearing. */
  playAt(name: Sfx, x: number, y: number, z: number, vol = 1) {
    if (!this.ctx) return;
    const dx = x - this.listener.x;
    const dz = z - this.listener.z;
    const dy = y - this.listener.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (d > 140) return;
    const att = vol / Math.pow(1 + d / 14, 1.3);
    if (att < 0.02) return;
    // listener yaw: forward = (sin yaw, cos yaw); screen-right = (-cos yaw, sin yaw)
    const rx = -Math.cos(this.listener.yaw);
    const rz = Math.sin(this.listener.yaw);
    const pan = d > 0.5 ? (dx * rx + dz * rz) / d : 0;
    this.play(name, att, pan * 0.85);
  }

  play(name: Sfx, vol = 1, pan = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const minGap: Partial<Record<Sfx, number>> = { clash: 0.035, impact: 0.03, death: 0.06, arrow: 0.03, bow: 0.04, step: 0.05, hoof: 0.04, kneel: 0.05, ash: 0.05, swing: 0.03, hurt: 0.12 };
    const gap = minGap[name] ?? 0.012;
    const last = this.voiceLog.get(name) ?? -1;
    if (now - last < gap) return;
    this.voiceLog.set(name, now);
    const o = { pan };
    const r = Math.random;

    switch (name) {
      case 'clash': {
        const base = 900 + r() * 700;
        for (const [m, dec, g] of [[1, 0.5, 0.12], [2.76, 0.35, 0.07], [5.4, 0.25, 0.05], [8.93, 0.15, 0.03]]) {
          this.tone({ freq: base * m, dur: dec, gain: g * vol, ...o, reverb: 0.3 });
        }
        this.noise({ dur: 0.05, gain: 0.25 * vol, filter: { type: 'highpass', freq: 2500 }, ...o });
        break;
      }
      case 'swing':
        this.noise({ dur: 0.22, gain: 0.18 * vol, attack: 0.08, color: 'pink', filter: { type: 'bandpass', freq: 600, to: 2400, q: 1.4 }, ...o });
        break;
      case 'bow':
        this.tone({ type: 'triangle', freq: 240, to: 120, dur: 0.18, gain: 0.2 * vol, ...o });
        this.noise({ dur: 0.05, gain: 0.1 * vol, filter: { type: 'highpass', freq: 1800 }, ...o });
        break;
      case 'arrow':
        this.noise({ dur: 0.2, gain: 0.08 * vol, attack: 0.02, filter: { type: 'bandpass', freq: 3000, to: 900, q: 3 }, ...o });
        break;
      case 'spear':
        this.noise({ dur: 0.3, gain: 0.2 * vol, attack: 0.05, color: 'pink', filter: { type: 'bandpass', freq: 400, to: 1600, q: 1.2 }, ...o });
        break;
      case 'impact':
        this.tone({ freq: 140, to: 55, dur: 0.14, gain: 0.3 * vol, ...o });
        this.noise({ dur: 0.08, gain: 0.25 * vol, color: 'brown', filter: { type: 'lowpass', freq: 700 }, ...o });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', freq: 240, to: 150, dur: 0.22, gain: 0.08 * vol, filter: { type: 'bandpass', freq: 700, q: 3 }, ...o });
        break;
      case 'death':
        this.tone({ type: 'sawtooth', freq: 170 + r() * 60, to: 80, dur: 0.45, gain: 0.07 * vol, filter: { type: 'bandpass', freq: 520, q: 4 }, ...o, reverb: 0.2 });
        this.noise({ dur: 0.2, gain: 0.12 * vol, color: 'brown', filter: { type: 'lowpass', freq: 500 }, ...o });
        break;
      case 'hoof':
        this.tone({ freq: 150, to: 60, dur: 0.07, gain: 0.16 * vol, ...o });
        this.noise({ dur: 0.04, gain: 0.08 * vol, color: 'brown', filter: { type: 'lowpass', freq: 1200 }, ...o });
        break;
      case 'step':
        this.noise({ dur: 0.05, gain: 0.05 * vol, color: 'brown', filter: { type: 'lowpass', freq: 600 }, ...o });
        break;
      case 'jump':
        this.whoosh(undefined, 0.4, 0.12 * vol);
        break;
      case 'land':
        this.tone({ freq: 90, to: 40, dur: 0.3, gain: 0.35 * vol, ...o });
        this.noise({ dur: 0.25, gain: 0.2 * vol, color: 'brown', filter: { type: 'lowpass', freq: 500 }, ...o });
        break;
      case 'slam':
        this.taiko(undefined, 0.9 * vol, 0.6, 'sfx');
        this.noise({ dur: 1.2, gain: 0.5 * vol, color: 'brown', filter: { type: 'lowpass', freq: 1400, to: 90 }, ...o, reverb: 0.5 });
        this.shatter(undefined, 0.15 * vol);
        break;
      case 'charge':
        this.whoosh(undefined, 0.6, 0.35 * vol);
        this.tone({ type: 'sawtooth', freq: 70, to: 140, dur: 0.6, gain: 0.12 * vol, filter: { type: 'lowpass', freq: 600 } });
        break;
      case 'warcry': {
        for (let i = 0; i < 7; i++) {
          this.tone({
            type: 'sawtooth', freq: 130 + r() * 90, to: 110 + r() * 60, dur: 0.9, gain: 0.04 * vol, attack: 0.08, when: this.now + r() * 0.12,
            filter: { type: 'bandpass', freq: 750, q: 2.5 }, reverb: 0.5, vibrato: { rate: 6, depth: 25 },
          });
        }
        this.taiko(undefined, 0.5 * vol, 1, 'sfx');
        break;
      }
      case 'horn': {
        const t = this.now;
        for (const [semi, g] of [[0, 0.1], [7, 0.06], [-12, 0.05]]) {
          this.tone({
            type: 'sawtooth', freq: midi(45 + semi) * 0.94, to: midi(45 + semi), glide: 0.25, dur: 2.6, gain: g * vol, attack: 0.18, when: t,
            filter: { type: 'lowpass', freq: 380, to: 1300, q: 1.5, time: 0.4 }, reverb: 0.8, vibrato: { rate: 5, depth: 9 },
          });
        }
        break;
      }
      case 'roar': {
        const t = this.now;
        this.tone({ type: 'sawtooth', freq: 120, to: 48, dur: 2.4, gain: 0.3 * vol, attack: 0.15, when: t, filter: { type: 'lowpass', freq: 1400, to: 300 }, vibrato: { rate: 28, depth: 90 }, reverb: 0.6 });
        this.tone({ type: 'square', freq: 80, to: 40, dur: 2.2, gain: 0.12 * vol, attack: 0.2, when: t, filter: { type: 'lowpass', freq: 500 }, vibrato: { rate: 33, depth: 120 } });
        this.noise({ dur: 2.2, gain: 0.35 * vol, attack: 0.2, when: t, color: 'pink', filter: { type: 'bandpass', freq: 500, to: 180, q: 1.5 }, reverb: 0.5 });
        break;
      }
      case 'fire':
        this.noise({ dur: 0.7, gain: 0.3 * vol, attack: 0.05, color: 'brown', filter: { type: 'lowpass', freq: 1800, to: 300 }, ...o, reverb: 0.2 });
        this.noise({ dur: 0.5, gain: 0.08 * vol, filter: { type: 'bandpass', freq: 4000, q: 0.8 }, ...o });
        break;
      case 'shard': {
        const t = this.now;
        this.shimmer(t, 0.07 * vol);
        this.tone({ freq: 400, to: 1600, dur: 0.9, gain: 0.08 * vol, attack: 0.3, when: t, reverb: 0.8 });
        this.choir([62, 66, 69, 74], t, 2.8, 0.05 * vol, 0.4);
        break;
      }
      case 'lordSlain':
        this.braam(undefined, 3.5, 0.4 * vol);
        this.taiko(undefined, 1 * vol, 0.7);
        break;
      case 'thunder':
        this.thunder(undefined, 0.8 * vol);
        break;
      case 'shatter':
        this.shatter(undefined, 0.7 * vol);
        break;
      case 'whoosh':
        this.whoosh(undefined, 1, 0.3 * vol);
        break;
      case 'uiHover':
        this.tone({ freq: 1900, dur: 0.05, gain: 0.025 * vol, bus: 'sfx' });
        break;
      case 'uiClick':
        this.tone({ freq: 880, to: 660, dur: 0.12, gain: 0.06 * vol, reverb: 0.3 });
        this.noise({ dur: 0.03, gain: 0.05 * vol, filter: { type: 'highpass', freq: 2500 } });
        break;
      case 'uiConfirm': {
        const t = this.now;
        this.pluck(62, t, 0.09, 'sfx');
        this.pluck(69, t + 0.07, 0.08, 'sfx');
        this.pluck(74, t + 0.14, 0.07, 'sfx');
        break;
      }
      case 'emberBurst': {
        const t = this.now;
        this.whoosh(t, 0.9, 0.35);
        this.shimmer(t + 0.2, 0.08);
        this.tone({ freq: 60, to: 30, dur: 1.6, gain: 0.5, when: t + 0.15, reverb: 0.6 });
        break;
      }
      case 'scaryWind':
        this.noise({ dur: 5, gain: 0.3 * vol, attack: 2, color: 'pink', filter: { type: 'bandpass', freq: 300, to: 900, q: 1.2, time: 4 }, reverb: 0.6 });
        break;
      case 'kneel':
        this.noise({ dur: 0.18, gain: 0.08 * vol, color: 'brown', filter: { type: 'lowpass', freq: 800 }, ...o });
        this.tone({ type: 'triangle', freq: 1200, to: 900, dur: 0.12, gain: 0.03 * vol, ...o });
        break;
      case 'ash':
        this.noise({ dur: 0.6, gain: 0.12 * vol, attack: 0.05, filter: { type: 'bandpass', freq: 2200, to: 500, q: 1 }, ...o, reverb: 0.3 });
        break;
      case 'recruit':
        this.pluck(69, undefined, 0.08, 'sfx');
        this.noise({ dur: 0.1, gain: 0.08, color: 'brown', filter: { type: 'lowpass', freq: 600 } });
        break;
      case 'cage':
        this.clashLow();
        break;
    }
  }

  private clashLow() {
    for (const m of [1, 2.3, 3.9]) this.tone({ freq: 220 * m, dur: 0.8, gain: 0.08, reverb: 0.6 });
    this.noise({ dur: 0.2, gain: 0.2, color: 'brown', filter: { type: 'lowpass', freq: 900 } });
  }

  // ───────────────────────────── intro score cues ─────────────────────────────

  cue(name: string) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    switch (name) {
      case 'opening':
        this.stopLoop(0.5);
        this.drone(38, 0.05);
        for (let i = 0; i < 7; i++) this.heartbeat(t + i * 1.05, 0.55 + i * 0.05);
        break;
      case 'suryagarh':
        this.whoosh(t, 2.2, 0.35);
        this.choir([62, 66, 69, 74], t + 0.3, 9.5, 0.06, 3);
        this.pad([38, 45, 50, 54], t, 16, 0.03, 3);
        for (let i = 0; i < 12; i++) this.pluck(scaleNote(62, [0, 2, 4, 6, 7, 4, 2, 4, 7, 9, 7, 4][i]), t + 2 + i * 0.55, 0.06);
        break;
      case 'crown':
        this.shimmer(t, 0.08);
        this.shimmer(t + 2.5, 0.06);
        this.choir([66, 69, 74, 78], t, 7.5, 0.05, 2);
        break;
      case 'eclipse':
        this.braam(t + 0.4, 6, 0.45, 38);
        this.choir([62, 65, 70], t + 1, 8, 0.05, 3);
        this.noise({ dur: 8, gain: 0.18, attack: 4, color: 'pink', when: t, filter: { type: 'bandpass', freq: 250, to: 700, q: 1.2, time: 7 }, reverb: 0.6, bus: 'music' });
        break;
      case 'kaalrath':
        this.thunder(t, 0.9);
        this.tone({ type: 'sawtooth', freq: midi(26), dur: 6, gain: 0.1, attack: 1.5, when: t, filter: { type: 'lowpass', freq: 180 }, bus: 'music', reverb: 0.5 });
        this.heartbeat(t + 2.5, 0.6);
        this.heartbeat(t + 3.4, 0.7);
        this.heartbeat(t + 4.2, 0.8);
        break;
      case 'thunderFar':
        this.thunder(t, 0.45);
        break;
      case 'rise':
        this.whoosh(t, 1.8, 0.45);
        this.shimmer(t + 0.4, 0.06);
        break;
      case 'impact':
        this.taiko(t, 0.7, 0.5);
        this.noise({ dur: 2.5, gain: 0.25, attack: 0.02, when: t, color: 'brown', filter: { type: 'lowpass', freq: 400, to: 60 }, bus: 'music', reverb: 0.6 });
        break;
      case 'breath':
        this.noise({ dur: 4, gain: 0.4, attack: 0.3, when: t, color: 'brown', filter: { type: 'lowpass', freq: 1800, to: 400 }, bus: 'music', reverb: 0.5 });
        this.braam(t, 5, 0.35, 45);
        break;
      case 'shatter':
        this.taiko(t, 1.3, 0.65);
        this.taiko(t, 1, 1.1);
        this.shatter(t, 0.9);
        this.braam(t, 4, 0.3, 50);
        this.duck(0.9, 2.2);
        break;
      case 'sevenFires':
        this.pad([38, 41, 45, 50], t, 9, 0.04, 2);
        for (let i = 0; i < 7; i++) this.taiko(t + 0.8 + i * 0.95, 0.45, 0.55 + (i % 3) * 0.1);
        this.choir([50, 53, 57], t + 1, 8, 0.04, 3);
        break;
      case 'horde': {
        const beat = 60 / 92;
        for (let i = 0; i < 16; i++) {
          this.taiko(t + i * beat, i % 4 === 0 ? 0.9 : 0.45, i % 2 ? 1.2 : 0.8);
          if (i % 4 === 2) this.taiko(t + i * beat + beat / 2, 0.3, 1.4);
        }
        this.tone({ type: 'sawtooth', freq: midi(38), dur: 9, gain: 0.05, attack: 1, when: t, filter: { type: 'lowpass', freq: 300 }, bus: 'music', reverb: 0.4, vibrato: { rate: 0.2, depth: 15 } });
        break;
      }
      case 'egg':
        for (let i = 0; i < 6; i++) this.heartbeat(t + i * 1.0, 0.65);
        this.shimmer(t + 1.2, 0.05);
        this.noise({ dur: 5, gain: 0.05, attack: 2, when: t, color: 'brown', filter: { type: 'lowpass', freq: 200 }, bus: 'music', reverb: 0.8 });
        break;
      case 'lastKing':
        this.whoosh(t, 2.5, 0.25);
        this.choir([50, 57, 62, 66], t, 9, 0.06, 4);
        this.pad([38, 45, 50], t, 9, 0.04, 3);
        break;
      case 'lightning':
        this.thunder(t, 1);
        this.taiko(t, 0.8, 0.7);
        break;
      case 'card':
        this.taiko(t, 1.2, 0.55);
        this.noise({ dur: 0.9, gain: 0.3, attack: 0.01, when: t, color: 'pink', filter: { type: 'lowpass', freq: 2400, to: 200 }, bus: 'music', reverb: 0.7 });
        this.tone({ type: 'sawtooth', freq: midi(26), dur: 1.6, gain: 0.12, when: t, filter: { type: 'lowpass', freq: 300 }, bus: 'music', reverb: 0.6 });
        break;
      case 'cardSilent':
        this.tone({ freq: midi(86), dur: 3, gain: 0.05, attack: 0.5, when: t, bus: 'music', reverb: 0.9 });
        this.heartbeat(t + 0.3, 0.7);
        break;
      case 'title':
        this.braam(t, 7, 0.6, 38);
        this.taiko(t, 1.4, 0.6);
        this.taiko(t, 1, 1);
        this.choir([62, 66, 69, 74, 78], t, 9, 0.08, 0.15);
        this.shatter(t + 0.05, 0.3);
        break;
      case 'shardsReturn':
        this.whoosh(t, 3, 0.3);
        for (let i = 0; i < 7; i++) this.pluck(scaleNote(62, 7 - i), t + i * 0.4, 0.07);
        this.choir([62, 66, 69], t + 1.5, 7, 0.05, 2);
        break;
      case 'crownReformed':
        this.shimmer(t, 0.1);
        this.taiko(t, 1, 0.7);
        this.choir([62, 66, 69, 74, 78], t, 8, 0.07, 0.5);
        break;
      case 'dragonWakes':
        this.play('roar', 1.2);
        this.braam(t + 0.4, 6, 0.45, 38);
        break;
      case 'dawn':
        this.startEndingMusic();
        break;
    }
  }
}

export const audio = new AudioEngine();
export { midi, scaleNote };
