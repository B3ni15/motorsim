/** Egyszerű szintetizált motorhang Web Audio-val. */
export class EngineAudio {
  private ctx: AudioContext | null = null;
  private osc1!: OscillatorNode;
  private osc2!: OscillatorNode;
  private noise!: AudioBufferSourceNode;
  private filter!: BiquadFilterNode;
  private gain!: GainNode;
  private noiseGain!: GainNode;

  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.osc1 = ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc2 = ctx.createOscillator();
    this.osc2.type = "square";
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buf;
    this.noise.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 400;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.noise.connect(this.noiseGain).connect(this.filter);
    this.filter.connect(this.gain).connect(ctx.destination);
    this.osc1.start();
    this.osc2.start();
    this.noise.start();
  }

  stop() {
    if (!this.ctx) return;
    this.ctx.close();
    this.ctx = null;
  }

  get active() {
    return !!this.ctx;
  }

  update(rpm: number, throttle: number, running: boolean, starter: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const fire = Math.max(1, (rpm / 60) * 3); // gyújtási frekvencia (6 henger: 3 / fordulat)
    this.osc1.frequency.setTargetAtTime(fire, t, 0.02);
    this.osc2.frequency.setTargetAtTime(fire / 2, t, 0.02);
    let g = 0;
    if (running) g = 0.04 + throttle * 0.12 + rpm / 60000;
    else if (starter && rpm > 50) g = 0.05;
    this.gain.gain.setTargetAtTime(g, t, 0.05);
    this.noiseGain.gain.setTargetAtTime(running ? 0.2 + throttle * 0.6 : starter ? 0.8 : 0, t, 0.05);
    this.filter.frequency.setTargetAtTime(running ? 250 + throttle * 1800 + rpm / 6 : 300, t, 0.05);
  }
}
