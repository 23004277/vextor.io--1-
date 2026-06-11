import { Vector2, EntityType, TankClass, StatType, GameMode, Team, AIState } from '../types';
import * as Vector from './MathUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, BASE_STATS } from '../constants';

// Interfaces to avoid circular dependencies with GameEngine
export interface IAITank {
    id: number;
    pos: Vector2;
    vel: Vector2;
    rotation: number;
    chassisRotation?: number;
    health: number;
    maxHealth: number;
    team: Team;
    classType: TankClass;
    stats: Record<StatType, number>;
    visionRange: number;
    aiUpdateTimer: number;
    aiState: AIState;
    lastSteering: Vector2;
    availableStatPoints: number;
    isDead: boolean;
    radius?: number;
    aiTargetId: number | null;
    aiHuntingSpecialId?: number | null;
    aiHuntingTimer?: number;
    aiTargetRot: number;
    aiShooting: boolean;
    idleDir: Vector2 | null;
    strafeDir?: number;
    healingHistory?: { time: number; amount: number }[];
    totalHealedThisSession?: number;

    // Advanced sentient AI attributes
    patrolTarget?: Vector2 | null;
    patrolTimer?: number;
    retreatTimer?: number;
    scanTimer?: number;
    scanAngleOffset?: number;
    lastCombatTime?: number;
    strafeChangeTimer?: number;
    curiousTargetId?: number | null;
    curiousTimer?: number;
    socialScanCooldown?: number;
    socialAnchorId?: number | null;
    socialGestureUntil?: number;
    socialWiggleUntil?: number;
    savedByPlayerUntil?: number;
    lastAimTargetId?: number | null;
}

export interface IGameEngine {
    entities: any[];
    spatialGrid: { query: (pos: Vector2, radius: number) => any[] };
    gameMode: GameMode;
    inVoid: boolean;
    getInterceptPoint: (pos: Vector2, speed: number, targetPos: Vector2, targetVel: Vector2) => Vector2;
    attemptShoot: (tank: any) => void;
    applyTankMovement: (tank: any, steering: Vector2) => void;
    upgradeStat: (tank: any, stat: StatType) => void;
    player?: any;
    getNowMs?: () => number;
    getSimTimeMs?: () => number;
}

export class EnemyAITanks {
    private static readonly ALLOW_PLAYER_DRIVEN_SOCIAL = false;
    static isPacifist(classType: TankClass): boolean {
        return classType === TankClass.PACIFIST_TRAINEE || 
               classType === TankClass.NURSE || 
               classType === TankClass.DOCTOR || 
               classType === TankClass.PLAGUE_DOCTOR;
    }

    static isMalignant(classType: TankClass): boolean {
        return classType === TankClass.DRAINER_TRAINEE || 
               classType === TankClass.LEECH || 
               classType === TankClass.VAMPIRE || 
               classType === TankClass.REAPER;
    }

    /**
     * Main AI update loop for enemy tanks.
     * Remastered for Context Steering and Tactical Intelligence.
     */
    static update(bot: IAITank, engine: IGameEngine, dt: number, botStatPriorities: Record<TankClass, StatType[]>) {
        if (!bot || bot.isDead) return;
        this.ensureLegacyDefaults(bot, engine);

        // Apply movement using saved steering vector
        engine.applyTankMovement(bot, bot.lastSteering);
        
        // Turn turret smoothly towards target angle
        this.applySmoothRotation(bot, dt);
        
        // Auto shooting handler based on aim alignment
        this.handleAutoShooting(bot, engine);

        // De-sync AI ticking, updating strategic plan every 100-200ms
        bot.aiUpdateTimer -= dt;
        if (bot.aiUpdateTimer > 0) return;
        const tickSeed = Math.floor(this.nowMs(engine) / Math.max(1, dt * 1000));
        const stagger = this.seeded01((bot.id * 73856093) ^ (tickSeed * 19349663));
        bot.aiUpdateTimer = 0.08 + stagger * 0.08; // 80-160ms strategic planning cadence

        const hpRatio = bot.health / bot.maxHealth;
        const vision = bot.visionRange;
        const neighbors = engine.spatialGrid.query(bot.pos, vision);
        
        // 1. Tactical Analyzer
        const data = this.analyzeTacticalEnvironment(bot, neighbors, engine);
        
        // Update Hunting Objectives
        if (bot.aiHuntingSpecialId) {
            const hunterTarget = engine.entities.find(e => e.id === bot.aiHuntingSpecialId);
            if (!hunterTarget || hunterTarget.isDead || (bot.aiHuntingTimer && bot.aiHuntingTimer <= 0)) {
                bot.aiHuntingSpecialId = null;
                bot.aiHuntingTimer = 0;
            } else if (bot.aiHuntingTimer) {
                bot.aiHuntingTimer -= dt * 1000;
            }
        }

        // 2. State Controller
        let nextState: AIState = AIState.IDLE;

        if (hpRatio < 0.38 && data.threats.length > 0) {
            nextState = AIState.FLEE;
        } else if (data.enemies.length > 0) {
            nextState = AIState.COMBAT;
        } else if (bot.aiHuntingSpecialId) {
            nextState = AIState.HUNT;
        } else if (data.shapes.length > 0) {
            nextState = AIState.FARM;
        } else {
            nextState = AIState.IDLE;
        }

        // Social behaviors only when not in danger/combat.
        if (this.ALLOW_PLAYER_DRIVEN_SOCIAL && (nextState === AIState.IDLE || nextState === AIState.FARM)) {
            nextState = this.resolveSocialState(bot, data, engine, nextState);
        }

        bot.aiState = nextState;

        // 3. Target Allocator
        let target = null;
        if (nextState === AIState.FLEE) {
            // Focus on closest threat to fire defensively backwards while escaping
            target = this.selectTacticalTarget(bot, data, true); 
        } else if (nextState === AIState.COMBAT || nextState === AIState.BODYGUARD) {
            target = this.selectTacticalTarget(bot, data, false);
        } else if (nextState === AIState.FARM) {
            target = this.selectFarmTarget(bot, data);
        } else if (nextState === AIState.HUNT) {
            target = engine.entities.find(e => e.id === bot.aiHuntingSpecialId);
        }
        
        bot.aiTargetId = target ? target.id : null;

        // 4. Calculate Movement Vector (Context Steering)
        const steering = this.calculateContextSteering(bot, target, data, engine);

        // 5. Upgrade Build Stats
        this.handleStatUpgrades(bot, engine, botStatPriorities);

        bot.lastSteering = Vector.limit(steering, 4.5);
    }

    private static analyzeTacticalEnvironment(bot: IAITank, neighbors: any[], engine: IGameEngine) {
        const enemies: any[] = [];
        const shapes: any[] = [];
        const bullets: any[] = [];
        const teammates: any[] = [];
        const threats: any[] = []; // Immediate close hazards
        let enemyPressure = 0;

        for (const e of neighbors) {
            if (e.id === bot.id || e.isDead) continue;
            const d = Vector.dist(bot.pos, e.pos);

            // Categorize hostiles / projectiles
            if (e.type === EntityType.BULLET && (engine.gameMode === GameMode.FFA || e.team !== bot.team)) {
                bullets.push(e);
                continue;
            }

            if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK || e.type === EntityType.GUARDIAN) {
                if (engine.gameMode === GameMode.FFA || e.team !== bot.team) {
                    enemies.push(e);
                    if (d < 450) threats.push(e);
                    enemyPressure += Math.max(0, 1 - d / 900);
                } else {
                    teammates.push(e);
                }
            } else if (e.type === EntityType.SHAPE || e.type === EntityType.BOSS || e.type === EntityType.CRASHER) {
                shapes.push(e);
                if (e.type === EntityType.CRASHER && d < 350) {
                    enemies.push(e); // treat aggressive crashers as combatants
                    threats.push(e);
                    enemyPressure += Math.max(0, 1 - d / 700);
                }
            }
        }

        return { enemies, shapes, bullets, teammates, threats, enemyPressure };
    }

    private static selectTacticalTarget(bot: IAITank, data: any, nearestOnly: boolean = false) {
        if (data.enemies.length === 0) return null;
        if (nearestOnly) {
            let nearest = null;
            let minDist = Infinity;
            for (const e of data.enemies) {
                const d = Vector.dist(bot.pos, e.pos);
                if (d < minDist) {
                    minDist = d;
                    nearest = e;
                }
            }
            return nearest;
        }

        let bestTarget = null;
        let bestScore = -Infinity;

        for (const e of data.enemies) {
            const dist = Vector.dist(bot.pos, e.pos);
            const hpRatio = Math.max(0, Math.min(1, e.health / Math.max(1, e.maxHealth)));

            let score = 1400 / (dist + 70);
            score += (1 - hpRatio) * 190;
            if (e.aiTargetId === bot.id) score += 75; // repel direct attackers
            else if (e.aiTargetId != null) score += 28; // join focused fire
            if (this.isPacifist(e.classType)) score += 28;
            if (e.type === EntityType.PLAYER) score += 22;
            if (e.type === EntityType.BOSS) score += 90;
            if (e.type === EntityType.CRASHER) score += 45;
            if (dist > 880) score *= 0.72; // avoid chasing too far for weak bots

            // Favor targets that are already engaged by allies to make bot behavior coherent
            if (e.aiTargetId != null && e.aiTargetId !== bot.id) score *= 1.15;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = e;
            }
        }
        return bestTarget;
    }

    private static selectFarmTarget(bot: IAITank, data: any) {
        if (data.shapes.length === 0) return null;
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const s of data.shapes) {
            const dist = Vector.dist(bot.pos, s.pos);
            let score = 520 / (dist + 18);

            if (s.type === EntityType.BOSS) {
                score *= 3.0;
            } else if (s.shapeType === 'ALPHA_PENTAGON') {
                score *= 2.2;
            } else if (s.shapeType === 'BETA_PENTAGON') {
                score *= 1.9;
            } else if (s.shapeType === 'DODECAGON') {
                score *= 3.3;
            } else if (s.shapeType === 'DECAGON') {
                score *= 2.9;
            } else if (s.shapeType === 'NONAGON') {
                score *= 2.55;
            } else if (s.shapeType === 'OCTAGON') {
                score *= 2.25;
            } else if (s.shapeType === 'STAR') {
                score *= 1.28;
            } else if (s.shapeType === 'PENTAGON') {
                score *= 1.45;
            }

            const nearbyAllies = data.teammates.filter((t: any) => Vector.dist(t.pos, s.pos) < 220).length;
            score *= 1 - Math.min(0.42, nearbyAllies * 0.11);

            const nearestEnemyDist = data.enemies.reduce((min: number, e: any) => {
                const d = Vector.dist(e.pos, s.pos);
                return d < min ? d : min;
            }, Infinity);
            if (nearestEnemyDist < 260) score *= 0.62;
            if (nearestEnemyDist < 180) score *= 0.48;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = s;
            }
        }
        return bestTarget;
    }

    private static chooseExploreAnchor(bot: IAITank, data: any, engine: IGameEngine): Vector2 {
        const safeMargin = 320;
        const inBounds = (pos: Vector2) => ({
            x: Math.max(safeMargin, Math.min(CANVAS_WIDTH - safeMargin, pos.x)),
            y: Math.max(safeMargin, Math.min(CANVAS_HEIGHT - safeMargin, pos.y)),
        });

        if (engine.gameMode === GameMode.TEAMS && bot.team !== Team.NONE && data.teammates.length > 0) {
            const allyCenter = data.teammates.reduce((sum: Vector2, t: any) => ({ x: sum.x + t.pos.x, y: sum.y + t.pos.y }), { x: 0, y: 0 });
            const allyAvg = { x: allyCenter.x / data.teammates.length, y: allyCenter.y / data.teammates.length };
            const enemyCenter = data.enemies.length > 0
                ? data.enemies.reduce((sum: Vector2, e: any) => ({ x: sum.x + e.pos.x, y: sum.y + e.pos.y }), { x: 0, y: 0 })
                : { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
            const enemyAvg = data.enemies.length > 0
                ? { x: enemyCenter.x / data.enemies.length, y: enemyCenter.y / data.enemies.length }
                : { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

            const pushAnchor = {
                x: (allyAvg.x + enemyAvg.x) * 0.5 + Vector.randomRange(-180, 180),
                y: (allyAvg.y + enemyAvg.y) * 0.5 + Vector.randomRange(-120, 120),
            };
            return inBounds(pushAnchor);
        }

        if (data.shapes.length > 0) {
            let best = null;
            let bestValue = -Infinity;
            for (const s of data.shapes) {
                const dist = Vector.dist(bot.pos, s.pos);
                let value = 1200 / (dist + 40);
                if (s.type === EntityType.BOSS) value += 180;
                if (s.shapeType === 'ALPHA_PENTAGON') value += 82;
                if (s.shapeType === 'BETA_PENTAGON') value += 56;
                if (s.shapeType === 'DODECAGON') value += 150;
                if (s.shapeType === 'DECAGON') value += 128;
                if (s.shapeType === 'NONAGON') value += 104;
                if (s.shapeType === 'OCTAGON') value += 90;
                if (s.shapeType === 'STAR') value += 34;
                const nearestEnemyDist = data.enemies.reduce((min: number, e: any) => {
                    const d = Vector.dist(e.pos, s.pos);
                    return d < min ? d : min;
                }, Infinity);
                if (nearestEnemyDist < 260) value -= 120;
                if (!best || value > bestValue) {
                    bestValue = value;
                    best = s;
                }
            }
            if (best) {
                return inBounds({ x: best.pos.x + Vector.randomRange(-160, 160), y: best.pos.y + Vector.randomRange(-160, 160) });
            }
        }

        const forwardPoint = data.enemyPressure > 1.25
            ? { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }
            : { x: Vector.randomRange(safeMargin, CANVAS_WIDTH - safeMargin), y: Vector.randomRange(safeMargin, CANVAS_HEIGHT - safeMargin) };
        return inBounds(forwardPoint);
    }

    private static resolveSocialState(bot: IAITank, data: any, engine: IGameEngine, fallback: AIState): AIState {
        if (engine.gameMode !== GameMode.TEAMS || bot.team === Team.NONE) return fallback;

        const now = this.nowMs(engine);
        const player = engine.player;
        if (!player || player.isDead || player.team !== bot.team) return fallback;

        // Throttled social scan to keep CPU costs low with large bot counts.
        bot.socialScanCooldown = (bot.socialScanCooldown ?? (5 + Math.floor(Math.random() * 6))) - 1;
        if (bot.socialScanCooldown > 0) return fallback;
        bot.socialScanCooldown = 5 + Math.floor(Math.random() * 6);

        const distToPlayer = Vector.dist(bot.pos, player.pos);
        const nearThreat = data.enemies.some((e: any) => Vector.dist(e.pos, player.pos) < 380);
        const heavyProtector = bot.classType === TankClass.COLOSSAL || bot.classType === TankClass.WARLORD || bot.classType === TankClass.LEVIATHAN || bot.classType === TankClass.DESTROYER || bot.classType === TankClass.ANNIHILATOR;

        if (!nearThreat && player.socialSpinSignalUntil && player.socialSpinSignalUntil > now && distToPlayer < 300) {
            bot.socialGestureUntil = now + 1000;
            bot.socialAnchorId = player.id;
            return AIState.GREETING;
        }

        if ((player.health / Math.max(1, player.maxHealth)) < 0.36 && nearThreat && heavyProtector && distToPlayer < 560) {
            bot.socialAnchorId = player.id;
            return AIState.BODYGUARD;
        }

        if (bot.savedByPlayerUntil && bot.savedByPlayerUntil > now && distToPlayer < 500) {
            bot.socialWiggleUntil = now + 800;
            return AIState.GREETING;
        }

        const escortClass = bot.classType === TankClass.BASIC || bot.classType === TankClass.TWIN || bot.classType === TankClass.MACHINE_GUN || bot.classType === TankClass.GUNNER || bot.classType === TankClass.AUTO_GUNNER || bot.classType === TankClass.NURSE || bot.classType === TankClass.DOCTOR;
        if (!nearThreat && escortClass && distToPlayer < 420) {
            bot.socialAnchorId = player.id;
            return AIState.ESCORT;
        }

        return fallback;
    }

    private static calculateContextSteering(bot: IAITank, target: any, data: any, engine: IGameEngine): Vector2 {
        const numRays = 16; // Upgraded to 16 directions for smoother sensory analysis
        const rays: Vector2[] = [];
        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            rays.push(Vector.fromAngle(angle));
        }

        const interests = new Array(numRays).fill(0);
        const dangers = new Array(numRays).fill(0);

        // Setup custom dynamic properties smoothly
        if (bot.scanTimer === undefined) bot.scanTimer = Math.random() * 1000;
        if (bot.scanAngleOffset === undefined) bot.scanAngleOffset = 0;
        if (bot.strafeDir === undefined) bot.strafeDir = Math.random() < 0.5 ? 1 : -1;
        if (bot.strafeChangeTimer === undefined) bot.strafeChangeTimer = Math.random() * 5.0;

        // Progress strafe directional shifts
        bot.strafeChangeTimer -= 0.1;
        if (bot.strafeChangeTimer <= 0) {
            bot.strafeDir = Math.random() < 0.5 ? 1 : -1;
            bot.strafeChangeTimer = 3.0 + Math.random() * 5.0; // Dynamic strafing oscillation
        }

        // --- INTEREST MAP MODELING ---
        if (bot.aiState === AIState.FLEE) {
            // 🚨 SENTIENT RETREAT: Flee away from threats and path towards safety zones
            let escapeVec = { x: 0, y: 0 };
            
            if (data.enemies.length > 0) {
                const closestEnemy = this.selectTacticalTarget(bot, data, true);
                if (closestEnemy) {
                    escapeVec = Vector.normalize(Vector.sub(bot.pos, closestEnemy.pos)); // Inverse direction vector
                    
                    // Defend rear: Align barrel backwards at pure pursuer and blow bullets to push back with recoil
                    this.updateAim(bot, engine, closestEnemy);
                    bot.aiShooting = true;
                }
            } else {
                escapeVec = bot.idleDir || { x: 0, y: -1 };
                bot.aiShooting = false;
            }

            // Group dynamics / Team mode: Flee towards base coordinates
            if (engine.gameMode === GameMode.TEAMS && bot.team !== Team.NONE) {
                const baseWidth = 900;
                const homeBaseX = bot.team === Team.BLUE ? baseWidth / 2 : CANVAS_WIDTH - baseWidth / 2;
                const homeBaseY = CANVAS_HEIGHT / 2;
                const toBase = Vector.normalize(Vector.sub({ x: homeBaseX, y: homeBaseY }, bot.pos));
                // Core combination of fleeing threat & seeking sanctuary
                escapeVec = Vector.normalize(Vector.add(Vector.mult(escapeVec, 0.45), Vector.mult(toBase, 0.55)));
            } else {
                // FFA: Escape towards empty spaces or map interior center
                const mapCenter = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
                const toCenter = Vector.normalize(Vector.sub(mapCenter, bot.pos));
                escapeVec = Vector.normalize(Vector.add(Vector.mult(escapeVec, 0.72), Vector.mult(toCenter, 0.28)));
            }

            for (let i = 0; i < numRays; i++) {
                interests[i] = Math.max(0, Vector.dot(rays[i], escapeVec) * 1.6);
            }

        } else if (bot.aiState === AIState.BODYGUARD) {
            const player = engine.player;
            if (player && player.team === bot.team) {
                const nearestEnemy = this.selectTacticalTarget(bot, data, true);
                const guardAnchor = nearestEnemy
                    ? Vector.add(player.pos, Vector.mult(Vector.normalize(Vector.sub(player.pos, nearestEnemy.pos)), 90))
                    : Vector.add(player.pos, { x: -55, y: 55 });
                const toGuard = Vector.normalize(Vector.sub(guardAnchor, bot.pos));
                for (let i = 0; i < numRays; i++) {
                    interests[i] = Math.max(0, Vector.dot(rays[i], toGuard) * 1.6);
                }
                if (nearestEnemy) {
                    this.updateAim(bot, engine, nearestEnemy);
                    bot.aiShooting = true;
                } else {
                    bot.aiShooting = false;
                }
            }
        } else if (bot.aiState === AIState.GREETING) {
            const player = engine.player;
            if (player && player.team === bot.team) {
                const toPlayer = Vector.normalize(Vector.sub(player.pos, bot.pos));
                for (let i = 0; i < numRays; i++) {
                    interests[i] = Math.max(0, Vector.dot(rays[i], toPlayer) * 0.65);
                }
                bot.aiTargetRot += 0.6;
                bot.aiShooting = false;
                const now = this.nowMs(engine);
                if (bot.socialWiggleUntil && bot.socialWiggleUntil > now) {
                    bot.chassisRotation = (bot.chassisRotation || bot.rotation) + Math.sin(now * 0.03) * 0.05;
                }
            }
        } else if (bot.aiState === AIState.ESCORT) {
            const player = engine.player;
            if (player && player.team === bot.team) {
                const playerDir = Vector.mag(player.vel || { x: 0, y: 0 }) > 0.2 ? Vector.normalize(player.vel) : Vector.fromAngle(player.rotation || 0);
                const right = { x: -playerDir.y, y: playerDir.x };
                const slotSign = (bot.id % 2 === 0) ? 1 : -1;
                const escortSlot = Vector.add(
                    player.pos,
                    Vector.add(Vector.mult(playerDir, -85), Vector.mult(right, 95 * slotSign))
                );
                const toSlot = Vector.normalize(Vector.sub(escortSlot, bot.pos));
                for (let i = 0; i < numRays; i++) {
                    interests[i] = Math.max(0, Vector.dot(rays[i], toSlot) * 1.25);
                }
                // Keep barrel scanning outward.
                bot.aiTargetRot = Math.atan2(right.y * slotSign, right.x * slotSign);
                bot.aiShooting = false;
            }
        } else if (bot.aiState === AIState.COMBAT && target) {
            // ⚔️ TACTICAL ENGAGEMENT: Class based positioning & bullet dodging
            const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
            const dist = Vector.dist(bot.pos, target.pos);

            let idealRange = 360;
            let aggroWeight = 1.0;
            let strafeWeight = 0.7;

            // Tailor ranges to class types beautifully
            switch(bot.classType) {
                case TankClass.SNIPER:
                case TankClass.RANGER:
                case TankClass.ASSASSIN:
                case TankClass.STALKER:
                case TankClass.TRAPPER:
                    idealRange = bot.classType === TankClass.RANGER ? 740 : (bot.classType === TankClass.STALKER ? 640 : (bot.classType === TankClass.TRAPPER ? 520 : 580));
                    aggroWeight = 1.15;
                    strafeWeight = 1.1;
                    break;
                case TankClass.DESTROYER:
                case TankClass.ANNIHILATOR:
                    idealRange = 250;
                    aggroWeight = 0.85;
                    strafeWeight = 0.45;
                    break;
                case TankClass.BOOSTER:
                case TankClass.TRI_ANGLE:
                case TankClass.FIGHTER:
                    idealRange = 80; // Hard close quarters press/ramming
                    aggroWeight = 1.7;
                    strafeWeight = 0.1;
                    break;
                default:
                    idealRange = 360;
                    aggroWeight = 1.0;
                    strafeWeight = 0.75;
                    break;
            }

            const isHealer = this.isPacifist(bot.classType);

            if (isHealer) {
                // Smart Support AI: Coordinate with teammates, prioritize healing low health allies
                let lowestAlly = null;
                let lowestAllyHp = 1.1;
                for (const t of data.teammates) {
                    const hpRatio = t.health / t.maxHealth;
                    if (hpRatio < lowestAllyHp && hpRatio < 0.95) {
                        lowestAllyHp = hpRatio;
                        lowestAlly = t;
                    }
                }

                if (lowestAlly) {
                    const toAlly = Vector.sub(lowestAlly.pos, bot.pos);
                    const allyDist = Vector.mag(toAlly);
                    const allyVec = Vector.normalize(toAlly);
                    
                    idealRange = 130; // close range helper orbiting
                    this.updateAim(bot, engine, lowestAlly);
                    bot.aiShooting = true;

                    for (let i = 0; i < numRays; i++) {
                        let dotVal = Vector.dot(rays[i], allyVec);
                        if (allyDist < idealRange - 20) {
                            dotVal = -dotVal * 0.4;
                        }
                        interests[i] = Math.max(0, dotVal * 1.5);
                    }
                } else {
                    // Back off from close hostiles while looking for team support
                    if (data.enemies.length > 0) {
                        const runVec = Vector.normalize(Vector.sub(bot.pos, target.pos));
                        for (let i = 0; i < numRays; i++) {
                            interests[i] = Math.max(0, Vector.dot(rays[i], runVec) * 1.4);
                        }
                        this.updateAim(bot, engine, target);
                        bot.aiShooting = false;
                    }
                }
            } else {
                // Elite fighter class vectors
                for (let i = 0; i < numRays; i++) {
                    const dotToTarget = Vector.dot(rays[i], toTarget);
                    let val = 0;

                    if (dist < idealRange - 80) {
                        // backing off
                        val = -dotToTarget * aggroWeight * 1.35;
                    } else if (dist > idealRange + 100) {
                        // closing in
                        val = dotToTarget * aggroWeight * 1.1;
                    } else {
                        // strafe lateral orbit
                        const strafeDirVec = { x: -toTarget.y, y: toTarget.x };
                        const strafeMove = Vector.mult(strafeDirVec, bot.strafeDir);
                        const strafeDot = Vector.dot(rays[i], strafeMove);
                        const radialDot = dotToTarget * (dist > idealRange ? 0.2 : -0.2); // minor stabilization adjustments
                        val = (strafeDot * strafeWeight) + (radialDot * 0.4);
                    }
                    interests[i] = Math.max(0, val);
                }

                this.updateAim(bot, engine, target);
                bot.aiShooting = true;
            }

        } else if (bot.aiState === AIState.FARM && target) {
            // 🚜 FARM SHAPES: Maintain spacing to shoot nodes without colliding
            const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
            const dist = Vector.dist(bot.pos, target.pos);
            const isRammer = bot.classType === TankClass.BOOSTER || bot.classType === TankClass.TRI_ANGLE;
            
            const idealFarmRange = isRammer ? 10 : 200;

            for (let i = 0; i < numRays; i++) {
                const dotTo = Vector.dot(rays[i], toTarget);
                let val = 0;
                if (dist < idealFarmRange - 30) {
                    val = -dotTo * 1.1; // backup
                } else if (dist > idealFarmRange + 50) {
                    val = dotTo * 0.85; // advance
                } else {
                    const orbitDir = { x: -toTarget.y, y: toTarget.x };
                    val = Math.abs(Vector.dot(rays[i], orbitDir)) * 0.65;
                }
                interests[i] = Math.max(0, val);
            }

            this.updateAim(bot, engine, target);
            bot.aiShooting = !isRammer || dist < 120;

        } else if (bot.aiState === AIState.HUNT && target) {
            // 🎯 PRIORITY HUNT: Rapidly close distance to rare shape
            const toTarget = Vector.normalize(Vector.sub(target.pos, bot.pos));
            const dist = Vector.dist(bot.pos, target.pos);
            
            for (let i = 0; i < numRays; i++) {
                interests[i] = Math.max(0, Vector.dot(rays[i], toTarget) * 1.5);
            }

            this.updateAim(bot, engine, target);
            bot.aiShooting = dist < 800; // start pre-firing as they approach

        } else {
            // 🗺️ SENTIENT EXPLORATION: Move towards meaningful map regions instead of random wandering.
            bot.aiShooting = false;

            if (!bot.patrolTimer) bot.patrolTimer = 0;
            bot.patrolTimer -= 0.1;

            if (!bot.patrolTarget || bot.patrolTimer <= 0 || Vector.dist(bot.pos, bot.patrolTarget) < 140) {
                bot.patrolTimer = 10.0 + Math.random() * 9.0; // refresh path every 10-19s
                bot.patrolTarget = this.chooseExploreAnchor(bot, data, engine);
            }

            const travelDir = Vector.normalize(Vector.sub(bot.patrolTarget, bot.pos));
            for (let i = 0; i < numRays; i++) {
                interests[i] = Math.max(0, Vector.dot(rays[i], travelDir) * 1.05);
            }

            bot.scanTimer += 0.05;
            const headingAngle = Math.atan2(travelDir.y, travelDir.x);
            const scanWobble = Math.sin(bot.scanTimer * 2.25) * 0.58;
            bot.aiTargetRot = headingAngle + scanWobble;
        }

        // --- DANGER AVOIDANCE MAP ---
        // 1. Core Arena Bound Avoidance
        const mapMargin = 320;
        if (bot.pos.x < mapMargin) {
            const dangerVal = (mapMargin - bot.pos.x) / mapMargin;
            this.applyDanger(rays, dangers, { x: -1, y: 0 }, 4.5 * dangerVal);
        }
        if (bot.pos.x > CANVAS_WIDTH - mapMargin) {
            const dangerVal = (bot.pos.x - (CANVAS_WIDTH - mapMargin)) / mapMargin;
            this.applyDanger(rays, dangers, { x: 1, y: 0 }, 4.5 * dangerVal);
        }
        if (bot.pos.y < mapMargin) {
            const dangerVal = (mapMargin - bot.pos.y) / mapMargin;
            this.applyDanger(rays, dangers, { x: 0, y: -1 }, 4.5 * dangerVal);
        }
        if (bot.pos.y > CANVAS_HEIGHT - mapMargin) {
            const dangerVal = (bot.pos.y - (CANVAS_HEIGHT - mapMargin)) / mapMargin;
            this.applyDanger(rays, dangers, { x: 0, y: 1 }, 4.5 * dangerVal);
        }

        // 2. Complex Projectile Dodging Layer
        for (const b of data.bullets) {
            const toBullet = Vector.sub(b.pos, bot.pos);
            const d = Vector.mag(toBullet);
            if (d < 380) {
                const bulletVel = b.vel || { x: 0, y: 0 };
                const speed = Vector.mag(bulletVel);
                if (speed > 1) {
                    const bDir = Vector.normalize(bulletVel);
                    const toBotNorm = Vector.normalize(Vector.mult(toBullet, -1));
                    
                    const headingAlignment = Vector.dot(bDir, toBotNorm);
                    if (headingAlignment > 0.42) { // Fly path crosses our profile
                        const dangerStrength = 1.85 * (1.0 - d / 380);
                        this.applyDanger(rays, dangers, Vector.normalize(toBullet), dangerStrength * 2.8);

                        // Sidestep dodging: increase interest perpendicular to trajectory
                        const ortho1 = { x: -bDir.y, y: bDir.x };
                        const ortho2 = { x: bDir.y, y: -bDir.x };
                        // Select side aligned with heading
                        const chosenSide = Vector.dot(bot.lastSteering, ortho1) >= 0 ? ortho1 : ortho2;
                        for (let rIdx = 0; rIdx < numRays; rIdx++) {
                            interests[rIdx] = Math.max(interests[rIdx], Vector.dot(rays[rIdx], chosenSide) * 1.45 * (1.0 - d / 380));
                        }
                    }
                } else {
                    this.applyDanger(rays, dangers, Vector.normalize(toBullet), 0.9 * (1.0 - d / 380));
                }
            }
        }

        // 3. Team crowding separation forces (flocking guidelines)
        for (const t of data.teammates) {
            const toAlly = Vector.sub(t.pos, bot.pos);
            const d = Vector.mag(toAlly);
            if (d < 170) {
                const repelStrength = 2.4 * (1.0 - d / 170);
                this.applyDanger(rays, dangers, Vector.normalize(toAlly), repelStrength);
            }
        }

        // 4. Boss / Void Portals High Collision Avoidance
        const hazards = data.shapes.filter((s: any) => s.type === EntityType.VOID_PORTAL || s.type === EntityType.BOSS);
        for (const h of hazards) {
            const toHaz = Vector.sub(h.pos, bot.pos);
            const d = Vector.mag(toHaz);
            const safeDist = h.type === EntityType.BOSS ? 400 : 250;
            if (d < safeDist) {
                const hazardRepel = 3.5 * (1.0 - d / safeDist);
                this.applyDanger(rays, dangers, Vector.normalize(toHaz), hazardRepel);
            }
        }

        // --- STEP 3: BLEND CONSTRAINTS ---
        let bestDir = { x: 0, y: 0 };
        for (let i = 0; i < numRays; i++) {
            const score = interests[i] - dangers[i];
            if (score > 0) {
                bestDir = Vector.add(bestDir, Vector.mult(rays[i], score));
            }
        }

        return Vector.normalize(bestDir);
    }

    private static applyDanger(rays: Vector2[], dangers: number[], dir: Vector2, weight: number) {
        for (let i = 0; i < rays.length; i++) {
            const d = Vector.dot(rays[i], dir);
            if (d > 0) dangers[i] = Math.max(dangers[i], d * weight);
        }
    }

    private static handleStatUpgrades(bot: IAITank, engine: IGameEngine, botStatPriorities: Record<TankClass, StatType[]>) {
        if (bot.availableStatPoints > 0) {
            const priorities = botStatPriorities[bot.classType] || Object.values(StatType);
            // Upgrade sequentially to build stable and elite tank builds
            for (const stat of priorities) {
                if (bot.stats[stat] < 8) {
                    engine.upgradeStat(bot, stat);
                    break;
                }
            }
        }
    }

    private static updateAim(bot: IAITank, engine: IGameEngine, target: any) {
        const bSpeed = (BASE_STATS.bulletSpeed + bot.stats[StatType.BULLET_SPEED] * 0.8);
        const targetVel = target.vel || { x: 0, y: 0 };
        const aimPos = engine.getInterceptPoint(bot.pos, bSpeed, target.pos, targetVel);
        const desired = Math.atan2(aimPos.y - bot.pos.y, aimPos.x - bot.pos.x);
        if (bot.lastAimTargetId !== target.id || !Number.isFinite(bot.aiTargetRot)) {
            bot.aiTargetRot = desired;
            bot.lastAimTargetId = target.id;
            return;
        }
        let diff = desired - bot.aiTargetRot;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const targetSpeed = Vector.mag(targetVel);
        const blend = target.type === EntityType.SHAPE || target.type === EntityType.CRASHER || target.type === EntityType.BOSS
            ? 0.28
            : targetSpeed > 2.2
                ? 0.44
                : 0.36;
        if (Math.abs(diff) > 0.004) {
            bot.aiTargetRot += diff * blend;
        }
        bot.lastAimTargetId = target.id;
    }

    private static applySmoothRotation(bot: IAITank, dt: number) {
        if (bot.aiTargetRot === undefined) return;
        
        let diff = bot.aiTargetRot - bot.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        // Turn speeds optimized dynamically!
        let baseTurnSpeed = 0.14;
        if (bot.classType === TankClass.SNIPER || bot.classType === TankClass.ASSASSIN || bot.classType === TankClass.RANGER || bot.classType === TankClass.STALKER || bot.classType === TankClass.TRAPPER) {
            baseTurnSpeed = 0.074; // precise sniper tracking
        } else if (bot.classType === TankClass.BOOSTER || bot.classType === TankClass.TRI_ANGLE || bot.classType === TankClass.FIGHTER) {
            baseTurnSpeed = 0.21;  // fast but less twitchy close-range turning
        } else if (bot.aiState === AIState.IDLE) {
            baseTurnSpeed = 0.06;  // relaxing scouting sweep
        }

        const step = baseTurnSpeed * dt * 60;
        if (Math.abs(diff) < 0.003) {
            return;
        }
        if (Math.abs(diff) < step) {
            bot.rotation = bot.aiTargetRot;
        } else {
            bot.rotation += Math.sign(diff) * step;
        }

        while (bot.rotation > Math.PI) bot.rotation -= Math.PI * 2;
        while (bot.rotation < -Math.PI) bot.rotation += Math.PI * 2;
    }

    private static handleAutoShooting(bot: IAITank, engine: IGameEngine) {
        if (!bot.aiShooting) return;
        
        let diff = bot.aiTargetRot - bot.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        // Shoot when lined up within error tolerance of ~22 degrees
        if (Math.abs(diff) < 0.38) {
            engine.attemptShoot(bot);
        }
    }

    private static nowMs(engine: IGameEngine): number {
        if (engine.getSimTimeMs) return engine.getSimTimeMs();
        if (engine.getNowMs) return engine.getNowMs();
        return Date.now();
    }

    private static seeded01(seed: number): number {
        const s = Math.sin(seed * 0.000001 + 1.23456789) * 43758.5453123;
        return s - Math.floor(s);
    }

    private static ensureLegacyDefaults(bot: IAITank, engine: IGameEngine) {
        if (!bot.lastSteering) bot.lastSteering = { x: 0, y: 0 };
        if (typeof bot.aiTargetRot !== 'number') bot.aiTargetRot = bot.rotation || 0;
        if (typeof bot.aiShooting !== 'boolean') bot.aiShooting = false;
        if (typeof bot.aiUpdateTimer !== 'number' || Number.isNaN(bot.aiUpdateTimer)) bot.aiUpdateTimer = 0;
        if (!bot.stats) {
            bot.stats = {
                [StatType.REGEN]: 0,
                [StatType.MAX_HEALTH]: 0,
                [StatType.BODY_DAMAGE]: 0,
                [StatType.BULLET_SPEED]: 0,
                [StatType.BULLET_PENETRATION]: 0,
                [StatType.BULLET_DAMAGE]: 0,
                [StatType.RELOAD]: 0,
                [StatType.MOVEMENT_SPEED]: 0,
                [StatType.BULLET_SPREAD]: 0,
                [StatType.MAX_SHIELD]: 0,
                [StatType.HEALING_RADIUS]: 0,
                [StatType.HEALING_EFFICIENCY]: 0,
                [StatType.HEALING_BURST]: 0,
                [StatType.SUPPORT_XP_MULT]: 0,
                [StatType.DRAIN_RADIUS]: 0,
                [StatType.DRAIN_EFFICIENCY]: 0,
                [StatType.DRAIN_LIFESTEAL]: 0,
                [StatType.DRAIN_BURST]: 0
            } as Record<StatType, number>;
        }

        // If context is partially missing, default to safe non-crashing behavior.
        if (!engine || !engine.spatialGrid || !engine.applyTankMovement || !engine.getInterceptPoint || !engine.attemptShoot || !engine.upgradeStat) {
            bot.aiShooting = false;
            bot.lastSteering = { x: 0, y: 0 };
        }
    }
}
