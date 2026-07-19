<div align="center">

# NTU Intercept

**A 3D naval air-defense and anti-ship missile interception sandbox centered on USS Long Beach (CGN-9)**

[![Chinese Documentation](https://img.shields.io/badge/文档-中文-334155?style=for-the-badge)](README.md)
[![English Documentation](https://img.shields.io/badge/Docs-English-2f8f8b?style=for-the-badge)](README_EN.md)

</div>

> [!IMPORTANT]
> This project uses real ship, radar, weapon, and missile names to establish its period and system relationships. All performance figures are game-scaled. This is not a weapon-performance database, an engineering analysis tool, or a training system, and it must not be interpreted as a statement of real equipment capability.

![NTU Intercept combat view](verification-combat.png)

<a id="table-of-contents"></a>
## Table of Contents

- [1. Overview](#overview)
  - [Design Goals](#design-goals)
  - [Current Scope](#current-scope)
- [2. Quick Start](#quick-start)
  - [Requirements](#requirements)
  - [Install and Run](#install-and-run)
  - [Production Build](#production-build)
- [3. Controls](#controls)
  - [Combat Controls](#combat-controls)
  - [Camera and Keyboard](#camera-and-keyboard)
  - [Scenario Editor](#scenario-editor)
- [4. Simulation Loop and Time](#simulation-loop)
- [5. Sensors and Tracks](#sensors-and-tracks)
  - [AN/SPS-48E and AN/SPS-49](#radar-model)
  - [Detection Probability and Horizon](#detection-model)
  - [Association, Error, and Fire-Control Solutions](#track-model)
- [6. Incoming Weapon Model](#incoming-weapons)
- [7. SAMs and Guidance](#sam-guidance)
  - [Weapon Parameters](#sam-parameters)
  - [Two-Stage Guidance](#two-stage-guidance)
  - [RIM-67 Active Terminal Guidance](#rim67-terminal)
  - [SM-2 and SPG-55 Illumination](#sm2-illumination)
  - [Flight Physics and Hit Resolution](#interceptor-physics)
- [8. Engagement Planning and Channels](#engagement-planning)
  - [Doctrine](#doctrine)
  - [Channels and Assignment](#fire-channels)
- [9. Mk 10 Twin-Arm Launchers](#mk10-launchers)
- [10. Electronic Warfare and Decoys](#electronic-warfare)
  - [Threat ECM and Chaff](#threat-ew)
  - [Shipboard AN/SLQ-32 ECM](#ship-ecm)
  - [Mk 36 SRBOC](#srboc)
- [11. Ship Maneuver and CIWS](#maneuver-and-ciws)
- [12. Subsystem Damage](#subsystem-damage)
  - [Hit Location and Damage Allocation](#damage-allocation)
  - [Mechanical Effects of Damage](#damage-effects)
- [13. 3D Presentation and Ship Model](#presentation)
- [14. After Action Review](#aar)
- [15. Values, Units, and Determinism](#values-and-units)
- [16. Project Structure](#project-structure)
- [17. Development and Verification](#development)
- [18. Known Boundaries and Future Work](#known-boundaries)
- [19. License and Security](#license-and-security)

<a id="overview"></a>
## 1. Overview

NTU Intercept is a Three.js browser-based 3D combat sandbox. The player controls a game abstraction of the New Threat Upgrade-era USS Long Beach (CGN-9) against P-500, P-700, and Kh-22 raids while managing sensors, fire-control channels, Mk 10 launchers, SAMs, electronic warfare, chaff, and CIWS.

The combat model is not a simple “target enters a circle and disappears on a dice roll.” Results emerge from an observable engagement chain:

```text
Radar scan -> noisy track -> 3D fire-control solution -> launcher slew
-> ship-guided midcourse -> terminal seeker or illumination -> hit/miss
-> leakers, electronic attack, subsystem damage -> AAR
```

<a id="design-goals"></a>
### Design Goals

- Use real names and period-appropriate technical relationships while clearly keeping values game-scaled.
- Model velocity, acceleration, drag, energy, turn-rate limits, and finite range in 3D space.
- Make sensor error, revisit rate, track quality, and fire-control delay affect the ability to fire.
- Show two-stage guidance: ship-supported midcourse followed by a terminal seeker or illumination.
- Let channels, illuminators, launcher mechanics, and magazines create saturation pressure.
- Make ECM, chaff, burn-through, and false-target capture dynamic processes.
- Let leakers damage specific equipment and change the remainder of the engagement.
- Provide a movable 3D camera, tactical radar, and complete AAR timeline.

<a id="current-scope"></a>
### Current Scope

The current build is a single-ship air-defense sandbox. It does not yet include fleet-level CEC, aviation, submarines, anti-surface attacks, multiplayer, or a complete mission-authoring system. Ship and weapon visuals are generated procedurally and do not depend on external 3D model files.

<a id="quick-start"></a>
## 2. Quick Start

<a id="requirements"></a>
### Requirements

- Node.js 20.19+ or Node.js 22.12+
- npm
- A modern browser with WebGL 2 support

<a id="install-and-run"></a>
### Install and Run

```bash
npm install
npm run dev
```

Open the address printed by Vite. The default is usually:

```text
http://127.0.0.1:5173/
```

If port 5173 is occupied, Vite selects another port; use the terminal output as the authority.

<a id="production-build"></a>
### Production Build

```bash
npm run build
```

This runs the TypeScript type check and Vite production bundle. Output is written to `dist/`.

<a id="controls"></a>
## 3. Controls

<a id="combat-controls"></a>
### Combat Controls

| Control | Function |
|---|---|
| `AUTO FIRE` | Enables or suspends automatic defensive fire planning |
| `DOCTRINE` | Cycles through SINGLE, DOUBLE, and SS-L-S |
| `RADAR` | Switches between active emissions and EMCON silence |
| `SEARCH` | Cycles 360°, 120°, and 60° search widths |
| `SLEW` | Points focused search at the selected track |
| `CIWS` | Sets close-in defense to AUTO or HOLD |
| `THREAT CHAFF` | Enables incoming-missile chaff deployment |
| `THREAT ECM` | Enables threat-side interference against SAM guidance |
| `SHIP ECM` | Sets shipboard ECM to AUTO or HOLD |
| `SRBOC` | Sets Mk 36 chaff deployment to AUTO or HOLD |
| `WEAPON` | Cycles RIM-67, SM-2MR, and SM-2ER |
| `TARGET` | Cycles through surviving targets |
| `LAUNCH SAM` | Requests a manual shot against the selected target |
| `TIME` | Cycles 1X, 2X, and 4X simulation speed |
| `SCENARIO SETUP` | Pauses and opens the scenario editor |

Manual fire does not bypass fire-control rules. A request is rejected when there is no track, no SPS-48E altitude solution, insufficient solution quality, a stale track, an invalid range, exhausted channels, or no serviceable launcher.

<a id="camera-and-keyboard"></a>
### Camera and Keyboard

| Input | Function |
|---|---|
| Mouse drag | Orbit the camera |
| Mouse wheel | Zoom in or out |
| `1` | Close ship view |
| `2` | Default tactical view |
| `3` | Wide ship-to-target view |
| `C` | Toggle cinematic orbit |
| `Space` | Pause or resume |
| `R` | Reload the page |

<a id="scenario-editor"></a>
### Scenario Editor

The editor configures:

- Incoming missile type, count, interval, initial altitude, center coordinates, and formation spread.
- Ripple or simultaneous arrival pattern.
- Initial USS Long Beach coordinates.
- RIM-67, SM-2MR, SM-2ER, and CIWS ammunition.
- SAM engagement channels and SPG-55 illuminator count.
- A second wave with independent type, count, and delay.
- `SEA SKIMMER`, `SATURATION`, and `HIGH SPEED` presets.
- Direct ship and raid placement by clicking the tactical radar.

Starting a scenario clears tracks, AAR data, explosions, fires, missiles, illumination tasks, and subsystem damage, and resets both Mk 10 launchers.

<a id="simulation-loop"></a>
## 4. Simulation Loop and Time

Combat logic uses a fixed `0.05 s` simulation step. Display frame rate does not change missile physics, mechanical timing, or fire-control ordering. The 1X, 2X, and 4X settings only control how much simulated time accumulates per real-time interval.

The approximate fixed-step order is:

```text
CIWS -> booster debris -> chaff/decoys
-> radar and tracks -> ship OODA maneuver -> Mk 10 mechanics
-> fire planning and illuminators -> interceptor guidance/hit resolution
-> incoming seeker, ECM, maneuver, and ship impact
-> AAR snapshot
```

Visual radar rotation, sea animation, fire, smoke, and some HUD updates are independent of the fixed step and do not directly decide combat outcomes.

<a id="sensors-and-tracks"></a>
## 5. Sensors and Tracks

<a id="radar-model"></a>
### AN/SPS-48E and AN/SPS-49

| Radar | Dimension | Base Revisit | Game Max Range | Altitude | Primary Role |
|---|---:|---:|---:|---|---|
| AN/SPS-48E | 3D | 0.75 s | 65 km | Yes | Altitude and fire-control solutions |
| AN/SPS-49 | 2D | 1.15 s | 105 km | No | Long-range warning and horizontal tracks |

Focused 60°/120° search shortens revisit time and improves measurement quality, but only covers targets near the current search axis. SPS-49 can create early 2D warning tracks but cannot independently satisfy the altitude requirement for SAM fire.

<a id="detection-model"></a>
### Detection Probability and Radar Horizon

Effective detection range uses a fourth-root RCS relationship:

```text
effectiveRange = maxRange * (max(0.05, targetRCS / 0.5))^0.25 * sensorHealth
```

The model also considers radar height, target altitude, range ratio, focused search, and a radar-horizon factor. Passing the range gate does not guarantee detection: a deterministic pseudo-random check remains. Long range, low altitude, low RCS, and sensor damage all reduce scan success.

The relationship is intended to produce explainable gameplay. Constants and ranges are game-scaled, not engineering specifications.

<a id="track-model"></a>
### Association, Error, and Fire-Control Solutions

Radar reports do not copy target truth. Each measurement receives position and altitude error based on measured quality. Association uses predicted position, velocity, revisit interval, and an uncertainty gate.

- Track quality decays with age while uncertainty grows.
- 3D altitude data expires after roughly four seconds without an update.
- Tracks are labeled `unknown`, `suspect`, or `classified` by quality.
- Significant target maneuvers reset or reduce the fire-control solution.
- Fresh 3D tracks accumulate `solutionQuality`; 0.45 is required to fire.
- Tracks older than 2.2 seconds are stale for launch authorization.
- Very low-quality tracks or tracks older than 160 seconds are removed.

<a id="incoming-weapons"></a>
## 6. Incoming Weapon Model

| Type | Cruise Altitude | Terminal Altitude | Cruise/Terminal Speed | Terminal Starts | Game Damage | Character |
|---|---:|---:|---:|---:|---:|---|
| P-500 | 60 m | 15 m | 8.8 / 9.6 u/s | 18 km | 28% | Sea skimming and terminal maneuver |
| P-700 | 130 m | 20 m | 9.8 / 10.8 u/s | 22 km | Faster with stronger terminal weaving |
| Kh-22 | 18,000 m | 110 m | 13.2 / 15.2 u/s | 45 km | High-altitude, high-speed dive; difficult for CIWS |

Incoming weapons transition through `inbound -> midcourse -> terminal`. Altitude, speed, and maneuver amplitude interpolate continuously during terminal entry. Each missile has a turn-rate limit, speed response, bank visualization, active-seeker activation, line-of-sight aim point, and closest-approach history.

<a id="sam-guidance"></a>
## 7. SAMs and Guidance

<a id="sam-parameters"></a>
### Weapon Parameters

| Weapon | Game Envelope | Max Speed | Boost | Base Turn Rate | Terminal Range | Terminal Guidance |
|---|---:|---:|---:|---:|---:|---|
| RIM-67 | 2-75 km | 12.5 u/s | 5.2 s | 18°/s | 18 km | Game-modeled active seeker |
| SM-2MR | 1.5-45 km | 13.5 u/s | 4.4 s | 22°/s | 10 km | SPG-55 semi-active illumination |
| SM-2ER | 2.2-90 km | 14.2 u/s | 6.2 s | 16°/s | 19 km | SPG-55 semi-active illumination |

These values exist only for this project’s world scale and combat pacing.

<a id="two-stage-guidance"></a>
### Two-Stage Guidance

The missile leaves from the selected Mk 10 rail’s actual position and orientation. Midcourse guidance does not directly chase target truth; it follows a `commandPoint` and `commandVelocity` derived from the fire-control track:

1. The ship sends delayed datalink updates based on track quality.
2. Update spacing varies with quality; missing data causes inertial extrapolation.
3. Long-range shots use a lofted trajectory before descending toward the target.
4. Inside terminal range, control transfers to an active seeker or SPG-55 illumination.

<a id="rim67-terminal"></a>
### RIM-67 Active Terminal Guidance

The active seeker here is a deliberate game treatment for two-stage guidance and is not a strict representation of every real RIM-67 configuration.

- The seeker activates in terminal range and warms up for about 0.35 seconds.
- Acquisition considers field of view, range, handoff error, RCS, nearby competing targets, and sea clutter.
- After capture, the seeker produces a noisy aim point at a finite update rate.
- Excessive boresight angle or line-of-sight rate can break lock.
- A short track-memory period follows lock loss; prolonged failure to reacquire causes a miss.

<a id="sm2-illumination"></a>
### SM-2 and SPG-55 Illumination

SM-2MR/ER also receive midcourse updates but require continuous SPG-55 illumination in terminal flight.

- The illuminator must slew to the target and enter its angular capture gate.
- Illumination channels are finite; missiles against the same target may share an established illumination.
- More than roughly 2.5 seconds without illumination causes an illumination-loss miss.
- SPG-55 damage reduces slew speed and available channel count.

<a id="interceptor-physics"></a>
### Flight Physics and Hit Resolution

Each interceptor stores velocity, distance traveled, energy, boost state, and trajectory history. Its update includes:

- Boost acceleration and booster separation.
- Turn-rate limits and gradual direction changes.
- Drag and energy loss under high turn demand.
- Midcourse loft, terminal maneuver, and range exhaustion.
- Segment closest-point checks to prevent high-speed targets from tunneling through a hit sphere.
- Final PK derived from guidance quality, geometry, remaining energy, saturation, and illumination state.
- Closest-approach and opening-range logic to identify a fly-by miss.

<a id="engagement-planning"></a>
## 8. Engagement Planning and Channels

<a id="doctrine"></a>
### Doctrine

| Doctrine | Behavior |
|---|---|
| `SINGLE` | Maintains one assigned interceptor at a time to conserve rounds |
| `DOUBLE` | Attempts to maintain two interceptors per target |
| `SS-L-S` | Shoot-Shoot-Look-Shoot: fires two, observes results, then permits follow-up shots up to four total |

Threat ranking combines time to impact, flight phase, missile type, and track quality. Terminal, fast, and close threats receive priority.

<a id="fire-channels"></a>
### Channels and Assignment

- Accepted launcher tasks count against SAM channels and per-target assignment before physical launch.
- Mechanical slew delay cannot cause the planner to allocate unlimited duplicate shots.
- A request is rejected when both Mk 10 launchers are busy or disabled.
- Terminal SM-2 flight also consumes a separate SPG-55 illumination resource.
- The automatic planner only considers targets with a fresh 3D solution inside a weapon envelope.

<a id="mk10-launchers"></a>
## 9. Mk 10 Twin-Arm Launchers

The forward and aft Mk 10 mounts each use a fixed-step mechanical state machine:

```text
READY -> SLEWING -> FIRING -> RETURNING -> LOADING -> READY
```

1. After tasking, the mount calculates relative azimuth and elevation from the current radar track.
2. Base game slew rates are approximately 55°/s in azimuth and 25°/s in elevation.
3. Inside an approximately 2° alignment gate, the selected rail model supplies its world position and quaternion.
4. The interceptor starts with rail-aligned velocity and orientation rather than spawning at ship center.
5. The mount holds the firing pose briefly, returns to the loading bearing, and lowers to zero elevation.
6. The fired rail’s visible round moves from the loading position back onto the rail; the next cycle alternates arms.
7. A destroyed target or prolonged track loss during slew cancels the request, refunds ammunition, and returns the mount.
8. Damage slows slew and reload; health at or below 5% prevents new tasking.

<a id="electronic-warfare"></a>
## 10. Electronic Warfare and Decoys

<a id="threat-ew"></a>
### Threat ECM and Chaff

`THREAT ECM` adds a range-dependent aim-point error to terminal SM-2 guidance. As the interceptor closes, it enters burn-through range and interference falls, generating an `ECM BURN-THROUGH` event.

Incoming missiles can also deploy chaff. Terminal SM-2 compares target and chaff radar cross sections and may record `DECOY CAPTURE`. Chaff expands, drifts, and decays over time.

<a id="ship-ecm"></a>
### Shipboard AN/SLQ-32 ECM

Shipboard ECM is electromagnetic radiation from the ship’s electronic-warfare antennas, not a projectile.

- At long range, ECM produces a dynamic seeker aim-point error.
- As the missile closes, ship return dominates and burn-through occurs.
- AN/SLQ-32 health affects both interference power and burn-through timing.
- ECM alone is not a reliable soft-kill mechanism; its main value is cooperation with SRBOC chaff.

<a id="srboc"></a>
### Mk 36 SRBOC

When an incoming missile reaches terminal flight, SRBOC launches a chaff round to the side of the threat axis:

1. The round follows a quadratic Bezier trajectory from a shipboard launch point.
2. At the burst point it creates a drifting chaff cloud with initial RCS and a 14-second life.
3. The seeker compares ship and chaff power using a distance-to-the-fourth relationship.
4. ECM raises lock-transfer probability; burn-through releases a false-target lock.
5. A missile that passes the ship and opens beyond the gate becomes a `SOFT KILL`.

SRBOC damage lengthens cooldown and round flight time. At or below 5% health, it cannot deploy chaff.

<a id="maneuver-and-ciws"></a>
## 11. Ship Maneuver and CIWS

The ship performs a simplified OODA maneuver decision once per second. When a valid close threat exists, USS Long Beach chooses a direction approximately perpendicular to the threat axis and accelerates to available maximum speed. This imposes additional terminal turn demand on the incoming missile.

Propulsion health and hull integrity limit maximum speed. Propulsion damage also reduces acceleration and turn rate.

CIWS only handles surviving threats at very short range:

- It checks forward/aft mount sectors, closing speed, remaining engagement window, and traverse error.
- It holds fire for blind sectors, opening targets, or a closed window.
- Each burst consumes 60 rounds.
- PK depends on missile type, local saturation, available bursts, and CIWS health.
- Kh-22’s terminal speed imposes a strict CIWS PK ceiling.

<a id="subsystem-damage"></a>
## 12. Subsystem Damage

<a id="damage-allocation"></a>
### Hit Location and Damage Allocation

A leaker first reduces hull integrity, then damages equipment according to:

- The missile’s initial approach direction relative to the ship’s longitudinal axis.
- The missile’s persistent aim bias.
- A small deterministic fragmentation perturbation.
- The equipment pool associated with the forward, amidships, or aft hit zone.

Each impact produces one primary casualty and a smaller fragmentation casualty. Hit zone, equipment name, and health changes are written to the combat log and AAR. Probabilistic outcomes use fixed deterministic sources so an identical setup is normally reproducible.

<a id="damage-effects"></a>
### Mechanical Effects of Damage

| Subsystem | Actual Effect of Damage |
|---|---|
| AN/SPS-48E | Reduces 3D range and quality, increases revisit time; failure prevents altitude/fire-control updates |
| AN/SPS-49 | Reduces 2D warning range and quality, increases revisit time |
| AN/SPG-55 | Reduces illuminator slew speed and available channel count |
| Mk 10 AFT/FWD | Independently slows mount slew and reload; failure cancels and disables the mount |
| CIWS | Reduces traverse, firing cadence, and PK; failure stops tracking and fire |
| AN/SLQ-32 | Reduces ECM power and allows earlier seeker burn-through |
| Mk 36 SRBOC | Increases cooldown and round flight time; failure blocks shipboard chaff |
| PROPULSION | Reduces maximum speed, acceleration, and turn rate |

The `DAMAGE CONTROL` panel shows continuous health for all nine entries. Below 65% is degraded; at or below 5% is `FAIL`.

<a id="presentation"></a>
## 13. 3D Presentation and Ship Model

USS Long Beach is represented by a procedural model built around recognizable features:

- A faceted hull with narrowing bow and stern sections.
- Bridge, masts, deck fittings, hull number, flag, navigation lights, and survival equipment.
- AN/SPS-48E, AN/SPS-49, and SPG-55-inspired shapes and animation.
- Forward and aft Mk 10 twin-arm mounts with trunnions, yokes, hydraulics, loading rails, and safety markings.
- Forward/aft CIWS and visual abstractions for Mk 36/EW antennas.
- Track lines, seeker fields of view, illumination beams, exhaust, booster separation, and debris.
- Sea surface, wake, explosions, persistent fire/smoke, and electronic-warfare pulses.
- Distance-sensitive detail groups for close views and mobile performance.

![Mk 10 firing and ship detail](mk10-firing.png)

<a id="aar"></a>
## 14. After Action Review

The simulation records a tactical snapshot every 0.25 seconds with ship position/heading/hull, incoming missiles, interceptors, and chaff clouds. At mission end the AAR provides:

- Threats, SAM shots, hard kills, soft kills, leakers, hull, and system-health metrics.
- A 2D tactical replay with play, pause, scrub, start, and end controls.
- A complete event timeline categorized as sensor, fire, guidance, maneuver, effect, or system.
- Click-to-jump from any event to the nearest tactical snapshot.

Victory waits for active Mk 10 mounts to return and reload so the AAR does not freeze a mechanical cycle halfway through.

<a id="values-and-units"></a>
## 15. Values, Units, and Determinism

- Horizontal scale: `10 world units = 1 km`.
- Altitude input: `1 world unit = 50 m`.
- Velocity is stored in world units per second and must not be read as published weapon speed.
- Radar range, burn-through, turn rate, ammunition, and damage are game-balance values.
- Probability uses deterministic pseudo-random sequences or deterministic mathematical rolls; identical setups normally reproduce identical outcomes.
- Three.js uses Y as altitude; ship-local +X points toward the bow.

<a id="project-structure"></a>
## 16. Project Structure

```text
game-codewar-intercept/
├─ index.html          # HUD and base page structure
├─ src/
│  ├─ main.ts          # 3D model, combat loop, guidance, EW, damage, UI, AAR
│  ├─ sim.ts           # Dual-radar scanning, association, error, fire-control solution
│  └─ style.css        # Desktop/mobile HUD, damage-control panel, AAR styling
├─ package.json        # Vite/TypeScript scripts and dependencies
├─ tsconfig.json       # TypeScript configuration
├─ README.md           # Chinese documentation
└─ README_EN.md        # English documentation
```

The runtime deliberately remains compact for rapid iteration. As fleet logic, tests, and content grow, the next architectural step should separate sensors, weapons, platforms, UI, and AAR into dedicated modules.

<a id="development"></a>
## 17. Development and Verification

The base quality gate is:

```bash
npm run build
```

After changing combat logic, verify at least:

1. Single-target manual/automatic fire and a complete Mk 10 cycle.
2. Multi-target channel and assignment behavior under a salvo.
3. RIM-67 active-seeker capture and break-lock behavior.
4. SM-2 SPG-55 illumination and illumination loss.
5. ECM burn-through, SRBOC airburst, false-target capture, and soft kill.
6. Primary/secondary subsystem damage and its effect on subsequent combat.
7. AAR timeline, scrubbing, playback, and event jumps.
8. Desktop and `390 x 844` mobile layouts without overflow or incoherent UI overlap.
9. No browser console errors.

The repository contains development verification screenshots for the hull, radars, launchers, EW, damage, combat states, and mobile layouts.

<a id="known-boundaries"></a>
## 18. Known Boundaries and Future Work

- Only USS Long Beach is present; there are no escorts, AEW aircraft, or CEC network.
- Curvature, weather, sea state, and radar propagation use simplified relationships.
- There is no continuous six-degree-of-freedom aerodynamic rigid body; flight is a 3D point-mass approximation.
- Seekers and ECM are explainable probability/signal models, not RF engineering simulations.
- The procedural ship emphasizes recognizable silhouette and combat equipment, not survey-grade digital-twin accuracy.
- Damage control does not yet model repair teams, fire spread, power distribution, or redundant wiring.
- There is no automated test suite yet; current gates are the TypeScript build and Playwright browser scenarios.

Logical next steps include fleet track sharing, CEC network penalties, additional platforms, repair/power networks, mission saves, and richer AAR data export.

<a id="license-and-security"></a>
## 19. License and Security

No open-source license is currently included. Default copyright rules apply until a license is added.

Do not commit API keys, access tokens, or other credentials. `KEYS/` is intended for local credential storage and must remain outside version control. Real ship and weapon names are used for historical setting and game recognition; all implementation values should remain explicitly identified as game-scaled.

---

<div align="center">

[Back to Table of Contents](#table-of-contents) · [中文文档](README.md)

</div>
