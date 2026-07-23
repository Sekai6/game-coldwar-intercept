import * as THREE from "three";

const skin = (color: number) => new THREE.MeshStandardMaterial({ color, metalness: 0.42, roughness: 0.52 });
const dark = new THREE.MeshStandardMaterial({ color: 0x20282a, metalness: 0.58, roughness: 0.34 });
const glass = new THREE.MeshStandardMaterial({ color: 0x315866, metalness: 0.2, roughness: 0.18, transparent: true, opacity: 0.88 });
const panel = new THREE.MeshStandardMaterial({ color: 0x515b5a, metalness: 0.48, roughness: 0.46 });

function planarShape(points: readonly [number, number][], thickness = 0.08) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, z) : shape.moveTo(x, z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness * 0.5);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function wing(side: number, span: number, rootChord: number, tipChord: number, sweep: number, material: THREE.Material) {
  const points: [number, number][] = [
    [0, rootChord * 0.5],
    [side * span, rootChord * 0.5 - sweep],
    [side * span, rootChord * 0.5 - sweep - tipChord],
    [0, -rootChord * 0.5],
  ];
  return new THREE.Mesh(planarShape(points), material);
}

function fin(points: readonly [number, number][], material: THREE.Material, thickness = 0.09) {
  const geometry = planarShape(points, thickness);
  geometry.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geometry, material);
}

function axialCapsule(radius: number, cylinderLength: number, material: THREE.Material, radial = 16) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, cylinderLength, 6, radial), material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function axialCone(radius: number, length: number, material: THREE.Material, radial = 16) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, length, radial), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function nozzle(radius: number, length: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius, length, 14, 1, true), dark);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function canopy(length: number, width: number, height: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8), glass);
  mesh.scale.set(width, height, length);
  mesh.position.set(0, height * 0.32, z);
  return mesh;
}

function addFormationLights(group: THREE.Group, span: number) {
  for (const side of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff473d : 0x54f58a }));
    light.position.set(side * span, 0.04, 0.4);
    group.add(light);
  }
}

function finishAircraft(group: THREE.Group, length: number, engines: readonly THREE.Vector3[], detailTags: readonly string[]) {
  group.rotation.order = "YXZ";
  group.userData.forwardAxis = "-Z";
  group.userData.modelLength = length;
  group.userData.detailTags = detailTags;
  const exhausts: THREE.Mesh[] = [];
  for (const p of engines) {
    const glow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.55, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9a45, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = Math.PI / 2;
    glow.position.copy(p);
    glow.position.z += 0.78;
    group.add(glow);
    exhausts.push(glow);
  }
  group.userData.exhausts = exhausts;
  const contrails: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.065, 1, 7, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xe8f2f2, transparent: true, opacity: 0, depthWrite: false }),
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.set(side * Math.max(0.8, length * 0.11), 0.02, length * 0.42 + 2.5);
    trail.visible = false;
    group.add(trail);
    contrails.push(trail);
  }
  group.userData.contrails = contrails;
  const damageSmoke = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0x252a2b, transparent: true, opacity: 0, depthWrite: false }));
  damageSmoke.position.set(0, 0.55, 1.8);
  damageSmoke.visible = false;
  group.add(damageSmoke);
  const damageFire = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  damageFire.position.set(0, 0.3, 1.35);
  damageFire.visible = false;
  group.add(damageFire);
  const crashSplash = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.1, 24), new THREE.MeshBasicMaterial({ color: 0xd9f2ed, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  crashSplash.rotation.x = -Math.PI / 2;
  crashSplash.position.y = -0.2;
  crashSplash.visible = false;
  group.add(crashSplash);
  group.userData.damageSmoke = damageSmoke;
  group.userData.damageFire = damageFire;
  group.userData.crashSplash = crashSplash;
  group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  return group;
}

export function createF14Model() {
  const g = new THREE.Group(), metal = skin(0x9ba5a7);
  const spine = axialCapsule(0.58, 5.6, metal); spine.position.z = -0.45; spine.scale.y = 0.82; g.add(spine);
  const nose = axialCone(0.56, 2.55, metal); nose.position.z = -4.65; g.add(nose);
  g.add(canopy(1.55, 0.72, 0.48, -2.45));
  const glove = new THREE.Mesh(planarShape([[-1.55, 1.3], [1.55, 1.3], [1.8, -1.65], [-1.8, -1.65]], 0.16), metal); glove.position.z = -0.25; g.add(glove);
  const variableWings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const nacelle = axialCapsule(0.48, 3.8, metal, 12); nacelle.position.set(side * 1.02, -0.18, 1.25); nacelle.scale.y = 0.8; g.add(nacelle);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.5, 1.15), dark); intake.position.set(side * 1.02, -0.28, -1.0); intake.rotation.x = 0.08; g.add(intake);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.85), panel); ramp.position.set(side * 1.02, -0.02, -1.05); g.add(ramp);
    const pivot = new THREE.Group(); pivot.position.set(side * 0.68, 0.02, -0.25);
    pivot.add(wing(side, 3.15, 2.15, 0.72, 1.25, metal)); g.add(pivot); variableWings.push(pivot);
    const tail = fin([[0, -0.7], [1.25, -0.15], [1.5, 0.65], [0, 0.75]], metal); tail.position.set(side * 1.02, 0.55, 2.75); tail.rotation.z = side * -0.16; g.add(tail);
    const stabilator = wing(side, 1.35, 1.2, 0.5, 0.45, metal); stabilator.position.set(side * 0.78, 0.05, 3.05); g.add(stabilator);
    const jet = nozzle(0.43, 0.72); jet.position.set(side * 1.02, -0.16, 3.55); g.add(jet);
  }
  g.userData.variableWings = variableWings;
  addFormationLights(g, 3.75);
  return finishAircraft(g, 9.6, [new THREE.Vector3(-1.02, -0.16, 3.72), new THREE.Vector3(1.02, -0.16, 3.72)], ["tandem-canopy", "variable-sweep-wings", "twin-nacelles", "twin-tails", "stabilators", "intake-ramps"]);
}

export function createTu16Model() {
  const g = new THREE.Group(), metal = skin(0xa6aaa5);
  const body = axialCapsule(0.74, 9.4, metal, 18); body.scale.y = 0.92; g.add(body);
  const glazedNose = new THREE.Mesh(new THREE.SphereGeometry(0.68, 16, 10), glass); glazedNose.scale.set(1, 0.8, 1.45); glazedNose.position.z = -5.45; g.add(glazedNose);
  const cockpit = canopy(1.0, 0.68, 0.34, -4.35); cockpit.position.y = 0.45; g.add(cockpit);
  for (const side of [-1, 1]) {
    const mainWing = wing(side, 5.85, 3.0, 0.9, 2.15, metal); mainWing.position.z = -0.45; g.add(mainWing);
    const pod = axialCapsule(0.42, 2.15, panel, 12); pod.position.set(side * 2.55, -0.3, 0.1); g.add(pod);
    const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.28, 12), dark); inlet.rotation.x = Math.PI / 2; inlet.position.set(side * 2.55, -0.3, -1.15); g.add(inlet);
    const tailplane = wing(side, 2.25, 1.45, 0.55, 0.75, metal); tailplane.position.set(0, 0.12, 4.0); g.add(tailplane);
    const jet = nozzle(0.32, 0.5); jet.position.set(side * 2.55, -0.3, 1.45); g.add(jet);
  }
  const vertical = fin([[0, -1.0], [2.25, -0.2], [2.4, 0.65], [0, 0.85]], metal, 0.12); vertical.position.set(0, 0.7, 3.75); g.add(vertical);
  const ventralRadar = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), panel); ventralRadar.scale.set(1, 0.5, 1.4); ventralRadar.position.set(0, -0.78, 1.2); g.add(ventralRadar);
  addFormationLights(g, 6.0);
  return finishAircraft(g, 12, [new THREE.Vector3(-2.55, -0.3, 1.62), new THREE.Vector3(2.55, -0.3, 1.62)], ["glazed-nose", "swept-wings", "wing-engine-pods", "high-tailplane", "single-fin", "ventral-radar"]);
}

export function createA6Model() {
  const g = new THREE.Group(), metal = skin(0x8d9997);
  const body = axialCapsule(0.68, 6.2, metal); body.position.z = -0.15; body.scale.y = 0.9; g.add(body);
  const bluntNose = new THREE.Mesh(new THREE.SphereGeometry(0.64, 16, 10), metal); bluntNose.scale.set(1, 0.88, 1.35); bluntNose.position.z = -4.0; g.add(bluntNose);
  const cockpit = canopy(1.3, 0.95, 0.42, -2.7); cockpit.scale.x = 1.2; g.add(cockpit);
  for (const side of [-1, 1]) {
    const mainWing = wing(side, 3.75, 2.3, 0.78, 1.0, metal); mainWing.position.z = -0.2; g.add(mainWing);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.05, 12), dark); intake.rotation.x = Math.PI / 2; intake.position.set(side * 0.82, -0.08, -1.7); g.add(intake);
    const exhaust = nozzle(0.3, 0.65); exhaust.position.set(side * 0.72, -0.12, 2.7); g.add(exhaust);
    const tailplane = wing(side, 1.55, 1.2, 0.45, 0.42, metal); tailplane.position.set(0, 0.05, 3.05); g.add(tailplane);
  }
  const vertical = fin([[0, -0.75], [1.65, -0.1], [1.75, 0.58], [0, 0.72]], metal); vertical.position.set(0, 0.62, 2.65); g.add(vertical);
  const speedBrake = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.42), panel); speedBrake.position.set(0, 0.62, 0.75); g.add(speedBrake);
  addFormationLights(g, 3.85);
  return finishAircraft(g, 8.8, [new THREE.Vector3(-0.72, -0.12, 2.92), new THREE.Vector3(0.72, -0.12, 2.92)], ["side-by-side-canopy", "blunt-radome", "shoulder-intakes", "straight-swept-wings", "single-fin", "dorsal-speed-brake"]);
}

export function createMig29Model() {
  const g = new THREE.Group(), metal = skin(0x89958f), radome = skin(0x68726e);
  const body = axialCapsule(0.5, 5.1, metal); body.position.z = -0.55; body.scale.y = 0.82; g.add(body);
  const nose = axialCone(0.48, 2.35, radome); nose.position.z = -4.25; g.add(nose);
  g.add(canopy(1.35, 0.72, 0.45, -2.45));
  const centerBlend = new THREE.Mesh(planarShape([[-1.15, 1.6], [1.15, 1.6], [1.48, -1.55], [-1.48, -1.55]], 0.16), metal); centerBlend.position.z = 0.15; g.add(centerBlend);
  for (const side of [-1, 1]) {
    const lerx = wing(side, 1.55, 2.25, 0.32, 0.95, metal); lerx.position.set(side * 0.32, 0.08, -1.25); g.add(lerx);
    const mainWing = wing(side, 3.0, 2.3, 0.72, 1.1, metal); mainWing.position.set(side * 0.58, 0, -0.05); g.add(mainWing);
    const nacelle = axialCapsule(0.4, 3.35, metal, 12); nacelle.position.set(side * 0.86, -0.22, 1.15); nacelle.scale.y = 0.82; g.add(nacelle);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.48, 1.0), dark); intake.position.set(side * 0.86, -0.34, -0.95); intake.rotation.x = 0.1; g.add(intake);
    const tail = fin([[0, -0.68], [1.35, -0.12], [1.48, 0.58], [0, 0.68]], metal); tail.position.set(side * 0.82, 0.56, 2.35); tail.rotation.z = side * -0.2; g.add(tail);
    const stabilator = wing(side, 1.32, 1.15, 0.42, 0.4, metal); stabilator.position.set(side * 0.65, 0.02, 2.85); g.add(stabilator);
    const jet = nozzle(0.35, 0.62); jet.position.set(side * 0.86, -0.2, 3.05); g.add(jet);
  }
  addFormationLights(g, 3.45);
  return finishAircraft(g, 8.65, [new THREE.Vector3(-0.86, -0.2, 3.25), new THREE.Vector3(0.86, -0.2, 3.25)], ["bubble-canopy", "lerx", "twin-nacelles", "separate-intakes", "canted-twin-tails", "stabilators"]);
}
