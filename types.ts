
export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY',
  DOMINION_TANK = 'DOMINION_TANK',
  SHAPE = 'SHAPE',
  BULLET = 'BULLET',
  GUARDIAN = 'GUARDIAN',
  BOSS = 'BOSS',
  CRASHER = 'CRASHER',
  VOID_PORTAL = 'VOID_PORTAL',
  ELITE_TANK = 'ELITE_TANK',
  DUMMY = 'DUMMY',
  DRONE = 'DRONE',
  MINI_TANK = 'MINI_TANK',
  BASE_DEFENSE_DRONE = 'BASE_DEFENSE_DRONE',
}

export enum ShapeType {
  SQUARE = 'SQUARE',
  DIAMOND = 'DIAMOND',
  TRIANGLE = 'TRIANGLE',
  STAR = 'STAR',
  PENTAGON = 'PENTAGON',
  HEPTAGON = 'HEPTAGON',
  HEXAGON = 'HEXAGON',
  OCTAGON = 'OCTAGON',
  NONAGON = 'NONAGON',
  DECAGON = 'DECAGON',
  DODECAGON = 'DODECAGON',
}

export enum ShapeRarity {
  COMMON = 'Common',
  UNCOMMON = 'Uncommon',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGENDARY = 'Legendary',
  MYTHICAL = 'Mythical',
  ETERNAL = 'Eternal',
  TRANSCENDENT = 'Transcendent',
  GODLY = 'Godly',
  DIVINE = 'Divine',
}

export enum Team {
  NONE = 'NONE',
  BLUE = 'BLUE',
  RED = 'RED',
  GREEN = 'GREEN',
  PURPLE = 'PURPLE',
}

export enum GameMode {
  FFA = 'FFA',
  TEAMS = 'TEAMS',
  DOMINION = 'DOMINION',
  BOSS_RUSH = 'BOSS_RUSH',
  SANDBOX = 'SANDBOX',
}

export enum PlayerState {
  ACTIVE = 'ACTIVE',
  EVOLVING = 'EVOLVING',
  SECTOR_SELECTION = 'SECTOR_SELECTION',
  BOSS_SELECTION = 'BOSS_SELECTION',
}

export type SecondarySector = 'none' | 'restoration' | 'blood';

export enum AIState {
  IDLE = 'IDLE',
  FARM = 'FARM',
  COMBAT = 'COMBAT',
  FLEE = 'FLEE',
  HUNT = 'HUNT',
  PROXIMAL_PORTAL_TRANSIT = 'PROXIMAL_PORTAL_TRANSIT',
  GREETING = 'GREETING',
  ESCORT = 'ESCORT',
  BODYGUARD = 'BODYGUARD',
  BASE_DEFENSE = 'BASE_DEFENSE',
  RETURNING = 'RETURNING',
  ORBIT_IDLE = 'ORBIT_IDLE',
}

export enum AISessionArchetype {
  FARMER = 'FARMER',
  RUSHER = 'RUSHER',
  SUPPORT = 'SUPPORT',
  EXPLORER = 'EXPLORER',
}

export enum AIBehaviorPhase {
  PHASE_EARLY = 'PHASE_EARLY',
  PHASE_MID = 'PHASE_MID',
  PHASE_LATE = 'PHASE_LATE',
}

export enum StatType {
  REGEN = 'Health Regen',
  MAX_HEALTH = 'Max Health',
  BODY_DAMAGE = 'Body Damage',
  BULLET_SPEED = 'Bullet Speed',
  BULLET_PENETRATION = 'Bullet Penetration',
  BULLET_DAMAGE = 'Bullet Damage',
  RELOAD = 'Reload',
  MOVEMENT_SPEED = 'Movement Speed',
  BULLET_SPREAD = 'Accuracy',
  MAX_SHIELD = 'Max Shield',
  // Pacifist Stats
  HEALING_RADIUS = 'Healing Radius',
  HEALING_EFFICIENCY = 'Healing Efficiency',
  HEALING_BURST = 'Healing Burst',
  SUPPORT_XP_MULT = 'Support XP Multiplier',
  // Draining Stats
  DRAIN_RADIUS = 'Drain Radius',
  DRAIN_EFFICIENCY = 'Drain Efficiency',
  DRAIN_LIFESTEAL = 'Lifesteal',
  DRAIN_BURST = 'Decay Burst',
}

export enum TankClass {
  BASIC = 'Basic Tank',
  // Pacifist Progression
  PACIFIST_TRAINEE = 'Pacifist Trainee',
  // Tier 2 (Level 15)
  NURSE = 'Nurse',
  TWIN = 'Twin',
  SNIPER = 'Sniper',
  MACHINE_GUN = 'Machine Gun',
  FLANK_GUARD = 'Flank Guard',
  // Tier 3 (Level 30)
  TRIPLE_SHOT = 'Triple Shot',
  QUAD_TANK = 'Quad Tank',
  TWIN_FLANK = 'Twin Flank',
  ASSASSIN = 'Assassin',
  DESTROYER = 'Destroyer',
  SPRAYER = 'Sprayer',
  TRI_ANGLE = 'Tri-Angle',
  HUNTER = 'Hunter',
  TRAPPER = 'Trapper',
  DUAL_TRAPPER = 'Dual Trapper',
  MACHINE_GUN_TRAPPER = 'Machine Gun Trapper',
  OCTO_TRAPPER = 'Octo Trapper',
  TRIPLE_TRAPPER = 'Triple Trapper',
  GUNNER = 'Gunner',
  DOCTOR = 'Doctor',
  OVERSEER = 'Overseer',
  // Tier 4 (Level 45)
  TRIPLE_TWIN = 'Triple Twin',
  OCTO_TANK = 'Octo Tank',
  TRIPLE_TANK = 'Triple Tank',
  PENTA_SHOT = 'Penta Shot',
  SPREAD_SHOT = 'Spread Shot',
  RANGER = 'Ranger',
  STALKER = 'Stalker',
  ANNIHILATOR = 'Annihilator',
  HYBRID = 'Hybrid',
  BOOSTER = 'Booster',
  FIGHTER = 'Fighter',
  STREAMLINER = 'Streamliner',
  X_HUNTER = 'X-Hunter',
  AUTO_GUNNER = 'Auto Gunner',
  OVERLORD = 'Overlord',
  MANAGER = 'Manager',
  PLAGUE_DOCTOR = 'Plague Doctor',
  // Draining Progression
  DRAINER_TRAINEE = 'Drainer Trainee',
  // Tier 2 (Level 15)
  LEECH = 'Leech',
  // Tier 3 (Level 30)
  VAMPIRE = 'Vampire',
  // Tier 4 (Level 45)
  REAPER = 'Reaper',
  // Boss Classes (Rebirth)
  COLOSSAL = 'Colossal',
  LEVIATHAN = 'Leviathan',
  WARLORD = 'Warlord',
  CELESTIAL = 'Celestial',
  OBLITERATOR = 'Obliterator',
  AEGIS_GATEKEEPER = 'Aegis Gatekeeper',
  VANTA_SPLITTER = 'Vanta Splitter',
  PYRE_REACTOR = 'Pyre Reactor',
  IRON_EXECUTIONER = 'Iron Executioner',
  GRAND_SINGULARITY = 'The Grand Singularity',
}

export interface Vector2 {
  x: number;
  y: number;
}

// ECS-oriented data-only components for deterministic AI migration.
export interface AIComponent {
  aiState: AIState;
  targetId: number | null;
  decisionCooldownTicks: number;
  retreatUntilTick: number;
  wanderAngle: number;
  wanderPhase?: number;
  lookAngle?: number;
  lastDecisionTick?: number;
  stuckTicks?: number;
  assistTargetId?: number | null;
  huntTargetId?: number | null;
}

export interface PositionComponent {
  x: number;
  y: number;
}

export interface VelocityComponent {
  x: number;
  y: number;
}

export interface TankComponent {
  id: number;
  team: Team;
  classType: TankClass;
  health: number;
  maxHealth: number;
}

export interface SteeringComponent {
  x: number;
  y: number;
}

export interface MinimapMarker {
  type: EntityType;
  pos: Vector2;
  team: Team;
  rotation?: number;
  isPlayer?: boolean;
  zoneRadius?: number;
  markerRole?: 'ENTITY' | 'DOMINION_ZONE';
}

export interface DominionZoneState {
  id: number;
  pos: Vector2;
  radius: number;
  owner: Team;
  contested: boolean;
}

export interface KillFeedEntry {
  id: string;
  killerName: string;
  victimName: string;
  timestamp: number;
}

export interface HighScoreEntry {
  userId?: string | null;
  name: string;
  score: number;
  level: number;
  classType: TankClass;
  date: string;
}

export interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  classType: TankClass;
  currentClass?: TankClass;
  isPlayer: boolean;
  team: Team;
  teamId?: Team;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface UINotification {
  id: string;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  timestamp?: number;
}

export interface BuffEffect {
  type: 'XP_MULT' | 'POWER_TOKEN' | 'SHAPE_MAGNET' | 'BOSS_OVERRIDE';
  timeLeft: number;
  totalTime: number;
}

export interface AbilityHudInfo {
  id: string;
  name: string;
  trigger: 'RMB' | 'SPACE';
  description: string;
  benefit: string;
  tradeoff: string;
  cooldownRemaining: number;
  cooldownTotal: number;
  active: boolean;
  activeRemaining?: number;
  activeTotal?: number;
}

export interface SandboxBossAbilityInfo {
  id: string;
  name: string;
  trigger: 'M1' | 'Q' | 'X' | 'R' | 'E' | 'PASSIVE';
  description: string;
  cooldownRemaining: number;
  cooldownTotal: number;
  active?: boolean;
  activeRemaining?: number;
  activeTotal?: number;
}

export interface SandboxBossHeavyOptionInfo {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

export interface SandboxBossHudInfo {
  classType: TankClass;
  name: string;
  callsign: string;
  summary: string;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  awakened?: boolean;
  awakeningActive?: boolean;
  awakeningProgress?: number;
  statusText?: string;
  abilities: SandboxBossAbilityInfo[];
  heavyOptions?: SandboxBossHeavyOptionInfo[];
}

export interface EntityStatusFlags {
  fxHealing: boolean;
  fxDraining: boolean;
  fxAbilityActive: boolean;
}

export type BotChatCategory =
  | 'death_taunt'
  | 'healing_request'
  | 'panic'
  | 'victory'
  | 'rare_random'
  | 'low_health';

export interface BotChatBubble {
  id: string;
  botId: number;
  name: string;
  classType: TankClass;
  team: Team;
  category: BotChatCategory;
  text: string;
  displayText: string;
  typing: boolean;
  revealedWordCount: number;
  totalWords: number;
  onScreen: boolean;
  opacity: number;
  worldPos: Vector2;
  accentColor: string;
}

export interface DeathPresentationState {
  mode: 'instant' | 'taunt';
  delayActive: boolean;
  cardVisible: boolean;
  fadeProgress: number;
  dimOpacity: number;
  blurPx: number;
  delayRemainingMs: number;
  killerBotId?: number | null;
}

export interface DeathKillerSnapshot {
  entityId: number | null;
  spectateTargetId: number | null;
  name: string;
  classType: TankClass | null;
  team: Team;
  level: number | null;
  score: number | null;
  health: number | null;
  maxHealth: number | null;
  shield: number | null;
  maxShield: number | null;
  isBot: boolean;
  isAlive: boolean;
  canSpectate: boolean;
}

export interface SandboxConfig {
  invincible: boolean;
  infiniteAmmo: boolean;
  knockbackEnabled: boolean;
  botsEnabled: boolean;
  gameSpeed: number;
  showHitboxes: boolean;
  freezeAll: boolean;
  spawningEnabled: boolean; 
  noAbilityCooldown: boolean;
  // Enhanced Sandbox Controls
  shapeSpawnRate: number;      // Multiplier for passive spawn rate
  shapeMaxCount: number;       // Adjusted max shapes allowed
  enabledShapes: Record<string, boolean>; // Toggles for specific shape types
  cleanupActive: boolean;      // Auto-cleanup stray entities
  showSpawnNotifications: boolean; // Toggle for shape announcements
  projectileDamageScale: number;
  projectileDurabilityScale: number;
  droneDamageScale: number;
  droneDurabilityScale: number;
}

export type DominionWeaponProfile = 'DESTROYER' | 'GUNNER' | 'TRAPPER' | 'TRIPLE';

export type PrimedSpawnConfig = {
  type: 'SHAPE' | 'BOSS' | 'ALPHA_PENTAGON' | 'VOID_PORTAL' | 'DUMMY' | 'BOT_TANK' | 'ELITE_TANK' | 'DOMINION_TANK';
  shapeType?: ShapeType;
  rarity: ShapeRarity;
  classType?: TankClass;
  weaponProfile?: DominionWeaponProfile;
  spawnAmount?: number;
};

export interface GameState {
  score: number;
  level: number;
  xp: number;
  maxXp: number;
  stats: Record<StatType, number>;
  statRevision?: number;
  availableStatPoints: number;
  mainClass: TankClass;
  currentClass: TankClass;
  secondarySector: SecondarySector;
  isDead: boolean;
  fps: number;
  killFeed: KillFeedEntry[];
  botChatBubbles?: BotChatBubble[];
  leaderboard: LeaderboardEntry[];
  notifications: UINotification[];
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  // Minimap Data
  playerPos: Vector2;
  playerRotation: number;
  camera: Camera;
  mapSize: { width: number; height: number };
  gameMode: GameMode;
  autoFire: boolean;
  autoSpin: boolean;
  // Minimap Markers
  minimapMarkers: MinimapMarker[];
  // Void Data
  inVoid: boolean;
  voidTimeRemaining: number;
  voidTransitStage?: string | null;
  voidTransitProgress?: number;
  // Elite Boss Data
  isTransformed: boolean;
  transformationTime: number;
  transformationReady: boolean;
  rebirthEligible?: boolean;
  activeBuffs: BuffEffect[];
  // Sandbox Control
  sandboxConfig?: SandboxConfig;
  // Fabrication Mode (Sandbox Spawning Tool)
  primedSpawn?: PrimedSpawnConfig | null;
  abilityHud?: AbilityHudInfo | null;
  sandboxBossHud?: SandboxBossHudInfo | null;
  playerState?: PlayerState;
  evolutionTransitionRemaining?: number;
  bossChoices?: TankClass[];
  enemyZoneWarningLevel?: 0 | 1 | 2;
  enemyZoneWarningText?: string;
  bloodDrainLive?: number;
  bloodDrainStacks?: number;
  bloodDrainSession?: number;
  dominionScores?: Partial<Record<Team, number>>;
  dominionOwnedCount?: Partial<Record<Team, number>>;
  dominionTimeRemaining?: number;
  dominionZones?: DominionZoneState[];
  bossRush?: {
    active: boolean;
    bossName: string;
    bossSubtitle: string;
    bossIndex: number;
    bossCount: number;
    health: number;
    maxHealth: number;
    phase: number;
    phaseCount: number;
    awakened: boolean;
    pressureText?: string;
    transitionText?: string;
    victory: boolean;
    loadoutEditable: boolean;
    loadoutLevel: number;
    remainingStatPoints: number;
    loadout: BossRushLoadout;
    cinematic?: {
      active: boolean;
      mode: 'intro' | 'awakening' | 'transformation';
      title: string;
      speaker: string;
      line: string;
      displayLine: string;
      progress: number;
      barsProgress: number;
      accent: string;
      color: string;
      flash: number;
      chromatic: number;
      transformationPulse?: number;
      transformationHalo?: number;
      sigilAlpha?: number;
    };
  };
  deathPresentation?: DeathPresentationState;
  deathKiller?: DeathKillerSnapshot | null;
}

// --- Shop Types ---

export interface ShopItem {
  id: string;
  name: string;
  type: 'color' | 'theme' | 'elite_skin'; 
  value: string; // Hex color, Theme ID, or TankClass
  price: number;
  description?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary' | 'elite';
  isAchievementReward?: boolean;
}

// --- Auth & Backend Types ---

export interface UserStats {
  totalGames: number;
  totalScore: number;
  highScore: number;
  maxLevel: number;
  totalKills: number;
  totalDeaths: number;
  // Elite Stats
  eliteKills: number;
  transformations: number;
  highestEliteDamage: number;
  achievementsUnlocked: string[];
  questsUnlocked: string[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'kills' | 'score' | 'games' | 'elite' | 'special' | 'level';
  requirement: number;
  rewardSkinId?: string;
  rewardCurrency?: number;
  icon?: string;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'farming' | 'survival' | 'teamplay' | 'objective';
  requirement: number;
  rewardCurrency: number;
  rewardSkinId?: string;
}

export interface GameSettings {
  volume: number;
  musicVolume: number;
  darkMode: boolean;
  showMinimap: boolean;
  showLeaderboard: boolean;
  compactScoreNotation: boolean;
  shakeEnabled: boolean;
  shakeIntensity: number;
  particleDensity: number;
  uiScale: number;
  showFps: boolean;
}

export interface BossRushLoadout {
  classType: TankClass;
  stats: Partial<Record<StatType, number>>;
}

export interface User {
  username: string;
  token: string;
  stats: UserStats;
  createdAt: string;
  // Economy
  currency: number;
  inventory: string[]; // List of ShopItem IDs
  equippedItem: string; // ID of currently equipped color/skin
  unlockedEliteSkins: TankClass[]; // Classes for which elite skin is unlocked
  supportTotal: number;
  supporterRank: 'standard' | 'rank1' | 'rank2' | 'rank3';
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}
