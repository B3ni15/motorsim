"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createState, defaultControls, step, DT, ENGINE, type Controls, type Gear, type SimState } from "@/lib/engine";
import { EngineAudio } from "@/lib/audio";
import dynamic from "next/dynamic";
import Gauge from "./Gauge";

import { VIEWS, type ViewName } from "./Engine3D";

const Engine3D = dynamic(() => import("./Engine3D"), {
  ssr: false,
  loading: () => <div className="h-[520px] grid place-items-center text-slate-400">3D betöltése…</div>,
});

const GEARS: Gear[] = [0, 1, 2, 3, 4, 5];

export default function Simulator() {
  const stateRef = useRef<SimState>(createState());
  const controlsRef = useRef<Controls>(defaultControls());
  const keysRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<EngineAudio | null>(null);
  const smoothClutchT = useRef(0);

  const [snap, setSnap] = useState<SimState>(() => ({ ...stateRef.current }));
  const [ctl, setCtl] = useState<Controls>(() => ({ ...controlsRef.current }));
  const [sound, setSound] = useState(false);
  const [shiftMsg, setShiftMsg] = useState<{ text: string; at: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<ViewName>("auto");
  const [labels, setLabels] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const timeScaleRef = useRef(1);
  timeScaleRef.current = timeScale;
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const setControl = useCallback(<K extends keyof Controls>(k: K, v: Controls[K]) => {
    controlsRef.current = { ...controlsRef.current, [k]: v };
    setCtl({ ...controlsRef.current });
  }, []);

  const shiftTo = useCallback(
    (g: Gear) => {
      const c = controlsRef.current;
      if (g === c.gear) return;
      const s = stateRef.current;
      // gyújtás nélkül, álló motornál szabad; járó motornál kuplung kell
      if (s.rpm > 100 && c.clutch < 0.8 && g !== 0) {
        setShiftMsg({ text: "RECCS! Nyomd be a kuplungot váltáshoz!", at: s.t });
        return;
      }
      setControl("gear", g);
    },
    [setControl],
  );

  // fő ciklus
  useEffect(() => {
    let last = performance.now();
    let acc = 0;
    let uiAcc = 0;
    const loop = () => {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 1.0) dt = 1.0; // háttérben (throttled timer) is közel valós időben fut
      if (pausedRef.current) return;

      // billentyűzet → pedálok (folyamatos rámpa)
      const keys = keysRef.current;
      const c = { ...controlsRef.current };
      const ramp = (cur: number, target: number, rate: number) => {
        if (cur < target) return Math.min(target, cur + rate * dt);
        return Math.max(target, cur - rate * dt);
      };
      let changed = false;
      if (keys.has("w") || keys.has("arrowup")) {
        c.throttle = ramp(c.throttle, 1, 2.5);
        changed = true;
      } else if (keys.has("keyThrottleRelease")) {
        c.throttle = ramp(c.throttle, 0, 4);
        changed = c.throttle > 0;
        if (c.throttle === 0) keys.delete("keyThrottleRelease");
      }
      if (keys.has("s") || keys.has("arrowdown")) {
        c.brake = ramp(c.brake, 1, 3);
        changed = true;
      } else if (keys.has("keyBrakeRelease")) {
        c.brake = ramp(c.brake, 0, 4);
        changed = true;
        if (c.brake === 0) keys.delete("keyBrakeRelease");
      }
      if (keys.has(" ")) {
        c.clutch = ramp(c.clutch, 1, 5);
        changed = true;
      } else if (keys.has("keyClutchRelease")) {
        c.clutch = ramp(c.clutch, 0, 1.2); // lassú felengedés = félkuplung
        changed = true;
        if (c.clutch === 0) keys.delete("keyClutchRelease");
      }
      const starterKey = keys.has("k");
      if (starterKey !== c.starter) {
        c.starter = starterKey;
        changed = true;
      }
      if (changed) {
        controlsRef.current = c;
      }

      // fizika (időlassítás: a pedálok valós időben, a fizika lassítva)
      acc += dt * timeScaleRef.current;
      const s = stateRef.current;
      const cc = controlsRef.current;
      while (acc >= DT) {
        step(s, cc, DT);
        acc -= DT;
      }
      smoothClutchT.current += (s.clutchTorque - smoothClutchT.current) * 0.05;

      audioRef.current?.update(s.rpm * timeScaleRef.current, s.effThrottle, s.running, cc.starter);

      uiAcc += dt;
      if (uiAcc >= 1 / 30) {
        uiAcc = 0;
        setSnap({ ...s, clutchTorque: smoothClutchT.current });
        if (changed) setCtl({ ...cc });
      }
    };
    // setInterval: háttérben is fut (rAF ott leáll)
    const id = setInterval(loop, 10);
    return () => clearInterval(id);
  }, []);

  // billentyűzet
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      const keys = keysRef.current;
      if (["w", "s", " ", "k", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === "w" || k === "arrowup") keys.delete("keyThrottleRelease");
      if (k === "s" || k === "arrowdown") keys.delete("keyBrakeRelease");
      if (k === " ") keys.delete("keyClutchRelease");
      keys.add(k);
      if (k === "i") setControl("ignition", !controlsRef.current.ignition);
      if (k === "n" || k === "0") shiftTo(0);
      if (["1", "2", "3", "4", "5"].includes(k)) shiftTo(Number(k) as Gear);
      if (k === "e") shiftTo(Math.min(5, controlsRef.current.gear + 1) as Gear);
      if (k === "q") shiftTo(Math.max(0, controlsRef.current.gear - 1) as Gear);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const keys = keysRef.current;
      keys.delete(k);
      if (k === "w" || k === "arrowup") keys.add("keyThrottleRelease");
      if (k === "s" || k === "arrowdown") keys.add("keyBrakeRelease");
      if (k === " ") keys.add("keyClutchRelease");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [setControl, shiftTo]);

  const toggleSound = () => {
    if (!audioRef.current) audioRef.current = new EngineAudio();
    if (audioRef.current.active) {
      audioRef.current.stop();
      setSound(false);
    } else {
      audioRef.current.start();
      setSound(true);
    }
  };

  const refuel = () => {
    stateRef.current.fuelL = ENGINE.tankL;
  };
  const reset = () => {
    stateRef.current = createState();
    controlsRef.current = defaultControls();
    setCtl({ ...controlsRef.current });
  };

  const s = snap;
  const kmh = s.speed * 3.6;
  const eventFresh = s.t - s.eventAt < 4;
  const shiftFresh = shiftMsg && s.t - shiftMsg.at < 2.5;
  const status = s.damage >= 1
    ? { text: "MOTORKÁR – túlmelegedett", cls: "bg-red-800" }
    : !ctl.ignition
    ? { text: "Gyújtás KI", cls: "bg-slate-700" }
    : s.running
      ? s.revLimiter
        ? { text: "FORDULATSZÁM-HATÁROLÓ", cls: "bg-red-600 animate-pulse" }
        : { text: "Motor jár", cls: "bg-emerald-600" }
      : ctl.starter
        ? { text: "Indítózás…", cls: "bg-amber-600" }
        : { text: "Gyújtás BE – motor áll", cls: "bg-amber-800" };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">BMW M52B28 motor- és járműszimuláció</h1>
          <p className="text-sm text-slate-400">Soros 6 henger · 2793 cm³ · DOHC 24 szelep · 193 LE / 280 Nm · ZF 5 fokozat · hátsókerék-hajtás (E36 328i) · élő fizika (2000 lépés/s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${status.cls}`}>{status.text}</span>
          <div className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-xs">
            <span className="text-slate-400 mr-1">Idő</span>
            {[1, 0.5, 0.2, 0.05, 0.01].map((v) => (
              <button
                key={v}
                onClick={() => setTimeScale(v)}
                className={`px-2 py-0.5 rounded ${timeScale === v ? "bg-sky-600 text-white" : "bg-slate-700 hover:bg-slate-600"}`}
              >
                {v === 1 ? "1×" : `1/${Math.round(1 / v)}`}
              </button>
            ))}
            <input
              type="range"
              min={-2}
              max={0}
              step={0.01}
              value={Math.log10(timeScale)}
              onChange={(e) => setTimeScale(Math.pow(10, Number(e.target.value)))}
              className="w-20 accent-sky-500"
              title="időlassítás"
            />
          </div>
          <button onClick={toggleSound} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm whitespace-nowrap">
            🔊 Hang {sound ? "KI" : "BE"}
          </button>
          <button onClick={() => setPaused((p) => !p)} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm whitespace-nowrap">
            {paused ? "▶ Folytat" : "⏸ Szünet"}
          </button>
          <button onClick={reset} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm whitespace-nowrap">
            ↺ Újra
          </button>
        </div>
      </header>

      {s.tempC > 108 && s.damage < 1 && (
        <div className="rounded-lg border border-red-500/60 bg-red-950/70 px-4 py-2 text-red-200 font-semibold animate-pulse">
          🌡️ Hűtővíz {s.tempC.toFixed(0)} °C – túl meleg! Vedd le a gázt, hajts gyorsabban (menetszél) vagy állj meg és hagyd alapjáraton hűlni. 128 °C-nál a motor beragad.
        </div>
      )}
      {(eventFresh || shiftFresh) && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/60 px-4 py-2 text-amber-200 font-semibold">
          {shiftFresh ? shiftMsg!.text : s.event}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-2">
          <div className="flex flex-wrap items-center gap-1 mb-2 px-1">
            <span className="text-xs text-slate-400 mr-1">Nézet</span>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-2 py-1 rounded text-xs ${view === v.id ? "bg-sky-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200"}`}
              >
                {v.label}
              </button>
            ))}
            <button
              onClick={() => setLabels((l) => !l)}
              className={`px-2 py-1 rounded text-xs ml-2 ${labels ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-400"}`}
            >
              🏷️ Feliratok {labels ? "BE" : "KI"}
            </button>
          </div>
          <Engine3D stateRef={stateRef} controlsRef={controlsRef} view={view} showLabels={labels} />
          <p className="text-xs text-slate-500 mt-1 px-1">Egérrel forgatható, görgővel nagyítható, jobb gombbal mozgatható.</p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 place-items-center rounded-xl bg-slate-900 border border-slate-700 p-2">
            <Gauge value={s.rpm} max={7000} label="fordulat" unit="1/perc" redFrom={ENGINE.revLimit} size={150} ticks={7} />
            <Gauge value={kmh} max={260} label="sebesség" unit="km/h" size={150} ticks={13} />
            <div className="grid grid-cols-2 col-span-2 gap-1 place-items-center">
              <Gauge value={s.fuelL} max={ENGINE.tankL} label="üzemanyag" unit="L" size={100} ticks={5} decimals={1} />
              <Gauge value={s.tempC} min={0} max={140} label="hűtővíz" unit="°C" redFrom={108} size={100} ticks={7} />
              <Gauge value={s.oilTempC} min={0} max={160} label="olaj" unit="°C" redFrom={130} size={100} ticks={8} />
              <Gauge value={s.oilPressure} min={0} max={7} label="olajnyomás" unit="bar" size={100} ticks={7} decimals={1} />
            </div>
          </div>

          <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 space-y-3 text-sm">
            <div className="flex gap-2">
              <button
                onClick={() => setControl("ignition", !ctl.ignition)}
                className={`flex-1 py-2 rounded font-semibold ${ctl.ignition ? "bg-emerald-700 hover:bg-emerald-600" : "bg-slate-700 hover:bg-slate-600"}`}
              >
                🔑 Gyújtás {ctl.ignition ? "BE" : "KI"} <span className="text-xs opacity-70">(I)</span>
              </button>
              <button
                onMouseDown={() => setControl("starter", true)}
                onMouseUp={() => setControl("starter", false)}
                onMouseLeave={() => ctl.starter && setControl("starter", false)}
                onTouchStart={() => setControl("starter", true)}
                onTouchEnd={() => setControl("starter", false)}
                className={`flex-1 py-2 rounded font-semibold select-none ${ctl.starter ? "bg-amber-500 text-black" : "bg-amber-700 hover:bg-amber-600"}`}
              >
                ⚡ Önindító <span className="text-xs opacity-70">(K nyomva)</span>
              </button>
            </div>

            <Pedal label="Gáz" hint="W / ↑" value={ctl.throttle} color="accent-emerald-500" onChange={(v) => setControl("throttle", v)} />
            <Pedal label="Fék" hint="S / ↓" value={ctl.brake} color="accent-red-500" onChange={(v) => setControl("brake", v)} />
            <Pedal label="Kuplung" hint="Space (tartva = benyomva)" value={ctl.clutch} color="accent-sky-500" onChange={(v) => setControl("clutch", v)} />

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Sebességfokozat</span>
                <span className="text-xs">1-5, N · Q/E</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {GEARS.map((g) => (
                  <button
                    key={g}
                    onClick={() => shiftTo(g)}
                    className={`py-2 rounded font-bold ${ctl.gear === g ? "bg-sky-600" : "bg-slate-700 hover:bg-slate-600"}`}
                  >
                    {g === 0 ? "N" : g}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={refuel} className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600">
                ⛽ Tankolás (65 L)
              </button>
              <button
                onClick={() => {
                  stateRef.current.fuelL = 0.05;
                }}
                className="flex-1 py-1.5 rounded bg-slate-700 hover:bg-slate-600"
              >
                🪫 Tank ürítése
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
        <Stat label="Motor nyomaték" value={`${s.engineTorque.toFixed(0)} Nm`} />
        <Stat label="Teljesítmény" value={`${s.powerKW.toFixed(1)} kW`} />
        <Stat label="Kuplung nyomaték" value={`${s.clutchTorque.toFixed(0)} Nm`} />
        <Stat label="Fogyasztás" value={kmh > 3 ? `${s.consumption.toFixed(1)} L/100km` : `${s.fuelRateLh.toFixed(2)} L/h`} />
        <Stat label="Fékteljesítmény" value={`${s.brakePowerKW.toFixed(0)} kW · hatásfok ${Math.round(s.brakeEff * 100)}%`} />
        <Stat label="Megtett út / lefulladás" value={`${(s.distance / 1000).toFixed(2)} km / ${s.stalls}×`} />
      </div>

      <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-slate-100">ECU – elektronikus befecskendezés (multipoint EFI)</h2>
          <span className="text-xs text-slate-400">
            {s.revLimiter ? "üzemanyag-lezárás (határoló)" : s.tempC < 60 && s.running ? "hidegindítási dúsítás" : s.effThrottle > 0.85 ? "teljes terhelés – dúsítás" : "λ=1 szabályzás"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-sm">
          <Stat label="Szívócső nyomás (MAP)" value={`${s.mapKPa.toFixed(0)} kPa`} />
          <Stat label="Levegő tömegáram" value={`${s.airGs.toFixed(1)} g/s`} />
          <Stat label="Szívólevegő" value={`${s.intakeAirC.toFixed(0)} °C`} />
          <Stat label="Üzemanyag" value={`${s.fuelGs.toFixed(2)} g/s`} />
          <Stat label="Keverék (AFR)" value={s.afr > 0 ? `${s.afr.toFixed(1)} : 1` : "–"} />
          <Stat label="Injektor nyitás" value={`${s.injectorMs.toFixed(2)} ms`} />
          <Stat label="Termosztát" value={`${Math.round(s.thermostat * 100)}% nyitva`} />
          <Stat label="Hűtőventilátor" value={s.fan ? "BE" : "ki"} />
          <Stat label="Kipufogógáz" value={`${s.exhaustGs.toFixed(1)} g/s · ${s.catTempC > 250 ? "kat. aktív" : "kat. hideg"}`} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-100">🌡️ Hőmérsékletek</h2>
            <span className="text-xs text-slate-400">környezet 20 °C</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Temp label="Hűtővíz" v={s.tempC} warn={108} />
            <Temp label="Motorolaj" v={s.oilTempC} warn={130} />
            <Temp label="Hengerfej" v={s.headTempC} warn={130} />
            <Temp label="Kipufogógáz" v={s.exhaustC} warn={900} />
            <Temp label="Szívólevegő" v={s.intakeAirC} warn={60} />
            <Temp label="Katalizátor" v={s.catTempC} warn={950} />
            <Temp label="Végcső gáz" v={s.tailpipeC} warn={400} />
            <Temp label="Első féktárcsa" v={s.brakeFrontC} warn={450} />
            <Temp label="Hátsó féktárcsa" v={s.brakeRearC} warn={450} />
            <Temp label="Fékfolyadék" v={s.brakeFluidC} warn={230} />
            <Temp label="Akkumulátor" v={s.batteryTempC} warn={55} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Termosztát {Math.round(s.thermostat * 100)}% · ventilátor {s.fan ? "BE" : "ki"} · vízpumpa {s.rpm > 50 ? `${Math.round(s.rpm * 1.1)} 1/perc` : "áll"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-100">🔋 Elektromos rendszer</h2>
            <span className={`text-xs px-2 py-0.5 rounded ${s.batteryLamp ? "bg-red-700 text-white animate-pulse" : "text-slate-400"}`}>
              {s.batteryLamp ? "⚠ töltés-lámpa" : s.altA > 0 ? "generátor tölt" : "nyugalom"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <Stat label="Akkumulátor" value={`${s.batteryV.toFixed(2)} V`} />
            <Stat label="Töltöttség" value={`${Math.round(s.batterySoc * 100)} % (${(s.batterySoc * 60).toFixed(1)} Ah, csomagtartóban)`} />
            <Stat label="Generátor" value={`${s.altA.toFixed(0)} A · ${Math.round(s.altRpm)} 1/perc`} />
            <Stat label="Fogyasztók" value={`${s.loadA.toFixed(1)} A`} />
            <Stat label="Önindító" value={s.starterA > 0 ? `${s.starterA.toFixed(0)} A` : "–"} />
            <Stat label="Generátor terhelés" value={`${s.altTorque.toFixed(1)} Nm`} />
          </div>
          <div className="mt-2 h-2 rounded bg-slate-800 overflow-hidden">
            <div className={`h-full ${s.batterySoc < 0.2 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.round(s.batterySoc * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">Ékszíj: főtengely → generátor (2.6:1) + vízpumpa. Vezérműszíj: főtengely → 2 vezérműtengely (2:1).</p>
        </div>
      </div>

      <details className="text-sm text-slate-400 rounded-xl bg-slate-900 border border-slate-700 p-3">
        <summary className="cursor-pointer text-slate-200 font-semibold">Hogyan vezess?</summary>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>Kapcsold be a gyújtást (I vagy gomb).</li>
          <li>Nyomd be a kuplungot (Space) vagy legyen üresben (N), és tartsd az önindítót (K), amíg beindul. Hidegen tovább tart.</li>
          <li>Tegyél 1-esbe kuplunggal benyomva, adj kis gázt (W), és <b>lassan</b> engedd fel a kuplungot. Ha gyorsan feldobod gáz nélkül: lefullad.</li>
          <li>Váltás: kuplung be → fokozat → kuplung fel. Kuplung nélkül váltani nem enged (reccs).</li>
          <li>6500-nál a határoló elveszi a gyújtást. Üres tankkal leáll. Gyújtás lekapcsolásával leáll.</li>
          <li>Guruló autó, sebességben, gyújtás BE: betolással is beindul.</li>
          <li>Hidegen az ECU dúsít és magasabb az alapjárat. A hűtővíz alapjáraton ~10 perc alatt ér üzemi (85–95 °C) hőmérsékletre, az olaj lassabban. Termosztát 84–92 °C között nyit, a ventilátor 97 °C-nál kapcsol be.</li>
          <li>Tartós nagy terhelés kis sebességnél (pl. fékkel terhelve, hosszú emelkedő) túlmelegít: 108 °C felett az ECU visszavesz a nyomatékból, 128 °C-nál a motor beragad. Menetszél és ventilátor hűt; leállított motor órák alatt hűl le.</li>
          <li>Elektromos: az önindító ~170 A-t vesz fel, lemerült akkuval (kb. 10% alatt) nem forgat. A generátort az ékszíj hajtja, ~450 1/perc motorfordulattól kezd tölteni, alapjáraton is 14.2 V-ot tart; a ventilátor 18 A. Gyújtás BE álló motorral: merül (töltés-lámpa).</li>
          <li>Fékek: a tárcsák a fékezési energiától melegszenek (elöl 65%), menetszél hűti őket. 450 °C felett fading (gyengül a fék), a fékfolyadék 230 °C felett forr – a pedál elmegy. Hosszú lejtőn motorfékkel (alacsonyabb fokozat) kímélheted.</li>
          <li>Időlassítás: a fejlécben 1× … 1/100. A pedálok valós időben reagálnak, a fizika lassítva fut, így a szelepek, a szikra és a robbanások követhetők.</li>
        </ol>
      </details>
    </div>
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
  const frac = Math.max(0, Math.min(1, (v - 20) / (warn + 20 - 20)));
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
