import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateScenarioDocument } from "../dist-test-scenario/scenario-system/validator.js";
import { exportScenarioJson, importScenarioJson } from "../dist-test-scenario/scenario-system/import-export.js";

const source = await readFile(new URL("../src/scenarios/full-spectrum-blackout/scenario.json", import.meta.url), "utf8");
const document = importScenarioJson(source);
const reloaded = importScenarioJson(exportScenarioJson(document));
assert.deepEqual(reloaded, document, "load -> normalize -> export -> reload must preserve semantics");
assert(Object.isFrozen(document) && Object.isFrozen(document.forces) && Object.isFrozen(document.forces[0]), "normalized scenario documents must be deeply immutable");
assert.equal(validateScenarioDocument(document, { shipDefinitions: ["long-beach", "ticonderoga", "slava-moskva"] }).valid, true);
assert.deepEqual(document.timeline.filter((event) => event.type === "space-weather-phase").map((event) => event.at), [0, 150, 210, 260, 300, 720, 960]);
assert.deepEqual(document.timeline.filter((event) => event.type === "comms-window").map((event) => [event.at, event.at + event.duration]), [[748, 766], [824, 850], [914, 929]]);

const malformed = [
  null, [], {},
  { schemaVersion: 1, metadata: null, simulation: [], forces: [null], routes: [null], zones: [null], objectives: [null], timeline: [null], guidance: { cues: [null] } },
  { ...document, forces: [{}] },
  { ...document, routes: [{ id: "broken", kind: "transit", points: [null] }] },
];
for (const [index, value] of malformed.entries()) {
  let result;
  assert.doesNotThrow(() => { result = validateScenarioDocument(value); }, `malformed case ${index} must not throw TypeError`);
  assert.equal(result.valid, false, `malformed case ${index} must be rejected`);
}
assert.throws(() => importScenarioJson("{"), SyntaxError);
assert.equal(validateScenarioDocument(document, { shipDefinitions: ["long-beach"] }).valid, false);

for (const threatId of ["R-360 Neptune", "3M24 Uran", "ASM-1", "RBS-15 Mk. II", "MM38 Exocet"]) {
  const wave = { id:"new-wave", threatId, side:"red", source:"in-flight", count:2, firstLaunchAt:0, intervalSeconds:1.5, origin:[0,.3,-420], altitude:.3, spread:80 };
  const candidate = { ...document, threatWaves:[wave] };
  const imported = importScenarioJson(JSON.stringify(candidate));
  assert.equal(importScenarioJson(exportScenarioJson(imported)).threatWaves[0].threatId, threatId);
  const platformWave = { ...wave, source:"surface-platform", sourcePlatformId:"red-moskva" };
  const rejected = validateScenarioDocument({ ...document, threatWaves:[platformWave] });
  assert(!rejected.valid && rejected.issues.some((issue) => issue.path === "threatWaves[0].source"), `${threatId} must not claim a physical launcher`);
  const invalidAir = { ...document, forces:document.forces.map((force) => force.id === "blue-f14-cap" ? { ...force, loadout:{ [threatId]:1 } } : force) };
  assert.equal(validateScenarioDocument(invalidAir).valid, false, `${threatId} is not an aircraft loadout`);
}

const unknownReferenceCases = [
  ["environment preset", { ...document, environment: { ...document.environment, presetId: "unknown-environment" } }, "environment.presetId"],
  ["time of day", { ...document, environment: { ...document.environment, timeOfDay: "midnight-sunrise" } }, "environment.timeOfDay"],
  ["coast backdrop", { ...document, environment: { ...document.environment, coastBackdropId: "remote-image-url" } }, "environment.coastBackdropId"],
  ["ship loadout", { ...document, forces: document.forces.map((force) => force.id === "blue-cg-57" ? { ...force, loadout: { ...(force.loadout ?? {}), "MAGIC-SAM": 4 } } : force) }, "loadout.MAGIC-SAM"],
  ["air loadout", { ...document, forces: document.forces.map((force) => force.id === "blue-f14-cap" ? { ...force, loadout: { "MAGIC-AAM": 4 } } : force) }, "loadout.MAGIC-AAM"],
  ["objective weapon", { ...document, objectives: document.objectives.map((objective, index) => index === 0 ? { ...objective, criteria: { ...(objective.criteria ?? {}), requiredWeaponIds: ["MAGIC-MISSILE"] } } : objective) }, "requiredWeaponIds"],
  ["threat definition", { ...document, threatWaves: [{ id:"bad-wave", threatId:"MAGIC-THREAT", side:"red", source:"in-flight", count:1, firstLaunchAt:0, intervalSeconds:0, origin:[0,1,0], altitude:1, spread:0 }] }, "threatId"],
];
for (const [label, candidate, expectedPath] of unknownReferenceCases) {
  const result = validateScenarioDocument(candidate, { shipDefinitions: ["long-beach", "ticonderoga", "slava-moskva"] });
  assert.equal(result.valid, false, `${label} must be rejected before scenario startup`);
  assert(result.issues.some((issue) => issue.path.includes(expectedPath)), `${label} must identify the invalid reference path`);
}

console.log("scenario runtime verification passed: validation safety, complete catalog references and timeline facts");
