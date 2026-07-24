# WebGPU Ultra

`WEBGPU ULTRA` is an opt-in rendering tier. It does not replace the stable WebGL 2 renderer.

The first implementation uses a hybrid backend:

- WebGL 2 renders the scene and the established SSAO/GTAO, bloom, LUT and cinematic atmosphere passes.
- WebGPU Compute generates a 128 x 128 five-octave cloud detail field on a high-performance adapter.
- The generated texture is injected into the ray-marched cloud density function.
- A 64 x 32 x 64 WebGPU density volume stores cloud body, erosion and sun-direction transmittance; Ultra clouds ray march this shared field with 32 view samples and volumetric self-shadowing.
- Cloud motion uses absolute simulation time rather than frame increments, while stable screen-space ray offsets avoid frame-to-frame sampling shimmer.
- The ocean integrates three height layers of the same volume into a wind-advected cloud-shadow field without CPU readback.
- A full-scene temporal reconstruction pass renders Ultra at 0.85x internal resolution and resolves to a full-resolution half-float history target. An eight-sample Halton jitter, per-object previous-MVP velocity prepass, linear-distance disocclusion rejection, silhouette rejection, reactive masks, variance-aware 3x3 neighborhood clipping, Catmull-Rom current-frame reconstruction and bounded RCAS-style sharpening stabilize ships, aircraft, missiles, antennas, ocean and clouds without unrestricted ghost trails.
- An 80 x 45 x 32 WebGPU froxel grid is packed into a 640 x 180 atlas for the hybrid WebGL compositor. A low-density ambient medium and the strongest eight visible point lights are injected asynchronously; warm high-energy transients outrank small persistent navigation lights without adding a permanent full-screen milk haze.
- A six-level minimum-depth Hi-Z pyramid drives half-resolution object-space AO and short-range contact shadows. Screen-space sea reflection remains an explicit validation mode until moving-camera hull-ghost rejection passes; it is not enabled during normal Ultra play.
- Ultra ocean uses a deterministic 64 x 64 Tessendorf/Phillips directional spectrum. WebGPU storage buffers evolve three complex fields and execute six horizontal plus six vertical radix-2 butterfly stages for each of 16 looped frames. A compute packing pass derives the full displacement Jacobian and writes the atlas; WebGL then interpolates adjacent frames without per-frame GPU-to-CPU readback. The CPU implementation remains an explicit initialization fallback and unit-test baseline.
- The ocean shader consumes horizontal displacement, height and Jacobian compression separately, with a reduced Gerstner residual for sub-spectrum detail. Vessel wakes use a speed-scaled Kelvin wedge and turbulent centerline rooted at the actual stern rather than transparent scene lines.
- Ocean impacts enter a shared eight-event ring buffer. Air-launched missiles that strike the sea now generate expanding displacement and foam rings through the ocean surface instead of weapon-owned flat ring meshes.
- Dedicated `oceanValidation=stern` and `oceanValidation=splash` views provide fixed, low-load visual gates. `verification-ultra-ocean-stern-wake.png` versus `verification-ultra-ocean-stern-no-wake.png` proves stern origin, aft direction and speed response; `verification-ultra-ocean-splash.png` proves a smooth circular surface-impact wave without grid-shaped interpolation artifacts.
- Missile sea impacts and the one-time `disabled` to `crashed` aircraft transition feed the same ocean event interface. Vertical spray and droplets intentionally remain a GPU-particle-stage responsibility rather than flat billboard substitutes.
- Camera cuts, fast rotation, large translation, resize and Ultra shutdown invalidate history immediately. High-motion pixels reduce history weight while disocclusions reject history using depth.
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
- `data-web-gpu-ultra-temporal`: `OFF` or `TAAU_FULL_SCENE_0.85X`
- `data-web-gpu-ultra-internal-scale`: `1.00` or `0.85`
- `data-web-gpu-ultra-hi-z`: `OFF` or `MIN_DEPTH_6_LEVEL`
- `data-web-gpu-ultra-hi-z-consumers`: `0`, `2` normally, or `3` during explicit SSR validation
- `data-web-gpu-ultra-velocity`: `OFF` or `OBJECT_PREVIOUS_MVP_RG16F`
- `data-web-gpu-ultra-cloud-shadows`: `OFF` or `VOLUME_PROJECTED_3_LAYER`
- `data-web-gpu-ultra-reprojection`: `OFF` or `TAA_VELOCITY_DEPTH_CLAMP`
- `data-web-gpu-ultra-froxel`: `OFF` or `FROXEL_80X45X32_DYNAMIC_8`
- `data-web-gpu-ultra-ocean`: `GERSTNER` or `FFT_16X64`
- `data-web-gpu-ultra-ocean-compute`: `COMPUTE_RADIX2`, `CPU_RADIX2_FALLBACK` or `OFF`
- `data-web-gpu-ultra-ocean-ranges` exposes displacement, height and Jacobian channel ranges; the active verifier rejects empty or collapsed spectra.
- `data-web-gpu-ultra-history-valid`, `data-web-gpu-ultra-history-frames` and `data-web-gpu-ultra-history-resets` expose accumulation and invalidation state.
- `data-web-gpu-ultra-adapter` and `data-web-gpu-ultra-error`

Run `npm run verify:webgpu-ultra` to verify either the active compute path or an explicit safe fallback. The verifier is strictly serial and launches one Chromium renderer.

Run `npm run verify:webgpu-ultra-active` on a WebGPU-capable machine to require an actual adapter and both compute outputs. It fails instead of accepting fallback.

Run `npm run capture:webgpu-ocean` for a strictly serial FFT/Gerstner and wake/no-wake visual comparison. Query parameters `oceanFFT=off` and `oceanWake=off` are validation-only controls; normal Ultra enables both.

Future migration order is richer multi-vessel wake history and spray, GPU particles, Bruneton atmosphere LUTs and clustered lighting. A full `WebGPURenderer` switch remains separate because the current GLSL post-processing stack is not directly compatible.
