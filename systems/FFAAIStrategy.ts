import { AIState, EntityType, StatType, TankClass, Vector2 } from '../types';
import * as Vector from '../services/MathUtils';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import type { IAITank, IGameEngine } from '../services/EnemyAITanks';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAIStrategy } from './AIStrategy';

type TargetLike = {
  id: number;
  pos: Vector2;
  vel?: Vector2;
  team?: unknown;
  type?: EntityType;
  isDead?: boolean;
  health?: number;
  maxHealth?: number;
  radius?: number;
  aiTargetId?: number | null;
  classType?: TankClass;
};

type Memory = {
  paranoiaUntil: number;
  targetId: number | null;
  targetLatchUntil: number;
  orbitSign: 1 | -1;
  orbitFlipTick: number;
  wanderAngle: number;
  lastPos: Vector2;
  stuckTicks: number;
  detourUntil: number;
  detourDir: Vector2;
};

const ZERO: Vector2 = { x: 0, y: 0 };

const TUNING = {
  senseRadius: 1080,
  targetLatchMin: 18,
  targetLatchMax: 30,
  paranoiaTicks: 28,
  paranoiaPressure: 1.08,
  fleeHp: 0.31,
  thirdPartyHp: 0.46,
  maxSteering: 4.8,
  separationRadius: 245,
  hardSeparationRadius: 138,
  crowdRadius: 360,
  bulletAvoidRadius: 560,
  boundaryPadding: 270,
  boundaryLookAhead: 190,
  stuckMoveSq: 10 * 10,
  stuckNeedSq: 90 * 90,
  stuckTicks: 7,
  detourTicks: 34,
};

export class FFAAIStrategy implements IAIStrategy {
  private readonly memory = new Map<number, Memory>();

  constructor(private readonly engine: IGameEngine, private readonly movement: MovementSystem) {}

  update(bot: IAITank, _dt: number): Vector2 {
    const memory = this.getMemory(bot.id);
    const neighbors = this.safeQuery(bot, TUNING.senseRadius);
    const tanks = neighbors.filter((e): e is TargetLike => this.isTank(e) && !e.isDead && e.id !== bot.id);
    const bullets = neighbors.filter((e): e is TargetLike => e?.type === EntityType.BULLET && !e.isDead && e.team !== bot.team);

    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const pressure = this.computePressure(bot, tanks, bullets);
    const paranoid = hpRatio <= TUNING.fleeHp || pressure >= TUNING.paranoiaPressure;
    if (paranoid) memory.paranoiaUntil = this.tick() + TUNING.paranoiaTicks;
    const inParanoia = this.tick() <= memory.paranoiaUntil;

    const target = this.pickOpportunisticTarget(bot, tanks, memory, inParanoia);
    let goal = ZERO;

    if (inParanoia) {
      bot.aiState = AIState.FLEE;
      bot.aiTargetId = null;
      bot.aiShooting = false;
      goal = this.panicGoal(bot, tanks, bullets, memory);
      this.faceMovement(bot);
    } else if (target) {
      const aim = this.predict(bot, target);
      bot.aiState = AIState.COMBAT;
      bot.aiTargetId = target.id;
      bot.aiTargetRot = Math.atan2(aim.y - bot.pos.y, aim.x - bot.pos.x);
      bot.aiShooting = this.hasCleanShot(bot, target, tanks);
      goal = this.combatGoal(bot, target, memory);
    } else {
      bot.aiState = AIState.HUNT;
      bot.aiTargetId = null;
      bot.aiShooting = false;
      goal = this.wanderGoal(bot, memory);
      this.faceMovement(bot);
    }

    const antiClump = this.antiClumpForce(bot, tanks);
    const bulletAvoid = this.bulletAvoidance(bot, bullets);
    const bounds = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel || ZERO,
      this.worldWidth(),
      this.worldHeight(),
      TUNING.boundaryPadding,
      TUNING.boundaryLookAhead
    );

    let steering = ZERO;
    steering = this.movement.blendSteering(steering, goal, inParanoia ? 1.55 : 1.18);
    steering = this.movement.blendSteering(steering, antiClump, 2.35);
    steering = this.movement.blendSteering(steering, bulletAvoid, 1.45);
    steering = this.movement.blendSteering(steering, bounds, 1.18);

    const desiredPoint = target?.pos ?? null;
    steering = this.applyStuckRecovery(bot, steering, goal, memory, desiredPoint);
    memory.lastPos = { x: bot.pos.x, y: bot.pos.y };
    return this.safeSteering(memory, steering, goal);
  }

  private pickOpportunisticTarget(bot: IAITank, enemies: TargetLike[], memory: Memory, inParanoia: boolean): TargetLike | null {
    const locked = memory.targetId != null ? enemies.find((e) => e.id === memory.targetId) ?? null : null;
    if (locked && this.tick() <= memory.targetLatchUntil && this.isValidTarget(locked)) return locked;

    let best: TargetLike | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!this.isValidTarget(e)) continue;

      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const hp = (e.health ?? 100) / Math.max(1, e.maxHealth ?? 100);
      const lowHpBonus = hp < TUNING.thirdPartyHp ? (1 - hp) * 1.35 : 0;
      const busyBonus = e.aiTargetId != null && e.aiTargetId !== bot.id ? 0.36 : 0;
      const retaliationBonus = e.aiTargetId === bot.id ? 0.18 : 0;
      const distanceScore = 830000 / d2;
      const threatPenalty = inParanoia && hp > 0.25 ? 0.72 : 0;
      const score = distanceScore + lowHpBonus + busyBonus + retaliationBonus - threatPenalty;

      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }

    if (best && (!inParanoia || ((best.health ?? 100) / Math.max(1, best.maxHealth ?? 100)) < 0.25)) {
      memory.targetId = best.id;
      memory.targetLatchUntil = this.tick() + this.randomLatch(bot.id * 59, TUNING.targetLatchMin, TUNING.targetLatchMax);
      return best;
    }

    memory.targetId = null;
    memory.targetLatchUntil = 0;
    return null;
  }

  private computePressure(bot: IAITank, enemies: TargetLike[], bullets: TargetLike[]): number {
    let pressure = 0;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const hp = (e.health ?? 100) / Math.max(1, e.maxHealth ?? 100);
      const closeThreat = d2 < TUNING.hardSeparationRadius * TUNING.hardSeparationRadius ? 0.42 : 0;
      pressure += 150000 / d2 + closeThreat + (hp > 0.7 ? 0.04 : 0);
    }

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const rel = Vector.sub(bot.pos, b.pos);
      const d2 = Math.max(1, Vector.magSq(rel));
      const inbound = Vector.dot(rel, b.vel || ZERO) > 0 ? 1.24 : 0.3;
      pressure += (25000 / d2) * inbound;
    }

    return pressure;
  }

  private panicGoal(bot: IAITank, enemies: TargetLike[], bullets: TargetLike[], memory: Memory): Vector2 {
    const bulletAvoid = this.bulletAvoidance(bot, bullets);

    if (enemies.length === 0) {
      const center = { x: this.worldWidth() * 0.5, y: this.worldHeight() * 0.5 };
      return this.movement.composeSteering([
        this.movement.arriveForce(bot.pos, center, 520, 20),
        bulletAvoid,
        this.detourVector(memory),
      ], [0.7, 1.0, 0.35], 1.4);
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
    const side = this.sideStepFrom(bot.pos, nearest.pos, memory.orbitSign);
    return this.movement.composeSteering([flee, side, bulletAvoid, this.detourVector(memory)], [1.15, 0.55, 0.88, 0.32], 1.55);
  }

  private combatGoal(bot: IAITank, target: TargetLike, memory: Memory): Vector2 {
    if (this.tick() >= memory.orbitFlipTick) {
      memory.orbitSign = memory.orbitSign === 1 ? -1 : 1;
      memory.orbitFlipTick = this.tick() + 28 + (bot.id % 17);
    }

    const to = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(to)));
    const dir = Vector.normalize(to);
    const orbit = { x: -dir.y * memory.orbitSign, y: dir.x * memory.orbitSign };
    const ideal = this.getIdealRange(bot.classType);

    if (dist < ideal * 0.72) {
      return this.movement.composeSteering([this.movement.fleeForce(bot.pos, target.pos), orbit], [1.05, 0.68], 1.45);
    }

    if (dist > ideal * 1.28) {
      return this.movement.composeSteering([this.movement.seekForce(bot.pos, target.pos), orbit], [1.0, 0.48], 1.4);
    }

    return this.movement.composeSteering([orbit, this.movement.seekForce(bot.pos, target.pos)], [0.96, 0.18], 1.25);
  }

  private wanderGoal(bot: IAITank, memory: Memory): Vector2 {
    const center = { x: this.worldWidth() * 0.5, y: this.worldHeight() * 0.5 };
    const toCenter = Vector.sub(center, bot.pos);
    const radial = Vector.magSq(toCenter) > 0.0001 ? Vector.normalize(toCenter) : ZERO;
    const tangent = { x: -radial.y * memory.orbitSign, y: radial.x * memory.orbitSign };
    const noise = { x: Math.cos(memory.wanderAngle), y: Math.sin(memory.wanderAngle) };

    memory.wanderAngle += 0.105 + (bot.id % 5) * 0.003;
    if ((this.tick() + bot.id) % 57 === 0) memory.orbitSign = memory.orbitSign === 1 ? -1 : 1;

    return this.movement.composeSteering([radial, tangent, noise], [0.7, 0.42, 0.24], 1.2);
  }

  private antiClumpForce(bot: IAITank, tanks: TargetLike[]): Vector2 {
    let fx = 0;
    let fy = 0;
    const crowdR2 = TUNING.crowdRadius * TUNING.crowdRadius;
    const hardR2 = TUNING.hardSeparationRadius * TUNING.hardSeparationRadius;

    for (let i = 0; i < tanks.length; i++) {
      const other = tanks[i];
      const delta = Vector.sub(bot.pos, other.pos);
      const d2 = Math.max(1, Vector.magSq(delta));
      if (d2 > crowdR2) continue;

      const d = Math.sqrt(d2);
      const away = d > 0.001 ? { x: delta.x / d, y: delta.y / d } : this.idDirection(bot.id + other.id);
      const personal = (bot.radius ?? 20) + (other.radius ?? 20) + 28;
      const hard = d2 < hardR2 || d < personal;
      const falloff = 1 - Math.min(1, d / TUNING.crowdRadius);
      const strength = hard ? 2.25 + falloff * 1.8 : falloff * 0.82;
      const tangent = { x: -away.y * (bot.id % 2 === 0 ? 1 : -1), y: away.x * (bot.id % 2 === 0 ? 1 : -1) };

      fx += away.x * strength + tangent.x * strength * 0.18;
      fy += away.y * strength + tangent.y * strength * 0.18;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
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
      const inbound = along > 0 ? 1.28 : 0.32;
      const directThreat = timeToClosest > 0 && timeToClosest < 22 && corridor < 70;
      const laneRisk = directThreat ? 1.9 : corridor < 90 ? 1.52 : corridor < 155 ? 0.94 : 0.42;
      const speedFactor = 1 + Math.min(1, Math.sqrt(velMagSq) * 0.08);
      const timeRisk = timeToClosest > 0 ? 1 / (1 + timeToClosest * 0.12) : 0.62;
      const w = (28000 / d2) * inbound * laneRisk * timeRisk * speedFactor;

      fx += (away.x * 0.34 + side.x * 1.06) * w;
      fy += (away.y * 0.34 + side.y * 1.06) * w;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private applyStuckRecovery(bot: IAITank, steering: Vector2, goal: Vector2, memory: Memory, desiredPoint: Vector2 | null): Vector2 {
    const needsMovement = desiredPoint ? Vector.distSq(bot.pos, desiredPoint) > TUNING.stuckNeedSq : Vector.magSq(goal) > 0.0001;
    const movedSq = Vector.distSq(bot.pos, memory.lastPos);

    if (needsMovement && movedSq < TUNING.stuckMoveSq) memory.stuckTicks++;
    else memory.stuckTicks = Math.max(0, memory.stuckTicks - 1);

    if (memory.stuckTicks < TUNING.stuckTicks && this.tick() > memory.detourUntil) return steering;

    if (memory.stuckTicks >= TUNING.stuckTicks) {
      memory.stuckTicks = 0;
      memory.orbitSign = memory.orbitSign === 1 ? -1 : 1;
      const toward = desiredPoint ? Vector.normalize(Vector.sub(desiredPoint, bot.pos)) : Vector.normalize(goal);
      const side = Vector.magSq(toward) > 0.0001 ? { x: -toward.y * memory.orbitSign, y: toward.x * memory.orbitSign } : this.idDirection(bot.id);
      memory.detourDir = Vector.normalize({ x: side.x * 0.88 + toward.x * 0.32, y: side.y * 0.88 + toward.y * 0.32 });
      memory.detourUntil = this.tick() + TUNING.detourTicks;
    }

    const detour = this.detourVector(memory);
    return this.movement.composeSteering([steering, detour], [0.72, 1.0], 1.45);
  }

  private hasCleanShot(bot: IAITank, target: TargetLike, tanks: TargetLike[]): boolean {
    const toTarget = Vector.sub(target.pos, bot.pos);
    const distSq = Vector.magSq(toTarget);
    if (distSq < 0.0001) return true;
    const dist = Math.sqrt(distSq);
    const dir = { x: toTarget.x / dist, y: toTarget.y / dist };

    for (let i = 0; i < tanks.length; i++) {
      const t = tanks[i];
      if (t.id === target.id || t.id === bot.id) continue;
      const rel = Vector.sub(t.pos, bot.pos);
      const forward = Vector.dot(rel, dir);
      if (forward <= 0 || forward >= dist) continue;
      const cross = Math.abs(rel.x * dir.y - rel.y * dir.x);
      if (cross < (t.radius ?? 20) + 18) return false;
    }

    return true;
  }

  private predict(bot: IAITank, target: TargetLike): Vector2 {
    const bulletSpeed = 5 + (bot.stats?.[StatType.BULLET_SPEED] ?? 0) * 0.8;
    const point = this.engine.getInterceptPoint(bot.pos, bulletSpeed, target.pos, target.vel || ZERO);
    if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) return point;
    return target.pos;
  }

  private faceMovement(bot: IAITank): void {
    if (Vector.magSq(bot.vel || ZERO) > 0.001) bot.aiTargetRot = Math.atan2(bot.vel.y, bot.vel.x);
  }

  private sideStepFrom(from: Vector2, to: Vector2, sign: 1 | -1): Vector2 {
    const dir = Vector.normalize(Vector.sub(to, from));
    return { x: -dir.y * sign, y: dir.x * sign };
  }

  private detourVector(memory: Memory): Vector2 {
    return this.tick() <= memory.detourUntil ? memory.detourDir : ZERO;
  }

  private safeSteering(memory: Memory, steering: Vector2, goal: Vector2): Vector2 {
    if (this.isFiniteVec(steering) && Vector.magSq(steering) > 0.00001) return Vector.limit(steering, TUNING.maxSteering);
    if (this.isFiniteVec(goal) && Vector.magSq(goal) > 0.00001) return Vector.limit(Vector.normalize(goal), TUNING.maxSteering);
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
      orbitFlipTick: 0,
      wanderAngle: (botId % 360) * (Math.PI / 180),
      lastPos: { x: Number.NaN, y: Number.NaN },
      stuckTicks: 0,
      detourUntil: 0,
      detourDir: ZERO,
    };
    fresh.lastPos = { x: 0, y: 0 };
    this.memory.set(botId, fresh);
    return fresh;
  }

  private safeQuery(bot: IAITank, radius: number): TargetLike[] {
    try {
      const result = this.engine.spatialGrid?.query?.(bot.pos, radius);
      if (Array.isArray(result)) return result as TargetLike[];
    } catch {
      // Fall back to a full entity scan.
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

  private getIdealRange(cls: TankClass): number {
    const name = String(cls).toUpperCase();
    if (name.includes('TRAPPER')) return 520;
    if (name.includes('SNIPER') || name.includes('ASSASSIN') || name.includes('RANGER')) return 610;
    if (name.includes('BOOSTER') || name.includes('FIGHTER') || name.includes('TRI_ANGLE') || name.includes('SPRAYER')) return 235;
    if (name.includes('NURSE') || name.includes('DOCTOR') || name.includes('PLAGUE')) return 470;
    if (name.includes('DESTROYER') || name.includes('ANNIHILATOR') || name.includes('HYBRID')) return 430;
    return 360;
  }

  private idDirection(id: number): Vector2 {
    const a = ((id * 137.508) % 360) * (Math.PI / 180);
    return { x: Math.cos(a), y: Math.sin(a) };
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
    const w = (this.engine as unknown as { width?: number }).width;
    return typeof w === 'number' && Number.isFinite(w) ? w : CANVAS_WIDTH;
  }

  private worldHeight(): number {
    const h = (this.engine as unknown as { height?: number }).height;
    return typeof h === 'number' && Number.isFinite(h) ? h : CANVAS_HEIGHT;
  }

  private isFiniteVec(v: Vector2): boolean {
    return Number.isFinite(v?.x) && Number.isFinite(v?.y);
  }
}
