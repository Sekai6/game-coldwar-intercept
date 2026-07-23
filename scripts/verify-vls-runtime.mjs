import * as THREE from "three";
import {
  applyVlsDamageIsolation,
  reserveLauncherResource,
  resetVlsRuntime,
  updateVlsRuntime,
} from "../dist-test/ship-defense/launcher-runtime.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const makeBank = () => ({
  lastLaunchAt: -Infinity,
  lastCellIndex: -1,
  minimumObservedGap: Infinity,
  launchHistory: [],
  damageCenters: [],
  trappedRounds: 0,
});
const banks = { FWD: makeBank(), AFT: makeBank() };
const target = {
  mesh: new THREE.Group(),
  velocity: new THREE.Vector3(),
  phase: "terminal",
  threatType: "P-500",
  rcs: 1,
};
const lid = new THREE.Group();
const origin = new THREE.Group();
origin.position.set(4, 2, 1);
const cell = {
  lid,
  origin,
  index: 3,
  bank: "FWD",
  phase: "opening",
  closeTo: "ready",
  phaseSince: 0,
  pending: { target, weapon: "SM-2MR" },
  loadout: "SM-2MR",
};
const config = {
  kind: "mk41",
  displayName: "MK 41",
  compatibleWeapons: ["SM-2MR"],
  columns: 4,
  sequenceInterval: 0.5,
  exhaustClearance: 0.5,
  isolationStartsAt: 0.7,
  maximumIsolationFraction: 0.5,
  loadingPermutation: 1,
  gridSize: 8,
};
cell.phase = "ready";
cell.pending = null;
const reserve = (overrides = {}) =>
  reserveLauncherResource({
    config,
    mk10Launchers: [],
    vlsCells: [cell],
    vlsBanks: banks,
    request: { target, weapon: "SM-2MR" },
    elapsed: 0,
    cycle: 0,
    health: () => 1,
    targetId: "test-target",
    cellDistance: (left, right) => Math.abs(left - right),
    log: () => {},
    ...overrides,
  });
const reservation = reserve();
assert(
  reservation.accepted &&
    reservation.cell === cell &&
    cell.pending?.target === target &&
    cell.phase === "opening",
  "Mk 41 reservation did not assign a physical cell",
);
cell.pending = null;
cell.phase = "ready";
const incompatible = reserve({
  request: { target, weapon: "RIM-67" },
});
assert(!incompatible.accepted && !cell.pending, "incompatible weapon was reserved");
cell.phase = "opening";
const separatedCell = { ...cell, index: 4, phase: "ready", pending: null };
const safetyBlocked = reserve({ vlsCells: [cell, separatedCell] });
assert(!safetyBlocked.accepted, "adjacent active Mk 41 cells bypassed deck safety");
const damageCells = Array.from({ length: 4 }, (_, index) => ({
  ...cell,
  lid: new THREE.Group(),
  origin: new THREE.Group(),
  index,
  phase: "ready",
  closeTo: "ready",
  pending: null,
}));
let removedRounds = 0;
const isolated = applyVlsDamageIsolation({
  config,
  cells: damageCells,
  banks,
  bank: "FWD",
  health: 0.4,
  elapsed: 0,
  desiredDisabled: () => 2,
  cellDistance: (left, right) => Math.abs(left - right),
  removeAmmo: () => removedRounds++,
  cancel: () => {},
  log: () => {},
});
assert(
  isolated === 2 &&
    removedRounds === 2 &&
    damageCells.filter((candidate) => candidate.phase === "disabled").length === 2 &&
    banks.FWD.trappedRounds === 2,
  "Mk 41 damage isolation did not disable and trap the selected cells",
);
resetVlsRuntime([cell], banks);
cell.phase = "opening";
cell.pending = { target, weapon: "SM-2MR" };
let launches = 0;
let returned = 0;
let cancelled = 0;
let direction = null;
const update = (elapsed, health = 1) =>
  updateVlsRuntime({
    config,
    cells: [cell],
    banks,
    elapsed,
    dt: 1,
    health: () => health,
    shipQuaternion: () => new THREE.Quaternion(),
    returnAmmo: () => returned++,
    cancel: () => cancelled++,
    launch: (_request, _label, _point, _origin, departure) => {
      launches++;
      direction = departure.clone();
      return { mesh: new THREE.Group() };
    },
    launchEffect: () => {},
    log: () => {},
  });

update(0);
assert(
  launches === 1 &&
    cell.phase === "launching" &&
    cell.closeTo === "spent" &&
    direction?.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9,
  "Mk 41 did not perform a physical vertical launch",
);
update(0.7);
update(1.7);
assert(
  cell.phase === "spent" && banks.FWD.launchHistory[0] === 4,
  "Mk 41 did not close to a spent cell",
);

resetVlsRuntime([cell], banks);
target.phase = "destroyed";
cell.pending = { target, weapon: "SM-2MR" };
cell.phase = "opening";
update(2);
assert(
  returned === 1 && cancelled === 1 && cell.closeTo === "ready",
  "Mk 41 target cancellation did not retain its round",
);

target.phase = "terminal";
resetVlsRuntime([cell], banks);
cell.pending = { target, weapon: "SM-2MR" };
cell.phase = "opening";
update(3, 0);
assert(
  cancelled === 2 &&
    banks.FWD.trappedRounds === 1 &&
    cell.closeTo === "disabled",
  "Mk 41 casualty did not trap and disable its round",
);

console.log(
  JSON.stringify(
    { launches, returned, cancelled, trapped: banks.FWD.trappedRounds },
    null,
    2,
  ),
);
