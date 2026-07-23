import * as THREE from "three";
import type { AirTrack } from "./types";

export function classifyAirMeasurement(
  targetKind: "aircraft" | "ship" | "missile" | "decoy",
  quality: number,
): AirTrack["classification"] {
  if (targetKind === "missile" || targetKind === "decoy" || quality <= 0.2)
    return "unknown";
  return targetKind;
}

export function advanceAirTracks(
  tracks: Map<string, AirTrack>,
  dt: number,
  time: number,
) {
  for (const [id, track] of tracks) {
    track.position.addScaledVector(track.velocity, dt);
    track.quality = Math.max(0, track.quality - 0.018 * dt);
    track.uncertainty += 0.6 * dt;
    if (time - track.lastUpdate > 8 || track.quality < 0.04) tracks.delete(id);
  }
}

export function createAirMeasurement(input: {
  targetId: string;
  targetKind: "aircraft" | "ship" | "missile" | "decoy";
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quality: number;
  precision: number;
  time: number;
  noise: readonly [number, number, number];
}): AirTrack {
  const uncertainty =
    ((1 - input.quality) * 18) / Math.max(0.35, input.precision);
  return {
    targetId: input.targetId,
    position: input.position.clone().add(
      new THREE.Vector3(
        (input.noise[0] - 0.5) * uncertainty,
        (input.noise[1] - 0.5) * uncertainty * 0.35,
        (input.noise[2] - 0.5) * uncertainty,
      ),
    ),
    velocity: input.velocity.clone(),
    quality: input.quality,
    uncertainty,
    lastUpdate: input.time,
    classification: classifyAirMeasurement(input.targetKind, input.quality),
  };
}
