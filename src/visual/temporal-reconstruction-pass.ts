import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";

export class TemporalReconstructionPass extends Pass {
  private readonly historyTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  private readonly resolvedTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  private readonly velocityTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: true,
  });
  private readonly resolveMaterial: THREE.ShaderMaterial;
  private readonly velocityMaterial: THREE.ShaderMaterial;
  private readonly copyMaterial: THREE.ShaderMaterial;
  private readonly displayMaterial: THREE.ShaderMaterial;
  private readonly resolveQuad: FullScreenQuad;
  private readonly copyQuad: FullScreenQuad;
  private readonly displayQuad: FullScreenQuad;
  private readonly previousModelMatrices = new WeakMap<THREE.Object3D, THREE.Matrix4>();
  private readonly previousViewProjection = new THREE.Matrix4();
  private readonly inverseViewProjection = new THREE.Matrix4();
  private readonly previousCameraPosition = new THREE.Vector3();
  private readonly previousCameraQuaternion = new THREE.Quaternion();
  private requested = false;
  private valid = false;
  private resetCount = 0;
  private historyFrames = 0;
  private trackedObjects = 0;
  private jitterIndex = 0;
  private readonly unjitteredProjection = new THREE.Matrix4();
  private jitterApplied = false;

  constructor(
    private readonly scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    depthTexture: THREE.DepthTexture,
  ) {
    super();
    this.velocityMaterial = new THREE.ShaderMaterial({
      uniforms: {
        previousModelMatrix: { value: new THREE.Matrix4() },
        previousViewProjection: { value: this.previousViewProjection },
      },
      vertexShader: `
        uniform mat4 previousModelMatrix;uniform mat4 previousViewProjection;varying vec4 vCurrentClip;varying vec4 vPreviousClip;
        void main(){vec4 local=vec4(position,1.);vCurrentClip=projectionMatrix*modelViewMatrix*local;vPreviousClip=previousViewProjection*previousModelMatrix*local;gl_Position=vCurrentClip;}
      `,
      fragmentShader: `
        precision highp float;varying vec4 vCurrentClip;varying vec4 vPreviousClip;
        void main(){vec2 current=vCurrentClip.xy/max(vCurrentClip.w,.0001)*.5+.5;vec2 previous=vPreviousClip.xy/max(vPreviousClip.w,.0001)*.5+.5;vec2 velocity=current-previous;gl_FragColor=vec4(velocity*.5+.5,0.,1.);}
      `,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.velocityMaterial.onBeforeRender = (_renderer, _scene, _camera, _geometry, object) => {
      const previous = this.previousModelMatrices.get(object) ?? object.matrixWorld;
      this.velocityMaterial.uniforms.previousModelMatrix.value.copy(previous);
    };
    this.resolveMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tHistory: { value: this.historyTarget.texture },
        tVelocity: { value: this.velocityTarget.texture },
        tDepth: { value: depthTexture },
        inverseViewProjection: { value: this.inverseViewProjection },
        previousViewProjection: { value: this.previousViewProjection },
        cameraPositionWorld: { value: new THREE.Vector3() },
        resolution: { value: new THREE.Vector2(1, 1) },
        inputResolution: { value: new THREE.Vector2(1, 1) },
        historyValid: { value: 0 },
        historyWeight: { value: 0.82 },
        skyDistance: { value: 520 },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `
        precision highp float;varying vec2 vUv;uniform sampler2D tDiffuse;uniform sampler2D tHistory;uniform sampler2D tVelocity;uniform sampler2D tDepth;uniform mat4 inverseViewProjection;uniform mat4 previousViewProjection;uniform vec3 cameraPositionWorld;uniform vec2 resolution;uniform vec2 inputResolution;uniform float historyValid;uniform float historyWeight;uniform float skyDistance;
        vec4 sampleCurrent(vec2 uv){vec2 samplePosition=uv*inputResolution-.5;vec2 base=floor(samplePosition);vec2 f=fract(samplePosition);vec2 f2=f*f;vec2 f3=f2*f;vec2 w0=-.5*f3+f2-.5*f;vec2 w1=1.5*f3-2.5*f2+1.;vec2 w2=-1.5*f3+2.*f2+.5*f;vec2 w3=.5*f3-.5*f2;vec2 g0=w0+w1;vec2 g1=w2+w3;vec2 h0=(base-1.+w1/max(g0,vec2(.0001))+.5)/inputResolution;vec2 h1=(base+1.+w3/max(g1,vec2(.0001))+.5)/inputResolution;return texture2D(tDiffuse,vec2(h0.x,h0.y))*g0.x*g0.y+texture2D(tDiffuse,vec2(h1.x,h0.y))*g1.x*g0.y+texture2D(tDiffuse,vec2(h0.x,h1.y))*g0.x*g1.y+texture2D(tDiffuse,vec2(h1.x,h1.y))*g1.x*g1.y;}
        void main(){
          vec4 current=sampleCurrent(vUv);float depth=texture2D(tDepth,vUv).r;float skyMask=smoothstep(.9985,.99995,depth);
          vec2 velocity=(texture2D(tVelocity,vUv).xy-.5)*2.;vec2 historyUv=vUv-velocity;
          vec4 farWorld=inverseViewProjection*vec4(vUv*2.-1.,1.,1.);vec3 ray=normalize(farWorld.xyz/farWorld.w-cameraPositionWorld);vec3 skyWorld=cameraPositionWorld+ray*skyDistance;vec4 previousSky=previousViewProjection*vec4(skyWorld,1.);vec2 skyHistoryUv=previousSky.xy/max(previousSky.w,.0001)*.5+.5;historyUv=mix(historyUv,skyHistoryUv,skyMask);
          float inBounds=step(0.,historyUv.x)*step(historyUv.x,1.)*step(0.,historyUv.y)*step(historyUv.y,1.);vec4 history=texture2D(tHistory,clamp(historyUv,0.,1.));
          vec2 texel=1./resolution;vec3 lo=current.rgb,hi=current.rgb;float mean=0.;float mean2=0.;
          for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){vec3 sampleColor=sampleCurrent(vUv+vec2(float(x),float(y))*texel).rgb;lo=min(lo,sampleColor);hi=max(hi,sampleColor);float luma=dot(sampleColor,vec3(.2126,.7152,.0722));mean+=luma;mean2+=luma*luma;}}
          mean/=9.;mean2/=9.;float sigma=sqrt(max(0.,mean2-mean*mean));history.rgb=clamp(history.rgb,lo-vec3(.012+sigma*.35),hi+vec3(.012+sigma*.35));
          float depthDelta=abs(depth-history.a);float depthReject=1.-smoothstep(.00035,.0025+length(velocity)*.018,depthDelta);float motionWeight=mix(1.,.55,smoothstep(.002,.045,length(velocity)));float weight=historyWeight*historyValid*inBounds*depthReject*motionWeight;
          vec3 resolved=mix(current.rgb,history.rgb,weight);gl_FragColor=vec4(resolved,depth);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: { source: { value: null } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform sampler2D source;void main(){gl_FragColor=texture2D(source,vUv);}`,
      depthTest: false,
      depthWrite: false,
    });
    this.displayMaterial = new THREE.ShaderMaterial({
      uniforms: { source: { value: this.resolvedTarget.texture }, toneMappingExposure: { value: 1 }, resolution: { value: new THREE.Vector2(1, 1) } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `
        precision highp float;varying vec2 vUv;uniform sampler2D source;uniform float toneMappingExposure;uniform vec2 resolution;
        vec3 taaAces(vec3 color){color*=toneMappingExposure/0.6;const mat3 inputMat=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));const mat3 outputMat=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));color=inputMat*color;vec3 a=color*(color+.0245786)-.000090537;vec3 b=color*(.983729*color+.4329510)+.238081;color=outputMat*(a/b);return clamp(color,0.,1.);}
        vec3 taaSrgb(vec3 color){return mix(pow(color,vec3(1./2.4))*1.055-.055,color*12.92,lessThanEqual(color,vec3(.0031308)));}
        void main(){vec2 texel=1./resolution;vec3 center=texture2D(source,vUv).rgb;vec3 north=texture2D(source,vUv+vec2(0.,texel.y)).rgb;vec3 south=texture2D(source,vUv-vec2(0.,texel.y)).rgb;vec3 east=texture2D(source,vUv+vec2(texel.x,0.)).rgb;vec3 west=texture2D(source,vUv-vec2(texel.x,0.)).rgb;vec3 lo=min(center,min(min(north,south),min(east,west)));vec3 hi=max(center,max(max(north,south),max(east,west)));vec3 sharpened=clamp(center+(center-(north+south+east+west)*.25)*.44,lo,hi);gl_FragColor=vec4(taaSrgb(taaAces(sharpened)),1.);}
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.resolveQuad = new FullScreenQuad(this.resolveMaterial);
    this.copyQuad = new FullScreenQuad(this.copyMaterial);
    this.displayQuad = new FullScreenQuad(this.displayMaterial);
    this.enabled = false;
  }

  setRequested(requested: boolean) {
    this.requested = requested;
    this.enabled = requested;
    if (!requested) this.invalidate();
  }

  setCamera(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  beginFrame() {
    if (!this.requested || this.jitterApplied) return;
    const width = Math.max(1, this.resolveMaterial.uniforms.resolution.value.x);
    const height = Math.max(1, this.resolveMaterial.uniforms.resolution.value.y);
    const halton = (index: number, base: number) => {
      let fraction = 1;
      let result = 0;
      for (let value = index; value > 0; value = Math.floor(value / base)) {
        fraction /= base;
        result += fraction * (value % base);
      }
      return result;
    };
    this.unjitteredProjection.copy(this.camera.projectionMatrix);
    const sample = (this.jitterIndex++ % 8) + 1;
    this.camera.projectionMatrix.elements[8] += (halton(sample, 2) - 0.5) * 2 / width;
    this.camera.projectionMatrix.elements[9] += (halton(sample, 3) - 0.5) * 2 / height;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.jitterApplied = true;
  }

  endFrame() {
    if (!this.jitterApplied) return;
    this.camera.projectionMatrix.copy(this.unjitteredProjection);
    this.camera.projectionMatrixInverse.copy(this.unjitteredProjection).invert();
    this.jitterApplied = false;
  }

  invalidate() {
    if (this.valid) this.resetCount++;
    this.valid = false;
    this.historyFrames = 0;
  }

  setSize(width: number, height: number) {
    this.velocityTarget.setSize(width, height);
    this.resolveMaterial.uniforms.inputResolution.value.set(width, height);
    this.invalidate();
  }

  setOutputSize(width: number, height: number) {
    this.historyTarget.setSize(width, height);
    this.resolvedTarget.setSize(width, height);
    this.resolveMaterial.uniforms.resolution.value.set(width, height);
    this.displayMaterial.uniforms.resolution.value.set(width, height);
    this.invalidate();
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    if (!this.requested) return;
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
    const cameraQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
    if (this.valid && (cameraPosition.distanceTo(this.previousCameraPosition) > 24 || cameraQuaternion.angleTo(this.previousCameraQuaternion) > THREE.MathUtils.degToRad(7))) this.invalidate();

    const currentViewProjection = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.inverseViewProjection.copy(currentViewProjection).invert();
    if (!this.valid) this.previousViewProjection.copy(currentViewProjection);

    const previousOverride = this.scene.overrideMaterial;
    const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
    const previousClearAlpha = renderer.getClearAlpha();
    this.scene.overrideMaterial = this.velocityMaterial;
    renderer.setRenderTarget(this.velocityTarget);
    renderer.setClearColor(new THREE.Color().setRGB(0.5, 0.5, 0), 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = previousOverride;
    renderer.setClearColor(previousClearColor, previousClearAlpha);

    this.resolveMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.resolveMaterial.uniforms.tHistory.value = this.historyTarget.texture;
    this.resolveMaterial.uniforms.tVelocity.value = this.velocityTarget.texture;
    this.resolveMaterial.uniforms.cameraPositionWorld.value.copy(cameraPosition);
    this.resolveMaterial.uniforms.historyValid.value = this.valid ? 1 : 0;
    renderer.setRenderTarget(this.resolvedTarget);
    renderer.clear();
    this.resolveQuad.render(renderer);

    this.copyMaterial.uniforms.source.value = this.resolvedTarget.texture;
    renderer.setRenderTarget(this.historyTarget);
    renderer.clear();
    this.copyQuad.render(renderer);
    this.displayMaterial.uniforms.source.value = this.resolvedTarget.texture;
    this.displayMaterial.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.displayQuad.render(renderer);

    this.trackedObjects = 0;
    this.scene.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
      const stored = this.previousModelMatrices.get(object);
      if (stored) stored.copy(object.matrixWorld);
      else this.previousModelMatrices.set(object, object.matrixWorld.clone());
      this.trackedObjects++;
    });
    this.previousViewProjection.copy(currentViewProjection);
    this.previousCameraPosition.copy(cameraPosition);
    this.previousCameraQuaternion.copy(cameraQuaternion);
    this.valid = true;
    this.historyFrames++;
  }

  get diagnostics() {
    return { valid: this.valid, frames: this.historyFrames, resets: this.resetCount, trackedObjects: this.trackedObjects, jitterIndex: this.jitterIndex };
  }

  dispose() {
    this.historyTarget.dispose();
    this.resolvedTarget.dispose();
    this.velocityTarget.dispose();
    this.resolveMaterial.dispose();
    this.velocityMaterial.dispose();
    this.copyMaterial.dispose();
    this.displayMaterial.dispose();
    this.resolveQuad.dispose();
    this.copyQuad.dispose();
    this.displayQuad.dispose();
  }
}
