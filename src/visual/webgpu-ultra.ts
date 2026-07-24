import * as THREE from "three";

export type WebGpuUltraStatus = "idle" | "initializing" | "active" | "unsupported" | "failed";

export interface WebGpuUltraResult {
  status: WebGpuUltraStatus;
  backend: "WEBGL2" | "WEBGL2_WEBGPU_COMPUTE";
  detailTexture: THREE.DataTexture | null;
  adapterName: string;
  error: string;
}

const TEXTURE_SIZE = 128;

function unavailable(status: "unsupported" | "failed", error: string): WebGpuUltraResult {
  return { status, backend: "WEBGL2", detailTexture: null, adapterName: "", error };
}

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
    const texture = device.createTexture({
      size: [TEXTURE_SIZE, TEXTURE_SIZE, 1],
      format: "rgba8unorm",
      usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
    });
    const shader = device.createShaderModule({
      code: `
        @group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
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
        }`,
    });
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: shader, entryPoint: "main" },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: texture.createView() }],
    });
    const bytesPerRow = TEXTURE_SIZE * 4;
    const readback = device.createBuffer({
      size: bytesPerRow * TEXTURE_SIZE,
      usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(TEXTURE_SIZE / 8, TEXTURE_SIZE / 8);
    pass.end();
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow, rowsPerImage: TEXTURE_SIZE },
      [TEXTURE_SIZE, TEXTURE_SIZE, 1],
    );
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(mapMode.READ);
    const pixels = new Uint8Array(readback.getMappedRange()).slice();
    readback.unmap();
    readback.destroy();
    texture.destroy();

    const detailTexture = new THREE.DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
    detailTexture.wrapS = THREE.RepeatWrapping;
    detailTexture.wrapT = THREE.RepeatWrapping;
    detailTexture.minFilter = THREE.LinearMipmapLinearFilter;
    detailTexture.magFilter = THREE.LinearFilter;
    detailTexture.generateMipmaps = true;
    detailTexture.colorSpace = THREE.NoColorSpace;
    detailTexture.needsUpdate = true;
    const info = typeof adapter.info === "object" ? adapter.info : {};
    return {
      status: "active",
      backend: "WEBGL2_WEBGPU_COMPUTE",
      detailTexture,
      adapterName: info.description || info.device || info.vendor || "WebGPU adapter",
      error: "",
    };
  } catch (error) {
    return unavailable("failed", error instanceof Error ? error.message : String(error));
  }
}
