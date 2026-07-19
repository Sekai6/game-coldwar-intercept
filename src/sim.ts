import * as THREE from 'three';

export type TrackQuality = 'unknown' | 'suspect' | 'classified';
export interface Track { id:number; position:THREE.Vector3; velocity:THREE.Vector3; quality:number; uncertainty:number; age:number; classification:TrackQuality; lastSeen:number; }

// Deliberately game-scaled sensor model. The relationships are physical; values are not real system specifications.
export class CombatPicture {
  readonly tracks = new Map<number,Track>();
  private rng = 0x41c64e6d;
  private nextScan = 0;
  private nextShare = 0;
  private rand(){ this.rng=(this.rng*1664525+1013904223)>>>0; return this.rng/0xffffffff; }
  private radarHorizon(a:number,b:number){ return 180 + Math.sqrt(Math.max(0,a)+Math.max(0,b))*18; }
  update(now:number, dt:number, targets:{id:number; position:THREE.Vector3; velocity:THREE.Vector3; altitude:number; rcs:number}[], radarHealth=1, sensorPosition=new THREE.Vector3()){
    for(const t of this.tracks.values()){ t.age+=dt; t.quality=Math.max(0,t.quality-dt*.006); t.uncertainty+=dt*90; }
    if(now>=this.nextScan){ this.nextScan=now+.75; for(const target of targets){
      const range=target.position.distanceTo(sensorPosition); const effective=260*Math.pow(Math.max(.05,target.rcs/12000),.25)*radarHealth;
      const horizon=this.radarHorizon(18,target.altitude); const horizonFactor=range>horizon?Math.max(.2,1-(range-horizon)/effective):1;
      const ratio=Math.min(1,range/effective); const probability=Math.max(0,.96-ratio*ratio*.74)*horizonFactor;
      if(this.rand()<probability){ const measuredQuality=Math.max(.03,(1-ratio)*horizonFactor*radarHealth),errorMeters=Math.pow(1-measuredQuality,1.65)*4200+this.rand()*500,errorWorld=errorMeters/100; const measuredPosition=target.position.clone().add(new THREE.Vector3((this.rand()-.5)*errorWorld,(this.rand()-.5)*errorWorld*.25,(this.rand()-.5)*errorWorld)),existing=this.tracks.get(target.id);if(existing){const gain=.3+measuredQuality*.42;existing.position.lerp(measuredPosition,gain);existing.velocity.lerp(target.velocity,.55);existing.quality=THREE.MathUtils.lerp(existing.quality,measuredQuality,.58);existing.uncertainty=THREE.MathUtils.lerp(existing.uncertainty,errorMeters,.52);existing.age=0;existing.lastSeen=now;existing.classification=existing.quality>.7?'classified':existing.quality>.25?'suspect':'unknown';}else this.tracks.set(target.id,{id:target.id,position:measuredPosition,velocity:target.velocity.clone(),quality:measuredQuality,uncertainty:errorMeters,age:0,classification:measuredQuality>.7?'classified':measuredQuality>.25?'suspect':'unknown',lastSeen:now}); }
    }}
    if(now>=this.nextShare){ this.nextShare=now+5; for(const t of this.tracks.values()){ t.quality*=.85; t.uncertainty+=1500; }}
    for(const [id,t] of this.tracks) if(t.quality<.03||t.age>160) this.tracks.delete(id);
  }
  bestTrack(){ return [...this.tracks.values()].sort((a,b)=>b.quality-a.quality)[0]; }
}
