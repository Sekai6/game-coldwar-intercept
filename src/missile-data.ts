import type { EnemyType, WeaponType } from "./combat-types";

export interface InterceptorProfile {
  minRange: number;
  maxRange: number;
  maxSpeed: number;
  boost: number;
  acceleration: number;
  turnRate: number;
  terminalRange: number;
}
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
  trajectory: "sea-skimmer" | "high-altitude";
  ciwsPenalty: number;
  ciwsPkCap?: number;
  terminalAttackModes?: readonly ("skim" | "pop-up")[];
  weave: {
    lateral: number;
    longitudinal: number;
    lateralRate: number;
    longitudinalRate: number;
  };
}

export const WEAPON_PROFILES: Record<WeaponType, InterceptorProfile> = {
  "RIM-67": {
    minRange: 20,
    maxRange: 750,
    maxSpeed: 12.5,
    boost: 5.2,
    acceleration: 3.1,
    turnRate: (18 * Math.PI) / 180,
    terminalRange: 180,
  },
  "SM-2MR": {
    minRange: 15,
    maxRange: 450,
    maxSpeed: 13.5,
    boost: 4.4,
    acceleration: 3.6,
    turnRate: (22 * Math.PI) / 180,
    terminalRange: 100,
  },
  "SM-2ER": {
    minRange: 22,
    maxRange: 900,
    maxSpeed: 14.2,
    boost: 6.2,
    acceleration: 3.3,
    turnRate: (16 * Math.PI) / 180,
    terminalRange: 190,
  },
};

export const THREAT_PROFILES: Record<EnemyType, ThreatProfile> = {
  "P-15 Termit": {
    cruiseAltitude: 1.95,
    terminalAltitude: 0.25,
    terminalAt: 240,
    terminalDescentAt: 20,
    cruiseSpeed: 6.2,
    terminalSpeed: 6.4,
    turnRate: 8,
    damage: 32,
    defaultRange: 400,
    burnThroughRange: 28,
    radarCrossSection: 0.65,
    modelScale: 0.96,
    selectionRadius: 4.5,
    pathColor: 0xef7651,
    threatPriority: 10,
    trajectory: "sea-skimmer",
    ciwsPenalty: 0.06,
    weave: {
      lateral: 0.45,
      longitudinal: 0.25,
      lateralRate: 1.7,
      longitudinalRate: 1.35,
    },
  },
  "P-500": {
    cruiseAltitude: 1.2,
    terminalAltitude: 0.3,
    terminalAt: 180,
    cruiseSpeed: 8.8,
    terminalSpeed: 9.6,
    turnRate: 8,
    damage: 28,
    defaultRange: 600,
    burnThroughRange: 30,
    radarCrossSection: 0.42,
    modelScale: 0.96,
    selectionRadius: 4.2,
    pathColor: 0xe25a43,
    threatPriority: 0,
    trajectory: "sea-skimmer",
    ciwsPenalty: 0.1,
    weave: {
      lateral: 2.2,
      longitudinal: 1.4,
      lateralRate: 3.8,
      longitudinalRate: 3.1,
    },
  },
  "P-700": {
    cruiseAltitude: 2.6,
    terminalAltitude: 0.4,
    terminalAt: 220,
    cruiseSpeed: 9.8,
    terminalSpeed: 10.8,
    turnRate: 6.5,
    damage: 38,
    defaultRange: 750,
    burnThroughRange: 36,
    radarCrossSection: 0.7,
    modelScale: 1.05,
    selectionRadius: 4.8,
    pathColor: 0xe25a43,
    threatPriority: 18,
    trajectory: "sea-skimmer",
    ciwsPenalty: 0.16,
    weave: {
      lateral: 7,
      longitudinal: 5,
      lateralRate: 2.8,
      longitudinalRate: 2.35,
    },
  },
  "Kh-22": {
    cruiseAltitude: 360,
    terminalAltitude: 2.2,
    terminalAt: 450,
    cruiseSpeed: 13.2,
    terminalSpeed: 15.2,
    turnRate: 4.5,
    damage: 46,
    defaultRange: 1000,
    burnThroughRange: 26,
    radarCrossSection: 1.1,
    modelScale: 0.92,
    selectionRadius: 4.2,
    pathColor: 0xffb05a,
    threatPriority: 45,
    trajectory: "high-altitude",
    ciwsPenalty: 0.3,
    ciwsPkCap: 0.14,
    weave: {
      lateral: 0,
      longitudinal: 0,
      lateralRate: 0,
      longitudinalRate: 0,
    },
  },
  "RGM-84 Harpoon": {
    cruiseAltitude: 0.9,
    terminalAltitude: 0.12,
    terminalAt: 130,
    cruiseSpeed: 5.8,
    terminalSpeed: 6.4,
    turnRate: 11,
    damage: 20,
    defaultRange: 420,
    burnThroughRange: 22,
    radarCrossSection: 0.18,
    modelScale: 0.82,
    selectionRadius: 3.2,
    pathColor: 0xf1b44c,
    threatPriority: 6,
    trajectory: "sea-skimmer",
    ciwsPenalty: 0.08,
    terminalAttackModes: ["skim", "skim", "skim", "pop-up"],
    weave: {
      lateral: 1.4,
      longitudinal: 0.8,
      lateralRate: 4.2,
      longitudinalRate: 3.6,
    },
  },
};
