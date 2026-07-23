import {
  defensiveManeuverFromWarning,
  missionShouldReturn,
  noContactMissionDirection,
  selectMissionTrack,
  selectThrustMode,
} from "../dist-test/air/ooda.js";

const vector = (x, y, z) => ({ x, y, z });
const tracks = [
  {
    targetId: "far-air",
    position: vector(80, 20, 0),
    velocity: vector(0, 0, 0),
    quality: 0.8,
    uncertainty: 2,
    lastUpdate: 0,
    classification: "aircraft",
  },
  {
    targetId: "near-air",
    position: vector(20, 20, 0),
    velocity: vector(0, 0, 0),
    quality: 0.6,
    uncertainty: 3,
    lastUpdate: 0,
    classification: "aircraft",
  },
  {
    targetId: "ship",
    position: vector(100, 0, 0),
    velocity: vector(0, 0, 0),
    quality: 0.5,
    uncertainty: 5,
    lastUpdate: 0,
    classification: "ship",
  },
];
const cap = selectMissionTrack({
  mission: "cap",
  tracks,
  origin: vector(0, 20, 0),
});
const capAfterCommit = selectMissionTrack({
  mission: "cap",
  tracks,
  origin: vector(0, 20, 0),
  engagements: new Map([
    [
      "near-air",
      { shots: 1, pending: 1, misses: 0, lastResolution: -Infinity },
    ],
  ]),
  time: 10,
});
const capAfterMissDelay = selectMissionTrack({
  mission: "cap",
  tracks: [tracks[1]],
  origin: vector(0, 20, 0),
  engagements: new Map([
    ["near-air", { shots: 1, pending: 0, misses: 1, lastResolution: 7 }],
  ]),
  time: 10,
});
const capDuringAssessment = selectMissionTrack({
  mission: "cap",
  tracks: [tracks[1]],
  origin: vector(0, 20, 0),
  engagements: new Map([
    ["near-air", { shots: 1, pending: 0, misses: 1, lastResolution: 9 }],
  ]),
  time: 10,
});
const strike = selectMissionTrack({
  mission: "anti-ship",
  tracks,
  origin: vector(0, 20, 0),
});
const defense = defensiveManeuverFromWarning({
  aircraftPosition: vector(0, 10, 0),
  warningPosition: vector(30, 10, 0),
  warningVelocity: vector(-6, 0, 0),
  side: 1,
});
const strikeNoContact = noContactMissionDirection({
  mission: "anti-ship",
  side: "red",
  currentHeading: vector(-0.2, -0.01, 0.98),
});
const result = {
  cap: cap?.targetId,
  capAfterCommit: capAfterCommit?.targetId,
  capAfterMissDelay: capAfterMissDelay?.targetId,
  capDuringAssessment: capDuringAssessment?.targetId,
  strike: strike?.targetId,
  defense,
  strikeNoContact,
  returnClear: missionShouldReturn({
    mission: "cap",
    hasEngaged: true,
    observedHostileAircraft: 0,
    observedThreats: 0,
    contactLostSeconds: 20,
    hasAirborneWeapon: false,
  }),
  interceptReturn: missionShouldReturn({
    mission: "intercept",
    hasEngaged: true,
    observedHostileAircraft: 0,
    observedThreats: 0,
    contactLostSeconds: 20,
    hasAirborneWeapon: false,
  }),
  returnDenied: missionShouldReturn({
    mission: "cap",
    hasEngaged: true,
    observedHostileAircraft: 0,
    observedThreats: 1,
    contactLostSeconds: 30,
    hasAirborneWeapon: false,
  }),
  returnBeforeContact: missionShouldReturn({
    mission: "cap",
    hasEngaged: false,
    observedHostileAircraft: 0,
    observedThreats: 0,
    contactLostSeconds: 30,
    hasAirborneWeapon: false,
  }),
  returnDuringGrace: missionShouldReturn({
    mission: "cap",
    hasEngaged: true,
    observedHostileAircraft: 0,
    observedThreats: 0,
    contactLostSeconds: 19.9,
    hasAirborneWeapon: false,
  }),
  returnWithWeapon: missionShouldReturn({
    mission: "intercept",
    hasEngaged: true,
    observedHostileAircraft: 0,
    observedThreats: 0,
    contactLostSeconds: 30,
    hasAirborneWeapon: true,
  }),
  thrust: {
    patrol: selectThrustMode({mission:"cap",state:"formation",fuelRatio:.8,afterburnerAvailable:true,afterburnerRemaining:100,missileTti:null,targetRange:null,weaponMaxRange:400,speedRatio:.6,climbDemand:0}),
    intercept: selectThrustMode({mission:"intercept",state:"engaging",fuelRatio:.8,afterburnerAvailable:true,afterburnerRemaining:100,missileTti:null,targetRange:500,weaponMaxRange:400,speedRatio:.6,climbDemand:.2}),
    threat: selectThrustMode({mission:"return",state:"defending",fuelRatio:.1,afterburnerAvailable:true,afterburnerRemaining:10,missileTti:8,targetRange:null,weaponMaxRange:0,speedRatio:.5,climbDemand:0}),
    bomber: selectThrustMode({mission:"anti-ship",state:"engaging",fuelRatio:.8,afterburnerAvailable:false,afterburnerRemaining:0,missileTti:null,targetRange:500,weaponMaxRange:400,speedRatio:.5,climbDemand:.3}),
    returnMode: selectThrustMode({mission:"return",state:"egress",fuelRatio:.8,afterburnerAvailable:true,afterburnerRemaining:100,missileTti:null,targetRange:null,weaponMaxRange:0,speedRatio:.8,climbDemand:0}),
  },
};
console.log(JSON.stringify(result, null, 2));
if (
  result.cap !== "near-air" ||
  result.capAfterCommit !== "far-air" ||
  result.capAfterMissDelay !== "near-air" ||
  result.capDuringAssessment !== undefined ||
  result.strike !== "ship" ||
  Math.abs(defense.timeToImpact - 5) > 0.001 ||
  Math.abs(defense.direction.z + 1) > 0.001 ||
  strikeNoContact.x !== -0.2 ||
  strikeNoContact.y !== -0.01 ||
  strikeNoContact.z !== 0.98 ||
  !result.returnClear ||
  !result.interceptReturn ||
  result.returnDenied ||
  result.returnBeforeContact ||
  result.returnDuringGrace ||
  result.returnWithWeapon || result.thrust.patrol!=="cruise" ||
  result.thrust.intercept!=="afterburner" || result.thrust.threat!=="afterburner" ||
  result.thrust.bomber!=="military" || result.thrust.returnMode!=="cruise"
)
  process.exitCode = 1;
