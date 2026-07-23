import type * as THREE from "three";
import type { CombatEntity, CombatSide } from "../combat-entity";

export type AirMissionOrder = "cap" | "intercept" | "escort" | "anti-ship" | "egress" | "return";
export type AirGuidance = "active-radar" | "semi-active-radar" | "infrared" | "anti-ship-radar";
export type AirPlatformId = "F-14A" | "TU-16K" | "A-6E";
export type AirWeaponId = "AIM-54A" | "AIM-7F" | "AIM-9L" | "KSR-5" | "AGM-84A";
export type AirSubsystem = "structure" | "left-engine" | "right-engine" | "radar" | "flight-control" | "weapons";

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
    fuelSeconds: number;
  };
  sensor: AirSensorDefinition;
  ecm: { strength: number; burnThroughRange: number };
  countermeasures: { chaff: number; flares: number; program: CountermeasureProgram };
  loadout: Readonly<Record<AirWeaponId, number>>;
  buildModel: () => THREE.Group;
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
