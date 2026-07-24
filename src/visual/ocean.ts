import * as THREE from "three";
import { AFTERNOON_SUN_DIRECTION } from "./sunlight";

export type OceanBackend = "webgl-cpu-waves" | "webgl-hq-gerstner" | "webgpu-fft";

export interface OceanSurface {
  readonly object: THREE.Object3D;
  readonly backend: OceanBackend;
  setHighQuality(enabled: boolean): void;
  setUltraCloudVolume(texture: THREE.Data3DTexture | null, detailTexture?: THREE.Texture | null): void;
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
      },
      glslVersion: THREE.GLSL3,
      vertexShader: `
        out vec3 vWorldPosition; out vec3 vWorldNormal; out float vCrest;
        uniform float time;
        vec3 wave(vec2 p,vec2 dir,float steep,float length,float speed,inout vec3 tangent,inout vec3 binormal){
          float k=6.283185/length;float phase=k*(dot(dir,p)-speed*time);float a=steep/k;
          float s=sin(phase),c=cos(phase);
          tangent+=vec3(-dir.x*dir.x*steep*s,dir.x*steep*c,-dir.x*dir.y*steep*s);
          binormal+=vec3(-dir.x*dir.y*steep*s,dir.y*steep*c,-dir.y*dir.y*steep*s);
          return vec3(dir.x*a*c,a*s,dir.y*a*c);
        }
        void main(){vec2 p=position.xy;vec3 tangent=vec3(1,0,0),binormal=vec3(0,0,1),offset=vec3(0);
          offset+=wave(p,normalize(vec2(.88,.34)),.31,52.,5.4,tangent,binormal);
          offset+=wave(p,normalize(vec2(.35,.94)),.20,24.,3.5,tangent,binormal);
          offset+=wave(p,normalize(vec2(-.62,.78)),.12,11.,2.1,tangent,binormal);
          offset+=wave(p,normalize(vec2(.96,-.27)),.06,4.8,1.2,tangent,binormal);
          vec3 displaced=vec3(position.x+offset.x,position.y+offset.z,offset.y);
          vec4 world=modelMatrix*vec4(displaced,1.);vWorldPosition=world.xyz;
          vWorldNormal=normalize(mat3(modelMatrix)*normalize(cross(binormal,tangent)));vCrest=smoothstep(.48,1.18,offset.y);
          gl_Position=projectionMatrix*viewMatrix*world;}
      `,
      fragmentShader: `
        precision highp float; in vec3 vWorldPosition;in vec3 vWorldNormal;in float vCrest;out vec4 outColor;
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
          glitter*=mix(1.,.46,coverage*ultraCloudMix);float foam=smoothstep(.88,1.0,vCrest)*smoothstep(.72,.94,microA*.55+microB*.45);vec3 color=mix(water,reflected,fresnel*.64)+sunColor*(glitter+broad)+vec3(.72,.84,.86)*foam*.34;
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
  update(time: number, cameraPosition?: THREE.Vector3) {
    this.highQualityMaterial.uniforms.time.value = time;
    if (cameraPosition) {
      this.object.position.x = Math.round(cameraPosition.x / 120) * 120;
      this.object.position.z = Math.round(cameraPosition.z / 120) * 120;
    }
  }
  resize(_width: number, _height: number) {}
  dispose() { this.geometry.dispose(); this.standardMaterial.dispose(); this.highQualityMaterial.dispose(); this.neutralCloudVolume.dispose(); this.neutralCloudDetail.dispose(); }
}

export function createOceanSurface(): OceanSurface { return new WebglOcean(); }
