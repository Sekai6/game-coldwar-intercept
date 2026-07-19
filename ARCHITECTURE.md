# Architecture

The simulation is organized around capabilities rather than ship-name checks.

## Module ownership

- `src/main.ts`: scene orchestration, UI adapters, and the frame loop.
- `src/ship-catalog.ts`: ship registration and per-class capability metadata.
- `src/ship-types.ts`: ship capability contracts shared by the catalog and runtime.
- `src/models/long-beach.ts`: CGN-9 procedural model and Mk 10 visual components.
- `src/models/ticonderoga.ts`: CG-47-class procedural model and Mk 41 visual components.
- `src/combat-types.ts`: shared runtime domain types.
- `src/missile-data.ts`: interceptor and threat flight profiles.
- `src/sim.ts`: sensor scans, uncertain tracks, and fire-control solutions.
- `src/sensor-faces.ts`: fixed-array aspect coverage and localized damage.
- `src/vls.ts`: pure VLS load planning, geometry, and damage math.

## Adding a ship

1. Implement a model builder that exposes the equipment anchors required by its declared launcher and sensors.
2. Add one `ShipDefinition` entry to `ship-catalog.ts` with sensors, launcher capability, magazines, subsystem labels, and subsystem positions.
3. Add fixed sensor faces only when the ship uses fixed arrays. Mechanical sensors require no face-specific branch.
4. Do not add `activeShip.id` checks to `main.ts`. Add a capability to `ShipDefinition` when behavior genuinely differs.

## Adding a missile

1. Extend `EnemyType` or `WeaponType` in `combat-types.ts`.
2. Add its physical/game-scaled flight profile to `missile-data.ts`.
3. Keep rendering-specific geometry separate from guidance and engagement parameters.

Model modules expose equipment anchors through `Object3D.userData`; combat behavior reads capabilities from `ShipDefinition` and must not infer them from a model or ship name.
