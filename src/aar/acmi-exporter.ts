import type { AarEvent, AarSnapshot } from "../combat-types";

export type AcmiExportOptions = {
  title: string;
  referenceTime: Date;
  referenceLatitude?: number;
  referenceLongitude?: number;
  blueShipName: string;
};

type AcmiObject = {
  key: string;
  name: string;
  type: string;
  coalition: "Blue" | "Red" | "Neutral";
  x: number;
  y: number;
  z: number;
  heading?: number;
  parent?: string;
  target?: string | number;
};

const WORLD_METERS = 100;
const ALTITUDE_METERS = 50;

function clean(value: string): string {
  return value.replace(/[\r\n,=]/g, " ").trim();
}

function coordinates(
  object: AcmiObject,
  latitude: number,
  longitude: number,
): string {
  const north = -object.z * WORLD_METERS;
  const east = object.x * WORLD_METERS;
  const lat = latitude + north / 111_320;
  const lon = longitude + east / (111_320 * Math.cos((latitude * Math.PI) / 180));
  const altitude = Math.max(0, object.y * ALTITUDE_METERS);
  const heading = (((object.heading ?? 0) * 180) / Math.PI + 360) % 360;
  return `${lon.toFixed(7)}|${lat.toFixed(7)}|${altitude.toFixed(1)}|0|0|${heading.toFixed(2)}`;
}

function frameObjects(snapshot: AarSnapshot, blueShipName: string): AcmiObject[] {
  const objects: AcmiObject[] = [
    {
      key: "ship:blue",
      name: blueShipName,
      type: "Sea+Warship",
      coalition: "Blue",
      ...snapshot.ship,
    },
  ];
  if (snapshot.enemyPlatform)
    objects.push({
      key: "ship:red",
      name: snapshot.enemyPlatform.name,
      type: "Sea+Warship",
      coalition: "Red",
      x: snapshot.enemyPlatform.x,
      y: snapshot.enemyPlatform.y,
      z: snapshot.enemyPlatform.z,
      heading: snapshot.enemyPlatform.heading,
    });
  for (const item of snapshot.missiles)
    objects.push({ key: `threat:${item.id}`, name: item.threatType, type: "Weapon+Missile", coalition: "Red", ...item });
  for (const item of snapshot.interceptors)
    objects.push({ key: `sam:${item.id}`, name: item.weapon, type: "Weapon+Missile", coalition: "Blue", target: item.targetId, ...item });
  for (const item of snapshot.surfaceStrikes)
    objects.push({ key: `surface:${item.id}`, name: "RGM-84 Harpoon", type: "Weapon+Missile", coalition: "Blue", target: "ship:red", ...item });
  for (const item of snapshot.aircraft)
    objects.push({ key: `aircraft:${item.id}`, name: item.name, type: "Air+FixedWing", coalition: item.side === "blue" ? "Blue" : "Red", x: item.x, y: item.y, z: item.z, heading: item.heading });
  for (const item of snapshot.airWeapons)
    objects.push({ key: `airweapon:${item.id}`, name: item.name, type: "Weapon+Missile", coalition: item.side === "blue" ? "Blue" : "Red", target: item.targetId, x: item.x, y: item.y, z: item.z, heading: item.heading });
  for (const item of snapshot.chaff)
    objects.push({ key: `chaff:${item.id}`, name: "Chaff", type: "Misc+Decoy", coalition: item.side === "platform" || item.side === "threat" ? "Red" : "Blue", ...item });
  for (const item of snapshot.airDecoys)
    objects.push({ key: `airdecoy:${item.id}`, name: item.type, type: "Misc+Decoy", coalition: "Neutral", x: item.x, y: item.y, z: item.z });
  return objects;
}

export function exportTacviewAcmi(
  snapshots: readonly AarSnapshot[],
  events: readonly AarEvent[],
  options: AcmiExportOptions,
): string {
  const latitude = options.referenceLatitude ?? 31.2;
  const longitude = options.referenceLongitude ?? 121.5;
  const ids = new Map<string, number>();
  let nextId = 100;
  const idFor = (key: string) => {
    if (!ids.has(key)) ids.set(key, nextId++);
    return ids.get(key)!;
  };
  const lines = [
    "FileType=text/acmi/tacview",
    "FileVersion=2.2",
    `0,ReferenceTime=${options.referenceTime.toISOString()}`,
    `0,Title=${clean(options.title)}`,
    `0,ReferenceLatitude=${latitude.toFixed(7)}`,
    `0,ReferenceLongitude=${longitude.toFixed(7)}`,
  ];
  let previous = new Set<string>();
  let eventIndex = 0;
  for (const snapshot of snapshots) {
    lines.push(`#${snapshot.time.toFixed(2)}`);
    const objects = frameObjects(snapshot, options.blueShipName);
    const current = new Set(objects.map((object) => object.key));
    for (const key of previous) if (!current.has(key)) lines.push(`-${idFor(key)}`);
    for (const object of objects) {
      const id = idFor(object.key);
      const properties = [`T=${coordinates(object, latitude, longitude)}`];
      if (!previous.has(object.key)) {
        properties.push(`Type=${object.type}`, `Name=${clean(object.name)}`, `Coalition=${object.coalition}`);
        if (object.target !== undefined) properties.push(`Target=${clean(String(object.target))}`);
      }
      lines.push(`${id},${properties.join(",")}`);
    }
    while (eventIndex < events.length && events[eventIndex].time <= snapshot.time + 0.001) {
      lines.push(`0,Event=Message|${clean(events[eventIndex].text)}`);
      eventIndex++;
    }
    previous = current;
  }
  for (const key of previous) lines.push(`-${idFor(key)}`);
  return `${lines.join("\n")}\n`;
}
