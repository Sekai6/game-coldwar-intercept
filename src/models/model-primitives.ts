import * as THREE from "three";

export function createSlopedBoxGeometry(
  length: number,
  height: number,
  depth: number,
  foreSlope: number,
  aftSlope = 0,
) {
  const geometry = new THREE.BoxGeometry(length, height, depth);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    if (y > 0 && x > 0) position.setX(index, x - foreSlope);
    if (y > 0 && x < 0) position.setX(index, x + aftSlope);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function addModelStrut(
  group: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 7,
) {
  const delta = to.clone().sub(from);
  const strut = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      delta.length(),
      radialSegments,
    ),
    material,
  );
  strut.position.copy(from).add(to).multiplyScalar(0.5);
  strut.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  group.add(strut);
  return strut;
}
