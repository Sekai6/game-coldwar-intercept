export type ObservedTargetKind = "ship" | "aircraft" | "missile" | "decoy" | "unknown";

export type VectorObservation = { x: number; y: number; z: number };

export interface DefenseObservation {
  id: string | number;
  kind: ObservedTargetKind;
  position: VectorObservation;
  velocity: VectorObservation;
  quality: number;
  updatedAt: number;
}

export type DefenseTargetPolicy = {
  acceptedKinds: readonly ObservedTargetKind[];
  kindPriority?: Partial<Record<ObservedTargetKind, number>>;
  qualityWeight?: number;
  distanceWeight?: number;
};

export function observationScore(
  observation: DefenseObservation,
  origin: VectorObservation,
  policy: DefenseTargetPolicy,
): number {
  if (!policy.acceptedKinds.includes(observation.kind)) return -Infinity;
  const distance = Math.hypot(
    observation.position.x - origin.x,
    observation.position.y - origin.y,
    observation.position.z - origin.z,
  );
  return (
    (policy.kindPriority?.[observation.kind] ?? 0) +
    observation.quality * (policy.qualityWeight ?? 0) -
    distance * (policy.distanceWeight ?? 1)
  );
}

export function selectDefenseObservation(
  observations: readonly DefenseObservation[],
  origin: VectorObservation,
  policy: DefenseTargetPolicy,
): DefenseObservation | undefined {
  let selected: DefenseObservation | undefined;
  let selectedScore = -Infinity;
  for (const observation of observations) {
    const score = observationScore(observation, origin, policy);
    if (score > selectedScore) {
      selected = observation;
      selectedScore = score;
    }
  }
  return selected;
}
