# WebGPU Ultra

`WEBGPU ULTRA` is an opt-in rendering tier. It does not replace the stable WebGL 2 renderer.

The first implementation uses a hybrid backend:

- WebGL 2 renders the scene and the established SSAO/GTAO, bloom, LUT and cinematic atmosphere passes.
- WebGPU Compute generates a 128 x 128 five-octave cloud detail field on a high-performance adapter.
- The generated texture is injected into the ray-marched cloud density function.
- A 64 x 32 x 64 WebGPU density volume stores cloud body, erosion and sun-direction transmittance; Ultra clouds ray march this shared field with 32 view samples and volumetric self-shadowing.
- A second compute output stores layered scattering, shaft weighting and extinction for the Ultra atmosphere pass.
- GTAO's independently rendered depth texture is linearized into view-space distance so Ultra fog respects scene geometry instead of applying a uniform screen haze.
- Unsupported or failed WebGPU initialization falls back to the normal high-quality WebGL path without changing simulation state.

Runtime diagnostics are exposed on `#scene`:

- `data-web-gpu-ultra-status`: `idle`, `initializing`, `active`, `unsupported` or `failed`
- `data-web-gpu-ultra-backend`: `WEBGL2` or `WEBGL2_WEBGPU_COMPUTE`
- `data-web-gpu-ultra-cloud-detail`: `OFF` or `COMPUTE_FBM_128`
- `data-web-gpu-ultra-scatter`: `OFF` or `COMPUTE_SCATTER_ATLAS_128`
- `data-web-gpu-ultra-depth`: `OFF` or `GTAO_DEPTH_RECONSTRUCTED`
- `data-web-gpu-ultra-cloud-volume`: `OFF` or `COMPUTE_VOLUME_64X32X64`
- `data-web-gpu-ultra-adapter` and `data-web-gpu-ultra-error`

Run `npm run verify:webgpu-ultra` to verify either the active compute path or an explicit safe fallback. The verifier is strictly serial and launches one Chromium renderer.

Run `npm run verify:webgpu-ultra-active` on a WebGPU-capable machine to require an actual adapter and both compute outputs. It fails instead of accepting fallback.

Future migration order is temporal cloud reprojection, froxel volumetric lighting, FFT ocean compute and velocity-buffer motion blur. A full `WebGPURenderer` switch remains separate because the current GLSL post-processing stack is not directly compatible.
