/**
 * Data-only IDs that a serialized scenario may reference.
 * Keep this module free of Three.js and runtime factories so scenario files can
 * be validated safely before any simulation or renderer is constructed.
 */
export const SCENARIO_ENVIRONMENT_PRESET_IDS = [
  "open-ocean-afternoon",
  "arctic-twilight-high-sea",
] as const;

export const SCENARIO_TIME_OF_DAY_IDS = ["afternoon", "polar-twilight"] as const;

export const SCENARIO_COAST_BACKDROP_IDS = ["norwegian-barents-distant-coast"] as const;

export const SCENARIO_AIR_PLATFORM_IDS = [
  "F-14A",
  "TU-16K",
  "A-6E",
  "MIG-29A",
  "MIG-29A-SEAD",
  "E-2C",
  "TU-126",
] as const;

export const SCENARIO_SHIP_LOADOUT_IDS = [
  "RIM-67",
  "SM-2MR",
  "SM-2ER",
  "ciws",
  "surfaceStrike",
] as const;

export const SCENARIO_WEAPON_IDS = [
  ...SCENARIO_SHIP_LOADOUT_IDS,
  "AIM-54A",
  "AIM-54X-CEC",
  "AGM-45A",
  "AGM-88A",
  "Kh-31P-C",
  "AIM-7F",
  "AIM-9L",
  "R-27R",
  "R-73",
  "KSR-5",
  "AGM-84A",
] as const;

export const SCENARIO_AIR_WEAPON_IDS = [
  "AIM-54A",
  "AIM-54X-CEC",
  "AGM-45A",
  "AGM-88A",
  "Kh-31P-C",
  "AIM-7F",
  "AIM-9L",
  "R-27R",
  "R-73",
  "KSR-5",
  "AGM-84A",
] as const;

export const SCENARIO_THREAT_IDS = [
  "P-15 Termit",
  "P-500",
  "P-700",
  "Kh-22",
  "RGM-84 Harpoon",
  "R-360 Neptune",
  "3M24 Uran",
  "ASM-1",
  "RBS-15 Mk. II",
  "MM38 Exocet",
] as const;

/** No physical launch platform is supplied for these catalog additions yet. */
export const SCENARIO_IN_FLIGHT_ONLY_THREAT_IDS: readonly string[] = [
  "R-360 Neptune", "3M24 Uran", "ASM-1",
  "RBS-15 Mk. II", "MM38 Exocet",
];
