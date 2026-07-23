import * as THREE from "three";
import type { TargetableEntity } from "../combat-entity";
import type { DefenseTarget } from "../combat-types";
import type { EnemyType } from "../threats/catalog";
import type { Track } from "../sim";
import type { DefenseObservation } from "../defense/targeting";
import {
  createDefenseTargetSource,
  type DefenseTargetSource,
} from "../defense/target-source.js";

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

export function indexedDefenseTargetSource<TTarget extends DefenseTarget>(
  name: string,
  targets: readonly TTarget[],
  observable: (target: TTarget) => boolean = () => true,
): DefenseTargetSource<DefenseTarget> {
  return createDefenseTargetSource(
    name,
    () => targets.map((target, index) => [index + 1, target] as const),
    { observable },
  );
}

export function mappedDefenseTargetSource(
  name: string,
  targets: ReadonlyMap<string, DefenseTarget>,
  observable: (target: DefenseTarget) => boolean = () => true,
): DefenseTargetSource<DefenseTarget> {
  return createDefenseTargetSource(name, () => targets.entries(), {
    observable,
  });
}
