import type * as THREE from "three";
import type { EnemyType } from "./threats/catalog";
import type { PlatformLaunchReservation } from "./platforms/types";

export type { EnemyType } from "./threats/catalog";
export type WeaponType = "RIM-67" | "SM-2MR" | "SM-2ER";
export type MissilePhase =
  | "inbound"
  | "boost"
  | "midcourse"
  | "terminal"
  | "destroyed";
export type DefenseTarget = {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  phase: MissilePhase;
  kind: EnemyType;
  rcs: number;
  externalAirMissileId?: string;
  externalAirEntityId?: string;
  externalAirCategory?: "aircraft" | "missile";
  externalDisplayName?: string;
};
export type Missile = DefenseTarget & {
  age: number;
  history: THREE.Vector3[];
  path: THREE.Line;
  speedFactor: number;
  launchAt: number;
  aimOffset: THREE.Vector3;
  bank: number;
  platformLaunch?: {
    reservation: PlatformLaunchReservation;
    released: boolean;
    releasedAt: number | null;
    takeoverLogged: boolean;
    commandPoint: THREE.Vector3;
    commandVelocity: THREE.Vector3;
    nextDatalink: number;
    datalinkValid: boolean;
    lastDatalinkQuality: number;
    terminalSeekerAcquired: boolean;
    plannedArrivalAt: number | null;
  };
};
export type Interceptor = {
  mesh: THREE.Group;
  target: DefenseTarget;
  age: number;
  weapon: WeaponType;
  velocity: THREE.Vector3;
  distanceTraveled: number;
  history: THREE.Vector3[];
  guidancePath: THREE.Line;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  nextDatalink: number;
  datalinkValid: boolean;
  illuminated: boolean;
  illuminationBeam: THREE.Line;
};
export type LauncherRequest = { target: DefenseTarget; weapon: WeaponType };
export type Mk10Phase =
  | "ready"
  | "slewing"
  | "firing"
  | "returning"
  | "loading";
export type Mk10LauncherState = {
  name: "AFT" | "FORWARD";
  model: THREE.Group;
  stowAzimuth: number;
  phase: Mk10Phase;
  phaseSince: number;
  pending: LauncherRequest | null;
  azimuth: number;
  elevation: number;
  railIndex: number;
  reloadRail: number;
  rounds: THREE.Group[];
};
export type VlsLoadout = "SM-2MR" | "SM-2ER" | "OTHER";
export type VlsCellState = {
  lid: THREE.Group;
  origin: THREE.Object3D;
  index: number;
  bank: "FWD" | "AFT";
  phase: "ready" | "opening" | "launching" | "closing" | "spent" | "disabled";
  closeTo: "ready" | "spent" | "disabled";
  phaseSince: number;
  pending: LauncherRequest | null;
  loadout: VlsLoadout;
};
export type VlsBankState = {
  lastLaunchAt: number;
  lastCellIndex: number;
  minimumObservedGap: number;
  launchHistory: number[];
  damageCenters: number[];
  trappedRounds: number;
};

export type Explosion = {
  core: THREE.Mesh;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  age: number;
};
export type ShipDamageEffect = {
  group: THREE.Group;
  fire: THREE.Mesh;
  smoke: THREE.Mesh[];
  light: THREE.PointLight;
  seed: number;
};
export type BoosterDebris = {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  light: THREE.PointLight;
  age: number;
};
export type ChaffCloud = {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  rcs: number;
  initialRcs: number;
  source: Missile | null;
  side: "threat" | "ship" | "platform";
  serial: number;
};
export type SrbocRound = {
  mesh: THREE.Group;
  trail: THREE.Line;
  start: THREE.Vector3;
  control: THREE.Vector3;
  burst: THREE.Vector3;
  burstVelocity: THREE.Vector3;
  age: number;
  flightTime: number;
};
export type VlsLaunchEffect = {
  group: THREE.Group;
  flame: THREE.Mesh;
  smoke: THREE.Mesh[];
  light: THREE.PointLight;
  age: number;
};
export type EngagementDoctrine = "SINGLE" | "DOUBLE" | "SSLS";
export type EngagementState = {
  shots: number;
  pending: number;
  misses: number;
  lastResolution: number;
};
export type IlluminatorState = {
  id: number;
  azimuth: number;
  target: Interceptor | null;
  lastTargetId: number | string;
};
export type AarCategory =
  | "sensor"
  | "fire"
  | "guidance"
  | "effect"
  | "maneuver"
  | "system";
export type AarEvent = { time: number; text: string; category: AarCategory };
export type AarSnapshot = {
  time: number;
  ship: { x: number; z: number; heading: number; hull: number };
  missiles: {
    id: number;
    x: number;
    z: number;
    phase: MissilePhase;
    kind: EnemyType;
  }[];
  interceptors: {
    id: number;
    x: number;
    z: number;
    weapon: WeaponType;
    targetId: number | string;
  }[];
  chaff: { x: number; z: number; side: "threat" | "ship" | "platform" }[];
  enemyPlatform: {
    x: number;
    z: number;
    heading: number;
    hull: number;
    destroyed: boolean;
    name: string;
  } | null;
  surfaceStrikes: {
    id: number;
    x: number;
    z: number;
    phase: "boost" | "midcourse" | "terminal" | "penetrating" | "destroyed";
  }[];
  aircraft: {
    id: string;
    name: string;
    side: "blue" | "red";
    x: number;
    y: number;
    z: number;
    state: string;
    mission: string;
    alive: boolean;
    structure: number;
  }[];
  airWeapons: {
    id: string;
    name: string;
    side: "blue" | "red";
    x: number;
    y: number;
    z: number;
    phase: string;
    targetId: string;
  }[];
  airDecoys: {
    id: string;
    type: "chaff" | "flare";
    x: number;
    y: number;
    z: number;
    alive: boolean;
  }[];
};
