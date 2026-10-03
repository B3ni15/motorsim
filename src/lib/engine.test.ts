import { describe, it, expect } from "vitest";
import {
  createState,
  defaultControls,
  stepFor,
  step,
  ENGINE,
  DRIVETRAIN,
  cylinderKinematics,
  pressStartStop,
  shift,
  gearUsable,
  rpmAtSpeed,
  type Controls,
  type SimState,
} from "./engine";

function warmRunning() {
  const s = createState({ tempC: 90, oilTempC: 90 });
  const c = defaultControls();
  c.clutch = 1;
  pressStartStop(s, c);
  stepFor(s, c, 3);
  c.clutch = 0;
  stepFor(s, c, 3);
  return { s, c };
}

/** Egyszerű „sofőr”: félkuplungos elindulás 1-esben ~2500 1/perccel. */
function launch(s: SimState, c: Controls, seconds = 4) {
  c.clutch = 1;
  stepFor(s, c, 0.3);
  shift(s, c, 1);
  const t0 = s.t;
  while (s.t - t0 < seconds) {
    const tt = s.t - t0;
    c.clutch = Math.max(0, 0.82 - tt * 0.35);
    c.throttle = s.rpm < 2500 ? 0.45 : 0.15;
    stepFor(s, c, 0.01);
  }
}

describe("motor (EA888 2.0 TSI)", () => {
  it("nem indul gyújtás nélkül, az önindító ~250 1/perccel forgat", () => {
    const s = createState();
    const c = defaultControls();
    c.starter = true;
    stepFor(s, c, 3);
    expect(s.running).toBe(false);
    expect(s.rpm).toBeGreaterThan(150);
    expect(s.rpm).toBeLessThan(400);
  });

  it("Start/Stop kuplunggal beindít és melegen ~750 alapjáraton jár", () => {
    const { s } = warmRunning();
    expect(s.running).toBe(true);
    expect(s.rpm).toBeGreaterThan(690);
    expect(s.rpm).toBeLessThan(820);
  });

  it("Start/Stop kuplung nélkül csak a gyújtást kapcsolja, járó motort leállít", () => {
    const s = createState({ tempC: 90, oilTempC: 90 });
    const c = defaultControls();
    pressStartStop(s, c);
    stepFor(s, c, 2);
    expect(c.ignition).toBe(true);
    expect(s.running).toBe(false);
    c.clutch = 1;
    pressStartStop(s, c); // kuplunggal: indítás
    stepFor(s, c, 3);
    expect(s.running).toBe(true);
    pressStartStop(s, c);
    stepFor(s, c, 3);
    expect(s.running).toBe(false);
    expect(s.rpm).toBeLessThan(5);
  });

  it("hidegen is beindul, magasabb alapjárattal", () => {
    const s = createState({ tempC: 5, oilTempC: 5 });
    const c = defaultControls();
    c.clutch = 1;
    pressStartStop(s, c);
    stepFor(s, c, 4);
    stepFor(s, c, 3);
    expect(s.running).toBe(true);
    expect(s.rpm).toBeGreaterThan(1000);
  });

  it("gázra felpörög, a turbó töltőnyomást épít, a határoló megfog", () => {
    const { s, c } = warmRunning();
    c.throttle = 1;
    stepFor(s, c, 3);
    expect(s.rpm).toBeGreaterThan(ENGINE.revLimitReset - 150);
    expect(s.rpm).toBeLessThan(ENGINE.revLimit + 150);
    expect(s.boostKPa).toBeGreaterThan(90);
    expect(s.boostKPa).toBeLessThan(ENGINE.maxBoostKPa + 5);
  });

  it("turbólyuk: a töltőnyomás késve épül fel, gázelvételnél lefúj a diverter szelep", () => {
    const { s, c } = warmRunning();
    // 4. fokozatban 1800 1/perc körül gurul
    s.speed = 48 / 3.6;
    s.omega = (rpmAtSpeed(4, s.speed) * 2 * Math.PI) / 60;
    s.epb = "released";
    shift(s, c, 0);
    c.clutch = 1;
    shift(s, c, 4);
    c.clutch = 0;
    c.throttle = 0.15;
    stepFor(s, c, 2);
    c.throttle = 1;
    stepFor(s, c, 0.15);
    const early = s.boostKPa;
    stepFor(s, c, 2.5);
    expect(s.boostKPa).toBeGreaterThan(early + 30);
    const bov = s.bovCount;
    c.throttle = 0;
    stepFor(s, c, 0.2);
    expect(s.bovCount).toBe(bov + 1);
    expect(s.boostKPa).toBeLessThan(10);
  });

  it("gáz nélkül kuplung feldobása 1-esben lefullasztja", () => {
    const { s, c } = warmRunning();
    c.clutch = 1;
    shift(s, c, 1);
    c.clutch = 0;
    stepFor(s, c, 2);
    expect(s.running).toBe(false);
    expect(s.stalls).toBe(1);
  });

  it("félkuplunggal + gázzal elindul, az EPB magától kiold (öv bekötve)", () => {
    const { s, c } = warmRunning();
    expect(s.epb).toBe("applied");
    launch(s, c);
    expect(s.running).toBe(true);
    expect(s.epb).toBe("released");
    expect(s.speed * 3.6).toBeGreaterThan(10);
  });

  it("öv nélkül az EPB nem old ki, az autó nem mozdul", () => {
    const { s, c } = warmRunning();
    c.seatbelt = false;
    launch(s, c, 3);
    expect(s.epb).toBe("applied");
    expect(Math.abs(s.speed)).toBeLessThan(0.5);
    expect(s.event).toMatch(/öv|lefulladt|kuplung/);
  });

  it("EPB kézi oldás csak fékpedállal, behúzás álló helyzetben", () => {
    const { s, c } = warmRunning();
    c.epbSwitch = -1;
    stepFor(s, c, 1);
    expect(s.epb).toBe("applied");
    c.brake = 1;
    stepFor(s, c, 1);
    expect(s.epb).toBe("released");
    c.epbSwitch = 1;
    stepFor(s, c, 1.2);
    expect(s.epb).toBe("applied");
  });

  it("EPB menet közben tartva: vészfékezés 100 km/h-ról, majd behúzva marad", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 100 / 3.6;
    c.epbSwitch = 1;
    stepFor(s, c, 2);
    expect(s.epbDynamic).toBe(true);
    expect(s.speed * 3.6).toBeLessThan(60);
    stepFor(s, c, 4);
    expect(s.speed).toBe(0);
    stepFor(s, c, 1.5);
    expect(s.epb).toBe("applied");
  });

  it("hátramenetben hátrafelé megy", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    c.clutch = 1;
    expect(shift(s, c, -1).ok).toBe(true);
    const t0 = s.t;
    while (s.t - t0 < 4) {
      c.clutch = Math.max(0, 0.82 - (s.t - t0) * 0.35);
      c.throttle = s.rpm < 2000 ? 0.4 : 0.1;
      stepFor(s, c, 0.01);
    }
    expect(s.speed).toBeLessThan(-1);
    expect(s.running).toBe(true);
  });

  it("üres tank leállítja, gyújtás levétele leállít", () => {
    const { s, c } = warmRunning();
    s.fuelL = 0.0003;
    stepFor(s, c, 5);
    expect(s.running).toBe(false);
    expect(s.event).toContain("üzemanyag");
    const w = warmRunning();
    w.c.ignition = false;
    stepFor(w.s, w.c, 3);
    expect(w.s.running).toBe(false);
  });

  it("melegszik, álló motor lassan hűl, alapjáraton tartja az üzemi hőmérsékletet", () => {
    const s = createState({ tempC: 20 });
    const c = defaultControls();
    c.clutch = 1;
    pressStartStop(s, c);
    stepFor(s, c, 3);
    c.throttle = 0.15;
    stepFor(s, c, 120);
    expect(s.tempC).toBeGreaterThan(35);
    const hot = createState({ tempC: 90, oilTempC: 90 });
    stepFor(hot, defaultControls(), 600, 0.01);
    expect(hot.tempC).toBeGreaterThan(78);
    const { s: w, c: wc } = warmRunning();
    stepFor(w, wc, 1200, 0.002);
    expect(w.tempC).toBeGreaterThan(80);
    expect(w.tempC).toBeLessThan(108);
  });

  it("ECU: melegen ~14.7 AFR, hidegen dúsabb, teljes terhelésen dúsít", () => {
    const { s, c } = warmRunning();
    expect(s.afr).toBeGreaterThan(14);
    expect(s.afr).toBeLessThan(15.2);
    expect(s.mapKPa).toBeLessThan(50);
    const cold = createState({ tempC: 0 });
    const cc = defaultControls();
    cc.clutch = 1;
    pressStartStop(cold, cc);
    stepFor(cold, cc, 5);
    expect(cold.running).toBe(true);
    expect(cold.afr).toBeLessThan(13.5);
    // teljes terhelés 3-asban: dúsítás az alkatrészvédelemért
    s.epb = "released";
    s.speed = 60 / 3.6;
    s.omega = (rpmAtSpeed(3, s.speed) * 2 * Math.PI) / 60;
    c.clutch = 1;
    shift(s, c, 3);
    c.clutch = 0;
    c.throttle = 1;
    stepFor(s, c, 2.5);
    expect(s.boostKPa).toBeGreaterThan(80);
    expect(s.afr).toBeLessThan(13);
  });

  it("dugattyú kinematika: FHP/AHP és gyújtási sorrend 1-3-4-2", () => {
    const k0 = cylinderKinematics(0, true);
    expect(k0).toHaveLength(4);
    expect(k0[0].piston).toBeCloseTo(0, 3);
    expect(k0[3].piston).toBeCloseTo(0, 3); // 1 és 4 együtt mozog
    expect(k0[1].piston).toBeCloseTo(1, 3);
    expect(k0[0].stroke).toBe("munka");
    const deg = (d: number) => (d * Math.PI) / 180;
    expect(cylinderKinematics(deg(180), true)[2].stroke).toBe("munka"); // 3.
    expect(cylinderKinematics(deg(360), true)[3].stroke).toBe("munka"); // 4.
    expect(cylinderKinematics(deg(540), true)[1].stroke).toBe("munka"); // 2.
  });

  it("6 fokozat: 6-osban 100 km/h ~2400 1/perc, 250 km/h-nál végsebesség-korlát", () => {
    const r = rpmAtSpeed(6, 100 / 3.6);
    expect(r).toBeGreaterThan(2300);
    expect(r).toBeLessThan(2550);
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 255 / 3.6;
    s.omega = (rpmAtSpeed(6, s.speed) * 2 * Math.PI) / 60;
    c.clutch = 1;
    shift(s, c, 6);
    c.clutch = 0;
    c.throttle = 1;
    stepFor(s, c, 6);
    expect(s.speed * 3.6).toBeLessThan(253);
  });

  it("kormányzás: fordulókör a kinematikai sugárnak megfelelő", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 3;
    c.steer = 1;
    stepFor(s, c, 1);
    const R = s.speed / Math.abs(s.yawRate);
    expect(R).toBeCloseTo(DRIVETRAIN.wheelbaseM / Math.tan(DRIVETRAIN.maxSteerRad), 0);
    expect(s.latAccel).toBeGreaterThan(0); // jobbra kanyarodik
  });
});

describe("tartós károk (csak újratöltés javítja)", () => {
  it("kuplung nélküli váltás csikorog, 4 után a fokozat tönkremegy", () => {
    const { s, c } = warmRunning();
    for (let i = 0; i < 3; i++) {
      const r = shift(s, c, 2);
      expect(r.grind).toBe(true);
      expect(c.gear).toBe(0);
    }
    expect(gearUsable(s, 2)).toBe(true);
    shift(s, c, 2);
    expect(gearUsable(s, 2)).toBe(false);
    c.clutch = 1;
    expect(shift(s, c, 2).ok).toBe(false);
    expect(s.dmg.log.length).toBeGreaterThan(0);
  });

  it("haladás közben hátramenet → letörik", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 30 / 3.6;
    c.clutch = 1;
    expect(shift(s, c, -1).ok).toBe(false);
    expect(gearUsable(s, -1)).toBe(false);
  });

  it("rossz visszaváltás (130 km/h → 1-es) túlpörgeti és tönkreteszi a motort", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 130 / 3.6;
    c.clutch = 1;
    shift(s, c, 1);
    c.clutch = 0;
    stepFor(s, c, 1);
    expect(s.peakRpm).toBeGreaterThan(ENGINE.valveFloatRpm);
    expect(s.dmg.seized || s.dmg.valves.some((v) => v >= 0.5)).toBe(true);
    expect(s.running).toBe(false);
  });

  it("mérsékelt túlpörgetés (78 km/h → 1-es) elgörbíti a szelepeket, a henger kiesik", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 78 / 3.6;
    c.clutch = 1;
    shift(s, c, 1);
    c.clutch = 0;
    stepFor(s, c, 0.6);
    expect(s.dmg.valves.some((v) => v >= 0.5)).toBe(true);
    expect(s.dmg.seized).toBe(false);
  });

  it("határolón tartás (túljáratás) → csapágykopogás → beragadás", () => {
    const { s, c } = warmRunning();
    c.throttle = 1;
    stepFor(s, c, 60, 0.001);
    expect(s.dmg.bearing).toBeGreaterThan(0.35);
    expect(s.oilPressure).toBeLessThan(4.5);
    stepFor(s, c, 120, 0.001);
    expect(s.dmg.seized).toBe(true);
    expect(s.running).toBe(false);
    // beragadt motor nem indítható
    c.throttle = 0;
    c.clutch = 1;
    pressStartStop(s, c);
    stepFor(s, c, 3);
    expect(s.running).toBe(false);
    expect(s.rpm).toBeLessThan(5);
  });

  it("túlmelegedés → hengerfej-tömítés → beragadás", () => {
    const { s, c } = warmRunning();
    s.tempC = 124;
    s.coolantL = 3;
    s.dmg.headGasket = 0.15;
    c.throttle = 0.6;
    for (let i = 0; i < 400 && !s.dmg.seized; i++) stepFor(s, c, 0.5, 0.002);
    expect(s.dmg.headGasket).toBeGreaterThan(0.2);
    expect(s.dmg.seized).toBe(true);
  });

  it("LSPI: 6-osban 1500 1/percen padlógáz → dugattyú sérül", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 62 / 3.6;
    s.omega = (rpmAtSpeed(6, s.speed) * 2 * Math.PI) / 60;
    c.clutch = 1;
    shift(s, c, 6);
    c.clutch = 0;
    c.throttle = 1;
    stepFor(s, c, 7);
    expect(s.dmg.pistons.some((p) => p >= 0.3)).toBe(true);
  });

  it("forró leállítás → turbókár", () => {
    const { s, c } = warmRunning();
    s.turboC = 800;
    pressStartStop(s, c);
    step(s, c);
    expect(s.dmg.turbo).toBeGreaterThan(0);
  });

  it("kuplung csúsztatása → kuplung leég", () => {
    const { s, c } = warmRunning();
    c.clutch = 1;
    shift(s, c, 1);
    c.seatbelt = false;
    c.throttle = 0.5;
    stepFor(s, c, 0.4);
    c.clutch = 0.6; // félkuplung, behúzott rögzítőfék ellen, gázzal
    for (let i = 0; i < 6000; i++) {
      c.throttle = s.rpm < 3500 ? 0.7 : 0.2;
      stepFor(s, c, 0.01);
    }
    expect(s.clutchC).toBeGreaterThan(300);
    expect(s.dmg.clutch).toBeGreaterThan(0.25);
  });

  it("a károk újraindítás után is megmaradnak, ha átadjuk őket", () => {
    const { s } = warmRunning();
    s.dmg.valves[2] = 1;
    const fresh = createState({ dmg: s.dmg });
    const c = defaultControls();
    c.clutch = 1;
    fresh.tempC = 90;
    pressStartStop(fresh, c);
    stepFor(fresh, c, 3);
    expect(fresh.dmg.valves[2]).toBe(1);
    expect(fresh.running).toBe(true);
    stepFor(fresh, c, 0.5);
    expect(fresh.misfire[2]).toBe(true);
  });
});

describe("elektromos rendszer", () => {
  it("járó motornál a generátor tölt, álló motornál gyújtással merül", () => {
    const { s, c } = warmRunning();
    const soc0 = s.batterySoc;
    stepFor(s, c, 60, 0.002);
    expect(s.batterySoc).toBeGreaterThan(soc0);
    expect(s.batteryV).toBeGreaterThan(13.5);
    c.ignition = false;
    stepFor(s, c, 5);
    c.ignition = true;
    const soc1 = s.batterySoc;
    stepFor(s, c, 600, 0.01);
    expect(s.batterySoc).toBeLessThan(soc1);
    expect(s.batteryLamp).toBe(true);
  });

  it("lemerült akkumulátorral nem indul", () => {
    const s = createState({ tempC: 90, oilTempC: 90, batterySoc: 0.03 });
    const c = defaultControls();
    c.clutch = 1;
    pressStartStop(s, c);
    stepFor(s, c, 4);
    expect(s.running).toBe(false);
    expect(s.rpm).toBeLessThan(150);
    expect(s.event).toContain("akkumulátor");
  });
});

describe("fékek", () => {
  it("nagy sebességről fékezve a tárcsák melegszenek, majd hűlnek", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.speed = 40;
    c.brake = 1;
    stepFor(s, c, 4, 0.002);
    expect(s.brakeFrontC).toBeGreaterThan(100);
    const peak = s.brakeFrontC;
    c.brake = 0;
    s.speed = 25;
    stepFor(s, c, 120, 0.01);
    expect(s.brakeFrontC).toBeLessThan(peak);
  });

  it("forró tárcsa: fading", () => {
    const { s, c } = warmRunning();
    s.epb = "released";
    s.brakeFrontC = 700;
    s.brakeRearC = 650;
    s.speed = 30;
    c.brake = 1;
    stepFor(s, c, 0.5, 0.002);
    expect(s.brakeEff).toBeLessThan(0.7);
  });
});

describe("lefulladásgátló", () => {
  it("lassan felengedett kuplunggal gáz nélkül is elindul (emelt alapjárat), hirtelen felengedve lefullad", () => {
    const { s, c } = warmRunning();
    s.epb = "released"; // gáz nélkül a drive-away assist nem old – a valóságban is kézzel kell
    c.clutch = 1;
    shift(s, c, 1);
    const t0 = s.t;
    while (s.t - t0 < 3) {
      c.clutch = Math.max(0, 1 - (s.t - t0) * 0.7);
      stepFor(s, c, 0.01);
    }
    stepFor(s, c, 2);
    expect(s.running).toBe(true);
    expect(s.speed * 3.6).toBeGreaterThan(3);
  });
});
