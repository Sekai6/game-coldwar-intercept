import type { AirMissionOrder, AirTrack } from "./types";
import type { DefenseObservation } from "../defense/targeting.js";
import { selectConsumerTarget } from "../defense/consumer.js";
import type {
  EngagementRecord,
  EngagementSourceId,
} from "../defense/engagement";

export function airTrackObservation(track: AirTrack): DefenseObservation {
  return {
    id: track.targetId,
    kind: track.classification,
    position: track.position,
    velocity: track.velocity,
    quality: track.quality,
    updatedAt: track.lastUpdate,
  };
}

export function selectMissionTrack(input: {
  mission: AirMissionOrder;
  tracks: readonly AirTrack[];
  origin: { x: number; y: number; z: number };
  engagements?: ReadonlyMap<EngagementSourceId, EngagementRecord>;
}) {
  const desiredClassification =
    input.mission === "anti-ship" ? "ship" : "aircraft";
  const observations = input.tracks.map(airTrackObservation);
  const policy = {
    acceptedKinds: [desiredClassification],
    distanceWeight: 1,
  } as const;
  const selected = selectConsumerTarget({
    origin: input.origin,
    observations,
    policy,
    engagements: input.engagements ?? new Map(),
    acceptEngagement: (_observation, engagement) => !engagement?.shots,
  });
  return selected
    ? input.tracks.find((track) => track.targetId === selected.id)
    : undefined;
}

export function missionShouldReturn(input: {
  mission: AirMissionOrder;
  hasEngaged: boolean;
  observedHostileAircraft: number;
  observedThreats: number;
}) {
  return (
    (input.mission === "cap" || input.mission === "intercept") &&
    input.hasEngaged &&
    input.observedHostileAircraft === 0 &&
    input.observedThreats === 0
  );
}

export function noContactMissionDirection(input: {
  mission: AirMissionOrder;
  side: "blue" | "red";
  currentHeading: { x: number; y: number; z: number };
}) {
  if (input.mission === "anti-ship") return { ...input.currentHeading };
  return {
    x: input.side === "blue" ? 0.25 : -0.25,
    y: 0,
    z: input.side === "blue" ? -1 : 1,
  };
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
  const horizontal =
    Math.hypot(input.warningVelocity.x, input.warningVelocity.z) || 1;
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
