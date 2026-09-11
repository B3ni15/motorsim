import { describe, it, expect } from "vitest";
import { createState, defaultControls, stepFor, ENGINE, cylinderKinematics } from "./engine";

function warmRunning() {
  const s = createState({ tempC: 90, oilTempC: 90 });
  const c = defaultControls();
  c.ignition = true;
  c.starter = true;
  stepFor(s, c, 2);
  c.starter = false;
  stepFor(s, c, 3);
  return { s, c };
}

describe("motor", () => {
  it("nem indul gyújtás nélkül", () => {
    const s = createState();
    const c = defaultControls();
    c.starter = true;
    stepFor(s, c, 3);
    expect(s.running).toBe(false);
    expect(s.rpm).toBeGreaterThan(150);
    expect(s.rpm).toBeLessThan(450);
  });

  it("önindítóval beindul és melegen ~700 alapjáraton jár", () => {
    const { s } = warmRunning();
    expect(s.running).toBe(true);
    expect(s.rpm).toBeGreaterThan(640);
    expect(s.rpm).toBeLessThan(800);
  });

  it("hidegen is beindul, magasabb alapjárattal", () => {
    const s = createState({ tempC: 5 });
    const c = defaultControls();
    c.ignition = true;
    c.starter = true;
    stepFor(s, c, 3);
    c.starter = false;
    stepFor(s, c, 3);
    expect(s.running).toBe(true);
    expect(s.rpm).toBeGreaterThan(880);
  });

  it("gázra felpörög, határoló megfog", () => {
    const { s, c } = warmRunning();
    c.throttle = 1;
    stepFor(s, c, 4);
    expect(s.rpm).toBeGreaterThan(ENGINE.revLimitReset - 100);
    expect(s.rpm).toBeLessThan(ENGINE.revLimit + 150);
  });

  it("gáz nélkül kuplung feldobása 1-esben lefullasztja", () => {
    const { s, c } = warmRunning();
    c.gear = 1;
    c.clutch = 0;
    stepFor(s, c, 2);
    expect(s.running).toBe(false);
    expect(s.stalls).toBe(1);
  });

  it("félkuplunggal + gázzal elindul", () => {
    const { s, c } = warmRunning();
    c.gear = 1;
    c.throttle = 0.4;
    c.clutch = 0.7;
    stepFor(s, c, 1.5);
    c.clutch = 0.5;
    stepFor(s, c, 1.5);
    c.clutch = 0;
    stepFor(s, c, 3);
    expect(s.running).toBe(true);
    expect(s.speed * 3.6).toBeGreaterThan(10);
  });

  it("üres tank leállítja", () => {
    const { s, c } = warmRunning();
    s.fuelL = 0.0003;
    stepFor(s, c, 5);
    expect(s.running).toBe(false);
    expect(s.event).toContain("üzemanyag");
  });

  it("gyújtás levétele leállít", () => {
    const { s, c } = warmRunning();
    c.ignition = false;
    stepFor(s, c, 3);
    expect(s.running).toBe(false);
    expect(s.rpm).toBeLessThan(5);
  });

  it("melegszik, az olaj lassabban", () => {
    const s = createState({ tempC: 20 });
    const c = defaultControls();
    c.ignition = true;
    c.starter = true;
    stepFor(s, c, 2);
    c.starter = false;
    c.throttle = 0.15;
    stepFor(s, c, 120);
    expect(s.tempC).toBeGreaterThan(35);
    expect(s.oilTempC).toBeGreaterThan(22);
  });

  it("álló motor órák alatt hűl le", () => {
    const s = createState({ tempC: 90, oilTempC: 90 });
    const c = defaultControls();
    stepFor(s, c, 600, 0.01);
    expect(s.tempC).toBeGreaterThan(80);
  });

  it("tartós nagy terhelés kis sebességnél túlmelegít", () => {
    const { s, c } = warmRunning();
    // már gurul 2-esben ~4000 1/perc, fékkel terhelve (mint egy hosszú emelkedő)
    s.speed = 15.8;
    s.omega = (15.8 / 0.3) * 1.95 * 4.06;
    c.gear = 2;
    c.throttle = 1;
    c.clutch = 0;
    c.brake = 0.32;
    let peak = 0;
    let fanSeen = false;
    for (let i = 0; i < 60; i++) {
      stepFor(s, c, 10, 0.002);
      peak = Math.max(peak, s.tempC);
      fanSeen = fanSeen || s.fan;
    }
    expect(peak).toBeGreaterThan(105);
    expect(fanSeen).toBe(true);
  });

  it("melegen alapjáraton termosztát+ventilátor tartja az üzemi hőmérsékletet", () => {
    const { s, c } = warmRunning();
    stepFor(s, c, 1200, 0.002);
    expect(s.tempC).toBeGreaterThan(80);
    expect(s.tempC).toBeLessThan(105);
  });

  it("ECU: melegen ~14.7 AFR, hidegen dúsabb, levegőáram nő gázra", () => {
    const { s, c } = warmRunning();
    expect(s.afr).toBeGreaterThan(14);
    expect(s.afr).toBeLessThan(15.2);
    const idleAir = s.airGs;
    expect(s.mapKPa).toBeLessThan(50);
    c.throttle = 1;
    stepFor(s, c, 2);
    expect(s.airGs).toBeGreaterThan(idleAir * 5);
    expect(s.mapKPa).toBeGreaterThan(90);
    const cold = createState({ tempC: 0 });
    const cc = defaultControls();
    cc.ignition = true;
    cc.starter = true;
    stepFor(cold, cc, 3);
    cc.starter = false;
    stepFor(cold, cc, 2);
    expect(cold.running).toBe(true);
    expect(cold.afr).toBeLessThan(13.5);
  });

  it("dugattyú kinematika: FHP/AHP és gyújtási sorrend 1-5-3-6-2-4", () => {
    const k0 = cylinderKinematics(0, true);
    expect(k0).toHaveLength(6);
    expect(k0[0].piston).toBeCloseTo(0, 3);
    expect(k0[5].piston).toBeCloseTo(0, 3);
    expect(k0[0].stroke).toBe("munka");
    const deg = (d: number) => (d * Math.PI) / 180;
    expect(cylinderKinematics(deg(120), true)[4].stroke).toBe("munka"); // 5. henger
    expect(cylinderKinematics(deg(240), true)[2].stroke).toBe("munka"); // 3.
    expect(cylinderKinematics(deg(360), true)[5].stroke).toBe("munka"); // 6.
    expect(cylinderKinematics(deg(480), true)[1].stroke).toBe("munka"); // 2.
    expect(cylinderKinematics(deg(600), true)[3].stroke).toBe("munka"); // 4.
  });
});

describe("elektromos rendszer", () => {
  it("járó motornál a generátor tölt, álló motornál gyújtással merül", () => {
    const { s, c } = warmRunning();
    const soc0 = s.batterySoc;
    stepFor(s, c, 60, 0.002);
    expect(s.batterySoc).toBeGreaterThan(soc0);
    expect(s.batteryV).toBeGreaterThan(13.5);
    expect(s.altA).toBeGreaterThan(5);
    c.ignition = false;
    stepFor(s, c, 5);
    c.ignition = true;
    const soc1 = s.batterySoc;
    stepFor(s, c, 600, 0.01);
    expect(s.batterySoc).toBeLessThan(soc1);
    expect(s.batteryLamp).toBe(true);
    expect(s.batteryV).toBeLessThan(12.9);
  });

  it("lemerült akkumulátorral nem indul", () => {
    const s = createState({ tempC: 90, oilTempC: 90, batterySoc: 0.03 });
    const c = defaultControls();
    c.ignition = true;
    c.starter = true;
    stepFor(s, c, 4);
    expect(s.running).toBe(false);
    expect(s.rpm).toBeLessThan(150);
    expect(s.event).toContain("akkumulátor");
  });
});

describe("fékek", () => {
  it("nagy sebességről fékezve a tárcsák melegszenek, majd hűlnek", () => {
    const { s, c } = warmRunning();
    s.speed = 40; // 144 km/h
    c.gear = 0;
    c.brake = 1;
    stepFor(s, c, 6, 0.002);
    expect(s.brakeFrontC).toBeGreaterThan(120);
    const peak = s.brakeFrontC;
    c.brake = 0;
    s.speed = 25;
    stepFor(s, c, 120, 0.01);
    expect(s.brakeFrontC).toBeLessThan(peak);
  });

  it("forró tárcsa: fading", () => {
    const { s, c } = warmRunning();
    s.brakeFrontC = 650;
    s.brakeRearC = 600;
    s.speed = 30;
    c.brake = 1;
    stepFor(s, c, 0.5, 0.002);
    expect(s.brakeEff).toBeLessThan(0.7);
  });
});
