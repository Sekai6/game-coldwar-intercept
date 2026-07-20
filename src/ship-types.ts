import type * as THREE from "three";
import type { SensorDefinition } from "./sim";
import type { FixedSensorFaceConfig } from "./sensor-faces";
import type { ModelWeaponHardpoint } from "./models/model-primitives";

export type { ModelWeaponHardpoint } from "./models/model-primitives";

export type ShipClass = string;
export type ShipManeuverMode =
  | "patrol"
  | "close"
  | "standoff"
  | "withdraw"
  | "defensive-beam"
  | "disabled";
export type ShipWeapon = "RIM-67" | "SM-2MR" | "SM-2ER";
export type SubsystemId =
  | "primaryRadar"
  | "secondaryRadar"
  | "fireControl"
  | "aftLauncher"
  | "forwardLauncher"
  | "ciws"
  | "ecm"
  | "srboc"
  | "propulsion";

export type LauncherConfig =
  | {
      kind: "mk10";
      displayName: string;
      compatibleWeapons: ShipWeapon[];
      azimuthRateDeg: number;
      elevationRateDeg: number;
      reloadSeconds: number;
    }
  | {
      kind: "mk41";
      displayName: string;
      compatibleWeapons: ShipWeapon[];
      columns: number;
      sequenceInterval: number;
      exhaustClearance: number;
      isolationStartsAt: number;
      maximumIsolationFraction: number;
      loadingPermutation: number;
      gridSize: number;
    };

export interface ShipDefinition {
  id: ShipClass;
  name: string;
  hullNumber: string;
  era: string;
  role: string;
  platform: {
    maxSpeedKnots: number;
    cruiseSpeedKnots: number;
    patrolSpeedKnots: number;
    accelerationKnotsPerSecond: number;
    decelerationKnotsPerSecond: number;
    turnRateDeg: number;
    decisionInterval: number;
    standoffRange: number;
    standoffTolerance: number;
    radarRcs: number;
  };
  launcher: LauncherConfig;
  sensors: SensorDefinition[];
  fixedSensorFaces?: FixedSensorFaceConfig;
  subsystemLabels: Record<SubsystemId, string>;
  subsystemPositions: Record<SubsystemId, THREE.Vector3>;
  damageModel: {
    longitudinalLimit: number;
    zones: { minX: number; systems: SubsystemId[] }[];
  };
  ammo: {
    rim67: number;
    sm2mr: number;
    sm2er: number;
    ciws: number;
    channels: number;
    illuminators: number;
  };
  hullColor: number;
  surfaceStrike?: {
    weapon: "RGM-84 Harpoon";
    displayName: string;
    magazine: number;
    minimumInterval: number;
    minRange: number;
    maxRange: number;
    requiredTrackQuality: number;
    maximumTrackAge: number;
    minimumTrackAge: number;
    fireControlDelay: number;
    datalinkUpdateInterval: number;
    datalinkLatency: number;
    datalinkMinimumQuality: number;
    damage: number;
    salvoSize: number;
    minimumSalvoSize: number;
    maximumWeaponsInFlight: number;
    assessmentDelay: number;
    expectedLeakProbability: number;
    targetHullEstimate: number;
  };
  build: () => THREE.Group;
}

export function shipSurfaceHardpoints(model: THREE.Group) {
  return (model.userData.surfaceStrikeHardpoints ?? []) as ModelWeaponHardpoint[];
}
