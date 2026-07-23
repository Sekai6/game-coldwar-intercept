export function seekerFieldOfViewEligible(input: {
  range: number;
  seekerRange: number;
  offBoresightDeg: number;
  fieldOfViewDeg: number;
}) {
  return (
    input.range <= input.seekerRange &&
    input.offBoresightDeg <= input.fieldOfViewDeg / 2
  );
}

export function radarSeekerCaptureProbability(input: {
  range: number;
  seekerRange: number;
  offBoresightDeg: number;
  fieldOfViewDeg: number;
  targetRcs: number;
  ecmStrength: number;
  burnThroughRange: number;
}) {
  if (!seekerFieldOfViewEligible(input)) return 0;
  const ratio = input.range / Math.max(1, input.seekerRange);
  const rcsFactor = Math.max(0.32, Math.min(1.25, Math.pow(input.targetRcs / 8, 0.25)));
  const burnedThrough = input.range <= input.burnThroughRange;
  const jammingPenalty = burnedThrough
    ? 1
    : Math.max(0.28, 1 - input.ecmStrength * ratio * ratio);
  return Math.max(
    0.05,
    Math.min(0.96, (0.94 - ratio * ratio * 0.58) * rcsFactor * jammingPenalty),
  );
}

export function infraredSeekerCaptureProbability(input: {
  range: number;
  seekerRange: number;
  offBoresightDeg: number;
  fieldOfViewDeg: number;
  infraredSignature: number;
  rearAspect: number;
  targetAltitude: number;
  flareSignal?: number;
}) {
  if (!seekerFieldOfViewEligible(input)) return 0;
  const ratio = input.range / Math.max(1, input.seekerRange);
  const aspectFactor = 0.48 + Math.max(0, Math.min(1, input.rearAspect)) * 0.52;
  const backgroundFactor = input.targetAltitude < 4 ? 0.72 : 1;
  const targetSignal = Math.max(0.05, input.infraredSignature) * aspectFactor * backgroundFactor;
  const flareCompetition = input.flareSignal
    ? targetSignal / (targetSignal + input.flareSignal)
    : 1;
  return Math.max(
    0.03,
    Math.min(0.95, (0.92 - ratio * ratio * 0.62) * targetSignal * flareCompetition),
  );
}

export function semiActiveIlluminationValid(input: {
  shooterAlive: boolean;
  trackClassification: "unknown" | "aircraft" | "ship";
  trackQuality: number;
  trackAge: number;
  maximumTrackAge: number;
  offBoresightDeg: number;
  illuminationFieldOfViewDeg: number;
}) {
  return (
    input.shooterAlive &&
    input.trackClassification === "aircraft" &&
    input.trackQuality >= 0.25 &&
    input.trackAge <= input.maximumTrackAge &&
    input.offBoresightDeg <= input.illuminationFieldOfViewDeg / 2
  );
}
