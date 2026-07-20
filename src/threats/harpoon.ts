import * as THREE from "three";
import { applySurfaceDetail } from "../visual/material-textures";
import { attachThreatEffects } from "./model-helpers";
import type { ThreatDefinition } from "./types";

function createModel() {
  const group = new THREE.Group(),
    skin = applySurfaceDetail(
      new THREE.MeshStandardMaterial({
        color: 0xd5d6d1,
        metalness: 0.42,
        roughness: 0.46,
      }),
      "missile-skin",
      0.18,
    ),
    dark = applySurfaceDetail(
      new THREE.MeshStandardMaterial({
        color: 0x343a3b,
        metalness: 0.5,
        roughness: 0.4,
      }),
      "dark-metal",
      0.26,
    ),
    band = applySurfaceDetail(
      new THREE.MeshStandardMaterial({
        color: 0xb49336,
        metalness: 0.35,
        roughness: 0.48,
      }),
      "painted-metal",
      0.16,
    ),
    length = 6.2,
    radius = 0.45;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, length, 16),
    skin,
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const radome = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.92, 1.15, 16),
    dark,
  );
  radome.rotation.x = -Math.PI / 2;
  radome.position.z = -length * 0.5 - 0.55;
  group.add(radome);
  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    dark,
  );
  noseTip.position.z = -length * 0.5 - 1.12;
  group.add(noseTip);
  const idBand = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, 0.18, 16),
    band,
  );
  idBand.rotation.x = Math.PI / 2;
  idBand.position.z = -length * 0.22;
  group.add(idBand);
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius, 0.8, 16),
    dark,
  );
  tail.rotation.x = Math.PI / 2;
  tail.position.z = length * 0.5 + 0.3;
  group.add(tail);
  const addFinSet = (
    z: number,
    span: number,
    chord: number,
    material: THREE.Material,
  ) => {
    for (let index = 0; index < 4; index++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(span, 0.08, chord),
        material,
      );
      fin.position.z = z;
      fin.rotation.z = index * Math.PI * 0.5;
      group.add(fin);
    }
  };
  addFinSet(0.15, 2.8, 1.35, skin);
  addFinSet(length * 0.39, 1.65, 0.85, dark);
  const intakeOuter = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.48, 1.45),
    skin,
  );
  intakeOuter.position.set(0, -radius * 1.02, 0.72);
  group.add(intakeOuter);
  const intake = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.3, 1.28),
    dark,
  );
  intake.position.set(0, -radius * 1.28, 0.58);
  group.add(intake);
  attachThreatEffects(group, {
    length,
    radius: 0.4,
    exhaustLength: 1.65,
    exhaustColor: 0xff8b45,
    exhaustOpacity: 0.56,
    mistRadius: 0.8,
    mistLength: 6,
    mistOpacity: 0.11,
    seekerRadius: 7,
    seekerLength: 30,
  });
  return group;
}

export const HARPOON = {
  id: "RGM-84 Harpoon",
  profile: {
    cruiseAltitude: 0.9,
    terminalAltitude: 0.12,
    terminalAt: 130,
    cruiseSpeed: 5.8,
    terminalSpeed: 6.4,
    turnRate: 11,
    damage: 20,
    defaultRange: 420,
    burnThroughRange: 22,
    radarCrossSection: 0.18,
    modelScale: 0.82,
    selectionRadius: 3.2,
    pathColor: 0xf1b44c,
    threatPriority: 6,
    trajectory: "sea-skimmer",
    ciwsPenalty: 0.08,
    terminalAttackModes: ["skim", "skim", "skim", "pop-up"],
    popUp: {
      startRange: 48,
      peakAltitude: 2.4,
    },
    homeOnJam: {
      minimumJammingStrength: 0.42,
      residualErrorFactor: 0.18,
    },
    weave: {
      lateral: 1.4,
      longitudinal: 0.8,
      lateralRate: 4.2,
      longitudinalRate: 3.6,
    },
  },
  preset: {
    label: "HARPOON RAID",
    count: 8,
    interval: 1.2,
    altitude: 0.9,
    spread: 180,
    range: 420,
  },
  createModel,
} as const satisfies ThreatDefinition;
