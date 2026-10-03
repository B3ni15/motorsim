"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Gear } from "@/lib/engine";
import { CAR } from "./shape";
import { blinkOn, useScene, type BodyCtl } from "./context";
import { Mat } from "./Mat";
import { canvasTexture, rBadge, vwLogo } from "./textures";
import { drawAID, drawInfotainment } from "./screens";
import type { Controls, SimState } from "@/lib/engine";

const DZ = CAR.driverZ;
const BLUE = "#1d4ed8";

/* ------------------------------ kijelzők ------------------------------ */
function Screen({
  w,
  h,
  px,
  draw,
  position,
  rotation,
}: {
  w: number;
  h: number;
  px: [number, number];
  draw: (g: CanvasRenderingContext2D, w: number, h: number, s: SimState, c: Controls, b: BodyCtl) => void;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const { stateRef, controlsRef, bodyRef, xray } = useScene();
  const { tex, ctx } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = px[0];
    c.height = px[1];
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, ctx: c.getContext("2d")! };
  }, [px]);
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1 / 12) return;
    acc.current = 0;
    const s = stateRef.current;
    const c = controlsRef.current;
    const b = bodyRef.current;
    if (!s || !c || !b) return;
    draw(ctx, px[0], px[1], s, c, b);
    tex.needsUpdate = true;
  });
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.004]}>
        <boxGeometry args={[w + 0.012, h + 0.012, 0.006]} />
        <Mat c="#09090b" r={0.3} ghost />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} transparent={xray} opacity={xray ? 0.3 : 1} />
      </mesh>
    </group>
  );
}

/* ------------------------------ kattintható gomb ------------------------------ */
function Button({
  position,
  rotation,
  size,
  color,
  label,
  onPress,
  lit,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  color: string;
  label?: THREE.Texture;
  onPress: () => void;
  lit?: () => number;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const pressed = useRef(0);
  const grp = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    pressed.current = Math.max(0, pressed.current - dt * 4);
    grp.current.position.y = -pressed.current * 0.004;
    if (lit && mat.current) mat.current.emissiveIntensity = lit();
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    pressed.current = 1;
    onPress();
  };
  return (
    <group position={position} rotation={rotation}>
      <group ref={grp}>
        <mesh onClick={click} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
          <boxGeometry args={size} />
          <meshStandardMaterial ref={mat} color={color} roughness={0.35} metalness={0.3} emissive={lit ? "#f59e0b" : "#000"} emissiveIntensity={0} />
        </mesh>
        {label && (
          <mesh position={[0, size[1] / 2 + 0.0006, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
            <planeGeometry args={[size[2] * 0.9, size[0] * 0.9]} />
            <meshBasicMaterial map={label} transparent toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function textLabel(text: string, color = "#e5e7eb", bg = "rgba(0,0,0,0)", font = "bold 44px Arial") {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines = text.split("\n");
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 44));
  });
}

/* ------------------------------ műszerfal ------------------------------ */
function Dashboard() {
  const { onInteract, controlsRef } = useScene();
  const dashGeom = useMemo(() => {
    const sh = new THREE.Shape();
    const pts: [number, number][] = [
      [0.75, 0.935],
      [0.62, 0.968],
      [0.44, 0.985],
      [0.35, 0.965],
      [0.3, 0.9],
      [0.31, 0.78],
      [0.36, 0.64],
      [0.5, 0.5],
      [0.75, 0.47],
    ];
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.42, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 3 });
    g.translate(0, 0, -0.71);
    return g;
  }, []);
  const hazard = useMemo(() => textLabel("▲", "#ef4444", "#111", "bold 70px Arial"), []);
  return (
    <group>
      <mesh geometry={dashGeom} castShadow receiveShadow>
        <Mat c="#1a1a1d" r={0.85} ghost ghostOpacity={0.06} />
      </mesh>
      {/* dekorbetét (karbon hatás, kék csík) */}
      <mesh position={[0.305, 0.84, 0.25]} rotation={[0, -Math.PI / 2, 0.06]}>
        <planeGeometry args={[0.85, 0.05]} />
        <Mat c="#27272a" m={0.6} r={0.35} ghost />
      </mesh>
      <mesh position={[0.303, 0.818, 0.25]} rotation={[0, -Math.PI / 2, 0.06]}>
        <planeGeometry args={[0.85, 0.004]} />
        <Mat c={BLUE} emissive={BLUE} ei={0.4} ghost />
      </mesh>
      {/* műszerfal-ernyő a vezető előtt */}
      <mesh position={[0.33, 0.99, DZ]}>
        <boxGeometry args={[0.12, 0.03, 0.4]} />
        <Mat c="#141416" r={0.8} ghost ghostOpacity={0.06} />
      </mesh>
      {/* Active Info Display */}
      <Screen w={0.29} h={0.108} px={[768, 288]} draw={drawAID} position={[0.297, 0.915, DZ]} rotation={[0, -Math.PI / 2, 0.14]} />
      {/* Discover Pro érintőképernyő a középkonzolon, kissé a vezető felé fordítva */}
      <Screen w={0.235} h={0.136} px={[640, 370]} draw={(g, w, h, s, c) => drawInfotainment(g, w, h, s, c)} position={[0.282, 0.832, -0.02]} rotation={[0, -Math.PI / 2 - 0.1, 0.05]} />
      {/* szellőzők */}
      {[-0.1, 0.06].map((z) => (
        <mesh key={z} position={[0.33, 0.925, z]}>
          <boxGeometry args={[0.02, 0.045, 0.12]} />
          <Mat c="#0a0a0a" r={0.6} ghost />
        </mesh>
      ))}
      {[-0.66, 0.66].map((z) => (
        <mesh key={z} position={[0.36, 0.9, z]}>
          <boxGeometry args={[0.02, 0.06, 0.09]} />
          <Mat c="#0a0a0a" r={0.6} ghost />
        </mesh>
      ))}
      {/* klímapanel + vészvillogó gomb */}
      <mesh position={[0.345, 0.725, -0.02]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.02, 0.07, 0.24]} />
        <Mat c="#111113" r={0.4} m={0.3} ghost />
      </mesh>
      {[-0.11, 0.07].map((z) => (
        <mesh key={z} position={[0.334, 0.727, z]} rotation={[0, 0, Math.PI / 2 + 0.35]}>
          <cylinderGeometry args={[0.02, 0.02, 0.02, 20]} />
          <Mat c="#a1a1aa" m={0.9} r={0.3} ghost />
        </mesh>
      ))}
      <Button position={[0.33, 0.76, -0.02]} rotation={[0, 0, Math.PI / 2 - 0.35]} size={[0.012, 0.012, 0.03]} color="#111" label={hazard} onPress={() => onInteract({ type: "hazard" })} />
      {/* világításkapcsoló (bal oldalt) */}
      <Button
        position={[0.33, 0.8, -0.64]}
        rotation={[0, 0, Math.PI / 2 - 0.2]}
        size={[0.01, 0.04, 0.04]}
        color="#27272a"
        label={textLabel("☀\nAUTO", "#e5e7eb", "#18181b", "bold 30px Arial")}
        onPress={() => onInteract({ type: "lights" })}
        lit={() => (controlsRef.current?.lights ? 0.4 : 0)}
      />
      {/* belső visszapillantó tükör */}
      <group position={[0.0, 1.25, 0]} rotation={[0, 0, 0.1]}>
        <mesh position={[0.03, 0.04, 0]}>
          <boxGeometry args={[0.02, 0.05, 0.03]} />
          <Mat c="#111" ghost />
        </mesh>
        <RoundedBox args={[0.025, 0.065, 0.25]} radius={0.01}>
          <Mat c="#111" r={0.5} ghost />
        </RoundedBox>
        <mesh position={[-0.013, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.235, 0.052]} />
          <meshStandardMaterial color="#9ca3af" metalness={1} roughness={0.05} />
        </mesh>
      </group>
      {/* napellenzők */}
      {[-0.36, 0.36].map((z) => (
        <mesh key={z} position={[-0.02, 1.37, z]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.18, 0.015, 0.36]} />
          <Mat c="#2a2a2e" r={0.9} ghost />
        </mesh>
      ))}
      {/* padló + kardánalagút + szőnyeg */}
      <mesh position={[-0.4, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.3, 1.5]} />
        <Mat c="#111113" r={1} ghost ghostOpacity={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.3, 0.27, 0]}>
        <boxGeometry args={[1.8, 0.14, 0.26]} />
        <Mat c="#141416" r={1} ghost ghostOpacity={0.05} />
      </mesh>
      {/* lábtér-elválasztó (tűzfal belső oldala) */}
      <mesh position={[0.66, 0.42, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.02, 0.5, 1.45]} />
        <Mat c="#111113" r={1} ghost ghostOpacity={0.05} />
      </mesh>
    </group>
  );
}

/* ------------------------------ kormány ------------------------------ */
export const WHEEL_CENTER = new THREE.Vector3(0.03, 0.885, DZ);
function SteeringWheel() {
  const { stateRef, bodyRef } = useScene();
  const rot = useRef<THREE.Group>(null!);
  const stalk = useRef<THREE.Group>(null!);
  const logo = useMemo(() => vwLogo(), []);
  const r = useMemo(() => rBadge(), []);
  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    // kb. 14:1 áttétel (progresszív kormány)
    rot.current.rotation.z = -s.steerAngle * 11;
    const ind = bodyRef.current?.indicator ?? 0;
    stalk.current.rotation.x = ind * 0.18;
  });
  const rimR = 0.185;
  return (
    <group position={[WHEEL_CENTER.x, WHEEL_CENTER.y, WHEEL_CENTER.z]} rotation={[0, -Math.PI / 2, 0]}>
      <group rotation={[-0.42, 0, 0]}>
        {/* kormányoszlop burkolat */}
        <mesh position={[0, -0.02, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.06, 0.2, 16]} />
          <Mat c="#111113" r={0.7} ghost />
        </mesh>
        {/* irányjelző kar */}
        <group ref={stalk} position={[-0.07, -0.005, -0.06]}>
          <mesh position={[-0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.007, 0.006, 0.12, 8]} />
            <Mat c="#1f1f22" r={0.5} ghost />
          </mesh>
        </group>
        <mesh position={[0.13, -0.005, -0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.007, 0.006, 0.12, 8]} />
          <Mat c="#1f1f22" r={0.5} ghost />
        </mesh>
        <group ref={rot}>
          {/* kormánykoszorú (perforált bőr) */}
          <mesh>
            <torusGeometry args={[rimR, 0.017, 14, 64]} />
            <Mat c="#141416" r={0.75} ghost />
          </mesh>
          {/* lapos alsó rész */}
          <mesh position={[0, -rimR + 0.012, 0]}>
            <boxGeometry args={[0.16, 0.024, 0.032]} />
            <Mat c="#141416" r={0.75} ghost />
          </mesh>
          {/* kék varrás felül (12 órás jelölés) */}
          <mesh position={[0, rimR, 0.012]}>
            <boxGeometry args={[0.03, 0.01, 0.012]} />
            <Mat c={BLUE} emissive={BLUE} ei={0.4} ghost />
          </mesh>
          {/* küllők */}
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.105, -0.01, -0.005]}>
              <boxGeometry args={[0.15, 0.05, 0.016]} />
              <Mat c="#1f2023" m={0.5} r={0.35} ghost />
            </mesh>
          ))}
          <mesh position={[0, -0.12, -0.005]}>
            <boxGeometry args={[0.05, 0.12, 0.016]} />
            <Mat c="#a1a1aa" m={0.9} r={0.25} ghost />
          </mesh>
          <mesh position={[0, -0.135, 0.004]}>
            <planeGeometry args={[0.035, 0.035]} />
            <meshStandardMaterial map={r} transparent />
          </mesh>
          {/* légzsák + VW embléma */}
          <RoundedBox args={[0.11, 0.085, 0.035]} radius={0.015} position={[0, 0, 0.005]}>
            <Mat c="#18181b" r={0.7} ghost />
          </RoundedBox>
          <mesh position={[0, 0, 0.026]}>
            <circleGeometry args={[0.024, 24]} />
            <meshStandardMaterial map={logo} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------ pedálok ------------------------------ */
function Pedals() {
  const { controlsRef } = useScene();
  const refs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;
    refs[0].current.rotation.z = c.clutch * 0.42;
    refs[1].current.rotation.z = c.brake * 0.32;
    refs[2].current.rotation.z = c.throttle * 0.3;
  });
  const P = [
    { z: DZ - 0.15, w: 0.06, c: "#3f3f46" },
    { z: DZ - 0.01, w: 0.085, c: "#3f3f46" },
    { z: DZ + 0.13, w: 0.05, c: "#3f3f46" },
  ];
  return (
    <group>
      {P.map((p, i) => (
        <group key={i} ref={refs[i]} position={[0.6, 0.58, p.z]}>
          <mesh position={[-0.02, -0.15, 0]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[0.014, 0.3, 0.014]} />
            <Mat c="#27272a" m={0.6} ghost />
          </mesh>
          <mesh position={[-0.06, -0.3, 0]} rotation={[0, 0, 0.35]}>
            <boxGeometry args={[0.012, i === 2 ? 0.11 : 0.065, p.w]} />
            <Mat c="#a1a1aa" m={0.95} r={0.25} ghost />
          </mesh>
        </group>
      ))}
      {/* lábtámasz */}
      <mesh position={[0.5, 0.3, DZ - 0.27]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.012, 0.16, 0.06]} />
        <Mat c="#a1a1aa" m={0.95} r={0.25} ghost />
      </mesh>
    </group>
  );
}

/* ------------------------------ váltókar (húzható) ------------------------------ */
const LEVER_PIVOT = new THREE.Vector3(0.02, 0.47, -0.05);
const LEVER_LEN = 0.29;
const GX = 0.045; // előre-hátra kitérés (m)
const GZ = 0.03; // oldalirányú kitérés oszloponként (m)

/** Fokozat → kulissza-pozíció (u = oszlop, v = előre/hátra) */
export function gatePos(g: Gear): { u: number; v: number } {
  switch (g) {
    case -1:
      return { u: -2, v: 1 };
    case 1:
      return { u: -1, v: 1 };
    case 2:
      return { u: -1, v: -1 };
    case 3:
      return { u: 0, v: 1 };
    case 4:
      return { u: 0, v: -1 };
    case 5:
      return { u: 1, v: 1 };
    case 6:
      return { u: 1, v: -1 };
    default:
      return { u: 0, v: 0 };
  }
}

function gearAt(u: number, v: number): Gear | null {
  const col = Math.round(u);
  if (Math.abs(v) < 0.85) return null;
  if (col === -2) return v > 0 ? -1 : null;
  if (col === -1) return v > 0 ? 1 : 2;
  if (col === 0) return v > 0 ? 3 : 4;
  if (col === 1) return v > 0 ? 5 : 6;
  return null;
}

function Shifter() {
  const { controlsRef, leverRef, onInteract, setOrbitEnabled } = useScene();
  const lever = useRef<THREE.Group>(null!);
  const pose = useRef({ u: 0, v: 0 });
  const drag = useRef<{ x: number; y: number; u: number; v: number; sentGear: Gear | null } | null>(null);
  const knobTex = useMemo(
    () =>
      canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = "#111";
        g.fillRect(0, 0, w, h);
        g.fillStyle = "#e5e7eb";
        g.font = "bold 22px Arial";
        g.textAlign = "center";
        const cols = [22, 50, 78, 106];
        g.fillText("R", cols[0], 30);
        g.fillText("1", cols[1], 30);
        g.fillText("3", cols[2], 30);
        g.fillText("5", cols[3], 30);
        g.fillText("2", cols[1], 110);
        g.fillText("4", cols[2], 110);
        g.fillText("6", cols[3], 110);
        g.strokeStyle = "#e5e7eb";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cols[0], 40);
        g.lineTo(cols[0], 64);
        g.lineTo(cols[3], 64);
        cols.slice(1).forEach((c) => {
          g.moveTo(c, 40);
          g.lineTo(c, 92);
        });
        g.stroke();
        g.fillStyle = BLUE;
        g.fillRect(0, 122, w, 6);
      }),
    [],
  );
  useFrame((_, dtRaw) => {
    const c = controlsRef.current;
    const L = leverRef.current;
    if (!c || !L) return;
    const dt = Math.min(0.1, dtRaw);
    if (!L.dragging) {
      const t = gatePos(c.gear);
      const k = 1 - Math.exp(-dt * 14);
      // kapcsoláskor előbb középre (üres), aztán az új oszlopba
      const p = pose.current;
      if (Math.abs(p.u - t.u) > 0.05 && Math.abs(p.v) > 0.1) p.v += (0 - p.v) * k;
      else {
        p.u += (t.u - p.u) * k;
        p.v += (t.v - p.v) * k;
      }
      L.u = p.u;
      L.v = p.v;
    } else {
      pose.current.u = L.u;
      pose.current.v = L.v;
    }
    const dx = pose.current.v * GX;
    const dz = pose.current.u * GZ + 0.012;
    lever.current.rotation.set(Math.asin(dz / LEVER_LEN), 0, -Math.asin(dx / LEVER_LEN), "XZY");
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const L = leverRef.current;
    if (!L) return;
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    L.dragging = true;
    setOrbitEnabled(false);
    drag.current = { x: e.clientX, y: e.clientY, u: pose.current.u, v: pose.current.v, sentGear: controlsRef.current?.gear ?? 0 };
    document.body.style.cursor = "grabbing";
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    const L = leverRef.current;
    if (!d || !L) return;
    e.stopPropagation();
    // vezetőülésből nézve: egér jobbra = kar jobbra (+z), egér fel = kar előre
    let u = d.u + (e.clientX - d.x) / 55;
    let v = d.v - (e.clientY - d.y) / 45;
    v = THREE.MathUtils.clamp(v, -1, 1);
    if (Math.abs(v) > 0.2) {
      // fokozat-sávban csak előre-hátra mozoghat
      const col = THREE.MathUtils.clamp(Math.round(L.u), -2, 1);
      u = col;
      if (col === -2 && v < 0) v = 0;
    } else u = THREE.MathUtils.clamp(u, -2, 1);
    L.u = u;
    L.v = v;
    const g = gearAt(u, v);
    if (g !== null && g !== d.sentGear) {
      d.sentGear = g;
      onInteract({ type: "shift", gear: g });
    } else if (g === null && Math.abs(v) < 0.5 && d.sentGear !== 0) {
      d.sentGear = 0;
      onInteract({ type: "shift", gear: 0 });
    }
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    const L = leverRef.current;
    if (!drag.current || !L) return;
    e.stopPropagation();
    drag.current = null;
    L.dragging = false;
    setOrbitEnabled(true);
    document.body.style.cursor = "";
  };
  return (
    <group position={[LEVER_PIVOT.x, LEVER_PIVOT.y, LEVER_PIVOT.z]}>
      <group ref={lever}>
        <mesh position={[0, LEVER_LEN / 2, 0]}>
          <cylinderGeometry args={[0.007, 0.009, LEVER_LEN, 10]} />
          <Mat c="#a1a1aa" m={0.9} r={0.3} />
        </mesh>
        {/* gömb alakú gombfej, alumínium betéttel */}
        <group position={[0, LEVER_LEN, 0]}>
          <mesh onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerOver={() => (document.body.style.cursor = "grab")} onPointerOut={() => !drag.current && (document.body.style.cursor = "")}>
            <sphereGeometry args={[0.033, 24, 16]} />
            <Mat c="#18181b" r={0.55} />
          </mesh>
          <mesh position={[0, 0.0305, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
            <circleGeometry args={[0.022, 24]} />
            <meshBasicMaterial map={knobTex} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.03, 0]}>
            <cylinderGeometry args={[0.02, 0.016, 0.02, 16]} />
            <Mat c="#d4d4d8" m={1} r={0.2} />
          </mesh>
        </group>
      </group>
      {/* bőr harmonika (szoknya) */}
      <mesh position={[0, 0.1, 0]}>
        <coneGeometry args={[0.065, 0.13, 16, 3, true]} />
        <Mat c="#111113" r={0.9} side={THREE.DoubleSide} ghost />
      </mesh>
    </group>
  );
}

/* ------------------------------ középkonzol ------------------------------ */
function Console() {
  const { onInteract, controlsRef, stateRef } = useScene();
  const L = useMemo(
    () => ({
      start: textLabel("START\nSTOP", "#e5e7eb", "#18181b", "bold 30px Arial"),
      epb: textLabel("(P)", "#ef4444", "#18181b", "bold 54px Arial"),
      hold: textLabel("AUTO\nHOLD", "#e5e7eb", "#18181b", "bold 30px Arial"),
      mode: textLabel("MODE", "#e5e7eb", "#18181b", "bold 36px Arial"),
      belt: textLabel("ÖV", "#e5e7eb", "#18181b", "bold 50px Arial"),
    }),
    [],
  );
  return (
    <group>
      {/* konzol test */}
      <mesh position={[-0.1, 0.4, -0.04]}>
        <boxGeometry args={[0.85, 0.36, 0.22]} />
        <Mat c="#141416" r={0.8} ghost ghostOpacity={0.06} />
      </mesh>
      <mesh position={[0.22, 0.6, -0.04]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.3, 0.05, 0.22]} />
        <Mat c="#151518" r={0.8} ghost ghostOpacity={0.06} />
      </mesh>
      <mesh position={[-0.1, 0.585, -0.04]}>
        <boxGeometry args={[0.56, 0.012, 0.2]} />
        <Mat c="#141417" m={0.2} r={0.7} ghost ghostOpacity={0.06} />
      </mesh>
      {/* könyöklő */}
      <RoundedBox args={[0.3, 0.07, 0.2]} radius={0.03} position={[-0.5, 0.64, -0.04]}>
        <Mat c="#18181b" r={0.85} ghost ghostOpacity={0.06} />
      </RoundedBox>
      {/* Start/Stop gomb (a váltó előtt) */}
      <Button position={[0.14, 0.6, 0.03]} rotation={[0, 0, 0.18]} size={[0.03, 0.012, 0.03]} color="#111" label={L.start} onPress={() => onInteract({ type: "startStop" })} lit={() => (stateRef.current?.running ? 0.15 : controlsRef.current?.ignition ? 0.5 : 0)} />
      {/* EPB kapcsoló, Auto Hold, vezetési mód (a váltó mögött) */}
      <Button position={[-0.16, 0.596, -0.08]} size={[0.04, 0.012, 0.03]} color="#111" label={L.epb} onPress={() => onInteract({ type: "epb", dir: stateRef.current?.epb === "released" ? 1 : -1 })} lit={() => (stateRef.current?.epb === "applied" ? 0.6 : 0)} />
      <Button position={[-0.16, 0.596, -0.035]} size={[0.03, 0.012, 0.03]} color="#111" label={L.hold} onPress={() => onInteract({ type: "autoHold" })} lit={() => (controlsRef.current?.autoHold ? 0.5 : 0)} />
      <Button position={[-0.16, 0.596, 0.01]} size={[0.03, 0.012, 0.03]} color="#111" label={L.mode} onPress={() => onInteract({ type: "mode" })} lit={() => (controlsRef.current?.mode === "race" ? 0.6 : 0)} />
      <Button position={[-0.21, 0.596, -0.035]} size={[0.025, 0.012, 0.03]} color="#111" label={L.belt} onPress={() => onInteract({ type: "seatbelt" })} lit={() => (controlsRef.current?.seatbelt ? 0 : 0.6)} />
      {/* pohártartók */}
      {[-0.08, 0.0].map((z) => (
        <mesh key={z} position={[-0.3, 0.587, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.035, 20]} />
          <Mat c="#050505" r={0.9} ghost />
        </mesh>
      ))}
      <Shifter />
    </group>
  );
}

/* ------------------------------ ülések ------------------------------ */
function Seat({ z, driver }: { z: number; driver?: boolean }) {
  const r = useMemo(() => rBadge(), []);
  const H = 0.43;
  return (
    <group position={[-0.28, 0, z]}>
      {/* sín + talp */}
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.4]} />
        <Mat c="#18181b" m={0.4} ghost />
      </mesh>
      {/* ülőlap */}
      <RoundedBox args={[0.5, 0.1, 0.36]} radius={0.04} position={[0, H, 0]}>
        <Mat c="#202024" r={0.9} ghost ghostOpacity={0.12} />
      </RoundedBox>
      {[-1, 1].map((sd) => (
        <RoundedBox key={sd} args={[0.48, 0.13, 0.08]} radius={0.035} position={[0, H + 0.025, sd * 0.215]}>
          <Mat c="#111113" r={0.7} ghost ghostOpacity={0.12} />
        </RoundedBox>
      ))}
      {/* háttámla (20° hátradöntve) */}
      <group position={[-0.24, H + 0.03, 0]} rotation={[0, 0, 0.36]}>
        <RoundedBox args={[0.1, 0.6, 0.38]} radius={0.04} position={[0, 0.3, 0]}>
          <Mat c="#202024" r={0.9} ghost ghostOpacity={0.12} />
        </RoundedBox>
        {[-1, 1].map((sd) => (
          <RoundedBox key={sd} args={[0.13, 0.5, 0.08]} radius={0.035} position={[0.03, 0.27, sd * 0.225]}>
            <Mat c="#111113" r={0.7} ghost ghostOpacity={0.12} />
          </RoundedBox>
        ))}
        {/* kék varrás */}
        <mesh position={[0.051, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.012, 0.5]} />
          <Mat c={BLUE} emissive={BLUE} ei={0.3} ghost />
        </mesh>
        {/* fejtámla */}
        <RoundedBox args={[0.09, 0.2, 0.27]} radius={0.04} position={[0.0, 0.7, 0]}>
          <Mat c="#202024" r={0.9} ghost ghostOpacity={0.12} />
        </RoundedBox>
        <mesh position={[0.052, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.07, 0.07]} />
          <meshStandardMaterial map={r} transparent />
        </mesh>
      </group>
      {driver && null}
    </group>
  );
}

function RearBench() {
  return (
    <group position={[-1.12, 0, 0]}>
      <RoundedBox args={[0.5, 0.12, 1.3]} radius={0.04} position={[0, 0.45, 0]}>
        <Mat c="#202024" r={0.9} ghost ghostOpacity={0.1} />
      </RoundedBox>
      <group position={[-0.24, 0.5, 0]} rotation={[0, 0, 0.3]}>
        <RoundedBox args={[0.1, 0.55, 1.3]} radius={0.04} position={[0, 0.27, 0]}>
          <Mat c="#202024" r={0.9} ghost ghostOpacity={0.1} />
        </RoundedBox>
        {[-0.45, 0, 0.45].map((z) => (
          <RoundedBox key={z} args={[0.08, 0.14, 0.24]} radius={0.03} position={[0, 0.62, z]}>
            <Mat c="#202024" r={0.9} ghost ghostOpacity={0.1} />
          </RoundedBox>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------ biztonsági öv ------------------------------ */
function Seatbelt() {
  const { controlsRef } = useScene();
  const on = useRef<THREE.Group>(null!);
  const off = useRef<THREE.Group>(null!);
  useFrame(() => {
    const b = controlsRef.current?.seatbelt ?? true;
    on.current.visible = b;
    off.current.visible = !b;
  });
  const strap = (a: [number, number, number], b: [number, number, number]) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const d = B.clone().sub(A);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return (
      <mesh position={A.clone().add(B).multiplyScalar(0.5)} quaternion={q}>
        <boxGeometry args={[0.045, d.length(), 0.004]} />
        <Mat c="#0f0f12" r={0.9} ghost />
      </mesh>
    );
  };
  return (
    <group>
      <group ref={on}>
        {strap([-0.5, 1.18, DZ - 0.24], [-0.24, 0.92, DZ - 0.05])}
        {strap([-0.24, 0.92, DZ - 0.05], [-0.18, 0.56, DZ + 0.19])}
        {strap([-0.2, 0.55, DZ - 0.24], [-0.18, 0.56, DZ + 0.19])}
      </group>
      <group ref={off}>{strap([-0.5, 1.18, DZ - 0.32], [-0.52, 0.5, DZ - 0.33])}</group>
    </group>
  );
}

export default function Interior() {
  return (
    <group name="Interior">
      <Dashboard />
      <SteeringWheel />
      <Pedals />
      <Console />
      <Seat z={DZ} driver />
      <Seat z={-DZ} />
      <RearBench />
      <Seatbelt />
    </group>
  );
}

export { blinkOn };
