import * as THREE from "three";
import type {
  EnemyPlatformModelSlots,
  PlatformWeaponHardpoint,
} from "./types";

export function createPlatformModelSlots(): EnemyPlatformModelSlots {
  return {
    weaponHardpoints: [],
    sensorAnchors: {},
    rotatingSensors: [],
  };
}

export function addWeaponHardpoint(
  slots: EnemyPlatformModelSlots,
  mount: THREE.Object3D,
  id: string,
  slotId: string,
  localDirection: THREE.Vector3,
  cover?: THREE.Object3D,
  coverMode: PlatformWeaponHardpoint["coverMode"] = "blow-off",
  salvoGroup?: string,
) {
  const hardpoint: PlatformWeaponHardpoint = {
    id,
    slotId,
    mount,
    localDirection: localDirection.clone().normalize(),
    cover,
    coverMode,
    salvoGroup,
  };
  slots.weaponHardpoints.push(hardpoint);
  return hardpoint;
}

export function addSensorAnchor(
  slots: EnemyPlatformModelSlots,
  id: string,
  anchor: THREE.Object3D,
  rotating = false,
) {
  slots.sensorAnchors[id] = anchor;
  if (rotating) slots.rotatingSensors.push(anchor);
  return anchor;
}
