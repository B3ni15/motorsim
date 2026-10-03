import { ENGINE, gearLabel, type Controls, type SimState } from "@/lib/engine";
import { warningLights } from "@/lib/warnings";
import type { BodyCtl } from "./context";
import { blinkOn } from "./context";

const COL = { red: "#ef4444", amber: "#f59e0b", green: "#22c55e", blue: "#3b82f6", white: "#e5e7eb" };

function dial(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, v: number, max: number, ticks: number, label: string, redFrom?: number, sub = 1) {
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  g.lineWidth = 3;
  g.strokeStyle = "#334155";
  g.beginPath();
  g.arc(cx, cy, r, a0, a0 + sweep);
  g.stroke();
  if (redFrom !== undefined) {
    g.strokeStyle = "#dc2626";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx, cy, r - 3, a0 + (redFrom / max) * sweep, a0 + sweep);
    g.stroke();
  }
  // érték-ív (kék Golf R stílus)
  g.strokeStyle = "#2563eb";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, cy, r - 3, a0, a0 + Math.min(1, Math.max(0, v / max)) * sweep);
  g.stroke();
  g.fillStyle = "#cbd5e1";
  g.font = `${Math.round(r * 0.16)}px Arial`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i <= ticks; i++) {
    const a = a0 + (i / ticks) * sweep;
    const x0 = cx + Math.cos(a) * (r - 9);
    const y0 = cy + Math.sin(a) * (r - 9);
    const x1 = cx + Math.cos(a) * (r - 16);
    const y1 = cy + Math.sin(a) * (r - 16);
    g.strokeStyle = "#e2e8f0";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.fillText(String(Math.round((i / ticks) * max / sub)), cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30));
  }
  const a = a0 + Math.min(1.02, Math.max(0, v / max)) * sweep;
  g.strokeStyle = "#f97316";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
  g.stroke();
  g.fillStyle = "#0f172a";
  g.beginPath();
  g.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#94a3b8";
  g.font = `${Math.round(r * 0.13)}px Arial`;
  g.fillText(label, cx, cy + r * 0.55);
}

/** Active Info Display (12,3" digitális műszerfal) */
export function drawAID(g: CanvasRenderingContext2D, w: number, h: number, s: SimState, c: Controls, b: BodyCtl) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#020617");
  grad.addColorStop(1, "#0b1220");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (!c.ignition) {
    g.fillStyle = "#0f172a";
    g.font = "bold 40px Arial";
    g.textAlign = "center";
    g.fillStyle = "#1e293b";
    g.fillText("R", w / 2, h / 2);
    return;
  }
  const r = h * 0.44;
  dial(g, r + 22, h / 2 + 6, r, s.rpm, 8000, 8, "×1000 1/perc", ENGINE.redline, 1000);
  dial(g, w - r - 22, h / 2 + 6, r, Math.abs(s.speed) * 3.6, 320, 8, "km/h");
  // középső mező
  const cx = w / 2;
  g.textAlign = "center";
  g.fillStyle = "#e2e8f0";
  g.font = "bold 64px Arial";
  g.fillText(String(Math.round(Math.abs(s.speed) * 3.6)), cx, h * 0.36);
  g.font = "16px Arial";
  g.fillStyle = "#94a3b8";
  g.fillText("km/h", cx, h * 0.5);
  g.font = "bold 44px Arial";
  g.fillStyle = s.dmg.synchro[c.gear === -1 ? 0 : Math.max(0, c.gear)] >= 1 && c.gear !== 0 ? "#ef4444" : "#60a5fa";
  g.fillText(gearLabel(c.gear), cx, h * 0.7);
  // váltásjavaslat
  if (c.gear > 0 && c.gear < 6 && s.rpm > 6100) {
    g.fillStyle = "#22c55e";
    g.font = "bold 22px Arial";
    g.fillText(`▲ ${c.gear + 1}`, cx + 50, h * 0.7);
  }
  g.font = "15px Arial";
  g.fillStyle = "#94a3b8";
  g.fillText(`${(s.distance / 1000).toFixed(1)} km  ·  ${s.fuelL.toFixed(0)} L  ·  20 °C`, cx, h * 0.9);
  g.fillText(c.mode === "race" ? "RACE" : c.mode === "comfort" ? "COMFORT" : "NORMAL", cx, h * 0.08 + 8);
  // visszajelzők
  const t = performance.now() / 1000;
  const warns = warningLights(s, c, {
    indicatorL: (b.indicator === -1 || b.hazard) && blinkOn(t),
    indicatorR: (b.indicator === 1 || b.hazard) && blinkOn(t),
    lights: b.lights,
    anyDoor: b.doors.some(Boolean) || b.hood || b.tailgate,
  });
  let x = cx - 150;
  g.font = "bold 14px Arial";
  for (const wl of warns) {
    if (wl.flash && Math.floor(t * 3) % 2) {
      x += 37;
      continue;
    }
    if (wl.id === "indL" || wl.id === "indR") continue;
    g.fillStyle = COL[wl.color];
    g.fillText(wl.sym, x, h * 0.82 - 0);
    x += 37;
    if (x > cx + 160) break;
  }
  if ((b.indicator === -1 || b.hazard) && blinkOn(t)) {
    g.fillStyle = COL.green;
    g.font = "bold 28px Arial";
    g.fillText("◀", cx - 80, h * 0.1 + 10);
  }
  if ((b.indicator === 1 || b.hazard) && blinkOn(t)) {
    g.fillStyle = COL.green;
    g.font = "bold 28px Arial";
    g.fillText("▶", cx + 80, h * 0.1 + 10);
  }
  // hűtővíz + üzemanyag mini kijelző
  g.textAlign = "left";
  g.font = "13px Arial";
  g.fillStyle = s.tempC > 115 ? "#ef4444" : "#94a3b8";
  g.fillText(`${s.tempC.toFixed(0)} °C`, 18, h - 14);
  g.textAlign = "right";
  g.fillStyle = s.fuelL < 7 ? "#f59e0b" : "#94a3b8";
  g.fillText(`${Math.round((s.fuelL / ENGINE.tankL) * 100)}%`, w - 18, h - 14);
}

/** Discover Pro: „Performance Monitor” + hibatároló */
export function drawInfotainment(g: CanvasRenderingContext2D, w: number, h: number, s: SimState, c: Controls) {
  g.fillStyle = "#050a14";
  g.fillRect(0, 0, w, h);
  if (!c.ignition) return;
  g.fillStyle = "#0f172a";
  g.fillRect(0, 0, w, 34);
  g.fillStyle = "#e2e8f0";
  g.font = "bold 18px Arial";
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText("Performance Monitor", 14, 17);
  g.textAlign = "right";
  g.fillStyle = "#94a3b8";
  g.font = "16px Arial";
  g.fillText(`${c.mode.toUpperCase()}  ·  20 °C`, w - 14, 17);
  const box = (x: number, y: number, bw: number, bh: number, title: string, val: string, frac: number, color = "#2563eb") => {
    g.fillStyle = "#0b1323";
    g.fillRect(x, y, bw, bh);
    g.strokeStyle = "#1e293b";
    g.strokeRect(x, y, bw, bh);
    g.fillStyle = "#94a3b8";
    g.font = "14px Arial";
    g.textAlign = "left";
    g.fillText(title, x + 10, y + 16);
    g.fillStyle = "#f8fafc";
    g.font = "bold 30px Arial";
    g.fillText(val, x + 10, y + bh * 0.6);
    g.fillStyle = "#1e293b";
    g.fillRect(x + 10, y + bh - 16, bw - 20, 6);
    g.fillStyle = color;
    g.fillRect(x + 10, y + bh - 16, (bw - 20) * Math.max(0, Math.min(1, frac)), 6);
  };
  const bw = (w - 40) / 3;
  const bh = 104;
  box(10, 44, bw, bh, "Töltőnyomás", `${(s.boostKPa / 100).toFixed(2)} bar`, s.boostKPa / 130, "#38bdf8");
  box(20 + bw, 44, bw, bh, "Teljesítmény", `${Math.max(0, s.powerKW).toFixed(0)} kW`, s.powerKW / 221, "#22c55e");
  box(30 + bw * 2, 44, bw, bh, "Olajhőmérséklet", `${s.oilTempC.toFixed(0)} °C`, (s.oilTempC - 20) / 120, s.oilTempC > 130 ? "#ef4444" : "#f59e0b");
  box(10, 156, bw, bh, "Hűtőfolyadék", `${s.tempC.toFixed(0)} °C`, (s.tempC - 20) / 110, s.tempC > 112 ? "#ef4444" : "#2563eb");
  box(20 + bw, 156, bw, bh, "Nyomaték", `${Math.max(0, s.engineTorque).toFixed(0)} Nm`, s.engineTorque / 380, "#a78bfa");
  // G-erő
  const gx = 30 + bw * 2;
  g.fillStyle = "#0b1323";
  g.fillRect(gx, 156, bw, bh);
  g.strokeStyle = "#1e293b";
  g.strokeRect(gx, 156, bw, bh);
  const ccx = gx + bw / 2;
  const ccy = 156 + bh / 2 + 6;
  g.strokeStyle = "#334155";
  for (const rr of [14, 28, 40]) {
    g.beginPath();
    g.arc(ccx, ccy, rr, 0, Math.PI * 2);
    g.stroke();
  }
  const gl = s.latAccel / 9.81;
  const ga = s.accel / 9.81;
  g.fillStyle = "#f97316";
  g.beginPath();
  g.arc(ccx + Math.max(-1.2, Math.min(1.2, gl)) * 33, ccy - Math.max(-1.2, Math.min(1.2, ga)) * 33, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#94a3b8";
  g.font = "14px Arial";
  g.textAlign = "left";
  g.fillText(`G ${Math.hypot(gl, ga).toFixed(2)}`, gx + 10, 172);
  // hibatároló
  const log = s.dmg.log;
  g.textAlign = "left";
  g.font = "bold 15px Arial";
  g.fillStyle = log.length ? "#ef4444" : "#22c55e";
  g.fillText(log.length ? `Hibatároló: ${log.length} bejegyzés` : "Hibatároló: nincs hiba", 12, 280);
  g.font = "13px Arial";
  g.fillStyle = "#fca5a5";
  log.slice(-2).forEach((l, i) => g.fillText(`• ${l.text.slice(0, 74)}`, 12, 302 + i * 18));
}
