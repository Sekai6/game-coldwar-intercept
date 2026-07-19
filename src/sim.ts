import * as THREE from 'three';

export type TrackQuality = 'unknown' | 'suspect' | 'classified';
export type SensorName = 'AN/SPS-48E' | 'AN/SPS-49';
export interface Track {
  id:number;
  position:THREE.Vector3;
  velocity:THREE.Vector3;
  quality:number;
  uncertainty:number;
  altitudeEstimate:number;
  altitudeUncertainty:number;
  altitudeKnown:boolean;
  lastAltitudeUpdate:number;
  sensorContributors:SensorName[];
  age:number;
  classification:TrackQuality;
  lastSeen:number;
}
export interface SearchState { width:number; bearing:number; focused:boolean; revisitMultiplier:number; }

type TargetReturn={id:number;position:THREE.Vector3;velocity:THREE.Vector3;altitude:number;rcs:number};
type SensorDefinition={name:SensorName;threeDimensional:boolean;baseInterval:number;maxRange:number;radarHeight:number;precision:number};
const SENSORS:SensorDefinition[]=[
  {name:'AN/SPS-48E',threeDimensional:true,baseInterval:.75,maxRange:650,radarHeight:36,precision:1},
  {name:'AN/SPS-49',threeDimensional:false,baseInterval:1.15,maxRange:1050,radarHeight:42,precision:.72}
];

// Game-scaled sensor model. Relationships are physical; values are not system specifications.
export class CombatPicture {
  readonly tracks=new Map<number,Track>();
  private rng=0x41c64e6d;
  private nextScan=new Map<SensorName,number>(SENSORS.map(sensor=>[sensor.name,0]));
  private searchWidth=360;
  private searchBearing=0;
  private rand(){this.rng=(this.rng*1664525+1013904223)>>>0;return this.rng/0xffffffff;}
  private radarHorizon(aMeters:number,bMeters:number){return 41.2*(Math.sqrt(Math.max(0,aMeters))+Math.sqrt(Math.max(0,bMeters)));}
  private angleDelta(a:number,b:number){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
  private targetBearing(target:THREE.Vector3,sensor:THREE.Vector3){return Math.atan2(target.x-sensor.x,target.z-sensor.z);}
  setSearch(width:number,bearing=this.searchBearing){this.searchWidth=THREE.MathUtils.clamp(width,60,360);this.searchBearing=Math.atan2(Math.sin(bearing),Math.cos(bearing));}
  getSearchState():SearchState{return{width:this.searchWidth,bearing:this.searchBearing,focused:this.searchWidth<360,revisitMultiplier:this.searchWidth/360};}
  reset(){this.tracks.clear();this.nextScan=new Map(SENSORS.map(sensor=>[sensor.name,0]));this.rng=0x41c64e6d;}
  update(now:number,dt:number,targets:TargetReturn[],radarHealth=1,sensorPosition=new THREE.Vector3()){
    for(const track of this.tracks.values()){track.age+=dt;track.quality=Math.max(0,track.quality-dt*.008);track.uncertainty+=dt*95;track.altitudeUncertainty+=dt*18;if(now-track.lastAltitudeUpdate>4)track.altitudeKnown=false;}
    const focusGain=this.searchWidth<360?1.5:1;
    for(const sensor of SENSORS){
      if(now<(this.nextScan.get(sensor.name)??0))continue;
      const revisit=Math.max(.14,sensor.baseInterval*this.searchWidth/360);
      this.nextScan.set(sensor.name,now+revisit);
      for(const target of targets){
        const bearing=this.targetBearing(target.position,sensorPosition);
        if(this.searchWidth<360&&Math.abs(this.angleDelta(bearing,this.searchBearing))>THREE.MathUtils.degToRad(this.searchWidth/2))continue;
        const range=target.position.distanceTo(sensorPosition),effective=sensor.maxRange*Math.pow(Math.max(.05,target.rcs/.5),.25)*radarHealth;if(range>effective*1.05)continue;
        const horizon=this.radarHorizon(sensor.radarHeight,target.altitude),horizonFactor=range>horizon?Math.max(.06,1-(range-horizon)/effective):1;
        const ratio=Math.min(1,range/effective),highAltitudeGain=!sensor.threeDimensional&&target.altitude>3000?1.18:1;
        const probability=Math.min(.98,Math.max(0,.96-ratio*ratio*.74)*horizonFactor*highAltitudeGain+(!sensor.threeDimensional&&target.altitude>3000?.12:0));
        if(this.rand()>=probability)continue;
        const measuredQuality=THREE.MathUtils.clamp((1-ratio)*horizonFactor*radarHealth*sensor.precision*focusGain,.03,.96);
        const errorMeters=(Math.pow(1-measuredQuality,1.65)*4200+this.rand()*500)/sensor.precision,errorWorld=errorMeters/100;
        const existing=this.tracks.get(target.id),measuredPosition=target.position.clone().add(new THREE.Vector3((this.rand()-.5)*errorWorld,0,(this.rand()-.5)*errorWorld));
        const altitudeError=sensor.threeDimensional?Math.max(80,errorMeters*.16):Math.max(5000,target.altitude*.8);
        measuredPosition.y=sensor.threeDimensional?target.position.y+(this.rand()-.5)*altitudeError/50:existing?.altitudeKnown?existing.position.y:.6;
        if(existing){
          const gain=.24+measuredQuality*.42;existing.position.lerp(measuredPosition,gain);existing.velocity.lerp(target.velocity,sensor.threeDimensional?.58:.38);existing.quality=THREE.MathUtils.lerp(existing.quality,measuredQuality,.58);existing.uncertainty=THREE.MathUtils.lerp(existing.uncertainty,errorMeters,.52);existing.age=0;existing.lastSeen=now;
          if(sensor.threeDimensional){existing.altitudeEstimate=measuredPosition.y*50;existing.altitudeUncertainty=altitudeError;existing.altitudeKnown=true;existing.lastAltitudeUpdate=now;}
          if(!existing.sensorContributors.includes(sensor.name))existing.sensorContributors.push(sensor.name);
          existing.classification=existing.quality>.7?'classified':existing.quality>.25?'suspect':'unknown';
        }else{
          this.tracks.set(target.id,{id:target.id,position:measuredPosition,velocity:target.velocity.clone(),quality:measuredQuality,uncertainty:errorMeters,altitudeEstimate:sensor.threeDimensional?measuredPosition.y*50:0,altitudeUncertainty:altitudeError,altitudeKnown:sensor.threeDimensional,lastAltitudeUpdate:sensor.threeDimensional?now:-Infinity,sensorContributors:[sensor.name],age:0,classification:measuredQuality>.7?'classified':measuredQuality>.25?'suspect':'unknown',lastSeen:now});
        }
      }
    }
    for(const [id,track] of this.tracks)if(track.quality<.03||track.age>160)this.tracks.delete(id);
  }
  bestTrack(){return[...this.tracks.values()].sort((a,b)=>b.quality-a.quality)[0];}
}
