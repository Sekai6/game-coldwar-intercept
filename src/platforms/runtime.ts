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
  targetPosition: THREE.Vector3,
) {
  for (const sensor of platform.slots.rotatingSensors)
    sensor.rotation.y = elapsed * 0.42;
  const range = platform.model.position.distanceTo(targetPosition);
  for (const definition of platform.definition.sensorSlots) {
    const state = platform.sensorState.get(definition.id)!;
    if (elapsed < state.nextUpdate) continue;
    state.nextUpdate = elapsed + definition.updateInterval;
    const ratio = range / Math.max(1, definition.maxRange);
    state.quality =
      ratio <= 1
        ? THREE.MathUtils.clamp((1 - ratio * ratio) * definition.precision, 0, 1)
        : 0;
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
}
