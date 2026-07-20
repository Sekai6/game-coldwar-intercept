import * as THREE from "three";

export type SurfaceFinish =
  | "painted-metal"
  | "dark-metal"
  | "weather-deck"
  | "missile-skin";

interface FinishSettings {
  seed: number;
  grain: number;
  seam: number;
  normalStrength: number;
}

const settings: Record<SurfaceFinish, FinishSettings> = {
  "painted-metal": { seed: 11, grain: 0.13, seam: 0.12, normalStrength: 1.8 },
  "dark-metal": { seed: 23, grain: 0.18, seam: 0.08, normalStrength: 2.2 },
  "weather-deck": { seed: 37, grain: 0.22, seam: 0.2, normalStrength: 2.8 },
  "missile-skin": { seed: 53, grain: 0.1, seam: 0.07, normalStrength: 1.35 },
};

const mapCache = new Map<
  SurfaceFinish,
  { roughnessMap: THREE.DataTexture; normalMap: THREE.DataTexture }
>();

function hash(x: number, y: number, seed: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 17.17) * 43758.5453;
  return value - Math.floor(value);
}

function heightAt(x: number, y: number, finish: FinishSettings, size: number) {
  const wrappedX = (x + size) % size,
    wrappedY = (y + size) % size,
    fine = hash(wrappedX, wrappedY, finish.seed),
    broad = hash(Math.floor(wrappedX / 4), Math.floor(wrappedY / 4), finish.seed + 7),
    seamX = wrappedX % 16 === 0 ? -finish.seam : 0,
    seamY = wrappedY % 24 === 0 ? -finish.seam * 0.7 : 0;
  return (fine - 0.5) * finish.grain + (broad - 0.5) * finish.grain * 0.7 + seamX + seamY;
}

function buildMaps(finishName: SurfaceFinish) {
  const finish = settings[finishName],
    size = 64,
    roughness = new Uint8Array(size * size * 4),
    normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4,
        height = heightAt(x, y, finish, size),
        dx =
          (heightAt(x + 1, y, finish, size) -
            heightAt(x - 1, y, finish, size)) *
          finish.normalStrength,
        dy =
          (heightAt(x, y + 1, finish, size) -
            heightAt(x, y - 1, finish, size)) *
          finish.normalStrength,
        vector = new THREE.Vector3(-dx, -dy, 1).normalize(),
        roughnessValue = THREE.MathUtils.clamp(
          0.72 + height * 1.35 + (finishName === "weather-deck" ? 0.12 : 0),
          0.28,
          1,
        );
      roughness[offset] = roughness[offset + 1] = roughness[offset + 2] =
        Math.round(roughnessValue * 255);
      roughness[offset + 3] = 255;
      normal[offset] = Math.round((vector.x * 0.5 + 0.5) * 255);
      normal[offset + 1] = Math.round((vector.y * 0.5 + 0.5) * 255);
      normal[offset + 2] = Math.round((vector.z * 0.5 + 0.5) * 255);
      normal[offset + 3] = 255;
    }
  }
  const roughnessMap = new THREE.DataTexture(
      roughness,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    ),
    normalMap = new THREE.DataTexture(
      normal,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
  for (const texture of [roughnessMap, normalMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
  }
  roughnessMap.name = `${finishName}-roughness`;
  normalMap.name = `${finishName}-normal`;
  return { roughnessMap, normalMap };
}

export function applySurfaceDetail(
  material: THREE.MeshStandardMaterial,
  finish: SurfaceFinish,
  normalScale = 0.3,
) {
  let maps = mapCache.get(finish);
  if (!maps) {
    maps = buildMaps(finish);
    mapCache.set(finish, maps);
  }
  material.roughnessMap = maps.roughnessMap;
  material.normalMap = maps.normalMap;
  material.normalScale.setScalar(normalScale);
  material.needsUpdate = true;
  return material;
}
