import { emitBossRushAttack, emitBossRushPassiveHazards } from './BossRushAttackPatterns';
import { chooseBossRushAttack, getBossRushPhase, updateBossRushMovement } from './BossRushAIIntelligence';
import { BossRushArena, BossRushBossDefinition, BossRushBossEntity, BossRushBossRuntime, BossRushEngineBridge, BossRushTelegraph } from './BossRushTypes';

export class BossRushBossController {
  private lastAttackRoarAtMs = -Infinity;
  private lastAwakenRoarAtMs = -Infinity;

  private getProgressionPressure(definition: BossRushBossDefinition, runtime: BossRushBossRuntime) {
    const bossTierPressure = Math.max(0, definition.index - 1) * 0.08;
    const phasePressure = Math.max(0, runtime.phase - 1) * 0.06;
    const awakenedPressure = runtime.awakened ? 0.12 : 0;
    return Math.min(0.38, bossTierPressure + phasePressure + awakenedPressure);
  }

  private getPassiveHazardCooldown(definition: BossRushBossDefinition, awakened: boolean, phase: number) {
    const phasePressure = Math.max(0, phase - 1) * 0.32;
    const tierPressure = Math.max(0, definition.index - 1) * 0.18;
    if (definition.key === 'reactor') {
      return Math.max(2.25, (awakened ? 3.8 : 4.8) - phasePressure - tierPressure);
    }
    if (definition.key === 'grand_singularity') {
      return Math.max(1.9, (awakened ? 3.0 : 4.0) - phasePressure - tierPressure);
    }
    return 999;
  }

  update(
    engine: BossRushEngineBridge,
    arena: BossRushArena,
    definition: BossRushBossDefinition,
    boss: BossRushBossEntity,
    runtime: BossRushBossRuntime,
    telegraphs: BossRushTelegraph[],
    dt: number
  ) {
    for (const attack of definition.attacks) {
      runtime.attackCooldowns[attack.id] = Math.max(0, (runtime.attackCooldowns[attack.id] || 0) - dt);
    }
    runtime.sequenceLockTimer = Math.max(0, runtime.sequenceLockTimer - dt);
    runtime.passiveSuppressionTimer = Math.max(0, runtime.passiveSuppressionTimer - dt);

    runtime.phase = getBossRushPhase(definition, boss, runtime.awakened);

    if (definition.key === 'reactor' || definition.key === 'grand_singularity') {
      runtime.passiveHazardTimer = Math.max(0, runtime.passiveHazardTimer - dt);
    }

    if (!runtime.awakened && boss.health <= boss.maxHealth * definition.awakenThreshold) {
      runtime.awakened = true;
      runtime.state = 'awakening';
      runtime.awakeningTimer = definition.awakeningSeconds;
      boss.health = Math.max(boss.health, boss.maxHealth * definition.awakenRestoreRatio);
      boss.__bossRushAwakened = true;
      engine.addNotification(`${definition.name.toUpperCase()} AWAKENS`, '#ff6363');
      engine.spawnParticles(boss.pos, definition.accent, 42, 8);
      if (engine.elapsedMs - this.lastAwakenRoarAtMs >= 900) {
        this.lastAwakenRoarAtMs = engine.elapsedMs;
        this.lastAttackRoarAtMs = engine.elapsedMs;
        engine.sound.playBossRushRoar(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, true);
      }
      return;
    }

    if (runtime.state === 'transforming') {
      runtime.transformationTimer -= dt;
      boss.vel.x *= 0.8;
      boss.vel.y *= 0.8;
      boss.rotation += dt * 0.85;
      if (runtime.transformationTimer <= 0) {
        runtime.state = 'intro';
      }
      return;
    }

    if (runtime.state === 'awakening') {
      runtime.awakeningTimer -= dt;
      boss.vel.x *= 0.84;
      boss.vel.y *= 0.84;
      boss.rotation += dt * 0.22;
      if (runtime.awakeningTimer <= 0) {
        runtime.state = 'idle';
        runtime.recoveryTimer = Math.max(runtime.recoveryTimer, definition.postAwakenRecovery ?? 0.45);
      }
      return;
    }

    if (runtime.introTimer > 0) {
      runtime.introTimer -= dt;
      runtime.state = 'intro';
      boss.vel.x *= 0.82;
      boss.vel.y *= 0.82;
      boss.rotation += dt * 0.12;
      return;
    }

    updateBossRushMovement(definition, boss, engine.player, arena, runtime, dt);

    if (
      (definition.key === 'reactor' || definition.key === 'grand_singularity') &&
      runtime.passiveHazardTimer <= 0 &&
      runtime.passiveSuppressionTimer <= 0
    ) {
      telegraphs.push(...emitBossRushPassiveHazards(arena, definition, boss, engine.player));
      engine.sound.playBossRushPassiveHazardCue(definition.key as any, 'spawn', engine.getAudioSpatialOptions(boss.pos, true));
      runtime.passiveHazardTimer = this.getPassiveHazardCooldown(definition, runtime.awakened, runtime.phase);
    }

    if (runtime.sequenceLockTimer > 0) {
      runtime.state = 'telegraphing';
      return;
    }

    if (runtime.recoveryTimer > 0) {
      runtime.recoveryTimer -= dt;
      runtime.state = 'recovering';
      return;
    }

    runtime.state = 'choosing_attack';
    const primaryAttack = chooseBossRushAttack(definition, runtime, boss, engine.player, {
      preferNonBasic: true,
    });
    const fallbackAttack = chooseBossRushAttack(definition, runtime, boss, engine.player);
    const attack = primaryAttack || fallbackAttack;
    if (!attack) {
      runtime.state = 'idle';
      return;
    }

    const phase = runtime.phase;
    const progressionPressure = this.getProgressionPressure(definition, runtime);
    const queuedAttacks = [attack];
    const maxQueuedAttacks =
      definition.key === 'gatekeeper'
        ? runtime.awakened || phase >= 3 ? 2 : 1
        : definition.key === 'splitter'
          ? runtime.awakened || phase >= 2 ? 4 : 3
          : definition.key === 'reactor'
            ? runtime.awakened || phase >= 2 ? 4 : 3
            : definition.key === 'executioner'
              ? runtime.awakened || phase >= 2 ? 4 : 3
              : runtime.awakened || progressionPressure > 0.22 || phase >= 2
                ? 4
                : 3;
    const baseComboChance =
      definition.key === 'gatekeeper'
        ? (runtime.awakened ? 0.42 : 0.22) + progressionPressure * 0.38
        : definition.key === 'splitter'
          ? (runtime.awakened ? 0.995 : 0.9) + progressionPressure * 0.3
          : definition.key === 'reactor'
            ? (runtime.awakened ? 0.995 : 0.92) + progressionPressure * 0.28
            : definition.key === 'executioner'
              ? (runtime.awakened ? 0.99 : 0.9) + progressionPressure * 0.3
              : (runtime.awakened ? 0.995 : 0.94) + progressionPressure * 0.28;
    if (phase >= 2 && definition.attacks.length > 2 && attack.allowComboFollowup !== false) {
      const usedAttackIds = new Set([attack.id]);
      for (let comboIndex = 1; comboIndex < maxQueuedAttacks; comboIndex += 1) {
        const comboChance = Math.min(
          0.995,
          Math.max(
            definition.key === 'gatekeeper' ? 0.14 : 0.32,
            baseComboChance - comboIndex * (definition.key === 'gatekeeper' ? 0.18 : 0.08)
          )
        );
        if (Math.random() >= comboChance) break;
        const chainedAttack = chooseBossRushAttack(definition, runtime, boss, engine.player, {
          excludeIds: usedAttackIds,
          preferNonBasic: comboIndex === 1 || attack.id === 'boss_basic_volley',
        });
        if (!chainedAttack || chainedAttack.allowComboFollowup === false) break;
        queuedAttacks.push(chainedAttack);
        usedAttackIds.add(chainedAttack.id);
      }
    }

    runtime.queuedAttackId = attack.id;
    runtime.state = 'telegraphing';
    for (const queuedAttack of queuedAttacks) {
      const emission = emitBossRushAttack(engine, arena, definition, boss, queuedAttack.id, engine.player);
      telegraphs.push(...emission.telegraphs);
      engine.sound.playBossRushAbilityCast(
        definition.key as any,
        queuedAttack.id,
        engine.getAudioSpatialOptions(boss.pos, true),
        queuedAttack.allowComboFollowup === false ? 'major' : 'standard',
      );
      runtime.sequenceLockTimer = Math.max(runtime.sequenceLockTimer, emission.lockoutSeconds);
      runtime.passiveSuppressionTimer = Math.max(runtime.passiveSuppressionTimer, emission.suppressPassiveUntil ?? 0);
    }
    const cooldownMult = runtime.awakened ? 1 / definition.attackFrequencyMultiplier : 1;
    const recoveryMult = runtime.awakened ? definition.recoveryReductionMultiplier : 1;
    for (const queuedAttack of queuedAttacks) {
      const comboTax = queuedAttack.id === attack.id ? 1 : (definition.key === 'gatekeeper' ? 1.12 : 0.82);
      runtime.attackCooldowns[queuedAttack.id] = Math.max(
        definition.key === 'gatekeeper' ? 0.68 : 0.52,
        queuedAttack.cooldown * cooldownMult * comboTax * (1 - progressionPressure * 0.42)
      );
    }
    const usedAttackIds = new Set(queuedAttacks.map((entry) => entry.id));
    for (const otherAttack of definition.attacks) {
      if (usedAttackIds.has(otherAttack.id)) continue;
      const currentCooldown = runtime.attackCooldowns[otherAttack.id] ?? 0;
      if (currentCooldown <= 0) continue;
      const cooldownTrim =
        currentCooldown *
        (definition.key === 'gatekeeper'
          ? 0.08 + progressionPressure * 0.08
          : 0.16 + progressionPressure * 0.18 + Math.max(0, queuedAttacks.length - 1) * 0.04);
      runtime.attackCooldowns[otherAttack.id] = Math.max(
        definition.key === 'gatekeeper' ? 0.18 : 0.1,
        currentCooldown - cooldownTrim
      );
    }
    const recoveryBonus = definition.key === 'gatekeeper' && queuedAttacks.length > 1 ? 0.38 : 0;
    runtime.recoveryTimer = Math.max(
      Math.max(...queuedAttacks.map((entry) => entry.recovery)) *
        recoveryMult *
        (1 - progressionPressure * 0.46) *
        (queuedAttacks.length >= 4 ? 0.7 : queuedAttacks.length >= 3 ? 0.78 : queuedAttacks.length > 1 ? 0.88 : 1) +
        recoveryBonus,
      Math.max(
        0.08,
        runtime.sequenceLockTimer -
          (definition.key === 'gatekeeper' ? 0.18 : 0.32) -
          progressionPressure * 0.16
      )
    );
    runtime.state = 'recovering';
    const shouldRoarForSequence =
      queuedAttacks.length >= 3 ||
      (queuedAttacks.length >= 2 && attack.id !== 'boss_basic_volley') ||
      (runtime.awakened && attack.id !== 'boss_basic_volley' && runtime.phase >= 2);
    const roarCooldownMs =
      definition.key === 'gatekeeper' ? 2800 :
      definition.key === 'splitter' ? 2400 :
      definition.key === 'reactor' ? 2200 :
      definition.key === 'executioner' ? 2300 :
      2100;
    if (shouldRoarForSequence && engine.elapsedMs - this.lastAttackRoarAtMs >= roarCooldownMs) {
      this.lastAttackRoarAtMs = engine.elapsedMs;
      engine.sound.playBossRushRoar(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, runtime.awakened);
    }
  }
}
