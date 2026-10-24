import * as THREE from "three";
import assert from "node:assert/strict";
globalThis.window={devicePixelRatio:1};
const { THREAT_DEFINITIONS }=await import("../dist-test/threats/catalog.js");

const result=THREAT_DEFINITIONS.map((definition)=>{
  const model=definition.createModel();let meshes=0,mapped=0;
  model.traverse((object)=>{if(!object.isMesh)return;meshes++;const materials=Array.isArray(object.material)?object.material:[object.material];if(materials.some((material)=>material.map&&material.roughnessMap&&material.normalMap))mapped++;});
  // Hidden sensor cones and particle buffers are not airframe dimensions.
  for (const key of ["particleTrail", "seekerFov", "shockCone"]) model.userData[key]?.removeFromParent();
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
  if (["R-360 Neptune", "3M24 Uran", "ASM-1", "RBS-15 Mk. II", "MM38 Exocet"].includes(definition.id)) {
    assert.equal(Boolean(model.getObjectByName("ventral-intake")), ["R-360 Neptune", "3M24 Uran", "RBS-15 Mk. II"].includes(definition.id));
    const body = model.getObjectByName("airframe-body");
    assert(body && model.getObjectByName("radar-radome") && model.getObjectByName("engine-nozzle"));
    assert(size.z > size.x * 2, `${definition.id}: slender missile silhouette`);
    assert.equal(definition.profile.homeOnJam, undefined);
    assert.equal(definition.profile.popUp, undefined);
    assert.equal(definition.profile.weave.lateral, 0);
    if (definition.id === "RBS-15 Mk. II") {
      assert(model.getObjectByName("control-fins")?.children[0]?.position.z < 0, "RBS-15 forward canards");
      assert.equal(model.getObjectByName("ventral-intake")?.geometry?.type, "CylinderGeometry", "RBS-15 rounded intake housing");
      assert.equal(model.getObjectByName("intake-opening")?.geometry?.type, "CircleGeometry", "RBS-15 round intake opening");
    }
    if (definition.id === "MM38 Exocet") assert.equal(model.getObjectByName("main-wings")?.rotation.z, Math.PI / 4, "MM38 offset main wings");
  }
  return {id:definition.id,visualId:model.userData.weaponVisualId,forwardAxis:model.userData.forwardAxis,meshes,mapped,surfaceDetails:model.userData.surfaceDetailCount??0,particleCount:model.userData.particleCount??0,seekerFov:Boolean(model.userData.seekerFov),lod:Boolean(model.userData.assetDetailLod),bodyExtent:Number(size.z.toFixed(2))};
});
console.log(JSON.stringify(result,null,2));
for (const id of ["P-15 Termit", "P-500", "P-700", "Kh-22", "RGM-84 Harpoon", "R-360 Neptune", "3M24 Uran", "ASM-1", "RBS-15 Mk. II", "MM38 Exocet"]) assert(result.some((model) => model.id === id), `missing ${id}`);
if(result.some((model)=>model.visualId!==model.id||model.forwardAxis!=="-Z"||model.meshes<15||model.mapped<7||model.surfaceDetails<5||model.particleCount<2||!model.seekerFov||!model.lod)||new Set(result.map((model)=>model.bodyExtent)).size<4)process.exitCode=1;
