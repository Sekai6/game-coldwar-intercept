import * as THREE from "three";
import { CombatPicture } from "../dist-test/sim.js";

const picture = new CombatPicture([{
  name: "TEST-3D",
  threeDimensional: true,
  baseInterval: 0.1,
  maxRange: 1000,
  radarHeight: 30,
  precision: 1,
}]);
const numeric = { id: 1, position: new THREE.Vector3(20, 20, 0), velocity: new THREE.Vector3(), altitude: 1000, rcs: 10 };
const stable = { id: "air-entity-red-1", position: new THREE.Vector3(-20, 20, 0), velocity: new THREE.Vector3(), altitude: 1000, rcs: 10 };

for (let step = 0; step < 20; step++) picture.update(step * 0.1, 0.1, [numeric, stable]);
const result = {
  numeric: picture.trackForTarget(1)?.sourceId,
  stable: picture.trackForTarget("air-entity-red-1")?.sourceId,
  trackCount: picture.tracks.size,
};
console.log(JSON.stringify(result, null, 2));
if (result.numeric !== 1 || result.stable !== "air-entity-red-1" || result.trackCount < 2) process.exitCode = 1;
