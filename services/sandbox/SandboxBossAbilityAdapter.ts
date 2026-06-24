import type { BossRushAttackId, BossRushAttackSpec, BossRushBossDefinition } from '../bossRush/BossRushTypes';
import type { SandboxBossAttackOption, SandboxBossFormDefinition, SandboxBossRuntimeState } from './SandboxBossTypes';

const ATTACK_DESCRIPTIONS: Partial<Record<BossRushAttackId, string>> = {
  boss_basic_volley: 'Baseline suppression that lays down the boss frame’s signature lane pressure.',
  gate_lane: 'Fires a hard commit lane strike through your aim vector.',
  gate_hash_lock: 'Drops smaller interlocking lane lines to pin movement and shape escape paths.',
  gate_arc_beam: 'Launches the Gatekeeper’s raid-style beam sequence with follow-up grid pressure.',
  gate_cross_grid: 'Forms a tighter vault crossfire pattern with readable safe pockets.',
  gate_rapid_crosshatch: 'Sequential lane bursts form a fast crosshatch that forces constant movement.',
  gate_ring_prison: 'Builds a ring-shaped trap around the target area before collapsing inward.',
  gate_corner_crush: 'Crushes a cornered zone with an L-pattern and chained impact markers.',
  splitter_triple_lane: 'Projects a triple-lane fracture setup that punishes straight-line dodges.',
  splitter_cone: 'Sweeps a corrupted cone to pressure close and mid-range movement.',
  splitter_zigzag_lines: 'Draws corrupted zigzag lanes that reward controlled strafing through safe gaps.',
  splitter_corrupted_cascade: 'Stacks zigzag pressure with delayed circle drops for layered movement checks.',
  splitter_pincer: 'Closes a pincer-shaped collapse around the chosen area.',
  splitter_x_spread: 'Builds an X-shaped cut pattern that snaps around your target line.',
  splitter_orbit_minefield: 'Seeds orbiting circle hazards that deny greedy repositioning.',
  splitter_tripwire_lattice: 'Creates a denser lattice of staggered tripwire lanes.',
  reactor_circles: 'Places chained impact circles for arena denial and timing pressure.',
  reactor_arc: 'Sweeps a rotating danger arc that punishes overcommitting into one side.',
  reactor_supernova: 'Charges a high-threat supernova pattern with a dramatic collapse window.',
  reactor_blood_crescent: 'Throws slow crescent pressure that detonates into larger punish zones.',
  reactor_lane_lattice: 'Layers reactor lane lines into a wider denial pattern.',
  reactor_orbit_crush: 'Builds an orbiting crush pattern around the selected combat pocket.',
  reactor_shuffle: 'Spawns an O-shaped furnace formation with a dangerous center punish.',
  executioner_cleave: 'Cuts a massive execution lane through the targeted space.',
  executioner_lockon: 'Forms the Executioner’s L-pattern verdict zone for forced repositioning.',
  executioner_cross: 'Triggers the X-Strike sequence with fast bisector follow-up beams.',
  executioner_judgement_ring: 'Locks a judgment ring around the target area.',
  executioner_corner_purge: 'Purges a boxed region with harsh delayed punishment.',
  executioner_fan_drive: 'Fans line pressure outward in a multi-angle execution spread.',
  executioner_box_cleave: 'Builds a box-shaped cleave pattern with interior punishment.',
  singularity_lane_chain: 'Chains long void lanes across the selected combat corridor.',
  singularity_gravity: 'Sets a gravity trap that denies greedy re-entry and central positioning.',
  singularity_event_horizon: 'Creates the Grand Singularity’s apex horizon pattern with heavy presence.',
  singularity_gravity_grid: 'Overlays a gravity-themed grid that leaves only narrow escape pockets.',
  singularity_rapid_chain: 'Fires rapid chained lanes in succession to keep movement continuous.',
  singularity_orbit_seal: 'Seals a zone with orbiting void pressure around the target area.',
  singularity_cross_maze: 'Builds a maze-like cross pattern that punishes panic movement.',
  singularity_starfall: 'Drops starfall detonations into the selected engagement space.',
};

const getAttackSpec = (boss: BossRushBossDefinition, attackId: BossRushAttackId): BossRushAttackSpec => {
  const spec = boss.attacks.find((entry) => entry.id === attackId);
  if (!spec) {
    throw new Error(`Missing Boss Rush attack spec for ${boss.key}:${attackId}`);
  }
  return spec;
};

export const getAttackDescription = (boss: BossRushBossDefinition, attackId: BossRushAttackId): string =>
  ATTACK_DESCRIPTIONS[attackId] ?? getAttackSpec(boss, attackId).label;

export const getAttackCooldown = (boss: BossRushBossDefinition, attackId: BossRushAttackId): number =>
  getAttackSpec(boss, attackId).cooldown;

export const getAttackLabel = (boss: BossRushBossDefinition, attackId: BossRushAttackId): string =>
  getAttackSpec(boss, attackId).label;

export const getSelectedHeavyAttack = (form: SandboxBossFormDefinition, runtime: SandboxBossRuntimeState): SandboxBossAttackOption =>
  form.heavyOptions[Math.max(0, Math.min(form.heavyOptions.length - 1, runtime.selectedHeavyIndex))] ?? form.heavyOptions[0];

export const getHeavyCooldown = (form: SandboxBossFormDefinition, runtime: SandboxBossRuntimeState): number =>
  getAttackCooldown(form.boss, getSelectedHeavyAttack(form, runtime).id);

export const getHeavyOptionsView = (form: SandboxBossFormDefinition, runtime: SandboxBossRuntimeState) =>
  form.heavyOptions.map((option, index) => ({
    id: option.id,
    name: getAttackLabel(form.boss, option.id),
    description: option.description,
    selected: index === runtime.selectedHeavyIndex,
  }));

export const getPrimaryAttackId = (): BossRushAttackId => 'boss_basic_volley';
