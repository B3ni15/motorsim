/**
 * Az EA888 motor 3D geometriája (méter, motor-helyi koordináták) – külön modulban,
 * hogy a mozgó alkatrészek ütközésmentességét egységtesztek ellenőrizhessék.
 * Főtengely a helyi X mentén, fel = +Y, szívóoldal = +Z.
 */
import { ENGINE } from "@/lib/engine";

export const N = ENGINE.cylinders;
export const R = ENGINE.strokeMm / 2000; // forgattyúsugár 0.0464
export const L = ENGINE.rodMm / 1000; // hajtókar 0.144
export const BORE = ENGINE.boreMm / 1000; // 0.0825
export const SPACING = 0.088;
export const CYL_X = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * SPACING);
export const COMP_H = 0.03; // dugattyúcsap → dugattyútető
export const PISTON_H = 0.055;
export const HEAD_Y = L + R + COMP_H + 0.004; // égéstér teteje (hengerfej alja)
export const LINER_BOTTOM = L - R - 0.012;
export const CAM_Y = HEAD_Y + 0.1;
export const CAM_Z = 0.05;
export const BLOCK_LEN = N * SPACING + 0.1;
export const FRONT_X = CYL_X[0] - 0.085;
/** szelepemelés (m) és a szeleptányér ülék-magassága, vastagsága */
export const VALVE_LIFT = 0.008;
export const VALVE_SEAT_Y = HEAD_Y + 0.0015;
export const VALVE_HEAD_T = 0.004;

/** Dugattyúcsap magassága a főtengely középpontjához képest (phase: 0..720°, 0 = FHP) */
export function pinHeight(phaseDeg: number): number {
  const th = (phaseDeg * Math.PI) / 180;
  return R * Math.cos(th) + Math.sqrt(L * L - R * R * Math.sin(th) ** 2);
}

export const pistonTop = (phaseDeg: number) => pinHeight(phaseDeg) + COMP_H;

/** A szeleptányér legalsó pontja adott emelésnél (0..1) */
export const valveBottom = (lift01: number) => VALVE_SEAT_Y - lift01 * VALVE_LIFT - VALVE_HEAD_T / 2;
