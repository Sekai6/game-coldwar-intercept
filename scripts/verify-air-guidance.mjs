import {
  infraredSeekerCaptureProbability,
  radarSeekerCaptureProbability,
  semiActiveIlluminationValid,
} from "../dist-test/guidance.js";

const phoenixMidcourse = radarSeekerCaptureProbability({
  range: 140,
  seekerRange: 90,
  offBoresightDeg: 4,
  fieldOfViewDeg: 55,
  targetRcs: 28,
  ecmStrength: 0,
  burnThroughRange: 35,
});
const phoenixTerminal = radarSeekerCaptureProbability({
  range: 70,
  seekerRange: 90,
  offBoresightDeg: 4,
  fieldOfViewDeg: 55,
  targetRcs: 28,
  ecmStrength: 0.68,
  burnThroughRange: 35,
});
const phoenixBurnThrough = radarSeekerCaptureProbability({
  range: 25,
  seekerRange: 90,
  offBoresightDeg: 4,
  fieldOfViewDeg: 55,
  targetRcs: 28,
  ecmStrength: 0.68,
  burnThroughRange: 35,
});
const sparrowIlluminated = semiActiveIlluminationValid({
  shooterAlive: true,
  trackClassification: "aircraft",
  trackQuality: 0.72,
  trackAge: 0.6,
  maximumTrackAge: 1.8,
  offBoresightDeg: 18,
  illuminationFieldOfViewDeg: 120,
});
const sparrowStale = semiActiveIlluminationValid({
  shooterAlive: true,
  trackClassification: "aircraft",
  trackQuality: 0.72,
  trackAge: 2.4,
  maximumTrackAge: 1.8,
  offBoresightDeg: 18,
  illuminationFieldOfViewDeg: 120,
});
const sidewinderRear = infraredSeekerCaptureProbability({
  range: 24,
  seekerRange: 52,
  offBoresightDeg: 8,
  fieldOfViewDeg: 48,
  infraredSignature: 1.3,
  rearAspect: 1,
  targetAltitude: 20,
});
const sidewinderFront = infraredSeekerCaptureProbability({
  range: 24,
  seekerRange: 52,
  offBoresightDeg: 8,
  fieldOfViewDeg: 48,
  infraredSignature: 1.3,
  rearAspect: 0,
  targetAltitude: 20,
});
const sidewinderFlare = infraredSeekerCaptureProbability({
  range: 24,
  seekerRange: 52,
  offBoresightDeg: 8,
  fieldOfViewDeg: 48,
  infraredSignature: 1.3,
  rearAspect: 1,
  targetAltitude: 20,
  flareSignal: 4,
});
const sidewinderOffAxis = infraredSeekerCaptureProbability({
  range: 24,
  seekerRange: 52,
  offBoresightDeg: 30,
  fieldOfViewDeg: 48,
  infraredSignature: 1.3,
  rearAspect: 1,
  targetAltitude: 20,
});

const result = {
  phoenix: { midcourse: phoenixMidcourse, terminal: phoenixTerminal, burnThrough: phoenixBurnThrough },
  sparrow: { illuminated: sparrowIlluminated, stale: sparrowStale },
  sidewinder: { rear: sidewinderRear, front: sidewinderFront, flare: sidewinderFlare, offAxis: sidewinderOffAxis },
};
console.log(JSON.stringify(result, null, 2));
if (
  phoenixMidcourse !== 0 ||
  phoenixTerminal <= 0 ||
  phoenixBurnThrough <= phoenixTerminal ||
  !sparrowIlluminated ||
  sparrowStale ||
  sidewinderRear <= sidewinderFront ||
  sidewinderFlare >= sidewinderRear ||
  sidewinderOffAxis !== 0
) process.exitCode = 1;
