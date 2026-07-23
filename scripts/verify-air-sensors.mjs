import assert from "node:assert/strict";
import { airRadarFactors, missileWarningProbability } from "../dist-test/sensors.js";

const clear = airRadarFactors({sensorAltitude:70,targetAltitude:90,range:250,nominalRange:520,targetRcs:28,radarHealth:1,precision:.88});
const jammed = airRadarFactors({sensorAltitude:70,targetAltitude:90,range:250,nominalRange:520,targetRcs:28,radarHealth:1,precision:.88,ecmStrength:.68,burnThroughRange:48});
const burned = airRadarFactors({sensorAltitude:70,targetAltitude:90,range:40,nominalRange:520,targetRcs:28,radarHealth:1,precision:.88,ecmStrength:.68,burnThroughRange:48});
assert.ok(jammed.effectiveRange < clear.effectiveRange && jammed.quality < clear.quality);
assert.equal(burned.burned,true);
assert.equal(burned.jamFactor,1);
assert.equal(missileWarningProbability(151,true),0);
assert.equal(missileWarningProbability(71,false),0);
assert.ok(missileWarningProbability(30,false)>0);
console.log(JSON.stringify({clear,jammed,burned,passiveWarningAt30:missileWarningProbability(30,false)},null,2));
