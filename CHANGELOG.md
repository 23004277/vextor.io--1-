# VEXTOR Changelog

## v1.9.1 - Sandbox Command Uplink
Date: 11/06/26
Theme: Sandbox / Combat / AI / Update Archive

This release resets the archive down to one clean current log and rolls the latest gameplay work into a single update drop that is easier to read in-game and in the repo.

### What Changed
- Replaced the older layered update archive context with one fresh live release entry so the patch log reads cleaner and matches the current build.
- Added the new `Trapper` class as a real Sniper-branch evolution with deploy-and-anchor star traps instead of standard shells.
- Reworked Dominion trap guardians into proper `Octo Trapper` objective tanks with dedicated trap-launcher behavior and area denial identity.
- Expanded the sandbox terminal so you can directly swap into rebirth boss chassis, preview updated class icons, spawn elite tank templates, and fabricate Dominion guardian variants.
- Fixed the trap projectile renderer crash by moving the star tracing logic into the bullet renderer scope where it belongs.
- Synced the shared sandbox spawn typing so `DOMINION_TANK` and Dominion weapon profiles no longer throw TypeScript mismatches between UI state and engine state.
- Continued AI tuning so Trapper-aware bots hold better spacing and use safer control ranges instead of misplaying the new trap archetype.

### Notes
- The in-game update archive and this file now intentionally keep only the newest release entry.
- This release is meant to read like the current live build snapshot rather than a running historical ledger.
