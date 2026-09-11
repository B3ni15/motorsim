"use client";

interface Props {
  value: number;
  min?: number;
  max: number;
  label: string;
  unit?: string;
  redFrom?: number;
  size?: number;
  decimals?: number;
  ticks?: number;
}

const START = 135; // fok, bal alsó
const SWEEP = 270;

/** Kerekített koordináta: a szerver és a kliens ugyanazt a stringet adja (hidratálás). */
const rnd = (v: number) => Math.round(v * 1000) / 1000;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [rnd(cx + r * Math.cos(a)), rnd(cy + r * Math.sin(a))] as const;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export default function Gauge({ value, min = 0, max, label, unit, redFrom, size = 180, decimals = 0, ticks = 8 }: Props) {
  const cx = 100;
  const cy = 100;
  const r = 84;
  const clamped = Math.max(min, Math.min(max, value));
  const frac = (clamped - min) / (max - min);
  const angle = START + frac * SWEEP;
  const redAngle = redFrom !== undefined ? START + ((redFrom - min) / (max - min)) * SWEEP : null;
  const [nx, ny] = polar(cx, cy, r - 10, angle);
  const tickEls = [];
  for (let i = 0; i <= ticks; i++) {
    const a = START + (i / ticks) * SWEEP;
    const [x0, y0] = polar(cx, cy, r, a);
    const [x1, y1] = polar(cx, cy, r - 10, a);
    const [tx, ty] = polar(cx, cy, r - 24, a);
    const v = min + (i / ticks) * (max - min);
    tickEls.push(
      <g key={i}>
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#cbd5e1" strokeWidth={2} />
        <text x={tx} y={ty} fill="#94a3b8" fontSize={10} textAnchor="middle" dominantBaseline="middle">
          {Math.round(v)}
        </text>
      </g>,
    );
  }
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="select-none">
      <circle cx={cx} cy={cy} r={96} fill="#0f172a" stroke="#334155" strokeWidth={3} />
      <path d={arc(cx, cy, r, START, START + SWEEP)} stroke="#475569" strokeWidth={4} fill="none" />
      {redAngle !== null && <path d={arc(cx, cy, r, redAngle, START + SWEEP)} stroke="#ef4444" strokeWidth={6} fill="none" />}
      {tickEls}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#f97316" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#f97316" />
      <text x={cx} y={cy + 20} fill="#e2e8f0" fontSize={18} textAnchor="middle" fontWeight={600}>
        {value.toFixed(decimals)}
      </text>
      <text x={cx} y={cy + 33} fill="#94a3b8" fontSize={10} textAnchor="middle">
        {label}
        {unit ? ` (${unit})` : ""}
      </text>
    </svg>
  );
}
