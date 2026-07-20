import * as THREE from "three";
import { createSlopedBoxGeometry } from "./model-primitives";

export type VlsCell = {
  lid: THREE.Group;
  origin: THREE.Object3D;
  index: number;
};

export function createMk45Gun(
  material: THREE.Material,
  dark: THREE.Material,
) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.75, 0.65, 12),
    dark,
  );
  const turret = new THREE.Mesh(
    createSlopedBoxGeometry(2.9, 1.6, 2.5, 0.65, 0.25),
    material,
  );
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.2, 5.2, 8),
    dark,
  );
  base.position.y = 0.3;
  turret.position.set(0.15, 1.15, 0);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(3.1, 1.55, 0);
  group.add(base, turret, barrel);
  return group;
}

export function createPhalanxCiws(
  material: THREE.Material,
  dark: THREE.Material,
  name: string,
) {
  const group = new THREE.Group();
  group.name = name;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.95, 0.7, 12),
    dark,
  );
  const turret = new THREE.Mesh(new THREE.BoxGeometry(1, 1.05, 0.9), material);
  const pivot = new THREE.Group();
  const radome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 7), material);
  turret.position.y = 0.88;
  pivot.position.set(0, 1.08, 0);
  for (let index = -1; index <= 1; index++) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6),
      dark,
    );
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(1.3, 0, index * 0.11);
    pivot.add(barrel);
  }
  radome.position.set(-0.25, 1.55, 0);
  group.add(base, turret, pivot, radome);
  group.userData.elevationPivot = pivot;
  return group;
}

export function createSlq32Array(
  material: THREE.Material,
  dark: THREE.Material,
) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.7, 0.28), dark));
  for (let y = -0.48; y <= 0.48; y += 0.32)
    for (let x = -0.32; x <= 0.32; x += 0.32) {
      const emitter = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 7, 5),
        material,
      );
      emitter.position.set(x, y, 0.19);
      group.add(emitter);
    }
  return group;
}

export function createSpg62Director(
  material: THREE.Material,
  dark: THREE.Material,
  position: THREE.Vector3,
  heading: number,
) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = heading;
  group.userData.stowHeading = heading;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.82, 1.05, 12),
    dark,
  );
  const pivot = new THREE.Group();
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.46),
    material,
  );
  const back = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.72, 0.28, 14),
    dark,
  );
  const feed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.11, 1.45, 7),
    dark,
  );
  const tip = new THREE.Object3D();
  pivot.position.y = 0.65;
  dish.rotation.z = -Math.PI / 2;
  dish.position.x = 0.74;
  back.rotation.z = Math.PI / 2;
  back.position.x = 0.55;
  feed.rotation.z = Math.PI / 2;
  feed.position.x = 1.35;
  tip.position.x = 2.1;
  pivot.add(back, dish, feed, tip);
  group.add(pedestal, pivot);
  group.userData.elevationPivot = pivot;
  group.userData.feedTip = tip;
  return group;
}

export function createMk41VlsBank(
  rows: number,
  columns: number,
  spacing: number,
  material: THREE.Material,
  dark: THREE.Material,
  omitted: readonly number[] = [],
) {
  const group = new THREE.Group();
  const cells: VlsCell[] = [];
  const width = (rows - 1) * spacing + 1.05;
  const depth = (columns - 1) * spacing + 1.05;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.55, 0.28, depth + 0.55),
    dark,
  );
  plinth.position.y = 0.05;
  group.add(plinth);
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const physicalIndex = row * columns + column;
      const x = (row - (rows - 1) / 2) * spacing;
      const z = (column - (columns - 1) / 2) * spacing;
      if (omitted.includes(physicalIndex)) {
        const cranePlate = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.1, 0.68),
          dark,
        );
        cranePlate.position.set(x, 0.25, z);
        group.add(cranePlate);
        continue;
      }
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.67, 0.1, 0.67),
        material,
      );
      const well = new THREE.Mesh(
        new THREE.BoxGeometry(0.51, 0.04, 0.51),
        new THREE.MeshBasicMaterial({ color: 0x182326 }),
      );
      const lid = new THREE.Group();
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.53, 0.055, 0.53),
        material,
      );
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6),
        dark,
      );
      const origin = new THREE.Object3D();
      frame.position.set(x, 0.22, z);
      well.position.set(x, 0.29, z);
      lid.position.set(x - 0.265, 0.34, z);
      panel.position.x = 0.265;
      hinge.rotation.x = Math.PI / 2;
      hinge.position.z = -0.265;
      origin.position.set(x, 0.42, z);
      lid.add(panel, hinge);
      group.add(frame, well, lid, origin);
      cells.push({ lid, origin, index: physicalIndex });
    }
  group.userData.cells = cells;
  return group;
}

export function createSpy1Array(
  material: THREE.Material,
  dark: THREE.Material,
  position: THREE.Vector3,
  rotation: THREE.Euler,
) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.copy(rotation);
  const border = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 2.45, 0.14, 8),
    dark,
  );
  const panelMaterial = material.clone();
  const panel = new THREE.Mesh(
    new THREE.CylinderGeometry(2.18, 2.18, 0.18, 8),
    panelMaterial,
  );
  border.rotation.x = Math.PI / 2;
  panel.rotation.x = Math.PI / 2;
  panel.position.z = 0.09;
  group.add(border, panel);
  for (let x = -1.2; x <= 1.2; x += 0.6)
    for (let y = -1.2; y <= 1.2; y += 0.6) {
      if (Math.hypot(x, y) > 1.65) continue;
      const module = new THREE.Mesh(
        new THREE.CircleGeometry(0.055, 8),
        new THREE.MeshBasicMaterial({ color: 0xdfe3d9 }),
      );
      module.position.set(x, y, 0.2);
      group.add(module);
    }
  group.userData.panel = panel;
  return group;
}
