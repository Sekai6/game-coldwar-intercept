import * as THREE from "three";
import type {
  Interceptor,
  LauncherRequest,
  Mk10LauncherState,
} from "../combat-types";
import type { LauncherConfig } from "../ship-types";

export function moveAngle(current: number, target: number, maxStep: number): number {
  let delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  if (delta > maxStep) delta = maxStep;
  if (delta < -maxStep) delta = -maxStep;
  return current + delta;
}

export function moveToward(current: number, target: number, maxStep: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

export function clampElevation(elevation: number): number {
  return Math.max(0, Math.min(Math.PI / 2, elevation));
}

export function setMk10Elevation(
  launcher: Mk10LauncherState,
  elevation: number,
): void {
  launcher.elevation = elevation;
  for (const arm of launcher.model.userData.arms as THREE.Group[]) {
    arm.rotation.z = elevation;
  }
}

type Mk10Config = Extract<LauncherConfig, { kind: "mk10" }>;

export type Mk10RuntimeDependencies = {
  config: Mk10Config;
  launchers: readonly Mk10LauncherState[];
  elapsed: number;
  dt: number;
  health: (launcher: Mk10LauncherState) => number;
  trackPosition: (request: LauncherRequest) => THREE.Vector3 | null;
  worldToLocal: (position: THREE.Vector3) => THREE.Vector3;
  returnAmmo: (request: LauncherRequest) => void;
  cancel: (request: LauncherRequest) => void;
  launch: (
    request: LauncherRequest,
    launcherLabel: string,
    launchPoint: string,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
  ) => Interceptor;
  log: (message: string) => void;
};

function angleDifference(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function abortMk10Task(
  launcher: Mk10LauncherState,
  request: LauncherRequest,
  deps: Mk10RuntimeDependencies,
  reason: string,
): void {
  deps.returnAmmo(request);
  deps.cancel(request);
  launcher.pending = null;
  launcher.reloadRail = -1;
  launcher.phase = "returning";
  launcher.phaseSince = deps.elapsed;
  deps.log(`${deps.config.displayName} ${launcher.name} ${reason} / AMMO RETURNED`);
}

export function updateMk10LauncherRuntime(deps: Mk10RuntimeDependencies): void {
  const tolerance = THREE.MathUtils.degToRad(2);
  for (const launcher of deps.launchers) {
    const health = deps.health(launcher);
    const azimuthRate =
      THREE.MathUtils.degToRad(deps.config.azimuthRateDeg) *
      (0.25 + 0.75 * health);
    const elevationRate =
      THREE.MathUtils.degToRad(deps.config.elevationRateDeg) *
      (0.25 + 0.75 * health);
    const request = launcher.pending;
    if (request && health <= 0.05) {
      abortMk10Task(launcher, request, deps, "CASUALTY / LAUNCH ABORT");
    }
    if (
      launcher.pending?.target.phase === "destroyed" &&
      launcher.phase === "slewing"
    ) {
      abortMk10Task(launcher, launcher.pending, deps, "TASK CANCEL / TARGET DESTROYED");
    }
    if (launcher.phase === "slewing" && launcher.pending) {
      const trackPosition = deps.trackPosition(launcher.pending);
      if (!trackPosition) {
        if (deps.elapsed - launcher.phaseSince > 4.5)
          abortMk10Task(launcher, launcher.pending, deps, "TASK CANCEL / TRACK LOST");
        continue;
      }
      const relative = deps.worldToLocal(trackPosition.clone()).sub(launcher.model.position);
      const desiredAzimuth = Math.atan2(-relative.z, relative.x);
      const desiredElevation = THREE.MathUtils.clamp(
        Math.atan2(relative.y, Math.hypot(relative.x, relative.z)),
        THREE.MathUtils.degToRad(5),
        THREE.MathUtils.degToRad(70),
      );
      launcher.azimuth = moveAngle(launcher.azimuth, desiredAzimuth, azimuthRate * deps.dt);
      setMk10Elevation(
        launcher,
        moveToward(launcher.elevation, desiredElevation, elevationRate * deps.dt),
      );
      launcher.model.rotation.y = launcher.azimuth;
      if (
        Math.abs(angleDifference(desiredAzimuth, launcher.azimuth)) < tolerance &&
        Math.abs(desiredElevation - launcher.elevation) < tolerance
      ) {
        const railIndex = launcher.railIndex;
        const round = launcher.rounds[railIndex];
        const origin = round.getWorldPosition(new THREE.Vector3());
        const quaternion = round.getWorldQuaternion(new THREE.Quaternion());
        const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
        launcher.reloadRail = railIndex;
        round.visible = false;
        deps.log(
          `${deps.config.displayName} ${launcher.name} ON BEARING / AZ ${Math.round(THREE.MathUtils.radToDeg(launcher.azimuth))} / EL ${Math.round(THREE.MathUtils.radToDeg(launcher.elevation))}`,
        );
        deps.launch(
          launcher.pending,
          `${deps.config.displayName} ${launcher.name}`,
          `RAIL ${railIndex + 1}`,
          origin,
          direction,
        );
        launcher.pending = null;
        launcher.phase = "firing";
        launcher.phaseSince = deps.elapsed;
      }
    } else if (launcher.phase === "firing" && deps.elapsed - launcher.phaseSince >= 0.38) {
      launcher.phase = "returning";
      launcher.phaseSince = deps.elapsed;
      deps.log(`${deps.config.displayName} ${launcher.name} RETURN TO LOAD`);
    } else if (launcher.phase === "returning") {
      launcher.azimuth = moveAngle(launcher.azimuth, launcher.stowAzimuth, azimuthRate * deps.dt);
      launcher.model.rotation.y = launcher.azimuth;
      setMk10Elevation(launcher, moveToward(launcher.elevation, 0, elevationRate * deps.dt));
      if (
        Math.abs(angleDifference(launcher.stowAzimuth, launcher.azimuth)) < tolerance &&
        launcher.elevation < tolerance
      ) {
        launcher.azimuth = launcher.stowAzimuth;
        launcher.model.rotation.y = launcher.stowAzimuth;
        setMk10Elevation(launcher, 0);
        launcher.phaseSince = deps.elapsed;
        if (launcher.reloadRail < 0) {
          launcher.phase = "ready";
          deps.log(`${deps.config.displayName} ${launcher.name} READY / TASK CANCELLED`);
          continue;
        }
        launcher.phase = "loading";
        const round = launcher.rounds[launcher.reloadRail];
        const home = round.userData.homePosition as THREE.Vector3;
        round.position.copy(home).add(new THREE.Vector3(-5.2, -0.12, 0));
        round.scale.copy(round.userData.homeScale as THREE.Vector3).multiplyScalar(0.72);
        round.visible = true;
        deps.log(`${deps.config.displayName} ${launcher.name} LOADING / RAIL ${launcher.reloadRail + 1}`);
      }
    } else if (launcher.phase === "loading") {
      if (health <= 0.05) continue;
      const round = launcher.rounds[launcher.reloadRail];
      const home = round.userData.homePosition as THREE.Vector3;
      const reloadTime = deps.config.reloadSeconds / (0.3 + 0.7 * health);
      const t = THREE.MathUtils.smoothstep((deps.elapsed - launcher.phaseSince) / reloadTime, 0, 1);
      round.position.lerpVectors(home.clone().add(new THREE.Vector3(-5.2, -0.12, 0)), home, t);
      round.scale.copy(round.userData.homeScale as THREE.Vector3).multiplyScalar(THREE.MathUtils.lerp(0.72, 1, t));
      if (t >= 1) {
        round.position.copy(home);
        round.scale.copy(round.userData.homeScale as THREE.Vector3);
        launcher.railIndex = (launcher.reloadRail + 1) % launcher.rounds.length;
        launcher.phase = "ready";
        launcher.phaseSince = deps.elapsed;
        deps.log(`${deps.config.displayName} ${launcher.name} READY / RAIL ${launcher.reloadRail + 1}`);
      }
    }
  }
}

export function resetMk10LauncherRuntime(launchers: readonly Mk10LauncherState[]): void {
  for (const launcher of launchers) {
    launcher.pending = null;
    launcher.phase = "ready";
    launcher.phaseSince = 0;
    launcher.azimuth = launcher.stowAzimuth;
    launcher.elevation = 0;
    launcher.railIndex = 0;
    launcher.reloadRail = 0;
    launcher.model.rotation.y = launcher.stowAzimuth;
    (launcher.model.userData.arms as THREE.Group[]).forEach((arm) => (arm.rotation.z = 0));
    launcher.rounds.forEach((round) => {
      round.visible = true;
      round.position.copy(round.userData.homePosition as THREE.Vector3);
      round.scale.copy(round.userData.homeScale as THREE.Vector3);
    });
  }
}
