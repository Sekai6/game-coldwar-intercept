import * as THREE from "three";
import { DEFAULT_SENSORS } from "./sim";
import { buildTiconderoga, TICONDEROGA_METADATA } from "./models/ticonderoga";
import { buildLongBeach } from "./models/long-beach";
import type { ShipDefinition } from "./ship-types";

export const LONG_BEACH_METADATA: Omit<ShipDefinition, "build"> = {
  id: "long-beach",
  name: "USS LONG BEACH",
  hullNumber: "CGN-9",
  era: "NTU 1980s",
  role: "NUCLEAR GUIDED MISSILE CRUISER",
  platform: { maxSpeedKnots: 30, turnRateDeg: 1.6, radarRcs: 12 },
  hullColor: 0x687574,
  surfaceStrike: {
    weapon: "RGM-84 Harpoon",
    displayName: "2 x MK 141 QUAD HARPOON",
    magazine: 8,
    minimumInterval: 1.6,
    minRange: 35,
    maxRange: 680,
    requiredTrackQuality: 0.62,
    maximumTrackAge: 4,
    minimumTrackAge: 2.8,
    fireControlDelay: 2.2,
    datalinkUpdateInterval: 2.8,
    datalinkLatency: 0.55,
    datalinkMinimumQuality: 0.22,
    damage: 34,
    salvoSize: 4,
  },
  launcher: {
    kind: "mk10",
    displayName: "MK 10",
    compatibleWeapons: ["RIM-67", "SM-2MR", "SM-2ER"],
    azimuthRateDeg: 55,
    elevationRateDeg: 25,
    reloadSeconds: 1.8,
  },
  sensors: DEFAULT_SENSORS,
  subsystemLabels: {
    primaryRadar: "AN/SPS-48E",
    secondaryRadar: "AN/SPS-49",
    fireControl: "AN/SPG-55",
    aftLauncher: "MK 10 AFT",
    forwardLauncher: "MK 10 FWD",
    ciws: "CIWS",
    ecm: "AN/SLQ-32",
    srboc: "MK 36 SRBOC",
    propulsion: "PROPULSION",
  },
  subsystemPositions: {
    primaryRadar: new THREE.Vector3(1, 24, 0),
    secondaryRadar: new THREE.Vector3(-7, 23, 0),
    fireControl: new THREE.Vector3(8, 13, 0),
    aftLauncher: new THREE.Vector3(-23, 7, 0),
    forwardLauncher: new THREE.Vector3(23, 7, 0),
    ciws: new THREE.Vector3(13, 8, 0),
    ecm: new THREE.Vector3(2.5, 16, 3.2),
    srboc: new THREE.Vector3(0, 8, 4),
    propulsion: new THREE.Vector3(-4, 6, 0),
  },
  damageModel: {
    longitudinalLimit: 24,
    zones: [
      { minX: 14, systems: ["forwardLauncher", "ciws", "fireControl"] },
      { minX: 4, systems: ["primaryRadar", "fireControl", "ecm", "ciws"] },
      {
        minX: -7,
        systems: ["fireControl", "ecm", "propulsion", "primaryRadar"],
      },
      {
        minX: -16,
        systems: ["secondaryRadar", "srboc", "propulsion", "fireControl"],
      },
      {
        minX: -Infinity,
        systems: ["aftLauncher", "srboc", "ciws", "secondaryRadar"],
      },
    ],
  },
  ammo: {
    rim67: 6,
    sm2mr: 12,
    sm2er: 8,
    ciws: 1200,
    channels: 3,
    illuminators: 2,
  },
};

export function createShipCatalog() {
  const ships: ShipDefinition[] = [
    { ...LONG_BEACH_METADATA, build: buildLongBeach },
    { ...TICONDEROGA_METADATA, build: buildTiconderoga },
  ];
  return {
    ships,
    byId: new Map(ships.map((ship) => [ship.id, ship])),
    defaultShip: ships[0],
  };
}
