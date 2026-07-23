import * as THREE from "three";
import type { TargetableEntity } from "../combat-entity";
import type { DefenseTarget, Missile } from "../combat-types";
import type { EnemyType } from "../threats/catalog";
import type { Track } from "../sim";
import type { DefenseObservation } from "../defense/targeting";

export type DefenseTargetAdapterOptions = {
  phase: DefenseTarget["phase"];
  threatType: EnemyType;
  displayName?: string;
};

export function adaptTargetableEntity(
  entity: TargetableEntity,
  mesh: THREE.Group,
  options: DefenseTargetAdapterOptions,
): DefenseTarget {
  return {
    mesh,
    get velocity() {
      return entity.velocity;
    },
    phase: options.phase,
    threatType: options.threatType,
    get rcs() {
      return entity.radarCrossSection;
    },
    entity,
    displayName: options.displayName,
  };
}

export function adaptCombatTrack(
  track: Track,
  target: DefenseTarget,
): DefenseObservation {
  return {
    id: track.sourceId,
    kind: target.entity?.kind ?? "missile",
    position: track.position,
    velocity: track.velocity,
    quality: track.quality,
    updatedAt: track.lastSeen,
  };
}

export function sourceSeed(sourceId: number | string): number {
  if (typeof sourceId === "number") return sourceId;
  let hash = 2166136261;
  for (const character of sourceId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function targetForSource(
  sourceId: number | string,
  missiles: Missile[],
  aircraft: Map<string, DefenseTarget>,
): DefenseTarget | undefined {
  return typeof sourceId === "string" ? aircraft.get(sourceId) : missiles[sourceId - 1];
}

export function sourceForTarget(
  target: DefenseTarget,
  missiles: Missile[],
): number | string {
  return target.entity?.id ?? missiles.findIndex((candidate) => candidate === target) + 1;
}

export function allTargets(
  missiles: Missile[],
  aircraft: Map<string, DefenseTarget>,
): DefenseTarget[] {
  return [...missiles, ...aircraft.values()];
}
