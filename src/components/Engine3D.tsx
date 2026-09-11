"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { cylinderKinematics, DRIVETRAIN, ENGINE, type Controls, type SimState } from "@/lib/engine";

interface Props {
  stateRef: RefObject<SimState>;
  controlsRef: RefObject<Controls>;
}

export type ViewName = "auto" | "motor" | "hengerek" | "hajtas" | "fek";

export const VIEWS: { id: ViewName; label: string; pos: [number, number, number]; target: [number, number, number] }[] = [
  { id: "auto", label: "Teljes autó", pos: [-14, 15, 33], target: [12, -1, 0] },
  { id: "motor", label: "Motor", pos: [-4.5, 7.5, 12.5], target: [0, 1.5, 0] },
  { id: "hengerek", label: "Hengerek", pos: [1.5, 3.2, 6.5], target: [0.5, 1.8, 0] },
  { id: "hajtas", label: "Hajtáslánc", pos: [9, 10, 28], target: [17, -1.2, 0] },
  { id: "fek", label: "Fék / hátsó", pos: [36, 6.5, 19], target: [27, -1.2, -1] },
];

/* =========================================================================
   Méretarány: 1 egység = 10 cm. Autó tengelye: +X = hátra, +Y = fel, +Z = jobb.
   Motor: hosszában, főtengely az origóban (y=0), 1. henger elöl (−X).
   ========================================================================= */
const N = ENGINE.cylinders;
const R = ENGINE.strokeMm / 200; // 0.42 – forgattyúkar
const L = ENGINE.rodMm / 100; // 1.35 – hajtókar
const BORE = ENGINE.boreMm / 100; // 0.84
const SPACING = 0.91; // hengerosztás 91 mm
const CYL_X = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * SPACING);
const PISTON_H = 0.5;
const HEAD_Y = L + R + 0.35; // égéstér teteje
const LINER_BOTTOM = L - R - 0.35;
const CAM_Y = HEAD_Y + 0.95;
const CAM_Z = 0.36;

const GROUND_Y = -4.6;
const WHEEL_R = DRIVETRAIN.wheelRadius * 10; // 3.16
const WHEEL_Y = GROUND_Y + WHEEL_R;
const TRACK = (DRIVETRAIN.trackM * 10) / 2; // 7.3
const X_FRONT = -2.2;
const X_REAR = X_FRONT + DRIVETRAIN.wheelbaseM * 10; // 24.8
const FLYWHEEL_X = 3.5;

const COLLECTOR_A = { x: CYL_X[1], y: 0.5, z: -1.45 };
const COLLECTOR_B = { x: CYL_X[4], y: 0.5, z: -1.45 };
const EXHAUST_Y = -3.35;
const TAILPIPE_END = new THREE.Vector3(34.6, EXHAUST_Y, -5.6);

const STROKE_COLORS: Record<string, THREE.Color> = {
  munka: new THREE.Color("#f97316"),
  kipufogó: new THREE.Color("#94a3b8"),
  szívó: new THREE.Color("#38bdf8"),
  sűrítő: new THREE.Color("#a78bfa"),
};

const LABEL = "sim-tag text-[11px] whitespace-nowrap bg-slate-900/75 px-1.5 py-0.5 rounded border border-slate-700/60";
const LABEL_D = `${LABEL} sim-detail`;

function Label({
  position,
  children,
  className = "text-slate-200",
  detail = true,
}: {
  position: [number, number, number];
  children: React.ReactNode;
  className?: string;
  /** részletcímke: a „Teljes autó” nézetben elrejtve */
  detail?: boolean;
}) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
      <div className={`${detail ? LABEL_D : LABEL} ${className}`}>{children}</div>
    </Html>
  );
}

/* ------------------------------------------------------------------------- */
/* Henger: dugattyú, hajtókar, 4 szelep, gyertya, injektor, égés, leömlő       */
/* ------------------------------------------------------------------------- */
function Cylinder({ index, stateRef }: { index: number; stateRef: RefObject<SimState> }) {
  const piston = useRef<THREE.Mesh>(null!);
  const rod = useRef<THREE.Mesh>(null!);
  const intake = useRef<THREE.Group>(null!);
  const exhaust = useRef<THREE.Group>(null!);
  const spark = useRef<THREE.Mesh>(null!);
  const sparkLight = useRef<THREE.PointLight>(null!);
  const burn = useRef<THREE.Mesh>(null!);
  const burnMat = useRef<THREE.MeshStandardMaterial>(null!);
  const burnLight = useRef<THREE.PointLight>(null!);
  const flash = useRef<THREE.Mesh>(null!);
  const charge = useRef<THREE.Mesh>(null!);
  const chargeMat = useRef<THREE.MeshStandardMaterial>(null!);
  const spray = useRef<THREE.Mesh>(null!);
  const sprayMat = useRef<THREE.MeshBasicMaterial>(null!);
  const exhMat = useRef<THREE.MeshStandardMaterial>(null!);
  const x = CYL_X[index - 1];
  const collector = index <= 3 ? COLLECTOR_A : COLLECTOR_B;

  const runnerGeom = useMemo(() => {
    const pts = [
      new THREE.Vector3(x, HEAD_Y + 0.05, -0.62),
      new THREE.Vector3(x, HEAD_Y - 0.1, -1.05),
      new THREE.Vector3(x + (collector.x - x) * 0.4, HEAD_Y - 0.75, -1.4),
      new THREE.Vector3(collector.x + (x - collector.x) * 0.12, collector.y + 0.22, collector.z),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.1, 10, false);
  }, [x, collector]);

  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const k = cylinderKinematics(s.crank, s.running)[index - 1];
    const th = (k.phase * Math.PI) / 180;
    const py = R * Math.cos(th);
    const pz = R * Math.sin(th);
    const wy = R * Math.cos(th) + Math.sqrt(L * L - R * R * Math.sin(th) ** 2);
    piston.current.position.y = wy + PISTON_H / 2 - 0.1;
    const dy = py - wy;
    const len = Math.sqrt(dy * dy + pz * pz);
    rod.current.position.set(x, (wy + py) / 2, pz / 2);
    rod.current.rotation.x = Math.atan2(pz, dy);
    rod.current.scale.y = len;
    intake.current.position.y = -k.intake * 0.2;
    exhaust.current.position.y = -k.exhaust * 0.2;
    spark.current.visible = k.spark;
    sparkLight.current.intensity = k.spark ? 12 : 0;
    const pistonTop = wy + PISTON_H - 0.1;
    const h = Math.max(0.03, HEAD_Y - pistonTop);
    burn.current.position.y = pistonTop + h / 2;
    burn.current.scale.y = h;
    burnMat.current.opacity = Math.min(1, k.burn * 1.2);
    burnMat.current.emissiveIntensity = 0.5 + k.burn * 6;
    burnLight.current.intensity = k.burn * 35;
    burnLight.current.position.y = pistonTop + h * 0.5;
    flash.current.visible = k.burn > 0.55;
    flash.current.scale.setScalar(0.6 + k.burn * 0.8);
    flash.current.position.y = pistonTop + h * 0.5;
    charge.current.position.y = pistonTop + h / 2;
    charge.current.scale.y = h;
    chargeMat.current.color.copy(STROKE_COLORS[k.stroke]);
    chargeMat.current.opacity = k.stroke === "munka" ? 0.04 : k.stroke === "sűrítő" ? 0.1 + (1 - h / (2 * R + 0.35)) * 0.3 : 0.2;
    const inj = s.running && k.intake > 0 && s.injectorMs > 0 ? Math.min(1, k.intake * 1.5) : 0;
    spray.current.visible = inj > 0;
    sprayMat.current.opacity = inj * 0.75;
    const glow = Math.max(0, Math.min(1, (s.exhaustC - 350) / 600));
    exhMat.current.emissiveIntensity = glow * 1.6;
    exhMat.current.color.setRGB(0.35 + glow * 0.4, 0.35 - glow * 0.2, 0.38 - glow * 0.3);
  });

  const Valve = ({ z, dx, color, stemColor, groupRef }: { z: number; dx: number; color: string; stemColor: string; groupRef?: RefObject<THREE.Group> }) => (
    <group ref={groupRef} position={[x + dx, HEAD_Y - 0.02, z]}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
        <meshStandardMaterial color={stemColor} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.14, 0.1, 0.05, 18]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.35, 8, 1, true]} />
        <meshStandardMaterial color="#94a3b8" wireframe />
      </mesh>
    </group>
  );

  return (
    <group>
      {/* hengerpersely */}
      <mesh position={[x, (HEAD_Y + LINER_BOTTOM) / 2, 0]}>
        <cylinderGeometry args={[BORE / 2 + 0.03, BORE / 2 + 0.03, HEAD_Y - LINER_BOTTOM, 32, 1, true]} />
        <meshPhysicalMaterial color="#cbd5e1" transparent opacity={0.16} roughness={0.1} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={charge} position={[x, HEAD_Y, 0]}>
        <cylinderGeometry args={[BORE / 2, BORE / 2, 1, 24]} />
        <meshStandardMaterial ref={chargeMat} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh ref={burn} position={[x, HEAD_Y, 0]}>
        <cylinderGeometry args={[BORE / 2 - 0.02, BORE / 2 - 0.02, 1, 24]} />
        <meshStandardMaterial ref={burnMat} color="#fb923c" emissive="#ff5a00" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={flash} position={[x, HEAD_Y, 0]} visible={false}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color="#fff3c4" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <pointLight ref={burnLight} position={[x, HEAD_Y - 0.2, 0]} color="#ff7a1a" intensity={0} distance={3.5} decay={2} />
      {/* dugattyú */}
      <mesh ref={piston} position={[x, L, 0]} castShadow>
        <cylinderGeometry args={[BORE / 2 - 0.01, BORE / 2 - 0.01, PISTON_H, 32]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh ref={rod} castShadow>
        <boxGeometry args={[0.16, 1, 0.1]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* 2 szívó (kék) + 2 kipufogó (piros) szelep */}
      <group ref={intake}>
        <Valve z={CAM_Z - 0.06} dx={-0.2} color="#38bdf8" stemColor="#7dd3fc" />
        <Valve z={CAM_Z - 0.06} dx={0.2} color="#38bdf8" stemColor="#7dd3fc" />
      </group>
      <group ref={exhaust}>
        <Valve z={-CAM_Z + 0.06} dx={-0.2} color="#ef4444" stemColor="#fca5a5" />
        <Valve z={-CAM_Z + 0.06} dx={0.2} color="#ef4444" stemColor="#fca5a5" />
      </group>
      {/* gyújtógyertya + tekercs (coil-on-plug) */}
      <mesh position={[x, HEAD_Y + 0.45, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.9, 8]} />
        <meshStandardMaterial color="#f5f5f4" />
      </mesh>
      <mesh position={[x, CAM_Y + 0.55, 0]}>
        <boxGeometry args={[0.32, 0.5, 0.32]} />
        <meshStandardMaterial color="#111827" roughness={0.7} />
      </mesh>
      <mesh ref={spark} position={[x, HEAD_Y - 0.06, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color="#fef9c3" />
      </mesh>
      <pointLight ref={sparkLight} position={[x, HEAD_Y - 0.1, 0]} color="#bfdbfe" intensity={0} distance={2} />
      {/* injektor a szívócsatornában */}
      <group position={[x, HEAD_Y + 0.6, 0.85]} rotation={[0.6, 0, 0]}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.32, 10]} />
          <meshStandardMaterial color="#facc15" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh ref={spray} position={[0, -0.22, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.13, 0.45, 12, 1, true]} />
          <meshBasicMaterial ref={sprayMat} color="#bae6fd" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      {/* szívócsatorna (a szívócső felől) */}
      <mesh position={[x, HEAD_Y + 0.55, 0.68]} rotation={[0.6, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.9, 12, 1, true]} />
        <meshPhysicalMaterial color="#7dd3fc" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* leömlő */}
      <mesh geometry={runnerGeom}>
        <meshStandardMaterial ref={exhMat} color="#57534e" emissive="#ff3300" emissiveIntensity={0} metalness={0.6} roughness={0.5} />
      </mesh>
      <Label position={[x, CAM_Y + 1.1, 0]} className="text-slate-100 font-bold">
        {index}
      </Label>
    </group>
  );
}

/* Két vezérműtengely, hengerenként 2-2 bütyök. */
function Camshafts({ stateRef }: { stateRef: RefObject<SimState> }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (stateRef.current) g.current.rotation.x = stateRef.current.crank / 2;
  });
  const offsets = [0, 480, 240, 600, 120, 360]; // index 0..5 → henger 1..6
  return (
    <group ref={g} position={[0, CAM_Y, 0]}>
      {[CAM_Z, -CAM_Z].map((z, side) => (
        <group key={side} position={[0, 0, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, N * SPACING + 0.6, 12]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
          </mesh>
          {CYL_X.map((x, i) => {
            const lobeDeg = (side === 0 ? 460 : 260) + offsets[i];
            const a = ((lobeDeg / 2) * Math.PI) / 180;
            return [-0.2, 0.2].map((dx) => (
              <mesh key={`${i}${dx}`} position={[x + dx, 0, 0]} rotation={[-a, 0, 0]}>
                <boxGeometry args={[0.1, 0.32, 0.15]} />
                <meshStandardMaterial color={side === 0 ? "#38bdf8" : "#ef4444"} metalness={0.7} roughness={0.35} />
              </mesh>
            ));
          })}
        </group>
      ))}
    </group>
  );
}

/* Főtengely: 6 forgattyú, 1-6: 0°, 2-5: 120°, 3-4: 240°; 7 főcsapágy */
function Crankshaft({ stateRef }: { stateRef: RefObject<SimState> }) {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (stateRef.current) group.current.rotation.x = stateRef.current.crank;
  });
  const throwDeg = [0, 120, 240, 240, 120, 0];
  return (
    <group ref={group}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, N * SPACING + 1.6, 16]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
      </mesh>
      {CYL_X.map((x, i) => {
        const a = (throwDeg[i] * Math.PI) / 180;
        return (
          <group key={i} position={[x, 0, 0]} rotation={[a, 0, 0]}>
            {[-0.22, 0.22].map((dx) => (
              <mesh key={dx} position={[dx, R / 2, 0]}>
                <boxGeometry args={[0.13, R + 0.3, 0.5]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
            <mesh position={[0, R, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.5, 16]} />
              <meshStandardMaterial color="#78350f" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.25, 0]}>
              <boxGeometry args={[0.5, 0.35, 0.45]} />
              <meshStandardMaterial color="#b45309" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Pulley({ r, w = 0.14, color = "#94a3b8", teeth = false }: { r: number; w?: number; color?: string; teeth?: boolean }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[r, r, w, 32]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[w / 2 + 0.005, r * 0.7, 0]}>
        <boxGeometry args={[0.01, r * 0.35, 0.05]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      {teeth &&
        Array.from({ length: 18 }).map((_, i) => (
          <mesh key={i} rotation={[(i * Math.PI) / 9, 0, 0]}>
            <boxGeometry args={[w * 0.9, r * 2 + 0.03, 0.03]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} />
          </mesh>
        ))}
    </group>
  );
}

function Belt({ points, color = "#111", radius = 0.035 }: { points: [number, number, number][]; color?: string; radius?: number }) {
  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), true, "centripetal", 0.6);
    return new THREE.TubeGeometry(curve, 160, radius, 8, true);
  }, [points, radius]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.3} />
    </mesh>
  );
}

function beltPath(x: number, pulleys: { y: number; z: number; r: number; from: number; to: number }[], rad: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (const p of pulleys) {
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = p.from + ((p.to - p.from) * i) / n;
      pts.push([x, p.y + (p.r + rad) * Math.sin(a), p.z + (p.r + rad) * Math.cos(a)]);
    }
  }
  return pts;
}

const FRONT_X = CYL_X[0] - 0.85; // motor eleje

/* Vezérműlánc (M52: lánc, nem szíj) + VANOS a szívó vezérművön */
function TimingChain({ stateRef }: { stateRef: RefObject<SimState> }) {
  const crank = useRef<THREE.Group>(null!);
  const camA = useRef<THREE.Group>(null!);
  const camB = useRef<THREE.Group>(null!);
  const idler = useRef<THREE.Group>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    crank.current.rotation.x = s.crank;
    camA.current.rotation.x = s.crank / 2;
    camB.current.rotation.x = s.crank / 2;
    idler.current.rotation.x = s.crank * 2.5;
  });
  const X = FRONT_X;
  const path = useMemo(
    () =>
      beltPath(
        X,
        [
          { y: CAM_Y, z: CAM_Z, r: 0.3, from: -0.2, to: Math.PI / 2 + 0.3 },
          { y: 0, z: 0, r: 0.15, from: Math.PI / 2 - 0.2, to: Math.PI * 1.5 + 0.2 },
          { y: 1.3, z: -0.8, r: 0.1, from: Math.PI * 1.5 + 0.9, to: Math.PI * 1.5 + 0.2 },
          { y: CAM_Y, z: -CAM_Z, r: 0.3, from: -Math.PI / 2 - 0.3, to: 0.2 },
        ],
        0.045,
      ),
    [X],
  );
  return (
    <group>
      <mesh position={[X, CAM_Y / 2 + 0.1, 0]}>
        <boxGeometry args={[0.2, CAM_Y + 1.3, 1.9]} />
        <meshPhysicalMaterial color="#1e293b" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <group ref={crank} position={[X, 0, 0]}>
        <Pulley r={0.15} color="#9ca3af" teeth />
      </group>
      <group ref={camA} position={[X, CAM_Y, CAM_Z]}>
        <Pulley r={0.3} color="#38bdf8" teeth />
      </group>
      {/* VANOS egység a szívó vezérmű előtt */}
      <mesh position={[X - 0.35, CAM_Y, CAM_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.4, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={camB} position={[X, CAM_Y, -CAM_Z]}>
        <Pulley r={0.3} color="#ef4444" teeth />
      </group>
      <group ref={idler} position={[X, 1.3, -0.8]}>
        <Pulley r={0.1} w={0.1} color="#64748b" />
      </group>
      <Belt points={path} color="#52525b" radius={0.04} />
      <Label position={[X, CAM_Y + 0.9, 0]} className="text-slate-300">
        vezérműlánc 2:1 · VANOS
      </Label>
    </group>
  );
}

/* Ékszíj: főtengely → generátor, vízpumpa, szervószivattyú, klíma, feszítő */
function AccessoryBelt({ stateRef }: { stateRef: RefObject<SimState> }) {
  const crank = useRef<THREE.Group>(null!);
  const alt = useRef<THREE.Group>(null!);
  const pump = useRef<THREE.Group>(null!);
  const ps = useRef<THREE.Group>(null!);
  const ac = useRef<THREE.Group>(null!);
  const tens = useRef<THREE.Group>(null!);
  const fan = useRef<THREE.Group>(null!);
  const altLabel = useRef<HTMLDivElement>(null!);
  const altMat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    crank.current.rotation.x = s.crank;
    alt.current.rotation.x = s.crank * 2.6;
    pump.current.rotation.x = s.crank * 1.1;
    fan.current.rotation.x = s.crank * 1.1 * (s.tempC > 90 ? 0.9 : 0.35); // viszkó-kuplung
    ps.current.rotation.x = s.crank * 1.3;
    ac.current.rotation.x = s.crank * 1.2;
    tens.current.rotation.x = s.crank * 3;
    if (altLabel.current) altLabel.current.textContent = `generátor ${s.altA.toFixed(0)} A · ${s.batteryV.toFixed(1)} V`;
    altMat.current.emissiveIntensity = s.altA > 0 ? 0.15 + (s.altA / 90) * 0.6 : 0;
  });
  const X = FRONT_X - 0.45;
  const path = useMemo(
    () =>
      beltPath(
        X,
        [
          { y: 2.4, z: -1.25, r: 0.22, from: -Math.PI / 2 - 0.4, to: 0.5 }, // generátor
          { y: 1.2, z: 0, r: 0.3, from: -0.5, to: 0.5 }, // vízpumpa (középen)
          { y: 2.0, z: 1.3, r: 0.25, from: -0.3, to: Math.PI / 2 + 0.5 }, // szervó
          { y: 0.1, z: 1.5, r: 0.28, from: Math.PI / 2 - 0.2, to: Math.PI + 0.3 }, // klíma
          { y: 0, z: 0, r: 0.42, from: Math.PI - 0.2, to: Math.PI * 1.5 - 0.1 }, // főtengely
          { y: 1.1, z: -0.7, r: 0.14, from: Math.PI * 1.5 + 0.1, to: Math.PI * 1.5 - 0.7 }, // feszítő
        ],
        0.045,
      ),
    [X],
  );
  return (
    <group>
      <group ref={crank} position={[X, 0, 0]}>
        <Pulley r={0.42} color="#6b7280" />
        {/* rezgéscsillapító */}
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.15, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
      {/* generátor */}
      <group ref={alt} position={[X, 2.4, -1.25]}>
        <Pulley r={0.22} color="#cbd5e1" />
      </group>
      <mesh position={[X + 0.5, 2.4, -1.25]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.38, 0.38, 0.8, 24]} />
        <meshStandardMaterial ref={altMat} color="#94a3b8" emissive="#fbbf24" emissiveIntensity={0} metalness={0.7} roughness={0.4} />
      </mesh>
      <Html position={[X + 0.3, 3.1, -1.25]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={altLabel} className={`${LABEL_D} text-amber-200`}>
          generátor
        </div>
      </Html>
      {/* vízpumpa + viszkó-ventilátor */}
      <group ref={pump} position={[X, 1.2, 0]}>
        <Pulley r={0.3} color="#7dd3fc" />
      </group>
      <group ref={fan} position={[X - 0.9, 1.2, 0]}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <mesh key={i} rotation={[(i * Math.PI * 2) / 9, 0, 0]} position={[0, 0.9, 0]}>
            <boxGeometry args={[0.05, 1.3, 0.35]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
      <Label position={[X - 0.9, -0.95, 0]} className="text-sky-200">
        vízpumpa · viszkó-ventilátor
      </Label>
      {/* szervószivattyú */}
      <group ref={ps} position={[X, 2.0, 1.3]}>
        <Pulley r={0.25} color="#a1a1aa" />
      </group>
      <mesh position={[X + 0.45, 2.0, 1.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 0.7, 16]} />
        <meshStandardMaterial color="#3f3f46" metalness={0.5} roughness={0.5} />
      </mesh>
      <Label position={[X + 0.3, 2.65, 1.5]} className="text-slate-300">
        szervószivattyú
      </Label>
      {/* klímakompresszor */}
      <group ref={ac} position={[X, 0.1, 1.5]}>
        <Pulley r={0.28} color="#a1a1aa" />
      </group>
      <mesh position={[X + 0.6, 0.1, 1.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 1.0, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>
      <Label position={[X + 0.4, -0.6, 1.8]} className="text-slate-300">
        klímakompresszor
      </Label>
      <group ref={tens} position={[X, 1.1, -0.7]}>
        <Pulley r={0.14} w={0.1} color="#64748b" />
      </group>
      <Belt points={path} color="#1c1917" radius={0.04} />
    </group>
  );
}

function Flywheel({ stateRef }: { stateRef: RefObject<SimState> }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (stateRef.current) g.current.rotation.x = stateRef.current.crank;
  });
  return (
    <group ref={g} position={[FLYWHEEL_X, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 0.22, 48]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.12, 0.95, 0]}>
        <boxGeometry args={[0.05, 0.15, 0.15]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.12, 0, 0]}>
        <torusGeometry args={[1.2, 0.05, 8, 64]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>
    </group>
  );
}

function Clutch({ stateRef, controlsRef }: Props) {
  const disc = useRef<THREE.Group>(null!);
  const plate = useRef<THREE.Group>(null!);
  const discMat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const s = stateRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    const engage = Math.max(0, Math.min(1, (0.85 - c.clutch) / 0.55));
    const ratio = DRIVETRAIN.gearRatios[c.gear] * DRIVETRAIN.finalDrive;
    const inputOmega = c.gear === 0 ? (engage > 0.5 ? s.omega : 0) : (s.speed / DRIVETRAIN.wheelRadius) * ratio;
    disc.current.rotation.x += inputOmega / 60;
    const gap = (1 - engage) * 0.3;
    disc.current.position.x = FLYWHEEL_X + 0.22 + gap;
    plate.current.position.x = FLYWHEEL_X + 0.34 + gap * 2;
    discMat.current.color.set(engage > 0.05 ? "#9a3412" : "#57534e");
    discMat.current.emissive.set(Math.abs(s.clutchSlip) > 20 && engage > 0.1 && c.gear !== 0 ? "#ff4500" : "#000000");
    discMat.current.emissiveIntensity = Math.min(1, Math.abs(s.clutchSlip) / 200);
  });
  return (
    <group>
      <group ref={disc} position={[FLYWHEEL_X + 0.22, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.05, 1.05, 0.08, 48]} />
          <meshStandardMaterial ref={discMat} color="#9a3412" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[0.1, 0.3, 0.08]} />
          <meshStandardMaterial color="#fdba74" />
        </mesh>
      </group>
      <group ref={plate} position={[FLYWHEEL_X + 0.34, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.1, 1.1, 0.12, 48]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      <Label position={[FLYWHEEL_X + 0.3, -1.6, 0.4]} className="text-orange-200">
        kettős tömegű lendkerék · kuplung
      </Label>
    </group>
  );
}

/* Önindító a kuplungház oldalán */
function Starter({ stateRef, controlsRef }: Props) {
  const pinion = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const s = stateRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    const on = c.starter && !s.running;
    pinion.current.position.x = on ? -0.35 : -0.55;
    if (on) pinion.current.rotation.x += 0.6;
    mat.current.emissiveIntensity = on ? 0.6 : 0;
  });
  return (
    <group position={[FLYWHEEL_X + 1.0, -0.85, 1.25]}>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.9, 20]} />
        <meshStandardMaterial ref={mat} color="#475569" emissive="#fbbf24" emissiveIntensity={0} metalness={0.6} roughness={0.5} />
      </mesh>
      <group ref={pinion} position={[-0.55, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 10]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
        </mesh>
      </group>
      <Label position={[0.1, -0.5, 0]} className="text-slate-300">
        önindító
      </Label>
    </group>
  );
}

/* Motorblokk, olajteknő, szelepfedél, szívócső (M52: jobb oldali szívócső, fojtószelep elöl) */
function Block({ stateRef }: { stateRef: RefObject<SimState> }) {
  const plate = useRef<THREE.Mesh>(null!);
  const oilLabel = useRef<HTMLDivElement>(null!);
  const headLabel = useRef<HTMLDivElement>(null!);
  const intakeLabel = useRef<HTMLDivElement>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    plate.current.rotation.z = (Math.PI / 2) * (1 - s.effThrottle) * 0.95;
    if (oilLabel.current) oilLabel.current.textContent = `olajteknő ${s.oilTempC.toFixed(0)} °C · ${s.oilPressure.toFixed(1)} bar`;
    if (headLabel.current) headLabel.current.textContent = `hengerfej ${s.headTempC.toFixed(0)} °C · hűtővíz ${s.tempC.toFixed(0)} °C`;
    if (intakeLabel.current) intakeLabel.current.textContent = `szívócső ${s.mapKPa.toFixed(0)} kPa · ${s.airGs.toFixed(0)} g/s · ${s.intakeAirC.toFixed(0)} °C`;
  });
  const len = N * SPACING + 1.0;
  return (
    <group>
      {/* hengerblokk */}
      <mesh position={[0, (HEAD_Y + LINER_BOTTOM) / 2 - 0.05, 0]}>
        <boxGeometry args={[len, HEAD_Y - LINER_BOTTOM + 0.1, 1.7]} />
        <meshPhysicalMaterial color="#334155" transparent opacity={0.12} roughness={0.3} depthWrite={false} />
      </mesh>
      {/* hengerfej */}
      <mesh position={[0, HEAD_Y + 0.4, 0]}>
        <boxGeometry args={[len, 0.8, 2.0]} />
        <meshPhysicalMaterial color="#475569" transparent opacity={0.15} roughness={0.4} depthWrite={false} />
      </mesh>
      {/* szelepfedél */}
      <mesh position={[0, CAM_Y + 0.15, 0]}>
        <boxGeometry args={[len, 0.9, 1.6]} />
        <meshPhysicalMaterial color="#1e293b" transparent opacity={0.14} roughness={0.5} depthWrite={false} />
      </mesh>
      {/* forgattyúház */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[len + 0.2, 1.6, 1.9]} />
        <meshPhysicalMaterial color="#1e293b" transparent opacity={0.15} roughness={0.5} depthWrite={false} />
      </mesh>
      {/* olajteknő */}
      <mesh position={[0, -1.15, 0]}>
        <boxGeometry args={[len, 0.7, 1.8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.7} />
      </mesh>
      <Html position={[0, -1.85, 1.0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={oilLabel} className={`${LABEL_D} text-yellow-200`}>
          olaj
        </div>
      </Html>
      {/* olajszűrő */}
      <mesh position={[CYL_X[0] - 0.3, 0.3, 1.25]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.7, 16]} />
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </mesh>
      <Html position={[CYL_X[N - 1] + 0.6, HEAD_Y + 0.9, 1.2]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={headLabel} className={`${LABEL_D} text-orange-200`}>
          hengerfej
        </div>
      </Html>
      {/* szívócső: plenum a jobb oldalon, 6 futócső */}
      <mesh position={[0, HEAD_Y + 1.15, 1.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, len, 18, 1, true]} />
        <meshPhysicalMaterial color="#7dd3fc" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html position={[0, HEAD_Y + 1.85, 1.6]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={intakeLabel} className={`${LABEL_D} text-sky-200`}>
          szívócső
        </div>
      </Html>
      {/* fojtószelep-ház a plenum elején + légszűrő-doboz elöl */}
      <mesh position={[CYL_X[0] - 1.1, HEAD_Y + 1.15, 1.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 0.5, 16, 1, true]} />
        <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={plate} position={[CYL_X[0] - 1.1, HEAD_Y + 1.15, 1.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.03, 24]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[CYL_X[0] - 2.4, HEAD_Y + 1.1, 1.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 1.9, 12, 1, true]} />
        <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[CYL_X[0] - 3.6, HEAD_Y + 0.9, 2.6]}>
        <boxGeometry args={[1.6, 1.0, 1.6]} />
        <meshStandardMaterial color="#1f2937" roughness={0.8} />
      </mesh>
      <Label position={[CYL_X[0] - 3.6, HEAD_Y + 1.6, 2.6]} className="text-slate-300">
        légszűrő · légtömegmérő (MAF)
      </Label>
      <Label position={[CYL_X[0] - 1.1, HEAD_Y + 1.75, 1.55]} className="text-amber-200">
        fojtószelep
      </Label>
    </group>
  );
}

/* Hűtő + elektromos segédventilátor az autó elején */
function Radiator({ stateRef }: { stateRef: RefObject<SimState> }) {
  const fan = useRef<THREE.Group>(null!);
  const radMat = useRef<THREE.MeshStandardMaterial>(null!);
  const label = useRef<HTMLDivElement>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.fan) fan.current.rotation.x += 0.45;
    const t = Math.max(0, Math.min(1, (s.tempC - 40) / 80));
    radMat.current.color.setRGB(0.2 + t * 0.6, 0.35 - t * 0.15, 0.55 - t * 0.45);
    if (label.current) label.current.textContent = `hűtő ${s.tempC.toFixed(0)} °C · termosztát ${Math.round(s.thermostat * 100)}% · el. ventilátor ${s.fan ? "BE" : "ki"}`;
  });
  const X = FRONT_X - 3.2;
  return (
    <group position={[X, 0.6, 0]}>
      <mesh>
        <boxGeometry args={[0.3, 3.6, 5.6]} />
        <meshStandardMaterial ref={radMat} color="#334155" metalness={0.3} roughness={0.7} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[0, -1.6 + i * 0.29, 0]}>
          <boxGeometry args={[0.36, 0.02, 5.65]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} />
        </mesh>
      ))}
      {/* elektromos segédventilátor a hűtő előtt */}
      <group ref={fan} position={[-0.5, 0, 0]}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <mesh key={i} rotation={[(i * Math.PI * 2) / 7, 0, 0]} position={[0, 0.8, 0]}>
            <boxGeometry args={[0.05, 1.3, 0.4]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.15, 16]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
      {/* felső/alsó hűtőcső a motorhoz */}
      <mesh position={[1.6, 1.5, 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 3.0, 10]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[1.6, -1.2, -0.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 3.0, 10]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <Html position={[0, -2.3, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={label} className={`${LABEL} text-sky-200`}>
          hűtő
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------------- */
/* Hajtáslánc: kuplungház, ZF váltó, kardán, differenciálmű, féltengelyek     */
/* ------------------------------------------------------------------------- */
function Gearbox({ stateRef, controlsRef }: Props) {
  const gearRef = useRef<HTMLDivElement>(null!);
  const lever = useRef<THREE.Group>(null!);
  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;
    if (gearRef.current) gearRef.current.textContent = c.gear === 0 ? "N" : String(c.gear);
    // váltókar: H-minta jelzésszerűen
    const g = c.gear;
    lever.current.rotation.z = g === 0 ? 0 : g % 2 === 1 ? 0.25 : -0.25;
    lever.current.rotation.x = g === 0 ? 0 : g <= 2 ? 0.2 : g <= 4 ? 0 : -0.2;
  });
  const bx = FLYWHEEL_X + 0.5;
  return (
    <group>
      {/* kuplungház (harang) */}
      <mesh position={[bx + 0.7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.95, 1.45, 1.6, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.6} transparent opacity={0.85} />
      </mesh>
      {/* váltóház */}
      <mesh position={[bx + 3.4, 0, 0]}>
        <boxGeometry args={[4.0, 1.7, 1.6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.6} transparent opacity={0.9} />
      </mesh>
      {/* váltókar a padlón át */}
      <group ref={lever} position={[bx + 3.2, 0.9, 0]}>
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.8, 8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} />
        </mesh>
        <mesh position={[0, 2.85, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>
      <Html position={[bx + 3.2, 3.9, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div className="text-xl font-bold text-slate-100 bg-slate-900/85 rounded px-2 border border-slate-600">
          <span ref={gearRef}>N</span>
        </div>
      </Html>
      <Label position={[bx + 3.4, -1.4, 0.4]} className="text-slate-300" detail={false}>
        ZF S5D 320Z 5 fokozatú váltó
      </Label>
    </group>
  );
}

function Propshaft({ stateRef }: { stateRef: RefObject<SimState> }) {
  const shaft = useRef<THREE.Group>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    shaft.current.rotation.x = (s.distance / DRIVETRAIN.wheelRadius) * DRIVETRAIN.finalDrive;
  });
  const x0 = FLYWHEEL_X + 0.5 + 5.5; // váltó vége
  const x1 = X_REAR - 1.6; // diffi orra
  const mid = (x0 + x1) / 2;
  const len = x1 - x0;
  return (
    <group>
      <group ref={shaft}>
        <mesh position={[mid, -0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, len, 16]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* kardáncsuklók */}
        {[x0 + 0.2, mid, x1 - 0.2].map((x, i) => (
          <group key={i} position={[x, -0.4, 0]}>
            <mesh>
              <boxGeometry args={[0.35, 0.9, 0.2]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.35, 0.2, 0.9]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} />
            </mesh>
          </group>
        ))}
        {/* forgásjelölő csík */}
        <mesh position={[mid, -0.4 + 0.33, 0]}>
          <boxGeometry args={[len * 0.9, 0.02, 0.06]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
      </group>
      {/* középső csapágy */}
      <mesh position={[mid, -0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.45, 0.08, 8, 24]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <Label position={[mid, -1.3, 0.3]} className="text-slate-300">
        kardántengely
      </Label>
    </group>
  );
}

function Differential({ stateRef }: { stateRef: RefObject<SimState> }) {
  const halfL = useRef<THREE.Mesh>(null!);
  const halfR = useRef<THREE.Mesh>(null!);
  const label = useRef<HTMLDivElement>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const a = -s.distance / DRIVETRAIN.wheelRadius;
    halfL.current.rotation.z = a;
    halfR.current.rotation.z = a;
    if (label.current) label.current.textContent = `differenciálmű 2.93:1 · kardán ${Math.round(((s.speed / DRIVETRAIN.wheelRadius) * DRIVETRAIN.finalDrive * 60) / (2 * Math.PI))} 1/perc`;
  });
  const y = WHEEL_Y;
  return (
    <group position={[X_REAR, y, 0]}>
      {/* diffi ház */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 1.8, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* orr (pinion) */}
      <mesh position={[-1.1, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.6, 1.2, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* féltengelyek */}
      <mesh ref={halfL} position={[0, 0, -(TRACK - 1.0) / 2 - 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, TRACK - 2.0, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh ref={halfR} position={[0, 0, (TRACK - 1.0) / 2 + 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, TRACK - 2.0, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
      </mesh>
      <Html position={[0, -2.7, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={label} className={`${LABEL} text-slate-300`}>
          differenciálmű
        </div>
      </Html>
    </group>
  );
}

/* Kerék: gumi, felni, féktárcsa, nyereg. Tengely: Z. */
function Wheel({ x, z, stateRef, driven, controlsRef }: { x: number; z: number; stateRef: RefObject<SimState>; driven: boolean; controlsRef: RefObject<Controls> }) {
  const spin = useRef<THREE.Group>(null!);
  const discMat = useRef<THREE.MeshStandardMaterial>(null!);
  const label = useRef<HTMLDivElement>(null!);
  useFrame(() => {
    const s = stateRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    spin.current.rotation.z = -s.distance / DRIVETRAIN.wheelRadius;
    // féktárcsa izzás a hőmérséklet szerint (300 °C-tól látszik, 700-nál fehéres)
    const t = driven ? s.brakeRearC : s.brakeFrontC;
    const glow = Math.max(0, Math.min(1, (t - 300) / 400));
    discMat.current.emissiveIntensity = glow * 2.2;
    discMat.current.emissive.setRGB(1, 0.25 + glow * 0.5, glow * 0.3);
    if (label.current) label.current.textContent = `${driven ? "hátsó" : "első"} fék ${t.toFixed(0)} °C${c.brake > 0.05 ? " · fékez" : ""}`;
  });
  const side = Math.sign(z);
  return (
    <group position={[x, WHEEL_Y, z]}>
      <group ref={spin}>
        {/* gumi 225/50 R16 */}
        <mesh>
          <torusGeometry args={[WHEEL_R - 0.6, 0.62, 16, 48]} />
          <meshStandardMaterial color="#18181b" roughness={0.95} />
        </mesh>
        {/* felni */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.05, 2.05, 1.4, 32, 1, true]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} side={THREE.DoubleSide} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 5]} position={[0, 0, side * 0.55]}>
            <boxGeometry args={[0.5, 3.8, 0.25]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.55]}>
          <cylinderGeometry args={[0.55, 0.55, 0.35, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        {/* féktárcsa */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -side * 0.2]}>
          <cylinderGeometry args={[1.45, 1.45, 0.12, 32]} />
          <meshStandardMaterial ref={discMat} color="#71717a" emissive="#ff4500" emissiveIntensity={0} metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      {/* féknyereg (áll) */}
      <mesh position={[driven ? -1.1 : 1.1, 0.5, -side * 0.2]}>
        <boxGeometry args={[0.6, 0.9, 0.4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {z > 0 && (
        <Html position={[0, -WHEEL_R - 0.5, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
          <div ref={label} className={`${LABEL} text-slate-300`}>
            fék
          </div>
        </Html>
      )}
      {/* felfüggesztés: gólyaláb / lengőkar */}
      <mesh position={[0, 2.0, -side * 0.9]} rotation={[0, 0, side * 0.12]}>
        <cylinderGeometry args={[0.16, 0.16, 3.6, 10]} />
        <meshStandardMaterial color="#374151" metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.7, -side * 0.9]}>
        <cylinderGeometry args={[0.32, 0.32, 1.6, 10, 1, true]} />
        <meshStandardMaterial color="#f59e0b" wireframe />
      </mesh>
      <mesh position={[0, -0.2, -side * 2.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 3.2, 8]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  );
}

/* Karosszéria-váz: átlátszó lemezek + élek (E36 sedan sziluett) */
function Body() {
  const boxes: { pos: [number, number, number]; size: [number, number, number]; color?: string }[] = [
    { pos: [12, -3.1, 0], size: [42, 0.15, 17] }, // padlólemez
    { pos: [-3.5, 1.4, 0], size: [13, 0.15, 15.5] }, // motorháztető
    { pos: [-9.5, -0.7, 0], size: [0.6, 4.6, 16.5] }, // első lökhárító/orr
    { pos: [15.5, 5.6, 0], size: [17, 0.15, 13] }, // tető
    { pos: [6.2, 3.55, 0], size: [5.6, 0.1, 13.5], color: "#93c5fd" }, // szélvédő
    { pos: [25.5, 3.4, 0], size: [5.0, 0.1, 13.5], color: "#93c5fd" }, // hátsó szélvédő
    { pos: [30.5, 1.4, 0], size: [9, 0.15, 15.5] }, // csomagtartó
    { pos: [34.7, -0.7, 0], size: [0.6, 4.6, 16.5] }, // hátsó lökhárító
    { pos: [12, -0.8, 8.4], size: [42, 4.6, 0.12] }, // jobb oldal
    { pos: [12, -0.8, -8.4], size: [42, 4.6, 0.12] }, // bal oldal
  ];
  return (
    <group>
      {boxes.map((b, i) => (
        <group key={i} position={b.pos}>
          <mesh>
            <boxGeometry args={b.size} />
            <meshPhysicalMaterial color={b.color ?? "#64748b"} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...b.size)]} />
            <lineBasicMaterial color="#64748b" />
          </lineSegments>
        </group>
      ))}
      {/* A/B/C oszlopok */}
      {[
        [7.5, 8.4],
        [7.5, -8.4],
        [16, 8.4],
        [16, -8.4],
        [23.5, 8.4],
        [23.5, -8.4],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 3.55, z]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.25, 4.2, 0.25]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}
      {/* ülések, kormány jelzésszerűen */}
      {[-3.2, 3.2].map((z) => (
        <group key={z} position={[13.5, -1.4, z]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[4.5, 0.8, 4.5]} />
            <meshStandardMaterial color="#1f2937" transparent opacity={0.5} />
          </mesh>
          <mesh position={[2.0, 2.2, 0]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[0.8, 4.6, 4.5]} />
            <meshStandardMaterial color="#1f2937" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
      <mesh position={[9.2, 1.6, -3.2]} rotation={[0, 0.6, 0]}>
        <torusGeometry args={[1.7, 0.18, 8, 32]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <Label position={[12, 6.4, 0]} className="text-slate-400" detail={false}>
        BMW E36 328i karosszéria (váz)
      </Label>
    </group>
  );
}

/* Üzemanyagtank a hátsó ülés alatt (65 L), szinttel */
function FuelTank({ stateRef }: { stateRef: RefObject<SimState> }) {
  const liquid = useRef<THREE.Mesh>(null!);
  const label = useRef<HTMLDivElement>(null!);
  const H = 2.2;
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const f = Math.max(0.01, s.fuelL / ENGINE.tankL);
    liquid.current.scale.y = f;
    liquid.current.position.y = -H / 2 + (H * f) / 2;
    if (label.current) label.current.textContent = `üzemanyagtank ${s.fuelL.toFixed(1)} / ${ENGINE.tankL} L · szivattyú ${s.fuelGs.toFixed(2)} g/s`;
  });
  return (
    <group position={[22.5, -1.9, 0]}>
      <mesh>
        <boxGeometry args={[5.5, H, 11]} />
        <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(5.5, H, 11)]} />
        <lineBasicMaterial color="#64748b" />
      </lineSegments>
      <mesh ref={liquid} position={[0, 0, 0]}>
        <boxGeometry args={[5.3, H, 10.8]} />
        <meshStandardMaterial color="#f59e0b" transparent opacity={0.45} emissive="#f59e0b" emissiveIntensity={0.15} depthWrite={false} />
      </mesh>
      {/* üzemanyagcső előre a motorhoz */}
      <mesh position={[-11, -0.2, 6.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 22, 6]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <Html position={[0, -1.7, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={label} className={`${LABEL} text-amber-200`}>
          üzemanyagtank
        </div>
      </Html>
    </group>
  );
}

/* Akkumulátor a csomagtartóban (jobb hátul, E36) */
function Battery({ stateRef }: { stateRef: RefObject<SimState> }) {
  const label = useRef<HTMLDivElement>(null!);
  const bar = useRef<THREE.Mesh>(null!);
  const barMat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    if (label.current) label.current.textContent = `akkumulátor ${s.batteryV.toFixed(2)} V · ${Math.round(s.batterySoc * 100)} % · ${s.batteryTempC.toFixed(0)} °C`;
    bar.current.scale.y = Math.max(0.02, s.batterySoc);
    bar.current.position.y = -0.55 + (1.1 * s.batterySoc) / 2;
    barMat.current.color.set(s.batterySoc < 0.2 ? "#ef4444" : "#22c55e");
  });
  return (
    <group position={[31, -1.6, 5.5]}>
      <mesh>
        <boxGeometry args={[2.8, 1.9, 1.75]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} />
      </mesh>
      <mesh ref={bar} position={[1.42, 0, 0]}>
        <boxGeometry args={[0.04, 1.1, 0.3]} />
        <meshStandardMaterial ref={barMat} color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.9, 1.1, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.35, 12]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0.9, 1.1, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.35, 12]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* főkábel előre az önindítóhoz */}
      <mesh position={[-14.5, -1.2, 1.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 27, 6]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>
      <Html position={[0, 1.8, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={label} className={`${LABEL_D} text-emerald-200`}>
          akkumulátor
        </div>
      </Html>
    </group>
  );
}

/* Kipufogórendszer: 2×3-1 leömlő → 2 katalizátor → középső dob → hátsó dob → végcső, füst */
function ExhaustSystem({ stateRef }: { stateRef: RefObject<SimState> }) {
  const pipeMat = useRef<THREE.MeshStandardMaterial>(null!);
  const catMat = useRef<THREE.MeshStandardMaterial>(null!);
  const catLabel = useRef<HTMLDivElement>(null!);
  const tailLabel = useRef<HTMLDivElement>(null!);
  const points = useRef<THREE.Points>(null!);
  const NP = 400;
  const particles = useMemo(() => {
    const pos = new Float32Array(NP * 3);
    const life = new Float32Array(NP);
    const vel = new Float32Array(NP * 3);
    const size = new Float32Array(NP);
    const alpha = new Float32Array(NP);
    for (let i = 0; i < NP; i++) pos[i * 3 + 1] = -100;
    return { pos, life, vel, size, alpha, next: 0, acc: 0 };
  }, []);
  const sprite = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  const shader = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: sprite }, color: { value: new THREE.Color("#cbd5e1") } },
        vertexShader: `
          attribute float aSize; attribute float aAlpha; varying float vA;
          void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * (260.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `
          uniform sampler2D map; uniform vec3 color; varying float vA;
          void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * vA); }`,
        transparent: true,
        depthWrite: false,
      }),
    [sprite],
  );
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(particles.pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(particles.size, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(particles.alpha, 1));
    return g;
  }, [particles]);

  const tube = (pts: THREE.Vector3[], r: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.3), 90, r, 12, false);
  const downA = useMemo(
    () =>
      tube(
        [
          new THREE.Vector3(COLLECTOR_A.x, COLLECTOR_A.y + 0.2, COLLECTOR_A.z),
          new THREE.Vector3(COLLECTOR_A.x + 0.3, -0.9, -1.55),
          new THREE.Vector3(COLLECTOR_A.x + 1.2, -2.6, -1.35),
          new THREE.Vector3(5.5, EXHAUST_Y, -1.35),
        ],
        0.11,
      ),
    [],
  );
  const downB = useMemo(
    () =>
      tube(
        [
          new THREE.Vector3(COLLECTOR_B.x, COLLECTOR_B.y + 0.2, COLLECTOR_B.z),
          new THREE.Vector3(COLLECTOR_B.x + 0.3, -0.9, -1.7),
          new THREE.Vector3(COLLECTOR_B.x + 1.2, -2.6, -1.85),
          new THREE.Vector3(5.5, EXHAUST_Y, -1.85),
        ],
        0.11,
      ),
    [],
  );
  const mainPipe = useMemo(
    () =>
      tube(
        [
          new THREE.Vector3(8.5, EXHAUST_Y, -1.6),
          new THREE.Vector3(12, EXHAUST_Y, -1.9),
          new THREE.Vector3(18, EXHAUST_Y, -2.4), // középső dob
          new THREE.Vector3(23, EXHAUST_Y, -3.4), // diffi mellett
          new THREE.Vector3(27, EXHAUST_Y + 0.2, -4.6),
          new THREE.Vector3(31.5, EXHAUST_Y, -5.6), // hátsó dob
          TAILPIPE_END,
        ],
        0.13,
      ),
    [],
  );

  useFrame((_, dtFrame) => {
    const s = stateRef.current;
    if (!s) return;
    const glow = Math.max(0, Math.min(1, (s.exhaustC - 350) / 600));
    pipeMat.current.emissiveIntensity = glow * 1.2;
    pipeMat.current.color.setRGB(0.32 + glow * 0.4, 0.32 - glow * 0.15, 0.34 - glow * 0.25);
    const cg = Math.max(0, Math.min(1, (s.catTempC - 400) / 500));
    catMat.current.emissiveIntensity = cg * 1.5;
    if (catLabel.current) catLabel.current.textContent = `2× katalizátor ${s.catTempC.toFixed(0)} °C${s.catTempC > 250 ? " · aktív" : " · hideg"}`;
    if (tailLabel.current) tailLabel.current.textContent = `végcső ${s.tailpipeC.toFixed(0)} °C · ${s.exhaustGs.toFixed(0)} g/s`;

    const dt = Math.min(0.1, dtFrame);
    const p = particles;
    const cold = Math.max(0, Math.min(1, (70 - s.tailpipeC) / 50));
    shader.uniforms.color.value.setRGB(0.75 + cold * 0.25, 0.75 + cold * 0.25, 0.78 + cold * 0.22);
    const baseAlpha = 0.12 + cold * 0.5;
    const pulse = 1 + 0.9 * Math.max(0, Math.sin(3 * s.crank)); // 3 pulzus / fordulat
    const rate = s.exhaustGs > 0.1 ? (8 + s.exhaustGs * 1.4) * pulse : 0;
    p.acc += rate * dt;
    while (p.acc >= 1) {
      p.acc -= 1;
      const i = p.next;
      p.next = (p.next + 1) % NP;
      p.life[i] = 1;
      p.pos[i * 3] = TAILPIPE_END.x + 0.1;
      p.pos[i * 3 + 1] = TAILPIPE_END.y + (Math.random() - 0.5) * 0.1;
      p.pos[i * 3 + 2] = TAILPIPE_END.z + (Math.random() - 0.5) * 0.1;
      const speed = 1.5 + Math.min(5, s.exhaustGs / 15) + Math.random() * 0.6;
      p.vel[i * 3] = speed;
      p.vel[i * 3 + 1] = 0.2 + Math.random() * 0.3;
      p.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      p.size[i] = 0.35;
      p.alpha[i] = baseAlpha;
    }
    const carWind = s.speed * 0.25; // menetszél hátrafelé sodor
    for (let i = 0; i < NP; i++) {
      if (p.life[i] <= 0) continue;
      p.life[i] -= dt * (0.4 + cold * 0.1);
      if (p.life[i] <= 0) {
        p.pos[i * 3 + 1] = -100;
        p.alpha[i] = 0;
        continue;
      }
      p.vel[i * 3] *= 1 - 1.4 * dt;
      p.vel[i * 3] += carWind * dt;
      p.vel[i * 3 + 1] += 0.6 * dt;
      p.pos[i * 3] += p.vel[i * 3] * dt;
      p.pos[i * 3 + 1] += p.vel[i * 3 + 1] * dt;
      p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
      p.size[i] += 1.2 * dt;
      p.alpha[i] = baseAlpha * p.life[i];
    }
    const g = points.current.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  });

  const pipeMatEl = <meshStandardMaterial ref={pipeMat} color="#57534e" emissive="#ff3300" emissiveIntensity={0} metalness={0.6} roughness={0.5} />;
  return (
    <group>
      {[COLLECTOR_A, COLLECTOR_B].map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 2.2, 16]} />
          <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <mesh geometry={downA}>{pipeMatEl}</mesh>
      <mesh geometry={downB}>
        <meshStandardMaterial color="#57534e" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* 2 katalizátor egymás mellett */}
      {[-1.35, -1.85].map((z, i) => (
        <mesh key={i} position={[7, EXHAUST_Y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 2.4, 20]} />
          <meshStandardMaterial ref={i === 0 ? catMat : undefined} color="#9ca3af" emissive="#ff6a00" emissiveIntensity={0} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <Html position={[7, EXHAUST_Y - 0.7, -1.6]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={catLabel} className={`${LABEL_D} text-orange-200`}>
          katalizátor
        </div>
      </Html>
      <mesh geometry={mainPipe}>
        <meshStandardMaterial color="#57534e" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* középső dob */}
      <mesh position={[18, EXHAUST_Y, -2.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.45, 3.6, 20]} />
        <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* hátsó dob */}
      <mesh position={[31.5, EXHAUST_Y, -5.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, 4.2, 20]} />
        <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.4} />
      </mesh>
      <Label position={[31.5, EXHAUST_Y - 0.9, -5.6]} className="text-slate-300">
        hátsó kipufogódob
      </Label>
      <mesh position={[TAILPIPE_END.x, TAILPIPE_END.y, TAILPIPE_END.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.15, 16]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
      </mesh>
      <Html position={[TAILPIPE_END.x + 1.6, TAILPIPE_END.y - 1.1, TAILPIPE_END.z]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={tailLabel} className={`${LABEL_D} text-slate-300`}>
          végcső
        </div>
      </Html>
      <points ref={points} geometry={geom} material={shader} frustumCulled={false} />
    </group>
  );
}

/* Kamera-előbeállítás: lágyan a kiválasztott nézetbe mozog. */
function CameraRig({ view, controls }: { view: ViewName; controls: RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((st) => st.camera);
  const goal = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), t: 0 });
  useEffect(() => {
    const v = VIEWS.find((x) => x.id === view) ?? VIEWS[0];
    goal.current.pos.set(...v.pos);
    goal.current.target.set(...v.target);
    goal.current.t = 1.2; // 1.2 s animáció
  }, [view]);
  useFrame((_, dt) => {
    if (goal.current.t <= 0) return;
    goal.current.t = Math.max(0, goal.current.t - dt);
    const k = 1 - Math.exp(-6 * dt);
    camera.position.lerp(goal.current.pos, k);
    const c = controls.current;
    if (c) {
      c.target.lerp(goal.current.target, k);
      c.update();
    }
  });
  return null;
}

/* Rejtett fülön a rAF leáll – ilyenkor setInterval hajtja a rendert. */
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

export default function Engine3D({ stateRef, controlsRef, view = "auto", showLabels = true }: Props & { view?: ViewName; showLabels?: boolean }) {
  const camPos = useMemo(() => new THREE.Vector3(...VIEWS[0].pos), []);
  const orbit = useRef<OrbitControlsImpl | null>(null);
  return (
    <div
      className={`w-full rounded-xl overflow-hidden relative ${showLabels ? "" : "hide-tags"} ${view === "auto" ? "hide-detail" : ""}`}
      style={{ height: 560 }}
    >
      <style>{`.hide-tags .sim-tag{display:none!important}.hide-detail .sim-detail{display:none!important}`}</style>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: camPos, fov: 42, near: 0.1, far: 400 }} gl={{ antialias: true }}>
        <color attach="background" args={["#0b1220"]} />
        <fog attach="fog" args={["#0b1220", 60, 160]} />
        <HiddenTabTicker />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#93c5fd", "#0f172a", 0.5]} />
        <directionalLight position={[10, 25, 15]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
        <pointLight position={[-8, 6, -8]} intensity={60} color="#7dd3fc" />
        <pointLight position={[28, 6, 8]} intensity={40} color="#fde68a" />

        {/* motor */}
        <Block stateRef={stateRef} />
        {Array.from({ length: N }, (_, i) => (
          <Cylinder key={i} index={i + 1} stateRef={stateRef} />
        ))}
        <Camshafts stateRef={stateRef} />
        <Crankshaft stateRef={stateRef} />
        <TimingChain stateRef={stateRef} />
        <AccessoryBelt stateRef={stateRef} />
        <Flywheel stateRef={stateRef} />
        <Clutch stateRef={stateRef} controlsRef={controlsRef} />
        <Starter stateRef={stateRef} controlsRef={controlsRef} />
        <Radiator stateRef={stateRef} />
        <ExhaustSystem stateRef={stateRef} />

        {/* hajtáslánc + autó */}
        <Gearbox stateRef={stateRef} controlsRef={controlsRef} />
        <Propshaft stateRef={stateRef} />
        <Differential stateRef={stateRef} />
        <Wheel x={X_FRONT} z={TRACK} stateRef={stateRef} controlsRef={controlsRef} driven={false} />
        <Wheel x={X_FRONT} z={-TRACK} stateRef={stateRef} controlsRef={controlsRef} driven={false} />
        <Wheel x={X_REAR} z={TRACK} stateRef={stateRef} controlsRef={controlsRef} driven />
        <Wheel x={X_REAR} z={-TRACK} stateRef={stateRef} controlsRef={controlsRef} driven />
        <Body />
        <FuelTank stateRef={stateRef} />
        <Battery stateRef={stateRef} />

        {/* talaj */}
        <mesh position={[12, GROUND_Y - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#0f172a" roughness={1} />
        </mesh>
        <gridHelper args={[200, 100, "#1e293b", "#172033"]} position={[12, GROUND_Y, 0]} />
        <CameraRig view={view} controls={orbit} />
        <OrbitControls ref={orbit} target={VIEWS[0].target} enableDamping maxDistance={140} minDistance={1.2} maxPolarAngle={Math.PI / 2 - 0.02} />
      </Canvas>
    </div>
  );
}
