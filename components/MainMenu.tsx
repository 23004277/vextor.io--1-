import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { GameMode, HighScoreEntry, TankClass, User, Team } from '../types';
import { BackgroundMusicVisualizerFrame } from '../Background Music';
import { TankPreview } from './TankPreview';
import { MenuMusicVisualizer } from './MenuMusicVisualizer';
import { COLORS } from '../constants';
import { BackendService } from '../services/BackendService';
import { BookOpen, ChevronRight, Eye, Pencil, Radar, ScrollText, SlidersHorizontal, Trophy, Warehouse } from 'lucide-react';

interface MainMenuProps {
  isPlaying: boolean;
  playerName: string;
  setPlayerName: (name: string) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  highScores: HighScoreEntry[];
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  selectedTeam: Team;
  setSelectedTeam: (team: Team) => void;
  handleStartGame: (e: React.FormEvent) => void;
  handleSpectate: () => void;
  spectateAvailable: boolean;
  musicSnapshot: BackgroundMusicVisualizerFrame | null;
  showTT: (label: string, desc?: string) => void;
  hideTT: () => void;
  playHover: () => void;
  playClick: () => void;
  playSelect: () => void;
  setShowLogin: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowAlmanac: (show: boolean) => void;
  setShowShop: (show: boolean) => void;
  setShowUpdateHistory: (show: boolean) => void;
  setShowAchievements: (show: boolean) => void;
  setShowSupport: (show: boolean) => void;
  updateLog: { id: string; title: string; date: string; content: string; }[];
  parallax: { x: number; y: number };
  activeColor: string;
  teamCounts: Record<Team, number>;
  canJoinTeam: (team: Team) => boolean;
}

const modeMeta: Record<GameMode, { title: string; code: string; desc: string; color: string; border: string; glow: string }> = {
  [GameMode.FFA]: {
    title: 'Free For All',
    code: 'FFA',
    desc: 'Pure survival. No teammates. No excuses.',
    color: 'rgba(0,210,255,0.9)',
    border: 'rgba(0,210,255,0.35)',
    glow: 'rgba(0,180,255,0.25)',
  },
  [GameMode.TEAMS]: {
    title: 'Team Warfare',
    code: 'TWF',
    desc: 'Pick a side and push with the squad.',
    color: 'rgba(80,160,255,0.9)',
    border: 'rgba(80,140,255,0.35)',
    glow: 'rgba(60,120,255,0.25)',
  },
  [GameMode.DOMINION]: {
    title: 'Dominion',
    code: 'DOM',
    desc: 'Capture dominion tanks, hold the field, and score for your empire.',
    color: 'rgba(250,204,21,0.92)',
    border: 'rgba(250,204,21,0.38)',
    glow: 'rgba(234,179,8,0.22)',
  },
  [GameMode.SANDBOX]: {
    title: 'Sandbox',
    code: 'SBX',
    desc: 'Experiment freely. No rules.',
    color: 'rgba(200,100,255,0.9)',
    border: 'rgba(180,80,255,0.35)',
    glow: 'rgba(160,60,255,0.25)',
  },
};

const TEAM_META: Record<Team, { label: string; color: string; bg: string; border: string }> = {
  [Team.NONE]: { label: 'Neutral', color: '#ffffff', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)' },
  [Team.BLUE]: { label: 'Blue Squad', color: COLORS.player, bg: 'rgba(0,40,120,0.4)', border: 'rgba(80,140,255,0.4)' },
  [Team.RED]: { label: 'Red Squad', color: COLORS.enemy, bg: 'rgba(120,0,40,0.4)', border: 'rgba(255,80,80,0.4)' },
  [Team.GREEN]: { label: 'Green Wing', color: COLORS.allyGreen, bg: 'rgba(0,90,50,0.38)', border: 'rgba(52,211,153,0.42)' },
  [Team.PURPLE]: { label: 'Purple Wing', color: COLORS.allyPurple, bg: 'rgba(65,25,120,0.4)', border: 'rgba(167,139,250,0.42)' },
};

const useCountUp = (target: number, duration = 1200) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= target) {
        setVal(target);
        clearInterval(id);
      } else {
        setVal(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
};

const StatPill: React.FC<{ label: string; value: number | string; accent?: string }> = ({ label, value, accent = '#00d2ff' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 18, fontWeight: 900, color: accent, lineHeight: 1, textShadow: `0 0 12px ${accent}` }}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
      {label}
    </span>
  </div>
);

const Corner: React.FC<{ pos: 'tl' | 'tr' | 'bl' | 'br'; color?: string; size?: number }> = ({ pos, color = 'rgba(0,210,255,0.25)', size = 16 }) => {
  const styles: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
    ...(pos === 'tl' ? { top: 0, left: 0, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` } : {}),
    ...(pos === 'tr' ? { top: 0, right: 0, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` } : {}),
    ...(pos === 'bl' ? { bottom: 0, left: 0, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` } : {}),
    ...(pos === 'br' ? { bottom: 0, right: 0, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` } : {}),
  };
  return <div style={styles} />;
};

const Scanlines: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none z-[1]" style={{
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
    backgroundSize: '100% 4px',
  }} />
);

export const MainMenu: React.FC<MainMenuProps> = ({
  isPlaying,
  playerName,
  setPlayerName,
  user,
  setUser,
  highScores,
  gameMode,
  setSelectedTeam,
  selectedTeam,
  setGameMode,
  handleStartGame,
  handleSpectate,
  spectateAvailable,
  musicSnapshot,
  showTT,
  hideTT,
  playHover,
  playClick,
  playSelect,
  setShowLogin,
  setShowSettings,
  setShowShop,
  setShowAlmanac,
  setShowUpdateHistory,
  setShowAchievements,
  setShowSupport,
  parallax,
  activeColor,
  canJoinTeam,
}) => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const stats = user?.stats ?? { maxLevel: 1, totalKills: 0, totalDeaths: 0, totalScore: 0 };
  const tankColor = (gameMode === GameMode.TEAMS || gameMode === GameMode.DOMINION)
    ? (TEAM_META[selectedTeam]?.color ?? COLORS.player)
    : activeColor;
  const isTeamsMode = gameMode === GameMode.TEAMS || gameMode === GameMode.DOMINION;
  const kd = (stats.totalKills / (stats.totalDeaths || 1)).toFixed(2);

  const countKills = useCountUp(stats.totalKills, 1400);
  const countScore = useCountUp(stats.totalScore, 1600);

  const topScores = useMemo(() => [...highScores].sort((a, b) => b.score - a.score).slice(0, 5), [highScores]);

  const modeChoices = [GameMode.FFA, GameMode.TEAMS, GameMode.DOMINION, GameMode.SANDBOX] as const;
  const teamChoices = gameMode === GameMode.DOMINION
    ? [Team.BLUE, Team.RED, Team.GREEN, Team.PURPLE]
    : [Team.BLUE, Team.RED];

  const containerVar: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
    exit: { opacity: 0, transition: { duration: 0.25 } },
  };
  const panelVar: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  };
  const slideLeft: Variants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  };
  const slideRight: Variants = {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <AnimatePresence>
      {!isPlaying && (
        <motion.div
          variants={containerVar}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute inset-0 z-50 flex overflow-hidden select-none"
          style={{ background: 'linear-gradient(160deg, #020810 0%, #010508 50%, #020c14 100%)' }}
        >
          <Scanlines />

          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 opacity-[0.025]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V18L28 2l28 16v32L28 66zm0 34L0 84V52l28-16 28 16v32L28 100z' fill='none' stroke='%2300d2ff' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: '56px 100px',
              transform: `translate3d(${parallax.x * 0.012}px, ${parallax.y * 0.012}px, 0)`,
            }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full opacity-40"
              style={{ background: 'radial-gradient(ellipse, rgba(0,80,140,0.18) 0%, transparent 70%)' }} />
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(0,60,120,0.12) 0%, transparent 70%)', transform: `translate3d(${parallax.x * 0.02}px, ${parallax.y * 0.02}px,0)` }} />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(0,40,100,0.1) 0%, transparent 70%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.8) 100%)' }} />
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,210,255,0.15) 30%, rgba(0,210,255,0.15) 70%, transparent 100%)' }} />
            <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,210,255,0.1) 30%, rgba(0,210,255,0.1) 70%, transparent 100%)' }} />
          </div>

          <div className="relative z-10 flex w-full h-full">
            <motion.aside
              variants={slideLeft}
              className="flex flex-col justify-between py-8 px-6 xl:px-8 w-[280px] xl:w-[320px] shrink-0"
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: '0 0 8px #34d399' }} />
                  <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(52,211,153,0.7)', textTransform: 'uppercase' }}>
                    SYS_ONLINE
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(52,211,153,0.2), transparent)' }} />
                </div>

                <div className="relative p-4 rounded-xl" style={{
                  background: 'rgba(0,20,40,0.6)',
                  border: '1px solid rgba(0,180,255,0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}>
                  <Corner pos="tl" />
                  <Corner pos="br" color="rgba(0,210,255,0.1)" size={10} />

                  <div style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.35em', color: 'rgba(0,210,255,0.45)', textTransform: 'uppercase', marginBottom: 8 }}>
                    PILOT_STATUS
                  </div>
                  <div style={{ fontFamily: '"Arial Black", sans-serif', fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 10 }}>
                    {playerName || user?.username || 'GUEST_PILOT'}
                  </div>

                  <div className="flex gap-5 mb-4">
                    <StatPill label="LEVEL" value={stats.maxLevel} />
                    <div className="w-px h-8 self-center" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <StatPill label="K/D" value={kd} accent="rgba(255,200,0,0.9)" />
                    <div className="w-px h-8 self-center" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <StatPill label="KILLS" value={countKills} />
                  </div>

                  {user ? (
                    <button
                      onClick={() => BackendService.logout().then(() => setUser(null))}
                      className="flex items-center gap-2 transition-all group"
                      style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,80,80,0.5)' }}
                      onMouseEnter={e => { playHover(); e.currentTarget.style.color = 'rgba(255,80,80,0.9)'; }}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.5)')}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Disconnect Session
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => { playClick(); setShowLogin(true); }}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all group relative overflow-hidden"
                        style={{
                          background: 'rgba(0,140,200,0.12)',
                          border: '1px solid rgba(0,180,255,0.25)',
                          boxShadow: '0 0 20px rgba(0,150,220,0.1)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(0,160,220,0.2)';
                          e.currentTarget.style.boxShadow = '0 0 30px rgba(0,180,255,0.2)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(0,140,200,0.12)';
                          e.currentTarget.style.boxShadow = '0 0 20px rgba(0,150,220,0.1)';
                        }}
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#00d2ff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d2ff', fontWeight: 700 }}>
                          Commander Login
                        </span>
                      </button>
                      <p style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.1em', color: 'rgba(0,180,255,0.35)', lineHeight: 1.5 }}>
                        Save progress · sync stats · unlock cloud rewards
                      </p>
                    </div>
                  )}
                </div>

                <div className="relative p-4 rounded-xl" style={{
                  background: 'rgba(0,10,25,0.5)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.3em', color: 'rgba(255,200,0,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>
                    TOTAL_XP_EARNED
                  </div>
                  <div style={{ fontFamily: '"Arial Black", sans-serif', fontSize: 28, fontWeight: 900, color: 'rgba(255,200,0,0.9)', letterSpacing: '-0.02em', lineHeight: 1, textShadow: '0 0 20px rgba(255,200,0,0.3)' }}>
                    {countScore.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase', marginBottom: 8 }}>
                  NAV_TERMINALS
                </div>
                {[
                  { label: 'Hangar', sub: 'Equip loadout', icon: Warehouse, action: () => setShowShop(true), accent: 'rgba(0,210,255,0.8)' },
                  { label: 'Almanac', sub: 'Intel archive', icon: BookOpen, action: () => setShowAlmanac(true), accent: 'rgba(34,197,94,0.82)' },
                  { label: 'Records_DB', sub: 'Achievements', icon: Trophy, action: () => setShowAchievements(true), accent: 'rgba(255,200,0,0.8)' },
                  { label: 'Data_Logs', sub: 'Update history', icon: ScrollText, action: () => setShowUpdateHistory(true), accent: 'rgba(180,140,255,0.85)' },
                  { label: 'Support', sub: 'Command backing', icon: ChevronRight, action: () => setShowSupport(true), accent: 'rgba(244,114,182,0.9)' },
                  { label: 'Settings', sub: 'Configure env', icon: SlidersHorizontal, action: () => setShowSettings(true), accent: 'rgba(52,211,153,0.85)' },
                ].map(link => (
                  <button
                    key={link.label}
                    onClick={() => { (link.label === 'Records_DB' ? playSelect : playClick)(); link.action(); }}
                    onMouseEnter={e => {
                      showTT(link.label, link.sub);
                      e.currentTarget.style.background = 'rgba(0,180,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(0,180,255,0.1)';
                    }}
                    onMouseLeave={e => {
                      hideTT();
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all group text-left relative overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}
                    onFocus={e => {
                      e.currentTarget.style.background = 'rgba(0,180,255,0.07)';
                      e.currentTarget.style.borderColor = 'rgba(0,180,255,0.2)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <div className="absolute inset-y-0 left-0 w-0.5 opacity-0 group-hover:opacity-100 transition-all" style={{ background: `linear-gradient(180deg, ${link.accent}, transparent)` }} />
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                      style={{ color: link.accent, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <link.icon className="w-4 h-4" />
                    </span>
                    <div className="flex flex-col">
                      <span style={{ fontFamily: '"Courier New", monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,0.45)', transition: 'color 0.2s' }}
                        className="group-hover:!text-[rgba(255,255,255,0.9)]">{link.label}</span>
                      <span style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.18)' }}>{link.sub}</span>
                    </div>
                    <span className="ml-auto opacity-45 group-hover:opacity-100 transition-all" style={{ color: link.accent }}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </motion.aside>

            <motion.main
              variants={panelVar}
              className="flex-1 flex flex-col items-center justify-between py-8 relative overflow-hidden"
            >
              <div className="flex items-center gap-3 w-full max-w-lg">
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.15))' }} />
                <span style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.4em', color: 'rgba(0,210,255,0.3)', textTransform: 'uppercase' }}>
                  TACTICAL_EVOLUTION_PLATFORM
                </span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,210,255,0.15), transparent)' }} />
              </div>

              <div className="relative flex flex-col items-center">
                <div className="relative">
                  <h1
                    className="vextor-title"
                    style={{
                      fontFamily: '"Arial Black", "Arial Bold", sans-serif',
                      fontSize: 'clamp(72px, 10vw, 136px)',
                      fontWeight: 900,
                      fontStyle: 'italic',
                      letterSpacing: '-0.03em',
                      textTransform: 'uppercase',
                      lineHeight: 1,
                      color: '#fff',
                      textShadow: '0 0 80px rgba(0,180,255,0.2), 0 2px 0 rgba(0,0,0,0.5)',
                      userSelect: 'none',
                    }}
                  >
                    VEXTOR
                  </h1>
                  <h1 aria-hidden className="vextor-glitch-r" style={{
                    fontFamily: '"Arial Black", "Arial Bold", sans-serif',
                    fontSize: 'clamp(72px, 10vw, 136px)',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    letterSpacing: '-0.03em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    color: '#ff2244',
                    position: 'absolute',
                    top: 0, left: 0,
                    opacity: 0,
                    mixBlendMode: 'screen',
                    userSelect: 'none',
                  }}>VEXTOR</h1>
                  <h1 aria-hidden className="vextor-glitch-b" style={{
                    fontFamily: '"Arial Black", "Arial Bold", sans-serif',
                    fontSize: 'clamp(72px, 10vw, 136px)',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    letterSpacing: '-0.03em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    color: '#00d2ff',
                    position: 'absolute',
                    top: 0, left: 0,
                    opacity: 0,
                    mixBlendMode: 'screen',
                    userSelect: 'none',
                  }}>VEXTOR</h1>

                  <div className="absolute -top-1 -right-16 xl:-right-20 px-2 py-1 rounded"
                    style={{ background: '#00d2ff', boxShadow: '0 0 20px rgba(0,210,255,0.6)' }}>
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 8, fontWeight: 900, letterSpacing: '0.3em', color: '#000', textTransform: 'uppercase' }}>
                      ORIGIN
                    </span>
                  </div>
                </div>

                <div className="w-full h-px mt-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.4), rgba(0,210,255,0.4), transparent)' }} />
              </div>

              <InteractiveTankPreview tankColor={tankColor} isTeamsMode={isTeamsMode} parallax={parallax} />

              <form onSubmit={handleStartGame} className="flex flex-col items-center gap-5 w-full max-w-[460px]">
                <div className="w-full relative group">
                  <div className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ boxShadow: '0 0 0 1px rgba(0,200,255,0.35), 0 0 30px rgba(0,180,255,0.1)' }} />
                  <div className="relative rounded-xl overflow-hidden"
                    style={{ background: 'rgba(0,15,30,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.3), transparent)' }} />
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: user ? 'rgba(52,211,153,0.1)' : 'rgba(0,180,255,0.1)', border: `1px solid ${user ? 'rgba(52,211,153,0.2)' : 'rgba(0,180,255,0.2)'}` }}>
                        <Pencil className="w-3.5 h-3.5" style={{ color: user ? 'rgba(52,211,153,0.8)' : 'rgba(0,200,255,0.8)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.25em', textTransform: 'uppercase', color: user ? 'rgba(52,211,153,0.5)' : 'rgba(0,200,255,0.5)', marginBottom: 3 }}>
                          {user ? 'Custom_Callsign' : 'Editable_Callsign'}
                        </div>
                        <input
                          type="text"
                          placeholder="Choose your callsign"
                          value={playerName}
                          onChange={e => setPlayerName(e.target.value)}
                          maxLength={15}
                          className="w-full bg-transparent outline-none uppercase"
                          style={{
                            fontFamily: '"Arial Black", sans-serif',
                            fontSize: 15,
                            fontWeight: 900,
                            letterSpacing: '0.15em',
                            color: user ? 'rgba(52,211,153,0.8)' : '#fff',
                            cursor: 'text',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  {modeChoices.map(mode => {
                    const meta = modeMeta[mode];
                    const active = gameMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { playSelect(); setGameMode(mode); }}
                        onMouseEnter={() => { playHover(); showTT(meta.title, meta.desc); }}
                        onMouseLeave={hideTT}
                        className="flex-1 relative rounded-xl p-3 transition-all duration-200 overflow-hidden"
                        style={{
                          background: active ? 'rgba(0,15,30,0.9)' : 'rgba(0,8,18,0.6)',
                          border: `1px solid ${active ? meta.border : 'rgba(255,255,255,0.05)'}`,
                          boxShadow: active ? `0 0 20px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
                        }}
                      >
                        {active && <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />}
                        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: active ? meta.color : 'rgba(255,255,255,0.2)', marginBottom: 3, fontWeight: 900 }}>
                          {meta.code}
                        </div>
                        <div style={{ fontFamily: '"Arial Black", sans-serif', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: active ? '#fff' : 'rgba(255,255,255,0.3)', lineHeight: 1.2 }}>
                          {meta.title}
                        </div>
                        {active && (
                          <motion.div layoutId="modeActive" className="absolute inset-0 rounded-xl pointer-events-none"
                            style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.glow} 0%, transparent 70%)` }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {isTeamsMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid w-full gap-3"
                      style={{
                        gridTemplateColumns: gameMode === GameMode.DOMINION ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
                      }}
                    >
                      {teamChoices.map(team => {
                        const active = selectedTeam === team;
                        const canJoin = canJoinTeam(team);
                        const meta = TEAM_META[team];
                        return (
                          <button
                            key={team}
                            type="button"
                            disabled={!canJoin}
                            onClick={() => { playSelect(); setSelectedTeam(team); }}
                            className="relative rounded-xl py-3 px-4 transition-all flex items-center gap-3 overflow-hidden min-w-0 text-left"
                            style={{
                              background: active ? meta.bg : 'rgba(0,8,18,0.6)',
                              border: `1px solid ${active ? meta.border : 'rgba(255,255,255,0.05)'}`,
                              boxShadow: active ? `0 0 20px ${meta.border}` : 'none',
                              opacity: !canJoin ? 0.35 : 1,
                              cursor: !canJoin ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <div className="w-2.5 h-2.5 rotate-45 shrink-0" style={{
                              background: active ? meta.color : 'rgba(255,255,255,0.1)',
                              boxShadow: active ? `0 0 10px ${meta.color}` : 'none',
                            }} />
                            <div className="min-w-0 flex-1">
                              <div
                                style={{
                                  fontFamily: '"Courier New", monospace',
                                  fontSize: 8,
                                  letterSpacing: '0.18em',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                  color: active ? meta.color : 'rgba(255,255,255,0.24)',
                                  marginBottom: 2,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                Team Select
                              </div>
                              <div
                                style={{
                                  fontFamily: '"Arial Black", sans-serif',
                                  fontSize: 11,
                                  letterSpacing: '0.03em',
                                  textTransform: 'uppercase',
                                  fontWeight: 900,
                                  color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                                  lineHeight: 1.15,
                                  whiteSpace: 'normal',
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {meta.label}
                              </div>
                            </div>
                            {!canJoin && (
                              <span className="ml-auto shrink-0" style={{ fontFamily: '"Courier New", monospace', fontSize: 7, letterSpacing: '0.16em', color: 'rgba(255,80,80,0.7)', textTransform: 'uppercase' }}>
                                FULL
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="w-full flex flex-col items-center gap-3 mt-2">
                  <button
                    type="submit"
                    className="w-full max-w-sm relative overflow-hidden group"
                    style={{
                      height: 64,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(220,240,255,0.9))',
                      borderRadius: 6,
                      boxShadow: '0 0 40px rgba(200,230,255,0.12), 0 8px 32px rgba(0,0,0,0.4)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '0 0 60px rgba(0,200,255,0.3), 0 8px 40px rgba(0,0,0,0.5)';
                      e.currentTarget.style.background = 'linear-gradient(135deg, #00d2ff, #0060cc)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = '0 0 40px rgba(200,230,255,0.12), 0 8px 32px rgba(0,0,0,0.4)';
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(220,240,255,0.9))';
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[6px]">
                      <div className="engage-sweep absolute inset-y-0 w-1/3"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }} />
                    </div>
                    <span
                      className="relative z-10 transition-colors duration-200"
                      style={{
                        fontFamily: '"Arial Black", sans-serif',
                        fontSize: 22,
                        fontWeight: 900,
                        fontStyle: 'italic',
                        letterSpacing: '0.5em',
                        textTransform: 'uppercase',
                        color: '#000',
                      }}
                    >
                      {gameMode === GameMode.SANDBOX ? 'INIT' : 'ENGAGE'}
                    </span>
                  </button>

                  <motion.button
                    type="button"
                    onClick={() => { if (!spectateAvailable) return; playClick(); handleSpectate(); }}
                    disabled={!spectateAvailable}
                    whileHover={spectateAvailable ? { scale: 1.015, y: -1 } : undefined}
                    whileTap={spectateAvailable ? { scale: 0.985 } : undefined}
                    className={`group relative w-full max-w-sm overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all ${spectateAvailable ? 'cursor-none' : 'opacity-55'}`}
                    style={{
                      borderColor: spectateAvailable ? 'rgba(0,210,255,0.24)' : 'rgba(255,255,255,0.08)',
                      background: spectateAvailable
                        ? 'linear-gradient(135deg, rgba(2,18,28,0.96), rgba(6,30,44,0.92))'
                        : 'linear-gradient(135deg, rgba(10,10,10,0.88), rgba(18,18,18,0.8))',
                      boxShadow: spectateAvailable
                        ? '0 0 34px rgba(0,210,255,0.08), 0 14px 42px rgba(0,0,0,0.34)'
                        : '0 10px 26px rgba(0,0,0,0.2)',
                    }}
                    onMouseEnter={() => { if (spectateAvailable) playHover(); }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.08)_42%,transparent_84%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                          style={{
                            borderColor: spectateAvailable ? 'rgba(0,210,255,0.22)' : 'rgba(255,255,255,0.08)',
                            background: spectateAvailable ? 'rgba(0,210,255,0.08)' : 'rgba(255,255,255,0.03)',
                            boxShadow: spectateAvailable ? '0 0 18px rgba(0,210,255,0.15)' : 'none',
                          }}
                        >
                          <Radar className={`h-5 w-5 ${spectateAvailable ? 'text-cyan-300' : 'text-white/25'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-[0.28em] ${spectateAvailable ? 'text-cyan-300/80' : 'text-white/28'}`}>Spectate</span>
                            <Eye className={`h-3.5 w-3.5 ${spectateAvailable ? 'text-cyan-200/70' : 'text-white/20'}`} />
                          </div>
                          <div className={`mt-1 text-sm font-black uppercase tracking-[0.16em] ${spectateAvailable ? 'text-white' : 'text-white/35'}`}>
                            Observe Bot Combat
                          </div>
                          <div className={`mt-1 text-[10px] font-bold uppercase tracking-[0.14em] ${spectateAvailable ? 'text-white/48' : 'text-white/22'}`}>
                            {spectateAvailable ? 'Live tactical camera with cycle controls' : 'Awaiting bot targets'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 shrink-0 ${spectateAvailable ? 'text-cyan-200/80' : 'text-white/18'}`} />
                    </div>
                  </motion.button>
                </div>
              </form>

              <div style={{ fontFamily: '"Courier New", monospace', fontSize: 8, letterSpacing: '0.35em', color: 'rgba(0,210,255,0.2)', textTransform: 'uppercase' }}>
                SECURE_PROTOCOL_v4.2.8 // ENC_ACTIVE
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { playClick(); setShowPrivacy(true); }}
                  style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(147,197,253,0.85)',
                    borderBottom: '1px solid rgba(147,197,253,0.35)',
                    paddingBottom: 2,
                  }}
                >
                  Privacy
                </button>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontFamily: '"Courier New", monospace', fontSize: 9 }}>/</span>
                <button
                  type="button"
                  onClick={() => { playClick(); setShowTos(true); }}
                  style={{
                    fontFamily: '"Courier New", monospace',
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(251,113,133,0.88)',
                    borderBottom: '1px solid rgba(251,113,133,0.35)',
                    paddingBottom: 2,
                  }}
                >
                  Terms
                </button>
              </div>
            </motion.main>

            <motion.aside
              variants={slideRight}
              className="flex flex-col justify-between py-8 px-6 xl:px-8 w-[280px] xl:w-[320px] shrink-0"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,200,0,0.2))' }} />
                  <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,200,0,0.5)', textTransform: 'uppercase' }}>
                    TOP_AGENTS
                  </span>
                  <div className="w-1.5 h-1.5 rotate-45" style={{ background: 'rgba(255,200,0,0.4)' }} />
                </div>

                <div className="flex flex-col gap-2">
                  {topScores.length === 0 ? (
                    <div style={{ fontFamily: '"Courier New", monospace', fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'center', padding: '16px 0' }}>
                      NO_DATA_STREAM
                    </div>
                  ) : topScores.map((entry, i) => {
                    const rankColors = ['rgba(255,200,0,0.9)', 'rgba(200,200,210,0.9)', 'rgba(200,120,50,0.9)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.25)'];
                    const rankBg = ['rgba(255,200,0,0.08)', 'rgba(200,200,210,0.05)', 'rgba(200,120,50,0.06)', 'transparent', 'transparent'];
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg relative overflow-hidden"
                        style={{ background: rankBg[i] || 'transparent', border: i < 3 ? `1px solid ${rankColors[i].replace('0.9', '0.12')}` : '1px solid transparent' }}
                      >
                        {i < 3 && <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${rankColors[i].replace('0.9', '0.3')}, transparent)` }} />}
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 11, fontWeight: 900, color: rankColors[i], minWidth: 16, textAlign: 'center', textShadow: i === 0 ? '0 0 10px rgba(255,200,0,0.5)' : 'none' }}>
                          {i === 0 ? '★' : `0${i + 1}`}
                        </span>
                        <span className="flex-1 truncate" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: i < 2 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)' }}>
                          {entry.name}
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded" style={{
                          fontFamily: '"Courier New", monospace',
                          fontSize: 9,
                          fontWeight: 900,
                          letterSpacing: '0.1em',
                          color: rankColors[i],
                          background: `${rankColors[i].replace('0.9', '0.08')}`,
                          border: `1px solid ${rankColors[i].replace('0.9', '0.15')}`,
                        }}>
                          {entry.score.toLocaleString()}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-400/10 bg-[rgba(1,5,11,0.85)] p-4">
                <MenuMusicVisualizer snapshot={musicSnapshot} />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rotate-45" style={{ background: 'rgba(0,210,255,0.3)' }} />
                  <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(0,210,255,0.4)', textTransform: 'uppercase' }}>
                    COMBAT_KEYS
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,210,255,0.15), transparent)' }} />
                </div>

                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Movement', key: 'WASD', desc: 'Navigate grid' },
                    { label: 'Primary Fire', key: 'LMB', desc: 'Main weapon' },
                  ].map(ctrl => (
                    <div key={ctrl.label} className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>
                          {ctrl.label}
                        </span>
                        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 7, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.15)' }}>
                          {ctrl.desc}
                        </span>
                      </div>
                      <kbd style={{
                        fontFamily: '"Courier New", monospace',
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: '0.1em',
                        color: 'rgba(0,210,255,0.7)',
                        background: 'rgba(0,30,60,0.6)',
                        border: '1px solid rgba(0,180,255,0.2)',
                        borderBottom: '2px solid rgba(0,180,255,0.3)',
                        padding: '3px 8px',
                        borderRadius: 5,
                        minWidth: 44,
                        textAlign: 'center' as const,
                        display: 'inline-block',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}>
                        {ctrl.key}
                      </kbd>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 7, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.12)', textTransform: 'uppercase' }}>
                      BUILD_4.2.8-ORIGIN
                    </span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1 h-1 rounded-full" style={{ background: `rgba(0,210,255,${0.1 + i * 0.1})` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>

          <style>{`
            @keyframes glitchR {
              0%,89%,100% { opacity:0; transform:translate(0,0); clip-path:none; }
              90% { opacity:0.7; transform:translate(-3px,1px); clip-path:inset(20% 0 60% 0); }
              92% { opacity:0; }
              94% { opacity:0.5; transform:translate(2px,-1px); clip-path:inset(60% 0 10% 0); }
              96% { opacity:0; }
            }
            @keyframes glitchB {
              0%,90%,100% { opacity:0; transform:translate(0,0); clip-path:none; }
              91% { opacity:0.6; transform:translate(3px,-1px); clip-path:inset(40% 0 30% 0); }
              93% { opacity:0; }
              95% { opacity:0.5; transform:translate(-2px,2px); clip-path:inset(10% 0 70% 0); }
              97% { opacity:0; }
            }
            .vextor-glitch-r { animation: glitchR 6s infinite; }
            .vextor-glitch-b { animation: glitchB 6s infinite 0.05s; }
            @keyframes sweep {
              0% { transform: translateX(-150%); }
              100% { transform: translateX(400%); }
            }
            .engage-sweep { animation: sweep 2.8s ease-in-out infinite; }
            button:focus-visible { outline: 1px solid rgba(0,210,255,0.4); outline-offset: 2px; }
          `}</style>

          <AnimatePresence>
            {showPrivacy && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.72)' }}
                onClick={() => setShowPrivacy(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                  className="w-full max-w-2xl rounded-xl p-5 md:p-6"
                  style={{ background: 'rgba(6,12,24,0.97)', border: '1px solid rgba(0,180,255,0.26)', boxShadow: '0 22px 60px rgba(0,0,0,0.55)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 pb-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                    <h3 style={{ fontFamily: '"Arial Black", sans-serif', fontSize: 20, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#dbeafe' }}>Privacy Policy</h3>
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(147,197,253,0.75)' }}>Effective: May 29, 2026</span>
                  </div>

                  <div className="mt-4 space-y-3" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: 'rgba(219,234,254,0.88)', lineHeight: 1.65 }}>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(30,64,175,0.14)', border: '1px solid rgba(96,165,250,0.28)' }}>
                      <p style={{ fontWeight: 700, color: '#bfdbfe', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>What We Collect</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Account and profile identifiers needed for login and persistence.</li>
                        <li>Gameplay progression, match stats, and leaderboard records.</li>
                        <li>Security telemetry used to detect exploit or abuse activity.</li>
                      </ul>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(15,23,42,0.62)', border: '1px solid rgba(148,163,184,0.24)' }}>
                      <p style={{ fontWeight: 700, color: '#bfdbfe', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>How Data Is Used</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Operating matchmaking, progression, moderation, and anti-cheat systems.</li>
                        <li>Maintaining service reliability, security, and fair competitive play.</li>
                        <li>Supporting account requests such as access, correction, or deletion.</li>
                      </ul>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(15,23,42,0.62)', border: '1px solid rgba(148,163,184,0.24)' }}>
                      <p style={{ fontWeight: 700, color: '#bfdbfe', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Important Notes</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>We do not sell personal information.</li>
                        <li>Third-party auth/storage providers process some data under their own policies.</li>
                        <li>Policy updates may occur for legal, security, or feature changes.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-between items-center gap-3">
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.08em', color: 'rgba(191,219,254,0.65)' }}>
                      Questions: contact in-game support.
                    </span>
                    <button
                      onClick={() => setShowPrivacy(false)}
                      className="rounded-lg px-4 py-2"
                      style={{ background: 'rgba(0,160,255,0.16)', border: '1px solid rgba(0,160,255,0.35)', color: '#dbeafe', fontFamily: '"Courier New", monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}
                    >
                      Got It
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showTos && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.72)' }}
                onClick={() => setShowTos(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                  className="w-full max-w-2xl rounded-xl p-5 md:p-6"
                  style={{ background: 'rgba(18,8,24,0.97)', border: '1px solid rgba(236,72,153,0.26)', boxShadow: '0 22px 60px rgba(0,0,0,0.55)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 pb-3" style={{ borderBottom: '1px solid rgba(251,113,133,0.24)' }}>
                    <h3 style={{ fontFamily: '"Arial Black", sans-serif', fontSize: 20, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fce7f3' }}>Terms Of Service</h3>
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(251,113,133,0.78)' }}>Fair Play Required</span>
                  </div>

                  <div className="mt-4 space-y-3" style={{ fontFamily: '"Courier New", monospace', fontSize: 11, color: 'rgba(252,231,243,0.88)', lineHeight: 1.65 }}>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(131,24,67,0.18)', border: '1px solid rgba(244,114,182,0.3)' }}>
                      <p style={{ fontWeight: 700, color: '#fbcfe8', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Prohibited Behavior</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Cheats, bots, macros, packet manipulation, exploit chaining, or service disruption.</li>
                        <li>Harassment, impersonation, hate content, or abusive profile/chat behavior.</li>
                        <li>Unauthorized reverse-engineering or bypass attempts against live systems.</li>
                      </ul>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(30,41,59,0.62)', border: '1px solid rgba(251,113,133,0.24)' }}>
                      <p style={{ fontWeight: 700, color: '#fbcfe8', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Enforcement</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Violations may result in warnings, suspensions, stat resets, or permanent bans.</li>
                        <li>Leaderboard or progression actions may be rolled back to preserve integrity.</li>
                        <li>Accounts are responsible for all activity performed under their credentials.</li>
                      </ul>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(30,41,59,0.62)', border: '1px solid rgba(251,113,133,0.24)' }}>
                      <p style={{ fontWeight: 700, color: '#fbcfe8', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Service Changes</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Balance, progression, and online services may change for operational needs.</li>
                        <li>By continuing to play, you accept these rules and enforcement decisions.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-between items-center gap-3">
                    <span style={{ fontFamily: '"Courier New", monospace', fontSize: 9, letterSpacing: '0.08em', color: 'rgba(251,207,232,0.66)' }}>
                      Keep matches fair and respectful.
                    </span>
                    <button
                      onClick={() => setShowTos(false)}
                      className="rounded-lg px-4 py-2"
                      style={{ background: 'rgba(236,72,153,0.16)', border: '1px solid rgba(236,72,153,0.35)', color: '#fce7f3', fontFamily: '"Courier New", monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}
                    >
                      Understood
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface InteractiveTankPreviewProps {
  tankColor: string;
  isTeamsMode: boolean;
  parallax: { x: number; y: number };
}

const InteractiveTankPreview: React.FC<InteractiveTankPreviewProps> = ({ tankColor, isTeamsMode, parallax }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const targetAngle = useRef(0);
  const [turretRotation, setTurretRotation] = useState(0);
  const [chassisRotation, setChassisRotation] = useState(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const tick = (t: number) => {
      setTurretRotation(prev => {
        let d = targetAngle.current - prev;
        while (d < -180) d += 360;
        while (d > 180) d -= 360;
        return prev + d * 0.12;
      });
      setChassisRotation(Math.sin(t / 1800) * 6);
      setPulse(Math.sin(t / 800) * 0.5 + 0.5);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onMove = (e: MouseEvent) => {
      if (!frameRef.current) return;
      const r = frameRef.current.getBoundingClientRect();
      targetAngle.current = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * (180 / Math.PI);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  const size = isTeamsMode ? 130 : 160;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: 220,
        height: 220,
        transform: `translate3d(${parallax.x * 0.008}px, ${parallax.y * 0.008}px, 0)`,
      }}
    >
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 160 + i * 40,
            height: 160 + i * 40,
            border: `1px solid rgba(0,210,255,${0.06 - i * 0.015})`,
            animation: `spin${i % 2 === 0 ? 'CW' : 'CCW'} ${18 + i * 8}s linear infinite`,
            borderStyle: i === 1 ? 'dashed' : 'solid',
          }}
        />
      ))}

      <div className="absolute rounded-full" style={{
        width: 100 + pulse * 40,
        height: 100 + pulse * 40,
        border: `1px solid rgba(0,210,255,${0.15 * (1 - pulse)})`,
        transition: 'none',
      }} />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
        style={{ width: 100, height: 10, background: 'radial-gradient(ellipse, rgba(0,0,0,0.6), transparent)', filter: 'blur(6px)' }} />

      <div ref={frameRef} className="relative z-10" style={{ transition: 'filter 0.3s', filter: 'drop-shadow(0 0 20px rgba(0,180,255,0.15))' }}>
        <TankPreview
          tankClass={TankClass.BASIC}
          color={tankColor}
          size={size}
          turretRotation={turretRotation}
          chassisRotation={chassisRotation}
        />
      </div>

      {[0, 90, 180, 270].map(deg => (
        <div key={deg} className="absolute w-px h-2.5 origin-bottom"
          style={{
            background: 'rgba(0,210,255,0.25)',
            left: '50%',
            bottom: '50%',
            transform: `rotate(${deg}deg) translateX(-50%)`,
            transformOrigin: '50% 110px',
          }} />
      ))}

      <style>{`
        @keyframes spinCW  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      `}</style>
    </div>
  );
};
