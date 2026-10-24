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
    spaceWeather:{phase:"total-blackout",intensity:1,hfAvailability:.015,vhfUhfReliability:.07,satelliteReliability:.025,gnssQuality:.1,radarNoise:.4,magneticDisturbance:1,communicationWindowOpen:false,communicationWindowStrength:0},
    decisions:[{platformId:"fighter-1",side:"blue",domain:"air",action:"continue-last-vector",reason:"lost comms; executing last valid intercept order",targetId:"bomber-1",trackSource:"last-valid-link11",trackQuality:.31,localTrackCount:0,networkTrackCount:1,commsState:"lost",doctrine:"us-cap-last-vector"}],
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
        targetId:"bomber-1",localTracks:0,networkTracks:1,bestTrackSource:"last-valid-link11",bestTrackQuality:.31,lostCommsDoctrine:"us-cap-last-vector",tacticalState:"lost-comms-intercept",
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
        seekerAcquired:false,
        midcourseLastUpdateAt:12.5,
        midcourseTrackQuality:.42,
        midcourseUncertainty:1850,
        midcourseLinkLostSeconds:4.25,
        inertialContinuation:true,
        autonomousSearchAuthorized:true,
        midcourseSource:"fighter-radar",
      },
    ],
    aewCommands:[{id:"AEW-CMD-1",controllerId:"blue-E-2C-1",participantId:"fighter-1",controllerTrackId:"AEW-opaque-01",mode:"link4a",x:35,y:70,z:-42,quality:.61,uncertainty:18,commandedSpeed:8.6,radarActivationRange:240,expiresAt:10}],
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
const projectionOptions = { title: "Scale test", referenceTime: new Date(0), blueShipName: "Scale probe", referenceLatitude: 0, referenceLongitude: 0 };
const projectionSnapshot = [{ ...base, time: 0, ship: { ...base.ship, x: 100, z: -100, y: 10 } }];
const project = scale => exportTacviewAcmi(projectionSnapshot, [], { ...projectionOptions, worldUnitsPerKm: scale });
assert(project(undefined) === project(10), "default ACMI coordinates must stay compatible");
const coord = scale => project(scale).match(/T=([^,\n]+)/)[1].split("|").map(Number);
const defaultCoord = coord(10), scaledCoord = coord(25);
assert(Math.abs(scaledCoord[0] - defaultCoord[0] * .4) < 1e-7, "ACMI longitude ignores scale");
assert(Math.abs(scaledCoord[1] - defaultCoord[1] * .4) < 1e-7, "ACMI latitude ignores scale");
assert(scaledCoord[2] === defaultCoord[2] && scaledCoord[2] === 500, "horizontal scale must preserve altitude convention");
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
assert(acmi.includes("Name=Space Weather")&&acmi.includes("State=total-blackout")&&acmi.includes("HFAvailability=0.015")&&acmi.includes("CommunicationWindowOpen=0"),"space-weather telemetry missing");
assert(acmi.includes("DecisionAction=continue-last-vector")&&acmi.includes("DecisionTrackSource=last-valid-link11")&&acmi.includes("CommsState=lost")&&acmi.includes("LostCommsDoctrine=us-cap-last-vector"),"platform decision audit telemetry missing");
assert(acmi.includes("DecisionBestTrack=")&&acmi.includes("DecisionTrackClassification=")&&acmi.includes("DecisionTrackUncertainty=")&&acmi.includes("DecisionTrackAge=")&&acmi.includes("DecisionWeaponAuthority="),"platform decision knowledge telemetry missing");
assert(acmi.includes("MidcourseLastUpdate=12.50")&&acmi.includes("MidcourseLinkLostSeconds=4.25")&&acmi.includes("InertialContinuation=1")&&acmi.includes("AutonomousSearchAuthorized=1"),"air-weapon midcourse telemetry missing");
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
assert(acmi.includes("Name=AEW LINK4A AEW-opaque-01")&&acmi.includes("C2Layer=AEWInterceptControl")&&acmi.includes("WeaponAuthority=No")&&!acmi.includes("ControllerTrack=fighter-1"),"AEW command metadata or truth isolation missing");
const aircraftLines = acmi.split("\n").filter((line) => line.includes("Name=F-14A Tomcat"));
assert(aircraftLines.length === 1, "stable aircraft was recreated instead of updated");
for (const name of ["R-360 Neptune", "3M24 Uran", "ASM-1", "RBS-15 Mk. II", "MM38 Exocet"]) {
  const missile = { id: 100, threatType:name, phase:"terminal", x:0, y:.2, z:-30, heading:0, pitch:0, roll:0, speed:6, verticalSpeed:0 };
  const exported = exportTacviewAcmi(
    [{ ...base, time:0, missiles:[missile] }, { ...base, time:1, missiles:[{ ...missile, phase:"destroyed" }] }],
    [], projectionOptions,
  );
  assert(exported.includes(`Name=${name},`), `${name}: ACMI must preserve the catalog identity`);
  const id = exported.split("\n").find((line) => line.includes(`Name=${name},`))?.split(",")[0];
  assert(id && /^[0-9a-f]+$/i.test(id) && Number.parseInt(id, 16) > 0, `${name}: ACMI identity must have a valid object ID`);
  assert(exported.split("\n").filter((line) => line === `0,Event=Destroyed|${id}`).length === 1, `${name}: exactly one destruction event`);
}
console.log(JSON.stringify({ bytes: acmi.length, frames: 3, aircraftCreates: aircraftLines.length }, null, 2));
