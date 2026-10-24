import { createSeaSkimmerModel } from "./sea-skimmer-model.js";
import type { ThreatDefinition } from "./types.js";

// MM38 only: solid-propellant propulsion, not turbojet MM40 Block 3.
function createModel() {
  return createSeaSkimmerModel({
    identity: "MM38 Exocet", length: 7.815, radius: .2625, noseLength: 1.33,
    noseShape: "pointed", skinColor: 0xd8dedb, radomeColor: 0x46575f,
    wingZ: -.15, wingSpan: .75, wingChord: 1.78, sweptWings: true,
    wingRotation: Math.PI / 4, tailSpan: .4, tailChord: .72, tailSwept: false,
    exhaustLength: 1.6,
  });
}

export const EXOCET = {
  id: "MM38 Exocet",
  profile: {
    cruiseAltitude: .3, terminalAltitude: .1, terminalAt: 130,
    seekerFieldOfViewDeg: 50, seekerAcquisitionRangeFactor: 1.15, targetLostCoastSeconds: 12,
    cruiseSpeed: 5.8, terminalSpeed: 6.4, turnRate: 11, damage: 20,
    defaultRange: 340, burnThroughRange: 22, radarCrossSection: .13,
    modelScale: .82, selectionRadius: 3.2, pathColor: 0xc4d7e0, threatPriority: 6,
    trajectory: "sea-skimmer", ciwsPenalty: .08,
    terminalAttackModes: ["skim"],
    weave: { lateral: 0, longitudinal: 0, lateralRate: 0, longitudinalRate: 0 },
  },
  preset: { label: "EXOCET RAID", count: 6, interval: 1.5, altitude: .3, spread: 160, range: 340 },
  createModel,
} as const satisfies ThreatDefinition;
