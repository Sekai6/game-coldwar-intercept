import type {
  AirGuidance,
  AirMissileInstance,
  AirPlatformInstance,
  AirTrack,
  AirWeaponDefinition,
  AirWeaponId,
} from "./types";

const usesDatalink = (guidance: AirGuidance) =>
  guidance === "active-radar" || guidance === "anti-ship-radar";

export function calculateFireControlUsage(input: {
  liveWeapons: readonly { guidance: AirGuidance; seekerAcquired: boolean }[];
  pendingWeapons: readonly { guidance: AirGuidance }[];
}) {
  return {
    datalink:
      input.liveWeapons.filter(
        (weapon) => usesDatalink(weapon.guidance) && !weapon.seekerAcquired,
      ).length + input.pendingWeapons.filter((weapon) => usesDatalink(weapon.guidance)).length,
    illumination:
      input.liveWeapons.filter((weapon) => weapon.guidance === "semi-active-radar").length +
      input.pendingWeapons.filter((weapon) => weapon.guidance === "semi-active-radar").length,
  };
}

export function fireControlAvailable(input: {
  aircraft: AirPlatformInstance;
  missiles: readonly AirMissileInstance[];
  weapon: AirWeaponDefinition;
  weaponCatalog: Readonly<Record<AirWeaponId, AirWeaponDefinition>>;
}) {
  const liveWeapons = input.missiles
    .filter((missile) => missile.alive && missile.shooterId === input.aircraft.id)
    .map((missile) => ({ guidance: missile.definition.guidance, seekerAcquired: missile.seekerAcquired }));
  const pendingWeapons = input.aircraft.hardpoints
    .filter((hardpoint) => hardpoint.state === "reserved" || hardpoint.state === "releasing")
    .flatMap((hardpoint) =>
      hardpoint.weaponId ? [{ guidance: input.weaponCatalog[hardpoint.weaponId].guidance }] : [],
    );
  const usage = calculateFireControlUsage({ liveWeapons, pendingWeapons });
  if (input.weapon.guidance === "semi-active-radar")
    return usage.illumination < input.aircraft.definition.fireControlChannels.illumination;
  if (usesDatalink(input.weapon.guidance))
    return usage.datalink < input.aircraft.definition.fireControlChannels.datalink;
  return true;
}

export function chooseAirWeapon(input: {
  aircraft: AirPlatformInstance;
  missiles: readonly AirMissileInstance[];
  classification: AirTrack["classification"];
  range: number;
  weaponCatalog: Readonly<Record<AirWeaponId, AirWeaponDefinition>>;
}) {
  if (input.classification === "unknown") return undefined;
  return ([...input.aircraft.ammo] as [AirWeaponId, number][])
    .filter(([, count]) => count > 0)
    .map(([id]) => input.weaponCatalog[id])
    .filter(
      (weapon) =>
        weapon.targets.includes(input.classification as "aircraft" | "ship") &&
        input.range >= weapon.minRange &&
        input.range <= weapon.maxRange &&
        fireControlAvailable({ ...input, weapon }) &&
        input.aircraft.hardpoints.some(
          (hardpoint) => hardpoint.state === "ready" && hardpoint.weaponId === weapon.id,
        ),
    )
    .sort((left, right) => right.maxRange - left.maxRange)[0];
}
