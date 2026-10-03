/**
 * Karosszéria-anyag: egyetlen paraméteres héj, amelyen a shader objektumtérbeli pozíció és normál
 * alapján dönti el, mi festék, üveg, lámpa, rács stb. – így éles határvonalak lesznek.
 * Minden nyíló elem (ajtók, motorháztető, csomagtérajtó) ugyanazt a geometriát használja,
 * a shader a többi elemhez tartozó részeket eldobja.
 */
import * as THREE from "three";
import { CAR, CUT, PARTS, SHAPE_GLSL, topY, beltY, type PartId } from "./shape";

export const PAINT = "#2a5ec2"; // Lapiz Blue

/** JS-oldali elem-hozzárendelés – egyezik a GLSL partOf()-fal. */
export function partOf(x: number, y: number, z: number, nx: number, ny: number, nz: number): PartId {
  const side = Math.abs(z);
  if (x > CUT.hoodRear && x < CUT.hoodFront && side < CUT.hoodSide && y > 0.62 && ny > 0.35) return "hood";
  if (x < CUT.tailTop && y > CUT.tailLow && side < CUT.tailSide && nx < 0.35) return "tailgate";
  if (side > 0.45 && Math.abs(nz) > 0.42 && y > CUT.sill && y < topY(x) - 0.012) {
    if (x < CUT.doorFront && x > CUT.doorMid) return z < 0 ? "doorFL" : "doorFR";
    const dx = x - CAR.axleR;
    const dy = y - (CAR.wheelR + 0.01);
    if (x <= CUT.doorMid && x > CUT.doorRear && Math.hypot(dx, dy) > CAR.archR + 0.07) return z < 0 ? "doorRL" : "doorRR";
  }
  return "body";
}

export const PART_INDEX: Record<PartId, number> = Object.fromEntries(PARTS.map((p, i) => [p, i])) as Record<PartId, number>;

const CLASSIFY_GLSL = /* glsl */ `
${SHAPE_GLSL}
#define R_PAINT 0
#define R_GLASS 1
#define R_BLACK 2
#define R_MATTE 3
#define R_CHROME 4
#define R_HEAD 5
#define R_TAIL 6
#define R_REFL 7
#define R_HONEY 8
#define R_UNDER 9
#define R_SEAM 10
#define R_DRL 11
#define R_PROJ 12
#define R_INDF 13
#define R_INDR 14
#define R_REV 15
#define R_HBRAKE 16
#define R_SATIN 17

int partOf(vec3 p, vec3 n){
  float side = abs(p.z);
  if (p.x > ${CUT.hoodRear.toFixed(3)} && p.x < ${CUT.hoodFront.toFixed(3)} && side < ${CUT.hoodSide.toFixed(3)} && p.y > 0.62 && n.y > 0.35) return 1;
  if (p.x < ${CUT.tailTop.toFixed(3)} && p.y > ${CUT.tailLow.toFixed(3)} && side < ${CUT.tailSide.toFixed(3)} && n.x < 0.35) return 6;
  if (side > 0.45 && abs(n.z) > 0.42 && p.y > ${CUT.sill.toFixed(3)} && p.y < topY(p.x) - 0.012) {
    if (p.x < ${CUT.doorFront.toFixed(3)} && p.x > ${CUT.doorMid.toFixed(3)}) return p.z < 0.0 ? 2 : 3;
    vec2 d = vec2(p.x - (${CAR.axleR.toFixed(4)}), p.y - ${(CAR.wheelR + 0.01).toFixed(4)});
    if (p.x <= ${CUT.doorMid.toFixed(3)} && p.x > ${CUT.doorRear.toFixed(3)} && length(d) > ${(CAR.archR + 0.07).toFixed(4)}) return p.z < 0.0 ? 4 : 5;
  }
  return 0;
}

float dloRear(float y){ return mix(-1.42, -1.14, clamp((y - 1.04) / 0.30, 0.0, 1.0)); }

int surf(vec3 p, vec3 n){
  float x = p.x, y = p.y, side = abs(p.z);
  float W = halfWidth(x);
  float belt = beltY(x);
  float top = topY(x);
  // alváz
  if (n.y < -0.55) return R_UNDER;
  // küszöb alsó része
  if (abs(n.z) > 0.3 && y < 0.205 && x < 1.95 && x > -1.85) return R_MATTE;
  // --- üvegek ---
  bool cabin = y > belt + 0.004;
  if (cabin && x > -0.12 && x < 0.80 && n.y > 0.3 && side < roofW(x) - 0.045) {
    if (side > roofW(x) - 0.075 || y < belt + 0.035) return R_BLACK; // szélvédő fekete kerete
    return R_GLASS;
  }
  if (cabin && abs(n.z) > 0.5 && x < 0.745 && x > dloRear(y) && y < top - 0.058) {
    float edge = min(min(y - belt, top - 0.058 - y), min(0.745 - x, x - dloRear(y)));
    if (x < -0.31 && x > -0.415) return R_BLACK; // B-oszlop
    if (x > 0.62 && y < belt + 0.065) return R_BLACK; // tükör-háromszög
    if (edge < 0.012) return R_BLACK;
    return R_GLASS;
  }
  if (x < -1.74 && y > 1.005 && side < roofW(x) - 0.055 && n.x < -0.25) {
    if (y > 1.33 || side > roofW(x) - 0.085 || y < 1.03) return R_BLACK;
    return R_GLASS;
  }
  // harmadik féklámpa a spoilerben
  if (x < -1.73 && y > 1.365 && side < 0.16 && n.x < 0.2) return R_HBRAKE;
  // --- elöl ---
  if (x > 1.9) {
    float t = clamp((side - 0.38) / 0.42, 0.0, 1.0);
    float lo = 0.578 + 0.045 * t;
    float hi = 0.738 - 0.012 * t;
    bool facingOut = n.x > 0.1 || side > W - 0.16;
    if (side > 0.375 && y > lo && y < hi && facingOut) {
      if (y < lo + 0.012 || side > W - 0.05 && y < lo + 0.03) return R_DRL;
      if (y > hi - 0.016 && side < 0.6) return R_INDF;
      if (length(vec2(side - 0.66, y - 0.665)) < 0.042 || length(vec2(side - 0.53, y - 0.66)) < 0.03) return R_PROJ;
      if (y > hi - 0.008 || y < lo + 0.016) return R_CHROME;
      return R_HEAD;
    }
    if (x > 2.04) {
      // felső hűtőrács + krómcsík
      if (abs(y - 0.618) < 0.0055 && side < 0.43) return R_CHROME;
      if (side < 0.395 && y > 0.575 && y < 0.705) return R_BLACK;
      // alsó légbeömlők
      if (side < 0.34 && y > 0.235 && y < 0.395 && !(side < 0.27 && y > 0.3 && y < 0.42)) return R_HONEY;
      float sTop = 0.45 - 0.07 * clamp((side - 0.46) / 0.3, 0.0, 1.0);
      if (side > 0.46 && side < 0.78 && y > 0.215 + 0.03 * clamp((side - 0.46) / 0.3, 0.0, 1.0) && y < sTop) {
        if (abs(y - 0.33) < 0.006 || abs(y - 0.28) < 0.005) return R_SATIN;
        return R_HONEY;
      }
      if (y < 0.2) return R_BLACK;
    }
  }
  // --- hátul ---
  if (x < -1.86) {
    float t = clamp((side - 0.38) / 0.48, 0.0, 1.0);
    float lo = 0.875 - 0.02 * t;
    float hi = 0.99 + 0.012 * t;
    bool facingBack = n.x < -0.15 || side > W - 0.13;
    if (side > 0.37 && y > lo && y < hi && facingBack) {
      if (y > lo + 0.012 && y < lo + 0.032 && side > 0.42) return R_INDR;
      if (side < 0.5 && side > 0.4 && y < lo + 0.034 && y > lo + 0.006) return R_REV;
      return R_TAIL;
    }
    if (y > 0.395 && y < 0.445 && side > 0.62 && side < 0.8 && facingBack) return R_REFL;
    if (y < 0.37 && n.x < 0.2) return R_BLACK; // diffúzor
    if (y > 0.7 && y < 0.83 && side < 0.27 && n.x < -0.3) return R_MATTE; // rendszámtábla-mélyedés
  }
  // --- illesztések ---
  float seam = 0.0028;
  if (abs(n.z) > 0.3 && y > ${CUT.sill.toFixed(3)} - 0.01 && y < top - 0.01) {
    if (abs(x - ${CUT.doorFront.toFixed(3)}) < seam || abs(x - ${CUT.doorMid.toFixed(3)}) < seam && y < belt) return R_SEAM;
    vec2 d = vec2(x - (${CAR.axleR.toFixed(4)}), y - ${(CAR.wheelR + 0.01).toFixed(4)});
    if (x < ${CUT.doorMid.toFixed(3)} && x > ${CUT.doorRear.toFixed(3)} - 0.01 && (abs(length(d) - ${(CAR.archR + 0.07).toFixed(4)}) < seam || abs(x - ${CUT.doorRear.toFixed(3)}) < seam && length(d) > ${(CAR.archR + 0.07).toFixed(4)})) return R_SEAM;
    if (abs(y - ${CUT.sill.toFixed(3)}) < seam && x < ${CUT.doorFront.toFixed(3)} && x > ${CUT.doorRear.toFixed(3)}) return R_SEAM;
    // ajtókilincsek mélyedése
    if (y > 0.862 && y < 0.871 && (x > -0.3 && x < -0.16 || x > -1.03 && x < -0.9)) return R_SEAM;
    // tanksapka (jobb hátul)
    if (p.z > 0.0 && abs(length(vec2(x + 1.56, y - 0.93)) - 0.072) < seam) return R_SEAM;
  }
  if (n.y > 0.35 && y > 0.62) {
    if (abs(x - ${CUT.hoodRear.toFixed(3)}) < seam * 1.4 && side < ${CUT.hoodSide.toFixed(3)}) return R_SEAM;
    if (abs(side - ${CUT.hoodSide.toFixed(3)}) < seam && x > ${CUT.hoodRear.toFixed(3)} && x < ${CUT.hoodFront.toFixed(3)}) return R_SEAM;
  }
  if (x < ${CUT.tailTop.toFixed(3)} + 0.004 && n.x < 0.35) {
    if (abs(side - ${CUT.tailSide.toFixed(3)}) < seam && y > ${CUT.tailLow.toFixed(3)}) return R_SEAM;
    if (abs(y - ${CUT.tailLow.toFixed(3)}) < seam && side < ${CUT.tailSide.toFixed(3)}) return R_SEAM;
  }
  return R_PAINT;
}
`;

export interface BodyUniforms {
  uDRL: { value: number };
  uLow: { value: number };
  uTail: { value: number };
  uBrake: { value: number };
  uRev: { value: number };
  uIndL: { value: number };
  uIndR: { value: number };
  uIndPhase: { value: number };
  uXray: { value: number };
  uPaint: { value: THREE.Color };
}

export function createBodyUniforms(): BodyUniforms {
  return {
    uDRL: { value: 0 },
    uLow: { value: 0 },
    uTail: { value: 0 },
    uBrake: { value: 0 },
    uRev: { value: 0 },
    uIndL: { value: 0 },
    uIndR: { value: 0 },
    uIndPhase: { value: 0 },
    uXray: { value: 0 },
    uPaint: { value: new THREE.Color(PAINT) },
  };
}

export function createBodyMaterial(part: PartId, glass: boolean, U: BodyUniforms): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 0.5,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
    transparent: glass,
    depthWrite: !glass,
    envMapIntensity: 1.1,
  });
  const partIdx = PART_INDEX[part];
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjP;\nvarying vec3 vObjN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjP = position;\nvObjN = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vObjP;
varying vec3 vObjN;
uniform float uDRL, uLow, uTail, uBrake, uRev, uIndL, uIndR, uIndPhase, uXray;
uniform vec3 uPaint;
${CLASSIFY_GLSL}
int gReg;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`,
      )
      .replace(
        "void main() {",
        `void main() {
  vec3 oN = normalize(vObjN);
  if (partOf(vObjP, oN) != ${partIdx}) discard;
  {
    // kerékívek kivágása
    float sd = abs(vObjP.z);
    vec2 a1 = vec2(vObjP.x - (${CAR.axleF.toFixed(4)}), vObjP.y - ${(CAR.wheelR + 0.01).toFixed(4)});
    vec2 a2 = vec2(vObjP.x - (${CAR.axleR.toFixed(4)}), vObjP.y - ${(CAR.wheelR + 0.01).toFixed(4)});
    if (sd > 0.56 && (length(a1) < ${CAR.archR.toFixed(4)} || length(a2) < ${CAR.archR.toFixed(4)})) discard;
  }
  gReg = surf(vObjP, oN);
  ${glass ? "if (gReg != R_GLASS) discard;" : "if (gReg == R_GLASS) discard;"}
`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  {
    vec3 c = uPaint;
    float side = abs(vObjP.z);
    if (gReg == R_GLASS) c = vec3(0.05, 0.07, 0.09);
    else if (gReg == R_BLACK) c = vec3(0.015);
    else if (gReg == R_MATTE) c = vec3(0.03);
    else if (gReg == R_CHROME) c = vec3(0.9);
    else if (gReg == R_SATIN) c = vec3(0.62);
    else if (gReg == R_HEAD) c = vec3(0.12, 0.13, 0.15);
    else if (gReg == R_PROJ) c = vec3(0.75);
    else if (gReg == R_DRL) c = vec3(0.85);
    else if (gReg == R_INDF) c = vec3(0.55, 0.45, 0.3);
    else if (gReg == R_TAIL || gReg == R_HBRAKE) c = vec3(0.32, 0.01, 0.02);
    else if (gReg == R_INDR) c = vec3(0.35, 0.05, 0.03);
    else if (gReg == R_REV) c = vec3(0.22, 0.2, 0.2);
    else if (gReg == R_REFL) c = vec3(0.45, 0.02, 0.02);
    else if (gReg == R_HONEY) {
      vec2 hp = vec2(vObjP.z * 60.0, vObjP.y * 69.0);
      hp.x += mod(floor(hp.y), 2.0) * 0.5;
      vec2 f = fract(hp) - 0.5;
      c = vec3(0.008 + 0.05 * step(0.36, max(abs(f.x), abs(f.y))));
    }
    else if (gReg == R_UNDER) c = vec3(0.04);
    else if (gReg == R_SEAM) c = vec3(0.0);
    if (!gl_FrontFacing) c = vec3(0.055, 0.055, 0.06); // belső burkolat
    diffuseColor.rgb = c;
    if (gReg == R_GLASS) diffuseColor.a = gl_FrontFacing ? 0.42 : 0.18;
  }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
  if (gReg == R_MATTE || gReg == R_HONEY || gReg == R_UNDER || gReg == R_SEAM) roughnessFactor = 0.85;
  else if (gReg == R_CHROME) roughnessFactor = 0.08;
  else if (gReg == R_SATIN) roughnessFactor = 0.3;
  else if (gReg == R_GLASS) roughnessFactor = 0.02;
  else if (gReg == R_PAINT) roughnessFactor = 0.32;
  else roughnessFactor = 0.18;
  if (!gl_FrontFacing) roughnessFactor = 0.95;`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
  if (gReg == R_PAINT) metalnessFactor = 0.55;
  else if (gReg == R_CHROME || gReg == R_SATIN || gReg == R_PROJ) metalnessFactor = 1.0;
  else if (gReg == R_HEAD) metalnessFactor = 0.7;
  else metalnessFactor = 0.0;
  if (!gl_FrontFacing) metalnessFactor = 0.0;`,
      )
      .replace(
        "#include <clearcoat_normal_fragment_begin>",
        `#include <clearcoat_normal_fragment_begin>`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
  if (gReg == R_PAINT && gl_FrontFacing && abs(oN.z) > 0.5) {
    // „tornado” élvonal az ajtókilincsek magasságában
    vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float dyc = vObjP.y - (0.872 + 0.012 * clamp((0.5 - vObjP.x) / 2.5, -1.0, 1.0));
    float k = dyc > 0.0 ? 0.32 * smoothstep(0.11, 0.0, dyc) : -0.1 * smoothstep(-0.08, 0.0, dyc);
    normal = normalize(normal + upV * k);
  }
  if (uXray > 0.5) {
    float fr = 1.0 - abs(dot(normal, normalize(vViewPosition)));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.65, 0.9), 0.5);
    diffuseColor.a = ${glass ? "0.04 + 0.25 * pow(fr, 3.0)" : "0.025 + 0.45 * pow(fr, 3.0)"};
  }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
  {
    vec3 e = vec3(0.0);
    float side = abs(vObjP.z);
    float ind = vObjP.z < 0.0 ? uIndL : uIndR;
    if (gReg == R_DRL) e = vec3(1.0, 0.98, 0.95) * (uDRL * 2.5 + uLow * 0.6);
    else if (gReg == R_PROJ) e = vec3(0.95, 0.97, 1.0) * uLow * 4.0;
    else if (gReg == R_INDF) e = vec3(1.0, 0.45, 0.0) * ind * 4.0;
    else if (gReg == R_TAIL) {
      float guide = step(0.5, fract((vObjP.y - 0.86) * 55.0));
      e = vec3(0.9, 0.0, 0.01) * (uTail * (0.18 + 0.4 * guide) + uBrake * 1.1);
    }
    else if (gReg == R_HBRAKE) e = vec3(0.9, 0.0, 0.01) * uBrake * 2.0;
    else if (gReg == R_INDR) {
      float prog = clamp((side - 0.42) / 0.44, 0.0, 1.0);
      float on = ind > 0.5 && prog < uIndPhase ? 1.0 : 0.0;
      e = vec3(1.0, 0.38, 0.0) * on * 3.0 + vec3(0.9, 0.0, 0.01) * (uTail * 0.2 + uBrake * 1.0);
    }
    else if (gReg == R_REV) e = vec3(1.0) * uRev * 3.0;
    if (!gl_FrontFacing) e *= 0.0;
    totalEmissiveRadiance = e;
  }`,
      );
  };
  m.customProgramCacheKey = () => `golfbody-${part}-${glass ? "g" : "o"}`;
  return m;
}

/** Az adott elemhez tartozó háromszögek (amelyeknek bármely csúcsa vagy súlypontja az elembe esik). */
export function partIndex(geom: THREE.BufferGeometry, part: PartId): THREE.BufferAttribute {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const nor = geom.getAttribute("normal") as THREE.BufferAttribute;
  const index = geom.getIndex()!;
  const out: number[] = [];
  const pv = (i: number) => partOf(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i));
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    if (pv(a) === part || pv(b) === part || pv(c) === part) {
      out.push(a, b, c);
      continue;
    }
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const nx = (nor.getX(a) + nor.getX(b) + nor.getX(c)) / 3;
    const ny = (nor.getY(a) + nor.getY(b) + nor.getY(c)) / 3;
    const nz = (nor.getZ(a) + nor.getZ(b) + nor.getZ(c)) / 3;
    if (partOf(cx, cy, cz, nx, ny, nz) === part) out.push(a, b, c);
  }
  return new THREE.BufferAttribute(new Uint32Array(out), 1);
}

export { beltY };
