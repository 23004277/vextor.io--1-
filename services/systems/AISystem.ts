import { AIState, EntityType, GameMode, StatType, TankClass, Team, Vector2 } from '../../types';
import { BASE_ZONE_WIDTH, SAFE_ZONE_WARNING_RADIUS } from '../../constants';
import * as Vector from '../MathUtils';
import { MovementSystem } from './MovementSystem';

export type BotArchetype =
  | 'FARMER'
  | 'RUSHER'
  | 'DUELIST'
  | 'SNIPER'
  | 'SUPPORT'
  | 'EXPLORER'
  | 'BULLY'
  | 'SURVIVOR'
  | 'BOSS_HUNTER'
  | 'DRONE_COMMANDER';

export type ThreatLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PANIC';
export type DebugColor = 'WHITE' | 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'PURPLE' | 'CYAN';

type TankLike = {
  id: number;
  pos: Vector2;
  vel: Vector2;
  radius: number;
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
  lastDamageSourceId?: number | null;
};

type RecentContact = {
  id: number;
  firstSeenTick: number;
  lastSeenTick: number;
  lastKnownPos: Vector2;
  lastKnownVel: Vector2;
  timesTargeted: number;
};

type BotMemory = {
  sessionArchetype: BotArchetype;
  wanderAngle: number;
  lookAngle: number;
  lookPhase: number;
  fleeLatchUntilTick: number;
  stuckTicks: number;
  strafeDir: 1 | -1;
  strafeUntilTick: number;
  lastPos: Vector2;
  lastState: AIState;
  lastTargetId: number | null;
  lastShootTargetId: number | null;
  aggressionBias: number;
  cautionBias: number;
  accuracyBias: number;
  farmBias: number;
  supportBias: number;
  aimNoise: number;
  lastDecisionTick: number;
  lastThinkTick: number;
  teamFightTargetId: number | null;
  teamFightUntilTick: number;
  fleeHealthThreshold: number;
  decisionStride: number;
  discoveryDelayTicks: number;
  intentDelayTicks: number;
  targetLockUntilTick: number;
  intentTargetId: number | null;
  intentPromoteTick: number;
  seenHostiles: Map<number, number>;
  recentContacts: Map<number, RecentContact>;
  shootHesitancyTicks: number;
  shootHesitancyCounter: number;
  panicFleeAngleOffset: number;
  postKillPauseUntilTick: number;
  squadAnchor: Vector2 | null;
  squadAnchorTick: number;
  assistUrgencyUntilTick: number;
  zoneScoutUntilTick: number;
  orbitUntilTick: number;
  firstTellLoggedTick: number;
  sameFeelLogged: boolean;
  latePhaseKills: number;
  latePhaseDeaths: number;
  debug: AIDebugSnapshot | null;
};

type EngineLike = {
  entities: any[];
  gameMode: GameMode;
  inVoid: boolean;
  voidTimer?: number;
  voidTimeRemaining?: number;
  width?: number;
  height?: number;
  baseZoneWidth?: number;
  spatialGrid: { query: (pos: Vector2, radius: number) => any[] };
  getInterceptPoint: (pos: Vector2, speed: number, targetPos: Vector2, targetVel: Vector2) => Vector2;
  applyTankMovement: (tank: any, steering: Vector2) => void;
  attemptShoot: (tank: any) => void;
  upgradeStat: (tank: any, stat: StatType) => void;
};

type ThinkResult = {
  state: AIState;
  target: any | null;
  combatTarget: any | null;
};

type WorldInfo = {
  width: number;
  height: number;
  baseZoneWidth: number;
  center: Vector2;
};

type SensorFrame = {
  neighbors: any[];
  hostiles: any[];
  allies: any[];
  farmTargets: any[];
  rareTargets: any[];
  bullets: any[];
  crashers: any[];
  portals: any[];
  closestHostile: any | null;
  closestFarm: any | null;
  closestBullet: any | null;
  projectilePressure: number;
  allyPressure: number;
  safeDirection: Vector2;
  resourceCentroid: Vector2 | null;
  hostileCentroid: Vector2 | null;
};

export type AIDebugRay = {
  origin: Vector2;
  direction: Vector2;
  length: number;
  color: DebugColor;
  label?: string;
};

export type AIDebugSnapshot = {
  botId: number;
  state: AIState;
  archetype: BotArchetype;
  targetId: number | null;
  shootTargetId: number | null;
  reason: string;
  steering: Vector2;
  projectilePressure: number;
  threatLevel: ThreatLevel;
  rays: AIDebugRay[];
};

const BASE_BULLET_SPEED = 5;

const ZERO: Vector2 = { x: 0, y: 0 };

const AI_TUNING = {
  defaultDecisionStride: 3,
  combatDecisionStride: 1,
  fleeDecisionStride: 1,
  idleDecisionStride: 4,
  defaultWorldWidth: 6000,
  defaultWorldHeight: 4000,

  fleeEnterHpRatio: 0.27,
  fleeExitHpRatio: 0.4,
  fleeLatchTicks: 26,
  pressureFleeThreshold: 1.4,
  pressureCautionThreshold: 0.72,
  steeringSmoothing: 0.38,
  emergencySteeringSmoothing: 0.72,
  visionMin: 160,
  visionPaddingProjectile: 300,

  stuckDistanceSq: 11 * 11,
  stuckTargetDistanceSq: 95 * 95,
  maxStuckTicks: 6,

  allyCriticalHpRatio: 0.34,
  assistRadius: 560,
  assistThreatRadius: 760,
  teamFightJoinRadius: 980,
  teamFightFollowTicks: 54,
  teamFightAllyHpThreshold: 0.82,
  targetLockMinTicks: 28,
  assistCriticalHpRatio: 0.3,
  assistUrgencyTicks: 30,
  postKillPauseMinTicks: 5,
  postKillPauseMaxTicks: 15,

  rareShapeXpThreshold: 2600,
  rareHuntTimerMs: 5200,

  maxSteering: 4.5,
  maxStatUpgradesPerDecision: 3,

  combatMinRange: 250,
  combatMaxRange: 560,
  heavyMinRange: 410,
  heavyMaxRange: 760,
  supportMinRange: 340,
  supportMaxRange: 650,
  farmMinRange: 260,
  farmMaxRange: 430,
  crasherRangeBonus: 80,
  farmShapeAvoidRadiusPadding: 125,
  farmEmergencyFleePadding: 90,

  boundaryPadding: 210,
  boundaryLookAhead: 220,
  boundaryStrength: 120,
  allySeparationRadius: 130,
  ffaSeparationRadius: 95,
  cohesionRadius: 380,
  sameFeelThresholdTicks: 1800,
  rusherLateRiskMinEngagements: 4,
  portalTransitDetectionRadius: 1200,
  portalTransitCommitRadius: 340,
  contactForgetTicks: 600,
  dodgeForceMax: 1.5,
  shotObstructionRadius: 42,
  flankOffset: 145,
  hostileRepelRadius: 430,
};

const RARE_RARITIES = new Set(['Legendary', 'Mythical', 'Eternal', 'Transcendent', 'Godly', 'Divine']);

export class AISystem {
  private readonly movement = new MovementSystem();
  private readonly botMemory = new Map<number, BotMemory>();
  private readonly lastHealthSnapshot = new Map<number, { health: number; lastDropTick: number }>();
  private readonly debugSnapshots = new Map<number, AIDebugSnapshot>();

  private readonly cachedAllies: Array<{ pos: Vector2 }> = [];
  private readonly cachedAllyVels: Vector2[] = [];
  private readonly cachedThreats: any[] = [];

  private tick = 0;
  private sessionStartTick = 0;
  public debugDecisionsThisTick = 0;

  beginTick(simulationTick: number): void {
    if (this.sessionStartTick === 0) this.sessionStartTick = simulationTick;
    this.tick = simulationTick;
    this.debugDecisionsThisTick = 0;
  }

  updateBot(bot: TankLike, engine: EngineLike, dt: number, botStatPriorities: Record<TankClass, StatType[]>): void {
    if (bot.isDead) return;

    const memory = this.getMemory(bot);
    this.updateHuntTimer(bot, dt);

    // Keep movement, rotation and shooting responsive every fixed tick.
    engine.applyTankMovement(bot, bot.lastSteering || ZERO);
    this.applyRotation(bot, dt);
    this.handleShooting(bot, engine);

    // Heavy AI is deliberately time-sliced so many bots do not spike the frame.
    if (!this.shouldThink(bot)) return;

    this.debugDecisionsThisTick++;

    const world = this.getWorldInfo(engine);
    const frame = this.scan(bot, engine, world);

    memory.lastDecisionTick = this.tick;
    memory.lastThinkTick = this.tick;
    this.updateMemoryFromSensors(bot, frame, memory);
    this.captureHealthDeltas(frame.neighbors);

    let result = this.chooseBehavior(bot, engine, frame, memory, world);

    if (this.shouldForceResourceRouting(bot, result.state, result.target, engine, world)) {
      result = {
        state: AIState.HUNT,
        target: this.getResourceWaypoint(bot, world),
        combatTarget: null,
      };
    }

    result = this.applyStuckRecovery(bot, result, memory);
    this.commitBehavior(bot, result);

    const steering = this.computeSteering(bot, result.target, frame, result.state, engine.gameMode, world, memory);
    bot.lastSteering = this.smoothSteering(bot, steering, result.state);

    memory.lastPos = { x: bot.pos.x, y: bot.pos.y };
    memory.lastState = result.state;
    memory.lastTargetId = result.target ? result.target.id : null;
    memory.lastShootTargetId = result.combatTarget ? result.combatTarget.id : null;

    this.allocateStats(bot, engine, botStatPriorities);
    this.writeDebug(bot, memory, frame, result, steering);
  }

  private shouldThink(bot: TankLike): boolean {
    const memory = this.getMemory(bot);
    let stride = memory.decisionStride;
    if (bot.aiState === AIState.COMBAT) stride = AI_TUNING.combatDecisionStride;
    else if (bot.aiState === AIState.FLEE) stride = AI_TUNING.fleeDecisionStride;
    else if (bot.aiState === AIState.IDLE) stride = AI_TUNING.idleDecisionStride;
    return ((bot.id + this.tick) % Math.max(1, stride)) === 0;
  }

  private updateHuntTimer(bot: TankLike, dt: number): void {
    if ((bot.aiHuntingTimer || 0) <= 0) return;

    bot.aiHuntingTimer = Math.max(0, (bot.aiHuntingTimer || 0) - dt * 1000);
    if (bot.aiHuntingTimer <= 0) {
      bot.aiHuntingSpecialId = null;
    }
  }

  private scan(bot: TankLike, engine: EngineLike, world: WorldInfo): SensorFrame {
    const radius = Math.max(AI_TUNING.visionMin, bot.visionRange + AI_TUNING.visionPaddingProjectile);
    const neighbors = engine.spatialGrid.query(bot.pos, radius);

    const hostiles: any[] = [];
    const allies: any[] = [];
    const farmTargets: any[] = [];
    const rareTargets: any[] = [];
    const bullets: any[] = [];
    const crashers: any[] = [];
    const portals: any[] = [];

    let closestHostile: any | null = null;
    let closestFarm: any | null = null;
    let closestBullet: any | null = null;
    let closestHostileD2 = Infinity;
    let closestFarmD2 = Infinity;
    let closestBulletD2 = Infinity;

    let hostileX = 0;
    let hostileY = 0;
    let hostileCount = 0;
    let farmX = 0;
    let farmY = 0;
    let farmWeight = 0;
    let pressure = 0;
    let allyPressure = 0;
    let safeX = 0;
    let safeY = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id) continue;

      const distanceSq = Math.max(1, Vector.distSq(bot.pos, e.pos));

      if (e.type === EntityType.BULLET) {
        if (!this.isFriendly(bot, e, engine.gameMode)) {
          bullets.push(e);
          if (distanceSq < closestBulletD2) {
            closestBulletD2 = distanceSq;
            closestBullet = e;
          }

          const rel = Vector.sub(bot.pos, e.pos);
          const vel = e.vel || ZERO;
          const incoming = Vector.dot(rel, vel) > 0;
          const weight = ((incoming ? 1.0 : 0.25) * 20000) / distanceSq;
          pressure += weight;

          const away = Vector.normalize(rel);
          safeX += away.x * weight;
          safeY += away.y * weight;
        }
        continue;
      }

      if (this.isTankLike(e)) {
        if (this.isFriendly(bot, e, engine.gameMode)) {
          allies.push(e);
          allyPressure += 1 / distanceSq;
        } else {
          hostiles.push(e);
          hostileX += e.pos.x;
          hostileY += e.pos.y;
          hostileCount++;
          if (distanceSq < closestHostileD2) {
            closestHostileD2 = distanceSq;
            closestHostile = e;
          }
        }
        continue;
      }

      if (this.isFarmTarget(e)) {
        farmTargets.push(e);
        if (e.type === EntityType.CRASHER) crashers.push(e);
        if (this.isRareFarmTarget(e)) rareTargets.push(e);

        const xp = Math.max(1, typeof e.xpValue === 'number' ? e.xpValue : 100);
        const rarityBoost = this.getRarityScore(e);
        const weight = (xp * (1 + rarityBoost * 0.08)) / Math.max(64, Math.sqrt(distanceSq));
        farmX += e.pos.x * weight;
        farmY += e.pos.y * weight;
        farmWeight += weight;

        if (distanceSq < closestFarmD2) {
          closestFarmD2 = distanceSq;
          closestFarm = e;
        }
        continue;
      }

      if (e.type === EntityType.VOID_PORTAL) {
        portals.push(e);
      }
    }

    return {
      neighbors,
      hostiles,
      allies,
      farmTargets,
      rareTargets,
      bullets,
      crashers,
      portals,
      closestHostile,
      closestFarm,
      closestBullet,
      projectilePressure: pressure,
      allyPressure,
      safeDirection: Vector.normalize({ x: safeX, y: safeY }),
      resourceCentroid: farmWeight > 0 ? { x: farmX / farmWeight, y: farmY / farmWeight } : null,
      hostileCentroid: hostileCount > 0 ? { x: hostileX / hostileCount, y: hostileY / hostileCount } : null,
    };
  }

  private updateMemoryFromSensors(bot: TankLike, frame: SensorFrame, memory: BotMemory): void {
    for (let i = 0; i < frame.hostiles.length; i++) {
      const hostile = frame.hostiles[i];
      if (!memory.seenHostiles.has(hostile.id)) memory.seenHostiles.set(hostile.id, this.tick);

      const existing = memory.recentContacts.get(hostile.id);
      if (existing) {
        existing.lastSeenTick = this.tick;
        existing.lastKnownPos = { x: hostile.pos.x, y: hostile.pos.y };
        existing.lastKnownVel = hostile.vel || ZERO;
      } else {
        memory.recentContacts.set(hostile.id, {
          id: hostile.id,
          firstSeenTick: this.tick,
          lastSeenTick: this.tick,
          lastKnownPos: { x: hostile.pos.x, y: hostile.pos.y },
          lastKnownVel: hostile.vel || ZERO,
          timesTargeted: 0,
        });
      }
    }

    for (const [id, contact] of memory.recentContacts.entries()) {
      if (this.tick - contact.lastSeenTick > AI_TUNING.contactForgetTicks) {
        memory.recentContacts.delete(id);
        memory.seenHostiles.delete(id);
      }
    }
  }

  private chooseBehavior(bot: TankLike, engine: EngineLike, frame: SensorFrame, memory: BotMemory, world: WorldInfo): ThinkResult {
    const neighbors = frame.neighbors;
    const hpRatio = this.getHpRatio(bot);
    const phase = this.getBehaviorPhase(bot);
    const projectilePressure = frame.projectilePressure;
    this.updateSquadAnchor(bot, neighbors, memory);
    this.updateAssistUrgency(bot, neighbors, memory, engine.gameMode);
    const postKillPaused = this.tick < memory.postKillPauseUntilTick;

    const rare = this.resolveRareHuntTarget(bot, neighbors, engine);
    const hostile = this.pickBestHostile(bot, neighbors, engine.gameMode, projectilePressure, memory, world);
    const teamFightObjective = this.pickTeamFightObjective(bot, neighbors, engine.gameMode, memory);
    const portalIntent = this.pickPortalTransitTarget(bot, neighbors, engine, hpRatio, projectilePressure);
    const recentHostileTrail = !hostile ? this.pickRecentHostileTrail(bot, memory) : null;

    if (hostile && this.shouldFlee(bot, hostile, hpRatio, projectilePressure, memory)) {
      const flee = { state: AIState.FLEE, target: hostile, combatTarget: hostile };
      this.trackArchetypeReadability(bot, memory, flee, neighbors);
      return flee;
    }

    const assist = this.pickAssistScenario(bot, neighbors, engine.gameMode);
    if (assist && !this.isUnderImmediateDanger(hpRatio, projectilePressure)) {
      const bodyguard = {
        state: AIState.BODYGUARD,
        target: {
          id: assist.threat.id,
          pos: this.computeInterposePoint(assist.ally, assist.threat),
          vel: assist.threat.vel || ZERO,
          type: assist.threat.type,
        },
        combatTarget: assist.threat,
      };
      this.trackArchetypeReadability(bot, memory, bodyguard, neighbors);
      return bodyguard;
    }

    if (teamFightObjective && !this.isUnderImmediateDanger(hpRatio, projectilePressure) && phase !== 'PHASE_EARLY') {
      const teamFight = { state: AIState.COMBAT, target: teamFightObjective, combatTarget: teamFightObjective };
      this.trackArchetypeReadability(bot, memory, teamFight, neighbors);
      return teamFight;
    }

    const riskyLateRusher =
      memory.sessionArchetype === 'RUSHER' &&
      phase === 'PHASE_LATE' &&
      memory.latePhaseDeaths > memory.latePhaseKills &&
      (memory.latePhaseKills + memory.latePhaseDeaths) >= AI_TUNING.rusherLateRiskMinEngagements;

    const canEarlyFight = phase === 'PHASE_EARLY' && hpRatio > 0.45 && projectilePressure < AI_TUNING.pressureCautionThreshold;
    if (hostile && (phase !== 'PHASE_EARLY' || canEarlyFight) && !postKillPaused && !riskyLateRusher) {
      const combat = { state: AIState.COMBAT, target: hostile, combatTarget: hostile };
      this.trackArchetypeReadability(bot, memory, combat, neighbors);
      return combat;
    }
    if (hostile && riskyLateRusher && hpRatio < 0.68) {
      const regroup = { state: AIState.FLEE, target: hostile, combatTarget: hostile };
      this.trackArchetypeReadability(bot, memory, regroup, neighbors);
      return regroup;
    }

    if (portalIntent) {
      const transit = { state: AIState.PROXIMAL_PORTAL_TRANSIT, target: portalIntent, combatTarget: hostile && this.isShootableTarget(hostile) ? hostile : null };
      this.trackArchetypeReadability(bot, memory, transit, neighbors);
      return transit;
    }

    if (recentHostileTrail && !this.isUnderImmediateDanger(hpRatio, projectilePressure)) {
      const pursuit = { state: AIState.HUNT, target: recentHostileTrail, combatTarget: null };
      this.trackArchetypeReadability(bot, memory, pursuit, neighbors);
      return pursuit;
    }

    if (rare) {
      const hunt = { state: AIState.HUNT, target: rare, combatTarget: this.isShootableTarget(rare) ? rare : null };
      this.trackArchetypeReadability(bot, memory, hunt, neighbors);
      return hunt;
    }

    const farm = this.pickBestShape(bot, neighbors, projectilePressure, memory, phase);
    if (farm) {
      const farmResult = { state: AIState.FARM, target: farm, combatTarget: this.isShootableTarget(farm) ? farm : null };
      this.trackArchetypeReadability(bot, memory, farmResult, neighbors);
      return farmResult;
    }

    // Aggressive team presence: when no immediate target exists, proactively pressure rotating sectors.
    if (engine.gameMode === GameMode.TEAMS && bot.team !== Team.NONE) {
      const scout = { state: AIState.HUNT, target: this.getExplorationWaypoint(bot, world), combatTarget: null };
      this.trackArchetypeReadability(bot, memory, scout, neighbors);
      return scout;
    }

    const idle = { state: AIState.IDLE, target: null, combatTarget: null };
    this.trackArchetypeReadability(bot, memory, idle, neighbors);
    return idle;
  }

  private shouldFlee(bot: TankLike, hostile: any, hpRatio: number, projectilePressure: number, memory: BotMemory): boolean {
    const distanceSq = Vector.distSq(bot.pos, hostile.pos);
    const closeThreat = distanceSq < 585 * 585;
    void projectilePressure;

    const threshold = Math.min(0.18, memory.fleeHealthThreshold * 0.62);

    if (hpRatio <= threshold && closeThreat) {
      memory.fleeLatchUntilTick = this.tick + AI_TUNING.fleeLatchTicks;
      return true;
    }

    return (
      memory.lastState === AIState.FLEE &&
      hpRatio < Math.max(threshold + 0.08, 0.3) &&
      this.tick <= memory.fleeLatchUntilTick
    );
  }

  private isUnderImmediateDanger(hpRatio: number, projectilePressure: number): boolean {
    return hpRatio < 0.2 || (projectilePressure >= AI_TUNING.pressureFleeThreshold && hpRatio < 0.24);
  }

  private commitBehavior(bot: TankLike, result: ThinkResult): void {
    const shootTarget = result.combatTarget;
    const memory = this.getMemory(bot);

    bot.aiState = result.state;
    bot.aiTargetId = shootTarget ? shootTarget.id : result.target ? result.target.id : null;
    if (shootTarget && memoryNeedsIntentPromote(memory, shootTarget.id, this.tick)) {
      bot.aiShooting = false;
    } else {
      bot.aiShooting = !!shootTarget && this.stateAllowsShooting(result.state);
    }
  }

  private stateAllowsShooting(state: AIState): boolean {
    return (
      state === AIState.COMBAT ||
      state === AIState.FLEE ||
      state === AIState.BODYGUARD ||
      state === AIState.FARM ||
      state === AIState.HUNT ||
      state === AIState.PROXIMAL_PORTAL_TRANSIT
    );
  }

  private applyStuckRecovery(bot: TankLike, result: ThinkResult, memory: BotMemory): ThinkResult {
    if (!result.target || !this.stateWantsMovement(result.state)) {
      memory.stuckTicks = Math.max(0, memory.stuckTicks - 1);
      return result;
    }

    const movedSq = Vector.distSq(bot.pos, memory.lastPos);
    const distanceSq = Vector.distSq(bot.pos, result.target.pos);
    const needsMovement = distanceSq > AI_TUNING.stuckTargetDistanceSq;

    if (needsMovement && movedSq < AI_TUNING.stuckDistanceSq) {
      memory.stuckTicks++;
    } else {
      memory.stuckTicks = Math.max(0, memory.stuckTicks - 1);
    }

    if (memory.stuckTicks < AI_TUNING.maxStuckTicks) return result;

    memory.stuckTicks = 0;
    memory.strafeDir = memory.strafeDir === 1 ? -1 : 1;
    memory.strafeUntilTick = this.tick + 30;
    memory.orbitUntilTick = Math.max(memory.orbitUntilTick, this.tick + 24);

    const toTarget = Vector.normalize(Vector.sub(result.target.pos, bot.pos));
    const side = Vector.magSq(toTarget) > 0.0001
      ? { x: -toTarget.y * memory.strafeDir, y: toTarget.x * memory.strafeDir }
      : { x: Math.cos(memory.wanderAngle), y: Math.sin(memory.wanderAngle) };
    const detour = {
      x: bot.pos.x + side.x * 180 + toTarget.x * 70,
      y: bot.pos.y + side.y * 180 + toTarget.y * 70,
      id: -bot.id,
      pos: {
        x: bot.pos.x + side.x * 180 + toTarget.x * 70,
        y: bot.pos.y + side.y * 180 + toTarget.y * 70,
      },
      vel: ZERO,
    };
    memory.squadAnchor = detour.pos;
    memory.squadAnchorTick = this.tick + 24;

    return {
      state: result.state === AIState.FLEE ? AIState.HUNT : result.state,
      target: detour,
      combatTarget: result.combatTarget,
    };
  }

  private stateWantsMovement(state: AIState): boolean {
    return state === AIState.COMBAT || state === AIState.FARM || state === AIState.HUNT || state === AIState.BODYGUARD || state === AIState.PROXIMAL_PORTAL_TRANSIT;
  }

  private pickBestHostile(
    bot: TankLike,
    neighbors: any[],
    mode: GameMode,
    projectilePressure: number,
    memory: BotMemory,
    world: WorldInfo
  ): any | null {
    let best: any = null;
    let bestScore = -Infinity;

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id || !this.isTankLike(e)) continue;
      if (this.isFriendly(bot, e, mode)) continue;
      const contact = memory.recentContacts.get(e.id);
      const seenTick = contact?.firstSeenTick ?? memory.seenHostiles.get(e.id);
      if (seenTick == null || this.tick - seenTick < memory.discoveryDelayTicks) continue;

      const distanceSq = Vector.distSq(bot.pos, e.pos);
      if (distanceSq <= 0.0001) continue;
      const distance = Math.sqrt(distanceSq);

      const enemyHpRatio = this.getEntityHpRatio(e);
      const proximityScore = 900000 / distanceSq;
      const lowHpBonus = enemyHpRatio < 0.5 ? (1 - enemyHpRatio) * 1.05 : 0;
      const classThreat = this.classThreatScore(e.classType);
      const finishBonus = this.canLikelyFinish(bot, e) ? 0.48 : 0;
      const stickinessWeight = 0.8 + ((bot.id % 5) * 0.1);
      const targetStickiness = memory.lastTargetId === e.id ? stickinessWeight : 0;
      const dangerPenalty = projectilePressure >= AI_TUNING.pressureCautionThreshold ? classThreat * (0.12 + Math.max(0, memory.cautionBias) * 0.12) : 0;
      const aggression = memory.aggressionBias * 0.65;
      const alliedFocus = this.getAlliedFocusWeight(bot, e, neighbors, mode);
      const exposedEnemy = this.wasRecentlyDamaged(e.id, 12) ? 0.22 : 0;
      const supportPriority = this.isSupportClass(e.classType) ? 0.34 : 0;
      const revenge = bot.lastDamageSourceId === e.id ? 0.55 : 0;
      const bossHunter = memory.sessionArchetype === 'BOSS_HUNTER' && this.isBossClass(e.classType) ? 1.2 : 0;
      const sniperClosePenalty = memory.sessionArchetype === 'SNIPER' && distance < AI_TUNING.heavyMinRange ? 0.45 : 0;
      const rusherPressure = memory.sessionArchetype === 'RUSHER' && distance < 620 ? 0.45 : 0;
      const closePressure = distance < 460 ? 0.26 : 0;
      const interceptPenalty = Math.min(0.55, Math.sqrt(Vector.magSq(e.vel || ZERO)) * (distance / 1500) * 0.08);
      const coverCount = this.countEnemyCoverAt(e, neighbors, mode, bot);
      const hostileCoverPenalty = coverCount * 0.18;
      const collapsePenalty = Math.max(0, coverCount - alliedFocus * 1.35) * 0.14;
      const safeZonePenalty = this.getEnemySafeZonePenalty(bot, e.pos, mode, world);
      const isolationBonus = Math.max(0, 0.3 - coverCount * 0.06);
      const flankAffinity = this.getFlankAffinity(bot, e, memory);
      const routePenalty = this.getTargetRoutePenalty(bot, e, neighbors, mode);

      const score =
        proximityScore +
        lowHpBonus +
        classThreat +
        finishBonus +
        targetStickiness +
        aggression +
        alliedFocus +
        exposedEnemy +
        supportPriority +
        revenge +
        bossHunter +
        rusherPressure +
        closePressure +
        isolationBonus +
        flankAffinity -
        dangerPenalty -
        sniperClosePenalty -
        interceptPenalty -
        hostileCoverPenalty -
        collapsePenalty -
        routePenalty -
        safeZonePenalty;

      if (this.tick < memory.targetLockUntilTick && memory.lastTargetId != null && e.id !== memory.lastTargetId) continue;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }

    return best;
  }

  private pickBestShape(bot: TankLike, neighbors: any[], projectilePressure: number, memory: BotMemory, phase: 'PHASE_EARLY' | 'PHASE_MID' | 'PHASE_LATE'): any | null {
    let best: any = null;
    let bestScore = -Infinity;

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || !this.isFarmTarget(e)) continue;
      if (phase === 'PHASE_EARLY' && e.type === EntityType.CRASHER) continue;

      const distanceSq = Vector.distSq(bot.pos, e.pos);
      if (distanceSq <= 0.0001) continue;

      const xp = typeof e.xpValue === 'number' ? e.xpValue : 100;
      const rarityBoost = this.isRareFarmTarget(e) ? 1.75 : 1;
      const bossBoost = e.type === EntityType.BOSS ? 2.65 : 1;
      const crasherRisk = e.type === EntityType.CRASHER ? this.getCrasherRiskPenalty(bot, e) : 1;
      const pressurePenalty = projectilePressure >= AI_TUNING.pressureCautionThreshold ? 0.78 : 1;
      const farmBias = 1 + memory.farmBias * 0.35;

      const antiOverlap = this.isShapeTargetCrowdedByAlly(bot, e, neighbors) ? 0.42 : 1;
      const bodyRiskPenalty = distanceSq < (bot.radius + ((typeof e.radius === 'number' ? e.radius : 20)) + 54) ** 2 ? 0.12 : 1;
      const hazardPenalty = this.getFarmHazardPenalty(bot, e, neighbors);
      const score = ((xp * 8500 * rarityBoost * bossBoost * crasherRisk * pressurePenalty * antiOverlap * farmBias * bodyRiskPenalty) / distanceSq) / hazardPenalty;

      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }

    return best;
  }

  private resolveRareHuntTarget(bot: TankLike, neighbors: any[], engine: EngineLike): any | null {
    if (bot.aiHuntingSpecialId != null) {
      const pinned = this.findAliveEntityById(engine.entities, bot.aiHuntingSpecialId);
      if (pinned && this.isRareFarmTarget(pinned)) return pinned;
      bot.aiHuntingSpecialId = null;
    }

    const allyCall = this.findAllyRareHuntCall(bot, neighbors, engine);
    if (allyCall) {
      bot.aiHuntingSpecialId = allyCall.id;
      bot.aiHuntingTimer = AI_TUNING.rareHuntTimerMs;
      return allyCall;
    }

    let best: any = null;
    let bestScore = -Infinity;

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || !this.isRareFarmTarget(e)) continue;

      const distanceSq = Vector.distSq(bot.pos, e.pos);
      if (distanceSq <= 0.0001) continue;

      const xp = typeof e.xpValue === 'number' ? e.xpValue : 0;
      const bossBonus = e.type === EntityType.BOSS ? 4000 : 0;
      const sizeBonus = typeof e.radius === 'number' ? Math.max(0, e.radius - 55) * 18 : 0;
      const score = (xp + bossBonus + sizeBonus) / distanceSq;

      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }

    if (best) {
      bot.aiHuntingSpecialId = best.id;
      bot.aiHuntingTimer = AI_TUNING.rareHuntTimerMs;
    }

    return best;
  }

  private findAllyRareHuntCall(bot: TankLike, neighbors: any[], engine: EngineLike): any | null {
    for (let i = 0; i < neighbors.length; i++) {
      const ally = neighbors[i];
      if (!this.isValidEntity(ally) || ally.id === bot.id || !this.isTankLike(ally)) continue;
      if (ally.team !== bot.team || ally.aiHuntingSpecialId == null) continue;

      const target = this.findAliveEntityById(engine.entities, ally.aiHuntingSpecialId);
      if (target && this.isRareFarmTarget(target)) return target;
    }

    return null;
  }

  private pickAssistScenario(bot: TankLike, neighbors: any[], mode: GameMode): { ally: any; threat: any } | null {
    if (mode === GameMode.FFA || bot.team === Team.NONE) return null;

    let bestAlly: any = null;
    let bestThreat: any = null;
    let bestScore = -Infinity;

    for (let i = 0; i < neighbors.length; i++) {
      const ally = neighbors[i];
      if (!this.isValidEntity(ally) || ally.id === bot.id || !this.isTankLike(ally)) continue;
      if (ally.team !== bot.team) continue;

      const allyDistanceSq = Vector.distSq(bot.pos, ally.pos);
      if (allyDistanceSq > AI_TUNING.assistRadius * AI_TUNING.assistRadius) continue;

      const allyHpRatio = this.getEntityHpRatio(ally);
      const recentlyDamaged = this.wasRecentlyDamaged(ally.id, 12);
      if (allyHpRatio > AI_TUNING.allyCriticalHpRatio && !recentlyDamaged) continue;

      const threat = this.findNearestThreatToAlly(bot, ally, neighbors, mode);
      if (!threat) continue;

      const urgency = (1 - Math.min(1, allyHpRatio)) + (recentlyDamaged ? 0.45 : 0);
      const distanceScore = 250000 / Math.max(1, allyDistanceSq);
      const threatScore = this.classThreatScore(threat.classType) * 0.35;
      const memory = this.getMemory(bot);
      const urgencyBoost = this.tick < memory.assistUrgencyUntilTick ? 0.55 : 0;
      const score = urgency * 2 + distanceScore + threatScore + urgencyBoost;

      if (score > bestScore) {
        bestScore = score;
        bestAlly = ally;
        bestThreat = threat;
      }
    }

    return bestAlly && bestThreat ? { ally: bestAlly, threat: bestThreat } : null;
  }

  private findNearestThreatToAlly(bot: TankLike, ally: any, neighbors: any[], mode: GameMode): any | null {
    let nearestThreat: any = null;
    let nearestThreatDistanceSq = Infinity;

    for (let i = 0; i < neighbors.length; i++) {
      const threat = neighbors[i];
      if (!this.isValidEntity(threat) || threat.id === ally.id || threat.id === bot.id || !this.isTankLike(threat)) continue;
      if (this.isFriendly(bot, threat, mode)) continue;

      const distanceSq = Vector.distSq(ally.pos, threat.pos);
      if (distanceSq > AI_TUNING.assistThreatRadius * AI_TUNING.assistThreatRadius) continue;

      if (distanceSq < nearestThreatDistanceSq) {
        nearestThreatDistanceSq = distanceSq;
        nearestThreat = threat;
      }
    }

    return nearestThreat;
  }

  private computeSteering(
    bot: TankLike,
    target: any | null,
    frame: SensorFrame,
    state: AIState,
    mode: GameMode,
    world: WorldInfo,
    memory: BotMemory
  ): Vector2 {
    const neighbors = frame.neighbors;
    const goal = this.computeGoalForce(bot, target, neighbors, state, mode, memory);
    const squad = this.computeSquadForce(bot, neighbors, mode, state, target);
    const avoid = this.computeAvoidanceForce(bot, mode, world);
    const farmAvoid = this.computeFarmShapeAvoidanceForce(bot, neighbors, state, target);
    const dodge = this.computeDodgeForce(bot, frame);
    const hostileRepel = this.computeHostileRepelForce(bot, neighbors, mode, target);
    const blendedAvoid = this.movement.composeSteering([avoid, farmAvoid, dodge, hostileRepel], [1.0, 1.25, 1.2, 0.8], 2.8);

    return this.movement.composeSteeringWithPriority(blendedAvoid, squad, goal, AI_TUNING.maxSteering);
  }

  private computeGoalForce(
    bot: TankLike,
    target: any | null,
    neighbors: any[],
    state: AIState,
    mode: GameMode,
    memory: BotMemory
  ): Vector2 {
    if (!target) {
      return this.computeIdleClusterForce(bot, neighbors, memory);
    }

    if (state === AIState.FLEE) {
      return this.computeFleeForce(bot, target, neighbors, mode, memory);
    }

    if (state === AIState.COMBAT || state === AIState.FARM) {
      return this.computeRangeControlForce(bot, target, state, memory, neighbors, mode);
    }

    if (state === AIState.HUNT || state === AIState.BODYGUARD) {
      return this.movement.arriveForce(bot.pos, target.pos, 320);
    }
    if (state === AIState.PROXIMAL_PORTAL_TRANSIT) {
      return this.movement.arriveForce(bot.pos, target.pos, 280, AI_TUNING.portalTransitCommitRadius * 0.5);
    }

    return this.computeIdleClusterForce(bot, neighbors, memory);
  }

  private computeRangeControlForce(bot: TankLike, target: any, state: AIState, memory: BotMemory, neighbors: any[], mode: GameMode): Vector2 {
    const range = this.getPreferredRange(bot, state, target);
    const distanceSq = Vector.distSq(bot.pos, target.pos);
    if (state === AIState.FARM && this.isFarmTarget(target)) {
      const targetRadius = typeof target.radius === 'number' ? target.radius : 18;
      const hardStop = bot.radius + targetRadius + AI_TUNING.farmEmergencyFleePadding;
      if (distanceSq < hardStop * hardStop) {
        return this.movement.fleeForce(bot.pos, target.pos);
      }
    }

    const anchor = this.computeEngageAnchor(bot, target, state, memory, neighbors, mode, range);

    if (distanceSq > range.max * range.max) {
      return this.movement.arriveForce(bot.pos, anchor, state === AIState.FARM ? 225 : 315);
    }

    if (distanceSq < range.min * range.min) {
      return this.movement.fleeForce(bot.pos, target.pos);
    }

    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));

    if (this.tick >= memory.strafeUntilTick) {
      const dirSeed = Vector.seededRandom01((bot.id * 16807) ^ (this.tick * 48271));
      memory.strafeDir = dirSeed > 0.5 ? 1 : -1;
      memory.strafeUntilTick = this.tick + 24 + Math.floor(Vector.seededRandom01((bot.id * 69691) ^ this.tick) * 26);
    }

    const sideSign = memory.strafeDir;
    const strafe = { x: -toTarget.y * sideSign, y: toTarget.x * sideSign };
    const hold = this.movement.arriveForce(bot.pos, anchor, state === AIState.FARM ? 220 : 265, range.min * 0.82);
    const dodgeBias = this.getSmallDodgeBias(bot, target, memory);
    const pressureBias = this.getPressureSidestep(bot, target, neighbors, mode);
    const orbitBias = this.tick < memory.orbitUntilTick ? this.movement.composeSteering([strafe, pressureBias], [1.0, 0.5], 1.2) : ZERO;

    return this.movement.composeSteering(
      [strafe, hold, dodgeBias, pressureBias, orbitBias],
      [0.74 + (this.tick < memory.orbitUntilTick ? 0.18 : 0), 0.42, 0.18, 0.24, this.tick < memory.orbitUntilTick ? 0.36 : 0],
      1.35
    );
  }

  private computeFleeForce(bot: TankLike, target: any, neighbors: any[], mode: GameMode, memory: BotMemory): Vector2 {
    this.cachedThreats.length = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id || !this.isTankLike(e)) continue;
      if (this.isFriendly(bot, e, mode)) continue;
      this.cachedThreats.push(e);
    }

    if (this.cachedThreats.length <= 0) {
      return this.applyPanicFleeOffset(this.movement.fleeForce(bot.pos, target.pos), memory.panicFleeAngleOffset);
    }

    let fleeX = 0;
    let fleeY = 0;

    for (let i = 0; i < this.cachedThreats.length; i++) {
      const threat = this.cachedThreats[i];
      const dx = bot.pos.x - threat.pos.x;
      const dy = bot.pos.y - threat.pos.y;
      const distanceSq = Math.max(1, dx * dx + dy * dy);
      const threatWeight = 1 + this.classThreatScore(threat.classType);

      fleeX += (dx / distanceSq) * threatWeight;
      fleeY += (dy / distanceSq) * threatWeight;
    }

    return this.applyPanicFleeOffset(Vector.normalize({ x: fleeX, y: fleeY }), memory.panicFleeAngleOffset);
  }

  private computeEngageAnchor(
    bot: TankLike,
    target: any,
    state: AIState,
    memory: BotMemory,
    neighbors: any[],
    mode: GameMode,
    range: { min: number; max: number }
  ): Vector2 {
    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
    const side = { x: -toTarget.y * memory.strafeDir, y: toTarget.x * memory.strafeDir };
    const flankOffset = this.isSupportClass(bot.classType)
      ? AI_TUNING.flankOffset * 1.1
      : this.isHeavySniperClass(bot.classType)
        ? AI_TUNING.flankOffset * 0.72
        : AI_TUNING.flankOffset;

    let enemyCenterX = 0;
    let enemyCenterY = 0;
    let enemyCount = 0;
    let allySupport = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id || !this.isTankLike(e)) continue;
      const nearTarget = Vector.distSq(e.pos, target.pos) <= 500 * 500;
      if (!nearTarget) continue;
      if (this.isFriendly(bot, e, mode)) allySupport++;
      else if (e.id !== target.id) {
        enemyCenterX += e.pos.x;
        enemyCenterY += e.pos.y;
        enemyCount++;
      }
    }

    let coverBias = ZERO;
    if (enemyCount > 0) {
      const centroid = { x: enemyCenterX / enemyCount, y: enemyCenterY / enemyCount };
      coverBias = this.movement.fleeForce(centroid, target.pos);
    }

    const coverDelta = Math.max(0, enemyCount - Math.max(0, allySupport - 1));
    const pullback = range.min + coverDelta * 32 + (state === AIState.FARM ? 0 : 18);

    return {
      x: target.pos.x - toTarget.x * pullback + side.x * flankOffset + coverBias.x * 58,
      y: target.pos.y - toTarget.y * pullback + side.y * flankOffset + coverBias.y * 58,
    };
  }

  private getPressureSidestep(bot: TankLike, target: any, neighbors: any[], mode: GameMode): Vector2 {
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id || e.id === target.id || !this.isTankLike(e)) continue;
      if (this.isFriendly(bot, e, mode)) continue;
      const d2 = Vector.distSq(bot.pos, e.pos);
      if (d2 > 360 * 360) continue;
      const toEnemy = Vector.normalize(Vector.sub(e.pos, bot.pos));
      fx += -toEnemy.y * 0.35;
      fy += toEnemy.x * 0.35;
    }
    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeHostileRepelForce(bot: TankLike, neighbors: any[], mode: GameMode, target: any | null): Vector2 {
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id || !this.isTankLike(e)) continue;
      if (this.isFriendly(bot, e, mode)) continue;
      if (target && e.id === target.id) continue;
      const d2 = Vector.distSq(bot.pos, e.pos);
      if (d2 > AI_TUNING.hostileRepelRadius * AI_TUNING.hostileRepelRadius) continue;
      const d = Math.sqrt(Math.max(1, d2));
      const t = 1 - Math.min(1, d / AI_TUNING.hostileRepelRadius);
      fx += ((bot.pos.x - e.pos.x) / d) * t;
      fy += ((bot.pos.y - e.pos.y) / d) * t;
    }
    if (Math.abs(fx) + Math.abs(fy) < 0.0001) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeWanderForce(bot: TankLike, memory: BotMemory): Vector2 {
    const jitter = Vector.seededRandom01((this.tick * 73856093) ^ (bot.id * 19349663));
    const wander = this.movement.wanderForce(bot.pos, bot.vel, memory.wanderAngle, 84, 54, jitter);
    memory.wanderAngle = wander.nextAngle;
    return wander.force;
  }

  private computeIdleClusterForce(bot: TankLike, neighbors: any[], memory: BotMemory): Vector2 {
    let total = 0;
    let wx = 0;
    let wy = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || !this.isFarmTarget(e) || e.type === EntityType.CRASHER) continue;
      const xp = Math.max(1, typeof e.xpValue === 'number' ? e.xpValue : 100);
      const d = Math.max(40, Math.sqrt(Vector.distSq(bot.pos, e.pos)));
      const w = xp / d;
      total += w;
      wx += e.pos.x * w;
      wy += e.pos.y * w;
    }
    if (total > 0.001) {
      const centroid = { x: wx / total, y: wy / total };
      if (this.tick > memory.zoneScoutUntilTick) {
        memory.zoneScoutUntilTick = this.tick + 10 + Math.floor(Vector.seededRandom01(bot.id * 991) * 20);
        memory.orbitUntilTick = this.tick + 20 + Math.floor(Vector.seededRandom01(bot.id * 997) * 20);
      }
      if (this.tick < memory.orbitUntilTick) {
        const to = Vector.normalize(Vector.sub(centroid, bot.pos));
        return { x: -to.y, y: to.x };
      }
      return this.movement.arriveForce(bot.pos, centroid, 420);
    }
    return this.computeWanderForce(bot, memory);
  }

  private computeSquadForce(bot: TankLike, neighbors: any[], mode: GameMode, state: AIState, target: any | null): Vector2 {
    this.cachedAllies.length = 0;
    this.cachedAllyVels.length = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id || !this.isTankLike(e)) continue;

      const sameTeam =
        mode !== GameMode.FFA &&
        e.team === bot.team &&
        e.team !== Team.NONE;

      if (!sameTeam) continue;

      this.cachedAllies.push({ pos: e.pos });
      if (e.vel) this.cachedAllyVels.push(e.vel);
    }

    const inPortalTransit = state === AIState.PROXIMAL_PORTAL_TRANSIT && target && target.type === EntityType.VOID_PORTAL;
    const separationRadius = inPortalTransit
      ? 64
      : mode === GameMode.FFA
        ? AI_TUNING.ffaSeparationRadius
        : AI_TUNING.allySeparationRadius * 1.75;

    const sep = this.movement.separationForce(bot.pos, this.cachedAllies, separationRadius);

    // Farming, hunting and idle exploration should spread bots across resources instead of forming team blobs.
    if (state === AIState.IDLE || state === AIState.FARM || state === AIState.HUNT) {
      return this.movement.composeSteering([sep], [1.8], 2.5);
    }

    const coh = this.movement.cohesionForce(bot.pos, this.cachedAllies, inPortalTransit ? 520 : AI_TUNING.cohesionRadius);
    const align = this.movement.alignmentForce(bot.vel, this.cachedAllyVels);

    if (state === AIState.BODYGUARD) {
      return this.movement.composeSteering([sep, coh, align], [1.25, 0.35, 0.2], 2.5);
    }

    if (state === AIState.COMBAT || state === AIState.FLEE) {
      return this.movement.composeSteering([sep, coh, align], [1.55, 0.08, 0.12], 2.5);
    }

    if (inPortalTransit) {
      return this.movement.composeSteering([sep, coh, align], [0.74, 0.62, 0.28], 2.5);
    }

    return this.movement.composeSteering([sep], [1.6], 2.5);
  }

  private pickPortalTransitTarget(bot: TankLike, neighbors: any[], engine: EngineLike, hpRatio: number, projectilePressure: number): any | null {
    const voidTimeRemaining =
      typeof engine.voidTimeRemaining === 'number'
        ? engine.voidTimeRemaining
        : typeof engine.voidTimer === 'number'
          ? engine.voidTimer
          : 0;
    if (!engine.inVoid && (hpRatio < 0.26 || projectilePressure > AI_TUNING.pressureFleeThreshold)) return null;
    if (engine.inVoid && hpRatio > 0.36 && projectilePressure < AI_TUNING.pressureCautionThreshold && voidTimeRemaining > 50) return null;
    let best: any | null = null;
    let bestDistSq = Infinity;
    const maxDistSq = AI_TUNING.portalTransitDetectionRadius * AI_TUNING.portalTransitDetectionRadius;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.type !== EntityType.VOID_PORTAL) continue;
      const isExit = !!e.isExit;
      if (engine.inVoid ? !isExit : isExit) continue;
      const d2 = Vector.distSq(bot.pos, e.pos);
      if (d2 > maxDistSq) continue;
      const phase = typeof e.phase === 'string' ? e.phase : 'BLACK_HOLE';
      const phaseScore = isExit ? 0 : phase === 'EXPANDING' ? 0 : phase === 'WHITE_HOLE' ? 1 : 2;
      if (!best || phaseScore < (typeof best.phase === 'string' ? (best.isExit ? 0 : best.phase === 'EXPANDING' ? 0 : best.phase === 'WHITE_HOLE' ? 1 : 2) : 2) || d2 < bestDistSq) {
        best = e;
        bestDistSq = d2;
      }
    }
    return best;
  }

  private computeAvoidanceForce(bot: TankLike, mode: GameMode, world: WorldInfo): Vector2 {
    const boundary = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel,
      world.width,
      world.height,
      AI_TUNING.boundaryPadding,
      AI_TUNING.boundaryLookAhead
    );

    const hostileZoneAvoid = this.movement.safeZoneAvoidanceForce(
      bot.pos,
      bot.team,
      mode,
      world.width,
      world.baseZoneWidth,
      SAFE_ZONE_WARNING_RADIUS
    );

    const spawnDispersion = this.getOwnSpawnDispersionForce(bot.pos, bot.team, mode, world);

    return this.movement.composeSteering([boundary, hostileZoneAvoid, spawnDispersion], [1.0, 0.95, 1.35], 2.6);
  }

  private getPreferredRange(bot: TankLike, state: AIState, target: any): { min: number; max: number } {
    if (state === AIState.FARM) {
      const crasherPadding = target?.type === EntityType.CRASHER ? AI_TUNING.crasherRangeBonus : 0;
      return {
        min: AI_TUNING.farmMinRange + crasherPadding,
        max: AI_TUNING.farmMaxRange + crasherPadding,
      };
    }

    if (this.isHeavySniperClass(bot.classType)) {
      return { min: AI_TUNING.heavyMinRange, max: AI_TUNING.heavyMaxRange };
    }

    if (this.isSupportClass(bot.classType)) {
      return { min: AI_TUNING.supportMinRange, max: AI_TUNING.supportMaxRange };
    }

    return { min: AI_TUNING.combatMinRange, max: AI_TUNING.combatMaxRange };
  }

  private getSmallDodgeBias(bot: TankLike, target: any, memory: BotMemory): Vector2 {
    const seed = Vector.seededRandom01((bot.id * 2654435761) ^ (this.tick * 374761393));
    const wobble = (seed - 0.5) * 0.28 + memory.aimNoise * 0.08;
    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
    return { x: -toTarget.y * wobble, y: toTarget.x * wobble };
  }

  private computeFarmShapeAvoidanceForce(bot: TankLike, neighbors: any[], state: AIState, committedTarget: any | null = null): Vector2 {
    const committedFarmId = this.isFarmTarget(committedTarget) ? committedTarget?.id : null;
    const avoidDuringCombat =
      state === AIState.COMBAT ||
      state === AIState.BODYGUARD ||
      state === AIState.PROXIMAL_PORTAL_TRANSIT ||
      state === AIState.FLEE;
    if (state !== AIState.FARM && state !== AIState.HUNT && !avoidDuringCombat) return ZERO;
    let fx = 0;
    let fy = 0;
    let count = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || !this.isFarmTarget(e)) continue;
      if (committedFarmId != null && e.id === committedFarmId) continue;
      const er = typeof e.radius === 'number' ? e.radius : 14;
      const avoidRadius = bot.radius + er + AI_TUNING.farmShapeAvoidRadiusPadding + (avoidDuringCombat ? 46 : 18);
      const dx = bot.pos.x - e.pos.x;
      const dy = bot.pos.y - e.pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 0.0001 || distSq > avoidRadius * avoidRadius) continue;
      const dist = Math.sqrt(distSq);
      const closeness = 1 - Math.min(1, dist / avoidRadius);
      const typeMult = e.type === EntityType.CRASHER ? 2.2 : avoidDuringCombat ? 1.62 : 1.22;
      const w = (closeness * typeMult) / Math.max(24, dist);
      fx += dx * w;
      fy += dy * w;
      count++;
    }
    if (count === 0) return ZERO;
    return Vector.normalize({ x: fx, y: fy });
  }

  private computeDodgeForce(bot: TankLike, frame: SensorFrame): Vector2 {
    let fx = 0;
    let fy = 0;

    for (let i = 0; i < frame.bullets.length; i++) {
      const bullet = frame.bullets[i];
      if (!bullet?.pos || !bullet.vel) continue;

      const rel = Vector.sub(bot.pos, bullet.pos);
      const vel = bullet.vel || ZERO;
      const distanceSq = Math.max(1, Vector.magSq(rel));
      const incoming = Vector.dot(rel, vel) > 0;
      if (!incoming) continue;

      const perpendicular = { x: -vel.y, y: vel.x };
      const dir = Vector.normalize(perpendicular);
      const side = Vector.dot(dir, rel) >= 0 ? 1 : -1;
      const weight = 25000 / distanceSq;

      fx += dir.x * side * weight;
      fy += dir.y * side * weight;
    }

    return Vector.limit({ x: fx, y: fy }, AI_TUNING.dodgeForceMax);
  }

  private smoothSteering(bot: TankLike, targetSteering: Vector2, state: AIState): Vector2 {
    const current = bot.lastSteering || ZERO;
    const t = state === AIState.FLEE ? AI_TUNING.emergencySteeringSmoothing : AI_TUNING.steeringSmoothing;
    return Vector.limit({
      x: current.x + (targetSteering.x - current.x) * t,
      y: current.y + (targetSteering.y - current.y) * t,
    }, AI_TUNING.maxSteering);
  }

  private classThreatScore(cls?: TankClass): number {
    if (cls === TankClass.COLOSSAL || cls === TankClass.LEVIATHAN || cls === TankClass.WARLORD || cls === TankClass.CELESTIAL) return 0.88;
    if (cls === TankClass.ANNIHILATOR || cls === TankClass.DESTROYER || cls === TankClass.HYBRID) return 0.35;
    if (cls === TankClass.FIGHTER || cls === TankClass.BOOSTER || cls === TankClass.TRI_ANGLE) return 0.28;
    if (cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR) return 0.42;
    return 0.2;
  }

  private isHeavySniperClass(cls?: TankClass): boolean {
    return cls === TankClass.ANNIHILATOR || cls === TankClass.DESTROYER || cls === TankClass.HYBRID || cls === TankClass.SNIPER || cls === TankClass.RANGER;
  }

  private isSupportClass(cls?: TankClass): boolean {
    return cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR;
  }

  private isDroneClass(cls?: TankClass): boolean {
    return cls === TankClass.OVERSEER || cls === TankClass.OVERLORD || cls === TankClass.MANAGER || cls === TankClass.COLOSSAL || cls === TankClass.LEVIATHAN || cls === TankClass.CELESTIAL;
  }

  private isBossClass(cls?: TankClass): boolean {
    return cls === TankClass.COLOSSAL || cls === TankClass.LEVIATHAN || cls === TankClass.WARLORD || cls === TankClass.CELESTIAL || cls === TankClass.OBLITERATOR;
  }

  private applyRotation(bot: TankLike, dt: number): void {
    const memory = this.getMemory(bot);

    if (bot.aiTargetId == null) {
      const scanSeed = Vector.seededRandom01((bot.id * 83492791) ^ (this.tick * 2971215073));
      const scanBias = (scanSeed - 0.5) * 0.08;
      const moveDir = Vector.magSq(bot.vel) > 0.0001 ? Math.atan2(bot.vel.y, bot.vel.x) : bot.rotation;

      memory.lookAngle += dt * (0.6 + scanBias);
      memory.lookPhase += dt * 0.85;

      bot.aiTargetRot =
        moveDir +
        Math.sin(memory.lookAngle) * 0.38 +
        Math.cos(memory.lookAngle * 0.57) * 0.16 +
        Math.sin(memory.lookPhase) * 0.08;
    }

    const diff = this.normalizeAngle(bot.aiTargetRot - bot.rotation);
    bot.rotation += diff * Math.min(1, dt * 9.6);
  }

  private handleShooting(bot: TankLike, engine: EngineLike): void {
    if (!bot.aiShooting || bot.aiTargetId == null) return;

    const local = engine.spatialGrid.query(bot.pos, bot.visionRange + 280);
    const target = this.findAliveEntityById(local, bot.aiTargetId);
    if (!target || !this.isShootableTarget(target)) return;

    const memory = this.getMemory(bot);
    const bulletSpeed = BASE_BULLET_SPEED + (bot.stats[StatType.BULLET_SPEED] || 0) * 0.8;
    const aimPos = engine.getInterceptPoint(bot.pos, bulletSpeed, target.pos, target.vel || ZERO);

    const distanceSq = Vector.distSq(bot.pos, target.pos);
    const distance = Math.sqrt(distanceSq);
    const aimNoiseScale = this.getAimNoiseScale(bot, target, distance, memory);
    const aimNoise = (memory.aimNoise + this.deterministicNoise(bot.id, this.tick)) * aimNoiseScale;

    const desiredAimRot = Math.atan2(aimPos.y - bot.pos.y, aimPos.x - bot.pos.x) + aimNoise;
    const aimDiff = this.normalizeAngle(desiredAimRot - bot.aiTargetRot);
    // Human-like tracking: smooth corrections instead of frame-to-frame aim snapping.
    bot.aiTargetRot += aimDiff * 0.55;

    const angleDiff = Math.abs(this.normalizeAngle(bot.aiTargetRot - bot.rotation));
    const fireCone = this.getFireCone(bot, target, distance);
    if (!this.shouldTakeShot(bot, target, aimPos, local, distance, memory)) return;

    if (angleDiff < fireCone) {
      if (memory.shootHesitancyCounter < memory.shootHesitancyTicks) {
        memory.shootHesitancyCounter++;
        return;
      }
      memory.shootHesitancyCounter = 0;
      engine.attemptShoot(bot);
    }
  }

  private getAimNoiseScale(bot: TankLike, target: any, distance: number, memory: BotMemory): number {
    if (target.type === EntityType.SHAPE || target.type === EntityType.BOSS) return 0.003;
    const speedStat = bot.stats[StatType.BULLET_SPEED] || 0;
    const hpRatio = this.getHpRatio(bot);
    const speed = Math.sqrt(Vector.magSq(bot.vel));
    const distancePenalty = Math.min(0.045, distance / 26000);
    const panicPenalty = hpRatio < 0.4 ? (0.06 * (0.4 - hpRatio) / 0.4) : 0;
    const movementPenalty = Math.min(0.03, speed * 0.0055);
    return Math.max(0.0012, 0.012 - memory.accuracyBias * 0.01 - speedStat * 0.001 + distancePenalty + panicPenalty + movementPenalty);
  }

  private getFireCone(bot: TankLike, target: any, distance: number): number {
    if (target.type === EntityType.SHAPE || target.type === EntityType.BOSS || target.type === EntityType.CRASHER) return 0.2;
    if (this.isHeavySniperClass(bot.classType)) return distance > 580 ? 0.085 : 0.12;
    if (this.isDroneClass(bot.classType)) return 0.18;
    return 0.16;
  }

  private shouldTakeShot(bot: TankLike, target: any, aimPos: Vector2, neighbors: any[], distance: number, memory: BotMemory): boolean {
    const range = this.getPreferredRange(bot, bot.aiState, target);
    const maxRange = target.type === EntityType.SHAPE || target.type === EntityType.BOSS || target.type === EntityType.CRASHER
      ? range.max * 1.05
      : range.max * (this.isSupportClass(bot.classType) ? 1.2 : 1.35);
    if (distance > maxRange) return false;
    if (target.type === EntityType.CRASHER && distance < ((typeof target.radius === 'number' ? target.radius : 20) + bot.radius + 110)) return false;
    if (this.isShotLaneBlocked(bot, aimPos, neighbors)) return false;

    const shotConfidence = this.getShotConfidence(bot, target, distance, memory);
    const threshold =
      bot.aiState === AIState.FLEE
        ? 0.7
        : target.type === EntityType.SHAPE || target.type === EntityType.CRASHER || target.type === EntityType.BOSS
          ? 0.4
          : 0.5;
    return shotConfidence >= threshold;
  }

  private getShotConfidence(bot: TankLike, target: any, distance: number, memory: BotMemory): number {
    const targetSpeed = Math.sqrt(Vector.magSq(target.vel || ZERO));
    const travelPenalty = Math.min(0.55, (distance / Math.max(120, this.getPreferredRange(bot, bot.aiState, target).max)) * 0.35);
    const lateralPenalty = Math.min(0.38, targetSpeed * 0.022);
    const healthBonus = this.getEntityHpRatio(target) < 0.42 ? 0.14 : 0;
    const finishBonus = this.canLikelyFinish(bot, target) ? 0.18 : 0;
    const supportPenalty = bot.aiState === AIState.FLEE ? 0.16 : 0;
    const accuracyBonus = Math.max(0, memory.accuracyBias) * 0.16;
    const farmBonus = this.isFarmTarget(target) ? 0.24 : 0;
    const aggressionBonus = Math.max(0, memory.aggressionBias) * 0.14;
    return Math.max(0, Math.min(1.2, 1 + healthBonus + finishBonus + accuracyBonus + farmBonus + aggressionBonus - travelPenalty - lateralPenalty - supportPenalty));
  }

  private isShotLaneBlocked(bot: TankLike, aimPos: Vector2, neighbors: any[]): boolean {
    const line = Vector.sub(aimPos, bot.pos);
    const len = Math.sqrt(Math.max(1, Vector.magSq(line)));
    const dir = Vector.normalize(line);

    for (let i = 0; i < neighbors.length; i++) {
      const ally = neighbors[i];
      if (!this.isValidEntity(ally) || ally.id === bot.id || !this.isTankLike(ally)) continue;
      if (ally.team !== bot.team) continue;
      const rel = Vector.sub(ally.pos, bot.pos);
      const forward = Vector.dot(rel, dir);
      if (forward <= 28 || forward >= len - 24) continue;
      const closest = { x: bot.pos.x + dir.x * forward, y: bot.pos.y + dir.y * forward };
      const perp = Math.sqrt(Vector.distSq(ally.pos, closest));
      const radius = typeof ally.radius === 'number' ? ally.radius : AI_TUNING.shotObstructionRadius;
      if (perp <= Math.max(AI_TUNING.shotObstructionRadius, radius + 6)) return true;
    }
    return false;
  }

  private allocateStats(bot: TankLike, engine: EngineLike, priorities: Record<TankClass, StatType[]>): void {
    if (bot.availableStatPoints <= 0) return;

    const prio = priorities[bot.classType] || priorities[TankClass.BASIC] || [];
    if (prio.length <= 0) return;

    let upgrades = 0;

    for (let i = 0; i < prio.length && bot.availableStatPoints > 0; i++) {
      if (upgrades >= AI_TUNING.maxStatUpgradesPerDecision) break;

      const stat = prio[i];
      if ((bot.stats[stat] || 0) >= 8) continue;

      engine.upgradeStat(bot, stat);
      upgrades++;
    }
  }

  private getMemory(bot: TankLike): BotMemory {
    let memory = this.botMemory.get(bot.id);
    if (memory) return memory;

    const archetype = this.getArchetype(bot);
    const fleeSeed = Vector.seededRandom01(bot.id * 10391);
    const panicSeed = Vector.seededRandom01(bot.id * 30859);
    const strideSeed = Vector.seededRandom01(bot.id * 45053);
    const shootSeed = Vector.seededRandom01(bot.id * 55049);
    const archetypeAgg =
      archetype === 'RUSHER' ? 0.75 :
      archetype === 'BULLY' ? 0.55 :
      archetype === 'DUELIST' ? 0.35 :
      archetype === 'SNIPER' ? 0.1 :
      archetype === 'SUPPORT' ? -0.1 :
      archetype === 'FARMER' ? -0.35 :
      archetype === 'SURVIVOR' ? -0.55 :
      0.0;
    const cautionBase =
      archetype === 'SURVIVOR' ? 0.8 :
      archetype === 'FARMER' ? 0.45 :
      archetype === 'SUPPORT' ? 0.35 :
      archetype === 'SNIPER' ? 0.25 :
      archetype === 'RUSHER' ? -0.2 :
      0.0;
    const accuracyBase =
      archetype === 'SNIPER' ? 0.85 :
      archetype === 'DUELIST' ? 0.55 :
      archetype === 'BOSS_HUNTER' ? 0.4 :
      archetype === 'RUSHER' ? 0.2 :
      0.25;
    const fleeThreshold =
      archetype === 'FARMER' ? 0.45 + fleeSeed * 0.15 :
      archetype === 'RUSHER' ? fleeSeed * 0.14 :
      archetype === 'SURVIVOR' ? 0.42 + fleeSeed * 0.18 :
      archetype === 'SUPPORT' ? 0.35 + fleeSeed * 0.18 :
      0.22 + fleeSeed * 0.3;
    const stride =
      archetype === 'RUSHER' || archetype === 'DUELIST' ? 2 + Math.floor(strideSeed * 2) :
      archetype === 'SNIPER' || archetype === 'SUPPORT' || archetype === 'SURVIVOR' ? 3 + Math.floor(strideSeed * 2) :
      archetype === 'FARMER' ? 4 + Math.floor(strideSeed * 2) :
      archetype === 'EXPLORER' ? 4 + Math.floor(strideSeed * 2) :
      AI_TUNING.defaultDecisionStride + Math.floor(strideSeed * 2);

    memory = {
      sessionArchetype: archetype,
      wanderAngle: Vector.seededRandom01(bot.id * 92821) * Math.PI * 2,
      lookAngle: Vector.seededRandom01(bot.id * 71933) * Math.PI * 2,
      lookPhase: Vector.seededRandom01(bot.id * 41911) * Math.PI * 2,
      fleeLatchUntilTick: 0,
      stuckTicks: 0,
      strafeDir: 1,
      strafeUntilTick: 0,
      lastPos: { x: bot.pos.x, y: bot.pos.y },
      lastState: AIState.IDLE,
      lastTargetId: null,
      lastShootTargetId: null,
      aggressionBias: Math.max(-1, Math.min(1, archetypeAgg + 0.12 + (Vector.seededRandom01(bot.id * 49999) * 0.7 - 0.35))),
      cautionBias: Math.max(-1, Math.min(1, cautionBase + (Vector.seededRandom01(bot.id * 59999) * 0.25 - 0.125))),
      accuracyBias: Math.max(0, Math.min(1, accuracyBase + (Vector.seededRandom01(bot.id * 69999) * 0.2 - 0.1))),
      farmBias: archetype === 'FARMER' ? 0.75 : archetype === 'EXPLORER' ? 0.3 : archetype === 'BOSS_HUNTER' ? 0.15 : 0,
      supportBias: archetype === 'SUPPORT' ? 0.8 : 0,
      aimNoise: Vector.seededRandom01(bot.id * 81817) * 2 - 1,
      lastDecisionTick: this.tick,
      lastThinkTick: this.tick,
      teamFightTargetId: null,
      teamFightUntilTick: 0,
      fleeHealthThreshold: fleeThreshold,
      decisionStride: stride,
      discoveryDelayTicks: 1,
      intentDelayTicks: 1,
      targetLockUntilTick: 0,
      intentTargetId: null,
      intentPromoteTick: 0,
      seenHostiles: new Map<number, number>(),
      recentContacts: new Map<number, RecentContact>(),
      shootHesitancyTicks: Math.floor(shootSeed * 2),
      shootHesitancyCounter: 0,
      panicFleeAngleOffset: (panicSeed * 2 - 1) * ((20 + Vector.seededRandom01(bot.id * 77713) * 10) * Math.PI / 180),
      postKillPauseUntilTick: 0,
      squadAnchor: null,
      squadAnchorTick: 0,
      assistUrgencyUntilTick: 0,
      zoneScoutUntilTick: 0,
      orbitUntilTick: 0,
      firstTellLoggedTick: -1,
      sameFeelLogged: false,
      latePhaseKills: 0,
      latePhaseDeaths: 0,
      debug: null,
    };

    this.botMemory.set(bot.id, memory);
    return memory;
  }

  private captureHealthDeltas(neighbors: any[]): void {
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!e || typeof e.id !== 'number' || e.isDead || typeof e.health !== 'number') continue;

      const prev = this.lastHealthSnapshot.get(e.id);
      if (!prev) {
        this.lastHealthSnapshot.set(e.id, { health: e.health, lastDropTick: -999999 });
        continue;
      }

      if (e.health < prev.health - 0.001) {
        prev.lastDropTick = this.tick;
        if (e.health <= 0) {
          const killerId = typeof e.lastDamageSourceId === 'number' ? e.lastDamageSourceId : null;
          if (killerId !== null) {
            const killerMemory = this.botMemory.get(killerId);
            if (killerMemory) killerMemory.latePhaseKills++;
          }
          const victimMemory = this.botMemory.get(e.id);
          if (victimMemory) victimMemory.latePhaseDeaths++;
          for (const m of this.botMemory.values()) {
            const pause = AI_TUNING.postKillPauseMinTicks + Math.floor(Vector.seededRandom01((e.id * 379) ^ this.tick) * (AI_TUNING.postKillPauseMaxTicks - AI_TUNING.postKillPauseMinTicks + 1));
            m.postKillPauseUntilTick = Math.max(m.postKillPauseUntilTick, this.tick + pause);
          }
        }
      }

      prev.health = e.health;
    }
  }

  private wasRecentlyDamaged(id: number, withinTicks: number): boolean {
    const snapshot = this.lastHealthSnapshot.get(id);
    if (!snapshot) return false;
    return this.tick - snapshot.lastDropTick <= withinTicks;
  }

  private shouldForceResourceRouting(bot: TankLike, state: AIState, target: any | null, engine: EngineLike, world: WorldInfo): boolean {
    // Disabled: hard center-routing made bots drift and reduced lane presence in teams.
    void bot;
    void state;
    void target;
    void engine;
    void world;
    return false;
  }

  private isInsideOwnSafeZone(bot: TankLike, world: WorldInfo): boolean {
    if (bot.team === Team.BLUE) return bot.pos.x < world.baseZoneWidth;
    if (bot.team === Team.RED) return bot.pos.x > world.width - world.baseZoneWidth;
    return false;
  }

  private getResourceWaypoint(bot: TankLike, world: WorldInfo): any {
    const center = { x: world.width * 0.5, y: world.height * 0.5 };
    const centerBias = Math.min(0.2, 0.15 + ((bot.id % 100) / 1000));
    const useCenter = Vector.seededRandom01((bot.id * 31) ^ this.tick) < centerBias;
    const lateral = useCenter
      ? ((((bot.id + this.tick) & 1) === 0 ? 1 : -1) * (60 + ((bot.id * 11) % 100)))
      : ((((bot.id + this.tick) & 1) === 0 ? 1 : -1) * (320 + ((bot.id * 17) % 260)));
    const vertical = 80 + ((bot.id * 23) % 180);

    return {
      id: -1,
      pos: {
        x: center.x + lateral,
        y: center.y + (bot.team === Team.BLUE ? vertical : -vertical),
      },
      vel: ZERO,
    };
  }

  private getExplorationWaypoint(bot: TankLike, world: WorldInfo): any {
    const sectorX = ((bot.id + Math.floor(this.tick / 90)) % 3);
    const sectorY = ((Math.floor(bot.id / 3) + Math.floor(this.tick / 120)) % 3);
    const marginX = world.width * 0.12;
    const marginY = world.height * 0.12;
    const laneX = marginX + (sectorX + 0.5) * ((world.width - marginX * 2) / 3);
    const laneY = marginY + (sectorY + 0.5) * ((world.height - marginY * 2) / 3);
    const jitter = 90 + (bot.id % 130);
    const wave = this.tick * 0.07 + bot.id * 0.11;
    return {
      id: -3,
      pos: {
        x: laneX + Math.cos(wave) * jitter,
        y: laneY + Math.sin(wave * 0.85) * jitter,
      },
      vel: ZERO,
    };
  }

  private getThreatLevel(bot: TankLike, frame: SensorFrame): ThreatLevel {
    const hpRatio = this.getHpRatio(bot);
    if (frame.projectilePressure >= AI_TUNING.pressureFleeThreshold && hpRatio < 0.5) return 'PANIC';
    if (frame.closestHostile && hpRatio < 0.32 && Vector.distSq(bot.pos, frame.closestHostile.pos) < 520 * 520) return 'HIGH';
    if (frame.projectilePressure >= AI_TUNING.pressureCautionThreshold) return 'MEDIUM';
    if (frame.hostiles.length > 0) return 'LOW';
    return 'NONE';
  }

  private writeDebug(bot: TankLike, memory: BotMemory, frame: SensorFrame, result: ThinkResult, steering: Vector2): void {
    const target = result.target || result.combatTarget;
    const targetDir = target ? Vector.normalize(Vector.sub(target.pos, bot.pos)) : ZERO;
    const avoidDir = Vector.normalize(Vector.add(frame.safeDirection, this.computeFarmShapeAvoidanceForce(bot, frame.neighbors, result.state)));
    const dodgeDir = this.computeDodgeForce(bot, frame);

    const snapshot: AIDebugSnapshot = {
      botId: bot.id,
      state: result.state,
      archetype: memory.sessionArchetype,
      targetId: result.target ? result.target.id : null,
      shootTargetId: result.combatTarget ? result.combatTarget.id : null,
      reason: `${result.state}${target ? ` target=${target.id}` : ''}`,
      steering,
      projectilePressure: frame.projectilePressure,
      threatLevel: this.getThreatLevel(bot, frame),
      rays: [
        { origin: bot.pos, direction: targetDir, length: 95, color: 'GREEN', label: 'goal' },
        { origin: bot.pos, direction: avoidDir, length: 80, color: 'RED', label: 'avoid' },
        { origin: bot.pos, direction: Vector.normalize(dodgeDir), length: 80, color: 'ORANGE', label: 'dodge' },
        { origin: bot.pos, direction: Vector.normalize(steering), length: 110, color: 'CYAN', label: 'final' },
      ],
    };

    memory.debug = snapshot;
    this.debugSnapshots.set(bot.id, snapshot);
  }

  getDebugSnapshots(): AIDebugSnapshot[] {
    return Array.from(this.debugSnapshots.values());
  }

  cleanupCaches(activeEntities: Array<{ id: number; isDead?: boolean }>): void {
    const aliveIds = new Set<number>();

    for (let i = 0; i < activeEntities.length; i++) {
      const e = activeEntities[i];
      if (!e || e.isDead || typeof e.id !== 'number') continue;
      aliveIds.add(e.id);
    }

    for (const id of this.botMemory.keys()) {
      if (!aliveIds.has(id)) this.botMemory.delete(id);
    }

    for (const id of this.lastHealthSnapshot.keys()) {
      if (!aliveIds.has(id)) this.lastHealthSnapshot.delete(id);
    }

    for (const id of this.debugSnapshots.keys()) {
      if (!aliveIds.has(id)) this.debugSnapshots.delete(id);
    }
  }

  private computeInterposePoint(ally: any, threat: any): Vector2 {
    const allyPos = ally?.pos || ZERO;
    const threatPos = threat?.pos || ZERO;
    const threatVel = threat?.vel || ZERO;

    const projectedThreat = {
      x: threatPos.x + threatVel.x * 10,
      y: threatPos.y + threatVel.y * 10,
    };

    return {
      x: allyPos.x * 0.58 + projectedThreat.x * 0.42,
      y: allyPos.y * 0.58 + projectedThreat.y * 0.42,
    };
  }

  private estimateProjectilePressure(bot: TankLike, neighbors: any[], mode: GameMode): number {
    let pressure = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.type !== EntityType.BULLET) continue;
      if (this.isFriendly(bot, e, mode)) continue;

      const rel = Vector.sub(bot.pos, e.pos);
      const distanceSq = Math.max(1, Vector.magSq(rel));
      const vel = e.vel || ZERO;
      const movingTowardBot = rel.x * vel.x + rel.y * vel.y > 0;
      const towardWeight = movingTowardBot ? 1.0 : 0.35;

      pressure += (towardWeight / distanceSq) * 20000;
    }

    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || !this.isFarmTarget(e)) continue;
      const radius = typeof e.radius === 'number' ? e.radius : (e.type === EntityType.BOSS ? 72 : e.type === EntityType.CRASHER ? 24 : 18);
      const dangerRadius = bot.radius + radius + (e.type === EntityType.CRASHER ? 120 : e.type === EntityType.BOSS ? 150 : 80);
      const distanceSq = Vector.distSq(bot.pos, e.pos);
      if (distanceSq <= 0.0001 || distanceSq > dangerRadius * dangerRadius) continue;
      const hazardWeight = e.type === EntityType.CRASHER ? 0.5 : e.type === EntityType.BOSS ? 0.34 : 0.12;
      pressure += hazardWeight * ((dangerRadius * dangerRadius) / distanceSq) * 0.18;
    }

    return pressure;
  }

  private getOwnSpawnDispersionForce(pos: Vector2, team: Team, mode: GameMode, world: WorldInfo): Vector2 {
    if (mode !== GameMode.TEAMS || team === Team.NONE) return ZERO;

    const centerY = world.height * 0.5;
    const yDir = pos.y >= centerY ? 1 : -1;
    const safeEdge = world.baseZoneWidth * 0.9;

    if (team === Team.BLUE && pos.x < safeEdge) {
      const edgePush = Math.min(1.4, (safeEdge - pos.x) / Math.max(1, safeEdge));
      return Vector.normalize({ x: edgePush + 0.35, y: yDir * 0.35 });
    }

    if (team === Team.RED && pos.x > world.width - safeEdge) {
      const edgePush = Math.min(1.4, (pos.x - (world.width - safeEdge)) / Math.max(1, safeEdge));
      return Vector.normalize({ x: -(edgePush + 0.35), y: yDir * 0.35 });
    }

    return ZERO;
  }

  private pickTeamFightObjective(bot: TankLike, neighbors: any[], mode: GameMode, memory: BotMemory): any | null {
    if (mode !== GameMode.TEAMS || bot.team === Team.NONE) return null;

    if (memory.teamFightTargetId != null && this.tick <= memory.teamFightUntilTick) {
      const pinned = this.findAliveEntityById(neighbors, memory.teamFightTargetId);
      if (pinned && this.isTankLike(pinned) && !this.isFriendly(bot, pinned, mode)) return pinned;
    }

    let best: any = null;
    let bestScore = -Infinity;

    for (let i = 0; i < neighbors.length; i++) {
      const ally = neighbors[i];
      if (!this.isValidEntity(ally) || ally.id === bot.id || !this.isTankLike(ally)) continue;
      if (ally.team !== bot.team) continue;

      const allyHpRatio = this.getEntityHpRatio(ally);
      const allyDistSq = Vector.distSq(bot.pos, ally.pos);
      if (allyDistSq > AI_TUNING.teamFightJoinRadius * AI_TUNING.teamFightJoinRadius) continue;
      if (allyHpRatio > AI_TUNING.teamFightAllyHpThreshold && !this.wasRecentlyDamaged(ally.id, 10)) continue;

      const threat = this.findNearestThreatToAlly(bot, ally, neighbors, mode);
      if (!threat) continue;

      const threatDistSq = Vector.distSq(ally.pos, threat.pos);
      const urgency = (1 - allyHpRatio) + (this.wasRecentlyDamaged(ally.id, 10) ? 0.42 : 0);
      const score = urgency * 2.2 + this.classThreatScore(threat.classType) + 220000 / Math.max(1, threatDistSq);
      if (score > bestScore) {
        bestScore = score;
        best = threat;
      }
    }

    if (best) {
      memory.teamFightTargetId = best.id;
      memory.teamFightUntilTick = this.tick + AI_TUNING.teamFightFollowTicks;
    } else if (this.tick > memory.teamFightUntilTick) {
      memory.teamFightTargetId = null;
    }

    return best;
  }

  private getAlliedFocusWeight(bot: TankLike, target: any, neighbors: any[], mode: GameMode): number {
    if (mode !== GameMode.TEAMS || bot.team === Team.NONE) return 0;

    let pressure = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const ally = neighbors[i];
      if (!this.isValidEntity(ally) || ally.id === bot.id || !this.isTankLike(ally)) continue;
      if (ally.team !== bot.team) continue;

      const allyTargetId = typeof ally.aiTargetId === 'number' ? ally.aiTargetId : null;
      if (allyTargetId === target.id) pressure += 0.28;

      const allyDistSq = Vector.distSq(ally.pos, target.pos);
      if (allyDistSq < 420 * 420) pressure += 0.07;
    }

    return Math.min(1.05, pressure);
  }

  private countEnemyCoverAt(target: any, neighbors: any[], mode: GameMode, bot: TankLike): number {
    let count = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === target.id || !this.isTankLike(e)) continue;
      if (this.isFriendly(bot, e, mode)) continue;
      if (Vector.distSq(e.pos, target.pos) <= 380 * 380) count++;
    }
    return Math.min(3, count);
  }

  private getTargetRoutePenalty(bot: TankLike, target: any, neighbors: any[], mode: GameMode): number {
    const midpoint = {
      x: (bot.pos.x + target.pos.x) * 0.5,
      y: (bot.pos.y + target.pos.y) * 0.5,
    };
    let penalty = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === bot.id || e.id === target.id) continue;
      if (!this.isTankLike(e) || this.isFriendly(bot, e, mode)) continue;
      if (Vector.distSq(e.pos, midpoint) <= 280 * 280) penalty += 0.12;
    }
    return Math.min(0.72, penalty);
  }

  private pickRecentHostileTrail(bot: TankLike, memory: BotMemory): any | null {
    let best: RecentContact | null = null;
    let bestScore = -Infinity;
    for (const contact of memory.recentContacts.values()) {
      const age = this.tick - contact.lastSeenTick;
      if (age > 54) continue;
      const distanceSq = Vector.distSq(bot.pos, contact.lastKnownPos);
      const freshness = Math.max(0, 1 - age / 54);
      const score = freshness * 1.1 + (180000 / Math.max(1, distanceSq)) + Math.min(0.3, contact.timesTargeted * 0.05);
      if (score > bestScore) {
        bestScore = score;
        best = contact;
      }
    }

    if (!best) return null;
    const chaseLead = Math.max(0, Math.min(12, this.tick - best.lastSeenTick));
    return {
      id: best.id,
      type: EntityType.ENEMY,
      pos: {
        x: best.lastKnownPos.x + best.lastKnownVel.x * chaseLead * 0.75,
        y: best.lastKnownPos.y + best.lastKnownVel.y * chaseLead * 0.75,
      },
      vel: best.lastKnownVel,
    };
  }

  private getEnemySafeZonePenalty(bot: TankLike, targetPos: Vector2, mode: GameMode, world: WorldInfo): number {
    if (mode !== GameMode.TEAMS || bot.team === Team.NONE) return 0;
    let distIntoEnemyZone = 0;
    const enemyEdge = bot.team === Team.BLUE ? world.width - world.baseZoneWidth : world.baseZoneWidth;
    if (bot.team === Team.BLUE && targetPos.x > enemyEdge - SAFE_ZONE_WARNING_RADIUS) {
      distIntoEnemyZone = targetPos.x - (enemyEdge - SAFE_ZONE_WARNING_RADIUS);
    } else if (bot.team === Team.RED && targetPos.x < enemyEdge + SAFE_ZONE_WARNING_RADIUS) {
      distIntoEnemyZone = (enemyEdge + SAFE_ZONE_WARNING_RADIUS) - targetPos.x;
    }
    if (distIntoEnemyZone <= 0) return 0;
    return Math.min(0.92, (distIntoEnemyZone / Math.max(1, SAFE_ZONE_WARNING_RADIUS)) * 0.92);
  }

  private getFlankAffinity(bot: TankLike, target: any, memory: BotMemory): number {
    const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
    const desiredSide = { x: -toTarget.y * memory.strafeDir, y: toTarget.x * memory.strafeDir };
    const targetVel = Vector.magSq(target.vel || ZERO) > 0.0001 ? Vector.normalize(target.vel || ZERO) : ZERO;
    return Math.max(0, Vector.dot(desiredSide, targetVel)) * 0.18;
  }

  private canLikelyFinish(bot: TankLike, target: any): boolean {
    const damageStat = bot.stats[StatType.BULLET_DAMAGE] || 0;
    const reloadStat = bot.stats[StatType.RELOAD] || 0;
    const estimatedBurst = 22 + damageStat * 7.5 + reloadStat * 2.5;
    return (target.health || 0) <= estimatedBurst;
  }

  private getCrasherRiskPenalty(bot: TankLike, target: any): number {
    const hpRatio = this.getHpRatio(bot);
    const radius = typeof target.radius === 'number' ? target.radius : 20;
    if (hpRatio < 0.45) return 0.4;
    if (radius > 40 && hpRatio < 0.7) return 0.6;
    return 0.85;
  }

  private getFarmHazardPenalty(bot: TankLike, target: any, neighbors: any[]): number {
    let penalty = 1;
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || e.id === target.id || e.id === bot.id) continue;
      const d2 = Vector.distSq(e.pos, target.pos);
      const hostileTank =
        this.isTankLike(e) &&
        (bot.team === Team.NONE || e.team === Team.NONE || e.team !== bot.team);
      if (hostileTank && d2 <= 420 * 420) {
        penalty += 0.22;
      } else if (e.type === EntityType.CRASHER && d2 <= 250 * 250) {
        penalty += 0.16;
      } else if (e.type === EntityType.BOSS && d2 <= 340 * 340) {
        penalty += 0.28;
      }
    }
    return Math.min(2.2, penalty);
  }

  private isRareFarmTarget(e: any): boolean {
    if (!e || e.isDead) return false;
    if (e.type !== EntityType.SHAPE && e.type !== EntityType.BOSS) return false;

    const xp = typeof e.xpValue === 'number' ? e.xpValue : 0;
    const rarity = typeof e.rarity === 'string' ? e.rarity : '';
    const rareByRarity = RARE_RARITIES.has(rarity);
    const rareBySize = typeof e.radius === 'number' && e.radius >= 70;

    return e.type === EntityType.BOSS || xp >= AI_TUNING.rareShapeXpThreshold || rareByRarity || rareBySize || this.getRarityScore(e) >= 5;
  }

  private getRarityScore(e: any): number {
    const rarity = typeof e?.rarity === 'string' ? e.rarity : '';
    switch (rarity) {
      case 'Divine': return 9;
      case 'Godly': return 8;
      case 'Transcendent': return 7;
      case 'Eternal': return 6;
      case 'Mythical': return 5;
      case 'Legendary': return 4;
      case 'Epic': return 3;
      case 'Rare': return 2;
      case 'Uncommon': return 1;
      default: return 0;
    }
  }

  private isFarmTarget(e: any): boolean {
    return e?.type === EntityType.SHAPE || e?.type === EntityType.BOSS || e?.type === EntityType.CRASHER;
  }

  private isShootableTarget(e: any): boolean {
    return this.isTankLike(e) || this.isFarmTarget(e);
  }

  private isTankLike(e: any): boolean {
    return (
      e?.type === EntityType.PLAYER ||
      e?.type === EntityType.ENEMY ||
      e?.type === EntityType.ELITE_TANK ||
      e?.type === EntityType.GUARDIAN
    );
  }

  private isFriendly(bot: TankLike, entity: any, mode: GameMode): boolean {
    if (!entity || mode === GameMode.FFA) return false;
    return entity.team === bot.team && entity.team !== Team.NONE;
  }

  private isValidEntity(e: any): boolean {
    return !!e && !e.isDead && typeof e.id === 'number' && !!e.pos;
  }

  private findAliveEntityById(entities: any[], id: number): any | null {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e && !e.isDead && e.id === id) return e;
    }
    return null;
  }

  private getHpRatio(bot: TankLike): number {
    return bot.health / Math.max(1, bot.maxHealth);
  }

  private getEntityHpRatio(e: any): number {
    return (e.health || 1) / Math.max(1, e.maxHealth || 1);
  }

  private getWorldInfo(engine: EngineLike): WorldInfo {
    const width = engine.width || AI_TUNING.defaultWorldWidth;
    const height = engine.height || AI_TUNING.defaultWorldHeight;
    return {
      width,
      height,
      baseZoneWidth: engine.baseZoneWidth || BASE_ZONE_WIDTH,
      center: { x: width * 0.5, y: height * 0.5 },
    };
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  private deterministicNoise(id: number, tick: number): number {
    return Vector.seededRandom01((id * 1103515245) ^ (tick * 12345)) * 2 - 1;
  }

  private getArchetype(bot: TankLike): BotArchetype {
    if (this.isSupportClass(bot.classType)) return 'SUPPORT';
    if (this.isHeavySniperClass(bot.classType)) return 'SNIPER';
    if (this.isDroneClass(bot.classType)) return 'DRONE_COMMANDER';

    const r = bot.id % 10;
    if (r === 0) return 'FARMER';
    if (r === 1) return 'RUSHER';
    if (r === 2) return 'DUELIST';
    if (r === 3) return 'EXPLORER';
    if (r === 4) return 'SURVIVOR';
    if (r === 5) return 'BULLY';
    if (r === 6) return 'BOSS_HUNTER';
    if (r === 7) return 'SNIPER';
    if (r === 8) return 'DRONE_COMMANDER';
    return 'FARMER';
  }

  private getBehaviorPhase(bot: TankLike): 'PHASE_EARLY' | 'PHASE_MID' | 'PHASE_LATE' {
    const level = (bot as any).level ?? 1;
    if (level < 20) return 'PHASE_EARLY';
    if (level < 35) return 'PHASE_MID';
    return 'PHASE_LATE';
  }

  private applyPanicFleeOffset(base: Vector2, offset: number): Vector2 {
    const angle = Math.atan2(base.y, base.x) + offset;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  private updateSightMemory(bot: TankLike, neighbors: any[], memory: BotMemory): void {
    for (let i = 0; i < neighbors.length; i++) {
      const e = neighbors[i];
      if (!this.isValidEntity(e) || !this.isTankLike(e) || e.id === bot.id) continue;
      if (e.team === bot.team && e.team !== Team.NONE) continue;
      if (!memory.seenHostiles.has(e.id)) memory.seenHostiles.set(e.id, this.tick);
    }
  }

  private updateSquadAnchor(bot: TankLike, neighbors: any[], memory: BotMemory): void {
    memory.squadAnchor = null;
    memory.squadAnchorTick = 0;
  }

  private updateAssistUrgency(bot: TankLike, neighbors: any[], memory: BotMemory, mode: GameMode): void {
    if (mode === GameMode.FFA || bot.team === Team.NONE) return;
    for (let i = 0; i < neighbors.length; i++) {
      const ally = neighbors[i];
      if (!this.isValidEntity(ally) || !this.isTankLike(ally) || ally.id === bot.id || ally.team !== bot.team) continue;
      if (this.getEntityHpRatio(ally) > AI_TUNING.assistCriticalHpRatio) continue;
      const threat = this.findNearestThreatToAlly(bot, ally, neighbors, mode);
      if (threat) {
        memory.assistUrgencyUntilTick = Math.max(memory.assistUrgencyUntilTick, this.tick + AI_TUNING.assistUrgencyTicks);
      }
    }
  }

  private isShapeTargetCrowdedByAlly(bot: TankLike, shape: any, neighbors: any[]): boolean {
    for (let i = 0; i < neighbors.length; i++) {
      const ally = neighbors[i];
      if (!this.isValidEntity(ally) || !this.isTankLike(ally) || ally.id === bot.id || ally.team !== bot.team) continue;
      if (ally.aiTargetId === shape.id && Vector.distSq(ally.pos, shape.pos) < 360 * 360) return true;
    }
    return false;
  }

  private trackArchetypeReadability(bot: TankLike, memory: BotMemory, result: ThinkResult, neighbors: any[]): void {
    if (this.sessionStartTick <= 0) return;
    const elapsed = this.tick - this.sessionStartTick;
    const seconds = (elapsed / 60).toFixed(1);
    const hostileInView = neighbors.some((e) => this.isValidEntity(e) && this.isTankLike(e) && e.id !== bot.id && e.team !== bot.team);
    const supportTell =
      memory.sessionArchetype === 'SUPPORT' &&
      (result.state === AIState.BODYGUARD || (result.state === AIState.COMBAT && this.tick < memory.assistUrgencyUntilTick));
    const archetypeTell =
      (memory.sessionArchetype === 'RUSHER' && result.state === AIState.COMBAT && !!result.combatTarget) ||
      (memory.sessionArchetype === 'FARMER' && result.state === AIState.FARM && hostileInView) ||
      supportTell ||
      (memory.sessionArchetype === 'EXPLORER' && result.state === AIState.HUNT && !result.combatTarget);

    if (memory.firstTellLoggedTick < 0 && archetypeTell) {
      memory.firstTellLoggedTick = this.tick;
      console.info(`[AI-READ] t=${seconds}s bot=${bot.id} archetype=${memory.sessionArchetype} first_tell=${AIState[result.state]}`);
    }

    if (!memory.sameFeelLogged && elapsed >= AI_TUNING.sameFeelThresholdTicks && memory.firstTellLoggedTick < 0) {
      memory.sameFeelLogged = true;
      console.warn(`[AI-READ] t=${seconds}s bot=${bot.id} archetype=${memory.sessionArchetype} same_feel_candidate`);
    }

    if (supportTell) {
      console.info(`[AI-READ] t=${seconds}s bot=${bot.id} archetype=SUPPORT support_tell=${AIState[result.state]}`);
    }
  }
}

function memoryNeedsIntentPromote(memory: BotMemory, targetId: number, tick: number): boolean {
  if (memory.intentTargetId !== targetId) {
    memory.intentTargetId = targetId;
    memory.intentPromoteTick = tick + memory.intentDelayTicks;
    memory.targetLockUntilTick = tick + AI_TUNING.targetLockMinTicks;
    return true;
  }
  return tick < memory.intentPromoteTick;
}
