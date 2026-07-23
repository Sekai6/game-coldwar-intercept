import * as THREE from "three";
import {
  advanceAirTracks,
  classifyAirMeasurement,
  createAirMeasurement,
} from "../dist-test/air/track-store.js";

const measurement=createAirMeasurement({targetId:"contact-1",targetKind:"aircraft",position:new THREE.Vector3(10,5,2),velocity:new THREE.Vector3(2,0,-1),quality:.7,precision:.8,time:4,noise:[.5,.5,.5]});
const tracks=new Map([[measurement.targetId,measurement]]);
const initial=measurement.position.clone();
advanceAirTracks(tracks,.5,4.5);
const propagated=measurement.position.clone();
const quality=measurement.quality;
advanceAirTracks(tracks,.5,13);
const result={initial:initial.toArray(),propagated:propagated.toArray(),quality,expired:!tracks.has("contact-1"),classification:{aircraft:classifyAirMeasurement("aircraft",.7),weak:classifyAirMeasurement("aircraft",.2),missile:classifyAirMeasurement("missile",.9)}};
console.log(JSON.stringify(result,null,2));
if(initial.x!==10||propagated.x!==11||propagated.z!==1.5||Math.abs(quality-.691)>.0001||!result.expired||result.classification.aircraft!=="aircraft"||result.classification.weak!=="unknown"||result.classification.missile!=="unknown")process.exitCode=1;
