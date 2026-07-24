import * as THREE from "three";
import type { OceanSpectrumAtlas } from "./ocean-spectrum";

const SIZE = 64;
const FRAMES = 16;
const FIELDS = 3;
const ELEMENTS = SIZE * SIZE * FRAMES * FIELDS;

export async function createWebGpuOceanSpectrum(device: any): Promise<OceanSpectrumAtlas> {
  device.pushErrorScope("validation");
  const usage = (globalThis as any).GPUBufferUsage;
  const textureUsage = (globalThis as any).GPUTextureUsage;
  const mapMode = (globalThis as any).GPUMapMode;
  const complexBytes = ELEMENTS * 8;
  const buffers = [0, 1].map(() => device.createBuffer({
    size: complexBytes,
    usage: usage.STORAGE,
  }));
  const parameterBuffers = Array.from({ length: 13 }, () => device.createBuffer({ size: 16, usage: usage.UNIFORM | usage.COPY_DST }));
  const atlasGpu = device.createTexture({
    size: [SIZE, SIZE * FRAMES, 1],
    format: "rgba8unorm",
    usage: textureUsage.STORAGE_BINDING | textureUsage.COPY_SRC,
  });
  const module = device.createShaderModule({ code: `
    const N:u32=${SIZE}u;const FRAMES:u32=${FRAMES}u;const FIELDS:u32=${FIELDS}u;
    const PI:f32=3.14159265359;const TAU:f32=6.28318530718;
    struct Params{stage:u32,axis:u32,source:u32,pad:u32};
    @group(0) @binding(0) var<storage,read_write> a:array<vec2<f32>>;
    @group(0) @binding(1) var<storage,read_write> b:array<vec2<f32>>;
    @group(0) @binding(2) var<uniform> params:Params;
    @group(0) @binding(3) var atlas:texture_storage_2d<rgba8unorm,write>;
    fn hash(v:u32)->f32{var x=v*747796405u+2891336453u;x=((x>>((x>>28u)+4u))^x)*277803737u;x=(x>>22u)^x;return f32(x)/4294967295.;}
    fn gaussian(index:u32)->vec2<f32>{let u=max(1e-6,hash(index*2u+17u));let v=hash(index*2u+29u);let r=sqrt(-2.*log(u));return vec2<f32>(r*cos(TAU*v),r*sin(TAU*v));}
    fn bitReverse6(value:u32)->u32{return reverseBits(value)>>26u;}
    fn complexMul(x:vec2<f32>,y:vec2<f32>)->vec2<f32>{return vec2<f32>(x.x*y.x-x.y*y.y,x.x*y.y+x.y*y.x);}
    fn spectrum(index:u32)->vec2<f32>{let x=index%N;let y=index/N;let k=TAU*vec2<f32>(f32(i32(x)-i32(N/2u)),f32(i32(y)-i32(N/2u)))/420.;let k2=dot(k,k);if(k2<1e-8){return vec2<f32>(0.);}let kn=sqrt(k2);let alignment=dot(k/kn,normalize(vec2<f32>(.91,.414)));let largest=18.*18./9.81;let damping=largest*.025;let p=.00042*exp(-1./(k2*largest*largest))*alignment*alignment*exp(-k2*damping*damping)/(k2*k2);return gaussian(index)*sqrt(max(0.,p)*.5);}
    @compute @workgroup_size(64) fn initialize(@builtin(global_invocation_id) id:vec3<u32>){let total=N*N*FRAMES;if(id.x>=total){return;}let spatial=id.x%(N*N);let frame=id.x/(N*N);let x=spatial%N;let y=spatial/N;let mirror=((N-y)%N)*N+(N-x)%N;let h0=spectrum(spatial);let hm=spectrum(mirror);let k=TAU*vec2<f32>(f32(i32(x)-i32(N/2u)),f32(i32(y)-i32(N/2u)))/420.;let omega=sqrt(9.81*length(k));let periodSeconds=18.;let quant=floor(omega*periodSeconds/TAU)*TAU/periodSeconds;let phase=quant*periodSeconds*f32(frame)/f32(FRAMES);let e=vec2<f32>(cos(phase),sin(phase));let em=vec2<f32>(e.x,-e.y);let h=complexMul(h0,e)+complexMul(vec2<f32>(hm.x,-hm.y),em);let kn=length(k);var dx=vec2<f32>(0.);var dz=vec2<f32>(0.);if(kn>1e-5){dx=complexMul(h,vec2<f32>(0.,-k.x/kn*1.28));dz=complexMul(h,vec2<f32>(0.,-k.y/kn*1.28));}let destination=frame*FIELDS*N*N+bitReverse6(y)*N+bitReverse6(x);a[destination]=dx;a[destination+N*N]=dz;a[destination+2u*N*N]=h;}
    @compute @workgroup_size(64) fn butterfly(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=${ELEMENTS}u){return;}let local=id.x%(N*N);let base=id.x-local;let x=local%N;let y=local/N;let length=1u<<(params.stage+1u);let half=length>>1u;let coordinate=select(x,y,params.axis==1u);let within=coordinate%length;let offset=within%half;let evenCoordinate=(coordinate/length)*length+offset;let oddCoordinate=evenCoordinate+half;var evenIndex:u32;var oddIndex:u32;if(params.axis==0u){evenIndex=base+y*N+evenCoordinate;oddIndex=base+y*N+oddCoordinate;}else{evenIndex=base+evenCoordinate*N+x;oddIndex=base+oddCoordinate*N+x;}let sourceEven=select(a[evenIndex],b[evenIndex],params.source==1u);let sourceOdd=select(a[oddIndex],b[oddIndex],params.source==1u);let angle=TAU*f32(offset)/f32(length);let rotated=complexMul(sourceOdd,vec2<f32>(cos(angle),sin(angle)));let value=select(sourceEven+rotated,sourceEven-rotated,within>=half);if(params.source==0u){b[id.x]=value;}else{a[id.x]=value;}}
    fn checker(x:u32,y:u32)->f32{return select(1.,-1.,((x+y)&1u)==1u);}
    @compute @workgroup_size(8,8) fn pack(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=N||id.y>=N||id.z>=FRAMES){return;}let frameBase=id.z*FIELDS*N*N;let i=id.y*N+id.x;let left=id.y*N+(id.x+N-1u)%N;let right=id.y*N+(id.x+1u)%N;let down=((id.y+N-1u)%N)*N+id.x;let up=((id.y+1u)%N)*N+id.x;let norm=1./f32(N*N);let sign=checker(id.x,id.y);let dx=a[frameBase+i].x*norm*sign;let dz=a[frameBase+N*N+i].x*norm*sign;let h=a[frameBase+2u*N*N+i].x*norm*sign;let scale=32.*f32(N)/(2.*420.);let dxdx=(a[frameBase+right].x*checker(id.x+1u,id.y)-a[frameBase+left].x*checker(id.x+N-1u,id.y))*norm*scale;let dxdz=(a[frameBase+up].x*checker(id.x,id.y+1u)-a[frameBase+down].x*checker(id.x,id.y+N-1u))*norm*scale;let dzdx=(a[frameBase+N*N+right].x*checker(id.x+1u,id.y)-a[frameBase+N*N+left].x*checker(id.x+N-1u,id.y))*norm*scale;let dzdz=(a[frameBase+N*N+up].x*checker(id.x,id.y+1u)-a[frameBase+N*N+down].x*checker(id.x,id.y+N-1u))*norm*scale;let jacobian=(1.+dxdx)*(1.+dzdz)-dxdz*dzdx;textureStore(atlas,vec2<i32>(i32(id.x),i32(id.z*N+id.y)),vec4<f32>(clamp(.5+dx*15.686,0.,1.),clamp(.5+dz*15.686,0.,1.),clamp(.5+h*18.039,0.,1.),clamp((1.-jacobian)*1.65,0.,1.)));}
  ` });
  const bindGroupLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: 4, buffer: { type: "storage" } },
    { binding: 1, visibility: 4, buffer: { type: "storage" } },
    { binding: 2, visibility: 4, buffer: { type: "uniform" } },
    { binding: 3, visibility: 4, storageTexture: { access: "write-only", format: "rgba8unorm", viewDimension: "2d" } },
  ] });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const initPipeline = device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint: "initialize" } });
  const butterflyPipeline = device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint: "butterfly" } });
  const packPipeline = device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint: "pack" } });
  const bindGroups = parameterBuffers.map((parameterBuffer) => device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: buffers[0] } },
      { binding: 1, resource: { buffer: buffers[1] } },
      { binding: 2, resource: { buffer: parameterBuffer } },
      { binding: 3, resource: atlasGpu.createView() },
    ],
  }));
  const encoder = device.createCommandEncoder();
  let pass = encoder.beginComputePass();
  pass.setPipeline(initPipeline); pass.setBindGroup(0, bindGroups[0]); pass.dispatchWorkgroups(Math.ceil(SIZE * SIZE * FRAMES / 64)); pass.end();
  let source = 0;
  let parameterIndex = 1;
  for (let axis = 0; axis < 2; axis++) for (let stage = 0; stage < 6; stage++) {
    device.queue.writeBuffer(parameterBuffers[parameterIndex], 0, new Uint32Array([stage, axis, source, 0]));
    pass = encoder.beginComputePass(); pass.setPipeline(butterflyPipeline); pass.setBindGroup(0, bindGroups[parameterIndex]); pass.dispatchWorkgroups(Math.ceil(ELEMENTS / 64)); pass.end();
    parameterIndex++;
    source ^= 1;
  }
  pass = encoder.beginComputePass(); pass.setPipeline(packPipeline); pass.setBindGroup(0, bindGroups[0]); pass.dispatchWorkgroups(SIZE / 8, SIZE / 8, FRAMES); pass.end();
  const bytesPerRow = SIZE * 4;
  const readback = device.createBuffer({ size: bytesPerRow * SIZE * FRAMES, usage: usage.COPY_DST | usage.MAP_READ });
  encoder.copyTextureToBuffer({ texture: atlasGpu }, { buffer: readback, bytesPerRow, rowsPerImage: SIZE * FRAMES }, [SIZE, SIZE * FRAMES, 1]);
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  const validationError = await device.popErrorScope();
  if (validationError) throw new Error(`WebGPU ocean FFT validation failed: ${validationError.message}`);
  await readback.mapAsync(mapMode.READ);
  const pixels = new Uint8Array(readback.getMappedRange()).slice();
  readback.unmap(); readback.destroy(); atlasGpu.destroy(); parameterBuffers.forEach((buffer) => buffer.destroy()); buffers.forEach((buffer) => buffer.destroy());
  const texture = new THREE.DataTexture(pixels, SIZE, SIZE * FRAMES, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  texture.name = "WebGPU Tessendorf FFT ocean spectrum atlas";
  const ranges = Array.from({ length: 4 }, (_, channel) => {
    let minimum = 255, maximum = 0;
    for (let index = channel; index < pixels.length; index += 4) {
      minimum = Math.min(minimum, pixels[index]); maximum = Math.max(maximum, pixels[index]);
    }
    return `${minimum}-${maximum}`;
  });
  texture.userData.channelRanges = ranges.join("/");
  return { texture, frames: FRAMES, resolution: SIZE };
}
