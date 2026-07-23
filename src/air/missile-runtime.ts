import * as THREE from "three";

export type AirToAirMissilePhase = "boost" | "midcourse" | "terminal";

export function airToAirMissilePhase(input: {
  age: number;
  boostSeconds: number;
  commandRange: number;
  seekerRange: number;
  seekerAcquired: boolean;
}): AirToAirMissilePhase {
  if (input.age < input.boostSeconds) return "boost";
  if (input.seekerAcquired || input.commandRange <= input.seekerRange) return "terminal";
  return "midcourse";
}

export function airToAirGuidancePoint(input: {
  seekerAcquired: boolean;
  commandPoint: THREE.Vector3;
  measuredTargetPosition?: THREE.Vector3;
}) {
  return input.seekerAcquired && input.measuredTargetPosition
    ? input.measuredTargetPosition.clone()
    : input.commandPoint.clone();
}

export function shouldContinueAfterTargetLoss(input: {
  age: number;
  maximumAge: number;
  altitude: number;
}) {
  return input.age <= input.maximumAge && input.altitude >= 0;
}
