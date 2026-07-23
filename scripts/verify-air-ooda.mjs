import {
  defensiveManeuverFromWarning,
  missionShouldReturn,
  selectMissionTrack,
} from "../dist-test/air/ooda.js";

const vector=(x,y,z)=>({x,y,z});
const tracks=[
  {targetId:"far-air",position:vector(80,20,0),velocity:vector(0,0,0),quality:.8,uncertainty:2,lastUpdate:0,classification:"aircraft"},
  {targetId:"near-air",position:vector(20,20,0),velocity:vector(0,0,0),quality:.6,uncertainty:3,lastUpdate:0,classification:"aircraft"},
  {targetId:"ship",position:vector(100,0,0),velocity:vector(0,0,0),quality:.5,uncertainty:5,lastUpdate:0,classification:"ship"},
];
const cap=selectMissionTrack({mission:"cap",tracks,origin:vector(0,20,0)});
const strike=selectMissionTrack({mission:"anti-ship",tracks,origin:vector(0,20,0)});
const defense=defensiveManeuverFromWarning({aircraftPosition:vector(0,10,0),warningPosition:vector(30,10,0),warningVelocity:vector(-6,0,0),side:1});
const result={cap:cap?.targetId,strike:strike?.targetId,defense,returnClear:missionShouldReturn({mission:"cap",hasEngaged:true,observedHostileAircraft:0,observedThreats:0}),returnDenied:missionShouldReturn({mission:"cap",hasEngaged:true,observedHostileAircraft:0,observedThreats:1}),returnBeforeContact:missionShouldReturn({mission:"cap",hasEngaged:false,observedHostileAircraft:0,observedThreats:0})};
console.log(JSON.stringify(result,null,2));
if(result.cap!=="near-air"||result.strike!=="ship"||Math.abs(defense.timeToImpact-5)>.001||Math.abs(defense.direction.z+1)>.001||!result.returnClear||result.returnDenied||result.returnBeforeContact)process.exitCode=1;
