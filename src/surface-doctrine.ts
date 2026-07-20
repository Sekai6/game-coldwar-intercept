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
}

export function planSurfaceSalvo(input: SurfaceSalvoAssessment) {
  const remainingCapacity = Math.max(
    0,
    input.maximumWeaponsInFlight - input.weaponsInFlight,
  );
  const remainingHull = Math.max(
    0,
    input.targetHullEstimate - input.assessedHits * input.weaponDamage,
  );
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
