import type { SandboxBossAbilityInfo, Vector2 } from '../../types';
import { emitBossRushAttack, emitBossRushPassiveHazards } from '../bossRush/BossRushAttackPatterns';
import type { BossRushArena, BossRushBossEntity, BossRushEngineBridge, BossRushTelegraph } from '../bossRush/BossRushTypes';
import { createRuntimeRecord, toAbilityInfo, type SandboxBossCastResult, type SandboxBossFormDefinition, type SandboxBossHudBuildParams, type SandboxOwnedBossTelegraph, type SandboxBossRuntimeState, type SandboxBossTargetProxy, type SandboxBossTickContext, type SandboxBossTrigger } from './SandboxBossTypes';
import { getAttackCooldown, getAttackDescription, getAttackLabel, getHeavyCooldown, getHeavyOptionsView, getPrimaryAttackId, getSelectedHeavyAttack } from './SandboxBossAbilityAdapter';

const BOSS_WORLD_MARGIN = 860;
const SANDBOX_ARENA_WIDTH = 3000;
const SANDBOX_ARENA_HEIGHT = 2200;
const DEFAULT_MAJOR_LOCK = 0.3;
const DEFAULT_TELEGRAPH_CAP = 30;
const PASSIVE_TELEGRAPH_CAP = 18;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha;

const clampPoint = (point: Vector2, width: number, height: number): Vector2 => ({
  x: clamp(point.x, BOSS_WORLD_MARGIN, width - BOSS_WORLD_MARGIN),
  y: clamp(point.y, BOSS_WORLD_MARGIN, height - BOSS_WORLD_MARGIN),
});

const createSandboxArena = (width: number, height: number, playerPos: Vector2, targetPos: Vector2): BossRushArena => {
  const center = clampPoint({
    x: lerp(playerPos.x, targetPos.x, 0.45),
    y: lerp(playerPos.y, targetPos.y, 0.45),
  }, width, height);

  return {
    center,
    width: Math.min(SANDBOX_ARENA_WIDTH, width - BOSS_WORLD_MARGIN * 2),
    height: Math.min(SANDBOX_ARENA_HEIGHT, height - BOSS_WORLD_MARGIN * 2),
    insetDamagePerSecond: 0,
    softPushStrength: 0,
  };
};

const tagSandboxTelegraphs = (
  telegraphs: BossRushTelegraph[],
  player: SandboxBossTickContext['player'],
  bossKey: string,
): SandboxOwnedBossTelegraph[] =>
  telegraphs.map((telegraph) => ({
    ...telegraph,
    ownerBossId: player.id,
    ownerBossKey: bossKey,
    ownerEntityId: player.id,
    ownerTeam: player.team,
    friendlyFire: false,
    selfDamage: false,
    sourceMode: 'sandbox',
  }));

const getActiveOwnedTelegraphCount = (
  telegraphs: SandboxOwnedBossTelegraph[],
  ownerId: number,
  includePassiveOnly = false,
): number => telegraphs.filter((entry) =>
  entry.ownerEntityId === ownerId &&
  (!includePassiveOnly || entry.visualRole !== 'hover_marker')
).length;

const pruneOldestOwnedTelegraphs = (
  telegraphs: SandboxOwnedBossTelegraph[],
  ownerId: number,
  maxCount: number,
) => {
  const ownedIndices = telegraphs
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.ownerEntityId === ownerId);
  if (ownedIndices.length <= maxCount) return;
  const removeCount = ownedIndices.length - maxCount;
  for (let i = 0; i < removeCount; i += 1) {
    telegraphs.splice(ownedIndices[i].index - i, 1);
  }
};

const getCastTarget = (
  width: number,
  height: number,
  playerPos: Vector2,
  worldTarget: Vector2,
  nearestHostile: SandboxBossTargetProxy | null,
  maxRange?: number,
): SandboxBossTargetProxy => {
  const targetSource = worldTarget ?? nearestHostile?.pos ?? playerPos;
  const targetDelta = {
    x: targetSource.x - playerPos.x,
    y: targetSource.y - playerPos.y,
  };
  const distance = Math.hypot(targetDelta.x, targetDelta.y);
  if (!maxRange || distance <= maxRange || distance <= 0.001) {
    return { pos: clampPoint(targetSource, width, height) };
  }
  const scale = maxRange / distance;
  return {
    pos: clampPoint({
      x: playerPos.x + targetDelta.x * scale,
      y: playerPos.y + targetDelta.y * scale,
    }, width, height),
  };
};

const decayRuntime = (runtime: SandboxBossRuntimeState, dt: number) => {
  runtime.awakeningTimer = Math.max(0, runtime.awakeningTimer - dt);
  runtime.globalLockRemaining = Math.max(0, runtime.globalLockRemaining - dt);
  runtime.majorLockRemaining = Math.max(0, runtime.majorLockRemaining - dt);
  runtime.cooldowns.M1 = Math.max(0, runtime.cooldowns.M1 - dt);
  runtime.cooldowns.Q = Math.max(0, runtime.cooldowns.Q - dt);
  runtime.cooldowns.X = Math.max(0, runtime.cooldowns.X - dt);
  runtime.cooldowns.R = Math.max(0, runtime.cooldowns.R - dt);
  runtime.cooldowns.PASSIVE = Math.max(0, runtime.cooldowns.PASSIVE - dt);
  runtime.activeTimers.M1 = Math.max(0, runtime.activeTimers.M1 - dt);
  runtime.activeTimers.Q = Math.max(0, runtime.activeTimers.Q - dt);
  runtime.activeTimers.X = Math.max(0, runtime.activeTimers.X - dt);
  runtime.activeTimers.R = Math.max(0, runtime.activeTimers.R - dt);
  runtime.activeTimers.PASSIVE = Math.max(0, runtime.activeTimers.PASSIVE - dt);
};

export const createSandboxBossRuntimeState = (form: SandboxBossFormDefinition): SandboxBossRuntimeState => ({
  classType: form.classType,
  bossKey: form.bossKey,
  selectedHeavyIndex: 0,
  awakened: false,
  awakeningTimer: 0,
  awakeningDuration: Math.max(0, form.boss.awakeningSeconds),
  cooldowns: createRuntimeRecord(0),
  totals: {
    M1: getAttackCooldown(form.boss, getPrimaryAttackId()),
    Q: getAttackCooldown(form.boss, form.triggerMap.Q.id),
    X: getAttackCooldown(form.boss, form.triggerMap.X.id),
    R: getHeavyCooldown(form, {
      classType: form.classType,
      bossKey: form.bossKey,
      selectedHeavyIndex: 0,
      awakened: false,
      awakeningTimer: 0,
      awakeningDuration: Math.max(0, form.boss.awakeningSeconds),
      cooldowns: createRuntimeRecord(0),
      totals: createRuntimeRecord(0),
      activeTimers: createRuntimeRecord(0),
      activeTotals: createRuntimeRecord(0),
      globalLockRemaining: 0,
      majorLockRemaining: 0,
      passiveEnabled: true,
    }),
    PASSIVE: form.passiveCooldownSeconds ?? 0,
  },
  activeTimers: createRuntimeRecord(0),
  activeTotals: createRuntimeRecord(0),
  globalLockRemaining: 0,
  majorLockRemaining: 0,
  passiveEnabled: !!form.passiveCooldownSeconds,
});

const emitSandboxBossAttack = (
  engine: BossRushEngineBridge,
  context: SandboxBossTickContext,
  form: SandboxBossFormDefinition,
  runtime: SandboxBossRuntimeState,
  slot: SandboxBossTrigger | 'M1',
  attackId: string,
  respectGlobalLock: boolean,
): SandboxBossCastResult => {
  const attackSpec = form.boss.attacks.find((entry) => entry.id === attackId);
  if (!attackSpec) {
    return { success: false, notification: 'ATTACK LINK LOST', color: '#fca5a5' };
  }

  if (respectGlobalLock && runtime.globalLockRemaining > 0 && !context.noCooldown) {
    return { success: false, notification: 'SYSTEM LOCK', color: '#fca5a5' };
  }
  if (slot === 'R' && runtime.majorLockRemaining > 0 && !context.noCooldown) {
    return { success: false, notification: 'HEAVY PATTERN CYCLING', color: '#fca5a5' };
  }
  if (!context.noCooldown && runtime.awakeningTimer > 0) {
    return { success: false, notification: 'AWAKENING SURGE', color: '#fca5a5' };
  }
  if (!context.noCooldown && runtime.cooldowns[slot] > 0) {
    return {
      success: false,
      notification: `${getAttackLabel(form.boss, attackSpec.id).toUpperCase()} ${Math.ceil(runtime.cooldowns[slot])}S`,
      color: '#fbbf24',
    };
  }

  const target = getCastTarget(
    context.width,
    context.height,
    context.player.pos,
    context.worldTarget,
    context.nearestHostile,
    attackSpec.maxRange,
  );
  const arena = createSandboxArena(context.width, context.height, context.player.pos, target.pos);
  const emission = emitBossRushAttack(engine, arena, form.boss, context.player as BossRushBossEntity, attackSpec.id, target);
  const telegraphs = tagSandboxTelegraphs(emission.telegraphs, context.player, form.bossKey);
  if (telegraphs.length === 0) {
    return { success: false, notification: 'PATTERN FAILED', color: '#fca5a5' };
  }

  applyEmission(
    runtime,
    telegraphs,
    slot,
    context.noCooldown ? 0 : attackSpec.cooldown,
    emission.lockoutSeconds,
    runtime.awakened ? 1 / Math.max(1, form.boss.attackFrequencyMultiplier) : 1,
    runtime.awakened ? Math.max(0.25, form.boss.recoveryReductionMultiplier) : 1,
    context.telegraphs,
    context.player.id,
    form.maxOwnedTelegraphs ?? DEFAULT_TELEGRAPH_CAP,
  );

  return {
    success: true,
    notification: `${form.name.toUpperCase()} // ${getAttackLabel(form.boss, attackSpec.id).toUpperCase()}`,
    color: '#c084fc',
  };
};

export const cycleSandboxBossHeavySelection = (
  runtime: SandboxBossRuntimeState,
  form: SandboxBossFormDefinition,
  direction: 1 | -1,
) => {
  if (form.heavyOptions.length === 0) return;
  const nextIndex = (runtime.selectedHeavyIndex + direction + form.heavyOptions.length) % form.heavyOptions.length;
  runtime.selectedHeavyIndex = nextIndex;
  runtime.totals.R = getHeavyCooldown(form, runtime);
};

export const selectSandboxBossHeavySelection = (
  runtime: SandboxBossRuntimeState,
  form: SandboxBossFormDefinition,
  attackId: string,
) => {
  const nextIndex = form.heavyOptions.findIndex((entry) => entry.id === attackId);
  if (nextIndex < 0) return;
  runtime.selectedHeavyIndex = nextIndex;
  runtime.totals.R = getHeavyCooldown(form, runtime);
};

const applyEmission = (
  runtime: SandboxBossRuntimeState,
  telegraphs: SandboxOwnedBossTelegraph[],
  slot: SandboxBossTrigger | 'M1' | 'PASSIVE',
  cooldownSeconds: number,
  lockoutSeconds: number,
  cooldownScale: number,
  lockoutScale: number,
  targetArray: SandboxOwnedBossTelegraph[],
  ownerId: number,
  maxOwnedTelegraphs: number,
) => {
  const scaledCooldown = Math.max(0, cooldownSeconds * cooldownScale);
  const scaledLockout = Math.max(0, lockoutSeconds * lockoutScale);
  runtime.cooldowns[slot] = scaledCooldown;
  runtime.totals[slot] = scaledCooldown;
  runtime.activeTimers[slot] = scaledLockout;
  runtime.activeTotals[slot] = scaledLockout;
  if (slot === 'R') {
    runtime.majorLockRemaining = Math.max(runtime.majorLockRemaining, Math.max(DEFAULT_MAJOR_LOCK, scaledLockout * 0.16));
  }
  runtime.globalLockRemaining = Math.max(runtime.globalLockRemaining, Math.min(1.4, Math.max(0.16, scaledLockout * 0.14)));
  targetArray.push(...telegraphs);
  pruneOldestOwnedTelegraphs(targetArray, ownerId, maxOwnedTelegraphs);
};

export const tickSandboxBossRuntime = (
  engine: BossRushEngineBridge,
  context: SandboxBossTickContext,
  form: SandboxBossFormDefinition,
  runtime: SandboxBossRuntimeState,
  dt: number,
) => {
  decayRuntime(runtime, dt);
  if (runtime.awakeningTimer > 0) return;
  if (!runtime.passiveEnabled || !form.passiveCooldownSeconds || context.noCooldown) return;
  if (form.bossKey !== 'reactor' && form.bossKey !== 'grand_singularity') return;
  if (runtime.cooldowns.PASSIVE > 0 || runtime.majorLockRemaining > 0) return;
  if (getActiveOwnedTelegraphCount(context.telegraphs, context.player.id, true) >= PASSIVE_TELEGRAPH_CAP) return;

  const selectedHeavySpec = getSelectedHeavyAttack(form, runtime);
  const passiveTarget = getCastTarget(
    context.width,
    context.height,
    context.player.pos,
    context.worldTarget,
    context.nearestHostile,
    form.boss.attacks.find((entry) => entry.id === selectedHeavySpec.id)?.maxRange,
  );
  const arena = createSandboxArena(context.width, context.height, context.player.pos, passiveTarget.pos);
  const passiveTelegraphs = tagSandboxTelegraphs(
    emitBossRushPassiveHazards(arena, form.boss, context.player as BossRushBossEntity, passiveTarget),
    context.player,
    form.bossKey,
  );
  if (passiveTelegraphs.length === 0) return;
  engine.sound.playBossRushPassiveHazardCue(form.bossKey, 'spawn', engine.getAudioSpatialOptions(context.player.pos, true));
  applyEmission(
    runtime,
    passiveTelegraphs,
    'PASSIVE',
    form.passiveCooldownSeconds,
    1.35,
    runtime.awakened ? 1 / Math.max(1, form.boss.attackFrequencyMultiplier) : 1,
    runtime.awakened ? Math.max(0.25, form.boss.recoveryReductionMultiplier) : 1,
    context.telegraphs,
    context.player.id,
    form.maxOwnedTelegraphs ?? DEFAULT_TELEGRAPH_CAP,
  );
};

export const castSandboxBossAbility = (
  engine: BossRushEngineBridge,
  context: SandboxBossTickContext,
  form: SandboxBossFormDefinition,
  runtime: SandboxBossRuntimeState,
  trigger: SandboxBossTrigger,
): SandboxBossCastResult => {
  const attackOption = trigger === 'R'
    ? getSelectedHeavyAttack(form, runtime)
    : form.triggerMap[trigger];
  return emitSandboxBossAttack(engine, context, form, runtime, trigger, attackOption.id, true);
};

export const castSandboxBossPrimary = (
  engine: BossRushEngineBridge,
  context: SandboxBossTickContext,
  form: SandboxBossFormDefinition,
  runtime: SandboxBossRuntimeState,
): SandboxBossCastResult =>
  emitSandboxBossAttack(engine, context, form, runtime, 'M1', getPrimaryAttackId(), false);

export const clearSandboxBossTelegraphs = (telegraphs: SandboxOwnedBossTelegraph[], ownerId?: number | null) => {
  if (ownerId == null) {
    telegraphs.length = 0;
    return;
  }
  for (let i = telegraphs.length - 1; i >= 0; i -= 1) {
    if (telegraphs[i].ownerEntityId === ownerId || telegraphs[i].ownerBossId === ownerId) {
      telegraphs.splice(i, 1);
    }
  }
};

export const buildSandboxBossHud = (
  params: SandboxBossHudBuildParams,
): { abilities: SandboxBossAbilityInfo[]; heavyOptions: ReturnType<typeof getHeavyOptionsView> } => {
  const { form, runtime, autoFireEnabled } = params;
  const selectedHeavy = getSelectedHeavyAttack(form, runtime);
  const abilities: SandboxBossAbilityInfo[] = [
    toAbilityInfo(
      getPrimaryAttackId(),
      getAttackLabel(form.boss, getPrimaryAttackId()),
      'M1',
      getAttackDescription(form.boss, getPrimaryAttackId()),
      runtime.cooldowns.M1,
      runtime.totals.M1,
      runtime.activeTimers.M1,
      runtime.activeTotals.M1,
    ),
    toAbilityInfo(
      form.triggerMap.Q.id,
      getAttackLabel(form.boss, form.triggerMap.Q.id),
      'Q',
      form.triggerMap.Q.description,
      runtime.cooldowns.Q,
      runtime.totals.Q,
      runtime.activeTimers.Q,
      runtime.activeTotals.Q,
    ),
    toAbilityInfo(
      form.triggerMap.X.id,
      getAttackLabel(form.boss, form.triggerMap.X.id),
      'X',
      form.triggerMap.X.description,
      runtime.cooldowns.X,
      runtime.totals.X,
      runtime.activeTimers.X,
      runtime.activeTotals.X,
    ),
    toAbilityInfo(
      selectedHeavy.id,
      `${getAttackLabel(form.boss, selectedHeavy.id)} [Selected]`,
      'R',
      selectedHeavy.description,
      runtime.cooldowns.R,
      runtime.totals.R,
      runtime.activeTimers.R,
      runtime.activeTotals.R,
    ),
    toAbilityInfo(
      `${form.bossKey}-volley-drive`,
      'Volley Drive',
      'E',
      'Boss-only auto fire. While enabled, Suppressive Volley tracks your mouse position and re-fires on cooldown.',
      0,
      0,
      autoFireEnabled ? 1 : 0,
      autoFireEnabled ? 1 : 0,
    ),
  ];

  if (form.passiveDescription) {
    abilities.push(
      toAbilityInfo(
        `${form.bossKey}-passive`,
        form.bossKey === 'reactor' ? 'Volatile Cores' : form.bossKey === 'grand_singularity' ? 'Void Breaches' : 'Suppressive Volley',
        'PASSIVE',
        form.passiveDescription,
        runtime.cooldowns.PASSIVE,
        runtime.totals.PASSIVE,
        runtime.activeTimers.PASSIVE,
        runtime.activeTotals.PASSIVE,
      ),
    );
  }

  return {
    abilities,
    heavyOptions: getHeavyOptionsView(form, runtime),
  };
};
