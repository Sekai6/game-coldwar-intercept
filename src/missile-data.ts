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
  cruiseSpeed: number;
  terminalSpeed: number;
  turnRate: number;
  damage: number;
  defaultRange: number;
  burnThroughRange: number;
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
  },
};
