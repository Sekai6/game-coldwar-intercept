export type EngagementSourceId = string | number;

export type EngagementRecord = {
  shots: number;
  pending: number;
  misses: number;
  lastResolution: number;
};

export function recordEngagement<T>(
  engagements: Map<T, EngagementRecord>,
  target: T,
): EngagementRecord {
  const state = engagements.get(target) ?? {
    shots: 0,
    pending: 0,
    misses: 0,
    lastResolution: -Infinity,
  };
  state.shots += 1;
  state.pending += 1;
  engagements.set(target, state);
  return state;
}

export function resolveEngagement<T>(
  engagements: Map<T, EngagementRecord>,
  target: T,
  result: "hit" | "miss" | "cancel",
  time: number,
): EngagementRecord | undefined {
  const state = engagements.get(target);
  if (!state) return undefined;
  state.pending = Math.max(0, state.pending - 1);
  if (result === "miss") state.misses += 1;
  state.lastResolution = time;
  return state;
}

export function hasCommittedEngagement<T>(
  engagements: ReadonlyMap<T, EngagementRecord>,
  target: T,
): boolean {
  return (engagements.get(target)?.shots ?? 0) > 0;
}
