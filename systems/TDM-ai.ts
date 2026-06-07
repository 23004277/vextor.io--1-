import { AIState, DominionZoneState, GameMode, StatType, TankClass, Team, Vector2 } from '../types';
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
  lastPos: Vector2;
  stuckTicks: number;
  lastThreatPos: Vector2 | null;
  lastThreatVel: Vector2;
  lastThreatTick: number;
  investigateUntil: number;
  cautionUntil: number;
  detourUntil: number;
  detourPoint: Vector2 | null;
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
  maxSteering: 4.5,
  senseRadius: 980,
  localCountRadius: 760,
  separationRadius: 185,
  crowdSeparationRadius: 280,
  cohesionRadius: 620,
  fleeHealthRatio: 0.35,
  criticalRetreatHealthRatio: 0.14,
  outnumberedMargin: 2,
  stateLatchMinTicks: 20,
  stateLatchMaxTicks: 30,
  targetLatchMinTicks: 20,
  targetLatchMaxTicks: 30,
  bulletAvoidRadius: 420,
  dangerFleePressure: 1.25,
  cautionPressure: 0.76,
  finisherTargetHpRatio: 0.34,
  pressureTargetBonus: 0.24,
  farmSenseRadius: 860,
  boundaryPadding: 260,
  boundaryLookAhead: 180,
  investigateTicks: 44,
  stuckDistanceSq: 10 * 10,
  stuckTargetDistanceSq: 120 * 120,
  maxStuckTicks: 6,
  routeProbeRadius: 250,
  routeCorridorRadius: 220,
  detourTicks: 34,
  aimLaneAvoidRadius: 660,
  woundedRangeBoost: 0.16,
  combatRange: 360,
  combatRangeSniper: 620,
  combatRangeRusher: 220,
  laneWeight: 0.68,
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
    const target = this.resolveTargetLock(mem, desiredTarget, sensed.enemies, bot.id);
    this.updateThreatMemory(mem, target);
    const investigatePoint = !target && !shouldRetreat ? this.getInvestigatePoint(mem) : null;
    const dominionObjective = !target && !investigatePoint && !shouldRetreat ? this.pickDominionObjective(bot, mem) : null;
    const portalObjective = !target && !investigatePoint && !dominionObjective && !shouldRetreat ? this.pickPortalObjective(bot, sensed.portals, hpRatio, dangerPressure) : null;
    const farmTarget = !target && !investigatePoint && !dominionObjective && !portalObjective && !shouldRetreat ? this.pickFarmTarget(bot, sensed.farmTargets, sensed.enemies) : null;
    const combatCaution = this.getCombatCaution(mem, dangerPressure, sensed.allyCount, sensed.enemyCount, sensed.bullets.length);
    const desiredState: TacticalState = shouldRetreat ? AIState.FLEE : desiredTarget ? AIState.COMBAT : AIState.HUNT;
    const state = this.applyStateLatch(mem, desiredState, bot.id);

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
      goal = this.computeCombatGoal(bot, target, aim, mem, sensed.enemies, combatCaution);
      bot.aiState = AIState.COMBAT;
      bot.aiTargetId = target.id;
      bot.aiShooting = this.shouldTakeShot(bot, target, aim, sensed.allies, AIState.COMBAT);
      this.setSmoothedAimRotation(bot, this.angleTo(bot.pos, aim), true);
    } else if (investigatePoint) {
      goal = this.computeInvestigateGoal(bot, investigatePoint, mem);
      bot.aiState = AIState.HUNT;
      bot.aiTargetId = mem.targetId;
      bot.aiShooting = false;
      this.setSmoothedAimRotation(bot, this.angleTo(bot.pos, investigatePoint), false);
    } else if (dominionObjective) {
      goal = this.computeDominionObjectiveGoal(bot, dominionObjective, mem);
      bot.aiState = AIState.HUNT;
      bot.aiTargetId = null;
      bot.aiShooting = false;
      this.setSmoothedAimRotation(bot, this.angleTo(bot.pos, dominionObjective.pos), false);
    } else {
      if (portalObjective) {
        goal = this.computePortalObjectiveGoal(bot, portalObjective);
        bot.aiState = AIState.PROXIMAL_PORTAL_TRANSIT;
        bot.aiTargetId = portalObjective.id;
        bot.aiShooting = false;
        this.setSmoothedAimRotation(bot, this.angleTo(bot.pos, portalObjective.pos), false);
      } else if (farmTarget) {
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
    const aimLaneAvoid = this.computeEnemyAimLaneAvoidance(bot, sensed.enemies);
    const cautionForce = this.computeCautionForce(bot, target, sensed.enemies, sensed.bullets, combatCaution);
    const laneForce = this.movement.seekForce(bot.pos, this.getLaneAnchor(bot, mem, state === AIState.FLEE ? 0.3 : 0.58));
    const bounds = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel,
      this.config.worldWidth,
      this.config.worldHeight,
      TUNING.boundaryPadding,
      TUNING.boundaryLookAhead
    );
    const desiredPoint = target?.pos ?? investigatePoint ?? dominionObjective?.pos ?? portalObjective?.pos ?? farmTarget?.pos ?? null;
    const routeAvoid = this.computeRouteCorridorAvoidance(
      bot,
      desiredPoint,
      sensed.enemies,
      sensed.farmTargets,
      target?.id ?? committedFarmTargetId
    );
    const detourForce = this.computeDetourForce(bot, mem);

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
    steering = this.movement.blendSteering(steering, hostileRepel, state === AIState.COMBAT ? 0.54 : 0.36);
    steering = this.movement.blendSteering(steering, farmRepel, state === AIState.COMBAT || state === AIState.FLEE ? 1.28 : 0.92);
    steering = this.movement.blendSteering(steering, aimLaneAvoid, 0.95);
    steering = this.movement.blendSteering(steering, routeAvoid, state === AIState.COMBAT ? 0.88 : 0.64);
    steering = this.movement.blendSteering(steering, detourForce, 1.05);
    steering = this.movement.blendSteering(steering, align, boids.alignment);
    steering = this.movement.blendSteering(steering, coh, boids.cohesion);
    steering = this.movement.blendSteering(steering, laneForce, TUNING.laneWeight);
    steering = this.movement.blendSteering(steering, bulletAvoid, 1.2);
    steering = this.movement.blendSteering(
      steering,
      cautionForce,
      shouldRetreat ? 0.25 : state === AIState.COMBAT ? 0.82 : (investigatePoint || dominionObjective) ? 0.54 : 0.3
    );
    steering = this.movement.blendSteering(steering, bounds, 1.3);

    if (shouldRetreat) {
      steering = this.movement.blendSteering(
        steering,
        this.movement.seekForce(bot.pos, this.getSafeZoneCenter(bot.team)),
        1.4
      );
    }

    const recovered = this.applyStuckRecovery(bot, steering, goal, mem, desiredPoint);
    bot.lastSteering = Vector.limit(this.ensureValidSteering(recovered, goal, bot, mem), TUNING.maxSteering);
    mem.lastPos = { x: bot.pos.x, y: bot.pos.y };
  }

  private sense(bot: IAITank, players: Player[]): { allies: IAITank[]; enemies: Player[]; bullets: Player[]; farmTargets: Player[]; portals: Player[]; allyCount: number; enemyCount: number } {
    const allies: IAITank[] = [];
    const enemies: Player[] = [];
    const bullets: Player[] = [];
    const farmTargets: Player[] = [];
    const portals: Player[] = [];
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
      if (p.type === 'VOID_PORTAL') {
        portals.push(p);
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

    return { allies, enemies, bullets, farmTargets, portals, allyCount, enemyCount };
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
      const distance = Math.sqrt(d2);
      const hpRatio = (e.health ?? 100) / Math.max(1, e.maxHealth ?? 100);
      const lowHp = hpRatio < 0.55 ? (1 - hpRatio) * 0.9 : 0;
      const focus = e.aiTargetId === bot.id ? 0.4 : 0;
      const allyUnderFire = e.aiTargetId != null && allies.some((a) => a.id === e.aiTargetId) ? 0.34 : 0;
      const finisherWindow = hpRatio <= TUNING.finisherTargetHpRatio ? 0.36 : 0;
      const pressureTarget = e.aiTargetId === bot.id ? TUNING.pressureTargetBonus : e.aiTargetId != null ? TUNING.pressureTargetBonus * 0.55 : 0;
      const focusPenalty = this.getAllyFocusPenalty(e.id, allies);
      const laneAffinity = this.getLaneAffinity(bot, mem, e.pos);
      const supportWindow = this.countFriendlyPressureAt(e.pos, allies, 310);
      const coverWindow = this.countEnemyPressureAt(e.id, e.pos, enemies, 310);
      const interceptPenalty = this.getInterceptDifficulty(bot, e);
      const overextendPenalty = this.getEnemySafeZonePenalty(bot.team, e.pos);
      const routePenalty = this.getRouteDangerPenalty(bot.pos, e.pos, enemies, e.id);
      const shotLanePenalty = this.getTargetShotLanePenalty(bot, e, allies);
      const collapsePenalty = Math.max(0, coverWindow - supportWindow) * 0.72;
      const isolationBonus = Math.max(0, 0.42 - coverWindow * 0.2);
      const reachableBonus = Math.max(0, 0.3 - interceptPenalty * 0.5);
      const ideal = this.getIdealRange(bot.classType);
      const rangeFitBonus = Math.max(0, 0.28 - Math.abs(distance - ideal) / Math.max(ideal, 1) * 0.16);
      const routeClarityBonus = Math.max(0, 0.2 - routePenalty * 0.24);
      const stickiness = mem.targetId === e.id ? 0.42 : 0;
      const score =
        900000 / d2 +
        lowHp +
        focus +
        allyUnderFire +
        finisherWindow +
        pressureTarget +
        laneAffinity +
        supportWindow +
        isolationBonus +
        reachableBonus +
        rangeFitBonus +
        routeClarityBonus +
        stickiness -
        coverWindow -
        collapsePenalty -
        overextendPenalty -
        routePenalty -
        shotLanePenalty -
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

  private computeCombatGoal(bot: IAITank, target: Player, aimPoint: Vector2, mem: Memory, enemies: Player[], caution: number): Vector2 {
    const toTarget = Vector.sub(target.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(toTarget)));
    const dir = Vector.normalize(toTarget);
    const pressure = this.clamp(caution, 0, 1.2);

    if (this.tick >= mem.strafeFlipTick) {
      mem.strafeDir = mem.strafeDir === 1 ? -1 : 1;
      mem.strafeFlipTick = this.tick + 24 + (bot.id % 13);
    }

    const strafe = { x: -dir.y * mem.strafeDir, y: dir.x * mem.strafeDir };
    const anchor = this.computeCombatAnchor(bot, target, aimPoint, mem, enemies, pressure);
    const toward = this.movement.arriveForce(bot.pos, anchor, 320, 18);
    const away = this.movement.fleeForce(bot.pos, target.pos);
    const ideal = this.getDynamicIdealRange(bot, target, enemies, pressure);
    const sidestep = this.computeLocalSidestep(bot, enemies, target);
    const pressureLane = this.movement.seekForce(bot.pos, this.getLaneAnchor(bot, mem, 0.52));

    if (dist < ideal * (0.78 + pressure * 0.06)) {
      return this.movement.composeSteering([away, strafe, sidestep, pressureLane], [1.0 + pressure * 0.22, 0.7 + pressure * 0.12, 0.4 + pressure * 0.18, pressure * 0.22], 1.45);
    }
    if (dist > ideal * (1.22 + Math.max(0, 0.12 - pressure * 0.04))) {
      return this.movement.composeSteering([toward, strafe, sidestep, pressureLane], [1.02, 0.58 + pressure * 0.08, 0.34 + pressure * 0.16, pressure * 0.18], 1.45);
    }
    return this.movement.composeSteering([strafe, toward, sidestep, pressureLane], [0.92 + pressure * 0.1, 0.44, 0.28 + pressure * 0.16, pressure * 0.2], 1.25);
  }

  private computeInvestigateGoal(bot: IAITank, point: Vector2, mem: Memory): Vector2 {
    const laneHold = this.getLaneAnchor(bot, mem, 0.6);
    const goal = this.movement.arriveForce(bot.pos, point, 260, 20);
    const laneBias = this.movement.seekForce(bot.pos, laneHold);
    return this.movement.composeSteering([goal, laneBias], [1.0, 0.24], 1.2);
  }

  private computeDominionObjectiveGoal(bot: IAITank, zone: DominionZoneState, mem: Memory): Vector2 {
    const toCenter = Vector.sub(zone.pos, bot.pos);
    const dir = Vector.magSq(toCenter) > 0.0001 ? Vector.normalize(toCenter) : Vector.normalize(Vector.sub(zone.pos, this.getSafeZoneCenter(bot.team)));
    const lateral = { x: -dir.y, y: dir.x };
    const offsetMag = Math.min(zone.radius * 0.42, 140);
    const owned = zone.owner === bot.team;
    const holdRadius = owned ? Math.max(80, zone.radius * 0.35) : Math.max(48, zone.radius * 0.16);
    const anchor = {
      x: zone.pos.x - dir.x * holdRadius + lateral.x * mem.strafeDir * offsetMag,
      y: zone.pos.y - dir.y * holdRadius + lateral.y * mem.strafeDir * offsetMag,
    };
    const anchorGoal = this.movement.arriveForce(bot.pos, anchor, 260, 20);
    const laneBias = this.movement.seekForce(bot.pos, this.getLaneAnchor(bot, mem, 0.56));
    return this.movement.composeSteering([anchorGoal, laneBias], [1.0, owned ? 0.14 : 0.24], 1.24);
  }

  private computePortalObjectiveGoal(bot: IAITank, portal: Player): Vector2 {
    const toPortal = Vector.sub(portal.pos, bot.pos);
    const dist = Math.max(1, Math.sqrt(Vector.magSq(toPortal)));
    const dir = Vector.normalize(toPortal);
    const radius = Math.max(36, portal.radius ?? 80);
    const hold = portal.isExit ? radius * 0.34 : radius * 0.28;
    const anchor = {
      x: portal.pos.x - dir.x * hold,
      y: portal.pos.y - dir.y * hold,
    };
    return dist > hold * 1.2
      ? this.movement.arriveForce(bot.pos, anchor, 260, 14)
      : this.movement.arriveForce(bot.pos, portal.pos, 200, 8);
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
    const orbitSign = (bot.id & 1) === 0 ? 1 : -1;
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
      x: target.pos.x - dir.x * holdRange - dir.y * orbitSign * Math.min(70, shapeRadius + 24),
      y: target.pos.y - dir.y * holdRange + dir.x * orbitSign * Math.min(70, shapeRadius + 24)
    };
    return this.movement.arriveForce(bot.pos, anchor, 250, 24);
  }

  private pickFarmTarget(bot: IAITank, farmTargets: Player[], enemies: Player[]): Player | null {
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
      const contestPenalty = 1 + this.getFarmContestPressure(f, enemies, farmTargets);
      const score = ((xp * rarityBoost) / Math.sqrt(d2)) * antiOverlap * bodyRiskPenalty / contestPenalty;
      if (score > bestScore) {
        best = f;
        bestScore = score;
      }
    }
    return best;
  }

  private pickPortalObjective(bot: IAITank, portals: Player[], hpRatio: number, dangerPressure: number): Player | null {
    if (portals.length === 0) return null;
    const shouldSeekExit = !!this.config.inVoid && (hpRatio < 0.36 || dangerPressure > 0.9 || (this.config.voidTimeRemaining || 0) < 55);
    const shouldSeekEntry = !this.config.inVoid && hpRatio > 0.42 && dangerPressure < 0.72;
    if (!shouldSeekExit && !shouldSeekEntry) return null;

    let best: Player | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < portals.length; i++) {
      const portal = portals[i];
      const isExit = !!portal.isExit;
      if (this.config.inVoid ? !isExit : isExit) continue;
      const d2 = Math.max(1, Vector.distSq(bot.pos, portal.pos));
      const phase = typeof portal.phase === 'string' ? portal.phase : 'BLACK_HOLE';
      const phaseBias = isExit ? 1.35 : phase === 'EXPANDING' ? 1.2 : phase === 'WHITE_HOLE' ? 1.0 : 0.42;
      const urgencyBias = this.config.inVoid ? 1.45 + Math.max(0, (55 - (this.config.voidTimeRemaining || 0)) * 0.02) : 1.0;
      const score = (phaseBias * urgencyBias * 1000000) / d2;
      if (score > bestScore) {
        best = portal;
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

  private computeRouteCorridorAvoidance(
    bot: IAITank,
    desiredPoint: Vector2 | null,
    enemies: Player[],
    farmTargets: Player[],
    ignoredEntityId: number | null
  ): Vector2 {
    if (!desiredPoint) return ZERO;
    if (Vector.distSq(bot.pos, desiredPoint) < 130 * 130) return ZERO;

    let fx = 0;
    let fy = 0;
    const addHazard = (hazard: Player, weightMult: number): void => {
      if (hazard.id === ignoredEntityId) return;
      const projection = this.projectPointToSegment(hazard.pos, bot.pos, desiredPoint);
      if (projection.t < 0.08 || projection.t > 0.94) return;
      const corridor = TUNING.routeCorridorRadius + (hazard.radius ?? 28);
      const distance = Math.sqrt(Math.max(1, projection.distanceSq));
      if (distance > corridor) return;

      const closeness = 1 - Math.min(1, distance / corridor);
      const away = Vector.normalize(Vector.sub(bot.pos, hazard.pos));
      const routeDir = Vector.normalize(Vector.sub(desiredPoint, bot.pos));
      const sideSign = bot.id % 2 === 0 ? 1 : -1;
      const side = Vector.magSq(away) > 0.0001
        ? away
        : { x: -routeDir.y * sideSign, y: routeDir.x * sideSign };
      const aheadWeight = 0.75 + projection.t * 0.45;
      const weight = closeness * closeness * aheadWeight * weightMult;
      fx += side.x * weight;
      fy += side.y * weight;
    };

    for (let i = 0; i < enemies.length; i++) {
      addHazard(enemies[i], enemies[i].aiTargetId === bot.id ? 1.55 : 1.08);
    }
    for (let i = 0; i < farmTargets.length; i++) {
      const target = farmTargets[i];
      const typeWeight = target.type === 'CRASHER' ? 2.15 : target.type === 'BOSS' ? 1.65 : 0.88;
      addHazard(target, typeWeight);
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.limit(Vector.normalize({ x: fx, y: fy }), 1.25);
  }

  private computeDetourForce(bot: IAITank, mem: Memory): Vector2 {
    if (!mem.detourPoint) return ZERO;
    if (this.tick > mem.detourUntil || Vector.distSq(bot.pos, mem.detourPoint) < 72 * 72) {
      mem.detourPoint = null;
      mem.detourUntil = 0;
      return ZERO;
    }
    return this.movement.arriveForce(bot.pos, mem.detourPoint, 250, 22);
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
      const vel = b.vel ?? ZERO;
      const velMagSq = Vector.magSq(vel);
      if (velMagSq <= 0.0001) continue;
      const velDir = Vector.normalize(vel);
      const away = Vector.normalize(rel);
      const along = Vector.dot(rel, velDir);
      const timeToClosest = Vector.dot(rel, vel) / velMagSq;
      if (timeToClosest <= 0) continue;
      const closest = {
        x: b.pos.x + vel.x * timeToClosest,
        y: b.pos.y + vel.y * timeToClosest,
      };
      const missDistance = Math.sqrt(Math.max(1, Vector.distSq(bot.pos, closest)));
      const cross = velDir.x * rel.y - velDir.y * rel.x;
      const side = {
        x: -velDir.y * (cross >= 0 ? 1 : -1),
        y: velDir.x * (cross >= 0 ? 1 : -1)
      };
      const corridor = Math.min(Math.abs(cross), missDistance);
      const inbound = along > 0 ? 1.22 : 0.26;
      const laneRisk = corridor < 84 ? 1.35 : corridor < 150 ? 0.86 : 0.36;
      const timeRisk = 1 / (1 + timeToClosest * 0.075);
      const w = (22000 / d2) * inbound * laneRisk * timeRisk;
      fx += (away.x * 0.48 + side.x * 0.92) * w;
      fy += (away.y * 0.48 + side.y * 0.92) * w;
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

  private computeEnemyAimLaneAvoidance(bot: IAITank, enemies: Player[]): Vector2 {
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i] as Player & { rotation?: number };
      const d2 = Vector.distSq(bot.pos, enemy.pos);
      if (d2 > TUNING.aimLaneAvoidRadius * TUNING.aimLaneAvoidRadius) continue;

      const aimDir = typeof enemy.rotation === 'number'
        ? Vector.fromAngle(enemy.rotation)
        : Vector.normalize(enemy.vel || Vector.sub(bot.pos, enemy.pos));
      if (Vector.magSq(aimDir) <= 0.0001) continue;

      const rel = Vector.sub(bot.pos, enemy.pos);
      const along = Vector.dot(rel, aimDir);
      if (along < -30 || along > TUNING.aimLaneAvoidRadius) continue;
      const closest = {
        x: enemy.pos.x + aimDir.x * along,
        y: enemy.pos.y + aimDir.y * along,
      };
      const missDistance = Math.sqrt(Math.max(1, Vector.distSq(bot.pos, closest)));
      const laneWidth = this.getBotRadius(bot) + 64;
      if (missDistance > laneWidth) continue;

      const laneUrgency = 1 - Math.min(1, missDistance / laneWidth);
      const sideSign = (aimDir.x * rel.y - aimDir.y * rel.x) >= 0 ? 1 : -1;
      const side = { x: -aimDir.y * sideSign, y: aimDir.x * sideSign };
      const forwardDanger = 1 - Math.min(1, Math.max(0, along) / TUNING.aimLaneAvoidRadius);
      const targetedBonus = enemy.aiTargetId === bot.id ? 1.25 : 1;
      const weight = laneUrgency * laneUrgency * (0.5 + forwardDanger * 0.78) * targetedBonus;
      fx += side.x * weight;
      fy += side.y * weight;
    }

    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.limit(Vector.normalize({ x: fx, y: fy }), 1.16);
  }

  private computeCombatAnchor(bot: IAITank, target: Player, aimPoint: Vector2, mem: Memory, enemies: Player[], caution: number): Vector2 {
    const ideal = this.getDynamicIdealRange(bot, target, enemies, caution);
    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
    const side = { x: -toTarget.y * mem.strafeDir, y: toTarget.x * mem.strafeDir };
    const targetVelocity = target.vel || ZERO;
    const targetDrift = Vector.magSq(targetVelocity) > 0.01 ? Vector.limit(targetVelocity, 3.1) : ZERO;
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
    const flankBase = this.isSupport(bot.classType) ? TUNING.flankOffset * 1.1 : this.isRusher(bot.classType) ? TUNING.flankOffset * 0.72 : TUNING.flankOffset;
    const flank = flankBase * (1 + caution * 0.34);
    const pullback = ideal * (0.76 + caution * 0.18);
    return {
      x: aimPoint.x + targetDrift.x * 14 - toTarget.x * pullback + side.x * flank + coverBias.x * (55 + caution * 22),
      y: aimPoint.y + targetDrift.y * 14 - toTarget.y * pullback + side.y * flank + coverBias.y * (55 + caution * 22),
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

  private updateThreatMemory(mem: Memory, target: Player | null): void {
    if (!target) return;
    mem.lastThreatPos = { x: target.pos.x, y: target.pos.y };
    mem.lastThreatVel = target.vel ? { x: target.vel.x, y: target.vel.y } : ZERO;
    mem.lastThreatTick = this.tick;
    mem.investigateUntil = this.tick + TUNING.investigateTicks;
  }

  private getInvestigatePoint(mem: Memory): Vector2 | null {
    if (!mem.lastThreatPos || this.tick > mem.investigateUntil) return null;
    const driftTicks = Math.max(0, Math.min(18, this.tick - mem.lastThreatTick));
    return {
      x: this.clamp(mem.lastThreatPos.x + mem.lastThreatVel.x * driftTicks * 0.7, 140, this.config.worldWidth - 140),
      y: this.clamp(mem.lastThreatPos.y + mem.lastThreatVel.y * driftTicks * 0.7, 140, this.config.worldHeight - 140),
    };
  }

  private getCombatCaution(mem: Memory, dangerPressure: number, allyCount: number, enemyCount: number, bulletCount: number): number {
    const enemyAdvantage = Math.max(0, enemyCount - allyCount);
    const bulletPressure = Math.max(0, bulletCount - 1) * 0.12;
    let caution =
      Math.max(0, (dangerPressure - TUNING.cautionPressure) * 0.8) +
      enemyAdvantage * 0.22 +
      bulletPressure;

    if (caution > 0.08) {
      mem.cautionUntil = this.tick + 18;
    } else if (this.tick <= mem.cautionUntil) {
      caution = Math.max(caution, 0.28);
    }

    return this.clamp(caution, 0, 1.2);
  }

  private computeCautionForce(bot: IAITank, target: Player | null, enemies: Player[], bullets: Player[], caution: number): Vector2 {
    if (caution <= 0.02) return ZERO;
    let hotspotX = 0;
    let hotspotY = 0;
    let weightSum = 0;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, enemy.pos));
      const weight = 1 / Math.sqrt(d2);
      hotspotX += enemy.pos.x * weight;
      hotspotY += enemy.pos.y * weight;
      weightSum += weight;
    }

    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];
      const projected = {
        x: bullet.pos.x + (bullet.vel?.x ?? 0) * 8,
        y: bullet.pos.y + (bullet.vel?.y ?? 0) * 8,
      };
      const d2 = Math.max(1, Vector.distSq(bot.pos, projected));
      const weight = 0.4 / Math.sqrt(d2);
      hotspotX += projected.x * weight;
      hotspotY += projected.y * weight;
      weightSum += weight;
    }

    if (weightSum <= 0.0001) return ZERO;
    const hotspot = { x: hotspotX / weightSum, y: hotspotY / weightSum };
    const away = this.movement.fleeForce(bot.pos, hotspot);
    const lane = this.movement.seekForce(bot.pos, this.getLaneAnchor(bot, this.getMemory(bot.id), 0.48));
    if (!target) return this.movement.composeSteering([away, lane], [0.92, 0.38], 1.1);

    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
    const slide = { x: -toTarget.y, y: toTarget.x };
    return this.movement.composeSteering([away, slide, lane], [0.88, 0.46, 0.3], 1.16);
  }

  private applyStuckRecovery(bot: IAITank, steering: Vector2, goal: Vector2, mem: Memory, desiredPoint: Vector2 | null): Vector2 {
    const distanceSq = desiredPoint ? Vector.distSq(bot.pos, desiredPoint) : Infinity;
    const needsMovement = desiredPoint ? distanceSq > TUNING.stuckTargetDistanceSq : Vector.magSq(goal) > 0.0001;
    const movedSq = Vector.distSq(bot.pos, mem.lastPos);

    if (needsMovement && movedSq < TUNING.stuckDistanceSq) {
      mem.stuckTicks++;
    } else {
      mem.stuckTicks = Math.max(0, mem.stuckTicks - 1);
    }

    if (mem.stuckTicks < TUNING.maxStuckTicks) return steering;

    mem.stuckTicks = 0;
    mem.strafeDir = mem.strafeDir === 1 ? -1 : 1;
    mem.strafeFlipTick = this.tick + 20 + (bot.id % 9);

    const toward = desiredPoint ? Vector.normalize(Vector.sub(desiredPoint, bot.pos)) : Vector.normalize(goal);
    const side = Vector.magSq(toward) > 0.0001
      ? { x: -toward.y * mem.strafeDir, y: toward.x * mem.strafeDir }
      : { x: Math.cos(mem.wanderAngle), y: Math.sin(mem.wanderAngle) };
    mem.wanderAngle += 0.41;
    const detourPoint = {
      x: this.clamp(bot.pos.x + side.x * 260 + toward.x * 90, 140, this.config.worldWidth - 140),
      y: this.clamp(bot.pos.y + side.y * 260 + toward.y * 90, 140, this.config.worldHeight - 140),
    };
    mem.detourPoint = detourPoint;
    mem.detourUntil = this.tick + TUNING.detourTicks;
    const detourSeek = this.movement.arriveForce(bot.pos, detourPoint, 260, 20);

    const boundary = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel,
      this.config.worldWidth,
      this.config.worldHeight,
      TUNING.boundaryPadding,
      TUNING.boundaryLookAhead
    );

    return this.movement.composeSteering([detourSeek, side, steering, boundary], [1.28, 0.78, 0.5, 0.74], 1.48);
  }

  private getRouteDangerPenalty(from: Vector2, to: Vector2, enemies: Player[], ignoreId: number): number {
    const probeR2 = TUNING.routeProbeRadius * TUNING.routeProbeRadius;
    let pressure = 0;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.id === ignoreId) continue;
      const projection = this.projectPointToSegment(enemy.pos, from, to);
      if (projection.t < 0.08 || projection.t > 0.94 || projection.distanceSq > probeR2) continue;
      const closeness = 1 - Math.min(1, Math.sqrt(projection.distanceSq) / TUNING.routeProbeRadius);
      const targetPressure = enemy.aiTargetId != null ? 0.08 : 0;
      pressure += 0.16 + closeness * 0.22 + targetPressure;
    }
    return Math.min(1.05, pressure);
  }

  private projectPointToSegment(point: Vector2, from: Vector2, to: Vector2): { distanceSq: number; t: number; closest: Vector2 } {
    const ab = Vector.sub(to, from);
    const lenSq = Math.max(0.000001, Vector.magSq(ab));
    const ap = Vector.sub(point, from);
    const t = this.clamp(Vector.dot(ap, ab) / lenSq, 0, 1);
    const closest = {
      x: from.x + ab.x * t,
      y: from.y + ab.y * t,
    };
    return {
      distanceSq: Vector.distSq(point, closest),
      t,
      closest,
    };
  }

  private getFarmContestPressure(target: Player, enemies: Player[], farmTargets: Player[]): number {
    let pressure = 0;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const d2 = Vector.distSq(enemy.pos, target.pos);
      if (d2 <= 420 * 420) pressure += 0.28;
    }
    for (let i = 0; i < farmTargets.length; i++) {
      const other = farmTargets[i];
      if (other.id === target.id) continue;
      const d2 = Vector.distSq(other.pos, target.pos);
      if (d2 > 240 * 240) continue;
      pressure += other.type === 'CRASHER' ? 0.24 : other.type === 'BOSS' ? 0.36 : 0.08;
    }
    return Math.min(1.4, pressure);
  }

  private pickDominionObjective(bot: IAITank, mem: Memory): DominionZoneState | null {
    if (this.config.dominionZones.length === 0) return null;
    let best: DominionZoneState | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < this.config.dominionZones.length; i++) {
      const zone = this.config.dominionZones[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, zone.pos));
      const owner = zone.owner;
      const owned = owner === bot.team;
      const neutral = owner === Team.NONE;
      const contestBonus = zone.contested ? 0.72 : 0;
      const captureBias = neutral ? 1.0 : owned ? 0.12 : 1.28;
      const distanceBias = 240000 / d2;
      const laneAffinity = this.getLaneAffinity(bot, mem, zone.pos);
      const defenseBias = owned && zone.contested ? 0.95 : owned ? 0.2 : 0;
      const score = captureBias + contestBonus + distanceBias + laneAffinity + defenseBias;
      if (score > bestScore) {
        bestScore = score;
        best = zone;
      }
    }
    return best;
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

  private getDynamicIdealRange(bot: IAITank, target: Player, enemies: Player[], caution: number): number {
    const base = this.getIdealRange(bot.classType);
    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const woundedBoost = hpRatio < 0.56 ? (0.56 - hpRatio) * TUNING.woundedRangeBoost / 0.56 : 0;
    const nearbyCover = this.countEnemyPressureAt(target.id, target.pos, enemies, 360);
    const coverBoost = Math.min(0.18, nearbyCover * 0.11);
    const cautionBoost = Math.min(0.2, Math.max(0, caution) * 0.08);
    const classBoost = this.isSupport(bot.classType) ? 0.08 : bot.classType === TankClass.SNIPER || bot.classType === TankClass.RANGER ? 0.1 : 0;
    return base * (1 + woundedBoost + coverBoost + cautionBoost + classBoost);
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
      lastPos: ZERO,
      stuckTicks: 0,
      lastThreatPos: null,
      lastThreatVel: ZERO,
      lastThreatTick: 0,
      investigateUntil: 0,
      cautionUntil: 0,
      detourUntil: 0,
      detourPoint: null,
    };
    this.memory.set(botId, created);
    return created;
  }

  private getLaneAnchor(bot: IAITank, mem: Memory, depth: number): Vector2 {
    const w = this.config.worldWidth;
    const h = this.config.worldHeight;
    const safeZone = this.config.safeZones.find((z) => z.team === bot.team);
    if (!safeZone) {
      const laneY = this.clamp(h * 0.5 + mem.laneOffsetY, 160, h - 160);
      const laneX = bot.team === Team.BLUE
        ? w * depth + mem.laneBiasX
        : w * (1 - depth) - mem.laneBiasX;
      return { x: this.clamp(laneX, 160, w - 160), y: laneY };
    }

    const toCenter = Vector.sub(this.config.mapCenter, safeZone.center);
    const dir = Vector.magSq(toCenter) > 0.0001 ? Vector.normalize(toCenter) : { x: 1, y: 0 };
    const lateral = { x: -dir.y, y: dir.x };
    const advance = Math.max(safeZone.radius * 0.32, Vector.dist(safeZone.center, this.config.mapCenter) * depth);
    const anchor = Vector.add(
      safeZone.center,
      Vector.add(
        Vector.mult(dir, advance + mem.laneBiasX),
        Vector.mult(lateral, mem.laneOffsetY)
      )
    );
    return {
      x: this.clamp(anchor.x, 160, w - 160),
      y: this.clamp(anchor.y, 160, h - 160),
    };
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
    if (shape.includes('OCTAGON')) return 110;
    if (shape.includes('HEXAGON')) return 50;
    if (shape.includes('HEPTAGON')) return 40;
    if (shape.includes('PENTAGON')) return 36;
    if (shape.includes('DIAMOND')) return 15;
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

  private getTargetShotLanePenalty(bot: IAITank, target: Player, allies: IAITank[]): number {
    const toTarget = Vector.sub(target.pos, bot.pos);
    const len = Math.sqrt(Math.max(1, Vector.magSq(toTarget)));
    const dir = Vector.normalize(toTarget);
    let penalty = 0;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      if (ally.id === bot.id) continue;
      const rel = Vector.sub(ally.pos, bot.pos);
      const proj = Vector.dot(rel, dir);
      if (proj <= 0 || proj >= len) continue;
      const closest = {
        x: bot.pos.x + dir.x * proj,
        y: bot.pos.y + dir.y * proj,
      };
      const radius = this.getBotRadius(ally) + 10;
      const perp = Math.sqrt(Math.max(0, Vector.distSq(ally.pos, closest)));
      if (perp > Math.max(TUNING.shotObstructionRadius, radius)) continue;
      const closeness = 1 - Math.min(1, perp / Math.max(1, radius));
      penalty += 0.36 + closeness * 0.3;
    }

    return Math.min(0.85, penalty);
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
    let worstPenalty = 0;
    for (let i = 0; i < this.config.safeZones.length; i++) {
      const zone = this.config.safeZones[i];
      if (zone.team === Team.NONE || zone.team === botTeam) continue;
      const dist = Math.sqrt(Math.max(1, Vector.distSq(point, zone.center)));
      if (dist >= zone.radius * 1.08) continue;
      const normalized = 1 - Math.min(1, dist / Math.max(1, zone.radius * 1.08));
      worstPenalty = Math.max(worstPenalty, normalized * 0.9);
    }
    return worstPenalty;
  }

  private getShotConfidence(bot: IAITank, target: Player, distance: number, state: AIState): number {
    const targetVel = target.vel ?? ZERO;
    const targetSpeed = Math.sqrt(Vector.magSq(targetVel));
    const ideal = this.getIdealRange(bot.classType);
    const travelPenalty = Math.min(0.58, (distance / Math.max(160, ideal * 1.18)) * 0.34);
    const lateralPenalty = Math.min(0.36, targetSpeed * 0.022);
    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
    const closingBonus = Vector.dot(Vector.normalize(targetVel), toTarget) < -0.15 ? 0.08 : 0;
    const duelBonus = target.aiTargetId === bot.id ? 0.1 : target.aiTargetId != null ? 0.04 : 0;
    const finishBonus = ((target.health ?? 100) / Math.max(1, target.maxHealth ?? 100)) < 0.4 ? 0.16 : 0;
    const farmBonus = target.type === 'SHAPE' || target.type === 'CRASHER' || target.type === 'BOSS' ? 0.18 : 0;
    const fleePenalty = state === AIState.FLEE ? 0.18 : 0;
    const aggressionBonus = this.isRusher(bot.classType) ? 0.12 : this.isSupport(bot.classType) ? 0.02 : 0.08;
    return Math.max(0, Math.min(1.2, 1 + finishBonus + farmBonus + aggressionBonus + closingBonus + duelBonus - travelPenalty - lateralPenalty - fleePenalty));
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
