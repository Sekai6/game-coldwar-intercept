# Architecture

The simulation is organized around capabilities rather than ship-name checks.

## Module ownership

- `src/main.ts`: scene orchestration, UI adapters, and the frame loop.
- `src/ship-catalog.ts`: ship registration and per-class capability metadata.
- `src/ships.ts`: ship definition contracts and the Ticonderoga model builder.
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

The current remaining extraction boundary is the CGN-9 procedural model builder in `main.ts`. It should move to a dedicated model module without changing the `ShipDefinition` contract.
