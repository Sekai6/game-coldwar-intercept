import * as THREE from "three";
import type { EnemyPlatformInstance } from "./platforms/types";
import type { ModelWeaponHardpoint, ShipDefinition } from "./ship-types";
import { getThreatDefinition } from "./threats/catalog";
import {
  updateThreatParticleTrail,
  type ThreatParticleTrail,
} from "./visual/threat-particles";

export type SurfaceStrikePhase =
  | "boost"
  | "midcourse"
  | "terminal"
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
  seekerLogged: boolean;
  softKillResolved: boolean;
  launchSlot: string;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  nextDatalink: number;
  datalinkValid: boolean;
  history: THREE.Vector3[];
  closestTargetRange: number;
  closestCommandRange: number;
  pointDefenseEngagements: number;
  lastDatalinkQuality: number;
  seekerAcquired: boolean;
  targetLostAt: number | null;
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
  | { kind: "soft-kill"; missile: SurfaceStrikeMissile }
  | { kind: "point-defense"; missile: SurfaceStrikeMissile; pk: number }
  | {
      kind: "hit";
      missile: SurfaceStrikeMissile;
      damage: number;
      subsystem: string;
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
    seekerLogged: false,
    softKillResolved: false,
    launchSlot: hardpoint.id,
    commandPoint: commandPoint.clone(),
    commandVelocity: commandVelocity.clone(),
    nextDatalink: 0,
    datalinkValid: true,
    history,
    closestTargetRange: Infinity,
    closestCommandRange: Infinity,
    pointDefenseEngagements: 0,
    lastDatalinkQuality: -1,
    seekerAcquired: false,
    targetLostAt: null,
  };
}

function deterministicRoll(missile: SurfaceStrikeMissile, salt: number) {
  const raw = Math.sin(missile.id * 91.17 + salt * 37.21) * 43758.5453;
  return raw - Math.floor(raw);
}

function damagePlatform(
  missile: SurfaceStrikeMissile,
  damage: number,
) {
  const platform = missile.target;
  platform.hullIntegrity = Math.max(0, platform.hullIntegrity - damage);
  const systems = [...platform.subsystemHealth.keys()];
  const index = Math.floor(deterministicRoll(missile, 8) * systems.length);
  const subsystem = systems[index] ?? "propulsion";
  const current = platform.subsystemHealth.get(subsystem) ?? 100;
  platform.subsystemHealth.set(
    subsystem,
    Math.max(0, current - damage * 1.35),
  );
  if (platform.hullIntegrity <= 0) platform.destroyed = true;
  return subsystem;
}

export function updateSurfaceStrikeMissile(
  missile: SurfaceStrikeMissile,
  dt: number,
  elapsed: number,
  localTerminalDensity: number,
  softKillEnabled: boolean,
) {
  if (missile.phase === "destroyed") return null;
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
  const defenseRange = missile.seekerAcquired ? trueRange : commandRange;
  missile.phase = missile.age < 1.35 ? "boost" : terminal ? "terminal" : "midcourse";

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

  if (terminal && missile.seekerAcquired && !missile.softKillResolved) {
    missile.softKillResolved = true;
    if (!softKillEnabled) {
      missile.mesh.userData.seekerState = "ACTIVE / NO JAM";
    } else {
    const ecmHealth =
      (missile.target.subsystemHealth.get("electronic-warfare") ?? 100) / 100;
    const pk = missile.target.definition.survivability.softKillPk * ecmHealth;
    if (deterministicRoll(missile, 1) < pk) {
      missile.phase = "destroyed";
      missile.mesh.visible = false;
      missile.path.visible = false;
      return { kind: "soft-kill", missile } satisfies SurfaceStrikeEvent;
    }
    missile.mesh.userData.seekerState = "ACTIVE / HOJ";
    }
  }

  const pointDefense = missile.target.definition.survivability.pointDefense;
  if (
    !missile.target.destroyed &&
    terminal &&
    defenseRange < pointDefense.range &&
    missile.pointDefenseEngagements < pointDefense.engagementsPerTarget &&
    elapsed >= missile.target.nextPointDefense
  ) {
    missile.target.nextPointDefense = elapsed + pointDefense.interval;
    missile.pointDefenseEngagements++;
    const health =
      (missile.target.subsystemHealth.get("point-defense") ?? 100) / 100;
    const pk = THREE.MathUtils.clamp(
      (pointDefense.basePk -
        Math.max(0, localTerminalDensity - 1) *
          pointDefense.localSaturationPenalty) *
        health,
      0.05,
      0.72,
    );
    if (deterministicRoll(missile, 3 + Math.floor(missile.age * 2)) < pk) {
      missile.phase = "destroyed";
      missile.mesh.visible = false;
      missile.path.visible = false;
      return { kind: "point-defense", missile, pk } satisfies SurfaceStrikeEvent;
    }
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
  const aimPosition = missile.seekerAcquired
    ? trueTargetPosition
        .clone()
        .addScaledVector(
          missile.target.velocity,
          Math.min(6, trueRange / Math.max(1, missile.velocity.length())),
        )
    : missile.commandPoint;
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
  const targetSpeed = missile.phase === "boost" ? 6.1 : terminal ? 6.4 : 5.8;
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
  if (
    missile.seekerAcquired &&
    (postRange < 7.5 ||
      (previousClosest < 13 && postRange > previousClosest + 0.8))
  ) {
    missile.phase = "destroyed";
    missile.mesh.visible = false;
    missile.path.visible = false;
    const subsystem = damagePlatform(missile, missile.damage);
    return {
      kind: "hit",
      missile,
      damage: missile.damage,
      subsystem,
      platformDestroyed: missile.target.destroyed,
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
  return null;
}
