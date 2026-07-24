import * as THREE from "three";
import { AFTERNOON_SUN_DIRECTION } from "./sunlight";

export interface HighQualityEnvironment {
  readonly object: THREE.Group;
  readonly cloudCount: number;
  readonly fogVolumeCount: number;
  setEnabled(enabled: boolean): void;
  setUltraDetail(texture: THREE.Texture | null, volumeTexture?: THREE.Data3DTexture | null): void;
  update(time: number, cameraPosition: THREE.Vector3): void;
  dispose(): void;
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.731 + salt * 17.137) * 43758.5453;
  return value - Math.floor(value);
}

export function createHighQualityEnvironment(): HighQualityEnvironment {
  const object = new THREE.Group();
  object.name = "high-quality-environment";
  const atmosphericSunDirection = AFTERNOON_SUN_DIRECTION.clone();

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x173c68) },
      horizonColor: { value: new THREE.Color(0x7899ac) },
      sunColor: { value: new THREE.Color(0xffd6a0) },
      sunDirection: { value: atmosphericSunDirection },
    },
    vertexShader: `varying vec3 vDirection; void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec3 vDirection;uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 sunColor;uniform vec3 sunDirection;
      void main(){
        vec3 viewDir=normalize(vDirection);float mu=max(dot(viewDir,sunDirection),0.0);
        float altitude=clamp(viewDir.y*.5+.5,0.0,1.0);
        float rayleighPhase=.75*(1.0+mu*mu);
        float g=.76;float miePhase=(1.0-g*g)/(4.0*3.14159*pow(max(.035,1.0+g*g-2.0*g*mu),1.5));
        float opticalDepth=exp(-max(viewDir.y,0.0)*3.4);
        vec3 zenith=mix(horizonColor,topColor,smoothstep(.08,.78,altitude));
        vec3 rayleigh=vec3(.18,.38,.72)*rayleighPhase*(.18+.56*opticalDepth);
        vec3 mie=sunColor*miePhase*(.12+.7*opticalDepth);
        float disk=smoothstep(.99972,.99991,mu),halo=pow(mu,72.0)*.72;
        vec3 color=zenith+rayleigh*.72+mie*.62+sunColor*(disk*4.8+halo*.7);
        color+=vec3(.22,.3,.36)*pow(1.0-altitude,5.0);
        gl_FragColor=vec4(color,1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1450, 32, 20), skyMaterial);
  sky.frustumCulled = false;
  object.add(sky);

  const cloudGeometry = new THREE.SphereGeometry(1, 24, 16);
  const neutralDetail = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
  neutralDetail.needsUpdate = true;
  const neutralVolume = new THREE.Data3DTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, 1);
  neutralVolume.format = THREE.RGBAFormat;
  neutralVolume.needsUpdate = true;
  const cloudCount = 16;
  const cloudVolumes: THREE.Mesh[] = [];
  const cloudMaterials: THREE.ShaderMaterial[] = [];
  const cloudOrigins: THREE.Vector3[] = [];
  for (let index = 0; index < cloudCount; index++) {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        cameraLocal: { value: new THREE.Vector3() },
        time: { value: 0 },
        seed: { value: seeded(index, 20) * 80 },
        proximityFade: { value: 1 },
        sunDirection: { value: atmosphericSunDirection },
        ultraDetail: { value: neutralDetail },
        ultraVolume: { value: neutralVolume },
        ultraMix: { value: 0 },
      },
      glslVersion: THREE.GLSL3,
      vertexShader: `out vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `
        precision highp float;
        in vec3 vLocal; out vec4 outColor; uniform vec3 cameraLocal; uniform float time; uniform float seed; uniform float proximityFade; uniform vec3 sunDirection; uniform sampler2D ultraDetail; uniform sampler3D ultraVolume; uniform float ultraMix;
        float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
        float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        float fbm(vec3 p){float n=0.,a=.55;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec3(7.1,3.7,5.9);a*=.5;}return n;}
        vec4 volumeSample(vec3 p){vec3 uv=vec3(fract(p.x*.5+.5+seed*.013+time*.0007),clamp(p.y*.5+.5,0.,1.),fract(p.z*.5+.5+seed*.021-time*.0004));return texture(ultraVolume,uv);}
        float density(vec3 p){float radial=length(p*vec3(.82,1.55,.82));float base=fbm(p*2.25+vec3(time*.012,seed,time*.006));float procedural=fbm(p*6.2-vec3(time*.018,seed*.3,0.));vec2 detailUv=p.xz*1.7+vec2(seed*.017,time*.002);float gpuDetail=texture(ultraDetail,detailUv).r;vec4 volume=volumeSample(p);float irregularEdge=1.-smoothstep(.5+procedural*.13+gpuDetail*.06,.94+base*.05,radial);float detail=mix(procedural,gpuDetail,ultraMix*.45);float proceduralDensity=max(0.,(base*.74+detail*.26-.445)*3.55);float volumeCoverage=smoothstep(.035,.42,volume.r-volume.g*.16);float macroModulation=mix(1.,.74+volumeCoverage*.42,ultraMix);float erosion=mix(1.,smoothstep(.16,.78,procedural*.78+gpuDetail*.22),ultraMix*.16);return proceduralDensity*macroModulation*irregularEdge*erosion;}
        void main(){vec3 ray=normalize(vLocal-cameraLocal);vec3 p=cameraLocal;vec3 inv=1./ray;vec3 t0=(-vec3(1.)-p)*inv,t1=(vec3(1.)-p)*inv;vec3 tn=min(t0,t1),tf=max(t0,t1);float nearT=max(max(tn.x,tn.y),tn.z),farT=min(min(tf.x,tf.y),tf.z);nearT=max(nearT,0.);if(farT<=nearT)discard;float stepSize=(farT-nearT)/32.;float stableJitter=fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)));float trans=1.;vec3 color=vec3(0.);for(int i=0;i<32;i++){vec3 q=p+ray*(nearT+(float(i)+stableJitter)*stepSize);float d=density(q);if(d>.005){float lightD=density(q+normalize(sunDirection)*.075);float computedLight=exp(-lightD*4.8);float volumeLight=volumeSample(q).b;float light=mix(.2,.94,mix(computedLight,volumeLight,ultraMix*.72));float powder=(1.-exp(-d*2.8))*exp(-lightD*.8);float forwardSilver=pow(max(dot(ray,-normalize(sunDirection)),0.),7.)*(1.-trans);float alpha=1.-exp(-d*stepSize*3.15);vec3 cloudColor=mix(vec3(.18,.28,.38),vec3(1.04,.95,.79),clamp(light+powder*.16+forwardSilver*.24,0.,1.));color+=trans*alpha*cloudColor;trans*=1.-alpha;if(trans<.018)break;}}float opacity=(1.-trans)*proximityFade;if(opacity<.012)discard;outColor=vec4(color/max(1.-trans,.001),min(.97,opacity));}
      `,
    });
    const cloud = new THREE.Mesh(cloudGeometry, material);
    cloud.position.set((seeded(index, 1) - 0.5) * 1000, 132 + seeded(index, 2) * 72, (seeded(index, 3) - 0.5) * 1000);
    cloud.scale.set(58 + seeded(index, 4) * 72, 17 + seeded(index, 5) * 18, 48 + seeded(index, 6) * 68);
    cloud.rotation.y = seeded(index, 7) * Math.PI;
    cloud.renderOrder = -5;
    cloudOrigins.push(cloud.position.clone());
    cloudVolumes.push(cloud); cloudMaterials.push(material); object.add(cloud);
  }

  // Continuous scene fog replaces intersecting fog meshes, which exposed hull edges near the camera.
  const fogVolumeCount = 0;
  object.visible = false;

  return {
    object,
    cloudCount,
    fogVolumeCount,
    setEnabled: (enabled) => { object.visible = enabled; },
    setUltraDetail: (texture, volumeTexture) => {
      cloudMaterials.forEach((material) => {
        material.uniforms.ultraDetail.value = texture ?? neutralDetail;
        material.uniforms.ultraVolume.value = volumeTexture ?? neutralVolume;
        material.uniforms.ultraMix.value = texture && volumeTexture ? 1 : 0;
      });
    },
    update: (time, cameraPosition) => {
      if (!object.visible) return;
      sky.position.copy(cameraPosition);
      cloudVolumes.forEach((cloud, index) => {
        const origin = cloudOrigins[index];
        const windDistance = time * (0.72 + (index % 3) * 0.12);
        cloud.position.x = THREE.MathUtils.euclideanModulo(origin.x + windDistance + 700, 1400) - 700;
        cloud.position.z = origin.z + Math.sin(time * 0.006 + index * 1.7) * 3.5;
        cloud.updateMatrixWorld();
        cloudMaterials[index].uniforms.time.value = time;
        const localCamera = cloud.worldToLocal(cameraPosition.clone());
        cloudMaterials[index].uniforms.cameraLocal.value.copy(localCamera);
        const boxDistance = Math.max(Math.abs(localCamera.x), Math.abs(localCamera.y), Math.abs(localCamera.z));
        cloudMaterials[index].uniforms.proximityFade.value = THREE.MathUtils.smoothstep(boxDistance, 1.35, 2.35);
      });
    },
    dispose: () => {
      sky.geometry.dispose(); skyMaterial.dispose();
      cloudGeometry.dispose(); neutralDetail.dispose(); neutralVolume.dispose(); cloudMaterials.forEach((material) => material.dispose());
    },
  };
}
