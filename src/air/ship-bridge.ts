import * as THREE from "three";
import type { TargetableEntity } from "../combat-entity";
import type { AirScenarioContext } from "./types";

export type AirShipBridgeDependencies = {
  bluePosition: THREE.Vector3;
  blueVelocity: THREE.Vector3;
  blueRcs: number;
  blueAlive: boolean;
  redShip: TargetableEntity | null;
  applyBlueDamage: (damage: number, hitPoint: THREE.Vector3) => void;
};

export type ShipTargetDependencies = {
  id: string;
  side: "blue" | "red";
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radarCrossSection: number;
  alive: boolean;
  applyDamage: (damage: number, hitPoint: THREE.Vector3) => void;
};

export function createShipTarget(deps: ShipTargetDependencies): TargetableEntity {
  return {
    id: deps.id,
    side: deps.side,
    kind: "ship",
    position: deps.position,
    velocity: deps.velocity,
    radarCrossSection: deps.radarCrossSection,
    infraredSignature: 0.8,
    alive: deps.alive,
    applyDamage: deps.applyDamage,
  };
}

export function createAirShipBridge(deps: AirShipBridgeDependencies) {
  const blueShip = createShipTarget({
    id: "blue-surface-ship",
    side: "blue",
    position: deps.bluePosition,
    velocity: deps.blueVelocity,
    radarCrossSection: deps.blueRcs,
    alive: deps.blueAlive,
    applyDamage: deps.applyBlueDamage,
  });
  return {
    blueShip,
    redShip: deps.redShip,
  };
}

export type AirScenarioBridgeSnapshot = AirShipBridgeDependencies & {
  countermeasures?: AirScenarioContext["countermeasures"];
  requestShipCountermeasure?: AirScenarioContext["requestShipCountermeasure"];
  targets?: readonly TargetableEntity[];
};

export function createAirScenarioContext(
  snapshot: () => AirScenarioBridgeSnapshot,
): () => AirScenarioContext {
  return () => {
    const state = snapshot();
    const bridge = createAirShipBridge(state);
    return {
      ...bridge,
      targets:
        state.targets ??
        [bridge.blueShip, ...(bridge.redShip ? [bridge.redShip] : [])],
      countermeasures: state.countermeasures,
      requestShipCountermeasure: state.requestShipCountermeasure,
    };
  };
}
