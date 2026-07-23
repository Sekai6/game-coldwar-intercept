import type * as THREE from "three";
import type { CombatEntity, CombatSide } from "../combat-entity";
import type { EnemyType } from "../threats/catalog";
import type { FormationStatus } from "./formation";

export type AirMissionOrder = "cap" | "intercept" | "escort" | "anti-ship" | "egress" | "return";
export type AirGuidance = "active-radar" | "semi-active-radar" | "infrared" | "anti-ship-radar";
export type AirPlatformId = "F-14A" | "TU-16K" | "A-6E";
export type AirWeaponId = "AIM-54A" | "AIM-7F" | "AIM-9L" | "KSR-5" | "AGM-84A";
export type AirSubsystem = "structure" | "left-engine" | "right-engine" | "radar" | "flight-control" | "weapons";
export interface CountermeasureReleaseProgram {
  type: "chaff" | "flare";
  remaining: number;
  nextReleaseAt: number;
  interval: number;
}

export interface AirWeaponDefinition {
  id: AirWeaponId;
  name: string;
  targets: readonly ("aircraft" | "ship")[];
  guidance: AirGuidance;
  minRange: number;
  maxRange: number;
  speed: number;
  boostSeconds: number;
  maxTurnRateDeg: number;
  seekerRange: number;
  seekerFovDeg: number;
  datalinkInterval: number;
  damage: number;
  proximityRadius: number;
  countermeasureResistance: number;
  shipDefenseTemplate: EnemyType;
  antiShipFlight?: {
    boostAltitude: number;
    cruiseAltitude: number;
    terminalAltitude: number;
    boostSpeedFactor: number;
    cruiseSpeedFactor: number;
    terminalTurnFactor: number;
  };
}

export interface AirSensorDefinition {
  name: string;
  range: number;
  updateInterval: number;
  fieldOfViewDeg: number;
  precision: number;
}

export interface CountermeasureProgram {
  chaffBurst: number;
  flareBurst: number;
  interval: number;
  cooldown: number;
  triggerTti: number;
}

export interface AirPlatformDefinition {
  id: AirPlatformId;
  name: string;
  nation: string;
  role: string;
  mission: AirMissionOrder;
  radarCrossSection: number;
  infraredSignature: number;
  flight: {
    cruiseSpeed: number;
    maxSpeed: number;
    stallSpeed: number;
    acceleration: number;
    drag: number;
    maxLoadFactor: number;
    maxRollRateDeg: number;
    maxPitchRateDeg: number;
    maxAngleOfAttackDeg?: number;
    fuelSeconds: number;
  };
  sensor: AirSensorDefinition;
  ecm: { strength: number; burnThroughRange: number };
  countermeasures: { chaff: number; flares: number; program: CountermeasureProgram };
  loadout: Readonly<Record<AirWeaponId, number>>;
  fireControlChannels: { datalink: number; illumination: number };
  hardpoints: readonly {
    id: string;
    position: readonly [number, number, number];
    compatibleWeapons: readonly AirWeaponId[];
    releaseDelay: number;
    ignitionDelay: number;
  }[];
  buildModel: () => THREE.Group;
  shipDefenseTemplate: EnemyType;
}

export interface AirShipDefenseContact {
  entity: CombatEntity;
  name: string;
  model: THREE.Group;
  template: EnemyType;
  phase: "inbound" | "boost" | "midcourse" | "terminal";
}

export interface AirTrack {
  targetId: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quality: number;
  uncertainty: number;
  lastUpdate: number;
  classification: "unknown" | "aircraft" | "ship";
}

export interface AirPlatformInstance extends CombatEntity {
  kind: "aircraft";
  definition: AirPlatformDefinition;
  model: THREE.Group;
  formationId: string;
  formationIndex: number;
  leaderId: string | null;
  mission: AirMissionOrder;
  fuel: number;
  heading: THREE.Vector3;
  desiredDirection: THREE.Vector3;
  bank: number;
  tracks: Map<string, AirTrack>;
  ammo: Map<AirWeaponId, number>;
  subsystemHealth: Map<AirSubsystem, number>;
  nextOoda: number;
  nextScan: number;
  nextCountermeasure: number;
  chaff: number;
  flares: number;
  state: "formation" | "engaging" | "defending" | "egress" | "disabled" | "crashed";
  targetId: string | null;
  shotAt: Set<string>;
  missileWarnings: Map<string, AirTrack>;
  hardpoints: AirHardpointInstance[];
  countermeasurePrograms: CountermeasureReleaseProgram[];
  formationStatus: FormationStatus;
  formationError: number;
}

export interface AirHardpointInstance {
  id: string;
  position: THREE.Vector3;
  compatibleWeapons: readonly AirWeaponId[];
  releaseDelay: number;
  ignitionDelay: number;
  weaponId: AirWeaponId | null;
  mountedModel: THREE.Group | null;
  state: "ready" | "reserved" | "releasing" | "empty" | "damaged";
  releaseAt: number;
  targetId: string | null;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  trackQuality: number;
}

export interface AirMissileInstance extends CombatEntity {
  kind: "missile";
  definition: AirWeaponDefinition;
  model: THREE.Group;
  shooterId: string;
  targetId: string;
  age: number;
  phase: "boost" | "midcourse" | "terminal" | "destroyed";
  commandPoint: THREE.Vector3;
  nextDatalink: number;
  seekerAcquired: boolean;
  illuminationLostAt: number | null;
  softKillResolved?: boolean;
  ignitionDelay: number;
  releaseAge: number;
  nextSeekerAttempt: number;
}

export interface AirDecoyInstance extends CombatEntity {
  kind: "decoy";
  decoyType: "chaff" | "flare";
  model: THREE.Object3D;
  age: number;
  life: number;
}

export interface AirScenarioContext {
  blueShip: CombatEntity;
  redShip: CombatEntity | null;
  countermeasures?: (targetId: string) => {
    ecmEnabled: boolean;
    ecmStrength: number;
    ecmHealth: number;
    burnThroughRange: number;
    decoys: readonly { position: THREE.Vector3; rcs: number }[];
  } | null;
}

export type AirCombatEvent = {
  time: number;
  kind: "detect" | "launch" | "countermeasure" | "hit" | "damage" | "kill" | "maneuver";
  text: string;
};

export interface AirSpawn {
  definition: AirPlatformDefinition;
  side: CombatSide;
  formationId: string;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  formationIndex: number;
  leaderId?: string;
}
