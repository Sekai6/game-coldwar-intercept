import * as THREE from "three";

export type WebGpuUltraStatus = "idle" | "initializing" | "active" | "unsupported" | "failed";

export interface WebGpuUltraResult {
  status: WebGpuUltraStatus;
  backend: "WEBGL2" | "WEBGL2_WEBGPU_COMPUTE";
  detailTexture: THREE.DataTexture | null;
  scatterTexture: THREE.DataTexture | null;
  volumeTexture: THREE.Data3DTexture | null;
  froxelTexture: THREE.DataTexture | null;
  updateFroxel: ((lights: readonly FroxelLightInput[]) => Promise<boolean>) | null;
  disposeCompute: (() => void) | null;
  adapterName: string;
  error: string;
}

export interface FroxelLightInput {
  screenX: number;
  screenY: number;
  depth: number;
  radius: number;
  color: THREE.Color;
  intensity: number;
}

const TEXTURE_SIZE = 128;

function unavailable(status: "unsupported" | "failed", error: string): WebGpuUltraResult {
  return { status, backend: "WEBGL2", detailTexture: null, scatterTexture: null, volumeTexture: null, froxelTexture: null, updateFroxel: null, disposeCompute: null, adapterName: "", error };
}

const VOLUME_WIDTH = 64;
const VOLUME_HEIGHT = 32;
const VOLUME_DEPTH = 64;
const FROXEL_WIDTH = 80;
const FROXEL_HEIGHT = 45;
const FROXEL_DEPTH = 32;
const FROXEL_COLUMNS = 8;
const FROXEL_ATLAS_WIDTH = FROXEL_WIDTH * FROXEL_COLUMNS;
const FROXEL_ATLAS_HEIGHT = FROXEL_HEIGHT * (FROXEL_DEPTH / FROXEL_COLUMNS);

export async function initializeWebGpuUltra(): Promise<WebGpuUltraResult> {
  const gpu = (navigator as Navigator & { gpu?: any }).gpu;
  if (!gpu) return unavailable("unsupported", "WebGPU is unavailable in this browser");

  try {
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return unavailable("unsupported", "No WebGPU adapter was found");
    const device = await adapter.requestDevice();
    const textureUsage = (globalThis as any).GPUTextureUsage;
    const bufferUsage = (globalThis as any).GPUBufferUsage;
    const mapMode = (globalThis as any).GPUMapMode;
    const textureDescriptor = {
      size: [TEXTURE_SIZE, TEXTURE_SIZE, 1],
      format: "rgba8unorm",
      usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
    };
    const texture = device.createTexture(textureDescriptor);
    const scatterTextureGpu = device.createTexture(textureDescriptor);
    const froxelTextureGpu = device.createTexture({
      size: [FROXEL_ATLAS_WIDTH, FROXEL_ATLAS_HEIGHT, 1],
      format: "rgba8unorm",
      usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
    });
    const volumeTextureGpu = device.createTexture({
      size: [VOLUME_WIDTH, VOLUME_HEIGHT, VOLUME_DEPTH],
      dimension: "3d",
      format: "rgba8unorm",
      usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
    });
    const shader = device.createShaderModule({
      code: `
        @group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
        @group(0) @binding(1) var scatterTexture: texture_storage_2d<rgba8unorm, write>;
        fn hash21(p: vec2<f32>) -> f32 {
          let q = fract(p * vec2<f32>(123.34, 456.21));
          return fract((q.x + q.y) * (q.x + q.y + 45.32));
        }
        fn valueNoise(p: vec2<f32>) -> f32 {
          let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2<f32>(1.0, 0.0)), u.x),
                     mix(hash21(i + vec2<f32>(0.0, 1.0)), hash21(i + vec2<f32>(1.0, 1.0)), u.x), u.y);
        }
        @compute @workgroup_size(8, 8)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
          if (id.x >= ${TEXTURE_SIZE}u || id.y >= ${TEXTURE_SIZE}u) { return; }
          var p = vec2<f32>(id.xy) / ${TEXTURE_SIZE}.0 * 8.0;
          var n = 0.0; var amplitude = 0.56;
          for (var octave = 0; octave < 5; octave++) {
            n += valueNoise(p) * amplitude; p = p * 2.03 + vec2<f32>(7.1, 3.7); amplitude *= 0.5;
          }
          let ridge = 1.0 - abs(n * 1.15 - 1.0);
          textureStore(outputTexture, vec2<i32>(id.xy), vec4<f32>(n, ridge, hash21(vec2<f32>(id.xy)), 1.0));
          let uv = vec2<f32>(id.xy) / vec2<f32>(${TEXTURE_SIZE}.0, ${TEXTURE_SIZE}.0);
          let horizon = exp(-pow((uv.y - 0.48) * 4.2, 2.0));
          let layered = smoothstep(0.28, 0.82, n) * horizon;
          let shaftWeight = clamp(ridge * horizon, 0.0, 1.0);
          let extinction = clamp((0.35 + n * 0.65) * horizon, 0.0, 1.0);
          textureStore(scatterTexture, vec2<i32>(id.xy), vec4<f32>(layered, shaftWeight, extinction, 1.0));
        }`,
    });
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: shader, entryPoint: "main" },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: scatterTextureGpu.createView() },
      ],
    });
    const volumeShader = device.createShaderModule({
      code: `
        @group(0) @binding(0) var volumeTexture: texture_storage_3d<rgba8unorm, write>;
        fn hash31(p: vec3<f32>) -> f32 { let q=fract(p*vec3<f32>(127.1,311.7,74.7)); return fract((q.x+q.y+q.z)*(q.x+q.y+q.z+31.32)); }
        fn noise(p: vec3<f32>) -> f32 { let i=floor(p);let f=fract(p);let u=f*f*(3.0-2.0*f);let a=mix(hash31(i),hash31(i+vec3<f32>(1,0,0)),u.x);let b=mix(hash31(i+vec3<f32>(0,1,0)),hash31(i+vec3<f32>(1,1,0)),u.x);let c=mix(hash31(i+vec3<f32>(0,0,1)),hash31(i+vec3<f32>(1,0,1)),u.x);let d=mix(hash31(i+vec3<f32>(0,1,1)),hash31(i+vec3<f32>(1,1,1)),u.x);return mix(mix(a,b,u.y),mix(c,d,u.y),u.z); }
        fn field(p0: vec3<f32>) -> f32 { var p=p0*vec3<f32>(1.0,1.35,1.0);var n=0.0;var a=0.56;for(var i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec3<f32>(5.3,7.1,3.7);a*=0.5;}let h=p0.y;let shape=smoothstep(0.01,0.18,h)*(1.0-smoothstep(0.7,0.99,h));return max(0.0,(n-0.46)*2.15)*shape; }
        @compute @workgroup_size(4,4,4) fn main(@builtin(global_invocation_id) id: vec3<u32>) { if(id.x>=${VOLUME_WIDTH}u||id.y>=${VOLUME_HEIGHT}u||id.z>=${VOLUME_DEPTH}u){return;}let uv=(vec3<f32>(id)+0.5)/vec3<f32>(${VOLUME_WIDTH}.0,${VOLUME_HEIGHT}.0,${VOLUME_DEPTH}.0);let p=uv*vec3<f32>(5.0,2.6,5.0);let density=field(uv);let erosion=noise(p*3.7+vec3<f32>(9.1,2.7,5.4));let sunStep=vec3<f32>(0.055,0.035,-0.04);var optical=0.0;for(var s=1;s<=5;s++){optical+=field(fract(uv+sunStep*f32(s)))*(1.0-f32(s)*0.1);}let light=exp(-optical*0.9);textureStore(volumeTexture,vec3<i32>(id),vec4<f32>(density,erosion,light,1.0)); }`,
    });
    const volumePipeline = device.createComputePipeline({ layout: "auto", compute: { module: volumeShader, entryPoint: "main" } });
    const volumeBindGroup = device.createBindGroup({ layout: volumePipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: volumeTextureGpu.createView() }] });
    const froxelShader = device.createShaderModule({
      code: `
        @group(0) @binding(0) var froxelAtlas: texture_storage_2d<rgba8unorm, write>;
        @group(0) @binding(1) var<storage,read> lights: array<vec4<f32>,16>;
        fn hash21(p: vec2<f32>) -> f32 { return fract(sin(dot(p,vec2<f32>(127.1,311.7)))*43758.5453); }
        @compute @workgroup_size(8,5,1) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
          if(id.x>=${FROXEL_WIDTH}u||id.y>=${FROXEL_HEIGHT}u||id.z>=${FROXEL_DEPTH}u){return;}
          let screen=(vec2<f32>(id.xy)+0.5)/vec2<f32>(${FROXEL_WIDTH}.0,${FROXEL_HEIGHT}.0);
          let z=(f32(id.z)+0.5)/${FROXEL_DEPTH}.0;
          let viewY=mix(-0.55,0.85,screen.y);
          let distance=z*z*900.0;
          let worldHeight=max(0.0,viewY*distance+18.0);
          let baseDensity=exp(-worldHeight/95.0)*mix(0.016,0.004,z);
          let horizon=exp(-abs(viewY)*2.8);
          let noise=0.82+hash21(vec2<f32>(id.xy)+vec2<f32>(f32(id.z)*7.0,13.0))*0.18;
          let extinction=clamp(baseDensity*noise*22.0,0.0,1.0);
          let sunMu=clamp(screen.x*0.44+screen.y*0.56,0.0,1.0);
          let forwardPhase=0.32+pow(sunMu,5.0)*0.68;
          var scatter=vec3<f32>(0.43,0.56,0.68)*extinction*(0.7+horizon*0.3)+vec3<f32>(1.0,0.68,0.36)*extinction*forwardPhase*0.42;
          for(var lightIndex=0u;lightIndex<8u;lightIndex++){
            let shape=lights[lightIndex*2u];let emission=lights[lightIndex*2u+1u];
            let delta=vec3<f32>((screen-shape.xy)/max(shape.w,0.001),(z-shape.z)*2.4/max(shape.w,0.001));
            let influence=exp(-dot(delta,delta)*2.1)*emission.w;
            scatter+=emission.rgb*influence*(1.15+extinction*2.4);
          }
          let tile=vec2<u32>(id.z%${FROXEL_COLUMNS}u,id.z/${FROXEL_COLUMNS}u);
          let atlas=vec2<i32>(tile*vec2<u32>(${FROXEL_WIDTH}u,${FROXEL_HEIGHT}u)+id.xy);
          textureStore(froxelAtlas,atlas,vec4<f32>(scatter,extinction));
        }`,
    });
    const froxelPipeline = device.createComputePipeline({ layout: "auto", compute: { module: froxelShader, entryPoint: "main" } });
    const froxelLightBuffer = device.createBuffer({ size: 256, usage: bufferUsage.STORAGE | bufferUsage.COPY_DST });
    device.queue.writeBuffer(froxelLightBuffer, 0, new Float32Array(64));
    const froxelBindGroup = device.createBindGroup({ layout: froxelPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: froxelTextureGpu.createView() }, { binding: 1, resource: { buffer: froxelLightBuffer } }] });
    const bytesPerRow = TEXTURE_SIZE * 4;
    const readback = device.createBuffer({
      size: bytesPerRow * TEXTURE_SIZE,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
    });
    const scatterReadback = device.createBuffer({
      size: bytesPerRow * TEXTURE_SIZE,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
    });
    const volumeBytesPerRow = VOLUME_WIDTH * 4;
    const volumeReadback = device.createBuffer({ size: volumeBytesPerRow * VOLUME_HEIGHT * VOLUME_DEPTH, usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ });
    const froxelBytesPerRow = FROXEL_ATLAS_WIDTH * 4;
    const froxelReadback = device.createBuffer({ size: froxelBytesPerRow * FROXEL_ATLAS_HEIGHT, usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(TEXTURE_SIZE / 8, TEXTURE_SIZE / 8);
    pass.end();
    const volumePass = encoder.beginComputePass();
    volumePass.setPipeline(volumePipeline);
    volumePass.setBindGroup(0, volumeBindGroup);
    volumePass.dispatchWorkgroups(VOLUME_WIDTH / 4, VOLUME_HEIGHT / 4, VOLUME_DEPTH / 4);
    volumePass.end();
    const froxelPass = encoder.beginComputePass();
    froxelPass.setPipeline(froxelPipeline);
    froxelPass.setBindGroup(0, froxelBindGroup);
    froxelPass.dispatchWorkgroups(FROXEL_WIDTH / 8, FROXEL_HEIGHT / 5, FROXEL_DEPTH);
    froxelPass.end();
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow, rowsPerImage: TEXTURE_SIZE },
      [TEXTURE_SIZE, TEXTURE_SIZE, 1],
    );
    encoder.copyTextureToBuffer({ texture: volumeTextureGpu }, { buffer: volumeReadback, bytesPerRow: volumeBytesPerRow, rowsPerImage: VOLUME_HEIGHT }, [VOLUME_WIDTH, VOLUME_HEIGHT, VOLUME_DEPTH]);
    encoder.copyTextureToBuffer({ texture: froxelTextureGpu }, { buffer: froxelReadback, bytesPerRow: froxelBytesPerRow, rowsPerImage: FROXEL_ATLAS_HEIGHT }, [FROXEL_ATLAS_WIDTH, FROXEL_ATLAS_HEIGHT, 1]);
    encoder.copyTextureToBuffer(
      { texture: scatterTextureGpu },
      { buffer: scatterReadback, bytesPerRow, rowsPerImage: TEXTURE_SIZE },
      [TEXTURE_SIZE, TEXTURE_SIZE, 1],
    );
    device.queue.submit([encoder.finish()]);
    await Promise.all([readback.mapAsync(mapMode.READ), scatterReadback.mapAsync(mapMode.READ), volumeReadback.mapAsync(mapMode.READ), froxelReadback.mapAsync(mapMode.READ)]);
    const pixels = new Uint8Array(readback.getMappedRange()).slice();
    const scatterPixels = new Uint8Array(scatterReadback.getMappedRange()).slice();
    const volumePixels = new Uint8Array(volumeReadback.getMappedRange()).slice();
    const froxelPixels = new Uint8Array(froxelReadback.getMappedRange()).slice();
    readback.unmap();
    scatterReadback.unmap();
    volumeReadback.unmap();
    froxelReadback.unmap();
    readback.destroy();
    scatterReadback.destroy();
    volumeReadback.destroy();
    froxelReadback.destroy();
    texture.destroy();
    scatterTextureGpu.destroy();
    volumeTextureGpu.destroy();

    const detailTexture = new THREE.DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
    detailTexture.wrapS = THREE.RepeatWrapping;
    detailTexture.wrapT = THREE.RepeatWrapping;
    detailTexture.minFilter = THREE.LinearMipmapLinearFilter;
    detailTexture.magFilter = THREE.LinearFilter;
    detailTexture.generateMipmaps = true;
    detailTexture.colorSpace = THREE.NoColorSpace;
    detailTexture.needsUpdate = true;
    const scatterTexture = new THREE.DataTexture(scatterPixels, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
    scatterTexture.wrapS = THREE.RepeatWrapping;
    scatterTexture.wrapT = THREE.ClampToEdgeWrapping;
    scatterTexture.minFilter = THREE.LinearFilter;
    scatterTexture.magFilter = THREE.LinearFilter;
    scatterTexture.colorSpace = THREE.NoColorSpace;
    scatterTexture.needsUpdate = true;
    const volumeTexture = new THREE.Data3DTexture(volumePixels, VOLUME_WIDTH, VOLUME_HEIGHT, VOLUME_DEPTH);
    volumeTexture.format = THREE.RGBAFormat;
    volumeTexture.type = THREE.UnsignedByteType;
    volumeTexture.minFilter = THREE.LinearFilter;
    volumeTexture.magFilter = THREE.LinearFilter;
    volumeTexture.wrapS = THREE.RepeatWrapping;
    volumeTexture.wrapT = THREE.ClampToEdgeWrapping;
    volumeTexture.wrapR = THREE.RepeatWrapping;
    volumeTexture.unpackAlignment = 1;
    volumeTexture.colorSpace = THREE.NoColorSpace;
    volumeTexture.needsUpdate = true;
    const froxelTexture = new THREE.DataTexture(froxelPixels, FROXEL_ATLAS_WIDTH, FROXEL_ATLAS_HEIGHT, THREE.RGBAFormat);
    froxelTexture.minFilter = THREE.LinearFilter;
    froxelTexture.magFilter = THREE.LinearFilter;
    froxelTexture.wrapS = THREE.ClampToEdgeWrapping;
    froxelTexture.wrapT = THREE.ClampToEdgeWrapping;
    froxelTexture.colorSpace = THREE.NoColorSpace;
    froxelTexture.needsUpdate = true;
    let froxelUpdatePending = false;
    let computeDisposed = false;
    const updateFroxel = async (lights: readonly FroxelLightInput[]) => {
      if (froxelUpdatePending || computeDisposed) return false;
      froxelUpdatePending = true;
      const packed = new Float32Array(64);
      lights.slice(0, 8).forEach((light, index) => {
        const offset = index * 8;
        packed.set([light.screenX, light.screenY, light.depth, light.radius, light.color.r, light.color.g, light.color.b, light.intensity], offset);
      });
      device.queue.writeBuffer(froxelLightBuffer, 0, packed);
      const dynamicReadback = device.createBuffer({ size: froxelBytesPerRow * FROXEL_ATLAS_HEIGHT, usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ });
      const dynamicEncoder = device.createCommandEncoder();
      const dynamicPass = dynamicEncoder.beginComputePass();
      dynamicPass.setPipeline(froxelPipeline);
      dynamicPass.setBindGroup(0, froxelBindGroup);
      dynamicPass.dispatchWorkgroups(FROXEL_WIDTH / 8, FROXEL_HEIGHT / 5, FROXEL_DEPTH);
      dynamicPass.end();
      dynamicEncoder.copyTextureToBuffer({ texture: froxelTextureGpu }, { buffer: dynamicReadback, bytesPerRow: froxelBytesPerRow, rowsPerImage: FROXEL_ATLAS_HEIGHT }, [FROXEL_ATLAS_WIDTH, FROXEL_ATLAS_HEIGHT, 1]);
      device.queue.submit([dynamicEncoder.finish()]);
      try {
        await dynamicReadback.mapAsync(mapMode.READ);
        const dynamicPixels = new Uint8Array(dynamicReadback.getMappedRange());
        (froxelTexture.image.data as Uint8Array).set(dynamicPixels);
        froxelTexture.needsUpdate = true;
        dynamicReadback.unmap();
        return true;
      } finally {
        dynamicReadback.destroy();
        froxelUpdatePending = false;
      }
    };
    const disposeCompute = () => {
      computeDisposed = true;
      froxelLightBuffer.destroy();
      froxelTextureGpu.destroy();
    };
    const info = typeof adapter.info === "object" ? adapter.info : {};
    return {
      status: "active",
      backend: "WEBGL2_WEBGPU_COMPUTE",
      detailTexture,
      scatterTexture,
      volumeTexture,
      froxelTexture,
      updateFroxel,
      disposeCompute,
      adapterName: info.description || info.device || info.vendor || "WebGPU adapter",
      error: "",
    };
  } catch (error) {
    return unavailable("failed", error instanceof Error ? error.message : String(error));
  }
}
