export type AirDamageDisposition =
  | "continue"
  | "egress"
  | "mission-kill";

export type AircraftDamageSystem =
  | "structure"
  | "left-engine"
  | "right-engine"
  | "radar"
  | "flight-control"
  | "weapons";

export function resolveAircraftHit(input: {
  localHit: { x: number; y: number; z: number };
  modelLength: number;
  damage: number;
}) {
  const halfLength = Math.max(1, input.modelLength * 0.5);
  const longitudinal = input.localHit.z / halfLength;
  const lateral = input.localHit.x / halfLength;
  let primary: AircraftDamageSystem;
  let zone: string;

  if (longitudinal < -0.62) {
    primary = "radar";
    zone = "nose";
  } else if (longitudinal > 0.28 && Math.abs(lateral) > 0.08) {
    primary = lateral < 0 ? "left-engine" : "right-engine";
    zone = lateral < 0 ? "left-engine-bay" : "right-engine-bay";
  } else if (Math.abs(lateral) > 0.34) {
    primary = "weapons";
    zone = lateral < 0 ? "left-wing" : "right-wing";
  } else if (longitudinal > 0.52 || input.localHit.y > halfLength * 0.16) {
    primary = "flight-control";
    zone = "tail-control";
  } else {
    primary = "structure";
    zone = "fuselage";
  }

  return {
    primary,
    zone,
    primaryDamage: input.damage * (primary === "structure" ? 1 : 0.78),
    structureDamage: primary === "structure" ? 0 : input.damage * 0.18,
    normalizedHit: { lateral, vertical: input.localHit.y / halfLength, longitudinal },
  };
}

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
