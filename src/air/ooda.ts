import type { AirMissionOrder, AirTrack } from "./types";

export function selectMissionTrack(input: {
  mission: AirMissionOrder;
  tracks: readonly AirTrack[];
  origin: { x: number; y: number; z: number };
}) {
  const desiredClassification = input.mission === "anti-ship" ? "ship" : "aircraft";
  return input.tracks
    .filter((track) => track.classification === desiredClassification)
    .sort((left, right) => {
      const leftDistance =
        (left.position.x - input.origin.x) ** 2 +
        (left.position.y - input.origin.y) ** 2 +
        (left.position.z - input.origin.z) ** 2;
      const rightDistance =
        (right.position.x - input.origin.x) ** 2 +
        (right.position.y - input.origin.y) ** 2 +
        (right.position.z - input.origin.z) ** 2;
      return leftDistance - rightDistance;
    })[0];
}

export function missionShouldReturn(input: {
  mission: AirMissionOrder;
  hasEngaged: boolean;
  observedHostileAircraft: number;
  observedThreats: number;
}) {
  return (
    input.mission === "cap" &&
    input.hasEngaged &&
    input.observedHostileAircraft === 0 &&
    input.observedThreats === 0
  );
}

export function defensiveManeuverFromWarning(input: {
  aircraftPosition: { x: number; y: number; z: number };
  warningPosition: { x: number; y: number; z: number };
  warningVelocity: { x: number; y: number; z: number };
  side: -1 | 1;
}) {
  const range = Math.hypot(
    input.warningPosition.x - input.aircraftPosition.x,
    input.warningPosition.y - input.aircraftPosition.y,
    input.warningPosition.z - input.aircraftPosition.z,
  );
  const speed = Math.max(
    1,
    Math.hypot(
      input.warningVelocity.x,
      input.warningVelocity.y,
      input.warningVelocity.z,
    ),
  );
  const horizontal = Math.hypot(
    input.warningVelocity.x,
    input.warningVelocity.z,
  ) || 1;
  return {
    range,
    timeToImpact: range / speed,
    direction: {
      x: (-input.warningVelocity.z / horizontal) * input.side,
      y: 0,
      z: (input.warningVelocity.x / horizontal) * input.side,
    },
  };
}
