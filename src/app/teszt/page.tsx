"use client";

/**
 * 3D teszt-oldal: a jelenet önálló betöltése URL-paraméterekkel + illeszkedés-ellenőrzés.
 *   /teszt?view=belso&run=1&thr=0.2&lights=1&doors=1&hood=1&tail=1&fit=1
 * A `fit=1` lefuttatja a runFitCheck-et (minden alkatrész a karosszérián belül van-e),
 * az eredmény a lap alján (data-testid="fit") és window.__fit alatt olvasható.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { createState, defaultControls, pressStartStop, step, DT } from "@/lib/engine";
import { defaultBody, type LeverState } from "@/components/three/context";
import type { ViewName } from "@/components/three/views";
import { runFitCheck, type FitIssue } from "@/components/three/fitcheck";

const Scene = dynamic(() => import("@/components/three/Scene"), { ssr: false });

type Win = { __three?: { scene: THREE.Scene }; __sim?: unknown; __fit?: unknown };

export default function TestPage() {
  const stateRef = useRef(createState());
  const controlsRef = useRef(defaultControls());
  const bodyRef = useRef(defaultBody());
  const leverRef = useRef<LeverState>({ u: 0, v: 0, dragging: false });
  const [view, setView] = useState<ViewName>("kulso");
  const [fit, setFit] = useState<{ checked: number; issues: FitIssue[] } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const w = window as unknown as Win;
    if (q.get("view")) setView(q.get("view") as ViewName);
    const b = bodyRef.current;
    const c = controlsRef.current;
    const s = stateRef.current;
    if (q.get("doors")) b.doors = [true, true, true, true];
    if (q.get("hood")) b.hood = true;
    if (q.get("tail")) b.tailgate = true;
    if (q.get("lights")) {
      c.ignition = true;
      b.lights = true;
      c.brake = 1;
      b.hazard = true;
    }
    let id: ReturnType<typeof setInterval> | undefined;
    if (q.get("run")) {
      s.tempC = 90;
      s.oilTempC = 90;
      c.clutch = 1;
      pressStartStop(s, c);
      let last = performance.now();
      id = setInterval(() => {
        const now = performance.now();
        let dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        while (dt > 0) {
          step(s, c, DT);
          dt -= DT;
        }
      }, 20);
      setTimeout(() => {
        c.clutch = 0;
        c.throttle = Number(q.get("thr") || 0);
      }, 2500);
    }
    w.__sim = { stateRef, controlsRef, bodyRef, setView };
    let fitTimer: ReturnType<typeof setTimeout> | undefined;
    if (q.get("fit")) {
      const tryFit = () => {
        const car = w.__three?.scene.getObjectByName("Car");
        if (!car) {
          fitTimer = setTimeout(tryFit, 500);
          return;
        }
        const r = runFitCheck(car);
        w.__fit = r;
        setFit(r);
      };
      fitTimer = setTimeout(tryFit, 1500);
    }
    return () => {
      if (id) clearInterval(id);
      if (fitTimer) clearTimeout(fitTimer);
    };
  }, []);

  return (
    <div>
      <Scene view={view} showLabels stateRef={stateRef} controlsRef={controlsRef} bodyRef={bodyRef} leverRef={leverRef} onInteract={() => {}} height={820} />
      {fit && (
        <pre data-testid="fit" className="text-xs p-3 whitespace-pre-wrap">
          {`Illeszkedés-ellenőrzés: ${fit.checked} alkatrész, ${fit.issues.length} hiba\n`}
          {fit.issues.map((i) => `${i.worst.toFixed(3)} m  ${i.reason}  @${i.point.join(", ")}  ${i.path}`).join("\n")}
        </pre>
      )}
    </div>
  );
}
