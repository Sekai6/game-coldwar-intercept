import * as THREE from "three";
import {
  platformDefenseTargetId,
  pointDefensePriorityTracks,
} from "../dist-test/platforms/defense.js";
import {
  recordEngagement,
  resolveEngagement,
} from "../dist-test/defense/engagement.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const track = (missileId, range, quality = 0.8) => ({
  missileId,
  position: new THREE.Vector3(range, 0, 0),
  velocity: new THREE.Vector3(-6, 0, 0),
  quality,
  uncertainty: 2,
  lastUpdate: 9.8,
  nextScan: 20,
  scanCount: 2,
  fireControlReadyAt: 9,
  detectionLogged: true,
  readyLogged: true,
  threatScore: 0,
  estimatedTimeToImpact: Infinity,
  localTrackDensity: 0,
  nextEngagementReadyAt: 0,
});

const near = track(1, 25);
const far = track(2, 90);
const platform = {
  model: new THREE.Group(),
  velocity: new THREE.Vector3(),
  subsystemHealth: new Map([["point-defense", 100]]),
  incomingTracks: new Map([
    [near.missileId, near],
    [far.missileId, far],
  ]),
  defenseEngagements: new Map(),
  definition: {
    survivability: {
      pointDefense: {
        channels: 2,
        minimumTrackQuality: 0.3,
        trackMemory: 3,
        sensorRange: 180,
        engagementsPerTarget: 2,
      },
    },
  },
};

const first = pointDefensePriorityTracks(platform, 10);
assert(first[0]?.missileId === 1, "closest urgent track was not ranked first");

const nearId = platformDefenseTargetId(near.missileId);
recordEngagement(platform.defenseEngagements, nearId);
const whilePending = pointDefensePriorityTracks(platform, 10);
assert(
  whilePending[0]?.missileId === 2,
  "pending engagement did not release the next eligible target",
);

resolveEngagement(platform.defenseEngagements, nearId, "miss", 10.5);
const afterLook = pointDefensePriorityTracks(platform, 11);
assert(afterLook[0]?.missileId === 1, "shoot-look did not permit re-engagement");

recordEngagement(platform.defenseEngagements, nearId);
resolveEngagement(platform.defenseEngagements, nearId, "miss", 11.5);
const exhausted = pointDefensePriorityTracks(platform, 12);
assert(
  exhausted.every((candidate) => candidate.missileId !== 1),
  "engagement doctrine limit was bypassed",
);

console.log(
  JSON.stringify(
    {
      first: first.map((candidate) => candidate.missileId),
      whilePending: whilePending.map((candidate) => candidate.missileId),
      afterLook: afterLook.map((candidate) => candidate.missileId),
      exhausted: exhausted.map((candidate) => candidate.missileId),
    },
    null,
    2,
  ),
);
