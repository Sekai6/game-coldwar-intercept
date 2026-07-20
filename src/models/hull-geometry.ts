import * as THREE from "three";

export type HullStation = {
  x: number;
  deckHalf: number;
  shoulderHalf: number;
  waterlineHalf: number;
  keelHalf: number;
  deckY: number;
  shoulderY: number;
  waterlineY: number;
  keelY: number;
};

function stationRing(station: HullStation) {
  return [
    [station.deckY, -station.deckHalf],
    [station.shoulderY, -station.shoulderHalf],
    [station.waterlineY, -station.waterlineHalf],
    [station.keelY, -station.keelHalf],
    [station.keelY, station.keelHalf],
    [station.waterlineY, station.waterlineHalf],
    [station.shoulderY, station.shoulderHalf],
    [station.deckY, station.deckHalf],
  ] as const;
}

export function createLoftedHullGeometry(stations: readonly HullStation[]) {
  const ringSize = 8;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const station of stations)
    for (const [y, z] of stationRing(station)) vertices.push(station.x, y, z);

  for (let station = 0; station < stations.length - 1; station++) {
    const current = station * ringSize;
    const next = current + ringSize;
    for (let side = 0; side < ringSize - 1; side++) {
      const a = current + side;
      const b = next + side;
      const c = next + side + 1;
      const d = current + side + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  for (let point = 1; point < ringSize - 1; point++)
    indices.push(0, point + 1, point);
  const bow = (stations.length - 1) * ringSize;
  for (let point = 1; point < ringSize - 1; point++)
    indices.push(bow, bow + point, bow + point + 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSheerDeckGeometry(stations: readonly HullStation[]) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const station of stations)
    vertices.push(
      station.x,
      station.deckY + 0.03,
      -station.deckHalf,
      station.x,
      station.deckY + 0.035,
      0,
      station.x,
      station.deckY + 0.03,
      station.deckHalf,
    );
  for (let station = 0; station < stations.length - 1; station++) {
    const a = station * 3;
    const b = a + 3;
    indices.push(a, b, b + 1, a, b + 1, a + 1);
    indices.push(a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function halfWidthAt(station: HullStation, y: number) {
  if (y >= station.shoulderY) {
    const t = THREE.MathUtils.inverseLerp(
      station.shoulderY,
      station.deckY,
      y,
    );
    return THREE.MathUtils.lerp(station.shoulderHalf, station.deckHalf, t);
  }
  if (y >= station.waterlineY) {
    const t = THREE.MathUtils.inverseLerp(
      station.waterlineY,
      station.shoulderY,
      y,
    );
    return THREE.MathUtils.lerp(
      station.waterlineHalf,
      station.shoulderHalf,
      t,
    );
  }
  const t = THREE.MathUtils.inverseLerp(station.keelY, station.waterlineY, y);
  return THREE.MathUtils.lerp(station.keelHalf, station.waterlineHalf, t);
}

export function createWaterlineBandGeometry(
  stations: readonly HullStation[],
  lowerY = 0.16,
  upperY = 0.62,
) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const station of stations) {
    const low = halfWidthAt(station, lowerY) + 0.025;
    const high = halfWidthAt(station, upperY) + 0.025;
    vertices.push(
      station.x,
      lowerY,
      -low,
      station.x,
      upperY,
      -high,
      station.x,
      lowerY,
      low,
      station.x,
      upperY,
      high,
    );
  }
  for (let station = 0; station < stations.length - 1; station++) {
    const a = station * 4;
    const b = a + 4;
    indices.push(a, b, b + 1, a, b + 1, a + 1);
    indices.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
