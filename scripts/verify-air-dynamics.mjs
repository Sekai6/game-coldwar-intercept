import { stepFlightDynamics } from "../dist-test/air/flight-dynamics.js";

const thrust={militarySpeedFactor:1.4,militaryAccelerationFactor:1,militaryFuelMultiplier:1.6,militaryInfraredMultiplier:1.3,afterburnerAvailable:true,afterburnerSpeedFactor:2.2,afterburnerAccelerationFactor:1.8,afterburnerFuelMultiplier:4.8,afterburnerInfraredMultiplier:2.8,afterburnerSeconds:120};
const envelope={cruiseSpeed:5,maxSpeed:11,stallSpeed:2,acceleration:1,drag:.018,maxLoadFactor:8,maxRollRateDeg:120,maxPitchRateDeg:28,thrust};
const step=(thrustMode, afterburnerRemaining=120)=>stepFlightDynamics({speed:5,currentBank:0,desiredBank:0,flightPathAngleDeg:0,desiredFlightPathAngleDeg:0,flightControlHealth:1,engineHealth:1,thrustMode,afterburnerRemaining,dt:1,envelope});
const idle=step("idle"), cruise=step("cruise"), military=step("military"), afterburner=step("afterburner"), exhausted=step("afterburner",0);
const result={idle,cruise,military,afterburner,exhausted};
console.log(JSON.stringify(result,null,2));
if (!(idle.speed<cruise.speed && cruise.speed<military.speed && military.speed<afterburner.speed) ||
  !(idle.fuelBurn<cruise.fuelBurn && cruise.fuelBurn<military.fuelBurn && military.fuelBurn<afterburner.fuelBurn) ||
  afterburner.afterburnerUsed!==1 || exhausted.thrustMode!=="military" || exhausted.afterburnerUsed!==0) process.exitCode=1;
