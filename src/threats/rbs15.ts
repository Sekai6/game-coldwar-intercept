import { createSeaSkimmerModel } from "./sea-skimmer-model.js";
import type { ThreatDefinition } from "./types.js";

// Mk. II cruise configuration: boosters separated, no Mk. III/IV land attack.
function createModel() {
  return createSeaSkimmerModel({
    identity: "RBS-15 Mk. II", length: 6.525, radius: .375, noseLength: .94,
    noseShape: "rounded", skinColor: 0x79878c, radomeColor: 0x272f35,
    wingZ: 1.46, wingSpan: .675, wingChord: 1.05, sweptWings: true,
    tailZ: -1.4, tailSpan: .26, tailChord: .62,
    intake: { length: 1.25, width: .42, depth: .42, z: 1.12, rounded: true },
    exhaustLength: 1.2,
  });
}

export const RBS15 = {
  id: "RBS-15 Mk. II",
  profile: {
    cruiseAltitude: .3, terminalAltitude: .1, terminalAt: 130,
    seekerFieldOfViewDeg: 50, seekerAcquisitionRangeFactor: 1.15, targetLostCoastSeconds: 12,
    cruiseSpeed: 5.8, terminalSpeed: 6.4, turnRate: 11, damage: 24,
    defaultRange: 460, burnThroughRange: 22, radarCrossSection: .17,
    modelScale: .82, selectionRadius: 3.2, pathColor: 0xaac6db, threatPriority: 6,
    trajectory: "sea-skimmer", ciwsPenalty: .08,
    terminalAttackModes: ["skim"],
    weave: { lateral: 0, longitudinal: 0, lateralRate: 0, longitudinalRate: 0 },
  },
  preset: { label: "RBS-15 RAID", count: 6, interval: 1.5, altitude: .3, spread: 160, range: 460 },
  createModel,
} as const satisfies ThreatDefinition;
