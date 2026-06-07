import React, { useMemo } from 'react';
import { BackgroundMusicVisualizerFrame } from '../Background Music';

interface MenuMusicVisualizerProps {
  snapshot: BackgroundMusicVisualizerFrame | null;
  variant?: 'panel' | 'hero';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatBreak = (seconds: number) => `${Math.max(0, Math.ceil(seconds))}s`;

export const MenuMusicVisualizer: React.FC<MenuMusicVisualizerProps> = ({ snapshot, variant = 'panel' }) => {
  const bars = useMemo(() => {
    const source = snapshot?.bars?.length ? snapshot.bars : new Array(24).fill(0);
    return source.slice(0, variant === 'hero' ? 36 : 28);
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
            background: `radial-gradient(circle at 50% 50%, rgba(32,230,255,${0.07 + beat * 0.1}), transparent 58%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background: breakActive
              ? 'transparent'
              : `radial-gradient(circle at 50% 70%, rgba(255,213,92,${downbeat * 0.12}), transparent 30%)`,
          }}
        />

        <div className="absolute inset-x-4 inset-y-3 opacity-[0.22]">
          <div className="flex h-full items-end gap-1.5">
            {bars.map((bar, index) => {
              const boosted = index % 4 === 0 ? downbeat * 14 : beat * 6;
              const height = clamp(24 + bar * 82 + boosted, 18, 100);

              return (
                <div key={`hero-music-bar-${index}`} className="flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[18px] transition-[height,opacity,transform] duration-75"
                    style={{
                      height: `${height}%`,
                      opacity: breakActive ? 0.12 : clamp(0.22 + bar * 0.34 + beat * 0.1, 0.2, 0.74),
                      transform: `scaleY(${breakActive ? 0.32 : 1 + beat * 0.05 + downbeat * 0.04}) translateY(${breakActive ? 18 : 0}px)`,
                      background:
                        index % 4 === 0
                          ? 'linear-gradient(180deg, rgba(255,223,94,0.92), rgba(33,230,255,0.38))'
                          : index % 2 === 0
                            ? 'linear-gradient(180deg, rgba(33,230,255,0.90), rgba(45,212,191,0.28))'
                            : 'linear-gradient(180deg, rgba(167,139,250,0.86), rgba(33,230,255,0.18))',
                      boxShadow: breakActive ? 'none' : `0 0 ${8 + (index % 4 === 0 ? downbeat * 26 : beat * 16)}px rgba(33,230,255,0.14)`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-[#020817]/78 via-[#020817]/30 to-transparent" />

        <div className="absolute inset-x-4 bottom-4 sm:inset-x-5">
          <div className="rounded-2xl border border-cyan-300/12 bg-slate-950/58 px-3.5 py-3 shadow-[0_14px_42px_rgba(0,0,0,0.25)] backdrop-blur-[6px] sm:px-4">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/16 bg-black/30">
                <div
                  className="h-3.5 w-3.5 rounded-full"
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
      <div className="relative w-full overflow-hidden rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(2,8,16,0.74),rgba(1,4,10,0.88))] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(circle at 50% 55%, rgba(0,210,255,${0.07 + beat * 0.08}), transparent 58%)`,
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

        <div className="relative mt-4 flex h-16 items-end gap-1.5">
          {bars.map((bar, index) => (
            <div key={`music-bar-${index}`} className="flex-1 rounded-full bg-white/5">
              <div
                className="w-full rounded-full transition-[height,opacity,transform] duration-100"
                style={{
                  height: `${clamp(bar * 72, 10, 100)}%`,
                  opacity: breakActive ? 0.28 : clamp(0.58 + bar * 0.18, 0.48, 0.92),
                  transform: `translateY(${breakActive ? 14 : 0}px) scaleY(${breakActive ? 0.36 : 1})`,
                  background:
                    index % 4 === 0
                      ? 'linear-gradient(180deg, rgba(255,223,94,0.95), rgba(0,210,255,0.72))'
                      : 'linear-gradient(180deg, rgba(108,242,255,0.94), rgba(0,89,255,0.50))',
                  boxShadow: breakActive ? 'none' : `0 0 ${8 + beat * 10}px rgba(0,210,255,0.18)`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative mt-4 flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/18 bg-black/30">
            <div
              className="h-3.5 w-3.5 rounded-full"
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
                    : 'linear-gradient(90deg, rgba(255,213,79,0.95), rgba(0,210,255,0.95))',
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
