import { formationSlot, updateFormationStatus } from "../dist-test/formation.js";
import { airDamageDisposition, stepAircraftLossOfControl } from "../dist-test/damage.js";

const slot=formationSlot({leader:{x:100,y:20,z:50},leaderHeading:{x:0,y:0,z:-1},lateral:12,vertical:2,trail:10});
const broken=updateFormationStatus({current:"joined",error:60,joinDistance:8,breakDistance:45});
const rejoining=updateFormationStatus({current:broken,error:25,joinDistance:8,breakDistance:45});
const joined=updateFormationStatus({current:rejoining,error:6,joinDistance:8,breakDistance:45});
const healthy=airDamageDisposition({structure:100,leftEngine:100,rightEngine:100,radar:100,flightControl:100,weapons:100});
const damagedReturn=airDamageDisposition({structure:48,leftEngine:100,rightEngine:100,radar:100,flightControl:100,weapons:100});
const controlledReturn=airDamageDisposition({structure:75,leftEngine:18,rightEngine:100,radar:100,flightControl:60,weapons:100});
const missionKill=airDamageDisposition({structure:16,leftEngine:100,rightEngine:100,radar:100,flightControl:100,weapons:100});
let loss={position:{x:0,y:8,z:0},velocity:{x:2,y:-.5,z:1},roll:0,crashed:false};
for(let step=0;step<200&&!loss.crashed;step++)loss=stepAircraftLossOfControl({...loss,dt:.1});
const result={slot,formation:[broken,rejoining,joined],damage:{healthy,damagedReturn,controlledReturn,missionKill},loss};
console.log(JSON.stringify(result,null,2));
if(slot.x!==112||slot.y!==22||slot.z!==60||broken!=="separated"||rejoining!=="rejoining"||joined!=="joined"||healthy!=="continue"||damagedReturn!=="egress"||controlledReturn!=="egress"||missionKill!=="mission-kill"||!loss.crashed||loss.position.y!==.2||loss.velocity.x!==0||loss.velocity.y!==0||loss.velocity.z!==0||loss.roll<=0)process.exitCode=1;
