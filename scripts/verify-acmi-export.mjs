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
assert(acmi.includes("0,Event=Message|AIM-54A LAUNCH"), "timeline event missing");
const aircraftLines = acmi.split("\n").filter((line) => line.includes("Name=F-14A Tomcat"));
assert(aircraftLines.length === 1, "stable aircraft was recreated instead of updated");
console.log(JSON.stringify({ bytes: acmi.length, frames: 2, aircraftCreates: aircraftLines.length }, null, 2));
