import * as THREE from "three";
import { applySurfaceDetail } from "../visual/material-textures.js";
import { addThreatRadialFinSet, addThreatSurfaceDetail, attachThreatEffects } from "./model-helpers.js";

interface SeaSkimmerModelOptions {
  identity: string;
  length: number;
  radius: number;
  noseLength: number;
  noseShape: "rounded" | "pointed";
  skinColor: number;
  radomeColor: number;
  wingZ: number;
  wingSpan: number;
  wingChord: number;
  sweptWings: boolean;
  wingRotation?: number;
  tailSpan: number;
  tailChord: number;
  tailZ?: number;
  tailSwept?: boolean;
  intake?: { length: number; width: number; depth: number; z: number; rounded?: boolean };
  exhaustLength: number;
}

/** Geometry only: capability decisions belong to each complete threat definition. */
export function createSeaSkimmerModel(options: SeaSkimmerModelOptions) {
  const group = new THREE.Group();
  const material = (color: number, texture: "missile-skin" | "dark-metal") => applySurfaceDetail(
    new THREE.MeshStandardMaterial({ color, metalness: .36, roughness: .48 }), texture, .18,
  );
  const skin = material(options.skinColor, "missile-skin");
  const radomeMaterial = material(options.radomeColor, "missile-skin");
  const dark = material(0x30383a, "dark-metal");
  const { length, radius, noseLength } = options;
  const tailLength = length * .055;
  const bodyLength = length - noseLength - tailLength;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, bodyLength, 24), skin);
  body.name = "airframe-body";
  body.rotation.x = Math.PI / 2;
  group.add(body);

  let nose: THREE.Mesh;
  if (options.noseShape === "rounded") {
    nose = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), radomeMaterial);
    nose.scale.y = noseLength / radius;
  } else {
    nose = new THREE.Mesh(new THREE.ConeGeometry(radius, noseLength, 24), radomeMaterial);
  }
  nose.name = "radar-radome";
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -bodyLength / 2 - (options.noseShape === "pointed" ? noseLength / 2 : 0);
  group.add(nose);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(radius * .66, radius, tailLength, 20), dark);
  tail.name = "engine-nozzle";
  tail.rotation.x = Math.PI / 2;
  tail.position.z = bodyLength / 2 + tailLength / 2;
  group.add(tail);
  const nozzle = new THREE.Mesh(new THREE.TorusGeometry(radius * .61, radius * .07, 6, 24), dark);
  nozzle.position.z = bodyLength / 2 + tailLength;
  group.add(nozzle);

  const wings = new THREE.Group();
  wings.name = "main-wings";
  wings.rotation.z = options.wingRotation ?? 0;
  addThreatRadialFinSet(wings, { z: options.wingZ, radius, span: options.wingSpan, chord: options.wingChord, thickness: .035, material: skin, swept: options.sweptWings });
  group.add(wings);
  const controls = new THREE.Group();
  controls.name = "control-fins";
  addThreatRadialFinSet(controls, { z: options.tailZ ?? bodyLength * .38, radius, span: options.tailSpan, chord: options.tailChord, thickness: .03, material: skin, swept: options.tailSwept ?? true });
  group.add(controls);
  if (options.intake) {
    const intake = options.intake;
    const housing = new THREE.Mesh(intake.rounded
      ? new THREE.CylinderGeometry(intake.width / 2, intake.width / 2, intake.length, 16)
      : new THREE.BoxGeometry(intake.width, intake.depth, intake.length), skin);
    if (intake.rounded) housing.rotation.x = Math.PI / 2;
    housing.name = "ventral-intake";
    housing.position.set(0, -radius - intake.depth * .28, intake.z);
    group.add(housing);
    const opening = new THREE.Mesh(intake.rounded
      ? new THREE.CircleGeometry(intake.width * .4, 16)
      : new THREE.PlaneGeometry(intake.width * .75, intake.depth * .72), dark);
    opening.name = "intake-opening";
    opening.rotation.y = Math.PI;
    opening.position.set(0, housing.position.y, intake.z - intake.length / 2 - .005);
    group.add(opening);
  }

  attachThreatEffects(group, {
    // The effects helper positions the nozzle at length / 2 + .2.
    length: bodyLength + 2 * tailLength - .4, radius,
    exhaustLength: options.exhaustLength, exhaustOpacity: .46,
    mistRadius: radius * 1.8, mistLength: length * .8, mistOpacity: .08,
    seekerRadius: 7, seekerLength: 30,
  });
  addThreatSurfaceDetail(group, bodyLength, radius, options.identity, dark);
  return group;
}
