"use client";

import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { cylinderKinematics, DRIVETRAIN, ENGINE, gearLabel, type Gear } from "@/lib/engine";
import { CAR } from "./shape";
import { useScene } from "./context";
import { Mat } from "./Mat";
import { LABEL, Rod } from "./Chassis";
import { rBadge } from "./textures";

/* =========================================================================
   Motor saját koordinátarendszere (méter): főtengely a helyi X mentén (1. henger −X,
   vezérműlánc oldal), fel = +Y, szívóoldal = +Z (előre), kipufogó/turbó = −Z (hátra).
   Beépítés: keresztben, 90°-kal elforgatva, 12°-kal hátradöntve.
   ========================================================================= */
import { N, R, L, BORE, SPACING, CYL_X, COMP_H, PISTON_H, HEAD_Y, LINER_BOTTOM, CAM_Y, CAM_Z, BLOCK_LEN, FRONT_X, VALVE_LIFT, VALVE_SEAT_Y, VALVE_HEAD_T } from "./engineGeom";

export const ENGINE_POS = new THREE.Vector3(CAR.axleF + 0.085, 0.36, 0.1);
export const ENGINE_TILT = -0.21;

/** Motor-helyi pont → autó koordináta */
export function engineToCar(x: number, y: number, z: number): THREE.Vector3 {
  const v = new THREE.Vector3(x, y, z);
  v.applyAxisAngle(new THREE.Vector3(1, 0, 0), ENGINE_TILT);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  return v.add(ENGINE_POS);
}

export const TURBO_LOCAL = new THREE.Vector3(0.02, HEAD_Y - 0.03, -0.2);

const STROKE_COLORS: Record<string, THREE.Color> = {
  munka: new THREE.Color("#f97316"),
  kipufogó: new THREE.Color("#94a3b8"),
  szívó: new THREE.Color("#38bdf8"),
  sűrítő: new THREE.Color("#a78bfa"),
};

export function Label({ position, children, className = "text-slate-200" }: { position: [number, number, number]; children: ReactNode; className?: string }) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
      <div className={`${LABEL} sim-detail ${className}`}>{children}</div>
    </Html>
  );
}

function LiveLabel({ position, text, className = "text-slate-200", detail = true }: { position: [number, number, number]; text: () => string; className?: string; detail?: boolean }) {
  const ref = useRef<HTMLDivElement>(null!);
  useFrame(() => {
    if (ref.current) ref.current.textContent = text();
  });
  return (
    <Html position={position} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
      <div ref={ref} className={`${LABEL} ${detail ? "sim-detail" : ""} ${className}`} />
    </Html>
  );
}

/* ---------------------------- Henger ---------------------------- */
function Cylinder({ index }: { index: number }) {
  const { stateRef, xray } = useScene();
  const piston = useRef<THREE.Group>(null!);
  const rod = useRef<THREE.Mesh>(null!);
  const intake = useRef<THREE.Group>(null!);
  const exhaust = useRef<THREE.Group>(null!);
  const spark = useRef<THREE.Mesh>(null!);
  const burn = useRef<THREE.Mesh>(null!);
  const burnMat = useRef<THREE.MeshStandardMaterial>(null!);
  const charge = useRef<THREE.Mesh>(null!);
  const chargeMat = useRef<THREE.MeshStandardMaterial>(null!);
  const spray = useRef<THREE.Mesh>(null!);
  const sprayMat = useRef<THREE.MeshBasicMaterial>(null!);
  const pistonMat = useRef<THREE.MeshStandardMaterial>(null!);
  const x = CYL_X[index - 1];
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const k = cylinderKinematics(s.crank, s.running, s.misfire)[index - 1];
    const th = (k.phase * Math.PI) / 180;
    const py = R * Math.cos(th);
    const pz = R * Math.sin(th);
    const wy = R * Math.cos(th) + Math.sqrt(L * L - R * R * Math.sin(th) ** 2);
    piston.current.position.y = wy;
    const dy = py - wy;
    const len = Math.sqrt(dy * dy + pz * pz);
    rod.current.position.set(x, (wy + py) / 2, pz / 2);
    rod.current.rotation.x = Math.atan2(pz, dy);
    rod.current.scale.y = len;
    // szelepek: elgörbült szelep nem nyit rendesen
    const bent = s.dmg.valves[index - 1];
    intake.current.position.y = -k.intake * VALVE_LIFT * (1 - bent * 0.7);
    exhaust.current.position.y = -k.exhaust * VALVE_LIFT * (1 - bent * 0.7);
    intake.current.rotation.z = bent * 0.12;
    exhaust.current.rotation.z = -bent * 0.12;
    spark.current.visible = k.spark;
    const top = wy + COMP_H;
    const h = Math.max(0.002, HEAD_Y - top);
    burn.current.position.y = top + h / 2;
    burn.current.scale.y = h;
    burnMat.current.opacity = Math.min(1, k.burn * 1.2);
    burnMat.current.emissiveIntensity = 0.5 + k.burn * 6;
    charge.current.position.y = top + h / 2;
    charge.current.scale.y = h;
    chargeMat.current.color.copy(STROKE_COLORS[k.stroke]);
    chargeMat.current.opacity = k.stroke === "munka" ? 0.05 : 0.22;
    // közvetlen befecskendezés: szívó- és sűrítési ütem elején
    const inj = s.running && !s.overrun && k.phase > 380 && k.phase < 470 && s.fuelGs > 0 ? 1 : 0;
    spray.current.visible = inj > 0;
    sprayMat.current.opacity = 0.7;
    pistonMat.current.color.set(s.dmg.pistons[index - 1] > 0.3 ? "#7c2d12" : "#d4d4d8");
  });
  const Valve = ({ z, dx, color }: { z: number; dx: number; color: string }) => (
    <group position={[x + dx, VALVE_SEAT_Y, z]}>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.09, 6]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.0145, 0.01, VALVE_HEAD_T, 16]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.03, 8, 1, true]} />
        <meshStandardMaterial color="#94a3b8" wireframe />
      </mesh>
    </group>
  );
  return (
    <group>
      {/* hengerpersely */}
      <mesh position={[x, (HEAD_Y + LINER_BOTTOM) / 2, 0]}>
        <cylinderGeometry args={[BORE / 2 + 0.003, BORE / 2 + 0.003, HEAD_Y - LINER_BOTTOM, 32, 1, true]} />
        <meshPhysicalMaterial color="#cbd5e1" transparent opacity={xray ? 0.18 : 0.9} roughness={0.2} metalness={0.4} side={THREE.DoubleSide} depthWrite={!xray} />
      </mesh>
      <mesh ref={charge} position={[x, HEAD_Y, 0]}>
        <cylinderGeometry args={[BORE / 2 - 0.001, BORE / 2 - 0.001, 1, 24]} />
        <meshStandardMaterial ref={chargeMat} transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh ref={burn} position={[x, HEAD_Y, 0]}>
        <cylinderGeometry args={[BORE / 2 - 0.002, BORE / 2 - 0.002, 1, 24]} />
        <meshStandardMaterial ref={burnMat} color="#fb923c" emissive="#ff5a00" transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* dugattyú + gyűrűk */}
      <group ref={piston} position={[x, L, 0]}>
        <mesh position={[0, COMP_H - PISTON_H / 2, 0]} castShadow>
          <cylinderGeometry args={[BORE / 2 - 0.0008, BORE / 2 - 0.0008, PISTON_H, 32]} />
          <meshStandardMaterial ref={pistonMat} color="#d4d4d8" metalness={0.85} roughness={0.3} />
        </mesh>
        {[0.006, 0.012, 0.018].map((d) => (
          <mesh key={d} position={[0, COMP_H - d, 0]}>
            <torusGeometry args={[BORE / 2 - 0.0005, 0.0012, 6, 32]} />
            <meshStandardMaterial color="#52525b" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, BORE * 0.7, 12]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      <mesh ref={rod}>
        <boxGeometry args={[0.018, 1, 0.011]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.75} roughness={0.32} />
      </mesh>
      {/* 2 szívó (kék, +Z) + 2 kipufogó (piros, −Z) szelep */}
      <group ref={intake}>
        <Valve z={CAM_Z - 0.02} dx={-0.016} color="#38bdf8" />
        <Valve z={CAM_Z - 0.02} dx={0.016} color="#38bdf8" />
      </group>
      <group ref={exhaust}>
        <Valve z={-CAM_Z + 0.02} dx={-0.016} color="#ef4444" />
        <Valve z={-CAM_Z + 0.02} dx={0.016} color="#ef4444" />
      </group>
      {/* gyújtógyertya + gyújtótekercs */}
      <mesh position={[x, HEAD_Y + 0.05, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.1, 8]} />
        <meshStandardMaterial color="#f5f5f4" />
      </mesh>
      <mesh position={[x, CAM_Y + 0.07, 0]}>
        <boxGeometry args={[0.03, 0.05, 0.03]} />
        <meshStandardMaterial color="#111827" roughness={0.6} />
      </mesh>
      <mesh ref={spark} position={[x, HEAD_Y - 0.004, 0]}>
        <sphereGeometry args={[0.009, 10, 10]} />
        <meshBasicMaterial color="#fef9c3" />
      </mesh>
      {/* közvetlen (FSI) befecskendező a szívóoldalon */}
      <group position={[x, HEAD_Y + 0.01, 0.042]} rotation={[-1.0, 0, 0]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.005, 0.004, 0.06, 8]} />
          <meshStandardMaterial color="#facc15" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh ref={spray} position={[0, -0.022, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.014, 0.045, 12, 1, true]} />
          <meshBasicMaterial ref={sprayMat} color="#bae6fd" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <Html position={[x, CAM_Y + 0.13, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div className={`${LABEL} sim-detail text-slate-100 font-bold`}>{index}</div>
      </Html>
    </group>
  );
}

/* Két vezérműtengely (DOHC), hengerenként 2-2 bütyök */
function Camshafts() {
  const { stateRef } = useScene();
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (stateRef.current) g.current.rotation.x = stateRef.current.crank / 2;
  });
  const offsets = [0, 540, 180, 360];
  return (
    <group ref={g} position={[0, CAM_Y, 0]}>
      {[CAM_Z, -CAM_Z].map((z, side) => (
        <group key={side} position={[0, 0, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.009, 0.009, N * SPACING + 0.06, 10]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
          </mesh>
          {CYL_X.map((x, i) => {
            const lobeDeg = (side === 0 ? 460 : 260) + offsets[i];
            const a = ((lobeDeg / 2) * Math.PI) / 180;
            return [-0.016, 0.016].map((dx) => (
              <mesh key={`${i}${dx}`} position={[x + dx, 0, 0]} rotation={[-a, 0, 0]}>
                <boxGeometry args={[0.012, 0.034, 0.02]} />
                <meshStandardMaterial color={side === 0 ? "#38bdf8" : "#ef4444"} metalness={0.7} roughness={0.35} />
              </mesh>
            ));
          })}
        </group>
      ))}
    </group>
  );
}

/* Főtengely: 1-4 és 2-3 forgattyú 180°-ra, 5 főcsapágy; + 2 kiegyensúlyozó tengely (2× fordulat) */
function Crankshaft() {
  const { stateRef } = useScene();
  const group = useRef<THREE.Group>(null!);
  const bal = useRef<THREE.Group>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    group.current.rotation.x = s.crank;
    bal.current.children.forEach((c, i) => (c.rotation.x = (i ? -2 : 2) * s.crank));
  });
  const throwDeg = [0, 180, 180, 0];
  return (
    <group>
      <group ref={group}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.024, 0.024, N * SPACING + 0.12, 16]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
        </mesh>
        {CYL_X.map((x, i) => {
          const a = (throwDeg[i] * Math.PI) / 180;
          return (
            <group key={i} position={[x, 0, 0]} rotation={[a, 0, 0]}>
              {[-0.018, 0.018].map((dx) => (
                <mesh key={dx} position={[dx, R / 2, 0]}>
                  <boxGeometry args={[0.012, R + 0.035, 0.05]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.4} />
                </mesh>
              ))}
              <mesh position={[0, R, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.02, 0.02, 0.04, 16]} />
                <meshStandardMaterial color="#78350f" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.03, 0]}>
                <boxGeometry args={[0.045, 0.035, 0.07]} />
                <meshStandardMaterial color="#b45309" metalness={0.6} roughness={0.4} />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* kiegyensúlyozó tengelyek (a forgattyúházban, kétszeres fordulattal) */}
      <group ref={bal}>
        {[0.075, -0.075].map((z) => (
          <group key={z} position={[0, -0.06, z]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.01, 0.01, N * SPACING, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.015, 0]}>
              <boxGeometry args={[N * SPACING * 0.6, 0.02, 0.02]} />
              <meshStandardMaterial color="#a16207" metalness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Pulley({ r, w = 0.018, color = "#94a3b8", teeth = false }: { r: number; w?: number; color?: string; teeth?: boolean }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[r, r, w, 28]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[w / 2 + 0.001, r * 0.7, 0]}>
        <boxGeometry args={[0.002, r * 0.35, r * 0.15]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      {teeth &&
        Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} rotation={[(i * Math.PI) / 12, 0, 0]}>
            <boxGeometry args={[w * 0.9, r * 2 + 0.004, 0.004]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} />
          </mesh>
        ))}
    </group>
  );
}

function beltPath(x: number, pulleys: { y: number; z: number; r: number; from: number; to: number }[], rad: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (const p of pulleys) {
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = p.from + ((p.to - p.from) * i) / n;
      pts.push(new THREE.Vector3(x, p.y + (p.r + rad) * Math.sin(a), p.z + (p.r + rad) * Math.cos(a)));
    }
  }
  return pts;
}

function Belt({ points, color = "#111", radius = 0.004 }: { points: THREE.Vector3[]; color?: string; radius?: number }) {
  const geom = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, "centripetal", 0.6), 160, radius, 6, true), [points, radius]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.3} />
    </mesh>
  );
}

/* Vezérműlánc + kipufogó-oldali vezérmű-állító (AVS), ékszíj: generátor + klímakompresszor */
function FrontDrive() {
  const { stateRef, xray } = useScene();
  const crank = useRef<THREE.Group>(null!);
  const camA = useRef<THREE.Group>(null!);
  const camB = useRef<THREE.Group>(null!);
  const alt = useRef<THREE.Group>(null!);
  const ac = useRef<THREE.Group>(null!);
  const tens = useRef<THREE.Group>(null!);
  const altMat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    crank.current.rotation.x = s.crank;
    camA.current.rotation.x = s.crank / 2;
    camB.current.rotation.x = s.crank / 2;
    alt.current.rotation.x = s.crank * 2.8;
    ac.current.rotation.x = s.crank * 1.2;
    tens.current.rotation.x = s.crank * 3;
    altMat.current.emissiveIntensity = s.altA > 0 ? 0.1 + (s.altA / 140) * 0.6 : 0;
  });
  const X = FRONT_X;
  const chain = useMemo(
    () =>
      beltPath(
        X,
        [
          { y: CAM_Y, z: CAM_Z, r: 0.04, from: -0.2, to: Math.PI / 2 + 0.3 },
          { y: 0, z: 0, r: 0.022, from: Math.PI / 2 - 0.2, to: Math.PI * 1.5 + 0.2 },
          { y: CAM_Y, z: -CAM_Z, r: 0.04, from: -Math.PI / 2 - 0.3, to: 0.2 },
        ],
        0.004,
      ),
    [X],
  );
  const XB = X - 0.035;
  const belt = useMemo(
    () =>
      beltPath(
        XB,
        [
          { y: 0.2, z: 0.13, r: 0.03, from: -0.4, to: Math.PI / 2 + 0.6 }, // generátor
          { y: 0.09, z: 0.05, r: 0.018, from: Math.PI / 2 + 0.6, to: Math.PI + 0.5 }, // feszítő
          { y: 0, z: 0, r: 0.07, from: Math.PI - 0.1, to: Math.PI * 1.5 + 0.4 }, // főtengely
          { y: -0.06, z: 0.15, r: 0.055, from: -Math.PI / 2, to: 0.6 }, // klíma
        ],
        0.004,
      ),
    [XB],
  );
  return (
    <group>
      <group ref={crank} position={[X, 0, 0]}>
        <Pulley r={0.022} color="#9ca3af" teeth />
        <mesh position={[-0.035, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.025, 28]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>
      <group ref={camA} position={[X, CAM_Y, CAM_Z]}>
        <Pulley r={0.04} color="#38bdf8" teeth />
      </group>
      <group ref={camB} position={[X, CAM_Y, -CAM_Z]}>
        <Pulley r={0.04} color="#ef4444" teeth />
      </group>
      <Belt points={chain} color="#71717a" radius={0.004} />
      {/* generátor */}
      <group ref={alt} position={[XB, 0.2, 0.13]}>
        <Pulley r={0.03} color="#cbd5e1" />
      </group>
      <mesh position={[XB + 0.07, 0.2, 0.13]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.065, 0.12, 24]} />
        <meshStandardMaterial ref={altMat} color="#94a3b8" emissive="#fbbf24" emissiveIntensity={0} metalness={0.7} roughness={0.4} transparent={xray} opacity={xray ? 0.4 : 1} depthWrite={!xray} />
      </mesh>
      <group ref={tens} position={[XB, 0.09, 0.05]}>
        <Pulley r={0.018} color="#64748b" />
      </group>
      <group ref={ac} position={[XB, -0.06, 0.15]}>
        <Pulley r={0.055} color="#a1a1aa" />
      </group>
      <mesh position={[XB + 0.08, -0.06, 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.14, 20]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} transparent={xray} opacity={xray ? 0.4 : 1} depthWrite={!xray} />
      </mesh>
      <Belt points={belt} color="#18181b" radius={0.004} />
      <LiveLabel position={[XB, 0.3, 0.13]} className="text-amber-200" text={() => `generátor ${stateRef.current?.altA.toFixed(0)} A · ${stateRef.current?.batteryV.toFixed(1)} V`} />
      <Label position={[X, CAM_Y + 0.08, 0]} className="text-slate-300">
        vezérműlánc 2:1
      </Label>
    </group>
  );
}

/* IS38 turbó: turbina (kipufogó) + kompresszor, wastegate */
function Turbo() {
  const { stateRef, xray } = useScene();
  const wheelT = useRef<THREE.Group>(null!);
  const wheelC = useRef<THREE.Group>(null!);
  const housingMat = useRef<THREE.MeshStandardMaterial>(null!);
  const wgFlap = useRef<THREE.Mesh>(null!);
  const ang = useRef(0);
  useFrame((_, dt) => {
    const s = stateRef.current;
    if (!s) return;
    // vizuálisan lassítva (valójában ~190 000 1/perc)
    ang.current += s.turbo * Math.min(0.1, dt) * 60;
    wheelT.current.rotation.x = ang.current;
    wheelC.current.rotation.x = ang.current;
    const glow = THREE.MathUtils.clamp((s.turboC - 450) / 450, 0, 1);
    housingMat.current.emissiveIntensity = glow * 1.6;
    housingMat.current.color.setRGB(0.32 + glow * 0.4, 0.32 - glow * 0.12, 0.33 - glow * 0.22);
    wgFlap.current.rotation.y = s.wastegate * 0.8;
  });
  const Wheel = ({ blades, r, color }: { blades: number; r: number; color: string }) => (
    <group>
      {Array.from({ length: blades }).map((_, i) => (
        <mesh key={i} rotation={[(i / blades) * Math.PI * 2, 0, 0]} position={[0, 0, 0]}>
          <boxGeometry args={[0.02, r * 2, 0.002]} />
          <meshStandardMaterial color={color} metalness={0.9} roughness={0.25} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
  const P = TURBO_LOCAL;
  return (
    <group position={[P.x, P.y, P.z]}>
      {/* turbinaház (izzik terhelésre) */}
      <mesh position={[-0.035, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.042, 0.022, 12, 24]} />
        <meshStandardMaterial ref={housingMat} color="#57534e" emissive="#ff3300" emissiveIntensity={0} metalness={0.6} roughness={0.55} transparent={xray} opacity={xray ? 0.45 : 1} />
      </mesh>
      <group ref={wheelT} position={[-0.035, 0, 0]}>
        <Wheel blades={11} r={0.022} color="#a8a29e" />
      </group>
      {/* tengely + csapágyház */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.05, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* kompresszorház */}
      <mesh position={[0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.048, 0.022, 12, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.35} transparent={xray} opacity={xray ? 0.45 : 1} />
      </mesh>
      <group ref={wheelC} position={[0.04, 0, 0]}>
        <Wheel blades={12} r={0.026} color="#e5e7eb" />
      </group>
      <mesh position={[0.075, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.026, 0.03, 20, 1, true]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* wastegate szelep */}
      <mesh ref={wgFlap} position={[-0.07, -0.03, 0]}>
        <boxGeometry args={[0.003, 0.02, 0.02]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <LiveLabel
        position={[0, 0.08, -0.05]}
        className="text-orange-200"
        text={() => {
          const s = stateRef.current!;
          return `IS38 turbó ${Math.round(s.turbo * 190000).toLocaleString("hu-HU")} 1/perc · ${(s.boostKPa / 100).toFixed(2)} bar · ${s.turboC.toFixed(0)} °C · WG ${Math.round(s.wastegate * 100)}%`;
        }}
      />
    </group>
  );
}

/* Blokk, hengerfej, szelepfedél, olajteknő, szívócső, motorburkolat */
function Block() {
  const { stateRef, xray } = useScene();
  const plate = useRef<THREE.Mesh>(null!);
  const r = useMemo(() => rBadge(), []);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    plate.current.rotation.z = (Math.PI / 2) * (1 - s.effThrottle) * 0.95;
  });
  const metal = (c: string, o = 0.14) => <Mat c={c} m={0.55} r={0.5} ghost ghostOpacity={o} />;
  return (
    <group>
      {/* hengerblokk (öntöttvas) */}
      <mesh position={[0, (HEAD_Y + LINER_BOTTOM) / 2 - 0.01, 0]} castShadow={!xray}>
        <boxGeometry args={[BLOCK_LEN, HEAD_Y - LINER_BOTTOM + 0.02, 0.2]} />
        {metal("#4b5563")}
      </mesh>
      {/* forgattyúház */}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[BLOCK_LEN + 0.02, 0.15, 0.24]} />
        {metal("#4b5563")}
      </mesh>
      {/* olajteknő */}
      <mesh position={[0, -0.13, 0.01]}>
        <boxGeometry args={[BLOCK_LEN - 0.02, 0.1, 0.25]} />
        {metal("#27272a", 0.35)}
      </mesh>
      {/* hengerfej (alu) */}
      <mesh position={[0, HEAD_Y + 0.055, 0]}>
        <boxGeometry args={[BLOCK_LEN, 0.11, 0.22]} />
        {metal("#9ca3af")}
      </mesh>
      {/* szelepfedél */}
      <mesh position={[0, CAM_Y + 0.04, 0]}>
        <boxGeometry args={[BLOCK_LEN - 0.02, 0.07, 0.19]} />
        {metal("#1f2937")}
      </mesh>
      {/* vezérműfedél */}
      <mesh position={[FRONT_X - 0.006, 0.12, 0]}>
        <boxGeometry args={[0.03, 0.5, 0.25]} />
        {metal("#374151", 0.1)}
      </mesh>
      {/* motorburkolat „R” felirattal (csak külső nézetben) */}
      {!xray && (
        <group position={[0, CAM_Y + 0.105, 0.02]}>
          <mesh>
            <boxGeometry args={[BLOCK_LEN + 0.04, 0.035, 0.32]} />
            <meshStandardMaterial color="#18181b" roughness={0.45} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.0185, 0.03]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[0.12, 0.12]} />
            <meshStandardMaterial map={r} transparent metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.019, -0.09]}>
            <boxGeometry args={[BLOCK_LEN * 0.8, 0.002, 0.02]} />
            <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      )}
      {/* szívócső (műanyag), plenum a szívóoldalon */}
      <mesh position={[0, HEAD_Y + 0.02, 0.19]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, BLOCK_LEN - 0.06, 20, 1, true]} />
        <meshPhysicalMaterial color={xray ? "#38bdf8" : "#1f2937"} transparent={xray} opacity={xray ? 0.25 : 1} roughness={0.5} side={THREE.DoubleSide} depthWrite={!xray} />
      </mesh>
      {CYL_X.map((x) => (
        <mesh key={x} position={[x, HEAD_Y + 0.02, 0.125]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.09, 12, 1, true]} />
          <meshPhysicalMaterial color={xray ? "#38bdf8" : "#1f2937"} transparent={xray} opacity={xray ? 0.3 : 1} side={THREE.DoubleSide} depthWrite={!xray} />
        </mesh>
      ))}
      {/* fojtószelep-ház a váltó felőli végen */}
      <mesh position={[BLOCK_LEN / 2 + 0.01, HEAD_Y + 0.02, 0.19]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.05, 16, 1, true]} />
        <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={plate} position={[BLOCK_LEN / 2 + 0.01, HEAD_Y + 0.02, 0.19]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.036, 0.036, 0.003, 24]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* nagynyomású üzemanyag-szivattyú + rail */}
      <mesh position={[CYL_X[3] + 0.06, CAM_Y + 0.02, 0.12]}>
        <cylinderGeometry args={[0.022, 0.022, 0.06, 12]} />
        <Mat c="#a1a1aa" m={0.8} r={0.3} />
      </mesh>
      <mesh position={[0, HEAD_Y + 0.045, 0.07]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, BLOCK_LEN - 0.08, 8]} />
        <Mat c="#d4d4d8" m={0.9} r={0.25} />
      </mesh>
      <LiveLabel position={[0, -0.24, 0.12]} className="text-yellow-200" text={() => `olaj ${stateRef.current?.oilTempC.toFixed(0)} °C · ${stateRef.current?.oilPressure.toFixed(1)} bar`} />
      <LiveLabel position={[0.12, CAM_Y + 0.15, 0.1]} className="text-orange-200" text={() => `hengerfej ${stateRef.current?.headTempC.toFixed(0)} °C · hűtővíz ${stateRef.current?.tempC.toFixed(0)} °C`} />
      <LiveLabel
        position={[BLOCK_LEN / 2, HEAD_Y + 0.1, 0.25]}
        className="text-sky-200"
        text={() => {
          const s = stateRef.current!;
          return `szívócső ${s.mapKPa.toFixed(0)} kPa · fojtó ${Math.round(s.effThrottle * 100)}% · ${s.airGs.toFixed(0)} g/s`;
        }}
      />
    </group>
  );
}

/* Lendkerék + kuplung a motor váltó felőli végén */
function FlywheelClutch() {
  const { stateRef, controlsRef } = useScene();
  const fly = useRef<THREE.Group>(null!);
  const disc = useRef<THREE.Group>(null!);
  const plate = useRef<THREE.Group>(null!);
  const discMat = useRef<THREE.MeshStandardMaterial>(null!);
  const X = BLOCK_LEN / 2 + 0.02;
  useFrame((_, dt) => {
    const s = stateRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    fly.current.rotation.x = s.crank;
    plate.current.rotation.x = s.crank;
    const engage = THREE.MathUtils.clamp((0.85 - c.clutch) / 0.55, 0, 1);
    const ratio = DRIVETRAIN.gearRatios[c.gear] * DRIVETRAIN.finalDrive;
    const inputOmega = c.gear === 0 ? (engage > 0.5 ? s.omega : 0) : (s.speed / DRIVETRAIN.wheelRadius) * ratio;
    disc.current.rotation.x += inputOmega * Math.min(0.1, dt);
    const gap = (1 - engage) * 0.008;
    disc.current.position.x = X + 0.03 + gap;
    plate.current.position.x = X + 0.045 + gap * 2;
    const hot = THREE.MathUtils.clamp((s.clutchC - 120) / 250, 0, 1);
    discMat.current.emissiveIntensity = hot * 1.5 + (Math.abs(s.clutchSlip) > 20 && engage > 0.1 && c.gear !== 0 ? 0.4 : 0);
  });
  return (
    <group>
      <group ref={fly} position={[X + 0.012, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.025, 48]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0.013, 0, 0]}>
          <torusGeometry args={[0.15, 0.005, 6, 64]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
      </group>
      <group ref={disc} position={[X + 0.03, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.009, 48]} />
          <meshStandardMaterial ref={discMat} color="#9a3412" emissive="#ff4500" emissiveIntensity={0} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.012, 0.03, 0.01]} />
          <meshStandardMaterial color="#fdba74" />
        </mesh>
      </group>
      <group ref={plate} position={[X + 0.045, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.125, 0.125, 0.014, 48]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      <LiveLabel
        position={[X + 0.03, -0.18, 0.05]}
        className="text-orange-200"
        text={() => {
          const s = stateRef.current!;
          return `kettős tömegű lendkerék · kuplung ${s.clutchC.toFixed(0)} °C${s.dmg.clutch > 0.2 ? ` · kopás ${Math.round(s.dmg.clutch * 100)}%` : ""}`;
        }}
      />
    </group>
  );
}

/** A teljes motor a saját koordinátáiban */
function Engine() {
  const { stateRef, controlsRef } = useScene();
  const starter = useRef<THREE.Group>(null!);
  useFrame(() => {
    const s = stateRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    const on = (c.starter || s.autoCrank) && !s.running;
    starter.current.position.x = on ? 0.015 : 0;
    if (on) starter.current.rotation.x += 0.6;
  });
  return (
    <group name="Engine" position={[ENGINE_POS.x, ENGINE_POS.y, ENGINE_POS.z]} rotation={[0, Math.PI / 2, 0]}>
      <group rotation={[ENGINE_TILT, 0, 0]}>
        <Block />
        {Array.from({ length: N }, (_, i) => (
          <Cylinder key={i} index={i + 1} />
        ))}
        <Camshafts />
        <Crankshaft />
        <FrontDrive />
        <FlywheelClutch />
        <Turbo />
        {/* önindító (szívóoldalon, a harangháznál) */}
        <group position={[BLOCK_LEN / 2 + 0.03, -0.06, 0.15]}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.08, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.14, 16]} />
            <Mat c="#475569" m={0.6} r={0.5} />
          </mesh>
          <group ref={starter}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.014, 0.014, 0.025, 10]} />
              <Mat c="#cbd5e1" m={0.8} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/* --------------------- Váltó (02Q, 6+R) fogaskerekekkel --------------------- */
const GB_IN = new THREE.Vector3(ENGINE_POS.x, ENGINE_POS.y, 0); // bemenő tengely (főtengellyel egytengelyű)
const GB_OUT = new THREE.Vector3(CAR.axleF + 0.0, 0.43, 0); // kimenő tengely
const DIFF_F = new THREE.Vector3(CAR.axleF, CAR.wheelR, -0.27);
const GEAR_Z: Record<string, number> = { "-1": -0.53, "1": -0.5, "2": -0.47, "3": -0.44, "4": -0.41, "5": -0.38, "6": -0.35 };

function Gearbox() {
  const { stateRef, controlsRef, xray } = useScene();
  const inShaft = useRef<THREE.Group>(null!);
  const outShaft = useRef<THREE.Group>(null!);
  const mats = useRef<Record<string, THREE.MeshStandardMaterial | null>>({});
  const inAng = useRef(0);
  const dist = Math.hypot(GB_IN.x - GB_OUT.x, GB_IN.y - GB_OUT.y);
  useFrame((_, dtRaw) => {
    const s = stateRef.current;
    const c = controlsRef.current;
    if (!s || !c) return;
    const dt = Math.min(0.1, dtRaw);
    const outOmega = (s.speed / DRIVETRAIN.wheelRadius) * DRIVETRAIN.finalDrive;
    const engage = THREE.MathUtils.clamp((0.85 - c.clutch) / 0.55, 0, 1);
    const inOmega = c.gear !== 0 ? outOmega * DRIVETRAIN.gearRatios[c.gear] : engage > 0.5 ? s.omega : 0;
    inAng.current += inOmega * dt;
    inShaft.current.rotation.z = inAng.current;
    outShaft.current.rotation.z = -s.wheelAngle * DRIVETRAIN.finalDrive;
    for (const k of Object.keys(mats.current)) {
      const m = mats.current[k];
      if (!m) continue;
      const on = String(c.gear) === k;
      const broken = s.dmg.synchro[Number(k) === -1 ? 0 : Number(k)] >= 1;
      m.emissive.set(broken ? "#dc2626" : on ? "#22c55e" : "#000000");
      m.emissiveIntensity = broken ? 0.8 : on ? 0.9 : 0;
    }
  });
  const pairs = ([-1, 1, 2, 3, 4, 5, 6] as Gear[]).map((g) => {
    const ratio = Math.abs(DRIVETRAIN.gearRatios[g]);
    const rIn = (dist * 0.92) / (1 + ratio);
    const rOut = dist * 0.92 - rIn;
    return { g, rIn, rOut, z: GEAR_Z[String(g)] };
  });
  return (
    <group>
      {/* harangház + váltóház (alu, áttetsző röntgenben) */}
      <mesh position={[GB_IN.x - 0.02, GB_IN.y - 0.02, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.14, 0.1, 28]} />
        <Mat c="#a1a1aa" m={0.6} r={0.5} ghost ghostOpacity={0.1} />
      </mesh>
      <mesh position={[(GB_IN.x + GB_OUT.x) / 2 - 0.02, 0.37, -0.42]}>
        <boxGeometry args={[0.32, 0.26, 0.3]} />
        <Mat c="#a1a1aa" m={0.6} r={0.5} ghost ghostOpacity={0.1} />
      </mesh>
      <mesh position={[DIFF_F.x, DIFF_F.y, DIFF_F.z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 24]} />
        <Mat c="#a1a1aa" m={0.6} r={0.5} ghost ghostOpacity={0.2} />
      </mesh>
      {/* bemenő tengely fogaskerekekkel */}
      <group ref={inShaft} position={[GB_IN.x, GB_IN.y, 0]}>
        <mesh position={[0, 0, -0.43]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.26, 8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} />
        </mesh>
        {pairs.map((p) => (
          <group key={p.g} position={[0, 0, p.z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[p.rIn, p.rIn, 0.016, 20]} />
              <meshStandardMaterial ref={(m) => void (mats.current[`${p.g}`] = m)} color={p.g === -1 ? "#fbbf24" : "#cbd5e1"} metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, p.rIn * 0.7, 0.009]}>
              <boxGeometry args={[0.004, p.rIn * 0.4, 0.002]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
          </group>
        ))}
      </group>
      {/* kimenő tengely */}
      <group ref={outShaft} position={[GB_OUT.x, GB_OUT.y, 0]}>
        <mesh position={[0, 0, -0.43]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.26, 8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} />
        </mesh>
        {pairs.map((p) => (
          <group key={p.g} position={[0, 0, p.z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[p.rOut, p.rOut, 0.016, 28]} />
              <meshStandardMaterial color={p.g === -1 ? "#fbbf24" : "#94a3b8"} metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, p.rOut * 0.75, 0.009]}>
              <boxGeometry args={[0.004, p.rOut * 0.3, 0.002]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
          </group>
        ))}
      </group>
      {!xray && null}
      <LiveLabel
        position={[GB_OUT.x, 0.62, -0.45]}
        className="text-emerald-200 text-sm font-bold"
        detail={false}
        text={() => {
          const c = controlsRef.current!;
          const s = stateRef.current!;
          const broken = s.dmg.synchro.map((v, i) => (v >= 1 ? (i === 0 ? "R" : String(i)) : "")).filter(Boolean);
          return `02Q 6+R váltó · ${gearLabel(c.gear)}${broken.length ? ` · törött: ${broken.join(", ")}` : ""}`;
        }}
      />
    </group>
  );
}

/* 4MOTION: szöghajtás (PTU), kardán, Haldex, hátsó diffi, féltengelyek */
function Driveline() {
  const { stateRef } = useScene();
  const prop = useRef<THREE.Group>(null!);
  const halves = useRef<THREE.Group>(null!);
  const haldexMat = useRef<THREE.MeshStandardMaterial>(null!);
  const PROP_Y = 0.29;
  const x0 = CAR.axleF - 0.16;
  const x1 = CAR.axleR + 0.32;
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    prop.current.rotation.x = s.wheelAngle * 2.7;
    halves.current.children.forEach((c) => (c.rotation.y = 0));
    haldexMat.current.emissiveIntensity = s.rearShare * 2.2;
  });
  const shafts: { from: [number, number, number]; to: [number, number, number] }[] = [
    { from: [DIFF_F.x, DIFF_F.y, DIFF_F.z - 0.06], to: [CAR.axleF, CAR.wheelR, -CAR.trackF / 2 + 0.12] },
    { from: [DIFF_F.x, DIFF_F.y, DIFF_F.z + 0.06], to: [CAR.axleF, CAR.wheelR, CAR.trackF / 2 - 0.12] },
    { from: [CAR.axleR, CAR.wheelR, -0.1], to: [CAR.axleR, CAR.wheelR, -CAR.trackR / 2 + 0.12] },
    { from: [CAR.axleR, CAR.wheelR, 0.1], to: [CAR.axleR, CAR.wheelR, CAR.trackR / 2 - 0.12] },
  ];
  return (
    <group>
      {/* szöghajtás (PTU) a váltó mellett */}
      <mesh position={[CAR.axleF - 0.06, 0.3, -0.12]}>
        <boxGeometry args={[0.18, 0.15, 0.14]} />
        <Mat c="#71717a" m={0.6} r={0.5} ghost ghostOpacity={0.25} />
      </mesh>
      <group ref={prop}>
        <mesh position={[(x0 + x1) / 2, PROP_Y, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, x0 - x1, 12]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[(x0 + x1) / 2, PROP_Y + 0.031, -0.02]}>
          <boxGeometry args={[(x0 - x1) * 0.9, 0.003, 0.008]} />
          <meshStandardMaterial color="#f59e0b" />
        </mesh>
        {[x0 - 0.03, (x0 + x1) / 2, x1 + 0.03].map((x, i) => (
          <mesh key={i} position={[x, PROP_Y, -0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.05, 14]} />
            <meshStandardMaterial color="#52525b" metalness={0.8} />
          </mesh>
        ))}
      </group>
      {/* Haldex kapcsoló + hátsó differenciálmű */}
      <mesh position={[CAR.axleR + 0.22, CAR.wheelR, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 20]} />
        <meshStandardMaterial ref={haldexMat} color="#475569" metalness={0.6} roughness={0.4} emissive="#22c55e" emissiveIntensity={0} />
      </mesh>
      <mesh position={[CAR.axleR, CAR.wheelR, 0]}>
        <sphereGeometry args={[0.12, 20, 14]} />
        <Mat c="#52525b" m={0.6} r={0.5} ghost ghostOpacity={0.3} />
      </mesh>
      <group ref={halves}>
        {shafts.map((sh, i) => (
          <group key={i}>
            <Rod from={sh.from} to={sh.to} r={0.016} color="#9ca3af" />
            <mesh position={sh.to}>
              <sphereGeometry args={[0.04, 12, 10]} />
              <Mat c="#111" r={0.8} />
            </mesh>
            <mesh position={sh.from}>
              <sphereGeometry args={[0.035, 12, 10]} />
              <Mat c="#111" r={0.8} />
            </mesh>
          </group>
        ))}
      </group>
      <LiveLabel
        position={[CAR.axleR + 0.22, CAR.wheelR + 0.17, 0]}
        className="text-emerald-200"
        detail={false}
        text={() => {
          const s = stateRef.current!;
          return `Haldex 4MOTION · hátra ${Math.round(s.rearShare * 100)}% · elöl ${Math.round((1 - s.rearShare) * 100)}%`;
        }}
      />
      <Label position={[(x0 + x1) / 2, PROP_Y - 0.08, 0]} className="text-slate-300">
        kardántengely
      </Label>
    </group>
  );
}

/* Hűtő, intercooler, ventilátorok, légszűrő, akkumulátor, kiegyenlítő tartály, tank */
function Ancillaries() {
  const { stateRef, xray } = useScene();
  const fan = useRef<THREE.Group>(null!);
  const radMat = useRef<THREE.MeshStandardMaterial>(null!);
  const icMat = useRef<THREE.MeshStandardMaterial>(null!);
  const fuel = useRef<THREE.Group>(null!);
  const batBar = useRef<THREE.Mesh>(null!);
  const batMat = useRef<THREE.MeshStandardMaterial>(null!);
  const coolant = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.fan) fan.current.children.forEach((c) => (c.rotation.x += 0.5));
    const t = THREE.MathUtils.clamp((s.tempC - 40) / 80, 0, 1);
    if (xray) radMat.current.color.setRGB(0.2 + t * 0.6, 0.3 - t * 0.12, 0.45 - t * 0.38);
    else radMat.current.color.set("#1f2329");
    const b = THREE.MathUtils.clamp(s.boostKPa / 120, 0, 1);
    icMat.current.emissiveIntensity = b * 0.5;
    const f = Math.max(0.02, s.fuelL / ENGINE.tankL);
    fuel.current.scale.set(1, f, 1);
    fuel.current.position.y = 0.235 + (0.2 * f) / 2;
    batBar.current.scale.y = Math.max(0.02, s.batterySoc);
    batMat.current.color.set(s.batterySoc < 0.2 ? "#ef4444" : "#22c55e");
    coolant.current.scale.y = Math.max(0.02, s.coolantL / 8.5);
  });
  const glassy = (c: string, o = 0.35) => <meshStandardMaterial color={c} transparent opacity={xray ? o : 1} depthWrite={!xray} roughness={0.6} metalness={0.3} />;
  return (
    <group>
      {/* zárhíd-burkolat a motortér elején (külső nézetben takarja a hűtőt) */}
      <mesh position={[2.0, 0.735, 0]}>
        <boxGeometry args={[0.16, 0.025, 1.3]} />
        <Mat c="#0b0b0d" r={0.8} ghost ghostOpacity={0.05} />
      </mesh>
      {/* hűtő + intercooler + ventilátorok */}
      <mesh position={[1.97, 0.5, 0]}>
        <boxGeometry args={[0.04, 0.38, 0.72]} />
        <meshStandardMaterial ref={radMat} color="#334155" metalness={0.3} roughness={0.7} transparent={xray} opacity={xray ? 0.35 : 1} depthWrite={!xray} />
      </mesh>
      <mesh position={[2.06, 0.33, 0]}>
        <boxGeometry args={[0.05, 0.2, 1.05]} />
        <meshStandardMaterial ref={icMat} color="#52525b" metalness={0.5} roughness={0.5} emissive="#38bdf8" emissiveIntensity={0} transparent={xray} opacity={xray ? 0.35 : 1} depthWrite={!xray} />
      </mesh>
      <group ref={fan}>
        {[-0.18, 0.18].map((z) => (
          <group key={z} position={[1.92, 0.5, z]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <mesh key={i} rotation={[(i * Math.PI * 2) / 7, 0, 0]} position={[0, 0, 0]}>
                <boxGeometry args={[0.008, 0.28, 0.05]} />
                <meshStandardMaterial color="#111827" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* töltőlevegő-csövek: turbó → intercooler → fojtószelep */}
      <Rod from={[1.2, 0.5, -0.24]} to={[1.6, 0.22, -0.48]} r={0.03} color="#1f2937" />
      <Rod from={[1.6, 0.22, -0.48]} to={[2.03, 0.3, -0.5]} r={0.03} color="#1f2937" />
      <Rod from={[2.03, 0.3, 0.5]} to={[1.62, 0.55, 0.45]} r={0.03} color="#1f2937" />
      <Rod from={[1.62, 0.55, 0.45]} to={[1.52, 0.66, -0.14]} r={0.028} color="#1f2937" />
      {/* légszűrőház + légtömegmérő, cső a turbóhoz */}
      <mesh position={[1.6, 0.73, -0.43]}>
        <boxGeometry args={[0.34, 0.14, 0.28]} />
        {glassy("#18181b", 0.25)}
      </mesh>
      <Rod from={[1.45, 0.72, -0.36]} to={[1.22, 0.6, -0.2]} r={0.035} color="#27272a" />
      {/* akkumulátor (AGM, bal elöl) */}
      <group position={[1.83, 0.6, -0.56]}>
        <mesh>
          <boxGeometry args={[0.27, 0.19, 0.17]} />
          {glassy("#0f172a", 0.5)}
        </mesh>
        <mesh ref={batBar} position={[0, 0, 0.087]} visible={xray}>
          <boxGeometry args={[0.2, 0.12, 0.004]} />
          <meshStandardMaterial ref={batMat} color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[-0.09, 0.11, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.03, 10]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
        <LiveLabel position={[0, 0.17, 0]} className="text-emerald-200" text={() => {
          const s = stateRef.current!;
          return `akku 68 Ah AGM · ${s.batteryV.toFixed(2)} V · ${Math.round(s.batterySoc * 100)}%`;
        }} />
      </group>
      {/* hűtőfolyadék-kiegyenlítő tartály (jobb oldal) */}
      <group position={[1.12, 0.74, 0.6]}>
        <mesh>
          <boxGeometry args={[0.16, 0.12, 0.12]} />
          <meshStandardMaterial color="#e5e7eb" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        <mesh ref={coolant} position={[0, -0.01, 0]}>
          <boxGeometry args={[0.15, 0.09, 0.11]} />
          <meshStandardMaterial color="#ec4899" transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.025, 14]} />
          <meshStandardMaterial color="#1e3a8a" />
        </mesh>
      </group>
      {/* fékfolyadék-tartály (bal hátul) + rugóstag dómok */}
      <mesh position={[0.98, 0.8, -0.5]}>
        <boxGeometry args={[0.1, 0.07, 0.08]} />
        <meshStandardMaterial color="#fde68a" transparent opacity={0.8} />
      </mesh>
      {[1, -1].map((sd) => (
        <mesh key={sd} position={[CAR.axleF - 0.05, 0.79, sd * 0.53]}>
          <cylinderGeometry args={[0.07, 0.08, 0.04, 20]} />
          <Mat c="#111" r={0.6} ghost />
        </mesh>
      ))}
      {/* tűzfal / vízgyűjtő */}
      <mesh position={[0.9, 0.82, 0]}>
        <boxGeometry args={[0.08, 0.1, 1.42]} />
        <Mat c="#111113" r={0.8} ghost ghostOpacity={0.08} />
      </mesh>
      <mesh position={[0.84, 0.55, 0]}>
        <boxGeometry args={[0.02, 0.6, 1.5]} />
        <Mat c="#1c1c1f" r={0.8} ghost ghostOpacity={0.06} />
      </mesh>
      {/* üzemanyagtank a hátsó ülés alatt (55 L, nyereg alakú: a kardán és a kipufogó fölött) */}
      <group position={[-0.95, 0, 0]}>
        {[-0.32, 0.32].map((z) => (
          <group key={z}>
            <mesh position={[0, 0.34, z]}>
              <boxGeometry args={[0.5, 0.22, 0.36]} />
              <meshPhysicalMaterial color="#94a3b8" transparent opacity={xray ? 0.2 : 0.95} depthWrite={!xray} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.5, 0.06, 0.3]} />
          <meshPhysicalMaterial color="#94a3b8" transparent opacity={xray ? 0.2 : 0.95} depthWrite={!xray} />
        </mesh>
        <group ref={fuel} position={[0, 0.3, 0]}>
          {[-0.32, 0.32].map((z) => (
            <mesh key={z} position={[0, 0, z]}>
              <boxGeometry args={[0.48, 0.2, 0.34]} />
              <meshStandardMaterial color="#f59e0b" transparent opacity={0.45} emissive="#f59e0b" emissiveIntensity={0.15} depthWrite={false} />
            </mesh>
          ))}
        </group>
        <LiveLabel position={[0, 0.55, 0.3]} className="text-amber-200" text={() => `tank ${stateRef.current?.fuelL.toFixed(1)} / ${ENGINE.tankL} L`} />
      </group>
      <LiveLabel position={[1.97, 0.78, 0.25]} className="text-sky-200" text={() => {
        const s = stateRef.current!;
        return `hűtő ${s.tempC.toFixed(0)} °C · termosztát ${Math.round(s.thermostat * 100)}% · ventilátor ${s.fan ? "BE" : "ki"} · ${s.coolantL.toFixed(1)} L`;
      }} />
      <LiveLabel position={[2.08, 0.18, -0.2]} className="text-cyan-200" text={() => `intercooler · ${(stateRef.current!.boostKPa / 100).toFixed(2)} bar · ${stateRef.current!.intakeAirC.toFixed(0)} °C`} />
    </group>
  );
}

export default function Powertrain() {
  return (
    <group name="Powertrain">
      <Engine />
      <group name="Gearbox">
        <Gearbox />
      </group>
      <group name="Driveline">
        <Driveline />
      </group>
      <group name="Ancillaries">
        <Ancillaries />
      </group>
    </group>
  );
}
