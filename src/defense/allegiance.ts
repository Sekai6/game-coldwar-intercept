import type { CombatEntity, CombatSide } from "../combat-entity";

export type AllegiancePolicy = (
  observer: Pick<CombatEntity, "side">,
  candidate: Pick<CombatEntity, "side">,
) => boolean;

export const opposingSides: AllegiancePolicy = (observer, candidate) =>
  observer.side !== candidate.side;

export function isHostileSide(
  observerSide: CombatSide,
  candidateSide: CombatSide,
): boolean {
  return observerSide !== candidateSide;
}
