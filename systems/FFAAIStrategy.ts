import { AIState, EntityType, StatType, TankClass, Vector2 } from '../types';
import * as Vector from '../services/MathUtils';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import type { IAITank, IGameEngine } from '../services/EnemyAITanks';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAIStrategy } from './AIStrategy';

type Memory = {
  paranoiaUntil: number;
  targetId: number | null;
  targetLatchUntil: number;
  orbitSign: 1 | -1;
  wanderAngle: number;
};

const ZERO: Vector2 = { x: 0, y: 0 };

const TUNING = {
  senseRadius: 980,
  paranoiaPressure: 1.15,
  fleeHp: 0.32,
  thirdPartyHp: 0.44,
  targetLatchMin: 20,
  targetLatchMax: 30,
  separationRadius: 170,
  cohesionRadius: 300,
  bulletAvoidRadius: 520,
  maxSteering: 4.5,
};

export class FFAAIStrategy implements IAIStrategy {
  private readonly memory = new Map<number, Memory>();

  constructor(private readonly engine: IGameEngine, private readonly movement: MovementSystem) {}

  update(bot: IAITank, _dt: number): Vector2 {
    const neighbors = this.safeQuery(bot, TUNING.senseRadius);
    const enemies = neighbors.filter((e) => this.isTank(e) && !e.isDead && e.id !== bot.id);
    const bullets = neighbors.filter((e) => e?.type === EntityType.BULLET && !e.isDead && e.team !== bot.team);

    const memory = this.getMemory(bot.id);
    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const pressure = this.computePressure(bot, enemies, bullets);

    const paranoid = hpRatio <= TUNING.fleeHp || pressure >= TUNING.paranoiaPressure;
    if (paranoid) memory.paranoiaUntil = this.tick() + 26;
    const inParanoia = this.tick() <= memory.paranoiaUntil;

    const target = this.pickOpportunisticTarget(bot, enemies, memory, inParanoia);

    let goal = ZERO;
    if (inParanoia) {
      bot.aiState = AIState.FLEE;
      bot.aiShooting = false;
      goal = this.panicGoal(bot, enemies, bullets);
    } else if (target) {
      bot.aiState = AIState.COMBAT;
      bot.aiShooting = true;
      bot.aiTargetId = target.id;
      const aim = this.predict(bot, target);
      bot.aiTargetRot = Math.atan2(aim.y - bot.pos.y, aim.x - bot.pos.x);
      goal = this.combatGoal(bot, target, memory);
    } else {
      bot.aiState = AIState.HUNT;
      bot.aiShooting = false;
      bot.aiTargetId = null;
      goal = this.wanderGoal(bot, memory);
    }

    const nearTanks = neighbors.filter((e) => this.isTank(e) && !e.isDead && e.id !== bot.id).map((e) => ({ pos: e.pos }));
    const sep = this.movement.separationForce(bot.pos, nearTanks, TUNING.separationRadius);
    const coh = this.movement.cohesionForce(bot.pos, nearTanks, TUNING.cohesionRadius);
    const avoidBullets = this.bulletAvoidance(bot, bullets);
    const bounds = this.movement.boundaryAvoidanceForce(bot.pos, bot.vel, this.worldWidth(), this.worldHeight(), 260, 180);

    let steering = ZERO;
    steering = this.movement.blendSteering(steering, goal, inParanoia ? 1.5 : 1.15);
    steering = this.movement.blendSteering(steering, sep, 1.45);
    steering = this.movement.blendSteering(steering, coh, 0.2);
    steering = this.movement.blendSteering(steering, avoidBullets, 1.3);
    steering = this.movement.blendSteering(steering, bounds, 1.25);

    return this.safeSteering(bot, memory, steering, goal);
  }

  private pickOpportunisticTarget(bot: IAITank, enemies: any[], memory: Memory, inParanoia: boolean): any | null {
    const locked = memory.targetId != null ? enemies.find((e) => e.id === memory.targetId) ?? null : null;
    if (locked && this.tick() <= memory.targetLatchUntil) return locked;

    let best: any | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const hpRatio = (e.health || 100) / Math.max(1, e.maxHealth || 100);
      const lowHpBonus = hpRatio < TUNING.thirdPartyHp ? (1 - hpRatio) * 1.2 : 0;
      const engagedBonus = e.aiTargetId != null && e.aiTargetId !== bot.id ? 0.35 : 0;
      const distanceScore = 780000 / d2;
      const paranoiaPenalty = inParanoia ? 0.5 : 0;
      const score = distanceScore + lowHpBonus + engagedBonus - paranoiaPenalty;
      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }

    if (best && (!inParanoia || ((best.health || 100) / Math.max(1, best.maxHealth || 100)) < 0.25)) {
      memory.targetId = best.id;
      memory.targetLatchUntil = this.tick() + this.randomLatch(bot.id * 59, TUNING.targetLatchMin, TUNING.targetLatchMax);
      return best;
    }

    memory.targetId = null;
    memory.targetLatchUntil = 0;
    return null;
  }

  private computePressure(bot: IAITank, enemies: any[], bullets: any[]): number {
    let p = 0;
    for (let i = 0; i < enemies.length; i++) {
      const d2 = Math.max(1, Vector.distSq(bot.pos, enemies[i].pos));
      p += 140000 / d2;
    }
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const rel = Vector.sub(bot.pos, b.pos);
      const d2 = Math.max(1, Vector.magSq(rel));
      const inbound = Vector.dot(rel, b.vel || ZERO) > 0 ? 1.2 : 0.3;
      p += (22000 / d2) * inbound;
    }
    return p;
  }

  private panicGoal(bot: IAITank, enemies: any[], bullets: any[]): Vector2 {
    if (enemies.length === 0) {
      return this.movement.arriveForce(bot.pos, { x: this.worldWidth() * 0.5, y: this.worldHeight() * 0.5 }, 520, 20);
    }

    let nearest = enemies[0];
    let nearestD2 = Vector.distSq(bot.pos, nearest.pos);
    for (let i = 1; i < enemies.length; i++) {
      const d2 = Vector.distSq(bot.pos, enemies[i].pos);
      if (d2 < nearestD2) {
        nearest = enemies[i];
        nearestD2 = d2;
      }
    }

    const flee = this.movement.fleeForce(bot.pos, nearest.pos);
    const avoid = this.bulletAvoidance(bot, bullets);
    return this.movement.composeSteering([flee, avoid], [1.0, 0.76], 1.35);
  }

  private combatGoal(bot: IAITank, target: any, memory: Memory): Vector2 {
    const to = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(to)));
    const dir = Vector.normalize(to);
    const orbit = { x: -dir.y * memory.orbitSign, y: dir.x * memory.orbitSign };
    const ideal = this.isRusher(bot.classType) ? 220 : 360;

    if (dist < ideal * 0.75) {
      return this.movement.composeSteering([this.movement.fleeForce(bot.pos, target.pos), orbit], [0.95, 0.65], 1.35);
    }
    if (dist > ideal * 1.25) {
      return this.movement.composeSteering([this.movement.seekForce(bot.pos, target.pos), orbit], [1.0, 0.45], 1.35);
    }
    return this.movement.composeSteering([orbit, this.movement.seekForce(bot.pos, target.pos)], [0.9, 0.25], 1.2);
  }

  private wanderGoal(bot: IAITank, memory: Memory): Vector2 {
    const center = { x: this.worldWidth() * 0.5, y: this.worldHeight() * 0.5 };
    const radial = Vector.normalize(Vector.sub(center, bot.pos));
    const tangent = { x: -radial.y, y: radial.x };

    memory.wanderAngle += 0.12;
    if ((this.tick() + bot.id) % 45 === 0) memory.orbitSign = memory.orbitSign === 1 ? -1 : 1;

    return this.movement.composeSteering(
      [radial, Vector.mult(tangent, memory.orbitSign), { x: Math.cos(memory.wanderAngle), y: Math.sin(memory.wanderAngle) }],
      [0.65, 0.35, 0.25],
      1.2
    );
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
      const inbound = along > 0 ? 1.28 : 0.32;
      const directThreat = timeToClosest > 0 && timeToClosest < 22 && corridor < 68;
      const laneRisk = directThreat ? 1.82 : corridor < 84 ? 1.52 : corridor < 150 ? 0.96 : 0.44;
      const speedFactor = 1 + Math.min(1, Math.sqrt(velMagSq) * 0.08);
      const timeRisk = timeToClosest > 0 ? 1 / (1 + timeToClosest * 0.12) : 0.62;
      const w = (26000 / d2) * inbound * laneRisk * timeRisk * speedFactor;
      fx += (away.x * 0.36 + side.x * 1.02) * w;
      fy += (away.y * 0.36 + side.y * 1.02) * w;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private predict(bot: IAITank, target: any): Vector2 {
    const bulletSpeed = 5 + (bot.stats?.[StatType.BULLET_SPEED] ?? 0) * 0.8;
    const point = this.engine.getInterceptPoint(bot.pos, bulletSpeed, target.pos, target.vel || ZERO);
    if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) return point;
    return target.pos;
  }

  private safeSteering(bot: IAITank, memory: Memory, steering: Vector2, goal: Vector2): Vector2 {
    if (Vector.magSq(steering) > 0.00001) return Vector.limit(steering, TUNING.maxSteering);
    if (Vector.magSq(goal) > 0.00001) return Vector.limit(Vector.normalize(goal), TUNING.maxSteering);
    if (Vector.magSq(bot.vel) > 0.00001) return Vector.limit(Vector.normalize(bot.vel), TUNING.maxSteering);
    const fallback = { x: Math.cos(memory.wanderAngle), y: Math.sin(memory.wanderAngle) };
    memory.wanderAngle += 0.17;
    return Vector.limit(Vector.normalize(fallback), TUNING.maxSteering);
  }

  private getMemory(botId: number): Memory {
    const existing = this.memory.get(botId);
    if (existing) return existing;
    const fresh: Memory = {
      paranoiaUntil: 0,
      targetId: null,
      targetLatchUntil: 0,
      orbitSign: botId % 2 === 0 ? 1 : -1,
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
      // fallback
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

  private tick(): number {
    const sim = this.engine.getSimTimeMs ? this.engine.getSimTimeMs() : Date.now();
    return Math.floor(sim / 16.6667);
  }

  private randomLatch(seed: number, min: number, max: number): number {
    const n = this.seeded01((seed ^ (this.tick() * 2654435761)) >>> 0);
    return min + Math.floor(n * (max - min + 1));
  }

  private seeded01(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private worldWidth(): number {
    const w = (this.engine as any).width;
    return typeof w === 'number' && Number.isFinite(w) ? w : CANVAS_WIDTH;
  }

  private worldHeight(): number {
    const h = (this.engine as any).height;
    return typeof h === 'number' && Number.isFinite(h) ? h : CANVAS_HEIGHT;
  }

  private isRusher(cls: TankClass): boolean {
    return cls === TankClass.BOOSTER || cls === TankClass.FIGHTER || cls === TankClass.TRI_ANGLE || cls === TankClass.SPRAYER;
  }
}
