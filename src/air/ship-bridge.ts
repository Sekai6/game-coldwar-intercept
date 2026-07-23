import * as THREE from "three";
import type { TargetableEntity } from "../combat-entity";

export type AirShipBridgeDependencies = {
  bluePosition: THREE.Vector3;
  blueVelocity: THREE.Vector3;
  blueRcs: number;
  blueAlive: boolean;
  redShip: TargetableEntity | null;
  applyBlueDamage: (damage: number, hitPoint: THREE.Vector3) => void;
};

export function createAirShipBridge(deps: AirShipBridgeDependencies) {
  const blueShip: TargetableEntity = {
    id: "blue-surface-ship",
    side: "blue",
    kind: "ship",
    position: deps.bluePosition,
    velocity: deps.blueVelocity,
    radarCrossSection: deps.blueRcs,
    infraredSignature: 0.8,
    alive: deps.blueAlive,
    applyDamage: deps.applyBlueDamage,
  };
  return {
    blueShip,
    redShip: deps.redShip,
  };
}
