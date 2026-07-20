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

export type ModelWeaponHardpoint = {
  id: string;
  mount: THREE.Object3D;
  localDirection: THREE.Vector3;
  cover?: THREE.Object3D;
};

export function createMk141Launcher(
  material: THREE.Material,
  dark: THREE.Material,
  idPrefix: string,
) {
  const group = new THREE.Group();
  const hardpoints: ModelWeaponHardpoint[] = [];
  const cradle = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.25, 2.15),
    dark,
  );
  cradle.position.y = 0.18;
  group.add(cradle);
  let index = 0;
  for (const y of [0.58, 1.18])
    for (const z of [-0.52, 0.52]) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.43, 3.5, 8),
        material,
      );
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0, y, z);
      const cover = new THREE.Mesh(new THREE.CircleGeometry(0.34, 8), dark);
      cover.rotation.y = Math.PI / 2;
      cover.position.set(1.76, y, z);
      const mount = new THREE.Object3D();
      mount.position.set(1.95, y, z);
      group.add(tube, cover, mount);
      hardpoints.push({
        id: `${idPrefix}-${++index}`,
        mount,
        localDirection: new THREE.Vector3(1, 0.08, 0).normalize(),
        cover,
      });
    }
  group.userData.weaponHardpoints = hardpoints;
  return group;
}
