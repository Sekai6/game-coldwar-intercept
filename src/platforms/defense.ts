import * as THREE from "three";
import type { EnemyPlatformInstance, PlatformIncomingTrack } from "./types";

function angleDifference(target: number, current: number) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

export function pointDefenseBearingInSector(
  targetBearing: number,
  sectorCenter: number,
  sectorHalfAngle: number,
) {
  return (
    Math.abs(angleDifference(targetBearing, sectorCenter)) <= sectorHalfAngle
  );
}

export function pointDefenseMountSolution(
  platform: EnemyPlatformInstance,
  targetPosition: THREE.Vector3,
  elapsed: number,
  reserve = false,
) {
  const localTarget = platform.model.worldToLocal(targetPosition.clone());
  const targetBearing = Math.atan2(localTarget.z, localTarget.x);
  const mountReady = (platform.model.userData.pointDefenseMountReady ??=
    new Map<string, number>()) as Map<string, number>;
  const candidates = platform.slots.pointDefenseMounts.filter(
    (mount) =>
      pointDefenseBearingInSector(
        targetBearing,
        mount.sectorCenter,
        mount.sectorHalfAngle,
      ) &&
      (mountReady.get(mount.id) ?? 0) <= elapsed,
  );
  if (!candidates.length) return null;
  const oldestReadyAt = Math.min(
    ...candidates.map((candidate) => mountReady.get(candidate.id) ?? 0),
  );
  const restedCandidates = candidates.filter(
    (candidate) => (mountReady.get(candidate.id) ?? 0) <= oldestReadyAt + 1e-6,
  );
  const mount = restedCandidates.reduce((nearest, candidate) =>
    candidate.traverse.position.distanceTo(localTarget) <
    nearest.traverse.position.distanceTo(localTarget)
      ? candidate
      : nearest,
  );
  const delta = localTarget.clone().sub(mount.traverse.position);
  const desiredTraverse = Math.atan2(-delta.z, delta.x);
  let traverseError = angleDifference(desiredTraverse, mount.traverse.rotation.y);
  let aligned = Math.abs(traverseError) <= mount.alignmentTolerance;
  if (reserve) {
    const lastAimUpdate = (platform.model.userData.pointDefenseMountAimUpdate ??=
      new Map<string, number>()) as Map<string, number>;
    const previousUpdate = lastAimUpdate.get(mount.id) ?? elapsed;
    const aimDelta = Math.max(0, Math.min(0.25, elapsed - previousUpdate));
    lastAimUpdate.set(mount.id, elapsed);
    mount.traverse.rotation.y += THREE.MathUtils.clamp(
      traverseError,
      -mount.traverseRate * aimDelta,
      mount.traverseRate * aimDelta,
    );
    traverseError = angleDifference(desiredTraverse, mount.traverse.rotation.y);
    aligned = Math.abs(traverseError) <= mount.alignmentTolerance;
    if (aligned)
      mountReady.set(
        mount.id,
        elapsed + platform.definition.survivability.pointDefense.interval,
      );
    platform.model.updateMatrixWorld(true);
  }
  return {
    mount,
    targetBearing,
    desiredTraverse,
    traverseError,
    aligned,
    origin: mount.muzzle.getWorldPosition(new THREE.Vector3()),
  };
}

export function pointDefenseCapability(platform: EnemyPlatformInstance) {
  const definition = platform.definition.survivability.pointDefense;
  const health = THREE.MathUtils.clamp(
    (platform.subsystemHealth.get("point-defense") ?? 100) / 100,
    0,
    1,
  );
  return {
    health,
    effectiveChannels:
      health <= 0.05
        ? 0
        : Math.max(1, Math.ceil(definition.channels * health)),
    reactionMultiplier: THREE.MathUtils.lerp(1.8, 1, health),
    cycleMultiplier: THREE.MathUtils.lerp(2, 1, health),
  };
}

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
