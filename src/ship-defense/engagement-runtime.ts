import type {
  IlluminatorState,
  Interceptor,
  MissilePhase,
  WeaponType,
} from "../combat-types";
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

export function effectiveIlluminatorCount(
  configured: number,
  installed: number,
  health: number,
): number {
  return health <= 0.05
    ? 0
    : Math.min(configured, installed, Math.max(1, Math.ceil(installed * health)));
}

export type IlluminatorAllocationInput = {
  states: readonly IlluminatorState[];
  candidates: readonly Interceptor[];
  limit: number;
  bearing: (interceptor: Interceptor) => number;
  targetId: (interceptor: Interceptor) => string | number;
  onAssignment?: (state: IlluminatorState, targetId: string | number) => void;
};

export function allocateIlluminators(input: IlluminatorAllocationInput): void {
  const active = input.candidates.filter(
    (interceptor) =>
      interceptor.mesh.visible && interceptor.target.phase !== "destroyed",
  );
  input.states.forEach((state, index) => {
    if (index >= input.limit || !state.target || !active.includes(state.target))
      state.target = null;
  });
  for (const interceptor of active) {
    if (
      input.states.some(
        (state) =>
          state.target === interceptor ||
          state.target?.target === interceptor.target,
      )
    )
      continue;
    const bearing = input.bearing(interceptor);
    const free = input.states
      .slice(0, input.limit)
      .filter((state) => !state.target)
      .sort(
        (left, right) =>
          Math.abs(Math.atan2(Math.sin(bearing - left.azimuth), Math.cos(bearing - left.azimuth))) -
          Math.abs(Math.atan2(Math.sin(bearing - right.azimuth), Math.cos(bearing - right.azimuth))),
      )[0];
    if (!free) continue;
    free.target = interceptor;
    const id = input.targetId(interceptor);
    if (free.lastTargetId !== id) {
      free.lastTargetId = id;
      input.onAssignment?.(free, id);
    }
  }
}
