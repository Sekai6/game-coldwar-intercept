import * as THREE from "three";

export type AntiShipPhase = "boost" | "midcourse" | "terminal";

export interface AntiShipGuidanceConfig {
  boostSeconds: number;
  terminalRange: number;
  seekerRange: number;
  seekerFovDeg: number;
  boostAltitude: number;
  cruiseAltitude: number;
  terminalAltitude: number;
  boostSpeed: number;
  cruiseSpeed: number;
  terminalSpeed: number;
  midcourseTurnRateDeg: number;
  terminalTurnRateDeg: number;
}

export interface AntiShipGuidanceState {
  age: number;
  phase: AntiShipPhase | "destroyed";
  seekerAcquired: boolean;
}

export function updateAntiShipGuidance(input: {
  state: AntiShipGuidanceState;
  config: AntiShipGuidanceConfig;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetVelocity: THREE.Vector3;
  dt: number;
}) {
  const { state, config } = input;
  state.age += input.dt;
  input.commandPoint.addScaledVector(input.commandVelocity, input.dt);
  const commandRange = input.position.distanceTo(input.commandPoint);
  const targetRange = input.position.distanceTo(input.targetPosition);
  state.phase =
    state.age < config.boostSeconds
      ? "boost"
      : commandRange <= config.terminalRange
        ? "terminal"
        : "midcourse";
  const terminal = state.phase === "terminal";
  let acquiredNow = false;
  if (terminal && !state.seekerAcquired && targetRange <= config.seekerRange) {
    const offBoresight = input.velocity
      .clone()
      .normalize()
      .angleTo(input.targetPosition.clone().sub(input.position).normalize());
    if (offBoresight <= THREE.MathUtils.degToRad(config.seekerFovDeg / 2)) {
      state.seekerAcquired = true;
      acquiredNow = true;
    }
  }
  const aimPoint = state.seekerAcquired
    ? input.targetPosition
        .clone()
        .addScaledVector(
          input.targetVelocity,
          Math.min(6, targetRange / Math.max(1, input.velocity.length())),
        )
    : input.commandPoint.clone();
  const desiredAltitude =
    state.phase === "boost"
      ? config.boostAltitude
      : terminal
        ? config.terminalAltitude
        : config.cruiseAltitude;
  const desired = aimPoint.setY(desiredAltitude).sub(input.position).normalize();
  const current = input.velocity.clone().normalize();
  const angle = current.angleTo(desired);
  const turnRate = THREE.MathUtils.degToRad(
    terminal ? config.terminalTurnRateDeg : config.midcourseTurnRateDeg,
  );
  const direction = current
    .lerp(desired, angle > 0 ? Math.min(1, (turnRate * input.dt) / angle) : 1)
    .normalize();
  const targetSpeed =
    state.phase === "boost"
      ? config.boostSpeed
      : terminal
        ? config.terminalSpeed
        : config.cruiseSpeed;
  const speed = THREE.MathUtils.lerp(
    input.velocity.length(),
    targetSpeed,
    Math.min(1, input.dt * 1.1),
  );
  return {
    direction,
    speed,
    desiredAltitude,
    commandRange,
    targetRange,
    acquiredNow,
  };
}
