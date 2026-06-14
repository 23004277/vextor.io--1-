# VEXTOR Changelog

## v1.9.4 - Boss Rush Pattern Pass & Loadout GUI

Date: 12/06/26
Theme: Boss Rush / Raid Mechanics / Arena Hazards / Loadout UI

This update pushes Boss Rush closer to a proper raid-style combat mode. The focus is now on readable boss patterns, fair telegraphs, arena pressure, awakening aggression, and a cleaner tank-selection flow before the fight.

### Highlights

#### Boss Rush Pattern Pass

* Boss Rush fights now behave more like readable raid mechanics instead of plain AI spam.
* Added new scripted boss attacks with clearer warning patterns and punish windows.
* Bosses now use more structured attack cycles instead of random lane pressure.

#### New Scripted Attacks

* **Gate Arc Beam:** sequential beam cycle with spaced telegraphs.
* **Gate Rapid Crosshatch:** staggered smaller `#`-style lane patterns.
* **Splitter Zigzag Lines:** angled zigzag laser lanes with safe gaps.
* **Splitter Corrupted Cascade:** zigzag lanes combined with repeated circle pressure.

#### Passive Arena Hazards

* Reactor and Grand Singularity now periodically spawn delayed hazard fields.
* Hazards avoid dropping directly on top of the player.
* Hazard placement tries to preserve escape space so attacks feel fair instead of unavoidable.
* Late bosses now pressure the arena even between direct attack picks.

#### Boss Runtime Improvements

* Passive hazards are now controlled by boss-side runtime cadence.
* Awakening phases and later phases tighten hazard timing.
* Added new attack IDs and passive hazard timer support.
* Initial passive timers are now hooked into Boss Rush spawn setup.
* New attacks are registered through the Boss Rush boss definitions.

#### Fight Behaviour Improvements

* Gatekeeper now has a clearer “learn the pattern, dodge, punish” flow.
* Splitter now creates proper movement checks instead of generic lane spam.
* Awakening versions are more aggressive through density and timing.
* Safe pockets still exist so the fights stay readable and beatable.

#### Boss Rush Tank Selection GUI

* Refined the Boss Rush tank-selection screen so it feels more like a proper in-match loadout browser.
* Upgraded the selected-class summary card with a bigger preview and clearer class label.
* Added category badges, allocation progress, and simple pick-class guidance.
* Cleaned up category sections with visual headers and role hints like Assault, Precision, and Tactical.
* Improved class cards with stronger selected states, clearer preview framing, and explicit Selected / Pick badges.
* Added helper formatting and meta utilities to keep the class picker cleaner.

### Notes

Passive hazards are currently focused on Reactor and Grand Singularity because they fit the arena-control role best. The next good pass would be adding poison damage-over-time to corrupted zigzag attacks, giving passive hazards unique visuals, and adding boss recovery-window UI so players can clearly see when it is time to punish.
