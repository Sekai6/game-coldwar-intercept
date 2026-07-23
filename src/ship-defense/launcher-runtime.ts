import * as THREE from "three";
import type { Mk10LauncherState } from "../combat-types";

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
