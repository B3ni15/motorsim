"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Sky } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { SceneCtx, useScene, type SceneCtxValue } from "./context";
import CarBody from "./CarBody";
import Chassis from "./Chassis";
import Powertrain from "./Powertrain";
import Interior from "./Interior";
import Exhaust, { ExhaustSmoke } from "./Exhaust";
import World from "./World";

import { viewDef, type ViewName } from "./views";
export { VIEWS, viewDef, type ViewName } from "./views";

/** Az autó pozíciója a világban */
function carMatrix(s: { posX: number; posZ: number; heading: number }, out: THREE.Matrix4) {
  return out.makeRotationY(s.heading).setPosition(s.posX, 0, s.posZ);
}

/** Kamera: a nézet-előbeállítás autóhoz rögzített, és az autóval együtt mozog. */
function CameraRig({ view, orbit }: { view: ViewName; orbit: RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const { stateRef } = useScene();
  const prev = useRef(new THREE.Matrix4());
  const prevInv = useRef(new THREE.Matrix4());
  const anim = useRef({ t: 0, fromPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(), fromFov: 40 });
  const first = useRef(true);
  const cur = useMemo(() => new THREE.Matrix4(), []);
  const tmpP = useMemo(() => new THREE.Vector3(), []);
  const tmpT = useMemo(() => new THREE.Vector3(), []);

  const applied = useRef<ViewName | null>(null);
  const setup = (c: OrbitControlsImpl) => {
    const inv = prevInv.current;
    const v = viewDef(view);
    anim.current.fromPos.copy(camera.position).applyMatrix4(inv);
    anim.current.fromTgt.copy(c.target).applyMatrix4(inv);
    anim.current.fromFov = camera.fov;
    anim.current.t = 0;
    if (first.current) {
      // első megjelenés: azonnal a nézetbe
      anim.current.fromPos.set(...v.pos);
      anim.current.fromTgt.set(...v.target);
      anim.current.fromFov = v.fov;
      first.current = false;
    }
    c.enablePan = !v.cockpit && !v.chase;
    c.enableZoom = !v.cockpit;
    // az animáció alatt nincs távolság-korlát (különben az OrbitControls „elhúzza” a kamerát)
    c.minDistance = 0;
    c.maxDistance = Infinity;
    c.maxPolarAngle = v.cockpit ? Math.PI : Math.PI / 2 - 0.04;
    c.rotateSpeed = v.cockpit ? 0.45 : 0.8;
    applied.current = view;
  };

  useFrame((st, dtRaw) => {
    (window as unknown as { __three?: unknown }).__three = st;
    const s = stateRef.current;
    const c = orbit.current;
    if (!s || !c) return;
    if ((window as unknown as { __freeze?: boolean }).__freeze) return; // tesztek: rögzített kamera
    const dt = Math.min(0.1, dtRaw);
    carMatrix(s, cur);
    if (applied.current !== view) {
      if (first.current) prevInv.current.copy(cur).invert();
      setup(c);
    }
    const v = viewDef(view);
    const a = anim.current;
    if (a.t < 1) {
      a.t = Math.min(1, a.t + dt / 1.1);
      (window as unknown as { __camDone?: boolean }).__camDone = a.t >= 1;
      if (a.t >= 1) {
        c.minDistance = v.cockpit ? 0.02 : 0.6;
        c.maxDistance = v.cockpit ? 0.12 : 40;
      }
      const e = a.t * a.t * (3 - 2 * a.t);
      tmpP.copy(a.fromPos).lerp(new THREE.Vector3(...v.pos), e).applyMatrix4(cur);
      tmpT.copy(a.fromTgt).lerp(new THREE.Vector3(...v.target), e).applyMatrix4(cur);
      camera.position.copy(tmpP);
      c.target.copy(tmpT);
      camera.fov = a.fromFov + (v.fov - a.fromFov) * e;
      camera.updateProjectionMatrix();
    } else if (v.chase) {
      // üldöző: lágyan az autó mögé áll
      tmpP.set(...v.pos).applyMatrix4(cur);
      tmpT.set(...v.target).applyMatrix4(cur);
      const k = 1 - Math.exp(-dt * 4);
      camera.position.lerp(tmpP, k);
      c.target.lerp(tmpT, 1 - Math.exp(-dt * 10));
    } else {
      // az autó elmozdulását ráviszi a kamerára (a felhasználó által beállított szög megmarad)
      camera.position.applyMatrix4(prevInv.current).applyMatrix4(cur);
      c.target.applyMatrix4(prevInv.current).applyMatrix4(cur);
    }
    prev.current.copy(cur);
    prevInv.current.copy(cur).invert();
    c.update();
  });
  return null;
}


/** Napfény árnyékkal, amely követi az autót */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null!);
  const { stateRef } = useScene();
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    scene.add(light.current.target);
  }, [scene]);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    light.current.position.set(s.posX + 6, 12, s.posZ + 4);
    light.current.target.position.set(s.posX, 0, s.posZ);
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.2}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-7}
      shadow-camera-right={7}
      shadow-camera-top={7}
      shadow-camera-bottom={-7}
      shadow-camera-near={1}
      shadow-camera-far={40}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}

/** Az autó: pozíció + karosszéria bólintás/dőlés */
function Car() {
  const { stateRef } = useScene();
  const root = useRef<THREE.Group>(null!);
  const sprung = useRef<THREE.Group>(null!);
  const pitch = useRef(0);
  const roll = useRef(0);
  useFrame((_, dt) => {
    const s = stateRef.current;
    if (!s) return;
    root.current.position.set(s.posX, 0, s.posZ);
    root.current.rotation.y = s.heading;
    // gyorsításkor hátra dől, fékezéskor bólint; kanyarban kifelé dől
    const k = 1 - Math.exp(-Math.min(0.1, dt) * 6);
    pitch.current += (THREE.MathUtils.clamp(s.accel, -12, 12) * 0.0028 - pitch.current) * k;
    roll.current += (THREE.MathUtils.clamp(s.latAccel, -11, 11) * 0.0032 - roll.current) * k;
    sprung.current.rotation.z = pitch.current;
    sprung.current.rotation.x = roll.current;
  });
  return (
    <group ref={root} name="Car">
      {/* rugózott tömeg: forgáspont nagyjából a súlypontban */}
      <group position={[0, 0.5, 0]}>
        <group ref={sprung}>
          <group position={[0, -0.5, 0]}>
            <CarBody />
            <Interior />
            <Powertrain />
            <Exhaust />
          </group>
        </group>
      </group>
      <Chassis />
    </group>
  );
}

function HiddenTabTicker() {
  const advance = useThree((st) => st.advance);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) advance(performance.now(), true);
    }, 33);
    return () => clearInterval(id);
  }, [advance]);
  return null;
}

export interface SceneProps extends Omit<SceneCtxValue, "xray" | "setOrbitEnabled"> {
  view: ViewName;
  showLabels: boolean;
  height?: number;
}

export default function Scene({ view, showLabels, height = 600, ...ctx }: SceneProps) {
  const orbit = useRef<OrbitControlsImpl | null>(null);
  const v = viewDef(view);
  const [, force] = useState(0);
  const setOrbitEnabled = useCallback((on: boolean) => {
    if (orbit.current) orbit.current.enabled = on;
  }, []);
  const value: SceneCtxValue = { ...ctx, xray: v.xray, setOrbitEnabled };
  // motortér nézetben nyit a motorháztető, kilépéskor (ha a nézet nyitotta) visszacsukódik
  const openedByView = useRef(false);
  useEffect(() => {
    const b = ctx.bodyRef.current;
    if (!b) return;
    if (v.hood && !b.hood) {
      b.hood = true;
      openedByView.current = true;
    } else if (!v.hood && openedByView.current) {
      b.hood = false;
      openedByView.current = false;
    }
    force((n) => n + 1);
  }, [v.hood, ctx.bodyRef]);
  return (
    <div
      className={`w-full rounded-xl overflow-hidden relative ${showLabels ? "" : "hide-tags"} ${view === "r-teljes" ? "hide-detail" : ""} ${v.xray ? "" : "hide-xray"}`}
      style={{ height }}
      data-testid="scene"
    >
      <style>{`.hide-tags .sim-tag{display:none!important}.hide-detail .sim-detail{display:none!important}.hide-xray .sim-tag{display:none!important}`}</style>
      <SceneCtx.Provider value={value}>
        <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.3, 1.45, 4.4], fov: 38, near: 0.02, far: 900 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <SceneCtx.Provider value={value}>
            <HiddenTabTicker />
            {v.xray ? <color attach="background" args={["#0b1220"]} /> : <Sky distance={4500} sunPosition={[60, 25, 40]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} />}
            {v.xray && <fog attach="fog" args={["#0b1220", 12, 60]} />}
            <Environment resolution={256} frames={1}>
              <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 4, 1]} />
              <Lightformer form="rect" intensity={1.4} position={[-6, 2, 3]} rotation={[0, Math.PI / 2, 0]} scale={[8, 1.2, 1]} />
              <Lightformer form="rect" intensity={1.4} position={[6, 2, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 1.2, 1]} />
              <Lightformer form="rect" intensity={0.8} color="#bfdbfe" position={[0, 1.5, -7]} scale={[10, 2, 1]} />
              <Lightformer form="rect" intensity={0.6} color="#fde68a" position={[0, 1.5, 7]} rotation={[0, Math.PI, 0]} scale={[10, 2, 1]} />
              <mesh scale={40}>
                <sphereGeometry args={[1, 32, 16]} />
                <meshBasicMaterial color="#8aa0b8" side={THREE.BackSide} />
              </mesh>
              <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[39, 32]} />
                <meshBasicMaterial color="#3b3f46" />
              </mesh>
            </Environment>
            <ambientLight intensity={v.xray ? 0.6 : 0.25} />
            <hemisphereLight args={["#dbeafe", "#334155", v.xray ? 0.6 : 0.45]} />
            <Sun />
            {v.xray && <pointLight position={[0, 2.5, 0]} intensity={4} distance={8} color="#7dd3fc" />}
            <Car />
            <ExhaustSmoke />
            <World />
            <CameraRig view={view} orbit={orbit} />
            <OrbitControls ref={orbit} target={[0, 0.62, 0]} enableDamping dampingFactor={0.12} makeDefault />
          </SceneCtx.Provider>
        </Canvas>
      </SceneCtx.Provider>
    </div>
  );
}
