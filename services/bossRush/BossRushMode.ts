import * as Vector from '../MathUtils';
import { BOSS_RUSH_BOSSES } from './BossRushBossDefinitions';
import { BossRushBossController } from './BossRushBossController';
import { renderBossRushTelegraphs, updateBossRushTelegraphs } from './BossRushTelegraphSystem';
import { BOSS_RUSH_ARENA, BossRushBossDefinition, BossRushBossEntity, BossRushBossRuntime, BossRushCinematicHudState, BossRushEngineBridge, BossRushHudState, BossRushTelegraph } from './BossRushTypes';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type ActiveBossRushCinematic = {
  active: boolean;
  id: string;
  mode: 'intro' | 'awakening' | 'transformation';
  bossId: number;
  title: string;
  speaker: string;
  line: string;
  accent: string;
  color: string;
  startedAtMs: number;
  wordDelayMs: number;
  holdMs: number;
  barsProgress: number;
  lastBlipWordCount: number;
  voiceVariant: 'boss_cinematic' | 'boss_gatekeeper' | 'boss_splitter' | 'boss_reactor' | 'boss_executioner' | 'boss_grand_singularity';
};

export class BossRushMode {
  private controller = new BossRushBossController();
  private telegraphs: BossRushTelegraph[] = [];
  private currentIndex = 0;
  private clearedBossCount = 0;
  private currentBossId: number | null = null;
  private currentRuntime: BossRushBossRuntime | null = null;
  private activeCinematic: ActiveBossRushCinematic | null = null;
  private lastAmbientSfxAtMs = 0;
  private lastAuraBurstAtMs = 0;
  private lastDialogueBlipAtMs = -Infinity;
  private lastCountdownSecond = -1;
  private intermissionTimer = 0;
  private transitionText = '';
  private victory = false;
  private active = false;
  private missingBossRecoveryTimer = 0;
  private skipInputLockUntilMs = 0;

  private isCinematicResolved(runtime: BossRushBossRuntime | null, mode: 'intro' | 'awakening' | 'transformation'): boolean {
    if (!runtime) return false;
    if (mode === 'transformation') return !!runtime.transformationCinematicResolved;
    if (mode === 'awakening') return !!runtime.awakeningCinematicResolved;
    return !!runtime.introCinematicResolved;
  }

  private resolveCinematic(runtime: BossRushBossRuntime | null, mode: 'intro' | 'awakening' | 'transformation') {
    if (!runtime) return;
    if (mode === 'transformation') runtime.transformationCinematicResolved = true;
    else if (mode === 'awakening') runtime.awakeningCinematicResolved = true;
    else runtime.introCinematicResolved = true;
  }

  private getPressureText(definition: BossRushBossDefinition, runtime: BossRushBossRuntime | null): string {
    if (!runtime) return `Threat tier ${definition.index} // contact imminent`;
    if (runtime.state === 'transforming') return `${definition.name.toUpperCase()} manifesting // combat lock engaged`;
    if (runtime.state === 'intro') return `${definition.name.toUpperCase()} acquiring line of fire`;
    if (runtime.state === 'awakening') return `${definition.name.toUpperCase()} entering awakened overdrive`;
    if (runtime.awakened) return `Tier ${definition.index} awakened // punish windows collapsing`;
    if (runtime.phase >= Math.max(2, definition.phases)) return `Tier ${definition.index} pressure rising // chained patterns active`;
    return `Tier ${definition.index} live // survive patterns and punish recoveries`;
  }

  private getCurrentDefinition(): BossRushBossDefinition {
    return BOSS_RUSH_BOSSES[Math.min(this.currentIndex, BOSS_RUSH_BOSSES.length - 1)];
  }

  private estimateCinematicDurationMs(
    definition: BossRushBossDefinition,
    mode: 'intro' | 'awakening' | 'transformation'
  ): number {
    const line = this.getBossLine(definition, mode);
    const words = line.trim().split(/\s+/).filter(Boolean);
    const wordDelayMs =
      mode === 'awakening'
        ? definition.key === 'grand_singularity' ? 138 : definition.key === 'executioner' ? 146 : 150
        : mode === 'transformation'
          ? definition.key === 'reactor' ? 128 : definition.key === 'splitter' ? 122 : definition.key === 'grand_singularity' ? 142 : 135
          : definition.key === 'gatekeeper' ? 168 : 170;
    const holdMs =
      mode === 'awakening'
        ? Math.round(definition.awakeningSeconds * 420)
        : mode === 'transformation'
          ? Math.round(definition.transformSeconds * 420)
          : 980;
    return words.length * wordDelayMs + holdMs;
  }

  reset() {
    this.telegraphs = [];
    this.currentIndex = 0;
    this.clearedBossCount = 0;
    this.currentBossId = null;
    this.currentRuntime = null;
    this.activeCinematic = null;
    this.lastAmbientSfxAtMs = 0;
    this.lastAuraBurstAtMs = 0;
    this.lastDialogueBlipAtMs = -Infinity;
    this.lastCountdownSecond = -1;
    this.intermissionTimer = 0;
    this.transitionText = '';
    this.victory = false;
    this.active = false;
    this.missingBossRecoveryTimer = 0;
    this.skipInputLockUntilMs = 0;
  }

  start(engine: BossRushEngineBridge) {
    this.reset();
    this.active = true;
    this.intermissionTimer = 10;
    this.transitionText = 'COMBAT STAGING // FIRST BOSS ARRIVES IN 10';
    this.lastCountdownSecond = 10;
    engine.addNotification('BOSS RUSH INITIALIZED', '#ff7b7b');
    engine.sound.playBossRushIntermission(undefined, 'arrival');
  }

  ownsBoss(id: number): boolean {
    return this.currentBossId === id;
  }

  isActive(): boolean {
    return this.active;
  }

  isCombatPaused(): boolean {
    if (!this.active) return false;
    const state = this.currentRuntime?.state;
    return !!this.activeCinematic?.active || state === 'transforming' || state === 'intro' || state === 'awakening' || state === 'defeated';
  }

  isLoadoutSelectionOpen(): boolean {
    return this.active && !this.victory && this.currentIndex === 0 && !this.currentRuntime && this.currentBossId == null && this.intermissionTimer > 0;
  }

  canSkipCinematic(): boolean {
    return !!this.activeCinematic?.active && Date.now() >= this.skipInputLockUntilMs;
  }

  skipActiveCinematic(engine: BossRushEngineBridge): boolean {
    const cinematic = this.activeCinematic;
    if (!cinematic?.active) return false;

    const runtime = this.currentRuntime;
    if (runtime) {
      this.resolveCinematic(runtime, cinematic.mode);
      if (cinematic.mode === 'transformation') {
        runtime.transformationTimer = 0;
      } else if (cinematic.mode === 'intro') {
        runtime.introTimer = 0;
      } else if (cinematic.mode === 'awakening') {
        runtime.awakeningTimer = 0;
        runtime.recoveryTimer = Math.max(runtime.recoveryTimer, 0.2);
      }
    }

    this.activeCinematic = null;
    this.skipInputLockUntilMs = Date.now() + 280;
    this.transitionText = `${cinematic.title} // SKIPPED`;
    engine.addNotification('CUTSCENE SKIPPED', '#d1d5db');
    return true;
  }

  getHud(engine: BossRushEngineBridge): BossRushHudState | undefined {
    if (!this.active) return undefined;
    const definition = this.getCurrentDefinition();
    const boss = this.getCurrentBoss(engine);
    const displayIndex = this.victory
      ? BOSS_RUSH_BOSSES.length
      : boss
        ? Math.min(BOSS_RUSH_BOSSES.length, definition.index)
        : Math.min(BOSS_RUSH_BOSSES.length, this.clearedBossCount + 1);
    return {
      active: true,
      bossName: boss?.name || definition?.name || 'Boss Rush',
      bossSubtitle: definition?.subtitle || 'Gauntlet',
      bossIndex: displayIndex,
      bossCount: BOSS_RUSH_BOSSES.length,
      health: boss?.health || 0,
      maxHealth: boss?.maxHealth || definition?.maxHealth || 1,
      phase: this.currentRuntime?.phase || 1,
      phaseCount: definition?.phases || 1,
      awakened: !!this.currentRuntime?.awakened,
      pressureText: this.getPressureText(definition, this.currentRuntime),
      transitionText: this.transitionText || undefined,
      victory: this.victory,
      loadoutEditable: this.isLoadoutSelectionOpen(),
      loadoutLevel: 45,
      remainingStatPoints: Math.max(0, Math.floor(engine.player?.availableStatPoints ?? 0)),
      loadout: engine.bossRushLoadout,
      cinematic: this.getCinematicHud(engine),
    };
  }

  update(engine: BossRushEngineBridge, dt: number) {
    if (!this.active) return;
    this.applyArenaContainment(engine, dt);
    if (!this.isCombatPaused()) {
      updateBossRushTelegraphs(engine, this.telegraphs, dt);
    }

    if (this.victory) return;

    const boss = this.getCurrentBoss(engine);
    if (boss) {
      this.missingBossRecoveryTimer = 0;
    } else if (this.currentRuntime && this.currentBossId != null) {
      this.missingBossRecoveryTimer += dt;
    } else {
      this.missingBossRecoveryTimer = 0;
    }
    this.updateCinematic(engine, boss, dt);
    this.updateBossPresentation(engine, boss);
    if (boss && this.currentRuntime?.state === 'defeated') {
      const defeatedDefinition = this.getCurrentDefinition();
      this.currentRuntime.defeatedTimer -= dt;
      const totalDefeatSeconds =
        defeatedDefinition.key === 'gatekeeper' ? 1.55 :
        defeatedDefinition.key === 'splitter' ? 1.25 :
        defeatedDefinition.key === 'reactor' ? 1.45 :
        defeatedDefinition.key === 'executioner' ? 1.35 :
        1.65;
      const deathProgress = clamp(1 - this.currentRuntime.defeatedTimer / totalDefeatSeconds, 0, 1);
      (boss as any).__bossRushDeathAnimating = true;
      (boss as any).__bossRushDeathProgress = deathProgress;
      boss.shouldRemove = false;
      const shakeStrength =
        defeatedDefinition.key === 'gatekeeper' ? 0.7 :
        defeatedDefinition.key === 'splitter' ? 0.58 :
        defeatedDefinition.key === 'reactor' ? 0.88 :
        defeatedDefinition.key === 'executioner' ? 0.64 :
        0.96;
      engine.shakeAmount += shakeStrength * (1 - deathProgress * 0.55) * engine.settings.shakeIntensity;
      if (Math.random() < (defeatedDefinition.key === 'grand_singularity' ? 0.62 : 0.45)) {
        const particleColor =
          defeatedDefinition.key === 'reactor'
            ? (deathProgress > 0.5 ? '#fff1bf' : '#ffe17a')
            : defeatedDefinition.key === 'grand_singularity'
              ? (deathProgress > 0.6 ? '#ffffff' : '#d8c4ff')
              : deathProgress > 0.55
                ? defeatedDefinition.accent
                : '#ffffff';
        engine.spawnParticles(
          boss.pos,
          particleColor,
          defeatedDefinition.key === 'splitter' ? 7 : defeatedDefinition.key === 'grand_singularity' ? 10 : 5,
          defeatedDefinition.key === 'reactor' ? 6 : 5
        );
      }
      if (this.currentRuntime.defeatedTimer <= 0) {
        this.finishBossDefeat(engine, boss, defeatedDefinition);
      }
      return;
    }

    if (!boss && this.currentRuntime && this.currentBossId != null) {
      if (this.currentRuntime.state === 'defeated') {
        this.currentRuntime.defeatedTimer -= dt;
        this.transitionText = 'TARGET ELIMINATED // RECOVERING BOSS RUSH STATE';
        if (this.currentRuntime.defeatedTimer <= 0 || this.missingBossRecoveryTimer >= 1.1) {
          this.finishBossDefeatFallback(engine, this.getCurrentDefinition());
        }
        return;
      }

      if (this.missingBossRecoveryTimer >= 0.75) {
        this.forceBossDefeatRecovery(engine);
        return;
      }
    }

    if (boss && (boss.isDead || boss.health <= 0)) {
      this.startBossDefeat(engine, boss);
      return;
    }

    if (!boss) {
      this.intermissionTimer -= dt;
      const secondsLeft = Math.max(0, Math.ceil(this.intermissionTimer));
      if (this.intermissionTimer > 0 && secondsLeft !== this.lastCountdownSecond) {
        this.lastCountdownSecond = secondsLeft;
        if (secondsLeft <= 3) {
          engine.sound.playBossRushIntermission(undefined, 'countdown');
        }
      }
      if (this.currentIndex === 0 && this.intermissionTimer > 0) {
        this.transitionText = `COMBAT STAGING // FIRST BOSS ARRIVES IN ${secondsLeft}`;
      } else if (this.currentIndex > 0 && this.currentIndex < BOSS_RUSH_BOSSES.length && this.intermissionTimer > 0) {
        this.transitionText = `TARGET ELIMINATED // ${BOSS_RUSH_BOSSES[this.currentIndex].name.toUpperCase()} ARRIVES IN ${secondsLeft}`;
      }
      if (this.intermissionTimer <= 0 && this.currentIndex < BOSS_RUSH_BOSSES.length && !this.currentRuntime && this.currentBossId == null) {
        this.spawnCurrentBoss(engine);
      }
      return;
    }

    if (this.currentRuntime) {
      const previousState = this.currentRuntime.state;
      this.transitionText = '';
      const definition = this.getCurrentDefinition();
      this.controller.update(engine, BOSS_RUSH_ARENA, definition, boss, this.currentRuntime, this.telegraphs, dt);
      if (
        previousState === 'transforming' &&
        this.currentRuntime.state === 'intro' &&
        !this.isCinematicResolved(this.currentRuntime, 'intro')
      ) {
        this.beginCinematic(engine, boss, definition, 'intro');
      }
      if (
        previousState !== 'awakening' &&
        this.currentRuntime.state === 'awakening' &&
        !this.isCinematicResolved(this.currentRuntime, 'awakening')
      ) {
        this.lastAmbientSfxAtMs = 0;
        this.lastAuraBurstAtMs = 0;
        this.currentRuntime.awakeningTimer = Math.max(
          this.currentRuntime.awakeningTimer,
          this.estimateCinematicDurationMs(definition, 'awakening') / 1000 + 0.12
        );
        this.lastAmbientSfxAtMs = engine.elapsedMs + 420;
        this.lastAuraBurstAtMs = engine.elapsedMs + 220;
        engine.sound.playBossRushCinematicOpen(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, 'awakening');
        engine.sound.playBossRushAwaken(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any);
        this.beginCinematic(engine, boss, definition, 'awakening');
      }
    }
  }

  renderWorld(ctx: CanvasRenderingContext2D) {
    if (!this.active) return;
    this.drawArena(ctx);
    renderBossRushTelegraphs(ctx, this.telegraphs);
  }

  private getCurrentBoss(engine: BossRushEngineBridge): BossRushBossEntity | null {
    if (this.currentBossId == null) return null;
    return (engine.entities.find((entity) => entity.id === this.currentBossId) as BossRushBossEntity | undefined) || null;
  }

  private spawnCurrentBoss(engine: BossRushEngineBridge) {
    const definition = BOSS_RUSH_BOSSES[this.currentIndex];
    const boss = engine.createBossRushBoss(definition);
    this.currentBossId = boss.id;
    this.currentRuntime = {
      state: 'transforming',
      phase: 1,
      awakened: false,
      transformationTimer: Math.max(definition.transformSeconds, this.estimateCinematicDurationMs(definition, 'transformation') / 1000 + 0.12),
      awakeningTimer: 0,
      defeatedTimer: 0,
      recoveryTimer: 0,
      introTimer: Math.max(definition.introSeconds, 3.45, this.estimateCinematicDurationMs(definition, 'intro') / 1000 + 0.12),
      passiveHazardTimer: definition.key === 'reactor' ? 4.8 : definition.key === 'grand_singularity' ? 4.2 : 6.5,
      sequenceLockTimer: 0,
      passiveSuppressionTimer: 0,
      attackCooldowns: {},
      queuedAttackId: null,
      transformationCinematicResolved: false,
      introCinematicResolved: false,
      awakeningCinematicResolved: false,
    };
    this.telegraphs = [];
    this.transitionText = `${definition.name.toUpperCase()} ENTERS THE ARENA`;
    engine.spawnParticles(boss.pos, definition.accent, 48, 7);
    this.lastAmbientSfxAtMs = engine.elapsedMs + 520;
    this.lastAuraBurstAtMs = engine.elapsedMs + 240;
    engine.sound.playBossRushRoar(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, false);
    engine.sound.playBossRushTransformation(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any);
    engine.sound.playBossRushAura(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, false);
    (boss as any).__bossRushTransforming = true;
    (boss as any).__bossRushTransformPhase = 0;
    this.beginCinematic(engine, boss, definition, 'transformation');
  }

  private startBossDefeat(engine: BossRushEngineBridge, boss: BossRushBossEntity) {
    if (!this.currentRuntime || this.currentRuntime.state === 'defeated') return;
    const definition = this.getCurrentDefinition();
    const defeatDuration =
      definition.key === 'gatekeeper' ? 1.55 :
      definition.key === 'splitter' ? 1.25 :
      definition.key === 'reactor' ? 1.45 :
      definition.key === 'executioner' ? 1.35 :
      1.65;
    this.currentRuntime.state = 'defeated';
    this.currentRuntime.defeatedTimer = defeatDuration;
    this.activeCinematic = null;
    this.telegraphs = [];
    boss.health = 0;
    boss.displayHealth = 0;
    boss.isDead = true;
    boss.shouldRemove = false;
    (boss as any).__bossRushTransforming = false;
    (boss as any).__bossRushDeathAnimating = true;
    (boss as any).__bossRushDeathProgress = 0;
    this.transitionText =
      definition.key === 'gatekeeper'
        ? 'VAULT FAILURE // GATEKEEPER COLLAPSING'
        : definition.key === 'splitter'
          ? 'FRACTURE EVENT // SPLITTER COMING APART'
          : definition.key === 'reactor'
            ? 'CORE FAILURE // REACTOR OVERLOADING'
            : definition.key === 'executioner'
              ? 'JUDGEMENT BROKEN // EXECUTIONER FALLING'
              : 'GRAVITY COLLAPSE // SINGULARITY IMPLODING';
    engine.shakeAmount += 18 * engine.settings.shakeIntensity;
    engine.spawnParticles(
      boss.pos,
      definition.key === 'reactor' ? '#ffe17a' : definition.accent,
      definition.key === 'gatekeeper' ? 92 : definition.key === 'grand_singularity' ? 110 : 72,
      definition.key === 'grand_singularity' ? 9 : 8
    );
    engine.sound.playBossRushDefeat(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any);
    engine.addNotification(this.transitionText, definition.accent);
  }

  private finishBossDefeat(engine: BossRushEngineBridge, boss: BossRushBossEntity, defeatedDefinition: BossRushBossDefinition) {
    boss.shouldRemove = true;
    (boss as any).__bossRushDeathAnimating = false;
    (boss as any).__bossRushDeathProgress = 1;
    this.missingBossRecoveryTimer = 0;
    this.currentBossId = null;
    this.currentRuntime = null;
    this.activeCinematic = null;
    this.telegraphs = [];
    this.clearedBossCount = Math.max(this.clearedBossCount, this.currentIndex + 1);
    this.currentIndex += 1;
    engine.spawnParticles(boss.pos, defeatedDefinition.accent, 72, 8);
    if (this.currentIndex >= BOSS_RUSH_BOSSES.length) {
      this.victory = true;
      this.transitionText = 'BOSS RUSH CLEARED';
      engine.addNotification('BOSS RUSH VICTORY', '#facc15');
      engine.spawnParticles(engine.player.pos, '#facc15', 60, 7);
      engine.sound.playBossRushIntermission(undefined, 'victory');
      return;
    }
    const nextBoss = BOSS_RUSH_BOSSES[this.currentIndex];
    this.intermissionTimer = this.currentIndex === 1 ? 4.4 : 3.6;
    this.lastCountdownSecond = Math.ceil(this.intermissionTimer);
    this.transitionText = `TARGET ELIMINATED // ${nextBoss.name.toUpperCase()} ARRIVES IN ${Math.ceil(this.intermissionTimer)}`;
    engine.player.health = engine.player.maxHealth;
    engine.player.shield = engine.player.maxShield;
    engine.sound.playBossRushIntermission(undefined, 'arrival');
  }

  private forceBossDefeatRecovery(engine: BossRushEngineBridge) {
    if (!this.currentRuntime || this.currentBossId == null) return;
    const definition = this.getCurrentDefinition();
    this.currentRuntime.state = 'defeated';
    this.currentRuntime.defeatedTimer = Math.min(
      this.currentRuntime.defeatedTimer > 0 ? this.currentRuntime.defeatedTimer : 0.65,
      0.65
    );
    this.activeCinematic = null;
    this.telegraphs = [];
    this.transitionText = `TARGET LOST // FORCING ${definition.name.toUpperCase()} DEFEAT HANDLER`;
    engine.addNotification('BOSS RUSH FAILSAFE ENGAGED', '#f59e0b');
  }

  private finishBossDefeatFallback(engine: BossRushEngineBridge, defeatedDefinition: BossRushBossDefinition) {
    this.missingBossRecoveryTimer = 0;
    this.currentBossId = null;
    this.currentRuntime = null;
    this.activeCinematic = null;
    this.telegraphs = [];
    this.clearedBossCount = Math.max(this.clearedBossCount, this.currentIndex + 1);
    this.currentIndex += 1;
    engine.spawnParticles(BOSS_RUSH_ARENA.center, defeatedDefinition.accent, 48, 7);
    if (this.currentIndex >= BOSS_RUSH_BOSSES.length) {
      this.victory = true;
      this.transitionText = 'BOSS RUSH CLEARED';
      engine.addNotification('BOSS RUSH VICTORY', '#facc15');
      engine.spawnParticles(engine.player.pos, '#facc15', 60, 7);
      engine.sound.playBossRushIntermission(undefined, 'victory');
      return;
    }
    const nextBoss = BOSS_RUSH_BOSSES[this.currentIndex];
    this.intermissionTimer = this.currentIndex === 1 ? 4.4 : 3.6;
    this.lastCountdownSecond = Math.ceil(this.intermissionTimer);
    this.transitionText = `TARGET ELIMINATED // ${nextBoss.name.toUpperCase()} ARRIVES IN ${Math.ceil(this.intermissionTimer)}`;
    engine.player.health = engine.player.maxHealth;
    engine.player.shield = engine.player.maxShield;
    engine.addNotification(`${defeatedDefinition.name.toUpperCase()} DEFEAT RECOVERED`, '#f59e0b');
    engine.sound.playBossRushIntermission(undefined, 'arrival');
  }

  private applyArenaContainment(engine: BossRushEngineBridge, dt: number) {
    const entities = engine.entities.filter((entity) =>
      !entity.isDead &&
      (entity.id === engine.player.id || entity.id === this.currentBossId)
    );
    const halfW = BOSS_RUSH_ARENA.width * 0.5;
    const halfH = BOSS_RUSH_ARENA.height * 0.5;

    for (const entity of entities) {
      const dx = entity.pos.x - BOSS_RUSH_ARENA.center.x;
      const dy = entity.pos.y - BOSS_RUSH_ARENA.center.y;
      const overflowX = Math.max(0, Math.abs(dx) - halfW);
      const overflowY = Math.max(0, Math.abs(dy) - halfH);
      if (overflowX <= 0 && overflowY <= 0) continue;

      entity.vel.x += -Math.sign(dx) * (BOSS_RUSH_ARENA.softPushStrength + overflowX / 320) * dt * 60;
      entity.vel.y += -Math.sign(dy) * (BOSS_RUSH_ARENA.softPushStrength + overflowY / 320) * dt * 60;

      if (entity.id === engine.player.id) {
        const damage = (overflowX + overflowY) > 180 ? BOSS_RUSH_ARENA.insetDamagePerSecond * dt : 0;
        if (damage > 0) {
          entity.takeDamage(damage, this.currentBossId, false);
        }
      }

      entity.pos.x = clamp(entity.pos.x, BOSS_RUSH_ARENA.center.x - halfW - 120, BOSS_RUSH_ARENA.center.x + halfW + 120);
      entity.pos.y = clamp(entity.pos.y, BOSS_RUSH_ARENA.center.y - halfH - 120, BOSS_RUSH_ARENA.center.y + halfH + 120);
    }
  }

  private drawArena(ctx: CanvasRenderingContext2D) {
    const x = BOSS_RUSH_ARENA.center.x - BOSS_RUSH_ARENA.width * 0.5;
    const y = BOSS_RUSH_ARENA.center.y - BOSS_RUSH_ARENA.height * 0.5;
    ctx.save();
    const fill = ctx.createLinearGradient(x, y, x + BOSS_RUSH_ARENA.width, y + BOSS_RUSH_ARENA.height);
    fill.addColorStop(0, 'rgba(40, 8, 12, 0.16)');
    fill.addColorStop(0.5, 'rgba(80, 10, 18, 0.08)');
    fill.addColorStop(1, 'rgba(30, 5, 15, 0.18)');
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, BOSS_RUSH_ARENA.width, BOSS_RUSH_ARENA.height);
    ctx.strokeStyle = 'rgba(255, 120, 120, 0.55)';
    ctx.lineWidth = 12;
    ctx.strokeRect(x, y, BOSS_RUSH_ARENA.width, BOSS_RUSH_ARENA.height);
    ctx.strokeStyle = 'rgba(255, 190, 190, 0.18)';
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 18]);
    ctx.lineDashOffset = -Date.now() * 0.04;
    ctx.strokeRect(x + 22, y + 22, BOSS_RUSH_ARENA.width - 44, BOSS_RUSH_ARENA.height - 44);
    ctx.setLineDash([]);
    ctx.restore();
  }

  getCameraOverride(engine: BossRushEngineBridge): { active: boolean; targetPos: { x: number; y: number }; zoom: number } | null {
    const boss = this.getCurrentBoss(engine);
    if (!boss || !this.activeCinematic?.active) return null;
    return {
      active: true,
      targetPos: { x: boss.pos.x, y: boss.pos.y },
      zoom: boss.radius >= 210 ? 0.5 : 0.56,
    };
  }

  private beginCinematic(
    engine: BossRushEngineBridge,
    boss: BossRushBossEntity,
    definition: BossRushBossDefinition,
    mode: 'intro' | 'awakening' | 'transformation'
  ) {
    const line = this.getBossLine(definition, mode);
    this.resolveCinematic(this.currentRuntime, mode);
    this.lastDialogueBlipAtMs = -Infinity;
    if (mode !== 'transformation') {
      engine.sound.playBossRushCinematicOpen(engine.getAudioSpatialOptions(boss.pos, true), definition.key, mode);
    }
    this.activeCinematic = {
      active: true,
      id: `${definition.key}-${mode}-${engine.elapsedMs}`,
      mode,
      bossId: boss.id,
      title: this.getBossTitle(definition, mode),
      speaker: this.getBossSpeaker(definition, mode),
      line,
      accent: definition.accent,
      color: definition.color,
      startedAtMs: engine.elapsedMs,
      wordDelayMs:
        mode === 'awakening'
          ? definition.key === 'grand_singularity' ? 138 : definition.key === 'executioner' ? 146 : 150
          : mode === 'transformation'
            ? definition.key === 'reactor' ? 128 : definition.key === 'splitter' ? 122 : definition.key === 'grand_singularity' ? 142 : 135
            : definition.key === 'gatekeeper' ? 168 : 170,
      holdMs:
        mode === 'awakening'
          ? Math.round(definition.awakeningSeconds * 420)
          : mode === 'transformation'
            ? Math.round(definition.transformSeconds * 420)
            : 980,
      barsProgress: 0,
      lastBlipWordCount: 0,
      voiceVariant: this.getBossVoiceVariant(definition),
    };
  }

  private updateCinematic(engine: BossRushEngineBridge, boss: BossRushBossEntity | null, dt: number) {
    const cinematic = this.activeCinematic;
    if (!cinematic || !cinematic.active || !boss || boss.id !== cinematic.bossId) {
      if (this.activeCinematic) this.activeCinematic = null;
      return;
    }

    cinematic.barsProgress = clamp(cinematic.barsProgress + dt * 2.8, 0, 1);
    const words = cinematic.line.trim().split(/\s+/).filter(Boolean);
    const elapsedMs = Math.max(0, engine.elapsedMs - cinematic.startedAtMs);
    const revealCount = Math.min(words.length, Math.floor(elapsedMs / cinematic.wordDelayMs));

    if (revealCount > cinematic.lastBlipWordCount) {
      const audio = engine.getAudioSpatialOptions(boss.pos, true);
      const blipsToPlay = Math.min(1, revealCount - cinematic.lastBlipWordCount);
      for (let i = 0; i < blipsToPlay; i += 1) {
        if (engine.elapsedMs - this.lastDialogueBlipAtMs >= 46) {
          this.lastDialogueBlipAtMs = engine.elapsedMs;
          engine.sound.playDialogueBlip(audio, cinematic.voiceVariant);
        }
      }
      cinematic.lastBlipWordCount = revealCount;
    }

    const revealDone = revealCount >= words.length;
    if (revealDone && elapsedMs >= words.length * cinematic.wordDelayMs + cinematic.holdMs) {
      cinematic.barsProgress = clamp(cinematic.barsProgress - dt * 3.4, 0, 1);
      if (cinematic.barsProgress <= 0.02) {
        this.activeCinematic = null;
      }
    }
  }

  private getCinematicHud(engine: BossRushEngineBridge): BossRushCinematicHudState | undefined {
    const cinematic = this.activeCinematic;
    const boss = this.getCurrentBoss(engine);
    if (!cinematic || !cinematic.active || !boss || boss.id !== cinematic.bossId) return undefined;
    const words = cinematic.line.trim().split(/\s+/).filter(Boolean);
    const elapsedMs = Math.max(0, engine.elapsedMs - cinematic.startedAtMs);
    const revealCount = Math.min(words.length, Math.floor(elapsedMs / cinematic.wordDelayMs));
    return {
      active: true,
      mode: cinematic.mode,
      title: cinematic.title,
      speaker: cinematic.speaker,
      line: cinematic.line,
      displayLine: words.slice(0, revealCount).join(' '),
      progress: words.length > 0 ? revealCount / words.length : 1,
      barsProgress: cinematic.barsProgress,
      accent: cinematic.accent,
      color: cinematic.color,
      flash:
        cinematic.mode === 'awakening' || cinematic.mode === 'transformation'
          ? clamp(
              Math.sin(elapsedMs * (cinematic.mode === 'transformation' ? 0.03 : 0.022)) * (cinematic.mode === 'transformation' ? 0.3 : 0.24) +
              cinematic.barsProgress * (cinematic.mode === 'transformation' ? 0.34 : 0.28) +
              (revealCount < words.length ? (cinematic.mode === 'transformation' ? 0.18 : 0.14) : 0),
              0,
              cinematic.mode === 'transformation' ? 0.84 : 0.72
            )
          : 0,
      chromatic:
        cinematic.mode === 'awakening' || cinematic.mode === 'transformation'
          ? clamp(
              Math.sin(elapsedMs * (cinematic.mode === 'transformation' ? 0.018 : 0.014) + 0.6) * (cinematic.mode === 'transformation' ? 0.22 : 0.16) +
              cinematic.barsProgress * (cinematic.mode === 'transformation' ? 0.3 : 0.24) +
              (revealCount < words.length ? (cinematic.mode === 'transformation' ? 0.14 : 0.1) : 0),
              0,
              cinematic.mode === 'transformation' ? 0.74 : 0.6
            )
          : 0,
      transformationPulse:
        cinematic.mode === 'transformation'
          ? clamp(
              Math.sin(elapsedMs * 0.012 + 0.3) * 0.22 +
              cinematic.barsProgress * 0.48 +
              (revealCount < words.length ? 0.2 : 0.08),
              0,
              0.9
            )
          : 0,
      transformationHalo:
        cinematic.mode === 'transformation'
          ? clamp(
              Math.sin(elapsedMs * 0.007 + 1.1) * 0.18 +
              cinematic.barsProgress * 0.38 +
              (revealCount < words.length ? 0.16 : 0.06),
              0,
              0.78
            )
          : 0,
      sigilAlpha:
        cinematic.mode === 'transformation'
          ? clamp(
              Math.sin(elapsedMs * 0.016) * 0.16 +
              cinematic.barsProgress * 0.42,
              0,
              0.82
            )
          : 0,
    };
  }

  private getBossLine(definition: BossRushBossDefinition, mode: 'intro' | 'awakening' | 'transformation'): string {
    const lines: Record<string, { intro: string; awakening: string; transformation: string }> = {
      gatekeeper: {
        intro: 'You broke the first seal. Good. Now hold your ground and learn why the threshold was buried.',
        awakening: 'The locks are ash now. Excellent. You no longer face a gate. You face what the gate was hiding.',
        transformation: 'Ancient hinges scream. War-steel wakes. Aegis Gatekeeper, close the world around the intruder.',
      },
      splitter: {
        intro: 'I do not hunt. I reduce the arena until panic is your last open path.',
        awakening: 'Pressure is over. This is the cut. Move beautifully, or die in pieces.',
        transformation: 'Angles divide. Routes collapse. Vanta Splitter, take shape and sever every escape line.',
      },
      reactor: {
        intro: 'This chamber answers to my pulse. Every safe zone you trust is already overheating.',
        awakening: 'Containment did not fail. Containment opened. Now the entire arena burns on purpose.',
        transformation: 'Ignition sequence complete. Core online. Pyre Reactor, breathe fire through the chamber.',
      },
      executioner: {
        intro: 'I was not built to warn you. I was built to finish what the others merely prepared.',
        awakening: 'Mercy has left the arena. From this point forward, every mistake signs your sentence.',
        transformation: 'Judgement descends in iron. Iron Executioner, wake the frame and pronounce the sentence.',
      },
      grand_singularity: {
        intro: 'You did not reach the end. The end noticed you, opened its eyes, and waited.',
        awakening: 'Gravity kneels. Light folds. And still you remain, arrogant enough to call that courage.',
        transformation: 'Matter folds into a throne of ruin. Grand Singularity, complete the collapse.',
      },
    };

    const selected = lines[definition.key];
    if (selected) return selected[mode];
    if (mode === 'transformation') {
      return `${definition.name} forges a war-body from the arena itself.`;
    }
    return mode === 'awakening'
      ? `${definition.name} has awakened. The arena will not forgive hesitation.`
      : `${definition.name} enters the arena. Stand your ground if you still have one.`;
  }

  private getBossTitle(definition: BossRushBossDefinition, mode: 'intro' | 'awakening' | 'transformation'): string {
    if (mode === 'transformation') {
      return definition.key === 'gatekeeper'
        ? `SEALBREAK EVENT // ${definition.name.toUpperCase()}`
        : `WARFORM MANIFEST // ${definition.name.toUpperCase()}`;
    }
    if (mode === 'awakening') {
      return definition.key === 'gatekeeper'
        ? `LOCKDOWN OVERRIDE // ${definition.name.toUpperCase()}`
        : `PHASE BREAK // ${definition.name.toUpperCase()}`;
    }
    return `HOSTILE TRANSMISSION // ${definition.name.toUpperCase()}`;
  }

  private getBossSpeaker(definition: BossRushBossDefinition, mode: 'intro' | 'awakening' | 'transformation'): string {
    if (mode === 'transformation') return `${definition.name} // Warform Manifest`;
    if (mode === 'awakening') return `${definition.name} // Phase Break`;
    return `${definition.name} // ${definition.subtitle.toUpperCase()}`;
  }

  private getBossVoiceVariant(definition: BossRushBossDefinition): ActiveBossRushCinematic['voiceVariant'] {
    switch (definition.key) {
      case 'gatekeeper':
        return 'boss_gatekeeper';
      case 'splitter':
        return 'boss_splitter';
      case 'reactor':
        return 'boss_reactor';
      case 'executioner':
        return 'boss_executioner';
      case 'grand_singularity':
        return 'boss_grand_singularity';
      default:
        return 'boss_cinematic';
    }
  }

  private updateBossPresentation(engine: BossRushEngineBridge, boss: BossRushBossEntity | null) {
    const runtime = this.currentRuntime;
    if (!boss || !runtime) return;
    const definition = this.getCurrentDefinition();
    const now = engine.elapsedMs;
    const hpRatio = boss.health / Math.max(1, boss.maxHealth);
    const awakened = !!runtime.awakened;
    const transforming = runtime.state === 'transforming';
    (boss as any).__bossRushTransforming = transforming;
    (boss as any).__bossRushTransformPhase = transforming
      ? clamp(1 - runtime.transformationTimer / Math.max(0.01, definition.transformSeconds), 0, 1)
      : 1;
    const awakeningProgress = runtime.state === 'awakening'
      ? clamp(1 - runtime.awakeningTimer / Math.max(0.01, definition.awakeningSeconds), 0, 1)
      : awakened
        ? 1
        : 0;
    const overdrive =
      runtime.state === 'awakening'
        ? 0.42 + awakeningProgress * 0.96 + Math.max(0, Math.sin(now * 0.032)) * 0.24
        : awakened
          ? 0.42 + (1 - hpRatio) * 0.36
          : 0;
    (boss as any).__bossRushAwakeningProgress = awakeningProgress;
    (boss as any).__bossRushAuraOverdrive = overdrive;
    (boss as any).__bossRushAwakeningState = runtime.state === 'awakening';
    const auraCadenceMs =
      runtime.state === 'awakening' || runtime.state === 'transforming' ? (definition.key === 'gatekeeper' ? 220 : 360) :
      awakened ? 780 :
      1180;

    if (now - this.lastAmbientSfxAtMs >= auraCadenceMs) {
      this.lastAmbientSfxAtMs = now;
      engine.sound.playBossRushAura(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, awakened);
    }

    const burstCadenceMs =
      runtime.state === 'awakening' || runtime.state === 'transforming' ? (definition.key === 'gatekeeper' ? 110 : 160) :
      hpRatio < 0.35 ? 320 :
      520;

    if (runtime.state === 'transforming' || runtime.state === 'awakening') {
      const phaseTimer = runtime.state === 'transforming' ? runtime.transformationTimer : runtime.awakeningTimer;
      const phaseTotal = runtime.state === 'transforming'
        ? Math.max(0.01, definition.transformSeconds)
        : Math.max(0.01, definition.awakeningSeconds);
      const progress = clamp(1 - phaseTimer / phaseTotal, 0, 1);
      const wave = 0.4 + Math.sin(now * (definition.key === 'gatekeeper' ? 0.045 : 0.028)) * 0.5;
      const baseShake =
        definition.key === 'gatekeeper'
          ? 0.7 + progress * 1.9 + Math.max(0, wave)
          : 0.45 + progress * 1.15 + Math.max(0, wave * 0.65);
      engine.shakeAmount += baseShake * engine.settings.shakeIntensity;

      if (runtime.state === 'awakening') {
        const shockwaveCount =
          definition.key === 'grand_singularity' ? 4 :
          definition.key === 'splitter' ? 3 :
          definition.key === 'reactor' ? 5 :
          definition.key === 'executioner' ? 3 :
          4;
        for (let i = 0; i < shockwaveCount; i += 1) {
          const angle = (i / shockwaveCount) * Math.PI * 2 + now * 0.0022 * (i % 2 === 0 ? 1 : -1);
          const orbitRadius = boss.radius * (0.55 + progress * (0.7 + i * 0.08));
          engine.spawnParticles(
            {
              x: boss.pos.x + Math.cos(angle) * orbitRadius,
              y: boss.pos.y + Math.sin(angle) * orbitRadius,
            },
            i % 2 === 0 ? definition.accent : '#ffffff',
            definition.key === 'reactor' ? 6 : 4,
            5 + progress * 2,
          );
        }
      }
    }

    if (now - this.lastAuraBurstAtMs >= burstCadenceMs) {
      this.lastAuraBurstAtMs = now;
      const orbitCount =
        definition.archetype === 'SINGULARITY' ? 3 :
        definition.archetype === 'SWARMLORD' ? 4 :
        2;
      const time = now * 0.001;
      for (let i = 0; i < orbitCount; i += 1) {
        const angle = time * (awakened ? 2.8 : 1.9) + (i / orbitCount) * Math.PI * 2;
        const radius =
          boss.radius * (
            definition.archetype === 'SINGULARITY' ? 1.38 :
            definition.archetype === 'SWARMLORD' ? 1.12 :
            1.22
          );
        const burstPos = {
          x: boss.pos.x + Math.cos(angle) * radius,
          y: boss.pos.y + Math.sin(angle) * radius,
        };
        engine.spawnParticles(
          burstPos,
          awakened ? definition.accent : definition.color,
          definition.archetype === 'SWARMLORD' ? 3 : 2,
          awakened ? 4 : 3
        );
      }

      if (runtime.state === 'awakening' || runtime.state === 'transforming') {
        engine.spawnParticles(boss.pos, definition.accent, 10, 5);
        if (runtime.state === 'transforming') {
          const progress = clamp(1 - runtime.transformationTimer / Math.max(0.01, definition.transformSeconds), 0, 1);
          if (definition.key === 'gatekeeper') {
            const ring = boss.radius * (0.86 + progress * 1.02);
            for (let i = 0; i < 4; i += 1) {
              const angle = (i / 4) * Math.PI * 2 + now * 0.0028;
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * ring,
                y: boss.pos.y + Math.sin(angle) * ring,
              }, '#ffd0b2', 6, 5);
            }
            for (let i = 0; i < 8; i += 1) {
              const angle = (i / 8) * Math.PI * 2 + now * 0.0012;
              const inner = boss.radius * (0.35 + progress * 0.18);
              const outer = boss.radius * (1.08 + progress * 0.5);
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * inner,
                y: boss.pos.y + Math.sin(angle) * outer,
              }, i % 2 === 0 ? '#ffe2dc' : '#ff9b9b', 3, 4);
            }
          } else if (definition.key === 'splitter') {
            for (let i = 0; i < 6; i += 1) {
              const angle = (i / 6) * Math.PI * 2;
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * boss.radius * (0.45 + progress * 0.55),
                y: boss.pos.y + Math.sin(angle) * boss.radius * (0.45 + progress * 0.55),
              }, '#ffd1ea', 3, 3);
            }
          } else if (definition.key === 'reactor') {
            engine.spawnParticles(boss.pos, '#ffe17a', 14, 6);
          } else if (definition.key === 'executioner') {
            const head = {
              x: boss.pos.x + Math.cos(boss.rotation) * boss.radius * 0.9,
              y: boss.pos.y + Math.sin(boss.rotation) * boss.radius * 0.9,
            };
            engine.spawnParticles(head, '#ffd3db', 8, 5);
          } else if (definition.key === 'grand_singularity') {
            for (let i = 0; i < 3; i += 1) {
              const angle = now * 0.003 + i * (Math.PI * 2 / 3);
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * boss.radius * (0.85 + progress * 0.45),
                y: boss.pos.y + Math.sin(angle) * boss.radius * (0.85 + progress * 0.45),
              }, '#e5d9ff', 5, 4);
            }
          }
        } else if (runtime.state === 'awakening') {
          const progress = awakeningProgress;
          if (definition.key === 'gatekeeper') {
            for (let i = 0; i < 12; i += 1) {
              const angle = (i / 12) * Math.PI * 2 + now * 0.0034;
              const radius = boss.radius * (0.92 + (i % 2 === 0 ? 0.26 : 0.42) + progress * 0.22);
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * radius,
                y: boss.pos.y + Math.sin(angle) * radius,
              }, i % 3 === 0 ? '#fff1f1' : definition.accent, 4, 4.5);
            }
          } else if (definition.key === 'splitter') {
            for (let i = 0; i < 10; i += 1) {
              const angle = (i / 10) * Math.PI * 2;
              const reach = boss.radius * (0.7 + progress * 0.9);
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * reach,
                y: boss.pos.y + Math.sin(angle) * (reach * 0.7),
              }, i % 2 === 0 ? '#ffd8ef' : definition.accent, 4, 4);
            }
          } else if (definition.key === 'reactor') {
            for (let i = 0; i < 14; i += 1) {
              const angle = (i / 14) * Math.PI * 2 + now * 0.004;
              const reach = boss.radius * (0.64 + progress * 0.96);
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * reach,
                y: boss.pos.y + Math.sin(angle) * reach,
              }, i % 3 === 0 ? '#fff4cf' : '#ffb86b', 5, 5);
            }
          } else if (definition.key === 'executioner') {
            for (let i = 0; i < 8; i += 1) {
              const angle = boss.rotation + ((i - 3.5) * 0.22);
              const reach = boss.radius * (0.7 + progress * 1.02);
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * reach,
                y: boss.pos.y + Math.sin(angle) * reach,
              }, i % 2 === 0 ? '#ffe0e0' : definition.accent, 4, 4.5);
            }
          } else if (definition.key === 'grand_singularity') {
            for (let i = 0; i < 16; i += 1) {
              const angle = now * 0.0018 + i * (Math.PI * 2 / 16);
              const inner = boss.radius * (0.35 + progress * 0.28);
              const outer = boss.radius * (1.2 + progress * 0.82);
              engine.spawnParticles({
                x: boss.pos.x + Math.cos(angle) * outer,
                y: boss.pos.y + Math.sin(angle) * inner,
              }, i % 2 === 0 ? '#efe8ff' : '#cbb2ff', 4, 4.5);
            }
          }
        }
      }
    }
  }
}
