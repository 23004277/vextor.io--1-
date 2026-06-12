
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameMode, GameSettings, GameState, HighScoreEntry, PlayerState, SecondarySector, StatType, TankClass, Team, ShapeType, ShapeRarity } from '../types';
import { CLASS_TREE, COLORS, STAT_COLORS, TANK_CONFIGS } from '../constants';
import { TankPreview } from './TankPreview';
import { ShapePreview } from './ShapePreview';
import { TacticalMinimap } from './TacticalMinimap';
import { formatScoreValue } from '../services/MathUtils';
import { Search, SlidersHorizontal, FlaskConical, Cpu, Boxes, MousePointer2, HeartPulse, Droplets } from 'lucide-react';

interface UIOverlayProps {
  gameState: GameState;
  onUpgradeStat: (stat: StatType) => void;
  onUpgradeClass: (cls: TankClass) => void;
  onUpgradeSector: (sector: SecondarySector) => void;
  onRestart: () => void;
  onExit: () => void;
  highScores: HighScoreEntry[];
  playHover?: () => void;
  engine?: any;
  settings: GameSettings;
  deathReport?: { moneyEarned: number; unlockedAchievements: number; unlockedQuests: number } | null;
}

const STAT_ORDER = [
  StatType.REGEN,
  StatType.MAX_HEALTH,
  StatType.BODY_DAMAGE,
  StatType.BULLET_SPEED,
  StatType.BULLET_PENETRATION,
  StatType.BULLET_DAMAGE,
  StatType.RELOAD,
  StatType.MOVEMENT_SPEED,
  StatType.BULLET_SPREAD,
  StatType.MAX_SHIELD,
];

type SandboxTab = 'SYSTEM' | 'RESEARCH' | 'SPAWN';
const SANDBOX_RESEARCH_ICON_REV = '2026-06-11-sandbox-preview-remaster';
const isTrapperBranchClass = (cls: TankClass): boolean =>
  cls === TankClass.TRAPPER ||
  cls === TankClass.DUAL_TRAPPER ||
  cls === TankClass.MACHINE_GUN_TRAPPER ||
  cls === TankClass.OCTO_TRAPPER ||
  cls === TankClass.TRIPLE_TRAPPER;

const SANDBOX_TAB_META: Record<SandboxTab, { label: string; icon: any; hint: string }> = {
  SYSTEM: { label: 'World', icon: Cpu, hint: 'Simulation controls' },
  RESEARCH: { label: 'Tanks', icon: FlaskConical, hint: 'Class research and swap' },
  SPAWN: { label: 'Entities', icon: Boxes, hint: 'Spawner and templates' },
};

const formatDisplayName = (value: string | null | undefined): string => {
  const stripped = String(value || '')
    .replace(/^(?:[\*\u25c6\u25cf]\s*)?(?:BLU|BLUE|RED)\s+/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || 'Unknown';
};

const getTeamAccent = (team: Team): string => {
  if (team === Team.BLUE) return COLORS.player;
  if (team === Team.RED) return COLORS.enemy;
  if (team === Team.GREEN) return COLORS.allyGreen;
  if (team === Team.PURPLE) return COLORS.allyPurple;
  return COLORS.dominionNeutral;
};

const getTeamRowClass = (team: Team, isPlayer: boolean): string => {
  if (team === Team.BLUE) return isPlayer ? 'bg-cyan-500/18 text-cyan-100' : 'bg-cyan-500/8 text-cyan-50';
  if (team === Team.RED) return isPlayer ? 'bg-rose-500/18 text-rose-100' : 'bg-rose-500/8 text-rose-50';
  if (team === Team.GREEN) return isPlayer ? 'bg-emerald-500/18 text-emerald-100' : 'bg-emerald-500/8 text-emerald-50';
  if (team === Team.PURPLE) return isPlayer ? 'bg-violet-500/18 text-violet-100' : 'bg-violet-500/8 text-violet-50';
  return isPlayer ? 'bg-cyan-500/12 text-cyan-200' : 'text-white/80';
};

const CLASS_CATEGORIES = [
    {
        name: "Assault",
        classes: [
            TankClass.TWIN, 
            TankClass.TRIPLE_SHOT, 
            TankClass.TWIN_FLANK, 
            TankClass.PENTA_SHOT, 
            TankClass.SPREAD_SHOT, 
            TankClass.TRIPLE_TWIN
        ]
    },
    {
        name: "Precision",
        classes: [
            TankClass.SNIPER, 
            TankClass.ASSASSIN, 
            TankClass.HUNTER, 
            TankClass.RANGER, 
            TankClass.STALKER, 
            TankClass.X_HUNTER, 
            TankClass.STREAMLINER
        ]
    },
    {
        name: "Impact",
        classes: [
            TankClass.MACHINE_GUN, 
            TankClass.DESTROYER, 
            TankClass.SPRAYER, 
            TankClass.GUNNER, 
            TankClass.ANNIHILATOR, 
            TankClass.HYBRID, 
            TankClass.AUTO_GUNNER
        ]
    },
    {
        name: "Tactical",
        classes: [
            TankClass.FLANK_GUARD, 
            TankClass.TRI_ANGLE, 
            TankClass.QUAD_TANK, 
            TankClass.BOOSTER, 
            TankClass.FIGHTER, 
            TankClass.OCTO_TANK, 
            TankClass.TRAPPER,
            TankClass.DUAL_TRAPPER,
            TankClass.MACHINE_GUN_TRAPPER,
            TankClass.OCTO_TRAPPER,
            TankClass.TRIPLE_TRAPPER,
            TankClass.OVERSEER, 
            TankClass.OVERLORD, 
            TankClass.MANAGER, 
            TankClass.TRIPLE_TANK
        ]
    },
    {
        name: "Rebirth",
        classes: [
            TankClass.COLOSSAL,
            TankClass.LEVIATHAN,
            TankClass.WARLORD,
            TankClass.CELESTIAL,
            TankClass.OBLITERATOR
        ]
    }
];

const SANDBOX_BOSS_CLASSES: TankClass[] = [
  TankClass.COLOSSAL,
  TankClass.LEVIATHAN,
  TankClass.WARLORD,
  TankClass.CELESTIAL,
  TankClass.OBLITERATOR,
];

const SANDBOX_ELITE_CLASS_TEMPLATES: TankClass[] = [
  TankClass.DESTROYER,
  TankClass.SNIPER,
  TankClass.OVERLORD,
  TankClass.TRAPPER,
];

const SANDBOX_DOMINION_PROFILES: Array<{ id: 'DESTROYER' | 'GUNNER' | 'TRAPPER' | 'TRIPLE'; label: string; classType: TankClass; note: string }> = [
  { id: 'DESTROYER', label: 'Destroyer Dominion', classType: TankClass.DESTROYER, note: 'Siege shell guardian' },
  { id: 'GUNNER', label: 'Gunner Dominion', classType: TankClass.GUNNER, note: 'Suppression lattice' },
  { id: 'TRAPPER', label: 'Octo Trapper', classType: TankClass.OCTO_TRAPPER, note: 'Area denial starfield' },
  { id: 'TRIPLE', label: 'Triple Dominion', classType: TankClass.TRIPLE_TANK, note: 'Balanced lane pressure' },
];

const getSandboxPreviewPose = (cls: TankClass): { turretRotation: number; chassisRotation: number } => {
  if (cls === TankClass.TRAPPER) return { turretRotation: -8, chassisRotation: 4 };
  if (cls === TankClass.DUAL_TRAPPER) return { turretRotation: -12, chassisRotation: 6 };
  if (cls === TankClass.MACHINE_GUN_TRAPPER) return { turretRotation: -6, chassisRotation: 4 };
  if (cls === TankClass.OCTO_TRAPPER) return { turretRotation: 14, chassisRotation: 10 };
  if (cls === TankClass.TRIPLE_TRAPPER) return { turretRotation: 8, chassisRotation: 5 };
  if (cls === TankClass.DESTROYER || cls === TankClass.ANNIHILATOR) return { turretRotation: -10, chassisRotation: 3 };
  if (cls === TankClass.GUNNER || cls === TankClass.AUTO_GUNNER) return { turretRotation: 10, chassisRotation: -4 };
  if (cls === TankClass.OVERLORD || cls === TankClass.OVERSEER || cls === TankClass.MANAGER) return { turretRotation: -14, chassisRotation: 8 };
  if (cls === TankClass.COLOSSAL || cls === TankClass.LEVIATHAN || cls === TankClass.WARLORD || cls === TankClass.CELESTIAL || cls === TankClass.OBLITERATOR) {
    return { turretRotation: -16, chassisRotation: 6 };
  }
  return { turretRotation: -6, chassisRotation: 2 };
};

export const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, onUpgradeStat, onUpgradeClass, onUpgradeSector, onRestart, onExit, highScores, playHover, engine, settings, deathReport }) => {
  const { 
    score, level, xp, maxXp, stats, availableStatPoints, mainClass, currentClass, secondarySector, isDead, fps, killFeed, 
    leaderboard, health, maxHealth, camera, mapSize, gameMode, 
    notifications, inVoid, voidTimeRemaining, isTransformed, transformationTime, 
    transformationReady, activeBuffs, minimapMarkers, sandboxConfig, primedSpawn, abilityHud,
    playerState, evolutionTransitionRemaining, bossChoices, enemyZoneWarningLevel, enemyZoneWarningText,
    bloodDrainLive, bloodDrainStacks, bloodDrainSession, rebirthEligible, dominionScores, dominionOwnedCount, dominionTimeRemaining, dominionZones,
    botChatBubbles = [], deathPresentation,
    voidTransitStage, voidTransitProgress
  } = gameState;

  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SandboxTab>('SYSTEM');
  const [selectedRarity, setSelectedRarity] = useState<ShapeRarity>(ShapeRarity.COMMON);
  const [spawnAmount, setSpawnAmount] = useState(1);
  const [showStatsMenu, setShowStatsMenu] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchSector, setResearchSector] = useState<string>('ALL');
  const [sandboxButtonPulse, setSandboxButtonPulse] = useState(false);
  const [displayHealthValue, setDisplayHealthValue] = useState(health);
  const [displayXpPercent, setDisplayXpPercent] = useState(0);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }));
  const healthTweenRef = useRef<number>(health);
  const xpTweenRef = useRef<number>(0);

  const resolvePreviewClass = (cls: TankClass): TankClass => {
    // Fallback keeps research grid stable if a future class key is renamed but not yet remapped.
    return TANK_CONFIGS[cls] ? cls : TankClass.BASIC;
  };
  const isRebirthPreviewClass = (cls: TankClass): boolean =>
    cls === TankClass.COLOSSAL ||
    cls === TankClass.LEVIATHAN ||
    cls === TankClass.WARLORD ||
    cls === TankClass.CELESTIAL ||
    cls === TankClass.OBLITERATOR;
  const researchCategories = useMemo(() => {
    const q = researchQuery.trim().toLowerCase();
    return CLASS_CATEGORIES
      .filter(cat => researchSector === 'ALL' || cat.name === researchSector)
      .map(cat => ({
        ...cat,
        classes: cat.classes.filter(cls => {
          if (!q) return true;
          const clsName = String(cls).toLowerCase();
          return clsName.includes(q) || cat.name.toLowerCase().includes(q);
        })
      }))
      .filter(cat => cat.classes.length > 0);
  }, [researchQuery, researchSector]);

  const xpPercent = Math.min(100, (xp / maxXp) * 100);
  const scoreLabel = formatScoreValue(score, settings.compactScoreNotation);
  const availableClasses = CLASS_TREE[mainClass] || [];
  const getClassUpgradeLevelRequirement = (targetClass: TankClass): number => {
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
  };
  const unlockableClasses = availableClasses.filter(cls => level >= getClassUpgradeLevelRequirement(cls as TankClass));
  
  const showBossChoiceUI = playerState === PlayerState.BOSS_SELECTION;
  const showSectorChoiceUI = playerState === PlayerState.SECTOR_SELECTION;
  const showStandardUpgrades = !showBossChoiceUI && !showSectorChoiceUI && (unlockableClasses.length > 0 && !isTransformed) && gameMode !== GameMode.SANDBOX;
  const isRebirthClass = currentClass === TankClass.COLOSSAL || currentClass === TankClass.LEVIATHAN || currentClass === TankClass.WARLORD || currentClass === TankClass.CELESTIAL || currentClass === TankClass.OBLITERATOR;
  const showStatUpgradeUI = showStatsMenu && !showStandardUpgrades && !isRebirthClass;

  useEffect(() => {
    if (availableStatPoints > 0 && !showStandardUpgrades) {
      setShowStatsMenu(true);
    } else {
      const timer = setTimeout(() => setShowStatsMenu(false), 300);
      return () => clearTimeout(timer);
    }
  }, [availableStatPoints, showStandardUpgrades]);

  useEffect(() => {
    let rafId = 0;
    const targetHealth = Math.max(0, health);
    const targetXpPercent = xpPercent;

    const animate = () => {
      const nextHealth = healthTweenRef.current + (targetHealth - healthTweenRef.current) * 0.22;
      const nextXp = xpTweenRef.current + (targetXpPercent - xpTweenRef.current) * 0.14;

      healthTweenRef.current = Math.abs(nextHealth - targetHealth) < 0.08 ? targetHealth : nextHealth;
      xpTweenRef.current = Math.abs(nextXp - targetXpPercent) < 0.08 ? targetXpPercent : nextXp;

      setDisplayHealthValue(healthTweenRef.current);
      setDisplayXpPercent(xpTweenRef.current);

      if (
        Math.abs(healthTweenRef.current - targetHealth) > 0.01 ||
        Math.abs(xpTweenRef.current - targetXpPercent) > 0.01
      ) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    rafId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(rafId);
  }, [health, xpPercent]);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const topFiveLeaderboard = useMemo(() => leaderboard.slice(0, 5), [leaderboard]);
  const isTeamMode = gameMode === GameMode.TEAMS || gameMode === GameMode.DOMINION;
  const dominionScoreRows = useMemo(() => {
    if (gameMode !== GameMode.DOMINION) return [];
    const teams = [Team.BLUE, Team.RED, Team.GREEN, Team.PURPLE];
    return teams.map((team) => ({
      team,
      score: dominionScores?.[team] ?? 0,
      owned: dominionOwnedCount?.[team] ?? 0,
      accent: getTeamAccent(team),
    })).sort((a, b) => b.score - a.score);
  }, [dominionOwnedCount, dominionScores, gameMode]);
  const dominionTimerLabel = useMemo(() => {
    if (typeof dominionTimeRemaining !== 'number') return '--:--';
    const total = Math.max(0, Math.floor(dominionTimeRemaining));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [dominionTimeRemaining]);
  const scoreLabelTone = level >= 150 ? 'text-amber-200' : level >= 90 ? 'text-cyan-100' : 'text-white';
  const compactCurrentClass = String(mainClass || currentClass || 'Basic Tank').replace(/\s+Tank$/i, '').trim();
  const sectorLabel = secondarySector === 'restoration' ? 'Restoration Sector' : secondarySector === 'blood' ? 'Blood Sector' : 'No Sector';
  const contestedDominionCount = dominionZones?.filter((zone) => zone.contested).length ?? 0;
  const deathCardVisible = deathPresentation?.cardVisible ?? isDead;
  const deathFadeProgress = deathPresentation?.fadeProgress ?? 1;
  const botBubbleRenderData = useMemo(() => {
    return botChatBubbles
      .map((bubble) => {
        const x = (bubble.worldPos.x - camera.x) * camera.zoom + viewportSize.width * 0.5;
        const y = (bubble.worldPos.y - camera.y) * camera.zoom + viewportSize.height * 0.5;
        return { ...bubble, screenX: x, screenY: y };
      })
      .filter((bubble) => bubble.screenX > -260 && bubble.screenX < viewportSize.width + 260 && bubble.screenY > -160 && bubble.screenY < viewportSize.height + 220);
  }, [botChatBubbles, camera.x, camera.y, camera.zoom, viewportSize.height, viewportSize.width]);
  const botBubbleLayer = (
    <div className="pointer-events-none absolute inset-0 z-[205] overflow-hidden">
      {botBubbleRenderData.map((bubble) => (
        <div
          key={bubble.id}
          className="absolute"
          style={{
            left: bubble.screenX,
            top: bubble.screenY,
            transform: 'translate(-50%, -100%)',
            opacity: bubble.opacity,
          }}
        >
          <div
            className="min-w-[120px] max-w-[220px] rounded-[18px] border px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.34)] backdrop-blur-md"
            style={{
              borderColor: `${bubble.accentColor}66`,
              background: 'linear-gradient(180deg, rgba(5,12,22,0.92), rgba(4,8,16,0.84))',
              boxShadow: `0 14px 36px rgba(0,0,0,0.34), 0 0 0 1px ${bubble.accentColor}18`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bubble.accentColor }} />
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/52">{bubble.category.replace(/_/g, ' ')}</span>
            </div>
            <div className="mt-1.5 text-[13px] font-black leading-5 text-white">
              {bubble.displayText}
            </div>
          </div>
          <div
            className="mx-auto h-3 w-3 -translate-y-[3px] rotate-45 rounded-[2px] border-r border-b"
            style={{
              borderColor: `${bubble.accentColor}66`,
              background: 'rgba(5,12,22,0.88)',
            }}
          />
        </div>
      ))}
    </div>
  );

  if (isDead) {
    if (!deathCardVisible) {
      return (
        <div className="absolute inset-0 z-[220] pointer-events-auto">
          {botBubbleLayer}
          <div
            className="absolute inset-0"
            style={{
              background: `rgba(2, 7, 16, ${deathPresentation?.dimOpacity ?? 0.28})`,
              backdropFilter: `blur(${deathPresentation?.blurPx ?? 0}px)`,
            }}
          />
          <div className="absolute inset-x-0 top-8 flex justify-center px-4">
            <div className="rounded-full border border-cyan-300/20 bg-[#06111d]/88 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/86 shadow-[0_10px_28px_rgba(0,0,0,0.34)]">
              Killcam feed live • {Math.max(1, Math.ceil((deathPresentation?.delayRemainingMs ?? 0) / 1000))}s
            </div>
          </div>
          <div className="absolute right-5 top-5 flex gap-2">
            <button
              onClick={onRestart}
              className="rounded-xl border border-cyan-300/22 bg-cyan-400/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Respawn
            </button>
            <button
              onClick={onExit}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/86 transition hover:bg-white/10"
            >
              Main Menu
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto px-4">
        {botBubbleLayer}
        <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/15 bg-[#090d18] shadow-[0_30px_80px_rgba(0,0,0,0.75)] animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(56,189,248,0.12), transparent 60%)' }} />
          <div className="relative px-8 pt-8 pb-7" style={{ opacity: deathFadeProgress, transform: `translateY(${(1 - deathFadeProgress) * 12}px)` }}>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300/70 mb-2">Combat Report</div>
          <h1 className="text-[54px] leading-[0.95] font-black tracking-tight text-white mb-3">YOU DIED</h1>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/45 font-bold">Score</div>
              <div className="text-2xl font-black text-cyan-300 mt-1">{scoreLabel}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/45 font-bold">Level</div>
              <div className="text-2xl font-black text-white mt-1">{level}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/45 font-bold">Class</div>
              <div className="mt-1 break-words text-sm font-black leading-tight text-white">{currentClass}</div>
             </div>
          </div>
          {deathReport && (
            <div className="mb-6 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-emerald-100/85">
                <span>Run Reward</span>
                <span>+{deathReport.moneyEarned.toLocaleString()} Credits</span>
              </div>
              <div className="mt-2 text-[11px] font-bold text-white/70">
                Unlocked: {deathReport.unlockedAchievements} achievements, {deathReport.unlockedQuests} quests
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 mb-1">
              <button onClick={onRestart} className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3.5 text-lg font-black uppercase tracking-[0.08em] text-black shadow-[0_12px_28px_rgba(14,165,233,0.35)] transition hover:brightness-110 hover:scale-[1.01] active:scale-[0.985]">RESPAWN</button>
              <button onClick={onExit} className="w-full rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-base font-black uppercase tracking-[0.08em] text-white/90 transition hover:bg-white/10 hover:text-white active:scale-[0.985]">MAIN MENU</button>
          </div>
          </div>
        </div>
      </div>
    );
  }


  const handlePrimeSpawn = (config: any) => {
      if (!sandboxConfig?.spawningEnabled) return;
      engine.primedSpawn = { ...config, spawnAmount };
      playHover?.();
  };

  const handleClassSelection = (cls: TankClass) => {
      onUpgradeClass(cls);
      playHover?.();
  };

  // Determine if the current class is drone-based for label renaming
  const isDroneClass = [
    TankClass.OVERSEER, 
    TankClass.OVERLORD, 
    TankClass.MANAGER, 
    TankClass.HYBRID
  ].includes(currentClass);

  const isPacifistClass = secondarySector === 'restoration';
 
  const isDrainingClass = secondarySector === 'blood';
  const liveDrainValue = Math.max(0, bloodDrainLive || 0);
  const liveDrainStacks = Math.max(0, bloodDrainStacks || 0);
  const sessionDrainValue = Math.max(0, bloodDrainSession || 0);

  const currentStatOrder = STAT_ORDER;

  const abilityActiveSecs = Math.max(0, Math.ceil(abilityHud?.activeRemaining || 0));
  const abilityCooldownSecs = Math.max(0, Math.ceil(abilityHud?.cooldownRemaining || 0));
  const abilityReady = !!abilityHud && !abilityHud.active && (abilityHud.cooldownTotal <= 0 || abilityHud.cooldownRemaining <= 0);
  const abilityCooldownProgress = abilityHud
    ? abilityHud.active
      ? Math.max(0, Math.min(100, ((abilityHud.activeRemaining || 0) / Math.max(1, abilityHud.activeTotal || 15)) * 100))
      : abilityHud.cooldownTotal > 0
        ? Math.max(0, Math.min(100, ((abilityHud.cooldownTotal - abilityHud.cooldownRemaining) / abilityHud.cooldownTotal) * 100))
        : 100
    : 0;
  const abilityIcon = abilityHud?.id === 'divine_offering'
    ? HeartPulse
    : abilityHud?.id === 'sanguine_pact'
      ? Droplets
      : MousePointer2;

  return (
    <div 
        className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between overflow-hidden font-sans select-none z-[100]"
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
    >
      {botBubbleLayer}
      
      {/* Notifications Layer */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full max-w-md pointer-events-none z-[110]">
          {primedSpawn && (
            <div className="px-8 py-3 rounded-2xl bg-black border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] animate-pulse flex flex-col items-center mb-4">
                <span className="text-[10px] font-black text-cyan-400 tracking-[0.3em] uppercase">Fabrication Tool Active</span>
                <div className="flex items-center gap-4 mt-1">
                    <div className="shrink-0 flex items-center justify-center">
                        {primedSpawn.type === 'SHAPE' && primedSpawn.shapeType ? (
                           <ShapePreview type={primedSpawn.shapeType} rarity={primedSpawn.rarity} size={40} />
                        ) : primedSpawn.type === 'BOSS' ? (
                           <ShapePreview type="GRAND_SINGULARITY" rarity={ShapeRarity.COMMON} size={40} />
                        ) : primedSpawn.type === 'ALPHA_PENTAGON' ? (
                           <ShapePreview type="ALPHA_PENTAGON" rarity={ShapeRarity.COMMON} size={40} />
                        ) : primedSpawn.type === 'VOID_PORTAL' ? (
                           <ShapePreview type="VOID_PORTAL" rarity={ShapeRarity.COMMON} size={40} />
                        ) : primedSpawn.type === 'DUMMY' ? (
                           <ShapePreview type="DUMMY" rarity={ShapeRarity.COMMON} size={40} />
                        ) : primedSpawn.type === 'ELITE_TANK' || primedSpawn.type === 'BOT_TANK' || primedSpawn.type === 'DOMINION_TANK' ? (
                           <TankPreview tankClass={resolvePreviewClass(primedSpawn.classType || TankClass.BASIC)} size={40} showArenaVfx={isRebirthPreviewClass(primedSpawn.classType || TankClass.BASIC)} />
                        ) : null}
                    </div>
                    <span className="text-white font-black italic">
                      {primedSpawn.type === 'DOMINION_TANK'
                        ? `${primedSpawn.weaponProfile || 'TRIPLE'} Dominion`
                        : `${primedSpawn.rarity} ${primedSpawn.classType || primedSpawn.shapeType || primedSpawn.type}`}
                    </span>
                    <span className="text-white/40 text-[9px] uppercase font-black tracking-widest">[Click Map]</span>
                </div>
                <button 
                  onClick={() => { engine.primedSpawn = null; playHover?.(); }} 
                  className="mt-2 text-[8px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 pointer-events-auto"
                >
                  Cancel Spawner [ESC]
                </button>
            </div>
          )}
          {transformationReady && (
            <div className="px-8 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 border-4 border-white text-white shadow-[0_0_30px_rgba(255,0,0,0.6)] animate-bounce flex flex-col items-center mb-4">
                <span className="text-[10px] font-black tracking-widest uppercase">ELITE POWER UNLOCKED</span>
                <span className="text-xl font-black italic">PRESS [T] TO TRANSFORM</span>
            </div>
          )}
          {rebirthEligible && playerState === PlayerState.ACTIVE && (
            <div className="px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-500/90 to-orange-500/90 border border-amber-200/70 text-white shadow-[0_0_24px_rgba(251,191,36,0.35)] flex flex-col items-center mb-4">
                <span className="text-[10px] font-black tracking-[0.28em] uppercase">Rebirth Optional</span>
                <span className="text-lg font-black italic">PRESS [B] TO EVOLVE</span>
            </div>
          )}
          <AnimatePresence mode="popLayout">
              {notifications.map(n => (
                  <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: -20, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className="px-6 py-2.5 rounded-full bg-[#050505]/95 border backdrop-blur-md text-sm font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
                      style={{ 
                          color: n.color, 
                          textShadow: `0 0 10px ${n.color}40`,
                          boxShadow: `0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 12px ${n.color}15`,
                          borderColor: `${n.color}30`
                      }}
                  >
                      {/* Pulse Indicator light */}
                      <span className="w-1.5 h-1.5 rounded-full animate-ping mr-1" style={{ backgroundColor: n.color }} />
                      <span>{n.text}</span>
                  </motion.div>
              ))}
          </AnimatePresence>
      </div>

      {(playerState === PlayerState.EVOLVING || showBossChoiceUI || showSectorChoiceUI) && (
        <div className="absolute inset-0 z-[180] flex items-center justify-center pointer-events-auto px-6">
          <div className="w-full max-w-3xl rounded-3xl border border-cyan-300/20 bg-[#030712]/92 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-6">
            {showSectorChoiceUI ? (
              <>
                <div className="text-center">
                  <div className="text-[11px] font-black uppercase tracking-[0.35em] text-rose-200/80">Secondary Sector</div>
                  <div className="mt-2 text-3xl font-black text-white">Choose Your Support Path</div>
                  <p className="mt-3 text-sm leading-6 text-white/58">
                    Your chassis stays <span className="font-black text-white">{compactCurrentClass}</span>. Pick a sector overlay that adds either healing support or blood drain pressure on top of it.
                  </p>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <button
                    onClick={() => { onUpgradeSector('restoration'); playHover?.(); }}
                    className="group rounded-[1.6rem] border border-emerald-300/24 bg-emerald-500/[0.08] p-5 text-left transition hover:border-emerald-200/46 hover:bg-emerald-400/[0.12]"
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/76">Restoration</div>
                    <div className="mt-2 text-2xl font-black text-white">Field Sustain</div>
                    <div className="mt-3 text-sm leading-6 text-white/66">Healing aura, team sustain, and restorative burst utility without replacing your main weapon class.</div>
                  </button>
                  <button
                    onClick={() => { onUpgradeSector('blood'); playHover?.(); }}
                    className="group rounded-[1.6rem] border border-rose-300/24 bg-rose-500/[0.08] p-5 text-left transition hover:border-rose-200/46 hover:bg-rose-400/[0.12]"
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-200/76">Blood</div>
                    <div className="mt-2 text-2xl font-black text-white">Pressure Sustain</div>
                    <div className="mt-3 text-sm leading-6 text-white/66">Drain aura, lifesteal, and aggression-based sustain layered onto your existing combat chassis.</div>
                  </button>
                </div>
              </>
            ) : playerState === PlayerState.EVOLVING ? (
              <div className="text-center py-10">
                <div className="text-[11px] font-black uppercase tracking-[0.35em] text-cyan-300/70">Evolution Sequence</div>
                <div className="mt-2 text-3xl font-black text-white">Synchronizing Celestial Core</div>
                <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (1 - ((evolutionTransitionRemaining || 0) / 1.25)) * 100))}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-300/80">Boss Evolution</div>
                  <div className="mt-2 text-3xl font-black text-white">Choose Your Legendary Chassis</div>
                </div>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(bossChoices && bossChoices.length > 0 ? bossChoices : [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD, TankClass.CELESTIAL, TankClass.OBLITERATOR]).map((cls) => (
                    <button
                      key={cls}
                      onClick={() => { onUpgradeClass(cls); playHover?.(); }}
                      className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-300/50 transition-all p-3 flex flex-col items-center gap-2"
                    >
                      <TankPreview
                        key={`${SANDBOX_RESEARCH_ICON_REV}-boss-choice-${cls}`}
                        tankClass={resolvePreviewClass(cls)}
                        size={46}
                        showArenaVfx={isRebirthPreviewClass(cls)}
                        turretRotation={getSandboxPreviewPose(cls).turretRotation}
                        chassisRotation={getSandboxPreviewPose(cls).chassisRotation}
                      />
                      <span className="text-[10px] font-black uppercase tracking-wider text-white/85">{cls}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!!enemyZoneWarningLevel && (
        <>
          <div className={`absolute inset-0 pointer-events-none ${enemyZoneWarningLevel === 2 ? 'animate-pulse' : ''}`} style={{ boxShadow: `inset 0 0 0 6px ${enemyZoneWarningLevel === 2 ? 'rgba(239,68,68,0.55)' : 'rgba(251,146,60,0.4)'}` }} />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none z-[150]">
            <div className={`px-5 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.24em] ${enemyZoneWarningLevel === 2 ? 'bg-red-500/20 border-red-300/55 text-red-100' : 'bg-amber-500/18 border-amber-300/45 text-amber-100'}`}>
              {enemyZoneWarningText || 'WARNING: ENEMY DEFENSE ZONE'}
            </div>
          </div>
        </>
      )}

      {/* Top HUD */}
      <div className="flex justify-between items-start gap-4 w-full">
        <div className="flex max-w-[248px] flex-col gap-3 pointer-events-none">
             {settings.showFps && (
             <div className="bg-black/55 px-3 py-1.5 rounded-lg text-white/80 font-mono text-xs font-bold backdrop-blur-md border border-white/10 shadow-lg w-fit pointer-events-auto">
                FPS: <span className={fps < 30 ? 'text-red-400' : 'text-green-400'}>{fps}</span>
             </div>
             )}
             
             {showStandardUpgrades && (
                <div 
                  key={`${mainClass}-${unlockableClasses.join('-')}`} 
                  className="animate-in slide-in-from-left-20 duration-500 ease-out fade-in pointer-events-auto"
                >
                    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#0b1119]/88 shadow-[0_12px_32px_rgba(0,0,0,0.32)] backdrop-blur-xl w-[248px]">
                        <div className="pt-3 pb-2 px-4 text-left border-b border-white/5 bg-cyan-400/5">
                            <h3 className="text-cyan-300 font-black text-sm uppercase tracking-[0.22em]">Evolution Ready</h3>
                            <p className="text-[8px] font-bold text-cyan-200/35 uppercase mt-1 tracking-[0.18em]">Select next chassis</p>
                        </div>
                        <div className="p-3 grid grid-cols-2 gap-2.5">
                            {unlockableClasses.map((cls) => (
                                <button 
                                  key={cls} 
                                  onClick={() => handleClassSelection(cls as TankClass)} 
                                  onMouseEnter={playHover} 
                                  className="group flex flex-col items-center justify-between aspect-square rounded-xl bg-[#16202a]/88 border border-white/10 hover:border-cyan-400 hover:bg-cyan-950/20 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                                >
                                    <div className="flex-1 flex items-center justify-center transform group-hover:scale-105 transition-transform pb-2 pt-2">
                                        <TankPreview
                                          key={`${SANDBOX_RESEARCH_ICON_REV}-evo-${cls}`}
                                          tankClass={resolvePreviewClass(cls as TankClass)}
                                          size={48}
                                          turretRotation={getSandboxPreviewPose(cls as TankClass).turretRotation}
                                          chassisRotation={getSandboxPreviewPose(cls as TankClass).chassisRotation}
                                        /> 
                                    </div>
                                    <div className="w-full text-center pb-2 bg-black/20 group-hover:bg-cyan-400/10 transition-colors">
                                        <span className="block text-[8px] font-black text-gray-400 group-hover:text-cyan-200 uppercase tracking-[0.12em] px-1">{cls.replace(' Tank', '')}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="flex w-[244px] flex-col items-stretch gap-3 pointer-events-auto">
             <div className="flex items-center justify-end gap-2">
                {gameMode === GameMode.SANDBOX && (
                    <motion.button 
                        onClick={() => {
                          playHover?.();
                          setSandboxButtonPulse(true);
                          setSandboxOpen(!sandboxOpen);
                          setTimeout(() => setSandboxButtonPulse(false), 180);
                        }} 
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        className={`px-4 py-2 rounded-xl font-black text-xs transition-all shadow-lg border flex items-center gap-2.5 ${sandboxOpen ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-black/70 text-cyan-300 border-cyan-500/30 backdrop-blur-md hover:bg-cyan-500/10'}`}
                        title="Open Creative Sandbox Controls"
                    >
                        <SlidersHorizontal className={`h-3.5 w-3.5 transition-transform ${sandboxButtonPulse ? 'scale-125' : ''}`} />
                        SANDBOX // CREATIVE
                    </motion.button>
                )}
                <motion.button
                  onClick={onExit}
                  onMouseEnter={playHover}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="group relative overflow-hidden rounded-xl border border-red-300/35 bg-gradient-to-r from-red-500/90 via-rose-500/90 to-red-600/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_10px_26px_rgba(220,38,38,0.35)]"
                  title="Exit match"
                >
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.22)_45%,transparent_90%)]" />
                  <span className="relative">Exit Session</span>
                </motion.button>
             </div>

             {gameMode === GameMode.DOMINION && (
                <div className="w-full rounded-2xl border border-amber-400/20 bg-[#0b0913]/84 backdrop-blur-xl overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.42)]">
                  <div className="px-3 py-2 border-b border-white/10 bg-amber-500/[0.06] flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-200/85">Dominion</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">{dominionTimerLabel}</span>
                  </div>
                  <div className="px-3 py-2 border-b border-white/5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
                    {contestedDominionCount ? `${contestedDominionCount} active contest${contestedDominionCount > 1 ? 's' : ''}` : 'Secure or contest control points'}
                  </div>
                 <div className="flex flex-col">
                   {dominionScoreRows.map((row) => (
                     <div key={row.team} className="grid grid-cols-[18px_1fr_auto_auto] items-center gap-2 px-3 py-2 text-xs border-b border-white/5">
                       <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.accent, boxShadow: `0 0 10px ${row.accent}` }} />
                       <span className="font-black uppercase tracking-[0.14em] text-white/85">{row.team}</span>
                       <span className="text-[10px] font-black text-white/55">{row.owned} held</span>
                       <span className="font-mono text-[11px] text-white/82">{row.score}</span>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {settings.showLeaderboard && gameMode !== GameMode.DOMINION && (
             <div className="w-full rounded-2xl border border-cyan-400/16 bg-[#040913]/84 backdrop-blur-xl overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.42)]">
                  <div className="px-3 py-2 border-b border-white/10 bg-cyan-500/[0.05] flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200/80">Leaderboard</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">Live</span>
                 </div>
                 <div className="flex flex-col">
                     {topFiveLeaderboard.map((entry, i) => (
                         (() => {
                           const entryTeam = entry.teamId ?? entry.team;
                           const rowClass = !isTeamMode
                             ? (entry.isPlayer ? 'bg-cyan-500/12 text-cyan-200' : 'text-white/80')
                             : getTeamRowClass(entryTeam, entry.isPlayer);
                           const iconClass = entry.currentClass ?? entry.classType;
                           return (
                         <div
                           key={entry.id}
                           className={`grid grid-cols-[26px_28px_1fr_auto] items-center gap-2 px-3 py-2 text-xs border-b border-white/5 ${rowClass}`}
                          >
                             <span className={`text-[10px] font-black ${i < 3 ? 'text-amber-300' : 'text-white/45'}`}>{i + 1}</span>
                             <div className="w-7 h-7 rounded-md bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
                               <TankPreview
                                 key={`${SANDBOX_RESEARCH_ICON_REV}-leaderboard-${iconClass}-${entry.id}`}
                                 tankClass={iconClass}
                                 size={18}
                                 turretRotation={getSandboxPreviewPose(iconClass).turretRotation}
                                 chassisRotation={getSandboxPreviewPose(iconClass).chassisRotation}
                               />
                             </div>
                              <span className="break-words font-black leading-tight tracking-wide">{formatDisplayName(entry.name)}</span>
                             <span className="font-mono text-[11px] text-white/75">{formatScoreValue(entry.score, settings.compactScoreNotation)}</span>
                          </div>
                           );
                         })()
                      ))}
                  </div>
              </div>
              )}

             {abilityHud && (
               <div className={`w-full rounded-2xl border backdrop-blur-md px-3 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.35)] ${
                 abilityHud.active
                   ? 'border-emerald-300/28 bg-emerald-950/28'
                   : abilityReady
                     ? 'border-cyan-300/24 bg-cyan-950/24'
                     : 'border-white/12 bg-black/55'
               }`}>
                 <div className="flex items-center justify-between gap-2">
                   <div className="flex items-center gap-2 min-w-0">
                     <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                       abilityHud.active ? 'border-emerald-300/35 bg-emerald-400/12' : abilityReady ? 'border-cyan-300/30 bg-cyan-400/10' : 'border-white/20 bg-white/5'
                     }`}>
                       {React.createElement(abilityIcon, { className: `w-4 h-4 ${abilityHud.active ? 'text-emerald-300' : abilityReady ? 'text-cyan-300' : 'text-amber-300'}` })}
                     </div>
                     <div className="min-w-0">
                       <div className="break-words text-[9px] font-black uppercase leading-snug tracking-[0.14em] text-white/90">{abilityHud.name}</div>
                       <div className="break-words text-[8px] font-bold uppercase leading-snug tracking-[0.16em] text-white/45">{abilityHud.trigger}</div>
                     </div>
                   </div>
                   <span className={`text-[8px] font-black uppercase tracking-[0.14em] shrink-0 ${
                     abilityHud.active ? 'text-emerald-300' : abilityReady ? 'text-cyan-300' : 'text-amber-300'
                   }`}>
                     {abilityHud.active ? `${abilityActiveSecs}s` : abilityReady ? 'Ready' : `${abilityCooldownSecs}s`}
                   </span>
                 </div>
                 <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden border border-white/10">
                   <div
                     className={`h-full transition-all duration-150 ${
                       abilityHud.active ? 'bg-emerald-400' : abilityReady ? 'bg-cyan-400' : 'bg-amber-400/90'
                     }`}
                     style={{ width: `${abilityCooldownProgress}%` }}
                   />
                 </div>
               </div>
             )}

              {settings.showMinimap && (
               <div className={`relative ml-auto w-[148px] overflow-hidden rounded-[1rem] border border-cyan-400/12 bg-[#050b12]/74 shadow-[0_8px_18px_rgba(0,0,0,0.24)] ${gameMode === GameMode.DOMINION ? 'aspect-[0.88]' : 'aspect-[0.9]'}`}>
                    <div className="absolute inset-x-0 top-0 z-10 flex h-5 items-center justify-between border-b border-white/7 bg-black/28 px-2">
                      <span className="text-[7px] font-black uppercase tracking-[0.16em] text-cyan-200/76">Tactical Map</span>
                      <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-white/30">{gameMode === GameMode.DOMINION ? 'zone' : 'x1'}</span>
                    </div>
                    <div className="absolute inset-[6px] top-[24px] overflow-hidden rounded-md border border-white/7">
                      <TacticalMinimap markers={minimapMarkers} mapSize={mapSize} camera={camera} inVoid={inVoid} gameMode={gameState.gameMode} />
                    </div>
                 </div>
                )}
          </div>
       </div>

      {/* Sandbox Command Panel */}
      <AnimatePresence>
      {gameMode === GameMode.SANDBOX && sandboxOpen && (
          <motion.div
            initial={{ opacity: 0, x: 36, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 280, damping: 24 } }}
            exit={{ opacity: 0, x: 28, scale: 0.99, transition: { duration: 0.18 } }}
            className="absolute top-20 right-4 z-[200] flex max-h-[calc(100vh-7rem)] w-[620px] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden rounded-[1.9rem] border border-cyan-400/18 bg-[#06101a]/96 shadow-[0_28px_80px_rgba(0,0,0,0.72)] backdrop-blur-2xl pointer-events-auto"
          >
              {/* Header */}
              <div className="shrink-0 border-b border-cyan-300/10 bg-[linear-gradient(180deg,rgba(15,35,48,0.94),rgba(8,15,24,0.84))] px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/22 bg-cyan-400/8 shadow-[inset_0_0_18px_rgba(34,211,238,0.08)]">
                        <SlidersHorizontal className="h-4.5 w-4.5 text-cyan-300" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[11px] font-black uppercase tracking-[0.3em] text-cyan-200/80">Sandbox Command Deck</span>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/44">
                          <span className="rounded-full border border-emerald-300/22 bg-emerald-400/10 px-2.5 py-1 text-emerald-200/88">Live</span>
                          <span>{SANDBOX_TAB_META[activeTab].hint}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSandboxOpen(false)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/45 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
                      aria-label="Close sandbox panel"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/36">Mode</div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/88">Creative Sandbox</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/36">Density</div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200/92">{spawnAmount} queued</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/18 px-3 py-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.24em] text-white/36">Fabricator</div>
                      <div className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/88">{sandboxConfig?.spawningEnabled ? 'Armed' : 'Standby'}</div>
                    </div>
                  </div>
              </div>

              {/* Tabs */}
              <div className="shrink-0 border-b border-cyan-300/10 bg-black/24 px-4 py-3">
                <div className="grid h-12 grid-cols-3 gap-2 rounded-2xl border border-white/7 bg-black/26 p-1">
                  {(['SYSTEM', 'RESEARCH', 'SPAWN'] as SandboxTab[]).map(tab => (
                      <button 
                        key={tab}
                        onClick={() => { playHover?.(); setActiveTab(tab); }}
                        title={SANDBOX_TAB_META[tab].hint}
                        className={`relative flex items-center justify-center gap-2 rounded-xl text-[10px] font-black tracking-[0.18em] uppercase transition-all ${activeTab === tab ? 'bg-cyan-400/12 text-cyan-100' : 'text-white/36 hover:bg-white/[0.04] hover:text-white/72'}`}
                      >
                        {React.createElement(SANDBOX_TAB_META[tab].icon, { className: 'relative z-10 h-3.5 w-3.5' })}
                        <span className="relative z-10">{SANDBOX_TAB_META[tab].label}</span>
                        {activeTab === tab && (
                            <motion.div 
                                layoutId="sandboxTab"
                                className="absolute inset-0 rounded-xl border border-cyan-300/26 shadow-[inset_0_0_24px_rgba(34,211,238,0.08)]"
                            />
                        )}
                      </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar scroll-smooth overscroll-y-contain">
                  <AnimatePresence mode="wait">
                  {activeTab === 'SYSTEM' && (
                    <motion.div
                      key="tab-system"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-4"
                    >
                        <div className="rounded-[1.6rem] border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(10,24,36,0.96),rgba(7,13,20,0.94))] px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/86">World Controls</div>
                            <p className="mt-1 text-[10px] font-bold leading-relaxed text-white/42">Core simulation toggles, time scaling, and cleanup tools grouped for quicker mid-match testing.</p>
                        </div>
                        {/* Core Toggles */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'invincible', label: 'GOD_MODE', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                                { id: 'infiniteAmmo', label: 'NO_RELOAD', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                { id: 'noAbilityCooldown', label: 'NO_COOLDOWN', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                                { id: 'botsEnabled', label: 'AI_ENGAGE', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
                                { id: 'showSpawnNotifications', label: 'INTEL_FEEDS', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
                                { id: 'knockbackEnabled', label: 'PHYSICS_X', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                { id: 'freezeAll', label: 'STASIS_FIELD', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
                                { id: 'cleanupActive', label: 'AUTO_PURGE', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' }
                            ].map(flag => {
                                const active = (sandboxConfig as any)[flag.id];
                                return (
                                    <button 
                                        key={flag.id}
                                        onClick={() => engine.setSandboxFlag(flag.id, !active)}
                                        className={`group flex items-center gap-3 rounded-[1.35rem] border px-3 py-3 text-left transition-all ${active ? 'border-cyan-300/50 bg-cyan-400/14 text-cyan-50 shadow-[inset_0_0_22px_rgba(34,211,238,0.08)]' : 'border-white/8 bg-white/[0.025] text-white/32 hover:border-white/14 hover:bg-white/[0.05]'}`}
                                    >
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${active ? 'border-cyan-200/35 bg-cyan-200/10' : 'border-white/10 bg-black/28'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4.5 w-4.5 ${active ? 'text-cyan-100' : 'text-cyan-400/52'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={flag.icon} />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1 overflow-hidden">
                                            <span className="block break-words text-[10px] font-black uppercase leading-snug tracking-[0.16em]">{flag.label.replace(/_/g, ' ')}</span>
                                            <span className={`mt-1 block text-[8px] font-black uppercase tracking-[0.18em] ${active ? 'text-cyan-100/72' : 'text-white/24'}`}>{active ? 'Enabled' : 'Standby'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* Simulation Speed Sliders */}
                        <div className="space-y-4 rounded-[1.6rem] border border-white/8 bg-white/[0.025] p-4">
                            <div className="mb-1 flex items-center justify-between gap-3">
                                <div>
                                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/82">Temporal Scale</span>
                                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">Adjust overall simulation speed</p>
                                </div>
                                <span className="rounded-full border border-white/10 bg-black/24 px-2.5 py-1 text-[10px] font-mono text-white/56">{sandboxConfig?.gameSpeed.toFixed(1)}x</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {[0.2, 0.5, 1.0, 2.0, 5.0].map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => engine.setSandboxFlag('gameSpeed', s)} 
                                        className={`rounded-xl border px-0 py-2.5 text-[10px] font-black transition-all ${sandboxConfig?.gameSpeed === s ? 'border-cyan-200/40 bg-cyan-100 text-black' : 'border-white/8 bg-white/5 text-white/42 hover:text-white/72'}`}
                                    >
                                        {s}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dangerous Tools Section */}
                        <div className="space-y-4 rounded-[1.6rem] border border-red-400/14 bg-red-500/[0.035] p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]"></div>
                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-red-200/76">Critical Functions</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2.5">
                                <button onClick={() => engine.maxAllStats()} className="group flex items-center justify-between rounded-2xl bg-yellow-300 px-5 py-4 transition-all hover:scale-[1.01]">
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black">Max Overclock Stats</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => engine.clearEntities('BULLETS')} className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/52 transition-all hover:bg-white/10 hover:text-white/82">Flush Projectiles</button>
                                    <button onClick={() => engine.clearEntities('SHAPES')} className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/52 transition-all hover:bg-white/10 hover:text-white/82">Wipe Shapes</button>
                                </div>
                                <button onClick={() => engine.clearEntities('ALL')} className="group mt-1 flex items-center justify-between rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-red-200 transition-all hover:bg-red-500/18">
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em]">System Deep Clean</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                  )}

                  {activeTab === 'RESEARCH' && (
                    <motion.div
                      key="tab-research"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-4 pb-2"
                    >
                        <div className="group relative overflow-hidden rounded-[1.6rem] border border-indigo-300/14 bg-indigo-500/6 px-4 py-4">
                            <div className="absolute top-0 right-0 p-6 opacity-5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-indigo-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                            </div>
                            <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-indigo-200/84">Research Bay</h4>
                            <p className="max-w-[85%] text-[10px] font-bold leading-relaxed text-white/42">Search by role, switch classes instantly, and jump into boss or dominion chassis without digging through the full progression tree.</p>
                        </div>

                        <div className="space-y-4 rounded-[1.6rem] border border-white/8 bg-white/[0.025] p-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
                                    <input
                                      value={researchQuery}
                                      onChange={(e) => setResearchQuery(e.target.value)}
                                      placeholder="Search class name..."
                                      className="w-full rounded-xl border border-white/10 bg-black/24 py-2.5 pl-9 pr-3 text-xs font-bold tracking-wide text-white outline-none focus:border-cyan-400/60"
                                    />
                                </div>
                                <button
                                  onClick={() => { setResearchQuery(''); setResearchSector('ALL'); }}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 hover:bg-white/10"
                                  title="Clear search and filters"
                                >
                                  Reset
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {['ALL', ...CLASS_CATEGORIES.map(c => c.name)].map(name => (
                                <button
                                  key={name}
                                  onClick={() => setResearchSector(name)}
                                  className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all ${researchSector === name ? 'border-cyan-300 bg-cyan-400 text-black' : 'border-white/10 bg-white/5 text-white/60 hover:text-white'}`}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                        </div>

                        {researchCategories.map(cat => (
                            <div key={cat.name} className="space-y-3">
                                <div className="flex items-center gap-4 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/42">{cat.name} Sector</span>
                                    <div className="h-px flex-1 bg-white/[0.04]"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {cat.classes.map(cls => (
                                        <button 
                                            key={cls} 
                                            onClick={() => { playHover?.(); onUpgradeClass(cls); }} 
                                            className={`group relative flex flex-col gap-4 overflow-hidden rounded-[1.5rem] border p-4 text-left transition-all ${currentClass === cls ? 'border-indigo-300/55 bg-indigo-500/16 shadow-[inset_0_0_24px_rgba(99,102,241,0.14)]' : 'border-white/8 bg-white/[0.03] hover:border-indigo-300/24 hover:bg-white/[0.06]'}`}
                                        >
                                            <div className="pointer-events-none absolute top-0 right-0 translate-x-3 -translate-y-3 p-3 opacity-5">
                                                <TankPreview
                                                  key={`${SANDBOX_RESEARCH_ICON_REV}-bg-${cls}`}
                                                  tankClass={resolvePreviewClass(cls)}
                                                  size={84}
                                                  showArenaVfx={isRebirthPreviewClass(cls)}
                                                  turretRotation={getSandboxPreviewPose(cls).turretRotation}
                                                  chassisRotation={getSandboxPreviewPose(cls).chassisRotation}
                                                />
                                            </div>
                                            <div className="relative z-10 w-fit shrink-0 transition-transform duration-500 group-hover:scale-105">
                                                <div className="rounded-2xl border border-white/10 bg-black/28 p-3 transition-all group-hover:border-white/20">
                                                    <TankPreview
                                                      key={`${SANDBOX_RESEARCH_ICON_REV}-card-${cls}`}
                                                      tankClass={resolvePreviewClass(cls)}
                                                      size={48}
                                                      color={currentClass === cls ? '#fff' : undefined}
                                                      showArenaVfx={isRebirthPreviewClass(cls)}
                                                      turretRotation={getSandboxPreviewPose(cls).turretRotation}
                                                      chassisRotation={getSandboxPreviewPose(cls).chassisRotation}
                                                    />
                                                </div>
                                            </div>
                                            <div className="relative z-10 flex flex-col">
                                                <div className="mb-1.5 flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${currentClass === cls ? 'bg-white animate-pulse' : 'bg-indigo-500'}`}></div>
                                                    <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${currentClass === cls ? 'text-white' : 'text-white/82'}`}>{cls.replace(' Tank', '')}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[7px] font-black uppercase tracking-[0.16em] ${currentClass === cls ? 'text-white/56' : 'text-white/24'}`}>Ref {cls.toUpperCase().replace(/\s/g, '_')}</span>
                                                    {currentClass === cls && <span className="rounded-full bg-black/28 px-1.5 py-0.5 text-[7px] font-black uppercase text-white">Current</span>}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {researchCategories.length === 0 && (
                          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-8 text-center">
                            <span className="text-xs font-black uppercase tracking-[0.22em] text-white/30">No Matching Chassis</span>
                          </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center gap-4 px-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/62">Boss Override</span>
                                <div className="h-px flex-1 bg-white/[0.04]"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {SANDBOX_BOSS_CLASSES.map(cls => (
                                    <button
                                      key={cls}
                                      onClick={() => { playHover?.(); onUpgradeClass(cls); }}
                                      className={`group relative flex flex-col gap-3 rounded-[1.4rem] border p-4 text-left transition-all ${currentClass === cls ? 'border-amber-300/55 bg-amber-500/12 shadow-[inset_0_0_20px_rgba(245,158,11,0.12)]' : 'border-white/8 bg-white/[0.03] hover:border-amber-300/35 hover:bg-white/[0.06]'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="rounded-2xl border border-white/10 bg-black/30 p-2.5">
                                          <TankPreview
                                            key={`${SANDBOX_RESEARCH_ICON_REV}-boss-override-${cls}`}
                                            tankClass={resolvePreviewClass(cls)}
                                            size={42}
                                            showArenaVfx={isRebirthPreviewClass(cls)}
                                            turretRotation={getSandboxPreviewPose(cls).turretRotation}
                                            chassisRotation={getSandboxPreviewPose(cls).chassisRotation}
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/88">{cls}</div>
                                          <div className="text-[8px] font-black uppercase tracking-[0.14em] text-amber-300/60">Instant boss chassis swap</div>
                                        </div>
                                      </div>
                                      <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/34">Sandbox only. Bypasses rebirth gate.</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-4 px-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/60">Dominion Profiles</span>
                                <div className="h-px flex-1 bg-white/[0.04]"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {SANDBOX_DOMINION_PROFILES.map(profile => (
                                    <button
                                      key={profile.id}
                                      onClick={() => { playHover?.(); onUpgradeClass(profile.classType); }}
                                      className={`group relative flex flex-col gap-3 rounded-[1.4rem] border p-4 text-left transition-all ${currentClass === profile.classType ? 'border-cyan-300/55 bg-cyan-500/12 shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]' : 'border-white/8 bg-white/[0.03] hover:border-cyan-300/35 hover:bg-white/[0.06]'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="rounded-2xl border border-white/10 bg-black/30 p-2.5">
                                          <TankPreview
                                            key={`${SANDBOX_RESEARCH_ICON_REV}-dominion-profile-${profile.id}`}
                                            tankClass={resolvePreviewClass(profile.classType)}
                                            size={42}
                                            turretRotation={getSandboxPreviewPose(profile.classType).turretRotation}
                                            chassisRotation={getSandboxPreviewPose(profile.classType).chassisRotation}
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/88">{profile.label}</div>
                                          <div className="text-[8px] font-black uppercase tracking-[0.14em] text-cyan-300/60">{profile.note}</div>
                                        </div>
                                      </div>
                                      <div className="text-[8px] font-bold uppercase tracking-[0.15em] text-white/34">Uses the same combat profile family as Dominion guardians.</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                  )}

                  {activeTab === 'SPAWN' && (
                    <motion.div
                      key="tab-spawn"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-4"
                    >
                        {/* Spawning Settings */}
                        <div className="space-y-5 rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/86">Spawn Fabricator</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${sandboxConfig?.spawningEnabled ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></div>
                                        <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${sandboxConfig?.spawningEnabled ? 'text-green-400' : 'text-red-300/60'}`}>{sandboxConfig?.spawningEnabled ? 'Online Ready' : 'Fabrication Locked'}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => engine.setSandboxFlag('spawningEnabled', !sandboxConfig?.spawningEnabled)} 
                                    className={`relative h-10 w-20 rounded-full p-1.5 transition-all ${sandboxConfig?.spawningEnabled ? 'bg-green-500 shadow-[0_0_24px_rgba(34,197,94,0.22)]' : 'bg-white/10'}`}
                                >
                                    <div className={`w-7 h-7 rounded-full bg-white transition-all transform shadow-2xl ${sandboxConfig?.spawningEnabled ? 'translate-x-10' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-4">
                                    <span className="px-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/32">Fabrication Density</span>
                                    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/24 p-1.5">
                                        <button onClick={() => setSpawnAmount(prev => Math.max(1, prev - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10 active:scale-90">-</button>
                                        <span className="flex-1 text-center font-black text-white text-lg">{spawnAmount}</span>
                                        <button onClick={() => setSpawnAmount(prev => Math.min(25, prev + 1))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10 active:scale-90">+</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <span className="px-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/32">Spawn Rate</span>
                                    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/24 p-1.5">
                                        <button onClick={() => engine.setSandboxFlag('shapeSpawnRate', Math.max(0.1, (sandboxConfig?.shapeSpawnRate || 1) - 0.5))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10 active:scale-90">-</button>
                                        <span className="flex-1 text-center font-black text-white text-lg">{sandboxConfig?.shapeSpawnRate.toFixed(1)}x</span>
                                        <button onClick={() => engine.setSandboxFlag('shapeSpawnRate', Math.min(10, (sandboxConfig?.shapeSpawnRate || 1) + 0.5))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 transition-all hover:bg-white/10 active:scale-90">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`space-y-4 transition-all duration-700 ${sandboxConfig?.spawningEnabled ? 'opacity-100' : 'pointer-events-none scale-[0.98] opacity-20 blur-sm filter grayscale'}`}>
                            {/* Rarity Selector */}
                            <div className="space-y-3 rounded-[1.6rem] border border-white/8 bg-white/[0.025] p-4">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/82">Rarity Profile</span>
                                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-white/24">Core Loadout</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 rounded-[1.3rem] border border-white/8 bg-black/24 p-2">
                                    {[ShapeRarity.COMMON, ShapeRarity.RARE, ShapeRarity.EPIC, ShapeRarity.LEGENDARY, ShapeRarity.MYTHICAL, ShapeRarity.TRANSCENDENT].map(r => (
                                        <button 
                                            key={r} 
                                            onClick={() => { playHover?.(); setSelectedRarity(r); }} 
                                            className={`relative overflow-hidden rounded-xl border py-2.5 text-[10px] font-black uppercase transition-all ${selectedRarity === r ? 'border-cyan-300 bg-cyan-400 text-black shadow-lg shadow-cyan-500/14' : 'border-transparent bg-transparent text-white/28 hover:bg-white/[0.02] hover:text-white/52'}`}
                                        >
                                            <span className="relative z-10">{r}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Elite Entities */}
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => handlePrimeSpawn({ type: 'BOSS', rarity: selectedRarity })} className={`group relative flex flex-col items-center gap-4 overflow-hidden rounded-[1.6rem] border p-5 transition-all ${primedSpawn?.type === 'BOSS' ? 'border-red-400 bg-red-500/16 shadow-[inset_0_0_24px_rgba(239,68,68,0.12)]' : 'border-white/8 bg-white/[0.03] hover:border-red-400/30 hover:bg-white/[0.08]'}`}>
                                    <div className="shrink-0 flex items-center justify-center transform group-hover:scale-110 group-active:scale-95 transition-all duration-500 relative z-10">
                                        <ShapePreview type="GRAND_SINGULARITY" rarity={ShapeRarity.COMMON} size={72} />
                                    </div>
                                    <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.16em] text-white">Grand Singularity</span>
                                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </button>
                                <button onClick={() => handlePrimeSpawn({ type: 'ELITE_TANK', group: 'ELITE', classType: TankClass.DESTROYER, rarity: selectedRarity })} className={`group relative flex flex-col items-center gap-4 overflow-hidden rounded-[1.6rem] border p-5 transition-all ${primedSpawn?.type === 'ELITE_TANK' ? 'border-amber-300 bg-amber-500/16 shadow-[inset_0_0_24px_rgba(245,158,11,0.12)]' : 'border-white/8 bg-white/[0.03] hover:border-amber-400/30 hover:bg-white/[0.08]'}`}>
                                    <div className="shrink-0 flex items-center justify-center transform group-hover:scale-110 group-active:scale-95 transition-all duration-500 relative z-10">
                                        <TankPreview
                                          key={`${SANDBOX_RESEARCH_ICON_REV}-elite-legionnaire`}
                                          tankClass={TankClass.DESTROYER}
                                          size={72}
                                          turretRotation={getSandboxPreviewPose(TankClass.DESTROYER).turretRotation}
                                          chassisRotation={getSandboxPreviewPose(TankClass.DESTROYER).chassisRotation}
                                        />
                                    </div>
                                    <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.16em] text-white">Elite Legionnaire</span>
                                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-4 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/60">Elite Boss Fabrication</span>
                                    <div className="h-px flex-1 bg-white/[0.04]"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {SANDBOX_BOSS_CLASSES.map(cls => (
                                        <button
                                          key={cls}
                                          onClick={() => handlePrimeSpawn({ type: 'ELITE_TANK', group: 'ELITE', classType: cls, rarity: selectedRarity })}
                                          className={`flex items-center gap-3 rounded-[1.35rem] border p-4 transition-all ${primedSpawn?.type === 'ELITE_TANK' && primedSpawn?.classType === cls ? 'border-amber-300 bg-amber-500/16 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07] hover:border-amber-300/30'}`}
                                        >
                                          <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                                            <TankPreview
                                              key={`${SANDBOX_RESEARCH_ICON_REV}-elite-boss-${cls}`}
                                              tankClass={resolvePreviewClass(cls)}
                                              size={38}
                                              showArenaVfx={isRebirthPreviewClass(cls)}
                                              turretRotation={getSandboxPreviewPose(cls).turretRotation}
                                              chassisRotation={getSandboxPreviewPose(cls).chassisRotation}
                                            />
                                          </div>
                                          <div className="min-w-0 text-left">
                                            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/86">{cls}</div>
                                            <div className="text-[7px] font-black uppercase tracking-[0.14em] text-amber-300/60">Spawn boss AI chassis</div>
                                          </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-4 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/60">Elite Tank Templates</span>
                                    <div className="h-px flex-1 bg-white/[0.04]"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {SANDBOX_ELITE_CLASS_TEMPLATES.map(cls => (
                                        <button
                                          key={cls}
                                          onClick={() => handlePrimeSpawn({ type: 'ELITE_TANK', group: 'ELITE', classType: cls, rarity: selectedRarity })}
                                          className={`flex items-center gap-3 rounded-[1.35rem] border p-4 transition-all ${primedSpawn?.type === 'ELITE_TANK' && primedSpawn?.classType === cls ? 'border-cyan-300 bg-cyan-500/16 shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07] hover:border-cyan-300/30'}`}
                                        >
                                          <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                                            <TankPreview
                                              key={`${SANDBOX_RESEARCH_ICON_REV}-elite-template-${cls}`}
                                              tankClass={resolvePreviewClass(cls)}
                                              size={36}
                                              turretRotation={getSandboxPreviewPose(cls).turretRotation}
                                              chassisRotation={getSandboxPreviewPose(cls).chassisRotation}
                                            />
                                          </div>
                                          <div className="min-w-0 text-left">
                                            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/86">{cls}</div>
                                            <div className="text-[7px] font-black uppercase tracking-[0.14em] text-cyan-300/60">Spawn elite AI variant</div>
                                          </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-4 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200/62">Dominion Guardians</span>
                                    <div className="h-px flex-1 bg-white/[0.04]"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {SANDBOX_DOMINION_PROFILES.map(profile => (
                                        <button
                                          key={profile.id}
                                          onClick={() => handlePrimeSpawn({ type: 'DOMINION_TANK', classType: profile.classType, rarity: ShapeRarity.COMMON, weaponProfile: profile.id })}
                                          className={`flex items-center gap-3 rounded-[1.35rem] border p-4 transition-all ${primedSpawn?.type === 'DOMINION_TANK' && primedSpawn?.weaponProfile === profile.id ? 'border-violet-300 bg-violet-500/16 shadow-[inset_0_0_20px_rgba(167,139,250,0.1)]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07] hover:border-violet-300/30'}`}
                                        >
                                          <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                                            <TankPreview
                                              key={`${SANDBOX_RESEARCH_ICON_REV}-dominion-guardian-${profile.id}`}
                                              tankClass={resolvePreviewClass(profile.classType)}
                                              size={36}
                                              turretRotation={getSandboxPreviewPose(profile.classType).turretRotation}
                                              chassisRotation={getSandboxPreviewPose(profile.classType).chassisRotation}
                                            />
                                          </div>
                                          <div className="min-w-0 text-left">
                                            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/86">{profile.label}</div>
                                            <div className="text-[7px] font-black uppercase tracking-[0.14em] text-violet-300/60">{profile.note}</div>
                                          </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Shape Toggles & Spawning */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-4 px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/42">Standard Templates</span>
                                    <div className="h-px flex-1 bg-white/[0.04]"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.values(ShapeType) as ShapeType[]).map(t => {
                                        const isEnabled = sandboxConfig?.enabledShapes[t];
                                        return (
                                            <div key={t} className="group flex items-center gap-3 rounded-[1.3rem] border border-white/8 bg-white/[0.02] p-3">
                                                <button 
                                                    onClick={() => engine.setShapeToggle(t, !isEnabled)} 
                                                    className={`w-6 h-6 rounded-lg transition-all border flex items-center justify-center shrink-0 ${isEnabled ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-black/40 border-white/10 text-transparent'}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handlePrimeSpawn({ type: 'SHAPE', shapeType: t, rarity: selectedRarity })} 
                                                    className="group/btn flex flex-1 items-center justify-between pr-2"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <ShapePreview type={t} rarity={selectedRarity} size={28} />
                                                        <span className="text-[10px] font-black text-white/60 group-hover/btn:text-white uppercase tracking-widest">{t}</span>
                                                    </div>
                                                    <div className="w-6 h-6 bg-white/5 rounded-lg flex items-center justify-center group-hover/btn:bg-white/10 transition-colors">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                                    </div>
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {/* Specialized Spawners */}
                                    <button onClick={() => handlePrimeSpawn({ type: 'DUMMY', rarity: ShapeRarity.COMMON })} className="bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/10 rounded-3xl p-3 flex items-center gap-4 transition-all group">
                                        <div className="w-10 h-10 bg-black/40 rounded-2xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                                            <ShapePreview type="DUMMY" rarity={ShapeRarity.COMMON} size={24} />
                                        </div>
                                        <span className="text-[10px] font-black text-yellow-500/60 group-hover:text-yellow-500 uppercase tracking-widest italic">Target_Dummy</span>
                                    </button>
                                    <button onClick={() => handlePrimeSpawn({ type: 'VOID_PORTAL', rarity: ShapeRarity.COMMON })} className="bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/10 rounded-3xl p-3 flex items-center gap-4 transition-all group">
                                        <div className="w-10 h-10 bg-black/40 rounded-2xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                                            <ShapePreview type="VOID_PORTAL" rarity={ShapeRarity.COMMON} size={24} />
                                        </div>
                                        <span className="text-[10px] font-black text-purple-500/60 group-hover:text-purple-500 uppercase tracking-widest italic">Void_Rift</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
              </div>
              
              {/* Footer */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-cyan-300/10 bg-black/24 px-5 py-3">
                  <div className="flex flex-col">
                     <span className="mb-1 text-[8px] font-black uppercase tracking-[0.32em] text-cyan-300/44">Deck Ready</span>
                     <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/28">Rapid iteration for classes, threats, and spawn flow</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/6">
                         <div className="h-full w-1/2 bg-gradient-to-r from-cyan-400/28 to-cyan-200/38"></div>
                     </div>
                     <span className="text-[8px] font-black tracking-[0.16em] text-white/18">LOCAL BUILD</span>
                  </div>
              </div>
          </motion.div>
      )}
      </AnimatePresence>

      {/* Bottom Interface */}
      <div className="w-full flex justify-between items-end mt-auto relative gap-8 z-[90]">
        
      {/* stat menu remastered: more compact horizontal-ish layout or smaller vertical stack */}
      <div className={`
        absolute bottom-5 left-4 w-[252px] pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${showStatUpgradeUI ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}
      `}>
         <div className="bg-[#0a0f15]/84 backdrop-blur-3xl p-3 rounded-[1.35rem] border border-white/10 shadow-[0_18px_42px_rgba(0,0,0,0.42)] relative overflow-hidden group/stats">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-50 group-hover/stats:opacity-100 transition-opacity"></div>
             
             <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5 px-1">
                  <div className="flex flex-col">
                    <span className="text-white font-black text-[10px] uppercase tracking-[0.18em]">Upgrade Bay</span>
                  </div>
                  {availableStatPoints > 0 && (
                    <div className="flex items-center gap-1.5 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                      <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Points</span>
                      <span className="text-cyan-400 font-black text-[11px] animate-pulse">
                        {availableStatPoints}
                      </span>
                    </div>
                  )}
             </div>

              <div className="grid grid-cols-1 gap-1">
             {currentStatOrder.map((stat, idx) => {
               const currentVal = stats[stat];
               const isMaxed = currentVal >= 8;
                const canUpgrade = availableStatPoints > 0 && !isMaxed && !showStandardUpgrades;
               const hotkey = idx + 1 === 10 ? '0' : (idx + 1).toString();
               
                let displayLabel: string = stat;
                if (isDroneClass) {
                  if (stat === StatType.BULLET_PENETRATION) displayLabel = "Drone Health";
                  if (stat === StatType.BULLET_DAMAGE) displayLabel = "Drone Damage";
                }
                if (isTrapperBranchClass(currentClass)) {
                  if (stat === StatType.BULLET_SPEED) displayLabel = "Trap Range";
                  if (stat === StatType.BULLET_PENETRATION) displayLabel = "Trap Health";
                  if (stat === StatType.BULLET_DAMAGE) displayLabel = "Trap Damage";
                }

                return (
                 <div 
                  key={stat} 
                  className={`
                     group flex items-center gap-2 rounded-lg py-1 px-2 transition-all duration-200 border
                    ${canUpgrade 
                      ? 'bg-white/5 border-transparent hover:border-cyan-500/40 hover:bg-white/10 cursor-pointer' 
                      : 'bg-transparent border-transparent opacity-60'}
                    ${isMaxed ? 'border-yellow-500/10 bg-yellow-500/5 opacity-100' : ''}
                  `} 
                  onClick={() => canUpgrade && onUpgradeStat(stat)}
                  onMouseEnter={() => canUpgrade && playHover?.()}
                 >
                   <div className={`
                      w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black font-mono border transition-all
                      ${canUpgrade 
                        ? 'bg-black/80 text-cyan-400 border-white/10 group-hover:border-cyan-400 group-hover:bg-cyan-500 group-hover:text-black' 
                        : 'bg-black/20 text-white/10 border-white/5'}
                   `}>
                     {hotkey}
                   </div>

                   <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`break-words text-[8px] font-black uppercase leading-snug tracking-[0.1em] ${canUpgrade ? 'text-white' : 'text-white/40'}`}>
                          {displayLabel}
                        </span>
                        <span className={`text-[7px] font-mono font-bold ${isMaxed ? 'text-yellow-500' : 'text-white/20'}`}>
                          {currentVal}/8
                        </span>
                      </div>
                      <div className="w-full h-1.5 flex gap-[1px] bg-black/60 rounded-full p-[1px] border border-white/5 overflow-hidden">
                        {[...Array(8)].map((_, i) => {
                          const active = i < currentVal;
                          return (
                            <div 
                              key={i} 
                              className={`flex-1 rounded-full transition-all duration-300 ${active ? 'opacity-100' : 'opacity-10'}`} 
                              style={{ 
                                backgroundColor: active ? STAT_COLORS[stat] : 'rgba(255,255,255,0.05)', 
                                boxShadow: active ? `0 0 4px ${STAT_COLORS[stat]}` : 'none' 
                              }} 
                            />
                          );
                        })}
                      </div>
                   </div>
                 </div>
               );
             })}
             </div>
         </div>
      </div>

        {/* Center HUD */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex w-[min(330px,30vw)] min-w-[250px] flex-col items-center pointer-events-auto">
            {voidTransitStage && (
              <div className="mb-2 w-full rounded-xl border border-violet-300/18 bg-[#0b0816]/66 px-3 py-2 backdrop-blur-lg shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
                <div className="flex items-center justify-between gap-3 text-[8px] font-black uppercase tracking-[0.2em] text-violet-100/82">
                  <span>{voidTransitStage}</span>
                  <span>{Math.round((voidTransitProgress || 0) * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-violet-300/12 bg-black/45">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 via-cyan-300 to-white transition-all duration-100 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, (voidTransitProgress || 0) * 100))}%` }}
                  />
                </div>
              </div>
            )}
            <div className="w-full rounded-[1rem] border border-cyan-300/10 bg-[#071018]/62 px-3 py-2.5 backdrop-blur-lg shadow-[0_8px_18px_rgba(0,0,0,0.2)]">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[6.5px] font-black uppercase tracking-[0.16em] text-cyan-300/54">Combat Telemetry</div>
                  <div className={`mt-0.5 break-words text-[21px] font-black leading-none tracking-tight ${scoreLabelTone}`}>{scoreLabel}</div>
                  <div className="mt-0.5 break-words text-[7.5px] font-black uppercase leading-snug tracking-[0.11em] text-white/52">Lvl {level} {compactCurrentClass}</div>
                  <div className={`mt-1 inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[6.5px] font-black uppercase tracking-[0.16em] ${
                    secondarySector === 'restoration'
                      ? 'border-emerald-300/26 bg-emerald-500/10 text-emerald-200'
                      : secondarySector === 'blood'
                        ? 'border-rose-300/26 bg-rose-500/10 text-rose-200'
                        : 'border-white/10 bg-white/[0.04] text-white/42'
                  }`}>
                    {sectorLabel}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {availableStatPoints > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-md border border-cyan-400/16 bg-cyan-500/6 px-1.5 py-0.5">
                      <span className="text-[7px] font-black uppercase tracking-[0.16em] text-cyan-200/70">Pts</span>
                      <span className="text-[10px] font-black text-cyan-300">{availableStatPoints}</span>
                    </div>
                  )}
                  {isDrainingClass && (
                    <div className="inline-flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-950/18 px-1.5 py-0.5">
                      <span className="text-[7px] font-black uppercase tracking-[0.14em] text-rose-200/85">Drain</span>
                      <span className="text-[8px] font-black text-rose-300">{formatScoreValue(liveDrainValue, settings.compactScoreNotation)}</span>
                      <span className="text-[7px] font-black text-amber-300">x{liveDrainStacks}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="rounded-lg border border-white/6 bg-black/16 px-2 py-1.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[6px] font-black uppercase tracking-[0.16em] text-white/46">Hull Integrity</span>
                    <span className="text-[8.5px] font-black tracking-[0.04em] text-white/92">
                      {Math.ceil(displayHealthValue)} / {Math.ceil(maxHealth)}
                    </span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full border border-gray-600/28 bg-black/45">
                      <div className={`relative h-full transition-all duration-75 ease-out ${isTransformed ? 'bg-red-500' : 'bg-[#00e16e]'}`} style={{ width: `${Math.max(0, (displayHealthValue / Math.max(1, maxHealth)) * 100)}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border border-white/6 bg-black/16 px-2 py-1.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[6px] font-black uppercase tracking-[0.16em] text-white/46">Experience</span>
                    <span className="rounded-md border border-amber-300/22 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(251,146,60,0.12))] px-2 py-0.5 text-[10px] font-black tracking-[0.03em] text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.16)]">
                      {Math.floor(displayXpPercent)}%
                    </span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full border border-amber-200/18 bg-[linear-gradient(180deg,rgba(18,12,4,0.82),rgba(10,8,4,0.9))] shadow-[inset_0_0_12px_rgba(0,0,0,0.28)]">
                     <div className="relative h-full bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 transition-all duration-75 ease-out shadow-[0_0_18px_rgba(251,191,36,0.22)]" style={{ width: `${displayXpPercent}%` }}>
                       <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/35 to-transparent" />
                     </div>
                     <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_45%,rgba(0,0,0,0.14))]" />
                    <div className="pointer-events-none absolute inset-y-[3px] left-2 right-2 rounded-full border-t border-white/8" />
                  </div>
                  </div>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
