import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import "./style.css";
import { exportTacviewAcmi } from "./aar/acmi-exporter";
import { downloadTextFile } from "./aar/download";
import { CombatPicture, radarHorizonWorldUnits, type Track } from "./sim";
import {
  shipSurfaceHardpoints,
  type ModelWeaponHardpoint,
  type ShipClass,
  type ShipDefinition,
  type ShipManeuverMode,
  type SubsystemId,
} from "./ship-types";
import { createShipCatalog } from "./ship-catalog";
import {
  createFaceHealth,
  damageSensorFace,
  sensorFaceAspectHealth,
  worldBearingToLocal,
} from "./sensor-faces";
import {
  allocateVlsLoadout,
  desiredDisabledCells,
  vlsCellDistance as calculateVlsCellDistance,
  vlsLoadOrder,
} from "./vls";
import { WEAPON_PROFILES as weaponProfiles } from "./interceptor-data";
import { deterministicProbabilityRoll } from "./probability";
import {
  DEFAULT_THREAT_ID,
  getThreatDefinition,
  THREAT_DEFINITIONS,
  THREAT_PROFILES as incomingProfiles,
} from "./threats/catalog";
import {
  updateThreatParticleTrail,
  type ThreatParticleTrail,
} from "./visual/threat-particles";
import { createOceanSurface } from "./visual/ocean";
import { createHighQualityEnvironment } from "./visual/high-quality-environment";
import { createCinematicAtmospherePass } from "./visual/cinematic-atmosphere-pass";
import { AFTERNOON_SUN_ALTITUDE_DEG, AFTERNOON_SUN_DIRECTION } from "./visual/sunlight";
import { initializeWebGpuUltra, type WebGpuUltraResult, type WebGpuUltraStatus } from "./visual/webgpu-ultra";
import {
  ENEMY_PLATFORM_DEFINITIONS,
  getEnemyPlatformDefinition,
  type EnemyPlatformType,
} from "./platforms/catalog";
import {
  instantiateEnemyPlatform,
  disposeEnemyPlatform,
  platformDepartureSolution,
  releasePlatformHardpoint,
  reservationDirection,
  reservationOrigin,
  reservePlatformLaunches,
  updateEnemyPlatform,
} from "./platforms/runtime";
import type {
  EnemyPlatformInstance,
  PlatformLaunchReservation,
  PlatformWeaponSlot,
} from "./platforms/types";
import {
  createSurfaceStrikeMissile,
  updateSurfaceStrikeMissile,
  type SurfaceStrikeMissile,
} from "./surface-combat";
import {
  estimateSurfaceBattleDamage,
  planSurfaceSalvo,
} from "./surface-doctrine";
import {
  platformDefenseTargetId,
  pointDefenseCapability,
} from "./platforms/defense";
import { recordPlatformPointDefenseShot } from "./platforms/visual-defense";
import { AirCombatSystem } from "./air/runtime";
import {
  AIR_SCENARIO_PRESETS,
  airScenarioSpawns,
  type AirScenarioPresetId,
} from "./air/scenarios";
import {
  createAirScenarioContext,
  createShipTarget,
} from "./air/ship-bridge";
import {
  DEFAULT_SURFACE_CONFIG,
  initialSurfaceLoadout,
  initialSurfaceThreats,
} from "./scenarios/surface-scenarios";
import {
  adaptCombatTrack,
  adaptTargetableEntity,
  indexedDefenseTargetSource,
  mappedDefenseTargetSource,
  sourceSeed,
} from "./ship-defense/defense-targets";
import {
  moveAngle,
  moveToward,
  applyVlsDamageIsolation,
  reserveLauncherResource,
  resetMk10LauncherRuntime,
  resetVlsRuntime,
  setMk10Elevation,
  updateMk10LauncherRuntime,
  updateVlsRuntime,
} from "./ship-defense/launcher-runtime";
import {
  allocateIlluminators,
  authorizeLaunch,
  effectiveIlluminatorCount,
  planDefenseEngagement,
  resolveShot,
  threatScore,
} from "./ship-defense/engagement-runtime";
import { createCiwsTracer } from "./ship-defense/defense-visuals";
import type {
  EngagementRecord,
  EngagementSourceId,
} from "./defense/engagement.js";
import { DefenseTargetRegistry } from "./defense/target-source.js";
import type { CombatEntity, TargetableEntity } from "./combat-entity";
import type {
  AarCategory,
  AarEvent,
  AarSnapshot,
  BoosterDebris,
  ChaffCloud,
  DefenseTarget,
  EnemyType,
  EngagementDoctrine,
  Explosion,
  IlluminatorState,
  Interceptor,
  LauncherRequest,
  Missile,
  Mk10LauncherState,
  ShipDamageEffect,
  SrbocRound,
  VlsBankState,
  VlsCellState,
  VlsLaunchEffect,
  WeaponType,
} from "./combat-types";

type SubsystemState = {
  id: SubsystemId;
  label: string;
  health: number;
  position: THREE.Vector3;
};
const canvas = document.querySelector("#scene") as HTMLCanvasElement;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x06111b, 180, 900);
scene.background = new THREE.Color(0x06111b);
const camera = new THREE.PerspectiveCamera(
  48,
  innerWidth / innerHeight,
  0.1,
  2000,
);
camera.position.set(120, 95, 150);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const composer = new EffectComposer(renderer),
  renderPass = new RenderPass(scene, camera),
  ssaoPass = new SSAOPass(scene, camera, innerWidth, innerHeight),
  gtaoPass = new GTAOPass(scene, camera, innerWidth, innerHeight),
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.42,
    0.38,
    0.78,
  ),
  cinematicAtmospherePass = createCinematicAtmospherePass(),
  outputPass = new OutputPass();
ssaoPass.kernelRadius = 8;
ssaoPass.minDistance = 0.001;
ssaoPass.maxDistance = 0.09;
ssaoPass.enabled = innerWidth > 720;
gtaoPass.updateGtaoMaterial({ radius: 0.24, distanceExponent: 1.7, thickness: 1.35, distanceFallOff: 1 });
gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1.8, rings: 3, samples: 12 });
gtaoPass.enabled = false;
composer.setPixelRatio(Math.min(devicePixelRatio, 2));
composer.addPass(renderPass);
composer.addPass(ssaoPass);
composer.addPass(gtaoPass);
composer.addPass(bloomPass);
composer.addPass(cinematicAtmospherePass);
composer.addPass(outputPass);
canvas.dataset.renderPipeline = "webgl2-pbr-ssao-bloom-aces";
canvas.dataset.ssaoEnabled = String(ssaoPass.enabled);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const indirectEnvironmentScene = new THREE.Scene();
indirectEnvironmentScene.background = new THREE.Color(0x6e9fbd);
const indirectSea = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshBasicMaterial({ color: 0x082d3b, side: THREE.DoubleSide }),
);
indirectSea.rotation.x = -Math.PI / 2;
indirectEnvironmentScene.add(indirectSea);
const indirectSun = new THREE.Mesh(
  new THREE.SphereGeometry(8, 16, 8),
  new THREE.MeshBasicMaterial({ color: 0xffca86 }),
);
indirectSun.position.set(-45, 80, 32);
indirectEnvironmentScene.add(indirectSun);
const bouncedLightEnvironment = pmremGenerator.fromScene(indirectEnvironmentScene, 0.18).texture;
indirectSea.geometry.dispose(); (indirectSea.material as THREE.Material).dispose();
indirectSun.geometry.dispose(); (indirectSun.material as THREE.Material).dispose();
pmremGenerator.dispose();
const ambientSky = new THREE.HemisphereLight(0x9cc7dd, 0x10212b, 1.55);
scene.add(ambientSky);
const sun = new THREE.DirectionalLight(0xffe3ad, 2.5);
sun.position.copy(AFTERNOON_SUN_DIRECTION).multiplyScalar(360);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -250;
sun.shadow.camera.right = 250;
sun.shadow.camera.top = 250;
sun.shadow.camera.bottom = -250;
sun.shadow.bias = -0.00018;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 3;
scene.add(sun);
const atmosphericFill = new THREE.DirectionalLight(0x83b8dc, 0);
atmosphericFill.position.set(140, 180, -180);
scene.add(atmosphericFill);
const ocean = createOceanSurface();
scene.add(ocean.object);
const highQualityEnvironment = createHighQualityEnvironment();
scene.add(highQualityEnvironment.object);
let highQualityEnvironmentEnabled = false;
let webGpuUltraStatus: WebGpuUltraStatus = "idle";
let webGpuUltraResult: WebGpuUltraResult | null = null;
let webGpuUltraInitialization: Promise<void> | null = null;
const airCombat = new AirCombatSystem(scene);
let airShipHits = 0,
  airShipDamage = 0;
canvas.dataset.oceanBackend = ocean.backend;
function updateMaterialDiagnostics() {
  let mappedMaterials = 0;
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    mappedMaterials += materials.filter(
      (material) =>
        material instanceof THREE.MeshStandardMaterial &&
        material.roughnessMap &&
        material.normalMap,
    ).length;
  });
  canvas.dataset.pbrMappedMaterials = String(mappedMaterials);
  canvas.dataset.hullStations = String(defender.userData.hullStations ?? 0);
  canvas.dataset.hullSectionPoints = String(
    defender.userData.hullSectionPoints ?? 0,
  );
  canvas.dataset.hullLength = Number(defender.userData.hullLength ?? 0).toFixed(
    2,
  );
  canvas.dataset.hullBeam = Number(defender.userData.hullBeam ?? 0).toFixed(2);
  canvas.dataset.hullLengthBeamRatio = Number(
    defender.userData.hullLengthBeamRatio ?? 0,
  ).toFixed(2);
}
const grid = new THREE.GridHelper(1200, 48, 0x1d6570, 0x123f4b);
grid.position.y = 0.15;
(grid.material as THREE.Material).opacity = 0.25;
(grid.material as THREE.Material).transparent = true;
scene.add(grid);
const {
  ships: SHIP_CATALOG,
  byId: SHIP_DEFINITIONS,
  defaultShip,
} = createShipCatalog();
let activeShip = defaultShip,
  defender = activeShip.build();
if (activeShip.fixedSensorFaces)
  defender.userData.fixedSensorFaceHealth = createFaceHealth(
    activeShip.fixedSensorFaces,
  );
defender.position.copy(DEFAULT_SURFACE_CONFIG.defenderPosition);
defender.traverse((o) => {
  if (o instanceof THREE.Mesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});
scene.add(defender);
function makeMk10State(
  name: "AFT" | "FORWARD",
  model: THREE.Group,
  stowAzimuth: number,
): Mk10LauncherState {
  const rounds = (model.userData.arms as THREE.Group[]).map(
    (arm) => arm.getObjectByName("readyRound") as THREE.Group,
  );
  rounds.forEach((round) => {
    round.userData.homePosition = round.position.clone();
    round.userData.homeScale = round.scale.clone();
  });
  return {
    name,
    model,
    stowAzimuth,
    phase: "ready",
    phaseSince: 0,
    pending: null,
    azimuth: stowAzimuth,
    elevation: 0,
    railIndex: 0,
    reloadRail: 0,
    rounds,
  };
}
let mk10Launchers: Mk10LauncherState[] = [
    makeMk10State("AFT", defender.userData.launcher, Math.PI),
    makeMk10State("FORWARD", defender.userData.forwardLauncher, Math.PI),
  ],
  vlsCells: VlsCellState[] = [];
const vlsBanks: Record<"FWD" | "AFT", VlsBankState> = {
  FWD: {
    lastLaunchAt: -Infinity,
    lastCellIndex: -1,
    minimumObservedGap: Infinity,
    launchHistory: [],
    damageCenters: [],
    trappedRounds: 0,
  },
  AFT: {
    lastLaunchAt: -Infinity,
    lastCellIndex: -1,
    minimumObservedGap: Infinity,
    launchHistory: [],
    damageCenters: [],
    trappedRounds: 0,
  },
};
const subsystemList: SubsystemState[] = [
  {
    id: "primaryRadar",
    label: activeShip.subsystemLabels.primaryRadar,
    health: 100,
    position: activeShip.subsystemPositions.primaryRadar.clone(),
  },
  {
    id: "secondaryRadar",
    label: activeShip.subsystemLabels.secondaryRadar,
    health: 100,
    position: activeShip.subsystemPositions.secondaryRadar.clone(),
  },
  {
    id: "fireControl",
    label: activeShip.subsystemLabels.fireControl,
    health: 100,
    position: activeShip.subsystemPositions.fireControl.clone(),
  },
  {
    id: "aftLauncher",
    label: activeShip.subsystemLabels.aftLauncher,
    health: 100,
    position: activeShip.subsystemPositions.aftLauncher.clone(),
  },
  {
    id: "forwardLauncher",
    label: activeShip.subsystemLabels.forwardLauncher,
    health: 100,
    position: activeShip.subsystemPositions.forwardLauncher.clone(),
  },
  {
    id: "ciws",
    label: activeShip.subsystemLabels.ciws,
    health: 100,
    position: activeShip.subsystemPositions.ciws.clone(),
  },
  {
    id: "ecm",
    label: activeShip.subsystemLabels.ecm,
    health: 100,
    position: activeShip.subsystemPositions.ecm.clone(),
  },
  {
    id: "srboc",
    label: activeShip.subsystemLabels.srboc,
    health: 100,
    position: activeShip.subsystemPositions.srboc.clone(),
  },
  {
    id: "propulsion",
    label: activeShip.subsystemLabels.propulsion,
    health: 100,
    position: activeShip.subsystemPositions.propulsion.clone(),
  },
];
const subsystems = Object.fromEntries(
  subsystemList.map((system) => [system.id, system]),
) as Record<SubsystemId, SubsystemState>;
function subsystemHealth(id: SubsystemId) {
  return subsystems[id].health / 100;
}
function fixedSensorFaceHealth() {
  return defender.userData.fixedSensorFaceHealth as number[] | undefined;
}
function fixedSensorAspectHealth(worldBearing: number) {
  const config = activeShip.fixedSensorFaces,
    health = fixedSensorFaceHealth();
  if (!config || !health) return 1;
  return sensorFaceAspectHealth(
    config,
    health,
    worldBearingToLocal(
      worldBearing,
      defender.getWorldQuaternion(new THREE.Quaternion()),
    ),
  );
}
function damageFixedSensorFace(localBearing: number, amount: number) {
  const config = activeShip.fixedSensorFaces,
    health = fixedSensorFaceHealth();
  if (!config || !health) return -1;
  const result = damageSensorFace(config, health, localBearing, amount);
  log(
    `${config.sensorName} ${result.label} FACE DAMAGE / ${Math.round(result.before * 100)} -> ${Math.round(result.after * 100)}`,
  );
  return result.index;
}
const wake = new THREE.Group(),
  wakeLineMat = new THREE.LineBasicMaterial({
    color: 0xc5eff0,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
for (const side of [-1, 1])
  for (const offset of [0, 1.2]) {
    const points = [
      new THREE.Vector3(0, 0, side * (2.8 + offset * 0.25)),
      new THREE.Vector3(-14, 0, side * (4.4 + offset)),
      new THREE.Vector3(-34, 0, side * (8 + offset * 1.6)),
      new THREE.Vector3(-58, 0, side * (14 + offset * 2)),
    ];
    wake.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        wakeLineMat,
      ),
    );
  }
wake.position.set(-28, 0.22, 40);
scene.add(wake);
const missiles: Missile[] = [];
let enemyPlatform: EnemyPlatformInstance | null = null;
type PlatformFirePlan = {
  platform: EnemyPlatformInstance;
  threat: EnemyType;
  authorizedWeapons: number;
  committedWeapons: number;
  requestedInterval: number;
  wave: number;
  assessmentReadyAt: number;
  assessmentPending: boolean;
  lastAssessment: {
    resolvedWeapons: number;
    actualHits: number;
    assessedHitCredit: number;
    observationTrackQuality: number;
    hitCreditFactor: number;
  } | null;
  completed: boolean;
  reinforcements: { availableAt: number; count: number }[];
};
let platformFirePlan: PlatformFirePlan | null = null;
const surfaceStrikeMissiles: SurfaceStrikeMissile[] = [];
let initialLoadout = initialSurfaceLoadout(activeShip);
const surfaceLaunchQueue: {
  hardpoint: ModelWeaponHardpoint;
  launchAt: number;
  commandPoint: THREE.Vector3;
  commandVelocity: THREE.Vector3;
  routeOffset: THREE.Vector3;
  plannedArrivalAt: number;
}[] = [];
let surfaceHardpointState = new Map<string, "ready" | "reserved" | "fired">(),
  surfaceStrikeAmmo = initialLoadout.surfaceStrike,
  nextSurfaceLaunch = 0,
  nextSurfaceDecision = 0,
  autoSurfaceStrike = true,
  opforRadarEnabled = true,
  surfaceHits = 0,
  surfaceHardKills = 0,
  surfaceSoftKills = 0,
  surfacePointDefenseKills = 0,
  surfaceMisses = 0,
  surfaceProgressiveDamage = 0,
  nextSurfaceAssessment = 0,
  surfaceStrikeWave = 0,
  surfaceRequiredHits = 0,
  surfacePlanningLeakProbability = 0,
  surfaceTrackId = 0,
  surfaceTrackHorizonLimited: boolean | null = null,
  surfaceTrackStableTime = 0,
  surfaceEsmNextScan = 0,
  surfaceEsmCue = {
    id: -1,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    quality: 0,
    uncertainty: Infinity,
    age: Infinity,
    valid: false,
    horizonLimited: true,
  },
  surfaceFireControlReadyAt = Infinity,
  surfaceFireControlReadyLogged = false;
const interceptors: Interceptor[] = [];
const airDefenseTargets = new Map<string, DefenseTarget>();
const airDefenseHardKills = new Set<string>();
const engagements = new Map<EngagementSourceId, EngagementRecord>();
const defenseTargets = new DefenseTargetRegistry<DefenseTarget>();
defenseTargets.register(
  indexedDefenseTargetSource(
    "surface-threats",
    missiles,
    (target) =>
      elapsed >= target.launchAt &&
      target.phase !== "destroyed" &&
      (!target.platformLaunch || target.platformLaunch.released),
  ),
);
defenseTargets.register(
  mappedDefenseTargetSource(
    "air-combat",
    airDefenseTargets,
    (target) => target.phase !== "destroyed",
  ),
);

function defenseTargetForSource(sourceId: number | string) {
  return defenseTargets.get(sourceId);
}

function defenseSourceForTarget(target: DefenseTarget) {
  const sourceId = defenseTargets.idFor(target);
  if (sourceId === undefined) throw new Error("Unregistered defense target");
  return sourceId;
}

function defenseSourceSeed(sourceId: number | string) {
  return sourceSeed(sourceId);
}

function allDefenseTargets() {
  return defenseTargets.values();
}

function synchronizeAirDefenseTargets() {
  const activeIds = new Set<string>();
  const defenderEntity = airScenarioContext().blueShip;
  for (const contact of airCombat.shipDefenseContacts(defenderEntity)) {
    activeIds.add(contact.entity.id);
    let target = airDefenseTargets.get(contact.entity.id);
    if (!target) {
      const selection = new THREE.Mesh(
        new THREE.RingGeometry(2.4, 3, 24),
        new THREE.MeshBasicMaterial({
          color: 0xff7f63,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      selection.rotation.x = -Math.PI / 2;
      selection.visible = false;
      contact.model.add(selection);
      contact.model.userData.selection = selection;
      target = adaptTargetableEntity(contact.entity, contact.model, {
        phase: "inbound",
        threatType: contact.template,
        displayName: contact.name,
      });
      airDefenseTargets.set(contact.entity.id, target);
      log(
        `AIR THREAT REGISTERED / ${contact.name} / ${contact.entity.kind.toUpperCase()} / SHIP COMBAT SYSTEM INTAKE`,
      );
    }
    target.phase = contact.phase;
  }
  for (const [id, target] of airDefenseTargets) {
    if (activeIds.has(id) || target.phase === "destroyed") continue;
    target.phase = "destroyed";
    if (target.entity?.kind === "missile") target.mesh.visible = false;
  }
}

function resolveAirDefenseHit(target: DefenseTarget, damage: number) {
  if (!target.entity) return true;
  target.entity.applyDamage(damage, target.mesh.position.clone());
  if (!target.entity.alive) airDefenseHardKills.add(target.entity.id);
  return !target.entity.alive;
}
const illuminators: IlluminatorState[] = [
  { id: 1, azimuth: 0, target: null, lastTargetId: 0 },
  { id: 2, azimuth: 0, target: null, lastTargetId: 0 },
  { id: 3, azimuth: Math.PI, target: null, lastTargetId: 0 },
  { id: 4, azimuth: Math.PI, target: null, lastTargetId: 0 },
];
const combatPicture = new CombatPicture();
const surfacePicture = new CombatPicture();
function resetSurfaceStrikeLoadout() {
  surfaceHardpointState = new Map(
    shipSurfaceHardpoints(defender).map((hardpoint) => {
      if (hardpoint.cover) hardpoint.cover.visible = true;
      return [hardpoint.id, "ready" as const];
    }),
  );
  surfaceStrikeAmmo = Math.min(
    activeShip.surfaceStrike?.magazine ?? 0,
    surfaceHardpointState.size,
  );
  nextSurfaceLaunch = 0;
  nextSurfaceDecision = 0;
  surfaceTrackId = 0;
  surfaceTrackHorizonLimited = null;
  surfaceTrackStableTime = 0;
  surfaceEsmNextScan = 0;
  surfaceEsmCue.valid = false;
  surfaceEsmCue.age = Infinity;
  surfaceFireControlReadyAt = Infinity;
  surfaceFireControlReadyLogged = false;
  nextSurfaceAssessment = 0;
  surfaceStrikeWave = 0;
  surfaceRequiredHits = 0;
  surfacePlanningLeakProbability = 0;
}
resetSurfaceStrikeLoadout();
const radarCanvas = document.querySelector("#radar") as HTMLCanvasElement;
const radarCtx = radarCanvas?.getContext("2d");
let launcherCycle = 0;
const lastTrackClasses = new Map<number, string>(),
  lastAltitudeState = new Map<number, boolean>();
const explosions: Explosion[] = [];
const explodedTargets = new Set<DefenseTarget>();
const shipDamageEffects: ShipDamageEffect[] = [];
const boosterDebris: BoosterDebris[] = [];
const chaffClouds: ChaffCloud[] = [];
const srbocRoundsInFlight: SrbocRound[] = [];
const vlsLaunchEffects: VlsLaunchEffect[] = [];
let chaffSerial = 0;
const WORLD_UNITS_PER_KM = 10,
  RADAR_PIXELS_PER_WORLD_UNIT = 0.14;
function defensiveShotRequirement(missile: DefenseTarget, _quality: number) {
  const targetId = defenseSourceForTarget(missile);
  if (missile.entity?.kind === "aircraft") {
    const state = engagements.get(targetId);
    if (!state) return 1;
    if (state.pending > 0 || elapsed - state.lastResolution < 1.5) return 0;
    return state.shots < 2 ? 1 : 0;
  }
  const state = engagements.get(targetId);
  if (!state) return doctrine === "SINGLE" ? 1 : 2;
  if (doctrine === "SSLS") {
    if (state.shots < 2) return 2;
    if (state.pending > 0) return state.pending;
    if (elapsed - state.lastResolution < 1.2 || state.shots >= 4) return 0;
    return 1;
  }
  if (
    doctrine === "SINGLE" &&
    state.pending === 0 &&
    elapsed - state.lastResolution < 0.65
  )
    return 0;
  return doctrine === "SINGLE" ? 1 : 2;
}
function settleEngagement(
  interceptor: Interceptor,
  result: "hit" | "miss" | "cancel",
) {
  if (interceptor.mesh.userData.engagementSettled) return;
  interceptor.mesh.userData.engagementSettled = true;
  const state = resolveShot(
    engagements,
    defenseSourceForTarget(interceptor.target),
    result,
    elapsed,
  );
  if (!state) return;
  if (
    doctrine === "SSLS" &&
    result === "miss" &&
    state.shots >= 2 &&
    state.pending === 0 &&
    interceptor.target.phase !== "destroyed"
  )
    log(
      `DOCTRINE LOOK / TARGET ${defenseSourceForTarget(interceptor.target)} / ${state.misses} MISS`,
    );
}
function missileThreatScore(missile: DefenseTarget, track: Track) {
  const observation = adaptCombatTrack(track, missile);
  return threatScore(
    observation,
    missile.phase,
    observation.kind,
    defender.position,
    incomingProfiles[missile.threatType].threatPriority,
  );
}
function addMissile(
  pos: THREE.Vector3,
  threatType: EnemyType = DEFAULT_THREAT_ID,
  launchAt = 0,
  platformReservation?: PlatformLaunchReservation,
) {
  const profile = incomingProfiles[threatType],
    ordinal = missiles.length,
    aimOffset = new THREE.Vector3(
      Math.sin((ordinal + 1) * 2.399) * 2.8,
      0,
      Math.cos((ordinal + 1) * 1.73) * 1.2,
    ),
    g = getThreatDefinition(threatType).createModel();
  const attackModes = profile.terminalAttackModes;
  g.userData.terminalAttackMode = attackModes
    ? attackModes[ordinal % attackModes.length]
    : "standard";
  g.position.copy(pos);
  g.scale.setScalar(profile.modelScale);
  g.visible = launchAt <= 0;
  const selection = new THREE.Mesh(
    new THREE.TorusGeometry(profile.selectionRadius, 0.12, 8, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffd45a,
      transparent: true,
      opacity: 0.9,
    }),
  );
  selection.rotation.x = Math.PI / 2;
  selection.visible = false;
  g.add(selection);
  g.userData.selection = selection;
  const history = [pos.clone()],
    path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(history),
      new THREE.LineBasicMaterial({
        color: profile.pathColor,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
      }),
    ),
    seekerLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([pos, pos]),
      new THREE.LineBasicMaterial({
        color: 0xff6a55,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
      }),
    );
  path.visible = g.visible;
  seekerLine.visible = false;
  g.userData.seekerLine = seekerLine;
  scene.add(g, path, seekerLine);
  const initialDirection = platformReservation
    ? reservationDirection(platformReservation)
    : defender.position.clone().sub(pos).setY(0).normalize();
  missiles.push({
    mesh: g,
    velocity: initialDirection.multiplyScalar(
      platformReservation?.weaponSlot.exitSpeed ?? profile.cruiseSpeed,
    ),
    phase: platformReservation ? "boost" : "inbound",
    age: 0,
    history,
    path,
    threatType,
    speedFactor: profile.cruiseSpeed,
    rcs: profile.radarCrossSection,
    launchAt,
    aimOffset,
    bank: 0,
    platformLaunch: platformReservation
      ? {
          reservation: platformReservation,
          released: false,
          releasedAt: null,
          takeoverLogged: false,
          commandPoint: platformReservation.platform.targetTrack.valid
            ? platformReservation.platform.targetTrack.position.clone()
            : defender.position.clone(),
          commandVelocity: platformReservation.platform.targetTrack.valid
            ? platformReservation.platform.targetTrack.velocity.clone()
            : new THREE.Vector3(),
          nextDatalink: launchAt,
          datalinkValid: platformReservation.platform.targetTrack.valid,
          lastDatalinkQuality: -1,
          terminalSeekerAcquired: false,
          plannedArrivalAt: null,
        }
      : undefined,
  });
}
function platformFirePlanWeapons(plan: PlatformFirePlan) {
  return missiles.filter(
    (missile) =>
      missile.platformLaunch?.reservation.platform === plan.platform &&
      missile.platformLaunch.reservation.firePlanWave !== undefined,
  );
}

function assessPlatformFirePlan(plan: PlatformFirePlan) {
  const doctrine = plan.platform.definition.weaponSlots.find((slot) =>
      slot.compatibleThreats.includes(plan.threat),
    )?.salvoDoctrine,
    weapons = platformFirePlanWeapons(plan),
    resolvedWeapons = weapons.filter(
      (missile) =>
        missile.platformLaunch?.released && missile.phase === "destroyed",
    ).length,
    actualHits = weapons.filter(
      (missile) => missile.mesh.userData.platformImpact === true,
    ).length,
    track = plan.platform.targetTrack,
    observationTrackQuality = track.valid
      ? track.source === "radar"
        ? track.quality
        : track.quality * 0.35
      : 0,
    hitCreditFactor = THREE.MathUtils.clamp(
      (doctrine?.hitReportReliability ?? 0.5) *
        THREE.MathUtils.lerp(0.55, 1, observationTrackQuality),
      0.15,
      0.98,
    );
  return {
    resolvedWeapons,
    actualHits,
    assessedHitCredit: actualHits * hitCreditFactor,
    observationTrackQuality,
    hitCreditFactor,
  };
}

function platformTargetingSolution(
  platform: EnemyPlatformInstance,
  slot: PlatformWeaponSlot,
) {
  const track = platform.targetTrack,
    passive = slot.passiveTargeting,
    passiveQualified =
      track.valid &&
      track.source === "esm" &&
      !!passive &&
      track.quality >= passive.minimumTrackQuality &&
      track.uncertainty <= passive.maximumUncertainty;
  return {
    qualified:
      track.valid &&
      (passiveQualified ||
        (track.source === "radar" &&
          track.quality >= slot.minimumTrackQuality)),
    passive: passiveQualified,
    minimumTrackQuality: passiveQualified
      ? passive!.minimumTrackQuality
      : slot.minimumTrackQuality,
    requiredAge: passiveQualified
      ? passive!.minimumTrackAge + passive!.fireControlDelay
      : slot.minimumTrackAge + slot.fireControlDelay,
  };
}

function commitPlatformFirePlanWave(
  plan: PlatformFirePlan,
  allowUnresolvedFireControl = false,
) {
  const slot = plan.platform.definition.weaponSlots.find((candidate) =>
      candidate.compatibleThreats.includes(plan.threat),
    ),
    doctrine = slot?.salvoDoctrine;
  if (!slot || !doctrine || plan.platform.destroyed || hullIntegrity <= 0)
    return false;
  const remainingAuthorization = Math.max(
    0,
    plan.authorizedWeapons - plan.committedWeapons,
  );
  if (remainingAuthorization <= 0) {
    plan.completed = plan.reinforcements.length === 0;
    return false;
  }
  const trackAge = plan.platform.weaponTrackAge.get(slot.id) ?? 0,
    targeting = platformTargetingSolution(plan.platform, slot),
    fireControlReady = targeting.qualified && trackAge >= targeting.requiredAge;
  if (!allowUnresolvedFireControl && !fireControlReady) return false;
  const plannedWeapons = platformFirePlanWeapons(plan),
    assessment = plan.lastAssessment ?? assessPlatformFirePlan(plan),
    inFlight = plannedWeapons.filter(
      (missile) => missile.phase !== "destroyed",
    ).length,
    readyHardpoints = plan.platform.slots.weaponHardpoints.filter(
      (hardpoint) =>
        hardpoint.slotId === slot.id &&
        plan.platform.hardpointState.get(hardpoint.id) === "ready",
    ).length,
    salvo = planSurfaceSalvo({
      availableWeapons: remainingAuthorization,
      availableHardpoints: readyHardpoints,
      weaponsInFlight: inFlight,
      maximumWeaponsInFlight: doctrine.maximumWeaponsInFlight,
      maximumSalvoSize: doctrine.maximumSalvoSize,
      minimumSalvoSize: doctrine.minimumSalvoSize,
      expectedLeakProbability: doctrine.expectedLeakProbability,
      targetHullEstimate: doctrine.targetHullEstimate,
      weaponDamage: getThreatDefinition(plan.threat).profile.damage,
      assessedHits: assessment.assessedHitCredit,
      resolvedWeapons: assessment.resolvedWeapons,
      trackQuality: assessment.observationTrackQuality,
    });
  if (salvo.count <= 0) {
    plan.completed = true;
    log(
      `${plan.platform.definition.name} BDA / FIRE PLAN COMPLETE / HIT CREDIT ${assessment.assessedHitCredit.toFixed(2)} / ${assessment.resolvedWeapons} WEAPONS RESOLVED / TQ ${Math.round(assessment.observationTrackQuality * 100)}% / ${plan.authorizedWeapons - plan.committedWeapons} WEAPONS UNCOMMITTED`,
    );
    return false;
  }
  const wave = plan.wave + 1,
    reservations = reservePlatformLaunches(
      plan.platform,
      plan.threat,
      salvo.count,
      elapsed,
      plan.requestedInterval,
    );
  for (const [ordinal, reservation] of reservations.entries()) {
    reservation.firePlanWave = wave;
    reservation.firePlanOrdinal = ordinal;
    addMissile(
      reservationOrigin(reservation),
      plan.threat,
      reservation.launchAt,
      reservation,
    );
  }
  plan.wave = wave;
  plan.committedWeapons += reservations.length;
  plan.assessmentPending = false;
  plan.lastAssessment = null;
  plan.completed = reservations.length === 0;
  log(
    `${plan.platform.definition.name} SURFACE OODA / WAVE ${wave} / ${reservations.length} x ${plan.threat} / ${salvo.requiredHits} HITS REQUIRED / PLEAK ${Math.round(salvo.planningLeakProbability * 100)}% / AUTH ${plan.committedWeapons}/${plan.authorizedWeapons}`,
  );
  return reservations.length > 0;
}

function updatePlatformFirePlan() {
  const plan = platformFirePlan;
  if (!plan || plan.platform.destroyed || hullIntegrity <= 0) return;
  for (let index = plan.reinforcements.length - 1; index >= 0; index--) {
    const reinforcement = plan.reinforcements[index];
    if (elapsed < reinforcement.availableAt) continue;
    plan.reinforcements.splice(index, 1);
    plan.authorizedWeapons = Math.min(
      plan.platform.slots.weaponHardpoints.length,
      plan.authorizedWeapons + reinforcement.count,
    );
    plan.completed = false;
    log(
      `${plan.platform.definition.name} FIRE PLAN / ${reinforcement.count} ADDITIONAL WEAPONS AUTHORIZED / TOTAL ${plan.authorizedWeapons}`,
    );
  }
  const currentWave = platformFirePlanWeapons(plan).filter(
    (missile) => missile.platformLaunch?.reservation.firePlanWave === plan.wave,
  );
  if (currentWave.some((missile) => missile.phase !== "destroyed")) return;
  const slot = plan.platform.definition.weaponSlots.find((candidate) =>
      candidate.compatibleThreats.includes(plan.threat),
    ),
    doctrine = slot?.salvoDoctrine;
  if (!doctrine || plan.completed) return;
  if (!plan.assessmentPending) {
    plan.assessmentPending = true;
    plan.assessmentReadyAt = elapsed + doctrine.assessmentDelay;
    log(
      `${plan.platform.definition.name} DOCTRINE LOOK / WAVE ${plan.wave} / BDA ${doctrine.assessmentDelay.toFixed(1)}s`,
    );
    return;
  }
  if (elapsed >= plan.assessmentReadyAt) {
    if (!plan.lastAssessment) {
      plan.lastAssessment = assessPlatformFirePlan(plan);
      log(
        `${plan.platform.definition.name} BDA REPORT / HIT CREDIT ${plan.lastAssessment.assessedHitCredit.toFixed(2)} / ${plan.lastAssessment.resolvedWeapons} WEAPONS RESOLVED / TQ ${Math.round(plan.lastAssessment.observationTrackQuality * 100)}%`,
      );
    }
    commitPlatformFirePlanWave(plan);
  }
}

function launchInterceptor(
  target: DefenseTarget,
  weapon: WeaponType,
  launcherLabel: string,
  launchPoint: string,
  origin: THREE.Vector3,
  railDirection: THREE.Vector3,
) {
  const g = new THREE.Group(),
    visual = new THREE.Group(),
    er = weapon === "SM-2ER",
    sm2 = weapon === "SM-2MR" || er,
    missileMat = new THREE.MeshStandardMaterial({
      color: sm2 ? 0xf0eee4 : 0xd9d7c7,
      metalness: 0.7,
      roughness: 0.3,
    });
  g.add(visual);
  visual.rotation.x = Math.PI / 2;
  visual.scale.setScalar(0.58);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      sm2 ? 0.42 : 0.55,
      sm2 ? 0.48 : 0.62,
      sm2 ? 5.6 : 6.4,
      12,
    ),
    missileMat,
  );
  body.rotation.x = Math.PI / 2;
  visual.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(sm2 ? 0.42 : 0.55, sm2 ? 1.7 : 2.1, 12),
    missileMat,
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -(sm2 ? 3.65 : 4.25);
  visual.add(nose);
  const booster = new THREE.Group(),
    boosterBody = new THREE.Mesh(
      new THREE.CylinderGeometry(
        sm2 ? 0.48 : 0.62,
        sm2 ? 0.55 : 0.7,
        sm2 ? 2.2 : 2.8,
        12,
      ),
      new THREE.MeshStandardMaterial({
        color: 0xb9bcb4,
        metalness: 0.55,
        roughness: 0.42,
      }),
    );
  boosterBody.rotation.x = Math.PI / 2;
  boosterBody.position.z = sm2 ? 3.7 : 4.5;
  booster.add(boosterBody);
  for (const side of [-1, 1])
    for (const axis of ["x", "y"] as const) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(
          axis === "x" ? 1.8 : 0.12,
          axis === "y" ? 1.8 : 0.12,
          1.25,
        ),
        missileMat,
      );
      fin.position[axis] = side * (sm2 ? 0.82 : 1.05);
      fin.position.z = sm2 ? 4.1 : 4.9;
      booster.add(fin);
    }
  g.add(booster);
  g.userData.booster = booster;
  const flame = new THREE.PointLight(sm2 ? 0x8fdfff : 0x6cdcff, 7, 28);
  flame.position.z = sm2 ? 5.1 : 6;
  g.add(flame);
  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 4),
      new THREE.Vector3(0, 0, 16),
    ]),
    new THREE.LineBasicMaterial({
      color: 0x8fe9ff,
      transparent: true,
      opacity: 0.8,
    }),
  );
  g.add(trail);
  const seeker = new THREE.Mesh(
    new THREE.ConeGeometry(sm2 ? 5 : 7, sm2 ? 22 : 30, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x65e4ff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  seeker.rotation.x = -Math.PI / 2;
  seeker.position.z = -15;
  seeker.visible = false;
  g.add(seeker);
  g.userData.seeker = seeker;
  visual.add(booster, flame, trail, seeker);
  if (er) {
    visual.scale.set(0.63, 0.63, 0.72);
    const erBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.51, 0.51, 0.42, 12),
      new THREE.MeshStandardMaterial({
        color: 0xd39a43,
        metalness: 0.52,
        roughness: 0.38,
      }),
    );
    erBand.rotation.x = Math.PI / 2;
    erBand.position.z = 1.6;
    visual.add(erBand);
  }
  g.position.copy(origin);
  setMissileAttitude(g, railDirection, "+Y", 0);
  const illuminationBeam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]),
    new THREE.LineBasicMaterial({
      color: 0xffd66b,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  illuminationBeam.visible = false;
  const history = [g.position.clone()],
    guidancePath = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(history),
      new THREE.LineBasicMaterial({
        color: sm2 ? 0x9deaff : 0x71d6ff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      }),
    ),
    track = combatPicture.trackForTarget(defenseSourceForTarget(target)),
    salvoLeader = interceptors.find(
      (i) => i.mesh.visible && i.target === target,
    ),
    commandPoint = (
      salvoLeader?.commandPoint ??
      track?.position ??
      target.mesh.position
    ).clone(),
    commandVelocity = (
      salvoLeader?.commandVelocity ??
      track?.velocity ??
      target.velocity
    ).clone(),
    nextDatalink = salvoLeader?.nextDatalink ?? elapsed + 0.35;
  scene.add(g, illuminationBeam, guidancePath);
  const interceptor = {
    mesh: g,
    target,
    age: 0,
    weapon,
    velocity: railDirection.clone().multiplyScalar(9),
    distanceTraveled: 0,
    history,
    guidancePath,
    commandPoint,
    commandVelocity,
    nextDatalink,
    datalinkValid: salvoLeader?.datalinkValid ?? !!track,
    illuminated: false,
    illuminationBeam,
  } as Interceptor;
  g.userData.launchSerial = interceptors.length + 1;
  g.userData.launcherLabel = launcherLabel;
  g.userData.launchPoint = launchPoint;
  interceptors.push(interceptor);
  const launchRange =
    target.mesh.position.distanceTo(defender.position) / WORLD_UNITS_PER_KM;
  log(
    `${weapon} ${launcherLabel} LAUNCH / ${launchPoint} / ${launchRange.toFixed(1)} km / TRACK ${Math.round((track?.quality ?? 0) * 100)}% / ${doctrine}`,
  );
  return interceptor;
}
function changeAmmo(weapon: WeaponType, amount: number) {
  if (weapon === "RIM-67") ammo += amount;
  else if (weapon === "SM-2MR") sm2Ammo += amount;
  else sm2erAmmo += amount;
  ammoEl.textContent = `RIM ${ammo} / MR ${sm2Ammo} / ER ${sm2erAmmo}`;
}
function pendingLauncherRequests() {
  return activeShip.launcher.kind === "mk10"
    ? mk10Launchers
        .filter((launcher) => launcher.pending)
        .map((launcher) => launcher.pending!)
    : vlsCells.filter((cell) => cell.pending).map((cell) => cell.pending!);
}
function launcherHealth(launcher: Mk10LauncherState) {
  return subsystemHealth(
    launcher.name === "AFT" ? "aftLauncher" : "forwardLauncher",
  );
}
function vlsCellDistance(a: number, b: number) {
  return activeShip.launcher.kind === "mk41"
    ? calculateVlsCellDistance(a, b, activeShip.launcher.columns)
    : Number.POSITIVE_INFINITY;
}
function changeVlsCellAmmo(cell: VlsCellState, amount: number) {
  if (cell.loadout === "SM-2MR") changeAmmo("SM-2MR", amount);
  else if (cell.loadout === "SM-2ER") changeAmmo("SM-2ER", amount);
}
function applyVlsBankDamage(bankName: VlsCellState["bank"], health: number) {
  if (activeShip.launcher.kind !== "mk41") return;
  applyVlsDamageIsolation({
    config: activeShip.launcher,
    cells: vlsCells,
    banks: vlsBanks,
    bank: bankName,
    health,
    elapsed,
    desiredDisabled: desiredDisabledCells,
    cellDistance: vlsCellDistance,
    removeAmmo: (cell) => changeVlsCellAmmo(cell, -1),
    cancel: cancelAuthorizedLaunch,
    log,
  });
}
function reserveInterceptorLauncher(target: DefenseTarget, weapon: WeaponType) {
  const result = reserveLauncherResource({
    config: activeShip.launcher,
    mk10Launchers,
    vlsCells,
    vlsBanks,
    request: { target, weapon },
    elapsed,
    cycle: launcherCycle,
    health: (bank) =>
      subsystemHealth(bank === "FWD" ? "forwardLauncher" : "aftLauncher"),
    targetId: defenseSourceForTarget(target),
    cellDistance: vlsCellDistance,
    log,
  });
  launcherCycle = result.cycle;
  return result.accepted;
}
function queueInterceptorLaunch(target: DefenseTarget, weapon: WeaponType) {
  const targetId = defenseSourceForTarget(target);
  return !!authorizeLaunch(engagements, targetId, () =>
    reserveInterceptorLauncher(target, weapon),
  );
}
function cancelAuthorizedLaunch(request: LauncherRequest) {
  resolveShot(
    engagements,
    defenseSourceForTarget(request.target),
    "cancel",
    elapsed,
  );
}
function updateMk10Launchers(dt: number) {
  if (activeShip.launcher.kind !== "mk10") return;
  updateMk10LauncherRuntime({
    config: activeShip.launcher,
    launchers: mk10Launchers,
    elapsed,
    dt,
    health: launcherHealth,
    trackPosition: (request) =>
      combatPicture.trackForTarget(defenseSourceForTarget(request.target))
        ?.position ?? null,
    worldToLocal: (position) => defender.worldToLocal(position),
    returnAmmo: (request) => changeAmmo(request.weapon, 1),
    cancel: cancelAuthorizedLaunch,
    launch: (request, launcherLabel, launchPoint, origin, direction) =>
      launchInterceptor(
        request.target,
        request.weapon,
        launcherLabel,
        launchPoint,
        origin,
        direction,
      ),
    log,
  });
}
function resetMk10Launchers() {
  resetMk10LauncherRuntime(mk10Launchers);
}
function configureVlsLoadout(requestedMr: number, requestedEr: number) {
  if (activeShip.launcher.kind !== "mk41") return { mr: 0, er: 0, other: 0 };
  const capacity = vlsCells.length,
    allocation = allocateVlsLoadout(capacity, requestedMr, requestedEr),
    order = vlsLoadOrder(vlsCells, activeShip.launcher);
  vlsCells.forEach((cell) => (cell.loadout = "OTHER"));
  let mrAssigned = 0,
    erAssigned = 0;
  for (const cell of order) {
    const assignMr =
      mrAssigned < allocation.mr &&
      (erAssigned >= allocation.er ||
        mrAssigned / Math.max(1, allocation.mr) <=
          erAssigned / Math.max(1, allocation.er));
    if (assignMr) {
      cell.loadout = "SM-2MR";
      mrAssigned++;
    } else if (erAssigned < allocation.er) {
      cell.loadout = "SM-2ER";
      erAssigned++;
    }
    if (mrAssigned >= allocation.mr && erAssigned >= allocation.er) break;
  }
  return {
    mr: mrAssigned,
    er: erAssigned,
    other: capacity - mrAssigned - erAssigned,
  };
}
function resetVlsCells() {
  resetVlsRuntime(vlsCells, vlsBanks);
}
function createVlsLaunchEffect(
  origin: THREE.Vector3,
  departureDirection?: THREE.Vector3,
) {
  const group = new THREE.Group(),
    flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 4.8, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd36a,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
    light = new THREE.PointLight(0xff9b45, 13, 55),
    smoke: THREE.Mesh[] = [];
  flame.rotation.z = Math.PI;
  flame.position.y = 2.15;
  light.position.y = 1.2;
  group.add(flame, light);
  for (let n = 0; n < 12; n++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 7, 5),
      new THREE.MeshBasicMaterial({
        color: 0xb7c0bd,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    puff.position.set(
      Math.sin(n * 2.4) * 0.35,
      0.1 + n * 0.08,
      Math.cos(n * 1.7) * 0.35,
    );
    smoke.push(puff);
    group.add(puff);
  }
  group.position.copy(origin);
  if (departureDirection && departureDirection.lengthSq() > 0)
    group.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      departureDirection.clone().normalize().negate(),
    );
  scene.add(group);
  vlsLaunchEffects.push({ group, flame, smoke, light, age: 0 });
}
function updateVlsLaunchEffects(dt: number) {
  for (let index = vlsLaunchEffects.length - 1; index >= 0; index--) {
    const effect = vlsLaunchEffects[index];
    effect.age += dt;
    const age = effect.age;
    effect.flame.scale.set(
      0.8 + Math.sin(age * 35) * 0.12,
      Math.max(0.15, 1 - age * 1.7),
      0.8 + Math.sin(age * 31) * 0.12,
    );
    (effect.flame.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0,
      0.9 - age * 1.7,
    );
    effect.light.intensity = Math.max(0, 13 - age * 20);
    effect.smoke.forEach((puff, n) => {
      const spread = age * (1.1 + n * 0.045);
      puff.position.x = Math.sin(n * 2.4) * spread;
      puff.position.z = Math.cos(n * 1.7) * spread;
      puff.position.y = 0.2 + age * (1.3 + n * 0.08);
      puff.scale.setScalar(0.45 + age * (1.6 + n * 0.04));
      (puff.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.28 - age * 0.16,
      );
    });
    if (age > 2.1) {
      scene.remove(effect.group);
      vlsLaunchEffects.splice(index, 1);
    }
  }
}
function updateVlsCells(dt: number) {
  if (activeShip.launcher.kind !== "mk41") return;
  updateVlsRuntime({
    config: activeShip.launcher,
    cells: vlsCells,
    banks: vlsBanks,
    elapsed,
    dt,
    health: (bank) => subsystemHealth(bank === "FWD" ? "forwardLauncher" : "aftLauncher"),
    shipQuaternion: () => defender.getWorldQuaternion(new THREE.Quaternion()),
    returnAmmo: (request) => changeAmmo(request.weapon, 1),
    cancel: cancelAuthorizedLaunch,
    launch: (request, launcherLabel, launchPoint, origin, direction) =>
      launchInterceptor(request.target, request.weapon, launcherLabel, launchPoint, origin, direction),
    launchEffect: createVlsLaunchEffect,
    log,
    report: ({ readyMr, readyEr, pendingMr, pendingEr, spent, disabledFwd, disabledAft, returning }) => {
  canvas.dataset.vlsFwdMinLaunchGap = Number.isFinite(
    vlsBanks.FWD.minimumObservedGap,
  )
    ? vlsBanks.FWD.minimumObservedGap.toFixed(2)
    : "";
  canvas.dataset.vlsAftMinLaunchGap = Number.isFinite(
    vlsBanks.AFT.minimumObservedGap,
  )
    ? vlsBanks.AFT.minimumObservedGap.toFixed(2)
    : "";
  canvas.dataset.vlsFwdLastCell = String(vlsBanks.FWD.lastCellIndex + 1 || "");
  canvas.dataset.vlsAftLastCell = String(vlsBanks.AFT.lastCellIndex + 1 || "");
  canvas.dataset.vlsFwdLaunchHistory = vlsBanks.FWD.launchHistory.join(",");
  canvas.dataset.vlsAftLaunchHistory = vlsBanks.AFT.launchHistory.join(",");
  canvas.dataset.vlsMrReady = String(readyMr);
  canvas.dataset.vlsErReady = String(readyEr);
  canvas.dataset.vlsMrPending = String(pendingMr);
  canvas.dataset.vlsErPending = String(pendingEr);
  canvas.dataset.vlsMrAvailable = String(sm2Ammo);
  canvas.dataset.vlsErAvailable = String(sm2erAmmo);
  canvas.dataset.vlsOtherLoaded = String(
    vlsCells.filter((cell) => cell.loadout === "OTHER").length,
  );
  canvas.dataset.vlsSpent = String(spent);
  canvas.dataset.vlsDisabledFwd = String(disabledFwd);
  canvas.dataset.vlsDisabledAft = String(disabledAft);
  canvas.dataset.vlsTrappedFwd = String(vlsBanks.FWD.trappedRounds);
  canvas.dataset.vlsTrappedAft = String(vlsBanks.AFT.trappedRounds);
  canvas.dataset.vlsReturning = String(returning);
    },
  });
}
function separateBooster(interceptor: Interceptor) {
  const booster = interceptor.mesh.userData.booster as THREE.Group | undefined;
  if (!booster || interceptor.mesh.userData.boosterSeparated) return;
  interceptor.mesh.userData.boosterSeparated = true;
  scene.attach(booster);
  const light = new THREE.PointLight(0xffb45b, 5, 18);
  light.position.copy(booster.position);
  scene.add(light);
  boosterDebris.push({
    mesh: booster,
    velocity: interceptor.velocity
      .clone()
      .multiplyScalar(0.62)
      .add(new THREE.Vector3(0, -1.4, 0)),
    spin: new THREE.Vector3(0.8, 0.35, 0.55),
    light,
    age: 0,
  });
  log(`${interceptor.weapon} BOOSTER SEPARATION`);
}
function updateBoosterDebris(dt: number) {
  for (let index = boosterDebris.length - 1; index >= 0; index--) {
    const debris = boosterDebris[index];
    debris.age += dt;
    debris.velocity.y -= 1.8 * dt;
    debris.mesh.position.addScaledVector(debris.velocity, dt);
    debris.mesh.rotation.x += debris.spin.x * dt;
    debris.mesh.rotation.y += debris.spin.y * dt;
    debris.mesh.rotation.z += debris.spin.z * dt;
    debris.light.position.copy(debris.mesh.position);
    debris.light.intensity = Math.max(0, 5 - debris.age * 4);
    if (debris.age > 5 || debris.mesh.position.y < -0.5) {
      scene.remove(debris.mesh, debris.light);
      boosterDebris.splice(index, 1);
    }
  }
}
function createChaffVisual(color: number) {
  const group = new THREE.Group(),
    material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  for (let n = 0; n < 28; n++) {
    const flake = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.025, 0.42),
      material,
    );
    const seed = n * 2.399;
    flake.position.set(
      Math.sin(seed) * 1.8,
      Math.cos(seed * 1.37) * 0.8,
      Math.sin(seed * 0.73) * 1.8,
    );
    flake.rotation.set(seed, seed * 0.7, seed * 1.3);
    group.add(flake);
  }
  return group;
}
function deployChaff(source: Missile) {
  const group = createChaffVisual(0xffe8a8);
  group.position.copy(source.mesh.position);
  scene.add(group);
  const position = group.position,
    velocity = source.velocity
      .clone()
      .multiplyScalar(0.22)
      .add(new THREE.Vector3(0.18, 0.05, -0.12));
  chaffClouds.push({
    mesh: group,
    position,
    velocity,
    age: 0,
    rcs: 2.8,
    initialRcs: 2.8,
    source,
    side: "threat",
    serial: ++chaffSerial,
  });
  source.mesh.userData.chaffDeployed = true;
  log(
    `${source.threatType} CHAFF DEPLOY / RCS 2.8 / ${chaffClouds.length} CLOUDS`,
  );
}
function deployPlatformDecoy(missile: SurfaceStrikeMissile) {
  const platform = missile.target;
  const softKill = platform.definition.survivability.softKill;
  const track = platform.incomingTracks.get(missile.id);
  const countermeasureHealth =
    (platform.subsystemHealth.get("countermeasures") ?? 100) / 100;
  const trackValid =
    !!track &&
    track.detectionLogged &&
    track.quality >=
      platform.definition.survivability.pointDefense.minimumTrackQuality &&
    elapsed - track.lastUpdate <=
      platform.definition.survivability.pointDefense.trackMemory;
  const observedPosition = trackValid ? track!.position : undefined;
  const range = observedPosition
    ? observedPosition.distanceTo(platform.model.position)
    : Infinity;
  if (
    !platformDecoysEnabled ||
    platform.destroyed ||
    countermeasureHealth <= 0.05 ||
    platform.decoyRounds <= 0 ||
    elapsed < platform.nextDecoy ||
    range > softKill.decoyDeployRange ||
    missile.mesh.userData.platformDecoyDeployed ||
    !trackValid
  )
    return false;
  const threatAxis = observedPosition!
    .clone()
    .sub(platform.model.position)
    .setY(0)
    .normalize();
  const beam = new THREE.Vector3(-threatAxis.z, 0, threatAxis.x).multiplyScalar(
    missile.id % 2 ? 1 : -1,
  );
  const group = createChaffVisual(0xffb58a);
  group.position
    .copy(platform.model.position)
    .addScaledVector(beam, 5.2)
    .add(new THREE.Vector3(0, 2.4, 0));
  scene.add(group);
  chaffClouds.push({
    mesh: group,
    position: group.position,
    velocity: platform.velocity
      .clone()
      .addScaledVector(beam, 0.42)
      .add(new THREE.Vector3(0, 0.08, 0)),
    age: 0,
    rcs: softKill.decoyRcs,
    initialRcs: softKill.decoyRcs,
    source: null,
    side: "platform",
    serial: ++chaffSerial,
  });
  platform.decoyRounds--;
  missile.mesh.userData.platformDecoyDeployed = true;
  platform.nextDecoy =
    elapsed + softKill.decoyCooldown / Math.max(0.3, countermeasureHealth);
  log(
    `${platform.definition.name} DECOY DEPLOY / ROUNDS ${platform.decoyRounds} / RCS ${softKill.decoyRcs.toFixed(1)}`,
  );
  return true;
}
function deployShipChaff(threat: Missile) {
  return deployShipChaffAt(threat.mesh.position);
}
function deployShipChaffAt(threatPosition: THREE.Vector3) {
  const health = subsystemHealth("srboc");
  if (
    !srbocEnabled ||
    health <= 0.05 ||
    srbocRounds <= 0 ||
    elapsed - lastSrboc < 4 / Math.max(0.3, health)
  )
    return false;
  const relative = threatPosition
      .clone()
      .sub(defender.position)
      .setY(0)
      .normalize(),
    offset = new THREE.Vector3(-relative.z, 0, relative.x).multiplyScalar(22),
    side = srbocRounds % 2 === 0 ? 1 : -1,
    start = defender.localToWorld(new THREE.Vector3(0, 8, side * 4.8)),
    burst = defender.position
      .clone()
      .add(offset)
      .add(new THREE.Vector3(0, 8, 0)),
    control = start
      .clone()
      .lerp(burst, 0.5)
      .add(new THREE.Vector3(0, 15, 0)),
    mesh = new THREE.Group();
  const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 1.6, 8),
      new THREE.MeshStandardMaterial({
        color: 0xdce4dc,
        emissive: 0x5b7f78,
        emissiveIntensity: 0.8,
        metalness: 0.48,
        roughness: 0.35,
      }),
    ),
    flare = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 2.2, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8ffff0,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
    core = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xe5fff8,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
    glow = new THREE.PointLight(0x9fffe8, 8, 28);
  flare.position.y = -1.65;
  core.position.y = -0.75;
  mesh.add(body, flare, core, glow);
  mesh.position.copy(start);
  const trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([start]),
    new THREE.LineBasicMaterial({
      color: 0xa8fff0,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    }),
  );
  trail.userData.history = [start.clone()];
  scene.add(mesh, trail);
  srbocRoundsInFlight.push({
    mesh,
    trail,
    start,
    control,
    burst,
    burstVelocity: offset
      .clone()
      .normalize()
      .multiplyScalar(1.5)
      .add(new THREE.Vector3(-0.18, 0.03, 0.12)),
    age: 0,
    flightTime: 1.15 / Math.max(0.55, health),
  });
  srbocRounds--;
  lastSrboc = elapsed;
  log(
    `MK 36 SRBOC LAUNCH / ${srbocRounds} ROUNDS / HEALTH ${Math.round(health * 100)}%`,
  );
  return true;
}
function updateCountermeasures(dt: number) {
  for (let index = srbocRoundsInFlight.length - 1; index >= 0; index--) {
    const round = srbocRoundsInFlight[index];
    round.age += dt;
    const t = Math.min(1, round.age / round.flightTime),
      u = 1 - t,
      position = round.start
        .clone()
        .multiplyScalar(u * u)
        .add(round.control.clone().multiplyScalar(2 * u * t))
        .add(round.burst.clone().multiplyScalar(t * t)),
      tangent = round.control
        .clone()
        .sub(round.start)
        .multiplyScalar(2 * u)
        .add(
          round.burst
            .clone()
            .sub(round.control)
            .multiplyScalar(2 * t),
        )
        .normalize();
    round.mesh.position.copy(position);
    round.mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      tangent,
    );
    const history = round.trail.userData.history as THREE.Vector3[];
    if (
      !history.length ||
      history[history.length - 1].distanceTo(position) > 0.6
    ) {
      history.push(position.clone());
      if (history.length > 22) history.shift();
      round.trail.geometry.dispose();
      round.trail.geometry = new THREE.BufferGeometry().setFromPoints(history);
    }
    if (t >= 1) {
      scene.remove(round.mesh, round.trail);
      const group = createChaffVisual(0x9feaff);
      group.position.copy(round.burst);
      scene.add(group);
      chaffClouds.push({
        mesh: group,
        position: group.position,
        velocity: round.burstVelocity,
        age: 0,
        rcs: 7.5,
        initialRcs: 7.5,
        source: null,
        side: "ship",
        serial: ++chaffSerial,
      });
      srbocRoundsInFlight.splice(index, 1);
      log(`MK 36 SRBOC AIRBURST / CHAFF RCS 7.5`);
    }
  }
  for (let index = chaffClouds.length - 1; index >= 0; index--) {
    const cloud = chaffClouds[index];
    cloud.age += dt;
    cloud.position.addScaledVector(cloud.velocity, dt);
    cloud.velocity.multiplyScalar(Math.pow(0.96, dt));
    cloud.mesh.rotation.y += dt * 0.18;
    cloud.mesh.scale.setScalar(1 + cloud.age * 0.22);
    cloud.rcs = Math.max(0.1, cloud.initialRcs * (1 - cloud.age / 14));
    cloud.mesh.children.forEach((o) => {
      if (o instanceof THREE.Mesh)
        (o.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          0.42 - cloud.age / 30,
        );
    });
    if (cloud.age > 14) {
      scene.remove(cloud.mesh);
      chaffClouds.splice(index, 1);
    }
  }
}
function createExplosion(position: THREE.Vector3) {
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.2, 2),
    new THREE.MeshBasicMaterial({
      color: 0xffc45e,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  core.position.copy(position);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.22, 10, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff7138,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  ring.position.copy(position);
  ring.quaternion.copy(camera.quaternion);
  const light = new THREE.PointLight(0xff6a22, 18, 95);
  light.position.copy(position);
  scene.add(core, ring, light);
  explosions.push({ core, ring, light, age: 0 });
}
function createShipDamage(
  worldPosition: THREE.Vector3,
  severity: number,
  localOverride?: THREE.Vector3,
) {
  const local =
      localOverride?.clone() ?? defender.worldToLocal(worldPosition.clone()),
    side = local.z >= 0 ? 1 : -1,
    group = new THREE.Group();
  local.x = THREE.MathUtils.clamp(local.x, -24, 24);
  local.y = Math.max(6.3, local.y);
  local.z = side * Math.max(3.75, Math.abs(local.z));
  group.position.copy(local);
  group.rotation.y = side < 0 ? Math.PI : 0;
  const scorch = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 18),
    new THREE.MeshBasicMaterial({
      color: 0x120d0b,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  group.add(scorch);
  const fire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff6b24,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  fire.position.set(0, 1, 0.2);
  group.add(fire);
  const smoke: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 7, 5),
      new THREE.MeshBasicMaterial({
        color: 0x667174,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    smoke.push(puff);
    group.add(puff);
  }
  const light = new THREE.PointLight(0xff5a24, 5 + severity * 0.1, 28);
  light.position.set(0, 1.2, 0.6);
  group.add(light);
  defender.add(group);
  shipDamageEffects.push({
    group,
    fire,
    smoke,
    light,
    seed: shipDamageEffects.length * 2.37 + 0.4,
  });
  (defender.userData.hullMat as THREE.MeshStandardMaterial).color.lerp(
    new THREE.Color(0x2a2423),
    Math.min(0.45, severity / 100),
  );
}
function createPlatformDamage(
  platform: EnemyPlatformInstance,
  severity: number,
  serial: number,
  localImpact?: THREE.Vector3,
) {
  const group = new THREE.Group();
  group.position.copy(
    localImpact
      ? localImpact.clone().setY(Math.max(2.2, localImpact.y))
      : new THREE.Vector3(
          THREE.MathUtils.clamp(((serial % 3) - 1) * 12, -20, 20),
          5.2 + (serial % 2) * 1.8,
          serial % 2 ? 3.6 : -3.6,
        ),
  );
  const fire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.2, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff6528,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  fire.position.y = 0.8;
  group.add(fire);
  const smoke: THREE.Mesh[] = [];
  for (let index = 0; index < 7; index++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 7, 5),
      new THREE.MeshBasicMaterial({
        color: 0x5d6668,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    smoke.push(puff);
    group.add(puff);
  }
  const light = new THREE.PointLight(0xff5422, 4 + severity * 0.1, 30);
  light.position.y = 1.2;
  group.add(light);
  platform.model.add(group);
  shipDamageEffects.push({
    group,
    fire,
    smoke,
    light,
    seed: 19.4 + serial * 2.17,
  });
}
function updateSubsystemPanel() {
  let damaged = 0,
    failed = 0;
  for (const system of subsystemList) {
    if (system.health < 99.5) damaged++;
    if (system.health <= 5) failed++;
    const row = subsystemPanel.querySelector<HTMLElement>(
      `[data-system="${system.id}"]`,
    );
    if (!row) continue;
    row.classList.toggle(
      "damaged",
      system.health < 99.5 && system.health >= 65,
    );
    row.classList.toggle("degraded", system.health < 65 && system.health > 5);
    row.classList.toggle("failed", system.health <= 5);
    (row.querySelector("i") as HTMLElement).style.width = `${system.health}%`;
    (row.querySelector("b") as HTMLElement).textContent =
      system.health <= 5 ? "FAIL" : String(Math.round(system.health));
  }
  const summary = subsystemPanel.querySelector("#damageSummary")!;
  summary.textContent = failed
    ? `${failed} FAILED / ${damaged} DAMAGED`
    : damaged
      ? `${damaged} SYSTEMS DAMAGED`
      : "ALL SYSTEMS NOMINAL";
  subsystemPanel.classList.toggle("alert", damaged > 0);
}
function subsystemRows() {
  return subsystemList
    .map(
      (system) =>
        `<div class="subsystem-row" data-system="${system.id}"><span>${system.label}</span><div><i></i></div><b>100</b></div>`,
    )
    .join("");
}
function configureShip(shipClass: ShipClass) {
  if (activeShip.id === shipClass) return;
  const definition = SHIP_DEFINITIONS.get(shipClass);
  if (!definition) return;
  const position = defender.position.clone(),
    rotation = defender.rotation.clone();
  scene.remove(defender);
  activeShip = definition;
  initialLoadout = initialSurfaceLoadout(activeShip);
  defender = activeShip.build();
  if (activeShip.fixedSensorFaces)
    defender.userData.fixedSensorFaceHealth = createFaceHealth(
      activeShip.fixedSensorFaces,
    );
  defender.position.copy(position);
  defender.rotation.copy(rotation);
  defender.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  scene.add(defender);
  mk10Launchers =
    activeShip.launcher.kind === "mk10"
      ? [
          makeMk10State("AFT", defender.userData.launcher, Math.PI),
          makeMk10State("FORWARD", defender.userData.forwardLauncher, Math.PI),
        ]
      : [];
  vlsCells =
    activeShip.launcher.kind === "mk41"
      ? (
          defender.userData.vlsCells as {
            lid: THREE.Group;
            origin: THREE.Object3D;
            index: number;
            bank: "FWD" | "AFT";
          }[]
        ).map((cell) => ({
          ...cell,
          phase: "ready" as const,
          closeTo: "ready" as const,
          phaseSince: 0,
          pending: null,
          loadout: "OTHER" as const,
        }))
      : [];
  if (activeShip.launcher.kind === "mk41")
    configureVlsLoadout(activeShip.ammo.sm2mr, activeShip.ammo.sm2er);
  for (const system of subsystemList) {
    system.label = activeShip.subsystemLabels[system.id];
    system.position.copy(activeShip.subsystemPositions[system.id]);
    system.health = 100;
  }
  combatPicture.setSensors(activeShip.sensors);
  surfacePicture.setSensors(activeShip.sensors);
  resetSurfaceStrikeLoadout();
  const grid = subsystemPanel.querySelector(".subsystem-grid")!;
  grid.innerHTML = subsystemRows();
  updateSubsystemPanel();
  (document.querySelector("#shipBadge") as HTMLElement).textContent =
    activeShip.hullNumber;
  (document.querySelector("#shipName") as HTMLElement).textContent =
    activeShip.name;
  (document.querySelector("#shipRole") as HTMLElement).textContent =
    activeShip.role;
  (document.querySelector("#radarName") as HTMLElement).textContent =
    activeShip.sensors.find((sensor) => sensor.threeDimensional)?.name ??
    activeShip.sensors[0].name;
  const pick = document.querySelector("#pickShip") as HTMLButtonElement | null;
  if (pick) pick.textContent = `PICK ${activeShip.name} ON RADAR`;
  log(
    `SHIP SELECT / ${activeShip.name} ${activeShip.hullNumber} / ${activeShip.era} / ${activeShip.launcher.displayName}`,
  );
}
function damageSubsystem(
  id: SubsystemId,
  amount: number,
  secondary = false,
  approachBearing = 0,
) {
  const system = subsystems[id],
    before = system.health;
  system.health = Math.max(0, system.health - amount);
  if (Math.round(before) === Math.round(system.health)) return;
  const state =
    system.health <= 5
      ? "DESTROYED"
      : system.health < 35
        ? "CRITICAL"
        : system.health < 65
          ? "DEGRADED"
          : "DAMAGED";
  log(
    `${system.label} ${state} / ${Math.round(before)} -> ${Math.round(system.health)}${secondary ? " / FRAGMENTATION" : ""}`,
  );
  const sensorFace =
      id === activeShip.fixedSensorFaces?.subsystemId
        ? damageFixedSensorFace(approachBearing, amount)
        : -1,
    faceModels = defender.userData.sensorFaceModels as
      THREE.Group[] | undefined,
    side = Math.sin((shipDamageEffects.length + 1) * 4.17) >= 0 ? 1 : -1,
    visualPosition =
      sensorFace >= 0 && faceModels?.[sensorFace]
        ? faceModels[sensorFace].position.clone()
        : system.position.clone();
  if (sensorFace < 0)
    visualPosition.z = side * Math.max(3.8, Math.abs(visualPosition.z));
  createShipDamage(
    defender.localToWorld(visualPosition.clone()),
    amount * 0.55,
    visualPosition,
  );
  if (id === "aftLauncher" || id === "forwardLauncher") {
    if (activeShip.launcher.kind === "mk41")
      applyVlsBankDamage(
        id === "aftLauncher" ? "AFT" : "FWD",
        system.health / 100,
      );
    else if (system.health <= 5) {
      const launcher = mk10Launchers[id === "aftLauncher" ? 0 : 1];
      if (launcher?.pending) {
        changeAmmo(launcher.pending.weapon, 1);
        cancelAuthorizedLaunch(launcher.pending);
        launcher.pending = null;
      }
      if (launcher) {
        launcher.phase = "returning";
        launcher.reloadRail = -1;
        launcher.phaseSince = elapsed;
      }
    }
  }
  updateSubsystemPanel();
}
function applySubsystemDamage(missile: Missile, severity: number) {
  const id = missiles.indexOf(missile) + 1,
    seed = (value: number) => {
      const raw =
        Math.sin(id * 12.9898 + leakers * 78.233 + value * 37.719) * 43758.5453;
      return raw - Math.floor(raw);
    },
    originLocal = defender.worldToLocal(missile.history[0].clone()),
    approachBearing = Math.atan2(-originLocal.z, originLocal.x),
    approachBias = THREE.MathUtils.clamp(originLocal.x * 0.07, -18, 18),
    limit = activeShip.damageModel.longitudinalLimit,
    impactX = THREE.MathUtils.clamp(
      approachBias +
        missile.aimOffset.x * 4 +
        THREE.MathUtils.lerp(-5, 5, seed(1)),
      -limit,
      limit,
    ),
    zones = activeShip.damageModel.zones.find(
      (zone) => impactX > zone.minX,
    )!.systems,
    primary = zones[Math.floor(seed(2) * zones.length)],
    secondary = zones.filter((id) => id !== primary)[
      Math.floor(seed(3) * (zones.length - 1))
    ];
  damageSubsystem(
    primary,
    severity * (0.78 + seed(4) * 0.5),
    false,
    approachBearing,
  );
  if (secondary)
    damageSubsystem(
      secondary,
      severity * (0.18 + seed(5) * 0.18),
      true,
      approachBearing,
    );
  log(
    `DAMAGE CONTROL / ${impactX > limit / 3 ? "FORWARD" : impactX < -limit / 3 ? "AFT" : "AMIDSHIPS"} HIT / ${subsystems[primary].label} PRIMARY`,
  );
}
function flashCombat(kind: "intercept" | "impact") {
  combatFlash.className = "combat-flash";
  void combatFlash.offsetWidth;
  combatFlash.classList.add(kind);
}
function destroyMissileVisual(
  missile: DefenseTarget,
  effect: "intercept" | "impact",
) {
  if (!explodedTargets.has(missile)) {
    explodedTargets.add(missile);
    createExplosion(missile.mesh.position.clone());
  }
  flashCombat(effect);
}
for (const threat of initialSurfaceThreats())
  addMissile(threat.position, threat.threatType);
let running = true,
  elapsed = 0,
  simAccumulator = 0,
  last = performance.now(),
  ammo = initialLoadout.rim67,
  sm2Ammo = initialLoadout.sm2mr,
  sm2erAmmo = initialLoadout.sm2er,
  selectedWeapon: WeaponType = activeShip.launcher.compatibleWeapons[0],
  autoFire = DEFAULT_SURFACE_CONFIG.autoFire,
  radarEnabled = DEFAULT_SURFACE_CONFIG.radarEnabled,
  timeScale = 1,
  selectedTargetId = 1,
  hullIntegrity = 100,
  ciwsEnabled = true,
  ciwsRounds = initialLoadout.ciws,
  lastCiwsShot = -10,
  nextSamLaunch = 0,
  leakers = 0,
  missionEnded = false,
  maxSamChannels = DEFAULT_SURFACE_CONFIG.maxSamChannels,
  maxIlluminators = DEFAULT_SURFACE_CONFIG.maxIlluminators,
  searchWidth = 360,
  doctrine: EngagementDoctrine = DEFAULT_SURFACE_CONFIG.doctrine,
  chaffEnabled = DEFAULT_SURFACE_CONFIG.chaffEnabled,
  ecmEnabled = DEFAULT_SURFACE_CONFIG.ecmEnabled,
  platformDecoysEnabled = DEFAULT_SURFACE_CONFIG.platformDecoysEnabled,
  shipEcmEnabled = DEFAULT_SURFACE_CONFIG.shipEcmEnabled,
  srbocEnabled = DEFAULT_SURFACE_CONFIG.srbocEnabled,
  srbocRounds = DEFAULT_SURFACE_CONFIG.srbocRounds,
  lastSrboc = -20;
let dragging = false,
  px = 0,
  py = 0,
  az = 0.65,
  el = 0.48,
  dist = 210,
  cinematic = false,
  viewMode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 2,
  selectedAircraftId: string | null = null;
let shipSpeedKnots = DEFAULT_SURFACE_CONFIG.initialSpeedKnots,
  shipDesiredHeading = 0,
  shipCommandedSpeedKnots = activeShip.platform.patrolSpeedKnots,
  shipManeuverMode: ShipManeuverMode = "patrol",
  nextShipDecision = 0,
  shipManeuverThreatId: number | string = 0;
let aarSnapshots: AarSnapshot[] = [],
  aarEvents: AarEvent[] = [],
  nextAarSnapshot = 0,
  aarReplayTimer: number | undefined;
const phaseEl = document.querySelector("#phase")!,
  clockEl = document.querySelector("#clock")!,
  targetState = document.querySelector("#targetState")!,
  targetCount = document.querySelector("#targetCount")!,
  raidIndex = document.querySelector("#raidIndex")!,
  raidTitle = document.querySelector("#raidTitle")!,
  feed = document.querySelector("#feed")!,
  ammoEl = document.querySelector("#ammo")!,
  weaponEnvelope = document.querySelector("#weaponEnvelope")!,
  threatName = document.querySelector("#threatName")!,
  threatRange = document.querySelector("#threatRange")!,
  threatAltitude = document.querySelector("#threatAltitude")!,
  trackQuality = document.querySelector("#trackQuality")!,
  threatTti = document.querySelector("#threatTti")!,
  seekerState = document.querySelector("#seekerState")!,
  ewState = document.querySelector("#ewState")!,
  qualityFill = document.querySelector("#qualityFill") as HTMLElement;

function updateRaidCard(
  liveAir: number,
  reserveAir: number,
  maxAirRange: number,
) {
  if (!enemyPlatform) {
    raidIndex.textContent = "AIR";
    raidTitle.textContent = "RAID STATUS";
    targetCount.textContent = `${liveAir} ACTIVE / ${reserveAir} RESERVE / ${(maxAirRange / 10).toFixed(1)} km`;
    return;
  }
  const track = surfacePicture.trackForTarget(1),
    quality = track?.quality ?? 0,
    identified = quality >= 0.7,
    strikeMagazine = activeShip.surfaceStrike?.magazine ?? 0;
  raidIndex.textContent = "SFC";
  raidTitle.textContent = identified
    ? enemyPlatform.definition.name
    : "SURFACE CONTACT";
  targetCount.textContent = track
    ? `${liveAir} AIR / ${(track.position.distanceTo(defender.position) / 10).toFixed(1)} km / TQ ${Math.round(quality * 100)}%${track.horizonLimited ? " / HORIZON LIMITED" : " / LOS"} / EW ${ecmEnabled ? "ON" : "OFF"}`
    : `${liveAir} AIR / SEARCHING / EW ${ecmEnabled ? "ON" : "OFF"}`;
  let bda = "BDA PENDING";
  if (
    surfaceStrikeAmmo === strikeMagazine &&
    surfaceLaunchQueue.length === 0 &&
    !surfaceFireControlReadyLogged
  )
    bda = Number.isFinite(surfaceFireControlReadyAt)
      ? "FC ASSIGN"
      : "TRACK BUILD";
  if (surfaceHits > 0 && activeShip.surfaceStrike) {
    const estimate = estimateSurfaceBattleDamage({
      targetHullEstimate: activeShip.surfaceStrike.targetHullEstimate,
      weaponDamage: activeShip.surfaceStrike.damage,
      assessedHits: surfaceHits,
      trackQuality: quality,
    });
    bda =
      elapsed < nextSurfaceAssessment
        ? `BDA ASSESS ${(nextSurfaceAssessment - elapsed).toFixed(1)}s`
        : estimate.disabledConfidence >= 0.7
          ? `BDA DISABLED ${Math.round(estimate.disabledConfidence * 100)}%`
          : `BDA ${estimate.lowerPercent}-${estimate.upperPercent}%`;
  }
  const enemySlot = enemyPlatform.definition.weaponSlots[0],
    enemyStates = [...enemyPlatform.hardpointState.values()],
    enemyFired = enemyStates.filter((state) => state === "fired").length,
    enemyReserved = enemyStates.filter((state) => state === "reserved").length,
    enemyTrackAge = enemyPlatform.weaponTrackAge.get(enemySlot.id) ?? 0,
    enemyTargeting = platformTargetingSolution(enemyPlatform, enemySlot),
    enemyRequiredAge = enemyTargeting.requiredAge;
  let enemyFireState = "OPFOR SEARCH";
  if (platformFirePlan?.assessmentPending)
    enemyFireState = `OPFOR BDA ${Math.max(0, platformFirePlan.assessmentReadyAt - elapsed).toFixed(1)}s`;
  else if (enemyFired > 0)
    enemyFireState = `OPFOR LAUNCHED ${enemyFired}${platformFirePlan ? ` / WAVE ${platformFirePlan.wave}` : ""}`;
  else if (enemyTargeting.passive)
    enemyFireState =
      enemyTrackAge >= enemyRequiredAge
        ? "OPFOR PASSIVE READY"
        : `OPFOR PASSIVE BUILD ${Math.max(0, enemyRequiredAge - enemyTrackAge).toFixed(1)}s`;
  else if (
    enemyPlatform.targetTrack.source === "radar" &&
    enemyPlatform.targetTrack.quality >= enemySlot.minimumTrackQuality
  )
    enemyFireState =
      enemyTrackAge >= enemyRequiredAge
        ? "OPFOR FC READY"
        : `OPFOR FC BUILD ${Math.max(0, enemyRequiredAge - enemyTrackAge).toFixed(1)}s`;
  else if (enemyReserved > 0) enemyFireState = "OPFOR TRACK BUILD";
  targetState.textContent = `HARP ${surfaceStrikeAmmo}/${strikeMagazine} / ${bda} / ${enemyFireState}`;
  targetState.setAttribute("data-opfor-fire-state", enemyFireState);
}
const targetMarker = document.querySelector("#targetMarker") as HTMLElement,
  targetMarkerLabel = document.querySelector(
    "#targetMarkerLabel",
  ) as HTMLElement,
  combatFlash = document.querySelector("#combatFlash") as HTMLElement;
const controls = document.createElement("div");
controls.className = "combat-controls";
controls.style.cssText =
  "position:fixed;left:34px;bottom:150px;display:flex;gap:8px;z-index:8";
document.body.appendChild(controls);
const subsystemPanel = document.createElement("section");
subsystemPanel.className = "subsystem-panel";
subsystemPanel.innerHTML = `<header><b>DAMAGE CONTROL</b><span id="damageSummary">ALL SYSTEMS NOMINAL</span></header><div class="subsystem-grid">${subsystemRows()}</div>`;
document.body.appendChild(subsystemPanel);
const airStatusPanel = document.createElement("section");
airStatusPanel.className = "air-status";
airStatusPanel.innerHTML =
  "<b>JOINT AIR PICTURE</b><span>AIR OPERATIONS STANDBY</span>";
document.body.appendChild(airStatusPanel);
updateSubsystemPanel();
const resultPanel = document.createElement("div");
resultPanel.className = "result-panel aar-panel";
resultPanel.style.display = "none";
document.body.appendChild(resultPanel);
let placementMode: false | "enemy" | "ship" = false;
const sandbox = document.createElement("div");
sandbox.style.cssText =
  "position:fixed;inset:0;margin:auto;width:470px;height:430px;background:#071923f5;border:1px solid #4ac0b8;color:#d5edf0;z-index:30;padding:28px;font:12px Arial;letter-spacing:1px";
const threatOptions = THREAT_DEFINITIONS.map(
  (definition) => `<option>${definition.id}</option>`,
).join("");
sandbox.innerHTML = `<div style="font-size:20px;letter-spacing:3px;margin-bottom:22px">SANDBOX SCENARIO</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><label>MISSILE TYPE<select id="sbType">${threatOptions}</select></label><label>MISSILE COUNT<input id="sbCount" type="number" min="1" max="24" value="6"></label><label>LAUNCH INTERVAL (s)<input id="sbInterval" type="number" min="0" max="20" step="0.5" value="1"></label><label>ALTITUDE (50 m/unit)<input id="sbAltitude" type="number" min="0.12" max="500" step="0.1" value="1.2"></label><label>CENTER X (10 = 1 KM)<input id="sbX" type="number" min="-800" max="800" value="0"></label><label>CENTER Z (10 = 1 KM)<input id="sbZ" type="number" min="-1200" max="-80" value="-600"></label><label>FORMATION SPREAD<input id="sbSpread" type="number" min="0" max="500" value="150"></label><label>START WEAPON<select id="sbWeapon"><option>RIM-67</option><option>SM-2MR</option><option>SM-2ER</option></select></label></div><button id="sbStart" style="margin-top:28px;width:100%;border:1px solid #4ac0b8;background:#0b2830;color:#bce7e5;padding:11px;cursor:pointer">START EXERCISE</button>`;
(sandbox.querySelector("#sbType") as HTMLSelectElement).value =
  DEFAULT_THREAT_ID;
const defaultThreatPreset = getThreatDefinition(DEFAULT_THREAT_ID).preset;
(sandbox.querySelector("#sbCount") as HTMLInputElement).value = String(
  defaultThreatPreset.count,
);
(sandbox.querySelector("#sbInterval") as HTMLInputElement).value = String(
  defaultThreatPreset.interval,
);
(sandbox.querySelector("#sbAltitude") as HTMLInputElement).value = String(
  defaultThreatPreset.altitude,
);
(sandbox.querySelector("#sbSpread") as HTMLInputElement).value = String(
  defaultThreatPreset.spread,
);
(sandbox.querySelector("#sbZ") as HTMLInputElement).value = String(
  -defaultThreatPreset.range,
);
sandbox
  .querySelectorAll("input,select")
  .forEach(
    (e: any) =>
      (e.style.cssText =
        "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px"),
  );
document.body.appendChild(sandbox);
running = false;
missiles.forEach((m) => {
  m.mesh.visible = false;
  m.path.visible = false;
});
sandbox.className = "sandbox-panel";
function numberInput(id: string) {
  return Number((sandbox.querySelector(id) as HTMLInputElement).value);
}
const airScenarioField = document.createElement("label");
airScenarioField.className = "sandbox-toggle";
airScenarioField.innerHTML =
  '<input id="sbAirCombat" type="checkbox" checked> JOINT AIR OPERATIONS / F-14A + MIG-29A + TU-16K + A-6E';
sandbox.insertBefore(airScenarioField, sandbox.querySelector("#sbStart"));
const airScenarioInput = airScenarioField.querySelector(
  "input",
) as HTMLInputElement;
const tacviewExportField = document.createElement("label");
tacviewExportField.className = "sandbox-toggle";
tacviewExportField.innerHTML =
  '<input id="sbTacviewAutoExport" type="checkbox"> AUTO-EXPORT TACVIEW ACMI AFTER ACTION';
sandbox.insertBefore(tacviewExportField, sandbox.querySelector("#sbStart"));
const tacviewAutoExportInput = tacviewExportField.querySelector(
  "input",
) as HTMLInputElement;
const highQualityField = document.createElement("label");
highQualityField.className = "sandbox-toggle";
highQualityField.innerHTML =
  '<input id="sbHighQualityEnvironment" type="checkbox"> HIGH QUALITY ENVIRONMENT / SKY + CLOUDS + VOLUMETRIC FOG';
sandbox.insertBefore(highQualityField, sandbox.querySelector("#sbStart"));
const highQualityEnvironmentInput = highQualityField.querySelector("input") as HTMLInputElement;
const ultraQualityField = document.createElement("label");
ultraQualityField.className = "sandbox-toggle";
ultraQualityField.innerHTML =
  '<input id="sbWebGpuUltra" type="checkbox"> WEBGPU ULTRA / COMPUTE CLOUD DETAIL <span id="sbWebGpuUltraStatus">IDLE</span>';
sandbox.insertBefore(ultraQualityField, sandbox.querySelector("#sbStart"));
const webGpuUltraInput = ultraQualityField.querySelector("input") as HTMLInputElement;
const webGpuUltraStatusElement = ultraQualityField.querySelector("span") as HTMLSpanElement;

function updateWebGpuUltraStatus() {
  webGpuUltraStatusElement.textContent = webGpuUltraStatus.toUpperCase();
  webGpuUltraStatusElement.dataset.status = webGpuUltraStatus;
  ultraQualityField.title = webGpuUltraResult?.error || webGpuUltraResult?.adapterName || "WebGPU compute is initialized only when Ultra is selected";
  canvas.dataset.webGpuUltraRequested = String(webGpuUltraInput.checked);
  canvas.dataset.webGpuUltraStatus = webGpuUltraStatus;
  canvas.dataset.webGpuUltraBackend = webGpuUltraResult?.backend ?? "WEBGL2";
  canvas.dataset.webGpuUltraAdapter = webGpuUltraResult?.adapterName ?? "";
  canvas.dataset.webGpuUltraError = webGpuUltraResult?.error ?? "";
  canvas.dataset.webGpuUltraCloudDetail = webGpuUltraStatus === "active" ? "COMPUTE_FBM_128" : "OFF";
}

async function configureWebGpuUltra(requested: boolean) {
  if (!requested) {
    highQualityEnvironment.setUltraDetail(null);
    webGpuUltraResult?.detailTexture?.dispose();
    webGpuUltraResult = null;
    webGpuUltraStatus = "idle";
    updateWebGpuUltraStatus();
    return;
  }
  highQualityEnvironmentInput.checked = true;
  if (webGpuUltraStatus === "active") return;
  if (webGpuUltraInitialization) return webGpuUltraInitialization;
  webGpuUltraStatus = "initializing";
  updateWebGpuUltraStatus();
  webGpuUltraInitialization = (async () => {
    webGpuUltraResult = await initializeWebGpuUltra();
    webGpuUltraStatus = webGpuUltraResult.status;
    highQualityEnvironment.setUltraDetail(webGpuUltraResult.detailTexture);
    updateWebGpuUltraStatus();
    webGpuUltraInitialization = null;
  })();
  return webGpuUltraInitialization;
}

webGpuUltraInput.addEventListener("change", () => {
  void configureWebGpuUltra(webGpuUltraInput.checked);
});
const airPresetField = document.createElement("label");
airPresetField.className = "sandbox-field";
airPresetField.innerHTML = `<span>AIR PRESET</span><select id="sbAirPreset">${Object.entries(
  AIR_SCENARIO_PRESETS,
)
  .map(
    ([id, preset]) =>
      `<option value="${id}">${preset.label} / ${preset.description}</option>`,
  )
  .join("")}</select>`;
sandbox.insertBefore(airPresetField, sandbox.querySelector("#sbStart"));
const airPresetInput = airPresetField.querySelector(
  "select",
) as HTMLSelectElement;
let pureAirCombatStart = false;
const pureAirStartButton = document.createElement("button");
pureAirStartButton.id = "sbStartPureAir";
pureAirStartButton.textContent = "START PURE AIR COMBAT / F-14A VS MIG-29A";
pureAirStartButton.style.cssText =
  "margin-top:10px;width:100%;border:1px solid #5f8fe8;background:#101f3a;color:#d8e6ff;padding:11px;cursor:pointer;letter-spacing:1px";
sandbox.insertBefore(pureAirStartButton, sandbox.querySelector("#sbStart"));
pureAirStartButton.onclick = () => {
  pureAirCombatStart = true;
  airScenarioInput.checked = true;
  airPresetInput.value = "fighter";
  wave2Select.value = "NONE";
  const start = sandbox.querySelector("#sbStart") as HTMLButtonElement;
  start.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  start.click();
};

const airScenarioContext = createAirScenarioContext(() => {
  const blueVelocity = new THREE.Vector3(
    Math.cos(defender.rotation.y) * shipSpeedKnots * 0.005144,
    0,
    -Math.sin(defender.rotation.y) * shipSpeedKnots * 0.005144,
  );
  const redShip: TargetableEntity | null = enemyPlatform
    ? createShipTarget({
        id: "red-surface-ship",
        side: "red",
        position: enemyPlatform.model.position,
        velocity: enemyPlatform.velocity,
        radarCrossSection: enemyPlatform.definition.radarCrossSection,
        alive: !enemyPlatform.destroyed,
        applyDamage: (damage) => {
          if (!enemyPlatform) return;
          enemyPlatform.hullIntegrity = Math.max(
            0,
            enemyPlatform.hullIntegrity - damage,
          );
          if (enemyPlatform.hullIntegrity <= 0) enemyPlatform.destroyed = true;
        },
      })
    : null;
  return {
    bluePosition: defender.position,
    blueVelocity,
    blueRcs: activeShip.platform.radarRcs,
    blueAlive: hullIntegrity > 0,
    redShip,
    applyBlueDamage: (damage, hitPoint) => {
      hullIntegrity = Math.max(0, hullIntegrity - damage);
      airShipHits++;
      airShipDamage += damage;
      leakers++;
      createExplosion(hitPoint.clone());
      flashCombat("impact");
      const localImpact = defender.worldToLocal(hitPoint.clone()),
        zone =
          activeShip.damageModel.zones.find(
            (candidate) => localImpact.x > candidate.minX,
          ) ??
          activeShip.damageModel.zones[activeShip.damageModel.zones.length - 1],
        primary = zone.systems[airShipHits % zone.systems.length];
      damageSubsystem(
        primary,
        damage * 0.62,
        false,
        Math.atan2(-localImpact.z, localImpact.x),
      );
      log(
        `AIR-LAUNCHED MISSILE IMPACT / ${damage.toFixed(0)}% DAMAGE / ${subsystems[primary].label} PRIMARY / HULL ${hullIntegrity.toFixed(0)}%`,
      );
      phaseEl.textContent =
        hullIntegrity > 0 ? "DAMAGE CONTROL" : "SHIP DISABLED";
    },
    countermeasures: (targetId: string) => {
      if (targetId !== "blue-surface-ship") return null;
      return {
        ecmEnabled: shipEcmEnabled,
        ecmStrength: DEFAULT_SURFACE_CONFIG.shipEcmStrength,
        ecmHealth: subsystemHealth("ecm"),
        burnThroughRange: DEFAULT_SURFACE_CONFIG.shipEcmBurnThroughRange,
        decoys: chaffClouds
          .filter((cloud) => cloud.side === "ship" && cloud.rcs > 0.1)
          .map((cloud) => ({ position: cloud.position, rcs: cloud.rcs })),
      };
    },
    requestShipCountermeasure: ({ targetId, threatPosition }) =>
      targetId === "blue-surface-ship" && deployShipChaffAt(threatPosition),
  };
});
function applyPlatformScenarioHealth(platform: EnemyPlatformInstance) {
  platform.subsystemHealth.set(
    "point-defense",
    THREE.MathUtils.clamp(numberInput("#sbOpforPointDefenseHealth"), 0, 100),
  );
  platform.subsystemHealth.set(
    "bazalt-canisters",
    THREE.MathUtils.clamp(numberInput("#sbOpforStrikeLauncherHealth"), 0, 100),
  );
  platform.subsystemHealth.set(
    "strike-control",
    THREE.MathUtils.clamp(numberInput("#sbOpforFireControlHealth"), 0, 100),
  );
  platform.subsystemHealth.set(
    "electronic-warfare",
    THREE.MathUtils.clamp(numberInput("#sbOpforEcmHealth"), 0, 100),
  );
  platform.subsystemHealth.set(
    "countermeasures",
    THREE.MathUtils.clamp(numberInput("#sbOpforDecoyHealth"), 0, 100),
  );
  platform.subsystemHealth.set(
    "damage-control",
    THREE.MathUtils.clamp(numberInput("#sbOpforDamageControlHealth"), 0, 100),
  );
}
const pickPlacement = document.createElement("button");
pickPlacement.textContent = "PICK FORMATION CENTER ON RADAR";
pickPlacement.style.cssText =
  "margin-top:12px;width:100%;border:1px solid #547d82;background:#0a2229;color:#9fd3d1;padding:8px;cursor:pointer";
sandbox.insertBefore(pickPlacement, sandbox.querySelector("#sbStart"));
pickPlacement.onclick = () => {
  placementMode = "enemy";
  pickPlacement.textContent = "CLICK TACTICAL RADAR...";
};
const pickShip = document.createElement("button");
pickShip.id = "pickShip";
pickShip.textContent = `PICK ${activeShip.name} ON RADAR`;
pickShip.style.cssText = pickPlacement.style.cssText;
sandbox.insertBefore(pickShip, sandbox.querySelector("#sbStart"));
pickShip.onclick = () => {
  placementMode = "ship";
  pickShip.textContent = "CLICK TACTICAL RADAR...";
};
const patternWrap = document.createElement("label");
patternWrap.innerHTML =
  'LAUNCH PATTERN<select id="sbPattern"><option value="RIPPLE">RIPPLE / ONE BY ONE</option><option value="SALVO">SALVO / SIMULTANEOUS</option><option value="WAVES">WAVES / GROUPS OF FOUR</option></select>';
patternWrap.style.cssText = "display:block;margin-top:12px";
sandbox.insertBefore(patternWrap, pickPlacement);
const patternSelect = patternWrap.querySelector("select") as HTMLSelectElement;
patternSelect.style.cssText =
  "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px";
patternSelect.remove(2);
patternSelect.onchange = () => {
  if (patternSelect.value === "SALVO")
    (sandbox.querySelector("#sbInterval") as HTMLInputElement).value = "0";
};
sandbox.style.height = "570px";
const sandboxGrid = sandbox.querySelector('div[style*="grid"]')!;
for (const [label, id, value] of [
  ["SHIP X", "sbShipX", "0"],
  ["SHIP Z", "sbShipZ", "40"],
]) {
  const field = document.createElement("label");
  field.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.type = "number";
  input.value = value;
  input.style.cssText =
    "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px";
  field.appendChild(input);
  sandboxGrid.appendChild(field);
}
sandbox.style.height = "640px";
const shipField = document.createElement("label"),
  shipOptions = SHIP_CATALOG.map(
    (ship) =>
      `<option value="${ship.id}">${ship.name} / ${ship.hullNumber} / ${ship.launcher.displayName}</option>`,
  ).join("");
shipField.innerHTML = `DEFENDING SHIP<select id="sbShip">${shipOptions}</select>`;
const shipSelect = shipField.querySelector("select") as HTMLSelectElement;
const platformField = document.createElement("label");
platformField.innerHTML = `ATTACK ORIGIN<select id="sbPlatform"><option value="AIRBORNE">AIRBORNE FORMATION / LEGACY</option>${ENEMY_PLATFORM_DEFINITIONS.map((platform) => `<option value="${platform.id}">${platform.name} / ${platform.className}</option>`).join("")}</select>`;
const platformSelect = platformField.querySelector(
  "select",
) as HTMLSelectElement;
const sandboxWeaponSelect = sandbox.querySelector(
  "#sbWeapon",
) as HTMLSelectElement;
function syncWeaponOptions() {
  sandboxWeaponSelect.replaceChildren(
    ...activeShip.launcher.compatibleWeapons.map((weapon) => {
      const option = document.createElement("option");
      option.value = option.textContent = weapon;
      return option;
    }),
  );
  selectedWeapon = activeShip.launcher.compatibleWeapons[0];
  sandboxWeaponSelect.value = selectedWeapon;
}
syncWeaponOptions();
shipSelect.style.cssText =
  "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px";
platformSelect.style.cssText = shipSelect.style.cssText;
sandboxGrid.insertBefore(shipField, sandboxGrid.firstChild);
sandboxGrid.insertBefore(platformField, shipField.nextSibling);
function syncPlatformThreatOptions() {
  const selection = platformSelect.value as EnemyPlatformType | "AIRBORNE";
  if (selection !== "AIRBORNE") {
    const range = getEnemyPlatformDefinition(selection).defaultScenarioRange;
    (sandbox.querySelector("#sbX") as HTMLInputElement).value = String(
      numberInput("#sbShipX"),
    );
    (sandbox.querySelector("#sbZ") as HTMLInputElement).value = String(
      numberInput("#sbShipZ") - range,
    );
  }
  const compatible =
    selection === "AIRBORNE"
      ? THREAT_DEFINITIONS.map((definition) => definition.id)
      : getEnemyPlatformDefinition(selection).weaponSlots.flatMap((slot) => [
          ...slot.compatibleThreats,
        ]);
  const threatSelector = sandbox.querySelector("#sbType") as HTMLSelectElement;
  const previous = threatSelector.value as EnemyType;
  threatSelector.replaceChildren(
    ...compatible.map((id) => {
      const option = document.createElement("option");
      option.value = option.textContent = id;
      return option;
    }),
  );
  const next = compatible.includes(previous) ? previous : compatible[0];
  threatSelector.value = next;
  const secondWaveSelector = sandbox.querySelector(
    "#sbType2",
  ) as HTMLSelectElement | null;
  if (secondWaveSelector)
    secondWaveSelector.replaceChildren(
      Object.assign(document.createElement("option"), {
        value: "NONE",
        textContent: "NONE",
      }),
      ...compatible.map((id) =>
        Object.assign(document.createElement("option"), {
          value: id,
          textContent: id,
        }),
      ),
    );
  const definition = getThreatDefinition(next);
  (sandbox.querySelector("#sbAltitude") as HTMLInputElement).value = String(
    definition.profile.cruiseAltitude,
  );
  if (selection !== "AIRBORNE") {
    const platform = getEnemyPlatformDefinition(selection);
    const capacity = platform.weaponSlots.reduce(
      (total, slot) => total + slot.capacity,
      0,
    );
    const countInput = sandbox.querySelector("#sbCount") as HTMLInputElement;
    countInput.max = String(capacity);
    countInput.value = String(
      Math.min(capacity, Math.max(1, Number(countInput.value))),
    );
  } else {
    (sandbox.querySelector("#sbCount") as HTMLInputElement).max = "24";
  }
}
platformSelect.onchange = syncPlatformThreatOptions;
// The default sandbox path should exercise the platform-vs-ship battle.
platformSelect.value = ENEMY_PLATFORM_DEFINITIONS[0]?.id ?? "AIRBORNE";
syncPlatformThreatOptions();
shipSelect.onchange = () => {
  configureShip(shipSelect.value as ShipClass);
  syncWeaponOptions();
  const defaults = activeShip.ammo;
  (sandbox.querySelector("#sbRim") as HTMLInputElement).value = String(
    defaults.rim67,
  );
  (sandbox.querySelector("#sbSm2") as HTMLInputElement).value = String(
    defaults.sm2mr,
  );
  (sandbox.querySelector("#sbSm2er") as HTMLInputElement).value = String(
    defaults.sm2er,
  );
  (sandbox.querySelector("#sbCiws") as HTMLInputElement).value = String(
    defaults.ciws,
  );
  (sandbox.querySelector("#sbHarpoon") as HTMLInputElement).value = String(
    activeShip.surfaceStrike?.magazine ?? 0,
  );
  (sandbox.querySelector("#sbChannels") as HTMLInputElement).value = String(
    defaults.channels,
  );
  (sandbox.querySelector("#sbIlluminators") as HTMLInputElement).value = String(
    defaults.illuminators,
  );
  (sandbox.querySelector("#sbLauncherFwdHealth") as HTMLInputElement).value =
    "100";
  (sandbox.querySelector("#sbLauncherAftHealth") as HTMLInputElement).value =
    "100";
  (
    sandbox.querySelector("#sbOpforPointDefenseHealth") as HTMLInputElement
  ).value = "100";
  (
    sandbox.querySelector("#sbOpforStrikeLauncherHealth") as HTMLInputElement
  ).value = "100";
  (
    sandbox.querySelector("#sbOpforFireControlHealth") as HTMLInputElement
  ).value = "100";
  (sandbox.querySelector("#sbOpforEcmHealth") as HTMLInputElement).value =
    "100";
  (sandbox.querySelector("#sbOpforDecoyHealth") as HTMLInputElement).value =
    "100";
  (
    sandbox.querySelector("#sbOpforDamageControlHealth") as HTMLInputElement
  ).value = "100";
};
for (const [label, id, value, max] of [
  ["RIM-67 MAGAZINE", "sbRim", String(activeShip.ammo.rim67), "48"],
  ["SM-2MR MAGAZINE", "sbSm2", String(activeShip.ammo.sm2mr), "96"],
  ["SM-2ER MAGAZINE", "sbSm2er", String(activeShip.ammo.sm2er), "64"],
  ["CIWS ROUNDS", "sbCiws", String(activeShip.ammo.ciws), "6000"],
  [
    "RGM-84 HARPOON MAGAZINE",
    "sbHarpoon",
    String(activeShip.surfaceStrike?.magazine ?? 0),
    "16",
  ],
]) {
  const field = document.createElement("label");
  field.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.type = "number";
  input.min = "0";
  input.max = max;
  input.value = value;
  input.style.cssText =
    "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px";
  field.appendChild(input);
  sandboxGrid.appendChild(field);
}
sandbox.style.height = "810px";
const channelField = document.createElement("label");
channelField.textContent = "SAM FIRE CHANNELS";
const channelInput = document.createElement("input");
channelInput.id = "sbChannels";
channelInput.type = "number";
channelInput.min = "1";
channelInput.max = "8";
channelInput.value = "3";
channelInput.style.cssText =
  "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px";
channelField.appendChild(channelInput);
sandboxGrid.appendChild(channelField);
const illuminatorField = document.createElement("label");
illuminatorField.textContent = "TERMINAL ILLUMINATORS";
const illuminatorInput = channelInput.cloneNode() as HTMLInputElement;
illuminatorInput.id = "sbIlluminators";
illuminatorInput.max = "4";
illuminatorInput.value = "2";
illuminatorField.appendChild(illuminatorInput);
sandboxGrid.appendChild(illuminatorField);
for (const [label, id] of [
  ["FWD LAUNCHER HEALTH", "sbLauncherFwdHealth"],
  ["AFT LAUNCHER HEALTH", "sbLauncherAftHealth"],
  ["OPFOR POINT DEFENSE HEALTH", "sbOpforPointDefenseHealth"],
  ["OPFOR STRIKE LAUNCHER HEALTH", "sbOpforStrikeLauncherHealth"],
  ["OPFOR FIRE CONTROL HEALTH", "sbOpforFireControlHealth"],
  ["OPFOR ECM HEALTH", "sbOpforEcmHealth"],
  ["OPFOR DECOY LAUNCHER HEALTH", "sbOpforDecoyHealth"],
  ["OPFOR DAMAGE CONTROL HEALTH", "sbOpforDamageControlHealth"],
]) {
  const field = document.createElement("label");
  field.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.type = "number";
  input.min = "0";
  input.max = "100";
  input.value = "100";
  input.style.cssText = channelInput.style.cssText;
  field.appendChild(input);
  sandboxGrid.appendChild(field);
}
const wave2Type = document.createElement("label");
wave2Type.innerHTML = `SECOND WAVE TYPE<select id="sbType2"><option value="NONE">NONE</option>${threatOptions}</select>`;
const wave2Select = wave2Type.querySelector("select") as HTMLSelectElement;
wave2Select.style.cssText =
  "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px";
sandboxGrid.appendChild(wave2Type);
for (const [label, id, value, max] of [
  ["SECOND WAVE COUNT", "sbCount2", "4", "12"],
  ["SECOND WAVE DELAY", "sbDelay2", "10", "60"],
]) {
  const field = document.createElement("label");
  field.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.type = "number";
  input.min = "0";
  input.max = max;
  input.value = value;
  input.style.cssText =
    "display:block;width:100%;margin-top:6px;background:#0a252d;border:1px solid #315f63;color:#d5edf0;padding:7px";
  field.appendChild(input);
  sandboxGrid.appendChild(field);
}
sandbox.style.height = "950px";
sandbox.style.maxHeight = "calc(100vh - 48px)";
sandbox.style.overflowY = "auto";
sandbox.style.boxSizing = "border-box";
const presets = document.createElement("div");
presets.style.cssText =
  "display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px";
sandbox.insertBefore(presets, patternWrap);
function presetButton(
  text: string,
  kind: EnemyType,
  count: number,
  interval: number,
  altitude: number,
  spread: number,
  range: number,
) {
  const b = document.createElement("button");
  b.textContent = text;
  b.style.cssText =
    "flex:1;border:1px solid #3d6f73;background:#09232a;color:#9fd3d1;padding:7px;font-size:9px;cursor:pointer";
  b.onclick = () => {
    platformSelect.value = "AIRBORNE";
    syncPlatformThreatOptions();
    (sandbox.querySelector("#sbType") as HTMLSelectElement).value = kind;
    (sandbox.querySelector("#sbCount") as HTMLInputElement).value =
      String(count);
    (sandbox.querySelector("#sbInterval") as HTMLInputElement).value =
      String(interval);
    (sandbox.querySelector("#sbAltitude") as HTMLInputElement).value =
      String(altitude);
    (sandbox.querySelector("#sbSpread") as HTMLInputElement).value =
      String(spread);
    (sandbox.querySelector("#sbZ") as HTMLInputElement).value = String(-range);
  };
  presets.appendChild(b);
}
for (const definition of THREAT_DEFINITIONS) {
  const preset = definition.preset;
  presetButton(
    preset.label,
    definition.id,
    preset.count,
    preset.interval,
    preset.altitude,
    preset.spread,
    preset.range,
  );
}
const threatSelect = sandbox.querySelector("#sbType") as HTMLSelectElement;
threatSelect.onchange = () => {
  const profile = incomingProfiles[threatSelect.value as EnemyType];
  (sandbox.querySelector("#sbAltitude") as HTMLInputElement).value = String(
    profile.cruiseAltitude,
  );
  (sandbox.querySelector("#sbZ") as HTMLInputElement).value = String(
    platformSelect.value === "AIRBORNE"
      ? -profile.defaultRange
      : numberInput("#sbShipZ") -
          getEnemyPlatformDefinition(platformSelect.value as EnemyPlatformType)
            .defaultScenarioRange,
  );
};
radarCanvas.addEventListener("pointerdown", (e) => {
  if (!placementMode) return;
  e.stopPropagation();
  const rect = radarCanvas.getBoundingClientRect(),
    px = ((e.clientX - rect.left) / rect.width) * radarCanvas.width,
    py = ((e.clientY - rect.top) / rect.height) * radarCanvas.height,
    x = Math.round((px - radarCanvas.width / 2) / RADAR_PIXELS_PER_WORLD_UNIT),
    z = Math.round((py - radarCanvas.height / 2) / RADAR_PIXELS_PER_WORLD_UNIT);
  if (placementMode === "ship") {
    (sandbox.querySelector("#sbShipX") as HTMLInputElement).value = String(x);
    (sandbox.querySelector("#sbShipZ") as HTMLInputElement).value = String(z);
    pickShip.textContent = `SHIP SET / X ${x} / Z ${z}`;
  } else {
    (sandbox.querySelector("#sbX") as HTMLInputElement).value = String(x);
    (sandbox.querySelector("#sbZ") as HTMLInputElement).value = String(z);
    pickPlacement.textContent = `CENTER SET / X ${x} / Z ${z}`;
  }
  placementMode = false;
});
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "pointerdown",
  (event) => {
    if (event.isTrusted) pureAirCombatStart = false;
    missiles.forEach((m) => {
      const line = m.mesh.userData.seekerLine as THREE.Line | undefined;
      if (line) {
        scene.remove(line);
        line.geometry.dispose();
      }
    });
  },
  true,
);
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "pointerdown",
  () => {
    if (aarReplayTimer !== undefined) clearInterval(aarReplayTimer);
    aarReplayTimer = undefined;
    aarSnapshots = [];
    aarEvents = [];
    nextAarSnapshot = 0;
    resultPanel.style.display = "none";
  },
  true,
);
(sandbox.querySelector("#sbStart") as HTMLButtonElement).onclick = async () => {
  if (webGpuUltraInput.checked && webGpuUltraStatus !== "active")
    await configureWebGpuUltra(true);
  highQualityEnvironmentEnabled = highQualityEnvironmentInput.checked;
  highQualityEnvironment.setEnabled(highQualityEnvironmentEnabled);
  cinematicAtmospherePass.enabled = highQualityEnvironmentEnabled;
  ocean.setHighQuality(highQualityEnvironmentEnabled);
  ssaoPass.enabled = !highQualityEnvironmentEnabled && innerWidth > 720;
  gtaoPass.enabled = highQualityEnvironmentEnabled;
  scene.environment = highQualityEnvironmentEnabled ? bouncedLightEnvironment : null;
  scene.environmentIntensity = highQualityEnvironmentEnabled ? 0.28 : 1;
  renderer.toneMappingExposure = highQualityEnvironmentEnabled ? 1.08 : 1.08;
  bloomPass.strength = highQualityEnvironmentEnabled ? 0.48 : 0.42;
  bloomPass.radius = highQualityEnvironmentEnabled ? 0.42 : 0.38;
  bloomPass.threshold = highQualityEnvironmentEnabled ? 1.08 : 0.78;
  ambientSky.intensity = highQualityEnvironmentEnabled ? 1.12 : 1.55;
  ambientSky.color.setHex(highQualityEnvironmentEnabled ? 0x9dc9e8 : 0x9cc7dd);
  ambientSky.groundColor.setHex(highQualityEnvironmentEnabled ? 0x17232a : 0x10212b);
  sun.intensity = highQualityEnvironmentEnabled ? 3.45 : 2.5;
  sun.color.setHex(highQualityEnvironmentEnabled ? 0xffd09a : 0xffe3ad);
  sun.position.copy(AFTERNOON_SUN_DIRECTION).multiplyScalar(360);
  atmosphericFill.intensity = highQualityEnvironmentEnabled ? 0.62 : 0;
  scene.fog = highQualityEnvironmentEnabled
    ? new THREE.FogExp2(0x8298a4, 0.00072)
    : new THREE.Fog(0x06111b, 180, 900);
  scene.background = highQualityEnvironmentEnabled ? null : new THREE.Color(0x06111b);
  missiles.forEach((m) => {
    scene.remove(m.mesh, m.path);
    m.path.geometry.dispose();
  });
  missiles.length = 0;
  airDefenseTargets.clear();
  airDefenseHardKills.clear();
  for (const missile of surfaceStrikeMissiles) {
    scene.remove(missile.mesh, missile.path);
    missile.path.geometry.dispose();
  }
  surfaceStrikeMissiles.length = 0;
  surfaceLaunchQueue.length = 0;
  surfacePicture.reset();
  resetSurfaceStrikeLoadout();
  surfaceHits = 0;
  surfaceHardKills = 0;
  surfaceSoftKills = 0;
  surfacePointDefenseKills = 0;
  surfaceMisses = 0;
  surfaceProgressiveDamage = 0;
  if (enemyPlatform) {
    scene.remove(enemyPlatform.model);
    disposeEnemyPlatform(enemyPlatform);
    enemyPlatform = null;
  }
  platformFirePlan = null;
  interceptors.forEach((i) => scene.remove(i.mesh));
  interceptors.length = 0;
  combatPicture.reset();
  lastTrackClasses.clear();
  lastAltitudeState.clear();
  explodedTargets.clear();
  explosions.forEach((e) => scene.remove(e.core, e.ring, e.light));
  explosions.length = 0;
  shipDamageEffects.forEach((effect) => effect.group.removeFromParent());
  shipDamageEffects.length = 0;
  boosterDebris.forEach((debris) => scene.remove(debris.mesh, debris.light));
  boosterDebris.length = 0;
  (defender.userData.hullMat as THREE.MeshStandardMaterial).color.set(
    activeShip.hullColor,
  );
  subsystemList.forEach((system) => (system.health = 100));
  fixedSensorFaceHealth()?.fill(1);
  updateSubsystemPanel();
  elapsed = 0;
  last = performance.now();
  ammo = activeShip.ammo.rim67;
  sm2Ammo = activeShip.ammo.sm2mr;
  sm2erAmmo = activeShip.ammo.sm2er;
  hullIntegrity = 100;
  airShipHits = 0;
  airShipDamage = 0;
  ciwsRounds = activeShip.ammo.ciws;
  missionEnded = false;
  selectedWeapon = (sandbox.querySelector("#sbWeapon") as HTMLSelectElement)
    .value as WeaponType;
  const kind = (sandbox.querySelector("#sbType") as HTMLSelectElement)
      .value as EnemyType,
    requestedCount = Math.max(1, Math.min(24, numberInput("#sbCount"))),
    interval = Math.max(0, numberInput("#sbInterval")),
    altitude = numberInput("#sbAltitude"),
    cx = numberInput("#sbX"),
    cz = numberInput("#sbZ"),
    spread = numberInput("#sbSpread");
  const platformSelection = platformSelect.value as
    EnemyPlatformType | "AIRBORNE";
  let count = pureAirCombatStart ? 0 : requestedCount;
  if (pureAirCombatStart) {
    autoFire = false;
    ciwsEnabled = false;
    log("PURE AIR COMBAT / SURFACE WEAPONS HOLD / SHIPS OBSERVATION ONLY");
  } else if (platformSelection === "AIRBORNE") {
    autoFire = DEFAULT_SURFACE_CONFIG.autoFire;
    ciwsEnabled = true;
    for (let index = 0; index < count; index++) {
      const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
      addMissile(
        new THREE.Vector3(
          cx + offset,
          altitude + Math.sin(index) * Math.min(0.2, altitude * 0.08),
          cz - Math.abs(offset) * 0.12,
        ),
        kind,
        index * interval,
      );
    }
  } else {
    const definition = getEnemyPlatformDefinition(platformSelection);
    const heading = Math.atan2(
      -(defender.position.z - cz),
      defender.position.x - cx,
    );
    enemyPlatform = instantiateEnemyPlatform(
      definition,
      new THREE.Vector3(cx, 0, cz),
      heading,
    );
    enemyPlatform.model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    scene.add(enemyPlatform.model);
    applyPlatformScenarioHealth(enemyPlatform);
    const weaponSlot = definition.weaponSlots.find((slot) =>
      slot.compatibleThreats.includes(kind),
    );
    if (weaponSlot?.salvoDoctrine) {
      platformFirePlan = {
        platform: enemyPlatform,
        threat: kind,
        authorizedWeapons: Math.min(requestedCount, weaponSlot.capacity),
        committedWeapons: 0,
        requestedInterval: interval,
        wave: 0,
        assessmentReadyAt: 0,
        assessmentPending: false,
        lastAssessment: null,
        completed: false,
        reinforcements: [],
      };
      commitPlatformFirePlanWave(platformFirePlan, true);
      count = platformFirePlan.committedWeapons;
    } else {
      const reservations = reservePlatformLaunches(
        enemyPlatform,
        kind,
        requestedCount,
        0,
        interval,
      );
      count = reservations.length;
      for (const reservation of reservations)
        addMissile(
          reservationOrigin(reservation),
          kind,
          reservation.launchAt,
          reservation,
        );
    }
    log(
      `ENEMY PLATFORM / ${definition.name} / ${definition.className} / ${count} FIRST-WAVE SLOTS RESERVED${platformFirePlan ? ` / ${platformFirePlan.authorizedWeapons} WEAPONS AUTHORIZED` : ""}`,
    );
  }
  airCombat.enabled = airScenarioInput.checked;
  if (airCombat.enabled) {
    const context = airScenarioContext();
    const presetId = airPresetInput.value as AirScenarioPresetId;
    airCombat.reset(
      context.blueShip,
      context.redShip,
      airScenarioSpawns(
        presetId,
        new URLSearchParams(location.search).get("shortAirValidation") === "1",
      ),
    );
    airCombat.countermeasuresEnabled =
      new URLSearchParams(location.search).get("airCountermeasures") !== "off";
    log(
      `AIR OPERATIONS / ${AIR_SCENARIO_PRESETS[presetId].description.toUpperCase()}`,
    );
  }
  updateMaterialDiagnostics();
  selectedTargetId = 1;
  searchWidth = 360;
  combatPicture.setSearch(
    360,
    Math.atan2(cx - numberInput("#sbShipX"), cz - numberInput("#sbShipZ")),
  );
  searchButton.textContent = "SEARCH: 360 DEG";
  slewButton.textContent = "SLEW: SELECTED";
  const initialMissile = missiles[0];
  if (initialMissile) initialMissile.mesh.userData.selection.visible = true;
  weaponButton.textContent = `WEAPON: ${selectedWeapon}`;
  ammoEl.textContent = `RIM ${ammo} / MR ${sm2Ammo} / ER ${sm2erAmmo}`;
  sandbox.style.display = "none";
  running = true;
  log(
    `SANDBOX START / ${activeShip.hullNumber} / ${count} x ${kind} INITIAL${platformFirePlan ? ` / AUTH ${platformFirePlan.authorizedWeapons}` : ""} / ${interval}s INTERVAL / ${platformSelection}`,
  );
};
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "pointerdown",
  () => {
    interceptors.forEach((i) => {
      i.illuminationBeam.visible = false;
      scene.remove(i.illuminationBeam, i.guidancePath);
      i.guidancePath.geometry.dispose();
    });
    illuminators.forEach((state, index) => {
      state.target = null;
      state.lastTargetId = 0;
      state.azimuth = index < 2 ? 0 : Math.PI;
    });
    explosions.forEach((e) => scene.remove(e.core, e.ring, e.light));
    engagements.clear();
    simAccumulator = 0;
    nextSamLaunch = 0;
    leakers = 0;
    launcherCycle = 0;
    resetMk10Launchers();
    resetVlsCells();
    const x = numberInput("#sbShipX"),
      z = numberInput("#sbShipZ");
    defender.position.set(x, 0, z);
    wake.position.set(x - 28, 0.22, z);
  },
  true,
);
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "pointerdown",
  () => {
    shipSpeedKnots = 0;
    shipDesiredHeading = 0;
    shipCommandedSpeedKnots = activeShip.platform.patrolSpeedKnots;
    shipManeuverMode = "patrol";
    nextShipDecision = 0;
    shipManeuverThreatId = 0;
    defender.rotation.y = 0;
    wake.rotation.y = 0;
    wakeLineMat.opacity = 0.08;
  },
  true,
);
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "pointerdown",
  () => {
    chaffClouds.forEach((c) => scene.remove(c.mesh));
    chaffClouds.length = 0;
    srbocRoundsInFlight.forEach((round) =>
      scene.remove(round.mesh, round.trail),
    );
    srbocRoundsInFlight.length = 0;
    chaffSerial = 0;
    srbocRounds = 12;
    lastSrboc = -20;
  },
  true,
);
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "pointerdown",
  () => {
    vlsLaunchEffects.forEach((effect) => scene.remove(effect.group));
    vlsLaunchEffects.length = 0;
  },
  true,
);
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "click",
  () =>
    setTimeout(() => {
      const requestedRim = Math.max(0, Math.min(48, numberInput("#sbRim"))),
        requestedMr = Math.max(0, Math.min(96, numberInput("#sbSm2"))),
        requestedEr = Math.max(0, Math.min(64, numberInput("#sbSm2er")));
      if (activeShip.launcher.kind === "mk41") {
        const loaded = configureVlsLoadout(requestedMr, requestedEr);
        ammo = 0;
        sm2Ammo = loaded.mr;
        sm2erAmmo = loaded.er;
        if (selectedWeapon === "RIM-67") {
          selectedWeapon = sm2Ammo > 0 ? "SM-2MR" : "SM-2ER";
          weaponButton.textContent = `WEAPON: ${selectedWeapon}`;
        }
        log(
          `MK 41 LOAD PLAN / ${loaded.mr} SM-2MR / ${loaded.er} SM-2ER / ${loaded.other} OTHER CELLS`,
        );
      } else {
        ammo = requestedRim;
        sm2Ammo = requestedMr;
        sm2erAmmo = requestedEr;
      }
      const forwardHealth = THREE.MathUtils.clamp(
          numberInput("#sbLauncherFwdHealth"),
          0,
          100,
        ),
        aftHealth = THREE.MathUtils.clamp(
          numberInput("#sbLauncherAftHealth"),
          0,
          100,
        );
      if (forwardHealth < 100)
        damageSubsystem("forwardLauncher", 100 - forwardHealth);
      if (aftHealth < 100) damageSubsystem("aftLauncher", 100 - aftHealth);
      ciwsRounds = Math.max(0, Math.min(6000, numberInput("#sbCiws")));
      surfaceStrikeAmmo = Math.max(
        0,
        Math.min(surfaceHardpointState.size, numberInput("#sbHarpoon")),
      );
      maxSamChannels = Math.max(1, Math.min(8, numberInput("#sbChannels")));
      maxIlluminators = Math.max(
        1,
        Math.min(4, numberInput("#sbIlluminators")),
      );
      ammoEl.textContent = `RIM ${ammo} / MR ${sm2Ammo} / ER ${sm2erAmmo}`;
    }, 0),
);
(sandbox.querySelector("#sbStart") as HTMLButtonElement).addEventListener(
  "click",
  () =>
    setTimeout(() => {
      const kind2 = wave2Select.value as EnemyType | "NONE";
      if (kind2 === "NONE") return;
      const count = Math.max(0, Math.min(12, numberInput("#sbCount2"))),
        delay = Math.max(0, numberInput("#sbDelay2")),
        cx = numberInput("#sbX"),
        cz = numberInput("#sbZ"),
        altitude = numberInput("#sbAltitude"),
        spread = numberInput("#sbSpread");
      if (enemyPlatform) {
        if (platformFirePlan && platformFirePlan.threat === kind2) {
          platformFirePlan.reinforcements.push({ availableAt: delay, count });
          log(
            `SECOND WAVE AUTHORIZATION / ${count} x ${kind2} / ${enemyPlatform.definition.name} / T+${delay}s`,
          );
          return;
        }
        const reservations = reservePlatformLaunches(
          enemyPlatform,
          kind2,
          count,
          delay,
          0.6,
        );
        for (const reservation of reservations)
          addMissile(
            reservationOrigin(reservation),
            kind2,
            reservation.launchAt,
            reservation,
          );
        log(
          `SECOND WAVE / ${reservations.length} x ${kind2} / ${enemyPlatform.definition.name} REMAINING SLOTS / T+${delay}s`,
        );
        return;
      }
      for (let i = 0; i < count; i++) {
        const offset =
          count === 1 ? 0 : (i / (count - 1) - 0.5) * spread * 0.75;
        addMissile(
          new THREE.Vector3(
            cx + offset,
            incomingProfiles[kind2].trajectory === "high-altitude"
              ? Math.max(45, altitude)
              : altitude,
            cz - 50,
          ),
          kind2,
          delay + i * 0.6,
        );
      }
      log(`SECOND WAVE / ${count} x ${kind2} / T+${delay}s`);
    }, 0),
);
function classifyAarEvent(text: string): AarCategory {
  if (/POINT DEFENSE FIRE/.test(text)) return "fire";
  if (
    /INTERCEPT|SOFT KILL|SURFACE KILL|POINT DEFENSE|PENETRATION|INTERNAL DETONATION|HARPOON HIT|IMPACT|CIWS KILL|MISS|DAMAGED|DEGRADED|CRITICAL|DESTROYED|FRAGMENTATION|DAMAGE ISOLATION|ROUND[S]? TRAPPED/.test(
      text,
    )
  )
    return "effect";
  if (/LAUNCH|CIWS WINDOW|SRBOC/.test(text)) return "fire";
  if (/OODA MANEUVER/.test(text)) return "maneuver";
  if (/SEEKER|DATALINK|FIRE CONTROL|ILLUMIN|CHAFF|ECM|LOCK TRANSFER/.test(text))
    return "guidance";
  if (/TRACK|RADAR|SENSOR|CORRELATION/.test(text)) return "sensor";
  return "system";
}
function captureAarSnapshot(force = false) {
  if (!force && elapsed + 1e-6 < nextAarSnapshot) return;
  const headingFromVelocity = (velocity: THREE.Vector3) =>
    velocity.lengthSq() > 1e-6 ? Math.atan2(velocity.x, -velocity.z) : 0;
  const kinematics = (
    position: THREE.Vector3,
    velocity: THREE.Vector3,
  ) => ({
    x: position.x,
    y: position.y,
    z: position.z,
    heading: headingFromVelocity(velocity),
    pitch: Math.atan2(velocity.y, Math.hypot(velocity.x, velocity.z)),
    // Render models carry asset-axis correction rotations which are not flight attitude.
    roll: 0,
    speed: velocity.length() * 100,
    verticalSpeed: velocity.y * 50,
  });
  const shipVelocity = new THREE.Vector3(1, 0, 0)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), defender.rotation.y)
    .multiplyScalar(shipSpeedKnots * 0.005144);
  const snapshot: AarSnapshot = {
    time: elapsed,
    ship: {
      ...kinematics(defender.position, shipVelocity),
      heading: defender.rotation.y,
      hull: hullIntegrity,
    },
    missiles: missiles
      .filter((m) => elapsed >= m.launchAt)
      .map((m, id) => ({
        id: id + 1,
        ...kinematics(m.mesh.position, m.velocity),
        phase: m.phase,
        threatType: m.threatType,
      })),
    interceptors: interceptors
      .map((i, id) => ({ i, id }))
      .filter((x) => x.i.mesh.visible)
      .map((x) => ({
        id: x.id + 1,
        ...kinematics(x.i.mesh.position, x.i.velocity),
        weapon: x.i.weapon,
        targetId: defenseSourceForTarget(x.i.target),
      })),
    chaff: chaffClouds.map((c, id) => ({
      id: c.serial || id + 1,
      ...kinematics(c.position, c.velocity),
      side: c.side,
    })),
    enemyPlatform: enemyPlatform
      ? {
          ...kinematics(enemyPlatform.model.position, enemyPlatform.velocity),
          heading: enemyPlatform.model.rotation.y,
          hull: enemyPlatform.hullIntegrity,
          destroyed: enemyPlatform.destroyed,
          name: enemyPlatform.definition.name,
        }
      : null,
    surfaceStrikes: surfaceStrikeMissiles.map((missile) => ({
      id: missile.id,
      ...kinematics(missile.mesh.position, missile.velocity),
      phase: missile.phase,
      targetId: "red-surface-ship",
    })),
    aircraft: airCombat.aircraft.map((aircraft) => ({
      id: aircraft.id,
      name: aircraft.definition.name,
      side: aircraft.side,
      ...kinematics(aircraft.position, aircraft.velocity),
      state: aircraft.state,
      mission: aircraft.mission,
      alive: aircraft.alive,
      structure: aircraft.subsystemHealth.get("structure") ?? 0,
    })),
    airWeapons: airCombat.missiles.map((missile) => ({
      id: missile.id,
      name: missile.definition.name,
      side: missile.side,
      ...kinematics(missile.position, missile.velocity),
      phase: missile.phase,
      targetId: missile.targetId,
      shooterId: missile.shooterId,
    })),
    airDecoys: airCombat.decoys.map((decoy) => ({
      id: decoy.id,
      type: decoy.decoyType,
      ...kinematics(decoy.position, decoy.velocity),
      alive: decoy.alive,
      side: decoy.side,
    })),
  };
  if (
    force &&
    aarSnapshots.length &&
    Math.abs(aarSnapshots[aarSnapshots.length - 1].time - elapsed) < 0.01
  )
    aarSnapshots[aarSnapshots.length - 1] = snapshot;
  else aarSnapshots.push(snapshot);
  nextAarSnapshot = elapsed + 0.25;
}
function aarTime(time: number) {
  return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(Math.floor(time % 60)).padStart(2, "0")}.${Math.floor((time % 1) * 10)}`;
}
function renderAarFrame(index: number) {
  const canvas = resultPanel.querySelector(
      "#aarCanvas",
    ) as HTMLCanvasElement | null,
    slider = resultPanel.querySelector("#aarSlider") as HTMLInputElement | null,
    label = resultPanel.querySelector("#aarTime") as HTMLElement | null;
  if (!canvas || !slider || !label || !aarSnapshots.length) return;
  index = THREE.MathUtils.clamp(Math.round(index), 0, aarSnapshots.length - 1);
  slider.value = String(index);
  const snapshot = aarSnapshots[index],
    ctx = canvas.getContext("2d")!,
    w = canvas.width,
    h = canvas.height,
    points = aarSnapshots.flatMap((s) => [
      { x: s.ship.x, z: s.ship.z },
      ...s.missiles,
      ...s.interceptors,
      ...s.surfaceStrikes,
      ...(s.enemyPlatform ? [s.enemyPlatform] : []),
    ]),
    minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minZ = Math.min(...points.map((p) => p.z)),
    maxZ = Math.max(...points.map((p) => p.z)),
    spanX = Math.max(80, maxX - minX),
    spanZ = Math.max(80, maxZ - minZ),
    scale = Math.min((w - 80) / spanX, (h - 70) / spanZ),
    centerX = (minX + maxX) / 2,
    centerZ = (minZ + maxZ) / 2,
    map = (p: { x: number; z: number }) => ({
      x: w / 2 + (p.x - centerX) * scale,
      y: h / 2 + (p.z - centerZ) * scale,
    });
  ctx.fillStyle = "#06151b";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(77,151,153,.16)";
  ctx.lineWidth = 1;
  for (let x = 20; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 20; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const missileIds = [...new Set(snapshot.missiles.map((m) => m.id))];
  for (const id of missileIds) {
    ctx.strokeStyle = "rgba(239,100,84,.42)";
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= index; s += 2) {
      const state = aarSnapshots[s].missiles.find((m) => m.id === id);
      if (!state) continue;
      const p = map(state);
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let id = 1; id <= interceptors.length; id++) {
    ctx.strokeStyle = "rgba(112,220,239,.32)";
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= index; s += 2) {
      const state = aarSnapshots[s].interceptors.find((i) => i.id === id);
      if (!state) continue;
      const p = map(state);
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  const surfaceIds = [...new Set(snapshot.surfaceStrikes.map((m) => m.id))];
  for (const id of surfaceIds) {
    ctx.strokeStyle = "rgba(103,200,255,.42)";
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= index; s += 2) {
      const state = aarSnapshots[s].surfaceStrikes.find((m) => m.id === id);
      if (!state) continue;
      const p = map(state);
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (const cloud of snapshot.chaff) {
    const p = map(cloud);
    ctx.strokeStyle =
      cloud.side === "ship"
        ? "#71ddd7"
        : cloud.side === "platform"
          ? "#ff9f78"
          : "#e4c66f";
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const interceptor of snapshot.interceptors) {
    const p = map(interceptor);
    ctx.fillStyle = "#8de9f3";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const missile of snapshot.missiles) {
    const p = map(missile);
    ctx.strokeStyle = missile.phase === "destroyed" ? "#713f3b" : "#ef6454";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x + 5, p.y);
    ctx.lineTo(p.x, p.y + 5);
    ctx.lineTo(p.x - 5, p.y);
    ctx.closePath();
    ctx.stroke();
    if (missile.phase !== "destroyed") {
      ctx.fillStyle = "#eaa39b";
      ctx.font = "10px Consolas";
      ctx.fillText(`T${missile.id}`, p.x + 8, p.y - 7);
    }
  }
  for (const missile of snapshot.surfaceStrikes) {
    if (missile.phase === "destroyed") continue;
    const p = map(missile);
    ctx.fillStyle = "#67c8ff";
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  if (snapshot.enemyPlatform) {
    const target = map(snapshot.enemyPlatform);
    ctx.strokeStyle = snapshot.enemyPlatform.destroyed ? "#713f3b" : "#ff6758";
    ctx.lineWidth = 2;
    ctx.strokeRect(target.x - 11, target.y - 6, 22, 12);
    ctx.fillStyle = "#eaa39b";
    ctx.font = "10px Consolas";
    ctx.fillText(
      `${snapshot.enemyPlatform.name} ${Math.round(snapshot.enemyPlatform.hull)}%`,
      target.x + 14,
      target.y - 8,
    );
  }
  const ship = map(snapshot.ship),
    fx = Math.cos(snapshot.ship.heading),
    fz = -Math.sin(snapshot.ship.heading);
  ctx.fillStyle = snapshot.ship.hull > 0 ? "#69d6ce" : "#925249";
  ctx.beginPath();
  ctx.moveTo(ship.x + fx * 12, ship.y + fz * 12);
  ctx.lineTo(ship.x - fx * 7 + fz * 6, ship.y - fz * 7 - fx * 6);
  ctx.lineTo(ship.x - fx * 7 - fz * 6, ship.y - fz * 7 + fx * 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(105,214,206,.28)";
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, 20, 0, Math.PI * 2);
  ctx.stroke();
  label.textContent = `T+${aarTime(snapshot.time)} / HULL ${snapshot.ship.hull}% / ${snapshot.missiles.filter((m) => m.phase !== "destroyed").length} THREATS${snapshot.enemyPlatform ? ` / TARGET ${Math.round(snapshot.enemyPlatform.hull)}%` : ""}`;
  const eventButtons = [
    ...resultPanel.querySelectorAll<HTMLButtonElement>(".aar-event"),
  ];
  let active = -1;
  aarEvents.forEach((event, eventIndex) => {
    if (event.time <= snapshot.time + 0.01) active = eventIndex;
  });
  eventButtons.forEach((button, eventIndex) =>
    button.classList.toggle("current", eventIndex === active),
  );
  if (active >= 0) eventButtons[active]?.scrollIntoView({ block: "nearest" });
}
function showAar(outcome: string, score: number) {
  const samShots = aarEvents.filter((e) =>
      /^(RIM-67|SM-2MR|SM-2ER) .* LAUNCH/.test(e.text),
    ).length,
    hardKills = aarEvents.filter((e) =>
      / INTERCEPT |CIWS KILL/.test(e.text),
    ).length,
    softKills = aarEvents.filter((e) => /SOFT KILL/.test(e.text)).length,
    impacts = aarEvents.filter((e) => / IMPACT /.test(e.text)).length,
    harpoons = aarEvents.filter((e) =>
      /RGM-84 HARPOON SURFACE LAUNCH/i.test(e.text),
    ).length;
  resultPanel.innerHTML = `<header class="aar-top"><div><small>AFTER ACTION REVIEW / ${activeShip.name}</small><h2>${outcome}</h2></div><div class="aar-score">SCORE <b>${score}</b></div></header><div class="aar-metrics"><span>THREATS<b>${missiles.length}</b></span><span>SAM SHOTS<b>${samShots}</b></span><span>HARD KILLS<b>${hardKills}</b></span><span>SOFT KILLS<b>${softKills}</b></span><span>LEAKERS<b>${impacts}</b></span><span>HARPOONS<b>${harpoons}</b></span><span>SURFACE HITS<b>${surfaceHits}</b></span><span>PROG DAMAGE<b>${surfaceProgressiveDamage.toFixed(1)}</b></span><span>SFC MISSES<b>${surfaceMisses}</b></span><span>SFC SOFT KILLS<b>${surfaceSoftKills}</b></span><span>SFC PD KILLS<b>${surfacePointDefenseKills}</b></span><span>TARGET HULL<b>${Math.round(enemyPlatform?.hullIntegrity ?? 0)}%</b></span><span>HULL<b>${hullIntegrity}%</b></span></div><div class="aar-body"><section class="aar-replay"><div class="aar-section-head"><b>TACTICAL REPLAY</b><span id="aarTime"></span></div><canvas id="aarCanvas" width="900" height="440"></canvas><div class="aar-controls"><button id="aarStart" title="Jump to start">|&lt;</button><button id="aarPlay">PLAY</button><input id="aarSlider" type="range" min="0" max="${Math.max(0, aarSnapshots.length - 1)}" value="${Math.max(0, aarSnapshots.length - 1)}"><button id="aarEnd" title="Jump to end">&gt;|</button></div></section><aside class="aar-timeline"><div class="aar-section-head"><b>EVENT TIMELINE</b><span>${aarEvents.length} EVENTS</span></div><div id="aarEvents"></div></aside></div><footer class="aar-footer"><button id="aarExportTacview">EXPORT TACVIEW</button><button id="aarClose">CLOSE AAR</button><button id="restartMission">RESTART EXERCISE</button></footer>`;
  const eventList = resultPanel.querySelector("#aarEvents")!;
  aarEvents.forEach((event, eventIndex) => {
    const button = document.createElement("button");
    button.className = `aar-event ${event.category}`;
    button.innerHTML = `<time>${aarTime(event.time)}</time><span></span>`;
    (button.querySelector("span") as HTMLElement).textContent = event.text;
    button.onclick = () => {
      const snapshotIndex = aarSnapshots.reduce(
        (best, s, index) =>
          Math.abs(s.time - event.time) <
          Math.abs(aarSnapshots[best].time - event.time)
            ? index
            : best,
        0,
      );
      renderAarFrame(snapshotIndex);
    };
    button.dataset.index = String(eventIndex);
    eventList.appendChild(button);
  });
  const slider = resultPanel.querySelector("#aarSlider") as HTMLInputElement,
    play = resultPanel.querySelector("#aarPlay") as HTMLButtonElement;
  slider.oninput = () => renderAarFrame(Number(slider.value));
  (resultPanel.querySelector("#aarStart") as HTMLButtonElement).onclick = () =>
    renderAarFrame(0);
  (resultPanel.querySelector("#aarEnd") as HTMLButtonElement).onclick = () =>
    renderAarFrame(aarSnapshots.length - 1);
  play.onclick = () => {
    if (aarReplayTimer !== undefined) {
      clearInterval(aarReplayTimer);
      aarReplayTimer = undefined;
      play.textContent = "PLAY";
      return;
    }
    if (Number(slider.value) >= aarSnapshots.length - 1) renderAarFrame(0);
    play.textContent = "PAUSE";
    aarReplayTimer = window.setInterval(() => {
      const next = Number(slider.value) + 1;
      if (next >= aarSnapshots.length) {
        clearInterval(aarReplayTimer);
        aarReplayTimer = undefined;
        play.textContent = "PLAY";
        return;
      }
      renderAarFrame(next);
    }, 90);
  };
  (resultPanel.querySelector("#aarClose") as HTMLButtonElement).onclick =
    () => {
      if (aarReplayTimer !== undefined) clearInterval(aarReplayTimer);
      aarReplayTimer = undefined;
      resultPanel.style.display = "none";
    };
  (resultPanel.querySelector("#aarExportTacview") as HTMLButtonElement).onclick =
    exportCurrentTacview;
  (resultPanel.querySelector("#restartMission") as HTMLButtonElement).onclick =
    () => location.reload();
  resultPanel.style.display = "flex";
  renderAarFrame(aarSnapshots.length - 1);
}
function tacviewFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `coldwar-intercept-${stamp}.acmi`;
}
function exportCurrentTacview() {
  const acmi = exportTacviewAcmi(aarSnapshots, aarEvents, {
    title: `${activeShip.name} After Action Review`,
    referenceTime: new Date(),
    blueShipName: `${activeShip.name} ${activeShip.hullNumber}`,
  });
  downloadTextFile(acmi, tacviewFilename());
}
function augmentAarSubsystemSummary() {
  const metrics = resultPanel.querySelector(".aar-metrics");
  if (!metrics) return;
  const heading = resultPanel.querySelector(".aar-top small");
  if (heading) heading.textContent = `AFTER ACTION REVIEW / ${activeShip.name}`;
  const operational = subsystemList.filter(
      (system) => system.health > 5,
    ).length,
    average = Math.round(
      subsystemList.reduce((sum, system) => sum + system.health, 0) /
        subsystemList.length,
    ),
    metric = document.createElement("span");
  metric.innerHTML = `SYSTEMS<b>${operational}/${subsystemList.length} / ${average}%</b>`;
  metrics.appendChild(metric);
}
function finishMission(victory: boolean, outcomeOverride?: string) {
  if (missionEnded) return;
  missionEnded = true;
  running = false;
  captureAarSnapshot(true);
  const systemAverage =
      subsystemList.reduce((sum, system) => sum + system.health, 0) /
      subsystemList.length,
    score = Math.max(
      0,
      Math.round(
        hullIntegrity * 8 +
          systemAverage * 2 +
          ammo * 150 +
          sm2Ammo * 100 +
          ciwsRounds / 10 -
          Math.max(0, elapsed - 20) * 5,
      ),
    ),
    outcome =
      outcomeOverride ??
      (victory
        ? leakers === 0
          ? "AIRSPACE SECURED"
          : `RAID SURVIVED / ${leakers} LEAKER${leakers === 1 ? "" : "S"}`
        : `${activeShip.name} DISABLED`);
  showAar(outcome, score);
  augmentAarSubsystemSummary();
  if (tacviewAutoExportInput.checked) exportCurrentTacview();
}
function controlButton(label: string, action: () => void) {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText =
    "border:1px solid #438e91;background:#071923dd;color:#a8dddd;padding:8px 11px;font:10px Arial;letter-spacing:1px;cursor:pointer";
  b.onclick = action;
  controls.appendChild(b);
  return b;
}
const autoButton = controlButton("AUTO FIRE: ON", () => {
  autoFire = !autoFire;
  autoButton.textContent = `AUTO FIRE: ${autoFire ? "ON" : "OFF"}`;
});
const doctrineButton = controlButton("DOCTRINE: SS-L-S", () => {
  doctrine =
    doctrine === "SSLS" ? "SINGLE" : doctrine === "SINGLE" ? "DOUBLE" : "SSLS";
  doctrineButton.textContent = `DOCTRINE: ${doctrine === "SSLS" ? "SS-L-S" : doctrine}`;
  log(
    `ENGAGEMENT DOCTRINE / ${doctrine === "SSLS" ? "SHOOT-SHOOT-LOOK-SHOOT" : doctrine}`,
  );
});
const radarButton = controlButton("RADAR: ACTIVE", () => {
  radarEnabled = !radarEnabled;
  radarButton.textContent = `RADAR: ${radarEnabled ? "ACTIVE" : "SILENT"}`;
  log(radarEnabled ? "RADAR EMISSION RESTORED" : "EMCON / RADAR SILENT");
});
const opforRadarButton = controlButton("OPFOR RADAR: ACTIVE", () => {
  opforRadarEnabled = !opforRadarEnabled;
  opforRadarButton.textContent = `OPFOR RADAR: ${opforRadarEnabled ? "ACTIVE" : "SILENT"}`;
  log(`OPFOR EMCON / RADAR ${opforRadarEnabled ? "EMITTING" : "SILENT"}`);
});
function slewSearchToSelected() {
  const track = combatPicture.trackForTarget(selectedTargetId);
  if (!track) {
    log(`SENSOR SLEW INHIBIT / TARGET ${selectedTargetId} UNAVAILABLE`);
    return false;
  }
  const bearing = Math.atan2(
    track.position.x - defender.position.x,
    track.position.z - defender.position.z,
  );
  combatPicture.setSearch(searchWidth, bearing);
  log(
    `SENSOR AXIS / TRACK ${track.id} / ${Math.round(THREE.MathUtils.radToDeg(bearing))} DEG`,
  );
  return true;
}
const searchButton = controlButton("SEARCH: 360 DEG", () => {
  searchWidth = searchWidth === 360 ? 120 : searchWidth === 120 ? 60 : 360;
  const current = combatPicture.getSearchState();
  combatPicture.setSearch(searchWidth, current.bearing);
  if (searchWidth < 360) slewSearchToSelected();
  searchButton.textContent = `SEARCH: ${searchWidth} DEG`;
  const state = combatPicture.getSearchState(),
    primary =
      activeShip.sensors.find((sensor) => sensor.threeDimensional) ??
      activeShip.sensors[0],
    phased = primary.scanMode === "phased-array";
  log(
    phased && searchWidth < 360
      ? `RADAR RESOURCE / ${primary.name} ELECTRONIC SECTOR ${searchWidth} DEG / QUALITY x1.50 / 360 DEG BACKGROUND SEARCH`
      : `RADAR RESOURCE / ${searchWidth} DEG / REVISIT x${state.revisitMultiplier.toFixed(2)}${searchWidth < 360 ? " / QUALITY x1.50" : ""}`,
  );
});
const slewButton = controlButton("SLEW: SELECTED", () => {
  slewSearchToSelected();
  slewButton.textContent = `SLEW: TRACK ${selectedTargetId}`;
});
const ciwsButton = controlButton("CIWS: AUTO", () => {
  ciwsEnabled = !ciwsEnabled;
  ciwsButton.textContent = `CIWS: ${ciwsEnabled ? "AUTO" : "HOLD"}`;
});
const chaffButton = controlButton("THREAT CHAFF: ON", () => {
  chaffEnabled = !chaffEnabled;
  chaffButton.textContent = `THREAT CHAFF: ${chaffEnabled ? "ON" : "OFF"}`;
});
const ecmButton = controlButton("OPFOR ECM: ON", () => {
  ecmEnabled = !ecmEnabled;
  ecmButton.textContent = `OPFOR ECM: ${ecmEnabled ? "ON" : "OFF"}`;
  log(`OPFOR ELECTRONIC WARFARE / ${ecmEnabled ? "ACTIVE" : "SILENT"}`);
});
const platformDecoyButton = controlButton("OPFOR DECOYS: AUTO", () => {
  platformDecoysEnabled = !platformDecoysEnabled;
  platformDecoyButton.textContent = `OPFOR DECOYS: ${platformDecoysEnabled ? "AUTO" : "HOLD"}`;
  log(`OPFOR COUNTERMEASURES / ${platformDecoysEnabled ? "AUTO" : "HOLD"}`);
});
const shipEcmButton = controlButton("SHIP ECM: AUTO", () => {
  shipEcmEnabled = !shipEcmEnabled;
  shipEcmButton.textContent = `SHIP ECM: ${shipEcmEnabled ? "AUTO" : "HOLD"}`;
});
const srbocButton = controlButton("SRBOC: AUTO", () => {
  srbocEnabled = !srbocEnabled;
  srbocButton.textContent = `SRBOC: ${srbocEnabled ? "AUTO" : "HOLD"}`;
});
const surfaceAutoButton = controlButton("SURFACE STRIKE: AUTO", () => {
  autoSurfaceStrike = !autoSurfaceStrike;
  surfaceAutoButton.textContent = `SURFACE STRIKE: ${autoSurfaceStrike ? "AUTO" : "HOLD"}`;
  log(
    `SURFACE STRIKE DOCTRINE / ${autoSurfaceStrike ? "AUTO" : "WEAPONS HOLD"}`,
  );
});
controlButton("LAUNCH HARPOON", () => planSurfaceStrike(true));
const weaponButton = controlButton(`WEAPON: ${selectedWeapon}`, () => {
  const weapons = activeShip.launcher.compatibleWeapons;
  selectedWeapon =
    weapons[(weapons.indexOf(selectedWeapon) + 1) % weapons.length];
  weaponButton.textContent = `WEAPON: ${selectedWeapon}`;
  ammoEl.textContent = `RIM ${ammo} / MR ${sm2Ammo} / ER ${sm2erAmmo}`;
});
const targetButton = controlButton("TARGET: 1", () => {
  const live = missiles
    .map((m, i) => ({ m, id: i + 1 }))
    .filter((x) => x.m.phase !== "destroyed");
  if (!live.length) return;
  const current = live.findIndex((x) => x.id === selectedTargetId);
  selectedTargetId = live[(current + 1) % live.length].id;
  targetButton.textContent = `TARGET: ${selectedTargetId}`;
  slewButton.textContent = `SLEW: TRACK ${selectedTargetId}`;
  missiles.forEach(
    (m, i) =>
      (m.mesh.userData.selection.visible =
        i + 1 === selectedTargetId && m.phase !== "destroyed"),
  );
});
const fireButton = controlButton("LAUNCH SAM", () => {
  const pending = pendingLauncherRequests(),
    active = interceptors.filter((i) => i.mesh.visible).length + pending.length,
    track = combatPicture.trackForTarget(selectedTargetId),
    target = missiles[selectedTargetId - 1],
    available =
      selectedWeapon === "RIM-67"
        ? ammo
        : selectedWeapon === "SM-2MR"
          ? sm2Ammo
          : sm2erAmmo,
    profile = weaponProfiles[selectedWeapon];
  if (!running) {
    log("LAUNCH INHIBIT / SIMULATION PAUSED");
    return;
  }
  if (elapsed < nextSamLaunch) {
    log(`LAUNCH INHIBIT / ${activeShip.launcher.displayName} LAUNCHER CYCLING`);
    return;
  }
  if (active >= maxSamChannels) {
    log(`LAUNCH INHIBIT / CHANNELS ${active}/${maxSamChannels}`);
    return;
  }
  if (available <= 0) {
    log("LAUNCH INHIBIT / MAGAZINE EMPTY");
    return;
  }
  if (!target || target.phase === "destroyed") {
    log("LAUNCH INHIBIT / TARGET INVALID");
    return;
  }
  if (!track) {
    log(`LAUNCH INHIBIT / TRACK ${selectedTargetId} LOST`);
    return;
  }
  if (!track.altitudeKnown) {
    log(`LAUNCH INHIBIT / TRACK ${track.id} 2D WARNING ONLY`);
    return;
  }
  if (track.solutionQuality < 0.45) {
    log(
      `LAUNCH INHIBIT / FIRE CONTROL SOLUTION ${Math.round(track.solutionQuality * 100)}%`,
    );
    return;
  }
  if (track.age > 2.2) {
    log(`LAUNCH INHIBIT / TRACK ${track.id} STALE`);
    return;
  }
  const assigned =
      interceptors.filter((i) => i.mesh.visible && i.target === target).length +
      pending.filter((request) => request.target === target).length,
    required = defensiveShotRequirement(target, track.quality);
  if (assigned >= required) {
    log(
      required === 0
        ? "LAUNCH INHIBIT / DOCTRINE LOOK"
        : `LAUNCH INHIBIT / SALVO COMPLETE ${assigned}/${required}`,
    );
    return;
  }
  const range = target.mesh.position.distanceTo(defender.position);
  if (range < profile.minRange || range > profile.maxRange) {
    log(
      `LAUNCH INHIBIT / ${selectedWeapon} ENVELOPE ${(profile.minRange / 10).toFixed(1)}-${(profile.maxRange / 10).toFixed(1)} km`,
    );
    return;
  }
  if (queueInterceptorLaunch(target, selectedWeapon)) {
    nextSamLaunch = elapsed + 0.12;
    changeAmmo(selectedWeapon, -1);
  }
});
const speedButton = controlButton("TIME: 1X", () => {
  timeScale = timeScale === 1 ? 2 : timeScale === 2 ? 4 : 1;
  speedButton.textContent = `TIME: ${timeScale}X`;
});
controlButton("END EXERCISE / AAR", () => {
  if (!running || missionEnded) return;
  log("EXERCISE TERMINATED / AAR REQUESTED");
  finishMission(hullIntegrity > 0, "EXERCISE TERMINATED / PARTIAL AAR");
});
controlButton("SCENARIO SETUP", () => {
  running = false;
  sandbox.style.display = "block";
});
missiles[0].mesh.userData.selection.visible = true;
function log(s: string) {
  aarEvents.push({ time: elapsed, text: s, category: classifyAarEvent(s) });
  if (aarEvents.length > 2000) aarEvents.shift();
  const d = document.createElement("div");
  d.textContent = s;
  feed.prepend(d);
  while (feed.children.length > 8) {
    const removable = [...feed.children]
      .reverse()
      .find(
        (child) =>
          !/(CORRELATION BREAK|FIRE CONTROL|DOCTRINE LOOK|OODA MANEUVER|ILLUMIN|SEEKER|CHAFF|ECM|DECOY|DAMAGE CONTROL|DAMAGE ISOLATION|TRAPPED|DAMAGED|DEGRADED|CRITICAL|DESTROYED)/.test(
            child.textContent ?? "",
          ),
      );
    (removable ?? feed.lastChild)?.remove();
  }
}
function updateShipManeuver(dt: number) {
  const forward = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      defender.rotation.y,
    ),
    tracks = [...combatPicture.tracks.values()]
      .filter((track) => {
        const missile = defenseTargetForSource(track.sourceId);
        return (
          missile &&
          missile.phase !== "destroyed" &&
          track.quality > 0.08 &&
          track.age < 4
        );
      })
      .sort(
        (a, b) =>
          a.position.distanceTo(defender.position) /
            Math.max(
              1,
              defenseTargetForSource(a.sourceId)?.velocity.length() ?? 1,
            ) -
          b.position.distanceTo(defender.position) /
            Math.max(
              1,
              defenseTargetForSource(b.sourceId)?.velocity.length() ?? 1,
            ),
      ),
    threat = tracks[0],
    threatRange = threat?.position.distanceTo(defender.position) ?? Infinity;
  if (elapsed >= nextShipDecision) {
    nextShipDecision = elapsed + activeShip.platform.decisionInterval;
    const previousMode = shipManeuverMode;
    const headingFor = (direction: THREE.Vector3) =>
      Math.atan2(-direction.z, direction.x);
    const headingDelta = (heading: number) =>
      Math.abs(
        Math.atan2(
          Math.sin(heading - defender.rotation.y),
          Math.cos(heading - defender.rotation.y),
        ),
      );
    if (hullIntegrity <= 0) {
      shipManeuverMode = "disabled";
      shipCommandedSpeedKnots = 0;
      shipManeuverThreatId = 0;
    } else if (threat && threatRange < 500) {
      const axis = threat.position
          .clone()
          .sub(defender.position)
          .setY(0)
          .normalize(),
        left = new THREE.Vector3(-axis.z, 0, axis.x),
        right = left.clone().negate(),
        beam = forward.dot(left) >= forward.dot(right) ? left : right;
      shipDesiredHeading = Math.atan2(-beam.z, beam.x);
      shipCommandedSpeedKnots = activeShip.platform.maxSpeedKnots;
      shipManeuverMode = "defensive-beam";
      if (shipManeuverThreatId !== threat.sourceId) {
        shipManeuverThreatId = threat.sourceId;
        log(`OODA MANEUVER / BEAM TRACK ${threat.id} / FULL POWER`);
      }
    } else {
      shipManeuverThreatId = 0;
      const directSurfaceTrack = enemyPlatform
        ? surfacePicture.trackForTarget(1)
        : undefined;
      const surfaceTrack =
        directSurfaceTrack && directSurfaceTrack.quality > 0.08
          ? directSurfaceTrack
          : surfaceEsmCue.valid && surfaceEsmCue.age < 8
            ? surfaceEsmCue
            : undefined;
      if (surfaceTrack && surfaceTrack.age < 8 && surfaceTrack.quality > 0.08) {
        const toTrack = surfaceTrack.position
            .clone()
            .sub(defender.position)
            .setY(0),
          range = toTrack.length(),
          axis = toTrack.normalize(),
          platform = activeShip.platform,
          organicHorizon = radarHorizonWorldUnits(
            activeShip.sensors[0]?.radarHeight ??
              activeShip.platform.significantHeightMeters,
            enemyPlatform?.definition.significantHeightMeters ??
              activeShip.platform.significantHeightMeters,
          ),
          desiredRange =
            directSurfaceTrack &&
            directSurfaceTrack.quality >=
              (activeShip.surfaceStrike?.requiredTrackQuality ?? 0.5)
              ? platform.standoffRange
              : Math.min(platform.standoffRange, organicHorizon * 0.84);
        if (range > desiredRange + platform.standoffTolerance) {
          shipDesiredHeading = headingFor(axis);
          shipManeuverMode = "close";
        } else if (range < desiredRange - platform.standoffTolerance) {
          shipDesiredHeading = headingFor(axis.multiplyScalar(-1));
          shipManeuverMode = "withdraw";
        } else {
          const left = new THREE.Vector3(-axis.z, 0, axis.x),
            right = left.clone().negate(),
            headings = [headingFor(left), headingFor(right)];
          shipDesiredHeading =
            headingDelta(headings[0]) <= headingDelta(headings[1])
              ? headings[0]
              : headings[1];
          shipManeuverMode = "standoff";
        }
        shipCommandedSpeedKnots = platform.cruiseSpeedKnots;
      } else {
        shipManeuverMode = "patrol";
        shipCommandedSpeedKnots = activeShip.platform.patrolSpeedKnots;
      }
    }
    if (
      previousMode !== shipManeuverMode &&
      shipManeuverMode !== "defensive-beam"
    )
      log(
        `OODA MANEUVER / ${shipManeuverMode.toUpperCase()} / ${activeShip.name} / CMD ${shipCommandedSpeedKnots.toFixed(0)} KT`,
      );
  }
  const propulsion = subsystemHealth("propulsion"),
    designSpeed = activeShip.platform.maxSpeedKnots,
    maximumKnots =
      designSpeed * propulsion * Math.max(0.45, hullIntegrity / 100),
    targetKnots = Math.min(maximumKnots, shipCommandedSpeedKnots),
    speedStep =
      (targetKnots > shipSpeedKnots
        ? activeShip.platform.accelerationKnotsPerSecond
        : activeShip.platform.decelerationKnotsPerSecond) *
      (0.25 + 0.75 * propulsion) *
      dt;
  shipSpeedKnots = THREE.MathUtils.clamp(
    shipSpeedKnots +
      Math.sign(targetKnots - shipSpeedKnots) *
        Math.min(Math.abs(targetKnots - shipSpeedKnots), speedStep),
    0,
    maximumKnots,
  );
  const headingError = Math.atan2(
      Math.sin(shipDesiredHeading - defender.rotation.y),
      Math.cos(shipDesiredHeading - defender.rotation.y),
    ),
    turnRate =
      THREE.MathUtils.degToRad(activeShip.platform.turnRateDeg) *
      (0.35 + (0.65 * shipSpeedKnots) / designSpeed) *
      (0.2 + 0.8 * propulsion);
  defender.rotation.y += THREE.MathUtils.clamp(
    headingError,
    -turnRate * dt,
    turnRate * dt,
  );
  const updatedForward = new THREE.Vector3(1, 0, 0).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    defender.rotation.y,
  );
  defender.position.addScaledVector(
    updatedForward,
    shipSpeedKnots * 0.005144 * dt,
  );
  wake.rotation.y = defender.rotation.y;
  wake.position.copy(defender.position).addScaledVector(updatedForward, -28);
  wake.position.y = 0.22;
  wakeLineMat.opacity = 0.08 + (0.28 * shipSpeedKnots) / designSpeed;
  canvas.dataset.shipManeuverMode = shipManeuverMode;
  canvas.dataset.shipCommandedSpeedKnots = shipCommandedSpeedKnots.toFixed(2);
  canvas.dataset.shipDesiredHeadingDeg =
    THREE.MathUtils.radToDeg(shipDesiredHeading).toFixed(2);
}
function updateShipStatus() {
  const active =
      interceptors.filter((i) => i.mesh.visible).length +
      pendingLauncherRequests().length,
    illuminatedMissiles = interceptors.filter(
      (i) => i.mesh.visible && i.illuminated,
    ).length,
    shipClouds = chaffClouds.filter((c) => c.side === "ship").length,
    forward = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      defender.rotation.y,
    ),
    heading =
      (THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z)) + 360) % 360,
    directorCount = (defender.userData.directors as THREE.Group[]).length,
    effectiveIlluminators = effectiveIlluminatorCount(
      maxIlluminators,
      directorCount,
      subsystemHealth("fireControl"),
    ),
    activeIlluminators = illuminators
      .slice(0, effectiveIlluminators)
      .filter((state) => state.target?.illuminated).length,
    queue = illuminators
      .slice(0, effectiveIlluminators)
      .map((state) =>
        state.target
          ? `T${String(defenseSourceForTarget(state.target.target)).padStart(2, "0")}`
          : "--",
      )
      .join("/");
  canvas.dataset.illuminatorsAvailable = String(effectiveIlluminators);
  canvas.dataset.illuminatorsActive = String(activeIlluminators);
  canvas.dataset.illuminatedMissiles = String(illuminatedMissiles);
  canvas.dataset.illuminationQueue = queue;
  document.querySelector("#shipState")!.textContent =
    `HULL ${hullIntegrity}% / ${shipSpeedKnots.toFixed(0)} KT / HDG ${heading.toFixed(0).padStart(3, "0")} / CH ${active}/${maxSamChannels} / ILL ${activeIlluminators}/${effectiveIlluminators} / SRBOC ${srbocRounds} / CIWS ${ciwsRounds} / ${queue || "--"}`;
}
log("16:42:08  NTU combat system initialized");
log("16:42:11  SURFACE SEARCH RADAR — CONTACTS ACQUIRED");
function updateCamera() {
  if (cinematic) az += 0.0018;
  let focus: THREE.Vector3;
  const selectedAircraft = airCombat.aircraft.find(
    (aircraft) => aircraft.id === selectedAircraftId && aircraft.alive,
  );
  if ((viewMode === 6 || viewMode === 7 || viewMode === 8) && selectedAircraft) {
    focus = selectedAircraft.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const forward = selectedAircraft.heading.clone().normalize(),
      right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(),
      chasePosition = focus
        .clone()
        .addScaledVector(forward, -Math.max(9, dist * 0.32))
        .addScaledVector(right, Math.sin(az) * dist * 0.08)
        .add(new THREE.Vector3(0, 3.5 + Math.sin(el) * dist * 0.12, 0));
    camera.position.lerp(chasePosition, 0.16);
    camera.lookAt(focus.clone().addScaledVector(forward, 12));
    return;
  }
  if (viewMode === 1)
    focus = defender.position.clone().add(new THREE.Vector3(0, 9, 0));
  else if (viewMode === 9) {
    const liveAircraft = airCombat.aircraft.filter((aircraft) => aircraft.alive);
    focus = liveAircraft.length
      ? liveAircraft.reduce(
          (center, aircraft) => center.add(aircraft.position),
          new THREE.Vector3(),
        ).multiplyScalar(1 / liveAircraft.length)
      : defender.position.clone();
  } else if (viewMode === 5 && enemyPlatform)
    focus = enemyPlatform.model.position
      .clone()
      .add(new THREE.Vector3(0, 10, 0));
  else if (viewMode === 4) {
    const interceptor = interceptors.find((item) => item.mesh.visible),
      incoming = missiles[selectedTargetId - 1];
    focus =
      interceptor?.mesh.position.clone() ??
      (incoming?.mesh.visible
        ? incoming.mesh.position.clone()
        : defender.position.clone().add(new THREE.Vector3(0, 9, 0)));
  } else if (viewMode === 3) {
    const track = combatPicture.trackForTarget(selectedTargetId);
    focus = track
      ? defender.position.clone().lerp(track.position, 0.52)
      : defender.position.clone().add(new THREE.Vector3(0, 8, -80));
  } else
    focus = new THREE.Vector3(defender.position.x, 8, defender.position.z - 80);
  const x = Math.cos(el) * Math.sin(az) * dist,
    z = Math.cos(el) * Math.cos(az) * dist;
  camera.position.set(focus.x + x, focus.y + Math.sin(el) * dist, focus.z + z);
  camera.lookAt(focus);
}
function angleDifference(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
type MissileForwardAxis = "+Y" | "-Z";
function setMissileAttitude(
  model: THREE.Object3D,
  direction: THREE.Vector3,
  axis: MissileForwardAxis,
  bank: number,
) {
  const previousAttitude = (
      model.userData.attitudeQuaternion as THREE.Quaternion | undefined
    )?.clone(),
    forward = direction.clone().normalize(),
    worldUp = new THREE.Vector3(0, 1, 0),
    previousUp =
      (model.userData.attitudeUp as THREE.Vector3 | undefined)?.clone() ??
      (axis === "+Y" ? new THREE.Vector3(1, 0, 0) : worldUp.clone());
  const projectedWorldUp = worldUp.addScaledVector(
      forward,
      -worldUp.dot(forward),
    ),
    projectedPrevious = previousUp.addScaledVector(
      forward,
      -previousUp.dot(forward),
    );
  let dorsal: THREE.Vector3;
  if (projectedWorldUp.lengthSq() > 0.015) {
    projectedWorldUp.normalize();
    dorsal =
      projectedPrevious.lengthSq() > 0.001
        ? projectedPrevious.normalize().lerp(projectedWorldUp, 0.22).normalize()
        : projectedWorldUp;
  } else if (projectedPrevious.lengthSq() > 0.001)
    dorsal = projectedPrevious.normalize();
  else
    dorsal = new THREE.Vector3(1, 0, 0)
      .addScaledVector(forward, -forward.x)
      .normalize();
  const right = forward.clone().cross(dorsal).normalize();
  dorsal.copy(right).cross(forward).normalize();
  model.userData.attitudeUp = dorsal.clone();
  const basis = new THREE.Matrix4();
  if (axis === "+Y") basis.makeBasis(right, forward, dorsal);
  else basis.makeBasis(right, dorsal, forward.clone().negate());
  model.quaternion.setFromRotationMatrix(basis);
  const localForward =
    axis === "+Y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, -1);
  if (bank)
    model.quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(localForward, bank),
    );
  const renderedForward = localForward
      .applyQuaternion(model.quaternion)
      .normalize(),
    error = THREE.MathUtils.radToDeg(renderedForward.angleTo(forward)),
    step = previousAttitude
      ? THREE.MathUtils.radToDeg(previousAttitude.angleTo(model.quaternion))
      : 0;
  model.userData.attitudeErrorDeg = error;
  model.userData.attitudeQuaternion = model.quaternion.clone();
  model.userData.maxAttitudeStepDeg = Math.max(
    model.userData.maxAttitudeStepDeg ?? 0,
    step,
  );
  canvas.dataset[
    axis === "+Y" ? "interceptorAttitudeError" : "incomingAttitudeError"
  ] = error.toFixed(4);
  canvas.dataset[
    axis === "+Y" ? "interceptorAttitudeStep" : "incomingAttitudeStep"
  ] = (model.userData.maxAttitudeStepDeg as number).toFixed(3);
}
function aimLocal(
  model: THREE.Object3D,
  target: THREE.Vector3,
  dt: number,
  yawRate: number,
  pitchRate: number,
) {
  const local = model.parent!.worldToLocal(target.clone()).sub(model.position),
    desiredYaw = Math.atan2(-local.z, local.x),
    yawStep = yawRate * dt;
  model.rotation.y += THREE.MathUtils.clamp(
    angleDifference(desiredYaw, model.rotation.y),
    -yawStep,
    yawStep,
  );
  const pivot = model.userData.elevationPivot as THREE.Group | undefined;
  if (!pivot) return;
  const desiredPitch = THREE.MathUtils.clamp(
      Math.atan2(local.y, Math.hypot(local.x, local.z)),
      THREE.MathUtils.degToRad(-8),
      THREE.MathUtils.degToRad(72),
    ),
    pitchStep = pitchRate * dt;
  pivot.rotation.z += THREE.MathUtils.clamp(
    desiredPitch - pivot.rotation.z,
    -pitchStep,
    pitchStep,
  );
}
function updateShipWeaponVisuals(dt: number) {
  const primaryRadarHealth = subsystemHealth("primaryRadar"),
    secondaryRadarHealth = subsystemHealth("secondaryRadar"),
    fireControlHealth = subsystemHealth("fireControl");
  if (!defender.userData.radar.userData.static)
    defender.userData.radar.rotation.y += dt * 0.8 * primaryRadarHealth;
  defender.userData.secondaryRadar.rotation.y -=
    dt * 0.5 * secondaryRadarHealth;
  if (!defender.userData.fireControl.userData.static)
    defender.userData.fireControl.rotation.y =
      Math.sin(elapsed * 0.7) * 0.3 * fireControlHealth;
  const faceConfig = activeShip.fixedSensorFaces,
    faces = fixedSensorFaceHealth(),
    faceModels = defender.userData.sensorFaceModels as
      THREE.Group[] | undefined;
  if (faceConfig && faces && faceModels) {
    faceModels.forEach((model, index) => {
      const material = (model.userData.panel as THREE.Mesh)
          .material as THREE.MeshStandardMaterial,
        health = faces[index];
      material.color
        .copy(new THREE.Color(faceConfig.damagedColor))
        .lerp(new THREE.Color(faceConfig.healthyColor), health);
      material.emissive.setHex(
        health < 0.35 ? faceConfig.criticalEmissive : 0x000000,
      );
      material.emissiveIntensity = (1 - health) * 0.85;
    });
    canvas.dataset.sensorFaceHealth = faces
      .map((health) => Math.round(health * 100))
      .join(",");
    canvas.dataset.sensorWeakestFace =
      faceConfig.labels[faces.indexOf(Math.min(...faces))];
  }
  const directors = defender.userData.directors as THREE.Group[];
  directors.forEach((director, index) => {
    const state = illuminators[index],
      target = state?.target?.target;
    if (target && target.phase !== "destroyed" && fireControlHealth > 0.05)
      aimLocal(
        director,
        target.mesh.position,
        dt,
        THREE.MathUtils.degToRad(55) * (0.25 + 0.75 * fireControlHealth),
        THREE.MathUtils.degToRad(38) * (0.25 + 0.75 * fireControlHealth),
      );
    else {
      const stow = director.userData.stowHeading as number,
        pivot = director.userData.elevationPivot as THREE.Group;
      director.rotation.y += THREE.MathUtils.clamp(
        angleDifference(stow, director.rotation.y),
        -dt * 0.22 * fireControlHealth,
        dt * 0.22 * fireControlHealth,
      );
      pivot.rotation.z = THREE.MathUtils.lerp(
        pivot.rotation.z,
        0,
        Math.min(1, dt * 1.5),
      );
    }
  });
  const ciwsHealth = subsystemHealth("ciws");
  for (const mount of [
    { model: defender.getObjectByName("ciwsFore"), heading: Math.PI / 2 },
    { model: defender.getObjectByName("ciwsAft"), heading: -Math.PI / 2 },
  ]) {
    if (!mount.model) continue;
    const candidate = missiles
      .filter((m) => {
        if (
          m.phase === "destroyed" ||
          !m.mesh.visible ||
          m.mesh.position.distanceTo(defender.position) >= 24
        )
          return false;
        const worldRelative = m.mesh.position.clone().sub(defender.position),
          relative = defender.worldToLocal(m.mesh.position.clone()),
          bearing = Math.atan2(relative.x, relative.z),
          closing = -m.velocity.dot(worldRelative.normalize());
        return (
          closing > 0.5 &&
          Math.abs(angleDifference(bearing, mount.heading)) <=
            THREE.MathUtils.degToRad(105)
        );
      })
      .sort(
        (a, b) =>
          a.mesh.position.distanceTo(defender.position) -
          b.mesh.position.distanceTo(defender.position),
      )[0];
    if (candidate && ciwsHealth > 0.05)
      aimLocal(
        mount.model,
        candidate.mesh.position,
        dt,
        THREE.MathUtils.degToRad(70) * ciwsHealth,
        THREE.MathUtils.degToRad(55) * ciwsHealth,
      );
    else {
      const pivot = mount.model.userData.elevationPivot as
        THREE.Group | undefined;
      if (pivot)
        pivot.rotation.z = THREE.MathUtils.lerp(
          pivot.rotation.z,
          0,
          Math.min(1, dt * 2),
        );
    }
  }
}
function updateShipVisualLod() {
  const range = camera.position.distanceTo(defender.position),
    near = range < 270,
    medium = range >= 270 && range < 340,
    low = range >= 340;
  (defender.userData.highDetail as THREE.Group).visible = near;
  (defender.userData.mediumDetail as THREE.Group).visible = medium;
  (defender.userData.lowDetail as THREE.Group).visible = low;
  (defender.userData.detail as THREE.Object3D[]).forEach(
    (object) => (object.visible = !low),
  );
}
function updateShipLights() {
  const lights = defender.userData.navigationLights as THREE.PointLight[],
    bulbs = defender.userData.lightBulbs as THREE.Mesh[],
    pulse = 0.9 + Math.sin(elapsed * 2.6) * 0.1;
  lights.forEach(
    (light, index) => (light.intensity = (index < 2 ? 3 : 2.2) * pulse),
  );
  bulbs.forEach((bulb, index) =>
    bulb.scale.setScalar((index < 2 ? 1.15 : 1) * pulse),
  );
  const beam = defender.userData.radar.userData.searchBeam as THREE.Mesh,
    material = beam.material as THREE.MeshBasicMaterial,
    health = subsystemHealth("primaryRadar");
  beam.visible =
    radarEnabled &&
    health > 0.05 &&
    camera.position.distanceTo(defender.position) < 340;
  material.opacity = 0.012 + 0.028 * health;
}
function scheduleIlluminators(candidates: Interceptor[], dt: number) {
  const health = subsystemHealth("fireControl"),
    active = candidates.filter(
      (i) => i.mesh.visible && i.target.phase !== "destroyed",
    ),
    directorCount = (defender.userData.directors as THREE.Group[]).length,
    limit = effectiveIlluminatorCount(maxIlluminators, directorCount, health);
  allocateIlluminators({
    states: illuminators,
    candidates: active,
    limit,
    bearing: (interceptor) => {
      const local = defender.worldToLocal(interceptor.target.mesh.position.clone());
      return Math.atan2(-local.z, local.x);
    },
    targetId: (interceptor) => defenseSourceForTarget(interceptor.target),
    onAssignment: (state, id) =>
      log(`FIRE CONTROL / ${activeShip.subsystemLabels.fireControl} ${state.id} / TRACK ${id} / SLEWING`),
  });
  const slewRate = THREE.MathUtils.degToRad(55) * (0.25 + 0.75 * health);
  const capturedTargets = new Map<DefenseTarget, number>();
  for (const [index, state] of illuminators.slice(0, limit).entries()) {
    const interceptor = state.target;
    if (!interceptor) continue;
    const targetLocal = defender.worldToLocal(
        interceptor.target.mesh.position.clone(),
      ),
      desired = Math.atan2(-targetLocal.z, targetLocal.x),
      delta = angleDifference(desired, state.azimuth);
    state.azimuth += THREE.MathUtils.clamp(
      delta,
      -slewRate * dt,
      slewRate * dt,
    );
    const captured = Math.abs(delta) < THREE.MathUtils.degToRad(14);
    if (captured) capturedTargets.set(interceptor.target, index);
    interceptor.illuminated = captured;
    interceptor.illuminationBeam.visible = captured;
  }
  for (const interceptor of active) {
    const directorIndex = capturedTargets.get(interceptor.target);
    if (directorIndex === undefined) continue;
    interceptor.illuminated = true;
    interceptor.illuminationBeam.visible = true;
    const director = (defender.userData.directors as THREE.Group[])[
        directorIndex
      ],
      feed = director.userData.feedTip as THREE.Object3D,
      origin = new THREE.Vector3();
    feed.getWorldPosition(origin);
    interceptor.illuminationBeam.geometry.dispose();
    interceptor.illuminationBeam.geometry =
      new THREE.BufferGeometry().setFromPoints([
        origin,
        interceptor.target.mesh.position.clone(),
      ]);
  }
  for (const interceptor of interceptors)
    if (!active.includes(interceptor)) {
      interceptor.illuminated = false;
      interceptor.illuminationBeam.visible = false;
    }
}
function updateCiws() {
  const health = subsystemHealth("ciws");
  if (
    !ciwsEnabled ||
    health <= 0.05 ||
    ciwsRounds <= 0 ||
    elapsed - lastCiwsShot < 0.55 / Math.max(0.4, health)
  )
    return;
  const mounts = [
    {
      name: "FORE",
      model: defender.getObjectByName("ciwsFore"),
      heading: Math.PI / 2,
    },
    {
      name: "AFT",
      model: defender.getObjectByName("ciwsAft"),
      heading: -Math.PI / 2,
    },
  ].filter((mount) => mount.model);
  const candidates = allDefenseTargets()
    .filter(
      (m) =>
        m.entity?.kind !== "aircraft" &&
        m.phase !== "destroyed" &&
        m.mesh.position.distanceTo(defender.position) < 15,
    )
    .map((m) => {
      const worldRelative = m.mesh.position.clone().sub(defender.position),
        relative = defender.worldToLocal(m.mesh.position.clone()),
        bearing = Math.atan2(relative.x, relative.z),
        closingSpeed = -m.velocity.dot(worldRelative.clone().normalize()),
        mount = mounts
          .map((x) => ({
            ...x,
            delta: Math.abs(angleDifference(bearing, x.heading)),
          }))
          .sort((a, b) => a.delta - b.delta)[0];
      return { m, bearing, closingSpeed, mount };
    })
    .filter(
      (x) =>
        x.closingSpeed > 0.5 && x.mount.delta <= THREE.MathUtils.degToRad(105),
    )
    .sort(
      (a, b) =>
        a.m.mesh.position.distanceTo(defender.position) / a.closingSpeed -
        b.m.mesh.position.distanceTo(defender.position) / b.closingSpeed,
    );
  const target = candidates[0];
  if (!target) {
    const nearby = allDefenseTargets().filter(
        (m) =>
          m.entity?.kind !== "aircraft" &&
          m.phase !== "destroyed" &&
          m.mesh.position.distanceTo(defender.position) < 15,
      ),
      approaching = nearby.some((m) => {
        const relative = m.mesh.position.clone().sub(defender.position);
        return -m.velocity.dot(relative.normalize()) > 0.5;
      });
    if (nearby.length) {
      lastCiwsShot = elapsed;
      log(
        approaching ? "CIWS HOLD / BLIND SECTOR" : "CIWS HOLD / TARGET OPENING",
      );
    }
    return;
  }
  const range = target.m.mesh.position.distanceTo(defender.position),
    tti = range / target.closingSpeed,
    bursts = Math.max(1, Math.floor(tti / 0.55));
  if (tti < 0.35) {
    lastCiwsShot = elapsed;
    log(
      `CIWS HOLD / WINDOW CLOSED / ${target.m.threatType} / ${tti.toFixed(2)}s / ${target.mount.name}`,
    );
    return;
  }
  const mountModel = defender.getObjectByName(
      target.mount.name === "FORE" ? "ciwsFore" : "ciwsAft",
    ),
    localAim = mountModel?.parent
      ?.worldToLocal(target.m.mesh.position.clone())
      .sub(mountModel.position),
    desiredTraverse = localAim ? Math.atan2(-localAim.z, localAim.x) : 0,
    traverseError = mountModel
      ? angleDifference(desiredTraverse, mountModel.rotation.y)
      : 0;
  if (mountModel)
    mountModel.rotation.y += THREE.MathUtils.clamp(
      traverseError,
      -THREE.MathUtils.degToRad(70) * 0.55 * health,
      THREE.MathUtils.degToRad(70) * 0.55 * health,
    );
  if (Math.abs(traverseError) > THREE.MathUtils.degToRad(12)) {
    lastCiwsShot = elapsed;
    log(
      `CIWS SLEWING / ${target.mount.name} / ${Math.round(THREE.MathUtils.radToDeg(Math.abs(traverseError)))} DEG`,
    );
    return;
  }
  lastCiwsShot = elapsed;
  ciwsRounds = Math.max(0, ciwsRounds - 60);
  const mountOrigin = new THREE.Vector3();
  target.mount.model!.getWorldPosition(mountOrigin);
  mountOrigin.y += 1.2;
  createCiwsTracer(scene, target.m.mesh.position, mountOrigin);
  const saturation = Math.max(1, candidates.length),
    basePk =
      (Math.max(0.08, 0.46 / saturation) -
        incomingProfiles[target.m.threatType].ciwsPenalty) *
      (0.25 + 0.75 * health),
    singlePk =
      incomingProfiles[target.m.threatType].ciwsPkCap !== undefined
        ? Math.min(incomingProfiles[target.m.threatType].ciwsPkCap!, basePk)
        : Math.max(0.04, basePk),
    windowFactor = Math.min(1.35, 0.75 + bursts * 0.12),
    pk = Math.min(0.72, singlePk * windowFactor),
    roll = deterministicProbabilityRoll(
      defenseSourceSeed(defenseSourceForTarget(target.m)),
      elapsed,
      ciwsRounds,
    );
  log(
    `CIWS WINDOW / ${target.m.threatType} / ${tti.toFixed(1)}s / ${bursts} BURSTS / PK ${Math.round(pk * 100)}% / ${target.mount.name}`,
  );
  if (roll < pk) {
    const destroyed = resolveAirDefenseHit(target.m, 42);
    if (destroyed) {
      target.m.phase = "destroyed";
      target.m.mesh.visible = false;
      destroyMissileVisual(target.m, "intercept");
    } else createExplosion(target.m.mesh.position.clone());
    log(
      `CIWS KILL / ${target.mount.name} / PK ${Math.round(pk * 100)}% / ${ciwsRounds} ROUNDS`,
    );
  } else
    log(
      `CIWS MISS / ${target.mount.name} / PK ${Math.round(pk * 100)}% / ${ciwsRounds} ROUNDS`,
    );
}
setInterval(
  () =>
    interceptors.forEach((i) => {
      if (i.mesh.userData.seeker)
        i.mesh.userData.seeker.visible =
          i.weapon === "RIM-67" &&
          !!i.mesh.userData.seekerOn &&
          i.mesh.visible &&
          i.target.phase !== "destroyed" &&
          i.mesh.position.distanceTo(i.target.mesh.position) <
            weaponProfiles[i.weapon].terminalRange;
    }),
  50,
);
setInterval(() => {
  const liveMissiles = missiles.filter((m) => m.phase !== "destroyed"),
    live = liveMissiles.length,
    activeAir = liveMissiles.filter(
      (m) =>
        elapsed >= m.launchAt &&
        (!m.platformLaunch || m.platformLaunch.released),
    ),
    engagedTargets = new Set(
      interceptors.filter((i) => i.mesh.visible).map((i) => i.target),
    ).size,
    tracks = [...combatPicture.tracks.values()].filter(
      (track) => defenseTargetForSource(track.sourceId)?.phase !== "destroyed",
    ).length;
  if (enemyPlatform)
    updateRaidCard(
      activeAir.length,
      live - activeAir.length,
      activeAir.length
        ? Math.max(
            ...activeAir.map((m) =>
              m.mesh.position.distanceTo(defender.position),
            ),
          )
        : 0,
    );
  else
    targetState.textContent =
      live > 0
        ? `${live} THREATS / ${tracks} TRACKS / ${engagedTargets} ENGAGED`
        : "AIRSPACE CLEAR";
}, 120);
setInterval(() => {
  if (missiles[selectedTargetId - 1]?.phase === "destroyed") {
    const next = missiles.findIndex((m) => m.phase !== "destroyed");
    if (next >= 0) {
      selectedTargetId = next + 1;
      targetButton.textContent = `TARGET: ${selectedTargetId}`;
    }
  }
  missiles.forEach(
    (m, i) =>
      (m.mesh.userData.selection.visible =
        i + 1 === selectedTargetId &&
        m.phase !== "destroyed" &&
        !!combatPicture.trackForTarget(i + 1)),
  );
}, 120);
setInterval(() => {
  explosions.forEach((e) => {
    e.age += 0.05;
    e.core.scale.setScalar(1 + e.age * 3.4);
    e.ring.scale.setScalar(1 + e.age * 5.8);
    e.ring.quaternion.copy(camera.quaternion);
    (e.core.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0,
      0.92 - e.age / 1.45,
    );
    (e.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0,
      0.78 - e.age / 1.15,
    );
    e.light.intensity = Math.max(0, 18 - e.age * 14);
    if (e.age > 1.5) {
      e.core.visible = false;
      e.ring.visible = false;
      e.light.visible = false;
    }
  });
}, 50);
setInterval(() => {
  if (!radarCtx) return;
  const w = radarCanvas.width,
    h = radarCanvas.height,
    cx = w / 2,
    cy = h / 2;
  radarCtx.clearRect(0, 0, w, h);
  radarCtx.fillStyle = "#061923";
  radarCtx.fillRect(0, 0, w, h);
  radarCtx.strokeStyle = "#2d7f83";
  radarCtx.globalAlpha = 0.65;
  for (const r of [35, 70, 105]) {
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
    radarCtx.stroke();
  }
  radarCtx.setLineDash([4, 4]);
  for (const [weapon, color] of [
    ["SM-2MR", "#d7aa55"],
    ["RIM-67", "#65cfd0"],
  ] as const) {
    radarCtx.strokeStyle = color;
    radarCtx.globalAlpha = weapon === selectedWeapon ? 0.72 : 0.32;
    radarCtx.beginPath();
    radarCtx.arc(
      cx,
      cy,
      weaponProfiles[weapon].maxRange * RADAR_PIXELS_PER_WORLD_UNIT,
      0,
      Math.PI * 2,
    );
    radarCtx.stroke();
  }
  radarCtx.setLineDash([]);
  radarCtx.beginPath();
  radarCtx.moveTo(cx, cy);
  radarCtx.lineTo(
    cx + Math.cos(elapsed * 0.8) * 110,
    cy + Math.sin(elapsed * 0.8) * 110,
  );
  radarCtx.strokeStyle = "#78e1c8";
  radarCtx.globalAlpha = 0.65;
  radarCtx.stroke();
  radarCtx.globalAlpha = 1;
  radarCtx.fillStyle = "#78e1c8";
  radarCtx.fillRect(cx - 3, cy - 3, 6, 6);
  const surfaceTrack = surfacePicture.trackForTarget(1);
  if (enemyPlatform && surfaceTrack) {
    const platformX =
        cx +
        (surfaceTrack.position.x - defender.position.x) *
          RADAR_PIXELS_PER_WORLD_UNIT,
      platformY =
        cy +
        (surfaceTrack.position.z - defender.position.z) *
          RADAR_PIXELS_PER_WORLD_UNIT,
      uncertainty = Math.max(
        3,
        (surfaceTrack.uncertainty / 100) * RADAR_PIXELS_PER_WORLD_UNIT,
      );
    radarCtx.strokeStyle = surfaceTrack.quality > 0.62 ? "#ff6758" : "#ffb347";
    radarCtx.fillStyle = "#ff6758";
    radarCtx.globalAlpha = 0.25;
    radarCtx.beginPath();
    radarCtx.arc(platformX, platformY, uncertainty, 0, Math.PI * 2);
    radarCtx.stroke();
    radarCtx.globalAlpha = 0.9;
    radarCtx.strokeRect(platformX - 7, platformY - 4, 14, 8);
    radarCtx.fillRect(platformX - 1, platformY - 1, 2, 2);
  } else if (enemyPlatform && surfaceEsmCue.valid) {
    const cueX =
        cx +
        (surfaceEsmCue.position.x - defender.position.x) *
          RADAR_PIXELS_PER_WORLD_UNIT,
      cueY =
        cy +
        (surfaceEsmCue.position.z - defender.position.z) *
          RADAR_PIXELS_PER_WORLD_UNIT;
    radarCtx.save();
    radarCtx.strokeStyle = "#bd78ff";
    radarCtx.fillStyle = "#bd78ff";
    radarCtx.globalAlpha = 0.78;
    radarCtx.setLineDash([3, 5]);
    radarCtx.beginPath();
    radarCtx.moveTo(cx, cy);
    radarCtx.lineTo(cueX, cueY);
    radarCtx.stroke();
    radarCtx.setLineDash([]);
    radarCtx.translate(cueX, cueY);
    radarCtx.rotate(Math.PI / 4);
    radarCtx.strokeRect(-5, -5, 10, 10);
    radarCtx.restore();
    radarCtx.globalAlpha = 0.9;
    radarCtx.font = "8px monospace";
    radarCtx.fillText("ESM", cueX + 9, cueY - 7);
  }
  for (const track of combatPicture.tracks.values()) {
    const missile = defenseTargetForSource(track.sourceId);
    if (!missile || missile.phase === "destroyed") continue;
    const x =
        cx +
        (track.position.x - defender.position.x) * RADAR_PIXELS_PER_WORLD_UNIT,
      y =
        cy +
        (track.position.z - defender.position.z) * RADAR_PIXELS_PER_WORLD_UNIT,
      color =
        track.quality > 0.7
          ? "#ff5148"
          : track.quality > 0.25
            ? "#ffb347"
            : "#bd78ff",
      uncertainty = Math.max(
        2,
        (track.uncertainty / 100) * RADAR_PIXELS_PER_WORLD_UNIT,
      );
    radarCtx.strokeStyle = color;
    radarCtx.globalAlpha = 0.28;
    radarCtx.beginPath();
    radarCtx.arc(x, y, uncertainty, 0, Math.PI * 2);
    radarCtx.stroke();
    radarCtx.globalAlpha = 0.95;
    radarCtx.beginPath();
    radarCtx.moveTo(x - 5, y);
    radarCtx.lineTo(x + 5, y);
    radarCtx.moveTo(x, y - 5);
    radarCtx.lineTo(x, y + 5);
    radarCtx.stroke();
    if (lastTrackClasses.get(track.id) !== track.classification) {
      lastTrackClasses.set(track.id, track.classification);
      log(
        `TRACK ${track.id} ${track.classification.toUpperCase()} · UNCERTAINTY ${(track.uncertainty / 1000).toFixed(1)} km`,
      );
    }
  }
  radarCtx.globalAlpha = 1;
  interceptors.forEach((i) => {
    if (!i.mesh.visible) return;
    const x =
        cx +
        (i.mesh.position.x - defender.position.x) * RADAR_PIXELS_PER_WORLD_UNIT,
      y =
        cy +
        (i.mesh.position.z - defender.position.z) * RADAR_PIXELS_PER_WORLD_UNIT;
    radarCtx.fillStyle = "#a4ecff";
    radarCtx.beginPath();
    radarCtx.arc(x, y, 3, 0, Math.PI * 2);
    radarCtx.fill();
  });
}, 100);
setInterval(() => {
  if (!radarCtx) return;
  const state = combatPicture.getSearchState(),
    cx = radarCanvas.width / 2,
    cy = radarCanvas.height / 2;
  if (state.focused) {
    const angle = Math.PI / 2 - state.bearing,
      half = THREE.MathUtils.degToRad(state.width / 2);
    radarCtx.fillStyle = "#45c6bd";
    radarCtx.globalAlpha = 0.1;
    radarCtx.beginPath();
    radarCtx.moveTo(cx, cy);
    radarCtx.arc(cx, cy, 110, angle - half, angle + half);
    radarCtx.closePath();
    radarCtx.fill();
    radarCtx.strokeStyle = "#63d7cf";
    radarCtx.globalAlpha = 0.5;
    radarCtx.stroke();
  }
  for (const track of combatPicture.tracks.values()) {
    if (!track.altitudeKnown) {
      const x =
          cx +
          (track.position.x - defender.position.x) *
            RADAR_PIXELS_PER_WORLD_UNIT,
        y =
          cy +
          (track.position.z - defender.position.z) *
            RADAR_PIXELS_PER_WORLD_UNIT;
      radarCtx.strokeStyle = "#78a7ff";
      radarCtx.globalAlpha = 0.95;
      radarCtx.strokeRect(x - 5, y - 5, 10, 10);
    }
    if (lastAltitudeState.get(track.id) !== track.altitudeKnown) {
      lastAltitudeState.set(track.id, track.altitudeKnown);
      log(
        `TRACK ${track.id} / ${track.altitudeKnown ? `${activeShip.subsystemLabels.primaryRadar} 3D FIRE CONTROL` : `${activeShip.subsystemLabels.secondaryRadar} 2D WARNING ONLY`}`,
      );
    }
  }
  radarCtx.globalAlpha = 1;
}, 100);
function surfaceTargetingSolution(
  strike: NonNullable<ShipDefinition["surfaceStrike"]>,
) {
  const direct = surfacePicture.trackForTarget(1);
  if (
    direct &&
    direct.age <= strike.maximumTrackAge &&
    direct.quality >= strike.requiredTrackQuality
  )
    return {
      track: direct,
      passive: false,
      minimumTrackAge: strike.minimumTrackAge,
      fireControlDelay: strike.fireControlDelay,
    };
  const passive = strike.passiveTargeting;
  if (
    passive &&
    surfaceEsmCue.valid &&
    surfaceEsmCue.age <= strike.maximumTrackAge &&
    surfaceEsmCue.quality >= passive.minimumTrackQuality &&
    surfaceEsmCue.uncertainty <= passive.maximumUncertainty
  )
    return {
      track: surfaceEsmCue,
      passive: true,
      minimumTrackAge: passive.minimumTrackAge,
      fireControlDelay: passive.fireControlDelay,
    };
  return null;
}

function planSurfaceStrike(manual = false) {
  const strike = activeShip.surfaceStrike;
  if (!strike || !enemyPlatform || enemyPlatform.destroyed) {
    if (manual) log("SURFACE STRIKE INHIBIT / NO VALID PLATFORM TARGET");
    return false;
  }
  const solution = surfaceTargetingSolution(strike),
    directTrack = surfacePicture.trackForTarget(1);
  if (!solution) {
    if (manual)
      log(
        `SURFACE STRIKE INHIBIT / ${directTrack && directTrack.age > strike.maximumTrackAge ? `STALE TRACK ${directTrack.age.toFixed(1)}s` : `NO QUALIFIED RADAR OR PASSIVE TARGETING SOLUTION`}`,
      );
    return false;
  }
  const { track } = solution;
  if (
    surfaceTrackStableTime < solution.minimumTrackAge ||
    elapsed < surfaceFireControlReadyAt
  ) {
    if (manual) {
      const confirmationRemaining = Math.max(
          0,
          solution.minimumTrackAge - surfaceTrackStableTime,
        ),
        commandRemaining = Number.isFinite(surfaceFireControlReadyAt)
          ? Math.max(0, surfaceFireControlReadyAt - elapsed)
          : confirmationRemaining + solution.fireControlDelay,
        remaining = Math.max(confirmationRemaining, commandRemaining);
      log(
        `SURFACE STRIKE INHIBIT / FIRE CONTROL BUILD / ${Math.max(0, remaining).toFixed(1)}s REMAINING`,
      );
    }
    return false;
  }
  if (elapsed < nextSurfaceAssessment) {
    if (manual)
      log(
        `SURFACE STRIKE INHIBIT / BDA WINDOW / ${(nextSurfaceAssessment - elapsed).toFixed(1)}s REMAINING`,
      );
    return false;
  }
  const range = track.position.distanceTo(defender.position);
  if (range < strike.minRange || range > strike.maxRange) {
    if (manual)
      log(
        `SURFACE STRIKE INHIBIT / RANGE ${(range / 10).toFixed(1)} km / ENVELOPE ${(strike.minRange / 10).toFixed(1)}-${(strike.maxRange / 10).toFixed(1)} km`,
      );
    return false;
  }
  const hardpoints = shipSurfaceHardpoints(defender).filter(
    (hardpoint) => surfaceHardpointState.get(hardpoint.id) === "ready",
  );
  const liveWeapons = surfaceStrikeMissiles.filter(
      (missile) => missile.phase !== "destroyed",
    ).length,
    resolvedWeapons =
      surfaceHits + surfaceSoftKills + surfacePointDefenseKills + surfaceMisses,
    salvoPlan = planSurfaceSalvo({
      availableWeapons: surfaceStrikeAmmo,
      availableHardpoints: hardpoints.length,
      weaponsInFlight: liveWeapons + surfaceLaunchQueue.length,
      maximumWeaponsInFlight: strike.maximumWeaponsInFlight,
      maximumSalvoSize: strike.salvoSize,
      minimumSalvoSize: strike.minimumSalvoSize,
      expectedLeakProbability: strike.expectedLeakProbability,
      targetHullEstimate: strike.targetHullEstimate,
      weaponDamage: strike.damage,
      assessedHits: surfaceHits,
      resolvedWeapons,
      trackQuality: track.quality,
    }),
    count = salvoPlan.count;
  if (count <= 0) {
    if (manual)
      log(
        surfaceStrikeAmmo <= 0 || hardpoints.length <= 0
          ? "SURFACE STRIKE INHIBIT / HARPOON MAGAZINE EMPTY"
          : salvoPlan.remainingCapacity <= 0
            ? `SURFACE STRIKE INHIBIT / ${liveWeapons + surfaceLaunchQueue.length} WEAPONS COMMITTED / AWAIT ASSESSMENT`
            : "SURFACE STRIKE INHIBIT / ASSESSED WEAPONS EFFECT SUFFICIENT",
      );
    return false;
  }
  let launchAt = Math.max(elapsed, nextSurfaceLaunch);
  const firstLaunchAt = launchAt;
  const directFlightTime = range / 5.8;
  const routeTimeAllowance = strike.routeLateralOffset / 18;
  const commonTerminalAt =
    firstLaunchAt + directFlightTime + routeTimeAllowance;
  const lineOfSight = track.position
    .clone()
    .sub(defender.position)
    .setY(0)
    .normalize();
  const routeAxis = new THREE.Vector3(-lineOfSight.z, 0, lineOfSight.x);
  for (let index = 0; index < count; index++) {
    const hardpoint = hardpoints[index];
    surfaceHardpointState.set(hardpoint.id, "reserved");
    surfaceLaunchQueue.push({
      hardpoint,
      launchAt,
      commandPoint: track.position
        .clone()
        .addScaledVector(track.velocity, strike.datalinkLatency),
      commandVelocity: track.velocity.clone(),
      routeOffset: routeAxis
        .clone()
        .multiplyScalar(
          strike.routeLateralOffset *
            (index % 2 === 0 ? 1 : -1) *
            (0.72 + Math.floor(index / 2) * 0.28),
        ),
      plannedArrivalAt:
        commonTerminalAt +
        (count > 1 ? (index / (count - 1) - 0.5) * strike.arrivalWindow : 0),
    });
    launchAt += strike.minimumInterval;
  }
  nextSurfaceLaunch = launchAt;
  nextSurfaceDecision = launchAt + 7;
  surfaceStrikeWave++;
  surfaceRequiredHits = salvoPlan.requiredHits;
  surfacePlanningLeakProbability = salvoPlan.planningLeakProbability;
  log(
    `SURFACE OODA / WAVE ${surfaceStrikeWave} / ${manual ? "MANUAL" : "AUTO"} / ${count} x ${strike.weapon} / ${salvoPlan.requiredHits} HITS REQUIRED / PLEAK ${Math.round(salvoPlan.planningLeakProbability * 100)}% / ROUTE +/-${(strike.routeLateralOffset / 10).toFixed(1)} km / TOT WINDOW ${strike.arrivalWindow.toFixed(1)}s / ${solution.passive ? "PASSIVE CUE" : `TRACK ${track.id}`} TQ ${Math.round(track.quality * 100)}% / UNC ${(track.uncertainty / 10).toFixed(1)} km / ${(range / 10).toFixed(1)} km`,
  );
  return true;
}

function updateSurfaceCombat(
  dt: number,
  primarySensor: string,
  secondarySensor: string,
  aspectHealth: Record<string, (bearing: number) => number>,
) {
  surfacePicture.update(
    elapsed,
    dt,
    radarEnabled && enemyPlatform && !enemyPlatform.destroyed
      ? [
          {
            id: 1,
            position: enemyPlatform.model.position,
            velocity: enemyPlatform.velocity,
            altitude: enemyPlatform.definition.significantHeightMeters,
            rcs: enemyPlatform.definition.radarCrossSection,
            domain: "surface",
          },
        ]
      : [],
    {
      [primarySensor]: subsystemHealth("primaryRadar"),
      [secondarySensor]: subsystemHealth("secondaryRadar"),
    },
    defender.position,
    aspectHealth,
  );
  surfacePicture.drainEvents().forEach((event) => log(`SURFACE ${event}`));
  const track = surfacePicture.trackForTarget(1);
  const strike = activeShip.surfaceStrike;
  surfaceEsmCue.age += dt;
  const esmHealth = subsystemHealth("ecm");
  if (
    enemyPlatform &&
    opforRadarEnabled &&
    esmHealth > 0.04 &&
    elapsed >= surfaceEsmNextScan
  ) {
    const firstCue = !surfaceEsmCue.valid;
    surfaceEsmNextScan = elapsed + THREE.MathUtils.lerp(1.8, 0.9, esmHealth);
    const delta = enemyPlatform.model.position.clone().sub(defender.position),
      trueRange = delta.length(),
      trueBearing = Math.atan2(delta.z, delta.x),
      bearingError = THREE.MathUtils.degToRad(2.5 + (1 - esmHealth) * 5),
      measuredBearing =
        trueBearing + bearingError * Math.sin(elapsed * 0.31 + 1.1),
      measuredRange =
        trueRange *
        (1 + (0.18 + (1 - esmHealth) * 0.2) * Math.sin(elapsed * 0.19));
    surfaceEsmCue.position
      .copy(defender.position)
      .add(
        new THREE.Vector3(
          Math.cos(measuredBearing),
          0,
          Math.sin(measuredBearing),
        ).multiplyScalar(measuredRange),
      );
    surfaceEsmCue.velocity.copy(enemyPlatform.velocity);
    surfaceEsmCue.quality = THREE.MathUtils.clamp(
      0.12 + esmHealth * 0.08,
      0.12,
      0.2,
    );
    surfaceEsmCue.uncertainty = Math.max(
      70,
      trueRange * (0.26 + (1 - esmHealth) * 0.16),
    );
    surfaceEsmCue.age = 0;
    surfaceEsmCue.valid = true;
    if (firstCue)
      log(
        `SURFACE ESM / BEARING CUE / UNC ${(surfaceEsmCue.uncertainty / 10).toFixed(1)} km / RADAR EMITTER DETECTED`,
      );
  } else if (!opforRadarEnabled || esmHealth <= 0.04) {
    surfaceEsmCue.valid = false;
  }
  const horizonLimited = track?.horizonLimited ?? null;
  if (horizonLimited !== surfaceTrackHorizonLimited) {
    surfaceTrackHorizonLimited = horizonLimited;
    log(
      horizonLimited === true
        ? "SURFACE RADAR / HORIZON LIMITED / INTERMITTENT CONTACT"
        : horizonLimited === false
          ? "SURFACE RADAR / DIRECT VISIBILITY / TRACK MEASUREMENT"
          : "SURFACE RADAR / TRACK LOST / SEARCHING",
    );
  }
  if (!strike) return;
  const targeting = surfaceTargetingSolution(strike);
  if (targeting) {
    const targetingTrack = targeting.track;
    if (surfaceTrackId !== targetingTrack.id) {
      surfaceTrackId = targetingTrack.id;
      surfaceTrackStableTime = 0;
      surfaceFireControlReadyAt = Infinity;
      surfaceFireControlReadyLogged = false;
      log(
        targeting.passive
          ? `SURFACE PASSIVE CUE / SEARCH AREA BUILD / UNC ${(targetingTrack.uncertainty / 10).toFixed(1)} km`
          : `SURFACE TRACK ${targetingTrack.id} / CONTINUITY BUILD`,
      );
    }
    surfaceTrackStableTime += dt;
    if (
      surfaceTrackStableTime >= targeting.minimumTrackAge &&
      !Number.isFinite(surfaceFireControlReadyAt)
    ) {
      surfaceFireControlReadyAt = elapsed + targeting.fireControlDelay;
      log(
        `SURFACE FIRE CONTROL / ${targeting.passive ? "PASSIVE SEARCH BASKET" : `TRACK ${targetingTrack.id} CORRELATED`} / COMMAND DELAY ${targeting.fireControlDelay.toFixed(1)}s`,
      );
    }
    if (
      elapsed >= surfaceFireControlReadyAt &&
      !surfaceFireControlReadyLogged
    ) {
      surfaceFireControlReadyLogged = true;
      log(
        targeting.passive
          ? "SURFACE PASSIVE TARGETING READY / BEARING-ONLY LAUNCH AUTHORIZED"
          : `SURFACE FIRE CONTROL READY / TRACK ${targetingTrack.id}`,
      );
    }
  } else {
    surfaceTrackId = 0;
    surfaceTrackStableTime = 0;
    surfaceFireControlReadyAt = Infinity;
    surfaceFireControlReadyLogged = false;
  }
  if (
    autoSurfaceStrike &&
    elapsed >= nextSurfaceDecision &&
    elapsed >= nextSurfaceAssessment &&
    surfaceLaunchQueue.length === 0 &&
    !surfaceStrikeMissiles.some((missile) => missile.phase !== "destroyed")
  )
    planSurfaceStrike(false);

  for (let index = surfaceLaunchQueue.length - 1; index >= 0; index--) {
    const request = surfaceLaunchQueue[index];
    if (elapsed + 1e-6 < request.launchAt) continue;
    surfaceLaunchQueue.splice(index, 1);
    if (!enemyPlatform || enemyPlatform.destroyed) {
      surfaceHardpointState.set(request.hardpoint.id, "ready");
      continue;
    }
    const strike = activeShip.surfaceStrike!;
    const missile = createSurfaceStrikeMissile(
      surfaceStrikeMissiles.length + 1,
      request.hardpoint,
      enemyPlatform,
      strike,
      request.commandPoint,
      request.commandVelocity,
      request.routeOffset,
      strike.routeJoinRange,
      request.plannedArrivalAt,
      strike.maximumSpeedCompensation,
    );
    surfaceHardpointState.set(request.hardpoint.id, "fired");
    surfaceStrikeAmmo = Math.max(0, surfaceStrikeAmmo - 1);
    surfaceStrikeMissiles.push(missile);
    scene.add(missile.mesh, missile.path);
    log(
      `${activeShip.name} / ${request.hardpoint.id.toUpperCase()} / ${strike.weapon} SURFACE LAUNCH`,
    );
  }

  for (const missile of surfaceStrikeMissiles) {
    if (missile.phase === "destroyed") continue;
    const guidanceSolution = surfaceTargetingSolution(strike),
      guidanceTrack = guidanceSolution?.track;
    if (
      guidanceTrack &&
      guidanceTrack.age <= strike.maximumTrackAge &&
      guidanceTrack.quality >=
        (guidanceSolution.passive
          ? (strike.passiveTargeting?.minimumTrackQuality ??
            strike.datalinkMinimumQuality)
          : strike.datalinkMinimumQuality) &&
      elapsed >= missile.nextDatalink &&
      !missile.seekerAcquired
    ) {
      missile.commandPoint
        .copy(guidanceTrack.position)
        .addScaledVector(guidanceTrack.velocity, strike.datalinkLatency);
      missile.commandVelocity.copy(guidanceTrack.velocity);
      missile.datalinkValid = true;
      missile.nextDatalink = elapsed + strike.datalinkUpdateInterval;
      if (
        missile.lastDatalinkQuality < 0 ||
        Math.abs(guidanceTrack.quality - missile.lastDatalinkQuality) >= 0.12
      ) {
        log(
          `HARPOON ${missile.id} DATALINK UPDATE / ${missile.target.definition.name} ${guidanceSolution.passive ? "PASSIVE CUE" : `TRACK ${guidanceTrack.id}`} / TQ ${Math.round(guidanceTrack.quality * 100)}%`,
        );
        missile.lastDatalinkQuality = guidanceTrack.quality;
      }
    } else if (
      elapsed >= missile.nextDatalink &&
      !missile.seekerAcquired &&
      missile.datalinkValid
    ) {
      missile.datalinkValid = false;
      missile.nextDatalink = elapsed + strike.datalinkUpdateInterval;
      log(`HARPOON ${missile.id} DATALINK LOST / INERTIAL COAST`);
    }
    deployPlatformDecoy(missile);
    const event = updateSurfaceStrikeMissile(
      missile,
      dt,
      elapsed,
      ecmEnabled,
      opforRadarEnabled,
      platformDecoysEnabled
        ? chaffClouds.filter((cloud) => cloud.side === "platform")
        : [],
    );
    if (!event) continue;
    if (event.kind === "seeker-search")
      log(`RGM-84 HARPOON ${missile.id} ACTIVE SEEKER / SEARCH`);
    else if (event.kind === "seeker-acquired")
      log(
        `RGM-84 HARPOON ${missile.id} TARGET ACQUIRED / ${(event.range / 10).toFixed(1)} km / OFF-BORESIGHT ${event.offBoresightDeg.toFixed(1)} DEG`,
      );
    else if (event.kind === "miss") {
      surfaceMisses++;
      nextSurfaceAssessment = Math.max(
        nextSurfaceAssessment,
        elapsed + strike.assessmentDelay,
      );
      log(`HARPOON ${missile.id} MISS / ${event.reason}`);
    } else if (event.kind === "platform-track")
      log(
        `${missile.target.definition.name} INCOMING TRACK / HARPOON ${missile.id} / TQ ${Math.round(event.quality * 100)}% / ${(event.range / 10).toFixed(1)} km`,
      );
    else if (event.kind === "point-defense-ready")
      log(
        `${missile.target.definition.name} POINT DEFENSE READY / HARPOON ${missile.id} / TQ ${Math.round(event.quality * 100)}%`,
      );
    else if (event.kind === "point-defense-fire") {
      recordPlatformPointDefenseShot(
        missile.target,
        event.mountId,
        event.origin,
        event.targetBearing,
        event.traverseError,
      );
      createCiwsTracer(scene, missile.mesh.position, event.origin);
      log(
        `${missile.target.definition.name} POINT DEFENSE FIRE / ${String(missile.target.model.userData.lastPointDefenseMount).toUpperCase()} / HARPOON ${missile.id} / SHOT ${event.engagement}/${event.maximumEngagements} / TOF ${event.timeOfFlight.toFixed(2)}s / PK ${Math.round(event.pk * 100)}% / READY BURSTS ${event.engagementsRemaining}`,
      );
    } else if (event.kind === "point-defense-depleted")
      log(
        `${missile.target.definition.name} POINT DEFENSE / MAGAZINE DEPLETED / HARPOON ${missile.id} LEAKER`,
      );
    else if (event.kind === "point-defense-offline")
      log(
        `${missile.target.definition.name} POINT DEFENSE / SYSTEM OFFLINE / HARPOON ${missile.id} LEAKER`,
      );
    else if (event.kind === "penetration")
      log(
        `HARPOON ${missile.id} PENETRATION / ${event.zone} / LOCAL X ${event.localImpact.x.toFixed(1)} Z ${event.localImpact.z.toFixed(1)} / FUSE ${event.fuseDelay.toFixed(2)}s`,
      );
    else if (event.kind === "soft-kill") {
      surfaceSoftKills++;
      nextSurfaceAssessment = Math.max(
        nextSurfaceAssessment,
        elapsed + strike.assessmentDelay,
      );
      log(
        `${missile.target.definition.name} SOFT KILL / HARPOON ${missile.id} / ${event.mode} / PK ${Math.round(event.pk * 100)}%`,
      );
    } else if (event.kind === "point-defense") {
      surfacePointDefenseKills++;
      nextSurfaceAssessment = Math.max(
        nextSurfaceAssessment,
        elapsed + strike.assessmentDelay,
      );
      createExplosion(missile.mesh.position.clone());
      log(
        `${missile.target.definition.name} POINT DEFENSE / HARPOON ${missile.id} KILL / SHOT ${event.engagement}/${event.maximumEngagements} / PK ${Math.round(event.pk * 100)}% / PRIORITY ${event.threatScore.toFixed(0)} / TTI ${Number.isFinite(event.estimatedTimeToImpact) ? `${event.estimatedTimeToImpact.toFixed(1)}s` : "OPENING"} / TRACKS ${event.localTrackDensity}`,
      );
    } else if (event.kind === "point-defense-miss") {
      log(
        `${missile.target.definition.name} POINT DEFENSE / HARPOON ${missile.id} MISS / SHOT ${event.engagement}/${event.maximumEngagements} / PK ${Math.round(event.pk * 100)}% / PRIORITY ${event.threatScore.toFixed(0)} / TTI ${Number.isFinite(event.estimatedTimeToImpact) ? `${event.estimatedTimeToImpact.toFixed(1)}s` : "OPENING"} / TRACKS ${event.localTrackDensity}`,
      );
    } else {
      surfaceHits++;
      nextSurfaceAssessment = Math.max(
        nextSurfaceAssessment,
        elapsed + strike.assessmentDelay,
      );
      createExplosion(
        event.impactPoint.clone().add(new THREE.Vector3(0, 2, 0)),
      );
      createPlatformDamage(
        missile.target,
        event.damage,
        surfaceHits,
        event.localImpact,
      );
      const hullMaterial = missile.target.model.userData
        .hullMaterial as THREE.MeshStandardMaterial;
      hullMaterial?.color.lerp(new THREE.Color(0x302a28), event.damage / 80);
      log(
        `HARPOON ${missile.id} INTERNAL DETONATION / ${event.zone} / ${event.subsystem.toUpperCase()} DAMAGED / CASUALTY ${event.casualtyId} / FIRE ${event.fire.toFixed(1)} / FLOOD ${event.flooding.toFixed(1)} / ${missile.target.definition.name} / EFFECT ASSESSMENT PENDING`,
      );
      if (event.platformDestroyed) {
        surfaceHardKills++;
        log(`SURFACE KILL / ${missile.target.definition.name} DISABLED`);
      }
    }
    if (
      event.kind === "miss" ||
      event.kind === "soft-kill" ||
      event.kind === "point-defense" ||
      event.kind === "penetration" ||
      event.kind === "hit"
    )
      missile.target.incomingTracks.delete(missile.id);
  }
  canvas.dataset.surfaceTrackQuality = (track?.quality ?? 0).toFixed(3);
  canvas.dataset.surfaceTrackHorizonLimited = String(
    track?.horizonLimited ?? false,
  );
  canvas.dataset.surfaceTrackAge = (track?.age ?? 0).toFixed(2);
  canvas.dataset.surfaceTrackUncertainty = String(
    Math.round(track?.uncertainty ?? 0),
  );
  canvas.dataset.surfaceTrackSpeed = (track?.velocity.length() ?? 0).toFixed(4);
  canvas.dataset.surfaceTrackStableTime = surfaceTrackStableTime.toFixed(2);
  canvas.dataset.surfaceTargetingSource = targeting
    ? targeting.passive
      ? "passive"
      : "radar"
    : "none";
  canvas.dataset.surfaceFireControlState = surfaceFireControlReadyLogged
    ? targeting?.passive
      ? "passive-ready"
      : "ready"
    : Number.isFinite(surfaceFireControlReadyAt)
      ? targeting?.passive
        ? "passive-command-delay"
        : "command-delay"
      : "track-build";
  canvas.dataset.surfaceStrikeAmmo = String(surfaceStrikeAmmo);
  canvas.dataset.surfaceStrikeActive = String(
    surfaceStrikeMissiles.filter((missile) => missile.phase !== "destroyed")
      .length,
  );
  canvas.dataset.surfaceStrikeQueued = String(surfaceLaunchQueue.length);
  canvas.dataset.surfaceHits = String(surfaceHits);
  canvas.dataset.surfaceSoftKills = String(surfaceSoftKills);
  canvas.dataset.surfacePointDefenseKills = String(surfacePointDefenseKills);
  canvas.dataset.surfaceMisses = String(surfaceMisses);
  canvas.dataset.surfaceProgressiveDamage = surfaceProgressiveDamage.toFixed(2);
  canvas.dataset.surfaceAssessmentRemaining = Math.max(
    0,
    nextSurfaceAssessment - elapsed,
  ).toFixed(2);
  canvas.dataset.surfaceStrikeWave = String(surfaceStrikeWave);
  canvas.dataset.surfaceRequiredHits = String(surfaceRequiredHits);
  canvas.dataset.surfacePlanningLeakProbability =
    surfacePlanningLeakProbability.toFixed(3);
  const surfaceBda = activeShip.surfaceStrike
    ? estimateSurfaceBattleDamage({
        targetHullEstimate: activeShip.surfaceStrike.targetHullEstimate,
        weaponDamage: activeShip.surfaceStrike.damage,
        assessedHits: surfaceHits,
        trackQuality: track?.quality ?? 0,
      })
    : null;
  canvas.dataset.surfaceBdaEstimate = surfaceBda
    ? surfaceBda.estimatedRemainingHull.toFixed(1)
    : "0.0";
  canvas.dataset.surfaceBdaLower = String(surfaceBda?.lowerPercent ?? 0);
  canvas.dataset.surfaceBdaUpper = String(surfaceBda?.upperPercent ?? 0);
  canvas.dataset.surfaceBdaDisabledConfidence = (
    surfaceBda?.disabledConfidence ?? 0
  ).toFixed(3);
  const liveSurfaceStrikes = surfaceStrikeMissiles.filter(
    (missile) => missile.phase !== "destroyed",
  );
  canvas.dataset.surfaceStrikePhases = liveSurfaceStrikes
    .map((missile) => missile.phase)
    .join(",");
  canvas.dataset.surfaceStrikeRanges = liveSurfaceStrikes
    .map((missile) =>
      missile.mesh.position
        .distanceTo(missile.target.model.position)
        .toFixed(1),
    )
    .join(",");
  canvas.dataset.surfaceStrikeClosest = liveSurfaceStrikes
    .map((missile) => missile.closestTargetRange.toFixed(1))
    .join(",");
  canvas.dataset.surfaceStrikeDatalinks = liveSurfaceStrikes
    .map((missile) =>
      missile.seekerAcquired
        ? "terminal-autonomous"
        : missile.datalinkValid
          ? "valid"
          : "inertial",
    )
    .join(",");
  canvas.dataset.surfaceStrikeSeekerAcquired = liveSurfaceStrikes
    .map((missile) => String(missile.seekerAcquired))
    .join(",");
  canvas.dataset.surfaceStrikeSeekerStates = liveSurfaceStrikes
    .map((missile) => String(missile.mesh.userData.seekerState ?? "STANDBY"))
    .join(",");
  canvas.dataset.surfaceStrikeCommandErrors = liveSurfaceStrikes
    .map((missile) =>
      missile.commandPoint.distanceTo(missile.target.model.position).toFixed(1),
    )
    .join(",");
  canvas.dataset.surfaceStrikeRouteOffsets = liveSurfaceStrikes
    .map((missile) => missile.routeOffset.length().toFixed(1))
    .join(",");
  canvas.dataset.surfaceStrikeRouteVectors = liveSurfaceStrikes
    .map(
      (missile) =>
        `${missile.routeOffset.x.toFixed(1)}:${missile.routeOffset.z.toFixed(1)}`,
    )
    .join(",");
  canvas.dataset.surfaceStrikeArrivalPlans = liveSurfaceStrikes
    .map((missile) => missile.plannedArrivalAt.toFixed(2))
    .join(",");
  canvas.dataset.surfaceStrikeTerminalTimes = surfaceStrikeMissiles
    .map((missile) =>
      missile.terminalEnteredAt === null
        ? "pending"
        : missile.terminalEnteredAt.toFixed(2),
    )
    .join(",");
  canvas.dataset.surfaceStrikePointDefensePending = liveSurfaceStrikes
    .map((missile) =>
      missile.pendingPointDefense
        ? Math.max(0, missile.pendingPointDefense.resolveAt - elapsed).toFixed(
            2,
          )
        : "none",
    )
    .join(",");
  canvas.dataset.surfaceStrikeDetonationsPending = liveSurfaceStrikes
    .map((missile) =>
      missile.pendingDetonation
        ? Math.max(0, missile.pendingDetonation.detonateAt - elapsed).toFixed(2)
        : "none",
    )
    .join(",");
  const platformDefense = enemyPlatform?.definition.survivability.pointDefense;
  const incomingDefenseTracks = liveSurfaceStrikes.map((missile) =>
    missile.target.incomingTracks.get(missile.id),
  );
  canvas.dataset.platformIncomingTrackStates = incomingDefenseTracks
    .map((incomingTrack) => {
      if (!incomingTrack || !platformDefense) return "none";
      const valid =
        incomingTrack.quality >= platformDefense.minimumTrackQuality &&
        elapsed - incomingTrack.lastUpdate <= platformDefense.trackMemory;
      if (!valid) return incomingTrack.detectionLogged ? "stale" : "searching";
      return elapsed >= incomingTrack.fireControlReadyAt ? "ready" : "reaction";
    })
    .join(",");
  canvas.dataset.platformIncomingTrackQualities = incomingDefenseTracks
    .map((incomingTrack) => (incomingTrack?.quality ?? 0).toFixed(3))
    .join(",");
  canvas.dataset.platformIncomingTrackAges = incomingDefenseTracks
    .map((incomingTrack) =>
      Number.isFinite(incomingTrack?.lastUpdate)
        ? Math.max(0, elapsed - incomingTrack!.lastUpdate).toFixed(2)
        : "inf",
    )
    .join(",");
  canvas.dataset.platformIncomingTrackEngagements = incomingDefenseTracks
    .map((incomingTrack) =>
      incomingTrack && enemyPlatform
        ? (enemyPlatform.defenseEngagements.get(
            platformDefenseTargetId(incomingTrack.missileId),
          )?.shots ?? 0)
        : 0,
    )
    .join(",");
  canvas.dataset.platformIncomingTrackReengagement = incomingDefenseTracks
    .map((incomingTrack) =>
      incomingTrack
        ? Math.max(0, incomingTrack.nextEngagementReadyAt - elapsed).toFixed(2)
        : "0.00",
    )
    .join(",");
  const prioritizedIncomingTracks = enemyPlatform
    ? [...enemyPlatform.incomingTracks.values()]
        .filter((incomingTrack) => incomingTrack.threatScore > 0)
        .sort(
          (left, right) =>
            right.threatScore - left.threatScore ||
            left.missileId - right.missileId,
        )
    : [];
  canvas.dataset.platformThreatPriority = prioritizedIncomingTracks
    .map((incomingTrack) => incomingTrack.missileId)
    .join(",");
  canvas.dataset.platformThreatScores = prioritizedIncomingTracks
    .map((incomingTrack) => incomingTrack.threatScore.toFixed(1))
    .join(",");
  canvas.dataset.platformThreatTtis = prioritizedIncomingTracks
    .map((incomingTrack) =>
      Number.isFinite(incomingTrack.estimatedTimeToImpact)
        ? incomingTrack.estimatedTimeToImpact.toFixed(1)
        : "inf",
    )
    .join(",");
  canvas.dataset.platformThreatLocalDensities = prioritizedIncomingTracks
    .map((incomingTrack) => incomingTrack.localTrackDensity)
    .join(",");
  canvas.dataset.platformDefenseChannels = (
    enemyPlatform?.pointDefenseChannelReady ?? []
  )
    .map((readyAt) => Math.max(0, readyAt - elapsed).toFixed(2))
    .join(",");
  canvas.dataset.platformDefenseEngagementsRemaining = String(
    enemyPlatform?.pointDefenseEngagementsRemaining ?? 0,
  );
  canvas.dataset.platformDefenseDepleted = String(
    enemyPlatform?.pointDefenseDepletedLogged ?? false,
  );
  const platformPointDefenseCapability = enemyPlatform
    ? pointDefenseCapability(enemyPlatform)
    : null;
  canvas.dataset.platformDefenseHealth = (
    (platformPointDefenseCapability?.health ?? 0) * 100
  ).toFixed(0);
  canvas.dataset.platformDefenseEffectiveChannels = String(
    platformPointDefenseCapability?.effectiveChannels ?? 0,
  );
  canvas.dataset.platformDefenseReactionMultiplier = (
    platformPointDefenseCapability?.reactionMultiplier ?? 0
  ).toFixed(2);
  canvas.dataset.platformDefenseCycleMultiplier = (
    platformPointDefenseCapability?.cycleMultiplier ?? 0
  ).toFixed(2);
  canvas.dataset.platformDefenseOffline = String(
    enemyPlatform?.pointDefenseOfflineLogged ?? false,
  );
  canvas.dataset.platformPointDefenseMounts = String(
    enemyPlatform?.slots.pointDefenseMounts.length ?? 0,
  );
  canvas.dataset.platformPointDefenseShots = String(
    enemyPlatform?.model.userData.pointDefenseShots ?? 0,
  );
  canvas.dataset.platformPointDefenseLastMount = String(
    enemyPlatform?.model.userData.lastPointDefenseMount ?? "none",
  );
  canvas.dataset.platformPointDefenseLastBearing = Number(
    enemyPlatform?.model.userData.lastPointDefenseBearing ?? 0,
  ).toFixed(4);
  canvas.dataset.platformPointDefenseLastTraverseError = Number(
    enemyPlatform?.model.userData.lastPointDefenseTraverseError ?? 0,
  ).toFixed(4);
  const lastPointDefenseMountId = enemyPlatform?.model.userData
    .lastPointDefenseMount as string | undefined;
  const lastPointDefenseMount = enemyPlatform?.slots.pointDefenseMounts.find(
    (mount) => mount.id === lastPointDefenseMountId,
  );
  canvas.dataset.platformPointDefenseLastSectorCenter = Number(
    lastPointDefenseMount?.sectorCenter ?? 0,
  ).toFixed(4);
  canvas.dataset.platformPointDefenseLastSectorHalfAngle = Number(
    lastPointDefenseMount?.sectorHalfAngle ?? 0,
  ).toFixed(4);
  canvas.dataset.platformPointDefenseLastAlignmentTolerance = Number(
    lastPointDefenseMount?.alignmentTolerance ?? 0,
  ).toFixed(4);
  canvas.dataset.platformPointDefenseMountHistory = (
    (enemyPlatform?.model.userData.pointDefenseMountHistory ?? []) as string[]
  ).join(",");
  canvas.dataset.platformPointDefenseOriginOffset = Number(
    enemyPlatform?.model.userData.pointDefenseOriginOffset ?? 0,
  ).toFixed(2);
  canvas.dataset.platformIncomingTrackCount = String(
    enemyPlatform
      ? [...enemyPlatform.incomingTracks.values()].filter(
          (incomingTrack) => incomingTrack.detectionLogged,
        ).length
      : 0,
  );
  canvas.dataset.platformDecoyRounds = String(enemyPlatform?.decoyRounds ?? 0);
  canvas.dataset.platformDecoyClouds = String(
    chaffClouds.filter((cloud) => cloud.side === "platform").length,
  );
  canvas.dataset.platformEcmState = !enemyPlatform
    ? "not-applicable"
    : !ecmEnabled
      ? "hold"
      : (enemyPlatform.subsystemHealth.get("electronic-warfare") ?? 100) <= 5
        ? "failed"
        : "active";
  canvas.dataset.platformDecoyState = !enemyPlatform
    ? "not-applicable"
    : !platformDecoysEnabled
      ? "hold"
      : (enemyPlatform.subsystemHealth.get("countermeasures") ?? 100) <= 5
        ? "failed"
        : enemyPlatform.decoyRounds <= 0
          ? "depleted"
          : "auto";
  canvas.dataset.platformEcmHealth = String(
    Math.round(enemyPlatform?.subsystemHealth.get("electronic-warfare") ?? 0),
  );
  canvas.dataset.platformCountermeasureHealth = String(
    Math.round(enemyPlatform?.subsystemHealth.get("countermeasures") ?? 0),
  );
  canvas.dataset.platformSubsystemHealth = enemyPlatform
    ? [...enemyPlatform.subsystemHealth.entries()]
        .map(([system, health]) => `${system}:${health.toFixed(1)}`)
        .join(",")
    : "";
  canvas.dataset.platformCasualtyCount = String(
    enemyPlatform?.casualties.length ?? 0,
  );
  canvas.dataset.platformCasualties = enemyPlatform
    ? enemyPlatform.casualties
        .map(
          (casualty) =>
            `${casualty.id}:${casualty.zone}:${casualty.fire.toFixed(1)}:${casualty.flooding.toFixed(1)}`,
        )
        .join(",")
    : "";
  canvas.dataset.platformDamageControlHealth = String(
    Math.round(enemyPlatform?.subsystemHealth.get("damage-control") ?? 0),
  );
  canvas.dataset.enemyPlatformHull = String(
    Math.round(enemyPlatform?.hullIntegrity ?? 0),
  );
  canvas.dataset.enemyPlatformDestroyed = String(
    enemyPlatform?.destroyed ?? false,
  );
}
function updateCombat(dt: number) {
  updateCiws();
  updateBoosterDebris(dt);
  updateVlsLaunchEffects(dt);
  updateCountermeasures(dt);
  const primaryDefinition =
      activeShip.sensors.find((sensor) => sensor.threeDimensional) ??
      activeShip.sensors[0],
    primarySensor = primaryDefinition.name,
    secondarySensor =
      activeShip.sensors.find((sensor) => !sensor.threeDimensional)?.name ??
      activeShip.sensors[1]?.name ??
      primarySensor,
    aspectHealth =
      activeShip.fixedSensorFaces?.sensorName === primarySensor
        ? { [primarySensor]: fixedSensorAspectHealth }
        : {};
  combatPicture.update(
    elapsed,
    dt,
    radarEnabled
      ? defenseTargets.observableEntries().map(([id, target]) => ({
          id,
          position: target.mesh.position,
          velocity: target.velocity,
          altitude: target.mesh.position.y * 50,
          rcs: target.rcs,
        }))
      : [],
    {
      [primarySensor]: subsystemHealth("primaryRadar"),
      [secondarySensor]: subsystemHealth("secondaryRadar"),
    },
    defender.position,
    aspectHealth,
  );
  const radarState = combatPicture.getSearchState(),
    primaryTracks = [...combatPicture.tracks.values()].filter((track) =>
      track.sensorContributors.includes(primarySensor),
    ),
    outsideFocus = radarState.focused
      ? primaryTracks.filter(
          (track) =>
            track.age <= primaryDefinition.baseInterval * 2.2 &&
            Math.abs(
              angleDifference(
                Math.atan2(
                  track.position.x - defender.position.x,
                  track.position.z - defender.position.z,
                ),
                radarState.bearing,
              ),
            ) > THREE.MathUtils.degToRad(radarState.width / 2),
        ).length
      : 0;
  canvas.dataset.radarScanMode = primaryDefinition.scanMode ?? "mechanical";
  canvas.dataset.radarPrimaryTracks = String(primaryTracks.length);
  canvas.dataset.radarBackgroundTracks = String(outsideFocus);
  updateSurfaceCombat(dt, primarySensor, secondarySensor, aspectHealth);
  updateShipManeuver(dt);
  if (activeShip.launcher.kind === "mk10") updateMk10Launchers(dt);
  else updateVlsCells(dt);
  combatPicture.drainEvents().forEach((event) => log(event));
  const activeInterceptors = interceptors.filter((i) => i.mesh.visible),
    pending = pendingLauncherRequests(),
    active = activeInterceptors.length + pending.length,
    assignments = new Map<DefenseTarget, number>();
  activeInterceptors.forEach((i) =>
    assignments.set(i.target, (assignments.get(i.target) ?? 0) + 1),
  );
  pending.forEach((request) =>
    assignments.set(request.target, (assignments.get(request.target) ?? 0) + 1),
  );
  const eligibleDefenseTracks = [...combatPicture.tracks.values()].filter(
    (t) => {
      const missile = defenseTargetForSource(t.sourceId);
      return (
        missile &&
        missile.phase !== "destroyed" &&
        t.altitudeKnown &&
        t.solutionQuality >= 0.45 &&
        t.age < 2.2 &&
        (assignments.get(missile) ?? 0) <
          defensiveShotRequirement(missile, t.quality)
      );
    },
  );
  const defenseTrackBySource = new Map(
      eligibleDefenseTracks.map((track) => [track.sourceId, track]),
    ),
    defenseObservations = eligibleDefenseTracks.map((track) =>
      adaptCombatTrack(track, defenseTargetForSource(track.sourceId)!),
    ),
    defensePlan = planDefenseEngagement({
      origin: defender.position,
      observations: defenseObservations,
      policy: {
        acceptedKinds: ["missile", "aircraft", "ship", "unknown"],
      },
      engagements,
      weapons: [
        { weapon: "RIM-67", rounds: ammo, envelope: weaponProfiles["RIM-67"] },
        { weapon: "SM-2MR", rounds: sm2Ammo, envelope: weaponProfiles["SM-2MR"] },
        { weapon: "SM-2ER", rounds: sm2erAmmo, envelope: weaponProfiles["SM-2ER"] },
      ],
      scoreObservation: (observation) => {
        const track = defenseTrackBySource.get(observation.id),
          target = track ? defenseTargetForSource(track.sourceId) : undefined;
        return track && target ? missileThreatScore(target, track) : -Infinity;
      },
    }),
    best = defensePlan
      ? defenseTrackBySource.get(defensePlan.observation.id)
      : undefined;
  const terminalSm2 = activeInterceptors
    .filter(
      (i) =>
        i.weapon.startsWith("SM-2") &&
        i.target.phase !== "destroyed" &&
        i.mesh.position.distanceTo(i.target.mesh.position) <
          weaponProfiles[i.weapon].terminalRange,
    )
    .sort(
      (a, b) =>
        a.mesh.position.distanceTo(a.target.mesh.position) -
        b.mesh.position.distanceTo(b.target.mesh.position),
    );
  scheduleIlluminators(terminalSm2, 0.05);
  updateShipStatus();
  const selected = missiles[selectedTargetId - 1],
    selectedTrack = combatPicture.trackForTarget(selectedTargetId);
  if (selected && selected.phase !== "destroyed") {
    const range = selected.mesh.position.distanceTo(defender.position),
      profile = weaponProfiles[selectedWeapon],
      inRange = range >= profile.minRange && range <= profile.maxRange,
      fireControl = !!selectedTrack?.altitudeKnown,
      solutionReady = (selectedTrack?.solutionQuality ?? 0) >= 0.45,
      envelopeState = !fireControl
        ? "NO 3D SOLUTION"
        : !solutionReady
          ? `FC BUILD ${Math.round((selectedTrack?.solutionQuality ?? 0) * 100)}%`
          : range < profile.minRange
            ? "INSIDE MIN RANGE / CIWS"
            : range > profile.maxRange
              ? "OUT OF ENVELOPE"
              : "IN RANGE";
    threatName.textContent = `TRACK ${selectedTrack ? String(selectedTrack.id).padStart(2, "0") : "--"} / ${selectedTrack?.classification === "classified" ? selected.threatType : (selectedTrack?.classification.toUpperCase() ?? "PENDING ID")}`;
    threatRange.textContent = `${(range / 10).toFixed(1)} km`;
    threatAltitude.textContent = selectedTrack
      ? fireControl
        ? `${Math.round(selectedTrack.altitudeEstimate)} m / +/-${Math.round(selectedTrack.altitudeUncertainty)} m`
        : "2D / ALTITUDE UNKNOWN"
      : "NO DATA";
    trackQuality.textContent = selectedTrack
      ? `TQ ${Math.round(selectedTrack.quality * 100)}% / FC ${Math.round(selectedTrack.solutionQuality * 100)}% ${selectedTrack.solutionTime.toFixed(1)}s / ${selectedTrack.sensorContributors.map((s) => s.replace("AN/", "")).join("+")}`
      : "NO DATA";
    threatTti.textContent = `${Math.max(0, Math.round(range / Math.max(1, selected.velocity.length())))} s`;
    qualityFill.style.width = `${Math.round((selectedTrack?.solutionQuality ?? 0) * 100)}%`;
    weaponEnvelope.textContent = `${selectedWeapon} / ${envelopeState}`;
    weaponEnvelope.className =
      fireControl && solutionReady && inRange ? "in-range" : "out-range";
  }
  if (
    running &&
    autoFire &&
    elapsed > 2 &&
    elapsed >= nextSamLaunch &&
    active < maxSamChannels &&
    best &&
    defensePlan
  ) {
    const target = defenseTargetForSource(best.sourceId)!;
    selectedWeapon = defensePlan.weapon;
    if (queueInterceptorLaunch(target, selectedWeapon)) {
      nextSamLaunch = elapsed + 0.12;
      changeAmmo(selectedWeapon, -1);
    } else nextSamLaunch = elapsed + 1;
    weaponButton.textContent = `WEAPON: ${selectedWeapon}`;
  }
  interceptors.forEach((i) => {
    if (!i.mesh.visible) return;
    if (i.target.phase === "destroyed") {
      settleEngagement(i, "cancel");
      i.mesh.visible = false;
      i.illuminationBeam.visible = false;
      return;
    }
    const profile = weaponProfiles[i.weapon];
    i.age += dt;
    if (i.age >= profile.boost) separateBooster(i);
    const range = i.mesh.position.distanceTo(i.target.mesh.position),
      speed = Math.max(1, i.velocity.length()),
      expectedInterceptorSpeed = Math.max(speed, profile.maxSpeed * 0.58),
      timeToGo = Math.min(
        4,
        range / (expectedInterceptorSpeed + i.target.velocity.length()),
      ),
      terminal = range < profile.terminalRange,
      trackId = defenseSourceForTarget(i.target);
    i.commandPoint.addScaledVector(i.commandVelocity, dt);
    if (!terminal && elapsed >= i.nextDatalink) {
      const track = combatPicture.trackForTarget(trackId);
      if (
        track &&
        track.altitudeKnown &&
        track.age < 2.2 &&
        track.quality > 0.08
      ) {
        const delay = 0.2 + (1 - track.quality) * 0.85,
          solution = track.position
            .clone()
            .addScaledVector(track.velocity, delay + timeToGo * 0.65);
        i.commandPoint.lerp(solution, 0.68);
        i.commandVelocity.lerp(track.velocity, 0.6);
        i.datalinkValid = true;
        i.nextDatalink = elapsed + 0.38 + (1 - track.quality) * 1.05;
      } else {
        i.datalinkValid = false;
        i.nextDatalink = elapsed + 0.55;
      }
    }
    if (terminal && i.weapon === "RIM-67" && !i.mesh.userData.seekerOn) {
      i.mesh.userData.seekerOn = true;
      i.mesh.userData.seekerOnAt = elapsed;
      i.mesh.userData.handoffError = i.commandPoint.distanceTo(
        i.target.mesh.position,
      );
      log(
        `RIM-67 SEEKER ON / TRACK ${trackId} / ${(range / WORLD_UNITS_PER_KM).toFixed(1)} km / HANDOFF +/-${(i.mesh.userData.handoffError / WORLD_UNITS_PER_KM).toFixed(2)} km`,
      );
    }
    const seekerReady =
      i.weapon === "RIM-67" &&
      i.mesh.userData.seekerOn &&
      elapsed - (i.mesh.userData.seekerOnAt ?? elapsed) >= 0.35;
    if (terminal && seekerReady && !i.mesh.userData.seekerAcquired) {
      const lookAngle = i.velocity
          .clone()
          .normalize()
          .angleTo(
            i.target.mesh.position.clone().sub(i.mesh.position).normalize(),
          ),
        fov = THREE.MathUtils.degToRad(32),
        rangeGain = THREE.MathUtils.clamp(
          1 - range / profile.terminalRange,
          0,
          1,
        ),
        handoffPenalty = THREE.MathUtils.clamp(
          (i.mesh.userData.handoffError ?? 0) / (profile.terminalRange * 0.35),
          0,
          0.28,
        ),
        localContacts = missiles.filter(
          (m) =>
            m.phase !== "destroyed" &&
            m !== i.target &&
            m.mesh.position.distanceTo(i.target.mesh.position) < 20,
        ).length,
        competitionPenalty = Math.min(0.24, localContacts * 0.06),
        seaClutterPenalty =
          i.target.mesh.position.y < 1.5 &&
          i.mesh.position.y - i.target.mesh.position.y > 4
            ? 0.12
            : 0,
        aspectAngle = i.target.velocity
          .clone()
          .normalize()
          .angleTo(
            i.mesh.position.clone().sub(i.target.mesh.position).normalize(),
          ),
        aspectRcs = i.target.rcs * (0.62 + 0.38 * Math.sin(aspectAngle)),
        acquisitionPk = THREE.MathUtils.clamp(
          0.58 +
            rangeGain * 0.3 +
            aspectRcs * 0.06 -
            (lookAngle / fov) * 0.18 -
            handoffPenalty -
            competitionPenalty -
            seaClutterPenalty,
          0.2,
          0.96,
        ),
        acquisitionRoll = deterministicProbabilityRoll(
          i.mesh.userData.launchSerial,
          defenseSourceSeed(trackId),
          Math.floor(i.age * 4),
          67,
        );
      if (lookAngle < fov && acquisitionRoll < acquisitionPk) {
        i.mesh.userData.seekerAcquired = true;
        i.mesh.userData.seekerConfidence = 0.35;
        log(
          `RIM-67 SEEKER CAPTURE / TRACK ${trackId} / FOV ${Math.round(THREE.MathUtils.radToDeg(lookAngle))} DEG / PK ${Math.round(acquisitionPk * 100)}% / RCS ${aspectRcs.toFixed(2)} / ${localContacts} COMPETING${seaClutterPenalty ? " / SEA CLUTTER" : ""}`,
        );
      }
    }
    if (terminal && i.weapon === "RIM-67" && i.mesh.userData.seekerAcquired) {
      const lineOfSight = i.target.mesh.position
          .clone()
          .sub(i.mesh.position)
          .normalize(),
        trackingAngle = i.velocity.clone().normalize().angleTo(lineOfSight),
        losRate = i.mesh.userData.lastSeekerLos
          ? i.mesh.userData.lastSeekerLos.angleTo(lineOfSight) /
            Math.max(dt, 0.001)
          : 0;
      i.mesh.userData.lastSeekerLos = lineOfSight.clone();
      const gimbalExceeded =
        trackingAngle > THREE.MathUtils.degToRad(45) ||
        losRate > THREE.MathUtils.degToRad(70);
      if (gimbalExceeded) {
        if (i.mesh.userData.seekerBreakAt === undefined)
          i.mesh.userData.seekerBreakAt = elapsed;
        if (elapsed - i.mesh.userData.seekerBreakAt > 0.65) {
          i.mesh.userData.seekerAcquired = false;
          i.mesh.userData.seekerCoastUntil = elapsed + 0.45;
          i.mesh.userData.seekerBreakAt = undefined;
          log(
            `RIM-67 SEEKER BREAK / TRACK ${trackId} / ${Math.round(THREE.MathUtils.radToDeg(trackingAngle))} DEG / RATE ${Math.round(THREE.MathUtils.radToDeg(losRate))} DPS`,
          );
        }
      } else i.mesh.userData.seekerBreakAt = undefined;
    }
    if (i.mesh.userData.seekerAcquired) {
      if (i.mesh.userData.seekerAimPoint)
        i.mesh.userData.seekerAimPoint.addScaledVector(i.target.velocity, dt);
      if (elapsed >= (i.mesh.userData.nextSeekerUpdate ?? 0)) {
        const noise = Math.min(
            2.2,
            range * (0.006 + (1 - i.target.rcs) * 0.004),
          ),
          seed = defenseSourceSeed(trackId) * 19.3 + Math.floor(elapsed * 8.3);
        i.mesh.userData.seekerAimPoint = i.target.mesh.position
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(seed) * noise,
              Math.cos(seed * 1.7) * noise * 0.35,
              Math.sin(seed * 2.1) * noise,
            ),
          );
        i.mesh.userData.seekerConfidence = Math.min(
          1,
          (i.mesh.userData.seekerConfidence ?? 0.35) + 0.12,
        );
        i.mesh.userData.nextSeekerUpdate = elapsed + 0.12;
      }
    }
    const seekerCoasting =
      i.weapon === "RIM-67" &&
      !i.mesh.userData.seekerAcquired &&
      elapsed < (i.mesh.userData.seekerCoastUntil ?? 0);
    if (seekerCoasting)
      i.mesh.userData.seekerConfidence = Math.max(
        0.12,
        (i.mesh.userData.seekerConfidence ?? 0.35) - dt * 0.9,
      );
    const nearestChaff = chaffClouds
        .filter(
          (c) =>
            c.age < 12 && c.position.distanceTo(i.target.mesh.position) < 18,
        )
        .sort((a, b) => b.rcs - a.rcs)[0],
      decoyProbability = nearestChaff
        ? nearestChaff.rcs / (nearestChaff.rcs + i.target.rcs)
        : 0,
      decoyCaptured =
        i.weapon.startsWith("SM-2") &&
        terminal &&
        !!nearestChaff &&
        deterministicProbabilityRoll(
          i.mesh.userData.launchSerial,
          defenseSourceSeed(trackId),
          Math.floor(elapsed * 2),
          2,
        ) < decoyProbability,
      ecmStrength =
        ecmEnabled && i.weapon.startsWith("SM-2")
          ? THREE.MathUtils.clamp(range / 320, 0, 0.65)
          : 0,
      ecmOffset = new THREE.Vector3(
        Math.sin(elapsed * 3.1 + defenseSourceSeed(trackId)) * ecmStrength * 4,
        Math.cos(elapsed * 2.7) * ecmStrength,
        Math.sin(elapsed * 2.3 + 1) * ecmStrength * 4,
      );
    i.mesh.userData.ecmStrength = ecmStrength;
    if (
      ecmEnabled &&
      i.weapon.startsWith("SM-2") &&
      terminal &&
      range < 90 &&
      !i.mesh.userData.burnThrough
    ) {
      i.mesh.userData.burnThrough = true;
      log(
        `${i.weapon} ECM BURN-THROUGH / TRACK ${trackId} / ${(range / WORLD_UNITS_PER_KM).toFixed(1)} km`,
      );
    }
    if (decoyCaptured && !i.mesh.userData.decoyCaptured) {
      i.mesh.userData.decoyCaptured = true;
      log(
        `${i.weapon} DECOY CAPTURE / CHAFF RCS ${nearestChaff.rcs.toFixed(1)}`,
      );
    }
    if (!decoyCaptured) i.mesh.userData.decoyCaptured = false;
    const terminalHoming =
        terminal &&
        (i.weapon === "RIM-67"
          ? !!i.mesh.userData.seekerAcquired || seekerCoasting
          : i.illuminated),
      terminalAim =
        i.weapon === "RIM-67" && i.mesh.userData.seekerAimPoint
          ? i.mesh.userData.seekerAimPoint
          : decoyCaptured && nearestChaff
            ? nearestChaff.position
            : i.target.mesh.position.clone().add(ecmOffset),
      seekerBlend =
        i.weapon === "RIM-67" ? (i.mesh.userData.seekerConfidence ?? 0.35) : 1,
      aim = terminalHoming
        ? i.commandPoint
            .clone()
            .lerp(
              terminalAim
                .clone()
                .addScaledVector(
                  decoyCaptured
                    ? (nearestChaff?.velocity ?? i.target.velocity)
                    : i.target.velocity,
                  timeToGo * 0.8,
                ),
              seekerBlend,
            )
        : i.commandPoint.clone();
    const seaSkimmer =
        incomingProfiles[i.target.threatType].trajectory === "sea-skimmer",
      estimatedLaunchRange = Math.min(
        profile.maxRange,
        range + i.distanceTraveled,
      ),
      loftFactor = THREE.MathUtils.clamp(
        (estimatedLaunchRange - profile.terminalRange) /
          Math.max(1, profile.maxRange - profile.terminalRange),
        0,
        1,
      );
    if (seaSkimmer) {
      // Against sea skimmers, clear the launcher and pitch toward a shallow forward corridor.
      // Low-altitude threats use a forward corridor instead of an energy-saving loft.
      const launchClearance = THREE.MathUtils.smoothstep(
        i.age,
        0,
        Math.min(0.65, profile.boost * 0.14),
      );
      const lowAltitudeCorridor =
        i.target.mesh.position.y +
        THREE.MathUtils.lerp(3.2, 1.8, launchClearance) +
        loftFactor * 0.5;
      aim.y = lowAltitudeCorridor;
      if (!i.mesh.userData.trajectoryProfileLogged) {
        i.mesh.userData.trajectoryProfileLogged = true;
        log(
          `${i.weapon} SEA-SKIMMER FORWARD INTERCEPT / ${i.target.threatType} / CRUISE ALT ${Math.round(lowAltitudeCorridor * 50)} m`,
        );
      }
    } else if (i.age < profile.boost)
      aim.y = Math.max(aim.y, 20 + loftFactor * 28);
    else if (!terminal) aim.y += Math.min(34, range * 0.16);
    const guidanceDirection = aim.sub(i.mesh.position).normalize(),
      verticalDirection = i.mesh.userData.verticalDirection as
        THREE.Vector3 | undefined,
      verticalBlend = i.mesh.userData.vlsLaunch
        ? THREE.MathUtils.smoothstep(
            i.age,
            seaSkimmer ? 0.06 : 0.78,
            seaSkimmer ? 0.24 : 1.85,
          )
        : 1,
      desired = verticalDirection
        ? verticalDirection
            .clone()
            .lerp(guidanceDirection, verticalBlend)
            .normalize()
        : guidanceDirection,
      current = i.velocity.clone().normalize(),
      turnSign = current.clone().cross(desired).y,
      angle = current.angleTo(desired),
      boosterSeparated = !!i.mesh.userData.boosterSeparated,
      massFactor = boosterSeparated ? 1 : 0.68,
      boostTurnFactor = seaSkimmer ? 14 : 0.62,
      turnLimit =
        profile.turnRate *
        dt *
        (terminal ? 2.2 : i.age < profile.boost ? boostTurnFactor : 1) *
        massFactor,
      turnDemand = THREE.MathUtils.clamp(
        angle / Math.max(0.001, turnLimit),
        0,
        1,
      ),
      blend = angle > 0 ? Math.min(1, turnLimit / angle) : 1,
      direction = current.lerp(desired, blend).normalize(),
      rangeFraction = Math.min(1, i.distanceTraveled / profile.maxRange),
      commandedSpeed = profile.maxSpeed * (1 - rangeFraction * 0.1),
      dragLoss = (0.18 + 0.72 * turnDemand) * (terminal ? 1.15 : 1) * dt,
      nextSpeed = Math.max(
        profile.maxSpeed * 0.28,
        Math.min(
          commandedSpeed,
          speed + profile.acceleration * massFactor * dt,
        ) - dragLoss,
      ),
      previousPosition = i.mesh.position.clone();
    i.mesh.userData.energy = Math.max(
      0,
      (i.mesh.userData.energy ?? 1) - dragLoss * 0.028,
    );
    i.velocity.copy(direction.multiplyScalar(nextSpeed));
    i.mesh.position.addScaledVector(i.velocity, dt);
    i.distanceTraveled += nextSpeed * dt;
    i.mesh.userData.maxAltitude = Math.max(
      i.mesh.userData.maxAltitude ?? i.mesh.position.y,
      i.mesh.position.y,
    );
    canvas.dataset.interceptorMaxAltitude = (
      i.mesh.userData.maxAltitude as number
    ).toFixed(2);
    canvas.dataset.interceptorTrajectory = seaSkimmer
      ? "low-altitude"
      : "high-altitude";
    const targetBank = THREE.MathUtils.clamp(turnSign * 12, -0.7, 0.7),
      attitudeBank = THREE.MathUtils.lerp(
        i.mesh.userData.flightBank ?? 0,
        targetBank,
        Math.min(1, dt * 2.8),
      );
    i.mesh.userData.flightBank = attitudeBank;
    setMissileAttitude(i.mesh, direction, "+Y", attitudeBank);
    const closestPoint = new THREE.Vector3();
    new THREE.Line3(previousPosition, i.mesh.position).closestPointToPoint(
      i.target.mesh.position,
      true,
      closestPoint,
    );
    const postRange = i.mesh.position.distanceTo(i.target.mesh.position),
      interceptDistance = Math.min(
        range,
        postRange,
        closestPoint.distanceTo(i.target.mesh.position),
      );
    if (i.history[i.history.length - 1].distanceTo(i.mesh.position) > 2.2) {
      i.history.push(i.mesh.position.clone());
      if (i.history.length > 140) i.history.shift();
      i.guidancePath.geometry.dispose();
      i.guidancePath.geometry = new THREE.BufferGeometry().setFromPoints(
        i.history,
      );
    }
    const needsIllumination = i.weapon.startsWith("SM-2") && terminal,
      seekerConfidence = Math.round(
        (i.mesh.userData.seekerConfidence ?? 0) * 100,
      );
    if (needsIllumination) {
      if (i.illuminated) i.mesh.userData.illuminationLostAt = undefined;
      else if (i.mesh.userData.illuminationLostAt === undefined)
        i.mesh.userData.illuminationLostAt = elapsed;
      if (
        typeof i.mesh.userData.illuminationLostAt === "number" &&
        elapsed - i.mesh.userData.illuminationLostAt > 2.5
      ) {
        settleEngagement(i, "miss");
        i.mesh.visible = false;
        i.illuminationBeam.visible = false;
        log(
          `${i.weapon} MISS / ${activeShip.subsystemLabels.fireControl} ILLUMINATION LOST`,
        );
        return;
      }
    }
    phaseEl.textContent =
      i.age < profile.boost
        ? seaSkimmer
          ? "BOOST / LOW-ALTITUDE PROGRAM TURN"
          : "BOOST / LOFT CLIMB"
        : needsIllumination
          ? i.illuminated
            ? `TERMINAL / ${activeShip.subsystemLabels.fireControl} ILLUMINATION`
            : "TERMINAL / COASTING WITHOUT ILLUMINATION"
          : terminal
            ? i.mesh.userData.seekerAcquired
              ? `TERMINAL / ACTIVE SEEKER ${seekerConfidence}%`
              : seekerCoasting
                ? `TERMINAL / TRACK MEMORY ${seekerConfidence}%`
                : seekerReady
                  ? "TERMINAL / SEEKER SEARCH"
                  : "TERMINAL / SEEKER WARMUP"
            : i.datalinkValid
              ? "MIDCOURSE / DATALINK UPDATE"
              : "MIDCOURSE / INERTIAL COAST";
    if (
      terminal &&
      i.weapon === "RIM-67" &&
      !i.mesh.userData.seekerAcquired &&
      !seekerCoasting &&
      elapsed - (i.mesh.userData.seekerOnAt ?? elapsed) > 3.2
    ) {
      settleEngagement(i, "miss");
      i.mesh.visible = false;
      i.illuminationBeam.visible = false;
      log(`RIM-67 MISS / SEEKER NO CAPTURE / TRACK ${trackId}`);
      return;
    }
    if (interceptDistance < 2.5) {
      const id = defenseSourceForTarget(i.target),
        trackQualityValue = combatPicture.trackForTarget(id)?.quality ?? 0.1,
        guidanceQuality =
          i.weapon === "RIM-67"
            ? i.mesh.userData.seekerAcquired
              ? Math.max(0.62, trackQualityValue)
              : 0.15
            : i.illuminated
              ? Math.max(0.55, trackQualityValue)
              : trackQualityValue,
        saturation = allDefenseTargets().filter(
          (m) =>
            m.phase !== "destroyed" &&
            m.mesh.position.distanceTo(i.target.mesh.position) < 35,
        ).length,
        illuminationPenalty = needsIllumination && !i.illuminated ? 0.34 : 0,
        relativeClosing = i.velocity.clone().sub(i.target.velocity),
        lineToTarget = i.target.mesh.position
          .clone()
          .sub(i.mesh.position)
          .normalize(),
        approachCos = relativeClosing.normalize().dot(lineToTarget),
        geometryFactor = 0.55 + 0.45 * Math.max(0, approachCos),
        energyFactor = 0.86 + 0.14 * (i.mesh.userData.energy ?? 1);
      const pk = Math.max(
        0.08,
        Math.min(
          0.88,
          (0.48 +
            guidanceQuality * 0.42 -
            saturation * 0.07 +
            (i.weapon === "SM-2MR" ? 0.06 : 0) -
            illuminationPenalty) *
            geometryFactor *
            energyFactor,
        ),
      );
      const roll = deterministicProbabilityRoll(
        i.mesh.userData.launchSerial,
        defenseSourceSeed(id),
        i.age,
        i.weapon === "RIM-67" ? 67 : i.weapon === "SM-2MR" ? 2 : 3,
      );
      i.mesh.visible = false;
      i.illuminationBeam.visible = false;
      if (roll < pk) {
        settleEngagement(i, "hit");
        const destroyed = resolveAirDefenseHit(
          i.target,
          i.weapon === "RIM-67" ? 74 : 66,
        );
        if (destroyed) {
          i.target.phase = "destroyed";
          if (i.target.entity?.kind !== "aircraft") {
            i.target.mesh.visible = false;
            destroyMissileVisual(i.target, "intercept");
          }
        } else {
          i.target.phase = "inbound";
          createExplosion(i.target.mesh.position.clone());
        }
        phaseEl.textContent = "TERMINAL INTERCEPT";
        log(
          `${i.weapon} INTERCEPT / ${(i.distanceTraveled / WORLD_UNITS_PER_KM).toFixed(1)} km / PK ${(pk * 100).toFixed(0)}% / GEOM ${(geometryFactor * 100).toFixed(0)}%${needsIllumination ? " / ILLUMINATED" : ""}`,
        );
      } else {
        settleEngagement(i, "miss");
        log(
          `${i.weapon} MISS / PK ${(pk * 100).toFixed(0)}% / GEOM ${(geometryFactor * 100).toFixed(0)}%${illuminationPenalty ? " / NO ILLUMINATOR" : ""}`,
        );
      }
      return;
    }
    if (terminal) {
      const closestEver = Math.min(
          i.mesh.userData.closestApproach ?? Infinity,
          interceptDistance,
        ),
        previousRange = i.mesh.userData.previousTargetRange ?? Infinity;
      i.mesh.userData.closestApproach = closestEver;
      i.mesh.userData.previousTargetRange = postRange;
      if (postRange > previousRange + 0.15 && closestEver < 8) {
        settleEngagement(i, "miss");
        i.mesh.visible = false;
        i.illuminationBeam.visible = false;
        log(
          `${i.weapon} MISS / CPA ${(closestEver / WORLD_UNITS_PER_KM).toFixed(2)} km`,
        );
        return;
      }
    }
    if (i.distanceTraveled > profile.maxRange) {
      settleEngagement(i, "miss");
      i.mesh.visible = false;
      i.illuminationBeam.visible = false;
      log(
        `${i.weapon} MISS / RANGE EXHAUSTED ${(i.distanceTraveled / WORLD_UNITS_PER_KM).toFixed(1)} km`,
      );
      return;
    }
  });
  const launchSystemIdle =
    activeShip.launcher.kind === "mk10"
      ? mk10Launchers.every((launcher) => launcher.phase === "ready")
      : vlsCells.every(
          (cell) =>
            !cell.pending &&
            cell.phase !== "opening" &&
            cell.phase !== "launching" &&
            cell.phase !== "closing",
        );
  if (
    !missionEnded &&
    missiles.length > 0 &&
    missiles.every((m) => m.phase === "destroyed") &&
    hullIntegrity > 0 &&
    launchSystemIdle &&
    surfaceLaunchQueue.length === 0 &&
    surfaceStrikeMissiles.every((m) => m.phase === "destroyed") &&
    (!airCombat.enabled || !airCombat.hasActiveCombat())
  ) {
    interceptors.forEach((i) => {
      i.mesh.visible = false;
      i.illuminationBeam.visible = false;
    });
    updateShipStatus();
    if (!enemyPlatform) finishMission(true);
    else if (enemyPlatform.destroyed)
      finishMission(
        true,
        `SURFACE ACTION WON / ${enemyPlatform.definition.name} DISABLED`,
      );
    else if (enemyPlatform.casualties.length > 0) {
      phaseEl.textContent = "DAMAGE ASSESSMENT";
    } else if (platformFirePlan && !platformFirePlan.completed) {
      phaseEl.textContent = platformFirePlan.assessmentPending
        ? "OPFOR BATTLE DAMAGE ASSESSMENT"
        : "OPFOR FIRE PLAN ACTIVE";
    } else if (
      surfaceStrikeAmmo === 0 ||
      !shipSurfaceHardpoints(defender).some(
        (hardpoint) => surfaceHardpointState.get(hardpoint.id) === "ready",
      )
    )
      finishMission(
        false,
        `SURFACE STRIKE FAILED / ${enemyPlatform.definition.name} SURVIVED`,
      );
  }
}
function cancelPendingPlatformLaunch(missile: Missile, reason: string) {
  const launch = missile.platformLaunch;
  if (!launch || launch.released || missile.phase === "destroyed") return false;
  missile.phase = "destroyed";
  missile.mesh.visible = false;
  missile.path.visible = false;
  missile.mesh.userData.seekerLine.visible = false;
  missile.mesh.userData.seekerFov.visible = false;
  launch.reservation.platform.hardpointState.set(
    launch.reservation.hardpoint.id,
    "canceled",
  );
  log(
    `${launch.reservation.platform.definition.name} LAUNCH ABORT / ${launch.reservation.hardpoint.id.toUpperCase()} / ${reason}`,
  );
  return true;
}

function cancelPlatformLaunchesAgainstDisabledShip() {
  return missiles.reduce(
    (count, missile) =>
      count + Number(cancelPendingPlatformLaunch(missile, "TARGET DISABLED")),
    0,
  );
}

function initializePlatformWaveArrivalPlan(missile: Missile) {
  const launch = missile.platformLaunch,
    wave = launch?.reservation.firePlanWave;
  if (!launch || wave === undefined || launch.plannedArrivalAt !== null) return;
  const platform = launch.reservation.platform,
    doctrine = launch.reservation.weaponSlot.salvoDoctrine,
    track = platform.targetTrack;
  if (!doctrine || !track.valid || track.source !== "radar") return;
  const waveMissiles = missiles
      .filter(
        (candidate) =>
          candidate.platformLaunch?.reservation.platform === platform &&
          candidate.platformLaunch.reservation.firePlanWave === wave,
      )
      .sort(
        (a, b) =>
          (a.platformLaunch?.reservation.firePlanOrdinal ?? 0) -
          (b.platformLaunch?.reservation.firePlanOrdinal ?? 0),
      ),
    observedRange = platform.model.position.distanceTo(track.position),
    finalReleaseAt =
      elapsed +
      Math.max(0, waveMissiles.length - 1) * launch.reservation.releaseInterval,
    commonArrivalAt =
      finalReleaseAt +
      observedRange /
        Math.max(0.1, incomingProfiles[missile.threatType].cruiseSpeed);
  for (const [ordinal, waveMissile] of waveMissiles.entries()) {
    const waveLaunch = waveMissile.platformLaunch;
    if (!waveLaunch) continue;
    waveLaunch.plannedArrivalAt =
      commonArrivalAt +
      (waveMissiles.length > 1
        ? (ordinal / (waveMissiles.length - 1)) * doctrine.arrivalWindow
        : 0);
  }
  log(
    `${platform.definition.name} SALVO TIMING / WAVE ${wave} / ${waveMissiles.length} WEAPONS / ARRIVAL WINDOW ${doctrine.arrivalWindow.toFixed(1)}s / TRACK RANGE ${(observedRange / WORLD_UNITS_PER_KM).toFixed(1)} km`,
  );
}

function updateIncomingMissile(m: Missile, dt: number) {
  if (m.entity) return;
  if (m.phase === "destroyed") {
    m.mesh.userData.seekerLine.visible = false;
    m.mesh.userData.seekerFov.visible = false;
    if (missiles.indexOf(m) + 1 === selectedTargetId) {
      canvas.dataset.selectedThreatPhase = "destroyed";
      canvas.dataset.platformDatalink = m.platformLaunch?.terminalSeekerAcquired
        ? "terminal-autonomous"
        : m.platformLaunch
          ? "lost"
          : "airborne";
    }
    return;
  }
  const pendingPlatformLaunch = m.platformLaunch;
  if (pendingPlatformLaunch && !pendingPlatformLaunch.released) {
    const platform = pendingPlatformLaunch.reservation.platform,
      weaponSlot = pendingPlatformLaunch.reservation.weaponSlot,
      launcherHealth =
        (platform.subsystemHealth.get(weaponSlot.id) ?? 100) / 100,
      fireControlHealth =
        (platform.subsystemHealth.get(weaponSlot.fireControlSensorId) ?? 100) /
        100,
      targeting = platformTargetingSolution(platform, weaponSlot),
      trackQuality = platform.targetTrack.valid
        ? platform.targetTrack.quality
        : 0,
      trackAge = platform.weaponTrackAge.get(weaponSlot.id) ?? 0,
      effectiveTrackQuality =
        trackQuality * THREE.MathUtils.lerp(0.55, 1, fireControlHealth),
      requiredAge = targeting.requiredAge,
      fireControlReady =
        targeting.qualified &&
        effectiveTrackQuality >= targeting.minimumTrackQuality &&
        trackAge >= requiredAge,
      salvoCommitted = platform.slots.weaponHardpoints.some(
        (hardpoint) =>
          hardpoint.slotId === weaponSlot.id &&
          platform.hardpointState.get(hardpoint.id) === "fired",
      );
    if (platform.destroyed) {
      cancelPendingPlatformLaunch(m, "PLATFORM DISABLED");
      return;
    }
    if (launcherHealth <= 0.05) {
      cancelPendingPlatformLaunch(m, "STRIKE LAUNCHER DISABLED");
      return;
    }
    if (fireControlHealth <= 0.05) {
      cancelPendingPlatformLaunch(m, "FIRE CONTROL DISABLED");
      return;
    }
    if (fireControlReady) {
      m.mesh.userData.platformTrackLostAt = undefined;
    } else if (salvoCommitted) {
      if (m.mesh.userData.platformTrackLostAt === undefined)
        m.mesh.userData.platformTrackLostAt = elapsed;
      if (
        elapsed - m.mesh.userData.platformTrackLostAt >=
        weaponSlot.postCommitTrackLossAbort
      ) {
        cancelPendingPlatformLaunch(m, "FIRE CONTROL TRACK LOST");
        return;
      }
    }
    if (elapsed >= m.launchAt) {
      const earlierReservationPending = missiles.some((candidate) => {
        const launch = candidate.platformLaunch;
        return (
          launch &&
          launch !== pendingPlatformLaunch &&
          !launch.released &&
          launch.reservation.platform === platform &&
          launch.reservation.weaponSlot.id ===
            pendingPlatformLaunch.reservation.weaponSlot.id &&
          launch.reservation.launchAt <
            pendingPlatformLaunch.reservation.launchAt &&
          candidate.phase !== "destroyed"
        );
      });
      if (earlierReservationPending) {
        m.launchAt = elapsed + 0.05;
        m.mesh.visible = false;
        m.path.visible = false;
        m.mesh.userData.seekerLine.visible = false;
        return;
      }
      if (
        !targeting.qualified ||
        effectiveTrackQuality < targeting.minimumTrackQuality ||
        trackAge < requiredAge
      ) {
        if (!m.mesh.userData.platformTrackHoldLogged) {
          m.mesh.userData.platformTrackHoldLogged = true;
          log(
            `${platform.definition.name} TRACK BUILD / ${weaponSlot.displayName} / ${targeting.passive ? "PASSIVE CUE" : "RADAR"} TQ ${Math.round(trackQuality * 100)}% / AGE ${trackAge.toFixed(1)}/${requiredAge.toFixed(1)}s`,
          );
        }
        m.launchAt = elapsed + 0.25;
        m.mesh.visible = false;
        m.path.visible = false;
        m.mesh.userData.seekerLine.visible = false;
        return;
      }
      if (!platform.weaponTrackReadyLogged.has(weaponSlot.id)) {
        platform.weaponTrackReadyLogged.add(weaponSlot.id);
        log(
          `${platform.definition.name} ${targeting.passive ? "PASSIVE TARGETING READY" : "FIRE CONTROL READY"} / ${weaponSlot.displayName} / TQ ${Math.round(trackQuality * 100)}% / TRACK AGE ${trackAge.toFixed(1)}s`,
        );
      }
      const nextRelease =
        platform.weaponSlotNextRelease.get(weaponSlot.id) ?? 0;
      if (elapsed + 1e-6 < nextRelease) {
        m.launchAt = nextRelease;
        m.mesh.visible = false;
        m.path.visible = false;
        m.mesh.userData.seekerLine.visible = false;
        return;
      }
    }
  }
  if (elapsed < m.launchAt) {
    m.mesh.visible = false;
    m.path.visible = false;
    m.mesh.userData.seekerLine.visible = false;
    return;
  }
  m.mesh.visible = true;
  m.path.visible = true;
  m.age += dt;
  const platformLaunch = m.platformLaunch;
  if (platformLaunch && !platformLaunch.released) {
    initializePlatformWaveArrivalPlan(m);
    platformLaunch.released = true;
    platformLaunch.releasedAt = elapsed;
    const platformTrack = platformLaunch.reservation.platform.targetTrack;
    if (platformTrack.valid) {
      platformLaunch.commandPoint
        .copy(platformTrack.position)
        .addScaledVector(
          platformTrack.velocity,
          platformLaunch.reservation.weaponSlot.datalinkLatency,
        );
      platformLaunch.commandVelocity.copy(platformTrack.velocity);
      platformLaunch.datalinkValid = true;
    }
    platformLaunch.nextDatalink = elapsed;
    releasePlatformHardpoint(platformLaunch.reservation);
    createVlsLaunchEffect(
      m.mesh.position,
      reservationDirection(platformLaunch.reservation),
    );
    platformLaunch.reservation.platform.model.userData.platformLaunchEffects =
      Number(
        platformLaunch.reservation.platform.model.userData
          .platformLaunchEffects ?? 0,
      ) + 1;
    platformLaunch.reservation.platform.weaponSlotNextRelease.set(
      platformLaunch.reservation.weaponSlot.id,
      elapsed + platformLaunch.reservation.releaseInterval,
    );
    m.mesh.userData.platformDeparturePhase = "TUBE EXIT";
    log(
      `${platformLaunch.reservation.platform.definition.name} / ${platformLaunch.reservation.hardpoint.id.toUpperCase()} / ${m.threatType} CANISTER LAUNCH`,
    );
  }
  if (platformLaunch)
    platformLaunch.commandPoint.addScaledVector(
      platformLaunch.commandVelocity,
      dt,
    );
  const departure = platformLaunch
    ? platformDepartureSolution(
        platformLaunch.reservation,
        m.age,
        m.mesh.position,
        platformLaunch.commandPoint,
        incomingProfiles[m.threatType].cruiseAltitude,
        incomingProfiles[m.threatType].cruiseSpeed,
      )
    : null;
  if (platformLaunch && departure) {
    m.phase = "boost";
    m.velocity.copy(departure.direction.multiplyScalar(departure.speed));
    m.mesh.position.addScaledVector(m.velocity, dt);
    m.bank = THREE.MathUtils.lerp(m.bank, 0, Math.min(1, dt * 4));
    setMissileAttitude(m.mesh, m.velocity, "-Z", m.bank);
    m.mesh.userData.seaMistActive = false;
    m.mesh.userData.platformDeparturePhase = departure.phase;
    m.mesh.userData.seekerState = "SHIP GUIDED / BOOST";
    if (
      m.history.length === 0 ||
      m.mesh.position.distanceTo(m.history[m.history.length - 1]) > 1.2
    ) {
      m.history.push(m.mesh.position.clone());
      m.path.geometry.dispose();
      m.path.geometry = new THREE.BufferGeometry().setFromPoints(m.history);
    }
    if (missiles.indexOf(m) + 1 === selectedTargetId) {
      canvas.dataset.selectedThreatKind = m.threatType;
      canvas.dataset.selectedThreatPhase = m.phase;
      canvas.dataset.selectedThreatAltitude = m.mesh.position.y.toFixed(3);
      canvas.dataset.selectedThreatRange = m.mesh.position
        .distanceTo(defender.position)
        .toFixed(2);
      canvas.dataset.platformDeparturePhase = String(
        m.mesh.userData.platformDeparturePhase,
      );
      canvas.dataset.platformLaunchSlot =
        platformLaunch.reservation.hardpoint.id;
    }
    return;
  }
  if (platformLaunch && !platformLaunch.takeoverLogged) {
    platformLaunch.takeoverLogged = true;
    m.mesh.userData.platformDeparturePhase = "MIDCOURSE TAKEOVER";
    log(
      `${m.threatType} MIDCOURSE GUIDANCE TAKEOVER / ${platformLaunch.reservation.platform.definition.name}`,
    );
  }
  if (
    platformLaunch &&
    !platformLaunch.terminalSeekerAcquired &&
    elapsed >= platformLaunch.nextDatalink
  ) {
    const platform = platformLaunch.reservation.platform,
      slot = platformLaunch.reservation.weaponSlot,
      track = platform.targetTrack,
      updateValid =
        !platform.destroyed &&
        track.valid &&
        track.quality >= slot.datalinkMinimumQuality;
    if (updateValid) {
      const solution = track.position
        .clone()
        .addScaledVector(track.velocity, slot.datalinkLatency);
      platformLaunch.commandPoint.lerp(solution, 0.78);
      platformLaunch.commandVelocity.lerp(track.velocity, 0.7);
      if (
        !platformLaunch.datalinkValid ||
        platformLaunch.lastDatalinkQuality < 0 ||
        Math.abs(track.quality - platformLaunch.lastDatalinkQuality) >= 0.12
      )
        log(
          `${m.threatType} PLATFORM DATALINK UPDATE / ${platform.definition.name} / TQ ${Math.round(track.quality * 100)}% / UNC ${(track.uncertainty / 10).toFixed(1)} km`,
        );
      platformLaunch.datalinkValid = true;
      platformLaunch.lastDatalinkQuality = track.quality;
    } else if (platformLaunch.datalinkValid) {
      platformLaunch.datalinkValid = false;
      log(
        `${m.threatType} PLATFORM DATALINK LOST / ${platform.definition.name} / INERTIAL COAST`,
      );
    }
    platformLaunch.nextDatalink = elapsed + slot.datalinkUpdateInterval;
  }
  const range = m.mesh.position.distanceTo(defender.position),
    profile = incomingProfiles[m.threatType],
    guidanceRange =
      platformLaunch && !platformLaunch.terminalSeekerAcquired
        ? m.mesh.position.distanceTo(platformLaunch.commandPoint)
        : range,
    terminalFactor = THREE.MathUtils.clamp(
      (profile.terminalAt - guidanceRange) / (profile.terminalAt * 0.72),
      0,
      1,
    ),
    altitudeFactor = profile.terminalDescentAt
      ? THREE.MathUtils.clamp(
          (profile.terminalDescentAt - guidanceRange) /
            Math.max(1, profile.terminalDescentAt - 6),
          0,
          1,
        )
      : terminalFactor;
  m.phase =
    guidanceRange < profile.terminalAt
      ? "terminal"
      : guidanceRange < profile.terminalAt * 1.9
        ? "midcourse"
        : "inbound";
  if (
    platformLaunch &&
    m.phase === "terminal" &&
    m.mesh.userData.platformTerminalEnteredAt === undefined
  )
    m.mesh.userData.platformTerminalEnteredAt = elapsed;
  if (
    chaffEnabled &&
    m.phase === "terminal" &&
    !m.mesh.userData.chaffDeployed &&
    range < profile.terminalAt * 0.72
  )
    deployChaff(m);
  if (m.phase === "terminal" && !m.mesh.userData.seekerOn) {
    m.mesh.userData.seekerOn = true;
    log(
      `${m.threatType} ACTIVE SEEKER SEARCH / NAV ${(guidanceRange / WORLD_UNITS_PER_KM).toFixed(1)} km`,
    );
    if (m.mesh.userData.terminalAttackMode !== "standard")
      log(
        `${m.threatType} TERMINAL PROFILE / ${String(m.mesh.userData.terminalAttackMode).toUpperCase()}`,
      );
  }
  if (
    platformLaunch &&
    m.mesh.userData.seekerOn &&
    !platformLaunch.terminalSeekerAcquired
  ) {
    const targetDirection = defender.position
        .clone()
        .sub(m.mesh.position)
        .normalize(),
      offBoresight = m.velocity.clone().normalize().angleTo(targetDirection),
      fieldOfView = THREE.MathUtils.degToRad(
        profile.seekerFieldOfViewDeg ?? 55,
      ),
      acquisitionRange =
        profile.terminalAt * (profile.seekerAcquisitionRangeFactor ?? 1.1);
    if (range <= acquisitionRange && offBoresight <= fieldOfView / 2) {
      platformLaunch.terminalSeekerAcquired = true;
      m.mesh.userData.platformGuidanceMode = "ACTIVE HOMING";
      log(
        `${m.threatType} ACTIVE SEEKER TARGET ACQUIRED / ${(range / WORLD_UNITS_PER_KM).toFixed(1)} km / OFF-BORESIGHT ${THREE.MathUtils.radToDeg(offBoresight).toFixed(1)} DEG`,
      );
    }
  }
  const terminalSeekerValid =
    !platformLaunch || platformLaunch.terminalSeekerAcquired;
  if (
    m.phase === "terminal" &&
    terminalSeekerValid &&
    srbocEnabled &&
    range < 140 &&
    !m.mesh.userData.shipDecoyCloud &&
    (m.mesh.userData.srbocShots ?? 0) < 2 &&
    deployShipChaff(m)
  )
    m.mesh.userData.srbocShots = (m.mesh.userData.srbocShots ?? 0) + 1;
  let commandedAltitude = THREE.MathUtils.lerp(
    profile.cruiseAltitude,
    profile.terminalAltitude,
    altitudeFactor,
  );
  const popUp = profile.popUp,
    popUpActive =
      !!popUp &&
      m.mesh.userData.terminalAttackMode === "pop-up" &&
      m.phase === "terminal" &&
      range < popUp.startRange;
  if (popUpActive && popUp) {
    const popupProgress = THREE.MathUtils.clamp(
      (popUp.startRange - range) / Math.max(1, popUp.startRange - 6),
      0,
      1,
    );
    commandedAltitude = THREE.MathUtils.lerp(
      profile.terminalAltitude,
      popUp.peakAltitude,
      Math.sin(popupProgress * Math.PI),
    );
  }
  const weave = new THREE.Vector3(
    Math.sin(m.age * profile.weave.lateralRate) *
      profile.weave.lateral *
      terminalFactor,
    0,
    Math.cos(m.age * profile.weave.longitudinalRate) *
      profile.weave.longitudinal *
      terminalFactor,
  );
  const availableShipChaff = chaffClouds.filter(
    (c) =>
      c.side === "ship" &&
      c.age < 12 &&
      c.position.distanceTo(defender.position) < 55,
  );
  const ecmHealth = subsystemHealth("ecm"),
    previousDecoy = m.mesh.userData.shipDecoyCloud as ChaffCloud | undefined,
    sjRatio =
      Math.pow(profile.burnThroughRange / Math.max(1, range), 2) /
      Math.max(0.05, ecmHealth),
    sjDb = 10 * Math.log10(sjRatio),
    burnThrough = !shipEcmEnabled || ecmHealth <= 0.05 || sjDb >= 0,
    shipEcmStrength =
      terminalSeekerValid && shipEcmEnabled && !burnThrough
        ? THREE.MathUtils.clamp(-sjDb / 18, 0, 0.8) * ecmHealth
        : 0,
    lockedDecoy =
      previousDecoy && availableShipChaff.includes(previousDecoy)
        ? previousDecoy
        : undefined;
  const evaluated = (m.mesh.userData.evaluatedShipChaff ??=
      new Set<number>()) as Set<number>,
    newClouds = availableShipChaff.filter((c) => !evaluated.has(c.serial)),
    shipChaff =
      lockedDecoy ??
      newClouds.sort(
        (a, b) =>
          b.rcs /
            Math.pow(Math.max(4, b.position.distanceTo(m.mesh.position)), 4) -
          a.rcs /
            Math.pow(Math.max(4, a.position.distanceTo(m.mesh.position)), 4),
      )[0];
  const chaffPower = shipChaff
      ? shipChaff.rcs /
        Math.pow(Math.max(4, shipChaff.position.distanceTo(m.mesh.position)), 4)
      : 0,
    shipPower =
      (activeShip.platform.radarRcs / Math.pow(Math.max(4, range), 4)) *
      (1 - shipEcmStrength * 0.55),
    deceptionPk = shipChaff
      ? THREE.MathUtils.clamp(
          chaffPower / (chaffPower + shipPower) + shipEcmStrength * 0.15,
          0.05,
          0.88,
        )
      : 0,
    captureSeed = shipChaff
      ? Math.sin(
          (missiles.indexOf(m) + 1) * 12.9898 + shipChaff.serial * 78.233,
        ) * 43758.5453
      : 0,
    captureRoll = shipChaff ? captureSeed - Math.floor(captureSeed) : 1,
    capturedNow =
      !burnThrough && !!shipChaff && !lockedDecoy && captureRoll < deceptionPk,
    deceived = !burnThrough && (!!lockedDecoy || capturedNow);
  if (shipChaff && !lockedDecoy) {
    evaluated.add(shipChaff.serial);
    if (!capturedNow)
      log(
        `${m.threatType} CHAFF REJECT / PK ${Math.round(deceptionPk * 100)}% / ROLL ${Math.round(captureRoll * 100)}%`,
      );
  }
  if (burnThrough) {
    m.mesh.userData.shipDecoyCloud = undefined;
    if (shipEcmEnabled && !m.mesh.userData.shipEcmBurnThrough) {
      m.mesh.userData.shipEcmBurnThrough = true;
      log(
        `${m.threatType} SHIP ECM BURN-THROUGH / ${(range / WORLD_UNITS_PER_KM).toFixed(1)} km`,
      );
    }
  }
  if (deceived && shipChaff && !lockedDecoy) {
    m.mesh.userData.shipDecoyCloud = shipChaff;
    log(
      `${m.threatType} LOCK TRANSFER / SRBOC CHAFF / PK ${Math.round(deceptionPk * 100)}%`,
    );
  }
  m.mesh.userData.shipDecoy = deceived;
  const homeOnJam = profile.homeOnJam,
    homeOnJamActive =
      !!homeOnJam &&
      m.phase === "terminal" &&
      shipEcmEnabled &&
      shipEcmStrength > homeOnJam.minimumJammingStrength &&
      !deceived,
    effectiveEcmStrength = homeOnJamActive
      ? shipEcmStrength * homeOnJam!.residualErrorFactor
      : shipEcmStrength;
  if (homeOnJamActive && !m.mesh.userData.hojLogged) {
    m.mesh.userData.hojLogged = true;
    log(`${m.threatType} HOME-ON-JAM / AN/SLQ-32 EMITTER BEARING`);
  }
  m.mesh.userData.ewState = deceived
    ? "CHAFF LOCK"
    : homeOnJamActive
      ? "HOME-ON-JAM"
      : shipEcmStrength > 0
        ? `J/S +${Math.round(-sjDb)} dB`
        : burnThrough && shipEcmEnabled
          ? `S/J +${Math.round(sjDb)} dB`
          : "CLEAR";
  m.mesh.userData.seekerState =
    m.phase === "terminal"
      ? !terminalSeekerValid
        ? "ACTIVE SEARCH"
        : deceived
          ? "FALSE TARGET"
          : popUpActive
            ? "ACTIVE / POP-UP"
            : "ACTIVE"
      : platformLaunch
        ? platformLaunch.datalinkValid
          ? "SHIP GUIDED"
          : "INERTIAL"
        : "STANDBY";
  const ecmOffset = new THREE.Vector3(
      Math.sin(m.age * 2.1) * effectiveEcmStrength * 8,
      0,
      Math.cos(m.age * 1.7) * effectiveEcmStrength * 8,
    ),
    aimBase =
      platformLaunch && !platformLaunch.terminalSeekerAcquired
        ? platformLaunch.commandPoint
        : deceived && shipChaff
          ? shipChaff.position
          : defender.position.clone().add(ecmOffset),
    aimPoint = aimBase
      .clone()
      .add(m.aimOffset)
      .add(weave)
      .add(new THREE.Vector3(0, commandedAltitude, 0));
  const seekerFov = m.mesh.userData.seekerFov as THREE.Mesh,
    seekerLine = m.mesh.userData.seekerLine as THREE.Line,
    seekerVisible =
      m.phase === "terminal" && missiles.indexOf(m) + 1 === selectedTargetId,
    seekerColor = deceived
      ? 0xffcf55
      : shipEcmStrength > 0
        ? 0x5ee5dc
        : 0xff5b4d;
  seekerFov.visible = seekerVisible;
  seekerLine.visible = seekerVisible;
  (seekerFov.material as THREE.MeshBasicMaterial).color.setHex(seekerColor);
  (seekerLine.material as THREE.LineBasicMaterial).color.setHex(seekerColor);
  if (seekerVisible) {
    seekerLine.geometry.dispose();
    seekerLine.geometry = new THREE.BufferGeometry().setFromPoints([
      m.mesh.position.clone(),
      aimBase.clone().add(new THREE.Vector3(0, commandedAltitude, 0)),
    ]);
  }
  const desired = aimPoint.sub(m.mesh.position).normalize();
  if (deceived) m.mesh.userData.everDecoyed = true;
  const current = m.velocity.clone().normalize();
  const turnSign = current.clone().cross(desired).y;
  const angle = current.angleTo(desired),
    maxTurn =
      THREE.MathUtils.degToRad(profile.turnRate * (1 + terminalFactor * 0.75)) *
      dt;
  const blend = angle > 0 ? Math.min(1, maxTurn / angle) : 1;
  const direction = current.lerp(desired, blend).normalize();
  const arrivalDoctrine = platformLaunch?.reservation.weaponSlot.salvoDoctrine,
    remainingArrivalTime = Math.max(
      0.1,
      (platformLaunch?.plannedArrivalAt ?? elapsed) - elapsed,
    ),
    arrivalSpeedFactor =
      platformLaunch?.plannedArrivalAt !== null &&
      platformLaunch?.plannedArrivalAt !== undefined &&
      terminalFactor < 0.2 &&
      arrivalDoctrine
        ? THREE.MathUtils.clamp(
            guidanceRange /
              remainingArrivalTime /
              Math.max(0.1, profile.cruiseSpeed),
            1 - arrivalDoctrine.maximumSpeedCompensation,
            1 + arrivalDoctrine.maximumSpeedCompensation,
          )
        : 1;
  m.mesh.userData.platformArrivalSpeedFactor = arrivalSpeedFactor;
  m.mesh.userData.platformMaximumSpeedDeviation = Math.max(
    m.mesh.userData.platformMaximumSpeedDeviation ?? 0,
    Math.abs(arrivalSpeedFactor - 1),
  );
  const targetSpeed = THREE.MathUtils.lerp(
    profile.cruiseSpeed * arrivalSpeedFactor,
    profile.terminalSpeed,
    terminalFactor,
  );
  const speed = THREE.MathUtils.lerp(
    m.velocity.length(),
    targetSpeed,
    Math.min(1, dt * 0.55),
  );
  m.velocity.copy(direction.multiplyScalar(speed));
  m.mesh.position.addScaledVector(m.velocity, dt);
  if (profile.terminalDescentAt && range < profile.terminalDescentAt) {
    const altitudeCorrection = THREE.MathUtils.clamp(
      commandedAltitude - m.mesh.position.y,
      -dt * 1.2,
      dt * 1.2,
    );
    m.mesh.position.y += altitudeCorrection;
  }
  if (popUpActive && popUp) {
    const altitudeCorrection = THREE.MathUtils.clamp(
      commandedAltitude - m.mesh.position.y,
      -dt * 1.2,
      dt * 1.2,
    );
    m.mesh.position.y = Math.min(
      popUp.peakAltitude,
      m.mesh.position.y + altitudeCorrection,
    );
    if (m.mesh.position.y >= popUp.peakAltitude)
      m.velocity.y = Math.min(0, m.velocity.y);
  }
  if (profile.trajectory === "sea-skimmer") {
    const radarAltimeterFloor = Math.max(0.06, profile.terminalAltitude * 0.75);
    if (m.mesh.position.y < radarAltimeterFloor) {
      m.mesh.position.y = radarAltimeterFloor;
      m.velocity.y = Math.max(0, m.velocity.y);
    }
  }
  m.bank = THREE.MathUtils.lerp(
    m.bank,
    THREE.MathUtils.clamp(turnSign * 8, -0.62, 0.62),
    Math.min(1, dt * 2.4),
  );
  setMissileAttitude(m.mesh, m.velocity, "-Z", m.bank);
  m.mesh.userData.seaMistActive =
    profile.trajectory === "sea-skimmer" &&
    m.phase === "terminal" &&
    m.mesh.position.y < 1.25;
  if (m.mesh.userData.shockCone)
    m.mesh.userData.shockCone.visible =
      profile.trajectory === "high-altitude" && m.phase === "terminal";
  if (missiles.indexOf(m) + 1 === selectedTargetId) {
    canvas.dataset.selectedThreatKind = m.threatType;
    canvas.dataset.selectedThreatPhase = m.phase;
    canvas.dataset.selectedThreatAltitude = m.mesh.position.y.toFixed(3);
    canvas.dataset.selectedThreatRange = range.toFixed(2);
    canvas.dataset.selectedThreatModelLength = String(
      m.mesh.userData.modelLength ?? "legacy",
    );
    canvas.dataset.platformDeparturePhase = String(
      m.mesh.userData.platformDeparturePhase ?? "AIRBORNE",
    );
    canvas.dataset.platformLaunchSlot =
      m.platformLaunch?.reservation.hardpoint.id ?? "AIRBORNE";
    canvas.dataset.platformDatalink = m.platformLaunch
      ? m.platformLaunch.terminalSeekerAcquired
        ? "terminal-autonomous"
        : m.platformLaunch.datalinkValid
          ? "valid"
          : "lost"
      : "airborne";
    canvas.dataset.platformCommandError = m.platformLaunch
      ? m.platformLaunch.commandPoint.distanceTo(defender.position).toFixed(2)
      : "0.00";
    canvas.dataset.terminalSeekerAcquired = String(
      m.platformLaunch?.terminalSeekerAcquired ??
        (m.phase === "terminal" && !!m.mesh.userData.seekerOn),
    );
  }
  if (
    m.history.length === 0 ||
    m.mesh.position.distanceTo(m.history[m.history.length - 1]) > 3
  ) {
    m.history.push(m.mesh.position.clone());
    if (m.history.length > 90) m.history.shift();
    m.path.geometry.dispose();
    m.path.geometry = new THREE.BufferGeometry().setFromPoints(m.history);
  }
  const postShipRange = m.mesh.position.distanceTo(defender.position),
    closestShipRange = Math.min(
      m.mesh.userData.closestShipRange ?? Infinity,
      postShipRange,
    );
  m.mesh.userData.closestShipRange = closestShipRange;
  m.mesh.userData.previousShipRange = postShipRange;
  if (
    m.mesh.userData.everDecoyed &&
    postShipRange > closestShipRange + 4 &&
    closestShipRange < profile.terminalAt &&
    closestShipRange > 6
  ) {
    m.phase = "destroyed";
    m.mesh.visible = false;
    log(
      `${m.threatType} SOFT KILL / SRBOC DECOY / CPA ${(closestShipRange / WORLD_UNITS_PER_KM).toFixed(2)} km`,
    );
    return;
  }
  if (postShipRange < 6) {
    const nearestSam = interceptors
      .filter((i) => i.mesh.visible)
      .reduce(
        (best, i) =>
          Math.min(best, i.mesh.position.distanceTo(m.mesh.position)),
        Infinity,
      );
    m.phase = "destroyed";
    m.mesh.visible = false;
    if (m.platformLaunch) m.mesh.userData.platformImpact = true;
    leakers++;
    hullIntegrity = Math.max(0, hullIntegrity - profile.damage);
    createShipDamage(m.mesh.position, profile.damage);
    applySubsystemDamage(m, profile.damage);
    destroyMissileVisual(m, "impact");
    log(
      `${m.threatType} IMPACT / ${profile.damage}% DAMAGE / SAM ${Number.isFinite(nearestSam) ? (nearestSam / WORLD_UNITS_PER_KM).toFixed(1) + " km" : "NONE"} / HULL ${hullIntegrity}%`,
    );
    updateShipStatus();
    if (hullIntegrity <= 0) {
      const canceled = cancelPlatformLaunchesAgainstDisabledShip();
      if (canceled > 0)
        log(`OPFOR FIRE PLAN TERMINATED / ${canceled} UNRELEASED WEAPONS`);
      phaseEl.textContent = `${activeShip.name} DISABLED`;
      finishMission(false);
    }
  }
}
function updateTargetMarker() {
  const selected = missiles[selectedTargetId - 1],
    track = combatPicture.trackForTarget(selectedTargetId);
  seekerState.textContent = selected?.mesh.userData.seekerState ?? "STANDBY";
  ewState.textContent = selected?.mesh.userData.ewState ?? "CLEAR";
  seekerState.className =
    selected?.mesh.userData.seekerState === "FALSE TARGET" ? "ew-warning" : "";
  ewState.className =
    selected?.mesh.userData.ewState === "ECM JAMMED"
      ? "ew-active"
      : selected?.mesh.userData.ewState === "CHAFF LOCK"
        ? "ew-warning"
        : "";
  if (
    !selected ||
    selected.phase === "destroyed" ||
    elapsed < selected.launchAt ||
    !track
  ) {
    targetMarker.style.display = "none";
    return;
  }
  const projected = track.position.clone().project(camera),
    behind = projected.z < -1 || projected.z > 1,
    rawX = (projected.x * 0.5 + 0.5) * innerWidth,
    rawY = (-projected.y * 0.5 + 0.5) * innerHeight,
    margin = innerWidth < 560 ? 28 : 46,
    safeTop = innerWidth < 560 ? 250 : 76,
    safeBottom = innerWidth < 560 ? 220 : 110,
    centerX = innerWidth * 0.5,
    centerY = innerHeight * 0.5,
    angle = Math.atan2(rawY - centerY, rawX - centerX),
    displayX = behind
      ? centerX + Math.cos(angle + Math.PI) * innerWidth
      : centerX + Math.cos(angle) * innerWidth,
    displayY = behind
      ? centerY + Math.sin(angle + Math.PI) * innerHeight
      : centerY + Math.sin(angle) * innerHeight,
    x = Math.max(
      margin,
      Math.min(innerWidth - margin, behind ? displayX : rawX),
    ),
    y = Math.max(
      safeTop,
      Math.min(innerHeight - safeBottom, behind ? displayY : rawY),
    ),
    offscreen =
      behind ||
      rawX < margin ||
      rawX > innerWidth - margin ||
      rawY < safeTop ||
      rawY > innerHeight - safeBottom,
    range = track.position.distanceTo(defender.position),
    tti = Math.max(0, Math.round(range / Math.max(1, track.velocity.length())));
  targetMarker.style.display = "block";
  targetMarker.style.left = `${x}px`;
  targetMarker.style.top = `${y}px`;
  targetMarker.style.setProperty(
    "--bearing",
    `${Math.atan2((behind ? displayY : rawY) - centerY, (behind ? displayX : rawX) - centerX)}rad`,
  );
  targetMarker.classList.toggle("offscreen", offscreen);
  targetMarker.classList.toggle("right-edge", x > innerWidth - 180);
  targetMarkerLabel.textContent = `T${String(track.id).padStart(2, "0")} ${track.classification === "classified" ? selected.threatType : track.classification.toUpperCase()} / ${tti}s / ±${(track.uncertainty / 1000).toFixed(1)}km`;
}
function tick(now: number) {
  const realDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (running) {
    simAccumulator += realDt * timeScale;
    while (simAccumulator >= 0.05 && running) {
      elapsed += 0.05;
      if (enemyPlatform) {
        const defenderVelocity = new THREE.Vector3(1, 0, 0)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), defender.rotation.y)
          .multiplyScalar(shipSpeedKnots * 0.005144);
        const platformUpdate = updateEnemyPlatform(
          enemyPlatform,
          elapsed,
          0.05,
          defender.position,
          defenderVelocity,
          activeShip.platform.significantHeightMeters,
          activeShip.platform.radarRcs,
          opforRadarEnabled,
          radarEnabled,
        );
        if (platformUpdate.maneuverChanged)
          log(
            `OODA MANEUVER / ${platformUpdate.maneuverMode.toUpperCase()} / ${enemyPlatform.definition.name} / CMD ${enemyPlatform.commandedSpeedKnots.toFixed(0)} KT`,
          );
        for (const event of platformUpdate.damageEvents) {
          if (event.kind === "casualty-contained") {
            log(
              `${enemyPlatform.definition.name} DAMAGE CONTROL / CASUALTY ${event.casualtyId} / ${event.zone} / CONTAINED`,
            );
            continue;
          }
          surfaceProgressiveDamage += event.hullDamage;
          if (activeShip.surfaceStrike)
            nextSurfaceAssessment = Math.max(
              nextSurfaceAssessment,
              elapsed + activeShip.surfaceStrike.assessmentDelay,
            );
          log(
            `${enemyPlatform.definition.name} PROGRESSIVE DAMAGE / CASUALTY ${event.casualtyId} / ${event.zone} / FIRE ${event.fire.toFixed(1)} / FLOOD ${event.flooding.toFixed(1)} / DELTA ${event.hullDamage.toFixed(2)}`,
          );
          if (event.platformDestroyed) {
            surfaceHardKills++;
            log(
              `SURFACE KILL / ${enemyPlatform.definition.name} DISABLED BY PROGRESSIVE DAMAGE`,
            );
          }
        }
      }
      if (airCombat.enabled) {
        const airContext = airScenarioContext();
        airCombat.update(elapsed, 0.05, airContext);
        synchronizeAirDefenseTargets();
        for (const event of airCombat.drainEvents())
          log(`AIR OODA / ${event.text}`);
      }
      updateCombat(0.05);
      missiles.forEach((m) => updateIncomingMissile(m, 0.05));
      updatePlatformFirePlan();
      captureAarSnapshot();
      simAccumulator -= 0.05;
    }
    const activeMissiles = missiles.filter(
        (m) =>
          m.phase !== "destroyed" &&
          elapsed >= m.launchAt &&
          (!m.platformLaunch || m.platformLaunch.released),
      ),
      live = activeMissiles.length,
      distances = activeMissiles.map((m) =>
        m.mesh.position.distanceTo(defender.position),
      );
    updateRaidCard(
      live,
      missiles.filter((m) => m.phase !== "destroyed").length - live,
      distances.length ? Math.max(...distances) : 0,
    );
  }
  if (enemyPlatform) {
    const states = [...enemyPlatform.hardpointState.values()];
    canvas.dataset.enemyPlatform = enemyPlatform.definition.id;
    canvas.dataset.surfaceRangeKm = (
      enemyPlatform.model.position.distanceTo(defender.position) /
      WORLD_UNITS_PER_KM
    ).toFixed(2);
    canvas.dataset.enemyPlatformReady = String(
      states.filter((state) => state === "ready").length,
    );
    canvas.dataset.enemyPlatformReserved = String(
      states.filter((state) => state === "reserved").length,
    );
    canvas.dataset.enemyPlatformFired = String(
      states.filter((state) => state === "fired").length,
    );
    canvas.dataset.enemyPlatformLaunchEffects = String(
      enemyPlatform.model.userData.platformLaunchEffects ?? 0,
    );
    const releasedPlatformWeapons = missiles
      .filter((missile) => missile.platformLaunch?.released)
      .sort(
        (a, b) =>
          (a.platformLaunch!.releasedAt ?? Infinity) -
          (b.platformLaunch!.releasedAt ?? Infinity),
      );
    canvas.dataset.enemyPlatformFiredOrder = releasedPlatformWeapons
      .map((missile) => missile.platformLaunch!.reservation.hardpoint.id)
      .join(",");
    canvas.dataset.enemyPlatformReleaseTimes = releasedPlatformWeapons
      .map((missile) => missile.platformLaunch!.releasedAt?.toFixed(2) ?? "")
      .join(",");
    const timedPlatformWeapons = missiles
      .filter(
        (missile) =>
          missile.platformLaunch?.reservation.firePlanWave !== undefined,
      )
      .sort(
        (a, b) =>
          (a.platformLaunch!.reservation.firePlanWave ?? 0) -
            (b.platformLaunch!.reservation.firePlanWave ?? 0) ||
          (a.platformLaunch!.reservation.firePlanOrdinal ?? 0) -
            (b.platformLaunch!.reservation.firePlanOrdinal ?? 0),
      );
    canvas.dataset.enemyPlatformArrivalPlans = timedPlatformWeapons
      .map(
        (missile) =>
          missile.platformLaunch!.plannedArrivalAt?.toFixed(2) ?? "pending",
      )
      .join(",");
    canvas.dataset.enemyPlatformTerminalTimes = timedPlatformWeapons
      .map((missile) =>
        typeof missile.mesh.userData.platformTerminalEnteredAt === "number"
          ? missile.mesh.userData.platformTerminalEnteredAt.toFixed(2)
          : "pending",
      )
      .join(",");
    canvas.dataset.enemyPlatformSpeedDeviations = timedPlatformWeapons
      .map((missile) =>
        Number(
          missile.mesh.userData.platformMaximumSpeedDeviation ?? 0,
        ).toFixed(3),
      )
      .join(",");
    canvas.dataset.enemyPlatformCanceled = String(
      states.filter((state) => state === "canceled").length,
    );
    canvas.dataset.enemyPlatformReleasedInFlight = String(
      missiles.filter(
        (missile) =>
          missile.platformLaunch?.released && missile.phase !== "destroyed",
      ).length,
    );
    canvas.dataset.enemyPlatformTrackLossHold = Math.max(
      0,
      ...missiles.map((missile) => {
        const lostAt = missile.mesh.userData.platformTrackLostAt;
        return typeof lostAt === "number" && !missile.platformLaunch?.released
          ? elapsed - lostAt
          : 0;
      }),
    ).toFixed(2);
    const platformAssessment = platformFirePlan
      ? (platformFirePlan.lastAssessment ??
        assessPlatformFirePlan(platformFirePlan))
      : null;
    canvas.dataset.enemyPlatformFirePlanWave = String(
      platformFirePlan?.wave ?? 0,
    );
    canvas.dataset.enemyPlatformAuthorized = String(
      platformFirePlan?.authorizedWeapons ?? 0,
    );
    canvas.dataset.enemyPlatformCommitted = String(
      platformFirePlan?.committedWeapons ?? 0,
    );
    canvas.dataset.enemyPlatformAssessedHits = String(
      platformAssessment?.assessedHitCredit.toFixed(3) ?? "0.000",
    );
    canvas.dataset.enemyPlatformActualHits = String(
      platformAssessment?.actualHits ?? 0,
    );
    canvas.dataset.enemyPlatformBdaTrackQuality = String(
      platformAssessment?.observationTrackQuality.toFixed(3) ?? "0.000",
    );
    canvas.dataset.enemyPlatformHitCreditFactor = String(
      platformAssessment?.hitCreditFactor.toFixed(3) ?? "0.000",
    );
    canvas.dataset.enemyPlatformResolvedWeapons = String(
      platformAssessment?.resolvedWeapons ?? 0,
    );
    canvas.dataset.enemyPlatformAssessmentPending =
      platformFirePlan?.assessmentPending
        ? Math.max(0, platformFirePlan.assessmentReadyAt - elapsed).toFixed(2)
        : "0.00";
    canvas.dataset.enemyPlatformFirePlanComplete = platformFirePlan?.completed
      ? "true"
      : "false";
    canvas.dataset.enemyPlatformSensorQuality = Math.max(
      0,
      ...[...enemyPlatform.sensorState.values()].map((state) => state.quality),
    ).toFixed(3);
    canvas.dataset.enemyPlatformTrackAge = Math.max(
      0,
      ...enemyPlatform.weaponTrackAge.values(),
    ).toFixed(2);
    canvas.dataset.enemyPlatformTargetTrackQuality =
      enemyPlatform.targetTrack.quality.toFixed(3);
    canvas.dataset.enemyPlatformTargetTrackSource =
      enemyPlatform.targetTrack.source;
    canvas.dataset.enemyPlatformTargetTrackUncertainty =
      enemyPlatform.targetTrack.uncertainty.toFixed(2);
    canvas.dataset.opforRadar = opforRadarEnabled ? "active" : "silent";
    canvas.dataset.enemyPlatformHardpoints = String(
      enemyPlatform.slots.weaponHardpoints.length,
    );
    canvas.dataset.enemyPlatformCoversVisible = String(
      enemyPlatform.slots.weaponHardpoints.filter(
        (hardpoint) => hardpoint.cover?.visible !== false,
      ).length,
    );
    canvas.dataset.enemyPlatformSpeedKnots =
      enemyPlatform.speedKnots.toFixed(2);
    canvas.dataset.enemyPlatformVelocity = enemyPlatform.velocity
      .length()
      .toFixed(4);
    canvas.dataset.enemyPlatformManeuverMode = enemyPlatform.maneuverMode;
    canvas.dataset.enemyPlatformCommandedSpeedKnots =
      enemyPlatform.commandedSpeedKnots.toFixed(2);
    canvas.dataset.enemyPlatformDesiredHeadingDeg = THREE.MathUtils.radToDeg(
      enemyPlatform.desiredHeading,
    ).toFixed(2);
    canvas.dataset.shipHull = hullIntegrity.toFixed(2);
  } else {
    canvas.dataset.enemyPlatform = "AIRBORNE";
    canvas.dataset.surfaceRangeKm = "not-applicable";
    canvas.dataset.enemyPlatformReady = "0";
    canvas.dataset.enemyPlatformReserved = "0";
    canvas.dataset.enemyPlatformFired = "0";
    canvas.dataset.enemyPlatformLaunchEffects = "0";
    canvas.dataset.enemyPlatformFiredOrder = "";
    canvas.dataset.enemyPlatformReleaseTimes = "";
    canvas.dataset.enemyPlatformArrivalPlans = "";
    canvas.dataset.enemyPlatformTerminalTimes = "";
    canvas.dataset.enemyPlatformSpeedDeviations = "";
    canvas.dataset.enemyPlatformCanceled = "0";
    canvas.dataset.enemyPlatformReleasedInFlight = "0";
    canvas.dataset.enemyPlatformTrackLossHold = "0.00";
    canvas.dataset.enemyPlatformFirePlanWave = "0";
    canvas.dataset.enemyPlatformAuthorized = "0";
    canvas.dataset.enemyPlatformCommitted = "0";
    canvas.dataset.enemyPlatformAssessedHits = "0";
    canvas.dataset.enemyPlatformActualHits = "0";
    canvas.dataset.enemyPlatformBdaTrackQuality = "0.000";
    canvas.dataset.enemyPlatformHitCreditFactor = "0.000";
    canvas.dataset.enemyPlatformResolvedWeapons = "0";
    canvas.dataset.enemyPlatformAssessmentPending = "0.00";
    canvas.dataset.enemyPlatformFirePlanComplete = "false";
    canvas.dataset.shipHull = hullIntegrity.toFixed(2);
    canvas.dataset.enemyPlatformSensorQuality = "0.000";
    canvas.dataset.enemyPlatformTrackAge = "0.00";
    canvas.dataset.enemyPlatformTargetTrackQuality = "0.000";
    canvas.dataset.enemyPlatformTargetTrackSource = "none";
    canvas.dataset.enemyPlatformTargetTrackUncertainty = "0.00";
    canvas.dataset.opforRadar = "not-applicable";
    canvas.dataset.enemyPlatformHardpoints = "0";
    canvas.dataset.enemyPlatformCoversVisible = "0";
    canvas.dataset.enemyPlatformSpeedKnots = "0.00";
    canvas.dataset.enemyPlatformVelocity = "0.0000";
    canvas.dataset.enemyPlatformManeuverMode = "not-applicable";
    canvas.dataset.enemyPlatformCommandedSpeedKnots = "0.00";
    canvas.dataset.enemyPlatformDesiredHeadingDeg = "0.00";
  }
  canvas.dataset.surfaceEsmCue = surfaceEsmCue.valid ? "valid" : "none";
  const air = airCombat.diagnostics();
  const airVisuals = airCombat.visualDiagnostics();
  canvas.dataset.airCombatEnabled = String(airCombat.enabled);
  canvas.dataset.highQualityEnvironment = String(highQualityEnvironmentEnabled);
  canvas.dataset.environmentCloudCount = String(highQualityEnvironmentEnabled ? highQualityEnvironment.cloudCount : 0);
  canvas.dataset.environmentFogVolumeCount = String(highQualityEnvironmentEnabled ? highQualityEnvironment.fogVolumeCount : 0);
  canvas.dataset.environmentSunIntensity = sun.intensity.toFixed(2);
  canvas.dataset.environmentSunAltitudeDeg = AFTERNOON_SUN_ALTITUDE_DEG.toFixed(1);
  canvas.dataset.environmentExposure = renderer.toneMappingExposure.toFixed(2);
  canvas.dataset.environmentShadowMode = renderer.shadowMap.type === THREE.PCFSoftShadowMap ? "PCF_SOFT" : "OTHER";
  canvas.dataset.environmentAoMode = gtaoPass.enabled ? "GTAO_DENOISED" : ssaoPass.enabled ? "SSAO" : "OFF";
  canvas.dataset.environmentIndirectLighting = scene.environment === bouncedLightEnvironment ? "PMREM_MULTI_BOUNCE" : "OFF";
  canvas.dataset.environmentGodRays = cinematicAtmospherePass.enabled ? "RADIAL_COLOR_OCCLUSION_28" : "OFF";
  canvas.dataset.environmentColorGrade = cinematicAtmospherePass.enabled ? "CINEMATIC_OCEAN_LUT_16" : "OFF";
  canvas.dataset.webGpuUltraRequested = String(webGpuUltraInput.checked);
  canvas.dataset.webGpuUltraStatus = webGpuUltraStatus;
  canvas.dataset.webGpuUltraBackend = webGpuUltraResult?.backend ?? "WEBGL2";
  canvas.dataset.webGpuUltraAdapter = webGpuUltraResult?.adapterName ?? "";
  canvas.dataset.webGpuUltraError = webGpuUltraResult?.error ?? "";
  canvas.dataset.webGpuUltraCloudDetail = webGpuUltraStatus === "active" ? "COMPUTE_FBM_128" : "OFF";
  canvas.dataset.highQualityOcean = String(highQualityEnvironmentEnabled);
  canvas.dataset.cameraViewMode = String(viewMode);
  canvas.dataset.cameraAircraftId = selectedAircraftId ?? "";
  canvas.dataset.pureAirCombat = String(pureAirCombatStart);
  canvas.dataset.aircraftTotal = String(air.aircraft);
  canvas.dataset.aircraftLive = String(air.live);
  canvas.dataset.aircraftBlueLive = String(air.blueLive);
  canvas.dataset.aircraftRedLive = String(air.redLive);
  canvas.dataset.airWeaponsLaunched = String(air.launches);
  canvas.dataset.airWeaponsActive = String(air.activeMissiles);
  canvas.dataset.airCombatHits = String(air.hits);
  canvas.dataset.airCombatKills = String(air.kills);
  canvas.dataset.aircraftSmoking = String(airVisuals.smoking);
  canvas.dataset.aircraftBurning = String(airVisuals.burning);
  canvas.dataset.aircraftCrashed = String(airVisuals.crashed);
  canvas.dataset.airChaff = String(air.chaff);
  canvas.dataset.airFlares = String(air.flares);
  canvas.dataset.airMissileWarnings = String(air.missileWarnings);
  canvas.dataset.airEcmDetections = String(air.ecmDetections);
  canvas.dataset.airStandardDamageApplications = String(
    air.standardDamageApplications,
  );
  canvas.dataset.ksrMaximumSpeed = air.ksrMaximumSpeed.toFixed(2);
  const airDefenseTracks = [...combatPicture.tracks.values()].filter(
      (track) =>
        defenseTargetForSource(track.sourceId)?.entity?.kind === "missile",
    ).length,
    airDefenseAircraftTracks = [...combatPicture.tracks.values()].filter(
      (track) =>
        defenseTargetForSource(track.sourceId)?.entity?.kind === "aircraft",
    ).length,
    airDefenseMissileTracks = [...combatPicture.tracks.values()].filter(
      (track) =>
        defenseTargetForSource(track.sourceId)?.entity?.kind === "missile",
    ).length,
    airDefenseSamLaunches = interceptors.filter(
      (interceptor) => interceptor.target.entity,
    );
  canvas.dataset.shipAirMissileTracks = String(airDefenseTracks);
  canvas.dataset.shipAirAircraftTracks = String(airDefenseAircraftTracks);
  canvas.dataset.shipAirWeaponTracks = String(airDefenseMissileTracks);
  canvas.dataset.shipAirMissileKills = String(airDefenseHardKills.size);
  canvas.dataset.airDefenseLegacyRegistrations = String(
    missiles.filter((target) => target.entity).length,
  );
  canvas.dataset.airDefenseLegacyFields = String(
    [...airDefenseTargets.values()].reduce(
      (count, target) =>
        count +
        [
          "age",
          "history",
          "path",
          "speedFactor",
          "launchAt",
          "aimOffset",
          "bank",
          "externalAirEntityId",
          "externalAirCategory",
          "externalAirMissileId",
          "externalDisplayName",
        ].filter((field) => field in target).length,
      0,
    ),
  );
  canvas.dataset.airDefenseMissingEntityRefs = String(
    [...airDefenseTargets.values()].filter((target) => !target.entity).length,
  );
  canvas.dataset.airDefenseNonTargetableEntities = String(
    [...airDefenseTargets.values()].filter(
      (target) => typeof target.entity?.applyDamage !== "function",
    ).length,
  );
  canvas.dataset.airDefenseAmbiguousKindFields = String(
    allDefenseTargets().filter((target) => "kind" in target).length,
  );
  canvas.dataset.shipSamShots = String(airDefenseSamLaunches.length);
  canvas.dataset.airDefenseLaunchers = airDefenseSamLaunches
    .map(
      (interceptor) =>
        `${interceptor.mesh.userData.launcherLabel}/${interceptor.mesh.userData.launchPoint}`,
    )
    .join("|");
  canvas.dataset.airDefenseTargetCategories = airDefenseSamLaunches
    .map((interceptor) => interceptor.target.entity?.kind)
    .join("|");
  canvas.dataset.airDefenseTargetNames = airDefenseSamLaunches
    .map((interceptor) => interceptor.target.displayName)
    .join("|");
  const latestAar = aarSnapshots[aarSnapshots.length - 1];
  canvas.dataset.aarAircraftCount = String(latestAar?.aircraft.length ?? 0);
  canvas.dataset.aarAirWeaponCount = String(latestAar?.airWeapons.length ?? 0);
  canvas.dataset.aarAirDecoyCount = String(latestAar?.airDecoys.length ?? 0);
  canvas.dataset.airMissionStates = airCombat.aircraft
    .map((aircraft) => `${aircraft.id}:${aircraft.mission}`)
    .join(",");
  canvas.dataset.aircraftShipRangesKm = airCombat.aircraft
    .map(
      (aircraft) =>
        `${aircraft.id}:${(aircraft.position.distanceTo(defender.position) / WORLD_UNITS_PER_KM).toFixed(1)}`,
    )
    .join("|");
  canvas.dataset.airThrustStates = airCombat.aircraft
    .map(
      (aircraft) =>
        `${aircraft.id}:${aircraft.thrustMode}:${aircraft.afterburnerRemaining.toFixed(1)}:${aircraft.infraredSignature.toFixed(2)}`,
    )
    .join("|");
  canvas.dataset.airThrustEventLog = airCombat.events
    .filter((event) => event.kind === "maneuver" && event.text.includes("THRUST"))
    .map((event) => `${event.time.toFixed(2)}:${event.text}`)
    .join("|");
  canvas.dataset.airEscortAssignments = airCombat.aircraft
    .filter((aircraft) => aircraft.mission === "escort")
    .map((aircraft) => `${aircraft.id}->${aircraft.protectedId ?? "none"}`)
    .join(",");
  canvas.dataset.airFormationStates = airCombat.aircraft
    .map(
      (aircraft) =>
        `${aircraft.id}:${aircraft.formationStatus}:${Number.isFinite(aircraft.formationError) ? aircraft.formationError.toFixed(1) : "lost"}`,
    )
    .join(",");
  canvas.dataset.airShipHits = String(airShipHits);
  canvas.dataset.airShipDamage = airShipDamage.toFixed(1);
  canvas.dataset.airWeaponLaunchLog = airCombat.events
    .filter((event) => event.kind === "launch")
    .map((event) => event.text)
    .join("|");
  canvas.dataset.airSeekerEventLog = airCombat.events
    .filter(
      (event) =>
        (event.kind === "detect" && event.text.includes("SEEKER ACQUIRED")) ||
        event.kind === "guidance",
    )
    .map((event) => event.text)
    .join("|");
  canvas.dataset.airWeaponHitLog = airCombat.events
    .filter((event) => event.kind === "hit" || event.kind === "kill")
    .map((event) => event.text)
    .join("|");
  canvas.dataset.airDamageEventLog = airCombat.events
    .filter((event) => event.kind === "damage")
    .map((event) => event.text)
    .join("|");
  canvas.dataset.airReleaseAuthorizationLog = airCombat.events
    .filter((event) => event.text.includes("RELEASE AUTHORIZED"))
    .map((event) => event.text)
    .join("|");
  canvas.dataset.airCountermeasureEventLog = airCombat.events
    .filter((event) => event.kind === "countermeasure")
    .map((event) => `${event.time.toFixed(2)}:${event.text}`)
    .join("|");
  canvas.dataset.shipSrbocRounds = String(srbocRounds);
  canvas.dataset.shipSrbocRoundsInFlight = String(srbocRoundsInFlight.length);
  canvas.dataset.shipChaffClouds = String(
    chaffClouds.filter((cloud) => cloud.side === "ship").length,
  );
  canvas.dataset.airHardpointStates = airCombat.aircraft
    .flatMap((aircraft) =>
      aircraft.hardpoints.map(
        (hardpoint) =>
          `${aircraft.id}:${hardpoint.id}:${hardpoint.state}:${hardpoint.weaponId ?? "none"}`,
      ),
    )
    .join("|");
  canvas.dataset.airWeaponReleaseAges = airCombat.missiles
    .map(
      (missile) =>
        `${missile.id}:${missile.releaseAge.toFixed(2)}:${missile.ignitionDelay.toFixed(2)}`,
    )
    .join("|");
  const airStates = airCombat.aircraft.map(
    (aircraft) =>
      `${aircraft.id}:${aircraft.state}:${aircraft.position.y.toFixed(1)}:${aircraft.velocity.length().toFixed(1)}`,
  );
  canvas.dataset.aircraftStates = airStates.join(",");
  canvas.dataset.airWeaponPhases = airCombat.missiles
    .map(
      (missile) =>
        `${missile.definition.name}:${missile.phase}:${missile.seekerAcquired}`,
    )
    .join(",");
  airStatusPanel.style.display = airCombat.enabled ? "block" : "none";
  const airRows = airCombat.aircraft
    .map((aircraft) => {
      const bestTrack = Math.max(
        0,
        ...[...aircraft.tracks.values()].map((track) => track.quality),
      );
      const fuel = Math.round(
        (aircraft.fuel / aircraft.definition.flight.fuelSeconds) * 100,
      );
      const ammo = [...aircraft.ammo.values()].reduce(
        (sum, count) => sum + count,
        0,
      );
      const structure = Math.round(
        aircraft.subsystemHealth.get("structure") ?? 0,
      );
      const damage =
        aircraft.side === "blue"
          ? `STR ${structure}%`
          : aircraft.state === "disabled" || aircraft.state === "crashed"
            ? "KILL CONFIRMED"
            : "BDA UNKNOWN";
      const afterburner = aircraft.definition.flight.thrust.afterburnerAvailable
        ? ` / AB ${aircraft.afterburnerRemaining.toFixed(0)}s`
        : "";
      return `<small>${aircraft.definition.id} ${aircraft.formationIndex + 1} / ${aircraft.mission.toUpperCase()} / ${aircraft.thrustMode.toUpperCase()}${afterburner} / ${aircraft.formationStatus.toUpperCase()} ${Number.isFinite(aircraft.formationError) ? aircraft.formationError.toFixed(0) : "LOST"} / TQ ${Math.round(bestTrack * 100)}% / FUEL ${fuel}% / WPN ${ammo} / ${damage}</small>`;
    })
    .join("<br>");
  airStatusPanel.innerHTML = `<b>JOINT AIR PICTURE</b><span>BLUE <strong>${air.blueLive}</strong> / RED <strong>${air.redLive}</strong> / WEAPONS ${air.activeMissiles}</span><br><span>CHAFF ${air.chaff} / FLARES ${air.flares} / SMOKE ${airVisuals.smoking} / FIRE ${airVisuals.burning}</span><br>${airRows}`;
  canvas.dataset.surfaceEsmCueQuality = surfaceEsmCue.quality.toFixed(3);
  canvas.dataset.surfaceEsmCueAge = Number.isFinite(surfaceEsmCue.age)
    ? surfaceEsmCue.age.toFixed(2)
    : "infinity";
  ocean.update(elapsed, camera.position);
  highQualityEnvironment.update(elapsed, camera.position);
  const ewPulse = defender.userData.ewPulse as THREE.Group | undefined,
    ewThreat = missiles.some((m) => m.mesh.visible && m.phase === "terminal"),
    ecmHealth = subsystemHealth("ecm");
  if (ewPulse) {
    ewPulse.visible = shipEcmEnabled && ecmHealth > 0.05 && ewThreat;
    ewPulse.children.forEach((ring, index) => {
      const phase = (elapsed * 0.72 + index / 3) % 1,
        material = (ring as THREE.Mesh).material;
      if (material instanceof THREE.MeshBasicMaterial) {
        ring.scale.setScalar(0.55 + phase * 0.8);
        material.opacity = 0.2 * (1 - phase) * ecmHealth;
      }
    });
  }
  let activeThreatParticles = 0;
  missiles.forEach((m, index) => {
    if (!m.mesh.visible) return;
    const selection = m.mesh.userData.selection as THREE.Mesh | undefined;
    if (selection?.visible) {
      const parentWorld = m.mesh.getWorldQuaternion(new THREE.Quaternion());
      selection.quaternion.copy(
        parentWorld.invert().multiply(camera.quaternion),
      );
    }
    const pulse = 0.88 + Math.sin(elapsed * 19 + index * 1.7) * 0.12;
    const particleTrail = m.mesh.userData.particleTrail as
      ThreatParticleTrail | undefined;
    if (particleTrail) {
      updateThreatParticleTrail(
        particleTrail,
        elapsed + index * 0.17,
        0.9 + pulse * 0.12,
        !!m.mesh.userData.seaMistActive,
      );
      activeThreatParticles += m.mesh.userData.particleCount ?? 0;
    }
    const shock = m.mesh.userData.shockCone as THREE.Mesh | undefined;
    if (shock)
      (shock.material as THREE.MeshBasicMaterial).opacity =
        0.09 + pulse * 0.035;
  });
  canvas.dataset.activeThreatParticles = String(activeThreatParticles);
  clockEl.textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
  updateShipWeaponVisuals(realDt);
  updateCamera();
  // Directional lights have no emitter position, so project a distant point
  // along the same afternoon direction used by clouds, ocean and shadows.
  const sunWorldPoint = camera.position
    .clone()
    .addScaledVector(AFTERNOON_SUN_DIRECTION, camera.far * 0.72);
  const sunScreen = sunWorldPoint.project(camera);
  cinematicAtmospherePass.uniforms.sunPosition.value.set(
    sunScreen.x * 0.5 + 0.5,
    sunScreen.y * 0.5 + 0.5,
  );
  const sunVisible = sunScreen.z > -1 && sunScreen.z < 1 &&
    sunScreen.x > -1.25 && sunScreen.x < 1.25 && sunScreen.y > -1.25 && sunScreen.y < 1.25;
  cinematicAtmospherePass.uniforms.godRayStrength.value =
    highQualityEnvironmentEnabled && sunVisible ? 0.72 : 0;
  canvas.dataset.environmentSunScreen = `${sunScreen.x.toFixed(3)},${sunScreen.y.toFixed(3)},${sunScreen.z.toFixed(3)}`;
  canvas.dataset.environmentGodRayStrength = cinematicAtmospherePass.uniforms.godRayStrength.value.toFixed(2);
  canvas.dataset.environmentSunVisible = String(sunVisible);
  const followedMissile = viewMode === 4 &&
    (interceptors.some((item) => item.mesh.visible) || missiles.some((item) => item.mesh.visible));
  cinematicAtmospherePass.uniforms.chromaticAberration.value = followedMissile ? 0.72 : 0;
  updateShipVisualLod();
  updateShipLights();
  defender.userData.smokePuffs?.forEach((puff: THREE.Mesh, index: number) => {
    const life = (elapsed * 0.22 + index / 9) % 1;
    puff.position.set(
      -4 - life * 7,
      15 + life * 11,
      Math.sin(index * 2.1 + life * 4) * 0.8,
    );
    puff.scale.setScalar(0.55 + life * 2.1);
    (puff.material as THREE.MeshBasicMaterial).opacity = 0.13 * (1 - life);
  });
  if (defender.userData.flag) {
    const flagPositions = defender.userData.flag.geometry.attributes
      .position as THREE.BufferAttribute;
    for (let i = 0; i < flagPositions.count; i++) {
      const x = flagPositions.getX(i),
        y = flagPositions.getY(i),
        free = -x / 3.8;
      flagPositions.setZ(
        i,
        Math.sin(elapsed * 5 + x * 2.8 + y * 0.7) * 0.34 * free,
      );
    }
    flagPositions.needsUpdate = true;
  }
  shipDamageEffects.forEach((effect) => {
    effect.fire.scale.setScalar(
      0.8 + Math.sin(elapsed * 13 + effect.seed) * 0.22,
    );
    effect.light.intensity = 3.5 + Math.sin(elapsed * 17 + effect.seed) * 1.5;
    effect.smoke.forEach((puff, index) => {
      const life =
        (elapsed * 0.28 + index / effect.smoke.length + effect.seed) % 1;
      puff.position.set(
        -life * 2,
        1 + life * 9,
        Math.sin(effect.seed + index * 1.7) * 0.7,
      );
      puff.scale.setScalar(0.5 + life * 2.4);
      (puff.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - life);
    });
  });
  updateTargetMarker();
  composer.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  cinematicAtmospherePass.uniforms.resolution.value.set(innerWidth, innerHeight);
  ocean.resize(innerWidth, innerHeight);
  ssaoPass.enabled = innerWidth > 720;
  if (!highQualityEnvironmentEnabled) ssaoPass.enabled = innerWidth > 720;
  canvas.dataset.ssaoEnabled = String(ssaoPass.enabled);
});
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  px = e.clientX;
  py = e.clientY;
});
addEventListener("pointerup", () => (dragging = false));
addEventListener("pointermove", (e) => {
  if (!dragging) return;
  az -= (e.clientX - px) * 0.006;
  el = Math.max(-0.52, Math.min(1.2, el + (e.clientY - py) * 0.005));
  px = e.clientX;
  py = e.clientY;
});
canvas.addEventListener("wheel", (e) => {
  dist = Math.max(70, Math.min(360, dist + e.deltaY * 0.12));
});
function cycleAircraft(
  currentId: string | null,
  side?: "blue" | "red",
) {
  const candidates = airCombat.aircraft.filter(
    (aircraft) => aircraft.alive && (!side || aircraft.side === side),
  );
  if (!candidates.length) return null;
  const currentIndex = candidates.findIndex(
    (aircraft) => aircraft.id === currentId,
  );
  return candidates[(currentIndex + 1) % candidates.length].id;
}
addEventListener("keydown", (e) => {
  if (e.code === "Space") running = !running;
  if (e.key.toLowerCase() === "r") location.reload();
});
addEventListener("keydown", (e) => {
  if (e.key === "1") {
    cinematic = false;
    viewMode = 1;
    az = 0.8;
    el = 0.32;
    dist = 125;
  }
  if (e.key === "2") {
    cinematic = false;
    viewMode = 2;
    az = 0.65;
    el = 0.48;
    dist = 210;
  }
  if (e.key === "3") {
    cinematic = false;
    viewMode = 3;
    az = 0.15;
    el = 0.25;
    dist = 260;
  }
  if (e.key === "4") {
    cinematic = false;
    viewMode = 4;
    az = 0.8;
    el = 0.18;
    dist = 28;
  }
  if (e.key === "5" && enemyPlatform) {
    cinematic = false;
    viewMode = 5;
    az = 0.78;
    el = 0.3;
    dist = 115;
  }
  if (e.key === "6") {
    cinematic = false;
    viewMode = 6;
    selectedAircraftId = cycleAircraft(selectedAircraftId);
    az = 0;
    el = 0.2;
    dist = 42;
  }
  if (e.key === "7") {
    cinematic = false;
    viewMode = 7;
    selectedAircraftId = cycleAircraft(selectedAircraftId, "blue");
    az = 0;
    el = 0.2;
    dist = 42;
  }
  if (e.key === "8") {
    cinematic = false;
    viewMode = 8;
    selectedAircraftId = cycleAircraft(selectedAircraftId, "red");
    az = 0;
    el = 0.2;
    dist = 42;
  }
  if (e.key === "9") {
    cinematic = false;
    viewMode = 9;
    selectedAircraftId = null;
    az = 0.65;
    el = 0.58;
    dist = 300;
  }
  if (e.key.toLowerCase() === "c") cinematic = !cinematic;
});
