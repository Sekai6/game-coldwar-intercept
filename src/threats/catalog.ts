import { HARPOON } from "./harpoon.js";
import { KH22 } from "./kh22.js";
import { P15 } from "./p15.js";
import { P500 } from "./p500.js";
import { P700 } from "./p700.js";
import { NEPTUNE } from "./neptune.js";
import { URAN } from "./uran.js";
import { ASM1 } from "./asm1.js";
import { RBS15 } from "./rbs15.js";
import { EXOCET } from "./exocet.js";
import type { ThreatDefinition, ThreatProfile } from "./types.js";

export const THREAT_DEFINITIONS = [P15, P500, P700, KH22, HARPOON, NEPTUNE, URAN, ASM1, RBS15, EXOCET] as const;

export type EnemyType = (typeof THREAT_DEFINITIONS)[number]["id"];
export const DEFAULT_THREAT_ID: EnemyType = P500.id;

function validateThreatDefinition(definition: ThreatDefinition) {
  const profile = definition.profile,
    positiveValues: [string, number][] = [
      ["cruiseAltitude", profile.cruiseAltitude],
      ["terminalAltitude", profile.terminalAltitude],
      ["terminalAt", profile.terminalAt],
      ["cruiseSpeed", profile.cruiseSpeed],
      ["terminalSpeed", profile.terminalSpeed],
      ["turnRate", profile.turnRate],
      ["defaultRange", profile.defaultRange],
      ["radarCrossSection", profile.radarCrossSection],
      ["modelScale", profile.modelScale],
    ];
  for (const [field, value] of positiveValues)
    if (!Number.isFinite(value) || value <= 0)
      throw new Error(`${definition.id}: ${field} must be positive`);
  if (
    profile.terminalDescentAt !== undefined &&
    (profile.terminalDescentAt <= 0 ||
      profile.terminalDescentAt > profile.terminalAt)
  )
    throw new Error(
      `${definition.id}: terminalDescentAt must be inside terminalAt`,
    );
  if (
    profile.popUp &&
    !profile.terminalAttackModes?.some((mode) => mode === "pop-up")
  )
    throw new Error(
      `${definition.id}: popUp capability requires a pop-up terminal mode`,
    );
  if (
    profile.homeOnJam &&
    (profile.homeOnJam.minimumJammingStrength < 0 ||
      profile.homeOnJam.minimumJammingStrength > 1 ||
      profile.homeOnJam.residualErrorFactor < 0 ||
      profile.homeOnJam.residualErrorFactor > 1)
  )
    throw new Error(`${definition.id}: homeOnJam factors must be within 0..1`);
}

const knownIds = new Set<string>();
for (const definition of THREAT_DEFINITIONS) {
  if (knownIds.has(definition.id))
    throw new Error(`Duplicate threat definition: ${definition.id}`);
  knownIds.add(definition.id);
  validateThreatDefinition(definition);
}

const definitionsById = new Map<EnemyType, ThreatDefinition<EnemyType>>(
  THREAT_DEFINITIONS.map((definition) => [
    definition.id,
    definition as ThreatDefinition<EnemyType>,
  ]),
);

export function getThreatDefinition(id: EnemyType) {
  const definition = definitionsById.get(id);
  if (!definition) throw new Error(`Unknown threat definition: ${id}`);
  return definition;
}

export const THREAT_PROFILES = Object.fromEntries(
  THREAT_DEFINITIONS.map((definition) => [definition.id, definition.profile]),
) as Record<EnemyType, ThreatProfile>;
