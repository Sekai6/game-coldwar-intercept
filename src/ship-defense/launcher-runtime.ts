import * as THREE from "three";
import type {
  Interceptor,
  LauncherRequest,
  Mk10LauncherState,
  VlsBankState,
  VlsCellState,
} from "../combat-types";
import type { LauncherConfig } from "../ship-types";

export function moveAngle(current: number, target: number, maxStep: number): number {
  let delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  if (delta > maxStep) delta = maxStep;
  if (delta < -maxStep) delta = -maxStep;
  return current + delta;
}

export function moveToward(current: number, target: number, maxStep: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

export function clampElevation(elevation: number): number {
  return Math.max(0, Math.min(Math.PI / 2, elevation));
}

export function setMk10Elevation(
  launcher: Mk10LauncherState,
  elevation: number,
): void {
  launcher.elevation = elevation;
  for (const arm of launcher.model.userData.arms as THREE.Group[]) {
    arm.rotation.z = elevation;
  }
}

type Mk10Config = Extract<LauncherConfig, { kind: "mk10" }>;

export type Mk10RuntimeDependencies = {
  config: Mk10Config;
  launchers: readonly Mk10LauncherState[];
  elapsed: number;
  dt: number;
  health: (launcher: Mk10LauncherState) => number;
  trackPosition: (request: LauncherRequest) => THREE.Vector3 | null;
  worldToLocal: (position: THREE.Vector3) => THREE.Vector3;
  returnAmmo: (request: LauncherRequest) => void;
  cancel: (request: LauncherRequest) => void;
  launch: (
    request: LauncherRequest,
    launcherLabel: string,
    launchPoint: string,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
  ) => Interceptor;
  log: (message: string) => void;
};

function angleDifference(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function abortMk10Task(
  launcher: Mk10LauncherState,
  request: LauncherRequest,
  deps: Mk10RuntimeDependencies,
  reason: string,
): void {
  deps.returnAmmo(request);
  deps.cancel(request);
  launcher.pending = null;
  launcher.reloadRail = -1;
  launcher.phase = "returning";
  launcher.phaseSince = deps.elapsed;
  deps.log(`${deps.config.displayName} ${launcher.name} ${reason} / AMMO RETURNED`);
}

export function updateMk10LauncherRuntime(deps: Mk10RuntimeDependencies): void {
  const tolerance = THREE.MathUtils.degToRad(2);
  for (const launcher of deps.launchers) {
    const health = deps.health(launcher);
    const azimuthRate =
      THREE.MathUtils.degToRad(deps.config.azimuthRateDeg) *
      (0.25 + 0.75 * health);
    const elevationRate =
      THREE.MathUtils.degToRad(deps.config.elevationRateDeg) *
      (0.25 + 0.75 * health);
    const request = launcher.pending;
    if (request && health <= 0.05) {
      abortMk10Task(launcher, request, deps, "CASUALTY / LAUNCH ABORT");
    }
    if (
      launcher.pending?.target.phase === "destroyed" &&
      launcher.phase === "slewing"
    ) {
      abortMk10Task(launcher, launcher.pending, deps, "TASK CANCEL / TARGET DESTROYED");
    }
    if (launcher.phase === "slewing" && launcher.pending) {
      const trackPosition = deps.trackPosition(launcher.pending);
      if (!trackPosition) {
        if (deps.elapsed - launcher.phaseSince > 4.5)
          abortMk10Task(launcher, launcher.pending, deps, "TASK CANCEL / TRACK LOST");
        continue;
      }
      const relative = deps.worldToLocal(trackPosition.clone()).sub(launcher.model.position);
      const desiredAzimuth = Math.atan2(-relative.z, relative.x);
      const desiredElevation = THREE.MathUtils.clamp(
        Math.atan2(relative.y, Math.hypot(relative.x, relative.z)),
        THREE.MathUtils.degToRad(5),
        THREE.MathUtils.degToRad(70),
      );
      launcher.azimuth = moveAngle(launcher.azimuth, desiredAzimuth, azimuthRate * deps.dt);
      setMk10Elevation(
        launcher,
        moveToward(launcher.elevation, desiredElevation, elevationRate * deps.dt),
      );
      launcher.model.rotation.y = launcher.azimuth;
      if (
        Math.abs(angleDifference(desiredAzimuth, launcher.azimuth)) < tolerance &&
        Math.abs(desiredElevation - launcher.elevation) < tolerance
      ) {
        const railIndex = launcher.railIndex;
        const round = launcher.rounds[railIndex];
        const origin = round.getWorldPosition(new THREE.Vector3());
        const quaternion = round.getWorldQuaternion(new THREE.Quaternion());
        const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
        launcher.reloadRail = railIndex;
        round.visible = false;
        deps.log(
          `${deps.config.displayName} ${launcher.name} ON BEARING / AZ ${Math.round(THREE.MathUtils.radToDeg(launcher.azimuth))} / EL ${Math.round(THREE.MathUtils.radToDeg(launcher.elevation))}`,
        );
        deps.launch(
          launcher.pending,
          `${deps.config.displayName} ${launcher.name}`,
          `RAIL ${railIndex + 1}`,
          origin,
          direction,
        );
        launcher.pending = null;
        launcher.phase = "firing";
        launcher.phaseSince = deps.elapsed;
      }
    } else if (launcher.phase === "firing" && deps.elapsed - launcher.phaseSince >= 0.38) {
      launcher.phase = "returning";
      launcher.phaseSince = deps.elapsed;
      deps.log(`${deps.config.displayName} ${launcher.name} RETURN TO LOAD`);
    } else if (launcher.phase === "returning") {
      launcher.azimuth = moveAngle(launcher.azimuth, launcher.stowAzimuth, azimuthRate * deps.dt);
      launcher.model.rotation.y = launcher.azimuth;
      setMk10Elevation(launcher, moveToward(launcher.elevation, 0, elevationRate * deps.dt));
      if (
        Math.abs(angleDifference(launcher.stowAzimuth, launcher.azimuth)) < tolerance &&
        launcher.elevation < tolerance
      ) {
        launcher.azimuth = launcher.stowAzimuth;
        launcher.model.rotation.y = launcher.stowAzimuth;
        setMk10Elevation(launcher, 0);
        launcher.phaseSince = deps.elapsed;
        if (launcher.reloadRail < 0) {
          launcher.phase = "ready";
          deps.log(`${deps.config.displayName} ${launcher.name} READY / TASK CANCELLED`);
          continue;
        }
        launcher.phase = "loading";
        const round = launcher.rounds[launcher.reloadRail];
        const home = round.userData.homePosition as THREE.Vector3;
        round.position.copy(home).add(new THREE.Vector3(-5.2, -0.12, 0));
        round.scale.copy(round.userData.homeScale as THREE.Vector3).multiplyScalar(0.72);
        round.visible = true;
        deps.log(`${deps.config.displayName} ${launcher.name} LOADING / RAIL ${launcher.reloadRail + 1}`);
      }
    } else if (launcher.phase === "loading") {
      if (health <= 0.05) continue;
      const round = launcher.rounds[launcher.reloadRail];
      const home = round.userData.homePosition as THREE.Vector3;
      const reloadTime = deps.config.reloadSeconds / (0.3 + 0.7 * health);
      const t = THREE.MathUtils.smoothstep((deps.elapsed - launcher.phaseSince) / reloadTime, 0, 1);
      round.position.lerpVectors(home.clone().add(new THREE.Vector3(-5.2, -0.12, 0)), home, t);
      round.scale.copy(round.userData.homeScale as THREE.Vector3).multiplyScalar(THREE.MathUtils.lerp(0.72, 1, t));
      if (t >= 1) {
        round.position.copy(home);
        round.scale.copy(round.userData.homeScale as THREE.Vector3);
        launcher.railIndex = (launcher.reloadRail + 1) % launcher.rounds.length;
        launcher.phase = "ready";
        launcher.phaseSince = deps.elapsed;
        deps.log(`${deps.config.displayName} ${launcher.name} READY / RAIL ${launcher.reloadRail + 1}`);
      }
    }
  }
}

export function resetMk10LauncherRuntime(launchers: readonly Mk10LauncherState[]): void {
  for (const launcher of launchers) {
    launcher.pending = null;
    launcher.phase = "ready";
    launcher.phaseSince = 0;
    launcher.azimuth = launcher.stowAzimuth;
    launcher.elevation = 0;
    launcher.railIndex = 0;
    launcher.reloadRail = 0;
    launcher.model.rotation.y = launcher.stowAzimuth;
    (launcher.model.userData.arms as THREE.Group[]).forEach((arm) => (arm.rotation.z = 0));
    launcher.rounds.forEach((round) => {
      round.visible = true;
      round.position.copy(round.userData.homePosition as THREE.Vector3);
      round.scale.copy(round.userData.homeScale as THREE.Vector3);
    });
  }
}

type Mk41Config = Extract<LauncherConfig, { kind: "mk41" }>;

export type LauncherReservationDependencies = {
  config: LauncherConfig;
  mk10Launchers: readonly Mk10LauncherState[];
  vlsCells: readonly VlsCellState[];
  vlsBanks: Record<"FWD" | "AFT", VlsBankState>;
  request: LauncherRequest;
  elapsed: number;
  cycle: number;
  health: (bank: "FWD" | "AFT") => number;
  targetId: string | number;
  cellDistance: (left: number, right: number) => number;
  log: (message: string) => void;
};

export type LauncherReservationResult = {
  accepted: boolean;
  cycle: number;
  launcher?: Mk10LauncherState;
  cell?: VlsCellState;
};

export function reserveLauncherResource(
  deps: LauncherReservationDependencies,
): LauncherReservationResult {
  const { config, request } = deps;
  if (!config.compatibleWeapons.includes(request.weapon)) {
    deps.log(`LAUNCH INHIBIT / ${request.weapon} NOT ${config.displayName} COMPATIBLE`);
    return { accepted: false, cycle: deps.cycle };
  }
  if (config.kind === "mk41") {
    const desiredBank: VlsCellState["bank"] = deps.cycle % 2 ? "AFT" : "FWD";
    const activeCells = deps.vlsCells.filter(
      (cell) => cell.phase === "opening" || cell.phase === "launching",
    );
    const eligible = (bank: VlsCellState["bank"]) =>
      deps.vlsCells
        .filter(
          (cell) =>
            cell.bank === bank &&
            cell.loadout === request.weapon &&
            cell.phase === "ready" &&
            deps.health(bank) > 0.05 &&
            activeCells
              .filter((active) => active.bank === bank)
              .every((active) => deps.cellDistance(active.index, cell.index) > 1) &&
            (deps.elapsed - deps.vlsBanks[bank].lastLaunchAt >= config.exhaustClearance ||
              deps.cellDistance(deps.vlsBanks[bank].lastCellIndex, cell.index) > 1),
        )
        .sort(
          (left, right) =>
            deps.cellDistance(right.index, deps.vlsBanks[bank].lastCellIndex) -
              deps.cellDistance(left.index, deps.vlsBanks[bank].lastCellIndex) ||
            left.index - right.index,
        );
    const cell =
      eligible(desiredBank)[0] ??
      eligible(desiredBank === "FWD" ? "AFT" : "FWD")[0];
    if (!cell) {
      const loadedReady = deps.vlsCells.some(
        (candidate) =>
          candidate.loadout === request.weapon && candidate.phase === "ready",
      );
      deps.log(
        loadedReady
          ? "LAUNCH INHIBIT / MK 41 DECK SAFETY SEPARATION"
          : `LAUNCH INHIBIT / MK 41 NO READY ${request.weapon} CELL`,
      );
      return { accepted: false, cycle: deps.cycle };
    }
    cell.pending = request;
    cell.closeTo = "ready";
    cell.phase = "opening";
    cell.phaseSince = deps.elapsed;
    deps.log(
      `MK 41 ${cell.bank} CELL ${String(cell.index + 1).padStart(2, "0")} / ${cell.loadout} TASK / TRACK ${deps.targetId} / HATCH OPENING`,
    );
    return { accepted: true, cycle: deps.cycle + 1, cell };
  }
  const available = deps.mk10Launchers.filter(
    (launcher) => launcher.phase === "ready" && deps.health(launcher.name === "AFT" ? "AFT" : "FWD") > 0.05,
  );
  const preferred = deps.cycle % Math.max(1, deps.mk10Launchers.length);
  const launcher = available.includes(deps.mk10Launchers[preferred])
    ? deps.mk10Launchers[preferred]
    : available[0];
  if (!launcher) {
    deps.log(`LAUNCH INHIBIT / ${config.displayName} UNAVAILABLE OR CYCLING`);
    return { accepted: false, cycle: deps.cycle };
  }
  launcher.pending = request;
  launcher.reloadRail = -1;
  launcher.phase = "slewing";
  launcher.phaseSince = deps.elapsed;
  deps.log(
    `${config.displayName} ${launcher.name} TASK / TRACK ${deps.targetId} / SLEWING / HEALTH ${Math.round(deps.health(launcher.name === "AFT" ? "AFT" : "FWD") * 100)}%`,
  );
  return {
    accepted: true,
    cycle: (deps.mk10Launchers.indexOf(launcher) + 1) % deps.mk10Launchers.length,
    launcher,
  };
}

export type VlsDamageDependencies = {
  config: Mk41Config;
  cells: readonly VlsCellState[];
  banks: Record<"FWD" | "AFT", VlsBankState>;
  bank: VlsCellState["bank"];
  health: number;
  elapsed: number;
  desiredDisabled: (cellCount: number, health: number, config: Mk41Config) => number;
  cellDistance: (left: number, right: number) => number;
  removeAmmo: (cell: VlsCellState) => void;
  cancel: (request: LauncherRequest) => void;
  log: (message: string) => void;
};

export function disableVlsCell(
  cell: VlsCellState,
  bank: VlsBankState,
  deps: Pick<VlsDamageDependencies, "elapsed" | "removeAmmo" | "cancel">,
): boolean {
  if (
    cell.phase === "disabled" ||
    cell.phase === "spent" ||
    cell.phase === "launching" ||
    (cell.phase === "closing" && cell.closeTo === "spent")
  )
    return false;
  const loaded = cell.loadout !== "OTHER";
  if (
    cell.phase === "ready" ||
    (cell.phase === "closing" && cell.closeTo === "ready")
  )
    deps.removeAmmo(cell);
  if (cell.pending) {
    deps.cancel(cell.pending);
    cell.pending = null;
  }
  if (loaded) bank.trappedRounds++;
  if (cell.phase === "opening" || cell.phase === "closing") {
    cell.closeTo = "disabled";
    cell.phase = "closing";
    cell.phaseSince = deps.elapsed;
  } else cell.phase = "disabled";
  return true;
}

export function applyVlsDamageIsolation(deps: VlsDamageDependencies): number {
  const cells = deps.cells.filter((cell) => cell.bank === deps.bank);
  const bank = deps.banks[deps.bank];
  const current = cells.filter(
    (cell) =>
      cell.phase === "disabled" ||
      (cell.phase === "closing" && cell.closeTo === "disabled"),
  ).length;
  const target = deps.desiredDisabled(cells.length, deps.health, deps.config);
  if (target <= current) return current;
  if (bank.damageCenters.length === 0 || deps.health > 0.05) {
    const candidates = cells.filter(
      (cell) => cell.phase !== "spent" && cell.phase !== "launching",
    );
    if (candidates.length)
      bank.damageCenters.push(
        candidates[
          (bank.damageCenters.length * 23 + (deps.bank === "FWD" ? 7 : 31)) %
            candidates.length
        ].index,
      );
  }
  let disabled = current;
  while (disabled < target) {
    const candidate = cells
      .filter(
        (cell) =>
          cell.phase !== "disabled" &&
          cell.phase !== "spent" &&
          cell.phase !== "launching" &&
          !(cell.phase === "closing" && cell.closeTo === "spent"),
      )
      .sort(
        (left, right) =>
          Math.min(
            ...bank.damageCenters.map((center) =>
              deps.cellDistance(left.index, center),
            ),
          ) -
            Math.min(
              ...bank.damageCenters.map((center) =>
                deps.cellDistance(right.index, center),
              ),
            ) ||
          left.index - right.index,
      )[0];
    if (!candidate || !disableVlsCell(candidate, bank, deps)) break;
    disabled++;
  }
  deps.log(
    `MK 41 ${deps.bank} DAMAGE ISOLATION / ${disabled} CELLS DISABLED / ${bank.trappedRounds} ROUNDS TRAPPED`,
  );
  return disabled;
}

export type VlsRuntimeSnapshot = {
  readyMr: number;
  readyEr: number;
  pendingMr: number;
  pendingEr: number;
  spent: number;
  disabledFwd: number;
  disabledAft: number;
  returning: number;
};

export type VlsRuntimeDependencies = {
  config: Mk41Config;
  cells: readonly VlsCellState[];
  banks: Record<"FWD" | "AFT", VlsBankState>;
  elapsed: number;
  dt: number;
  health: (bank: VlsCellState["bank"]) => number;
  shipQuaternion: () => THREE.Quaternion;
  returnAmmo: (request: LauncherRequest) => void;
  cancel: (request: LauncherRequest) => void;
  launch: (
    request: LauncherRequest,
    launcherLabel: string,
    launchPoint: string,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
  ) => Interceptor;
  launchEffect: (origin: THREE.Vector3, direction: THREE.Vector3) => void;
  log: (message: string) => void;
  report?: (snapshot: VlsRuntimeSnapshot) => void;
};

export function updateVlsRuntime(deps: VlsRuntimeDependencies): void {
  for (const cell of deps.cells) {
    const health = deps.health(cell.bank);
    const bank = deps.banks[cell.bank];
    const sequenceInterval = deps.config.sequenceInterval / (0.35 + 0.65 * health);
    if (cell.pending?.target.phase === "destroyed") {
      const request = cell.pending;
      deps.returnAmmo(request);
      deps.cancel(request);
      cell.pending = null;
      cell.closeTo = "ready";
      cell.phase = "closing";
      cell.phaseSince = deps.elapsed;
      deps.log(`MK 41 ${cell.bank} CELL ${cell.index + 1} TASK CANCEL / TARGET DESTROYED / ROUND RETAINED`);
    }
    if (cell.pending && health <= 0.05) {
      deps.cancel(cell.pending);
      cell.pending = null;
      cell.closeTo = "disabled";
      cell.phase = "closing";
      cell.phaseSince = deps.elapsed;
      if (cell.loadout !== "OTHER") bank.trappedRounds++;
      deps.log(`MK 41 ${cell.bank} CASUALTY / CELL ${cell.index + 1} ABORT / ROUND TRAPPED`);
    }
    if (cell.phase === "opening") {
      cell.lid.rotation.z = moveToward(cell.lid.rotation.z, Math.PI * 0.52, deps.dt * 4.8);
      if (
        cell.lid.rotation.z >= Math.PI * 0.5 &&
        cell.pending &&
        deps.elapsed - bank.lastLaunchAt >= sequenceInterval
      ) {
        const origin = cell.origin.getWorldPosition(new THREE.Vector3());
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(deps.shipQuaternion()).normalize();
        const gap = deps.elapsed - bank.lastLaunchAt;
        if (Number.isFinite(gap)) bank.minimumObservedGap = Math.min(bank.minimumObservedGap, gap);
        bank.lastLaunchAt = deps.elapsed;
        bank.lastCellIndex = cell.index;
        bank.launchHistory.push(cell.index + 1);
        const interceptor = deps.launch(
          cell.pending,
          `MK 41 ${cell.bank}`,
          `CELL ${String(cell.index + 1).padStart(2, "0")}`,
          origin,
          up,
        );
        interceptor.mesh.userData.vlsLaunch = true;
        interceptor.mesh.userData.verticalDirection = up.clone();
        deps.launchEffect(origin, up);
        cell.pending = null;
        cell.closeTo = "spent";
        cell.phase = "launching";
        cell.phaseSince = deps.elapsed;
        deps.log(`MK 41 ${cell.bank} CELL ${cell.index + 1} / ${cell.loadout} HOT LAUNCH / VERTICAL BOOST / SEQUENCE ${sequenceInterval.toFixed(2)}s`);
      }
    } else if (cell.phase === "launching" && deps.elapsed - cell.phaseSince > 0.6) {
      cell.phase = "closing";
      cell.phaseSince = deps.elapsed;
    } else if (cell.phase === "closing") {
      cell.lid.rotation.z = moveToward(cell.lid.rotation.z, 0, deps.dt * 3.6);
      if (cell.lid.rotation.z <= 0.01) {
        cell.lid.rotation.z = 0;
        cell.phase = cell.closeTo;
      }
    }
  }
  deps.report?.({
    readyMr: deps.cells.filter((cell) => cell.loadout === "SM-2MR" && cell.phase === "ready").length,
    readyEr: deps.cells.filter((cell) => cell.loadout === "SM-2ER" && cell.phase === "ready").length,
    pendingMr: deps.cells.filter((cell) => cell.loadout === "SM-2MR" && !!cell.pending).length,
    pendingEr: deps.cells.filter((cell) => cell.loadout === "SM-2ER" && !!cell.pending).length,
    spent: deps.cells.filter((cell) => cell.phase === "spent").length,
    disabledFwd: deps.cells.filter((cell) => cell.bank === "FWD" && cell.phase === "disabled").length,
    disabledAft: deps.cells.filter((cell) => cell.bank === "AFT" && cell.phase === "disabled").length,
    returning: deps.cells.filter((cell) => cell.phase === "closing" && cell.closeTo === "ready").length,
  });
}

export function resetVlsRuntime(
  cells: readonly VlsCellState[],
  banks: Record<"FWD" | "AFT", VlsBankState>,
): void {
  for (const name of ["FWD", "AFT"] as const) {
    banks[name].lastLaunchAt = -Infinity;
    banks[name].lastCellIndex = -1;
    banks[name].minimumObservedGap = Infinity;
    banks[name].launchHistory.length = 0;
    banks[name].damageCenters.length = 0;
    banks[name].trappedRounds = 0;
  }
  for (const cell of cells) {
    cell.pending = null;
    cell.phase = "ready";
    cell.closeTo = "ready";
    cell.phaseSince = 0;
    cell.lid.rotation.z = 0;
  }
}
