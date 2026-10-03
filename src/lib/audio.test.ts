import { describe, it, expect } from "vitest";
import { PROCESSOR_SRC, type AudioParams } from "./audio";

/** A worklet-processzort Node-ban futtatjuk: AudioWorkletProcessor/registerProcessor shim. */
function makeProcessor(sr = 48000) {
  let Ctor: (new () => { process: (i: unknown, o: Float32Array[][]) => boolean; port: { onmessage: (e: { data: AudioParams }) => void } }) | null = null;
  class AudioWorkletProcessor {
    port = { onmessage: (e: { data: AudioParams }) => void e };
  }
  const registerProcessor = (_n: string, c: typeof Ctor) => (Ctor = c);
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", PROCESSOR_SRC)(AudioWorkletProcessor, registerProcessor, sr);
  const p = new Ctor!();
  return p;
}

const base: AudioParams = {
  rpm: 0, load: 0, throttle: 0, running: false, combusting: false, overrun: false, starter: false, turbo: 0, boost: 0,
  bovCount: 0, bovLevel: 0, misfire: [false, false, false, false], bearing: 0, knock: 0, grindCount: 0, crashCount: 0,
  speed: 0, epbMotor: false, horn: false, indicator: false, chimeCount: 0, interior: false, distance: 5, race: false, master: 0.9,
};

function render(p: ReturnType<typeof makeProcessor>, params: Partial<AudioParams>, seconds: number, sr = 48000) {
  p.port.onmessage({ data: { ...base, ...params } });
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i += 128) {
    const L = new Float32Array(128);
    const R = new Float32Array(128);
    p.process([], [[L, R]]);
    out.set(L.subarray(0, Math.min(128, out.length - i)), i);
  }
  return out;
}

const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

/** Domináns frekvencia egy sávban (DFT a kért frekvenciákon) */
function peakFreq(a: Float32Array, f0: number, f1: number, sr = 48000) {
  let best = 0;
  let bestF = 0;
  for (let f = f0; f <= f1; f += 1) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < a.length; i += 2) {
      const ph = (2 * Math.PI * f * i) / sr;
      re += a[i] * Math.cos(ph);
      im += a[i] * Math.sin(ph);
    }
    const m = re * re + im * im;
    if (m > best) {
      best = m;
      bestF = f;
    }
  }
  return bestF;
}

describe("hangszintézis (AudioWorklet)", () => {
  it("álló motor csendes, járó motor szól, nincs NaN és túlvezérlés", () => {
    const p = makeProcessor();
    const quiet = render(p, {}, 0.3);
    expect(rms(quiet)).toBeLessThan(0.003);
    const run = { rpm: 3000, load: 0.4, throttle: 0.3, running: true, combusting: true };
    render(p, run, 1.0); // simítás beáll
    const a = render(p, run, 0.5);
    expect(a.every((v) => Number.isFinite(v))).toBe(true);
    expect(rms(a)).toBeGreaterThan(0.02);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(0.81);
  });

  it("a gyújtási frekvencia a fordulattal arányos (4 henger: 2 gyújtás/fordulat)", () => {
    for (const rpm of [1500, 3000]) {
      const p = makeProcessor();
      const run = { rpm, load: 0.5, throttle: 0.4, running: true, combusting: true };
      render(p, run, 1.5);
      const a = render(p, run, 0.5);
      const fire = rpm / 30;
      const f = peakFreq(a, fire * 0.6, fire * 1.4);
      expect(Math.abs(f - fire)).toBeLessThan(fire * 0.06);
    }
  });

  it("gyújtáskimaradás (1 henger) hallhatóan megváltoztatja a hangot – félrendű komponens", () => {
    const run = { rpm: 2400, load: 0.5, throttle: 0.4, running: true, combusting: true };
    const p1 = makeProcessor();
    render(p1, run, 1.2);
    const ok = render(p1, run, 0.5);
    const p2 = makeProcessor();
    render(p2, { ...run, misfire: [false, false, true, false] }, 1.2);
    const bad = render(p2, { ...run, misfire: [false, false, true, false] }, 0.5);
    // 0.5. rend (fordulat/2/60 Hz) csak kimaradáskor erős
    const half = 2400 / 120;
    const energy = (a: Float32Array) => {
      let re = 0;
      let im = 0;
      for (let i = 0; i < a.length; i++) {
        const ph = (2 * Math.PI * half * i) / 48000;
        re += a[i] * Math.cos(ph);
        im += a[i] * Math.sin(ph);
      }
      return Math.hypot(re, im);
    };
    expect(energy(bad)).toBeGreaterThan(energy(ok) * 3);
  });

  it("események: lefúvatás, csikorgás, kürt hangot adnak", () => {
    const p = makeProcessor();
    render(p, {}, 0.2);
    const bov = render(p, { bovCount: 1, bovLevel: 1 }, 0.2);
    expect(rms(bov)).toBeGreaterThan(0.01);
    render(p, { bovCount: 1 }, 1.5);
    const grind = render(p, { bovCount: 1, grindCount: 1 }, 0.3);
    expect(rms(grind)).toBeGreaterThan(0.02);
    const horn = render(p, { bovCount: 1, grindCount: 1, horn: true }, 0.3);
    expect(rms(horn)).toBeGreaterThan(0.05);
  });

  it("belső nézetben tompább (kevesebb magas frekvencia), mint kívül", () => {
    const run = { rpm: 4500, load: 0.9, throttle: 1, running: true, combusting: true, turbo: 0.9, boost: 100 };
    const hf = (a: Float32Array) => {
      let s = 0;
      for (let i = 1; i < a.length; i++) s += (a[i] - a[i - 1]) ** 2;
      return s / a.length / (rms(a) ** 2 + 1e-12);
    };
    const pe = makeProcessor();
    render(pe, { ...run, distance: 3 }, 2);
    const ext = render(pe, { ...run, distance: 3 }, 0.5);
    const pi = makeProcessor();
    render(pi, { ...run, interior: true }, 2);
    const int = render(pi, { ...run, interior: true }, 0.5);
    expect(hf(int)).toBeLessThan(hf(ext));
  });
});
