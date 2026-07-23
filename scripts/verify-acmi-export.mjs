import { exportTacviewAcmi } from "../dist-test/aar/acmi-exporter.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const base = {
  ship: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, speed: 5, verticalSpeed: 0, hull: 100 },
  missiles: [],
  interceptors: [],
  chaff: [],
  enemyPlatform: null,
  surfaceStrikes: [],
  aircraft: [],
  airWeapons: [],
  airDecoys: [],
};
const snapshots = [
  {
    ...base,
    time: 0,
    aircraft: [
      {
        id: "fighter-1",
        name: "F-14A Tomcat",
        side: "blue",
        x: 10,
        y: 20,
        z: -10,
        heading: Math.PI / 2,
        pitch: 0.1,
        roll: -0.2,
        speed: 250,
        verticalSpeed: 12,
        state: "engaging",
        mission: "cap",
        alive: true,
        structure: 100,
      },
      {
        id: "bomber-1",
        name: "Tu-16K Badger-G",
        side: "red",
        x: 50,
        y: 18,
        z: -50,
        heading: -Math.PI / 2,
        pitch: 0,
        roll: 0,
        speed: 210,
        verticalSpeed: 0,
        state: "defending",
        mission: "anti-ship",
        alive: true,
        structure: 82,
      },
    ],
    airWeapons: [
      {
        id: "weapon-1",
        name: "AIM-54A Phoenix",
        side: "blue",
        x: 12,
        y: 18,
        z: -12,
        heading: Math.PI / 2,
        pitch: 0.05,
        roll: 0.1,
        speed: 600,
        verticalSpeed: 20,
        phase: "boost",
        targetId: "bomber-1",
        shooterId: "fighter-1",
      },
    ],
    missiles: [
      {
        id: 7,
        threatType: "P-500",
        phase: "inbound",
        x: 30,
        y: 1.2,
        z: -30,
        heading: Math.PI,
        pitch: 0,
        roll: 0,
        speed: 880,
        verticalSpeed: 0,
      },
    ],
  },
  {
    ...base,
    time: 0.25,
    aircraft: [
      {
        id: "fighter-1",
        name: "F-14A Tomcat",
        side: "blue",
        x: 11,
        y: 21,
        z: -11,
        heading: Math.PI / 2,
        pitch: 0.1,
        roll: -0.2,
        speed: 255,
        verticalSpeed: 10,
        state: "engaging",
        mission: "cap",
        alive: true,
        structure: 100,
      },
      {
        id: "bomber-1",
        name: "Tu-16K Badger-G",
        side: "red",
        x: 49,
        y: 18,
        z: -49,
        heading: -Math.PI / 2,
        pitch: 0,
        roll: 0.1,
        speed: 208,
        verticalSpeed: 0,
        state: "defending",
        mission: "anti-ship",
        alive: true,
        structure: 82,
      },
    ],
    missiles: [
      {
        id: 7,
        threatType: "P-500",
        phase: "destroyed",
        x: 29,
        y: 1.2,
        z: -29,
        heading: Math.PI,
        pitch: 0,
        roll: 0,
        speed: 0,
        verticalSpeed: 0,
      },
    ],
  },
  {
    ...base,
    time: 0.5,
    missiles: [
      {
        id: 7,
        threatType: "P-500",
        phase: "destroyed",
        x: 29,
        y: 1.2,
        z: -29,
        heading: Math.PI,
        pitch: 0,
        roll: 0,
        speed: 0,
        verticalSpeed: 0,
      },
    ],
  },
];
const acmi = exportTacviewAcmi(
  snapshots,
  [{ time: 0.25, category: "fire", text: "AIM-54A LAUNCH" }],
  {
    title: "Test Engagement",
    referenceTime: new Date("2026-07-23T00:00:00.000Z"),
    referenceLatitude: 31.2,
    referenceLongitude: 121.5,
    blueShipName: "CGN-9 Long Beach",
  },
);
assert(acmi.startsWith("FileType=text/acmi/tacview\nFileVersion=2.2"), "invalid ACMI header");
assert(acmi.includes("0,ReferenceTime=2026-07-23T00:00:00.000Z"), "reference time missing");
assert(acmi.includes("Name=F-14A Tomcat,Coalition=Blue"), "aircraft identity missing");
const fighterLine = acmi.split("\n").find((line) => line.includes("Name=F-14A Tomcat"));
const bomberLine = acmi.split("\n").find((line) => line.includes("Name=Tu-16K Badger-G"));
const weaponLine = acmi.split("\n").find((line) => line.includes("Name=AIM-54A Phoenix"));
const fighterId = fighterLine?.split(",")[0];
const bomberId = bomberLine?.split(",")[0];
assert(
  weaponLine?.includes(`Target=${bomberId}`) &&
    weaponLine.includes(`Parent=${fighterId}`) &&
    !weaponLine.includes("Target=bomber-1"),
  "weapon references were not converted to Tacview object IDs",
);
assert(acmi.includes("|1000.0|-11.46|5.73|90.00"), "attitude conversion failed");
assert(acmi.includes("Speed=250.00,VerticalSpeed=12.00,Health=100.0,State=cap/engaging"), "extended aircraft telemetry missing");
assert(acmi.includes("#0.25"), "second frame missing");
assert(/#0\.25[\s\S]*-\d+/.test(acmi), "removed weapon was not deleted");
assert(/0,Event=Destroyed\|\d+/.test(acmi), "structured destruction event missing");
assert(/0,Event=HasFired\|\d+\|\d+/.test(acmi), "structured firing event missing");
assert(
  acmi.indexOf(`Name=AIM-54A Phoenix`) < acmi.indexOf(`0,Event=HasFired|${fighterId}|${weaponLine?.split(",")[0]}`),
  "firing event preceded weapon object creation",
);
const threatLines = acmi.split("\n").filter((line) => line.includes("Name=P-500"));
const threatId = threatLines[0]?.split(",")[0];
assert(threatLines.length === 1, "destroyed threat was retained or recreated");
assert(
  acmi.split("\n").filter((line) => line === `0,Event=Destroyed|${threatId}`).length === 1,
  "terminal threat did not produce exactly one destruction event",
);
const removedWeaponId = weaponLine?.split(",")[0];
assert(
  !acmi.includes(`0,Event=Destroyed|${removedWeaponId}`),
  "ordinary weapon removal was falsely reported as destroyed",
);
assert(acmi.includes("0,Event=Message|AIM-54A LAUNCH"), "timeline event missing");
const aircraftLines = acmi.split("\n").filter((line) => line.includes("Name=F-14A Tomcat"));
assert(aircraftLines.length === 1, "stable aircraft was recreated instead of updated");
console.log(JSON.stringify({ bytes: acmi.length, frames: 3, aircraftCreates: aircraftLines.length }, null, 2));
