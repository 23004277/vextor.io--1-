# Changelog

## v1.8.1 - Command Interface Sync
Date: 07/06/26

### Summary
- Focused on main menu presentation, spectate stability, beat-reactive soundtrack visuals, and update-log delivery so the command interface feels cleaner, smarter, and more alive.

### Main Menu Command Deck
- Remastered the home screen into a cleaner fixed-height cockpit layout with better panel balance, larger featured leaderboard presence, and less wasted space.
- Removed the empty scroll slab under the main menu by locking the shell to viewport height and tightening panel spacing, footer sizing, and hero-stage proportions.
- Improved menu readability by reducing clipped labels, letting key update and mode text wrap properly, and redistributing control/navigation panels into more intentional zones.

### Spectate And Frontend Stability
- Reworked spectate mode so it can reliably follow live bots instead of drifting into invalid targets or weak observer states.
- Refined the spectate launch flow and observer presentation so bot-watching feels like a real feature instead of a fallback utility button.
- Hardened achievement toast cleanup so rewards now dismiss after 1.75 seconds without getting stuck on screen from stale timing state.

### Mainframe Audio Reactor
- Switched the menu soundtrack over to `Final_Sector_Charge.mp3` and kept it menu-only with proper fade-in, fade-out, and in-match mute behavior.
- Expanded the audio visualizer into a full hero-stage reactor that uses beat pulse, downbeat accenting, timeline progress, and loop state instead of a tiny passive meter.
- Improved visualizer sync so columns, orb pulse, and glow spikes react harder to musical hits and stronger bar transitions.

### Patch Relay And Release Notes
- Extended the release-note pipeline so the in-game update archive, changelog file, and Discord relay can be sourced from the same more detailed release structure.
- Added richer patch-note framing for recent feature drops including menu remasters, objective warfare, bot intelligence, and interface polish.
- Prepared the latest release packaging so Discord update announcements can reflect the current live feature set more accurately.

## v1.8.0 - Dominion And Void Ascent
Date: 05/06/26

### Summary
- Large systems update focused on four-team objective warfare, staged wormhole transit, tougher backend hardening, and smarter bots that read pressure, objectives, and extraction flow more reliably.

### Dominion Warfare
- Launched Dominion as a four-team control mode with corner safe zones, live objective scoring, and dominion point ownership tracked on the tactical HUD and minimap.
- Reworked dominion objective tanks into distinct defensive variants instead of identical turret walls, including Destroyer, Gunner, Trapper-style barrier control, and Triple loadouts.
- Adjusted Dominion HUD priority so objective awareness and tactical map presence matter more than personal leaderboard noise during capture fights.

### Void Transit
- Rebuilt wormhole travel into staged portal flow with lock, inversion, breach, and shift phases so entering the Void reads like a sequence instead of a bugged instant snap.
- Removed the fragile one-second timeout-based dimension jump and replaced it with engine-driven transition handling for cleaner entry, exit, and evac behavior.
- Stabilized white exit portal behavior so extraction is more reliable and transit groups preserve the right tanks, summons, and projectile ownership through dimension swaps.

### Bot Intelligence
- Extended bot pathfinding with stronger route-risk scoring, stuck recovery, hazard avoidance, and objective routing across Teams, Dominion, and general combat modes.
- Improved combat discipline so enemy tanks commit harder when healthy, retreat later, choose cleaner targets, and stop wasting shots or body-slamming dangerous farm targets.
- Taught bots to understand wormholes and void extraction windows so they can pursue transit opportunities instead of acting blind to portal state.

### Progression And PvE
- Retuned tank-kill rewards, crasher rewards, shape distribution, and common farm pacing so progression stays steadier across normal combat, PvE clearing, and rebirth-tier encounters.
- Expanded the shape roster and visual language with new forms and cleaner spawn and defeat presentation to make resource fields read less repetitively.
- Reworked boss and elite behavior to reduce runaway speed, improve class barrel fidelity, and create clearer boss-fight patterns instead of pure rush pressure.

### Interface And Security
- Remastered core match HUD surfaces, tactical rails, health and XP presentation, support terminal, archive styling, and almanac readability to reduce combat clutter.
- Added stronger backend-side abuse resistance for session stat writes, leaderboard submissions, invalid equips and purchases, support totals, and suspicious duplicate score traffic.
- Improved trust-facing presentation with richer update notes, cleaner shared-link previews, and clearer player feedback for rewards, achievements, and combat telemetry.

## v1.7.0 - Tactical Systems Remaster
Date: 15/05/26

### Summary
- Major battlefield intelligence, interface, and presentation overhaul focused on smarter bots, cleaner archives, safer progression, and stronger social trust.

### Combat Intelligence
- Remastered TDM and FFA bot logic so tanks make better shot decisions instead of spraying mindlessly.
- Added stronger pathfinding, pressure awareness, local danger spacing, and target scoring for AI squads.
- Elite boss variants now spawn properly in live matches and use their own movement brains, anchor logic, and combat styles.

### World And PvE
- Shapes now enter the arena with improved spawn animation timing and cleaner defeat effects.
- Common farm targets like yellow squares and red triangles appear more often for steadier progression.
- Shapes no longer destroy each other by bumping into one another, preserving map flow and XP consistency.

### Systems And Security
- Added a lightweight anti-abuse layer for purchases, equips, support actions, leaderboard updates, and callsign changes.
- Closed reward-skin loopholes so achievement cosmetics cannot be acquired for free through the market flow.
- Supporter skin resonance now hooks into live supporter totals and rank-aware account data.

### Interface And Sharing
- Rebuilt the almanac into a cleaner tactical database with less clutter and much lighter rendering cost.
- Refined the hangar and shop structure for better readability and smoother browsing.
- Added a dedicated social preview card image and tuned link metadata so shared Vextor links present more cleanly across platforms that support rich previews.

## v1.6.0 - Achievement Protocol
Date: 24/04/26

### Summary
- Deployed tactical achievement tracking, elite unlock rewards, and long-run progression hooks for account-backed pilots.

### Pilot Records
- Launched the achievement system for combat milestones, survivability benchmarks, and elite takedowns.
- Introduced exclusive chassis rewards tied to gameplay progression instead of store access.

## v1.5.0 - Tactical Remaster
Date: 03/04/26

### Summary
- Focused on readability upgrades, interface feedback, and battlefield browsing tools.

### Interface Layer
- Remastered the Vextor OS almanac presentation for stronger readability and navigation.
- Improved tactical cursor feedback and overall menu clarity.
- Tuned regeneration-facing combat presentation for more legible match flow.

## v1.4.8 - Social Link Sync
Date: 13/03/26

### Summary
- Opened the social support layer and external hub links for pilots following development.

### Community Systems
- Integrated the tactical Discord hub into the live menu flow.
- Added command support pathways for players who want to back active development.

## v1.4.5 - UI Overhaul
Date: 20/02/26

### Summary
- Main menu remaster with stronger structure, cleaner navigation, and better terminal presentation.

### Main Menu
- Reframed the home screen around tactical clarity and cleaner navigation terminals.
- Improved layout organization and reduced visual clutter across menu surfaces.
