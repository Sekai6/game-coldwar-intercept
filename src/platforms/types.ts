import type * as THREE from "three";
import type { EnemyType } from "../threats/catalog";

export type EnemyPlatformId = string;
export type PlatformManeuverMode =
  | "patrol"
  | "close"
  | "standoff"
  | "withdraw"
  | "defensive-beam"
  | "disabled";
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
  radarHeight: number;
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
  minimumTrackQuality: number;
  minimumTrackAge: number;
  fireControlDelay: number;
  datalinkUpdateInterval: number;
  datalinkLatency: number;
  datalinkMinimumQuality: number;
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
  significantHeightMeters: number;
  mobility: {
    maxSpeedKnots: number;
    cruiseSpeedKnots: number;
    patrolSpeedKnots: number;
    accelerationKnotsPerSecond: number;
    turnRateDeg: number;
    decisionInterval: number;
    standoffRange: number;
    standoffTolerance: number;
  };
  defaultThreat: EnemyType;
  sensorSlots: readonly PlatformSensorSlot[];
  weaponSlots: readonly PlatformWeaponSlot[];
  survivability: {
    hull: number;
    pointDefense: {
      sensorRange: number;
      sensorUpdateInterval: number;
      minimumTrackQuality: number;
      trackMemory: number;
      reactionTime: number;
      channels: number;
      range: number;
      interval: number;
      reengagementDelay: number;
      effectorSpeed: number;
      minimumTimeOfFlight: number;
      engagementCapacity: number;
      basePk: number;
      localSaturationPenalty: number;
      engagementsPerTarget: number;
    };
    softKill: {
      ecmStrength: number;
      burnThroughRange: number;
      decoyRounds: number;
      decoyCooldown: number;
      decoyDeployRange: number;
      decoyRcs: number;
    };
  };
  buildModel: () => THREE.Group;
}

export interface EnemyPlatformInstance {
  definition: EnemyPlatformDefinition;
  model: THREE.Group;
  slots: EnemyPlatformModelSlots;
  hardpointState: Map<string, "ready" | "reserved" | "fired" | "canceled">;
  sensorState: Map<string, { nextUpdate: number; quality: number }>;
  weaponSlotNextLaunch: Map<string, number>;
  weaponSlotNextRelease: Map<string, number>;
  weaponTrackAge: Map<string, number>;
  weaponTrackReadyLogged: Set<string>;
  hullIntegrity: number;
  subsystemHealth: Map<string, number>;
  incomingTracks: Map<number, PlatformIncomingTrack>;
  pointDefenseChannelReady: number[];
  pointDefenseEngagementsRemaining: number;
  pointDefenseDepletedLogged: boolean;
  decoyRounds: number;
  nextDecoy: number;
  velocity: THREE.Vector3;
  speedKnots: number;
  desiredHeading: number;
  commandedSpeedKnots: number;
  nextManeuverDecision: number;
  maneuverMode: PlatformManeuverMode;
  targetTrack: {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    quality: number;
    uncertainty: number;
    lastUpdate: number;
    valid: boolean;
  };
  destroyed: boolean;
}

export interface PlatformIncomingTrack {
  missileId: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  quality: number;
  uncertainty: number;
  lastUpdate: number;
  nextScan: number;
  scanCount: number;
  fireControlReadyAt: number;
  detectionLogged: boolean;
  readyLogged: boolean;
  threatScore: number;
  estimatedTimeToImpact: number;
  localTrackDensity: number;
  engagements: number;
  nextEngagementReadyAt: number;
}

export interface PlatformLaunchReservation {
  platform: EnemyPlatformInstance;
  hardpoint: PlatformWeaponHardpoint;
  weaponSlot: PlatformWeaponSlot;
  threat: EnemyType;
  launchAt: number;
  releaseInterval: number;
}
