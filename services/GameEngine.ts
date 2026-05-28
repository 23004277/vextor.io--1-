import { EntityType, GameState, KillFeedEntry, ShapeType, StatType, TankClass, Vector2, LeaderboardEntry, Team, GameMode, UINotification, ShapeRarity, BuffEffect, MinimapMarker, SandboxConfig, GameSettings, AIState, PlayerState } from '../types';
import { BASE_STATS, CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, GRID_SIZE, STAT_COLORS, TANK_CONFIGS, XP_CURVE_MULTIPLIER, MAX_LEVEL, CLASS_TREE, BASE_ZONE_WIDTH, SHAPE_STATS, RARITY_CONFIG, VOID_RARITY_CONFIG, BOT_NAMES, BOT_STAT_PRIORITIES, REBIRTH_LEVEL, REBIRTH_AREA_POS, REBIRTH_AREA_SIZE, SAFE_ZONE_WARNING_RADIUS, SAFE_ZONE_ENGAGEMENT_RADIUS, SAFE_ZONE_DRONE_SCAN_INTERVAL_MS, SAFE_ZONE_DEFENSE_DRONES_PER_TEAM, CLASS_PROJECTILE_MODIFIERS, CLASS_ABILITY_CONFIG } from '../constants';
import * as Vector from './MathUtils';
import { SoundEngine } from './SoundEngine';
import type { AudioSpatialOptions } from './SoundEngine';
import { EnemyAITanks } from './EnemyAITanks';
import { AISystem } from './systems/AISystem';

// Define FloatingTextType for type safety
type FloatingTextType = 'DAMAGE' | 'SCORE';
type SpawnZone = { x: number; y: number; w: number; h: number; cx: number; cy: number };

function getRarityRank(rarity: ShapeRarity): number {
    const ranks: Record<ShapeRarity, number> = {
        [ShapeRarity.COMMON]: 0,
        [ShapeRarity.UNCOMMON]: 1,
        [ShapeRarity.RARE]: 2,
        [ShapeRarity.EPIC]: 3,
        [ShapeRarity.LEGENDARY]: 4,
        [ShapeRarity.MYTHICAL]: 5,
        [ShapeRarity.ETERNAL]: 6,
        [ShapeRarity.TRANSCENDENT]: 7,
        [ShapeRarity.GODLY]: 8,
        [ShapeRarity.DIVINE]: 9,
    };
    return ranks[rarity] ?? 0;
}

class Particle {
    pos: Vector2;
    vel: Vector2;
    color: string;
    life: number;
    maxLife: number;
    size: number;
    friction: number = 0.95;
    type: 'DEFAULT' | 'FLASH' | 'RING' | 'GAS' | 'AURA' = 'DEFAULT';

    constructor(x: number, y: number, color: string, size: number, life: number = 60, type: 'DEFAULT' | 'FLASH' | 'RING' | 'GAS' | 'AURA' = 'DEFAULT') {
        this.pos = { x, y };
        this.type = type;
        if (type === 'FLASH') {
            this.vel = { x: 0, y: 0 };
            this.friction = 1.0;
        } else if (type === 'RING') {
            this.vel = { x: 0, y: 0 };
            this.friction = 1.0;
        } else if (type === 'GAS') {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            this.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
            this.friction = 0.98;
        } else if (type === 'AURA') {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1.5 + 0.5;
            this.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
            this.friction = 0.94;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            this.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        }
        this.color = color;
        this.size = size;
        this.maxLife = life;
        this.life = life;
    }

    update() {
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.vel.x *= this.friction;
        this.vel.y *= this.friction;
        if (this.type === 'FLASH') {
            this.size *= 1.1; // Grow muzzle flashes
        } else if (this.type === 'RING') {
            this.size *= 1.15; // Rapid ring expansion
        } else if (this.type === 'GAS') {
            this.size *= 1.05; // Diffuse smoke
        } else if (this.type === 'AURA') {
            this.size *= 0.98; // Dissipate
        }
        this.life--;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        if (this.type === 'RING') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 4 * (this.life / this.maxLife);
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class FloatingText {
    pos: Vector2;
    vel: Vector2;
    text: string;
    value: number;
    entityId: number | null;
    fillColor: string;
    strokeColor: string;
    life: number;
    maxLife: number;
    size: number;
    type: FloatingTextType;
    scale: number;

    constructor(x: number, y: number, amount: number, type: FloatingTextType, size: number, isCrit: boolean = false, entityId: number | null = null) {
        this.pos = { x, y };
        this.value = amount;
        this.text = type === 'DAMAGE' ? `-${Math.floor(amount)}` : `+${Math.floor(amount)} XP`;
        this.type = type;
        this.size = size;
        this.entityId = entityId;
        this.scale = 1.0;
        
        if (type === 'DAMAGE') {
            this.maxLife = 100;
            if (isCrit) {
                this.fillColor = '#ffffff'; 
                this.strokeColor = '#e74c3c';
            } else {
                this.fillColor = '#ffffff';
                this.strokeColor = '#4a4a4a'; 
            }
            this.vel = { x: 0, y: -0.3 };
        } else {
            this.maxLife = 60; 
            this.fillColor = '#FFD700';
            this.strokeColor = '#000000';
            this.vel = { x: 0, y: -0.8 }; 
        }
        
        this.life = this.maxLife;
    }

    stack(amount: number) {
        this.value += amount;
        this.text = `-${Math.floor(this.value)}`;
        this.life = this.maxLife;
        this.scale = 1.3;
    }

    update() {
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.life--;
        if (this.scale > 1.0) this.scale -= 0.03;
        else if (this.scale < 1.0) this.scale = 1.0;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.life <= 0) return;
        ctx.save();
        let alpha = 1;
        if (this.life < 15) alpha = this.life / 15;
        ctx.globalAlpha = alpha;
        ctx.translate(this.pos.x, this.pos.y);
        ctx.scale(this.scale, this.scale);
        ctx.font = `900 ${this.size}px Ubuntu, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.strokeColor;
        ctx.strokeText(this.text, 0, 0);
        ctx.fillStyle = this.fillColor;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

class Entity {
  id: number;
  type: EntityType;
  team: Team = Team.NONE;
  pos: Vector2;
  vel: Vector2;
  acc: Vector2;
  radius: number;
  color: string;
  rotation: number;
  chassisRotation: number = 0;
  health: number;
  maxHealth: number;
  displayHealth: number;
  shield: number = 0;
  maxShield: number = 0;
  damage: number; 
  isDead: boolean = false;
  lastDamageTime: number = 0;
  mass: number = 1;
  name: string = '';
  friction: number = 0.93; 
  invulnerableTime: number = 0;
  visualScale: number = 1.0;
  shouldRemove: boolean = false;
  fxHealing: boolean = false;
  fxDraining: boolean = false;
  fxAbilityActive: boolean = false;

  constructor(id: number, type: EntityType, x: number, y: number, radius: number, color: string) {
    this.id = id;
    this.type = type;
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.acc = { x: 0, y: 0 };
    this.radius = radius;
    this.color = color;
    this.rotation = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.displayHealth = 100;
    this.damage = 10;
    this.mass = radius; 
  }

  update(dt: number) {
    const timeScale = Math.min(dt * 60, 2.0); 
    if (this.invulnerableTime > 0) this.invulnerableTime -= dt * 1000;
    if (Math.abs(this.displayHealth - this.health) > 0.1) this.displayHealth += (this.health - this.displayHealth) * 0.2;
    else this.displayHealth = this.health;
    
    const currentSpeed = Vector.mag(this.vel);
    const targetScale = 1.0 + Math.min(0.1, currentSpeed * 0.005);
    this.visualScale += (targetScale - this.visualScale) * 0.1;

    this.vel.x += this.acc.x * timeScale;
    this.vel.y += this.acc.y * timeScale;
    this.acc = { x: 0, y: 0 };
    const frictionFactor = Math.pow(this.friction, timeScale);
    this.vel.x *= frictionFactor;
    this.vel.y *= frictionFactor;
    this.pos.x += this.vel.x * timeScale;
    this.pos.y += this.vel.y * timeScale;
    this.pos.x = Vector.clamp(this.pos.x, this.radius, CANVAS_WIDTH - this.radius);
    this.pos.y = Vector.clamp(this.pos.y, this.radius, CANVAS_HEIGHT - this.radius);
    if (Math.abs(this.vel.x) < 0.01) this.vel.x = 0;
    if (Math.abs(this.vel.y) < 0.01) this.vel.y = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    if (this.invulnerableTime > 0) ctx.globalAlpha = 0.5;
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);
    
    // Only apply visual squeeze to non-tank entities (like shapes) globally
    // We limit the squeeze to preserve shape integrity during extreme scales (like spawn/death)
    if (this.type !== EntityType.PLAYER && this.type !== EntityType.ENEMY && this.type !== EntityType.ELITE_TANK) {
        const squeeze = Math.max(0.7, Math.min(1.3, 2 - this.visualScale));
        ctx.scale(this.visualScale, squeeze);
    }
    
    this.drawBody(ctx);
    ctx.restore();
    if (this.health < this.maxHealth && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL) this.drawHealthBar(ctx);
    if (this.name && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL) this.drawName(ctx);
  }

  drawBody(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.border;
    ctx.stroke();
    if (this.shield > 1) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#33ccff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
        const alpha = 0.2 + (0.4 * (this.shield / this.maxShield));
        ctx.strokeStyle = `rgba(51, 204, 255, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    }
  }

  drawHealthBar(ctx: CanvasRenderingContext2D) {
    const barWidth = this.radius * 2;
    const barHeight = 4;
    const yOffset = this.radius + 12;
    const teamTrack = this.team === Team.BLUE
      ? 'rgba(8, 47, 73, 0.72)'
      : this.team === Team.RED
        ? 'rgba(69, 10, 10, 0.72)'
        : '#333';
    const teamBorder = this.team === Team.BLUE
      ? 'rgba(56, 189, 248, 0.45)'
      : this.team === Team.RED
        ? 'rgba(248, 113, 113, 0.45)'
        : 'rgba(255,255,255,0.18)';
    ctx.fillStyle = teamTrack;
    ctx.fillRect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth, barHeight);
    ctx.strokeStyle = teamBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth, barHeight);
    const hpPct = Math.max(0, this.displayHealth / this.maxHealth);
    ctx.fillStyle = '#6f6';
    ctx.fillRect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth * hpPct, barHeight);
    if (this.maxShield > 0) {
        const shieldPct = Math.max(0, this.shield / this.maxShield);
        ctx.fillStyle = '#33ccff';
        ctx.fillRect(this.pos.x - barWidth / 2, this.pos.y + yOffset - 3, barWidth * shieldPct, 2);
    }
  }

  drawName(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const prefix = this.team === Team.BLUE ? '◆' : this.team === Team.RED ? '◆' : '';
    const teamName = this.team === Team.BLUE ? 'BLU' : this.team === Team.RED ? 'RED' : '';
    const teamColor = this.team === Team.BLUE ? '#38bdf8' : this.team === Team.RED ? '#f87171' : '#ffffff';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px Ubuntu';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const yOffset = -this.radius - 12; 
    ctx.translate(this.pos.x, this.pos.y);
    const renderName = teamName ? `${prefix} ${teamName} ${this.name}` : this.name;
    ctx.strokeText(renderName, 0, yOffset);
    ctx.fillText(renderName, 0, yOffset);
    if (teamName) {
        const textWidth = ctx.measureText(renderName).width;
        const tagWidth = Math.min(48, Math.max(22, textWidth * 0.25));
        ctx.fillStyle = teamColor;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-textWidth * 0.5, yOffset + 2, tagWidth, 2);
    }
    ctx.restore();
  }

  takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
    if (this.invulnerableTime > 0) return;
    const engine = (window as any).gameEngine;

    this.lastDamageTime = Date.now();
    if (this.shield > 0) {
        if (engine && this.type === EntityType.PLAYER) engine.sound.playShieldHit();
        
        let pierceAmount = 0;
        if (isBodyDamage) {
            // High-velocity body collisions pierce shielding by 25%, damaging underlying health directly!
            pierceAmount = Math.round(amount * 0.25);
            amount -= pierceAmount;
            
            // Apply pierce damage directly to health under the shield
            this.health = Math.max(0, this.health - pierceAmount);
            if (this.health <= 0) { this.isDead = true; this.displayHealth = 0; }
        }
        
        if (amount <= this.shield) { 
            this.shield -= amount; 
            return; 
        } else { 
            amount -= this.shield; 
            this.shield = 0; 
        }
    }
    this.health -= amount;
    if (this.health <= 0) { this.isDead = true; this.displayHealth = 0; }

    // Blood ultimate reactive decay: attackers that shoot/ram a pact-active blood tank get cursed.
    if (engine && sourceId !== null && (this.type === EntityType.PLAYER || this.type === EntityType.ENEMY || this.type === EntityType.ELITE_TANK)) {
        const isTankEntity = (entity: Entity | undefined | null): entity is Tank =>
            !!entity && (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK);
        if (!isTankEntity(this)) return;
        const victimTank = this;
        if (victimTank.bloodPactActiveTimer > 0) {
            const sourceEntity = engine.entities.find((e: Entity) => e.id === sourceId) as Entity | undefined;
            let sourceTank: Tank | null = null;
            if (sourceEntity) {
                if (sourceEntity.type === EntityType.BULLET) {
                    const ownerId = (sourceEntity as Bullet).ownerId;
                    const owner = engine.entities.find((e: Entity) => e.id === ownerId);
                    sourceTank = isTankEntity(owner) ? owner : null;
                } else if (sourceEntity.type === EntityType.DRONE || sourceEntity.type === EntityType.MINI_TANK) {
                    sourceTank = (sourceEntity as Drone | MiniTank).owner;
                } else if (isTankEntity(sourceEntity)) {
                    sourceTank = sourceEntity;
                }
            }
            if (sourceTank && sourceTank.team !== victimTank.team) {
                sourceTank.applyDrainDot(1, CLASS_ABILITY_CONFIG.blood.decayStackDuration);
            }
        }
    }
  }
}

/**
 * MINI TANK: Commander's Units
 */
class MiniTank extends Entity {
    owner: Tank;
    cooldown: number = 0;
    targetId: number | null = null;
    orbitAngle: number = 0;
    detectionRadius: number = 500;
    combatOrbitDistance: number = 180;

    constructor(id: number, x: number, y: number, owner: Tank) {
        super(id, EntityType.MINI_TANK, x, y, 14, owner.color);
        this.owner = owner;
        this.team = owner.team;
        this.friction = 0.94;
        this.mass = 15;
        this.orbitAngle = Math.random() * Math.PI * 2;
        
        // Stats scaled based on "Drone Health" and "Drone Damage" (Bullet Pen/Dmg)
        const hpFromHost = owner.maxHealth * 0.16;
        const hpBonus = owner.stats[StatType.BULLET_PENETRATION] * 8;
        this.maxHealth = Math.max(28, hpFromHost + hpBonus);
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        
        const dmgBonus = (owner.stats[StatType.BULLET_DAMAGE] * 8);
        this.damage = Math.max(7, (BASE_STATS.bodyDamage * 0.35) + dmgBonus * 0.28);
        
        // SACRIFICIAL GOAT BUFF
        if (owner.isSacrificing) {
            this.damage *= 1.25;
        }
    }

    override update(dt: number) {
        const engine = (window as any).gameEngine;
        if (!engine) return;

        this.cooldown -= dt * 1000;

        let targetPos = { x: 0, y: 0 };
        let isCommanded = false;
        
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const worldMouse = {
            x: (engine.mouse.x - viewW/2) / engine.cameraZoom + engine.cameraPos.x,
            y: (engine.mouse.y - viewH/2) / engine.cameraZoom + engine.cameraPos.y
        };

        // COMMAND MODE (CURSOR SWARM)
        if (this.owner.autoFire || engine.mouseDown) {
            isCommanded = true;
            const units = engine.entities.filter((e: any) => e.type === EntityType.MINI_TANK && e.owner === this.owner);
            const idx = units.indexOf(this);
            const offsetAngle = (idx / units.length) * Math.PI * 2;
            const mouseOffset = Vector.mult(Vector.fromAngle(offsetAngle), 60);
            
            targetPos = Vector.add(worldMouse, mouseOffset);
            const dir = Vector.normalize(Vector.sub(targetPos, this.pos));
            // NERFED SPEED: 0.65x multiplier
            const speed = (BASE_STATS.speed + this.owner.stats[StatType.MOVEMENT_SPEED] * 0.6) * 0.65;
            this.acc = Vector.mult(dir, speed * 0.15);
        } else {
            // AUTONOMOUS MODE
            const neighbors = engine.spatialGrid.getNeighbors(this);
            const potentialTargets = neighbors.filter((e: any) => 
                (e.type === EntityType.ENEMY || e.type === EntityType.PLAYER || e.type === EntityType.SHAPE || e.type === EntityType.BOSS) && 
                e.team !== this.team && 
                e.type !== EntityType.MINI_TANK && // Immune to own kind
                Vector.dist(e.pos, this.pos) < this.detectionRadius
            );
            
            const nearestEnemy = engine.findNearest(this, potentialTargets);

            if (nearestEnemy) {
                // COMBAT ORBIT: Approach and orbit enemy
                const distToEnemy = Vector.dist(this.pos, nearestEnemy.pos);
                const dirToEnemy = Vector.normalize(Vector.sub(nearestEnemy.pos, this.pos));
                const tangent = { x: -dirToEnemy.y, y: dirToEnemy.x }; // Orthogonal vector for orbiting
                
                let moveDir;
                if (distToEnemy > this.combatOrbitDistance + 40) {
                    moveDir = dirToEnemy; // Close distance
                } else if (distToEnemy < this.combatOrbitDistance - 40) {
                    moveDir = Vector.mult(dirToEnemy, -1); // Back away
                } else {
                    // Maintain orbit: Tangent force + slight inward pull
                    moveDir = Vector.normalize(Vector.add(tangent, Vector.mult(dirToEnemy, 0.2)));
                }

                // NERFED COMBAT SPEED: 0.55x
                const speed = (BASE_STATS.speed + this.owner.stats[StatType.MOVEMENT_SPEED] * 0.6) * 0.55;
                this.acc = Vector.mult(moveDir, speed * 0.12);
            } else {
                // IDLE ORBIT: Return to Manager
                this.orbitAngle += dt * 0.65;
                const orbitDist = 160;
                const units = engine.entities.filter((e: any) => e.type === EntityType.MINI_TANK && e.owner === this.owner);
                const idx = units.indexOf(this);
                const angle = this.orbitAngle + (idx / units.length) * Math.PI * 2;
                
                targetPos = {
                    x: this.owner.pos.x + Math.cos(angle) * orbitDist,
                    y: this.owner.pos.y + Math.sin(angle) * orbitDist
                };
                const toTarget = Vector.sub(targetPos, this.pos);
                if (Vector.mag(toTarget) > 10) {
                    this.acc = Vector.mult(Vector.normalize(toTarget), 1.2);
                }
            }
        }

        // AIMING & SHOOTING SYSTEM
        const fireRange = 600;
        const neighbors = engine.spatialGrid.getNeighbors(this);
        const combatTargets = neighbors.filter((e: any) => 
            (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.SHAPE || e.type === EntityType.BOSS) && 
            e.team !== this.team && 
            e.type !== EntityType.MINI_TANK && 
            Vector.dist(e.pos, this.pos) < fireRange
        );
        const shootTarget = engine.findNearest(this, combatTargets);
        const canCommandFire = isCommanded && (this.owner.autoFire || engine.mouseDown);
        const fireToward = shootTarget ? shootTarget.pos : (canCommandFire ? worldMouse : null);

        if (fireToward) {
            const bSpeed = (BASE_STATS.bulletSpeed + this.owner.stats[StatType.BULLET_SPEED] * 0.8) * 1.2;
            const aimPoint = shootTarget
                ? engine.getInterceptPoint(this.pos, bSpeed, shootTarget.pos, shootTarget.vel || {x:0, y:0})
                : fireToward;
            this.rotation = Math.atan2(aimPoint.y - this.pos.y, aimPoint.x - this.pos.x);
            
            if (this.cooldown <= 0) {
                const reloadMs = (BASE_STATS.reload - (this.owner.stats[StatType.RELOAD] * 2.5)) * 16.67;
                this.cooldown = Math.max(120, reloadMs * 1.3);
                
                const forward = Vector.fromAngle(this.rotation);
                const tip = Vector.add(this.pos, Vector.mult(forward, this.radius * 1.8));
                
                const bullet = new Bullet(engine.nextId(), tip.x, tip.y, Vector.mult(forward, bSpeed), this.owner, 0.45, 1.0, 0.8);
                engine.entities.push(bullet);
                
                if (engine.isOnScreen(this.pos)) {
                    engine.particles.push(new Particle(tip.x, tip.y, 'rgba(255, 200, 50, 0.4)', 6, 4, 'FLASH'));
                    engine.sound.playShoot(TankClass.BASIC, engine.getAudioSpatialOptions(this.pos, false));
                }
            }
        } else {
            if (isCommanded) {
                this.rotation = Math.atan2(worldMouse.y - this.pos.y, worldMouse.x - this.pos.x);
            } else {
                this.rotation += dt * 2;
            }
        }

        super.update(dt);
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        const bLen = this.radius * 1.8;
        const bWid = this.radius * 0.7;
        
        ctx.save();
        const easedProg = Math.pow(Math.max(0, this.cooldown / 400), 1.3);
        ctx.translate(-easedProg * 5, 0);
        ctx.scale(1 - easedProg * 0.1, 1 + easedProg * 0.1);
        
        ctx.fillStyle = COLORS.barrel;
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 2;
        ctx.fillRect(0, -bWid/2, bLen, bWid);
        ctx.strokeRect(0, -bWid/2, bLen, bWid);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = COLORS.border;
        ctx.stroke();
    }
}

class Drone extends Entity {
    owner: Tank;
    orbitAngle: number;
    orbitDistance: number = 140;

    constructor(id: number, x: number, y: number, owner: Tank) {
        super(id, EntityType.DRONE, x, y, 10, owner.color);
        this.owner = owner;
        this.team = owner.team;
        this.friction = 0.94; 
        this.mass = 12;
        this.orbitAngle = Math.random() * Math.PI * 2;
        
        const bulletDmg = BASE_STATS.bulletDamage + (owner.stats[StatType.BULLET_DAMAGE] * 3);
        const bulletPen = BASE_STATS.bulletPenetration + (owner.stats[StatType.BULLET_PENETRATION] * 5);
        
        this.damage = bulletDmg * 0.9;
        this.maxHealth = 30 + bulletPen * 2.5;
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;

        // SACRIFICIAL GOAT BUFF
        if (owner.isSacrificing) {
            this.damage *= 1.25;
        }
    }

    override update(dt: number) {
        const timeScale = Math.min(dt * 60, 2.0);
        const engine = (window as any).gameEngine;
        const isManagerOwner = this.owner.classType === TankClass.MANAGER;
        let isCommanded = false;
        let targetPos = { x: 0, y: 0 };

        if (this.owner.isBot) {
            if (this.owner.aiTargetId !== null) {
                const target = engine?.entities?.find((e: any) => e.id === this.owner.aiTargetId);
                if (target) {
                    isCommanded = true;
                    targetPos = target.pos;
                }
            }
        } else if (engine) {
            if (this.owner.autoFire || engine.mouseDown) {
                isCommanded = true;
                const viewW = window.innerWidth;
                const viewH = window.innerHeight;
                const cursorWorld = {
                    x: (engine.mouse.x - viewW / 2) / engine.cameraZoom + engine.cameraPos.x,
                    y: (engine.mouse.y - viewH / 2) / engine.cameraZoom + engine.cameraPos.y,
                };

                if (isManagerOwner) {
                    const drones = engine.entities.filter((e: any) => e.type === EntityType.DRONE && e.owner === this.owner);
                    const idx = Math.max(0, drones.indexOf(this));
                    const microOffset = this.owner.autoFire ? 18 : 8;
                    const offsetAngle = (idx / Math.max(1, drones.length)) * Math.PI * 2 + Date.now() * 0.002;
                    targetPos.x = cursorWorld.x + Math.cos(offsetAngle) * microOffset;
                    targetPos.y = cursorWorld.y + Math.sin(offsetAngle) * microOffset;
                } else {
                    targetPos = cursorWorld;
                }
            }
        }

        if (isCommanded) {
            const dir = Vector.normalize(Vector.sub(targetPos, this.pos));
            let speedMult = 0.8;
            if (this.owner.classType === TankClass.MANAGER) speedMult = 0.72;
            if (this.owner.classType === TankClass.OVERLORD) speedMult = 0.92;
            const speed = (BASE_STATS.bulletSpeed + this.owner.stats[StatType.BULLET_SPEED] * 0.8) * speedMult;
            this.acc = Vector.mult(dir, speed * 0.1);
            this.rotation = Math.atan2(dir.y, dir.x);
            if (isManagerOwner && Math.random() < 0.06) {
                engine.particles.push(new Particle(this.pos.x, this.pos.y, 'rgba(110,255,220,0.22)', 5, 12, 'GAS'));
            }
        } else {
            // Swarm Orbiting logic
            const drones = engine ? engine.entities.filter((e: any) => e.type === EntityType.DRONE && e.owner === this.owner) : [];
            const idx = drones.indexOf(this);
            const total = Math.max(1, drones.length);
            
            const slice = (Math.PI * 2) / total;
            const orbitRate = this.owner.classType === TankClass.OVERLORD ? 1250 : this.owner.classType === TankClass.MANAGER ? 1750 : 1500;
            const targetAngle = idx * slice + (Date.now() / orbitRate);
            
            const orbitPos = {
                x: this.owner.pos.x + Math.cos(targetAngle) * this.orbitDistance,
                y: this.owner.pos.y + Math.sin(targetAngle) * this.orbitDistance
            };
            
            const dirToOrbit = Vector.sub(orbitPos, this.pos);
            const dist = Vector.mag(dirToOrbit);
            const pullStrength = Vector.clamp(dist * (this.owner.classType === TankClass.MANAGER ? 0.026 : 0.03), 0, this.owner.classType === TankClass.OVERLORD ? 3.4 : 3);
            this.acc = Vector.mult(Vector.normalize(dirToOrbit), pullStrength);
            
            this.rotation = Math.atan2(this.pos.y - this.owner.pos.y, this.pos.x - this.owner.pos.x);
        }

        super.update(dt);
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        const r = this.radius;
        ctx.moveTo(r * 1.2, 0);
        ctx.lineTo(-r * 0.7, r * 0.9);
        ctx.lineTo(-r * 0.7, -r * 0.9);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = COLORS.border;
        ctx.stroke();
    }

    override draw(ctx: CanvasRenderingContext2D) {
        super.draw(ctx);
        // Manager drone readability: show compact health bars only when damaged.
        if (this.owner.classType === TankClass.MANAGER && this.health < this.maxHealth) {
            this.drawManagerDroneHealthBar(ctx);
        }
    }

    override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
        const engine = (window as any).gameEngine as GameEngine | undefined;
        // Guard against friendly fire while still allowing full hostile damage handling.
        if (engine && sourceId !== null) {
            const src = engine.entities.find((e: Entity) => e.id === sourceId);
            if (src) {
                let srcTeam = src.team;
                if (src.type === EntityType.BULLET) {
                    const owner = engine.entities.find((e: Entity) => e.id === (src as Bullet).ownerId);
                    if (owner) srcTeam = owner.team;
                } else if (src.type === EntityType.DRONE || src.type === EntityType.MINI_TANK) {
                    srcTeam = (src as Drone | MiniTank).owner.team;
                }
                if (srcTeam !== Team.NONE && srcTeam === this.team) return;
            }
        }
        super.takeDamage(amount, sourceId, isBodyDamage);
    }

    private drawManagerDroneHealthBar(ctx: CanvasRenderingContext2D) {
        const width = 20;
        const height = 2.5;
        const yOffset = this.radius + 8;
        const hpPct = Math.max(0, this.displayHealth / Math.max(1, this.maxHealth));
        const fill = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(this.pos.x - width / 2, this.pos.y + yOffset, width, height);
        ctx.fillStyle = fill;
        ctx.fillRect(this.pos.x - width / 2, this.pos.y + yOffset, width * hpPct, height);
        ctx.restore();
    }
}

class BaseDefenseDrone extends Entity {
    aiState: AIState = AIState.ORBIT_IDLE;
    anchor: Vector2;
    orbitSlot: number;
    orbitRadius: number;
    targetId: number | null = null;
    scanCooldownMs: number = 0;
    attackCooldownMs: number = 0;
    chaseTimerMs: number = 0;

    constructor(id: number, team: Team, anchor: Vector2, orbitSlot: number, orbitRadius: number) {
        const color = team === Team.BLUE ? '#42c8ff' : '#ff5f7e';
        super(id, EntityType.BASE_DEFENSE_DRONE, anchor.x, anchor.y, 12, color);
        this.team = team;
        this.anchor = { ...anchor };
        this.orbitSlot = orbitSlot;
        this.orbitRadius = orbitRadius;
        this.friction = 0.92;
        this.mass = 40;
        this.damage = 0;
        this.maxHealth = 999999;
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.name = '';
        this.rotation = 0;
    }

    override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
        // Base defense drones are invulnerable by design.
        return;
    }

    assignTarget(targetId: number | null) {
        if (targetId !== this.targetId) {
            this.chaseTimerMs = 0;
        }
        this.targetId = targetId;
        this.aiState = targetId ? AIState.BASE_DEFENSE : AIState.RETURNING;
    }

    private getOrbitTarget(nowMs: number): Vector2 {
        const phase = nowMs * 0.0018 + this.orbitSlot * ((Math.PI * 2) / 3);
        return {
            x: this.anchor.x + Math.cos(phase) * this.orbitRadius,
            y: this.anchor.y + Math.sin(phase) * this.orbitRadius,
        };
    }

    override update(dt: number) {
        const engine = (window as any).gameEngine as GameEngine | undefined;
        if (!engine) return;
        const nowMs = Date.now();

        this.scanCooldownMs -= dt * 1000;
        this.attackCooldownMs -= dt * 1000;

        let target: Entity | null = null;
        if (this.targetId !== null) {
            const next = engine.entities.find((e: Entity) => e.id === this.targetId && !e.isDead) || null;
            target = next;
            if (!target) {
                this.targetId = null;
                this.aiState = AIState.RETURNING;
            }
        }

        if (target) {
            const toTarget = Vector.sub(target.pos, this.pos);
            const dist = Vector.mag(toTarget);
            const dir = dist > 0.001 ? Vector.normalize(toTarget) : { x: 0, y: 0 };
            this.acc = Vector.mult(dir, 6.9);
            this.chaseTimerMs += dt * 1000;

            const maxChaseDist = this.orbitRadius + SAFE_ZONE_WARNING_RADIUS + 420;
            const distFromAnchor = Vector.dist(target.pos, this.anchor);
            if (distFromAnchor > maxChaseDist || this.chaseTimerMs > 7000) {
                this.targetId = null;
                this.aiState = AIState.RETURNING;
            } else if (dist < 140 && this.attackCooldownMs <= 0 && (target.type === EntityType.PLAYER || target.type === EntityType.ENEMY || target.type === EntityType.ELITE_TANK)) {
                const victim = target as Tank;
                const pctCurrent = victim.health * 0.028;
                const pctMax = victim.maxHealth * 0.02;
                const dmg = Math.min(victim.maxHealth * 0.04, Math.max(8, pctCurrent + pctMax));
                victim.takeDamage(dmg, this.id);
                this.attackCooldownMs = 200;
                engine.particles.push(new Particle(victim.pos.x, victim.pos.y, this.team === Team.BLUE ? 'rgba(66,200,255,0.45)' : 'rgba(255,95,126,0.45)', 8, 14, 'RING'));
            }
            this.rotation = 0;
            super.update(dt);
        } else {
            if (this.scanCooldownMs <= 0) {
                this.scanCooldownMs = SAFE_ZONE_DRONE_SCAN_INTERVAL_MS + (this.orbitSlot % 3) * 30;
                if (this.aiState !== AIState.ORBIT_IDLE) this.aiState = AIState.RETURNING;
            }

            const orbitTarget = this.getOrbitTarget(nowMs);
            const drift = 1 - Math.exp(-dt * (this.aiState === AIState.RETURNING ? 9.5 : 7.2));
            this.pos.x += (orbitTarget.x - this.pos.x) * drift;
            this.pos.y += (orbitTarget.y - this.pos.y) * drift;
            this.vel.x = 0;
            this.vel.y = 0;
            this.acc.x = 0;
            this.acc.y = 0;
            this.rotation = 0;
            if (this.aiState === AIState.RETURNING && Vector.dist(this.pos, orbitTarget) < 16) this.aiState = AIState.ORBIT_IDLE;
        }
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        const pulse = 0.55 + Math.sin(Date.now() * 0.009 + this.id) * 0.45;
        const glow = this.team === Team.BLUE ? `rgba(66,200,255,${0.22 + pulse * 0.35})` : `rgba(255,95,126,${0.22 + pulse * 0.35})`;
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = glow;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.35, 0);
        ctx.lineTo(-this.radius * 0.75, this.radius * 0.95);
        ctx.lineTo(-this.radius * 0.75, -this.radius * 0.95);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
        ctx.restore();
    }
}

class TestDummy extends Entity {
    lastDpsUpdate: number = 0;
    damageInSecond: number = 0;
    dps: number = 0;

    constructor(id: number, x: number, y: number) {
        super(id, EntityType.DUMMY, x, y, 40, '#ffbb00');
        this.maxHealth = 1000000;
        this.health = 1000000;
        this.displayHealth = 1000000;
        this.mass = 1000000; // Zero knockback via physics resolver
        this.name = "DPS_DUMMY";
    }

    override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
        this.damageInSecond += amount;
        if (Date.now() - this.lastDpsUpdate > 1000) {
            this.dps = Math.floor(this.damageInSecond);
            this.damageInSecond = 0;
            this.lastDpsUpdate = Date.now();
        }
        super.takeDamage(amount, sourceId, isBodyDamage);
        this.health = this.maxHealth; // Regenerate immediately
    }

    override update(dt: number) {
        if (this.dps > 0 && Date.now() - this.lastDpsUpdate > 2000) this.dps = 0;
        super.update(dt);
    }

    override drawName(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 3;
        ctx.font = 'bold 20px Ubuntu';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(this.pos.x, this.pos.y);
        ctx.strokeText(`DPS: ${this.dps}`, 0, -this.radius - 12);
        ctx.fillText(`DPS: ${this.dps}`, 0, -this.radius - 12);
        ctx.restore();
    }
}

class VoidPortal extends Entity {
    lifetime: number = 60;
    isExit: boolean = false;
    swirlAngle: number = 0;
    portalScale: number = 1.0;
    rings: { angle: number; speed: number; radius: number }[];
    particles: { angle: number; dist: number; speed: number; size: number }[];

    constructor(id: number, x: number, y: number, isExit: boolean = false) {
        super(id, EntityType.VOID_PORTAL, x, y, 80, COLORS.voidPortal);
        this.isExit = isExit;
        this.mass = 100000;
        this.health = 1000000;
        this.maxHealth = 1000000;
        this.invulnerableTime = 1000000; 

        this.rings = [
            { angle: Math.random() * Math.PI * 2, speed: 6.28, radius: 0.9 }, // 1s
            { angle: Math.random() * Math.PI * 2, speed: 3.14, radius: 1.1 }, // 2s
            { angle: Math.random() * Math.PI * 2, speed: 2.09, radius: 1.3 }, // 3s
        ];

        this.particles = Array.from({ length: 12 }, () => ({
            angle: Math.random() * Math.PI * 2,
            dist: 60 + Math.random() * 80,
            speed: (Math.random() * 0.5 + 0.5) * (Math.random() > 0.5 ? 1 : -1),
            size: 2 + Math.random() * 3
        }));
    }

    override update(dt: number) {
        const timeScale = Math.min(dt * 60, 2.0);
        this.swirlAngle += dt * 3;
        
        this.portalScale = 1.0 + Math.sin(Date.now() / 300) * 0.05;

        this.rings.forEach(ring => {
            ring.angle += ring.speed * dt;
        });

        this.particles.forEach(p => {
            p.angle += p.speed * dt;
        });

        if (!this.isExit) {
            this.lifetime -= dt;
            if (this.lifetime <= 0) this.isDead = true;
        }
        
        super.update(dt);
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        const t = Date.now() / 1000;
        ctx.save();
        ctx.scale(this.portalScale, this.portalScale);

        const glowRadius = this.radius * (1.5 + Math.sin(t * 3) * 0.2);
        const glowIntensity = 0.6 + Math.sin(t * 2) * 0.2;
        const grad = ctx.createRadialGradient(0, 0, 40, 0, 0, glowRadius);
        grad.addColorStop(0, `rgba(26, 0, 51, ${glowIntensity})`);
        grad.addColorStop(0.5, `rgba(110, 44, 242, ${glowIntensity * 0.6})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1a0033';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6e2cf2';
        ctx.lineWidth = 4;
        ctx.stroke();

        this.rings.forEach((ring, i) => {
            ctx.save();
            ctx.rotate(ring.angle);
            ctx.strokeStyle = i === 0 ? '#ffffff' : i === 1 ? '#a855f7' : '#6e2cf2';
            ctx.lineWidth = 3 - i * 0.5;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius * ring.radius, this.radius * ring.radius * 0.3, (i * Math.PI) / 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

        this.particles.forEach(p => {
            ctx.fillStyle = '#a855f7';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#a855f7';
            const px = Math.cos(p.angle) * p.dist;
            const py = Math.sin(p.angle) * p.dist;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        if (Math.sin(t) > 0.8) {
            const scanY = (Math.sin(t * 10) * 0.5 + 0.5) * this.radius * 2 - this.radius;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(-this.radius, scanY, this.radius * 2, 2);
        }

        ctx.restore();
    }
}

class Tank extends Entity {
  classType: TankClass = TankClass.BASIC;
  stats: Record<StatType, number>;
  barrels: number[][]; 
  barrelCooldowns: number[];
  barrelMaxCooldowns: number[];
  barrelHeat: number[]; 
  barrelRecoilOffsets: number[];
  nextBarrelIndex: number = 0; 
  score: number = 0;
  level: number = 1; 
  availableStatPoints: number = 0;
  isBot: boolean = false;
  aiState: AIState = AIState.IDLE;
  aiTargetId: number | null = null;
  aiUpdateTimer: number = 0;
  visionRange: number = 700;
  aiMoveDir: Vector2 = { x: 0, y: 0 };
  lastSteering: Vector2 = { x: 0, y: 0 };
  aiTargetRot: number = 0;
  aiShooting: boolean = false;
  idleDir: Vector2 | null = null;
  strafeDir?: number;
  autoFire: boolean = false;
  autoSpin: boolean = false;
  fov: number = 1.0;
  spread: number = 0.1;
  machineHeat: number = 0;
  machineSpin: number = 0;
  stealthSuppressedUntil: number = 0;

  isTransformed: boolean = false;
  transformationTimer: number = 0;
  activeBuffs: BuffEffect[] = [];

  // Rebirth System
  hasRebirthed: boolean = false;
  bossAbilityTimer: number = 0;
  isSiegeMode: boolean = false;
  autoTurrets: { rotation: number, cooldown: number, targetId: number | null }[] = [];
  repairDrones: { angle: number, dist: number }[] = [];

  // Pacifist Properties
  healingAuraRadius: number = 0;
  healingAuraEfficiency: number = 0;
  healingBurstCooldown: number = 0;
  totalHealedThisSession: number = 0;
  healingHistory: { time: number, amount: number }[] = [];

  // Draining Properties
  drainAuraRadius: number = 0;
  drainAuraDamage: number = 0;
  drainLifestealEfficiency: number = 0;
  drainBurstCooldown: number = 0;
  totalDrainedThisSession: number = 0;
  bloodPactActiveTimer: number = 0;
  regenOverchargeTimer: number = 0;
  regenOverchargeRate: number = 0;
  drainDotStacks: number = 0;
  drainDotTimer: number = 0;
  drainDotTickTimer: number = 0;
  statusHealingUntil: number = 0;
  statusDrainingUntil: number = 0;
  statusAbilityUntil: number = 0;

  // Autonomous Turret Properties
  autoTurretRotation: number = 0;
  autoTurretCooldown: number = 0;
  autoTurretTargetId: number | null = null;
  
  // XP Multiplier System
  xpMultiplier: number = 1.0;
  xpMultiplierTimer: number = 0;
  restorationXpBuffer: number = 0;
  drainXpBuffer: number = 0;
  universalUpgrades: Record<StatType, number>;
  inactiveUpgradeBank: Partial<Record<StatType, number>> = {};
  lastUpgradeRemapSummary: string[] = [];

  // SACRIFICIAL GOAT ABILITY
  isSacrificing: boolean = false;
  abilityTriggered: boolean = false;
  sacrificeActiveTimer: number = 0;
  sacrificeCooldownTimer: number = 0;
  
  // AI Hunting
  aiHuntingSpecialId: number | null = null;
  aiHuntingTimer: number = 0;
  socialScanCooldown: number = 0;
  socialAnchorId: number | null = null;
  socialGestureUntil: number = 0;
  socialWiggleUntil: number = 0;
  savedByPlayerUntil: number = 0;
  socialSpinSignalUntil: number = 0;

  // BURST FIRE SYSTEM
  burstQueue: { barrelIndex: number, delayLeftMs: number }[] = [];

  constructor(id: number, x: number, y: number, isPlayer: boolean, team: Team) {
    let color = COLORS.enemy;
    if (isPlayer) color = COLORS.player;
    else if (team === Team.BLUE) color = COLORS.player;
    else if (team === Team.RED) color = COLORS.enemy;
    super(id, isPlayer ? EntityType.PLAYER : EntityType.ENEMY, x, y, 20, color);
    this.team = team;
    this.isBot = !isPlayer;
    this.mass = 30;
    this.stats = {
        [StatType.REGEN]: 0, [StatType.MAX_HEALTH]: 0, [StatType.MAX_SHIELD]: 0, [StatType.BODY_DAMAGE]: 0,
        [StatType.BULLET_SPEED]: 0, [StatType.BULLET_PENETRATION]: 0, [StatType.BULLET_DAMAGE]: 0,
        [StatType.RELOAD]: 0, [StatType.MOVEMENT_SPEED]: 0, [StatType.BULLET_SPREAD]: 0,
        [StatType.HEALING_RADIUS]: 0, [StatType.HEALING_EFFICIENCY]: 0, [StatType.HEALING_BURST]: 0, [StatType.SUPPORT_XP_MULT]: 0,
        [StatType.DRAIN_RADIUS]: 0, [StatType.DRAIN_EFFICIENCY]: 0, [StatType.DRAIN_LIFESTEAL]: 0, [StatType.DRAIN_BURST]: 0
    };
    this.universalUpgrades = { ...this.stats };
    this.barrels = TANK_CONFIGS[TankClass.BASIC];
    this.barrelCooldowns = new Array(this.barrels.length).fill(0);
    this.barrelMaxCooldowns = new Array(this.barrels.length).fill(100);
    this.barrelHeat = new Array(this.barrels.length).fill(0);
    this.barrelRecoilOffsets = new Array(this.barrels.length).fill(0);
    this.score = 0;
    this.availableStatPoints = 0;
    this.chassisRotation = this.rotation;
  }

  drawChassis(ctx: CanvasRenderingContext2D) {
      // Layer order: team base ring -> class aura field -> chassis.
      this.drawTeamAffiliationRing(ctx);
      this.drawAuras(ctx);
      this.drawMainShape(ctx);
  }

  drawTurret(ctx: CanvasRenderingContext2D) {
      // The barrels and the turret cap
      this.drawBarrels(ctx);
      this.drawTurretCap(ctx);
  }

  drawAuras(ctx: CanvasRenderingContext2D) {
      const isBoss = this.isBossClass(this.classType);
      const isEliteVisual = this.isTransformed;
      const isPacifist = this.isPacifist(this.classType);
      const isDraining = this.isDraining(this.classType);

      if (isPacifist) {
        const t = Date.now() / 1000;
        ctx.save();
        const auraRadius = this.healingAuraRadius * (1.0 + Math.sin(t * 2.3) * 0.035);
        const basePulse = 0.58 + Math.sin(t * 2.2) * 0.16;
        ctx.globalAlpha = 1.0;
        
        // Outer glowing layer
        const grad = ctx.createRadialGradient(0, 0, this.radius * 0.4, 0, 0, auraRadius);
        grad.addColorStop(0, 'rgba(74, 222, 128, 0.35)');
        grad.addColorStop(0.5, 'rgba(34, 197, 94, 0.12)');
        grad.addColorStop(0.85, 'rgba(22, 163, 74, 0.05)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing geometric rings
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.16)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
            const phase = t * 1.6 + i * Math.PI;
            const r = auraRadius * (0.52 + 0.2 * Math.sin(phase));
            ctx.globalAlpha = 0.18 + 0.16 * (0.5 + Math.sin(phase + 0.8) * 0.5);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        
        // Rotating medical symbols in aura
        ctx.save();
        ctx.rotate(t * 0.55);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + basePulse * 0.18})`;
        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate((i / 4) * Math.PI * 2);
            ctx.translate(auraRadius * 0.7, 0);
            this.drawMedicalCrossSimple(ctx, auraRadius * 0.08);
            ctx.restore();
        }
        ctx.restore();
        
        ctx.restore();
      }

      const drainingAuraRadius = this.drainAuraRadius || 0;
      if (isDraining && drainingAuraRadius > 0) {
        const t = Date.now() / 1000;
        ctx.save();
        const auraRadius = drainingAuraRadius * (1.0 + Math.sin(t * 4) * 0.03);
        
        // Sinister deep red gradient
        const grad = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, auraRadius);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
        grad.addColorStop(0.4, 'rgba(185, 28, 28, 0.18)');
        grad.addColorStop(0.8, 'rgba(127, 29, 29, 0.08)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Violent swirling soul-tendrils
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + t * 3.5;
            const r = auraRadius * (0.35 + Math.sin(t * 6 + i) * 0.15);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const cp1x = Math.cos(ang + 0.5) * r * 0.5;
            const cp1y = Math.sin(ang + 0.5) * r * 0.5;
            ctx.quadraticCurveTo(cp1x, cp1y, Math.cos(ang) * r, Math.sin(ang) * r);
            ctx.stroke();
        }

        // Inner core sparks
        ctx.rotate(-t * 1.5);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * this.radius * 1.2, Math.sin(ang) * this.radius * 1.2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
      }

      if (this.isSacrificing) {
        const t = Date.now() / 1000;
        ctx.save();
        const auraRadius = this.radius * (1.6 + Math.sin(t * 10) * 0.1);
        const grad = ctx.createRadialGradient(0, 0, this.radius * 0.8, 0, 0, auraRadius);
        grad.addColorStop(0, 'rgba(30, 0, 0, 0.9)');
        grad.addColorStop(0.4, 'rgba(80, 0, 0, 0.6)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#220000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i=0; i<12; i++) {
            const ang = (i / 12) * Math.PI * 2 + t * 5;
            const r1 = this.radius * 1.1;
            const r2 = this.radius * (1.4 + Math.sin(t * 15 + i) * 0.2);
            ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
            ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        }
        ctx.stroke();
        ctx.restore();
      }

      if (isEliteVisual || isBoss) {
        const t = Date.now() / 1000;
        ctx.save();
        const auraRadius = this.radius * (1.3 + Math.sin(t * 4) * 0.1);
        const auraColor = this.classType === TankClass.COLOSSAL ? 'rgba(159, 118, 252, 0.5)' : 
                          this.classType === TankClass.LEVIATHAN ? 'rgba(0, 178, 225, 0.5)' : 
                          this.classType === TankClass.WARLORD ? 'rgba(241, 78, 84, 0.5)' :
                          this.classType === TankClass.CELESTIAL ? 'rgba(192, 132, 252, 0.58)' : 'rgba(255, 68, 68, 0.4)';
        const auraGrad = ctx.createRadialGradient(0, 0, this.radius * 0.8, 0, 0, auraRadius);
        auraGrad.addColorStop(0, auraColor);
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();

        if (isBoss) {
            ctx.lineWidth = 3;
            if (this.classType === TankClass.COLOSSAL) {
                ctx.strokeStyle = 'rgba(159, 118, 252, 0.8)';
                ctx.rotate(t * 0.5);
                ctx.beginPath();
                for (let i = 0; i < 20; i++) {
                    const ang = (i / 20) * Math.PI * 2;
                    const r = i % 2 === 0 ? this.radius * 1.6 : this.radius * 1.3;
                    if (i === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
                    else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
                }
                ctx.closePath();
                ctx.stroke();
            } else if (this.classType === TankClass.LEVIATHAN) {
                ctx.strokeStyle = 'rgba(0, 178, 225, 0.6)';
                for (let i = 0; i < 3; i++) {
                    const rippleRadius = this.radius + ((t * 50 + i * 40) % 120);
                    ctx.globalAlpha = Math.max(0, 1 - (rippleRadius - this.radius) / 120);
                    ctx.beginPath();
                    ctx.arc(0, 0, rippleRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1.0;
            } else if (this.classType === TankClass.WARLORD) {
                ctx.strokeStyle = 'rgba(241, 78, 84, 0.8)';
                const pulse = Math.sin(t * 3) * 0.1;
                for (let j = 1; j <= 2; j++) {
                    ctx.beginPath();
                    const w = this.radius * 0.8 * (1.2 + j * 0.3 + pulse);
                    const h = this.radius * 1.2 * (1.2 + j * 0.3 + pulse);
                    ctx.rect(-w, -h, w * 2, h * 2);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
      }
  }

  private drawTeamAffiliationRing(ctx: CanvasRenderingContext2D) {
      if (this.team === Team.NONE) return;
      const pulse = 0.6 + Math.sin(Date.now() * 0.006 + this.id) * 0.25;
      const ringRadius = this.radius * 1.35;
      const baseRgb = this.team === Team.BLUE ? '56, 189, 248' : '248, 113, 113';
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.shadowBlur = 10 + pulse * 6;
      ctx.shadowColor = `rgba(${baseRgb},0.6)`;
      ctx.strokeStyle = `rgba(${baseRgb},${0.42 + pulse * 0.18})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${baseRgb},0.28)`;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
  }

  drawMainShape(ctx: CanvasRenderingContext2D) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.border;
    ctx.fillStyle = this.color;
    
    // Custom Chassis Rendering for specific classes
    if (this.classType === TankClass.COLOSSAL) {
        ctx.beginPath();
        for (let i=0; i<5; i++) {
            const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.lineTo(Math.cos(ang) * this.radius, Math.sin(ang) * this.radius);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        for (let i=0; i<5; i++) {
            const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.lineTo(Math.cos(ang) * this.radius * 0.5, Math.sin(ang) * this.radius * 0.5);
        }
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();
        ctx.stroke();
    } else if (this.classType === TankClass.LEVIATHAN) {
        ctx.beginPath();
        for (let i=0; i<8; i++) {
            const ang = (i / 8) * Math.PI * 2 - Math.PI / 8;
            const r = i % 2 === 0 ? this.radius : this.radius * 0.85;
            ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (this.classType === TankClass.WARLORD) {
        ctx.beginPath();
        ctx.roundRect(-this.radius * 0.8, -this.radius * 1.2, this.radius * 1.6, this.radius * 2.4, 8);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.roundRect(-this.radius * 0.4, -this.radius * 0.6, this.radius * 0.8, this.radius * 1.2, 4);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();
        ctx.stroke();
    } else if (this.classType === TankClass.PACIFIST_TRAINEE) {
        // Clean pentagonal trainee shape
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            ctx.lineTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (this.classType === TankClass.DRAINER_TRAINEE) {
        // Sharp triangular trainee shape
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
            ctx.lineTo(Math.cos(angle) * this.radius * 1.1, Math.sin(angle) * this.radius * 1.1);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (this.classType === TankClass.NURSE || this.classType === TankClass.DOCTOR) {
        // High-tech medical chassis
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const r = this.radius * (this.classType === TankClass.DOCTOR ? 1.08 : 0.98);
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        
        const grad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        grad.addColorStop(0, this.color);
        grad.addColorStop(0.5, '#fff');
        grad.addColorStop(1, this.color);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.stroke();
        
        // Inner tech core glow
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(74, 222, 128, 0.25)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.stroke();
    } else if (this.classType === TankClass.PLAGUE_DOCTOR) {
        // Aggressive sharp medical beak shape with tech-noir aesthetic
        const er = this.radius;
        ctx.beginPath();
        ctx.moveTo(er * 1.8, 0); 
        ctx.lineTo(er * 0.5, er * 0.6); 
        ctx.lineTo(-er * 0.8, er * 1.0); 
        ctx.lineTo(-er * 1.3, er * 0.4); 
        ctx.lineTo(-er * 1.3, -er * 0.4); 
        ctx.lineTo(-er * 0.8, -er * 1.0); 
        ctx.lineTo(er * 0.5, -er * 0.6);
        ctx.closePath();
        
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, er * 1.8);
        grad.addColorStop(0, this.color);
        grad.addColorStop(0.8, '#1a1a1a');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Glowing bio-hazard eyes
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = '#ff3333';
        ctx.beginPath(); ctx.arc(er * 0.4, er * 0.38, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(er * 0.4, -er * 0.38, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    } else if (this.classType === TankClass.LEECH) {
        // Star-like sharp draining chassis
        const er = this.radius;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const r = i % 2 === 0 ? er * 1.3 : er * 0.75;
            ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (this.classType === TankClass.VAMPIRE) {
        // Predator-style sharp chassis remastered
        const er = this.radius;
        ctx.beginPath();
        ctx.moveTo(er * 1.5, 0);
        ctx.lineTo(er * 0.3, er * 1.25);
        ctx.lineTo(-er * 1.1, er * 0.95);
        ctx.lineTo(-er * 0.6, 0);
        ctx.lineTo(-er * 1.1, -er * 0.95);
        ctx.lineTo(er * 0.3, -er * 1.25);
        ctx.closePath();
        
        const grad = ctx.createLinearGradient(-er, -er, er, er);
        grad.addColorStop(0, '#500');
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, '#500');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.stroke();
    } else if (this.classType === TankClass.REAPER) {
        // Sinister hooded/scythe chassis remastered
        const er = this.radius;
        ctx.beginPath();
        ctx.moveTo(er * 1.8, 0);
        ctx.bezierCurveTo(er * 1.3, er * 1.6, -er * 0.8, er * 2.0, -er * 1.5, 0);
        ctx.bezierCurveTo(-er * 0.7, -er * 2.0, er * 1.3, -er * 1.6, er * 1.8, 0);
        ctx.closePath();
        
        ctx.save();
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff0000';
        const grad = ctx.createRadialGradient(0, 0, er * 0.2, 0, 0, er * 1.8);
        grad.addColorStop(0, '#000');
        grad.addColorStop(0.7, this.color);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 4;
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    if (this.isPacifist(this.classType)) {
        this.drawMedicalCross(ctx, this.radius * 0.5);
        // Restoration signature plating
        ctx.save();
        ctx.strokeStyle = 'rgba(167, 243, 208, 0.72)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.72, 0);
        ctx.lineTo(this.radius * 0.72, 0);
        ctx.moveTo(0, -this.radius * 0.72);
        ctx.lineTo(0, this.radius * 0.72);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.82, Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();
        ctx.restore();
    } else if (this.isDraining(this.classType)) {
        this.drawVampireTeeth(ctx, this.radius * 0.55);
        // Blood signature jagged trim + dark core sigil
        ctx.save();
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.8)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
            const ang = (i / 7) * Math.PI * 2 + Math.PI / 7;
            const r1 = this.radius * 0.45;
            const r2 = this.radius * 0.9;
            ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
            ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        }
        ctx.stroke();
        const core = ctx.createRadialGradient(0, 0, this.radius * 0.08, 0, 0, this.radius * 0.42);
        core.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
        core.addColorStop(0.55, 'rgba(69, 10, 10, 0.9)');
        core.addColorStop(1, 'rgba(10, 0, 0, 0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    if (this.shield > 1) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#33ccff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
        const alpha = 0.2 + (0.4 * (this.shield / this.maxShield));
        ctx.strokeStyle = `rgba(51, 204, 255, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    }

    if (this.classType === TankClass.GUNNER || this.classType === TankClass.AUTO_GUNNER) {
        const t = Date.now() / 1000;
        const isAuto = this.classType === TankClass.AUTO_GUNNER;
        const pulse = isAuto ? (0.55 + Math.sin(t * 8) * 0.45) : (0.55 + Math.sin(t * 4.2) * 0.45);
        const coreCol = isAuto ? '60,170,255' : '80,255,120';
        const glowOuter = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius * 0.95);
        glowOuter.addColorStop(0, `rgba(${coreCol},${0.55 + pulse * 0.35})`);
        glowOuter.addColorStop(0.6, `rgba(${coreCol},${0.2 + pulse * 0.16})`);
        glowOuter.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowOuter;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.95, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = '#0f1720';
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,240,255,0.35)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${coreCol},${0.65 + pulse * 0.25})`;
        ctx.fill();
    }
  }

  private drawMedicalCrossSimple(ctx: CanvasRenderingContext2D, size: number) {
      const b = size * 0.35;
      ctx.beginPath();
      ctx.moveTo(-size, -b); ctx.lineTo(-b, -b); ctx.lineTo(-b, -size); ctx.lineTo(b, -size);
      ctx.lineTo(b, -b); ctx.lineTo(size, -b); ctx.lineTo(size, b); ctx.lineTo(b, b);
      ctx.lineTo(b, size); ctx.lineTo(-b, size); ctx.lineTo(-b, b); ctx.lineTo(-size, b);
      ctx.closePath();
      ctx.fill();
  }

  private drawMedicalCross(ctx: CanvasRenderingContext2D, size: number) {
      ctx.save();
      const s = size * 1.4;
      const b = s * 0.35;
      
      // Glow background
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-s, -b); ctx.lineTo(-b, -b); ctx.lineTo(-b, -s); ctx.lineTo(b, -s);
      ctx.lineTo(b, -b); ctx.lineTo(s, -b); ctx.lineTo(s, b); ctx.lineTo(b, b);
      ctx.lineTo(b, s); ctx.lineTo(-b, s); ctx.lineTo(-b, b); ctx.lineTo(-s, b);
      ctx.closePath();
      
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
  }

  private drawVampireTeeth(ctx: CanvasRenderingContext2D, size: number) {
      ctx.save();
      const s = size * 1.4;
      
      // Sinister red glow
      const grad = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 1.5);
      grad.addColorStop(0, 'rgba(255, 0, 0, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      // Upper lip/jaw curve
      ctx.moveTo(-s * 0.8, -s * 0.3);
      ctx.quadraticCurveTo(0, -s * 0.7, s * 0.8, -s * 0.3);
      
      // Right heavy fang
      ctx.lineTo(s * 0.5, s * 0.9);
      ctx.lineTo(s * 0.2, 0);
      
      // Inner mouth cavity curve
      ctx.quadraticCurveTo(0, -s * 0.1, -s * 0.2, 0);
      
      // Left heavy fang
      ctx.lineTo(-s * 0.5, s * 0.9);
      ctx.lineTo(-s * 0.8, -s * 0.3);
      ctx.closePath();
      
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineJoin = "round";
      ctx.stroke();
      
      // Blood effects
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.9 + 2, s * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#ff0000";
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(-s * 0.5, s * 0.9 + 1, s * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "#990000";
      ctx.fill();
      
      ctx.restore();
  }


  drawBarrels(ctx: CanvasRenderingContext2D) {
      const isEliteVisual = this.isTransformed;
      const isBoss = this.isBossClass(this.classType);
      const isHeavyClass = this.classType === TankClass.DESTROYER || this.classType === TankClass.ANNIHILATOR || this.classType === TankClass.HYBRID;
      const isRapidFireClass = this.classType === TankClass.MACHINE_GUN || this.classType === TankClass.GUNNER || this.classType === TankClass.AUTO_GUNNER || this.classType === TankClass.STREAMLINER || this.classType === TankClass.SPRAYER;
      const isSprayer = this.classType === TankClass.SPRAYER;
      const sprayerCoreIndex = Math.floor(this.barrels.length / 2);

      this.barrels.forEach((barrel, i) => {
        const [length, width, xOff, angleOff, delayMultiplier, yOff = 0, spread = 1] = barrel;
        ctx.save();
        ctx.rotate(angleOff);
        ctx.translate(xOff * this.radius, yOff * this.radius);
        
        const cooldown = Math.max(0, this.barrelCooldowns[i] || 0);
        const maxCd = this.barrelMaxCooldowns[i] || 100;
        const progress = cooldown / maxCd;
        const easedProgress = Math.pow(progress, 1.3);
        
        const recoilFactor = (isHeavyClass || isBoss) ? 0.75 : (isRapidFireClass ? 0.58 : 0.45);
        const recoilAmount = easedProgress * (this.radius * recoilFactor) + ((this.barrelRecoilOffsets[i] || 0) * this.radius * (isSprayer ? 0.75 : 0.5));
        ctx.translate(-recoilAmount, 0);
        
        const lengthSqueeze = 1 - (easedProgress * ((isHeavyClass || isBoss) ? 0.25 : (isRapidFireClass ? 0.2 : 0.15)));
        const widthSqueeze = 1 + (easedProgress * ((isHeavyClass || isBoss) ? 0.35 : (isRapidFireClass ? 0.3 : 0.22))); 
        ctx.scale(lengthSqueeze, widthSqueeze);
        if (isRapidFireClass && this.barrelHeat[i] > 0.15) {
            const vib = this.barrelHeat[i] * 0.55;
            ctx.translate((Math.random() - 0.5) * vib, (Math.random() - 0.5) * vib);
        }
        
        const isDroneSpawner = (this.classType === TankClass.OVERLORD || this.classType === TankClass.OVERSEER || this.classType === TankClass.MANAGER || this.classType === TankClass.HYBRID);
        const droneBarrelIndex = (this.classType === TankClass.HYBRID) ? 1 : -1; 
        const currentIsDroneBarrel = isDroneSpawner && (this.classType !== TankClass.HYBRID || i === droneBarrelIndex);

        const bLen = length * this.radius;
        const bWid = width * this.radius;
        const strokeCol = (isEliteVisual || isBoss) ? (isBoss ? '#222' : '#ff4444') : COLORS.border;
        const baseFill = (isEliteVisual || isBoss) ? (isBoss ? '#444' : '#333333') : (currentIsDroneBarrel ? '#444444' : COLORS.barrel);

        ctx.lineWidth = 3;
        ctx.strokeStyle = strokeCol;
        
        const heat = this.barrelHeat[i] || 0;
        let fillStyle: any = baseFill;

        if ((isHeavyClass || isBoss) && !currentIsDroneBarrel) {
            const grad = ctx.createLinearGradient(0, 0, bLen, 0);
            grad.addColorStop(0, baseFill);
            if (heat > 0.1) {
                const heatCol = `rgba(255, ${Math.floor(100 + heat * 155)}, ${Math.floor(50 + heat * 50)}, ${Math.min(1, heat)})`;
                const hotCenter = `rgba(255, 255, 255, ${Math.min(1, heat * 1.5)})`;
                grad.addColorStop(0.6, baseFill);
                grad.addColorStop(0.85, heatCol);
                grad.addColorStop(1.0, hotCenter);
            } else {
                grad.addColorStop(1.0, '#bbb');
            }
            fillStyle = grad;
        } else {
            const grad = ctx.createLinearGradient(0, -bWid/2, 0, bWid/2);
            grad.addColorStop(0, baseFill);
            grad.addColorStop(0.5, (isHeavyClass || isBoss) ? '#888' : '#aaa');
            grad.addColorStop(1, baseFill);
            fillStyle = grad;
        }

        ctx.fillStyle = fillStyle;

        const isSniper = this.classType === TankClass.SNIPER;
        const isAssassin = this.classType === TankClass.ASSASSIN;
        const isRanger = this.classType === TankClass.RANGER;
        const isStalker = this.classType === TankClass.STALKER;
        const isHunter = this.classType === TankClass.HUNTER;
        const isXHunter = this.classType === TankClass.X_HUNTER;
        const isAnnihilator = this.classType === TankClass.ANNIHILATOR;
        const isMachineGun = this.classType === TankClass.MACHINE_GUN;
        const isOverseer = this.classType === TankClass.OVERSEER;
        const isOverlord = this.classType === TankClass.OVERLORD;
        const isManager = this.classType === TankClass.MANAGER;
        const isGunner = this.classType === TankClass.GUNNER;
        const isAutoGunner = this.classType === TankClass.AUTO_GUNNER;
        const isGunnerFamily = isGunner || isAutoGunner;
        const isTripleTank = this.classType === TankClass.TRIPLE_TANK;

        if (isSprayer && !currentIsDroneBarrel) {
            const isCore = i === sprayerCoreIndex;
            const heatMix = Math.min(1, heat * 1.15 + (isCore ? 0.14 : 0));
            const shellGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            shellGrad.addColorStop(0, isCore ? '#2b3340' : '#2a3642');
            shellGrad.addColorStop(0.5, isCore ? '#6f7f97' : '#53667d');
            shellGrad.addColorStop(1, `rgba(200, ${Math.floor(210 + heatMix * 45)}, 255, ${0.34 + heatMix * 0.35})`);
            ctx.fillStyle = shellGrad;

            const w = isCore ? bWid * 1.05 : bWid * 0.96;
            const nose = isCore ? 0.24 : 0.2;
            ctx.beginPath();
            ctx.moveTo(0, -w * 0.5);
            ctx.lineTo(bLen * (1 - nose), -w * 0.5);
            ctx.lineTo(bLen, -w * 0.23);
            ctx.lineTo(bLen, w * 0.23);
            ctx.lineTo(bLen * (1 - nose), w * 0.5);
            ctx.lineTo(0, w * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Metallic trim rails and vent strip.
            ctx.fillStyle = isCore ? 'rgba(220,240,255,0.22)' : 'rgba(190,215,245,0.2)';
            ctx.fillRect(bLen * 0.08, -w * 0.43, bLen * 0.78, Math.max(1.4, w * 0.12));
            ctx.fillRect(bLen * 0.08, w * 0.31, bLen * 0.78, Math.max(1.4, w * 0.12));
            ctx.fillStyle = `rgba(120, 200, 255, ${0.14 + heatMix * 0.24})`;
            ctx.fillRect(bLen * 0.22, -w * 0.06, bLen * 0.56, w * 0.12);
        } else if (isMachineGun && !currentIsDroneBarrel) {
            const ventHeat = Math.min(1, this.machineHeat * 1.2 + heat * 0.35);
            const coreGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            coreGrad.addColorStop(0, '#404b55');
            coreGrad.addColorStop(0.5, '#6b7280');
            coreGrad.addColorStop(0.8, `rgba(255, ${Math.floor(140 + ventHeat * 90)}, 80, ${0.4 + ventHeat * 0.4})`);
            coreGrad.addColorStop(1, `rgba(255, ${Math.floor(200 + ventHeat * 40)}, 120, ${0.65 + ventHeat * 0.25})`);
            ctx.fillStyle = coreGrad;
            ctx.fillRect(0, -bWid * 0.52, bLen, bWid * 1.04);
            ctx.strokeRect(0, -bWid * 0.52, bLen, bWid * 1.04);

            // Servo vent slits
            ctx.strokeStyle = `rgba(20,20,20,${0.45 + ventHeat * 0.3})`;
            ctx.lineWidth = 1.8;
            for (let s = 0.18; s < 0.92; s += 0.14) {
                ctx.beginPath();
                ctx.moveTo(bLen * s, -bWid * 0.45);
                ctx.lineTo(bLen * s, bWid * 0.45);
                ctx.stroke();
            }
        } else if (currentIsDroneBarrel) {
            if (isOverseer || isOverlord || isManager) {
                const pulse = 0.5 + Math.sin(Date.now() * 0.008 + i) * 0.5;
                const coreCol = isOverlord ? `rgba(100,200,255,${0.35 + pulse * 0.35})` : isManager ? `rgba(110,255,220,${0.28 + pulse * 0.3})` : `rgba(130,255,210,${0.3 + pulse * 0.25})`;
                ctx.fillStyle = '#2b3440';
                ctx.fillRect(0, -bWid * 0.52, bLen * 0.72, bWid * 1.04);
                ctx.strokeRect(0, -bWid * 0.52, bLen * 0.72, bWid * 1.04);
                ctx.fillStyle = coreCol;
                ctx.fillRect(bLen * 0.72, -bWid * 0.28, bLen * 0.28, bWid * 0.56);
                ctx.strokeRect(bLen * 0.72, -bWid * 0.28, bLen * 0.28, bWid * 0.56);
                ctx.fillStyle = `rgba(255,255,255,${0.15 + pulse * 0.2})`;
                ctx.fillRect(bLen * 0.2, -bWid * 0.08, bLen * 0.45, bWid * 0.16);
            } else {
                ctx.beginPath();
                ctx.rect(0, -bWid/2, bLen, bWid);
                ctx.fill();
                ctx.stroke();
            }
        } else if (isGunnerFamily) {
            const heatMix = Math.min(1, heat * 1.1 + this.machineHeat * 0.5);
            const coreRgb = isAutoGunner ? '80,180,255' : '110,255,130';
            const jacketGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            jacketGrad.addColorStop(0, '#2f3b49');
            jacketGrad.addColorStop(0.45, '#556579');
            jacketGrad.addColorStop(1, `rgba(255,${Math.floor(145 + heatMix * 80)},${Math.floor(85 + heatMix * 40)},${0.35 + heatMix * 0.4})`);
            ctx.fillStyle = jacketGrad;
            ctx.fillRect(0, -bWid * 0.52, bLen, bWid * 1.04);
            ctx.strokeRect(0, -bWid * 0.52, bLen, bWid * 1.04);

            // Reinforcing rails
            ctx.fillStyle = '#1f2935';
            ctx.fillRect(0, -bWid * 0.56, bLen * 0.92, bWid * 0.14);
            ctx.fillRect(0, bWid * 0.42, bLen * 0.92, bWid * 0.14);

            // Vent slots
            ctx.strokeStyle = `rgba(15,15,15,${0.5 + heatMix * 0.35})`;
            ctx.lineWidth = 1.5;
            for (let slot = 0.16; slot < 0.94; slot += 0.15) {
                ctx.beginPath();
                ctx.moveTo(bLen * slot, -bWid * 0.44);
                ctx.lineTo(bLen * slot, bWid * 0.44);
                ctx.stroke();
            }

            // Energy conduit strip
            const conduitPulse = 0.4 + Math.sin(Date.now() * (isAutoGunner ? 0.014 : 0.009) + i) * 0.6;
            ctx.fillStyle = `rgba(${coreRgb},${0.18 + conduitPulse * 0.22})`;
            ctx.fillRect(bLen * 0.22, -bWid * 0.08, bLen * 0.66, bWid * 0.16);
        } else if (isTripleTank) {
            const pulse = 0.5 + Math.sin(Date.now() * 0.01 + i) * 0.5;
            const triGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            triGrad.addColorStop(0, '#3a4656');
            triGrad.addColorStop(0.5, '#65758a');
            triGrad.addColorStop(1, `rgba(190,220,255,${0.35 + pulse * 0.18})`);
            ctx.fillStyle = triGrad;
            ctx.beginPath();
            ctx.moveTo(0, -bWid * 0.52);
            ctx.lineTo(bLen * 0.78, -bWid * 0.52);
            ctx.lineTo(bLen, -bWid * 0.3);
            ctx.lineTo(bLen, bWid * 0.3);
            ctx.lineTo(bLen * 0.78, bWid * 0.52);
            ctx.lineTo(0, bWid * 0.52);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Mechanical reinforcing rail and vent slots
            ctx.fillStyle = '#212b36';
            ctx.fillRect(0, -bWid * 0.58, bLen * 0.86, bWid * 0.12);
            ctx.fillRect(0, bWid * 0.46, bLen * 0.86, bWid * 0.12);
            ctx.strokeStyle = 'rgba(18,24,30,0.65)';
            ctx.lineWidth = 1.2;
            for (let slot = 0.18; slot < 0.86; slot += 0.14) {
                ctx.beginPath();
                ctx.moveTo(bLen * slot, -bWid * 0.42);
                ctx.lineTo(bLen * slot, bWid * 0.42);
                ctx.stroke();
            }
        } else if (isSniper || isAssassin || isRanger || isStalker || isHunter || isXHunter || isAnnihilator) {
            // Reworked custom premium tactical barrel visuals
            if (isSniper) {
                // Tactical sleeved barrel
                ctx.fillRect(0, -bWid * 0.6, bLen * 0.45, bWid * 1.2);
                ctx.strokeRect(0, -bWid * 0.6, bLen * 0.45, bWid * 1.2);

                const endWid = bWid * 0.8;
                ctx.beginPath();
                ctx.moveTo(0, -bWid * 0.45);
                ctx.lineTo(bLen * 0.95, -endWid / 2);
                ctx.lineTo(bLen * 0.95, endWid / 2);
                ctx.lineTo(0, bWid * 0.45);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.fillRect(bLen * 0.95, -bWid * 0.55, bLen * 0.05, bWid * 1.1);
                ctx.strokeRect(bLen * 0.95, -bWid * 0.55, bLen * 0.05, bWid * 1.1);
            } else if (isAssassin) {
                // Multi-stage sleek assassin barrel
                ctx.fillRect(0, -bWid * 0.65, bLen * 0.35, bWid * 1.3);
                ctx.strokeRect(0, -bWid * 0.65, bLen * 0.35, bWid * 1.3);

                ctx.fillRect(bLen * 0.35, -bWid * 0.55, bLen * 0.3, bWid * 1.1);
                ctx.strokeRect(bLen * 0.35, -bWid * 0.55, bLen * 0.3, bWid * 1.1);

                const endWid = bWid * 0.7;
                ctx.beginPath();
                ctx.moveTo(bLen * 0.65, -bWid * 0.42);
                ctx.lineTo(bLen * 0.97, -endWid / 2);
                ctx.lineTo(bLen * 0.97, endWid / 2);
                ctx.lineTo(bLen * 0.65, bWid * 0.42);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.fillRect(bLen * 0.97, -bWid * 0.55, bLen * 0.03, bWid * 1.1);
                ctx.strokeRect(bLen * 0.97, -bWid * 0.55, bLen * 0.03, bWid * 1.1);
            } else if (isRanger) {
                // Heavy rail-sniper long barrel
                ctx.fillRect(0, -bWid * 0.72, bLen * 0.3, bWid * 1.44);
                ctx.strokeRect(0, -bWid * 0.72, bLen * 0.3, bWid * 1.44);

                ctx.fillRect(bLen * 0.3, -bWid * 0.61, bLen * 0.35, bWid * 1.22);
                ctx.strokeRect(bLen * 0.3, -bWid * 0.61, bLen * 0.35, bWid * 1.22);

                ctx.fillRect(bLen * 0.65, -bWid * 0.4, bLen * 0.3, bWid * 0.8);
                ctx.strokeRect(bLen * 0.65, -bWid * 0.4, bLen * 0.3, bWid * 0.8);

                ctx.fillRect(bLen * 0.95, -bWid * 0.65, bLen * 0.05, bWid * 1.3);
                ctx.strokeRect(bLen * 0.95, -bWid * 0.65, bLen * 0.05, bWid * 1.3);
            } else if (isStalker) {
                // Cloaked heavyweight tactical suppressor
                ctx.fillRect(0, -bWid * 0.65, bLen * 0.2, bWid * 1.3);
                ctx.strokeRect(0, -bWid * 0.65, bLen * 0.2, bWid * 1.3);

                ctx.fillRect(bLen * 0.2, -bWid * 0.7, bLen * 0.65, bWid * 1.4);
                ctx.strokeRect(bLen * 0.2, -bWid * 0.7, bLen * 0.65, bWid * 1.4);

                // Draw tactical ribbing on silencer
                ctx.save();
                ctx.strokeStyle = '#222222';
                ctx.lineWidth = 2;
                for(let rIdx = 0.25; rIdx < 0.8; rIdx += 0.12) {
                    ctx.beginPath();
                    ctx.moveTo(bLen * rIdx, -bWid * 0.7);
                    ctx.lineTo(bLen * rIdx, bWid * 0.7);
                    ctx.stroke();
                }
                ctx.restore();

                ctx.fillRect(bLen * 0.85, -bWid * 0.37, bLen * 0.15, bWid * 0.75);
                ctx.strokeRect(bLen * 0.85, -bWid * 0.37, bLen * 0.15, bWid * 0.75);
            } else if (isHunter) {
                // Stacked-recoil shotgun pump
                if (i === 0) { // Bottom/Outer
                    ctx.fillRect(0, -bWid * 0.55, bLen * 0.8, bWid * 1.1);
                    ctx.strokeRect(0, -bWid * 0.55, bLen * 0.8, bWid * 1.1);
                } else { // Top/Inner
                    ctx.fillRect(0, -bWid * 0.35, bLen, bWid * 0.7);
                    ctx.strokeRect(0, -bWid * 0.35, bLen, bWid * 0.7);
                }
            } else if (isXHunter) {
                // Stacked telescopic gun
                if (i === 0) { // Outer heavy sleeve
                    ctx.fillRect(0, -bWid * 0.52, bLen * 0.65, bWid * 1.04);
                    ctx.strokeRect(0, -bWid * 0.52, bLen * 0.65, bWid * 1.04);
                } else if (i === 1) { // Mid-segment
                    ctx.fillRect(0, -bWid * 0.44, bLen * 0.85, bWid * 0.88);
                    ctx.strokeRect(0, -bWid * 0.44, bLen * 0.85, bWid * 0.88);
                } else { // Inner needle segment
                    ctx.fillRect(0, -bWid * 0.3, bLen, bWid * 0.6);
                    ctx.strokeRect(0, -bWid * 0.3, bLen, bWid * 0.6);
                }
            } else if (isAnnihilator) {
                // Remastered Annihilator Launcher
                // 1. Heavy reinforced breach block / generator at back
                ctx.fillStyle = '#2d3748';
                ctx.fillRect(0, -bWid * 0.55, bLen * 0.35, bWid * 1.1);
                ctx.strokeRect(0, -bWid * 0.55, bLen * 0.35, bWid * 1.1);

                // Glow core track in center
                const coreGrad = ctx.createLinearGradient(bLen * 0.35, 0, bLen * 0.85, 0);
                coreGrad.addColorStop(0, '#10b981'); // Emerald green start
                coreGrad.addColorStop(1, '#34d399'); // Lighter emerald green end
                ctx.fillStyle = coreGrad;
                ctx.fillRect(bLen * 0.35, -bWid * 0.28, bLen * 0.5, bWid * 0.56);

                // Interlocking stabilizer magnetic bands
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(bLen * 0.45, -bWid * 0.45, bLen * 0.08, bWid * 0.9);
                ctx.strokeRect(bLen * 0.45, -bWid * 0.45, bLen * 0.08, bWid * 0.9);
                ctx.fillRect(bLen * 0.65, -bWid * 0.45, bLen * 0.08, bWid * 0.9);
                ctx.strokeRect(bLen * 0.65, -bWid * 0.45, bLen * 0.08, bWid * 0.9);

                // Heavy reinforced support rails on top & bottom
                ctx.fillStyle = baseFill;
                ctx.fillRect(bLen * 0.35, -bWid * 0.5, bLen * 0.5, bWid * 0.18);
                ctx.strokeRect(bLen * 0.35, -bWid * 0.5, bLen * 0.5, bWid * 0.18);
                ctx.fillRect(bLen * 0.35, bWid * 0.32, bLen * 0.5, bWid * 0.18);
                ctx.strokeRect(bLen * 0.35, bWid * 0.32, bLen * 0.5, bWid * 0.18);

                // Mechanical piston rivets
                ctx.fillStyle = '#1a202c';
                ctx.beginPath();
                ctx.arc(bLen * 0.15, -bWid * 0.35, 3, 0, Math.PI * 2);
                ctx.arc(bLen * 0.15, bWid * 0.35, 3, 0, Math.PI * 2);
                ctx.arc(bLen * 0.28, -bWid * 0.35, 3, 0, Math.PI * 2);
                ctx.arc(bLen * 0.28, bWid * 0.35, 3, 0, Math.PI * 2);
                ctx.fill();

                // 2. Massively Flared Magnetic Containment Muzzle at end
                const endWid = bWid * 0.72;
                ctx.fillStyle = baseFill;
                ctx.beginPath();
                ctx.moveTo(bLen * 0.85, -bWid * 0.5);
                ctx.lineTo(bLen, -endWid);
                ctx.lineTo(bLen, endWid);
                ctx.lineTo(bLen * 0.85, bWid * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // End muzzle ring
                ctx.fillStyle = '#2d3748';
                ctx.fillRect(bLen * 0.96, -endWid - 2, bLen * 0.04, endWid * 2 + 4);
                ctx.strokeRect(bLen * 0.96, -endWid - 2, bLen * 0.04, endWid * 2 + 4);
            }
        } else if (this.classType === TankClass.HYBRID) {
            if (i === 0) {
                // Hybrid primary: destroyer-grade reinforced cannon
                ctx.fillStyle = '#3a3a48';
                ctx.fillRect(0, -bWid * 0.56, bLen * 0.35, bWid * 1.12);
                ctx.strokeRect(0, -bWid * 0.56, bLen * 0.35, bWid * 1.12);
                const coreGrad = ctx.createLinearGradient(bLen * 0.35, 0, bLen * 0.9, 0);
                coreGrad.addColorStop(0, '#8b5cf6');
                coreGrad.addColorStop(1, '#c084fc');
                ctx.fillStyle = coreGrad;
                ctx.fillRect(bLen * 0.35, -bWid * 0.26, bLen * 0.55, bWid * 0.52);
                ctx.fillStyle = '#4f46e5';
                ctx.fillRect(bLen * 0.52, -bWid * 0.45, bLen * 0.08, bWid * 0.9);
                ctx.strokeRect(bLen * 0.52, -bWid * 0.45, bLen * 0.08, bWid * 0.9);
                const endWid = bWid * 0.76;
                ctx.fillStyle = '#444';
                ctx.beginPath();
                ctx.moveTo(bLen * 0.9, -bWid * 0.5);
                ctx.lineTo(bLen, -endWid);
                ctx.lineTo(bLen, endWid);
                ctx.lineTo(bLen * 0.9, bWid * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                // Hybrid support emitter / drone relay
                ctx.fillStyle = '#4338ca';
                ctx.fillRect(0, -bWid * 0.4, bLen * 0.9, bWid * 0.8);
                ctx.strokeRect(0, -bWid * 0.4, bLen * 0.9, bWid * 0.8);
                ctx.fillStyle = '#c4b5fd';
                ctx.fillRect(bLen * 0.8, -bWid * 0.22, bLen * 0.2, bWid * 0.44);
                ctx.strokeRect(bLen * 0.8, -bWid * 0.22, bLen * 0.2, bWid * 0.44);
            }
        } else if (spread !== 1) {
            const endWid = bWid * spread;
            ctx.beginPath();
            ctx.moveTo(0, -bWid / 2);
            ctx.lineTo(bLen, -endWid / 2);
            ctx.lineTo(bLen, endWid / 2);
            ctx.lineTo(0, bWid / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(0, -bWid/2, bLen, bWid);
            ctx.strokeRect(0, -bWid/2, bLen, bWid);
        }
        
        ctx.beginPath();
        ctx.moveTo(bLen, - (bWid * (spread || 1)) / 2);
        ctx.lineTo(bLen, (bWid * (spread || 1)) / 2);
        ctx.strokeStyle = (isHeavyClass || isBoss) ? `rgba(20, 20, 20, ${0.5 + heat * 0.5})` : '#444';
        ctx.stroke();

        ctx.restore();
      });

      if (this.classType === TankClass.COLOSSAL) {
          this.autoTurrets.forEach((turret, idx) => {
              const angle = (idx / 3) * Math.PI * 2 + Math.PI / 6;
              const dist = this.radius * 0.8;
              ctx.save();
              ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
              ctx.rotate(turret.rotation - this.rotation);
              ctx.fillStyle = COLORS.barrel;
              ctx.strokeStyle = COLORS.border;
              ctx.lineWidth = 2;
              const tCd = Math.max(0, turret.cooldown / 200);
              const tRecoil = Math.pow(tCd, 1.3) * 5;
              ctx.fillRect(-tRecoil, -6, 20, 5);
              ctx.strokeRect(-tRecoil, -6, 20, 5);
              ctx.fillRect(-tRecoil, 1, 20, 5);
              ctx.strokeRect(-tRecoil, 1, 20, 5);
              ctx.beginPath();
              ctx.arc(0, 0, 12, 0, Math.PI * 2);
              ctx.fillStyle = '#9f76fc';
              ctx.fill();
              ctx.stroke();
              ctx.restore();
          });
      }

      if (this.classType === TankClass.LEVIATHAN) {
          [Math.PI / 2, -Math.PI / 2].forEach(angle => {
              const dist = this.radius * 0.7;
              ctx.save();
              ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
              ctx.rotate(Math.sin(Date.now() / 500) * 0.5);
              ctx.fillStyle = COLORS.barrel;
              ctx.fillRect(0, -4, 15, 8);
              ctx.strokeRect(0, -4, 15, 8);
              ctx.beginPath();
              ctx.arc(0, 0, 10, 0, Math.PI * 2);
              ctx.fillStyle = '#00b2e1';
              ctx.fill();
              ctx.stroke();
              ctx.restore();
          });
      }

      if (this.classType === TankClass.WARLORD) {
          this.repairDrones.forEach(drone => {
              ctx.save();
              ctx.rotate(drone.angle - this.rotation);
              ctx.translate(drone.dist, 0);
              ctx.beginPath();
              ctx.arc(0, 0, 8, 0, Math.PI * 2);
              ctx.fillStyle = '#f14e54';
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.restore();
          });
      }

      if (this.classType === TankClass.AUTO_GUNNER) {
          const trackingPulse = 0.5 + Math.sin(Date.now() * 0.01) * 0.5;
          ctx.save();
          // Integrated rotating platform
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 0.58, 0, Math.PI * 2);
          ctx.fillStyle = '#2f3946';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#1b222b';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 0.42, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 220, 255, ${0.28 + trackingPulse * 0.24})`;
          ctx.stroke();

          ctx.rotate(this.autoTurretRotation - this.rotation);
          const tcd = this.autoTurretCooldown / 100;
          const tr = Math.pow(Math.max(0, tcd), 1.3) * 5;
          const turretGrad = ctx.createLinearGradient(0, -this.radius * 0.22, 0, this.radius * 0.22);
          turretGrad.addColorStop(0, '#75879d');
          turretGrad.addColorStop(1, '#465567');
          ctx.fillStyle = turretGrad;
          ctx.strokeStyle = '#1f2933';
          ctx.lineWidth = 2;
          ctx.fillRect(-tr, -this.radius * 0.2, this.radius * 0.98, this.radius * 0.4);
          ctx.strokeRect(-tr, -this.radius * 0.2, this.radius * 0.98, this.radius * 0.4);
          ctx.fillStyle = `rgba(120, 255, 230, ${0.2 + trackingPulse * 0.22})`;
          ctx.fillRect(this.radius * 0.2, -this.radius * 0.06, this.radius * 0.48, this.radius * 0.12);
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 0.34, 0, Math.PI * 2);
          ctx.fillStyle = "#3d4a59";
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
          ctx.stroke();

          // Micro-reactor + tracking indicator
          ctx.beginPath();
          ctx.arc(0, 0, this.radius * 0.11, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(90, 200, 255, ${0.45 + trackingPulse * 0.35})`;
          ctx.fill();
          ctx.strokeStyle = 'rgba(170,230,255,0.45)';
          ctx.stroke();
          ctx.strokeStyle = `rgba(100, 220, 255, ${0.2 + trackingPulse * 0.25})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(this.radius * 0.4, 0);
          ctx.lineTo(this.radius * 1.7, 0);
          ctx.stroke();
          ctx.restore();
      }
  }

  drawTurretCap(ctx: CanvasRenderingContext2D) {
      if (this.isTransformed) {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
  }

  override draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const now = Date.now();
    if (this.classType === TankClass.STALKER) {
      // Stalker cloak is soft while idle, but always drops hard right after firing.
      const isSuppressed = now < this.stealthSuppressedUntil;
      const cloakAlpha = isSuppressed ? 0.92 : 0.26;
      ctx.globalAlpha *= cloakAlpha;
    }
    if (this.invulnerableTime > 0) ctx.globalAlpha = 0.5;
    ctx.translate(this.pos.x, this.pos.y);
    
    // Draw Chassis/Body at chassis rotation
    ctx.save();
    ctx.rotate(this.chassisRotation);
    this.drawChassis(ctx);
    ctx.restore();

    // Draw Turret/Barrels at turret rotation (this.rotation)
    ctx.save();
    ctx.rotate(this.rotation);
    this.drawTurret(ctx);
    ctx.restore();

    ctx.restore();
    
    if (this.health < this.maxHealth && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL) this.drawHealthBar(ctx);
    if (this.name && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL) this.drawName(ctx);
  }

  isPacifist(cls: TankClass): boolean {
    return cls === TankClass.PACIFIST_TRAINEE || cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR;
  }

  isBossClass(cls: TankClass): boolean {
    return cls === TankClass.COLOSSAL || cls === TankClass.LEVIATHAN || cls === TankClass.WARLORD || cls === TankClass.CELESTIAL;
  }

  isDraining(cls: TankClass): boolean {
    return cls === TankClass.DRAINER_TRAINEE || cls === TankClass.LEECH || cls === TankClass.VAMPIRE || cls === TankClass.REAPER;
  }

  override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
    let adjusted = amount;
    if (this.isBossClass(this.classType)) {
      const mitigation = this.classType === TankClass.CELESTIAL ? 0.3 : 0.22;
      adjusted *= (1 - mitigation);
      // Dampen rapid projectile chip in late-game.
      if (sourceId !== null) {
        const engine = (window as any).gameEngine as GameEngine | undefined;
        const src = engine?.entities.find(e => e.id === sourceId);
        if (src && (src.type === EntityType.BULLET || src.type === EntityType.DRONE || src.type === EntityType.MINI_TANK)) {
          adjusted *= 0.78;
        }
      }
    }
    super.takeDamage(adjusted, sourceId, isBodyDamage);
  }

  updateStats() {
    const powerTokenBuff = this.activeBuffs?.find(b => b.type === 'POWER_TOKEN');
    const statBonus = powerTokenBuff ? 2 : 0;
    
    // Store old max health for smooth health ratio scaling
    const oldMaxHealth = this.maxHealth || BASE_STATS.health;
    
    // Smooth Incremental Size Growth based strictly on level
    const levelGrowthFactor = 0.3;
    const baseRadius = 20;
    this.radius = baseRadius + (this.level - 1) * levelGrowthFactor;
    this.mass = this.radius * 1.5; 

    const isBoss = this.isBossClass(this.classType);
    const isPacifist = this.classType === TankClass.PACIFIST_TRAINEE || this.classType === TankClass.NURSE || this.classType === TankClass.DOCTOR || this.classType === TankClass.PLAGUE_DOCTOR;
    const isDraining = this.classType === TankClass.DRAINER_TRAINEE || this.classType === TankClass.LEECH || this.classType === TankClass.VAMPIRE || this.classType === TankClass.REAPER;

    // Upgraded formulas for Body Damage and Max Health calculation:
    // We incorporate a physical inertial weight factor and a dynamic level component for richer gameplay.
    const inertiaFactor = 0.85 + (this.radius / 20) * 0.15;
    const levelFactor = 1.0 + (this.level - 1) * 0.015;

    if (this.isTransformed) {
        this.maxHealth = 100000;
        this.damage = 60; 
        this.radius *= 1.5;
    } else if (isBoss) {
        // Boss Stats: Maxed and Higher Health
        this.maxHealth = 9500 + (this.level * 210);
        this.maxShield = 3600;
        this.damage = 185;
        this.radius *= this.classType === TankClass.CELESTIAL ? 2.25 : 2.55;
        if (this.classType === TankClass.WARLORD) this.radius *= 1.08;
        
        // Max stats for bosses
        Object.values(StatType).forEach(s => this.stats[s as StatType] = 8);

        // Drawbacks
        if (this.classType === TankClass.COLOSSAL) this.stats[StatType.MOVEMENT_SPEED] = 2;
        if (this.classType === TankClass.LEVIATHAN) this.stats[StatType.MOVEMENT_SPEED] = 3;
        if (this.classType === TankClass.WARLORD) this.stats[StatType.MOVEMENT_SPEED] = this.isSiegeMode ? 0 : 2;
        if (this.classType === TankClass.CELESTIAL) {
            this.stats[StatType.MOVEMENT_SPEED] = 4;
            this.stats[StatType.BULLET_SPREAD] = 8;
            this.stats[StatType.RELOAD] = 7;
        }
    } else if (isPacifist) {
        // Pacifist Scaling Upgraded
        this.maxHealth = BASE_STATS.health + (this.stats[StatType.MAX_HEALTH] + statBonus) * 140 + (this.level - 1) * 10;
        this.maxShield = (this.stats[StatType.MAX_SHIELD] + statBonus) * 65; // Extra shield
        
        // Body Damage scales poorly but integrates kinetic weight and levels
        this.damage = Math.round((BASE_STATS.bodyDamage + (this.stats[StatType.BODY_DAMAGE] + statBonus) * 14) * inertiaFactor * levelFactor);
        
        // Healing Stats
        const baseRadius = this.classType === TankClass.PACIFIST_TRAINEE ? 180 : 
                           this.classType === TankClass.NURSE ? 240 : 
                           this.classType === TankClass.DOCTOR ? 320 : 400;
        this.healingAuraRadius = baseRadius + (this.stats[StatType.HEALING_RADIUS] || 0) * 40;
        
        const baseEfficiency = this.classType === TankClass.PACIFIST_TRAINEE ? 0.5 : 
                               this.classType === TankClass.NURSE ? 1.0 : 
                               this.classType === TankClass.DOCTOR ? 1.8 : 2.5;
        this.healingAuraEfficiency = baseEfficiency + (this.stats[StatType.HEALING_EFFICIENCY] || 0) * 0.4;
        
        // Visual Size
        this.radius *= 1.1; // Slightly larger base
    } else if (isDraining) {
        // Draining Scaling Upgraded
        this.maxHealth = BASE_STATS.health + (this.stats[StatType.MAX_HEALTH] + statBonus) * 120 + (this.level - 1) * 8; 
        this.maxShield = (this.stats[StatType.MAX_SHIELD] + statBonus) * 55;
        
        // Body Damage scales with upgraded kinetic factors
        this.damage = Math.round((BASE_STATS.bodyDamage + (this.stats[StatType.BODY_DAMAGE] + statBonus) * 22) * inertiaFactor * levelFactor);
        
        // Draining Stats
        const baseRadius = this.classType === TankClass.DRAINER_TRAINEE ? 160 : 
                           this.classType === TankClass.LEECH ? 210 : 
                           this.classType === TankClass.VAMPIRE ? 280 : 350;
        this.drainAuraRadius = baseRadius + (this.stats[StatType.DRAIN_RADIUS] || 0) * 35;
        
        const baseDamage = this.classType === TankClass.DRAINER_TRAINEE ? 15 : 
                           this.classType === TankClass.LEECH ? 25 : 
                           this.classType === TankClass.VAMPIRE ? 40 : 60;
        this.drainAuraDamage = baseDamage + (this.stats[StatType.DRAIN_EFFICIENCY] || 0) * 10;

        const baseLifesteal = this.classType === TankClass.DRAINER_TRAINEE ? 0.1 : 
                              this.classType === TankClass.LEECH ? 0.15 : 
                              this.classType === TankClass.VAMPIRE ? 0.25 : 0.4;
        this.drainLifestealEfficiency = baseLifesteal + (this.stats[StatType.DRAIN_LIFESTEAL] || 0) * 0.05;
        
        // Visual Size
        this.radius *= 1.05;
    } else {
        // Standard Scaling Upgraded
        this.maxHealth = BASE_STATS.health + (this.stats[StatType.MAX_HEALTH] + statBonus) * 105 + (this.level - 1) * 8;
        this.maxShield = (this.stats[StatType.MAX_SHIELD] + statBonus) * 50; 
        this.damage = Math.round((BASE_STATS.bodyDamage + (this.stats[StatType.BODY_DAMAGE] + statBonus) * 26) * inertiaFactor * levelFactor);
    }

    // Handle smooth health ratio preservation upon maximum HP growth
    if (this.health !== undefined && this.maxHealth !== oldMaxHealth) {
        const ratio = this.health / oldMaxHealth;
        this.health = Math.max(1, Math.round(this.maxHealth * ratio));
    }

    if (this.health > this.maxHealth) this.health = this.maxHealth;

    // Apply Class-Specific FOVs (smaller values zoom out, enlarging the field of view)
    if (this.classType === TankClass.SNIPER) this.fov = 0.85;
    else if (this.classType === TankClass.ASSASSIN) this.fov = 0.76;
    else if (this.classType === TankClass.HUNTER) this.fov = 0.82;
    else if (this.classType === TankClass.X_HUNTER) this.fov = 0.74;
    else if (this.classType === TankClass.RANGER) this.fov = 0.62;
    else if (this.classType === TankClass.STALKER) this.fov = 0.68;
    else if (isBoss) this.fov = 0.55;
    else this.fov = 1.0;
  }

  markHealingStatus(durationMs: number = 400) {
    this.statusHealingUntil = Math.max(this.statusHealingUntil, Date.now() + durationMs);
    this.fxHealing = true;
  }

  markDrainingStatus(durationMs: number = 400) {
    this.statusDrainingUntil = Math.max(this.statusDrainingUntil, Date.now() + durationMs);
    this.fxDraining = true;
  }

  applyDrainDot(stacks: number, durationSec: number) {
    this.drainDotStacks = Math.min(8, this.drainDotStacks + stacks);
    this.drainDotTimer = Math.max(this.drainDotTimer, durationSec);
    this.drainDotTickTimer = Math.min(this.drainDotTickTimer, CLASS_ABILITY_CONFIG.blood.decayTickSeconds);
    this.markDrainingStatus(Math.max(500, durationSec * 1000));
  }

  clearHostileDebuffs() {
    this.drainDotStacks = 0;
    this.drainDotTimer = 0;
    this.drainDotTickTimer = 0;
    this.fxDraining = false;
    this.statusDrainingUntil = 0;
  }

  lerpAngle(a: number, b: number, t: number): number {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + (diff < -Math.PI ? diff + Math.PI * 2 : diff) * t;
  }

  override update(dt: number) {
    super.update(dt);
    
    // Process burst fire queue
    if (this.burstQueue && this.burstQueue.length > 0) {
      const engine = (window as any).gameEngine;
      if (engine) {
        const activeBursts = [];
        for (const item of this.burstQueue) {
          item.delayLeftMs -= dt * 1000;
          if (item.delayLeftMs <= 0) {
            engine.fireBurstShot(this, item.barrelIndex);
          } else {
            activeBursts.push(item);
          }
        }
        this.burstQueue = activeBursts;
      }
    }
    
    // Chassis rotation smoothing - fallback for bots/momentum
    if (Vector.mag(this.vel) > 0.5) {
      const targetRot = Math.atan2(this.vel.y, this.vel.x);
      this.chassisRotation = this.lerpAngle(this.chassisRotation, targetRot, 0.1);
    }

    for(let i=0; i<this.barrelCooldowns.length; i++) { 
        if (this.barrelCooldowns[i] > 0) this.barrelCooldowns[i] -= dt * 1000; 
        if (this.barrelHeat[i] > 0) this.barrelHeat[i] = Math.max(0, this.barrelHeat[i] - dt * 2.5); 
        if (this.barrelRecoilOffsets[i] > 0) {
            // Frame-rate independent recoil recovery for smooth rapid-fire animation.
            const spring = 1 - Math.exp(-dt * 17.5);
            this.barrelRecoilOffsets[i] += (0 - this.barrelRecoilOffsets[i]) * spring;
            if (this.barrelRecoilOffsets[i] < 0.002) this.barrelRecoilOffsets[i] = 0;
        }
    }

    if (this.classType === TankClass.MACHINE_GUN) {
        const firingNow = this.autoFire || this.isBot;
        const spinDecay = firingNow ? 0.25 : 0.85;
        this.machineSpin = Math.max(0, this.machineSpin - dt * spinDecay);
        const heatDecay = firingNow ? 0.08 : 0.18;
        this.machineHeat = Math.max(0, this.machineHeat - dt * heatDecay);
    } else {
        this.machineSpin = Math.max(0, this.machineSpin - dt * 1.4);
        this.machineHeat = Math.max(0, this.machineHeat - dt * 1.2);
    }
    
    if (this.autoTurretCooldown > 0) this.autoTurretCooldown -= dt * 1000;
    if (this.healingBurstCooldown > 0) this.healingBurstCooldown -= dt;
    if (this.drainBurstCooldown > 0) this.drainBurstCooldown -= dt;
    if (this.bloodPactActiveTimer > 0) {
        this.bloodPactActiveTimer = Math.max(0, this.bloodPactActiveTimer - dt);
        this.fxAbilityActive = true;
        this.statusAbilityUntil = Math.max(this.statusAbilityUntil, Date.now() + 250);
        const engine = (window as any).gameEngine;
        if (engine && Math.random() < 0.35) {
            const p = new Particle(
                this.pos.x - this.vel.x * 3 + (Math.random() - 0.5) * this.radius,
                this.pos.y - this.vel.y * 3 + (Math.random() - 0.5) * this.radius,
                'rgba(220, 38, 38, 0.55)',
                4 + Math.random() * 3,
                18,
                'GAS'
            );
            engine.particles.push(p);
        }
    }

    if (this.regenOverchargeTimer > 0) {
        this.regenOverchargeTimer = Math.max(0, this.regenOverchargeTimer - dt);
        this.health = Math.min(this.maxHealth, this.health + this.regenOverchargeRate * dt);
        this.markHealingStatus(300);
    } else {
        this.regenOverchargeRate = 0;
    }

    if (this.drainDotTimer > 0 && this.drainDotStacks > 0) {
        this.drainDotTimer = Math.max(0, this.drainDotTimer - dt);
        this.drainDotTickTimer -= dt;
        this.markDrainingStatus(300);
        if (this.drainDotTickTimer <= 0) {
            const tick = CLASS_ABILITY_CONFIG.blood.decayTickSeconds;
            const dmgPerStack = this.maxHealth * CLASS_ABILITY_CONFIG.blood.decayDamagePerStackRatio;
            this.takeDamage(dmgPerStack * this.drainDotStacks, null);
            this.drainDotTickTimer = tick;
        }
        if (this.drainDotTimer <= 0) {
            this.drainDotStacks = 0;
            this.drainDotTickTimer = 0;
        }
    }

    const timeSinceDamage = Date.now() - this.lastDamageTime;
    if (this.maxShield > 0 && timeSinceDamage > 5000) this.shield = Math.min(this.shield + (this.maxShield * 0.05), this.maxShield);
    
    // SACRIFICIAL GOAT TIMER LOGIC
    if (this.isSacrificing) {
        this.sacrificeActiveTimer -= dt;
        if (this.sacrificeActiveTimer <= 0) {
            this.isSacrificing = false;
            this.sacrificeCooldownTimer = 30; // 30 second cooldown
        }
        
        // Spawn aura particles
        const engine = (window as any).gameEngine;
        if (engine && Math.random() < 0.3) {
            engine.particles.push(new Particle(
                this.pos.x + (Math.random() - 0.5) * this.radius * 2.5,
                this.pos.y + (Math.random() - 0.5) * this.radius * 2.5,
                '#1a1a1a', 5, 20, 'AURA'
            ));
        }
    } else {
        if (this.sacrificeCooldownTimer > 0) {
            this.sacrificeCooldownTimer -= dt;
        }
        
        // NEW REGENERATION SYSTEM
        const regenPoints = this.stats[StatType.REGEN] || 0;
        const healDelay = (5.0 - (regenPoints / 8) * 3.5) * 1000; // Convert to ms
        const healDuration = 18.5 - (regenPoints / 8) * 12.5; // Seconds to full HP
        
        if (timeSinceDamage > healDelay && this.health < this.maxHealth) {
            const regenRate = (this.maxHealth / healDuration) * dt;
            this.health = Math.min(this.health + regenRate, this.maxHealth);
            
            // Visual feedback: Faint green aura when actively regenerating
            const engine = (window as any).gameEngine;
            if (engine && Math.random() < 0.05) {
                engine.particles.push(new Particle(
                    this.pos.x + (Math.random() - 0.5) * this.radius * 2,
                    this.pos.y + (Math.random() - 0.5) * this.radius * 2,
                    'rgba(100, 255, 100, 0.3)', 4, 30, 'AURA'
                ));
            }
        }
    }

    if (this.isTransformed) {
        this.transformationTimer -= dt;
        if (this.transformationTimer <= 0) {
            this.isTransformed = false;
            this.updateStats(); 
        }
    }

    const now = Date.now();
    this.fxHealing = this.statusHealingUntil > now;
    this.fxDraining = this.statusDrainingUntil > now || this.drainDotTimer > 0;
    this.fxAbilityActive = this.bloodPactActiveTimer > 0 || this.isSacrificing || this.statusAbilityUntil > now;

    // Class identity engine signatures while moving.
    const speed = Vector.mag(this.vel);
    const engine = (window as any).gameEngine;
    if (engine && speed > 0.35) {
        if (this.isPacifist(this.classType) && Math.random() < 0.08) {
            const p = new Particle(
                this.pos.x - this.vel.x * 4 + (Math.random() - 0.5) * this.radius * 0.7,
                this.pos.y - this.vel.y * 4 + (Math.random() - 0.5) * this.radius * 0.7,
                'rgba(110, 255, 190, 0.42)',
                2.8 + Math.random() * 1.6,
                16,
                'GAS'
            );
            engine.particles.push(p);
        } else if (this.isDraining(this.classType) && Math.random() < 0.08) {
            const p = new Particle(
                this.pos.x - this.vel.x * 4 + (Math.random() - 0.5) * this.radius * 0.8,
                this.pos.y - this.vel.y * 4 + (Math.random() - 0.5) * this.radius * 0.8,
                'rgba(220, 38, 38, 0.44)',
                2.8 + Math.random() * 1.8,
                16,
                'GAS'
            );
            engine.particles.push(p);
        }
    }

    // Boss Ability Logic
    if (this.classType === TankClass.COLOSSAL) {
        if (this.autoTurrets.length === 0) {
            this.autoTurrets = [
                { rotation: 0, cooldown: 0, targetId: null },
                { rotation: 0, cooldown: 0, targetId: null },
                { rotation: 0, cooldown: 0, targetId: null }
            ];
        }
        const engine = (window as any).gameEngine;
        
        // Sandbox Hard Guard for Boss AI Abilities
        const isBot = this.type !== EntityType.PLAYER;
        const botsDisabled = engine && engine.gameMode === GameMode.SANDBOX && !engine.sandboxConfig.botsEnabled;

        this.autoTurrets.forEach((turret, idx) => {
            if (turret.cooldown > 0) turret.cooldown -= dt * 1000;
            
            // Skip if it's a bot and bots are disabled
            if (isBot && botsDisabled) return;

            if (!this.autoFire) { // Manual control toggle via E (handled in handleInput)
                const neighbors = engine.spatialGrid.getNeighbors(this);
                const targets = neighbors.filter((e: any) => e.team !== this.team && (e.type === EntityType.ENEMY || e.type === EntityType.PLAYER || e.type === EntityType.SHAPE || e.type === EntityType.BOSS));
                const target = engine.findNearest(this, targets);
                if (target) {
                    const angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
                    turret.rotation = angle;
                    if (turret.cooldown <= 0) {
                        const bSpeed = 8;
                        const forward = Vector.fromAngle(angle);
                        const tip = Vector.add(this.pos, Vector.mult(forward, this.radius * 1.2));
                        const bullet = new Bullet(engine.nextId(), tip.x, tip.y, Vector.mult(forward, bSpeed), this, 0.5, 1.0, 0.8);
                        engine.entities.push(bullet);
                        turret.cooldown = 200;
                    }
                } else {
                    turret.rotation += dt * 2;
                }
            } else {
                turret.rotation = this.rotation;
            }
        });
    }

    if (this.classType === TankClass.LEVIATHAN) {
        this.bossAbilityTimer -= dt;
        if (this.bossAbilityTimer <= 0) {
            // Shockwave pulse
            const engine = (window as any).gameEngine;
            const neighbors = engine.spatialGrid.getNeighbors(this);
            neighbors.forEach((e: any) => {
                if (e !== this && Vector.dist(this.pos, e.pos) < 400) {
                    const dir = Vector.normalize(Vector.sub(e.pos, this.pos));
                    e.vel = Vector.add(e.vel, Vector.mult(dir, 15));
                    e.takeDamage(50, this.id);
                }
            });
            engine.particles.push(new Particle(this.pos.x, this.pos.y, '#00ffff', 20, 30, 'RING'));
            this.bossAbilityTimer = 10;
        }
    }

    if (this.classType === TankClass.WARLORD) {
        if (this.repairDrones.length === 0) {
            this.repairDrones = [
                { angle: 0, dist: 80 },
                { angle: Math.PI, dist: 80 }
            ];
        }
        this.repairDrones.forEach(drone => {
            drone.angle += dt * 2;
        });
        // Auto-repair
        this.health = Math.min(this.health + dt * 20, this.maxHealth);
    }

    this.activeBuffs = this.activeBuffs.filter(buff => {
        buff.timeLeft -= dt;
        return buff.timeLeft > 0;
    });
  }

  override drawBody(ctx: CanvasRenderingContext2D) {
      this.drawMainShape(ctx);
  }
}

class EliteTank extends Tank {
    patrolPos: Vector2;
    damageDealtBy: Map<number, number> = new Map();
    classTypeOriginal: TankClass;

    constructor(id: number, x: number, y: number, cls: TankClass) {
        super(id, x, y, false, Team.NONE);
        this.type = EntityType.ELITE_TANK;
        this.classTypeOriginal = cls;
        this.name = `Elite ${cls}`;
        this.level = 45; 
        this.maxHealth = 100000;
        this.health = 100000;
        this.displayHealth = 100000;
        this.color = '#1a1a1a';
        this.damage = 60;
        this.mass = 500;
        this.patrolPos = { x, y };
        this.visionRange = 1200;
        this.barrels = TANK_CONFIGS[cls];
        this.barrelCooldowns = new Array(this.barrels.length).fill(0);
        this.barrelMaxCooldowns = new Array(this.barrels.length).fill(100);
        this.barrelHeat = new Array(this.barrels.length).fill(0);
        this.barrelRecoilOffsets = new Array(this.barrels.length).fill(0);
        this.machineHeat = 0;
        this.machineSpin = 0;
        this.updateStats(); 
    }

    override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
        if (sourceId !== null && amount > 0) {
            this.damageDealtBy.set(sourceId, (this.damageDealtBy.get(sourceId) || 0) + amount);
        }
        super.takeDamage(amount, sourceId, isBodyDamage);
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        const t = Date.now() / 1000;
        ctx.save();
        const auraRadius = this.radius * (1.3 + Math.sin(t * 3) * 0.1);
        const auraGrad = ctx.createRadialGradient(0, 0, this.radius * 0.8, 0, 0, auraRadius);
        auraGrad.addColorStop(0, 'rgba(255, 68, 68, 0.6)');
        auraGrad.addColorStop(1, 'rgba(255, 68, 68, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        super.drawBody(ctx);
    }
}

class Crasher extends Entity {
    target: Entity | null = null;
    spawnTime: number = Date.now();
    isAlphaCrasher: boolean = false;

    constructor(id: number, x: number, y: number, isAlpha: boolean = false) {
        super(id, EntityType.CRASHER, x, y, isAlpha ? 18 : 10, isAlpha ? '#4050ff' : COLORS.crasher);
        this.isAlphaCrasher = isAlpha;
        this.team = Team.NONE;
        this.maxHealth = isAlpha ? 250 : 40;
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.damage = isAlpha ? 45 : 15;
        this.mass = isAlpha ? 25 : 8;
        this.friction = 0.95;
    }

    override update(dt: number) {
        this.rotation += this.isAlphaCrasher ? 0.15 : 0.1;
        super.update(dt);
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const angle = (i * 2 * Math.PI) / 3;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = this.isAlphaCrasher ? 4 : 2;
        ctx.strokeStyle = COLORS.border;
        ctx.stroke();
    }
}

class Guardian extends Entity {
  homePos: Vector2;
  orbitAngle: number = 0;
  constructor(id: number, x: number, y: number, team: Team) {
    const color = (team === Team.BLUE) ? COLORS.player : COLORS.enemy;
    super(id, EntityType.GUARDIAN, x, y, 16, color);
    this.team = team;
    this.homePos = { x, y };
    this.maxHealth = 50000;
    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;
    this.damage = 5000;
    this.friction = 0.9;
    this.mass = 200; 
    this.orbitAngle = Math.random() * Math.PI * 2;
  }
  override update(dt: number) { this.health = this.maxHealth; this.displayHealth = this.maxHealth; super.update(dt); }
  override drawBody(ctx: CanvasRenderingContext2D) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = (i * 2 * Math.PI) / 3;
        const x = Math.cos(angle) * this.radius;
        const y = Math.sin(angle) * this.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.border;
      ctx.stroke();
  }
}

class Boss extends Entity {
    damageDealtBy: Map<number, number> = new Map();
    spawnTimer: number = 0;
    phaseTimer: number = 0;
    xpValue: number = 500000;

    constructor(id: number) {
        super(id, EntityType.BOSS, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 180, '#0055ff');
        this.maxHealth = 150000;
        this.health = 150000;
        this.displayHealth = 150000;
        this.damage = 150;
        this.mass = 15000;
        this.friction = 0.99;
        this.name = "GRAND SINGULARITY";
        this.pos.x += Vector.randomRange(-100, 100);
        this.pos.y += Vector.randomRange(-100, 100);
    }
    
    override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
        if (sourceId !== null && amount > 0) this.damageDealtBy.set(sourceId, (this.damageDealtBy.get(sourceId) || 0) + amount);
        super.takeDamage(amount, sourceId, isBodyDamage);
    }
    
    override update(dt: number) { 
        this.phaseTimer += dt;
        const hpRatio = this.health / this.maxHealth;
        this.rotation += (0.8 + (1 - hpRatio) * 1.2) * dt; 
        
        if (Date.now() - this.lastDamageTime > 10000) {
            this.health = Math.min(this.health + 50 * dt * 60, this.maxHealth);
        }
        
        super.update(dt); 
    }
    
    override drawBody(ctx: CanvasRenderingContext2D) {
        const t = Date.now() / 1000;
        const hpRatio = this.health / this.maxHealth;
        
        ctx.save();
        const auraSize = this.radius * (1.3 + Math.sin(t * 2) * 0.08);
        const grad = ctx.createRadialGradient(0, 0, this.radius * 0.8, 0, 0, auraSize);
        grad.addColorStop(0, 'rgba(0, 85, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, auraSize, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        for (let j = 0; j < 2; j++) {
            ctx.save();
            ctx.rotate(j === 0 ? t * 0.5 : -t * 0.8);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI) / 5;
                const r = this.radius * (1.1 + j * 0.2);
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.lineWidth = 12;
            ctx.strokeStyle = j === 0 ? 'rgba(0, 178, 225, 0.6)' : 'rgba(118, 141, 252, 0.4)';
            ctx.stroke();
            ctx.restore();
        }

        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        const r = Math.floor((1 - hpRatio) * 150);
        const g = Math.floor(hpRatio * 150);
        const b = 255;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fill();
        
        ctx.lineWidth = 15;
        ctx.strokeStyle = COLORS.border;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3 * (1 + Math.sin(t * 10) * 0.1), 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#0ff';
        ctx.fill();
    }
}

class Shape extends Entity {
  shapeType: ShapeType;
  xpValue: number;
  driftVec: Vector2;
  rarity: ShapeRarity;
  damageDealtBy: Map<number, number> = new Map();
  hueTimer: number = 0; 
  pulseTimer: number = 0;
  ambientTimer: number = 0;
  spawnScale: number = 0;
  deathScale: number = 1;
  isDying: boolean = false;
  deathTimer: number = 0;
  static SPAWN_DURATION = 0.5;
  static DEATH_DURATION = 0.4;

  constructor(id: number, x: number, y: number, type: ShapeType, isInVoid: boolean = false, forceRarity?: ShapeRarity) {
    const stats = SHAPE_STATS[type];
    const roll = Math.random();
    
    let rarity = forceRarity || ShapeRarity.COMMON;
    if (!forceRarity) {
        let accumulated = 0;
        const rarities = Object.values(ShapeRarity) as ShapeRarity[];
        const configSource = isInVoid ? VOID_RARITY_CONFIG : RARITY_CONFIG;

        for (const r of rarities) {
            const chance = configSource[r].chance;
            accumulated += chance;
            if (roll < accumulated) {
                rarity = r;
                break;
            }
        }
    }

    const configSource = isInVoid ? VOID_RARITY_CONFIG : RARITY_CONFIG;
    const rarityConfig = configSource[rarity];
    super(id, EntityType.SHAPE, x, y, stats.radius * rarityConfig.sizeMult, rarityConfig.color || stats.color);
    this.team = Team.NONE;
    this.friction = 0.95; 
    this.shapeType = type;
    this.rarity = rarity;
    this.maxHealth = Math.floor(stats.health * rarityConfig.hpMult);
    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;
    this.xpValue = Math.floor(stats.xp * rarityConfig.xpMult);
    this.damage = stats.damage; 
    this.mass = this.radius * 2.5;
    this.vel = { x: Vector.randomRange(-0.2, 0.2), y: Vector.randomRange(-0.2, 0.2) };
    const driftAngle = Math.random() * Math.PI * 2;
    this.driftVec = { x: Math.cos(driftAngle) * 0.005, y: Math.sin(driftAngle) * 0.005 };
    this.hueTimer = Math.random() * 360;
    this.pulseTimer = Math.random() * Math.PI * 2;
    this.ambientTimer = Math.random() * 1000;
  }

  override takeDamage(amount: number, sourceId: number | null = null) {
      if (this.isDying) return; 
      if (sourceId !== null && amount > 0) this.damageDealtBy.set(sourceId, (this.damageDealtBy.get(sourceId) || 0) + amount);
      
      if (this.invulnerableTime > 0) return;
      this.lastDamageTime = Date.now();
      this.health -= amount;
      
      if (this.health <= 0) {
          this.isDying = true;
          this.isDead = true;
          this.health = 0;
          this.displayHealth = 0;
      }
  }

  override update(dt: number) {
    if (this.isDying) {
        this.deathTimer += dt;
        this.deathScale = Math.max(0, 1 - (this.deathTimer / Shape.DEATH_DURATION));
        this.visualScale = this.deathScale * (1.1 + Math.sin(this.deathTimer * 20) * 0.1); 
        this.vel.x *= 0.9;
        this.vel.y *= 0.9;
        if (this.deathTimer >= Shape.DEATH_DURATION) {
            this.shouldRemove = true;
        }
        return;
    }

    if (this.spawnScale < 1) {
        this.spawnScale = Math.min(1, this.spawnScale + dt / Shape.SPAWN_DURATION);
    }

    this.rotation += (this.shapeType === ShapeType.OCTAGON ? 0.008 : 0.015);
    this.acc.x += this.driftVec.x;
    this.acc.y += this.driftVec.y;
    this.pulseTimer += dt * 3; 
    
    this.visualScale = this.spawnScale * (1.0 + Math.sin(this.pulseTimer) * 0.04);

    if (this.rarity === ShapeRarity.TRANSCENDENT) { this.hueTimer += dt * 120; this.rotation += 0.025; }
    else if (this.rarity === ShapeRarity.ETERNAL || this.rarity === ShapeRarity.MYTHICAL) this.rotation += 0.04;
    else if (this.rarity === ShapeRarity.EPIC) this.rotation += 0.01;
    super.update(dt);
  }

  override drawBody(ctx: CanvasRenderingContext2D) {
    const sides = SHAPE_STATS[this.shapeType].sides;

    if (this.rarity === ShapeRarity.TRANSCENDENT) {
        this.drawTranscendentBody(ctx, sides);
        return;
    }

    ctx.save();
    let fillColor = this.color;
    let strokeColor = COLORS.border;
    let glowColor = 'transparent';
    let glowBlur = 0;
    
    if (this.isDying) {
        ctx.globalAlpha *= this.deathScale;
    }
    
    switch (this.rarity) {
        case ShapeRarity.UNCOMMON: strokeColor = '#4db8ff'; glowColor = '#4db8ff'; glowBlur = 12; break;
        case ShapeRarity.RARE: strokeColor = '#00ff80'; glowColor = '#00ff80'; glowBlur = 25; break;
        case ShapeRarity.EPIC: fillColor = '#ffd700'; strokeColor = '#ffaa00'; glowColor = '#ffcc00'; glowBlur = 40; break;
        case ShapeRarity.LEGENDARY: fillColor = '#ff5e00'; strokeColor = '#ff0000'; glowColor = '#ff5e00'; glowBlur = 55; break;
        case ShapeRarity.MYTHICAL: fillColor = '#1a002b'; strokeColor = '#a200ff'; glowColor = '#a200ff'; glowBlur = 70; break;
        case ShapeRarity.ETERNAL: fillColor = '#f0ffff'; strokeColor = '#00ffff'; glowColor = '#00ffff'; glowBlur = 95; break;
    }

    if (this.shapeType === ShapeType.OCTAGON) {
        this.drawAdvancedOctagon(ctx, fillColor, strokeColor, glowBlur, glowColor);
        ctx.restore();
        return;
    }

    if (this.rarity === ShapeRarity.UNCOMMON) this.drawUncommonVisuals(ctx);
    if (this.rarity === ShapeRarity.RARE) this.drawRareVisuals(ctx);
    if (this.rarity === ShapeRarity.EPIC) this.drawEpicVisuals(ctx);
    if (this.rarity === ShapeRarity.LEGENDARY) this.drawLegendaryVisuals(ctx);
    if (this.rarity === ShapeRarity.MYTHICAL) this.drawMythicalVisuals(ctx);
    if (this.rarity === ShapeRarity.ETERNAL) this.drawEternalVisuals(ctx);

    if (glowBlur > 0) { ctx.shadowBlur = glowBlur; ctx.shadowColor = glowColor; }
    this.traceShape(ctx, sides, this.radius);
    
    const glintPos = (Math.sin(Date.now() / 2000) + 1) / 2; 
    const grad = ctx.createLinearGradient(-this.radius * 2, -this.radius * 2, this.radius * 2, this.radius * 2);
    
    if (this.rarity !== ShapeRarity.COMMON) {
        grad.addColorStop(0, fillColor);
        grad.addColorStop(Math.max(0, glintPos - 0.1), fillColor);
        grad.addColorStop(glintPos, 'rgba(255,255,255,0.4)');
        grad.addColorStop(Math.min(1, glintPos + 0.1), fillColor);
        grad.addColorStop(1, fillColor);
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = fillColor;
    }
    
    ctx.fill(); 
    ctx.shadowBlur = 0; 
    ctx.lineWidth = 3; 
    ctx.strokeStyle = strokeColor; 
    ctx.stroke();
    ctx.restore();
  }

  private drawAdvancedOctagon(ctx: CanvasRenderingContext2D, fillColor: string, strokeColor: string, glowBlur: number, glowColor: string) {
    const t = Date.now() / 1000;
    const r = this.radius;
    
if (this.rarity !== ShapeRarity.COMMON && this.rarity !== ShapeRarity.UNCOMMON) {
    ctx.save();
    ctx.rotate(-this.rotation * 2);

    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        const dist = r * 1.5 + Math.sin(t * 2 + i) * 10;

        ctx.fillStyle =
            glowColor && glowColor !== 'transparent'
                ? glowColor
                : fillColor;

        ctx.globalAlpha = 0.6;

        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
        ctx.lineTo(
            Math.cos(angle + 0.2) * (dist + 15),
            Math.sin(angle + 0.2) * (dist + 15)
        );
        ctx.lineTo(
            Math.cos(angle - 0.2) * (dist + 15),
            Math.sin(angle - 0.2) * (dist + 15)
        );
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}


    if (glowBlur > 0) {
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = glowColor;
    }

    this.traceShape(ctx, 8, r);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    ctx.shadowBlur = 0;
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
    coreGrad.addColorStop(0, fillColor);
    coreGrad.addColorStop(0.7, '#222');
    coreGrad.addColorStop(1, '#000');
    
    ctx.save();
    this.traceShape(ctx, 8, r * 0.85);
    ctx.clip();
    ctx.fillStyle = coreGrad;
    ctx.fillRect(-r, -r, r*2, r*2);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.rotate(this.rotation * 0.5);
    this.traceShape(ctx, 8, r * 0.5);
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 15]);
    ctx.stroke();
    ctx.restore();
  }

  private drawTranscendentBody(ctx: CanvasRenderingContext2D, sides: number) {
    const hue = Math.floor(this.hueTimer % 360);
    const t = Date.now() / 1000;
    const isGlitching = Math.sin(t * 15) > 0.8;
    const glitchOffset = isGlitching ? (Math.random() - 0.5) * 16 : Math.sin(this.pulseTimer * 18) * 2;

    ctx.save();
    ctx.save(); 
    ctx.translate(-glitchOffset, isGlitching ? glitchOffset/2 : 0); 
    ctx.globalAlpha = 0.6; 
    this.traceShape(ctx, sides, this.radius); 
    ctx.lineWidth = 5; ctx.strokeStyle = 'cyan'; ctx.stroke(); 
    ctx.restore();

    ctx.save(); 
    ctx.translate(glitchOffset, isGlitching ? -glitchOffset/2 : 0); 
    ctx.globalAlpha = 0.6; 
    this.traceShape(ctx, sides, this.radius); 
    ctx.lineWidth = 5; ctx.strokeStyle = 'magenta'; ctx.stroke(); 
    ctx.restore();

    this.traceShape(ctx, sides, this.radius);
    ctx.fillStyle = '#080808'; ctx.fill();
    ctx.save(); ctx.clip();
    
    const scanY = ((t * 3) % 1.5) * this.radius * 4 - this.radius * 2;
    ctx.fillStyle = `hsla(${hue}, 100%, 85%, ${isGlitching ? 0.7 : 0.3})`;
    ctx.fillRect(-this.radius * 2.5, scanY, this.radius * 5, 4);
    
    const seed = Math.floor(Date.now() / 100);
    const rng = (i: number) => { const x = Math.sin(seed + i) * 10000; return x - Math.floor(x); };
    ctx.fillStyle = `hsl(${hue}, 100%, 75%)`;
    for(let i=0; i < (isGlitching ? 32 : 16); i++) {
        const sx = (rng(i) - 0.5) * this.radius * 2.4;
        const sy = (rng(i+60) - 0.5) * this.radius * 2.4;
        const sz = rng(i+120) * 6;
        ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.restore();
    
    ctx.lineWidth = 5;
    ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
    ctx.shadowBlur = isGlitching ? 50 : 30;
    ctx.stroke();
    ctx.restore();
  }

  traceShape(ctx: CanvasRenderingContext2D, sides: number, radius: number) { ctx.beginPath(); for (let i = 0; i < sides; i++) { const angle = (i * 2 * Math.PI) / sides; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); }
  
  drawUncommonVisuals(ctx: CanvasRenderingContext2D) {
    const t = Date.now() / 1000;
    const sides = SHAPE_STATS[this.shapeType].sides;
    const bracketPulse = 1.0 + Math.sin(t * 6) * 0.1;
    
    ctx.save();
    ctx.strokeStyle = '#4db8ff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides;
        const dist = this.radius * 1.25 * bracketPulse;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-6, -6);
        ctx.lineTo(0, 0);
        ctx.lineTo(-6, 6);
        ctx.stroke();
        ctx.restore();
    }
    
    ctx.save();
    this.traceShape(ctx, sides, this.radius);
    ctx.clip();
    ctx.strokeStyle = 'rgba(77, 184, 255, 0.15)';
    ctx.lineWidth = 1;
    for(let i = -this.radius; i < this.radius; i += 8) {
        ctx.beginPath(); ctx.moveTo(i, -this.radius); ctx.lineTo(i, this.radius); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-this.radius, i); ctx.lineTo(this.radius, i); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  drawRareVisuals(ctx: CanvasRenderingContext2D) { 
    const t = Date.now() / 1000; 
    ctx.save(); 
    
    const corePulse = 0.5 + Math.sin(t * 12) * 0.1;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 0.8);
    grad.addColorStop(0, 'rgba(80, 239, 149, 0.8)');
    grad.addColorStop(1, 'rgba(80, 239, 149, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * corePulse, 0, Math.PI * 2);
    ctx.fill();

    for(let i = 0; i < 5; i++) { 
        const orbitAngle = (t * (0.8 + i * 0.2)) + (i * Math.PI * 0.4); 
        const dist = this.radius * (1.6 + Math.sin(t * 2 + i) * 0.2); 
        const sx = Math.cos(orbitAngle) * dist;
        const sy = Math.sin(orbitAngle) * dist;
        
        ctx.save(); 
        ctx.translate(sx, sy); 
        ctx.rotate(orbitAngle + t * 4); 
        ctx.fillStyle = '#50ef95'; 
        ctx.shadowBlur = 15; ctx.shadowColor = '#50ef95'; 
        
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore(); 
    } 
    ctx.restore(); 
  }

  drawEpicVisuals(ctx: CanvasRenderingContext2D) { 
    const t = Date.now() / 900; 
    ctx.save(); 
    for (let j = 0; j < 3; j++) { 
        ctx.save();
        ctx.rotate((j % 2 === 0 ? t : -t * 1.5) + (j * Math.PI / 3));
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * (1.3 + j * 0.4), 0, Math.PI * 2);
        ctx.strokeStyle = j === 0 ? 'rgba(255, 215, 0, 0.7)' : (j === 1 ? 'rgba(255, 160, 0, 0.5)' : 'rgba(255, 255, 255, 0.3)');
        ctx.lineWidth = 3;
        ctx.setLineDash([12 + j * 4, 10]);
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
  }

  drawLegendaryVisuals(ctx: CanvasRenderingContext2D) { 
    const t = Date.now() / 400; 
    ctx.save(); 
    for(let i=0; i<6; i++) { 
        const s = 1.1 + (i * 0.2) + Math.sin(t*1.5 + i) * 0.15; 
        ctx.beginPath(); 
        this.traceShape(ctx, SHAPE_STATS[this.shapeType].sides, this.radius * s); 
        ctx.strokeStyle = `rgba(255, 90, 0, ${0.5 - i * 0.08})`; 
        ctx.lineWidth = 6; 
        ctx.stroke(); 
    } 
    ctx.restore(); 
  }

  drawMythicalVisuals(ctx: CanvasRenderingContext2D) { 
    const t = Date.now() / 1500; 
    ctx.save(); 
    const grad = ctx.createRadialGradient(0, 0, this.radius, 0, 0, this.radius * 2.5);
    grad.addColorStop(0, 'rgba(20, 0, 35, 0.9)');
    grad.addColorStop(1, 'rgba(162, 0, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, this.radius * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); 
  }

  drawEternalVisuals(ctx: CanvasRenderingContext2D) { 
    const t = Date.now() / 1000; 
    ctx.save(); 
    const grad = ctx.createRadialGradient(0, 0, this.radius * 0.5, 0, 0, this.radius * 4.5); 
    grad.addColorStop(0, 'rgba(0, 255, 255, 0.8)'); 
    grad.addColorStop(1, 'rgba(0, 255, 255, 0)'); 
    ctx.fillStyle = grad; 
    ctx.beginPath(); ctx.arc(0, 0, this.radius * 5, 0, Math.PI * 2); ctx.fill(); 
    ctx.restore(); 
  }
}

class Bullet extends Entity {
  ownerId: number;
  ownerClass: TankClass;
  barrelIndex: number;
  lifeTime: number = 0;
  maxLifeTime: number = 3000;
  bulletType: 'NORMAL' | 'HEAL' | 'SIPHON' = 'NORMAL';
  isDespawning: boolean = false;
  despawnStartTime: number = 0;
  despawnDurationMs: number = 240;
  
  constructor(id: number, x: number, y: number, velocity: Vector2, owner: Tank, extraDamageMult: number = 1.0, extraLifeMult: number = 1.0, extraSizeMult: number = 1.0, barrelIndex: number = 0) {
    const size = (6 + (owner.stats[StatType.BULLET_DAMAGE] * 0.3)) * extraSizeMult;
    const color = (owner.team === Team.BLUE) ? COLORS.player : (owner.team === Team.RED) ? COLORS.enemy : COLORS.barrel;
    super(id, EntityType.BULLET, x, y, size, color);
    this.team = owner.team;
    this.friction = 1.0; 
    this.vel = velocity;
    this.ownerId = owner.id;
    this.ownerClass = owner.classType;
    this.barrelIndex = barrelIndex;

    const isPacifist = (cls: TankClass) => cls === TankClass.PACIFIST_TRAINEE || cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR;
    const isDraining = (cls: TankClass) => cls === TankClass.DRAINER_TRAINEE || cls === TankClass.LEECH || cls === TankClass.VAMPIRE || cls === TankClass.REAPER;

    if (isPacifist(this.ownerClass)) {
        this.bulletType = 'HEAL';
        this.color = '#4ade80';
    } else if (isDraining(this.ownerClass)) {
        this.bulletType = 'SIPHON';
        this.color = '#ef4444';
    }

    // MATHEMATICALLY ALIGNED TO MATCH BARREL DRAWN SIZES EXACTLY
    const barrel = owner.barrels[this.barrelIndex] || owner.barrels[0];
    const barrelWidthRatio = barrel ? barrel[1] : 0.8;
    const ownerRadius = owner.radius;
    let matchedSize = size;

    if (this.ownerClass === TankClass.SNIPER) {
      matchedSize = (barrelWidthRatio * ownerRadius) / 1.1 * 0.88;
    } else if (this.ownerClass === TankClass.ASSASSIN) {
      matchedSize = (barrelWidthRatio * ownerRadius) / 0.76 * 0.7; // Slightly decreased from 0.88
    } else if (this.ownerClass === TankClass.RANGER) {
      matchedSize = (barrelWidthRatio * ownerRadius) / 1.4 * 0.88;
    } else if (this.ownerClass === TankClass.STALKER) {
      matchedSize = (barrelWidthRatio * ownerRadius) / 1.3 * 0.88;
    } else if (this.ownerClass === TankClass.HUNTER) {
      if (this.barrelIndex === 0) {
        matchedSize = (barrelWidthRatio * ownerRadius) / 1.4 * 0.85;
      } else {
        matchedSize = (barrelWidthRatio * ownerRadius) / 0.9 * 0.85;
      }
    } else if (this.ownerClass === TankClass.X_HUNTER) {
      if (this.barrelIndex === 0) {
        matchedSize = (barrelWidthRatio * ownerRadius) / 2.2 * 0.85;
      } else if (this.barrelIndex === 1) {
        matchedSize = (barrelWidthRatio * ownerRadius) / 1.3 * 0.85;
      } else {
        matchedSize = (barrelWidthRatio * ownerRadius) / 1.0 * 0.85;
      }
    } else if (this.ownerClass === TankClass.ANNIHILATOR) {
      matchedSize = (barrelWidthRatio * ownerRadius) * 0.95; // Same size as barrel width so matching is pristine and not tiny!
    }

    this.radius = matchedSize;
    this.mass = matchedSize * 0.8; 
    
    let baseDamage = BASE_STATS.bulletDamage + (owner.stats[StatType.BULLET_DAMAGE] * 3);
    let basePenetration = BASE_STATS.bulletPenetration + (owner.stats[StatType.BULLET_PENETRATION] * 5);
    
    if (owner.type === EntityType.ELITE_TANK) {
        baseDamage *= 1.5;
        basePenetration *= 2.0;
    } else if (owner.isTransformed) {
        baseDamage *= 1.5;
        basePenetration *= 2.0;
    }
    
    // SACRIFICIAL GOAT BUFF
    if (owner.isSacrificing) {
        baseDamage *= 1.25;
    }

    const classProjectileMod = CLASS_PROJECTILE_MODIFIERS[this.ownerClass];
    const penetrationMult = classProjectileMod?.penetrationMultiplier ?? 1.0;
    const projectileHealthMult = classProjectileMod?.projectileHealthMultiplier ?? 1.0;

    this.damage = baseDamage * extraDamageMult;
    this.maxHealth = (10 + (basePenetration * penetrationMult) * 3) * extraLifeMult * projectileHealthMult; 
    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;
    this.maxLifeTime *= (extraLifeMult * 0.8) + 0.2; 
  }

  override update(dt: number) { 
    super.update(dt); 
    this.lifeTime += dt * 1000; 
    if (!this.isDespawning && this.lifeTime > this.maxLifeTime) this.isDead = true; 
    
    // Disappear/despawn upon touching the game barrier (outer border bounds)
    if (this.pos.x <= this.radius + 1.5 || this.pos.x >= CANVAS_WIDTH - this.radius - 1.5 ||
        this.pos.y <= this.radius + 1.5 || this.pos.y >= CANVAS_HEIGHT - this.radius - 1.5) {
      this.isDead = true;
    } 

    if (this.ownerClass === TankClass.ANNIHILATOR && !this.isDespawning) {
      const speed = Vector.mag(this.vel);
      if (speed <= 0.35) {
        this.isDespawning = true;
        this.despawnStartTime = this.lifeTime;
      }
    }

    if (this.isDespawning && (this.lifeTime - this.despawnStartTime) >= this.despawnDurationMs) {
      this.isDead = true;
    }
    
    // Align rotation with velocity direction dynamically
    this.rotation = Math.atan2(this.vel.y, this.vel.x);
    
    // Ambient trail emissions
    const engine = (window as any).gameEngine;
    if (engine && engine.isOnScreen(this.pos)) {
      const chance = Math.random();
      if (this.bulletType === 'HEAL' && chance < 0.58) {
        const angle = this.rotation + Math.PI + (Math.random() - 0.5) * 0.55;
        const speed = Math.random() * 1.6 + 0.4;
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(74, 222, 128, 0.52)', Math.random() * 3 + 2, 16 + Math.random() * 10, 'GAS');
        p.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        engine.particles.push(p);
      } else if (this.bulletType === 'SIPHON' && chance < 0.45) {
        const angle = this.rotation + Math.PI + (Math.random() - 0.5) * 0.7;
        const speed = Math.random() * 1.8 + 0.5;
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(239, 68, 68, 0.5)', Math.random() * 2.5 + 1.5, 14 + Math.random() * 8, 'GAS');
        p.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        engine.particles.push(p);
      } else if (this.ownerClass === TankClass.RANGER && chance < 0.45) {
        // Electrified sparks for Ranger
        const angle = this.rotation + Math.PI + (Math.random() - 0.5) * 0.8;
        const speed = Math.random() * 3 + 1;
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(0, 191, 255, 0.8)', Math.random() * 3 + 1, 15 + Math.random() * 10);
        p.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        engine.particles.push(p);
      } else if (this.ownerClass === TankClass.ASSASSIN && chance < 0.3) {
        // Crimson thread trail for Assassin
        const angle = this.rotation + Math.PI + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 1.5;
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(255, 60, 60, 0.6)', Math.random() * 2 + 1, 12 + Math.random() * 8);
        p.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        engine.particles.push(p);
      } else if (this.ownerClass === TankClass.STALKER && chance < 0.25) {
        // Dark purple aura fuel gas
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(128, 0, 128, 0.4)', Math.random() * 4 + 2, 25, 'GAS');
        engine.particles.push(p);
      } else if (this.ownerClass === TankClass.SNIPER && chance < 0.22) {
        // Focused high speed light dust for Sniper
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(255, 230, 100, 0.5)', Math.random() * 2 + 1, 10 + Math.random() * 10);
        engine.particles.push(p);
      } else if ((this.ownerClass === TankClass.DESTROYER || this.ownerClass === TankClass.HYBRID) && chance < 0.35) {
        // Heavy ember exhaust for Destroyer-class slugs
        const angle = this.rotation + Math.PI + (Math.random() - 0.5) * 0.6;
        const speed = Math.random() * 2.2 + 0.8;
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(255, 165, 80, 0.45)', Math.random() * 3 + 1.5, 18 + Math.random() * 10, 'GAS');
        p.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        engine.particles.push(p);
      }
    }
  }

  drawCustomTacticalBullet(ctx: CanvasRenderingContext2D) {
    const isSniper = this.ownerClass === TankClass.SNIPER;
    const isAssassin = this.ownerClass === TankClass.ASSASSIN;
    const isRanger = this.ownerClass === TankClass.RANGER;
    const isStalker = this.ownerClass === TankClass.STALKER;
    const isHunter = this.ownerClass === TankClass.HUNTER;
    const isXHunter = this.ownerClass === TankClass.X_HUNTER;

    ctx.save();
    
    // Base theme configurations
    const baseColor = this.color;
    const strokeColor = COLORS.border;

    if (isSniper) {
      // 1. SNIPER Kinetic Dart: sleek diamond arrowhead with vector trailing heat cone
      const coneGrad = ctx.createLinearGradient(-this.radius * 3.5, 0, -this.radius * 0.5, 0);
      coneGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
      coneGrad.addColorStop(1, 'rgba(34, 211, 238, 0.45)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 3.5, 0);
      ctx.lineTo(-this.radius * 0.4, -this.radius * 0.55);
      ctx.lineTo(-this.radius * 0.4, this.radius * 0.55);
      ctx.closePath();
      ctx.fill();

      const bulletGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
      bulletGrad.addColorStop(0, baseColor);
      bulletGrad.addColorStop(0.3, '#ffffff');
      bulletGrad.addColorStop(0.7, baseColor);
      bulletGrad.addColorStop(1.0, '#111111');

      ctx.fillStyle = bulletGrad;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(-this.radius * 1.5, -this.radius * 0.15); 
      ctx.lineTo(-this.radius * 1.0, -this.radius * 0.55); 
      ctx.lineTo(this.radius * 0.5, -this.radius * 0.55);  
      ctx.lineTo(this.radius * 1.8, 0);                    
      ctx.lineTo(this.radius * 0.5, this.radius * 0.55);   
      ctx.lineTo(-this.radius * 1.0, this.radius * 0.55);  
      ctx.lineTo(-this.radius * 1.5, this.radius * 0.15);  
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.8, 0);
      ctx.lineTo(this.radius * 1.1, 0);
      ctx.stroke();

    } else if (isAssassin) {
      // 2. ASSASSIN Needle: staged needle dart with stabilizer fins
      const tailGrad = ctx.createLinearGradient(-this.radius * 4.5, 0, -this.radius * 1.0, 0);
      tailGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      tailGrad.addColorStop(1, 'rgba(239, 68, 68, 0.5)');
      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 4.5, 0);
      ctx.lineTo(-this.radius * 0.8, -this.radius * 0.35);
      ctx.lineTo(-this.radius * 0.8, this.radius * 0.35);
      ctx.closePath();
      ctx.fill();

      const bodyGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
      bodyGrad.addColorStop(0, '#555555');
      bodyGrad.addColorStop(0.4, baseColor);
      bodyGrad.addColorStop(0.7, '#222222');
      bodyGrad.addColorStop(1.0, '#000000');

      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.moveTo(-this.radius * 1.8, -this.radius * 0.25);
      ctx.lineTo(-this.radius * 0.6, -this.radius * 0.38);
      ctx.lineTo(this.radius * 0.6, -this.radius * 0.38);
      ctx.lineTo(this.radius * 2.5, 0); 
      ctx.lineTo(this.radius * 0.6, this.radius * 0.38);
      ctx.lineTo(-this.radius * 0.6, this.radius * 0.38);
      ctx.lineTo(-this.radius * 1.8, this.radius * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      ctx.moveTo(-this.radius * 1.2, -this.radius * 0.38);
      ctx.lineTo(-this.radius * 1.9, -this.radius * 0.95);
      ctx.lineTo(-this.radius * 1.6, -this.radius * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-this.radius * 1.2, this.radius * 0.38);
      ctx.lineTo(-this.radius * 1.9, this.radius * 0.95);
      ctx.lineTo(-this.radius * 1.6, this.radius * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

    } else if (isRanger) {
      // 3. RANGER Rail Sabot: glowing plasma field and heavy multi stage sabot shell
      const corePulse = 1.0 + Math.sin(Date.now() / 60) * 0.15;
      const glowGrad = ctx.createRadialGradient(0, 0, this.radius * 0.4, 0, 0, this.radius * 3.5);
      glowGrad.addColorStop(0, 'rgba(51, 204, 255, 0.7)');
      glowGrad.addColorStop(0.5, 'rgba(0, 100, 255, 0.3)');
      glowGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 3.5 * corePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const housingGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
      housingGrad.addColorStop(0, '#777777');
      housingGrad.addColorStop(0.5, '#eaeaea');
      housingGrad.addColorStop(1, '#333333');

      ctx.fillStyle = housingGrad;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3.0;

      ctx.beginPath();
      ctx.moveTo(-this.radius * 2.0, -this.radius * 0.45);
      ctx.lineTo(-this.radius * 1.0, -this.radius * 0.7);
      ctx.lineTo(this.radius * 0.8, -this.radius * 0.7);
      ctx.lineTo(this.radius * 3.0, 0); 
      ctx.lineTo(this.radius * 0.8, this.radius * 0.7);
      ctx.lineTo(-this.radius * 1.0, this.radius * 0.7);
      ctx.lineTo(-this.radius * 2.0, this.radius * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 1.3, -this.radius * 0.25);
      ctx.lineTo(this.radius * 1.5, 0);
      ctx.lineTo(-this.radius * 1.3, this.radius * 0.25);
      ctx.stroke();

    } else if (isStalker) {
      // 4. STALKER Suppressed Obsidian: refractive active optical camo halo
      const shimmer = 0.45 + Math.sin(Date.now() / 80) * 0.22;
      ctx.strokeStyle = `rgba(147, 51, 234, ${shimmer})`;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.8, 0, Math.PI * 2);
      ctx.stroke();

      const shOuter = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius * 2.2);
      shOuter.addColorStop(0, 'rgba(20, 10, 30, 0.4)');
      shOuter.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shOuter;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      const obsGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
      obsGrad.addColorStop(0, '#1c1917');
      obsGrad.addColorStop(0.35, '#44403c');
      obsGrad.addColorStop(0.7, '#1c1917');
      obsGrad.addColorStop(1.0, '#0c0a09');

      ctx.fillStyle = obsGrad;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)'; 
      ctx.lineWidth = 2.0;

      ctx.beginPath();
      ctx.moveTo(-this.radius * 1.6, -this.radius * 0.65);
      ctx.lineTo(this.radius * 0.5, -this.radius * 0.65);
      ctx.quadraticCurveTo(this.radius * 1.6, -this.radius * 0.3, this.radius * 2.0, 0);
      ctx.quadraticCurveTo(this.radius * 1.6, this.radius * 0.3, this.radius * 0.5, this.radius * 0.65);
      ctx.lineTo(-this.radius * 1.6, this.radius * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.lineWidth = 1.5;
      for (let i = -1.1; i < 0.3; i += 0.4) {
        ctx.beginPath();
        ctx.moveTo(this.radius * i, -this.radius * 0.6);
        ctx.lineTo(this.radius * i, this.radius * 0.6);
        ctx.stroke();
      }

    } else if (isHunter) {
      // 5. HUNTER Stacked Rounds
      if (this.barrelIndex === 0) {
        // Heavy Shotgun Slug
        const slugGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
        slugGrad.addColorStop(0, baseColor);
        slugGrad.addColorStop(0.4, '#ffffff');
        slugGrad.addColorStop(0.8, baseColor);
        slugGrad.addColorStop(1.0, '#333333');

        ctx.fillStyle = slugGrad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.8;

        ctx.beginPath();
        ctx.moveTo(-this.radius * 1.3, -this.radius * 0.7);
        ctx.lineTo(this.radius * 0.6, -this.radius * 0.7);
        ctx.bezierCurveTo(this.radius * 1.3, -this.radius * 0.6, this.radius * 1.3, this.radius * 0.6, this.radius * 0.6, this.radius * 0.7);
        ctx.lineTo(-this.radius * 1.3, this.radius * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#111';
        ctx.fillRect(-this.radius * 1.3, -this.radius * 0.45, this.radius * 0.35, this.radius * 0.9);
        ctx.strokeRect(-this.radius * 1.3, -this.radius * 0.45, this.radius * 0.35, this.radius * 0.9);
      } else {
        // High Velocity Concentric Needle Dart
        const dartGrad = ctx.createLinearGradient(0, -this.radius * 0.7, 0, this.radius * 0.7);
        dartGrad.addColorStop(0, '#f97316');
        dartGrad.addColorStop(0.5, '#fed7aa');
        dartGrad.addColorStop(1, '#ea580c');

        ctx.fillStyle = dartGrad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.0;

        ctx.beginPath();
        ctx.moveTo(-this.radius * 1.6, -this.radius * 0.2);
        ctx.lineTo(-this.radius * 0.8, -this.radius * 0.45);
        ctx.lineTo(this.radius * 0.6, -this.radius * 0.4);
        ctx.lineTo(this.radius * 2.2, 0); 
        ctx.lineTo(this.radius * 0.6, this.radius * 0.4);
        ctx.lineTo(-this.radius * 0.8, this.radius * 0.45);
        ctx.lineTo(-this.radius * 1.6, this.radius * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

    } else if (isXHunter) {
      // 6. X HUNTER Triple Nested Rounds
      if (this.barrelIndex === 0) {
        // Heavy Sleeve Casing Slug
        const hGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
        hGrad.addColorStop(0, baseColor);
        hGrad.addColorStop(0.5, '#ffffff');
        hGrad.addColorStop(1, '#222');

        ctx.fillStyle = hGrad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3.2;

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.1, Math.PI / 2, -Math.PI / 2, false);
        ctx.lineTo(-this.radius * 1.2, -this.radius * 1.1);
        ctx.lineTo(-this.radius * 1.2, this.radius * 1.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.5, -this.radius * 1.0);
        ctx.lineTo(-this.radius * 0.5, this.radius * 1.0);
        ctx.stroke();

      } else if (this.barrelIndex === 1) {
        // Sleek torpedo projectile
        const mGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
        mGrad.addColorStop(0, '#3b82f6');
        mGrad.addColorStop(0.5, '#93c5fd');
        mGrad.addColorStop(1, '#1d4ed8');

        ctx.fillStyle = mGrad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.4;

        ctx.beginPath();
        ctx.moveTo(-this.radius * 1.6, -this.radius * 0.35);
        ctx.lineTo(-this.radius * 0.8, -this.radius * 0.65);
        ctx.lineTo(this.radius * 0.8, -this.radius * 0.65);
        ctx.lineTo(this.radius * 1.8, 0); 
        ctx.lineTo(this.radius * 0.8, this.radius * 0.65);
        ctx.lineTo(-this.radius * 0.8, this.radius * 0.65);
        ctx.lineTo(-this.radius * 1.6, this.radius * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-this.radius * 0.3, -this.radius * 0.55, this.radius * 0.4, this.radius * 1.1);

      } else {
        // Gold needle rocket
        const iGrad = ctx.createLinearGradient(0, -this.radius, 0, this.radius);
        iGrad.addColorStop(0, '#eab308');
        iGrad.addColorStop(0.5, '#fef08a');
        iGrad.addColorStop(1, '#ca8a04');

        ctx.fillStyle = iGrad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.8;

        const jetGrad = ctx.createRadialGradient(-this.radius * 1.2, 0, 0, -this.radius * 1.2, 0, this.radius * 1.5);
        jetGrad.addColorStop(0, '#ef4444');
        jetGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.5)');
        jetGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = jetGrad;
        ctx.beginPath();
        ctx.arc(-this.radius * 1.2, 0, this.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = iGrad;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 2.0, -this.radius * 0.2);
        ctx.lineTo(-this.radius * 1.2, -this.radius * 0.5);
        ctx.lineTo(this.radius * 0.8, -this.radius * 0.5);
        ctx.lineTo(this.radius * 2.2, 0); 
        ctx.lineTo(this.radius * 0.8, this.radius * 0.5);
        ctx.lineTo(-this.radius * 1.2, this.radius * 0.5);
        ctx.lineTo(-this.radius * 2.0, this.radius * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-this.radius * 1.6, -this.radius * 0.4);
        ctx.lineTo(-this.radius * 2.2, -this.radius * 0.95);
        ctx.lineTo(-this.radius * 1.9, -this.radius * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-this.radius * 1.6, this.radius * 0.4);
        ctx.lineTo(-this.radius * 2.2, this.radius * 0.95);
        ctx.lineTo(-this.radius * 1.9, this.radius * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawAnnihilatorBullet(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // 1. GIGANTIC PULSATING CORONA GLOW / FISSION ENERGY SHIELD
    const pulseFactor = 1.0 + Math.sin(Date.now() / 80) * 0.05;
    const radGlow = ctx.createRadialGradient(0, 0, this.radius * 0.45, 0, 0, this.radius * pulseFactor * 1.35);
    radGlow.addColorStop(0, 'rgba(16, 185, 129, 0.95)'); // Core Emerald Green
    radGlow.addColorStop(0.35, 'rgba(52, 211, 153, 0.6)'); // Translucent emerald
    radGlow.addColorStop(0.7, 'rgba(5,  150, 105, 0.25)'); // Dark forest green ring
    radGlow.addColorStop(1.0, 'rgba(0,0,0,0)'); // Fade
    
    ctx.fillStyle = radGlow;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulseFactor * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // 2. STABILIZER CORONA SHIELD OUTLINE RING (A glowing high tech field)
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.55)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.05, 0, Math.PI * 2);
    ctx.stroke();

    // 3. INTERNAL OBSIDIAN SINGULARITY CORE
    // Obsidian core with bright emerald green specular highlight
    const coreGrad = ctx.createRadialGradient(-this.radius * 0.22, -this.radius * 0.22, 0, 0, 0, this.radius * 0.95);
    coreGrad.addColorStop(0, '#a7f3d0'); // Shiny bright highlight center
    coreGrad.addColorStop(0.2, '#10b981'); // Radiant emerald green
    coreGrad.addColorStop(0.55, '#064e3b'); // Dark deep forest green
    coreGrad.addColorStop(0.85, '#111827'); // Obsidian outer core border
    coreGrad.addColorStop(1, '#030712'); // Rich void border
    
    ctx.fillStyle = coreGrad;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4. INTERLOCKING POWER RINGS
    // Draw beautiful technical stabilizer rings around center
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 0.75, this.radius * 0.28, Math.PI / 4 + (Date.now() / 600), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 0.75, this.radius * 0.28, -Math.PI / 4 - (Date.now() / 700), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawDestroyerBullet(ctx: CanvasRenderingContext2D) {
    ctx.save();

    const pulse = 1.0 + Math.sin(this.lifeTime / 90) * 0.06;
    const halo = ctx.createRadialGradient(0, 0, this.radius * 0.25, 0, 0, this.radius * 1.55 * pulse);
    halo.addColorStop(0, 'rgba(255, 180, 80, 0.45)');
    halo.addColorStop(0.6, 'rgba(255, 120, 40, 0.18)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.55 * pulse, 0, Math.PI * 2);
    ctx.fill();

    const shellGrad = ctx.createLinearGradient(-this.radius * 1.4, 0, this.radius * 1.6, 0);
    shellGrad.addColorStop(0, '#5b616b');
    shellGrad.addColorStop(0.35, '#e2b07f');
    shellGrad.addColorStop(0.7, '#c97a3a');
    shellGrad.addColorStop(1, '#3b2d25');

    ctx.fillStyle = shellGrad;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-this.radius * 1.25, -this.radius * 0.68);
    ctx.lineTo(this.radius * 0.5, -this.radius * 0.72);
    ctx.quadraticCurveTo(this.radius * 1.2, -this.radius * 0.58, this.radius * 1.75, 0);
    ctx.quadraticCurveTo(this.radius * 1.2, this.radius * 0.58, this.radius * 0.5, this.radius * 0.72);
    ctx.lineTo(-this.radius * 1.25, this.radius * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 234, 205, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.9, -this.radius * 0.55);
    ctx.lineTo(this.radius * 0.35, -this.radius * 0.56);
    ctx.moveTo(-this.radius * 0.9, this.radius * 0.55);
    ctx.lineTo(this.radius * 0.35, this.radius * 0.56);
    ctx.stroke();

    ctx.fillStyle = '#2a1f1a';
    ctx.beginPath();
    ctx.arc(-this.radius * 1.05, 0, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 176, 90, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  drawStandardBullet(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // Throbbing glow dependent on lifetime
    const pulse = 1.0 + Math.sin(this.lifeTime / 80) * 0.15;
    
    const baseColor = this.color;
    const strokeColor = COLORS.border;

    // Outer plasma glow
    ctx.shadowBlur = 12 * pulse;
    ctx.shadowColor = baseColor;

    // Dynamic 3D lighting gradient
    const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius * 1.2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, baseColor);
    grad.addColorStop(0.8, baseColor);
    grad.addColorStop(1, '#000000');

    // Bullet stretching/morphing based on velocity
    const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    const stretch = Math.min(1.6, 1.0 + speed * 0.0012);
    const squish = 1.0 / Math.sqrt(stretch); // Maintain visual mass

    // We scale along X axis which is already aligned with velocity via rotation
    ctx.scale(stretch, squish);

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp shell casing stroke
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    
    // Inner rotating energy core for visual flare
    ctx.rotate(this.lifeTime * 0.015);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Draw a small crosshair/energy intersection
    const innerR = this.radius * 0.55;
    ctx.moveTo(-innerR, 0);
    ctx.lineTo(innerR, 0);
    ctx.moveTo(0, -innerR);
    ctx.lineTo(0, innerR);
    ctx.stroke();

    ctx.restore();
  }

  override drawBody(ctx: CanvasRenderingContext2D) { 
    const remaining = this.maxLifeTime - this.lifeTime; 
    let alpha = remaining < 300 ? Math.max(0, remaining / 300) : 1.0; 
    if (this.isDespawning) {
      const fadeProgress = Math.min(1, (this.lifeTime - this.despawnStartTime) / this.despawnDurationMs);
      alpha *= (1 - fadeProgress);
    }
    ctx.globalAlpha = alpha; 
    
    const isSniper = this.ownerClass === TankClass.SNIPER;
    const isAssassin = this.ownerClass === TankClass.ASSASSIN;
    const isRanger = this.ownerClass === TankClass.RANGER;
    const isStalker = this.ownerClass === TankClass.STALKER;
    const isHunter = this.ownerClass === TankClass.HUNTER;
    const isXHunter = this.ownerClass === TankClass.X_HUNTER;
    const isDestroyer = this.ownerClass === TankClass.DESTROYER || this.ownerClass === TankClass.HYBRID;
    const isAnnihilator = this.ownerClass === TankClass.ANNIHILATOR;

    if (isSniper || isAssassin || isRanger || isStalker || isHunter || isXHunter) {
      this.drawCustomTacticalBullet(ctx);
    } else if (isDestroyer) {
      this.drawDestroyerBullet(ctx);
    } else if (isAnnihilator) {
      this.drawAnnihilatorBullet(ctx);
    } else {
      this.drawStandardBullet(ctx); 
    }
    
    ctx.globalAlpha = 1.0; 
  }
}

class SpatialGrid {
    cellSize: number;
    cells: Map<number, Entity[]> = new Map();
    width: number;
    height: number;
    private cols: number;

    constructor(cellSize: number, width: number, height: number) {
        this.cellSize = cellSize;
        this.width = width;
        this.height = height;
        this.cols = Math.max(1, Math.ceil(width / cellSize));
    }

    private getKey(x: number, y: number) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return cx + cy * this.cols;
    }

    clear() {
        this.cells.clear();
    }

    add(entity: Entity) {
        const key = this.getKey(entity.pos.x, entity.pos.y);
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key)!.push(entity);
    }

    getNeighbors(entity: Entity, out?: Entity[]): Entity[] {
        const target = out ?? [];
        target.length = 0;
        const cx = Math.floor(entity.pos.x / this.cellSize);
        const cy = Math.floor(entity.pos.y / this.cellSize);
        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let y = cy - 1; y <= cy + 1; y++) {
                const key = x + y * this.cols;
                const cell = this.cells.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) target.push(cell[i]);
                }
            }
        }
        return target;
    }

    query(pos: Vector2, radius: number): Entity[] {
        const minX = Math.floor((pos.x - radius) / this.cellSize);
        const maxX = Math.floor((pos.x + radius) / this.cellSize);
        const minY = Math.floor((pos.y - radius) / this.cellSize);
        const maxY = Math.floor((pos.y + radius) / this.cellSize);
        
        const entities: Entity[] = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = x + y * this.cols;
                const cell = this.cells.get(key);
                if (cell) {
                    for (const entity of cell) {
                        if (Vector.dist(pos, entity.pos) <= radius) {
                            entities.push(entity);
                        }
                    }
                }
            }
        }
        return entities;
    }
}

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  entities: Entity[] = [];
  particles: Particle[] = [];
  floatingTexts: FloatingText[] = [];
  uiNotifications: UINotification[] = [];
  lastShapeAlertTimes: Map<string, number> = new Map();
  player: Tank;
  width: number;
  height: number;

  // Rebirth System
  isRebirthing: boolean = false;
  playerState: PlayerState = PlayerState.ACTIVE;
  evolutionTransitionTimer: number = 0;
  bossChoices: TankClass[] = [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD, TankClass.CELESTIAL];
  rebirthSelectionPos: Vector2 | null = null;
  rebirthOptions: { classType: TankClass, pos: Vector2, rotation: number }[] = [];
  keys: Set<string> = new Set();
  keysPressed: Set<string> = new Set();
  mouse: Vector2 = { x: 0, y: 0 };
  mouseDown: boolean = false;
  mouseRightDown: boolean = false;
  lastTime: number = 0;
  private running: boolean = false;
  private rafId: number | null = null;
  idCounter: number = 0;
  onStateUpdate: (state: GameState) => void;
  onGameOver: (stats: { score: number, level: number, classType: TankClass, kills: number, eliteKills: number, transformations: number, eliteSkinsKilled?: TankClass[] }) => void;
  gameOverSignaled: boolean = false;
  kills: number = 0;
  eliteKills: number = 0;
  eliteSkinsKilled: Set<TankClass> = new Set();
  transformations: number = 0;
  sound: SoundEngine;
  darkMode: boolean = true; 
  settings: GameSettings;
  gameMode: GameMode = GameMode.FFA;
  preferredTeam: Team = Team.BLUE;
  preferredColor: string = COLORS.player;
  xp: number = 0;
  level: number = 1;
  maxShapes = 750; 
  currentShapeCount = 0;
  maxEnemies = 25;
  bossSpawnTimer: number = 0;
  eliteSpawnTimer: number = 0;
  shapeSpawnTimer: number = 0;
  killFeed: KillFeedEntry[] = [];
  attractMode: boolean = true;
  spectateTarget: Tank | null = null;
  cameraPos: Vector2 = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };
  cameraZoom: number = 0.8;
  spatialGrid: SpatialGrid;
  
  inNest: boolean = false;
  crasherSpawnTimer: number = 0;
  bossDefenseTimer: number = 0;

  sandboxConfig: SandboxConfig = {
      invincible: false,
      infiniteAmmo: false,
      knockbackEnabled: true,
      botsEnabled: true,
      gameSpeed: 1.0,
      showHitboxes: false,
      freezeAll: false,
      spawningEnabled: true,
      noAbilityCooldown: false,
      shapeSpawnRate: 1.0,
      shapeMaxCount: 300,
      enabledShapes: {
          [ShapeType.SQUARE]: true,
          [ShapeType.TRIANGLE]: true,
          [ShapeType.PENTAGON]: true,
          [ShapeType.HEXAGON]: true,
          [ShapeType.OCTAGON]: true,
      },
      cleanupActive: true,
      showSpawnNotifications: false
  };

  transformationReadyClass: TankClass | null = null;
  transformationReadyClassClass: TankClass | null = null;
  transformationReadyTimer: number = 0;

  primedSpawn: { 
      type: 'SHAPE' | 'BOSS' | 'ALPHA_PENTAGON' | 'VOID_PORTAL' | 'DUMMY' | 'BOT_TANK' | 'ELITE_TANK', 
      shapeType?: ShapeType, 
      rarity: ShapeRarity,
      classType?: TankClass,
      spawnAmount?: number
  } | null = null;

  inVoid: boolean = false;
  voidTimer: number = 0;
  portalSpawnTimer: number = 0;
  transitionAlpha: number = 0;
  isTransitioning: boolean = false;
  shakeAmount: number = 0;
  lightingCanvas: HTMLCanvasElement;
  lightingCtx: CanvasRenderingContext2D;
  private aiUpdateAccumulator: number = 0;
  private ambientUpdateAccumulator: number = 0;
  private aiTickHz: number = 20;
  private ambientTickHz: number = 30;
  private adaptiveControlAccumulator: number = 0;
  private adaptiveLoadEMA: number = 0;
  private telemetryEnabled: boolean = false;
  private useFixedSimulationStep: boolean = true;
  private simulationAccumulator: number = 0;
  private readonly fixedSimulationStep: number = 1 / 60;
  private readonly maxSimulationSubsteps: number = 5;
  private simulationTick: number = 0;
  private aiSystem: AISystem = new AISystem();
  private perfSampleAccumulator: number = 0;
  private perfSampleFrames: number = 0;
  private perfBucketMsTotal: number = 0;
  private perfUpdateMsTotal: number = 0;
  private perfAiEntitiesProcessedTotal: number = 0;
  private perfLastSnapshot: {
      avgBucketMs: number;
      avgUpdateMs: number;
      avgAiEntitiesProcessed: number;
      entityCount: number;
      particleCount: number;
  } = {
      avgBucketMs: 0,
      avgUpdateMs: 0,
      avgAiEntitiesProcessed: 0,
      entityCount: 0,
      particleCount: 0
  };
  private viewportHalfW: number = 0;
  private viewportHalfH: number = 0;
  private playerSpinWindowMs: number = 0;
  private playerSpinAccumRad: number = 0;
  private playerSpinLastRot: number = 0;
  private viewportLeft: number = 0;
  private viewportRight: number = 0;
  private viewportTop: number = 0;
  private viewportBottom: number = 0;
  private lastViewportWidth: number = 0;
  private lastViewportHeight: number = 0;
  private spawnZones: SpawnZone[] = [];
  private zoneShapeCounts: number[] = [];
  private zonePlayerPressure: number[] = [];
  private zoneTeamPressureBlue: number[] = [];
  private zoneTeamPressureRed: number[] = [];
  private spawnHeatmapTimer: number = 0;
  private recentSpawnZoneHistory: number[] = [];
  private baseDefenseAnchors: Record<Team, Vector2[]> = {
      [Team.BLUE]: [],
      [Team.RED]: [],
      [Team.NONE]: []
  };
  private safeZoneScanTimerMs: number = 0;
  private enemyZoneWarningLevel: 0 | 1 | 2 = 0;
  private enemyZoneWarningText: string = '';
  private enemyZoneWarningHoldMs: number = 0;
  private readonly collisionNeighborBuffer: Entity[] = [];
  private readonly visibleEntitiesBuffer: Entity[] = [];
  private statePublishAccumulator: number = 0;
  private readonly statePublishIntervalSec: number = 1 / 8;
  private readonly renderOrder: Partial<Record<EntityType, number>> = {
      [EntityType.VOID_PORTAL]: 1,
      [EntityType.SHAPE]: 2,
      [EntityType.CRASHER]: 2,
      [EntityType.BULLET]: 3,
      [EntityType.DRONE]: 3,
      [EntityType.MINI_TANK]: 3,
      [EntityType.BASE_DEFENSE_DRONE]: 4,
      [EntityType.ENEMY]: 4,
      [EntityType.DUMMY]: 5,
      [EntityType.PLAYER]: 6,
      [EntityType.GUARDIAN]: 7,
      [EntityType.ELITE_TANK]: 8,
      [EntityType.BOSS]: 9
  };
  private statRevision: number = 0;

  constructor(canvas: HTMLCanvasElement, onStateUpdate: (state: GameState) => void, onGameOver: (stats: { score: number, level: number, classType: TankClass, kills: number, eliteKills: number, transformations: number, eliteSkinsKilled?: TankClass[] }) => void, gameMode: GameMode = GameMode.FFA, settings: GameSettings) {
    this.canvas = canvas;
    const baseCtx = canvas.getContext('2d');
    if (!baseCtx) {
      throw new Error('GameEngine requires a Canvas 2D rendering context.');
    }
    this.ctx = baseCtx;
    this.onStateUpdate = onStateUpdate;
    this.onGameOver = onGameOver;
    this.gameMode = gameMode;
    this.settings = settings;
    this.width = CANVAS_WIDTH;
    this.height = CANVAS_HEIGHT;
    this.telemetryEnabled = !!((import.meta as any)?.env?.DEV || (window as any).__vextorPerfEnabled === true);
    this.useFixedSimulationStep = (window as any).__vextorFixedStep === true;
    this.sound = new SoundEngine();
    this.player = new Tank(this.nextId(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, true, Team.BLUE);
    this.playerSpinLastRot = this.player.rotation;
    this.entities.push(this.player);
    this.spatialGrid = new SpatialGrid(300, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    this.lightingCanvas = document.createElement('canvas');
    const lightingCtx = this.lightingCanvas.getContext('2d');
    if (!lightingCtx) {
      throw new Error('GameEngine lighting layer requires a Canvas 2D rendering context.');
    }
    this.lightingCtx = lightingCtx;
    
    (window as any).gameEngine = this;
    this.initSpawnZones();

    for (let i = 0; i < 150; i++) this.spawnShape();
  }

  addParticle(p: Particle) {
    if (this.settings && Math.random() > this.settings.particleDensity) return;
    this.particles.push(p);
  }

  private updateViewportCache() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.viewportHalfW = (vw / this.cameraZoom) * 0.5;
    this.viewportHalfH = (vh / this.cameraZoom) * 0.5;
    this.viewportLeft = this.cameraPos.x - this.viewportHalfW;
    this.viewportRight = this.cameraPos.x + this.viewportHalfW;
    this.viewportTop = this.cameraPos.y - this.viewportHalfH;
    this.viewportBottom = this.cameraPos.y + this.viewportHalfH;
    this.lastViewportWidth = vw;
    this.lastViewportHeight = vh;
  }

  private updateAdaptiveTickRates(dt: number, entityCount: number) {
    this.adaptiveControlAccumulator += dt;
    if (this.adaptiveControlAccumulator < 0.5) return;
    this.adaptiveControlAccumulator = 0;

    const updatePressure = Math.min(1, this.perfLastSnapshot.avgUpdateMs / 16.67);
    const entityPressure = Math.min(1, entityCount / 350);
    const combinedPressure = (updatePressure * 0.7) + (entityPressure * 0.3);
    this.adaptiveLoadEMA = (this.adaptiveLoadEMA * 0.8) + (combinedPressure * 0.2);

    let targetAiHz = this.aiTickHz;
    let targetAmbientHz = this.ambientTickHz;

    if (this.adaptiveLoadEMA > 0.92) {
      targetAiHz = 12;
      targetAmbientHz = 20;
    } else if (this.adaptiveLoadEMA > 0.78) {
      targetAiHz = 16;
      targetAmbientHz = 24;
    } else if (this.adaptiveLoadEMA > 0.62) {
      targetAiHz = 20;
      targetAmbientHz = 30;
    } else {
      targetAiHz = 26;
      targetAmbientHz = 38;
    }

    // Small hysteresis: only move one step each control window.
    const aiStep = 2;
    const ambientStep = 3;
    if (targetAiHz > this.aiTickHz) this.aiTickHz = Math.min(targetAiHz, this.aiTickHz + aiStep);
    else if (targetAiHz < this.aiTickHz) this.aiTickHz = Math.max(targetAiHz, this.aiTickHz - aiStep);
    if (targetAmbientHz > this.ambientTickHz) this.ambientTickHz = Math.min(targetAmbientHz, this.ambientTickHz + ambientStep);
    else if (targetAmbientHz < this.ambientTickHz) this.ambientTickHz = Math.max(targetAmbientHz, this.ambientTickHz - ambientStep);
  }

  private initSpawnZones() {
    const cols = 6;
    const rows = 4;
    const zoneW = CANVAS_WIDTH / cols;
    const zoneH = CANVAS_HEIGHT / rows;
    this.spawnZones = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const zx = x * zoneW;
        const zy = y * zoneH;
        this.spawnZones.push({
          x: zx,
          y: zy,
          w: zoneW,
          h: zoneH,
          cx: zx + zoneW * 0.5,
          cy: zy + zoneH * 0.5
        });
      }
    }
    this.zoneShapeCounts = new Array(this.spawnZones.length).fill(0);
    this.zonePlayerPressure = new Array(this.spawnZones.length).fill(0);
    this.zoneTeamPressureBlue = new Array(this.spawnZones.length).fill(0);
    this.zoneTeamPressureRed = new Array(this.spawnZones.length).fill(0);
    this.recentSpawnZoneHistory = [];
  }

  private getZoneIndexForPos(pos: Vector2): number {
    const cols = 6;
    const rows = 4;
    const cellW = CANVAS_WIDTH / cols;
    const cellH = CANVAS_HEIGHT / rows;
    const cx = Vector.clamp(Math.floor(pos.x / cellW), 0, cols - 1);
    const cy = Vector.clamp(Math.floor(pos.y / cellH), 0, rows - 1);
    return cy * cols + cx;
  }

  private refreshSpawnHeatmap(dt: number) {
    this.spawnHeatmapTimer += dt;
    if (this.spawnHeatmapTimer < 0.4) return;
    this.spawnHeatmapTimer = 0;

    if (this.spawnZones.length === 0) this.initSpawnZones();
    this.zoneShapeCounts.fill(0);
    this.zonePlayerPressure.fill(0);
    this.zoneTeamPressureBlue.fill(0);
    this.zoneTeamPressureRed.fill(0);

    for (const e of this.entities) {
      if (e.isDead) continue;
      const zoneIndex = this.getZoneIndexForPos(e.pos);
      if (e.type === EntityType.SHAPE) {
        this.zoneShapeCounts[zoneIndex] += 1;
      } else if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) {
        const tank = e as Tank;
        this.zonePlayerPressure[zoneIndex] += 1;
        if (tank.team === Team.BLUE) this.zoneTeamPressureBlue[zoneIndex] += 1;
        if (tank.team === Team.RED) this.zoneTeamPressureRed[zoneIndex] += 1;
      }
    }
  }

  private pickSpawnZoneIndex(): number {
    if (this.spawnZones.length === 0) this.initSpawnZones();
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    let bestZone = Math.floor(Math.random() * this.spawnZones.length);
    let bestScore = -Infinity;

    for (let i = 0; i < this.spawnZones.length; i++) {
      const zone = this.spawnZones[i];
      const shapes = this.zoneShapeCounts[i] || 0;
      const pressure = this.zonePlayerPressure[i] || 0;
      const bluePressure = this.zoneTeamPressureBlue[i] || 0;
      const redPressure = this.zoneTeamPressureRed[i] || 0;
      const recentlyUsed = this.recentSpawnZoneHistory.includes(i);
      const distFromMidNorm = Math.min(1, Vector.dist({ x: zone.cx, y: zone.cy }, center) / (Math.hypot(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.5));
      const midBias = 1 - distFromMidNorm;

      let score = 1.0;
      score += Math.max(0, 5 - shapes) * 1.2;
      score += Math.max(0, 3 - pressure) * 1.4;
      if (recentlyUsed) score -= 2.0;

      if (this.gameMode === GameMode.TEAMS) {
        const teamDiff = Math.abs(bluePressure - redPressure);
        score += midBias * 2.2;
        score += Math.max(0, 2 - teamDiff) * 1.0;
      } else {
        const playerDist = Vector.dist({ x: zone.cx, y: zone.cy }, this.player.pos);
        score += Math.min(1.5, playerDist / 1800) * 0.9;
      }

      score += (Math.random() - 0.5) * 0.6;
      if (score > bestScore) {
        bestScore = score;
        bestZone = i;
      }
    }

    return bestZone;
  }

  private getSpawnPositionInZone(zoneIndex: number): Vector2 {
    const zone = this.spawnZones[zoneIndex];
    const margin = 80;
    return {
      x: Vector.randomRange(zone.x + margin, zone.x + zone.w - margin),
      y: Vector.randomRange(zone.y + margin, zone.y + zone.h - margin)
    };
  }

  private pickShapeTypeForSpawn(zoneIndex: number): ShapeType {
    const zone = this.spawnZones[zoneIndex];
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const distNorm = Math.min(1, Vector.dist({ x: zone.cx, y: zone.cy }, center) / (Math.hypot(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.5));
    const roll = Math.random();

    if (this.gameMode === GameMode.TEAMS) {
      const midBias = 1 - distNorm;
      const octThresh = 0.006 + midBias * 0.024;
      const hexThresh = octThresh + (0.02 + midBias * 0.06);
      const pentThresh = hexThresh + (0.12 + midBias * 0.18);
      const triThresh = pentThresh + 0.28;
      if (roll < octThresh) return ShapeType.OCTAGON;
      if (roll < hexThresh) return ShapeType.HEXAGON;
      if (roll < pentThresh) return ShapeType.PENTAGON;
      if (roll < triThresh) return ShapeType.TRIANGLE;
      return ShapeType.SQUARE;
    }

    if (roll < 0.006) return ShapeType.OCTAGON;
    if (roll < 0.025) return ShapeType.HEXAGON;
    if (roll < 0.09) return ShapeType.PENTAGON;
    if (roll < 0.24) return ShapeType.TRIANGLE;
    return ShapeType.SQUARE;
  }

  nextId() { return ++this.idCounter; }
  setPlayerName(name: string) { this.player.name = name; }
  setPlayerColor(color: string) { 
      this.preferredColor = color;
      const isBoss = this.isBossClass(this.player.classType);
      if (this.gameMode !== GameMode.TEAMS && !isBoss) {
          this.player.color = color; 
      }
  }
  setPlayerTeam(team: Team) { this.preferredTeam = team; }
  getNowMs() { return Date.now(); }
  setGameMode(mode: GameMode) { 
      this.gameMode = mode; 
      if (mode === GameMode.TEAMS) {
          this.spawnGuardians();
          this.spawnBaseDefenseDrones();
      } else if (mode === GameMode.SANDBOX) {
          this.clearBaseDefenseDrones();
          this.cleanupForSandbox();
      } else {
          this.clearBaseDefenseDrones();
      }
  }

  private cleanupForSandbox() {
      // CLEAR EVERYTHING EXCEPT PLAYER
      this.entities = this.entities.filter(e => e.type === EntityType.PLAYER);
      this.particles = [];
      this.uiNotifications = [];
      this.killFeed = [];
      this.floatingTexts = [];
      
      // RESET SANDBOX CONFIG
      this.sandboxConfig = {
          invincible: false,
          infiniteAmmo: false,
          knockbackEnabled: true,
          botsEnabled: false,
          gameSpeed: 1.0,
          showHitboxes: false,
          freezeAll: false,
          spawningEnabled: false,
          noAbilityCooldown: false,
          shapeSpawnRate: 1.0,
          shapeMaxCount: 300,
          enabledShapes: {
              [ShapeType.SQUARE]: true,
              [ShapeType.TRIANGLE]: true,
              [ShapeType.PENTAGON]: true,
              [ShapeType.HEXAGON]: true,
              [ShapeType.OCTAGON]: true,
          },
          cleanupActive: true,
          showSpawnNotifications: false
      };
      
      this.addNotification("SANDBOX_CLEAN_BOOT // PROTOCOL_READY", "#00ffff");
  }
  setDarkMode(enabled: boolean) { this.darkMode = enabled; }
  setSettings(settings: GameSettings) { 
      this.settings = settings; 
      this.sound.setVolume(settings.volume);
  }
  setAttractMode(enabled: boolean) { 
      this.attractMode = enabled; 
      if (enabled) {
          this.spectateTarget = null;
      }
  }

  getTeamCounts() {
      const counts = { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 };
      this.entities.forEach(e => {
          if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) {
              const tank = e as Tank;
              if (tank.team !== undefined) {
                  counts[tank.team]++;
              }
          }
      });
      return counts;
  }

  canJoinTeam(team: Team): boolean {
      if (this.gameMode !== GameMode.TEAMS) return true;
      const counts = this.getTeamCounts();
      const otherTeam = team === Team.BLUE ? Team.RED : Team.BLUE;
      
      // Much more lenient team balancing: 
      // Allow joining any team if it has fewer than 15 players, 
      // or if joining wouldn't make the team more than 4 players larger than the other.
      if (counts[team] < 15) return true; 
      return counts[team] <= counts[otherTeam] + 4;
  }

  cycleSpectateTarget(direction: number = 1) {
      const bots = this.entities.filter(e => (e.type === EntityType.ENEMY || e.type === EntityType.PLAYER) && !e.isDead) as Tank[];
      if (bots.length === 0) {
          this.spectateTarget = null;
          return;
      }
      
      if (!this.spectateTarget) {
          this.spectateTarget = bots[0];
          return;
      }

      const currentIndex = bots.findIndex(b => b.id === this.spectateTarget?.id);
      if (currentIndex === -1) {
          this.spectateTarget = bots[0];
          return;
      }

      let nextIndex = (currentIndex + direction) % bots.length;
      if (nextIndex < 0) nextIndex = bots.length - 1;
      this.spectateTarget = bots[nextIndex];
  }
  
  addNotification(text: string, color: string) { 
    // Intelligent Notification Buffer: Avoid rapid flicker if the same message is sent repeatedly
    const existing = this.uiNotifications.find(n => n.text === text && Date.now() - (n.timestamp || 0) < 1500);
    if (existing) {
        existing.life = 3.0; // Refresh life
        return;
    }
    
    const newNotification = { 
        id: Math.random().toString(36), 
        text, 
        color, 
        life: 3.0, 
        maxLife: 3.0,
        timestamp: Date.now() 
    };
    
    this.uiNotifications = [newNotification, ...this.uiNotifications].slice(0, 4);
    this.sound.playNotification();
  }
  
  toggleAutoFire() { this.player.autoFire = !this.player.autoFire; this.addNotification(this.player.autoFire ? "AUTO FIRE ON" : "AUTO FIRE OFF", this.player.autoFire ? "#00e16e" : "#ff4444"); }
  toggleAutoSpin() { this.player.autoSpin = !this.player.autoSpin; this.addNotification(this.player.autoSpin ? "AUTO SPIN ON" : "AUTO SPIN OFF", this.player.autoSpin ? "#00e16e" : "#ff4444"); }
  
  clearEntities(type: 'ALL' | 'BULLETS' | 'SHAPES' | 'ENEMIES' | 'MISC' = 'ALL') {
      if (type === 'ALL') {
          this.entities = this.entities.filter(e => e.type === EntityType.PLAYER);
      } else if (type === 'BULLETS') {
          this.entities = this.entities.filter(e => e.type !== EntityType.BULLET);
      } else if (type === 'SHAPES') {
          this.entities = this.entities.filter(e => e.type !== EntityType.SHAPE && e.type !== EntityType.BOSS);
      } else if (type === 'ENEMIES') {
          this.entities = this.entities.filter(e => e.type !== EntityType.ENEMY && e.type !== EntityType.ELITE_TANK);
      } else if (type === 'MISC') {
          this.entities = this.entities.filter(e => e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.SHAPE);
      }
      this.particles = [];
      this.currentShapeCount = this.entities.filter(e => e.type === EntityType.SHAPE).length;
      this.addNotification(`TERMINAL PURGE: ${type}`, "#ffcc00");
  }
  
  executePrimedSpawn(screenX: number, screenY: number) {
      if (!this.primedSpawn || !this.sandboxConfig.spawningEnabled) return;
      
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const worldX = (screenX - viewW/2) / this.cameraZoom + this.cameraPos.x;
      const worldY = (screenY - viewH/2) / this.cameraZoom + this.cameraPos.y;

      const { type, shapeType, rarity, classType, spawnAmount = 1 } = this.primedSpawn;

      for (let i = 0; i < spawnAmount; i++) {
          const ox = (Math.random() - 0.5) * 40 * (spawnAmount > 1 ? 2 : 0);
          const oy = (Math.random() - 0.5) * 40 * (spawnAmount > 1 ? 2 : 0);
          
          if (type === 'SHAPE' && shapeType) {
              if (this.currentShapeCount < (this.sandboxConfig?.shapeMaxCount || 400)) {
                  this.entities.push(new Shape(this.nextId(), worldX + ox, worldY + oy, shapeType, this.inVoid, rarity));
                  this.currentShapeCount++;
              }
          } else if (type === 'BOSS') {
              const boss = new Boss(this.nextId());
              boss.pos = { x: worldX + ox, y: worldY + oy };
              this.entities.push(boss);
          } else if (type === 'ELITE_TANK') { 
              const elite = new EliteTank(this.nextId(), worldX + ox, worldY + oy, classType || TankClass.BASIC);
              this.entities.push(elite);
          } else if (type === 'ALPHA_PENTAGON') {
              const shape = new Shape(this.nextId(), worldX + ox, worldY + oy, ShapeType.PENTAGON, false, ShapeRarity.LEGENDARY);
              shape.radius *= 4;
              shape.maxHealth *= 10;
              shape.health = shape.maxHealth;
              shape.xpValue *= 5;
              this.entities.push(shape);
          } else if (type === 'VOID_PORTAL') {
              this.entities.push(new VoidPortal(this.nextId(), worldX + ox, worldY + oy));
          } else if (type === 'DUMMY') {
              this.entities.push(new TestDummy(this.nextId(), worldX + ox, worldY + oy));
          } else if (type === 'BOT_TANK' && classType) {
              const bot = new Tank(this.nextId(), worldX + ox, worldY + oy, false, Team.RED);
              bot.name = `UNIT_BOT_${bot.id}`;
              this.upgradeClassForTank(bot, classType);
              (Object.values(StatType) as StatType[]).forEach(s => {
                  bot.stats[s] = 8;
                  bot.universalUpgrades[s] = 8;
              });
              bot.updateStats();
              bot.health = bot.maxHealth;
              this.entities.push(bot);
          }
      }

      this.sound.playLevelUp();
      this.spawnParticles({ x: worldX, y: worldY }, "#fff", 20, 4);
      this.addNotification(`${type} FABRICATION COMPLETE`, "#fff");
  }

  setSandboxFlag(key: keyof SandboxConfig, val: any) { 
      (this.sandboxConfig as any)[key] = val; 
      this.addNotification(`SYSTEM: ${(key as string).toUpperCase()} => ${val}`, "#00ffff");
      if (key === 'spawningEnabled' && !val) {
          this.primedSpawn = null;
      }
  }

  setShapeToggle(type: ShapeType, enabled: boolean) {
      if (this.sandboxConfig) {
          this.sandboxConfig.enabledShapes[type] = enabled;
          this.addNotification(`CORE: ${type.toUpperCase()} FABRICATION ${enabled ? 'ENABLED' : 'DISABLED'}`, enabled ? "#00e16e" : "#ff4444");
      }
  }
  teleportPlayer() { const mouseOffset = Vector.sub(this.mouse, { x: window.innerWidth / 2, y: window.innerHeight / 2 }); const targetPos = Vector.add(this.player.pos, Vector.div(mouseOffset, this.player.fov)); this.player.pos = targetPos; this.addNotification("PHASE SHIFTED", "#00ffff"); }
  maxAllStats() {
      (Object.values(StatType) as StatType[]).forEach(s => {
          this.player.stats[s] = 8;
          this.player.universalUpgrades[s] = 8;
      });
      this.player.updateStats();
      this.player.availableStatPoints = 0;
      this.addNotification("STATS OVERCLOCKED", "#ffd700");
  }
  resetAllStats() {
      (Object.values(StatType) as StatType[]).forEach(s => {
          this.player.stats[s] = 0;
          this.player.universalUpgrades[s] = 0;
      });
      this.player.inactiveUpgradeBank = {};
      this.player.lastUpgradeRemapSummary = [];
      this.player.updateStats();
      this.player.availableStatPoints = Math.min(this.level, 45) - 1;
      this.addNotification("STATS FLUSHED", "#333");
  }
  instantLevel(level: number) { 
      this.level = level; 
      this.player.level = level; 
      this.player.availableStatPoints = Math.min(level, 45) - 1; 
      this.player.updateStats(); 
      this.addNotification(`SYNCED TO LVL ${level}`, "#33ccff"); 
  }

  spawnElite() {
      const pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
      const classes = [TankClass.TWIN, TankClass.DESTROYER, TankClass.SNIPER, TankClass.OVERLORD, TankClass.MACHINE_GUN];
      const chosenClass = classes[Math.floor(Math.random() * classes.length)];
      const elite = new EliteTank(this.nextId(), pos.x, pos.y, chosenClass);
      this.entities.push(elite);
      this.addNotification(`⚠️ ELITE ${chosenClass.toUpperCase()} DETECTED ⚠️`, "#ff4444");
      this.sound.playLevelUp();
  }

  spawnGuardians() {
    this.entities = this.entities.filter(e => e.type !== EntityType.GUARDIAN);
    if (this.gameMode === GameMode.TEAMS) {
        for(let i=0; i<3; i++) {
            this.entities.push(new Guardian(this.nextId(), 300, CANVAS_HEIGHT / 2 + (i - 1) * 800, Team.BLUE));
            this.entities.push(new Guardian(this.nextId(), CANVAS_WIDTH - 300, CANVAS_HEIGHT / 2 + (i - 1) * 800, Team.RED));
        }
    }
  }

  private clearBaseDefenseDrones() {
      this.entities = this.entities.filter(e => e.type !== EntityType.BASE_DEFENSE_DRONE);
  }

  private spawnBaseDefenseDrones() {
      this.clearBaseDefenseDrones();
      this.baseDefenseAnchors[Team.BLUE] = [];
      this.baseDefenseAnchors[Team.RED] = [];
      if (this.gameMode !== GameMode.TEAMS || this.inVoid) return;

      const zoneCenterY = [CANVAS_HEIGHT * 0.2, CANVAS_HEIGHT * 0.5, CANVAS_HEIGHT * 0.8];
      const blueX = BASE_ZONE_WIDTH * 0.5;
      const redX = CANVAS_WIDTH - BASE_ZONE_WIDTH * 0.5;
      zoneCenterY.forEach(y => {
          this.baseDefenseAnchors[Team.BLUE].push({ x: blueX, y });
          this.baseDefenseAnchors[Team.RED].push({ x: redX, y });
      });

      const addTeam = (team: Team) => {
          const anchors = this.baseDefenseAnchors[team];
          const perZoneBase = Math.max(1, Math.floor(SAFE_ZONE_DEFENSE_DRONES_PER_TEAM / anchors.length));
          const remainder = Math.max(0, SAFE_ZONE_DEFENSE_DRONES_PER_TEAM - perZoneBase * anchors.length);
          for (let zoneIdx = 0; zoneIdx < anchors.length; zoneIdx++) {
              const perZone = perZoneBase + (zoneIdx < remainder ? 1 : 0);
              for (let slot = 0; slot < perZone; slot++) {
                  this.entities.push(new BaseDefenseDrone(this.nextId(), team, anchors[zoneIdx], slot, 58));
              }
          }
      };

      addTeam(Team.BLUE);
      addTeam(Team.RED);
  }

  private updateBaseDefenseSystem(dt: number) {
      if (this.gameMode !== GameMode.TEAMS || this.inVoid) return;
      this.safeZoneScanTimerMs -= dt * 1000;
      if (this.safeZoneScanTimerMs > 0) return;
      this.safeZoneScanTimerMs = SAFE_ZONE_DRONE_SCAN_INTERVAL_MS;

      const drones = this.entities.filter(e => e.type === EntityType.BASE_DEFENSE_DRONE && !e.isDead) as BaseDefenseDrone[];
      if (drones.length === 0) return;

      const intrudersByTeam: Record<Team, Entity[]> = {
          [Team.BLUE]: [],
          [Team.RED]: [],
          [Team.NONE]: []
      };
      const isTankLike = (e: Entity) => e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK;
      for (const e of this.entities) {
          if (!isTankLike(e) || e.team === Team.NONE || e.isDead) continue;
          if (e.team === Team.RED && e.pos.x < BASE_ZONE_WIDTH + SAFE_ZONE_ENGAGEMENT_RADIUS) intrudersByTeam[Team.BLUE].push(e);
          if (e.team === Team.BLUE && e.pos.x > CANVAS_WIDTH - BASE_ZONE_WIDTH - SAFE_ZONE_ENGAGEMENT_RADIUS) intrudersByTeam[Team.RED].push(e);
      }

      const assignTeam = (defenderTeam: Team) => {
          const teamDrones = drones.filter(d => d.team === defenderTeam);
          const intruders = intrudersByTeam[defenderTeam];
          if (intruders.length === 0) {
              teamDrones.forEach(d => d.assignTarget(null));
              return;
          }

          const assignments = new Set<number>();
          for (const intruder of intruders) {
              const sorted = teamDrones
                  .filter(d => !assignments.has(d.id))
                  .sort((a, b) => Vector.dist(a.pos, intruder.pos) - Vector.dist(b.pos, intruder.pos));
              const defenders = sorted.slice(0, 3);
              defenders.forEach(d => {
                  d.assignTarget(intruder.id);
                  assignments.add(d.id);
              });
          }
          teamDrones.forEach(d => {
              if (!assignments.has(d.id)) d.assignTarget(null);
          });
      };

      assignTeam(Team.BLUE);
      assignTeam(Team.RED);
  }

  spawnBoss() {
    if (this.entities?.find(e => e.type === EntityType.BOSS)) return;
    this.entities.push(new Boss(this.nextId()));
    this.addNotification("⚠️ THE GRAND SINGULARITY HAS ARRIVED ⚠️", "#00ffff");
    this.sound.playRoar();
  }

  handleTransformation() {
      if (this.transformationReadyTimer > 0 && this.transformationReadyClass) {
          this.player.isTransformed = true;
          this.player.transformationTimer = 180; 
          this.player.classType = this.transformationReadyClass;
          this.player.barrels = TANK_CONFIGS[this.transformationReadyClass];
          
          const isBoss = this.isBossClass(this.transformationReadyClass);
          if (isBoss) {
              this.player.color = '#9f76fc'; // Purple for commanders
          }

          this.player.updateStats();
          this.player.health = this.player.maxHealth;
          this.transformationReadyTimer = 0;
          this.transformations++;
          this.addNotification("YOU HAVE ASCENDED!", "#ff4444");
          this.sound.playLevelUp();
          this.spawnParticles(this.player.pos, "#ff4444", 50, 6);
      }
  }

  resetPlayer(preserveWorld: boolean = false) {
    this.player.isDead = false; 
    this.gameOverSignaled = false; 
    this.player.invulnerableTime = 3000; // 3 seconds spawn protection
    this.kills = 0;
    this.eliteKills = 0;
    this.eliteSkinsKilled.clear();
    this.transformations = 0;
    this.player.isTransformed = false;
    this.player.transformationTimer = 0;
    this.player.radius = 20;
    this.player.activeBuffs = [];
    this.transformationReadyTimer = 0;
    this.primedSpawn = null;
    this.isTransitioning = false;
    this.player.isSacrificing = false;
    this.player.sacrificeActiveTimer = 0;
    this.player.sacrificeCooldownTimer = 0;
    
    if (preserveWorld) { 
        const newLevel = Math.max(1, Math.floor(this.level * 0.7)); 
        this.level = newLevel; 
        this.player.level = newLevel; 
        this.player.score = 0; 
        this.xp = 0; 
        this.player.availableStatPoints = Math.max(0, Math.min(newLevel, 45) - 1); 
        if (newLevel > 1) this.addNotification(`RESPAWNED AT LEVEL ${newLevel}`, "#33ccff"); 
    }
    else { 
        this.player.score = 0; 
        this.level = 1; 
        this.player.level = 1; 
        this.xp = 0; 
        this.player.availableStatPoints = 0; 
    }
    this.player.autoFire = false; 
    this.player.autoSpin = false; 
    this.uiNotifications = [];

    if (this.gameMode === GameMode.TEAMS) { 
        this.player.team = this.preferredTeam; 
        this.player.color = (this.player.team === Team.BLUE) ? COLORS.player : COLORS.enemy; 
        if (this.player.team === Team.BLUE) this.player.pos = { x: Vector.randomRange(100, BASE_ZONE_WIDTH - 100), y: Vector.randomRange(100, CANVAS_HEIGHT - 100) }; 
        else this.player.pos = { x: Vector.randomRange(CANVAS_WIDTH - BASE_ZONE_WIDTH + 100, CANVAS_WIDTH - 100), y: Vector.randomRange(100, CANVAS_HEIGHT - 100) }; 
    }
    else { 
        this.player.team = Team.BLUE; 
        this.player.color = this.preferredColor;
        this.player.pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT); 
    }
    this.player.vel = { x: 0, y: 0 }; 
    this.player.stats = { 
        [StatType.REGEN]: 0, [StatType.MAX_HEALTH]: 0, [StatType.MAX_SHIELD]: 0, [StatType.BODY_DAMAGE]: 0, 
        [StatType.BULLET_SPEED]: 0, [StatType.BULLET_PENETRATION]: 0, [StatType.BULLET_DAMAGE]: 0, 
        [StatType.RELOAD]: 0, [StatType.MOVEMENT_SPEED]: 0, [StatType.BULLET_SPREAD]: 0,
        [StatType.HEALING_RADIUS]: 0, [StatType.HEALING_EFFICIENCY]: 0, [StatType.HEALING_BURST]: 0, [StatType.SUPPORT_XP_MULT]: 0,
        [StatType.DRAIN_RADIUS]: 0, [StatType.DRAIN_EFFICIENCY]: 0, [StatType.DRAIN_LIFESTEAL]: 0, [StatType.DRAIN_BURST]: 0
    }; 
    this.player.universalUpgrades = { ...this.player.stats };
    this.player.inactiveUpgradeBank = {};
    this.player.lastUpgradeRemapSummary = [];
    this.player.updateStats(); 
    this.player.health = this.player.maxHealth; 
    this.player.displayHealth = this.player.maxHealth; 
    this.player.socialSpinSignalUntil = 0;
    this.playerSpinWindowMs = 0;
    this.playerSpinAccumRad = 0;
    this.playerSpinLastRot = this.player.rotation;
    this.player.shield = 0; 
    this.player.invulnerableTime = 3000; 
    this.upgradeClass(TankClass.BASIC);
    if (!this.entities.includes(this.player)) this.entities.push(this.player);
    if (!preserveWorld) { 
        this.entities = this.entities.filter(e => e.type === EntityType.SHAPE || e === this.player); 
        this.currentShapeCount = this.entities.filter(e => e.type === EntityType.SHAPE).length;
        this.killFeed = []; this.floatingTexts = []; this.particles = []; this.bossSpawnTimer = 0; this.eliteSpawnTimer = 0; if (this.gameMode === GameMode.TEAMS) { this.spawnGuardians(); this.spawnBaseDefenseDrones(); }
    }
    if (this.gameMode !== GameMode.TEAMS) {
      this.entities = this.entities.filter(e => e.type !== EntityType.GUARDIAN);
      this.clearBaseDefenseDrones();
    }
    this.attractMode = false;
    this.inVoid = false;
    this.voidTimer = 0;

    if (this.gameMode === GameMode.SANDBOX) {
        this.instantLevel(MAX_LEVEL);
        this.addNotification("VEXTOR SANDBOX INITIALIZED", "#00ffff");
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }
  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  isRunning() {
    return this.running;
  }
  destroy() {
    this.stop();
  }
  loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1) * this.sandboxConfig.gameSpeed;
    this.lastTime = now;

    if (this.useFixedSimulationStep) {
      this.simulationAccumulator = Math.min(0.25, this.simulationAccumulator + dt);
      let substeps = 0;
      while (this.simulationAccumulator >= this.fixedSimulationStep && substeps < this.maxSimulationSubsteps) {
        this.update(this.fixedSimulationStep);
        this.simulationAccumulator -= this.fixedSimulationStep;
        substeps++;
      }
    } else {
      this.update(dt);
    }

    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };
  handleInput(keys: Set<string>, mouse: Vector2, mouseDown: boolean, mouseRightDown: boolean = false) { 
    this.keys = keys; this.mouse = mouse; this.mouseDown = mouseDown; this.mouseRightDown = mouseRightDown;

    if (this.playerState !== PlayerState.ACTIVE) {
        this.mouseDown = false;
        this.mouseRightDown = false;
        this.keysPressed.clear();
        keys.forEach(k => this.keysPressed.add(k.toLowerCase()));
        return;
    }
    
    if ((keys.has('x') || keys.has('X')) && !this.keysPressed.has('x')) {
        if (this.player.classType === TankClass.WARLORD) {
            this.player.isSiegeMode = !this.player.isSiegeMode;
            this.player.updateStats();
            this.addNotification(`SIEGE MODE: ${this.player.isSiegeMode ? 'ACTIVE' : 'INACTIVE'}`, this.player.isSiegeMode ? "#ff4444" : "#ffffff");
        }
    }

    if ((keys.has('t') || keys.has('T')) && !this.keysPressed.has('t')) {
        this.handleTransformation();
    }

    if (keys.has(' ') && !this.keysPressed.has(' ')) {
        this.triggerAbility();
    }
    
    // Update keysPressed
    this.keysPressed.clear();
    keys.forEach(k => this.keysPressed.add(k.toLowerCase()));

    if (keys.has('Escape') && this.primedSpawn) {
        this.primedSpawn = null;
        this.addNotification("SPAWN CANCELLED", "#ff4444");
    }
  }

  private triggerAbility() {
    const player = this.player;
    if (player.isDead) return;
    const noCooldown = this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown;

    if (this.isPacifist(player.classType)) {
        if (player.healingBurstCooldown <= 0 || noCooldown) {
            const cfg = CLASS_ABILITY_CONFIG.restoration;
            const burstRadius = Math.max(cfg.baseBurstMinRadius, player.healingAuraRadius * cfg.burstRadiusMultiplier);
            const healAmount = player.maxHealth * cfg.instantHealRatio;
            const sacrifice = Math.max(1, player.health * cfg.healthSacrificeRatio);
             
            const targets = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && e.team === player.team && Vector.dist(player.pos, e.pos) < burstRadius);
            player.takeDamage(sacrifice, player.id);
            targets.forEach(t => {
                const ally = t as Tank;
                t.health = Math.min(t.health + healAmount, t.maxHealth);
                if (ally instanceof Tank) {
                    ally.clearHostileDebuffs();
                    ally.regenOverchargeTimer = cfg.regenOverchargeSeconds;
                    ally.regenOverchargeRate = ally.maxHealth * cfg.regenOverchargeRatioPerSecond;
                    ally.markHealingStatus(cfg.regenOverchargeSeconds * 1000);
                }
            });
             
            this.particles.push(new Particle(player.pos.x, player.pos.y, '#4ade80', 30, 40, 'RING'));
            const cooldownReduction = (player.stats[StatType.HEALING_BURST] || 0) * 1; // 1s per point
            player.healingBurstCooldown = noCooldown ? 0 : Math.max(4, cfg.cooldownSeconds - cooldownReduction);
            player.statusAbilityUntil = Date.now() + cfg.regenOverchargeSeconds * 1000;
            this.addNotification("DIVINE OFFERING!", "#4ade80");
        } else {
            this.addNotification(`ABILITY COOLDOWN: ${Math.ceil(player.healingBurstCooldown)}s`, "#ff4444");
        }
    } else if (this.isDraining(player.classType)) {
        if (player.drainBurstCooldown <= 0 || noCooldown) {
            const cfg = CLASS_ABILITY_CONFIG.blood;
            const burstRadius = player.drainAuraRadius * 1.5;
            const damageAmount = player.maxHealth * 0.15;
            const sacrifice = Math.max(1, player.health * cfg.healthSacrificeRatio);
             
            const targets = this.entities.filter(e => e.id !== player.id && e.team !== player.team && (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.SHAPE || e.type === EntityType.BOSS) && Vector.dist(player.pos, e.pos) < burstRadius);
             
            let totalDamage = 0;
            player.takeDamage(sacrifice, player.id);
            targets.forEach(t => {
                const actualDamage = Math.min(t.health, damageAmount);
                t.takeDamage(actualDamage, player.id);
                totalDamage += actualDamage;
                if (t instanceof Tank) {
                    t.applyDrainDot(2, cfg.decayStackDuration);
                }
            });
             
            // Lifesteal from burst
            player.health = Math.min(player.health + totalDamage * 0.5, player.maxHealth);
            player.bloodPactActiveTimer = cfg.activeSeconds;
            player.statusAbilityUntil = Date.now() + cfg.activeSeconds * 1000;
             
            this.particles.push(new Particle(player.pos.x, player.pos.y, '#ef4444', 30, 40, 'RING'));
            const cooldownReduction = (player.stats[StatType.DRAIN_BURST] || 0) * 0.8; // 0.8s per point
            player.drainBurstCooldown = noCooldown ? 0 : Math.max(4, cfg.cooldownSeconds - cooldownReduction);
            this.addNotification("SANGUINE PACT!", "#ef4444");
        } else {
            this.addNotification(`ABILITY COOLDOWN: ${Math.ceil(player.drainBurstCooldown)}s`, "#ff4444");
        }
    }
  }

  private transitionToDimension(toVoid: boolean) {
      if (this.isTransitioning) return;
      this.isTransitioning = true;
      this.addNotification(toVoid ? "ENTERING THE VOID" : "EXITING THE VOID", COLORS.voidPortal);
      setTimeout(() => {
          this.inVoid = toVoid;
          this.voidTimer = toVoid ? 300 : 0;
          this.entities = this.entities.filter(e => e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.BULLET);
          this.currentShapeCount = 0;
          if (toVoid) {
              const exitPos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
              this.entities.push(new VoidPortal(this.nextId(), exitPos.x, exitPos.y, true));
          } else {
              if (this.gameMode === GameMode.TEAMS) this.spawnGuardians();
          }
          for (let i = 0; i < 150; i++) this.spawnShape();
          this.isTransitioning = false;
      }, 1000);
  }

  private updateAutoTurrets(dt: number) {
      this.entities.forEach(e => {
          if (e instanceof Tank && e.classType === TankClass.AUTO_GUNNER && !e.isDead) {
              const tank = e as Tank;
              
              // Only block if it's a bot and bots are disabled in sandbox
              if (this.gameMode === GameMode.SANDBOX && tank.type !== EntityType.PLAYER && !this.sandboxConfig.botsEnabled) {
                  return;
              }

              const range = 650;
              
              const neighbors = this.spatialGrid.getNeighbors(tank);
              const potentialTargets = neighbors.filter(target => {
                  if (target.id === tank.id || target.isDead) return false;
                  if (Vector.dist(tank.pos, target.pos) > range) return false;
                  
                  if (target.type === EntityType.BULLET) {
                      return target.team !== tank.team;
                  }
                  if (target.type === EntityType.PLAYER || target.type === EntityType.ENEMY || target.type === EntityType.ELITE_TANK) {
                      return this.gameMode === GameMode.FFA || target.team !== tank.team;
                  }
                  return target.type === EntityType.SHAPE || target.type === EntityType.BOSS;
              });

              const prioritizedTarget = potentialTargets.sort((a, b) => {
                  const getScore = (ent: Entity) => {
                      if (ent.type === EntityType.BULLET) {
                          const toTank = Vector.normalize(Vector.sub(tank.pos, ent.pos));
                          const bulletDir = Vector.normalize(ent.vel || { x: 0, y: 0 });
                          return Vector.dot(bulletDir, toTank) > 0.72 ? -1 : 3;
                      }
                      if (ent.type === EntityType.PLAYER || ent.type === EntityType.ENEMY || ent.type === EntityType.ELITE_TANK) {
                          const hpRatio = ent.maxHealth > 0 ? ent.health / ent.maxHealth : 1;
                          return hpRatio < 0.4 ? 0 : 1;
                      }
                      if (ent.type === EntityType.BOSS) return 2;
                      return 3;
                  };
                  const scoreDiff = getScore(a) - getScore(b);
                  if (scoreDiff !== 0) return scoreDiff;
                  return Vector.dist(tank.pos, a.pos) - Vector.dist(tank.pos, b.pos);
              })[0];

              if (prioritizedTarget) {
                  tank.autoTurretTargetId = prioritizedTarget.id;
                  const bSpeed = (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * 1.65;
                  const aimPoint = this.getInterceptPoint(tank.pos, bSpeed, prioritizedTarget.pos, prioritizedTarget.vel || {x:0, y:0});
                  const targetRot = Math.atan2(aimPoint.y - tank.pos.y, aimPoint.x - tank.pos.x);
                  
                  let diff = targetRot - tank.autoTurretRotation;
                  while (diff > Math.PI) diff -= Math.PI * 2;
                  while (diff < -Math.PI) diff += Math.PI * 2;
                  tank.autoTurretRotation += diff * 0.15;

                  if (tank.autoTurretCooldown <= 0 && Math.abs(diff) < 0.4) {
                      const baseReloadTimeMs = (BASE_STATS.reload - (tank.stats[StatType.RELOAD] * 2.5)) * 16;
                      const cooldownVal = Math.max(72, baseReloadTimeMs * 0.74);
                      tank.autoTurretCooldown = cooldownVal;

                      const forward = Vector.fromAngle(tank.autoTurretRotation);
                      const tip = Vector.add(tank.pos, Vector.mult(forward, tank.radius * 0.9));
                      
                      const bulletSpeedMult = 1.65;
                      const bulletDamageMult = 0.74;
                      const bulletSizeMult = 0.65;

                      this.entities.push(new Bullet(
                          this.nextId(), 
                          tip.x, 
                          tip.y, 
                          Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * bulletSpeedMult), 
                          tank, 
                          bulletDamageMult, 
                          1.0, 
                          bulletSizeMult
                      ));

                      if (tank === this.player || this.isOnScreen(tank.pos)) {
                          this.particles.push(new Particle(tip.x, tip.y, 'rgba(170, 220, 255, 0.62)', 7, 7, 'FLASH'));
                          this.sound.playShoot(TankClass.GUNNER, this.getAudioSpatialOptions(tank.pos, false));
                      }
                  }
              } else {
                  tank.autoTurretTargetId = null;
                  tank.autoTurretRotation += dt * 0.5;
              }
          }
      });
  }

  isPacifist(classType: TankClass): boolean {
    return classType === TankClass.PACIFIST_TRAINEE || 
           classType === TankClass.NURSE || 
           classType === TankClass.DOCTOR || 
           classType === TankClass.PLAGUE_DOCTOR;
  }

  isDraining(classType: TankClass): boolean {
    return classType === TankClass.DRAINER_TRAINEE || 
           classType === TankClass.LEECH || 
           classType === TankClass.VAMPIRE || 
           classType === TankClass.REAPER;
  }

  isBossClass(classType: TankClass): boolean {
    return classType === TankClass.COLOSSAL ||
           classType === TankClass.LEVIATHAN ||
           classType === TankClass.WARLORD ||
           classType === TankClass.CELESTIAL;
  }

  private getEnemyZoneWarningLevelFor(entity: Entity): 0 | 1 | 2 {
    if (this.gameMode !== GameMode.TEAMS || entity.team === Team.NONE) return 0;
    const inEnemyWarningBand =
      (entity.team === Team.BLUE && entity.pos.x >= CANVAS_WIDTH - BASE_ZONE_WIDTH - SAFE_ZONE_WARNING_RADIUS) ||
      (entity.team === Team.RED && entity.pos.x <= BASE_ZONE_WIDTH + SAFE_ZONE_WARNING_RADIUS);
    if (!inEnemyWarningBand) return 0;
    const inEngagementBand =
      (entity.team === Team.BLUE && entity.pos.x >= CANVAS_WIDTH - BASE_ZONE_WIDTH - SAFE_ZONE_ENGAGEMENT_RADIUS) ||
      (entity.team === Team.RED && entity.pos.x <= BASE_ZONE_WIDTH + SAFE_ZONE_ENGAGEMENT_RADIUS);
    return inEngagementBand ? 2 : 1;
  }

  private applyEnemyBaseRetreatIfNeeded(tank: Tank, dt: number): boolean {
    if (this.gameMode !== GameMode.TEAMS) return false;
    const warningLevel = this.getEnemyZoneWarningLevelFor(tank);
    if (warningLevel === 0) return false;

    // Override aggressive AI and force retreat away from enemy base border.
    const retreatDirX = tank.team === Team.BLUE ? -1 : 1;
    tank.acc.x = retreatDirX * (warningLevel === 2 ? 7.8 : 6.2);
    tank.acc.y *= 0.6;
    tank.vel.x += retreatDirX * (warningLevel === 2 ? 460 : 320) * dt;
    tank.aiTargetId = null;
    tank.aiHuntingSpecialId = null;
    return true;
  }

  private updateEnemyZoneWarningState(dt: number) {
    if (this.gameMode !== GameMode.TEAMS || this.player.isDead) {
      this.enemyZoneWarningLevel = 0;
      this.enemyZoneWarningText = '';
      this.enemyZoneWarningHoldMs = 0;
      return;
    }

    const levelNow = this.getEnemyZoneWarningLevelFor(this.player);
    if (levelNow > 0) {
      this.enemyZoneWarningLevel = levelNow;
      this.enemyZoneWarningHoldMs = levelNow === 2 ? 900 : 650;
      this.enemyZoneWarningText = levelNow === 2
        ? 'WARNING: ENEMY DEFENSE ZONE ENGAGEMENT RANGE'
        : 'WARNING: ENTERING ENEMY DEFENSE ZONE';
      return;
    }

    this.enemyZoneWarningHoldMs = Math.max(0, this.enemyZoneWarningHoldMs - dt * 1000);
    if (this.enemyZoneWarningHoldMs <= 0) {
      this.enemyZoneWarningLevel = 0;
      this.enemyZoneWarningText = '';
    }
  }

  private updatePlayerSocialSignals(dt: number, aliveCombatTanks: Tank[]) {
    if (!this.player || this.player.isDead || this.gameMode !== GameMode.TEAMS) return;

    const nearbyThreat = aliveCombatTanks.some(
      t => t.id !== this.player.id && t.team !== this.player.team && Vector.dist(t.pos, this.player.pos) < 520
    );

    let dRot = this.player.rotation - this.playerSpinLastRot;
    while (dRot > Math.PI) dRot -= Math.PI * 2;
    while (dRot < -Math.PI) dRot += Math.PI * 2;
    this.playerSpinLastRot = this.player.rotation;

    if (nearbyThreat) {
      this.playerSpinWindowMs = 0;
      this.playerSpinAccumRad = 0;
      return;
    }

    const rotDelta = Math.abs(dRot);
    if (rotDelta > 0.04) {
      this.playerSpinWindowMs += dt * 1000;
      this.playerSpinAccumRad += rotDelta;
    } else {
      this.playerSpinWindowMs = Math.max(0, this.playerSpinWindowMs - dt * 800);
      this.playerSpinAccumRad = Math.max(0, this.playerSpinAccumRad - dt * 4);
    }

    if (this.playerSpinWindowMs > 600) {
      this.playerSpinWindowMs = 0;
      this.playerSpinAccumRad = 0;
      return;
    }

    if (this.playerSpinAccumRad >= Math.PI * 2) {
      this.player.socialSpinSignalUntil = Date.now() + 1000;
      this.playerSpinWindowMs = 0;
      this.playerSpinAccumRad = 0;
    }
  }

  update(dt: number) {
    this.simulationTick++;
    this.aiSystem.beginTick(this.simulationTick);
    const updateStart = performance.now();
    this.updateViewportCache();
    const bucketStart = performance.now();
    const aliveCombatTanks: Tank[] = [];
    const aliveEnemies: Tank[] = [];
    const alivePacifists: Tank[] = [];
    const aliveDrainers: Tank[] = [];
    const drainTargets: Entity[] = [];
    let aliveCrasherCount = 0;
    let currentBoss: Boss | null = null;

    for (const e of this.entities) {
      if (e.type === EntityType.BOSS && !e.isDead && !currentBoss) {
        currentBoss = e as Boss;
      }
      if (e.type === EntityType.CRASHER && !e.isDead) {
        aliveCrasherCount++;
      }
      if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) {
        const t = e as Tank;
        if (!t.isDead) {
          aliveCombatTanks.push(t);
          if (e.type === EntityType.ENEMY) aliveEnemies.push(t);
          if (this.isPacifist(t.classType)) alivePacifists.push(t);
          if (this.isDraining(t.classType)) aliveDrainers.push(t);
        }
      } else if (!e.isDead && (e.type === EntityType.SHAPE || e.type === EntityType.BOSS || e.type === EntityType.CRASHER || e.type === EntityType.GUARDIAN)) {
        drainTargets.push(e);
      }
    }

    for (const t of aliveCombatTanks) {
      drainTargets.push(t);
    }
    this.updatePlayerSocialSignals(dt, aliveCombatTanks);
    const bucketBuildMs = performance.now() - bucketStart;
    this.updateAdaptiveTickRates(dt, this.entities.length);

    this.aiUpdateAccumulator += dt;
    this.ambientUpdateAccumulator += dt;
    const aiInterval = 1 / this.aiTickHz;
    const ambientInterval = 1 / this.ambientTickHz;
    const runAiTick = this.aiUpdateAccumulator >= aiInterval;
    const runAmbientTick = this.ambientUpdateAccumulator >= ambientInterval;
    if (runAiTick) this.aiUpdateAccumulator = Math.max(0, this.aiUpdateAccumulator - aiInterval);
    if (runAmbientTick) this.ambientUpdateAccumulator = Math.max(0, this.ambientUpdateAccumulator - ambientInterval);

    if (!this.sandboxConfig.freezeAll) {
        // Pacifist Healing Logic
        const pacifists = alivePacifists;
        const tanksToHeal = aliveCombatTanks;

        tanksToHeal.forEach(target => {
            const healersInRange = pacifists.filter(p => p.team === target.team && p.id !== target.id && Vector.dist(p.pos, target.pos) < p.healingAuraRadius);
            if (healersInRange.length > 0) {
                // Sort by efficiency descending
                healersInRange.sort((a, b) => b.healingAuraEfficiency - a.healingAuraEfficiency);
                
                let totalHealRate = 0;
                healersInRange.forEach((healer, index) => {
                    let multiplier = 1.0;
                    if (index === 1) multiplier = 0.5;
                    else if (index === 2) multiplier = 0.25;
                    else if (index >= 3) multiplier = 0.1;
                    
                    const healAmount = healer.healingAuraEfficiency * multiplier * dt * 60;
                    totalHealRate += healAmount;
                    
                    // Track healing for XP and AI threat
                    healer.totalHealedThisSession += healAmount;
                    healer.healingHistory.push({ time: Date.now(), amount: healAmount });
                    
                    // XP Reward for healing (1 XP per 10 HP healed)
                    if (!healer.isBot) {
                        const xpGain = healAmount * 0.1 * (healer.stats[StatType.SUPPORT_XP_MULT] ? (1 + healer.stats[StatType.SUPPORT_XP_MULT] * 0.15) : 1);
                        this.awardXP(healer, xpGain);
                    }
                });
                
                // Cleanup healing history (keep last 5 seconds)
                pacifists.forEach(p => {
                    const now = Date.now();
                    p.healingHistory = p.healingHistory.filter(h => now - h.time < 5000);
                });

                target.health = Math.min(target.health + totalHealRate, target.maxHealth);
                target.markHealingStatus();
                 
                // Visual feedback for being healed
                if (runAmbientTick && Math.random() < 0.1) {
                    this.particles.push(new Particle(
                        target.pos.x + (Math.random() - 0.5) * target.radius * 2,
                        target.pos.y + (Math.random() - 0.5) * target.radius * 2,
                        '#4ade80', 3, 20, 'AURA'
                    ));
                }
            }
        });

        // Draining Logic
        const drainers = aliveDrainers;
        const entitiesToDrain = drainTargets;

        drainers.forEach(drainer => {
            const targetsInRange = entitiesToDrain.filter(target => target.id !== drainer.id && target.team !== drainer.team && Vector.dist(drainer.pos, target.pos) < drainer.drainAuraRadius);
             
            let totalDamageDealt = 0;
            targetsInRange.forEach(target => {
                const lifestealMult = drainer.bloodPactActiveTimer > 0 ? CLASS_ABILITY_CONFIG.blood.lifestealAuraMultiplier : 1;
                const damage = drainer.drainAuraDamage * lifestealMult * dt;
                const actualDamage = Math.min(target.health, damage);
                target.takeDamage(actualDamage, drainer.id);
                totalDamageDealt += actualDamage;
                if (target instanceof Tank) {
                    target.markDrainingStatus();
                    if (drainer.bloodPactActiveTimer > 0) {
                        target.applyDrainDot(1, CLASS_ABILITY_CONFIG.blood.decayStackDuration);
                    }
                }
                 
                // Visual feedback: Red particles from target to drainer
                if (runAmbientTick && Math.random() < 0.1) {
                    const p = new Particle(target.pos.x, target.pos.y, '#ef4444', 3, 20, 'AURA');
                    const dir = Vector.normalize(Vector.sub(drainer.pos, target.pos));
                    p.vel = Vector.mult(dir, 5);
                    this.particles.push(p);
                }
            });
            
            if (totalDamageDealt > 0) {
                const lifestealMult = drainer.bloodPactActiveTimer > 0 ? CLASS_ABILITY_CONFIG.blood.lifestealAuraMultiplier : 1;
                const healAmount = totalDamageDealt * drainer.drainLifestealEfficiency * lifestealMult;
                drainer.health = Math.min(drainer.health + healAmount, drainer.maxHealth);
                drainer.totalDrainedThisSession += totalDamageDealt;
                drainer.markDrainingStatus();
                 
                // XP Reward for draining (Higher reward for blood sector)
                if (!drainer.isBot) {
                    this.awardXP(drainer, totalDamageDealt * 0.25);
                }
            }
        });

        // Decay Buffs/Multipliers
        this.entities.forEach(e => {
            if (e instanceof Tank && e.xpMultiplierTimer > 0) {
                e.xpMultiplierTimer -= dt * 1000;
                if (e.xpMultiplierTimer <= 0) {
                    e.xpMultiplier = 1.0;
                    e.xpMultiplierTimer = 0;
                }
            }
        });

        // Additional Passive XP for Pacifists/Drainers near targets
        pacifists.forEach(p => {
          if (p.isBot) return;
          const alliesInRange = tanksToHeal.filter(t => t.team === p.team && t.id !== p.id && Vector.dist(p.pos, t.pos) < p.healingAuraRadius);
          if (alliesInRange.length > 0) {
              // Grant passive XP based on level and number of allies
              const passiveXp = (1.5 + p.level * 0.05) * alliesInRange.length * dt;
              this.awardXP(p, passiveXp);
          }
        });
    }

    if (this.playerState === PlayerState.EVOLVING) {
        this.evolutionTransitionTimer = Math.max(0, this.evolutionTransitionTimer - dt);
        this.player.vel = { x: 0, y: 0 };
        if (this.evolutionTransitionTimer <= 0) {
            this.playerState = PlayerState.BOSS_SELECTION;
            this.addNotification("SELECT YOUR LEGENDARY CHASSIS", "#fbbf24");
        }
    } else if (this.playerState === PlayerState.BOSS_SELECTION) {
        this.player.vel = { x: 0, y: 0 };
    }

    if (this.isTransitioning) {
        this.transitionAlpha = Math.min(1, this.transitionAlpha + dt * 2);
    } else {
        this.transitionAlpha = Math.max(0, this.transitionAlpha - dt * 2);
    }

    if (this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown) {
        this.player.sacrificeCooldownTimer = 0;
    }

    if (!this.inVoid) {
        this.portalSpawnTimer += dt;
        if (this.portalSpawnTimer > 300 && this.gameMode !== GameMode.SANDBOX) {
            const pos = Vector.randomRange(2000, CANVAS_WIDTH - 2000);
            const pos2 = Vector.randomRange(2000, CANVAS_HEIGHT - 2000);
            this.entities.push(new VoidPortal(this.nextId(), pos, pos2));
            this.addNotification("⚠️ VOID RIFT DETECTED ⚠️", COLORS.voidPortal);
            this.portalSpawnTimer = 0;
        }

        this.eliteSpawnTimer += dt;
        if (this.eliteSpawnTimer > 600 && this.gameMode !== GameMode.SANDBOX) { 
            this.spawnElite();
            this.eliteSpawnTimer = 0;
        }
    } else {
        this.voidTimer -= dt;
        if (this.voidTimer <= 0) {
            this.transitionToDimension(false);
        }
    }

    if (this.transformationReadyTimer > 0) {
        this.transformationReadyTimer -= dt;
    }

    this.bossSpawnTimer += dt;
    if (this.bossSpawnTimer > 120 && !this.inVoid && this.gameMode !== GameMode.SANDBOX) { this.spawnBoss(); this.bossSpawnTimer = 0; }

    this.crasherSpawnTimer += dt;
    if (this.crasherSpawnTimer > 5 && !this.inVoid && this.gameMode !== GameMode.SANDBOX) {
        const nestRadius = 1500;
        const count = 3 + Math.floor(Math.random() * 3);
        const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
        if (aliveCrasherCount < 40) {
            for(let i=0; i<count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * nestRadius;
                this.entities.push(new Crasher(this.nextId(), center.x + Math.cos(angle) * dist, center.y + Math.sin(angle) * dist));
            }
        }
        this.crasherSpawnTimer = 0;
    }

    if (currentBoss && !this.sandboxConfig.freezeAll) {
        this.bossDefenseTimer += dt;
        if (this.bossDefenseTimer > 4) {
            const playersNearby = aliveCombatTanks.filter(e => Vector.dist(e.pos, currentBoss.pos) < 1200);
            if (playersNearby.length > 0) {
                const angle = Math.random() * Math.PI * 2;
                const spawnPos = Vector.add(currentBoss.pos, Vector.mult(Vector.fromAngle(angle), currentBoss.radius + 50));
                this.entities.push(new Crasher(this.nextId(), spawnPos.x, spawnPos.y, true));
            }
            this.bossDefenseTimer = 0;
        }
    }

    if (!this.attractMode) {
        const distToCenter = Vector.dist(this.player.pos, {x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2});
        if (distToCenter < 1450 && !this.inNest && !this.inVoid) {
            this.inNest = true;
            this.addNotification("ENTERING THE PENTAGON NEST", "#768dfc");
        } else if (distToCenter >= 1550 && this.inNest) {
            this.inNest = false;
        }
    }

    if (this.attractMode) {
        if (!this.spectateTarget || this.spectateTarget.isDead || Math.random() < 0.005) {
            const bots = aliveEnemies;
            this.spectateTarget = bots.length > 0 ? bots[Math.floor(Math.random() * bots.length)] : null;
        }
        let targetPos = this.spectateTarget ? this.spectateTarget.pos : {x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2};
        const attractFollow = 1 - Math.exp(-dt * 3.6);
        this.cameraPos.x += (targetPos.x - this.cameraPos.x) * attractFollow;
        this.cameraPos.y += (targetPos.y - this.cameraPos.y) * attractFollow;
        this.cameraZoom = 0.6;
        this.player.pos = { x: -1000, y: -1000 };
    } else {
        // Velocity-independent centered follow.
        const follow = 1 - Math.exp(-dt * 10.5);
        this.cameraPos.x += (this.player.pos.x - this.cameraPos.x) * follow;
        this.cameraPos.y += (this.player.pos.y - this.cameraPos.y) * follow;
        this.cameraZoom = this.player.fov;
    }

    if (!this.attractMode && this.player.isDead && !this.gameOverSignaled) { 
        this.gameOverSignaled = true; 
        this.sound.playDeath();
        this.onGameOver({
            score: this.player.score,
            level: this.level,
            classType: this.player.classType,
            kills: this.kills,
            eliteKills: this.eliteKills,
            transformations: this.transformations,
            eliteSkinsKilled: Array.from(this.eliteSkinsKilled)
        }); 
    }

    this.refreshSpawnHeatmap(dt);
    this.shapeSpawnTimer += dt;
    const activePlayers = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && !e.isDead).length;
    const modeBaseInterval = this.gameMode === GameMode.TEAMS ? 0.12 : 0.16;
    const populationScale = Math.max(0.75, Math.min(1.45, 1.2 - activePlayers * 0.01));
    const spawnInterval = modeBaseInterval * populationScale;
    if (this.currentShapeCount < (this.sandboxConfig?.shapeMaxCount || 400) && this.shapeSpawnTimer >= spawnInterval) {
        if (this.gameMode !== GameMode.SANDBOX || (this.sandboxConfig?.spawningEnabled)) {
            const fillPercent = this.currentShapeCount / (this.sandboxConfig?.shapeMaxCount || 400);
            const modeBaseProb = this.gameMode === GameMode.TEAMS ? 0.5 : 0.38;
            const spawnProb = Math.max(0.05, modeBaseProb * (1 - fillPercent));
            if (Math.random() < spawnProb) {
                this.spawnShape();
                this.shapeSpawnTimer = 0;
            }
        }
    }
    
    let enemyLimit = this.gameMode === GameMode.TEAMS ? 60 : 18;
    if (this.attractMode) enemyLimit += 10;
    if (this.gameMode === GameMode.SANDBOX) enemyLimit = 0; 

    if (this.gameMode !== GameMode.SANDBOX && aliveEnemies.length < enemyLimit) { 
        const spawnProb = this.gameMode === GameMode.TEAMS ? 0.08 : 0.025; 
        if(Math.random() < spawnProb) this.spawnEnemy(); 
    }

    if (!this.attractMode && !this.player.isDead && this.playerState === PlayerState.ACTIVE) this.updatePlayerControl(dt);

    if (!this.sandboxConfig.freezeAll) {
        const canUpdateAI = this.gameMode !== GameMode.SANDBOX || this.sandboxConfig.botsEnabled;
        let aiEntitiesProcessed = 0;

        this.entities.forEach(e => {
            if (canUpdateAI) {
                const isAiEntity = e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK || e.type === EntityType.GUARDIAN || e.type === EntityType.CRASHER;
                const onScreenPriority = this.isOnScreen(e.pos, e.radius + 250);
                const shouldRunAi = isAiEntity && (runAiTick || onScreenPriority);
                if (shouldRunAi) {
                    if (e.type === EntityType.ENEMY && !e.isDead) {
                        const bot = e as Tank;
                        const retreating = this.applyEnemyBaseRetreatIfNeeded(bot, dt);
                        if (!retreating) this.updateBotAI(bot, dt);
                    }
                    else if (e.type === EntityType.ELITE_TANK && !e.isDead) this.updateEliteAI(e as EliteTank, dt);
                    else if (e.type === EntityType.GUARDIAN) this.updateGuardianAI(e as Guardian, dt);
                    else if (e.type === EntityType.CRASHER) this.updateCrasherAI(e as Crasher, dt);
                    aiEntitiesProcessed++;
                }
            }
            
            if (e.type === EntityType.SHAPE && (e as Shape).rarity !== ShapeRarity.COMMON) {
                if (runAmbientTick && Math.random() < 0.005) {
                    const rarityColor = (this.inVoid ? VOID_RARITY_CONFIG : RARITY_CONFIG)[(e as Shape).rarity].color || e.color;
                    this.addParticle(new Particle(e.pos.x + Vector.randomRange(-e.radius, e.radius), e.pos.y + Vector.randomRange(-e.radius, e.radius), rarityColor, 2, 40));
                }
            }
            
            if (e.type === EntityType.BOSS) {
                if (runAmbientTick && Math.random() < 0.1) {
                    this.addParticle(new Particle(e.pos.x + Vector.randomRange(-e.radius, e.radius), e.pos.y + Vector.randomRange(-e.radius, e.radius), '#00ffff', 4, 80));
                }
            }
        });

        this.perfAiEntitiesProcessedTotal += aiEntitiesProcessed;
        
        this.updateAutoTurrets(dt);
        this.updateBaseDefenseSystem(dt);
    }

    if (this.gameMode === GameMode.TEAMS && !this.inVoid) {
        this.entities.forEach(e => {
            if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) {
                if (e.team === Team.RED && e.pos.x < BASE_ZONE_WIDTH) e.vel.x += 1500 * dt;
                if (e.team === Team.BLUE && e.pos.x > CANVAS_WIDTH - BASE_ZONE_WIDTH) e.vel.x -= 1500 * dt;
            }
            if (e.type === EntityType.BULLET || e.type === EntityType.DRONE || e.type === EntityType.MINI_TANK) {
                if (e.team === Team.RED && e.pos.x < BASE_ZONE_WIDTH) {
                    e.isDead = true;
                    this.particles.push(new Particle(e.pos.x, e.pos.y, 'rgba(66,200,255,0.42)', 9, 12, 'RING'));
                    this.particles.push(new Particle(e.pos.x, e.pos.y, 'rgba(160,230,255,0.45)', 4, 10, 'FLASH'));
                }
                if (e.team === Team.BLUE && e.pos.x > CANVAS_WIDTH - BASE_ZONE_WIDTH) {
                    e.isDead = true;
                    this.particles.push(new Particle(e.pos.x, e.pos.y, 'rgba(255,95,126,0.42)', 9, 12, 'RING'));
                    this.particles.push(new Particle(e.pos.x, e.pos.y, 'rgba(255,170,188,0.45)', 4, 10, 'FLASH'));
                }
            }
        });
    }

    this.entities.forEach(e => {
        if (this.sandboxConfig.freezeAll && e.type !== EntityType.PLAYER) return;
        e.update(dt);
    });

    this.handleCollisions();
    
    this.particles.forEach(p => p.update());
    let particleWrite = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        this.particles[particleWrite++] = p;
      }
    }
    this.particles.length = particleWrite;
    const maxParticles = this.inVoid ? 2200 : 3200;
    if (this.particles.length > maxParticles) {
      this.particles = this.particles.slice(this.particles.length - maxParticles);
    }
    this.floatingTexts.forEach(ft => ft.update());
    let textWrite = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      if (ft.life > 0) {
        this.floatingTexts[textWrite++] = ft;
      }
    }
    this.floatingTexts.length = textWrite;
    this.uiNotifications.forEach(n => n.life -= dt);
    let noteWrite = 0;
    for (let i = 0; i < this.uiNotifications.length; i++) {
      const n = this.uiNotifications[i];
      if (n.life > 0) {
        this.uiNotifications[noteWrite++] = n;
      }
    }
    this.uiNotifications.length = noteWrite;
    
    let removedShapes = 0;
    this.entities = this.entities.filter(e => {
        const removed = e.shouldRemove || (e.isDead && e.type !== EntityType.SHAPE);
        if (removed && e.type === EntityType.SHAPE) {
            removedShapes++;
            this.sound.playShapeDeath((e as Shape).rarity);
        }
        return !removed;
    });
    this.currentShapeCount -= removedShapes;

    const leaderboard: LeaderboardEntry[] = (this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && !e.isDead) as Tank[])
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(e => ({
            id: e.id,
            name: e.name || 'Unknown',
            score: e.score,
            classType: e.classType,
            currentClass: e.classType,
            isPlayer: e.id === this.player.id,
            team: e.team,
            teamId: e.team,
        }));
    
    const minimapMarkers: MinimapMarker[] = [];
    this.entities.forEach(e => {
        const isPriority = e.type === EntityType.BOSS || e.type === EntityType.ELITE_TANK || e.type === EntityType.VOID_PORTAL || e.type === EntityType.DUMMY || (e.type === EntityType.SHAPE && getRarityRank((e as Shape).rarity) >= getRarityRank(ShapeRarity.LEGENDARY));
        const isAlly = (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && (this.gameMode === GameMode.FFA ? e.id === this.player.id : e.team === this.player.team);
        
        if (isPriority || isAlly) {
            minimapMarkers.push({
                type: e.type,
                pos: { x: e.pos.x, y: e.pos.y },
                team: e.team,
                rotation: e.rotation,
                isPlayer: e.id === this.player.id
            });
        }
    });

    this.updateEnemyZoneWarningState(dt);

    let abilityHud: any = null;
    const rightClickAbilityClasses = [TankClass.OVERLORD, TankClass.OVERSEER, TankClass.MANAGER];
    if (rightClickAbilityClasses.includes(this.player.classType)) {
        const noCooldown = this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown;
        abilityHud = {
            id: 'sacrificial_goat',
            name: 'Sacrificial Goat',
            trigger: 'RMB',
            description: 'Overcharge your command swarm for a short power window.',
            benefit: 'Major temporary boost to summon combat output.',
            tradeoff: 'Consumes 50% current health and has a recovery cooldown.',
            cooldownRemaining: noCooldown ? 0 : Math.max(0, this.player.sacrificeCooldownTimer),
            cooldownTotal: noCooldown ? 0 : 30,
            active: this.player.isSacrificing,
            activeRemaining: Math.max(0, this.player.sacrificeActiveTimer),
            activeTotal: 15,
        };
    } else if (this.isPacifist(this.player.classType)) {
        const noCooldown = this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown;
        abilityHud = {
            id: 'divine_offering',
            name: 'Divine Offering',
            trigger: 'SPACE',
            description: 'Sacrifice hull integrity to emit a massive restorative shockwave.',
            benefit: 'Purges hostile decay and grants fast-fading regeneration overcharge to allies.',
            tradeoff: 'Consumes 25% current health on cast.',
            cooldownRemaining: noCooldown ? 0 : Math.max(0, this.player.healingBurstCooldown),
            cooldownTotal: noCooldown ? 0 : CLASS_ABILITY_CONFIG.restoration.cooldownSeconds,
            active: this.player.regenOverchargeTimer > 0,
            activeRemaining: Math.max(0, this.player.regenOverchargeTimer),
            activeTotal: CLASS_ABILITY_CONFIG.restoration.regenOverchargeSeconds,
        };
    } else if (this.isDraining(this.player.classType)) {
        const noCooldown = this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown;
        abilityHud = {
            id: 'sanguine_pact',
            name: 'Sanguine Pact',
            trigger: 'SPACE',
            description: 'Burn your own health to enter a martyr phase that weaponizes incoming aggression.',
            benefit: 'Doubles aura lifesteal and inflicts stackable decay on marked enemies.',
            tradeoff: 'Consumes 22% current health and invites retaliation.',
            cooldownRemaining: noCooldown ? 0 : Math.max(0, this.player.drainBurstCooldown),
            cooldownTotal: noCooldown ? 0 : CLASS_ABILITY_CONFIG.blood.cooldownSeconds,
            active: this.player.bloodPactActiveTimer > 0,
            activeRemaining: Math.max(0, this.player.bloodPactActiveTimer),
            activeTotal: CLASS_ABILITY_CONFIG.blood.activeSeconds,
        };
    }

    this.statePublishAccumulator += dt;
    const shouldPublishState = this.statePublishAccumulator >= this.statePublishIntervalSec;
    if (shouldPublishState) {
      this.statePublishAccumulator = 0;
      this.onStateUpdate({
        score: this.player.score, 
        level: this.level, 
        xp: this.xp, 
        maxXp: this.getLevelXp(this.level), 
        stats: { ...this.player.stats }, 
        statRevision: this.statRevision,
        availableStatPoints: this.player.availableStatPoints, 
        currentClass: this.player.classType, 
        isDead: this.player.isDead, 
        fps: Math.round(1/dt), 
        killFeed: this.killFeed, 
        leaderboard: leaderboard, 
        notifications: this.uiNotifications, 
        health: this.player.displayHealth, 
        maxHealth: this.player.maxHealth, 
        shield: this.player.shield, 
        maxShield: this.player.maxShield, 
        playerPos: this.player.pos, 
        playerRotation: this.player.rotation, 
        camera: { x: this.cameraPos.x, y: this.cameraPos.y, zoom: this.cameraZoom }, 
        mapSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }, 
        gameMode: this.gameMode, 
        autoFire: this.player.autoFire, 
        autoSpin: this.player.autoSpin, 
        minimapMarkers,
        inVoid: this.inVoid, 
        voidTimeRemaining: this.voidTimer,
        isTransformed: this.player.isTransformed,
        transformationTime: this.player.transformationTimer,
        transformationReady: this.transformationReadyTimer > 0,
        activeBuffs: this.player.activeBuffs,
        sandboxConfig: this.sandboxConfig,
        primedSpawn: this.primedSpawn,
        abilityHud,
        playerState: this.playerState,
        evolutionTransitionRemaining: this.playerState === PlayerState.EVOLVING ? this.evolutionTransitionTimer : 0,
        bossChoices: this.playerState === PlayerState.BOSS_SELECTION ? [...this.bossChoices] : [],
        enemyZoneWarningLevel: this.enemyZoneWarningLevel,
        enemyZoneWarningText: this.enemyZoneWarningText
      });
    }

    const updateMs = performance.now() - updateStart;
    this.perfSampleAccumulator += dt;
    this.perfSampleFrames++;
    this.perfBucketMsTotal += bucketBuildMs;
    this.perfUpdateMsTotal += updateMs;
    if (this.perfSampleAccumulator >= 1.0) {
        const frameCount = Math.max(1, this.perfSampleFrames);
        const snapshot = {
            avgBucketMs: this.perfBucketMsTotal / frameCount,
            avgUpdateMs: this.perfUpdateMsTotal / frameCount,
            avgAiEntitiesProcessed: this.perfAiEntitiesProcessedTotal / frameCount,
            entityCount: this.entities.length,
            particleCount: this.particles.length
        };
        this.perfLastSnapshot = snapshot;
        if (this.telemetryEnabled) {
          (window as any).__vextorPerf = {
            ...snapshot,
            aiTickHz: this.aiTickHz,
            ambientTickHz: this.ambientTickHz,
            adaptiveLoadEMA: this.adaptiveLoadEMA
          };
        }
        this.perfSampleAccumulator = 0;
        this.perfSampleFrames = 0;
        this.perfBucketMsTotal = 0;
        this.perfUpdateMsTotal = 0;
        this.perfAiEntitiesProcessedTotal = 0;
    }
  }

  updatePlayerControl(dt: number) {
    const dir = { x: 0, y: 0 };
    if (this.keys.has('w') || this.keys.has('W') || this.keys.has('ArrowUp')) dir.y -= 1;
    if (this.keys.has('s') || this.keys.has('S') || this.keys.has('ArrowDown')) dir.y += 1;
    if (this.keys.has('a') || this.keys.has('A') || this.keys.has('ArrowLeft')) dir.x -= 1;
    if (this.keys.has('d') || this.keys.has('D') || this.keys.has('ArrowRight')) dir.x += 1;

    this.applyTankMovement(this.player, dir);

    if (!this.player.autoSpin) {
      const screenX = (this.player.pos.x - this.cameraPos.x) * this.cameraZoom + window.innerWidth / 2;
      const screenY = (this.player.pos.y - this.cameraPos.y) * this.cameraZoom + window.innerHeight / 2;
      this.player.rotation = Math.atan2(this.mouse.y - screenY, this.mouse.x - screenX);
    } else {
      this.player.rotation += dt * 3;
    }

    if (this.mouseDown || this.player.autoFire) {
      this.attemptShoot(this.player);
    }
    
    // SACRIFICIAL GOAT ABILITY TRIGGER (ONE-TIME RIGHT CLICK)
    const goatClasses = [TankClass.OVERLORD, TankClass.OVERSEER, TankClass.MANAGER];
    if (goatClasses.includes(this.player.classType)) {
        if (this.mouseRightDown) {
            const noCooldown = this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown;
            const canTriggerRepeatedly = noCooldown; // In sandbox with no cooldown, we allow repeating while holding

            if (!this.player.abilityTriggered || canTriggerRepeatedly) {
                this.player.abilityTriggered = true;
                
                // Only trigger if off cooldown and (not already active OR no cooldown mode is on)
                if (this.player.sacrificeCooldownTimer <= 0 && (!this.player.isSacrificing || noCooldown)) {
                    const sacrificeCost = this.player.health * 0.5;
                    this.player.takeDamage(sacrificeCost, this.player.id);
                    
                    this.player.isSacrificing = true;
                    this.player.sacrificeActiveTimer = 15; // 15 seconds duration
                    this.player.sacrificeCooldownTimer = noCooldown ? 0 : 30; 
                    
                    if (this.isOnScreen(this.player.pos)) {
                        this.sound.playRoar();
                    }
                    this.addNotification("SACRIFICIAL GOAT ACTIVATED", "#ff4444");
                    
                    // Roar Visual Effect
                    this.particles.push(new Particle(this.player.pos.x, this.player.pos.y, 'rgba(30, 0, 0, 0.5)', this.player.radius, 30, 'RING'));
                    for(let i=0; i<15; i++) {
                        this.particles.push(new Particle(this.player.pos.x, this.player.pos.y, '#1a1a1a', 6, 25, 'AURA'));
                    }
                } else if (this.player.sacrificeCooldownTimer > 0) {
                    if (!this.player.isBot) this.addNotification(`ABILITY ON COOLDOWN: ${Math.ceil(this.player.sacrificeCooldownTimer)}s`, "#ffbb00");
                }
            }
        } else {
            this.player.abilityTriggered = false;
        }
    } else {
        this.player.isSacrificing = false;
        this.player.abilityTriggered = false;
        this.player.sacrificeActiveTimer = 0;
    }
  }

  updateGuardianAI(guardian: Guardian, dt: number) {
    const vision = 1200;
    const targets = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && e.team !== guardian.team && Vector.dist(e.pos, guardian.pos) < vision);
    const nearest = this.findNearest(guardian, targets);

    if (nearest) {
      const dir = Vector.normalize(Vector.sub(nearest.pos, guardian.pos));
      // Guardians now use a slightly smarter approach - they try to intercept and stay between target and home
      const distToHome = Vector.dist(guardian.pos, guardian.homePos);
      let force = 0.6;
      if (distToHome > 800) force = -0.5; // Tether back if too far
      
      guardian.acc = Vector.mult(dir, force);
      guardian.rotation = Math.atan2(dir.y, dir.x);
    } else {
      const orbitDist = 300 + Math.sin(Date.now() / 2000) * 100; // Pulsing orbit
      guardian.orbitAngle += dt * 0.4;
      const targetPos = {
          x: guardian.homePos.x + Math.cos(guardian.orbitAngle) * orbitDist,
          y: guardian.homePos.y + Math.sin(guardian.orbitAngle) * orbitDist
      };
      const toTarget = Vector.sub(targetPos, guardian.pos);
      guardian.acc = Vector.mult(Vector.normalize(toTarget), 0.8);
      guardian.rotation += dt * 3; // Rapid spin when defensive
    }
  }

  updateCrasherAI(crasher: Crasher, dt: number) {
    const vision = 700;
    // Crashers are now much slower and more "swarmy"
    if (!crasher.target || crasher.target.isDead || Vector.dist(crasher.pos, crasher.target.pos) > vision + 200) {
        const potential = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && Vector.dist(e.pos, crasher.pos) < vision);
        crasher.target = this.findNearest(crasher, potential);
    }

    if (crasher.target) {
        const dir = Vector.normalize(Vector.sub(crasher.target.pos, crasher.pos));
        // EXTREME NERF: Crasher acceleration reduced to 0.25 (was 1.5, initially 0.4)
        crasher.acc = Vector.mult(dir, 0.25);
        crasher.rotation = Math.atan2(dir.y, dir.x);
    } else {
        const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
        const toCenter = Vector.sub(center, crasher.pos);
        if (Vector.mag(toCenter) > 2000) {
            crasher.acc = Vector.mult(Vector.normalize(toCenter), 0.3);
        } else if (Math.random() < 0.01) {
            crasher.vel = Vector.add(crasher.vel, Vector.mult(Vector.fromAngle(Math.random() * Math.PI * 2), 0.3));
        }
    }
  }

  updateEliteAI(elite: EliteTank, dt: number) {
      const targets = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && Vector.dist(e.pos, elite.pos) < elite.visionRange);
      const nearest = this.findNearest(elite, targets) as Tank | null;

      const steering = { x: 0, y: 0 };
      if (nearest) {
          const dirToNearest = Vector.sub(nearest.pos, elite.pos);
          const distToNearest = Vector.mag(dirToNearest);
          
          // Use existing bullet avoidance logic
          const incomingBullets = this.entities.filter(e => e.type === EntityType.BULLET && (e as Bullet).ownerId !== elite.id && Vector.dist(e.pos, elite.pos) < 500);
          incomingBullets.forEach(b => {
              const toBot = Vector.sub(elite.pos, b.pos);
              const bulletVelNorm = Vector.normalize(b.vel);
              const toBotNorm = Vector.normalize(toBot);
              
              if (Vector.dot(bulletVelNorm, toBotNorm) > 0.7) {
                  const sideForce = { x: -b.vel.y, y: b.vel.x };
                  const dotProduct = Vector.dot(sideForce, toBot);
                  const avoidDir = Vector.mult(Vector.normalize(sideForce), dotProduct > 0 ? 6.0 : -6.0);
                  steering.x += avoidDir.x; steering.y += avoidDir.y;
              }
          });

          // Tactical decision making: Predictive Aim
          const bSpeed = (BASE_STATS.bulletSpeed + elite.stats[StatType.BULLET_SPEED] * 0.8) * 1.5;
          const interceptPoint = this.getInterceptPoint(elite.pos, bSpeed, nearest.pos, nearest.vel);
          elite.rotation = Math.atan2(interceptPoint.y - elite.pos.y, interceptPoint.x - elite.pos.x);

          // Advanced movement: Ideal Range + Pacing
          let targetForce = 0;
          if (distToNearest > 500) targetForce = 2.0;
          else if (distToNearest < 350) targetForce = -1.5;
          else targetForce = 0.5; // Slow crawl when in range
          
          const approach = Vector.mult(Vector.normalize(dirToNearest), targetForce);
          steering.x += approach.x; steering.y += approach.y;
          
          // Strafing / Flanking
          const strafeAngle = Date.now() / 1200; // Slower, more deliberate strafing
          const strafeDir = Vector.normalize({ x: -dirToNearest.y, y: dirToNearest.x });
          const strafe = Vector.mult(strafeDir, Math.sin(strafeAngle) * 3.0);
          steering.x += strafe.x; steering.y += strafe.y;

          this.attemptShoot(elite);
      } else {
          // Relaxed Patrol
          const distToPatrol = Vector.dist(elite.pos, elite.patrolPos);
          if (distToPatrol > 200) {
              const patrol = Vector.mult(Vector.normalize(Vector.sub(elite.patrolPos, elite.pos)), 0.82);
              steering.x += patrol.x; steering.y += patrol.y;
          } else if (Math.random() < 0.01) {
              elite.vel = Vector.add(elite.vel, Vector.mult(Vector.fromAngle(Math.random() * Math.PI * 2), 0.4));
          }
          elite.rotation += dt * 0.3;
      }

      elite.acc = Vector.limit(steering, 2.7);
  }

  getInterceptPoint(shooterPos: Vector2, bulletSpeed: number, targetPos: Vector2, targetVel: Vector2): Vector2 {
      const relPos = Vector.sub(targetPos, shooterPos);
      const dist = Vector.mag(relPos);
      const timeToHit = dist / bulletSpeed;
      const predictionFactor = Math.min(1.2, 0.5 + dist / 1000); 
      return Vector.add(targetPos, Vector.mult(targetVel, timeToHit * predictionFactor)); 
  }

  updateBotAI(bot: Tank, dt: number) {
      const useLegacy = (window as any).__vextorLegacyAI === true;
      if (useLegacy) {
          EnemyAITanks.update(bot, this, dt, BOT_STAT_PRIORITIES);
          return;
      }
      this.aiSystem.updateBot(bot, this as any, dt, BOT_STAT_PRIORITIES);
  }

  awardXP(tank: Tank, amount: number) {
      if (this.gameMode === GameMode.SANDBOX) return;
      const xpBuff = tank.activeBuffs?.find(b => b.type === 'XP_MULT');
      let finalAmount = amount * (xpBuff ? 2.0 : 1.0) * tank.xpMultiplier;
      if (tank.isTransformed) finalAmount *= 2.0;

      tank.score += finalAmount;
      if (tank === this.player) {
          this.xp += finalAmount;
          while (this.level < MAX_LEVEL && this.xp >= this.getLevelXp(this.level)) {
              this.xp -= this.getLevelXp(this.level);
              this.level++;
              this.player.level = this.level;
              if (this.level <= 45) this.player.availableStatPoints++;
              this.player.updateStats(); 
              this.sound.playLevelUp();

              if (this.level >= REBIRTH_LEVEL && !this.player.hasRebirthed) {
                  this.startRebirth();
              }
          }
      } else {
          let nextLevelXp = this.getLevelXp(tank.level);
          while (tank.level < MAX_LEVEL && tank.score >= nextLevelXp) {
              tank.level++;
              if (tank.level <= 45) tank.availableStatPoints++;
              tank.updateStats();
              nextLevelXp = this.getLevelXp(tank.level);
              const choices = CLASS_TREE[tank.classType] ?? [];
              if (tank.level % 15 === 0 && choices.length > 0) {
                  this.upgradeClassForTank(tank, choices[Math.floor(Math.random() * choices.length)]);
              }
          }
      }
  }

  startRebirth() {
      if (this.playerState !== PlayerState.ACTIVE || this.player.hasRebirthed) return;
      this.isRebirthing = false;
      this.rebirthSelectionPos = null;
      this.rebirthOptions = [];
      this.playerState = PlayerState.EVOLVING;
      this.evolutionTransitionTimer = 1.25;
      this.player.vel = { x: 0, y: 0 };
      this.player.invulnerableTime = Math.max(this.player.invulnerableTime, 1500);
      this.bossChoices = [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD, TankClass.CELESTIAL];
      this.addNotification("EVOLUTION PROTOCOL INITIALIZED", "#ffbb00");
      this.sound.playLevelUp();
  }

  completeRebirth(bossClass: TankClass) {
      if (this.playerState !== PlayerState.BOSS_SELECTION) return;
      if (!this.bossChoices.includes(bossClass)) return;
      this.isRebirthing = false;
      this.player.hasRebirthed = true;
      this.playerState = PlayerState.ACTIVE;
      this.evolutionTransitionTimer = 0;
      this.upgradeClassForTank(this.player, bossClass);
      
      this.player.pos = {
          x: Math.max(this.player.radius + 40, Math.min(CANVAS_WIDTH - this.player.radius - 40, this.player.pos.x)),
          y: Math.max(this.player.radius + 40, Math.min(CANVAS_HEIGHT - this.player.radius - 40, this.player.pos.y))
      };
      this.player.health = this.player.maxHealth;
      this.player.shield = this.player.maxShield;
      this.player.invulnerableTime = Math.max(this.player.invulnerableTime, 1200);
      
      this.addNotification(`EVOLVED TO ${bossClass}`, "#ff4444");
      this.sound.playRoar();
  }

  attemptShoot(tank: Tank) {
    // Sandbox Hard Guard: Prevent enemies from firing if bots are disabled
    if (this.gameMode === GameMode.SANDBOX && tank.type !== EntityType.PLAYER && !this.sandboxConfig.botsEnabled) {
        return;
    }

    let baseReloadTimeMs = (BASE_STATS.reload - (tank.stats[StatType.RELOAD] * 2.5)) * 16.67; 
    
    // SACRIFICIAL GOAT BUFF: Fire Rate increased
    if (tank.isSacrificing) {
        baseReloadTimeMs *= 0.45; 
    }

    let shotFired = false;
    const idx = tank.nextBarrelIndex % tank.barrels.length;
    const barrel = tank.barrels[idx];

    const isManager = tank.classType === TankClass.MANAGER;
    const isHybrid = tank.classType === TankClass.HYBRID;
    const isOverseerType = tank.classType === TankClass.OVERLORD || tank.classType === TankClass.OVERSEER;

    if (isHybrid) {
        const mainBarrelIndex = 0;
        const droneBarrelIndex = 1;
        const mainReady = tank.barrelCooldowns[mainBarrelIndex] <= 0 || this.sandboxConfig.infiniteAmmo;
        const droneReady = tank.barrelCooldowns[droneBarrelIndex] <= 0 || this.sandboxConfig.infiniteAmmo;

        // Hybrid support system: maintain a small drone cloud while firing Destroyer-class shells.
        const currentDrones = this.entities.filter(e => e.type === EntityType.DRONE && (e as Drone).owner === tank).length;
        const droneLimit = 4;
        if (droneReady && currentDrones < droneLimit) {
            const droneBarrel = tank.barrels[droneBarrelIndex] || tank.barrels[0];
            const [dLen, , , dAngleOff] = droneBarrel;
            const dAngle = tank.rotation + dAngleOff;
            const dTip = Vector.add(tank.pos, Vector.mult(Vector.fromAngle(dAngle), tank.radius * dLen));
            this.entities.push(new Drone(this.nextId(), dTip.x, dTip.y, tank));

            const droneCd = Math.max(280, baseReloadTimeMs * 2.4);
            if (!this.sandboxConfig.infiniteAmmo) {
                tank.barrelCooldowns[droneBarrelIndex] = droneCd;
                tank.barrelMaxCooldowns[droneBarrelIndex] = droneCd;
            }
        }

        if (mainReady) {
            // Fire heavy main shell from primary barrel only.
            const activeBarrel = tank.barrels[mainBarrelIndex];
            const [length, width = 0.8, xOff, angleOff, delayMultiplier, yOff = 0] = activeBarrel;
            const widthScale = width / 0.8;

            const isDestroyer = true;
            const isAnnihilator = false;
            const isSpecialLarge = true;
            const stability = tank.stats[StatType.BULLET_SPREAD] || 0;

            let bulletSpeedMult = 2.05, bulletDamageMult = 5.4, bulletLifeMult = 1.7, bulletSizeMult = this.sandboxConfig?.spawningEnabled ? 2.35 : 2.05;
            if (!isSpecialLarge) {
                bulletSizeMult *= widthScale;
                bulletDamageMult *= widthScale;
                bulletLifeMult *= widthScale;
            }

            const stabilityFactor = Math.max(0.28, Math.pow(0.86, stability));
            const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * stabilityFactor, tank.spread * stabilityFactor);
            const forward = Vector.fromAngle(angle);
            const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
            const startPos = Vector.add(tank.pos, {
                x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
                y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
            });
            const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));

            const b = new Bullet(
                this.nextId(),
                tip.x,
                tip.y,
                Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * bulletSpeedMult),
                tank,
                bulletDamageMult,
                bulletLifeMult,
                bulletSizeMult,
                mainBarrelIndex
            );
            this.entities.push(b);

            tank.barrelHeat[mainBarrelIndex] = 1.0;
            if (tank === this.player || this.isOnScreen(tank.pos)) {
                for (let k = 0; k < 10; k++) {
                    this.particles.push(new Particle(tip.x, tip.y, 'rgba(160, 120, 255, 0.6)', 14, 26, 'GAS'));
                }
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(145, 90, 255, 0.28)', 24, 18, 'RING'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(255, 235, 255, 0.5)', (tank.radius * 0.4) * bulletSizeMult, 6, 'FLASH'));
            }

            const recoilPower = 2.8;
            if (this.sandboxConfig.knockbackEnabled) {
                tank.vel = Vector.sub(tank.vel, Vector.mult(forward, recoilPower));
                const recoilComp = Math.min(0.45, stability * 0.035);
                tank.vel = Vector.add(tank.vel, Vector.mult(forward, recoilPower * recoilComp));
            }

            const cooldownVal = Math.max(52, baseReloadTimeMs * delayMultiplier * 1.25);
            if (!this.sandboxConfig.infiniteAmmo) {
                tank.barrelCooldowns[mainBarrelIndex] = cooldownVal;
                tank.barrelMaxCooldowns[mainBarrelIndex] = cooldownVal;
            }

            shotFired = true;
        }
    } else if (isManager) {
        const unitLimit = 6;
        let currentMiniTanks = this.entities.filter(e => e.type === EntityType.MINI_TANK && (e as MiniTank).owner === tank).length;
        if (currentMiniTanks < unitLimit && (tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo)) {
            const [length, , , angleOff] = barrel;
            const angle = tank.rotation + angleOff;
            const tip = Vector.add(tank.pos, Vector.mult(Vector.fromAngle(angle), tank.radius * length));

            this.entities.push(new MiniTank(this.nextId(), tip.x, tip.y, tank));

            const cooldownVal = Math.max(300, baseReloadTimeMs * 3.3);
            if (!this.sandboxConfig.infiniteAmmo) {
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }
            tank.nextBarrelIndex++;
            shotFired = true;
            this.sound.playShoot(TankClass.MANAGER, this.getAudioSpatialOptions(tank.pos, false));
            for (let p = 0; p < 5; p++) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(120,255,220,0.35)', 9, 20, 'GAS'));
            }
        }
    } else if (isOverseerType) {
        const droneLimit = (tank.classType === TankClass.OVERLORD) ? 12 : (tank.classType === TankClass.OVERSEER) ? 8 : 4;
        let currentDrones = this.entities.filter(e => e.type === EntityType.DRONE && (e as Drone).owner === tank).length;
        
        if (currentDrones < droneLimit && (tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo)) {
            const [length, width, xOff, angleOff] = barrel;
            const angle = tank.rotation + angleOff;
            const tip = Vector.add(tank.pos, Vector.mult(Vector.fromAngle(angle), tank.radius * length));
            
            const drone = new Drone(this.nextId(), tip.x, tip.y, tank);
            this.entities.push(drone);
            
            const cooldownVal = Math.max(250, baseReloadTimeMs * (tank.classType === TankClass.HYBRID ? 2.5 : 4.0)); 
            if (!this.sandboxConfig.infiniteAmmo) {
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }
            tank.nextBarrelIndex++;
            shotFired = true;
            if (tank.classType !== TankClass.HYBRID) this.sound.playShoot(tank.classType, this.getAudioSpatialOptions(tank.pos, false));
            const burstColor = tank.classType === TankClass.OVERLORD ? 'rgba(140,220,255,0.35)' : 'rgba(120,255,200,0.28)';
            for (let p = 0; p < (tank.classType === TankClass.OVERLORD ? 5 : 3); p++) {
                this.particles.push(new Particle(tip.x, tip.y, burstColor, 8, 18, 'GAS'));
            }
        }
    } else if (tank.classType === TankClass.HUNTER || tank.classType === TankClass.X_HUNTER) {
        // Sequential stacked shotgun burst logic for Hunter family
        if (tank.barrelCooldowns[0] <= 0 || this.sandboxConfig.infiniteAmmo) {
            const cooldownVal = Math.max(40, baseReloadTimeMs * tank.barrels[0][4]);

            // Clear any outstanding bursts to avoid double scheduling
            tank.burstQueue = [];

            // Add the sequential barrels to the burst queue!
            // We scale the delay slightly by the reload stat, making higher reload speeds fire the burst even faster!
            const burstInterval = 100 * Math.max(0.3, 1.0 - (tank.stats[StatType.RELOAD] * 0.05));

            tank.barrels.forEach((bar, i) => {
                tank.burstQueue.push({
                    barrelIndex: i,
                    delayLeftMs: i * burstInterval
                });

                if (!this.sandboxConfig.infiniteAmmo) {
                    tank.barrelCooldowns[i] = cooldownVal;
                    tank.barrelMaxCooldowns[i] = cooldownVal;
                }
            });

            shotFired = true;
        }
    } else if (tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo) {
        const [length, width, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
        const widthScale = width / 0.8;
        
        const isDestroyer = tank.classType === TankClass.DESTROYER || tank.classType === TankClass.HYBRID;
        const isAnnihilator = tank.classType === TankClass.ANNIHILATOR;
        const isMachineGun = tank.classType === TankClass.MACHINE_GUN;
        const isSprayer = tank.classType === TankClass.SPRAYER;
        const sprayerCoreIndex = Math.floor(tank.barrels.length / 2);
        const isSprayerCoreBarrel = isSprayer && idx === sprayerCoreIndex;
        const isPacifistClass = this.isPacifist(tank.classType);
        const isDrainingClass = this.isDraining(tank.classType);
        const isSpecialLarge = isDestroyer || isAnnihilator;
        const stability = tank.stats[StatType.BULLET_SPREAD] || 0;

        let bulletSpeedMult = 1.0, bulletDamageMult = 1.0, bulletLifeMult = 1.0, bulletSizeMult = 1.0;
        
        // Default to medium size for all tanks
        bulletSizeMult = 1.0;
        
        if (tank.classType === TankClass.SNIPER) { bulletSpeedMult = 1.5; bulletDamageMult = 1.65; bulletLifeMult = 1.3; }
        else if (tank.classType === TankClass.ASSASSIN) { bulletSpeedMult = 1.85; bulletDamageMult = 2.25; bulletLifeMult = 1.7; }
        else if (tank.classType === TankClass.RANGER || tank.classType === TankClass.STALKER) { bulletSpeedMult = 2.4; bulletDamageMult = 3.20; bulletLifeMult = 2.4; }
        else if (isDestroyer) { 
            bulletSizeMult = this.sandboxConfig?.spawningEnabled ? 2.5 : 2.2; 
            bulletDamageMult = 6.0; 
            bulletLifeMult = 1.8; 
            bulletSpeedMult = 2.1; 
        }
        else if (isAnnihilator) { 
            bulletSizeMult = this.sandboxConfig?.spawningEnabled ? 3.2 : 3.0; 
            bulletDamageMult = 9.0; 
            // Close-mid siege cannon identity: extreme impact, shorter reach.
            bulletLifeMult = 1.75; 
            bulletSpeedMult = 1.62; 
        }
        else if (isPacifistClass) {
            // Support identity: reliable utility damage, lower than DPS classes
            bulletSizeMult = 0.95;
            bulletDamageMult = 0.65;
            bulletLifeMult = 1.05;
            bulletSpeedMult = 1.05;
        }
        else if (isDrainingClass) {
            // Sustain-offense hybrid: consistent but controlled offensive profile
            bulletSizeMult = 1.0;
            bulletDamageMult = 0.95;
            bulletLifeMult = 1.2;
            bulletSpeedMult = 1.15;
        }
        else if (isMachineGun) {
            // Sustained suppression identity with spin-up overdrive
            const spin = Math.min(1, tank.machineSpin);
            const heat = Math.min(1, tank.machineHeat);
            const overdrive = Math.max(0, (heat - 0.35) / 0.65) * (0.45 + spin * 0.55);
            bulletSpeedMult += 0.08 * overdrive;
            bulletDamageMult *= 1 + 0.14 * overdrive;
            bulletLifeMult *= 1 + 0.1 * overdrive;
            bulletSizeMult *= 1 + overdrive * 0.04;
        }
        else if (isSprayer) {
            if (isSprayerCoreBarrel) {
                bulletSizeMult = 1.75;
                bulletDamageMult = 1.85;
                bulletLifeMult = 1.45;
                bulletSpeedMult = 1.12;
            } else {
                bulletSizeMult = 0.82;
                bulletDamageMult = 0.78;
                bulletLifeMult = 0.96;
                bulletSpeedMult = 1.34;
            }
        }
        else if (tank.classType === TankClass.GUNNER || tank.classType === TankClass.AUTO_GUNNER) {
            bulletSizeMult = 0.68;
            bulletDamageMult = 0.76;
            bulletSpeedMult = 1.82;
            bulletLifeMult = 1.18;
        }
        else if (tank.classType === TankClass.STREAMLINER) { bulletDamageMult = 0.45; bulletSizeMult = 0.6; bulletSpeedMult = 1.8; }

        // EXCLUSION LOGIC: Only apply width scale to bullet properties if not a Destroyer, Annihilator, or Hybrid main gun.
        if (!isSpecialLarge) {
            bulletSizeMult *= widthScale;
            bulletDamageMult *= widthScale;
            bulletLifeMult *= widthScale;
        }

        const stabilityFactor = Math.max(0.28, Math.pow(0.86, stability));
        let spreadScale = stabilityFactor;
        if (isMachineGun) {
            const overheatPenalty = Math.max(0, tank.machineHeat - 0.9) * 1.8;
            spreadScale = Math.min(1.35, stabilityFactor * (1 + overheatPenalty));
        }
        if (tank.classType === TankClass.GUNNER || tank.classType === TankClass.AUTO_GUNNER) {
            spreadScale *= 0.86;
        }
        if (isSprayer) {
            spreadScale *= isSprayerCoreBarrel ? 0.78 : 1.22;
        }
        const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
        const forward = Vector.fromAngle(angle);
        
        const lateralAngle = tank.rotation + angleOff + Math.PI/2;
        const startPos = Vector.add(tank.pos, { 
            x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius), 
            y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius) 
        });
        const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));
        
        const b = new Bullet(this.nextId(), tip.x, tip.y, Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * bulletSpeedMult), tank, bulletDamageMult, bulletLifeMult, bulletSizeMult, idx);
        
        const isSniperFamily = tank.classType === TankClass.SNIPER || tank.classType === TankClass.ASSASSIN || tank.classType === TankClass.RANGER || tank.classType === TankClass.STALKER;
        if (isSniperFamily) {
            b.maxHealth *= 1.45; // Enhanced solid bullet health
            b.health = b.maxHealth;
        }

        if (isAnnihilator) {
            b.mass = 500; 
            b.friction = 0.99; 
        }

        this.entities.push(b);
        if (isSprayerCoreBarrel) {
            b.mass *= 1.3;
            b.maxHealth *= 1.2;
            b.health = b.maxHealth;
        }
        
        if (isSpecialLarge) {
            tank.barrelHeat[idx] = 1.0;
            if (tank === this.player || this.isOnScreen(tank.pos)) {
                for (let k = 0; k < 12; k++) {
                    const heavyColor = isAnnihilator ? '#00e16e' : 'rgba(255, 145, 75, 0.65)';
                    this.particles.push(new Particle(tip.x, tip.y, heavyColor, isAnnihilator ? 18 : 14, isAnnihilator ? 40 : 28, 'GAS'));
                }
                if (isAnnihilator) {
                    this.particles.push(new Particle(tip.x, tip.y, 'rgba(0, 255, 110, 0.4)', 40, 30, 'RING'));
                } else {
                    this.particles.push(new Particle(tip.x, tip.y, 'rgba(255, 145, 75, 0.28)', 26, 20, 'RING'));
                }
            }
        }

        if (tank === this.player || this.isOnScreen(tank.pos)) {
             this.particles.push(new Particle(tip.x, tip.y, isAnnihilator ? '#fff' : 'rgba(255, 220, 100, 0.4)', (tank.radius * 0.4) * bulletSizeMult, 6, 'FLASH'));
             if (isDestroyer && !isAnnihilator) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(255, 190, 120, 0.35)', 14, 10, 'RING'));
             }
             if (isMachineGun) {
                const tracerBursts = tank.machineHeat > 0.65 ? 3 : 2;
                for (let tIdx = 0; tIdx < tracerBursts; tIdx++) {
                    const tracer = new Particle(
                        tip.x - forward.x * (6 + tIdx * 3),
                        tip.y - forward.y * (6 + tIdx * 3),
                        tank.machineHeat > 0.8 ? 'rgba(255, 160, 90, 0.6)' : 'rgba(180, 220, 255, 0.5)',
                        3 + Math.random() * 2,
                        10 + Math.random() * 6,
                        'FLASH'
                    );
                    tracer.vel = { x: -forward.x * (1.4 + Math.random()), y: -forward.y * (1.4 + Math.random()) };
                    this.particles.push(tracer);
                }
                if (tank.machineHeat > 0.55) {
                    this.particles.push(new Particle(tank.pos.x, tank.pos.y, 'rgba(255, 130, 70, 0.25)', 14 + tank.machineHeat * 10, 16, 'RING'));
             }
             if (isSprayer) {
                const flashColor = isSprayerCoreBarrel ? 'rgba(180,220,255,0.72)' : 'rgba(150,210,255,0.52)';
                const ventColor = isSprayerCoreBarrel ? 'rgba(140,170,220,0.34)' : 'rgba(125,165,220,0.24)';
                this.particles.push(new Particle(tip.x, tip.y, flashColor, isSprayerCoreBarrel ? 10 : 6, isSprayerCoreBarrel ? 11 : 8, 'FLASH'));
                for (let s = 0; s < (isSprayerCoreBarrel ? 3 : 2); s++) {
                    const vent = new Particle(
                        tip.x - forward.x * (5 + s * 3),
                        tip.y - forward.y * (5 + s * 3),
                        ventColor,
                        (isSprayerCoreBarrel ? 8 : 5) + Math.random() * 2,
                        10 + Math.random() * 5,
                        'GAS'
                    );
                    vent.vel = { x: -forward.x * (1.2 + Math.random() * 0.7), y: -forward.y * (1.2 + Math.random() * 0.7) };
                    this.particles.push(vent);
                }
             }
             if (tank.classType === TankClass.GUNNER || tank.classType === TankClass.AUTO_GUNNER) {
                 const isAuto = tank.classType === TankClass.AUTO_GUNNER;
                 const flashColor = isAuto ? 'rgba(120,200,255,0.55)' : 'rgba(120,255,150,0.52)';
                 const gasColor = isAuto ? 'rgba(110,170,255,0.26)' : 'rgba(130,255,160,0.24)';
                 const ventBurst = new Particle(tip.x, tip.y, flashColor, 4 + Math.random() * 2, 10 + Math.random() * 6, 'FLASH');
                 ventBurst.vel = { x: -forward.x * (1 + Math.random() * 1.3), y: -forward.y * (1 + Math.random() * 1.3) };
                 this.particles.push(ventBurst);
                 if (Math.random() < 0.45) {
                     this.particles.push(new Particle(
                         tip.x - forward.x * 8,
                         tip.y - forward.y * 8,
                         gasColor,
                         6 + Math.random() * 4,
                         12,
                         'GAS'
                     ));
                 }
                 if (Math.random() < 0.28) {
                     this.particles.push(new Particle(tank.pos.x, tank.pos.y, flashColor, 9, 10, 'RING'));
                 }
             }
             if (tank.classType === TankClass.TRIPLE_TANK) {
                 this.particles.push(new Particle(tip.x, tip.y, 'rgba(180,220,255,0.5)', 5, 9, 'FLASH'));
                 if (Math.random() < 0.35) {
                     this.particles.push(new Particle(tip.x - forward.x * 7, tip.y - forward.y * 7, 'rgba(170,200,235,0.24)', 6, 10, 'GAS'));
                 }
             }
        }
        }

        let recoilPower = 0.12; 
        if (isAnnihilator) {
            recoilPower = 1.25; // EXTREMELY NERFED recoil for stabilization control
        } else if (isDestroyer) {
            recoilPower = 4.2; 
        } else if (tank.classType === TankClass.STREAMLINER) {
            recoilPower = 0.01; 
        } else if (tank.classType === TankClass.TRI_ANGLE || tank.classType === TankClass.BOOSTER || tank.classType === TankClass.FIGHTER) {
            recoilPower = (angleOff === 0) ? 0.1 : 2.2; 
        } else if (tank.barrels.length > 2) {
            recoilPower = 0.03; 
        }
        
        if (this.sandboxConfig.knockbackEnabled) tank.vel = Vector.sub(tank.vel, Vector.mult(forward, recoilPower)); 
        if (isMachineGun) {
            // Weapon Stability now doubles as recoil compensation
            const recoilComp = Math.min(0.45, stability * 0.035);
            tank.vel = Vector.add(tank.vel, Vector.mult(forward, recoilPower * recoilComp));
        }

        const annihilatorReloadNerf = isAnnihilator ? 1.6 : 1.0;
        let cooldownVal = Math.max(40, baseReloadTimeMs * delayMultiplier * annihilatorReloadNerf);
        if (isMachineGun) {
            const spin = Math.min(1, tank.machineSpin);
            const heat = Math.min(1, tank.machineHeat);
            const efficiency = Math.min(0.35, 0.11 + stability * 0.022);
            const overdrive = Math.max(0, (heat - 0.3) / 0.7) * (0.5 + spin * 0.5);
            const fireRateBonus = 1 - Math.min(0.38, overdrive * efficiency);
            const overheatTax = heat > 0.92 ? 1 + (heat - 0.92) * 1.5 : 1;
            cooldownVal = Math.max(18, cooldownVal * fireRateBonus * overheatTax);
            tank.machineSpin = Math.min(1, tank.machineSpin + 0.22 + stability * 0.01);
            const heatGain = Math.max(0.035, 0.12 - stability * 0.006);
            tank.machineHeat = Math.min(1, tank.machineHeat + heatGain);
        }
        if (!this.sandboxConfig.infiniteAmmo) {
            tank.barrelCooldowns[idx] = cooldownVal;
            tank.barrelMaxCooldowns[idx] = cooldownVal;
        }
        if (isSprayer) {
            const distFromCore = Math.abs(idx - sprayerCoreIndex);
            const normalized = sprayerCoreIndex > 0 ? (distFromCore / sprayerCoreIndex) : 0;
            const recoilImpulse = isSprayerCoreBarrel
                ? 1.18
                : (0.78 - normalized * 0.22);
            tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, recoilImpulse);
        }
        tank.nextBarrelIndex++;
        shotFired = true;
    }

    if (shotFired) { 
        this.revealStealthOnFire(tank);
        if (tank === this.player || this.isOnScreen(tank.pos)) {
            this.sound.playShoot(tank.classType, this.getAudioSpatialOptions(tank.pos, false)); 
            if ((tank.classType === TankClass.GUNNER || tank.classType === TankClass.AUTO_GUNNER) && this.settings.shakeEnabled) {
                this.shakeAmount += 1.3 * this.settings.shakeIntensity;
            }
        }
    }
  }

  fireBurstShot(tank: Tank, barrelIndex: number) {
    if (tank.isDead) return;
    
    // Sandbox Hard Guard
    if (this.gameMode === GameMode.SANDBOX && tank.type !== EntityType.PLAYER && !this.sandboxConfig.botsEnabled) {
        return;
    }

    const barrel = tank.barrels[barrelIndex];
    if (!barrel) return;

    const [length, width, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
    const stabilityFactor = Math.max(0.28, Math.pow(0.86, tank.stats[StatType.BULLET_SPREAD] || 0));
    const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * stabilityFactor, tank.spread * stabilityFactor);
    const forward = Vector.fromAngle(angle);

    const lateralAngle = tank.rotation + angleOff + Math.PI/2;
    const startPos = Vector.add(tank.pos, { 
        x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius), 
        y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius) 
    });
    const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));

    let bSpeedMult = 1.0, bDmgMult = 1.0, bLifeMult = 1.0, bSizeMult = 1.0;
    if (tank.classType === TankClass.HUNTER) {
        if (barrelIndex === 0) { // Outer barrel (heavy slow round)
            bSpeedMult = 1.25; bDmgMult = 1.55; bLifeMult = 1.3; bSizeMult = 1.45;
        } else { // Inner barrel (high-speed dart)
            bSpeedMult = 1.95; bDmgMult = 1.05; bLifeMult = 1.7; bSizeMult = 0.75;
        }
    } else if (tank.classType === TankClass.X_HUNTER) { // X_HUNTER (three nested rounds)
        if (barrelIndex === 0) { // Large outer
            bSpeedMult = 1.2; bDmgMult = 1.75; bLifeMult = 1.2; bSizeMult = 1.7;
        } else if (barrelIndex === 1) { // Medium middle
            bSpeedMult = 1.75; bDmgMult = 1.3; bLifeMult = 1.6; bSizeMult = 1.15;
        } else { // Inner rocket shell
            bSpeedMult = 2.4; bDmgMult = 0.9; bLifeMult = 2.2; bSizeMult = 0.65;
        }
    }

    const b = new Bullet(
        this.nextId(), 
        tip.x, 
        tip.y, 
        Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * bSpeedMult), 
        tank, 
        bDmgMult, 
        bLifeMult, 
        bSizeMult,
        barrelIndex
    );

    // Enhanced solid bullet health for tactical snipers
    b.maxHealth *= 1.35;
    b.health = b.maxHealth;

    this.entities.push(b);
    this.revealStealthOnFire(tank);

    // Dynamic recoil per sequential shot!
    const recoilPower = (tank.classType === TankClass.HUNTER ? 0.7 : 0.8);
    if (this.sandboxConfig.knockbackEnabled) {
        tank.vel = Vector.sub(tank.vel, Vector.mult(forward, recoilPower));
    }

    // Play muzzle audio and effects!
    if (tank === this.player || this.isOnScreen(tank.pos)) {
        this.sound.playShoot(tank.classType, this.getAudioSpatialOptions(tank.pos, false));
        this.particles.push(new Particle(tip.x, tip.y, 'rgba(255, 220, 100, 0.4)', (tank.radius * 0.4) * bSizeMult, 6, 'FLASH'));
        // Emit high velocity spark cluster reflecting sequential shooting!
        for (let j = 0; j < 5; j++) {
            const pAngle = angle + (Math.random() - 0.5) * 0.4;
            const pSpeed = Math.random() * 5 + 3;
            const p = new Particle(tip.x, tip.y, 'rgba(255, 180, 50, 0.7)', Math.random() * 3 + 1, 15);
            p.vel = { x: Math.cos(pAngle) * pSpeed + tank.vel.x, y: Math.sin(pAngle) * pSpeed + tank.vel.y };
            this.particles.push(p);
        }
    }
  }

  private revealStealthOnFire(tank: Tank) {
    if (tank.classType !== TankClass.STALKER) return;
    tank.stealthSuppressedUntil = Date.now() + 2000;
  }

  applyTankMovement(tank: Tank, dir: Vector2) { 
    if (Vector.mag(dir) > 0) {
      const isRamClass = tank.classType === TankClass.TRI_ANGLE || tank.classType === TankClass.BOOSTER || tank.classType === TankClass.FIGHTER;
      const weightPenalty = tank.stats[StatType.BODY_DAMAGE] * 0.12;
      const rawSpeedStat = tank.stats[StatType.MOVEMENT_SPEED];
      const speedSoftcap = 5;
      const overflow = Math.max(0, rawSpeedStat - speedSoftcap);
      const dampedSpeedStat = rawSpeedStat - overflow + overflow * 0.42;
      const speedBonus = dampedSpeedStat * 0.6;
      let effectiveSpeed = Math.max(1.8, BASE_STATS.speed + speedBonus - weightPenalty);

      if (isRamClass) {
        // Keep high-speed identity but cap extreme stack cases.
        effectiveSpeed = Math.min(effectiveSpeed, 8.6);
        const recentlyDamaged = (Date.now() - (tank.lastDamageTime || 0)) < 900;
        if (recentlyDamaged) effectiveSpeed *= 0.9;
      }

      const currentSpeed = Vector.mag(tank.vel);
      if (isRamClass && currentSpeed > effectiveSpeed * 0.72) {
        const overRatio = Vector.clamp((currentSpeed - effectiveSpeed * 0.72) / Math.max(0.001, effectiveSpeed), 0, 1);
        effectiveSpeed *= (1 - overRatio * 0.3);
      }

      // Smooth steering vector to reduce micro-jitter from fast directional input changes.
      const steerBlend = 0.24;
      const desiredDir = Vector.normalize(dir);
      tank.lastSteering.x += (desiredDir.x - tank.lastSteering.x) * steerBlend;
      tank.lastSteering.y += (desiredDir.y - tank.lastSteering.y) * steerBlend;
      const smoothDir = Vector.mag(tank.lastSteering) > 0.001 ? Vector.normalize(tank.lastSteering) : desiredDir;
      tank.acc = Vector.mult(smoothDir, effectiveSpeed * (1 - tank.friction) / tank.friction); 
      
      // Update chassis rotation smoothly
      const targetChassisRot = Math.atan2(smoothDir.y, smoothDir.x);
      let diff = targetChassisRot - tank.chassisRotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      tank.chassisRotation += diff * 0.15;
    }
  }
  
  findNearest(origin: Entity, targets: Entity[]): Entity | null { let nearest = null; let minDst = Infinity; for (const t of targets) { const d = Vector.dist(origin.pos, t.pos); if (d < minDst) { minDst = d; nearest = t; } } return nearest; }
  isOnScreen(pos: Vector2, radius: number = 0) {
    if (this.lastViewportWidth === 0 || this.lastViewportHeight === 0) {
      this.updateViewportCache();
    }
    return (
      pos.x + radius > this.viewportLeft &&
      pos.x - radius < this.viewportRight &&
      pos.y + radius > this.viewportTop &&
      pos.y - radius < this.viewportBottom
    );
  }

  getAudioSpatialOptions(pos: Vector2, important: boolean = false): AudioSpatialOptions {
    if (this.lastViewportWidth === 0 || this.lastViewportHeight === 0) {
      this.updateViewportCache();
    }
    const onScreen = this.isOnScreen(pos, 0);
    const dx = pos.x - this.cameraPos.x;
    const dy = pos.y - this.cameraPos.y;
    const viewDiag = Math.hypot(this.viewportHalfW * 2, this.viewportHalfH * 2);
    const dist = Math.hypot(dx, dy);
    const distanceNorm = Math.min(1, dist / Math.max(1, viewDiag * 1.8));
    const pan = Math.max(-1, Math.min(1, dx / Math.max(1, this.viewportHalfW)));
    return { onScreen, distanceNorm, pan, important };
  }

  private getSpawnPos(team: Team): Vector2 {
    if (this.gameMode === GameMode.TEAMS) {
        if (team === Team.BLUE) {
            return { x: Vector.randomRange(100, BASE_ZONE_WIDTH - 100), y: Vector.randomRange(100, CANVAS_HEIGHT - 100) };
        } else {
            return { x: Vector.randomRange(CANVAS_WIDTH - BASE_ZONE_WIDTH + 100, CANVAS_WIDTH - 100), y: Vector.randomRange(100, CANVAS_HEIGHT - 100) };
        }
    }
    return Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  spawnEnemy() {
      let pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT), team = Team.RED;
      if (this.gameMode === GameMode.TEAMS) {
          const blueTanks = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && e.team === Team.BLUE).length;
          const redTanks = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && e.team === Team.RED).length;
          
          if (blueTanks < 40 && redTanks < 40) team = blueTanks <= redTanks ? Team.BLUE : Team.RED;
          else if (blueTanks < 40) team = Team.BLUE; 
          else if (redTanks < 40) team = Team.RED; 
          else return;
          
          pos = this.getSpawnPos(team);
          // Add some scatter to spawn pos
          pos.x += Vector.randomRange(-150, 150);
          pos.y += Vector.randomRange(-300, 300);
      }
      
      const bot = new Tank(this.nextId(), pos.x, pos.y, false, team);
      bot.name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      bot.invulnerableTime = 2000; // Protection for bots too
      
      // Bots now start at level 1 and grind their way up
      bot.level = 1;
      bot.score = 0;
      bot.availableStatPoints = 0;
      
      // Start as Basic tank
      this.upgradeClassForTank(bot, TankClass.BASIC);
      
      bot.updateStats(); 
      bot.health = bot.maxHealth; 
      this.entities.push(bot);
  }

  spawnShape() {
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }, nestRadius = 1500, isNestSpawn = Math.random() < 0.2; 
    let pos: Vector2, type: ShapeType;
    if (this.inVoid) {
        pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
        const roll = Math.random();
        if (roll < 0.03) type = ShapeType.OCTAGON; 
        else if (roll < 0.10) type = ShapeType.HEXAGON; 
        else if (roll < 0.25) type = ShapeType.PENTAGON; 
        else if (roll < 0.50) type = ShapeType.TRIANGLE; 
        else type = ShapeType.SQUARE; // Increased from 35% to 50%
    } else if (this.gameMode !== GameMode.SANDBOX) {
        const zoneIndex = this.pickSpawnZoneIndex();
        pos = this.getSpawnPositionInZone(zoneIndex);
        type = this.pickShapeTypeForSpawn(zoneIndex);
        this.recentSpawnZoneHistory.push(zoneIndex);
        if (this.recentSpawnZoneHistory.length > 6) this.recentSpawnZoneHistory.shift();
    } else if (isNestSpawn) {
        const angle = Math.random() * Math.PI * 2, dist = Math.sqrt(Math.random()) * nestRadius;
        pos = { x: center.x + Math.cos(angle) * dist, y: center.y + Math.sin(angle) * dist };
        const roll = Math.random();
        if (roll < 0.05) type = ShapeType.OCTAGON; 
        else if (roll < 0.15) type = ShapeType.HEXAGON; 
        else if (roll < 0.50) type = ShapeType.PENTAGON; 
        else if (roll < 0.80) type = ShapeType.TRIANGLE;
        else type = ShapeType.SQUARE; // Introduced to Pentagon Nest with a 20% spawn rate
    } else {
        pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
        const roll = Math.random();
        if (roll < 0.005) type = ShapeType.OCTAGON; 
        else if (roll < 0.02) type = ShapeType.HEXAGON; 
        else if (roll < 0.06) type = ShapeType.PENTAGON; 
        else if (roll < 0.20) type = ShapeType.TRIANGLE; 
        else type = ShapeType.SQUARE; // Increased from 60% to 80%
    }

    if (this.gameMode === GameMode.SANDBOX && this.sandboxConfig) {
        if (!this.sandboxConfig.enabledShapes[type]) return;
    }

    // Density Check: Don't spawn if too many shapes are already nearby
    const nearby = this.entities.filter(e => e.type === EntityType.SHAPE && Vector.dist(e.pos, pos) < 120);
    const densityLimit = (this.gameMode === GameMode.SANDBOX && this.sandboxConfig) ? this.sandboxConfig.shapeSpawnRate * 3 : 2;
    if (nearby.length > densityLimit) return;

    if (Vector.dist(pos, this.player.pos) < (this.gameMode === GameMode.TEAMS ? 560 : 500)) return;
    const shape = new Shape(this.nextId(), pos.x, pos.y, type, this.inVoid);
    this.entities.push(shape);
    this.currentShapeCount++;
    if (this.currentShapeCount % 5 === 0) this.sound.playShapeSpawn(); // Throttle spawn sound

    // Global Announcement for Rare Shapes (Legendary and higher)
    if (getRarityRank(shape.rarity) >= getRarityRank(ShapeRarity.LEGENDARY)) {
        const canNotify = this.gameMode !== GameMode.SANDBOX || (this.sandboxConfig?.showSpawnNotifications);
        
        if (canNotify) {
            const rarityName = shape.rarity.toUpperCase();
            const shapeName = shape.shapeType.toUpperCase();
            
            // Dynamic Sectoring
            const sectorX = pos.x < CANVAS_WIDTH / 3 ? 'ALPHA' : (pos.x < (CANVAS_WIDTH * 2) / 3 ? 'BETA' : 'GAMMA');
            const sectorY = pos.y < CANVAS_HEIGHT / 3 ? '1' : (pos.y < (CANVAS_HEIGHT * 2) / 3 ? '2' : '3');
            const sector = `${sectorX}-${sectorY}`;
            
            const trackingKey = `${shape.rarity}-${sector}`;
            const now = Date.now();
            const lastAlertTime = this.lastShapeAlertTimes.get(trackingKey) || 0;
            
            if (now - lastAlertTime > 5000) { // Throttle alerts of same rarity in exact same sector to once per 5 secs
                this.lastShapeAlertTimes.set(trackingKey, now);
                const rarityColor = RARITY_CONFIG[shape.rarity]?.color || '#ffffff';
                this.addNotification(`TACTICAL ALERT: [${rarityName}] ${shapeName} DETECTED IN SECTOR ${sector}`, rarityColor);
            }
        }

        // Coordination: Instruct some bots to prioritize this shape (Only in standard modes or if bots enabled)
        if (this.gameMode !== GameMode.SANDBOX || this.sandboxConfig?.botsEnabled) {
            const eligibleBots = this.entities.filter(e => e.type === EntityType.ENEMY && (e as Tank).isBot) as Tank[];
            const huntersToAssign = Math.min(eligibleBots.length, getRarityRank(shape.rarity) >= getRarityRank(ShapeRarity.GODLY) ? 8 : 4);
            
            // Shuffle and pick
            for (let i = 0; i < huntersToAssign; i++) {
                const idx = Math.floor(Math.random() * eligibleBots.length);
                const bot = eligibleBots[idx];
                if (bot) {
                    bot.aiHuntingSpecialId = shape.id;
                    bot.aiHuntingTimer = 60000; // Give up after 1 minute
                    eligibleBots.splice(idx, 1);
                }
            }
        }
    }
  }

  handleCollisions() {
    this.spatialGrid.clear();
    for (let i = 0; i < this.entities.length; i++) {
      this.spatialGrid.add(this.entities[i]);
    }
    for (let i = 0; i < this.entities.length; i++) {
        const a = this.entities[i];
        if (a.isDead) continue;
        const neighbors = this.spatialGrid.getNeighbors(a, this.collisionNeighborBuffer);
        for (let j = 0; j < neighbors.length; j++) {
            const b = neighbors[j];
            if (a === b || b.isDead) continue;
            const minDist = a.radius + b.radius;
            const d2 = (a.pos.x - b.pos.x) ** 2 + (a.pos.y - b.pos.y) ** 2;
            if (d2 < minDist * minDist) {
                if (a.type === EntityType.VOID_PORTAL || b.type === EntityType.VOID_PORTAL) {
                    const portal = (a.type === EntityType.VOID_PORTAL ? a : b) as VoidPortal, other = (a.type === EntityType.VOID_PORTAL ? b : a);
                    if (other.type === EntityType.PLAYER || other.type === EntityType.ENEMY) {
                        const toPortal = Vector.sub(portal.pos, other.pos), distToCenter = Vector.mag(toPortal);
                        other.vel = Vector.add(other.vel, Vector.mult(Vector.normalize(toPortal), 2.5));
                        if (distToCenter < portal.radius * 0.5) {
                            if (portal.isExit && this.inVoid) this.transitionToDimension(false);
                            else if (!portal.isExit && !this.inVoid) this.transitionToDimension(true);
                        }
                    }
                    continue; 
                }
                if (this.gameMode === GameMode.TEAMS && a.team === b.team && a.team !== Team.NONE && !this.inVoid) {
                    // Ignore collisions between teammates and teammate bullets/drones/minitanks
                    const aIsProjectile = a.type === EntityType.BULLET || a.type === EntityType.DRONE || a.type === EntityType.MINI_TANK || a.type === EntityType.BASE_DEFENSE_DRONE;
                    const bIsProjectile = b.type === EntityType.BULLET || b.type === EntityType.DRONE || b.type === EntityType.MINI_TANK || b.type === EntityType.BASE_DEFENSE_DRONE;
                    
                    if (aIsProjectile || bIsProjectile) continue; // Pass right through teammate projectiles
                    
                    // Teammate tanks bump into each other but don't deal damage
                    this.resolveCollision(a, b, false);
                    continue;
                }
                
                if (a.type === EntityType.BULLET && (a as Bullet).ownerId === b.id) return;
                if (b.type === EntityType.BULLET && (b as Bullet).ownerId === a.id) return;
                
                const aIsSummon = a.type === EntityType.DRONE || a.type === EntityType.MINI_TANK;
                const bIsSummon = b.type === EntityType.DRONE || b.type === EntityType.MINI_TANK;

                if (aIsSummon && bIsSummon) {
                    const ownerA = (a as Drone | MiniTank).owner;
                    const ownerB = (b as Drone | MiniTank).owner;
                    if (ownerA.id === ownerB.id) return;
                }
                
                if (aIsSummon && b.id === (a as Drone | MiniTank).owner.id) return;
                if (bIsSummon && a.id === (b as Drone | MiniTank).owner.id) return;

                this.resolveCollision(a, b, true);
            }
        }
    }
  }

  resolveCollision(a: Entity, b: Entity, applyDamage: boolean = true) {
     const dir = Vector.normalize(Vector.sub(a.pos, b.pos)), distVal = Vector.dist(a.pos, b.pos), overlap = (a.radius + b.radius) - distVal;
     let ratioA = 0.5, ratioB = 0.5, pcf = 1.0; 
     if (a.type === EntityType.BULLET || b.type === EntityType.BULLET) pcf = 0.05; 
     if (a.type === EntityType.DRONE || b.type === EntityType.DRONE || a.type === EntityType.MINI_TANK || b.type === EntityType.MINI_TANK) pcf = 0.2;
     if (a.type === EntityType.BOSS || b.type === EntityType.BOSS || a.type === EntityType.DUMMY || b.type === EntityType.DUMMY) { if (a.type === EntityType.BOSS || a.type === EntityType.DUMMY) { ratioA = 0.0; ratioB = 1.0; } else { ratioA = 1.0; ratioB = 0.0; } }
     else if (a.type === EntityType.GUARDIAN || b.type === EntityType.GUARDIAN) { if (a.type === EntityType.GUARDIAN && b.type !== EntityType.GUARDIAN) { ratioA = 0.05; ratioB = 1.0; } else if (b.type === EntityType.GUARDIAN && a.type !== EntityType.GUARDIAN) { ratioA = 1.0; ratioB = 0.05; } }
     else if (a.type === EntityType.BULLET && b.type !== EntityType.BULLET) { ratioA = 0.01; ratioB = 0.99; }
     else if (b.type === EntityType.BULLET && a.type !== EntityType.BULLET) { ratioA = 0.99; ratioB = 0.01; }
     else { const totalMass = a.mass + b.mass; ratioA = b.mass / totalMass; ratioB = a.mass / totalMass; }
     const force = Vector.mult(dir, overlap * pcf);
     a.pos = Vector.add(a.pos, Vector.mult(force, ratioA)); b.pos = Vector.sub(b.pos, Vector.mult(force, ratioB));
     
     if (!applyDamage) return;

     let dmgA = b.damage, dmgB = a.damage;
     const aSpeed = Vector.mag(a.vel || { x: 0, y: 0 });
     const bSpeed = Vector.mag(b.vel || { x: 0, y: 0 });
     const isRamClass = (e: Entity): boolean => {
         if (e.type !== EntityType.PLAYER && e.type !== EntityType.ENEMY) return false;
         const cls = (e as Tank).classType;
         return cls === TankClass.TRI_ANGLE || cls === TankClass.BOOSTER || cls === TankClass.FIGHTER;
     };

      const resolveOwnerId = (entity: Entity): number | null => {
          if (entity.type === EntityType.BULLET) return (entity as Bullet).ownerId;
          if (entity.type === EntityType.DRONE || entity.type === EntityType.MINI_TANK) return (entity as Drone | MiniTank).owner.id;
          if (entity.type === EntityType.BASE_DEFENSE_DRONE) return entity.id;
          if (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK) return entity.id;
          return null;
      };

      const filterDamage = (victim: Entity, killer: Entity, baseDmg: number): number => {
          if (victim.type === EntityType.DRONE || victim.type === EntityType.MINI_TANK) {
              const victimOwnerId = (victim as Drone | MiniTank).owner.id;
              const killerOwnerId = resolveOwnerId(killer);
              // Hard self-origin protection: no damage, no hit feedback, no rewards.
              if (killerOwnerId !== null && killerOwnerId === victimOwnerId) return 0;
          }

          if (victim.type === EntityType.BULLET && killer.type === EntityType.BULLET) {
              if ((victim as Bullet).ownerId === (killer as Bullet).ownerId) return 0;
          }

         if (victim.type === EntityType.MINI_TANK) {
            let isAllowedKiller = false;
            if (killer.type === EntityType.SHAPE || killer.type === EntityType.BOSS) {
                isAllowedKiller = true;
            } else if (killer.type === EntityType.ENEMY && !(killer instanceof MiniTank) && !(killer instanceof Drone)) {
                isAllowedKiller = true;
            } else if (killer.type === EntityType.BULLET) {
                const owner = this.entities?.find(e => e.id === (killer as Bullet).ownerId);
                if (owner && owner.type === EntityType.ENEMY) isAllowedKiller = true;
            }
            return isAllowedKiller ? baseDmg : 0;
         }
         
         if (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY) {
             const vTank = victim as Tank;
             let kOwnerId = -1;
             if (killer.type === EntityType.BULLET) kOwnerId = (killer as Bullet).ownerId;
             else if (killer.type === EntityType.DRONE || killer.type === EntityType.MINI_TANK) kOwnerId = (killer as Drone | MiniTank).owner.id;
             else if (killer.type === EntityType.PLAYER || killer.type === EntityType.ENEMY) kOwnerId = killer.id;
             
             if (kOwnerId !== -1) {
                 const kOwner = this.entities?.find(e => e.id === kOwnerId);
                 if (kOwner && kOwner.team === vTank.team && kOwner.team !== Team.NONE) return 0;
             }
         }

         if (victim.type === EntityType.PLAYER && this.sandboxConfig.invincible) return 0;
         if (killer.type === EntityType.BULLET && (killer as Bullet).bulletType === 'HEAL') {
             const healBullet = killer as Bullet;
             // Healing rounds cannot harm allies, but they can still chip hostile/core PvE targets.
             if ((victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY) && victim.team === healBullet.team) return 0;
             // Keep support identity: reduced hostile damage coefficients.
             if (victim.type === EntityType.SHAPE || victim.type === EntityType.CRASHER || victim.type === EntityType.BOSS) return baseDmg * 0.75;
             if (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY || victim.type === EntityType.ELITE_TANK || victim.type === EntityType.GUARDIAN) return baseDmg * 0.45;
         }
         return baseDmg;
     };

      dmgA = filterDamage(a, b, dmgA);
      dmgB = filterDamage(b, a, dmgB);

      // Ram balance: at extreme speed, ram classes are still dangerous,
      // but they lose some collision forgiveness and take more punish damage.
      if (a.type !== EntityType.BULLET && b.type !== EntityType.BULLET) {
          if (isRamClass(a) && aSpeed > 7.2) {
              dmgB *= 0.88;
              dmgA *= 1.1;
          }
          if (isRamClass(b) && bSpeed > 7.2) {
              dmgA *= 0.88;
              dmgB *= 1.1;
          }
      }

     const handleBulletEffect = (bullet: Bullet, victim: Entity) => {
         const owner = this.entities.find(e => e.id === bullet.ownerId);
         if (!owner || !(owner instanceof Tank)) return;

          if (bullet.bulletType === 'HEAL') {
               if ((victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY) && victim.team === bullet.team && victim.id !== owner.id) {
                   // Heal ally
                   const hAmount = (BASE_STATS.bulletDamage + owner.stats[StatType.BULLET_DAMAGE] * 5) * 0.8;
                   victim.health = Math.min(victim.maxHealth, victim.health + hAmount);
                   (victim as Tank).markHealingStatus(800);
                  // Buff shooter
                   owner.xpMultiplier = 1.15;
                   owner.xpMultiplierTimer = 3000;
                   owner.markHealingStatus(500);
                   this.particles.push(new Particle(victim.pos.x, victim.pos.y, '#4ade80', 5, 15, 'AURA'));
               } else if (victim.team !== bullet.team) {
                  // Utility hit feedback for Restoration rounds when dealing chip damage.
                  if (Math.random() < 0.35) {
                      this.particles.push(new Particle(victim.pos.x, victim.pos.y, '#86efac', 3, 10, 'AURA'));
                  }
              }
          } else if (bullet.bulletType === 'SIPHON') {
              if (victim.team !== bullet.team) {
                  const siphonHp = bullet.damage * 0.2;
                  owner.health = Math.min(owner.maxHealth, owner.health + siphonHp);
                  owner.markDrainingStatus(450);
                  this.awardXP(owner, bullet.damage * 0.15);
                  if (victim instanceof Tank) {
                    victim.markDrainingStatus(900);
                    if (owner.bloodPactActiveTimer > 0) {
                        victim.applyDrainDot(1, CLASS_ABILITY_CONFIG.blood.decayStackDuration);
                    }
                  }
                  if (Math.random() < 0.3) {
                    const p = new Particle(victim.pos.x, victim.pos.y, '#ef4444', 3, 12, 'AURA');
                   p.vel = Vector.mult(Vector.normalize(Vector.sub(owner.pos, victim.pos)), 8);
                   this.particles.push(p);
                 }
             }
         }
     };

     if (a.type === EntityType.BULLET) handleBulletEffect(a as Bullet, b);
     if (b.type === EntityType.BULLET) handleBulletEffect(b as Bullet, a);

     let sA: number | null = null, sB: number | null = null;
     if (b.type === EntityType.BULLET) sA = (b as Bullet).ownerId; else if (b.type === EntityType.DRONE) sA = (b as Drone).owner.id; else if (b.type === EntityType.MINI_TANK) sA = (b as MiniTank).owner.id; else if (b.type === EntityType.BASE_DEFENSE_DRONE) sA = b.id; else if (b.type === EntityType.PLAYER || b.type === EntityType.ENEMY || b.type === EntityType.ELITE_TANK) sA = b.id;
     if (a.type === EntityType.BULLET) sB = (a as Bullet).ownerId; else if (a.type === EntityType.DRONE) sB = (a as Drone).owner.id; else if (a.type === EntityType.MINI_TANK) sB = (a as MiniTank).owner.id; else if (a.type === EntityType.BASE_DEFENSE_DRONE) sB = a.id; else if (a.type === EntityType.PLAYER || a.type === EntityType.ENEMY || a.type === EntityType.ELITE_TANK) sB = a.id;
     
     const isBodyCollision = a.type !== EntityType.BULLET && b.type !== EntityType.BULLET;
     a.takeDamage(dmgA, sA, isBodyCollision); b.takeDamage(dmgB, sB, isBodyCollision);
     const impactPos = {
         x: a.pos.x * 0.5 + b.pos.x * 0.5,
         y: a.pos.y * 0.5 + b.pos.y * 0.5
     };

     // Upgrade body collision feedback: heavy physical visual debris & spark bursting on collisions!
     if (isBodyCollision && (dmgA > 5 || dmgB > 5)) {
         const maxDmg = Math.max(dmgA, dmgB);
         const particleCount = Math.min(18, Math.floor(maxDmg / 8) + 5);
         for (let i = 0; i < particleCount; i++) {
             const pAngle = Math.random() * Math.PI * 2;
             const pSpeed = Math.random() * 5 + 2;
             const pColor = Math.random() < 0.5 ? a.color : b.color;
             const pSize = Math.random() * 3 + 1.5;
             const p = new Particle(impactPos.x, impactPos.y, pColor, pSize, 18 + Math.random() * 12);
             p.vel = { x: Math.cos(pAngle) * pSpeed, y: Math.sin(pAngle) * pSpeed };
             this.particles.push(p);
         }
     }

     if (dmgA > 1 && a.type !== EntityType.GUARDIAN && a.type !== EntityType.BULLET) this.spawnDamageText(a.pos, dmgA, a.id);
     if (dmgB > 1 && b.type !== EntityType.GUARDIAN && b.type !== EntityType.BULLET) this.spawnDamageText(b.pos, dmgB, b.id);
     
     if (a.type === EntityType.BULLET || b.type === EntityType.BULLET || a.type === EntityType.DRONE || b.type === EntityType.DRONE || a.type === EntityType.MINI_TANK || b.type === EntityType.MINI_TANK || a.type === EntityType.BASE_DEFENSE_DRONE || b.type === EntityType.BASE_DEFENSE_DRONE) { 
        this.sound.playHit(this.getAudioSpatialOptions(impactPos, a.type === EntityType.PLAYER || b.type === EntityType.PLAYER)); 
     }
     
     if (this.sandboxConfig.knockbackEnabled) { 
        const baseKb = 2.0; 
        if ((a.type === EntityType.BULLET || a.type === EntityType.DRONE || a.type === EntityType.MINI_TANK || a.type === EntityType.BASE_DEFENSE_DRONE) && b.type !== EntityType.BULLET && b.type !== EntityType.DUMMY) { 
            const mMult = Math.min(1.0, 35 / b.mass); 
            b.vel = Vector.add(b.vel, Vector.mult(dir, -(baseKb * mMult * (b.type === EntityType.SHAPE ? 0.8 : 1.0)))); 
        } else if ((b.type === EntityType.BULLET || b.type === EntityType.DRONE || b.type === EntityType.MINI_TANK || b.type === EntityType.BASE_DEFENSE_DRONE) && a.type !== EntityType.BULLET && a.type !== EntityType.DUMMY) { 
            const mMult = Math.min(1.0, 35 / a.mass); 
            a.vel = Vector.add(a.vel, Vector.mult(dir, baseKb * mMult * (a.type === EntityType.SHAPE ? 0.8 : 1.0))); 
        } 
     }
     
     if (a.isDead) this.handleDeath(a, b); 
     if (b.isDead) this.handleDeath(b, a);
  }

  spawnDamageText(pos: Vector2, amount: number, entityId: number | null = null) { const val = Math.floor(amount); if (val === 0) return; if (entityId !== null) { const existing = this.floatingTexts?.find(ft => ft.type === 'DAMAGE' && ft.entityId === entityId); if (existing) { existing.stack(val); existing.pos.x = pos.x; existing.pos.y = pos.y - 25; return; } } this.floatingTexts.push(new FloatingText(pos.x, pos.y - 20, val, 'DAMAGE', val > 20 ? 26 : 18, val > 20, entityId)); }
  spawnScoreText(pos: Vector2, amount: number) { this.floatingTexts.push(new FloatingText(pos.x, pos.y - 25, amount, 'SCORE', 22)); }
  spawnParticles(pos: Vector2, color: string, count: number, size: number = 3) { 
    const density = this.settings?.particleDensity ?? 1.0;
    const finalCount = Math.floor(count * density);
    for(let i=0; i<finalCount; i++) this.particles.push(new Particle(pos.x, pos.y, color, size + Math.random() * 2)); 
  }

  handleDeath(victim: Entity, killer: Entity) {
      if (victim.type === EntityType.DUMMY) return; 

      if ((victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY) && (victim as Tank).classType) {
          const vTank = victim as Tank;
          if (vTank.classType === TankClass.GUNNER || vTank.classType === TankClass.AUTO_GUNNER) {
              const sparkColor = vTank.classType === TankClass.AUTO_GUNNER ? 'rgba(90,190,255,0.75)' : 'rgba(100,255,130,0.75)';
              for (let s = 0; s < 10; s++) {
                  const p = new Particle(vTank.pos.x, vTank.pos.y, sparkColor, 2 + Math.random() * 2, 12 + Math.random() * 8, 'FLASH');
                  const ang = Math.random() * Math.PI * 2;
                  const mag = 2 + Math.random() * 4;
                  p.vel = { x: Math.cos(ang) * mag, y: Math.sin(ang) * mag };
                  this.particles.push(p);
              }
              this.particles.push(new Particle(vTank.pos.x, vTank.pos.y, sparkColor, vTank.radius * 0.8, 8, 'RING'));
          }
      }

      this.sound.playExplosion(victim.radius > 20, this.getAudioSpatialOptions(victim.pos, victim.radius > 20));
      if (this.isOnScreen(victim.pos)) { this.spawnParticles(victim.pos, victim.color, victim.radius > 20 ? 12 : 6, victim.radius / 5); }

      const resolveTankOwner = (entity: Entity): Tank | null => {
          if (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY) return entity as Tank;
          if (entity.type === EntityType.BULLET) {
              const owner = this.entities?.find(e => e.id === (entity as Bullet).ownerId);
              return owner instanceof Tank ? owner : null;
          }
          if (entity.type === EntityType.DRONE) return (entity as Drone).owner;
          if (entity.type === EntityType.MINI_TANK) return (entity as MiniTank).owner;
          return null;
      };

      const victimOwner =
          victim.type === EntityType.DRONE ? (victim as Drone).owner :
          victim.type === EntityType.MINI_TANK ? (victim as MiniTank).owner :
          null;
      const killerOwner = resolveTankOwner(killer);
      const isFriendlySummonKill =
          !!victimOwner &&
          !!killerOwner &&
          (killerOwner.id === victimOwner.id || (victimOwner.team !== Team.NONE && killerOwner.team === victimOwner.team));
      
      let wasPlayerKill = false;
      if (killer.id === this.player.id) wasPlayerKill = true;
      else if (killer.type === EntityType.BULLET && (killer as Bullet).ownerId === this.player.id) wasPlayerKill = true;
      else if (killer.type === EntityType.DRONE && (killer as Drone).owner.id === this.player.id) wasPlayerKill = true;
      else if (killer.type === EntityType.MINI_TANK && (killer as MiniTank).owner.id === this.player.id) wasPlayerKill = true;

      if (victim.type === EntityType.ELITE_TANK) {
          const v = victim as EliteTank; 
          this.addNotification(`${v.name.toUpperCase()} DEFEATED!`, "#ff4444");
          if (wasPlayerKill) {
              this.eliteKills++;
              this.eliteSkinsKilled.add(v.classTypeOriginal);
          }
          
          let totalDmg = 0;
          v.damageDealtBy.forEach(val => totalDmg += val);
          
          if (totalDmg > 0) {
              const basePool = Vector.randomRange(50000, 100000);
              v.damageDealtBy.forEach((dmg, id) => {
                  const contrib = dmg / totalDmg;
                  // MINIMUM CONTRIBUTION THRESHOLD: 2%
                  if (contrib < 0.02) return;

                  const tank = this.entities?.find(e => e.id === id) as Tank | undefined;
                  if (tank) {
                      const xpReward = Math.floor(basePool * contrib);
                      if (xpReward > 0) {
                          this.awardXP(tank, xpReward); 
                          if (tank === this.player) this.spawnScoreText(tank.pos, xpReward);
                      }
                      
                      // Bonus rolls for high contributors (>15%)
                      if (contrib > 0.15) {
                          const roll = Math.random(); 
                          if (roll < 0.1) this.addNotification("LEGENDARY SIGNAL DETECTED!", "#ff5e00"); 
                          else if (roll < 0.3) { 
                              tank.activeBuffs.push({ type: 'POWER_TOKEN', timeLeft: 300, totalTime: 300 }); 
                              tank.updateStats(); 
                          } else if (roll < 0.6) {
                              tank.activeBuffs.push({ type: 'XP_MULT', timeLeft: 600, totalTime: 600 });
                          }
                      }
                  }
              });
          }
      }
      if (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY || victim.type === EntityType.BOSS || victim.type === EntityType.ELITE_TANK) {
            if (wasPlayerKill && victim.id !== this.player.id) this.kills++;
            if (victim === this.player && this.settings.shakeEnabled) {
                this.shakeAmount += 25 * this.settings.shakeIntensity;
            } else if (this.isOnScreen(victim.pos) && this.settings.shakeEnabled) {
                const dist = Vector.dist(victim.pos, this.player.pos);
                const strength = Math.max(0, 1 - dist / 2000) * 15;
                this.shakeAmount += strength * this.settings.shakeIntensity;
            }

            let killerName = killer.name;
            if (killer.type === EntityType.BULLET) { const owner = this.entities?.find(e => e.id === (killer as Bullet).ownerId); killerName = owner ? owner.name : "Unknown"; }
            else if (killer.type === EntityType.DRONE) killerName = (killer as Drone).owner.name;
            else if (killer.type === EntityType.MINI_TANK) killerName = `${(killer as MiniTank).owner.name}'s Unit`;
            this.addToKillFeed(killerName || 'Unknown', victim.name || 'Unknown');
      }
      if (victim.type === EntityType.SHAPE || victim.type === EntityType.BOSS) {
          const v = victim as (Shape | Boss);
          const totalXp = victim.type === EntityType.SHAPE ? (v as Shape).xpValue : (v as Boss).xpValue;
          let totalDmg = 0; 
          v.damageDealtBy.forEach(val => totalDmg += val);
          
          if (totalDmg > 0) {
              v.damageDealtBy.forEach((dmg, id) => {
                  const contrib = dmg / totalDmg;
                  // MINIMUM CONTRIBUTION THRESHOLD: 2%
                  // This prevents "sniping" or accidental tags from getting significant shared rewards.
                  if (contrib < 0.02) return;

                  const tank = this.entities?.find(e => e.id === id) as Tank | undefined;
                  if (tank) { 
                      const share = Math.floor(totalXp * contrib); 
                      if (share > 0) { 
                          this.awardXP(tank, share); 
                          if (tank === this.player) this.spawnScoreText(victim.pos, share); 
                      } 
                  }
              });
              return; 
          }
      }
      const killerTank: Tank | null = killerOwner;
      if (
          killerTank &&
          killerTank.id === this.player.id &&
          (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY)
      ) {
          const now = Date.now();
          const alliesInNeed = this.entities.filter(e =>
              (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) &&
              e.id !== this.player.id &&
              !e.isDead &&
              e.team === this.player.team &&
              (e as Tank).health / Math.max(1, (e as Tank).maxHealth) < 0.45 &&
              Vector.dist(e.pos, victim.pos) < 420
          ) as Tank[];
          alliesInNeed.forEach(ally => { ally.savedByPlayerUntil = now + 1800; });
      }
      if (killerTank && !isFriendlySummonKill) {
          const xp = (victim.type === EntityType.ENEMY || victim.type === EntityType.PLAYER) ? ((victim as Tank).score / 2 || 500) : 10;
          this.awardXP(killerTank, xp); if (killerTank === this.player) this.spawnScoreText(victim.pos, xp);
      }
  }

  addToKillFeed(k: string, v: string) { this.killFeed.unshift({ id: `${Date.now()}-${Math.random()}`, killerName: k, victimName: v, timestamp: Date.now() }); if (this.killFeed.length > 6) this.killFeed.pop(); }
  getLevelXp(l: number) { return Math.floor(100 * Math.pow(XP_CURVE_MULTIPLIER, l - 1)); }
  upgradeStat(t: Tank, s: StatType) {
      const current = t.universalUpgrades[s] ?? t.stats[s] ?? 0;
      if (t.availableStatPoints > 0 && current < 8) {
          const nextVal = current + 1;
          t.universalUpgrades = { ...t.universalUpgrades, [s]: nextVal };
          t.stats = { ...t.stats, [s]: nextVal };
          t.availableStatPoints--;
          this.statRevision++;
          t.updateStats();
          if (t.id === this.player.id) this.sound.playStatUpgrade();
      }
  }
  upgradeClass(nc: TankClass) {
      if (this.playerState === PlayerState.BOSS_SELECTION) {
          this.completeRebirth(nc);
          return;
      }
      this.upgradeClassForTank(this.player, nc);
      this.sound.playClassUpgrade();
  }
  private adaptClassUpgradesForSwitch(tank: Tank, fromClass: TankClass, toClass: TankClass) {
      const fromRestoration = tank.isPacifist(fromClass);
      const fromBlood = tank.isDraining(fromClass);
      const toRestoration = tank.isPacifist(toClass);
      const toBlood = tank.isDraining(toClass);
      const fromStandard = !fromRestoration && !fromBlood;
      const toStandard = !toRestoration && !toBlood;
      tank.lastUpgradeRemapSummary = [];

      if ((fromRestoration && toRestoration) || (fromBlood && toBlood) || (fromStandard && toStandard)) return;

      const remapPairs: Array<{ from: StatType; to: StatType; scale: number; label: string }> = [];
      if (fromStandard && toRestoration) {
          remapPairs.push(
              { from: StatType.BULLET_PENETRATION, to: StatType.HEALING_RADIUS, scale: 1.0, label: 'Penetration -> Healing Radius' },
              { from: StatType.BULLET_DAMAGE, to: StatType.HEALING_EFFICIENCY, scale: 1.0, label: 'Bullet Damage -> Healing Efficiency' },
              { from: StatType.RELOAD, to: StatType.HEALING_BURST, scale: 1.0, label: 'Reload -> Healing Burst' },
              { from: StatType.BULLET_SPEED, to: StatType.SUPPORT_XP_MULT, scale: 0.75, label: 'Bullet Speed -> Support XP' }
          );
      } else if (fromStandard && toBlood) {
          remapPairs.push(
              { from: StatType.BULLET_PENETRATION, to: StatType.DRAIN_RADIUS, scale: 1.0, label: 'Penetration -> Drain Radius' },
              { from: StatType.BULLET_DAMAGE, to: StatType.DRAIN_EFFICIENCY, scale: 1.0, label: 'Bullet Damage -> Drain Efficiency' },
              { from: StatType.RELOAD, to: StatType.DRAIN_BURST, scale: 1.0, label: 'Reload -> Decay Burst' },
              { from: StatType.BODY_DAMAGE, to: StatType.DRAIN_LIFESTEAL, scale: 0.75, label: 'Body Damage -> Lifesteal' }
          );
      } else if (fromRestoration && toStandard) {
          remapPairs.push(
              { from: StatType.HEALING_RADIUS, to: StatType.BULLET_PENETRATION, scale: 1.0, label: 'Healing Radius -> Penetration' },
              { from: StatType.HEALING_EFFICIENCY, to: StatType.BULLET_DAMAGE, scale: 1.0, label: 'Healing Efficiency -> Bullet Damage' },
              { from: StatType.HEALING_BURST, to: StatType.RELOAD, scale: 1.0, label: 'Healing Burst -> Reload' },
              { from: StatType.SUPPORT_XP_MULT, to: StatType.BULLET_SPEED, scale: 0.75, label: 'Support XP -> Bullet Speed' }
          );
      } else if (fromBlood && toStandard) {
          remapPairs.push(
              { from: StatType.DRAIN_RADIUS, to: StatType.BULLET_PENETRATION, scale: 1.0, label: 'Drain Radius -> Penetration' },
              { from: StatType.DRAIN_EFFICIENCY, to: StatType.BULLET_DAMAGE, scale: 1.0, label: 'Drain Efficiency -> Bullet Damage' },
              { from: StatType.DRAIN_BURST, to: StatType.RELOAD, scale: 1.0, label: 'Decay Burst -> Reload' },
              { from: StatType.DRAIN_LIFESTEAL, to: StatType.BODY_DAMAGE, scale: 0.75, label: 'Lifesteal -> Body Damage' }
          );
      } else if (fromRestoration && toBlood) {
          remapPairs.push(
              { from: StatType.HEALING_RADIUS, to: StatType.DRAIN_RADIUS, scale: 1.0, label: 'Radius -> Drain Radius' },
              { from: StatType.HEALING_EFFICIENCY, to: StatType.DRAIN_EFFICIENCY, scale: 1.0, label: 'Efficiency -> Drain Efficiency' },
              { from: StatType.HEALING_BURST, to: StatType.DRAIN_BURST, scale: 1.0, label: 'Burst -> Decay Burst' },
              { from: StatType.SUPPORT_XP_MULT, to: StatType.DRAIN_LIFESTEAL, scale: 0.75, label: 'Support -> Lifesteal' }
          );
      } else if (fromBlood && toRestoration) {
          remapPairs.push(
              { from: StatType.DRAIN_RADIUS, to: StatType.HEALING_RADIUS, scale: 1.0, label: 'Drain Radius -> Healing Radius' },
              { from: StatType.DRAIN_EFFICIENCY, to: StatType.HEALING_EFFICIENCY, scale: 1.0, label: 'Drain Efficiency -> Healing Efficiency' },
              { from: StatType.DRAIN_BURST, to: StatType.HEALING_BURST, scale: 1.0, label: 'Decay Burst -> Healing Burst' },
              { from: StatType.DRAIN_LIFESTEAL, to: StatType.SUPPORT_XP_MULT, scale: 0.75, label: 'Lifesteal -> Support' }
          );
      }

      for (const pair of remapPairs) {
          const srcPoints = tank.universalUpgrades[pair.from] ?? tank.stats[pair.from] ?? 0;
          if (srcPoints <= 0) continue;
          const mapped = Math.max(1, Math.min(8, Math.round(srcPoints * pair.scale)));
          const prev = tank.universalUpgrades[pair.to] ?? tank.stats[pair.to] ?? 0;
          if (mapped > prev) {
              tank.universalUpgrades[pair.to] = mapped;
              tank.stats[pair.to] = mapped;
              tank.lastUpgradeRemapSummary.push(`${pair.label} [${prev}->${mapped}]`);
          }
          tank.inactiveUpgradeBank[pair.from] = srcPoints;
      }
  }
  upgradeClassForTank(tank: Tank, newClass: TankClass) {
      const oldClass = tank.classType;

      // Purge spawned summons on class transition to prevent orphan-based progression exploits.
      const removedSummons: Entity[] = [];
      this.entities = this.entities.filter(e => {
          if ((e.type === EntityType.DRONE || e.type === EntityType.MINI_TANK) && (e as Drone | MiniTank).owner.id === tank.id) {
              removedSummons.push(e);
              return false;
          }
          return true;
      });
      for (const summon of removedSummons) {
          if (this.isOnScreen(summon.pos)) {
              for (let i = 0; i < 4; i++) {
                  const p = new Particle(summon.pos.x, summon.pos.y, 'rgba(140,220,255,0.45)', 3 + Math.random() * 2, 10 + Math.random() * 7, 'FLASH');
                  const ang = Math.random() * Math.PI * 2;
                  const spd = 1.2 + Math.random() * 2.5;
                  p.vel = { x: Math.cos(ang) * spd, y: Math.sin(ang) * spd };
                  this.particles.push(p);
              }
              this.particles.push(new Particle(summon.pos.x, summon.pos.y, 'rgba(110,190,255,0.35)', 8, 8, 'RING'));
          }
      }

      this.adaptClassUpgradesForSwitch(tank, oldClass, newClass);
      tank.classType = newClass; tank.barrels = TANK_CONFIGS[newClass];
      tank.barrelCooldowns = new Array(tank.barrels.length).fill(0);
      tank.barrelMaxCooldowns = new Array(tank.barrels.length).fill(100);
      tank.barrelHeat = new Array(tank.barrels.length).fill(0);
      tank.barrelRecoilOffsets = new Array(tank.barrels.length).fill(0);
      tank.machineHeat = 0;
      tank.machineSpin = 0;
      tank.nextBarrelIndex = 0;
      
      tank.updateStats(); // Ensure aura radii and other constants are calculated immediately
      
      const isBoss = this.isBossClass(newClass);
      if (isBoss && tank === this.player) {
          tank.color = '#9f76fc'; // Purple for commanders
      }
      
      const baseReloadMs = (BASE_STATS.reload - (tank.stats[StatType.RELOAD] * 2.5)) * 16.67;

      const continuousFireClasses = [
          TankClass.TWIN, TankClass.TRIPLE_SHOT, TankClass.QUAD_TANK, TankClass.OCTO_TANK, 
          TankClass.TRIPLE_TANK, TankClass.PENTA_SHOT, TankClass.GUNNER, TankClass.AUTO_GUNNER, 
          TankClass.STREAMLINER, TankClass.SPREAD_SHOT
          // HUNTER and X_HUNTER removed to synchronize cooldowns for nested stacked blasts
      ];
      
      if (continuousFireClasses.includes(newClass)) {
          tank.barrels.forEach((barrel, i) => {
              const delayMultiplier = barrel[4];
              const totalReload = baseReloadMs * delayMultiplier;
              tank.barrelCooldowns[i] = (i / tank.barrels.length) * totalReload;
              tank.barrelMaxCooldowns[i] = totalReload;
          });
      }
      this.statRevision++;

      if (tank === this.player && tank.lastUpgradeRemapSummary.length > 0) {
          this.addNotification("UPGRADES ADAPTED", "#22d3ee");
          this.addNotification(`${tank.lastUpgradeRemapSummary.length} CONVERSIONS APPLIED`, "#14b8a6");
      }
  }

  draw() {
    if (!this.ctx) return;
    this.updateViewportCache();
    this.ctx.fillStyle = this.inVoid ? COLORS.voidBackground : (this.darkMode ? '#0f0f0f' : '#b4b4b4'); this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight); 
    this.ctx.save();
    
    // Apply Screenshake
    if (this.shakeAmount > 0.1 && this.settings.shakeEnabled) {
        const sx = (Math.random() - 0.5) * this.shakeAmount;
        const sy = (Math.random() - 0.5) * this.shakeAmount;
        this.ctx.translate(sx, sy);
        this.shakeAmount *= 0.9;
    } else {
        this.shakeAmount = 0;
    }

    this.ctx.translate(window.innerWidth / 2, window.innerHeight / 2); this.ctx.scale(this.cameraZoom, this.cameraZoom); this.ctx.translate(-this.cameraPos.x, -this.cameraPos.y);
    this.drawGrid(this.ctx); 
    this.ctx.strokeStyle = '#555'; this.ctx.lineWidth = 10; this.ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const visibleEntities = this.visibleEntitiesBuffer;
    visibleEntities.length = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (this.isOnScreen(e.pos, e.radius)) visibleEntities.push(e);
    }
    visibleEntities.sort((a, b) => {
      const ao = this.renderOrder[a.type] ?? 0;
      const bo = this.renderOrder[b.type] ?? 0;
      if (ao !== bo) return ao - bo;
      const adx = a.pos.x - this.cameraPos.x;
      const ady = a.pos.y - this.cameraPos.y;
      const bdx = b.pos.x - this.cameraPos.x;
      const bdy = b.pos.y - this.cameraPos.y;
      return (bdx * bdx + bdy * bdy) - (adx * adx + ady * ady);
    });
    for (let i = 0; i < visibleEntities.length; i++) visibleEntities[i].draw(this.ctx);
    this.drawTankStatusOverlays(this.ctx, visibleEntities);

    const maxParticlesDrawn = this.inVoid ? 1200 : 1600;
    let drawnParticles = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!this.isOnScreen(p.pos, p.size)) continue;
      p.draw(this.ctx);
      drawnParticles++;
      if (drawnParticles >= maxParticlesDrawn) break;
    }
    this.floatingTexts.forEach(ft => ft.draw(this.ctx)); 
    if (this.inVoid) this.drawDarkness(this.ctx);
    if (this.isRebirthing) this.drawRebirthArea(this.ctx);
    this.ctx.restore();
    if (this.transitionAlpha > 0) { this.ctx.fillStyle = `rgba(0, 0, 0, ${this.transitionAlpha})`; this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight); }
  }

  private drawTankStatusOverlays(ctx: CanvasRenderingContext2D, visibleEntities: Entity[]) {
      const now = Date.now();
      let hasVisibleTank = false;
      for (let i = 0; i < visibleEntities.length; i++) {
          const e = visibleEntities[i];
          if (e instanceof Tank && !e.isDead) {
              hasVisibleTank = true;
              break;
          }
      }
      if (!hasVisibleTank) return;

      const drawBadge = (x: number, y: number, text: string, fill: string, border: string) => {
          ctx.save();
          ctx.font = 'bold 9px Ubuntu';
          const padX = 7;
          const w = ctx.measureText(text).width + padX * 2;
          const h = 14;
          const rx = x - w / 2;
          const ry = y - h;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = fill;
          ctx.strokeStyle = border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(rx, ry, w, h, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, x, ry + h / 2 + 0.25);
          ctx.restore();
      };

      for (let i = 0; i < visibleEntities.length; i++) {
          const tank = visibleEntities[i];
          if (!(tank instanceof Tank) || tank.isDead) continue;
          if (tank.fxHealing || tank.regenOverchargeTimer > 0) {
              const pulse = 0.4 + Math.sin(now * 0.012 + tank.id) * 0.2;
              const radius = tank.radius * (1.25 + pulse);
              const grad = ctx.createRadialGradient(tank.pos.x, tank.pos.y, tank.radius * 0.25, tank.pos.x, tank.pos.y, radius);
              grad.addColorStop(0, 'rgba(34,197,94,0.14)');
              grad.addColorStop(1, 'rgba(34,197,94,0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(tank.pos.x, tank.pos.y, radius, 0, Math.PI * 2);
              ctx.fill();
              drawBadge(tank.pos.x, tank.pos.y - tank.radius - 18, '+ Regeneration', 'rgba(22, 163, 74, 0.5)', 'rgba(134, 239, 172, 0.9)');
          }

          if (tank.fxDraining || tank.drainDotTimer > 0) {
              const pulse = 0.35 + Math.sin(now * 0.015 + tank.id) * 0.22;
              const radius = tank.radius * (1.35 + pulse);
              const grad = ctx.createRadialGradient(tank.pos.x, tank.pos.y, tank.radius * 0.2, tank.pos.x, tank.pos.y, radius);
              grad.addColorStop(0, 'rgba(220,38,38,0.2)');
              grad.addColorStop(1, 'rgba(220,38,38,0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(tank.pos.x, tank.pos.y, radius, 0, Math.PI * 2);
              ctx.fill();
              drawBadge(tank.pos.x, tank.pos.y - tank.radius - 34, '- Drain', 'rgba(127, 29, 29, 0.58)', 'rgba(252, 165, 165, 0.95)');
          }
      }
  }

  private drawDarkness(ctx: CanvasRenderingContext2D) {
      if (this.lightingCanvas.width !== this.lastViewportWidth || this.lightingCanvas.height !== this.lastViewportHeight) {
          this.lightingCanvas.width = this.lastViewportWidth;
          this.lightingCanvas.height = this.lastViewportHeight;
      }
      this.lightingCtx.clearRect(0, 0, this.lastViewportWidth, this.lastViewportHeight);
      this.lightingCtx.fillStyle = 'rgba(0, 0, 0, 0.96)';
      this.lightingCtx.fillRect(0, 0, this.lastViewportWidth, this.lastViewportHeight);
      this.lightingCtx.globalCompositeOperation = 'destination-out';
      const maxLights = 80;
      let lightsDrawn = 0;
      for (const e of this.entities) {
          if (lightsDrawn >= maxLights) break;
          if (!this.isOnScreen(e.pos, 500)) continue;
          if (e.type !== EntityType.PLAYER && e.type !== EntityType.ENEMY && e.type !== EntityType.BOSS && e.type !== EntityType.ELITE_TANK) continue;
          const sx = (e.pos.x - this.cameraPos.x) * this.cameraZoom + this.lastViewportWidth / 2;
          const sy = (e.pos.y - this.cameraPos.y) * this.cameraZoom + this.lastViewportHeight / 2;
          const radius = (e.type === EntityType.PLAYER ? 300 : 100) * this.cameraZoom;
          const grad = this.lightingCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
          grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          this.lightingCtx.fillStyle = grad;
          this.lightingCtx.beginPath();
          this.lightingCtx.arc(sx, sy, radius, 0, Math.PI * 2);
          this.lightingCtx.fill();
          lightsDrawn++;
      }
      this.lightingCtx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.lightingCanvas, 0, 0);
  }

  drawGrid(ctx: CanvasRenderingContext2D) {
      const viewW = window.innerWidth / this.cameraZoom, viewH = window.innerHeight / this.cameraZoom;
      const startX = Math.max(0, Math.floor((this.cameraPos.x - viewW/2) / GRID_SIZE) * GRID_SIZE), endX = Math.min(CANVAS_WIDTH, Math.ceil((this.cameraPos.x + viewW/2) / GRID_SIZE) * GRID_SIZE);
      const startY = Math.max(0, Math.floor((this.cameraPos.y - viewH/2) / GRID_SIZE) * GRID_SIZE), endY = Math.min(CANVAS_HEIGHT, Math.ceil((this.cameraPos.y + viewH/2) / GRID_SIZE) * GRID_SIZE);
      
      if (this.gameMode === GameMode.TEAMS && !this.inVoid) {
          this.drawTeamSafeZones(ctx);
      }

      ctx.strokeStyle = this.inVoid ? '#151515' : (this.darkMode ? '#222222' : COLORS.background); ctx.lineWidth = 1; ctx.beginPath();
      for (let x = startX; x <= endX; x += GRID_SIZE) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
      for (let y = startY; y <= endY; y += GRID_SIZE) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
      ctx.stroke();
  }

  private drawTeamSafeZones(ctx: CanvasRenderingContext2D) {
      const phase = Date.now() * 0.0035;
      const pulse = 0.55 + Math.sin(phase) * 0.45;
      const stripeOffset = (Date.now() * 0.08) % 42;

      const drawZone = (team: Team, x: number, w: number, borderX: number, facing: 1 | -1) => {
          const baseColor = team === Team.BLUE ? `34,211,238` : `251,113,133`;
          const fieldAlpha = 0.06 + pulse * 0.05;
          const lineAlpha = 0.18 + pulse * 0.12;

          ctx.save();
          ctx.fillStyle = `rgba(${baseColor},${fieldAlpha})`;
          ctx.fillRect(x, 0, w, CANVAS_HEIGHT);

          const gridGap = 90;
          ctx.strokeStyle = `rgba(${baseColor},${lineAlpha})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          for (let gy = (stripeOffset % gridGap) - gridGap; gy < CANVAS_HEIGHT + gridGap; gy += gridGap) {
              ctx.moveTo(x, gy);
              ctx.lineTo(x + w, gy + facing * 28);
          }
          ctx.stroke();

          ctx.strokeStyle = `rgba(${baseColor},${0.4 + pulse * 0.25})`;
          ctx.shadowColor = `rgba(${baseColor},0.6)`;
          ctx.shadowBlur = 16;
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 10]);
          ctx.lineDashOffset = -stripeOffset * facing;
          ctx.beginPath();
          ctx.moveTo(borderX, 0);
          ctx.lineTo(borderX, CANVAS_HEIGHT);
          ctx.stroke();
          ctx.setLineDash([]);

          const glow = ctx.createLinearGradient(borderX - facing * 120, 0, borderX + facing * 120, 0);
          glow.addColorStop(0, `rgba(${baseColor},0)`);
          glow.addColorStop(0.5, `rgba(${baseColor},${0.2 + pulse * 0.15})`);
          glow.addColorStop(1, `rgba(${baseColor},0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(borderX - facing * 120, 0, facing * 120, CANVAS_HEIGHT);
          ctx.restore();
      };

      drawZone(Team.BLUE, 0, BASE_ZONE_WIDTH, BASE_ZONE_WIDTH, 1);
      drawZone(Team.RED, CANVAS_WIDTH - BASE_ZONE_WIDTH, BASE_ZONE_WIDTH, CANVAS_WIDTH - BASE_ZONE_WIDTH, -1);
  }

  private drawRebirthArea(ctx: CanvasRenderingContext2D) {
      const pos = REBIRTH_AREA_POS;
      const size = REBIRTH_AREA_SIZE;

      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = '#ffbb00';
      ctx.lineWidth = 10;
      ctx.stroke();

      // Draw options
      this.rebirthOptions.forEach(opt => {
          ctx.save();
          ctx.translate(opt.pos.x, opt.pos.y);
          
          // Draw preview icon (spinning tank)
          ctx.rotate(opt.rotation);
          
          // Create a dummy tank for preview
          const previewTank = new Tank(0, opt.pos.x, opt.pos.y, true, Team.BLUE);
          previewTank.classType = opt.classType;
          previewTank.rotation = opt.rotation;
          previewTank.drawBody(ctx);
          
          ctx.restore();

          // Draw name and description
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 30px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(opt.classType, opt.pos.x, opt.pos.y + 150);
          
          ctx.font = '16px Arial';
          let desc = "";
          if (opt.classType === TankClass.COLOSSAL) desc = "Massive health, auto-turrets, slow speed.";
          if (opt.classType === TankClass.LEVIATHAN) desc = "Shockwave ability, high damage, large size.";
          if (opt.classType === TankClass.WARLORD) desc = "Repair drones, siege mode, high defense.";
          ctx.fillText(desc, opt.pos.x, opt.pos.y + 180);
      });
  }
}
