# Bot AI Intelligence Improvement Plan

## Goal
Improve bot survival and decision quality so bots:
- stop pathing straight into lethal fights
- actively and safely grind shapes instead of hovering in place
- only pressure Dominion zone tanks when they have enough level and support
- treat Dominion bullets as a real threat and dodge them earlier

## Current Findings

### 1. Farming is lower priority than too many risky objectives
Files:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:513)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:584)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:606)

What is happening:
- `chooseBehavior()` evaluates hostile combat, portal transit, and Dominion objective routing before shape farming.
- A bot can enter `HUNT` for Dominion pressure as long as it is not under immediate danger, which is a very narrow safety gate.
- This causes bots to rotate toward contested Dominion space when they should still be farming.

Why it feels bad:
- low and mid-level bots abandon safe XP income too early
- bots feed into zone pressure without enough stats or backup

### 2. FARM steering still allows low-motion hovering
Files:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:1088)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:1140)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:1465)

What is happening:
- `computeRangeControlForce()` uses the same hold/strafe/orbit family for both `COMBAT` and `FARM`.
- In the workable range band, farming blends `strafe`, `hold`, `orbit`, and light pursuit.
- The `hold` term is still strong enough that bots can flatten into shallow movement when a shape is already inside a preferred range band.

Why it feels bad:
- bots look indecisive while grinding shapes
- they can sit inside danger lanes instead of circling through safer farming angles

### 3. Dominion challenge logic is still too permissive
Files:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:2133)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:2673)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:2852)

What is happening:
- `pickDominionObjective()` scores nearby zone tanks mostly by urgency, support delta, and distance.
- There is no explicit level gate, no score/power gate, and no minimum friendly commit count for hostile-zone pushes.
- `getDominionEngagementBias()` can still return a positive bias even when the squad is not truly ready to challenge a zone tank.

Why it feels bad:
- weak bots challenge Dominion defenders too early
- a single nearby ally can be enough to make the push feel acceptable

### 4. Bullet avoidance is reactive, local, and not Dominion-aware enough
Files:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:361)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:1687)
- [services/GameEngine.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/GameEngine.ts:9962)

What is happening:
- `scan()` only sees bullets inside the bot vision radius plus a fixed projectile padding.
- `computeDodgeForce()` reacts to bullets based on closest-approach math, but uses a fixed danger lane and limited future horizon.
- Dominion tanks lead shots and continuously fire into a zone corridor, but the AI does not add extra caution for bullets originating from Dominion tanks or for lanes aimed at a contested zone approach.

Why it feels bad:
- bots often commit into a Dominion fire lane before the dodge force becomes strong enough
- they dodge individual bullets instead of respecting sustained zone denial

## Recommended Changes

### Phase 1. Add stronger “farm first unless ready” gates
Primary file:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts)

Changes:
- Add a dedicated Dominion readiness helper, for example `isReadyForDominionPush(bot, neighbors, zoneTank)`.
- Gate hostile Dominion objectives behind:
  - minimum level threshold
  - minimum health ratio
  - minimum nearby friendly tank count
  - favorable or at least even local support ratio
- Keep defensive retakes for allied zones more permissive than hostile captures.
- If a bot fails the readiness test, let it keep farming or rotate around resource-rich lanes instead of forcing the Dominion route.

Recommended heuristics:
- hostile Dominion challenge:
  - level `>= 24` for neutral zones
  - level `>= 30` for enemy-owned zones
  - health ratio `>= 0.68`
  - at least `2` nearby friendlies for neutral contest
  - at least `3` nearby friendlies for enemy-owned contest
  - support delta must be `>= 0` for neutral, `>= +1` for enemy-owned
- allied zone defense:
  - allow earlier response at level `>= 16`
  - allow lower health threshold if multiple allies are already present

### Phase 2. Give FARM movement its own aggressive-but-safe motion profile
Primary file:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts)

Changes:
- Split FARM steering from general combat steering inside `computeRangeControlForce()`.
- Reduce stationary `hold` influence for farm targets.
- Increase orbit/strafe weight while farming.
- Add a “drive-through” preference so the bot keeps moving across shape clusters instead of parking at one optimal band.
- If the current farm target is low value and movement drops below a threshold for several ticks, retarget to a nearby shape cluster or a resource centroid lane.

Recommended behavior:
- FARM should prefer:
  - orbit + lateral movement
  - soft pursuit toward cluster centroids
  - quick retargets when a shape is isolated, crowded, or dangerous
- FARM should avoid:
  - zero-motion hold patterns
  - face-tanking crashers or large bodies just because range math says “in band”

Specific implementation ideas:
- add a FARM-only `minMotionBias`
- increase `memory.orbitUntilTick` frequency when farming
- weaken `hold` weight in FARM from the current mixed posture
- add a mild centroid drift using `frame.resourceCentroid`

### Phase 3. Make Dominion objective scoring account for power and commitment
Primary file:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:2133)

Changes:
- Extend `pickDominionObjective()` scoring with:
  - bot level
  - bot score or available stat progression proxy
  - local friendly commit count
  - hostile Dominion tank ownership state
  - incoming bullet pressure around the zone approach
- Penalize hostile captures hard when:
  - the bot is still early phase
  - local enemy support exceeds local ally support
  - Dominion bullet pressure is already active in the approach lane

Recommended helper additions:
- `countNearbyCommittedAllies(bot, neighbors, zonePos, radius)`
- `getDominionPushReadiness(bot, neighbors, zoneTank, projectilePressure)`
- `getDominionLaneProjectileDanger(bot, zoneTank, neighbors)`

### Phase 4. Upgrade projectile danger perception for Dominion bullets
Primary files:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:361)
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts:1687)
- [services/GameEngine.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/GameEngine.ts:9962)

Changes:
- In `scan()`, classify hostile bullets by likely source severity where possible:
  - Dominion tank bullets
  - heavy sniper bullets
  - normal bullets
- Increase projectile pressure for bullets fired by Dominion tanks or passing through Dominion objective corridors.
- In `computeDodgeForce()`, expand dodge horizon and danger lane for:
  - high-speed bullets
  - Dominion-origin bullets
  - multiple bullets occupying parallel lanes
- Add a “lane rejection” force so bots avoid stepping into a Dominion firing lane even before a single bullet becomes point-blank.

Recommended implementation ideas:
- resolve bullet owner via `ownerId` when available
- if bullet owner is `EntityType.DOMINION_TANK`, apply:
  - wider danger lane
  - stronger time urgency
  - longer anticipation window
- add a soft avoidance field from the segment between a Dominion tank and its intercept point region

### Phase 5. Teach bots to disengage from bad Dominion pushes faster
Primary file:
- [services/systems/AISystem.ts](/c:/Users/deadi/Downloads/vextor.io%20(1)/services/systems/AISystem.ts)

Changes:
- If a bot is on a Dominion objective and:
  - ally support drops
  - projectile pressure spikes
  - health falls below threshold
  - route lane danger becomes too high
  then downgrade from `HUNT` to `FARM` or `FLEE` instead of persisting on the route.

Recommended downgrade order:
- hostile zone push -> fallback farm route
- neutral zone push under pressure -> regroup outside zone radius
- allied zone defense under overwhelming fire -> kite and re-enter with allies

## Suggested Implementation Order
1. Add Dominion readiness gating helpers.
2. Retune `chooseBehavior()` so farming wins whenever Dominion readiness is not met.
3. Split FARM steering from COMBAT steering.
4. Add active farm-motion and anti-stall retarget logic.
5. Add Dominion bullet severity and corridor danger weighting.
6. Add fast disengage logic for collapsing Dominion pushes.
7. Build/test, then tune thresholds.

## Verification Checklist
- Bots below mid level keep farming instead of suiciding into Dominion zones.
- Bots circle and reposition while farming instead of pausing in place.
- Bots only challenge enemy Dominion tanks with enough nearby allies.
- Bots retreat or reroute when Dominion support flips against them.
- Bots visibly sidestep Dominion bullet lanes earlier.
- Bots still defend allied Dominion zones when the response is reasonable.
- `npm run build`

## Success Criteria
- Farming bots gain levels more consistently.
- Dominion deaths from isolated bot pushes drop noticeably.
- Dominion fights look more squad-based instead of one-by-one feeding.
- Bots spend less time frozen in unsafe resource lanes.
- Bullet dodging looks intentional rather than last-second panic movement.
