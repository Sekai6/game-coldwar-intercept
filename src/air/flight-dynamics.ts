export interface FlightEnvelope {
  cruiseSpeed: number;
  maxSpeed: number;
  stallSpeed: number;
  acceleration: number;
  drag: number;
  maxLoadFactor: number;
  maxRollRateDeg: number;
  maxPitchRateDeg: number;
  maxAngleOfAttackDeg?: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function consumeFuel(remaining: number, fuelBurn: number) {
  return Math.max(0, remaining - Math.max(0, fuelBurn));
}

export function stepFlightDynamics(input: {
  speed: number;
  currentBank: number;
  desiredBank: number;
  flightPathAngleDeg: number;
  desiredFlightPathAngleDeg: number;
  flightControlHealth: number;
  engineHealth: number;
  defending: boolean;
  dt: number;
  envelope: FlightEnvelope;
}) {
  const controlHealth = clamp(input.flightControlHealth, 0, 1);
  const engineHealth = clamp(input.engineHealth, 0, 1);
  const speedAuthority = clamp(
    (input.speed - input.envelope.stallSpeed) /
      Math.max(0.1, input.envelope.cruiseSpeed - input.envelope.stallSpeed),
    0,
    1,
  );
  const availableLoadFactor = 1 +
    (input.envelope.maxLoadFactor - 1) * speedAuthority * controlHealth;
  const maximumTurnRateDeg = input.envelope.maxPitchRateDeg *
    (availableLoadFactor / input.envelope.maxLoadFactor);
  const rollLimit = input.envelope.maxRollRateDeg * controlHealth * input.dt;
  const bank = input.currentBank + clamp(
    input.desiredBank - input.currentBank,
    -rollLimit,
    rollLimit,
  );
  const pitchLimit = Math.min(
    input.envelope.maxAngleOfAttackDeg ?? 16,
    maximumTurnRateDeg * input.dt,
  );
  const pitchDelta = clamp(
    input.desiredFlightPathAngleDeg - input.flightPathAngleDeg,
    -pitchLimit,
    pitchLimit,
  );
  const targetSpeed =
    (input.defending ? input.envelope.maxSpeed : input.envelope.cruiseSpeed) *
    engineHealth;
  const throttle = clamp(
    (targetSpeed - input.speed) /
      Math.max(0.1, input.envelope.maxSpeed - input.envelope.stallSpeed) + 0.55,
    0.15,
    1,
  );
  const acceleration = clamp(
    targetSpeed - input.speed,
    -input.envelope.drag * input.speed * input.speed,
    input.envelope.acceleration * engineHealth * throttle,
  );
  const climbCost = Math.max(0, input.flightPathAngleDeg / 45) * 0.45;
  const speed = clamp(
    input.speed + (acceleration - climbCost) * input.dt,
    input.envelope.stallSpeed * 0.72,
    input.envelope.maxSpeed,
  );
  const stalled = speed < input.envelope.stallSpeed;
  const fuelBurn = input.dt *
    (0.58 + throttle * 0.62 + Math.max(0, input.flightPathAngleDeg / 45) * 0.2);
  return { availableLoadFactor, maximumTurnRateDeg, bank, pitchDelta, speed, throttle, fuelBurn, stalled };
}
