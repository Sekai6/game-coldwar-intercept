import * as THREE from "three";
import {
  adaptTargetableEntity,
  allTargets,
  sourceForTarget,
  sourceSeed,
  targetForSource,
} from "../dist-test/ship-defense/defense-targets.js";
import {
  recordLaunch,
  resolveShot,
  threatScore,
} from "../dist-test/ship-defense/engagement-runtime.js";
import {
  moveAngle,
  moveToward,
  setMk10Elevation,
} from "../dist-test/ship-defense/launcher-runtime.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const mesh = new THREE.Group();
mesh.position.set(100, 0, 0);
const missile = {
  mesh,
  velocity: new THREE.Vector3(-10, 0, 0),
  phase: "terminal",
  entity: { id: "air-weapon-1", kind: "missile" },
};
const entity = {
  id: "aircraft-1",
  side: "red",
  kind: "aircraft",
  position: mesh.position,
  velocity: new THREE.Vector3(-5, 0, 0),
  radarCrossSection: 4,
  infraredSignature: 1,
  alive: true,
  applyDamage() {},
};
const adapted = adaptTargetableEntity(entity, mesh, {
  phase: "inbound",
  threatType: "P-500",
  displayName: "generic aircraft",
});
assert(adapted.entity === entity && adapted.velocity === entity.velocity && adapted.rcs === 4, "generic entity adapter failed");
const legacy = { ...missile, entity: undefined };
const entities = new Map([["air-weapon-1", missile]]);

assert(targetForSource("air-weapon-1", [legacy], entities) === missile, "entity source lookup failed");
assert(targetForSource(1, [legacy], entities) === legacy, "legacy source lookup failed");
assert(sourceForTarget(missile, [legacy]) === "air-weapon-1", "entity reverse lookup failed");
assert(sourceForTarget(legacy, [legacy]) === 1, "legacy reverse lookup failed");
assert(allTargets([legacy], entities).length === 2, "target aggregation failed");
assert(sourceSeed("track-a") === sourceSeed("track-a"), "source seed is not deterministic");

const engagements = new Map();
recordLaunch(engagements, missile);
recordLaunch(engagements, missile);
const resolved = resolveShot(engagements, missile, "miss", 12);
assert(resolved?.shots === 2 && resolved.pending === 1 && resolved.misses === 1, "engagement accounting failed");
const observation = {
  id: missile.entity.id,
  kind: "missile",
  position: missile.mesh.position,
  velocity: missile.velocity,
  quality: 0.8,
  updatedAt: 0,
};
assert(threatScore(observation, "terminal", "missile", new THREE.Vector3(), 40) > 200, "terminal missile scoring failed");

assert(Math.abs(moveToward(0, 2, 0.5) - 0.5) < 1e-9, "linear slew failed");
assert(Math.abs(moveAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.05) - (Math.PI - 0.05)) < 1e-9, "wrapped angle slew failed");
const armA = new THREE.Group();
const armB = new THREE.Group();
const launcher = { elevation: 0, model: new THREE.Group() };
launcher.model.userData.arms = [armA, armB];
setMk10Elevation(launcher, 0.4);
assert(launcher.elevation === 0.4 && armA.rotation.z === 0.4 && armB.rotation.z === 0.4, "Mk 10 elevation sync failed");

console.log(JSON.stringify({ targets: 2, shots: resolved.shots, score: threatScore(observation, "terminal", "missile", new THREE.Vector3(), 40), elevation: launcher.elevation }, null, 2));
