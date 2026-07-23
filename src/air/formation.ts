export type FormationStatus = "joined" | "separated" | "rejoining";

export function updateFormationStatus(input: {
  current: FormationStatus;
  error: number;
  joinDistance: number;
  breakDistance: number;
}) {
  if (input.current === "joined")
    return input.error > input.breakDistance ? "separated" : "joined";
  if (input.error <= input.joinDistance) return "joined";
  return "rejoining";
}

export function formationSlot(input: {
  leader: { x: number; y: number; z: number };
  leaderHeading: { x: number; y: number; z: number };
  lateral: number;
  vertical: number;
  trail: number;
}) {
  const horizontalLength = Math.hypot(
    input.leaderHeading.x,
    input.leaderHeading.z,
  ) || 1;
  const forwardX = input.leaderHeading.x / horizontalLength;
  const forwardZ = input.leaderHeading.z / horizontalLength;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  return {
    x: input.leader.x + rightX * input.lateral - forwardX * input.trail,
    y: input.leader.y + input.vertical,
    z: input.leader.z + rightZ * input.lateral - forwardZ * input.trail,
  };
}
