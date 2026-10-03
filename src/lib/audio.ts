/**
 * Szintetizált Golf R hangkép Web Audio AudioWorklet-tel.
 * A worklet mintánként számolja a főtengely szögét, és minden gyújtásnál (1-3-4-2, 180°-onként)
 * egy kipufogó-impulzust indít, amely a kipufogórendszer rezonanciáin (szűrőbank) szól.
 * Ugyanitt: szívózaj, turbósípolás, lefúvató szelep, durrogás, önindító, csapágykopogás,
 * kopogás (LSPI), váltócsikorgás, motortörés, gördülési- és szélzaj, EPB motor, index, kürt, gong.
 */

export interface AudioParams {
  rpm: number;
  /** 0..1 terhelés (töltés) */
  load: number;
  throttle: number;
  running: boolean;
  combusting: boolean;
  overrun: boolean;
  starter: boolean;
  turbo: number;
  boost: number;
  bovCount: number;
  bovLevel: number;
  misfire: boolean[];
  bearing: number;
  knock: number;
  grindCount: number;
  crashCount: number;
  speed: number;
  epbMotor: boolean;
  horn: boolean;
  indicator: boolean;
  chimeCount: number;
  interior: boolean;
  distance: number;
  race: boolean;
  master: number;
}

export const PROCESSOR_SRC = /* js */ `
const TAU = Math.PI * 2;
class Biquad {
  constructor(){ this.b0=1; this.b1=0; this.b2=0; this.a1=0; this.a2=0; this.z1=0; this.z2=0; }
  set(type, f, q, sr){
    const w = TAU * Math.min(Math.max(f, 10), sr * 0.45) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  p(x){ const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}
const ORDER = [0, 2, 3, 1]; // gyújtási sorrend 1-3-4-2 (0-indexelt hengerek)

class GolfEngine extends AudioWorkletProcessor {
  constructor(){
    super();
    const sr = sampleRate;
    this.sr = sr;
    this.P = { rpm: 0, load: 0, throttle: 0, running: false, combusting: false, overrun: false, starter: false, turbo: 0, boost: 0, bovCount: 0, bovLevel: 0, misfire: [false,false,false,false], bearing: 0, knock: 0, grindCount: 0, crashCount: 0, speed: 0, epbMotor: false, horn: false, indicator: false, chimeCount: 0, interior: false, distance: 5, race: false, master: 0.8 };
    this.rpm = 0; this.load = 0; this.thr = 0; this.turbo = 0; this.speed = 0; this.ext = 1; this.cab = 0; this.gain = 0;
    this.crank = 0; this.lastIdx = 0;
    this.pulseT = 1; this.pulseLen = 0.004; this.pulseAmp = 0; this.cylVar = [1.0, 0.94, 1.06, 0.97];
    this.r1 = new Biquad().set('bp', 105, 2.2, sr);
    this.r2 = new Biquad().set('bp', 330, 2.6, sr);
    this.r3 = new Biquad().set('bp', 1150, 1.8, sr);
    this.muff = new Biquad(); this.mufF = 0;
    this.dc = new Biquad().set('hp', 28, 0.7, sr);
    this.ind = new Biquad(); this.indF = 0;
    this.cabLp = new Biquad().set('lp', 1300, 0.7, sr);
    this.cabLp2 = new Biquad().set('lp', 2600, 0.7, sr);
    this.sakt = new Biquad().set('lp', 220, 0.9, sr);
    this.bovBp = new Biquad().set('bp', 2300, 0.9, sr); this.bovEnv = 0; this.bovT = 0; this.bovSeen = 0;
    this.popEnv = 0; this.popAmp = 0; this.popHp = new Biquad().set('hp', 300, 0.7, sr); this.popLow = new Biquad().set('bp', 75, 3, sr);
    this.tPh = 0; this.tPh2 = 0;
    this.stPh = 0; this.stLp = new Biquad().set('lp', 1400, 0.8, sr);
    this.knEnv = 0; this.knBp = new Biquad().set('bp', 2600, 6, sr);
    this.pgEnv = 0; this.pgBp = new Biquad().set('bp', 6400, 14, sr);
    this.grEnv = 0; this.grPh = 0; this.grBp = new Biquad().set('bp', 1500, 1.2, sr); this.grSeen = 0;
    this.crEnv = 0; this.crLp = new Biquad().set('lp', 2600, 0.7, sr); this.crLow = new Biquad().set('bp', 55, 2, sr); this.crSeen = 0;
    this.road = new Biquad(); this.roadF = 0; this.wind = new Biquad().set('bp', 650, 0.6, sr);
    this.epbPh = 0; this.epbLp = new Biquad().set('lp', 900, 0.7, sr);
    this.indSeen = false; this.tick = 0; this.tickF = 2000;
    this.hPh1 = 0; this.hPh2 = 0; this.hornLp = new Biquad().set('lp', 2600, 0.7, sr);
    this.chEnv = 0; this.chPh = 0; this.chSeen = 0;
    this.init = false;
    this.port.onmessage = (e) => {
      const p = e.data;
      if (!this.init) { this.bovSeen = p.bovCount; this.grSeen = p.grindCount; this.crSeen = p.crashCount; this.chSeen = p.chimeCount; this.indSeen = p.indicator; this.init = true; }
      this.P = p;
    };
  }
  process(_, outputs){
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const P = this.P, sr = this.sr;
    // eseményindítók
    if (P.bovCount !== this.bovSeen) { this.bovSeen = P.bovCount; this.bovEnv = Math.max(this.bovEnv, 0.35 + P.bovLevel * 0.65); this.bovT = 0; }
    if (P.grindCount !== this.grSeen) { this.grSeen = P.grindCount; this.grEnv = 1; }
    if (P.crashCount !== this.crSeen) { this.crSeen = P.crashCount; this.crEnv = 1; }
    if (P.chimeCount !== this.chSeen) { this.chSeen = P.chimeCount; this.chEnv = 1; this.chPh = 0; }
    if (P.indicator !== this.indSeen) { this.indSeen = P.indicator; this.tick = 1; this.tickF = P.indicator ? 2300 : 1700; }
    // blokk-szintű szűrő-frissítés
    const loadT = P.load;
    const mf = (P.race ? 1500 : 1000) + 2600 * Math.min(1, this.load) + this.rpm * 0.12;
    if (Math.abs(mf - this.mufF) > 20) { this.muff.set('lp', mf, 0.75, sr); this.mufF = mf; }
    const indF = 250 + this.rpm * 0.28;
    if (Math.abs(indF - this.indF) > 15) { this.ind.set('bp', indF, 1.3, sr); this.indF = indF; }
    const roadF = 140 + this.speed * 18;
    if (Math.abs(roadF - this.roadF) > 10) { this.road.set('lp', roadF, 0.7, sr); this.roadF = roadF; }
    const extT = P.interior ? 0 : 1 / (1 + Math.max(0, P.distance - 3) / 7);
    const cabT = P.interior ? 1 : 0;
    const gainT = P.master;
    const n = L.length;
    for (let i = 0; i < n; i++) {
      // paraméter-simítás
      this.rpm += (P.rpm - this.rpm) * 0.0015;
      this.load += (loadT - this.load) * 0.002;
      this.thr += (P.throttle - this.thr) * 0.002;
      this.turbo += (P.turbo - this.turbo) * 0.0008;
      this.speed += (P.speed - this.speed) * 0.0005;
      this.ext += (extT - this.ext) * 0.0005;
      this.cab += (cabT - this.cab) * 0.0005;
      this.gain += (gainT - this.gain) * 0.0005;
      const rpm = this.rpm;
      const noise = Math.random() * 2 - 1;
      // ---- főtengely + gyújtási impulzusok ----
      const omega = rpm / 60 * TAU;
      this.crank += omega / sr;
      if (this.crank > 4 * Math.PI) this.crank -= 4 * Math.PI;
      const idx = Math.floor(this.crank / Math.PI);
      if (idx !== this.lastIdx) {
        this.lastIdx = idx;
        const cyl = ORDER[((idx % 4) + 4) % 4];
        const fireHz = Math.max(4, rpm / 30);
        this.pulseLen = Math.min(0.012, Math.max(0.0011, 0.42 / fireHz));
        this.pulseT = 0;
        let a;
        if (P.running && P.combusting && !P.misfire[cyl]) a = (0.3 + 0.9 * Math.min(1.4, this.load)) * this.cylVar[cyl] * (0.92 + Math.random() * 0.16);
        else if (P.running || P.starter || rpm > 60) a = 0.1 + Math.min(0.12, rpm / 20000); // csak szivattyúzás/sűrítés
        else a = 0;
        this.pulseAmp = a;
        if (P.bearing > 0.3 && rpm > 300) this.knEnv = Math.min(1, P.bearing) * (0.35 + 0.65 * this.load);
        // durrogás: túlfutáskor véletlenszerű utóégés
        if (P.overrun && rpm > 2300 && Math.random() < (P.race ? 0.09 : 0.025)) { this.popEnv = 1; this.popAmp = 0.5 + Math.random() * 0.8; }
      }
      let pulse = 0;
      if (this.pulseT < this.pulseLen) {
        const ph = this.pulseT / this.pulseLen;
        pulse = Math.sin(Math.PI * ph) * (1 - ph * 0.5) * this.pulseAmp;
        this.pulseT += 1 / sr;
      }
      const exc = pulse + noise * 0.12 * pulse;
      let exh = 0.6 * this.r1.p(exc) + 0.45 * this.r2.p(exc) + 0.22 * this.r3.p(exc) + 0.3 * exc;
      exh = this.muff.p(exh);
      // ---- durrogás ----
      let pop = 0;
      if (this.popEnv > 0.001) {
        pop = (this.popHp.p(noise) * 0.6 + this.popLow.p(noise) * 4) * this.popEnv * this.popAmp;
        this.popEnv *= Math.exp(-1 / (0.018 * sr));
      }
      // ---- szívás + turbó ----
      const indAmp = this.thr * (0.04 + Math.min(1, rpm / 6800) * 0.22) + this.turbo * 0.04;
      const intake = this.ind.p(noise) * indAmp * (0.7 + 0.3 * Math.sin(2 * this.crank));
      const tf = 2600 + this.turbo * 13000;
      this.tPh += tf / sr; if (this.tPh > 1) this.tPh -= 1;
      this.tPh2 += tf * 0.5 / sr; if (this.tPh2 > 1) this.tPh2 -= 1;
      const tAmp = Math.pow(Math.min(1.1, this.turbo), 2) * (0.006 + Math.min(1, P.boost / 110) * 0.02);
      const turbo = (Math.sin(TAU * this.tPh) + 0.4 * Math.sin(TAU * this.tPh2)) * tAmp;
      // ---- lefúvató (diverter) szelep ----
      let bov = 0;
      if (this.bovEnv > 0.001) {
        const fl = this.bovT < 0.18 ? 0.6 + 0.4 * Math.sin(TAU * 24 * this.bovT) : 1;
        bov = this.bovBp.p(noise) * this.bovEnv * 0.55 * fl;
        this.bovEnv *= Math.exp(-1 / (0.22 * sr));
        this.bovT += 1 / sr;
      }
      // ---- önindító ----
      let starter = 0;
      if (P.starter) {
        const f = 130 + Math.min(300, rpm) * 0.55;
        this.stPh += f / sr; if (this.stPh > 1) this.stPh -= 1;
        starter = this.stLp.p((2 * this.stPh - 1) * 0.5 + noise * 0.25) * 0.22 * (0.6 + 0.4 * Math.max(0, Math.sin(2 * this.crank)));
      }
      // ---- csapágykopogás + kopogás (LSPI) ----
      let knock = 0;
      if (this.knEnv > 0.001) { knock = this.knBp.p(noise) * this.knEnv * 2.2; this.knEnv *= Math.exp(-1 / (0.006 * sr)); }
      if (P.knock > 3 && Math.random() < 9 / sr) this.pgEnv = Math.min(1, P.knock / 10);
      let ping = 0;
      if (this.pgEnv > 0.001) { ping = this.pgBp.p(noise) * this.pgEnv * 3; this.pgEnv *= Math.exp(-1 / (0.012 * sr)); }
      // ---- váltócsikorgás ----
      let grind = 0;
      if (this.grEnv > 0.001) {
        this.grPh += (210 + 60 * Math.sin(TAU * 7 * this.grEnv)) / sr; if (this.grPh > 1) this.grPh -= 1;
        grind = this.grBp.p((2 * this.grPh - 1) + noise * 0.9) * this.grEnv * (0.6 + 0.4 * Math.sin(TAU * 38 * this.grEnv)) * 1.3;
        this.grEnv *= Math.exp(-1 / (0.4 * sr));
      }
      // ---- motortörés ----
      let crash = 0;
      if (this.crEnv > 0.001) {
        crash = (this.crLp.p(noise) * 0.9 + this.crLow.p(noise) * 5) * this.crEnv;
        this.crEnv *= Math.exp(-1 / (0.9 * sr));
      }
      // ---- gördülés + szél ----
      const v = Math.abs(this.speed);
      const road = this.road.p(noise) * Math.min(1, v / 30) * 0.12;
      const wind = this.wind.p(noise) * Math.pow(Math.min(1.6, v / 45), 2) * 0.16;
      // ---- EPB motor ----
      let epb = 0;
      if (P.epbMotor) { this.epbPh += 175 / sr; if (this.epbPh > 1) this.epbPh -= 1; epb = this.epbLp.p(2 * this.epbPh - 1 + noise * 0.3) * 0.06; }
      // ---- index relé ----
      let tick = 0;
      if (this.tick > 0.001) { tick = (Math.sin(TAU * this.tickF * this.tick) + noise * 0.5) * this.tick * 0.12; this.tick *= Math.exp(-1 / (0.004 * sr)); }
      // ---- kürt ----
      let horn = 0;
      if (P.horn) {
        this.hPh1 += 415 / sr; if (this.hPh1 > 1) this.hPh1 -= 1;
        this.hPh2 += 510 / sr; if (this.hPh2 > 1) this.hPh2 -= 1;
        horn = this.hornLp.p((this.hPh1 < 0.5 ? 1 : -1) + (this.hPh2 < 0.5 ? 1 : -1)) * 0.12;
      }
      // ---- gong ----
      let chime = 0;
      if (this.chEnv > 0.001) { this.chPh += 1250 / sr; chime = Math.sin(TAU * this.chPh) * this.chEnv * 0.14; this.chEnv *= Math.exp(-1 / (0.45 * sr)); }
      // ---- keverés: kívül / belül ----
      const ext = this.ext, cab = this.cab;
      const exLoud = P.race ? 1.25 : 1.0;
      const mechanical = starter + knock + ping + grind + crash;
      const outside = (exh * 1.1 * exLoud + pop * exLoud + intake * 0.55 + turbo * 0.8 + bov * 0.7 + mechanical * 0.9 + road + wind * 0.6) * ext;
      // utastér: tompított kipufogó + szívás/turbó + „Soundaktor” mélyhang + szél és gördülés
      const inside = (this.cabLp.p(exh * 0.75 + pop * 0.5 + mechanical * 0.6) + this.cabLp2.p(intake * 0.8 + turbo * 1.1 + bov * 0.5) + this.sakt.p(exh) * (P.race ? 1.4 : 0.8) + road * 1.2 + wind * 0.9) * cab;
      let s = this.dc.p(outside + inside) + epb + tick + horn + chime;
      s = Math.tanh(s * 1.4 * this.gain) * 0.8;
      L[i] = s; R[i] = s;
    }
    return true;
  }
}
registerProcessor('golf-engine', GolfEngine);
`;

export class CarAudio {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Float32Array(1024);
  private ready = false;
  private starting = false;

  async start() {
    if (this.ctx || this.starting) return;
    this.starting = true;
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;
    const url = URL.createObjectURL(new Blob([PROCESSOR_SRC], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, "golf-engine", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    node.connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    node.connect(this.analyser);
    this.node = node;
    this.ready = true;
    this.starting = false;
    if (ctx.state === "suspended") await ctx.resume();
  }

  stop() {
    if (!this.ctx) return;
    this.ctx.close();
    this.ctx = null;
    this.node = null;
    this.analyser = null;
    this.ready = false;
  }

  get active() {
    return !!this.ctx;
  }

  /** Kimeneti szint (RMS) – hangerő-kijelzőhöz és tesztekhez. */
  level(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0;
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    return Math.sqrt(s / this.buf.length);
  }

  update(p: AudioParams) {
    if (!this.ready || !this.node) return;
    this.node.port.postMessage(p);
  }
}
