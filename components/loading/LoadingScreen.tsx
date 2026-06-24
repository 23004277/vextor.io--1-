import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BackgroundMusicVisualizerFrame } from '../../Background Music';
import { COMMAND_THEME_CLASS, commandCx } from '../uiTheme';
import { getLoadingStatusValue, LOADING_PHASE_CONTENT, type LoadingPhase } from './loadingScreenContent';

type LoadingScreenProps = {
  phase: LoadingPhase | null;
  progress: number;
  musicSnapshot: BackgroundMusicVisualizerFrame | null;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ phase, progress, musicSnapshot }) => {
  const safeProgress = clamp(progress);
  const content = phase ? LOADING_PHASE_CONTENT[phase] : null;
  const bars = musicSnapshot?.bars?.slice(0, 14) ?? new Array(14).fill(0.26);
  const signalLabel = musicSnapshot?.sectionLabel ?? 'Standby';
  const energy = Math.round(clamp(musicSnapshot?.energy ?? 0.26) * 100);

  return (
    <AnimatePresence>
      {phase && content && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-[90] overflow-hidden bg-[radial-gradient(circle_at_50%_16%,rgba(34,211,238,0.16),transparent_22%),radial-gradient(circle_at_18%_84%,rgba(96,165,250,0.08),transparent_28%),radial-gradient(circle_at_82%_76%,rgba(167,139,250,0.08),transparent_26%),linear-gradient(180deg,rgba(2,8,20,0.98),rgba(1,5,14,0.995))]"
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%,transparent_78%,rgba(255,255,255,0.03))]" />

          <div className="absolute inset-0 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
            <div className={commandCx(COMMAND_THEME_CLASS.shell, 'relative w-full max-w-[960px] overflow-hidden rounded-[2rem]')}>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
              <div className="grid gap-0 lg:grid-cols-[minmax(0,0.98fr)_minmax(320px,0.82fr)]">
                <section className="relative border-b border-cyan-300/10 px-6 py-6 sm:px-8 sm:py-8 lg:border-b-0 lg:border-r">
                  <div className="pointer-events-none absolute right-4 top-4 h-28 w-28 rounded-full bg-cyan-400/12 blur-3xl sm:h-36 sm:w-36" />

                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/14 bg-cyan-400/[0.07] px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/78">
                    <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
                    {content.eyebrow}
                  </div>

                  <h2 className="mt-4 max-w-[14ch] text-[clamp(1.9rem,4.3vw,3.45rem)] font-black uppercase leading-[0.98] tracking-[0.05em] text-white">
                    {content.title}
                  </h2>
                  <p className="mt-4 max-w-[38rem] text-sm leading-7 text-cyan-100/60 sm:text-[15px]">
                    {content.description}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {content.statuses.map((status, index) => (
                      <div key={status.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">{status.label}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <motion.span
                            className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.85)]"
                            animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.12, 1] }}
                            transition={{ duration: 1 + index * 0.12, repeat: Infinity, ease: 'easeInOut' }}
                          />
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/82">
                            {getLoadingStatusValue(phase, status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[1.3rem] border border-white/8 bg-black/18 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200/72">Boot Sequence</div>
                        <div className="mt-1 max-w-[30rem] text-[12px] leading-5 text-white/44">
                          One uninterrupted boot path to prevent reveal skips, flash frames, and jumpy progress reads.
                        </div>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <div className="text-[8px] font-black uppercase tracking-[0.16em] text-white/30">Phase</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/78">{content.sequenceLabel}</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="px-6 py-6 sm:px-8 sm:py-8">
                  <div className="flex items-center justify-center">
                    <div className="relative flex h-[170px] w-[170px] items-center justify-center sm:h-[188px] sm:w-[188px]">
                      <motion.div
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full border border-cyan-300/12"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 9.2, repeat: Infinity, ease: 'linear' }}
                        style={{ borderTopColor: 'rgba(103,232,249,0.5)', borderRightColor: 'rgba(103,232,249,0.14)' }}
                      />
                      <motion.div
                        aria-hidden="true"
                        className="absolute inset-[14px] rounded-full border border-violet-300/12"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 7.4, repeat: Infinity, ease: 'linear' }}
                        style={{ borderLeftColor: 'rgba(167,139,250,0.42)', borderBottomColor: 'rgba(167,139,250,0.14)' }}
                      />
                      <div className="absolute inset-[34px] rounded-full bg-[radial-gradient(circle,rgba(8,25,42,0.96),rgba(2,10,22,0.98))] shadow-[inset_0_0_44px_rgba(0,0,0,0.52)]" />
                      <motion.div
                        className="absolute inset-[56px] rounded-full"
                        animate={{ scale: [0.96, 1.04, 0.96], opacity: [0.48, 0.88, 0.48] }}
                        transition={{ duration: 1.75, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.28), rgba(167,139,250,0.12) 58%, transparent 76%)' }}
                      />
                      <motion.div
                        className="relative h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_26px_rgba(103,232,249,0.96)]"
                        animate={{ scale: [1, 1.18, 1], opacity: [0.72, 1, 0.72] }}
                        transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/68">Boot Progress</div>
                      <div className="mt-2 max-w-[28rem] text-sm leading-6 text-white/56">{content.progressLabel}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/32">Completion</div>
                      <div className="mt-1 text-2xl font-black text-white">{Math.round(safeProgress * 100)}%</div>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[1rem] border border-cyan-300/12 bg-white/[0.04] p-1.5">
                    <div className="relative h-4 overflow-hidden rounded-[0.9rem] bg-[linear-gradient(180deg,rgba(6,18,32,0.8),rgba(4,12,24,0.92))]">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-[0.9rem] bg-[linear-gradient(90deg,#22d3ee,#2dd4bf_48%,#a78bfa_100%)] shadow-[0_0_24px_rgba(34,211,238,0.35)]"
                        animate={{ width: `${Math.max(6, Math.round(safeProgress * 100))}%` }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                      >
                        <motion.div
                          className="absolute inset-y-0 right-0 w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]"
                          animate={{ x: ['-120%', '180%'] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </motion.div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Signal</div>
                      <div className="mt-2 text-sm font-black uppercase tracking-[0.06em] text-white/84">{signalLabel}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Energy</div>
                      <div className="mt-2 text-sm font-black uppercase tracking-[0.06em] text-white/84">{energy}%</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Deck</div>
                      <div className="mt-2 text-sm font-black uppercase tracking-[0.06em] text-white/84">{phase === 'unlocking' ? 'Syncing' : 'Unlocking'}</div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.3rem] border border-white/8 bg-white/[0.025] px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/68">Live Spectrum Feed</div>
                      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Reactive</div>
                    </div>
                    <div className="flex h-[74px] items-end gap-1.5">
                      {bars.map((value, index) => (
                        <motion.div
                          key={`loading-bar-${index}`}
                          className="flex-1 rounded-t-full"
                          animate={{
                            height: `${14 + Math.max(0.14, value) * 54}px`,
                            opacity: [0.42, 0.86, 0.42],
                          }}
                          transition={{ duration: 0.86 + index * 0.04, repeat: Infinity, ease: 'easeInOut' }}
                          style={{
                            background: index % 3 === 0
                              ? 'linear-gradient(180deg, rgba(167,139,250,0.94), rgba(96,165,250,0.18))'
                              : index % 2 === 0
                                ? 'linear-gradient(180deg, rgba(45,212,191,0.95), rgba(34,211,238,0.18))'
                                : 'linear-gradient(180deg, rgba(34,211,238,0.95), rgba(45,212,191,0.16))',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
