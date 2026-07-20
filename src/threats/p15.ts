import * as THREE from "three";
import { attachThreatEffects } from "./model-helpers";
import type { ThreatDefinition } from "./types";

function createModel() {
  const group = new THREE.Group(),
    skin = new THREE.MeshStandardMaterial({
      color: 0xd7d8d2,
      metalness: 0.46,
      roughness: 0.43,
    }),
    radomeMaterial = new THREE.MeshStandardMaterial({
      color: 0x596b70,
      metalness: 0.28,
      roughness: 0.55,
    }),
    dark = new THREE.MeshStandardMaterial({
      color: 0x30383a,
      metalness: 0.5,
      roughness: 0.42,
    }),
    length = 8.8,
    radius = 0.82;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.91, radius, length, 18),
    skin,
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const radome = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.96, 18, 12),
    radomeMaterial,
  );
  radome.scale.z = 1.35;
  radome.position.z = -length * 0.5 - 0.62;
  group.add(radome);
  const radomeCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.93, radius * 0.93, 0.28, 18),
    dark,
  );
  radomeCollar.rotation.x = Math.PI / 2;
  radomeCollar.position.z = -length * 0.43;
  group.add(radomeCollar);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.35);
  wingShape.lineTo(4.35, 0.25);
  wingShape.lineTo(3.7, 1.75);
  wingShape.lineTo(0, 1.05);
  wingShape.closePath();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), skin);
    wing.rotation.x = Math.PI / 2;
    wing.rotation.z = side < 0 ? Math.PI : 0;
    wing.position.set(side * radius * 0.35, -0.08, 0.65);
    group.add(wing);
  }
  for (let index = 0; index < 4; index++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.1, 1.8),
      skin,
    );
    fin.position.z = length * 0.39;
    fin.rotation.z = index * Math.PI * 0.5;
    group.add(fin);
  }
  const intakeFairing = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.62, 2.7),
    skin,
  );
  intakeFairing.position.set(0, -radius * 1.03, 0.85);
  group.add(intakeFairing);
  const intakeOpening = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.42, 0.16),
    dark,
  );
  intakeOpening.position.set(0, -radius * 1.25, -0.55);
  group.add(intakeOpening);
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.46, 0.8, 14),
    dark,
  );
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = length * 0.5 + 0.32;
  group.add(nozzle);
  attachThreatEffects(group, {
    length,
    radius: 0.6,
    exhaustLength: 2.2,
    exhaustOpacity: 0.58,
    mistRadius: 1.15,
    mistLength: 7.5,
    mistOpacity: 0.12,
    seekerRadius: 9.5,
    seekerLength: 34,
  });
  return group;
}

export const P15 = {
  id: "P-15 Termit",
  profile: {
    cruiseAltitude: 1.95,
    terminalAltitude: 0.25,
    terminalAt: 240,
    terminalDescentAt: 20,
    cruiseSpeed: 6.2,
    terminalSpeed: 6.4,
    turnRate: 8,
    damage: 32,
    defaultRange: 400,
    burnThroughRange: 28,
    radarCrossSection: 0.65,
    modelScale: 0.96,
    selectionRadius: 4.5,
    pathColor: 0xef7651,
    threatPriority: 10,
    trajectory: "sea-skimmer",
    ciwsPenalty: 0.06,
    weave: {
      lateral: 0.45,
      longitudinal: 0.25,
      lateralRate: 1.7,
      longitudinalRate: 1.35,
    },
  },
  preset: {
    label: "P-15 RAID",
    count: 6,
    interval: 1.8,
    altitude: 1.95,
    spread: 160,
    range: 400,
  },
  createModel,
} as const satisfies ThreatDefinition;
