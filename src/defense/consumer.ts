import type { EngagementRecord, EngagementSourceId } from "./engagement";
import type { DefenseObservation, DefenseTargetPolicy } from "./targeting";
import { observationScore } from "./targeting.js";

export interface DefenseConsumer {
  origin: { x: number; y: number; z: number };
  observations: readonly DefenseObservation[];
  policy: DefenseTargetPolicy;
  engagements: ReadonlyMap<EngagementSourceId, EngagementRecord>;
  acceptEngagement?: (
    observation: DefenseObservation,
    engagement: EngagementRecord | undefined,
  ) => boolean;
  scoreObservation?: (observation: DefenseObservation) => number;
}

export type RankedDefenseObservation = {
  observation: DefenseObservation;
  score: number;
};

export function rankDefenseObservations(
  consumer: DefenseConsumer,
): RankedDefenseObservation[] {
  return consumer.observations
    .filter((observation) =>
      consumer.acceptEngagement
        ? consumer.acceptEngagement(
            observation,
            consumer.engagements.get(observation.id),
          )
        : true,
    )
    .map((observation) => ({
      observation,
      score:
        consumer.scoreObservation?.(observation) ??
        observationScore(observation, consumer.origin, consumer.policy),
    }))
    .filter((ranked) => Number.isFinite(ranked.score))
    .sort((left, right) => right.score - left.score);
}

export function selectConsumerTarget(
  consumer: DefenseConsumer,
): DefenseObservation | undefined {
  return rankDefenseObservations(consumer)[0]?.observation;
}
