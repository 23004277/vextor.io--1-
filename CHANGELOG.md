v1.9.0 - FEATURE ROLLOUT
Date: 07/06/26
Theme: UI / AI / Audio / Systems
Summary
A focused feature rollout improving UI polish, AI stability, audio behavior, spawn pacing, and skin visuals. Highlights include a redesigned update archive (bigger, searchable), a more usable credit toast, elite-skin display fixes, AI spazzing mitigation, and audio/menu improvements.
Tags: UI | AI | Audio | Spawn | Skins | UX

Highlights
- Update Archive Redesign: The in-game patch notes modal has been fully redesigned — larger layout, searchable release list, copy/export actions, clearer section breakdowns, and improved typography for readability.
- Credit Toast UX: Credit uplinks now show an animated credit toast with an icon, balance preview, copy-on-click (copies new balance), and a brief "Copied" feedback state.
- Elite Skin Display Fix: Fixed an issue where equipped elite skins sometimes fell back to default visuals. The engine now defensively maps alternate elite skin ID prefixes (e.g. `elite_skin_*`) to the canonical `skin_*` definitions so equipped elite variants render correctly.
- AI & Movement Stability: Several fixes to AI steering and movement smoothing reduced chassis jitter ('spazzing') for bots. Improvements include avoiding direct rotation snaps, refined steering smoothing, and safer steering composition to prevent oscillations.
- Spawn & Common Shape Tuning: Introduced spawn gating for common shapes with a cooldown and max-active cap, increased common spawn probability while preventing overcrowding, and unified common shape visuals (square/triangle/pentagon) for clearer readout and pacing.
- Respawn Resume: Respawn now resumes the current world without a full restart (player respawns preserve bots and world state) for smoother match flow.
- Audio/Menu Behavior: Menu music now pauses immediately when entering gameplay; menu BGM has entry/end breaks to prevent immediate looping; in-match audio remains quiet unless explicitly playing gameplay tracks.
- Progression Tuning: Set `REBIRTH_LEVEL = 110` and `MAX_LEVEL = 130` and tuned XP scaling for high-level tank and boss kills to reduce late-game grind.

Notes
- Accessibility: Update archive and toast include better accessible cues and polite ARIA roles for screen readers.
- Next Steps: Consider adding export/download for full patch notes and search highlighting within content.

----------------------------------------