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
