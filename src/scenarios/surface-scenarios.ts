import * as THREE from "three";
import type { EnemyType } from "../combat-types";
import type { ShipDefinition } from "../ship-types";

export type InitialSurfaceThreat = {
  position: THREE.Vector3;
  threatType: EnemyType;
};

export type SurfaceScenarioConfig = {
  defenderPosition: THREE.Vector3;
  initialSpeedKnots: number;
  radarEnabled: boolean;
  autoFire: boolean;
  shipEcmEnabled: boolean;
  maxSamChannels: number;
  maxIlluminators: number;
  doctrine: "SINGLE" | "DOUBLE" | "SSLS";
  chaffEnabled: boolean;
  ecmEnabled: boolean;
  platformDecoysEnabled: boolean;
  srbocEnabled: boolean;
  srbocRounds: number;
  shipEcmStrength: number;
  shipEcmBurnThroughRange: number;
};

export const DEFAULT_SURFACE_CONFIG: SurfaceScenarioConfig = {
  defenderPosition: new THREE.Vector3(0, 0, 40),
  initialSpeedKnots: 0,
  radarEnabled: true,
  autoFire: true,
  shipEcmEnabled: true,
  maxSamChannels: 3,
  maxIlluminators: 2,
  doctrine: "SSLS",
  chaffEnabled: true,
  ecmEnabled: true,
  platformDecoysEnabled: true,
  srbocEnabled: true,
  srbocRounds: 12,
  shipEcmStrength: 0.62,
  shipEcmBurnThroughRange: 72,
};

export function initialSurfaceLoadout(ship: ShipDefinition) {
  return {
    rim67: ship.ammo.rim67,
    sm2mr: ship.ammo.sm2mr,
    sm2er: ship.ammo.sm2er,
    ciws: ship.ammo.ciws,
    surfaceStrike: ship.surfaceStrike?.magazine ?? 0,
  };
}

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
