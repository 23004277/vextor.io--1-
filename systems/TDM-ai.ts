import { AIState, DominionZoneState, StatType, TankClass, Team, Vector2 } from '../types';
import * as Vector from '../services/MathUtils';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAITank } from '../services/EnemyAITanks';

type TacticalState = AIState.COMBAT | AIState.FLEE | AIState.BASE_DEFENSE | AIState.HUNT | AIState.FARM;

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
  lastPos: Vector2;
  stuckTicks: number;
  detourUntil: number;
  detourPoint: Vector2 | null;
  lastThreatPos: Vector2 | null;
  lastThreatVel: Vector2;
  lastThreatTick: number;
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
  radius?: number;
  isExit?: boolean;
  phase?: string;
  type?: 'PLAYER' | 'ENEMY' | 'BULLET' | 'SHAPE' | 'BOSS' | 'CRASHER' | 'VOID_PORTAL';
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
  inVoid?: boolean;
  voidTimeRemaining?: number;
  safeZones: SafeZone[];
  dominionZones: DominionZoneState[];
};

const ZERO: Vector2 = { x: 0, y: 0 };

const DEFAULT_CONFIG: FrameConfig = {
  worldWidth: 6000,
  worldHeight: 4000,
  mapCenter: { x: 3000, y: 2000 },
  chokePoint: { x: 3000, y: 2000 },
  inVoid: false,
  voidTimeRemaining: 0,
  safeZones: [
    { team: Team.BLUE, center: { x: 500, y: 2000 }, radius: 1200 },
    { team: Team.RED, center: { x: 5500, y: 2000 }, radius: 1200 },
  ],
  dominionZones: [],
};

const TUNING = {
  maxSteering: 4.9,
  senseRadius: 1050,
  localCountRadius: 780,
  separationRadius: 270,
  hardSeparationRadius: 150,
  crowdSeparationRadius: 410,
  fleeHealthRatio: 0.3,
  criticalRetreatHealthRatio: 0.15,
  outnumberedMargin: 2,
  stateLatchMinTicks: 18,
  stateLatchMaxTicks: 30,
  targetLatchMinTicks: 18,
  targetLatchMaxTicks: 30,
  bulletAvoidRadius: 570,
  boundaryPadding: 260,
  boundaryLookAhead: 180,
  farmSenseRadius: 1850,
  combatRange: 365,
  combatRangeSniper: 635,
  combatRangeRusher: 235,
  shotObstructionRadius: 44,
  stuckDistanceSq: 10 * 10,
  stuckTargetDistanceSq: 115 * 115,
  maxStuckTicks: 7,
  detourTicks: 42,
  laneWeight: 0.36,
  targetOccupancyPenalty: 0.46,
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
      dominionZones: next.dominionZones ?? this.config.dominionZones,
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
    const danger = this.computeDangerPressure(bot, sensed.enemies, sensed.bullets);
    const local = this.countLocal(bot, sensed.allies, sensed.enemies, TUNING.localCountRadius);
    const shouldRetreat = hpRatio <= TUNING.criticalRetreatHealthRatio || (hpRatio <= TUNING.fleeHealthRatio && danger > 0.25) || local.enemy >= local.ally + TUNING.outnumberedMargin;

    const desiredTarget = shouldRetreat ? null : this.pickTarget(bot, sensed.enemies, sensed.allies, mem);
    const target = this.resolveTargetLock(mem, desiredTarget, sensed.enemies, bot.id);
    if (target) {
      mem.lastThreatPos = target.pos;
      mem.lastThreatVel = target.vel || ZERO;
      mem.lastThreatTick = this.tick;
    }

    const farmTarget = !target && !shouldRetreat ? this.pickFarmTarget(bot, sensed.farmTargets, sensed.allies) : null;
    const dominionObjective = !target && !farmTarget && !shouldRetreat ? this.pickDominionObjective(bot) : null;
    const exploreAnchor = !target && !farmTarget && !dominionObjective && !shouldRetreat
      ? this.chooseExploreAnchor(bot, sensed.allies, sensed.enemies, sensed.farmTargets, danger)
      : null;
    const state = this.applyStateLatch(mem, shouldRetreat ? AIState.FLEE : target ? AIState.COMBAT : farmTarget ? AIState.FARM : AIState.HUNT, bot.id);

    let goal = ZERO;
    let aimPoint: Vector2 | null = null;

    if (state === AIState.FLEE || shouldRetreat) {
      goal = this.computeRetreatGoal(bot, sensed.enemies, sensed.bullets, mem);
      bot.aiState = AIState.FLEE;
      bot.aiTargetId = target?.id ?? null;
      if (target) aimPoint = this.computeInterceptPoint(bot, target);
      bot.aiShooting = !!target && this.shouldTakeShot(bot, target, aimPoint ?? target.pos, sensed.allies, AIState.FLEE);
    } else if (state === AIState.COMBAT && target) {
      aimPoint = this.computeInterceptPoint(bot, target);
      goal = this.computeCombatGoal(bot, target, aimPoint, mem, sensed.allies, sensed.enemies, danger);
      bot.aiState = AIState.COMBAT;
      bot.aiTargetId = target.id;
      bot.aiShooting = this.shouldTakeShot(bot, target, aimPoint, sensed.allies, AIState.COMBAT);
    } else if (farmTarget) {
      aimPoint = this.computeInterceptPoint(bot, farmTarget);
      goal = this.computeFarmGoal(bot, farmTarget, sensed.allies);
      bot.aiState = AIState.FARM;
      bot.aiTargetId = farmTarget.id;
      bot.aiShooting = this.shouldTakeShot(bot, farmTarget, aimPoint, sensed.allies, AIState.FARM);
    } else if (dominionObjective) {
      goal = this.computeObjectiveGoal(bot, dominionObjective, mem);
      bot.aiState = AIState.HUNT;
      bot.aiTargetId = null;
      bot.aiShooting = false;
      aimPoint = dominionObjective.pos;
    } else if (exploreAnchor) {
      goal = this.computeExploreGoal(bot, exploreAnchor, mem);
      bot.aiState = AIState.HUNT;
      bot.aiTargetId = null;
      bot.aiShooting = false;
      aimPoint = exploreAnchor;
    } else {
      goal = this.computeDefenseGoal(bot, mem);
      bot.aiState = AIState.BASE_DEFENSE;
      bot.aiTargetId = null;
      bot.aiShooting = false;
    }

    if (aimPoint) this.setAim(bot, aimPoint, bot.aiState === AIState.COMBAT || bot.aiState === AIState.FARM);
    else if (Vector.magSq(bot.vel || ZERO) > 0.001) this.setAimAngle(bot, Math.atan2(bot.vel.y, bot.vel.x), false);

    const committedTargetId = bot.aiTargetId ?? farmTarget?.id ?? target?.id ?? null;
    const antiClump = this.computeCrowdRepulsion(bot, sensed.allies, sensed.enemies);
    const hostileRepel = this.computeHostileRepulsion(bot, sensed.enemies);
    const bulletAvoid = this.computeBulletAvoid(bot, sensed.bullets);
    const farmObstacleRepel = this.computeFarmObstacleRepel(bot, sensed.farmTargets, committedTargetId);
    const lane = this.movement.seekForce(bot.pos, this.getLaneAnchor(bot, mem, bot.aiState === AIState.FLEE ? 0.22 : 0.58));
    const bounds = this.movement.boundaryAvoidanceForce(bot.pos, bot.vel || ZERO, this.config.worldWidth, this.config.worldHeight, TUNING.boundaryPadding, TUNING.boundaryLookAhead);

    let steering = ZERO;
    steering = this.movement.blendSteering(steering, goal, bot.aiState === AIState.FLEE ? 1.5 : 1.12);
    steering = this.movement.blendSteering(steering, antiClump, 2.75);
    steering = this.movement.blendSteering(steering, hostileRepel, bot.aiState === AIState.COMBAT ? 0.82 : 0.58);
    steering = this.movement.blendSteering(steering, bulletAvoid, 1.45);
    steering = this.movement.blendSteering(steering, farmObstacleRepel, 0.76);
    steering = this.movement.blendSteering(steering, lane, TUNING.laneWeight);
    steering = this.movement.blendSteering(steering, bounds, 1.2);

    const desiredPoint = target?.pos ?? farmTarget?.pos ?? dominionObjective?.pos ?? exploreAnchor ?? null;
    steering = this.applyStuckRecovery(bot, steering, goal, mem, desiredPoint);
    steering = this.safeSteering(mem, steering, goal);

    (bot as unknown as { lastSteering?: Vector2 }).lastSteering = steering;
    mem.lastPos = { x: bot.pos.x, y: bot.pos.y };
  }

  private sense(bot: IAITank, players: Player[]): { allies: Player[]; enemies: Player[]; bullets: Player[]; farmTargets: Player[]; portals: Player[] } {
    const allies: Player[] = [];
    const enemies: Player[] = [];
    const bullets: Player[] = [];
    const farmTargets: Player[] = [];
    const portals: Player[] = [];
    const senseR2 = TUNING.senseRadius * TUNING.senseRadius;
    const farmR2 = TUNING.farmSenseRadius * TUNING.farmSenseRadius;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p || p.isDead || p.id === bot.id || !p.pos) continue;
      const d2 = Vector.distSq(bot.pos, p.pos);

      if (p.type === 'BULLET') {
        if (p.team !== bot.team && d2 <= TUNING.bulletAvoidRadius * TUNING.bulletAvoidRadius) bullets.push(p);
        continue;
      }

      if (p.type === 'VOID_PORTAL') {
        if (d2 <= senseR2) portals.push(p);
        continue;
      }

      if (p.type === 'SHAPE' || p.type === 'BOSS' || p.type === 'CRASHER') {
        if (d2 <= farmR2) farmTargets.push(p);
        continue;
      }

      if (d2 > senseR2) continue;
      if (p.team === bot.team) allies.push(p);
      else if (p.team !== Team.NONE) enemies.push(p);
    }

    return { allies, enemies, bullets, farmTargets, portals };
  }

  private pickTarget(bot: IAITank, enemies: Player[], allies: Player[], mem: Memory): Player | null {
    let best: Player | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const dist = Math.sqrt(d2);
      const hpRatio = Math.max(0, Math.min(1, (e.health ?? 100) / Math.max(1, e.maxHealth ?? 100)));
      const occupied = this.getSharedTargetOccupancy(bot, e.id, allies);
      const packPenalty = Math.max(0, occupied - 1) * TUNING.targetOccupancyPenalty;
      const routePenalty = this.getRouteDangerPenalty(bot.pos, e.pos, enemies, e.id);
      const memoryBonus = mem.targetId === e.id ? 0.16 : 0;

      let score = 1400 / (dist + 70);
      score += (1 - hpRatio) * 1.9;
      if (e.aiTargetId === bot.id) score += 0.75;
      else if (e.aiTargetId != null) score += 0.28;
      if (this.isSupportClass(e.classType)) score += 0.28;
      if (e.type === 'PLAYER') score += 0.22;
      if (e.type === 'BOSS') score += 0.9;
      if (e.type === 'CRASHER') score += 0.45;
      if (dist > 880) score *= 0.72;
      if (e.aiTargetId != null && e.aiTargetId !== bot.id) score *= 1.15;

      score += memoryBonus;
      score -= packPenalty;
      score -= routePenalty;

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

  private computeCombatGoal(bot: IAITank, target: Player, _aimPoint: Vector2, mem: Memory, allies: Player[], enemies: Player[], danger: number): Vector2 {
    if (this.tick >= mem.strafeFlipTick) {
      mem.strafeDir = mem.strafeDir === 1 ? -1 : 1;
      mem.strafeFlipTick = this.tick + 32 + (bot.id % 17);
    }

    const ideal = this.getDynamicIdealRange(bot, target, enemies, danger);
    const anchor = this.computeCombatAnchor(bot, target, allies, ideal, mem);
    const toTarget = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(toTarget)));
    const dir = Vector.normalize(toTarget);
    const strafe = { x: -dir.y * mem.strafeDir, y: dir.x * mem.strafeDir };
    const towardAnchor = this.movement.arriveForce(bot.pos, anchor, 330, 18);
    const away = this.movement.fleeForce(bot.pos, target.pos);

    if (dist < ideal * 0.72) return this.movement.composeSteering([away, strafe, towardAnchor], [1.1, 0.7, 0.34], 1.5);
    if (dist > ideal * 1.25) return this.movement.composeSteering([towardAnchor, strafe], [1.08, 0.56], 1.45);
    return this.movement.composeSteering([strafe, towardAnchor], [0.96, 0.52], 1.3);
  }

  private computeCombatAnchor(bot: IAITank, target: Player, allies: Player[], ideal: number, mem: Memory): Vector2 {
    const occupancy = this.getSharedTargetOccupancy(bot, target.id, allies);
    const span = Math.max(3, Math.min(9, occupancy + 3));
    const slotIndex = (bot.id % span) - Math.floor(span / 2);
    const baseAngle = Math.atan2(bot.pos.y - target.pos.y, bot.pos.x - target.pos.x);
    const slotAngle = baseAngle + slotIndex * 0.22 + mem.strafeDir * 0.13;
    const rangeJitter = ((bot.id % 7) - 3) * 14;

    return {
      x: this.clamp(target.pos.x + Math.cos(slotAngle) * (ideal + rangeJitter), 140, this.config.worldWidth - 140),
      y: this.clamp(target.pos.y + Math.sin(slotAngle) * (ideal + rangeJitter), 140, this.config.worldHeight - 140),
    };
  }

  private computeRetreatGoal(bot: IAITank, enemies: Player[], bullets: Player[], mem: Memory): Vector2 {
    const home = this.getSafeZoneCenter(bot.team);
    const homeForce = this.movement.arriveForce(bot.pos, home, 430, 22);
    const nearest = this.nearest(bot.pos, enemies);
    const away = nearest ? this.movement.fleeForce(bot.pos, nearest.pos) : ZERO;
    const bullet = this.computeBulletAvoid(bot, bullets);
    const detour = mem.detourPoint ? this.movement.arriveForce(bot.pos, mem.detourPoint, 280, 20) : ZERO;
    return this.movement.composeSteering([homeForce, away, bullet, detour], [1.18, 0.78, 0.7, 0.32], 1.5);
  }

  private computeFarmGoal(bot: IAITank, target: Player, allies: Player[]): Vector2 {
    const offset = this.farmSlotOffset(bot, target, allies);
    const anchor = {
      x: this.clamp(target.pos.x + offset.x, 120, this.config.worldWidth - 120),
      y: this.clamp(target.pos.y + offset.y, 120, this.config.worldHeight - 120),
    };
    return this.movement.arriveForce(bot.pos, anchor, 300, 18);
  }

  private computeObjectiveGoal(bot: IAITank, objective: { pos: Vector2 }, mem: Memory): Vector2 {
    const lane = this.getLaneAnchor(bot, mem, 0.62);
    return this.movement.composeSteering([
      this.movement.arriveForce(bot.pos, objective.pos, 360, 24),
      this.movement.seekForce(bot.pos, lane),
    ], [1.0, 0.28], 1.25);
  }

  private computeExploreGoal(bot: IAITank, anchor: Vector2, mem: Memory): Vector2 {
    const lane = this.getLaneAnchor(bot, mem, 0.56);
    return this.movement.composeSteering([
      this.movement.arriveForce(bot.pos, anchor, 360, 22),
      this.movement.seekForce(bot.pos, lane),
    ], [1.0, 0.22], 1.18);
  }

  private computeDefenseGoal(bot: IAITank, mem: Memory): Vector2 {
    const lane = this.getLaneAnchor(bot, mem, 0.38);
    const orbit = {
      x: lane.x + Math.cos(mem.wanderAngle) * 160,
      y: lane.y + Math.sin(mem.wanderAngle) * 160,
    };
    mem.wanderAngle += 0.085 + (bot.id % 5) * 0.003;
    return this.movement.arriveForce(bot.pos, {
      x: this.clamp(orbit.x, 140, this.config.worldWidth - 140),
      y: this.clamp(orbit.y, 140, this.config.worldHeight - 140),
    }, 330, 20);
  }

  private computeCrowdRepulsion(bot: IAITank, allies: Player[], enemies: Player[]): Vector2 {
    let fx = 0;
    let fy = 0;
    const crowdR2 = TUNING.crowdSeparationRadius * TUNING.crowdSeparationRadius;
    const all = allies.concat(enemies.filter((e) => Vector.distSq(bot.pos, e.pos) <= TUNING.hardSeparationRadius * TUNING.hardSeparationRadius));

    for (let i = 0; i < all.length; i++) {
      const other = all[i];
      const delta = Vector.sub(bot.pos, other.pos);
      const d2 = Math.max(1, Vector.magSq(delta));
      if (d2 > crowdR2) continue;

      const d = Math.sqrt(d2);
      const away = d > 0.001 ? { x: delta.x / d, y: delta.y / d } : this.idDirection(bot.id + other.id);
      const personal = (bot.radius ?? 20) + (other.radius ?? 20) + 36;
      const hard = d < personal || d < TUNING.hardSeparationRadius;
      const allyBoost = other.team === bot.team ? 1.36 : 0.72;
      const falloff = 1 - Math.min(1, d / TUNING.crowdSeparationRadius);
      const strength = (hard ? 2.65 + falloff * 2.0 : falloff * 0.95) * allyBoost;
      const tangentSign = bot.id % 2 === 0 ? 1 : -1;
      const tangent = { x: -away.y * tangentSign, y: away.x * tangentSign };

      fx += away.x * strength + tangent.x * strength * 0.22;
      fy += away.y * strength + tangent.y * strength * 0.22;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeHostileRepulsion(bot: IAITank, enemies: Player[]): Vector2 {
    let fx = 0;
    let fy = 0;
    const ideal = this.getIdealRange(bot.classType);
    const repelRadius = Math.max(360, ideal * 0.92);
    const r2 = repelRadius * repelRadius;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      if (d2 > r2) continue;
      const away = Vector.normalize(Vector.sub(bot.pos, e.pos));
      const w = (1 - Math.sqrt(d2) / repelRadius) * 1.15;
      fx += away.x * w;
      fy += away.y * w;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeFarmObstacleRepel(bot: IAITank, targets: Player[], committedTargetId: number | null): Vector2 {
    let fx = 0;
    let fy = 0;
    const r2 = 175 * 175;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (target.id === committedTargetId) continue;
      const d2 = Math.max(1, Vector.distSq(bot.pos, target.pos));
      if (d2 > r2) continue;
      const away = Vector.normalize(Vector.sub(bot.pos, target.pos));
      const w = 1 - Math.sqrt(d2) / 175;
      fx += away.x * w;
      fy += away.y * w;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
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
      const directThreat = timeToClosest > 0 && timeToClosest < 24 && corridor < 75;
      const laneRisk = directThreat ? 1.95 : corridor < 98 ? 1.52 : corridor < 170 ? 0.95 : 0.42;
      const w = (29000 / d2) * inbound * laneRisk;
      fx += (away.x * 0.34 + side.x * 1.05) * w;
      fy += (away.y * 0.34 + side.y * 1.05) * w;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private applyStuckRecovery(bot: IAITank, steering: Vector2, goal: Vector2, mem: Memory, desiredPoint: Vector2 | null): Vector2 {
    const distanceSq = desiredPoint ? Vector.distSq(bot.pos, desiredPoint) : Infinity;
    const needsMovement = desiredPoint ? distanceSq > TUNING.stuckTargetDistanceSq : Vector.magSq(goal) > 0.0001;
    const movedSq = Vector.distSq(bot.pos, mem.lastPos);

    if (needsMovement && movedSq < TUNING.stuckDistanceSq) mem.stuckTicks++;
    else mem.stuckTicks = Math.max(0, mem.stuckTicks - 1);

    if (mem.stuckTicks < TUNING.maxStuckTicks && this.tick > mem.detourUntil) return steering;

    if (mem.stuckTicks >= TUNING.maxStuckTicks) {
      mem.stuckTicks = 0;
      mem.strafeDir = mem.strafeDir === 1 ? -1 : 1;
      const toward = desiredPoint ? Vector.normalize(Vector.sub(desiredPoint, bot.pos)) : Vector.normalize(goal);
      const side = Vector.magSq(toward) > 0.0001 ? { x: -toward.y * mem.strafeDir, y: toward.x * mem.strafeDir } : this.idDirection(bot.id);
      const dir = Vector.normalize({ x: side.x * 0.88 + toward.x * 0.32, y: side.y * 0.88 + toward.y * 0.32 });
      mem.detourPoint = {
        x: this.clamp(bot.pos.x + dir.x * 310 + toward.x * 60, 140, this.config.worldWidth - 140),
        y: this.clamp(bot.pos.y + dir.y * 310 + toward.y * 60, 140, this.config.worldHeight - 140),
      };
      mem.detourUntil = this.tick + TUNING.detourTicks;
    }

    const detourForce = mem.detourPoint ? this.movement.arriveForce(bot.pos, mem.detourPoint, 280, 20) : ZERO;
    return this.movement.composeSteering([steering, detourForce], [0.72, 1.0], 1.45);
  }

  private shouldTakeShot(bot: IAITank, target: Player, aimPoint: Vector2, allies: Player[], state: AIState): boolean {
    if (!target || target.isDead) return false;
    if (state === AIState.FLEE && (bot.health / Math.max(1, bot.maxHealth)) > TUNING.criticalRetreatHealthRatio) return false;

    const toTarget = Vector.sub(aimPoint, bot.pos);
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
      if (cross < (ally.radius ?? 20) + TUNING.shotObstructionRadius) return false;
    }

    return true;
  }

  private pickFarmTarget(bot: IAITank, targets: Player[], allies: Player[]): Player | null {
    let best: Player | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (this.isShapeTargetCrowdedByAlly(bot, t, allies)) continue;
      const d2 = Math.max(1, Vector.distSq(bot.pos, t.pos));
      const xp = typeof t.xpValue === 'number' ? t.xpValue : t.type === 'BOSS' ? 1800 : t.type === 'CRASHER' ? 120 : 40;
      const hpRatio = (t.health ?? 100) / Math.max(1, t.maxHealth ?? 100);
      const distance = Math.sqrt(d2);
      const lowLevelBias = Math.max(0, 28 - ((bot as { level?: number }).level ?? 1)) / 28;
      const home = this.getSafeZoneCenter(bot.team);
      const farmLaneProgress = 1 - Math.min(1, Vector.dist(t.pos, home) / Math.max(1, Vector.dist(this.config.mapCenter, home)));
      const commonFarmBonus = t.type === 'SHAPE' && xp <= 140 ? 0.35 + lowLevelBias * 0.45 : 0;
      const legacyShapeBonus = this.getLegacyFarmShapeBonus(t);
      const rarityBonus = this.getLegacyFarmRarityBonus(t);
      const nearbyEnemyPenalty = this.getFarmEnemyPenalty(t);
      const woundedBonus = (1 - hpRatio) * 0.55;
      const score =
        ((xp * legacyShapeBonus * rarityBonus) * (1 + commonFarmBonus) * (0.72 + farmLaneProgress * 0.28) * nearbyEnemyPenalty) / Math.max(120, distance)
        + woundedBonus;
      if (score > bestScore) {
        best = t;
        bestScore = score;
      }
    }

    return best;
  }

  private getLegacyFarmShapeBonus(target: Player): number {
    if (target.type === 'BOSS') return 3.0;
    if (target.type === 'CRASHER') {
      const eliteCrasher = typeof target.shapeType === 'string' && target.shapeType.toUpperCase().includes('GRAND_SINGULARITY');
      return eliteCrasher ? 2.5 : 1.18;
    }

    switch ((target.shapeType || '').toUpperCase()) {
      case 'ALPHA_PENTAGON': return 2.2;
      case 'BETA_PENTAGON': return 1.9;
      case 'PENTAGON': return 1.45;
      case 'DODECAGON': return 3.3;
      case 'DECAGON': return 2.9;
      case 'NONAGON': return 2.55;
      case 'OCTAGON': return 2.25;
      case 'STAR': return 1.28;
      default: return 1.0;
    }
  }

  private getLegacyFarmRarityBonus(target: Player): number {
    const rarity = String(target.rarity || '').toUpperCase();
    if (!rarity) return 1.0;
    if (rarity === 'COMMON') return 1.0;
    if (rarity === 'UNCOMMON') return 1.05;
    if (rarity === 'RARE') return 1.12;
    if (rarity === 'EPIC') return 1.24;
    if (rarity === 'LEGENDARY') return 1.38;
    return 1.5;
  }

  private getFarmEnemyPenalty(target: Player): number {
    let nearestEnemyDist = Infinity;

    for (const entry of this.playersById.values()) {
      if (!entry || entry.isDead || entry.team === Team.NONE || entry.type === 'BULLET' || entry.type === 'SHAPE' || entry.type === 'BOSS' || entry.type === 'CRASHER' || entry.type === 'VOID_PORTAL') {
        continue;
      }
      const d = Vector.dist(entry.pos, target.pos);
      if (d < nearestEnemyDist) nearestEnemyDist = d;
    }

    if (nearestEnemyDist < 180) return 0.48;
    if (nearestEnemyDist < 260) return 0.62;
    return 1.0;
  }

  private chooseExploreAnchor(bot: IAITank, allies: Player[], enemies: Player[], farmTargets: Player[], danger: number): Vector2 {
    const safeMargin = 320;
    const inBounds = (pos: Vector2): Vector2 => ({
      x: this.clamp(pos.x, safeMargin, this.config.worldWidth - safeMargin),
      y: this.clamp(pos.y, safeMargin, this.config.worldHeight - safeMargin),
    });

    if (allies.length > 0) {
      const allyCenter = allies.reduce((sum, ally) => ({ x: sum.x + ally.pos.x, y: sum.y + ally.pos.y }), { x: 0, y: 0 });
      const allyAvg = { x: allyCenter.x / allies.length, y: allyCenter.y / allies.length };
      const enemyAvg = enemies.length > 0
        ? {
            x: enemies.reduce((sum, enemy) => sum + enemy.pos.x, 0) / enemies.length,
            y: enemies.reduce((sum, enemy) => sum + enemy.pos.y, 0) / enemies.length,
          }
        : this.config.mapCenter;
      if (danger < 1.25) {
        return inBounds({
          x: (allyAvg.x + enemyAvg.x) * 0.5 + (((bot.id * 73) % 360) - 180),
          y: (allyAvg.y + enemyAvg.y) * 0.5 + (((bot.id * 41) % 240) - 120),
        });
      }
    }

    if (farmTargets.length > 0) {
      let best = farmTargets[0];
      let bestValue = -Infinity;
      for (let i = 0; i < farmTargets.length; i++) {
        const target = farmTargets[i];
        const dist = Vector.dist(bot.pos, target.pos);
        let value = 1200 / (dist + 40);
        value += this.getLegacyFarmShapeBonus(target) * 42;
        value += this.getLegacyFarmRarityBonus(target) * 20;
        const nearestEnemyDist = enemies.reduce((min, enemy) => {
          const d = Vector.dist(enemy.pos, target.pos);
          return d < min ? d : min;
        }, Infinity);
        if (nearestEnemyDist < 260) value -= 120;
        if (value > bestValue) {
          bestValue = value;
          best = target;
        }
      }
      return inBounds({
        x: best.pos.x + (((bot.id * 29) % 320) - 160),
        y: best.pos.y + (((bot.id * 53) % 320) - 160),
      });
    }

    if (danger > 1.25) return inBounds(this.config.mapCenter);
    return inBounds({
      x: ((bot.id * 197) % Math.max(1, this.config.worldWidth - safeMargin * 2)) + safeMargin,
      y: ((bot.id * 131) % Math.max(1, this.config.worldHeight - safeMargin * 2)) + safeMargin,
    });
  }

  private isSupportClass(cls?: TankClass): boolean {
    const name = String(cls || '');
    return name.includes('PACIFIST') || name.includes('NURSE') || name.includes('DOCTOR') || name.includes('PLAGUE');
  }

  private pickDominionObjective(bot: IAITank): { pos: Vector2 } | null {
    const zones = this.config.dominionZones as unknown as Array<{ pos?: Vector2; center?: Vector2; owner?: Team; team?: Team; contested?: boolean }>;
    let best: { pos: Vector2 } | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const pos = zone.pos ?? zone.center;
      if (!pos) continue;
      const owner = zone.owner ?? zone.team ?? Team.NONE;
      if (owner === bot.team && !zone.contested) continue;
      const d2 = Vector.distSq(bot.pos, pos);
      if (d2 < bestScore) {
        bestScore = d2;
        best = { pos };
      }
    }

    return best;
  }

  private computeDangerPressure(bot: IAITank, enemies: Player[], bullets: Player[]): number {
    let pressure = 0;
    for (let i = 0; i < enemies.length; i++) {
      const d2 = Math.max(1, Vector.distSq(bot.pos, enemies[i].pos));
      pressure += 165000 / d2;
    }
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const rel = Vector.sub(bot.pos, b.pos);
      const d2 = Math.max(1, Vector.magSq(rel));
      const inbound = Vector.dot(rel, b.vel || ZERO) > 0 ? 1.25 : 0.3;
      pressure += (26000 / d2) * inbound;
    }
    return pressure;
  }

  private countLocal(bot: IAITank, allies: Player[], enemies: Player[], radius: number): { ally: number; enemy: number } {
    const r2 = radius * radius;
    let ally = 1;
    let enemy = 0;
    for (let i = 0; i < allies.length; i++) if (Vector.distSq(bot.pos, allies[i].pos) <= r2) ally++;
    for (let i = 0; i < enemies.length; i++) if (Vector.distSq(bot.pos, enemies[i].pos) <= r2) enemy++;
    return { ally, enemy };
  }

  private computeInterceptPoint(bot: IAITank, target: Player): Vector2 {
    const bulletSpeed = 5 + (bot.stats?.[StatType.BULLET_SPEED] ?? 0) * 0.8;
    const rel = Vector.sub(target.pos, bot.pos);
    const vel = target.vel || ZERO;
    const a = Vector.dot(vel, vel) - bulletSpeed * bulletSpeed;
    const b = 2 * Vector.dot(rel, vel);
    const c = Vector.dot(rel, rel);
    let t = 0;

    if (Math.abs(a) < 0.0001) {
      t = Math.abs(b) > 0.0001 ? -c / b : 0;
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const root = Math.sqrt(disc);
        const t1 = (-b - root) / (2 * a);
        const t2 = (-b + root) / (2 * a);
        t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
        if (!Number.isFinite(t)) t = Math.max(t1, t2, 0);
      }
    }

    t = this.clamp(t, 0, 55);
    return { x: target.pos.x + vel.x * t, y: target.pos.y + vel.y * t };
  }

  private setAim(bot: IAITank, point: Vector2, combat: boolean): void {
    this.setAimAngle(bot, Math.atan2(point.y - bot.pos.y, point.x - bot.pos.x), combat);
  }

  private setAimAngle(bot: IAITank, desired: number, combat: boolean): void {
    const current = Number.isFinite(bot.aiTargetRot) ? bot.aiTargetRot : bot.rotation ?? desired;
    let diff = desired - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = combat ? 0.24 : 0.14;
    bot.aiTargetRot = current + Math.sign(diff) * Math.min(Math.abs(diff), step);
  }

  private getDynamicIdealRange(bot: IAITank, target: Player, enemies: Player[], danger: number): number {
    let ideal = this.getIdealRange(bot.classType);
    const hpRatio = (target.health ?? 100) / Math.max(1, target.maxHealth ?? 100);
    if (hpRatio < 0.34) ideal *= 0.9;
    if (danger > 0.8 || enemies.length >= 3) ideal *= 1.08;
    return ideal;
  }

  private getIdealRange(cls: TankClass): number {
    const name = String(cls);
    if (name.includes('SNIPER') || name.includes('ASSASSIN') || name.includes('RANGER')) return TUNING.combatRangeSniper;
    if (name.includes('BOOSTER') || name.includes('FIGHTER') || name.includes('TRI_ANGLE') || name.includes('SPRAYER')) return TUNING.combatRangeRusher;
    if (name.includes('NURSE') || name.includes('DOCTOR') || name.includes('PLAGUE') || name.includes('PACIFIST')) return 475;
    if (name.includes('DESTROYER') || name.includes('ANNIHILATOR') || name.includes('HYBRID')) return 430;
    return TUNING.combatRange;
  }

  private farmSlotOffset(bot: IAITank, target: Player, allies: Player[]): Vector2 {
    const occupancy = this.getSharedTargetOccupancy(bot, target.id, allies);
    const span = Math.max(3, Math.min(8, occupancy + 2));
    const slot = (bot.id % span) - Math.floor(span / 2);
    const angle = ((bot.id * 137.5) % 360) * (Math.PI / 180) + slot * 0.24;
    const radius = (target.radius ?? 26) + 95 + Math.abs(slot) * 12;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  private getSafeZoneCenter(team: Team): Vector2 {
    const safeZone = this.config.safeZones.find((z) => z.team === team);
    if (safeZone) return safeZone.center;
    if (team === Team.BLUE) return { x: 520, y: this.config.worldHeight * 0.5 };
    if (team === Team.RED) return { x: this.config.worldWidth - 520, y: this.config.worldHeight * 0.5 };
    if (team === Team.GREEN) return { x: 520, y: this.config.worldHeight - 520 };
    if (team === Team.PURPLE) return { x: this.config.worldWidth - 520, y: this.config.worldHeight - 520 };
    return this.config.mapCenter;
  }

  private getLaneAnchor(bot: IAITank, mem: Memory, depth: number): Vector2 {
    const safeZone = this.config.safeZones.find((z) => z.team === bot.team);
    const w = this.config.worldWidth;
    const h = this.config.worldHeight;

    if (!safeZone) {
      return {
        x: this.clamp(w * depth + mem.laneBiasX, 160, w - 160),
        y: this.clamp(h * 0.5 + mem.laneOffsetY, 160, h - 160),
      };
    }

    const toCenter = Vector.sub(this.config.mapCenter, safeZone.center);
    const dir = Vector.magSq(toCenter) > 0.0001 ? Vector.normalize(toCenter) : { x: 1, y: 0 };
    const lateral = { x: -dir.y, y: dir.x };
    const advance = Math.max(safeZone.radius * 0.28, Vector.magSq(toCenter) ** 0.5 * depth);
    const anchor = Vector.add(safeZone.center, Vector.add(Vector.mult(dir, advance + mem.laneBiasX), Vector.mult(lateral, mem.laneOffsetY)));

    return {
      x: this.clamp(anchor.x, 160, w - 160),
      y: this.clamp(anchor.y, 160, h - 160),
    };
  }

  private isShapeTargetCrowdedByAlly(bot: IAITank, target: Player, allies: Player[]): boolean {
    let committed = 0;
    let close = 0;
    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      if (ally.id === bot.id) continue;
      const sameTarget = ally.aiTargetId === target.id;
      const nearTarget = Vector.distSq(ally.pos, target.pos) <= 155 * 155;
      if (sameTarget) committed++;
      if (nearTarget) close++;
    }
    const xp = typeof target.xpValue === 'number' ? target.xpValue : 40;
    const sizeAllowance = Math.max(0, Math.floor(((target.radius ?? 24) - 24) / 22));
    const maxFarmers =
      target.type === 'BOSS' ? 6 :
      target.type === 'CRASHER' ? 2 :
      xp >= 900 ? 5 :
      xp >= 300 ? 4 :
      xp >= 100 ? 3 :
      2;
    return committed + Math.max(0, close - committed) >= maxFarmers + sizeAllowance;
  }

  private getSharedTargetOccupancy(bot: IAITank, targetId: number, allies: Player[]): number {
    let count = 1;
    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      if (ally.id === bot.id) continue;
      if (ally.aiTargetId === targetId && Vector.distSq(ally.pos, bot.pos) <= 680 * 680) count++;
    }
    return count;
  }

  private getRouteDangerPenalty(from: Vector2, to: Vector2, enemies: Player[], ignoreId: number): number {
    let pressure = 0;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lenSq = Math.max(1, dx * dx + dy * dy);

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.id === ignoreId) continue;
      const ex = e.pos.x - from.x;
      const ey = e.pos.y - from.y;
      const t = this.clamp((ex * dx + ey * dy) / lenSq, 0, 1);
      const px = from.x + dx * t;
      const py = from.y + dy * t;
      const d2 = (e.pos.x - px) ** 2 + (e.pos.y - py) ** 2;
      if (d2 < 260 * 260) pressure += (1 - Math.sqrt(d2) / 260) * 0.38;
    }

    return pressure;
  }

  private safeSteering(mem: Memory, steering: Vector2, goal: Vector2): Vector2 {
    if (this.isFiniteVec(steering) && Vector.magSq(steering) > 0.00001) return Vector.limit(steering, TUNING.maxSteering);
    if (this.isFiniteVec(goal) && Vector.magSq(goal) > 0.00001) return Vector.limit(Vector.normalize(goal), TUNING.maxSteering);
    const fallback = { x: Math.cos(mem.wanderAngle), y: Math.sin(mem.wanderAngle) };
    mem.wanderAngle += 0.17;
    return Vector.limit(Vector.normalize(fallback), TUNING.maxSteering);
  }

  private nearest(pos: Vector2, list: Player[]): Player | null {
    let best: Player | null = null;
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

  private getMemory(botId: number): Memory {
    const existing = this.memory.get(botId);
    if (existing) return existing;
    const laneSlot = ((botId * 37) % 11) - 5;
    const created: Memory = {
      stateLatchUntil: 0,
      stateLock: AIState.HUNT,
      targetLockUntil: 0,
      targetId: null,
      strafeDir: botId % 2 === 0 ? 1 : -1,
      strafeFlipTick: 0,
      wanderAngle: (botId % 360) * (Math.PI / 180),
      laneOffsetY: laneSlot * 78,
      laneBiasX: (((botId * 19) % 7) - 3) * 34,
      lastPos: { x: 0, y: 0 },
      stuckTicks: 0,
      detourUntil: 0,
      detourPoint: null,
      lastThreatPos: null,
      lastThreatVel: ZERO,
      lastThreatTick: 0,
    };
    this.memory.set(botId, created);
    return created;
  }

  private randomLatch(seed: number, min: number, max: number): number {
    const n = this.seeded01((seed ^ (this.tick * 2654435761)) >>> 0);
    return min + Math.floor(n * (max - min + 1));
  }

  private seeded01(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private idDirection(id: number): Vector2 {
    const a = ((id * 137.508) % 360) * (Math.PI / 180);
    return { x: Math.cos(a), y: Math.sin(a) };
  }

  private isFiniteVec(v: Vector2): boolean {
    return Number.isFinite(v?.x) && Number.isFinite(v?.y);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
