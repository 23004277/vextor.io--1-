import React, { useMemo } from 'react';
import { BackgroundMusicVisualizerFrame } from '../Background Music';

interface MenuMusicVisualizerProps {
  snapshot: BackgroundMusicVisualizerFrame | null;
  variant?: 'panel' | 'hero';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const formatBreak = (seconds: number) => `${Math.max(0, Math.ceil(seconds))}s`;
const BAR_CAPS = { hero: 36, panel: 28 } as const;
const ZERO_HERO_BARS = Object.freeze(new Array(BAR_CAPS.hero).fill(0));
const ZERO_PANEL_BARS = Object.freeze(new Array(BAR_CAPS.panel).fill(0));
const ZERO_WAVEFORM = Object.freeze(new Array(80).fill(0));
const HERO_PARTICLE_SEEDS = Object.freeze(
  Array.from({ length: 14 }, (_, index) => ({
    angle: index * 1.73,
    ringOffset: (index + 1) / 14,
    scaleBand: (index % 3) + 1,
    even: index % 2 === 0,
    mod3: index % 3,
  })),
);

const buildWavePath = (waveform: ReadonlyArray<number>, width: number, height: number, baseline: number, amplitude: number) => {
  if (!waveform.length) return '';
  return waveform
    .map((sample, index) => {
      const x = (index / Math.max(1, waveform.length - 1)) * width;
      const y = baseline + sample * amplitude;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const getBarPalette = (index: number, bass: number, mids: number, highs: number, breakActive: boolean) => {
  if (breakActive) {
    return {
      fill: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(91,112,138,0.08))',
      glow: 'rgba(255,255,255,0.05)',
    };
  }

  if (index % 6 === 0) {
    return {
      fill: `linear-gradient(180deg, rgba(255,235,140,0.98), rgba(34,230,255,${0.34 + bass * 0.26}), rgba(7,12,24,0.05))`,
      glow: `rgba(255,214,102,${0.12 + bass * 0.28})`,
    };
  }

  if (index % 2 === 0) {
    return {
      fill: `linear-gradient(180deg, rgba(34,230,255,0.96), rgba(45,255,199,${0.24 + mids * 0.28}), rgba(8,20,40,0.06))`,
      glow: `rgba(34,230,255,${0.12 + mids * 0.18})`,
    };
  }

  return {
    fill: `linear-gradient(180deg, rgba(167,139,250,0.92), rgba(255,95,134,${0.18 + highs * 0.24}), rgba(8,20,40,0.06))`,
    glow: `rgba(167,139,250,${0.08 + highs * 0.14})`,
  };
};

export const MenuMusicVisualizer: React.FC<MenuMusicVisualizerProps> = React.memo(({ snapshot, variant = 'panel' }) => {
  const bars = useMemo(() => {
    const source = snapshot?.bars?.length
      ? snapshot.bars
      : variant === 'hero'
        ? ZERO_HERO_BARS
        : ZERO_PANEL_BARS;
    return source.slice(0, BAR_CAPS[variant]);
  }, [snapshot?.bars, variant]);

  const waveform = useMemo(() => snapshot?.waveform ?? ZERO_WAVEFORM, [snapshot?.waveform]);

  if (!snapshot) return null;

  const beat = clamp(snapshot.beatPulse ?? 0, 0, 1.6);
  const downbeat = clamp(snapshot.downbeatPulse ?? 0, 0, 1.5);
  const bass = clamp(snapshot.bass ?? 0, 0, 1);
  const mids = clamp(snapshot.mids ?? 0, 0, 1);
  const highs = clamp(snapshot.highs ?? 0, 0, 1);
  const bloom = clamp(snapshot.bloom ?? 0, 0, 1.3);
  const reactorPulse = clamp(snapshot.reactorPulse ?? 0, 0, 1.6);
  const backgroundGlow = clamp(snapshot.backgroundGlow ?? 0, 0, 1.2);
  const particleBurst = clamp(snapshot.particleBurst ?? 0, 0, 1.4);
  const scanlineIntensity = clamp(snapshot.scanlineIntensity ?? 0, 0, 1.1);
  const glitchIntensity = clamp(snapshot.glitchIntensity ?? 0, 0, 1.15);
  const uiFlicker = clamp(snapshot.uiFlicker ?? 0, 0, 1);
  const progress = clamp(snapshot.progress ?? 0, 0, 1);
  const breakActive = Boolean(snapshot.breakActive);
  const section = String(snapshot.section ?? 'idle').toUpperCase();
  const sectionLabel = snapshot.sectionLabel || 'Signal Idle';
  const runtimeLabel = breakActive ? formatBreak(snapshot.breakRemaining ?? 0) : `${snapshot.formattedCurrentTime} / ${snapshot.formattedDuration}`;

  if (variant === 'hero') {
    const heroWavePath = buildWavePath(waveform, 960, 220, 110, 48 + mids * 28 + highs * 12);
    const mirroredBars = bars.slice(0, 18);
    const particles = HERO_PARTICLE_SEEDS.map((seed) => {
      const t = seed.ringOffset;
      return {
        x: 50 + Math.cos(seed.angle) * (22 + particleBurst * 12 + t * 16),
        y: 50 + Math.sin(seed.angle) * (18 + particleBurst * 10 + t * 14),
        size: 2 + seed.scaleBand * (0.8 + highs * 1.5),
        opacity: 0.14 + highs * 0.18 + (seed.even ? particleBurst * 0.14 : mids * 0.08),
        mod3: seed.mod3,
        even: seed.even,
      };
    });

    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ contain: 'layout paint style', transform: 'translateZ(0)' }}>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 48%, rgba(34,230,255,${0.08 + backgroundGlow * 0.18}), transparent 28%),
              radial-gradient(circle at 50% 50%, rgba(255,213,79,${0.02 + bass * 0.12}), transparent 18%),
              radial-gradient(circle at 50% 84%, rgba(10,145,132,${0.06 + mids * 0.12}), transparent 36%),
              linear-gradient(180deg, rgba(2,10,22,0.02), rgba(2,10,22,0.42))
            `,
            filter: `saturate(${1 + bloom * 0.18})`,
            willChange: 'transform, opacity',
          }}
        />

        <div
          className="absolute inset-x-[3%] top-[11%] h-[54%] rounded-[2.2rem] border border-cyan-300/6"
          style={{
            background: `
              linear-gradient(180deg, rgba(10,24,40,0.05), rgba(10,24,40,0.16)),
              repeating-linear-gradient(90deg, rgba(148,163,184,${0.03 + scanlineIntensity * 0.025}) 0 1px, transparent 1px 54px),
              repeating-linear-gradient(0deg, rgba(148,163,184,${0.028 + scanlineIntensity * 0.03}) 0 1px, transparent 1px 42px)
            `,
            boxShadow: `inset 0 0 ${34 + bloom * 20}px rgba(8,145,178,${0.04 + backgroundGlow * 0.05})`,
          }}
        />

        <div className="absolute inset-x-[10%] top-[16%] h-[40%] overflow-hidden rounded-[2rem]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 960 220" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="menu-wave" x1="0" x2="1">
                <stop offset="0%" stopColor="rgba(32,230,255,0.08)" />
                <stop offset="18%" stopColor="rgba(32,230,255,0.86)" />
                <stop offset="52%" stopColor="rgba(255,213,79,0.94)" />
                <stop offset="82%" stopColor="rgba(167,139,250,0.88)" />
                <stop offset="100%" stopColor="rgba(32,230,255,0.08)" />
              </linearGradient>
            </defs>
            <path
              d={heroWavePath}
              fill="none"
              stroke="url(#menu-wave)"
              strokeWidth={2.4 + highs * 1.8}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 ${8 + highs * 8}px rgba(34,230,255,0.24))` }}
            />
            <path
              d={heroWavePath}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={0.9}
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="absolute left-[7%] right-[7%] top-[16%] h-[42%] flex items-center justify-between">
          {[mirroredBars, [...mirroredBars].reverse()].map((group, sideIndex) => (
            <div key={`mirror-${sideIndex}`} className="flex h-full w-[28%] items-center justify-between gap-[0.38rem]">
              {group.map((bar, index) => {
                const boosted = (index % 4 === 0 ? bass * 16 : mids * 8) + beat * 6;
                const length = clamp(16 + bar * 86 + boosted, 14, 96);
                const palette = getBarPalette(index + sideIndex * group.length, bass, mids, highs, breakActive);
                return (
                  <div key={`hero-side-bar-${sideIndex}-${index}`} className="flex h-full items-center">
                    <div
                      className="relative overflow-hidden rounded-full transition-[width,opacity,transform] duration-75"
                      style={{
                        width: `${length}%`,
                        height: `${7 + (index % 3) * 6}px`,
                        opacity: breakActive ? 0.18 : clamp(0.28 + bar * 0.58 + bass * 0.12, 0.26, 0.98),
                        transform: `scaleX(${1 + beat * 0.07 + (index % 3 === 0 ? bass * 0.08 : 0)})`,
                        background: palette.fill,
                        boxShadow: breakActive ? 'none' : `0 0 ${8 + bass * 8 + highs * 6}px ${palette.glow}`,
                        willChange: 'transform, opacity, width',
                      }}
                    >
                      <div className="absolute inset-y-[18%] right-0 w-[24%] rounded-full bg-white/24 blur-[4px]" />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="absolute left-1/2 top-[43%] h-[188px] w-[188px] -translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(255,213,79,${0.08 + bass * 0.22}), rgba(34,230,255,${0.08 + reactorPulse * 0.16}) 34%, rgba(0,0,0,0) 70%)`,
              transform: `scale(${1 + reactorPulse * 0.14 + downbeat * 0.08})`,
              filter: `blur(${10 + bloom * 8}px)`,
              willChange: 'transform, opacity',
            }}
          />
          {[0, 1, 2].map((ring) => (
            <div
              key={`reactor-ring-${ring}`}
              className="absolute left-1/2 top-1/2 rounded-full border"
              style={{
                width: 92 + ring * 34 + reactorPulse * 28,
                height: 92 + ring * 34 + reactorPulse * 28,
                marginLeft: `${-(92 + ring * 34 + reactorPulse * 28) / 2}px`,
                marginTop: `${-(92 + ring * 34 + reactorPulse * 28) / 2}px`,
                borderColor: ring === 0 ? `rgba(255,213,79,${0.2 + bass * 0.3})` : `rgba(34,230,255,${0.08 + backgroundGlow * 0.18 - ring * 0.03})`,
                boxShadow: `0 0 ${10 + bass * 8 + ring * 3}px rgba(34,230,255,${0.05 + bloom * 0.05})`,
                willChange: 'transform, opacity',
                transform: `scale(${1 + ring * 0.02 + downbeat * 0.05})`,
              }}
            />
          ))}
          <div className="absolute inset-[22%] rounded-full border border-cyan-200/18 bg-[radial-gradient(circle,rgba(4,20,34,0.9),rgba(2,8,20,0.94))] shadow-[inset_0_0_45px_rgba(0,0,0,0.65)]">
            <div
              className="absolute inset-[16%] rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(255,248,220,${0.28 + bass * 0.3}), rgba(255,213,79,${0.18 + bass * 0.3}) 22%, rgba(34,230,255,${0.16 + reactorPulse * 0.22}) 52%, rgba(0,0,0,0) 78%)`,
                transform: `scale(${1 + reactorPulse * 0.16 + downbeat * 0.06})`,
                boxShadow: `0 0 ${12 + bass * 10}px rgba(255,213,79,${0.18 + bass * 0.16})`,
                willChange: 'transform, opacity',
              }}
            />
            {particles.map((particle, index) => (
              <div
                key={`hero-particle-${index}`}
                className="absolute rounded-full"
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  width: particle.size,
                  height: particle.size,
                  opacity: particle.opacity,
                  background: particle.mod3 === 0 ? 'rgba(255,213,79,0.95)' : particle.even ? 'rgba(34,230,255,0.92)' : 'rgba(255,255,255,0.86)',
                  boxShadow: `0 0 ${4 + highs * 6}px currentColor`,
                  transform: `translate(-50%, -50%) scale(${1 + particleBurst * 0.25})`,
                  willChange: 'transform, opacity',
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(180deg, rgba(255,255,255,${0.008 + scanlineIntensity * 0.02}) 0 1px, transparent 1px 5px)`,
            opacity: 0.45 + scanlineIntensity * 0.12,
            mixBlendMode: 'screen',
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,${0.012 + glitchIntensity * 0.02}) 48%, transparent 52%)`,
            transform: `translateX(${(glitchIntensity - 0.35) * 6}px)`,
            opacity: 0.14 + glitchIntensity * 0.06,
          }}
        />

        <div className="absolute inset-x-4 bottom-3 z-10 sm:inset-x-5">
          <div className="rounded-[1.5rem] border border-cyan-300/12 bg-slate-950/68 px-3.5 py-2.5 shadow-[0_18px_52px_rgba(0,0,0,0.32)] backdrop-blur-[6px] sm:px-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="menu-audio-copy text-[8.5px] font-black uppercase leading-[1.25] tracking-[0.20em] text-cyan-300/78">Reactor Audio Core</div>
                <div className="menu-audio-copy mt-1 text-[12px] font-black uppercase leading-[1.35] tracking-[0.08em] text-white/88">{sectionLabel}</div>
              </div>
              <div className="min-w-0 text-left sm:text-right">
                <div className="menu-audio-copy text-[8px] font-black uppercase leading-[1.25] tracking-[0.16em] text-white/38">
                  {breakActive ? 'Refresh Break' : 'Runtime'}
                </div>
                <div className="mt-1 whitespace-nowrap text-[12px] font-black tracking-[0.08em] text-cyan-50">{runtimeLabel}</div>
              </div>
            </div>

            <div className="mt-2.5 grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/16 bg-black/30">
                <div
                  className="absolute inset-1 rounded-full"
                  style={{
                    background: breakActive
                      ? 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 65%)'
                      : `radial-gradient(circle, rgba(34,230,255,${0.22 + reactorPulse * 0.24}), transparent 65%)`,
                    transform: `scale(${0.9 + reactorPulse * 0.2})`,
                    transition: 'transform 80ms linear',
                  }}
                />
                <div
                  className="relative h-3.5 w-3.5 rounded-full"
                  style={{
                    background: breakActive ? 'rgba(255,255,255,0.34)' : '#20e6ff',
                    transform: `scale(${0.84 + reactorPulse * 0.26 + downbeat * 0.16})`,
                    boxShadow: breakActive ? 'none' : `0 0 ${8 + bass * 10 + highs * 6}px rgba(32,230,255,0.48)`,
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
                  <span className="menu-audio-copy text-white/38">Bass {Math.round(bass * 100)} · Mid {Math.round(mids * 100)} · High {Math.round(highs * 100)}</span>
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

  const panelWavePath = buildWavePath(waveform, 720, 88, 44, 18 + mids * 12 + highs * 8);

  return (
    <div className="pointer-events-none w-full">
      <div className="relative w-full overflow-hidden rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(2,8,16,0.76),rgba(1,4,10,0.92))] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-[6px]" style={{ contain: 'layout paint style', transform: 'translateZ(0)' }}>
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background: `
              radial-gradient(circle at 50% 34%, rgba(0,210,255,${0.06 + backgroundGlow * 0.12}), transparent 42%),
              radial-gradient(circle at 50% 84%, rgba(255,213,79,${0.02 + bass * 0.08}), transparent 34%),
              linear-gradient(180deg, rgba(5,15,28,0.08), rgba(5,15,28,0.44))
            `,
          }}
        />
        <div
          className="absolute inset-x-3 top-[64px] bottom-[74px] rounded-[18px] border border-cyan-300/6"
          style={{
            background: `
              repeating-linear-gradient(90deg, rgba(148,163,184,${0.034 + scanlineIntensity * 0.02}) 0 1px, transparent 1px 36px),
              linear-gradient(180deg, rgba(17,24,39,0.06), rgba(17,24,39,0.18))
            `,
          }}
        />

        <div className="relative flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="menu-audio-copy text-[9px] font-black uppercase leading-[1.25] tracking-[0.22em] text-cyan-300/82">Reactor Audio Core</div>
            <div className="menu-audio-copy mt-1 text-sm font-black uppercase leading-[1.3] tracking-[0.08em] text-white/90">{sectionLabel}</div>
          </div>
          <div className="min-w-0 text-left sm:text-right">
            <div className="menu-audio-copy text-[9px] font-black uppercase leading-[1.25] tracking-[0.18em] text-white/42">
              {breakActive ? 'Refresh Break' : 'Duration'}
            </div>
            <div className="mt-1 whitespace-nowrap text-sm font-black tracking-[0.10em] text-white">{runtimeLabel}</div>
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-[18px]">
          <svg className="absolute inset-x-1 top-[12px] h-[72px] w-[calc(100%-8px)]" viewBox="0 0 720 88" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="panel-wave" x1="0" x2="1">
                <stop offset="0%" stopColor="rgba(32,230,255,0.12)" />
                <stop offset="18%" stopColor="rgba(32,230,255,0.84)" />
                <stop offset="58%" stopColor="rgba(255,213,79,0.88)" />
                <stop offset="100%" stopColor="rgba(167,139,250,0.78)" />
              </linearGradient>
            </defs>
            <path d={panelWavePath} fill="none" stroke="url(#panel-wave)" strokeWidth={1.8 + highs * 1.2} strokeLinecap="round" />
          </svg>
          <div className="relative flex h-[92px] items-end gap-1.5 overflow-hidden px-1.5 pb-1">
            <div
              className="absolute inset-x-2 bottom-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, rgba(103,232,249,${0.18 + beat * 0.12}), transparent)` }}
            />
            {bars.map((bar, index) => {
              const pulse = index % 4 === 0 ? bass * 10 : mids * 5;
              const height = clamp(18 + bar * 78 + pulse, 16, 96);
              const palette = getBarPalette(index, bass, mids, highs, breakActive);

              return (
                <div key={`music-bar-${index}`} className="relative flex h-full flex-1 items-end">
                  <div
                    className="relative w-full overflow-hidden rounded-t-[16px] transition-[height,opacity,transform] duration-100"
                    style={{
                      height: `${height}%`,
                      opacity: breakActive ? 0.26 : clamp(0.44 + bar * 0.3 + uiFlicker * 0.08, 0.4, 0.95),
                      transform: `translateY(${breakActive ? 12 : 0}px) scaleY(${breakActive ? 0.42 : 1 + beat * 0.04})`,
                      background: palette.fill,
                      boxShadow: breakActive ? 'none' : `0 0 ${6 + bass * 7 + highs * 5}px ${palette.glow}`,
                      willChange: 'transform, opacity, height',
                    }}
                  >
                    <div className="absolute inset-x-[22%] top-0 h-[22%] rounded-b-full bg-white/15 blur-[5px]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative mt-4 flex min-w-0 items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/18 bg-black/30">
            <div
              className="absolute inset-1 rounded-full"
              style={{
                background: breakActive
                  ? 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)'
                  : `radial-gradient(circle, rgba(0,210,255,${0.22 + reactorPulse * 0.18}), transparent 65%)`,
                transform: `scale(${0.84 + reactorPulse * 0.2})`,
                transition: 'transform 80ms linear',
              }}
            />
            <div
              className="relative h-3.5 w-3.5 rounded-full"
              style={{
                background: breakActive ? 'rgba(255,255,255,0.35)' : '#00d2ff',
                transform: `scale(${0.82 + reactorPulse * 0.24})`,
                boxShadow: breakActive ? 'none' : `0 0 ${8 + bass * 8}px rgba(0,210,255,0.42)`,
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
              <span className="menu-audio-copy text-white/38">Bass {Math.round(bass * 100)} · Mid {Math.round(mids * 100)} · High {Math.round(highs * 100)}</span>
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
});

