# RBS-15 Mk. II

> Current main · Unreleased. Mk. II only; no Mk. III/IV land attack, GPS or extended-range capability.

[Weapons](README.md) · [Parameters](MISSILE_PARAMETERS.md) · [中文](../../WEAPONS/RBS15_MK2.md)

## Public references and variant boundary

Swedish Saab subsonic sea-skimming anti-ship missile with turbojet cruise propulsion, inertial navigation and terminal active radar guidance. Ship-launch boosters have separated in the cruise configuration shown here. Public history dates Mk. II production to 1998: **later than the default Cold War scenario**, so this is an optional sandbox threat.

Public Mk. II range descriptions differ between “70+ km” and approximately 100 km; retain that uncertainty rather than borrowing the Mk. III 200 km or Mk. IV 300+ km figures. Common family dimensions are approximately 4.35 m length, .5 m diameter and 1.4 m span. Saab's current dimensions and approximately 200 kg warhead table explicitly describes Mk. III/Gungnir, not an independently verified Mk. II specification. Those figures inform the family silhouette only; they do not establish real hit probability or damage.

## Appearance and game implementation

![RBS-15 Mk. II procedural asset](../../../verification-threat-rbs-15-mk-ii-ultra.png)

- Stable ID: `RBS-15 Mk. II`; definition: `src/threats/rbs15.ts`; preset: `RBS-15 RAID`.
- Reference photograph labeled RB 15 Mk II informs the broad body, dark rounded radome, small forward control surfaces, large aft wings and rounded ventral intake. Boosters are absent in this cruise asset.
- Cruise/terminal altitude `.3 / .1`, speed `5.8 / 6.4`, damage `24` and RCS `.17` are game assumptions. Spawn distance `460` world units is not real maximum range; damage is not a direct warhead-mass conversion.
- `in-flight` waves only: no additional launch ship, truck or aircraft loadout. Reuse radar, SAM/CIWS, ECM, chaff and AAR/Tacview; no HOJ, pop-up, weaving or land attack.
- Pre-spawned threats retain simplified terminal activation and countermeasure diversion, without a new independent acquisition/loss state machine, real turbojet thrust curve or later-generation route planning.

## Sources

Consulted 2026-10-24.

- [RBS 15 — Wikipedia](https://en.wikipedia.org/wiki/RBS_15): variant history, propulsion and guidance; prose and variant table disagree about range.
- [Saab RBS15 family](https://www.saab.com/products/the-rbs15-family): current Mk. III/IV product boundary; their range, GPS and land-attack capabilities are not assigned to Mk. II.
- [RB 15 Mk II museum photograph](https://commons.wikimedia.org/wiki/File:RBS_15_MM_24325.jpg): visual reference. Only our procedural render is committed, not this photograph.
