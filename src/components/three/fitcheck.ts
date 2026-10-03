/**
 * Illeszkedés-ellenőrzés: minden alkatrész (a karosszéria-héjon és a szándékosan kilógó
 * elemeken kívül) csúcspontjait az autó koordinátáiba transzformálja, és megnézi, hogy
 * a karosszérián belül vannak-e (tető / motorháztető alatt, oldalfalon belül, talaj felett).
 */
import * as THREE from "three";
import { CAR, bodyHalfWidthAt, bottomY, topY } from "./shape";

export interface FitIssue {
  path: string;
  worst: number;
  point: [number, number, number];
  reason: string;
}

/** Szándékosan a héjon kívül lévő elemek (név alapján) */
const ALLOWED = ["Mirror", "Wiper", "Tip", "Antenna", "Decal", "Wheel", "Smoke", "World", "Html", "BodyShell", "Flame"];

function pathOf(o: THREE.Object3D, root: THREE.Object3D): string {
  const names: string[] = [];
  let p: THREE.Object3D | null = o;
  while (p && p !== root) {
    if (p.name) names.push(p.name);
    p = p.parent;
  }
  return names.reverse().join(" › ") || o.type;
}

function allowed(o: THREE.Object3D, root: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = o;
  while (p && p !== root) {
    if (ALLOWED.some((a) => p!.name.startsWith(a))) return true;
    p = p.parent;
  }
  return false;
}

export function runFitCheck(carRoot: THREE.Object3D, tol = 0.012): { checked: number; issues: FitIssue[] } {
  carRoot.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(carRoot.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const issues: FitIssue[] = [];
  let checked = 0;
  carRoot.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || allowed(o, carRoot)) return;
    const pos = mesh.geometry?.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos) return;
    checked++;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 400));
    let worst = 0;
    let wp: [number, number, number] = [0, 0, 0];
    let why = "";
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const x = v.x;
      const y = v.y;
      const z = Math.abs(v.z);
      let over = 0;
      let r = "";
      if (x > CAR.xFront + tol) [over, r] = [x - CAR.xFront, "elöl kilóg"];
      else if (x < CAR.xRear - tol) [over, r] = [CAR.xRear - x, "hátul kilóg"];
      else if (y < 0.06) [over, r] = [0.06 - y, "túl közel a talajhoz"];
      else if (y > topY(x) + tol) [over, r] = [y - topY(x), "átlóg a tetőn / motorháztetőn"];
      else if (y > bottomY(x) + 0.02) {
        const hw = bodyHalfWidthAt(x, y);
        if (z > hw + tol) [over, r] = [z - hw, "kilóg oldalt (fal/üveg)"];
      }
      if (over > worst) {
        worst = over;
        wp = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
        why = r;
      }
    }
    if (worst > tol) issues.push({ path: pathOf(o, carRoot) + ` [${mesh.geometry.type}]`, worst: +worst.toFixed(3), point: wp, reason: why });
  });
  issues.sort((a, b) => b.worst - a.worst);
  return { checked, issues };
}
