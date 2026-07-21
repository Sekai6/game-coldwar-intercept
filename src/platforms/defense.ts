import * as THREE from "three";
import type { EnemyPlatformInstance, PlatformIncomingTrack } from "./types";

function trackIsValid(
  platform: EnemyPlatformInstance,
  track: PlatformIncomingTrack,
  elapsed: number,
) {
  const defense = platform.definition.survivability.pointDefense;
  return (
    track.detectionLogged &&
    track.quality >= defense.minimumTrackQuality &&
    elapsed - track.lastUpdate <= defense.trackMemory
  );
}

export function assessPlatformIncomingTracks(
  platform: EnemyPlatformInstance,
  elapsed: number,
) {
  const defense = platform.definition.survivability.pointDefense;
  const tracks = [...platform.incomingTracks.values()];
  for (const track of tracks) {
    if (!trackIsValid(platform, track, elapsed)) {
      track.threatScore = 0;
      track.estimatedTimeToImpact = Infinity;
      track.localTrackDensity = 0;
      continue;
    }
    const relativePosition = track.position
      .clone()
      .sub(platform.model.position)
      .setY(0);
    const range = relativePosition.length();
    const relativeVelocity = track.velocity.clone().sub(platform.velocity).setY(0);
    const closingSpeed =
      range > 0.01
        ? Math.max(0, -relativeVelocity.dot(relativePosition.normalize()))
        : relativeVelocity.length();
    const timeToImpact = closingSpeed > 0.05 ? range / closingSpeed : Infinity;
    const localDensity = tracks.filter(
      (other) =>
        other !== track &&
        trackIsValid(platform, other, elapsed) &&
        other.position.distanceTo(track.position) <= 45,
    ).length + 1;
    const ttiUrgency = Number.isFinite(timeToImpact)
      ? THREE.MathUtils.clamp(1 - timeToImpact / 24, 0, 1) * 70
      : 0;
    const rangeUrgency =
      THREE.MathUtils.clamp(1 - range / Math.max(1, defense.sensorRange), 0, 1) *
      45;
    const closureUrgency =
      THREE.MathUtils.clamp(closingSpeed / 6.4, 0, 1) * 18;
    track.estimatedTimeToImpact = timeToImpact;
    track.localTrackDensity = localDensity;
    track.threatScore =
      ttiUrgency +
      rangeUrgency +
      closureUrgency +
      track.quality * 12 +
      Math.max(0, localDensity - 1) * 10;
  }
  return tracks.sort(
    (left, right) =>
      right.threatScore - left.threatScore ||
      left.estimatedTimeToImpact - right.estimatedTimeToImpact ||
      left.missileId - right.missileId,
  );
}

export function pointDefensePriorityTracks(
  platform: EnemyPlatformInstance,
  elapsed: number,
) {
  const maximumEngagements =
    platform.definition.survivability.pointDefense.engagementsPerTarget;
  return assessPlatformIncomingTracks(platform, elapsed).filter(
    (track) =>
      track.threatScore > 0 &&
      track.engagements < maximumEngagements &&
      elapsed >= track.fireControlReadyAt &&
      elapsed >= track.nextEngagementReadyAt,
  );
}
