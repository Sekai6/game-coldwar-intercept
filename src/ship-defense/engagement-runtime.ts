import * as THREE from "three";
import type { DefenseTarget, EngagementState } from "../combat-types";

export function recordLaunch<T>(engagements: Map<T, EngagementState>, target: T): EngagementState {
  const state = engagements.get(target) ?? { shots: 0, pending: 0, misses: 0, lastResolution: -Infinity };
  state.shots += 1;
  state.pending += 1;
  engagements.set(target, state);
  return state;
}

export function resolveShot<T>(engagements: Map<T, EngagementState>, target: T, result: "hit" | "miss" | "cancel", time: number): EngagementState | undefined {
  const state = engagements.get(target);
  if (!state) return undefined;
  state.pending = Math.max(0, state.pending - 1);
  if (result === "miss") state.misses += 1;
  state.lastResolution = time;
  return state;
}

export function threatScore(
  target: DefenseTarget,
  quality: number,
  defenderPosition: THREE.Vector3,
  profilePriority: number,
): number {
  const range = target.mesh.position.distanceTo(defenderPosition);
  const timeToImpact = range / Math.max(1, target.velocity.length());
  return (
    Math.max(0, 120 - timeToImpact) * 2 +
    (target.phase === "terminal" ? 90 : target.phase === "midcourse" ? 35 : 0) +
    profilePriority +
    (target.entity?.kind === "missile" ? 85 : 0) -
    (target.entity?.kind === "aircraft" ? 35 : 0) +
    quality * 12
  );
}
