import * as Vector from '../MathUtils';
import { BOSS_RUSH_BOSSES } from './BossRushBossDefinitions';
import { BossRushBossController } from './BossRushBossController';
import { renderBossRushTelegraphs, updateBossRushTelegraphs } from './BossRushTelegraphSystem';
import { BOSS_RUSH_ARENA, BossRushBossDefinition, BossRushBossEntity, BossRushBossRuntime, BossRushCinematicHudState, BossRushEngineBridge, BossRushHudState, BossRushTelegraph } from './BossRushTypes';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type ActiveBossRushCinematic = {
  active: boolean;
  id: string;
  mode: 'intro' | 'awakening';
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
  private currentBossId: number | null = null;
  private currentRuntime: BossRushBossRuntime | null = null;
  private activeCinematic: ActiveBossRushCinematic | null = null;
  private lastAmbientSfxAtMs = 0;
  private lastAuraBurstAtMs = 0;
  private intermissionTimer = 0;
  private transitionText = '';
  private victory = false;
  private active = false;

  reset() {
    this.telegraphs = [];
    this.currentIndex = 0;
    this.currentBossId = null;
    this.currentRuntime = null;
    this.activeCinematic = null;
    this.lastAmbientSfxAtMs = 0;
    this.lastAuraBurstAtMs = 0;
    this.intermissionTimer = 0;
    this.transitionText = '';
    this.victory = false;
    this.active = false;
  }

  start(engine: BossRushEngineBridge) {
    this.reset();
    this.active = true;
    this.intermissionTimer = 10;
    this.transitionText = 'COMBAT STAGING // FIRST BOSS ARRIVES IN 10';
    engine.addNotification('BOSS RUSH INITIALIZED', '#ff7b7b');
  }

  ownsBoss(id: number): boolean {
    return this.currentBossId === id;
  }

  isActive(): boolean {
    return this.active;
  }

  getHud(engine: BossRushEngineBridge): BossRushHudState | undefined {
    if (!this.active) return undefined;
    const definition = BOSS_RUSH_BOSSES[Math.min(this.currentIndex, BOSS_RUSH_BOSSES.length - 1)];
    const boss = this.getCurrentBoss(engine);
    return {
      active: true,
      bossName: boss?.name || definition?.name || 'Boss Rush',
      bossSubtitle: definition?.subtitle || 'Gauntlet',
      bossIndex: Math.min(BOSS_RUSH_BOSSES.length, this.currentIndex + (this.victory ? 1 : 1)),
      bossCount: BOSS_RUSH_BOSSES.length,
      health: boss?.health || 0,
      maxHealth: boss?.maxHealth || definition?.maxHealth || 1,
      phase: this.currentRuntime?.phase || 1,
      phaseCount: definition?.phases || 1,
      awakened: !!this.currentRuntime?.awakened,
      transitionText: this.transitionText || undefined,
      victory: this.victory,
      cinematic: this.getCinematicHud(engine),
    };
  }

  update(engine: BossRushEngineBridge, dt: number) {
    if (!this.active) return;
    this.applyArenaContainment(engine, dt);
    updateBossRushTelegraphs(engine, this.telegraphs, dt);

    if (this.victory) return;

    const boss = this.getCurrentBoss(engine);
    this.updateCinematic(engine, boss, dt);
    this.updateBossPresentation(engine, boss);
    if (boss && (boss.isDead || boss.shouldRemove || boss.health <= 0)) {
      boss.shouldRemove = true;
      this.currentBossId = null;
      this.currentRuntime = null;
      this.activeCinematic = null;
      this.telegraphs = [];
      this.currentIndex += 1;
      if (this.currentIndex >= BOSS_RUSH_BOSSES.length) {
        this.victory = true;
        this.transitionText = 'BOSS RUSH CLEARED';
        engine.addNotification('BOSS RUSH VICTORY', '#facc15');
        engine.spawnParticles(engine.player.pos, '#facc15', 60, 7);
        return;
      }
      this.intermissionTimer = 3.1;
      this.transitionText = `NEXT BOSS INCOMING // ${BOSS_RUSH_BOSSES[this.currentIndex].name.toUpperCase()}`;
      engine.player.health = engine.player.maxHealth;
      engine.player.shield = engine.player.maxShield;
      engine.addNotification(this.transitionText, '#ff9f43');
      return;
    }

    if (!boss) {
      this.intermissionTimer -= dt;
      const secondsLeft = Math.max(0, Math.ceil(this.intermissionTimer));
      if (this.currentIndex === 0 && this.intermissionTimer > 0) {
        this.transitionText = `COMBAT STAGING // FIRST BOSS ARRIVES IN ${secondsLeft}`;
      }
      if (this.intermissionTimer <= 0) {
        this.spawnCurrentBoss(engine);
      }
      return;
    }

    if (this.currentRuntime) {
      const previousState = this.currentRuntime.state;
      this.transitionText = '';
      this.controller.update(engine, BOSS_RUSH_ARENA, BOSS_RUSH_BOSSES[this.currentIndex], boss, this.currentRuntime, this.telegraphs, dt);
      if (previousState !== 'awakening' && this.currentRuntime.state === 'awakening') {
        this.lastAmbientSfxAtMs = 0;
        this.lastAuraBurstAtMs = 0;
        engine.sound.playBossRushAwaken(engine.getAudioSpatialOptions(boss.pos, true), BOSS_RUSH_BOSSES[this.currentIndex].key as any);
        this.beginCinematic(engine, boss, BOSS_RUSH_BOSSES[this.currentIndex], 'awakening');
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
      state: 'intro',
      phase: 1,
      awakened: false,
      awakeningTimer: 0,
      recoveryTimer: 0,
      introTimer: Math.max(definition.introSeconds, 3.45),
      attackCooldowns: {},
      queuedAttackId: null,
    };
    this.telegraphs = [];
    this.transitionText = `${definition.name.toUpperCase()} ENTERS THE ARENA`;
    engine.addNotification(this.transitionText, definition.color);
    engine.spawnParticles(boss.pos, definition.accent, 48, 7);
    engine.sound.playRoar(engine.getAudioSpatialOptions(boss.pos, true));
    engine.sound.playBossRushAura(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, false);
    this.beginCinematic(engine, boss, definition, 'intro');
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
    mode: 'intro' | 'awakening'
  ) {
    const line = this.getBossLine(definition, mode);
    this.activeCinematic = {
      active: true,
      id: `${definition.key}-${mode}-${engine.elapsedMs}`,
      mode,
      bossId: boss.id,
      title: this.getBossTitle(definition, mode),
      speaker: mode === 'awakening' ? `${definition.name} // Phase Break` : definition.subtitle,
      line,
      accent: definition.accent,
      color: definition.color,
      startedAtMs: engine.elapsedMs,
      wordDelayMs: mode === 'awakening' ? 150 : 170,
      holdMs: mode === 'awakening' ? 1120 : 980,
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
      const blipsToPlay = Math.min(2, revealCount - cinematic.lastBlipWordCount);
      for (let i = 0; i < blipsToPlay; i += 1) {
        engine.sound.playDialogueBlip(audio, cinematic.voiceVariant);
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
        cinematic.mode === 'awakening'
          ? clamp(
              Math.sin(elapsedMs * 0.022) * 0.24 +
              cinematic.barsProgress * 0.28 +
              (revealCount < words.length ? 0.14 : 0),
              0,
              0.72
            )
          : 0,
      chromatic:
        cinematic.mode === 'awakening'
          ? clamp(
              Math.sin(elapsedMs * 0.014 + 0.6) * 0.16 +
              cinematic.barsProgress * 0.24 +
              (revealCount < words.length ? 0.1 : 0),
              0,
              0.6
            )
          : 0,
    };
  }

  private getBossLine(definition: BossRushBossDefinition, mode: 'intro' | 'awakening'): string {
    const lines: Record<string, { intro: string; awakening: string }> = {
      gatekeeper: {
        intro: 'You crossed the threshold. Now prove you were meant to survive it.',
        awakening: 'The gate is broken. Good. Now face what was sealed behind it.',
      },
      splitter: {
        intro: 'I do not chase prey. I carve the arena until there is nowhere left to stand.',
        awakening: 'Pressure becomes slaughter. Run if you want the ending to be slower.',
      },
      reactor: {
        intro: 'This chamber answers to my pulse. Every safe zone you trust is already burning.',
        awakening: 'Containment failed by design. Now the whole arena detonates with me.',
      },
      executioner: {
        intro: 'I was not made to threaten you. I was made to finish what the others started.',
        awakening: 'Mercy is gone. From this point on, every mistake is a death sentence.',
      },
      grand_singularity: {
        intro: 'You did not reach the end. The end opened its eyes and waited for you.',
        awakening: 'Gravity kneels. Light folds. And you are still arrogant enough to remain.',
      },
    };

    const selected = lines[definition.key];
    if (selected) return selected[mode];
    return mode === 'awakening'
      ? `${definition.name} has awakened. The arena will not forgive hesitation.`
      : `${definition.name} enters the arena. Stand your ground if you still have one.`;
  }

  private getBossTitle(definition: BossRushBossDefinition, mode: 'intro' | 'awakening'): string {
    if (mode === 'awakening') {
      return `AWAKENING // ${definition.name.toUpperCase()}`;
    }
    return `BOSS INBOUND // ${definition.name.toUpperCase()}`;
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
    const definition = BOSS_RUSH_BOSSES[Math.min(this.currentIndex, BOSS_RUSH_BOSSES.length - 1)];
    const now = engine.elapsedMs;
    const hpRatio = boss.health / Math.max(1, boss.maxHealth);
    const awakened = !!runtime.awakened;
    const auraCadenceMs =
      runtime.state === 'awakening' ? 360 :
      awakened ? 780 :
      1180;

    if (now - this.lastAmbientSfxAtMs >= auraCadenceMs) {
      this.lastAmbientSfxAtMs = now;
      engine.sound.playBossRushAura(engine.getAudioSpatialOptions(boss.pos, true), definition.key as any, awakened);
    }

    const burstCadenceMs =
      runtime.state === 'awakening' ? 160 :
      hpRatio < 0.35 ? 320 :
      520;

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

      if (runtime.state === 'awakening') {
        engine.spawnParticles(boss.pos, definition.accent, 10, 5);
      }
    }
  }
}
