# Missile Parameter Catalog

> Incoming-threat table updated against main · 2026-10-24 (Unreleased); other tables retain their earlier snapshot.

[Weapons](README.md) | [中文](../../WEAPONS/MISSILE_PARAMETERS.md)

All distances, altitudes, and speeds below are simulation world units. They are useful only for relative comparison inside this game.

## Air weapons

| Weapon | Target | Guidance | Min/max range | Speed | Boost s | Turn °/s | Seeker range/FOV | Damage | CM resistance | Mass kg |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| AIM-54A Phoenix | Aircraft | Active radar | 12 / 1380 | 19 | 6 | 17 | 170 / 55° | 72 | 0.72 | 460 |
| AIM-7F Sparrow | Aircraft | Semi-active radar | 5 / 460 | 15 | 4 | 24 | 36 / 42° | 64 | 0.58 | 230 |
| AIM-9L Sidewinder | Aircraft | Infrared | 2 / 115 | 12 | 3 | 42 | 52 / 48° | 58 | 0.52 | 86 |
| R-27R Alamo-A | Aircraft | Semi-active radar | 6 / 590 | 14.5 | 5 | 25 | 42 / 44° | 66 | 0.60 | 253 |
| R-73 Archer | Aircraft | Infrared | 1.5 / 135 | 11.5 | 3.2 | 48 | 58 / 62° | 56 | 0.56 | 105 |
| KSR-5 Kingfish | Ship | Anti-ship radar | 80 / 900 | 10.4 | 8 | 7 | 125 / 50° | 48 | 0.66 | 3900 |
| AGM-84A Harpoon | Ship | Anti-ship radar | 25 / 430 | 6.2 | 3 | 12 | 115 / 50° | 22 | 0.64 | 690 |

## Air-to-air propulsion

| Weapon | Sustain s | Coast drag/s | Minimum speed factor | Max flight s | Loft altitude | Loft transition range |
|---|---:|---:|---:|---:|---:|---:|
| AIM-54A | 24 | 0.009 | 0.38 | 110 | 210 | 360 |
| AIM-7F | 10 | 0.018 | 0.42 | 55 | 125 | 170 |
| AIM-9L | 4 | 0.032 | 0.45 | 28 | 0 | 0 |
| R-27R | 12 | 0.017 | 0.40 | 62 | 145 | 210 |
| R-73 | 4.5 | 0.030 | 0.44 | 30 | 0 | 0 |

## Incoming anti-ship missiles

| Weapon | Profile | Cruise/terminal altitude | Cruise/terminal speed | Terminal at | Turn | Default range | RCS | Burn-through | Damage | CIWS penalty |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P-15 Termit | Sea-skimming | 1.95 / 0.25 | 6.2 / 6.4 | 240 | 8 | 400 | 0.65 | 28 | 32 | 0.06 |
| P-500 | Sea-skimming | 1.2 / 0.3 | 8.8 / 9.6 | 180 | 8 | 600 | 0.42 | 30 | 28 | 0.10 |
| P-700 | Sea-skimming | 2.6 / 0.4 | 9.8 / 10.8 | 220 | 6.5 | 750 | 0.70 | 36 | 38 | 0.16 |
| Kh-22 | High altitude | 360 / 2.2 | 13.2 / 15.2 | 450 | 4.5 | 1000 | 1.10 | 26 | 46 | 0.30 |
| RGM-84 Harpoon | Sea-skimming | 0.9 / 0.12 | 5.8 / 6.4 | 130 | 11 | 420 | 0.18 | 22 | 20 | 0.08 |
| [R-360 Neptune](R360_NEPTUNE.md) | Sea-skimming | 0.3 / 0.1 | 5.8 / 6.4 | 130 | 11 | 500 | 0.14 | 22 | 18 | 0.08 |
| [3M24 Uran](3M24_URAN.md) | Sea-skimming | 0.3 / 0.08 | 5.8 / 6.4 | 130 | 11 | 420 | 0.12 | 22 | 17 | 0.08 |
| [ASM-1](ASM1_TYPE80.md) | Sea-skimming | 0.4 / 0.14 | 5.8 / 6.4 | 130 | 11 | 360 | 0.13 | 22 | 18 | 0.08 |
| [RBS-15 Mk. II](RBS15_MK2.md) | Sea-skimming | 0.3 / 0.1 | 5.8 / 6.4 | 130 | 11 | 460 | 0.17 | 22 | 24 | 0.08 |
| [MM38 Exocet](MM38_EXOCET.md) | Sea-skimming | 0.3 / 0.1 | 5.8 / 6.4 | 130 | 11 | 340 | 0.13 | 22 | 20 | 0.08 |

The five additions support sandbox and scenario JSON `in-flight` waves only, without physical launch platforms or aircraft. HOJ, pop-up and weaving are disabled. Default range means spawn distance, not real-world maximum range. Individual pages separate public references from game assumptions and limits; RBS-15 Mk. II postdates the default Cold War scenario.

Harpoon selects from three skim entries and one pop-up entry. Pop-up begins at 48 world units and peaks at altitude 2.4. HOJ becomes eligible at jamming strength 0.42 with residual-error factor 0.18. Kh-22 has an additional CIWS probability cap of 0.14.

## Shipboard interceptors

| Weapon | Min/max range | Max speed | Boost s | Acceleration | Turn °/s | Terminal range |
|---|---:|---:|---:|---:|---:|---:|
| RIM-67 | 20 / 750 | 12.5 | 5.2 | 3.1 | 18 | 180 |
| SM-2MR | 15 / 450 | 13.5 | 4.4 | 3.6 | 22 | 100 |
| SM-2ER | 22 / 900 | 14.2 | 6.2 | 3.3 | 16 | 190 |

These are flight envelopes, not automatic launch ranges. Organic track quality, fire-control channels, illuminators, magazine state, launcher state, and doctrine remain mandatory.
