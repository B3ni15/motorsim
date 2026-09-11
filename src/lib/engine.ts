/**
 * Fizikai modell: BMW M52B28 – 2.8 literes, soros hathengeres, DOHC 24 szelepes benzinmotor
 * (E36 328i) + kuplung + ZF 5 fokozatú váltó + hátsókerék-hajtású jármű.
 * Minden érték SI (rad/s, Nm, kg, m).
 */

export type Gear = 0 | 1 | 2 | 3 | 4 | 5;

export interface Controls {
  /** 0..1 gázpedál */
  throttle: number;
  /** 0..1 fékpedál */
  brake: number;
  /** 0..1 kuplungpedál (1 = teljesen benyomva = szétkapcsolva) */
  clutch: number;
  /** önindító nyomva */
  starter: boolean;
  /** gyújtás bekapcsolva */
  ignition: boolean;
  gear: Gear;
}

export interface SimState {
  t: number;
  /** főtengely szögsebesség rad/s */
  omega: number;
  /** főtengely szög rad, 0..4π (egy teljes 720°-os ciklus) */
  crank: number;
  rpm: number;
  running: boolean;
  /** hányszor fulladt le */
  stalls: number;
  fuelL: number;
  tempC: number;
  /** m/s */
  speed: number;
  /** tényleges fojtószelep állás (alapjárat-szabályzóval) */
  effThrottle: number;
  idleTrim: number;
  engineTorque: number;
  clutchTorque: number;
  clutchSlip: number;
  /** fordulatszám-határoló aktív */
  revLimiter: boolean;
  /** indítás elkapási számláló (s) */
  catchTimer: number;
  /** bar */
  oilPressure: number;
  /** kW */
  powerKW: number;
  /** L/100km pillanatnyi (0 ha áll) */
  consumption: number;
  /** utolsó esemény szövege */
  event: string;
  eventAt: number;
  /** elhasznált üzemanyag összesen (L) */
  fuelUsedL: number;
  /** megtett út (m) */
  distance: number;
  /** utolsó beindulás ideje */
  startedAt: number;
  /** pillanatnyi fogyasztás L/h */
  fuelRateLh: number;
  /** olajhőmérséklet °C */
  oilTempC: number;
  /** szívócső abszolút nyomás kPa */
  mapKPa: number;
  /** levegő tömegáram g/s */
  airGs: number;
  /** szívólevegő hőmérséklet °C */
  intakeAirC: number;
  /** tényleges levegő/üzemanyag arány */
  afr: number;
  /** injektor nyitási idő ms (hengerenként, ciklusonként) */
  injectorMs: number;
  /** üzemanyag tömegáram g/s */
  fuelGs: number;
  /** kipufogógáz hőmérséklet °C */
  exhaustC: number;
  /** hűtőventilátor jár */
  fan: boolean;
  /** termosztát nyitás 0..1 */
  thermostat: number;
  /** túlmelegedés miatti motorkár (0..1) */
  damage: number;
  /** akkumulátor töltöttség 0..1 */
  batterySoc: number;
  /** akkumulátor kapocsfeszültség V */
  batteryV: number;
  /** generátor áram A */
  altA: number;
  /** fogyasztók árama A (önindító nélkül) */
  loadA: number;
  /** önindító árama A */
  starterA: number;
  /** generátor terhelő nyomatéka a motoron Nm */
  altTorque: number;
  /** generátor fordulat 1/perc */
  altRpm: number;
  /** töltés-visszajelző lámpa */
  batteryLamp: boolean;
  /** hengerfej hőmérséklet °C */
  headTempC: number;
  /** akkumulátor hőmérséklet °C */
  batteryTempC: number;
  /** katalizátor hőmérséklet °C */
  catTempC: number;
  /** kipufogógáz tömegáram g/s */
  exhaustGs: number;
  /** végcső gázhőmérséklet °C */
  tailpipeC: number;
  /** első féktárcsa hőmérséklet °C */
  brakeFrontC: number;
  /** hátsó féktárcsa hőmérséklet °C */
  brakeRearC: number;
  /** fékfolyadék hőmérséklet °C */
  brakeFluidC: number;
  /** fék hatásfok 0..1 (fading, forrás) */
  brakeEff: number;
  /** pillanatnyi fékteljesítmény kW */
  brakePowerKW: number;
}

export const ENGINE = {
  name: "BMW M52B28",
  displacementL: 2.793,
  cylinders: 6,
  boreMm: 84,
  strokeMm: 84,
  rodMm: 135,
  compression: 10.2,
  inertia: 0.22, // kg·m² (főtengely + kettős tömegű lendkerék)
  idleRpmWarm: 700,
  idleRpmCold: 1000,
  stallRpm: 350,
  fireRpm: 180,
  revLimit: 6500,
  revLimitReset: 6300,
  tankL: 65,
  fuelDensity: 0.745, // kg/L
  bsfc: 265, // g/kWh
  firingOrder: [1, 5, 3, 6, 2, 4] as const,
  powerKW: 142,
  peakTorqueNm: 280,
};

export const ELECTRICAL = {
  batteryAh: 60,
  batteryInternalOhm: 0.012,
  regulatorV: 14.2,
  altMaxA: 90,
  altRatio: 2.6, // szíjáttétel főtengely → generátor
  starterA: 170,
  ecuA: 4,
  fuelPumpA: 6,
  fanA: 18,
  ignitionCoilsA: 3,
};

export const DRIVETRAIN = {
  // ZF S5D 320Z + 2.93 differenciálmű (E36 328i)
  gearRatios: [0, 4.21, 2.49, 1.66, 1.24, 1.0],
  finalDrive: 2.93,
  wheelRadius: 0.316, // 225/50 R16
  efficiency: 0.9,
  clutchMaxTorque: 420,
  massKg: 1420,
  dragCoef: 0.5 * 1.2 * 0.32 * 2.05, // 0.5·ρ·Cd·A
  rollCoef: 0.012,
  brakeForce: 13000,
  wheelbaseM: 2.7,
  trackM: 1.46,
};

const RPM = 60 / (2 * Math.PI);

/** Teljes gáz nyomaték görbe (Nm) fordulatszám függvényében. */
export function wotTorque(rpm: number): number {
  // M52B28: 280 Nm @ 3950, 142 kW @ 5300
  const pts: [number, number][] = [
    [0, 110],
    [500, 150],
    [1000, 190],
    [1500, 215],
    [2000, 235],
    [3000, 262],
    [3950, 280],
    [4500, 276],
    [5300, 256],
    [6000, 238],
    [6500, 212],
    [7500, 120],
  ];
  if (rpm <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (rpm <= pts[i][0]) {
      const [r0, t0] = pts[i - 1];
      const [r1, t1] = pts[i];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Súrlódás + szivattyúzási veszteség (Nm). */
export function frictionTorque(rpm: number, throttle: number, tempC: number): number {
  const cold = 1 + Math.max(0, (60 - tempC) / 60) * 0.6; // hideg olaj sűrűbb
  const pumping = (1 - throttle) * 9; // zárt fojtószelep → szívási veszteség
  return (11 + 0.0045 * rpm) * cold + pumping;
}

/** Önindító nyomaték (Nm) – kb. 280 1/perc-ig hajt. */
export function starterTorque(rpm: number): number {
  return Math.max(0, 80 * (1 - rpm / 400));
}

export interface CylinderInfo {
  index: number; // 1..4
  /** 0..1, 0 = FHP (felső holtpont), 1 = AHP */
  piston: number;
  /** 0..720 fok ütemhelyzet, 0 = munkaütem kezdete */
  phase: number;
  stroke: "munka" | "kipufogó" | "szívó" | "sűrítő";
  intake: number; // szelepnyitás 0..1
  exhaust: number;
  spark: boolean;
  /** égési fényerő 0..1 */
  burn: number;
}

/** index 1..6 → ciklusszög eltolás (fok), gyújtási sorrend 1-5-3-6-2-4, 120°-onként */
const CYL_OFFSET = [0, 0, 480, 240, 600, 120, 360];

function valveLift(phase: number, open: number, close: number): number {
  // szinusz-szerű emelés open..close között
  if (phase < open || phase > close) return 0;
  return Math.sin(((phase - open) / (close - open)) * Math.PI);
}

export function cylinderKinematics(crank: number, running: boolean): CylinderInfo[] {
  const r = ENGINE.strokeMm / 2;
  const l = ENGINE.rodMm;
  const cycleDeg = ((crank * 180) / Math.PI) % 720;
  const out: CylinderInfo[] = [];
  for (let i = 1; i <= ENGINE.cylinders; i++) {
    const phase = (((cycleDeg - CYL_OFFSET[i]) % 720) + 720) % 720;
    const th = (phase * Math.PI) / 180;
    // dugattyú távolság a főtengely középpontjától
    const x = r * Math.cos(th) + Math.sqrt(l * l - r * r * Math.sin(th) ** 2);
    const piston = (l + r - x) / (2 * r); // 0 FHP, 1 AHP
    let stroke: CylinderInfo["stroke"];
    if (phase < 180) stroke = "munka";
    else if (phase < 360) stroke = "kipufogó";
    else if (phase < 540) stroke = "szívó";
    else stroke = "sűrítő";
    const exhaust = valveLift(phase, 150, 375);
    const intake = valveLift(phase, 345, 570);
    const spark = running && (phase < 8 || phase > 705);
    const burn = running && phase < 120 ? Math.sin((phase / 120) * Math.PI) : 0;
    out.push({ index: i, piston, phase, stroke, intake, exhaust, spark, burn });
  }
  return out;
}

/** Nyomaték-lüktetés szorzó: átlaga 1, négy hengeres gyújtás szerint. */
function torquePulse(crank: number): number {
  const cycleDeg = ((crank * 180) / Math.PI) % 720;
  let s = 0;
  for (let i = 1; i <= ENGINE.cylinders; i++) {
    const phase = (((cycleDeg - CYL_OFFSET[i]) % 720) + 720) % 720;
    if (phase < 180) s += Math.sin((phase * Math.PI) / 180);
  }
  return (s * 2 * Math.PI) / ENGINE.cylinders; // Σ átlaga N/(2π) → normalizálva 1
}

export function createState(opts: Partial<SimState> = {}): SimState {
  return {
    t: 0,
    omega: 0,
    crank: 0,
    rpm: 0,
    running: false,
    stalls: 0,
    fuelL: 25,
    tempC: 20,
    speed: 0,
    effThrottle: 0,
    idleTrim: 0.06,
    engineTorque: 0,
    clutchTorque: 0,
    clutchSlip: 0,
    revLimiter: false,
    catchTimer: 0,
    oilPressure: 0,
    powerKW: 0,
    consumption: 0,
    event: "",
    eventAt: -10,
    fuelUsedL: 0,
    distance: 0,
    startedAt: -10,
    fuelRateLh: 0,
    oilTempC: 20,
    mapKPa: 101.3,
    airGs: 0,
    intakeAirC: 20,
    afr: 0,
    injectorMs: 0,
    fuelGs: 0,
    exhaustC: 20,
    fan: false,
    thermostat: 0,
    damage: 0,
    batterySoc: 0.85,
    batteryV: 12.65,
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
    ...opts,
  };
}

function setEvent(s: SimState, msg: string) {
  s.event = msg;
  s.eventAt = s.t;
}

export const DT = 0.0005;

/** Egy fizikai lépés (dt másodperc). Mutálja az állapotot. */
export function step(s: SimState, c: Controls, dt: number = DT): void {
  const rpm = s.omega * RPM;
  const ambient = 20;

  // ---- gyújtás / üzemállapot ----
  const canFire = c.ignition && s.fuelL > 0 && rpm >= ENGINE.fireRpm && s.damage < 1;
  if (s.running) {
    if (!c.ignition) {
      s.running = false;
      setEvent(s, "Gyújtás kikapcsolva – motor leállt");
    } else if (s.fuelL <= 0) {
      s.running = false;
      setEvent(s, "Kifogyott az üzemanyag!");
    } else if (s.tempC >= 128) {
      s.running = false;
      s.damage = 1;
      setEvent(s, "TÚLMELEGEDÉS – a motor beragadt!");
    } else if (rpm < ENGINE.stallRpm && !c.starter && s.t - s.startedAt > 1.0) {
      s.running = false;
      s.stalls++;
      setEvent(s, "A motor lefulladt!");
    }
  } else if (canFire) {
    // indítás: hidegen lassabban kap el
    const catchTime = 0.35 + Math.max(0, (40 - s.tempC) / 40) * 0.9;
    s.catchTimer += dt;
    if (s.catchTimer >= catchTime) {
      s.running = true;
      s.catchTimer = 0;
      s.startedAt = s.t;
      setEvent(s, c.starter ? "Motor beindult" : "Motor betolással beindult");
    }
  } else {
    s.catchTimer = 0;
  }

  // ---- fordulatszám-határoló ----
  if (rpm > ENGINE.revLimit) s.revLimiter = true;
  else if (rpm < ENGINE.revLimitReset) s.revLimiter = false;

  // ---- alapjárat-szabályzó (PI) ----
  const idleTarget = ENGINE.idleRpmWarm + (ENGINE.idleRpmCold - ENGINE.idleRpmWarm) * Math.max(0, Math.min(1, (70 - s.tempC) / 50));
  if (s.running) {
    const err = (idleTarget - rpm) / 1000;
    s.idleTrim += err * 0.6 * dt;
    s.idleTrim = Math.max(0.03, Math.min(0.3, s.idleTrim));
  }
  const idleP = s.running ? Math.max(0, (idleTarget - rpm) / 1000) * 0.4 : 0;
  const throttle = Math.max(0, Math.min(1, c.throttle));
  const effThrottle = Math.max(throttle, s.running ? Math.min(0.35, s.idleTrim + idleP) : 0);
  s.effThrottle = effThrottle;

  // ---- motor nyomaték ----
  const coldFactor = 1 - Math.max(0, (30 - s.tempC) / 30) * 0.15;
  let indicated = 0;
  if (s.running && !s.revLimiter) {
    // levegő-tömegáram nem lineáris a fojtószelep szöggel
    const airflow = 1 - Math.pow(1 - effThrottle, 2.2);
    const heatDerate = 1 - Math.max(0, (s.tempC - 108) / 20) * 0.35; // kopogás-védelem: késleltetett gyújtás
    indicated = wotTorque(rpm) * airflow * coldFactor * heatDerate * torquePulse(s.crank);
  }
  const friction = frictionTorque(rpm, effThrottle, s.oilTempC);
  // önindító: az akkumulátor feszültségétől függ (lemerülve nem forgatja)
  const ocv = 11.7 + 1.1 * Math.max(0, Math.min(1, s.batterySoc));
  const coldBat = 1 + Math.max(0, (10 - s.batteryTempC) / 30); // hidegen nő a belső ellenállás
  const lowSoc = 1 + 4 * Math.pow(1 - Math.max(0, Math.min(1, s.batterySoc)), 6); // lemerülve meredeken nő
  const rInt = ELECTRICAL.batteryInternalOhm * coldBat * lowSoc;
  const crankV = ocv - ELECTRICAL.starterA * rInt;
  const starterStrength = Math.max(0, Math.min(1, (crankV - 7.5) / 3));
  const starterT = c.starter && !s.running ? starterTorque(rpm) * starterStrength : c.starter ? starterTorque(rpm) * 0.3 * starterStrength : 0;
  if (c.starter && !s.running && starterStrength < 0.15 && s.t - s.eventAt > 3) setEvent(s, "Lemerült az akkumulátor – az önindító nem forgat!");
  // sűrítési ellennyomaték ha nem jár (indításkor "rángat")
  const compression = !s.running ? -4 * Math.max(0, Math.sin(2 * s.crank)) : 0;
  s.engineTorque = indicated - friction * (s.omega > 0 ? 1 : 0);

  // ---- kuplung + hajtáslánc ----
  const ratio = DRIVETRAIN.gearRatios[c.gear] * DRIVETRAIN.finalDrive;
  const clutchPedal = Math.max(0, Math.min(1, c.clutch));
  // pedál 0..0.3 = teljesen kapcsolt, 0.3..0.85 fokozatos, >0.85 szétkapcsolt
  const engage = Math.max(0, Math.min(1, (0.85 - clutchPedal) / 0.55));
  const capacity = DRIVETRAIN.clutchMaxTorque * engage * engage;
  let clutchT = 0;
  let slip = 0;
  if (c.gear !== 0 && capacity > 0) {
    const wheelOmega = s.speed / DRIVETRAIN.wheelRadius;
    slip = s.omega - wheelOmega * ratio;
    clutchT = capacity * Math.tanh(slip / 3);
  }
  s.clutchTorque = clutchT;
  s.clutchSlip = slip;

  // ---- főtengely dinamika ----
  const netEngine = s.engineTorque + starterT + compression - clutchT - s.altTorque;
  s.omega += (netEngine / ENGINE.inertia) * dt;
  if (s.omega < 0) s.omega = 0;
  s.crank = (s.crank + s.omega * dt) % (4 * Math.PI);

  // ---- jármű dinamika ----
  const wheelForce = (clutchT * ratio * DRIVETRAIN.efficiency) / DRIVETRAIN.wheelRadius;
  const drag = DRIVETRAIN.dragCoef * s.speed * s.speed;
  const roll = DRIVETRAIN.rollCoef * DRIVETRAIN.massKg * 9.81;
  // fék: tárcsa-hőmérséklettől függő hatásfok (fading 450 °C felett), forró fékfolyadék → pedál "elmegy"
  const fadeF = 1 - 0.55 * Math.max(0, Math.min(1, (s.brakeFrontC - 450) / 250));
  const fadeR = 1 - 0.55 * Math.max(0, Math.min(1, (s.brakeRearC - 450) / 250));
  const fluidF = s.brakeFluidC > 230 ? Math.max(0.15, 1 - (s.brakeFluidC - 230) / 60) : 1;
  s.brakeEff = (0.65 * fadeF + 0.35 * fadeR) * fluidF;
  const brake = DRIVETRAIN.brakeForce * Math.max(0, Math.min(1, c.brake)) * s.brakeEff;
  let net = wheelForce - drag;
  if (s.speed > 0.01) {
    net -= roll + brake;
  } else if (net <= roll + brake) {
    net = 0; // tapadási súrlódás megtartja
  } else {
    net -= roll + brake;
  }
  s.speed += (net / DRIVETRAIN.massKg) * dt;
  if (s.speed < 0) s.speed = 0;
  s.distance += s.speed * dt;

  // ---- ECU / befecskendezés (multipoint EFI) ----
  const newRpm = s.omega * RPM;
  const powerW = Math.max(0, indicated) * s.omega;
  s.powerKW = powerW / 1000;
  const airflowF = 1 - Math.pow(1 - effThrottle, 2.2);
  // szívócső nyomás: zárt fojtónál vákuum, magasabb fordulaton mélyebb
  const vacFloor = 0.3 - Math.min(0.12, (newRpm / 6000) * 0.12);
  const mapFrac = s.running || newRpm > 50 ? vacFloor + (1 - vacFloor) * airflowF : 1;
  s.mapKPa = 101.3 * mapFrac;
  s.intakeAirC = ambient + Math.max(0, s.tempC - ambient) * 0.12;
  const airDensity = (1.2 * 293) / (273 + s.intakeAirC); // g/L
  const ve = 0.78 + 0.14 * Math.sin((Math.min(newRpm, 6000) / 6000) * Math.PI); // töltési fok
  const airGs = s.running ? ve * ENGINE.displacementL * (newRpm / 120) * airDensity * mapFrac : 0;
  s.airGs = airGs;
  // cél-keverék: melegen sztöchiometrikus, hidegen dúsítás, teljes gáznál dúsítás
  let afrTarget = 14.7;
  afrTarget -= Math.max(0, (60 - s.tempC) / 60) * 2.6; // hidegindítási dúsítás
  if (effThrottle > 0.85) afrTarget = Math.min(afrTarget, 12.8);
  const fuelGs = s.running && !s.revLimiter ? airGs / afrTarget : 0;
  s.fuelGs = fuelGs;
  s.afr = fuelGs > 0 ? airGs / fuelGs : 0;
  // injektor: 6 injektor, ciklusonként (2 fordulat) egy nyitás, 2.6 g/s áramlás
  const injPerSec = newRpm / 120;
  s.injectorMs = fuelGs > 0 && injPerSec > 0 ? (fuelGs / ENGINE.cylinders / injPerSec / 2.6) * 1000 : 0;
  const fuelL = (fuelGs / 1000 / ENGINE.fuelDensity) * dt;
  s.fuelL = Math.max(0, s.fuelL - fuelL);
  s.fuelUsedL += fuelL;
  s.fuelRateLh = (fuelGs / 1000 / ENGINE.fuelDensity) * 3600;
  s.consumption = s.speed > 1 ? ((fuelGs / 1000 / ENGINE.fuelDensity) * 3600 * 100) / (s.speed * 3.6) : 0;
  // kipufogógáz hőmérséklet
  const egtTarget = s.running ? 320 + 520 * mapFrac + newRpm / 30 : ambient;
  s.exhaustC += (egtTarget - s.exhaustC) * Math.min(1, dt / (s.running ? 4 : 60));

  // ---- hőháztartás (hűtővíz + olaj) ----
  // hőbevitel: az üzemanyag energiájának ~30%-a a hűtővízbe, súrlódás az olajba
  const fuelPowerW = fuelGs * 43000; // J/s (43 MJ/kg)
  const frictionHeatW = friction * s.omega;
  const coolantHeatIn = fuelPowerW * 0.28 + frictionHeatW * 0.5;
  // termosztát: 84 °C-nál kezd nyitni, 92-nél teljesen (lassú viasz-elem)
  const thermoTarget = Math.max(0, Math.min(1, (s.tempC - 84) / 8));
  s.thermostat += (thermoTarget - s.thermostat) * Math.min(1, dt / 8);
  // ventilátor: 97 °C-nál be, 92-nél ki (hiszterézis), csak gyújtásnál
  if (c.ignition && s.tempC > 97) s.fan = true;
  else if (!c.ignition || s.tempC < 92) s.fan = false;
  // hűtő: menetszél + ventilátor; álló autó ventilátor nélkül gyengén hűt
  const radiatorAir = 0.15 + s.speed * 0.08 + (s.fan ? 0.6 : 0);
  // vízpumpa a motorról jár: álló motornál nincs keringés
  const pump = Math.min(1, newRpm / 800);
  const radiatorK = 340 * s.thermostat * radiatorAir * pump; // W/K
  const blockLossK = 3.5 + s.speed * 0.15; // természetes konvekció: órák alatt hűl le
  const C_COOL = 68000; // J/K (víz + blokk fémje – hőt tárol, lassan hűl)
  const C_OIL = 15000;
  const oilCoolantK = 250; // olaj–hűtővíz hőcsere W/K
  const coolantOut = (s.tempC - ambient) * (radiatorK + blockLossK) + (s.tempC - s.oilTempC) * oilCoolantK;
  const oilOut = (s.oilTempC - ambient) * (5 + s.speed * 0.3) + (s.oilTempC - s.tempC) * oilCoolantK;
  s.tempC += ((coolantHeatIn - coolantOut) / C_COOL) * dt;
  s.oilTempC += ((frictionHeatW * 0.4 + fuelPowerW * 0.04 - oilOut) / C_OIL) * dt;
  if (s.tempC > 135) s.tempC = 135;
  if (s.oilTempC > 160) s.oilTempC = 160;

  // ---- elektromos rendszer: akkumulátor, generátor, fogyasztók ----
  s.altRpm = newRpm * ELECTRICAL.altRatio;
  const altCapacity = ELECTRICAL.altMaxA * Math.max(0, Math.min(1, (s.altRpm - 1100) / 2400));
  let loadA = 0;
  if (c.ignition) loadA += ELECTRICAL.ecuA + ELECTRICAL.fuelPumpA + (s.running ? ELECTRICAL.ignitionCoilsA + s.injectorMs * 0.4 : 0);
  if (s.fan) loadA += ELECTRICAL.fanA;
  const starterA = c.starter && !s.running ? ELECTRICAL.starterA : c.starter ? ELECTRICAL.starterA * 0.5 : 0;
  s.loadA = loadA;
  s.starterA = starterA;
  // szabályzó: 14.2 V-ra tölt, amíg az akku felveszi
  const chargeDemand = Math.min(45, 70 * (1 - s.batterySoc)) * (s.batterySoc < 0.995 ? 1 : 0);
  const altA = c.ignition ? Math.min(altCapacity, loadA + starterA + chargeDemand) : 0;
  s.altA = altA;
  const netA = altA - loadA - starterA; // + töltés, − kisütés
  const capAs = ELECTRICAL.batteryAh * 3600;
  s.batterySoc = Math.max(0, Math.min(1, s.batterySoc + (netA * dt) / capAs));
  // kapocsfeszültség: ha a generátor bírja a terhelést, a szabályzó ~14.2 V-ot tart
  const shortfall = loadA + starterA + chargeDemand - altCapacity;
  s.batteryV = c.ignition && altCapacity > 0 && shortfall <= 0 ? ELECTRICAL.regulatorV - Math.min(0.3, chargeDemand * 0.004) : Math.max(0, ocv + Math.min(0, netA) * rInt);
  // generátor terhelése a motoron (hatásfok ~55%)
  const altP = altA * Math.max(s.batteryV, 12);
  s.altTorque = s.omega > 5 ? altP / (s.omega * 0.55) + 0.4 : 0;
  s.batteryLamp = c.ignition && altCapacity < loadA;
  // akkumulátor melegszik a motortérben, kicsit a töltéstől is
  s.batteryTempC += (((ambient + (s.tempC - ambient) * 0.08 + Math.abs(netA) * 0.05) - s.batteryTempC) / 900) * dt; // csomagtartóban
  // hengerfej: a hűtővíznél melegebb, terhelés szerint
  const headTarget = s.tempC + (s.running ? 8 + 35 * mapFrac : 2);
  s.headTempC += ((headTarget - s.headTempC) / 20) * dt;

  // ---- fékek hőháztartása ----
  const brakeW = brake * s.speed; // súrlódási teljesítmény
  s.brakePowerKW = brakeW / 1000;
  const C_DISC_F = 2 * 6.5 * 460; // 2 tárcsa × 6.5 kg acél
  const C_DISC_R = 2 * 4.5 * 460;
  const coolK = (t: number) => 9 + s.speed * 1.1 + Math.max(0, t - 300) * 0.05; // menetszél + sugárzás
  s.brakeFrontC += ((brakeW * 0.65 - (s.brakeFrontC - ambient) * coolK(s.brakeFrontC)) / C_DISC_F) * dt;
  s.brakeRearC += ((brakeW * 0.35 - (s.brakeRearC - ambient) * coolK(s.brakeRearC)) / C_DISC_R) * dt;
  // fékfolyadék a nyeregben: a tárcsáról kap hőt, lassan
  const hottest = Math.max(s.brakeFrontC, s.brakeRearC);
  s.brakeFluidC += (((hottest - s.brakeFluidC) * 0.9 - (s.brakeFluidC - ambient) * 0.6) / 1200) * dt;
  if (s.brakeFrontC > 520 && s.t - s.eventAt > 8) setEvent(s, "Fékfading – a féktárcsák túl forróak!");
  if (s.brakeFluidC > 230 && s.t - s.eventAt > 8) setEvent(s, "A fékfolyadék forr – a pedál elmegy!");

  // ---- kipufogórendszer ----
  s.exhaustGs = airGs + fuelGs;
  // katalizátor: a gáz fűti (áramtól függő idő), 250 °C felett "begyújt" és a maradék CH/CO égése tovább fűti
  const flowF = Math.min(1, s.exhaustGs / 40);
  const catLit = s.catTempC > 250 ? 1 : 0;
  const catTarget = s.running ? s.exhaustC * 0.8 + catLit * 60 + 20 : ambient;
  s.catTempC += ((catTarget - s.catTempC) / (s.running ? 25 / (0.15 + flowF) : 240)) * dt;
  const tailTarget = s.running ? 60 + (s.catTempC - 60) * 0.45 : ambient;
  s.tailpipeC += ((tailTarget - s.tailpipeC) / (s.running ? 30 : 300)) * dt;

  // ---- egyéb ----
  // olajnyomás: viszkozitás az olajhőmérséklettől függ
  s.oilPressure = Math.min(6.5, (newRpm / 1000) * (1.0 + Math.max(0, (100 - s.oilTempC) / 100) * 2.2));
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
  clutch: 1,
  starter: false,
  ignition: false,
  gear: 0,
});
