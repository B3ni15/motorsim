import type { Controls, SimState } from "./engine";

export interface Warn {
  id: string;
  label: string;
  /** rövid jel a műszerfalon */
  sym: string;
  color: "red" | "amber" | "green" | "blue" | "white";
  flash?: boolean;
}

/** A műszerfal visszajelző lámpái (valós Golf logika szerint, egyszerűsítve). */
export function warningLights(s: SimState, c: Controls, extra: { indicatorL: boolean; indicatorR: boolean; lights: boolean; anyDoor: boolean }): Warn[] {
  const out: Warn[] = [];
  if (!c.ignition) {
    if (s.epb === "applied" || s.epb === "applying") out.push({ id: "epb", label: "Rögzítőfék behúzva", sym: "(P)", color: "red" });
    return out;
  }
  const d = s.dmg;
  const engineFault = d.seized || d.valves.some((v) => v > 0.3) || d.pistons.some((v) => v > 0.3) || d.bearing > 0.35 || d.headGasket > 0.2 || d.turbo > 0.3;
  const misfiring = s.misfire.some(Boolean);
  if (s.batteryLamp || !s.running) out.push({ id: "bat", label: "Töltés", sym: "⎓", color: "red" });
  if (s.oilPressure < 0.6 || (s.running && d.bearing > 0.6)) out.push({ id: "oil", label: "Olajnyomás", sym: "OIL", color: "red", flash: s.running });
  if (s.tempC > 118 || s.coolantL < 4.5) out.push({ id: "cool", label: "Hűtőfolyadék", sym: "🌡", color: "red", flash: true });
  if (!s.running || engineFault || misfiring) out.push({ id: "mil", label: "Motorhiba (MIL)", sym: "⚙", color: "amber", flash: misfiring && s.running });
  if (!s.running || d.seized) out.push({ id: "epc", label: "EPC", sym: "EPC", color: "amber" });
  if (s.epb === "applied" || s.epb === "applying" || s.epb === "releasing") out.push({ id: "epb", label: "Rögzítőfék", sym: "(P)", color: "red" });
  if (s.brakeFluidC > 240 || s.brakeEff < 0.6) out.push({ id: "brk", label: "Fékrendszer", sym: "(!)", color: "red", flash: true });
  if (s.asr > 0.04 || s.epbDynamic) out.push({ id: "esc", label: "ESC/ASR beavatkozik", sym: "ESC", color: "amber", flash: true });
  if (!c.seatbelt) out.push({ id: "belt", label: "Biztonsági öv", sym: "ÖV", color: "red", flash: Math.abs(s.speed) > 6 });
  if (extra.anyDoor) out.push({ id: "door", label: "Ajtó nyitva", sym: "AJTÓ", color: "red" });
  if (s.fuelL < 7) out.push({ id: "fuel", label: "Tartalék üzemanyag", sym: "⛽", color: "amber" });
  if (s.clutchC > 260) out.push({ id: "clutch", label: "Kuplung túlmelegedett", sym: "KUPL", color: "amber", flash: true });
  if (c.autoHold) out.push({ id: "hold", label: "Auto Hold", sym: "A", color: s.holdActive ? "green" : "white" });
  if (extra.lights) out.push({ id: "low", label: "Tompított fény", sym: "◐", color: "green" });
  if (extra.indicatorL) out.push({ id: "indL", label: "Index bal", sym: "◀", color: "green" });
  if (extra.indicatorR) out.push({ id: "indR", label: "Index jobb", sym: "▶", color: "green" });
  return out;
}
