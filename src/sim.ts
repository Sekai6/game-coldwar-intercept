import * as THREE from 'three';

export type TrackQuality = 'unknown' | 'suspect' | 'classified';
export type SensorName = string;
export type SensorHealth = Partial<Record<SensorName,number>>;
export type SensorAspectHealth = Partial<Record<SensorName,(bearing:number)=>number>>;
export interface Track {
  id:number;
  sourceId:number;
  position:THREE.Vector3;
  velocity:THREE.Vector3;
  quality:number;
  uncertainty:number;
  altitudeEstimate:number;
  altitudeUncertainty:number;
  altitudeKnown:boolean;
  lastAltitudeUpdate:number;
  solutionQuality:number;
  solutionTime:number;
  lastSolutionReset:number;
  sensorContributors:SensorName[];
  age:number;
  classification:TrackQuality;
  lastSeen:number;
}
export interface SearchState { width:number; bearing:number; focused:boolean; revisitMultiplier:number; }

type TargetReturn={id:number;position:THREE.Vector3;velocity:THREE.Vector3;altitude:number;rcs:number};
export type SensorDefinition={name:SensorName;threeDimensional:boolean;baseInterval:number;maxRange:number;radarHeight:number;precision:number;scanMode?:'mechanical'|'phased-array'};
export const DEFAULT_SENSORS:SensorDefinition[]=[
  {name:'AN/SPS-48E',threeDimensional:true,baseInterval:.75,maxRange:650,radarHeight:36,precision:1,scanMode:'mechanical'},
  {name:'AN/SPS-49',threeDimensional:false,baseInterval:1.15,maxRange:1050,radarHeight:42,precision:.72,scanMode:'mechanical'}
];

// Game-scaled sensor model. Relationships are physical; values are not system specifications.
export class CombatPicture {
  readonly tracks=new Map<number,Track>();
  private rng=0x41c64e6d;
  private nextTrackId=1;
  private events:string[]=[];
  private lastTrackForSource=new Map<number,number>();
  private sensors:SensorDefinition[];
  private nextScan:Map<SensorName,number>;
  private nextBackgroundScan:Map<SensorName,number>;
  private searchWidth=360;
  private searchBearing=0;
  constructor(sensors:SensorDefinition[]=DEFAULT_SENSORS){this.sensors=sensors.map(sensor=>({...sensor}));this.nextScan=new Map(this.sensors.map(sensor=>[sensor.name,0]));this.nextBackgroundScan=new Map(this.sensors.map(sensor=>[sensor.name,0]));}
  setSensors(sensors:SensorDefinition[]){this.sensors=sensors.map(sensor=>({...sensor}));this.reset();}
  private rand(){this.rng=(this.rng*1664525+1013904223)>>>0;return this.rng/0xffffffff;}
  private radarHorizon(aMeters:number,bMeters:number){return 41.2*(Math.sqrt(Math.max(0,aMeters))+Math.sqrt(Math.max(0,bMeters)));}
  private angleDelta(a:number,b:number){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
  private targetBearing(target:THREE.Vector3,sensor:THREE.Vector3){return Math.atan2(target.x-sensor.x,target.z-sensor.z);}
  private associate(position:THREE.Vector3,velocity:THREE.Vector3,revisit:number,claimed:Set<number>){let best:Track|undefined,bestScore=1;for(const track of this.tracks.values()){if(claimed.has(track.id))continue;const predicted=track.position.clone().addScaledVector(track.velocity,track.age),dx=predicted.x-position.x,dz=predicted.z-position.z,deviation=Math.hypot(dx,dz),gate=Math.max(8,track.uncertainty/100*1.6+velocity.length()*revisit*1.8),score=deviation/gate;if(score<bestScore){best=track;bestScore=score;}}return best;}
  setSearch(width:number,bearing=this.searchBearing){this.searchWidth=THREE.MathUtils.clamp(width,60,360);this.searchBearing=Math.atan2(Math.sin(bearing),Math.cos(bearing));}
  getSearchState():SearchState{return{width:this.searchWidth,bearing:this.searchBearing,focused:this.searchWidth<360,revisitMultiplier:this.searchWidth/360};}
  reset(){this.tracks.clear();this.nextScan=new Map(this.sensors.map(sensor=>[sensor.name,0]));this.nextBackgroundScan=new Map(this.sensors.map(sensor=>[sensor.name,0]));this.nextTrackId=1;this.events=[];this.lastTrackForSource.clear();this.rng=0x41c64e6d;}
  drainEvents(){return this.events.splice(0);}
  update(now:number,dt:number,targets:TargetReturn[],radarHealth:number|SensorHealth=1,sensorPosition=new THREE.Vector3(),aspectHealth:SensorAspectHealth={}){
    for(const track of this.tracks.values()){track.age+=dt;track.quality=Math.max(0,track.quality-dt*.008);track.uncertainty+=dt*95;track.altitudeUncertainty+=dt*18;if(now-track.lastAltitudeUpdate>4)track.altitudeKnown=false;if(track.altitudeKnown&&track.age<1.5){track.solutionTime+=dt;track.solutionQuality=THREE.MathUtils.clamp(track.solutionQuality+dt*(.16+track.quality*.3),0,1);}else{track.solutionTime=0;track.solutionQuality=Math.max(0,track.solutionQuality-dt*.16);}}
    for(const sensor of this.sensors){
      const health=typeof radarHealth==='number'?radarHealth:radarHealth[sensor.name]??1;if(health<=.04)continue;
      const focused=this.searchWidth<360,phasedArray=sensor.scanMode==='phased-array',focusDue=now>=(this.nextScan.get(sensor.name)??0),backgroundDue=phasedArray&&focused&&now>=(this.nextBackgroundScan.get(sensor.name)??0);
      if(!focusDue&&!backgroundDue)continue;
      const focusedResourceFactor=phasedArray ? (0.35+0.65*this.searchWidth/360) : this.searchWidth/360;
      const focusRevisit=Math.max(.14,sensor.baseInterval*(focused?focusedResourceFactor:1)/Math.max(.25,health)),backgroundRevisit=Math.max(sensor.baseInterval,sensor.baseInterval*1.9/Math.max(.25,health));
      if(focusDue)this.nextScan.set(sensor.name,now+focusRevisit);
      if(backgroundDue)this.nextBackgroundScan.set(sensor.name,now+backgroundRevisit);
      const claimed=new Set<number>();
      for(const target of targets){
        const bearing=this.targetBearing(target.position,sensorPosition);
        const inFocus=!focused||Math.abs(this.angleDelta(bearing,this.searchBearing))<=THREE.MathUtils.degToRad(this.searchWidth/2);
        if(focused&&!inFocus&&(!phasedArray||!backgroundDue))continue;
        if(inFocus&&!focusDue)continue;
        const revisit=inFocus?focusRevisit:backgroundRevisit,focusGain=focused&&inFocus?1.5:1,targetHealth=health*THREE.MathUtils.clamp(aspectHealth[sensor.name]?.(bearing)??1,.04,1);
        const range=target.position.distanceTo(sensorPosition),effective=sensor.maxRange*Math.pow(Math.max(.05,target.rcs/.5),.25)*targetHealth;if(range>effective*1.05)continue;
        const horizon=this.radarHorizon(sensor.radarHeight,target.altitude),horizonFactor=range>horizon?Math.max(.06,1-(range-horizon)/effective):1;
        const ratio=Math.min(1,range/effective),highAltitudeGain=!sensor.threeDimensional&&target.altitude>3000?1.18:1;
        const probability=Math.min(.98,Math.max(0,.96-ratio*ratio*.74)*horizonFactor*highAltitudeGain+(!sensor.threeDimensional&&target.altitude>3000?.12:0));
        if(this.rand()>=probability)continue;
        const measuredQuality=THREE.MathUtils.clamp((1-ratio)*horizonFactor*targetHealth*sensor.precision*focusGain,.03,.96);
        const errorMeters=(Math.pow(1-measuredQuality,1.65)*4200+this.rand()*500)/sensor.precision,errorWorld=errorMeters/100;
        const measuredPosition=target.position.clone().add(new THREE.Vector3((this.rand()-.5)*errorWorld,0,(this.rand()-.5)*errorWorld));
        const altitudeError=sensor.threeDimensional?Math.max(80,errorMeters*.16):Math.max(5000,target.altitude*.8);
        measuredPosition.y=sensor.threeDimensional?target.position.y+(this.rand()-.5)*altitudeError/50:.6;
        const existing=this.associate(measuredPosition,target.velocity,revisit,claimed);if(existing?.altitudeKnown&&!sensor.threeDimensional)measuredPosition.y=existing.position.y;
        if(existing){
          const maneuverAngle=existing.velocity.lengthSq()>.01?existing.velocity.angleTo(target.velocity):0;if(maneuverAngle>THREE.MathUtils.degToRad(3.5)){existing.solutionQuality=Math.min(.12,existing.solutionQuality*.28);existing.solutionTime=0;if(now-existing.lastSolutionReset>1.5){this.events.push(`FIRE CONTROL RESET / TRACK ${existing.id} / MANEUVER ${THREE.MathUtils.radToDeg(maneuverAngle).toFixed(1)} DEG`);existing.lastSolutionReset=now;}}
          claimed.add(existing.id);this.lastTrackForSource.set(target.id,existing.id);const gain=.24+measuredQuality*.42;existing.sourceId=target.id;existing.position.lerp(measuredPosition,gain);existing.velocity.lerp(target.velocity,sensor.threeDimensional?.58:.38);existing.quality=THREE.MathUtils.lerp(existing.quality,measuredQuality,.58);existing.uncertainty=THREE.MathUtils.lerp(existing.uncertainty,errorMeters,.52);existing.age=0;existing.lastSeen=now;
          if(sensor.threeDimensional){existing.altitudeEstimate=measuredPosition.y*50;existing.altitudeUncertainty=altitudeError;existing.altitudeKnown=true;existing.lastAltitudeUpdate=now;}
          if(!existing.sensorContributors.includes(sensor.name))existing.sensorContributors.push(sensor.name);
          existing.classification=existing.quality>.7?'classified':existing.quality>.25?'suspect':'unknown';
        }else{
          const priorId=this.lastTrackForSource.get(target.id),id=this.nextTrackId++;if(priorId!==undefined&&priorId!==id)this.events.push(`CORRELATION BREAK / TRACK ${priorId} -> ${id}`);this.lastTrackForSource.set(target.id,id);claimed.add(id);this.tracks.set(id,{id,sourceId:target.id,position:measuredPosition,velocity:target.velocity.clone(),quality:measuredQuality,uncertainty:errorMeters,altitudeEstimate:sensor.threeDimensional?measuredPosition.y*50:0,altitudeUncertainty:altitudeError,altitudeKnown:sensor.threeDimensional,lastAltitudeUpdate:sensor.threeDimensional?now:-Infinity,solutionQuality:0,solutionTime:0,lastSolutionReset:-Infinity,sensorContributors:[sensor.name],age:0,classification:measuredQuality>.7?'classified':measuredQuality>.25?'suspect':'unknown',lastSeen:now});
        }
      }
    }
    for(const [id,track] of this.tracks)if(track.quality<.03||track.age>160)this.tracks.delete(id);
  }
  trackForTarget(sourceId:number){return[...this.tracks.values()].filter(track=>track.sourceId===sourceId).sort((a,b)=>(Number(b.altitudeKnown)-Number(a.altitudeKnown))||b.solutionQuality-a.solutionQuality||b.quality-a.quality||a.age-b.age)[0];}
  bestTrack(){return[...this.tracks.values()].sort((a,b)=>b.quality-a.quality)[0];}
}
