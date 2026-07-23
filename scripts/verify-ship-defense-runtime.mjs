import * as THREE from "three";
import { opposingSides } from "../dist-test/defense/allegiance.js";
import {
  adaptTargetableEntity,
  indexedDefenseTargetSource,
  mappedDefenseTargetSource,
  sourceSeed,
} from "../dist-test/ship-defense/defense-targets.js";
import {
  createDefenseTargetSource,
  DefenseTargetRegistry,
} from "../dist-test/defense/target-source.js";
import {
  authorizeLaunch,
  resolveShot,
  threatScore,
} from "../dist-test/ship-defense/engagement-runtime.js";
import {
  moveAngle,
  moveToward,
  resetMk10LauncherRuntime,
  setMk10Elevation,
  updateMk10LauncherRuntime,
} from "../dist-test/ship-defense/launcher-runtime.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(
  opposingSides({ side: "blue" }, { side: "red" }),
  "opposing sides were not hostile",
);

assert(
  opposingSides({ side: "red" }, { side: "blue" }),
  "reversed defender roles were not hostile",
);
assert(
  !opposingSides({ side: "red" }, { side: "red" }),
  "same side was treated as hostile",
);

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
assert(
  adapted.entity === entity &&
    adapted.velocity === entity.velocity &&
    adapted.rcs === 4,
  "generic entity adapter failed",
);
const legacy = { ...missile, entity: undefined };
const entities = new Map([["air-weapon-1", missile]]);
const registry = new DefenseTargetRegistry();
registry.register(indexedDefenseTargetSource("legacy", [legacy]));
registry.register(mappedDefenseTargetSource("entities", entities));
assert(registry.get("air-weapon-1") === missile, "entity source lookup failed");
assert(registry.get(1) === legacy, "legacy source lookup failed");
assert(
  registry.idFor(missile) === "air-weapon-1",
  "entity reverse lookup failed",
);
assert(registry.idFor(legacy) === 1, "legacy reverse lookup failed");

const futureTarget = { ...adapted, displayName: "future undersea contact" };
const unregisterFuture = registry.register(
  createDefenseTargetSource(
    "future-domain",
    () => [["future-contact", futureTarget]],
    { observable: () => false },
  ),
);
assert(
  registry.values().length === 3,
  "pluggable target source was not aggregated",
);
assert(
  registry.observableEntries().length === 2,
  "source observation filter was not respected",
);
unregisterFuture();
assert(!registry.get("future-contact"), "target source did not unregister");

const unregisterDuplicate = registry.register(
  createDefenseTargetSource("duplicate", () => [
    ["air-weapon-1", futureTarget],
  ]),
);
let duplicateRejected = false;
try {
  registry.entries();
} catch {
  duplicateRejected = true;
}
unregisterDuplicate();
assert(duplicateRejected, "duplicate target id was not rejected");
assert(
  sourceSeed("track-a") === sourceSeed("track-a"),
  "source seed is not deterministic",
);

const engagements = new Map();
const targetId = registry.idFor(missile);
const rejected = authorizeLaunch(engagements, targetId, () => false);
assert(
  !rejected && engagements.size === 0,
  "rejected authorization polluted engagement ledger",
);
authorizeLaunch(engagements, targetId, () => true);
authorizeLaunch(engagements, targetId, () => true);
const resolved = resolveShot(engagements, targetId, "miss", 12);
assert(
  resolved?.shots === 2 && resolved.pending === 1 && resolved.misses === 1,
  "engagement accounting failed",
);
const cancelled = resolveShot(engagements, targetId, "cancel", 13);
assert(
  cancelled?.pending === 0 && cancelled.misses === 1,
  "authorized launch cancellation failed",
);
const observation = {
  id: missile.entity.id,
  kind: "missile",
  position: missile.mesh.position,
  velocity: missile.velocity,
  quality: 0.8,
  updatedAt: 0,
};
assert(
  threatScore(observation, "terminal", "missile", new THREE.Vector3(), 40) >
    200,
  "terminal missile scoring failed",
);

assert(Math.abs(moveToward(0, 2, 0.5) - 0.5) < 1e-9, "linear slew failed");
assert(
  Math.abs(moveAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.05) - (Math.PI - 0.05)) <
    1e-9,
  "wrapped angle slew failed",
);
const armA = new THREE.Group();
const armB = new THREE.Group();
const launcher = { elevation: 0, model: new THREE.Group() };
launcher.model.userData.arms = [armA, armB];
setMk10Elevation(launcher, 0.4);
assert(
  launcher.elevation === 0.4 &&
    armA.rotation.z === 0.4 &&
    armB.rotation.z === 0.4,
  "Mk 10 elevation sync failed",
);

const mk10Model = new THREE.Group();
const mk10Arm = new THREE.Group();
mk10Model.userData.arms = [mk10Arm];
const round = new THREE.Group();
round.userData.homePosition = new THREE.Vector3();
round.userData.homeScale = new THREE.Vector3(1, 1, 1);
mk10Model.add(round);
const mk10 = {
  name: "FORWARD",
  model: mk10Model,
  stowAzimuth: 0,
  phase: "slewing",
  phaseSince: 0,
  pending: { target: missile, weapon: "RIM-67" },
  azimuth: 0,
  elevation: 0,
  railIndex: 0,
  reloadRail: -1,
  rounds: [round],
};
const config = {
  kind: "mk10",
  displayName: "MK 10",
  compatibleWeapons: ["RIM-67"],
  azimuthRateDeg: 180,
  elevationRateDeg: 180,
  reloadSeconds: 1,
};
let launches = 0;
let returned = 0;
const runMk10 = (elapsed, health = 1, track = new THREE.Vector3(100, 10, 0)) =>
  updateMk10LauncherRuntime({
    config,
    launchers: [mk10],
    elapsed,
    dt: 1,
    health: () => health,
    trackPosition: () => track,
    worldToLocal: (position) => position,
    returnAmmo: () => returned++,
    cancel: () => {},
    launch: () => {
      launches++;
      return {};
    },
    log: () => {},
  });
runMk10(0);
assert(launches === 1 && mk10.phase === "firing" && !round.visible, "Mk 10 did not physically release its rail round");
runMk10(0.4);
runMk10(1.4);
runMk10(2.5);
assert(mk10.phase === "ready" && round.visible, "Mk 10 did not return, reload, and become ready");
resetMk10LauncherRuntime([mk10]);
mk10.pending = { target: missile, weapon: "RIM-67" };
mk10.phase = "slewing";
runMk10(3, 0);
assert(
  returned === 1 &&
    (mk10.phase === "returning" || mk10.phase === "ready") &&
    !mk10.pending,
  "Mk 10 casualty did not cancel and return ammunition",
);

console.log(
  JSON.stringify(
    {
      targets: 2,
      shots: resolved.shots,
      score: threatScore(
        observation,
        "terminal",
        "missile",
        new THREE.Vector3(),
        40,
      ),
      elevation: launcher.elevation,
      mk10Launches: launches,
      mk10ReturnedRounds: returned,
    },
    null,
    2,
  ),
);
