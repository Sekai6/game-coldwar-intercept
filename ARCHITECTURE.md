# Architecture

The simulation is organized around capabilities rather than ship-name checks.

## Module ownership

- `src/main.ts`: scene orchestration, UI adapters, and the frame loop.
- `src/ship-catalog.ts`: ship registration and per-class capability metadata.
- `src/ship-types.ts`: ship capability contracts shared by the catalog and runtime.
- `src/models/long-beach.ts`: CGN-9 procedural model and Mk 10 visual components.
- `src/models/ticonderoga.ts`: CG-47-class procedural model and Mk 41 visual components.
- `src/models/hull-geometry.ts`: shared multi-chine longitudinal loft, sheer deck, and waterline-band geometry; ship-specific station tables remain in each model.
- `src/combat-types.ts`: shared runtime domain types.
- `src/interceptor-data.ts`: ship-launched interceptor flight profiles.
- `src/threats/catalog.ts`: incoming-threat registry and derived `EnemyType`.
- `src/threats/types.ts`: threat envelope, presentation, EW, and terminal-capability contracts.
- `src/threats/<missile>.ts`: one complete incoming-missile definition per file, including its profile, sandbox preset, and procedural model.
- `src/threats/model-helpers.ts`: reusable visual effects and geometry factories; it contains no missile-ID checks.
- `src/visual/material-textures.ts`: cached deterministic roughness and tangent-space normal maps for procedural PBR materials.
- `src/visual/threat-particles.ts`: fixed GPU particle buffers and custom exhaust/smoke shaders.
- `src/visual/ocean.ts`: renderer-neutral `OceanSurface` lifecycle and the current WebGL CPU-wave backend.
- `src/sim.ts`: sensor scans, uncertain tracks, and fire-control solutions.
- `src/sensor-faces.ts`: fixed-array aspect coverage and localized damage.
- `src/vls.ts`: pure VLS load planning, geometry, and damage math.

## Adding a ship

1. Implement a model builder that exposes the equipment anchors required by its declared launcher and sensors.
2. Add one `ShipDefinition` entry to `ship-catalog.ts` with sensors, launcher capability, magazines, subsystem labels, and subsystem positions.
3. Add fixed sensor faces only when the ship uses fixed arrays. Mechanical sensors require no face-specific branch.
4. Do not add `activeShip.id` checks to `main.ts`. Add a capability to `ShipDefinition` when behavior genuinely differs.

## Adding an incoming missile

1. Add one file under `src/threats/` exporting a literal `ThreatDefinition`. Keep its game-scaled envelope, RCS, CIWS modifiers, terminal capabilities, sandbox preset, and `createModel` implementation together in that file.
2. Register that definition once in `THREAT_DEFINITIONS` inside `src/threats/catalog.ts`. `EnemyType`, the profile lookup, both sandbox selectors, and preset buttons are derived from this registry.
3. Reuse `attachThreatEffects` or a geometry factory when useful, but do not put missile IDs or missile-specific branches in a shared helper.
4. Express optional behavior through capabilities. Current examples are `terminalDescentAt` for a late independent descent gate, `terminalAttackModes` plus `popUp` for mixed terminal profiles, and `homeOnJam` for emitter homing. Add a general capability to `ThreatProfile` when a genuinely new behavior is needed; do not add an ID check to `main.ts`.
5. Verify model forward axis `-Z`, initial/cruise/terminal altitude, seeker activation, special terminal behavior, ECM/decoy response, CIWS/SAM engagement, second-wave creation, and mobile sandbox layout.

## Adding an interceptor

1. Extend `WeaponType` in `combat-types.ts`.
2. Add its game-scaled flight profile to `interceptor-data.ts`.
3. Declare launcher compatibility and magazine data in the relevant `ShipDefinition`.

The incoming-threat engine is intentionally generic. `src/main.ts` may read a threat capability, but it must not compare an incoming missile ID to select a model, envelope, preset, trajectory, EW mode, or terminal attack behavior.

Model modules expose equipment anchors through `Object3D.userData`; combat behavior reads capabilities from `ShipDefinition` and must not infer them from a model or ship name.

Hull precision is data-driven but not shape-generic. Each ship owns a station table describing deck edge, shoulder chine, waterline, keel width, and vertical sheer. `hull-geometry.ts` only triangulates those profiles. This keeps bow flare, parallel midbody, stern form, and proportions specific to the real class while avoiding duplicate index-generation code. Hull-side attachments must be repositioned when station breadth changes; old absolute beam offsets are not valid after a hull revision.

## Rendering pipeline

The current renderer is WebGL 2 with PBR materials, ACES Filmic tone mapping, and `RenderPass -> SSAO -> UnrealBloom -> OutputPass`. SSAO is disabled on narrow mobile viewports. Rendering diagnostics are exposed through canvas dataset fields, including `renderPipeline`, `oceanBackend`, and `activeThreatParticles`.

`OceanSurface` owns its object, animation, resize lifecycle, and disposal. The combat frame loop only calls that contract and must not read geometry buffers. A future `WebgpuFftOcean` backend should provide spectrum initialization, horizontal and vertical inverse FFT compute passes, displacement/normal textures, and a Jacobian-derived foam texture. Backend selection must include feature detection, a WebGL fallback, and a WebGPU-compatible replacement for the current postprocessing chain; it must not claim WebGPU support while routing compute work back through the CPU implementation.
