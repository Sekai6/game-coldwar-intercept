import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";

export class TemporalCloudPass extends Pass {
  private readonly historyTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  private readonly material: THREE.ShaderMaterial;
  private readonly copyMaterial: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly copyQuad: FullScreenQuad;
  private readonly previousViewProjection = new THREE.Matrix4();
  private readonly currentInverseViewProjection = new THREE.Matrix4();
  private readonly previousCameraPosition = new THREE.Vector3();
  private readonly previousCameraQuaternion = new THREE.Quaternion();
  private camera: THREE.PerspectiveCamera;
  private valid = false;
  private requested = false;
  private resetCount = 0;
  private historyFrames = 0;

  constructor(depthTexture: THREE.DepthTexture, camera: THREE.PerspectiveCamera) {
    super();
    this.camera = camera;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tHistory: { value: this.historyTarget.texture },
        tDepth: { value: depthTexture },
        inverseViewProjection: { value: this.currentInverseViewProjection },
        previousViewProjection: { value: this.previousViewProjection },
        cameraPositionWorld: { value: new THREE.Vector3() },
        resolution: { value: new THREE.Vector2(1, 1) },
        historyValid: { value: 0 },
        historyWeight: { value: 0.84 },
        cloudDistance: { value: 520 },
      },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `
        precision highp float;varying vec2 vUv;uniform sampler2D tDiffuse;uniform sampler2D tHistory;uniform sampler2D tDepth;uniform mat4 inverseViewProjection;uniform mat4 previousViewProjection;uniform vec3 cameraPositionWorld;uniform vec2 resolution;uniform float historyValid;uniform float historyWeight;uniform float cloudDistance;
        void main(){vec4 current=texture2D(tDiffuse,vUv);float depth=texture2D(tDepth,vUv).r;float skyMask=smoothstep(.9985,.99995,depth);vec4 farWorld=inverseViewProjection*vec4(vUv*2.-1.,1.,1.);vec3 ray=normalize(farWorld.xyz/farWorld.w-cameraPositionWorld);vec3 cloudWorld=cameraPositionWorld+ray*cloudDistance;vec4 previousClip=previousViewProjection*vec4(cloudWorld,1.);vec2 historyUv=previousClip.xy/max(previousClip.w,.0001)*.5+.5;float inBounds=step(0.,historyUv.x)*step(historyUv.x,1.)*step(0.,historyUv.y)*step(historyUv.y,1.)*step(.0001,previousClip.w);vec4 history=texture2D(tHistory,clamp(historyUv,0.,1.));vec2 texel=1./resolution;vec3 lo=current.rgb,hi=current.rgb;for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){vec3 sampleColor=texture2D(tDiffuse,vUv+vec2(float(x),float(y))*texel).rgb;lo=min(lo,sampleColor);hi=max(hi,sampleColor);}}history.rgb=clamp(history.rgb,lo-.015,hi+.015);float useHistory=historyValid*inBounds*skyMask*history.a;float weight=historyWeight*useHistory;vec3 resolved=mix(current.rgb,history.rgb,weight);gl_FragColor=vec4(resolved,skyMask);}
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
    this.quad = new FullScreenQuad(this.material);
    this.copyQuad = new FullScreenQuad(this.copyMaterial);
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

  invalidate() {
    if (this.valid) this.resetCount++;
    this.valid = false;
    this.historyFrames = 0;
  }

  setSize(width: number, height: number) {
    this.historyTarget.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
    this.invalidate();
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    if (!this.requested) return;
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
    const cameraQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const moved = this.valid && cameraPosition.distanceTo(this.previousCameraPosition) > 24;
    const rotated = this.valid && cameraQuaternion.angleTo(this.previousCameraQuaternion) > THREE.MathUtils.degToRad(7);
    if (moved || rotated) this.invalidate();

    this.currentInverseViewProjection
      .multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
      .invert();
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.tHistory.value = this.historyTarget.texture;
    this.material.uniforms.cameraPositionWorld.value.copy(cameraPosition);
    this.material.uniforms.historyValid.value = this.valid ? 1 : 0;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);

    if (!this.renderToScreen) {
      this.copyMaterial.uniforms.source.value = writeBuffer.texture;
      renderer.setRenderTarget(this.historyTarget);
      renderer.clear();
      this.copyQuad.render(renderer);
    }
    this.previousViewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.previousCameraPosition.copy(cameraPosition);
    this.previousCameraQuaternion.copy(cameraQuaternion);
    this.valid = true;
    this.historyFrames++;
  }

  get diagnostics() {
    return { valid: this.valid, frames: this.historyFrames, resets: this.resetCount };
  }

  dispose() {
    this.historyTarget.dispose();
    this.material.dispose();
    this.copyMaterial.dispose();
    this.quad.dispose();
    this.copyQuad.dispose();
  }
}
