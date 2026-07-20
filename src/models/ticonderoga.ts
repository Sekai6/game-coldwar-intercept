import * as THREE from "three";
import type { ShipDefinition } from "../ship-types";
import { applySurfaceDetail } from "../visual/material-textures";
import {
  createLoftedHullGeometry,
  createSheerDeckGeometry,
  createWaterlineBandGeometry,
  type HullStation,
} from "./hull-geometry";
import {
  addModelStrut as strut,
  createMk141Launcher,
  createSlopedBoxGeometry as slopedBox,
  type ModelWeaponHardpoint,
} from "./model-primitives";
import {
  createMk41VlsBank,
  createMk45Gun,
  createPhalanxCiws,
  createSlq32Array,
  createSpg62Director,
  createSpy1Array,
  type VlsCell,
} from "./us-navy-equipment";

const TICONDEROGA_REAL_LENGTH_M = 172.8;
const TICONDEROGA_REAL_BEAM_M = 16.8;
const MODEL_METERS_PER_UNIT = 2.25;
const TICONDEROGA_LENGTH_SCALE =
  TICONDEROGA_REAL_LENGTH_M / MODEL_METERS_PER_UNIT / 68;
const TICONDEROGA_MODEL_BEAM = TICONDEROGA_REAL_BEAM_M / MODEL_METERS_PER_UNIT;
const longitudinal = (value: number) => value * TICONDEROGA_LENGTH_SCALE;
const TICONDEROGA_HULL: readonly HullStation[] = [
  { x: longitudinal(-34), deckHalf: 2.92, shoulderHalf: 2.82, waterlineHalf: 2.62, keelHalf: 1.02, deckY: 5.5, shoulderY: 3.28, waterlineY: 0.34, keelY: -0.62 },
  { x: longitudinal(-32.2), deckHalf: 3.28, shoulderHalf: 3.16, waterlineHalf: 2.92, keelHalf: 1.12, deckY: 5.56, shoulderY: 3.23, waterlineY: 0.31, keelY: -0.74 },
  { x: longitudinal(-28), deckHalf: 3.52, shoulderHalf: 3.4, waterlineHalf: 3.08, keelHalf: 1.18, deckY: 5.64, shoulderY: 3.18, waterlineY: 0.29, keelY: -0.84 },
  { x: longitudinal(-20), deckHalf: 3.66, shoulderHalf: 3.52, waterlineHalf: 3.16, keelHalf: 1.2, deckY: 5.74, shoulderY: 3.16, waterlineY: 0.28, keelY: -0.9 },
  { x: longitudinal(-8), deckHalf: 3.73, shoulderHalf: 3.58, waterlineHalf: 3.19, keelHalf: 1.2, deckY: 5.82, shoulderY: 3.16, waterlineY: 0.27, keelY: -0.94 },
  { x: longitudinal(6), deckHalf: 3.73, shoulderHalf: 3.58, waterlineHalf: 3.17, keelHalf: 1.18, deckY: 5.86, shoulderY: 3.18, waterlineY: 0.27, keelY: -0.94 },
  { x: longitudinal(14), deckHalf: 3.68, shoulderHalf: 3.52, waterlineHalf: 3.07, keelHalf: 1.12, deckY: 5.91, shoulderY: 3.24, waterlineY: 0.29, keelY: -0.88 },
  { x: longitudinal(20.5), deckHalf: 3.45, shoulderHalf: 3.26, waterlineHalf: 2.78, keelHalf: 0.96, deckY: 6.01, shoulderY: 3.42, waterlineY: 0.32, keelY: -0.72 },
  { x: longitudinal(25.5), deckHalf: 3.0, shoulderHalf: 2.78, waterlineHalf: 2.28, keelHalf: 0.74, deckY: 6.18, shoulderY: 3.67, waterlineY: 0.36, keelY: -0.54 },
  { x: longitudinal(29), deckHalf: 2.2, shoulderHalf: 1.96, waterlineHalf: 1.5, keelHalf: 0.44, deckY: 6.42, shoulderY: 3.98, waterlineY: 0.42, keelY: -0.28 },
  { x: longitudinal(31.5), deckHalf: 1.2, shoulderHalf: 0.98, waterlineHalf: 0.68, keelHalf: 0.2, deckY: 6.66, shoulderY: 4.3, waterlineY: 0.48, keelY: -0.02 },
  { x: longitudinal(33.1), deckHalf: 0.42, shoulderHalf: 0.31, waterlineHalf: 0.18, keelHalf: 0.05, deckY: 6.84, shoulderY: 4.57, waterlineY: 0.55, keelY: 0.2 },
  { x: longitudinal(34), deckHalf: 0.045, shoulderHalf: 0.035, waterlineHalf: 0.02, keelHalf: 0.008, deckY: 6.94, shoulderY: 4.75, waterlineY: 0.59, keelY: 0.36 },
];
function hullNumberTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f3f4ee";
  context.font = "700 58px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("57", 128, 51);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function flagTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 247;
  canvas.height = 130;
  const context = canvas.getContext("2d")!;
  for (let row = 0; row < 13; row++) {
    context.fillStyle = row % 2 ? "#f4f3ed" : "#b22234";
    context.fillRect(0, row * 10, 247, 10);
  }
  context.fillStyle = "#3c3b6e";
  context.fillRect(0, 0, 99, 70);
  context.fillStyle = "#fff";
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 6; x++) {
      context.beginPath();
      context.arc(9 + x * 16 + (y % 2) * 8, 8 + y * 14, 1.8, 0, Math.PI * 2);
      context.fill();
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function buildTiconderoga() {
  const ship = new THREE.Group(),
    hullMat = new THREE.MeshStandardMaterial({
      color: 0x748183,
      metalness: 0.14,
      roughness: 0.5,
    }),
    deckMat = new THREE.MeshStandardMaterial({
      color: 0x5d6867,
      metalness: 0.1,
      roughness: 0.7,
    }),
    superMat = new THREE.MeshStandardMaterial({
      color: 0x8d9998,
      metalness: 0.16,
      roughness: 0.56,
    }),
    dark = new THREE.MeshStandardMaterial({
      color: 0x263235,
      metalness: 0.52,
      roughness: 0.46,
    }),
    arrayMat = new THREE.MeshStandardMaterial({
      color: 0xcbd0c8,
      metalness: 0.24,
      roughness: 0.58,
    }),
    windowMat = new THREE.MeshStandardMaterial({
      color: 0x4ca8ad,
      emissive: 0x123f43,
      emissiveIntensity: 1.5,
    }),
    highDetail = new THREE.Group(),
    mediumDetail = new THREE.Group(),
    lowDetail = new THREE.Group();
  applySurfaceDetail(hullMat, "painted-metal", 0.3);
  applySurfaceDetail(deckMat, "weather-deck", 0.5);
  applySurfaceDetail(superMat, "painted-metal", 0.26);
  applySurfaceDetail(dark, "dark-metal", 0.34);
  applySurfaceDetail(arrayMat, "painted-metal", 0.2);
  const hull = new THREE.Mesh(createLoftedHullGeometry(TICONDEROGA_HULL), hullMat),
    waterline = new THREE.Mesh(
      createWaterlineBandGeometry(TICONDEROGA_HULL),
      new THREE.MeshStandardMaterial({ color: 0x151d20, roughness: 0.8 }),
    );
  ship.add(hull, waterline);
  const deck = new THREE.Mesh(
    createSheerDeckGeometry(TICONDEROGA_HULL),
    deckMat,
  );
  ship.add(deck);
  const forwardHouse = new THREE.Mesh(
    slopedBox(longitudinal(15.5), 7.8, 6.35, longitudinal(2.8), longitudinal(0.65)),
    superMat,
  );
  forwardHouse.position.set(longitudinal(5.5), 9.6, 0);
  ship.add(forwardHouse);
  const bridge = new THREE.Mesh(
    slopedBox(longitudinal(8.8), 3.1, 5.85, longitudinal(1.8), longitudinal(0.45)),
    superMat,
  );
  bridge.position.set(longitudinal(9.4), 14.85, 0);
  ship.add(bridge);
  const bridgeRoof = new THREE.Mesh(
    slopedBox(longitudinal(6.4), 0.55, 5.2, longitudinal(0.7), longitudinal(0.25)),
    dark,
  );
  bridgeRoof.position.set(longitudinal(8.4), 16.65, 0);
  ship.add(bridgeRoof);
  for (const side of [-1, 1])
    for (let x = 6.7; x <= 11.7; x += 0.82) {
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.42, 0.1),
        windowMat,
      );
      window.position.set(longitudinal(x), 15.25, side * 2.98);
      ship.add(window);
    }
  for (let z = -2.15; z <= 2.15; z += 0.72) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.42, 0.48),
      windowMat,
    );
    window.position.set(longitudinal(13.25), 15.25, z);
    ship.add(window);
  }
  for (const side of [-1, 1]) {
    const bridgeWing = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(3.1), 0.32, 1.15),
      superMat,
    );
    bridgeWing.position.set(longitudinal(9.9), 14.05, side * 3.28);
    const bulwark = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(3.25), 0.48, 0.09),
      superMat,
    );
    bulwark.position.set(longitudinal(9.9), 14.42, side * 3.82);
    highDetail.add(bridgeWing, bulwark);
  }
  const aftHouse = new THREE.Mesh(
    slopedBox(longitudinal(14), 6.8, 6.35, longitudinal(0.75), longitudinal(1.9)),
    superMat,
  );
  aftHouse.position.set(longitudinal(-7.8), 9.1, 0);
  ship.add(aftHouse);
  const hangar = new THREE.Mesh(
    slopedBox(longitudinal(8.2), 4.2, 6.25, longitudinal(0.25), longitudinal(1.15)),
    superMat,
  );
  hangar.position.set(longitudinal(-14.3), 8, 0);
  ship.add(hangar);
  for (const side of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.45, 0.12), dark);
    door.position.set(longitudinal(-15.2), 7.8, side * 3.18);
    ship.add(door);
    const catwalk = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(12), 0.18, 0.85),
      dark,
    );
    catwalk.position.set(longitudinal(-8.5), 10.9, side * 3.55);
    ship.add(catwalk);
  }
  const arrays: THREE.Group[] = [];
  arrays.push(
    createSpy1Array(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(12.95), 12.25, 0),
      new THREE.Euler(0, Math.PI / 2, 0),
    ),
  );
  arrays.push(
    createSpy1Array(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(5.8), 12.25, -3.22),
      new THREE.Euler(0, 0, 0),
    ),
  );
  arrays.push(
    createSpy1Array(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(-14.9), 11.65, 0),
      new THREE.Euler(0, -Math.PI / 2, 0),
    ),
  );
  arrays.push(
    createSpy1Array(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(-8.6), 11.65, 3.22),
      new THREE.Euler(0, Math.PI, 0),
    ),
  );
  ship.add(...arrays);
  for (const x of [longitudinal(1.2), longitudinal(-8.5)]) {
    const trunk = new THREE.Mesh(
      slopedBox(3.1, 3.2, 3.5, 0.45, 0.45),
      superMat,
    );
    trunk.position.set(x, 14.4, 0);
    ship.add(trunk);
    for (const z of [-0.72, 0.72]) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.82, 2.45, 10),
        dark,
      );
      stack.position.set(x, 17, z);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.74, 0.74, 0.25, 10),
        new THREE.MeshBasicMaterial({ color: 0x111719 }),
      );
      cap.position.set(x, 18.3, z);
      ship.add(stack, cap);
    }
  }
  const foreMast = new THREE.Group();
  foreMast.position.set(longitudinal(4.2), 15, 0);
  for (const side of [-1, 1])
    strut(
      foreMast,
      new THREE.Vector3(-1, 0, side * 1.7),
      new THREE.Vector3(0, 10, side * 0.45),
      0.13,
      dark,
    );
  strut(
    foreMast,
    new THREE.Vector3(1.2, 0, 0),
    new THREE.Vector3(0, 10, 0),
    0.13,
    dark,
  );
  for (let y = 2; y < 9; y += 2) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 3 - y * 0.18),
      dark,
    );
    bar.position.y = y;
    foreMast.add(bar);
  }
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.1, 0.25, 10),
    dark,
  );
  platform.position.y = 8.5;
  foreMast.add(platform);
  const mastPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.22, 8, 7),
    dark,
  );
  mastPole.position.y = 13;
  foreMast.add(mastPole);
  const sps49 = new THREE.Group();
  sps49.position.y = 10.2;
  const radarBar = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.12, 0.12),
    arrayMat,
  );
  sps49.add(radarBar);
  for (let x = -3; x <= 3; x += 0.75) {
    const tine = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 2.1, 0.06),
      arrayMat,
    );
    tine.position.x = x;
    sps49.add(tine);
  }
  foreMast.add(sps49);
  ship.add(foreMast);
  const aftMast = new THREE.Group();
  aftMast.position.set(longitudinal(-11.5), 14, 0);
  for (const side of [-1, 1])
    strut(
      aftMast,
      new THREE.Vector3(-1, 0, side * 1.5),
      new THREE.Vector3(0, 8, side * 0.4),
      0.12,
      dark,
    );
  strut(
    aftMast,
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 8, 0),
    0.12,
    dark,
  );
  const aftPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.2, 6.5, 7),
    dark,
  );
  aftPole.position.y = 10.5;
  aftMast.add(aftPole);
  ship.add(aftMast);
  const forwardVls = createMk41VlsBank(8, 8, 0.72, superMat, dark, [0, 1, 8]);
  forwardVls.position.set(longitudinal(21.5), 5.9, 0);
  const aftVls = createMk41VlsBank(8, 8, 0.72, superMat, dark, [55, 62, 63]);
  aftVls.position.set(longitudinal(-25.2), 5.9, 0);
  ship.add(forwardVls, aftVls);
  const vlsCells = [
    ...(forwardVls.userData.cells as VlsCell[]).map((cell) => ({
      ...cell,
      bank: "FWD",
    })),
    ...(aftVls.userData.cells as VlsCell[]).map((cell) => ({
      ...cell,
      bank: "AFT",
    })),
  ];
  const foreGun = createMk45Gun(superMat, dark);
  foreGun.position.set(longitudinal(29.2), 6.15, 0);
  const aftGun = createMk45Gun(superMat, dark);
  aftGun.position.set(longitudinal(-31), 6.15, 0);
  aftGun.rotation.y = Math.PI;
  ship.add(foreGun, aftGun);
  const directors = [
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(10), 13.5, -3.7),
      -0.25,
    ),
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(10), 13.5, 3.7),
      0.25,
    ),
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(-10.8), 13.5, -3.7),
      Math.PI + 0.3,
    ),
    createSpg62Director(
      arrayMat,
      dark,
      new THREE.Vector3(longitudinal(-10.8), 13.5, 3.7),
      Math.PI - 0.3,
    ),
  ];
  ship.add(...directors);
  const foreCiws = createPhalanxCiws(superMat, dark, "ciwsFore");
  foreCiws.position.set(longitudinal(13.5), 9.3, 0);
  const aftCiws = createPhalanxCiws(superMat, dark, "ciwsAft");
  aftCiws.position.set(longitudinal(-15.5), 10.2, -3.55);
  aftCiws.rotation.y = Math.PI;
  ship.add(foreCiws, aftCiws);
  const flightDeck = new THREE.Mesh(
    new THREE.BoxGeometry(longitudinal(7.8), 0.14, 6.35),
    deckMat,
  );
  flightDeck.position.set(longitudinal(-19.2), 6.05, 0);
  ship.add(flightDeck);
  const marking = new THREE.Mesh(
    new THREE.RingGeometry(2.05, 2.18, 48),
    new THREE.MeshBasicMaterial({ color: 0xe8e4cb, side: THREE.DoubleSide }),
  );
  marking.rotation.x = -Math.PI / 2;
  marking.position.set(longitudinal(-19.2), 6.14, 0);
  highDetail.add(marking);
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(7.2), 0.025, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xe8e4cb }),
    );
    line.position.set(longitudinal(-19.2), 6.15, side * 2.75);
    highDetail.add(line);
  }
  for (const side of [-1, 1])
    for (let x = -28; x <= 28; x += 2.5) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.65, 5),
        dark,
      );
      post.position.set(
        longitudinal(x),
        6.45,
        side * (x > 20 ? 3.2 : x < -25 ? 3.2 : 3.72),
      );
      highDetail.add(post);
    }
  for (const side of [-1, 1])
    for (const x of [-2, -6, -10]) {
      const boat = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 2.5, 4, 9),
        new THREE.MeshStandardMaterial({ color: 0xe1d9c8, roughness: 0.66 }),
      );
      boat.rotation.z = Math.PI / 2;
      boat.position.set(longitudinal(x), 9.1, side * 4.05);
      highDetail.add(boat);
    }
  for (const side of [-1, 1]) {
    const boatBay = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(10.5), 2.15, 0.18),
      dark,
    );
    boatBay.position.set(longitudinal(-6), 8.85, side * 3.61);
    highDetail.add(boatBay);
    for (const x of [-10.5, -6, -1.5]) {
      const davit = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.055, 6, 14, Math.PI),
        dark,
      );
      davit.rotation.x = side > 0 ? 0 : Math.PI;
      davit.position.set(longitudinal(x), 9.75, side * 3.9);
      highDetail.add(davit);
    }
  }
  for (const side of [-1, 1])
    for (const x of [-15, -4, 7, 15]) {
      const canister = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 1.75, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xd4d8cf, roughness: 0.7 }),
      );
      canister.rotation.z = Math.PI / 2;
      canister.position.set(longitudinal(x), 8.2, side * 4);
      highDetail.add(canister);
    }
  const surfaceStrikeHardpoints: ModelWeaponHardpoint[] = [];
  for (const side of [-1, 1]) {
    const harpoon = createMk141Launcher(
      superMat,
      dark,
      `mk141-${side > 0 ? "starboard" : "port"}`,
    );
    harpoon.position.set(longitudinal(-1.5), 7.2, side * 2.15);
    harpoon.rotation.y = side * 0.42;
    surfaceStrikeHardpoints.push(
      ...(harpoon.userData.weaponHardpoints as ModelWeaponHardpoint[]),
    );
    highDetail.add(harpoon);
    const ewArray = createSlq32Array(arrayMat, dark);
    ewArray.position.set(longitudinal(1.8), 13.2, side * 3.38);
    ewArray.rotation.y = side > 0 ? 0 : Math.PI;
    highDetail.add(ewArray);
  }
  for (const side of [-1, 1]) {
    const platingSeam = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(49), 0.045, 0.045),
      dark,
    );
    platingSeam.position.set(longitudinal(-2), 2.35, side * 3.21);
    highDetail.add(platingSeam);
    const hawse = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.11, 8, 18),
      dark,
    );
    hawse.position.set(longitudinal(28.4), 3.65, side * 2.36);
    highDetail.add(hawse);
    const anchor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.35, 7),
      dark,
    );
    anchor.position.set(longitudinal(29), 3.25, side * 2.48);
    anchor.rotation.z = 0.62;
    highDetail.add(anchor);
  }
  const rastTrack = new THREE.Mesh(
    new THREE.BoxGeometry(longitudinal(10.5), 0.025, 0.09),
    new THREE.MeshBasicMaterial({ color: 0xe8e4cb }),
  );
  rastTrack.position.set(longitudinal(-19.5), 6.17, 0);
  highDetail.add(rastTrack);
  const smokePuffs: THREE.Mesh[] = [],
    smokeOrigins = [
      new THREE.Vector3(longitudinal(1.2), 18.3, -0.72),
      new THREE.Vector3(longitudinal(1.2), 18.3, 0.72),
      new THREE.Vector3(longitudinal(-8.5), 18.3, -0.72),
      new THREE.Vector3(longitudinal(-8.5), 18.3, 0.72),
    ];
  for (let n = 0; n < 12; n++) {
    const anchor = new THREE.Group(),
      origin = smokeOrigins[n % smokeOrigins.length],
      puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 7, 5),
        new THREE.MeshBasicMaterial({
          color: 0x526064,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
    anchor.position.copy(origin).sub(new THREE.Vector3(-4, 15, 0));
    anchor.add(puff);
    smokePuffs.push(puff);
    highDetail.add(anchor);
  }
  const flagGeometry = new THREE.PlaneGeometry(3, 1.6, 10, 3);
  flagGeometry.translate(-1.5, 0, 0);
  const flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({
      map: flagTexture(),
      side: THREE.DoubleSide,
    }),
  );
  flag.position.set(longitudinal(-11.5), 25, 0);
  highDetail.add(flag);
  ship.add(highDetail);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(longitudinal(48), 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x82908d }),
    );
    rail.position.set(longitudinal(-1), 6.65, side * 3.72);
    mediumDetail.add(rail);
  }
  ship.add(mediumDetail);
  const lowHull = new THREE.Mesh(
    new THREE.BoxGeometry(longitudinal(28), 5, 7),
    superMat,
  );
  lowHull.position.set(longitudinal(-1), 9, 0);
  const lowMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.35, 15, 6),
    dark,
  );
  lowMast.position.set(longitudinal(2), 19, 0);
  lowDetail.add(lowHull, lowMast);
  lowDetail.visible = false;
  ship.add(lowDetail);
  const numberMaterial = new THREE.MeshBasicMaterial({
    map: hullNumberTexture(),
    transparent: true,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.35),
      numberMaterial,
    );
    number.position.set(longitudinal(23), 3.6, side * 3.02);
    number.rotation.y = side > 0 ? 0 : Math.PI;
    ship.add(number);
  }
  const navigationLights: THREE.PointLight[] = [],
    lightBulbs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const color = side > 0 ? 0x42ff74 : 0xff493e,
      light = new THREE.PointLight(color, 3, 18),
      bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
    light.position.set(longitudinal(10.5), 17, side * 3.7);
    bulb.position.copy(light.position);
    navigationLights.push(light);
    lightBulbs.push(bulb);
    ship.add(light, bulb);
  }
  const mastLight = new THREE.PointLight(0xf5fff0, 2.5, 24),
    mastBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf5fff0 }),
    );
  mastLight.position.set(longitudinal(4.2), 31, 0);
  mastBulb.position.copy(mastLight.position);
  navigationLights.push(mastLight);
  lightBulbs.push(mastBulb);
  ship.add(mastLight, mastBulb);
  const radar = new THREE.Group();
  radar.userData.static = true;
  const searchBeam = new THREE.Mesh(
    new THREE.RingGeometry(25, 105, 64, 1, 0, Math.PI * 0.13),
    new THREE.MeshBasicMaterial({
      color: 0x5ee9df,
      transparent: true,
      opacity: 0.025,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  searchBeam.rotation.x = -Math.PI / 2;
  searchBeam.position.set(longitudinal(4), 18, 0);
  radar.add(searchBeam);
  radar.userData.searchBeam = searchBeam;
  ship.add(radar);
  const fireControl = new THREE.Group();
  fireControl.userData.static = true;
  ship.add(fireControl);
  const ewPulse = new THREE.Group();
  for (let n = 0; n < 3; n++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(12 + n * 8, 0.08, 6, 72),
      new THREE.MeshBasicMaterial({
        color: 0x66e5dc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 18;
    ewPulse.add(ring);
  }
  ewPulse.visible = false;
  ship.add(ewPulse);
  ship.userData = {
    shipClass: "ticonderoga",
    hullStations: TICONDEROGA_HULL.length,
    hullSectionPoints: 8,
    hullLength: longitudinal(68),
    hullBeam: TICONDEROGA_MODEL_BEAM,
    hullLengthBeamRatio: longitudinal(68) / TICONDEROGA_MODEL_BEAM,
    realLengthMeters: TICONDEROGA_REAL_LENGTH_M,
    realBeamMeters: TICONDEROGA_REAL_BEAM_M,
    modelMetersPerUnit: MODEL_METERS_PER_UNIT,
    surfaceStrikeHardpoints,
    vlsCells,
    radar,
    secondaryRadar: sps49,
    fireControl,
    directors,
    sensorFaceModels: arrays,
    fixedSensorFaceHealth: [1, 1, 1, 1],
    highDetail,
    mediumDetail,
    lowDetail,
    smokePuffs,
    flag,
    hullMat,
    ewPulse,
    navigationLights,
    lightBulbs,
    detail: [
      forwardHouse,
      bridge,
      aftHouse,
      hangar,
      foreMast,
      aftMast,
      forwardVls,
      aftVls,
      foreGun,
      aftGun,
      foreCiws,
      aftCiws,
      rastTrack,
      ...directors,
      ...arrays,
    ],
  };
  return ship;
}

export const TICONDEROGA_METADATA: Omit<ShipDefinition, "build"> = {
  id: "ticonderoga",
  name: "USS LAKE CHAMPLAIN",
  hullNumber: "CG-57",
  era: "1990s AEGIS",
  role: "AEGIS AIR DEFENSE CRUISER",
  platform: { maxSpeedKnots: 32.5, turnRateDeg: 1.8, radarRcs: 10.5 },
  hullColor: 0x748183,
  surfaceStrike: {
    weapon: "RGM-84 Harpoon",
    displayName: "2 x MK 141 QUAD HARPOON",
    magazine: 8,
    minimumInterval: 1.4,
    minRange: 35,
    maxRange: 720,
    requiredTrackQuality: 0.58,
    maximumTrackAge: 4,
    minimumTrackAge: 2.2,
    fireControlDelay: 1.6,
    datalinkUpdateInterval: 2.4,
    datalinkLatency: 0.4,
    datalinkMinimumQuality: 0.18,
    damage: 34,
    salvoSize: 4,
    minimumSalvoSize: 2,
    maximumWeaponsInFlight: 4,
    assessmentDelay: 3,
    expectedLeakProbability: 0.46,
    targetHullEstimate: 100,
  },
  launcher: {
    kind: "mk41",
    displayName: "MK 41 VLS",
    compatibleWeapons: ["SM-2MR", "SM-2ER"],
    columns: 8,
    sequenceInterval: 0.5,
    exhaustClearance: 1.6,
    isolationStartsAt: 0.75,
    maximumIsolationFraction: 0.48,
    loadingPermutation: 17,
    gridSize: 64,
  },
  fixedSensorFaces: {
    sensorName: "AN/SPY-1B",
    subsystemId: "primaryRadar",
    labels: ["BOW", "STARBOARD", "STERN", "PORT"],
    headings: [0, Math.PI / 2, Math.PI, -Math.PI / 2],
    damageMultiplier: 1.45,
    healthyColor: 0xcbd0c8,
    damagedColor: 0x4a302c,
    criticalEmissive: 0x45120c,
  },
  sensors: [
    {
      name: "AN/SPY-1B",
      threeDimensional: true,
      baseInterval: 0.42,
      maxRange: 820,
      radarHeight: 32,
      precision: 1.12,
      scanMode: "phased-array",
    },
    {
      name: "AN/SPS-49",
      threeDimensional: false,
      baseInterval: 1.05,
      maxRange: 1100,
      radarHeight: 38,
      precision: 0.75,
      scanMode: "mechanical",
    },
  ],
  subsystemLabels: {
    primaryRadar: "AN/SPY-1B",
    secondaryRadar: "AN/SPS-49",
    fireControl: "AN/SPG-62",
    aftLauncher: "MK 41 AFT",
    forwardLauncher: "MK 41 FWD",
    ciws: "PHALANX CIWS",
    ecm: "AN/SLQ-32",
    srboc: "MK 36 SRBOC",
    propulsion: "PROPULSION",
  },
  subsystemPositions: {
    primaryRadar: new THREE.Vector3(longitudinal(7), 13, 0),
    secondaryRadar: new THREE.Vector3(longitudinal(4), 25, 0),
    fireControl: new THREE.Vector3(longitudinal(10), 14, 0),
    aftLauncher: new THREE.Vector3(longitudinal(-25), 6, 0),
    forwardLauncher: new THREE.Vector3(longitudinal(22), 6, 0),
    ciws: new THREE.Vector3(longitudinal(13), 10, 0),
    ecm: new THREE.Vector3(longitudinal(-2), 15, 4),
    srboc: new THREE.Vector3(longitudinal(-5), 8, 4),
    propulsion: new THREE.Vector3(longitudinal(-7), 5, 0),
  },
  damageModel: {
    longitudinalLimit: longitudinal(30),
    zones: [
      { minX: longitudinal(18), systems: ["forwardLauncher", "ciws", "fireControl"] },
      { minX: longitudinal(6), systems: ["primaryRadar", "fireControl", "ecm", "ciws"] },
      {
        minX: longitudinal(-9),
        systems: ["fireControl", "ecm", "propulsion", "primaryRadar"],
      },
      {
        minX: longitudinal(-20),
        systems: ["secondaryRadar", "srboc", "propulsion", "fireControl"],
      },
      {
        minX: -Infinity,
        systems: ["aftLauncher", "srboc", "ciws", "secondaryRadar"],
      },
    ],
  },
  ammo: {
    rim67: 0,
    sm2mr: 48,
    sm2er: 32,
    ciws: 1800,
    channels: 6,
    illuminators: 4,
  },
};
