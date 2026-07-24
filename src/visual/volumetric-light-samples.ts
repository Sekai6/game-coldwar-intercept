import * as THREE from "three";
import type { FroxelLightInput } from "./webgpu-ultra";

const worldPosition = new THREE.Vector3();
const projected = new THREE.Vector3();

export function collectVolumetricLightSamples(scene: THREE.Scene, camera: THREE.PerspectiveCamera, limit = 8): FroxelLightInput[] {
  const candidates: Array<FroxelLightInput & { score: number }> = [];
  scene.traverseVisible((object) => {
    if (!(object instanceof THREE.PointLight) || object.intensity <= 0.05) return;
    object.getWorldPosition(worldPosition);
    const distance = worldPosition.distanceTo(camera.position);
    if (distance > Math.max(120, object.distance * 2.4)) return;
    projected.copy(worldPosition).project(camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.35 || Math.abs(projected.y) > 1.35) return;
    const radius = THREE.MathUtils.clamp((object.distance || 35) / Math.max(distance, 8) * 0.42, 0.018, 0.22);
    const intensity = THREE.MathUtils.clamp(object.intensity / 14, 0, 1.8);
    const warmTransientBias = object.color.r > object.color.b * 1.25 ? 1.75 : 1;
    candidates.push({ screenX: projected.x * 0.5 + 0.5, screenY: projected.y * 0.5 + 0.5, depth: THREE.MathUtils.clamp(Math.sqrt(distance / 900), 0, 1), radius, color: object.color.clone(), intensity, score: intensity * radius * warmTransientBias * Math.sqrt(Math.max(object.distance, 1) / 24) });
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _score, ...sample }) => sample);
}
