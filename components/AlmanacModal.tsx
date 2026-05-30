import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    Activity,
    Aperture,
    Box,
    ChevronRight,
    Cpu,
    Crown,
    Database,
    Eye,
    Info,
    Lock,
    Search,
    Shield,
    Skull,
    Sparkles,
    Target,
    X,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { ShapeRarity, ShapeType, StatType, TankClass } from '../types';
import { BOSS_STATS, RARITY_CONFIG, SHAPE_STATS, TANK_CONFIGS } from '../constants';
import { ShapePreview } from './ShapePreview';
import { TankPreview } from './TankPreview';

// ─── Injected styles ────────────────────────────────────────────────────────
const ALMANAC_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

.vx-modal, .vx-modal * { font-family: 'Rajdhani', sans-serif; }
.vx-mono  { font-family: 'Space Mono', monospace !important; }

.vx-scanlines {
    background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0,0,0,0.1) 3px,
        rgba(0,0,0,0.1) 4px
    );
    pointer-events: none;
    z-index: 1;
}

.vx-sweep {
    position: relative;
    overflow: hidden;
}
.vx-sweep::before {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 140px;
    background: linear-gradient(180deg, transparent, rgba(251,191,36,0.025), transparent);
    animation: vx-sweep 5s linear infinite;
    pointer-events: none;
    z-index: 0;
}
@keyframes vx-sweep {
    0%   { top: -140px; opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
}

@keyframes vx-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
}
.vx-blink { animation: vx-blink 1.1s step-end infinite; }

@keyframes vx-data-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
}
.vx-data-in { animation: vx-data-in 0.28s cubic-bezier(0.16,1,0.3,1) both; }

.vx-bracket { position: relative; }
.vx-bracket::before, .vx-bracket::after { content: ''; position: absolute; width: 10px; height: 10px; pointer-events: none; }
.vx-bracket::before { top: 0; left: 0; border-top: 1.5px solid currentColor; border-left: 1.5px solid currentColor; }
.vx-bracket::after  { bottom: 0; right: 0; border-bottom: 1.5px solid currentColor; border-right: 1.5px solid currentColor; }

.vx-card-hover { transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s, background-color 0.18s; }
.vx-card-hover:hover { transform: translateY(-3px); }

.vx-compact .vx-card-hover { padding: 0.85rem !important; }
.vx-compact .vx-card-hover p { line-height: 1.35 !important; }
.vx-compact [class*='space-y-10'] { row-gap: 1.5rem; }

.vx-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(251,191,36,0.55) rgba(255,255,255,0.055); }
.vx-scrollbar::-webkit-scrollbar { width: 11px; height: 11px; }
.vx-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.045); border-radius: 999px; }
.vx-scrollbar::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(251,191,36,0.78), rgba(34,211,238,0.52));
    border: 3px solid rgba(3,5,8,0.92);
    border-radius: 999px;
}
.vx-scrollbar::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, rgba(251,191,36,0.95), rgba(34,211,238,0.74)); }
.vx-scrollbar-light { scrollbar-width: thin; scrollbar-color: rgba(15,23,42,0.32) rgba(15,23,42,0.08); }
.vx-scrollbar-light::-webkit-scrollbar { width: 11px; height: 11px; }
.vx-scrollbar-light::-webkit-scrollbar-track { background: rgba(15,23,42,0.08); border-radius: 999px; }
.vx-scrollbar-light::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.28); border: 3px solid rgba(248,250,252,0.96); border-radius: 999px; }
.vx-scrollbar-light::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.42); }

.vx-no-scrollbar { scrollbar-width: none; }
.vx-no-scrollbar::-webkit-scrollbar { display: none; }

.vx-grid-bg {
    background-image:
        linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 44px 44px;
}

.vx-noise::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.045;
    pointer-events: none;
    background-image: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9) 0 1px, transparent 1px);
    background-size: 18px 18px;
    mix-blend-mode: screen;
}

@media (prefers-reduced-motion: reduce) {
    .vx-sweep::before, .vx-blink, .vx-data-in { animation: none !important; }
    .vx-card-hover, .vx-card-hover:hover { transform: none !important; }
}
`;

// ─── Types ───────────────────────────────────────────────────────────────────
interface AlmanacModalProps {
    onClose: () => void;
    darkMode: boolean;
    playSound?: () => void;
}

type MainCategory = 'RESOURCES' | 'CHASSIS' | 'BOSSES' | 'THREATS' | 'VOID' | 'ABILITIES';

type CategoryMeta = {
    id: MainCategory;
    label: string;
    shortLabel: string;
    subtitle: string;
    icon: LucideIcon;
    tone: 'cyan' | 'blue' | 'amber' | 'red' | 'purple' | 'emerald';
};

type ToneStyle = {
    text: string;
    softText: string;
    bg: string;
    bgStrong: string;
    border: string;
    borderStrong: string;
    glow: string;
    line: string;
    button: string;
    buttonText: string;
    shadow: string;
    hex: string;
};

type ClassRole  = { label: string; desc: string; classes: TankClass[]; icon: LucideIcon; };
type BossStatView = { id: string; name: string; description: string; health: number; xp: number; damage?: number; radius?: number; };
type TraitCard  = { name: string; key: string; desc: string; icon: LucideIcon; };

// ─── Tone palette ─────────────────────────────────────────────────────────────
const TONE: Record<CategoryMeta['tone'], ToneStyle> = {
    cyan: {
        text: 'text-cyan-400', softText: 'text-cyan-400/55',
        bg: 'bg-cyan-400/[0.07]', bgStrong: 'bg-cyan-400',
        border: 'border-cyan-400/25', borderStrong: 'border-cyan-400/75',
        glow: 'shadow-cyan-400/20',
        line: 'from-cyan-400 via-cyan-400/20 to-transparent',
        button: 'bg-cyan-400/10 hover:bg-cyan-400/[0.16]', buttonText: 'text-cyan-300',
        shadow: 'shadow-[0_0_20px_rgba(34,211,238,0.22)]',
        hex: '#22d3ee',
    },
    blue: {
        text: 'text-blue-400', softText: 'text-blue-400/55',
        bg: 'bg-blue-400/[0.07]', bgStrong: 'bg-blue-400',
        border: 'border-blue-400/25', borderStrong: 'border-blue-400/75',
        glow: 'shadow-blue-400/20',
        line: 'from-blue-400 via-blue-400/20 to-transparent',
        button: 'bg-blue-400/10 hover:bg-blue-400/[0.16]', buttonText: 'text-blue-300',
        shadow: 'shadow-[0_0_20px_rgba(96,165,250,0.22)]',
        hex: '#60a5fa',
    },
    amber: {
        text: 'text-amber-400', softText: 'text-amber-400/55',
        bg: 'bg-amber-400/[0.07]', bgStrong: 'bg-amber-400',
        border: 'border-amber-400/25', borderStrong: 'border-amber-400/75',
        glow: 'shadow-amber-400/20',
        line: 'from-amber-400 via-amber-400/20 to-transparent',
        button: 'bg-amber-400/10 hover:bg-amber-400/[0.16]', buttonText: 'text-amber-300',
        shadow: 'shadow-[0_0_20px_rgba(251,191,36,0.22)]',
        hex: '#fbbf24',
    },
    red: {
        text: 'text-red-400', softText: 'text-red-400/55',
        bg: 'bg-red-400/[0.07]', bgStrong: 'bg-red-400',
        border: 'border-red-400/25', borderStrong: 'border-red-400/75',
        glow: 'shadow-red-400/20',
        line: 'from-red-400 via-red-400/20 to-transparent',
        button: 'bg-red-400/10 hover:bg-red-400/[0.16]', buttonText: 'text-red-300',
        shadow: 'shadow-[0_0_20px_rgba(248,113,113,0.22)]',
        hex: '#f87171',
    },
    purple: {
        text: 'text-purple-400', softText: 'text-purple-400/55',
        bg: 'bg-purple-400/[0.07]', bgStrong: 'bg-purple-400',
        border: 'border-purple-400/25', borderStrong: 'border-purple-400/75',
        glow: 'shadow-purple-400/20',
        line: 'from-purple-400 via-purple-400/20 to-transparent',
        button: 'bg-purple-400/10 hover:bg-purple-400/[0.16]', buttonText: 'text-purple-300',
        shadow: 'shadow-[0_0_20px_rgba(192,132,252,0.22)]',
        hex: '#c084fc',
    },
    emerald: {
        text: 'text-emerald-400', softText: 'text-emerald-400/55',
        bg: 'bg-emerald-400/[0.07]', bgStrong: 'bg-emerald-400',
        border: 'border-emerald-400/25', borderStrong: 'border-emerald-400/75',
        glow: 'shadow-emerald-400/20',
        line: 'from-emerald-400 via-emerald-400/20 to-transparent',
        button: 'bg-emerald-400/10 hover:bg-emerald-400/[0.16]', buttonText: 'text-emerald-300',
        shadow: 'shadow-[0_0_20px_rgba(52,211,153,0.22)]',
        hex: '#34d399',
    },
};

// ─── Static data ──────────────────────────────────────────────────────────────
const CATEGORIES: CategoryMeta[] = [
    { id: 'RESOURCES', label: 'Shape Archives',       shortLabel: 'Shapes',      subtitle: 'Resource values, rarity rolls, and farming targets.',         icon: Box,     tone: 'cyan'    },
    { id: 'CHASSIS',   label: 'Chassis Database',     shortLabel: 'Chassis',     subtitle: 'Tank roles, class families, and weapon identities.',           icon: Shield,  tone: 'blue'    },
    { id: 'BOSSES',    label: 'Commander Protocols',  shortLabel: 'Commanders',  subtitle: 'Rebirth titans and endgame chassis reports.',                  icon: Crown,   tone: 'amber'   },
    { id: 'THREATS',   label: 'Threat Index',         shortLabel: 'Threats',     subtitle: 'Boss entities, elite incursions, and hostile automata.',       icon: Skull,   tone: 'red'     },
    { id: 'VOID',      label: 'Void Research',        shortLabel: 'Void',        subtitle: 'Rift behaviour, instability, and boosted resource fields.',    icon: Aperture,tone: 'purple'  },
    { id: 'ABILITIES', label: 'Tactical Traits',      shortLabel: 'Traits',      subtitle: 'Class passives, key abilities, and build synergies.',          icon: Cpu,     tone: 'emerald' },
];

const SHAPE_STRATEGIES: Record<ShapeType, string[]> = {
    [ShapeType.SQUARE]:   ['Starter farm target', 'Low durability', 'Safe early XP chain'],
    [ShapeType.TRIANGLE]: ['Drifts faster than squares', 'Lead shots slightly', 'Good early-mid payout'],
    [ShapeType.PENTAGON]: ['Tanky resource core', 'Central farming priority', 'Strong level 30+ XP source'],
    [ShapeType.HEXAGON]:  ['High integrity shell', 'Rewards sustained DPS', 'Great for upgraded builds'],
    [ShapeType.OCTAGON]:  ['Ancient relic target', 'Massive XP jackpot', 'Contestable high-value spawn'],
};

const CLASS_ROLES: Record<string, ClassRole> = {
    ASSAULT:   { label: 'Frontline Combatants',  desc: 'Bullet-density classes that win by flooding lanes, suppressing movement, and forcing mistakes.',                              classes: [TankClass.TWIN, TankClass.TRIPLE_SHOT, TankClass.PENTA_SHOT, TankClass.SPREAD_SHOT, TankClass.TRIPLE_TWIN],       icon: Zap     },
    PRECISION: { label: 'Long-Range Interceptors',desc: 'High-velocity classes that punish bad positioning and delete fragile targets from range.',                                   classes: [TankClass.SNIPER, TankClass.ASSASSIN, TankClass.RANGER, TankClass.STALKER, TankClass.HUNTER],                   icon: Target  },
    IMPACT:    { label: 'Heavy Ordnance',          desc: 'Huge projectile classes with intimidating burst damage, recoil movement, and area denial.',                                 classes: [TankClass.MACHINE_GUN, TankClass.DESTROYER, TankClass.ANNIHILATOR, TankClass.HYBRID, TankClass.SPRAYER],         icon: Activity},
    TACTICAL:  { label: 'Advanced Command',        desc: 'Drone, turret, and control classes that dominate space through positioning and unit management.',                           classes: [TankClass.OVERSEER, TankClass.OVERLORD, TankClass.MANAGER, TankClass.OCTO_TANK, TankClass.AUTO_GUNNER],          icon: Cpu     },
};

const BOSS_TANK_DATA: Record<string, ClassRole> = {
    COMMANDERS: { label: 'Rebirth Titans', desc: 'Massive level-60 chassis that trade mobility for absurd zone control, durability, and pressure.', classes: [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD], icon: Crown },
};

const TACTICAL_TRAITS: TraitCard[] = [
    { name: 'Sacrificial Goat', key: 'RMB / Right-Click', desc: 'Overlord and Manager classes can convert 50% current health into an aggressive combat state, heavily boosting drone pressure.', icon: Activity },
    { name: 'Goliath Recoil',   key: 'Passive',           desc: 'Destroyer and Annihilator chassis use extreme recoil as both a weapon drawback and a movement tool.',                          icon: Zap      },
    { name: 'Void Sync',        key: 'Dimensional',       desc: 'Void rifts boost rarity rolls dramatically, but the environment becomes unstable and harder to safely farm.',                   icon: Aperture },
    { name: 'Siege Mode',       key: 'Key [X]',           desc: 'Warlord anchors into the grid, losing movement while gaining massive defensive and offensive pressure.',                        icon: Shield   },
    { name: 'Shockwave',        key: 'Titan Passive',     desc: 'Leviathan periodically emits a pulse that helps deny close-range enemies and incoming projectile pressure.',                    icon: Sparkles },
    { name: 'Rebirth Protocol', key: 'Level 60',          desc: 'Reset your level to gain access to Titan-class chassis and late-game commander mechanics.',                                     icon: Crown    },
];

const RARITY_STYLE: Partial<Record<ShapeRarity, { text: string; bg: string; border: string; hex: string }>> = {
    [ShapeRarity.COMMON]:       { text: 'text-slate-300',   bg: 'bg-slate-400/10',  border: 'border-slate-400/20',  hex: '#94a3b8' },
    [ShapeRarity.UNCOMMON]:     { text: 'text-cyan-300',    bg: 'bg-cyan-400/10',   border: 'border-cyan-400/25',   hex: '#22d3ee' },
    [ShapeRarity.RARE]:         { text: 'text-green-300',   bg: 'bg-green-400/10',  border: 'border-green-400/25',  hex: '#4ade80' },
    [ShapeRarity.EPIC]:         { text: 'text-amber-300',   bg: 'bg-amber-400/10',  border: 'border-amber-400/25',  hex: '#fbbf24' },
    [ShapeRarity.LEGENDARY]:    { text: 'text-orange-300',  bg: 'bg-orange-400/10', border: 'border-orange-400/25', hex: '#fb923c' },
    [ShapeRarity.MYTHICAL]:     { text: 'text-indigo-300',  bg: 'bg-indigo-400/10', border: 'border-indigo-400/25', hex: '#818cf8' },
    [ShapeRarity.ETERNAL]:      { text: 'text-sky-200',     bg: 'bg-sky-400/10',    border: 'border-sky-300/25',    hex: '#7dd3fc' },
    [ShapeRarity.TRANSCENDENT]: { text: 'text-white',       bg: 'bg-white/10',      border: 'border-white/30',      hex: '#ffffff' },
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const formatLabel    = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
const formatTankName = (tc: TankClass) => String(tc).replace(/ Tank$/i, '').replace(/_/g, ' ');
const getShapePreviewType = (key: string): ShapeType => {
    const values = ShapeType as unknown as Record<string, ShapeType>;
    if (key === 'alpha_pentagon')   return values.ALPHA_PENTAGON    ?? ShapeType.PENTAGON;
    if (key === 'grand_singularity') return values.GRAND_SINGULARITY ?? ShapeType.OCTAGON;
    return ShapeType.PENTAGON;
};
const VOID_PORTAL_PREVIEW = ((ShapeType as unknown as Record<string, ShapeType>).VOID_PORTAL ?? ShapeType.OCTAGON) as ShapeType;
const getTankComplexity = (tc: TankClass) => {
    const n = TANK_CONFIGS[tc]?.length ?? 1;
    if (n >= 6) return 5; if (n >= 4) return 4; if (n >= 3) return 3; if (n >= 2) return 2; return 1;
};
const getRarityStyle = (r: ShapeRarity) =>
    RARITY_STYLE[r] ?? { text: 'text-slate-300', bg: 'bg-slate-400/10', border: 'border-slate-400/20', hex: '#94a3b8' };
const normalizeSearch = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const matchesSearch = (query: string, ...fields: Array<string | number | undefined | null>) => {
    if (!query) return true;
    const haystack = fields.map(v => String(v ?? '')).join(' ').toLowerCase().replace(/[\s_-]+/g, ' ');
    return haystack.includes(query);
};
const countClasses = (roles: Record<string, ClassRole>) => Object.values(roles).reduce((sum, role) => sum + role.classes.length, 0);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Flat-surface card panel */
const CardShell: React.FC<{ children: React.ReactNode; darkMode: boolean; className?: string; style?: React.CSSProperties }> = ({ children, darkMode, className = '', style }) => (
    <div style={style} className={`min-w-0 rounded-lg border transition-colors ${darkMode ? 'border-white/10 bg-[#0b0d14]' : 'border-slate-300/70 bg-white/90'} ${className}`}>
        {children}
    </div>
);

/** Compact category badge / pill */
const DataPill: React.FC<{ children: React.ReactNode; tone: ToneStyle; className?: string }> = ({ children, tone, className = '' }) => (
    <span className={`vx-mono inline-flex max-w-full items-center gap-2 rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${tone.bg} ${tone.border} ${tone.text} ${className}`}>
        {children}
    </span>
);

/** Stat value box */
const StatPanel: React.FC<{ label: string; value: React.ReactNode; tone: ToneStyle; darkMode: boolean; icon?: LucideIcon }> = ({ label, value, tone, darkMode, icon: Icon }) => (
    <div className={`min-w-0 rounded-md border p-3 ${darkMode ? 'border-white/8 bg-black/40' : 'border-slate-200 bg-slate-50'}`}>
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
            {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.text}`} />}
            <span className={`vx-mono truncate text-[9px] font-bold uppercase tracking-[0.24em] ${darkMode ? 'text-white/30' : 'text-slate-400'}`}>{label}</span>
        </div>
        <div className={`vx-mono min-w-0 break-words text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{value}</div>
    </div>
);

/** Section header with icon + accent rule */
const SectionTitle: React.FC<{ icon: LucideIcon; title: string; eyebrow: string; desc?: string; tone: ToneStyle; darkMode: boolean }> = ({ icon: Icon, title, eyebrow, desc, tone, darkMode }) => (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${tone.bg} ${tone.border}`}>
            <Icon className={`h-5 w-5 ${tone.text}`} />
        </div>
        <div className="min-w-0 flex-1">
            <p className={`vx-mono mb-1 text-[9px] font-bold uppercase tracking-[0.36em] ${tone.softText}`}>{eyebrow}</p>
            <h3 className={`break-words text-2xl font-bold uppercase italic tracking-tight sm:text-3xl ${darkMode ? 'text-white' : 'text-slate-950'}`}>{title}</h3>
            {desc && <p className={`mt-2 max-w-3xl text-sm leading-6 font-medium ${darkMode ? 'text-white/40' : 'text-slate-500'}`}>{desc}</p>}
        </div>
        <div className={`hidden h-px min-w-[100px] flex-1 bg-gradient-to-r ${tone.line} lg:block`} />
    </div>
);

/** Sidebar navigation button */
const CategoryButton: React.FC<{ category: CategoryMeta; isActive: boolean; darkMode: boolean; onClick: () => void }> = ({ category, isActive, darkMode, onClick }) => {
    const Icon = category.icon;
    const tone = TONE[category.tone];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex min-w-0 w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all duration-150
                ${isActive
                    ? `${tone.bg} ${tone.borderStrong} ${tone.shadow}`
                    : darkMode
                        ? 'border-transparent text-white/40 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/80'
                        : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-800'}`}
        >
            {isActive && (
                <motion.span
                    layoutId="almanac-rail"
                    className={`absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 ${tone.bgStrong}`}
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                />
            )}
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border ${isActive ? `${tone.bg} ${tone.border}` : darkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                <Icon className={`h-4 w-4 ${isActive ? tone.text : 'text-current'}`} />
            </span>
            <span className="hidden min-w-0 flex-1 lg:block">
                <span className={`block truncate text-[11px] font-bold uppercase tracking-[0.2em] ${isActive ? tone.text : ''}`}>{category.shortLabel}</span>
                <span className={`mt-0.5 block truncate text-[9px] font-medium ${darkMode ? 'text-white/22' : 'text-slate-400'}`}>{category.subtitle}</span>
            </span>
        </button>
    );
};


const NoResults: React.FC<{ query: string; tone: ToneStyle; darkMode: boolean; onClear: () => void }> = ({ query, tone, darkMode, onClear }) => (
    <CardShell darkMode={darkMode} className="flex min-h-[280px] items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-md border ${tone.bg} ${tone.border}`}>
                <Search className={`h-6 w-6 ${tone.text}`} />
            </div>
            <div>
                <h3 className={`text-2xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>No Intel Found</h3>
                <p className={`mt-2 text-sm font-medium leading-6 ${darkMode ? 'text-white/42' : 'text-slate-500'}`}>
                    Nothing matched <span className={tone.text}>"{query}"</span> in this section. Clear the filter or try a class, rarity, boss, trait, or resource name.
                </p>
            </div>
            <button
                type="button"
                onClick={onClear}
                className={`rounded-md border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] transition-all ${tone.button} ${tone.border} ${tone.buttonText}`}
            >
                Clear Search
            </button>
        </div>
    </CardShell>
);

const AlmanacOverview: React.FC<{
    darkMode: boolean;
    tone: ToneStyle;
    activeMeta: CategoryMeta;
    searchQuery: string;
    compactMode: boolean;
    onToggleCompact: () => void;
}> = ({ darkMode, tone, activeMeta, searchQuery, compactMode, onToggleCompact }) => (
    <div className={`mb-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]`}>
        <CardShell darkMode={darkMode} className="relative overflow-hidden p-4 sm:p-5 vx-noise">
            <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${tone.hex}13, transparent 42%, ${tone.hex}08)` }} />
            <div className="relative z-10 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                    <DataPill tone={tone}><Database className="h-3.5 w-3.5" /> Live Almanac Layer</DataPill>
                    <h2 className={`mt-3 break-words text-2xl font-bold uppercase italic tracking-tight sm:text-3xl ${darkMode ? 'text-white' : 'text-slate-950'}`}>
                        {activeMeta.shortLabel} tactical index
                    </h2>
                    <p className={`mt-1.5 max-w-3xl text-sm font-medium leading-6 ${darkMode ? 'text-white/40' : 'text-slate-500'}`}>
                        Cleaner database view with stable scroll containment, searchable entries, compact mode, and safer responsive layouts to stop cards from cutting off.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
                    <StatPanel label="Shapes" value={Object.values(ShapeType).length} tone={tone} darkMode={darkMode} icon={Box} />
                    <StatPanel label="Classes" value={countClasses(CLASS_ROLES) + countClasses(BOSS_TANK_DATA)} tone={tone} darkMode={darkMode} icon={Shield} />
                    <StatPanel label="Threats" value={Object.values(BOSS_STATS).length} tone={tone} darkMode={darkMode} icon={Skull} />
                </div>
            </div>
        </CardShell>
        <CardShell darkMode={darkMode} className="flex min-w-0 flex-col justify-between gap-3 p-4 sm:min-w-[240px]">
            <div>
                <p className={`vx-mono text-[9px] font-bold uppercase tracking-[0.24em] ${darkMode ? 'text-white/25' : 'text-slate-400'}`}>View Mode</p>
                <p className={`mt-1 text-sm font-semibold ${darkMode ? 'text-white/65' : 'text-slate-600'}`}>{compactMode ? 'Compact density enabled' : 'Cinematic cards enabled'}</p>
                {searchQuery && <p className={`mt-1 text-xs font-medium ${tone.softText}`}>Filter: {searchQuery}</p>}
            </div>
            <button
                type="button"
                onClick={onToggleCompact}
                className={`rounded-md border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${tone.button} ${tone.border} ${tone.buttonText}`}
            >
                {compactMode ? 'Use Detail View' : 'Use Compact View'}
            </button>
        </CardShell>
    </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
export const AlmanacModal: React.FC<AlmanacModalProps> = ({ onClose, darkMode, playSound }) => {
    const [activeCategory, setActiveCategory] = useState<MainCategory>('RESOURCES');
    const [selectedShape, setSelectedShape]   = useState<ShapeType>(ShapeType.SQUARE);
    const [searchQuery, setSearchQuery]       = useState('');
    const [compactMode, setCompactMode]       = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const contentRef = useRef<HTMLElement | null>(null);

    const activeMeta = useMemo(() => CATEGORIES.find(c => c.id === activeCategory) ?? CATEGORIES[0], [activeCategory]);
    const activeTone = TONE[activeMeta.tone];

    const shapes   = useMemo(() => Object.values(ShapeType)  as ShapeType[],   []);
    const rarities = useMemo(() => Object.values(ShapeRarity) as ShapeRarity[], []);
    const bosses   = useMemo(() => Object.values(BOSS_STATS)  as BossStatView[],[]);
    const normalizedQuery = useMemo(() => normalizeSearch(searchQuery), [searchQuery]);

    const filteredShapes = useMemo(
        () => shapes.filter(shape => matchesSearch(normalizedQuery, shape, formatLabel(String(shape)), ...(SHAPE_STRATEGIES[shape] ?? []))),
        [normalizedQuery, shapes]
    );
    const filteredClassRoles = useMemo(() => {
        return Object.entries(CLASS_ROLES)
            .map(([role, data]) => ({
                role,
                data: {
                    ...data,
                    classes: data.classes.filter(cls => matchesSearch(normalizedQuery, role, data.label, data.desc, cls, formatTankName(cls))),
                },
            }))
            .filter(({ data }) => data.classes.length > 0 || matchesSearch(normalizedQuery, data.label, data.desc));
    }, [normalizedQuery]);
    const filteredBossRoles = useMemo(() => {
        return Object.entries(BOSS_TANK_DATA)
            .map(([role, data]) => ({
                role,
                data: {
                    ...data,
                    classes: data.classes.filter(cls => matchesSearch(normalizedQuery, role, data.label, data.desc, cls, formatTankName(cls))),
                },
            }))
            .filter(({ data }) => data.classes.length > 0 || matchesSearch(normalizedQuery, data.label, data.desc));
    }, [normalizedQuery]);
    const filteredBosses = useMemo(
        () => bosses.filter(boss => matchesSearch(normalizedQuery, boss.id, boss.name, boss.description, boss.health, boss.xp)),
        [bosses, normalizedQuery]
    );
    const filteredTraits = useMemo(
        () => TACTICAL_TRAITS.filter(trait => matchesSearch(normalizedQuery, trait.name, trait.key, trait.desc)),
        [normalizedQuery]
    );

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [onClose]);

    const handleCategoryChange = (c: MainCategory) => {
        playSound?.();
        setActiveCategory(c);
        setScrollProgress(0);
        requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
    };
    const handleShapeChange    = (s: ShapeType)    => { playSound?.(); setSelectedShape(s); };
    const handleContentScroll = (e: React.UIEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const max = el.scrollHeight - el.clientHeight;
        setScrollProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, el.scrollTop / max)));
    };

    // ── Render sections ────────────────────────────────────────────────────────
    const renderResources = () => {
        const visibleShape = filteredShapes.includes(selectedShape) ? selectedShape : (filteredShapes[0] ?? selectedShape);
        const base       = SHAPE_STATS[visibleShape];
        const strategies = SHAPE_STRATEGIES[visibleShape] ?? ['Neutral target', 'Resource entity', 'Farm for XP'];
        if (normalizedQuery && filteredShapes.length === 0) {
            return <NoResults query={searchQuery} tone={activeTone} darkMode={darkMode} onClear={() => setSearchQuery('')} />;
        }
        return (
            <div className="space-y-6">
                {/* Shape selector */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {filteredShapes.map(shape => {
                        const active = shape === visibleShape;
                        return (
                            <button key={shape} type="button" onClick={() => handleShapeChange(shape)}
                                className={`group relative min-w-0 overflow-hidden rounded-lg border p-4 transition-all duration-150
                                    ${active
                                        ? `${activeTone.bg} ${activeTone.borderStrong} ${activeTone.shadow}`
                                        : darkMode
                                            ? 'border-white/8 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.055]'
                                            : 'border-slate-200 bg-white hover:border-cyan-300/60 hover:bg-cyan-50/30'}`}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <div className={`flex h-20 w-20 items-center justify-center rounded-md border ${darkMode ? 'border-white/8 bg-black/30' : 'border-slate-200 bg-white'}`}>
                                        <ShapePreview type={shape} rarity={ShapeRarity.COMMON} size={54} />
                                    </div>
                                    <span className={`vx-mono w-full truncate text-center text-[9px] font-bold uppercase tracking-[0.2em] ${active ? activeTone.text : darkMode ? 'text-white/40 group-hover:text-white/70' : 'text-slate-400 group-hover:text-slate-700'}`}>
                                        {formatLabel(String(shape))}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Detail + rarity grid */}
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                    {/* Left: shape detail */}
                    <CardShell darkMode={darkMode} className="relative overflow-hidden p-6 vx-bracket" style={{ color: activeTone.hex }}>
                        <div className={`absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r ${activeTone.line}`} />
                        <div className="flex flex-col items-center gap-5">
                            <div className={`relative flex h-48 w-full max-w-[240px] items-center justify-center rounded-lg border ${darkMode ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="absolute inset-0 rounded-lg" style={{ background: `radial-gradient(circle at center, ${activeTone.hex}18, transparent 68%)` }} />
                                <ShapePreview type={visibleShape} rarity={ShapeRarity.COMMON} size={140} />
                            </div>
                            <div className="min-w-0 w-full text-center">
                                <DataPill tone={activeTone}>Primary Resource</DataPill>
                                <h3 className={`mt-3 break-words text-2xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>
                                    {formatLabel(String(visibleShape))} Core
                                </h3>
                                <p className={`mt-1.5 text-sm leading-6 font-medium ${darkMode ? 'text-white/38' : 'text-slate-500'}`}>
                                    Rarity scaling, XP efficiency, and farming route analysis.
                                </p>
                            </div>
                            <div className="grid w-full gap-1.5">
                                {strategies.map(tip => (
                                    <div key={tip} className={`flex min-w-0 items-center gap-2.5 rounded border px-3 py-2 ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white'}`}>
                                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${activeTone.text}`} />
                                        <span className={`min-w-0 break-words text-xs font-semibold uppercase tracking-[0.08em] ${darkMode ? 'text-white/55' : 'text-slate-500'}`}>{tip}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardShell>

                    {/* Right: rarity cards */}
                    <div className="min-w-0">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                            {rarities.map(rarity => {
                                const config = RARITY_CONFIG[rarity];
                                if (!base || !config) return null;
                                const style       = getRarityStyle(rarity);
                                const xpValue     = Math.round(base.xp * config.xpMult);
                                const hpValue     = Math.round(base.health * config.hpMult);
                                const chanceLabel = typeof config.chance === 'number' ? `${config.chance}%` : '???';
                                return (
                                    <motion.div key={rarity} layout whileHover={{ y: -3 }}
                                        className={`min-w-0 overflow-hidden rounded-lg border p-4 transition-colors ${style.bg} ${style.border} ${darkMode ? '' : 'bg-white'}`}
                                        style={{ boxShadow: `0 0 18px ${style.hex}18` }}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-md border ${darkMode ? 'border-white/8 bg-black/35' : 'border-slate-200 bg-white'}`}>
                                                <ShapePreview type={visibleShape} rarity={rarity} size={52} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                                                    <h4 className={`vx-mono truncate text-[10px] font-bold uppercase tracking-[0.18em] ${style.text}`}>{formatLabel(String(rarity))}</h4>
                                                    <span className={`vx-mono shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${darkMode ? 'border-white/8 bg-black/30 text-white/30' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>{chanceLabel}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <StatPanel label="XP" value={xpValue.toLocaleString()} tone={activeTone} darkMode={darkMode} />
                                                    <StatPanel label="HP" value={hpValue.toLocaleString()} tone={activeTone} darkMode={darkMode} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderChassis = () => (
        <div className="space-y-10">
            {filteredClassRoles.length === 0 ? <NoResults query={searchQuery} tone={activeTone} darkMode={darkMode} onClear={() => setSearchQuery('')} /> : filteredClassRoles.map(({ role, data }) => {
                const Icon = data.icon;
                return (
                    <section key={role} className="min-w-0">
                        <SectionTitle icon={Icon} title={role} eyebrow={data.label} desc={data.desc} tone={activeTone} darkMode={darkMode} />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                            {data.classes.map(tankClass => {
                                const complexity = getTankComplexity(tankClass);
                                const barrels    = TANK_CONFIGS[tankClass]?.length ?? 1;
                                return (
                                    <motion.div key={tankClass} whileHover={{ y: -4 }}
                                        className={`group min-w-0 overflow-hidden rounded-lg border p-4 transition-all vx-card-hover
                                            ${darkMode ? 'border-white/8 bg-white/[0.03] hover:border-blue-400/40 hover:bg-blue-400/[0.06]'
                                                       : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}
                                    >
                                        <div className={`mb-4 flex h-28 items-center justify-center rounded-md border ${darkMode ? 'border-white/8 bg-black/30' : 'border-slate-200 bg-slate-50'}`}>
                                            <div className="transition-transform duration-300 group-hover:scale-110">
                                                <TankPreview tankClass={tankClass} size={84} />
                                            </div>
                                        </div>
                                        <div className="min-w-0 text-center">
                                            <h4 className={`truncate text-sm font-bold uppercase tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{formatTankName(tankClass)}</h4>
                                            <p className={`vx-mono mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ${activeTone.softText}`}>{barrels} barrel{barrels === 1 ? '' : 's'}</p>
                                            <div className="mt-3 flex items-center justify-center gap-1" aria-label={`Complexity ${complexity}/5`}>
                                                {[1,2,3,4,5].map(d => (
                                                    <span key={d} className={`h-1 w-5 rounded-sm ${d <= complexity ? activeTone.bgStrong : darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );

    const renderBosses = () => (
        <div className="space-y-10">
            {filteredBossRoles.length === 0 ? <NoResults query={searchQuery} tone={activeTone} darkMode={darkMode} onClear={() => setSearchQuery('')} /> : filteredBossRoles.map(({ role, data }) => {
                const Icon = data.icon;
                return (
                    <section key={role} className="min-w-0">
                        <SectionTitle icon={Icon} title={role} eyebrow={data.label} desc={data.desc} tone={activeTone} darkMode={darkMode} />
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                            {data.classes.map(tankClass => (
                                <motion.div key={tankClass} whileHover={{ y: -6, scale: 1.01 }}
                                    className={`group relative min-w-0 overflow-hidden rounded-lg border p-5 transition-all
                                        ${darkMode ? 'border-white/8 bg-white/[0.03] hover:border-amber-400/45 hover:bg-amber-400/[0.06]'
                                                   : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'}`}
                                >
                                    <Crown className={`absolute -right-6 -top-6 h-28 w-28 opacity-[0.05] ${activeTone.text}`} />
                                    <div className="relative z-10 flex flex-col items-center gap-5">
                                        <div className={`flex h-40 w-full items-center justify-center rounded-md border ${darkMode ? 'border-white/8 bg-black/35' : 'border-slate-200 bg-slate-50'}`}>
                                            <div className="transition-transform duration-300 group-hover:scale-110">
                                                <TankPreview tankClass={tankClass} size={124} />
                                            </div>
                                        </div>
                                        <div className="min-w-0 w-full text-center">
                                            <DataPill tone={activeTone}>Titan Class</DataPill>
                                            <h4 className={`mt-2.5 break-words text-xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{formatTankName(tankClass)}</h4>
                                        </div>
                                        <p className={`vx-mono min-h-[88px] w-full rounded-md border p-3.5 text-center text-[11px] font-medium leading-6 ${darkMode ? 'border-white/8 bg-black/30 text-white/42' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                            {tankClass === TankClass.COLOSSAL   && 'A mobile fortress with overwhelming cannon pressure and deck turrets. Slow, brutal, impossible to ignore.'}
                                            {tankClass === TankClass.LEVIATHAN  && 'Area-control titan using shockwaves to disrupt close threats, projectiles, and swarm pressure.'}
                                            {tankClass === TankClass.WARLORD    && 'Siege commander with repair drones and lockdown potential. Best holding territory and forcing bad trades.'}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );

    const renderThreats = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredBosses.length === 0 ? <NoResults query={searchQuery} tone={activeTone} darkMode={darkMode} onClear={() => setSearchQuery('')} /> : filteredBosses.map(boss => {
                    const previewType = getShapePreviewType(boss.id);
                    return (
                        <motion.div key={boss.id} whileHover={{ y: -3 }}
                            className={`group relative min-w-0 overflow-hidden rounded-lg border p-5 transition-all
                                ${darkMode ? 'border-red-400/20 bg-red-400/[0.05] hover:border-red-400/40'
                                           : 'border-red-200 bg-white hover:bg-red-50/40'}`}
                        >
                            <Skull className="absolute -right-5 -top-6 h-28 w-28 text-red-400 opacity-[0.07]" />
                            <div className="relative z-10 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                                <div className={`flex h-40 items-center justify-center rounded-md border ${darkMode ? 'border-white/8 bg-black/35' : 'border-red-100 bg-red-50/60'}`}>
                                    <ShapePreview type={previewType} rarity={ShapeRarity.COMMON} size={138} />
                                </div>
                                <div className="min-w-0 space-y-3">
                                    <div className="min-w-0">
                                        <div className="mb-2.5 flex flex-wrap items-center gap-2">
                                            <DataPill tone={activeTone}>Class Omega</DataPill>
                                            <span className={`vx-mono rounded border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${darkMode ? 'border-red-400/25 bg-red-400/10 text-red-300' : 'border-red-200 bg-red-100 text-red-500'}`}>Major Threat</span>
                                        </div>
                                        <h3 className={`break-words text-2xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{boss.name}</h3>
                                        <p className={`mt-2 text-xs font-medium italic leading-6 ${darkMode ? 'text-white/38' : 'text-slate-500'}`}>"{boss.description}"</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatPanel label="Integrity"  value={`${boss.health.toLocaleString()} HP`} tone={activeTone} darkMode={darkMode} icon={Shield} />
                                        <StatPanel label="XP Payout"  value={boss.xp.toLocaleString()}              tone={activeTone} darkMode={darkMode} icon={Zap}    />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CardShell darkMode={darkMode} className="relative overflow-hidden p-5">
                    <div className="absolute left-0 top-0 h-full w-0.5 bg-amber-400/70" />
                    <SectionTitle icon={Zap} title="Elite Incursions" eyebrow="Spectral mimic wave"
                        desc="Advanced chassis variants can manifest as aggressive elites with boosted firepower and harsh punishment windows."
                        tone={TONE.amber} darkMode={darkMode} />
                    <div className="grid grid-cols-3 gap-2">
                        {[TankClass.DESTROYER, TankClass.SNIPER, TankClass.OVERLORD].map(tc => (
                            <div key={tc} className={`flex min-w-0 items-center gap-2 rounded-md border p-2.5 ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white'}`}>
                                <TankPreview tankClass={tc} size={34} />
                                <span className={`truncate text-[9px] font-bold uppercase tracking-[0.14em] ${darkMode ? 'text-white/50' : 'text-slate-500'}`}>{formatTankName(tc)}</span>
                            </div>
                        ))}
                    </div>
                </CardShell>
                <CardShell darkMode={darkMode} className="relative overflow-hidden p-5">
                    <div className="absolute left-0 top-0 h-full w-0.5 bg-red-400/70" />
                    <SectionTitle icon={Shield} title="Security Automata" eyebrow="Objective defense drones"
                        desc="Defensive drones aggregate around high-value zones and use pressure, body-blocking, and ramming to punish careless routing."
                        tone={TONE.red} darkMode={darkMode} />
                    <div className="grid grid-cols-2 gap-2">
                        <StatPanel label="Crasher Frame" value="40 HP"  tone={TONE.red} darkMode={darkMode} icon={Activity} />
                        <StatPanel label="Alpha Frame"   value="250 HP" tone={TONE.red} darkMode={darkMode} icon={Crown}    />
                    </div>
                </CardShell>
            </div>
        </div>
    );

    const renderVoid = () => (
        <div className="grid min-h-full grid-cols-1 items-center gap-8 xl:grid-cols-[minmax(260px,480px)_minmax(0,1fr)]">
            <div className="flex min-w-0 justify-center">
                <div className="relative flex aspect-square w-full max-w-[400px] items-center justify-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 38, repeat: Infinity, ease: 'linear' }} className="absolute inset-4 rounded-full border border-purple-400/12" />
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 55, repeat: Infinity, ease: 'linear' }} className="absolute inset-12 rounded-full border border-purple-400/8" />
                    <motion.div
                        animate={{ scale: [1, 1.03, 1], rotate: [0, 2, -2, 0] }}
                        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                        className={`relative flex h-[76%] w-[76%] items-center justify-center rounded-full border-2 ${darkMode ? 'border-purple-400/25 bg-[#030508] shadow-[0_0_100px_rgba(192,132,252,0.28)]' : 'border-purple-300 bg-slate-950 shadow-[0_0_80px_rgba(192,132,252,0.22)]'}`}
                    >
                        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at center, rgba(192,132,252,0.2), transparent 60%)' }} />
                        <ShapePreview type={VOID_PORTAL_PREVIEW} rarity={ShapeRarity.COMMON} size={340} />
                    </motion.div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-purple-400/35 bg-purple-600 px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.36em] text-white vx-mono shadow-[0_0_28px_rgba(192,132,252,0.4)]">
                        Null Space Detected
                    </div>
                </div>
            </div>
            <div className="min-w-0 space-y-5">
                <DataPill tone={activeTone}><Aperture className="h-3.5 w-3.5" /> Rift Analysis</DataPill>
                <div className="min-w-0">
                    <h3 className={`break-words text-4xl font-bold uppercase italic tracking-tight sm:text-5xl ${darkMode ? 'text-white' : 'text-slate-950'}`}>Dimensional Rift</h3>
                    <p className={`mt-3.5 max-w-3xl text-sm font-medium leading-7 ${darkMode ? 'text-purple-100/45' : 'text-slate-600'}`}>
                        A parallel resource field where the grid collapses into unstable matter. Void farming can spike rewards hard, but the space is volatile and punishes slow reactions.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <StatPanel label="Yield Gain" value="1000%"    tone={activeTone} darkMode={darkMode} icon={Zap}      />
                    <StatPanel label="Stability"  value="Volatile" tone={activeTone} darkMode={darkMode} icon={Activity} />
                    <StatPanel label="Cycle Rate" value="5:00m"    tone={activeTone} darkMode={darkMode} icon={Database} />
                </div>
                <CardShell darkMode={darkMode} className="p-5">
                    <div className="flex min-w-0 gap-3.5">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${activeTone.bg} ${activeTone.border}`}>
                            <Info className={`h-5 w-5 ${activeTone.text}`} />
                        </div>
                        <div className="min-w-0">
                            <h4 className={`text-base font-bold uppercase tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>Field Note</h4>
                            <p className={`mt-1.5 text-xs font-medium leading-6 ${darkMode ? 'text-white/42' : 'text-slate-500'}`}>
                                Void routes are high-risk farming lanes. Enter with enough movement speed to disengage, and avoid tunnelling on resource rolls when hostile tanks are nearby.
                            </p>
                        </div>
                    </div>
                </CardShell>
            </div>
        </div>
    );

    const renderAbilities = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredTraits.length === 0 ? <NoResults query={searchQuery} tone={activeTone} darkMode={darkMode} onClear={() => setSearchQuery('')} /> : filteredTraits.map(trait => {
                    const Icon = trait.icon;
                    return (
                        <motion.article key={trait.name} whileHover={{ y: -3 }}
                            className={`group relative min-w-0 overflow-hidden rounded-lg border p-5 transition-all vx-card-hover
                                ${darkMode ? 'border-white/8 bg-white/[0.03] hover:border-emerald-400/35 hover:bg-emerald-400/[0.05]'
                                           : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'}`}
                        >
                            <Icon className={`absolute -right-6 -top-6 h-28 w-28 opacity-[0.05] ${activeTone.text}`} />
                            <div className="relative z-10 flex min-w-0 flex-col gap-4">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border ${activeTone.bg} ${activeTone.border}`}>
                                        <Icon className={`h-6 w-6 ${activeTone.text}`} />
                                    </div>
                                    <span className={`vx-mono max-w-[54%] break-words rounded border px-3 py-1.5 text-right text-[9px] font-bold uppercase tracking-[0.2em] ${darkMode ? 'border-white/8 bg-black/30 text-white/38' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                        {trait.key}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <h4 className={`break-words text-xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{trait.name}</h4>
                                    <p className={`mt-2 text-xs font-medium leading-6 ${darkMode ? 'text-white/42' : 'text-slate-500'}`}>{trait.desc}</p>
                                </div>
                            </div>
                        </motion.article>
                    );
                })}
            </div>

            <CardShell darkMode={darkMode} className="relative overflow-hidden p-5 sm:p-6">
                <div className="absolute inset-0 rounded-lg" style={{ background: `radial-gradient(circle at top right, ${activeTone.hex}10, transparent 50%)` }} />
                <div className="relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                        <SectionTitle icon={Info} title="Pilot Synergy Protocols" eyebrow="Build discipline"
                            desc="Match upgrades with your chassis identity. Precision builds scale harder with projectile speed, assault classes love reload and damage, command classes need unit pressure."
                            tone={activeTone} darkMode={darkMode} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[StatType.RELOAD, StatType.BULLET_SPEED, StatType.MOVEMENT_SPEED].map(stat => (
                            <div key={stat} className={`flex h-24 w-full min-w-[76px] flex-col items-center justify-center gap-2 rounded-md border px-2 py-3 text-center ${darkMode ? 'border-white/8 bg-black/30' : 'border-slate-200 bg-white'}`}>
                                <div className={`h-7 w-7 rounded-sm ${activeTone.bgStrong} opacity-55 shadow-lg ${activeTone.glow}`} />
                                <span className={`vx-mono line-clamp-2 text-[8px] font-bold uppercase leading-3 tracking-wider ${darkMode ? 'text-white/38' : 'text-slate-400'}`}>{formatLabel(String(stat))}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardShell>
        </div>
    );

    const renderContent = () => {
        switch (activeCategory) {
            case 'RESOURCES': return renderResources();
            case 'CHASSIS':   return renderChassis();
            case 'BOSSES':    return renderBosses();
            case 'THREATS':   return renderThreats();
            case 'VOID':      return renderVoid();
            case 'ABILITIES': return renderAbilities();
            default:          return renderResources();
        }
    };

    const ActiveIcon = activeMeta.icon;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: ALMANAC_STYLES }} />
            <motion.div
                className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden p-1 sm:p-4 lg:p-6"
                style={{ background: 'rgba(0,0,0,0.88)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={onClose}
            >
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="almanac-title"
                    className={`vx-modal vx-grid-bg relative flex h-[calc(100dvh-0.5rem)] max-h-[94dvh] w-full max-w-[1640px] min-w-0 overflow-hidden rounded-xl border shadow-2xl sm:h-[94dvh]
                        ${darkMode ? 'border-white/12 bg-[#030508] text-white shadow-black' : 'border-slate-300 bg-[#f4f0e8] text-slate-950 shadow-slate-900/20'}`}
                    initial={{ scale: 0.97, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.97, y: 16, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    {/* Scan-line overlay */}
                    {darkMode && <div className="vx-scanlines pointer-events-none absolute inset-0 z-[2]" />}

                    {/* Ambient glow orbs */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className={`absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-40 ${activeTone.bg}`} />
                        <div className={`absolute -bottom-32 right-8 h-80 w-80 rounded-full blur-3xl opacity-30 ${activeTone.bg}`} />
                        {darkMode && (
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.04),transparent_60%)]" />
                        )}
                    </div>

                    {/* ── Sidebar ────────────────────────────────────────────── */}
                    <aside className={`relative z-10 hidden w-[96px] shrink-0 flex-col border-r p-3 lg:flex xl:w-[288px]
                        ${darkMode ? 'border-white/8 bg-black/35' : 'border-slate-200 bg-white/60'}`}
                    >
                        {/* Brand */}
                        <div className={`mb-3 flex min-w-0 items-center gap-3 rounded-md border p-3 ${darkMode ? 'border-amber-400/20 bg-amber-400/[0.06]' : 'border-amber-300/40 bg-amber-50/60'}`}>
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border ${darkMode ? 'border-amber-400/25 bg-amber-400/10' : 'border-amber-300/50 bg-amber-100/60'}`}>
                                <Database className="h-5 w-5 text-amber-400" />
                            </div>
                            <div className="hidden min-w-0 xl:block">
                                <h2 className={`vx-mono truncate text-base font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>VEXTOR_OS</h2>
                                <p className="vx-mono truncate text-[9px] font-bold uppercase tracking-[0.3em] text-amber-400/55">Tactical Database</p>
                            </div>
                        </div>

                        {/* Nav */}
                        <nav className={`min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 ${darkMode ? 'vx-scrollbar' : 'vx-scrollbar-light'}`}>
                            {CATEGORIES.map(cat => (
                                <CategoryButton key={cat.id} category={cat} isActive={activeCategory === cat.id} darkMode={darkMode} onClick={() => handleCategoryChange(cat.id)} />
                            ))}
                        </nav>

                        {/* Close */}
                        <button type="button" onClick={onClose}
                            className={`mt-3 flex w-full items-center justify-center gap-2.5 rounded-md border p-3 transition-all duration-150
                                ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/38 hover:border-red-400/35 hover:bg-red-400/[0.07] hover:text-red-300'
                                           : 'border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500'}`}
                        >
                            <X className="h-4 w-4" />
                            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] xl:block">Close Terminal</span>
                        </button>
                    </aside>

                    {/* ── Main content ───────────────────────────────────────── */}
                    <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
                        {/* Header */}
                        <header className={`shrink-0 border-b px-4 py-3 sm:px-6 ${darkMode ? 'border-white/8 bg-black/20' : 'border-slate-200 bg-white/50'}`}>
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                    <div className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-md border sm:flex ${activeTone.bg} ${activeTone.border}`}>
                                        <ActiveIcon className={`h-6 w-6 ${activeTone.text}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <DataPill tone={activeTone}><Search className="h-3 w-3" /> {activeCategory}</DataPill>
                                        </div>
                                        <h1 id="almanac-title" className={`mt-1.5 break-words text-2xl font-bold uppercase italic tracking-tight sm:text-3xl lg:text-4xl ${darkMode ? 'text-white' : 'text-slate-950'}`}>
                                            {activeMeta.label}
                                        </h1>
                                        <p className={`mt-1 max-w-2xl text-xs font-medium leading-5 ${darkMode ? 'text-white/38' : 'text-slate-500'}`}>{activeMeta.subtitle}</p>
                                    </div>
                                </div>
                                <div className={`hidden min-w-[260px] max-w-[420px] flex-1 items-center gap-2 rounded-md border px-3 py-2 xl:flex ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white'}`}>
                                    <Search className={`h-4 w-4 shrink-0 ${activeTone.text}`} />
                                    <input
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search tanks, traits, bosses..."
                                        className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-medium ${darkMode ? 'text-white placeholder:text-white/22' : 'text-slate-900 placeholder:text-slate-400'}`}
                                    />
                                    {searchQuery && (
                                        <button type="button" onClick={() => setSearchQuery('')} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-white/35 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                                            Clear
                                        </button>
                                    )}
                                    <span className={`vx-mono rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${darkMode ? 'border-white/8 text-white/20' : 'border-slate-200 text-slate-400'}`}>Ctrl K</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <div className={`hidden items-center gap-2.5 rounded-md border px-3 py-2 md:flex ${darkMode ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-emerald-300/40 bg-emerald-50/60'}`}>
                                        <Activity className="h-3.5 w-3.5 text-emerald-400" />
                                        <div className="text-right">
                                            <p className={`vx-mono text-[8px] font-bold uppercase tracking-[0.2em] ${darkMode ? 'text-white/25' : 'text-slate-400'}`}>System</p>
                                            <p className="vx-mono text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                                                Synced<span className="vx-blink">_</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button type="button" onClick={onClose}
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-all duration-150 hover:rotate-90
                                            ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/55 hover:border-red-400/35 hover:bg-red-400/[0.07] hover:text-red-300'
                                                       : 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500'}`}
                                        aria-label="Close almanac"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 xl:hidden">
                                <div className={`flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white'}`}>
                                    <Search className={`h-4 w-4 shrink-0 ${activeTone.text}`} />
                                    <input
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search almanac..."
                                        className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-medium ${darkMode ? 'text-white placeholder:text-white/22' : 'text-slate-900 placeholder:text-slate-400'}`}
                                    />
                                    {searchQuery && (
                                        <button type="button" onClick={() => setSearchQuery('')} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-white/35 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className={`mt-3 h-1 overflow-hidden rounded-full ${darkMode ? 'bg-white/[0.06]' : 'bg-slate-200'}`} aria-hidden="true">
                                <motion.div className={`h-full ${activeTone.bgStrong}`} animate={{ width: `${Math.round(scrollProgress * 100)}%` }} transition={{ duration: 0.12 }} />
                            </div>
                        </header>

                        {/* Mobile category nav */}
                        <nav aria-label="Almanac categories" className={`relative z-20 shrink-0 border-b py-2 lg:hidden ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white/55'}`}>
                            <div className="vx-no-scrollbar flex min-w-0 snap-x gap-1.5 overflow-x-auto px-4 pb-1 pt-1">
                                {CATEGORIES.map(cat => {
                                    const tone   = TONE[cat.tone];
                                    const Icon   = cat.icon;
                                    const active = activeCategory === cat.id;
                                    return (
                                        <button key={cat.id} type="button" onClick={() => handleCategoryChange(cat.id)} aria-current={active ? 'page' : undefined}
                                            className={`flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all duration-150
                                                ${active
                                                    ? `${tone.bg} ${tone.borderStrong} ${tone.text}`
                                                    : darkMode
                                                        ? 'border-white/8 bg-white/[0.03] text-white/38 hover:text-white/70'
                                                        : 'border-slate-200 bg-white text-slate-400 hover:text-slate-700'}`}
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            <span>{cat.shortLabel}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </nav>

                        {/* Content area */}
                        <section ref={contentRef} onScroll={handleContentScroll} className={`vx-sweep min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-7 lg:py-7 ${darkMode ? 'vx-scrollbar' : 'vx-scrollbar-light'}`}>
                            <AlmanacOverview darkMode={darkMode} tone={activeTone} activeMeta={activeMeta} searchQuery={searchQuery} compactMode={compactMode} onToggleCompact={() => setCompactMode(v => !v)} />
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeCategory}
                                    initial={{ opacity: 0, x: 14 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -14 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className={`relative z-10 min-h-full min-w-0 ${compactMode ? 'vx-compact text-[0.95rem]' : ''}`}
                                >
                                    {renderContent()}
                                </motion.div>
                            </AnimatePresence>
                        </section>

                        {/* Footer */}
                        <footer className={`hidden shrink-0 items-center justify-between gap-4 border-t px-6 py-3 md:flex ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white/50'}`}>
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${activeTone.bgStrong} vx-blink`} />
                                <span className={`vx-mono truncate text-[9px] font-bold uppercase tracking-[0.24em] ${darkMode ? 'text-white/18' : 'text-slate-400'}`}>Terminal Active</span>
                                <span className={darkMode ? 'text-white/10' : 'text-slate-300'}>/</span>
                                <span className={`vx-mono truncate text-[9px] font-bold italic ${darkMode ? 'text-white/12' : 'text-slate-300'}`}>REF_ID: 0xDE4B_SYNC</span>
                            </div>
                            <div className={`flex shrink-0 items-center gap-2 vx-mono text-[9px] font-bold uppercase tracking-[0.22em] ${darkMode ? 'text-white/18' : 'text-slate-400'}`}>
                                <Eye className="h-3 w-3" />
                                <span>Vextor_OS Almanac</span>
                                <Lock className="h-3 w-3" />
                            </div>
                        </footer>
                    </main>
                </motion.div>
            </motion.div>
        </>
    );
};