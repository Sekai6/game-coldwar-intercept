export function radarCountermeasureContest(input: {
  targetRcs: number;
  targetRange: number;
  decoyRcs?: number;
  decoyRange?: number;
  ecmEnabled: boolean;
  ecmStrength: number;
  ecmHealth: number;
  burnThroughRange: number;
  homeOnJamThreshold?: number;
}) {
  const ecmInterference = input.ecmEnabled
    ? Math.max(
        0,
        Math.min(
          1,
          Math.pow(input.targetRange / Math.max(1, input.burnThroughRange), 2) *
            input.ecmStrength *
            input.ecmHealth,
        ),
      )
    : 0;
  const targetPower =
    input.targetRcs / Math.pow(Math.max(1, input.targetRange), 4);
  const decoyPower =
    (input.decoyRcs ?? 0) /
    Math.pow(Math.max(1, input.decoyRange ?? Infinity), 4);
  const decoyCapture =
    decoyPower > 0 ? decoyPower / (decoyPower + targetPower) : 0;
  const homeOnJam =
    ecmInterference >= (input.homeOnJamThreshold ?? Infinity);
  const defeatProbability = Math.max(
    0,
    Math.min(
      0.78,
      (decoyCapture * (0.52 + ecmInterference * 0.28) +
        ecmInterference * 0.04) *
        (homeOnJam ? 0.62 : 1),
    ),
  );
  return { ecmInterference, targetPower, decoyPower, decoyCapture, homeOnJam, defeatProbability };
}
