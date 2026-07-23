import assert from "node:assert/strict";
import { radarCountermeasureContest } from "../dist-test/radar-countermeasures.js";

const clean=radarCountermeasureContest({targetRcs:12000,targetRange:90,ecmEnabled:false,ecmStrength:.6,ecmHealth:1,burnThroughRange:70});
const decoy=radarCountermeasureContest({targetRcs:12000,targetRange:90,decoyRcs:28,decoyRange:12,ecmEnabled:true,ecmStrength:.6,ecmHealth:1,burnThroughRange:70});
const burned=radarCountermeasureContest({targetRcs:12000,targetRange:30,decoyRcs:28,decoyRange:12,ecmEnabled:true,ecmStrength:.6,ecmHealth:1,burnThroughRange:70});
const hoj=radarCountermeasureContest({targetRcs:12000,targetRange:90,decoyRcs:28,decoyRange:12,ecmEnabled:true,ecmStrength:.6,ecmHealth:1,burnThroughRange:70,homeOnJamThreshold:.5});
assert.equal(clean.defeatProbability,0);
assert.ok(decoy.decoyPower>decoy.targetPower&&decoy.defeatProbability>0);
assert.ok(burned.ecmInterference<decoy.ecmInterference);
assert.equal(hoj.homeOnJam,true);
assert.ok(hoj.defeatProbability<decoy.defeatProbability);
console.log(JSON.stringify({clean,decoy,burned,hoj},null,2));
