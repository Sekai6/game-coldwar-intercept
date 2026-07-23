import * as THREE from "three";

// Late-afternoon sun: 28 degrees above the western horizon.
export const AFTERNOON_SUN_DIRECTION = new THREE.Vector3(
  -0.707,
  0.469,
  -0.526,
).normalize();

export const AFTERNOON_SUN_ALTITUDE_DEG = THREE.MathUtils.radToDeg(
  Math.asin(AFTERNOON_SUN_DIRECTION.y),
);
