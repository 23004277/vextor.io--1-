# Power-Crept Tank Balance Plan

## Goal
Buff the tanks that have clearly fallen behind without destabilizing the classes that are already strong, recently reworked, or highly scalable.

## Most Clearly Power-Crept Targets

### Primary pass
- `Machine Gun Trapper`
- `Sprayer`
- `Triple Tank`
- `Spread Shot`
- `Quad Tank`
- `Penta Shot`
- `Twin Flank`
- `Triple Twin`
- `Manager`

### Secondary pass
- `Plague Doctor`
- `Vampire`

## Root Causes
- Several weak classes are losing value through local cooldown, cadence, and projectile multipliers rather than through one obvious global bug.
- Some branches are structurally outdated compared with their peers:
  - `Machine Gun Trapper` is held back by weak trap/projectile values.
  - `Sprayer`, `Triple Tank`, `Spread Shot`, `Quad Tank`, `Penta Shot`, `Twin Flank`, and `Triple Twin` feel under-rewarding for their tier.
  - `Manager` trails the main drone branch in uptime and pressure.
- Some classes are also suffering from stale role logic:
  - trapper bots position too generically
  - `Plague Doctor` is grouped with support logic but lacks a strong offensive-support identity

## Recommended Implementation Order

### Phase 1: Low-risk numeric buffs
Touch only class-local tuning knobs first.

Files:
- [constants.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/constants.ts)
- [services/GameEngine.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/GameEngine.ts)

Targets:
- `CLASS_PROJECTILE_MODIFIERS`
- `CLASS_FIRE_RATE_MULT`
- `getSequentialCadenceMultiplier`
- `getClassMinCooldown`
- `getTrapperProfile`
- class-local projectile tuning inside `fireBullet`

Recommended first-pass buffs:
- `Machine Gun Trapper`
  - raise projectile modifiers from `0.94 / 0.96` to about `1.0 / 1.05`
  - raise trap `damageMultiplier` `0.92 -> 0.98`
  - raise trap `healthMultiplier` `1.8 -> 2.0`
  - optionally raise `activeTrapCap` `14 -> 15`
- `Sprayer`
  - fire-rate mult `0.82 -> 0.80` or `0.78`
  - side-bullet damage `0.84 -> 0.88`
  - only raise core damage if still weak after testing
- `Triple Tank`
  - fire-rate mult `0.76 -> 0.72`
  - damage `1.18 -> 1.22`
  - projectile life `1.16 -> 1.18`
- `Quad Tank`
  - damage `0.90 -> 0.94`
  - life `1.02 -> 1.06`
- `Penta Shot`
  - damage `0.88 -> 0.91`
  - life `1.12 -> 1.15`
- `Spread Shot`
  - raise base damage `0.82 -> 0.86` or side pellet multiplier `0.76 -> 0.80`
  - do not heavily buff center pellet
- `Twin Flank`
  - fire-rate mult `0.90 -> 0.86`
  - damage `0.98 -> 1.00`
- `Triple Twin`
  - fire-rate mult `0.96 -> 0.90`
  - damage `0.96 -> 0.99`
  - life `1.08 -> 1.10`
- `Manager`
  - mini-tank cap `6 -> 7`
  - spawn floor `300 -> 270`
  - collision pressure `1.4 -> 1.5`

### Phase 2: Role-expression fixes
Fix the classes whose behavior prevents their stats from mattering.

Files:
- [services/EnemyAITanks.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/EnemyAITanks.ts)
- [services/GameEngine.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/GameEngine.ts)

Recommended changes:
- Give `Machine Gun Trapper` a closer zoning distance than the heavier trapper variants.
- Make trapper bots retreat around trap arming space instead of generic wide kiting.
- Improve `Manager` summon consistency and pursuit quality before considering larger cap increases.
- Give `Plague Doctor` a clearer offensive-support hook rather than globally buffing support damage.
- If `Vampire` still feels stale, buff sustain feel or engagement window instead of raw aura damage.

### Phase 3: Identity-safe polish
Only do this after replay/testing.

Possible follow-ups:
- small `Plague Doctor` anti-shape or anti-enemy chip buff
- small `Vampire` radius or lifesteal feel pass
- minor trap visual/behavior readability adjustments if buffs make trap density rise

## Classes To Avoid Buffing In This Pass
- `Destroyer`, `Annihilator`, `Hybrid`
- `Overseer`, `Overlord`
- `Sniper`, `Assassin`, `Ranger`, `Stalker`
- `Gunner`, `Auto Gunner`, `Streamliner`
- rebirth/boss classes
- base `Trapper` and `Dual Trapper` until `Machine Gun Trapper` is retested

Reason:
- these branches already have strong bespoke scaling, strong projectile modifiers, or recent balancing history

## Critical Files
- [constants.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/constants.ts)
- [services/GameEngine.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/GameEngine.ts)
- [services/EnemyAITanks.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/EnemyAITanks.ts)

## Verification Plan
- Run build/typecheck after each wave.
- Test buffed classes in sandbox at:
  - no upgrades
  - mid upgrades
  - max reload/damage/penetration
- Compare them against:
  - shapes
  - `Overlord`
  - `Destroyer`
  - `Gunner`
  - `Booster`
  - `Streamliner`
- Confirm:
  - weak classes become viable in their intended niche
  - trapper AI actually lays useful traps
  - `Manager` feels more alive without turning into a stronger `Overlord`
  - support classes do not become accidental damage monsters

## Success Criteria
- Power-crept tanks feel meaningfully better in live play.
- No class gains both huge uptime and huge per-hit damage in the same pass.
- The strong meta classes still keep their specialty, but the weak branches stop feeling like strictly worse picks.
