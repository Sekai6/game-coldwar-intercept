import * as THREE from 'three';

export interface FixedSensorFaceConfig {
  sensorName:string;
  subsystemId:string;
  labels:string[];
  headings:number[];
  damageMultiplier:number;
  healthyColor:number;
  damagedColor:number;
  criticalEmissive:number;
}

export function createFaceHealth(config:FixedSensorFaceConfig){return config.headings.map(()=>1);}

export function nearestSensorFaces(config:FixedSensorFaceConfig,localBearing:number){
  return config.headings.map((heading,index)=>({index,delta:Math.abs(THREE.MathUtils.euclideanModulo(localBearing-heading+Math.PI,Math.PI*2)-Math.PI)})).sort((a,b)=>a.delta-b.delta);
}

export function sensorFaceAspectHealth(config:FixedSensorFaceConfig,health:number[],localBearing:number){
  const faces=nearestSensorFaces(config,localBearing),blend=THREE.MathUtils.clamp(faces[0].delta/(Math.PI/2),0,.5);
  return Math.max(.04,THREE.MathUtils.lerp(health[faces[0].index]??1,health[faces[1]?.index]??health[faces[0].index]??1,blend));
}

export function damageSensorFace(config:FixedSensorFaceConfig,health:number[],localBearing:number,damagePercent:number){
  const index=nearestSensorFaces(config,localBearing)[0].index,before=health[index]??1;
  health[index]=Math.max(0,before-damagePercent/100*config.damageMultiplier);
  return{index,before,after:health[index],label:config.labels[index]??`FACE ${index+1}`};
}

export function worldBearingToLocal(worldBearing:number,worldQuaternion:THREE.Quaternion){
  const direction=new THREE.Vector3(Math.sin(worldBearing),0,Math.cos(worldBearing)).applyQuaternion(worldQuaternion.clone().invert());
  return Math.atan2(-direction.z,direction.x);
}
