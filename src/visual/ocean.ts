import * as THREE from "three";
import { AFTERNOON_SUN_DIRECTION } from "./sunlight";

export type OceanBackend = "webgl-cpu-waves" | "webgl-hq-gerstner" | "webgpu-fft";

export interface OceanSurface {
  readonly object: THREE.Object3D;
  readonly backend: OceanBackend;
  setHighQuality(enabled: boolean): void;
  setUltraCloudVolume(texture: THREE.Data3DTexture | null, detailTexture?: THREE.Texture | null): void;
  setUltraSpectrum(texture: THREE.Texture | null, frameCount?: number): void;
  setVesselWake(position: THREE.Vector3, heading: number, speedRatio: number): void;
  addSplash(position: THREE.Vector3, energy: number): void;
  update(time: number, cameraPosition?: THREE.Vector3): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

class WebglOcean implements OceanSurface {
  readonly backend = "webgl-hq-gerstner" as const;
  readonly object: THREE.Mesh;
  private readonly geometry = new THREE.PlaneGeometry(2200, 2200, 256, 256);
  private readonly standardMaterial = new THREE.MeshStandardMaterial({ color: 0x0a3340, roughness: 0.68, metalness: 0.18 });
  private readonly highQualityMaterial: THREE.ShaderMaterial;
  private readonly neutralCloudVolume = new THREE.Data3DTexture(new Uint8Array([0, 128, 255, 255]), 1, 1, 1);
  private readonly neutralCloudDetail = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
  private readonly splashes = Array.from({ length: 8 }, () => ({ position: new THREE.Vector3(), energy: 0, startedAt: -100 }));
  private currentTime = 0;

  constructor() {
    this.neutralCloudVolume.format = THREE.RGBAFormat;
    this.neutralCloudVolume.needsUpdate = true;
    this.neutralCloudDetail.needsUpdate = true;
    this.highQualityMaterial = new THREE.ShaderMaterial({
      lights: false,
      fog: true,
      uniforms: {
        time: { value: 0 },
        sunDirection: { value: AFTERNOON_SUN_DIRECTION.clone() },
        sunColor: { value: new THREE.Color(0xffd09a) },
        deepColor: { value: new THREE.Color(0x071f2d) },
        shallowColor: { value: new THREE.Color(0x176477) },
        skyColor: { value: new THREE.Color(0x88b7d2) },
        fogColor: { value: new THREE.Color(0x8298a4) },
        fogDensity: { value: 0.00072 },
        ultraCloudVolume: { value: this.neutralCloudVolume },
        ultraCloudDetail: { value: this.neutralCloudDetail },
        ultraCloudMix: { value: 0 },
        ultraSpectrum: { value: this.neutralCloudDetail },
        ultraSpectrumMix: { value: 0 },
        spectrumFrames: { value: 1 },
        wakePosition: { value: new THREE.Vector2() },
        wakeDirection: { value: new THREE.Vector2(1, 0) },
        wakeStrength: { value: 0 },
        splashes: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)) },
      },
      glslVersion: THREE.GLSL3,
      vertexShader: `
        out vec3 vWorldPosition; out vec3 vWorldNormal; out float vCrest;out float vJacobianFoam;out float vWakeFoam;
        uniform float time;uniform sampler2D ultraSpectrum;uniform float ultraSpectrumMix;uniform float spectrumFrames;uniform vec2 wakePosition;uniform vec2 wakeDirection;uniform float wakeStrength;uniform vec4 splashes[8];
        vec4 spectrum(vec2 p,float frame){vec2 uv=fract(p/420.+.5);float row=(mod(frame,spectrumFrames)+uv.y)/spectrumFrames;return texture(ultraSpectrum,vec2(uv.x,row));}
        vec3 wave(vec2 p,vec2 dir,float steep,float length,float speed,inout vec3 tangent,inout vec3 binormal){
          float k=6.283185/length;float phase=k*(dot(dir,p)-speed*time);float a=steep/k;
          float s=sin(phase),c=cos(phase);
          tangent+=vec3(-dir.x*dir.x*steep*s,dir.x*steep*c,-dir.x*dir.y*steep*s);
          binormal+=vec3(-dir.x*dir.y*steep*s,dir.y*steep*c,-dir.y*dir.y*steep*s);
          return vec3(dir.x*a*c,a*s,dir.y*a*c);
        }
        void main(){vec2 p=position.xy+vec2(modelMatrix[3].x,modelMatrix[3].z);vec3 tangent=vec3(1,0,0),binormal=vec3(0,0,1),offset=vec3(0);
          offset+=wave(p,normalize(vec2(.88,.34)),.31,52.,5.4,tangent,binormal);
          offset+=wave(p,normalize(vec2(.35,.94)),.20,24.,3.5,tangent,binormal);
          offset+=wave(p,normalize(vec2(-.62,.78)),.12,11.,2.1,tangent,binormal);
          offset+=wave(p,normalize(vec2(.96,-.27)),.06,4.8,1.2,tangent,binormal);
          offset*=mix(1.,.34,ultraSpectrumMix);tangent=mix(tangent,vec3(1,0,0),.66*ultraSpectrumMix);binormal=mix(binormal,vec3(0,0,1),.66*ultraSpectrumMix);float frameTime=mod(time*.7,spectrumFrames);float frame0=floor(frameTime),frame1=ceil(frameTime),frameBlend=fract(frameTime);vec4 spectral=mix(spectrum(p,frame0),spectrum(p,frame1),frameBlend);vec4 spectralX=mix(spectrum(p+vec2(3.,0.),frame0),spectrum(p+vec2(3.,0.),frame1),frameBlend);vec4 spectralZ=mix(spectrum(p+vec2(0.,3.),frame0),spectrum(p+vec2(0.,3.),frame1),frameBlend);vec2 relative=p-wakePosition;float longitudinal=dot(relative,wakeDirection);float lateral=dot(relative,vec2(-wakeDirection.y,wakeDirection.x));float trail=step(longitudinal,0.)*exp(longitudinal*.009);float armWidth=max(3.2,-longitudinal*.22);float kelvinArm=trail*smoothstep(4.5,0.,abs(abs(lateral)-armWidth));float turbulent=trail*exp(-abs(lateral)/max(2.4,-longitudinal*.035));float wakeMask=max(kelvinArm,turbulent*.72);float bow=exp(-dot(relative,relative)*.018);float wakeHeight=(sin(longitudinal*.58+abs(lateral)*.74)*kelvinArm*.3+sin(longitudinal*.9)*turbulent*.12+bow*.26)*wakeStrength;float splashHeight=0.,splashFoam=0.;for(int i=0;i<8;i++){float age=time-splashes[i].z;float energy=splashes[i].w;float radius=age*(5.+energy*2.);float d=length(p-splashes[i].xy);float alive=step(0.,age)*step(age,5.);float ring=exp(-pow((d-radius)/max(1.,1.4+age*.45),2.))*alive*energy*exp(-age*.42);splashHeight+=ring*sin((d-radius)*1.8)*.42;splashFoam+=ring;}vec3 fftOffset=vec3(spectral.r*2.-1.,spectral.b*2.-1.,spectral.g*2.-1.);offset+=fftOffset*vec3(1.35,.82,1.35)*ultraSpectrumMix;offset.y+=wakeHeight+splashHeight;tangent.y+=(spectralX.b-spectral.b)*.61*ultraSpectrumMix;binormal.y+=(spectralZ.b-spectral.b)*.61*ultraSpectrumMix;vJacobianFoam=max(spectral.a*ultraSpectrumMix,clamp(splashFoam,0.,1.));vWakeFoam=clamp((kelvinArm+turbulent*.58)*wakeStrength+bow*wakeStrength*.65,0.,1.);
          vec3 displaced=vec3(position.x+offset.x,position.y+offset.z,offset.y);
          vec4 world=modelMatrix*vec4(displaced,1.);vWorldPosition=world.xyz;
          vWorldNormal=normalize(mat3(modelMatrix)*normalize(cross(binormal,tangent)));vCrest=smoothstep(.48,1.18,offset.y);
          gl_Position=projectionMatrix*viewMatrix*world;}
      `,
      fragmentShader: `
        precision highp float; in vec3 vWorldPosition;in vec3 vWorldNormal;in float vCrest;in float vJacobianFoam;in float vWakeFoam;out vec4 outColor;
        uniform float time;uniform vec3 sunDirection;uniform vec3 sunColor;uniform vec3 deepColor;uniform vec3 shallowColor;uniform vec3 skyColor;uniform vec3 fogColor;uniform float fogDensity;uniform sampler3D ultraCloudVolume;uniform sampler2D ultraCloudDetail;uniform float ultraCloudMix;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
        void main(){vec3 viewDir=normalize(cameraPosition-vWorldPosition);vec3 n=normalize(vWorldNormal);
          float microA=noise(vWorldPosition.xz*.18+vec2(time*.08,-time*.05));float microB=noise(vWorldPosition.xz*.43-vec2(time*.11,time*.07));
          n=normalize(n+vec3((microA-.5)*.075,0.,(microB-.5)*.075));
          float ndv=max(dot(n,viewDir),0.);float fresnel=.02+.98*pow(1.-ndv,5.);
          vec3 halfVector=normalize(viewDir+sunDirection);float glitter=pow(max(dot(n,halfVector),0.),680.)*3.6;
          float broad=pow(max(dot(n,halfVector),0.),92.)*.24;float depthFacing=smoothstep(.05,.82,ndv);
          vec2 cloudUv=vec2(fract(vWorldPosition.x*.0014+time*.00105),fract(vWorldPosition.z*.0014-time*.00004));vec4 cloudLow=texture(ultraCloudVolume,vec3(cloudUv.x,.24,cloudUv.y));vec4 cloudMid=texture(ultraCloudVolume,vec3(cloudUv.x,.43,cloudUv.y));vec4 cloudHigh=texture(ultraCloudVolume,vec3(cloudUv.x,.62,cloudUv.y));vec2 erosionUv=fract(cloudUv*2.17+vec2(.31,.67));float fineErosion=texture(ultraCloudVolume,vec3(erosionUv.x,.48,erosionUv.y)).g;float detailErosion=texture(ultraCloudDetail,cloudUv*4.3+vec2(time*.0003,-time*.0001)).r;float projectedDensity=max(cloudLow.r-cloudLow.g*.22,max(cloudMid.r-cloudMid.g*.22,cloudHigh.r-cloudHigh.g*.22));float coverage=smoothstep(.018,.31,projectedDensity-fineErosion*.04-detailErosion*.075);float cloudShadow=mix(1.,.64,coverage*ultraCloudMix);
          vec3 water=mix(deepColor,shallowColor,depthFacing*.32+microA*.035);vec3 reflected=skyColor*(.32+.24*max(n.y,0.));
          glitter*=mix(1.,.46,coverage*ultraCloudMix);float foam=max(smoothstep(.88,1.0,vCrest)*smoothstep(.72,.94,microA*.55+microB*.45),max(vJacobianFoam,vWakeFoam));vec3 color=mix(water,reflected,fresnel*.64)+sunColor*(glitter+broad)+vec3(.72,.84,.86)*foam*.5;
          color*=mix(1.,cloudShadow,ultraCloudMix*.62);color+=skyColor*(1.-cloudShadow)*.022*ultraCloudMix;
          float distanceToCamera=length(cameraPosition-vWorldPosition);float fogFactor=1.-exp(-fogDensity*fogDensity*distanceToCamera*distanceToCamera);
          outColor=vec4(mix(color,fogColor,clamp(fogFactor,0.,1.)),1.);}
      `,
    });
    this.object = new THREE.Mesh(this.geometry, this.standardMaterial);
    this.object.userData.screenSpaceWater = true;
    this.object.rotation.x = -Math.PI / 2;
    this.object.receiveShadow = true;
  }

  setHighQuality(enabled: boolean) { this.object.material = enabled ? this.highQualityMaterial : this.standardMaterial; }
  setUltraCloudVolume(texture: THREE.Data3DTexture | null, detailTexture?: THREE.Texture | null) {
    this.highQualityMaterial.uniforms.ultraCloudVolume.value = texture ?? this.neutralCloudVolume;
    this.highQualityMaterial.uniforms.ultraCloudDetail.value = detailTexture ?? this.neutralCloudDetail;
    this.highQualityMaterial.uniforms.ultraCloudMix.value = texture ? 1 : 0;
  }
  setUltraSpectrum(texture: THREE.Texture | null, frameCount = 1) {
    this.highQualityMaterial.uniforms.ultraSpectrum.value = texture ?? this.neutralCloudDetail;
    this.highQualityMaterial.uniforms.ultraSpectrumMix.value = texture ? 1 : 0;
    this.highQualityMaterial.uniforms.spectrumFrames.value = Math.max(1, frameCount);
  }
  setVesselWake(position: THREE.Vector3, heading: number, speedRatio: number) {
    this.highQualityMaterial.uniforms.wakePosition.value.set(position.x, position.z);
    this.highQualityMaterial.uniforms.wakeDirection.value.set(Math.cos(heading), -Math.sin(heading)).normalize();
    this.highQualityMaterial.uniforms.wakeStrength.value = THREE.MathUtils.clamp(speedRatio, 0, 1);
  }
  addSplash(position: THREE.Vector3, energy: number) {
    const splash = this.splashes.reduce((oldest, candidate) => candidate.startedAt < oldest.startedAt ? candidate : oldest);
    splash.position.copy(position); splash.energy = THREE.MathUtils.clamp(energy, 0.15, 2); splash.startedAt = this.currentTime;
  }
  update(time: number, cameraPosition?: THREE.Vector3) {
    this.currentTime = time;
    this.highQualityMaterial.uniforms.time.value = time;
    const uniforms = this.highQualityMaterial.uniforms.splashes.value as THREE.Vector4[];
    this.splashes.forEach((splash, index) => uniforms[index].set(splash.position.x, splash.position.z, splash.startedAt, splash.energy));
    if (cameraPosition) {
      this.object.position.x = Math.round(cameraPosition.x / 120) * 120;
      this.object.position.z = Math.round(cameraPosition.z / 120) * 120;
    }
  }
  resize(_width: number, _height: number) {}
  dispose() { this.geometry.dispose(); this.standardMaterial.dispose(); this.highQualityMaterial.dispose(); this.neutralCloudVolume.dispose(); this.neutralCloudDetail.dispose(); }
}

export function createOceanSurface(): OceanSurface { return new WebglOcean(); }
