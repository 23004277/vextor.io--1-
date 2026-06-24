
import { StatType, TankClass, ShopItem, ShapeType, ShapeRarity, Achievement, Quest, SecondarySector } from './types';

export const BOT_NAME_POOLS = {
  ffa: [
    'CantAimForToffee',
    'StateOfThisLad',
    'UncleKnobhead',
    'OnePintTactician',
    'ProperWetWipe',
    'TescoValueTerminator',
    'SirDiesALot',
    'AbsoluteWaffle',
    'HalfCutHitmarker',
    'NoPlanJustVibesMate',
    'AccidentalTopFrag',
    'TheLastBrainCell',
    'ShoutsThenExplodes',
    'BtecFinalBoss',
    'PanicAtTheCrosshair',
    'NeedsMorePracticeLike',
    'WetherspoonsGladiator',
    'MildlyThreateningNeil',
    'CrumpetOfDoom',
    'ZeroClueBaz',
    'FullKitNoIdea',
    'ChattingAbsoluteScenes',
    'DodgyAnkleDave',
    'AldiSpecialForces',
    'MisreadThePatchNotes'
  ],
  teams: [
    'BlueBadgeMenace',
    'RedSideRonnie',
    'LeftFlankLarry',
    'FriendlyFireNeville',
    'TeamChatHardman',
    'ReviveMeNan',
    'SpawnCampStan',
    'ObjectiveAvoidanceUnit',
    'CantHoldThisLane',
    'PushNowPanicNow',
    'BackseatShotcaller',
    'SweatingAtTheMinimap',
    'FlaglessBehaviour',
    'CrossfireKeith',
    'TinpotTactician',
    'JustOneMorePeek',
    'LosesEvery2v1',
    'CorridorGremlin',
    'ThreeLadsNoPlan',
    'MumSaidPlaySupport',
    'PeekingLikeAPlonker',
    'BargainCallsignBarry',
    'HoldingWForBritain',
    'CoverMeImUseless',
    'QueueDodgingColin'
  ],
  dominion: [
    'PointlessAtPointControl',
    'ZoneDeniedDennis',
    'CantCapForLove',
    'DominionOfConfusion',
    'HillCamperHarold',
    'ObjectiveShobjective',
    'LosesMidEveryTime',
    'AerialViewOfDisaster',
    'RotatesFarTooLate',
    'CapturePointClive',
    'ThreeSecondsOnPoint',
    'BiscuitTinCommander',
    'OrbitingTheObjective',
    'ContestAndComplain',
    'ZoneGremlinGeoff',
    'MapAwarenessPending',
    'LateToEveryPush',
    'DefendingAbsolutelyNothing',
    'MidLaneMeltdown',
    'RoundaboutGeneral',
    'CouncilTacticalUnit',
    'CantClearTheLane',
    'PushesSoloThenMoans',
    'ObjectiveFraudOliver',
    'HardStuckOnThePoint'
  ],
  bossRush: [
    'BudgetFinalBoss',
    'MythicWetSock',
    'RaidWipeRoger',
    'BossPhaseBungler',
    'DodgeRollDeclined',
    'ArenaPanicArthur',
    'HealthbarInspector',
    'TelegraphEnjoyer',
    'DiesToPhaseOne',
    'HeroicModeClifford',
    'UltimateButtonNigel',
    'EnragedAtTutorial',
    'WipesUsForCulture',
    'HullIntegrityHarvey',
    'MechanicIgnorer',
    'GrandadOfTheVoid',
    'SecondPhaseShambles',
    'CommandDeckMuppet',
    'CosmicNuisanceKev',
    'BulletHellBernard',
    'OneTapProphet',
    'BorisBossMechanics',
    'RaidReadyMyArse',
    'BigSpeechSmallDPS',
    'EmergencyTeaBreak'
  ]
} as const;

export const BOT_LEGENDARY_NAMES = [
  'TwoTierKeir',
  'LizTrussedTheLobby',
  'BorisQueueDodger',
  'RishiSunakAndHide',
  'MingVaseMarauder',
  'PartygatePathfinder',
  'PrimeMinisterOfThrowing',
  'KeirlyCompetent',
  'TrussTheProcess',
  'BorisOfBumblingdon',
  'TreasuryTeaLeaf',
  'DowningStreetDoorbell'
];

export const BOT_LEGENDARY_NAME_CHANCE = 0.08;

export const BOT_NAMES = [
  ...BOT_NAME_POOLS.ffa,
  ...BOT_NAME_POOLS.teams,
  ...BOT_NAME_POOLS.dominion,
  ...BOT_NAME_POOLS.bossRush,
  ...BOT_LEGENDARY_NAMES
];

export const BOT_STAT_PRIORITIES: Record<TankClass, StatType[]> = {
  [TankClass.BASIC]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.BULLET_SPREAD, StatType.REGEN, StatType.BODY_DAMAGE],
  [TankClass.TWIN]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.BULLET_SPREAD, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.BULLET_SPEED, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.SNIPER]: [StatType.BULLET_SPEED, StatType.BULLET_DAMAGE, StatType.BULLET_SPREAD, StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.MOVEMENT_SPEED, StatType.MAX_SHIELD, StatType.MAX_HEALTH, StatType.REGEN],
  [TankClass.MACHINE_GUN]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.BULLET_DAMAGE, StatType.REGEN, StatType.MOVEMENT_SPEED, StatType.BULLET_SPREAD],
  [TankClass.FLANK_GUARD]: [StatType.MOVEMENT_SPEED, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_SPREAD, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.BULLET_PENETRATION, StatType.BULLET_SPEED, StatType.REGEN],
  [TankClass.TRIPLE_SHOT]: [StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.QUAD_TANK]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.TWIN_FLANK]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.TRIPLE_TWIN]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.ASSASSIN]: [StatType.BULLET_SPEED, StatType.BULLET_DAMAGE, StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.MOVEMENT_SPEED, StatType.MAX_SHIELD, StatType.MAX_HEALTH, StatType.REGEN],
  [TankClass.RANGER]: [StatType.BULLET_SPEED, StatType.BULLET_DAMAGE, StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.MOVEMENT_SPEED, StatType.MAX_SHIELD, StatType.MAX_HEALTH, StatType.REGEN],
  [TankClass.STALKER]: [StatType.BULLET_SPEED, StatType.BULLET_DAMAGE, StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.MOVEMENT_SPEED, StatType.MAX_SHIELD, StatType.MAX_HEALTH, StatType.REGEN],
  [TankClass.DESTROYER]: [StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.ANNIHILATOR]: [StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.HYBRID]: [StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.SPRAYER]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.TRI_ANGLE]: [StatType.MOVEMENT_SPEED, StatType.BODY_DAMAGE, StatType.MAX_HEALTH, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.OCTO_TANK]: [StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.TRAPPER]: [StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.RELOAD, StatType.BULLET_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.DUAL_TRAPPER]: [StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.BULLET_SPEED, StatType.RELOAD, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.MACHINE_GUN_TRAPPER]: [StatType.RELOAD, StatType.BULLET_SPEED, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.OCTO_TRAPPER]: [StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.TRIPLE_TRAPPER]: [StatType.BULLET_DAMAGE, StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_SPEED, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.PENTA_SHOT]: [StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.SPREAD_SHOT]: [StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.HUNTER]: [StatType.BULLET_SPEED, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.X_HUNTER]: [StatType.BULLET_SPEED, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.STREAMLINER]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.GUNNER]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.AUTO_GUNNER]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.OVERSEER]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.OVERLORD]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.BODY_DAMAGE, StatType.REGEN],
  [TankClass.MANAGER]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.MOVEMENT_SPEED, StatType.BODY_DAMAGE, StatType.REGEN],
  [TankClass.BOOSTER]: [StatType.MOVEMENT_SPEED, StatType.BODY_DAMAGE, StatType.MAX_HEALTH, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.REGEN],
  [TankClass.FIGHTER]: [StatType.MOVEMENT_SPEED, StatType.BODY_DAMAGE, StatType.MAX_HEALTH, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.REGEN],
  [TankClass.TRIPLE_TANK]: [StatType.RELOAD, StatType.BULLET_PENETRATION, StatType.BULLET_DAMAGE, StatType.MOVEMENT_SPEED, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.COLOSSAL]: [StatType.MAX_HEALTH, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.LEVIATHAN]: [StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.WARLORD]: [StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN, StatType.BODY_DAMAGE, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION],
  [TankClass.CELESTIAL]: [StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.BULLET_DAMAGE, StatType.BODY_DAMAGE, StatType.REGEN],
  [TankClass.OBLITERATOR]: [StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.BODY_DAMAGE, StatType.REGEN],
  [TankClass.AEGIS_GATEKEEPER]: [StatType.MAX_HEALTH, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.VANTA_SPLITTER]: [StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MAX_SHIELD, StatType.REGEN],
  [TankClass.PYRE_REACTOR]: [StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.REGEN, StatType.BODY_DAMAGE, StatType.RELOAD, StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION],
  [TankClass.IRON_EXECUTIONER]: [StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.BULLET_DAMAGE, StatType.BODY_DAMAGE, StatType.REGEN],
  [TankClass.GRAND_SINGULARITY]: [StatType.BULLET_DAMAGE, StatType.BULLET_PENETRATION, StatType.RELOAD, StatType.MAX_HEALTH, StatType.MAX_SHIELD, StatType.BODY_DAMAGE, StatType.REGEN],
  [TankClass.PACIFIST_TRAINEE]: [StatType.REGEN, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MOVEMENT_SPEED, StatType.HEALING_RADIUS, StatType.HEALING_EFFICIENCY],
  [TankClass.NURSE]: [StatType.HEALING_RADIUS, StatType.HEALING_EFFICIENCY, StatType.REGEN, StatType.MAX_HEALTH, StatType.MOVEMENT_SPEED, StatType.HEALING_BURST],
  [TankClass.DOCTOR]: [StatType.HEALING_RADIUS, StatType.HEALING_EFFICIENCY, StatType.HEALING_BURST, StatType.REGEN, StatType.MAX_HEALTH, StatType.SUPPORT_XP_MULT],
  [TankClass.PLAGUE_DOCTOR]: [StatType.HEALING_RADIUS, StatType.HEALING_EFFICIENCY, StatType.HEALING_BURST, StatType.SUPPORT_XP_MULT, StatType.BODY_DAMAGE, StatType.MAX_HEALTH],
  [TankClass.DRAINER_TRAINEE]: [StatType.DRAIN_RADIUS, StatType.DRAIN_EFFICIENCY, StatType.MAX_HEALTH, StatType.MOVEMENT_SPEED, StatType.REGEN],
  [TankClass.LEECH]: [StatType.DRAIN_RADIUS, StatType.DRAIN_EFFICIENCY, StatType.DRAIN_LIFESTEAL, StatType.MAX_HEALTH, StatType.MOVEMENT_SPEED, StatType.DRAIN_BURST],
  [TankClass.VAMPIRE]: [StatType.DRAIN_RADIUS, StatType.DRAIN_EFFICIENCY, StatType.DRAIN_LIFESTEAL, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.DRAIN_BURST],
  [TankClass.REAPER]: [StatType.DRAIN_RADIUS, StatType.DRAIN_EFFICIENCY, StatType.DRAIN_LIFESTEAL, StatType.MAX_HEALTH, StatType.BODY_DAMAGE, StatType.MOVEMENT_SPEED, StatType.DRAIN_BURST],
};

export const CANVAS_WIDTH = 10000;
export const CANVAS_HEIGHT = 10000;
export const GRID_SIZE = 50;
export const BASE_ZONE_WIDTH = 1000; // Width of the safe zones in Team Mode
export const SAFE_ZONE_ALERT_RADIUS = 260;
export const SAFE_ZONE_WARNING_RADIUS = 540;
export const SAFE_ZONE_ENGAGEMENT_RADIUS = 280;
export const SAFE_ZONE_DRONE_SCAN_INTERVAL_MS = 180;
export const SAFE_ZONE_DEFENSE_DRONES_PER_TEAM = 18;

export const CLASS_ABILITY_CONFIG = {
  restoration: {
    healthSacrificeRatio: 0.25,
    burstRadiusMultiplier: 1.9,
    baseBurstMinRadius: 520,
    instantHealRatio: 0.22,
    regenOverchargeSeconds: 4.0,
    regenOverchargeRatioPerSecond: 0.08,
    cooldownSeconds: 15,
  },
  blood: {
    healthSacrificeRatio: 0.16,
    activeSeconds: 3.8,
    lifestealAuraMultiplier: 1.35,
    strikeRangeMultiplier: 2.15,
    baseStrikeMinRange: 320,
    baseStrikeHalfWidth: 82,
    strikeDamageHealthRatio: 0.072,
    strikeAuraDamageScalar: 2.8,
    strikeStatDamageScalar: 6,
    strikeHealRatio: 0.28,
    strikePierceFalloff: 0.88,
    pactDrainDotStacks: 1,
    strikeDrainDotStacks: 2,
    decayStackDuration: 4.0,
    decayTickSeconds: 0.65,
    decayDamagePerStackRatio: 0.009,
    cooldownSeconds: 15,
  },
} as const;

export const SECONDARY_SECTOR_OPTIONS: SecondarySector[] = ['none', 'restoration', 'blood'];

export const COLORS = {
  background: '#cdcdcd', // Grid lines
  backgroundFill: '#b4b4b4',
  player: '#00b2e1', // Blue Team Color
  enemy: '#f14e54',  // Red Team Color
  allyGreen: '#34d399',
  allyPurple: '#a78bfa',
  dominionNeutral: '#facc15',
  square: '#ffe869',
  diamond: '#74f0d2',
  triangle: '#fc7677',
  star: '#7dd3fc',
  pentagon: '#768dfc',
  heptagon: '#c989ff',
  hexagon: '#9f76fc', // Purple-ish Hexagon
  octagon: '#ffcc33', // Vibrant Gold/Amber
  nonagon: '#fb7185',
  decagon: '#f97316',
  dodecagon: '#f8fafc',
  crasher: '#f177dd', // Pink Crasher color
  barrel: '#999999',
  border: '#555555',
  text: '#ffffff',
  uiBackground: 'rgba(0, 0, 0, 0.4)',
  voidBackground: '#0a0a0a',
  voidPortal: '#6e2cf2',
};

export const XP_CURVE_MULTIPLIER = 1.06; // Slower tier gates, smoother recursive XP scaling.
export const MAX_LEVEL = 130;
export const REBIRTH_LEVEL = 110;
export const REBIRTH_AREA_POS = { x: 20000, y: 20000 };
export const REBIRTH_AREA_SIZE = 2000;

export const STAT_COLORS: Record<StatType, string> = {
  [StatType.REGEN]: '#eebb99', // Orange-ish
  [StatType.MAX_HEALTH]: '#ff88cc', // Pink
  [StatType.BODY_DAMAGE]: '#9966ff', // Purple
  [StatType.BULLET_SPEED]: '#55aaff', // Blue
  [StatType.BULLET_PENETRATION]: '#ffee44', // Yellow
  [StatType.BULLET_DAMAGE]: '#ff4444', // Red
  [StatType.RELOAD]: '#99ee77', // Green
  [StatType.MOVEMENT_SPEED]: '#77eeee', // Cyan
  [StatType.BULLET_SPREAD]: '#b8b8b8', // Silver
  [StatType.MAX_SHIELD]: '#33ccff', // Cyan
  [StatType.HEALING_RADIUS]: '#4ade80', // Light Green
  [StatType.HEALING_EFFICIENCY]: '#22c55e', // Green
  [StatType.HEALING_BURST]: '#16a34a', // Dark Green
  [StatType.SUPPORT_XP_MULT]: '#fbbf24', // Amber
  [StatType.DRAIN_RADIUS]: '#f87171', // Light Red
  [StatType.DRAIN_EFFICIENCY]: '#ef4444', // Red
  [StatType.DRAIN_LIFESTEAL]: '#b91c1c', // Dark Red
  [StatType.DRAIN_BURST]: '#7f1d1d', // Deep Red
};

export const CLASS_TREE: Partial<Record<TankClass, TankClass[]>> = {
  [TankClass.BASIC]: [TankClass.TWIN, TankClass.SNIPER, TankClass.MACHINE_GUN, TankClass.FLANK_GUARD],
  [TankClass.PACIFIST_TRAINEE]: [],
  [TankClass.NURSE]: [],
  [TankClass.DOCTOR]: [],
  [TankClass.DRAINER_TRAINEE]: [],
  [TankClass.LEECH]: [],
  [TankClass.VAMPIRE]: [],
  // Tier 2 -> Tier 3
  [TankClass.TWIN]: [TankClass.TRIPLE_SHOT, TankClass.QUAD_TANK, TankClass.TWIN_FLANK],
  [TankClass.SNIPER]: [TankClass.ASSASSIN, TankClass.OVERSEER, TankClass.HUNTER, TankClass.TRAPPER],
  [TankClass.MACHINE_GUN]: [TankClass.DESTROYER, TankClass.GUNNER, TankClass.SPRAYER],
  [TankClass.FLANK_GUARD]: [TankClass.TRI_ANGLE, TankClass.QUAD_TANK],
  
  // Tier 3 -> Tier 4 (Level 45)
  [TankClass.TRIPLE_SHOT]: [TankClass.PENTA_SHOT, TankClass.SPREAD_SHOT, TankClass.TRIPLE_TANK, TankClass.OCTO_TANK],
  [TankClass.QUAD_TANK]: [TankClass.OCTO_TANK],
  [TankClass.TWIN_FLANK]: [TankClass.TRIPLE_TWIN],
  [TankClass.ASSASSIN]: [TankClass.RANGER, TankClass.STALKER],
  [TankClass.HUNTER]: [TankClass.X_HUNTER, TankClass.STREAMLINER],
  [TankClass.OVERSEER]: [TankClass.OVERLORD, TankClass.MANAGER],
  [TankClass.DESTROYER]: [TankClass.HYBRID, TankClass.ANNIHILATOR],
  [TankClass.GUNNER]: [TankClass.AUTO_GUNNER, TankClass.STREAMLINER],
  [TankClass.TRI_ANGLE]: [TankClass.BOOSTER, TankClass.FIGHTER],
  [TankClass.SPRAYER]: [],
  [TankClass.TRAPPER]: [TankClass.DUAL_TRAPPER, TankClass.MACHINE_GUN_TRAPPER],
  [TankClass.DUAL_TRAPPER]: [TankClass.OCTO_TRAPPER, TankClass.TRIPLE_TRAPPER],
  [TankClass.MACHINE_GUN_TRAPPER]: [],

  // Tier 4 (Finals)
  [TankClass.TRIPLE_TWIN]: [],
  [TankClass.OCTO_TANK]: [],
  [TankClass.OCTO_TRAPPER]: [],
  [TankClass.TRIPLE_TRAPPER]: [],
  [TankClass.TRIPLE_TANK]: [],
  [TankClass.PENTA_SHOT]: [],
  [TankClass.SPREAD_SHOT]: [],
  [TankClass.RANGER]: [],
  [TankClass.STALKER]: [],
  [TankClass.ANNIHILATOR]: [],
  [TankClass.HYBRID]: [],
  [TankClass.BOOSTER]: [],
  [TankClass.FIGHTER]: [],
  [TankClass.STREAMLINER]: [],
  [TankClass.X_HUNTER]: [],
  [TankClass.AUTO_GUNNER]: [],
  [TankClass.OVERLORD]: [],
  [TankClass.MANAGER]: [],
  [TankClass.CELESTIAL]: [],
  [TankClass.OBLITERATOR]: [],
};

// Barrel Configurations
// [length, width, x_offset, angle_offset, delay_multiplier, y_offset, spread_factor]
export const TANK_CONFIGS: Record<TankClass, number[][]> = {
  [TankClass.BASIC]: [[1.9, 0.8, 0, 0, 1, 0]],
  [TankClass.TWIN]: [
    [1.9, 0.8, 0, 0, 1.0, 0.5], 
    [1.9, 0.8, 0, 0, 1.0, -0.5], 
  ],
  [TankClass.SNIPER]: [[2.5, 0.8, 0, 0, 1.85, 0]],
  [TankClass.MACHINE_GUN]: [[1.52, 0.84, 0.02, 0, 0.24, 0]], 
  [TankClass.FLANK_GUARD]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.6, 0.8, 0, Math.PI, 1, 0],
  ],
  // Tier 3
  [TankClass.TRIPLE_SHOT]: [
    [1.82, 0.74, -0.08, -0.34, 0.94, 0],
    [1.88, 0.8, -0.04, 0, 0.9, 0],
    [1.82, 0.74, -0.08, 0.34, 0.94, 0],
  ],
  [TankClass.QUAD_TANK]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.9, 0.8, 0, Math.PI / 2, 1, 0],
    [1.9, 0.8, 0, Math.PI, 1, 0],
    [1.9, 0.8, 0, -Math.PI / 2, 1, 0],
  ],
  [TankClass.TWIN_FLANK]: [
    [1.9, 0.8, 0, 0, 1, 0.5], [1.9, 0.8, 0, 0, 1, -0.5],
    [1.9, 0.8, 0, Math.PI, 1, 0.5], [1.9, 0.8, 0, Math.PI, 1, -0.5],
  ],
  [TankClass.ASSASSIN]: [[3.0, 0.8, 0, 0, 2.4, 0]],
  [TankClass.DESTROYER]: [
    [1.8, 1.5, 0, 0, 3.5, 0], // REWORKED: Single colossal stubby barrel
  ],
  [TankClass.SPRAYER]: [
    [1.54, 1.06, 0.02, 0, 1.18, 0, 1.18],
    [2.18, 0.58, 0.18, 0, 0.92, 0, 0.64],
  ],
  [TankClass.TRI_ANGLE]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.6, 0.8, 0, Math.PI - 0.5, 1, 0],
    [1.6, 0.8, 0, Math.PI + 0.5, 1, 0],
  ],
  [TankClass.HUNTER]: [
    [1.8, 1.2, 0, 0, 1.75, 0], // Bottom Barrel (Widest)
    [2.3, 0.7, 0, 0, 1.75, 0], // Top Barrel (Thinnest)
  ],
  [TankClass.TRAPPER]: [
    [1.52, 1.08, 0.04, 0, 2.2, 0],
  ],
  [TankClass.DUAL_TRAPPER]: [
    [1.5, 0.98, 0.04, 0.035, 2.28, 0.66],
    [1.5, 0.98, 0.04, -0.035, 2.28, -0.66],
  ],
  [TankClass.MACHINE_GUN_TRAPPER]: [
    [1.66, 1.18, 0.08, 0, 0.9, 0, 0.34],
  ],
  [TankClass.GUNNER]: [
    // Redesigned "fan-cluster" gunner profile: dual needles + dual support barrels + compact core stabilizer.
    [2.04, 0.4, 0.1, 0.05, 0.58, 0.26],
    [2.04, 0.4, 0.1, -0.05, 0.58, -0.26],
    [1.78, 0.48, 0.02, 0.08, 0.74, 0.56],
    [1.78, 0.48, 0.02, -0.08, 0.74, -0.56],
    [1.46, 0.58, -0.1, 0, 0.94, 0],
  ],
  [TankClass.OVERSEER]: [
    [1.5, 0.72, -0.05, Math.PI / 2, 1, 0],
    [1.8, 0.6, -0.02, Math.PI * 0.1, 1, 0.25],
    [1.8, 0.6, -0.02, -Math.PI * 0.1, 1, -0.25],
  ],
  // Tier 4
  [TankClass.TRIPLE_TWIN]: [
    [1.9, 0.8, 0, 0, 1, 0.5], [1.9, 0.8, 0, 0, 1, -0.5],
    [1.9, 0.8, 0, (Math.PI * 2) / 3, 1, 0.5], [1.9, 0.8, 0, (Math.PI * 2) / 3, 1, -0.5],
    [1.9, 0.8, 0, -(Math.PI * 2) / 3, 1, 0.5], [1.9, 0.8, 0, -(Math.PI * 2) / 3, 1, -0.5],
  ],
  [TankClass.OCTO_TANK]: [
    [1.9, 0.8, 0, 0, 1, 0], [1.9, 0.8, 0, Math.PI / 4, 1, 0],
    [1.9, 0.8, 0, Math.PI / 2, 1, 0], [1.9, 0.8, 0, (3 * Math.PI) / 4, 1, 0],
    [1.9, 0.8, 0, Math.PI, 1, 0], [1.9, 0.8, 0, -(3 * Math.PI) / 4, 1, 0],
    [1.9, 0.8, 0, -Math.PI / 2, 1, 0], [1.9, 0.8, 0, -Math.PI / 4, 1, 0],
  ],
  [TankClass.OCTO_TRAPPER]: [
    [1.42, 0.92, 0.02, 0, 2.32, 0],
    [1.42, 0.92, 0.02, Math.PI / 4, 2.32, 0],
    [1.42, 0.92, 0.02, Math.PI / 2, 2.32, 0],
    [1.42, 0.92, 0.02, (3 * Math.PI) / 4, 2.32, 0],
    [1.42, 0.92, 0.02, Math.PI, 2.32, 0],
    [1.42, 0.92, 0.02, -(3 * Math.PI) / 4, 2.32, 0],
    [1.42, 0.92, 0.02, -Math.PI / 2, 2.32, 0],
    [1.42, 0.92, 0.02, -Math.PI / 4, 2.32, 0],
  ],
  [TankClass.TRIPLE_TANK]: [
    [1.9, 0.8, 0, 0, 1.0, 0.6], 
    [1.9, 0.8, 0, 0, 1.0, -0.6], 
    [2.1, 0.8, 0, 0, 1.0, 0],
  ],
  [TankClass.TRIPLE_TRAPPER]: [
    [1.58, 0.92, 0.04, 0.045, 1.96, 0.72],
    [1.76, 0.96, 0.1, 0, 1.9, 0],
    [1.58, 0.92, 0.04, -0.045, 1.96, -0.72],
  ],
  [TankClass.PENTA_SHOT]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.7, 0.8, 0, Math.PI / 8, 1, 0],
    [1.7, 0.8, 0, -Math.PI / 8, 1, 0],
    [1.5, 0.8, 0, Math.PI / 4, 1, 0],
    [1.5, 0.8, 0, -Math.PI / 4, 1, 0],
  ],
  [TankClass.SPREAD_SHOT]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.6, 0.4, 0, Math.PI / 10, 1, 0], [1.6, 0.4, 0, -Math.PI / 10, 1, 0],
    [1.5, 0.4, 0, 2 * Math.PI / 10, 1, 0], [1.5, 0.4, 0, -2 * Math.PI / 10, 1, 0],
    [1.4, 0.4, 0, 3 * Math.PI / 10, 1, 0], [1.4, 0.4, 0, -3 * Math.PI / 10, 1, 0],
    [1.3, 0.4, 0, 4 * Math.PI / 10, 1, 0], [1.3, 0.4, 0, -4 * Math.PI / 10, 1, 0],
    [1.2, 0.4, 0, 5 * Math.PI / 10, 1, 0], [1.2, 0.4, 0, -5 * Math.PI / 10, 1, 0],
  ],
  [TankClass.RANGER]: [[3.5, 0.8, 0, 0, 3.2, 0]],
  [TankClass.STALKER]: [[3.5, 1.0, 0, 0, 3.6, 0]],
  [TankClass.ANNIHILATOR]: [
    [1.9, 2.2, 0, 0, 4.5, 0, 1.4], // REWORKED: Single massive flared horn
  ],
  [TankClass.HYBRID]: [
    [1.9, 1.55, 0, 0, 3.2, 0], // Primary destroyer cannon
    [1.45, 0.95, 0, Math.PI, 2.0, 0], // Rear drone-control emitter
    [1.15, 0.45, -0.15, Math.PI / 2, 2.8, 0], // Left stabilizer emitter (visual)
    [1.15, 0.45, -0.15, -Math.PI / 2, 2.8, 0], // Right stabilizer emitter (visual)
  ],
  [TankClass.OVERLORD]: [
    [1.6, 0.78, 0, 0, 1, 0],
    [1.5, 0.74, 0.02, Math.PI / 3, 1, 0],
    [1.5, 0.74, 0.02, (2 * Math.PI) / 3, 1, 0],
    [1.5, 0.74, 0.02, Math.PI, 1, 0],
    [1.5, 0.74, 0.02, -(2 * Math.PI) / 3, 1, 0],
    [1.5, 0.74, 0.02, -Math.PI / 3, 1, 0],
  ],
  [TankClass.MANAGER]: [
    [1.45, 0.78, 0, 0, 1.0, 0],
    [1.2, 0.42, -0.18, Math.PI / 2, 1.8, 0],
    [1.2, 0.42, -0.18, -Math.PI / 2, 1.8, 0],
  ],
  [TankClass.BOOSTER]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.6, 0.8, 0, Math.PI - 0.5, 1, 0],
    [1.6, 0.8, 0, Math.PI + 0.5, 1, 0],
    [1.4, 0.8, 0, Math.PI - 0.7, 1, 0],
    [1.4, 0.8, 0, Math.PI + 0.7, 1, 0],
  ],
  [TankClass.FIGHTER]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.8, 0.8, 0, Math.PI / 2, 1, 0],
    [1.8, 0.8, 0, -Math.PI / 2, 1, 0],
    [1.6, 0.8, 0, Math.PI - 0.5, 1, 0],
    [1.6, 0.8, 0, Math.PI + 0.5, 1, 0],
  ],
  [TankClass.STREAMLINER]: [
    [2.42, 0.52, 0, 0, 0.28, 0],
    [2.16, 0.56, 0, 0, 0.24, 0],
    [1.92, 0.6, 0, 0, 0.22, 0],
    [1.7, 0.64, 0, 0, 0.2, 0],
    [1.5, 0.68, 0, 0, 0.18, 0],
  ],
  [TankClass.X_HUNTER]: [
    [1.6, 1.6, 0, 0, 2.2, 0], // Bottom (Widest)
    [2.1, 1.1, 0, 0, 2.2, 0], // Middle
    [2.6, 0.6, 0, 0, 2.2, 0], // Top (Thinnest)
  ],
  [TankClass.AUTO_GUNNER]: [
    [2.0, 0.4, 0.08, 0.03, 0.56, 0.24],
    [2.0, 0.4, 0.08, -0.03, 0.56, -0.24],
    [1.72, 0.5, 0.02, 0.05, 0.78, 0.52],
    [1.72, 0.5, 0.02, -0.05, 0.78, -0.52],
    [1.42, 0.62, -0.08, 0, 1.05, 0],
  ],
  [TankClass.COLOSSAL]: [
    // Forward command lance + disciplined side batteries + cleaner rear drone ports.
    [1.62, 0.72, 0.08, 0, 2.8, 0, 1.08],
    [1.34, 0.6, -0.08, Math.PI * 0.42, 2.95, 0.66, 0.96],
    [1.34, 0.6, -0.08, -Math.PI * 0.42, 2.95, -0.66, 0.96],
    [0.92, 0.34, -0.56, Math.PI * 0.9, 0.86, 0.92, 0.9],
    [0.84, 0.32, -0.62, Math.PI, 0.82, 0, 0.88],
    [0.92, 0.34, -0.56, -Math.PI * 0.9, 0.86, -0.92, 0.9],
  ],
  [TankClass.LEVIATHAN]: [
    // Broadside behemoth: forward lance + port/starboard denial + rear suppressor + central manager spawner.
    [1.76, 0.8, -0.04, 0, 2.75, 0, 0.4],
    [1.58, 0.72, -0.12, Math.PI / 2, 2.35, 0.6, 0.58],
    [1.58, 0.72, -0.12, -Math.PI / 2, 2.35, -0.6, 0.58],
    [1.44, 0.66, -0.28, Math.PI * 0.72, 2.42, 0.42, 0.72],
    [1.44, 0.66, -0.28, -Math.PI * 0.72, 2.42, -0.42, 0.72],
    [1.16, 0.6, -0.42, Math.PI, 2.1, 0, 0.9],
    [1.24, 0.64, -0.02, 0, 1.9, 0, 1.0],
  ],
  [TankClass.WARLORD]: [
    // Tactical siege: dual frontal suppressors, wing burst nodes, compact stern kicker.
    [1.72, 0.72, 0.06, 0.08, 1.55, 0.26, 0.96],
    [1.72, 0.72, 0.06, -0.08, 1.55, -0.26, 0.96],
    [1.34, 0.62, -0.24, Math.PI * 0.68, 1.02, 0.42, 0.9],
    [1.34, 0.62, -0.24, -Math.PI * 0.68, 1.02, -0.42, 0.9],
    [1.04, 0.54, -0.4, Math.PI, 1.35, 0, 1.0],
  ],
  [TankClass.CELESTIAL]: [
    // Pentagon layout: primary lance + 4 symmetric emitters.
    [1.62, 0.78, -0.02, 0, 2.45, 0, 0.62],
    [1.2, 0.58, -0.14, Math.PI * 0.4, 1.12, 0, 1.16],
    [1.2, 0.58, -0.14, -Math.PI * 0.4, 1.12, 0, 1.16],
    [1.06, 0.54, -0.2, Math.PI * 0.8, 1.18, 0, 1.08],
    [1.06, 0.54, -0.2, -Math.PI * 0.8, 1.18, 0, 1.08],
  ],
  [TankClass.OBLITERATOR]: [
    // Single oversized annihilator-grade doom cannon.
    [2.45, 2.95, 0.02, 0, 3.1, 0, 1.1],
  ],
  [TankClass.AEGIS_GATEKEEPER]: [
    [1.46, 0.58, 0.16, 0, 1.0, 0, 0.94],
    [1.08, 0.4, -0.06, Math.PI * 0.42, 1.18, 0.74, 0.86],
    [1.08, 0.4, -0.06, -Math.PI * 0.42, 1.18, -0.74, 0.86],
    [0.82, 0.3, -0.56, Math.PI, 1.28, 0, 0.9],
  ],
  [TankClass.VANTA_SPLITTER]: [
    [1.36, 0.5, 0.08, 0, 0.84, 0, 0.82],
    [1.24, 0.42, -0.02, Math.PI * 0.22, 0.92, 0.34, 0.8],
    [1.24, 0.42, -0.02, -Math.PI * 0.22, 0.92, -0.34, 0.8],
    [1.08, 0.34, -0.18, Math.PI * 0.48, 1.08, 0.72, 0.76],
    [1.08, 0.34, -0.18, -Math.PI * 0.48, 1.08, -0.72, 0.76],
    [0.78, 0.28, -0.44, Math.PI, 1.28, 0, 0.9],
  ],
  [TankClass.PYRE_REACTOR]: [
    [1.18, 0.38, 0.04, 0, 0.86, 0, 0.92],
    [1.04, 0.32, -0.04, Math.PI / 3, 0.96, 0.44, 0.8],
    [1.04, 0.32, -0.04, -Math.PI / 3, 0.96, -0.44, 0.8],
    [0.92, 0.3, -0.18, Math.PI * 0.68, 1.08, 0.74, 0.78],
    [0.92, 0.3, -0.18, -Math.PI * 0.68, 1.08, -0.74, 0.78],
    [0.74, 0.28, -0.4, Math.PI, 1.24, 0, 0.88],
  ],
  [TankClass.IRON_EXECUTIONER]: [
    [1.52, 0.56, 0.12, 0, 1.08, 0, 0.76],
    [1.08, 0.34, -0.08, Math.PI * 0.34, 0.92, 0.52, 0.76],
    [1.08, 0.34, -0.08, -Math.PI * 0.34, 0.92, -0.52, 0.76],
    [0.9, 0.28, -0.24, Math.PI * 0.84, 1.16, 0.34, 0.9],
    [0.9, 0.28, -0.24, -Math.PI * 0.84, 1.16, -0.34, 0.9],
  ],
  [TankClass.GRAND_SINGULARITY]: [
    [1.96, 1.1, 0.08, 0, 1.42, 0, 0.78],
  ],
  [TankClass.PACIFIST_TRAINEE]: [[1.4, 0.9, 0, 0, 1.0, 0]],
  [TankClass.NURSE]: [[1.5, 0.7, 0, 0.3, 1.0, 0.4], [1.5, 0.7, 0, -0.3, 1.0, -0.4]],
  [TankClass.DOCTOR]: [
    [1.6, 0.8, 0, 0, 1.0, 0.6], [1.6, 0.8, 0, 0, 1.0, -0.6],
    [1.2, 0.8, 0, 0, 1.0, 0]
  ],
  [TankClass.PLAGUE_DOCTOR]: [
    [2.2, 0.6, 0, 0, 1.0, 0], // The Beak
    [1.4, 0.9, 0, Math.PI * 0.7, 1.0, 0], // Left Wing/Shoulder
    [1.4, 0.9, 0, -Math.PI * 0.7, 1.0, 0], // Right Wing/Shoulder
  ],
  [TankClass.DRAINER_TRAINEE]: [[1.8, 0.5, 0, 0, 1.0, 0]],
  [TankClass.LEECH]: [
    [2.0, 0.4, 0, 0.1, 1.0, 0.3], [2.0, 0.4, 0, -0.1, 1.0, -0.3]
  ],
  [TankClass.VAMPIRE]: [
    [2.2, 0.6, 0, 0.4, 1.0, 0.2], [2.2, 0.6, 0, -0.4, 1.0, -0.2],
    [1.6, 1.0, 0, 0, 1.0, 0]
  ],
  [TankClass.REAPER]: [
    // Executioner silhouette: heavy maw lance, upper/lower harvesting hooks, rear siphon pair.
    [2.12, 0.88, 0.1, 0.02, 0.96, 0, 0.92],
    [1.72, 0.58, -0.08, Math.PI * 0.3, 0.74, 0.58, 0.74],
    [1.58, 0.54, -0.18, -Math.PI * 0.36, 0.72, -0.52, 0.78],
    [1.24, 0.48, -0.34, Math.PI * 0.86, 1.08, 0.44, 0.96],
    [1.18, 0.44, -0.4, -Math.PI * 0.9, 1.12, -0.34, 0.98],
  ],
};

export const BASE_STATS = {
  health: 100,
  regen: 0.1,
  bodyDamage: 20,
  bulletSpeed: 5,
  bulletPenetration: 10,
  bulletDamage: 10,
  reload: 30, // Frames
  speed: 4.1, // Nerfed from 4.5 to reduce rammer chasing potential
};

export const CLASS_PROJECTILE_MODIFIERS: Partial<Record<TankClass, {
  penetrationMultiplier?: number;
  projectileHealthMultiplier?: number;
}>> = {
  [TankClass.ANNIHILATOR]: {
    // Moderate anti-bullet-wall buff without touching reload/mobility.
    penetrationMultiplier: 1.2,
    projectileHealthMultiplier: 1.12,
  },
  [TankClass.OBLITERATOR]: {
    penetrationMultiplier: 2.1,
    projectileHealthMultiplier: 2.9,
  },
  [TankClass.TRAPPER]: {
    penetrationMultiplier: 1.22,
    projectileHealthMultiplier: 1.34,
  },
  [TankClass.DUAL_TRAPPER]: {
    penetrationMultiplier: 1.16,
    projectileHealthMultiplier: 1.28,
  },
  [TankClass.MACHINE_GUN_TRAPPER]: {
    penetrationMultiplier: 1.0,
    projectileHealthMultiplier: 1.05,
  },
  [TankClass.OCTO_TRAPPER]: {
    penetrationMultiplier: 1.08,
    projectileHealthMultiplier: 1.16,
  },
  [TankClass.TRIPLE_TRAPPER]: {
    penetrationMultiplier: 1.02,
    projectileHealthMultiplier: 1.08,
  },
};

// --- Shape Stats ---

export const SHAPE_STATS: Record<ShapeType, { health: number; xp: number; damage: number; radius: number; color: string; sides: number }> = {
    [ShapeType.SQUARE]: { health: 25, xp: 50, damage: 8, radius: 12.5, color: COLORS.square, sides: 4 },
    [ShapeType.DIAMOND]: { health: 48, xp: 88, damage: 11, radius: 15, color: COLORS.diamond, sides: 4 },
    [ShapeType.TRIANGLE]: { health: 80, xp: 145, damage: 14, radius: 18.75, color: COLORS.triangle, sides: 3 },
    [ShapeType.STAR]: { health: 145, xp: 235, damage: 16, radius: 23, color: COLORS.star, sides: 10 },
    [ShapeType.PENTAGON]: { health: 300, xp: 440, damage: 20, radius: 31.25, color: COLORS.pentagon, sides: 5 },
    [ShapeType.HEPTAGON]: { health: 560, xp: 760, damage: 28, radius: 40, color: COLORS.heptagon, sides: 7 },
    [ShapeType.HEXAGON]: { health: 800, xp: 1080, damage: 35, radius: 50, color: COLORS.hexagon, sides: 6 },
    [ShapeType.OCTAGON]: { health: 2500, xp: 2650, damage: 60, radius: 110, color: COLORS.octagon, sides: 8 },
    [ShapeType.NONAGON]: { health: 3600, xp: 3900, damage: 72, radius: 128, color: COLORS.nonagon, sides: 9 },
    [ShapeType.DECAGON]: { health: 5200, xp: 5700, damage: 84, radius: 145, color: COLORS.decagon, sides: 10 },
    [ShapeType.DODECAGON]: { health: 8200, xp: 9200, damage: 105, radius: 168, color: COLORS.dodecagon, sides: 12 },
};

export const BOSS_STATS: Record<string, { id: string; name: string; health: number; xp: number; radius: number; color: string; sides: number; description: string }> = {
    ALPHA_PENTAGON: {
        id: 'alpha_pentagon',
        name: 'Alpha Pentagon',
        health: 5400,
        xp: 6200,
        radius: 138,
        color: '#768dfc',
        sides: 5,
        description: 'A massive polygon found only in the heart of the Pentagon Nest. It acts as a primary objective for high-level players.'
    },
    GRAND_SINGULARITY: {
        id: 'grand_singularity',
        name: 'Grand Singularity',
        health: 150000,
        xp: 500000,
        radius: 180,
        color: '#0055ff',
        sides: 5,
        description: 'The ultimate anomaly. Manifests rarely and challenges the entire server with its gravitational pulse and defensive crashers.'
    }
};

export type ShapeRarityProfile = {
    xpMult: number;
    hpMult: number;
    chance: number;
    color?: string;
    sizeMult: number;
    damageMult: number;
    driftMult: number;
    spinMult: number;
};

export const RARITY_CONFIG: Record<ShapeRarity, ShapeRarityProfile> = {
    [ShapeRarity.COMMON]: { xpMult: 1, hpMult: 1, chance: 0.72, sizeMult: 1.0, damageMult: 1, driftMult: 1, spinMult: 1 },
    [ShapeRarity.UNCOMMON]: { xpMult: 1.6, hpMult: 1.5, chance: 0.18, sizeMult: 1.05, damageMult: 1.08, driftMult: 1.02, spinMult: 1.04 },
    [ShapeRarity.RARE]: { xpMult: 2.8, hpMult: 3, chance: 0.06, color: '#50ef95', sizeMult: 1.3, damageMult: 1.18, driftMult: 1.06, spinMult: 1.08 },
    [ShapeRarity.EPIC]: { xpMult: 5, hpMult: 10, chance: 0.015, color: '#ffd700', sizeMult: 1.7, damageMult: 1.34, driftMult: 1.1, spinMult: 1.12 },
    [ShapeRarity.LEGENDARY]: { xpMult: 9, hpMult: 50, chance: 0.005, color: '#ff5e00', sizeMult: 2.2, damageMult: 1.64, driftMult: 1.16, spinMult: 1.18 },
    [ShapeRarity.MYTHICAL]: { xpMult: 15, hpMult: 250, chance: 0.001, color: '#a200ff', sizeMult: 2.8, damageMult: 1.95, driftMult: 1.2, spinMult: 1.26 },
    [ShapeRarity.ETERNAL]: { xpMult: 24, hpMult: 1200, chance: 0.0004, color: '#00ffff', sizeMult: 3.5, damageMult: 2.35, driftMult: 1.24, spinMult: 1.34 },
    [ShapeRarity.TRANSCENDENT]: { xpMult: 38, hpMult: 5000, chance: 0.0002, color: '#ffffff', sizeMult: 5.0, damageMult: 2.8, driftMult: 1.3, spinMult: 1.45 },
    [ShapeRarity.GODLY]: { xpMult: 58, hpMult: 25000, chance: 0.00005, color: '#ff00ff', sizeMult: 7.0, damageMult: 3.4, driftMult: 1.38, spinMult: 1.58 },
    [ShapeRarity.DIVINE]: { xpMult: 85, hpMult: 100000, chance: 0.00001, color: '#6e2cf2', sizeMult: 10.0, damageMult: 4.1, driftMult: 1.48, spinMult: 1.72 },
};

export const VOID_RARITY_CONFIG: Record<ShapeRarity, ShapeRarityProfile> = {
    [ShapeRarity.COMMON]: { xpMult: 1, hpMult: 1, chance: 0.25, sizeMult: 1.0, damageMult: 1.04, driftMult: 1.05, spinMult: 1.05 },
    [ShapeRarity.UNCOMMON]: { xpMult: 1.7, hpMult: 1.5, chance: 0.25, sizeMult: 1.05, damageMult: 1.12, driftMult: 1.08, spinMult: 1.1 },
    [ShapeRarity.RARE]: { xpMult: 3, hpMult: 3, chance: 0.22, color: '#50ef95', sizeMult: 1.3, damageMult: 1.24, driftMult: 1.12, spinMult: 1.14 },
    [ShapeRarity.EPIC]: { xpMult: 5.5, hpMult: 10, chance: 0.18, color: '#ffd700', sizeMult: 1.7, damageMult: 1.42, driftMult: 1.16, spinMult: 1.22 },
    [ShapeRarity.LEGENDARY]: { xpMult: 10, hpMult: 50, chance: 0.06, color: '#ff5e00', sizeMult: 2.2, damageMult: 1.76, driftMult: 1.2, spinMult: 1.28 },
    [ShapeRarity.MYTHICAL]: { xpMult: 18, hpMult: 250, chance: 0.025, color: '#a200ff', sizeMult: 2.8, damageMult: 2.08, driftMult: 1.25, spinMult: 1.36 },
    [ShapeRarity.ETERNAL]: { xpMult: 30, hpMult: 1200, chance: 0.008, color: '#00ffff', sizeMult: 3.5, damageMult: 2.52, driftMult: 1.3, spinMult: 1.46 },
    [ShapeRarity.TRANSCENDENT]: { xpMult: 48, hpMult: 5000, chance: 0.002, color: '#ffffff', sizeMult: 5.0, damageMult: 3.02, driftMult: 1.38, spinMult: 1.62 },
    [ShapeRarity.GODLY]: { xpMult: 72, hpMult: 25000, chance: 0.0008, color: '#ff00ff', sizeMult: 7.0, damageMult: 3.74, driftMult: 1.48, spinMult: 1.78 },
    [ShapeRarity.DIVINE]: { xpMult: 110, hpMult: 100000, chance: 0.0002, color: '#6e2cf2', sizeMult: 10.0, damageMult: 4.55, driftMult: 1.6, spinMult: 1.95 },
};

const SHAPE_RARITY_CHANCE_OVERRIDES: Partial<Record<ShapeType, Partial<Record<ShapeRarity, number>>>> = {
    [ShapeType.HEPTAGON]: {
        [ShapeRarity.COMMON]: 0.58,
        [ShapeRarity.UNCOMMON]: 0.22,
        [ShapeRarity.RARE]: 0.11,
        [ShapeRarity.EPIC]: 0.05,
        [ShapeRarity.LEGENDARY]: 0.02,
        [ShapeRarity.MYTHICAL]: 0.008,
        [ShapeRarity.ETERNAL]: 0.002,
    },
    [ShapeType.HEXAGON]: {
        [ShapeRarity.COMMON]: 0.5,
        [ShapeRarity.UNCOMMON]: 0.23,
        [ShapeRarity.RARE]: 0.14,
        [ShapeRarity.EPIC]: 0.07,
        [ShapeRarity.LEGENDARY]: 0.035,
        [ShapeRarity.MYTHICAL]: 0.015,
        [ShapeRarity.ETERNAL]: 0.006,
        [ShapeRarity.TRANSCENDENT]: 0.002,
    },
    [ShapeType.OCTAGON]: {
        [ShapeRarity.COMMON]: 0.44,
        [ShapeRarity.UNCOMMON]: 0.21,
        [ShapeRarity.RARE]: 0.15,
        [ShapeRarity.EPIC]: 0.09,
        [ShapeRarity.LEGENDARY]: 0.06,
        [ShapeRarity.MYTHICAL]: 0.03,
        [ShapeRarity.ETERNAL]: 0.012,
        [ShapeRarity.TRANSCENDENT]: 0.004,
        [ShapeRarity.GODLY]: 0.0015,
        [ShapeRarity.DIVINE]: 0.0005,
    },
    [ShapeType.NONAGON]: {
        [ShapeRarity.COMMON]: 0.38,
        [ShapeRarity.UNCOMMON]: 0.19,
        [ShapeRarity.RARE]: 0.16,
        [ShapeRarity.EPIC]: 0.11,
        [ShapeRarity.LEGENDARY]: 0.075,
        [ShapeRarity.MYTHICAL]: 0.04,
        [ShapeRarity.ETERNAL]: 0.018,
        [ShapeRarity.TRANSCENDENT]: 0.006,
        [ShapeRarity.GODLY]: 0.002,
        [ShapeRarity.DIVINE]: 0.0007,
    },
    [ShapeType.DECAGON]: {
        [ShapeRarity.COMMON]: 0.33,
        [ShapeRarity.UNCOMMON]: 0.18,
        [ShapeRarity.RARE]: 0.16,
        [ShapeRarity.EPIC]: 0.12,
        [ShapeRarity.LEGENDARY]: 0.09,
        [ShapeRarity.MYTHICAL]: 0.05,
        [ShapeRarity.ETERNAL]: 0.025,
        [ShapeRarity.TRANSCENDENT]: 0.01,
        [ShapeRarity.GODLY]: 0.003,
        [ShapeRarity.DIVINE]: 0.001,
    },
    [ShapeType.DODECAGON]: {
        [ShapeRarity.COMMON]: 0.26,
        [ShapeRarity.UNCOMMON]: 0.17,
        [ShapeRarity.RARE]: 0.15,
        [ShapeRarity.EPIC]: 0.13,
        [ShapeRarity.LEGENDARY]: 0.11,
        [ShapeRarity.MYTHICAL]: 0.07,
        [ShapeRarity.ETERNAL]: 0.04,
        [ShapeRarity.TRANSCENDENT]: 0.02,
        [ShapeRarity.GODLY]: 0.006,
        [ShapeRarity.DIVINE]: 0.002,
    },
};

const VOID_SHAPE_RARITY_CHANCE_OVERRIDES: Partial<Record<ShapeType, Partial<Record<ShapeRarity, number>>>> = {
    [ShapeType.HEPTAGON]: {
        [ShapeRarity.COMMON]: 0.2,
        [ShapeRarity.UNCOMMON]: 0.24,
        [ShapeRarity.RARE]: 0.24,
        [ShapeRarity.EPIC]: 0.18,
        [ShapeRarity.LEGENDARY]: 0.08,
        [ShapeRarity.MYTHICAL]: 0.04,
        [ShapeRarity.ETERNAL]: 0.015,
        [ShapeRarity.TRANSCENDENT]: 0.004,
        [ShapeRarity.GODLY]: 0.001,
    },
    [ShapeType.HEXAGON]: {
        [ShapeRarity.COMMON]: 0.17,
        [ShapeRarity.UNCOMMON]: 0.22,
        [ShapeRarity.RARE]: 0.24,
        [ShapeRarity.EPIC]: 0.2,
        [ShapeRarity.LEGENDARY]: 0.1,
        [ShapeRarity.MYTHICAL]: 0.045,
        [ShapeRarity.ETERNAL]: 0.018,
        [ShapeRarity.TRANSCENDENT]: 0.005,
        [ShapeRarity.GODLY]: 0.0015,
        [ShapeRarity.DIVINE]: 0.0005,
    },
    [ShapeType.OCTAGON]: {
        [ShapeRarity.COMMON]: 0.14,
        [ShapeRarity.UNCOMMON]: 0.19,
        [ShapeRarity.RARE]: 0.22,
        [ShapeRarity.EPIC]: 0.21,
        [ShapeRarity.LEGENDARY]: 0.13,
        [ShapeRarity.MYTHICAL]: 0.065,
        [ShapeRarity.ETERNAL]: 0.028,
        [ShapeRarity.TRANSCENDENT]: 0.011,
        [ShapeRarity.GODLY]: 0.004,
        [ShapeRarity.DIVINE]: 0.001,
    },
    [ShapeType.NONAGON]: {
        [ShapeRarity.COMMON]: 0.12,
        [ShapeRarity.UNCOMMON]: 0.17,
        [ShapeRarity.RARE]: 0.21,
        [ShapeRarity.EPIC]: 0.21,
        [ShapeRarity.LEGENDARY]: 0.145,
        [ShapeRarity.MYTHICAL]: 0.075,
        [ShapeRarity.ETERNAL]: 0.032,
        [ShapeRarity.TRANSCENDENT]: 0.013,
        [ShapeRarity.GODLY]: 0.0045,
        [ShapeRarity.DIVINE]: 0.0015,
    },
    [ShapeType.DECAGON]: {
        [ShapeRarity.COMMON]: 0.1,
        [ShapeRarity.UNCOMMON]: 0.15,
        [ShapeRarity.RARE]: 0.2,
        [ShapeRarity.EPIC]: 0.22,
        [ShapeRarity.LEGENDARY]: 0.155,
        [ShapeRarity.MYTHICAL]: 0.085,
        [ShapeRarity.ETERNAL]: 0.042,
        [ShapeRarity.TRANSCENDENT]: 0.02,
        [ShapeRarity.GODLY]: 0.006,
        [ShapeRarity.DIVINE]: 0.002,
    },
    [ShapeType.DODECAGON]: {
        [ShapeRarity.COMMON]: 0.08,
        [ShapeRarity.UNCOMMON]: 0.13,
        [ShapeRarity.RARE]: 0.18,
        [ShapeRarity.EPIC]: 0.22,
        [ShapeRarity.LEGENDARY]: 0.17,
        [ShapeRarity.MYTHICAL]: 0.1,
        [ShapeRarity.ETERNAL]: 0.055,
        [ShapeRarity.TRANSCENDENT]: 0.03,
        [ShapeRarity.GODLY]: 0.01,
        [ShapeRarity.DIVINE]: 0.003,
    },
};

export const getShapeRarityTable = (
    type: ShapeType,
    isInVoid: boolean,
): Record<ShapeRarity, ShapeRarityProfile> => {
    const baseConfig = isInVoid ? VOID_RARITY_CONFIG : RARITY_CONFIG;
    const overrides = (isInVoid ? VOID_SHAPE_RARITY_CHANCE_OVERRIDES : SHAPE_RARITY_CHANCE_OVERRIDES)[type];
    if (!overrides) return baseConfig;

    const merged = {} as Record<ShapeRarity, ShapeRarityProfile>;
    let totalChance = 0;

    for (const rarity of Object.values(ShapeRarity) as ShapeRarity[]) {
        const chance = overrides[rarity] ?? baseConfig[rarity].chance;
        merged[rarity] = { ...baseConfig[rarity], chance };
        totalChance += chance;
    }

    if (totalChance <= 0) return baseConfig;

    for (const rarity of Object.values(ShapeRarity) as ShapeRarity[]) {
        merged[rarity] = {
            ...merged[rarity],
            chance: merged[rarity].chance / totalChance,
        };
    }

    return merged;
};

// --- Shop Items ---

export const SHOP_ITEMS: ShopItem[] = [
    { 
        id: 'color_default', 
        name: 'Classic Blue', 
        type: 'color', 
        value: '#00b2e1', 
        price: 0, 
        rarity: 'common',
        description: 'Standard issue.'
    },
    { 
        id: 'color_arctic', 
        name: 'Arctic', 
        type: 'color', 
        value: '#80deea', 
        price: 250, 
        rarity: 'common',
        description: 'Stay frosty.'
    },
    { 
        id: 'color_forest', 
        name: 'Ranger', 
        type: 'color', 
        value: '#4caf50', 
        price: 250, 
        rarity: 'common',
        description: 'Camouflage.'
    },
    { 
        id: 'color_lilac', 
        name: 'Lilac', 
        type: 'color', 
        value: '#ce93d8', 
        price: 250, 
        rarity: 'common',
        description: 'Soft purple.'
    },
    { 
        id: 'color_toxic', 
        name: 'Toxic', 
        type: 'color', 
        value: '#00e16e', 
        price: 500, 
        rarity: 'rare',
        description: 'Radioactive glow.'
    },
    { 
        id: 'color_coral', 
        name: 'Coral', 
        type: 'color', 
        value: '#ff7043', 
        price: 500, 
        rarity: 'rare',
        description: 'Tropical heat.'
    },
    { 
        id: 'color_azure', 
        name: 'Azure', 
        type: 'color', 
        value: '#2979ff', 
        price: 750, 
        rarity: 'rare',
        description: 'Deep sea blue.'
    },
    { 
        id: 'color_neon_purple', 
        name: 'Neon', 
        type: 'color', 
        value: '#e100eb', 
        price: 1000, 
        rarity: 'rare',
        description: 'Vibrant style.'
    },
    { 
        id: 'color_imposter', 
        name: 'Imposter', 
        type: 'color', 
        value: '#ff3333', 
        price: 1500, 
        rarity: 'epic',
        description: 'Red spy.'
    },
    { 
        id: 'color_lemon', 
        name: 'Voltage', 
        type: 'color', 
        value: '#fff176', 
        price: 1500, 
        rarity: 'epic',
        description: 'High energy.'
    },
    { 
        id: 'color_gold', 
        name: 'Midas', 
        type: 'color', 
        value: '#ffd700', 
        price: 2500, 
        rarity: 'legendary',
        description: 'Solid gold.'
    },
    { 
        id: 'color_midnight', 
        name: 'Void', 
        type: 'color', 
        value: '#212121', 
        price: 5000, 
        rarity: 'legendary',
        description: 'Absorb light.'
    },
    { 
        id: 'color_platinum', 
        name: 'Platinum', 
        type: 'color', 
        value: '#e0e0e0', 
        price: 5000, 
        rarity: 'legendary',
        description: 'Pure metal.'
    },
    // Achievement Rewards
    { 
        id: 'skin_crimson', 
        name: 'Crimson', 
        type: 'color', 
        value: '#ff0000', 
        price: 0, 
        rarity: 'common',
        description: 'Unlocked by getting your first kill.',
        isAchievementReward: true
    },
    { 
        id: 'skin_elite_hunter', 
        name: 'Elite Hunter', 
        type: 'color', 
        value: '#ffcc00', 
        price: 0, 
        rarity: 'rare',
        description: 'Unlocked by defeating 50 elite bots.',
        isAchievementReward: true
    },
    { 
        id: 'skin_veteran_grey', 
        name: 'Veteran Grey', 
        type: 'color', 
        value: '#708090', 
        price: 0, 
        rarity: 'rare',
        description: 'Unlocked by completing 100 games.',
        isAchievementReward: true
    },
    { 
        id: 'skin_gold_trim', 
        name: 'Gold Trim', 
        type: 'color', 
        value: '#ffd700', 
        price: 0, 
        rarity: 'epic',
        description: 'Unlocked by reaching a score of 1,000,000.',
        isAchievementReward: true
    },
    { 
        id: 'skin_max_level', 
        name: 'Max Level', 
        type: 'color', 
        value: '#ffffff', 
        price: 0, 
        rarity: 'legendary',
        description: 'Unlocked by reaching Level 100.',
        isAchievementReward: true
    },
    { 
        id: 'skin_boss_core', 
        name: 'Boss Core', 
        type: 'color', 
        value: '#6e2cf2', 
        price: 0, 
        rarity: 'legendary',
        description: 'Unlocked by transforming into an Elite Boss 50 times.',
        isAchievementReward: true
    }
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Get your first kill.',
    category: 'kills',
    requirement: 1,
    rewardSkinId: 'skin_crimson',
    rewardCurrency: 250
  },
  {
    id: 'elite_slayer',
    name: 'Elite Slayer',
    description: 'Defeat 50 elite bots.',
    category: 'elite',
    requirement: 50,
    rewardSkinId: 'skin_elite_hunter',
    rewardCurrency: 900
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Complete 100 games.',
    category: 'games',
    requirement: 100,
    rewardSkinId: 'skin_veteran_grey',
    rewardCurrency: 1200
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Reach a score of 1,000,000.',
    category: 'score',
    requirement: 1000000,
    rewardSkinId: 'skin_gold_trim',
    rewardCurrency: 2500
  },
  {
    id: 'level_master',
    name: 'Level Master',
    description: 'Reach Level 100.',
    category: 'level',
    requirement: 100,
    rewardSkinId: 'skin_max_level',
    rewardCurrency: 3500
  },
  {
    id: 'transformer',
    name: 'Transformer',
    description: 'Transform into an Elite Boss 50 times.',
    category: 'special',
    requirement: 50,
    rewardSkinId: 'skin_boss_core',
    rewardCurrency: 5000
  },
  { id: 'kills_5', name: 'Scratch Damage', description: 'Get 5 kills.', category: 'kills', requirement: 5, rewardCurrency: 120 },
  { id: 'kills_10', name: 'Sharpened Barrel', description: 'Get 10 kills.', category: 'kills', requirement: 10, rewardCurrency: 180 },
  { id: 'kills_25', name: 'Street Cleaner', description: 'Get 25 kills.', category: 'kills', requirement: 25, rewardCurrency: 300 },
  { id: 'kills_50', name: 'Kill Line', description: 'Get 50 kills.', category: 'kills', requirement: 50, rewardCurrency: 550 },
  { id: 'kills_100', name: 'Hundred Down', description: 'Get 100 kills.', category: 'kills', requirement: 100, rewardCurrency: 900 },
  { id: 'kills_250', name: 'Arena Reaper', description: 'Get 250 kills.', category: 'kills', requirement: 250, rewardCurrency: 1400 },
  { id: 'kills_500', name: 'Killstorm', description: 'Get 500 kills.', category: 'kills', requirement: 500, rewardCurrency: 2200 },
  { id: 'kills_1000', name: 'Wipe Protocol', description: 'Get 1,000 kills.', category: 'kills', requirement: 1000, rewardCurrency: 3500 },
  { id: 'kills_2500', name: 'Predator Grid', description: 'Get 2,500 kills.', category: 'kills', requirement: 2500, rewardCurrency: 5200 },
  { id: 'kills_5000', name: 'Apex Eliminator', description: 'Get 5,000 kills.', category: 'kills', requirement: 5000, rewardCurrency: 8000 },

  { id: 'score_50k', name: 'Up and Running', description: 'Reach 50,000 score.', category: 'score', requirement: 50000, rewardCurrency: 220 },
  { id: 'score_100k', name: 'Momentum Shift', description: 'Reach 100,000 score.', category: 'score', requirement: 100000, rewardCurrency: 380 },
  { id: 'score_150k', name: 'Heat Build', description: 'Reach 150,000 score.', category: 'score', requirement: 150000, rewardCurrency: 520 },
  { id: 'score_250k', name: 'Sector Pressure', description: 'Reach 250,000 score.', category: 'score', requirement: 250000, rewardCurrency: 760 },
  { id: 'score_350k', name: 'Control Lane', description: 'Reach 350,000 score.', category: 'score', requirement: 350000, rewardCurrency: 980 },
  { id: 'score_500k', name: 'Half-Million Signal', description: 'Reach 500,000 score.', category: 'score', requirement: 500000, rewardCurrency: 1300 },
  { id: 'score_750k', name: 'Dominion Pulse', description: 'Reach 750,000 score.', category: 'score', requirement: 750000, rewardCurrency: 1800 },
  { id: 'score_1_25m', name: 'Million Plus', description: 'Reach 1,250,000 score.', category: 'score', requirement: 1250000, rewardCurrency: 2600 },
  { id: 'score_2m', name: 'Two-Million Run', description: 'Reach 2,000,000 score.', category: 'score', requirement: 2000000, rewardCurrency: 4200 },
  { id: 'score_3m', name: 'Myth Run', description: 'Reach 3,000,000 score.', category: 'score', requirement: 3000000, rewardCurrency: 6500 },

  { id: 'games_5', name: 'Pilot Verified', description: 'Complete 5 games.', category: 'games', requirement: 5, rewardCurrency: 100 },
  { id: 'games_10', name: 'Still Here', description: 'Complete 10 games.', category: 'games', requirement: 10, rewardCurrency: 160 },
  { id: 'games_25', name: 'Routine Combatant', description: 'Complete 25 games.', category: 'games', requirement: 25, rewardCurrency: 260 },
  { id: 'games_50', name: 'Session Veteran', description: 'Complete 50 games.', category: 'games', requirement: 50, rewardCurrency: 420 },
  { id: 'games_75', name: 'Field Regular', description: 'Complete 75 games.', category: 'games', requirement: 75, rewardCurrency: 620 },
  { id: 'games_150', name: 'Persistent Unit', description: 'Complete 150 games.', category: 'games', requirement: 150, rewardCurrency: 1000 },
  { id: 'games_250', name: 'Long Service', description: 'Complete 250 games.', category: 'games', requirement: 250, rewardCurrency: 1500 },
  { id: 'games_500', name: 'Archive Entry', description: 'Complete 500 games.', category: 'games', requirement: 500, rewardCurrency: 2600 },
  { id: 'games_750', name: 'Operational Core', description: 'Complete 750 games.', category: 'games', requirement: 750, rewardCurrency: 3800 },
  { id: 'games_1000', name: 'Legend of Rotation', description: 'Complete 1,000 games.', category: 'games', requirement: 1000, rewardCurrency: 5500 },

  { id: 'elite_1', name: 'Elite Ping', description: 'Defeat 1 elite bot.', category: 'elite', requirement: 1, rewardCurrency: 240 },
  { id: 'elite_3', name: 'Elite Contact', description: 'Defeat 3 elite bots.', category: 'elite', requirement: 3, rewardCurrency: 420 },
  { id: 'elite_10', name: 'Elite Hunter I', description: 'Defeat 10 elite bots.', category: 'elite', requirement: 10, rewardCurrency: 760 },
  { id: 'elite_25', name: 'Elite Hunter II', description: 'Defeat 25 elite bots.', category: 'elite', requirement: 25, rewardCurrency: 1200 },
  { id: 'elite_75', name: 'Elite Breaker', description: 'Defeat 75 elite bots.', category: 'elite', requirement: 75, rewardCurrency: 2200 },
  { id: 'elite_125', name: 'Elite Purge', description: 'Defeat 125 elite bots.', category: 'elite', requirement: 125, rewardCurrency: 3400 },
  { id: 'elite_250', name: 'Elite Obliterator', description: 'Defeat 250 elite bots.', category: 'elite', requirement: 250, rewardCurrency: 5600 },

  { id: 'level_15', name: 'Branch Ready', description: 'Reach Level 15.', category: 'level', requirement: 15, rewardCurrency: 140 },
  { id: 'level_30', name: 'Tier Unlock', description: 'Reach Level 30.', category: 'level', requirement: 30, rewardCurrency: 260 },
  { id: 'level_45', name: 'Late Tier', description: 'Reach Level 45.', category: 'level', requirement: 45, rewardCurrency: 420 },
  { id: 'level_60', name: 'Rebirth Candidate', description: 'Reach Level 60.', category: 'level', requirement: 60, rewardCurrency: 800 },
  { id: 'level_75', name: 'High Altitude', description: 'Reach Level 75.', category: 'level', requirement: 75, rewardCurrency: 1200 },
  { id: 'level_90', name: 'Near Apex', description: 'Reach Level 90.', category: 'level', requirement: 90, rewardCurrency: 1800 },

  { id: 'transform_1', name: 'First Shift', description: 'Transform into an Elite Boss once.', category: 'special', requirement: 1, rewardCurrency: 600 },
  { id: 'transform_5', name: 'Mutation Loop', description: 'Transform 5 times.', category: 'special', requirement: 5, rewardCurrency: 950 },
  { id: 'transform_10', name: 'Boss Cadet', description: 'Transform 10 times.', category: 'special', requirement: 10, rewardCurrency: 1400 },
  { id: 'transform_20', name: 'Boss Operator', description: 'Transform 20 times.', category: 'special', requirement: 20, rewardCurrency: 2200 },
  { id: 'transform_35', name: 'Boss Veteran', description: 'Transform 35 times.', category: 'special', requirement: 35, rewardCurrency: 3200 },
  { id: 'transform_75', name: 'Apex Morph', description: 'Transform 75 times.', category: 'special', requirement: 75, rewardCurrency: 6000 },

  { id: 'score_5m', name: 'Signal Overload', description: 'Reach 5,000,000 score.', category: 'score', requirement: 5000000, rewardCurrency: 10000 },
  { id: 'kills_10000', name: 'Last Witness', description: 'Get 10,000 kills.', category: 'kills', requirement: 10000, rewardCurrency: 12000 },
  { id: 'games_2000', name: 'Immortal Shift', description: 'Complete 2,000 games.', category: 'games', requirement: 2000, rewardCurrency: 15000 },
  { id: 'elite_500', name: 'Elite Extinction', description: 'Defeat 500 elite bots.', category: 'elite', requirement: 500, rewardCurrency: 14000 }
];

export const QUESTS: Quest[] = [
  { id: 'q001', name: 'Warm-Up', description: 'Defeat 10 enemies.', category: 'combat', requirement: 10, rewardCurrency: 350 },
  { id: 'q002', name: 'Skirmisher', description: 'Defeat 25 enemies.', category: 'combat', requirement: 25, rewardCurrency: 700 },
  { id: 'q003', name: 'Frontline', description: 'Defeat 50 enemies.', category: 'combat', requirement: 50, rewardCurrency: 1200 },
  { id: 'q004', name: 'Execution Line', description: 'Defeat 100 enemies.', category: 'combat', requirement: 100, rewardCurrency: 2200 },
  { id: 'q005', name: 'Sharpsight', description: 'Land 150 hits on enemy tanks.', category: 'combat', requirement: 150, rewardCurrency: 1300 },
  { id: 'q006', name: 'Pressure Fire', description: 'Land 300 hits on enemy tanks.', category: 'combat', requirement: 300, rewardCurrency: 2500 },
  { id: 'q007', name: 'Brawler', description: 'Deal 25,000 total damage.', category: 'combat', requirement: 25000, rewardCurrency: 1800 },
  { id: 'q008', name: 'Siegebreaker', description: 'Deal 60,000 total damage.', category: 'combat', requirement: 60000, rewardCurrency: 3600 },
  { id: 'q009', name: 'Elite Contact', description: 'Defeat 5 elite tanks.', category: 'combat', requirement: 5, rewardCurrency: 2600 },
  { id: 'q010', name: 'Elite Sweep', description: 'Defeat 15 elite tanks.', category: 'combat', requirement: 15, rewardCurrency: 6200 },

  { id: 'q011', name: 'Square Harvester', description: 'Destroy 200 squares.', category: 'farming', requirement: 200, rewardCurrency: 600 },
  { id: 'q012', name: 'Triangle Harvester', description: 'Destroy 150 triangles.', category: 'farming', requirement: 150, rewardCurrency: 800 },
  { id: 'q013', name: 'Pentagon Route', description: 'Destroy 60 pentagons.', category: 'farming', requirement: 60, rewardCurrency: 1300 },
  { id: 'q014', name: 'Dense Field', description: 'Destroy 500 total shapes.', category: 'farming', requirement: 500, rewardCurrency: 1700 },
  { id: 'q015', name: 'Resource Cycler', description: 'Destroy 1,000 total shapes.', category: 'farming', requirement: 1000, rewardCurrency: 3400 },
  { id: 'q016', name: 'Nest Diver', description: 'Destroy 120 shapes in central zones.', category: 'farming', requirement: 120, rewardCurrency: 1400 },
  { id: 'q017', name: 'Rare Echo', description: 'Destroy 20 rare-or-better shapes.', category: 'farming', requirement: 20, rewardCurrency: 2800 },
  { id: 'q018', name: 'Rare Purge', description: 'Destroy 50 rare-or-better shapes.', category: 'farming', requirement: 50, rewardCurrency: 5200 },
  { id: 'q019', name: 'Void Recycler', description: 'Destroy 120 shapes in the Void.', category: 'farming', requirement: 120, rewardCurrency: 2400 },
  { id: 'q020', name: 'Field Engineer', description: 'Collect 2,500 shape XP in one run.', category: 'farming', requirement: 2500, rewardCurrency: 1100 },

  { id: 'q021', name: 'Live Through It', description: 'Survive for 5 minutes.', category: 'survival', requirement: 300, rewardCurrency: 1100 },
  { id: 'q022', name: 'Still Standing', description: 'Survive for 10 minutes.', category: 'survival', requirement: 600, rewardCurrency: 2300 },
  { id: 'q023', name: 'Unbroken', description: 'Survive for 15 minutes.', category: 'survival', requirement: 900, rewardCurrency: 3800 },
  { id: 'q024', name: 'Last Frame', description: 'Survive with under 20% HP for 60s total.', category: 'survival', requirement: 60, rewardCurrency: 1700 },
  { id: 'q025', name: 'No Retreat', description: 'Get 20 kills without dying.', category: 'survival', requirement: 20, rewardCurrency: 2400 },
  { id: 'q026', name: 'Momentum', description: 'Get 40 kills without dying.', category: 'survival', requirement: 40, rewardCurrency: 4600 },
  { id: 'q027', name: 'Hard Shell', description: 'Block 800 incoming projectile damage.', category: 'survival', requirement: 800, rewardCurrency: 1900 },
  { id: 'q028', name: 'Shock Cushion', description: 'Block 2,000 incoming projectile damage.', category: 'survival', requirement: 2000, rewardCurrency: 3600 },
  { id: 'q029', name: 'Void Return', description: 'Enter and return from the Void 5 times.', category: 'survival', requirement: 5, rewardCurrency: 2000 },
  { id: 'q030', name: 'Late Game', description: 'Reach level 60 in a single run.', category: 'survival', requirement: 60, rewardCurrency: 5400 },

  { id: 'q031', name: 'Wingman', description: 'Assist in 25 enemy takedowns.', category: 'teamplay', requirement: 25, rewardCurrency: 1200 },
  { id: 'q032', name: 'Link Fire', description: 'Assist in 60 enemy takedowns.', category: 'teamplay', requirement: 60, rewardCurrency: 2600 },
  { id: 'q033', name: 'Zone Pressure', description: 'Spend 180 seconds contesting mid-map lanes.', category: 'teamplay', requirement: 180, rewardCurrency: 1400 },
  { id: 'q034', name: 'Anchor Breaker', description: 'Defeat 30 enemies near contested objectives.', category: 'teamplay', requirement: 30, rewardCurrency: 2100 },
  { id: 'q035', name: 'Combat Courier', description: 'Travel 15,000 units while in team mode.', category: 'teamplay', requirement: 15000, rewardCurrency: 1300 },
  { id: 'q036', name: 'Field Support', description: 'Restore or drain 15,000 total health.', category: 'teamplay', requirement: 15000, rewardCurrency: 2600 },
  { id: 'q037', name: 'Field Support II', description: 'Restore or drain 35,000 total health.', category: 'teamplay', requirement: 35000, rewardCurrency: 5200 },
  { id: 'q038', name: 'Signal Relay', description: 'Trigger your class ability 15 times.', category: 'teamplay', requirement: 15, rewardCurrency: 1000 },
  { id: 'q039', name: 'Signal Relay II', description: 'Trigger your class ability 35 times.', category: 'teamplay', requirement: 35, rewardCurrency: 2200 },
  { id: 'q040', name: 'Line Holder', description: 'Spend 240 seconds in active combat state.', category: 'teamplay', requirement: 240, rewardCurrency: 2800 },

  { id: 'q041', name: 'Boss Probe', description: 'Damage any boss for 5,000 total.', category: 'objective', requirement: 5000, rewardCurrency: 2400 },
  { id: 'q042', name: 'Boss Break', description: 'Damage any boss for 20,000 total.', category: 'objective', requirement: 20000, rewardCurrency: 5600 },
  { id: 'q043', name: 'Alpha Contact', description: 'Destroy 3 Alpha Pentagons.', category: 'objective', requirement: 3, rewardCurrency: 3200 },
  { id: 'q044', name: 'Alpha Collapse', description: 'Destroy 8 Alpha Pentagons.', category: 'objective', requirement: 8, rewardCurrency: 7600 },
  { id: 'q045', name: 'Portal Run', description: 'Use 10 Void portals.', category: 'objective', requirement: 10, rewardCurrency: 1600 },
  { id: 'q046', name: 'Portal Marshal', description: 'Use 25 Void portals.', category: 'objective', requirement: 25, rewardCurrency: 3800 },
  { id: 'q047', name: 'Rebirth Candidate', description: 'Reach rebirth eligibility 5 times.', category: 'objective', requirement: 5, rewardCurrency: 4200 },
  { id: 'q048', name: 'Rebirth Veteran', description: 'Reach rebirth eligibility 12 times.', category: 'objective', requirement: 12, rewardCurrency: 9800 },
  { id: 'q049', name: 'Titan Pressure', description: 'Defeat 6 rebirth-tier tanks.', category: 'objective', requirement: 6, rewardCurrency: 6400 },
  { id: 'q050', name: 'Master Rotation', description: 'Complete 20 full matches.', category: 'objective', requirement: 20, rewardCurrency: 5000 },
];

export const UPDATE_LOG = [
    {
        id: 'v1.9.6',
        title: "SYSTEMS OVERHAUL, SANDBOX BOSS UX, AND MENU REMASTER",
        date: "24/06/26",
        content: "This cycle turned into a much larger development pass than a normal patch. We rebuilt major menu and loading pieces, sped up the Almanac, pushed the Sandbox Boss Rush presentation much closer to a real command layout, improved bot intelligence and behaviour, expanded bot personality, and cleaned several combat and state-carryover issues. The focus was not just adding features, but making the whole game feel more coherent, faster to navigate, less noisy, and less unfair.",
        theme: "Menu / Loading / Almanac / Sandbox Bosses / AI / Audio / Combat",
        tags: ["Main Menu", "Loading", "Almanac", "Sandbox", "Boss Rush", "AI", "Audio", "Combat", "UX"],
        sections: [
            {
                label: "Main Menu And Presentation Overhaul",
                items: [
                    "Remastered the main menu into a cleaner command-deck style layout with less clutter, better spacing, fewer overlapping containers, and a stronger unified visual identity.",
                    "Refined leaderboard placement, modal presentation, update-log access, and menu-side navigation so the front end feels more intentional instead of crowded.",
                    "Improved tank preview presentation and related GUI consistency so the visual identity shown in menus better matches what players see in the game itself.",
                    "Pushed the updated colour theme further across connected UI surfaces so the game feels like one system rather than several disconnected skins.",
                ],
            },
            {
                label: "Loading Screen Remaster",
                items: [
                    "Rebuilt the split boot flow into a cleaner deterministic loading sequence with steadier progress and a more premium visual hierarchy.",
                    "Reduced flicker and skip-style presentation issues by collapsing redundant reveal behaviour and making the gate-to-loader handoff more consistent.",
                    "Improved loading layout, copy handling, and typography so large phase labels and status text behave better across tighter screen sizes.",
                    "Simplified the click-to-play gate and its transition logic so activation feels cleaner and less fragile.",
                ],
            },
            {
                label: "Almanac Performance Pass",
                items: [
                    "Simplified the Almanac structure so it behaves more like a fast intel archive and less like a heavy animated showcase.",
                    "Moved Almanac styling out of the hot mount path, reduced unnecessary motion and rerender pressure, and improved scroll behaviour during long reading sessions.",
                    "Added lighter preview behaviour and calmer section handling so repeated open-close use and category switching feel noticeably smoother.",
                    "Cleaned text and presentation issues while trimming visual noise, which makes the archive easier to scan and cheaper to render.",
                ],
            },
            {
                label: "Sandbox Boss Rush UX And Command Layout",
                items: [
                    "Redesigned the Sandbox playable Boss Rush ability interface into a more organised command layout that does not rely on awkward scrolling.",
                    "Improved heavy-pattern routing visibility, selection flow, and command readability so boss kits are easier to understand mid-match.",
                    "Worked on unifying boss combat information more aggressively, including reducing redundant health and integrity presentation clutter.",
                    "Improved boss preview and identity handling so Sandbox bosses feel closer to authentic Boss Rush units instead of placeholder conversions.",
                ],
            },
            {
                label: "Boss Audio, UI Feedback, And Sandbox Polish",
                items: [
                    "Expanded Boss Rush sound-design direction and routing so telegraphs, actions, and larger patterns feel heavier and less generic.",
                    "Disabled noisy or repetitive notifications during boss ability use and heavy-pattern switching so the Sandbox boss flow is less spammy.",
                    "Added more UI and presentation polish around boss usage, including cleaner command feedback and improved overlay feel.",
                    "Fixed boss-protocol carryover bugs, including cases where boss chassis or related state could persist where it should have cleared.",
                ],
            },
            {
                label: "Bot Intelligence And Behaviour Pass",
                items: [
                    "Bots now make better farming choices, ease off fresh low-level players more often, and stop behaving like permanent full-chase heat-seeking missiles.",
                    "Added stronger spawn-protection awareness and mercy logic so new or newly spawned players are less likely to be instantly dogpiled.",
                    "Improved Dominion caution and routing so bots are better at recognising bad pushes, regrouping, and avoiding obvious disaster lanes.",
                    "Expanded bot personality with larger British-humour name pools, mode-aware selection, and rarer legendary names that show up less often.",
                ],
            },
            {
                label: "Combat Fixes And Mechanical Cleanup",
                items: [
                    "Fixed bullet penetration behaviour that could visually jump through shapes and feel like teleporting on contact.",
                    "Made penetration damage behave more consistently while a bullet is moving through a target instead of spiking in awkward bursts.",
                    "Cleaned a wider set of menu, Sandbox, boss, and overlay edge cases uncovered during the broader remaster pass.",
                    "Validation for this release passed through npm run build after the integrated development sweep.",
                ],
            },
        ],
    },
];
