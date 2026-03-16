export const SoundManager = {
  ctx: null as AudioContext | null,
  ambientNoise: null as AudioBufferSourceNode | null,

  init() {
    if (typeof window !== 'undefined' && !this.ctx) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  },

  play(name: string) {
    if (!this.ctx) return;
    
    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    
    if (name === 'sword' || name === 'impact') {
      // Metallic clash sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (name === 'bow') {
      // Twang sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
      
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.2);
    } else if (name === 'spear') {
      // Whoosh sound
      const bufferSize = this.ctx.sampleRate * 0.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(500, t);
      filter.frequency.linearRampToValueAtTime(1000, t + 0.1);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      noise.start(t);
    } else if (name === 'death') {
      // Low groan
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.4);
      
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (name === 'footstep') {
      // Short thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.05);
      
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.05);
    } else if (name === 'dragon_roar') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 2);
      
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 2);
    } else if (name === 'dragon_fire') {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, t);
      filter.frequency.linearRampToValueAtTime(100, t + 0.5);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      noise.start(t);
    } else if (name === 'scary_wind') {
      const bufferSize = Math.floor(this.ctx.sampleRate * 8.5); // 8.5 seconds long
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // compensate for gain
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.linearRampToValueAtTime(800, t + 4.0);
      filter.frequency.linearRampToValueAtTime(200, t + 8.5);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 4.0);
      gain.gain.linearRampToValueAtTime(0.01, t + 8.5);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      noise.start(t);
    }
  },

  playMusic() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Stop existing
    this.stopMusic();

    // Ambient wind (pink noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11;
      b6 = white * 0.115926;
    }
    
    this.ambientNoise = this.ctx.createBufferSource();
    this.ambientNoise.buffer = buffer;
    this.ambientNoise.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0.02;
    
    this.ambientNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    this.ambientNoise.start();
  },

  stopMusic() {
    if (this.ambientNoise) {
      try {
        this.ambientNoise.stop();
        this.ambientNoise.disconnect();
      } catch (e) {}
      this.ambientNoise = null;
    }
  }
};
