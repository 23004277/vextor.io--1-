import React, { useMemo } from 'react';
import { BackgroundMusicVisualizerFrame } from '../Background Music';

interface MenuMusicVisualizerProps {
  snapshot: BackgroundMusicVisualizerFrame | null;
  variant?: 'panel' | 'hero';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatBreak = (seconds: number) => `${Math.max(0, Math.ceil(seconds))}s`;

const BAR_CAPS = {
  hero: 36,
  panel: 28,
} as const;

const getBarPalette = (index: number, downbeat: number, beat: number, breakActive: boolean) => {
  if (breakActive) {
    return {
      fill: 'linear-gradient(180deg, rgba(255,255,255,0.26), rgba(112,138,170,0.12))',
      glow: 'rgba(255,255,255,0.06)',
    };
  }

  if (index % 6 === 0) {
    return {
      fill: 'linear-gradient(180deg, rgba(255,224,102,0.98), rgba(45,212,191,0.62), rgba(8,20,40,0.08))',
      glow: `rgba(255,224,102,${0.12 + downbeat * 0.16})`,
    };
  }

  if (index % 2 === 0) {
    return {
      fill: 'linear-gradient(180deg, rgba(34,230,255,0.94), rgba(74,222,128,0.28), rgba(8,20,40,0.06))',
      glow: `rgba(34,230,255,${0.12 + beat * 0.14})`,
    };
  }

  return {
    fill: 'linear-gradient(180deg, rgba(167,139,250,0.92), rgba(34,230,255,0.32), rgba(8,20,40,0.06))',
    glow: `rgba(167,139,250,${0.08 + beat * 0.1})`,
  };
};

export const MenuMusicVisualizer: React.FC<MenuMusicVisualizerProps> = ({ snapshot, variant = 'panel' }) => {
  const bars = useMemo(() => {
    const source = snapshot?.bars?.length ? snapshot.bars : new Array(24).fill(0);
    return source.slice(0, BAR_CAPS[variant]);
  }, [snapshot?.bars, variant]);

  if (!snapshot) return null;

  const beat = clamp(snapshot.beatPulse ?? 0, 0, 1);
  const downbeat = clamp(snapshot.downbeatPulse ?? 0, 0, 1);
  const progress = clamp(snapshot.progress ?? 0, 0, 1);
  const breakActive = Boolean(snapshot.breakActive);
  const section = String(snapshot.section ?? 'warmup').toUpperCase();
  const sectionLabel = snapshot.sectionLabel || 'Signal Warmup';
  const runtimeLabel = breakActive ? formatBreak(snapshot.breakRemaining ?? 0) : `${snapshot.formattedCurrentTime} / ${snapshot.formattedDuration}`;

  if (variant === 'hero') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 46%, rgba(26,230,255,${0.09 + beat * 0.12}), transparent 30%),
              radial-gradient(circle at 50% 82%, rgba(17,94,89,${0.14 + downbeat * 0.08}), transparent 34%),
              linear-gradient(180deg, rgba(2,10,22,0.04), rgba(2,10,22,0.42))
            `,
          }}
        />

        <div
          className="absolute inset-x-[2.5%] top-[14%] h-[58%] rounded-[2rem] border border-cyan-300/6"
          style={{
            background: `
              linear-gradient(180deg, rgba(11,25,44,0.04), rgba(11,25,44,0.16)),
              repeating-linear-gradient(90deg, rgba(148,163,184,0.07) 0 1px, transparent 1px 58px),
              repeating-linear-gradient(0deg, rgba(148,163,184,0.055) 0 1px, transparent 1px 44px)
            `,
            boxShadow: 'inset 0 0 60px rgba(8,145,178,0.06)',
          }}
        />

        <div
          className="absolute left-1/2 top-[52%] h-[1px] w-[88%] -translate-x-1/2"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(103,232,249,${0.18 + beat * 0.12}), transparent)`,
          }}
        />

        <div
          className="absolute bottom-[12%] left-[4%] right-[4%] top-[16%] overflow-hidden"
          style={{
            maskImage: 'linear-gradient(180deg, transparent 0%, black 10%, black 84%, transparent 100%)',
          }}
        >
          <div className="flex h-full items-end gap-[0.45rem]">
            {bars.map((bar, index) => {
              const boosted = index % 4 === 0 ? downbeat * 12 : beat * 5;
              const height = clamp(20 + bar * 72 + boosted, 16, 96);
              const palette = getBarPalette(index, downbeat, beat, breakActive);

              return (
                <div key={`hero-music-bar-${index}`} className="flex h-full flex-1 items-end">
                  <div
                    className="relative w-full overflow-hidden rounded-t-[22px] transition-[height,opacity,transform] duration-75"
                    style={{
                      height: `${height}%`,
                      opacity: breakActive ? 0.16 : clamp(0.26 + bar * 0.3 + beat * 0.1, 0.22, 0.88),
                      transform: `scaleY(${breakActive ? 0.32 : 1 + beat * 0.06 + downbeat * 0.05}) translateY(${breakActive ? 18 : 0}px)`,
                      background: palette.fill,
                      boxShadow: breakActive ? 'none' : `0 0 ${8 + beat * 10 + downbeat * 14}px ${palette.glow}`,
                    }}
                  >
                    <div className="absolute inset-x-[18%] top-0 h-[26%] rounded-b-full bg-white/18 blur-[6px]" />
                    <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-slate-950/45 to-transparent" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-0 h-[34%]"
          style={{
            background: `
              radial-gradient(circle at 50% 0%, rgba(34,230,255,${0.06 + beat * 0.08}), transparent 36%),
              linear-gradient(180deg, transparent 0%, rgba(2,8,23,0.16) 18%, rgba(2,8,23,0.88) 100%)
            `,
          }}
        />

        <div className="absolute inset-x-4 bottom-4 sm:inset-x-5">
          <div className="rounded-[1.6rem] border border-cyan-300/12 bg-slate-950/58 px-3.5 py-3 shadow-[0_18px_52px_rgba(0,0,0,0.32)] backdrop-blur-[8px] sm:px-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="menu-audio-copy text-[8.5px] font-black uppercase leading-[1.25] tracking-[0.20em] text-cyan-300/78">Mainframe Audio</div>
                <div className="menu-audio-copy mt-1 text-[12px] font-black uppercase leading-[1.35] tracking-[0.08em] text-white/88">{sectionLabel}</div>
              </div>
              <div className="min-w-0 text-left sm:text-right">
                <div className="menu-audio-copy text-[8px] font-black uppercase leading-[1.25] tracking-[0.16em] text-white/38">
                  {breakActive ? 'Refresh Break' : 'Runtime'}
                </div>
                <div className="mt-1 whitespace-nowrap text-[12px] font-black tracking-[0.08em] text-cyan-50">{runtimeLabel}</div>
              </div>
            </div>

            <div className="mt-3 flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/16 bg-black/30">
                <div
                  className="absolute inset-1 rounded-full"
                  style={{
                    background: breakActive
                      ? 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 65%)'
                      : `radial-gradient(circle, rgba(34,230,255,${0.3 + beat * 0.25}), transparent 65%)`,
                    transform: `scale(${0.9 + beat * 0.2 + downbeat * 0.18})`,
                    transition: 'transform 80ms linear',
                  }}
                />
                <div
                  className="relative h-3.5 w-3.5 rounded-full"
                  style={{
                    background: breakActive ? 'rgba(255,255,255,0.34)' : '#20e6ff',
                    transform: `scale(${0.86 + beat * 0.24 + downbeat * 0.14})`,
                    boxShadow: breakActive ? 'none' : `0 0 ${11 + beat * 12 + downbeat * 12}px rgba(32,230,255,0.55)`,
                    transition: 'transform 80ms linear, box-shadow 80ms linear',
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <div
                    className="h-full rounded-full transition-[width] duration-100"
                    style={{
                      width: `${progress * 100}%`,
                      background: breakActive
                        ? 'linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.24))'
                        : 'linear-gradient(90deg, rgba(255,213,79,0.96), rgba(32,230,255,0.96), rgba(167,139,250,0.9))',
                    }}
                  />
                </div>
                <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.12em]">
                  <span className="menu-audio-copy text-white/38">Loop {Math.min((snapshot.loopCount ?? 0) + 1, 3)} / 3</span>
                  <span className="menu-audio-copy text-right text-cyan-200/76">{section}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .menu-audio-copy {
            overflow-wrap: anywhere;
            word-break: normal;
            text-wrap: pretty;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="pointer-events-none w-full">
      <div className="relative w-full overflow-hidden rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(2,8,16,0.76),rgba(1,4,10,0.92))] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background: `
              radial-gradient(circle at 50% 38%, rgba(0,210,255,${0.08 + beat * 0.1}), transparent 42%),
              linear-gradient(180deg, rgba(5,15,28,0.08), rgba(5,15,28,0.44))
            `,
          }}
        />
        <div
          className="absolute inset-x-3 top-[64px] bottom-[74px] rounded-[18px] border border-cyan-300/6"
          style={{
            background: `
              repeating-linear-gradient(90deg, rgba(148,163,184,0.05) 0 1px, transparent 1px 36px),
              linear-gradient(180deg, rgba(17,24,39,0.06), rgba(17,24,39,0.18))
            `,
          }}
        />

        <div className="relative flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="menu-audio-copy text-[9px] font-black uppercase leading-[1.25] tracking-[0.22em] text-cyan-300/82">Mainframe Audio</div>
            <div className="menu-audio-copy mt-1 text-sm font-black uppercase leading-[1.3] tracking-[0.08em] text-white/90">{sectionLabel}</div>
          </div>
          <div className="min-w-0 text-left sm:text-right">
            <div className="menu-audio-copy text-[9px] font-black uppercase leading-[1.25] tracking-[0.18em] text-white/42">
              {breakActive ? 'Refresh Break' : 'Duration'}
            </div>
            <div className="mt-1 whitespace-nowrap text-sm font-black tracking-[0.10em] text-white">{runtimeLabel}</div>
          </div>
        </div>

        <div className="relative mt-4 flex h-[92px] items-end gap-1.5 overflow-hidden rounded-[18px] px-1.5 pb-1">
          <div
            className="absolute inset-x-2 bottom-0 h-[1px]"
            style={{ background: `linear-gradient(90deg, transparent, rgba(103,232,249,${0.18 + beat * 0.12}), transparent)` }}
          />
          {bars.map((bar, index) => {
            const pulse = index % 4 === 0 ? downbeat * 8 : beat * 4;
            const height = clamp(20 + bar * 78 + pulse, 16, 96);
            const palette = getBarPalette(index, downbeat, beat, breakActive);

            return (
              <div key={`music-bar-${index}`} className="relative flex h-full flex-1 items-end">
                <div
                  className="relative w-full overflow-hidden rounded-t-[16px] transition-[height,opacity,transform] duration-100"
                  style={{
                    height: `${height}%`,
                    opacity: breakActive ? 0.26 : clamp(0.52 + bar * 0.22, 0.46, 0.94),
                    transform: `translateY(${breakActive ? 12 : 0}px) scaleY(${breakActive ? 0.42 : 1 + beat * 0.04})`,
                    background: palette.fill,
                    boxShadow: breakActive ? 'none' : `0 0 ${8 + beat * 10}px ${palette.glow}`,
                  }}
                >
                  <div className="absolute inset-x-[22%] top-0 h-[22%] rounded-b-full bg-white/15 blur-[5px]" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative mt-4 flex min-w-0 items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/18 bg-black/30">
            <div
              className="absolute inset-1 rounded-full"
              style={{
                background: breakActive
                  ? 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)'
                  : `radial-gradient(circle, rgba(0,210,255,${0.24 + beat * 0.18}), transparent 65%)`,
                transform: `scale(${0.84 + beat * 0.24})`,
                transition: 'transform 80ms linear',
              }}
            />
            <div
              className="relative h-3.5 w-3.5 rounded-full"
              style={{
                background: breakActive ? 'rgba(255,255,255,0.35)' : '#00d2ff',
                transform: `scale(${0.82 + beat * 0.28})`,
                boxShadow: breakActive ? 'none' : `0 0 ${10 + beat * 14}px rgba(0,210,255,0.5)`,
                transition: 'transform 80ms linear, box-shadow 80ms linear',
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-white/5">
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${progress * 100}%`,
                  background: breakActive
                    ? 'linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.22))'
                    : 'linear-gradient(90deg, rgba(255,213,79,0.95), rgba(0,210,255,0.95), rgba(167,139,250,0.9))',
                }}
              />
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[8px] font-black uppercase tracking-[0.14em]">
              <span className="menu-audio-copy text-white/38">Loop {Math.min((snapshot.loopCount ?? 0) + 1, 3)} / 3</span>
              <span className="menu-audio-copy text-right text-cyan-200/74">{section}</span>
            </div>
          </div>
        </div>

        <style>{`
          .menu-audio-copy {
            overflow-wrap: anywhere;
            word-break: normal;
            text-wrap: pretty;
          }
        `}</style>
      </div>
    </div>
  );
};
