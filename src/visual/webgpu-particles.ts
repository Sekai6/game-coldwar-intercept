import * as THREE from "three";

export type GpuParticleKind = "spray" | "debris" | "chaff" | "flare";

export interface GpuParticleBurst {
  kind: GpuParticleKind;
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  count: number;
  energy: number;
  seed: number;
}

export interface WebGpuParticleRuntime {
  object: THREE.Points;
  capacity: number;
  emit(burst: GpuParticleBurst): void;
  update(deltaSeconds: number, elapsedSeconds: number): Promise<boolean>;
  diagnostics(): { active: number; emitted: number; updates: number; bridgeHz: number };
  dispose(): void;
}

const STRIDE_FLOATS = 12;
const STRIDE_BYTES = STRIDE_FLOATS * 4;

function kindId(kind: GpuParticleKind) {
  return kind === "spray" ? 0 : kind === "debris" ? 1 : kind === "chaff" ? 2 : 3;
}

function particleRandom(index: number, seed: number, salt: number) {
  const value = Math.sin(index * 127.1 + seed * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

export async function createWebGpuParticleRuntime(device: any, capacity = 131072): Promise<WebGpuParticleRuntime> {
  const usage = (globalThis as any).GPUBufferUsage;
  const mapMode = (globalThis as any).GPUMapMode;
  const state = device.createBuffer({
    size: capacity * STRIDE_BYTES,
    usage: usage.STORAGE | usage.COPY_DST | usage.COPY_SRC,
  });
  device.queue.writeBuffer(state, 0, new Float32Array(capacity * STRIDE_FLOATS));
  const params = device.createBuffer({ size: 16, usage: usage.UNIFORM | usage.COPY_DST });
  const module = device.createShaderModule({ code: `
    struct Particle { position: vec4<f32>, velocity: vec4<f32>, lifecycle: vec4<f32> };
    struct Params { dt: f32, elapsed: f32, capacity: u32, pad: u32 };
    @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
    @group(0) @binding(1) var<uniform> params: Params;
    fn hash31(p: vec3<f32>) -> f32 { return fract(sin(dot(p, vec3<f32>(127.1,311.7,74.7))) * 43758.5453); }
    @compute @workgroup_size(128)
    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
      if (id.x >= params.capacity) { return; }
      var p = particles[id.x];
      if (p.lifecycle.y <= 0.0 || p.lifecycle.x >= p.lifecycle.y) { return; }
      let kind = u32(p.lifecycle.z + 0.5);
      let turbulence = vec3<f32>(hash31(p.position.xyz + vec3<f32>(params.elapsed, f32(id.x), 0.0)) - 0.5, 0.0,
        hash31(p.position.zyx + vec3<f32>(0.0, params.elapsed, f32(id.x))) - 0.5);
      if (kind == 0u) {
        p.velocity.y -= 9.81 * params.dt;
        p.velocity.xyz += turbulence * 1.4 * params.dt;
        if (p.position.y <= 0.12 && p.velocity.y < 0.0) { p.velocity.y *= -0.18; p.velocity.xz *= 0.62; }
      } else if (kind == 1u) {
        p.velocity.y -= 7.2 * params.dt;
        p.velocity.xyz += turbulence * 0.55 * params.dt;
        if (p.position.y <= 0.16 && p.velocity.y < 0.0) { p.velocity.y *= -0.32; p.velocity.xz *= 0.72; }
      } else if (kind == 2u) {
        p.velocity.y += (-0.34 - p.velocity.y) * min(1.0, params.dt * 1.7);
        p.velocity.xz += turbulence.xz * 1.8 * params.dt;
        p.velocity.xyz *= 1.0 - min(0.22, params.dt * 0.08);
      } else {
        p.velocity.y -= 2.8 * params.dt;
        p.velocity.xz += turbulence.xz * 0.7 * params.dt;
        p.velocity.xyz *= 1.0 - min(0.18, params.dt * 0.11);
      }
      p.position.xyz += p.velocity.xyz * params.dt;
      p.lifecycle.x += params.dt;
      particles[id.x] = p;
    }` });
  const compilationInfo = await module.getCompilationInfo();
  const shaderErrors = compilationInfo.messages.filter((message: any) => message.type === "error");
  if (shaderErrors.length) throw new Error(shaderErrors.map((message: any) => `${message.lineNum}:${message.linePos} ${message.message}`).join(" | "));
  device.pushErrorScope("validation");
  const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
  const validationError = await device.popErrorScope();
  if (validationError) throw new Error(`GPU particle validation: ${validationError.message}`);
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: state } }, { binding: 1, resource: { buffer: params } }],
  });
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(capacity * 3);
  const kinds = new Float32Array(capacity);
  const lives = new Float32Array(capacity);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("particleKind", new THREE.BufferAttribute(kinds, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("particleLife", new THREE.BufferAttribute(lives, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending,
    vertexShader: `attribute float particleKind; attribute float particleLife; varying float vKind; varying float vLife;
      void main(){ vKind=particleKind; vLife=particleLife; vec4 mv=modelViewMatrix*vec4(position,1.0); float size=particleKind<0.5?8.5:(particleKind<1.5?4.5:(particleKind<2.5?2.8:5.5));
      gl_PointSize=clamp(size*(210.0/max(1.0,-mv.z)),1.0,14.0); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vKind; varying float vLife; void main(){ vec2 q=gl_PointCoord-0.5; vec2 shape=vKind<0.5?vec2(q.x*1.8,q.y*0.68):(vKind>1.5&&vKind<2.5?vec2(q.x*0.72,q.y*2.8):q); float d=length(shape); float disc=smoothstep(0.5,0.12,d);
      vec3 spray=mix(vec3(0.72,0.88,1.0),vec3(1.0),1.0-vLife); vec3 debris=mix(vec3(1.0,0.22,0.035),vec3(0.18,0.11,0.07),vLife);
      vec3 chaff=vec3(0.68,0.82,0.80); vec3 flare=mix(vec3(1.0,0.16,0.02),vec3(1.0,0.82,0.28),1.0-vLife);
      vec3 c=vKind<0.5?spray:(vKind<1.5?debris:(vKind<2.5?chaff:flare)); float sparkle=vKind>1.5&&vKind<2.5?0.32+0.48*step(0.62,fract(gl_FragCoord.x*0.37+gl_FragCoord.y*0.71)):1.0;
      float kindAlpha=vKind<0.5?0.56:(vKind<1.5?0.78:(vKind<2.5?0.42:0.86)); float alpha=disc*(1.0-vLife)*kindAlpha*sparkle;
      gl_FragColor=vec4(c*((vKind>0.5&&vKind<1.5)||vKind>2.5?1.65:1.0),alpha); }`,
  });
  const object = new THREE.Points(geometry, material);
  object.name = "webgpu-compute-particles";
  object.frustumCulled = false;
  let cursor = 0, written = 0, emitted = 0, updates = 0, active = 0, pending = false, disposed = false, lastReadback = -Infinity;
  const bridgeHz = 12;

  function emit(burst: GpuParticleBurst) {
    if (disposed) return;
    const count = Math.min(Math.max(1, Math.floor(burst.count)), capacity);
    for (let i = 0; i < count; i++) {
      const index = cursor++ % capacity;
      const a = particleRandom(i, burst.seed, 1) * Math.PI * 2;
      const velocityAngle = particleRandom(i, burst.seed, 2) * Math.PI * 2;
      const u = particleRandom(i, burst.seed, 3);
      const lift = particleRandom(i, burst.seed, 4);
      const radial = Math.sqrt(u);
      const base = burst.velocity ?? new THREE.Vector3();
      const kind = kindId(burst.kind);
      const speed = burst.energy * (0.55 + u * 0.9);
      const vy = kind === 2 ? 0.25 + lift * 0.7 : speed * (0.55 + lift * 0.95);
      const life = kind === 0 ? 2.8 + lift * 2.2 : kind === 1 ? 3.5 + lift * 3 : kind === 2 ? 10 + lift * 8 : 2.2 + lift * 2.5;
      const spawnRadius = kind === 2 ? 3.2 * radial : kind === 0 ? 0.65 * radial : 0.9 * radial;
      const packed = new Float32Array([
        burst.position.x + Math.cos(a) * spawnRadius, burst.position.y + u * (kind === 2 ? 1.8 : 0.35), burst.position.z + Math.sin(a) * spawnRadius, 1,
        base.x + Math.cos(velocityAngle) * speed, base.y + vy, base.z + Math.sin(velocityAngle) * speed, 0,
        0, life, kind, burst.seed + i,
      ]);
      device.queue.writeBuffer(state, index * STRIDE_BYTES, packed);
    }
    written = Math.min(capacity, Math.max(written, cursor));
    emitted += count;
  }

  async function update(dt: number, elapsed: number) {
    if (disposed || pending || dt <= 0) return false;
    pending = true;
    const raw = new ArrayBuffer(16), view = new DataView(raw);
    if (!written) { pending = false; return true; }
    view.setFloat32(0, Math.min(dt, 0.05), true); view.setFloat32(4, elapsed, true); view.setUint32(8, written, true);
    device.queue.writeBuffer(params, 0, raw);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(Math.ceil(written / 128)); pass.end();
    const shouldRead = elapsed - lastReadback >= 1 / bridgeHz;
    let readback: any = null;
    if (shouldRead) {
      readback = device.createBuffer({ size: written * STRIDE_BYTES, usage: usage.COPY_DST | usage.MAP_READ });
      encoder.copyBufferToBuffer(state, 0, readback, 0, written * STRIDE_BYTES);
    }
    device.queue.submit([encoder.finish()]); updates++;
    try {
      if (!readback) return true;
      await readback.mapAsync(mapMode.READ);
      const data = new Float32Array(readback.getMappedRange()); active = 0;
      for (let i = 0; i < written; i++) {
        const o = i * STRIDE_FLOATS, age = data[o + 8], life = data[o + 9];
        if (life <= 0 || age >= life) continue;
        positions[active * 3] = data[o]; positions[active * 3 + 1] = data[o + 1]; positions[active * 3 + 2] = data[o + 2];
        kinds[active] = data[o + 10]; lives[active] = age / life; active++;
      }
      (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.particleKind as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.particleLife as THREE.BufferAttribute).needsUpdate = true;
      geometry.setDrawRange(0, active); lastReadback = elapsed;
      readback.unmap(); return true;
    } finally { readback?.destroy(); pending = false; }
  }
  return { object, capacity, emit, update, diagnostics: () => ({ active, emitted, updates, bridgeHz }), dispose() { disposed = true; state.destroy(); params.destroy(); geometry.dispose(); material.dispose(); } };
}
