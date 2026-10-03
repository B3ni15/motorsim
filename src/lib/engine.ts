/**
 * Fizikai modell: Volkswagen Golf 7.5 R (2019, EU, OPF)
 * – EA888 Gen3 2.0 TSI (DNUE): soros 4 henger, 1984 cm³, 82,5 × 92,8 mm, IS38 turbó, 221 kW / 380 Nm
 * – 6 fokozatú kézi váltó (02Q) + hátramenet, 4,24 végáttétel
 * – 4MOTION összkerékhajtás (5. generációs Haldex), elektromos rögzítőfék (EPB) + Auto Hold
 * – tartós károk: túlpörgetés, csapágy, hengerfej-tömítés, LSPI, turbó, kuplung, szinkron, hátramenet
 * Minden érték SI (rad/s, Nm, kg, m), kivéve ahol a név mást mond (kPa, °C, 1/perc).
 */

/** -1 = hátramenet, 0 = üres */
export type Gear = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DriveMode = "comfort" | "normal" | "race";

export interface Controls {
  /** 0..1 gázpedál */
  throttle: number;
  /** 0..1 fékpedál */
  brake: number;
  /** 0..1 kuplungpedál (1 = teljesen benyomva = szétkapcsolva) */
  clutch: number;
  /** önindító közvetlenül (a Start/Stop gomb az ECU-n keresztül indít, lásd pressStartStop) */
  starter: boolean;
  /** gyújtás (15-ös kapocs) */
  ignition: boolean;
  gear: Gear;
  /** EPB kapcsoló: 1 = felhúzva (tartva), -1 = lenyomva, 0 = alaphelyzet */
  epbSwitch: -1 | 0 | 1;
  /** Auto Hold gomb állapota */
  autoHold: boolean;
  /** -1..1 kormány (pozitív = jobbra) */
  steer: number;
  mode: DriveMode;
  /** vezetőoldali ajtó nyitva */
  doorOpen: boolean;
  /** biztonsági öv bekapcsolva */
  seatbelt: boolean;
  /** tompított fényszóró */
  lights: boolean;
}

export type EpbState = "released" | "applying" | "applied" | "releasing";

/** Tartós károk – csak az oldal újratöltése javítja meg őket. */
export interface Damage {
  /** hengerenként elgörbült szelepek 0..1 (1 = a henger nem működik) */
  valves: number[];
  /** hengerenként LSPI miatt sérült dugattyú (gyűrűhorony) 0..1 */
  pistons: number[];
  /** hajtókar-csapágy kopás 0..1 (1 = beragadt) */
  bearing: number;
  /** hengerfej-tömítés 0..1 */
  headGasket: number;
  /** turbó csapágy/kokszosodás 0..1 */
  turbo: number;
  /** kuplung kopás/égés 0..1 */
  clutch: number;
  /** szinkronkárok fokozatonként: index 0 = R, 1..6 = fokozat; 1 = nem kapcsolható */
  synchro: number[];
  /** a motor mechanikusan tönkrement (beragadt / hajtókar-törés) */
  seized: boolean;
  /** kár-napló */
  log: { t: number; text: string }[];
}

export interface SimState {
  t: number;
  /** főtengely szögsebesség rad/s */
  omega: number;
  /** főtengely szög rad, 0..4π (egy teljes 720°-os ciklus) */
  crank: number;
  rpm: number;
  running: boolean;
  stalls: number;
  fuelL: number;
  /** hűtővíz °C */
  tempC: number;
  /** jármű sebesség m/s, előjeles (+ előre) */
  speed: number;
  /** hosszirányú gyorsulás m/s² (simított) */
  accel: number;
  /** oldalgyorsulás m/s² (+ jobbra) */
  latAccel: number;
  /** ECU nyomatékigény 0..1 (pedál + alapjárat-szabályzó) */
  request: number;
  /** fojtószelep állás 0..1 */
  effThrottle: number;
  idleTrim: number;
  engineTorque: number;
  clutchTorque: number;
  clutchSlip: number;
  revLimiter: boolean;
  /** túlfutási üzemanyag-lezárás (gáz nélkül, nagy fordulaton) */
  overrun: boolean;
  catchTimer: number;
  /** ECU indítási ciklus aktív (Start/Stop gomb) */
  autoCrank: boolean;
  autoCrankT: number;
  oilPressure: number;
  powerKW: number;
  consumption: number;
  event: string;
  eventAt: number;
  fuelUsedL: number;
  /** megtett út (m, abszolút) */
  distance: number;
  /** kerék elfordulás (rad, előjeles) */
  wheelAngle: number;
  startedAt: number;
  fuelRateLh: number;
  oilTempC: number;
  /** szívócső abszolút nyomás kPa */
  mapKPa: number;
  /** töltőnyomás (túlnyomás) kPa */
  boostKPa: number;
  /** turbó fordulat (normalizált 0..~1.1, 1 ≈ 190 000 1/perc) */
  turbo: number;
  /** wastegate nyitás 0..1 */
  wastegate: number;
  /** lefúvató szelep (diverter) eseményszámláló + intenzitás */
  bovCount: number;
  bovLevel: number;
  airGs: number;
  intakeAirC: number;
  afr: number;
  injectorMs: number;
  /** nagynyomású befecskendező rendszer nyomás bar */
  railBar: number;
  fuelGs: number;
  /** turbó előtti kipufogógáz °C */
  exhaustC: number;
  /** turbinaház °C */
  turboC: number;
  fan: boolean;
  thermostat: number;
  /** hűtőfolyadék mennyiség L */
  coolantL: number;
  batterySoc: number;
  batteryV: number;
  altA: number;
  loadA: number;
  starterA: number;
  altTorque: number;
  altRpm: number;
  batteryLamp: boolean;
  headTempC: number;
  batteryTempC: number;
  catTempC: number;
  exhaustGs: number;
  tailpipeC: number;
  brakeFrontC: number;
  brakeRearC: number;
  brakeFluidC: number;
  brakeEff: number;
  brakePowerKW: number;
  /** kuplung hőmérséklet °C */
  clutchC: number;
  /** kopogásérzékelő: gyújtás-visszavétel fok */
  knockRetard: number;
  /** LSPI kockázat-számláló s */
  lspiT: number;
  /** ASR/ESC beavatkozás 0..1 */
  asr: number;
  /** hengerenkénti gyújtáskimaradás (ciklusonként frissítve) */
  misfire: boolean[];
  /** EPB */
  epb: EpbState;
  epbT: number;
  /** EPB dinamikus vészfékezés aktív */
  epbDynamic: boolean;
  /** Auto Hold tart */
  holdActive: boolean;
  /** hátsó Haldex nyomatékarány 0..0.5 */
  rearShare: number;
  /** pozíció a világban (m) és irány (rad, +X-től az óramutatóval ellentétesen felülről) */
  posX: number;
  posZ: number;
  heading: number;
  yawRate: number;
  /** első kerék kormányszög rad (+ jobbra) */
  steerAngle: number;
  /** váltócsikorgás eseményszámláló (hanghoz) */
  grindCount: number;
  /** csúcsfordulat */
  peakRpm: number;
  dmg: Damage;
}

export const ENGINE = {
  name: "VW EA888 Gen3 2.0 TSI (DNUE)",
  displacementL: 1.984,
  cylinders: 4,
  boreMm: 82.5,
  strokeMm: 92.8,
  rodMm: 144,
  compression: 9.3,
  inertia: 0.16, // kg·m² (főtengely + kettős tömegű lendkerék)
  idleRpmWarm: 750,
  idleRpmCold: 1150,
  stallRpm: 380,
  fireRpm: 150,
  revLimit: 6800,
  revLimitReset: 6650,
  redline: 6500,
  /** mechanikus túlpörgés: szelepek "lebegnek", a dugattyú eléri őket */
  valveFloatRpm: 7400,
  /** hajtókar-törés */
  destructRpm: 9000,
  tankL: 55,
  fuelDensity: 0.745,
  firingOrder: [1, 3, 4, 2] as const,
  powerKW: 221,
  peakTorqueNm: 380,
  maxBoostKPa: 125,
};

export const ELECTRICAL = {
  batteryAh: 68, // AGM, motortérben bal elöl
  batteryInternalOhm: 0.009,
  regulatorV: 14.4,
  altMaxA: 140,
  altRatio: 2.8,
  starterA: 190,
  ecuA: 6,
  fuelPumpA: 7,
  fanA: 32,
  ignitionCoilsA: 4,
  lightsA: 7,
};

export const DRIVETRAIN = {
  // 02Q 6 fokozat + R, 4,24 végáttétel (Golf R Mk7 kézi)
  gearRatios: { [-1]: -3.82, 0: 0, 1: 3.36, 2: 2.09, 3: 1.48, 4: 1.09, 5: 0.85, 6: 0.7 } as Record<Gear, number>,
  finalDrive: 4.24,
  wheelRadius: 0.3235, // 235/35 R19
  efficiency: 0.88,
  clutchMaxTorque: 600,
  massKg: 1505, // vezetővel
  dragCoef: 0.5 * 1.2 * 0.33 * 2.21, // 0,5·ρ·Cd·A
  rollCoef: 0.011,
  brakeForce: 16500,
  epbHoldForce: 7000,
  wheelbaseM: 2.63,
  trackFrontM: 1.543,
  trackRearM: 1.513,
  maxSteerRad: 0.6,
  /** tapadási tényező (száraz aszfalt, nyári gumi) */
  mu: 1.05,
};

export const GEARS: Gear[] = [-1, 0, 1, 2, 3, 4, 5, 6];
export const gearLabel = (g: Gear) => (g === -1 ? "R" : g === 0 ? "N" : String(g));

const RPM = 60 / (2 * Math.PI);
const ATM = 101.3;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function interp(pts: [number, number][], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Szívó (töltés nélküli) nyomaték 1 bar szívócsőnyomásnál, Nm. */
export function naTorque(rpm: number): number {
  return interp(
    [
      [0, 105],
      [800, 132],
      [1500, 152],
      [2500, 168],
      [3500, 175],
      [4500, 173],
      [5500, 163],
      [6500, 145],
      [7500, 115],
    ],
    rpm,
  );
}

/** ECU nyomatékkorlát (teljes töltőnyomásnál elérhető maximum), Nm. 380 Nm 2000–5300, 221 kW 5300–6500. */
export function maxTorque(rpm: number): number {
  return interp(
    [
      [0, 150],
      [1000, 230],
      [1500, 330],
      [2000, 380],
      [5300, 380],
      [5800, 364],
      [6500, 325],
      [7000, 290],
      [8000, 200],
    ],
    rpm,
  );
}

/** Teljes gáz, teljesen felépült töltőnyomás melletti nyomaték (Nm). */
export const wotTorque = maxTorque;

/** Súrlódás + szivattyúzási veszteség (Nm). */
export function frictionTorque(rpm: number, charge: number, oilC: number): number {
  const cold = 1 + Math.max(0, (60 - oilC) / 60) * 0.6;
  const pumping = (1 - clamp(charge, 0, 1)) * 7;
  return (8 + 0.0042 * rpm) * cold + pumping;
}

/** Önindító nyomaték (Nm) – kb. 260 1/perc-ig hajt. */
export function starterTorque(rpm: number): number {
  return Math.max(0, 70 * (1 - rpm / 380));
}

export interface CylinderInfo {
  index: number; // 1..4
  /** 0..1, 0 = FHP, 1 = AHP */
  piston: number;
  /** 0..720 fok, 0 = munkaütem kezdete */
  phase: number;
  stroke: "munka" | "kipufogó" | "szívó" | "sűrítő";
  intake: number;
  exhaust: number;
  spark: boolean;
  burn: number;
}

/** index 1..4 → ciklusszög eltolás (fok), gyújtási sorrend 1-3-4-2, 180°-onként */
export const CYL_OFFSET = [0, 0, 540, 180, 360];

function valveLift(phase: number, open: number, close: number): number {
  if (phase < open || phase > close) return 0;
  return Math.sin(((phase - open) / (close - open)) * Math.PI);
}

export function cylinderKinematics(crank: number, running: boolean, misfire?: boolean[]): CylinderInfo[] {
  const r = ENGINE.strokeMm / 2;
  const l = ENGINE.rodMm;
  const cycleDeg = ((crank * 180) / Math.PI) % 720;
  const out: CylinderInfo[] = [];
  for (let i = 1; i <= ENGINE.cylinders; i++) {
    const phase = (((cycleDeg - CYL_OFFSET[i]) % 720) + 720) % 720;
    const th = (phase * Math.PI) / 180;
    const x = r * Math.cos(th) + Math.sqrt(l * l - r * r * Math.sin(th) ** 2);
    const piston = (l + r - x) / (2 * r);
    let stroke: CylinderInfo["stroke"];
    if (phase < 180) stroke = "munka";
    else if (phase < 360) stroke = "kipufogó";
    else if (phase < 540) stroke = "szívó";
    else stroke = "sűrítő";
    const exhaust = valveLift(phase, 150, 375);
    const intake = valveLift(phase, 345, 570);
    const fires = running && !(misfire && misfire[i - 1]);
    const spark = fires && (phase < 8 || phase > 705);
    const burn = fires && phase < 120 ? Math.sin((phase / 120) * Math.PI) : 0;
    out.push({ index: i, piston, phase, stroke, intake, exhaust, spark, burn });
  }
  return out;
}

/** Nyomaték-lüktetés: átlaga 1 (ha minden henger működik). `cylWeight` hengerenkénti szorzó. */
function torquePulse(crank: number, cylWeight: number[]): number {
  const cycleDeg = ((crank * 180) / Math.PI) % 720;
  let s = 0;
  for (let i = 1; i <= ENGINE.cylinders; i++) {
    const phase = (((cycleDeg - CYL_OFFSET[i]) % 720) + 720) % 720;
    if (phase < 180) s += Math.sin((phase * Math.PI) / 180) * cylWeight[i - 1];
  }
  return (s * 2 * Math.PI) / ENGINE.cylinders;
}

export function createDamage(): Damage {
  return {
    valves: [0, 0, 0, 0],
    pistons: [0, 0, 0, 0],
    bearing: 0,
    headGasket: 0,
    turbo: 0,
    clutch: 0,
    synchro: [0, 0, 0, 0, 0, 0, 0],
    seized: false,
    log: [],
  };
}

export function createState(opts: Partial<SimState> = {}): SimState {
  return {
    t: 0,
    omega: 0,
    crank: 0,
    rpm: 0,
    running: false,
    stalls: 0,
    fuelL: 40,
    tempC: 20,
    speed: 0,
    accel: 0,
    latAccel: 0,
    request: 0,
    effThrottle: 0,
    idleTrim: 0.08,
    engineTorque: 0,
    clutchTorque: 0,
    clutchSlip: 0,
    revLimiter: false,
    overrun: false,
    catchTimer: 0,
    autoCrank: false,
    autoCrankT: 0,
    oilPressure: 0,
    powerKW: 0,
    consumption: 0,
    event: "",
    eventAt: -10,
    fuelUsedL: 0,
    distance: 0,
    wheelAngle: 0,
    startedAt: -10,
    fuelRateLh: 0,
    oilTempC: 20,
    mapKPa: ATM,
    boostKPa: 0,
    turbo: 0,
    wastegate: 1,
    bovCount: 0,
    bovLevel: 0,
    airGs: 0,
    intakeAirC: 20,
    afr: 0,
    injectorMs: 0,
    railBar: 0,
    fuelGs: 0,
    exhaustC: 20,
    turboC: 20,
    fan: false,
    thermostat: 0,
    coolantL: 8.5,
    batterySoc: 0.85,
    batteryV: 12.7,
    altA: 0,
    loadA: 0,
    starterA: 0,
    altTorque: 0,
    altRpm: 0,
    batteryLamp: false,
    headTempC: 20,
    batteryTempC: 20,
    catTempC: 20,
    exhaustGs: 0,
    tailpipeC: 20,
    brakeFrontC: 20,
    brakeRearC: 20,
    brakeFluidC: 20,
    brakeEff: 1,
    brakePowerKW: 0,
    clutchC: 25,
    knockRetard: 0,
    lspiT: 0,
    asr: 0,
    misfire: [false, false, false, false],
    epb: "applied",
    epbT: 0,
    epbDynamic: false,
    holdActive: false,
    rearShare: 0,
    posX: 0,
    posZ: 0,
    heading: 0,
    yawRate: 0,
    steerAngle: 0,
    grindCount: 0,
    peakRpm: 0,
    dmg: createDamage(),
    ...opts,
  };
}

function setEvent(s: SimState, msg: string) {
  s.event = msg;
  s.eventAt = s.t;
}

function logDamage(s: SimState, msg: string) {
  setEvent(s, msg);
  s.dmg.log.push({ t: s.t, text: msg });
}

export const DT = 0.0005;

/** Engedélyezett-e a fokozat (szinkronkár után nem kapcsolható). */
export function gearUsable(s: SimState, g: Gear): boolean {
  if (g === 0) return true;
  return s.dmg.synchro[g === -1 ? 0 : g] < 1;
}

export interface ShiftResult {
  ok: boolean;
  msg?: string;
  grind?: boolean;
}

/**
 * Sebességváltás. Kuplung nélkül (járó motornál vagy guruló autónál) csikorog, a szinkron sérül;
 * mozgás közben hátramenetbe kapcsolva a hátramenet fogaskerék letörik.
 */
export function shift(s: SimState, c: Controls, g: Gear): ShiftResult {
  if (g === c.gear) return { ok: true };
  if (g === 0) {
    c.gear = 0;
    return { ok: true };
  }
  const idx = g === -1 ? 0 : g;
  if (s.dmg.synchro[idx] >= 1) {
    c.gear = 0;
    return { ok: false, msg: `A(z) ${gearLabel(g)}. fokozat nem kapcsolható – tönkrement (csak újratöltés javítja)`, grind: true };
  }
  const spinning = s.rpm > 100 || Math.abs(s.speed) > 0.3;
  const clutchDown = c.clutch >= 0.8;
  if (spinning && !clutchDown) {
    s.dmg.synchro[idx] = Math.min(1, s.dmg.synchro[idx] + 0.25);
    s.grindCount++;
    c.gear = 0;
    if (s.dmg.synchro[idx] >= 1) {
      logDamage(s, `RECCS! A(z) ${gearLabel(g)}. fokozat szinkronja tönkrement – a fokozat nem kapcsolható`);
    } else {
      setEvent(s, "RECCS! Kuplung nélkül csikorog a váltó – a szinkron sérül!");
    }
    return { ok: false, msg: "RECCS! Nyomd be a kuplungot váltáshoz!", grind: true };
  }
  // hátramenet előre guruláskor / előremenet hátra guruláskor
  const wrongDir = (g === -1 && s.speed > 0.4) || (g > 0 && s.speed < -1.5);
  if (wrongDir) {
    s.grindCount++;
    if (g === -1 && s.speed > 1.4) {
      s.dmg.synchro[0] = 1;
      c.gear = 0;
      logDamage(s, "KRRRR! Haladás közben hátramenetbe kapcsoltál – letört a hátramenet fogaskerék");
      return { ok: false, msg: "A hátramenet tönkrement!", grind: true };
    }
    s.dmg.synchro[idx] = Math.min(1, s.dmg.synchro[idx] + 0.34);
    c.gear = 0;
    setEvent(s, "RECCS! Állj meg teljesen, mielőtt irányt váltasz!");
    return { ok: false, msg: "Állj meg teljesen az irányváltás előtt!", grind: true };
  }
  c.gear = g;
  return { ok: true };
}

/**
 * Start/Stop gomb (Keyless Access): kuplunggal → indítás (az ECU addig forgat, míg beindul),
 * kuplung nélkül → csak gyújtás be/ki; járó motornál → leállítás.
 */
export function pressStartStop(s: SimState, c: Controls): void {
  if (s.running || s.autoCrank) {
    c.ignition = false;
    s.autoCrank = false;
    return;
  }
  if (c.clutch >= 0.8) {
    c.ignition = true;
    if (s.dmg.seized) {
      setEvent(s, "Az önindító nem tudja megforgatni – a motor mechanikusan tönkrement");
      return;
    }
    s.autoCrank = true;
    s.autoCrankT = 0;
    return;
  }
  c.ignition = !c.ignition;
  if (c.ignition) setEvent(s, "Gyújtás BE – indításhoz nyomd be a kuplungot és a Start gombot");
}

/** Egy fizikai lépés (dt másodperc). Mutálja az állapotot. */
export function step(s: SimState, c: Controls, dt: number = DT): void {
  const d = s.dmg;
  const rpm = s.omega * RPM;
  const ambient = 20;

  // ---- ECU indítási ciklus ----
  if (s.autoCrank) {
    s.autoCrankT += dt;
    if (s.running || !c.ignition) s.autoCrank = false;
    else if (s.autoCrankT > 10) {
      s.autoCrank = false;
      setEvent(s, "Az indítás megszakadt (10 s) – a motor nem indult be");
    }
  }
  const starterOn = c.starter || s.autoCrank;

  // ---- működő hengerek ----
  const cylWeight = [0, 1, 2, 3].map((i) => (1 - d.valves[i]) * (1 - 0.55 * d.pistons[i]));
  const workingCyl = cylWeight.reduce((a, b) => a + b, 0);

  // ---- gyújtás / üzemállapot ----
  const canFire = c.ignition && s.fuelL > 0 && rpm >= ENGINE.fireRpm && !d.seized && workingCyl > 0.8;
  if (s.running) {
    if (!c.ignition) {
      s.running = false;
      setEvent(s, "Motor leállítva");
    } else if (d.seized) {
      s.running = false;
    } else if (s.fuelL <= 0) {
      s.running = false;
      setEvent(s, "Kifogyott az üzemanyag!");
    } else if (rpm < ENGINE.stallRpm && !starterOn && s.t - s.startedAt > 1.0) {
      s.running = false;
      s.stalls++;
      setEvent(s, "A motor lefulladt!");
    }
    if (!s.running && s.turboC > 650 && !d.seized) {
      d.turbo = Math.min(1, d.turbo + 0.2);
      logDamage(s, `Forró leállítás (turbó ${s.turboC.toFixed(0)} °C) – kokszosodik a turbó csapágya. Hagyd alapjáraton hűlni leállítás előtt!`);
    }
  } else if (canFire) {
    const catchTime = 0.3 + Math.max(0, (40 - s.tempC) / 40) * 0.6;
    s.catchTimer += dt;
    if (s.catchTimer >= catchTime) {
      s.running = true;
      s.catchTimer = 0;
      s.startedAt = s.t;
      s.autoCrank = false;
      setEvent(s, starterOn ? "Motor beindult" : "Motor betolással beindult");
    }
  } else {
    s.catchTimer = 0;
  }

  // ---- fordulatszám-határoló + túlfutási lezárás ----
  if (rpm > ENGINE.revLimit) s.revLimiter = true;
  else if (rpm < ENGINE.revLimitReset) s.revLimiter = false;
  const pedal = clamp(c.throttle, 0, 1);
  if (s.running && pedal < 0.01 && rpm > 1500 && s.t - s.startedAt > 2) s.overrun = true;
  else if (pedal >= 0.01 || rpm < 1150) s.overrun = false;

  // ---- alapjárat-szabályzó (PI) a nyomatékigényen ----
  // lefulladásgátló: kuplung felengedésekor (sebességben, gáz nélkül) az ECU megemeli az alapjáratot
  const engaging = c.gear !== 0 && c.clutch < 0.82 && c.clutch > 0.05 && pedal < 0.15;
  const idleBase = ENGINE.idleRpmWarm + (ENGINE.idleRpmCold - ENGINE.idleRpmWarm) * clamp((60 - s.tempC) / 45, 0, 1);
  const idleTarget = engaging ? Math.max(idleBase, 1050) : idleBase;
  if (s.running) {
    const err = (idleTarget - rpm) / 1000;
    s.idleTrim = clamp(s.idleTrim + err * (engaging ? 1.5 : 0.5) * dt, 0.02, 0.45);
  }
  const idleP = s.running ? Math.max(0, (idleTarget - rpm) / 1000) * (engaging ? 1.6 : 0.6) : 0;
  const map = c.mode === "race" ? 0.75 : c.mode === "comfort" ? 1.35 : 1.1;
  const pedalReq = Math.pow(pedal, map);
  const idleReq = s.running && !s.overrun ? Math.min(0.5, s.idleTrim + idleP) : 0;
  const request = Math.max(pedalReq, idleReq);
  s.request = request;

  // ---- töltés: fojtószelep + turbó + wastegate ----
  const tqNA = naTorque(rpm);
  const cDes = (request * (maxTorque(rpm) + 30)) / tqNA; // kívánt töltés (1 = légköri)
  const mapTarget = s.running || starterOn ? 20 + (ATM - 20) * cDes : ATM;
  // turbó: kipufogógáz-áram ~ fordulat × töltés (pozitív visszacsatolás = turbólyuk)
  const turboDrive = s.running && !s.overrun ? Math.min(1.15, (rpm * s.mapKPa) / 420000) : (rpm * 30) / 420000;
  const tauT = turboDrive > s.turbo ? 0.35 : 1.1;
  s.turbo += (turboDrive - s.turbo) * Math.min(1, dt / tauT);
  const boostCap = ENGINE.maxBoostKPa * 1.15 * s.turbo * s.turbo * (1 - 0.6 * d.turbo);
  const mapCap = ATM + boostCap;
  const mapGoal = Math.max(18, Math.min(mapTarget, mapCap, ATM + ENGINE.maxBoostKPa));
  const prevMap = s.mapKPa;
  s.mapKPa += (mapGoal - s.mapKPa) * Math.min(1, dt / (mapGoal > s.mapKPa ? 0.06 : 0.04));
  if (!s.running && !starterOn) s.mapKPa += (ATM - s.mapKPa) * Math.min(1, dt / 0.3);
  s.boostKPa = Math.max(0, s.mapKPa - ATM);
  s.wastegate = cDes <= 1 ? 1 : clamp(1 - (mapTarget - ATM) / Math.max(1, boostCap), 0, 1);
  s.effThrottle = clamp(Math.pow(clamp(cDes, 0, 1), 0.6), 0, 1);
  // lefúvató szelep: töltőnyomás alatt hirtelen elzárt fojtószelep
  if (s.boostKPa > 35 && mapTarget < ATM * 0.8 && prevMap > ATM + 30) {
    if (s.bovLevel <= 0) {
      s.bovCount++;
      s.bovLevel = Math.min(1, s.boostKPa / 110);
    }
    s.mapKPa = Math.min(s.mapKPa, ATM + 5);
    s.boostKPa = Math.max(0, s.mapKPa - ATM);
  }
  if (s.bovLevel > 0) s.bovLevel = Math.max(0, s.bovLevel - dt * 2.5);
  const charge = (s.mapKPa - 20) / (ATM - 20);

  // ---- kopogás / LSPI (alacsony fordulat, nagy terhelés) ----
  const lspiRisk = s.running && rpm > 900 && rpm < 1800 && s.boostKPa > 25 && pedal > 0.8;
  if (lspiRisk) s.lspiT += dt;
  else s.lspiT = Math.max(0, s.lspiT - dt * 0.5);
  const heatKnock = Math.max(0, (s.intakeAirC - 55) / 30) + Math.max(0, (s.tempC - 108) / 15);
  s.knockRetard = clamp((s.lspiT > 0.8 ? 6 : 0) + heatKnock * 6 * charge, 0, 12);
  if (s.lspiT > 2.5) {
    const worstP = d.pistons.indexOf(Math.max(...d.pistons));
    const cyl = d.pistons[worstP] > 0 ? worstP : Math.floor((s.t * 7.3) % 4);
    if (d.pistons[cyl] < 1) {
      const before = d.pistons[cyl];
      d.pistons[cyl] = Math.min(1, d.pistons[cyl] + dt / 1.5);
      if (before < 0.3 && d.pistons[cyl] >= 0.3) logDamage(s, `LSPI – előgyújtás a(z) ${cyl + 1}. hengerben, megrepedt a dugattyú gyűrűhorony! Ne gyorsíts padlógázzal 1800 1/perc alatt magas fokozatban.`);
    }
    if (s.t - s.eventAt > 4 && d.pistons[cyl] < 0.3) setEvent(s, "Kopogás! Alacsony fordulaton padlógáz – LSPI veszély, válts vissza!");
  }

  // ---- gyújtáskimaradás hengerenként ----
  for (let i = 0; i < 4; i++) s.misfire[i] = s.running && (d.valves[i] > 0.5 || (d.pistons[i] > 0.6 && Math.sin(s.t * 13 + i) > 0.3));

  // ---- motor nyomaték ----
  const coldFactor = 1 - Math.max(0, (30 - s.tempC) / 30) * 0.12;
  const heatDerate = 1 - Math.max(0, (s.tempC - 112) / 20) * 0.4;
  const knockF = 1 - s.knockRetard * 0.012;
  const asrF = 1 - s.asr * 0.85;
  // 250 km/h-s elektronikus végsebesség-korlát
  const vmaxCut = s.speed > 250 / 3.6;
  const combusting = s.running && !s.revLimiter && !s.overrun && !vmaxCut;
  let indicated = 0;
  if (combusting) {
    indicated = tqNA * Math.max(0, charge) * coldFactor * heatDerate * knockF * asrF * torquePulse(s.crank, cylWeight);
  }
  const bearingDrag = d.bearing * 25;
  const friction = frictionTorque(rpm, charge, s.oilTempC) + bearingDrag;
  // önindító: akkumulátorfeszültségtől függ
  const ocv = 11.8 + 1.0 * clamp(s.batterySoc, 0, 1);
  const coldBat = 1 + Math.max(0, (10 - s.batteryTempC) / 30);
  const lowSoc = 1 + 4 * Math.pow(1 - clamp(s.batterySoc, 0, 1), 6);
  const rInt = ELECTRICAL.batteryInternalOhm * coldBat * lowSoc;
  const crankV = ocv - ELECTRICAL.starterA * rInt;
  const starterStrength = clamp((crankV - 7.5) / 3, 0, 1);
  const starterT = d.seized ? 0 : starterOn && !s.running ? starterTorque(rpm) * starterStrength : 0;
  if (starterOn && !s.running && starterStrength < 0.15 && s.t - s.eventAt > 3) setEvent(s, "Lemerült az akkumulátor – az önindító nem forgat!");
  const compression = !s.running ? -5 * Math.max(0, Math.sin(2 * s.crank)) * (workingCyl / 4) : 0;
  s.engineTorque = indicated - friction * (s.omega > 0 ? 1 : 0);

  // ---- kuplung + hajtáslánc ----
  const ratio = DRIVETRAIN.gearRatios[c.gear] * DRIVETRAIN.finalDrive;
  const clutchPedal = clamp(c.clutch, 0, 1);
  const engage = clamp((0.85 - clutchPedal) / 0.55, 0, 1);
  const clutchFade = 1 - clamp((s.clutchC - 260) / 200, 0, 0.5);
  const capacity = DRIVETRAIN.clutchMaxTorque * engage * engage * (1 - 0.8 * d.clutch) * clutchFade;
  let clutchT = 0;
  let slip = 0;
  if (c.gear !== 0 && capacity > 0) {
    const wheelOmega = s.speed / DRIVETRAIN.wheelRadius;
    slip = s.omega - wheelOmega * ratio;
    clutchT = capacity * Math.tanh(slip / 3);
  }
  s.clutchTorque = clutchT;
  s.clutchSlip = slip;
  // kuplung hő: súrlódási teljesítmény
  const clutchW = Math.abs(clutchT * slip);
  s.clutchC += ((clutchW - (s.clutchC - ambient) * (6 + Math.abs(s.omega) * 0.05)) / 5200) * dt;
  if (s.clutchC > 330) {
    const before = d.clutch;
    d.clutch = Math.min(1, d.clutch + ((s.clutchC - 330) / 150) * dt * 0.25);
    if (before < 0.25 && d.clutch >= 0.25) logDamage(s, "Égett kuplung szag! A kuplungtárcsa túlhevült és kopott – nagy nyomatéknál csúszni fog.");
    if (before < 0.9 && d.clutch >= 0.9) logDamage(s, "A kuplung teljesen leégett – alig visz át nyomatékot.");
  } else if (s.clutchC > 260 && s.t - s.eventAt > 6) setEvent(s, "A kuplung túlmelegszik – ne csúsztasd!");

  // ---- főtengely dinamika ----
  const netEngine = s.engineTorque + starterT + compression - clutchT - s.altTorque;
  if (d.seized) {
    s.omega = Math.max(0, s.omega - 400 * dt);
  } else {
    s.omega += (netEngine / ENGINE.inertia) * dt;
    if (s.omega < 0) s.omega = 0;
  }
  s.crank = (s.crank + s.omega * dt) % (4 * Math.PI);

  // ---- EPB / Auto Hold ----
  const v = s.speed;
  const absV = Math.abs(v);
  const pulling = c.epbSwitch === 1;
  s.epbDynamic = false;
  if (pulling && absV > 0.5) {
    // menet közben tartva: ESC vészfékezés mind a 4 keréken
    s.epbDynamic = true;
    if (s.t - s.eventAt > 3) setEvent(s, "EPB vészfékezés – az ESC mind a 4 kereket fékezi");
  } else if (pulling && (s.epb === "released" || s.epb === "releasing")) {
    s.epb = "applying";
    s.epbT = 0;
  } else if (c.epbSwitch === -1 && (s.epb === "applied" || s.epb === "applying")) {
    if (c.ignition && c.brake > 0.2) {
      s.epb = "releasing";
      s.epbT = 0;
    } else if (s.t - s.eventAt > 2) setEvent(s, c.ignition ? "A rögzítőfék oldásához nyomd a fékpedált!" : "A rögzítőfék oldásához kapcsold be a gyújtást");
  }
  const driveAwayIntent = s.running && c.gear !== 0 && pedal > 0.04 && engage > 0.04;
  if (s.epb === "applied" && driveAwayIntent) {
    if (!c.doorOpen && c.seatbelt) {
      s.epb = "releasing";
      s.epbT = 0;
    } else if (s.t - s.eventAt > 3) setEvent(s, "A rögzítőfék nem old: csukd be az ajtót és kapcsold be a biztonsági övet!");
  }
  if (s.epb === "applying") {
    s.epbT += dt;
    if (s.epbT > 0.9) s.epb = "applied";
  } else if (s.epb === "releasing") {
    s.epbT += dt;
    if (s.epbT > 0.4) s.epb = "released";
  }
  // Auto Hold
  if (c.autoHold && c.ignition && absV < 0.05 && c.brake > 0.3 && !c.doorOpen && c.seatbelt) s.holdActive = true;
  if (s.holdActive) {
    if (!c.autoHold || driveAwayIntent) s.holdActive = false;
    else if (!c.ignition || c.doorOpen || !c.seatbelt) {
      s.holdActive = false;
      if (s.epb !== "applied") {
        s.epb = "applying";
        s.epbT = 0;
        setEvent(s, "Auto Hold → a rögzítőfék automatikusan behúzott");
      }
    }
  }

  // ---- jármű dinamika ----
  const m = DRIVETRAIN.massKg;
  let wheelForce = (clutchT * ratio * DRIVETRAIN.efficiency) / DRIVETRAIN.wheelRadius;
  // ASR: a tapadási határ felett az ECU visszaveszi a nyomatékot
  const grip = DRIVETRAIN.mu * m * 9.81 * 0.98;
  const asrTarget = Math.abs(wheelForce) > grip ? clamp(1 - grip / Math.abs(wheelForce), 0, 1) * 1.3 : 0;
  s.asr += (Math.min(1, asrTarget) - s.asr) * Math.min(1, dt / (asrTarget > s.asr ? 0.03 : 0.25));
  if (Math.abs(wheelForce) > grip) wheelForce = Math.sign(wheelForce) * grip;
  // Haldex: gyorsításkor és nagy nyomatéknál hátra is visz (max 50%)
  const fwdLoad = Math.abs(wheelForce) / grip;
  s.rearShare += (clamp(0.05 + fwdLoad * 0.9, 0, 0.5) * (s.running ? 1 : 0) - s.rearShare) * Math.min(1, dt / 0.15);
  const drag = DRIVETRAIN.dragCoef * v * absV;
  const roll = DRIVETRAIN.rollCoef * m * 9.81;
  const fadeF = 1 - 0.55 * clamp((s.brakeFrontC - 500) / 250, 0, 1);
  const fadeR = 1 - 0.55 * clamp((s.brakeRearC - 500) / 250, 0, 1);
  const fluidF = s.brakeFluidC > 240 ? Math.max(0.15, 1 - (s.brakeFluidC - 240) / 60) : 1;
  s.brakeEff = (0.68 * fadeF + 0.32 * fadeR) * fluidF;
  let serviceBrake = DRIVETRAIN.brakeForce * clamp(c.brake, 0, 1) * s.brakeEff;
  if (s.epbDynamic) serviceBrake = Math.max(serviceBrake, m * 7 * s.brakeEff);
  const epbClamp = s.epb === "applied" ? 1 : s.epb === "releasing" ? Math.max(0, 1 - s.epbT / 0.35) : s.epb === "applying" ? clamp((s.epbT - 0.3) / 0.6, 0, 1) : 0;
  const parkForce = DRIVETRAIN.epbHoldForce * fadeR * epbClamp;
  const holdForce = s.holdActive ? DRIVETRAIN.brakeForce * 0.5 : 0;
  const resist = serviceBrake + parkForce + holdForce;
  let net = wheelForce - drag;
  if (absV > 0.02) {
    net -= Math.sign(v) * (roll + resist);
    const nv = v + (net / m) * dt;
    s.speed = Math.sign(nv) !== Math.sign(v) && Math.abs(wheelForce) < roll + resist ? 0 : nv;
  } else if (Math.abs(net) <= roll + resist) {
    s.speed = 0;
    net = 0;
  } else {
    net -= Math.sign(net) * (roll + resist);
    s.speed = v + (net / m) * dt;
  }
  s.accel += ((s.speed - v) / dt - s.accel) * Math.min(1, dt / 0.15);
  s.distance += Math.abs(s.speed) * dt;
  s.wheelAngle += (s.speed / DRIVETRAIN.wheelRadius) * dt;

  // kormányzás (kinematikus egynyomú modell, tapadási korláttal)
  const steerTarget = clamp(c.steer, -1, 1) * DRIVETRAIN.maxSteerRad;
  s.steerAngle += (steerTarget - s.steerAngle) * Math.min(1, dt / 0.08);
  let yaw = (s.speed * Math.tan(s.steerAngle)) / DRIVETRAIN.wheelbaseM;
  const latMax = DRIVETRAIN.mu * 9.81;
  if (Math.abs(yaw * s.speed) > latMax) yaw = (Math.sign(yaw) * latMax) / Math.max(0.1, Math.abs(s.speed)); // alulkormányzás
  s.yawRate = yaw;
  s.latAccel = yaw * s.speed;
  s.heading -= yaw * dt;
  s.posX += s.speed * Math.cos(s.heading) * dt;
  s.posZ -= s.speed * Math.sin(s.heading) * dt;

  // ---- ECU / befecskendezés (FSI közvetlen + MPI szívócső-befecskendezés) ----
  const newRpm = s.omega * RPM;
  s.powerKW = (Math.max(0, indicated) * s.omega) / 1000;
  s.intakeAirC = ambient + Math.max(0, s.tempC - ambient) * 0.1 + s.boostKPa * 0.12; // intercooler után
  const airDensity = (1.2 * 293) / (273 + s.intakeAirC);
  const ve = 0.84 + 0.1 * Math.sin((Math.min(newRpm, 6500) / 6500) * Math.PI);
  const airGs = s.running ? ve * ENGINE.displacementL * (newRpm / 120) * airDensity * (s.mapKPa / ATM) : 0;
  s.airGs = airGs;
  let afrTarget = 14.7;
  afrTarget -= Math.max(0, (50 - s.tempC) / 50) * 2.2;
  if (charge > 1.6) afrTarget = Math.min(afrTarget, 12.2); // teljes terhelés: dúsítás (alkatrészvédelem)
  const fuelGs = combusting ? (airGs / afrTarget) * (workingCyl / 4) : 0;
  s.fuelGs = fuelGs;
  s.afr = fuelGs > 0 ? airGs / fuelGs : 0;
  const injPerSec = newRpm / 120;
  s.injectorMs = fuelGs > 0 && injPerSec > 0 ? (fuelGs / ENGINE.cylinders / injPerSec / 18) * 1000 : 0;
  s.railBar = s.running ? 50 + 150 * clamp(charge / 2.2, 0, 1) : Math.max(0, s.railBar - dt * 20);
  const fuelL = (fuelGs / 1000 / ENGINE.fuelDensity) * dt;
  s.fuelL = Math.max(0, s.fuelL - fuelL);
  s.fuelUsedL += fuelL;
  s.fuelRateLh = (fuelGs / 1000 / ENGINE.fuelDensity) * 3600;
  s.consumption = absV > 1 ? (s.fuelRateLh * 100) / (absV * 3.6) : 0;
  const egtTarget = combusting ? 380 + 300 * clamp(charge, 0, 2.3) + newRpm / 25 : s.running ? 250 : ambient;
  s.exhaustC += (egtTarget - s.exhaustC) * Math.min(1, dt / (s.running ? 3 : 60));
  s.turboC += ((s.running ? s.exhaustC * 0.92 : ambient) - s.turboC) * Math.min(1, dt / (s.running ? 8 : 240));

  // ---- hőháztartás ----
  const fuelPowerW = fuelGs * 43000;
  const frictionHeatW = friction * s.omega;
  const coolantHeatIn = fuelPowerW * 0.27 + frictionHeatW * 0.5;
  // hőmenedzsment-modul (forgótolattyú): 87 °C-tól nyit, 97-re teljesen
  const thermoTarget = clamp((s.tempC - 87) / 10, 0, 1);
  s.thermostat += (thermoTarget - s.thermostat) * Math.min(1, dt / 6);
  if (c.ignition && s.tempC > 100) s.fan = true;
  else if (!c.ignition || s.tempC < 95) s.fan = false;
  const radiatorAir = 0.15 + absV * 0.08 + (s.fan ? 0.65 : 0);
  const pump = Math.min(1, newRpm / 800);
  const coolantFrac = clamp(s.coolantL / 8.5, 0, 1);
  const radiatorK = 380 * s.thermostat * radiatorAir * pump * Math.pow(coolantFrac, 2);
  const blockLossK = 3.2 + absV * 0.14;
  const C_COOL = 52000 * (0.4 + 0.6 * coolantFrac);
  const C_OIL = 13000;
  const oilCoolantK = 230;
  const coolantOut = (s.tempC - ambient) * (radiatorK + blockLossK) + (s.tempC - s.oilTempC) * oilCoolantK;
  const oilOut = (s.oilTempC - ambient) * (5 + absV * 0.3) + (s.oilTempC - s.tempC) * oilCoolantK;
  s.tempC += ((coolantHeatIn + d.headGasket * fuelPowerW * 0.08 - coolantOut) / C_COOL) * dt;
  s.oilTempC += ((frictionHeatW * 0.4 + fuelPowerW * 0.04 + s.turbo * 900 - oilOut) / C_OIL) * dt;
  if (s.tempC > 140) s.tempC = 140;
  if (s.oilTempC > 165) s.oilTempC = 165;
  if (d.headGasket > 0.2 && s.running) s.coolantL = Math.max(0, s.coolantL - d.headGasket * 0.02 * dt);

  // ---- elektromos rendszer ----
  s.altRpm = newRpm * ELECTRICAL.altRatio;
  const altCapacity = ELECTRICAL.altMaxA * clamp((s.altRpm - 1200) / 2600, 0, 1);
  let loadA = 0;
  if (c.ignition) loadA += ELECTRICAL.ecuA + ELECTRICAL.fuelPumpA + (s.running ? ELECTRICAL.ignitionCoilsA : 0);
  if (c.ignition && c.lights) loadA += ELECTRICAL.lightsA;
  if (s.fan) loadA += ELECTRICAL.fanA;
  if (s.epb === "applying" || s.epb === "releasing") loadA += 15;
  const starterA = starterOn && !s.running ? ELECTRICAL.starterA * (d.seized ? 1.6 : 1) : 0;
  s.loadA = loadA;
  s.starterA = starterA;
  const chargeDemand = Math.min(50, 75 * (1 - s.batterySoc)) * (s.batterySoc < 0.995 ? 1 : 0);
  const altA = c.ignition ? Math.min(altCapacity, loadA + starterA + chargeDemand) : 0;
  s.altA = altA;
  const netA = altA - loadA - starterA;
  s.batterySoc = clamp(s.batterySoc + (netA * dt) / (ELECTRICAL.batteryAh * 3600), 0, 1);
  const shortfall = loadA + starterA + chargeDemand - altCapacity;
  s.batteryV = c.ignition && altCapacity > 0 && shortfall <= 0 ? ELECTRICAL.regulatorV - Math.min(0.3, chargeDemand * 0.004) : Math.max(0, ocv + Math.min(0, netA) * rInt);
  const altP = altA * Math.max(s.batteryV, 12);
  s.altTorque = s.omega > 5 ? altP / (s.omega * 0.6) + 0.3 : 0;
  s.batteryLamp = c.ignition && altCapacity < loadA;
  s.batteryTempC += ((ambient + (s.tempC - ambient) * 0.25 + Math.abs(netA) * 0.03 - s.batteryTempC) / 900) * dt; // motortérben
  const headTarget = s.tempC + (s.running ? 8 + 30 * clamp(charge, 0, 2.2) / 2.2 : 2);
  s.headTempC += ((headTarget - s.headTempC) / 20) * dt;

  // ---- fékek hőháztartása ----
  const brakeW = (serviceBrake + holdForce) * absV;
  const parkW = parkForce * absV; // húzott rögzítőfékkel gurul: csak hátul
  s.brakePowerKW = (brakeW + parkW) / 1000;
  const C_DISC_F = 2 * 8.6 * 460;
  const C_DISC_R = 2 * 5.5 * 460;
  const coolK = (t: number) => 9 + absV * 1.1 + Math.max(0, t - 300) * 0.05;
  s.brakeFrontC += ((brakeW * 0.68 - (s.brakeFrontC - ambient) * coolK(s.brakeFrontC)) / C_DISC_F) * dt;
  s.brakeRearC += ((brakeW * 0.32 + parkW - (s.brakeRearC - ambient) * coolK(s.brakeRearC)) / C_DISC_R) * dt;
  const hottest = Math.max(s.brakeFrontC, s.brakeRearC);
  s.brakeFluidC += (((hottest - s.brakeFluidC) * 0.9 - (s.brakeFluidC - ambient) * 0.6) / 1200) * dt;
  if (parkW > 2000 && s.t - s.eventAt > 5) setEvent(s, "Behúzott rögzítőfékkel gurulsz – a hátsó fékek izzanak!");
  if (s.brakeFrontC > 560 && s.t - s.eventAt > 8) setEvent(s, "Fékfading – a féktárcsák túl forróak!");
  if (s.brakeFluidC > 240 && s.t - s.eventAt > 8) setEvent(s, "A fékfolyadék forr – a pedál elmegy!");

  // ---- kipufogórendszer (turbó → katalizátor → OPF → középső dob → 4 végcső) ----
  s.exhaustGs = airGs + fuelGs;
  const flowF = Math.min(1, s.exhaustGs / 60);
  const catLit = s.catTempC > 250 ? 1 : 0;
  const catTarget = s.running ? s.exhaustC * 0.78 + catLit * 50 + 20 : ambient;
  s.catTempC += ((catTarget - s.catTempC) / (s.running ? 20 / (0.15 + flowF) : 240)) * dt;
  const tailTarget = s.running ? 60 + (s.catTempC - 60) * 0.4 : ambient;
  s.tailpipeC += ((tailTarget - s.tailpipeC) / (s.running ? 30 : 300)) * dt;

  // ---- olajnyomás (csapágykopásnál esik) ----
  s.oilPressure = newRpm > 40 ? Math.min(5.5, 0.6 + (newRpm / 1000) * (1.0 + Math.max(0, (100 - s.oilTempC) / 100) * 2.0)) * (1 - 0.7 * d.bearing) : 0;

  // ================= TARTÓS KÁROK =================
  if (!d.seized) {
    // mechanikus túlpörgetés (pl. rossz visszaváltás: a kerekek pörgetik fel a motort)
    if (newRpm > ENGINE.destructRpm) {
      d.seized = true;
      d.bearing = 1;
      s.running = false;
      logDamage(s, `MOTORTÖRÉS! ${Math.round(newRpm)} 1/percre pörgetted túl – a hajtókar átütötte a blokkot.`);
    } else if (newRpm > ENGINE.valveFloatRpm) {
      // szeleplebegés: a szelepek nem zárnak, a dugattyú beléjük ütközik
      const over = (newRpm - ENGINE.valveFloatRpm) / 1000;
      // a már sérült hengert üti tovább, különben az éppen FHP közelében lévőt
      const worst = d.valves.indexOf(Math.max(...d.valves));
      const cyl = d.valves[worst] > 0 ? worst : Math.floor(((s.crank * 2) / Math.PI) % 4);
      const before = d.valves[cyl];
      d.valves[cyl] = Math.min(1, d.valves[cyl] + over * dt * 40);
      d.bearing = Math.min(1, d.bearing + over * dt * 0.5);
      if (before < 0.5 && d.valves[cyl] >= 0.5) logDamage(s, `Túlpörgetés (${Math.round(newRpm)} 1/perc): elgörbültek a(z) ${cyl + 1}. henger szelepei – a henger kiesett!`);
    }
    // határolón tartás / hideg motor kínzása → hajtókar-csapágy kopás
    let wear = 0;
    if (s.revLimiter && s.running) wear += 1 / 150;
    if (newRpm > 6000) wear += 1 / 900;
    if (s.oilTempC < 45 && newRpm > 4500) wear += 1 / 70;
    if (s.oilTempC > 140 && newRpm > 3000) wear += 1 / 120;
    if (wear > 0) {
      const before = d.bearing;
      d.bearing = Math.min(1, d.bearing + wear * dt);
      if (before < 0.35 && d.bearing >= 0.35) logDamage(s, "Túljáratás: kopog a hajtókar-csapágy, esik az olajnyomás! Kíméld a motort, különben beragad.");
      if (before < 0.75 && d.bearing >= 0.75) logDamage(s, "Erős csapágykopogás – a motor bármikor beragadhat!");
    }
    if (d.bearing >= 1) {
      d.seized = true;
      s.running = false;
      logDamage(s, "A hajtókar-csapágy megfutott – a motor BERAGADT.");
    }
    // túlmelegedés → hengerfej-tömítés → beragadás
    if (s.tempC > 120) {
      const before = d.headGasket;
      d.headGasket = Math.min(1, d.headGasket + ((s.tempC - 120) / 10) * dt / 25);
      if (before < 0.2 && d.headGasket >= 0.2) logDamage(s, "Túlmelegedés: kiégett a hengerfej-tömítés – fogy a hűtőfolyadék, fehér füst!");
    }
    if (s.tempC >= 132 && s.running) {
      d.seized = true;
      s.running = false;
      logDamage(s, "TÚLMELEGEDÉS – a dugattyúk beszorultak, a motor BERAGADT.");
    }
    // hideg olaj + nagy töltőnyomás → turbó csapágy
    if (s.oilTempC < 35 && s.boostKPa > 80) {
      const before = d.turbo;
      d.turbo = Math.min(1, d.turbo + dt / 40);
      if (before < 0.3 && d.turbo >= 0.3) logDamage(s, "Hideg olajjal teljes töltőnyomás – sérült a turbó csapágya (füstöl, sípol).");
    }
  }

  s.peakRpm = Math.max(s.peakRpm, newRpm);
  s.rpm = newRpm;
  s.t += dt;
}

export function stepFor(s: SimState, c: Controls, seconds: number, dt: number = DT): void {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) step(s, c, dt);
}

export const defaultControls = (): Controls => ({
  throttle: 0,
  brake: 0,
  clutch: 0,
  starter: false,
  ignition: false,
  gear: 0,
  epbSwitch: 0,
  autoHold: false,
  steer: 0,
  mode: "normal",
  doorOpen: false,
  seatbelt: true,
  lights: false,
});

/** Fokozat → motorfordulat adott sebességnél (1/perc). */
export function rpmAtSpeed(g: Gear, speedMs: number): number {
  return ((speedMs / DRIVETRAIN.wheelRadius) * DRIVETRAIN.gearRatios[g] * DRIVETRAIN.finalDrive * RPM);
}
