import { TankClass } from '../../types';
import { BOSS_RUSH_BOSSES } from '../bossRush/BossRushBossDefinitions';
import type { SandboxBossFormDefinition } from './SandboxBossTypes';
import { getAttackDescription } from './SandboxBossAbilityAdapter';

const getBossDefinition = (key: SandboxBossFormDefinition['bossKey']) => {
  const definition = BOSS_RUSH_BOSSES.find((entry) => entry.key === key);
  if (!definition) {
    throw new Error(`Missing Boss Rush definition for ${key}`);
  }
  return definition;
};

export const SANDBOX_BOSS_FORMS: Partial<Record<TankClass, SandboxBossFormDefinition>> = {
  [TankClass.AEGIS_GATEKEEPER]: {
    classType: TankClass.AEGIS_GATEKEEPER,
    bossKey: 'gatekeeper',
    name: 'Aegis Gatekeeper',
    callsign: 'Vault Sentinel // Introductory Pattern Boss',
    summary: 'Fortified lane-control boss frame with disciplined pressure, lock geometry, and anchored suppression.',
    barrels: [
      [1.46, 0.58, 0.16, 0, 1.0, 0, 0.94],
      [1.08, 0.4, -0.06, Math.PI * 0.42, 1.18, 0.74, 0.86],
      [1.08, 0.4, -0.06, -Math.PI * 0.42, 1.18, -0.74, 0.86],
      [0.82, 0.3, -0.56, Math.PI, 1.28, 0, 0.9],
    ],
    boss: getBossDefinition('gatekeeper'),
    triggerMap: {
      Q: { id: 'gate_lane', description: getAttackDescription(getBossDefinition('gatekeeper'), 'gate_lane') },
      X: { id: 'gate_hash_lock', description: getAttackDescription(getBossDefinition('gatekeeper'), 'gate_hash_lock') },
    },
    heavyOptions: ['gate_arc_beam', 'gate_cross_grid', 'gate_rapid_crosshatch', 'gate_ring_prison', 'gate_corner_crush'].map((id) => ({
      id,
      description: getAttackDescription(getBossDefinition('gatekeeper'), id),
    })),
    passiveDescription: 'Suppressive Volley fires through primary fire while the chassis stays active.',
    passiveCooldownSeconds: 0,
    maxOwnedTelegraphs: 28,
  },
  [TankClass.VANTA_SPLITTER]: {
    classType: TankClass.VANTA_SPLITTER,
    bossKey: 'splitter',
    name: 'Vanta Splitter',
    callsign: 'Fracture Bloom // Multi-Angle Pressure Boss',
    summary: 'Split-pressure boss frame with flanking geometry, fracture lanes, and relentless motion forcing.',
    barrels: [
      [1.36, 0.5, 0.08, 0, 0.84, 0, 0.82],
      [1.24, 0.42, -0.02, Math.PI * 0.22, 0.92, 0.34, 0.8],
      [1.24, 0.42, -0.02, -Math.PI * 0.22, 0.92, -0.34, 0.8],
      [1.08, 0.34, -0.18, Math.PI * 0.48, 1.08, 0.72, 0.76],
      [1.08, 0.34, -0.18, -Math.PI * 0.48, 1.08, -0.72, 0.76],
      [0.78, 0.28, -0.44, Math.PI, 1.28, 0, 0.9],
    ],
    boss: getBossDefinition('splitter'),
    triggerMap: {
      Q: { id: 'splitter_triple_lane', description: getAttackDescription(getBossDefinition('splitter'), 'splitter_triple_lane') },
      X: { id: 'splitter_cone', description: getAttackDescription(getBossDefinition('splitter'), 'splitter_cone') },
    },
    heavyOptions: ['splitter_zigzag_lines', 'splitter_corrupted_cascade', 'splitter_pincer', 'splitter_x_spread', 'splitter_tripwire_lattice'].map((id) => ({
      id,
      description: getAttackDescription(getBossDefinition('splitter'), id),
    })),
    passiveDescription: 'Suppressive Volley stays available through main fire while boss pressure abilities layer over it.',
    passiveCooldownSeconds: 0,
    maxOwnedTelegraphs: 30,
  },
  [TankClass.PYRE_REACTOR]: {
    classType: TankClass.PYRE_REACTOR,
    bossKey: 'reactor',
    name: 'Pyre Reactor',
    callsign: 'Core Furnace // Arena-Control Boss',
    summary: 'Arena-control boss frame built around heat pulses, rotating pressure, and sustained area denial.',
    barrels: [
      [1.18, 0.38, 0.04, 0, 0.86, 0, 0.92],
      [1.04, 0.32, -0.04, Math.PI / 3, 0.96, 0.44, 0.8],
      [1.04, 0.32, -0.04, -Math.PI / 3, 0.96, -0.44, 0.8],
      [0.92, 0.3, -0.18, Math.PI * 0.68, 1.08, 0.74, 0.78],
      [0.92, 0.3, -0.18, -Math.PI * 0.68, 1.08, -0.74, 0.78],
      [0.74, 0.28, -0.4, Math.PI, 1.24, 0, 0.88],
    ],
    boss: getBossDefinition('reactor'),
    triggerMap: {
      Q: { id: 'reactor_circles', description: getAttackDescription(getBossDefinition('reactor'), 'reactor_circles') },
      X: { id: 'reactor_arc', description: getAttackDescription(getBossDefinition('reactor'), 'reactor_arc') },
    },
    heavyOptions: ['reactor_supernova', 'reactor_blood_crescent', 'reactor_lane_lattice', 'reactor_orbit_crush', 'reactor_shuffle'].map((id) => ({
      id,
      description: getAttackDescription(getBossDefinition('reactor'), id),
    })),
    passiveDescription: 'Passive volatile cores periodically seed delayed furnace hazards near the engagement space.',
    passiveCooldownSeconds: 6.5,
    maxOwnedTelegraphs: 32,
  },
  [TankClass.IRON_EXECUTIONER]: {
    classType: TankClass.IRON_EXECUTIONER,
    bossKey: 'executioner',
    name: 'Iron Executioner',
    callsign: 'Verdict Engine // Heavy Punishment Boss',
    summary: 'Punishment boss frame with decisive cleave pressure, heavy anchor fire, and brutal conversion windows.',
    barrels: [
      [1.52, 0.56, 0.12, 0, 1.08, 0, 0.76],
      [1.08, 0.34, -0.08, Math.PI * 0.34, 0.92, 0.52, 0.76],
      [1.08, 0.34, -0.08, -Math.PI * 0.34, 0.92, -0.52, 0.76],
      [0.9, 0.28, -0.24, Math.PI * 0.84, 1.16, 0.34, 0.9],
      [0.9, 0.28, -0.24, -Math.PI * 0.84, 1.16, -0.34, 0.9],
    ],
    boss: getBossDefinition('executioner'),
    triggerMap: {
      Q: { id: 'executioner_cleave', description: getAttackDescription(getBossDefinition('executioner'), 'executioner_cleave') },
      X: { id: 'executioner_lockon', description: getAttackDescription(getBossDefinition('executioner'), 'executioner_lockon') },
    },
    heavyOptions: ['executioner_cross', 'executioner_judgement_ring', 'executioner_corner_purge', 'executioner_fan_drive', 'executioner_box_cleave'].map((id) => ({
      id,
      description: getAttackDescription(getBossDefinition('executioner'), id),
    })),
    passiveDescription: 'Suppressive Volley stays active while the Executioner layers larger punishment mechanics.',
    passiveCooldownSeconds: 0,
    maxOwnedTelegraphs: 30,
  },
  [TankClass.GRAND_SINGULARITY]: {
    classType: TankClass.GRAND_SINGULARITY,
    bossKey: 'grand_singularity',
    name: 'The Grand Singularity',
    callsign: 'Event Horizon // Final Boss',
    summary: 'Final boss frame with catastrophic breach artillery, gravitational pressure, and overwhelming core presence.',
    barrels: [
      [1.96, 1.1, 0.08, 0, 1.42, 0, 0.78],
    ],
    boss: getBossDefinition('grand_singularity'),
    triggerMap: {
      Q: { id: 'singularity_lane_chain', description: getAttackDescription(getBossDefinition('grand_singularity'), 'singularity_lane_chain') },
      X: { id: 'singularity_gravity', description: getAttackDescription(getBossDefinition('grand_singularity'), 'singularity_gravity') },
    },
    heavyOptions: ['singularity_event_horizon', 'singularity_gravity_grid', 'singularity_rapid_chain', 'singularity_orbit_seal', 'singularity_cross_maze'].map((id) => ({
      id,
      description: getAttackDescription(getBossDefinition('grand_singularity'), id),
    })),
    passiveDescription: 'Passive void breaches periodically force movement with delayed hazard pockets.',
    passiveCooldownSeconds: 6.1,
    maxOwnedTelegraphs: 34,
  },
};

export const getSandboxBossForm = (classType: TankClass): SandboxBossFormDefinition | null =>
  SANDBOX_BOSS_FORMS[classType] ?? null;

export const isSandboxBossClass = (classType: TankClass): boolean => !!getSandboxBossForm(classType);
