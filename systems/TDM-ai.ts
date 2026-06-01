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
    const dangerPressure = this.computeDangerPressure(bot, sensed.enemies, sensed.bullets);
    const outnumbered = sensed.enemyCount >= sensed.allyCount + TUNING.outnumberedMargin;
    const shouldRetreat = hpRatio <= TUNING.fleeHealthRatio || outnumbered || dangerPressure >= TUNING.dangerFleePressure;

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
      bot.aiShooting = false;
      bot.aiTargetId = target?.id ?? null;
      if (target) bot.aiTargetRot = this.angleTo(bot.pos, this.computeInterceptPoint(bot, target));
    } else if (state === AIState.COMBAT && target) {
      const aim = this.computeInterceptPoint(bot, target);
      goal = this.computeCombatGoal(bot, target, aim, mem);
      bot.aiState = AIState.COMBAT;
      bot.aiTargetId = target.id;
      bot.aiShooting = true;
      bot.aiTargetRot = this.angleTo(bot.pos, aim);
    } else {
      if (farmTarget) {
        goal = this.movement.arriveForce(bot.pos, farmTarget.pos, 300, 20);
        bot.aiState = AIState.FARM;
        bot.aiTargetId = farmTarget.id;
        bot.aiShooting = true;
        const aim = this.computeInterceptPoint(bot, farmTarget);
        bot.aiTargetRot = this.angleTo(bot.pos, aim);
      } else {
        goal = this.computeDefenseGoal(bot, mem);
        bot.aiState = AIState.BASE_DEFENSE;
        bot.aiTargetId = null;
        bot.aiShooting = false;
        if (Vector.magSq(bot.vel) > 0.001) bot.aiTargetRot = Math.atan2(bot.vel.y, bot.vel.x);
      }
    }

    const sep = this.movement.separationForce(bot.pos, sensed.allies.map((a) => ({ pos: a.pos })), TUNING.separationRadius);
    const crowdRepel = this.computeCrowdRepulsion(bot, sensed.allies, TUNING.crowdSeparationRadius);
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
    steering = this.movement.blendSteering(steering, sep, boids.separation);
    steering = this.movement.blendSteering(steering, crowdRepel, 1.5);
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
      const score = 900000 / d2 + lowHp + focus + laneAffinity - focusPenalty;
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

  private computeCombatGoal(bot: IAITank, target: Player, aimPoint: Vector2, mem: Memory): Vector2 {
    const toTarget = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(toTarget)));
    const dir = Vector.normalize(toTarget);

    if (this.tick >= mem.strafeFlipTick) {
      mem.strafeDir = mem.strafeDir === 1 ? -1 : 1;
      mem.strafeFlipTick = this.tick + 24 + (bot.id % 13);
    }

    const strafe = { x: -dir.y * mem.strafeDir, y: dir.x * mem.strafeDir };
    const toward = this.movement.seekForce(bot.pos, aimPoint);
    const away = this.movement.fleeForce(bot.pos, target.pos);
    const ideal = this.getIdealRange(bot.classType);

    if (dist < ideal * 0.78) return this.movement.composeSteering([away, strafe], [1.0, 0.7], 1.4);
    if (dist > ideal * 1.22) return this.movement.composeSteering([toward, strafe], [1.05, 0.52], 1.4);
    return this.movement.composeSteering([strafe, toward], [0.95, 0.32], 1.2);
  }

  private computeDefenseGoal(bot: IAITank, mem: Memory): Vector2 {
    const laneAnchor = this.getLaneAnchor(bot, mem, 0.52);
    const jitter = { x: Math.cos(mem.wanderAngle) * 160, y: Math.sin(mem.wanderAngle) * 180 };
    mem.wanderAngle += 0.11 + ((bot.id % 7) * 0.003);
    const hold = { x: laneAnchor.x + jitter.x, y: laneAnchor.y + jitter.y };
    return this.movement.arriveForce(bot.pos, hold, 300, 20);
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
      const score = (xp * rarityBoost) / Math.sqrt(d2);
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

  private computeDangerPressure(bot: IAITank, enemies: Player[], bullets: Player[]): number {
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
