import { emitBossRushAttack, emitBossRushPassiveHazards } from './BossRushAttackPatterns';
import { chooseBossRushAttack, getBossRushPhase, updateBossRushMovement } from './BossRushAIIntelligence';
import { BossRushArena, BossRushBossDefinition, BossRushBossEntity, BossRushBossRuntime, BossRushEngineBridge, BossRushTelegraph } from './BossRushTypes';

export class BossRushBossController {
  private getPassiveHazardCooldown(definition: BossRushBossDefinition, awakened: boolean, phase: number) {
    const phasePressure = Math.max(0, phase - 1) * 0.32;
    if (definition.key === 'reactor') {
      return Math.max(2.7, (awakened ? 4.1 : 5.2) - phasePressure);
    }
    if (definition.key === 'grand_singularity') {
      return Math.max(2.2, (awakened ? 3.4 : 4.4) - phasePressure);
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
      engine.sound.playRoar(engine.getAudioSpatialOptions(boss.pos, true));
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

    if ((definition.key === 'reactor' || definition.key === 'grand_singularity') && runtime.passiveHazardTimer <= 0) {
      telegraphs.push(...emitBossRushPassiveHazards(arena, definition, boss, engine.player));
      runtime.passiveHazardTimer = this.getPassiveHazardCooldown(definition, runtime.awakened, runtime.phase);
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
    const queuedAttacks = [attack];
    const canChainCombo =
      phase >= 2 &&
      definition.attacks.length > 2 &&
      (runtime.awakened || Math.random() < 0.68);
    if (canChainCombo) {
      const chainedAttack = chooseBossRushAttack(definition, runtime, boss, engine.player, {
        excludeIds: new Set([attack.id]),
        preferNonBasic: attack.id === 'boss_basic_volley',
      });
      if (chainedAttack) {
        queuedAttacks.push(chainedAttack);
      }
    }

    runtime.queuedAttackId = attack.id;
    runtime.state = 'telegraphing';
    for (const queuedAttack of queuedAttacks) {
      telegraphs.push(...emitBossRushAttack(engine, arena, definition, boss, queuedAttack.id, engine.player));
    }
    const cooldownMult = runtime.awakened ? 1 / definition.attackFrequencyMultiplier : 1;
    const recoveryMult = runtime.awakened ? definition.recoveryReductionMultiplier : 1;
    for (const queuedAttack of queuedAttacks) {
      const comboTax = queuedAttack.id === attack.id ? 1 : 0.82;
      runtime.attackCooldowns[queuedAttack.id] = queuedAttack.cooldown * cooldownMult * comboTax;
    }
    runtime.recoveryTimer = Math.max(...queuedAttacks.map((entry) => entry.recovery)) * recoveryMult;
    runtime.state = 'recovering';
    engine.sound.playRoar(engine.getAudioSpatialOptions(boss.pos, true));
  }
}
