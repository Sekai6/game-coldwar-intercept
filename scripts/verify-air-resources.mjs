import { calculateFireControlUsage } from "../dist-test/air/launch-management.js";
import { advanceCountermeasurePrograms } from "../dist-test/air/countermeasure-program.js";

const usage=calculateFireControlUsage({
  liveWeapons:[
    {guidance:"active-radar",seekerAcquired:false},
    {guidance:"active-radar",seekerAcquired:true},
    {guidance:"semi-active-radar",seekerAcquired:false},
  ],
  pendingWeapons:[
    {guidance:"anti-ship-radar"},
    {guidance:"semi-active-radar"},
  ],
});
const programs=[{type:"chaff",remaining:3,nextReleaseAt:10,interval:.2}];
const inventory={chaff:3,flares:2};
const first=advanceCountermeasurePrograms(programs,inventory,10);
const firstSnapshot={releaseCount:first.releases.length,chaff:first.inventory.chaff};
const early=advanceCountermeasurePrograms(first.programs,first.inventory,10.1);
const earlySnapshot={releaseCount:early.releases.length,chaff:early.inventory.chaff};
const second=advanceCountermeasurePrograms(early.programs,early.inventory,10.2);
const secondSnapshot={releaseCount:second.releases.length,chaff:second.inventory.chaff};
const result={usage,first:firstSnapshot,early:earlySnapshot,second:secondSnapshot};
console.log(JSON.stringify(result,null,2));
if(usage.datalink!==2||usage.illumination!==2||firstSnapshot.releaseCount!==1||firstSnapshot.chaff!==2||earlySnapshot.releaseCount!==0||secondSnapshot.releaseCount!==1||secondSnapshot.chaff!==1)process.exitCode=1;
