import * as THREE from "three";

const skin = (color: number) => new THREE.MeshStandardMaterial({ color, metalness: 0.48, roughness: 0.48 });
const dark = new THREE.MeshStandardMaterial({ color: 0x22292b, metalness: 0.55, roughness: 0.36 });

function wingShape(root: number, tip: number, length: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(root, length * 0.18); shape.lineTo(tip, length); shape.lineTo(-tip * 0.3, length * 0.84); shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
}

function finishAircraft(group: THREE.Group, length: number, engines: readonly THREE.Vector3[]) {
  group.rotation.order = "YXZ";
  group.userData.forwardAxis = "-Z";
  group.userData.modelLength = length;
  const exhausts: THREE.Mesh[] = [];
  for (const p of engines) {
    const glow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.7, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a45, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = Math.PI / 2; glow.position.copy(p); glow.position.z += 0.8; group.add(glow); exhausts.push(glow);
  }
  group.userData.exhausts = exhausts;
  group.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return group;
}

export function createF14Model() {
  const g = new THREE.Group(), metal = skin(0x9aa3a4);
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 6.4, 8, 16), metal); fuselage.rotation.x = Math.PI / 2; g.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 16), metal); nose.rotation.x = -Math.PI / 2; nose.position.z = -4.8; g.add(nose);
  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.78, 4.8), metal); nacelle.position.set(side * 1.05, -0.12, 1.35); g.add(nacelle);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.48, 1), dark); intake.position.set(side * 1.05, -0.22, -1.15); g.add(intake);
    const wingRoot = new THREE.Group(); wingRoot.position.set(side * 0.58, 0, -0.35); wingRoot.rotation.y = side * 0.28;
    const wing = new THREE.Mesh(wingShape(0.65, 0.72, 3.4), metal); wing.rotation.x = Math.PI / 2; wing.rotation.z = side < 0 ? Math.PI : 0; wingRoot.add(wing); g.add(wingRoot);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.65, 1.65), metal); tail.position.set(side * 1.05, 0.9, 2.8); tail.rotation.z = side * -0.16; g.add(tail);
  }
  g.userData.variableWings = g.children.filter(o => o instanceof THREE.Group);
  return finishAircraft(g, 9.6, [new THREE.Vector3(-1.05, 0, 3.8), new THREE.Vector3(1.05, 0, 3.8)]);
}

export function createTu16Model() {
  const g = new THREE.Group(), metal = skin(0xa7aaa5);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 9.5, 8, 18), metal); body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 10), new THREE.MeshStandardMaterial({ color: 0x6f8f94, metalness: 0.15, roughness: 0.25 })); nose.scale.z = 1.35; nose.position.z = -5.55; g.add(nose);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingShape(1.3, 1.15, 6.5), metal); wing.rotation.x = Math.PI / 2; wing.rotation.z = side < 0 ? Math.PI : 0; wing.position.set(side * 0.5, 0, -0.8); g.add(wing);
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 2.4, 6, 12), dark); pod.rotation.x = Math.PI / 2; pod.position.set(side * 2.6, -0.28, 0.2); g.add(pod);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.5, 2.4), metal); fin.position.set(0, 1.25, 4.25); g.add(fin);
  return finishAircraft(g, 12, [new THREE.Vector3(-2.6, -0.28, 1.65), new THREE.Vector3(2.6, -0.28, 1.65)]);
}

export function createA6Model() {
  const g = new THREE.Group(), metal = skin(0x8c9996);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.76, 6.8, 8, 16), metal); body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.76, 16, 10), metal); nose.scale.z = 1.3; nose.position.z = -4.25; g.add(nose);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingShape(0.95, 0.85, 4.1), metal); wing.rotation.x = Math.PI / 2; wing.rotation.z = side < 0 ? Math.PI : 0; wing.position.set(side * 0.45, 0, -0.35); g.add(wing);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.4, 12), dark); intake.rotation.x = Math.PI / 2; intake.position.set(side * 0.9, -0.05, -1.85); g.add(intake);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.7), metal); fin.position.set(0, 0.95, 3.1); g.add(fin);
  return finishAircraft(g, 8.8, [new THREE.Vector3(-0.9, 0, 2.55), new THREE.Vector3(0.9, 0, 2.55)]);
}
