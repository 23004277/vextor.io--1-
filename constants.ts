
import { StatType, TankClass, ShopItem, ShapeType, ShapeRarity, Achievement } from './types';

export const BOT_NAMES = [
    'Spin2Team', 'ProGamer', 'Noob', 'Guest_123', 'VextorPilot', 'Tanky', 'SniperX', 'Destroyer',
    'Alpha', 'Omega', 'Vortex', 'Glitch', 'Hunter', 'Sentinel', 'Rogue', 'Wanderer', 'StrafingPro', 'KiteMaster',
    'IRONFANG', 'NullVector', 'HeavyMetal', 'CryoShot', 'VX-Reaper', 'WaffleCannon', 'SteelTitan', 'GhostDriver',
    'TankExe', 'OMEGA9', 'Rustbyte', 'KernelPanic', 'TurboRat', 'Dreadnova', 'WarMonger', 'QuantumShell',
    'Error404', 'BulletMantis', 'HexCannon', 'RogueTurret', 'AegisPrime', 'NightBarrage', 'ShockVector', 'RiftBreaker',
    'PulseRaptor', 'ZeroMercy', 'FrostSpiral', 'NovaClamp', 'BrickBreaker', 'Overclocked', 'IronPixel', 'BlitzNode',
    'TitanCore', 'DeadzoneX', 'ScorchWing', 'RailHowl', 'CinderBurst', 'AcidHalo', 'VantaStrike', 'GammaLance',
    'DeltaForge', 'SigmaDrive', 'KiloDrift', 'AtlasBurn', 'EchoSpine', 'CipherTank', 'ProxyPilot', 'AimGremlin',
    'PatchNotes', 'LagWizard', 'BoopBrigade', 'TankTopia', 'SkillIssue', 'SpinDoctor', 'OrbitEnjoyer', 'RecoilEnjoyer',
    'FlankEnjoyer', 'WKeyAgent', 'NoScopeUnit', 'UltraSweat', 'PeakTryhard', 'AngleAbuser', 'DashGremlin', 'HitScanSage',
    'StaticCharge', 'LaserMule', 'PlasmaWarden', 'IonMarshal', 'NebulaGrit', 'VoidLancer', 'AstraBunker', 'HyperNomad',
    'NeonPhantom', 'CoreBreaker', 'MagnetRuin', 'OverseerX', 'BinaryHowler', 'ChromeRaptor', 'ScrapOracle', 'ProxyAnvil',
    'TacticalToast', 'NoodleStrike', 'WobbleEngine', 'DonutSiege', 'MemeDestroyer', 'BananaArmor', 'PotatoTurret', 'CoffeeScope',
    'RetroByte', 'ArcadeKnight', 'PixelSmasher', 'CoinOpGhost', 'CRTPhantom', 'VectorVandal', 'CabinetKing', 'BitBandit',
    'DoomCircuit', 'AnvilProtocol', 'LethalOrbit', 'MarauderAI', 'PredatorNode', 'ScytheVector', 'RuinSeeker', 'RavagePilot',
    'BloodClock', 'NullWarden', 'CrimsonKernel', 'GhostLatch', 'VirusDrift', 'CorruptAxis', 'FaultLine', 'ShadowProcess',
    'SteelPraetor', 'NovaAdmiral', 'CipherGeneral', 'AxiomCommander', 'DreadCommodore', 'PrimeMarshal', 'ImperialNode', 'CommandUnit7',
    'UnitA13', 'UnitB47', 'UnitC99', 'AutoDirective', 'LogicSentinel', 'FactoryMind', 'DroneMatrix', 'ColdProtocol',
    'FrontlineWolf', 'FlankHunter', 'MidControl', 'ZoneDenial', 'HardPush', 'MapPressure', 'PointBreaker', 'BacklineRaider',
    'EMPioneer', 'ShockAnchor', 'ThermalSpike', 'RazorFurnace', 'TalonVector', 'SpectralRam', 'MeteorJaw', 'BlightEngine',
    'RiftHarrier', 'QuantumDagger', 'ArcPulse', 'NanoCrusher', 'MachRider', 'PulseNomad', 'StaticRuin', 'FissionClaw',
    'DeadeyeV2', 'TargetLock', 'CoreSunder', 'LineBreaker', 'GigaRecoil', 'BurstRanger', 'PinpointUnit', 'SnareVector',
    'GhostPilot77', 'RaptorMouth', 'TitanGrin', 'SteelMonk', 'NeonBasilisk', 'OmegaPulse', 'HardReset', 'GridSniper',
    'BlueProtocol', 'RedProtocol', 'ZenithArray', 'CrosshairCult', 'BunkerBuster', 'RammingSpeed', 'ArmorPiercer', 'HullBreaker',
    'MuzzleFlash', 'VectorSlinger', 'TriggerDiscipline', 'BurstDiscipline', 'ScoutSigma', 'WardenDelta', 'HarrierKappa', 'TangentZero'
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
    healthSacrificeRatio: 0.22,
    activeSeconds: 6.0,
    lifestealAuraMultiplier: 2.0,
    decayStackDuration: 4.0,
    decayTickSeconds: 0.5,
    decayDamagePerStackRatio: 0.012,
    cooldownSeconds: 12,
  },
} as const;

export const COLORS = {
  background: '#cdcdcd', // Grid lines
  backgroundFill: '#b4b4b4',
  player: '#00b2e1', // Blue Team Color
  enemy: '#f14e54',  // Red Team Color
  square: '#ffe869',
  triangle: '#fc7677',
  pentagon: '#768dfc',
  hexagon: '#9f76fc', // Purple-ish Hexagon
  octagon: '#ffcc33', // Vibrant Gold/Amber
  crasher: '#f177dd', // Pink Crasher color
  barrel: '#999999',
  border: '#555555',
  text: '#ffffff',
  uiBackground: 'rgba(0, 0, 0, 0.4)',
  voidBackground: '#0a0a0a',
  voidPortal: '#6e2cf2',
};

export const XP_CURVE_MULTIPLIER = 1.09; // Flattened curve to support 100 levels without extreme XP requirements
export const MAX_LEVEL = 100;
export const REBIRTH_LEVEL = 60;
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
  [TankClass.BASIC]: [TankClass.TWIN, TankClass.SNIPER, TankClass.MACHINE_GUN, TankClass.FLANK_GUARD, TankClass.PACIFIST_TRAINEE, TankClass.DRAINER_TRAINEE],
  [TankClass.PACIFIST_TRAINEE]: [TankClass.NURSE],
  [TankClass.NURSE]: [TankClass.DOCTOR],
  [TankClass.DOCTOR]: [TankClass.PLAGUE_DOCTOR],
  [TankClass.DRAINER_TRAINEE]: [TankClass.LEECH],
  [TankClass.LEECH]: [TankClass.VAMPIRE],
  [TankClass.VAMPIRE]: [TankClass.REAPER],
  // Tier 2 -> Tier 3
  [TankClass.TWIN]: [TankClass.TRIPLE_SHOT, TankClass.QUAD_TANK, TankClass.TWIN_FLANK],
  [TankClass.SNIPER]: [TankClass.ASSASSIN, TankClass.OVERSEER, TankClass.HUNTER],
  [TankClass.MACHINE_GUN]: [TankClass.DESTROYER, TankClass.GUNNER, TankClass.SPRAYER],
  [TankClass.FLANK_GUARD]: [TankClass.TRI_ANGLE, TankClass.QUAD_TANK],
  
  // Tier 3 -> Tier 4 (Level 45)
  [TankClass.TRIPLE_SHOT]: [TankClass.PENTA_SHOT, TankClass.SPREAD_SHOT, TankClass.TRIPLE_TANK],
  [TankClass.QUAD_TANK]: [TankClass.OCTO_TANK],
  [TankClass.TWIN_FLANK]: [TankClass.TRIPLE_TWIN],
  [TankClass.ASSASSIN]: [TankClass.RANGER, TankClass.STALKER],
  [TankClass.HUNTER]: [TankClass.X_HUNTER, TankClass.STREAMLINER],
  [TankClass.OVERSEER]: [TankClass.OVERLORD, TankClass.MANAGER],
  [TankClass.DESTROYER]: [TankClass.HYBRID, TankClass.ANNIHILATOR],
  [TankClass.GUNNER]: [TankClass.AUTO_GUNNER, TankClass.STREAMLINER],
  [TankClass.TRI_ANGLE]: [TankClass.BOOSTER, TankClass.FIGHTER],
  [TankClass.SPRAYER]: [],

  // Tier 4 (Finals)
  [TankClass.TRIPLE_TWIN]: [],
  [TankClass.OCTO_TANK]: [],
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
  [TankClass.MACHINE_GUN]: [[1.6, 0.8, 0, 0, 0.22, 0, 2.1]], 
  [TankClass.FLANK_GUARD]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.6, 0.8, 0, Math.PI, 1, 0],
  ],
  // Tier 3
  [TankClass.TRIPLE_SHOT]: [
    [1.9, 0.8, 0, 0, 1, 0],
    [1.8, 0.8, 0, -Math.PI / 4, 1, 0],
    [1.8, 0.8, 0, Math.PI / 4, 1, 0],
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
    // Crown emitters (high-velocity stream shell)
    [1.58, 0.38, 0.08, 0.09, 0.2, 0.72, 1.95],
    [1.58, 0.38, 0.08, -0.09, 0.2, -0.72, 1.95],
    // Mid emitters
    [1.74, 0.45, 0.05, 0.055, 0.24, 0.44, 1.65],
    [1.74, 0.45, 0.05, -0.055, 0.24, -0.44, 1.65],
    // Heavy inner pressure nozzle (signature core cannon)
    [2.16, 1.08, -0.02, 0, 0.38, 0, 0.52],
    // Rear vent stabilizers (high spread assist)
    [1.42, 0.36, -0.14, 0.12, 0.22, 0.88, 2.15],
    [1.42, 0.36, -0.14, -0.12, 0.22, -0.88, 2.15],
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
  [TankClass.GUNNER]: [
    [1.95, 0.42, 0.05, 0.02, 0.62, 0.22],
    [1.95, 0.42, 0.05, -0.02, 0.62, -0.22],
    [1.65, 0.54, -0.03, 0.03, 0.86, 0.52],
    [1.65, 0.54, -0.03, -0.03, 0.86, -0.52],
    [1.35, 0.62, -0.1, 0, 1.1, 0],
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
  [TankClass.TRIPLE_TANK]: [
    [1.9, 0.8, 0, 0, 1.0, 0.6], 
    [1.9, 0.8, 0, 0, 1.0, -0.6], 
    [2.1, 0.8, 0, 0, 1.0, 0],
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
    [2.3, 0.6, 0, 0, 0.2, 0],
    [2.1, 0.6, 0, 0, 0.2, 0],
    [1.9, 0.6, 0, 0, 0.2, 0],
    [1.7, 0.6, 0, 0, 0.2, 0],
    [1.5, 0.6, 0, 0, 0.2, 0],
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
    // 5 Massive flared cannons (Annihilator style)
    [2.2, 1.2, 0, 0, 4.0, 0, 1.6],
    [2.2, 1.2, 0, (2 * Math.PI) / 5, 4.0, 0, 1.6],
    [2.2, 1.2, 0, (4 * Math.PI) / 5, 4.0, 0, 1.6],
    [2.2, 1.2, 0, -(4 * Math.PI) / 5, 4.0, 0, 1.6],
    [2.2, 1.2, 0, -(2 * Math.PI) / 5, 4.0, 0, 1.6],
  ],
  [TankClass.LEVIATHAN]: [
    // 4 Long tapered needle cannons
    [2.8, 1.5, 0, 0, 3.0, 0, 0.3],
    [2.8, 1.5, 0, Math.PI / 2, 3.0, 0, 0.3],
    [2.8, 1.5, 0, Math.PI, 3.0, 0, 0.3],
    [2.8, 1.5, 0, -Math.PI / 2, 3.0, 0, 0.3],
  ],
  [TankClass.WARLORD]: [
    // 2 massive wide wall-cannons (front and back)
    [1.8, 2.5, 0, 0, 3.0, 0, 1.0],
    [1.8, 2.5, 0, Math.PI, 3.0, 0, 1.0],
    // 2 heavy side flared cannons
    [1.5, 1.2, 0, Math.PI / 2, 2.0, 0, 1.2],
    [1.5, 1.2, 0, -Math.PI / 2, 2.0, 0, 1.2],
  ],
  [TankClass.CELESTIAL]: [
    // Central gravitic lance + tri-point defense emitters
    [2.45, 1.05, 0, 0, 1.7, 0, 0.65],
    [1.55, 0.72, 0.05, Math.PI / 3, 0.55, 0.3, 1.35],
    [1.55, 0.72, 0.05, -Math.PI / 3, 0.55, -0.3, 1.35],
    [1.35, 0.65, 0.02, Math.PI, 0.55, 0, 1.2],
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
    [2.4, 1.2, 0, 0, 1.0, 0], // Main Scythe Shaft (visual)
    [1.4, 0.8, 0, Math.PI / 2, 1.0, 1.2], // Scythe Blade part 1
    [1.4, 0.8, 0, -Math.PI / 2, 1.0, -1.2], // Scythe Blade part 2
    [1.0, 1.5, 0, Math.PI, 1.0, 0] // Back heavy guard
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
};

// --- Shape Stats ---

export const SHAPE_STATS: Record<ShapeType, { health: number; xp: number; damage: number; radius: number; color: string; sides: number }> = {
    [ShapeType.SQUARE]: { health: 25, xp: 45, damage: 8, radius: 12.5, color: COLORS.square, sides: 4 },
    [ShapeType.TRIANGLE]: { health: 80, xp: 300, damage: 14, radius: 18.75, color: COLORS.triangle, sides: 3 },
    [ShapeType.PENTAGON]: { health: 300, xp: 1200, damage: 20, radius: 31.25, color: COLORS.pentagon, sides: 5 },
    [ShapeType.HEXAGON]: { health: 800, xp: 4500, damage: 35, radius: 50, color: COLORS.hexagon, sides: 6 },
    [ShapeType.OCTAGON]: { health: 2500, xp: 15000, damage: 60, radius: 110, color: COLORS.octagon, sides: 8 },
};

export const BOSS_STATS: Record<string, { id: string; name: string; health: number; xp: number; radius: number; color: string; sides: number; description: string }> = {
    ALPHA_PENTAGON: {
        id: 'alpha_pentagon',
        name: 'Alpha Pentagon',
        health: 3000,
        xp: 3000,
        radius: 100,
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

export const RARITY_CONFIG: Record<ShapeRarity, { xpMult: number; hpMult: number; chance: number; color?: string; sizeMult: number }> = {
    [ShapeRarity.COMMON]: { xpMult: 1, hpMult: 1, chance: 0.72, sizeMult: 1.0 },
    [ShapeRarity.UNCOMMON]: { xpMult: 2, hpMult: 1.5, chance: 0.18, sizeMult: 1.0 },
    [ShapeRarity.RARE]: { xpMult: 5, hpMult: 3, chance: 0.06, color: '#50ef95', sizeMult: 1.3 },
    [ShapeRarity.EPIC]: { xpMult: 20, hpMult: 10, chance: 0.015, color: '#ffd700', sizeMult: 1.7 },
    [ShapeRarity.LEGENDARY]: { xpMult: 100, hpMult: 50, chance: 0.005, color: '#ff5e00', sizeMult: 2.2 },
    [ShapeRarity.MYTHICAL]: { xpMult: 500, hpMult: 250, chance: 0.001, color: '#a200ff', sizeMult: 2.8 },
    [ShapeRarity.ETERNAL]: { xpMult: 2500, hpMult: 1200, chance: 0.0004, color: '#00ffff', sizeMult: 3.5 },
    [ShapeRarity.TRANSCENDENT]: { xpMult: 10000, hpMult: 5000, chance: 0.0002, color: '#ffffff', sizeMult: 5.0 },
    [ShapeRarity.GODLY]: { xpMult: 50000, hpMult: 25000, chance: 0.00005, color: '#ff00ff', sizeMult: 7.0 },
    [ShapeRarity.DIVINE]: { xpMult: 200000, hpMult: 100000, chance: 0.00001, color: '#6e2cf2', sizeMult: 10.0 },
};

export const VOID_RARITY_CONFIG: Record<ShapeRarity, { xpMult: number; hpMult: number; chance: number; color?: string; sizeMult: number }> = {
    [ShapeRarity.COMMON]: { xpMult: 1, hpMult: 1, chance: 0.25, sizeMult: 1.0 },
    [ShapeRarity.UNCOMMON]: { xpMult: 2, hpMult: 1.5, chance: 0.25, sizeMult: 1.0 },
    [ShapeRarity.RARE]: { xpMult: 5, hpMult: 3, chance: 0.22, color: '#50ef95', sizeMult: 1.3 },
    [ShapeRarity.EPIC]: { xpMult: 20, hpMult: 10, chance: 0.18, color: '#ffd700', sizeMult: 1.7 },
    [ShapeRarity.LEGENDARY]: { xpMult: 100, hpMult: 50, chance: 0.06, color: '#ff5e00', sizeMult: 2.2 },
    [ShapeRarity.MYTHICAL]: { xpMult: 500, hpMult: 250, chance: 0.025, color: '#a200ff', sizeMult: 2.8 },
    [ShapeRarity.ETERNAL]: { xpMult: 2500, hpMult: 1200, chance: 0.008, color: '#00ffff', sizeMult: 3.5 },
    [ShapeRarity.TRANSCENDENT]: { xpMult: 10000, hpMult: 5000, chance: 0.002, color: '#ffffff', sizeMult: 5.0 },
    [ShapeRarity.GODLY]: { xpMult: 50000, hpMult: 25000, chance: 0.0008, color: '#ff00ff', sizeMult: 7.0 },
    [ShapeRarity.DIVINE]: { xpMult: 200000, hpMult: 100000, chance: 0.0002, color: '#6e2cf2', sizeMult: 10.0 },
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
    rewardSkinId: 'skin_crimson'
  },
  {
    id: 'elite_slayer',
    name: 'Elite Slayer',
    description: 'Defeat 50 elite bots.',
    category: 'elite',
    requirement: 50,
    rewardSkinId: 'skin_elite_hunter'
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Complete 100 games.',
    category: 'games',
    requirement: 100,
    rewardSkinId: 'skin_veteran_grey'
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Reach a score of 1,000,000.',
    category: 'score',
    requirement: 1000000,
    rewardSkinId: 'skin_gold_trim'
  },
  {
    id: 'level_master',
    name: 'Level Master',
    description: 'Reach Level 100.',
    category: 'level',
    requirement: 100,
    rewardSkinId: 'skin_max_level'
  },
  {
    id: 'transformer',
    name: 'Transformer',
    description: 'Transform into an Elite Boss 50 times.',
    category: 'special',
    requirement: 50,
    rewardSkinId: 'skin_boss_core'
  }
];

export const UPDATE_LOG = [
    { id: 'v1.6.0', title: "ACHIEVEMENT_PROTOCOL", date: "MAR 2026", content: "Deployed tactical achievement system. Earn exclusive chassis variants through combat milestones and elite eliminations." },
    { id: 'v1.5.0', title: "TACTICAL_REMASTER", date: "MAR 2026", content: "Redesigned Vextor_OS Almanac. Implemented dynamic regeneration scaling. Added custom tactical cursor interface." },
    { id: 'v1.4.8', title: "SOCIAL_LINK_SYNC", date: "FEB 2026", content: "Integrated tactical Discord hub. Added dedicated Support protocols for Pilot assistance." },
    { id: 'v1.4.5', title: "UI_OVERHAUL", date: "JAN 2026", content: "Main menu remastered for tactical clarity. Optimized scroll navigation." },
];
