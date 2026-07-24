import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const neutralScatterByPass = new WeakMap<ShaderPass, THREE.Texture>();
const neutralFroxelByPass = new WeakMap<ShaderPass, THREE.Texture>();

function createCinematicLut(size = 16) {
  const data = new Uint8Array(size * size * size * 4);
  for (let blue = 0; blue < size; blue++) {
    for (let green = 0; green < size; green++) {
      for (let red = 0; red < size; red++) {
        const source = new THREE.Color(red / (size - 1), green / (size - 1), blue / (size - 1));
        const luminance = source.r * 0.2126 + source.g * 0.7152 + source.b * 0.0722;
        source.r = luminance + (source.r - luminance) * 1.08;
        source.g = luminance + (source.g - luminance) * 1.08;
        source.b = luminance + (source.b - luminance) * 1.08;
        source.r = (source.r - 0.5) * 1.045 + 0.5;
        source.g = (source.g - 0.5) * 1.045 + 0.5;
        source.b = (source.b - 0.5) * 1.045 + 0.5;
        source.r *= 1.025;
        source.b *= 0.965;
        const offset = (red + blue * size + green * size * size) * 4;
        data[offset] = THREE.MathUtils.clamp(source.r, 0, 1) * 255;
        data[offset + 1] = THREE.MathUtils.clamp(source.g, 0, 1) * 255;
        data[offset + 2] = THREE.MathUtils.clamp(source.b, 0, 1) * 255;
        data[offset + 3] = 255;
      }
    }
  }
  const texture = new THREE.DataTexture(data, size * size, size, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createCinematicAtmospherePass() {
  const lutSize = 16;
  const neutralScatter = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  neutralScatter.needsUpdate = true;
  const neutralFroxel = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  neutralFroxel.needsUpdate = true;
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      sunPosition: { value: new THREE.Vector2(0.5, 0.82) },
      godRayStrength: { value: 0 },
      chromaticAberration: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      cinematicLut: { value: createCinematicLut(lutSize) },
      lutSize: { value: lutSize },
      ultraScatter: { value: neutralScatter },
      ultraScatterMix: { value: 0 },
      ultraTime: { value: 0 },
      tDepth: { value: null },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 2000 },
      froxelAtlas: { value: neutralFroxel },
      froxelMix: { value: 0 },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      precision highp float;varying vec2 vUv;uniform sampler2D tDiffuse;uniform sampler2D cinematicLut;uniform sampler2D ultraScatter;uniform sampler2D froxelAtlas;uniform sampler2D tDepth;uniform vec2 sunPosition;uniform float godRayStrength;uniform float chromaticAberration;uniform vec2 resolution;uniform float lutSize;uniform float ultraScatterMix;uniform float ultraTime;uniform float cameraNear;uniform float cameraFar;uniform float froxelMix;
      vec3 sampleChromatic(vec2 uv){vec2 direction=normalize(uv-.5)/resolution;float shift=chromaticAberration*4.;return vec3(texture2D(tDiffuse,uv+direction*shift).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-direction*shift).b);}
      vec3 sampleLut(vec3 color){color=clamp(color,0.,1.);float blue=color.b*(lutSize-1.);float slice0=floor(blue),slice1=min(lutSize-1.,slice0+1.);float x0=(slice0*lutSize+color.r*(lutSize-1.)+.5)/(lutSize*lutSize);float x1=(slice1*lutSize+color.r*(lutSize-1.)+.5)/(lutSize*lutSize);float y=(color.g*(lutSize-1.)+.5)/lutSize;return mix(texture2D(cinematicLut,vec2(x0,y)).rgb,texture2D(cinematicLut,vec2(x1,y)).rgb,fract(blue));}
      float transmission(vec3 sampleColor){float luminance=dot(sampleColor,vec3(.2126,.7152,.0722));return smoothstep(.28,.78,luminance);}
      float viewDistance(float depth){float viewZ=(cameraNear*cameraFar)/((cameraFar-cameraNear)*depth-cameraFar);return max(0.,-viewZ);}
      vec4 sampleFroxel(vec2 uv,float distance){float layer=clamp(sqrt(distance/900.)*31.,0.,31.);float z0=floor(layer),z1=min(31.,z0+1.);vec2 tile0=vec2(mod(z0,8.),floor(z0/8.)),tile1=vec2(mod(z1,8.),floor(z1/8.));vec2 local=clamp(uv,0.,1.);vec2 atlas0=(tile0+local)/vec2(8.,4.);vec2 atlas1=(tile1+local)/vec2(8.,4.);return mix(texture2D(froxelAtlas,atlas0),texture2D(froxelAtlas,atlas1),fract(layer));}
      vec4 integrateFroxel(vec2 uv,float distance){vec4 integrated=vec4(0.);float transmission=1.;for(int i=1;i<=8;i++){float segment=distance*(float(i)/8.);vec4 sampleValue=sampleFroxel(uv,segment);integrated.rgb+=transmission*sampleValue.rgb*.11;transmission*=exp(-sampleValue.a*.035);}integrated.a=1.-transmission;return integrated;}
      void main(){vec3 base=sampleChromatic(vUv);vec2 delta=(sunPosition-vUv)/28.;vec2 uv=vUv;float illumination=0.;float weight=0.;float decay=1.;
        for(int i=0;i<28;i++){uv+=delta;float source=transmission(texture2D(tDiffuse,clamp(uv,0.,1.)).rgb);illumination+=source*decay;weight+=decay;decay*=.945;}
        vec3 scatter=texture2D(ultraScatter,vec2(fract(vUv.x*.72+ultraTime*.0007),clamp(vUv.y*.82+.08,0.,1.))).rgb;float localTransmission=transmission(base);float shafts=max(0.,illumination/max(weight,.001)-localTransmission*.72);float radialFade=1.-smoothstep(.12,.92,length(vUv-sunPosition));float horizonFade=smoothstep(.02,.3,vUv.y);float ultraShaft=mix(1.,.82+scatter.g*.42,ultraScatterMix);float rays=min(.13,shafts*godRayStrength*.46*radialFade*horizonFade*ultraShaft);
        vec3 rayColor=vec3(1.,.76,.48)*rays;float horizonBand=exp(-pow((vUv.y-.47)*7.5,2.));float sceneDepth=texture2D(tDepth,vUv).x;float distance=viewDistance(sceneDepth);float geometryMask=1.-smoothstep(.9985,1.,sceneDepth);float distanceFog=smoothstep(180.,760.,min(distance,900.))*geometryMask*ultraScatterMix;float scatterModulation=.62+scatter.r*.16;float ultraFog=distanceFog*scatter.r*(1.-scatter.b*.28)*.008;vec4 froxel=integrateFroxel(vUv,min(distance,900.));float froxelRange=smoothstep(8.,260.,distance)*geometryMask;vec3 fogColor=vec3(.43,.56,.64);vec3 atmospheric=mix(base+rayColor,fogColor,distanceFog*scatterModulation*(.08+scatter.b*.04));vec3 froxelResolved=atmospheric*exp(-froxel.a*.34)+froxel.rgb*.68;atmospheric=mix(atmospheric,froxelResolved,froxelMix*froxelRange);vec3 aerialPerspective=fogColor*(horizonBand*.018+ultraFog);vec3 color=sampleLut(atmospheric+aerialPerspective);
        float vignette=smoothstep(.92,.28,length(vUv-.5));color*=mix(.86,1.,vignette);gl_FragColor=vec4(color,1.);}
    `,
  });
  pass.enabled = false;
  neutralScatterByPass.set(pass, neutralScatter);
  neutralFroxelByPass.set(pass, neutralFroxel);
  return pass;
}

export function setCinematicFroxel(pass: ShaderPass, texture: THREE.Texture | null) {
  pass.uniforms.froxelAtlas.value = texture ?? neutralFroxelByPass.get(pass);
  pass.uniforms.froxelMix.value = texture ? 1 : 0;
}

export function setCinematicUltraScatter(pass: ShaderPass, texture: THREE.Texture | null) {
  pass.uniforms.ultraScatter.value = texture ?? neutralScatterByPass.get(pass);
  pass.uniforms.ultraScatterMix.value = texture ? 1 : 0;
}

export function setCinematicDepth(pass: ShaderPass, texture: THREE.DepthTexture, camera: THREE.PerspectiveCamera) {
  pass.uniforms.tDepth.value = texture;
  pass.uniforms.cameraNear.value = camera.near;
  pass.uniforms.cameraFar.value = camera.far;
}
