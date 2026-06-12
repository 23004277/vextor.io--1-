import { AIState, EntityType, StatType, TankClass, Team, Vector2 } from '../types';
import * as Vector from '../services/MathUtils';
import { BASE_ZONE_WIDTH, CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import type { IAITank, IGameEngine } from '../services/EnemyAITanks';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAIStrategy } from './AIStrategy';

type TargetLike = {
  id: number;
  pos: Vector2;
  vel?: Vector2;
  team?: Team;
  type?: EntityType;
  isDead?: boolean;
  health?: number;
  maxHealth?: number;
  radius?: number;
  aiTargetId?: number | null;
  classType?: TankClass;
};

type StrategyMemory = {
  stateLock: AIState;
  stateLatchUntil: number;
  targetId: number | null;
  targetLatchUntil: number;
  strafeDir: 1 | -1;
  strafeFlipTick: number;
  wanderAngle: number;
  laneOffset: number;
  lastPos: Vector2;
  stuckTicks: number;
  detourUntil: number;
  detourDir: Vector2;
};

const ZERO: Vector2 = { x: 0, y: 0 };

const TUNING = {
  maxSteering: 4.8,
  senseRadius: 1050,
  localRadius: 760,
  fleeHp: 0.34,
  criticalHp: 0.16,
  outnumberMargin: 2,
  stateLatchMin: 18,
  stateLatchMax: 30,
  targetLatchMin: 18,
  targetLatchMax: 30,
  separationRadius: 255,
  hardSeparationRadius: 145,
  crowdRadius: 380,
  cohesionRadius: 560,
  bulletAvoidRadius: 540,
  boundaryPadding: 260,
  boundaryLookAhead: 180,
  stuckMoveSq: 10 * 10,
  stuckNeedSq: 110 * 110,
  stuckTicks: 7,
  detourTicks: 38,
};

export class TDMAIStrategy implements IAIStrategy {
  private readonly memory = new Map<number, StrategyMemory>();

  constructor(private readonly engine: IGameEngine, private readonly movement: MovementSystem) {}

  update(bot: IAITank, _dt: number): Vector2 {
    const memory = this.getMemory(bot.id);
    const neighbors = this.safeQuery(bot, TUNING.senseRadius);
    const allies = neighbors.filter((e): e is TargetLike => this.isTank(e) && !e.isDead && e.id !== bot.id && e.team === bot.team);
    const enemies = neighbors.filter((e): e is TargetLike => this.isTank(e) && !e.isDead && e.id !== bot.id && (e.team !== bot.team || bot.team === Team.NONE));
    const bullets = neighbors.filter((e): e is TargetLike => e?.type === EntityType.BULLET && !e.isDead && e.team !== bot.team);

    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const local = this.countLocal(bot, allies, enemies, TUNING.localRadius);
    const shouldFlee = hpRatio <= TUNING.criticalHp || hpRatio <= TUNING.fleeHp || local.enemy >= local.ally + TUNING.outnumberMargin;
    const desiredState = shouldFlee ? AIState.FLEE : enemies.length > 0 ? AIState.COMBAT : AIState.BASE_DEFENSE;
    const state = this.latchState(memory, desiredState, bot.id);

    const target = this.pickTarget(bot, enemies, allies, memory);
    this.updateAimAndState(bot, target, state, allies);

    const goal = state === AIState.FLEE
      ? this.retreatGoal(bot, enemies, bullets, memory)
      : state === AIState.COMBAT && target
        ? this.combatGoal(bot, target, allies, memory)
        : this.defenseGoal(bot, memory);

    const antiClump = this.antiClumpForce(bot, allies, enemies);
    const supportCohesion = this.supportCohesion(bot, allies);
    const avoidBullets = this.bulletAvoidance(bot, bullets);
    const bounds = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel || ZERO,
      this.worldWidth(),
      this.worldHeight(),
      TUNING.boundaryPadding,
      TUNING.boundaryLookAhead
    );
    const laneSpread = this.laneSpreadForce(bot, memory);

    let steering = ZERO;
    steering = this.movement.blendSteering(steering, goal, state === AIState.FLEE ? 1.55 : 1.18);
    steering = this.movement.blendSteering(steering, antiClump, 2.55);
    steering = this.movement.blendSteering(steering, supportCohesion, this.isSupport(bot.classType) ? 0.28 : 0.08);
    steering = this.movement.blendSteering(steering, avoidBullets, 1.45);
    steering = this.movement.blendSteering(steering, laneSpread, state === AIState.BASE_DEFENSE ? 0.55 : 0.28);
    steering = this.movement.blendSteering(steering, bounds, 1.2);

    const desiredPoint = state === AIState.COMBAT && target ? target.pos : null;
    steering = this.applyStuckRecovery(bot, steering, goal, memory, desiredPoint);
    memory.lastPos = { x: bot.pos.x, y: bot.pos.y };
    return this.stableFallback(memory, steering, goal);
  }

  private updateAimAndState(bot: IAITank, target: TargetLike | null, state: AIState, allies: TargetLike[]): void {
    bot.aiState = state;
    bot.aiTargetId = target?.id ?? null;
    bot.aiShooting = state === AIState.COMBAT && !!target && this.hasCleanShot(bot, target, allies);

    if (target) {
      const bulletSpeed = 5 + (bot.stats?.[StatType.BULLET_SPEED] ?? 0) * 0.8;
      const aimPoint = this.engine.getInterceptPoint(bot.pos, bulletSpeed, target.pos, target.vel || ZERO);
      const use = this.isFiniteVec(aimPoint) ? aimPoint : target.pos;
      bot.aiTargetRot = Math.atan2(use.y - bot.pos.y, use.x - bot.pos.x);
    } else if (Vector.magSq(bot.vel || ZERO) > 0.0001) {
      bot.aiTargetRot = Math.atan2(bot.vel.y, bot.vel.x);
    }
  }

  private pickTarget(bot: IAITank, enemies: TargetLike[], allies: TargetLike[], memory: StrategyMemory): TargetLike | null {
    const locked = memory.targetId != null ? enemies.find((e) => e.id === memory.targetId) ?? null : null;
    if (locked && this.tick() <= memory.targetLatchUntil && this.isValidTarget(locked)) return locked;

    let best: TargetLike | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!this.isValidTarget(e)) continue;

      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const hp = (e.health ?? 100) / Math.max(1, e.maxHealth ?? 100);
      const lowHp = hp < 0.56 ? (1 - hp) * 0.95 : 0;
      const pressure = e.aiTargetId === bot.id ? 0.32 : 0;
      const occupied = this.sharedTargetOccupancy(e.id, bot, allies);
      const occupancyPenalty = Math.max(0, occupied - 1) * 0.42;
      const localPackPenalty = this.allyPackNearTarget(e, bot, allies) * 0.18;
      const score = 920000 / d2 + lowHp + pressure - occupancyPenalty - localPackPenalty;

      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }

    if (best) {
      memory.targetId = best.id;
      memory.targetLatchUntil = this.tick() + this.randomLatch(bot.id * 41, TUNING.targetLatchMin, TUNING.targetLatchMax);
    } else {
      memory.targetId = null;
      memory.targetLatchUntil = 0;
    }

    return best;
  }

  private latchState(memory: StrategyMemory, desired: AIState, botId: number): AIState {
    if (this.tick() < memory.stateLatchUntil && memory.stateLock !== desired) return memory.stateLock;
    if (memory.stateLock !== desired) {
      memory.stateLock = desired;
      memory.stateLatchUntil = this.tick() + this.randomLatch(botId * 13, TUNING.stateLatchMin, TUNING.stateLatchMax);
    }
    return memory.stateLock;
  }

  private retreatGoal(bot: IAITank, enemies: TargetLike[], bullets: TargetLike[], memory: StrategyMemory): Vector2 {
    const home = this.getRetreatPoint(bot);
    const homeForce = this.movement.arriveForce(bot.pos, home, 430, 20);
    const bullet = this.bulletAvoidance(bot, bullets);

    let enemyAway = ZERO;
    const nearest = this.nearest(bot.pos, enemies);
    if (nearest) enemyAway = this.movement.fleeForce(bot.pos, nearest.pos);

    return this.movement.composeSteering([homeForce, enemyAway, bullet, this.detourVector(memory)], [1.15, 0.74, 0.64, 0.32], 1.5);
  }

  private defenseGoal(bot: IAITank, memory: StrategyMemory): Vector2 {
    const home = this.getRetreatPoint(bot);
    const phase = memory.wanderAngle;
    const offset = {
      x: Math.cos(phase) * 190,
      y: Math.sin(phase) * 190 + memory.laneOffset,
    };
    memory.wanderAngle += 0.085 + ((bot.id % 5) * 0.004);
    const target = {
      x: this.clamp(home.x + offset.x, 150, this.worldWidth() - 150),
      y: this.clamp(home.y + offset.y, 150, this.worldHeight() - 150),
    };
    return this.movement.arriveForce(bot.pos, target, 330, 18);
  }

  private combatGoal(bot: IAITank, target: TargetLike, allies: TargetLike[], memory: StrategyMemory): Vector2 {
    if (this.tick() >= memory.strafeFlipTick) {
      memory.strafeDir = memory.strafeDir === 1 ? -1 : 1;
      memory.strafeFlipTick = this.tick() + 30 + (bot.id % 17);
    }

    const ideal = this.getIdealRange(bot.classType);
    const anchor = this.combatAnchor(bot, target, allies, ideal, memory);
    const toTarget = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(toTarget)));
    const dir = Vector.normalize(toTarget);
    const strafe = { x: -dir.y * memory.strafeDir, y: dir.x * memory.strafeDir };
    const towardAnchor = this.movement.arriveForce(bot.pos, anchor, 330, 18);
    const away = this.movement.fleeForce(bot.pos, target.pos);

    if (dist < ideal * 0.72) return this.movement.composeSteering([away, strafe, towardAnchor], [1.08, 0.64, 0.35], 1.48);
    if (dist > ideal * 1.26) return this.movement.composeSteering([towardAnchor, strafe], [1.08, 0.52], 1.42);
    return this.movement.composeSteering([strafe, towardAnchor], [0.92, 0.52], 1.28);
  }

  private combatAnchor(bot: IAITank, target: TargetLike, allies: TargetLike[], ideal: number, memory: StrategyMemory): Vector2 {
    const occupancy = this.sharedTargetOccupancy(target.id, bot, allies);
    const slotIndex = this.slotIndex(bot.id, occupancy);
    const baseAngle = Math.atan2(bot.pos.y - target.pos.y, bot.pos.x - target.pos.x);
    const slotAngle = baseAngle + slotIndex * 0.23 + memory.strafeDir * 0.12;
    const rangeJitter = ((bot.id % 5) - 2) * 18;
    return {
      x: this.clamp(target.pos.x + Math.cos(slotAngle) * (ideal + rangeJitter), 130, this.worldWidth() - 130),
      y: this.clamp(target.pos.y + Math.sin(slotAngle) * (ideal + rangeJitter), 130, this.worldHeight() - 130),
    };
  }

  private antiClumpForce(bot: IAITank, allies: TargetLike[], enemies: TargetLike[]): Vector2 {
    let fx = 0;
    let fy = 0;
    const crowdR2 = TUNING.crowdRadius * TUNING.crowdRadius;
    const hardR2 = TUNING.hardSeparationRadius * TUNING.hardSeparationRadius;
    const all = allies.concat(enemies.filter((e) => Vector.distSq(bot.pos, e.pos) < TUNING.hardSeparationRadius * TUNING.hardSeparationRadius));

    for (let i = 0; i < all.length; i++) {
      const other = all[i];
      const delta = Vector.sub(bot.pos, other.pos);
      const d2 = Math.max(1, Vector.magSq(delta));
      if (d2 > crowdR2) continue;

      const d = Math.sqrt(d2);
      const away = d > 0.001 ? { x: delta.x / d, y: delta.y / d } : this.idDirection(bot.id + other.id);
      const personal = (bot.radius ?? 20) + (other.radius ?? 20) + 34;
      const hard = d2 < hardR2 || d < personal;
      const allyBoost = other.team === bot.team ? 1.28 : 0.72;
      const falloff = 1 - Math.min(1, d / TUNING.crowdRadius);
      const strength = (hard ? 2.4 + falloff * 1.9 : falloff * 0.9) * allyBoost;
      const tangent = { x: -away.y * (bot.id % 2 === 0 ? 1 : -1), y: away.x * (bot.id % 2 === 0 ? 1 : -1) };

      fx += away.x * strength + tangent.x * strength * 0.2;
      fy += away.y * strength + tangent.y * strength * 0.2;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private supportCohesion(bot: IAITank, allies: TargetLike[]): Vector2 {
    if (!this.isSupport(bot.classType)) return ZERO;
    const wounded = allies.filter((a) => (a.health ?? 100) / Math.max(1, a.maxHealth ?? 100) < 0.72);
    if (wounded.length === 0) return ZERO;
    wounded.sort((a, b) => Vector.distSq(bot.pos, a.pos) - Vector.distSq(bot.pos, b.pos));
    return this.movement.arriveForce(bot.pos, wounded[0].pos, 430, 24);
  }

  private laneSpreadForce(bot: IAITank, memory: StrategyMemory): Vector2 {
    const retreat = this.getRetreatPoint(bot);
    const lane = {
      x: retreat.x,
      y: this.clamp(this.worldHeight() * 0.5 + memory.laneOffset, 150, this.worldHeight() - 150),
    };
    return this.movement.seekForce(bot.pos, lane);
  }

  private bulletAvoidance(bot: IAITank, bullets: TargetLike[]): Vector2 {
    let fx = 0;
    let fy = 0;
    const maxD2 = TUNING.bulletAvoidRadius * TUNING.bulletAvoidRadius;

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const rel = Vector.sub(bot.pos, b.pos);
      const d2 = Math.max(1, Vector.magSq(rel));
      if (d2 > maxD2) continue;

      const vel = b.vel || ZERO;
      const velMagSq = Vector.magSq(vel);
      const velDir = velMagSq > 0.0001 ? Vector.normalize(vel) : ZERO;
      const away = Vector.normalize(rel);
      const along = Vector.dot(rel, velDir);
      const timeToClosest = velMagSq > 0.0001 ? Vector.dot(rel, vel) / velMagSq : Infinity;
      const cross = velDir.x * rel.y - velDir.y * rel.x;
      const sideSign = cross >= 0 ? 1 : -1;
      const side = { x: -velDir.y * sideSign, y: velDir.x * sideSign };
      const corridor = Math.min(Math.abs(cross), Math.max(1, Math.sqrt(d2)));
      const inbound = along > 0 ? 1.3 : 0.32;
      const directThreat = timeToClosest > 0 && timeToClosest < 22 && corridor < 72;
      const laneRisk = directThreat ? 1.9 : corridor < 95 ? 1.52 : corridor < 165 ? 0.94 : 0.42;
      const w = (27000 / d2) * inbound * laneRisk;

      fx += (away.x * 0.34 + side.x * 1.04) * w;
      fy += (away.y * 0.34 + side.y * 1.04) * w;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private applyStuckRecovery(bot: IAITank, steering: Vector2, goal: Vector2, memory: StrategyMemory, desiredPoint: Vector2 | null): Vector2 {
    const needsMovement = desiredPoint ? Vector.distSq(bot.pos, desiredPoint) > TUNING.stuckNeedSq : Vector.magSq(goal) > 0.0001;
    const movedSq = Vector.distSq(bot.pos, memory.lastPos);

    if (needsMovement && movedSq < TUNING.stuckMoveSq) memory.stuckTicks++;
    else memory.stuckTicks = Math.max(0, memory.stuckTicks - 1);

    if (memory.stuckTicks < TUNING.stuckTicks && this.tick() > memory.detourUntil) return steering;

    if (memory.stuckTicks >= TUNING.stuckTicks) {
      memory.stuckTicks = 0;
      memory.strafeDir = memory.strafeDir === 1 ? -1 : 1;
      const toward = desiredPoint ? Vector.normalize(Vector.sub(desiredPoint, bot.pos)) : Vector.normalize(goal);
      const side = Vector.magSq(toward) > 0.0001 ? { x: -toward.y * memory.strafeDir, y: toward.x * memory.strafeDir } : this.idDirection(bot.id);
      memory.detourDir = Vector.normalize({ x: side.x * 0.88 + toward.x * 0.32, y: side.y * 0.88 + toward.y * 0.32 });
      memory.detourUntil = this.tick() + TUNING.detourTicks;
    }

    return this.movement.composeSteering([steering, this.detourVector(memory)], [0.72, 1.0], 1.45);
  }

  private hasCleanShot(bot: IAITank, target: TargetLike, allies: TargetLike[]): boolean {
    const toTarget = Vector.sub(target.pos, bot.pos);
    const distSq = Vector.magSq(toTarget);
    if (distSq < 0.0001) return true;
    const dist = Math.sqrt(distSq);
    const dir = { x: toTarget.x / dist, y: toTarget.y / dist };

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      const rel = Vector.sub(ally.pos, bot.pos);
      const forward = Vector.dot(rel, dir);
      if (forward <= 0 || forward >= dist) continue;
      const cross = Math.abs(rel.x * dir.y - rel.y * dir.x);
      if (cross < (ally.radius ?? 20) + 20) return false;
    }

    return true;
  }

  private countLocal(bot: IAITank, allies: TargetLike[], enemies: TargetLike[], radius: number): { ally: number; enemy: number } {
    const r2 = radius * radius;
    let ally = 1;
    let enemy = 0;
    for (let i = 0; i < allies.length; i++) if (Vector.distSq(bot.pos, allies[i].pos) <= r2) ally++;
    for (let i = 0; i < enemies.length; i++) if (Vector.distSq(bot.pos, enemies[i].pos) <= r2) enemy++;
    return { ally, enemy };
  }

  private getRetreatPoint(bot: IAITank): Vector2 {
    const baseWidth = this.baseZoneWidth();
    const w = this.worldWidth();
    const h = this.worldHeight();
    const laneOffset = ((bot.id % 9) - 4) * 72;
    const y = this.clamp(h * 0.5 + laneOffset, 140, h - 140);

    if (bot.team === Team.BLUE) return { x: this.clamp(baseWidth * 0.48, 140, w - 140), y };
    if (bot.team === Team.RED) return { x: this.clamp(w - baseWidth * 0.48, 140, w - 140), y };
    return { x: w * 0.5, y };
  }

  private nearest(pos: Vector2, list: TargetLike[]): TargetLike | null {
    let best: TargetLike | null = null;
    let bestD2 = Infinity;
    for (let i = 0; i < list.length; i++) {
      const d2 = Vector.distSq(pos, list[i].pos);
      if (d2 < bestD2) {
        best = list[i];
        bestD2 = d2;
      }
    }
    return best;
  }

  private sharedTargetOccupancy(targetId: number, bot: IAITank, allies: TargetLike[]): number {
    let count = 1;
    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      if (ally.id === bot.id) continue;
      if (ally.aiTargetId === targetId && Vector.distSq(ally.pos, bot.pos) <= 620 * 620) count++;
    }
    return count;
  }

  private allyPackNearTarget(target: TargetLike, bot: IAITank, allies: TargetLike[]): number {
    let count = 0;
    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      if (ally.id === bot.id) continue;
      if (Vector.distSq(ally.pos, target.pos) <= 210 * 210) count++;
    }
    return count;
  }

  private slotIndex(botId: number, occupancy: number): number {
    const span = Math.max(3, Math.min(7, occupancy + 2));
    return (botId % span) - Math.floor(span / 2);
  }

  private detourVector(memory: StrategyMemory): Vector2 {
    return this.tick() <= memory.detourUntil ? memory.detourDir : ZERO;
  }

  private stableFallback(memory: StrategyMemory, steering: Vector2, goal: Vector2): Vector2 {
    if (this.isFiniteVec(steering) && Vector.magSq(steering) > 0.00001) return Vector.limit(steering, TUNING.maxSteering);
    if (this.isFiniteVec(goal) && Vector.magSq(goal) > 0.00001) return Vector.limit(Vector.normalize(goal), TUNING.maxSteering);
    const fallback = { x: Math.cos(memory.wanderAngle), y: Math.sin(memory.wanderAngle) };
    memory.wanderAngle += 0.17;
    return Vector.limit(Vector.normalize(fallback), TUNING.maxSteering);
  }

  private getMemory(botId: number): StrategyMemory {
    const existing = this.memory.get(botId);
    if (existing) return existing;
    const laneSlot = ((botId * 37) % 9) - 4;
    const fresh: StrategyMemory = {
      stateLock: AIState.BASE_DEFENSE,
      stateLatchUntil: 0,
      targetId: null,
      targetLatchUntil: 0,
      strafeDir: botId % 2 === 0 ? 1 : -1,
      strafeFlipTick: 0,
      wanderAngle: (botId % 360) * (Math.PI / 180),
      laneOffset: laneSlot * 82,
      lastPos: { x: 0, y: 0 },
      stuckTicks: 0,
      detourUntil: 0,
      detourDir: ZERO,
    };
    this.memory.set(botId, fresh);
    return fresh;
  }

  private safeQuery(bot: IAITank, radius: number): TargetLike[] {
    try {
      const result = this.engine.spatialGrid?.query?.(bot.pos, radius);
      if (Array.isArray(result)) return result as TargetLike[];
    } catch {
      // Fall back to full entity scan.
    }

    const entities = Array.isArray(this.engine.entities) ? this.engine.entities : [];
    const out: TargetLike[] = [];
    const r2 = radius * radius;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i] as TargetLike;
      if (!e || e.isDead || !e.pos || e.id === bot.id) continue;
      if (Vector.distSq(bot.pos, e.pos) <= r2) out.push(e);
    }
    return out;
  }

  private isTank(e: TargetLike | null | undefined): boolean {
    return e?.type === EntityType.PLAYER || e?.type === EntityType.ENEMY || e?.type === EntityType.ELITE_TANK || e?.type === EntityType.GUARDIAN;
  }

  private isValidTarget(e: TargetLike): boolean {
    return !!e && !e.isDead && !!e.pos && Number.isFinite(e.pos.x) && Number.isFinite(e.pos.y);
  }

  private isSupport(cls: TankClass): boolean {
    const name = String(cls);
    return name.includes('NURSE') || name.includes('DOCTOR') || name.includes('PLAGUE') || name.includes('PACIFIST');
  }

  private getIdealRange(cls: TankClass): number {
    const name = String(cls).toUpperCase();
    if (name.includes('TRAPPER')) return 520;
    if (name.includes('SNIPER') || name.includes('ASSASSIN') || name.includes('RANGER')) return 620;
    if (name.includes('BOOSTER') || name.includes('FIGHTER') || name.includes('TRI_ANGLE') || name.includes('SPRAYER')) return 235;
    if (name.includes('NURSE') || name.includes('DOCTOR') || name.includes('PLAGUE') || name.includes('PACIFIST')) return 470;
    if (name.includes('DESTROYER') || name.includes('ANNIHILATOR') || name.includes('HYBRID')) return 430;
    return 360;
  }

  private randomLatch(seed: number, min: number, max: number): number {
    const n = this.seeded01((seed ^ (this.tick() * 2654435761)) >>> 0);
    return min + Math.floor(n * (max - min + 1));
  }

  private seeded01(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private tick(): number {
    const sim = this.engine.getSimTimeMs ? this.engine.getSimTimeMs() : Date.now();
    return Math.floor(sim / 16.6667);
  }

  private worldWidth(): number {
    const w = (this.engine as unknown as { width?: number }).width;
    return typeof w === 'number' && Number.isFinite(w) ? w : CANVAS_WIDTH;
  }

  private worldHeight(): number {
    const h = (this.engine as unknown as { height?: number }).height;
    return typeof h === 'number' && Number.isFinite(h) ? h : CANVAS_HEIGHT;
  }

  private baseZoneWidth(): number {
    const b = (this.engine as unknown as { baseZoneWidth?: number }).baseZoneWidth;
    const w = this.worldWidth();
    return this.clamp(typeof b === 'number' && Number.isFinite(b) ? b : BASE_ZONE_WIDTH, 180, w * 0.45);
  }

  private idDirection(id: number): Vector2 {
    const a = ((id * 137.508) % 360) * (Math.PI / 180);
    return { x: Math.cos(a), y: Math.sin(a) };
  }

  private isFiniteVec(v: Vector2): boolean {
    return Number.isFinite(v?.x) && Number.isFinite(v?.y);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
