import * as THREE from "three";
import { AIR_PLATFORM_BY_ID } from "./catalog";
import type { AirMissionOrder, AirPlatformId, AirSpawn } from "./types";

function pair(input: {
  platformId: AirPlatformId;
  side: "blue" | "red";
  formationId: string;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  wingmanMission?: AirMissionOrder;
  protectedFormationId?: string;
}): AirSpawn[] {
  const definition = AIR_PLATFORM_BY_ID[input.platformId];
  return [0, 1].map((formationIndex) => ({
    definition,
    side: input.side,
    formationId: input.formationId,
    position: input.position.clone().add(
      new THREE.Vector3(
        (formationIndex ? 1 : -1) * 12,
        formationIndex * 2,
        formationIndex ? 9 : -4,
      ),
    ),
    heading: input.heading.clone(),
    formationIndex,
    mission: formationIndex === 1 ? input.wingmanMission : undefined,
    protectedFormationId:
      formationIndex === 1 ? input.protectedFormationId : undefined,
  }));
}

export function jointAirScenarioSpawns(): AirSpawn[] {
  return [
    ...pair({
      platformId: "F-14A",
      side: "blue",
      formationId: "CAP-1",
      position: new THREE.Vector3(-170, 72, -220),
      heading: new THREE.Vector3(1, 0, -0.12),
      wingmanMission: "escort",
      protectedFormationId: "STRIKE-1",
    }),
    ...pair({
      platformId: "TU-16K",
      side: "red",
      formationId: "RAID-1",
      position: new THREE.Vector3(80, 92, -250),
      heading: new THREE.Vector3(-0.15, -0.01, 1),
    }),
    ...pair({
      platformId: "A-6E",
      side: "blue",
      formationId: "STRIKE-1",
      position: new THREE.Vector3(-60, 18, -220),
      heading: new THREE.Vector3(0.15, 0, -1),
    }),
  ];
}
