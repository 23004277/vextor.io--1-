import { BossRushLoadout, GameMode, Team, Vector2 } from '../../types';

export type BossRushTelegraphType =
  | 'straight_red_lane'
  | 'wide_red_lane'
  | 'red_square_marker'
  | 'red_circle_impact'
  | 'red_cone_sweep'
  | 'cross_laser_warning'
  | 'rotating_danger_arc';

export type BossRushBossState =
  | 'transforming'
  | 'intro'
  | 'idle'
  | 'choosing_attack'
  | 'telegraphing'
  | 'attacking'
  | 'recovering'
  | 'awakening'
  | 'defeated';

export type BossRushMovementStyle =
  | 'ANCHOR'
  | 'STRAFE'
  | 'ORBIT'
  | 'EXECUTION'
  | 'SINGULARITY';

export type BossRushAttackId =
  | 'boss_basic_volley'
  | 'gate_lane'
  | 'gate_arc_beam'
  | 'gate_squares'
  | 'gate_dash'
  | 'gate_ring_prison'
  | 'gate_hash_lock'
  | 'gate_cross_grid'
  | 'gate_rapid_crosshatch'
  | 'splitter_triple_lane'
  | 'splitter_checker'
  | 'splitter_cone'
  | 'splitter_pincer'
  | 'splitter_zigzag_lines'
  | 'splitter_corrupted_cascade'
  | 'reactor_circles'
  | 'reactor_arc'
  | 'reactor_shuffle'
  | 'reactor_supernova'
  | 'executioner_cleave'
  | 'executioner_lockon'
  | 'executioner_cross'
  | 'executioner_fan_drive'
  | 'singularity_lane_chain'
  | 'singularity_gravity'
  | 'singularity_spiral'
  | 'singularity_rapid_chain'
  | 'singularity_event_horizon';

export interface BossRushAttackSpec {
  id: BossRushAttackId;
  label: string;
  cooldown: number;
  recovery: number;
  minRange?: number;
  maxRange?: number;
  weight?: number;
  phases?: number[];
}

export interface BossRushBossDefinition {
  index: number;
  key: string;
  name: string;
  subtitle: string;
  color: string;
  accent: string;
  arenaAnchor: Vector2;
  radius: number;
  maxHealth: number;
  contactDamage: number;
  moveStyle: BossRushMovementStyle;
  transformSeconds: number;
  introSeconds: number;
  awakeningSeconds: number;
  awakenThreshold: number;
  awakenRestoreRatio: number;
  attackFrequencyMultiplier: number;
  recoveryReductionMultiplier: number;
  postAwakenRecovery?: number;
  phases: number;
  attacks: BossRushAttackSpec[];
  archetype: 'SINGULARITY' | 'SIEGEBREAKER' | 'SWARMLORD';
}

export interface BossRushBossRuntime {
  state: BossRushBossState;
  phase: number;
  awakened: boolean;
  transformationTimer: number;
  awakeningTimer: number;
  defeatedTimer: number;
  recoveryTimer: number;
  introTimer: number;
  passiveHazardTimer: number;
  attackCooldowns: Partial<Record<BossRushAttackId, number>>;
  queuedAttackId: BossRushAttackId | null;
}

export interface BossRushCinematicHudState {
  active: boolean;
  mode: 'intro' | 'awakening' | 'transformation';
  title: string;
  speaker: string;
  line: string;
  displayLine: string;
  progress: number;
  barsProgress: number;
  accent: string;
  color: string;
  flash: number;
  chromatic: number;
}

export interface BossRushBossEntity {
  id: number;
  type: string;
  team: Team;
  pos: Vector2;
  vel: Vector2;
  acc: Vector2;
  health: number;
  maxHealth: number;
  radius: number;
  rotation: number;
  damage: number;
  color: string;
  name: string;
  isDead: boolean;
  shouldRemove: boolean;
  __bossRushBoss?: boolean;
  __bossRushKey?: string;
  __bossRushAwakened?: boolean;
}

export interface BossRushArena {
  center: Vector2;
  width: number;
  height: number;
  insetDamagePerSecond: number;
  softPushStrength: number;
}

export interface BossRushTelegraph {
  id: string;
  ownerBossId: number;
  ownerBossKey?: string;
  type: BossRushTelegraphType;
  x: number;
  y: number;
  angle?: number;
  length?: number;
  width?: number;
  radius?: number;
  spread?: number;
  size?: number;
  innerRadius?: number;
  delaySeconds: number;
  activeSeconds: number;
  elapsedSeconds: number;
  damage: number;
  color: string;
  pulseSpeed: number;
  executed: boolean;
}

export interface BossRushHudState {
  active: boolean;
  bossName: string;
  bossSubtitle: string;
  bossIndex: number;
  bossCount: number;
  health: number;
  maxHealth: number;
  phase: number;
  phaseCount: number;
  awakened: boolean;
  transitionText?: string;
  victory: boolean;
  loadoutEditable: boolean;
  loadoutLevel: number;
  remainingStatPoints: number;
  loadout: BossRushLoadout;
  cinematic?: BossRushCinematicHudState;
}

export interface BossRushEngineBridge {
  gameMode: GameMode;
  width: number;
  height: number;
  elapsedMs: number;
  entities: any[];
  player: any;
  settings: { shakeEnabled: boolean; shakeIntensity: number };
  shakeAmount: number;
  bossRushLoadout: BossRushLoadout;
  sound: any;
  createBossRushBoss: (def: BossRushBossDefinition) => BossRushBossEntity;
  addNotification: (message: string, color: string) => void;
  spawnParticles: (pos: Vector2, color: string, count: number, size?: number) => void;
  getAudioSpatialOptions: (pos: Vector2, important?: boolean) => any;
}

export const BOSS_RUSH_TELEGRAPH_SECONDS = 1.75;
export const BOSS_RUSH_ARENA: BossRushArena = {
  center: { x: 5000, y: 5000 },
  width: 5200,
  height: 3800,
  insetDamagePerSecond: 58,
  softPushStrength: 0.22,
};
