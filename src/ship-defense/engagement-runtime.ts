import type { EngagementState, MissilePhase } from "../combat-types";
import type { DefenseObservation, ObservedTargetKind, VectorObservation } from "../defense/targeting";
import { recordEngagement, resolveEngagement } from "../defense/engagement.js";

export function recordLaunch<T>(engagements: Map<T, EngagementState>, target: T): EngagementState {
  return recordEngagement(engagements, target);
}

export function resolveShot<T>(engagements: Map<T, EngagementState>, target: T, result: "hit" | "miss" | "cancel", time: number): EngagementState | undefined {
  return resolveEngagement(engagements, target, result, time);
}

export function threatScore(
  observation: DefenseObservation,
  phase: MissilePhase,
  targetKind: ObservedTargetKind,
  defenderPosition: VectorObservation,
  profilePriority: number,
): number {
  const range = Math.hypot(
    observation.position.x - defenderPosition.x,
    observation.position.y - defenderPosition.y,
    observation.position.z - defenderPosition.z,
  );
  const speed = Math.hypot(
    observation.velocity.x,
    observation.velocity.y,
    observation.velocity.z,
  );
  const timeToImpact = range / Math.max(1, speed);
  return (
    Math.max(0, 120 - timeToImpact) * 2 +
    (phase === "terminal" ? 90 : phase === "midcourse" ? 35 : 0) +
    profilePriority +
    (targetKind === "missile" ? 85 : 0) -
    (targetKind === "aircraft" ? 35 : 0) +
    observation.quality * 12
  );
}
