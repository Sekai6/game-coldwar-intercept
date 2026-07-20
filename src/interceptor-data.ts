import type { WeaponType } from "./combat-types";

export interface InterceptorProfile {
  minRange: number;
  maxRange: number;
  maxSpeed: number;
  boost: number;
  acceleration: number;
  turnRate: number;
  terminalRange: number;
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
