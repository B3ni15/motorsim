import { describe, it, expect } from "vitest";
import { cylinderKinematics, DRIVETRAIN } from "@/lib/engine";
import { BORE, CYL_X, HEAD_Y, L, LINER_BOTTOM, PISTON_H, R, SPACING, pinHeight, pistonTop, valveBottom } from "./engineGeom";
import { CAR, bodyHalfWidthAt, halfWidth, topY, bottomY } from "./shape";

describe("motor-geometria: mozgó alkatrészek ütközésmentesek", () => {
  it("a dugattyú minden főtengely-szögnél a szelepek alatt marad (szelepátfedésnél is)", () => {
    let minGap = Infinity;
    for (let deg = 0; deg < 720; deg += 0.5) {
      const k = cylinderKinematics((deg * Math.PI) / 180, true);
      for (const c of k) {
        const top = pistonTop(c.phase);
        const gap = Math.min(valveBottom(c.intake), valveBottom(c.exhaust)) - top;
        minGap = Math.min(minGap, gap);
      }
    }
    expect(minGap).toBeGreaterThan(0.0005);
  });

  it("FHP-ban a dugattyú nem éri el a hengerfejet, AHP-ban a palást a hengerben marad", () => {
    expect(pistonTop(0)).toBeLessThan(HEAD_Y);
    expect(HEAD_Y - pistonTop(0)).toBeLessThan(0.006); // kis égéstér (9,3:1)
    expect(pistonTop(180) - PISTON_H).toBeGreaterThan(LINER_BOTTOM - 0.03);
    // löket = 2R
    expect(pinHeight(0) - pinHeight(180)).toBeCloseTo(2 * R, 6);
  });

  it("a hajtókar hossza állandó, a forgattyú nem ütközik a hengerfallal", () => {
    for (let deg = 0; deg < 360; deg += 5) {
      const th = (deg * Math.PI) / 180;
      const py = R * Math.cos(th);
      const pz = R * Math.sin(th);
      const wy = pinHeight(deg);
      expect(Math.hypot(wy - py, pz)).toBeCloseTo(L, 9);
    }
  });

  it("a hengerek nem fednek át (furat < hengerosztás)", () => {
    expect(BORE).toBeLessThan(SPACING - 0.004);
    expect(CYL_X[1] - CYL_X[0]).toBeCloseTo(SPACING, 9);
  });
});

describe("karosszéria és kerekek illeszkedése", () => {
  it("a gumik a karosszéria szélességén belül vannak, a kerékívben marad hely", () => {
    const tyreHalf = 0.235 / 2 + 0.004;
    for (const track of [DRIVETRAIN.trackFrontM, DRIVETRAIN.trackRearM]) {
      const outer = track / 2 + tyreHalf;
      expect(outer).toBeLessThan(halfWidth(CAR.axleF));
      expect(outer).toBeLessThan(bodyHalfWidthAt(CAR.axleF, CAR.wheelR) + 0.002);
    }
    const archTop = CAR.wheelR + 0.01 + CAR.archR;
    expect(archTop - 2 * CAR.wheelR).toBeGreaterThan(0.02); // gumi teteje és a kerékív között
    expect(archTop - 2 * CAR.wheelR).toBeLessThan(0.07); // de ne legyen „terepjáró” rés
  });

  it("valós méretek: hossz 4,28 m, szélesség 1,80 m, magasság ~1,44 m, tengelytáv 2,63 m", () => {
    expect(CAR.xFront - CAR.xRear).toBeCloseTo(4.277, 2);
    expect(CAR.halfW * 2).toBeCloseTo(1.799, 2);
    let maxTop = 0;
    for (let x = CAR.xRear; x < CAR.xFront; x += 0.01) maxTop = Math.max(maxTop, topY(x));
    expect(maxTop).toBeGreaterThan(1.42);
    expect(maxTop).toBeLessThan(1.46);
    expect(CAR.axleF - CAR.axleR).toBeCloseTo(2.63, 3);
    expect(bottomY(0)).toBeGreaterThan(0.1); // hasmagasság
  });
});
