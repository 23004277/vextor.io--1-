VEXTOR Changelog

v1.9.6 - Systems Overhaul, Sandbox Boss UX & Menu Remaster

- Main Menu Remaster: simplified the layout, cleaned spacing and scroll issues, reworked overlays, refined leaderboard flow, and aligned connected menus/modals around the updated command-deck theme.
- Loading Flow Rebuild: replaced the old split boot/reveal handoff with a cleaner deterministic loading sequence and fixed skip/flicker-style presentation problems.
- Almanac Optimisation: reduced mount overhead, moved styling out of the hot path, calmed motion, improved scroll behaviour, and simplified previews so the archive feels much smoother.
- Sandbox Boss Upgrade: redesigned the boss ability GUI into a cleaner no-scroll command layout, improved heavy-pattern routing, preview handling, and boss HUD readability.
- Boss/SFX/UI Polish: improved sound routing, reduced noisy boss notifications, added more UI animation/presentation work, and cleaned boss-protocol carryover bugs.
- Bot Intelligence Pass: bots now farm more intelligently, respect spawn protection, ease off fresh/low-level players more often, dodge danger better, and use larger mode-aware British humour name pools with rare legendary variants.
- Gameplay Fixes: fixed bullet penetration jump-through behaviour, stabilised repeated penetration damage, and resolved additional Sandbox/Boss Rush/menu edge cases.

Validation: npm run build passed.

Website/in-game archive carries the expanded breakdown.
