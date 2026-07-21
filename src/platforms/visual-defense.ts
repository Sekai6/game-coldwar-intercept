import * as THREE from "three";
import type { EnemyPlatformInstance } from "./types";

export function recordPlatformPointDefenseShot(
  platform: EnemyPlatformInstance,
  mountId: string,
  origin: THREE.Vector3,
  targetBearing: number,
  traverseError: number,
) {
  const history = (platform.model.userData.pointDefenseMountHistory ??=
    []) as string[];
  history.push(mountId);
  if (history.length > 24) history.shift();
  platform.model.userData.lastPointDefenseMount = mountId;
  platform.model.userData.lastPointDefenseBearing = targetBearing;
  platform.model.userData.lastPointDefenseTraverseError = traverseError;
  platform.model.userData.pointDefenseShots =
    Number(platform.model.userData.pointDefenseShots ?? 0) + 1;
  platform.model.userData.pointDefenseOriginOffset = origin
    .clone()
    .sub(platform.model.position)
    .setY(0)
    .length();
}
