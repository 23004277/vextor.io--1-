import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Achievement, User } from '../types';
import { ACHIEVEMENTS } from '../constants';

interface AchievementsModalProps {
  user: User | null;
  onClose: () => void;
  darkMode: boolean;
  playSound: () => void;
}

type AchievementCategory = 'All' | 'Combat' | 'Engineering' | 'Evolution' | 'Artifacts';

type CategoryMeta = {
  label: AchievementCategory;
  shortLabel: string;
  description: string;
  accent: string;
  icon: React.ReactNode;
  total: number;
  unlocked: number;
  percent: number;
};

const TABS: AchievementCategory[] = ['All', 'Combat', 'Engineering', 'Evolution', 'Artifacts'];

const CATEGORY_BY_SOURCE: Record<string, AchievementCategory> = {
  kills: 'Combat',
  elite: 'Combat',
  level: 'Evolution',
  score: 'Evolution',
  games: 'Evolution',
  special: 'Artifacts',
  upgrade: 'Engineering',
};

const CATEGORY_COPY: Record<AchievementCategory, Omit<CategoryMeta, 'total' | 'unlocked' | 'percent'>> = {
  All: {
    label: 'All',
    shortLabel: 'All',
    description: 'Complete archive of every milestone, reward, and progression objective.',
    accent: 'from-cyan-400/20 via-cyan-400/5 to-transparent',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.82 6.2 20.86l1.11-6.46-4.7-4.58 6.49-.94L12 3z" />
      </svg>
    ),
  },
  Combat: {
    label: 'Combat',
    shortLabel: 'Combat',
    description: 'Kills, elite takedowns, pressure plays, and direct arena dominance.',
    accent: 'from-rose-400/20 via-rose-400/5 to-transparent',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5l4 4M4 20l5.5-1.5L19 9l-4-4-9.5 9.5L4 20z" />
      </svg>
    ),
  },
  Engineering: {
    label: 'Engineering',
    shortLabel: 'Eng',
    description: 'Build optimisation, upgrades, stat growth, and mechanical mastery.',
    accent: 'from-amber-400/20 via-amber-400/5 to-transparent',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 4.3a2.4 2.4 0 013.4 0l.7.7 1-.3a2.4 2.4 0 012.9 2.9l-.3 1 .7.7a2.4 2.4 0 010 3.4l-.7.7.3 1a2.4 2.4 0 01-2.9 2.9l-1-.3-.7.7a2.4 2.4 0 01-3.4 0l-.7-.7-1 .3a2.4 2.4 0 01-2.9-2.9l.3-1-.7-.7a2.4 2.4 0 010-3.4l.7-.7-.3-1a2.4 2.4 0 012.9-2.9l1 .3.7-.7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
      </svg>
    ),
  },
  Evolution: {
    label: 'Evolution',
    shortLabel: 'Evo',
    description: 'Level milestones, score pushing, long runs, and class progression.',
    accent: 'from-violet-400/20 via-violet-400/5 to-transparent',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 16l3-4 3 2 4-7" />
      </svg>
    ),
  },
  Artifacts: {
    label: 'Artifacts',
    shortLabel: 'Arts',
    description: 'Rare objectives, hidden rewards, special feats, and legacy unlocks.',
    accent: 'from-emerald-400/20 via-emerald-400/5 to-transparent',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.5-2.9 7.8-7 9-4.1-1.2-7-4.5-7-9V7l7-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-5" />
      </svg>
    ),
  },
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAchievementCategory(achievement: Achievement): AchievementCategory {
  return CATEGORY_BY_SOURCE[achievement.category] || 'Artifacts';
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ user, onClose, darkMode, playSound }) => {
  const [activeTab, setActiveTab] = useState<AchievementCategory>('All');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef<Record<AchievementCategory, HTMLButtonElement | null>>({
    All: null,
    Combat: null,
    Engineering: null,
    Evolution: null,
    Artifacts: null,
  });

  const unlockedIds = user?.stats.achievementsUnlocked || [];
  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);

  const categorizedAchievements = useMemo(() => {
    const result: Record<AchievementCategory, Achievement[]> = {
      All: ACHIEVEMENTS,
      Combat: [],
      Engineering: [],
      Evolution: [],
      Artifacts: [],
    };

    for (const achievement of ACHIEVEMENTS) {
      const category = getAchievementCategory(achievement);
      result[category].push(achievement);
    }

    return result;
  }, []);

  const categoryStats = useMemo<Record<AchievementCategory, CategoryMeta>>(() => {
    const output = {} as Record<AchievementCategory, CategoryMeta>;

    for (const tab of TABS) {
      const list = tab === 'All' ? ACHIEVEMENTS : categorizedAchievements[tab];
      const total = list.length;
      const unlocked = list.reduce((sum, achievement) => sum + (unlockedSet.has(achievement.id) ? 1 : 0), 0);
      const percent = total > 0 ? clampPercent((unlocked / total) * 100) : 0;

      output[tab] = {
        ...CATEGORY_COPY[tab],
        total,
        unlocked,
        percent,
      };
    }

    return output;
  }, [categorizedAchievements, unlockedSet]);

  const filteredAchievements = useMemo(() => {
    return activeTab === 'All' ? ACHIEVEMENTS : categorizedAchievements[activeTab];
  }, [activeTab, categorizedAchievements]);

  const globalStats = categoryStats.All;
  const activeMeta = categoryStats[activeTab];

  const shellClass = darkMode ? 'bg-zinc-950/90 text-white' : 'bg-slate-950/90 text-white';
  const surfaceClass = darkMode ? 'bg-[#07090f]/95 border-white/10' : 'bg-[#0b1020]/95 border-white/10';
  const cardClass = darkMode ? 'bg-white/[0.045] border-white/8' : 'bg-white/[0.06] border-white/10';

  const selectTab = (tab: AchievementCategory, shouldFocus = false) => {
    playSound();
    setActiveTab(tab);

    if (shouldFocus) {
      requestAnimationFrame(() => tabRefs.current[tab]?.focus());
    }
  };

  const closeModal = () => {
    playSound();
    onClose();
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: AchievementCategory) => {
    const currentIndex = TABS.indexOf(tab);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    selectTab(TABS[nextIndex], true);
  };

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center ${shellClass} p-4 sm:p-6 lg:p-8 backdrop-blur-3xl`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievements-modal-title"
        aria-describedby="achievements-modal-description"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex h-[min(92vh,62rem)] w-full max-w-[96rem] overflow-hidden rounded-[2rem] border ${surfaceClass} shadow-[0_2rem_8rem_rgba(0,0,0,0.65)]`}
      >
        <aside className="hidden w-[22rem] shrink-0 flex-col border-r border-white/10 bg-white/[0.025] p-8 lg:flex">
          <div className="mb-8">
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_1rem_rgba(103,232,249,0.9)]" />
              Milestones
            </div>

            <h2 id="achievements-modal-title" className="text-4xl font-black uppercase italic leading-[0.9] tracking-tight text-white">
              Achievement<br />Archive
            </h2>

            <p id="achievements-modal-description" className="mt-5 max-w-[17rem] text-sm font-medium leading-6 text-white/45">
              Track unlocked objectives, progression routes, rare rewards, and completion goals without the old cramped list layout.
            </p>
          </div>

          <div className={`mb-8 rounded-[1.5rem] border ${cardClass} p-5`}>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Completion</p>
                <p className="mt-1 text-3xl font-black italic text-white">{globalStats.percent}%</p>
              </div>
              <p className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
                {globalStats.unlocked}/{globalStats.total}
              </p>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-black/35">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${globalStats.percent}%` }}
                transition={{ type: 'spring', stiffness: 150, damping: 24 }}
                className="h-full rounded-full bg-cyan-300 shadow-[0_0_1.5rem_rgba(103,232,249,0.65)]"
              />
            </div>
          </div>

          <nav aria-label="Achievement categories" className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            <div role="tablist" aria-orientation="vertical" className="space-y-3">
              {TABS.map((tab) => {
                const meta = categoryStats[tab];
                const active = activeTab === tab;

                return (
                  <button
                    key={tab}
                    ref={(node) => {
                      tabRefs.current[tab] = node;
                    }}
                    id={`achievement-tab-${tab}`}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    aria-controls={`achievement-panel-${tab}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectTab(tab)}
                    onKeyDown={(event) => handleTabKeyDown(event, tab)}
                    className={`group w-full rounded-[1.35rem] border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                      active
                        ? 'border-white/25 bg-white text-slate-950 shadow-[0_1rem_2.5rem_rgba(255,255,255,0.08)]'
                        : 'border-white/8 bg-white/[0.035] text-white/60 hover:border-white/18 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-slate-950 text-white' : 'bg-white/8 text-white/45 group-hover:text-white'}`}>
                        {meta.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black uppercase tracking-[0.16em]">{meta.label}</span>
                        <span className={`mt-1 block text-xs font-bold ${active ? 'text-slate-950/55' : 'text-white/35'}`}>
                          {meta.unlocked}/{meta.total} unlocked
                        </span>
                      </span>

                      <span className={`text-xs font-black ${active ? 'text-slate-950/45' : 'text-white/25'}`}>{meta.percent}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-white/10 px-6 py-5 sm:px-8 lg:px-10">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-r ${activeMeta.accent} px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70`}>
                    {activeMeta.icon}
                    {activeMeta.label}
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/45">
                    {activeMeta.unlocked}/{activeMeta.total} unlocked
                  </span>
                </div>

                <h3 className="truncate text-3xl font-black uppercase italic tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {activeTab === 'All' ? 'All Milestones' : `${activeTab} Milestones`}
                </h3>

                <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-white/45">{activeMeta.description}</p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
                aria-label="Close achievements modal"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/55 transition-all hover:bg-white/12 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 lg:hidden">
              <div role="tablist" aria-label="Achievement categories" className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {TABS.map((tab) => {
                  const meta = categoryStats[tab];
                  const active = activeTab === tab;

                  return (
                    <button
                      key={tab}
                      ref={(node) => {
                        tabRefs.current[tab] = node;
                      }}
                      id={`achievement-mobile-tab-${tab}`}
                      role="tab"
                      type="button"
                      aria-selected={active}
                      aria-controls={`achievement-panel-${tab}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => selectTab(tab)}
                      onKeyDown={(event) => handleTabKeyDown(event, tab)}
                      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                        active
                          ? 'border-white bg-white text-slate-950'
                          : 'border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      {meta.shortLabel}<span className="ml-2 opacity-60">{meta.unlocked}/{meta.total}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <section
            id={`achievement-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`achievement-tab-${activeTab}`}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 lg:px-10 lg:py-8 custom-scrollbar"
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {filteredAchievements.length === 0 ? (
                  <EmptyAchievementState />
                ) : (
                  filteredAchievements.map((achievement) => (
                    <AchievementCard key={achievement.id} achievement={achievement} unlocked={unlockedSet.has(achievement.id)} cardClass={cardClass} />
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </section>

          <footer className="hidden shrink-0 items-center justify-between border-t border-white/10 bg-black/20 px-10 py-4 text-xs font-bold uppercase tracking-[0.18em] text-white/35 lg:flex">
            <span>{filteredAchievements.length} visible entries</span>
            <span>Use arrow keys to switch categories</span>
          </footer>
        </main>
      </motion.div>
    </div>
  );
};

function EmptyAchievementState() {
  return (
    <div className="col-span-full flex min-h-[22rem] items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06] text-white/35">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="text-2xl font-black uppercase italic tracking-tight text-white">No Milestones Found</h4>
        <p className="mt-3 text-sm font-medium leading-6 text-white/45">
          This category does not have any achievement entries yet. Add entries to the achievement constants to populate this grid.
        </p>
      </div>
    </div>
  );
}

function AchievementCard({ achievement, unlocked, cardClass }: { achievement: Achievement; unlocked: boolean; cardClass: string }) {
  const category = getAchievementCategory(achievement);
  const categoryMeta = CATEGORY_COPY[category];

  return (
    <article
      className={`group relative min-h-[17rem] overflow-hidden rounded-[1.5rem] border p-5 transition-all duration-300 ${
        unlocked
          ? `${cardClass} shadow-[0_1.25rem_3rem_rgba(0,0,0,0.24)] hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075]`
          : 'border-white/6 bg-black/35 opacity-65 grayscale hover:opacity-85'
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${categoryMeta.accent} ${unlocked ? 'opacity-100' : 'opacity-40'}`} />
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/[0.04] blur-2xl" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] text-3xl shadow-lg transition-transform duration-300 group-hover:scale-105 ${
              unlocked ? 'bg-white text-slate-950' : 'border border-white/8 bg-white/[0.04] text-white/18'
            }`}
            aria-hidden="true"
          >
            {achievement.icon || '★'}
          </div>

          <div
            className={`rounded-full border px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] ${
              unlocked ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100' : 'border-white/8 bg-white/[0.035] text-white/25'
            }`}
          >
            {unlocked ? 'Unlocked' : 'Locked'}
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <span className={`text-[0.68rem] font-black uppercase tracking-[0.18em] ${unlocked ? 'text-white/50' : 'text-white/22'}`}>{category}</span>
          <span className="h-px min-w-8 flex-1 bg-white/10" />
        </div>

        <h4 className={`text-xl font-black uppercase italic leading-tight tracking-tight ${unlocked ? 'text-white' : 'text-white/35'}`}>
          {achievement.name}
        </h4>

        <p className={`mt-3 flex-1 text-sm font-medium leading-6 ${unlocked ? 'text-white/52' : 'text-white/25'}`}>{achievement.description}</p>

        {achievement.rewardSkinId && (
          <div className={`mt-5 rounded-2xl border px-4 py-3 ${unlocked ? 'border-amber-300/20 bg-amber-300/10 text-amber-100' : 'border-white/8 bg-white/[0.025] text-white/20'}`}>
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 shrink-0 rounded-full ${unlocked ? 'bg-amber-200 shadow-[0_0_1rem_rgba(253,230,138,0.75)]' : 'bg-white/15'}`} />
              <span className="truncate text-xs font-black uppercase tracking-[0.14em]">Reward Skin Available</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
