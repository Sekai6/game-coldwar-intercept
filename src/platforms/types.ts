import type * as THREE from "three";
import type { EnemyType } from "../threats/catalog";

export type EnemyPlatformId = string;
export type PlatformSensorRole =
  | "air-search"
  | "surface-search"
  | "fire-control"
  | "electronic-support";
export type PlatformLauncherFamily =
  | "inclined-canister"
  | "vertical-cell"
  | "trainable-rail";

export interface PlatformSensorSlot {
  id: string;
  displayName: string;
  role: PlatformSensorRole;
  anchorId: string;
  maxRange: number;
  updateInterval: number;
  precision: number;
}

export interface PlatformWeaponSlot {
  id: string;
  displayName: string;
  family: PlatformLauncherFamily;
  compatibleThreats: readonly EnemyType[];
  capacity: number;
  minimumInterval: number;
  exitSpeed: number;
  boostDuration: number;
  guidanceTakeover: number;
}

export interface PlatformWeaponHardpoint {
  id: string;
  slotId: string;
  mount: THREE.Object3D;
  localDirection: THREE.Vector3;
  cover?: THREE.Object3D;
  coverMode?: "blow-off" | "hinged";
}

export interface EnemyPlatformModelSlots {
  weaponHardpoints: PlatformWeaponHardpoint[];
  sensorAnchors: Record<string, THREE.Object3D>;
  rotatingSensors: THREE.Object3D[];
}

export interface EnemyPlatformDefinition<Id extends string = string> {
  id: Id;
  name: string;
  className: string;
  nation: string;
  era: string;
  role: string;
  radarCrossSection: number;
  defaultThreat: EnemyType;
  sensorSlots: readonly PlatformSensorSlot[];
  weaponSlots: readonly PlatformWeaponSlot[];
  buildModel: () => THREE.Group;
}

export interface EnemyPlatformInstance {
  definition: EnemyPlatformDefinition;
  model: THREE.Group;
  slots: EnemyPlatformModelSlots;
  hardpointState: Map<string, "ready" | "reserved" | "fired">;
  sensorState: Map<string, { nextUpdate: number; quality: number }>;
  weaponSlotNextLaunch: Map<string, number>;
}

export interface PlatformLaunchReservation {
  platform: EnemyPlatformInstance;
  hardpoint: PlatformWeaponHardpoint;
  weaponSlot: PlatformWeaponSlot;
  threat: EnemyType;
  launchAt: number;
}
