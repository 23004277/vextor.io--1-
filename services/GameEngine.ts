import { EntityType, GameState, KillFeedEntry, ShapeType, StatType, TankClass, Vector2, LeaderboardEntry, Team, GameMode, UINotification, ShapeRarity, BuffEffect, MinimapMarker, SandboxConfig, GameSettings, AIState, PlayerState, DominionZoneState, SecondarySector, BotChatBubble, BotChatCategory, DeathPresentationState, DeathKillerSnapshot } from '../types';
import { BASE_STATS, BOSS_STATS, CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, GRID_SIZE, STAT_COLORS, TANK_CONFIGS, XP_CURVE_MULTIPLIER, MAX_LEVEL, CLASS_TREE, BASE_ZONE_WIDTH, SHAPE_STATS, RARITY_CONFIG, VOID_RARITY_CONFIG, BOT_NAMES, BOT_STAT_PRIORITIES, REBIRTH_LEVEL, REBIRTH_AREA_POS, REBIRTH_AREA_SIZE, SAFE_ZONE_WARNING_RADIUS, SAFE_ZONE_ENGAGEMENT_RADIUS, SAFE_ZONE_DRONE_SCAN_INTERVAL_MS, SAFE_ZONE_DEFENSE_DRONES_PER_TEAM, CLASS_PROJECTILE_MODIFIERS, CLASS_ABILITY_CONFIG, SHOP_ITEMS, getShapeRarityTable, SECONDARY_SECTOR_OPTIONS } from '../constants';
import * as Vector from './MathUtils';
import { SoundEngine } from './SoundEngine';
import type { AudioSpatialOptions } from './SoundEngine';
import { EnemyAITanks } from './EnemyAITanks';
import { AISystem } from './systems/AISystem';
import { TDMAISystem, type Player as TDMPlayer } from '../systems/TDM-ai';
import { BossRushMode } from './bossRush/BossRushMode';
import { BOSS_RUSH_ARENA, type BossRushBossDefinition } from './bossRush/BossRushTypes';

// Define FloatingTextType for type safety
type FloatingTextType = 'DAMAGE' | 'SCORE';
type SpawnZone = { x: number; y: number; w: number; h: number; cx: number; cy: number };
type VoidPortalPhase = 'BLACK_HOLE' | 'WHITE_HOLE' | 'EXPANDING';
type VoidTransitStage = 'LOCK' | 'INVERT' | 'BREACH' | 'SHIFT' | 'EXTRACT';
type PendingDimensionTransition = {
    toVoid: boolean;
    transitEntityIds: number[];
    phase: 'FADE_OUT' | 'FADE_IN';
    timer: number;
};
type DonorRank = 'standard' | 'rank1' | 'rank2' | 'rank3';
type Hsl = { h: number; s: number; l: number };
type SkinModifier = { hueShift: number; saturationMult: number; lightnessOffset: number };
type SkinExtras = {
    outlineGlow?: boolean;
    glowIntensity?: number;
    barrelSkin?: string | null;
    bulletTrail?: string | null;
    deathEffect?: string | null;
};
type SkinDefinition = { id: string; modifier: SkinModifier; extras?: SkinExtras };
type DominionZoneDef = {
    id: number;
    pos: Vector2;
    radius: number;
    tankId: number | null;
    owner: Team;
    contested: boolean;
};

type DominionWeaponProfile = 'DESTROYER' | 'GUNNER' | 'TRAPPER' | 'TRIPLE';
type ActiveBotChat = {
    id: string;
    botId: number;
    name: string;
    classType: TankClass;
    team: Team;
    category: BotChatCategory;
    text: string;
    createdAt: number;
    typingUntil: number;
    visibleUntil: number;
    expiresAt: number;
    words: string[];
    wordDelayMs: number;
    lastBlipWordCount: number;
    onScreen: boolean;
    worldPos: Vector2;
    accentColor: string;
    persistAfterDeath: boolean;
};
type PlayerDeathPresentation = {
    mode: 'instant' | 'taunt';
    startedAt: number;
    overlayAt: number;
    completeAt: number;
    fadeSeconds: number;
    killerBotId: number | null;
    killerEntityId: number | null;
    killerSpectateTargetId: number | null;
};

type PlayerDeathKillerRef = {
    killerEntityId: number | null;
    killerSpectateTargetId: number | null;
    fallbackName: string;
    fallbackTeam: Team;
    fallbackClassType: TankClass | null;
    fallbackLevel: number | null;
};

const DOMINION_TANK_MAX_HEALTH = 30000;
const DOMINION_TANK_RADIUS = 62;
const ELITE_TANK_HEALTH_BASE = 22000;
const ELITE_TANK_HEALTH_PER_LEVEL = 190;
const ELITE_TANK_SHIELD_BASE = 320;
const ELITE_TANK_BASELINE_SPEED = BASE_STATS.speed;
const MAX_ACTIVE_BOT_CHATS = 4;
const BOT_CHAT_BASE_COOLDOWN_MS = 12000;
const BOT_RARE_CHAT_COOLDOWN_MS = 18000;
const BOT_DEATH_TAUNT_GLOBAL_COOLDOWN_MS = 14000;
const BOT_DEATH_TAUNT_TYPING_MS = 1750;
const BOT_DEATH_TAUNT_VISIBLE_MS = 1000;
const BOT_DEATH_TAUNT_DELAY_MS = 3000;
const BOT_DEATH_TAUNT_FADE_MS = 450;

const BOT_CHAT_LINES: Record<BotChatCategory, string[]> = {
    death_taunt: [
        'ez',
        'sit down',
        'bro got recycled',
        'skill issue detected',
        'back to the menu you go',
        'was that your plan?',
        'target deleted',
        'nice try lil bro',
        'you good?',
        'that was personal',
        'command grid says no',
        'arena privileges revoked',
        'respawn and pretend that never happened',
        'bro entered the wrong postcode',
        'your tank warranty just expired',
    ],
    healing_request: [
        'need heals',
        'restore me pls',
        'low hp!',
        'healer, over here',
        "i'm one shot",
        'save me bro',
        'my health bar is cooked',
        'restoration needed',
        "i'm getting folded",
        'heal aura pls',
    ],
    panic: [
        'nah im out',
        'too many angles',
        'abort abort',
        'this lane is cursed',
        'im getting farmed',
    ],
    victory: [
        'clean pick',
        'target folded',
        'thats one less problem',
        'grid secured',
    ],
    rare_random: [
        'systems nominal',
        'who parked that crasher there',
        'this lobby smells like tilt',
        'holding the lane',
        'vextor is watching',
    ],
    low_health: [
        'barely alive',
        'hull critical',
        'one pixel left',
        'not like this',
    ],
};

const BOT_CLASS_CHAT_LINES: Partial<Record<BotChatCategory, Partial<Record<string, string[]>>>> = {
    death_taunt: {
        sniper: [
            'cross-map receipt delivered',
            'held that angle for you',
            'range diff',
            'you walked into the lane',
        ],
        rusher: [
            'ran you down',
            'full send worked',
            'bonk confirmed',
            'too slow',
        ],
        support: [
            'diagnosis complete',
            'support still clears',
            'prescription: respawn',
            'healing denied',
        ],
        boss: [
            'kneel before the grid',
            'your resistance was decorative',
            'the arena chose me',
            'a predictable collapse',
        ],
    },
    healing_request: {
        support: [
            'support needs support',
            'patch me up',
            'restoration on me',
        ],
        sniper: [
            'need heals on backline',
            'cover me, low hull',
        ],
        rusher: [
            'heals now bro',
            'i sent too hard',
        ],
    },
    panic: {
        sniper: [
            'theyre diving backline',
            'too close too close',
        ],
        rusher: [
            'nah this push is cursed',
            'reverse reverse',
        ],
        support: [
            'team where are you',
            'need peel right now',
        ],
    },
    victory: {
        sniper: [
            'clean angle',
            'picked from downtown',
        ],
        rusher: [
            'ran the lobby',
            'thats another one',
        ],
        support: [
            'support diff',
            'stabilised and secured',
        ],
        boss: [
            'your struggle amused me',
            'the grid remains mine',
        ],
    },
    rare_random: {
        sniper: [
            'holding long sightlines',
            'angle secured',
        ],
        rusher: [
            'brain empty throttle full',
            'looking for chaos',
        ],
        support: [
            'staying near the wounded',
            'watching ally vitals',
        ],
        boss: [
            'the arena hums for me',
            'all signals bow inward',
        ],
    },
};

const SKIN_APPLICATION = {
    clamp: {
        saturation: [22, 98] as [number, number],
        lightness: [20, 82] as [number, number],
    },
    blendStrength: {
        standard: 0.52,
        rank1: 0.85,
        rank2: 0.78,
        rank3: 0.72,
    } as Record<DonorRank, number>,
} as const;

const PLAYABLE_TEAMS: Team[] = [Team.BLUE, Team.RED, Team.GREEN, Team.PURPLE];

function isPlayableTeam(team: Team): boolean {
    return team === Team.BLUE || team === Team.RED || team === Team.GREEN || team === Team.PURPLE;
}

function getTeamColor(team: Team): string {
    if (team === Team.BLUE) return COLORS.player;
    if (team === Team.RED) return COLORS.enemy;
    if (team === Team.GREEN) return COLORS.allyGreen;
    if (team === Team.PURPLE) return COLORS.allyPurple;
    return COLORS.dominionNeutral;
}

function getTeamRgb(team: Team): string {
    if (team === Team.BLUE) return '56, 189, 248';
    if (team === Team.RED) return '248, 113, 113';
    if (team === Team.GREEN) return '52, 211, 153';
    if (team === Team.PURPLE) return '167, 139, 250';
    return '250, 204, 21';
}

function isTrapperBranchClass(classType: TankClass): boolean {
    return classType === TankClass.TRAPPER ||
        classType === TankClass.DUAL_TRAPPER ||
        classType === TankClass.MACHINE_GUN_TRAPPER ||
        classType === TankClass.OCTO_TRAPPER ||
        classType === TankClass.TRIPLE_TRAPPER;
}

function clampNum(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function wrapHue(h: number): number {
    let hue = h % 360;
    if (hue < 0) hue += 360;
    return hue;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '').trim();
    const normalized = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
    const num = parseInt(normalized, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    let h = 0;
    if (delta > 0) {
        if (max === rn) h = ((gn - bn) / delta) % 6;
        else if (max === gn) h = (bn - rn) / delta + 2;
        else h = (rn - gn) / delta + 4;
        h *= 60;
    }
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    return { h: wrapHue(h), s: s * 100, l: l * 100 };
}

function hslToCss(hsl: Hsl): string {
    return `hsl(${wrapHue(hsl.h)} ${clampNum(hsl.s, 0, 100).toFixed(1)}% ${clampNum(hsl.l, 0, 100).toFixed(1)}%)`;
}

function shortestHueDelta(from: number, to: number): number {
    let d = wrapHue(to) - wrapHue(from);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

function teamBaseHsl(team: Team): Hsl {
    const baseHex = getTeamColor(team === Team.NONE ? Team.BLUE : team);
    const rgb = hexToRgb(baseHex);
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

function getTeamProjectileColor(team: Team): string {
    if (team === Team.NONE) return COLORS.barrel;
    const engine = (window as any).gameEngine as GameEngine | undefined;
    const playerTeam = engine?.player?.team ?? Team.NONE;
    if (isPlayableTeam(playerTeam) && isPlayableTeam(team)) {
        return playerTeam === team ? COLORS.player : COLORS.enemy;
    }
    return getTeamColor(team);
}

function getTeamSummonColor(team: Team): string {
    if (team === Team.NONE) return COLORS.barrel;
    const engine = (window as any).gameEngine as GameEngine | undefined;
    const playerTeam = engine?.player?.team ?? Team.NONE;
    if (isPlayableTeam(playerTeam) && isPlayableTeam(team)) {
        return playerTeam === team ? COLORS.player : COLORS.enemy;
    }
    return getTeamColor(team);
}

function formatCombatTargetLabel(label: string): string {
    return String(label || 'Target')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function formatCombatShapeLabel(rarity: ShapeRarity, label: string): string {
    return formatCombatTargetLabel(`${rarity} ${label}`);
}

function stripInjectedTeamPrefix(name: string): string {
    return name.replace(/^(?:[\*\u25c6\u25cf]\s*)?(?:BLU|BLUE|RED|GREEN|PURPLE)\s+/i, '').trim();
}

function formatDisplayCallsign(name: string, fallback = 'Unknown Unit'): string {
    const stripped = stripInjectedTeamPrefix(String(name || ''));
    const spaced = stripped
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();
    return spaced || fallback;
}

function resolveDamageOwnerId(engine: GameEngine | undefined, sourceId: number | null): number | null {
    if (!engine || sourceId === null) return sourceId;
    const source = engine.entities.find((entity: Entity) => entity.id === sourceId);
    if (!source) return sourceId;
    if (source.type === EntityType.BULLET) return (source as Bullet).ownerId;
    if (source.type === EntityType.DRONE || source.type === EntityType.MINI_TANK) return (source as Drone | MiniTank).owner.id;
    if (source.type === EntityType.PLAYER || source.type === EntityType.ENEMY || source.type === EntityType.ELITE_TANK) return source.id;
    return sourceId;
}

function makeModifierFromHex(base: Hsl, targetHex: string): SkinModifier {
    const rgb = hexToRgb(targetHex);
    const target = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const safeBaseS = Math.max(1, base.s);
    return {
        hueShift: shortestHueDelta(base.h, target.h),
        saturationMult: clampNum(target.s / safeBaseS, 0.45, 2.2),
        lightnessOffset: clampNum(target.l - base.l, -28, 28),
    };
}

const SKINS: SkinDefinition[] = (() => {
    const base = teamBaseHsl(Team.BLUE);
    const built: SkinDefinition[] = [{
        id: 'default',
        modifier: { hueShift: 0, saturationMult: 1, lightnessOffset: 0 },
    }];
    for (const item of SHOP_ITEMS) {
        if (item.type !== 'color') continue;
        built.push({
            id: item.id,
            modifier: makeModifierFromHex(base, item.value),
            extras: item.rarity === 'legendary' || item.rarity === 'elite'
                ? { outlineGlow: true, glowIntensity: 0.35 }
                : undefined,
        });
    }
    return built;
})();

function getWormholeWhitenProgress(phase: VoidPortalPhase, phaseTimerSec: number, expansionCharge: number): number {
    if (phase === 'BLACK_HOLE') return Math.min(0.7, Math.max(0, phaseTimerSec / 60) * 0.7);
    if (phase === 'WHITE_HOLE') return 0.72 + Math.min(0.2, Math.max(0, (phaseTimerSec - 60) / 30) * 0.2);
    return Math.min(1, 0.92 + expansionCharge * 0.08);
}

function getVoidTransitStageLabel(stage: VoidTransitStage | null): string | null {
    if (stage === 'LOCK') return 'Wormhole Lock';
    if (stage === 'INVERT') return 'Core Inversion';
    if (stage === 'BREACH') return 'Breach Window';
    if (stage === 'SHIFT') return 'Dimensional Shift';
    if (stage === 'EXTRACT') return 'Extraction Vector';
    return null;
}

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

function createEmptyStatRecord(): Record<StatType, number> {
    return {
        [StatType.REGEN]: 0,
        [StatType.MAX_HEALTH]: 0,
        [StatType.MAX_SHIELD]: 0,
        [StatType.BODY_DAMAGE]: 0,
        [StatType.BULLET_SPEED]: 0,
        [StatType.BULLET_PENETRATION]: 0,
        [StatType.BULLET_DAMAGE]: 0,
        [StatType.RELOAD]: 0,
        [StatType.MOVEMENT_SPEED]: 0,
        [StatType.BULLET_SPREAD]: 0,
        [StatType.HEALING_RADIUS]: 0,
        [StatType.HEALING_EFFICIENCY]: 0,
        [StatType.HEALING_BURST]: 0,
        [StatType.SUPPORT_XP_MULT]: 0,
        [StatType.DRAIN_RADIUS]: 0,
        [StatType.DRAIN_EFFICIENCY]: 0,
        [StatType.DRAIN_LIFESTEAL]: 0,
        [StatType.DRAIN_BURST]: 0,
    };
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
    glowColor: string;
    panelColor: string;
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
                this.fillColor = '#fff6f6'; 
                this.strokeColor = '#7f1d1d';
                this.glowColor = 'rgba(248, 113, 113, 0.78)';
                this.panelColor = 'rgba(80, 12, 18, 0.34)';
            } else {
                this.fillColor = '#ffffff';
                this.strokeColor = '#111827'; 
                this.glowColor = 'rgba(255, 120, 120, 0.34)';
                this.panelColor = 'rgba(12, 16, 24, 0.26)';
            }
            this.vel = { x: 0, y: -0.3 };
        } else {
            this.maxLife = 60; 
            this.fillColor = '#fff4bf';
            this.strokeColor = '#5b3410';
            this.glowColor = 'rgba(251, 191, 36, 0.64)';
            this.panelColor = 'rgba(64, 34, 8, 0.28)';
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
        const fontSize = this.type === 'DAMAGE' ? this.size : Math.max(this.size, 24);
        ctx.font = `900 ${fontSize}px Ubuntu, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(this.text);
        const textWidth = Math.max(18, metrics.width);
        const panelWidth = textWidth + (this.type === 'DAMAGE' ? 16 : 22);
        const panelHeight = fontSize + (this.type === 'DAMAGE' ? 8 : 10);

        ctx.save();
        ctx.fillStyle = this.panelColor;
        ctx.strokeStyle = this.type === 'DAMAGE' ? 'rgba(255,255,255,0.12)' : 'rgba(251,191,36,0.22)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, this.type === 'DAMAGE' ? 8 : 9);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.lineWidth = this.type === 'DAMAGE' ? 4 : 3.5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.strokeColor;
        ctx.shadowBlur = this.type === 'DAMAGE' ? 18 : 16;
        ctx.shadowColor = this.glowColor;
        ctx.strokeText(this.text, 0, 0);
        ctx.shadowBlur = this.type === 'DAMAGE' ? 22 : 20;
        ctx.shadowColor = this.glowColor;
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
  lastDamageSourceId: number | null = null;

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
    if (this.type !== EntityType.PLAYER && this.type !== EntityType.ENEMY && this.type !== EntityType.ELITE_TANK && this.type !== EntityType.DOMINION_TANK) {
        const squeeze = Math.max(0.7, Math.min(1.3, 2 - this.visualScale));
        ctx.scale(this.visualScale, squeeze);
    }
    
    this.drawBody(ctx);
    ctx.restore();
    if (this.health < this.maxHealth && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL) this.drawHealthBar(ctx);
    if (this.name && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL && this.type !== EntityType.SHAPE) this.drawName(ctx);
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
    const teamTrack = this.team === Team.NONE
      ? '#333'
      : `rgba(${getTeamRgb(this.team)},0.18)`;
    const teamBorder = this.team === Team.NONE
      ? 'rgba(255,255,255,0.18)'
      : `rgba(${getTeamRgb(this.team)},0.45)`;
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

    const maybeTank = this as unknown as Tank;
    if (typeof maybeTank.classType === 'string' && maybeTank.isBossClass?.(maybeTank.classType)) {
        const engine = (window as any).gameEngine as GameEngine | undefined;
        const playerId = engine?.player?.id;
        const contributionMap = maybeTank.damageDealtBy;
        if (playerId != null && contributionMap instanceof Map && contributionMap.size > 0) {
            let totalDamage = 0;
            contributionMap.forEach((value) => { totalDamage += value; });
            const playerDamage = contributionMap.get(playerId) || 0;
            if (totalDamage > 0 && playerDamage > 0) {
                const sharePct = Math.max(1, Math.round((playerDamage / totalDamage) * 100));
                ctx.save();
                ctx.font = 'bold 10px Ubuntu';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(0,0,0,0.72)';
                ctx.fillStyle = '#fbbf24';
                const textY = this.pos.y + yOffset + barHeight + 4;
                const shareText = `Share ${sharePct}%`;
                ctx.strokeText(shareText, this.pos.x, textY);
                ctx.fillText(shareText, this.pos.x, textY);
                ctx.restore();
            }
        }
    }
  }

  drawName(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const teamColor = this.team === Team.NONE ? '#ffffff' : getTeamColor(this.team);
    const engine = (window as any).gameEngine as GameEngine | undefined;
    const perspectiveTeam = engine?.player?.team ?? Team.NONE;
    const perspectiveId = engine?.player?.id ?? -1;
    const isPerspectiveAlly = this.id !== perspectiveId && this.team !== Team.NONE && this.team === perspectiveTeam;
    const classType = (this as any).classType as TankClass | undefined;
    const roleTag = !isPerspectiveAlly || !classType
      ? ''
      : (classType === TankClass.PACIFIST_TRAINEE || classType === TankClass.NURSE || classType === TankClass.DOCTOR || classType === TankClass.PLAGUE_DOCTOR)
        ? 'SUP'
        : (classType === TankClass.DRAINER_TRAINEE || classType === TankClass.LEECH || classType === TankClass.VAMPIRE || classType === TankClass.REAPER)
          ? 'BLD'
          : '';
    const finalAllyHint = isPerspectiveAlly ? `[ALLY${roleTag ? `-${roleTag}` : ''}] ` : '';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px Ubuntu';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const yOffset = -this.radius - 12; 
    ctx.translate(this.pos.x, this.pos.y);
    const renderName = `${finalAllyHint}${formatDisplayCallsign(this.name, 'Unknown Unit')}`;
    ctx.strokeText(renderName, 0, yOffset);
    ctx.fillText(renderName, 0, yOffset);
    const textWidth = ctx.measureText(renderName).width;
    if (this.team !== Team.NONE) {
        ctx.fillStyle = teamColor;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(-(textWidth * 0.5) - 10, yOffset - 7, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-textWidth * 0.5, yOffset + 2, Math.min(54, Math.max(24, textWidth * 0.24)), 2);
    }
    ctx.restore();
  }

  takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
    if (this.invulnerableTime > 0) return;
    const engine = (window as any).gameEngine;

    this.lastDamageTime = Date.now();
    if (sourceId !== null && amount > 0) this.lastDamageSourceId = sourceId;
    if (this.shield > 0) {
        if (engine && this.type === EntityType.PLAYER) engine.sound.playShieldHit();
        
        let pierceAmount = 0;
        if (isBodyDamage) {
            // Body impact should pressure shields, not trivially bypass them.
            // Only the heavier portion of a contact hit can leak through.
            pierceAmount = Math.round(Math.max(0, amount - 24) * 0.08);
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
                sourceTank.applyDrainDot(1, CLASS_ABILITY_CONFIG.blood.decayStackDuration, victimTank.id);
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
    variant: 'BASIC' | 'TWIN';
    cooldown: number = 0;
    targetId: number | null = null;
    orbitAngle: number = 0;
    detectionRadius: number = 500;
    combatOrbitDistance: number = 180;

    constructor(id: number, x: number, y: number, owner: Tank, variant: 'BASIC' | 'TWIN' = 'BASIC') {
        super(id, EntityType.MINI_TANK, x, y, 14, getTeamSummonColor(owner.team));
        this.owner = owner;
        this.variant = variant;
        this.team = owner.team;
        this.friction = 0.94;
        this.mass = owner.classType === TankClass.MANAGER ? 22 : 15;
        this.orbitAngle = Math.random() * Math.PI * 2;
        
        // Stats scaled based on "Drone Health" and "Drone Damage" (Bullet Pen/Dmg)
        const hpFromHost = owner.maxHealth * 0.16;
        const hpBonus = owner.stats[StatType.BULLET_PENETRATION] * 8;
        this.maxHealth = Math.max(28, hpFromHost + hpBonus);
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        
        const dmgBonus = (owner.stats[StatType.BULLET_DAMAGE] * 8);
        this.damage = Math.max(7, (BASE_STATS.bodyDamage * 0.35) + dmgBonus * 0.28);
        if (this.variant === 'TWIN') {
            this.damage *= 0.9;
        }
        
        // SACRIFICIAL GOAT BUFF
        if (owner.isSacrificing) {
            this.damage *= 1.25;
        }
    }

    override update(dt: number) {
        const engine = (window as any).gameEngine;
        if (!engine) return;

        this.cooldown -= dt * 1000;
        const hpRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
        const hpFromHost = this.owner.maxHealth * 0.16;
        const hpBonus = this.owner.stats[StatType.BULLET_PENETRATION] * 8;
        this.maxHealth = Math.max(28, hpFromHost + hpBonus);
        this.health = Math.min(this.maxHealth, Math.max(1, this.maxHealth * hpRatio));
        this.displayHealth = this.health;
        const dmgBonus = this.owner.stats[StatType.BULLET_DAMAGE] * 8;
        this.damage = Math.max(7, (BASE_STATS.bodyDamage * 0.35) + dmgBonus * 0.28) * (this.owner.isSacrificing ? 1.25 : 1.0);
        if (this.variant === 'TWIN') this.damage *= 0.9;

        let targetPos = { x: 0, y: 0 };
        let isCommanded = false;
        
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const worldMouse = {
            x: (engine.mouse.x - viewW/2) / engine.cameraZoom + engine.cameraPos.x,
            y: (engine.mouse.y - viewH/2) / engine.cameraZoom + engine.cameraPos.y
        };

        // COMMAND MODE (CURSOR SWARM)
        if (this.owner.autoFire || engine.mouseDown || this.owner.droneCommandMode === 'REPEL') {
            isCommanded = true;
            const units = engine.entities.filter((e: any) => e.type === EntityType.MINI_TANK && e.owner === this.owner);
            const idx = units.indexOf(this);
            const offsetAngle = (idx / units.length) * Math.PI * 2;
            const mouseOffset = Vector.mult(Vector.fromAngle(offsetAngle), 60);
            const commandMode = this.owner.droneCommandMode;
            if (commandMode === 'REPEL') {
                const away = Vector.normalize(Vector.sub(this.owner.pos, worldMouse));
                targetPos = Vector.add(this.owner.pos, Vector.mult(away, 240 + idx * 8));
            } else if (commandMode === 'SWARM') {
                targetPos = Vector.add(worldMouse, Vector.mult(Vector.fromAngle(offsetAngle + Date.now() * 0.004), 30));
            } else {
                targetPos = Vector.add(worldMouse, mouseOffset);
            }
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
                this.cooldown = this.variant === 'TWIN'
                    ? Math.max(140, reloadMs * 1.35)
                    : Math.max(120, reloadMs * 1.3);
                
                const forward = Vector.fromAngle(this.rotation);
                const tipBase = Vector.add(this.pos, Vector.mult(forward, this.radius * 1.8));
                if (this.variant === 'TWIN') {
                    const lateral = { x: -forward.y, y: forward.x };
                    const laneOffset = this.radius * 0.42;
                    const shotCfg = [-1, 1];
                    for (const side of shotCfg) {
                        const muzzle = Vector.add(tipBase, Vector.mult(lateral, laneOffset * side));
                        const spreadAngle = this.rotation + (side * 0.035);
                        const dir = Vector.fromAngle(spreadAngle);
                        const bullet = new Bullet(engine.nextId(), muzzle.x, muzzle.y, Vector.mult(dir, bSpeed), this.owner, 0.4, 1.0, 0.76);
                        engine.entities.push(bullet);
                    }
                } else {
                    const bullet = new Bullet(engine.nextId(), tipBase.x, tipBase.y, Vector.mult(forward, bSpeed), this.owner, 0.45, 1.0, 0.8);
                    engine.entities.push(bullet);
                }
                
                if (engine.isOnScreen(this.pos)) {
                    engine.particles.push(new Particle(tipBase.x, tipBase.y, 'rgba(255, 200, 50, 0.4)', 6, 4, 'FLASH'));
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
        this.color = getTeamSummonColor(this.team);
        const isManagerUnit = this.owner.classType === TankClass.MANAGER;
        const bLen = this.radius * 1.8;
        const bWid = this.radius * 0.7;
        
        ctx.save();
        const easedProg = isManagerUnit ? 0 : Math.pow(Math.max(0, this.cooldown / 400), 1.3);
        ctx.translate(-easedProg * 5, 0);
        ctx.scale(1 - easedProg * 0.1, 1 + easedProg * 0.1);
        
        const grad = ctx.createLinearGradient(0, 0, bLen, 0);
        grad.addColorStop(0, '#4a5568');
        grad.addColorStop(0.55, '#64748b');
        grad.addColorStop(1, '#1f2937');
        ctx.fillStyle = grad;
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -bWid * 0.55);
        ctx.lineTo(bLen * 0.78, -bWid * 0.5);
        ctx.lineTo(bLen, 0);
        ctx.lineTo(bLen * 0.78, bWid * 0.5);
        ctx.lineTo(0, bWid * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(bLen * 0.18, -bWid * 0.28, bLen * 0.45, bWid * 0.18);
        ctx.restore();

        if (isManagerUnit) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
                const px = Math.cos(a) * this.radius;
                const py = Math.sin(a) * this.radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = COLORS.border;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(170,255,230,0.75)';
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = COLORS.border;
            ctx.stroke();
        }
    }
}

class Drone extends Entity {
  private static readonly REBIRTH_DRONE_DAMAGE_MULT = 1.45;
  private static readonly REBIRTH_DRONE_HEALTH_MULT = 1.45;
  private static getOwnerDamageMult(owner: Tank): number {
      if (owner.classType === TankClass.OVERLORD) return 1.58;
      if (owner.classType === TankClass.OVERSEER) return 1.42;
      if (owner.classType === TankClass.MANAGER) return 1.24;
      if (owner.classType === TankClass.HYBRID) return 1.16;
      return 1.0;
  }
  private static getFormationRadius(owner: Tank): number {
      if (owner.classType === TankClass.OVERLORD) return 32;
      if (owner.classType === TankClass.OVERSEER) return 28;
      if (owner.classType === TankClass.MANAGER) return 18;
      if (owner.classType === TankClass.HYBRID) return 22;
      return 24;
  }
  owner: Tank;
  orbitAngle: number;
  orbitDistance: number = 140;

    constructor(id: number, x: number, y: number, owner: Tank) {
        super(id, EntityType.DRONE, x, y, 10, getTeamSummonColor(owner.team));
        this.owner = owner;
        this.team = owner.team;
        this.friction = 0.94; 
        this.mass = 12;
        this.orbitAngle = Math.random() * Math.PI * 2;
        
        const bulletDmg = BASE_STATS.bulletDamage + (owner.stats[StatType.BULLET_DAMAGE] * 3);
        const bulletPen = BASE_STATS.bulletPenetration + (owner.stats[StatType.BULLET_PENETRATION] * 5);
        
        this.damage = bulletDmg * 0.9 * Drone.getOwnerDamageMult(owner);
        this.maxHealth = 30 + bulletPen * 2.5;
        const liveEngine = (window as any).gameEngine as GameEngine | undefined;
        if (liveEngine?.gameMode === GameMode.SANDBOX) {
            this.damage *= Math.max(0.4, liveEngine.sandboxConfig.droneDamageScale || 1);
            this.maxHealth *= Math.max(0.4, liveEngine.sandboxConfig.droneDurabilityScale || 1);
        }
        if (owner.isTransformed && owner.isBossClass(owner.classType)) {
            this.damage *= Drone.REBIRTH_DRONE_DAMAGE_MULT;
            this.maxHealth *= Drone.REBIRTH_DRONE_HEALTH_MULT;
        }
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;

        // SACRIFICIAL GOAT BUFF
        if (owner.isSacrificing) {
            this.damage *= 1.25;
        }
    }

    override update(dt: number) {
        this.color = getTeamSummonColor(this.team);
        const timeScale = Math.min(dt * 60, 2.0);
        const engine = (window as any).gameEngine;
        const isManagerOwner = this.owner.classType === TankClass.MANAGER;
        const isColossalOwner = this.owner.classType === TankClass.COLOSSAL && this.owner.isTransformed;
        const siblingDrones = engine ? engine.entities.filter((e: any) => e.type === EntityType.DRONE && e.owner === this.owner) : [];
        const siblingIndex = Math.max(0, siblingDrones.indexOf(this));
        const siblingCount = Math.max(1, siblingDrones.length);
        let isCommanded = false;
        let targetPos = { x: 0, y: 0 };
        const hpRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
        const bulletDmg = BASE_STATS.bulletDamage + (this.owner.stats[StatType.BULLET_DAMAGE] * 3);
        const bulletPen = BASE_STATS.bulletPenetration + (this.owner.stats[StatType.BULLET_PENETRATION] * 5);
        const rebirthMult = this.owner.isTransformed && this.owner.isBossClass(this.owner.classType);
        this.damage =
            bulletDmg *
            0.9 *
            Drone.getOwnerDamageMult(this.owner) *
            (rebirthMult ? Drone.REBIRTH_DRONE_DAMAGE_MULT : 1.0) *
            (this.owner.isSacrificing ? 1.25 : 1.0);
        this.maxHealth = (30 + bulletPen * 2.5) * (rebirthMult ? Drone.REBIRTH_DRONE_HEALTH_MULT : 1.0);
        if (engine?.gameMode === GameMode.SANDBOX) {
            this.damage *= Math.max(0.4, engine.sandboxConfig.droneDamageScale || 1);
            this.maxHealth *= Math.max(0.4, engine.sandboxConfig.droneDurabilityScale || 1);
        }
        this.health = Math.min(this.maxHealth, Math.max(1, this.maxHealth * hpRatio));
        this.displayHealth = this.health;

        if (this.owner.isBot) {
            if (this.owner.aiTargetId !== null) {
                const target = engine?.entities?.find((e: any) => e.id === this.owner.aiTargetId);
                if (target) {
                    isCommanded = true;
                    targetPos = target.pos;
                }
            }
        } else if (engine) {
            if (this.owner.autoFire || engine.mouseDown || this.owner.droneCommandMode === 'REPEL') {
                isCommanded = true;
                const viewW = window.innerWidth;
                const viewH = window.innerHeight;
                const cursorWorld = {
                    x: (engine.mouse.x - viewW / 2) / engine.cameraZoom + engine.cameraPos.x,
                    y: (engine.mouse.y - viewH / 2) / engine.cameraZoom + engine.cameraPos.y,
                };
                const commandMode = this.owner.droneCommandMode;

                if (isManagerOwner) {
                    const microOffset = commandMode === 'SWARM' ? 10 : (this.owner.autoFire ? 18 : 8);
                    const offsetAngle = (siblingIndex / siblingCount) * Math.PI * 2 + Date.now() * 0.002;
                    targetPos.x = cursorWorld.x + Math.cos(offsetAngle) * microOffset;
                    targetPos.y = cursorWorld.y + Math.sin(offsetAngle) * microOffset;
                } else if (commandMode === 'REPEL') {
                    const away = Vector.normalize(Vector.sub(this.owner.pos, cursorWorld));
                    targetPos = Vector.add(this.owner.pos, Vector.mult(away, this.orbitDistance + 120));
                } else if (commandMode === 'SWARM') {
                    const swirl = Date.now() * 0.004 + siblingIndex * 0.45;
                    targetPos = {
                        x: cursorWorld.x + Math.cos(swirl) * 28,
                        y: cursorWorld.y + Math.sin(swirl) * 28
                    };
                } else {
                    const formationRadius = Drone.getFormationRadius(this.owner);
                    const slotAngle = (siblingIndex / siblingCount) * Math.PI * 2 + Date.now() * 0.0014;
                    targetPos = {
                        x: cursorWorld.x + Math.cos(slotAngle) * formationRadius,
                        y: cursorWorld.y + Math.sin(slotAngle) * formationRadius,
                    };
                }
            }
        }

        if (isCommanded) {
            const dir = Vector.normalize(Vector.sub(targetPos, this.pos));
            let speedMult = 0.8;
            if (this.owner.classType === TankClass.MANAGER) speedMult = 0.72;
            if (this.owner.classType === TankClass.OVERLORD) speedMult = 0.92;
            if (isColossalOwner) speedMult = 1.0;
            const speed = (BASE_STATS.bulletSpeed + this.owner.stats[StatType.BULLET_SPEED] * 0.8) * speedMult;
            this.acc = Vector.mult(dir, speed * 0.1);
            if (engine && siblingCount > 1) {
                let separation = { x: 0, y: 0 };
                const desiredSpacing = this.radius * 2.8;
                for (const sibling of siblingDrones) {
                    if (sibling === this) continue;
                    const away = Vector.sub(this.pos, sibling.pos);
                    const dist = Vector.mag(away);
                    if (dist <= 0.0001 || dist >= desiredSpacing) continue;
                    const weight = 1 - dist / desiredSpacing;
                    separation = Vector.add(separation, Vector.mult(Vector.normalize(away), weight));
                }
                if (Vector.mag(separation) > 0.001) {
                    const separationStrength = isManagerOwner ? 0.2 : 0.28;
                    this.acc = Vector.add(this.acc, Vector.mult(Vector.normalize(separation), separationStrength));
                }
            }
            this.rotation = Math.atan2(dir.y, dir.x);
            if (isManagerOwner && Math.random() < 0.06) {
                engine.particles.push(new Particle(this.pos.x, this.pos.y, 'rgba(110,255,220,0.22)', 5, 12, 'GAS'));
            }
        } else {
            // Swarm Orbiting logic
            const idx = siblingIndex;
            const total = siblingCount;
            
            const slice = (Math.PI * 2) / total;
            const orbitRate = this.owner.classType === TankClass.OVERLORD
              ? 1250
              : this.owner.classType === TankClass.MANAGER
                ? 1750
                : isColossalOwner
                  ? 1220
                  : 1500;
            const targetAngle = idx * slice + (Date.now() / orbitRate);
            
            const orbitPos = {
                x: this.owner.pos.x + Math.cos(targetAngle) * this.orbitDistance,
                y: this.owner.pos.y + Math.sin(targetAngle) * this.orbitDistance
            };
            
            const dirToOrbit = Vector.sub(orbitPos, this.pos);
            const dist = Vector.mag(dirToOrbit);
            const pullStrength = Vector.clamp(
              dist * (this.owner.classType === TankClass.MANAGER ? 0.026 : isColossalOwner ? 0.034 : 0.03),
              0,
              this.owner.classType === TankClass.OVERLORD ? 3.4 : isColossalOwner ? 3.6 : 3
            );
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
        const color = getTeamSummonColor(team);
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
            const desiredSpeed = dist > 220 ? 3.3 : dist > 150 ? 2.75 : dist > 96 ? 2.1 : 1.15;
            const desiredVel = Vector.mult(dir, desiredSpeed);
            const steering = Vector.mult(Vector.sub(desiredVel, this.vel), 0.7);
            this.acc = steering;
            this.chaseTimerMs += dt * 1000;

            const maxChaseDist = this.orbitRadius + SAFE_ZONE_WARNING_RADIUS + 420;
            const distFromAnchor = Vector.dist(target.pos, this.anchor);
            if (distFromAnchor > maxChaseDist || this.chaseTimerMs > 7000) {
                this.targetId = null;
                this.aiState = AIState.RETURNING;
            } else if (dist < 148 && this.attackCooldownMs <= 0 && (target.type === EntityType.PLAYER || target.type === EntityType.ENEMY || target.type === EntityType.ELITE_TANK)) {
                const victim = target as Tank;
                const missingRatio = 1 - (victim.health / Math.max(1, victim.maxHealth));
                const dmg = Math.min(victim.maxHealth * 0.085, Math.max(20, victim.maxHealth * (0.032 + missingRatio * 0.024)));
                victim.takeDamage(dmg, this.id);
                this.attackCooldownMs = 380;
                engine.particles.push(new Particle(victim.pos.x, victim.pos.y, this.team === Team.BLUE ? 'rgba(66,200,255,0.52)' : 'rgba(255,95,126,0.52)', 9, 14, 'RING'));
            }
            const desiredRotation = Math.atan2(dir.y, dir.x);
            const delta = Math.atan2(Math.sin(desiredRotation - this.rotation), Math.cos(desiredRotation - this.rotation));
            this.rotation += delta * Math.min(1, dt * 8.5);
            super.update(dt);
            const speed = Vector.mag(this.vel);
            const speedCap = 3.6;
            if (speed > speedCap) {
                this.vel = Vector.mult(Vector.normalize(this.vel), speedCap);
            }
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
            this.rotation += dt * 1.2;
            if (this.aiState === AIState.RETURNING && Vector.dist(this.pos, orbitTarget) < 16) this.aiState = AIState.ORBIT_IDLE;
        }
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        this.color = getTeamSummonColor(this.team);
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
    lifetime: number = 140;
    isExit: boolean = false;
    swirlAngle: number = 0;
    portalScale: number = 1.0;
    phase: VoidPortalPhase = 'BLACK_HOLE';
    phaseTimerSec: number = 0;
    expansionCharge: number = 0;
    rings: { angle: number; speed: number; radius: number }[];
    particles: { angle: number; dist: number; speed: number; size: number }[];
    collapseTriggered: boolean = false;
    pulseClockSec: number = 0;

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
        this.phaseTimerSec += dt;
        this.pulseClockSec += dt;
        if (!this.isExit) {
            if (this.phaseTimerSec >= 90) this.phase = 'EXPANDING';
            else if (this.phaseTimerSec >= 60) this.phase = 'WHITE_HOLE';
            else this.phase = 'BLACK_HOLE';
        }
        this.swirlAngle += dt * 3;
        const breathe = 1.0 + Math.sin(Date.now() / 300) * 0.05;
        const blackHoleGrowth = this.phase === 'BLACK_HOLE' ? Math.min(1, this.phaseTimerSec / 60) * 0.28 : 0;
        if (this.phase === 'EXPANDING') {
            this.expansionCharge = Math.min(1, this.expansionCharge + dt * 0.26);
            this.portalScale = breathe + 0.28 + this.expansionCharge * 1.6;
        } else {
            this.portalScale = breathe + blackHoleGrowth;
            this.expansionCharge = Math.max(0, this.expansionCharge - dt * 0.45);
        }

        this.rings.forEach(ring => {
            ring.angle += ring.speed * dt;
        });

        this.particles.forEach(p => {
            p.angle += p.speed * dt;
        });

        if (!this.isExit) {
            const engine = (window as any).gameEngine as GameEngine | undefined;
            const hasNearbyOccupants = !!engine?.entities?.some((e: Entity) =>
                (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) &&
                !e.isDead &&
                Vector.dist(e.pos, this.pos) < this.radius * 1.25
            );
            // Empty wormholes remain open longer; occupied ones collapse on schedule.
            this.lifetime -= dt * (hasNearbyOccupants ? 1 : 0.42);
            if (this.lifetime <= 0) this.isDead = true;
        }
        
        super.update(dt);
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        const t = Date.now() / 1000;
        ctx.save();
        ctx.scale(this.portalScale, this.portalScale);

        const black = this.phase === 'BLACK_HOLE';
        const white = this.phase === 'WHITE_HOLE';
        const expanding = this.phase === 'EXPANDING';
        const whitenProgress = getWormholeWhitenProgress(this.phase, this.phaseTimerSec, this.expansionCharge);
        const glowRadius = this.radius * (1.5 + Math.sin(t * 3) * 0.2 + (expanding ? this.expansionCharge * 1.45 : 0));
        const glowIntensity = 0.5 + Math.sin(t * 2) * 0.2 + whitenProgress * 0.45;
        const grad = ctx.createRadialGradient(0, 0, 40, 0, 0, glowRadius);
        grad.addColorStop(0, `rgba(${Math.floor(10 + whitenProgress * 245)}, ${Math.floor(10 + whitenProgress * 245)}, ${Math.floor(18 + whitenProgress * 237)}, ${Math.min(1, glowIntensity)})`);
        grad.addColorStop(0.35, white ? `rgba(220, 245, 255, ${glowIntensity * 0.78})` : `rgba(42, 20, 76, ${glowIntensity * 0.72})`);
        grad.addColorStop(0.68, white ? `rgba(173, 230, 255, ${glowIntensity * 0.42})` : `rgba(110, 44, 242, ${glowIntensity * 0.6})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        const coreShade = Math.floor(5 + whitenProgress * 243);
        ctx.fillStyle = `rgb(${coreShade}, ${coreShade}, ${Math.min(255, coreShade + 5)})`;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = white ? '#93e6ff' : '#6e2cf2';
        ctx.lineWidth = 4;
        ctx.stroke();

        this.rings.forEach((ring, i) => {
            ctx.save();
            ctx.rotate(ring.angle);
            ctx.strokeStyle = white ? (i === 0 ? '#ffffff' : i === 1 ? '#ccf3ff' : '#7dd3fc') : (i === 0 ? '#ffffff' : i === 1 ? '#a855f7' : '#6e2cf2');
            ctx.lineWidth = 3 - i * 0.5;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            const curl = black ? 1 : -1;
            ctx.ellipse(0, 0, this.radius * ring.radius, this.radius * ring.radius * 0.3, (i * Math.PI) / 3 + t * 0.28 * curl, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

        this.particles.forEach(p => {
            ctx.fillStyle = white ? '#d6f4ff' : '#a855f7';
            ctx.shadowBlur = white ? 14 : 10;
            ctx.shadowColor = white ? '#c8f0ff' : '#a855f7';
            const px = Math.cos(p.angle) * p.dist;
            const py = Math.sin(p.angle) * p.dist;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // White discharge circles for wormhole identity.
        for (let i = 0; i < 5; i++) {
            const a = t * (0.9 + i * 0.23) + i * 1.2;
            const dischargeR = this.radius * (0.86 + (i * 0.09) + Math.sin(t * 2 + i) * 0.04);
            ctx.strokeStyle = `rgba(255,255,255,${0.15 + whitenProgress * 0.33})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * this.radius * 0.22, Math.sin(a) * this.radius * 0.22, dischargeR, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Concentric inward pulse engine: rings collapse into the core on eased trajectories.
        const pulseCount = 8;
        for (let i = 0; i < pulseCount; i++) {
            const lane = ((this.pulseClockSec * 0.65) + (i / pulseCount)) % 1;
            const collapse = Math.pow(1 - lane, 1.55);
            const ringRadius = this.radius * (0.22 + collapse * (2.7 + (expanding ? this.expansionCharge * 1.1 : 0)));
            const alpha = (0.05 + collapse * 0.24) * (0.35 + whitenProgress * 0.95);
            ctx.strokeStyle = `rgba(245, 252, 255, ${alpha})`;
            ctx.lineWidth = 1 + collapse * 1.4;
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Accretion/noise arcs: gives black-hole turbulence and white-hole overpressure.
        const arcCount = white ? 18 : 12;
        for (let i = 0; i < arcCount; i++) {
            const n = Math.sin((t * 2.4) + i * 0.73 + this.id * 0.15);
            const r = this.radius * (0.9 + i / arcCount * 0.7 + (expanding ? this.expansionCharge * 1.1 : 0));
            const a0 = (i / arcCount) * Math.PI * 2 + t * (white ? -1.2 : 1.6);
            const a1 = a0 + (0.22 + (n + 1) * 0.1);
            ctx.strokeStyle = white
              ? `rgba(195,236,255,${0.16 + (n + 1) * 0.08})`
              : `rgba(108,86,255,${0.16 + (n + 1) * 0.08})`;
            ctx.lineWidth = 1.1 + (i % 3) * 0.25;
            ctx.beginPath();
            ctx.arc(0, 0, r, a0, a1);
            ctx.stroke();
        }

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
  droneCommandMode: 'ATTACK' | 'REPEL' | 'SWARM' | 'ORBIT' = 'ORBIT';
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
  secondarySector: SecondarySector = 'none';
  bossAbilityTimer: number = 0;
  isSiegeMode: boolean = false;
  autoTurrets: { rotation: number, cooldown: number, targetId: number | null }[] = [];
  repairDrones: { angle: number, dist: number }[] = [];

  // Pacifist Properties
  healingAuraRadius: number = 0;
  healingAuraEfficiency: number = 0;
  healingBurstCooldown: number = 0;
  restorationLinkCooldown: number = 0;
  totalHealedThisSession: number = 0;
  healingHistory: { time: number, amount: number }[] = [];

  // Draining Properties
  drainAuraRadius: number = 0;
  drainAuraDamage: number = 0;
  drainLifestealEfficiency: number = 0;
  drainBurstCooldown: number = 0;
  totalDrainedThisSession: number = 0;
  drainHistory: { time: number; amount: number }[] = [];
  bloodPactActiveTimer: number = 0;
  regenOverchargeTimer: number = 0;
  regenOverchargeRate: number = 0;
  drainDotStacks: number = 0;
  drainDotTimer: number = 0;
  drainDotTickTimer: number = 0;
  drainDotSourceOwnerId: number | null = null;
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
  skinId: string = 'default';
  donorRank: DonorRank = 'standard';
  barrelSkin: string | null = null;
  trailEffect: string | null = null;
  deathEffect: string | null = null;
  damageDealtBy: Map<number, number> = new Map();

  // BURST FIRE SYSTEM
  burstQueue: { barrelIndex: number, delayLeftMs: number }[] = [];
  rebirthDroneLaunchCooldownMs: number = 0;
  colossalDroneLaunchCooldownMs: number = 0;

    constructor(id: number, x: number, y: number, isPlayer: boolean, team: Team) {
    let color = getTeamColor(team === Team.NONE ? Team.RED : team);
    if (isPlayer) color = getTeamColor(team === Team.NONE ? Team.BLUE : team);
    super(id, isPlayer ? EntityType.PLAYER : EntityType.ENEMY, x, y, 20, color);
    this.team = team;
    this.isBot = !isPlayer;
    this.mass = 30;
    this.stats = createEmptyStatRecord();
    this.universalUpgrades = { ...this.stats };
    this.barrels = TANK_CONFIGS[TankClass.BASIC];
    this.barrelCooldowns = new Array(this.barrels.length).fill(0);
    this.barrelMaxCooldowns = new Array(this.barrels.length).fill(100);
    this.barrelHeat = new Array(this.barrels.length).fill(0);
    this.barrelRecoilOffsets = new Array(this.barrels.length).fill(0);
    this.score = 0;
    this.availableStatPoints = 0;
    this.chassisRotation = this.rotation;
    this.setSkin('default', 'standard');
  }

  private resolveVisualHsl(): { base: Hsl; final: Hsl; skin: SkinDefinition } {
            const base = teamBaseHsl(this.team);
            // Defensive lookup: support older/alternate item id prefixes like `elite_skin_*`.
            const candidates = [this.skinId];
            if (typeof this.skinId === 'string') {
                if (this.skinId.startsWith('elite_skin_')) candidates.push('skin_' + this.skinId.slice('elite_skin_'.length));
                if (this.skinId.startsWith('elite_')) candidates.push('skin_' + this.skinId.slice('elite_'.length));
            }
            let skin = SKINS.find((s) => candidates.includes(s.id)) ?? SKINS.find((s) => s.id === 'default')!;
      const shifted: Hsl = {
          h: wrapHue(base.h + skin.modifier.hueShift),
          s: clampNum(base.s * skin.modifier.saturationMult, SKIN_APPLICATION.clamp.saturation[0], SKIN_APPLICATION.clamp.saturation[1]),
          l: clampNum(base.l + skin.modifier.lightnessOffset, SKIN_APPLICATION.clamp.lightness[0], SKIN_APPLICATION.clamp.lightness[1]),
      };
      const strength = SKIN_APPLICATION.blendStrength[this.donorRank] ?? SKIN_APPLICATION.blendStrength.standard;
      const final: Hsl = {
          h: wrapHue(base.h + shortestHueDelta(base.h, shifted.h) * strength),
          s: base.s + (shifted.s - base.s) * strength,
          l: base.l + (shifted.l - base.l) * strength,
      };
      return { base, final, skin };
  }

  setSkin(skinId: string, donorRank: DonorRank = 'standard') {
      this.skinId = skinId || 'default';
      this.donorRank = donorRank;
      const resolved = this.resolveVisualHsl();
      this.color = hslToCss(resolved.final);
      const extras = resolved.skin.extras;
      this.barrelSkin = extras?.barrelSkin ?? null;
      this.trailEffect = extras?.bulletTrail ?? null;
      this.deathEffect = extras?.deathEffect ?? null;
  }

  private drawSkinOutlineGlow(ctx: CanvasRenderingContext2D, finalColor: string, intensity: number) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.14, 0, Math.PI * 2);
      ctx.strokeStyle = finalColor;
      ctx.globalAlpha = clampNum(intensity, 0, 1) * 0.65;
      ctx.lineWidth = Math.max(2.5, this.radius * 0.16);
      ctx.shadowBlur = 18;
      ctx.shadowColor = finalColor;
      ctx.stroke();
      ctx.restore();
  }

  drawChassis(ctx: CanvasRenderingContext2D) {
      const visual = this.resolveVisualHsl();
      this.color = hslToCss(visual.final);
      if (visual.skin.extras?.outlineGlow) {
          this.drawSkinOutlineGlow(ctx, this.color, visual.skin.extras.glowIntensity ?? 0.35);
      }
      // Layer order: team base ring -> class aura field -> chassis.
      this.drawTeamAffiliationRing(ctx);
      this.drawAuras(ctx);
      this.drawMainShape(ctx);
  }

  drawTurret(ctx: CanvasRenderingContext2D) {
      // The barrels and the turret cap
      this.drawBarrels(ctx);
      this.drawTurretCap(ctx);
      // Leviathan manager spawner is an upper-deck module and must stay above cap/chassis.
      if (this.classType === TankClass.LEVIATHAN) {
          this.drawLeviathanManagerSpawner(ctx);
      }
  }

  drawAutoTurretOverlay(ctx: CanvasRenderingContext2D) {
      const isColossal = this.classType === TankClass.COLOSSAL;
      const isLeviathan = this.classType === TankClass.LEVIATHAN;
      const isWarlord = this.classType === TankClass.WARLORD;
      const isCelestial = this.classType === TankClass.CELESTIAL;
      if (!isColossal && !isLeviathan && !isWarlord && !isCelestial) return;

      ctx.save();
      ctx.rotate(this.rotation);

      if (isColossal) {
          this.autoTurrets.forEach((turret, idx) => {
              const angle = (idx / Math.max(1, this.autoTurrets.length)) * Math.PI * 2 + Math.PI / 6;
              this.drawRebirthDeckTurret(ctx, angle, turret.rotation, turret.cooldown, 'colossal');
          });
      } else if (isLeviathan) {
          [Math.PI / 2, -Math.PI / 2, Math.PI].forEach((angle, idx) => {
              const rot = this.rotation + Math.sin(Date.now() / 600 + idx) * 0.45;
              this.drawRebirthDeckTurret(ctx, angle, rot, 0, 'leviathan');
          });
      } else if (isWarlord) {
          [Math.PI * 0.74, -Math.PI * 0.74].forEach((angle, idx) => {
              const rot = this.rotation + Math.cos(Date.now() / 700 + idx) * 0.4;
              this.drawRebirthDeckTurret(ctx, angle, rot, 0, 'warlord');
          });
      } else if (isCelestial) {
          const turrets = this.autoTurrets.length > 0 ? this.autoTurrets : [
              { rotation: this.rotation, cooldown: 0, targetId: null },
              { rotation: this.rotation, cooldown: 0, targetId: null },
              { rotation: this.rotation, cooldown: 0, targetId: null },
              { rotation: this.rotation, cooldown: 0, targetId: null },
              { rotation: this.rotation, cooldown: 0, targetId: null },
              { rotation: this.rotation, cooldown: 0, targetId: null },
          ];
          turrets.forEach((turret, idx) => {
              this.drawCelestialMicroTurret(ctx, turret, idx);
              const angle = (idx / Math.max(1, turrets.length)) * Math.PI * 2;
              this.drawRebirthDeckTurret(ctx, angle, turret.rotation, turret.cooldown, 'celestial');
          });
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(196, 132, 252, 0.36)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.18, 0);
      ctx.lineTo(this.radius * 1.55, 0);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
  }

  drawAuras(ctx: CanvasRenderingContext2D) {
      const isBoss = this.isBossClass(this.classType);
      const isEliteVisual = this.isTransformed;
      const hasRestorationSector = this.hasRestorationSector();
      const hasBloodSector = this.hasBloodSector();

      if (this.classType === TankClass.CELESTIAL && isBoss) {
        this.drawCelestialBossAura(ctx);
      }

      if (hasRestorationSector && this.healingAuraRadius > 0) {
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

        ctx.save();
        ctx.rotate(-t * 0.32);
        this.drawRestorationSigil(ctx, Math.min(auraRadius * 0.42, this.radius * 1.42), basePulse);
        ctx.restore();
        
        ctx.restore();
      }

      const isColossalBloodCore = this.classType === TankClass.COLOSSAL && this.isBossClass(this.classType);
      const drainingAuraRadius = this.drainAuraRadius || 0;
      if ((hasBloodSector || isColossalBloodCore) && drainingAuraRadius > 0) {
        const t = Date.now() / 1000;
        ctx.save();
        const auraRadius = drainingAuraRadius * (1.0 + Math.sin(t * (isColossalBloodCore ? 2.4 : 4)) * 0.03);
         
        // Sinister deep red gradient
        const grad = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, auraRadius);
        grad.addColorStop(0, isColossalBloodCore ? 'rgba(244, 114, 182, 0.42)' : 'rgba(239, 68, 68, 0.45)');
        grad.addColorStop(0.4, isColossalBloodCore ? 'rgba(127, 29, 29, 0.25)' : 'rgba(185, 28, 28, 0.18)');
        grad.addColorStop(0.8, 'rgba(127, 29, 29, 0.08)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Violent swirling soul-tendrils
        ctx.strokeStyle = isColossalBloodCore ? 'rgba(251, 113, 133, 0.28)' : 'rgba(239, 68, 68, 0.25)';
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

        ctx.save();
        ctx.rotate(t * 0.52);
        this.drawBloodSigil(ctx, Math.min(auraRadius * 0.32, this.radius * 1.5), 0.5 + Math.sin(t * 3.5) * 0.5);
        ctx.restore();
        
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
      const baseRgb = getTeamRgb(this.team);
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

  private drawCelestialPolygon(ctx: CanvasRenderingContext2D, sides: number, radius: number, phase: number = -Math.PI / 2) {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
          const angle = phase + (i / sides) * Math.PI * 2;
          if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
  }

  private drawCelestialBossAura(ctx: CanvasRenderingContext2D) {
      const t = Date.now() * 0.001;
      const pulse = 0.5 + Math.cos(t * 2.15 + this.id * 0.11) * 0.5;
      const auraBase = this.radius * (1.45 + pulse * 0.08);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const layers = [
          { r: auraBase * 1.08, a: 0.26, c: 'rgba(216,180,254,' },
          { r: auraBase * 1.34, a: 0.16, c: 'rgba(125,211,252,' },
          { r: auraBase * 1.62, a: 0.10, c: 'rgba(255,255,255,' },
      ];

      for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          const wobble = 1 + Math.cos(t * (1.25 + i * 0.3) + i) * 0.035;
          const r = layer.r * wobble;
          const grad = ctx.createRadialGradient(0, 0, this.radius * 0.35, 0, 0, r);
          grad.addColorStop(0, `${layer.c}${layer.a * 0.55})`);
          grad.addColorStop(0.68, `${layer.c}${layer.a})`);
          grad.addColorStop(1, `${layer.c}0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `${layer.c}${layer.a + 0.08})`;
          ctx.lineWidth = 2.2 - i * 0.35;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
          ctx.stroke();
      }

      ctx.rotate(t * 0.18);
      ctx.strokeStyle = `rgba(255,255,255,${0.14 + pulse * 0.1})`;
      ctx.lineWidth = 1.4;
      for (let ring = 0; ring < 3; ring++) {
          ctx.save();
          ctx.rotate((ring / 3) * Math.PI * 2 + Math.sin(t + ring) * 0.08);
          ctx.beginPath();
          ctx.ellipse(0, 0, auraBase * (0.88 + ring * 0.18), auraBase * (0.22 + ring * 0.05), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
      }
      ctx.restore();
  }

  private drawCelestialHangarBay(ctx: CanvasRenderingContext2D, angle: number, pulse: number) {
      const r = this.radius;
      const bayLength = r * 0.58;
      const bayWidth = r * 0.22;
      const x = Math.cos(angle) * r * 0.72;
      const y = Math.sin(angle) * r * 0.72;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const compression = 1 - pulse * 0.08;
      ctx.scale(compression, 1 + pulse * 0.08);
      ctx.fillStyle = 'rgba(10, 15, 30, 0.88)';
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.82)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-bayLength * 0.5, -bayWidth * 0.5, bayLength, bayWidth, bayWidth * 0.36);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(125,211,252,${0.14 + pulse * 0.28})`;
      ctx.fillRect(-bayLength * 0.36, -bayWidth * 0.18, bayLength * 0.72, bayWidth * 0.36);
      ctx.restore();
  }

  private drawCelestialChassis(ctx: CanvasRenderingContext2D) {
      const t = Date.now() * 0.001;
      const r = this.radius;
      const pulse = 0.5 + Math.cos(t * 2.4) * 0.5;

      ctx.save();
      ctx.shadowBlur = 22;
      ctx.shadowColor = 'rgba(168,85,247,0.62)';

      // Outer 14-sided command hull.
      const outerGrad = ctx.createLinearGradient(-r, -r, r, r);
      outerGrad.addColorStop(0, '#111827');
      outerGrad.addColorStop(0.34, '#3b0764');
      outerGrad.addColorStop(0.66, '#7e22ce');
      outerGrad.addColorStop(1, '#e9d5ff');
      this.drawCelestialPolygon(ctx, 14, r * (1.16 + pulse * 0.018), -Math.PI / 2 + t * 0.025);
      ctx.fillStyle = outerGrad;
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.lineWidth = 4;
      ctx.fill();
      ctx.stroke();

      // Floating exosphere boundary lines.
      ctx.shadowBlur = 0;
      for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate(t * (0.12 + i * 0.05) + i * Math.PI / 6);
          ctx.strokeStyle = `rgba(${i === 1 ? '125,211,252' : '216,180,254'},${0.24 + pulse * 0.14})`;
          ctx.lineWidth = 1.6;
          this.drawCelestialPolygon(ctx, i === 1 ? 12 : 14, r * (0.98 - i * 0.12), -Math.PI / 2);
          ctx.stroke();
          ctx.restore();
      }

      // Carrier hangar pontoons embedded into the hull.
      for (let i = 0; i < 6; i++) {
          this.drawCelestialHangarBay(ctx, (i / 6) * Math.PI * 2 + Math.PI / 6, 0.5 + Math.sin(t * 5 + i) * 0.5);
      }

      // Inner shield core ring.
      ctx.save();
      ctx.rotate(-t * 0.32);
      const innerGrad = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r * 0.74);
      innerGrad.addColorStop(0, 'rgba(255,255,255,0.92)');
      innerGrad.addColorStop(0.35, 'rgba(196,181,253,0.78)');
      innerGrad.addColorStop(0.78, 'rgba(59,130,246,0.18)');
      innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.22})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Central driver cockpit.
      const cockpit = ctx.createRadialGradient(-r * 0.12, -r * 0.16, 0, 0, 0, r * 0.34);
      cockpit.addColorStop(0, '#ffffff');
      cockpit.addColorStop(0.36, '#d8b4fe');
      cockpit.addColorStop(1, '#312e81');
      ctx.fillStyle = cockpit;
      ctx.strokeStyle = 'rgba(10,10,25,0.72)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
  }

  private drawCelestialMicroTurret(ctx: CanvasRenderingContext2D, turret: { rotation: number; cooldown: number; targetId: number | null }, idx: number) {
      const t = Date.now() * 0.001;
      const nodeAngle = (idx / Math.max(1, this.autoTurrets.length || 6)) * Math.PI * 2 + t * 0.08;
      const dist = this.radius * 0.56;
      const pulse = 0.5 + Math.sin(t * 4 + idx) * 0.5;
      ctx.save();
      ctx.translate(Math.cos(nodeAngle) * dist, Math.sin(nodeAngle) * dist);
      ctx.rotate(turret.rotation - this.rotation);
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(216,180,254,0.72)';

      const cd = Math.max(0, turret.cooldown / 180);
      const recoil = Math.pow(cd, 1.35) * this.radius * 0.06;
      const barrelLen = this.radius * 0.36;
      const barrelWid = this.radius * 0.09;
      const barrelGrad = ctx.createLinearGradient(-recoil, 0, barrelLen, 0);
      barrelGrad.addColorStop(0, '#2e1065');
      barrelGrad.addColorStop(0.75, '#7dd3fc');
      barrelGrad.addColorStop(1, '#ffffff');
      ctx.fillStyle = barrelGrad;
      ctx.strokeStyle = 'rgba(15,23,42,0.85)';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.roundRect(-recoil, -barrelWid * 0.5, barrelLen, barrelWid, barrelWid * 0.45);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167,139,250,${0.76 + pulse * 0.18})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();
      ctx.restore();
  }

  private drawLeviathanManagerSpawner(ctx: CanvasRenderingContext2D) {
      const t = Date.now() * 0.0018;
      const pulse = 0.5 + Math.sin(t * 4.2) * 0.5;
      const r = this.radius;
      const stemLen = r * 0.62;
      const stemWid = r * 0.19;
      const cdNorm = Math.min(1, Math.max(0, this.rebirthDroneLaunchCooldownMs / 520));
      const recoil = Math.pow(cdNorm, 1.2) * r * 0.08;
      const hatchOpen = Math.sin(Math.min(1, cdNorm) * Math.PI) * r * 0.08;

      ctx.save();
      ctx.translate(r * 0.08 - recoil, 0);
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(125,211,252,0.5)';

      const stemGrad = ctx.createLinearGradient(0, 0, stemLen, 0);
      stemGrad.addColorStop(0, '#0b2b3a');
      stemGrad.addColorStop(0.46, '#0284c7');
      stemGrad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = stemGrad;
      ctx.strokeStyle = 'rgba(8, 15, 26, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(0, -stemWid * 0.5, stemLen, stemWid, stemWid * 0.45);
      ctx.fill();
      ctx.stroke();

      // Fabricator muzzle housing.
      ctx.beginPath();
      ctx.roundRect(stemLen * 0.78, -stemWid * 0.85, stemLen * 0.22, stemWid * 1.7, stemWid * 0.32);
      ctx.fillStyle = `rgba(224, 242, 254, ${0.2 + pulse * 0.22})`;
      ctx.fill();
      ctx.stroke();

      // Deployment jaws open briefly after ejecting a mini twin-tank.
      ctx.fillStyle = 'rgba(8, 47, 73, 0.92)';
      ctx.strokeStyle = 'rgba(186,230,253,0.76)';
      ctx.beginPath();
      ctx.roundRect(stemLen * 0.74, -stemWid * 0.92 - hatchOpen, stemLen * 0.32, stemWid * 0.22, stemWid * 0.08);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(stemLen * 0.74, stemWid * 0.7 + hatchOpen, stemLen * 0.32, stemWid * 0.22, stemWid * 0.08);
      ctx.fill();
      ctx.stroke();
      if (cdNorm > 0.08) {
          ctx.fillStyle = `rgba(125,211,252,${0.16 + cdNorm * 0.22})`;
          ctx.beginPath();
          ctx.arc(stemLen * (0.88 + cdNorm * 0.16), 0, r * (0.08 + cdNorm * 0.05), 0, Math.PI * 2);
          ctx.fill();
      }

      // Core reactor node.
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${0.55 + pulse * 0.32})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();

      ctx.restore();
  }

  private drawRebirthDeckTurret(
      ctx: CanvasRenderingContext2D,
      mountAngle: number,
      turretRotation: number,
      cooldown: number,
      style: 'colossal' | 'leviathan' | 'warlord' | 'celestial'
  ) {
      const t = Date.now() * 0.001;
      const mountRadius =
        style === 'colossal' ? this.radius * 0.52 :
        style === 'leviathan' ? this.radius * 0.48 :
        style === 'warlord' ? this.radius * 0.46 :
        this.radius * 0.5;
      const baseRadius =
        style === 'colossal' ? this.radius * 0.14 :
        style === 'leviathan' ? this.radius * 0.12 :
        style === 'warlord' ? this.radius * 0.13 :
        this.radius * 0.11;
      const barrelLen =
        style === 'colossal' ? this.radius * 0.42 :
        style === 'leviathan' ? this.radius * 0.36 :
        style === 'warlord' ? this.radius * 0.38 :
        this.radius * 0.33;
      const barrelWid =
        style === 'colossal' ? this.radius * 0.085 :
        style === 'leviathan' ? this.radius * 0.075 :
        style === 'warlord' ? this.radius * 0.08 :
        this.radius * 0.07;

      const pulse = 0.5 + Math.sin(t * 4 + mountAngle * 2.1) * 0.5;
      const glow =
        style === 'colossal' ? '251,113,133' :
        style === 'leviathan' ? '56,189,248' :
        style === 'warlord' ? '248,113,113' :
        '192,132,252';
      const metalA =
        style === 'colossal' ? '#4a1039' :
        style === 'leviathan' ? '#0c4a6e' :
        style === 'warlord' ? '#4c1d2b' :
        '#312e81';
      const metalB =
        style === 'colossal' ? '#f472b6' :
        style === 'leviathan' ? '#7dd3fc' :
        style === 'warlord' ? '#fb7185' :
        '#c4b5fd';

      ctx.save();
      ctx.translate(Math.cos(mountAngle) * mountRadius, Math.sin(mountAngle) * mountRadius);

      // Deck pedestal.
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(10,14,24,0.72)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${glow},0.45)`;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Core plate.
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${glow},${0.22 + pulse * 0.16})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();

      ctx.rotate(turretRotation - this.rotation);
      const cd = Math.max(0, cooldown / 180);
      const recoil = Math.pow(cd, 1.25) * this.radius * 0.055;

      const barrelGrad = ctx.createLinearGradient(-recoil, 0, barrelLen, 0);
      barrelGrad.addColorStop(0, metalA);
      barrelGrad.addColorStop(0.65, metalB);
      barrelGrad.addColorStop(1, '#ffffff');
      ctx.fillStyle = barrelGrad;
      ctx.strokeStyle = 'rgba(12,18,28,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-recoil, -barrelWid * 0.5, barrelLen, barrelWid, barrelWid * 0.5);
      ctx.fill();
      ctx.stroke();

      // Muzzle trim.
      ctx.fillStyle = `rgba(${glow},${0.28 + pulse * 0.2})`;
      ctx.fillRect(barrelLen * 0.82, -barrelWid * 0.33, barrelLen * 0.18, barrelWid * 0.66);

      ctx.restore();
  }

  drawMainShape(ctx: CanvasRenderingContext2D) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.border;
    ctx.fillStyle = this.color;
    
    // Custom Chassis Rendering for specific classes
    if (this.classType === TankClass.COLOSSAL) {
        const t = Date.now() * 0.001;
        const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
        const r = this.radius;
        const outerGrad = ctx.createLinearGradient(-r, -r, r * 1.2, r);
        outerGrad.addColorStop(0, '#4a1039');
        outerGrad.addColorStop(0.45, '#db2777');
        outerGrad.addColorStop(1, '#fbcfe8');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        [
            [r * 1.02, 0],
            [r * 0.5, -r * 0.88],
            [-r * 0.4, -r * 0.98],
            [-r * 1.04, -r * 0.34],
            [-r * 1.04, r * 0.34],
            [-r * 0.4, r * 0.98],
            [r * 0.5, r * 0.88],
        ].forEach(([x, y], idx) => idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(18, 12, 26, 0.52)';
        ctx.beginPath();
        [
            [r * 0.54, 0],
            [r * 0.14, -r * 0.5],
            [-r * 0.46, -r * 0.56],
            [-r * 0.7, 0],
            [-r * 0.46, r * 0.56],
            [r * 0.14, r * 0.5],
        ].forEach(([x, y], idx) => idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        const coreGrad = ctx.createRadialGradient(-r * 0.1, 0, r * 0.06, 0, 0, r * 0.58);
        coreGrad.addColorStop(0, `rgba(255,255,255,${0.7 + pulse * 0.2})`);
        coreGrad.addColorStop(0.4, 'rgba(251,113,133,0.58)');
        coreGrad.addColorStop(1, 'rgba(127,29,29,0.2)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
        ctx.fill();

        // Rear quintuple hangar slipways integrated into armor.
        ctx.fillStyle = 'rgba(17, 24, 39, 0.82)';
        ctx.strokeStyle = 'rgba(255, 182, 193, 0.68)';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 5; i++) {
            const laneY = (-2 + i) * r * 0.28;
            ctx.beginPath();
            ctx.roundRect(-r * 0.86, laneY - r * 0.08, r * 0.38, r * 0.16, r * 0.05);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = `rgba(244,114,182,${0.2 + pulse * 0.25})`;
            ctx.fillRect(-r * 0.82, laneY - r * 0.03, r * 0.24, r * 0.06);
            ctx.fillStyle = 'rgba(17, 24, 39, 0.82)';
        }
    } else if (this.classType === TankClass.LEVIATHAN) {
        const t = Date.now() * 0.0016;
        const r = this.radius;
        const shell = ctx.createLinearGradient(-r, -r, r, r);
        shell.addColorStop(0, '#082f49');
        shell.addColorStop(0.5, '#0ea5e9');
        shell.addColorStop(1, '#bfdbfe');
        ctx.fillStyle = shell;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 - Math.PI / 2 + t * 0.08;
            const rad = i % 3 === 0 ? r * 1.02 : i % 2 === 0 ? r * 0.66 : r * 0.34;
            ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(7, 21, 35, 0.45)';
        ctx.beginPath();
        [
            [0, -r * 0.64],
            [r * 0.56, -r * 0.14],
            [r * 0.42, r * 0.56],
            [-r * 0.42, r * 0.56],
            [-r * 0.56, -r * 0.14],
        ].forEach(([x, y], idx) => idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(190,230,255,0.32)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56,189,248,0.28)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.stroke();
    } else if (this.classType === TankClass.WARLORD) {
        const r = this.radius;
        const hull = ctx.createLinearGradient(-r, -r, r, r);
        hull.addColorStop(0, '#3f1d2e');
        hull.addColorStop(0.45, '#be123c');
        hull.addColorStop(1, '#fecaca');
        ctx.fillStyle = hull;
        ctx.beginPath();
        [
            [r * 1.02, 0],
            [r * 0.18, -r * 0.58],
            [-r * 0.24, -r * 0.96],
            [-r * 0.84, -r * 0.54],
            [-r * 0.84, r * 0.54],
            [-r * 0.24, r * 0.96],
            [r * 0.18, r * 0.58],
        ].forEach(([x, y], idx) => idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.roundRect(-r * 0.3, -r * 0.34, r * 0.68, r * 0.68, r * 0.1);
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 235, 235, 0.16)';
        ctx.beginPath();
        ctx.moveTo(r * 0.38, 0);
        ctx.lineTo(-r * 0.02, -r * 0.22);
        ctx.lineTo(-r * 0.02, r * 0.22);
        ctx.closePath();
        ctx.fill();
    } else if (this.classType === TankClass.CELESTIAL) {
        const r = this.radius;
        const t = Date.now() * 0.0012;
        const shell = ctx.createLinearGradient(-r, -r, r, r);
        shell.addColorStop(0, '#2e1065');
        shell.addColorStop(0.45, '#7e22ce');
        shell.addColorStop(1, '#ddd6fe');
        ctx.fillStyle = shell;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i / 10) * Math.PI * 2 + t * 0.06;
            const rr = i % 2 === 0 ? r * 0.98 : r * 0.58;
            ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(216,180,254,0.72)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 - t * 0.04;
            ctx.lineTo(Math.cos(a) * r * 1.14, Math.sin(a) * r * 1.14);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(216,180,254,0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
    } else if (this.classType === TankClass.OBLITERATOR) {
        const r = this.radius;
        const t = Date.now() * 0.0013;
        const pulse = 0.5 + Math.sin(t * 3.4) * 0.5;
        const shell = ctx.createLinearGradient(-r * 1.2, -r, r * 1.2, r);
        shell.addColorStop(0, '#1a0b33');
        shell.addColorStop(0.42, '#6d28d9');
        shell.addColorStop(0.72, '#a855f7');
        shell.addColorStop(1, '#f5d0fe');
        ctx.fillStyle = shell;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
            const a = -Math.PI / 2 + (i / 16) * Math.PI * 2 + t * 0.045;
            const rr = i % 2 === 0 ? r * 1.02 : r * 0.72;
            if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(18, 6, 34, 0.54)';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + (i / 8) * Math.PI * 2 + t * 0.025;
            const rr = i % 2 === 0 ? r * 0.68 : r * 0.52;
            if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(233, 213, 255, 0.32)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner collapse core
        const core = ctx.createRadialGradient(-r * 0.12, -r * 0.15, r * 0.04, 0, 0, r * 0.62);
        core.addColorStop(0, `rgba(255,255,255,${0.78 + pulse * 0.18})`);
        core.addColorStop(0.45, 'rgba(196, 132, 252, 0.75)');
        core.addColorStop(1, 'rgba(30, 10, 60, 0.25)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(233, 213, 255, 0.42)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
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
        const grad = ctx.createRadialGradient(-er * 0.2, -er * 0.12, er * 0.15, 0, 0, er * 1.45);
        grad.addColorStop(0, '#fecaca');
        grad.addColorStop(0.22, '#ef4444');
        grad.addColorStop(0.62, '#450a0a');
        grad.addColorStop(1, '#120304');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 205, 205, 0.52)';
        ctx.lineWidth = 3;
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
        // Reaper redesign: wraith core + crescent crown + void maw.
        const er = this.radius;
        const t = Date.now() * 0.0018;
        const pulse = 0.5 + Math.sin(t * 3.1) * 0.5;

        // Outer spectral shell.
        ctx.beginPath();
        ctx.moveTo(er * 1.45, 0);
        ctx.bezierCurveTo(er * 1.05, er * 1.3, -er * 0.95, er * 1.58, -er * 1.35, 0);
        ctx.bezierCurveTo(-er * 0.95, -er * 1.58, er * 1.05, -er * 1.3, er * 1.45, 0);
        ctx.closePath();
        const shellGrad = ctx.createRadialGradient(er * 0.12, -er * 0.08, er * 0.15, 0, 0, er * 1.62);
        shellGrad.addColorStop(0, '#fca5a5');
        shellGrad.addColorStop(0.34, '#ef4444');
        shellGrad.addColorStop(0.72, '#3f0a0a');
        shellGrad.addColorStop(1, '#090303');
        ctx.fillStyle = shellGrad;
        ctx.fill();
        ctx.lineWidth = 3.6;
        ctx.strokeStyle = 'rgba(255, 185, 185, 0.62)';
        ctx.stroke();

        // Crescent crown ring.
        ctx.save();
        ctx.rotate(t * 0.38);
        ctx.strokeStyle = `rgba(248, 113, 113, ${0.28 + pulse * 0.22})`;
        ctx.lineWidth = 2.1;
        for (let i = 0; i < 3; i++) {
            const a0 = (i / 3) * Math.PI * 2 + 0.3;
            const a1 = a0 + Math.PI * 0.58;
            ctx.beginPath();
            ctx.arc(0, 0, er * (0.94 + i * 0.14), a0, a1);
            ctx.stroke();
        }
        ctx.restore();

        // Void maw center.
        const maw = ctx.createRadialGradient(0, 0, er * 0.05, 0, 0, er * 0.72);
        maw.addColorStop(0, '#fef2f2');
        maw.addColorStop(0.24, '#f87171');
        maw.addColorStop(0.58, '#7f1d1d');
        maw.addColorStop(1, '#0a0606');
        ctx.fillStyle = maw;
        ctx.beginPath();
        ctx.arc(0, 0, er * 0.66, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(-t * 0.8);
        ctx.fillStyle = `rgba(255, 220, 220, ${0.14 + pulse * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(er * 0.18, -er * 0.22, er * 0.2, er * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    if (this.isPacifist(this.classType)) {
        const pulse = 0.5 + Math.sin(Date.now() * 0.0042) * 0.5;
        this.drawMedicalCross(ctx, this.radius * 0.42);
        ctx.save();
        const shell = ctx.createRadialGradient(-this.radius * 0.12, -this.radius * 0.08, this.radius * 0.08, 0, 0, this.radius * 1.08);
        shell.addColorStop(0, 'rgba(236, 253, 245, 0.32)');
        shell.addColorStop(0.6, 'rgba(52, 211, 153, 0.08)');
        shell.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shell;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.02, 0, Math.PI * 2);
        ctx.fill();
        this.drawRestorationSigil(ctx, this.radius * 0.96, pulse);
        ctx.strokeStyle = `rgba(134, 239, 172, ${0.35 + pulse * 0.2})`;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.92, Math.PI * 0.1, Math.PI * 0.9);
        ctx.arc(0, 0, this.radius * 0.92, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.restore();
    } else if (this.isDraining(this.classType)) {
        const pulse = 0.5 + Math.sin(Date.now() * 0.0054) * 0.5;
        this.drawVampireTeeth(ctx, this.radius * 0.44);
        ctx.save();
        const mist = ctx.createRadialGradient(0, 0, this.radius * 0.1, 0, 0, this.radius * 1.08);
        mist.addColorStop(0, 'rgba(127, 29, 29, 0.06)');
        mist.addColorStop(0.62, 'rgba(239, 68, 68, 0.08)');
        mist.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = mist;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.02, 0, Math.PI * 2);
        ctx.fill();
        this.drawBloodSigil(ctx, this.radius * 0.98, pulse);
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

  private drawRestorationSigil(ctx: CanvasRenderingContext2D, radius: number, pulse: number = 0.5) {
      ctx.save();
      const ringR = radius * 0.82;
      ctx.strokeStyle = `rgba(209, 250, 229, ${0.46 + pulse * 0.2})`;
      ctx.lineWidth = Math.max(1.4, radius * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(16, 185, 129, ${0.38 + pulse * 0.18})`;
      ctx.lineWidth = Math.max(1, radius * 0.05);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          ctx.moveTo(Math.cos(ang) * radius * 0.28, Math.sin(ang) * radius * 0.28);
          ctx.lineTo(Math.cos(ang) * radius * 0.92, Math.sin(ang) * radius * 0.92);
      }
      ctx.stroke();

      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = `rgba(134, 239, 172, ${0.3 + pulse * 0.14})`;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          ctx.moveTo(Math.cos(ang) * radius * 0.36, Math.sin(ang) * radius * 0.36);
          ctx.lineTo(Math.cos(ang) * radius * 0.7, Math.sin(ang) * radius * 0.7);
      }
      ctx.stroke();
      ctx.restore();
  }

  private drawBloodSigil(ctx: CanvasRenderingContext2D, radius: number, pulse: number = 0.5) {
      ctx.save();
      ctx.strokeStyle = `rgba(248, 113, 113, ${0.42 + pulse * 0.22})`;
      ctx.lineWidth = Math.max(1.4, radius * 0.08);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const outer = radius * 0.92;
          const inner = radius * 0.38;
          ctx.moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner);
          ctx.lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
      }
      ctx.stroke();

      ctx.rotate(Math.PI / 6);
      ctx.strokeStyle = `rgba(127, 29, 29, ${0.46 + pulse * 0.12})`;
      ctx.lineWidth = Math.max(1, radius * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();

      const core = ctx.createRadialGradient(0, 0, radius * 0.06, 0, 0, radius * 0.45);
      core.addColorStop(0, 'rgba(254, 202, 202, 0.85)');
      core.addColorStop(0.32, 'rgba(239, 68, 68, 0.72)');
      core.addColorStop(1, 'rgba(69, 10, 10, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.44, 0, Math.PI * 2);
      ctx.fill();
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
      const isTrapperBranch = isTrapperBranchClass(this.classType);
      const isSprayer = this.classType === TankClass.SPRAYER;
      const isColossal = this.classType === TankClass.COLOSSAL;
      const isLeviathan = this.classType === TankClass.LEVIATHAN;
      const isWarlord = this.classType === TankClass.WARLORD;
      const isCelestial = this.classType === TankClass.CELESTIAL;
      const isObliterator = this.classType === TankClass.OBLITERATOR;
      const isReaper = this.classType === TankClass.REAPER;
      const sprayerCoreIndex = Math.floor(this.barrels.length / 2);

      this.barrels.forEach((barrel, i) => {
        const [length, width, xOff, angleOff, delayMultiplier, yOff = 0, spread = 1] = barrel;
        ctx.save();
        ctx.rotate(angleOff);
        ctx.translate(xOff * this.radius, yOff * this.radius);
        if (isLeviathan && i === this.barrels.length - 1) {
            ctx.restore();
            return;
        }
        
        const cooldown = Math.max(0, this.barrelCooldowns[i] || 0);
        const maxCd = this.barrelMaxCooldowns[i] || 100;
        const progress = cooldown / maxCd;
        const easedProgress = Math.pow(progress, 1.3);
        
        let recoilFactor = (isHeavyClass || isBoss) ? 0.75 : (isRapidFireClass ? 0.58 : 0.45);
        if (isColossal) recoilFactor = 0.96;
        else if (isLeviathan) recoilFactor = 0.86;
        else if (isWarlord) recoilFactor = 0.72;
        else if (isCelestial) recoilFactor = 0.9;
        else if (isObliterator) recoilFactor = 0.42;
        // Frame-friendly recoil blend: rely mostly on spring-driven recoil offsets and only lightly on cooldown ratio.
        const springRecoil = (this.barrelRecoilOffsets[i] || 0) * this.radius * (isSprayer ? 0.82 : 0.62);
        const cooldownRecoil = easedProgress * (this.radius * recoilFactor * 0.35);
        const recoilAmount = springRecoil + cooldownRecoil;
        ctx.translate(-recoilAmount, 0);
        if (isBoss) {
            const t = Date.now() * 0.004;
            const phase = (i * 0.77) + t;
            // Unique motion accents per rebirth chassis.
            if (isColossal) ctx.translate(-Math.abs(Math.sin(phase)) * this.radius * 0.035, Math.sin(phase * 0.6) * this.radius * 0.01);
            else if (isLeviathan) ctx.translate(Math.sin(phase) * this.radius * 0.022, Math.cos(phase * 1.15) * this.radius * 0.02);
            else if (isWarlord) ctx.translate(0, Math.sin(phase * 0.85) * this.radius * 0.028);
            else if (isCelestial) ctx.rotate(Math.sin(phase * 0.9) * 0.045);
            else if (isObliterator) ctx.translate(Math.sin(phase * 0.9) * this.radius * 0.012, Math.cos(phase * 0.75) * this.radius * 0.01);
        }
        
        const lengthSqueeze = 1 - (easedProgress * ((isHeavyClass || isBoss) ? 0.25 : (isRapidFireClass ? 0.2 : 0.15)));
        const widthSqueeze = 1 + (easedProgress * ((isHeavyClass || isBoss) ? 0.35 : (isRapidFireClass ? 0.3 : 0.22))); 
        ctx.scale(lengthSqueeze, widthSqueeze);
        if (isRapidFireClass && this.barrelHeat[i] > 0.15) {
            const vib = this.barrelHeat[i] * 0.55;
            ctx.translate((Math.random() - 0.5) * vib, (Math.random() - 0.5) * vib);
        }
        
        const isColossalCarrier = this.classType === TankClass.COLOSSAL && this.isTransformed;
        const isDroneSpawner = (this.classType === TankClass.OVERLORD || this.classType === TankClass.OVERSEER || this.classType === TankClass.MANAGER || this.classType === TankClass.HYBRID || isColossalCarrier);
        const droneBarrelIndex = (this.classType === TankClass.HYBRID) ? 1 : -1; 
        const currentIsDroneBarrel = isDroneSpawner && (
          (this.classType === TankClass.HYBRID && i === droneBarrelIndex) ||
          (isColossalCarrier && i > 0) ||
          (this.classType !== TankClass.HYBRID && !isColossalCarrier)
        );

        let bLen = length * this.radius;
        let bWid = width * this.radius;
        // Rebirth chassis safety clamp: barrels must stay within chassis silhouette.
        if (isBoss) {
            const maxLen = isColossal
              ? this.radius * 1.02
              : isLeviathan
                ? this.radius * 0.92
                : isWarlord
                  ? this.radius * 0.98
                  : isObliterator
                    ? this.radius * 1.08
                    : this.radius * 0.94; // celestial/other
            const maxWid = isColossal
              ? this.radius * 0.44
              : isLeviathan
                ? this.radius * 0.38
                : isWarlord
                  ? this.radius * 0.4
                  : isObliterator
                    ? this.radius * 0.46
                    : this.radius * 0.36; // celestial/other
            bLen = Math.min(bLen, maxLen);
            bWid = Math.min(bWid, maxWid);
        }
        const strokeCol = (isEliteVisual || isBoss) ? (isBoss ? '#222' : '#ff4444') : COLORS.border;
        const baseFill = (isEliteVisual || isBoss) ? (isBoss ? '#444' : '#333333') : (currentIsDroneBarrel ? '#444444' : COLORS.barrel);

        ctx.lineWidth = 3;
        ctx.strokeStyle = strokeCol;
        
        const heat = this.barrelHeat[i] || 0;
        let fillStyle: any = baseFill;

        if ((isHeavyClass || isBoss) && !currentIsDroneBarrel) {
            const grad = ctx.createLinearGradient(0, 0, bLen, 0);
            const bossBase = isColossal ? '#3b2e2a' : isLeviathan ? '#1f3a4a' : isWarlord ? '#3f1f28' : isCelestial ? '#2a1f46' : isObliterator ? '#1a0f2e' : baseFill;
            grad.addColorStop(0, bossBase);
            if (heat > 0.1) {
                const heatCol = `rgba(255, ${Math.floor(100 + heat * 155)}, ${Math.floor(50 + heat * 50)}, ${Math.min(1, heat)})`;
                const hotCenter = `rgba(255, 255, 255, ${Math.min(1, heat * 1.5)})`;
                grad.addColorStop(0.6, bossBase);
                grad.addColorStop(0.85, heatCol);
                grad.addColorStop(1.0, hotCenter);
            } else {
                const tip = isColossal ? '#f5d0a9' : isLeviathan ? '#9be7ff' : isWarlord ? '#ff9aa8' : isCelestial ? '#e9d5ff' : isObliterator ? '#f5d0fe' : '#bbb';
                grad.addColorStop(1.0, tip);
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

        if (isReaper) {
            const pulse = 0.5 + Math.sin(Date.now() * 0.009 + i * 0.8) * 0.5;
            const bloodGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            bloodGrad.addColorStop(0, '#210606');
            bloodGrad.addColorStop(0.48, '#7f1d1d');
            bloodGrad.addColorStop(0.82, '#ef4444');
            bloodGrad.addColorStop(1, '#fee2e2');
            ctx.fillStyle = bloodGrad;
            ctx.strokeStyle = 'rgba(20,8,8,0.95)';
            ctx.lineWidth = 2.6;

            if (i === 0) {
                ctx.beginPath();
                ctx.roundRect(-bLen * 0.04, -bWid * 0.52, bLen * 0.38, bWid * 1.04, bWid * 0.22);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(bLen * 0.24, -bWid * 0.42);
                ctx.lineTo(bLen * 0.82, -bWid * 0.28);
                ctx.lineTo(bLen, 0);
                ctx.lineTo(bLen * 0.82, bWid * 0.28);
                ctx.lineTo(bLen * 0.24, bWid * 0.42);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = `rgba(252,165,165,${0.2 + pulse * 0.36})`;
                ctx.fillRect(bLen * 0.38, -bWid * 0.08, bLen * 0.44, bWid * 0.16);
            } else {
                const hook = i === 1 ? -1 : 1;
                ctx.beginPath();
                ctx.moveTo(0, -bWid * 0.42);
                ctx.quadraticCurveTo(bLen * 0.44, -hook * bWid * 0.82, bLen * 0.88, -hook * bWid * 0.28);
                ctx.lineTo(bLen, 0);
                ctx.quadraticCurveTo(bLen * 0.5, hook * bWid * 0.44, 0, bWid * 0.42);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = `rgba(255,255,255,${0.1 + pulse * 0.2})`;
                ctx.beginPath();
                ctx.arc(bLen * 0.78, -hook * bWid * 0.12, Math.max(2, bWid * 0.12), 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (isColossal && !currentIsDroneBarrel) {
            // Colossal front juggernaut cannon: step-reinforced annihilator artillery.
            const pulse = 0.5 + Math.sin(Date.now() * 0.005 + i * 0.6) * 0.5;
            const core = ctx.createLinearGradient(0, 0, bLen, 0);
            core.addColorStop(0, '#3f0f46');
            core.addColorStop(0.5, '#db2777');
            core.addColorStop(1, '#ffe4f1');
            ctx.fillStyle = core;

            ctx.beginPath();
            ctx.roundRect(-bLen * 0.04, -bWid * 0.72, bLen * 0.28, bWid * 1.44, bWid * 0.26);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(bLen * 0.16, -bWid * 0.56);
            ctx.lineTo(bLen * 0.76, -bWid * 0.44);
            ctx.lineTo(bLen * 0.92, -bWid * 0.66);
            ctx.lineTo(bLen, -bWid * 0.48);
            ctx.lineTo(bLen, bWid * 0.48);
            ctx.lineTo(bLen * 0.92, bWid * 0.66);
            ctx.lineTo(bLen * 0.76, bWid * 0.44);
            ctx.lineTo(bLen * 0.16, bWid * 0.56);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = `rgba(255, 182, 193, ${0.24 + pulse * 0.3})`;
            ctx.fillRect(bLen * 0.3, -bWid * 0.1, bLen * 0.52, bWid * 0.2);
            ctx.fillStyle = 'rgba(45, 12, 24, 0.82)';
            ctx.fillRect(bLen * 0.26, -bWid * 0.62, bLen * 0.56, Math.max(2, bWid * 0.14));
            ctx.fillRect(bLen * 0.26, bWid * 0.48, bLen * 0.56, Math.max(2, bWid * 0.14));
        } else if (isCelestial && !currentIsDroneBarrel) {
            // Celestial artillery: tapered containment barrel with base collar, shroud, rails and muzzle bloom.
            const pulse = 0.5 + Math.sin(Date.now() * 0.006 + i) * 0.5;
            const bodyGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            bodyGrad.addColorStop(0, '#1e1b4b');
            bodyGrad.addColorStop(0.42, '#6d28d9');
            bodyGrad.addColorStop(0.76, `rgba(125,211,252,${0.38 + pulse * 0.3})`);
            bodyGrad.addColorStop(1, '#f8fafc');
            ctx.fillStyle = bodyGrad;

            // Heavy base collar.
            ctx.beginPath();
            ctx.roundRect(-bLen * 0.04, -bWid * 0.72, bLen * 0.26, bWid * 1.44, bWid * 0.22);
            ctx.fill();
            ctx.stroke();

            // Main tapered barrel shell.
            ctx.beginPath();
            ctx.moveTo(bLen * 0.14, -bWid * 0.5);
            ctx.lineTo(bLen * 0.74, -bWid * 0.38);
            ctx.lineTo(bLen * 0.92, -bWid * 0.62);
            ctx.lineTo(bLen, -bWid * 0.44);
            ctx.lineTo(bLen, bWid * 0.44);
            ctx.lineTo(bLen * 0.92, bWid * 0.62);
            ctx.lineTo(bLen * 0.74, bWid * 0.38);
            ctx.lineTo(bLen * 0.14, bWid * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Side reinforcing rails.
            ctx.fillStyle = 'rgba(15,23,42,0.84)';
            ctx.fillRect(bLen * 0.26, -bWid * 0.64, bLen * 0.56, Math.max(2, bWid * 0.14));
            ctx.fillRect(bLen * 0.26, bWid * 0.5, bLen * 0.56, Math.max(2, bWid * 0.14));
            ctx.strokeRect(bLen * 0.26, -bWid * 0.64, bLen * 0.56, Math.max(2, bWid * 0.14));
            ctx.strokeRect(bLen * 0.26, bWid * 0.5, bLen * 0.56, Math.max(2, bWid * 0.14));

            // Energy conduit.
            ctx.fillStyle = `rgba(216,180,254,${0.22 + pulse * 0.36})`;
            ctx.fillRect(bLen * 0.3, -bWid * 0.09, bLen * 0.54, bWid * 0.18);

            // Flared muzzle shroud.
            ctx.beginPath();
            ctx.roundRect(bLen * 0.88, -bWid * 0.78, bLen * 0.12, bWid * 1.56, bWid * 0.18);
            ctx.fillStyle = `rgba(248,250,252,${0.22 + heat * 0.55 + pulse * 0.18})`;
            ctx.fill();
            ctx.stroke();
        } else if (isObliterator && !currentIsDroneBarrel) {
            // Keep Obliterator cannon visually front-anchored to avoid rear-side protrusion.
            ctx.translate(this.radius * 0.52, 0);
            bLen = Math.min(bLen, this.radius * 0.92);
            bWid = Math.min(bWid, this.radius * 0.4);
            // Obliterator: hollow-purple siege bore with split-prism muzzle.
            const pulse = 0.5 + Math.sin(Date.now() * 0.008 + i * 0.7) * 0.5;
            const bodyGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            bodyGrad.addColorStop(0, '#12081f');
            bodyGrad.addColorStop(0.36, '#6d28d9');
            bodyGrad.addColorStop(0.7, '#a855f7');
            bodyGrad.addColorStop(1, '#f5d0fe');
            ctx.fillStyle = bodyGrad;

            // Core receiver block.
            ctx.beginPath();
            ctx.roundRect(0, -bWid * 0.78, bLen * 0.3, bWid * 1.56, bWid * 0.24);
            ctx.fill();
            ctx.stroke();

            // Main tapered barrel shell.
            ctx.beginPath();
            ctx.moveTo(bLen * 0.18, -bWid * 0.56);
            ctx.lineTo(bLen * 0.72, -bWid * 0.46);
            ctx.lineTo(bLen * 0.9, -bWid * 0.7);
            ctx.lineTo(bLen, -bWid * 0.48);
            ctx.lineTo(bLen, bWid * 0.48);
            ctx.lineTo(bLen * 0.9, bWid * 0.7);
            ctx.lineTo(bLen * 0.72, bWid * 0.46);
            ctx.lineTo(bLen * 0.18, bWid * 0.56);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Twin rail braces.
            ctx.fillStyle = 'rgba(17,24,39,0.82)';
            ctx.fillRect(bLen * 0.24, -bWid * 0.68, bLen * 0.58, Math.max(2, bWid * 0.14));
            ctx.fillRect(bLen * 0.24, bWid * 0.54, bLen * 0.58, Math.max(2, bWid * 0.14));
            ctx.strokeRect(bLen * 0.24, -bWid * 0.68, bLen * 0.58, Math.max(2, bWid * 0.14));
            ctx.strokeRect(bLen * 0.24, bWid * 0.54, bLen * 0.58, Math.max(2, bWid * 0.14));

            // Hollow purple conduit.
            ctx.fillStyle = `rgba(216, 180, 254, ${0.25 + pulse * 0.34})`;
            ctx.fillRect(bLen * 0.3, -bWid * 0.1, bLen * 0.52, bWid * 0.2);

            // Split prism muzzle flare.
            ctx.beginPath();
            ctx.moveTo(bLen * 0.9, -bWid * 0.74);
            ctx.lineTo(bLen, -bWid * 0.92);
            ctx.lineTo(bLen, -bWid * 0.3);
            ctx.closePath();
            ctx.fillStyle = `rgba(233,213,255,${0.24 + pulse * 0.22})`;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(bLen * 0.9, bWid * 0.74);
            ctx.lineTo(bLen, bWid * 0.92);
            ctx.lineTo(bLen, bWid * 0.3);
            ctx.closePath();
            ctx.fill();
        } else if (isLeviathan && !currentIsDroneBarrel) {
            // Leviathan: broad pressure-lance barrel with hydraulic ribs.
            const pulse = 0.5 + Math.sin(Date.now() * 0.005 + i * 0.85) * 0.5;
            const shell = ctx.createLinearGradient(0, 0, bLen, 0);
            shell.addColorStop(0, '#0b2b3a');
            shell.addColorStop(0.5, '#0ea5c9');
            shell.addColorStop(1, '#dbeafe');
            ctx.fillStyle = shell;
            ctx.beginPath();
            ctx.moveTo(0, -bWid * 0.56);
            ctx.lineTo(bLen * 0.86, -bWid * 0.48);
            ctx.lineTo(bLen, -bWid * 0.2);
            ctx.lineTo(bLen, bWid * 0.2);
            ctx.lineTo(bLen * 0.86, bWid * 0.48);
            ctx.lineTo(0, bWid * 0.56);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = `rgba(125,211,252,${0.2 + pulse * 0.25})`;
            ctx.fillRect(bLen * 0.14, -bWid * 0.09, bLen * 0.62, bWid * 0.18);
            ctx.fillStyle = 'rgba(12, 23, 42, 0.8)';
            ctx.fillRect(bLen * 0.22, -bWid * 0.62, bLen * 0.5, Math.max(2, bWid * 0.12));
            ctx.fillRect(bLen * 0.22, bWid * 0.5, bLen * 0.5, Math.max(2, bWid * 0.12));
        } else if (isWarlord && !currentIsDroneBarrel) {
            // Warlord: siege cannon profile with reinforced mantle.
            const shell = ctx.createLinearGradient(0, 0, bLen, 0);
            shell.addColorStop(0, '#3f1f28');
            shell.addColorStop(0.52, '#be123c');
            shell.addColorStop(1, '#fecdd3');
            ctx.fillStyle = shell;
            ctx.beginPath();
            ctx.roundRect(0, -bWid * 0.54, bLen * 0.9, bWid * 1.08, bWid * 0.2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(30, 10, 18, 0.85)';
            ctx.fillRect(bLen * 0.12, -bWid * 0.62, bLen * 0.48, Math.max(2, bWid * 0.14));
            ctx.fillRect(bLen * 0.12, bWid * 0.48, bLen * 0.48, Math.max(2, bWid * 0.14));
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(bLen * 0.72, -bWid * 0.2, bLen * 0.18, bWid * 0.4);
            ctx.strokeRect(bLen * 0.72, -bWid * 0.2, bLen * 0.18, bWid * 0.4);
        } else if (isSprayer && !currentIsDroneBarrel) {
            const isCore = i === sprayerCoreIndex;
            const heatMix = Math.min(1, heat * 1.15 + (isCore ? 0.14 : 0));
            const shellGrad = ctx.createLinearGradient(0, 0, bLen, 0);
            shellGrad.addColorStop(0, isCore ? '#1f3048' : '#303841');
            shellGrad.addColorStop(0.5, isCore ? '#79bae2' : '#8c97ab');
            shellGrad.addColorStop(1, `rgba(212, ${Math.floor(220 + heatMix * 35)}, 255, ${0.38 + heatMix * 0.28})`);
            ctx.fillStyle = shellGrad;

            const w = isCore ? bWid * 0.72 : bWid * 1.08;
            const nose = isCore ? 0.2 : 0.14;
            ctx.beginPath();
            ctx.moveTo(isCore ? bLen * 0.06 : -bLen * 0.04, -w * 0.5);
            ctx.lineTo(bLen * (1 - nose), -w * 0.5);
            ctx.lineTo(bLen, -w * 0.23);
            ctx.lineTo(bLen, w * 0.23);
            ctx.lineTo(bLen * (1 - nose), w * 0.5);
            ctx.lineTo(isCore ? bLen * 0.06 : -bLen * 0.04, w * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Metallic trim rails and vent strip.
            ctx.fillStyle = isCore ? 'rgba(222,242,255,0.24)' : 'rgba(188,214,240,0.22)';
            ctx.fillRect(bLen * 0.1, -w * 0.42, bLen * 0.74, Math.max(1.4, w * 0.12));
            ctx.fillRect(bLen * 0.1, w * 0.3, bLen * 0.74, Math.max(1.4, w * 0.12));
            ctx.fillStyle = `rgba(120, 200, 255, ${0.16 + heatMix * 0.2})`;
            ctx.fillRect(bLen * 0.22, -w * 0.06, bLen * 0.52, w * 0.12);
            if (!isCore) {
                ctx.strokeStyle = 'rgba(15,23,42,0.78)';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(bLen * 0.18, -w * 0.48, bLen * 0.22, w * 0.96);
            }
        } else if (isTrapperBranch && !currentIsDroneBarrel) {
            const accent = this.team === Team.NONE ? '#60a5fa' : getTeamProjectileColor(this.team);
            const isMachineTrapper = this.classType === TankClass.MACHINE_GUN_TRAPPER;
            const isHeavyTrapper = this.classType === TankClass.DUAL_TRAPPER || this.classType === TankClass.OCTO_TRAPPER || this.classType === TankClass.TRIPLE_TRAPPER;
            const shellLen = bLen * (isMachineTrapper ? 1.16 : isHeavyTrapper ? 1.22 : 1.12);
            const shellWid = bWid * (isMachineTrapper ? 1.08 : isHeavyTrapper ? 1.22 : 1.14);
            const bodyGrad = ctx.createLinearGradient(0, 0, shellLen, 0);
            bodyGrad.addColorStop(0, isMachineTrapper ? '#1f2937' : '#202b38');
            bodyGrad.addColorStop(0.34, '#e2e8f0');
            bodyGrad.addColorStop(0.66, '#8e9aab');
            bodyGrad.addColorStop(1, '#2b3645');
            ctx.fillStyle = bodyGrad;
            ctx.strokeStyle = strokeCol;
            ctx.lineWidth = 2.2;

            ctx.beginPath();
            ctx.moveTo(-shellLen * 0.04, -shellWid * 0.46);
            ctx.lineTo(shellLen * 0.54, -shellWid * 0.46);
            ctx.lineTo(shellLen * 0.68, -shellWid * 0.6);
            ctx.lineTo(shellLen * 0.88, -shellWid * 0.6);
            ctx.lineTo(shellLen, -shellWid * 0.24);
            ctx.lineTo(shellLen, shellWid * 0.24);
            ctx.lineTo(shellLen * 0.88, shellWid * 0.6);
            ctx.lineTo(shellLen * 0.68, shellWid * 0.6);
            ctx.lineTo(shellLen * 0.54, shellWid * 0.46);
            ctx.lineTo(-shellLen * 0.04, shellWid * 0.46);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(15,23,42,0.82)';
            ctx.fillRect(shellLen * 0.56, -shellWid * 0.46, shellLen * 0.08, shellWid * 0.92);
            ctx.fillRect(shellLen * 0.78, -shellWid * 0.54, shellLen * 0.07, shellWid * 1.08);

            if (isMachineTrapper) {
                ctx.fillStyle = 'rgba(15,23,42,0.78)';
                for (let slot = 0.16; slot <= 0.86; slot += 0.12) {
                    ctx.fillRect(shellLen * slot, -shellWid * 0.32, shellLen * 0.026, shellWid * 0.64);
                }
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(shellLen * 0.08, -shellWid * 0.08, shellLen * 0.44, shellWid * 0.16);
            } else if (isHeavyTrapper) {
                ctx.fillStyle = 'rgba(255,255,255,0.14)';
                ctx.fillRect(shellLen * 0.12, -shellWid * 0.28, shellLen * 0.34, shellWid * 0.1);
                ctx.fillRect(shellLen * 0.12, shellWid * 0.18, shellLen * 0.34, shellWid * 0.1);
                ctx.strokeStyle = 'rgba(15,23,42,0.82)';
                ctx.lineWidth = 1.6;
                ctx.strokeRect(shellLen * 0.18, -shellWid * 0.56, shellLen * 0.18, shellWid * 0.2);
                ctx.strokeRect(shellLen * 0.18, shellWid * 0.36, shellLen * 0.18, shellWid * 0.2);
            }

            ctx.fillStyle = `${accent}78`;
            ctx.beginPath();
            ctx.moveTo(shellLen * 0.06, -shellWid * 0.18);
            ctx.lineTo(shellLen * 0.46, -shellWid * 0.18);
            ctx.lineTo(shellLen * 0.52, 0);
            ctx.lineTo(shellLen * 0.46, shellWid * 0.18);
            ctx.lineTo(shellLen * 0.06, shellWid * 0.18);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(15,23,42,0.88)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(shellLen * 0.94, -shellWid * 0.15);
            ctx.lineTo(shellLen * 0.94, shellWid * 0.15);
            ctx.stroke();
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

      if (this.classType === TankClass.CELESTIAL) {
        if (this.autoTurrets.length !== 6) {
            this.autoTurrets = Array.from({ length: 6 }, (_, idx) => ({
                rotation: this.rotation + (idx / 6) * Math.PI * 2,
                cooldown: 0,
                targetId: null,
            }));
        }

        const engine = (window as any).gameEngine as GameEngine | undefined;
        const isBot = this.type !== EntityType.PLAYER;
        const botsDisabled = engine && engine.gameMode === GameMode.SANDBOX && !engine.sandboxConfig.botsEnabled;
        const simStepSec = 1 / 60;

        if (engine && !(isBot && botsDisabled)) {
            const neighbors = engine.spatialGrid.getNeighbors(this);
            this.autoTurrets.forEach((turret, idx) => {
                if (turret.cooldown > 0) turret.cooldown -= simStepSec * 1000;

                const range = turret.targetId !== null ? 1040 : 920;
                const targets = neighbors.filter((e: Entity) => {
                    if (!e || e.id === this.id || e.isDead) return false;
                    if (Vector.dist(this.pos, e.pos) > range) return false;
                    if (e.type === EntityType.BULLET) return e.team !== this.team;
                    if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK || e.type === EntityType.GUARDIAN) {
                        return engine.gameMode === GameMode.FFA || e.team !== this.team;
                    }
                    return e.type === EntityType.SHAPE || e.type === EntityType.BOSS || e.type === EntityType.CRASHER;
                });

                const target = targets.sort((a: Entity, b: Entity) => {
                    const score = (e: Entity) => {
                        if (e.type === EntityType.BULLET) {
                            const toTank = Vector.normalize(Vector.sub(this.pos, e.pos));
                            const bulletDir = Vector.normalize(e.vel || { x: 0, y: 0 });
                            return Vector.dot(bulletDir, toTank) > 0.7 ? -2 : 4;
                        }
                        if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK) {
                            const hp = e.maxHealth > 0 ? e.health / e.maxHealth : 1;
                            return hp < 0.42 ? 0 : 1;
                        }
                        if (e.type === EntityType.BOSS) return 1.35;
                        if (e.type === EntityType.CRASHER) return 2.2;
                        if (e.type === EntityType.SHAPE) {
                            const shape = e as Shape;
                            const isAlphaPentagon = shape.shapeType === ShapeType.PENTAGON && shape.rarity === ShapeRarity.LEGENDARY;
                            if (isAlphaPentagon) return 1.6;
                            switch (shape.shapeType) {
                                case ShapeType.DODECAGON: return 1.18;
                                case ShapeType.DECAGON: return 1.26;
                                case ShapeType.NONAGON: return 1.34;
                                case ShapeType.OCTAGON: return 1.45;
                                case ShapeType.HEXAGON: return 1.6;
                                case ShapeType.HEPTAGON: return 1.7;
                                case ShapeType.PENTAGON: return 1.8;
                                case ShapeType.STAR: return 2.18;
                                case ShapeType.DIAMOND: return 2.55;
                                default: return 3;
                            }
                        }
                        return 3;
                    };
                    const diff = score(a) - score(b);
                    return diff !== 0 ? diff : Vector.dist(this.pos, a.pos) - Vector.dist(this.pos, b.pos);
                })[0];

                if (target) {
                    turret.targetId = target.id;
                    const bSpeed = (BASE_STATS.bulletSpeed + this.stats[StatType.BULLET_SPEED] * 0.8) * 1.82;
                    const aimPoint = engine.getInterceptPoint(this.pos, bSpeed, target.pos, target.vel || { x: 0, y: 0 });
                    const desired = Math.atan2(aimPoint.y - this.pos.y, aimPoint.x - this.pos.x);
                    let diff = desired - turret.rotation;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    turret.rotation += diff * Math.min(1, simStepSec * 9.5);

                    if (turret.cooldown <= 0 && Math.abs(diff) < 0.36) {
                        const muzzleAnchor = this.radius * 0.92;
                        const sideAngle = (idx / 6) * Math.PI * 2 + Date.now() * 0.00008;
                        const mount = {
                            x: this.pos.x + Math.cos(sideAngle) * muzzleAnchor,
                            y: this.pos.y + Math.sin(sideAngle) * muzzleAnchor,
                        };
                        const forward = Vector.fromAngle(turret.rotation);
                        const tip = Vector.add(mount, Vector.mult(forward, this.radius * 0.32));
                        const bullet = new Bullet(
                            engine.nextId(),
                            tip.x,
                            tip.y,
                            Vector.mult(forward, bSpeed),
                            this,
                            1.42,
                            1.25,
                            0.74,
                            0
                        );
                        bullet.maxHealth *= 1.85;
                        bullet.health = bullet.maxHealth;
                        engine.entities.push(bullet);
                        turret.cooldown = Math.max(62, (BASE_STATS.reload - this.stats[StatType.RELOAD] * 2.5) * 11.5 + idx * 4);

                        if (this === engine.player || engine.isOnScreen(this.pos)) {
                            engine.particles.push(new Particle(tip.x, tip.y, 'rgba(216,180,254,0.62)', 7, 7, 'FLASH'));
                            engine.sound.playShoot(TankClass.GUNNER, engine.getAudioSpatialOptions(this.pos, false));
                        }
                    }
                } else {
                    turret.targetId = null;
                    turret.rotation += simStepSec * (0.55 + idx * 0.03);
                }
            });
        }
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
      const isRebirthBoss = this.isBossClass(this.classType);
      if (isRebirthBoss) {
          const r = this.radius;
          if (this.isTransformed) {
              ctx.save();
              ctx.globalAlpha = 0.32;
              ctx.fillStyle = "rgba(0,0,0,0.55)";
              ctx.beginPath();
              if (this.classType === TankClass.LEVIATHAN) {
                  for (let i = 0; i < 10; i++) {
                      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
                      const rr = (i % 2 === 0 ? 0.95 : 0.48) * r;
                      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
                  }
              } else if (this.classType === TankClass.WARLORD) {
                  ctx.moveTo(r * 0.9, 0);
                  ctx.lineTo(-r * 0.62, -r * 0.78);
                  ctx.lineTo(-r * 0.62, r * 0.78);
              } else if (this.classType === TankClass.CELESTIAL) {
                  for (let i = 0; i < 5; i++) {
                      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
                      const rr = r * 0.86;
                      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
                  }
              } else {
                  ctx.moveTo(r * 0.86, 0);
                  ctx.lineTo(0, -r * 0.8);
                  ctx.lineTo(-r * 0.86, 0);
                  ctx.lineTo(0, r * 0.8);
              }
              ctx.closePath();
              ctx.fill();
              ctx.restore();
          }

          ctx.save();
          ctx.fillStyle = this.color;
          ctx.strokeStyle = COLORS.border;
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (this.classType === TankClass.LEVIATHAN) {
              for (let i = 0; i < 10; i++) {
                  const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
                  const rr = (i % 2 === 0 ? 0.78 : 0.4) * r;
                  if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                  else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
              }
          } else if (this.classType === TankClass.WARLORD) {
              ctx.moveTo(r * 0.72, 0);
              ctx.lineTo(-r * 0.5, -r * 0.62);
              ctx.lineTo(-r * 0.5, r * 0.62);
          } else if (this.classType === TankClass.CELESTIAL) {
              for (let i = 0; i < 5; i++) {
                  const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
                  const rr = r * 0.72;
                  if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                  else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
              }
          } else {
              ctx.moveTo(r * 0.7, 0);
              ctx.lineTo(0, -r * 0.66);
              ctx.lineTo(-r * 0.7, 0);
              ctx.lineTo(0, r * 0.66);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // subtle core highlight, but no circular cap silhouette.
          ctx.fillStyle = "rgba(255,255,255,0.14)";
          ctx.beginPath();
          if (this.classType === TankClass.WARLORD) {
              ctx.moveTo(r * 0.34, 0);
              ctx.lineTo(-r * 0.2, -r * 0.24);
              ctx.lineTo(-r * 0.2, r * 0.24);
          } else if (this.classType === TankClass.CELESTIAL) {
              for (let i = 0; i < 5; i++) {
                  const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
                  const rr = r * 0.32;
                  if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                  else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
              }
          } else if (this.classType === TankClass.LEVIATHAN) {
              for (let i = 0; i < 10; i++) {
                  const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
                  const rr = (i % 2 === 0 ? 0.34 : 0.2) * r;
                  if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                  else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
              }
          } else {
              ctx.moveTo(r * 0.3, 0);
              ctx.lineTo(0, -r * 0.28);
              ctx.lineTo(-r * 0.3, 0);
              ctx.lineTo(0, r * 0.28);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          return;
      }

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
    this.drawAutoTurretOverlay(ctx);

    ctx.restore();
    
    if (this.health < this.maxHealth && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL) this.drawHealthBar(ctx);
    if (this.name && this.type !== EntityType.BULLET && this.type !== EntityType.DRONE && this.type !== EntityType.MINI_TANK && this.type !== EntityType.GUARDIAN && this.type !== EntityType.VOID_PORTAL) this.drawName(ctx);
  }

  isPacifist(cls: TankClass): boolean {
    return cls === TankClass.PACIFIST_TRAINEE || cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR;
  }

  isBossClass(cls: TankClass): boolean {
    return cls === TankClass.COLOSSAL || cls === TankClass.LEVIATHAN || cls === TankClass.WARLORD || cls === TankClass.CELESTIAL || cls === TankClass.OBLITERATOR;
  }

  isDraining(cls: TankClass): boolean {
    return cls === TankClass.DRAINER_TRAINEE || cls === TankClass.LEECH || cls === TankClass.VAMPIRE || cls === TankClass.REAPER;
  }

  hasRestorationSector(): boolean {
    return this.secondarySector === 'restoration' || this.isPacifist(this.classType);
  }

  hasBloodSector(): boolean {
    return this.secondarySector === 'blood' || this.isDraining(this.classType);
  }

  getSecondarySectorTier(): number {
    if (!this.hasRestorationSector() && !this.hasBloodSector()) return 0;
    if (this.level >= 60) return 3;
    if (this.level >= 45) return 2;
    if (this.level >= 30) return 1;
    return 0;
  }

  override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
    let adjusted = amount;
    if (this.isBossClass(this.classType)) {
      const mitigation = this.classType === TankClass.CELESTIAL ? 0.14 : this.classType === TankClass.OBLITERATOR ? 0.18 : 0.1;
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
    const engine = (window as any).gameEngine as GameEngine | undefined;
    const ownerId = resolveDamageOwnerId(engine, sourceId);
    if (ownerId !== null && adjusted > 0) {
      this.damageDealtBy.set(ownerId, (this.damageDealtBy.get(ownerId) || 0) + adjusted);
    }
    super.takeDamage(adjusted, sourceId, isBodyDamage);
  }

    updateStats() {
    const powerTokenBuff = this.activeBuffs?.find(b => b.type === 'POWER_TOKEN');
    const bossOverrideBuff = this.activeBuffs?.find(b => b.type === 'BOSS_OVERRIDE');
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
    const hasRestorationSector = this.hasRestorationSector();
    const hasBloodSector = this.hasBloodSector();
    const sectorTier = this.getSecondarySectorTier();
    this.healingAuraRadius = 0;
    this.healingAuraEfficiency = 0;
    this.drainAuraRadius = 0;
    this.drainAuraDamage = 0;
    this.drainLifestealEfficiency = 0;

    // Body-damage scaling should feel meaningful without turning contact into instant deletion.
    const inertiaFactor = 0.94 + (this.radius / 20) * 0.06;
    const bodyLevelFactor = 1.0 + (this.level - 1) * 0.0075;

    if (isBoss) {
        this.team = Team.NONE;
        // Rebirth boss chassis: dangerous, durable, but now killable.
        const bossBaseHealth =
            this.classType === TankClass.COLOSSAL ? 5200 :
            this.classType === TankClass.LEVIATHAN ? 4600 :
            this.classType === TankClass.WARLORD ? 5000 :
            this.classType === TankClass.CELESTIAL ? 4300 :
            4100;
        const bossLevelHealth =
            this.classType === TankClass.COLOSSAL ? 92 :
            this.classType === TankClass.LEVIATHAN ? 84 :
            this.classType === TankClass.WARLORD ? 88 :
            this.classType === TankClass.CELESTIAL ? 80 :
            86;
        this.maxHealth = bossBaseHealth + (this.level * bossLevelHealth);
        this.maxShield = Math.round(this.maxHealth * 0.1);
        this.damage = 108;
        this.radius *= this.classType === TankClass.CELESTIAL ? 2.25 : this.classType === TankClass.OBLITERATOR ? 2.68 : 2.55;
        if (this.classType === TankClass.WARLORD) this.radius *= 1.08;
        
        // Max stats for bosses
        Object.values(StatType).forEach(s => this.stats[s as StatType] = 8);

        // Drawbacks
        if (this.classType === TankClass.COLOSSAL) this.stats[StatType.MOVEMENT_SPEED] = 2;
        if (this.classType === TankClass.LEVIATHAN) this.stats[StatType.MOVEMENT_SPEED] = 2;
        if (this.classType === TankClass.WARLORD) this.stats[StatType.MOVEMENT_SPEED] = this.isSiegeMode ? 0 : 1;
        this.stats[StatType.RELOAD] = Math.max(this.stats[StatType.RELOAD], 7);
        this.stats[StatType.BULLET_PENETRATION] = Math.max(this.stats[StatType.BULLET_PENETRATION], 7);
        this.stats[StatType.BULLET_DAMAGE] = Math.max(this.stats[StatType.BULLET_DAMAGE], 7);
        this.stats[StatType.BULLET_SPEED] = Math.max(this.stats[StatType.BULLET_SPEED], 5);
        if (this.classType === TankClass.CELESTIAL) {
            this.stats[StatType.MOVEMENT_SPEED] = 5;
            this.stats[StatType.BULLET_SPREAD] = 8;
            this.stats[StatType.RELOAD] = 8;
            this.stats[StatType.BULLET_PENETRATION] = 8;
        }
        if (this.classType === TankClass.OBLITERATOR) {
            this.stats[StatType.MOVEMENT_SPEED] = 1;
            this.stats[StatType.BULLET_SPREAD] = 8;
            this.stats[StatType.RELOAD] = 7;
            this.stats[StatType.BULLET_SPEED] = 6;
            this.stats[StatType.BULLET_DAMAGE] = 8;
            this.stats[StatType.BULLET_PENETRATION] = 8;
        }
        if (this.classType === TankClass.COLOSSAL) {
            this.color = '#ec4899';
            // Rebirth blood-core aura: localized siphon zone around Colossal.
            this.drainAuraRadius = this.radius * 2.9;
            this.drainAuraDamage = 72 + this.level * 0.9;
            this.drainLifestealEfficiency = 0.38;
        }
    } else if (this.isTransformed) {
        // Temporary boss-override transformation only.
        this.maxHealth = 2600;
        this.maxShield = 240;
        this.damage = 60; 
        this.radius *= 1.5;
    } else if (this.type === EntityType.ELITE_TANK) {
        this.team = Team.NONE;
        this.maxHealth = ELITE_TANK_HEALTH_BASE + (this.level * ELITE_TANK_HEALTH_PER_LEVEL);
        this.maxShield = ELITE_TANK_SHIELD_BASE + this.level * 4;
        this.damage = Math.round((BASE_STATS.bodyDamage + 38) * (1.03 + (this.level - 1) * 0.006));
        this.radius *= 1.42;
        this.mass = this.radius * 3.2;
        this.stats[StatType.MOVEMENT_SPEED] = 0;
        this.stats[StatType.BODY_DAMAGE] = Math.max(this.stats[StatType.BODY_DAMAGE], 4);
        this.stats[StatType.MAX_HEALTH] = Math.max(this.stats[StatType.MAX_HEALTH], 6);
        this.stats[StatType.BULLET_DAMAGE] = Math.max(this.stats[StatType.BULLET_DAMAGE], 6);
        this.stats[StatType.BULLET_PENETRATION] = Math.max(this.stats[StatType.BULLET_PENETRATION], 6);
        this.stats[StatType.RELOAD] = Math.max(this.stats[StatType.RELOAD], 5);
        this.stats[StatType.BULLET_SPEED] = Math.max(this.stats[StatType.BULLET_SPEED], 4);
        this.spread = Math.min(this.spread, 0.05);
    } else if (isPacifist) {
        // Pacifist Scaling Upgraded
        this.maxHealth = BASE_STATS.health + (this.stats[StatType.MAX_HEALTH] + statBonus) * 140 + (this.level - 1) * 10;
        this.maxShield = (this.stats[StatType.MAX_SHIELD] + statBonus) * 65; // Extra shield
        
        // Body Damage scales poorly but integrates kinetic weight and levels
        this.damage = Math.round((BASE_STATS.bodyDamage + (this.stats[StatType.BODY_DAMAGE] + statBonus) * 8) * inertiaFactor * bodyLevelFactor);
        
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
        this.damage = Math.round((BASE_STATS.bodyDamage + (this.stats[StatType.BODY_DAMAGE] + statBonus) * 10.5) * inertiaFactor * bodyLevelFactor);
        
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

        // Reaper identity pass: wider threat envelope, heavier decay pressure, slower stride.
        if (this.classType === TankClass.REAPER) {
            this.drainAuraRadius *= 1.12;
            this.drainAuraDamage *= 1.18;
            this.drainLifestealEfficiency = Math.min(0.82, this.drainLifestealEfficiency * 1.08);
            this.damage *= 1.1;
            this.stats[StatType.MOVEMENT_SPEED] = Math.max(0, this.stats[StatType.MOVEMENT_SPEED] - 1);
            this.spread = 0.075;
        }
        
        // Visual Size
        this.radius *= 1.05;
    } else {
        // Standard Scaling Upgraded
        this.maxHealth = BASE_STATS.health + (this.stats[StatType.MAX_HEALTH] + statBonus) * 105 + (this.level - 1) * 8;
        this.maxShield = (this.stats[StatType.MAX_SHIELD] + statBonus) * 50; 
        this.damage = Math.round((BASE_STATS.bodyDamage + (this.stats[StatType.BODY_DAMAGE] + statBonus) * 12) * inertiaFactor * bodyLevelFactor);
    }

    if (!isBoss && !isPacifist && hasRestorationSector) {
        this.maxHealth += 45 + sectorTier * 30;
        this.maxShield += 12 + sectorTier * 14;
        this.healingAuraRadius =
            180 +
            sectorTier * 56 +
            (this.stats[StatType.BULLET_PENETRATION] + statBonus) * 20 +
            (this.stats[StatType.RELOAD] + statBonus) * 8;
        this.healingAuraEfficiency = Math.min(
            5.6,
            1.15 +
            sectorTier * 0.62 +
            (this.stats[StatType.BULLET_DAMAGE] + statBonus) * 0.22 +
            (this.stats[StatType.REGEN] + statBonus) * 0.08
        );
    }

    if (!isBoss && !isDraining && hasBloodSector) {
        this.maxHealth += 30 + sectorTier * 26;
        this.damage *= 1 + sectorTier * 0.035;
        this.drainAuraRadius =
            165 +
            sectorTier * 52 +
            (this.stats[StatType.BULLET_PENETRATION] + statBonus) * 18 +
            (this.stats[StatType.MOVEMENT_SPEED] + statBonus) * 8;
        this.drainAuraDamage =
            7 +
            sectorTier * 7 +
            (this.stats[StatType.BULLET_DAMAGE] + statBonus) * 2.6;
        this.drainLifestealEfficiency = Math.min(
            0.42,
            0.08 +
            sectorTier * 0.05 +
            (this.stats[StatType.RELOAD] + statBonus) * 0.012 +
            (this.stats[StatType.BODY_DAMAGE] + statBonus) * 0.008
        );
    }

    // Temporary boss reward form (not rebirth class): high-pressure power spike for a short window.
    if (bossOverrideBuff && !isBoss) {
        this.maxHealth *= 2.35;
        this.maxShield *= 2.1;
        this.damage *= 1.75;
        this.radius *= 1.42;
        this.mass *= 1.85;
        this.stats[StatType.RELOAD] = Math.min(8, (this.stats[StatType.RELOAD] || 0) + 2);
        this.stats[StatType.BULLET_DAMAGE] = Math.min(8, (this.stats[StatType.BULLET_DAMAGE] || 0) + 2);
        this.stats[StatType.BULLET_PENETRATION] = Math.min(8, (this.stats[StatType.BULLET_PENETRATION] || 0) + 1);
        this.color = '#c084fc';
    }

    // Handle smooth health ratio preservation upon maximum HP growth
    if (this.health !== undefined && this.maxHealth !== oldMaxHealth) {
        const ratio = this.health / oldMaxHealth;
        this.health = Math.max(1, Math.round(this.maxHealth * ratio));
    }

    if (this.health > this.maxHealth) this.health = this.maxHealth;

    // Apply Class-Specific FOVs (smaller values zoom out, enlarging the field of view)
    if (this.classType === TankClass.SNIPER) this.fov = 0.85;
    else if (isTrapperBranchClass(this.classType)) this.fov = this.classType === TankClass.OCTO_TRAPPER ? 0.96 : this.classType === TankClass.MACHINE_GUN_TRAPPER ? 0.92 : 0.88;
    else if (this.classType === TankClass.ASSASSIN) this.fov = 0.76;
    else if (this.classType === TankClass.HUNTER) this.fov = 0.82;
    else if (this.classType === TankClass.X_HUNTER) this.fov = 0.74;
    else if (this.classType === TankClass.RANGER) this.fov = 0.62;
    else if (this.classType === TankClass.STALKER) this.fov = 0.68;
    else if (isBoss) this.fov = 0.55;
    else if (bossOverrideBuff) this.fov = 0.72;
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

  applyDrainDot(stacks: number, durationSec: number, sourceOwnerId: number | null = null) {
    this.drainDotStacks = Math.min(8, this.drainDotStacks + stacks);
    this.drainDotTimer = Math.max(this.drainDotTimer, durationSec);
    this.drainDotTickTimer = Math.min(this.drainDotTickTimer, CLASS_ABILITY_CONFIG.blood.decayTickSeconds);
    if (sourceOwnerId !== null) this.drainDotSourceOwnerId = sourceOwnerId;
    this.markDrainingStatus(Math.max(500, durationSec * 1000));
  }

  clearHostileDebuffs() {
    this.drainDotStacks = 0;
    this.drainDotTimer = 0;
    this.drainDotTickTimer = 0;
    this.drainDotSourceOwnerId = null;
    this.fxDraining = false;
    this.statusDrainingUntil = 0;
  }

  lerpAngle(a: number, b: number, t: number): number {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + (diff < -Math.PI ? diff + Math.PI * 2 : diff) * t;
  }

  override update(dt: number) {
    super.update(dt);
    if (this.invulnerableTime > 5000) this.invulnerableTime = 5000;
    
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
    if (this.rebirthDroneLaunchCooldownMs > 0) {
        this.rebirthDroneLaunchCooldownMs = Math.max(0, this.rebirthDroneLaunchCooldownMs - dt * 1000);
    }
    if (this.colossalDroneLaunchCooldownMs > 0) {
        this.colossalDroneLaunchCooldownMs = Math.max(0, this.colossalDroneLaunchCooldownMs - dt * 1000);
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
    if (this.restorationLinkCooldown > 0) this.restorationLinkCooldown -= dt;
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
            this.takeDamage(dmgPerStack * this.drainDotStacks, this.drainDotSourceOwnerId);
            this.drainDotTickTimer = tick;
        }
        if (this.drainDotTimer <= 0) {
            this.drainDotStacks = 0;
            this.drainDotTickTimer = 0;
            this.drainDotSourceOwnerId = null;
        }
    }

    const timeSinceDamage = Date.now() - this.lastDamageTime;
    if (this.maxShield > 0 && timeSinceDamage > 5000) {
        const regenMult = this.isBossClass(this.classType) ? 0.32 : 1.0;
        this.shield = Math.min(this.shield + (this.maxShield * 0.05 * regenMult), this.maxShield);
    }
    
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

    if (this.isTransformed && !this.hasRebirthed && this.transformationTimer > 0) {
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

            const neighbors = engine.spatialGrid.getNeighbors(this);
            const closeDefenseRange = turret.targetId !== null ? 1080 : 940;
            const targets = neighbors.filter((e: any) =>
                e.id !== this.id &&
                !e.isDead &&
                e.team !== this.team &&
                (e.type === EntityType.ENEMY || e.type === EntityType.PLAYER || e.type === EntityType.ELITE_TANK || e.type === EntityType.GUARDIAN || e.type === EntityType.SHAPE || e.type === EntityType.BOSS || e.type === EntityType.CRASHER) &&
                Vector.dist(this.pos, e.pos) <= closeDefenseRange
            );
            const target = targets.sort((a: Entity, b: Entity) => {
                const score = (entity: Entity): number => {
                    if (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK || entity.type === EntityType.GUARDIAN) {
                        const hpRatio = entity.maxHealth > 0 ? entity.health / entity.maxHealth : 1;
                        return hpRatio < 0.45 ? -1.2 : -0.2;
                    }
                    if (entity.type === EntityType.BOSS) return -0.1;
                    if (entity.type === EntityType.CRASHER) return 1.4;
                    if (entity.type === EntityType.SHAPE) {
                        const shape = entity as Shape;
                        if (shape.shapeType === ShapeType.DODECAGON) return 1.0;
                        if (shape.shapeType === ShapeType.DECAGON) return 1.1;
                        if (shape.shapeType === ShapeType.NONAGON) return 1.2;
                        if (shape.shapeType === ShapeType.OCTAGON) return 1.45;
                        if (shape.shapeType === ShapeType.HEXAGON) return 1.7;
                        if (shape.shapeType === ShapeType.PENTAGON) return 1.95;
                        return 3;
                    }
                    return 4;
                };
                const diff = score(a) - score(b);
                return diff !== 0 ? diff : Vector.dist(this.pos, a.pos) - Vector.dist(this.pos, b.pos);
            })[0] || null;
            if (target) {
                turret.targetId = target.id;
                const projectileSpeed = (BASE_STATS.bulletSpeed + this.stats[StatType.BULLET_SPEED] * 0.8) * 1.92;
                const aimPoint = engine.getInterceptPoint(this.pos, projectileSpeed, target.pos, target.vel || { x: 0, y: 0 });
                const angle = Math.atan2(aimPoint.y - this.pos.y, aimPoint.x - this.pos.x);
                let diff = angle - turret.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                turret.rotation += diff * Math.min(1, dt * 9.5);
                if (turret.cooldown <= 0 && Math.abs(diff) < 0.42) {
                    const forward = Vector.fromAngle(turret.rotation);
                    const tip = Vector.add(this.pos, Vector.mult(forward, this.radius * 1.2));
                    const bullet = new Bullet(engine.nextId(), tip.x, tip.y, Vector.mult(forward, projectileSpeed), this, 2.1, 1.85, 1.08);
                    bullet.maxHealth *= 1.65;
                    bullet.health = bullet.maxHealth;
                    engine.entities.push(bullet);
                    turret.cooldown = Math.max(92, (BASE_STATS.reload - this.stats[StatType.RELOAD] * 2.5) * 15.5);
                }
            } else {
                turret.targetId = null;
                turret.rotation += dt * 1.8;
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

    const buffCountBefore = this.activeBuffs.length;
    this.activeBuffs = this.activeBuffs.filter(buff => {
        buff.timeLeft -= dt;
        return buff.timeLeft > 0;
    });
    if (this.activeBuffs.length !== buffCountBefore) {
        this.updateStats();
    }
  }

  override drawBody(ctx: CanvasRenderingContext2D) { 
      this.drawMainShape(ctx);
  }
}

class EliteTank extends Tank {
    patrolPos: Vector2;
    damageDealtBy: Map<number, number> = new Map();
    classTypeOriginal: TankClass;
    eliteBrain: 'SIEGE' | 'HUNTER' | 'SKIRMISHER' | 'SUMMONER' | 'BARRAGE';
    combatAnchor: Vector2;
    strafeSign: number;
    tacticalTimer: number = 0;
    repathTimer: number = 0;
    aggressionBias: number;
    orbitPhase: number;
    patrolRadius: number;

    constructor(id: number, x: number, y: number, cls: TankClass) {
        super(id, x, y, false, Team.NONE);
        this.type = EntityType.ELITE_TANK;
        this.classType = cls;
        this.classTypeOriginal = cls;
        this.name = `Elite ${cls}`;
        this.level = 45; 
        this.maxHealth = ELITE_TANK_HEALTH_BASE + (this.level * ELITE_TANK_HEALTH_PER_LEVEL);
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.color = '#1a1a1a';
        this.damage = 60;
        this.mass = 500;
        this.patrolPos = { x, y };
        this.combatAnchor = { x, y };
        this.strafeSign = Math.random() > 0.5 ? 1 : -1;
        this.aggressionBias = 0.9 + Math.random() * 0.45;
        this.orbitPhase = Math.random() * Math.PI * 2;
        this.patrolRadius = 280 + Math.random() * 320;
        this.eliteBrain =
            cls === TankClass.DESTROYER ? 'SIEGE' :
            cls === TankClass.SNIPER ? 'HUNTER' :
            cls === TankClass.OVERLORD ? 'SUMMONER' :
            cls === TankClass.MACHINE_GUN ? 'BARRAGE' :
            'SKIRMISHER';
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

class DominionTank extends Tank {
    zoneId: number;
    homePos: Vector2;
    ownerTeam: Team = Team.NONE;
    captureStage: 'NEUTRAL' | 'OWNED' = 'NEUTRAL';
    attackRadius: number;
    zoneRadius: number;
    contestedPulse: number = 0;
    weaponProfile: DominionWeaponProfile;

    constructor(id: number, x: number, y: number, zoneId: number, zoneRadius: number, weaponProfile: DominionWeaponProfile) {
        super(id, x, y, false, Team.NONE);
        this.type = EntityType.DOMINION_TANK;
        this.zoneId = zoneId;
        this.homePos = { x, y };
        this.zoneRadius = zoneRadius;
        this.attackRadius = zoneRadius + 180;
        this.weaponProfile = weaponProfile;
        this.classType = TankClass.QUAD_TANK;
        this.name = 'Dominion Tank';
        this.level = 55;
        this.radius = DOMINION_TANK_RADIUS;
        this.mass = 999999;
        this.friction = 1;
        this.invulnerableTime = 0;
        this.color = COLORS.dominionNeutral;
        this.maxHealth = DOMINION_TANK_MAX_HEALTH;
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.damage = 96;
        this.visionRange = this.attackRadius;
        this.spread = 0.035;
        this.visualScale = 1;
        this.stats = { ...this.stats, [StatType.BULLET_SPEED]: 4, [StatType.BULLET_DAMAGE]: 4, [StatType.BULLET_PENETRATION]: 4, [StatType.RELOAD]: 4 };
        this.applyWeaponProfile();
        this.team = Team.NONE;
    }

    private getProfileLabel(): string {
        switch (this.weaponProfile) {
            case 'DESTROYER': return 'Destroyer Dominion';
            case 'GUNNER': return 'Gunner Dominion';
            case 'TRAPPER': return 'Octo Trapper';
            case 'TRIPLE':
            default:
                return 'Triple Dominion';
        }
    }

    private applyWeaponProfile() {
        switch (this.weaponProfile) {
            case 'DESTROYER':
                this.classType = TankClass.DESTROYER;
                this.radius = DOMINION_TANK_RADIUS;
                this.maxHealth = DOMINION_TANK_MAX_HEALTH;
                this.damage = 92;
                this.spread = 0.018;
                this.stats = { ...this.stats, [StatType.BULLET_SPEED]: 3, [StatType.BULLET_DAMAGE]: 4, [StatType.BULLET_PENETRATION]: 4, [StatType.RELOAD]: 3 };
                break;
            case 'GUNNER':
                this.classType = TankClass.GUNNER;
                this.radius = DOMINION_TANK_RADIUS;
                this.maxHealth = DOMINION_TANK_MAX_HEALTH;
                this.damage = 86;
                this.spread = 0.045;
                this.stats = { ...this.stats, [StatType.BULLET_SPEED]: 4, [StatType.BULLET_DAMAGE]: 3, [StatType.BULLET_PENETRATION]: 3, [StatType.RELOAD]: 4 };
                break;
            case 'TRAPPER':
                this.classType = TankClass.OCTO_TRAPPER;
                this.radius = DOMINION_TANK_RADIUS;
                this.maxHealth = DOMINION_TANK_MAX_HEALTH;
                this.damage = 72;
                this.spread = 0.008;
                this.stats = { ...this.stats, [StatType.BULLET_SPEED]: 2, [StatType.BULLET_DAMAGE]: 2, [StatType.BULLET_PENETRATION]: 5, [StatType.RELOAD]: 3 };
                break;
            case 'TRIPLE':
            default:
                this.classType = TankClass.TRIPLE_TANK;
                this.radius = DOMINION_TANK_RADIUS;
                this.maxHealth = DOMINION_TANK_MAX_HEALTH;
                this.damage = 88;
                this.spread = 0.028;
                this.stats = { ...this.stats, [StatType.BULLET_SPEED]: 4, [StatType.BULLET_DAMAGE]: 3, [StatType.BULLET_PENETRATION]: 3, [StatType.RELOAD]: 4 };
                break;
        }
        this.barrels = this.weaponProfile === 'TRAPPER'
            ? TANK_CONFIGS[TankClass.OCTO_TRAPPER]
            : TANK_CONFIGS[this.classType];
        this.barrelCooldowns = new Array(this.barrels.length).fill(0);
        this.barrelMaxCooldowns = new Array(this.barrels.length).fill(140);
        this.barrelHeat = new Array(this.barrels.length).fill(0);
        this.barrelRecoilOffsets = new Array(this.barrels.length).fill(0);
        this.visualScale = 1;
        this.mass = 999999;
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
    }

    setOwnerTeam(team: Team) {
        this.ownerTeam = team;
        this.team = team;
        this.color = team === Team.NONE ? COLORS.dominionNeutral : getTeamColor(team);
        const profileLabel = this.getProfileLabel();
        this.name = team === Team.NONE ? `Neutral ${profileLabel}` : `${team} ${profileLabel}`;
    }

    resetForStage(team: Team, owned: boolean) {
        this.captureStage = owned ? 'OWNED' : 'NEUTRAL';
        this.setOwnerTeam(team);
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.isDead = false;
        this.shouldRemove = false;
        this.lastDamageSourceId = null;
        this.damageDealtBy.clear();
        this.pos = { ...this.homePos };
        this.vel = { x: 0, y: 0 };
        this.acc = { x: 0, y: 0 };
        this.visualScale = 1;
    }

    override update(dt: number) {
        const lockedPos = { ...this.homePos };
        this.radius = DOMINION_TANK_RADIUS;
        this.maxHealth = DOMINION_TANK_MAX_HEALTH;
        this.visualScale = 1;
        this.mass = 999999;
        this.pos = lockedPos;
        this.vel = { x: 0, y: 0 };
        this.acc = { x: 0, y: 0 };
        super.update(dt);
        this.visualScale = 1;
        this.pos = lockedPos;
        this.vel = { x: 0, y: 0 };
        this.acc = { x: 0, y: 0 };
        this.contestedPulse = Math.max(0, this.contestedPulse - dt);
    }

    override drawBody(ctx: CanvasRenderingContext2D) {
        const outerGlow = this.team === Team.NONE ? 'rgba(250,204,21,0.35)' : `rgba(${getTeamRgb(this.team)},0.28)`;
        ctx.save();
        ctx.shadowBlur = 26;
        ctx.shadowColor = outerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.12, 0, Math.PI * 2);
        ctx.fillStyle = outerGlow;
        ctx.fill();
        ctx.restore();

        if (this.contestedPulse > 0) {
            ctx.save();
            ctx.strokeStyle = this.team === Team.NONE ? 'rgba(255,255,255,0.9)' : `rgba(${getTeamRgb(this.team)},0.9)`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * (1.36 + Math.sin(Date.now() * 0.01) * 0.06), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        super.drawBody(ctx);
    }

    override drawChassis(ctx: CanvasRenderingContext2D) {
        this.drawBody(ctx);
    }
}

class Crasher extends Entity {
    target: Entity | null = null;
    spawnTime: number = Date.now();
    isAlphaCrasher: boolean = false;
    xpValue: number = 0;
    damageDealtBy: Map<number, number> = new Map();

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
        this.xpValue = isAlpha ? 900 : 140;
    }

    override update(dt: number) {
        this.rotation += this.isAlphaCrasher ? 0.15 : 0.1;
        super.update(dt);
    }

    override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
        if (sourceId !== null && amount > 0) this.damageDealtBy.set(sourceId, (this.damageDealtBy.get(sourceId) || 0) + amount);
        super.takeDamage(amount, sourceId, isBodyDamage);
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
    archetype: 'SINGULARITY' | 'SIEGEBREAKER' | 'SWARMLORD';
    damageDealtBy: Map<number, number> = new Map();
    spawnTimer: number = 0;
    phaseTimer: number = 0;
    pulseCooldown: number = 0;
    summonCooldown: number = 0;
    volleyCooldown: number = 0;
    xpValue: number = 500000;
    playerDamageAccumulator: number = 0;
    playerDamageRecentTotal: number = 0;
    playerDamageSampleTimer: number = 0;
    playerDamageSamples: number[] = Array(20).fill(0);
    playerDps: number = 0;
    lastPlayerDamageAt: number = 0;

    constructor(id: number, archetype?: 'SINGULARITY' | 'SIEGEBREAKER' | 'SWARMLORD') {
        const resolved = archetype ?? (Math.random() < 0.33 ? 'SIEGEBREAKER' : Math.random() < 0.5 ? 'SWARMLORD' : 'SINGULARITY');
        const radius = resolved === 'SIEGEBREAKER' ? 188 : resolved === 'SWARMLORD' ? 176 : 198;
        super(id, EntityType.BOSS, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, radius, '#0055ff');
        this.archetype = resolved;
        this.maxHealth = resolved === 'SIEGEBREAKER' ? 205000 : resolved === 'SWARMLORD' ? 178000 : 198000;
        this.health = this.maxHealth;
        this.displayHealth = this.maxHealth;
        this.damage = resolved === 'SIEGEBREAKER' ? 168 : resolved === 'SWARMLORD' ? 132 : 148;
        this.mass = resolved === 'SIEGEBREAKER' ? 24500 : resolved === 'SWARMLORD' ? 19000 : 21500;
        this.friction = 0.995;
        this.name = resolved === 'SIEGEBREAKER' ? "GRAND SIEGEBREAKER" : resolved === 'SWARMLORD' ? "GRAND SWARMLORD" : "GRAND SINGULARITY";
        this.color = resolved === 'SIEGEBREAKER' ? '#a855f7' : resolved === 'SWARMLORD' ? '#14b8a6' : '#0055ff';
        this.pulseCooldown = resolved === 'SIEGEBREAKER' ? 4.2 : resolved === 'SWARMLORD' ? 5.4 : 5.0;
        this.summonCooldown = resolved === 'SWARMLORD' ? 7.8 : resolved === 'SINGULARITY' ? 14.0 : 10.8;
        this.volleyCooldown = resolved === 'SIEGEBREAKER' ? 3.4 : resolved === 'SWARMLORD' ? 4.4 : 7.2;
        this.pos.x += Vector.randomRange(-130, 130);
        this.pos.y += Vector.randomRange(-130, 130);
    }
    
    override takeDamage(amount: number, sourceId: number | null = null, isBodyDamage: boolean = false) {
        if (sourceId !== null && amount > 0) this.damageDealtBy.set(sourceId, (this.damageDealtBy.get(sourceId) || 0) + amount);
        if (amount > 0) {
            const engine = (window as any).gameEngine as GameEngine | undefined;
            const ownerId = this.resolveOwnerId(sourceId);
            if (engine?.player && ownerId === engine.player.id) {
                this.playerDamageAccumulator += amount;
                this.lastPlayerDamageAt = Date.now();
            }
        }
        super.takeDamage(amount, sourceId, isBodyDamage);
    }

    private resolveOwnerId(sourceId: number | null): number | null {
        if (sourceId === null) return null;
        const engine = (window as any).gameEngine as GameEngine | undefined;
        if (!engine) return sourceId;
        const source = engine.entities.find((entity: Entity) => entity.id === sourceId);
        if (!source) return sourceId;
        if ((source.type === EntityType.BULLET || source.type === EntityType.DRONE || source.type === EntityType.MINI_TANK) && 'ownerId' in source) {
            return (source as Entity & { ownerId: number }).ownerId;
        }
        if (source.type === EntityType.PLAYER || source.type === EntityType.ENEMY || source.type === EntityType.ELITE_TANK) return source.id;
        return sourceId;
    }

    private shouldShowCombatReadout(): boolean {
        if (this.isDead || this.shouldRemove) return false;
        const engine = (window as any).gameEngine as GameEngine | undefined;
        const player = engine?.player;
        if (!player || player.isDead) return false;
        if (Date.now() - this.lastPlayerDamageAt > 3600) return false;
        return Vector.dist(player.pos, this.pos) < 1400;
    }

    private drawCombatReadout(ctx: CanvasRenderingContext2D) {
        const now = Date.now();
        const visibleForMs = now - this.lastPlayerDamageAt;
        const fade = visibleForMs <= 2400 ? 1 : Math.max(0, 1 - ((visibleForMs - 2400) / 1100));
        if (fade <= 0) return;

        const label = formatCombatTargetLabel(this.name);
        const panelWidth = Math.max(150, Math.min(220, this.radius * 1.15));
        const panelHeight = 48;
        const panelX = this.pos.x - panelWidth / 2;
        const panelY = this.pos.y + this.radius + 28;
        const graphX = panelX + 9;
        const graphY = panelY + 31;
        const graphWidth = panelWidth - 18;
        const graphHeight = 9;
        const hpText = `${Math.max(0, Math.ceil(this.health))} HP`;
        const dpsText = `${Math.max(0, Math.round(this.playerDps))} DPS`;
        const maxSample = Math.max(1, ...this.playerDamageSamples);

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(2, 6, 12, 0.88)';
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.34)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.52)';
        ctx.font = '700 8px Ubuntu';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, panelX + 9, panelY + 10);

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '700 10px Ubuntu';
        ctx.fillText(hpText, panelX + 9, panelY + 21);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(dpsText, panelX + panelWidth - 9, panelY + 21);

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(graphX, graphY, graphWidth, graphHeight);

        const barGap = 1;
        const barWidth = Math.max(2, (graphWidth - (this.playerDamageSamples.length - 1) * barGap) / this.playerDamageSamples.length);
        this.playerDamageSamples.forEach((sample, index) => {
            const normalized = sample <= 0 ? 0 : sample / maxSample;
            const barHeight = Math.max(1, normalized * graphHeight);
            const x = graphX + index * (barWidth + barGap);
            const y = graphY + (graphHeight - barHeight);
            ctx.fillStyle = sample > 0 ? '#22d3ee' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(x, y, barWidth, barHeight);
        });
        ctx.restore();
    }
    
    override update(dt: number) { 
        this.playerDamageSampleTimer += dt;
        const sampleStep = 0.12;
        while (this.playerDamageSampleTimer >= sampleStep) {
            this.playerDamageSampleTimer -= sampleStep;
            const expired = this.playerDamageSamples.shift() ?? 0;
            this.playerDamageRecentTotal = Math.max(0, this.playerDamageRecentTotal - expired);
            const sample = this.playerDamageAccumulator;
            this.playerDamageAccumulator = 0;
            this.playerDamageSamples.push(sample);
            this.playerDamageRecentTotal += sample;
        }
        this.playerDps = Math.round(this.playerDamageRecentTotal / (this.playerDamageSamples.length * sampleStep));
        this.phaseTimer += dt;
        this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
        this.summonCooldown = Math.max(0, this.summonCooldown - dt);
        this.volleyCooldown = Math.max(0, this.volleyCooldown - dt);
        const hpRatio = this.health / this.maxHealth;
        this.rotation += (0.8 + (1 - hpRatio) * 1.2) * dt; 
        
        if (!(this as any).__bossRushBoss && Date.now() - this.lastDamageTime > 10000) {
            this.health = Math.min(this.health + 50 * dt * 60, this.maxHealth);
        }
        
        super.update(dt);

        const speedCap =
            this.archetype === 'SINGULARITY' ? 1.12 :
            this.archetype === 'SIEGEBREAKER' ? 1.22 :
            1.18;
        const speed = Vector.mag(this.vel);
        if (speed > speedCap) {
            this.vel = Vector.mult(Vector.normalize(this.vel), speedCap);
        }
    }

    override draw(ctx: CanvasRenderingContext2D) {
        super.draw(ctx);
        if (this.shouldShowCombatReadout()) {
            this.drawCombatReadout(ctx);
        }
    }
    
    override drawBody(ctx: CanvasRenderingContext2D) {
        const t = Date.now() / 1000;
        const hpRatio = this.health / this.maxHealth;
        const isBossRushBoss = !!(this as any).__bossRushBoss;
        const isAwakenedBossRush = !!(this as any).__bossRushAwakened;
        const rushPulse = isBossRushBoss ? 1 + Math.sin(t * (isAwakenedBossRush ? 4.4 : 2.8)) * (isAwakenedBossRush ? 0.11 : 0.06) : 1;
        
        ctx.save();
        const auraSize = this.radius * (this.archetype === 'SINGULARITY' ? 1.5 + Math.sin(t * 1.6) * 0.06 : 1.3 + Math.sin(t * 2) * 0.08) * rushPulse;
        const grad = ctx.createRadialGradient(0, 0, this.radius * 0.72, 0, 0, auraSize);
        grad.addColorStop(0, this.archetype === 'SINGULARITY' ? (isBossRushBoss ? 'rgba(160, 96, 255, 0.42)' : 'rgba(72, 163, 255, 0.38)') : isBossRushBoss ? 'rgba(255, 90, 90, 0.42)' : 'rgba(0, 85, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, auraSize, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (isBossRushBoss) {
            ctx.save();
            const haloAlpha = isAwakenedBossRush ? 0.4 : 0.24;
            ctx.rotate(-t * (this.archetype === 'SINGULARITY' ? 0.36 : this.archetype === 'SWARMLORD' ? 0.52 : 0.3));
            ctx.beginPath();
            ctx.lineWidth = this.radius * 0.09;
            ctx.strokeStyle =
                this.archetype === 'SINGULARITY' ? `rgba(212, 180, 255, ${haloAlpha})` :
                this.archetype === 'SWARMLORD' ? `rgba(110, 255, 220, ${haloAlpha})` :
                `rgba(255, 210, 210, ${haloAlpha})`;
            ctx.arc(0, 0, this.radius * (1.34 + (1 - hpRatio) * 0.08), 0, Math.PI * 1.32);
            ctx.stroke();
            ctx.restore();
        }

        if (this.archetype === 'SINGULARITY') {
            for (let ring = 0; ring < 3; ring++) {
                ctx.save();
                ctx.rotate((ring % 2 === 0 ? 1 : -1) * t * (0.28 + ring * 0.13));
                ctx.beginPath();
                ctx.lineWidth = 10 - ring * 2;
                ctx.strokeStyle = isBossRushBoss
                    ? (ring === 0 ? 'rgba(208, 168, 255, 0.74)' : ring === 1 ? 'rgba(128, 112, 255, 0.54)' : 'rgba(255,255,255,0.32)')
                    : (ring === 0 ? 'rgba(120, 210, 255, 0.62)' : ring === 1 ? 'rgba(84, 120, 255, 0.46)' : 'rgba(255,255,255,0.26)');
                ctx.arc(0, 0, this.radius * (0.72 + ring * 0.19), 0, Math.PI * (1.28 + ring * 0.2));
                ctx.stroke();
                ctx.restore();
            }

            ctx.save();
            ctx.rotate(-t * 0.42);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI * 2) / 6;
                const wobble = 0.88 + Math.sin(t * 2.2 + i * 0.8) * 0.08;
                const x = Math.cos(angle) * this.radius * wobble;
                const y = Math.sin(angle) * this.radius * wobble;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = isBossRushBoss ? 'rgba(34, 16, 74, 0.9)' : 'rgba(15, 28, 72, 0.88)';
            ctx.strokeStyle = isBossRushBoss ? 'rgba(212, 180, 255, 0.86)' : 'rgba(132, 218, 255, 0.78)';
            ctx.lineWidth = 12;
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            const corePulse = 1 + Math.sin(t * 3.6) * 0.06;
            const coreGrad = ctx.createRadialGradient(0, 0, this.radius * 0.06, 0, 0, this.radius * 0.42 * corePulse);
            coreGrad.addColorStop(0, '#ffffff');
            coreGrad.addColorStop(0.45, isBossRushBoss ? '#e9d5ff' : '#8de9ff');
            coreGrad.addColorStop(1, isBossRushBoss ? 'rgba(124, 58, 237, 0.18)' : 'rgba(55, 120, 255, 0.15)');
            ctx.beginPath();
            ctx.fillStyle = coreGrad;
            ctx.arc(0, 0, this.radius * 0.42 * corePulse, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

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
            ctx.strokeStyle = isBossRushBoss
                ? (this.archetype === 'SWARMLORD'
                    ? (j === 0 ? 'rgba(45, 212, 191, 0.72)' : 'rgba(110, 255, 220, 0.42)')
                    : (j === 0 ? 'rgba(255, 118, 118, 0.72)' : 'rgba(255, 190, 190, 0.42)'))
                : (j === 0 ? 'rgba(0, 178, 225, 0.6)' : 'rgba(118, 141, 252, 0.4)');
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
        ctx.fillStyle = isBossRushBoss
            ? (this.archetype === 'SWARMLORD'
                ? `rgba(${40 + r}, ${160 + g}, ${180 + Math.floor((1 - hpRatio) * 45)}, 0.96)`
                : this.archetype === 'SIEGEBREAKER'
                    ? `rgba(${155 + r}, ${35 + g}, ${75 + Math.floor((1 - hpRatio) * 65)}, 0.96)`
                    : `rgba(${80 + r}, ${55 + g}, ${200 + Math.floor((1 - hpRatio) * 25)}, 0.96)`)
            : `rgb(${r}, ${g}, ${b})`;
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
  rarityDamageMult: number = 1;
  rarityDriftMult: number = 1;
  raritySpinMult: number = 1;
  damageDealtBy: Map<number, number> = new Map();
  playerDamageAccumulator: number = 0;
  playerDamageSamples: number[] = Array(18).fill(0);
  playerDamageSampleTimer: number = 0;
  playerDamageRecentTotal: number = 0;
  playerDps: number = 0;
  lastPlayerDamageAt: number = 0;
  hueTimer: number = 0; 
  pulseTimer: number = 0;
  ambientTimer: number = 0;
  spawnScale: number = 0;
  deathScale: number = 1;
  isDying: boolean = false;
  deathTimer: number = 0;
  spawnFlash: number = 0;
  deathFlash: number = 0;
  static SPAWN_DURATION = 0.5;
  static DEATH_DURATION = 0.4;

  private isAlphaPentagonVariant(): boolean {
    return this.shapeType === ShapeType.PENTAGON && this.rarity === ShapeRarity.LEGENDARY;
  }

  private getDisplayLabel(): string {
    if (this.isAlphaPentagonVariant()) return 'Alpha Pentagon';
    return `${this.rarity} ${this.shapeType}`;
  }

  constructor(id: number, x: number, y: number, type: ShapeType, isInVoid: boolean = false, forceRarity?: ShapeRarity) {
    const stats = SHAPE_STATS[type];
    const alphaPentagonStats = BOSS_STATS.ALPHA_PENTAGON;
    const roll = Math.random();
    const configSource = getShapeRarityTable(type, isInVoid);
    
    let rarity = forceRarity || ShapeRarity.COMMON;
    if (!forceRarity) {
        let accumulated = 0;
        const rarities = Object.values(ShapeRarity) as ShapeRarity[];

        for (const r of rarities) {
            const chance = configSource[r].chance;
            accumulated += chance;
            if (roll < accumulated) {
                rarity = r;
                break;
            }
        }
    }

    const rarityConfig = configSource[rarity];
    const isAlphaPentagon = type === ShapeType.PENTAGON && rarity === ShapeRarity.LEGENDARY;
    const alphaRadius = alphaPentagonStats.radius * (isInVoid ? 1.12 : 1);
    const sizeMult = rarityConfig.sizeMult * (isAlphaPentagon ? (alphaRadius / stats.radius) / rarityConfig.sizeMult : 1);
    const baseColor = isAlphaPentagon ? alphaPentagonStats.color : (rarityConfig.color || stats.color);
    super(id, EntityType.SHAPE, x, y, stats.radius * sizeMult, baseColor);
    this.team = Team.NONE;
    this.friction = 0.95; 
    this.shapeType = type;
    this.rarity = rarity;
    this.rarityDamageMult = rarityConfig.damageMult;
    this.rarityDriftMult = rarityConfig.driftMult;
    this.raritySpinMult = rarityConfig.spinMult;
    this.maxHealth = isAlphaPentagon
      ? Math.floor(alphaPentagonStats.health * (isInVoid ? 1.2 : 1))
      : Math.floor(stats.health * rarityConfig.hpMult);
    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;
    this.xpValue = isAlphaPentagon
      ? Math.floor(alphaPentagonStats.xp * (isInVoid ? 1.15 : 1))
      : Math.floor(stats.xp * rarityConfig.xpMult);
    this.damage = isAlphaPentagon
      ? Math.floor(stats.damage * rarityConfig.damageMult * 2.2)
      : Math.floor(stats.damage * rarityConfig.damageMult);
    this.mass = this.radius * (isAlphaPentagon ? 4.3 : 2.5);
    this.vel = { x: 0, y: 0 };
    const driftAngle = Math.random() * Math.PI * 2;
    const driftStrength = 0.00085 * rarityConfig.driftMult * (isAlphaPentagon ? 0.72 : 1);
    this.driftVec = {
      x: Math.cos(driftAngle) * driftStrength,
      y: Math.sin(driftAngle) * driftStrength
    };
    this.hueTimer = Math.random() * 360;
    this.pulseTimer = Math.random() * Math.PI * 2;
    this.ambientTimer = Math.random() * 1000;
    this.spawnFlash = 1;
    this.name = this.getDisplayLabel();
  }

  private resolveOwnerId(sourceId: number | null): number | null {
      if (sourceId === null) return null;
      const engine = (window as any).gameEngine as GameEngine | undefined;
      const source = engine?.entities.find((entity: Entity) => entity.id === sourceId);
      if (!source) return sourceId;
      if (source.type === EntityType.BULLET) return (source as Bullet).ownerId;
      if (source.type === EntityType.DRONE || source.type === EntityType.MINI_TANK) return (source as Drone | MiniTank).owner.id;
      if (source.type === EntityType.PLAYER || source.type === EntityType.ENEMY || source.type === EntityType.ELITE_TANK) return source.id;
      return sourceId;
  }

  private shouldShowCombatReadout(): boolean {
      if (this.isDying || this.shouldRemove) return false;
      const engine = (window as any).gameEngine as GameEngine | undefined;
      const player = engine?.player;
      if (!player || player.isDead) return false;
      if (Date.now() - this.lastPlayerDamageAt > 3200) return false;
      return Vector.dist(player.pos, this.pos) < 1000;
  }

  private drawCombatReadout(ctx: CanvasRenderingContext2D) {
      const now = Date.now();
      const visibleForMs = now - this.lastPlayerDamageAt;
      const fade = visibleForMs <= 2200 ? 1 : Math.max(0, 1 - ((visibleForMs - 2200) / 1000));
      if (fade <= 0) return;

      const label = this.name || formatCombatShapeLabel(this.rarity, this.shapeType);
      const panelWidth = Math.max(110, this.radius * 2.9);
      const panelHeight = 48;
      const panelX = this.pos.x - panelWidth / 2;
      const panelY = this.pos.y + this.radius + 22;
      const hpText = `${Math.max(0, Math.ceil(this.health))} HP`;
      const dpsText = `${Math.max(0, Math.round(this.playerDps))} DPS`;
      const graphX = panelX + 8;
      const graphY = panelY + 31;
      const graphWidth = panelWidth - 16;
      const graphHeight = 9;
      const maxSample = Math.max(1, ...this.playerDamageSamples);

      ctx.save();
      ctx.globalAlpha = fade;

      ctx.fillStyle = 'rgba(2, 6, 12, 0.84)';
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.52)';
      ctx.font = '700 8px Ubuntu';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, panelX + 8, panelY + 10);

      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = 'bold 10px Ubuntu';
      ctx.fillText(hpText, panelX + 8, panelY + 21);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(dpsText, panelX + panelWidth - 8, panelY + 21);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(graphX, graphY, graphWidth, graphHeight);

      const barGap = 1;
      const barWidth = Math.max(2, (graphWidth - (this.playerDamageSamples.length - 1) * barGap) / this.playerDamageSamples.length);
      this.playerDamageSamples.forEach((sample, index) => {
          const normalized = sample <= 0 ? 0 : sample / maxSample;
          const barHeight = Math.max(1, normalized * graphHeight);
          const x = graphX + index * (barWidth + barGap);
          const y = graphY + (graphHeight - barHeight);
          ctx.fillStyle = sample > 0 ? '#22d3ee' : 'rgba(255,255,255,0.06)';
          ctx.fillRect(x, y, barWidth, barHeight);
      });

      ctx.restore();
  }

  override takeDamage(amount: number, sourceId: number | null = null) {
      if (this.isDying) return; 
      if (sourceId !== null && amount > 0) this.damageDealtBy.set(sourceId, (this.damageDealtBy.get(sourceId) || 0) + amount);
      if (amount > 0) {
          const engine = (window as any).gameEngine as GameEngine | undefined;
          const ownerId = this.resolveOwnerId(sourceId);
          if (engine?.player && ownerId === engine.player.id) {
              this.playerDamageAccumulator += amount;
              this.lastPlayerDamageAt = Date.now();
          }
      }
      
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
    this.playerDamageSampleTimer += dt;
    const sampleStep = 0.12;
    while (this.playerDamageSampleTimer >= sampleStep) {
        this.playerDamageSampleTimer -= sampleStep;
        const expired = this.playerDamageSamples.shift() ?? 0;
        this.playerDamageRecentTotal = Math.max(0, this.playerDamageRecentTotal - expired);
        const sample = this.playerDamageAccumulator;
        this.playerDamageAccumulator = 0;
        this.playerDamageSamples.push(sample);
        this.playerDamageRecentTotal += sample;
    }
    this.playerDps = Math.round(this.playerDamageRecentTotal / (this.playerDamageSamples.length * sampleStep));

    if (this.isDying) {
        this.deathTimer += dt;
        const deathProgress = Math.min(1, this.deathTimer / Shape.DEATH_DURATION);
        this.deathScale = Math.max(0, 1 - deathProgress);
        this.deathFlash = Math.max(0, 1 - deathProgress * 1.8);
        const collapseScale = 1.08 - deathProgress * 0.9;
        const wobble = Math.sin(deathProgress * Math.PI * 3.5) * 0.12 * this.deathScale;
        this.visualScale = Math.max(0, collapseScale + wobble);
        this.rotation += 0.03 + deathProgress * 0.04;
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

    this.rotation += (this.shapeType === ShapeType.OCTAGON ? 0.008 : this.shapeType === ShapeType.HEPTAGON ? 0.011 : 0.015) * this.raritySpinMult;
    this.acc.x += this.driftVec.x;
    this.acc.y += this.driftVec.y;
    this.pulseTimer += dt * 3; 
    this.spawnFlash = Math.max(0, this.spawnFlash - dt * 2.6);
    const spawnProgress = this.spawnScale;
    const easedSpawn = 1 - Math.pow(1 - spawnProgress, 3);
    const overshoot = Math.sin(Math.min(1, spawnProgress) * Math.PI) * 0.16;
    const settlePulse = Math.sin(this.pulseTimer) * 0.04;
    this.visualScale = Math.max(0.05, easedSpawn * (1.0 + overshoot + settlePulse));

    if (this.rarity === ShapeRarity.TRANSCENDENT) { this.hueTimer += dt * 120; this.rotation += 0.025 * this.raritySpinMult; }
    else if (this.rarity === ShapeRarity.ETERNAL || this.rarity === ShapeRarity.MYTHICAL) this.rotation += 0.04 * this.raritySpinMult;
    else if (this.rarity === ShapeRarity.EPIC) this.rotation += 0.01 * this.raritySpinMult;
    super.update(dt);
  }

  override draw(ctx: CanvasRenderingContext2D) {
    super.draw(ctx);
    if (this.shouldShowCombatReadout()) {
        this.drawCombatReadout(ctx);
    }
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
        case ShapeRarity.GODLY: fillColor = '#2a001f'; strokeColor = '#ff4dd2'; glowColor = '#ff00ff'; glowBlur = 120; break;
        case ShapeRarity.DIVINE: fillColor = '#130a2e'; strokeColor = '#b58cff'; glowColor = '#7c4dff'; glowBlur = 145; break;
    }

    if (this.shapeType === ShapeType.OCTAGON) {
        this.drawAdvancedOctagon(ctx, fillColor, strokeColor, glowBlur, glowColor);
        ctx.restore();
        return;
    }
    if (this.shapeType === ShapeType.STAR) {
        this.drawAdvancedStar(ctx, fillColor, strokeColor, glowBlur, glowColor);
        ctx.restore();
        return;
    }
    if (this.rarity === ShapeRarity.COMMON) {
        this.drawCommonVisuals(ctx, fillColor, strokeColor);
        ctx.restore();
        return;
    }
    if (this.shapeType === ShapeType.DIAMOND) {
        this.drawAdvancedDiamond(ctx, fillColor, strokeColor, glowBlur, glowColor);
        ctx.restore();
        return;
    }
    if (this.shapeType === ShapeType.HEPTAGON) {
        this.drawAdvancedHeptagon(ctx, fillColor, strokeColor, glowBlur, glowColor);
        ctx.restore();
        return;
    }

    if (this.rarity === ShapeRarity.UNCOMMON) this.drawUncommonVisuals(ctx);
    if (this.rarity === ShapeRarity.RARE) this.drawRareVisuals(ctx);
    if (this.rarity === ShapeRarity.EPIC) this.drawEpicVisuals(ctx);
    if (this.rarity === ShapeRarity.LEGENDARY) this.drawLegendaryVisuals(ctx);
    if (this.rarity === ShapeRarity.MYTHICAL) this.drawMythicalVisuals(ctx);
    if (this.rarity === ShapeRarity.ETERNAL) this.drawEternalVisuals(ctx);
    if (this.rarity === ShapeRarity.GODLY) this.drawGodlyVisuals(ctx);
    if (this.rarity === ShapeRarity.DIVINE) this.drawDivineVisuals(ctx);

    if (glowBlur > 0) { ctx.shadowBlur = glowBlur; ctx.shadowColor = glowColor; }

    if (!this.isDying && this.spawnFlash > 0.01) {
        ctx.save();
        ctx.globalAlpha *= this.spawnFlash * 0.45;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20 + this.spawnFlash * 22;
        ctx.shadowColor = glowColor !== 'transparent' ? glowColor : strokeColor;
        ctx.beginPath();
        const ringRadius = this.radius * (1.12 + (1 - this.spawnFlash) * 0.55);
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    if (this.isDying && this.deathFlash > 0.01) {
        ctx.save();
        ctx.globalAlpha *= this.deathFlash * 0.65;
        ctx.strokeStyle = glowColor !== 'transparent' ? glowColor : fillColor;
        ctx.lineWidth = 5;
        ctx.shadowBlur = 26 + this.deathFlash * 30;
        ctx.shadowColor = glowColor !== 'transparent' ? glowColor : fillColor;
        ctx.beginPath();
        const burstRadius = this.radius * (1.08 + (1 - this.deathScale) * 1.15);
        ctx.arc(0, 0, burstRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    this.traceShape(ctx, sides, this.radius, this.getShapeTraceRotationOffset());
    
    const glintPos = (Math.sin(Date.now() / 2000) + 1) / 2;
    const grad = ctx.createLinearGradient(-this.radius * 2, -this.radius * 2, this.radius * 2, this.radius * 2);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(Math.max(0, glintPos - 0.1), fillColor);
    grad.addColorStop(glintPos, 'rgba(255,255,255,0.4)');
    grad.addColorStop(Math.min(1, glintPos + 0.1), fillColor);
    grad.addColorStop(1, fillColor);
    ctx.fillStyle = grad;
    
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

  private drawAdvancedStar(ctx: CanvasRenderingContext2D, fillColor: string, strokeColor: string, glowBlur: number, glowColor: string) {
    const r = this.radius;
    const t = Date.now() / 1000;
    if (glowBlur > 0) {
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = glowColor;
    }

    ctx.save();
    ctx.rotate(-Math.PI / 2);
    const shell = ctx.createRadialGradient(0, 0, r * 0.18, 0, 0, r);
    shell.addColorStop(0, 'rgba(255,255,255,0.34)');
    shell.addColorStop(0.38, fillColor);
    shell.addColorStop(1, this.darkenColor(fillColor, 0.32));
    this.traceStarShape(ctx, r, r * 0.48);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.rotate(t * 0.45);
    ctx.strokeStyle = glowColor !== 'transparent' ? glowColor : strokeColor;
    ctx.lineWidth = 2;
    this.traceStarShape(ctx, r * 1.22, r * 0.58);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * r * 0.82, Math.sin(angle) * r * 0.82);
        ctx.stroke();
    }
    ctx.restore();
  }

    private drawCommonVisuals(ctx: CanvasRenderingContext2D, fillColor: string, strokeColor: string) {
        const sides = SHAPE_STATS[this.shapeType].sides;
        const t = Date.now() / 1000;
        const highlight = 'rgba(255,255,255,0.35)';
        const accent = 'rgba(255,255,255,0.12)';

        const grad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        grad.addColorStop(0, this.lightenColor(fillColor, 0.12));
        grad.addColorStop(0.45, fillColor);
        grad.addColorStop(1, this.darkenColor(fillColor, 0.1));

        ctx.fillStyle = grad;
        this.traceShape(ctx, sides, this.radius, this.getShapeTraceRotationOffset());
        ctx.fill();

        ctx.lineWidth = 3.5;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 10]);
        this.traceShape(ctx, sides, this.radius * 0.84, this.getShapeTraceRotationOffset());
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = this.getShapeTraceRotationOffset() + (i * 2 * Math.PI) / sides;
            const inner = { x: Math.cos(angle) * this.radius * 0.4, y: Math.sin(angle) * this.radius * 0.4 };
            ctx.moveTo(0, 0);
            ctx.lineTo(inner.x, inner.y);
        }
        ctx.stroke();
        ctx.restore();
    }

    private lightenColor(color: string, amount: number): string {
        const [r, g, b] = this.hexToRgb(color);
        return this.rgbToHex(
            Math.min(255, Math.round(r + (255 - r) * amount)),
            Math.min(255, Math.round(g + (255 - g) * amount)),
            Math.min(255, Math.round(b + (255 - b) * amount))
        );
    }

    private darkenColor(color: string, amount: number): string {
        const [r, g, b] = this.hexToRgb(color);
        return this.rgbToHex(
            Math.max(0, Math.round(r * (1 - amount))),
            Math.max(0, Math.round(g * (1 - amount))),
            Math.max(0, Math.round(b * (1 - amount)))
        );
    }

    private hexToRgb(hex: string): [number, number, number] {
        const sanitized = hex.replace('#', '');
        const bigint = parseInt(sanitized.length === 3 ? sanitized.split('').map((c) => c + c).join('') : sanitized, 16);
        return [
            (bigint >> 16) & 255,
            (bigint >> 8) & 255,
            bigint & 255,
        ];
    }

    private rgbToHex(r: number, g: number, b: number): string {
        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

  private drawAdvancedDiamond(ctx: CanvasRenderingContext2D, fillColor: string, strokeColor: string, glowBlur: number, glowColor: string) {
    const r = this.radius;
    const t = Date.now() / 1000;
    if (glowBlur > 0) {
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = glowColor;
    }
    ctx.rotate(Math.PI * 0.25);
    this.traceShape(ctx, 4, r);
    const shell = ctx.createLinearGradient(-r, -r, r, r);
    shell.addColorStop(0, 'rgba(255,255,255,0.22)');
    shell.addColorStop(0.45, fillColor);
    shell.addColorStop(1, '#103d37');
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.rotate(-this.rotation * 0.55);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.82);
    ctx.lineTo(0, r * 0.82);
    ctx.moveTo(-r * 0.82, 0);
    ctx.lineTo(r * 0.82, 0);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = glowColor !== 'transparent' ? glowColor : strokeColor;
    ctx.lineWidth = 2;
    ctx.rotate(t * 0.35);
    this.traceShape(ctx, 4, r * 1.28);
    ctx.stroke();
    ctx.restore();
  }

  private drawAdvancedHeptagon(ctx: CanvasRenderingContext2D, fillColor: string, strokeColor: string, glowBlur: number, glowColor: string) {
    const r = this.radius;
    const t = Date.now() / 1000;
    if (glowBlur > 0) {
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = glowColor;
    }
    this.traceShape(ctx, 7, r, -Math.PI / 2);
    const shell = ctx.createRadialGradient(0, -r * 0.18, r * 0.1, 0, 0, r);
    shell.addColorStop(0, 'rgba(255,255,255,0.26)');
    shell.addColorStop(0.42, fillColor);
    shell.addColorStop(1, '#1f1638');
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * r * 0.82, Math.sin(angle) * r * 0.82);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.rotate(-t * 0.28);
    ctx.strokeStyle = glowColor !== 'transparent' ? glowColor : strokeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    this.traceShape(ctx, 7, r * 1.22, -Math.PI / 2);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);
  }

  private getShapeTraceRotationOffset(): number {
    if (this.shapeType === ShapeType.DIAMOND) return Math.PI * 0.25;
    if (this.shapeType === ShapeType.TRIANGLE || this.shapeType === ShapeType.HEPTAGON || this.shapeType === ShapeType.STAR || this.shapeType === ShapeType.NONAGON) return -Math.PI / 2;
    return 0;
  }

  traceShape(ctx: CanvasRenderingContext2D, sides: number, radius: number, angleOffset: number = 0) { ctx.beginPath(); for (let i = 0; i < sides; i++) { const angle = angleOffset + (i * 2 * Math.PI) / sides; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); }

  traceStarShape(ctx: CanvasRenderingContext2D, outerRadius: number, innerRadius: number) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / 5;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  
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

  drawGodlyVisuals(ctx: CanvasRenderingContext2D) {
    const t = Date.now() / 1000;
    const sides = SHAPE_STATS[this.shapeType].sides;
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i % 2 === 0 ? 1 : -1) * (t * (0.34 + i * 0.08)));
        ctx.strokeStyle = i === 0 ? 'rgba(255, 0, 255, 0.8)' : i === 1 ? 'rgba(255, 120, 220, 0.52)' : 'rgba(255,255,255,0.24)';
        ctx.lineWidth = 3 + i;
        ctx.setLineDash([14 + i * 4, 12]);
        this.traceShape(ctx, sides, this.radius * (1.22 + i * 0.26), this.getShapeTraceRotationOffset());
        ctx.stroke();
        ctx.restore();
    }

    const corona = ctx.createRadialGradient(0, 0, this.radius * 0.35, 0, 0, this.radius * 3.6);
    corona.addColorStop(0, 'rgba(255,255,255,0.16)');
    corona.addColorStop(0.35, 'rgba(255,0,255,0.18)');
    corona.addColorStop(1, 'rgba(255,0,255,0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawDivineVisuals(ctx: CanvasRenderingContext2D) {
    const t = Date.now() / 1000;
    const sides = SHAPE_STATS[this.shapeType].sides;
    ctx.save();

    const aura = ctx.createRadialGradient(0, 0, this.radius * 0.25, 0, 0, this.radius * 4.4);
    aura.addColorStop(0, 'rgba(255,255,255,0.22)');
    aura.addColorStop(0.3, 'rgba(140,90,255,0.2)');
    aura.addColorStop(0.68, 'rgba(80,170,255,0.14)');
    aura.addColorStop(1, 'rgba(70,0,140,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 4.4, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(t * (0.16 + i * 0.05) + i * (Math.PI / 6));
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(181,140,255,0.8)' : 'rgba(120,220,255,0.42)';
        ctx.lineWidth = 2.5 + i * 0.6;
        ctx.setLineDash([18 + i * 3, 16]);
        this.traceShape(ctx, sides, this.radius * (1.28 + i * 0.3), this.getShapeTraceRotationOffset());
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.rotate(-t * 0.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < sides; i++) {
        const angle = this.getShapeTraceRotationOffset() + (i * 2 * Math.PI) / sides;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * this.radius * 0.55, Math.sin(angle) * this.radius * 0.55);
        ctx.lineTo(Math.cos(angle) * this.radius * 1.5, Math.sin(angle) * this.radius * 1.5);
        ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }
}

class Bullet extends Entity {
  private static readonly REBIRTH_DAMAGE_MULT = 1.45;
  private static readonly REBIRTH_PROJECTILE_HEALTH_MULT = 1.55;
  ownerId: number;
  ownerClass: TankClass;
  barrelIndex: number;
  lifeTime: number = 0;
  maxLifeTime: number = 3000;
  bulletType: 'NORMAL' | 'HEAL' | 'SIPHON' | 'CALAMITY_ORB' | 'TRAP' = 'NORMAL';
  isHighDensityOrb: boolean = false;
  isDespawning: boolean = false;
  despawnStartTime: number = 0;
  despawnDurationMs: number = 240;
  obliteratorHaloEase: number = 0;
  trapAnchorSpeed: number = 0.3;
  trapSpinRate: number = 2.8;
  trapArmDelayMs: number = 180;
  trapAnchored: boolean = false;
  trapAccentColor: string = '#facc15';
  trapTravelDistance: number = 150;
  trapDistanceTravelled: number = 0;
  
  constructor(id: number, x: number, y: number, velocity: Vector2, owner: Tank, extraDamageMult: number = 1.0, extraLifeMult: number = 1.0, extraSizeMult: number = 1.0, barrelIndex: number = 0) {
    const size = (6 + (owner.stats[StatType.BULLET_DAMAGE] * 0.3)) * extraSizeMult;
    const color = getTeamProjectileColor(owner.team);
    super(id, EntityType.BULLET, x, y, size, color);
    this.team = owner.team;
    this.friction = 1.0; 
    this.vel = velocity;
    this.ownerId = owner.id;
    this.ownerClass = owner.classType;
    this.barrelIndex = barrelIndex;

    const isPacifist = (cls: TankClass) => cls === TankClass.PACIFIST_TRAINEE || cls === TankClass.NURSE || cls === TankClass.DOCTOR || cls === TankClass.PLAGUE_DOCTOR;
    const isDraining = (cls: TankClass) => cls === TankClass.DRAINER_TRAINEE || cls === TankClass.LEECH || cls === TankClass.VAMPIRE || cls === TankClass.REAPER;

    if ((this.ownerClass === TankClass.CELESTIAL || this.ownerClass === TankClass.OBLITERATOR) && owner.isTransformed) {
        this.bulletType = 'CALAMITY_ORB';
        this.isHighDensityOrb = true;
    } else if (isPacifist(this.ownerClass)) {
        this.bulletType = 'HEAL';
    } else if (isDraining(this.ownerClass)) {
        this.bulletType = 'SIPHON';
    }

    // Barrel-locked projectile sizing:
    // match rendered barrel width exactly, then apply caller size multiplier.
    const barrel = owner.barrels[this.barrelIndex] || owner.barrels[0];
    const barrelWidthRatio = barrel ? barrel[1] : 0.8;
    const barrelLengthRatio = barrel ? barrel[0] : 1.2;
    const ownerRadius = owner.radius;
    // barrel width in render space is (barrelWidthRatio * ownerRadius), so radius is half.
    const lockToBarrelSize = this.ownerClass === TankClass.OBLITERATOR;
    let matchedSize = Math.max(1.25, (barrelWidthRatio * ownerRadius) * 0.5) * extraSizeMult;
    if (lockToBarrelSize) {
      // User tuning: Obliterator core should read slightly larger than the chassis size itself.
      // We anchor directly to owner radius rather than oversized barrel width ratios.
      const chassisOverScale = 1.08;
      matchedSize = Math.max(ownerRadius * chassisOverScale, ownerRadius + 1.5);
    }
    if (this.isHighDensityOrb && this.ownerClass !== TankClass.OBLITERATOR) {
      // Keep calamity orbs visually distinct while still barrel-proportional.
      matchedSize *= 1.12;
    }

    this.radius = matchedSize;
    this.mass = matchedSize * 0.8; 
    
    let baseDamage = BASE_STATS.bulletDamage + (owner.stats[StatType.BULLET_DAMAGE] * 3);
    let basePenetration = BASE_STATS.bulletPenetration + (owner.stats[StatType.BULLET_PENETRATION] * 5);
    
    const isRebirthOwner = owner.isTransformed && (this.ownerClass === TankClass.COLOSSAL || this.ownerClass === TankClass.LEVIATHAN || this.ownerClass === TankClass.WARLORD || this.ownerClass === TankClass.CELESTIAL || this.ownerClass === TankClass.OBLITERATOR);

    if (owner.type === EntityType.ELITE_TANK) {
        baseDamage *= 1.5;
        basePenetration *= 2.0;
    } else if (isRebirthOwner) {
        baseDamage *= 1.12;
        basePenetration *= 1.35;
    } else if (owner.isTransformed) {
        baseDamage *= 1.35;
        basePenetration *= 1.7;
    }
    
    // SACRIFICIAL GOAT BUFF
    if (owner.isSacrificing) {
        baseDamage *= 1.25;
    }

    const classProjectileMod = CLASS_PROJECTILE_MODIFIERS[this.ownerClass];
    const penetrationMult = classProjectileMod?.penetrationMultiplier ?? 1.0;
    const projectileHealthMult = classProjectileMod?.projectileHealthMultiplier ?? 1.0;

    const generalPenDamageBonus = Math.min(0.22, Math.max(0, (basePenetration - BASE_STATS.bulletPenetration) * 0.0125));
    this.damage = baseDamage * extraDamageMult * (1 + generalPenDamageBonus);
    this.maxHealth = (10 + (basePenetration * penetrationMult) * 3) * extraLifeMult * projectileHealthMult; 

    const liveEngine = (window as any).gameEngine as GameEngine | undefined;
    if (liveEngine?.gameMode === GameMode.SANDBOX) {
        this.damage *= Math.max(0.4, liveEngine.sandboxConfig.projectileDamageScale || 1);
        this.maxHealth *= Math.max(0.4, liveEngine.sandboxConfig.projectileDurabilityScale || 1);
    }

    if (isRebirthOwner) {
        this.damage *= Bullet.REBIRTH_DAMAGE_MULT;
        this.maxHealth *= Bullet.REBIRTH_PROJECTILE_HEALTH_MULT;
    }

    if (this.isHighDensityOrb) {
        // Calamity Orbs are siege projectiles: huge, durable and slow enough to be readable.
        this.damage *= 1.28;
        this.maxHealth *= 7.2;
        this.mass = Math.max(this.mass, this.radius * 5.5);
        this.friction = 0.998;
        this.despawnDurationMs = 420;
    }

    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;
    this.maxLifeTime *= (extraLifeMult * 0.8) + 0.2; 

  }

  configureAsTrap(config?: {
    maxLifeTime?: number;
    friction?: number;
    anchorSpeed?: number;
    armDelayMs?: number;
    travelDistance?: number;
    damageMultiplier?: number;
    healthMultiplier?: number;
    massMultiplier?: number;
    spinRate?: number;
    accentColor?: string;
  }) {
    this.bulletType = 'TRAP';
    this.trapAnchored = false;
    this.friction = config?.friction ?? 0.88;
    this.trapAnchorSpeed = config?.anchorSpeed ?? 0.4;
    this.trapArmDelayMs = config?.armDelayMs ?? 180;
    this.trapTravelDistance = Math.max(40, config?.travelDistance ?? 150);
    this.trapDistanceTravelled = 0;
    this.trapSpinRate = config?.spinRate ?? 2.8;
    this.trapAccentColor = config?.accentColor ?? this.trapAccentColor;
    this.maxLifeTime = config?.maxLifeTime ?? this.maxLifeTime;
    this.damage *= config?.damageMultiplier ?? 1.02;
    this.maxHealth *= config?.healthMultiplier ?? 2.6;
    this.health = this.maxHealth;
    this.displayHealth = this.maxHealth;
    this.mass *= config?.massMultiplier ?? 2.05;
  }

  override update(dt: number) { 
    const previousPos = { ...this.pos };
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
      if (this.lifeTime > this.maxLifeTime * 0.55 && speed <= 0.14) {
        this.isDespawning = true;
        this.despawnStartTime = this.lifeTime;
      }
    }

    if (this.isDespawning && (this.lifeTime - this.despawnStartTime) >= this.despawnDurationMs) {
      this.isDead = true;
    }

    if (this.bulletType === 'TRAP') {
      this.trapDistanceTravelled += Vector.dist(previousPos, this.pos);
      const speed = Vector.mag(this.vel);
      const armReady = this.lifeTime >= this.trapArmDelayMs;
      const reachedRange = this.trapDistanceTravelled >= this.trapTravelDistance;
      const closeEnoughToStop = this.trapDistanceTravelled >= this.trapTravelDistance * 0.82 && speed <= this.trapAnchorSpeed;
      if (!this.trapAnchored && armReady && (reachedRange || closeEnoughToStop)) {
        this.trapAnchored = true;
        this.vel = { x: 0, y: 0 };
        this.acc = { x: 0, y: 0 };
        this.visualScale = 1;
      }
      if (this.trapAnchored) {
        this.vel = { x: 0, y: 0 };
        this.acc = { x: 0, y: 0 };
        this.rotation += dt * this.trapSpinRate;
      } else if (speed > 0.01) {
        this.rotation = Math.atan2(this.vel.y, this.vel.x);
      }
    }

    // Fixed-timestep eased halo dynamics for Obliterator circle core visuals.
    if (this.ownerClass === TankClass.OBLITERATOR) {
      const lifeNorm = Math.max(0, 1 - (this.lifeTime / Math.max(1, this.maxLifeTime)));
      const targetHalo = 0.52 + lifeNorm * 0.34;
      const ease = 1 - Math.exp(-dt * 10.5);
      this.obliteratorHaloEase += (targetHalo - this.obliteratorHaloEase) * ease;
    }
    
    // Align rotation with velocity direction dynamically
    if (this.bulletType !== 'TRAP') {
      this.rotation = Math.atan2(this.vel.y, this.vel.x);
    }
    
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
      } else if (this.bulletType === 'TRAP' && chance < (this.trapAnchored ? 0.18 : 0.08)) {
        const trapColor = this.trapAnchored ? `${this.trapAccentColor}aa` : 'rgba(250, 204, 21, 0.34)';
        engine.particles.push(new Particle(this.pos.x, this.pos.y, trapColor, this.trapAnchored ? this.radius * 0.2 : this.radius * 0.12, this.trapAnchored ? 12 : 8, this.trapAnchored ? 'RING' : 'FLASH'));
      } else if (this.bulletType === 'CALAMITY_ORB' && chance < 0.7) {
        const angle = this.rotation + Math.PI + (Math.random() - 0.5) * 1.1;
        const speed = Math.random() * 1.2 + 0.25;
        const orbGasColor = this.ownerClass === TankClass.OBLITERATOR ? 'rgba(194, 70, 255, 0.58)' : 'rgba(216, 180, 254, 0.5)';
        const ringColor = this.ownerClass === TankClass.OBLITERATOR ? 'rgba(255, 122, 255, 0.32)' : 'rgba(125, 211, 252, 0.26)';
        const p = new Particle(this.pos.x, this.pos.y, orbGasColor, Math.random() * 7 + 3, 22 + Math.random() * 18, 'GAS');
        p.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        engine.particles.push(p);
        if (Math.random() < 0.18) engine.particles.push(new Particle(this.pos.x, this.pos.y, ringColor, this.radius * 0.55, 14, 'RING'));
      } else if (this.ownerClass === TankClass.OBLITERATOR && chance < 0.55) {
        // Chromatic displacement wake: decaying circle particles, no collision footprint changes.
        const backAngle = this.rotation + Math.PI + (Math.random() - 0.5) * 0.85;
        const speed = Math.random() * 1.1 + 0.3;
        const p = new Particle(this.pos.x, this.pos.y, 'rgba(194, 120, 255, 0.42)', Math.random() * 3.4 + 1.8, 16 + Math.random() * 10, 'GAS');
        p.vel = { x: Math.cos(backAngle) * speed, y: Math.sin(backAngle) * speed };
        engine.particles.push(p);
        if (Math.random() < 0.2) engine.particles.push(new Particle(this.pos.x, this.pos.y, 'rgba(125, 211, 252, 0.24)', this.radius * 0.45, 10, 'RING'));
      } else if (this.ownerClass === TankClass.DESTROYER && chance < 0.35) {
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
    const baseColor = getTeamProjectileColor(this.team);
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

    const t = this.lifeTime * 0.012;
    const pulse = 1 + Math.sin(t * 4.2) * 0.08;
    const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    const stretch = Math.min(1.95, 1.08 + speed * 0.0021);
    const squish = 1 / Math.sqrt(stretch);
    const baseColor = getTeamProjectileColor(this.team);

    // Animated shock halo.
    const halo = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius * (1.9 + Math.sin(t * 2.8) * 0.08));
    halo.addColorStop(0, 'rgba(255,255,255,0.22)');
    halo.addColorStop(0.38, baseColor);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * (1.9 + Math.sin(t * 2.8) * 0.08), 0, Math.PI * 2);
    ctx.fill();

    // Forward body.
    ctx.scale(stretch, squish);
    const shellGrad = ctx.createLinearGradient(-this.radius * 1.35, 0, this.radius * 1.95, 0);
    shellGrad.addColorStop(0, '#1f2937');
    shellGrad.addColorStop(0.38, baseColor);
    shellGrad.addColorStop(0.78, '#ffffff');
    shellGrad.addColorStop(1, '#111827');
    ctx.fillStyle = shellGrad;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = Math.max(1.8, this.radius * 0.32);
    ctx.beginPath();
    const tail = -this.radius * 1.2;
    const shoulder = this.radius * 0.5;
    const nose = this.radius * 1.75;
    ctx.moveTo(tail, -this.radius * 0.62);
    ctx.lineTo(shoulder, -this.radius * 0.68);
    ctx.quadraticCurveTo(this.radius * 1.15, -this.radius * 0.5, nose, 0);
    ctx.quadraticCurveTo(this.radius * 1.15, this.radius * 0.5, shoulder, this.radius * 0.68);
    ctx.lineTo(tail, this.radius * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Animated rotating flux rings.
    ctx.save();
    ctx.rotate(t * 1.7);
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) + Math.sin(t + i) * 0.2);
      ctx.strokeStyle = `rgba(255,255,255,${0.22 + i * 0.1})`;
      ctx.lineWidth = Math.max(1, this.radius * 0.12);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * (0.86 + i * 0.18), this.radius * (0.28 + i * 0.06), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Core slit.
    ctx.fillStyle = `rgba(255,255,255,${0.25 + pulse * 0.2})`;
    ctx.fillRect(-this.radius * 0.35, -this.radius * 0.1, this.radius * 0.95, this.radius * 0.2);

    ctx.restore();
  }

  drawObliteratorCoreCircle(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const t = this.lifeTime * 0.008;
    const haloEased = this.obliteratorHaloEase || 0.55;
    const pulse = 1 + Math.sin(t * 3.8) * 0.05;

    // Concentric energy shrouds (visual only).
    for (let i = 0; i < 3; i++) {
      const rMul = 1.06 + i * 0.18 + haloEased * (0.12 - i * 0.03);
      const alpha = 0.13 - i * 0.032;
      ctx.strokeStyle = `rgba(${i === 0 ? '233,213,255' : i === 1 ? '194,120,255' : '125,211,252'},${alpha})`;
      ctx.lineWidth = Math.max(0.8, this.radius * (0.06 - i * 0.012));
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * rMul * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    const halo = ctx.createRadialGradient(0, 0, this.radius * 0.16, 0, 0, this.radius * (1.35 + haloEased * 0.22));
    halo.addColorStop(0, 'rgba(255,255,255,0.2)');
    halo.addColorStop(0.42, 'rgba(176,38,255,0.28)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * (1.35 + haloEased * 0.22), 0, Math.PI * 2);
    ctx.fill();

    const shell = ctx.createRadialGradient(-this.radius * 0.25, -this.radius * 0.28, this.radius * 0.08, 0, 0, this.radius * 1.02);
    shell.addColorStop(0, '#f5d0fe');
    shell.addColorStop(0.28, '#c026ff');
    shell.addColorStop(0.62, '#6d28d9');
    shell.addColorStop(1, '#150726');
    ctx.fillStyle = shell;
    ctx.strokeStyle = 'rgba(15,23,42,0.95)';
    ctx.lineWidth = Math.max(2.1, this.radius * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner compression core.
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(Math.sin(t * 2.8) * this.radius * 0.06, -Math.cos(t * 3.2) * this.radius * 0.05, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBasicCircleBullet(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // Lightweight but class-distinct projectile looks for non-specialized bullet classes.
    let coreColor = getTeamProjectileColor(this.team);
    let strokeColor = COLORS.border;
    let innerMark = 'none';

    switch (this.ownerClass) {
      case TankClass.BASIC:
        coreColor = '#6dd8ff';
        innerMark = 'dot';
        break;
      case TankClass.TWIN:
      case TankClass.TWIN_FLANK:
      case TankClass.TRIPLE_TWIN:
        coreColor = '#8be9ff';
        innerMark = 'ring';
        break;
      case TankClass.TRIPLE_SHOT:
      case TankClass.TRIPLE_TANK:
      case TankClass.PENTA_SHOT:
      case TankClass.QUAD_TANK:
      case TankClass.OCTO_TANK:
        coreColor = '#9bc8ff';
        innerMark = 'bar';
        break;
      case TankClass.SPREAD_SHOT:
        coreColor = '#c7b8ff';
        innerMark = 'cross';
        break;
      case TankClass.FLANK_GUARD:
      case TankClass.TRI_ANGLE:
      case TankClass.BOOSTER:
      case TankClass.FIGHTER:
        coreColor = '#7cf7e1';
        innerMark = 'chevron';
        break;
      case TankClass.GUNNER:
      case TankClass.AUTO_GUNNER:
      case TankClass.STREAMLINER:
      case TankClass.MACHINE_GUN:
      case TankClass.SPRAYER:
        coreColor = '#b7ffb0';
        strokeColor = '#30443a';
        innerMark = 'tick';
        break;
      case TankClass.OVERSEER:
      case TankClass.OVERLORD:
      case TankClass.MANAGER:
        coreColor = '#b5d2ff';
        innerMark = 'ring';
        break;
      case TankClass.PACIFIST_TRAINEE:
      case TankClass.NURSE:
      case TankClass.DOCTOR:
      case TankClass.PLAGUE_DOCTOR:
        coreColor = '#86efac';
        innerMark = 'plus';
        break;
      case TankClass.DRAINER_TRAINEE:
      case TankClass.LEECH:
      case TankClass.VAMPIRE:
      case TankClass.REAPER:
        coreColor = '#f87171';
        innerMark = 'slash';
        break;
      default:
        coreColor = getTeamProjectileColor(this.team);
        innerMark = 'none';
        break;
    }

    if (isPlayableTeam(this.team)) {
      coreColor = getTeamProjectileColor(this.team);
    }

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = coreColor;
    ctx.fill();
    ctx.lineWidth = Math.max(1.3, this.radius * 0.2);
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(0.8, this.radius * 0.1);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const r = this.radius * 0.45;
    if (innerMark === 'dot') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (innerMark === 'ring') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    } else if (innerMark === 'bar') {
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
    } else if (innerMark === 'cross') {
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
    } else if (innerMark === 'chevron') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.4);
      ctx.lineTo(0, 0);
      ctx.lineTo(-r * 0.8, r * 0.4);
      ctx.stroke();
    } else if (innerMark === 'tick') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, 0);
      ctx.lineTo(r * 0.6, 0);
      ctx.moveTo(0, -r * 0.5);
      ctx.lineTo(0, -r * 0.1);
      ctx.stroke();
    } else if (innerMark === 'plus') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, 0);
      ctx.lineTo(r * 0.55, 0);
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(0, r * 0.55);
      ctx.stroke();
    } else if (innerMark === 'slash') {
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.55);
      ctx.lineTo(r * 0.55, -r * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTrapBullet(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const armedAlpha = this.trapAnchored ? 1 : 0.72;
    const pulse = this.trapAnchored ? 1 + Math.sin(this.lifeTime * 0.012) * 0.08 : 1;
    const outerRadius = this.radius * (this.trapAnchored ? 1.28 : 1.12) * pulse;
    const midRadius = this.radius * 0.6;
    const innerRadius = this.radius * 0.22;
    const teamColor = this.team === Team.NONE ? this.trapAccentColor : getTeamProjectileColor(this.team);
    const halo = ctx.createRadialGradient(0, 0, this.radius * 0.12, 0, 0, this.radius * (this.trapAnchored ? 2.2 : 1.45));
    halo.addColorStop(0, this.trapAnchored ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)');
    halo.addColorStop(0.38, this.trapAnchored ? 'rgba(250,204,21,0.18)' : 'rgba(250,204,21,0.1)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    this.traceTrapStarShape(ctx, this.radius * (this.trapAnchored ? 1.95 : 1.52), this.radius * 0.58, 4, Math.PI / 4);
    ctx.fill();

    ctx.fillStyle = this.trapAnchored ? teamColor : '#a16207';
    ctx.globalAlpha *= armedAlpha;
    this.traceTrapStarShape(ctx, outerRadius, innerRadius, 4, Math.PI / 4);
    ctx.fill();

    const bladeGradient = ctx.createLinearGradient(-outerRadius, -outerRadius, outerRadius, outerRadius);
    bladeGradient.addColorStop(0, this.trapAnchored ? 'rgba(255,255,255,0.2)' : 'rgba(255,245,200,0.14)');
    bladeGradient.addColorStop(0.52, 'rgba(255,255,255,0.02)');
    bladeGradient.addColorStop(1, this.trapAnchored ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.1)');
    ctx.fillStyle = bladeGradient;
    this.traceTrapStarShape(ctx, outerRadius * 0.9, midRadius, 4, Math.PI / 4);
    ctx.fill();

    ctx.fillStyle = this.trapAnchored ? 'rgba(255,255,255,0.92)' : 'rgba(255,244,214,0.78)';
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.36, 0);
    ctx.lineTo(0, this.radius * 0.36);
    ctx.lineTo(-this.radius * 0.36, 0);
    ctx.lineTo(0, -this.radius * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private traceTrapStarShape(ctx: CanvasRenderingContext2D, outerRadius: number, innerRadius: number, points = 5, rotationOffset = 0) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = rotationOffset + (i * Math.PI) / points;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
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
    const isSniperFamily = isSniper || isAssassin || isRanger || isStalker || isHunter || isXHunter;
    const isDestroyer = this.ownerClass === TankClass.DESTROYER;
    const isAnnihilator = this.ownerClass === TankClass.ANNIHILATOR;
    const isRebirthBoss = this.ownerClass === TankClass.COLOSSAL || this.ownerClass === TankClass.LEVIATHAN || this.ownerClass === TankClass.WARLORD || this.ownerClass === TankClass.CELESTIAL || this.ownerClass === TankClass.OBLITERATOR;

    if (this.bulletType === 'TRAP') {
      this.drawTrapBullet(ctx);
    } else if (isSniperFamily) {
      this.drawCustomTacticalBullet(ctx);
    } else if (this.ownerClass === TankClass.OBLITERATOR) {
      // Obliterator always renders with true-circle projectile architecture.
      this.drawObliteratorCoreCircle(ctx);
    } else if (this.isHighDensityOrb) {
      this.drawCalamityOrb(ctx);
    } else if (isRebirthBoss) {
      this.drawRebirthBossBullet(ctx);
    } else if (isDestroyer) {
      this.drawDestroyerBullet(ctx);
    } else if (isAnnihilator) {
      this.drawAnnihilatorBullet(ctx);
    } else {
      // Default all other classes (including HYBRID) to simple circle bullets for lower render cost.
      this.drawBasicCircleBullet(ctx);
    }

    if (isPlayableTeam(this.team)) {
      const displayColor = getTeamProjectileColor(this.team);
      ctx.save();
      ctx.strokeStyle = `${displayColor}cc`;
      ctx.lineWidth = Math.max(1.1, this.radius * 0.12);
      ctx.shadowBlur = this.radius * 1.2;
      ctx.shadowColor = displayColor;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.08, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.globalAlpha = 1.0; 
  }

  drawCalamityOrb(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const isObliteratorOrb = this.ownerClass === TankClass.OBLITERATOR;
    const t = this.lifeTime * 0.006;
    const integrity = Math.max(0.25, this.health / Math.max(1, this.maxHealth));
    const pulse = 1 + Math.sin(t * 3.0) * 0.08;

    if (isObliteratorOrb) {
      const bombPulse = 1 + Math.sin(t * 5.2) * 0.06;
      const drift = Math.sin(t * 3.4) * this.radius * 0.06;
      const halo = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius * (1.9 * bombPulse));
      halo.addColorStop(0, 'rgba(255,255,255,0.2)');
      halo.addColorStop(0.42, 'rgba(176,38,255,0.32)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.9 * bombPulse, 0, Math.PI * 2);
      ctx.fill();

      // Main spherical bomb body.
      const shell = ctx.createRadialGradient(-this.radius * 0.26, -this.radius * 0.28, this.radius * 0.08, 0, 0, this.radius * 1.02);
      shell.addColorStop(0, '#f5d0fe');
      shell.addColorStop(0.26, '#c026ff');
      shell.addColorStop(0.62, '#6d28d9');
      shell.addColorStop(1, '#150726');
      ctx.fillStyle = shell;
      ctx.strokeStyle = 'rgba(15,23,42,0.95)';
      ctx.lineWidth = Math.max(2.2, this.radius * 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.98 * bombPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating containment bands.
      ctx.save();
      ctx.rotate(t * 1.9);
      for (let i = 0; i < 2; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) + Math.sin(t + i) * 0.14);
        ctx.strokeStyle = `rgba(233,213,255,${0.34 + integrity * 0.22})`;
        ctx.lineWidth = Math.max(1.1, this.radius * 0.08);
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * (0.92 + i * 0.16), this.radius * (0.33 + i * 0.06), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Segmented shell seams.
      ctx.save();
      ctx.rotate(-t * 1.35);
      ctx.strokeStyle = `rgba(255,255,255,${0.2 + integrity * 0.2})`;
      ctx.lineWidth = Math.max(1, this.radius * 0.06);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * this.radius * 0.24, Math.sin(a) * this.radius * 0.24, this.radius * 0.56, a + 0.45, a + 1.05);
        ctx.stroke();
      }
      ctx.restore();

      // Compression core + short energy vectors (bomb profile).
      ctx.fillStyle = `rgba(255,255,255,${0.22 + integrity * 0.24})`;
      ctx.beginPath();
      ctx.arc(drift, -drift * 0.65, this.radius * 0.24, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a = t * 2.2 + (i / 3) * Math.PI * 2;
        ctx.strokeStyle = `rgba(233,213,255,${0.22 + integrity * 0.2})`;
        ctx.lineWidth = Math.max(1, this.radius * 0.07);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * this.radius * 0.72, Math.sin(a) * this.radius * 0.72);
        ctx.lineTo(Math.cos(a) * this.radius * 1.2, Math.sin(a) * this.radius * 1.2);
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius * (2.4 * pulse));
    halo.addColorStop(0, `rgba(255,255,255,${0.22 + integrity * 0.18})`);
    halo.addColorStop(0.35, `rgba(216,180,254,${0.28 + integrity * 0.25})`);
    halo.addColorStop(0.72, 'rgba(125,211,252,0.14)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.4 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(t * 1.7);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i / 3) * Math.PI * 2 + t * (0.4 + i * 0.16));
      ctx.strokeStyle = `rgba(${i === 1 ? '125,211,252' : '216,180,254'},${0.32 + integrity * 0.24})`;
      ctx.lineWidth = Math.max(1.5, this.radius * 0.07);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * (1.16 + i * 0.12), this.radius * (0.38 + i * 0.04), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const core = ctx.createRadialGradient(-this.radius * 0.26, -this.radius * 0.28, this.radius * 0.08, 0, 0, this.radius * 1.15);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.28, '#e9d5ff');
    core.addColorStop(0.58, '#a78bfa');
    core.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = core;
    ctx.strokeStyle = 'rgba(15,23,42,0.9)';
    ctx.lineWidth = Math.max(3, this.radius * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,255,255,${0.28 + integrity * 0.24})`;
    ctx.lineWidth = Math.max(1.2, this.radius * 0.04);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawRebirthBossBullet(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const t = this.lifeTime * 0.012;
    const isColossal = this.ownerClass === TankClass.COLOSSAL;
    const isLeviathan = this.ownerClass === TankClass.LEVIATHAN;
    const isWarlord = this.ownerClass === TankClass.WARLORD;
    const isCelestial = this.ownerClass === TankClass.CELESTIAL;
    const isObliterator = this.ownerClass === TankClass.OBLITERATOR;
    const displayColor = getTeamProjectileColor(this.team);
    const displayRgb = hexToRgb(displayColor);
    const c0 = isPlayableTeam(this.team)
      ? `rgba(${displayRgb.r},${displayRgb.g},${displayRgb.b},0.72)`
      : isColossal
      ? 'rgba(250,190,120,0.7)'
      : isLeviathan
        ? 'rgba(120,220,255,0.7)'
        : isWarlord
          ? 'rgba(255,130,150,0.72)'
          : isObliterator
            ? 'rgba(214,120,255,0.76)'
            : 'rgba(210,170,255,0.72)';
    const c1 = isPlayableTeam(this.team) ? displayColor : isColossal ? '#d08a4f' : isLeviathan ? '#2dd4ff' : isWarlord ? '#fb7185' : isObliterator ? '#c026ff' : '#a78bfa';
    const c2 = isColossal ? '#2f241c' : isLeviathan ? '#0b2b3a' : isWarlord ? '#3b0f1c' : isObliterator ? '#1a0630' : '#21123d';

    const halo = ctx.createRadialGradient(0, 0, this.radius * 0.25, 0, 0, this.radius * (1.45 + Math.sin(t) * 0.08));
    halo.addColorStop(0, c0);
    halo.addColorStop(0.75, 'rgba(0,0,0,0.06)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * (1.45 + Math.sin(t) * 0.08), 0, Math.PI * 2);
    ctx.fill();

    // NOTE: entity draw() already rotates to this.rotation (velocity direction).
    const bodyGrad = ctx.createLinearGradient(-this.radius * 1.45, 0, this.radius * 1.95, 0);
    bodyGrad.addColorStop(0, c2);
    bodyGrad.addColorStop(0.48, c1);
    bodyGrad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2.8;

    // Directional body (nose at +X, trail at -X) for consistent facing.
    ctx.beginPath();
    const tail = -this.radius * 1.3;
    const shoulder = this.radius * 0.6;
    const nose = this.radius * 1.85;
    ctx.moveTo(tail, -this.radius * 0.74);
    ctx.lineTo(shoulder, -this.radius * 0.74);
    ctx.quadraticCurveTo(this.radius * 1.22, -this.radius * 0.54, nose, 0);
    ctx.quadraticCurveTo(this.radius * 1.22, this.radius * 0.54, shoulder, this.radius * 0.74);
    ctx.lineTo(tail, this.radius * 0.74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rear trail fin / wake region keeps forward direction obvious.
    ctx.fillStyle = isLeviathan
      ? 'rgba(45,212,255,0.24)'
      : isWarlord
        ? 'rgba(251,113,133,0.24)'
        : isObliterator
          ? 'rgba(232,121,249,0.28)'
        : isCelestial
          ? 'rgba(167,139,250,0.24)'
          : 'rgba(251,191,116,0.24)';
    ctx.beginPath();
    ctx.moveTo(tail, -this.radius * 0.46);
    ctx.lineTo(tail - this.radius * 0.65, 0);
    ctx.lineTo(tail, this.radius * 0.46);
    ctx.closePath();
    ctx.fill();

    // Distinct per-class accents to avoid look-alike rebirth bullets.
    if (isLeviathan) {
      ctx.strokeStyle = 'rgba(125,211,252,0.7)';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.65, 0);
      ctx.lineTo(this.radius * 1.5, 0);
      ctx.stroke();
    } else if (isWarlord) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.arc(this.radius * 0.28, 0, this.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (isCelestial) {
      ctx.strokeStyle = 'rgba(216,180,254,0.68)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.8, -this.radius * 0.3);
      ctx.lineTo(this.radius * 1.18, 0);
      ctx.lineTo(-this.radius * 0.8, this.radius * 0.3);
      ctx.stroke();
    } else if (isObliterator) {
      ctx.strokeStyle = 'rgba(233,213,255,0.74)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.78, -this.radius * 0.34);
      ctx.lineTo(this.radius * 0.46, 0);
      ctx.lineTo(-this.radius * 0.78, this.radius * 0.34);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      ctx.beginPath();
      ctx.arc(this.radius * 0.22, 0, this.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-this.radius * 0.55, -this.radius * 0.14, this.radius * 1.25, this.radius * 0.28);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.95, -this.radius * 0.48);
    ctx.lineTo(this.radius * 0.45, -this.radius * 0.48);
    ctx.moveTo(-this.radius * 0.95, this.radius * 0.48);
    ctx.lineTo(this.radius * 0.45, this.radius * 0.48);
    ctx.stroke();
    ctx.restore();
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

    getNeighborsInRadius(entity: Entity, radius: number, out?: Entity[]): Entity[] {
        const target = out ?? [];
        target.length = 0;
        const minX = Math.floor((entity.pos.x - radius) / this.cellSize);
        const maxX = Math.floor((entity.pos.x + radius) / this.cellSize);
        const minY = Math.floor((entity.pos.y - radius) / this.cellSize);
        const maxY = Math.floor((entity.pos.y + radius) / this.cellSize);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = x + y * this.cols;
                const cell = this.cells.get(key);
                if (!cell) continue;
                for (let i = 0; i < cell.length; i++) target.push(cell[i]);
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
  readonly baseZoneWidth: number = BASE_ZONE_WIDTH;

  // Rebirth System
  isRebirthing: boolean = false;
  playerState: PlayerState = PlayerState.ACTIVE;
  evolutionTransitionTimer: number = 0;
  bossChoices: TankClass[] = [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD, TankClass.CELESTIAL, TankClass.OBLITERATOR];
  bossRushMode = new BossRushMode();
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
  private previousGameMode: GameMode = GameMode.FFA;
  preferredTeam: Team = Team.BLUE;
  preferredColor: string = COLORS.player;
  preferredSkinId: string = 'default';
  preferredDonorRank: DonorRank = 'standard';
  xp: number = 0;
  level: number = 1;
  maxShapes = 750; 
  currentShapeCount = 0;
  maxEnemies = 25;
  bossSpawnTimer: number = 0;
  eliteSpawnTimer: number = 0;
  shapeSpawnTimer: number = 0;
    commonShapeCooldown: number = 0;
    commonShapeMaxActive: number = 180;
  killFeed: KillFeedEntry[] = [];
  botChats: ActiveBotChat[] = [];
  private readonly botChatCooldowns = new Map<number, number>();
  private readonly botChatLastLine = new Map<number, string>();
  private botDeathTauntGlobalCooldownUntil = 0;
  private playerDeathPresentation: PlayerDeathPresentation | null = null;
  private playerDeathKillerRef: PlayerDeathKillerRef | null = null;
  private elapsedMs = 0;
  attractMode: boolean = true;
  spectateTarget: Tank | null = null;
  manualSpectateMode: boolean = false;
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
      shapeMaxCount: 420,
      enabledShapes: {
          [ShapeType.SQUARE]: true,
          [ShapeType.DIAMOND]: true,
          [ShapeType.TRIANGLE]: true,
          [ShapeType.STAR]: true,
          [ShapeType.PENTAGON]: true,
          [ShapeType.HEPTAGON]: true,
          [ShapeType.HEXAGON]: true,
          [ShapeType.OCTAGON]: true,
          [ShapeType.NONAGON]: true,
          [ShapeType.DECAGON]: true,
          [ShapeType.DODECAGON]: true,
      },
      cleanupActive: true,
      showSpawnNotifications: true,
      projectileDamageScale: 1.0,
      projectileDurabilityScale: 1.0,
      droneDamageScale: 1.0,
      droneDurabilityScale: 1.0,
  };

  transformationReadyClass: TankClass | null = null;
  transformationReadyClassClass: TankClass | null = null;
  transformationReadyTimer: number = 0;
  rebirthEligible: boolean = false;
  rebirthPromptSeen: boolean = false;

  primedSpawn: { 
      type: 'SHAPE' | 'BOSS' | 'ALPHA_PENTAGON' | 'VOID_PORTAL' | 'DUMMY' | 'BOT_TANK' | 'ELITE_TANK' | 'DOMINION_TANK', 
      shapeType?: ShapeType, 
      rarity: ShapeRarity,
      classType?: TankClass,
      weaponProfile?: DominionWeaponProfile,
      spawnAmount?: number
  } | null = null;

  inVoid: boolean = false;
  voidTimer: number = 0;
  portalSpawnTimer: number = 0;
  transitionAlpha: number = 0;
  isTransitioning: boolean = false;
  private pendingDimensionTransition: PendingDimensionTransition | null = null;
  private playerVoidTransitStage: VoidTransitStage | null = null;
  private playerVoidTransitProgress: number = 0;
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
  private tdmAiSystem: TDMAISystem = new TDMAISystem();
  private perfSampleAccumulator: number = 0;
  private perfSampleFrames: number = 0;
  private recentBodyCollisionAt: Map<string, number> = new Map();
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
  private zoneTeamPressureGreen: number[] = [];
  private zoneTeamPressurePurple: number[] = [];
  private spawnHeatmapTimer: number = 0;
  private recentSpawnZoneHistory: number[] = [];
  private baseDefenseAnchors: Record<Team, Vector2[]> = {
      [Team.BLUE]: [],
      [Team.RED]: [],
      [Team.GREEN]: [],
      [Team.PURPLE]: [],
      [Team.NONE]: []
  };
  private dominionZones: DominionZoneDef[] = [];
  private dominionScores: Record<Team, number> = {
      [Team.NONE]: 0,
      [Team.BLUE]: 0,
      [Team.RED]: 0,
      [Team.GREEN]: 0,
      [Team.PURPLE]: 0
  };
  private dominionOwnedCount: Record<Team, number> = {
      [Team.NONE]: 0,
      [Team.BLUE]: 0,
      [Team.RED]: 0,
      [Team.GREEN]: 0,
      [Team.PURPLE]: 0
  };
  private dominionScoreTickTimer: number = 5;
  private dominionMatchTimer: number = 600;
  private dominionRoundResetTimer: number = 0;
  private dominionPendingWinner: Team = Team.NONE;
  private safeZoneScanTimerMs: number = 0;
  private enemyZoneWarningLevel: 0 | 1 | 2 = 0;
  private enemyZoneWarningText: string = '';
  private enemyZoneWarningHoldMs: number = 0;
  private readonly collisionNeighborBuffer: Entity[] = [];
  private readonly visibleEntitiesBuffer: Entity[] = [];
  private readonly portalCoreOccupancyMs: Map<string, number> = new Map();
  private readonly portalTransitQueuedIds: Map<number, Set<number>> = new Map();
  private readonly portalStageNotified: Map<string, Set<VoidTransitStage>> = new Map();
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
      [EntityType.DOMINION_TANK]: 4,
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

    if (this.gameMode !== GameMode.BOSS_RUSH) {
      for (let i = 0; i < 150; i++) this.spawnShape();
      this.seedTeamFarmFields();
    }
    if (this.gameMode === GameMode.DOMINION) {
      this.spawnDominionObjectives();
    }
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
    this.zoneTeamPressureGreen = new Array(this.spawnZones.length).fill(0);
    this.zoneTeamPressurePurple = new Array(this.spawnZones.length).fill(0);
    this.recentSpawnZoneHistory = [];
  }

  private getSafeZoneRect(team: Team): { x: number; y: number; w: number; h: number } | null {
    if (this.gameMode === GameMode.TEAMS) {
      if (team === Team.BLUE) return { x: 0, y: 0, w: BASE_ZONE_WIDTH, h: CANVAS_HEIGHT };
      if (team === Team.RED) return { x: CANVAS_WIDTH - BASE_ZONE_WIDTH, y: 0, w: BASE_ZONE_WIDTH, h: CANVAS_HEIGHT };
      return null;
    }
    if (this.gameMode === GameMode.DOMINION) {
      if (team === Team.BLUE) return { x: 0, y: 0, w: BASE_ZONE_WIDTH, h: BASE_ZONE_WIDTH };
      if (team === Team.RED) return { x: CANVAS_WIDTH - BASE_ZONE_WIDTH, y: 0, w: BASE_ZONE_WIDTH, h: BASE_ZONE_WIDTH };
      if (team === Team.GREEN) return { x: 0, y: CANVAS_HEIGHT - BASE_ZONE_WIDTH, w: BASE_ZONE_WIDTH, h: BASE_ZONE_WIDTH };
      if (team === Team.PURPLE) return { x: CANVAS_WIDTH - BASE_ZONE_WIDTH, y: CANVAS_HEIGHT - BASE_ZONE_WIDTH, w: BASE_ZONE_WIDTH, h: BASE_ZONE_WIDTH };
    }
    return null;
  }

  private getTeamSpawnCenter(team: Team): Vector2 {
    const rect = this.getSafeZoneRect(team);
    if (!rect) return { x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.5 };
    return { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 };
  }

  private getDominionZoneBlueprints(): Array<{ pos: Vector2; radius: number }> {
    return [
      { pos: { x: CANVAS_WIDTH * 0.32, y: CANVAS_HEIGHT * 0.32 }, radius: 680 },
      { pos: { x: CANVAS_WIDTH * 0.68, y: CANVAS_HEIGHT * 0.32 }, radius: 680 },
      { pos: { x: CANVAS_WIDTH * 0.32, y: CANVAS_HEIGHT * 0.68 }, radius: 680 },
      { pos: { x: CANVAS_WIDTH * 0.68, y: CANVAS_HEIGHT * 0.68 }, radius: 680 },
    ];
  }

  private getDominionWeaponProfile(index: number): DominionWeaponProfile {
    const profiles: DominionWeaponProfile[] = ['DESTROYER', 'GUNNER', 'TRAPPER', 'TRIPLE'];
    return profiles[index % profiles.length];
  }

  private resetDominionState() {
    this.entities = this.entities.filter((e) => e.type !== EntityType.DOMINION_TANK);
    this.dominionZones = [];
    this.dominionScoreTickTimer = 5;
    this.dominionMatchTimer = 600;
    this.dominionRoundResetTimer = 0;
    this.dominionPendingWinner = Team.NONE;
    this.dominionScores = {
      [Team.NONE]: 0,
      [Team.BLUE]: 0,
      [Team.RED]: 0,
      [Team.GREEN]: 0,
      [Team.PURPLE]: 0
    };
    this.dominionOwnedCount = {
      [Team.NONE]: 0,
      [Team.BLUE]: 0,
      [Team.RED]: 0,
      [Team.GREEN]: 0,
      [Team.PURPLE]: 0
    };
  }

  private spawnDominionObjectives() {
    this.resetDominionState();
    if (this.gameMode !== GameMode.DOMINION) return;
    const blueprints = this.getDominionZoneBlueprints();
    blueprints.forEach((blueprint, index) => {
      const tank = new DominionTank(this.nextId(), blueprint.pos.x, blueprint.pos.y, index, blueprint.radius, this.getDominionWeaponProfile(index));
      this.entities.push(tank);
      this.dominionZones.push({
        id: index,
        pos: blueprint.pos,
        radius: blueprint.radius,
        tankId: tank.id,
        owner: Team.NONE,
        contested: false,
      });
    });
    this.syncDominionOwnedCounts();
  }

  private rebuildDominionObjectivesFromCurrentState() {
    this.entities = this.entities.filter((e) => e.type !== EntityType.DOMINION_TANK);
    if (this.gameMode !== GameMode.DOMINION) return;
    if (this.dominionZones.length === 0) {
      this.spawnDominionObjectives();
      return;
    }

    for (let index = 0; index < this.dominionZones.length; index++) {
      const zone = this.dominionZones[index];
      const tank = new DominionTank(this.nextId(), zone.pos.x, zone.pos.y, zone.id, zone.radius, this.getDominionWeaponProfile(index));
      tank.resetForStage(zone.owner, zone.owner !== Team.NONE);
      zone.tankId = tank.id;
      zone.contested = false;
      this.entities.push(tank);
    }
    this.syncDominionOwnedCounts();
  }

  private syncDominionOwnedCounts() {
    this.dominionOwnedCount[Team.BLUE] = 0;
    this.dominionOwnedCount[Team.RED] = 0;
    this.dominionOwnedCount[Team.GREEN] = 0;
    this.dominionOwnedCount[Team.PURPLE] = 0;
    this.dominionOwnedCount[Team.NONE] = 0;
    for (const zone of this.dominionZones) {
      this.dominionOwnedCount[zone.owner] = (this.dominionOwnedCount[zone.owner] || 0) + 1;
    }
  }

  private getDominionZoneStates(): DominionZoneState[] {
    return this.dominionZones.map((zone) => ({
      id: zone.id,
      pos: { ...zone.pos },
      radius: zone.radius,
      owner: zone.owner,
      contested: zone.contested,
    }));
  }

  private resolveOwningTeamFromSource(sourceId: number | null): Team {
    if (sourceId === null) return Team.NONE;
    const source = this.entities.find((entity) => entity.id === sourceId);
    if (!source) return Team.NONE;
    if (source.type === EntityType.BULLET) {
      const owner = this.entities.find((entity) => entity.id === (source as Bullet).ownerId);
      return owner?.team ?? Team.NONE;
    }
    if (source.type === EntityType.DRONE || source.type === EntityType.MINI_TANK) {
      return (source as Drone | MiniTank).owner.team;
    }
    return source.team;
  }

  private handleDominionTankDefeat(tank: DominionTank) {
    const zone = this.dominionZones.find((entry) => entry.tankId === tank.id);
    if (!zone) return;
    const resolvedKiller = tank.lastDamageSourceId === null && tank.damageDealtBy.size === 0
      ? null
      : this.resolveKillerForVictim(tank);
    const killerSourceId =
      tank.lastDamageSourceId ??
      (resolvedKiller ? (resolvedKiller.type === EntityType.BULLET ? (resolvedKiller as Bullet).id : resolvedKiller.id) : null);
    const capturingTeam = this.resolveOwningTeamFromSource(killerSourceId);
    const validCapturingTeam = isPlayableTeam(capturingTeam) ? capturingTeam : Team.NONE;
    const wasNeutral = zone.owner === Team.NONE;
    const nextOwner = wasNeutral ? validCapturingTeam : Team.NONE;
    tank.resetForStage(nextOwner, nextOwner !== Team.NONE);
    tank.contestedPulse = 1.8;
    zone.owner = nextOwner;
    zone.contested = false;
    this.syncDominionOwnedCounts();

    if (nextOwner === Team.NONE) {
      this.addNotification('DOMINION TANK NEUTRALISED', COLORS.dominionNeutral);
    } else if (nextOwner === this.player.team) {
      this.addNotification('YOUR TEAM CAPTURED A DOMINION TANK!', getTeamColor(nextOwner));
    } else {
      this.addNotification(`${nextOwner} CAPTURED A DOMINION TANK!`, getTeamColor(nextOwner));
    }
  }

  private getDominionWinningTeam(): Team {
    let bestTeam = Team.NONE;
    let bestScore = -Infinity;
    for (const team of PLAYABLE_TEAMS) {
      const score = this.dominionScores[team] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestTeam = team;
      }
    }
    return bestTeam;
  }

  private triggerDominionRoundReset(winner: Team, reason: 'score_limit' | 'timer'): void {
    if (this.dominionRoundResetTimer > 0) return;
    this.dominionPendingWinner = winner;
    this.dominionRoundResetTimer = 4;
    const color = winner === Team.NONE ? COLORS.dominionNeutral : getTeamColor(winner);
    const winnerLabel = winner === Team.NONE ? 'NO TEAM' : `${winner}`;
    const reasonLabel = reason === 'score_limit' ? 'SCORE LIMIT' : 'TIMER END';
    this.addNotification(`DOMINION ${reasonLabel} // ${winnerLabel} LEADS`, color);
  }

  private resetDominionRound(): void {
    const roundWinner = this.dominionPendingWinner;
    const preservedShapes = this.entities.filter((entity) => entity.type === EntityType.SHAPE);
    const combatants = this.entities.filter((entity) =>
      entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK
    ) as Tank[];
    this.entities = [...preservedShapes];
    this.killFeed = [];
    this.floatingTexts = [];
    this.particles = [];
    this.resetDominionState();
    this.spawnDominionObjectives();

    for (let i = 0; i < combatants.length; i++) {
      const tank = combatants[i];
      tank.pos = this.getSpawnPos(tank.team);
      tank.vel = { x: 0, y: 0 };
      tank.acc = { x: 0, y: 0 };
      tank.aiTargetId = null;
      tank.aiHuntingSpecialId = null;
      tank.aiShooting = false;
      tank.aiState = AIState.IDLE;
      tank.health = tank.maxHealth;
      tank.displayHealth = tank.maxHealth;
      tank.shield = tank.maxShield;
      tank.invulnerableTime = Math.max(tank.invulnerableTime || 0, 2000);
      tank.lastDamageSourceId = null;
      if (!this.entities.includes(tank)) this.entities.push(tank);
    }

    if (this.player && !this.entities.includes(this.player)) {
      this.entities.push(this.player);
    }

    if (roundWinner !== Team.NONE) {
      this.addNotification(`${roundWinner} OPENS THE NEXT ROUND`, getTeamColor(roundWinner));
    } else {
      this.addNotification('DOMINION ROUND RESET', COLORS.dominionNeutral);
    }
  }

  private updateDominionSystem(dt: number) {
    if (this.gameMode !== GameMode.DOMINION || this.inVoid) return;

    if (this.dominionRoundResetTimer > 0) {
      this.dominionRoundResetTimer = Math.max(0, this.dominionRoundResetTimer - dt);
      if (this.dominionRoundResetTimer <= 0) {
        this.resetDominionRound();
      }
      return;
    }

    const dominionTanks = this.entities.filter((entity): entity is DominionTank => entity instanceof DominionTank && !entity.isDead);
    for (const zone of this.dominionZones) {
      const tank = dominionTanks.find((entity) => entity.id === zone.tankId);
      if (!tank) continue;

      const nearbyTanks = this.entities.filter((entity) =>
        !entity.isDead &&
        (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK) &&
        Vector.dist(entity.pos, zone.pos) <= zone.radius + 180
      ) as Tank[];
      const validTargets = nearbyTanks.filter((entity) => {
        if (entity.team === Team.NONE || entity.team === zone.owner) return false;
        const ownSafeZone = this.getSafeZoneRect(entity.team);
        return !ownSafeZone || !this.isInsideRect(entity.pos, ownSafeZone);
      });
      zone.contested = validTargets.length > 0;
      if (zone.contested) tank.contestedPulse = 1.8;

      if (validTargets.length > 0) {
        const prioritized = [...validTargets].sort((a, b) => {
          const aThreat = (a.lastDamageSourceId === tank.id ? -220 : 0) + Vector.dist(a.pos, tank.pos);
          const bThreat = (b.lastDamageSourceId === tank.id ? -220 : 0) + Vector.dist(b.pos, tank.pos);
          return aThreat - bThreat;
        })[0];
        const bulletSpeed = (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * 1.22;
        const intercept = this.getInterceptPoint(tank.pos, bulletSpeed, prioritized.pos, prioritized.vel);
        tank.aiTargetRot = Math.atan2(intercept.y - tank.pos.y, intercept.x - tank.pos.x);
        tank.rotation = tank.lerpAngle(tank.rotation, tank.aiTargetRot, Math.min(1, dt * 5.5));
        tank.aiShooting = true;
        this.attemptShoot(tank);
      } else {
        tank.aiShooting = false;
        tank.rotation += dt * 0.3;
      }
    }

    this.dominionScoreTickTimer -= dt;
    this.dominionMatchTimer = Math.max(0, this.dominionMatchTimer - dt);
    if (this.dominionScoreTickTimer <= 0) {
      this.dominionScoreTickTimer = 5;
      for (const zone of this.dominionZones) {
        if (isPlayableTeam(zone.owner)) this.dominionScores[zone.owner] += 1;
      }
    }

    const leadingTeam = this.getDominionWinningTeam();
    if (leadingTeam !== Team.NONE && (this.dominionScores[leadingTeam] || 0) >= 500) {
      this.triggerDominionRoundReset(leadingTeam, 'score_limit');
      return;
    }

    if (this.dominionMatchTimer <= 0) {
      this.triggerDominionRoundReset(leadingTeam, 'timer');
    }
  }

  private isInsideRect(pos: Vector2, rect: { x: number; y: number; w: number; h: number }): boolean {
    return pos.x >= rect.x && pos.x <= rect.x + rect.w && pos.y >= rect.y && pos.y <= rect.y + rect.h;
  }

  private applySafeZoneProtection(dt: number) {
    if (this.inVoid) return;
    if (this.gameMode !== GameMode.TEAMS && this.gameMode !== GameMode.DOMINION) return;

    const activeTeams = this.gameMode === GameMode.DOMINION ? PLAYABLE_TEAMS : [Team.BLUE, Team.RED];
    this.entities.forEach((entity) => {
      if (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK) {
        for (const team of activeTeams) {
          const rect = this.getSafeZoneRect(team);
          if (!rect) continue;
          if (entity.team === team) continue;
          if (!this.isInsideRect(entity.pos, rect)) continue;
          const center = { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 };
          const away = Vector.normalize(Vector.sub(entity.pos, center));
          entity.vel = Vector.add(entity.vel, Vector.mult(away, 1500 * dt));
        }
      }
      if (entity.type === EntityType.BULLET || entity.type === EntityType.DRONE || entity.type === EntityType.MINI_TANK) {
        for (const team of activeTeams) {
          const rect = this.getSafeZoneRect(team);
          if (!rect) continue;
          if (entity.team === team) continue;
          if (!this.isInsideRect(entity.pos, rect)) continue;
          entity.isDead = true;
          this.particles.push(new Particle(entity.pos.x, entity.pos.y, `${getTeamColor(team)}88`, 9, 12, 'RING'));
          this.particles.push(new Particle(entity.pos.x, entity.pos.y, `${getTeamColor(team)}aa`, 4, 10, 'FLASH'));
        }
      }
    });
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

  private getShapePopulationLimit(): number {
    if (this.gameMode === GameMode.BOSS_RUSH) return 0;
    if (this.gameMode === GameMode.SANDBOX && this.sandboxConfig) return this.sandboxConfig.shapeMaxCount;
    return Number.POSITIVE_INFINITY;
  }

  private getCommonShapeActiveLimit(): number {
    if (this.gameMode === GameMode.BOSS_RUSH) return 0;
    if (this.gameMode === GameMode.SANDBOX && this.sandboxConfig) return this.commonShapeMaxActive;
    return Number.POSITIVE_INFINITY;
  }

  private getCommonShapeSpawnCooldown(): number {
    if (this.gameMode === GameMode.BOSS_RUSH) return 9999;
    if (this.gameMode === GameMode.DOMINION) return 0.12;
    if (this.gameMode === GameMode.TEAMS) return 0.14;
    if (this.gameMode === GameMode.FFA) return 0.18;
    return 0.85;
  }

  private seedTeamFarmFields(): void {
    if (this.inVoid || (this.gameMode !== GameMode.TEAMS && this.gameMode !== GameMode.DOMINION)) return;
    const teams = this.gameMode === GameMode.DOMINION ? PLAYABLE_TEAMS : [Team.BLUE, Team.RED];
    const limit = this.getShapePopulationLimit();

    for (const team of teams) {
      const spawnCenter = this.getTeamSpawnCenter(team);
      const toMid = Vector.normalize(Vector.sub({ x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.5 }, spawnCenter));
      const side = { x: -toMid.y, y: toMid.x };
      const baseForward = this.gameMode === GameMode.DOMINION ? BASE_ZONE_WIDTH * 1.05 : BASE_ZONE_WIDTH * 0.82;
      const fieldCount = this.gameMode === GameMode.DOMINION ? 16 : 18;

      for (let i = 0; i < fieldCount && this.currentShapeCount < limit; i++) {
        const lane = (i % 6) - 2.5;
        const depth = baseForward + 140 + Math.floor(i / 6) * 170 + Math.random() * 120;
        const lateral = lane * 110 + Vector.randomRange(-45, 45);
        const pos = {
          x: Vector.clamp(spawnCenter.x + toMid.x * depth + side.x * lateral, 120, CANVAS_WIDTH - 120),
          y: Vector.clamp(spawnCenter.y + toMid.y * depth + side.y * lateral, 120, CANVAS_HEIGHT - 120),
        };
        if (Vector.dist(pos, this.player.pos) < 620) continue;
        let crowded = false;
        for (const e of this.entities) {
          if (e.type === EntityType.SHAPE && Vector.dist(e.pos, pos) < 105) {
            crowded = true;
            break;
          }
        }
        if (crowded) continue;
        const roll = Math.random();
        const type =
          roll < 0.06 ? ShapeType.PENTAGON :
          roll < 0.24 ? ShapeType.STAR :
          roll < 0.46 ? ShapeType.TRIANGLE :
          roll < 0.68 ? ShapeType.DIAMOND :
          ShapeType.SQUARE;
        this.entities.push(new Shape(this.nextId(), pos.x, pos.y, type, false, ShapeRarity.COMMON));
        this.currentShapeCount++;
      }
    }
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
    this.zoneTeamPressureGreen.fill(0);
    this.zoneTeamPressurePurple.fill(0);

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
        if (tank.team === Team.GREEN) this.zoneTeamPressureGreen[zoneIndex] += 1;
        if (tank.team === Team.PURPLE) this.zoneTeamPressurePurple[zoneIndex] += 1;
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
      const nestBias = Math.max(0, 1 - distFromMidNorm / 0.34);
      const quietBias = Math.max(0, Math.min(1, (4 - pressure) / 4));

      let score = 1.0;
      score += Math.max(0, 5 - shapes) * 1.2;
      score += Math.max(0, 3 - pressure) * 1.4;
      if (recentlyUsed) score -= 2.0;

      if (this.gameMode === GameMode.DOMINION) {
        const greenPressure = this.zoneTeamPressureGreen[i] || 0;
        const purplePressure = this.zoneTeamPressurePurple[i] || 0;
        const teamSpread = Math.max(bluePressure, redPressure, greenPressure, purplePressure) - Math.min(bluePressure, redPressure, greenPressure, purplePressure);
        score += midBias * 1.9;
        score += quietBias * 1.2;
        score += Math.max(0, 2 - teamSpread) * 0.85;
      } else if (this.gameMode === GameMode.TEAMS) {
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
    const shapePressure = this.zoneShapeCounts[zoneIndex] || 0;
    const playerPressure = this.zonePlayerPressure[zoneIndex] || 0;
    const quietness = Math.max(0, Math.min(1, (4 - playerPressure) / 4));
    const lowDensity = Math.max(0, Math.min(1, (8 - shapePressure) / 8));
    const commonBias = quietness * 0.6 + lowDensity * 0.4;
    const nestBias = Math.max(0, 1 - distNorm / 0.26);
    const roll = Math.random();

    if (this.gameMode === GameMode.DOMINION) {
      const midBias = 1 - distNorm;
      const dodecThresh = Math.max(0.00006, 0.0001 + midBias * 0.00045);
      const decThresh = dodecThresh + Math.max(0.00016, 0.00028 + midBias * 0.0009);
      const nonThresh = decThresh + Math.max(0.00034, 0.00062 + midBias * 0.0015);
      const octThresh = nonThresh + Math.max(0.0009, 0.0019 + midBias * 0.0038 - commonBias * 0.0008);
      const hexThresh = octThresh + Math.max(0.0032, 0.0064 + midBias * 0.0082 - commonBias * 0.0038);
      const heptThresh = hexThresh + Math.max(0.0068, 0.011 + midBias * 0.0115 - commonBias * 0.0052);
      const pentThresh = heptThresh + Math.max(0.014, 0.022 + midBias * 0.016 - commonBias * 0.0075);
      const starThresh = Math.min(0.56, pentThresh + 0.13 + commonBias * 0.04);
      const triThresh = Math.min(0.89, starThresh + 0.29 + commonBias * 0.05);
      const diaThresh = Math.min(0.976, triThresh + 0.13 + commonBias * 0.04);
      if (roll < dodecThresh) return ShapeType.DODECAGON;
      if (roll < decThresh) return ShapeType.DECAGON;
      if (roll < nonThresh) return ShapeType.NONAGON;
      if (roll < octThresh) return ShapeType.OCTAGON;
      if (roll < hexThresh) return ShapeType.HEXAGON;
      if (roll < heptThresh) return ShapeType.HEPTAGON;
      if (roll < pentThresh) return ShapeType.PENTAGON;
      if (roll < starThresh) return ShapeType.STAR;
      if (roll < triThresh) return ShapeType.TRIANGLE;
      if (roll < diaThresh) return ShapeType.DIAMOND;
      return ShapeType.SQUARE;
    }

    if (this.gameMode === GameMode.TEAMS) {
      const midBias = 1 - distNorm;
      const dodecThresh = Math.max(0.00008, 0.00012 + midBias * 0.00075 + nestBias * 0.0004);
      const decThresh = dodecThresh + Math.max(0.00018, 0.00034 + midBias * 0.0013 + nestBias * 0.00085);
      const nonThresh = decThresh + Math.max(0.0004, 0.00085 + midBias * 0.0024 + nestBias * 0.0018);
      const octThresh = nonThresh + Math.max(0.001, 0.0024 + midBias * 0.006 + nestBias * 0.0035 - commonBias * 0.0008);
      const hexThresh = octThresh + Math.max(0.0036, 0.008 + midBias * 0.012 + nestBias * 0.01 - commonBias * 0.0048);
      const heptThresh = hexThresh + Math.max(0.0076, 0.014 + midBias * 0.016 + nestBias * 0.016 - commonBias * 0.0062);
      const pentThresh = heptThresh + Math.max(0.024, 0.04 + midBias * 0.03 + nestBias * 0.05 - commonBias * 0.012);
      const starThresh = Math.min(0.56, pentThresh + 0.12 + commonBias * 0.035);
      const triThresh = Math.min(0.88, starThresh + 0.28 + commonBias * 0.045 - nestBias * 0.04);
      const diaThresh = Math.min(0.975, triThresh + 0.14 + commonBias * 0.045 - nestBias * 0.015);
      if (roll < dodecThresh) return ShapeType.DODECAGON;
      if (roll < decThresh) return ShapeType.DECAGON;
      if (roll < nonThresh) return ShapeType.NONAGON;
      if (roll < octThresh) return ShapeType.OCTAGON;
      if (roll < hexThresh) return ShapeType.HEXAGON;
      if (roll < heptThresh) return ShapeType.HEPTAGON;
      if (roll < pentThresh) return ShapeType.PENTAGON;
      if (roll < starThresh) return ShapeType.STAR;
      if (roll < triThresh) return ShapeType.TRIANGLE;
      if (roll < diaThresh) return ShapeType.DIAMOND;
      return ShapeType.SQUARE;
    }

    const dodecThresh = Math.max(0.00004, 0.00008 - commonBias * 0.00002);
    const decThresh = dodecThresh + Math.max(0.00012, 0.00022 - commonBias * 0.00004);
    const nonThresh = decThresh + Math.max(0.00028, 0.00054 - commonBias * 0.00008);
    const octThresh = nonThresh + Math.max(0.0009, 0.0018 - commonBias * 0.0005);
    const hexThresh = octThresh + Math.max(0.0036, 0.0066 - commonBias * 0.002);
    const heptThresh = hexThresh + Math.max(0.0062, 0.0102 - commonBias * 0.0028);
    const pentThresh = heptThresh + Math.max(0.011, 0.0178 - commonBias * 0.0048);
    const starThresh = Math.min(0.48, pentThresh + 0.105 + commonBias * 0.04);
    const triThresh = Math.min(0.86, starThresh + 0.35 + commonBias * 0.055);
    const diaThresh = Math.min(0.965, triThresh + 0.17 + commonBias * 0.055);
    if (roll < dodecThresh) return ShapeType.DODECAGON;
    if (roll < decThresh) return ShapeType.DECAGON;
    if (roll < nonThresh) return ShapeType.NONAGON;
    if (roll < octThresh) return ShapeType.OCTAGON;
    if (roll < hexThresh) return ShapeType.HEXAGON;
    if (roll < heptThresh) return ShapeType.HEPTAGON;
    if (roll < pentThresh) return ShapeType.PENTAGON;
    if (roll < starThresh) return ShapeType.STAR;
    if (roll < triThresh) return ShapeType.TRIANGLE;
    if (roll < diaThresh) return ShapeType.DIAMOND;
    return ShapeType.SQUARE;
  }

  private isPentagonNestZone(zoneIndex: number): boolean {
    const zone = this.spawnZones[zoneIndex];
    if (!zone) return false;
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const distNorm = Math.min(1, Vector.dist({ x: zone.cx, y: zone.cy }, center) / (Math.hypot(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.5));
    return distNorm <= 0.25;
  }

  private getPentagonNestSpawnPosition(): Vector2 {
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const biomeLane = Math.floor(Math.random() * 5);
    const laneAngle = biomeLane * ((Math.PI * 2) / 5);
    const angle = laneAngle + Vector.randomRange(-0.34, 0.34);
    const ringBias = Math.random();
    const dist =
      ringBias < 0.34
        ? 260 + Math.sqrt(Math.random()) * 360
        : ringBias < 0.82
          ? 680 + Math.sqrt(Math.random()) * 520
          : 1120 + Math.sqrt(Math.random()) * 260;
    const tangentJitter = Vector.randomRange(-140, 140);
    return {
      x: center.x + Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * tangentJitter,
      y: center.y + Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * tangentJitter,
    };
  }

  nextId() { return ++this.idCounter; }
  setPlayerName(name: string) { this.player.name = name; }
  setPlayerColor(color: string) { 
      this.preferredColor = color;
      if (typeof color === 'string' && color.startsWith('color_')) {
          this.setPlayerSkin(color, this.preferredDonorRank);
      } else {
          this.setPlayerSkin('default', this.preferredDonorRank);
      }
  }
  setPlayerSkin(skinId: string, donorRank: DonorRank = 'standard') {
      this.preferredSkinId = skinId || 'default';
      this.preferredDonorRank = donorRank;
      this.player.setSkin(this.preferredSkinId, this.preferredDonorRank);
  }
  setPlayerTeam(team: Team) { this.preferredTeam = team; }
  getNowMs() { return Date.now(); }
  getSimTimeMs() { return this.simulationTick * (1000 / 60); }
  setGameMode(mode: GameMode) { 
      const fromMode = this.gameMode;
      this.previousGameMode = fromMode;
      this.gameMode = mode; 
      if (mode !== GameMode.DOMINION) {
          this.resetDominionState();
      }
      if (mode !== GameMode.BOSS_RUSH) {
          this.bossRushMode.reset();
      }
      if (fromMode === GameMode.SANDBOX && mode !== GameMode.SANDBOX) {
          this.hardResetSandboxLeakedProgress(mode);
      }
      if (mode === GameMode.TEAMS) {
          this.spawnGuardians();
          this.spawnBaseDefenseDrones();
      } else if (mode === GameMode.DOMINION) {
          this.entities = this.entities.filter(e => e.type !== EntityType.GUARDIAN && e.type !== EntityType.BASE_DEFENSE_DRONE);
          this.clearBaseDefenseDrones();
          this.spawnDominionObjectives();
      } else if (mode === GameMode.BOSS_RUSH) {
          this.entities = this.entities.filter(e => e === this.player);
          this.clearBaseDefenseDrones();
          this.resetDominionState();
      } else if (mode === GameMode.SANDBOX) {
          this.clearBaseDefenseDrones();
          this.cleanupForSandbox();
      } else {
          this.clearBaseDefenseDrones();
      }
  }

  private hardResetSandboxLeakedProgress(targetMode: GameMode) {
      this.level = 1;
      this.xp = 0;
      this.player.level = 1;
      this.player.score = 0;
      this.player.availableStatPoints = 0;
      this.player.isTransformed = false;
      this.player.transformationTimer = 0;
      this.player.hasRebirthed = false;
      this.player.damageDealtBy.clear();
      this.rebirthEligible = false;
      this.rebirthPromptSeen = false;
      this.transformationReadyTimer = 0;
      this.transformationReadyClass = null;
      this.primedSpawn = null;
      this.resetTankClassAndProgression(this.player, TankClass.BASIC);
      this.player.health = this.player.maxHealth;
      this.player.displayHealth = this.player.maxHealth;
      this.player.shield = 0;
      this.entities = this.entities.filter(e => {
          if (e === this.player) return true;
          if (e.type === EntityType.BULLET) return false;
          if (e.type === EntityType.DRONE || e.type === EntityType.MINI_TANK) {
              return (e as Drone | MiniTank).owner.id !== this.player.id;
          }
          return true;
      });
      this.addNotification(`SANDBOX STATE PURGED -> ${targetMode}`, "#22d3ee");
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
          botsEnabled: true,
          gameSpeed: 1.0,
          showHitboxes: false,
          freezeAll: false,
          spawningEnabled: true,
          noAbilityCooldown: false,
          shapeSpawnRate: 1.2,
          shapeMaxCount: 420,
          enabledShapes: {
              [ShapeType.SQUARE]: true,
              [ShapeType.DIAMOND]: true,
              [ShapeType.TRIANGLE]: true,
              [ShapeType.STAR]: true,
              [ShapeType.PENTAGON]: true,
              [ShapeType.HEPTAGON]: true,
              [ShapeType.HEXAGON]: true,
              [ShapeType.OCTAGON]: true,
              [ShapeType.NONAGON]: true,
              [ShapeType.DECAGON]: true,
              [ShapeType.DODECAGON]: true,
          },
          cleanupActive: true,
          showSpawnNotifications: true,
          projectileDamageScale: 1.0,
          projectileDurabilityScale: 1.0,
          droneDamageScale: 1.0,
          droneDurabilityScale: 1.0,
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
      this.manualSpectateMode = false;
      if (enabled) {
          this.spectateTarget = null;
      }
  }

  getSpectateCandidates(): Tank[] {
      return this.entities.filter((entity): entity is Tank => (
          entity instanceof Tank &&
          entity.isBot &&
          !entity.isDead &&
          Number.isFinite(entity.pos.x) &&
          Number.isFinite(entity.pos.y)
      ));
  }

  hasSpectateTargets(): boolean {
      return this.getSpectateCandidates().length > 0;
  }

  enterSpectateMode(): boolean {
      this.attractMode = true;
      this.manualSpectateMode = true;
      return !!this.ensureValidSpectateTarget(true);
  }

  spectateEntityById(targetId: number | null | undefined): boolean {
      if (targetId == null) return false;
      const target = this.getSpectateCandidates().find((bot) => bot.id === targetId) ?? null;
      if (!target) return false;
      this.attractMode = true;
      this.manualSpectateMode = true;
      this.spectateTarget = target;
      return true;
  }

  exitSpectateMode() {
      this.manualSpectateMode = false;
      this.spectateTarget = null;
      this.attractMode = true;
      this.cameraPos = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      this.cameraZoom = 0.8;
  }

  private ensureValidSpectateTarget(preferFirst: boolean = false): Tank | null {
      const bots = this.getSpectateCandidates();
      if (bots.length === 0) {
          this.spectateTarget = null;
          return null;
      }

      if (preferFirst || !this.spectateTarget) {
          this.spectateTarget = bots[0];
          return this.spectateTarget;
      }

      const liveTarget = bots.find((bot) => bot.id === this.spectateTarget?.id);
      this.spectateTarget = liveTarget ?? bots[0];
      return this.spectateTarget;
  }

  getTeamCounts() {
      const counts = { [Team.BLUE]: 0, [Team.RED]: 0, [Team.GREEN]: 0, [Team.PURPLE]: 0, [Team.NONE]: 0 };
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
      if (this.gameMode !== GameMode.TEAMS && this.gameMode !== GameMode.DOMINION) return true;
      const counts = this.getTeamCounts();
      const activeTeams = this.gameMode === GameMode.DOMINION ? PLAYABLE_TEAMS : [Team.BLUE, Team.RED];
      const maxCount = activeTeams.reduce((best, activeTeam) => Math.max(best, counts[activeTeam] ?? 0), 0);
      return (counts[team] ?? 0) <= maxCount + 1;
  }

  cycleSpectateTarget(direction: number = 1) {
      const bots = this.getSpectateCandidates();
      if (bots.length === 0) {
          this.spectateTarget = null;
          return;
      }
      
      if (direction === 0 || !this.spectateTarget) {
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
          this.entities = this.entities.filter(e =>
            e.type !== EntityType.BULLET &&
            e.type !== EntityType.DRONE &&
            e.type !== EntityType.MINI_TANK &&
            e.type !== EntityType.BASE_DEFENSE_DRONE
          );
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

      const { type, shapeType, rarity, classType, weaponProfile, spawnAmount = 1 } = this.primedSpawn;

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
          } else if (type === 'DOMINION_TANK') {
              const dominion = new DominionTank(this.nextId(), worldX + ox, worldY + oy, -1, 260, weaponProfile || 'TRIPLE');
              dominion.resetForStage(Team.NONE, false);
              this.entities.push(dominion);
          } else if (type === 'ALPHA_PENTAGON') {
              const shape = new Shape(this.nextId(), worldX + ox, worldY + oy, ShapeType.PENTAGON, false, ShapeRarity.LEGENDARY);
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
      this.player.availableStatPoints = this.getStatPointBudgetForLevel(this.level);
      this.addNotification("STATS FLUSHED", "#333");
  }
  instantLevel(level: number) { 
      this.level = level; 
      this.player.level = level; 
      this.player.availableStatPoints = this.getStatPointBudgetForLevel(level); 
      this.player.updateStats(); 
      this.addNotification(`SYNCED TO LVL ${level}`, "#33ccff"); 
  }

  spawnElite() {
      const currentElites = this.entities.filter((e) => e.type === EntityType.ELITE_TANK && !e.isDead).length;
      const eliteCap = this.gameMode === GameMode.TEAMS ? 3 : 2;
      if (currentElites >= eliteCap) return;

      let pos: Vector2 | null = null;
      for (let i = 0; i < 18; i++) {
          const candidate = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
          const farEnoughFromPlayer = Vector.dist(candidate, this.player.pos) > (this.gameMode === GameMode.TEAMS ? 1300 : 1100);
          const localCrowding = this.entities.some((e) =>
              !e.isDead &&
              Vector.dist(candidate, e.pos) < 260 &&
              (e.type === EntityType.ENEMY || e.type === EntityType.PLAYER || e.type === EntityType.ELITE_TANK || e.type === EntityType.BOSS)
          );
          if (farEnoughFromPlayer && !localCrowding) {
              pos = candidate;
              break;
          }
      }
      if (!pos) pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);

      const classes = [TankClass.TWIN, TankClass.DESTROYER, TankClass.SNIPER, TankClass.OVERLORD, TankClass.MACHINE_GUN, TankClass.HUNTER, TankClass.TRI_ANGLE];
      const weightedPool = this.player.level >= 30 && Math.random() < 0.45
          ? [TankClass.DESTROYER, TankClass.SNIPER, TankClass.OVERLORD, TankClass.MACHINE_GUN]
          : classes;
      const chosenClass = weightedPool[Math.floor(Math.random() * weightedPool.length)];
      const elite = new EliteTank(this.nextId(), pos.x, pos.y, chosenClass);
      this.entities.push(elite);
      this.addNotification(`ELITE ${chosenClass.toUpperCase()} VARIANT DETECTED`, "#ff4444");
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
          [Team.GREEN]: [],
          [Team.PURPLE]: [],
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
    const archetype = this.gameMode === GameMode.DOMINION ? undefined : 'SINGULARITY';
    const boss = new Boss(this.nextId(), archetype);
    this.entities.push(boss);
    this.addNotification(`⚠️ ${boss.name} HAS ARRIVED ⚠️`, "#00ffff");
    this.sound.playRoar();
  }

  createBossRushBoss(definition: BossRushBossDefinition) {
    const boss = new Boss(this.nextId(), definition.archetype);
    boss.name = definition.name;
    boss.color = definition.color;
    boss.maxHealth = definition.maxHealth;
    boss.health = definition.maxHealth;
    boss.displayHealth = definition.maxHealth;
    boss.radius = definition.radius;
    boss.damage = definition.contactDamage;
    boss.mass = definition.radius * 120;
    boss.pos = { ...definition.arenaAnchor };
    boss.vel = { x: 0, y: 0 };
    boss.acc = { x: 0, y: 0 };
    (boss as any).__bossRushBoss = true;
    (boss as any).__bossRushKey = definition.key;
    this.entities.push(boss);
    return boss as any;
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
    if (this.gameMode === GameMode.BOSS_RUSH) preserveWorld = false;
    this.player.isDead = false; 
    this.player.shouldRemove = false;
    this.player.lastDamageSourceId = null;
    this.gameOverSignaled = false; 
    this.playerDeathPresentation = null;
    this.playerDeathKillerRef = null;
    this.botChats = [];
    this.botDeathTauntGlobalCooldownUntil = 0;
    this.player.invulnerableTime = 3000; // 3 seconds spawn protection
    this.kills = 0;
    this.eliteKills = 0;
    this.eliteSkinsKilled.clear();
    this.transformations = 0;
    this.player.isTransformed = false;
    this.player.transformationTimer = 0;
    this.player.hasRebirthed = false;
    this.player.damageDealtBy.clear();
    this.rebirthEligible = false;
    this.rebirthPromptSeen = false;
    this.player.radius = 20;
    this.transformationReadyTimer = 0;
    this.transformationReadyClass = null;
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
        this.player.availableStatPoints = this.getStatPointBudgetForLevel(newLevel); 
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

    if (this.gameMode === GameMode.TEAMS || this.gameMode === GameMode.DOMINION) { 
        this.player.team = this.preferredTeam; 
        this.player.color = getTeamColor(this.player.team);
        this.player.setSkin(this.preferredSkinId, this.preferredDonorRank);
        this.player.pos = this.getSpawnPos(this.player.team);
    } else if (this.gameMode === GameMode.BOSS_RUSH) {
        this.player.team = Team.BLUE;
        this.player.color = COLORS.player;
        this.player.setSkin(this.preferredSkinId, this.preferredDonorRank);
        this.player.pos = { x: BOSS_RUSH_ARENA.center.x, y: BOSS_RUSH_ARENA.center.y + BOSS_RUSH_ARENA.height * 0.28 };
    }
    else { 
        this.player.team = Team.BLUE; 
        this.player.setSkin(this.preferredSkinId, this.preferredDonorRank);
        this.player.pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT); 
    }
    this.player.vel = { x: 0, y: 0 }; 
    this.resetTankClassAndProgression(this.player, TankClass.BASIC);
    if (this.gameMode === GameMode.BOSS_RUSH) {
        this.instantLevel(45);
    }
    this.player.health = this.player.maxHealth; 
    this.player.displayHealth = this.player.maxHealth; 
    this.player.visualScale = 1;
    this.player.socialSpinSignalUntil = 0;
    this.playerSpinWindowMs = 0;
    this.playerSpinAccumRad = 0;
    this.playerSpinLastRot = this.player.rotation;
    this.player.shield = 0; 
    this.player.invulnerableTime = 3000; 
    if (!this.entities.includes(this.player)) this.entities.push(this.player);
    if (!preserveWorld) { 
        this.entities = this.gameMode === GameMode.BOSS_RUSH
          ? [this.player]
          : this.entities.filter(e => e.type === EntityType.SHAPE || e === this.player);
        this.currentShapeCount = this.entities.filter(e => e.type === EntityType.SHAPE).length;
        this.killFeed = []; this.floatingTexts = []; this.particles = []; this.bossSpawnTimer = 0; this.eliteSpawnTimer = 0; if (this.gameMode === GameMode.TEAMS) { this.spawnGuardians(); this.spawnBaseDefenseDrones(); } else if (this.gameMode === GameMode.DOMINION) { this.spawnDominionObjectives(); } else if (this.gameMode === GameMode.BOSS_RUSH) { this.bossRushMode.start(this as any); }
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
    } else if (this.gameMode === GameMode.BOSS_RUSH && preserveWorld) {
        this.bossRushMode.start(this as any);
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

    if (this.isRestorationSectorActive(player)) {
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
            this.sound.playRestorationAura(this.getAudioSpatialOptions(player.pos, true));
        } else {
            this.addNotification(`ABILITY COOLDOWN: ${Math.ceil(player.healingBurstCooldown)}s`, "#ff4444");
        }
    } else if (this.isBloodSectorActive(player)) {
        this.triggerBloodSectorAbility(player, noCooldown);
    }
  }

  private triggerBloodSectorAbility(player: Tank, noCooldown: boolean) {
      if (player.drainBurstCooldown > 0 && !noCooldown) {
          this.addNotification(`ABILITY COOLDOWN: ${Math.ceil(player.drainBurstCooldown)}s`, "#ff4444");
          return;
      }

      const cfg = CLASS_ABILITY_CONFIG.blood;
      const worldMouse = this.getWorldMousePos();
      const aimVector = Vector.sub(worldMouse, player.pos);
      const aimDir = Vector.mag(aimVector) > 0.001 ? Vector.normalize(aimVector) : Vector.fromAngle(player.rotation);
      const laneDir = Vector.normalize(aimDir);
      const normal = { x: -laneDir.y, y: laneDir.x };
      const strikeRange = Math.max(cfg.baseStrikeMinRange, player.drainAuraRadius * cfg.strikeRangeMultiplier);
      const strikeHalfWidth =
          cfg.baseStrikeHalfWidth +
          player.radius * 0.35 +
          (player.stats[StatType.BULLET_PENETRATION] || 0) * 4;
      const sacrifice = Math.max(1, player.maxHealth * 0.045, player.health * cfg.healthSacrificeRatio);

      const damageBase =
          player.maxHealth * cfg.strikeDamageHealthRatio +
          player.drainAuraDamage * cfg.strikeAuraDamageScalar +
          (player.stats[StatType.BULLET_DAMAGE] || 0) * cfg.strikeStatDamageScalar;

      const candidates = this.entities
          .filter(e =>
              !e.isDead &&
              e.id !== player.id &&
              e.team !== player.team &&
              (
                  e.type === EntityType.PLAYER ||
                  e.type === EntityType.ENEMY ||
                  e.type === EntityType.SHAPE ||
                  e.type === EntityType.BOSS ||
                  e.type === EntityType.CRASHER ||
                  e.type === EntityType.GUARDIAN ||
                  e.type === EntityType.DOMINION_TANK
              )
          )
          .map(target => {
              const toTarget = Vector.sub(target.pos, player.pos);
              const forward = Vector.dot(toTarget, laneDir);
              const lateral = Math.abs(Vector.dot(toTarget, normal));
              return { target, forward, lateral };
          })
          .filter(({ target, forward, lateral }) =>
              forward > player.radius * 0.55 &&
              forward < strikeRange + target.radius &&
              lateral <= strikeHalfWidth + target.radius * 0.65
          )
          .sort((a, b) => a.forward - b.forward);

      player.takeDamage(sacrifice, player.id);

      let totalDamage = 0;
      let hitCount = 0;
      let pierceScale = 1;
      candidates.forEach(({ target, forward }) => {
          const rangeFalloff = Math.max(0.62, 1 - forward / (strikeRange * 1.18));
          const targetTypeMult =
              target.type === EntityType.SHAPE ? 1.12 :
              target.type === EntityType.CRASHER ? 1.04 :
              target.type === EntityType.BOSS || target.type === EntityType.GUARDIAN || target.type === EntityType.DOMINION_TANK ? 0.7 :
              1.0;
          const plannedDamage = damageBase * rangeFalloff * pierceScale * targetTypeMult;
          const actualDamage = Math.min(target.health, plannedDamage);
          if (actualDamage <= 0) return;

          target.takeDamage(actualDamage, player.id);
          totalDamage += actualDamage;
          hitCount += 1;

          if (target instanceof Tank) {
              target.applyDrainDot(cfg.strikeDrainDotStacks, cfg.decayStackDuration, player.id);
              target.markDrainingStatus(1200);
          }

          if (Math.random() < 0.7) {
              const p = new Particle(target.pos.x, target.pos.y, '#ef4444', 4, 22, 'AURA');
              p.vel = Vector.mult(Vector.normalize(Vector.sub(player.pos, target.pos)), 7.5);
              this.particles.push(p);
          }

          pierceScale *= cfg.strikePierceFalloff;
      });

      player.health = Math.min(player.health + totalDamage * cfg.strikeHealRatio, player.maxHealth);
      player.markDrainingStatus(1400);
      player.bloodPactActiveTimer = cfg.activeSeconds;
      player.statusAbilityUntil = Date.now() + cfg.activeSeconds * 1000;

      for (let i = 0; i < 12; i += 1) {
          const travel = strikeRange * (0.22 + i / 12 * 0.78);
          const offset = (Math.random() - 0.5) * strikeHalfWidth * 1.15;
          this.particles.push(new Particle(
              player.pos.x + laneDir.x * travel + normal.x * offset,
              player.pos.y + laneDir.y * travel + normal.y * offset,
              i < 4 ? '#fee2e2' : '#ef4444',
              i < 4 ? 6 : 4,
              18 + i,
              'AURA'
          ));
      }
      this.particles.push(new Particle(player.pos.x, player.pos.y, '#ef4444', 24, 34, 'RING'));

      const cooldownReduction = (player.stats[StatType.DRAIN_BURST] || 0) * 0.8;
      player.drainBurstCooldown = noCooldown ? 0 : Math.max(4, cfg.cooldownSeconds - cooldownReduction);

      if (hitCount > 0) {
          this.addNotification(`CRIMSON REND x${hitCount}`, "#ef4444");
      } else {
          this.addNotification("CRIMSON REND", "#ef4444");
      }
      this.sound.playBloodBurst(this.getAudioSpatialOptions(player.pos, true));
  }

  private getWorldMousePos(): Vector2 {
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      return {
          x: (this.mouse.x - viewW / 2) / this.cameraZoom + this.cameraPos.x,
          y: (this.mouse.y - viewH / 2) / this.cameraZoom + this.cameraPos.y,
      };
  }

  private triggerRestorationLinkAbility(player: Tank) {
      const noCooldown = this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown;
      if (player.restorationLinkCooldown > 0 && !noCooldown) {
          this.addNotification(`ABILITY COOLDOWN: ${Math.ceil(player.restorationLinkCooldown)}s`, "#ff4444");
          return;
      }

      const worldMouse = this.getWorldMousePos();
      const cursorLockRadius = 220;
      const chainRadius = Math.max(220, player.healingAuraRadius * 0.72);
      const maxChainTargets = 4;
      const baseHealRatio = 0.16;
      const baseRegenSeconds = 3.8;
      const chainFalloff = 0.68;
      const selfCost = Math.max(player.maxHealth * 0.045, player.health * 0.09);

      const allyPool = this.entities
          .filter(e =>
              e.id !== player.id &&
              (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) &&
              e.team === player.team &&
              !e.isDead
          )
          .map(e => e as Tank);

      if (allyPool.length === 0) {
          this.addNotification("NO ALLIES IN RANGE", "#ffbb00");
          return;
      }

      let firstTarget: Tank | null = null;
      let bestDist = Infinity;
      for (const ally of allyPool) {
          const d = Vector.dist(ally.pos, worldMouse);
          if (d < cursorLockRadius && d < bestDist) {
              bestDist = d;
              firstTarget = ally;
          }
      }
      if (!firstTarget) {
          this.addNotification("LOCK AN ALLY WITH RMB", "#ffbb00");
          return;
      }

      player.takeDamage(selfCost, player.id);

      const chainTargets: Tank[] = [firstTarget];
      const visited = new Set<number>([firstTarget.id]);
      while (chainTargets.length < maxChainTargets) {
          const from = chainTargets[chainTargets.length - 1];
          let next: Tank | null = null;
          let nextDist = Infinity;
          for (const ally of allyPool) {
              if (visited.has(ally.id)) continue;
              const d = Vector.dist(ally.pos, from.pos);
              if (d <= chainRadius && d < nextDist) {
                  nextDist = d;
                  next = ally;
              }
          }
          if (!next) break;
          visited.add(next.id);
          chainTargets.push(next);
      }

      for (let i = 0; i < chainTargets.length; i++) {
          const ally = chainTargets[i];
          const mult = Math.pow(chainFalloff, i);
          const healAmount = ally.maxHealth * baseHealRatio * mult;
          ally.health = Math.min(ally.maxHealth, ally.health + healAmount);
          ally.regenOverchargeTimer = Math.max(ally.regenOverchargeTimer, baseRegenSeconds * mult);
          ally.regenOverchargeRate = Math.max(ally.regenOverchargeRate, ally.maxHealth * (0.04 * mult));
          ally.markHealingStatus(Math.max(900, baseRegenSeconds * mult * 1000));
          ally.clearHostileDebuffs();
          this.particles.push(new Particle(ally.pos.x, ally.pos.y, `rgba(125, 255, 205, ${0.24 + mult * 0.3})`, 12 + mult * 10, 22, 'RING'));
      }

      for (let i = 0; i < chainTargets.length - 1; i++) {
          const a = chainTargets[i];
          const b = chainTargets[i + 1];
          const mid = { x: (a.pos.x + b.pos.x) * 0.5, y: (a.pos.y + b.pos.y) * 0.5 };
          this.particles.push(new Particle(mid.x, mid.y, 'rgba(110, 255, 220, 0.48)', 9, 15, 'FLASH'));
      }

      const burstReduction = (player.stats[StatType.HEALING_BURST] || 0) * 0.65;
      player.restorationLinkCooldown = noCooldown ? 0 : Math.max(5.5, 14 - burstReduction);
      player.statusAbilityUntil = Date.now() + 2200;
      this.sound.playRestorationAura(this.getAudioSpatialOptions(player.pos, true));
      this.addNotification(`VITA CONDUIT x${chainTargets.length}`, "#6ee7b7");
  }

  private transitionToDimension(toVoid: boolean, transitEntityIds: number[] = []) {
      if (this.pendingDimensionTransition) return;
      this.pendingDimensionTransition = {
          toVoid,
          transitEntityIds: Array.from(new Set(transitEntityIds)),
          phase: 'FADE_OUT',
          timer: 0,
      };
      this.isTransitioning = true;
      this.playerVoidTransitStage = toVoid ? 'SHIFT' : 'EXTRACT';
      this.playerVoidTransitProgress = 1;
      this.addNotification(toVoid ? "ENTERING WORMHOLE" : "EXITING WORMHOLE", COLORS.voidPortal);
      this.portalCoreOccupancyMs.clear();
      this.portalTransitQueuedIds.clear();
      this.portalStageNotified.clear();
  }

  private executeDimensionSwap(toVoid: boolean, transitEntityIds: number[] = []) {
      const transitSet = new Set<number>(transitEntityIds);
      const resolvedTransitSet = this.buildDimensionTransitSet(transitSet);
      this.inVoid = toVoid;
      this.voidTimer = toVoid ? 300 : 0;
      this.portalSpawnTimer = 0;
      this.entities = this.entities.filter(e => resolvedTransitSet.has(e.id));
      if (resolvedTransitSet.size > 0) {
          const gatePos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
          for (const e of this.entities) {
              if (!resolvedTransitSet.has(e.id)) continue;
              const spread = e.type === EntityType.PLAYER || e.type === EntityType.ENEMY ? 220 : 300;
              e.pos.x = Vector.clamp(gatePos.x + Vector.randomRange(-spread, spread), e.radius, CANVAS_WIDTH - e.radius);
              e.pos.y = Vector.clamp(gatePos.y + Vector.randomRange(-spread, spread), e.radius, CANVAS_HEIGHT - e.radius);
              e.vel.x *= 0.25;
              e.vel.y *= 0.25;
              e.invulnerableTime = 0;
          }
      }
      this.currentShapeCount = 0;
      if (toVoid) {
          const exitPos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
          this.entities.push(new VoidPortal(this.nextId(), exitPos.x, exitPos.y, true));
      } else {
          if (this.gameMode === GameMode.TEAMS) {
              this.spawnGuardians();
              this.spawnBaseDefenseDrones();
          } else if (this.gameMode === GameMode.DOMINION) {
              this.rebuildDominionObjectivesFromCurrentState();
          }
      }
      for (let i = 0; i < 150; i++) this.spawnShape();
      this.seedTeamFarmFields();
  }

  private updateDimensionTransition(dt: number) {
      const active = this.pendingDimensionTransition;
      if (!active) {
          this.transitionAlpha = Math.max(0, this.transitionAlpha - dt * 5.2);
          return;
      }

      active.timer += dt;
      if (active.phase === 'FADE_OUT') {
          this.transitionAlpha = Math.min(1, this.transitionAlpha + dt * 7.4);
          if (active.timer >= 0.22) {
              this.executeDimensionSwap(active.toVoid, active.transitEntityIds);
              active.phase = 'FADE_IN';
              active.timer = 0;
          }
          return;
      }

      this.transitionAlpha = Math.max(0, this.transitionAlpha - dt * 6.1);
      if (active.timer >= 0.18 && this.transitionAlpha <= 0.02) {
          this.pendingDimensionTransition = null;
          this.isTransitioning = false;
          this.playerVoidTransitStage = null;
          this.playerVoidTransitProgress = 0;
      }
  }

  private buildDimensionTransitSet(seedIds: Set<number>): Set<number> {
      const transit = new Set<number>(seedIds);
      if (transit.size === 0) {
          for (const entity of this.entities) {
              if (entity.isDead) continue;
              if (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY) {
                  transit.add(entity.id);
              }
          }
      }

      let mutated = true;
      while (mutated) {
          mutated = false;
          for (const entity of this.entities) {
              if (entity.isDead || transit.has(entity.id)) continue;
              if (entity.type === EntityType.BULLET) {
                  const ownerId = (entity as Bullet).ownerId;
                  if (transit.has(ownerId)) {
                      transit.add(entity.id);
                      mutated = true;
                  }
              } else if (entity.type === EntityType.DRONE || entity.type === EntityType.MINI_TANK) {
                  const owner = (entity as Drone | MiniTank).owner;
                  if (owner && transit.has(owner.id)) {
                      transit.add(entity.id);
                      mutated = true;
                  }
              }
          }
      }

      return transit;
  }

  private notifyPortalStage(portal: VoidPortal, stage: VoidTransitStage): void {
      let seen = this.portalStageNotified.get(`${portal.id}`);
      if (!seen) {
          seen = new Set<VoidTransitStage>();
          this.portalStageNotified.set(`${portal.id}`, seen);
      }
      if (seen.has(stage)) return;
      seen.add(stage);
      const label = getVoidTransitStageLabel(stage);
      if (!label) return;
      const color = stage === 'LOCK' ? '#b794f4' : stage === 'INVERT' ? '#d7f3ff' : stage === 'BREACH' ? '#ffffff' : COLORS.voidPortal;
      this.addNotification(label.toUpperCase(), color);
  }

  private setPlayerPortalStage(stage: VoidTransitStage | null, progress: number): void {
      this.playerVoidTransitStage = stage;
      this.playerVoidTransitProgress = clampNum(progress, 0, 1);
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
                      const cooldownVal = Math.max(54, baseReloadTimeMs * 0.6);
                      tank.autoTurretCooldown = cooldownVal;

                      const forward = Vector.fromAngle(tank.autoTurretRotation);
                      const tip = Vector.add(tank.pos, Vector.mult(forward, tank.radius * 0.9));
                      
                      const bulletSpeedMult = 1.78;
                      const bulletDamageMult = 0.92;
                      const bulletSizeMult = 0.72;

                      this.entities.push(new Bullet(
                          this.nextId(), 
                          tip.x, 
                          tip.y, 
                          Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * bulletSpeedMult), 
                          tank, 
                          bulletDamageMult, 
                          1.18, 
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

  isRestorationSectorActive(tank: Tank): boolean {
    return tank.secondarySector === 'restoration' || this.isPacifist(tank.classType);
  }

  isBloodSectorActive(tank: Tank): boolean {
    return tank.secondarySector === 'blood' || this.isDraining(tank.classType);
  }

  private getNormalizedPrimaryClassForSectorClass(classType: TankClass): TankClass {
    if (this.isPacifist(classType) || this.isDraining(classType)) return TankClass.BASIC;
    return classType;
  }

  private getSecondarySectorForLegacyClass(classType: TankClass): SecondarySector {
    if (this.isPacifist(classType)) return 'restoration';
    if (this.isDraining(classType)) return 'blood';
    return 'none';
  }

  private maybeOpenSecondarySectorSelection(): void {
    if (this.playerState !== PlayerState.ACTIVE) return;
    if (this.level < 30) return;
    if (this.player.secondarySector !== 'none') return;
    this.playerState = PlayerState.SECTOR_SELECTION;
    this.player.vel = { x: 0, y: 0 };
    this.addNotification('SECONDARY SECTOR UNLOCKED', '#67e8f9');
  }

  upgradeSecondarySector(sector: SecondarySector) {
    if (this.playerState !== PlayerState.SECTOR_SELECTION && this.gameMode !== GameMode.SANDBOX) return;
    this.upgradeSecondarySectorForTank(this.player, sector);
    if (this.playerState === PlayerState.SECTOR_SELECTION) this.playerState = PlayerState.ACTIVE;
    this.sound.playClassUpgrade();
  }

  upgradeSecondarySectorForTank(tank: Tank, sector: SecondarySector) {
    if (!SECONDARY_SECTOR_OPTIONS.includes(sector)) return;
    tank.secondarySector = sector;
    tank.updateStats();
    this.statRevision++;
    if (tank === this.player) {
      const label = sector === 'none' ? 'NO SECONDARY SECTOR' : `${sector.toUpperCase()} SECTOR ONLINE`;
      this.addNotification(label, sector === 'blood' ? '#ef4444' : sector === 'restoration' ? '#4ade80' : '#94a3b8');
    }
  }

  isBossClass(classType: TankClass): boolean {
    return classType === TankClass.COLOSSAL ||
           classType === TankClass.LEVIATHAN ||
           classType === TankClass.WARLORD ||
           classType === TankClass.CELESTIAL ||
           classType === TankClass.OBLITERATOR;
  }

  isRebirthClass(classType: TankClass): boolean {
    return this.isBossClass(classType);
  }

  isRebirthTank(entity: Entity | null | undefined): entity is Tank {
    return !!entity &&
      (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK) &&
      (entity as Tank).isTransformed &&
      this.isRebirthClass((entity as Tank).classType);
  }

  isRebirthProjectileOwner(entity: Entity | null | undefined): boolean {
    if (!entity) return false;
    if (entity.type === EntityType.BULLET) {
      const owner = this.entities.find(e => e.id === (entity as Bullet).ownerId);
      return this.isRebirthTank(owner);
    }
    if (entity.type === EntityType.DRONE || entity.type === EntityType.MINI_TANK) {
      return this.isRebirthTank((entity as Drone | MiniTank).owner);
    }
    return false;
  }

  isValidCombatTarget(entity: Entity | null | undefined): boolean {
    if (!entity || entity.isDead) return false;
    return entity.type === EntityType.SHAPE ||
      entity.type === EntityType.DOMINION_TANK ||
      entity.type === EntityType.BOSS ||
      entity.type === EntityType.PLAYER ||
      entity.type === EntityType.ENEMY ||
      entity.type === EntityType.ELITE_TANK ||
      entity.type === EntityType.GUARDIAN ||
      entity.type === EntityType.CRASHER ||
      entity.type === EntityType.DRONE ||
      entity.type === EntityType.MINI_TANK;
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
    this.elapsedMs += dt * 1000;
    this.aiSystem.beginTick(this.simulationTick);
    const updateStart = performance.now();
    this.updateViewportCache();
    const bucketStart = performance.now();
    const aliveCombatTanks: Tank[] = [];
    const aliveEnemies: Tank[] = [];
    const aliveRestorationTanks: Tank[] = [];
    const aliveBloodTanks: Tank[] = [];
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
          if (this.isRestorationSectorActive(t)) aliveRestorationTanks.push(t);
          if (this.isBloodSectorActive(t) || (t.isTransformed && t.classType === TankClass.COLOSSAL)) aliveBloodTanks.push(t);
        }
      } else if (!e.isDead && (e.type === EntityType.SHAPE || e.type === EntityType.DOMINION_TANK || e.type === EntityType.BOSS || e.type === EntityType.CRASHER || e.type === EntityType.GUARDIAN)) {
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
        const pacifists = aliveRestorationTanks;
        const tanksToHeal = aliveCombatTanks;

        tanksToHeal.forEach(target => {
            const healersInRange = pacifists.filter(p => p.team === target.team && p.id !== target.id && Vector.dist(p.pos, target.pos) < p.healingAuraRadius);
            if (healersInRange.length > 0) {
                if (this.isOnScreen(target.pos)) this.sound.playRestorationAura(this.getAudioSpatialOptions(target.pos, false));
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
        const drainers = aliveBloodTanks;
        const entitiesToDrain = drainTargets;

        drainers.forEach(drainer => {
            const targetsInRange = entitiesToDrain.filter(target => target.id !== drainer.id && target.team !== drainer.team && Vector.dist(drainer.pos, target.pos) < drainer.drainAuraRadius);
             
            let totalDamageDealt = 0;
            let xpEligibleDamage = 0;
            targetsInRange.forEach(target => {
                const lifestealMult = drainer.bloodPactActiveTimer > 0 ? CLASS_ABILITY_CONFIG.blood.lifestealAuraMultiplier : 1;
                const damage = drainer.drainAuraDamage * lifestealMult * dt;
                const actualDamage = Math.min(target.health, damage);
                target.takeDamage(actualDamage, drainer.id);
                totalDamageDealt += actualDamage;
                if (this.isXpEligibleVictim(target)) {
                    xpEligibleDamage += actualDamage;
                }
                if (target instanceof Tank) {
                    target.markDrainingStatus();
                    if (drainer.bloodPactActiveTimer > 0) {
                        target.applyDrainDot(CLASS_ABILITY_CONFIG.blood.pactDrainDotStacks, CLASS_ABILITY_CONFIG.blood.decayStackDuration, drainer.id);
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
                drainer.drainHistory.push({ time: Date.now(), amount: totalDamageDealt });
                drainer.markDrainingStatus();
                if (this.isOnScreen(drainer.pos)) this.sound.playBloodDrainTick(this.getAudioSpatialOptions(drainer.pos, false));
                 
                // XP Reward for draining (Higher reward for blood sector)
                if (!drainer.isBot) {
                    this.awardXP(drainer, xpEligibleDamage * 0.25);
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

    if (runAmbientTick) {
        this.maybeTriggerHealingRequests(aliveCombatTanks, aliveRestorationTanks);
        this.maybeTriggerAmbientBotFlavor(aliveCombatTanks);
    }
    this.updateBotChats();

    if (this.playerState === PlayerState.SECTOR_SELECTION) {
        this.player.vel = { x: 0, y: 0 };
    } else if (this.playerState === PlayerState.EVOLVING) {
        this.evolutionTransitionTimer = Math.max(0, this.evolutionTransitionTimer - dt);
        this.player.vel = { x: 0, y: 0 };
        if (this.evolutionTransitionTimer <= 0) {
            this.playerState = PlayerState.BOSS_SELECTION;
            this.addNotification("SELECT YOUR LEGENDARY CHASSIS", "#fbbf24");
        }
    } else if (this.playerState === PlayerState.BOSS_SELECTION) {
        this.player.vel = { x: 0, y: 0 };
    }

    if (!this.pendingDimensionTransition) {
        this.setPlayerPortalStage(null, 0);
    }
    this.updateDimensionTransition(dt);

    if (this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown) {
        this.player.sacrificeCooldownTimer = 0;
    }

    if (!this.inVoid) {
        this.portalSpawnTimer += dt;
        if (this.portalSpawnTimer > 300 && this.gameMode !== GameMode.SANDBOX && this.gameMode !== GameMode.BOSS_RUSH) {
            const pos = Vector.randomRange(2000, CANVAS_WIDTH - 2000);
            const pos2 = Vector.randomRange(2000, CANVAS_HEIGHT - 2000);
            this.entities.push(new VoidPortal(this.nextId(), pos, pos2));
            this.addNotification("WORMHOLE DETECTED", COLORS.voidPortal);
            this.portalSpawnTimer = 0;
        }

        this.eliteSpawnTimer += dt;
        if (this.eliteSpawnTimer > 145 && this.gameMode !== GameMode.SANDBOX && this.gameMode !== GameMode.BOSS_RUSH) { 
            this.spawnElite();
            this.eliteSpawnTimer = 0;
        }
    } else {
        this.voidTimer -= dt;
        if (this.voidTimer <= 0) {
            const evacIds = this.entities
              .filter(e => !e.isDead && (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY))
              .map(e => e.id);
            this.transitionToDimension(false, evacIds);
        }
    }

    if (this.transformationReadyTimer > 0) {
        this.transformationReadyTimer -= dt;
    }

    this.bossSpawnTimer += dt;
    if (this.bossSpawnTimer > 120 && !this.inVoid && this.gameMode !== GameMode.SANDBOX && this.gameMode !== GameMode.BOSS_RUSH) { this.spawnBoss(); this.bossSpawnTimer = 0; }

    this.crasherSpawnTimer += dt;
    if (this.crasherSpawnTimer > 5 && !this.inVoid && this.gameMode !== GameMode.SANDBOX && this.gameMode !== GameMode.BOSS_RUSH) {
        const nestRadius = 1500;
        const count = 3 + Math.floor(Math.random() * 3);
        const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
        if (aliveCrasherCount < 40) {
            for(let i=0; i<count; i++) {
                const lane = Math.floor(Math.random() * 5);
                const angle = lane * ((Math.PI * 2) / 5) + Vector.randomRange(-0.42, 0.42);
                const dist = 840 + Math.sqrt(Math.random()) * (nestRadius - 840);
                const tangentJitter = Vector.randomRange(-180, 180);
                this.entities.push(new Crasher(
                  this.nextId(),
                  center.x + Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * tangentJitter,
                  center.y + Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * tangentJitter
                ));
            }
        }
        this.crasherSpawnTimer = 0;
    }

    if (currentBoss && !this.sandboxConfig.freezeAll && this.gameMode !== GameMode.BOSS_RUSH) {
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

    if (this.gameMode === GameMode.BOSS_RUSH && !this.sandboxConfig.freezeAll) {
        this.bossRushMode.update(this as any, dt);
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

    const bossRushCameraOverride = this.gameMode === GameMode.BOSS_RUSH
        ? this.bossRushMode.getCameraOverride(this as any)
        : null;

    if (this.attractMode) {
        if (this.manualSpectateMode) {
            this.ensureValidSpectateTarget();
        } else if (!this.spectateTarget || this.spectateTarget.isDead || Math.random() < 0.005) {
            const bots = aliveEnemies;
            this.spectateTarget = bots.length > 0 ? bots[Math.floor(Math.random() * bots.length)] : null;
        }
        let targetPos = this.spectateTarget ? this.spectateTarget.pos : {x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2};
        const attractFollow = 1 - Math.exp(-dt * 3.6);
        this.cameraPos.x += (targetPos.x - this.cameraPos.x) * attractFollow;
        this.cameraPos.y += (targetPos.y - this.cameraPos.y) * attractFollow;
        this.cameraZoom = this.manualSpectateMode ? 0.72 : 0.6;
        this.player.pos = { x: -1000, y: -1000 };
    } else if (bossRushCameraOverride?.active) {
        const cinematicFollow = 1 - Math.exp(-dt * 4.8);
        this.cameraPos.x += (bossRushCameraOverride.targetPos.x - this.cameraPos.x) * cinematicFollow;
        this.cameraPos.y += (bossRushCameraOverride.targetPos.y - this.cameraPos.y) * cinematicFollow;
        this.cameraZoom += (bossRushCameraOverride.zoom - this.cameraZoom) * cinematicFollow;
    } else {
        // Velocity-independent centered follow.
        const follow = 1 - Math.exp(-dt * 10.5);
        this.cameraPos.x += (this.player.pos.x - this.cameraPos.x) * follow;
        this.cameraPos.y += (this.player.pos.y - this.cameraPos.y) * follow;
        this.cameraZoom = this.player.fov;
    }

    if (!this.attractMode && this.player.isDead && !this.gameOverSignaled) { 
        this.gameOverSignaled = true; 
        this.beginPlayerDeathPresentation(this.resolveKillerForVictim(this.player));
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
        this.commonShapeCooldown = Math.max(0, this.commonShapeCooldown - dt);
        this.shapeSpawnTimer += dt;
      const activePlayers = this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && !e.isDead).length;
      const modeBaseInterval =
        this.gameMode === GameMode.DOMINION ? 0.044 :
        this.gameMode === GameMode.TEAMS ? 0.052 :
        0.076;
      const populationScale = Math.max(0.75, Math.min(1.45, 1.2 - activePlayers * 0.01));
      const spawnInterval = modeBaseInterval * populationScale;
      const shapePopulationLimit = this.getShapePopulationLimit();
    if (this.currentShapeCount < shapePopulationLimit && this.shapeSpawnTimer >= spawnInterval) {
        if (this.gameMode !== GameMode.SANDBOX || (this.sandboxConfig?.spawningEnabled)) {
            const fillPercent = this.currentShapeCount / shapePopulationLimit;
            const modeBaseProb =
              this.gameMode === GameMode.DOMINION ? 0.92 :
              this.gameMode === GameMode.TEAMS ? 0.88 :
              0.74;
            const spawnProb = Number.isFinite(shapePopulationLimit)
              ? Math.max(0.12, modeBaseProb * (1 - fillPercent))
              : modeBaseProb;
            const commonLimit = this.getCommonShapeActiveLimit();
            const commonInWorld = Number.isFinite(commonLimit)
              ? this.entities.filter(e => e.type === EntityType.SHAPE && (e as Shape).rarity === ShapeRarity.COMMON).length
              : 0;
            const canSpawnCommon = this.commonShapeCooldown <= 0 && (!Number.isFinite(commonLimit) || commonInWorld < commonLimit);
            if (canSpawnCommon && Math.random() < spawnProb) {
                this.spawnShape();
                this.commonShapeCooldown = this.getCommonShapeSpawnCooldown();
                this.shapeSpawnTimer = 0;
            }
        }
    }
    
    let enemyLimit = this.gameMode === GameMode.TEAMS ? 60 : this.gameMode === GameMode.DOMINION ? 72 : 18;
    if (this.attractMode) enemyLimit += 10;
    if (this.gameMode === GameMode.SANDBOX || this.gameMode === GameMode.BOSS_RUSH) enemyLimit = 0; 

    if (this.gameMode !== GameMode.SANDBOX && this.gameMode !== GameMode.BOSS_RUSH && aliveEnemies.length < enemyLimit) { 
        const spawnProb = this.gameMode === GameMode.TEAMS ? 0.08 : this.gameMode === GameMode.DOMINION ? 0.09 : 0.025; 
        if(Math.random() < spawnProb) this.spawnEnemy(); 
    }

    if (!this.attractMode && !this.player.isDead && this.playerState === PlayerState.ACTIVE) this.updatePlayerControl(dt);

    if ((this.gameMode === GameMode.TEAMS || this.gameMode === GameMode.DOMINION) && !this.sandboxConfig.freezeAll) {
        const safeZones = this.gameMode === GameMode.DOMINION
            ? [
                { team: Team.BLUE, center: { x: BASE_ZONE_WIDTH * 0.5, y: BASE_ZONE_WIDTH * 0.5 }, radius: BASE_ZONE_WIDTH * 0.88 },
                { team: Team.RED, center: { x: this.width - BASE_ZONE_WIDTH * 0.5, y: BASE_ZONE_WIDTH * 0.5 }, radius: BASE_ZONE_WIDTH * 0.88 },
                { team: Team.GREEN, center: { x: BASE_ZONE_WIDTH * 0.5, y: this.height - BASE_ZONE_WIDTH * 0.5 }, radius: BASE_ZONE_WIDTH * 0.88 },
                { team: Team.PURPLE, center: { x: this.width - BASE_ZONE_WIDTH * 0.5, y: this.height - BASE_ZONE_WIDTH * 0.5 }, radius: BASE_ZONE_WIDTH * 0.88 },
            ]
            : [
                { team: Team.BLUE, center: { x: BASE_ZONE_WIDTH * 0.55, y: this.height * 0.5 }, radius: BASE_ZONE_WIDTH * 1.35 },
                { team: Team.RED, center: { x: this.width - BASE_ZONE_WIDTH * 0.55, y: this.height * 0.5 }, radius: BASE_ZONE_WIDTH * 1.35 },
            ];
        const { bots, players } = this.buildTdmAiPerception();
        this.tdmAiSystem.configure({
            worldWidth: this.width,
            worldHeight: this.height,
            mapCenter: { x: this.width * 0.5, y: this.height * 0.5 },
            chokePoint: { x: this.width * 0.5, y: this.height * 0.5 },
            inVoid: this.inVoid,
            voidTimeRemaining: this.voidTimer,
            safeZones,
            dominionZones: this.gameMode === GameMode.DOMINION ? this.getDominionZoneStates() : [],
        });
        this.tdmAiSystem.update(bots as any, players, this.simulationTick);
    }

    if (!this.sandboxConfig.freezeAll) {
        const canUpdateAI = (this.gameMode !== GameMode.SANDBOX || this.sandboxConfig.botsEnabled) && this.gameMode !== GameMode.BOSS_RUSH;
        let aiEntitiesProcessed = 0;

        this.entities.forEach(e => {
            if (canUpdateAI) {
                const isAiEntity = e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK || e.type === EntityType.GUARDIAN || e.type === EntityType.CRASHER || e.type === EntityType.BOSS;
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
                    else if (e.type === EntityType.BOSS && !e.isDead && !this.bossRushMode.ownsBoss(e.id)) this.updateBossAI(e as Boss, dt);
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
        this.updateDominionSystem(dt);
    }

    this.applySafeZoneProtection(dt);

    this.entities.forEach(e => {
        if (this.sandboxConfig.freezeAll && e.type !== EntityType.PLAYER) return;
        e.update(dt);
    });
    for (const e of this.entities) {
        if (!Number.isFinite(e.health) || e.health <= -0.001) {
            e.health = 0;
            e.displayHealth = 0;
            e.isDead = true;
            e.shouldRemove = true;
        }
        if (!Number.isFinite(e.maxHealth) || e.maxHealth <= 0) {
            e.maxHealth = 1;
            if (e.health > 1) e.health = 1;
            if (e.displayHealth > 1) e.displayHealth = 1;
        }
    }

    this.handleCollisions();
    this.resolveNonCollisionDeaths();
    
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
    const aliveIds = new Set(this.entities.map(e => e.id));
    for (const [key] of this.portalCoreOccupancyMs) {
        const parts = key.split(':');
        if (parts.length !== 2) {
            this.portalCoreOccupancyMs.delete(key);
            continue;
        }
        const portalId = Number(parts[0]);
        const entityId = Number(parts[1]);
        if (!aliveIds.has(portalId) || !aliveIds.has(entityId)) this.portalCoreOccupancyMs.delete(key);
    }
    for (const [portalId, ids] of this.portalTransitQueuedIds) {
        if (!aliveIds.has(portalId)) {
            this.portalTransitQueuedIds.delete(portalId);
            continue;
        }
        for (const id of [...ids]) {
            if (!aliveIds.has(id)) ids.delete(id);
        }
        if (ids.size === 0) this.portalTransitQueuedIds.delete(portalId);
    }
    for (const [portalId] of this.portalStageNotified) {
        if (!aliveIds.has(Number(portalId))) this.portalStageNotified.delete(portalId);
    }
    this.currentShapeCount -= removedShapes;
    if ((this.simulationTick % 120) === 0) {
      this.aiSystem.cleanupCaches(this.entities as any);
    }

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
        const isPriority = e.type === EntityType.BOSS || e.type === EntityType.ELITE_TANK || e.type === EntityType.VOID_PORTAL || e.type === EntityType.DUMMY || e.type === EntityType.DOMINION_TANK || (e.type === EntityType.SHAPE && getRarityRank((e as Shape).rarity) >= getRarityRank(ShapeRarity.LEGENDARY));
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
    if (this.gameMode === GameMode.DOMINION) {
        this.dominionZones.forEach((zone) => {
            minimapMarkers.push({
                type: EntityType.DOMINION_TANK,
                pos: { ...zone.pos },
                team: zone.owner === Team.NONE ? Team.NONE : zone.owner,
                zoneRadius: zone.radius,
                markerRole: 'DOMINION_ZONE'
            });
        });
    }

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
    } else if (this.isRestorationSectorActive(this.player)) {
        const noCooldown = this.gameMode === GameMode.SANDBOX && this.sandboxConfig.noAbilityCooldown;
        abilityHud = {
            id: 'vita_conduit',
            name: 'Vita Conduit',
            trigger: 'RMB',
            description: 'Lock an ally under your cursor and chain restorative energy to nearby teammates.',
            benefit: 'Strong first heal with chained, weaker regeneration pulses across close allies.',
            tradeoff: 'Consumes a small portion of your own health each cast.',
            cooldownRemaining: noCooldown ? 0 : Math.max(0, this.player.restorationLinkCooldown),
            cooldownTotal: noCooldown ? 0 : 14,
            active: this.player.regenOverchargeTimer > 0,
            activeRemaining: Math.max(0, this.player.regenOverchargeTimer),
            activeTotal: 3.8,
        };
    } else if (this.isBloodSectorActive(this.player)) {
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
      const nowMs = Date.now();
      const drainWindowMs = 2600;
      if (this.player.drainHistory.length > 0) {
        this.player.drainHistory = this.player.drainHistory.filter(h => (nowMs - h.time) <= drainWindowMs);
      }
      const bloodDrainLive = this.player.drainHistory.reduce((sum, h) => sum + h.amount, 0);
      const bloodDrainStacks = Math.min(12, Math.floor(bloodDrainLive / 55));
        this.onStateUpdate({
          score: this.player.score, 
          level: this.level, 
          xp: this.xp, 
          maxXp: this.getLevelXp(this.level), 
          stats: { ...this.player.stats }, 
          statRevision: this.statRevision,
          availableStatPoints: this.player.availableStatPoints, 
          mainClass: this.getNormalizedPrimaryClassForSectorClass(this.player.classType),
          currentClass: this.player.classType, 
          secondarySector: this.player.secondarySector,
          isDead: this.player.isDead, 
        fps: Math.round(1/dt), 
        killFeed: this.killFeed, 
        botChatBubbles: this.getRenderedBotChats(),
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
        voidTransitStage: getVoidTransitStageLabel(this.playerVoidTransitStage),
        voidTransitProgress: this.playerVoidTransitProgress,
        isTransformed: this.player.isTransformed,
        transformationTime: this.player.transformationTimer,
        transformationReady: this.transformationReadyTimer > 0,
        rebirthEligible: this.rebirthEligible && !this.player.hasRebirthed && this.playerState === PlayerState.ACTIVE,
        activeBuffs: this.player.activeBuffs,
        sandboxConfig: this.sandboxConfig,
        primedSpawn: this.primedSpawn,
        abilityHud,
        playerState: this.playerState,
        evolutionTransitionRemaining: this.playerState === PlayerState.EVOLVING ? this.evolutionTransitionTimer : 0,
        bossChoices: this.playerState === PlayerState.BOSS_SELECTION ? [...this.bossChoices] : [],
        enemyZoneWarningLevel: this.enemyZoneWarningLevel,
        enemyZoneWarningText: this.enemyZoneWarningText,
        bloodDrainLive,
        bloodDrainStacks,
        bloodDrainSession: this.player.totalDrainedThisSession,
        dominionScores: this.gameMode === GameMode.DOMINION ? { ...this.dominionScores } : undefined,
        dominionOwnedCount: this.gameMode === GameMode.DOMINION ? { ...this.dominionOwnedCount } : undefined,
        dominionTimeRemaining: this.gameMode === GameMode.DOMINION ? this.dominionMatchTimer : undefined,
        dominionZones: this.gameMode === GameMode.DOMINION ? this.getDominionZoneStates() : undefined,
        bossRush: this.gameMode === GameMode.BOSS_RUSH ? this.bossRushMode.getHud(this as any) : undefined,
        deathPresentation: this.getDeathPresentationState(),
        deathKiller: this.getDeathKillerSnapshot(),
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
    this.player.droneCommandMode = this.mouseRightDown
      ? 'REPEL'
      : (this.mouseDown || this.player.autoFire)
        ? (this.keys.has('Shift') ? 'SWARM' : 'ATTACK')
        : 'ORBIT';
    
    // RMB class abilities.
    const goatClasses = [TankClass.OVERLORD, TankClass.OVERSEER, TankClass.MANAGER];
    if (this.isPacifist(this.player.classType)) {
        if (this.mouseRightDown) {
            if (!this.player.abilityTriggered) {
                this.player.abilityTriggered = true;
                this.triggerRestorationLinkAbility(this.player);
            }
        } else {
            this.player.abilityTriggered = false;
        }
    } else if (goatClasses.includes(this.player.classType)) {
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

  updateBossAI(boss: Boss, dt: number) {
      const targets = this.entities.filter((e) =>
          (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK) &&
          !e.isDead &&
          Vector.dist(e.pos, boss.pos) < 2200
      ) as Tank[];

      let target: Tank | null = null;
      let bestScore = -Infinity;
      for (const candidate of targets) {
          const dist = Math.max(1, Vector.dist(boss.pos, candidate.pos));
          const hpRatio = candidate.maxHealth > 0 ? candidate.health / candidate.maxHealth : 1;
          const score =
              (1600 / dist) +
              (candidate.type === EntityType.PLAYER ? 90 : 0) +
              (candidate.type === EntityType.ELITE_TANK ? 40 : 0) +
              (1 - hpRatio) * 120;
          if (score > bestScore) {
              bestScore = score;
              target = candidate;
          }
      }

      if (!target) return;

      const toTarget = Vector.sub(target.pos, boss.pos);
      const distance = Math.max(1, Vector.mag(toTarget));
      const dir = Vector.normalize(toTarget);
      const isSingularity = boss.archetype === 'SINGULARITY';
      const singularityCycle = boss.phaseTimer % 10.5;
      const singularityPhase =
        singularityCycle < 3.8 ? 'DRIFT' :
        singularityCycle < 7.3 ? 'LATTICE' :
        'REPOSITION';
      const desiredRange = boss.archetype === 'SIEGEBREAKER' ? 420 : boss.archetype === 'SWARMLORD' ? 560 : singularityPhase === 'REPOSITION' ? 900 : 760;
      const moveForce = isSingularity
        ? singularityPhase === 'DRIFT'
          ? distance > desiredRange + 120 ? 0.12 : distance < 560 ? -0.08 : 0.01
          : singularityPhase === 'LATTICE'
            ? distance > desiredRange + 90 ? 0.10 : distance < 600 ? -0.05 : 0.0
            : distance > desiredRange ? 0.04 : -0.10
        : distance > desiredRange ? 0.48 : -0.22;
      const orbitDir = Vector.normalize({ x: -dir.y, y: dir.x });
      const orbitBias = isSingularity
        ? singularityPhase === 'DRIFT'
          ? 0.14 + Math.sin(boss.phaseTimer * 0.55) * 0.04
          : singularityPhase === 'LATTICE'
            ? 0.20 + Math.sin(boss.phaseTimer * 0.7) * 0.05
            : 0.08
        : 0;
      let bossAccel = Vector.add(boss.acc, Vector.mult(dir, moveForce));
      bossAccel = Vector.add(bossAccel, Vector.mult(orbitDir, orbitBias));
      if (distance < boss.radius + 180) {
          bossAccel = Vector.add(bossAccel, Vector.mult(dir, -0.12));
      }
      boss.acc = Vector.limit(bossAccel, isSingularity ? 0.16 : 0.55);

      // Soft singularity pull so bosses feel "present" and threatening.
      const pullRadius = boss.archetype === 'SINGULARITY' ? 520 : 760;
      if (distance < pullRadius) {
          const pull = boss.archetype === 'SINGULARITY'
            ? 0.004 + (1 - distance / pullRadius) * 0.011
            : 0.018 + (1 - distance / pullRadius) * 0.06;
          target.vel = Vector.add(target.vel, Vector.mult(dir, pull * 60 * dt));
      }

      if (boss.pulseCooldown <= 0 && distance < 760) {
          const pulseRadius = boss.archetype === 'SIEGEBREAKER' ? 520 : boss.archetype === 'SWARMLORD' ? 420 : 410;
          const pulseDamage = boss.archetype === 'SIEGEBREAKER' ? 220 : boss.archetype === 'SWARMLORD' ? 150 : 128;
          if (!isSingularity || singularityPhase !== 'REPOSITION') {
          for (let i = 0; i < this.entities.length; i++) {
              const e = this.entities[i];
              if (e.isDead || (e.type !== EntityType.PLAYER && e.type !== EntityType.ENEMY && e.type !== EntityType.ELITE_TANK)) continue;
              if (Vector.dist(e.pos, boss.pos) > pulseRadius) continue;
              e.takeDamage(pulseDamage, boss.id, false);
              const repel = Vector.normalize(Vector.sub(e.pos, boss.pos));
              e.vel = Vector.add(e.vel, Vector.mult(repel, 4.2));
          }
          this.particles.push(new Particle(boss.pos.x, boss.pos.y, boss.color, boss.radius * 0.55, 12, 'RING'));
          this.sound.playExplosion(true, this.getAudioSpatialOptions(boss.pos, true));
          boss.pulseCooldown = boss.archetype === 'SIEGEBREAKER' ? 4.2 : boss.archetype === 'SWARMLORD' ? 5.0 : 6.2;
          }
      }

      if (boss.summonCooldown <= 0) {
          const spawnCount = boss.archetype === 'SWARMLORD' ? 4 : boss.archetype === 'SINGULARITY' ? 1 : 2;
          for (let i = 0; i < spawnCount; i++) {
              const a = (Math.PI * 2 * i) / spawnCount + Math.random() * 0.4;
              const r = boss.radius + 80 + Math.random() * 45;
              this.entities.push(new Crasher(this.nextId(), boss.pos.x + Math.cos(a) * r, boss.pos.y + Math.sin(a) * r, boss.archetype === 'SINGULARITY' ? false : Math.random() < 0.22));
          }
          boss.summonCooldown = boss.archetype === 'SWARMLORD' ? 6.8 : boss.archetype === 'SINGULARITY' ? 12.6 : 9.5;
      }

      if (boss.volleyCooldown <= 0 && distance < 1200) {
          const volleyCount = boss.archetype === 'SIEGEBREAKER' ? 6 : boss.archetype === 'SINGULARITY' ? 2 : 4;
          for (let i = 0; i < volleyCount; i++) {
              const angle = Math.atan2(dir.y, dir.x) + (i - (volleyCount - 1) / 2) * (boss.archetype === 'SIEGEBREAKER' ? 0.14 : 0.22);
              const spawnPos = {
                  x: boss.pos.x + Math.cos(angle) * (boss.radius * 0.9),
                  y: boss.pos.y + Math.sin(angle) * (boss.radius * 0.9),
              };
              const impactPos = {
                  x: spawnPos.x + Math.cos(angle) * (boss.archetype === 'SIEGEBREAKER' ? 560 : 470),
                  y: spawnPos.y + Math.sin(angle) * (boss.archetype === 'SIEGEBREAKER' ? 560 : 470),
              };
              this.particles.push(new Particle(impactPos.x, impactPos.y, boss.color, 8, 16, 'FLASH'));
              this.particles.push(new Particle(impactPos.x, impactPos.y, boss.color, 12, 14, 'RING'));

              const splash = boss.archetype === 'SIEGEBREAKER' ? 120 : boss.archetype === 'SINGULARITY' ? 72 : 92;
              const splashRadius = boss.archetype === 'SIEGEBREAKER' ? 120 : boss.archetype === 'SINGULARITY' ? 82 : 95;
              for (let j = 0; j < this.entities.length; j++) {
                  const maybe = this.entities[j];
                  if (maybe.isDead || (maybe.type !== EntityType.PLAYER && maybe.type !== EntityType.ENEMY && maybe.type !== EntityType.ELITE_TANK)) continue;
                  if (Vector.dist(maybe.pos, impactPos) > splashRadius) continue;
                  maybe.takeDamage(splash, boss.id, false);
              }
          }
          this.sound.playShoot(TankClass.DESTROYER, this.getAudioSpatialOptions(boss.pos, true));
          boss.volleyCooldown = boss.archetype === 'SIEGEBREAKER' ? 3.1 : boss.archetype === 'SINGULARITY' ? 6.4 : 3.9;
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

  private getElitePreferredRange(elite: EliteTank): { min: number; max: number; strafe: number } {
      switch (elite.eliteBrain) {
          case 'SIEGE': return { min: 360, max: 620, strafe: 1.2 };
          case 'HUNTER': return { min: 520, max: 860, strafe: 1.7 };
          case 'SUMMONER': return { min: 420, max: 700, strafe: 1.35 };
          case 'BARRAGE': return { min: 260, max: 520, strafe: 1.55 };
          default: return { min: 220, max: 460, strafe: 1.9 };
      }
  }

  private pickEliteTarget(elite: EliteTank, targets: Tank[]): Tank | null {
      let best: Tank | null = null;
      let bestScore = -Infinity;
      for (const target of targets) {
          const distance = Math.max(1, Vector.dist(elite.pos, target.pos));
          const hpRatio = target.maxHealth > 0 ? target.health / target.maxHealth : 1;
          const playerBias = target.type === EntityType.PLAYER ? 0.34 : 0;
          const supportBias = target.classType === TankClass.OVERLORD || target.classType === TankClass.MANAGER || target.classType === TankClass.DOCTOR ? 0.26 : 0;
          const lowHpBias = (1 - hpRatio) * 0.75;
          const score = (1300 / distance) + playerBias + supportBias + lowHpBias;
          if (score > bestScore) {
              bestScore = score;
              best = target;
          }
      }
      return best;
  }

  private getEliteBoundaryForce(entity: Entity, strength = 2.3): Vector2 {
      const padding = 360;
      const steer = { x: 0, y: 0 };
      if (entity.pos.x < padding) steer.x += (padding - entity.pos.x) / padding;
      else if (entity.pos.x > CANVAS_WIDTH - padding) steer.x -= (entity.pos.x - (CANVAS_WIDTH - padding)) / padding;
      if (entity.pos.y < padding) steer.y += (padding - entity.pos.y) / padding;
      else if (entity.pos.y > CANVAS_HEIGHT - padding) steer.y -= (entity.pos.y - (CANVAS_HEIGHT - padding)) / padding;
      return Vector.mult(steer, strength);
  }

  private getEliteBulletAvoidance(elite: EliteTank): Vector2 {
      const steering = { x: 0, y: 0 };
      const incomingBullets = this.entities.filter(e => e.type === EntityType.BULLET && (e as Bullet).ownerId !== elite.id && Vector.dist(e.pos, elite.pos) < 520);
      incomingBullets.forEach(b => {
          const toBot = Vector.sub(elite.pos, b.pos);
          const bulletVelNorm = Vector.normalize(b.vel);
          const toBotNorm = Vector.normalize(toBot);
          if (Vector.dot(bulletVelNorm, toBotNorm) > 0.68) {
              const sideForce = { x: -b.vel.y, y: b.vel.x };
              const dotProduct = Vector.dot(sideForce, toBot);
              const avoidDir = Vector.mult(Vector.normalize(sideForce), dotProduct > 0 ? 4.8 : -4.8);
              steering.x += avoidDir.x;
              steering.y += avoidDir.y;
          }
      });
      return steering;
  }

  private getEliteSeparation(elite: EliteTank): Vector2 {
      const steering = { x: 0, y: 0 };
      const neighbors = this.entities.filter((e) =>
          !e.isDead &&
          e.id !== elite.id &&
          (e.type === EntityType.ELITE_TANK || e.type === EntityType.BOSS || e.type === EntityType.ENEMY || e.type === EntityType.PLAYER) &&
          Vector.dist(e.pos, elite.pos) < 240
      );
      for (const neighbor of neighbors) {
          const offset = Vector.sub(elite.pos, neighbor.pos);
          const dist = Math.max(1, Vector.mag(offset));
          const push = Vector.mult(Vector.normalize(offset), 190 / dist);
          steering.x += push.x;
          steering.y += push.y;
      }
      return steering;
  }

  private updateEliteAnchor(elite: EliteTank, target: Tank, distance: number, dirToTarget: Vector2): void {
      elite.tacticalTimer -= 1 / 60;
      if (elite.tacticalTimer > 0 && distance < elite.visionRange * 0.9) return;
      elite.tacticalTimer = 1.4 + Math.random() * 1.3;
      const side = Vector.normalize({ x: -dirToTarget.y, y: dirToTarget.x });
      const style = this.getElitePreferredRange(elite);
      const anchorDist = Math.max(style.min + 40, Math.min(style.max, distance));
      const offset = Vector.add(
          Vector.mult(Vector.normalize(dirToTarget), Math.max(60, anchorDist - 90)),
          Vector.mult(side, elite.strafeSign * (120 + Math.random() * 140))
      );
      elite.combatAnchor = {
          x: Math.max(180, Math.min(CANVAS_WIDTH - 180, target.pos.x - offset.x)),
          y: Math.max(180, Math.min(CANVAS_HEIGHT - 180, target.pos.y - offset.y)),
      };
      elite.strafeSign *= Math.random() < 0.35 ? -1 : 1;
  }

  updateEliteAI(elite: EliteTank, dt: number) {
      const targets = this.entities.filter(
          (e) => !e.isDead && (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && Vector.dist(e.pos, elite.pos) < elite.visionRange
      ) as Tank[];
      const target = this.pickEliteTarget(elite, targets);
      const steering = { x: 0, y: 0 };

      const separation = this.getEliteSeparation(elite);
      steering.x += separation.x;
      steering.y += separation.y;

      const boundary = this.getEliteBoundaryForce(elite, 2.8);
      steering.x += boundary.x;
      steering.y += boundary.y;

      const bulletAvoidance = this.getEliteBulletAvoidance(elite);
      steering.x += bulletAvoidance.x;
      steering.y += bulletAvoidance.y;

      if (target) {
          elite.aiTargetId = target.id;
          const dirToTarget = Vector.sub(target.pos, elite.pos);
          const distToTarget = Math.max(1, Vector.mag(dirToTarget));
          const style = this.getElitePreferredRange(elite);

          this.updateEliteAnchor(elite, target, distToTarget, dirToTarget);

          const bulletSpeed = (BASE_STATS.bulletSpeed + elite.stats[StatType.BULLET_SPEED] * 0.8) * 1.5;
          const interceptPoint = this.getInterceptPoint(elite.pos, bulletSpeed, target.pos, target.vel);
          elite.rotation = Math.atan2(interceptPoint.y - elite.pos.y, interceptPoint.x - elite.pos.x);

          const anchorDir = Vector.sub(elite.combatAnchor, elite.pos);
          const anchorDist = Vector.mag(anchorDir);
          if (anchorDist > 18) {
              const pull = Vector.mult(Vector.normalize(anchorDir), Math.min(2.1, 0.65 + anchorDist / 180));
              steering.x += pull.x;
              steering.y += pull.y;
          }

          const targetNorm = Vector.normalize(dirToTarget);
          if (distToTarget < style.min) {
              const retreat = Vector.mult(targetNorm, -1.6 * elite.aggressionBias);
              steering.x += retreat.x;
              steering.y += retreat.y;
          } else if (distToTarget > style.max) {
              const advance = Vector.mult(targetNorm, 1.75 * elite.aggressionBias);
              steering.x += advance.x;
              steering.y += advance.y;
          }

          const orbitDir = Vector.normalize({ x: -targetNorm.y, y: targetNorm.x });
          const orbitStrength = style.strafe * (0.7 + Math.sin(elite.orbitPhase + Date.now() / 550) * 0.3);
          steering.x += orbitDir.x * orbitStrength * elite.strafeSign;
          steering.y += orbitDir.y * orbitStrength * elite.strafeSign;

          if (elite.eliteBrain === 'SIEGE' && distToTarget < 300) {
              steering.x -= targetNorm.x * 1.4;
              steering.y -= targetNorm.y * 1.4;
          } else if (elite.eliteBrain === 'SKIRMISHER' && distToTarget < 240) {
              steering.x += orbitDir.x * 1.25;
              steering.y += orbitDir.y * 1.25;
          } else if (elite.eliteBrain === 'BARRAGE' && distToTarget > 340) {
              steering.x += targetNorm.x * 1.1;
              steering.y += targetNorm.y * 1.1;
          } else if (elite.eliteBrain === 'SUMMONER' && distToTarget < 360) {
              steering.x -= targetNorm.x * 0.9;
              steering.y -= targetNorm.y * 0.9;
          }

          this.attemptShoot(elite);
      } else {
          elite.aiTargetId = null;
          elite.repathTimer -= dt;
          if (elite.repathTimer <= 0 || Vector.dist(elite.pos, elite.patrolPos) < 120) {
              elite.repathTimer = 2.8 + Math.random() * 2.4;
              elite.patrolPos = {
                  x: Math.max(220, Math.min(CANVAS_WIDTH - 220, elite.combatAnchor.x + Math.cos(elite.orbitPhase + Date.now() / 900) * elite.patrolRadius)),
                  y: Math.max(220, Math.min(CANVAS_HEIGHT - 220, elite.combatAnchor.y + Math.sin(elite.orbitPhase + Date.now() / 900) * elite.patrolRadius)),
              };
          }
          const patrolDir = Vector.sub(elite.patrolPos, elite.pos);
          const patrolDist = Vector.mag(patrolDir);
          if (patrolDist > 12) {
              const patrolForce = Vector.mult(Vector.normalize(patrolDir), Math.min(1.55, 0.45 + patrolDist / 220));
              steering.x += patrolForce.x;
              steering.y += patrolForce.y;
          }
          elite.rotation += dt * 0.42;
      }

      elite.orbitPhase += dt * 0.9;
      this.applyTankMovement(elite, Vector.limit(steering, 1));
  }

  getInterceptPoint(shooterPos: Vector2, bulletSpeed: number, targetPos: Vector2, targetVel: Vector2): Vector2 {
      const relPos = Vector.sub(targetPos, shooterPos);
      const dist = Vector.mag(relPos);
      const timeToHit = dist / bulletSpeed;
      const predictionFactor = Math.min(1.2, 0.5 + dist / 1000); 
      return Vector.add(targetPos, Vector.mult(targetVel, timeToHit * predictionFactor)); 
  }

  private buildTdmAiPerception(): { bots: Tank[]; players: TDMPlayer[] } {
      const bots: Tank[] = [];
      const players: TDMPlayer[] = [];

      for (let i = 0; i < this.entities.length; i++) {
          const e = this.entities[i];
          if (!e || e.isDead) continue;

          if (e.type === EntityType.ENEMY) {
              bots.push(e as Tank);
          }

          if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK) {
              const t = e as Tank;
              players.push({
                  id: t.id,
                  pos: t.pos,
                  vel: t.vel,
                  team: t.team,
                  isDead: t.isDead,
                  health: t.health,
                  maxHealth: t.maxHealth,
                  level: t.level,
                  score: t.score,
                  classType: t.classType,
                  aiState: t.aiState,
                  aiTargetId: t.aiTargetId,
                  type: t.type === EntityType.PLAYER ? 'PLAYER' : 'ENEMY',
              });
              continue;
          }

          if (e.type === EntityType.BULLET) {
              const b = e as Bullet;
              players.push({
                  id: b.id,
                  pos: b.pos,
                  vel: b.vel,
                  team: b.team,
                  isDead: b.isDead,
                  ownerId: b.ownerId,
                  type: 'BULLET',
              });
              continue;
          }

          if (e.type === EntityType.SHAPE || e.type === EntityType.BOSS || e.type === EntityType.CRASHER) {
              const s = e as any;
              players.push({
                  id: s.id,
                  pos: s.pos,
                  vel: s.vel || { x: 0, y: 0 },
                  team: Team.NONE,
                  isDead: s.isDead,
                  health: s.health,
                  maxHealth: s.maxHealth,
                  xpValue: typeof s.xpValue === 'number' ? s.xpValue : undefined,
                  shapeType: typeof s.shapeType === 'string' ? s.shapeType : undefined,
                  rarity: typeof s.rarity === 'string' ? s.rarity : undefined,
                  radius: typeof s.radius === 'number' ? s.radius : undefined,
                  type: e.type === EntityType.BOSS ? 'BOSS' : e.type === EntityType.CRASHER ? 'CRASHER' : 'SHAPE',
              });
              continue;
          }

          if (e.type === EntityType.VOID_PORTAL) {
              const portal = e as VoidPortal;
              players.push({
                  id: portal.id,
                  pos: portal.pos,
                  vel: portal.vel || { x: 0, y: 0 },
                  team: Team.NONE,
                  isDead: portal.isDead,
                  radius: portal.radius,
                  isExit: portal.isExit,
                  phase: portal.phase,
                  type: 'VOID_PORTAL',
              });
          }
      }

      return { bots, players };
  }

  updateBotAI(bot: Tank, dt: number) {
      if (this.gameMode === GameMode.TEAMS || this.gameMode === GameMode.DOMINION) {
          // In TDM, TDMAISystem is the single source of truth for bot intent.
          this.applyTankMovement(bot, bot.lastSteering || { x: 0, y: 0 });

          const target = (bot.aiTargetId != null)
              ? this.entities.find((e) => e.id === bot.aiTargetId && !e.isDead)
              : null;

          // Keep TDMAISystem aim authority to avoid close-range turret buzzing.
          // Only synthesize a fallback target angle when no valid AI aim exists.
          if (target) {
              if (!Number.isFinite(bot.aiTargetRot)) {
                  const to = Vector.sub(target.pos, bot.pos);
                  if (Vector.magSq(to) > 0.0001) {
                      bot.aiTargetRot = Math.atan2(to.y, to.x);
                  }
              }
          } else if (Vector.magSq(bot.vel) > 0.001) {
              bot.aiTargetRot = Math.atan2(bot.vel.y, bot.vel.x);
          }

          let diff = bot.aiTargetRot - bot.rotation;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          // Turn-rate-limited smoothing is much more stable than direct proportional snap.
          const turnRate = 0.19 * dt * 60;
          const deadzone = 0.0065;
          if (Math.abs(diff) > deadzone) {
              const step = Math.min(Math.abs(diff), turnRate);
              bot.rotation += Math.sign(diff) * step;
          }

          while (bot.rotation > Math.PI) bot.rotation -= Math.PI * 2;
          while (bot.rotation < -Math.PI) bot.rotation += Math.PI * 2;

          if (bot.aiShooting) this.attemptShoot(bot);
          return;
      }

      const forceModern = (window as any).__vextorModernAI === true;
      if (!forceModern) {
          try {
              // The older tactical controller still has the strongest solo combat feel,
              // so we keep it as the primary live brain for non-team bot fights.
              EnemyAITanks.update(bot, this, dt, BOT_STAT_PRIORITIES);
              return;
          } catch (err) {
              console.warn('Legacy tactical AI failed, switching to AISystem for this bot:', err);
          }
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
              if (this.shouldGrantStatPointAtLevel(this.level)) {
                  this.player.availableStatPoints++;
                  this.addNotification("+1 ATTRIBUTE POINT", "#33ccff");
                  this.particles.push(new Particle(this.player.pos.x, this.player.pos.y, 'rgba(51,204,255,0.55)', this.player.radius * 1.05, 18, 'RING'));
                  this.sound.playStatUpgrade();
              }
              this.player.updateStats(); 
              this.sound.playLevelUp();
              this.maybeOpenSecondarySectorSelection();

              if (this.level >= REBIRTH_LEVEL && !this.player.hasRebirthed) {
                  this.rebirthEligible = true;
                  if (!this.rebirthPromptSeen) {
                      this.rebirthPromptSeen = true;
                      this.addNotification("REBIRTH AVAILABLE - PRESS [B] TO EVOLVE", "#ffbb00");
                  }
              }
          }
      } else {
          let nextLevelXp = this.getLevelXp(tank.level);
          while (tank.level < MAX_LEVEL && tank.score >= nextLevelXp) {
              tank.level++;
              if (this.shouldGrantStatPointAtLevel(tank.level)) tank.availableStatPoints++;
              tank.updateStats();
              if (tank.secondarySector === 'none' && tank.level >= 30) {
                  this.upgradeSecondarySectorForTank(tank, Math.random() < 0.5 ? 'restoration' : 'blood');
              }
              nextLevelXp = this.getLevelXp(tank.level);
              const choices = CLASS_TREE[tank.classType] ?? [];
              const eligibleChoices = choices.filter(choice => tank.level >= this.getClassUpgradeLevelRequirement(choice));
              if (eligibleChoices.length > 0) {
                  this.upgradeClassForTank(tank, eligibleChoices[Math.floor(Math.random() * eligibleChoices.length)]);
              }
          }

          if (tank.isBot && tank.level >= REBIRTH_LEVEL && !tank.hasRebirthed) {
              const rebirthPool: TankClass[] = [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD, TankClass.CELESTIAL, TankClass.OBLITERATOR];
              const picked = rebirthPool[Math.floor(Math.random() * rebirthPool.length)];
              tank.hasRebirthed = true;
              this.upgradeClassForTank(tank, picked);
              (Object.values(StatType) as StatType[]).forEach((s) => {
                  tank.stats[s] = 8;
                  tank.universalUpgrades[s] = 8;
              });
              tank.availableStatPoints = 0;
              tank.isTransformed = true;
              tank.updateStats();
              tank.health = tank.maxHealth;
              tank.shield = tank.maxShield;
              tank.invulnerableTime = Math.max(tank.invulnerableTime, 1200);

              tank.team = Team.NONE;
          }
      }
  }

  private isXpEligibleVictim(entity: Entity): boolean {
      return entity.type === EntityType.SHAPE ||
             entity.type === EntityType.BOSS ||
             entity.type === EntityType.PLAYER ||
             entity.type === EntityType.ENEMY ||
             entity.type === EntityType.ELITE_TANK ||
             entity.type === EntityType.DRONE ||
             entity.type === EntityType.MINI_TANK;
  }

  private getTankKillXpReward(victim: Tank, killerTank: Tank | null): number {
      const victimLevel = Math.max(1, Math.floor(victim.level || 1));
      const killerLevel = Math.max(1, Math.floor(killerTank?.level || victimLevel));
      const victimScore = Math.max(0, victim.score || 0);
      const levelDelta = victimLevel - killerLevel;
      const challengeMult = levelDelta >= 0
        ? 1 + Math.min(0.85, levelDelta * 0.035)
        : Math.max(0.7, 1 + levelDelta * 0.03);
      const scoreComponent = Math.min(2200, Math.sqrt(victimScore) * 9.0);

      let reward = (180 + victimLevel * 32 + scoreComponent) * challengeMult;
      const isRebirthVictim = this.isBossClass(victim.classType) || (victim.isTransformed && this.isRebirthClass(victim.classType));
      if (isRebirthVictim) reward *= 2.85;

      return Math.max(isRebirthVictim ? 2800 : 420, Math.floor(reward));
  }

  private awardDamageXpForVictim(attacker: Tank, victim: Entity, rawDamage: number, coefficient: number) {
      if (rawDamage <= 0) return;
      if (!this.isXpEligibleVictim(victim)) return;
      this.awardXP(attacker, rawDamage * coefficient);
  }

  startRebirth() {
      if (this.playerState !== PlayerState.ACTIVE || this.player.hasRebirthed) return;
      if (!this.rebirthEligible && this.level < REBIRTH_LEVEL) return;
      this.isRebirthing = false;
      this.rebirthSelectionPos = null;
      this.rebirthOptions = [];
      this.playerState = PlayerState.EVOLVING;
      this.evolutionTransitionTimer = 1.25;
      this.player.vel = { x: 0, y: 0 };
      this.player.invulnerableTime = Math.max(this.player.invulnerableTime, 1500);
      this.bossChoices = [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD, TankClass.CELESTIAL, TankClass.OBLITERATOR];
      this.addNotification("EVOLUTION PROTOCOL INITIALIZED", "#ffbb00");
      this.sound.playLevelUp();
  }

  triggerRebirthSelection() {
      if (!this.rebirthEligible || this.player.hasRebirthed || this.playerState !== PlayerState.ACTIVE) return;
      this.startRebirth();
  }

  completeRebirth(bossClass: TankClass) {
      if (this.playerState !== PlayerState.BOSS_SELECTION) return;
      if (!this.bossChoices.includes(bossClass)) return;
      this.isRebirthing = false;
      this.player.hasRebirthed = true;
      this.rebirthEligible = false;
      this.playerState = PlayerState.ACTIVE;
      this.evolutionTransitionTimer = 0;
      this.upgradeClassForTank(this.player, bossClass);
      (Object.values(StatType) as StatType[]).forEach((s) => {
          this.player.stats[s] = 8;
          this.player.universalUpgrades[s] = 8;
      });
      this.player.availableStatPoints = 0;
      this.player.isTransformed = true;
      this.player.updateStats();
      
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

  private getSequentialBarrelPattern(classType: TankClass, barrelCount: number): number[] | null {
    if (classType === TankClass.TWIN && barrelCount >= 2) return [0, 1];
    if (classType === TankClass.TWIN_FLANK && barrelCount >= 4) return [0, 2, 1, 3];
    if (classType === TankClass.TRIPLE_SHOT && barrelCount >= 3) return [0, 1, 2];
    if (classType === TankClass.TRIPLE_TANK && barrelCount >= 3) return [0, 2, 1];
    if (classType === TankClass.TRIPLE_TWIN && barrelCount >= 6) return [0, 2, 4, 1, 3, 5];
    if (classType === TankClass.SPRAYER && barrelCount >= 2) return [0, 1];
    if (classType === TankClass.SPREAD_SHOT && barrelCount >= 11) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    return null;
  }

  private getSequentialCadenceMultiplier(classType: TankClass): number {
    if (classType === TankClass.TWIN) return 0.62;
    if (classType === TankClass.TWIN_FLANK) return 0.66;
    if (classType === TankClass.TRIPLE_SHOT) return 0.56;
    if (classType === TankClass.TRIPLE_TANK) return 0.52;
    if (classType === TankClass.TRIPLE_TWIN) return 0.7;
    if (classType === TankClass.SPRAYER) return 0.56;
    if (classType === TankClass.SPREAD_SHOT) return 0.54;
    return 1.0;
  }

  private getClassMinCooldown(classType: TankClass): number {
    if (classType === TankClass.TWIN) return 22;
    if (classType === TankClass.TWIN_FLANK) return 24;
    if (classType === TankClass.TRIPLE_SHOT) return 18;
    if (classType === TankClass.TRIPLE_TANK) return 16;
    if (classType === TankClass.TRIPLE_TWIN) return 26;
    if (classType === TankClass.SPRAYER) return 18;
    if (classType === TankClass.SPREAD_SHOT) return 28;
    if (classType === TankClass.GUNNER) return 20;
    if (classType === TankClass.AUTO_GUNNER) return 17;
    if (classType === TankClass.STREAMLINER) return 14;
    return 40;
  }

  private getDominionProjectileTuning(tank: DominionTank): { speed: number; damage: number; life: number; size: number; cooldown: number } {
    switch (tank.weaponProfile) {
      case 'DESTROYER':
        return { speed: 0.74, damage: 0.7, life: 0.86, size: 0.92, cooldown: 1.42 };
      case 'GUNNER':
        return { speed: 0.88, damage: 0.76, life: 0.92, size: 0.88, cooldown: 1.08 };
      case 'TRAPPER':
        return { speed: 0.28, damage: 0.52, life: 3.8, size: 1.38, cooldown: 2.45 };
      case 'TRIPLE':
      default:
        return { speed: 0.86, damage: 0.82, life: 0.95, size: 0.92, cooldown: 1.15 };
    }
  }

  private getTrapperProfile(classType: TankClass): {
    speed: number;
    damage: number;
    life: number;
    size: number;
    cooldown: number;
    maxLifeTime: number;
    friction: number;
    anchorSpeed: number;
    armDelayMs: number;
    damageMultiplier: number;
    healthMultiplier: number;
    massMultiplier: number;
    spinRate: number;
    activeTrapCap: number;
    firePattern: 'single' | 'dual' | 'triple' | 'radial';
    spreadMultiplier: number;
    travelDistance: number;
  } {
    switch (classType) {
      case TankClass.DUAL_TRAPPER:
        return {
          speed: 0.74,
          damage: 1.16,
          life: 2.72,
          size: 1.12,
          cooldown: 1.86,
          maxLifeTime: 8600,
          friction: 0.89,
          anchorSpeed: 0.33,
          armDelayMs: 155,
          damageMultiplier: 1.08,
          healthMultiplier: 2.95,
          massMultiplier: 2.22,
          spinRate: 2.35,
          activeTrapCap: 12,
          firePattern: 'dual',
          spreadMultiplier: 0.64,
          travelDistance: 276,
        };
      case TankClass.MACHINE_GUN_TRAPPER:
        return {
          speed: 0.68,
          damage: 0.94,
          life: 2.16,
          size: 1.0,
          cooldown: 0.78,
          maxLifeTime: 6900,
          friction: 0.86,
          anchorSpeed: 0.4,
          armDelayMs: 95,
          damageMultiplier: 0.92,
          healthMultiplier: 1.8,
          massMultiplier: 1.68,
          spinRate: 3.1,
          activeTrapCap: 14,
          firePattern: 'single',
          spreadMultiplier: 1.18,
          travelDistance: 244,
        };
      case TankClass.OCTO_TRAPPER:
        return {
          speed: 0.62,
          damage: 1.04,
          life: 2.34,
          size: 1.02,
          cooldown: 2.02,
          maxLifeTime: 7900,
          friction: 0.87,
          anchorSpeed: 0.38,
          armDelayMs: 105,
          damageMultiplier: 0.96,
          healthMultiplier: 2.08,
          massMultiplier: 1.9,
          spinRate: 2.7,
          activeTrapCap: 18,
          firePattern: 'radial',
          spreadMultiplier: 0.22,
          travelDistance: 248,
        };
      case TankClass.TRIPLE_TRAPPER:
        return {
          speed: 0.72,
          damage: 1.14,
          life: 2.48,
          size: 1.08,
          cooldown: 1.72,
          maxLifeTime: 8100,
          friction: 0.88,
          anchorSpeed: 0.36,
          armDelayMs: 145,
          damageMultiplier: 1.02,
          healthMultiplier: 2.24,
          massMultiplier: 2.0,
          spinRate: 2.55,
          activeTrapCap: 15,
          firePattern: 'triple',
          spreadMultiplier: 0.68,
          travelDistance: 286,
        };
      case TankClass.TRAPPER:
      default:
        return {
          speed: 0.74,
          damage: 1.34,
          life: 2.9,
          size: 1.24,
          cooldown: 1.68,
          maxLifeTime: 8600,
          friction: 0.89,
          anchorSpeed: 0.34,
          armDelayMs: 150,
          damageMultiplier: 1.14,
          healthMultiplier: 3.1,
          massMultiplier: 2.28,
          spinRate: 2.45,
          activeTrapCap: 10,
          firePattern: 'single',
          spreadMultiplier: 0.8,
          travelDistance: 302,
        };
    }
  }

  private getTrapTravelDistance(owner: Tank, baseDistance: number): number {
    const trapRangeStat = Math.max(0, owner.stats[StatType.BULLET_SPEED] || 0);
    return Math.max(120, baseDistance + trapRangeStat * 42);
  }

  private getActiveTrapsForTank(ownerId: number): Bullet[] {
    return this.entities.filter((entity): entity is Bullet =>
      entity instanceof Bullet &&
      !entity.isDead &&
      entity.ownerId === ownerId &&
      entity.bulletType === 'TRAP'
    );
  }

  private enforceTrapCap(ownerId: number, cap: number, reserve: number): void {
    const active = this.getActiveTrapsForTank(ownerId);
    const overflow = active.length + reserve - cap;
    if (overflow <= 0) return;
    active
      .sort((a, b) => b.lifeTime - a.lifeTime)
      .slice(0, overflow)
      .forEach((trap) => {
        trap.isDead = true;
      });
  }

  private clearTankAbilityAndProgressState(tank: Tank) {
      tank.activeBuffs = [];
      tank.burstQueue = [];
      tank.droneCommandMode = 'ORBIT';
      tank.isSiegeMode = false;
      tank.autoTurrets = [];
      tank.repairDrones = [];
      tank.autoTurretCooldown = 0;
      tank.autoTurretTargetId = null;
      tank.rebirthDroneLaunchCooldownMs = 0;
      tank.colossalDroneLaunchCooldownMs = 0;
      tank.healingAuraRadius = 0;
      tank.healingAuraEfficiency = 0;
      tank.healingBurstCooldown = 0;
      tank.restorationLinkCooldown = 0;
      tank.totalHealedThisSession = 0;
      tank.healingHistory = [];
      tank.drainAuraRadius = 0;
      tank.drainAuraDamage = 0;
      tank.drainLifestealEfficiency = 0;
      tank.drainBurstCooldown = 0;
      tank.totalDrainedThisSession = 0;
      tank.drainHistory = [];
      tank.bloodPactActiveTimer = 0;
      tank.regenOverchargeTimer = 0;
      tank.regenOverchargeRate = 0;
      tank.drainDotStacks = 0;
      tank.drainDotTimer = 0;
      tank.drainDotTickTimer = 0;
      tank.drainDotSourceOwnerId = null;
      tank.statusHealingUntil = 0;
      tank.statusDrainingUntil = 0;
      tank.statusAbilityUntil = 0;
      tank.xpMultiplier = 1.0;
      tank.xpMultiplierTimer = 0;
      tank.restorationXpBuffer = 0;
      tank.drainXpBuffer = 0;
      tank.abilityTriggered = false;
      tank.socialAnchorId = null;
      tank.socialGestureUntil = 0;
      tank.socialWiggleUntil = 0;
      tank.savedByPlayerUntil = 0;
      tank.socialSpinSignalUntil = 0;
  }

  private resetTankClassAndProgression(tank: Tank, targetClass: TankClass) {
      this.playerState = PlayerState.ACTIVE;
      this.isRebirthing = false;
      this.evolutionTransitionTimer = 0;
      this.rebirthSelectionPos = null;
      this.rebirthOptions = [];
      this.transformationReadyClass = null;

      tank.stats = createEmptyStatRecord();
      tank.universalUpgrades = createEmptyStatRecord();
      tank.inactiveUpgradeBank = {};
      tank.lastUpgradeRemapSummary = [];
      this.clearTankAbilityAndProgressState(tank);
      this.upgradeClassForTank(tank, targetClass);
      tank.updateStats();
  }

  private fireTrapperVolley(tank: Tank, baseReloadTimeMs: number): boolean {
    const profile = this.getTrapperProfile(tank.classType);
    const barrelIndices =
      profile.firePattern === 'dual' ? [0, 1] :
      profile.firePattern === 'triple' ? [0, 1, 2] :
      profile.firePattern === 'radial' ? tank.barrels.map((_, index) => index) :
      [tank.nextBarrelIndex % Math.max(1, tank.barrels.length)];

    if (!this.sandboxConfig.infiniteAmmo && barrelIndices.some((index) => (tank.barrelCooldowns[index] ?? 0) > 0)) {
      return false;
    }

    this.enforceTrapCap(tank.id, profile.activeTrapCap, barrelIndices.length);

    const stability = tank.stats[StatType.BULLET_SPREAD] || 0;
    const stabilityFactor = Math.max(0.28, Math.pow(0.86, stability));
    const muzzleFlashColor = tank.team === Team.NONE ? 'rgba(250, 204, 21, 0.45)' : `${getTeamProjectileColor(tank.team)}88`;
    let fired = false;

    barrelIndices.forEach((barrelIndex) => {
      const barrel = tank.barrels[barrelIndex];
      if (!barrel) return;
      const [length, width = 0.8, xOff, angleOff, delayMultiplier = 1, yOff = 0] = barrel;
      const spreadFactor = barrel[6] ?? 1;
      const spreadScale = stabilityFactor * profile.spreadMultiplier * spreadFactor;
      const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
      const forward = Vector.fromAngle(angle);
      const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
      const startPos = Vector.add(tank.pos, {
        x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
        y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
      });
      const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));
      const trap = new Bullet(
        this.nextId(),
        tip.x,
        tip.y,
        Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * profile.speed),
        tank,
        profile.damage,
        profile.life,
        profile.size * (width / 0.8),
        barrelIndex
      );

      trap.configureAsTrap({
        maxLifeTime: profile.maxLifeTime,
        friction: profile.friction,
        anchorSpeed: profile.anchorSpeed,
        armDelayMs: profile.armDelayMs,
        travelDistance: this.getTrapTravelDistance(tank, profile.travelDistance),
        damageMultiplier: profile.damageMultiplier,
        healthMultiplier: profile.healthMultiplier,
        massMultiplier: profile.massMultiplier,
        spinRate: profile.spinRate,
        accentColor: tank.team === Team.NONE ? '#facc15' : getTeamProjectileColor(tank.team),
      });

      this.entities.push(trap);
      tank.barrelHeat[barrelIndex] = 1.0;
      tank.barrelRecoilOffsets[barrelIndex] = Math.max(tank.barrelRecoilOffsets[barrelIndex] || 0, profile.firePattern === 'single' ? 0.42 : 0.28);
      fired = true;

      if (tank === this.player || this.isOnScreen(tank.pos)) {
        this.particles.push(new Particle(tip.x, tip.y, muzzleFlashColor, tank.radius * 0.34, 8, 'FLASH'));
        if (profile.firePattern !== 'single') {
          this.particles.push(new Particle(tip.x, tip.y, 'rgba(245, 158, 11, 0.18)', tank.radius * 0.5, 14, 'RING'));
        }
      }

      if (!this.sandboxConfig.infiniteAmmo) {
        const cooldownVal = Math.max(28, baseReloadTimeMs * delayMultiplier * profile.cooldown);
        tank.barrelCooldowns[barrelIndex] = cooldownVal;
        tank.barrelMaxCooldowns[barrelIndex] = cooldownVal;
      }
    });

    if (!fired) return false;

    tank.nextBarrelIndex++;
    if (this.sandboxConfig.knockbackEnabled) {
      const recoilDir = Vector.fromAngle(tank.rotation);
      const recoilPower =
        profile.firePattern === 'radial' ? 0.02 :
        profile.firePattern === 'triple' ? 0.06 :
        profile.firePattern === 'dual' ? 0.05 :
        tank.classType === TankClass.MACHINE_GUN_TRAPPER ? 0.03 : 0.07;
      tank.vel = Vector.sub(tank.vel, Vector.mult(recoilDir, recoilPower));
    }

    return true;
  }

  private fireDominionTrapShot(tank: DominionTank, idx: number, barrel: number[], baseReloadTimeMs: number): boolean {
    if (tank.barrelCooldowns[idx] > 0 && !this.sandboxConfig.infiniteAmmo) return false;
    const [length, width = 0.8, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
    const tuning = this.getDominionProjectileTuning(tank);
    const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread, tank.spread);
    const forward = Vector.fromAngle(angle);
    const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
    const startPos = Vector.add(tank.pos, {
      x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
      y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
    });
    const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));
    const trap = new Bullet(
      this.nextId(),
      tip.x,
      tip.y,
      Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * tuning.speed),
      tank,
      tuning.damage,
      tuning.life,
      Math.max(1.0, tuning.size * (width / 0.8)),
      idx
    );
    trap.configureAsTrap({
      maxLifeTime: 8200,
      friction: 0.82,
      anchorSpeed: 0.28,
      armDelayMs: 120,
      travelDistance: this.getTrapTravelDistance(tank, 210),
      damageMultiplier: 0.72,
      healthMultiplier: 5.4,
      massMultiplier: 3.8,
      spinRate: 1.65,
      accentColor: tank.team === Team.NONE ? '#facc15' : getTeamProjectileColor(tank.team),
    });
    this.entities.push(trap);

    if (!this.sandboxConfig.infiniteAmmo) {
      const cooldownVal = Math.max(210, baseReloadTimeMs * delayMultiplier * tuning.cooldown);
      tank.barrelCooldowns[idx] = cooldownVal;
      tank.barrelMaxCooldowns[idx] = cooldownVal;
    }
    tank.barrelHeat[idx] = 1.0;
    tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, 0.38);
    tank.nextBarrelIndex++;

    if (tank === this.player || this.isOnScreen(tank.pos)) {
      this.particles.push(new Particle(tip.x, tip.y, 'rgba(250, 204, 21, 0.4)', tank.radius * 0.46, 10, 'FLASH'));
      this.particles.push(new Particle(tip.x, tip.y, 'rgba(245, 158, 11, 0.24)', tank.radius * 0.88, 22, 'RING'));
    }
    return true;
  }

  attemptShoot(tank: Tank) {
    // Sandbox Hard Guard: Prevent enemies from firing if bots are disabled
    if (this.gameMode === GameMode.SANDBOX && tank.type !== EntityType.PLAYER && !this.sandboxConfig.botsEnabled) {
        return;
    }

    const CLASS_FIRE_RATE_MULT: Record<TankClass, number> = {
        [TankClass.BASIC]: 1.0,
        [TankClass.PACIFIST_TRAINEE]: 1.0,
        [TankClass.NURSE]: 1.04,
        [TankClass.TWIN]: 0.82,
        [TankClass.SNIPER]: 1.26,
        [TankClass.MACHINE_GUN]: 0.64,
        [TankClass.FLANK_GUARD]: 0.96,
        [TankClass.TRIPLE_SHOT]: 0.72,
        [TankClass.QUAD_TANK]: 0.95,
        [TankClass.TWIN_FLANK]: 0.9,
        [TankClass.ASSASSIN]: 1.2,
        [TankClass.TRAPPER]: 1.68,
        [TankClass.DUAL_TRAPPER]: 1.82,
        [TankClass.MACHINE_GUN_TRAPPER]: 0.8,
        [TankClass.OCTO_TRAPPER]: 1.72,
        [TankClass.TRIPLE_TRAPPER]: 1.58,
        [TankClass.DESTROYER]: 1.58,
        [TankClass.SPRAYER]: 0.82,
        [TankClass.TRI_ANGLE]: 0.84,
        [TankClass.HUNTER]: 1.08,
        [TankClass.GUNNER]: 0.66,
        [TankClass.DOCTOR]: 1.0,
        [TankClass.OVERSEER]: 0.9,
        [TankClass.TRIPLE_TWIN]: 0.96,
        [TankClass.OCTO_TANK]: 0.9,
        [TankClass.TRIPLE_TANK]: 0.76,
        [TankClass.PENTA_SHOT]: 0.85,
        [TankClass.SPREAD_SHOT]: 0.9,
        [TankClass.RANGER]: 1.4,
        [TankClass.STALKER]: 1.34,
        [TankClass.ANNIHILATOR]: 1.85,
        [TankClass.HYBRID]: 1.28,
        [TankClass.BOOSTER]: 0.86,
        [TankClass.FIGHTER]: 0.86,
        [TankClass.STREAMLINER]: 0.48,
        [TankClass.X_HUNTER]: 1.02,
        [TankClass.AUTO_GUNNER]: 0.6,
        [TankClass.OVERLORD]: 0.94,
        [TankClass.MANAGER]: 0.92,
        [TankClass.PLAGUE_DOCTOR]: 1.04,
        [TankClass.DRAINER_TRAINEE]: 0.98,
        [TankClass.LEECH]: 0.96,
        [TankClass.VAMPIRE]: 0.92,
        [TankClass.REAPER]: 0.88,
        [TankClass.COLOSSAL]: 1.4,
        [TankClass.LEVIATHAN]: 1.22,
        [TankClass.WARLORD]: 1.3,
        [TankClass.CELESTIAL]: 1.18,
        [TankClass.OBLITERATOR]: 1.54,
    };

    let baseReloadTimeMs = (BASE_STATS.reload - (tank.stats[StatType.RELOAD] * 2.5)) * 16.67; 
    baseReloadTimeMs *= CLASS_FIRE_RATE_MULT[tank.classType] ?? 1.0;
    
    // SACRIFICIAL GOAT BUFF: Fire Rate increased
    if (tank.isSacrificing) {
        baseReloadTimeMs *= 0.45; 
    }

    let shotFired = false;
    const isHandledByTrapBranch = (tank instanceof DominionTank && tank.weaponProfile === 'TRAPPER') || isTrapperBranchClass(tank.classType);
    if (tank instanceof DominionTank && tank.weaponProfile === 'TRAPPER') {
        const idx = tank.nextBarrelIndex % tank.barrels.length;
        const barrel = tank.barrels[idx];
        if (barrel) {
            shotFired = this.fireDominionTrapShot(tank, idx, barrel, baseReloadTimeMs);
        }
    } else if (isTrapperBranchClass(tank.classType)) {
        shotFired = this.fireTrapperVolley(tank, baseReloadTimeMs);
    }
    if (shotFired) {
        tank.invulnerableTime = 0;
        this.revealStealthOnFire(tank);
        if (tank === this.player || this.isOnScreen(tank.pos)) {
            this.sound.playShoot(tank.classType, this.getAudioSpatialOptions(tank.pos, false)); 
            if (tank.classType === TankClass.CELESTIAL && tank.isTransformed) {
                this.sound.playCelestialBoom(this.getAudioSpatialOptions(tank.pos, true));
            }
            if ((tank.classType === TankClass.GUNNER || tank.classType === TankClass.AUTO_GUNNER) && this.settings.shakeEnabled) {
                this.shakeAmount += 1.3 * this.settings.shakeIntensity;
            }
        }
        return;
    }
    if (isHandledByTrapBranch) {
        return;
    }

    const pattern = this.getSequentialBarrelPattern(tank.classType, tank.barrels.length);
    const idx = pattern
      ? pattern[tank.nextBarrelIndex % pattern.length]
      : (tank.nextBarrelIndex % tank.barrels.length);
    const barrel = tank.barrels[idx];

    const isManager = tank.classType === TankClass.MANAGER;
    const isHybrid = tank.classType === TankClass.HYBRID;
    const isOverseerType = tank.classType === TankClass.OVERLORD || tank.classType === TankClass.OVERSEER;
    const isRebirthCarrier = tank.isTransformed && tank.classType === TankClass.CELESTIAL;

    const maybeLaunchRebirthCarrierDrone = (origin: Vector2, forward: Vector2, angle: number) => {
        if (!isRebirthCarrier) return;
        const currentDrones = this.entities.filter(e => e.type === EntityType.DRONE && (e as Drone).owner === tank).length;
        const droneLimit = tank.classType === TankClass.CELESTIAL ? 9 : 6;
        if (currentDrones >= droneLimit) return;
        if (tank.rebirthDroneLaunchCooldownMs > 0 && !this.sandboxConfig.infiniteAmmo) return;

        const shouldLaunch = ((this.simulationTick + tank.id + idx) % (tank.classType === TankClass.CELESTIAL ? 2 : 3)) === 0;
        if (!shouldLaunch) return;

        const drone = new Drone(
            this.nextId(),
            origin.x - forward.x * tank.radius * 0.25,
            origin.y - forward.y * tank.radius * 0.25,
            tank
        );

        if (tank.classType === TankClass.CELESTIAL) {
            drone.maxHealth *= 0.62;
            drone.damage *= 0.86;
            drone.orbitDistance = 210 + (currentDrones % 3) * 18;
            drone.vel = Vector.mult(Vector.fromAngle(angle + Vector.randomRange(-0.5, 0.5)), 2.4);
        } else {
            drone.maxHealth *= 0.8;
            drone.damage *= 1.05;
            drone.orbitDistance = 178 + (currentDrones % 3) * 16;
            drone.vel = Vector.mult(Vector.fromAngle(angle + Vector.randomRange(-0.35, 0.35)), 2.8);
        }

        drone.health = drone.maxHealth;
        drone.displayHealth = drone.maxHealth;
        this.entities.push(drone);
        tank.rebirthDroneLaunchCooldownMs = tank.classType === TankClass.CELESTIAL ? 360 : 430;

        if (tank === this.player || this.isOnScreen(tank.pos)) {
            this.sound.playBossDroneLaunch(this.getAudioSpatialOptions(tank.pos, false), tank.classType);
        }
    };

    if (isHybrid) {
        const mainBarrelIndex = 0;
        const droneBarrelIndex = 1;
        const mainReady = tank.barrelCooldowns[mainBarrelIndex] <= 0 || this.sandboxConfig.infiniteAmmo;
        const droneReady = tank.barrelCooldowns[droneBarrelIndex] <= 0 || this.sandboxConfig.infiniteAmmo;

        // Hybrid support system: maintain a small drone cloud while firing Destroyer-class shells.
        const currentDrones = this.entities.filter(e => e.type === EntityType.DRONE && (e as Drone).owner === tank).length;
        const droneLimit = 5;
        if (droneReady && currentDrones < droneLimit) {
            const droneBarrel = tank.barrels[droneBarrelIndex] || tank.barrels[0];
            const [dLen, , , dAngleOff] = droneBarrel;
            const dAngle = tank.rotation + dAngleOff;
            const dTip = Vector.add(tank.pos, Vector.mult(Vector.fromAngle(dAngle), tank.radius * dLen));
            this.entities.push(new Drone(this.nextId(), dTip.x, dTip.y, tank));

            const droneCd = Math.max(210, baseReloadTimeMs * 1.95);
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

            let bulletSpeedMult = 2.2, bulletDamageMult = 6.25, bulletLifeMult = 1.95, bulletSizeMult = this.sandboxConfig?.spawningEnabled ? 2.28 : 2.08;
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
            b.maxHealth *= 1.18;
            b.health = b.maxHealth;
            b.damage *= 1.08;
            this.entities.push(b);

            tank.barrelHeat[mainBarrelIndex] = 1.0;
            if (tank === this.player || this.isOnScreen(tank.pos)) {
                for (let k = 0; k < 10; k++) {
                    this.particles.push(new Particle(tip.x, tip.y, 'rgba(160, 120, 255, 0.6)', 14, 26, 'GAS'));
                }
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(145, 90, 255, 0.28)', 24, 18, 'RING'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(255, 235, 255, 0.5)', (tank.radius * 0.4) * bulletSizeMult, 6, 'FLASH'));
            }

            const recoilPower = 3.15;
            if (this.sandboxConfig.knockbackEnabled) {
                tank.vel = Vector.sub(tank.vel, Vector.mult(forward, recoilPower));
                const recoilComp = Math.min(0.45, stability * 0.035);
                tank.vel = Vector.add(tank.vel, Vector.mult(forward, recoilPower * recoilComp));
            }

            const cooldownVal = Math.max(44, baseReloadTimeMs * delayMultiplier * 1.08);
            if (!this.sandboxConfig.infiniteAmmo) {
                tank.barrelCooldowns[mainBarrelIndex] = cooldownVal;
                tank.barrelMaxCooldowns[mainBarrelIndex] = cooldownVal;
            }

            shotFired = true;
        }
    } else if (tank.classType === TankClass.OBLITERATOR && tank.isTransformed) {
        const [length, width = 2.4, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
        const ready = tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo;
        if (ready) {
            const stability = tank.stats[StatType.BULLET_SPREAD] || 0;
            const spreadScale = Math.max(0.12, Math.pow(0.84, stability));
            const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
            const forward = Vector.fromAngle(angle);
            const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
            const startPos = Vector.add(tank.pos, {
                x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
                y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
            });
            const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));
            const widthScale = Math.max(1.0, width / 0.8);
            const shell = new Bullet(
                this.nextId(),
                tip.x,
                tip.y,
                Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * 1.28),
                tank,
                9.1,
                4.8,
                3.1 * widthScale,
                idx
            );
            shell.maxHealth *= 4.2;
            shell.health = shell.maxHealth;
            shell.mass *= 2.25;
            this.entities.push(shell);

            if (!this.sandboxConfig.infiniteAmmo) {
                const cooldownVal = Math.max(148, baseReloadTimeMs * delayMultiplier * 1.08);
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }

            tank.barrelHeat[idx] = 1.0;
            tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, 1.4);
            if (this.sandboxConfig.knockbackEnabled) {
                tank.vel = Vector.sub(tank.vel, Vector.mult(forward, 2.85));
            }

            if (tank === this.player || this.isOnScreen(tank.pos)) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(255,255,255,0.72)', tank.radius * 0.84, 8, 'FLASH'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(216,180,254,0.58)', tank.radius * 1.45, 24, 'RING'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(125,211,252,0.3)', tank.radius * 1.9, 28, 'RING'));
            }

            tank.nextBarrelIndex++;
            shotFired = true;
        }
    } else if (tank.classType === TankClass.COLOSSAL && tank.isTransformed) {
        const [length, width = 1.2, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
        const ready = tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo;
        if (ready) {
            const stability = tank.stats[StatType.BULLET_SPREAD] || 0;
            const spreadScale = Math.max(0.08, Math.pow(0.8, stability));
            const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
            const forward = Vector.fromAngle(angle);
            const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
            const startPos = Vector.add(tank.pos, {
                x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
                y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
            });
            const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));

            if (idx <= 2) {
                // Triple corner destroyer-grade kinetic shells.
                const widthScale = Math.max(0.9, width / 0.8);
                const b = new Bullet(
                    this.nextId(),
                    tip.x,
                    tip.y,
                    Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * 1.88),
                    tank,
                    7.9,
                    2.55,
                    2.25 * widthScale,
                    idx
                );
                b.maxHealth *= 2.15;
                b.health = b.maxHealth;
                b.mass *= 1.5;
                this.entities.push(b);

                if (this.sandboxConfig.knockbackEnabled) {
                    tank.vel = Vector.sub(tank.vel, Vector.mult(forward, 2.9));
                }
                tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, 1.28);
                tank.barrelHeat[idx] = 1.0;
            } else {
                // Quintuple rear bays: accelerated overseer-like drone deployment.
                const currentDrones = this.entities.filter(e => e.type === EntityType.DRONE && (e as Drone).owner === tank).length;
                const droneLimit = 14;
                const canLaunch = currentDrones < droneLimit && (tank.colossalDroneLaunchCooldownMs <= 0 || this.sandboxConfig.infiniteAmmo);
                if (canLaunch) {
                    const drone = new Drone(this.nextId(), tip.x, tip.y, tank);
                    drone.maxHealth *= 0.9;
                    drone.health = drone.maxHealth;
                    drone.displayHealth = drone.maxHealth;
                    drone.damage *= 1.05;
                    drone.orbitDistance = 175 + (currentDrones % 5) * 12;
                    drone.vel = Vector.mult(Vector.fromAngle(angle + Vector.randomRange(-0.45, 0.45)), 2.9);
                    this.entities.push(drone);
                    tank.colossalDroneLaunchCooldownMs = 120;
                    if (tank === this.player || this.isOnScreen(tank.pos)) {
                        this.sound.playBossDroneLaunch(this.getAudioSpatialOptions(tank.pos, false), tank.classType);
                    }
                }
                tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, 0.7);
                tank.barrelHeat[idx] = 0.82;
            }

            if (!this.sandboxConfig.infiniteAmmo) {
                const cooldownVal = idx <= 2
                    ? Math.max(128, baseReloadTimeMs * delayMultiplier * 0.9)
                    : Math.max(58, baseReloadTimeMs * delayMultiplier * 0.55);
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }

            if (tank === this.player || this.isOnScreen(tank.pos)) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(255, 182, 193, 0.58)', tank.radius * (idx <= 2 ? 0.8 : 0.42), 9, 'FLASH'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(244,114,182,0.4)', tank.radius * (idx <= 2 ? 1.2 : 0.7), 20, 'RING'));
            }

            tank.nextBarrelIndex++;
            shotFired = true;
        }
    } else if (tank.classType === TankClass.CELESTIAL && tank.isTransformed) {
        const [length, width = 0.92, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
        const ready = tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo;

        if (ready) {
            const stability = tank.stats[StatType.BULLET_SPREAD] || 0;
            const spreadScale = Math.max(0.12, Math.pow(0.82, stability));
            const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
            const forward = Vector.fromAngle(angle);
            const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
            const startPos = Vector.add(tank.pos, {
                x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
                y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
            });
            const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));

            const widthScale = Math.max(0.75, width / 0.8);
            const bSpeed = (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * 1.22;
                const orb = new Bullet(
                    this.nextId(),
                    tip.x,
                    tip.y,
                    Vector.mult(forward, bSpeed * 0.96),
                    tank,
                    5.25 * widthScale,
                    2.95,
                    2.65 * widthScale,
                    idx
                );
            orb.maxHealth *= 1.45;
            orb.health = orb.maxHealth;
            orb.mass *= 1.25;
            this.entities.push(orb);

            maybeLaunchRebirthCarrierDrone(tip, forward, angle);

            if (!this.sandboxConfig.infiniteAmmo) {
                const cooldownVal = Math.max(104, baseReloadTimeMs * delayMultiplier * 0.82);
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }

            tank.barrelHeat[idx] = 1.0;
            tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, 1.15);

            if (this.sandboxConfig.knockbackEnabled) {
                tank.vel = Vector.sub(tank.vel, Vector.mult(forward, 2.35));
            }

            if (tank === this.player || this.isOnScreen(tank.pos)) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(255,255,255,0.64)', tank.radius * 0.62, 7, 'FLASH'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(216,180,254,0.5)', tank.radius * 0.9, 22, 'RING'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(125,211,252,0.28)', tank.radius * 1.3, 28, 'RING'));
                for (let k = 0; k < 14; k++) {
                    const pAngle = angle + Math.PI + Vector.randomRange(-0.85, 0.85);
                    const p = new Particle(tip.x, tip.y, 'rgba(196,181,253,0.54)', 8 + Math.random() * 10, 22 + Math.random() * 18, 'GAS');
                    p.vel = { x: Math.cos(pAngle) * (1 + Math.random() * 3), y: Math.sin(pAngle) * (1 + Math.random() * 3) };
                    this.particles.push(p);
                }
            }

            tank.nextBarrelIndex++;
            shotFired = true;
        }
    } else if (tank.classType === TankClass.WARLORD && tank.isTransformed) {
        const [length, width = 1.0, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
        const ready = tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo;
        if (ready) {
            const stability = tank.stats[StatType.BULLET_SPREAD] || 0;
            const spreadScale = Math.max(0.1, Math.pow(0.84, stability));
            const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
            const forward = Vector.fromAngle(angle);
            const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
            const startPos = Vector.add(tank.pos, {
                x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
                y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
            });
            const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));
            const widthScale = Math.max(0.78, width / 0.8);
            const shell = new Bullet(
                this.nextId(),
                tip.x,
                tip.y,
                Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * (idx === 0 ? 1.42 : 1.22)),
                tank,
                idx === 0 ? 6.1 : 4.2,
                idx === 0 ? 2.1 : 1.85,
                (idx === 0 ? 2.05 : 1.52) * widthScale,
                idx
            );
            shell.maxHealth *= idx === 0 ? 2.1 : 1.55;
            shell.health = shell.maxHealth;
            this.entities.push(shell);

            if (!this.sandboxConfig.infiniteAmmo) {
                const cooldownVal = Math.max(76, baseReloadTimeMs * delayMultiplier * (idx === 0 ? 0.9 : 0.64));
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }

            tank.barrelHeat[idx] = 1.0;
            tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, idx === 0 ? 1.22 : 0.88);
            if (this.sandboxConfig.knockbackEnabled) {
                tank.vel = Vector.sub(tank.vel, Vector.mult(forward, idx === 0 ? 2.4 : 1.55));
            }
            if (tank === this.player || this.isOnScreen(tank.pos)) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(248,113,113,0.5)', tank.radius * (idx === 0 ? 0.7 : 0.5), 8, 'FLASH'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(251,146,60,0.3)', tank.radius * (idx === 0 ? 1.15 : 0.8), 18, 'RING'));
            }

            tank.nextBarrelIndex++;
            shotFired = true;
        }
    } else if (tank.classType === TankClass.LEVIATHAN && tank.isTransformed) {
        const [length, width = 0.9, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
        const ready = tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo;
        if (ready) {
            const stability = tank.stats[StatType.BULLET_SPREAD] || 0;
            const spreadScale = Math.max(0.14, Math.pow(0.84, stability));
            const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
            const forward = Vector.fromAngle(angle);
            const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
            const startPos = Vector.add(tank.pos, {
                x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
                y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
            });
            const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));
            const widthScale = Math.max(0.78, width / 0.8);

            // Leviathan rebirth support mount: central manager barrel deploys twin mini-tanks (max 3).
            const isLeviathanManagerBarrel = idx === tank.barrels.length - 1;
            if (isLeviathanManagerBarrel) {
                const currentMiniTanks = this.entities.filter(e => e.type === EntityType.MINI_TANK && (e as MiniTank).owner === tank).length;
                if (currentMiniTanks < 3) {
                    const mini = new MiniTank(this.nextId(), tip.x, tip.y, tank, 'TWIN');
                    mini.maxHealth *= 1.2;
                    mini.health = mini.maxHealth;
                    mini.displayHealth = mini.maxHealth;
                    mini.orbitAngle = Math.random() * Math.PI * 2;
                    mini.vel = Vector.mult(Vector.fromAngle(angle + Vector.randomRange(-0.35, 0.35)), 2.6);
                    this.entities.push(mini);
                    tank.rebirthDroneLaunchCooldownMs = Math.max(tank.rebirthDroneLaunchCooldownMs, 520);
                    if (tank === this.player || this.isOnScreen(tank.pos)) {
                        this.sound.playBossDroneLaunch(this.getAudioSpatialOptions(tank.pos, false), tank.classType);
                    }
                }
            } else {
                const bolt = new Bullet(
                    this.nextId(),
                    tip.x,
                    tip.y,
                    Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * 1.18),
                    tank,
                    4.95,
                    2.45,
                    2.45 * widthScale,
                    idx
                );
                bolt.maxHealth *= 1.75;
                bolt.health = bolt.maxHealth;
                bolt.mass *= 1.3;
                this.entities.push(bolt);
            }

            if (!isLeviathanManagerBarrel) maybeLaunchRebirthCarrierDrone(tip, forward, angle);

            if (!this.sandboxConfig.infiniteAmmo) {
                const cooldownVal = Math.max(136, baseReloadTimeMs * delayMultiplier * 1.0);
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }

            tank.barrelHeat[idx] = 1.0;
            tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, 1.05);
            if (!isLeviathanManagerBarrel && this.sandboxConfig.knockbackEnabled) {
                tank.vel = Vector.sub(tank.vel, Vector.mult(forward, 2.05));
            }

            if (tank === this.player || this.isOnScreen(tank.pos)) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(186,230,253,0.58)', tank.radius * 0.5, 7, 'FLASH'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(45,212,255,0.38)', tank.radius * 0.95, 20, 'RING'));
            }

            tank.nextBarrelIndex++;
            shotFired = true;
        }
    } else if (tank.classType === TankClass.REAPER) {
        const [length, width = 0.9, xOff, angleOff, delayMultiplier, yOff = 0] = barrel;
        const ready = tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo;
        if (ready) {
            const stability = tank.stats[StatType.BULLET_SPREAD] || 0;
            const spreadScale = Math.max(0.16, Math.pow(0.86, stability));
            const angle = tank.rotation + angleOff + Vector.randomRange(-tank.spread * spreadScale, tank.spread * spreadScale);
            const forward = Vector.fromAngle(angle);
            const lateralAngle = tank.rotation + angleOff + Math.PI / 2;
            const startPos = Vector.add(tank.pos, {
                x: Math.cos(lateralAngle) * (yOff * tank.radius) + Math.cos(tank.rotation + angleOff) * (xOff * tank.radius),
                y: Math.sin(lateralAngle) * (yOff * tank.radius) + Math.sin(tank.rotation + angleOff) * (xOff * tank.radius)
            });
            const tip = Vector.add(startPos, Vector.mult(forward, tank.radius * length));
            const widthScale = Math.max(0.74, width / 0.8);

            const isCoreBarrel = idx === 0;
            const shell = new Bullet(
                this.nextId(),
                tip.x,
                tip.y,
                Vector.mult(forward, (BASE_STATS.bulletSpeed + tank.stats[StatType.BULLET_SPEED] * 0.8) * (isCoreBarrel ? 1.14 : 1.2)),
                tank,
                isCoreBarrel ? 4.25 : 2.95,
                isCoreBarrel ? 2.15 : 1.82,
                (isCoreBarrel ? 1.95 : 1.45) * widthScale,
                idx
            );
            shell.maxHealth *= isCoreBarrel ? 1.42 : 1.25;
            shell.health = shell.maxHealth;
            this.entities.push(shell);

            if (!this.sandboxConfig.infiniteAmmo) {
                const cooldownVal = Math.max(84, baseReloadTimeMs * delayMultiplier * (isCoreBarrel ? 0.92 : 0.78));
                tank.barrelCooldowns[idx] = cooldownVal;
                tank.barrelMaxCooldowns[idx] = cooldownVal;
            }

            tank.barrelHeat[idx] = 1.0;
            tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, isCoreBarrel ? 1.0 : 0.74);
            if (this.sandboxConfig.knockbackEnabled) {
                tank.vel = Vector.sub(tank.vel, Vector.mult(forward, isCoreBarrel ? 1.7 : 1.2));
            }
            if (tank === this.player || this.isOnScreen(tank.pos)) {
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(255,120,120,0.52)', tank.radius * (isCoreBarrel ? 0.56 : 0.42), 8, 'FLASH'));
                this.particles.push(new Particle(tip.x, tip.y, 'rgba(220,38,38,0.34)', tank.radius * (isCoreBarrel ? 0.9 : 0.7), 18, 'RING'));
            }

            tank.nextBarrelIndex++;
            shotFired = true;
        }
    } else if (isManager) {
        const unitLimit = 6;
        let currentMiniTanks = this.entities.filter(e => e.type === EntityType.MINI_TANK && (e as MiniTank).owner === tank).length;
        if (currentMiniTanks < unitLimit && (tank.barrelCooldowns[idx] <= 0 || this.sandboxConfig.infiniteAmmo)) {
            const [length, , , angleOff] = barrel;
            const angle = tank.rotation + angleOff;
            const tip = Vector.add(tank.pos, Vector.mult(Vector.fromAngle(angle), tank.radius * length));

            const unitVariant: 'BASIC' | 'TWIN' = (currentMiniTanks % 2 === 0) ? 'TWIN' : 'BASIC';
            const unit = new MiniTank(this.nextId(), tip.x, tip.y, tank, unitVariant);
            unit.combatOrbitDistance = unitVariant === 'TWIN' ? 200 : 180;
            this.entities.push(unit);

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
            
            const summonReloadMult =
                tank.classType === TankClass.HYBRID ? 2.35 :
                tank.classType === TankClass.OVERLORD ? 2.2 :
                tank.classType === TankClass.OVERSEER ? 2.45 :
                4.0;
            const cooldownVal = Math.max(220, baseReloadTimeMs * summonReloadMult);
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
        
        const isDestroyer = tank.classType === TankClass.DESTROYER;
        const isHybrid = tank.classType === TankClass.HYBRID;
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
        
        // Class-specialized projectile identity + anti-power-creep buffs for weaker classes.
        if (tank.classType === TankClass.BASIC) { bulletSpeedMult = 1.02; bulletDamageMult = 1.02; bulletLifeMult = 1.03; bulletSizeMult = 1.0; }
        else if (tank.classType === TankClass.TWIN) { bulletSpeedMult = 1.06; bulletDamageMult = 1.0; bulletLifeMult = 1.02; bulletSizeMult = 0.96; }
        else if (tank.classType === TankClass.TRIPLE_SHOT) { bulletSpeedMult = 1.16; bulletDamageMult = 1.08; bulletLifeMult = 1.16; bulletSizeMult = 0.98; }
        else if (tank.classType === TankClass.QUAD_TANK) { bulletSpeedMult = 1.04; bulletDamageMult = 0.9; bulletLifeMult = 1.02; bulletSizeMult = 0.9; }
        else if (tank.classType === TankClass.TWIN_FLANK) { bulletSpeedMult = 1.08; bulletDamageMult = 0.98; bulletLifeMult = 1.05; bulletSizeMult = 0.94; }
        else if (tank.classType === TankClass.TRIPLE_TWIN) { bulletSpeedMult = 1.1; bulletDamageMult = 0.96; bulletLifeMult = 1.08; bulletSizeMult = 0.92; }
        else if (tank.classType === TankClass.TRIPLE_TANK) { bulletSpeedMult = 1.14; bulletDamageMult = 1.18; bulletLifeMult = 1.16; bulletSizeMult = 1.0; }
        else if (tank.classType === TankClass.PENTA_SHOT) { bulletSpeedMult = 1.1; bulletDamageMult = 0.88; bulletLifeMult = 1.12; bulletSizeMult = 0.85; }
        else if (tank.classType === TankClass.SPREAD_SHOT) { bulletSpeedMult = 1.2; bulletDamageMult = 0.82; bulletLifeMult = 0.96; bulletSizeMult = 0.8; }
        else if (tank.classType === TankClass.SNIPER) { bulletSpeedMult = 1.5; bulletDamageMult = 1.65; bulletLifeMult = 1.3; bulletSizeMult = 0.9; }
        else if (isTrapperBranchClass(tank.classType)) {
            const trapProfile = this.getTrapperProfile(tank.classType);
            bulletSpeedMult = trapProfile.speed;
            bulletDamageMult = trapProfile.damage;
            bulletLifeMult = trapProfile.life;
            bulletSizeMult = trapProfile.size;
        }
        else if (tank.classType === TankClass.ASSASSIN) { bulletSpeedMult = 1.85; bulletDamageMult = 2.25; bulletLifeMult = 1.7; bulletSizeMult = 0.88; }
        else if (tank.classType === TankClass.RANGER || tank.classType === TankClass.STALKER) { bulletSpeedMult = 2.4; bulletDamageMult = 3.20; bulletLifeMult = 2.4; bulletSizeMult = 0.92; }
        else if (isDestroyer) { 
            // Keep heavy identity, but shell should read slightly smaller than muzzle width.
            bulletSizeMult = Math.max(1.55, widthScale * (this.sandboxConfig?.spawningEnabled ? 0.94 : 0.88)); 
            bulletDamageMult = 6.0; 
            bulletLifeMult = 1.8; 
            bulletSpeedMult = 2.1; 
        }
        else if (isHybrid) {
            // HYBRID: make the shell matter again while keeping it below full destroyer pressure.
            bulletSizeMult = Math.max(1.42, widthScale * 0.88);
            bulletDamageMult = 3.35;
            bulletLifeMult = 1.6;
            bulletSpeedMult = 1.58;
        }
        else if (isAnnihilator) { 
            // True siege shell: brutally heavy impact, slower cadence, much better presence.
            bulletSizeMult = Math.max(1.95, widthScale * (this.sandboxConfig?.spawningEnabled ? 0.98 : 0.92)); 
            bulletDamageMult = 11.2; 
            bulletLifeMult = 2.0; 
            bulletSpeedMult = 1.78; 
        }
        else if (tank.classType === TankClass.FLANK_GUARD) { bulletSpeedMult = 1.06; bulletDamageMult = 1.0; bulletLifeMult = 1.02; bulletSizeMult = 0.94; }
        else if (tank.classType === TankClass.TRI_ANGLE) { bulletSpeedMult = 1.18; bulletDamageMult = 0.9; bulletLifeMult = 0.94; bulletSizeMult = 0.86; }
        else if (tank.classType === TankClass.BOOSTER) { bulletSpeedMult = 1.24; bulletDamageMult = 0.94; bulletLifeMult = 0.96; bulletSizeMult = 0.86; }
        else if (tank.classType === TankClass.FIGHTER) { bulletSpeedMult = 1.18; bulletDamageMult = 0.98; bulletLifeMult = 1.0; bulletSizeMult = 0.9; }
        else if (tank.classType === TankClass.OVERSEER) { bulletSizeMult = 0.84; bulletDamageMult = 0.92; bulletSpeedMult = 1.16; bulletLifeMult = 1.28; }
        else if (tank.classType === TankClass.OVERLORD) { bulletSizeMult = 0.84; bulletDamageMult = 0.9; bulletSpeedMult = 1.14; bulletLifeMult = 1.28; }
        else if (tank.classType === TankClass.MANAGER) { bulletSizeMult = 0.86; bulletDamageMult = 0.96; bulletSpeedMult = 1.18; bulletLifeMult = 1.32; }
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
            bulletDamageMult = 1.08; // slight class-wide uplift for blood line
            bulletLifeMult = 1.26;
            bulletSpeedMult = 1.22;
        }
        else if (isMachineGun) {
            // Sustained suppression identity with a wider spray cone.
            const spin = Math.min(1, tank.machineSpin);
            const heat = Math.min(1, tank.machineHeat);
            const overdrive = Math.max(0, (heat - 0.35) / 0.65) * (0.45 + spin * 0.55);
            bulletSpeedMult = 1.02 + 0.06 * overdrive;
            bulletDamageMult *= 0.9 + overdrive * 0.11;
            bulletLifeMult *= 0.9 + overdrive * 0.1;
            bulletSizeMult *= 0.92 + overdrive * 0.05;
        }
        else if (isSprayer) {
            if (isSprayerCoreBarrel) {
                bulletSizeMult = 1.38;
                bulletDamageMult = 1.52;
                bulletLifeMult = 1.26;
                bulletSpeedMult = 1.12;
            } else {
                bulletSizeMult = 0.94;
                bulletDamageMult = 0.84;
                bulletLifeMult = 0.96;
                bulletSpeedMult = 1.24;
            }
        }
        else if (tank.classType === TankClass.GUNNER || tank.classType === TankClass.AUTO_GUNNER) {
            bulletSizeMult = tank.classType === TankClass.GUNNER ? 0.9 : 0.78;
            bulletDamageMult = tank.classType === TankClass.GUNNER ? 1.06 : 0.98;
            bulletSpeedMult = tank.classType === TankClass.GUNNER ? 1.82 : 1.94;
            bulletLifeMult = tank.classType === TankClass.GUNNER ? 1.5 : 1.4;
        }
        else if (tank.classType === TankClass.STREAMLINER) { bulletDamageMult = 0.74; bulletSizeMult = 0.68; bulletSpeedMult = 2.08; bulletLifeMult = 1.22; }

        if (tank instanceof DominionTank) {
            const tuning = this.getDominionProjectileTuning(tank);
            bulletSpeedMult *= tuning.speed;
            bulletDamageMult *= tuning.damage;
            bulletLifeMult *= tuning.life;
            bulletSizeMult *= tuning.size;
        }

        // EXCLUSION LOGIC: Only apply width scale to bullet properties if not a Destroyer, Annihilator, or Hybrid main gun.
        if (!isSpecialLarge) {
            bulletSizeMult *= widthScale;
            bulletDamageMult *= widthScale;
            bulletLifeMult *= widthScale;
        }

        // Spread Shot identity: heavier center shell, lighter side pellets.
        if (tank.classType === TankClass.SPREAD_SHOT) {
            const isCenterBarrel = idx === 0;
            if (isCenterBarrel) {
                bulletDamageMult *= 1.55;
                bulletSpeedMult *= 0.92;
                bulletLifeMult *= 1.12;
                bulletSizeMult *= 1.2;
            } else {
                bulletDamageMult *= 0.76;
                bulletSpeedMult *= 1.03;
                bulletLifeMult *= 0.9;
                bulletSizeMult *= 0.9;
            }
        }

        const stabilityFactor = Math.max(0.28, Math.pow(0.86, stability));
        let spreadScale = stabilityFactor;
        if (isMachineGun) {
            const spin = Math.min(1, tank.machineSpin);
            const heat = Math.min(1, tank.machineHeat);
            const sprayBias = 1.2 + spin * 0.25 + heat * 0.28;
            const overheatPenalty = Math.max(0, tank.machineHeat - 0.86) * 1.6;
            spreadScale = Math.min(1.65, stabilityFactor * sprayBias * (1 + overheatPenalty));
        }
        if (tank.classType === TankClass.GUNNER || tank.classType === TankClass.AUTO_GUNNER) {
            spreadScale *= 0.86;
        }
        if (isSprayer) {
            spreadScale *= isSprayerCoreBarrel ? 0.7 : 1.08;
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

        if (isTrapperBranchClass(tank.classType)) {
            const trapProfile = this.getTrapperProfile(tank.classType);
            b.configureAsTrap({
                maxLifeTime: trapProfile.maxLifeTime,
                friction: trapProfile.friction,
                anchorSpeed: trapProfile.anchorSpeed,
                armDelayMs: trapProfile.armDelayMs,
                damageMultiplier: trapProfile.damageMultiplier,
                healthMultiplier: trapProfile.healthMultiplier,
                massMultiplier: trapProfile.massMultiplier,
                spinRate: trapProfile.spinRate,
                accentColor: tank.team === Team.NONE ? '#facc15' : getTeamProjectileColor(tank.team),
            });
        }
        
        const isSniperFamily = tank.classType === TankClass.SNIPER || tank.classType === TankClass.ASSASSIN || tank.classType === TankClass.RANGER || tank.classType === TankClass.STALKER;
        if (isSniperFamily) {
            b.maxHealth *= 1.45; // Enhanced solid bullet health
            b.health = b.maxHealth;
        }

        if (isHybrid) {
            b.mass = Math.max(b.mass, 220);
            b.maxHealth *= 1.12;
            b.health = b.maxHealth;
            b.damage *= 1.04;
        }

        if (isAnnihilator) {
            b.mass = 575; 
            b.friction = 0.992; 
            b.maxHealth *= 1.16;
            b.health = b.maxHealth;
            b.damage *= 1.08;
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
            recoilPower = 1.85;
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

        const annihilatorReloadNerf = isAnnihilator ? 1.34 : 1.0;
        let cooldownVal = Math.max(
            this.getClassMinCooldown(tank.classType),
            baseReloadTimeMs * delayMultiplier * annihilatorReloadNerf
        );
        cooldownVal *= this.getSequentialCadenceMultiplier(tank.classType);
        if (tank instanceof DominionTank) {
            cooldownVal = Math.max(cooldownVal, baseReloadTimeMs * delayMultiplier * this.getDominionProjectileTuning(tank).cooldown);
        }
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
                ? 0.72
                : (0.46 - normalized * 0.12);
            tank.barrelRecoilOffsets[idx] = Math.max(tank.barrelRecoilOffsets[idx] || 0, recoilImpulse);
        }
        tank.nextBarrelIndex++;
        shotFired = true;
    }

    if (shotFired) { 
        tank.invulnerableTime = 0;
        this.revealStealthOnFire(tank);
        if (tank === this.player || this.isOnScreen(tank.pos)) {
            this.sound.playShoot(tank.classType, this.getAudioSpatialOptions(tank.pos, false)); 
            if (tank.classType === TankClass.CELESTIAL && tank.isTransformed) {
                this.sound.playCelestialBoom(this.getAudioSpatialOptions(tank.pos, true));
            }
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
    tank.invulnerableTime = 0;
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
      const isBossClass = this.isBossClass(tank.classType);
      const weightPenalty = tank.stats[StatType.BODY_DAMAGE] * 0.12;
      const rawSpeedStat = tank.stats[StatType.MOVEMENT_SPEED];
      const speedSoftcap = 5;
      const overflow = Math.max(0, rawSpeedStat - speedSoftcap);
      const dampedSpeedStat = rawSpeedStat - overflow + overflow * 0.42;
      const speedBonus = dampedSpeedStat * 0.6;
      let effectiveSpeed = Math.max(1.8, BASE_STATS.speed + speedBonus - weightPenalty);

      if (isBossClass) {
        const bossSpeedCap =
          tank.classType === TankClass.CELESTIAL ? 2.35 :
          tank.classType === TankClass.LEVIATHAN ? 1.82 :
          tank.classType === TankClass.WARLORD ? 1.58 :
          tank.classType === TankClass.OBLITERATOR ? 1.3 :
          1.5;
        effectiveSpeed = Math.min(effectiveSpeed, bossSpeedCap);
        effectiveSpeed *= tank.classType === TankClass.WARLORD && (tank as Tank).isSiegeMode ? 0.82 : 1;
      }

      if (tank.type === EntityType.ELITE_TANK) {
        // Keep elite bosses on a basic-bot movement profile so their threat comes from kit, not raw chase speed.
        effectiveSpeed = ELITE_TANK_BASELINE_SPEED;
      }

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

            // Smooth steering locally to reduce micro-jitter from fast directional input changes.
            // Do NOT mutate `tank.lastSteering` here — AI systems own that vector.
            const steerBlend = 0.24;
            const desiredDir = Vector.normalize(dir);
            const baseSteer = tank.lastSteering || { x: 0, y: 0 };
            const localSteer = {
                x: baseSteer.x + (desiredDir.x - baseSteer.x) * steerBlend,
                y: baseSteer.y + (desiredDir.y - baseSteer.y) * steerBlend,
            };
            const smoothDir = Vector.mag(localSteer) > 0.001 ? Vector.normalize(localSteer) : desiredDir;
            tank.acc = Vector.mult(smoothDir, effectiveSpeed * (1 - tank.friction) / tank.friction);
      
      // Update chassis rotation smoothly
      const targetChassisRot = Math.atan2(smoothDir.y, smoothDir.x);
      let diff = targetChassisRot - tank.chassisRotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
            tank.chassisRotation += diff * 0.12;
    }
  }

  private syncTankBarrelsForClass(tank: Tank, preserveCooldowns = false) {
      const resolvedBarrels = TANK_CONFIGS[tank.classType] ?? TANK_CONFIGS[TankClass.BASIC];
      tank.barrels = resolvedBarrels;
      const barrelCount = resolvedBarrels.length;
      tank.barrelCooldowns = preserveCooldowns
        ? Array.from({ length: barrelCount }, (_, i) => tank.barrelCooldowns[i] || 0)
        : new Array(barrelCount).fill(0);
      tank.barrelMaxCooldowns = preserveCooldowns
        ? Array.from({ length: barrelCount }, (_, i) => tank.barrelMaxCooldowns[i] || 100)
        : new Array(barrelCount).fill(100);
      tank.barrelHeat = Array.from({ length: barrelCount }, (_, i) => tank.barrelHeat[i] || 0);
      tank.barrelRecoilOffsets = Array.from({ length: barrelCount }, (_, i) => tank.barrelRecoilOffsets[i] || 0);
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

  private getBotChatAccent(team: Team, category: BotChatCategory): string {
    if (category === 'death_taunt') return '#f97316';
    if (category === 'healing_request' || category === 'low_health') return '#4ade80';
    if (category === 'panic') return '#facc15';
    return getTeamColor(team);
  }

  private getBotChatVoiceKey(bot: Tank): string {
    if (bot.isTransformed || this.isBossClass(bot.classType)) return 'boss';
    if (bot.secondarySector === 'restoration' || this.isPacifist(bot.classType)) return 'support';
    if (
      bot.classType === TankClass.SNIPER ||
      bot.classType === TankClass.RANGER ||
      bot.classType === TankClass.ASSASSIN ||
      bot.classType === TankClass.STALKER ||
      bot.classType === TankClass.HUNTER ||
      bot.classType === TankClass.X_HUNTER
    ) return 'sniper';
    if (
      bot.classType === TankClass.BOOSTER ||
      bot.classType === TankClass.TRI_ANGLE ||
      bot.classType === TankClass.FIGHTER
    ) return 'rusher';
    return 'default';
  }

  private resolveBotChatLine(category: BotChatCategory, bot: Tank): string {
    const voiceKey = this.getBotChatVoiceKey(bot);
    const classPool = BOT_CLASS_CHAT_LINES[category]?.[voiceKey];
    const pool = classPool && classPool.length > 0 ? classPool : BOT_CHAT_LINES[category];
    if (!pool || pool.length === 0) return '...';
    const lastLine = this.botChatLastLine.get(bot.id);
    const choices = pool.length > 1 ? pool.filter((line) => line !== lastLine) : pool;
    const picked = choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
    this.botChatLastLine.set(bot.id, picked);
    return picked;
  }

  private canBotSpeak(botId: number, cooldownMs: number): boolean {
    return (this.botChatCooldowns.get(botId) ?? 0) <= this.elapsedMs;
  }

  private splitBotChatWords(text: string): string[] {
    return text
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  private getBotChatRevealState(chat: ActiveBotChat): {
    typing: boolean;
    revealedWordCount: number;
    totalWords: number;
    displayText: string;
  } {
    const totalWords = Math.max(1, chat.words.length);
    const elapsed = Math.max(0, this.elapsedMs - chat.createdAt);
    const revealedWordCount = totalWords <= 1
      ? 1
      : Math.max(1, Math.min(totalWords, 1 + Math.floor(elapsed / Math.max(1, chat.wordDelayMs))));
    const typing = revealedWordCount < totalWords;
    const baseText = chat.words.slice(0, revealedWordCount).join(' ');
    const displayText = typing && baseText.length > 0 && (Math.floor(this.elapsedMs / 180) % 2) === 0
      ? `${baseText} _`
      : baseText;
    return { typing, revealedWordCount, totalWords, displayText };
  }

  private queueBotChat(
    bot: Tank,
    category: BotChatCategory,
    options?: {
      text?: string;
      typingMs?: number;
      wordDelayMs?: number;
      visibleMs?: number;
      cooldownMs?: number;
      persistAfterDeath?: boolean;
    }
  ): string | null {
    if (bot.isDead) return null;
    if (this.botChats.some((entry) => entry.botId === bot.id)) return null;
    if (this.botChats.length >= MAX_ACTIVE_BOT_CHATS) {
      this.botChats.sort((a, b) => a.expiresAt - b.expiresAt);
      this.botChats.shift();
    }

    const cooldownMs = options?.cooldownMs ?? BOT_CHAT_BASE_COOLDOWN_MS;
    if (!this.canBotSpeak(bot.id, cooldownMs)) return null;

    const text = options?.text ?? this.resolveBotChatLine(category, bot);
    const words = this.splitBotChatWords(text);
    const totalWords = Math.max(1, words.length);
    const fallbackTypingMs = Math.max(650, options?.typingMs ?? 1100);
    const wordDelayMs = Math.max(90, Math.round(options?.wordDelayMs ?? (totalWords > 1 ? fallbackTypingMs / (totalWords - 1) : fallbackTypingMs)));
    const typingMs = totalWords > 1 ? wordDelayMs * (totalWords - 1) : Math.max(240, Math.round(wordDelayMs * 0.7));
    const visibleMs = Math.max(700, options?.visibleMs ?? 1700);
    const createdAt = this.elapsedMs;
    const typingUntil = createdAt + typingMs;
    const visibleUntil = typingUntil + visibleMs;
    const expiresAt = visibleUntil + 260;
    const chat: ActiveBotChat = {
      id: `${bot.id}-${category}-${Math.floor(createdAt)}-${Math.random().toString(36).slice(2, 7)}`,
      botId: bot.id,
      name: bot.name || 'BOT',
      classType: bot.classType,
      team: bot.team,
      category,
      text,
      createdAt,
      typingUntil,
      visibleUntil,
      expiresAt,
      words,
      wordDelayMs,
      lastBlipWordCount: 0,
      onScreen: this.isOnScreen(bot.pos, bot.radius + 28),
      worldPos: { x: bot.pos.x, y: bot.pos.y - bot.radius - 34 },
      accentColor: this.getBotChatAccent(bot.team, category),
      persistAfterDeath: !!options?.persistAfterDeath,
    };

    this.botChats.push(chat);
    this.botChatCooldowns.set(bot.id, createdAt + cooldownMs);
    return chat.id;
  }

  private getRenderedBotChats(): BotChatBubble[] {
    return this.botChats.map((chat) => {
      const reveal = this.getBotChatRevealState(chat);
      const fadeIn = Math.max(0, Math.min(1, (this.elapsedMs - chat.createdAt) / 180));
      const fadeOut = chat.visibleUntil < this.elapsedMs
        ? 1 - Math.max(0, Math.min(1, (this.elapsedMs - chat.visibleUntil) / Math.max(1, chat.expiresAt - chat.visibleUntil)))
        : 1;

      return {
        id: chat.id,
        botId: chat.botId,
        name: chat.name,
        classType: chat.classType,
        team: chat.team,
        category: chat.category,
        text: chat.text,
        displayText: reveal.displayText,
        typing: reveal.typing,
        revealedWordCount: reveal.revealedWordCount,
        totalWords: reveal.totalWords,
        onScreen: chat.onScreen,
        opacity: Math.max(0, Math.min(1, fadeIn * fadeOut)),
        worldPos: chat.worldPos,
        accentColor: chat.accentColor,
      };
    });
  }

  private updateBotChats(): void {
    const next: ActiveBotChat[] = [];
    for (let i = 0; i < this.botChats.length; i++) {
      const chat = this.botChats[i];
      if (chat.expiresAt <= this.elapsedMs) continue;
      const speaker = this.entities.find((entity) => entity.id === chat.botId) as Tank | undefined;
      if (speaker && !speaker.isDead) {
        chat.worldPos = { x: speaker.pos.x, y: speaker.pos.y - speaker.radius - 34 };
        chat.onScreen = this.isOnScreen(speaker.pos, speaker.radius + 28);
      } else if (!chat.persistAfterDeath) {
        continue;
      } else {
        chat.onScreen = this.isOnScreen(chat.worldPos, 120);
      }

      const reveal = this.getBotChatRevealState(chat);
      if (reveal.revealedWordCount > chat.lastBlipWordCount) {
        if (chat.onScreen) {
          const spatial = this.getAudioSpatialOptions(chat.worldPos, false);
          const voiceKey = this.getBotChatVoiceKey(speaker ?? this.player);
          const blipsToPlay = Math.min(2, reveal.revealedWordCount - chat.lastBlipWordCount);
          for (let blip = 0; blip < blipsToPlay; blip++) {
            this.sound.playDialogueBlip(spatial, voiceKey as 'default' | 'support' | 'sniper' | 'rusher' | 'boss');
          }
        }
        chat.lastBlipWordCount = reveal.revealedWordCount;
      }

      next.push(chat);
    }
    this.botChats = next;
  }

  private findFriendlyRestorationSupporters(bot: Tank, healers: Tank[]): Tank[] {
    return healers.filter((healer) =>
      healer.id !== bot.id &&
      !healer.isDead &&
      healer.team === bot.team &&
      Vector.dist(healer.pos, bot.pos) <= Math.max(healer.healingAuraRadius * 1.12, 250)
    );
  }

  private isCurrentlyReceivingHealing(bot: Tank): boolean {
    return bot.statusHealingUntil > Date.now() + 300;
  }

  private maybeTriggerHealingRequests(aliveCombatTanks: Tank[], aliveRestorationTanks: Tank[]): void {
    const activeHealingBubbles = this.botChats.filter((entry) => entry.category === 'healing_request').length;
    if (activeHealingBubbles >= 2) return;

    for (let i = 0; i < aliveCombatTanks.length; i++) {
      const bot = aliveCombatTanks[i];
      if (!bot.isBot || bot.isDead) continue;
      const hpRatio = bot.health / Math.max(1, bot.maxHealth);
      if (hpRatio >= 0.35 || hpRatio <= 0) continue;
      if (this.isCurrentlyReceivingHealing(bot)) continue;
      const nearbyHealers = this.findFriendlyRestorationSupporters(bot, aliveRestorationTanks);
      if (nearbyHealers.length === 0) continue;
      if (!this.canBotSpeak(bot.id, 12000)) continue;
      if (Math.random() > 0.12) continue;
      this.queueBotChat(bot, 'healing_request', { cooldownMs: 12000, visibleMs: 1600 });
      break;
    }
  }

  private hasNearbyHostile(bot: Tank, radius: number): boolean {
    const neighbors = this.spatialGrid.query(bot.pos, radius);
    for (let i = 0; i < neighbors.length; i++) {
      const entity = neighbors[i];
      if (!entity || entity.id === bot.id || entity.isDead) continue;
      const tankLike = entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.ELITE_TANK;
      if (!tankLike) continue;
      if (entity.team === bot.team && entity.team !== Team.NONE) continue;
      return true;
    }
    return false;
  }

  private maybeTriggerAmbientBotFlavor(aliveCombatTanks: Tank[]): void {
    for (let i = 0; i < aliveCombatTanks.length; i++) {
      const bot = aliveCombatTanks[i];
      if (!bot.isBot || bot.isDead || !this.canBotSpeak(bot.id, BOT_RARE_CHAT_COOLDOWN_MS)) continue;
      const hpRatio = bot.health / Math.max(1, bot.maxHealth);
      const nearbyHostile = this.hasNearbyHostile(bot, 460);

      if (hpRatio < 0.24 && nearbyHostile && Math.random() < 0.055) {
        this.queueBotChat(bot, 'panic', { cooldownMs: BOT_RARE_CHAT_COOLDOWN_MS, visibleMs: 1400 });
        continue;
      }

      if (hpRatio < 0.18 && Math.random() < 0.03) {
        this.queueBotChat(bot, 'low_health', { cooldownMs: BOT_RARE_CHAT_COOLDOWN_MS, visibleMs: 1300 });
        continue;
      }

      if (!nearbyHostile && Math.random() < 0.004 && this.isOnScreen(bot.pos, 220)) {
        this.queueBotChat(bot, 'rare_random', { cooldownMs: BOT_RARE_CHAT_COOLDOWN_MS, visibleMs: 1500 });
      }
    }
  }

  private resolveTankOwner(source: Entity | null | undefined): Tank | null {
    if (!source) return null;
    if (source.type === EntityType.PLAYER || source.type === EntityType.ENEMY || source.type === EntityType.ELITE_TANK) return source as Tank;
    if (source.type === EntityType.BULLET) {
      const ownerId = (source as Bullet).ownerId;
      const owner = this.entities.find((entity) => entity.id === ownerId);
      return owner && (owner.type === EntityType.PLAYER || owner.type === EntityType.ENEMY || owner.type === EntityType.ELITE_TANK) ? owner as Tank : null;
    }
    if (source.type === EntityType.DRONE || source.type === EntityType.MINI_TANK) {
      const owner = (source as Drone | MiniTank).owner;
      return owner && (owner.type === EntityType.PLAYER || owner.type === EntityType.ENEMY || owner.type === EntityType.ELITE_TANK) ? owner : null;
    }
    return null;
  }

  private rememberPlayerKiller(killer: Entity | null): void {
    const killerTank = this.resolveTankOwner(killer);
    this.playerDeathKillerRef = {
      killerEntityId: killer?.id ?? null,
      killerSpectateTargetId: killerTank?.id ?? null,
      fallbackName: killerTank?.name || killer?.name || 'Unknown',
      fallbackTeam: killerTank?.team ?? killer?.team ?? Team.NONE,
      fallbackClassType: killerTank?.classType ?? null,
      fallbackLevel: killerTank?.level ?? null,
    };
  }

  private getDeathKillerSnapshot(): DeathKillerSnapshot | null {
    if (!this.player.isDead || !this.playerDeathKillerRef) return null;

    const ref = this.playerDeathKillerRef;
    const trackedId = ref.killerSpectateTargetId ?? ref.killerEntityId;
    const entity = trackedId === null ? null : this.entities.find((candidate) => candidate.id === trackedId) ?? null;
    const tankLike = entity instanceof Tank ? entity : null;
    const canSpectate = !!tankLike && tankLike.isBot && !tankLike.isDead;

    return {
      entityId: entity?.id ?? ref.killerEntityId,
      spectateTargetId: canSpectate ? tankLike!.id : null,
      name: tankLike?.name || entity?.name || ref.fallbackName,
      classType: tankLike?.classType ?? ref.fallbackClassType,
      team: tankLike?.team ?? entity?.team ?? ref.fallbackTeam,
      level: tankLike?.level ?? ref.fallbackLevel,
      score: tankLike?.score ?? null,
      health: tankLike?.displayHealth ?? tankLike?.health ?? null,
      maxHealth: tankLike?.maxHealth ?? null,
      shield: tankLike?.shield ?? null,
      maxShield: tankLike?.maxShield ?? null,
      isBot: !!tankLike?.isBot,
      isAlive: !!entity && !entity.isDead,
      canSpectate,
    };
  }

  private beginPlayerDeathPresentation(killer: Entity | null): void {
    const killerTank = this.resolveTankOwner(killer);
    this.rememberPlayerKiller(killer);
    const killerIsBot = !!killerTank && killerTank.isBot;
    const killerIsEliteStyle = !!killerTank && (killerTank.isTransformed || this.isBossClass(killerTank.classType));
    const canTaunt =
      killerIsBot &&
      this.elapsedMs >= this.botDeathTauntGlobalCooldownUntil &&
      Math.random() < (killerIsEliteStyle ? 0.35 : 0.2);

    if (killerTank && canTaunt) {
      const bubbleId = this.queueBotChat(killerTank, 'death_taunt', {
        cooldownMs: Math.max(BOT_DEATH_TAUNT_GLOBAL_COOLDOWN_MS, BOT_CHAT_BASE_COOLDOWN_MS),
        typingMs: BOT_DEATH_TAUNT_TYPING_MS,
        visibleMs: BOT_DEATH_TAUNT_VISIBLE_MS,
        persistAfterDeath: true,
      });
      if (!bubbleId) {
        this.playerDeathPresentation = {
          mode: 'instant',
          startedAt: this.elapsedMs,
          overlayAt: this.elapsedMs,
          completeAt: this.elapsedMs,
          fadeSeconds: 0.18,
          killerBotId: killerTank.id,
          killerEntityId: killer?.id ?? killerTank.id,
          killerSpectateTargetId: killerTank.id,
        };
        return;
      }
      this.botDeathTauntGlobalCooldownUntil = this.elapsedMs + BOT_DEATH_TAUNT_GLOBAL_COOLDOWN_MS;
      this.playerDeathPresentation = {
        mode: 'taunt',
        startedAt: this.elapsedMs,
        overlayAt: this.elapsedMs + BOT_DEATH_TAUNT_DELAY_MS - BOT_DEATH_TAUNT_FADE_MS,
        completeAt: this.elapsedMs + BOT_DEATH_TAUNT_DELAY_MS,
        fadeSeconds: BOT_DEATH_TAUNT_FADE_MS / 1000,
        killerBotId: killerTank.id,
        killerEntityId: killer?.id ?? killerTank.id,
        killerSpectateTargetId: killerTank.id,
      };
      return;
    }

    this.playerDeathPresentation = {
      mode: 'instant',
      startedAt: this.elapsedMs,
      overlayAt: this.elapsedMs,
      completeAt: this.elapsedMs,
      fadeSeconds: 0.18,
      killerBotId: killerTank?.id ?? null,
      killerEntityId: killer?.id ?? null,
      killerSpectateTargetId: killerTank?.id ?? null,
    };
  }

  private getDeathPresentationState(): DeathPresentationState | undefined {
    if (!this.player.isDead || !this.playerDeathPresentation) return undefined;
    const delayRemainingMs = Math.max(0, this.playerDeathPresentation.completeAt - this.elapsedMs);
    const fadeWindow = Math.max(1, this.playerDeathPresentation.completeAt - this.playerDeathPresentation.overlayAt);
    const fadeProgress = this.playerDeathPresentation.mode === 'instant'
      ? 1
      : Math.max(0, Math.min(1, (this.elapsedMs - this.playerDeathPresentation.overlayAt) / fadeWindow));

    return {
      mode: this.playerDeathPresentation.mode,
      delayActive: this.playerDeathPresentation.mode === 'taunt' && delayRemainingMs > 0,
      cardVisible: this.playerDeathPresentation.mode === 'instant' || this.elapsedMs >= this.playerDeathPresentation.completeAt,
      fadeProgress,
      dimOpacity: this.playerDeathPresentation.mode === 'taunt' ? 0.18 + fadeProgress * 0.52 : 0.7,
      blurPx: this.playerDeathPresentation.mode === 'taunt' ? fadeProgress * 12 : 12,
      delayRemainingMs,
      killerBotId: this.playerDeathPresentation.killerBotId,
    };
  }

  private getSpawnPos(team: Team): Vector2 {
    const rect = this.getSafeZoneRect(team);
    if (rect) {
        return {
            x: Vector.randomRange(rect.x + 100, rect.x + rect.w - 100),
            y: Vector.randomRange(rect.y + 100, rect.y + rect.h - 100)
        };
    }
    return Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  private getRefinedBotName(team: Team): string {
      const clean = (value: string): string =>
          String(value || '')
              .replace(/[_]+/g, ' ')
              .replace(/[^A-Za-z0-9 ]+/g, '')
              .trim()
              .replace(/\s{2,}/g, ' ');

      const activeNames = new Set(
          this.entities
              .filter((e) => (e.type === EntityType.ENEMY || e.type === EntityType.PLAYER) && !e.isDead)
              .map((e) => clean((e as Tank).name).toLowerCase())
      );

      const pool = BOT_NAMES.map((name) => clean(stripInjectedTeamPrefix(name))).filter((n) => n.length > 0);
      let base = pool[Math.floor(Math.random() * pool.length)] || 'Vextor Unit';

      if (!activeNames.has(base.toLowerCase())) return base;

      for (let i = 2; i <= 99; i++) {
          const candidate = `${base} ${i}`;
          if (!activeNames.has(candidate.toLowerCase())) return candidate;
      }

      return `${base} ${Math.floor(Math.random() * 900 + 100)}`;
  }

  spawnEnemy() {
      let pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT), team = Team.RED;
      if (this.gameMode === GameMode.TEAMS || this.gameMode === GameMode.DOMINION) {
          const teams = this.gameMode === GameMode.DOMINION ? PLAYABLE_TEAMS : [Team.BLUE, Team.RED];
          const counts = teams.map((activeTeam) => ({
              team: activeTeam,
              count: this.entities.filter(e => (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) && e.team === activeTeam).length
          })).sort((a, b) => a.count - b.count);
          const chosen = counts[0];
          if (!chosen || chosen.count >= 40) return;
          team = chosen.team;
          pos = this.getSpawnPos(team);
          pos.x += Vector.randomRange(-150, 150);
          pos.y += Vector.randomRange(-150, 150);
      }
      
      const bot = new Tank(this.nextId(), pos.x, pos.y, false, team);
      bot.name = this.getRefinedBotName(team);
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
    const shapePopulationLimit = this.getShapePopulationLimit();
    if (this.currentShapeCount >= shapePopulationLimit) return;
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }, nestRadius = 1500, isNestSpawn = Math.random() < 0.2; 
    let pos: Vector2, type: ShapeType;
    let spawnInNestCore = false;
    let nestClusterSpawn = false;
    if (this.inVoid) {
        pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
        const roll = Math.random();
        if (roll < 0.002) type = ShapeType.DODECAGON;
        else if (roll < 0.006) type = ShapeType.DECAGON;
        else if (roll < 0.014) type = ShapeType.NONAGON;
        else if (roll < 0.034) type = ShapeType.OCTAGON; 
        else if (roll < 0.07) type = ShapeType.HEXAGON; 
        else if (roll < 0.12) type = ShapeType.HEPTAGON;
        else if (roll < 0.2) type = ShapeType.PENTAGON;
        else if (roll < 0.36) type = ShapeType.STAR;
        else if (roll < 0.66) type = ShapeType.TRIANGLE; 
        else if (roll < 0.84) type = ShapeType.DIAMOND;
        else type = ShapeType.SQUARE;
    } else if (this.gameMode !== GameMode.SANDBOX) {
        const zoneIndex = this.pickSpawnZoneIndex();
        const useNestCluster =
          this.gameMode === GameMode.TEAMS &&
          this.isPentagonNestZone(zoneIndex) &&
          Math.random() < 0.72;
        spawnInNestCore = this.gameMode === GameMode.TEAMS && this.isPentagonNestZone(zoneIndex);
        nestClusterSpawn = useNestCluster;
        pos = useNestCluster ? this.getPentagonNestSpawnPosition() : this.getSpawnPositionInZone(zoneIndex);
        type = this.pickShapeTypeForSpawn(zoneIndex);
        this.recentSpawnZoneHistory.push(zoneIndex);
        if (this.recentSpawnZoneHistory.length > 6) this.recentSpawnZoneHistory.shift();
    } else if (isNestSpawn) {
        spawnInNestCore = true;
        nestClusterSpawn = true;
        const angle = Math.random() * Math.PI * 2, dist = Math.sqrt(Math.random()) * nestRadius;
        pos = { x: center.x + Math.cos(angle) * dist, y: center.y + Math.sin(angle) * dist };
        const roll = Math.random();
        if (roll < 0.0015) type = ShapeType.DODECAGON;
        else if (roll < 0.005) type = ShapeType.DECAGON;
        else if (roll < 0.013) type = ShapeType.NONAGON;
        else if (roll < 0.035) type = ShapeType.OCTAGON; 
        else if (roll < 0.08) type = ShapeType.HEXAGON; 
        else if (roll < 0.145) type = ShapeType.HEPTAGON;
        else if (roll < 0.285) type = ShapeType.PENTAGON;
        else if (roll < 0.45) type = ShapeType.STAR;
        else if (roll < 0.75) type = ShapeType.TRIANGLE;
        else if (roll < 0.89) type = ShapeType.DIAMOND;
        else type = ShapeType.SQUARE;
    } else {
        pos = Vector.randomPos(CANVAS_WIDTH, CANVAS_HEIGHT);
        const roll = Math.random();
        if (roll < 0.00006) type = ShapeType.DODECAGON;
        else if (roll < 0.00024) type = ShapeType.DECAGON;
        else if (roll < 0.0007) type = ShapeType.NONAGON;
        else if (roll < 0.0024) type = ShapeType.OCTAGON; 
        else if (roll < 0.0092) type = ShapeType.HEXAGON; 
        else if (roll < 0.0175) type = ShapeType.HEPTAGON;
        else if (roll < 0.035) type = ShapeType.PENTAGON;
        else if (roll < 0.15) type = ShapeType.STAR;
        else if (roll < 0.49) type = ShapeType.TRIANGLE; 
        else if (roll < 0.68) type = ShapeType.DIAMOND;
        else type = ShapeType.SQUARE;
    }

    if (this.gameMode === GameMode.SANDBOX && this.sandboxConfig) {
        if (!this.sandboxConfig.enabledShapes[type]) return;
    }

    // Density Check: Don't spawn if too many shapes are already nearby
    const nearby = this.entities.filter(e => e.type === EntityType.SHAPE && Vector.dist(e.pos, pos) < 120);
    const densityLimit = (this.gameMode === GameMode.SANDBOX && this.sandboxConfig) ? this.sandboxConfig.shapeSpawnRate * 3 : 2;
    if (nearby.length > densityLimit) return;

    if (Vector.dist(pos, this.player.pos) < (this.gameMode === GameMode.TEAMS ? 560 : 500)) return;
    if (Number.isFinite(shapePopulationLimit)) {
        const sectorW = CANVAS_WIDTH / 3;
        const sectorH = CANVAS_HEIGHT / 3;
        const sectorX = Math.max(0, Math.min(2, Math.floor(pos.x / sectorW)));
        const sectorY = Math.max(0, Math.min(2, Math.floor(pos.y / sectorH)));
        const sectorShapeCap = Math.ceil((shapePopulationLimit / 9) * 1.28);
        let sectorShapes = 0;
        for (const e of this.entities) {
            if (e.type !== EntityType.SHAPE) continue;
            if (Math.floor(e.pos.x / sectorW) === sectorX && Math.floor(e.pos.y / sectorH) === sectorY) sectorShapes++;
        }
        if (sectorShapes >= sectorShapeCap) return;
    }
    const shouldSpawnAlphaPentagon =
        !this.inVoid &&
        type === ShapeType.PENTAGON &&
        (
            (nestClusterSpawn && Math.random() < 0.13) ||
            (spawnInNestCore && Math.random() < 0.07)
        );
    const forcedRarity = shouldSpawnAlphaPentagon ? ShapeRarity.LEGENDARY : undefined;
    const shape = new Shape(this.nextId(), pos.x, pos.y, type, this.inVoid, forcedRarity);
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
        const isLargeRebirthCollider =
          ((a.type === EntityType.BULLET && ((a as Bullet).isHighDensityOrb || this.isRebirthProjectileOwner(a))) ||
           a.radius >= this.spatialGrid.cellSize * 0.8);
        const neighborRadius = isLargeRebirthCollider
          ? Math.max(this.spatialGrid.cellSize * 1.6, a.radius * 2.6)
          : this.spatialGrid.cellSize;
        const neighbors = isLargeRebirthCollider
          ? this.spatialGrid.getNeighborsInRadius(a, neighborRadius, this.collisionNeighborBuffer)
          : this.spatialGrid.getNeighbors(a, this.collisionNeighborBuffer);
        for (let j = 0; j < neighbors.length; j++) {
            const b = neighbors[j];
            if (a === b || b.isDead) continue;
            const minDist = a.radius + b.radius;
            const d2 = (a.pos.x - b.pos.x) ** 2 + (a.pos.y - b.pos.y) ** 2;
            if (d2 < minDist * minDist) {
                if (a.type === EntityType.VOID_PORTAL || b.type === EntityType.VOID_PORTAL) {
                    const portal = (a.type === EntityType.VOID_PORTAL ? a : b) as VoidPortal, other = (a.type === EntityType.VOID_PORTAL ? b : a);
                    if (other.type === EntityType.PLAYER || other.type === EntityType.ENEMY) {
                        const toPortal = Vector.sub(portal.pos, other.pos);
                        const distToCenter = Math.max(0.0001, Vector.mag(toPortal));
                        const dirToCenter = Vector.normalize(toPortal);
                        const playerInside = other.id === this.player.id;
                        if (portal.isExit) {
                            other.vel = Vector.add(other.vel, Vector.mult(dirToCenter, 2.2));
                            if (distToCenter < portal.radius * 0.58 && this.inVoid) {
                                const occKey = `${portal.id}:${other.id}`;
                                const occMs = (this.portalCoreOccupancyMs.get(occKey) || 0) + (this.fixedSimulationStep * 1000);
                                this.portalCoreOccupancyMs.set(occKey, occMs);
                                if (playerInside && !this.pendingDimensionTransition) {
                                    const stage = occMs < 170 ? 'LOCK' : 'EXTRACT';
                                    this.setPlayerPortalStage(stage, occMs / 360);
                                }
                                if (occMs >= 170) {
                                    this.notifyPortalStage(portal, 'EXTRACT');
                                }
                                if (occMs >= 360) {
                                    const evacIds = this.entities
                                      .filter(e =>
                                        !e.isDead &&
                                        (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) &&
                                        Vector.dist(e.pos, portal.pos) < portal.radius * 1.22
                                      )
                                      .map(e => e.id);
                                    if (evacIds.includes(this.player.id)) {
                                        this.transitionToDimension(false, evacIds);
                                    }
                                }
                            } else {
                                const occKey = `${portal.id}:${other.id}`;
                                const decayed = Math.max(0, (this.portalCoreOccupancyMs.get(occKey) || 0) - this.fixedSimulationStep * 1000 * 3.2);
                                if (decayed <= 0) this.portalCoreOccupancyMs.delete(occKey);
                                else this.portalCoreOccupancyMs.set(occKey, decayed);
                            }
                        } else {
                            const blackHole = portal.phase === 'BLACK_HOLE';
                            const whiteHole = portal.phase === 'WHITE_HOLE' || portal.phase === 'EXPANDING';
                            const outerRadius = portal.radius * (whiteHole ? 2.35 : 3.12);
                            const coreRadius = portal.radius * 0.62;
                            if (distToCenter < outerRadius) {
                                // Wormhole gravity model: proportional, directional inverse-distance pull.
                                // Soft at perimeter, progressively stronger near the core, but still escapable.
                                const normDist = Math.max(0.16, distToCenter / Math.max(outerRadius, 1));
                                const inverseSquare = 1 / (normDist * normDist);
                                const radialWeight = Math.max(0, 1 - (distToCenter / outerRadius));
                                const inwardForce = Math.min(1.22, (0.03 + inverseSquare * 0.042) * (0.45 + radialWeight * 0.95));
                                const whiteHolePull = Math.min(1.5, inwardForce * 1.24 + radialWeight * 0.18);
                                const force = blackHole ? inwardForce : whiteHolePull;
                                other.vel = Vector.add(other.vel, Vector.mult(dirToCenter, force));
                                if (blackHole && Math.random() < (0.08 + radialWeight * 0.2)) {
                                    const ringJitter = (Math.random() - 0.5) * Math.PI * 0.35;
                                    const spawnAngle = Math.atan2(other.pos.y - portal.pos.y, other.pos.x - portal.pos.x) + ringJitter;
                                    const spawnR = Math.max(portal.radius * 0.75, distToCenter + Vector.randomRange(-14, 8));
                                    const px = portal.pos.x + Math.cos(spawnAngle) * spawnR;
                                    const py = portal.pos.y + Math.sin(spawnAngle) * spawnR;
                                    const pullFx = new Particle(px, py, 'rgba(240, 248, 255, 0.42)', 2 + Math.random() * 2.2, 14 + Math.random() * 10, 'GAS');
                                    pullFx.vel = Vector.mult(dirToCenter, 1.1 + radialWeight * 2.4);
                                    this.particles.push(pullFx);
                                }
                            }
                            if (distToCenter < coreRadius) {
                                const occKey = `${portal.id}:${other.id}`;
                                const occMs = (this.portalCoreOccupancyMs.get(occKey) || 0) + (this.fixedSimulationStep * 1000);
                                this.portalCoreOccupancyMs.set(occKey, occMs);
                                if (playerInside && !this.pendingDimensionTransition) {
                                    const stage: VoidTransitStage =
                                        occMs < 180 ? 'LOCK' :
                                        occMs < 360 ? 'INVERT' :
                                        occMs < 580 ? 'BREACH' :
                                        'SHIFT';
                                    this.setPlayerPortalStage(stage, occMs / 580);
                                }
                                if (occMs >= 180) {
                                    this.notifyPortalStage(portal, 'LOCK');
                                }
                                if (occMs >= 360 && portal.phase === 'BLACK_HOLE') {
                                    portal.phase = 'WHITE_HOLE';
                                    portal.phaseTimerSec = Math.max(portal.phaseTimerSec, 60);
                                    this.particles.push(new Particle(portal.pos.x, portal.pos.y, 'rgba(210,245,255,0.85)', portal.radius * 0.9, 28, 'RING'));
                                    this.notifyPortalStage(portal, 'INVERT');
                                }
                                if (portal.phase !== 'BLACK_HOLE' && occMs >= 560) {
                                    let set = this.portalTransitQueuedIds.get(portal.id);
                                    if (!set) {
                                        set = new Set<number>();
                                        this.portalTransitQueuedIds.set(portal.id, set);
                                    }
                                    set.add(other.id);
                                    const neighborCombatants = this.entities.filter(e =>
                                      (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) &&
                                      !e.isDead &&
                                      Vector.dist(e.pos, portal.pos) < portal.radius * 1.1
                                    );
                                    for (const e of neighborCombatants) set.add(e.id);
                                    if (!this.isTransitioning && set.size > 0 && set.has(this.player.id)) {
                                        this.notifyPortalStage(portal, 'BREACH');
                                        if (!portal.collapseTriggered) {
                                            portal.collapseTriggered = true;
                                            for (let burst = 0; burst < 42; burst++) {
                                                const ang = (burst / 42) * Math.PI * 2 + Math.random() * 0.2;
                                                const p = new Particle(portal.pos.x, portal.pos.y, 'rgba(245, 252, 255, 0.9)', 3 + Math.random() * 3.5, 18 + Math.random() * 16, 'GAS');
                                                p.vel = { x: Math.cos(ang) * (2 + Math.random() * 4), y: Math.sin(ang) * (2 + Math.random() * 4) };
                                                this.particles.push(p);
                                            }
                                            this.particles.push(new Particle(portal.pos.x, portal.pos.y, 'rgba(255,255,255,0.95)', portal.radius * 1.4, 30, 'RING'));
                                            portal.isDead = true;
                                            this.addNotification("WORMHOLE COLLAPSE", "#e6f7ff");
                                        }
                                        this.transitionToDimension(true, [...set]);
                                    }
                                }
                            } else {
                                const occKey = `${portal.id}:${other.id}`;
                                const decayed = Math.max(0, (this.portalCoreOccupancyMs.get(occKey) || 0) - this.fixedSimulationStep * 1000 * 2.8);
                                if (decayed <= 0) this.portalCoreOccupancyMs.delete(occKey);
                                else this.portalCoreOccupancyMs.set(occKey, decayed);
                            }
                        }
                    }
                    continue; 
                }
                if ((this.gameMode === GameMode.TEAMS || this.gameMode === GameMode.DOMINION) && a.team === b.team && a.team !== Team.NONE && !this.inVoid) {
                    // Ignore collisions between teammates and teammate bullets/drones/minitanks
                    const aIsProjectile = a.type === EntityType.BULLET || a.type === EntityType.DRONE || a.type === EntityType.MINI_TANK || a.type === EntityType.BASE_DEFENSE_DRONE;
                    const bIsProjectile = b.type === EntityType.BULLET || b.type === EntityType.DRONE || b.type === EntityType.MINI_TANK || b.type === EntityType.BASE_DEFENSE_DRONE;
                    
                    if (aIsProjectile || bIsProjectile) continue; // Pass right through teammate projectiles
                    
                    // Teammate tanks bump into each other but don't deal damage
                     this.resolveCollision(a, b, false);
                     continue;
                 }

                if (a.type === EntityType.SHAPE && b.type === EntityType.SHAPE) {
                    // Shapes still push off each other so they do not stack, but they no longer damage one another by bumping.
                    this.resolveCollision(a, b, false);
                    continue;
                }
                 
                if (a.type === EntityType.BULLET && (a as Bullet).ownerId === b.id) continue;
                if (b.type === EntityType.BULLET && (b as Bullet).ownerId === a.id) continue;
                 
                const aIsSummon = a.type === EntityType.DRONE || a.type === EntityType.MINI_TANK;
                const bIsSummon = b.type === EntityType.DRONE || b.type === EntityType.MINI_TANK;
                const aIsBullet = a.type === EntityType.BULLET;
                const bIsBullet = b.type === EntityType.BULLET;

                if (aIsSummon && bIsSummon) {
                    const ownerA = (a as Drone | MiniTank).owner;
                    const ownerB = (b as Drone | MiniTank).owner;
                    if (ownerA.id === ownerB.id) continue;
                }

                // Let a tank's own bullets pass through its own drones/minitanks.
                // This fixes Hybrid destroyer shells getting clipped by Hybrid support drones.
                if (aIsBullet && bIsSummon && (a as Bullet).ownerId === (b as Drone | MiniTank).owner.id) continue;
                if (bIsBullet && aIsSummon && (b as Bullet).ownerId === (a as Drone | MiniTank).owner.id) continue;
                 
                if (aIsSummon && b.id === (a as Drone | MiniTank).owner.id) continue;
                if (bIsSummon && a.id === (b as Drone | MiniTank).owner.id) continue;

                this.resolveCollision(a, b, true);
            }
        }
    }
  }

  resolveCollision(a: Entity, b: Entity, applyDamage: boolean = true) {
     const friendlyBulletPair = a.type === EntityType.BULLET && b.type === EntityType.BULLET &&
        (((a as Bullet).ownerId === (b as Bullet).ownerId) ||
         (((a as Bullet).team !== Team.NONE) && (a as Bullet).team === (b as Bullet).team));
     if (friendlyBulletPair) return;
     const dir = Vector.normalize(Vector.sub(a.pos, b.pos)), distVal = Vector.dist(a.pos, b.pos), overlap = (a.radius + b.radius) - distVal;
     const aIsShape = a.type === EntityType.SHAPE;
     const bIsShape = b.type === EntityType.SHAPE;
     const aIsProjectileLike = a.type === EntityType.BULLET || a.type === EntityType.DRONE || a.type === EntityType.MINI_TANK;
     const bIsProjectileLike = b.type === EntityType.BULLET || b.type === EntityType.DRONE || b.type === EntityType.MINI_TANK;
     const passThroughShapeCollision = (aIsProjectileLike && bIsShape) || (bIsProjectileLike && aIsShape);
     let ratioA = 0.5, ratioB = 0.5, pcf = 1.0; 
     if (a.type === EntityType.BULLET || b.type === EntityType.BULLET) pcf = 0.05; 
     if (a.type === EntityType.DRONE || b.type === EntityType.DRONE || a.type === EntityType.MINI_TANK || b.type === EntityType.MINI_TANK) pcf = 0.2;
     if (passThroughShapeCollision) {
         ratioA = 0;
         ratioB = 0;
         pcf = 0;
     }
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
          let dmg = baseDmg;
          const killerTankOwner = this.resolveTankOwner(killer);
          const killerIsRebirthBossSource =
              !!killerTankOwner &&
              killerTankOwner.isTransformed &&
              this.isBossClass(killerTankOwner.classType);
          if (victim.type === EntityType.DRONE || victim.type === EntityType.MINI_TANK) {
              const victimOwnerId = (victim as Drone | MiniTank).owner.id;
              const killerOwnerId = resolveOwnerId(killer);
              // Hard self-origin protection: no damage, no hit feedback, no rewards.
              if (killerOwnerId !== null && killerOwnerId === victimOwnerId) return 0;
          }

          if (victim.type === EntityType.BULLET && killer.type === EntityType.BULLET) {
              if ((victim as Bullet).ownerId === (killer as Bullet).ownerId) return 0;
              if ((victim as Bullet).isHighDensityOrb && !(killer as Bullet).isHighDensityOrb) return dmg * 0.12;
              if ((killer as Bullet).isHighDensityOrb && !(victim as Bullet).isHighDensityOrb) return dmg * 2.5;
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
            return isAllowedKiller ? dmg : 0;
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

          if ((victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY) && killerIsRebirthBossSource) {
              const perHitCap =
                  killer.type === EntityType.BULLET ? victim.maxHealth * 0.38 :
                  (killer.type === EntityType.DRONE || killer.type === EntityType.MINI_TANK) ? victim.maxHealth * 0.24 :
                  victim.maxHealth * 0.18;
              dmg = Math.min(dmg, perHitCap);
          }

          // Dynamic projectile durability scaling against massive entities.
          if (killer.type === EntityType.BULLET && (victim.type === EntityType.SHAPE || victim.type === EntityType.BOSS || victim.type === EntityType.CRASHER)) {
              const bullet = killer as Bullet;
              const highMass = victim.maxHealth >= 180;
              if (highMass) {
                  const durabilityFactor = Math.min(1.0, bullet.health / Math.max(1, bullet.maxHealth));
                 const massFactor = Math.min(0.65, Math.max(0, (victim.maxHealth - 180) / 900));
                  dmg *= 1 + massFactor + durabilityFactor * 0.3;
              }
          }

          if (killer.type === EntityType.BULLET && (killer as Bullet).bulletType === 'TRAP') {
              const trap = killer as Bullet;
              const anchoredBonus = trap.trapAnchored ? 1.14 : 1.0;
              if (victim.type === EntityType.SHAPE) return dmg * 1.75 * anchoredBonus;
              if (victim.type === EntityType.CRASHER) return dmg * 1.45 * anchoredBonus;
              if (victim.type === EntityType.BOSS || victim.type === EntityType.GUARDIAN) return dmg * 1.18 * anchoredBonus;
              if (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY || victim.type === EntityType.ELITE_TANK) return dmg * 1.08 * anchoredBonus;
          }

         if (killer.type === EntityType.BULLET && (killer as Bullet).bulletType === 'HEAL') {
             const healBullet = killer as Bullet;
             // Healing rounds cannot harm allies, but they can still chip hostile/core PvE targets.
             if ((victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY) && victim.team === healBullet.team) return 0;
             // Keep support identity: reduced hostile damage coefficients.
             if (victim.type === EntityType.SHAPE || victim.type === EntityType.CRASHER || victim.type === EntityType.BOSS) return dmg * 0.75;
             if (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY || victim.type === EntityType.ELITE_TANK || victim.type === EntityType.GUARDIAN) return dmg * 0.45;
          }
          return dmg;
      };

      dmgA = filterDamage(a, b, dmgA);
      dmgB = filterDamage(b, a, dmgB);

      const applyPenetrationPassThrough = (
          attacker: Entity,
          victim: Entity,
          incomingToAttacker: number,
          outgoingToVictim: number
      ): { attackerIncoming: number; victimOutgoing: number } => {
          if (victim.type !== EntityType.SHAPE) {
              return { attackerIncoming: incomingToAttacker, victimOutgoing: outgoingToVictim };
          }

          let owner: Tank | null = null;
          if (attacker.type === EntityType.BULLET) {
              const maybeOwner = this.entities.find((e) => e.id === (attacker as Bullet).ownerId);
              owner = maybeOwner instanceof Tank ? maybeOwner : null;
          } else if (attacker.type === EntityType.DRONE || attacker.type === EntityType.MINI_TANK) {
              owner = (attacker as Drone | MiniTank).owner;
          }
          if (!(owner instanceof Tank)) {
              return { attackerIncoming: incomingToAttacker, victimOutgoing: outgoingToVictim };
          }

          const penStat = Math.max(0, owner.stats[StatType.BULLET_PENETRATION] || 0);
          const durabilityRatio = Math.min(1.25, Math.max(0.12, attacker.health / Math.max(1, attacker.maxHealth)));
          const sizeFactor = Math.min(1, Math.max(0, (attacker.radius - 5.5) / 10.5));
          const shapeResistance = Math.min(0.4, Math.max(0, (victim.maxHealth - 18) / 220));
          const sandboxBonus = this.gameMode === GameMode.SANDBOX
              ? Math.max(0, ((this.sandboxConfig.projectileDurabilityScale || 1) - 1) * 0.06)
              : 0;

          let classBias = 0;
          if (owner.classType === TankClass.DESTROYER || owner.classType === TankClass.ANNIHILATOR) classBias = 0.08;
          else if (owner.classType === TankClass.HYBRID) classBias = 0.06;
          else if (owner.classType === TankClass.OVERSEER || owner.classType === TankClass.OVERLORD || owner.classType === TankClass.MANAGER) classBias = 0.075;
          else if (attacker.type === EntityType.BULLET && (attacker as Bullet).bulletType === 'TRAP') classBias = 0.11;
          else if (owner.classType === TankClass.SPREAD_SHOT || owner.classType === TankClass.PENTA_SHOT) classBias = 0.035;

          const passThrough = Math.min(0.74, Math.max(
              0.18,
              0.2 + penStat * 0.028 + sizeFactor * 0.11 + durabilityRatio * 0.16 + classBias + sandboxBonus - shapeResistance
          ));
          const victimBoost = Math.min(
              0.18,
              Math.max(0.025, 0.02 + penStat * 0.008 + sizeFactor * 0.03 + durabilityRatio * 0.025 + classBias * 0.5 - shapeResistance * 0.12)
          );

          return {
              attackerIncoming: incomingToAttacker * (1 - passThrough),
              victimOutgoing: outgoingToVictim * (1 + victimBoost),
          };
      };

      if (aIsProjectileLike && !bIsProjectileLike) {
          const tuned = applyPenetrationPassThrough(a, b, dmgA, dmgB);
          dmgA = tuned.attackerIncoming;
          dmgB = tuned.victimOutgoing;
      } else if (bIsProjectileLike && !aIsProjectileLike) {
          const tuned = applyPenetrationPassThrough(b, a, dmgB, dmgA);
          dmgB = tuned.attackerIncoming;
          dmgA = tuned.victimOutgoing;
      }

      const isTankLikeBodyTarget = (entity: Entity) =>
          entity.type === EntityType.PLAYER ||
          entity.type === EntityType.ENEMY ||
          entity.type === EntityType.ELITE_TANK ||
          entity.type === EntityType.BOSS ||
          entity.type === EntityType.GUARDIAN;

      const getBodyDamageBias = (entity: Entity): number => {
          if (entity.type === EntityType.DRONE || entity.type === EntityType.MINI_TANK) return 0.58;
          if (entity.type === EntityType.SHAPE) return 0.9;
          if (entity.type === EntityType.CRASHER) return 1.0;
          if (entity.type === EntityType.BOSS || entity.type === EntityType.GUARDIAN) return 0.94;
          if (entity.type !== EntityType.PLAYER && entity.type !== EntityType.ENEMY && entity.type !== EntityType.ELITE_TANK) return 0.82;

          const tank = entity as Tank;
          if (tank.classType === TankClass.TRI_ANGLE || tank.classType === TankClass.BOOSTER || tank.classType === TankClass.FIGHTER) return 1.02;
          if (tank.classType === TankClass.PACIFIST_TRAINEE || tank.classType === TankClass.NURSE || tank.classType === TankClass.DOCTOR || tank.classType === TankClass.PLAGUE_DOCTOR) return 0.72;
          if (tank.classType === TankClass.DRAINER_TRAINEE || tank.classType === TankClass.LEECH || tank.classType === TankClass.VAMPIRE || tank.classType === TankClass.REAPER) return 0.9;
          return 1.0;
      };

      const getBodyDamageCap = (attacker: Entity, victim: Entity): number => {
          let cap =
              victim.type === EntityType.BOSS || victim.type === EntityType.GUARDIAN ? victim.maxHealth * 0.0024 :
              victim.type === EntityType.ELITE_TANK ? victim.maxHealth * 0.045 :
              victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY ? victim.maxHealth * 0.1 :
              victim.type === EntityType.CRASHER ? victim.maxHealth * 0.12 :
              victim.type === EntityType.SHAPE ? victim.maxHealth * 0.18 :
              victim.maxHealth * 0.12;

          if (attacker.type === EntityType.PLAYER && this.sandboxConfig.invincible && isTankLikeBodyTarget(victim)) {
              cap = Math.min(cap, victim.maxHealth * (victim.type === EntityType.BOSS || victim.type === EntityType.GUARDIAN ? 0.0015 : 0.035));
          }

          if (attacker.type === EntityType.PLAYER || attacker.type === EntityType.ENEMY || attacker.type === EntityType.ELITE_TANK) {
              const tank = attacker as Tank;
              if (isRamClass(tank) && isTankLikeBodyTarget(victim)) {
                  const ramCap =
                      victim.type === EntityType.BOSS || victim.type === EntityType.GUARDIAN ? victim.maxHealth * 0.002 :
                      victim.type === EntityType.ELITE_TANK ? victim.maxHealth * 0.03 :
                      victim.maxHealth * 0.085;
                  cap = Math.min(cap, ramCap);
              }
          }

          return cap;
      };

      const computeBodyCollisionDamage = (attacker: Entity, victim: Entity, baseDamage: number, attackerSpeed: number, victimSpeed: number): number => {
          const speedFactor = Vector.clamp(0.24 + attackerSpeed * 0.085 + Math.max(0, attackerSpeed - victimSpeed) * 0.03, 0.28, 1.02);
          const massFactor = Vector.clamp(Math.pow(attacker.mass / Math.max(1, victim.mass), 0.24), 0.66, 1.12);
          const durabilityFactor = Vector.clamp(attacker.health / Math.max(1, attacker.maxHealth), 0.4, 1.0);
          const raw = baseDamage * 0.14 * speedFactor * massFactor * durabilityFactor * getBodyDamageBias(attacker);
          return Math.min(raw, getBodyDamageCap(attacker, victim));
      };

      const computeDroneCollisionDamage = (attacker: Drone, victim: Entity, baseDamage: number, attackerSpeed: number, victimSpeed: number): number => {
          const owner = attacker.owner;
          const penStat = Math.max(0, owner.stats[StatType.BULLET_PENETRATION] || 0);
          const dmgStat = Math.max(0, owner.stats[StatType.BULLET_DAMAGE] || 0);
          const speedStat = Math.max(0, owner.stats[StatType.BULLET_SPEED] || 0);
          const durabilityFactor = Vector.clamp(attacker.health / Math.max(1, attacker.maxHealth), 0.45, 1.05);
          const chaseFactor = Vector.clamp(0.9 + attackerSpeed * 0.05 + Math.max(0, attackerSpeed - victimSpeed) * 0.028, 0.82, 1.3);
          const statFactor = 1 + penStat * 0.04 + dmgStat * 0.025 + speedStat * 0.012;

          let scalar = 0.42;
          let cap = victim.maxHealth * 0.12;
          if (victim.type === EntityType.SHAPE) {
              scalar = 0.94;
              cap = victim.maxHealth * 0.32;
          } else if (victim.type === EntityType.CRASHER) {
              scalar = 0.7;
              cap = victim.maxHealth * 0.2;
          } else if (victim.type === EntityType.DRONE || victim.type === EntityType.MINI_TANK) {
              scalar = 0.48;
              cap = victim.maxHealth * 0.2;
          } else if (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY) {
              scalar = 0.36;
              cap = victim.maxHealth * 0.1;
          } else if (victim.type === EntityType.ELITE_TANK) {
              scalar = 0.3;
              cap = victim.maxHealth * 0.07;
          } else if (victim.type === EntityType.BOSS || victim.type === EntityType.GUARDIAN) {
              scalar = 0.18;
              cap = victim.maxHealth * 0.016;
          }

          const raw = baseDamage * scalar * chaseFactor * durabilityFactor * statFactor;
          return Math.min(raw, cap);
      };

      // Rework body collisions so they are bursty and readable instead of multi-frame deletion beams.
      if (a.type !== EntityType.BULLET && b.type !== EntityType.BULLET) {
          const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          const now = this.elapsedMs;
          const involvesHeavyContact =
              a.type === EntityType.BOSS ||
              b.type === EntityType.BOSS ||
              a.type === EntityType.GUARDIAN ||
              b.type === EntityType.GUARDIAN ||
              ((a.type === EntityType.PLAYER || a.type === EntityType.ENEMY || a.type === EntityType.ELITE_TANK) && isRamClass(a as Tank)) ||
              ((b.type === EntityType.PLAYER || b.type === EntityType.ENEMY || b.type === EntityType.ELITE_TANK) && isRamClass(b as Tank));
          const cooldownMs = involvesHeavyContact ? 180 : 120;
          const lastAt = this.recentBodyCollisionAt.get(pairKey) ?? -Infinity;
          const coolingDown = now - lastAt < cooldownMs;

          if (coolingDown) {
              dmgA = 0;
              dmgB = 0;
          } else {
              this.recentBodyCollisionAt.set(pairKey, now);
              if (this.recentBodyCollisionAt.size > 2500) {
                  for (const [key, stamp] of this.recentBodyCollisionAt) {
                      if (now - stamp > 1500) this.recentBodyCollisionAt.delete(key);
                  }
              }

              const bodyDmgToA = b.type === EntityType.DRONE
                  ? computeDroneCollisionDamage(b as Drone, a, dmgA, bSpeed, aSpeed)
                  : computeBodyCollisionDamage(b, a, dmgA, bSpeed, aSpeed);
              const bodyDmgToB = a.type === EntityType.DRONE
                  ? computeDroneCollisionDamage(a as Drone, b, dmgB, aSpeed, bSpeed)
                  : computeBodyCollisionDamage(a, b, dmgB, aSpeed, bSpeed);
              dmgA = bodyDmgToA;
              dmgB = bodyDmgToB;

              if (isRamClass(a) && aSpeed > 7.2) {
                  dmgB *= 1.02;
                  dmgA *= 1.01;
              }
              if (isRamClass(b) && bSpeed > 7.2) {
                  dmgA *= 1.02;
                  dmgB *= 1.01;
              }
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
                  this.awardDamageXpForVictim(owner, victim, bullet.damage, 0.15);
                  if (victim instanceof Tank) {
                    victim.markDrainingStatus(900);
                   if (owner.bloodPactActiveTimer > 0) {
                        victim.applyDrainDot(CLASS_ABILITY_CONFIG.blood.pactDrainDotStacks, CLASS_ABILITY_CONFIG.blood.decayStackDuration, owner.id);
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

      const aIsOrb = a.type === EntityType.BULLET && (a as Bullet).isHighDensityOrb;
      const bIsOrb = b.type === EntityType.BULLET && (b as Bullet).isHighDensityOrb;
      const bulletVsBullet = a.type === EntityType.BULLET && b.type === EntityType.BULLET;
      if (bulletVsBullet) {
         const aBullet = a as Bullet;
         const bBullet = b as Bullet;
         const sameOwner = aBullet.ownerId === bBullet.ownerId;
         const sameTeam = aBullet.team !== Team.NONE && aBullet.team === bBullet.team;
         // Friendly/self bullet pass-through: no collision resolution, no VFX, no deaths.
         if (sameOwner || sameTeam) return;
      }
      if (bulletVsBullet) {
         const impactSpeed = Vector.mag(a.vel) + Vector.mag(b.vel);
         if (impactSpeed > 9) {
            const clashPos = { x: (a.pos.x + b.pos.x) * 0.5, y: (a.pos.y + b.pos.y) * 0.5 };
            const ringScale = Math.min(22, 6 + impactSpeed * 0.85);
            this.particles.push(new Particle(clashPos.x, clashPos.y, 'rgba(255,245,220,0.68)', ringScale, 10, 'FLASH'));
            this.particles.push(new Particle(clashPos.x, clashPos.y, 'rgba(253,224,71,0.42)', ringScale * 1.35, 16, 'RING'));
            for (let i = 0; i < 6; i++) {
                const ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.35;
                const spark = new Particle(clashPos.x, clashPos.y, 'rgba(255,200,120,0.7)', 2 + Math.random() * 2, 10 + Math.random() * 8, 'FLASH');
                spark.vel = { x: Math.cos(ang) * (1.8 + Math.random() * 2.4), y: Math.sin(ang) * (1.8 + Math.random() * 2.4) };
                this.particles.push(spark);
            }
        }
      }
      if ((aIsOrb && b.type === EntityType.BULLET && !bIsOrb) || (bIsOrb && a.type === EntityType.BULLET && !aIsOrb)) {
         const orb = (aIsOrb ? a : b) as Bullet;
         const small = (aIsOrb ? b : a) as Bullet;
         const hostileInterception = orb.ownerId !== small.ownerId && (orb.team === Team.NONE || small.team === Team.NONE || orb.team !== small.team);
         if (!hostileInterception) return;
         const chip = Math.max(1, small.damage * 0.08);
         orb.takeDamage(chip, small.ownerId, false);
         small.isDead = true;
        const grindPos = { x: (orb.pos.x + small.pos.x) * 0.5, y: (orb.pos.y + small.pos.y) * 0.5 };
        if (this.isOnScreen(grindPos)) {
            this.particles.push(new Particle(grindPos.x, grindPos.y, 'rgba(216,180,254,0.46)', Math.max(4, small.radius * 0.45), 14, 'FLASH'));
            if (Math.random() < 0.35) this.particles.push(new Particle(grindPos.x, grindPos.y, 'rgba(125,211,252,0.28)', Math.max(8, small.radius), 12, 'RING'));
        }
        if (orb.isDead) this.handleDeath(orb, small);
        return;
     }

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

  private grantTemporaryBossOverride(tank: Tank, sourceBoss: Boss) {
      if (!tank || tank.isDead || tank.isBot) return;
      if (this.isBossClass(tank.classType)) return; // keep rebirth classes out of this reward path

      const durationSec = 75;
      const existing = tank.activeBuffs.find((b) => b.type === 'BOSS_OVERRIDE');
      if (existing) {
          existing.timeLeft = Math.max(existing.timeLeft, durationSec);
          existing.totalTime = Math.max(existing.totalTime, durationSec);
      } else {
          tank.activeBuffs.push({ type: 'BOSS_OVERRIDE', timeLeft: durationSec, totalTime: durationSec });
      }
      tank.updateStats();

      if (tank.id === this.player.id) {
          this.transformations++;
          this.addNotification(`${sourceBoss.name} CORE ABSORBED - BOSS OVERRIDE ${durationSec}s`, "#f472b6");
          this.sound.playRoar(this.getAudioSpatialOptions(tank.pos, true));
      }
  }

  handleDeath(victim: Entity, killer: Entity) {
      if (victim.type === EntityType.DUMMY) return; 

      if (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY || victim.type === EntityType.ELITE_TANK) {
          const victimTank = victim as Tank;
          for (let i = 0; i < this.entities.length; i++) {
              const e = this.entities[i];
              if ((e.type === EntityType.DRONE || e.type === EntityType.MINI_TANK) && (e as Drone | MiniTank).owner.id === victimTank.id) {
                  e.isDead = true;
                  e.shouldRemove = true;
              }
          }
          // Prevent stale AI/minion references after owner removal.
          for (let i = 0; i < this.entities.length; i++) {
              const e = this.entities[i];
              if ((e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.ELITE_TANK) && (e as Tank).aiTargetId === victimTank.id) {
                  (e as Tank).aiTargetId = null;
              }
          }
      }

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

      if (victim.type === EntityType.DOMINION_TANK) {
          this.handleDominionTankDefeat(victim as DominionTank);
          return;
      }

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
      if (victim.type === EntityType.BOSS) {
          const vBoss = victim as Boss;
          this.addNotification(`${vBoss.name} DESTROYED`, "#22d3ee");
          const isBossRushBoss = !!(vBoss as any).__bossRushBoss;
          let totalBossDamage = 0;
          vBoss.damageDealtBy.forEach((value) => { totalBossDamage += value; });

          if (totalBossDamage > 0 && !isBossRushBoss) {
              type BossDamageContributor = { tank: Tank; damage: number };
              let bestContributor: BossDamageContributor | null = null;

              // Do not use Map.forEach here.
              // TypeScript does not reliably narrow variables that are assigned inside callbacks,
              // so `bestContributor` can collapse to `never` after the callback.
              for (const [id, dmg] of vBoss.damageDealtBy.entries()) {
                  const tank = this.entities.find((entity): entity is Tank =>
                      entity instanceof Tank &&
                      entity.id === id &&
                      !entity.isDead &&
                      (
                          entity.type === EntityType.PLAYER ||
                          entity.type === EntityType.ENEMY ||
                          entity.type === EntityType.ELITE_TANK
                      )
                  );

                  if (!tank) continue;

                  if (bestContributor === null || dmg > bestContributor.damage) {
                      bestContributor = { tank, damage: dmg };
                  }
              }

              if (bestContributor !== null) {
                  const contributionRatio = bestContributor.damage / totalBossDamage;
                  if (contributionRatio >= 0.18 || bestContributor.tank.id === this.player.id || wasPlayerKill) {
                      this.grantTemporaryBossOverride(bestContributor.tank, vBoss);
                  }
              }
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

             if (
                killerOwner &&
                killerOwner.isBot &&
                victim.id !== killerOwner.id &&
                victim !== this.player &&
                !isFriendlySummonKill &&
                Math.random() < 0.04
             ) {
                this.queueBotChat(killerOwner, 'victory', { cooldownMs: BOT_RARE_CHAT_COOLDOWN_MS, visibleMs: 1200 });
             }
      }
      if (victim.type === EntityType.SHAPE || victim.type === EntityType.BOSS || victim.type === EntityType.CRASHER) {
          const v = victim as (Shape | Boss | Crasher);
          const totalXp = this.getObjectiveXpReward(v);
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
              victim.shouldRemove = true;
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
      if (killerTank && !isFriendlySummonKill && this.isXpEligibleVictim(victim)) {
          const xp = (victim.type === EntityType.ENEMY || victim.type === EntityType.PLAYER)
            ? this.getTankKillXpReward(victim as Tank, killerTank)
            : 10;
          this.awardXP(killerTank, xp);
          if (killerTank === this.player) this.spawnScoreText(victim.pos, xp);
      }
      victim.shouldRemove = true;
  }

  private resolveNonCollisionDeaths() {
      for (let i = 0; i < this.entities.length; i++) {
          const victim = this.entities[i];
          if (!victim || !victim.isDead || victim.shouldRemove) continue;
          const killer = this.resolveKillerForVictim(victim);
          this.handleDeath(victim, killer);
      }
  }

  private resolveKillerForVictim(victim: Entity): Entity {
      const sourceId = victim.lastDamageSourceId;
      if (sourceId !== null) {
          const source = this.entities.find(e => e.id === sourceId && !e.isDead);
          if (source) return source;
      }

      const damageMap = (victim as unknown as { damageDealtBy?: Map<number, number> }).damageDealtBy;
      if (damageMap && damageMap.size > 0) {
          let killerId: number | null = null;
          let best = -Infinity;
          damageMap.forEach((dmg, id) => {
              if (dmg > best) {
                  best = dmg;
                  killerId = id;
              }
          });
          if (killerId !== null) {
              const source = this.entities.find(e => e.id === killerId && !e.isDead);
              if (source) return source;
          }
      }
      return this.player;
  }

  addToKillFeed(k: string, v: string) { this.killFeed.unshift({ id: `${Date.now()}-${Math.random()}`, killerName: k, victimName: v, timestamp: Date.now() }); if (this.killFeed.length > 6) this.killFeed.pop(); }
  getLevelXp(l: number) { return Math.floor(100 * Math.pow(XP_CURVE_MULTIPLIER, l - 1)); }

  private shouldGrantStatPointAtLevel(level: number): boolean {
      return level > 1 && level <= 90 && level % 2 === 0;
  }

  private getStatPointBudgetForLevel(level: number): number {
      return Math.max(0, Math.min(45, Math.floor(level / 2)));
  }

  private getClassUpgradeLevelRequirement(targetClass: TankClass): number {
      const tier30 = new Set<TankClass>([
          TankClass.TWIN, TankClass.SNIPER, TankClass.MACHINE_GUN, TankClass.FLANK_GUARD,
      ]);
      const tier60 = new Set<TankClass>([
          TankClass.TRIPLE_SHOT, TankClass.QUAD_TANK, TankClass.TWIN_FLANK,
          TankClass.HUNTER, TankClass.TRAPPER, TankClass.ASSASSIN, TankClass.DESTROYER, TankClass.GUNNER,
          TankClass.DUAL_TRAPPER, TankClass.MACHINE_GUN_TRAPPER,
          TankClass.SPREAD_SHOT, TankClass.TRI_ANGLE, TankClass.OVERSEER,
          TankClass.SPRAYER,
      ]);
      const tier90 = new Set<TankClass>([
          TankClass.OCTO_TRAPPER,
          TankClass.TRIPLE_TRAPPER,
      ]);
      if (tier30.has(targetClass)) return 30;
      if (tier60.has(targetClass)) return 60;
      if (tier90.has(targetClass)) return 90;
      return 90;
  }

  private getShapeXpReward(shape: Shape): number {
      const base = SHAPE_STATS[shape.shapeType]?.xp ?? shape.xpValue;
      const rarityRank = getRarityRank(shape.rarity);
      const shapeWeight =
        shape.shapeType === ShapeType.DODECAGON ? 5.2 :
        shape.shapeType === ShapeType.DECAGON ? 4.55 :
        shape.shapeType === ShapeType.NONAGON ? 4.0 :
        shape.shapeType === ShapeType.OCTAGON ? 3.6 :
        shape.shapeType === ShapeType.HEPTAGON ? 2.95 :
        shape.shapeType === ShapeType.HEXAGON ? 2.4 :
        shape.shapeType === ShapeType.PENTAGON ? 1.6 :
        shape.shapeType === ShapeType.STAR ? 1.25 :
        shape.shapeType === ShapeType.TRIANGLE ? 1.0 :
        shape.shapeType === ShapeType.DIAMOND ? 0.84 : 0.65;
      const rarityFactor = 1 + rarityRank * 1.35;
      const cap = Math.floor(base * shapeWeight * rarityFactor + shape.maxHealth * 0.045);
      return Math.max(1, Math.min(shape.xpValue, cap));
  }

  private getObjectiveXpReward(victim: Shape | Boss | Crasher): number {
      if (victim instanceof Shape) return this.getShapeXpReward(victim);
      if (victim instanceof Crasher) return Math.min(victim.xpValue, victim.isAlphaCrasher ? 1200 : 240);
      return Math.min(victim.xpValue, 75000);
  }

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
      const requiredLevel = this.getClassUpgradeLevelRequirement(nc);
      if (this.gameMode !== GameMode.SANDBOX && this.level < requiredLevel) {
          this.addNotification(`CLASS UNLOCKS AT LEVEL ${requiredLevel}`, "#ffbb00");
          return;
      }
      this.upgradeClassForTank(this.player, nc);
      this.sound.playClassUpgrade();
  }
  upgradeClassForTank(tank: Tank, newClass: TankClass) {
      const normalizedClass = this.getNormalizedPrimaryClassForSectorClass(newClass);
      const inheritedSector = this.getSecondarySectorForLegacyClass(newClass);

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

      tank.lastUpgradeRemapSummary = [];
      tank.classType = normalizedClass;
      if (inheritedSector !== 'none') {
          tank.secondarySector = inheritedSector;
      }
      this.syncTankBarrelsForClass(tank);
      tank.machineHeat = 0;
      tank.machineSpin = 0;
      tank.nextBarrelIndex = 0;
      
      tank.updateStats(); // Ensure aura radii and other constants are calculated immediately
      this.syncTankBarrelsForClass(tank);
      
      const isBoss = this.isBossClass(normalizedClass);
      if (isBoss) {
          // Bosses become global free agents in all modes: hostile/engageable by everyone.
          tank.team = Team.NONE;
          if (tank === this.player) tank.color = '#9f76fc'; // Purple for commanders
      }
      
      const baseReloadMs = (BASE_STATS.reload - (tank.stats[StatType.RELOAD] * 2.5)) * 16.67;

      const continuousFireClasses = [
          TankClass.TWIN, TankClass.TRIPLE_SHOT, TankClass.QUAD_TANK, TankClass.OCTO_TANK, 
          TankClass.TRIPLE_TANK, TankClass.PENTA_SHOT, TankClass.GUNNER, TankClass.AUTO_GUNNER, 
          TankClass.STREAMLINER, TankClass.SPREAD_SHOT
          // HUNTER and X_HUNTER removed to synchronize cooldowns for nested stacked blasts
      ];
      
      if (continuousFireClasses.includes(normalizedClass)) {
          tank.barrels.forEach((barrel, i) => {
              const delayMultiplier = barrel[4];
              const totalReload = baseReloadMs * delayMultiplier;
              tank.barrelCooldowns[i] = (i / tank.barrels.length) * totalReload;
              tank.barrelMaxCooldowns[i] = totalReload;
          });
      }
      this.statRevision++;

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
    if (this.gameMode === GameMode.BOSS_RUSH) {
      this.bossRushMode.renderWorld(this.ctx);
    }
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
          let radius = (e.type === EntityType.PLAYER ? 300 : 100) * this.cameraZoom;
          if (e instanceof Tank && (e.isPacifist(e.classType) || e.isDraining(e.classType))) {
              const hpRatio = Math.max(0.05, e.health / Math.max(1, e.maxHealth));
              const extra = e.isPacifist(e.classType) ? (460 + e.healingAuraRadius * 0.82) : (460 + e.drainAuraRadius * 0.94 + (1 - hpRatio) * 260);
              radius = Math.max(radius, extra * this.cameraZoom);
          }
          const grad = this.lightingCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
          grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          this.lightingCtx.fillStyle = grad;
          this.lightingCtx.beginPath();
          this.lightingCtx.arc(sx, sy, radius, 0, Math.PI * 2);
          this.lightingCtx.fill();
          if (e instanceof Tank && e.isPacifist(e.classType)) {
              const aura = this.lightingCtx.createRadialGradient(sx, sy, radius * 0.12, sx, sy, radius * 1.08);
              aura.addColorStop(0, 'rgba(186,255,232,0.88)');
              aura.addColorStop(0.5, 'rgba(110,255,210,0.44)');
              aura.addColorStop(1, 'rgba(0,0,0,0)');
              this.lightingCtx.fillStyle = aura;
              this.lightingCtx.beginPath();
              this.lightingCtx.arc(sx, sy, radius * 1.08, 0, Math.PI * 2);
              this.lightingCtx.fill();
          } else if (e instanceof Tank && e.isDraining(e.classType)) {
              const hpRatio = Math.max(0.05, e.health / Math.max(1, e.maxHealth));
              const pulse = 0.65 + Math.sin(Date.now() * 0.01 + e.id) * 0.35;
              const aura = this.lightingCtx.createRadialGradient(sx, sy, radius * 0.08, sx, sy, radius * (1.0 + (1 - hpRatio) * 0.16));
              aura.addColorStop(0, `rgba(255,120,120,${0.78 + pulse * 0.2})`);
              aura.addColorStop(0.5, `rgba(220,40,40,${0.42 + pulse * 0.2})`);
              aura.addColorStop(1, 'rgba(0,0,0,0)');
              this.lightingCtx.fillStyle = aura;
              this.lightingCtx.beginPath();
              this.lightingCtx.arc(sx, sy, radius * (1.0 + (1 - hpRatio) * 0.16), 0, Math.PI * 2);
              this.lightingCtx.fill();
          }
          lightsDrawn++;
      }
      for (const e of this.entities) {
          if (!(e instanceof VoidPortal) || e.isExit || !this.isOnScreen(e.pos, 800)) continue;
          const sx = (e.pos.x - this.cameraPos.x) * this.cameraZoom + this.lastViewportWidth / 2;
          const sy = (e.pos.y - this.cameraPos.y) * this.cameraZoom + this.lastViewportHeight / 2;
          const white = e.phase === 'WHITE_HOLE' || e.phase === 'EXPANDING';
          const r = e.radius * (white ? 4.1 : 3.1) * e.portalScale * this.cameraZoom;
          const g = this.lightingCtx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r);
          g.addColorStop(0, white ? 'rgba(240,252,255,0.95)' : 'rgba(135,95,255,0.68)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          this.lightingCtx.fillStyle = g;
          this.lightingCtx.beginPath();
          this.lightingCtx.arc(sx, sy, r, 0, Math.PI * 2);
          this.lightingCtx.fill();
      }
      this.lightingCtx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.lightingCanvas, 0, 0);
  }

  drawGrid(ctx: CanvasRenderingContext2D) {
      const viewW = window.innerWidth / this.cameraZoom, viewH = window.innerHeight / this.cameraZoom;
      const startX = Math.max(0, Math.floor((this.cameraPos.x - viewW/2) / GRID_SIZE) * GRID_SIZE), endX = Math.min(CANVAS_WIDTH, Math.ceil((this.cameraPos.x + viewW/2) / GRID_SIZE) * GRID_SIZE);
      const startY = Math.max(0, Math.floor((this.cameraPos.y - viewH/2) / GRID_SIZE) * GRID_SIZE), endY = Math.min(CANVAS_HEIGHT, Math.ceil((this.cameraPos.y + viewH/2) / GRID_SIZE) * GRID_SIZE);
      
      if (this.gameMode === GameMode.TEAMS && !this.inVoid) {
          this.drawTeamSafeZones(ctx);
      } else if (this.gameMode === GameMode.DOMINION && !this.inVoid) {
          this.drawDominionSafeZones(ctx);
          this.drawDominionZoneFields(ctx);
      }

      if (!this.inVoid && this.gameMode !== GameMode.BOSS_RUSH) {
          this.drawPentagonNestBiome(ctx);
      }

      ctx.strokeStyle = this.inVoid ? '#151515' : (this.darkMode ? '#222222' : COLORS.background); ctx.lineWidth = 1; ctx.beginPath();
      for (let x = startX; x <= endX; x += GRID_SIZE) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
      for (let y = startY; y <= endY; y += GRID_SIZE) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
      ctx.stroke();
  }

  private drawPentagonNestBiome(ctx: CanvasRenderingContext2D) {
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;
      const t = Date.now() * 0.0012;
      const outerRadius = 1520;
      const midRadius = 1080;
      const coreRadius = 560;
      const pulse = 0.72 + Math.sin(t * 1.7) * 0.08;

      ctx.save();

      const outerGlow = ctx.createRadialGradient(centerX, centerY, coreRadius * 0.4, centerX, centerY, outerRadius);
      outerGlow.addColorStop(0, 'rgba(118,141,252,0.02)');
      outerGlow.addColorStop(0.48, 'rgba(118,141,252,0.065)');
      outerGlow.addColorStop(0.78, 'rgba(70,96,205,0.075)');
      outerGlow.addColorStop(1, 'rgba(17,22,44,0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.fill();

      const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 1.25);
      coreGlow.addColorStop(0, 'rgba(82,224,255,0.18)');
      coreGlow.addColorStop(0.22, 'rgba(82,224,255,0.1)');
      coreGlow.addColorStop(0.56, 'rgba(118,141,252,0.12)');
      coreGlow.addColorStop(1, 'rgba(15,19,45,0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const spread = 0.36;
          const startAngle = angle - spread;
          const endAngle = angle + spread;
          const innerX = centerX + Math.cos(angle) * (coreRadius * 0.62);
          const innerY = centerY + Math.sin(angle) * (coreRadius * 0.62);
          const leftX = centerX + Math.cos(startAngle) * midRadius;
          const leftY = centerY + Math.sin(startAngle) * midRadius;
          const tipX = centerX + Math.cos(angle) * outerRadius * (0.92 + Math.sin(t + i) * 0.025);
          const tipY = centerY + Math.sin(angle) * outerRadius * (0.92 + Math.sin(t + i) * 0.025);
          const rightX = centerX + Math.cos(endAngle) * midRadius;
          const rightY = centerY + Math.sin(endAngle) * midRadius;

          ctx.fillStyle = `rgba(118,141,252,${0.05 + (i % 2) * 0.01})`;
          ctx.beginPath();
          ctx.moveTo(innerX, innerY);
          ctx.quadraticCurveTo(
            centerX + Math.cos(startAngle) * (coreRadius + 180),
            centerY + Math.sin(startAngle) * (coreRadius + 180),
            leftX,
            leftY
          );
          ctx.quadraticCurveTo(
            centerX + Math.cos(angle - 0.1) * (outerRadius * 0.82),
            centerY + Math.sin(angle - 0.1) * (outerRadius * 0.82),
            tipX,
            tipY
          );
          ctx.quadraticCurveTo(
            centerX + Math.cos(angle + 0.1) * (outerRadius * 0.82),
            centerY + Math.sin(angle + 0.1) * (outerRadius * 0.82),
            rightX,
            rightY
          );
          ctx.quadraticCurveTo(
            centerX + Math.cos(endAngle) * (coreRadius + 180),
            centerY + Math.sin(endAngle) * (coreRadius + 180),
            innerX,
            innerY
          );
          ctx.closePath();
          ctx.fill();
      }

      ctx.strokeStyle = 'rgba(148,168,255,0.16)';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 16]);
      ctx.lineDashOffset = -Date.now() * 0.03;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius * 0.78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, midRadius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = 'rgba(122,214,255,0.22)';
      ctx.lineWidth = 2.4;
      this.traceBiomePolygon(ctx, 5, coreRadius * 0.84, -Math.PI / 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(118,141,252,0.18)';
      ctx.lineWidth = 1.4;
      this.traceBiomePolygon(ctx, 5, coreRadius * 1.08, -Math.PI / 2);
      ctx.stroke();

      for (let i = 0; i < 10; i++) {
          const angle = ((i + 0.5) * Math.PI * 2) / 10 - Math.PI / 2 + Math.sin(t + i) * 0.04;
          const dist = 760 + (i % 2) * 290;
          const x = centerX + Math.cos(angle) * dist;
          const y = centerY + Math.sin(angle) * dist;
          const r = 30 + (i % 3) * 10;
          const crystal = ctx.createRadialGradient(x, y, 0, x, y, r);
          crystal.addColorStop(0, 'rgba(98,234,255,0.14)');
          crystal.addColorStop(0.55, 'rgba(118,141,252,0.06)');
          crystal.addColorStop(1, 'rgba(118,141,252,0)');
          ctx.fillStyle = crystal;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
      }

      ctx.restore();
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

  private drawDominionSafeZones(ctx: CanvasRenderingContext2D) {
      const teams: Team[] = [Team.BLUE, Team.RED, Team.GREEN, Team.PURPLE];
      for (const team of teams) {
          const rect = this.getSafeZoneRect(team);
          if (!rect) continue;
          const baseColor = getTeamRgb(team);
          ctx.save();
          ctx.fillStyle = `rgba(${baseColor},0.08)`;
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          ctx.strokeStyle = `rgba(${baseColor},0.35)`;
          ctx.lineWidth = 3;
          ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
          ctx.restore();
      }
  }

  private drawDominionZoneFields(ctx: CanvasRenderingContext2D) {
      const pulse = 0.55 + Math.sin(Date.now() * 0.0038) * 0.45;
      for (const zone of this.dominionZones) {
          const rgb = getTeamRgb(zone.owner === Team.NONE ? Team.NONE : zone.owner);
          ctx.save();
          ctx.fillStyle = `rgba(${rgb},${zone.owner === Team.NONE ? 0.06 : 0.08 + pulse * 0.04})`;
          ctx.beginPath();
          ctx.arc(zone.pos.x, zone.pos.y, zone.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(${rgb},${zone.contested ? 0.72 : 0.4 + pulse * 0.16})`;
          ctx.lineWidth = zone.contested ? 5 : 3;
          ctx.beginPath();
          ctx.arc(zone.pos.x, zone.pos.y, zone.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
      }
  }

  private traceBiomePolygon(ctx: CanvasRenderingContext2D, sides: number, radius: number, angleOffset: number = 0) {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
          const angle = angleOffset + (i * 2 * Math.PI) / sides;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
      }
      ctx.closePath();
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
          if (opt.classType === TankClass.CELESTIAL) desc = "Calamity orbs, carrier pressure, burst control.";
          if (opt.classType === TankClass.OBLITERATOR) desc = "Annihilator evolution: huge cannon, brutal shell power.";
          ctx.fillText(desc, opt.pos.x, opt.pos.y + 180);
      });
  }
}



