import * as THREE from "three";
import { applySurfaceDetail } from "../visual/material-textures";
import {
  createLoftedHullGeometry,
  createSheerDeckGeometry,
  createWaterlineBandGeometry,
  type HullStation,
} from "./hull-geometry";

const LONG_BEACH_HULL: readonly HullStation[] = [
  { x: -30, deckHalf: 2.8, shoulderHalf: 2.7, waterlineHalf: 2.45, keelHalf: 0.72, deckY: 5.72, shoulderY: 3.55, waterlineY: 0.34, keelY: -0.72 },
  { x: -28, deckHalf: 3.35, shoulderHalf: 3.25, waterlineHalf: 2.92, keelHalf: 0.9, deckY: 5.82, shoulderY: 3.5, waterlineY: 0.32, keelY: -0.82 },
  { x: -24, deckHalf: 3.68, shoulderHalf: 3.55, waterlineHalf: 3.14, keelHalf: 1, deckY: 5.92, shoulderY: 3.45, waterlineY: 0.3, keelY: -0.92 },
  { x: -16, deckHalf: 3.82, shoulderHalf: 3.67, waterlineHalf: 3.24, keelHalf: 1.05, deckY: 6, shoulderY: 3.42, waterlineY: 0.28, keelY: -0.98 },
  { x: 0, deckHalf: 3.85, shoulderHalf: 3.7, waterlineHalf: 3.25, keelHalf: 1.06, deckY: 6.02, shoulderY: 3.42, waterlineY: 0.28, keelY: -1 },
  { x: 12, deckHalf: 3.78, shoulderHalf: 3.63, waterlineHalf: 3.1, keelHalf: 1, deckY: 6.08, shoulderY: 3.48, waterlineY: 0.3, keelY: -0.94 },
  { x: 19, deckHalf: 3.42, shoulderHalf: 3.24, waterlineHalf: 2.7, keelHalf: 0.84, deckY: 6.2, shoulderY: 3.62, waterlineY: 0.34, keelY: -0.78 },
  { x: 24, deckHalf: 2.62, shoulderHalf: 2.38, waterlineHalf: 1.86, keelHalf: 0.55, deckY: 6.42, shoulderY: 3.9, waterlineY: 0.4, keelY: -0.52 },
  { x: 27.5, deckHalf: 1.32, shoulderHalf: 1.08, waterlineHalf: 0.7, keelHalf: 0.2, deckY: 6.72, shoulderY: 4.3, waterlineY: 0.48, keelY: -0.12 },
  { x: 29.5, deckHalf: 0.06, shoulderHalf: 0.045, waterlineHalf: 0.025, keelHalf: 0.01, deckY: 7.08, shoulderY: 4.8, waterlineY: 0.58, keelY: 0.32 },
];
function createSlopedBoxGeometry(
  length: number,
  height: number,
  depth: number,
  slope: number,
) {
  const geometry = new THREE.BoxGeometry(length, height, depth, 1, 1, 1),
    position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++)
    if (position.getX(i) > 0 && position.getY(i) > 0)
      position.setX(i, position.getX(i) - slope);
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
function createSectorGeometry(
  radius: number,
  halfAngle: number,
  segments = 24,
) {
  const vertices = [0, 0, 0],
    indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = -halfAngle + (halfAngle * 2 * i) / segments;
    vertices.push(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius);
  }
  for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function addStrut(
  group: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = end.clone().sub(start),
    strut = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 7),
      material,
    );
  strut.position.copy(start).add(end).multiplyScalar(0.5);
  strut.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  group.add(strut);
  return strut;
}
function createHullNumberTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = "#e8ece5";
  ctx.font = "bold 46px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("9", 64, 34);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function createUSFlagTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 247;
  canvas.height = 130;
  const ctx = canvas.getContext("2d")!;
  for (let stripe = 0; stripe < 13; stripe++) {
    ctx.fillStyle = stripe % 2 === 0 ? "#b22234" : "#f5f4ed";
    ctx.fillRect(0, stripe * 10, 247, 10);
  }
  ctx.fillStyle = "#3c3b6e";
  ctx.fillRect(0, 0, 99, 70);
  ctx.fillStyle = "#fff";
  for (let row = 0; row < 5; row++)
    for (let column = 0; column < 6; column++) {
      ctx.beginPath();
      ctx.arc(
        9 + column * 16 + (row % 2) * 8,
        8 + row * 14,
        1.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function createMk10Launcher(deckMat: THREE.Material, darkMat: THREE.Material) {
  const launcher = new THREE.Group();
  launcher.userData.arms = [];
  const launcherMat = new THREE.MeshStandardMaterial({
      color: 0x929c98,
      metalness: 0.48,
      roughness: 0.48,
    }),
    roundMat = new THREE.MeshStandardMaterial({
      color: 0xd9ddd5,
      metalness: 0.42,
      roughness: 0.34,
    });
  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(2.75, 3.15, 0.55, 20),
    darkMat,
  );
  turntable.position.y = 0.28;
  launcher.add(turntable);
  const race = new THREE.Mesh(
    new THREE.TorusGeometry(2.48, 0.12, 7, 32),
    launcherMat,
  );
  race.rotation.x = Math.PI / 2;
  race.position.y = 0.6;
  launcher.add(race);
  const housing = new THREE.Mesh(
    createSlopedBoxGeometry(4.6, 1.35, 4.35, 0.45),
    launcherMat,
  );
  housing.position.set(-0.25, 1.15, 0);
  launcher.add(housing);
  const rearCab = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 1.2, 3.7),
    darkMat,
  );
  rearCab.position.set(-2, 1.2, 0);
  launcher.add(rearCab);
  const crossShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 4.15, 14),
    darkMat,
  );
  crossShaft.rotation.x = Math.PI / 2;
  crossShaft.position.set(-0.15, 2, 0);
  launcher.add(crossShaft);
  for (const z of [-1.72, 1.72]) {
    const trunnion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.48, 14),
      darkMat,
    );
    trunnion.rotation.x = Math.PI / 2;
    trunnion.position.set(-0.15, 2, z);
    launcher.add(trunnion);
    const arm = new THREE.Group();
    arm.name = "launcherArm";
    arm.position.set(-0.15, 2, z);
    launcher.userData.arms.push(arm);
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(7.7, 0.34, 0.42),
      launcherMat,
    );
    spine.position.set(2.4, 0, 0);
    arm.add(spine);
    for (const railOffset of [-0.23, 0.23]) {
      const guide = new THREE.Mesh(
        new THREE.BoxGeometry(7.4, 0.13, 0.1),
        darkMat,
      );
      guide.position.set(2.5, 0.28, railOffset);
      arm.add(guide);
    }
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.48, 0.75),
      darkMat,
    );
    shoe.position.set(0.3, 0.15, 0);
    arm.add(shoe);
    const readyRound = new THREE.Group();
    readyRound.name = "readyRound";
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 5.5, 10),
      roundMat,
    );
    body.rotation.z = Math.PI / 2;
    readyRound.add(body);
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.72, 10),
      roundMat,
    );
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 3.1;
    readyRound.add(nose);
    for (const finZ of [-1, 1]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.06, 0.42),
        darkMat,
      );
      fin.position.set(-2.45, 0, finZ * 0.3);
      readyRound.add(fin);
    }
    readyRound.position.set(3.15, 0.42, 0);
    arm.add(readyRound);
    launcher.add(arm);
  }
  for (const side of [-1, 1]) {
    const serviceRail = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.12, 0.12),
      deckMat,
    );
    serviceRail.position.set(-0.2, 0.72, side * 2.35);
    launcher.add(serviceRail);
    const loaderGuide = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.16, 0.34),
      darkMat,
    );
    loaderGuide.position.set(-2.65, 0.7, side * 1.72);
    launcher.add(loaderGuide);
    const hydraulic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.15, 2.25, 8),
      launcherMat,
    );
    hydraulic.rotation.z = Math.PI / 2;
    hydraulic.position.set(0.55, 1.45, side * 1.72);
    launcher.add(hydraulic);
  }
  const loaderDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.1, 3.65),
    darkMat,
  );
  loaderDoor.position.set(-3.12, 0.67, 0);
  launcher.add(loaderDoor);
  return launcher;
}
export function buildLongBeach(color = 0x687574, scale = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  const hullMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.16,
    roughness: 0.48,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x707d7c,
    metalness: 0.12,
    roughness: 0.68,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x263538,
    metalness: 0.5,
    roughness: 0.45,
  });
  applySurfaceDetail(hullMat, "painted-metal", 0.32);
  applySurfaceDetail(deckMat, "weather-deck", 0.48);
  applySurfaceDetail(darkMat, "dark-metal", 0.34);
  const hull = new THREE.Mesh(createLoftedHullGeometry(LONG_BEACH_HULL), hullMat);
  g.add(hull);
  const mainDeck = new THREE.Mesh(
    createSheerDeckGeometry(LONG_BEACH_HULL),
    deckMat,
  );
  g.add(mainDeck);
  const waterline = new THREE.Mesh(
    createWaterlineBandGeometry(LONG_BEACH_HULL),
    new THREE.MeshStandardMaterial({ color: 0x151d20, roughness: 0.75 }),
  );
  g.add(waterline);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(24, 0.7, 2.8), darkMat);
  keel.position.set(-1, 0.15, 0);
  g.add(keel);
  const aftDeck = new THREE.Mesh(new THREE.BoxGeometry(13, 0.7, 8), deckMat);
  aftDeck.position.set(-10, 6, 0);
  g.add(aftDeck);
  const bridge = new THREE.Mesh(
    createSlopedBoxGeometry(11, 5.5, 6.5, 1.35),
    deckMat,
  );
  bridge.position.set(5, 8, 0);
  g.add(bridge);
  const bridgeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(13, 0.8, 7.2),
    darkMat,
  );
  bridgeRoof.position.set(5, 11, 0);
  g.add(bridgeRoof);
  const mast = new THREE.Group();
  const mastFeet = [
      new THREE.Vector3(-1.4, 14.1, -2.25),
      new THREE.Vector3(-1.4, 14.1, 2.25),
      new THREE.Vector3(3.2, 14.1, 0),
    ],
    mastCrown = [
      new THREE.Vector3(0.45, 22, -0.62),
      new THREE.Vector3(0.45, 22, 0.62),
      new THREE.Vector3(1.55, 22, 0),
    ];
  mastFeet.forEach((foot, index) =>
    addStrut(mast, foot, mastCrown[index], 0.19, darkMat),
  );
  for (let y = 15.5; y < 21.5; y += 1.65) {
    const fraction = (y - 14.1) / 7.9,
      port = new THREE.Vector3(
        THREE.MathUtils.lerp(-1.4, 0.45, fraction),
        y,
        THREE.MathUtils.lerp(-2.25, -0.62, fraction),
      ),
      starboard = new THREE.Vector3(port.x, y, -port.z);
    addStrut(mast, port, starboard, 0.075, darkMat);
    if (Math.round((y - 15.5) / 1.65) % 2 === 0)
      addStrut(
        mast,
        port,
        new THREE.Vector3(
          THREE.MathUtils.lerp(3.2, 1.55, fraction),
          y + 0.8,
          0,
        ),
        0.07,
        darkMat,
      );
  }
  const mastPlatform = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.6, 0.34, 12),
    darkMat,
  );
  mastPlatform.position.set(1, 22, 0);
  mast.add(mastPlatform);
  const upperMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 7.2, 8),
    darkMat,
  );
  upperMast.position.set(1, 25.5, 0);
  mast.add(upperMast);
  g.add(mast);
  const yard = new THREE.Mesh(new THREE.BoxGeometry(9, 0.24, 0.24), darkMat);
  yard.position.set(1, 27.1, 0);
  g.add(yard);
  const radar = new THREE.Group();
  radar.position.set(1, 24, 0);
  const dish = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 4.3, 0.45),
    new THREE.MeshStandardMaterial({
      color: 0x9caaa6,
      metalness: 0.35,
      roughness: 0.52,
    }),
  );
  dish.rotation.z = 0.08;
  radar.add(dish);
  const backing = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.1, 1.1), darkMat);
  backing.position.z = -0.65;
  radar.add(backing);
  for (let x = -2; x <= 2; x++)
    for (let y = -1; y <= 1; y++) {
      const cell = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.65, 0.12),
        new THREE.MeshStandardMaterial({
          color: 0xc1cbc5,
          metalness: 0.3,
          roughness: 0.5,
        }),
      );
      cell.position.set(x, y * 1.05, 0.3);
      radar.add(cell);
    }
  const feed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 2.8, 8),
    darkMat,
  );
  feed.rotation.x = Math.PI / 2;
  feed.position.z = 1.6;
  radar.add(feed);
  for (const side of [-1, 1]) {
    addStrut(
      radar,
      new THREE.Vector3(side * 2.45, -1.75, -0.35),
      new THREE.Vector3(side * 0.85, -1.1, -1.45),
      0.11,
      darkMat,
    );
    addStrut(
      radar,
      new THREE.Vector3(side * 2.45, 1.75, -0.35),
      new THREE.Vector3(side * 0.85, 1.1, -1.45),
      0.11,
      darkMat,
    );
  }
  const radarGearbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.62, 1.4, 10),
    darkMat,
  );
  radarGearbox.position.set(0, -2.55, -0.45);
  radar.add(radarGearbox);
  const searchBeam = new THREE.Mesh(
    createSectorGeometry(105, THREE.MathUtils.degToRad(8)),
    new THREE.MeshBasicMaterial({
      color: 0x5ee9df,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  searchBeam.position.y = 0.15;
  radar.add(searchBeam);
  radar.userData.searchBeam = searchBeam;
  g.add(radar);
  const fireControl = new THREE.Group();
  fireControl.position.set(8, 12, 0);
  fireControl.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 8),
      new THREE.MeshStandardMaterial({
        color: 0x9ba9a6,
        metalness: 0.5,
        roughness: 0.45,
      }),
    ),
  );
  g.add(fireControl);
  // Keep the aft Mk 10 clear of the aft-house/bridge visual envelope.
  const launcher = createMk10Launcher(deckMat, darkMat);
  launcher.position.set(-23, 6.18, 0);
  launcher.rotation.y = Math.PI;
  g.add(launcher);
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x75d8d4,
    emissive: 0x164b4a,
    emissiveIntensity: 1.8,
  });
  const windows = new THREE.Group();
  for (let z = -2.3; z <= 2.3; z += 1.15) {
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.5, 0.72),
      windowMat,
    );
    pane.position.set(10.58, 9.6, z);
    windows.add(pane);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.72, 0.07),
      darkMat,
    );
    frame.position.set(10.7, 9.6, z + 0.52);
    windows.add(frame);
  }
  for (const side of [-1, 1])
    for (let x = 1.5; x <= 8.5; x += 1.4) {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.5, 0.18),
        windowMat,
      );
      pane.position.set(x, 9.6, side * 3.33);
      windows.add(pane);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.72, 0.22),
        darkMat,
      );
      frame.position.set(x + 0.62, 9.6, side * 3.38);
      windows.add(frame);
    }
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 6.3), darkMat);
  brow.position.set(10.72, 10.08, 0);
  windows.add(brow);
  g.add(windows);
  const upperBridge = new THREE.Mesh(
    createSlopedBoxGeometry(7, 2.4, 5.2, 0.8),
    deckMat,
  );
  upperBridge.position.set(4, 13, 0);
  g.add(upperBridge);
  const bridgeDetails = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.24, 2.25),
      deckMat,
    );
    wing.position.set(6, 12.05, side * 4.15);
    bridgeDetails.add(wing);
    const bulwark = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.62, 0.12),
      darkMat,
    );
    bulwark.position.set(6, 12.4, side * 5.22);
    bridgeDetails.add(bulwark);
    for (let x = 4.1; x <= 7.9; x += 0.95) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.62, 5),
        darkMat,
      );
      post.position.set(x, 12.7, side * 5.18);
      bridgeDetails.add(post);
    }
    addStrut(
      bridgeDetails,
      new THREE.Vector3(4.2, 11.65, side * 3.55),
      new THREE.Vector3(4.2, 12, side * 5),
      0.07,
      darkMat,
    );
    addStrut(
      bridgeDetails,
      new THREE.Vector3(7.8, 11.65, side * 3.55),
      new THREE.Vector3(7.8, 12, side * 5),
      0.07,
      darkMat,
    );
    const pelorus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8),
      darkMat,
    );
    pelorus.position.set(7, 12.45, side * 4.45);
    bridgeDetails.add(pelorus);
  }
  for (const side of [-1, 1])
    for (let x = 1.5; x <= 6.5; x += 1.25) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.55, 0.08),
        darkMat,
      );
      vent.position.set(x, 7.8, side * 3.29);
      bridgeDetails.add(vent);
    }
  g.add(bridgeDetails);
  const aftHouse = new THREE.Mesh(
    createSlopedBoxGeometry(8, 3.2, 6, 0.45),
    deckMat,
  );
  aftHouse.position.set(-7, 8.2, 0);
  g.add(aftHouse);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(
      createSlopedBoxGeometry(5.4, 1.6, 1.25, 0.7),
      deckMat,
    );
    shoulder.position.set(-10.5, 7.2, side * 3.2);
    shoulder.rotation.y = side * 0.04;
    g.add(shoulder);
  }
  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.35, 5, 10),
    darkMat,
  );
  stack.position.set(-4, 12.3, 0);
  g.add(stack);
  const gunMount = new THREE.Group();
  gunMount.position.set(13, 7, -4.55);
  gunMount.rotation.y = -0.08;
  const turret = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.8, 1.25, 10),
    deckMat,
  );
  gunMount.add(turret);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.25, 6, 8),
    darkMat,
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(3, 1, 0);
  gunMount.add(barrel);
  const portGun = gunMount.clone(true);
  portGun.position.z = 4.55;
  portGun.rotation.y = 0.08;
  g.add(gunMount, portGun);
  const aftDirector = new THREE.Group();
  aftDirector.position.set(-7, 12, 0);
  aftDirector.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 12, 8),
      new THREE.MeshStandardMaterial({
        color: 0x9ba9a6,
        metalness: 0.5,
        roughness: 0.45,
      }),
    ),
  );
  g.add(aftDirector);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 42, 6),
      new THREE.MeshStandardMaterial({
        color: 0xa5afaa,
        metalness: 0.5,
        roughness: 0.5,
      }),
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(-1, 7, side * 3.78);
    g.add(rail);
    for (let x = -19; x <= 18; x += 4) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 1.2, 6),
        darkMat,
      );
      post.position.set(x, 6.5, side * 3.78);
      g.add(post);
    }
  }
  for (const side of [-1, 1])
    for (const x of [-5, -1]) {
      const raft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.65 }),
      );
      raft.rotation.x = Math.PI / 2;
      raft.position.set(x, 8.1, side * 3.8);
      g.add(raft);
    }
  for (const x of [-5, 5]) {
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 7, 6),
      darkMat,
    );
    antenna.position.set(x, 17, 0);
    antenna.rotation.z = x < 0 ? -0.18 : 0.18;
    g.add(antenna);
  }
  const navigationLights: THREE.PointLight[] = [],
    lightBulbs: THREE.Mesh[] = [];
  const numberMat = new THREE.MeshBasicMaterial({
    map: createHullNumberTexture(),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const side of [-1, 1]) {
    const number = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), numberMat);
    number.position.set(17.5, 3.7, side * 3.38);
    number.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(number);
    const lampColor = side > 0 ? 0x36ff78 : 0xff3a32,
      nav = new THREE.PointLight(lampColor, 3, 18),
      bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: lampColor }),
      );
    nav.position.set(6, 14, side * 3.7);
    bulb.position.copy(nav.position);
    navigationLights.push(nav);
    lightBulbs.push(bulb);
    g.add(nav, bulb);
    for (const x of [-17, -9, 1, 12]) {
      const port = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 7, 5),
        new THREE.MeshBasicMaterial({ color: 0xffd99a }),
      );
      port.position.set(x, 7.05, side * 3.72);
      lightBulbs.push(port);
      g.add(port);
    }
  }
  for (const [x, y, color] of [
    [1, 29, 0xf4fff1],
    [-7, 24, 0xf4fff1],
    [-27, 8, 0xf4fff1],
  ] as const) {
    const light = new THREE.PointLight(color, 2.2, 22),
      bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshBasicMaterial({ color }),
      );
    light.position.set(x, y, 0);
    bulb.position.copy(light.position);
    navigationLights.push(light);
    lightBulbs.push(bulb);
    g.add(light, bulb);
  }
  for (const side of [-1, 1]) {
    const anchor = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.12, 8, 16),
      darkMat,
    );
    anchor.position.set(21, 3.2, side * 2.86);
    anchor.rotation.x = Math.PI / 2;
    g.add(anchor);
  }
  for (const x of [-15, -10, 10]) {
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.16, 1.4),
      darkMat,
    );
    hatch.position.set(x, 6.3, 0);
    g.add(hatch);
  }
  for (const x of [-14, -8, 0, 8, 14]) {
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.8, 8),
      darkMat,
    );
    bollard.position.set(x, 6.5, 3.56);
    g.add(bollard);
  }
  // The forward Mk 10 stows facing aft; the loading housing remains on the bow side.
  const forwardLauncher = launcher.clone(true);
  forwardLauncher.position.set(23, 6.18, 0);
  forwardLauncher.rotation.y = Math.PI;
  forwardLauncher.scale.setScalar(0.88);
  forwardLauncher.userData.arms = [];
  forwardLauncher.traverse((o) => {
    if (o.name === "launcherArm") forwardLauncher.userData.arms.push(o);
  });
  g.add(forwardLauncher);
  const safetyMat = new THREE.MeshStandardMaterial({
    color: 0xd5b64e,
    metalness: 0.2,
    roughness: 0.65,
  });
  for (const [x, length] of [
    [-17.4, 3.8],
    [17.7, 3.35],
  ] as const) {
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.09, 3.9),
      darkMat,
    );
    hatch.position.set(x, 6.16, 0);
    g.add(hatch);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(length + 0.45, 0.035, 0.09),
        safetyMat,
      );
      stripe.position.set(x, 6.23, side * 2.18);
      g.add(stripe);
    }
    for (const end of [-1, 1]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.035, 4.45),
        safetyMat,
      );
      stripe.position.set(x + (end * (length + 0.45)) / 2, 6.23, 0);
      g.add(stripe);
    }
  }
  const aftMast = new THREE.Group();
  aftMast.position.set(-7, 12, 0);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 12, 7),
      darkMat,
    );
    leg.position.set(0, 5, side * 1.55);
    leg.rotation.x = side * 0.18;
    aftMast.add(leg);
  }
  for (let y = 1; y <= 10; y += 2) {
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 3.2),
      darkMat,
    );
    brace.position.y = y;
    aftMast.add(brace);
  }
  const sps49 = new THREE.Group(),
    antennaMat = new THREE.MeshStandardMaterial({
      color: 0xaab8b3,
      metalness: 0.62,
      roughness: 0.32,
    });
  sps49.position.y = 11;
  const antennaFrame = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.18, 0.18),
    antennaMat,
  );
  sps49.add(antennaFrame);
  for (let x = -4; x <= 4; x += 1) {
    const vertical = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 3, 0.08),
      antennaMat,
    );
    vertical.position.set(x, 0, 0);
    sps49.add(vertical);
  }
  for (const y of [-1.5, 0, 1.5]) {
    const horizontal = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.06, 0.08),
      antennaMat,
    );
    horizontal.position.y = y;
    sps49.add(horizontal);
  }
  const antennaFeed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
    darkMat,
  );
  antennaFeed.rotation.x = Math.PI / 2;
  antennaFeed.position.z = 1.4;
  sps49.add(antennaFeed);
  aftMast.add(sps49);
  g.add(aftMast);
  const directors: THREE.Group[] = [];
  for (const [x, z, heading] of [
    [9, -3.4, -0.38],
    [-8, 3.4, 2.72],
  ] as const) {
    const director = new THREE.Group();
    director.position.set(x, 13, z);
    director.rotation.y = heading;
    director.userData.stowHeading = heading;
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 1.05, 1.4, 12),
      darkMat,
    );
    director.add(pedestal);
    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1.45, 2.15),
      darkMat,
    );
    yoke.position.y = 0.78;
    director.add(yoke);
    const elevationPivot = new THREE.Group();
    elevationPivot.position.set(0, 0.82, 0);
    director.add(elevationPivot);
    const dishBack = new THREE.Mesh(
      new THREE.CylinderGeometry(1.48, 1.22, 0.34, 18),
      darkMat,
    );
    dishBack.rotation.z = Math.PI / 2;
    dishBack.position.x = 0.82;
    elevationPivot.add(dishBack);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
      new THREE.MeshStandardMaterial({
        color: 0xaab7b2,
        metalness: 0.45,
        roughness: 0.38,
        side: THREE.DoubleSide,
      }),
    );
    dish.rotation.z = -Math.PI / 2;
    dish.position.x = 1.05;
    elevationPivot.add(dish);
    const horn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.16, 1.9, 8),
      darkMat,
    );
    horn.rotation.z = Math.PI / 2;
    horn.position.x = 2;
    elevationPivot.add(horn);
    const feedTip = new THREE.Object3D();
    feedTip.position.x = 3;
    elevationPivot.add(feedTip);
    director.userData.elevationPivot = elevationPivot;
    director.userData.feedTip = feedTip;
    directors.push(director);
    g.add(director);
  }
  const highDetail = new THREE.Group();
  for (const [x, z] of [
    [-1, -3.7],
    [-1, 3.7],
    [6, -3.7],
    [6, 3.7],
  ] as const) {
    const canister = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.85, 1.05),
      new THREE.MeshStandardMaterial({
        color: 0x6d7774,
        metalness: 0.52,
        roughness: 0.48,
      }),
    );
    canister.position.set(x, 7.15, z);
    canister.rotation.y = z > 0 ? 0.12 : -0.12;
    highDetail.add(canister);
  }
  for (const [x, z] of [
    [-10, -4.1],
    [-10, 4.1],
  ] as const) {
    const boat = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.62, 3.4, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0xc4c1ac, roughness: 0.68 }),
    );
    boat.rotation.z = Math.PI / 2;
    boat.position.set(x, 9, z);
    highDetail.add(boat);
  }
  for (const [x, z] of [
    [-14, 0],
    [13, 0],
  ] as const) {
    const ciws = new THREE.Group();
    ciws.position.set(x, 7.4, z);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.05, 0.8, 12),
      deckMat,
    );
    ciws.add(base);
    const turret = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.2, 1),
      new THREE.MeshStandardMaterial({
        color: 0xd2d7cf,
        metalness: 0.35,
        roughness: 0.48,
      }),
    );
    turret.position.y = 1;
    ciws.add(turret);
    const elevationPivot = new THREE.Group();
    elevationPivot.position.set(0, 1.18, 0);
    for (let barrelIndex = -1; barrelIndex <= 1; barrelIndex++) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 2.4, 6),
        darkMat,
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(1.45, 0, barrelIndex * 0.13);
      elevationPivot.add(barrel);
    }
    const radome = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 7),
      new THREE.MeshStandardMaterial({ color: 0xe0e3dc, roughness: 0.4 }),
    );
    radome.position.set(-0.2, 0.6, 0);
    ciws.add(radome);
    ciws.add(elevationPivot);
    ciws.userData.elevationPivot = elevationPivot;
    highDetail.add(ciws);
  }
  for (const side of [-1, 1])
    for (let x = -20; x <= 22; x += 3) {
      const stanchion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.7, 5),
        darkMat,
      );
      stanchion.position.set(x, 6.75, side * 3.82);
      highDetail.add(stanchion);
    }
  const breakwater = new THREE.Mesh(
    createSlopedBoxGeometry(0.7, 1.2, 7.2, 0.18),
    darkMat,
  );
  breakwater.position.set(18.5, 6.75, 0);
  breakwater.rotation.z = -0.18;
  highDetail.add(breakwater);
  for (const side of [-1, 1])
    for (const x of [-18, -11, 2, 11]) {
      const reel = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.1, 7, 14),
        darkMat,
      );
      reel.rotation.y = Math.PI / 2;
      reel.position.set(x, 6.65, side * 2.8);
      highDetail.add(reel);
    }
  for (const x of [-16, -6, 4, 14]) {
    const vent = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.3, 0.6, 8),
      darkMat,
    );
    vent.position.set(x, 6.55, -2.4);
    highDetail.add(vent);
  }
  const smokePuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 7, 5),
      new THREE.MeshBasicMaterial({
        color: 0x526064,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    smokePuffs.push(puff);
    highDetail.add(puff);
  }
  g.add(highDetail);
  const srbocLaunchers = new THREE.Group();
  for (const side of [-1, 1]) {
    const station = new THREE.Group();
    station.position.set(0, 7.25, side * 3.72);
    station.rotation.x = side * 0.42;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.25), darkMat);
    station.add(base);
    for (let row = 0; row < 2; row++)
      for (let column = 0; column < 3; column++) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.19, 1.8, 8),
          new THREE.MeshStandardMaterial({
            color: 0x687473,
            metalness: 0.62,
            roughness: 0.4,
          }),
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0.35, row * 0.42 - 0.2, column * 0.38 - 0.38);
        station.add(tube);
      }
    srbocLaunchers.add(station);
  }
  highDetail.add(srbocLaunchers);
  const ewPulse = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(12 + i * 8, 0.08, 6, 72),
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
  for (const side of [-1, 1]) {
    const ewAntenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.18, 2.8, 8),
      darkMat,
    );
    ewAntenna.position.set(2.5, 16.2, side * 3.25);
    ewAntenna.rotation.x = side * 0.28;
    g.add(ewAntenna);
  }
  ewPulse.visible = false;
  g.add(ewPulse);
  highDetail.children
    .filter(
      (o) =>
        Math.abs(o.position.y - 7.4) < 0.01 && Math.abs(o.position.z) < 0.01,
    )
    .forEach((o) => {
      o.name = o.position.x > 0 ? "ciwsFore" : "ciwsAft";
      o.rotation.y = o.position.x > 0 ? 0 : Math.PI;
    });
  const flagGeometry = new THREE.PlaneGeometry(3.8, 2, 12, 4);
  flagGeometry.translate(-1.9, 0, 0);
  const flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({
      map: createUSFlagTexture(),
      side: THREE.DoubleSide,
      roughness: 0.72,
    }),
  );
  flag.position.set(-7, 22, 0);
  highDetail.add(flag);
  for (const x of [-21, 21]) {
    const safetyRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.55, 0.055, 5, 64),
      new THREE.MeshBasicMaterial({
        color: 0xe1c46d,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    safetyRing.rotation.x = Math.PI / 2;
    safetyRing.position.set(x, 6.24, 0);
    highDetail.add(safetyRing);
  }
  const mediumDetail = new THREE.Group();
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(42, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x81908d }),
    );
    rail.position.set(-1, 6.9, side * 3.82);
    mediumDetail.add(rail);
  }
  for (const x of [-18, -8, 3, 14]) {
    const deckBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.45, 1.1),
      darkMat,
    );
    deckBox.position.set(x, 6.45, 2.7);
    mediumDetail.add(deckBox);
  }
  g.add(mediumDetail);
  const lowDetail = new THREE.Group();
  const lowMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.5, 15, 6),
    darkMat,
  );
  lowMast.position.set(0, 18, 0);
  const lowArray = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 3.6, 0.28),
    new THREE.MeshBasicMaterial({ color: 0x82928f }),
  );
  lowArray.position.set(0, 25, 0);
  const lowStack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.2, 5, 7),
    darkMat,
  );
  lowStack.position.set(-4, 12, 0);
  lowDetail.add(lowMast, lowArray, lowStack);
  lowDetail.visible = false;
  g.add(lowDetail);
  g.userData = {
    hullStations: LONG_BEACH_HULL.length,
    hullSectionPoints: 8,
    radar,
    secondaryRadar: sps49,
    fireControl,
    launcher,
    forwardLauncher,
    directors,
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
      mast,
      radar,
      fireControl,
      launcher,
      forwardLauncher,
      windows,
      aftMast,
      gunMount,
      portGun,
      aftDirector,
      ...directors,
    ],
  };
  return g;
}
