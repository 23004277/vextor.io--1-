import { emitBossRushAttack } from './BossRushAttackPatterns';
import { chooseBossRushAttack, getBossRushPhase, updateBossRushMovement } from './BossRushAIIntelligence';
import { BossRushArena, BossRushBossDefinition, BossRushBossEntity, BossRushBossRuntime, BossRushEngineBridge, BossRushTelegraph } from './BossRushTypes';

export class BossRushBossController {
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

    if (!runtime.awakened && boss.health <= boss.maxHealth * definition.awakenThreshold) {
      runtime.awakened = true;
      runtime.state = 'awakening';
      runtime.awakeningTimer = 2.8;
      boss.health = Math.max(boss.health, boss.maxHealth * definition.awakenRestoreRatio);
      boss.__bossRushAwakened = true;
      engine.addNotification(`${definition.name.toUpperCase()} AWAKENS`, '#ff6363');
      engine.spawnParticles(boss.pos, definition.accent, 42, 8);
      engine.sound.playRoar(engine.getAudioSpatialOptions(boss.pos, true));
      return;
    }

    if (runtime.state === 'awakening') {
      runtime.awakeningTimer -= dt;
      boss.vel.x *= 0.84;
      boss.vel.y *= 0.84;
      boss.rotation += dt * 0.22;
      if (runtime.awakeningTimer <= 0) {
        runtime.state = 'idle';
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

    if (runtime.recoveryTimer > 0) {
      runtime.recoveryTimer -= dt;
      runtime.state = 'recovering';
      return;
    }

    runtime.state = 'choosing_attack';
    const attack = chooseBossRushAttack(definition, runtime, boss, engine.player);
    if (!attack) {
      runtime.state = 'idle';
      return;
    }

    runtime.queuedAttackId = attack.id;
    runtime.state = 'telegraphing';
    telegraphs.push(...emitBossRushAttack(engine, arena, definition, boss, attack.id, engine.player));
    const cooldownMult = runtime.awakened ? 1 / definition.attackFrequencyMultiplier : 1;
    const recoveryMult = runtime.awakened ? definition.recoveryReductionMultiplier : 1;
    runtime.attackCooldowns[attack.id] = attack.cooldown * cooldownMult;
    runtime.recoveryTimer = attack.recovery * recoveryMult;
    runtime.state = 'recovering';
    engine.sound.playRoar(engine.getAudioSpatialOptions(boss.pos, true));
  }
}
