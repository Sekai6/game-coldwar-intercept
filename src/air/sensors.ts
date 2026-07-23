function radarHorizonWorldUnits(aMeters: number, bMeters: number) {
  return 41.2 * (Math.sqrt(Math.max(0, aMeters)) + Math.sqrt(Math.max(0, bMeters)));
}

export function airRadarFactors(input: {
  sensorAltitude: number;
  targetAltitude: number;
  range: number;
  nominalRange: number;
  targetRcs: number;
  radarHealth: number;
  precision: number;
  ecmStrength?: number;
  burnThroughRange?: number;
}) {
  const burned = input.range <= (input.burnThroughRange ?? 0);
  const jamFactor = burned ? 1 : 1 - (input.ecmStrength ?? 0) * 0.35;
  const effectiveRange =
    input.nominalRange *
    Math.pow(Math.max(0.05, input.targetRcs / 8), 0.25) *
    input.radarHealth *
    jamFactor;
  const horizon = radarHorizonWorldUnits(
    Math.max(3, input.sensorAltitude * 50),
    Math.max(1, input.targetAltitude * 50),
  );
  const horizonFactor =
    input.range <= horizon
      ? 1
      : Math.max(
          0.18,
          Math.min(
            1,
            1 -
              (input.range - horizon) /
                Math.max(1, effectiveRange - horizon),
          ),
        );
  const probability =
    Math.max(
      0,
      Math.min(
        0.96,
        0.96 - Math.pow(input.range / Math.max(1, effectiveRange), 2) * 0.7,
      ),
    ) *
    input.radarHealth *
    horizonFactor;
  const quality = Math.max(
    0.05,
    Math.min(
      0.96,
      ((1 - input.range / effectiveRange) * 0.7 + 0.24) *
        input.precision *
        jamFactor *
        horizonFactor,
    ),
  );
  return { burned, jamFactor, effectiveRange, horizon, horizonFactor, probability, quality };
}

export function missileWarningProbability(range: number, active: boolean) {
  const warningRange = active ? 150 : 70;
  if (range > warningRange) return 0;
  return Math.max(0.12, Math.min(0.94, 0.3 + (1 - range / warningRange) * 0.62));
}
