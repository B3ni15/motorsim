"use client";

import * as THREE from "three";
import { useScene } from "./context";

/**
 * Szabványos anyag, amely röntgen (skeleton) nézetben áttetszővé válik, ha `ghost` be van állítva.
 */
export function Mat({
  c,
  m = 0,
  r = 0.6,
  ghost = false,
  ghostOpacity = 0.1,
  emissive,
  ei = 0,
  side,
  opacity,
  flat,
}: {
  c: string;
  m?: number;
  r?: number;
  ghost?: boolean;
  ghostOpacity?: number;
  emissive?: string;
  ei?: number;
  side?: THREE.Side;
  opacity?: number;
  flat?: boolean;
}) {
  const { xray } = useScene();
  const g = ghost && xray;
  const transparent = g || opacity !== undefined;
  return (
    <meshStandardMaterial
      color={c}
      metalness={m}
      roughness={r}
      transparent={transparent}
      opacity={g ? ghostOpacity : (opacity ?? 1)}
      depthWrite={!transparent}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={ei}
      side={side ?? THREE.FrontSide}
      flatShading={flat}
    />
  );
}
