export interface SurfaceSalvoAssessment {
  availableWeapons: number;
  availableHardpoints: number;
  weaponsInFlight: number;
  maximumWeaponsInFlight: number;
  maximumSalvoSize: number;
  minimumSalvoSize: number;
  expectedLeakProbability: number;
  targetHullEstimate: number;
  weaponDamage: number;
  assessedHits: number;
  resolvedWeapons: number;
  trackQuality: number;
}

export function estimateSurfaceBattleDamage(input: {
  targetHullEstimate: number;
  weaponDamage: number;
  assessedHits: number;
  trackQuality: number;
}) {
  const targetHull = Math.max(1, input.targetHullEstimate);
  const rawRemainingHull =
    targetHull - input.assessedHits * input.weaponDamage;
  const estimatedRemainingHull = Math.max(0, rawRemainingHull);
  const uncertainty =
    targetHull * (0.05 + (1 - input.trackQuality) * 0.15) +
    input.assessedHits *
      input.weaponDamage *
      (0.12 + (1 - input.trackQuality) * 0.18);
  const lowerPercent = Math.max(
    0,
    Math.floor(((estimatedRemainingHull - uncertainty) / targetHull) * 20) * 5,
  );
  const upperPercent = Math.min(
    100,
    Math.ceil(((estimatedRemainingHull + uncertainty) / targetHull) * 20) * 5,
  );
  const disabledConfidence =
    input.assessedHits <= 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            0.5 + -rawRemainingHull / Math.max(0.01, uncertainty * 2),
          ),
        );
  return {
    estimatedRemainingHull,
    lowerPercent,
    upperPercent,
    disabledConfidence,
  };
}

export function planSurfaceSalvo(input: SurfaceSalvoAssessment) {
  const remainingCapacity = Math.max(
    0,
    input.maximumWeaponsInFlight - input.weaponsInFlight,
  );
  const remainingHull = estimateSurfaceBattleDamage(input).estimatedRemainingHull;
  const requiredHits = Math.ceil(remainingHull / Math.max(1, input.weaponDamage));
  const observedLeakProbability =
    input.resolvedWeapons > 0
      ? input.assessedHits / input.resolvedWeapons
      : input.expectedLeakProbability;
  const observationWeight = Math.min(0.65, input.resolvedWeapons / 8);
  const planningLeakProbability = Math.max(
    0.18,
    Math.min(
      0.78,
      input.expectedLeakProbability * (1 - observationWeight) +
        observedLeakProbability * observationWeight,
    ),
  );
  const requiredWeapons = Math.ceil(
    requiredHits / Math.max(0.01, planningLeakProbability),
  );
  const maximumAvailable = Math.min(
    input.availableWeapons,
    input.availableHardpoints,
    input.maximumSalvoSize,
    remainingCapacity,
  );
  const count =
    requiredHits <= 0 || maximumAvailable <= 0
      ? 0
      : Math.min(
          maximumAvailable,
          Math.max(input.minimumSalvoSize, requiredWeapons),
        );
  return {
    count,
    requiredHits,
    planningLeakProbability,
    remainingCapacity,
  };
}
