"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { asphalt } from "./textures";
import { useScene } from "./context";

const TILE = 8; // m, aszfalt-textúra csempe
const SIZE = 480;

/**
 * Végtelen próbapálya: a talaj a kocsit követi (csempényi lépésekben, így a textúra folytonos),
 * a világ X tengelye mentén út felfestéssel, bóják és oszlopok a sebességérzethez.
 */
export default function World() {
  const { stateRef } = useScene();
  const ground = useRef<THREE.Mesh>(null!);
  const dashes = useRef<THREE.InstancedMesh>(null!);
  const posts = useRef<THREE.InstancedMesh>(null!);
  const trees = useRef<THREE.InstancedMesh>(null!);
  const edges = useRef<THREE.Group>(null!);
  const tex = useMemo(() => {
    const t = asphalt();
    t.repeat.set(SIZE / TILE, SIZE / TILE);
    return t;
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const NDASH = 40;
  const NPOST = 48;
  const NTREE = 60;
  const treeSeeds = useMemo(() => Array.from({ length: NTREE }, (_, i) => ({ z: (i % 2 ? 1 : -1) * (22 + ((i * 37) % 30)), off: (i * 53) % 97, s: 0.8 + ((i * 17) % 10) / 12 })), []);

  useFrame(() => {
    const s = stateRef.current;
    if (!s) return;
    const cx = s.posX;
    const cz = s.posZ;
    ground.current.position.set(Math.round(cx / TILE) * TILE, 0, Math.round(cz / TILE) * TILE);
    edges.current.position.x = Math.round(cx / 50) * 50;
    // szaggatott felezővonal: 3 m vonal, 9 m-enként
    const base = Math.floor(cx / 9) * 9 - (NDASH / 2) * 9;
    for (let i = 0; i < NDASH; i++) {
      tmp.position.set(base + i * 9, 0.004, 0);
      tmp.rotation.set(-Math.PI / 2, 0, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      dashes.current.setMatrixAt(i, tmp.matrix);
    }
    dashes.current.instanceMatrix.needsUpdate = true;
    // terelőoszlopok 25 m-enként
    const pb = Math.floor(cx / 25) * 25 - (NPOST / 4) * 25;
    for (let i = 0; i < NPOST; i++) {
      const k = Math.floor(i / 2);
      tmp.position.set(pb + k * 25, 0.5, i % 2 ? 7.2 : -7.2);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      posts.current.setMatrixAt(i, tmp.matrix);
    }
    posts.current.instanceMatrix.needsUpdate = true;
    const tb = Math.floor(cx / 97) * 97;
    for (let i = 0; i < NTREE; i++) {
      const sd = treeSeeds[i];
      const k = Math.floor(i / 2) - NTREE / 4;
      tmp.position.set(tb + k * 16 + sd.off * 0.1, 3 * sd.s, sd.z);
      tmp.scale.setScalar(sd.s);
      tmp.updateMatrix();
      trees.current.setMatrixAt(i, tmp.matrix);
    }
    trees.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0} color="#9ca3af" />
      </mesh>
      {/* útszél vonalak */}
      <group ref={edges}>
        {[-6, 6].map((z) => (
          <mesh key={z} position={[0, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[600, 0.15]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.8} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={dashes} args={[undefined, undefined, NDASH]} receiveShadow frustumCulled={false}>
        <planeGeometry args={[3, 0.13]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[undefined, undefined, NPOST]} castShadow frustumCulled={false}>
        <boxGeometry args={[0.12, 1.0, 0.12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={trees} args={[undefined, undefined, NTREE]} castShadow frustumCulled={false}>
        <coneGeometry args={[1.6, 6, 8]} />
        <meshStandardMaterial color="#14532d" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
