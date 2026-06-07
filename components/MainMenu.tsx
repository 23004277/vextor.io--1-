import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, Variants } from 'motion/react';
import { BookOpen, ChevronRight, Eye, HeartHandshake, Pencil, Radar, ScrollText, SlidersHorizontal, Trophy, Warehouse } from 'lucide-react';

import { BackgroundMusicVisualizerFrame } from '../Background Music';
import { COLORS } from '../constants';
import { BackendService } from '../services/BackendService';
import { GameMode, HighScoreEntry, TankClass, Team, User } from '../types';
import { MenuMusicVisualizer } from './MenuMusicVisualizer';
import { TankPreview } from './TankPreview';

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
  updateLog: { id: string; title: string; date: string; content: string }[];
  parallax: { x: number; y: number };
  activeColor: string;
  teamCounts: Record<Team, number>;
  canJoinTeam: (team: Team) => boolean;
}

type ModeMeta = {
  title: string;
  code: string;
  desc: string;
  color: string;
  border: string;
  glow: string;
  fill: string;
};

type TeamMeta = {
  label: string;
  short: string;
  color: string;
  bg: string;
  border: string;
};

const UI = {
  ink: '#ecfeff',
  soft: '#a7e8f2',
  dim: 'rgba(167, 232, 242, 0.48)',
  faint: 'rgba(167, 232, 242, 0.26)',
  cyan: '#20e6ff',
  teal: '#2cffc7',
  violet: '#9f7cff',
  amber: '#ffd15c',
  rose: '#ff5f86',
  panel: 'linear-gradient(180deg, rgba(5, 25, 44, 0.92), rgba(2, 8, 22, 0.97))',
  panelDeep: 'linear-gradient(180deg, rgba(7, 35, 58, 0.76), rgba(2, 7, 20, 0.98))',
  panelTint: 'linear-gradient(135deg, rgba(8, 145, 178, 0.18), rgba(15, 23, 42, 0.84))',
  border: 'rgba(56, 189, 248, 0.18)',
  borderStrong: 'rgba(45, 255, 199, 0.38)',
};

const MODE_META: Record<GameMode, ModeMeta> = {
  [GameMode.FFA]: {
    title: 'Free For All',
    code: 'FFA',
    desc: 'Solo survival. No teammates. No excuses.',
    color: UI.cyan,
    border: 'rgba(32, 230, 255, 0.44)',
    glow: 'rgba(32, 230, 255, 0.22)',
    fill: 'rgba(8, 145, 178, 0.15)',
  },
  [GameMode.TEAMS]: {
    title: 'Team Warfare',
    code: 'TWF',
    desc: 'Pick a side and push the arena with your squad.',
    color: '#6aa9ff',
    border: 'rgba(96, 165, 250, 0.44)',
    glow: 'rgba(96, 165, 250, 0.22)',
    fill: 'rgba(37, 99, 235, 0.15)',
  },
  [GameMode.DOMINION]: {
    title: 'Dominion',
    code: 'DOM',
    desc: 'Capture dominion tanks, hold zones, and drain enemy control.',
    color: UI.amber,
    border: 'rgba(255, 209, 92, 0.44)',
    glow: 'rgba(255, 209, 92, 0.22)',
    fill: 'rgba(180, 83, 9, 0.16)',
  },
  [GameMode.SANDBOX]: {
    title: 'Sandbox',
    code: 'SBX',
    desc: 'Test builds freely with no pressure and no clean-up crew.',
    color: UI.violet,
    border: 'rgba(169, 140, 255, 0.46)',
    glow: 'rgba(169, 140, 255, 0.23)',
    fill: 'rgba(126, 34, 206, 0.16)',
  },
};

const TEAM_META: Record<Team, TeamMeta> = {
  [Team.NONE]: {
    label: 'Neutral',
    short: 'NTR',
    color: UI.cyan,
    bg: 'rgba(8, 145, 178, 0.12)',
    border: 'rgba(103, 232, 249, 0.20)',
  },
  [Team.BLUE]: {
    label: 'Blue Squad',
    short: 'BLU',
    color: COLORS.player,
    bg: 'rgba(37, 99, 235, 0.20)',
    border: 'rgba(96, 165, 250, 0.42)',
  },
  [Team.RED]: {
    label: 'Red Squad',
    short: 'RED',
    color: COLORS.enemy,
    bg: 'rgba(190, 18, 60, 0.20)',
    border: 'rgba(251, 113, 133, 0.44)',
  },
  [Team.GREEN]: {
    label: 'Green Wing',
    short: 'GRN',
    color: COLORS.allyGreen,
    bg: 'rgba(5, 150, 105, 0.18)',
    border: 'rgba(52, 211, 153, 0.42)',
  },
  [Team.PURPLE]: {
    label: 'Purple Wing',
    short: 'PUR',
    color: COLORS.allyPurple,
    bg: 'rgba(109, 40, 217, 0.20)',
    border: 'rgba(167, 139, 250, 0.42)',
  },
};

const MODE_CHOICES = [GameMode.FFA, GameMode.TEAMS, GameMode.DOMINION, GameMode.SANDBOX] as const;
const SPRING_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const safeNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const useCountUp = (target: number, duration = 850) => {
  const cleanTarget = Math.max(0, safeNumber(target));
  const [value, setValue] = useState(cleanTarget);

  useEffect(() => {
    if (cleanTarget <= 0) {
      setValue(0);
      return;
    }

    let raf = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(cleanTarget * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cleanTarget, duration]);

  return value;
};

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);

  return matches;
};

const Scanlines: React.FC = () => (
  <div
    className="pointer-events-none absolute inset-0 z-[1]"
    style={{
      backgroundImage:
        'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)',
      backgroundSize: '100% 4px',
    }}
  />
);

const Panel: React.FC<{
  title?: string;
  subtitle?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, className = '', bodyClassName = '', children }) => (
  <section
    className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.15rem] border shadow-[0_18px_54px_rgba(0,0,0,0.34)] backdrop-blur-xl ${className}`}
    style={{ background: UI.panel, borderColor: UI.border }}
  >
    {(title || subtitle) && (
      <header className="flex shrink-0 min-w-0 items-start justify-between gap-3 border-b border-cyan-300/10 px-4 py-3">
        <div className="min-w-0">
          {title && <div className="menu-copy text-[9px] font-black uppercase leading-[1.35] tracking-[0.20em] text-cyan-100/86">{title}</div>}
          {subtitle && <div className="menu-copy mt-0.5 text-[8px] font-bold uppercase leading-[1.45] tracking-[0.10em] text-sky-100/38">{subtitle}</div>}
        </div>
        <div className="mt-1 h-1.5 w-1.5 shrink-0 rotate-45 bg-cyan-300/75 shadow-[0_0_14px_rgba(32,230,255,0.75)]" />
      </header>
    )}
    <div className={`min-h-0 min-w-0 flex-1 ${title || subtitle ? 'p-3.5' : ''} ${bodyClassName}`}>{children}</div>
  </section>
);

const MiniStat: React.FC<{ label: string; value: number | string; accent?: string }> = ({ label, value, accent = UI.cyan }) => (
  <div className="min-w-0 rounded-xl border border-cyan-300/10 bg-cyan-950/20 px-3 py-2.5 text-center">
    <div
      className="break-words font-black leading-none"
      style={{
        fontFamily: '"Courier New", monospace',
        fontSize: 15,
        color: accent,
        textShadow: `0 0 12px ${accent}`,
      }}
    >
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
    <div className="menu-copy mt-1.5 text-[7px] font-black uppercase leading-[1.35] tracking-[0.12em] text-sky-100/40">{label}</div>
  </div>
);

const NavButton: React.FC<{
  label: string;
  sub: string;
  accent: string;
  icon: React.ElementType;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}> = ({ label, sub, accent, icon: Icon, onClick, onHover, onLeave }) => (
  <button
    type="button"
    onClick={onClick}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    className="group relative flex min-h-[54px] min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-cyan-300/10 bg-slate-950/35 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/32 hover:bg-cyan-400/[0.075]"
  >
    <div className="pointer-events-none absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: accent }} />
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/10 bg-slate-950/60" style={{ color: accent }}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="menu-copy text-[9px] font-black uppercase leading-[1.35] tracking-[0.13em] text-cyan-50/90">{label}</div>
      <div className="menu-copy mt-0.5 text-[7.5px] font-bold uppercase leading-[1.4] tracking-[0.065em] text-sky-100/38">{sub}</div>
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-cyan-200/28 transition group-hover:translate-x-0.5 group-hover:text-cyan-200/76" />
  </button>
);

const ModeButton: React.FC<{
  mode: GameMode;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}> = ({ mode, active, onSelect, onHover, onLeave }) => {
  const meta = MODE_META[mode];

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="relative flex min-h-[98px] min-w-0 flex-col overflow-hidden rounded-xl p-3 text-left transition hover:-translate-y-0.5"
      style={{
        background: active ? meta.fill : 'rgba(2, 10, 25, 0.72)',
        border: `1px solid ${active ? meta.border : 'rgba(32, 230, 255, 0.11)'}`,
        boxShadow: active ? `0 0 24px ${meta.glow}, inset 0 0 26px rgba(255,255,255,0.025)` : 'none',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-80"
        style={{ background: active ? `radial-gradient(circle at 18% 0%, ${meta.glow}, transparent 60%)` : 'transparent' }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <span className="menu-copy text-[8px] font-black uppercase leading-[1.2] tracking-[0.15em]" style={{ color: active ? meta.color : UI.dim }}>
          {meta.code}
        </span>
        <span className="h-2 w-2 shrink-0 rotate-45" style={{ background: active ? meta.color : 'rgba(155,214,226,0.22)' }} />
      </div>
      <div className="menu-copy relative mt-2 text-[11px] font-black uppercase leading-[1.25] tracking-[0.045em] text-cyan-50/92">{meta.title}</div>
      <div className="menu-copy relative mt-1 text-[8px] font-bold uppercase leading-[1.45] tracking-[0.035em] text-sky-100/42">{meta.desc}</div>
    </button>
  );
};

const TeamButton: React.FC<{
  team: Team;
  active: boolean;
  count: number;
  canJoin: boolean;
  onSelect: () => void;
}> = ({ team, active, count, canJoin, onSelect }) => {
  const meta = TEAM_META[team];

  return (
    <button
      type="button"
      disabled={!canJoin}
      onClick={onSelect}
      className="rounded-xl px-3 py-2.5 text-left transition hover:-translate-y-0.5 disabled:hover:translate-y-0"
      style={{
        background: active ? meta.bg : 'rgba(2, 10, 25, 0.72)',
        border: `1px solid ${active ? meta.border : 'rgba(32, 230, 255, 0.11)'}`,
        boxShadow: active ? `0 0 18px ${meta.border}` : 'none',
        opacity: !canJoin ? 0.45 : 1,
        cursor: !canJoin ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rotate-45" style={{ background: active ? meta.color : 'rgba(155,214,226,0.22)' }} />
            <span className="menu-copy text-[8px] font-black uppercase leading-[1.2] tracking-[0.13em]" style={{ color: active ? meta.color : UI.dim }}>
              {meta.short}
            </span>
          </div>
          <div className="menu-copy mt-1.5 text-[9.5px] font-black uppercase leading-[1.28] tracking-[0.045em] text-cyan-50/88">{meta.label}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[7px] font-black uppercase tracking-[0.10em] text-sky-100/32">Units</div>
          <div className="mt-0.5 text-xs font-black text-cyan-50/84">{Math.max(0, count)}</div>
        </div>
      </div>
      {!canJoin && <div className="menu-copy mt-2 rounded-md border border-rose-300/16 bg-rose-400/8 px-2 py-1 text-center text-[7px] font-black uppercase leading-[1.2] tracking-[0.12em] text-rose-300/82">Full</div>}
    </button>
  );
};

const LeaderboardRow: React.FC<{ entry: HighScoreEntry; index: number }> = ({ entry, index }) => {
  const colors = [UI.amber, UI.cyan, '#fb923c', '#94a3b8', '#64748b'];
  const color = colors[index] ?? '#64748b';
  const rankLabel = index === 0 ? 'ACE' : `0${index + 1}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 + index * 0.04, duration: 0.32, ease: SPRING_EASE }}
      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-cyan-300/10 bg-[linear-gradient(135deg,rgba(8,23,43,0.92),rgba(5,18,33,0.78))] px-3 py-2.5"
    >
      <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-cyan-300/10 bg-slate-950/58 px-2 py-2 text-center">
        <div className="text-[6.5px] font-black uppercase tracking-[0.10em] text-sky-100/32">Rank</div>
        <div className="mt-1 text-[8.5px] font-black uppercase tracking-[0.10em]" style={{ color }}>{rankLabel}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="menu-copy text-[9.5px] font-black uppercase leading-[1.3] tracking-[0.045em] text-cyan-50/90">{entry.name || 'Unknown'}</div>
        <div className="menu-copy mt-0.5 text-[6.8px] font-bold uppercase leading-[1.35] tracking-[0.07em] text-sky-100/35">Arena score uplink</div>
      </div>
      <div className="shrink-0 rounded-full border border-cyan-300/10 bg-cyan-950/30 px-2.5 py-1.5 text-[8.5px] font-black uppercase tracking-[0.055em]" style={{ color }}>
        {safeNumber(entry.score).toLocaleString()}
      </div>
    </motion.div>
  );
};

const ControlRow: React.FC<{ label: string; keyLabel: string; desc: string }> = ({ label, keyLabel, desc }) => (
  <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-cyan-300/10 bg-sky-950/20 px-3 py-2.5">
    <div className="min-w-0">
      <div className="menu-copy text-[8.5px] font-black uppercase leading-[1.3] tracking-[0.10em] text-cyan-50/78">{label}</div>
      <div className="menu-copy mt-0.5 text-[7.5px] font-bold uppercase leading-[1.35] tracking-[0.055em] text-sky-100/34">{desc}</div>
    </div>
    <kbd className="min-w-[46px] shrink-0 rounded-md border border-teal-300/20 bg-teal-400/10 px-2 py-1.5 text-center text-[8px] font-black uppercase tracking-[0.065em] text-teal-200">
      {keyLabel}
    </kbd>
  </div>
);

const PolicyModal: React.FC<{ open: boolean; type: 'privacy' | 'terms'; onClose: () => void }> = ({ open, type, onClose }) => {
  const privacy = type === 'privacy';
  const accent = privacy ? UI.cyan : UI.rose;
  const title = privacy ? 'Privacy Policy' : 'Terms Of Service';
  const tag = privacy ? 'Effective: May 29, 2026' : 'Fair Play Required';

  const sections = privacy
    ? [
        {
          title: 'What We Collect',
          items: ['Account/profile identifiers for login.', 'Gameplay progress, match stats, and leaderboard records.', 'Security telemetry for exploit and abuse detection.'],
        },
        {
          title: 'How Data Is Used',
          items: ['Operating progression and matchmaking.', 'Keeping systems secure and fair.', 'Supporting account requests and moderation.'],
        },
        {
          title: 'Important Notes',
          items: ['We do not sell personal information.', 'Third-party auth/storage providers may process data.', 'Policy updates may happen for security or feature changes.'],
        },
      ]
    : [
        {
          title: 'Prohibited Behavior',
          items: ['Cheats, bots, macros, packet manipulation, or service disruption.', 'Harassment, impersonation, hate content, or abusive names.', 'Bypassing or reverse-engineering live systems.'],
        },
        {
          title: 'Enforcement',
          items: ['Violations can cause warnings, suspensions, resets, or bans.', 'Leaderboard actions may be rolled back.', 'Accounts are responsible for their own activity.'],
        },
        {
          title: 'Service Changes',
          items: ['Balance and progression may change.', 'Continuing to play means accepting these rules.'],
        },
      ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
          style={{ background: 'rgba(2, 6, 23, 0.78)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="menu-scrollbar w-full max-w-2xl overflow-y-auto rounded-2xl border p-5 shadow-[0_28px_80px_rgba(0,0,0,0.62)]"
            style={{ maxHeight: 'min(86vh, 720px)', background: UI.panel, borderColor: privacy ? 'rgba(32,230,255,0.28)' : 'rgba(255,107,138,0.28)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-2 border-b border-cyan-300/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="menu-copy text-xl font-black uppercase leading-tight tracking-[0.06em]" style={{ color: accent }}>{title}</h3>
              <span className="menu-copy text-[9px] font-black uppercase leading-[1.35] tracking-[0.10em]" style={{ color: UI.dim }}>{tag}</span>
            </div>

            <div className="mt-4 grid gap-3">
              {sections.map((section, index) => (
                <div key={section.title} className="rounded-xl border p-3" style={{ borderColor: index === 0 ? `${accent}55` : UI.border, background: index === 0 ? `${accent}14` : 'rgba(15, 23, 42, 0.62)' }}>
                  <p className="mb-2 break-words text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: accent }}>{section.title}</p>
                  <ul className="list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-cyan-50/76">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-words text-[9px] font-bold uppercase tracking-[0.09em] text-sky-100/42">{privacy ? 'Questions: contact in-game support.' : 'Keep matches fair and clean.'}</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition hover:-translate-y-0.5"
                style={{ color: accent, borderColor: `${accent}55`, background: `${accent}14` }}
              >
                {privacy ? 'Got It' : 'Understood'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MainMenu: React.FC<MainMenuProps> = ({
  isPlaying,
  playerName,
  setPlayerName,
  user,
  setUser,
  highScores,
  gameMode,
  setGameMode,
  selectedTeam,
  setSelectedTeam,
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
  updateLog,
  parallax,
  activeColor,
  teamCounts,
  canJoinTeam,
}) => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const compactHeight = useMediaQuery('(max-height: 820px)');

  const stats = user?.stats ?? { maxLevel: 1, totalKills: 0, totalDeaths: 0, totalScore: 0 };
  const totalKills = safeNumber(stats.totalKills);
  const totalDeaths = safeNumber(stats.totalDeaths);
  const totalScore = safeNumber(stats.totalScore);
  const maxLevel = Math.max(1, safeNumber(stats.maxLevel, 1));
  const kd = (totalKills / Math.max(1, totalDeaths)).toFixed(2);

  const isTeamsMode = gameMode === GameMode.TEAMS || gameMode === GameMode.DOMINION;
  const allowedTeams = useMemo<Team[]>(
    () => (gameMode === GameMode.DOMINION ? [Team.BLUE, Team.RED, Team.GREEN, Team.PURPLE] : [Team.BLUE, Team.RED]),
    [gameMode],
  );

  useEffect(() => {
    if (!isTeamsMode) {
      if (selectedTeam !== Team.NONE) setSelectedTeam(Team.NONE);
      return;
    }

    if (!allowedTeams.includes(selectedTeam)) {
      const firstJoinable = allowedTeams.find((team) => canJoinTeam(team)) ?? allowedTeams[0];
      setSelectedTeam(firstJoinable);
    }
  }, [allowedTeams, canJoinTeam, isTeamsMode, selectedTeam, setSelectedTeam]);

  const safeTeam = isTeamsMode && TEAM_META[selectedTeam] ? selectedTeam : Team.NONE;
  const teamMeta = TEAM_META[safeTeam];
  const modeMeta = MODE_META[gameMode];
  const tankColor = isTeamsMode ? teamMeta.color : activeColor || UI.cyan;
  const latestUpdate = useMemo(() => updateLog?.[0], [updateLog]);
  const topScores = useMemo(() => [...(highScores ?? [])].sort((a, b) => safeNumber(b.score) - safeNumber(a.score)).slice(0, 5), [highScores]);
  const countKills = useCountUp(totalKills, 850);
  const countScore = useCountUp(totalScore, 1000);
  const deploymentReady = !isTeamsMode || (safeTeam !== Team.NONE && (allowedTeams.includes(safeTeam) || canJoinTeam(safeTeam)));

  const navItems = useMemo(
    () => [
      { label: 'Hangar', sub: 'Loadout and cosmetics', icon: Warehouse, action: () => setShowShop(true), accent: UI.cyan },
      { label: 'Almanac', sub: 'Tank intel and archive', icon: BookOpen, action: () => setShowAlmanac(true), accent: '#34d399' },
      { label: 'Records', sub: 'Achievements and medals', icon: Trophy, action: () => setShowAchievements(true), accent: UI.amber },
      { label: 'Updates', sub: 'Patch notes and changelog', icon: ScrollText, action: () => setShowUpdateHistory(true), accent: UI.violet },
      { label: 'Support', sub: 'Back the command grid', icon: HeartHandshake, action: () => setShowSupport(true), accent: UI.rose },
      { label: 'Settings', sub: 'Controls and display', icon: SlidersHorizontal, action: () => setShowSettings(true), accent: UI.teal },
    ],
    [setShowAchievements, setShowAlmanac, setShowShop, setShowSupport, setShowSettings, setShowUpdateHistory],
  );

  const containerVar: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };

  const panelVar: Variants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: SPRING_EASE } },
  };

  const slideLeft: Variants = {
    hidden: { opacity: 0, x: -18 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: SPRING_EASE } },
  };

  const slideRight: Variants = {
    hidden: { opacity: 0, x: 18 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: SPRING_EASE } },
  };

  const submitHandler = (event: React.FormEvent) => {
    if (!deploymentReady) {
      event.preventDefault();
      playHover();
      return;
    }

    handleStartGame(event);
  };

  const handleLogout = async () => {
    playClick();
    try {
      await BackendService.logout();
      setUser(null);
    } catch (error) {
      console.error('[MainMenu] Logout failed:', error);
    }
  };

  return (
    <AnimatePresence>
      {!isPlaying && (
        <motion.div
          variants={containerVar}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="vextor-menu absolute inset-0 z-50 h-[100dvh] max-h-[100dvh] overflow-hidden select-none"
          style={{
            color: UI.ink,
            background:
              'radial-gradient(circle at 50% 0%, rgba(14, 116, 144, 0.22), transparent 38%), radial-gradient(circle at 100% 10%, rgba(124, 58, 237, 0.14), transparent 34%), linear-gradient(160deg, #020617 0%, #03111f 48%, #020617 100%)',
          }}
        >
          <Scanlines />

          <div className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V18L28 2l28 16v32L28 66zm0 34L0 84V52l28-16 28 16v32L28 100z' fill='none' stroke='%2320e6ff' stroke-width='0.5'/%3E%3C/svg%3E\")",
                backgroundSize: '56px 100px',
                transform: `translate3d(${parallax.x * 0.01}px, ${parallax.y * 0.01}px, 0)`,
              }}
            />
            <div className="absolute left-1/2 top-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-55" style={{ background: 'radial-gradient(ellipse, rgba(8, 145, 178, 0.18), transparent 68%)' }} />
            <div className="absolute -bottom-24 -left-24 h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(20, 184, 166, 0.12), transparent 70%)' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 34%, rgba(2,6,23,0.88) 100%)' }} />
          </div>

          <div className="vextor-menu relative z-10 mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-[1800px] flex-col gap-2.5 overflow-hidden px-3 py-3 lg:px-4">
            <header className="grid shrink-0 grid-cols-1 gap-2 rounded-2xl border border-cyan-300/12 bg-slate-950/58 px-4 py-2.5 shadow-[0_12px_42px_rgba(0,0,0,0.24)] backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-teal-300 shadow-[0_0_14px_rgba(44,255,199,0.9)]" />
                <div className="min-w-0">
                  <div className="menu-copy text-[9px] font-black uppercase leading-[1.35] tracking-[0.22em] text-teal-100/86">VEXTOR Command Interface</div>
                  <div className="menu-copy mt-0.5 text-[8px] font-bold uppercase leading-[1.4] tracking-[0.10em] text-sky-100/38">Clean cockpit layout / no clipped labels / no dead space</div>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                <span className="rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: modeMeta.color, borderColor: modeMeta.border, background: modeMeta.fill }}>
                  {modeMeta.title}
                </span>
                {isTeamsMode && (
                  <span className="rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: teamMeta.color, borderColor: teamMeta.border, background: teamMeta.bg }}>
                    {teamMeta.label}
                  </span>
                )}
              </div>
            </header>

            <div className="grid min-h-0 flex-1 gap-2.5 overflow-hidden lg:grid-cols-[245px_minmax(0,1fr)_315px] xl:grid-cols-[265px_minmax(0,1fr)_345px] 2xl:grid-cols-[285px_minmax(0,1fr)_365px]">
              <motion.aside variants={slideLeft} className="menu-scrollbar grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5 overflow-y-auto pr-1">
                <Panel title="Pilot" subtitle={user ? 'Cloud profile' : 'Guest profile'}>
                  <div className="relative rounded-xl border border-cyan-300/12 p-3" style={{ background: UI.panelDeep }}>
                    <div className="absolute right-[-24px] top-[-24px] h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
                    <div className="menu-copy relative text-lg font-black uppercase leading-tight tracking-[0.04em] text-cyan-50/94">{playerName || user?.username || 'Guest Pilot'}</div>
                    <div className="relative mt-3 grid grid-cols-3 gap-2">
                      <MiniStat label="Level" value={maxLevel} accent={UI.cyan} />
                      <MiniStat label="K/D" value={kd} accent={UI.amber} />
                      <MiniStat label="Kills" value={countKills} accent={UI.teal} />
                    </div>
                    <div className="relative mt-3 rounded-xl border border-amber-300/12 bg-amber-400/[0.07] px-3 py-2.5">
                      <div className="menu-copy text-[8px] font-black uppercase leading-[1.3] tracking-[0.12em] text-amber-200/60">Lifetime Score</div>
                      <div className="menu-copy mt-1 text-xl font-black tracking-tight text-amber-300">{countScore.toLocaleString()}</div>
                    </div>

                    {user ? (
                      <button type="button" onClick={handleLogout} onMouseEnter={playHover} className="relative mt-3 text-left text-[9px] font-black uppercase leading-relaxed tracking-[0.14em] text-rose-300/78 transition hover:text-rose-200">
                        Disconnect Session
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setShowLogin(true);
                        }}
                        onMouseEnter={playHover}
                        className="relative mt-3 flex w-full min-w-0 items-center gap-2 rounded-xl border border-cyan-300/22 bg-cyan-400/[0.09] px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:bg-cyan-400/[0.13]"
                      >
                        <Radar className="h-4 w-4 shrink-0 text-cyan-300" />
                        <div className="min-w-0">
                          <div className="break-words text-[9px] font-black uppercase tracking-[0.15em] text-cyan-100">Commander Login</div>
                          <div className="break-words text-[8px] font-bold uppercase leading-relaxed tracking-[0.08em] text-sky-100/35">Save progress and sync stats</div>
                        </div>
                      </button>
                    )}
                  </div>
                </Panel>

                <Panel title="Navigation" subtitle="Primary terminals only" bodyClassName="h-full p-2.5">
                  <div className="grid h-full content-start gap-1.5">
                    {navItems.map((link) => (
                      <NavButton
                        key={link.label}
                        label={link.label}
                        sub={link.sub}
                        icon={link.icon}
                        accent={link.accent}
                        onClick={() => {
                          (link.label === 'Records' ? playSelect : playClick)();
                          link.action();
                        }}
                        onHover={() => {
                          showTT(link.label, link.sub);
                          playHover();
                        }}
                        onLeave={hideTT}
                      />
                    ))}
                  </div>
                </Panel>
              </motion.aside>

              <motion.main variants={panelVar} className="min-h-0 min-w-0">
                <form onSubmit={submitHandler} className="grid h-full min-h-0 min-w-0 gap-2.5 overflow-hidden lg:grid-rows-[auto_minmax(210px,1fr)_auto]">
                  <Panel bodyClassName="p-0" className="shrink-0">
                    <div className="grid min-w-0 gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-cyan-300/16 bg-cyan-400/[0.08] px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-cyan-200/82">{modeMeta.code}</span>
                          <span className="rounded-full border border-violet-300/16 bg-violet-400/[0.08] px-3 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-violet-200/72">{latestUpdate?.id ?? 'Live Build'}</span>
                        </div>
                        <div className="relative mt-2 inline-block max-w-full overflow-visible pr-5 md:pr-7">
                          <h1
                            className="vextor-title"
                            style={{
                              fontFamily: '"Arial Black", "Arial Bold", sans-serif',
                              fontSize: compactHeight ? 'clamp(38px, 5.2vw, 70px)' : 'clamp(46px, 6vw, 92px)',
                              fontWeight: 900,
                              fontStyle: 'italic',
                              letterSpacing: '-0.04em',
                              lineHeight: 0.9,
                              textTransform: 'uppercase',
                              background: 'linear-gradient(90deg, #20e6ff 0%, #2cffc7 42%, #a98cff 100%)',
                              WebkitBackgroundClip: 'text',
                              backgroundClip: 'text',
                              color: 'transparent',
                              filter: 'drop-shadow(0 0 34px rgba(32,230,255,0.2))',
                            }}
                          >
                            VEXTOR
                          </h1>
                          {['vextor-glitch-r', 'vextor-glitch-b'].map((klass) => (
                            <h1
                              key={klass}
                              aria-hidden
                              className={klass}
                              style={{
                                fontFamily: '"Arial Black", "Arial Bold", sans-serif',
                                fontSize: compactHeight ? 'clamp(38px, 5.2vw, 70px)' : 'clamp(46px, 6vw, 92px)',
                                fontWeight: 900,
                                fontStyle: 'italic',
                                letterSpacing: '-0.04em',
                                lineHeight: 0.9,
                                textTransform: 'uppercase',
                                color: klass.endsWith('r') ? UI.rose : UI.cyan,
                                position: 'absolute',
                                inset: 0,
                                opacity: 0,
                                mixBlendMode: 'screen',
                                pointerEvents: 'none',
                              }}
                            >
                              VEXTOR
                            </h1>
                          ))}
                        </div>
                        <p className="menu-copy mt-3 max-w-[820px] text-[10px] font-black uppercase leading-[1.6] tracking-[0.09em] text-sky-100/48 md:text-[11px] xl:text-[12px]">
                          Evolve fast. Control the grid. Leave the arena looking traumatised.
                        </p>
                      </div>

                      {latestUpdate && (
                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setShowUpdateHistory(true);
                          }}
                          onMouseEnter={playHover}
                          className="min-w-0 rounded-2xl border border-violet-300/18 bg-[linear-gradient(135deg,rgba(36,24,66,0.62),rgba(18,22,42,0.92))] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-violet-300/32"
                        >
                          <div className="menu-copy text-[8px] font-black uppercase leading-[1.3] tracking-[0.12em] text-violet-200/64">Latest Update</div>
                          <div className="menu-copy mt-1 text-[11px] font-black uppercase leading-[1.35] tracking-[0.045em] text-cyan-50/90">{latestUpdate.title}</div>
                          <div className="menu-copy mt-2 text-[8px] font-bold uppercase leading-[1.3] tracking-[0.08em] text-sky-100/40">{latestUpdate.date}</div>
                        </button>
                      )}
                    </div>
                  </Panel>

                  <Panel bodyClassName="p-0" className="min-h-0 overflow-hidden">
                    <div className="relative flex h-full min-h-[220px] items-center justify-center overflow-hidden p-3" style={{ background: 'radial-gradient(circle at center, rgba(32,230,255,0.1), transparent 58%)' }}>
                      <MenuMusicVisualizer snapshot={musicSnapshot} variant="hero" />
                      <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
                      <div className="absolute inset-y-8 left-1/2 w-px bg-gradient-to-b from-transparent via-teal-300/14 to-transparent" />
                      <div className="relative z-10">
                        <InteractiveTankPreview tankColor={tankColor} isTeamsMode={isTeamsMode} parallax={parallax} compact={compactHeight} musicSnapshot={musicSnapshot} />
                      </div>
                    </div>
                  </Panel>

                  <Panel bodyClassName="p-0" className="shrink-0">
                    <div className="grid gap-2.5 p-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(235px,300px)_minmax(220px,285px)]">
                      <div className="min-w-0 rounded-xl border border-cyan-300/10 bg-sky-950/20 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/18 bg-cyan-400/[0.08]"><Pencil className="h-4 w-4 text-cyan-300" /></div>
                          <div className="min-w-0">
                            <div className="break-words text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200/78">Callsign</div>
                            <div className="break-words text-[8px] font-bold uppercase leading-relaxed tracking-[0.08em] text-sky-100/30">Name shown in the arena</div>
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Choose your callsign"
                          value={playerName}
                          onChange={(event) => setPlayerName(event.target.value.slice(0, 15))}
                          maxLength={15}
                          spellCheck={false}
                          autoComplete="off"
                          className="mt-3 w-full min-w-0 rounded-xl border border-cyan-300/12 bg-slate-950/55 px-3 py-3 uppercase outline-none transition placeholder:text-sky-200/18 focus:border-cyan-300/45"
                          style={{
                            fontFamily: '"Arial Black", sans-serif',
                            fontSize: 14,
                            fontWeight: 900,
                            letterSpacing: '0.11em',
                            color: user ? UI.teal : UI.ink,
                            cursor: 'text',
                          }}
                        />
                      </div>

                      <div className="grid min-w-0 gap-2">
                        <button
                          type="submit"
                          disabled={!deploymentReady}
                          onMouseEnter={playHover}
                          className="group relative flex min-w-0 items-center justify-between rounded-xl border px-4 py-3 text-left shadow-[0_16px_36px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                          style={{
                            background: 'linear-gradient(135deg, rgba(8,145,178,0.95), rgba(20,184,166,0.88) 48%, rgba(124,58,237,0.82))',
                            borderColor: 'rgba(125, 211, 252, 0.35)',
                            color: '#ecfeff',
                          }}
                        >
                          <div className="engage-sweep pointer-events-none absolute inset-y-0 w-16 -skew-x-12 bg-cyan-100/20 opacity-80" />
                          <div className="relative min-w-0">
                            <div className="break-words text-[8px] font-black uppercase tracking-[0.20em] text-cyan-50/66">Primary Launch</div>
                            <div className="mt-0.5 break-words text-xl font-black uppercase tracking-[0.14em] text-cyan-50">{gameMode === GameMode.SANDBOX ? 'Init' : 'Engage'}</div>
                          </div>
                          <ChevronRight className="relative h-5 w-5 shrink-0 text-cyan-50/84 transition group-hover:translate-x-1" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!spectateAvailable) return;
                            playClick();
                            handleSpectate();
                          }}
                          disabled={!spectateAvailable}
                          onMouseEnter={() => {
                            if (spectateAvailable) playHover();
                          }}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                          style={{
                            cursor: spectateAvailable ? 'pointer' : 'not-allowed',
                            borderColor: spectateAvailable ? 'rgba(32,230,255,0.24)' : 'rgba(100,116,139,0.14)',
                            background: spectateAvailable ? 'linear-gradient(135deg, rgba(6, 78, 98, 0.5), rgba(15, 23, 42, 0.82))' : 'rgba(15,23,42,0.72)',
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Eye className={`h-4 w-4 shrink-0 ${spectateAvailable ? 'text-cyan-300' : 'text-slate-500'}`} />
                            <div className="min-w-0">
                              <div className="break-words text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100/76">Spectate</div>
                              <div className="break-words text-[8px] font-bold uppercase leading-relaxed tracking-[0.08em] text-sky-100/34">{spectateAvailable ? 'Observe bot combat' : 'No targets yet'}</div>
                            </div>
                          </div>
                          <Radar className={`h-4 w-4 shrink-0 ${spectateAvailable ? 'text-teal-300/80' : 'text-slate-600'}`} />
                        </button>
                      </div>

                      <div className="rounded-xl border p-3" style={{ borderColor: modeMeta.border, background: modeMeta.fill }}>
                        <div className="break-words text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: modeMeta.color }}>{modeMeta.code}</div>
                        <div className="mt-1 break-words text-sm font-black uppercase leading-relaxed tracking-[0.06em] text-cyan-50/90">{modeMeta.title}</div>
                        <p className="mt-1.5 break-words text-[9px] font-bold uppercase leading-relaxed tracking-[0.07em] text-sky-100/42">{modeMeta.desc}</p>
                        {isTeamsMode && (
                          <div className="mt-2 rounded-lg border px-2.5 py-2" style={{ borderColor: teamMeta.border, background: teamMeta.bg }}>
                            <div className="break-words text-[8px] font-black uppercase tracking-[0.14em]" style={{ color: teamMeta.color }}>Selected Team</div>
                            <div className="mt-1 break-words text-[10px] font-black uppercase leading-relaxed tracking-[0.06em] text-cyan-50/82">{teamMeta.label}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Panel>
                </form>
              </motion.main>

              <motion.aside variants={slideRight} className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2.5 overflow-hidden">
                <Panel title="Arena Setup" subtitle="Mode and team grouped">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      {MODE_CHOICES.map((mode) => (
                        <ModeButton
                          key={mode}
                          mode={mode}
                          active={gameMode === mode}
                          onSelect={() => {
                            playSelect();
                            setGameMode(mode);
                          }}
                          onHover={() => {
                            playHover();
                            showTT(MODE_META[mode].title, MODE_META[mode].desc);
                          }}
                          onLeave={hideTT}
                        />
                      ))}
                    </div>

                    {isTeamsMode && (
                      <div className="grid grid-cols-2 gap-2">
                        {allowedTeams.map((team) => {
                          const active = safeTeam === team;
                          const canJoin = active || canJoinTeam(team);
                          return (
                            <TeamButton
                              key={team}
                              team={team}
                              active={active}
                              count={safeNumber(teamCounts?.[team])}
                              canJoin={canJoin}
                              onSelect={() => {
                                playSelect();
                                setSelectedTeam(team);
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel title="Top Agents" subtitle="Leaderboard uplink" className="min-h-0" bodyClassName="min-h-0 p-2.5">
                  <div className="menu-scrollbar grid h-full content-start gap-1.5 overflow-y-auto pr-1">
                    {topScores.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-cyan-300/10 bg-sky-950/20 px-3 py-5 text-center text-[9px] font-black uppercase tracking-[0.12em] text-sky-100/25">No data stream</div>
                    ) : (
                      topScores.map((entry, index) => <LeaderboardRow key={`${entry.name}-${index}`} entry={entry} index={index} />)
                    )}
                  </div>
                </Panel>

                <Panel title="Controls" subtitle="Fast reference">
                  <div className="grid gap-1.5">
                    <ControlRow label="Move" keyLabel="WASD" desc="Navigate grid" />
                    <ControlRow label="Fire" keyLabel="LMB" desc="Primary weapon" />
                    <ControlRow label="Observe" keyLabel="A / D" desc="Spectate cycle" />
                  </div>
                </Panel>
              </motion.aside>
            </div>

            <footer className="flex shrink-0 flex-col gap-2 rounded-2xl border border-cyan-300/10 bg-slate-950/42 px-3 py-2 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="menu-copy text-[8px] font-black uppercase leading-[1.35] tracking-[0.12em] text-sky-100/38">Secure Protocol / Build 4.2.8 Origin</div>
              <div className="flex shrink-0 items-center gap-3">
                <button type="button" onClick={() => { playClick(); setShowPrivacy(true); }} className="text-[9px] font-black uppercase tracking-[0.12em] text-cyan-300/82 transition hover:text-cyan-200">Privacy</button>
                <span className="text-cyan-200/18">/</span>
                <button type="button" onClick={() => { playClick(); setShowTos(true); }} className="text-[9px] font-black uppercase tracking-[0.12em] text-rose-300/82 transition hover:text-rose-200">Terms</button>
              </div>
            </footer>
          </div>

          <style>{`
            .vextor-menu,
            .vextor-menu * {
              box-sizing: border-box;
            }

            .vextor-menu button,
            .vextor-menu input,
            .vextor-menu section,
            .vextor-menu div {
              min-width: 0;
            }


            .menu-copy {
              overflow-wrap: anywhere;
              word-break: normal;
              hyphens: auto;
              text-wrap: pretty;
            }

            .vextor-menu button,
            .vextor-menu input {
              -webkit-tap-highlight-color: transparent;
            }

            .vextor-menu button {
              max-width: 100%;
            }

            .vextor-title {
              max-width: 100%;
              overflow: visible;
            }

            @keyframes glitchR {
              0%,89%,100% { opacity:0; transform:translate(0,0); clip-path:none; }
              90% { opacity:0.56; transform:translate(-3px,1px); clip-path:inset(20% 0 60% 0); }
              92% { opacity:0; }
              94% { opacity:0.42; transform:translate(2px,-1px); clip-path:inset(60% 0 10% 0); }
              96% { opacity:0; }
            }
            @keyframes glitchB {
              0%,90%,100% { opacity:0; transform:translate(0,0); clip-path:none; }
              91% { opacity:0.52; transform:translate(3px,-1px); clip-path:inset(40% 0 30% 0); }
              93% { opacity:0; }
              95% { opacity:0.44; transform:translate(-2px,2px); clip-path:inset(10% 0 70% 0); }
              97% { opacity:0; }
            }
            .vextor-glitch-r { animation: glitchR 6s infinite; }
            .vextor-glitch-b { animation: glitchB 6s infinite 0.05s; }

            @keyframes sweep {
              0% { transform: translateX(-190%) skewX(-12deg); }
              100% { transform: translateX(760%) skewX(-12deg); }
            }
            .engage-sweep { animation: sweep 2.7s ease-in-out infinite; }

            @keyframes spinCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes spinCCW { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

            .menu-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: rgba(32,230,255,0.30) rgba(15,23,42,0.44);
            }
            .menu-scrollbar::-webkit-scrollbar { width: 7px; height: 7px; }
            .menu-scrollbar::-webkit-scrollbar-track { background: rgba(15,23,42,0.44); border-radius: 999px; }
            .menu-scrollbar::-webkit-scrollbar-thumb { background: rgba(32,230,255,0.30); border-radius: 999px; }
            .menu-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(32,230,255,0.46); }

            button:focus-visible,
            input:focus-visible {
              outline: 1px solid rgba(32,230,255,0.54);
              outline-offset: 2px;
            }

            @media (max-width: 1023px) {
              .vextor-menu { overflow-y: auto; }
              .vextor-menu .grid { min-height: auto; }
            }

            @media (max-height: 840px) and (min-width: 1024px) {
              .vextor-menu header { padding-top: 0.55rem; padding-bottom: 0.55rem; }
              .vextor-menu section header { padding-top: 0.65rem; padding-bottom: 0.65rem; }
            }

            @media (max-height: 760px) and (min-width: 1024px) {
              .vextor-title,
              .vextor-glitch-r,
              .vextor-glitch-b {
                letter-spacing: -0.04em !important;
              }
            }
          `}</style>

          <PolicyModal open={showPrivacy} type="privacy" onClose={() => setShowPrivacy(false)} />
          <PolicyModal open={showTos} type="terms" onClose={() => setShowTos(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface InteractiveTankPreviewProps {
  tankColor: string;
  isTeamsMode: boolean;
  parallax: { x: number; y: number };
  compact?: boolean;
  musicSnapshot: BackgroundMusicVisualizerFrame | null;
}

const InteractiveTankPreview: React.FC<InteractiveTankPreviewProps> = ({ tankColor, isTeamsMode, parallax, compact = false, musicSnapshot }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const targetAngle = useRef(0);
  const beatSwingRef = useRef(0);
  const snapshotRef = useRef<BackgroundMusicVisualizerFrame | null>(musicSnapshot);
  const [turretRotation, setTurretRotation] = useState(0);
  const [chassisRotation, setChassisRotation] = useState(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    snapshotRef.current = musicSnapshot;
  }, [musicSnapshot]);

  useEffect(() => {
    const tick = (time: number) => {
      const snapshot = snapshotRef.current;
      const beatPhase = snapshot?.beatPhase ?? 0;
      const beatPulse = snapshot?.beatPulse ?? 0;
      const downbeatPulse = snapshot?.downbeatPulse ?? 0;

      setTurretRotation((prev) => {
        const swingDirection = Math.sin((time / 1000) * Math.PI * 2 * (0.65 + beatPhase * 0.35));
        beatSwingRef.current = swingDirection * (6 + beatPulse * 7 + downbeatPulse * 9);
        const desiredAngle = targetAngle.current + beatSwingRef.current;
        let delta = desiredAngle - prev;
        while (delta < -180) delta += 360;
        while (delta > 180) delta -= 360;
        return prev + delta * (0.1 + downbeatPulse * 0.05);
      });
      setChassisRotation(Math.sin(time / 1800) * (4 + beatPulse * 2) + downbeatPulse * 2.5);
      setPulse(Math.min(1, Math.sin(time / 800) * 0.28 + 0.42 + beatPulse * 0.38 + downbeatPulse * 0.18));
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (event: MouseEvent) => {
      if (!frameRef.current) return;
      const bounds = frameRef.current.getBoundingClientRect();
      targetAngle.current =
        Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) *
        (180 / Math.PI);
    };

    rafRef.current = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  const previewSize = compact ? (isTeamsMode ? 102 : 124) : isTeamsMode ? 126 : 156;
  const frameSize = compact ? 176 : 220;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{
        width: frameSize,
        height: frameSize,
        transform: `translate3d(${parallax.x * 0.007}px, ${parallax.y * 0.007}px, 0)`,
      }}
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="absolute rounded-full"
          style={{
            width: 148 + index * 38,
            height: 148 + index * 38,
            border: `1px solid rgba(32,230,255,${0.07 - index * 0.015})`,
            animation: `spin${index % 2 === 0 ? 'CW' : 'CCW'} ${18 + index * 8}s linear infinite`,
            borderStyle: index === 1 ? 'dashed' : 'solid',
          }}
        />
      ))}

      <div
        className="absolute rounded-full"
        style={{
          width: 94 + pulse * 42,
          height: 94 + pulse * 42,
          border: `1px solid rgba(44,255,199,${0.18 * (1 - pulse)})`,
        }}
      />

      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: 116,
          height: 12,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.66), transparent)',
          filter: 'blur(6px)',
        }}
      />

      <div ref={frameRef} className="relative z-10" style={{ filter: 'drop-shadow(0 0 24px rgba(32,230,255,0.18))' }}>
        <TankPreview
          tankClass={TankClass.BASIC}
          color={tankColor}
          size={previewSize}
          turretRotation={turretRotation}
          chassisRotation={chassisRotation}
        />
      </div>

      {[0, 90, 180, 270].map((deg) => (
        <div
          key={deg}
          className="absolute h-2.5 w-px origin-bottom"
          style={{
            background: 'rgba(44,255,199,0.30)',
            left: '50%',
            bottom: '50%',
            transform: `rotate(${deg}deg) translateX(-50%)`,
            transformOrigin: `50% ${compact ? 94 : 116}px`,
          }}
        />
      ))}
    </div>
  );
};
