"use client";

import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CAR } from "./shape";
import { useScene } from "./context";
import { Mat } from "./Mat";
import { rBadge, tyreWall, vwLogo } from "./textures";

export const LABEL = "sim-tag text-[11px] whitespace-nowrap bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/60";

const RIM_R = 0.2413; // 19"
const TYRE_W = 0.235;

function tyreGeometry() {
  const R = CAR.wheelR;
  const h = TYRE_W / 2;
  const pts: [number, number][] = [
    [RIM_R - 0.004, -h + 0.012],
    [RIM_R + 0.02, -h - 0.004],
    [R - 0.035, -h + 0.002],
    [R - 0.008, -h + 0.02],
    [R, -h + 0.045],
    [R, h - 0.045],
    [R - 0.008, h - 0.02],
    [R - 0.035, h - 0.002],
    [RIM_R + 0.02, h + 0.004],
    [RIM_R - 0.004, h - 0.012],
  ];
  const g = new THREE.LatheGeometry(
    pts.map(([r, z]) => new THREE.Vector2(r, z)),
    72,
  );
  g.rotateX(Math.PI / 2);
  return g;
}

/** Futófelület barázdák (gyűrűk) */
function grooves() {
  const g = new THREE.TorusGeometry(CAR.wheelR - 0.001, 0.0045, 6, 72);
  return g;
}

/** 5 dupla küllős felni (Pretoria-szerű) */
function Rim({ side }: { side: 1 | -1 }) {
  const logo = useMemo(() => vwLogo(), []);
  const face = side * (TYRE_W / 2 - 0.015);
  return (
    <group>
      {/* perem + kehely */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[RIM_R - 0.004, RIM_R - 0.004, TYRE_W - 0.03, 48, 1, true]} />
        <Mat c="#3f3f46" m={0.9} r={0.35} side={THREE.DoubleSide} ghost ghostOpacity={0.2} />
      </mesh>
      <mesh position={[0, 0, face]}>
        <torusGeometry args={[RIM_R - 0.008, 0.009, 8, 64]} />
        <Mat c="#d4d4d8" m={1} r={0.18} ghost ghostOpacity={0.3} />
      </mesh>
      {/* küllők */}
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return [-0.12, 0.12].map((da) => (
          <group key={`${i}${da}`} rotation={[0, 0, a + da]}>
            <mesh position={[0, 0.13, face - side * 0.012]} rotation={[side * 0.18, 0, 0]}>
              <boxGeometry args={[0.024, 0.205, 0.022]} />
              <Mat c="#b4b4bb" m={0.7} r={0.3} ghost ghostOpacity={0.3} />
            </mesh>
          </group>
        ));
      })}
      {/* agy + anyák + kupak */}
      <mesh position={[0, 0, face - side * 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.04, 24]} />
        <Mat c="#71717a" m={0.95} r={0.3} ghost ghostOpacity={0.3} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.05, Math.sin(a) * 0.05, face]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.012, 6]} />
            <Mat c="#e4e4e7" m={1} r={0.2} />
          </mesh>
        );
      })}
      <mesh position={[0, 0, face + side * 0.003]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
        <circleGeometry args={[0.03, 24]} />
        <meshStandardMaterial map={logo} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Wheel({ front, side }: { front: boolean; side: 1 | -1 }) {
  const { stateRef, controlsRef, xray } = useScene();
  const steer = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Group>(null!);
  const discMat = useRef<THREE.MeshStandardMaterial>(null!);
  const label = useRef<HTMLDivElement>(null!);
  const tyre = useMemo(() => tyreGeometry(), []);
  const groove = useMemo(() => grooves(), []);
  const wall = useMemo(() => tyreWall(), []);
  const r = useMemo(() => rBadge(), []);
  const discR = front ? 0.17 : 0.155;
  const discT = front ? 0.03 : 0.022;
  const x = front ? CAR.axleF : CAR.axleR;
  const z = side * (front ? CAR.trackF : CAR.trackR) / 2;
  useFrame(() => {
    const s = stateRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    spin.current.rotation.z = -s.wheelAngle;
    if (front) {
      // Ackermann: a belső kerék jobban fordul
      const a = s.steerAngle;
      const inner = (a > 0 && side > 0) || (a < 0 && side < 0);
      steer.current.rotation.y = -a * (inner ? 1.08 : 0.93);
    }
    const t = front ? s.brakeFrontC : s.brakeRearC;
    const glow = THREE.MathUtils.clamp((t - 300) / 400, 0, 1);
    discMat.current.emissiveIntensity = glow * 2.4;
    discMat.current.emissive.setRGB(1, 0.22 + glow * 0.5, glow * 0.3);
    if (label.current) {
      const parking = !front && (s.epb === "applied" || s.epb === "applying");
      label.current.textContent = `${front ? "első" : "hátsó"} fék ${t.toFixed(0)} °C${c.brake > 0.05 ? " · fékez" : ""}${parking ? " · EPB" : ""}`;
    }
  });
  // féknyereg a tárcsa mögött (első: hátul, hátsó: elöl), kicsit felül
  const caliperAngle = front ? Math.PI - 0.35 : 0.35;
  return (
    <group name={`Wheel-${front ? "F" : "R"}${side > 0 ? "R" : "L"}`} position={[x, CAR.wheelR, z]}>
      <group ref={steer}>
        <group ref={spin}>
          <mesh geometry={tyre} castShadow>
            <meshStandardMaterial color="#141416" roughness={0.92} transparent={xray} opacity={xray ? 0.18 : 1} depthWrite={!xray} />
          </mesh>
          {[-0.06, -0.02, 0.02, 0.06].map((gz) => (
            <mesh key={gz} geometry={groove} position={[0, 0, gz]}>
              <meshStandardMaterial color="#050505" roughness={1} transparent={xray} opacity={xray ? 0.1 : 1} />
            </mesh>
          ))}
          {/* oldalfal felirat */}
          <mesh position={[0, 0, side * (TYRE_W / 2 + 0.0025)]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <ringGeometry args={[RIM_R + 0.03, CAR.wheelR - 0.03, 72, 1]} />
            <meshStandardMaterial map={wall} transparent opacity={xray ? 0.2 : 0.9} roughness={0.9} />
          </mesh>
          <Rim side={side} />
          {/* féktárcsa (hűtött, belső szellőzéssel) */}
          <mesh position={[0, 0, -side * 0.035]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[discR, discR, discT, 48]} />
            <meshStandardMaterial ref={discMat} color="#8b8b92" metalness={0.85} roughness={0.38} emissive="#ff4500" emissiveIntensity={0} />
          </mesh>
          <mesh position={[0, 0, -side * 0.035]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.085, 0.085, discT + 0.02, 24]} />
            <meshStandardMaterial color="#3f3f46" metalness={0.8} roughness={0.5} />
          </mesh>
        </group>
        {/* féknyereg (áll) */}
        <group rotation={[0, 0, caliperAngle]}>
          <mesh position={[discR - 0.02, 0, -side * 0.035]}>
            <boxGeometry args={[0.075, front ? 0.2 : 0.15, discT + 0.07]} />
            <meshStandardMaterial color="#0b0b0d" metalness={0.4} roughness={0.25} />
          </mesh>
          {front && (
            <mesh position={[discR - 0.02, 0, -side * 0.035 + side * ((discT + 0.07) / 2 + 0.001)]} rotation={[0, side > 0 ? 0 : Math.PI, Math.PI / 2 - caliperAngle]}>
              <planeGeometry args={[0.06, 0.06]} />
              <meshStandardMaterial map={r} transparent />
            </mesh>
          )}
        </group>
        {/* kerékagy-csonkállvány */}
        <mesh position={[0, 0, -side * 0.1]}>
          <boxGeometry args={[0.09, 0.26, 0.06]} />
          <Mat c="#52525b" m={0.6} r={0.5} />
        </mesh>
      </group>
      {side > 0 && (
        <Html position={[0, -CAR.wheelR - 0.06, side * 0.15]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div ref={label} className={`${LABEL} text-slate-300`}>
            fék
          </div>
        </Html>
      )}
    </group>
  );
}

/** Csavarrugó (helix) */
function Spring({ from, to, r = 0.065, turns = 6 }: { from: [number, number, number]; to: [number, number, number]; r?: number; turns?: number }) {
  const geom = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const axis = b.clone().sub(a);
    const len = axis.length();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= turns * 16; i++) {
      const t = i / (turns * 16);
      const ang = t * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, t * len, Math.sin(ang) * r));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.009, 6, false);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    return g;
  }, [from, to, r, turns]);
  return (
    <mesh geometry={geom}>
      <Mat c="#1f2937" m={0.6} r={0.4} />
    </mesh>
  );
}

function Rod({ from, to, r = 0.012, color = "#3f3f46" }: { from: [number, number, number]; to: [number, number, number]; r?: number; color?: string }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    return {
      pos: a.clone().add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
      len: d.length(),
    };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 10]} />
      <Mat c={color} m={0.7} r={0.4} />
    </mesh>
  );
}

export { Rod, Spring };

/** Felfüggesztés: elöl McPherson, hátul többlengőkaros */
function Suspension() {
  const zF = CAR.trackF / 2;
  const zR = CAR.trackR / 2;
  const F = CAR.axleF;
  const B = CAR.axleR;
  return (
    <group name="Suspension">
      {[1, -1].map((sd) => (
        <group key={sd}>
          {/* elöl: gólyaláb */}
          <Rod from={[F - 0.02, 0.36, sd * (zF - 0.13)]} to={[F - 0.05, 0.78, sd * (zF - 0.22)]} r={0.025} color="#27272a" />
          <Spring from={[F - 0.03, 0.55, sd * (zF - 0.16)]} to={[F - 0.05, 0.75, sd * (zF - 0.215)]} r={0.07} turns={5} />
          <Rod from={[F - 0.02, 0.2, sd * (zF - 0.1)]} to={[F + 0.05, 0.22, sd * 0.32]} r={0.016} />
          <Rod from={[F - 0.02, 0.2, sd * (zF - 0.1)]} to={[F - 0.25, 0.22, sd * 0.34]} r={0.016} />
          {/* kormányösszekötő */}
          <Rod from={[F - 0.12, 0.29, sd * (zF - 0.11)]} to={[F - 0.14, 0.28, sd * 0.3]} r={0.009} color="#71717a" />
          {/* hátul: lengőkarok + külön rugó és lengéscsillapító */}
          <Rod from={[B, 0.22, sd * (zR - 0.1)]} to={[B + 0.05, 0.24, sd * 0.36]} r={0.016} />
          <Rod from={[B + 0.02, 0.38, sd * (zR - 0.1)]} to={[B + 0.05, 0.4, sd * 0.4]} r={0.012} />
          <Rod from={[B, 0.22, sd * (zR - 0.1)]} to={[B + 0.45, 0.26, sd * (zR - 0.2)]} r={0.016} />
          <Spring from={[B + 0.05, 0.24, sd * (zR - 0.28)]} to={[B + 0.05, 0.47, sd * (zR - 0.28)]} r={0.06} turns={5} />
          <Rod from={[B - 0.08, 0.24, sd * (zR - 0.13)]} to={[B - 0.12, 0.62, sd * (zR - 0.2)]} r={0.02} color="#27272a" />
        </group>
      ))}
      {/* kormánymű (fogasléc) */}
      <Rod from={[CAR.axleF - 0.14, 0.28, -0.3]} to={[CAR.axleF - 0.14, 0.28, 0.3]} r={0.022} color="#52525b" />
      {/* első segédváz + hátsó segédváz */}
      <mesh position={[CAR.axleF - 0.1, 0.2, 0]}>
        <boxGeometry args={[0.45, 0.05, 0.75]} />
        <Mat c="#27272a" m={0.5} r={0.6} ghost ghostOpacity={0.35} />
      </mesh>
      <mesh position={[CAR.axleR + 0.05, 0.27, 0]}>
        <boxGeometry args={[0.3, 0.05, 0.95]} />
        <Mat c="#27272a" m={0.5} r={0.6} ghost ghostOpacity={0.35} />
      </mesh>
    </group>
  );
}

export default function Chassis() {
  return (
    <group>
      <Wheel front side={1} />
      <Wheel front side={-1} />
      <Wheel front={false} side={1} />
      <Wheel front={false} side={-1} />
      <Suspension />
    </group>
  );
}
