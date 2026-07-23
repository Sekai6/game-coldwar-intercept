import type { DefenseTarget, Missile } from "../combat-types";

export function sourceSeed(sourceId: number | string): number {
  if (typeof sourceId === "number") return sourceId;
  let hash = 2166136261;
  for (const character of sourceId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function targetForSource(
  sourceId: number | string,
  missiles: Missile[],
  aircraft: Map<string, DefenseTarget>,
): DefenseTarget | undefined {
  return typeof sourceId === "string" ? aircraft.get(sourceId) : missiles[sourceId - 1];
}

export function sourceForTarget(
  target: DefenseTarget,
  missiles: Missile[],
): number | string {
  return target.entity?.id ?? missiles.findIndex((candidate) => candidate === target) + 1;
}

export function allTargets(
  missiles: Missile[],
  aircraft: Map<string, DefenseTarget>,
): DefenseTarget[] {
  return [...missiles, ...aircraft.values()];
}
