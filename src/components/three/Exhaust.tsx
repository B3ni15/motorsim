"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useScene } from "./context";
import { engineToCar, TURBO_LOCAL } from "./Powertrain";
import { LABEL } from "./Chassis";
import { Html } from "@react-three/drei";

/** Végcsövek (autó koordináták): Golf R – 2-2 cső mindkét oldalon */
export const TIPS = [-0.61, -0.47, 0.47, 0.61].map((z) => new THREE.Vector3(-2.09, 0.265, z));

const Y = 0.19;

function tube(pts: THREE.Vector3[], r: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35), 120, r, 12, false);
}

export default function Exhaust() {
  const { stateRef, xray } = useScene();
  const hotMat = useRef<THREE.MeshStandardMaterial>(null!);
  const catMat = useRef<THREE.MeshStandardMaterial>(null!);
  const catLabel = useRef<HTMLDivElement>(null!);
  const tailLabel = useRef<HTMLDivElement>(null!);
  const flames = useRef<THREE.Group>(null!);

  const geoms = useMemo(() => {
    const t0 = engineToCar(TURBO_LOCAL.x - 0.07, TURBO_LOCAL.y - 0.02, TURBO_LOCAL.z - 0.02);
    const down = tube([t0, new THREE.Vector3(t0.x - 0.06, t0.y - 0.12, t0.z - 0.04), new THREE.Vector3(1.0, 0.27, -0.06), new THREE.Vector3(0.93, Y + 0.01, -0.1)], 0.033);
    const mid = tube(
      [new THREE.Vector3(0.93, Y + 0.01, -0.1), new THREE.Vector3(0.6, Y, -0.11), new THREE.Vector3(0.0, Y, -0.12), new THREE.Vector3(-0.55, Y, -0.12), new THREE.Vector3(-0.85, Y, -0.12)],
      0.03,
    );
    const branch = (sd: number) =>
      tube(
        [
          new THREE.Vector3(-0.85, Y, -0.12),
          new THREE.Vector3(-1.05, Y - 0.01, sd * 0.22 - 0.03),
          new THREE.Vector3(-1.32, Y - 0.025, sd * 0.33),
          new THREE.Vector3(-1.58, Y + 0.02, sd * 0.4),
          new THREE.Vector3(-1.66, Y + 0.05, sd * 0.47),
        ],
        0.026,
      );
    const tipPipe = (tip: THREE.Vector3) => tube([new THREE.Vector3(-1.92, tip.y, tip.z * 0.92), new THREE.Vector3(-2.0, tip.y, tip.z), new THREE.Vector3(tip.x + 0.01, tip.y, tip.z)], 0.024);
    return { down, mid, left: branch(-1), right: branch(1), tips: TIPS.map(tipPipe) };
  }, []);

  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const glow = THREE.MathUtils.clamp((s.exhaustC - 420) / 500, 0, 1);
    hotMat.current.emissiveIntensity = glow * 1.4;
    hotMat.current.color.setRGB(0.32 + glow * 0.45, 0.32 - glow * 0.12, 0.34 - glow * 0.25);
    const cg = THREE.MathUtils.clamp((s.catTempC - 420) / 500, 0, 1);
    catMat.current.emissiveIntensity = cg * 1.3;
    if (catLabel.current) catLabel.current.textContent = `katalizátor + OPF ${s.catTempC.toFixed(0)} °C${s.catTempC > 250 ? " · aktív" : " · hideg"}`;
    if (tailLabel.current) tailLabel.current.textContent = `4 végcső ${s.tailpipeC.toFixed(0)} °C · ${s.exhaustGs.toFixed(0)} g/s`;
    // durrogás: túlfutáskor (Race módban gyakrabban) lángnyelv a végcsövekből
    const popChance = s.overrun && s.rpm > 2500 ? 0.06 : 0;
    flames.current.children.forEach((f) => {
      f.visible = Math.random() < popChance;
      if (f.visible) f.scale.setScalar(0.6 + Math.random() * 0.8);
    });
  });

  const steel = <meshStandardMaterial color="#6b7280" metalness={0.75} roughness={0.4} transparent={xray} opacity={xray ? 0.85 : 1} />;
  return (
    <group name="Exhaust">
      <mesh geometry={geoms.down}>
        <meshStandardMaterial ref={hotMat} color="#57534e" emissive="#ff3300" emissiveIntensity={0} metalness={0.6} roughness={0.5} />
      </mesh>
      {/* katalizátor + benzines részecskeszűrő (OPF) */}
      <mesh position={[0.78, Y, -0.105]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.065, 0.26, 20]} />
        <meshStandardMaterial ref={catMat} color="#9ca3af" emissive="#ff6a00" emissiveIntensity={0} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.46, Y, -0.11]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.26, 20]} />
        <meshStandardMaterial color="#a1a1aa" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh geometry={geoms.mid}>{steel}</mesh>
      {/* középső dob */}
      <mesh position={[-0.33, Y, -0.12]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.75]}>
        <cylinderGeometry args={[0.075, 0.075, 0.4, 20]} />
        {steel}
      </mesh>
      <mesh geometry={geoms.left}>{steel}</mesh>
      <mesh geometry={geoms.right}>{steel}</mesh>
      {/* hátsó dobok (bal + jobb) */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[-1.79, 0.245, sd * 0.53]}>
          <boxGeometry args={[0.28, 0.13, 0.3]} />
          {steel}
        </mesh>
      ))}
      {geoms.tips.map((g, i) => (
        <mesh key={i} name="Tip-pipe" geometry={g}>
          {steel}
        </mesh>
      ))}
      {/* króm végcső-díszek */}
      {TIPS.map((t, i) => (
        <group key={i} name="Tip" position={[t.x, t.y, t.z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.046, 0.046, 0.06, 24, 1, true]} />
            <meshStandardMaterial color="#e5e7eb" metalness={1} roughness={0.12} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <circleGeometry args={[0.044, 24]} />
            <meshStandardMaterial color="#0a0a0a" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <group ref={flames} name="Flame">
        {TIPS.map((t, i) => (
          <mesh key={i} position={[t.x - 0.08, t.y, t.z]} visible={false}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.85} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <Html position={[0.62, Y - 0.11, -0.1]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={catLabel} className={`${LABEL} sim-detail text-orange-200`}>
          katalizátor
        </div>
      </Html>
      <Html position={[-1.95, 0.12, 0.55]} center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={tailLabel} className={`${LABEL} sim-detail text-slate-300`}>
          végcső
        </div>
      </Html>
    </group>
  );
}

/** Füst-részecskék a világ koordinátáiban (a kocsi mögött maradnak). */
export function ExhaustSmoke() {
  const { stateRef } = useScene();
  const points = useRef<THREE.Points>(null!);
  const NP = 600;
  const particles = useMemo(() => {
    const pos = new Float32Array(NP * 3);
    const life = new Float32Array(NP);
    const vel = new Float32Array(NP * 3);
    const size = new Float32Array(NP);
    const alpha = new Float32Array(NP);
    for (let i = 0; i < NP; i++) pos[i * 3 + 1] = -100;
    return { pos, life, vel, size, alpha, next: 0, acc: 0 };
  }, []);
  const material = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, color: { value: new THREE.Color("#cbd5e1") } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; varying float vA;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec3 color; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * vA); }`,
      transparent: true,
      depthWrite: false,
    });
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(particles.pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(particles.size, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(particles.alpha, 1));
    return g;
  }, [particles]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dtFrame) => {
    const s = stateRef.current;
    if (!s) return;
    const dt = Math.min(0.1, dtFrame);
    const p = particles;
    m.makeRotationY(s.heading).setPosition(s.posX, 0, s.posZ);
    const fwd = new THREE.Vector3(Math.cos(s.heading), 0, -Math.sin(s.heading));
    const cold = THREE.MathUtils.clamp((70 - s.tailpipeC) / 50, 0, 1);
    const gasket = s.dmg.headGasket > 0.2 ? Math.min(1, s.dmg.headGasket) : 0;
    const oily = Math.max(s.dmg.turbo, ...s.dmg.pistons.map((v) => v * 0.8));
    // szín: hideg/hengerfej-tömítés → fehér pára, olajégés → kékes, egyébként halvány
    material.uniforms.color.value.setRGB(0.78 + cold * 0.2 - oily * 0.25, 0.8 + cold * 0.18 - oily * 0.12, 0.84 + cold * 0.15);
    const baseAlpha = 0.06 + cold * 0.35 + gasket * 0.6 + oily * 0.45 + (s.running && s.request > 0.9 && s.rpm < 2500 ? 0.1 : 0);
    const pulse = 1 + 0.9 * Math.max(0, Math.sin(2 * s.crank));
    const rate = s.exhaustGs > 0.1 ? (10 + s.exhaustGs * 0.9) * pulse : 0;
    p.acc += rate * dt;
    while (p.acc >= 1) {
      p.acc -= 1;
      const i = p.next;
      p.next = (p.next + 1) % NP;
      const tip = TIPS[i % 4];
      tmp.copy(tip).applyMatrix4(m);
      p.life[i] = 1;
      p.pos[i * 3] = tmp.x;
      p.pos[i * 3 + 1] = tmp.y + (Math.random() - 0.5) * 0.02;
      p.pos[i * 3 + 2] = tmp.z;
      const sp = 0.8 + Math.min(4, s.exhaustGs / 25) + Math.random() * 0.4;
      p.vel[i * 3] = -fwd.x * sp + fwd.x * s.speed;
      p.vel[i * 3 + 1] = 0.1 + Math.random() * 0.15;
      p.vel[i * 3 + 2] = -fwd.z * sp + fwd.z * s.speed + (Math.random() - 0.5) * 0.2;
      p.size[i] = 0.05;
      p.alpha[i] = baseAlpha;
    }
    for (let i = 0; i < NP; i++) {
      if (p.life[i] <= 0) continue;
      p.life[i] -= dt * (0.45 - gasket * 0.15);
      if (p.life[i] <= 0) {
        p.pos[i * 3 + 1] = -100;
        p.alpha[i] = 0;
        continue;
      }
      const drag = 1 - 2.5 * dt;
      p.vel[i * 3] *= drag;
      p.vel[i * 3 + 2] *= drag;
      p.vel[i * 3 + 1] += 0.25 * dt;
      p.pos[i * 3] += p.vel[i * 3] * dt;
      p.pos[i * 3 + 1] += p.vel[i * 3 + 1] * dt;
      p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
      p.size[i] += 0.35 * dt;
      p.alpha[i] = baseAlpha * p.life[i];
    }
    const g = points.current.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  });
  return <points ref={points} geometry={geom} material={material} frustumCulled={false} />;
}
