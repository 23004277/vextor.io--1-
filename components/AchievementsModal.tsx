import React, { useMemo, useState } from 'react';
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
  count: number;
  unlocked: number;
};

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  user,
  onClose,
  darkMode,
  playSound
}) => {
  const [activeTab, setActiveTab] = useState<AchievementCategory>('All');
  const unlockedIds = user?.stats.achievementsUnlocked || [];

  const categoryMap: Record<string, AchievementCategory> = {
    kills: 'Combat',
    elite: 'Combat',
    level: 'Evolution',
    score: 'Evolution',
    games: 'Evolution',
    special: 'Artifacts',
    upgrade: 'Engineering'
  };

  const tabs: AchievementCategory[] = ['All', 'Combat', 'Engineering', 'Evolution', 'Artifacts'];

  const categorizedAchievements = useMemo(() => {
    const result: Record<AchievementCategory, Achievement[]> = {
      All: ACHIEVEMENTS,
      Combat: [],
      Engineering: [],
      Evolution: [],
      Artifacts: []
    };

    for (const achievement of ACHIEVEMENTS) {
      const mapped = categoryMap[achievement.category];
      if (mapped) result[mapped].push(achievement);
    }

    return result;
  }, []);

  const filteredAchievements = useMemo(() => {
    return activeTab === 'All' ? ACHIEVEMENTS : categorizedAchievements[activeTab];
  }, [activeTab, categorizedAchievements]);

  const categoryStats = useMemo(() => {
    const stats: Record<AchievementCategory, CategoryMeta> = {
      All: { label: 'All', count: ACHIEVEMENTS.length, unlocked: unlockedIds.length },
      Combat: { label: 'Combat', count: 0, unlocked: 0 },
      Engineering: { label: 'Engineering', count: 0, unlocked: 0 },
      Evolution: { label: 'Evolution', count: 0, unlocked: 0 },
      Artifacts: { label: 'Artifacts', count: 0, unlocked: 0 }
    };

    for (const tab of tabs.filter((t) => t !== 'All')) {
      const list = categorizedAchievements[tab];
      stats[tab] = {
        label: tab,
        count: list.length,
        unlocked: list.filter((a) => unlockedIds.includes(a.id)).length
      };
    }

    return stats;
  }, [unlockedIds, categorizedAchievements]);

  const stats = useMemo(() => {
    const total = ACHIEVEMENTS.length;
    const unlocked = unlockedIds.length;
    const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
    return { total, unlocked, percent };
  }, [unlockedIds]);

  const shellBg = darkMode
    ? 'bg-black/95'
    : 'bg-zinc-950/92';

  const panelBg = darkMode
    ? 'bg-[#030303]'
    : 'bg-zinc-900';

  const mutedCard = darkMode
    ? 'bg-white/[0.02] border-white/5'
    : 'bg-white/[0.04] border-white/10';

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center ${shellBg} backdrop-blur-[60px] p-3 md:p-4`}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 12, filter: 'blur(10px)' }}
        animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ scale: 0.88, opacity: 0, y: 12, filter: 'blur(10px)' }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-7xl h-[92vh] overflow-hidden rounded-[2rem] md:rounded-[3rem] ${panelBg} border border-white/5 shadow-[0_0_150px_rgba(0,0,0,1)] flex flex-col`}
      >
        <div className="relative flex items-center justify-between gap-4 px-5 md:px-8 py-5 border-b border-white/5 bg-black/30 backdrop-blur-xl shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 md:w-14 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)]" />
              <span className="text-[9px] md:text-[10px] font-black text-cyan-400 uppercase tracking-[0.45em] italic">
                Archive_System
              </span>
            </div>

            <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tight leading-none truncate">
              {activeTab === 'All' ? 'All Milestones' : `${activeTab} Milestones`}
            </h2>

            <p className="text-[10px] md:text-[11px] font-bold text-white/30 uppercase tracking-[0.22em] mt-2 truncate">
              Verified progression logs and unlock state.
            </p>
          </div>

          <div className="hidden sm:block text-right shrink-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/35 font-bold">Unlocked</p>
            <p className="text-sm md:text-base font-black text-cyan-400">
              {stats.unlocked}/{stats.total}
            </p>
          </div>

          <button
            onClick={() => {
              playSound();
              onClose();
            }}
            aria-label="Close achievements"
            className="ml-auto w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/5 border border-white/10 text-white/45 hover:text-white hover:bg-white/10 transition-all duration-300 flex items-center justify-center shrink-0 backdrop-blur-xl"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <aside className="w-[340px] xl:w-[380px] hidden md:flex flex-col border-r border-white/5 p-6 xl:p-8 bg-white/[0.01] min-h-0">
            <div className="mb-7 shrink-0">
              <h3 className="text-4xl xl:text-5xl font-black text-white uppercase italic leading-[0.9] tracking-tight">
                Milestone<br />
                <span className="text-white/20">Protocols</span>
              </h3>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.24em] mt-4 border-l border-white/10 pl-4">
                Sector classification and archive overview.
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-3">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-2 block italic">
                Sector_Classification
              </span>

              {tabs.map((tab) => {
                const active = activeTab === tab;
                const meta = categoryStats[tab];

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      playSound();
                      setActiveTab(tab);
                    }}
                    className={`w-full group flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border min-w-0 ${
                      active
                        ? 'bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.12)]'
                        : `${mutedCard} text-white/40 hover:border-white/15 hover:text-white hover:bg-white/[0.04]`
                    }`}
                  >
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] italic truncate">
                        {tab}
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-[0.15em] mt-1 ${active ? 'text-black/50' : 'text-white/25'}`}>
                        {meta.unlocked}/{meta.count} secured
                      </span>
                    </div>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${active ? 'bg-black/5 border-black/15' : 'bg-white/5 border-white/5'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-black' : meta.unlocked === meta.count && meta.count > 0 ? 'bg-cyan-500' : 'bg-white/15'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-cyan-950/20 to-transparent border border-white/5 shrink-0">
              <div className="flex justify-between items-end mb-3">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Global_Sync</span>
                <span className="text-2xl font-black text-white italic tracking-tight">{stats.percent}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.percent}%` }}
                  transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                  className="h-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)]"
                />
              </div>
            </div>
          </aside>

          <section className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
            <div className="md:hidden px-5 pt-5 pb-4 border-b border-white/5">
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                {tabs.map((tab) => {
                  const active = activeTab === tab;
                  const meta = categoryStats[tab];

                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        playSound();
                        setActiveTab(tab);
                      }}
                      className={`shrink-0 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.03] border-white/5 text-white/40'
                      }`}
                    >
                      {tab} <span className="opacity-60">({meta.unlocked}/{meta.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative flex-1 min-h-0 overflow-hidden">
              <div className="absolute top-0 right-0 p-8 md:p-12 opacity-5 pointer-events-none z-0">
                <svg className="w-40 h-40 md:w-52 md:h-52 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>

              <div className="relative z-10 h-full overflow-y-auto custom-scrollbar scroll-smooth px-5 md:px-8 xl:px-10 py-5 md:py-7">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 pb-2"
                  >
                    {filteredAchievements.length === 0 ? (
                      <div className="col-span-full flex items-center justify-center min-h-[320px] rounded-[1.75rem] border border-white/5 bg-white/[0.02]">
                        <div className="text-center max-w-sm px-6">
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <h4 className="text-xl font-black text-white uppercase italic">No Milestones Found</h4>
                          <p className="text-[11px] text-white/35 uppercase tracking-[0.18em] mt-2">
                            This category has no entries yet.
                          </p>
                        </div>
                      </div>
                    ) : (
                      filteredAchievements.map((achievement: Achievement) => {
                        const isUnlocked = unlockedIds.includes(achievement.id);

                        return (
                          <div
                            key={achievement.id}
                            className={`group relative p-5 md:p-6 rounded-2xl border transition-all duration-500 flex items-start gap-4 md:gap-5 min-h-[150px] overflow-hidden min-w-0 ${
                              isUnlocked
                                ? 'bg-white/[0.04] border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.06] shadow-2xl'
                                : 'bg-black/60 border-white/5 opacity-50 grayscale contrast-125'
                            }`}
                          >
                            {isUnlocked && (
                              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
                            )}

                            <div className="relative shrink-0 mt-1">
                              <div
                                className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-all duration-500 group-hover:scale-105 ${
                                  isUnlocked
                                    ? 'bg-gradient-to-br from-white to-white/[0.8] text-black shadow-2xl'
                                    : 'bg-white/5 text-white/10'
                                }`}
                              >
                                {achievement.icon || '*'}
                              </div>
                            </div>

                            <div className="flex-1 relative z-10 pt-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-3 mb-2 min-w-0">
                                <span
                                  className={`text-[10px] font-black tracking-[0.15em] uppercase italic truncate ${
                                    isUnlocked ? 'text-cyan-500' : 'text-white/20'
                                  }`}
                                >
                                  MOD_{achievement.category.toUpperCase()}
                                </span>
                                <div className={`flex-1 h-px min-w-6 ${isUnlocked ? 'bg-white/10' : 'bg-white/5'}`} />
                              </div>

                              <h4 className={`text-lg md:text-xl font-black uppercase tracking-tight italic leading-tight mb-2 break-words ${isUnlocked ? 'text-white' : 'text-white/30'}`}>
                                {achievement.name}
                              </h4>

                              <p className="text-[11px] text-white/45 font-bold leading-relaxed tracking-wide uppercase break-words">
                                {achievement.description}
                              </p>

                              {achievement.rewardSkinId && isUnlocked && (
                                <div className="mt-4 flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 max-w-full">
                                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] shrink-0" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.1em] italic truncate">
                                    Legacy_Chassis_Verified
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className={`absolute bottom-3 right-4 text-[9px] font-black truncate max-w-[55%] ${isUnlocked ? 'text-white/10 group-hover:text-cyan-500/30' : 'text-white/[0.05]'}`}>
                              PROTOCOL_{achievement.id.toUpperCase()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="hidden md:flex shrink-0 border-t border-white/5 px-8 xl:px-10 py-4 items-center justify-between bg-black/40">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
                Scroll to inspect all milestones
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
                {filteredAchievements.length} visible
              </p>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
};