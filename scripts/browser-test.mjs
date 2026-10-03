/**
 * Böngészős tesztek (Playwright + Chromium): illeszkedés-ellenőrzés, vezetés, váltókar húzása, nézetek, hang.
 * Használat: npm run dev (másik terminálban), majd: npm run test:browser
 * Környezeti változók: BASE_URL (alap: http://localhost:3000), CHROME (Chromium útvonal), SHOTS (képernyőkép-mappa)
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "test-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
let failed = 0;
const check = (name, ok, info = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${info ? " – " + info : ""}`);
  if (!ok) failed++;
};
const errors = [];
const newPage = async () => {
  const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return p;
};

// 1) illeszkedés: minden alkatrész a karosszérián belül
{
  const p = await newPage();
  await p.goto(`${BASE}/teszt?fit=1`, { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForSelector("[data-testid=fit]", { timeout: 180000 });
  const r = await p.evaluate(() => window.__fit);
  check("illeszkedés-ellenőrzés", r.issues.length === 0, `${r.checked} alkatrész, ${r.issues.length} hiba${r.issues.length ? ": " + JSON.stringify(r.issues.slice(0, 5)) : ""}`);
  await p.close();
}

// 2) vezetés a fő oldalon
const p = await newPage();
await p.addInitScript(() => {
  const Orig = window.AudioContext;
  window.AudioContext = class extends Orig {
    constructor(...a) {
      super(...a);
      window.__actx = this;
    }
  };
});
await p.goto(BASE, { waitUntil: "networkidle", timeout: 180000 });
await p.waitForTimeout(5000);
const st = () =>
  p.evaluate(() => {
    const g = window.__golf;
    const s = g.stateRef.current;
    const c = g.controlsRef.current;
    return { running: s.running, rpm: s.rpm, kmh: s.speed * 3.6, gear: c.gear, epb: s.epb, grind: s.grindCount };
  });
await p.getByRole("button", { name: /Hang KI/ }).click({ timeout: 120000 });
await p.keyboard.down(" ");
await p.waitForTimeout(400);
await p.keyboard.press("i");
await p.waitForTimeout(3500);
let s = await st();
check("Start/Stop kuplunggal beindít", s.running, `${Math.round(s.rpm)} 1/perc`);
check("hang: AudioContext fut", (await p.evaluate(() => window.__actx?.state)) === "running");
check("hang: szól alapjáraton", (await p.evaluate(() => window.__golf.audioLevel())) > 0.003);
await p.keyboard.press("1");
await p.evaluate(() => (window.__golf.controlsRef.current.throttle = 0.3));
await p.keyboard.up(" ");
await p.waitForTimeout(3000);
await p.keyboard.down("w");
await p.waitForTimeout(2000);
await p.keyboard.up("w");
s = await st();
check("elindul, az EPB magától kiold", s.kmh > 5 && s.epb === "released" && s.running, `${s.kmh.toFixed(0)} km/h, EPB ${s.epb}`);
await p.keyboard.down(" ");
await p.waitForTimeout(300);
await p.keyboard.press("2");
await p.keyboard.up(" ");
check("kuplunggal 2-esbe vált", (await st()).gear === 2);
// megvárjuk, míg a kuplung teljesen felenged
for (let i = 0; i < 60 && (await p.evaluate(() => window.__golf.controlsRef.current.clutch)) > 0.05; i++) await p.waitForTimeout(250);
const g0 = (await st()).grind;
await p.keyboard.press("3");
await p.waitForTimeout(300);
s = await st();
check("kuplung nélkül csikorog, nem kapcsol", s.grind === g0 + 1 && s.gear === 0);
await p.screenshot({ path: `${SHOTS}/kulso.png`, timeout: 180000 });

// 3) nézetek
for (const v of ["belso", "motorter", "uldozo", "r-teljes", "r-motor", "r-hengerek", "r-hajtas", "r-fek", "r-turbo", "kulso"]) {
  await p.evaluate((v) => {
    window.__camDone = false;
    window.__golf.setView(v);
  }, v);
  for (let i = 0; i < 90; i++) {
    await p.waitForTimeout(1000);
    if (await p.evaluate(() => window.__camDone)) break;
  }
  const cam = await p.evaluate(() => {
    const st3 = window.__three;
    const car = st3.scene.getObjectByName("Car");
    const c = st3.camera.position.clone();
    car.worldToLocal(c);
    return c.toArray();
  });
  check(`nézet: ${v}`, await p.evaluate(() => window.__camDone), `kamera (autó koord.) ${cam.map((x) => x.toFixed(2)).join(", ")}`);
  await p.screenshot({ path: `${SHOTS}/${v}.png`, timeout: 180000 });
}

// 4) váltókar húzása belső nézetben
await p.evaluate(() => {
  window.__camDone = false;
  window.__golf.setView("belso");
  const g = window.__golf;
  g.stateRef.current.speed = 0;
  g.controlsRef.current.clutch = 1;
});
for (let i = 0; i < 90; i++) {
  await p.waitForTimeout(1000);
  if (await p.evaluate(() => window.__camDone)) break;
}
const knob = async () =>
  p.evaluate(() => {
    const st3 = window.__three;
    const r = st3.gl.domElement.getBoundingClientRect();
    let k = null;
    st3.scene.traverse((o) => {
      if (o.isMesh && o.geometry.type === "SphereGeometry" && Math.abs(o.geometry.parameters.radius - 0.033) < 1e-6) k = o;
    });
    const v = st3.camera.position.clone();
    k.getWorldPosition(v);
    v.project(st3.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  });
let k = await knob();
await p.mouse.move(k.x, k.y);
await p.mouse.down();
await p.mouse.move(k.x - 58, k.y - 10, { steps: 6 });
await p.mouse.move(k.x - 58, k.y - 60, { steps: 6 });
await p.waitForTimeout(1000);
check("váltókar húzása: 1-es", (await st()).gear === 1);
await p.mouse.up();
await p.waitForTimeout(2500);
k = await knob();
await p.mouse.move(k.x, k.y);
await p.mouse.down();
await p.mouse.move(k.x, k.y + 45, { steps: 5 });
await p.mouse.move(k.x + 55, k.y + 45, { steps: 5 });
await p.mouse.move(k.x + 55, k.y + 100, { steps: 6 });
await p.waitForTimeout(1000);
await p.mouse.up();
check("váltókar húzása: 4-es", (await st()).gear === 4);

check("nincs konzolhiba", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
console.log(failed ? `\n${failed} hiba` : "\nMinden böngészős teszt sikeres");
process.exit(failed ? 1 : 0);
