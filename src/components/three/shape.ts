/**
 * VW Golf 7.5 R karosszéria – paraméteres felület (méterben).
 * Koordináták: +X előre, +Y fel, +Z jobbra (utasoldal); origó: a tengelytáv közepe alatt a talajon.
 */
import * as THREE from "three";
import { DRIVETRAIN } from "@/lib/engine";

export const CAR = {
  xFront: 2.205,
  xRear: -2.072,
  axleF: DRIVETRAIN.wheelbaseM / 2,
  axleR: -DRIVETRAIN.wheelbaseM / 2,
  wheelR: DRIVETRAIN.wheelRadius,
  trackF: DRIVETRAIN.trackFrontM,
  trackR: DRIVETRAIN.trackRearM,
  halfW: 0.8995,
  archR: 0.362,
  /** vezető szemmagassága / helye (balkormányos) */
  eye: new THREE.Vector3(-0.42, 1.16, -0.37),
  driverZ: -0.37,
};

type P = [number, number];

/** Monoton köbös (Fritsch–Carlson) interpoláció; pts x szerint CSÖKKENŐ sorrendben (elölről hátra). */
function monotone(ptsDesc: P[]): (x: number) => number {
  const pts = [...ptsDesc].reverse();
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Felső körvonal (oldalnézet) */
export const TOP: P[] = [
  [2.205, 0.5],
  [2.2, 0.6],
  [2.185, 0.68],
  [2.16, 0.745],
  [2.12, 0.79],
  [2.04, 0.812],
  [1.6, 0.872],
  [1.2, 0.915],
  [0.9, 0.943],
  [0.8, 0.955],
  [0.6, 1.07],
  [0.3, 1.235],
  [0.05, 1.365],
  [-0.15, 1.425],
  [-0.45, 1.445],
  [-1.0, 1.435],
  [-1.45, 1.415],
  [-1.68, 1.4],
  [-1.76, 1.385],
  [-1.79, 1.35],
  [-1.85, 1.22],
  [-1.92, 1.07],
  [-1.975, 0.985],
  [-2.03, 0.86],
  [-2.055, 0.7],
  [-2.068, 0.56],
  [-2.072, 0.48],
];

/** Alsó körvonal */
export const BOTTOM: P[] = [
  [2.205, 0.24],
  [2.195, 0.19],
  [2.15, 0.155],
  [2.0, 0.13],
  [1.9, 0.125],
  [-1.7, 0.125],
  [-1.95, 0.18],
  [-2.04, 0.25],
  [-2.072, 0.32],
];

/** Ablak alsó vonala (övvonal) */
export const BELT: P[] = [
  [0.8, 0.955],
  [0.3, 0.975],
  [-0.5, 1.0],
  [-1.2, 1.03],
  [-1.6, 1.045],
  [-1.97, 1.0],
];

/** Tető / A-oszlop félszélessége (felülnézet, felső szélesség) */
export const ROOFW: P[] = [
  [2.3, 0.72],
  [0.8, 0.735],
  [0.0, 0.645],
  [-1.0, 0.635],
  [-1.7, 0.6],
  [-1.95, 0.68],
  [-2.1, 0.7],
];

const topF = monotone(TOP);
const bottomF = monotone(BOTTOM);
const beltF = monotone(BELT);
const roofF = monotone(ROOFW);
export const topY = (x: number) => topF(x);
export const bottomY = (x: number) => bottomF(x);
export const beltY = (x: number) => Math.min(beltF(x), topY(x));
export const roofW = (x: number) => roofF(x);
export const SHOULDER_Y = 0.85;

/** Felülnézeti félszélesség (lekerekített sarkok). */
export function halfWidth(x: number): number {
  const W = CAR.halfW;
  if (x > 1.82) {
    const t = Math.min(1, (x - 1.82) / (CAR.xFront - 1.82));
    return W * (1 - 0.24 * Math.pow(t, 2.6));
  }
  if (x < -1.84) {
    const t = Math.min(1, (-1.84 - x) / (-1.84 - CAR.xRear));
    return W * (1 - 0.16 * Math.pow(t, 2.4));
  }
  return W;
}

/** Egy keresztmetszet jobb fele (z ≥ 0) alulról felfelé: [z, y] pontok. */
function sectionPoints(x: number): P[] {
  const W = halfWidth(x);
  const yt = topY(x);
  const yb = bottomY(x);
  const belt = beltY(x);
  const gh = Math.max(0, yt - belt);
  const k = Math.min(1, gh / 0.12);
  const ysh = Math.min(SHOULDER_Y, yt - 0.06, belt - 0.02 * k - 0.04 * (1 - k));
  const Wr = Math.min(roofW(x), W * 0.92);
  const mix = (a: P, b: P): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const hood: P[] = [
    [W * 0.975, (ysh + yt) / 2 - 0.01],
    [W * 0.9, yt - 0.025],
    [W * 0.62, yt - 0.006],
  ];
  const cabin: P[] = [
    [W * 0.955, belt],
    [Wr, yt - 0.04],
    [Wr * 0.78, yt - 0.009],
  ];
  const lowH = Math.max(0.05, ysh - yb);
  return [
    [0, yb],
    [W * 0.72, yb],
    [W * 0.93, yb + Math.min(0.035, lowH * 0.2)],
    [W * 0.994, yb + Math.min(0.17, lowH * 0.5)],
    [W, ysh],
    mix(hood[0], cabin[0]),
    mix(hood[1], cabin[1]),
    mix(hood[2], cabin[2]),
    [0, yt],
  ];
}

function catmull(pts: P[], samples: number): P[] {
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let j = 0; j < samples; j++) {
      const t = j / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

function resample(poly: P[], m: number): P[] {
  const len: number[] = [0];
  for (let i = 1; i < poly.length; i++) len.push(len[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const total = len[len.length - 1];
  const out: P[] = [];
  let k = 1;
  for (let j = 0; j < m; j++) {
    const target = (j / (m - 1)) * total;
    while (k < len.length - 1 && len[k] < target) k++;
    const t = (target - len[k - 1]) / Math.max(1e-9, len[k] - len[k - 1]);
    out.push([poly[k - 1][0] + (poly[k][0] - poly[k - 1][0]) * t, poly[k - 1][1] + (poly[k][1] - poly[k - 1][1]) * t]);
  }
  return out;
}

/** A keresztmetszet jobb felének sűrű poligonja (z, y) – alulról felfelé. */
export function sectionHalf(x: number, m = 56): P[] {
  return resample(catmull(sectionPoints(x), 10), m);
}

/** A karosszéria belső félszélessége adott x, y pontban (0, ha y a héjon kívül esik). */
export function bodyHalfWidthAt(x: number, y: number): number {
  const half = sectionHalf(x);
  let best = -1;
  for (let i = 0; i < half.length - 1; i++) {
    const [z0, y0] = half[i];
    const [z1, y1] = half[i + 1];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (y < lo || y > hi) continue;
    const t = hi - lo < 1e-6 ? 0 : (y - y0) / (y1 - y0);
    best = Math.max(best, z0 + (z1 - z0) * t);
  }
  return Math.max(0, best);
}

/** A teljes karosszéria-héj BufferGeometry-je (zárt, lekerekített végekkel). */
export function buildBodyGeometry(stations = 170, halfRing = 56): THREE.BufferGeometry {
  const xs: number[] = [];
  for (let i = 0; i < stations; i++) {
    // koszinuszos sűrítés a végeknél
    const u = i / (stations - 1);
    const w = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const blend = 0.55 * w + 0.45 * u;
    xs.push(CAR.xFront - 0.004 - blend * (CAR.xFront - CAR.xRear - 0.008));
  }
  const C = 2 * (halfRing - 1);
  const pos: number[] = [];
  const rings: number[][] = [];
  for (const x of xs) {
    const half = resample(catmull(sectionPoints(x), 10), halfRing);
    const ring: number[] = [];
    for (let j = 0; j < C; j++) {
      let z: number;
      let y: number;
      if (j < halfRing) {
        [z, y] = half[j];
      } else {
        const jj = C - j; // visszafelé a bal oldalon
        [z, y] = half[jj];
        z = -z;
      }
      ring.push(pos.length / 3);
      pos.push(x, y, z);
    }
    rings.push(ring);
  }
  const idx: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    for (let j = 0; j < C; j++) {
      const j1 = (j + 1) % C;
      // kifelé néző normál: elölről hátra haladva
      idx.push(a[j], a[j1], b[j]);
      idx.push(a[j1], b[j1], b[j]);
    }
  }
  // végek lezárása: legyezőháromszögek egy kissé kifelé tolt középpont felé
  const capRing = (ring: number[], x: number, dir: number) => {
    let cy = 0;
    for (const r of ring) cy += pos[r * 3 + 1];
    cy /= ring.length;
    const center = pos.length / 3;
    pos.push(x + dir * 0.012, cy, 0);
    for (let j = 0; j < C; j++) {
      const j1 = (j + 1) % C;
      if (dir > 0) idx.push(ring[j1], ring[j], center);
      else idx.push(ring[j], ring[j1], center);
    }
  };
  capRing(rings[0], xs[0], 1);
  capRing(rings[rings.length - 1], xs[xs.length - 1], -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------------- */
/* Nyíló elemek (ajtók, motorháztető, csomagtérajtó) határai                    */
/* ------------------------------------------------------------------------- */
export type PartId = "body" | "hood" | "doorFL" | "doorFR" | "doorRL" | "doorRR" | "tailgate";
export const PARTS: PartId[] = ["body", "hood", "doorFL", "doorFR", "doorRL", "doorRR", "tailgate"];

export const CUT = {
  doorFront: 0.76, // első ajtó eleje (A-oszlop tövénél)
  doorMid: -0.36, // B-oszlop
  doorRear: -1.12, // hátsó ajtó vége
  sill: 0.31, // küszöb teteje
  hoodRear: 0.83,
  hoodFront: 2.1,
  hoodSide: 0.745,
  tailTop: -1.66,
  tailLow: 0.66,
  tailSide: 0.6,
};

/** Kerékívek (oldalnézet) */
export const ARCHES = [
  { x: CAR.axleF, y: CAR.wheelR + 0.01 },
  { x: CAR.axleR, y: CAR.wheelR + 0.01 },
];

/** GLSL: a JS-függvényekből sűrűn mintavételezett táblák (lineáris interpoláció). */
const GX0 = -2.2;
const GX1 = 2.3;
const GN = 181;
function glslTable(name: string, f: (x: number) => number): string {
  const vals: string[] = [];
  for (let i = 0; i < GN; i++) vals.push(f(GX0 + ((GX1 - GX0) * i) / (GN - 1)).toFixed(4));
  return `const float ${name}_T[${GN}] = float[${GN}](${vals.join(",")});
float ${name}(float x){
  float u = clamp((x - (${GX0.toFixed(3)})) / ${(GX1 - GX0).toFixed(3)}, 0.0, 1.0) * ${(GN - 1).toFixed(1)};
  int i = int(floor(u));
  int j = min(i + 1, ${GN - 1});
  return mix(${name}_T[i], ${name}_T[j], u - float(i));
}
`;
}

export const SHAPE_GLSL = `
${glslTable("topY", topF)}
${glslTable("beltRaw", beltF)}
${glslTable("roofW", roofF)}
float beltY(float x){ return min(beltRaw(x), topY(x)); }
float halfWidth(float x){
  float W=${CAR.halfW.toFixed(4)};
  if (x > 1.82) { float t=min(1.0,(x-1.82)/${(CAR.xFront - 1.82).toFixed(4)}); return W*(1.0-0.24*pow(t,2.6)); }
  if (x < -1.84) { float t=min(1.0,(-1.84-x)/${(-1.84 - CAR.xRear).toFixed(4)}); return W*(1.0-0.16*pow(t,2.4)); }
  return W;
}
`;
