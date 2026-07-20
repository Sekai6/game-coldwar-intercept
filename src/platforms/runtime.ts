import * as THREE from "three";
import type { EnemyType } from "../threats/catalog";
import type {
  EnemyPlatformDefinition,
  EnemyPlatformInstance,
  EnemyPlatformModelSlots,
  PlatformLaunchReservation,
} from "./types";

function modelSlots(model: THREE.Group) {
  return model.userData.platformSlots as EnemyPlatformModelSlots | undefined;
}

function validateModelSlots(
  definition: EnemyPlatformDefinition,
  slots: EnemyPlatformModelSlots,
) {
  const hardpointIds = new Set<string>();
  for (const hardpoint of slots.weaponHardpoints) {
    if (hardpointIds.has(hardpoint.id))
      throw new Error(`${definition.id}: duplicate hardpoint ${hardpoint.id}`);
    hardpointIds.add(hardpoint.id);
    if (!definition.weaponSlots.some((slot) => slot.id === hardpoint.slotId))
      throw new Error(
        `${definition.id}: hardpoint ${hardpoint.id} references unknown slot ${hardpoint.slotId}`,
      );
  }
  for (const slot of definition.weaponSlots) {
    const count = slots.weaponHardpoints.filter(
      (hardpoint) => hardpoint.slotId === slot.id,
    ).length;
    if (count !== slot.capacity)
      throw new Error(
        `${definition.id}: ${slot.id} declares ${slot.capacity} rounds but model exposes ${count}`,
      );
  }
  for (const sensor of definition.sensorSlots)
    if (!slots.sensorAnchors[sensor.anchorId])
      throw new Error(
        `${definition.id}: sensor ${sensor.id} is missing anchor ${sensor.anchorId}`,
      );
}

export function instantiateEnemyPlatform(
  definition: EnemyPlatformDefinition,
  position: THREE.Vector3,
  heading: number,
) {
  const model = definition.buildModel();
  const slots = modelSlots(model);
  if (!slots) throw new Error(`${definition.id}: model has no platformSlots`);
  validateModelSlots(definition, slots);
  model.position.copy(position);
  model.rotation.y = heading;
  model.updateMatrixWorld(true);
  const instance: EnemyPlatformInstance = {
    definition,
    model,
    slots,
    hardpointState: new Map(
      slots.weaponHardpoints.map((hardpoint) => [hardpoint.id, "ready"]),
    ),
    sensorState: new Map(
      definition.sensorSlots.map((sensor) => [
        sensor.id,
        { nextUpdate: 0, quality: 0 },
      ]),
    ),
    weaponSlotNextLaunch: new Map(
      definition.weaponSlots.map((slot) => [slot.id, 0]),
    ),
    weaponSlotNextRelease: new Map(
      definition.weaponSlots.map((slot) => [slot.id, 0]),
    ),
    weaponTrackAge: new Map(
      definition.weaponSlots.map((slot) => [slot.id, 0]),
    ),
    weaponTrackReadyLogged: new Set(),
    hullIntegrity: definition.survivability.hull,
    subsystemHealth: new Map([
      ...definition.sensorSlots.map((sensor) => [sensor.id, 100] as const),
      ...definition.weaponSlots.map((slot) => [slot.id, 100] as const),
      ["propulsion", 100] as const,
      ["point-defense", 100] as const,
      ["electronic-warfare", 100] as const,
    ]),
    nextPointDefense: 0,
    velocity: new THREE.Vector3(),
    speedKnots: 0,
    desiredHeading: heading,
    destroyed: false,
  };
  return instance;
}

export function reservePlatformLaunches(
  platform: EnemyPlatformInstance,
  threat: EnemyType,
  requestedCount: number,
  firstLaunchAt: number,
  requestedInterval: number,
) {
  const weaponSlot = platform.definition.weaponSlots.find((slot) =>
    slot.compatibleThreats.includes(threat),
  );
  if (!weaponSlot)
    throw new Error(
      `${platform.definition.id}: no launcher slot supports ${threat}`,
    );
  const hardpoints = platform.slots.weaponHardpoints.filter(
    (hardpoint) =>
      hardpoint.slotId === weaponSlot.id &&
      platform.hardpointState.get(hardpoint.id) === "ready",
  );
  const count = Math.min(Math.max(0, requestedCount), hardpoints.length);
  const interval = Math.max(weaponSlot.minimumInterval, requestedInterval);
  const slotStart = Math.max(
    firstLaunchAt,
    platform.weaponSlotNextLaunch.get(weaponSlot.id) ?? 0,
  );
  const reservations: PlatformLaunchReservation[] = [];
  for (let index = 0; index < count; index++) {
    const hardpoint = hardpoints[index];
    platform.hardpointState.set(hardpoint.id, "reserved");
    reservations.push({
      platform,
      hardpoint,
      weaponSlot,
      threat,
      launchAt: slotStart + index * interval,
      releaseInterval: interval,
    });
  }
  if (count > 0)
    platform.weaponSlotNextLaunch.set(
      weaponSlot.id,
      slotStart + count * interval,
    );
  return reservations;
}

export function reservationOrigin(reservation: PlatformLaunchReservation) {
  reservation.platform.model.updateMatrixWorld(true);
  return reservation.hardpoint.mount.getWorldPosition(new THREE.Vector3());
}

export function reservationDirection(reservation: PlatformLaunchReservation) {
  const quaternion = reservation.hardpoint.mount.getWorldQuaternion(
    new THREE.Quaternion(),
  );
  return reservation.hardpoint.localDirection
    .clone()
    .applyQuaternion(quaternion)
    .normalize();
}

export function platformDepartureSolution(
  reservation: PlatformLaunchReservation,
  age: number,
  position: THREE.Vector3,
  targetPosition: THREE.Vector3,
  cruiseAltitude: number,
  cruiseSpeed: number,
) {
  const launchProfile = reservation.weaponSlot;
  if (age >= launchProfile.guidanceTakeover) return null;
  const launchDirection = reservationDirection(reservation);
  const cruiseAim = targetPosition
    .clone()
    .setY(Math.max(cruiseAltitude, 2.2))
    .sub(position)
    .normalize();
  const turnBlend = THREE.MathUtils.smoothstep(
    age,
    launchProfile.boostDuration * 0.52,
    launchProfile.guidanceTakeover,
  );
  const direction = launchDirection.lerp(cruiseAim, turnBlend).normalize();
  const speed = THREE.MathUtils.lerp(
    launchProfile.exitSpeed,
    cruiseSpeed,
    THREE.MathUtils.smoothstep(age, 0, launchProfile.boostDuration),
  );
  return {
    direction,
    speed,
    phase:
      age < launchProfile.boostDuration
        ? ("BOOST" as const)
        : ("PROGRAM TURN" as const),
  };
}

export function releasePlatformHardpoint(
  reservation: PlatformLaunchReservation,
) {
  const state = reservation.platform.hardpointState.get(
    reservation.hardpoint.id,
  );
  if (state === "fired") return false;
  reservation.platform.hardpointState.set(reservation.hardpoint.id, "fired");
  if (reservation.hardpoint.cover) {
    if (reservation.hardpoint.coverMode === "hinged")
      reservation.hardpoint.cover.rotation.z = -Math.PI * 0.62;
    else reservation.hardpoint.cover.visible = false;
  }
  return true;
}

export function updateEnemyPlatform(
  platform: EnemyPlatformInstance,
  elapsed: number,
  dt: number,
  targetPosition: THREE.Vector3,
) {
  const sensorHealth = platform.destroyed
    ? 0
    : platform.definition.sensorSlots.reduce(
        (sum, sensor) => sum + (platform.subsystemHealth.get(sensor.id) ?? 100),
        0,
      ) / Math.max(1, platform.definition.sensorSlots.length * 100);
  for (const sensor of platform.slots.rotatingSensors)
    sensor.rotation.y += 0.007 * sensorHealth;
  const propulsion =
      (platform.subsystemHealth.get("propulsion") ?? 100) / 100,
    mobility = platform.definition.mobility,
    toTarget = targetPosition.clone().sub(platform.model.position).setY(0),
    targetRange = toTarget.length();
  if (targetRange > 1) {
    const axis = toTarget.normalize(),
      beam = new THREE.Vector3(-axis.z, 0, axis.x);
    platform.desiredHeading = Math.atan2(-beam.z, beam.x);
  }
  const maximumSpeed =
      mobility.maxSpeedKnots * propulsion * Math.max(0.35, platform.hullIntegrity / 100),
    commandedSpeed = platform.destroyed
      ? 0
      : Math.min(maximumSpeed, mobility.cruiseSpeedKnots),
    speedStep = mobility.accelerationKnotsPerSecond * (0.2 + 0.8 * propulsion) * dt;
  platform.speedKnots += THREE.MathUtils.clamp(
    commandedSpeed - platform.speedKnots,
    -speedStep,
    speedStep,
  );
  const headingError = Math.atan2(
      Math.sin(platform.desiredHeading - platform.model.rotation.y),
      Math.cos(platform.desiredHeading - platform.model.rotation.y),
    ),
    turnRate = THREE.MathUtils.degToRad(mobility.turnRateDeg) * (0.25 + 0.75 * propulsion);
  platform.model.rotation.y += THREE.MathUtils.clamp(
    headingError,
    -turnRate * dt,
    turnRate * dt,
  );
  const forward = new THREE.Vector3(1, 0, 0).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    platform.model.rotation.y,
  );
  platform.velocity.copy(forward).multiplyScalar(platform.speedKnots * 0.005144);
  platform.model.position.addScaledVector(platform.velocity, dt);
  const range = platform.model.position.distanceTo(targetPosition);
  for (const definition of platform.definition.sensorSlots) {
    const state = platform.sensorState.get(definition.id)!;
    if (elapsed < state.nextUpdate) continue;
    state.nextUpdate = elapsed + definition.updateInterval;
    const ratio = range / Math.max(1, definition.maxRange);
    const health = (platform.subsystemHealth.get(definition.id) ?? 100) / 100;
    state.quality =
      ratio <= 1
        ? THREE.MathUtils.clamp(
            (1 - ratio * ratio) * definition.precision * health,
            0,
            1,
          )
        : 0;
  }
  const bestTrackQuality = Math.max(
    0,
    ...[...platform.sensorState.values()].map((state) => state.quality),
  );
  for (const slot of platform.definition.weaponSlots) {
    const sufficient = bestTrackQuality >= slot.minimumTrackQuality;
    platform.weaponTrackAge.set(
      slot.id,
      sufficient ? (platform.weaponTrackAge.get(slot.id) ?? 0) + dt : 0,
    );
    if (!sufficient) platform.weaponTrackReadyLogged.delete(slot.id);
  }
}

export function disposeEnemyPlatform(platform: EnemyPlatformInstance) {
  platform.model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => material.dispose());
  });
  platform.hardpointState.clear();
  platform.sensorState.clear();
  platform.weaponSlotNextLaunch.clear();
  platform.weaponSlotNextRelease.clear();
  platform.weaponTrackAge.clear();
  platform.weaponTrackReadyLogged.clear();
  platform.subsystemHealth.clear();
}
