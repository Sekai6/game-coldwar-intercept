import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

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
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      sunPosition: { value: new THREE.Vector2(0.5, 0.82) },
      godRayStrength: { value: 0 },
      chromaticAberration: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      cinematicLut: { value: createCinematicLut(lutSize) },
      lutSize: { value: lutSize },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      precision highp float;varying vec2 vUv;uniform sampler2D tDiffuse;uniform sampler2D cinematicLut;uniform vec2 sunPosition;uniform float godRayStrength;uniform float chromaticAberration;uniform vec2 resolution;uniform float lutSize;
      vec3 sampleChromatic(vec2 uv){vec2 direction=normalize(uv-.5)/resolution;float shift=chromaticAberration*4.;return vec3(texture2D(tDiffuse,uv+direction*shift).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-direction*shift).b);}
      vec3 sampleLut(vec3 color){color=clamp(color,0.,1.);float blue=color.b*(lutSize-1.);float slice0=floor(blue),slice1=min(lutSize-1.,slice0+1.);float x0=(slice0*lutSize+color.r*(lutSize-1.)+.5)/(lutSize*lutSize);float x1=(slice1*lutSize+color.r*(lutSize-1.)+.5)/(lutSize*lutSize);float y=(color.g*(lutSize-1.)+.5)/lutSize;return mix(texture2D(cinematicLut,vec2(x0,y)).rgb,texture2D(cinematicLut,vec2(x1,y)).rgb,fract(blue));}
      float transmission(vec3 sampleColor){float luminance=dot(sampleColor,vec3(.2126,.7152,.0722));return smoothstep(.28,.78,luminance);}
      void main(){vec3 base=sampleChromatic(vUv);vec2 delta=(sunPosition-vUv)/28.;vec2 uv=vUv;float illumination=0.;float weight=0.;float decay=1.;
        for(int i=0;i<28;i++){uv+=delta;float source=transmission(texture2D(tDiffuse,clamp(uv,0.,1.)).rgb);illumination+=source*decay;weight+=decay;decay*=.945;}
        float localTransmission=transmission(base);float shafts=max(0.,illumination/max(weight,.001)-localTransmission*.72);float radialFade=1.-smoothstep(.12,.92,length(vUv-sunPosition));float horizonFade=smoothstep(.02,.3,vUv.y);float rays=min(.13,shafts*godRayStrength*.46*radialFade*horizonFade);
        vec3 rayColor=vec3(1.,.76,.48)*rays;float horizonBand=exp(-pow((vUv.y-.47)*7.5,2.));vec3 aerialPerspective=vec3(.43,.56,.64)*horizonBand*.045;vec3 color=sampleLut(base+rayColor+aerialPerspective);
        float vignette=smoothstep(.92,.28,length(vUv-.5));color*=mix(.86,1.,vignette);gl_FragColor=vec4(color,1.);}
    `,
  });
  pass.enabled = false;
  return pass;
}
