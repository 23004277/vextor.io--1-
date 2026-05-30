
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameMode, GameSettings, GameState, HighScoreEntry, PlayerState, StatType, TankClass, Team, ShapeType, ShapeRarity } from '../types';
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
const SANDBOX_RESEARCH_ICON_REV = '2026-05-28-engine-match';
const SANDBOX_TAB_META: Record<SandboxTab, { label: string; icon: any; hint: string }> = {
  SYSTEM: { label: 'World', icon: Cpu, hint: 'Simulation controls' },
  RESEARCH: { label: 'Tanks', icon: FlaskConical, hint: 'Class research and swap' },
  SPAWN: { label: 'Entities', icon: Boxes, hint: 'Spawner and templates' },
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
            TankClass.OVERSEER, 
            TankClass.OVERLORD, 
            TankClass.MANAGER, 
            TankClass.TRIPLE_TANK
        ]
    },
    {
        name: "Restoration",
        classes: [
            TankClass.PACIFIST_TRAINEE,
            TankClass.NURSE,
            TankClass.DOCTOR,
            TankClass.PLAGUE_DOCTOR
        ]
    },
    {
        name: "Blood",
        classes: [
            TankClass.DRAINER_TRAINEE,
            TankClass.LEECH,
            TankClass.VAMPIRE,
            TankClass.REAPER
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

export const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, onUpgradeStat, onUpgradeClass, onRestart, onExit, highScores, playHover, engine, settings, deathReport }) => {
  const { 
    score, level, xp, maxXp, stats, availableStatPoints, currentClass, isDead, fps, killFeed, 
    leaderboard, health, maxHealth, camera, mapSize, gameMode, 
    notifications, inVoid, voidTimeRemaining, isTransformed, transformationTime, 
    transformationReady, activeBuffs, minimapMarkers, sandboxConfig, primedSpawn, abilityHud,
    playerState, evolutionTransitionRemaining, bossChoices, enemyZoneWarningLevel, enemyZoneWarningText,
    bloodDrainLive, bloodDrainStacks, bloodDrainSession
  } = gameState;

  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SandboxTab>('SYSTEM');
  const [selectedRarity, setSelectedRarity] = useState<ShapeRarity>(ShapeRarity.COMMON);
  const [spawnAmount, setSpawnAmount] = useState(1);
  const [showStatsMenu, setShowStatsMenu] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchSector, setResearchSector] = useState<string>('ALL');
  const [sandboxButtonPulse, setSandboxButtonPulse] = useState(false);

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
  const availableClasses = CLASS_TREE[currentClass] || [];
  const getClassUpgradeLevelRequirement = (targetClass: TankClass): number => {
    const tier30 = new Set<TankClass>([
      TankClass.TWIN, TankClass.SNIPER, TankClass.MACHINE_GUN, TankClass.FLANK_GUARD,
      TankClass.PACIFIST_TRAINEE, TankClass.DRAINER_TRAINEE,
    ]);
    const tier60 = new Set<TankClass>([
      TankClass.TRIPLE_SHOT, TankClass.QUAD_TANK, TankClass.TWIN_FLANK,
      TankClass.HUNTER, TankClass.ASSASSIN, TankClass.DESTROYER, TankClass.GUNNER,
      TankClass.SPREAD_SHOT, TankClass.TRI_ANGLE, TankClass.OVERSEER,
      TankClass.NURSE, TankClass.LEECH, TankClass.SPRAYER, TankClass.VAMPIRE, TankClass.DOCTOR,
    ]);
    if (tier30.has(targetClass)) return 30;
    if (tier60.has(targetClass)) return 60;
    return 90;
  };
  const unlockableClasses = availableClasses.filter(cls => level >= getClassUpgradeLevelRequirement(cls as TankClass));
  
  const showBossChoiceUI = playerState === PlayerState.BOSS_SELECTION;
  const showStandardUpgrades = !showBossChoiceUI && (unlockableClasses.length > 0 && !isTransformed) && gameMode !== GameMode.SANDBOX;
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

  if (isDead) {
    return (
      <div className="absolute inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto px-4">
        <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/15 bg-[#090d18] shadow-[0_30px_80px_rgba(0,0,0,0.75)] animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(56,189,248,0.12), transparent 60%)' }} />
          <div className="relative px-8 pt-8 pb-7">
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
              <div className="text-lg font-black text-white mt-1 truncate">{currentClass}</div>
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

  const isPacifistClass = [
    TankClass.PACIFIST_TRAINEE,
    TankClass.NURSE,
    TankClass.DOCTOR,
    TankClass.PLAGUE_DOCTOR
  ].includes(currentClass);

  const isDrainingClass = [
    TankClass.DRAINER_TRAINEE,
    TankClass.LEECH,
    TankClass.VAMPIRE,
    TankClass.REAPER
  ].includes(currentClass);
  const liveDrainValue = Math.max(0, bloodDrainLive || 0);
  const liveDrainStacks = Math.max(0, bloodDrainStacks || 0);
  const sessionDrainValue = Math.max(0, bloodDrainSession || 0);

  const currentStatOrder = isPacifistClass ? [
    StatType.REGEN, StatType.MAX_HEALTH, StatType.BODY_DAMAGE,
    StatType.HEALING_RADIUS, StatType.HEALING_EFFICIENCY, StatType.HEALING_BURST, StatType.SUPPORT_XP_MULT,
    StatType.MOVEMENT_SPEED, StatType.BULLET_SPREAD, StatType.MAX_SHIELD
  ] : isDrainingClass ? [
    StatType.REGEN, StatType.MAX_HEALTH, StatType.BODY_DAMAGE,
    StatType.DRAIN_RADIUS, StatType.DRAIN_EFFICIENCY, StatType.DRAIN_LIFESTEAL, StatType.DRAIN_BURST,
    StatType.MOVEMENT_SPEED, StatType.BULLET_SPREAD, StatType.MAX_SHIELD
  ] : STAT_ORDER;

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
  const isTeamMode = gameMode === GameMode.TEAMS;

  return (
    <div 
        className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between overflow-hidden font-sans select-none z-[100]"
        style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'center center' }}
    >
      
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
                        ) : null}
                    </div>
                    <span className="text-white font-black italic">{primedSpawn.rarity} {primedSpawn.shapeType || primedSpawn.type}</span>
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

      {(playerState === PlayerState.EVOLVING || showBossChoiceUI) && (
        <div className="absolute inset-0 z-[180] flex items-center justify-center pointer-events-auto px-6">
          <div className="w-full max-w-3xl rounded-3xl border border-cyan-300/20 bg-[#030712]/92 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] p-6">
            {playerState === PlayerState.EVOLVING ? (
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
                      <TankPreview tankClass={resolvePreviewClass(cls)} size={46} showArenaVfx={isRebirthPreviewClass(cls)} />
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
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-4 pointer-events-none">
             <div className="bg-black/60 px-3 py-1.5 rounded-lg text-white/80 font-mono text-xs font-bold backdrop-blur-md border border-white/10 shadow-lg w-fit pointer-events-auto">
                FPS: <span className={fps < 30 ? 'text-red-400' : 'text-green-400'}>{fps}</span>
            </div>
            
            {showStandardUpgrades && (
                <div 
                  key={`${currentClass}-${unlockableClasses.join('-')}`} 
                  className="mt-2 animate-in slide-in-from-left-20 duration-500 ease-out fade-in pointer-events-auto"
                >
                    <div className="relative overflow-hidden rounded-2xl border-[3px] border-cyan-400 bg-[#121212]/95 shadow-[0_0_40px_rgba(34,211,238,0.2)] backdrop-blur-xl w-[280px]">
                        <div className="pt-4 pb-3 px-6 text-center border-b border-white/5 bg-cyan-400/5">
                            <h3 className="text-cyan-400 font-black text-xl italic tracking-[0.15em]">EVOLUTION</h3>
                            <p className="text-[8px] font-bold text-cyan-400/40 uppercase mt-0.5 tracking-widest">Select chassis upgrade</p>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            {unlockableClasses.map((cls) => (
                                <button 
                                  key={cls} 
                                  onClick={() => handleClassSelection(cls as TankClass)} 
                                  onMouseEnter={playHover} 
                                  className="group flex flex-col items-center justify-between aspect-square rounded-xl bg-[#1e1e1e] border-2 border-[#333] hover:border-cyan-400 hover:bg-cyan-950/20 hover:scale-[1.03] active:scale-95 transition-all shadow-lg"
                                >
                                    <div className="flex-1 flex items-center justify-center transform group-hover:scale-110 transition-transform pb-4 pt-2">
                                        <TankPreview
                                          key={`${SANDBOX_RESEARCH_ICON_REV}-evo-${cls}`}
                                          tankClass={resolvePreviewClass(cls as TankClass)}
                                          size={54}
                                        /> 
                                    </div>
                                    <div className="w-full text-center pb-2 bg-black/20 group-hover:bg-cyan-400/10 transition-colors">
                                        <span className="block text-[9px] font-black text-gray-500 group-hover:text-cyan-200 uppercase tracking-wider">{cls.replace(' Tank', '')}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="flex flex-col items-end gap-3 pointer-events-auto">
             <div className="flex items-center gap-2">
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

             <div className="w-[260px] rounded-2xl border border-cyan-400/20 bg-[#040913]/88 backdrop-blur-xl overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.55)]">
                 <div className="px-3 py-2 border-b border-white/10 bg-cyan-500/[0.05] flex items-center justify-between">
                   <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200/80">Leaderboard</span>
                   <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">Live</span>
                 </div>
                 <div className="flex flex-col max-h-[232px] overflow-y-auto custom-scrollbar">
                     {leaderboard.map((entry, i) => (
                         (() => {
                           const entryTeam = entry.teamId ?? entry.team;
                           const rowClass = !isTeamMode
                             ? (entry.isPlayer ? 'bg-cyan-500/12 text-cyan-200' : 'text-white/80')
                             : entryTeam === Team.BLUE
                               ? (entry.isPlayer ? 'bg-cyan-500/18 text-cyan-100' : 'bg-cyan-500/8 text-cyan-50')
                               : entryTeam === Team.RED
                                 ? (entry.isPlayer ? 'bg-rose-500/18 text-rose-100' : 'bg-rose-500/8 text-rose-50')
                                 : (entry.isPlayer ? 'bg-cyan-500/12 text-cyan-200' : 'text-white/80');
                           const iconClass = entry.currentClass ?? entry.classType;
                           return (
                         <div
                           key={entry.id}
                           className={`grid grid-cols-[26px_28px_1fr_auto] items-center gap-2 px-3 py-2 text-xs border-b border-white/5 ${rowClass}`}
                          >
                             <span className={`text-[10px] font-black ${i < 3 ? 'text-amber-300' : 'text-white/45'}`}>{i + 1}</span>
                             <div className="w-7 h-7 rounded-md bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
                               <TankPreview tankClass={iconClass} size={18} />
                             </div>
                             <span className="truncate font-black tracking-wide">{entry.name}</span>
                             <span className="font-mono text-[11px] text-white/75">{formatScoreValue(entry.score, settings.compactScoreNotation)}</span>
                          </div>
                           );
                         })()
                      ))}
                 </div>
             </div>

             <div className="relative w-[176px] h-[176px] rounded-2xl overflow-hidden bg-black/70 border border-cyan-400/25 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_18px_40px_rgba(0,0,0,0.6)]">
                 <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.14),transparent_60%)]" />
                 <div className="absolute inset-x-0 top-0 h-7 z-10 flex items-center justify-between px-2.5 border-b border-white/10 bg-black/45">
                   <span className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Tactical Map</span>
                   <span className="text-[9px] font-bold text-white/40">x1</span>
                 </div>
                 <div className="absolute inset-[10px] top-[36px] rounded-lg overflow-hidden border border-white/10">
                   <TacticalMinimap markers={minimapMarkers} mapSize={mapSize} camera={camera} inVoid={inVoid} gameMode={gameState.gameMode} />
                 </div>
             </div>

             {abilityHud && (
               <div className={`w-[176px] rounded-xl border backdrop-blur-md px-2.5 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.42)] ${
                 abilityHud.active
                   ? 'border-emerald-300/30 bg-emerald-950/35'
                   : abilityReady
                     ? 'border-cyan-300/30 bg-cyan-950/35'
                     : 'border-white/15 bg-black/60'
               }`}>
                 <div className="flex items-center justify-between gap-2">
                   <div className="flex items-center gap-2 min-w-0">
                     <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${
                       abilityHud.active ? 'border-emerald-300/35 bg-emerald-400/12' : abilityReady ? 'border-cyan-300/30 bg-cyan-400/10' : 'border-white/20 bg-white/5'
                     }`}>
                       {React.createElement(abilityIcon, { className: `w-3.5 h-3.5 ${abilityHud.active ? 'text-emerald-300' : abilityReady ? 'text-cyan-300' : 'text-amber-300'}` })}
                     </div>
                     <div className="min-w-0">
                       <div className="text-[9px] font-black uppercase tracking-[0.12em] text-white/85 truncate">{abilityHud.name}</div>
                       <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/50 truncate">{abilityHud.trigger}</div>
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
         </div>
      </div>

      {/* Sandbox Command Panel */}
      <AnimatePresence>
      {gameMode === GameMode.SANDBOX && sandboxOpen && (
          <motion.div
            initial={{ opacity: 0, x: 36, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 280, damping: 24 } }}
            exit={{ opacity: 0, x: 28, scale: 0.99, transition: { duration: 0.18 } }}
            className="absolute top-24 right-6 w-[560px] max-w-[calc(100vw-3rem)] max-h-[85vh] bg-[#050505]/98 backdrop-blur-3xl border-2 border-cyan-500/20 rounded-[2.25rem] flex flex-col pointer-events-auto overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.9)] z-[200]"
          >
              {/* Header */}
              <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01] shrink-0">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.1)] group">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400 group-hover:scale-110 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 110-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" /></svg>
                    </div>
                    <div>
                        <span className="text-xl font-black text-white italic tracking-tighter uppercase leading-none block">TERMINAL_VEXTOR</span>
                        <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                            <p className="text-[9px] font-bold text-cyan-500/60 tracking-[0.4em] uppercase">Status // Superuser_Active</p>
                        </div>
                    </div>
                  </div>
                  <button onClick={() => setSandboxOpen(false)} className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/5 active:scale-90">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/40" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/5 bg-black/40 shrink-0 h-16">
                  {(['SYSTEM', 'RESEARCH', 'SPAWN'] as SandboxTab[]).map(tab => (
                      <button 
                        key={tab}
                        onClick={() => { playHover?.(); setActiveTab(tab); }}
                        title={SANDBOX_TAB_META[tab].hint}
                        className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-all relative group ${activeTab === tab ? 'text-cyan-400 bg-cyan-400/5' : 'text-white/20 hover:text-white/50 hover:bg-white/[0.02]'}`}
                      >
                        {React.createElement(SANDBOX_TAB_META[tab].icon, { className: 'w-3.5 h-3.5 relative z-10' })}
                        <span className="relative z-10">{SANDBOX_TAB_META[tab].label}</span>
                        {activeTab === tab && (
                            <motion.div 
                                layoutId="sandboxTab"
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-cyan-400 rounded-t-full shadow-[0_0_15px_#22d3ee]"
                            />
                        )}
                        <div className={`absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent transition-opacity duration-500 ${activeTab === tab ? 'opacity-100' : 'opacity-0'}`}></div>
                      </button>
                  ))}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-10 no-scrollbar scroll-smooth space-y-12 overscroll-y-contain">
                  <AnimatePresence mode="wait">
                  {activeTab === 'SYSTEM' && (
                    <motion.div
                      key="tab-system"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-10"
                    >
                        {/* Core Toggles */}
                        <div className="grid grid-cols-2 gap-4">
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
                                        className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all group ${active ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_10px_30px_rgba(34,211,238,0.2)]' : 'bg-white/[0.03] border-white/5 text-white/30 hover:bg-white/[0.06] hover:border-white/10'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-black/10' : 'bg-black/40'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${active ? 'text-black' : 'text-cyan-500/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={flag.icon} />
                                            </svg>
                                        </div>
                                        <div className="flex flex-col items-start overflow-hidden">
                                            <span className="text-[10px] font-black uppercase tracking-widest truncate w-full">{flag.label}</span>
                                            <span className={`text-[7px] font-black uppercase tracking-[0.2em] mt-0.5 ${active ? 'text-black/60' : 'text-cyan-500/40'}`}>{active ? 'Active' : 'Standby'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* Simulation Speed Sliders */}
                        <div className="space-y-6 bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">Temporal_Scale</span>
                                <span className="text-[10px] font-mono text-white/40">{sandboxConfig?.gameSpeed.toFixed(1)}x</span>
                            </div>
                            <div className="flex gap-2">
                                {[0.2, 0.5, 1.0, 2.0, 5.0].map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => engine.setSandboxFlag('gameSpeed', s)} 
                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${sandboxConfig?.gameSpeed === s ? 'bg-white border-white text-black' : 'bg-white/5 border-transparent text-white/30 hover:text-white/60'}`}
                                    >
                                        {s}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dangerous Tools Section */}
                        <div className="p-8 rounded-[3rem] bg-red-500/[0.02] border border-red-500/10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]"></div>
                                <span className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.3em]">Critical_Functions</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <button onClick={() => engine.maxAllStats()} className="flex items-center justify-between px-8 py-5 rounded-2xl bg-yellow-400 group hover:scale-[1.02] transition-all shadow-xl shadow-yellow-500/10">
                                    <span className="text-[11px] font-black text-black uppercase tracking-widest italic">MAX_OVERCLOCK_STATS</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => engine.clearEntities('BULLETS')} className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/40 transition-all font-black text-[9px] uppercase tracking-widest italic">Flush_Projectiles</button>
                                    <button onClick={() => engine.clearEntities('SHAPES')} className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/40 transition-all font-black text-[9px] uppercase tracking-widest italic">Wipe_Shapes</button>
                                </div>
                                <button onClick={() => engine.clearEntities('ALL')} className="flex items-center justify-between px-8 py-5 mt-2 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 transition-all group">
                                    <span className="text-[11px] font-black uppercase tracking-widest italic">SYSTEM_DEEP_CLEAN</span>
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
                      className="space-y-12 pb-10"
                    >
                        <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[2.5rem] mb-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-indigo-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                            </div>
                            <h4 className="text-xs font-black text-indigo-400 uppercase mb-2 tracking-[0.2em] italic">Hot-Swap Chassis Bypass</h4>
                            <p className="text-[9px] text-indigo-300/50 font-bold leading-relaxed tracking-wider uppercase max-w-[80%]">Modify current hardware configuration in real-time. Warning: Hot-swapping while engines are active may cause temporary stabilization drift.</p>
                        </div>

                        <div className="p-5 rounded-3xl border border-white/10 bg-black/35 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
                                    <input
                                      value={researchQuery}
                                      onChange={(e) => setResearchQuery(e.target.value)}
                                      placeholder="Search class name..."
                                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold tracking-wide outline-none focus:border-cyan-400/60"
                                    />
                                </div>
                                <button
                                  onClick={() => { setResearchQuery(''); setResearchSector('ALL'); }}
                                  className="px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/70 bg-white/5 border border-white/10 hover:bg-white/10"
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
                                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${researchSector === name ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-white/5 text-white/60 border-white/10 hover:text-white'}`}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                        </div>

                        {researchCategories.map(cat => (
                            <div key={cat.name} className="space-y-6">
                                <div className="flex items-center gap-4 px-2">
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] italic">{cat.name} Sector</span>
                                    <div className="h-px flex-1 bg-white/[0.04]"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {cat.classes.map(cls => (
                                        <button 
                                            key={cls} 
                                            onClick={() => { playHover?.(); onUpgradeClass(cls); }} 
                                            className={`group relative flex flex-col gap-6 p-6 rounded-[2.5rem] border-2 transition-all overflow-hidden ${currentClass === cls ? 'bg-indigo-600 border-indigo-400 shadow-2xl' : 'bg-white/[0.03] border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.06]'}`}
                                        >
                                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
                                                <TankPreview
                                                  key={`${SANDBOX_RESEARCH_ICON_REV}-bg-${cls}`}
                                                  tankClass={resolvePreviewClass(cls)}
                                                  size={100}
                                                  showArenaVfx={isRebirthPreviewClass(cls)}
                                                />
                                            </div>
                                            <div className="shrink-0 transform group-hover:scale-110 transition-transform duration-500 relative z-10 w-fit">
                                                <div className="p-4 rounded-3xl bg-black/40 border border-white/10 group-hover:border-white/20 transition-all shadow-xl">
                                                    <TankPreview
                                                      key={`${SANDBOX_RESEARCH_ICON_REV}-card-${cls}`}
                                                      tankClass={resolvePreviewClass(cls)}
                                                      size={54}
                                                      color={currentClass === cls ? '#fff' : undefined}
                                                      showArenaVfx={isRebirthPreviewClass(cls)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="relative z-10 flex flex-col">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${currentClass === cls ? 'bg-white animate-pulse' : 'bg-indigo-500'}`}></div>
                                                    <span className={`text-[11px] font-black uppercase italic tracking-tighter ${currentClass === cls ? 'text-white' : 'text-white/80'}`}>{cls.replace(' Tank', '')}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[7px] font-black uppercase tracking-widest ${currentClass === cls ? 'text-white/60' : 'text-white/20'}`}>Ref_UID: {cls.toUpperCase().replace(/\s/g, '_')}</span>
                                                    {currentClass === cls && <span className="text-[7px] font-black text-white bg-black/30 px-1.5 py-0.5 rounded-full uppercase">Current</span>}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {researchCategories.length === 0 && (
                          <div className="p-10 rounded-3xl border border-white/10 bg-white/[0.03] text-center">
                            <span className="text-xs font-black tracking-[0.25em] text-white/30 uppercase">No Matching Chassis</span>
                          </div>
                        )}
                    </motion.div>
                  )}

                  {activeTab === 'SPAWN' && (
                    <motion.div
                      key="tab-spawn"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-12"
                    >
                        {/* Spawning Settings */}
                        <div className="p-10 rounded-[3rem] bg-white/[0.03] border-2 border-white/5 space-y-10">
                            <div className="flex items-center justify-between group">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-white uppercase tracking-tighter italic">Molecular_Fabricator</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${sandboxConfig?.spawningEnabled ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${sandboxConfig?.spawningEnabled ? 'text-green-500' : 'text-red-500/60'}`}>{sandboxConfig?.spawningEnabled ? 'ONLINE_READY' : 'FABRICATION_LOCKED'}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => engine.setSandboxFlag('spawningEnabled', !sandboxConfig?.spawningEnabled)} 
                                    className={`w-20 h-10 rounded-full p-1.5 transition-all relative ${sandboxConfig?.spawningEnabled ? 'bg-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-white/10'}`}
                                >
                                    <div className={`w-7 h-7 rounded-full bg-white transition-all transform shadow-2xl ${sandboxConfig?.spawningEnabled ? 'translate-x-10' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-2 italic">Fabrication_Density</span>
                                    <div className="flex items-center gap-4 bg-black/40 p-1 rounded-2xl border border-white/5">
                                        <button onClick={() => setSpawnAmount(prev => Math.max(1, prev - 1))} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all">-</button>
                                        <span className="flex-1 text-center font-black text-white text-lg">{spawnAmount}</span>
                                        <button onClick={() => setSpawnAmount(prev => Math.min(25, prev + 1))} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all">+</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] px-2 italic">Spawn_Rate</span>
                                    <div className="flex items-center gap-4 bg-black/40 p-1 rounded-2xl border border-white/5">
                                        <button onClick={() => engine.setSandboxFlag('shapeSpawnRate', Math.max(0.1, (sandboxConfig?.shapeSpawnRate || 1) - 0.5))} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all">-</button>
                                        <span className="flex-1 text-center font-black text-white text-lg">{sandboxConfig?.shapeSpawnRate.toFixed(1)}x</span>
                                        <button onClick={() => engine.setSandboxFlag('shapeSpawnRate', Math.min(10, (sandboxConfig?.shapeSpawnRate || 1) + 0.5))} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`transition-all duration-700 space-y-12 ${sandboxConfig?.spawningEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none filter grayscale blur-sm scale-[0.98]'}`}>
                            {/* Rarity Selector */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] italic leading-none">Genetic_Integrity</span>
                                    <span className="text-[8px] font-black text-white/20 uppercase">Core_Rarity_Profiles</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-2 bg-black/40 rounded-[2rem] border border-white/5">
                                    {[ShapeRarity.COMMON, ShapeRarity.RARE, ShapeRarity.EPIC, ShapeRarity.LEGENDARY, ShapeRarity.MYTHICAL, ShapeRarity.TRANSCENDENT].map(r => (
                                        <button 
                                            key={r} 
                                            onClick={() => { playHover?.(); setSelectedRarity(r); }} 
                                            className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 relative overflow-hidden group ${selectedRarity === r ? 'bg-cyan-500 border-cyan-400 text-black shadow-lg shadow-cyan-500/20 animate-pulse' : 'bg-transparent border-transparent text-white/20 hover:text-white/50 hover:bg-white/[0.02]'}`}
                                        >
                                            <span className="relative z-10">{r}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Elite Entities */}
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => handlePrimeSpawn({ type: 'BOSS', rarity: selectedRarity })} className={`p-8 rounded-[3rem] border-2 flex flex-col items-center gap-5 transition-all group relative overflow-hidden ${primedSpawn?.type === 'BOSS' ? 'bg-red-500/20 border-red-500 shadow-2xl' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-red-500/30'}`}>
                                    <div className="shrink-0 flex items-center justify-center transform group-hover:scale-110 group-active:scale-95 transition-all duration-500 relative z-10">
                                        <ShapePreview type="GRAND_SINGULARITY" rarity={ShapeRarity.COMMON} size={84} />
                                    </div>
                                    <span className="text-[11px] font-black text-white italic uppercase tracking-widest relative z-10">Grand_Singularity</span>
                                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </button>
                                <button onClick={() => handlePrimeSpawn({ type: 'ELITE_TANK', group: 'ELITE', classType: TankClass.TWIN, rarity: selectedRarity })} className={`p-8 rounded-[3rem] border-2 flex flex-col items-center gap-5 transition-all group relative overflow-hidden ${primedSpawn?.type === 'ELITE_TANK' ? 'bg-amber-500/20 border-amber-500 shadow-2xl' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-amber-500/30'}`}>
                                    <div className="shrink-0 flex items-center justify-center transform group-hover:scale-110 group-active:scale-95 transition-all duration-500 relative z-10">
                                        <TankPreview tankClass={TankClass.DESTROYER} size={84} />
                                    </div>
                                    <span className="text-[11px] font-black text-white italic uppercase tracking-widest relative z-10">Elite_Legionnaire</span>
                                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </button>
                            </div>

                            {/* Shape Toggles & Spawning */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 px-2">
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] italic">Standard_Templates</span>
                                    <div className="h-px flex-1 bg-white/[0.04]"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.values(ShapeType) as ShapeType[]).map(t => {
                                        const isEnabled = sandboxConfig?.enabledShapes[t];
                                        return (
                                            <div key={t} className="bg-white/[0.02] border border-white/5 rounded-3xl p-3 flex items-center gap-4 group">
                                                <button 
                                                    onClick={() => engine.setShapeToggle(t, !isEnabled)} 
                                                    className={`w-6 h-6 rounded-lg transition-all border flex items-center justify-center shrink-0 ${isEnabled ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-black/40 border-white/10 text-transparent'}`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handlePrimeSpawn({ type: 'SHAPE', shapeType: t, rarity: selectedRarity })} 
                                                    className="flex-1 flex items-center justify-between pr-4 group/btn"
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
              <div className="px-10 py-6 bg-cyan-400/[0.01] border-t border-white/5 shrink-0 flex justify-between items-center">
                 <div className="flex flex-col">
                    <span className="text-[8px] font-black text-cyan-500/40 uppercase tracking-[0.5em] leading-none mb-1">Terminal_Active // 0x2A // REV_9</span>
                    <p className="text-[7px] text-white/20 font-bold uppercase tracking-widest italic">Optimized for experimental chassis testing</p>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500/20 w-1/3 animate-pulse"></div>
                    </div>
                    <span className="text-[8px] font-black text-white/10 tracking-[0.2em]">v.0.95.122</span>
                 </div>
              </div>
          </motion.div>
      )}
      </AnimatePresence>

      {/* Bottom Interface */}
      <div className="w-full flex justify-between items-end mt-auto relative gap-8 z-[90]">
        
      {/* stat menu remastered: more compact horizontal-ish layout or smaller vertical stack */}
      <div className={`
        absolute bottom-6 left-6 w-[280px] pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${showStatUpgradeUI ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}
      `}>
         <div className="bg-[#0a0a0a]/90 backdrop-blur-3xl p-4 rounded-[1.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group/stats">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-50 group-hover/stats:opacity-100 transition-opacity"></div>
             
             <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5 px-1">
                  <div className="flex flex-col">
                    <span className="text-white font-black text-[10px] uppercase tracking-[0.2em] italic">Tactical_Upgrade</span>
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
                        <span className={`text-[8px] font-black uppercase tracking-wider truncate leading-none ${canUpgrade ? 'text-white' : 'text-white/40'}`}>
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
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[40%] max-w-2xl flex flex-col items-center pointer-events-auto">
            <div className="mb-2 text-center">
               <div className="text-4xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] tracking-tighter leading-none">{scoreLabel}</div>
               <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mt-2">Lvl {level} {currentClass}</div>
               {isDrainingClass && (
                 <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-rose-400/35 bg-black/55 px-2.5 py-1.5">
                   <span className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-200/90">Drain</span>
                   <span className="text-[10px] font-black text-rose-300">{formatScoreValue(liveDrainValue, settings.compactScoreNotation)}</span>
                   <span className="text-[9px] font-black text-amber-300">x{liveDrainStacks}</span>
                   <span className="text-[9px] font-bold text-white/55">Session {formatScoreValue(sessionDrainValue, settings.compactScoreNotation)}</span>
                 </div>
               )}
             </div>
           <div className="w-full h-4 mb-1.5 bg-black/60 rounded-full border border-gray-600/50 relative shadow-lg overflow-hidden group">
               <div className={`h-full transition-all duration-200 ease-out relative ${isTransformed ? 'bg-red-500' : 'bg-[#00e16e]'}`} style={{ width: `${Math.max(0, (health / maxHealth) * 100)}%` }} />
               <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] z-10 tracking-wider">{Math.ceil(health)} / {Math.ceil(maxHealth)}</div>
           </div>
           <div className="w-full h-4 bg-black/60 rounded-full border border-gray-600/50 relative shadow-xl overflow-hidden group">
              <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-700 ease-out relative" style={{ width: `${xpPercent}%` }}></div>
              <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] z-10 tracking-wider"><span>{Math.floor(xpPercent)}%</span></div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
