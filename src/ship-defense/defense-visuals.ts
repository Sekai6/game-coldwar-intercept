import * as THREE from "three";

export function createCiwsTracer(scene: THREE.Scene, target: THREE.Vector3, origin: THREE.Vector3, lifetimeMs = 110): void {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([origin.clone(), target.clone()]),
    new THREE.LineBasicMaterial({ color: 0xffef9a, transparent: true, opacity: 0.9 }),
  );
  scene.add(line);
  setTimeout(() => {
    scene.remove(line);
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }, lifetimeMs);
}
