export const commandCx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export const COMMAND_THEME = {
  ink: '#ecfeff',
  soft: '#a7e8f2',
  dim: 'rgba(167, 232, 242, 0.48)',
  faint: 'rgba(167, 232, 242, 0.26)',
  cyan: '#20e6ff',
  teal: '#2cffc7',
  violet: '#9f7cff',
  amber: '#ffd15c',
  rose: '#ff5f86',
  emerald: '#4ade80',
  // Back-compat aliases for menu surfaces still using the older token names.
  panel: 'linear-gradient(180deg, rgba(7, 35, 58, 0.76), rgba(2, 7, 20, 0.98))',
  panelDeep: 'linear-gradient(180deg, rgba(6,18,32,0.82), rgba(4,12,24,0.92))',
  shellBg: 'linear-gradient(180deg, rgba(5, 25, 44, 0.92), rgba(2, 8, 22, 0.97))',
  shellSoftBg: 'linear-gradient(180deg, rgba(7, 35, 58, 0.76), rgba(2, 7, 20, 0.98))',
  insetBg: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
  mutedBg: 'linear-gradient(180deg, rgba(6,18,32,0.82), rgba(4,12,24,0.92))',
  tintBg: 'linear-gradient(135deg, rgba(8, 145, 178, 0.18), rgba(15, 23, 42, 0.84))',
  border: 'rgba(56, 189, 248, 0.18)',
  borderStrong: 'rgba(45, 255, 199, 0.38)',
  overlay: 'rgba(1, 6, 16, 0.82)',
  shadow: '0 24px 80px rgba(0,0,0,0.56)',
  shadowSoft: '0 16px 36px rgba(0,0,0,0.42)',
} as const;

export const COMMAND_THEME_CLASS = {
  overlay:
    'fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(1,6,16,0.82)] backdrop-blur-2xl',
  overlaySoft:
    'fixed inset-0 z-[1000] flex items-center justify-center bg-black/72 backdrop-blur-[24px]',
  shell:
    'border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(5,25,44,0.92),rgba(2,8,22,0.97))] shadow-[0_24px_80px_rgba(0,0,0,0.56)] backdrop-blur-2xl text-cyan-50',
  shellSoft:
    'border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(7,35,58,0.76),rgba(2,7,20,0.98))] shadow-[0_16px_36px_rgba(0,0,0,0.42)] backdrop-blur-xl text-cyan-50',
  shellInset:
    'border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] text-cyan-50',
  shellMuted:
    'border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(6,18,32,0.82),rgba(4,12,24,0.92))] text-cyan-50',
  header:
    'border-b border-cyan-300/10 bg-[linear-gradient(180deg,rgba(15,35,48,0.94),rgba(8,15,24,0.84))]',
  headerSoft: 'border-b border-cyan-300/8 bg-cyan-400/[0.05]',
  footer:
    'border-t border-cyan-300/10 bg-[linear-gradient(180deg,rgba(8,15,24,0.84),rgba(15,35,48,0.94))]',
  pill: 'rounded-full border border-cyan-300/18 bg-cyan-400/10 text-cyan-100',
  pillMuted: 'rounded-full border border-cyan-300/12 bg-cyan-400/[0.06] text-cyan-100/82',
  eyebrow: 'text-[10px] font-black uppercase tracking-[0.3em] text-cyan-200/78',
  title: 'text-3xl font-black uppercase tracking-[0.08em] text-cyan-50',
  subtitle: 'text-sm font-bold uppercase tracking-[0.14em] text-cyan-100/42',
  body: 'text-sm leading-6 text-cyan-50/72',
  bodyMuted: 'text-xs font-bold uppercase tracking-[0.14em] text-cyan-100/35',
  button:
    'border border-cyan-300/18 bg-cyan-400/[0.08] text-cyan-50 hover:bg-cyan-400/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
  buttonGhost:
    'border border-cyan-300/14 bg-white/[0.03] text-cyan-100/72 hover:bg-cyan-400/[0.08] hover:text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
  buttonPrimary:
    'border border-cyan-300/24 bg-[linear-gradient(135deg,rgba(8,145,178,0.95),rgba(20,184,166,0.88) 48%,rgba(124,58,237,0.82))] text-cyan-50 shadow-[0_16px_36px_rgba(0,0,0,0.28)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70',
  buttonDanger:
    'border border-rose-300/35 bg-[linear-gradient(135deg,rgba(244,63,94,0.92),rgba(225,29,72,0.9) 50%,rgba(190,24,93,0.88))] text-white shadow-[0_10px_26px_rgba(220,38,38,0.35)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/70',
  input:
    'w-full rounded-xl border border-cyan-300/14 bg-[rgba(2,10,22,0.72)] px-4 py-3 text-cyan-50 outline-none transition placeholder:text-cyan-100/22 focus:border-cyan-300/38 focus:bg-[rgba(4,16,30,0.82)]',
  tab:
    'rounded-2xl border border-cyan-300/12 bg-white/[0.03] text-cyan-100/72 hover:border-cyan-300/22 hover:bg-cyan-400/[0.08]',
  tabActive:
    'rounded-2xl border border-cyan-200/34 bg-cyan-300/12 text-cyan-50 shadow-[0_0_0_1px_rgba(103,232,249,0.08),0_10px_26px_rgba(8,145,178,0.18)]',
  scrollArea:
    'custom-scrollbar overflow-y-auto [scrollbar-color:rgba(32,230,255,0.32)_rgba(5,18,34,0.52)] [scrollbar-width:thin]',
} as const;

export const COMMAND_ACCENTS = {
  cyan: {
    solid: '#20e6ff',
    soft: 'rgba(32, 230, 255, 0.14)',
    text: 'text-cyan-100',
    border: 'border-cyan-300/28',
    bg: 'bg-cyan-400/10',
  },
  teal: {
    solid: '#2cffc7',
    soft: 'rgba(44, 255, 199, 0.14)',
    text: 'text-teal-100',
    border: 'border-teal-300/28',
    bg: 'bg-teal-400/10',
  },
  violet: {
    solid: '#9f7cff',
    soft: 'rgba(159, 124, 255, 0.16)',
    text: 'text-violet-100',
    border: 'border-violet-300/28',
    bg: 'bg-violet-400/10',
  },
  amber: {
    solid: '#ffd15c',
    soft: 'rgba(255, 209, 92, 0.16)',
    text: 'text-amber-100',
    border: 'border-amber-300/28',
    bg: 'bg-amber-400/10',
  },
  rose: {
    solid: '#ff5f86',
    soft: 'rgba(255, 95, 134, 0.16)',
    text: 'text-rose-100',
    border: 'border-rose-300/28',
    bg: 'bg-rose-400/10',
  },
  emerald: {
    solid: '#4ade80',
    soft: 'rgba(74, 222, 128, 0.16)',
    text: 'text-emerald-100',
    border: 'border-emerald-300/28',
    bg: 'bg-emerald-400/10',
  },
} as const;
