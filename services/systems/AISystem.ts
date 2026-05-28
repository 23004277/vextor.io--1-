import { AIState, EntityType, GameMode, StatType, TankClass, Team, Vector2 } from '../../types';
import * as Vector from '../MathUtils';
import { MovementSystem } from './MovementSystem';

type TankLike = {
  id: number;
  pos: Vector2;
  vel: Vector2;
  rotation: number;
  health: number;
  maxHealth: number;
  team: Team;
  classType: TankClass;
  stats: Record<StatType, number>;
  visionRange: number;
  aiState: AIState;
  aiTargetId: number | null;
  aiHuntingSpecialId?: number | null;
  aiHuntingTimer?: number;
  aiTargetRot: number;
  aiShooting: boolean;
  lastSteering: Vector2;
  availableStatPoints: number;
  isDead: boolean;
};

type BotMemory = {
  wanderAngle: number;
  fleeLatchUntilTick: number;
  stuckTicks: number;
  lastPos: Vector2;
  lastState: AIState;
  lastTargetId: number | null;
};

type EngineLike = {
  entities: any[];
  gameMode: GameMode;
  inVoid: boolean;
  width?: number;
  height?: number;
  spatialGrid: { query: (pos: Vector2, radius: number) => any[] };
  getInterceptPoint: (pos: Vector2, speed: number, targetPos: Vector2, targetVel: Vector2) => Vector2;
  applyTankMovement: (tank: any, steering: Vector2) => void;
  attemptShoot: (tank: any) => void;
  upgradeStat: (tank: any, stat: StatType) => void;
};

export class AISystem {
  private movement = new MovementSystem();
  private tick = 0;
  public debugDecisionsThisTick = 0;
  private readonly baseSliceCount = 6;
  private readonly botMemory = new Map<number, BotMemory>();
  private readonly defaultWorldWidth = 6000;
  private readonly defaultWorldHeight = 4000;
  private readonly cachedAllies: Array<{ pos: Vector2 }> = [];
  private readonly fleeEnterHpRatio = 0.32;
  private readonly fleeExitHpRatio = 0.48;
  private readonly fleeLatchTicks = 26;
  private readonly stuckDistanceSq = 11 * 11;
  private readonly maxStuckTicks = 6;

  beginTick(simulationTick: number): void {
    this.tick = simulationTick;
    this.debugDecisionsThisTick = 0;
  }

  updateBot(bot: TankLike, engine: EngineLike, dt: number, botStatPriorities: Record<TankClass, StatType[]>): void {
    if (bot.isDead) return;

    // Cheap per-tick path: movement integration remains per fixed tick.
    engine.applyTankMovement(bot, bot.lastSteering);
    this.applyRotation(bot, dt);
    this.handleShooting(bot, engine);

    const activeBots = this.countActiveBots(engine);
    const dynamicSlices = Math.max(this.baseSliceCount, Math.min(12, Math.floor(activeBots / 8) + this.baseSliceCount));
    if ((bot.id % dynamicSlices) !== (this.tick % dynamicSlices)) return;
    this.debugDecisionsThisTick++;
    const memory = this.getMemory(bot);

    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const vision = bot.visionRange;
    const neighbors = engine.spatialGrid.query(bot.pos, vision);

    let target: any = null;
    let state = AIState.IDLE;

    // Hostile query with squared-distance scoring.
    const hostile = this.pickBestHostile(bot, neighbors, engine.gameMode);
    if (hostile) {
      const d2 = Vector.distSq(bot.pos, hostile.pos);
      if (hpRatio <= this.fleeEnterHpRatio && d2 < 560 * 560) {
        state = AIState.FLEE;
        memory.fleeLatchUntilTick = this.tick + this.fleeLatchTicks;
      } else if (
        memory.lastState === AIState.FLEE &&
        hpRatio < this.fleeExitHpRatio &&
        this.tick <= memory.fleeLatchUntilTick
      ) {
        state = AIState.FLEE;
      } else {
        state = AIState.COMBAT;
      }
      target = hostile;
    } else {
      const farm = this.pickBestShape(bot, neighbors);
      if (farm) {
        state = AIState.FARM;
        target = farm;
      }
    }

    const targetId = target ? target.id : null;
    if (!target && memory.lastTargetId !== null) {
      memory.stuckTicks++;
    }

    // If movement keeps failing while we think we're in combat, drop into a roam recovery.
    if (target && (state === AIState.COMBAT || state === AIState.FARM)) {
      const movedSq = Vector.distSq(bot.pos, memory.lastPos);
      const distanceSq = Vector.distSq(bot.pos, target.pos);
      const needsMovement = distanceSq > 95 * 95;
      if (needsMovement && movedSq < this.stuckDistanceSq) memory.stuckTicks++;
      else memory.stuckTicks = Math.max(0, memory.stuckTicks - 1);
      if (memory.stuckTicks >= this.maxStuckTicks) {
        target = null;
        state = AIState.IDLE;
        memory.stuckTicks = 0;
      }
    } else {
      memory.stuckTicks = Math.max(0, memory.stuckTicks - 1);
    }

    bot.aiState = state;
    bot.aiTargetId = target ? target.id : null;

    const steering = this.computeSteering(bot, target, neighbors, state, engine.gameMode, engine, memory);
    bot.lastSteering = Vector.limit(steering, 4.5);
    memory.lastPos = { x: bot.pos.x, y: bot.pos.y };
    memory.lastState = state;
    memory.lastTargetId = targetId;
    this.allocateStats(bot, engine, botStatPriorities);
  }

  private countActiveBots(engine: EngineLike): number {
    let c = 0;
    for (let i = 0; i < engine.entities.length; i++) {
      const e = engine.entities[i];
      if ((e.type === EntityType.ENEMY || e.type === EntityType.PLAYER) && !e.isDead) c++;
    }
    return c;
  }

  private pickBestHostile(bot: TankLike, neighbors: any[], mode: GameMode): any {
    let best: any = null;
    let bestScore = -Infinity;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!e || e.id === bot.id || e.isDead) continue;
      const isTankLike = e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK || e.type === EntityType.GUARDIAN;
      if (!isTankLike) continue;
      if (mode !== GameMode.FFA && e.team === bot.team) continue;
      const d2 = Vector.distSq(bot.pos, e.pos);
      if (d2 <= 0.0001) continue;
      const proximity = 1 / d2;
      const hpRatio = (e.health || 1) / Math.max(1, e.maxHealth || 1);
      const lowHpBonus = hpRatio < 0.5 ? (1 - hpRatio) * 0.6 : 0;
      const classThreat = this.classThreatScore(e.classType);
      const score = proximity * 900000 + lowHpBonus + classThreat;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private pickBestShape(bot: TankLike, neighbors: any[]): any {
    let best: any = null;
    let bestScore = -Infinity;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!e || e.isDead) continue;
      if (e.type !== EntityType.SHAPE && e.type !== EntityType.BOSS && e.type !== EntityType.CRASHER) continue;
      const d2 = Vector.distSq(bot.pos, e.pos);
      if (d2 <= 0.0001) continue;
      let score = 700000 / d2;
      if (e.type === EntityType.BOSS) score *= 2.6;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private computeSteering(
    bot: TankLike,
    target: any,
    neighbors: any[],
    state: AIState,
    mode: GameMode,
    engine: EngineLike,
    memory: BotMemory
  ): Vector2 {
    let goal = { x: 0, y: 0 };
    if (target) {
      if (state === AIState.FLEE) {
        goal = this.movement.fleeForce(bot.pos, target.pos);
      } else if (state === AIState.COMBAT || state === AIState.FARM) {
        const d2 = Vector.distSq(bot.pos, target.pos);
        const desiredMin = state === AIState.FARM ? 145 : 280;
        const desiredMax = state === AIState.FARM ? 300 : 520;
        if (d2 > desiredMax * desiredMax) {
          goal = this.movement.seekForce(bot.pos, target.pos);
        } else if (d2 < desiredMin * desiredMin) {
          goal = this.movement.fleeForce(bot.pos, target.pos);
        } else {
          // Within ideal range: orbit/strafe with deterministic phase to avoid stopping dead.
          const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
          const sideSign = (((this.tick + bot.id) & 1) === 0) ? 1 : -1;
          goal = { x: -toTarget.y * sideSign, y: toTarget.x * sideSign };
        }
      }
    } else {
      const jitter = Vector.seededRandom01((this.tick * 73856093) ^ (bot.id * 19349663));
      const wander = this.movement.wanderForce(bot.pos, bot.vel, memory.wanderAngle, 52, 36, jitter);
      memory.wanderAngle = wander.nextAngle;
      goal = wander.force;
    }

    this.cachedAllies.length = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!e || e.id === bot.id || e.isDead) continue;
      if ((e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && e.team === bot.team) {
        this.cachedAllies.push({ pos: e.pos });
      }
    }
    const sep = this.movement.separationForce(bot.pos, this.cachedAllies, mode === GameMode.FFA ? 95 : 130);
    const avoid = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel,
      engine.width || this.defaultWorldWidth,
      engine.height || this.defaultWorldHeight,
      220,
      120
    );

    return this.movement.composeSteeringWithPriority(avoid, sep, goal, 4.5);
  }

  private classThreatScore(cls: TankClass): number {
    if (cls === TankClass.COLOSSAL || cls === TankClass.LEVIATHAN || cls === TankClass.WARLORD || cls === TankClass.CELESTIAL) return 0.65;
    if (cls === TankClass.ANNIHILATOR || cls === TankClass.DESTROYER || cls === TankClass.HYBRID) return 0.45;
    if (cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR) return 0.4;
    return 0.2;
  }

  private applyRotation(bot: TankLike, dt: number): void {
    let diff = bot.aiTargetRot - bot.rotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.rotation += diff * Math.min(1, dt * 10.5);
  }

  private handleShooting(bot: TankLike, engine: EngineLike): void {
    if (!bot.aiShooting || bot.aiTargetId == null) return;
    const target = engine.entities.find(e => e.id === bot.aiTargetId && !e.isDead);
    if (!target) return;
    const bSpeed = BASE_BULLET_SPEED + bot.stats[StatType.BULLET_SPEED] * 0.8;
    const aimPos = engine.getInterceptPoint(bot.pos, bSpeed, target.pos, target.vel || { x: 0, y: 0 });
    bot.aiTargetRot = Math.atan2(aimPos.y - bot.pos.y, aimPos.x - bot.pos.x);
    let angleDiff = bot.aiTargetRot - bot.rotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (Math.abs(angleDiff) < 0.22) engine.attemptShoot(bot);
  }

  private allocateStats(bot: TankLike, engine: EngineLike, priorities: Record<TankClass, StatType[]>): void {
    if (bot.availableStatPoints <= 0) return;
    const prio = priorities[bot.classType] || priorities[TankClass.BASIC] || [];
    for (let i = 0; i < prio.length && bot.availableStatPoints > 0; i++) {
      const s = prio[i];
      if ((bot.stats[s] || 0) < 8) {
        engine.upgradeStat(bot, s);
      }
    }
  }

  private getMemory(bot: TankLike): BotMemory {
    let memory = this.botMemory.get(bot.id);
    if (memory) return memory;
    memory = {
      wanderAngle: Vector.seededRandom01(bot.id * 92821) * Math.PI * 2,
      fleeLatchUntilTick: 0,
      stuckTicks: 0,
      lastPos: { x: bot.pos.x, y: bot.pos.y },
      lastState: AIState.IDLE,
      lastTargetId: null,
    };
    this.botMemory.set(bot.id, memory);
    return memory;
  }
}

const BASE_BULLET_SPEED = 5;
