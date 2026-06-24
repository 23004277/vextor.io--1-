import { TankClass, Team, type SandboxBossAbilityInfo, type SandboxBossHeavyOptionInfo, type SandboxBossHudInfo, type Vector2 } from '../../types';
import type { BossRushAttackId, BossRushBossDefinition, BossRushBossEntity, BossRushTelegraph } from '../bossRush/BossRushTypes';

export type SandboxBossTrigger = 'Q' | 'X' | 'R';
export type SandboxBossRuntimeKey = SandboxBossTrigger | 'M1' | 'PASSIVE';
export type SandboxBossKey = 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity';

export interface SandboxBossAttackOption {
  id: BossRushAttackId;
  description: string;
}

export interface SandboxBossFormDefinition {
  classType: TankClass;
  bossKey: SandboxBossKey;
  name: string;
  callsign: string;
  summary: string;
  barrels: number[][];
  boss: BossRushBossDefinition;
  triggerMap: {
    Q: SandboxBossAttackOption;
    X: SandboxBossAttackOption;
  };
  heavyOptions: SandboxBossAttackOption[];
  passiveDescription?: string;
  passiveCooldownSeconds?: number;
  maxOwnedTelegraphs?: number;
}

export interface SandboxBossRuntimeState {
  classType: TankClass;
  bossKey: SandboxBossKey;
  selectedHeavyIndex: number;
  awakened: boolean;
  awakeningTimer: number;
  awakeningDuration: number;
  cooldowns: Record<SandboxBossRuntimeKey, number>;
  totals: Record<SandboxBossRuntimeKey, number>;
  activeTimers: Record<SandboxBossRuntimeKey, number>;
  activeTotals: Record<SandboxBossRuntimeKey, number>;
  globalLockRemaining: number;
  majorLockRemaining: number;
  passiveEnabled: boolean;
}

export interface SandboxBossTelegraphOwnership {
  ownerEntityId: number;
  ownerTeam: Team;
  friendlyFire: boolean;
  selfDamage: boolean;
  sourceMode: 'sandbox';
}

export type SandboxOwnedBossTelegraph = BossRushTelegraph & Partial<SandboxBossTelegraphOwnership> & {
  ownerBossKey?: SandboxBossKey | string;
};

export interface SandboxBossCastResult {
  success: boolean;
  notification?: string;
  color?: string;
}

export interface SandboxBossTargetProxy {
  pos: Vector2;
}

export interface SandboxBossHudBuildParams {
  form: SandboxBossFormDefinition;
  runtime: SandboxBossRuntimeState;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  autoFireEnabled: boolean;
}

export interface SandboxBossHudView extends SandboxBossHudInfo {
  heavyOptions?: SandboxBossHeavyOptionInfo[];
}

export interface SandboxBossTickContext {
  width: number;
  height: number;
  player: BossRushBossEntity & {
    team: Team;
    displayShield?: number;
  };
  telegraphs: SandboxOwnedBossTelegraph[];
  noCooldown: boolean;
  worldTarget: Vector2;
  nearestHostile: SandboxBossTargetProxy | null;
}

export const createRuntimeRecord = (value: number): Record<SandboxBossRuntimeKey, number> => ({
  M1: value,
  Q: value,
  X: value,
  R: value,
  PASSIVE: value,
});

export const toAbilityInfo = (
  id: string,
  name: string,
  trigger: SandboxBossAbilityInfo['trigger'],
  description: string,
  cooldownRemaining: number,
  cooldownTotal: number,
  activeRemaining = 0,
  activeTotal = 0,
): SandboxBossAbilityInfo => ({
  id,
  name,
  trigger,
  description,
  cooldownRemaining,
  cooldownTotal,
  active: activeRemaining > 0,
  activeRemaining,
  activeTotal,
});
