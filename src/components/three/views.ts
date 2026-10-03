/** Kamera-nézetek (az autóhoz rögzített koordinátákban, méter). */
import { CAR } from "./shape";

export type ViewName = "kulso" | "belso" | "uldozo" | "motorter" | "r-teljes" | "r-motor" | "r-hengerek" | "r-hajtas" | "r-fek" | "r-turbo";

export interface ViewDef {
  id: ViewName;
  label: string;
  /** kamera és célpont az autóhoz rögzített koordinátákban */
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  xray: boolean;
  /** belső nézet (szabad körbenézés a fej körül) */
  cockpit?: boolean;
  /** az autó mögött követő kamera */
  chase?: boolean;
  hood?: boolean;
}

const EYE = CAR.eye;

export const VIEWS: ViewDef[] = [
  { id: "kulso", label: "Külső", pos: [4.3, 1.45, 4.4], target: [0, 0.62, 0], fov: 38, xray: false },
  { id: "belso", label: "Belső (vezető)", pos: [EYE.x, EYE.y, EYE.z], target: [EYE.x + 0.08, EYE.y - 0.013, EYE.z + 0.003], fov: 68, xray: false, cockpit: true },
  { id: "uldozo", label: "Üldöző kamera", pos: [-6.4, 2.1, 0], target: [1.2, 0.75, 0], fov: 52, xray: false, chase: true },
  { id: "motorter", label: "Motortér", pos: [3.15, 2.05, 1.2], target: [1.35, 0.68, 0.0], fov: 42, xray: false, hood: true },
  { id: "r-teljes", label: "Teljes autó", pos: [3.8, 3.3, 5.2], target: [0, 0.45, 0], fov: 40, xray: true },
  { id: "r-motor", label: "Motor", pos: [2.75, 1.45, 1.75], target: [1.32, 0.62, 0.05], fov: 40, xray: true },
  { id: "r-hengerek", label: "Hengerek", pos: [1.78, 1.2, 0.62], target: [1.36, 0.6, 0.1], fov: 40, xray: true },
  { id: "r-hajtas", label: "Hajtáslánc (4MOTION)", pos: [1.6, 3.2, 3.4], target: [-0.1, 0.25, 0], fov: 40, xray: true },
  { id: "r-fek", label: "Fékek", pos: [1.95, 0.75, 2.05], target: [CAR.axleF, 0.33, 0.76], fov: 40, xray: true },
  { id: "r-turbo", label: "Turbó + kipufogó", pos: [0.35, 1.3, 1.35], target: [0.95, 0.42, 0.0], fov: 44, xray: true },
];

export const viewDef = (id: ViewName) => VIEWS.find((v) => v.id === id) ?? VIEWS[0];
