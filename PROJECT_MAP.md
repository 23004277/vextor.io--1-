# PROJECT_MAP

Quick reference for what each major file does and how the app is wired.

## Core App Flow

- `App.tsx`
  - Root orchestrator for the whole app.
  - Manages top-level state: menu/game mode, user session, modals, settings, player callsign, and overlay visibility.
  - Connects `GameCanvas` (engine runtime), `MainMenu`, and all modal components.

- `components/GameCanvas.tsx`
  - Owns the HTML canvas mount.
  - Instantiates `GameEngine`.
  - Bridges keyboard/mouse input into the engine.
  - Emits engine state updates back to `App.tsx`.

- `services/GameEngine.ts`
  - Main gameplay runtime and ruleset.
  - Handles combat, movement, entities, class upgrades, abilities, AI, collision, scoring, and game loop state.
  - Produces `GameState` snapshots for UI rendering.
  - Recent additions:
    - Common-shape spawn controls: `commonShapeCooldown`, `commonShapeMaxActive`, and tuned spawn probabilities to avoid spawn chaos.
    - Visual redesign hook for common shapes via `drawCommonVisuals()` to centralize gradient/dash/accent rendering for `SQUARE`, `TRIANGLE`, and `PENTAGON` common variants.
    - Pentagons/nests and spawn zoning improvements; see `spawnShape()` and `pickShapeTypeForSpawn()` for spawn logic.

## UI / HUD / Menus

- `components/MainMenu.tsx`
  - Pre-game interface.
  - Callsign input, game mode/team selection, start/spectate actions, and menu-side profile/status panels.

- `components/UIOverlay.tsx`
  - In-game HUD and command surface.
  - Displays stats, upgrade controls, class evolution UI, ability cooldown cards, notifications, and live telemetry.

- `components/CustomCursor.tsx`
  - Replaces default cursor visuals with in-game styled cursor behavior.

- `components/TacticalTooltip.tsx`
  - Reusable tooltip layer for menu/HUD hover explanations.

## Player/Account and Backend

- `components/LoginModal.tsx`
  - Login/register UI and auth entry flow.

- `services/BackendService.ts`
  - Backend gateway for auth/session restore, user data, stats sync, shop actions, leaderboard operations.

- `services/FirebaseConfig.ts`
  - Firebase initialization and shared config exports.

## Progression / Content Panels

- `components/ShopModal.tsx`
  - Cosmetic and item purchase/equip panel.

- `components/AlmanacModal.tsx`
  - Knowledge/reference panel for game classes/content.

- `components/AchievementsModal.tsx`
  - Full achievement tracking panel.

- `components/AchievementPopup.tsx`
  - Lightweight unlock pop-up when achievements are newly earned.

## Shared Definitions

- `types.ts`
  - Shared enums/interfaces/types used across UI, engine, and services.
  - Includes `TankClass`, `StatType`, `GameState`, user/account and leaderboard models.

- `constants.ts`
  - Central constants/config values.
  - Includes stat colors, base balancing constants, shop items, achievements, update logs, and class metadata.

- `services/MathUtils.ts`
  - Shared utility math helpers used by gameplay and rendering logic.

- `services/SoundEngine.ts`
  - Audio runtime for SFX/music and UI feedback events.
  - Related files: `Background Music.ts` (menu audio control) — includes entry pause (3.75s) and end-of-track pause (5s) logic for music breaks and visualizer handoff.

## High-Level Dependency Map

1. `App.tsx` boots UI + mounts `GameCanvas`.
2. `GameCanvas.tsx` creates `GameEngine` and forwards input.
3. `GameEngine.ts` updates simulation and emits `GameState`.
4. `App.tsx` passes `GameState` into `UIOverlay.tsx` for HUD rendering.
5. Modals (`Login`, `Shop`, `Almanac`, `Achievements`, `Settings`) are controlled by `App.tsx`.
6. `BackendService.ts` + `FirebaseConfig.ts` handle persistent account/data concerns.

## Practical Notes for New Contributors

- Gameplay bugs usually live in `services/GameEngine.ts`.
- HUD/visual state mismatches are often in `components/UIOverlay.tsx` or how `GameState` is mapped in `App.tsx`.
- Input mapping issues are commonly in `components/GameCanvas.tsx`.
- Account/session bugs are usually in `services/BackendService.ts` + `components/LoginModal.tsx`.
 - AI logic and behavior are implemented in `systems/FFAAIStrategy.ts` (free-for-all goal selection, bullet avoidance) and `systems/TDM-ai.ts` (team/domination steering); recent work improved avoidance, panic behavior, and stuck-recovery.
 - Progression and balance tweaks live in `constants.ts` (e.g., `REBIRTH_LEVEL = 110`, `MAX_LEVEL = 130`) and in leveling/xp handling around elite/boss kills.
 - Shape preview rendering and shared trace helpers live in `components/ShapePreview.tsx` — use this for visual checks of redesigned shapes.

## Recent Engine & Balance Notes

- AI Improvements:
  - `systems/FFAAIStrategy.ts`: improved bullet avoidance, panic goal behavior, and decision weighting for safer target selection.
  - `systems/TDM-ai.ts`: better team steering, stuck recovery fixes, and more cautious pathfinding to avoid overcommitment.
  - Overall: tuning focused on target selection, avoidance heuristics, and cooldowns to make bots act more intelligently and less suicidal.

- Progression & Restart Behavior:
  - `constants.ts` updated with `REBIRTH_LEVEL = 110` and `MAX_LEVEL = 130` (see constants for exact values).
  - Improved XP gain scaling for high-level tank/boss kills to reduce grind at endgame tiers.
  - Respawn now supports world-preserve mode (`resetPlayer(true)`), allowing the player to resume without respawning all bots — used for in-match respawns.

## Common Shapes — Redesign & Spawn Controls

- Visuals:
  - Common `SQUARE`, `TRIANGLE`, and `PENTAGON` visuals have a unified drawing path via `drawCommonVisuals()` in `services/GameEngine.ts` for consistent gradient, dashed accents, and inner radial lines.
  - Use `components/ShapePreview.tsx` to preview and iterate on the new common shape styles.

- Spawn Controls:
  - `commonShapeCooldown`: short cooldown (seconds) preventing back-to-back common spawns to avoid bursts.
  - `commonShapeMaxActive`: cap on how many common shapes may be active simultaneously to prevent map overcrowding.
  - Spawn probability tuning increased base common spawn chance but gated by cooldown and active count checks in `spawnShape()` and spawn tick logic.
  - Pentagons/nests: spawn zones and pentagon nest clusters were refined to improve encounter pacing and pentagon availability.
