import { exportTacviewAcmi } from "../dist-test/aar/acmi-exporter.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const base = {
  ship: { x: 0, y: 0, z: 0, heading: 0, hull: 100 },
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
        state: "engaging",
        mission: "cap",
        alive: true,
        structure: 100,
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
        phase: "boost",
        targetId: "bomber-1",
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
        state: "engaging",
        mission: "cap",
        alive: true,
        structure: 100,
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
assert(acmi.includes("Name=AIM-54A Phoenix,Coalition=Blue,Target=bomber-1"), "weapon target relation missing");
assert(acmi.includes("|1000.0|0|0|90.00"), "altitude or heading conversion failed");
assert(acmi.includes("#0.25"), "second frame missing");
assert(/#0\.25[\s\S]*-\d+/.test(acmi), "removed weapon was not deleted");
assert(acmi.includes("0,Event=Message|AIM-54A LAUNCH"), "timeline event missing");
const aircraftLines = acmi.split("\n").filter((line) => line.includes("Name=F-14A Tomcat"));
assert(aircraftLines.length === 1, "stable aircraft was recreated instead of updated");
console.log(JSON.stringify({ bytes: acmi.length, frames: 2, aircraftCreates: aircraftLines.length }, null, 2));
