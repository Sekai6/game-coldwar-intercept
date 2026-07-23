import { stepFlightDynamics } from "../dist-test/flight-dynamics.js";

const envelope={cruiseSpeed:5.1,maxSpeed:11.5,stallSpeed:2.1,acceleration:1.1,drag:.018,maxLoadFactor:7.5,maxRollRateDeg:120,maxPitchRateDeg:28,maxAngleOfAttackDeg:17};
const healthy=stepFlightDynamics({speed:5.1,currentBank:0,desiredBank:90,flightPathAngleDeg:0,desiredFlightPathAngleDeg:40,flightControlHealth:1,engineHealth:1,defending:true,dt:.1,envelope});
const damaged=stepFlightDynamics({speed:5.1,currentBank:0,desiredBank:90,flightPathAngleDeg:0,desiredFlightPathAngleDeg:40,flightControlHealth:.35,engineHealth:.5,defending:true,dt:.1,envelope});
const lowSpeed=stepFlightDynamics({speed:1.8,currentBank:0,desiredBank:90,flightPathAngleDeg:10,desiredFlightPathAngleDeg:40,flightControlHealth:1,engineHealth:1,defending:false,dt:.1,envelope});
const cruise=stepFlightDynamics({speed:5.1,currentBank:0,desiredBank:0,flightPathAngleDeg:0,desiredFlightPathAngleDeg:0,flightControlHealth:1,engineHealth:1,defending:false,dt:1,envelope});
const combat=stepFlightDynamics({speed:5.1,currentBank:0,desiredBank:90,flightPathAngleDeg:20,desiredFlightPathAngleDeg:40,flightControlHealth:1,engineHealth:1,defending:true,dt:1,envelope});
const result={healthy,damaged,lowSpeed,cruiseFuel:cruise.fuelBurn,combatFuel:combat.fuelBurn};
console.log(JSON.stringify(result,null,2));
if(Math.abs(healthy.bank)>12.001||Math.abs(damaged.bank)>=Math.abs(healthy.bank)||Math.abs(healthy.pitchDelta)>2.801||!lowSpeed.stalled||damaged.maximumTurnRateDeg>=healthy.maximumTurnRateDeg||combat.fuelBurn<=cruise.fuelBurn)process.exitCode=1;
