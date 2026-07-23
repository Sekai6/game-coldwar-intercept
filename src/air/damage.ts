export type AirDamageDisposition =
  | "continue"
  | "egress"
  | "mission-kill";

export function airDamageDisposition(health: {
  structure: number;
  leftEngine: number;
  rightEngine: number;
  radar: number;
  flightControl: number;
  weapons: number;
}) : AirDamageDisposition {
  if (
    health.structure <= 20 ||
    (health.leftEngine <= 5 && health.rightEngine <= 5) ||
    health.flightControl <= 8
  ) return "mission-kill";
  if (
    health.structure <= 55 ||
    health.leftEngine <= 25 ||
    health.rightEngine <= 25 ||
    health.radar <= 12 ||
    health.flightControl <= 35 ||
    health.weapons <= 10
  ) return "egress";
  return "continue";
}
