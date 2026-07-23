import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export function createCinematicAtmospherePass() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      sunPosition: { value: new THREE.Vector2(0.5, 0.82) },
      godRayStrength: { value: 0 },
      chromaticAberration: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      precision highp float;varying vec2 vUv;uniform sampler2D tDiffuse;uniform vec2 sunPosition;uniform float godRayStrength;uniform float chromaticAberration;uniform vec2 resolution;
      vec3 sampleChromatic(vec2 uv){vec2 direction=normalize(uv-.5)/resolution;float shift=chromaticAberration*4.;return vec3(texture2D(tDiffuse,uv+direction*shift).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-direction*shift).b);}
      void main(){vec3 base=sampleChromatic(vUv);vec2 delta=(sunPosition-vUv)/28.;vec2 uv=vUv;float illumination=0.;float decay=1.;
        for(int i=0;i<28;i++){uv+=delta;vec3 s=texture2D(tDiffuse,clamp(uv,0.,1.)).rgb;float luminance=dot(s,vec3(.2126,.7152,.0722));float source=smoothstep(.38,.86,luminance);illumination+=source*decay;decay*=.94;}
        float radialFade=1.-smoothstep(.12,.9,length(vUv-sunPosition));float horizonFade=smoothstep(.02,.32,vUv.y);float rays=illumination/28.*godRayStrength*radialFade*horizonFade;
        vec3 rayColor=vec3(1.,.76,.48)*rays;vec3 color=base+rayColor;
        color=mix(vec3(dot(color,vec3(.2126,.7152,.0722))),color,1.08);color.r*=1.025;color.b*=.965;color=(color-.5)*1.045+.5;
        float vignette=smoothstep(.92,.28,length(vUv-.5));color*=mix(.86,1.,vignette);gl_FragColor=vec4(color,1.);}
    `,
  });
  pass.enabled = false;
  return pass;
}
