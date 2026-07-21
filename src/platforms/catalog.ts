import { MOSKVA } from "./models/moskva";
import type { EnemyPlatformDefinition } from "./types";

export const ENEMY_PLATFORM_DEFINITIONS = [MOSKVA] as const;
export type EnemyPlatformType = (typeof ENEMY_PLATFORM_DEFINITIONS)[number]["id"];

const definitions = new Map<EnemyPlatformType, EnemyPlatformDefinition<EnemyPlatformType>>(
  ENEMY_PLATFORM_DEFINITIONS.map((definition) => [
    definition.id,
    definition as EnemyPlatformDefinition<EnemyPlatformType>,
  ]),
);

for (const definition of ENEMY_PLATFORM_DEFINITIONS) {
  if (!Number.isFinite(definition.defaultScenarioRange) || definition.defaultScenarioRange <= 0)
    throw new Error(`${definition.id}: default scenario range must be positive`);
  const slotIds = new Set<string>();
  for (const slot of definition.weaponSlots) {
    if (slotIds.has(slot.id)) throw new Error(`${definition.id}: duplicate weapon slot ${slot.id}`);
    slotIds.add(slot.id);
    if (Number(slot.capacity) <= 0 || Number(slot.compatibleThreats.length) === 0)
      throw new Error(`${definition.id}: ${slot.id} needs capacity and compatible threats`);
    if (slot.fireControlTrackHoldover < 0)
      throw new Error(`${definition.id}: ${slot.id} needs a non-negative fire-control holdover`);
  }
}

export function getEnemyPlatformDefinition(id: EnemyPlatformType) {
  const definition = definitions.get(id);
  if (!definition) throw new Error(`Unknown enemy platform: ${id}`);
  return definition;
}
