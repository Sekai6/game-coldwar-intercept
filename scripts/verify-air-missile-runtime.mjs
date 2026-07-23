import * as THREE from "three";
import {
  airToAirGuidancePoint,
  airToAirMissilePhase,
  shouldContinueAfterTargetLoss,
} from "../dist-test/missile-runtime.js";

const commandPoint = new THREE.Vector3(100, 20, 0);
const truth = new THREE.Vector3(80, 25, 10);
const phases = [
  airToAirMissilePhase({ age: 1, boostSeconds: 3, commandRange: 20, seekerRange: 40, seekerAcquired: false }),
  airToAirMissilePhase({ age: 4, boostSeconds: 3, commandRange: 60, seekerRange: 40, seekerAcquired: false }),
  airToAirMissilePhase({ age: 4, boostSeconds: 3, commandRange: 30, seekerRange: 40, seekerAcquired: false }),
];
const preCapture = airToAirGuidancePoint({ seekerAcquired: false, commandPoint, measuredTargetPosition: truth });
const postCapture = airToAirGuidancePoint({ seekerAcquired: true, commandPoint, measuredTargetPosition: truth });
const lostTarget = {
  continues: shouldContinueAfterTargetLoss({ age: 20, maximumAge: 180, altitude: 4 }),
  expires: shouldContinueAfterTargetLoss({ age: 181, maximumAge: 180, altitude: 4 }),
};

console.log(JSON.stringify({ phases, preCapture: preCapture.toArray(), postCapture: postCapture.toArray(), lostTarget }, null, 2));
if (
  phases.join(",") !== "boost,midcourse,terminal" ||
  !preCapture.equals(commandPoint) ||
  !postCapture.equals(truth) ||
  !lostTarget.continues ||
  lostTarget.expires
) process.exitCode = 1;
