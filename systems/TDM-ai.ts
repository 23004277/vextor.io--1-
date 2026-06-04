import { AIState, GameMode, StatType, TankClass, Team, Vector2 } from '../types';
import * as Vector from '../services/MathUtils';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAITank } from '../services/EnemyAITanks';

type TacticalState = AIState.COMBAT | AIState.FLEE | AIState.BASE_DEFENSE | AIState.HUNT;

type Memory = {
  stateLatchUntil: number;
  stateLock: TacticalState;
  targetLockUntil: number;
  targetId: number | null;
  strafeDir: 1 | -1;
  strafeFlipTick: number;
  wanderAngle: number;
  laneOffsetY: number;
  laneBiasX: number;
};

export type Player = {
  id: number;
  pos: Vector2;
  vel: Vector2;
  team: Team;
  isDead?: boolean;
  health?: number;
  maxHealth?: number;
  level?: number;
  score?: number;
  classType?: TankClass;
  aiState?: AIState;
  aiTargetId?: number | null;
  xpValue?: number;
  shapeType?: string;
  rarity?: string;
  type?: 'PLAYER' | 'ENEMY' | 'BULLET' | 'SHAPE' | 'BOSS' | 'CRASHER';
  ownerId?: number;
};

type SafeZone = {
  team: Team;
  center: Vector2;
  radius: number;
};

type FrameConfig = {
  worldWidth: number;
  worldHeight: number;
  mapCenter: Vector2;
  chokePoint: Vector2;
  safeZones: SafeZone[];
};

const ZERO: Vector2 = { x: 0, y: 0 };

const DEFAULT_CONFIG: FrameConfig = {
  worldWidth: 6000,
  worldHeight: 4000,
  mapCenter: { x: 3000, y: 2000 },
  chokePoint: { x: 3000, y: 2000 },
  safeZones: [
    { team: Team.BLUE, center: { x: 500, y: 2000 }, radius: 1200 },
    { team: Team.RED, center: { x: 5500, y: 2000 }, radius: 1200 },
  ],
};

const TUNING = {
  maxSteering: 4.5,
  senseRadius: 980,
  localCountRadius: 760,
  separationRadius: 185,
  crowdSeparationRadius: 280,
  cohesionRadius: 620,
  fleeHealthRatio: 0.35,
  criticalRetreatHealthRatio: 0.18,
  outnumberedMargin: 2,
  stateLatchMinTicks: 20,
  stateLatchMaxTicks: 30,
  targetLatchMinTicks: 20,
  targetLatchMaxTicks: 30,
  bulletAvoidRadius: 420,
  dangerFleePressure: 1.25,
  farmSenseRadius: 860,
  boundaryPadding: 260,
  boundaryLookAhead: 180,
  combatRange: 360,
  combatRangeSniper: 620,
  combatRangeRusher: 220,
  laneWeight: 0.8,
  shotObstructionRadius: 42,
  flankOffset: 150,
  hostileRepelRadius: 440,
  aimTurnStepCombat: 0.22,
  aimTurnStepFallback: 0.12,
  aimDeadzone: 0.01,
};

export class TDMAISystem {
  private readonly movement = new MovementSystem();
  private readonly memory = new Map<number, Memory>();
  private config: FrameConfig = { ...DEFAULT_CONFIG };
  private tick = 0;
  private playersById = new Map<number, Player>();

  configure(next: Partial<FrameConfig>): void {
    this.config = {
      ...this.config,
      ...next,
      mapCenter: next.mapCenter ?? this.config.mapCenter,
      chokePoint: next.chokePoint ?? this.config.chokePoint,
      safeZones: next.safeZones ?? this.config.safeZones,
    };
  }

  update(bots: IAITank[], players: Player[], tick: number): void {
    this.tick = tick;
    this.playersById.clear();
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p || p.isDead) continue;
      this.playersById.set(p.id, p);
    }

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (!bot || bot.isDead || bot.team === Team.NONE) continue;
      this.updateBot(bot, players);
    }
  }

  private updateBot(bot: IAITank, players: Player[]): void {
    const mem = this.getMemory(bot.id);
    const sensed = this.sense(bot, players);
    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const dangerPressure = this.computeDangerPressure(bot, sensed.enemies, sensed.bullets, sensed.farmTargets);
    const shouldRetreat = hpRatio <= TUNING.criticalRetreatHealthRatio;
    const supportAnchor = this.isSupport(bot.classType) ? this.findSupportAnchor(bot, sensed.allies, sensed.enemies) : null;

    const desiredTarget = this.pickTarget(bot, sensed.enemies, sensed.allies, mem);
    const farmTarget = !desiredTarget && !shouldRetreat ? this.pickFarmTarget(bot, sensed.farmTargets) : null;
    const desiredState: TacticalState = shouldRetreat ? AIState.FLEE : desiredTarget ? AIState.COMBAT : AIState.HUNT;
    const state = this.applyStateLatch(mem, desiredState, bot.id);
    const target = this.resolveTargetLock(mem, desiredTarget, sensed.enemies, bot.id);

    let goal = ZERO;
    if (state === AIState.FLEE || shouldRetreat) {
      const retreatPos = this.getSafeZoneCenter(bot.team);
      goal = this.movement.arriveForce(bot.pos, retreatPos, 420, 20);
      bot.aiState = AIState.FLEE;
      bot.aiTargetId = target?.id ?? null;
      if (target) {
        const retreatAim = this.computeInterceptPoint(bot, target);
        this.setSmoothedAimRotation(bot, this.angleTo(bot.pos, retreatAim), false);
        bot.aiShooting = this.shouldTakeShot(bot, target, retreatAim, sensed.allies, AIState.FLEE);
      } else {
        bot.aiShooting = false;
      }
    } else if (state === AIState.COMBAT && target) {
      const aim = this.computeInterceptPoint(bot, target);
      goal = this.computeCombatGoal(bot, target, aim, mem, sensed.enemies);
      bot.aiState = AIState.COMBAT;
      bot.aiTargetId = target.id;
      bot.aiShooting = this.shouldTakeShot(bot, target, aim, sensed.allies, AIState.COMBAT);
      this.setSmoothedAimRotation(bot, this.angleTo(bot.pos, aim), true);
    } else {
      if (farmTarget) {
        goal = this.computeFarmGoal(bot, farmTarget);
        bot.aiState = AIState.FARM;
        bot.aiTargetId = farmTarget.id;
        const aim = this.computeInterceptPoint(bot, farmTarget);
        bot.aiShooting = this.shouldTakeShot(bot, farmTarget, aim, sensed.allies, AIState.FARM);
        this.setSmoothedAimRotation(bot, this.angleTo(bot.pos, aim), true);
      } else {
        goal = this.computeDefenseGoal(bot, mem);
        bot.aiState = AIState.BASE_DEFENSE;
        bot.aiTargetId = null;
        bot.aiShooting = false;
        if (Vector.magSq(bot.vel) > 0.001) this.setSmoothedAimRotation(bot, Math.atan2(bot.vel.y, bot.vel.x), false);
      }
    }

    const committedFarmTargetId = bot.aiState === AIState.FARM ? bot.aiTargetId ?? null : farmTarget?.id ?? null;
    const sep = this.movement.separationForce(bot.pos, sensed.allies.map((a) => ({ pos: a.pos })), TUNING.separationRadius);
    const crowdRepel = this.computeCrowdRepulsion(bot, sensed.allies, TUNING.crowdSeparationRadius);
    const hostileRepel = this.computeHostileRepulsion(bot, sensed.enemies, TUNING.hostileRepelRadius, this.getIdealRange(bot.classType));
    const farmRepel = this.computeFarmObstacleRepel(bot, sensed.farmTargets, committedFarmTargetId, state);
    const align = this.movement.alignmentForce(bot.vel, sensed.allies.map((a) => a.vel));
    const coh = this.movement.cohesionForce(bot.pos, sensed.allies.map((a) => ({ pos: a.pos })), TUNING.cohesionRadius);
    const bulletAvoid = this.computeBulletAvoid(bot, sensed.bullets);
    const laneForce = this.movement.seekForce(bot.pos, this.getLaneAnchor(bot, mem, state === AIState.FLEE ? 0.3 : 0.58));
    const bounds = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel,
      this.config.worldWidth,
      this.config.worldHeight,
      TUNING.boundaryPadding,
      TUNING.boundaryLookAhead
    );

    const boids = this.getBoidWeights(bot.classType);
    let steering = ZERO;
    steering = this.movement.blendSteering(steering, goal, shouldRetreat ? 1.45 : 1.2);
    if (supportAnchor) {
      steering = this.movement.blendSteering(
        steering,
        this.computeSupportAnchorForce(bot, supportAnchor, target),
        bot.aiState === AIState.FLEE ? 0.45 : 1.18
      );
    }
    steering = this.movement.blendSteering(steering, sep, boids.separation);
    steering = this.movement.blendSteering(steering, crowdRepel, 1.5);
    steering = this.movement.blendSteering(steering, hostileRepel, state === AIState.COMBAT ? 0.82 : 0.45);
    steering = this.movement.blendSteering(steering, farmRepel, state === AIState.COMBAT || state === AIState.FLEE ? 1.28 : 0.92);
    steering = this.movement.blendSteering(steering, align, boids.alignment);
    steering = this.movement.blendSteering(steering, coh, boids.cohesion);
    steering = this.movement.blendSteering(steering, laneForce, TUNING.laneWeight);
    steering = this.movement.blendSteering(steering, bulletAvoid, 1.2);
    steering = this.movement.blendSteering(steering, bounds, 1.3);

    if (shouldRetreat) {
      steering = this.movement.blendSteering(
        steering,
        this.movement.seekForce(bot.pos, this.getSafeZoneCenter(bot.team)),
        1.4
      );
    }

    bot.lastSteering = Vector.limit(this.ensureValidSteering(steering, goal, bot, mem), TUNING.maxSteering);
  }

  private sense(bot: IAITank, players: Player[]): { allies: IAITank[]; enemies: Player[]; bullets: Player[]; farmTargets: Player[]; allyCount: number; enemyCount: number } {
    const allies: IAITank[] = [];
    const enemies: Player[] = [];
    const bullets: Player[] = [];
    const farmTargets: Player[] = [];
    const r2 = TUNING.senseRadius * TUNING.senseRadius;
    const farmR2 = TUNING.farmSenseRadius * TUNING.farmSenseRadius;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p || p.isDead || p.id === bot.id) continue;
      if (Vector.distSq(bot.pos, p.pos) > r2) continue;

      if (p.type === 'BULLET') {
        if (p.team !== bot.team) bullets.push(p);
        continue;
      }
      if (p.type === 'SHAPE' || p.type === 'BOSS' || p.type === 'CRASHER') {
        if (Vector.distSq(bot.pos, p.pos) <= farmR2) farmTargets.push(p);
        continue;
      }

      if (p.team === bot.team) {
        const allyBot = this.asAllyBot(p);
        if (allyBot) allies.push(allyBot);
      } else {
        enemies.push(p);
      }
    }

    const presenceR2 = TUNING.localCountRadius * TUNING.localCountRadius;
    let allyCount = 1;
    let enemyCount = 0;
    for (let i = 0; i < allies.length; i++) if (Vector.distSq(bot.pos, allies[i].pos) <= presenceR2) allyCount++;
    for (let i = 0; i < enemies.length; i++) if (Vector.distSq(bot.pos, enemies[i].pos) <= presenceR2) enemyCount++;

    return { allies, enemies, bullets, farmTargets, allyCount, enemyCount };
  }

  private asAllyBot(p: Player): IAITank | null {
    const candidate = this.playersById.get(p.id);
    if (!candidate) return null;
    return {
      id: candidate.id,
      pos: candidate.pos,
      vel: candidate.vel,
      rotation: 0,
      health: candidate.health ?? 100,
      maxHealth: candidate.maxHealth ?? 100,
      team: candidate.team,
      classType: candidate.classType ?? TankClass.BASIC,
      stats: {} as any,
      visionRange: 0,
      aiUpdateTimer: 0,
      aiState: candidate.aiState ?? AIState.IDLE,
      lastSteering: ZERO,
      availableStatPoints: 0,
      isDead: !!candidate.isDead,
      aiTargetId: candidate.aiTargetId ?? null,
      aiTargetRot: 0,
      aiShooting: false,
      idleDir: null,
    };
  }

  private pickTarget(bot: IAITank, enemies: Player[], allies: IAITank[], mem: Memory): Player | null {
    if (enemies.length === 0) return null;
    const locked = mem.targetId != null ? enemies.find((e) => e.id === mem.targetId) ?? null : null;
    if (locked && this.tick <= mem.targetLockUntil) return locked;

    let best: Player | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const hpRatio = (e.health ?? 100) / Math.max(1, e.maxHealth ?? 100);
      const lowHp = hpRatio < 0.55 ? (1 - hpRatio) * 0.9 : 0;
      const focus = e.aiTargetId === bot.id ? 0.4 : 0;
      const focusPenalty = this.getAllyFocusPenalty(e.id, allies);
      const laneAffinity = this.getLaneAffinity(bot, mem, e.pos);
      const supportWindow = this.countFriendlyPressureAt(e.pos, allies, 310);
      const coverWindow = this.countEnemyPressureAt(e.id, e.pos, enemies, 310);
      const interceptPenalty = this.getInterceptDifficulty(bot, e);
      const overextendPenalty = this.getEnemySafeZonePenalty(bot.team, e.pos);
      const collapsePenalty = Math.max(0, coverWindow - supportWindow) * 0.72;
      const isolationBonus = Math.max(0, 0.42 - coverWindow * 0.2);
      const reachableBonus = Math.max(0, 0.3 - interceptPenalty * 0.5);
      const score =
        900000 / d2 +
        lowHp +
        focus +
        laneAffinity +
        supportWindow +
        isolationBonus +
        reachableBonus -
        coverWindow -
        collapsePenalty -
        overextendPenalty -
        interceptPenalty -
        focusPenalty;
      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }
    return best;
  }

  private resolveTargetLock(mem: Memory, desired: Player | null, enemies: Player[], botId: number): Player | null {
    const locked = mem.targetId != null ? enemies.find((e) => e.id === mem.targetId) ?? null : null;
    if (locked && this.tick <= mem.targetLockUntil) return locked;

    if (!desired) {
      mem.targetId = null;
      mem.targetLockUntil = 0;
      return null;
    }

    mem.targetId = desired.id;
    mem.targetLockUntil = this.tick + this.randomLatch(botId * 31, TUNING.targetLatchMinTicks, TUNING.targetLatchMaxTicks);
    return desired;
  }

  private applyStateLatch(mem: Memory, desired: TacticalState, botId: number): TacticalState {
    if (this.tick < mem.stateLatchUntil && mem.stateLock !== desired) return mem.stateLock;
    if (mem.stateLock !== desired) {
      mem.stateLock = desired;
      mem.stateLatchUntil = this.tick + this.randomLatch(botId * 17, TUNING.stateLatchMinTicks, TUNING.stateLatchMaxTicks);
    }
    return mem.stateLock;
  }

  private computeCombatGoal(bot: IAITank, target: Player, aimPoint: Vector2, mem: Memory, enemies: Player[]): Vector2 {
    const toTarget = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(toTarget)));
    const dir = Vector.normalize(toTarget);

    if (this.tick >= mem.strafeFlipTick) {
      mem.strafeDir = mem.strafeDir === 1 ? -1 : 1;
      mem.strafeFlipTick = this.tick + 24 + (bot.id % 13);
    }

    const strafe = { x: -dir.y * mem.strafeDir, y: dir.x * mem.strafeDir };
    const anchor = this.computeCombatAnchor(bot, target, aimPoint, mem, enemies);
    const toward = this.movement.arriveForce(bot.pos, anchor, 320, 18);
    const away = this.movement.fleeForce(bot.pos, target.pos);
    const ideal = this.getIdealRange(bot.classType);
    const sidestep = this.computeLocalSidestep(bot, enemies, target);

    if (dist < ideal * 0.78) return this.movement.composeSteering([away, strafe, sidestep], [1.0, 0.7, 0.4], 1.45);
    if (dist > ideal * 1.22) return this.movement.composeSteering([toward, strafe, sidestep], [1.02, 0.58, 0.34], 1.45);
    return this.movement.composeSteering([strafe, toward, sidestep], [0.92, 0.44, 0.28], 1.25);
  }

  private computeDefenseGoal(bot: IAITank, mem: Memory): Vector2 {
    const laneAnchor = this.getLaneAnchor(bot, mem, 0.52);
    const jitter = { x: Math.cos(mem.wanderAngle) * 160, y: Math.sin(mem.wanderAngle) * 180 };
    mem.wanderAngle += 0.11 + ((bot.id % 7) * 0.003);
    const hold = { x: laneAnchor.x + jitter.x, y: laneAnchor.y + jitter.y };
    return this.movement.arriveForce(bot.pos, hold, 300, 20);
  }

  private computeFarmGoal(bot: IAITank, target: Player): Vector2 {
    const toTarget = Vector.sub(target.pos, bot.pos);
    const distSq = Vector.magSq(toTarget);
    const dist = Math.max(1, Math.sqrt(distSq));
    const dir = Vector.normalize(toTarget);
    const shapeRadius = this.getFarmTargetRadius(target);
    const botRadius = this.getBotRadius(bot);
    const panicRange = botRadius + shapeRadius + 90;
    const holdRange = Math.max(175, shapeRadius + 235 + (target.type === 'CRASHER' ? 70 : 0));

    if (dist < panicRange) {
      return this.movement.composeSteering(
        [
          this.movement.fleeForce(bot.pos, target.pos),
          { x: -dir.y, y: dir.x }
        ],
        [1.18, 0.34],
        1.4
      );
    }

    const anchor = {
      x: target.pos.x - dir.x * holdRange,
      y: target.pos.y - dir.y * holdRange
    };
    return this.movement.arriveForce(bot.pos, anchor, 250, 24);
  }

  private pickFarmTarget(bot: IAITank, farmTargets: Player[]): Player | null {
    if (farmTargets.length === 0) return null;
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < farmTargets.length; i++) {
      const f = farmTargets[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, f.pos));
      const xp = Math.max(40, f.xpValue ?? (f.type === 'BOSS' ? 1200 : f.type === 'CRASHER' ? 220 : 110));
      const rarityBoost = f.rarity === 'Legendary' || f.rarity === 'Mythical' || f.rarity === 'Eternal' ? 1.5 : 1.0;
      const antiOverlap = this.isShapeTargetCrowdedByAlly(bot, f) ? 0.48 : 1;
      const shapeRadius = this.getFarmTargetRadius(f);
      const botRadius = this.getBotRadius(bot);
      const bodyRiskPenalty = d2 < (botRadius + shapeRadius + 48) * (botRadius + shapeRadius + 48) ? 0.15 : 1;
      const score = ((xp * rarityBoost) / Math.sqrt(d2)) * antiOverlap * bodyRiskPenalty;
      if (score > bestScore) {
        best = f;
        bestScore = score;
      }
    }
    return best;
  }

  private computeCrowdRepulsion(bot: IAITank, allies: IAITank[], radius: number): Vector2 {
    const r2 = radius * radius;
    let fx = 0;
    let fy = 0;
    let count = 0;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      const dx = bot.pos.x - ally.pos.x;
      const dy = bot.pos.y - ally.pos.y;
      const d2 = Math.max(1, dx * dx + dy * dy);
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      const t = 1 - Math.min(1, d / radius);
      const w = (t * t) * 1.9;
      fx += (dx / d) * w;
      fy += (dy / d) * w;
      count++;
    }

    if (count === 0 || (Math.abs(fx) + Math.abs(fy) < 0.0001)) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeFarmObstacleRepel(bot: IAITank, farmTargets: Player[], committedTargetId: number | null, state: TacticalState): Vector2 {
    if (farmTargets.length === 0) return ZERO;
    const avoidRadius = (state === AIState.COMBAT || state === AIState.FLEE ? 290 : state === AIState.HUNT ? 255 : 235);
    const avoidR2 = avoidRadius * avoidRadius;
    let fx = 0;
    let fy = 0;

    for (let i = 0; i < farmTargets.length; i++) {
      const target = farmTargets[i];
      if (committedTargetId != null && target.id === committedTargetId) continue;
      const dx = bot.pos.x - target.pos.x;
      const dy = bot.pos.y - target.pos.y;
      const d2 = Math.max(1, dx * dx + dy * dy);
      const radius = this.getFarmTargetRadius(target);
      const personalSpace = this.getBotRadius(bot) + radius + 80;
      const personalR2 = personalSpace * personalSpace;
      if (d2 > avoidR2 && d2 > personalR2) continue;
      const d = Math.sqrt(d2);
      const pressureRadius = Math.max(avoidRadius, personalSpace);
      const closeness = 1 - Math.min(1, d / pressureRadius);
      const typeWeight = target.type === 'CRASHER' ? 2.45 : target.type === 'BOSS' ? 1.7 : 1.28;
      const urgency = d2 <= personalR2 ? 2.25 : 1.0;
      const weight = closeness * closeness * typeWeight * urgency;
      fx += (dx / d) * weight;
      fy += (dy / d) * weight;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeInterceptPoint(bot: IAITank, target: Player): Vector2 {
    const bulletSpeed = 5 + (bot.stats?.[StatType.BULLET_SPEED] ?? 0) * 0.8;
    const rel = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(rel)));
    const t = Math.min(1.0, dist / Math.max(12, bulletSpeed * 56));
    const tv = target.vel ?? ZERO;
    return { x: target.pos.x + tv.x * t * 60, y: target.pos.y + tv.y * t * 60 };
  }

  private computeBulletAvoid(bot: IAITank, bullets: Player[]): Vector2 {
    let fx = 0;
    let fy = 0;
    const maxD2 = TUNING.bulletAvoidRadius * TUNING.bulletAvoidRadius;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const rel = Vector.sub(bot.pos, b.pos);
      const d2 = Math.max(1, Vector.magSq(rel));
      if (d2 > maxD2) continue;
      const away = Vector.normalize(rel);
      const inbound = Vector.dot(rel, b.vel ?? ZERO) > 0 ? 1.2 : 0.35;
      const w = (22000 / d2) * inbound;
      fx += away.x * w;
      fy += away.y * w;
    }
    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private getBoidWeights(cls: TankClass): { separation: number; alignment: number; cohesion: number } {
    if (this.isSupport(cls)) return { separation: 1.8, alignment: 0.55, cohesion: 0.18 };
    if (this.isRusher(cls)) return { separation: 1.45, alignment: 0.4, cohesion: 0.1 };
    return { separation: 1.6, alignment: 0.45, cohesion: 0.14 };
  }

  private computeHostileRepulsion(bot: IAITank, enemies: Player[], radius: number, idealRange: number): Vector2 {
    const r2 = radius * radius;
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const dx = bot.pos.x - e.pos.x;
      const dy = bot.pos.y - e.pos.y;
      const d2 = Math.max(1, dx * dx + dy * dy);
      if (d2 > r2 || d2 > idealRange * idealRange) continue;
      const d = Math.sqrt(d2);
      const w = (1 - Math.min(1, d / radius)) * 1.35;
      fx += (dx / d) * w;
      fy += (dy / d) * w;
    }
    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeCombatAnchor(bot: IAITank, target: Player, aimPoint: Vector2, mem: Memory, enemies: Player[]): Vector2 {
    const ideal = this.getIdealRange(bot.classType);
    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
    const side = { x: -toTarget.y * mem.strafeDir, y: toTarget.x * mem.strafeDir };
    let coverBias = ZERO;
    let count = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.id === target.id) continue;
      if (Vector.distSq(e.pos, target.pos) > 520 * 520) continue;
      cx += e.pos.x;
      cy += e.pos.y;
      count++;
    }
    if (count > 0) {
      const centroid = { x: cx / count, y: cy / count };
      coverBias = this.movement.fleeForce(centroid, target.pos);
    }
    const flank = this.isSupport(bot.classType) ? TUNING.flankOffset * 1.1 : this.isRusher(bot.classType) ? TUNING.flankOffset * 0.72 : TUNING.flankOffset;
    return {
      x: aimPoint.x - toTarget.x * (ideal * 0.76) + side.x * flank + coverBias.x * 55,
      y: aimPoint.y - toTarget.y * (ideal * 0.76) + side.y * flank + coverBias.y * 55,
    };
  }

  private computeLocalSidestep(bot: IAITank, enemies: Player[], target: Player): Vector2 {
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.id === target.id) continue;
      const d2 = Vector.distSq(bot.pos, e.pos);
      if (d2 > 360 * 360) continue;
      const toEnemy = Vector.normalize(Vector.sub(e.pos, bot.pos));
      fx += -toEnemy.y * 0.35;
      fy += toEnemy.x * 0.35;
    }
    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private countFriendlyPressureAt(point: Vector2, allies: IAITank[], radius: number): number {
    let count = 0;
    const r2 = radius * radius;
    for (let i = 0; i < allies.length; i++) {
      if (Vector.distSq(point, allies[i].pos) <= r2) count++;
    }
    return Math.min(0.75, count * 0.18);
  }

  private countEnemyPressureAt(targetId: number, point: Vector2, enemies: Player[], radius: number): number {
    let count = 0;
    const r2 = radius * radius;
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].id === targetId) continue;
      if (Vector.distSq(point, enemies[i].pos) <= r2) count++;
    }
    return Math.min(0.95, count * 0.22);
  }

  private getInterceptDifficulty(bot: IAITank, target: Player): number {
    const bulletSpeed = 5 + (bot.stats?.[StatType.BULLET_SPEED] ?? 0) * 0.8;
    const rel = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(rel)));
    const travel = dist / Math.max(1, bulletSpeed);
    const targetSpeed = Math.sqrt(Vector.magSq(target.vel ?? ZERO));
    return Math.min(0.9, targetSpeed * travel * 0.018);
  }

  private shouldTakeShot(bot: IAITank, target: Player, aimPoint: Vector2, allies: IAITank[], state: AIState): boolean {
    const dist = Math.sqrt(Math.max(1, Vector.distSq(bot.pos, target.pos)));
    const ideal = this.getIdealRange(bot.classType);
    const maxRange = target.type === 'SHAPE' || target.type === 'CRASHER' || target.type === 'BOSS'
      ? ideal * 1.1
      : this.isSupport(bot.classType)
        ? ideal * 1.25
        : ideal * 1.45;
    if (dist > maxRange) return false;
    if (state === AIState.FLEE && dist > ideal * 0.82 && ((target.health ?? 100) / Math.max(1, target.maxHealth ?? 100)) > 0.38) return false;
    if (target.type === 'CRASHER' && dist < this.getFarmTargetRadius(target) + this.getBotRadius(bot) + 120) return false;
    const confidence = this.getShotConfidence(bot, target, dist, state);
    const threshold =
      state === AIState.FLEE
        ? 0.7
        : target.type === 'SHAPE' || target.type === 'CRASHER' || target.type === 'BOSS'
          ? 0.42
          : 0.52;
    if (confidence < threshold) return false;
    return !this.hasFriendlyObstruction(bot.pos, aimPoint, allies);
  }

  private hasFriendlyObstruction(from: Vector2, to: Vector2, allies: IAITank[]): boolean {
    const line = Vector.sub(to, from);
    const len = Math.sqrt(Math.max(1, Vector.magSq(line)));
    const dir = Vector.normalize(line);
    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      const rel = Vector.sub(ally.pos, from);
      const forward = Vector.dot(rel, dir);
      if (forward <= 30 || forward >= len - 24) continue;
      const closest = { x: from.x + dir.x * forward, y: from.y + dir.y * forward };
      const perp = Math.sqrt(Vector.distSq(ally.pos, closest));
      if (perp <= TUNING.shotObstructionRadius) return true;
    }
    return false;
  }

  private computeDangerPressure(bot: IAITank, enemies: Player[], bullets: Player[], farmTargets: Player[]): number {
    let pressure = 0;
    for (let i = 0; i < enemies.length; i++) {
      const d2 = Math.max(1, Vector.distSq(bot.pos, enemies[i].pos));
      pressure += 160000 / d2;
    }
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const rel = Vector.sub(bot.pos, b.pos);
      const d2 = Math.max(1, Vector.magSq(rel));
      const inbound = Vector.dot(rel, b.vel ?? ZERO) > 0 ? 1.3 : 0.32;
      pressure += (23000 / d2) * inbound;
    }
    for (let i = 0; i < farmTargets.length; i++) {
      const target = farmTargets[i];
      const radius = this.getFarmTargetRadius(target);
      const personalSpace = this.getBotRadius(bot) + radius + 110;
      const d2 = Math.max(1, Vector.distSq(bot.pos, target.pos));
      if (d2 > personalSpace * personalSpace) continue;
      const hazardWeight = target.type === 'CRASHER' ? 0.6 : target.type === 'BOSS' ? 0.42 : 0.18;
      pressure += hazardWeight * (personalSpace * personalSpace / d2) * 0.22;
    }
    return pressure;
  }

  private ensureValidSteering(steering: Vector2, goal: Vector2, bot: IAITank, mem: Memory): Vector2 {
    if (Vector.magSq(steering) > 0.00001) return steering;
    if (Vector.magSq(goal) > 0.00001) return Vector.normalize(goal);
    if (Vector.magSq(bot.vel) > 0.00001) return Vector.normalize(bot.vel);
    const fallback = { x: Math.cos(mem.wanderAngle), y: Math.sin(mem.wanderAngle) };
    mem.wanderAngle += 0.17;
    return Vector.normalize(fallback);
  }

  private getSafeZoneCenter(team: Team): Vector2 {
    const zone = this.config.safeZones.find((z) => z.team === team);
    if (zone) return zone.center;
    return this.config.mapCenter;
  }

  private getIdealRange(cls: TankClass): number {
    if (cls === TankClass.SNIPER || cls === TankClass.ASSASSIN || cls === TankClass.RANGER || cls === TankClass.STALKER) {
      return TUNING.combatRangeSniper;
    }
    if (this.isRusher(cls)) return TUNING.combatRangeRusher;
    return TUNING.combatRange;
  }

  private getMemory(botId: number): Memory {
    const existing = this.memory.get(botId);
    if (existing) return existing;
    const created: Memory = {
      stateLatchUntil: 0,
      stateLock: AIState.BASE_DEFENSE,
      targetLockUntil: 0,
      targetId: null,
      strafeDir: botId % 2 === 0 ? 1 : -1,
      strafeFlipTick: 0,
      wanderAngle: (botId % 360) * (Math.PI / 180),
      laneOffsetY: ((botId % 11) - 5) * 115,
      laneBiasX: ((botId % 5) - 2) * 45,
    };
    this.memory.set(botId, created);
    return created;
  }

  private getLaneAnchor(bot: IAITank, mem: Memory, depth: number): Vector2 {
    const w = this.config.worldWidth;
    const h = this.config.worldHeight;
    const laneY = this.clamp(h * 0.5 + mem.laneOffsetY, 160, h - 160);
    const laneX = bot.team === Team.BLUE
      ? w * depth + mem.laneBiasX
      : w * (1 - depth) - mem.laneBiasX;
    return { x: this.clamp(laneX, 160, w - 160), y: laneY };
  }

  private isShapeTargetCrowdedByAlly(bot: IAITank, target: Player): boolean {
    for (const ally of this.playersById.values()) {
      if (ally.id === bot.id || ally.team !== bot.team) continue;
      if (ally.type === 'BULLET' || ally.type === 'SHAPE' || ally.type === 'BOSS' || ally.type === 'CRASHER') continue;
      const sameTarget = ally.aiTargetId === target.id;
      const nearTarget = Vector.distSq(ally.pos, target.pos) <= 180 * 180;
      if (sameTarget || nearTarget) return true;
    }
    return false;
  }

  private getFarmTargetRadius(target: Player): number {
    if (target.type === 'CRASHER') return 24;
    if (target.type === 'BOSS') return 72;
    const shape = target.shapeType ?? '';
    if (shape.includes('ALPHA_PENTAGON')) return 48;
    if (shape.includes('PENTAGON')) return 36;
    if (shape.includes('SQUARE')) return 18;
    if (shape.includes('TRIANGLE')) return 20;
    return 24;
  }

  private getBotRadius(bot: IAITank): number {
    return this.isRusher(bot.classType) ? 20 : this.isSupport(bot.classType) ? 22 : 24;
  }

  private getAllyFocusPenalty(targetId: number, allies: IAITank[]): number {
    let focused = 0;
    for (let i = 0; i < allies.length; i++) {
      if (allies[i].aiTargetId === targetId) focused++;
    }
    return Math.min(1.25, focused * 0.28);
  }

  private getLaneAffinity(bot: IAITank, mem: Memory, point: Vector2): number {
    const lane = this.getLaneAnchor(bot, mem, 0.58);
    const dy = Math.abs(point.y - lane.y);
    return Math.max(0, 0.35 - dy / 1800);
  }

  private findSupportAnchor(bot: IAITank, allies: IAITank[], enemies: Player[]): IAITank | null {
    let best: IAITank | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      const hpRatio = ally.health / Math.max(1, ally.maxHealth);
      if (hpRatio > 0.82) continue;
      const d2 = Math.max(1, Vector.distSq(bot.pos, ally.pos));
      const hostilePressure = this.countEnemyPressureAt(ally.id, ally.pos, enemies, 340);
      const score = (1 - hpRatio) * 1.8 + hostilePressure * 0.55 + 260000 / d2;
      if (score > bestScore) {
        bestScore = score;
        best = ally;
      }
    }
    return best;
  }

  private computeSupportAnchorForce(bot: IAITank, ally: IAITank, target: Player | null): Vector2 {
    if (!target) {
      return this.movement.arriveForce(bot.pos, ally.pos, 180, 18);
    }

    const toThreat = Vector.normalize(Vector.sub(target.pos, ally.pos));
    const desired = {
      x: ally.pos.x - toThreat.x * 120,
      y: ally.pos.y - toThreat.y * 120
    };
    return this.movement.arriveForce(bot.pos, desired, 190, 18);
  }

  private getEnemySafeZonePenalty(botTeam: Team, point: Vector2): number {
    let enemyZone: SafeZone | undefined;
    for (let i = 0; i < this.config.safeZones.length; i++) {
      const zone = this.config.safeZones[i];
      if (zone.team !== Team.NONE && zone.team !== botTeam) {
        enemyZone = zone;
        break;
      }
    }
    if (!enemyZone) return 0;
    const dist = Math.sqrt(Math.max(1, Vector.distSq(point, enemyZone.center)));
    if (dist >= enemyZone.radius * 1.08) return 0;
    const normalized = 1 - Math.min(1, dist / Math.max(1, enemyZone.radius * 1.08));
    return normalized * 0.9;
  }

  private getShotConfidence(bot: IAITank, target: Player, distance: number, state: AIState): number {
    const targetSpeed = Math.sqrt(Vector.magSq(target.vel ?? ZERO));
    const ideal = this.getIdealRange(bot.classType);
    const travelPenalty = Math.min(0.58, (distance / Math.max(160, ideal * 1.18)) * 0.34);
    const lateralPenalty = Math.min(0.36, targetSpeed * 0.022);
    const finishBonus = ((target.health ?? 100) / Math.max(1, target.maxHealth ?? 100)) < 0.4 ? 0.12 : 0;
    const farmBonus = target.type === 'SHAPE' || target.type === 'CRASHER' || target.type === 'BOSS' ? 0.18 : 0;
    const fleePenalty = state === AIState.FLEE ? 0.18 : 0;
    return Math.max(0, Math.min(1.2, 1 + finishBonus + farmBonus - travelPenalty - lateralPenalty - fleePenalty));
  }

  private randomLatch(seed: number, min: number, max: number): number {
    const n = this.seeded01((seed ^ (this.tick * 2654435761)) >>> 0);
    return min + Math.floor(n * (max - min + 1));
  }

  private seeded01(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private angleTo(from: Vector2, to: Vector2): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  private setSmoothedAimRotation(bot: IAITank, desiredAngle: number, combatTracking: boolean): void {
    if (!Number.isFinite(bot.aiTargetRot)) {
      bot.aiTargetRot = desiredAngle;
      return;
    }
    const diff = this.normalizeAngle(desiredAngle - bot.aiTargetRot);
    if (Math.abs(diff) <= TUNING.aimDeadzone) return;
    const step = combatTracking ? TUNING.aimTurnStepCombat : TUNING.aimTurnStepFallback;
    bot.aiTargetRot = this.normalizeAngle(bot.aiTargetRot + diff * step);
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  private isSupport(cls: TankClass): boolean {
    return cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR;
  }

  private isRusher(cls: TankClass): boolean {
    return cls === TankClass.BOOSTER || cls === TankClass.FIGHTER || cls === TankClass.TRI_ANGLE || cls === TankClass.SPRAYER;
  }

  // Compatibility helper if a caller still expects this to be TDM-specific.
  getMode(): GameMode {
    return GameMode.TEAMS;
  }
}
