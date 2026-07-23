import * as THREE from "three";
import type { EnemyType } from "../combat-types";

export type InitialSurfaceThreat = {
  position: THREE.Vector3;
  threatType: EnemyType;
};

export const DEFAULT_SURFACE_SCENARIO: readonly InitialSurfaceThreat[] = [
  { position: new THREE.Vector3(-85, 18, -210), threatType: "P-500" as EnemyType },
  { position: new THREE.Vector3(0, 28, -240), threatType: "P-500" as EnemyType },
  { position: new THREE.Vector3(80, 14, -220), threatType: "P-500" as EnemyType },
];

export function initialSurfaceThreats(): InitialSurfaceThreat[] {
  return DEFAULT_SURFACE_SCENARIO.map((threat) => ({
    position: threat.position.clone(),
    threatType: threat.threatType,
  }));
}
