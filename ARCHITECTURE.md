# Architecture

The simulation is organized around capabilities rather than ship-name checks.

## Module ownership

- `src/main.ts`: scene orchestration, UI adapters, and the frame loop.
- `src/ship-catalog.ts`: ship registration and per-class capability metadata.
- `src/ship-types.ts`: ship capability contracts shared by the catalog and runtime.
- `src/models/long-beach.ts`: CGN-9 procedural model and Mk 10 visual components.
- `src/models/ticonderoga.ts`: CG-47-class procedural model and Mk 41 visual components.
- `src/models/hull-geometry.ts`: shared multi-chine longitudinal loft, sheer deck, and waterline-band geometry; ship-specific station tables remain in each model.
- `src/models/model-primitives.ts`: shared sloped-box and structural-strut geometry used by US and Soviet models.
- `src/platforms/types.ts`: enemy-platform definitions, sensor slots, weapon slots, physical hardpoints, and runtime instances.
- `src/platforms/model-slots.ts`: typed model-anchor registration without platform-name checks.
- `src/platforms/runtime.ts`: model/definition validation, hardpoint reservation, cross-wave launcher timing, cover release, and sensor updates.
- `src/platforms/catalog.ts`: enemy-platform registry and lookup.
- `src/platforms/models/<platform>.ts`: one platform-specific model and complete capability definition.
- `src/surface-combat.ts`: generic friendly anti-ship missile runtime, terminal seeker, finite platform defenses, and platform damage.
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

## Adding an enemy launch platform

1. Add a model under `src/platforms/models/` and attach one `EnemyPlatformModelSlots` manifest to `model.userData.platformSlots`.
2. Register every physical launcher tube, cell, or rail with a unique hardpoint ID, semantic weapon-slot ID, local exit direction, and optional cover object. Register every declared sensor anchor by semantic ID.
3. Export one `EnemyPlatformDefinition` declaring sensor roles and weapon-slot compatibility, capacity, interval, exit speed, boost duration, and guidance takeover.
4. Register the definition once in `ENEMY_PLATFORM_DEFINITIONS`. Sandbox selectors derive compatible threats and capacity from the catalog.
5. Runtime must prove declared capacity equals physical hardpoint count. Primary and second waves share hardpoint state and `weaponSlotNextLaunch`; no wave may reuse a fired or reserved tube.
6. Platform departure remains generic: the missile stores a `PlatformLaunchReservation`, releases the referenced cover, follows that hardpoint's transformed axis, and hands off to the threat profile after the configured takeover time. `main.ts` must not compare a platform ID or missile ID to choose this behavior.
7. Declare `minimumTrackQuality` on every platform weapon slot. Pending launches are held until platform sensors satisfy that gate; destroying the platform changes only unreleased reservations to `canceled`, while already released weapons continue independently.
8. Platform mobility is capability data (`maxSpeedKnots`, cruise setting, acceleration, and turn rate). Runtime owns velocity and heading integration; sensor tracks consume that velocity instead of assuming a static target.

## Adding friendly surface-strike capability

1. Declare `surfaceStrike` in the ship catalog with weapon, magazine, interval, range, track-quality, damage, and salvo fields.
2. Attach `ModelWeaponHardpoint[]` to `model.userData.surfaceStrikeHardpoints`; shared launchers such as Mk 141 should come from `model-primitives.ts`.
3. Keep the launch and flight runtime generic. It consumes transformed hardpoint positions/directions and capability fields, never a ship ID.
4. Enemy-platform survivability declares hull, point-defense range/interval/PK/finite engagements, saturation penalty, and soft-kill PK. Runtime subsystem health modifies those capabilities; platform mobility and persistent damage visuals must remain generic rather than platform-ID branches.
5. Surface truth, surface tracks, Harpoons, and platform damage must be represented separately in AAR snapshots so replay never substitutes hidden truth for the tactical picture.

## Adding an interceptor

1. Extend `WeaponType` in `combat-types.ts`.
2. Add its game-scaled flight profile to `interceptor-data.ts`.
3. Declare launcher compatibility and magazine data in the relevant `ShipDefinition`.

The incoming-threat engine is intentionally generic. `src/main.ts` may read a threat capability, but it must not compare an incoming missile ID to select a model, envelope, preset, trajectory, EW mode, or terminal attack behavior.

Model modules expose equipment anchors through `Object3D.userData`; combat behavior reads capabilities from `ShipDefinition` and must not infer them from a model or ship name.

Hull precision is data-driven but not shape-generic. Each ship owns a station table describing deck edge, shoulder chine, waterline, keel width, and vertical sheer. `hull-geometry.ts` only triangulates those profiles. This keeps bow flare, parallel midbody, stern form, and proportions specific to the real class while avoiding duplicate index-generation code. Hull-side attachments must be repositioned when station breadth changes; old absolute beam offsets are not valid after a hull revision.

Longitudinal calibration must update geometry, equipment roots, subsystem positions, and damage zones as one coordinate contract. CG-57 uses `TICONDEROGA_LENGTH_SCALE` and the `longitudinal()` transform for that purpose. Do not apply nonuniform scale to the returned ship group because it would turn cylindrical mounts and sensors into ellipses and would hide coordinate mismatches from combat logic.

## Rendering pipeline

The current renderer is WebGL 2 with PBR materials, ACES Filmic tone mapping, and `RenderPass -> SSAO -> UnrealBloom -> OutputPass`. SSAO is disabled on narrow mobile viewports. Rendering diagnostics are exposed through canvas dataset fields, including `renderPipeline`, `oceanBackend`, and `activeThreatParticles`.

`OceanSurface` owns its object, animation, resize lifecycle, and disposal. The combat frame loop only calls that contract and must not read geometry buffers. A future `WebgpuFftOcean` backend should provide spectrum initialization, horizontal and vertical inverse FFT compute passes, displacement/normal textures, and a Jacobian-derived foam texture. Backend selection must include feature detection, a WebGL fallback, and a WebGPU-compatible replacement for the current postprocessing chain; it must not claim WebGPU support while routing compute work back through the CPU implementation.
