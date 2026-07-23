import type { MissilePhase, WeaponType } from "../combat-types";
import { selectConsumerTarget } from "../defense/consumer.js";
import type {
  DefenseObservation,
  DefenseTargetPolicy,
  ObservedTargetKind,
  VectorObservation,
} from "../defense/targeting";
import {
  commitEngagementAuthorization,
  resolveEngagement,
  type EngagementRecord,
} from "../defense/engagement.js";

export function authorizeLaunch<T>(
  engagements: Map<T, EngagementRecord>,
  target: T,
  authorize: () => boolean,
): EngagementRecord | undefined {
  return commitEngagementAuthorization({ engagements, target, authorize });
}

export function resolveShot<T>(
  engagements: Map<T, EngagementRecord>,
  target: T,
  result: "hit" | "miss" | "cancel",
  time: number,
): EngagementRecord | undefined {
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

export type DefenseWeaponState = {
  weapon: WeaponType;
  rounds: number;
  envelope: { minRange: number; maxRange: number };
};

export type DefensePlanningInput = {
  origin: VectorObservation;
  observations: readonly DefenseObservation[];
  policy: DefenseTargetPolicy;
  engagements: ReadonlyMap<string | number, EngagementRecord>;
  weapons: readonly DefenseWeaponState[];
  scoreObservation: (observation: DefenseObservation) => number;
  acceptEngagement?: (
    observation: DefenseObservation,
    engagement: EngagementRecord | undefined,
  ) => boolean;
};

export function planDefenseEngagement(input: DefensePlanningInput) {
  const observation = selectConsumerTarget({
    origin: input.origin,
    observations: input.observations,
    policy: input.policy,
    engagements: input.engagements,
    acceptEngagement: input.acceptEngagement,
    scoreObservation: input.scoreObservation,
  });
  if (!observation) return undefined;
  const range = Math.hypot(
    observation.position.x - input.origin.x,
    observation.position.y - input.origin.y,
    observation.position.z - input.origin.z,
  );
  const available = input.weapons.filter(
    ({ rounds, envelope }) =>
      rounds > 0 && range >= envelope.minRange && range <= envelope.maxRange,
  );
  const weapon =
    available.find(
      ({ weapon, envelope }) =>
        weapon === "SM-2MR" && range < envelope.maxRange * 0.8,
    ) ??
    available.find(({ weapon }) => weapon === "RIM-67") ??
    available.find(({ weapon }) => weapon === "SM-2ER") ??
    available[0];
  return weapon ? { observation, weapon: weapon.weapon, range } : undefined;
}
