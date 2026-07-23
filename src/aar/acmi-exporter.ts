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
  pitch?: number;
  roll?: number;
  speed?: number;
  verticalSpeed?: number;
  health?: number;
  state?: string;
  disabled?: boolean;
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
  const pitch = ((object.pitch ?? 0) * 180) / Math.PI;
  const roll = ((object.roll ?? 0) * 180) / Math.PI;
  return `${lon.toFixed(7)}|${lat.toFixed(7)}|${altitude.toFixed(1)}|${roll.toFixed(2)}|${pitch.toFixed(2)}|${heading.toFixed(2)}`;
}

function frameObjects(snapshot: AarSnapshot, blueShipName: string): AcmiObject[] {
  const objects: AcmiObject[] = [
    {
      key: "ship:blue",
      name: blueShipName,
      type: "Sea+Warship",
      coalition: "Blue",
      health: snapshot.ship.hull,
      state: "surface-combatant",
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
      pitch: snapshot.enemyPlatform.pitch,
      roll: snapshot.enemyPlatform.roll,
      speed: snapshot.enemyPlatform.speed,
      verticalSpeed: snapshot.enemyPlatform.verticalSpeed,
      health: snapshot.enemyPlatform.hull,
      state: snapshot.enemyPlatform.destroyed ? "destroyed" : "operational",
      disabled: snapshot.enemyPlatform.destroyed,
    });
  for (const item of snapshot.missiles)
    objects.push({ key: `threat:${item.id}`, name: item.threatType, type: "Weapon+Missile", coalition: "Red", state: item.phase, parent: item.parentId, ...item });
  for (const item of snapshot.interceptors)
    objects.push({ key: `sam:${item.id}`, name: item.weapon, type: "Weapon+Missile", coalition: "Blue", target: item.targetId, parent: "blue-surface-ship", state: "engaged", ...item });
  for (const item of snapshot.surfaceStrikes)
    objects.push({ key: `surface:${item.id}`, name: "RGM-84 Harpoon", type: "Weapon+Missile", coalition: "Blue", target: item.targetId ?? "red-surface-ship", parent: "blue-surface-ship", state: item.phase, ...item });
  for (const item of snapshot.aircraft)
    objects.push({ key: `aircraft:${item.id}`, type: "Air+FixedWing", coalition: item.side === "blue" ? "Blue" : "Red", health: item.structure, disabled: !item.alive, ...item, state: `${item.mission}/${item.state}` });
  for (const item of snapshot.airWeapons)
    objects.push({ key: `airweapon:${item.id}`, type: "Weapon+Missile", coalition: item.side === "blue" ? "Blue" : "Red", target: item.targetId, parent: item.shooterId, ...item, state: item.phase });
  for (const item of snapshot.chaff)
    objects.push({ key: `chaff:${item.id}`, name: "Chaff", type: "Misc+Decoy", coalition: item.side === "platform" || item.side === "threat" ? "Red" : "Blue", ...item });
  for (const item of snapshot.airDecoys)
    objects.push({ key: `airdecoy:${item.id}`, name: item.type, coalition: item.side === "blue" ? "Blue" : "Red", ...item, type: "Misc+Decoy", state: item.alive ? "active" : "expired" });
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
  const aliases = new Map<string, string>([
    ["blue-surface-ship", "ship:blue"],
    ["red-surface-ship", "ship:red"],
  ]);
  for (const snapshot of snapshots) {
    for (const aircraft of snapshot.aircraft)
      aliases.set(aircraft.id, `aircraft:${aircraft.id}`);
    for (const weapon of snapshot.airWeapons)
      aliases.set(weapon.id, `airweapon:${weapon.id}`);
    for (const missile of snapshot.missiles)
      aliases.set(String(missile.id), `threat:${missile.id}`);
  }
  let nextId = 100;
  const idFor = (key: string) => {
    if (!ids.has(key)) ids.set(key, nextId++);
    return ids.get(key)!;
  };
  const referenceKey = (reference: string | number): string | undefined => {
    const value = String(reference);
    if (aliases.has(value)) return aliases.get(value);
    if (value === "ship:blue" || value === "ship:red") return value;
    if (value.startsWith("air-weapon-")) return `airweapon:${value}`;
    if (value.startsWith("airweapon:")) return value;
    if (value.startsWith("aircraft:")) return value;
    if (/^(blue|red)-/.test(value)) return `aircraft:${value}`;
    if (/^\d+$/.test(value)) return `threat:${value}`;
    return undefined;
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
    for (const key of previous)
      if (!current.has(key)) {
        lines.push(`0,Event=Destroyed|${idFor(key)}`);
        lines.push(`-${idFor(key)}`);
      }
    for (const object of objects) {
      const id = idFor(object.key);
      const properties = [`T=${coordinates(object, latitude, longitude)}`];
      if (object.speed !== undefined) properties.push(`Speed=${object.speed.toFixed(2)}`);
      if (object.verticalSpeed !== undefined)
        properties.push(`VerticalSpeed=${object.verticalSpeed.toFixed(2)}`);
      if (object.health !== undefined)
        properties.push(`Health=${Math.max(0, object.health).toFixed(1)}`);
      if (object.state) properties.push(`State=${clean(object.state)}`);
      if (object.disabled !== undefined)
        properties.push(`Disabled=${object.disabled ? 1 : 0}`);
      if (!previous.has(object.key)) {
        properties.push(`Type=${object.type}`, `Name=${clean(object.name)}`, `Coalition=${object.coalition}`);
        const targetKey = object.target === undefined ? undefined : referenceKey(object.target);
        const parentKey = object.parent === undefined ? undefined : referenceKey(object.parent);
        if (targetKey) properties.push(`Target=${idFor(targetKey)}`);
        if (parentKey) properties.push(`Parent=${idFor(parentKey)}`);
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
