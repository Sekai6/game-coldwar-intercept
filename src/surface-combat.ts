import * as THREE from "three";
import type {
  EnemyPlatformInstance,
  PlatformIncomingTrack,
} from "./platforms/types";
import type { ChaffCloud } from "./combat-types";
import type { ModelWeaponHardpoint, ShipDefinition } from "./ship-types";
import {
  pointDefenseCapability,
  pointDefenseMountSolution,
  pointDefensePriorityTracks,
} from "./platforms/defense";
import { getThreatDefinition } from "./threats/catalog";
import {
  updateThreatParticleTrail,
  type ThreatParticleTrail,
} from "./visual/threat-particles";

export type SurfaceStrikePhase =
  | "boost"
  | "midcourse"
  | "terminal"
  | "penetrating"
  | "destroyed";

export type SurfaceStrikeMissile = {
  id: number;
  mesh: THREE.Group;
  path: THREE.Line;
  velocity: THREE.Vector3;
  phase: SurfaceStrikePhase;
  age: number;
  distanceTraveled: number;
  target: EnemyPlatformInstance;
  damage: number;
  fuseDelay: number;
  seekerLogged: boolean;
  softKillResolved: boolean;
  launchSlot: string;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  routeOffset: THREE.Vector3;
  routeJoinRange: number;
  plannedArrivalAt: number;
  maximumSpeedCompensation: number;
  terminalEnteredAt: number | null;
  nextDatalink: number;
  datalinkValid: boolean;
  history: THREE.Vector3[];
  closestTargetRange: number;
  closestCommandRange: number;
  pointDefenseEngagements: number;
  lastDatalinkQuality: number;
  seekerAcquired: boolean;
  targetLostAt: number | null;
  pendingPointDefense: {
    resolveAt: number;
    pk: number;
    threatScore: number;
    estimatedTimeToImpact: number;
    localTrackDensity: number;
    engagement: number;
    maximumEngagements: number;
    willHit: boolean;
  } | null;
  pendingDetonation: {
    detonateAt: number;
    impactPoint: THREE.Vector3;
    localImpact: THREE.Vector3;
    zone: string;
  } | null;
};

export type SurfaceStrikeEvent =
  | { kind: "seeker-search"; missile: SurfaceStrikeMissile }
  | {
      kind: "seeker-acquired";
      missile: SurfaceStrikeMissile;
      range: number;
      offBoresightDeg: number;
    }
  | { kind: "miss"; missile: SurfaceStrikeMissile; reason: string }
  | {
      kind: "platform-track";
      missile: SurfaceStrikeMissile;
      quality: number;
      range: number;
    }
  | {
      kind: "point-defense-ready";
      missile: SurfaceStrikeMissile;
      quality: number;
    }
  | {
      kind: "point-defense-fire";
      missile: SurfaceStrikeMissile;
      pk: number;
      timeOfFlight: number;
      engagement: number;
      maximumEngagements: number;
      engagementsRemaining: number;
      mountId: string;
      origin: THREE.Vector3;
      targetBearing: number;
    }
  | { kind: "point-defense-depleted"; missile: SurfaceStrikeMissile }
  | { kind: "point-defense-offline"; missile: SurfaceStrikeMissile }
  | {
      kind: "penetration";
      missile: SurfaceStrikeMissile;
      impactPoint: THREE.Vector3;
      localImpact: THREE.Vector3;
      zone: string;
      fuseDelay: number;
    }
  | {
      kind: "soft-kill";
      missile: SurfaceStrikeMissile;
      pk: number;
      mode: "ECM" | "DECOY" | "ECM + DECOY";
    }
  | {
      kind: "point-defense";
      missile: SurfaceStrikeMissile;
      pk: number;
      threatScore: number;
      estimatedTimeToImpact: number;
      localTrackDensity: number;
      engagement: number;
      maximumEngagements: number;
    }
  | {
      kind: "point-defense-miss";
      missile: SurfaceStrikeMissile;
      pk: number;
      threatScore: number;
      estimatedTimeToImpact: number;
      localTrackDensity: number;
      engagement: number;
      maximumEngagements: number;
    }
  | {
      kind: "hit";
      missile: SurfaceStrikeMissile;
      damage: number;
      subsystem: string;
      zone: string;
      impactPoint: THREE.Vector3;
      localImpact: THREE.Vector3;
      casualtyId: number;
      fire: number;
      flooding: number;
      platformDestroyed: boolean;
    };

function hardpointDirection(hardpoint: ModelWeaponHardpoint) {
  const quaternion = hardpoint.mount.getWorldQuaternion(new THREE.Quaternion());
  return hardpoint.localDirection.clone().applyQuaternion(quaternion).normalize();
}

export function createSurfaceStrikeMissile(
  id: number,
  hardpoint: ModelWeaponHardpoint,
  target: EnemyPlatformInstance,
  strike: NonNullable<ShipDefinition["surfaceStrike"]>,
  commandPoint: THREE.Vector3,
  commandVelocity: THREE.Vector3,
  routeOffset: THREE.Vector3,
  routeJoinRange: number,
  plannedArrivalAt: number,
  maximumSpeedCompensation: number,
) {
  hardpoint.mount.updateWorldMatrix(true, false);
  const origin = hardpoint.mount.getWorldPosition(new THREE.Vector3());
  const direction = hardpointDirection(hardpoint);
  const definition = getThreatDefinition("RGM-84 Harpoon");
  const mesh = definition.createModel();
  mesh.position.copy(origin);
  mesh.scale.setScalar(definition.profile.modelScale);
  mesh.userData.surfaceStrike = true;
  mesh.userData.seekerState = "STANDBY";
  const history = [origin.clone()];
  const path = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(history),
    new THREE.LineBasicMaterial({
      color: 0x67c8ff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
    }),
  );
  if (hardpoint.cover) hardpoint.cover.visible = false;
  return {
    id,
    mesh,
    path,
    velocity: direction.multiplyScalar(3.4),
    phase: "boost" as const,
    age: 0,
    distanceTraveled: 0,
    target,
    damage: strike.damage,
    fuseDelay: strike.fuseDelay,
    seekerLogged: false,
    softKillResolved: false,
    launchSlot: hardpoint.id,
    commandPoint: commandPoint.clone(),
    commandVelocity: commandVelocity.clone(),
    routeOffset: routeOffset.clone(),
    routeJoinRange,
    plannedArrivalAt,
    maximumSpeedCompensation,
    terminalEnteredAt: null,
    nextDatalink: 0,
    datalinkValid: true,
    history,
    closestTargetRange: Infinity,
    closestCommandRange: Infinity,
    pointDefenseEngagements: 0,
    lastDatalinkQuality: -1,
    seekerAcquired: false,
    targetLostAt: null,
    pendingPointDefense: null,
    pendingDetonation: null,
  };
}

function deterministicRoll(missile: SurfaceStrikeMissile, salt: number) {
  const raw = Math.sin(missile.id * 91.17 + salt * 37.21) * 43758.5453;
  return raw - Math.floor(raw);
}

function updatePlatformIncomingTrack(
  missile: SurfaceStrikeMissile,
  dt: number,
  elapsed: number,
  sensorsEnabled: boolean,
) {
  const platform = missile.target;
  const defense = platform.definition.survivability.pointDefense;
  let track = platform.incomingTracks.get(missile.id);
  if (!track) {
    track = {
      missileId: missile.id,
      position: missile.mesh.position.clone(),
      velocity: new THREE.Vector3(),
      quality: 0,
      uncertainty: Infinity,
      lastUpdate: -Infinity,
      nextScan: elapsed,
      scanCount: 0,
      fireControlReadyAt: Infinity,
      detectionLogged: false,
      readyLogged: false,
      threatScore: 0,
      estimatedTimeToImpact: Infinity,
      localTrackDensity: 0,
      engagements: 0,
      nextEngagementReadyAt: -Infinity,
    } satisfies PlatformIncomingTrack;
    platform.incomingTracks.set(missile.id, track);
  }
  track.position.addScaledVector(track.velocity, dt);
  track.quality = Math.max(0, track.quality - dt * 0.025);
  track.uncertainty = Math.min(40, track.uncertainty + dt * 0.55);

  const trueRange = missile.mesh.position.distanceTo(platform.model.position);
  let event: SurfaceStrikeEvent | null = null;
  if (elapsed >= track.nextScan) {
    track.nextScan = elapsed + defense.sensorUpdateInterval;
    track.scanCount++;
    const sensorHealth =
      platform.definition.sensorSlots.reduce(
        (sum, sensor) =>
          sum + (platform.subsystemHealth.get(sensor.id) ?? 100) / 100,
        0,
      ) / Math.max(1, platform.definition.sensorSlots.length);
    const ratio = trueRange / Math.max(1, defense.sensorRange);
    const lowAltitudePenalty = THREE.MathUtils.clamp(
      (1 - missile.mesh.position.y / 0.9) * 0.16,
      0,
      0.16,
    );
    const detectionProbability = THREE.MathUtils.clamp(
      (0.92 - ratio * ratio * 0.62 - lowAltitudePenalty) * sensorHealth,
      0.03,
      0.94,
    );
    if (
      sensorsEnabled &&
      !platform.destroyed &&
      trueRange <= defense.sensorRange &&
      deterministicRoll(missile, 20 + track.scanCount * 0.37) <
        detectionProbability
    ) {
      const quality = THREE.MathUtils.clamp(
        (1 - ratio * 0.62 - lowAltitudePenalty * 0.7) * sensorHealth,
        0.05,
        0.96,
      );
      const uncertainty = 0.8 + (1 - quality) * 8;
      const phase = missile.id * 1.71 + track.scanCount * 0.83;
      track.position
        .copy(missile.mesh.position)
        .add(
          new THREE.Vector3(
            Math.sin(phase) * uncertainty,
            0,
            Math.cos(phase * 1.13) * uncertainty,
          ),
        );
      track.velocity.lerp(missile.velocity, 0.72);
      track.quality = quality;
      track.uncertainty = uncertainty;
      track.lastUpdate = elapsed;
      if (!track.detectionLogged) {
        track.detectionLogged = true;
        event = {
          kind: "platform-track",
          missile,
          quality,
          range: trueRange,
        };
      }
    }
  }

  const valid =
    track.quality >= defense.minimumTrackQuality &&
    elapsed - track.lastUpdate <= defense.trackMemory;
  if (!valid) {
    track.fireControlReadyAt = Infinity;
    track.readyLogged = false;
  } else if (!Number.isFinite(track.fireControlReadyAt)) {
    track.fireControlReadyAt =
      elapsed +
      defense.reactionTime * pointDefenseCapability(platform).reactionMultiplier;
  } else if (elapsed >= track.fireControlReadyAt && !track.readyLogged) {
    track.readyLogged = true;
    event = {
      kind: "point-defense-ready",
      missile,
      quality: track.quality,
    };
  }
  return { track, valid, event };
}

function platformDamageZone(
  missile: SurfaceStrikeMissile,
  localImpact: THREE.Vector3,
) {
  const halfLength = Math.max(
    1,
    Number(missile.target.model.userData.hullLength ?? 2) / 2,
  );
  const fraction = THREE.MathUtils.clamp(localImpact.x / halfLength, -1, 1);
  return missile.target.definition.survivability.damageZones.find(
    (zone) => fraction >= zone.minimumLongitudinalFraction,
  );
}

function damagePlatform(
  missile: SurfaceStrikeMissile,
  damage: number,
  localImpact: THREE.Vector3,
  elapsed: number,
) {
  const platform = missile.target;
  platform.hullIntegrity = Math.max(0, platform.hullIntegrity - damage);
  const zone = platformDamageZone(missile, localImpact);
  const systems = (zone?.systems ?? [...platform.subsystemHealth.keys()]).filter(
    (system) => platform.subsystemHealth.has(system),
  );
  const index = Math.floor(deterministicRoll(missile, 8) * systems.length);
  const subsystem = systems[index] ?? "propulsion";
  const current = platform.subsystemHealth.get(subsystem) ?? 100;
  platform.subsystemHealth.set(
    subsystem,
    Math.max(0, current - damage * 1.35),
  );
  const halfBeam = Math.max(
    1,
    Number(platform.model.userData.hullBeam ?? 8) / 2,
  );
  const sideFactor = THREE.MathUtils.clamp(
    Math.abs(localImpact.z) / halfBeam,
    0,
    1,
  );
  const waterlineFactor = THREE.MathUtils.clamp(
    (2.5 - localImpact.y) / 2.5,
    0,
    1,
  );
  const casualtyId = platform.nextCasualtyId++;
  const fire = damage * 0.35;
  const flooding = damage * (0.08 + 0.5 * sideFactor * waterlineFactor);
  platform.casualties.push({
    id: casualtyId,
    zone: zone?.label ?? "UNZONED",
    fire,
    flooding,
    nextTick:
      elapsed + platform.definition.survivability.damageControl.tickInterval,
  });
  if (platform.hullIntegrity <= 0) platform.destroyed = true;
  return {
    subsystem,
    zone: zone?.label ?? "UNZONED",
    casualtyId,
    fire,
    flooding,
  };
}

function platformHullContact(
  platform: EnemyPlatformInstance,
  worldPosition: THREE.Vector3,
) {
  const local = platform.model.worldToLocal(worldPosition.clone());
  const halfLength = Math.max(
    1,
    Number(platform.model.userData.hullLength ?? 15) / 2,
  );
  const halfBeam = Math.max(
    1,
    Number(platform.model.userData.hullBeam ?? 8) / 2,
  );
  const longitudinal = Math.abs(local.x) / halfLength;
  if (longitudinal > 1 || local.y > 8 || local.y < -2) return null;
  const breadthFactor = Math.max(
    0.18,
    Math.sqrt(Math.max(0, 1 - longitudinal * longitudinal)),
  );
  return Math.abs(local.z) <= halfBeam * breadthFactor ? local : null;
}

export function updateSurfaceStrikeMissile(
  missile: SurfaceStrikeMissile,
  dt: number,
  elapsed: number,
  platformEcmEnabled: boolean,
  platformSensorsEnabled: boolean,
  platformDecoys: readonly ChaffCloud[],
) {
  if (missile.phase === "destroyed") return null;
  if (missile.phase === "penetrating") {
    const detonation = missile.pendingDetonation;
    if (!detonation || elapsed < detonation.detonateAt) return null;
    missile.pendingDetonation = null;
    missile.phase = "destroyed";
    const damage = damagePlatform(
      missile,
      missile.damage,
      detonation.localImpact,
      elapsed,
    );
    return {
      kind: "hit",
      missile,
      damage: missile.damage,
      subsystem: damage.subsystem,
      zone: damage.zone,
      impactPoint: detonation.impactPoint,
      localImpact: detonation.localImpact,
      casualtyId: damage.casualtyId,
      fire: damage.fire,
      flooding: damage.flooding,
      platformDestroyed: missile.target.destroyed,
    } satisfies SurfaceStrikeEvent;
  }
  if (missile.target.destroyed && missile.targetLostAt === null) {
    missile.targetLostAt = elapsed;
    missile.commandPoint.copy(missile.target.model.position);
    missile.commandVelocity.set(0, 0, 0);
    missile.datalinkValid = false;
    missile.seekerAcquired = false;
    missile.mesh.userData.seekerState = "TARGET LOST";
  }
  missile.age += dt;
  missile.commandPoint.addScaledVector(missile.commandVelocity, dt);
  const previous = missile.mesh.position.clone();
  const trueTargetPosition = missile.target.model.position;
  const commandRange = missile.mesh.position.distanceTo(missile.commandPoint);
  const trueRange = missile.mesh.position.distanceTo(trueTargetPosition);
  const profile = getThreatDefinition("RGM-84 Harpoon").profile;
  const terminal = commandRange < profile.terminalAt;
  missile.phase = missile.age < 1.35 ? "boost" : terminal ? "terminal" : "midcourse";
  if (terminal && missile.terminalEnteredAt === null)
    missile.terminalEnteredAt = elapsed;
  const platformTrack = updatePlatformIncomingTrack(
    missile,
    dt,
    elapsed,
    platformSensorsEnabled,
  );

  if (terminal && !missile.seekerLogged) {
    missile.seekerLogged = true;
    missile.mesh.userData.seekerState = "ACTIVE SEARCH";
    return { kind: "seeker-search", missile } satisfies SurfaceStrikeEvent;
  }

  if (
    terminal &&
    !missile.seekerAcquired &&
    missile.targetLostAt === null
  ) {
    const targetDirection = trueTargetPosition
        .clone()
        .sub(missile.mesh.position)
        .normalize(),
      offBoresight = missile.velocity
        .clone()
        .normalize()
        .angleTo(targetDirection),
      fieldOfView = THREE.MathUtils.degToRad(
        profile.seekerFieldOfViewDeg ?? 50,
      ),
      acquisitionRange =
        profile.terminalAt * (profile.seekerAcquisitionRangeFactor ?? 1.15);
    if (trueRange <= acquisitionRange && offBoresight <= fieldOfView / 2) {
      missile.seekerAcquired = true;
      missile.datalinkValid = false;
      missile.mesh.userData.seekerState = "ACTIVE / ACQUIRED";
      return {
        kind: "seeker-acquired",
        missile,
        range: trueRange,
        offBoresightDeg: THREE.MathUtils.radToDeg(offBoresight),
      } satisfies SurfaceStrikeEvent;
    }
  }

  const softKill = missile.target.definition.survivability.softKill;
  if (
    terminal &&
    missile.seekerAcquired &&
    !missile.softKillResolved &&
    trueRange <= softKill.decoyDeployRange
  ) {
    missile.softKillResolved = true;
    const nearestDecoy = platformDecoys
      .filter((cloud) => cloud.rcs > 0.1)
      .sort(
        (a, b) =>
          a.position.distanceToSquared(missile.mesh.position) -
          b.position.distanceToSquared(missile.mesh.position),
      )[0];
    const ecmHealth =
      (missile.target.subsystemHealth.get("electronic-warfare") ?? 100) / 100;
    const ecmAvailable = platformEcmEnabled && ecmHealth > 0.05;
    if (!ecmAvailable && !nearestDecoy) {
      missile.mesh.userData.seekerState = "ACTIVE / NO COUNTERMEASURES";
    } else {
      const ecmInterference = ecmAvailable
        ? THREE.MathUtils.clamp(
            Math.pow(trueRange / Math.max(1, softKill.burnThroughRange), 2) *
              softKill.ecmStrength *
              ecmHealth,
            0,
            1,
          )
        : 0;
      const targetPower =
        missile.target.definition.radarCrossSection /
        Math.pow(Math.max(1, trueRange), 4);
      const decoyRange = nearestDecoy
        ? nearestDecoy.position.distanceTo(missile.mesh.position)
        : Infinity;
      const decoyPower = nearestDecoy
        ? nearestDecoy.rcs / Math.pow(Math.max(1, decoyRange), 4)
        : 0;
      const decoyCapture =
        decoyPower > 0 ? decoyPower / (decoyPower + targetPower) : 0;
      const hojThreshold =
        profile.homeOnJam?.minimumJammingStrength ?? Infinity;
      const homeOnJam = ecmInterference >= hojThreshold;
      const pk = THREE.MathUtils.clamp(
        (decoyCapture * (0.52 + ecmInterference * 0.28) +
          ecmInterference * 0.04) *
          (homeOnJam ? 0.62 : 1),
        0,
        0.78,
      );
      if (deterministicRoll(missile, 1) < pk) {
        missile.phase = "destroyed";
        missile.mesh.visible = false;
        missile.path.visible = false;
        return {
          kind: "soft-kill",
          missile,
          pk,
          mode:
            decoyCapture > 0.05
              ? ecmInterference > 0.08
                ? "ECM + DECOY"
                : "DECOY"
              : "ECM",
        } satisfies SurfaceStrikeEvent;
      }
      missile.mesh.userData.seekerState =
        trueRange <= softKill.burnThroughRange
          ? "ACTIVE / BURN THROUGH"
          : homeOnJam
            ? "ACTIVE / HOJ"
            : ecmInterference > 0.08
              ? "ACTIVE / ECM CONTESTED"
              : nearestDecoy
                ? "ACTIVE / DECOY REJECTED"
                : "ACTIVE";
    }
  }

  const pointDefense = missile.target.definition.survivability.pointDefense;
  const capability = pointDefenseCapability(missile.target);
  const defenseTrackRange = platformTrack.track.position.distanceTo(
    missile.target.model.position,
  );
  if (
    missile.pendingPointDefense &&
    elapsed >= missile.pendingPointDefense.resolveAt
  ) {
    const shot = missile.pendingPointDefense;
    missile.pendingPointDefense = null;
    if (shot.willHit) {
      missile.phase = "destroyed";
      missile.mesh.visible = false;
      missile.path.visible = false;
      return {
        kind: "point-defense",
        missile,
        ...shot,
      } satisfies SurfaceStrikeEvent;
    }
    return {
      kind: "point-defense-miss",
      missile,
      ...shot,
    } satisfies SurfaceStrikeEvent;
  }
  const availableChannel = missile.target.pointDefenseChannelReady.findIndex(
    (readyAt, index) =>
      index < capability.effectiveChannels && elapsed >= readyAt,
  );
  const priorityTrack = pointDefensePriorityTracks(missile.target, elapsed).find(
    (track) =>
      pointDefenseMountSolution(
        missile.target,
        track.position,
        elapsed,
      ) !== null,
  );
  const pointDefenseEligible =
    !missile.target.destroyed &&
    terminal &&
    platformTrack.valid &&
    elapsed >= platformTrack.track.fireControlReadyAt &&
    priorityTrack?.missileId === missile.id &&
    defenseTrackRange < pointDefense.range &&
    missile.pointDefenseEngagements < pointDefense.engagementsPerTarget &&
    !missile.pendingPointDefense;
  if (
    pointDefenseEligible &&
    capability.effectiveChannels <= 0 &&
    !missile.target.pointDefenseOfflineLogged
  ) {
    missile.target.pointDefenseOfflineLogged = true;
    return {
      kind: "point-defense-offline",
      missile,
    } satisfies SurfaceStrikeEvent;
  }
  if (
    pointDefenseEligible &&
    missile.target.pointDefenseEngagementsRemaining <= 0 &&
    !missile.target.pointDefenseDepletedLogged
  ) {
    missile.target.pointDefenseDepletedLogged = true;
    return {
      kind: "point-defense-depleted",
      missile,
    } satisfies SurfaceStrikeEvent;
  }
  if (
    pointDefenseEligible &&
    missile.target.pointDefenseEngagementsRemaining > 0 &&
    availableChannel >= 0
  ) {
    const mountSolution = pointDefenseMountSolution(
      missile.target,
      platformTrack.track.position,
      elapsed,
      true,
    );
    if (!mountSolution) return null;
    missile.target.pointDefenseEngagementsRemaining--;
    missile.pointDefenseEngagements++;
    platformTrack.track.engagements++;
    const health =
      capability.health;
    const pk = THREE.MathUtils.clamp(
      (pointDefense.basePk -
        Math.max(0, platformTrack.track.localTrackDensity - 1) *
          pointDefense.localSaturationPenalty) *
        health *
        THREE.MathUtils.lerp(0.62, 1, platformTrack.track.quality) *
        THREE.MathUtils.clamp(1 - platformTrack.track.uncertainty / 32, 0.55, 1),
      0.05,
      0.72,
    );
    const engagement = missile.pointDefenseEngagements;
    const engagementData = {
      pk,
      threatScore: platformTrack.track.threatScore,
      estimatedTimeToImpact: platformTrack.track.estimatedTimeToImpact,
      localTrackDensity: platformTrack.track.localTrackDensity,
      engagement,
      maximumEngagements: pointDefense.engagementsPerTarget,
    };
    const timeOfFlight = Math.max(
      pointDefense.minimumTimeOfFlight,
      defenseTrackRange / Math.max(1, pointDefense.effectorSpeed),
    );
    const resolveAt = elapsed + timeOfFlight;
    missile.target.pointDefenseChannelReady[availableChannel] = Math.max(
      elapsed +
        pointDefense.interval * capability.cycleMultiplier,
      resolveAt,
    );
    platformTrack.track.nextEngagementReadyAt =
      resolveAt + pointDefense.reengagementDelay;
    missile.pendingPointDefense = {
      resolveAt,
      ...engagementData,
      willHit:
        deterministicRoll(
          missile,
          3 + engagement * 5.17 + Math.floor(missile.age),
        ) < pk,
    };
    return {
      kind: "point-defense-fire",
      missile,
      pk,
      timeOfFlight,
      engagement,
      maximumEngagements: pointDefense.engagementsPerTarget,
      engagementsRemaining: missile.target.pointDefenseEngagementsRemaining,
      mountId: mountSolution.mount.id,
      origin: mountSolution.origin,
      targetBearing: mountSolution.targetBearing,
    } satisfies SurfaceStrikeEvent;
  }

  const desiredAltitude =
    missile.phase === "boost"
      ? Math.max(4.5, missile.mesh.position.y)
      : terminal
        ? 0.12
        : 0.9;
  const weave = terminal
    ? new THREE.Vector3(
        Math.sin(missile.age * 2.8) * 0.38,
        0,
        Math.cos(missile.age * 2.25) * 0.22,
      )
    : new THREE.Vector3();
  const routeWeight = terminal
    ? 0
    : THREE.MathUtils.smoothstep(
        commandRange,
        profile.terminalAt,
        Math.max(profile.terminalAt + 1, missile.routeJoinRange),
      );
  const aimPosition = missile.seekerAcquired
    ? trueTargetPosition
        .clone()
        .addScaledVector(
          missile.target.velocity,
          Math.min(6, trueRange / Math.max(1, missile.velocity.length())),
        )
    : missile.commandPoint
        .clone()
        .addScaledVector(missile.routeOffset, routeWeight);
  const aim = aimPosition
    .clone()
    .add(weave)
    .setY(desiredAltitude)
    .sub(missile.mesh.position)
    .normalize();
  const current = missile.velocity.clone().normalize();
  const angle = current.angleTo(aim);
  const maxTurn = THREE.MathUtils.degToRad(terminal ? 32 : 11.5) * dt;
  const direction = current.lerp(aim, angle > 0 ? Math.min(1, maxTurn / angle) : 1).normalize();
  const baseCruiseSpeed = 5.8;
  const remainingArrivalTime = missile.plannedArrivalAt - elapsed;
  const coordinatedCruiseSpeed = THREE.MathUtils.clamp(
    commandRange / Math.max(1, remainingArrivalTime),
    baseCruiseSpeed * (1 - missile.maximumSpeedCompensation * 0.35),
    baseCruiseSpeed * (1 + missile.maximumSpeedCompensation),
  );
  const targetSpeed =
    missile.phase === "boost"
      ? 6.1
      : terminal
        ? 6.4
        : coordinatedCruiseSpeed;
  const speed = THREE.MathUtils.lerp(missile.velocity.length(), targetSpeed, Math.min(1, dt * 1.1));
  missile.velocity.copy(direction.multiplyScalar(speed));
  missile.mesh.position.addScaledVector(missile.velocity, dt);
  missile.mesh.position.y = Math.max(
    0.08,
    THREE.MathUtils.lerp(
      missile.mesh.position.y,
      desiredAltitude,
      Math.min(1, dt * (terminal ? 1.4 : 0.55)),
    ),
  );
  missile.distanceTraveled += missile.mesh.position.distanceTo(previous);
  missile.mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    missile.velocity.clone().normalize(),
  );

  const particleTrail = missile.mesh.userData.particleTrail as
    | ThreatParticleTrail
    | undefined;
  if (particleTrail)
    updateThreatParticleTrail(
      particleTrail,
      elapsed + missile.id * 0.11,
      1,
      terminal,
    );

  if (
    missile.history.length === 0 ||
    missile.mesh.position.distanceTo(missile.history.at(-1)!) > 2.5
  ) {
    missile.history.push(missile.mesh.position.clone());
    if (missile.history.length > 90) missile.history.shift();
    missile.path.geometry.dispose();
    missile.path.geometry = new THREE.BufferGeometry().setFromPoints(
      missile.history,
    );
  }

  const postRange = missile.mesh.position.distanceTo(trueTargetPosition);
  const postCommandRange = missile.mesh.position.distanceTo(
    missile.commandPoint,
  );
  const previousClosest = missile.closestTargetRange;
  const previousCommandClosest = missile.closestCommandRange;
  missile.closestTargetRange = Math.min(previousClosest, postRange);
  missile.closestCommandRange = Math.min(
    previousCommandClosest,
    postCommandRange,
  );
  const localImpact = missile.seekerAcquired
    ? platformHullContact(missile.target, missile.mesh.position)
    : null;
  if (missile.seekerAcquired && localImpact) {
    missile.phase = "penetrating";
    missile.mesh.visible = false;
    missile.path.visible = false;
    missile.velocity.set(0, 0, 0);
    const zone = platformDamageZone(missile, localImpact)?.label ?? "UNZONED";
    const impactPoint = missile.mesh.position.clone();
    missile.pendingDetonation = {
      detonateAt: elapsed + missile.fuseDelay,
      impactPoint,
      localImpact: localImpact.clone(),
      zone,
    };
    return {
      kind: "penetration",
      missile,
      impactPoint,
      localImpact,
      zone,
      fuseDelay: missile.fuseDelay,
    } satisfies SurfaceStrikeEvent;
  }
  if (
    missile.seekerAcquired &&
    previousClosest < 13 &&
    postRange > previousClosest + 0.8
  ) {
    missile.phase = "destroyed";
    missile.mesh.visible = false;
    missile.path.visible = false;
    return {
      kind: "miss",
      missile,
      reason: "SEEKER PASS / HULL MISS",
    } satisfies SurfaceStrikeEvent;
  }
  if (
    terminal &&
    !missile.seekerAcquired &&
    (missile.targetLostAt === null
      ? previousCommandClosest < 13 &&
        postCommandRange > previousCommandClosest + 0.8
      : elapsed - missile.targetLostAt >
          (profile.targetLostCoastSeconds ?? 8) &&
        ((previousCommandClosest < 13 &&
          postCommandRange > previousCommandClosest + 0.8) ||
          elapsed - missile.targetLostAt >
            (profile.targetLostCoastSeconds ?? 8) * 1.5))
  ) {
    missile.phase = "destroyed";
    missile.mesh.visible = false;
    missile.path.visible = false;
    return {
      kind: "miss",
      missile,
      reason:
        missile.targetLostAt === null
          ? "SEEKER ACQUISITION FAILED"
          : "TARGET DESTROYED / AIMPOINT LOST",
    } satisfies SurfaceStrikeEvent;
  }
  return platformTrack.event;
}
