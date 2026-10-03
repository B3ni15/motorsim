"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  createState,
  defaultControls,
  step,
  DT,
  ENGINE,
  gearLabel,
  gearUsable,
  pressStartStop,
  shift,
  type Controls,
  type DriveMode,
  type Gear,
  type SimState,
} from "@/lib/engine";
import { CarAudio } from "@/lib/audio";
import { warningLights } from "@/lib/warnings";
import Gauge from "./Gauge";
import { blinkOn, defaultBody, type BodyCtl, type Interact, type LeverState } from "./three/context";
import { viewDef, type ViewName } from "./three/views";

const Scene = dynamic(() => import("./three/Scene"), {
  ssr: false,
  loading: () => <div className="h-[600px] grid place-items-center text-slate-400">3D betöltése…</div>,
});

const MAIN_VIEWS: ViewName[] = ["kulso", "belso", "uldozo", "motorter"];
const XRAY_VIEWS: ViewName[] = ["r-teljes", "r-motor", "r-hengerek", "r-hajtas", "r-fek", "r-turbo"];
const MODES: DriveMode[] = ["comfort", "normal", "race"];
const MODE_LABEL: Record<DriveMode, string> = { comfort: "Comfort", normal: "Normal", race: "Race" };
const SHIFT_GATE: (Gear | null)[][] = [
  [-1, 1, 3, 5],
  [null, 2, 4, 6],
];

export default function Simulator() {
  const stateRef = useRef<SimState>(createState());
  const controlsRef = useRef<Controls>(defaultControls());
  const bodyRef = useRef<BodyCtl>(defaultBody());
  const leverRef = useRef<LeverState>({ u: 0, v: 0, dragging: false });
  const keysRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<CarAudio | null>(null);
  const smooth = useRef({ tq: 0, clutch: 0 });
  const epbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chime = useRef({ count: 0, last: 0 });
  const indCancel = useRef({ armed: false });

  const [snap, setSnap] = useState<SimState>(() => ({ ...stateRef.current }));
  const [ctl, setCtl] = useState<Controls>(() => ({ ...controlsRef.current }));
  const [body, setBody] = useState<BodyCtl>(() => ({ ...bodyRef.current }));
  const [sound, setSound] = useState(false);
  const [shiftMsg, setShiftMsg] = useState<{ text: string; at: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<ViewName>("kulso");
  const [labels, setLabels] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const timeScaleRef = useRef(1);
  timeScaleRef.current = timeScale;
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const viewRef = useRef(view);
  viewRef.current = view;

  const syncUi = useCallback(() => {
    setCtl({ ...controlsRef.current });
    setBody({ ...bodyRef.current, doors: [...bodyRef.current.doors] as BodyCtl["doors"] });
  }, []);

  const setControl = useCallback(
    <K extends keyof Controls>(k: K, v: Controls[K]) => {
      controlsRef.current[k] = v;
      syncUi();
    },
    [syncUi],
  );

  const shiftTo = useCallback(
    (g: Gear) => {
      const s = stateRef.current;
      const c = controlsRef.current;
      const r = shift(s, c, g);
      if (!r.ok && r.msg) setShiftMsg({ text: r.msg, at: s.t });
      syncUi();
    },
    [syncUi],
  );

  const startStop = useCallback(() => {
    pressStartStop(stateRef.current, controlsRef.current);
    syncUi();
  }, [syncUi]);

  const epbPulse = useCallback(
    (dir: -1 | 1) => {
      controlsRef.current.epbSwitch = dir;
      if (epbTimer.current) clearTimeout(epbTimer.current);
      epbTimer.current = setTimeout(() => {
        controlsRef.current.epbSwitch = 0;
        syncUi();
      }, 1100);
      syncUi();
    },
    [syncUi],
  );

  const interact = useCallback(
    (a: Interact) => {
      const b = bodyRef.current;
      const c = controlsRef.current;
      switch (a.type) {
        case "shift":
          shiftTo(a.gear);
          break;
        case "startStop":
          startStop();
          break;
        case "epb":
          if (a.dir !== 0) epbPulse(a.dir);
          break;
        case "autoHold":
          c.autoHold = !c.autoHold;
          break;
        case "hazard":
          b.hazard = !b.hazard;
          break;
        case "door":
          b.doors[a.index] = !b.doors[a.index];
          break;
        case "hood":
          b.hood = !b.hood;
          break;
        case "tailgate":
          b.tailgate = !b.tailgate;
          break;
        case "lights":
          b.lights = !b.lights;
          break;
        case "seatbelt":
          c.seatbelt = !c.seatbelt;
          break;
        case "mode":
          c.mode = MODES[(MODES.indexOf(c.mode) + 1) % MODES.length];
          break;
      }
      c.doorOpen = b.doors[0];
      c.lights = b.lights;
      syncUi();
    },
    [shiftTo, startStop, epbPulse, syncUi],
  );

  // ---------------- fő ciklus ----------------
  useEffect(() => {
    let last = performance.now();
    let acc = 0;
    let uiAcc = 0;
    let lastBlink = false;
    const loop = () => {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      if (pausedRef.current) return;
      const keys = keysRef.current;
      const c = controlsRef.current;
      const s = stateRef.current;
      const b = bodyRef.current;
      const ramp = (cur: number, target: number, rate: number) => (cur < target ? Math.min(target, cur + rate * dt) : Math.max(target, cur - rate * dt));
      let changed = false;
      if (keys.has("w") || keys.has("arrowup")) {
        c.throttle = ramp(c.throttle, 1, 2.8);
        changed = true;
      } else if (keys.has("~thr")) {
        c.throttle = ramp(c.throttle, 0, 5);
        changed = true;
        if (c.throttle === 0) keys.delete("~thr");
      }
      if (keys.has("s") || keys.has("arrowdown")) {
        c.brake = ramp(c.brake, 1, 3);
        changed = true;
      } else if (keys.has("~brk")) {
        c.brake = ramp(c.brake, 0, 4);
        changed = true;
        if (c.brake === 0) keys.delete("~brk");
      }
      if (keys.has(" ")) {
        c.clutch = ramp(c.clutch, 1, 6);
        changed = true;
      } else if (keys.has("~clu")) {
        c.clutch = ramp(c.clutch, 0, 0.7); // lassú felengedés = félkuplung
        changed = true;
        if (c.clutch === 0) keys.delete("~clu");
      }
      // kormány: sebességfüggő maximális kitérés, magától visszaáll
      const v = Math.abs(s.speed);
      const maxSteer = 1 / (1 + (v * v) / 500);
      const left = keys.has("a") || keys.has("arrowleft");
      const right = keys.has("d") || keys.has("arrowright");
      if (left !== right) {
        c.steer = ramp(c.steer, (right ? 1 : -1) * maxSteer, 1.4);
        changed = true;
      } else if (c.steer !== 0) {
        c.steer = ramp(c.steer, 0, 2.2);
        changed = true;
      }
      // index önvisszakapcsolás kanyar után
      if (b.indicator !== 0) {
        if (Math.sign(c.steer) === b.indicator && Math.abs(c.steer) > 0.3) indCancel.current.armed = true;
        if (indCancel.current.armed && Math.abs(c.steer) < 0.08) {
          b.indicator = 0;
          indCancel.current.armed = false;
          changed = true;
        }
      }
      c.epbSwitch = keys.has("p") ? 1 : keys.has("o") ? -1 : epbTimer.current ? c.epbSwitch : 0;
      b.horn = keys.has("b");

      // fizika (időlassítás: a pedálok valós időben, a fizika lassítva)
      acc += dt * timeScaleRef.current;
      const dmgBefore = s.dmg.seized;
      while (acc >= DT) {
        step(s, c, DT);
        acc -= DT;
      }
      if (c.ignition === false && s.autoCrank) s.autoCrank = false;
      smooth.current.tq += (s.engineTorque - smooth.current.tq) * 0.08;
      smooth.current.clutch += (s.clutchTorque - smooth.current.clutch) * 0.05;

      // gong: öv / nyitott ajtó menet közben
      const tNow = now / 1000;
      if (c.ignition && ((!c.seatbelt && v > 4) || (b.doors.some(Boolean) && s.running && v > 1)) && tNow - chime.current.last > 1.1) {
        chime.current.last = tNow;
        chime.current.count++;
      }
      // hang
      const blink = (b.indicator !== 0 || b.hazard) && blinkOn(tNow);
      if (audioRef.current?.active) {
        const ts = timeScaleRef.current;
        const vd = viewDef(viewRef.current);
        audioRef.current.update({
          rpm: s.rpm * ts,
          load: Math.max(0, (s.mapKPa - 20) / 81.3) / 2.3,
          throttle: s.effThrottle,
          running: s.running,
          combusting: s.running && !s.overrun && !s.revLimiter,
          overrun: s.overrun,
          starter: (c.starter || s.autoCrank) && !s.running,
          turbo: s.turbo,
          boost: s.boostKPa,
          bovCount: s.bovCount,
          bovLevel: s.bovLevel,
          misfire: s.misfire,
          bearing: s.dmg.bearing,
          knock: s.knockRetard,
          grindCount: s.grindCount,
          crashCount: s.dmg.seized ? 1 : 0,
          speed: s.speed * ts,
          epbMotor: s.epb === "applying" || s.epb === "releasing",
          horn: b.horn,
          indicator: blink,
          chimeCount: chime.current.count,
          interior: !!vd.cockpit,
          distance: vd.cockpit ? 0 : Math.hypot(...vd.pos) * 0.9,
          race: c.mode === "race",
          master: 0.9,
        });
      }
      if (blink !== lastBlink) lastBlink = blink;
      if (!dmgBefore && s.dmg.seized) changed = true;

      uiAcc += dt;
      if (uiAcc >= 1 / 20) {
        uiAcc = 0;
        setSnap({ ...s, engineTorque: smooth.current.tq, clutchTorque: smooth.current.clutch });
        if (changed) syncUi();
      }
    };
    const id = setInterval(loop, 8);
    return () => clearInterval(id);
  }, [syncUi]);

  // ---------------- billentyűzet ----------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      const keys = keysRef.current;
      if (["w", "s", "a", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "tab"].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === "w" || k === "arrowup") keys.delete("~thr");
      if (k === "s" || k === "arrowdown") keys.delete("~brk");
      if (k === " ") keys.delete("~clu");
      keys.add(k);
      const b = bodyRef.current;
      const c = controlsRef.current;
      if (k === "i" || k === "enter") startStop();
      if (k === "n" || k === "0") shiftTo(0);
      if (["1", "2", "3", "4", "5", "6"].includes(k)) shiftTo(Number(k) as Gear);
      if (k === "r") shiftTo(-1);
      if (k === "e") shiftTo(Math.min(6, Math.max(1, c.gear + 1)) as Gear);
      if (k === "q") shiftTo((c.gear <= 1 ? 0 : c.gear - 1) as Gear);
      if (k === "h") interact({ type: "autoHold" });
      if (k === "m") interact({ type: "mode" });
      if (k === "v") interact({ type: "lights" });
      if (k === "f") interact({ type: "hazard" });
      if (k === "g") interact({ type: "door", index: 0 });
      if (k === "c") interact({ type: "seatbelt" });
      if (k === "t") {
        b.wiper = ((b.wiper + 1) % 3) as BodyCtl["wiper"];
        syncUi();
      }
      if (k === "j" || k === "k") {
        const dir = k === "j" ? -1 : 1;
        b.indicator = b.indicator === dir ? 0 : dir;
        indCancel.current.armed = false;
        syncUi();
      }
      if (k === "tab") {
        const list = viewDef(viewRef.current).xray ? XRAY_VIEWS : MAIN_VIEWS;
        const i = list.indexOf(viewRef.current);
        setView(list[(i + 1) % list.length]);
      }
      if (k === "x") setView((v) => (viewDef(v).xray ? "kulso" : "r-teljes"));
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const keys = keysRef.current;
      keys.delete(k);
      if (k === "w" || k === "arrowup") keys.add("~thr");
      if (k === "s" || k === "arrowdown") keys.add("~brk");
      if (k === " ") keys.add("~clu");
    };
    const blur = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [shiftTo, startStop, interact, syncUi]);

  // tesztekhez / hibakereséshez
  useEffect(() => {
    (window as unknown as { __golf?: unknown }).__golf = { stateRef, controlsRef, bodyRef, setView, interact, audioLevel: () => audioRef.current?.level() ?? 0 };
  }, [interact]);

  const toggleSound = async () => {
    if (!audioRef.current) audioRef.current = new CarAudio();
    if (audioRef.current.active) {
      audioRef.current.stop();
      setSound(false);
    } else {
      await audioRef.current.start();
      setSound(true);
    }
  };

  const refuel = () => {
    stateRef.current.fuelL = ENGINE.tankL;
  };
  /** Újrakezdés: a pozíció, hőmérsékletek, akku visszaállnak – a KÁROK MEGMARADNAK (csak az oldal újratöltése javítja). */
  const restart = () => {
    const dmg = stateRef.current.dmg;
    stateRef.current = createState({ dmg });
    controlsRef.current = defaultControls();
    bodyRef.current = defaultBody();
    syncUi();
  };

  const s = snap;
  const kmh = Math.abs(s.speed) * 3.6;
  const eventFresh = s.t - s.eventAt < 5;
  const shiftFresh = shiftMsg && s.t - shiftMsg.at < 2.5;
  const vd = viewDef(view);
  const dmg = s.dmg;
  const engineHealth = dmg.seized ? 0 : Math.max(0, 1 - Math.max(dmg.bearing, dmg.headGasket, ...dmg.valves.map((v) => v * 0.5), ...dmg.pistons.map((v) => v * 0.4)));
  const status = dmg.seized
    ? { text: "MOTOR TÖNKREMENT", cls: "bg-red-800" }
    : !ctl.ignition
      ? { text: "Gyújtás KI", cls: "bg-slate-700" }
      : s.running
        ? s.revLimiter
          ? { text: "FORDULATSZÁM-HATÁROLÓ", cls: "bg-red-600 animate-pulse" }
          : { text: "Motor jár", cls: "bg-emerald-600" }
        : s.autoCrank
          ? { text: "Indítás…", cls: "bg-amber-600" }
          : { text: "Gyújtás BE – motor áll", cls: "bg-amber-800" };
  const warns = warningLights(s, ctl, {
    indicatorL: body.indicator === -1 || body.hazard,
    indicatorR: body.indicator === 1 || body.hazard,
    lights: body.lights,
    anyDoor: body.doors.some(Boolean) || body.hood || body.tailgate,
  });

  return (
    <div className="max-w-[1500px] mx-auto p-3 sm:p-4 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Volkswagen Golf 7.5 <span className="text-sky-400">R</span> <span className="text-slate-400 font-normal text-lg">(2019)</span>
          </h1>
          <p className="text-sm text-slate-400">EA888 2.0 TSI · 300 LE / 380 Nm · IS38 turbó · 6 fokozatú kézi + R · 4MOTION összkerékhajtás · EPB · élő fizika (2000 lépés/s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${status.cls}`} data-testid="status">
            {status.text}
          </span>
          <div className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-xs">
            <span className="text-slate-400 mr-1">Idő</span>
            {[1, 0.5, 0.2, 0.05, 0.01].map((v) => (
              <button key={v} onClick={() => setTimeScale(v)} className={`px-2 py-0.5 rounded ${timeScale === v ? "bg-sky-600 text-white" : "bg-slate-700 hover:bg-slate-600"}`}>
                {v === 1 ? "1×" : `1/${Math.round(1 / v)}`}
              </button>
            ))}
          </div>
          <button onClick={toggleSound} className={`px-3 py-1 rounded text-sm whitespace-nowrap ${sound ? "bg-sky-700 hover:bg-sky-600" : "bg-slate-700 hover:bg-slate-600"}`}>
            🔊 Hang {sound ? "BE" : "KI"}
          </button>
          <button onClick={() => setPaused((p) => !p)} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm whitespace-nowrap">
            {paused ? "▶ Folytat" : "⏸ Szünet"}
          </button>
          <button onClick={restart} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm whitespace-nowrap" title="Az autó a startra kerül, de a károk megmaradnak – azokat csak az oldal újratöltése javítja">
            ↺ Vissza a startra
          </button>
        </div>
      </header>

      {(dmg.seized || dmg.log.length > 0) && (
        <div className="rounded-lg border border-red-500/60 bg-red-950/70 px-4 py-2 text-red-200 text-sm">
          <b>{dmg.seized ? "🔧 A motor tönkrement." : `🔧 ${dmg.log.length} maradandó kár.`}</b> A károk nem javulnak meg maguktól – csak az oldal <b>újratöltése</b> (F5) állítja helyre az autót.
        </div>
      )}
      {s.tempC > 112 && !dmg.seized && (
        <div className="rounded-lg border border-red-500/60 bg-red-950/70 px-4 py-2 text-red-200 font-semibold animate-pulse">
          🌡️ Hűtővíz {s.tempC.toFixed(0)} °C – túlmelegszik! 120 °C felett kiég a hengerfej-tömítés, 132 °C-nál a motor beragad.
        </div>
      )}
      {(eventFresh || shiftFresh) && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/60 px-4 py-2 text-amber-200 font-semibold" data-testid="event">
          {shiftFresh ? shiftMsg!.text : s.event}
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-2">
          <div className="flex flex-wrap items-center gap-1 mb-2 px-1">
            <span className="text-xs text-slate-400 mr-1">Nézet</span>
            {MAIN_VIEWS.map((id) => (
              <button key={id} onClick={() => setView(id)} className={`px-2.5 py-1 rounded text-xs ${view === id ? "bg-sky-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200"}`}>
                {viewDef(id).label}
              </button>
            ))}
            <button
              onClick={() => setView(vd.xray ? "kulso" : "r-teljes")}
              className={`px-2.5 py-1 rounded text-xs font-semibold ${vd.xray ? "bg-cyan-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-cyan-300"}`}
            >
              🩻 Röntgen (skeleton)
            </button>
            {vd.xray && (
              <button onClick={() => setLabels((l) => !l)} className={`px-2 py-1 rounded text-xs ml-auto ${labels ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-400"}`}>
                🏷️ Feliratok {labels ? "BE" : "KI"}
              </button>
            )}
          </div>
          {vd.xray && (
            <div className="flex flex-wrap items-center gap-1 mb-2 px-1">
              <span className="text-xs text-cyan-400 mr-1">Átlátszó nézet</span>
              {XRAY_VIEWS.map((id) => (
                <button key={id} onClick={() => setView(id)} className={`px-2 py-0.5 rounded text-xs ${view === id ? "bg-cyan-700 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}>
                  {viewDef(id).label}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Scene view={view} showLabels={labels} stateRef={stateRef} controlsRef={controlsRef} bodyRef={bodyRef} leverRef={leverRef} onInteract={interact} height={760} />
            {/* HUD */}
            <div className="pointer-events-none absolute left-3 bottom-3 flex items-end gap-3">
              <div className="rounded-lg bg-slate-950/70 border border-slate-700/70 px-3 py-1.5 backdrop-blur-sm">
                <div className="text-3xl font-bold tabular-nums leading-none">
                  {kmh.toFixed(0)} <span className="text-sm text-slate-400 font-normal">km/h</span>
                </div>
                <div className="text-sm tabular-nums text-slate-300">
                  {Math.round(s.rpm)} 1/perc · <span className="text-sky-300 font-bold">{gearLabel(ctl.gear)}</span> · {(s.boostKPa / 100).toFixed(2)} bar
                </div>
              </div>
              <div className="flex flex-wrap gap-1 max-w-[360px]">
                {warns.map((w) => (
                  <span
                    key={w.id}
                    title={w.label}
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${w.flash ? "animate-pulse" : ""} ${
                      w.color === "red" ? "text-red-400 border-red-500/50" : w.color === "amber" ? "text-amber-400 border-amber-500/50" : w.color === "green" ? "text-emerald-400 border-emerald-500/50" : "text-slate-200 border-slate-500/50"
                    } bg-slate-950/70`}
                  >
                    {w.sym}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1 px-1">
            Egérrel forgatható/körbenézhető, görgővel nagyítható. Kívülről kattints az ajtókra, motorháztetőre, csomagtérajtóra. Belső nézetben a <b>váltókar húzható</b> (H-kulissza), a gombok (Start/Stop, (P) rögzítőfék, Auto Hold, Mode, vészvillogó, világítás, öv) kattinthatók.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 place-items-center rounded-xl bg-slate-900 border border-slate-700 p-2">
            <Gauge value={s.rpm} max={8000} label="fordulat" unit="1/perc" redFrom={ENGINE.redline} size={160} ticks={8} />
            <Gauge value={kmh} max={320} label="sebesség" unit="km/h" size={160} ticks={8} />
            <div className="grid grid-cols-3 col-span-2 gap-1 place-items-center">
              <Gauge value={s.boostKPa / 100} min={0} max={1.4} label="töltőnyomás" unit="bar" size={104} ticks={7} decimals={2} />
              <Gauge value={s.tempC} min={0} max={140} label="hűtővíz" unit="°C" redFrom={115} size={104} ticks={7} />
              <Gauge value={s.oilTempC} min={0} max={160} label="olaj" unit="°C" redFrom={135} size={104} ticks={8} />
              <Gauge value={s.fuelL} max={ENGINE.tankL} label="üzemanyag" unit="L" size={104} ticks={5} decimals={1} />
              <Gauge value={s.oilPressure} min={0} max={6} label="olajnyomás" unit="bar" size={104} ticks={6} decimals={1} />
              <Gauge value={s.clutchC} min={0} max={450} label="kuplung" unit="°C" redFrom={300} size={104} ticks={9} />
            </div>
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 space-y-3 text-sm">
            <div className="flex gap-2">
              <button onClick={startStop} className={`flex-1 py-2 rounded font-semibold ${s.running ? "bg-emerald-700 hover:bg-emerald-600" : ctl.ignition ? "bg-amber-700 hover:bg-amber-600" : "bg-slate-700 hover:bg-slate-600"}`} data-testid="startstop">
                ⏻ START / STOP <span className="text-xs opacity-70">(I)</span>
              </button>
              <button
                onMouseDown={() => setControl("epbSwitch", s.epb === "released" || s.epb === "releasing" || Math.abs(s.speed) > 0.5 ? 1 : -1)}
                onMouseUp={() => setControl("epbSwitch", 0)}
                onMouseLeave={() => ctl.epbSwitch !== 0 && setControl("epbSwitch", 0)}
                className={`w-28 py-2 rounded font-semibold select-none ${s.epb === "applied" ? "bg-red-700 hover:bg-red-600" : "bg-slate-700 hover:bg-slate-600"}`}
                title="Rögzítőfék: húzás (P) / oldás fékpedállal (O). Menet közben tartva vészfékez."
              >
                (P) {s.epb === "applied" ? "BE" : s.epb === "released" ? "KI" : "…"}
              </button>
            </div>
            <p className="text-xs text-slate-400 -mt-1">Indítás: kuplung benyomva (Space) + Start/Stop. Kuplung nélkül csak a gyújtás kapcsol.</p>

            <Pedal label="Gáz" hint="W / ↑" value={ctl.throttle} color="accent-emerald-500" onChange={(v) => setControl("throttle", v)} />
            <Pedal label="Fék" hint="S / ↓" value={ctl.brake} color="accent-red-500" onChange={(v) => setControl("brake", v)} />
            <Pedal label="Kuplung" hint="Space (tartva)" value={ctl.clutch} color="accent-sky-500" onChange={(v) => setControl("clutch", v)} />
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>
                  Kormány <span className="text-slate-200 font-semibold">{Math.round(ctl.steer * 100)}%</span>
                </span>
                <span className="text-xs">A/D · ←/→</span>
              </div>
              <input type="range" min={-1} max={1} step={0.01} value={ctl.steer} onChange={(e) => setControl("steer", Number(e.target.value))} className="w-full accent-slate-400" />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Váltó (H-kulissza)</span>
                <span className="text-xs">1–6, R, N · Q/E</span>
              </div>
              <div className="flex gap-2 items-stretch">
                <div className="grid grid-cols-4 gap-1 flex-1">
                  {SHIFT_GATE.flat().map((g, i) =>
                    g === null ? (
                      <div key={i} />
                    ) : (
                      <button
                        key={i}
                        onClick={() => shiftTo(g)}
                        className={`py-1.5 rounded font-bold ${ctl.gear === g ? "bg-sky-600" : !gearUsable(s, g) ? "bg-red-950 text-red-400 line-through" : "bg-slate-700 hover:bg-slate-600"}`}
                      >
                        {gearLabel(g)}
                      </button>
                    ),
                  )}
                </div>
                <button onClick={() => shiftTo(0)} className={`px-3 rounded font-bold ${ctl.gear === 0 ? "bg-sky-600" : "bg-slate-700 hover:bg-slate-600"}`}>
                  N
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 text-xs">
              <Toggle on={ctl.autoHold} onClick={() => interact({ type: "autoHold" })} label="Auto Hold (H)" />
              <Toggle on={ctl.mode === "race"} onClick={() => interact({ type: "mode" })} label={`Mód: ${MODE_LABEL[ctl.mode]} (M)`} />
              <Toggle on={!ctl.seatbelt} warn onClick={() => interact({ type: "seatbelt" })} label={ctl.seatbelt ? "Öv bekötve (C)" : "Öv KIKÖTVE (C)"} />
              <Toggle on={body.lights} onClick={() => interact({ type: "lights" })} label="Fényszóró (V)" />
              <Toggle on={body.indicator === -1} onClick={() => ((bodyRef.current.indicator = body.indicator === -1 ? 0 : -1), syncUi())} label="◀ Index (J)" />
              <Toggle on={body.indicator === 1} onClick={() => ((bodyRef.current.indicator = body.indicator === 1 ? 0 : 1), syncUi())} label="Index ▶ (K)" />
              <Toggle on={body.hazard} warn onClick={() => interact({ type: "hazard" })} label="⚠ Vészvillogó (F)" />
              <Toggle on={body.wiper > 0} onClick={() => ((bodyRef.current.wiper = ((body.wiper + 1) % 3) as BodyCtl["wiper"]), syncUi())} label={`Ablaktörlő ${body.wiper ? body.wiper + "." : "ki"} (T)`} />
              <button
                onMouseDown={() => (bodyRef.current.horn = true)}
                onMouseUp={() => (bodyRef.current.horn = false)}
                onMouseLeave={() => (bodyRef.current.horn = false)}
                className="py-1.5 rounded bg-slate-700 hover:bg-slate-600 select-none"
              >
                📯 Kürt (B)
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {["Bal első", "Jobb első", "Bal hátsó", "Jobb hátsó"].map((n, i) => (
                <Toggle key={n} on={body.doors[i]} warn onClick={() => interact({ type: "door", index: i })} label={`🚪 ${n}${i === 0 ? " (G)" : ""}`} />
              ))}
              <Toggle on={body.hood} warn onClick={() => interact({ type: "hood" })} label="Motorháztető" />
              <Toggle on={body.tailgate} warn onClick={() => interact({ type: "tailgate" })} label="Csomagtér" />
            </div>
            <div className="flex gap-2">
              <button onClick={refuel} className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600">
                ⛽ Tankolás ({ENGINE.tankL} L)
              </button>
              <button onClick={() => (stateRef.current.fuelL = 0.05)} className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600">
                🪫 Tank ürítése
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
        <Stat label="Motor nyomaték" value={`${s.engineTorque.toFixed(0)} Nm`} />
        <Stat label="Teljesítmény" value={`${s.powerKW.toFixed(0)} kW (${(s.powerKW * 1.36).toFixed(0)} LE)`} />
        <Stat label="Kuplung nyomaték" value={`${s.clutchTorque.toFixed(0)} Nm`} />
        <Stat label="Fogyasztás" value={kmh > 3 ? `${s.consumption.toFixed(1)} L/100km` : `${s.fuelRateLh.toFixed(2)} L/h`} />
        <Stat label="4MOTION (Haldex)" value={`elöl ${Math.round((1 - s.rearShare) * 100)}% · hátul ${Math.round(s.rearShare * 100)}%`} />
        <Stat label="Út / lefulladás" value={`${(s.distance / 1000).toFixed(2)} km / ${s.stalls}×`} />
      </div>

      <DamagePanel s={s} engineHealth={engineHealth} />

      <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-slate-100">ECU – turbó, közvetlen befecskendezés (FSI + MPI)</h2>
          <span className="text-xs text-slate-400">
            {s.revLimiter ? "üzemanyag-lezárás (határoló)" : s.overrun ? "túlfutási lezárás (motorfék)" : s.tempC < 50 && s.running ? "hidegindítási dúsítás" : s.boostKPa > 80 ? "teljes terhelés – dúsítás" : "λ=1 szabályzás"}
            {s.knockRetard > 0.5 ? ` · kopogásszabályzás −${s.knockRetard.toFixed(0)}°` : ""}
            {s.asr > 0.05 ? " · ASR beavatkozik" : ""}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
          <Stat label="Szívócső nyomás (MAP)" value={`${s.mapKPa.toFixed(0)} kPa`} />
          <Stat label="Töltőnyomás" value={`${(s.boostKPa / 100).toFixed(2)} bar`} />
          <Stat label="Turbó" value={`${Math.round(s.turbo * 190000).toLocaleString("hu-HU")} 1/perc`} />
          <Stat label="Wastegate" value={`${Math.round(s.wastegate * 100)}% nyitva`} />
          <Stat label="Fojtószelep" value={`${Math.round(s.effThrottle * 100)}%`} />
          <Stat label="Levegő tömegáram" value={`${s.airGs.toFixed(1)} g/s`} />
          <Stat label="Keverék (AFR)" value={s.afr > 0 ? `${s.afr.toFixed(1)} : 1` : "–"} />
          <Stat label="Befecskendezés" value={`${s.injectorMs.toFixed(2)} ms · ${s.railBar.toFixed(0)} bar`} />
          <Stat label="Szívólevegő (IC után)" value={`${s.intakeAirC.toFixed(0)} °C`} />
          <Stat label="Kipufogógáz / turbina" value={`${s.exhaustC.toFixed(0)} / ${s.turboC.toFixed(0)} °C`} />
          <Stat label="Katalizátor + OPF" value={`${s.catTempC.toFixed(0)} °C ${s.catTempC > 250 ? "· aktív" : "· hideg"}`} />
          <Stat label="Hűtés" value={`termosztát ${Math.round(s.thermostat * 100)}% · vent. ${s.fan ? "BE" : "ki"}`} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-100">🌡️ Hőmérsékletek</h2>
            <span className="text-xs text-slate-400">környezet 20 °C</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Temp label="Hűtővíz" v={s.tempC} warn={112} />
            <Temp label="Motorolaj" v={s.oilTempC} warn={135} />
            <Temp label="Hengerfej" v={s.headTempC} warn={130} />
            <Temp label="Turbinaház" v={s.turboC} warn={900} />
            <Temp label="Katalizátor" v={s.catTempC} warn={950} />
            <Temp label="Kuplung" v={s.clutchC} warn={300} />
            <Temp label="Első féktárcsa" v={s.brakeFrontC} warn={500} />
            <Temp label="Hátsó féktárcsa" v={s.brakeRearC} warn={500} />
            <Temp label="Fékfolyadék" v={s.brakeFluidC} warn={240} />
          </div>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-100">🔋 Elektromos rendszer</h2>
            <span className={`text-xs px-2 py-0.5 rounded ${s.batteryLamp ? "bg-red-700 text-white animate-pulse" : "text-slate-400"}`}>{s.batteryLamp ? "⚠ töltés-lámpa" : s.altA > 0 ? "generátor tölt" : "nyugalom"}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Stat label="Akkumulátor (68 Ah AGM)" value={`${s.batteryV.toFixed(2)} V`} />
            <Stat label="Töltöttség" value={`${Math.round(s.batterySoc * 100)} %`} />
            <Stat label="Generátor" value={`${s.altA.toFixed(0)} A · ${Math.round(s.altRpm)} 1/perc`} />
            <Stat label="Fogyasztók" value={`${s.loadA.toFixed(1)} A`} />
            <Stat label="Önindító" value={s.starterA > 0 ? `${s.starterA.toFixed(0)} A` : "–"} />
            <Stat label="Rögzítőfék (EPB)" value={{ released: "oldva", applying: "húz…", applied: "behúzva", releasing: "old…" }[s.epb]} />
          </div>
          <div className="mt-2 h-2 rounded bg-slate-800 overflow-hidden">
            <div className={`h-full ${s.batterySoc < 0.2 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.round(s.batterySoc * 100)}%` }} />
          </div>
        </div>
      </div>

      <details className="text-sm text-slate-400 rounded-xl bg-slate-900 border border-slate-700 p-3" open>
        <summary className="cursor-pointer text-slate-200 font-semibold">Kezelés és tudnivalók</summary>
        <div className="grid md:grid-cols-2 gap-4 mt-2">
          <ul className="space-y-1">
            <li><Kbd>I</Kbd>/<Kbd>Enter</Kbd> Start/Stop gomb (indításhoz <Kbd>Space</Kbd> kuplung benyomva)</li>
            <li><Kbd>W</Kbd> gáz · <Kbd>S</Kbd> fék · <Kbd>Space</Kbd> kuplung (lassan felenged = félkuplung) · <Kbd>A</Kbd>/<Kbd>D</Kbd> kormány</li>
            <li><Kbd>1</Kbd>–<Kbd>6</Kbd>, <Kbd>R</Kbd> hátramenet, <Kbd>N</Kbd> üres, <Kbd>Q</Kbd>/<Kbd>E</Kbd> le/fel – csak kuplunggal!</li>
            <li><Kbd>P</Kbd> rögzítőfék húzása (menet közben tartva: vészfékezés) · <Kbd>O</Kbd> oldás (fékpedállal) · <Kbd>H</Kbd> Auto Hold</li>
            <li><Kbd>V</Kbd> fényszóró · <Kbd>J</Kbd>/<Kbd>K</Kbd> index · <Kbd>F</Kbd> vészvillogó · <Kbd>B</Kbd> kürt · <Kbd>T</Kbd> ablaktörlő</li>
            <li><Kbd>G</Kbd> vezetőajtó · <Kbd>C</Kbd> biztonsági öv · <Kbd>M</Kbd> vezetési mód · <Kbd>Tab</Kbd> következő nézet · <Kbd>X</Kbd> röntgen</li>
          </ul>
          <ul className="list-disc ml-4 space-y-1">
            <li>Elinduláskor az EPB magától kiold (Drive-away assist), ha be van kötve az öv és csukva az ajtó.</li>
            <li>Kuplung nélküli váltás csikorog és rongálja a szinkront – 4 csikorgás után a fokozat tönkremegy. Guruló autóval hátramenetbe kapcsolva letörik a hátramenet.</li>
            <li>Rossz visszaváltás (pl. 130 km/h-ról 1-esbe) túlpörgeti a motort: 7400 felett elgörbülnek a szelepek, 9000 felett a hajtókar átüti a blokkot.</li>
            <li>A határolón tartás és a hideg motor kínzása kopogó csapágyat, majd beragadást okoz. Túlmelegedésnél kiég a hengerfej-tömítés.</li>
            <li>Alacsony fordulaton (&lt;1800) magas fokozatban padlógáz: LSPI (előgyújtás) – megreped a dugattyú. Kemény menet után azonnali leállítás: a turbó csapágya kokszosodik.</li>
            <li>A kuplung csúsztatása (pl. behúzott kézifék ellen) égeti a kuplungot. <b>Minden kár megmarad – csak az oldal újratöltése javítja.</b></li>
          </ul>
        </div>
      </details>
    </div>
  );
}

function DamagePanel({ s, engineHealth }: { s: SimState; engineHealth: number }) {
  const d = s.dmg;
  const bar = (label: string, v: number, note?: string) => (
    <div key={label}>
      <div className="flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className={v > 0.5 ? "text-red-400" : v > 0.05 ? "text-amber-400" : "text-emerald-400"}>{v >= 1 ? "tönkrement" : v > 0.02 ? `${Math.round(v * 100)}% kár` : "ép"}{note ? ` · ${note}` : ""}</span>
      </div>
      <div className="h-1.5 rounded bg-slate-800 overflow-hidden">
        <div className={`h-full ${v > 0.5 ? "bg-red-500" : v > 0.05 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${Math.max(3, Math.round((1 - Math.min(1, v)) * 100))}%` }} />
      </div>
    </div>
  );
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-700 p-3" data-testid="damage">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-semibold text-slate-100">🔧 Állapot és károk</h2>
        <span className="text-xs text-slate-400">a károk maradandók – csak az oldal újratöltése javítja őket</span>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          {bar("Motor összesen", d.seized ? 1 : 1 - engineHealth, d.seized ? "beragadt" : undefined)}
          {d.valves.map((v, i) => bar(`${i + 1}. henger szelepei`, v, v >= 0.5 ? "kiesett" : undefined))}
        </div>
        <div className="space-y-2">
          {d.pistons.map((v, i) => bar(`${i + 1}. dugattyú (LSPI)`, v))}
          {bar("Hajtókar-csapágy", d.bearing, d.bearing > 0.35 ? "kopog" : undefined)}
          {bar("Hengerfej-tömítés", d.headGasket, d.headGasket > 0.2 ? `hűtőfolyadék ${s.coolantL.toFixed(1)} L` : undefined)}
        </div>
        <div className="space-y-2">
          {bar("Turbó", d.turbo)}
          {bar("Kuplung", d.clutch)}
          {d.synchro.map((v, i) => bar(`Szinkron ${i === 0 ? "R" : i + "."}`, v))}
        </div>
      </div>
      {d.log.length > 0 && (
        <ol className="mt-3 text-xs text-red-300 space-y-0.5 list-decimal ml-5">
          {d.log.map((l, i) => (
            <li key={i}>
              <span className="text-slate-500">{l.t.toFixed(1)} s</span> – {l.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 text-xs font-mono">{children}</kbd>;
}

function Toggle({ on, onClick, label, warn }: { on: boolean; onClick: () => void; label: string; warn?: boolean }) {
  return (
    <button onClick={onClick} className={`py-1.5 px-1 rounded ${on ? (warn ? "bg-amber-700 text-white" : "bg-sky-700 text-white") : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}>
      {label}
    </button>
  );
}

function Pedal({ label, hint, value, color, onChange }: { label: string; hint: string; value: number; color: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-slate-400 mb-1">
        <span>
          {label} <span className="text-slate-200 font-semibold">{Math.round(value * 100)}%</span>
        </span>
        <span className="text-xs">{hint}</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full ${color}`} />
    </div>
  );
}

function Temp({ label, v, warn }: { label: string; v: number; warn: number }) {
  const hot = v >= warn;
  const frac = Math.max(0, Math.min(1, (v - 20) / warn));
  return (
    <div className={`rounded-lg border px-3 py-2 ${hot ? "border-red-500 bg-red-950/50" : "border-slate-700 bg-slate-900"}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`font-semibold ${hot ? "text-red-300" : "text-slate-100"}`}>{v.toFixed(0)} °C</div>
      <div className="mt-1 h-1 rounded bg-slate-800 overflow-hidden">
        <div className="h-full" style={{ width: `${Math.round(frac * 100)}%`, background: hot ? "#ef4444" : `hsl(${200 - frac * 200} 80% 55%)` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-semibold text-slate-100">{value}</div>
    </div>
  );
}
