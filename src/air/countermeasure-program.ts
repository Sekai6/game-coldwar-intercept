import type { AirPlatformInstance, CountermeasureReleaseProgram } from "./types";

export function queueCountermeasureProgram(input: {
  aircraft: AirPlatformInstance;
  type: "chaff" | "flare";
  requestedCount: number;
  interval: number;
  cooldown: number;
  time: number;
}) {
  if (input.time < input.aircraft.nextCountermeasure) return 0;
  const inventory = input.type === "flare" ? input.aircraft.flares : input.aircraft.chaff;
  const count = Math.min(input.requestedCount, inventory);
  if (count <= 0) return 0;
  input.aircraft.countermeasurePrograms.push({
    type: input.type,
    remaining: count,
    nextReleaseAt: input.time,
    interval: input.interval,
  });
  input.aircraft.nextCountermeasure = input.time + input.cooldown;
  return count;
}

export function advanceCountermeasurePrograms(
  programs: CountermeasureReleaseProgram[],
  inventory: { chaff: number; flares: number },
  time: number,
) {
  const releases: ("chaff" | "flare")[] = [];
  for (const program of programs) {
    if (program.remaining <= 0 || time < program.nextReleaseAt) continue;
    const available = program.type === "flare" ? inventory.flares : inventory.chaff;
    if (available <= 0) {
      program.remaining = 0;
      continue;
    }
    releases.push(program.type);
    if (program.type === "flare") inventory.flares--;
    else inventory.chaff--;
    program.remaining--;
    program.nextReleaseAt = time + program.interval;
  }
  return { releases, programs: programs.filter((program) => program.remaining > 0), inventory };
}
