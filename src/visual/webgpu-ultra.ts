import * as THREE from "three";

export type WebGpuUltraStatus = "idle" | "initializing" | "active" | "unsupported" | "failed";

export interface WebGpuUltraResult {
  status: WebGpuUltraStatus;
  backend: "WEBGL2" | "WEBGL2_WEBGPU_COMPUTE";
  detailTexture: THREE.DataTexture | null;
  scatterTexture: THREE.DataTexture | null;
  volumeTexture: THREE.Data3DTexture | null;
  adapterName: string;
  error: string;
}

const TEXTURE_SIZE = 128;

function unavailable(status: "unsupported" | "failed", error: string): WebGpuUltraResult {
  return { status, backend: "WEBGL2", detailTexture: null, scatterTexture: null, volumeTexture: null, adapterName: "", error };
}

const VOLUME_WIDTH = 64;
const VOLUME_HEIGHT = 32;
const VOLUME_DEPTH = 64;

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
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow, rowsPerImage: TEXTURE_SIZE },
      [TEXTURE_SIZE, TEXTURE_SIZE, 1],
    );
    encoder.copyTextureToBuffer({ texture: volumeTextureGpu }, { buffer: volumeReadback, bytesPerRow: volumeBytesPerRow, rowsPerImage: VOLUME_HEIGHT }, [VOLUME_WIDTH, VOLUME_HEIGHT, VOLUME_DEPTH]);
    encoder.copyTextureToBuffer(
      { texture: scatterTextureGpu },
      { buffer: scatterReadback, bytesPerRow, rowsPerImage: TEXTURE_SIZE },
      [TEXTURE_SIZE, TEXTURE_SIZE, 1],
    );
    device.queue.submit([encoder.finish()]);
    await Promise.all([readback.mapAsync(mapMode.READ), scatterReadback.mapAsync(mapMode.READ), volumeReadback.mapAsync(mapMode.READ)]);
    const pixels = new Uint8Array(readback.getMappedRange()).slice();
    const scatterPixels = new Uint8Array(scatterReadback.getMappedRange()).slice();
    const volumePixels = new Uint8Array(volumeReadback.getMappedRange()).slice();
    readback.unmap();
    scatterReadback.unmap();
    volumeReadback.unmap();
    readback.destroy();
    scatterReadback.destroy();
    volumeReadback.destroy();
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
    const info = typeof adapter.info === "object" ? adapter.info : {};
    return {
      status: "active",
      backend: "WEBGL2_WEBGPU_COMPUTE",
      detailTexture,
      scatterTexture,
      volumeTexture,
      adapterName: info.description || info.device || info.vendor || "WebGPU adapter",
      error: "",
    };
  } catch (error) {
    return unavailable("failed", error instanceof Error ? error.message : String(error));
  }
}
