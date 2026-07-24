import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";

const LEVELS = 6;
const fullscreenVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;

function colorTarget() {
  return new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
}

function maskTarget() {
  return new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
  });
}

export class HiZScreenSpacePass extends Pass {
  private readonly pyramid = Array.from({ length: LEVELS }, colorTarget);
  private readonly occlusionTarget = colorTarget();
  private readonly reflectionTarget = colorTarget();
  private readonly geometryMaskTarget = maskTarget();
  private readonly geometryMaskMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  private readonly reduceMaterial: THREE.ShaderMaterial;
  private readonly occlusionMaterial: THREE.ShaderMaterial;
  private readonly reflectionMaterial: THREE.ShaderMaterial;
  private readonly compositeMaterial: THREE.ShaderMaterial;
  private readonly reduceQuad: FullScreenQuad;
  private readonly occlusionQuad: FullScreenQuad;
  private readonly reflectionQuad: FullScreenQuad;
  private readonly compositeQuad: FullScreenQuad;
  private requested = false;
  private effectsEnabled = true;
  private ssrEnabled = false;
  private levelsBuilt = 0;
  private sourceWidth = 1;
  private sourceHeight = 1;

  constructor(private readonly scene: THREE.Scene, depthTexture: THREE.DepthTexture, private camera: THREE.PerspectiveCamera) {
    super();
    this.reduceMaterial = new THREE.ShaderMaterial({
      uniforms: { source: { value: depthTexture }, sourceTexel: { value: new THREE.Vector2(1, 1) } },
      vertexShader: fullscreenVertex,
      fragmentShader: `
        precision highp float;varying vec2 vUv;uniform sampler2D source;uniform vec2 sourceTexel;
        void main(){vec2 o=sourceTexel*.5;float a=texture2D(source,vUv+vec2(-o.x,-o.y)).r;float b=texture2D(source,vUv+vec2(o.x,-o.y)).r;float c=texture2D(source,vUv+vec2(-o.x,o.y)).r;float d=texture2D(source,vUv+vec2(o.x,o.y)).r;float z=min(min(a,b),min(c,d));gl_FragColor=vec4(z,z,z,1.);}
      `,
      depthTest: false,
      depthWrite: false,
    });

    const shared: Record<string, THREE.IUniform> = {
      tDepth: { value: depthTexture },
      inverseProjection: { value: camera.projectionMatrixInverse.clone() },
      inverseView: { value: camera.matrixWorld.clone() },
      projection: { value: camera.projectionMatrix.clone() },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
      sunScreenDirection: { value: new THREE.Vector2(-0.72, 0.48).normalize() },
      tGeometryMask: { value: this.geometryMaskTarget.texture },
    };
    this.pyramid.forEach((target, index) => { shared[`hiz${index}`] = { value: target.texture }; });
    this.occlusionMaterial = new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: fullscreenVertex,
      fragmentShader: `
        precision highp float;varying vec2 vUv;uniform sampler2D tDepth;uniform sampler2D tGeometryMask;uniform sampler2D hiz0;uniform sampler2D hiz1;uniform sampler2D hiz2;uniform mat4 inverseProjection;uniform mat4 inverseView;uniform vec2 resolution;uniform float cameraNear;uniform float cameraFar;uniform vec2 sunScreenDirection;
        float hiz(vec2 uv,int level){if(level==2)return texture2D(hiz2,uv).r;if(level==1)return texture2D(hiz1,uv).r;return texture2D(hiz0,uv).r;}
        float distanceFromDepth(float depth){float z=(cameraNear*cameraFar)/((cameraFar-cameraNear)*depth-cameraFar);return max(0.,-z);}
        vec3 positionFromDepth(vec2 uv,float depth){vec4 p=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/max(p.w,.0001);}
        void main(){
          float depth=texture2D(tDepth,vUv).r;if(depth>.9998){gl_FragColor=vec4(0.);return;}
          vec2 texel=1./resolution;vec4 normalSample=texture2D(tGeometryMask,vUv);float geometryMask=normalSample.a;if(geometryMask<.5){gl_FragColor=vec4(0.);return;}vec3 centerNormal=normalize(normalSample.rgb*2.-1.);float center=distanceFromDepth(depth);
          vec3 centerPosition=positionFromDepth(vUv,depth);float ao=0.;for(int i=0;i<8;i++){float angle=float(i)*2.399963;float radius=2.+float(i)*1.55;int level=i<3?0:(i<6?1:2);vec2 sampleUv=vUv+vec2(cos(angle),sin(angle))*texel*radius;float conservativeDelta=center-distanceFromDepth(hiz(sampleUv,level));float candidate=step(.04,conservativeDelta)*(1.-smoothstep(7.,15.,conservativeDelta));float sampleDepth=texture2D(tDepth,sampleUv).r;vec3 samplePosition=positionFromDepth(sampleUv,sampleDepth);vec3 toSample=samplePosition-centerPosition;float sampleDistance=length(toSample);float hemisphere=max(dot(centerNormal,normalize(toSample))-.08,0.);vec4 neighborSample=texture2D(tGeometryMask,sampleUv);float valid=candidate*hemisphere*neighborSample.a*(1.-smoothstep(4.,18.,sampleDistance));ao+=valid*(1.-float(i)/12.);}
          ao=clamp(ao/2.25,0.,1.)*geometryMask;
          float contact=0.;for(int i=1;i<=8;i++){float travel=float(i)*2.;int level=i<4?0:(i<7?1:2);float delta=center-distanceFromDepth(hiz(vUv+sunScreenDirection*texel*travel,level));float valid=smoothstep(.035,.5,delta)*(1.-smoothstep(4.,10.,delta));contact=max(contact,valid*exp(-float(i)*.14));}
          gl_FragColor=vec4(ao,contact*geometryMask,geometryMask,1.);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.reflectionMaterial = new THREE.ShaderMaterial({
      uniforms: { ...shared, tScene: { value: null } },
      vertexShader: fullscreenVertex,
      fragmentShader: `
        precision highp float;varying vec2 vUv;uniform sampler2D tScene;uniform sampler2D tDepth;uniform sampler2D tGeometryMask;uniform sampler2D hiz0;uniform sampler2D hiz1;uniform sampler2D hiz2;uniform sampler2D hiz3;uniform mat4 inverseProjection;uniform mat4 projection;uniform vec2 resolution;
        vec3 positionFromDepth(vec2 uv,float depth){vec4 p=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/max(p.w,.0001);}
        float hiz(vec2 uv,int level){if(level==3)return texture2D(hiz3,uv).r;if(level==2)return texture2D(hiz2,uv).r;if(level==1)return texture2D(hiz1,uv).r;return texture2D(hiz0,uv).r;}
        void main(){
          float depth=texture2D(tDepth,vUv).r;float geometry=texture2D(tGeometryMask,vUv).a;if(depth>.9998||geometry>.25){gl_FragColor=vec4(0.);return;}
          vec2 texel=1./resolution;vec3 origin=positionFromDepth(vUv,depth);vec3 px=positionFromDepth(vUv+vec2(texel.x,0.),texture2D(tDepth,vUv+vec2(texel.x,0.)).r);vec3 py=positionFromDepth(vUv+vec2(0.,texel.y),texture2D(tDepth,vUv+vec2(0.,texel.y)).r);vec3 normal=normalize(cross(px-origin,py-origin));if(normal.z>0.)normal=-normal;vec3 viewRay=normalize(origin);vec3 ray=normalize(reflect(viewRay,normal));
          if(ray.z>=-.015){gl_FragColor=vec4(0.);return;}vec2 hitUv=vec2(0.);float hitConfidence=0.;float previousTravel=max(.8,-origin.z*.0025);float travel=previousTravel;
          for(int i=1;i<=40;i++){
            travel=max(travel+max(1.15,-origin.z*.0035),travel*1.115);vec3 point=origin+ray*travel;if(point.z>=-.05)break;vec4 clip=projection*vec4(point,1.);if(clip.w<=0.)break;vec2 uv=clip.xy/clip.w*.5+.5;if(uv.x<.015||uv.x>.985||uv.y<.015||uv.y>.985)break;
            int level=i<10?3:(i<20?2:(i<31?1:0));float coarseDepth=hiz(uv,level);vec3 coarsePosition=positionFromDepth(uv,coarseDepth);float conservativeBehind=coarsePosition.z-point.z;
            if(conservativeBehind>-.5){
              float fullDepth=texture2D(tDepth,uv).r;vec3 fullPosition=positionFromDepth(uv,fullDepth);float fullBehind=fullPosition.z-point.z;float targetGeometry=texture2D(tGeometryMask,uv).a;
              if(fullBehind>=-.2&&targetGeometry>.25){
                float lo=previousTravel,hi=travel;for(int refine=0;refine<5;refine++){float mid=(lo+hi)*.5;vec3 probe=origin+ray*mid;vec4 probeClip=projection*vec4(probe,1.);vec2 probeUv=probeClip.xy/probeClip.w*.5+.5;vec3 scenePosition=positionFromDepth(probeUv,texture2D(tDepth,probeUv).r);if(scenePosition.z-probe.z>=0.)hi=mid;else lo=mid;hitUv=probeUv;}
                vec3 finalPoint=origin+ray*hi;vec3 finalScene=positionFromDepth(hitUv,texture2D(tDepth,hitUv).r);float thickness=finalScene.z-finalPoint.z;targetGeometry=texture2D(tGeometryMask,hitUv).a;float edge=min(min(hitUv.x,1.-hitUv.x),min(hitUv.y,1.-hitUv.y));hitConfidence=(1.-smoothstep(.15,3.5,max(thickness,0.)))*smoothstep(.015,.1,edge)*targetGeometry*(1.-float(i)/48.);if(hitConfidence>.02)break;
              }
            }previousTravel=travel;
          }
          float fresnel=pow(1.-max(dot(-viewRay,normal),0.),3.);vec2 blur=texel*vec2(6.5,2.8)*(1.+length(hitUv-vUv)*3.);vec3 reflected=texture2D(tScene,hitUv).rgb*.24;reflected+=texture2D(tScene,hitUv+vec2(blur.x,0.)).rgb*.22;reflected+=texture2D(tScene,hitUv-vec2(blur.x,0.)).rgb*.22;reflected+=texture2D(tScene,hitUv+vec2(0.,blur.y)).rgb*.16;reflected+=texture2D(tScene,hitUv-vec2(0.,blur.y)).rgb*.16;float shorelineFade=1.-smoothstep(.12,.42,length(hitUv-vUv));gl_FragColor=vec4(reflected,hitConfidence*shorelineFade*(.12+.58*fresnel));
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tOcclusion: { value: this.occlusionTarget.texture }, tReflection: { value: this.reflectionTarget.texture }, resolution: { value: new THREE.Vector2(1, 1) }, effectMix: { value: 1 }, aoMix: { value: 1 }, contactMix: { value: 1 }, ssrMix: { value: 1 }, debugOutput: { value: 0 } },
      vertexShader: fullscreenVertex,
      fragmentShader: `precision highp float;varying vec2 vUv;uniform sampler2D tDiffuse;uniform sampler2D tOcclusion;uniform sampler2D tReflection;uniform vec2 resolution;uniform float effectMix;uniform float aoMix;uniform float contactMix;uniform float ssrMix;uniform float debugOutput;void main(){vec3 base=texture2D(tDiffuse,vUv).rgb;vec3 occ=texture2D(tOcclusion,vUv).rgb;vec4 rawReflection=texture2D(tReflection,vUv);if(debugOutput>1.5){gl_FragColor=vec4(rawReflection.rgb*rawReflection.a+vec3(rawReflection.a),1.);return;}if(debugOutput>.5){gl_FragColor=vec4(occ,1.);return;}float attenuation=occ.r*.3*aoMix+occ.g*.16*contactMix;vec2 texel=1./resolution;vec4 reflection=rawReflection*.24;reflection+=texture2D(tReflection,vUv+vec2(texel.x*3.,0.))*.22;reflection+=texture2D(tReflection,vUv-vec2(texel.x*3.,0.))*.22;reflection+=texture2D(tReflection,vUv+vec2(0.,texel.y*2.))*.16;reflection+=texture2D(tReflection,vUv-vec2(0.,texel.y*2.))*.16;vec3 shaded=base*(1.-attenuation*effectMix);vec3 reflectedEnergy=mix(base,reflection.rgb,.8);float reflectionWeight=smoothstep(.002,.06,reflection.a)*.48;gl_FragColor=vec4(mix(shaded,reflectedEnergy,reflectionWeight*ssrMix*effectMix),1.);}`,
      depthTest: false,
      depthWrite: false,
    });
    this.reduceQuad = new FullScreenQuad(this.reduceMaterial);
    this.occlusionQuad = new FullScreenQuad(this.occlusionMaterial);
    this.reflectionQuad = new FullScreenQuad(this.reflectionMaterial);
    this.compositeQuad = new FullScreenQuad(this.compositeMaterial);
    this.enabled = false;
  }

  setRequested(requested: boolean) { this.requested = requested; this.enabled = requested; }
  setEffectsEnabled(enabled: boolean) { this.effectsEnabled = enabled; this.compositeMaterial.uniforms.effectMix.value = enabled ? 1 : 0; }
  setDebugOutput(mode: "off" | "occlusion" | "reflection") { this.compositeMaterial.uniforms.debugOutput.value = mode === "reflection" ? 2 : mode === "occlusion" ? 1 : 0; }
  setConsumerMix(ao: boolean, contact: boolean) {
    this.compositeMaterial.uniforms.aoMix.value = ao ? 1 : 0;
    this.compositeMaterial.uniforms.contactMix.value = contact ? 1 : 0;
  }
  setSsrEnabled(enabled: boolean) { this.ssrEnabled = enabled; this.compositeMaterial.uniforms.ssrMix.value = enabled ? 1 : 0; }

  setCamera(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.occlusionMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.occlusionMaterial.uniforms.inverseView.value.copy(camera.matrixWorld);
    this.reflectionMaterial.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.reflectionMaterial.uniforms.projection.value.copy(camera.projectionMatrix);
    this.occlusionMaterial.uniforms.cameraNear.value = camera.near;
    this.occlusionMaterial.uniforms.cameraFar.value = camera.far;
  }

  setSize(width: number, height: number) {
    this.sourceWidth = width;
    this.sourceHeight = height;
    let w = Math.max(1, Math.floor(width / 2));
    let h = Math.max(1, Math.floor(height / 2));
    this.occlusionTarget.setSize(w, h);
    this.reflectionTarget.setSize(w, h);
    this.geometryMaskTarget.setSize(w, h);
    for (const target of this.pyramid) {
      target.setSize(w, h);
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }
    this.occlusionMaterial.uniforms.resolution.value.set(width, height);
    this.compositeMaterial.uniforms.resolution.value.set(width, height);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    if (!this.requested) return;
    const oldTarget = renderer.getRenderTarget();
    const oldViewport = renderer.getViewport(new THREE.Vector4()).clone();
    const oldScissor = renderer.getScissor(new THREE.Vector4()).clone();
    const oldScissorTest = renderer.getScissorTest();
    const oldClearColor = renderer.getClearColor(new THREE.Color()).clone();
    const oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setScissorTest(false);

    for (let level = 0; level < LEVELS; level++) {
      const source = level === 0 ? this.occlusionMaterial.uniforms.tDepth.value : this.pyramid[level - 1].texture;
      const sourceWidth = level === 0 ? this.sourceWidth : this.pyramid[level - 1].width;
      const sourceHeight = level === 0 ? this.sourceHeight : this.pyramid[level - 1].height;
      this.reduceMaterial.uniforms.source.value = source;
      this.reduceMaterial.uniforms.sourceTexel.value.set(1 / sourceWidth, 1 / sourceHeight);
      const target = this.pyramid[level];
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, target.width, target.height);
      renderer.setClearColor(1, 1);
      renderer.clear(true, false, false);
      this.reduceQuad.render(renderer);
    }
    this.levelsBuilt = LEVELS;

    const previousOverride = this.scene.overrideMaterial;
    const hidden: THREE.Object3D[] = [];
    this.scene.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const exclude = object.userData.screenSpaceWater || object instanceof THREE.Line || object instanceof THREE.Points || materials.some(material => material.transparent || material.opacity < 0.999 || material.depthWrite === false);
      if (!exclude) return;
      hidden.push(object);
      object.visible = false;
    });
    this.scene.overrideMaterial = this.geometryMaskMaterial;
    renderer.setRenderTarget(this.geometryMaskTarget);
    renderer.setViewport(0, 0, this.geometryMaskTarget.width, this.geometryMaskTarget.height);
    renderer.setClearColor(0, 0);
    renderer.clear(true, true, false);
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = previousOverride;
    hidden.forEach(object => { object.visible = true; });

    renderer.setRenderTarget(this.occlusionTarget);
    renderer.setViewport(0, 0, this.occlusionTarget.width, this.occlusionTarget.height);
    renderer.setClearColor(0, 1);
    renderer.clear(true, false, false);
    this.occlusionQuad.render(renderer);

    this.reflectionMaterial.uniforms.tScene.value = readBuffer.texture;
    renderer.setRenderTarget(this.reflectionTarget);
    renderer.setViewport(0, 0, this.reflectionTarget.width, this.reflectionTarget.height);
    renderer.setClearColor(0, 0);
    renderer.clear(true, false, false);
    this.reflectionQuad.render(renderer);

    this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    const destination = this.renderToScreen ? null : writeBuffer;
    renderer.setRenderTarget(destination);
    renderer.setViewport(0, 0, this.renderToScreen ? renderer.domElement.width : writeBuffer.width, this.renderToScreen ? renderer.domElement.height : writeBuffer.height);
    if (this.clear) renderer.clear(true, false, false);
    this.compositeQuad.render(renderer);

    renderer.setRenderTarget(oldTarget);
    renderer.setViewport(oldViewport);
    renderer.setScissor(oldScissor);
    renderer.setScissorTest(oldScissorTest);
    renderer.setClearColor(oldClearColor, oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }

  get diagnostics() { return { levels: this.levelsBuilt, consumers: this.requested && this.effectsEnabled ? 2 + Number(this.ssrEnabled) : 0 }; }

  dispose() {
    this.pyramid.forEach(target => target.dispose());
    this.occlusionTarget.dispose();
    this.reflectionTarget.dispose();
    this.geometryMaskTarget.dispose();
    this.geometryMaskMaterial.dispose();
    this.reduceMaterial.dispose();
    this.occlusionMaterial.dispose();
    this.reflectionMaterial.dispose();
    this.compositeMaterial.dispose();
    this.reduceQuad.dispose();
    this.occlusionQuad.dispose();
    this.reflectionQuad.dispose();
    this.compositeQuad.dispose();
  }
}
