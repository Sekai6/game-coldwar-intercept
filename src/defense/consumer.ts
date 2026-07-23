import type { TargetableEntity } from "../combat-entity";
import type { EngagementRecord, EngagementSourceId } from "./engagement";
import type {
  DefenseObservation,
  DefenseTargetPolicy,
} from "./targeting";
import { observationScore, selectDefenseObservation } from "./targeting.js";

export interface DefenseConsumer<TKey = EngagementSourceId> {
  entity: TargetableEntity;
  scoringOrigin?: { x: number; y: number; z: number };
  observations: readonly DefenseObservation[];
  policy: DefenseTargetPolicy;
  engagements: ReadonlyMap<TKey, EngagementRecord>;
  scoreObservation?: (observation: DefenseObservation) => number;
}

export type RankedDefenseObservation = {
  observation: DefenseObservation;
  score: number;
};

export function rankDefenseObservations(
  consumer: DefenseConsumer<unknown>,
): RankedDefenseObservation[] {
  return consumer.observations
    .map((observation) => ({
      observation,
      score:
        consumer.scoreObservation?.(observation) ??
        observationScore(
          observation,
          consumer.scoringOrigin ?? consumer.entity.position,
          consumer.policy,
        ),
    }))
    .filter((ranked) => Number.isFinite(ranked.score))
    .sort((left, right) => right.score - left.score);
}

export function selectConsumerTarget(
  consumer: DefenseConsumer<unknown>,
): DefenseObservation | undefined {
  if (consumer.scoreObservation)
    return rankDefenseObservations(consumer)[0]?.observation;
  return selectDefenseObservation(
    consumer.observations,
    consumer.scoringOrigin ?? consumer.entity.position,
    consumer.policy,
  );
}
