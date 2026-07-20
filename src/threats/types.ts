import type * as THREE from "three";

export type ThreatTrajectory = "sea-skimmer" | "high-altitude";
export type TerminalAttackMode = "standard" | "skim" | "pop-up";

export interface ThreatProfile {
  cruiseAltitude: number;
  terminalAltitude: number;
  terminalAt: number;
  terminalDescentAt?: number;
  cruiseSpeed: number;
  terminalSpeed: number;
  turnRate: number;
  damage: number;
  defaultRange: number;
  burnThroughRange: number;
  radarCrossSection: number;
  modelScale: number;
  selectionRadius: number;
  pathColor: number;
  threatPriority: number;
  trajectory: ThreatTrajectory;
  ciwsPenalty: number;
  ciwsPkCap?: number;
  terminalAttackModes?: readonly TerminalAttackMode[];
  popUp?: {
    startRange: number;
    peakAltitude: number;
  };
  homeOnJam?: {
    minimumJammingStrength: number;
    residualErrorFactor: number;
  };
  seekerFieldOfViewDeg?: number;
  seekerAcquisitionRangeFactor?: number;
  targetLostCoastSeconds?: number;
  weave: {
    lateral: number;
    longitudinal: number;
    lateralRate: number;
    longitudinalRate: number;
  };
}

export interface ThreatPreset {
  label: string;
  count: number;
  interval: number;
  altitude: number;
  spread: number;
  range: number;
}

export interface ThreatDefinition<Id extends string = string> {
  id: Id;
  profile: ThreatProfile;
  preset: ThreatPreset;
  createModel: () => THREE.Group;
}
