import React from 'react';
import { BackgroundMusicVisualizerFrame } from '../Background Music';

interface MenuMusicVisualizerProps {
  snapshot: BackgroundMusicVisualizerFrame | null;
  variant?: 'panel' | 'hero';
}

export const MenuMusicVisualizer: React.FC<MenuMusicVisualizerProps> = ({ snapshot, variant = 'panel' }) => {
  if (!snapshot) return null;

  if (variant === 'hero') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(0,210,255,${0.08 + snapshot.beatPulse * 0.1}), transparent 58%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background: snapshot.breakActive
              ? 'transparent'
              : `radial-gradient(circle at 50% 68%, rgba(255,215,92,${snapshot.downbeatPulse * 0.12}), transparent 28%)`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 top-0 opacity-[0.14]">
          <div className="flex h-full items-end gap-2 px-6 pb-5">
            {snapshot.bars.map((bar, index) => (
              <div key={`hero-music-bar-${index}`} className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[18px] transition-[height,opacity,transform] duration-100"
                  style={{
                    height: `${Math.max(10, Math.min(94, 10 + bar * 76 + (index % 4 === 0 ? snapshot.downbeatPulse * 12 : snapshot.beatPulse * 4)))}%`,
                    opacity: snapshot.breakActive ? 0.16 : 0.24 + Math.min(0.48, bar * 0.28 + (index % 4 === 0 ? snapshot.downbeatPulse * 0.14 : snapshot.beatPulse * 0.06)),
                    transform: `scaleY(${snapshot.breakActive ? 0.35 : 1 + snapshot.beatPulse * 0.045}) translateY(${snapshot.breakActive ? 18 : 0}px)`,
                    background: index % 4 === 0
                      ? 'linear-gradient(180deg, rgba(255,223,94,0.92), rgba(33,230,255,0.4))'
                      : index % 2 === 0
                        ? 'linear-gradient(180deg, rgba(33,230,255,0.92), rgba(45,212,191,0.3))'
                        : 'linear-gradient(180deg, rgba(167,139,250,0.9), rgba(33,230,255,0.22))',
                    boxShadow: snapshot.breakActive
                      ? 'none'
                      : index % 4 === 0
                        ? `0 0 ${10 + snapshot.downbeatPulse * 28}px rgba(255,223,94,0.2)`
                        : `0 0 ${8 + snapshot.beatPulse * 18}px rgba(33,230,255,0.16)`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-6 bottom-5">
          <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/34 px-4 py-3 backdrop-blur-[3px]">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/78">Mainframe Audio</div>
                <div className="mt-1 break-words text-sm font-black uppercase tracking-[0.12em] text-white/86">{snapshot.sectionLabel}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/34">
                  {snapshot.breakActive ? 'Refresh Break' : 'Runtime'}
                </div>
                <div className="mt-1 text-sm font-black tracking-[0.12em] text-cyan-50">
                  {snapshot.breakActive
                    ? `${Math.ceil(snapshot.breakRemaining)}s`
                    : `${snapshot.formattedCurrentTime} / ${snapshot.formattedDuration}`}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/14 bg-black/28">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{
                    background: snapshot.breakActive ? 'rgba(255,255,255,0.34)' : '#20e6ff',
                    transform: `scale(${0.88 + snapshot.beatPulse * 0.24 + snapshot.downbeatPulse * 0.14})`,
                    boxShadow: snapshot.breakActive ? 'none' : `0 0 ${12 + snapshot.beatPulse * 12 + snapshot.downbeatPulse * 12}px rgba(32,230,255,0.55)`,
                    transition: 'transform 80ms linear, box-shadow 80ms linear',
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <div
                    className="h-full rounded-full transition-[width] duration-100"
                    style={{
                      width: `${Math.max(0, Math.min(100, snapshot.progress * 100))}%`,
                      background: snapshot.breakActive
                        ? 'linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.24))'
                        : 'linear-gradient(90deg, rgba(255,213,79,0.96), rgba(32,230,255,0.96), rgba(167,139,250,0.9))',
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em]">
                  <span className="text-white/36">Loop {Math.min(snapshot.loopCount + 1, 3)} / 3</span>
                  <span className="text-cyan-200/74">{snapshot.section.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none w-full">
      <div className="relative w-full overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(2,8,16,0.72),rgba(1,4,10,0.84))] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-md">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(circle at 50% 55%, rgba(0,210,255,${0.08 + snapshot.beatPulse * 0.08}), transparent 56%)`,
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-300/80">Mainframe Audio</div>
            <div className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white/90">{snapshot.sectionLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">
              {snapshot.breakActive ? 'Refresh Break' : 'Duration'}
            </div>
            <div className="mt-1 text-sm font-black tracking-[0.14em] text-white">
              {snapshot.breakActive
                ? `${Math.ceil(snapshot.breakRemaining)}s`
                : `${snapshot.formattedCurrentTime} / ${snapshot.formattedDuration}`}
            </div>
          </div>
        </div>

        <div className="relative mt-4 flex h-20 items-end gap-1.5">
          {snapshot.bars.map((bar, index) => (
            <div key={`music-bar-${index}`} className="flex-1 rounded-full bg-white/5">
              <div
                className="w-full rounded-full transition-[height,opacity,transform] duration-100"
                style={{
                  height: `${Math.max(10, Math.min(100, bar * 72))}%`,
                  opacity: snapshot.breakActive ? 0.28 : 0.62 + Math.min(0.32, bar * 0.18),
                  transform: `translateY(${snapshot.breakActive ? 16 : 0}px) scaleY(${snapshot.breakActive ? 0.35 : 1})`,
                  background: index % 4 === 0
                    ? 'linear-gradient(180deg, rgba(255,223,94,0.95), rgba(0,210,255,0.75))'
                    : 'linear-gradient(180deg, rgba(108,242,255,0.95), rgba(0,89,255,0.55))',
                  boxShadow: snapshot.breakActive
                    ? 'none'
                    : `0 0 ${8 + snapshot.beatPulse * 10}px rgba(0,210,255,0.18)`,
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative mt-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/18 bg-black/30">
            <div
              className="h-3.5 w-3.5 rounded-full"
              style={{
                background: snapshot.breakActive ? 'rgba(255,255,255,0.35)' : '#00d2ff',
                transform: `scale(${0.82 + snapshot.beatPulse * 0.28})`,
                boxShadow: snapshot.breakActive ? 'none' : `0 0 ${10 + snapshot.beatPulse * 14}px rgba(0,210,255,0.5)`,
                transition: 'transform 80ms linear, box-shadow 80ms linear',
              }}
            />
          </div>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-white/5">
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${Math.max(0, Math.min(100, snapshot.progress * 100))}%`,
                  background: snapshot.breakActive
                    ? 'linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.22))'
                    : 'linear-gradient(90deg, rgba(255,213,79,0.95), rgba(0,210,255,0.95))',
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em]">
              <span className="text-white/34">Loop {Math.min(snapshot.loopCount + 1, 3)} / 3</span>
              <span className="text-cyan-200/72">{snapshot.section.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
