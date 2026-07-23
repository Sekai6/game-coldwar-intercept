# Architecture

The simulation is organized around capabilities rather than ship-name checks.

## Module ownership

- `src/main.ts`: scene orchestration, UI adapters, and the frame loop.
- `src/combat-entity.ts`: side-neutral entity and target contracts shared by aircraft, ships, missiles, and decoys.
- `src/air/types.ts`: aircraft, mission, observed-track, weapon, countermeasure, and damage contracts.
- `src/air/catalog.ts`: game-scaled F-14A, Tu-16K, A-6E, AIM-54A, AIM-7F, AIM-9L, KSR-5, and AGM-84A capability data.
- `src/air/models.ts`: reusable procedural aircraft geometry and stable animation anchors.
- `src/air/runtime.ts`: formation flight, point-mass energy limits, airborne OODA, uncertain radar tracks, guidance, countermeasures, and aircraft/air-weapon damage. It exposes incoming anti-ship missiles but does not own or spawn shipboard weapons.
- `src/main.ts` registers hostile aircraft and air-launched anti-ship missiles as externally driven defensive contacts. Both enter the existing `CombatPicture`, fire-control, engagement, magazine, Mk 10/Mk 41 animation, interceptor-guidance, and hit-resolution path. Missiles resolve as hard kills; aircraft receive subsystem damage and may survive, lose control, or crash. Contact behavior is selected by catalog-owned defense templates, never an aircraft/weapon ID branch in `main.ts`.
- `src/ship-catalog.ts`: ship registration and per-class capability metadata.
- `src/ship-types.ts`: ship capability contracts shared by the catalog and runtime.
- `src/models/long-beach.ts`: CGN-9 procedural model and Mk 10 visual components.
- `src/models/ticonderoga.ts`: CG-47-class proportions, layout, and class-specific procedural model assembly.
- `src/models/hull-geometry.ts`: shared multi-chine longitudinal loft, sheer deck, and waterline-band geometry; ship-specific station tables remain in each model.
- `src/models/model-primitives.ts`: shared sloped-box, structural-strut, launcher, boat, life-raft canister, hawse-pipe, and rail geometry used by multiple ship classes.
- `src/models/us-navy-equipment.ts`: reusable Mk 41, Mk 45, Phalanx, SPG-62, SPY-1, and SLQ-32 visual components with stable animation anchors.
- `src/platforms/types.ts`: enemy-platform definitions, sensor slots, weapon slots, physical hardpoints, and runtime instances.
- `src/platforms/model-slots.ts`: typed model-anchor registration without platform-name checks.
- `src/platforms/defense.ts`: observed-track threat scoring shared by platform maneuver and point-defense allocation.
- `src/platforms/runtime.ts`: model/definition validation, hardpoint reservation, cross-wave launcher timing, cover release, sensor updates, and observed-track-driven platform maneuver OODA.
- Weapon slots may request `alternate-groups`; model hardpoints supply opaque `salvoGroup` labels, and the generic reservation scheduler round-robins groups while preserving release queue order.
- Weapon slots declare `fireControlTrackHoldover` for short scan gaps and `postCommitTrackLossAbort` for a prolonged loss after the first weapon has left the launcher. The latter cancels only unreleased reservations. An ESM cue counts as a new targeting source only when the slot explicitly declares `passiveTargeting` and satisfies its quality, continuity, and uncertainty gates.
- A slot may declare `salvoDoctrine`; `main.ts` reuses `planSurfaceSalvo` to commit an initial bounded wave, wait for all released weapons to resolve, hold a doctrine-defined BDA interval, and size a follow-up from resolved weapons and discounted hit credit. Hit credit combines simulation truth with a declared report reliability and observed-track quality before entering the planner; exact hits remain verification/AAR data. Scenario count is authorization, not an instruction to reserve every tube at time zero.
- Platform salvo timing is initialized only when the first weapon actually releases with a qualified radar or declared passive-targeting solution. The observed range, final scheduled release, doctrine arrival window, and bounded speed compensation produce per-weapon arrival plans. Midcourse guidance may converge toward those plans; terminal speed remains owned by the threat profile.
- `EnemyPlatformModelSlots.pointDefenseMounts` binds abstract defensive channels to physical traverse and muzzle objects. Model validation rejects a platform with fewer mounts than declared channels. The renderer selects a ready mount on the threatened side and emits fire from its world-space muzzle; engagement eligibility and PK remain in the platform-defense simulation.
- Passive ESM cues are observation-only by default. A weapon definition may opt into search-area launch through `passiveTargeting`, which has separate minimum quality, continuity, command delay, and maximum uncertainty. This never grants target truth or terminal acquisition.
- Direct-radar fire-control memory has a slot-defined holdover. Natural missed scans decay the solution; explicit sensor shutdown bypasses holdover. ESM then remains a maneuver cue unless the weapon explicitly supports qualified passive targeting.
- `scripts/verify-bilateral-launch.mjs` is the ship-class matrix gate for bilateral surface fire: each friendly class must launch its configured strike and the platform must release physical weapons against both.
- `src/platforms/catalog.ts`: enemy-platform registry and lookup.
- `src/platforms/models/<platform>.ts`: one platform-specific model and complete capability definition.
- `src/surface-combat.ts`: generic friendly anti-ship missile runtime, terminal seeker, finite platform defenses, and platform damage.
- `src/surface-doctrine.ts`: pure salvo-sizing logic for in-flight limits, estimated effects, and ammunition conservation.
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

## Adding an air platform

1. Add one `AirPlatformDefinition` to `air/catalog.ts`; mission behavior is selected by capabilities and `AirMissionOrder`, never an aircraft-ID check in `main.ts`.
2. Supply a procedural model whose forward axis is `-Z`. Optional moving parts are exposed through generic `userData` animation anchors.
3. Declare every weapon in the loadout and `AIR_WEAPONS`. Target class, range, guidance, seeker, turn limit, damage, and countermeasure resistance remain weapon data.
4. Aircraft consume only `AirTrack` estimates until a terminal seeker acquires. Defensive maneuver and countermeasure decisions may use detected incoming weapons, not hidden enemy truth.
   Launch range, weapon selection, and the initial command point are derived from the observed track position and velocity. Target truth is not used to seed midcourse guidance.
5. Run `npm run verify:joint-air` and `npm run verify:air-strike-defense` serially. The gates prove the three aircraft weapon chains, physical shipboard launcher departure, hard-kill synchronization, and leaker damage with one Chromium context and a renderer-process limit.
6. Joint mission completion waits for active air weapons and aircraft still executing combat orders. Anti-ship aircraft transition to `egress` after releasing their mission weapon; CAP transitions to `return` only after hostile aircraft and hostile air weapons are gone.
7. Every AAR snapshot includes aircraft identity, side, 3D position, mission/state, structure health, air weapons, and physical chaff/flare objects. These are runtime snapshots, not reconstructed event-log estimates.
8. Airborne radar factors live in `src/air/sensors.ts`: RCS fourth-root scaling, radar horizon, sensor precision, radar health, ECM range reduction, and burn-through all affect detection probability and track quality. Missile defense decisions consume short-lived warning tracks; an unobserved weapon cannot trigger maneuver or countermeasure deployment.
9. `src/anti-ship-guidance.ts` owns the side-neutral boost/midcourse/terminal transition, command-track guidance, active-seeker FOV capture, altitude, speed, and turn envelope used by air-launched AGM-84A/KSR-5. Their envelopes are catalog data, not weapon-ID branches.
10. `src/radar-countermeasures.ts` is shared by surface-launched Harpoon and air-launched anti-ship weapons. It computes fourth-power target/decoy signal competition, ECM interference, burn-through, and HOJ probability adjustment. Target-side launchers, point defense, and damage remain adapter-owned.

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
7. Declare `minimumTrackQuality`, `minimumTrackAge`, and `fireControlDelay` on every platform weapon slot. Pending launches require continuous quality and command reaction time. Actual release uses a separate per-slot clock so delayed reservations cannot collapse into one frame. Destroying the platform changes only unreleased reservations to `canceled`, while already released weapons continue independently.
   Add `passiveTargeting` only for weapons that support ESM search-area launch; its independent quality, age, delay, and uncertainty limits must be met before release.
8. Platform mobility is capability data (`maxSpeedKnots`, cruise setting, acceleration, and turn rate). Runtime owns velocity and heading integration; sensor tracks consume that velocity instead of assuming a static target.
9. Platform target tracks are measured state, never aliases of defender truth. Weapon slots declare datalink interval, latency, and minimum quality. Released weapons coast on their last command point when the link fails.
10. Terminal seeker acquisition is capability-driven by range and field of view. A platform-launched threat may use truth only after acquisition; ECM, decoys, and autonomous terminal aim must not leak truth into midcourse guidance.
11. Platform maneuver decisions consume only the platform target track and qualified incoming-weapon tracks. Defender truth may enter runtime as a radar measurement input, but must not directly select close, standoff, withdraw, or defensive-beam states. Mobility doctrine belongs in the platform definition rather than platform-ID branches.

## Adding friendly surface-strike capability

1. Declare `surfaceStrike` in the ship catalog with weapon, magazine, interval, range, track-quality, damage, and salvo fields.
2. Attach `ModelWeaponHardpoint[]` to `model.userData.surfaceStrikeHardpoints`; shared launchers such as Mk 141 should come from `model-primitives.ts`.
3. Keep the launch and flight runtime generic. It consumes transformed hardpoint positions/directions and capability fields, never a ship ID.
4. Surface-strike definitions also declare continuous confirmation and fire-control delay. Track-ID changes and quality loss reset continuity; do not reuse `Track.age`, which means time since last sensor update rather than track lifetime.
   Optional `passiveTargeting` authorizes an uncertain search basket, not a radar-quality track. Midcourse continues from measured cue updates and the terminal seeker must still acquire within its own range and field of view.
5. Enemy-platform survivability declares hull, point-defense range/interval/PK/finite engagements, saturation penalty, and soft-kill PK. Runtime subsystem health modifies those capabilities; platform mobility and persistent damage visuals must remain generic rather than platform-ID branches.
6. Surface truth, surface tracks, Harpoons, and platform damage must be represented separately in AAR snapshots so replay never substitutes hidden truth for the tactical picture.
7. Player-facing surface status derives identity and bounded BDA from track quality. Exact platform truth is reserved for simulation and verification datasets, not the HUD.
8. `OPFOR ECM` controls continuous platform radiation and remains shared with incoming-weapon jamming. `OPFOR DECOYS` independently controls finite platform decoy deployment. Jammer health (`electronic-warfare`) may not gate a successfully deployed decoy's seeker competition; launcher health (`countermeasures`) controls deployment availability and cooldown. Inventory, deployment range, cloud RCS, HOJ, and burn-through remain capability-driven state. Point defense remains a separate hard-kill capability.
9. Surface salvo planning limits committed weapons, waits for a capability-defined assessment interval after each resolved round, and sizes re-attacks from a friendly-doctrine target-durability prior plus a blended prior/observed leak probability. It must not read the enemy platform's true hull capability. Manual launch requests pass through the same gates and cannot bypass an active wave or BDA window.
10. Tactical BDA uses the same friendly durability prior, confirmed-hit count, weapon-effect uncertainty, and current surface-track quality. The live HUD and combat log must not print true remaining platform hull or true damaged-subsystem identity; exact values remain simulation/AAR verification state.
11. Friendly ship maneuver doctrine is catalog data: patrol/cruise/max speeds, acceleration, deceleration, turn rate, decision cadence, and standoff ring. Runtime prioritizes qualified incoming-air tracks for defensive beam maneuvering, then uses only the surface picture for close/standoff/withdraw decisions. A reserved platform weapon is not a radar contact or active raid member until its physical hardpoint release occurs.
12. Enemy-platform sensor scans use target-RCS fourth-root range scaling, antenna/target radar horizon, health, refresh cadence, and deterministic detection probability. A missed scan decays sensor quality and preserves a fresh track memory; it does not silently grant a new measurement. When multiple sensors are present, a track refresh uses only the highest-quality successful measurement in the current scan; remembered sensor quality cannot masquerade as a new report.
13. Platform soft-kill deployment uses the same qualified incoming track position for range and bearing. Platform ECM/decoy logic may not use an airborne missile's truth transform before seeker acquisition; seeker-side signal competition may use its own post-acquisition range measurement.

## Adding an interceptor

1. Extend `WeaponType` in `combat-types.ts`.
2. Add its game-scaled flight profile to `interceptor-data.ts`.
3. Declare launcher compatibility and magazine data in the relevant `ShipDefinition`.

The incoming-threat engine is intentionally generic. `src/main.ts` may read a threat capability, but it must not compare an incoming missile ID to select a model, envelope, preset, trajectory, EW mode, or terminal attack behavior.

Model modules expose equipment anchors through `Object3D.userData`; combat behavior reads capabilities from `ShipDefinition` and must not infer them from a model or ship name.

Surface fire control and missile datalinks consume track estimates rather than target transforms. Track quality alone is insufficient authorization: reports older than four seconds are stale and may remain displayable but cannot build fire-control continuity, release a new salvo, or update an airborne Harpoon. Terminal truth access is gated behind the missile profile's acquisition range and field of view.

Enemy-platform defense follows the same rule. Each airborne surface-strike missile has a platform-owned incoming track with noisy position/velocity, scan cadence, quality, uncertainty, memory, and a fire-control-ready clock. Point-defense weapons consume these tracks through definition-sized channel-ready arrays. Sensor silence or damage affects track formation; local missile density affects the weapon solution but does not substitute for detection.

Incoming-weapon priority is also observed-state only. `platforms/defense.ts` estimates closing speed, time to impact, range urgency, and local saturation from valid platform tracks, then produces one deterministic ordering. Platform defensive-beam maneuvering and point-defense channel allocation consume the same ordering. Tracks that have exhausted their platform-configured engagement limit leave the point-defense queue, while unobserved truth contacts contribute neither priority nor saturation penalty. The same module maps point-defense subsystem health into effective channel count, reaction delay, and channel-cycle delay; damage therefore changes scheduling as well as PK, while health at or below five percent produces one offline event and no fire. Point-defense fire is not an instantaneous kill roll: range and the platform-configured effective effector speed produce a time of flight, the channel remains occupied through arrival, and the incoming missile continues moving. A shot that arrives after impact has no effect. Each platform also owns a finite definition-sized inventory of effective point-defense engagement bursts. Inventory is consumed at fire time, in-flight rounds still resolve after the final burst is committed, and the first later eligible request emits one depletion event without deleting its track. A point-defense miss is explicitly non-terminal: the incoming missile and track remain alive, then observe a separate platform-configured re-engagement delay before any free channel may accept that track again. A later shoot-look-re-engage attempt uses a separate deterministic draw. Only a resolved kill, soft kill, impact, or terminal miss removes the incoming track.

Hull precision is data-driven but not shape-generic. Each ship owns a station table describing deck edge, shoulder chine, waterline, keel width, and vertical sheer. `hull-geometry.ts` only triangulates those profiles. This keeps bow flare, parallel midbody, stern form, and proportions specific to the real class while avoiding duplicate index-generation code. Hull-side attachments must be repositioned when station breadth changes; old absolute beam offsets are not valid after a hull revision.

Surface-strike impact uses platform-local hull dimensions rather than a center-distance sphere. The generic collision envelope tapers beam toward bow and stern, so a maneuvering platform may receive bow, amidships, or aft contact according to actual relative geometry. Contact transitions a weapon into `penetrating`, removes its incoming track, and schedules a definition-sized fuse delay without applying damage. Detonation later applies hull loss and chooses a subsystem only from the platform definition's longitudinal damage zone. AAR, live diagnostics, damage visuals, and BDA begin from detonation rather than penetration.

Internal detonation also creates a platform-owned fire/flooding casualty. `updateEnemyPlatform()` resolves casualties on the definition's damage-control interval before mobility and sensors update. Damage-control subsystem health interpolates between controlled decay and uncontrolled growth factors; each tick applies progressive hull loss, emits an event, and either contains the casualty below its threshold or can independently disable the platform. Mission completion must wait while a surviving enemy platform still has active casualties. Exact progressive loss is retained in diagnostics and AAR, while tactical strike planning continues to use assessed weapon effects rather than reading hull truth.

Longitudinal calibration must update geometry, equipment roots, subsystem positions, and damage zones as one coordinate contract. CG-57 derives `TICONDEROGA_LENGTH_SCALE` from its `172.8 m` real length and the model's meters-per-unit constant, then applies the `longitudinal()` transform. Do not apply nonuniform scale to the returned ship group because it would turn cylindrical mounts and sensors into ellipses and would hide coordinate mismatches from combat logic.

Reusable equipment factories own equipment geometry and animation anchors, but not ship layout. A class model supplies mount position, heading, material, and class-specific count. Combat code continues to consume semantic anchors and capability data rather than equipment geometry or ship IDs.

## Rendering pipeline

The current renderer is WebGL 2 with PBR materials, ACES Filmic tone mapping, and `RenderPass -> SSAO -> UnrealBloom -> OutputPass`. SSAO is disabled on narrow mobile viewports. Rendering diagnostics are exposed through canvas dataset fields, including `renderPipeline`, `oceanBackend`, and `activeThreatParticles`.

`OceanSurface` owns its object, animation, resize lifecycle, and disposal. The combat frame loop only calls that contract and must not read geometry buffers. A future `WebgpuFftOcean` backend should provide spectrum initialization, horizontal and vertical inverse FFT compute passes, displacement/normal textures, and a Jacobian-derived foam texture. Backend selection must include feature detection, a WebGL fallback, and a WebGPU-compatible replacement for the current postprocessing chain; it must not claim WebGPU support while routing compute work back through the CPU implementation.
