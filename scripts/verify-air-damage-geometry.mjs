import { resolveAircraftHit } from "../dist-test/damage.js";

const hit = (x, y, z) => resolveAircraftHit({ localHit: { x, y, z }, modelLength: 10, damage: 60 });
const result = {
  nose: hit(0, 0, -4),
  leftEngine: hit(-1, 0, 2),
  rightEngine: hit(1, 0, 2),
  wing: hit(2.2, 0, 0),
  tail: hit(0, 1, 3.2),
  fuselage: hit(0, 0, 0),
};

console.log(JSON.stringify(result, null, 2));
if (
  result.nose.primary !== "radar" ||
  result.leftEngine.primary !== "left-engine" ||
  result.rightEngine.primary !== "right-engine" ||
  result.wing.primary !== "weapons" ||
  result.tail.primary !== "flight-control" ||
  result.fuselage.primary !== "structure" ||
  result.nose.structureDamage <= 0 ||
  result.fuselage.structureDamage !== 0
) process.exitCode = 1;
