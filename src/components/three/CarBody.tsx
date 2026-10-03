"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { CAR, CUT, PARTS, buildBodyGeometry, topY, type PartId } from "./shape";
import { createBodyMaterial, createBodyUniforms, partIndex, type BodyUniforms } from "./bodyShader";
import { blinkOn, useScene } from "./context";
import { Mat } from "./Mat";
import { plate, rBadge, vwLogo } from "./textures";

let geomCache: { geom: THREE.BufferGeometry; parts: Record<PartId, THREE.BufferGeometry> } | null = null;

function bodyGeometry() {
  if (geomCache) return geomCache;
  const geom = buildBodyGeometry();
  const parts = {} as Record<PartId, THREE.BufferGeometry>;
  for (const p of PARTS) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", geom.getAttribute("position"));
    g.setAttribute("normal", geom.getAttribute("normal"));
    g.setIndex(partIndex(geom, p));
    g.computeBoundingSphere();
    parts[p] = g;
  }
  geomCache = { geom, parts };
  return geomCache;
}

/** Zsanérok: pozíció + forgástengely + nyitási szög */
const HINGES: Record<Exclude<PartId, "body">, { pos: [number, number, number]; axis: "y" | "z"; open: number }> = {
  hood: { pos: [CUT.hoodRear, 0.955, 0], axis: "z", open: 0.95 },
  tailgate: { pos: [CUT.tailTop, 1.4, 0], axis: "z", open: -1.3 },
  doorFL: { pos: [CUT.doorFront, 0.7, -0.86], axis: "y", open: -1.05 },
  doorFR: { pos: [CUT.doorFront, 0.7, 0.86], axis: "y", open: 1.05 },
  doorRL: { pos: [CUT.doorMid, 0.7, -0.86], axis: "y", open: -1.0 },
  doorRR: { pos: [CUT.doorMid, 0.7, 0.86], axis: "y", open: 1.0 },
};

const DOOR_IDX: Partial<Record<PartId, number>> = { doorFL: 0, doorFR: 1, doorRL: 2, doorRR: 3 };

function PartMeshes({ part, U, onClick }: { part: PartId; U: BodyUniforms; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const { parts } = bodyGeometry();
  const opaque = useMemo(() => createBodyMaterial(part, false, U), [part, U]);
  const glass = useMemo(() => (part === "hood" ? null : createBodyMaterial(part, true, U)), [part, U]);
  const { xray } = useScene();
  useEffect(() => {
    opaque.transparent = xray;
    opaque.depthWrite = !xray;
    opaque.needsUpdate = true;
  }, [xray, opaque]);
  return (
    <>
      <mesh name="BodyShell" geometry={parts[part]} material={opaque} castShadow={!xray} receiveShadow onClick={onClick} />
      {glass && <mesh name="BodyShell-glass" geometry={parts[part]} material={glass} renderOrder={2} />}
    </>
  );
}

/** Nyíló elem forgáspont-csoporttal */
function Opening({ part, U, children }: { part: Exclude<PartId, "body">; U: BodyUniforms; children?: React.ReactNode }) {
  const { bodyRef, onInteract, xray } = useScene();
  const pivot = useRef<THREE.Group>(null!);
  const prog = useRef(0);
  const h = HINGES[part];
  useFrame((_, dt) => {
    const b = bodyRef.current;
    if (!b) return;
    const di = DOOR_IDX[part];
    const want = di !== undefined ? b.doors[di] : part === "hood" ? b.hood : b.tailgate;
    const speed = part === "hood" || part === "tailgate" ? 0.9 : 1.6;
    prog.current = THREE.MathUtils.clamp(prog.current + (want ? 1 : -1) * dt * speed, 0, 1);
    const e = prog.current * prog.current * (3 - 2 * prog.current);
    const a = h.open * e;
    pivot.current.rotation.set(0, h.axis === "y" ? a : 0, h.axis === "z" ? a : 0);
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (xray) return;
    e.stopPropagation();
    const di = DOOR_IDX[part];
    if (di !== undefined) onInteract({ type: "door", index: di });
    else if (part === "hood") onInteract({ type: "hood" });
    else onInteract({ type: "tailgate" });
  };
  return (
    <group ref={pivot} position={h.pos}>
      <group position={[-h.pos[0], -h.pos[1], -h.pos[2]]}>
        <PartMeshes part={part} U={U} onClick={click} />
        {children}
      </group>
    </group>
  );
}

/* --- visszapillantó tükör (matt króm burkolat, irányjelzővel) --- */
function Mirror({ side, U }: { side: 1 | -1; U: BodyUniforms }) {
  const indMat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const on = side < 0 ? U.uIndL.value : U.uIndR.value;
    indMat.current.emissiveIntensity = on * 3;
  });
  return (
    <group name="Mirror" position={[0.6, 1.005, side * 0.9]}>
      {/* kar */}
      <mesh position={[0.02, -0.01, -side * 0.06]}>
        <boxGeometry args={[0.07, 0.035, 0.1]} />
        <Mat c="#0b0b0c" r={0.5} ghost />
      </mesh>
      {/* ház */}
      <mesh position={[0, 0.02, side * 0.07]} scale={[0.055, 0.068, 0.125]}>
        <sphereGeometry args={[1, 24, 16, Math.PI / 2, Math.PI]} />
        <Mat c="#c8ccd2" m={0.75} r={0.38} ghost />
      </mesh>
      <mesh position={[-0.001, 0.02, side * 0.07]} rotation={[0, -Math.PI / 2, 0]} scale={[0.125, 0.068, 1]}>
        <circleGeometry args={[1, 32]} />
        <Mat c="#111113" r={0.5} ghost />
      </mesh>
      {/* tükörlap (hátrafelé néz) */}
      <mesh position={[-0.003, 0.02, side * 0.07]} rotation={[0, -Math.PI / 2, 0]} scale={[0.112, 0.056, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshStandardMaterial color="#cbd5e1" metalness={1} roughness={0.03} />
      </mesh>
      {/* index-csík az alján */}
      <mesh position={[0.01, -0.03, side * 0.08]}>
        <boxGeometry args={[0.04, 0.008, 0.13]} />
        <meshStandardMaterial ref={indMat} color="#7c4a03" emissive="#ff8a00" emissiveIntensity={0} />
      </mesh>
    </group>
  );
}

/* --- ablaktörlők --- */
function Wipers() {
  const { bodyRef } = useScene();
  const arms = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  const phase = useRef(0);
  const basis = useMemo(() => {
    const d = new THREE.Vector3(-0.92, 0.455, 0).normalize();
    const x = new THREE.Vector3(0, 0, 1);
    const z = new THREE.Vector3().crossVectors(x, d);
    const m = new THREE.Matrix4().makeBasis(x, d, z);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }, []);
  useFrame((_, dt) => {
    const w = bodyRef.current?.wiper ?? 0;
    if (w > 0 || phase.current % (Math.PI * 2) > 0.05) phase.current += dt * (w === 2 ? 5.2 : 3.2);
    else phase.current = 0;
    const a = (1 - Math.cos(phase.current)) * 0.5 * 1.55;
    arms[0].current.rotation.z = a;
    arms[1].current.rotation.z = a;
  });
  return (
    <group name="Wiper">
      {[-0.52, 0.12].map((z, i) => (
        <group key={i} position={[0.86, 0.95, z]} quaternion={basis}>
          <group ref={arms[i]}>
            <mesh position={[i === 0 ? 0.26 : 0.24, 0.02, -0.012]}>
              <boxGeometry args={[i === 0 ? 0.56 : 0.5, 0.012, 0.012]} />
              <Mat c="#09090b" r={0.5} ghost />
            </mesh>
            <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.02, 12]} />
              <Mat c="#09090b" r={0.5} ghost />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* --- ajtókárpit (belül, az ajtóval együtt mozog) --- */
function DoorTrim({ front, side }: { front: boolean; side: 1 | -1 }) {
  const x0 = front ? CUT.doorFront - 0.02 : CUT.doorMid - 0.03;
  const x1 = front ? CUT.doorMid + 0.02 : CUT.doorRear + 0.22;
  const len = x0 - x1;
  const cx = (x0 + x1) / 2;
  const z = side * 0.79;
  return (
    <group name="DoorTrim">
      <mesh position={[cx, 0.63, z]}>
        <boxGeometry args={[len, 0.6, 0.03]} />
        <Mat c="#18181b" r={0.85} ghost />
      </mesh>
      {/* felső párkány (övvonalnál) */}
      <mesh position={[cx, 0.925, z - side * 0.02]}>
        <boxGeometry args={[len, 0.03, 0.06]} />
        <Mat c="#27272a" r={0.6} ghost />
      </mesh>
      {/* karfa */}
      <mesh position={[cx - 0.02, 0.7, z - side * 0.06]}>
        <boxGeometry args={[len * 0.6, 0.045, 0.09]} />
        <Mat c="#3f3f46" r={0.7} ghost />
      </mesh>
      {/* kék varrás / díszléc */}
      <mesh position={[cx, 0.82, z - side * 0.017]}>
        <boxGeometry args={[len * 0.9, 0.012, 0.004]} />
        <Mat c="#1d4ed8" r={0.4} emissive="#1d4ed8" ei={0.3} ghost />
      </mesh>
      {/* kilincs */}
      <mesh position={[x0 - 0.18, 0.86, z - side * 0.03]}>
        <boxGeometry args={[0.1, 0.025, 0.02]} />
        <Mat c="#d4d4d8" m={1} r={0.2} ghost />
      </mesh>
      {/* hangszóró */}
      <mesh position={[cx + len * 0.25, 0.47, z - side * 0.017]} rotation={[0, side * Math.PI / 2, 0]}>
        <circleGeometry args={[0.075, 24]} />
        <Mat c="#0a0a0a" r={0.9} ghost />
      </mesh>
      {/* ablakemelő gombok */}
      {front && (
        <mesh position={[cx - 0.02, 0.725, z - side * 0.06]}>
          <boxGeometry args={[0.12, 0.012, 0.05]} />
          <Mat c="#52525b" r={0.4} ghost />
        </mesh>
      )}
    </group>
  );
}

function Decal({ map, size, position, rotation }: { map: THREE.Texture; size: [number, number]; position: [number, number, number]; rotation: [number, number, number] }) {
  const { xray } = useScene();
  return (
    <mesh name="Decal" position={position} rotation={rotation} renderOrder={3}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={map} transparent metalness={0.6} roughness={0.25} opacity={xray ? 0.25 : 1} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

/** Kerékív-burkolat (fekete belső ív) */
function ArchLiner({ x, side }: { x: number; side: 1 | -1 }) {
  const r = CAR.archR - 0.004;
  const len = 0.3;
  return (
    <mesh name="ArchLiner" position={[x, CAR.wheelR + 0.01, side * (CAR.halfW - len / 2 - 0.02)]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, len, 40, 1, true, Math.PI / 2 - 0.15, Math.PI + 0.3]} />
      <Mat c="#09090b" r={0.95} side={THREE.DoubleSide} ghost />
    </mesh>
  );
}

export default function CarBody() {
  const { stateRef, controlsRef, bodyRef, xray } = useScene();
  const U = useMemo(() => createBodyUniforms(), []);
  const tex = useMemo(() => ({ vw: vwLogo(), r: rBadge(), plate: plate("RGO-750") }), []);
  useEffect(() => {
    U.uXray.value = xray ? 1 : 0;
  }, [xray, U]);
  useFrame(() => {
    const s = stateRef.current;
    const c = controlsRef.current;
    const b = bodyRef.current;
    if (!s || !c || !b) return;
    const t = performance.now() / 1000;
    const on = c.ignition;
    U.uDRL.value = on && !b.lights ? 1 : on ? 0.4 : 0;
    U.uLow.value = on && b.lights ? 1 : 0;
    U.uTail.value = on && b.lights ? 1 : 0;
    U.uBrake.value = (c.brake > 0.05 && on) || s.epbDynamic || s.holdActive ? 1 : 0;
    U.uRev.value = on && c.gear === -1 ? 1 : 0;
    const blink = blinkOn(t);
    const cyc = t % 0.72;
    U.uIndPhase.value = Math.min(1, cyc / 0.22);
    U.uIndL.value = (b.hazard || b.indicator === -1) && blink ? 1 : 0;
    U.uIndR.value = (b.hazard || b.indicator === 1) && blink ? 1 : 0;
  });
  const tailX = -2.047;
  return (
    <group>
      <PartMeshes part="body" U={U} />
      <Opening part="hood" U={U} />
      <Opening part="tailgate" U={U}>
        <Decal map={tex.vw} size={[0.15, 0.15]} position={[tailX + 0.035 + (topY(-2.0) > 0.9 ? 0 : 0), 0.915, 0]} rotation={[0, -Math.PI / 2, 0]} />
        <Decal map={tex.r} size={[0.08, 0.08]} position={[-2.045, 0.79, -0.42]} rotation={[0, -Math.PI / 2, 0]} />
        <Decal map={tex.plate} size={[0.52, 0.112]} position={[-2.051, 0.765, 0]} rotation={[0, -Math.PI / 2, 0]} />
        {/* hátsó ablaktörlő */}
        <mesh name="Wiper-rear" position={[-1.945, 1.06, -0.18]} rotation={[0.2, 0, 0.0]}>
          <boxGeometry args={[0.012, 0.012, 0.42]} />
          <Mat c="#09090b" r={0.5} ghost />
        </mesh>
      </Opening>
      <Opening part="doorFL" U={U}>
        <Mirror side={-1} U={U} />
        <DoorTrim front side={-1} />
      </Opening>
      <Opening part="doorFR" U={U}>
        <Mirror side={1} U={U} />
        <DoorTrim front side={1} />
      </Opening>
      <Opening part="doorRL" U={U}>
        <DoorTrim front={false} side={-1} />
      </Opening>
      <Opening part="doorRR" U={U}>
        <DoorTrim front={false} side={1} />
      </Opening>
      {[CAR.axleF, CAR.axleR].map((x) => [1, -1].map((sd) => <ArchLiner key={`${x}${sd}`} x={x} side={sd as 1 | -1} />))}
      {/* emblémák, rendszám elöl */}
      <Decal map={tex.vw} size={[0.15, 0.15]} position={[2.214, 0.628, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Decal map={tex.r} size={[0.07, 0.07]} position={[2.207, 0.655, 0.27]} rotation={[0, Math.PI / 2, 0]} />
      <Decal map={tex.plate} size={[0.52, 0.112]} position={[2.218, 0.36, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Wipers />
      {/* cápauszony antenna */}
      <mesh name="Antenna" position={[-1.5, 1.43, 0]} scale={[0.09, 0.045, 0.03]}>
        <sphereGeometry args={[1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat c="#2350a8" m={0.5} r={0.3} ghost />
      </mesh>
    </group>
  );
}
