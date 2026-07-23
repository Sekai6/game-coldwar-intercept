import type { EngagementState } from "../combat-types";

export function recordLaunch<T>(engagements: Map<T, EngagementState>, target: T): EngagementState {
  const state = engagements.get(target) ?? { shots: 0, pending: 0, misses: 0, lastResolution: -Infinity };
  state.shots += 1;
  state.pending += 1;
  engagements.set(target, state);
  return state;
}

export function resolveShot<T>(engagements: Map<T, EngagementState>, target: T, result: "hit" | "miss" | "cancel", time: number): EngagementState | undefined {
  const state = engagements.get(target);
  if (!state) return undefined;
  state.pending = Math.max(0, state.pending - 1);
  if (result === "miss") state.misses += 1;
  state.lastResolution = time;
  return state;
}
