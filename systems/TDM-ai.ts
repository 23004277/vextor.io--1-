import { AIState, Team, TankClass, Vector2 } from '../types';
import * as Vector from '../services/MathUtils';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAITank } from '../services/EnemyAITanks';

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
  type?: 'PLAYER' | 'ENEMY' | 'BULLET';
  ownerId?: number;
};

type Squad = {
  id: number;
  team: Team;
  memberIds: number[];
  leaderId: number;
  centroid: Vector2;
  sharedTargetId: number | null;
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
  projectileHeatRadius: number;
  squadJoinRadius: number;
};

type SpatialBucket = {
  bots: IAITank[];
  players: Player[];
  bullets: Player[];
};

type BotSense = {
  allies: IAITank[];
  enemies: Player[];
  bullets: Player[];
  squad: Squad | null;
  pressure: number;
  enemyCountNear: number;
  allyCountNear: number;
};

const DEFAULT_CONFIG: FrameConfig = {
  worldWidth: 6000,
  worldHeight: 4000,
  mapCenter: { x: 3000, y: 2000 },
  chokePoint: { x: 3000, y: 2000 },
  safeZones: [
    { team: Team.BLUE, center: { x: 500, y: 2000 }, radius: 700 },
    { team: Team.RED, center: { x: 5500, y: 2000 }, radius: 700 },
  ],
  projectileHeatRadius: 440,
  squadJoinRadius: 520,
};

export class TDMAISystem {
  private readonly movement = new MovementSystem();
  private readonly hash = new Map<string, SpatialBucket>();
  private readonly squadByMember = new Map<number, Squad>();
  private config: FrameConfig = { ...DEFAULT_CONFIG };
  private currentTick = 0;
  private readonly cellSize = 360;
  private readonly maxSteering = 4.5;

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
    this.currentTick = tick;
    this.rebuildSpatialHash(bots, players);
    const squads = this.buildSquads(bots);
    this.assignSquadTargets(squads, players);

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (!bot || bot.isDead || bot.team === Team.NONE) continue;
      this.updateSingleBot(bot, players);
    }
  }

  private updateSingleBot(bot: IAITank, players: Player[]): void {
    const sense = this.senseBot(bot);
    const hpRatio = bot.health / Math.max(1, bot.maxHealth);
    const outnumbered = sense.enemyCountNear > sense.allyCountNear + 1;
    const shouldRetreat = hpRatio < 0.3 || (outnumbered && hpRatio < 0.55);
    const sharedTarget = this.resolveSharedTarget(bot, sense, players);

    let targetPos: Vector2 = this.config.chokePoint;
    let state: AIState = AIState.HUNT;

    if (shouldRetreat) {
      state = AIState.RETURNING;
      targetPos = this.getSafeZoneCenter(bot.team);
    } else if (sharedTarget) {
      state = AIState.COMBAT;
      targetPos = this.computeCombatAimPoint(bot, sharedTarget);
    } else {
      state = AIState.BASE_DEFENSE;
      targetPos = this.computeChokeHoldPoint(bot, sense.squad);
    }

    // Team role synergy.
    if (!shouldRetreat && sense.squad) {
      if (this.isSupport(bot.classType)) {
        const leader = sense.squad.memberIds.find((id) => id === sense.squad!.leaderId);
        if (leader != null) {
          const leaderBot = this.findBotById(leader);
          if (leaderBot) targetPos = this.computeSupportAnchor(leaderBot, sense.squad.centroid);
        }
      } else if (this.isFarmer(bot.classType)) {
        const leaderBot = this.findBotById(sense.squad.leaderId);
        if (leaderBot) targetPos = this.computeFarmerRear(leaderBot);
      }
    }

    const goal = shouldRetreat
      ? this.movement.arriveForce(bot.pos, targetPos, 340)
      : this.movement.seekForce(bot.pos, targetPos);

    const alliesLite = sense.allies.map((a) => ({ pos: a.pos }));
    const allyVels = sense.allies.map((a) => a.vel);
    const sep = this.movement.separationForce(bot.pos, alliesLite, 180);
    const align = this.movement.alignmentForce(bot.vel, allyVels);
    const coh = sense.squad ? this.movement.cohesionForce(bot.pos, alliesLite, 560) : { x: 0, y: 0 };

    const heatAvoid = this.computeHeatAvoidance(bot, sense.bullets, sense.enemies, shouldRetreat);
    const bounds = this.movement.boundaryAvoidanceForce(
      bot.pos,
      bot.vel,
      this.config.worldWidth,
      this.config.worldHeight,
      220,
      120
    );

    let steering = { x: 0, y: 0 };
    steering = this.movement.blendSteering(steering, goal, shouldRetreat ? 1.25 : 1.05);
    steering = this.movement.blendSteering(steering, sep, 1.45);
    steering = this.movement.blendSteering(steering, align, shouldRetreat ? 0.22 : 0.34);
    steering = this.movement.blendSteering(steering, coh, shouldRetreat ? 0.18 : 0.44);
    steering = this.movement.blendSteering(steering, heatAvoid, shouldRetreat ? 1.2 : 1.0);
    steering = this.movement.blendSteering(steering, bounds, 1.15);

    bot.lastSteering = Vector.limit(steering, this.maxSteering);
    bot.aiState = state;
    bot.aiTargetId = sharedTarget ? sharedTarget.id : null;
    bot.aiShooting = state === AIState.COMBAT && !!sharedTarget;
    if (sharedTarget) {
      bot.aiTargetRot = Math.atan2(sharedTarget.pos.y - bot.pos.y, sharedTarget.pos.x - bot.pos.x);
    }
  }

  private resolveSharedTarget(bot: IAITank, sense: BotSense, players: Player[]): Player | null {
    if (sense.squad?.sharedTargetId != null) {
      const shared = players.find((p) => p.id === sense.squad!.sharedTargetId && !p.isDead);
      if (shared) return shared;
    }

    if (sense.enemies.length <= 0) return null;
    let best: Player | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < sense.enemies.length; i++) {
      const e = sense.enemies[i];
      const d2 = Math.max(1, Vector.distSq(bot.pos, e.pos));
      const hpRatio = (e.health ?? 100) / Math.max(1, e.maxHealth ?? 100);
      const focusBonus = e.aiTargetId === bot.id ? 0.45 : 0;
      const lowHpBonus = hpRatio < 0.5 ? (1 - hpRatio) * 0.7 : 0;
      const score = 900000 / d2 + lowHpBonus + focusBonus;
      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }
    return best;
  }

  private computeCombatAimPoint(bot: IAITank, enemy: Player): Vector2 {
    if (this.isRusher(bot.classType) || this.isExplorer(bot.classType)) {
      const toEnemy = Vector.sub(enemy.pos, bot.pos);
      const dist = Math.max(1, Math.sqrt(Vector.magSq(toEnemy)));
      const approxBulletSpeed = 5 + (bot.stats?.reload ?? 0) * 0.1 + (bot.stats?.['Bullet Speed' as any] ?? 0) * 0.4;
      const predictT = Math.min(0.85, dist / Math.max(8, approxBulletSpeed * 56));
      return {
        x: enemy.pos.x + enemy.vel.x * predictT * 60,
        y: enemy.pos.y + enemy.vel.y * predictT * 60,
      };
    }
    return enemy.pos;
  }

  private computeSupportAnchor(leader: IAITank, squadCentroid: Vector2): Vector2 {
    const back = Vector.normalize(Vector.sub(squadCentroid, leader.pos));
    return {
      x: leader.pos.x + back.x * 140,
      y: leader.pos.y + back.y * 140,
    };
  }

  private computeFarmerRear(leader: IAITank): Vector2 {
    const retreat = Vector.normalize({ x: -leader.vel.x || -1, y: -leader.vel.y || 0 });
    return {
      x: leader.pos.x + retreat.x * 220,
      y: leader.pos.y + retreat.y * 220,
    };
  }

  private computeChokeHoldPoint(bot: IAITank, squad: Squad | null): Vector2 {
    const base = this.config.chokePoint;
    if (!squad) return base;
    const seed = ((bot.id * 73856093) ^ (this.currentTick * 19349663)) & 1023;
    const angle = (seed / 1023) * Math.PI * 2;
    const radius = 120 + (bot.id % 3) * 56;
    return {
      x: base.x + Math.cos(angle) * radius,
      y: base.y + Math.sin(angle) * radius,
    };
  }

  private computeHeatAvoidance(bot: IAITank, bullets: Player[], enemies: Player[], retreating: boolean): Vector2 {
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const dx = bot.pos.x - b.pos.x;
      const dy = bot.pos.y - b.pos.y;
      const d2 = Math.max(1, dx * dx + dy * dy);
      if (d2 > this.config.projectileHeatRadius * this.config.projectileHeatRadius) continue;
      fx += (dx / d2) * 18000;
      fy += (dy / d2) * 18000;
    }

    // Enemy concentration heat.
    let ex = 0;
    let ey = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const dx = bot.pos.x - e.pos.x;
      const dy = bot.pos.y - e.pos.y;
      const d2 = Math.max(1, dx * dx + dy * dy);
      ex += dx / d2;
      ey += dy / d2;
    }
    const enemyHeat = enemies.length > 0 ? Vector.normalize({ x: ex, y: ey }) : { x: 0, y: 0 };
    const bulletHeat = Math.abs(fx) + Math.abs(fy) > 0.0001 ? Vector.normalize({ x: fx, y: fy }) : { x: 0, y: 0 };

    const heat = this.movement.composeSteering(
      [bulletHeat, enemyHeat],
      [1.0, retreating ? 1.15 : 0.62],
      1.35
    );
    return heat;
  }

  private senseBot(bot: IAITank): BotSense {
    const nearby = this.queryCells(bot.pos, 900);
    const allies: IAITank[] = [];
    const enemies: Player[] = [];
    const bullets: Player[] = [];

    for (let i = 0; i < nearby.bots.length; i++) {
      const other = nearby.bots[i];
      if (!other || other.id === bot.id || other.isDead) continue;
      if (other.team === bot.team) allies.push(other);
      else {
        enemies.push({
          id: other.id,
          pos: other.pos,
          vel: other.vel,
          team: other.team,
          isDead: other.isDead,
          health: other.health,
          maxHealth: other.maxHealth,
          aiTargetId: other.aiTargetId,
          type: 'ENEMY',
        });
      }
    }

    for (let i = 0; i < nearby.players.length; i++) {
      const p = nearby.players[i];
      if (!p || p.id === bot.id || p.isDead || p.type === 'BULLET') continue;
      if (p.team !== bot.team) enemies.push(p);
    }

    for (let i = 0; i < nearby.bullets.length; i++) {
      const b = nearby.bullets[i];
      if (!b || b.team === bot.team) continue;
      bullets.push(b);
    }

    const pressure = this.computePressure(bot.pos, bullets, enemies);
    const squad = this.squadByMember.get(bot.id) ?? null;

    return {
      allies,
      enemies,
      bullets,
      squad,
      pressure,
      enemyCountNear: enemies.length,
      allyCountNear: allies.length,
    };
  }

  private computePressure(pos: Vector2, bullets: Player[], enemies: Player[]): number {
    let pressure = 0;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const d2 = Math.max(1, Vector.distSq(pos, b.pos));
      pressure += 18000 / d2;
    }
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const d2 = Math.max(1, Vector.distSq(pos, e.pos));
      pressure += 140000 / d2;
    }
    return pressure;
  }

  private rebuildSpatialHash(bots: IAITank[], players: Player[]): void {
    this.hash.clear();
    this.squadByMember.clear();

    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (!b || b.isDead) continue;
      const key = this.keyFor(b.pos);
      const bucket = this.getOrCreateBucket(key);
      bucket.bots.push(b);
    }
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p || p.isDead) continue;
      const key = this.keyFor(p.pos);
      const bucket = this.getOrCreateBucket(key);
      if (p.type === 'BULLET') bucket.bullets.push(p);
      else bucket.players.push(p);
    }
  }

  private buildSquads(bots: IAITank[]): Squad[] {
    const squads: Squad[] = [];
    const visited = new Set<number>();

    for (let i = 0; i < bots.length; i++) {
      const seed = bots[i];
      if (!seed || seed.isDead || seed.team === Team.NONE || visited.has(seed.id)) continue;

      const members: IAITank[] = [];
      const queue: IAITank[] = [seed];
      visited.add(seed.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        members.push(current);

        const nearby = this.queryCells(current.pos, this.config.squadJoinRadius).bots;
        for (let j = 0; j < nearby.length; j++) {
          const next = nearby[j];
          if (!next || next.isDead || next.team !== seed.team || visited.has(next.id)) continue;
          if (Vector.distSq(current.pos, next.pos) > this.config.squadJoinRadius * this.config.squadJoinRadius) continue;
          visited.add(next.id);
          queue.push(next);
        }
      }

      const centroid = this.computeCentroid(members);
      const leader = this.pickSquadLeader(members);
      const squad: Squad = {
        id: squads.length + 1,
        team: seed.team,
        memberIds: members.map((m) => m.id),
        leaderId: leader.id,
        centroid,
        sharedTargetId: null,
      };
      squads.push(squad);
      for (let j = 0; j < members.length; j++) this.squadByMember.set(members[j].id, squad);
    }

    return squads;
  }

  private assignSquadTargets(squads: Squad[], players: Player[]): void {
    for (let i = 0; i < squads.length; i++) {
      const squad = squads[i];
      const hostile = players.filter(
        (p) =>
          !p.isDead &&
          p.type !== 'BULLET' &&
          p.team !== squad.team &&
          Vector.distSq(p.pos, squad.centroid) < 1200 * 1200
      );

      const focused = this.pickFocusedTargetFromMembers(squad);
      if (focused != null) {
        squad.sharedTargetId = focused;
        continue;
      }

      if (hostile.length <= 0) {
        squad.sharedTargetId = null;
        continue;
      }

      let best = hostile[0];
      let bestScore = -Infinity;
      for (let j = 0; j < hostile.length; j++) {
        const h = hostile[j];
        const d2 = Math.max(1, Vector.distSq(h.pos, squad.centroid));
        const hp = (h.health ?? 100) / Math.max(1, h.maxHealth ?? 100);
        const score = 700000 / d2 + (hp < 0.55 ? (1 - hp) * 0.75 : 0);
        if (score > bestScore) {
          best = h;
          bestScore = score;
        }
      }
      squad.sharedTargetId = best.id;
    }
  }

  private pickFocusedTargetFromMembers(squad: Squad): number | null {
    const counts = new Map<number, number>();
    for (let i = 0; i < squad.memberIds.length; i++) {
      const bot = this.findBotById(squad.memberIds[i]);
      if (!bot || bot.aiState !== AIState.COMBAT || bot.aiTargetId == null) continue;
      counts.set(bot.aiTargetId, (counts.get(bot.aiTargetId) ?? 0) + 1);
    }
    let bestTarget: number | null = null;
    let bestCount = 0;
    for (const [targetId, count] of counts.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestTarget = targetId;
      }
    }
    return bestTarget;
  }

  private pickSquadLeader(members: IAITank[]): IAITank {
    let leader = members[0];
    let best = this.getBotPower(leader);
    for (let i = 1; i < members.length; i++) {
      const candidate = members[i];
      const power = this.getBotPower(candidate);
      if (power > best) {
        best = power;
        leader = candidate;
      }
    }
    return leader;
  }

  private getBotPower(bot: IAITank): number {
    const level = (bot as unknown as { level?: number }).level ?? 1;
    const score = (bot as unknown as { score?: number }).score ?? 0;
    return level * 100000 + score;
  }

  private computeCentroid(members: IAITank[]): Vector2 {
    if (members.length === 0) return this.config.mapCenter;
    let x = 0;
    let y = 0;
    for (let i = 0; i < members.length; i++) {
      x += members[i].pos.x;
      y += members[i].pos.y;
    }
    return { x: x / members.length, y: y / members.length };
  }

  private queryCells(pos: Vector2, radius: number): SpatialBucket {
    const minX = Math.floor((pos.x - radius) / this.cellSize);
    const maxX = Math.floor((pos.x + radius) / this.cellSize);
    const minY = Math.floor((pos.y - radius) / this.cellSize);
    const maxY = Math.floor((pos.y + radius) / this.cellSize);

    const out: SpatialBucket = { bots: [], players: [], bullets: [] };
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const bucket = this.hash.get(`${gx},${gy}`);
        if (!bucket) continue;
        out.bots.push(...bucket.bots);
        out.players.push(...bucket.players);
        out.bullets.push(...bucket.bullets);
      }
    }
    return out;
  }

  private keyFor(pos: Vector2): string {
    return `${Math.floor(pos.x / this.cellSize)},${Math.floor(pos.y / this.cellSize)}`;
  }

  private getOrCreateBucket(key: string): SpatialBucket {
    let bucket = this.hash.get(key);
    if (bucket) return bucket;
    bucket = { bots: [], players: [], bullets: [] };
    this.hash.set(key, bucket);
    return bucket;
  }

  private getSafeZoneCenter(team: Team): Vector2 {
    const zone = this.config.safeZones.find((z) => z.team === team);
    return zone ? zone.center : this.config.mapCenter;
  }

  private findBotById(id: number): IAITank | null {
    for (const bucket of this.hash.values()) {
      for (let i = 0; i < bucket.bots.length; i++) {
        if (bucket.bots[i].id === id) return bucket.bots[i];
      }
    }
    return null;
  }

  private isSupport(cls: TankClass): boolean {
    return cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR;
  }

  private isFarmer(cls: TankClass): boolean {
    return cls === TankClass.PACIFIST_TRAINEE || cls === TankClass.MACHINE_GUN;
  }

  private isRusher(cls: TankClass): boolean {
    return cls === TankClass.BOOSTER || cls === TankClass.FIGHTER || cls === TankClass.TRI_ANGLE || cls === TankClass.SPRAYER;
  }

  private isExplorer(cls: TankClass): boolean {
    return cls === TankClass.FLANK_GUARD || cls === TankClass.TWIN_FLANK || cls === TankClass.OVERSEER;
  }
}
