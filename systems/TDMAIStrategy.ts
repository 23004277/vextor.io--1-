import { AIState, EntityType, StatType, TankClass, Team, Vector2 } from '../types';
import * as Vector from '../services/MathUtils';
import { BASE_ZONE_WIDTH, CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import type { IAITank, IGameEngine } from '../services/EnemyAITanks';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAIStrategy } from './AIStrategy';

type StrategyMemory = {
  stateLock: AIState;
  stateLatchUntil: number;
  targetId: number | null;
  targetLatchUntil: number;
  strafeDir: 1 | -1;
  strafeFlipTick: number;
  wanderAngle: number;
};

const ZERO: Vector2 = { x: 0, y: 0 };

const TUNING = {
  maxSteering: 4.5,
  senseRadius: 960,
  localRadius: 720,
  fleeHp: 0.35,
  outnumberMargin: 2,
  stateLatchMin: 20,
  stateLatchMax: 30,
  targetLatchMin: 20,
  targetLatchMax: 30,
  separationRadius: 180,
  cohesionRadius: 560,
  bulletAvoidRadius: 420,
};

export class TDMAIStrategy implements IAIStrategy {
  private readonly memory = new Map<number, StrategyMemory>();

  constructor(private readonly engine: IGameEngine, private readonly movement: MovementSystem) {}

  update(bot: IAITank, _dt: number): Vector2 {
    const neighbors = this.safeQuery(bot, TUNING.senseRadius);
    const allies = neighbors.filter((e) => this.isTank(e) && !e.isDead && e.id !== bot.id && e.team === bot.team);
    const enemies = neighbors.filter((e) => this.isTank(e) && !e.isDead && e.id !== bot.id && (e.team !== bot.team || bot.team === Team.NONE));
    const bullets = neighbors.filter((e) => e?.type === EntityType.BULLET && !e.isDead && e.team !== bot.team);

    const memory = this.getMemory(bot.id);
    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const local = this.countLocal(bot, allies, enemies, TUNING.localRadius);
    const shouldFlee = hpRatio <= TUNING.fleeHp || local.enemy >= local.ally + TUNING.outnumberMargin;

    const desiredState = shouldFlee ? AIState.FLEE : enemies.length > 0 ? AIState.COMBAT : AIState.BASE_DEFENSE;
    const state = this.latchState(memory, desiredState, bot.id);

    const target = this.pickTarget(bot, enemies, memory);
    this.updateAimAndState(bot, target, state);

    const goal = state === AIState.FLEE
      ? this.movement.arriveForce(bot.pos, this.getRetreatPoint(bot), 420, 20)
      : state === AIState.COMBAT && target
        ? this.combatGoal(bot, target, memory)
        : this.defenseGoal(bot, memory);

    const sep = this.movement.separationForce(bot.pos, allies.map((a) => ({ pos: a.pos })), TUNING.separationRadius);
    const align = this.movement.alignmentForce(bot.vel, allies.map((a) => a.vel || ZERO));
    const coh = this.movement.cohesionForce(bot.pos, allies.map((a) => ({ pos: a.pos })), TUNING.cohesionRadius);
    const bounds = this.movement.boundaryAvoidanceForce(bot.pos, bot.vel, this.worldWidth(), this.worldHeight(), 250, 170);
    const avoidBullets = this.bulletAvoidance(bot, bullets);

    let steering = ZERO;
    steering = this.movement.blendSteering(steering, goal, state === AIState.FLEE ? 1.45 : 1.2);
    steering = this.movement.blendSteering(steering, sep, 1.35);
    steering = this.movement.blendSteering(steering, align, this.isSupport(bot) ? 0.95 : 0.72);
    steering = this.movement.blendSteering(steering, coh, this.isSupport(bot) ? 0.82 : 0.48);
    steering = this.movement.blendSteering(steering, avoidBullets, 1.2);
    steering = this.movement.blendSteering(steering, bounds, 1.25);

    return this.stableFallback(bot, memory, steering, goal);
  }

  private updateAimAndState(bot: IAITank, target: any | null, state: AIState): void {
    bot.aiState = state;
    bot.aiTargetId = target?.id ?? null;
    bot.aiShooting = state === AIState.COMBAT && !!target;

    if (target) {
      const bulletSpeed = 5 + (bot.stats?.[StatType.BULLET_SPEED] ?? 0) * 0.8;
      const aimPoint = this.engine.getInterceptPoint(bot.pos, bulletSpeed, target.pos, target.vel || ZERO);
      const use = this.isFiniteVec(aimPoint) ? aimPoint : target.pos;
      bot.aiTargetRot = Math.atan2(use.y - bot.pos.y, use.x - bot.pos.x);
    } else if (Vector.magSq(bot.vel) > 0.0001) {
      bot.aiTargetRot = Math.atan2(bot.vel.y, bot.vel.x);
    }
  }

  private pickTarget(bot: IAITank, enemies: any[], memory: StrategyMemory): any | null {
    const locked = memory.targetId != null ? enemies.find((e) => e.id === memory.targetId) ?? null : null;
    if (locked && this.tick() <= memory.targetLatchUntil) return locked;

    let best: any | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const hp = (e.health || 100) / Math.max(1, e.maxHealth || 100);
      const lowHp = hp < 0.55 ? (1 - hp) * 0.85 : 0;
      const score = 860000 / d2 + lowHp + (e.aiTargetId === bot.id ? 0.4 : 0);
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
    if (this.tick() < memory.stateLatchUntil && memory.stateLock !== desired) {
      return memory.stateLock;
    }
    if (memory.stateLock !== desired) {
      memory.stateLock = desired;
      memory.stateLatchUntil = this.tick() + this.randomLatch(botId * 13, TUNING.stateLatchMin, TUNING.stateLatchMax);
    }
    return memory.stateLock;
  }

  private defenseGoal(bot: IAITank, memory: StrategyMemory): Vector2 {
    const home = this.getRetreatPoint(bot);
    const offset = {
      x: Math.cos(memory.wanderAngle) * 170,
      y: Math.sin(memory.wanderAngle) * 170,
    };
    memory.wanderAngle += 0.1 + ((bot.id % 5) * 0.005);
    return this.movement.arriveForce(bot.pos, { x: home.x + offset.x, y: home.y + offset.y }, 320, 18);
  }

  private combatGoal(bot: IAITank, target: any, memory: StrategyMemory): Vector2 {
    if (this.tick() >= memory.strafeFlipTick) {
      memory.strafeDir = memory.strafeDir === 1 ? -1 : 1;
      memory.strafeFlipTick = this.tick() + 22 + (bot.id % 11);
    }

    const toTarget = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(toTarget)));
    const dir = Vector.normalize(toTarget);
    const strafe = { x: -dir.y * memory.strafeDir, y: dir.x * memory.strafeDir };
    const ideal = this.isSupport(bot) ? 460 : 330;

    if (dist < ideal * 0.75) {
      return this.movement.composeSteering([this.movement.fleeForce(bot.pos, target.pos), strafe], [1.0, 0.7], 1.4);
    }

    if (dist > ideal * 1.2) {
      return this.movement.composeSteering([this.movement.seekForce(bot.pos, target.pos), strafe], [1.05, 0.55], 1.4);
    }

    return this.movement.composeSteering([strafe, this.movement.seekForce(bot.pos, target.pos)], [0.9, 0.3], 1.2);
  }

  private bulletAvoidance(bot: IAITank, bullets: any[]): Vector2 {
    let fx = 0;
    let fy = 0;
    const maxD2 = TUNING.bulletAvoidRadius * TUNING.bulletAvoidRadius;

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const rel = Vector.sub(bot.pos, b.pos);
      const d2 = Math.max(1, Vector.magSq(rel));
      if (d2 > maxD2) continue;
      const away = Vector.normalize(rel);
      const inbound = Vector.dot(rel, b.vel || ZERO) > 0 ? 1.2 : 0.35;
      const w = (20000 / d2) * inbound;
      fx += away.x * w;
      fy += away.y * w;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private countLocal(bot: IAITank, allies: any[], enemies: any[], radius: number): { ally: number; enemy: number } {
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
    const laneOffset = ((bot.id % 5) - 2) * 85;
    const y = this.clamp(h * 0.5 + laneOffset, 140, h - 140);

    if (bot.team === Team.BLUE) return { x: this.clamp(baseWidth * 0.45, 140, w - 140), y };
    if (bot.team === Team.RED) return { x: this.clamp(w - baseWidth * 0.45, 140, w - 140), y };
    return { x: w * 0.5, y };
  }

  private stableFallback(bot: IAITank, memory: StrategyMemory, steering: Vector2, goal: Vector2): Vector2 {
    if (Vector.magSq(steering) > 0.00001) return Vector.limit(steering, TUNING.maxSteering);
    if (Vector.magSq(goal) > 0.00001) return Vector.limit(Vector.normalize(goal), TUNING.maxSteering);
    if (Vector.magSq(bot.vel) > 0.00001) return Vector.limit(Vector.normalize(bot.vel), TUNING.maxSteering);
    const fallback = { x: Math.cos(memory.wanderAngle), y: Math.sin(memory.wanderAngle) };
    memory.wanderAngle += 0.17;
    return Vector.limit(Vector.normalize(fallback), TUNING.maxSteering);
  }

  private getMemory(botId: number): StrategyMemory {
    const existing = this.memory.get(botId);
    if (existing) return existing;
    const fresh: StrategyMemory = {
      stateLock: AIState.BASE_DEFENSE,
      stateLatchUntil: 0,
      targetId: null,
      targetLatchUntil: 0,
      strafeDir: botId % 2 === 0 ? 1 : -1,
      strafeFlipTick: 0,
      wanderAngle: (botId % 360) * (Math.PI / 180),
    };
    this.memory.set(botId, fresh);
    return fresh;
  }

  private safeQuery(bot: IAITank, radius: number): any[] {
    try {
      const result = this.engine.spatialGrid?.query?.(bot.pos, radius);
      if (Array.isArray(result)) return result;
    } catch {
      // fallback below
    }

    const entities = Array.isArray(this.engine.entities) ? this.engine.entities : [];
    const out: any[] = [];
    const r2 = radius * radius;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e || e.isDead || !e.pos || e.id === bot.id) continue;
      if (Vector.distSq(bot.pos, e.pos) <= r2) out.push(e);
    }
    return out;
  }

  private isTank(e: any): boolean {
    return e?.type === EntityType.PLAYER || e?.type === EntityType.ENEMY || e?.type === EntityType.ELITE_TANK || e?.type === EntityType.GUARDIAN;
  }

  private isSupport(bot: IAITank): boolean {
    return bot.classType === TankClass.NURSE || bot.classType === TankClass.DOCTOR || bot.classType === TankClass.PLAGUE_DOCTOR;
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
    const w = (this.engine as any).width;
    return typeof w === 'number' && Number.isFinite(w) ? w : CANVAS_WIDTH;
  }

  private worldHeight(): number {
    const h = (this.engine as any).height;
    return typeof h === 'number' && Number.isFinite(h) ? h : CANVAS_HEIGHT;
  }

  private baseZoneWidth(): number {
    const b = (this.engine as any).baseZoneWidth;
    const fallback = BASE_ZONE_WIDTH;
    const w = this.worldWidth();
    return this.clamp(typeof b === 'number' && Number.isFinite(b) ? b : fallback, 180, w * 0.45);
  }

  private isFiniteVec(v: Vector2): boolean {
    return Number.isFinite(v.x) && Number.isFinite(v.y);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
