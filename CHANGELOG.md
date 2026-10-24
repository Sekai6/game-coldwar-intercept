# Changelog

Release history follows repository tags. `Unreleased` describes changes on main after
v1.21.1; it does not announce a new release or change the package/HUD version.

## Unreleased

### Added

- RBS-15 Mk. II and Exocet MM38 as independent in-flight threats with distinct canard/intake and solid-rocket silhouettes, raid presets, scenario round trips and bilingual sources. Mk. II is explicitly later than the default Cold War scenario; no new launch platforms or later-generation capabilities.

- R-360 Neptune, baseline 3M24 Uran and Type 80 ASM-1 as independent in-flight sandbox/scenario threats, with procedural models, raid presets and bilingual references. No new launcher or aircraft compatibility; no inherited Harpoon HOJ, pop-up or weaving capability.
- Passive IRST/ESM sensing, passive-track fusion and platform EMCON states (#12).
- Measurement-level CEC, covariance fusion, network diagnostics and engagement support in the explicit `cec-enabled` era (#16). Link 11/16 remain separate services.
- Anti-radiation emitter tracking, seeker acquisition/loss/reacquisition and era-gated SEAD missions (#18). `MIG-29A-SEAD` and `Kh-31P-C` are fictional late-Soviet capabilities.
- Shared radar horizon, named RCS profiles and uncertainty conversions, plus catalog-gated look-down pulse-Doppler filtering for AWG-9/N019 air search (#36). This is a game-scale detection/track-quality model, not a PRF, terrain or seeker simulation.

### Fixed

- Reserve return fuel when planning strike missions (#17).
- Keep setup-field typing from activating sandbox hotkeys (#19); prevent the About panel from intercepting ECM controls (#36).
- Apply scenario `worldUnitsPerKm` to distance displays, radar geometry and horizontal Tacview export (#20), and preserve metre/world-unit uncertainty boundaries in fleet tracks (#36).
- Use seeker-specific observed defensive axes and noise-dependent turn tie-breaking without exposing hidden aircraft positions (#23, #24).
- Respect emitter health, emission edges, reset lifecycle and catalogued ARM flight ceilings; add the missing Kh-31P-C seeker profile and share emitter-track admissibility policy (#25, #27–#30).
- Settle the owning engagement ledger when an air missile is hard-killed (#31).

### Maintenance

- Read shipped ARM catalog literals through a non-executing TypeScript AST reader for ballistics verification (#26).
- Expand Review CI with input, scale, radar, ARM, defensive-axis and engagement-settlement regressions. Refresh current architecture, source maps and bilingual version notes.

## 1.21.1 - 2026-08-12

### Fixed

- Reworked Full-Spectrum Blackout orchestration, strike-wave execution and command messages (#10, #11).
- Corrected launch/store management, mission and formation orders, objective outcomes including escaped threats, and scenario command/phase overrides.
- Added full-duration, simulation-rate and strike-corridor regression coverage.

### Documentation

- Music documentation (#8) and live-demo discovery/SEO updates (#9).

## 1.21.0 - 2026-08-05

### Added

- Versioned JSON scenario validation, normalization, migration, compilation, import/export and session/runtime boundaries, with legacy adapters (#7).
- Full-Spectrum Blackout joint scenario, opening briefing, guidance, objectives, deterministic weather/space-weather zones, Link 11/16 propagation degradation and lost-comms doctrine.
- Dynamic score/theme runtimes and Silent Meridian music assets; weather/network diagnostics and track-conflict fusion.

## 1.20.0 - 2026-08-02

### Changed

- Rebuilt the procedural USS Long Beach (CGN-9), USS Lake Champlain (CG-57), and Project 1164/Slava-class surface assets with more faithful hull proportions, superstructure massing, sensor silhouettes, weapon placement, and aviation-deck layouts.
- Corrected Long Beach to the declared real-world length-to-beam ratio and reduced the inherited vertical exaggeration without changing ship-local launcher and hardpoint ownership.
- Reworked CG-57's separated AEGIS blocks, SPY-1 faces, SPG-62 directors, lattice masts, uptakes, Mk 41 banks, guns, hangar, and deck equipment.
- Reworked Project 1164's stepped superstructure, paired P-500 canisters, S-300F field, radar set, close-in weapons, and aft aviation area.
- Enabled quality-aware ship LOD selection and preserved class-identifying features in Standard quality, including the Long Beach command island and both CG-57 Mk 41 banks.
- Updated multi-ship browser regressions to validate total SAM consumption and physical owner/launcher evidence without assuming a single interceptor subtype.

### Added

- A dedicated surface-platform gallery for CGN-9, CG-57, and Project 1164 with fixed bow-quarter, beam, top, and stern-quarter inspection views.
- A serial 18-image Chromium capture gate covering Ultra, High, and Standard tiers, visible dimensions, real/model length-to-beam ratios, mesh counts, and triangle counts.
- Display-only Standard-tier launcher and silhouette proxies that do not expose launcher metadata, ammunition, hardpoints, or weapon authority.

### Release Boundaries

- V1.20 is a surface-platform visual, proportion, LOD, and validation update. It does not retune ship sensors, weapon performance, seeker logic, or lethality.
- Real platform and equipment names remain paired with game-scaled performance values.
- Static gallery evidence verifies visible construction and LOD behavior; physical launch ownership remains covered by runtime browser regressions and AAR evidence.

### Verification Evidence

- `git diff --check`
- `npm run verify:docs`
- `npx tsc --noEmit`
- `npm run build`
- `npm run capture:surface-platform-lods`
- `npm run verify:cg57`
- `npm run verify:fleet-launch-cycle`
- `npm run verify:default-engagement`
- `npm run verify:bilateral-launch`
- `npm run verify:surface-salvo`
- `npm run verify:platform-defense-visual`
- `npm run verify:default-platform`
- `npm run verify:platform-arrival`

## 1.15.0 - 2026-07-29

### Changed

- Completed a second-pass visual rebuild of the procedural F-14A, A-6E, MiG-29A, Tu-16K, E-2C, and Tu-126 assets while preserving the shared 2 metres-per-unit display scale and independent Ultra, High, and Low geometry.
- Corrected the shared loft-fuselage triangle winding so exterior normals face outward across all rebuilt aircraft.
- Refined common jet nozzles with circumferential petals, a positive rim, and a recessed hot-section face; corrected the A-6E stowed arresting hook and made the Tu-16K tail cannon readable without changing the reference-length envelope.
- Replaced F-14-specific runtime and gallery sweep constants with a model-declared 20°–68° variable-geometry contract.
- Made MiG-29A and Tu-16K gameplay hardpoints consume the same platform-owned station definitions as their visual models, reducing duplicated attachment coordinates.
- Recalibrated mounted stores, markings, lights, engine details, propellers, and rotodomes across the six aircraft and all three LOD tiers.

### Added

- A 63-image serial visual gate covering five Ultra inspection angles, High/Low silhouette views, F-14 sweep states, and armed underside/rear-quarter views. The gallery uses dedicated underside fill so pylon contact and lower-surface normals remain inspectable.
- Stronger structural checks for outward normals, model-declared sweep limits, fixed-station ownership, mount contact, tier dimensions, and AEW animation assemblies.
- Versioned V1.15 Ultra rear-quarter views on every Chinese and English aircraft platform page, generated by a dedicated six-image serial capture script.

### Release Boundaries

- V1.15 remains a procedural aircraft asset, LOD, hardpoint-alignment, and validation update; it does not replace the flight AI, missile guidance, lethality, or ship-defense architecture.
- Historical platform and weapon names remain in use while performance values stay game-scaled.
- Static gallery evidence demonstrates asset construction and attachment quality, not air-combat probability or complete joint-scenario outcomes.

### Verification Evidence

- `git diff --check`
- `npm run verify:docs`
- `npx tsc --noEmit`
- `npm run build`
- `npm run verify:air-models`
- `npm run verify:aew`
- `npm run verify:air-weapon-models`
- `npm run verify:asset-detail-lod`
- `npm run verify:air-hardpoints`
- `npm run verify:air-visuals`
- `npm run capture:wiki-aircraft-ultra`
- `npm run verify:ultra-aurora`
- `npm run verify:aew-runtime`
- `npm run verify:air-camera`
- `npm run verify:aircraft-sam-damage`
- `npm run verify:joint-air`
- `npm run verify:mig29-combat`
- `npm run verify:soviet-maritime-runtime`
- `npm run capture:aircraft-lod-gallery`

## 1.1.0 - 2026-07-26

### Changed

- Rebuilt the procedural F-14A, A-6E, MiG-29A, Tu-16K, E-2C, and Tu-126 visual assets in modular `src/air/model-assets/` and `src/air/aew/model-assets/` paths.
- Applied one 2 metres-per-unit display scale to all six aircraft so their relative dimensions remain consistent; this display convention does not change game-scaled flight or weapon parameters.
- Replaced shared-detail aircraft rendering with separately constructed Ultra, High, and Low geometry and quality-aware distance selection.
- Added reference-dimension metadata and model-specific silhouettes: F-14 variable-sweep wings and fixed glove/pallet mounts; A-6 TRAM and five visible pylons; MiG-29 LERX, engine channels, IRST, and three pylon classes; Tu-16 glazed nose, integrated wing-root nacelles, tail turret, and KSR carrier beams.
- Rebuilt E-2C and Tu-126 AEW geometry with animated rotodomes and propellers. The E-2C uses the NTU-era four-blade/four-fin configuration; the Tu-126 uses the larger Liana installation and paired contra-rotating rotor sets on each of four NK-12 engines.
- Aligned mounted AIM-54A/AIM-7F/AIM-9L, AGM-84A, R-27R/R-73, and KSR-5 visuals with platform-owned attachment anchors while preserving entity, ammunition, and release ownership.
- Allowed AEW controllers to issue degraded, cue-only intercept vectors against measured unidentified airborne contacts. Classified aircraft remain preferred; unknown contacts receive lower command quality and higher uncertainty, and no target truth or weapon authority is exposed.

### Added

- An isolated aircraft asset gallery and a serial capture workflow for Ultra, High, Low, variable-wing, and armed hardpoint inspection.
- Structural verification for strict triangle-count reduction, independent geometry ownership, per-tier dimension tolerances, F-14 fixed-mount parentage, surface-marking tier ownership, and AEW propeller/rotodome animation.

### Release Boundaries

- The new assets improve visual proportions, silhouettes, LOD behavior, and store attachment. They do not change the rule that real-world names use game-scaled performance values.
- Static gallery screenshots and model-structure tests do not by themselves validate flight AI, missile lethality, seeker behavior, or the complete joint-combat loop; those require the existing runtime and browser regressions.
- Carrier operations, aerial refueling, CEC, towed decoys, passive sensor/EMCON chains, and anti-radiation warfare remain outside this release.

### Model Verification Evidence

- `npx tsc --noEmit`
- `npm run verify:asset-detail-lod`
- `npm run verify:air-models`
- `npm run verify:aew`
- `npm run verify:air-weapon-models`
- `npm run verify:air-hardpoints`
- `npm run verify:joint-air`
- `npm run verify:aew-runtime`
- `npm run verify:mig29-combat`
- `npm run verify:soviet-maritime-runtime`
- `npm run verify:air-camera` against the production preview
- `npm run build`
- `npm run capture:aircraft-lod-gallery`

## 1.0.0 - 2026-07-26

### Added

- Independent ship, aircraft, missile, and decoy combat entities.
- NTU-era fleet operations with CGN-9 Long Beach and CG-57 Lake Champlain.
- Link 11 era networking, optional Link 16 era configuration, and separate Soviet C2 models.
- Initial runtime/catalog support for F-14A, A-6E, Tu-16K, MiG-29A, E-2C, and Tu-126 air platforms. The refined scale-consistent Ultra/High/Low assets belong to v1.1.0.
- Three-dimensional flight dynamics, advanced flight AI, throttle regimes, fuel, damage, and formations.
- Radar tracks with horizon, RCS, error, aging, ECM, seeker FOV, and burn-through behavior.
- AIM-54A, AIM-7F, AIM-9L, R-27R, R-73, KSR-5, AGM-84A, P-15, P-500, P-700, Kh-22, Harpoon, RIM-67, SM-2MR, and SM-2ER catalog paths.
- Physical Mk 10 and Mk 41 launcher state machines, independent magazines, fire-control channels, and organic launch events.
- Fleet AAWC/OTC tasking, CIWS, ECM, SRBOC, subsystem damage, AAR, and Tacview ACMI export.
- WebGL high-quality environment and capability-gated WebGPU Ultra rendering path.
- Linked Chinese and English entry documentation with automated local-link verification.

### Release Boundaries

- Parameters are game-scaled despite real-world names.
- CEC, carrier operations, aerial refueling, towed decoys, and anti-radiation missiles are not included.
- Link 11/16 cues do not grant weapon authority; CEC is not simulated.
- WebGPU Ultra remains capability- and driver-dependent and must expose fallback status.

### Verification Evidence

- `npm run build`
- `npm run verify:docs`
- `npm run verify:default-platform`
- `npm run verify:default-engagement`
- `npm run verify:fleet-launch-cycle`
- `npm run verify:joint-air`
- `npm run verify:acmi-export`
- `npm run verify:webgpu-ultra`
- `npm run verify:webgpu-ultra-active`
