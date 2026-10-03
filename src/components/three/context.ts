import { createContext, useContext, type RefObject } from "react";
import type { Controls, Gear, SimState } from "@/lib/engine";

/** Karosszéria / kényelmi funkciók állapota (nem fizika). */
export interface BodyCtl {
  /** ajtók: bal első, jobb első, bal hátsó, jobb hátsó */
  doors: [boolean, boolean, boolean, boolean];
  hood: boolean;
  tailgate: boolean;
  lights: boolean;
  /** irányjelző: -1 bal, 0 ki, 1 jobb */
  indicator: -1 | 0 | 1;
  hazard: boolean;
  horn: boolean;
  /** ablaktörlő: 0 ki, 1 lassú, 2 gyors */
  wiper: 0 | 1 | 2;
}

export const defaultBody = (): BodyCtl => ({
  doors: [false, false, false, false],
  hood: false,
  tailgate: false,
  lights: false,
  indicator: 0,
  hazard: false,
  horn: false,
  wiper: 0,
});

/** Váltókar helyzete a kulisszában: u = oldalirány (-2 = R sík, -1 = 1/2, 0 = 3/4, 1 = 5/6), v = előre(+1)/hátra(-1). */
export interface LeverState {
  u: number;
  v: number;
  dragging: boolean;
}

export type Interact =
  | { type: "shift"; gear: Gear }
  | { type: "startStop" }
  | { type: "epb"; dir: -1 | 0 | 1 }
  | { type: "autoHold" }
  | { type: "hazard" }
  | { type: "door"; index: number }
  | { type: "hood" }
  | { type: "tailgate" }
  | { type: "lights" }
  | { type: "seatbelt" }
  | { type: "mode" };

export interface SceneCtxValue {
  stateRef: RefObject<SimState>;
  controlsRef: RefObject<Controls>;
  bodyRef: RefObject<BodyCtl>;
  leverRef: RefObject<LeverState>;
  xray: boolean;
  onInteract: (a: Interact) => void;
  /** orbitvezérlő ki/be (pl. váltókar húzása közben) */
  setOrbitEnabled: (on: boolean) => void;
}

export const SceneCtx = createContext<SceneCtxValue | null>(null);

export function useScene(): SceneCtxValue {
  const v = useContext(SceneCtx);
  if (!v) throw new Error("SceneCtx hiányzik");
  return v;
}

/** Villogás ütemezés (irányjelző ~1.5 Hz) */
export function blinkOn(t: number): boolean {
  return t % 0.72 < 0.4;
}
