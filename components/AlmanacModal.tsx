import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
    Activity,
    Aperture,
    ArrowUp,
    Box,
    ChevronRight,
    Cpu,
    Crown,
    Database,
    Eye,
    Info,
    LayoutGrid,
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

// ─────────────────────────────────────────────────────────────────────────────
// VEXTOR ALMANAC — Optimised / simplified / cleaner redesign
// Major changes:
// - Debounced global search so typing does not re-render every heavy section instantly.
// - requestAnimationFrame throttled scroll progress instead of setState on every scroll tick.
// - Performance Mode disables animated overlays, hover lift, heavy blur, and most motion.
// - Safer data transforms for BOSS_STATS / missing shape stats / missing rarity config.
// - Mobile tables now scroll horizontally instead of crushing or overflowing the modal.
// - Density toggle, category shortcuts, clear search, back-to-top, and visible entry counter.
// ─────────────────────────────────────────────────────────────────────────────

const ALMANAC_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

.vx-modal, .vx-modal * { font-family: 'Rajdhani', sans-serif; }
.vx-mono { font-family: 'Space Mono', monospace !important; }

.vx-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(251,191,36,.55) rgba(255,255,255,.06); }
.vx-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
.vx-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,.045); border-radius: 999px; }
.vx-scrollbar::-webkit-scrollbar-thumb { background: rgba(251,191,36,.65); border: 3px solid rgba(3,5,8,.92); border-radius: 999px; }
.vx-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251,191,36,.86); }

.vx-scrollbar-light { scrollbar-width: thin; scrollbar-color: rgba(15,23,42,.32) rgba(15,23,42,.08); }
.vx-scrollbar-light::-webkit-scrollbar { width: 10px; height: 10px; }
.vx-scrollbar-light::-webkit-scrollbar-track { background: rgba(15,23,42,.08); border-radius: 999px; }
.vx-scrollbar-light::-webkit-scrollbar-thumb { background: rgba(15,23,42,.28); border: 3px solid rgba(248,250,252,.96); border-radius: 999px; }
.vx-scrollbar-light::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,.42); }

.vx-no-scrollbar { scrollbar-width: none; }
.vx-no-scrollbar::-webkit-scrollbar { display: none; }

.vx-card { content-visibility: auto; contain-intrinsic-size: 1px 260px; }
.vx-card-hover { transition: border-color .16s ease, background-color .16s ease, transform .16s ease, box-shadow .16s ease; }
.vx-card-hover:hover { transform: translateY(-2px); }
.vx-perf .vx-card-hover:hover { transform: none; }

.vx-table-scroll { overflow-x: auto; overscroll-behavior-x: contain; }
.vx-table-grid { min-width: 720px; }
.vx-table-grid-sm { min-width: 560px; }

.vx-grid-bg {
    background-image:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size: 48px 48px;
}

.vx-scanlines::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.12) 3px 4px);
    opacity: .5;
}

.vx-pulse-dot { animation: vx-pulse-dot 1.2s ease-in-out infinite; }
@keyframes vx-pulse-dot { 0%,100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }

@media (prefers-reduced-motion: reduce) {
    .vx-pulse-dot { animation: none !important; }
    .vx-card-hover, .vx-card-hover:hover { transform: none !important; }
}
`;

interface AlmanacModalProps {
    onClose: () => void;
    darkMode: boolean;
    playSound?: () => void;
}

type MainCategory = 'RESOURCES' | 'CHASSIS' | 'BOSSES' | 'THREATS' | 'VOID' | 'ABILITIES';
type ToneName = 'cyan' | 'blue' | 'amber' | 'red' | 'purple' | 'emerald';
type DensityMode = 'detailed' | 'compact';
type SortMode = 'name' | 'xp' | 'health';

type CategoryMeta = {
    id: MainCategory;
    label: string;
    shortLabel: string;
    subtitle: string;
    icon: LucideIcon;
    tone: ToneName;
};

type ToneStyle = {
    text: string;
    softText: string;
    bg: string;
    bgStrong: string;
    border: string;
    borderStrong: string;
    button: string;
    buttonText: string;
    line: string;
    hex: string;
};

type ClassRole = {
    label: string;
    desc: string;
    classes: TankClass[];
    icon: LucideIcon;
};

type BossStatView = {
    id: string;
    name: string;
    description: string;
    health: number;
    xp: number;
    damage?: number;
    radius?: number;
};

type TraitCard = {
    name: string;
    key: string;
    desc: string;
    icon: LucideIcon;
};

const TONE: Record<ToneName, ToneStyle> = {
    cyan: {
        text: 'text-cyan-400', softText: 'text-cyan-400/55', bg: 'bg-cyan-400/[0.075]', bgStrong: 'bg-cyan-400',
        border: 'border-cyan-400/25', borderStrong: 'border-cyan-400/70', button: 'bg-cyan-400/10 hover:bg-cyan-400/[0.16]', buttonText: 'text-cyan-300',
        line: 'from-cyan-400/70 via-cyan-400/15 to-transparent', hex: '#22d3ee',
    },
    blue: {
        text: 'text-blue-400', softText: 'text-blue-400/55', bg: 'bg-blue-400/[0.075]', bgStrong: 'bg-blue-400',
        border: 'border-blue-400/25', borderStrong: 'border-blue-400/70', button: 'bg-blue-400/10 hover:bg-blue-400/[0.16]', buttonText: 'text-blue-300',
        line: 'from-blue-400/70 via-blue-400/15 to-transparent', hex: '#60a5fa',
    },
    amber: {
        text: 'text-amber-400', softText: 'text-amber-400/55', bg: 'bg-amber-400/[0.075]', bgStrong: 'bg-amber-400',
        border: 'border-amber-400/25', borderStrong: 'border-amber-400/70', button: 'bg-amber-400/10 hover:bg-amber-400/[0.16]', buttonText: 'text-amber-300',
        line: 'from-amber-400/70 via-amber-400/15 to-transparent', hex: '#fbbf24',
    },
    red: {
        text: 'text-red-400', softText: 'text-red-400/55', bg: 'bg-red-400/[0.075]', bgStrong: 'bg-red-400',
        border: 'border-red-400/25', borderStrong: 'border-red-400/70', button: 'bg-red-400/10 hover:bg-red-400/[0.16]', buttonText: 'text-red-300',
        line: 'from-red-400/70 via-red-400/15 to-transparent', hex: '#f87171',
    },
    purple: {
        text: 'text-purple-400', softText: 'text-purple-400/55', bg: 'bg-purple-400/[0.075]', bgStrong: 'bg-purple-400',
        border: 'border-purple-400/25', borderStrong: 'border-purple-400/70', button: 'bg-purple-400/10 hover:bg-purple-400/[0.16]', buttonText: 'text-purple-300',
        line: 'from-purple-400/70 via-purple-400/15 to-transparent', hex: '#c084fc',
    },
    emerald: {
        text: 'text-emerald-400', softText: 'text-emerald-400/55', bg: 'bg-emerald-400/[0.075]', bgStrong: 'bg-emerald-400',
        border: 'border-emerald-400/25', borderStrong: 'border-emerald-400/70', button: 'bg-emerald-400/10 hover:bg-emerald-400/[0.16]', buttonText: 'text-emerald-300',
        line: 'from-emerald-400/70 via-emerald-400/15 to-transparent', hex: '#34d399',
    },
};

const CATEGORIES: CategoryMeta[] = [
    { id: 'RESOURCES', label: 'Shape Archives', shortLabel: 'Shapes', subtitle: 'Resource values, rarity rolls, farming targets.', icon: Box, tone: 'cyan' },
    { id: 'CHASSIS', label: 'Chassis Database', shortLabel: 'Chassis', subtitle: 'Tank roles, class families, weapon identities.', icon: Shield, tone: 'blue' },
    { id: 'BOSSES', label: 'Commander Protocols', shortLabel: 'Commanders', subtitle: 'Rebirth titans and endgame chassis reports.', icon: Crown, tone: 'amber' },
    { id: 'THREATS', label: 'Threat Index', shortLabel: 'Threats', subtitle: 'Boss entities, elite incursions, hostile automata.', icon: Skull, tone: 'red' },
    { id: 'VOID', label: 'Void Research', shortLabel: 'Void', subtitle: 'Rift behaviour, instability, boosted resource fields.', icon: Aperture, tone: 'purple' },
    { id: 'ABILITIES', label: 'Tactical Traits', shortLabel: 'Traits', subtitle: 'Passives, key abilities, and build synergies.', icon: Cpu, tone: 'emerald' },
];

const SHAPE_STRATEGIES: Partial<Record<ShapeType, string[]>> = {
    [ShapeType.SQUARE]: ['Starter farm target', 'Low durability', 'Safe early XP chain'],
    [ShapeType.TRIANGLE]: ['Fast drifting shape', 'Lead shots slightly', 'Good early-mid payout'],
    [ShapeType.PENTAGON]: ['Tanky resource core', 'Central farming priority', 'Strong level 30+ XP source'],
    [ShapeType.HEXAGON]: ['High integrity shell', 'Rewards sustained DPS', 'Great for upgraded builds'],
    [ShapeType.OCTAGON]: ['Ancient relic target', 'Massive XP jackpot', 'Contestable high-value spawn'],
};

const CLASS_ROLES: Record<string, ClassRole> = {
    ASSAULT: {
        label: 'Frontline Combatants',
        desc: 'High bullet volume for direct pressure and steady frontline control.',
        classes: [TankClass.TWIN, TankClass.TRIPLE_SHOT, TankClass.PENTA_SHOT, TankClass.SPREAD_SHOT, TankClass.TRIPLE_TWIN],
        icon: Zap,
    },
    PRECISION: {
        label: 'Long-Range Interceptors',
        desc: 'Fast projectiles and clean sightlines for punishing bad positioning.',
        classes: [TankClass.SNIPER, TankClass.ASSASSIN, TankClass.RANGER, TankClass.STALKER, TankClass.HUNTER],
        icon: Target,
    },
    IMPACT: {
        label: 'Heavy Ordnance',
        desc: 'Burst-heavy frames that trade tempo for impact and recoil utility.',
        classes: [TankClass.MACHINE_GUN, TankClass.DESTROYER, TankClass.ANNIHILATOR, TankClass.HYBRID, TankClass.SPRAYER],
        icon: Activity,
    },
    TACTICAL: {
        label: 'Advanced Command',
        desc: 'Control-oriented classes built around drones, turrets, and map ownership.',
        classes: [TankClass.OVERSEER, TankClass.OVERLORD, TankClass.MANAGER, TankClass.OCTO_TANK, TankClass.AUTO_GUNNER],
        icon: Cpu,
    },
};

const BOSS_TANK_DATA: Record<string, ClassRole> = {
    COMMANDERS: {
        label: 'Rebirth Titans',
        desc: 'Endgame titan frames with heavy durability, setup value, and battlefield control.',
        classes: [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD],
        icon: Crown,
    },
};

const TACTICAL_TRAITS: TraitCard[] = [
    { name: 'Sacrificial Goat', key: 'RMB / Right-Click', desc: 'Spend current health to spike drone pressure for a risky power window.', icon: Activity },
    { name: 'Goliath Recoil', key: 'Passive', desc: 'Heavy recoil can reposition you as much as it knocks you back.', icon: Zap },
    { name: 'Void Sync', key: 'Dimensional', desc: 'Void routes boost rarity and yield, but the zone becomes much less stable.', icon: Aperture },
    { name: 'Siege Mode', key: 'Key [X]', desc: 'Anchor in place to gain stronger defensive and offensive control.', icon: Shield },
    { name: 'Shockwave', key: 'Titan Passive', desc: 'Periodic pulses keep close threats and projectile swarms off your hull.', icon: Sparkles },
    { name: 'Rebirth Protocol', key: 'Level 60', desc: 'Reset progression to access titan-class chassis and late-game mechanics.', icon: Crown },
];

const RARITY_STYLE: Partial<Record<ShapeRarity, { text: string; bg: string; border: string }>> = {
    [ShapeRarity.COMMON]: { text: 'text-slate-300', bg: 'bg-slate-400/10', border: 'border-slate-400/20' },
    [ShapeRarity.UNCOMMON]: { text: 'text-cyan-300', bg: 'bg-cyan-400/10', border: 'border-cyan-400/25' },
    [ShapeRarity.RARE]: { text: 'text-green-300', bg: 'bg-green-400/10', border: 'border-green-400/25' },
    [ShapeRarity.EPIC]: { text: 'text-amber-300', bg: 'bg-amber-400/10', border: 'border-amber-400/25' },
    [ShapeRarity.LEGENDARY]: { text: 'text-orange-300', bg: 'bg-orange-400/10', border: 'border-orange-400/25' },
    [ShapeRarity.MYTHICAL]: { text: 'text-indigo-300', bg: 'bg-indigo-400/10', border: 'border-indigo-400/25' },
    [ShapeRarity.ETERNAL]: { text: 'text-sky-200', bg: 'bg-sky-400/10', border: 'border-sky-300/25' },
    [ShapeRarity.TRANSCENDENT]: { text: 'text-white', bg: 'bg-white/10', border: 'border-white/30' },
};

const VOID_PORTAL_PREVIEW = ((ShapeType as unknown as Record<string, ShapeType>).VOID_PORTAL ?? ShapeType.OCTAGON) as ShapeType;

const formatLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const formatTankName = (tankClass: TankClass) => String(tankClass).replace(/ Tank$/i, '').replace(/_/g, ' ');
const normalizeSearch = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const getRarityStyle = (rarity: ShapeRarity) => RARITY_STYLE[rarity] ?? RARITY_STYLE[ShapeRarity.COMMON]!;
const getShapeStrategy = (shape: ShapeType) => SHAPE_STRATEGIES[shape] ?? ['Resource target', 'Farm for XP', 'Watch nearby enemy pressure'];
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const matchesSearch = (query: string, ...fields: Array<string | number | undefined | null>) => {
    if (!query) return true;
    const haystack = fields.map(field => String(field ?? '')).join(' ').toLowerCase().replace(/[\s_-]+/g, ' ');
    return haystack.includes(query);
};

const getTankComplexity = (tankClass: TankClass) => {
    const barrelCount = TANK_CONFIGS[tankClass]?.length ?? 1;
    if (barrelCount >= 6) return 5;
    if (barrelCount >= 4) return 4;
    if (barrelCount >= 3) return 3;
    if (barrelCount >= 2) return 2;
    return 1;
};

const countClasses = (roles: Record<string, ClassRole>) => Object.values(roles).reduce((total, role) => total + role.classes.length, 0);

const getClassBrief = (tankClass: TankClass) => {
    switch (tankClass) {
        case TankClass.TWIN:
        case TankClass.TRIPLE_SHOT:
        case TankClass.PENTA_SHOT:
        case TankClass.SPREAD_SHOT:
        case TankClass.TRIPLE_TWIN:
            return 'Lane pressure';
        case TankClass.SNIPER:
        case TankClass.ASSASSIN:
        case TankClass.RANGER:
        case TankClass.STALKER:
        case TankClass.HUNTER:
            return 'Pick from range';
        case TankClass.MACHINE_GUN:
        case TankClass.DESTROYER:
        case TankClass.ANNIHILATOR:
        case TankClass.HYBRID:
        case TankClass.SPRAYER:
            return 'Burst and recoil';
        case TankClass.OVERSEER:
        case TankClass.OVERLORD:
        case TankClass.MANAGER:
        case TankClass.OCTO_TANK:
        case TankClass.AUTO_GUNNER:
            return 'Space control';
        case TankClass.COLOSSAL:
            return 'Siege wall';
        case TankClass.LEVIATHAN:
            return 'Pulse control';
        case TankClass.WARLORD:
            return 'Anchor defense';
        default:
            return 'Generalist frame';
    }
};

const getBossIdentity = (tankClass: TankClass) => {
    switch (tankClass) {
        case TankClass.COLOSSAL:
            return {
                role: 'Fortress titan',
                notes: ['Huge lane denial', 'Wins slow pushes', 'Punishes frontal dives'],
            };
        case TankClass.LEVIATHAN:
            return {
                role: 'Shockwave controller',
                notes: ['Breaks clusters', 'Strong anti-swarm', 'Owns midrange space'],
            };
        case TankClass.WARLORD:
            return {
                role: 'Siege commander',
                notes: ['Locks territory', 'Trades speed for control', 'Best with setup time'],
            };
        default:
            return {
                role: 'Titan chassis',
                notes: ['High durability', 'Late-game threat', 'Needs focused response'],
            };
    }
};

const getThreatProfile = (boss: BossStatView) => {
    const pressure = boss.damage && boss.damage >= 45 ? 'High burst' : boss.radius && boss.radius >= 45 ? 'Wide control' : 'Sustained threat';
    const reward = boss.xp >= 10000 ? 'Huge payout' : boss.xp >= 3000 ? 'Strong payout' : 'Moderate payout';
    const handling = boss.health >= 5000 ? 'Bring focus fire' : boss.health >= 1500 ? 'Chip safely' : 'Collapse quickly';
    return [
        { label: 'Pressure', value: pressure },
        { label: 'Reward', value: reward },
        { label: 'Response', value: handling },
    ];
};

const getTraitFocus = (trait: TraitCard) => {
    switch (trait.name) {
        case 'Sacrificial Goat': return 'Health-for-pressure burst';
        case 'Goliath Recoil': return 'Recoil doubles as movement';
        case 'Void Sync': return 'Greed vs survival';
        case 'Siege Mode': return 'Anchor for zone control';
        case 'Shockwave': return 'Keep enemies off your hull';
        case 'Rebirth Protocol': return 'Reset for titan access';
        default: return 'Specialist combat rule';
    }
};

const useDebouncedValue = <T,>(value: T, delay = 130) => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timeout);
    }, [delay, value]);

    return debounced;
};

const getStoredBoolean = (key: string, fallback: boolean) => {
    if (typeof window === 'undefined') return fallback;
    const stored = window.localStorage.getItem(key);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return fallback;
};

const getStoredDensity = (): DensityMode => {
    if (typeof window === 'undefined') return 'detailed';
    const stored = window.localStorage.getItem('vextor_almanac_density');
    return stored === 'compact' ? 'compact' : 'detailed';
};

const CardShell: React.FC<{
    children: React.ReactNode;
    darkMode: boolean;
    className?: string;
}> = ({ children, darkMode, className = '' }) => (
    <div className={`vx-card min-w-0 rounded-xl border ${darkMode ? 'border-white/10 bg-[#090d14]' : 'border-slate-300/80 bg-white/95'} ${className}`}>
        {children}
    </div>
);

const DataPill: React.FC<{
    children: React.ReactNode;
    tone: ToneStyle;
    className?: string;
}> = ({ children, tone, className = '' }) => (
    <span className={`vx-mono inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${tone.bg} ${tone.border} ${tone.text} ${className}`}>
        {children}
    </span>
);

const StatPanel: React.FC<{
    label: string;
    value: React.ReactNode;
    darkMode: boolean;
    tone: ToneStyle;
    icon?: LucideIcon;
}> = ({ label, value, darkMode, tone, icon: Icon }) => (
    <div className={`min-w-0 rounded-lg border p-3 ${darkMode ? 'border-white/8 bg-black/30' : 'border-slate-200 bg-slate-50'}`}>
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
            {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.text}`} />}
            <span className={`vx-mono truncate text-[9px] font-bold uppercase tracking-[0.22em] ${darkMode ? 'text-white/35' : 'text-slate-400'}`}>{label}</span>
        </div>
        <div className={`vx-mono min-w-0 break-words text-lg font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{value}</div>
    </div>
);

const SectionTitle: React.FC<{
    icon: LucideIcon;
    title: string;
    eyebrow: string;
    desc?: string;
    darkMode: boolean;
    tone: ToneStyle;
}> = ({ icon: Icon, title, eyebrow, desc, darkMode, tone }) => (
    <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${tone.bg} ${tone.border}`}>
            <Icon className={`h-5 w-5 ${tone.text}`} />
        </div>
        <div className="min-w-0 flex-1">
            <p className={`vx-mono text-[9px] font-bold uppercase tracking-[0.32em] ${tone.softText}`}>{eyebrow}</p>
            <h3 className={`mt-1 break-words text-2xl font-bold uppercase italic tracking-tight sm:text-3xl ${darkMode ? 'text-white' : 'text-slate-950'}`}>{title}</h3>
            {desc && <p className={`mt-1.5 max-w-4xl text-sm font-medium leading-6 ${darkMode ? 'text-white/46' : 'text-slate-500'}`}>{desc}</p>}
        </div>
        <div className={`hidden h-px min-w-[120px] flex-1 bg-gradient-to-r ${tone.line} xl:block`} />
    </div>
);

const CategoryButton: React.FC<{
    category: CategoryMeta;
    isActive: boolean;
    darkMode: boolean;
    performanceMode: boolean;
    onClick: () => void;
}> = ({ category, isActive, darkMode, performanceMode, onClick }) => {
    const Icon = category.icon;
    const tone = TONE[category.tone];

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${isActive
                ? `${tone.bg} ${tone.borderStrong}`
                : darkMode
                    ? 'border-transparent text-white/45 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/85'
                    : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'}`}
        >
            {isActive && !performanceMode && (
                <motion.span
                    layoutId="almanac-active-rail"
                    className={`absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full ${tone.bgStrong}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                />
            )}
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${isActive ? `${tone.bg} ${tone.border}` : darkMode ? 'border-white/8 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                <Icon className={`h-4 w-4 ${isActive ? tone.text : 'text-current'}`} />
            </span>
            <span className="hidden min-w-0 flex-1 xl:block">
                <span className={`block truncate text-[11px] font-bold uppercase tracking-[0.2em] ${isActive ? tone.text : ''}`}>{category.shortLabel}</span>
                <span className={`mt-0.5 block truncate text-[9px] font-semibold ${darkMode ? 'text-white/24' : 'text-slate-400'}`}>{category.subtitle}</span>
            </span>
            <ChevronRight className={`hidden h-3.5 w-3.5 shrink-0 xl:block ${isActive ? tone.text : 'opacity-25'}`} />
        </button>
    );
};

const NoResults: React.FC<{
    query: string;
    darkMode: boolean;
    tone: ToneStyle;
    onClear: () => void;
}> = ({ query, darkMode, tone, onClear }) => (
    <CardShell darkMode={darkMode} className="flex min-h-[260px] items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-xl border ${tone.bg} ${tone.border}`}>
                <Search className={`h-6 w-6 ${tone.text}`} />
            </div>
            <div>
                <h3 className={`text-2xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>No Intel Found</h3>
                <p className={`mt-2 text-sm font-medium leading-6 ${darkMode ? 'text-white/48' : 'text-slate-500'}`}>
                    Nothing matched <span className={tone.text}>“{query}”</span>. Try a tank, rarity, boss, shape, trait, or ability name.
                </p>
            </div>
            <button
                type="button"
                onClick={onClear}
                className={`rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${tone.button} ${tone.border} ${tone.buttonText}`}
            >
                Clear Search
            </button>
        </div>
    </CardShell>
);

const QuickIntelList: React.FC<{
    items: Array<{ label: string; value: string }>;
    darkMode: boolean;
    tone: ToneStyle;
    columns?: string;
}> = ({ items, darkMode, tone, columns = 'grid-cols-1 sm:grid-cols-3' }) => (
    <div className={`grid gap-2 ${columns}`}>
        {items.map((item) => (
            <div key={`${item.label}-${item.value}`} className={`rounded-lg border px-3 py-3 ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-slate-50'}`}>
                <div className={`vx-mono text-[9px] font-bold uppercase tracking-[0.18em] ${tone.softText}`}>{item.label}</div>
                <div className={`mt-1 text-sm font-semibold leading-5 ${darkMode ? 'text-white/72' : 'text-slate-700'}`}>{item.value}</div>
            </div>
        ))}
    </div>
);

export const AlmanacModal: React.FC<AlmanacModalProps> = ({ onClose, darkMode, playSound }) => {
    const prefersReducedMotion = useReducedMotion();
    const [activeCategory, setActiveCategory] = useState<MainCategory>('RESOURCES');
    const [selectedShape, setSelectedShape] = useState<ShapeType>(ShapeType.SQUARE);
    const [searchQuery, setSearchQuery] = useState('');
    const [density, setDensity] = useState<DensityMode>(() => getStoredDensity());
    const [performanceMode, setPerformanceMode] = useState(() => getStoredBoolean('vextor_almanac_performance', true));
    const [shapeSort, setShapeSort] = useState<SortMode>('name');
    const [scrollProgress, setScrollProgress] = useState(0);

    const contentRef = useRef<HTMLElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const scrollFrameRef = useRef<number | null>(null);

    const debouncedSearch = useDebouncedValue(searchQuery, 130);
    const normalizedQuery = useMemo(() => normalizeSearch(debouncedSearch), [debouncedSearch]);
    const lowMotion = Boolean(prefersReducedMotion || performanceMode);
    const compactMode = density === 'compact';

    const activeMeta = useMemo(() => CATEGORIES.find(category => category.id === activeCategory) ?? CATEGORIES[0], [activeCategory]);
    const activeTone = TONE[activeMeta.tone];
    const ActiveIcon = activeMeta.icon;

    const shapes = useMemo(() => Object.values(ShapeType) as ShapeType[], []);
    const rarities = useMemo(() => Object.values(ShapeRarity) as ShapeRarity[], []);

    const bosses = useMemo<BossStatView[]>(() => {
        return Object.entries(BOSS_STATS).map(([id, raw]) => {
            const boss = raw as Partial<BossStatView> & Record<string, unknown>;
            return {
                id,
                name: String(boss.name ?? formatLabel(id)),
                description: String(boss.description ?? 'Boss-tier entity with high durability and high reward value.'),
                health: Number(boss.health ?? 0),
                xp: Number(boss.xp ?? 0),
                damage: typeof boss.damage === 'number' ? boss.damage : undefined,
                radius: typeof boss.radius === 'number' ? boss.radius : undefined,
            };
        });
    }, []);

    const filteredShapes = useMemo(() => {
        const results = shapes.filter(shape => {
            const base = SHAPE_STATS[shape];
            return matchesSearch(normalizedQuery, shape, formatLabel(String(shape)), base?.xp, base?.health, base?.damage, ...getShapeStrategy(shape));
        });

        return [...results].sort((a, b) => {
            if (shapeSort === 'xp') return (SHAPE_STATS[b]?.xp ?? 0) - (SHAPE_STATS[a]?.xp ?? 0);
            if (shapeSort === 'health') return (SHAPE_STATS[b]?.health ?? 0) - (SHAPE_STATS[a]?.health ?? 0);
            return formatLabel(String(a)).localeCompare(formatLabel(String(b)));
        });
    }, [normalizedQuery, shapeSort, shapes]);

    const filteredClassRoles = useMemo(() => {
        return Object.entries(CLASS_ROLES)
            .map(([role, data]) => ({
                role,
                data: {
                    ...data,
                    classes: data.classes.filter(tankClass => matchesSearch(normalizedQuery, role, data.label, data.desc, tankClass, formatTankName(tankClass), TANK_CONFIGS[tankClass]?.length)),
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
                    classes: data.classes.filter(tankClass => matchesSearch(normalizedQuery, role, data.label, data.desc, tankClass, formatTankName(tankClass))),
                },
            }))
            .filter(({ data }) => data.classes.length > 0 || matchesSearch(normalizedQuery, data.label, data.desc));
    }, [normalizedQuery]);

    const filteredBosses = useMemo(() => {
        return bosses.filter(boss => matchesSearch(normalizedQuery, boss.id, boss.name, boss.description, boss.health, boss.xp, boss.damage, boss.radius));
    }, [bosses, normalizedQuery]);

    const filteredTraits = useMemo(() => {
        return TACTICAL_TRAITS.filter(trait => matchesSearch(normalizedQuery, trait.name, trait.key, trait.desc));
    }, [normalizedQuery]);

    const visibleEntryCount = useMemo(() => {
        switch (activeCategory) {
            case 'RESOURCES': return filteredShapes.length + rarities.length;
            case 'CHASSIS': return filteredClassRoles.reduce((total, section) => total + section.data.classes.length, 0);
            case 'BOSSES': return filteredBossRoles.reduce((total, section) => total + section.data.classes.length, 0);
            case 'THREATS': return filteredBosses.length + 5;
            case 'VOID': return 4;
            case 'ABILITIES': return filteredTraits.length + 3;
            default: return 0;
        }
    }, [activeCategory, filteredBossRoles, filteredBosses.length, filteredClassRoles, filteredShapes.length, filteredTraits.length, rarities.length]);

    useEffect(() => {
        window.localStorage.setItem('vextor_almanac_density', density);
    }, [density]);

    useEffect(() => {
        window.localStorage.setItem('vextor_almanac_performance', String(performanceMode));
    }, [performanceMode]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchInputRef.current?.focus();
            }

            if (event.altKey) {
                const index = Number(event.key) - 1;
                if (Number.isInteger(index) && CATEGORIES[index]) {
                    event.preventDefault();
                    setActiveCategory(CATEGORIES[index].id);
                    requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: 'auto' }));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
            if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
        };
    }, [onClose]);

    const scrollToTop = useCallback(() => {
        playSound?.();
        contentRef.current?.scrollTo({ top: 0, behavior: lowMotion ? 'auto' : 'smooth' });
    }, [lowMotion, playSound]);

    const handleCategoryChange = useCallback((category: MainCategory) => {
        playSound?.();
        setActiveCategory(category);
        setScrollProgress(0);
        requestAnimationFrame(() => contentRef.current?.scrollTo({ top: 0, behavior: lowMotion ? 'auto' : 'smooth' }));
    }, [lowMotion, playSound]);

    const handleContentScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
        const element = event.currentTarget;
        if (scrollFrameRef.current !== null) return;

        scrollFrameRef.current = window.requestAnimationFrame(() => {
            const max = element.scrollHeight - element.clientHeight;
            setScrollProgress(max <= 0 ? 0 : clamp(element.scrollTop / max));
            scrollFrameRef.current = null;
        });
    }, []);

    const clearSearch = useCallback(() => setSearchQuery(''), []);

    const renderOverview = () => (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <CardShell darkMode={darkMode} className="overflow-hidden p-4 sm:p-5">
                <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                        <DataPill tone={activeTone}><Database className="h-3.5 w-3.5" /> Tactical Index</DataPill>
                        <h2 className={`mt-3 break-words text-2xl font-bold uppercase italic tracking-tight sm:text-3xl ${darkMode ? 'text-white' : 'text-slate-950'}`}>{activeMeta.label}</h2>
                        <p className={`mt-1.5 max-w-3xl text-sm font-medium leading-6 ${darkMode ? 'text-white/45' : 'text-slate-500'}`}>
                            Cleaner field-guide layout, faster search, safer scrolling, reduced effects, and readable data tables that do not nuke the screen on mobile.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:min-w-[340px]">
                        <StatPanel label="Shapes" value={shapes.length} darkMode={darkMode} tone={activeTone} icon={Box} />
                        <StatPanel label="Classes" value={countClasses(CLASS_ROLES) + countClasses(BOSS_TANK_DATA)} darkMode={darkMode} tone={activeTone} icon={Shield} />
                        <StatPanel label="Visible" value={visibleEntryCount} darkMode={darkMode} tone={activeTone} icon={Eye} />
                    </div>
                </div>
            </CardShell>

            <CardShell darkMode={darkMode} className="p-4 sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className={`vx-mono text-[9px] font-bold uppercase tracking-[0.24em] ${darkMode ? 'text-white/30' : 'text-slate-400'}`}>Optimisation</p>
                        <h3 className={`mt-1 text-lg font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{performanceMode ? 'Performance mode on' : 'Visual mode on'}</h3>
                        <p className={`mt-1 text-xs font-semibold leading-5 ${darkMode ? 'text-white/42' : 'text-slate-500'}`}>
                            Performance mode removes the expensive glow/scanline stuff. Keep this on if the modal used to stutter.
                        </p>
                    </div>
                    <Activity className={`h-5 w-5 shrink-0 ${performanceMode ? 'text-emerald-400' : activeTone.text}`} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setPerformanceMode(value => !value)}
                        className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${performanceMode ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300' : `${activeTone.button} ${activeTone.border} ${activeTone.buttonText}`}`}
                    >
                        {performanceMode ? 'Perf On' : 'Perf Off'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setDensity(value => value === 'compact' ? 'detailed' : 'compact')}
                        className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${activeTone.button} ${activeTone.border} ${activeTone.buttonText}`}
                    >
                        {compactMode ? 'Detailed' : 'Compact'}
                    </button>
                </div>
            </CardShell>
        </div>
    );

    const renderResources = () => {
        if (normalizedQuery && filteredShapes.length === 0) {
            return <NoResults query={debouncedSearch} darkMode={darkMode} tone={activeTone} onClear={clearSearch} />;
        }

        const visibleShape = filteredShapes.includes(selectedShape) ? selectedShape : (filteredShapes[0] ?? selectedShape);
        const base = SHAPE_STATS[visibleShape];
        const strategies = getShapeStrategy(visibleShape);

        return (
            <div className="space-y-4">
                <CardShell darkMode={darkMode} className="p-4 sm:p-5">
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <SectionTitle icon={Box} title="Resource Index" eyebrow="Shape families" desc="Inspect base XP, durability, rarity scaling, and farming notes without the old bloated card spam." tone={activeTone} darkMode={darkMode} />
                        <div className="flex flex-wrap gap-2">
                            {(['name', 'xp', 'health'] as SortMode[]).map(mode => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setShapeSort(mode)}
                                    className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${shapeSort === mode ? `${activeTone.bg} ${activeTone.borderStrong} ${activeTone.text}` : darkMode ? 'border-white/8 bg-white/[0.03] text-white/50 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'}`}
                                >
                                    Sort {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {filteredShapes.map(shape => {
                            const active = shape === visibleShape;
                            const shapeStats = SHAPE_STATS[shape];
                            return (
                                <button
                                    key={shape}
                                    type="button"
                                    onClick={() => { playSound?.(); setSelectedShape(shape); }}
                                    className={`vx-card-hover min-w-0 rounded-lg border p-3 text-left ${active ? `${activeTone.bg} ${activeTone.borderStrong}` : darkMode ? 'border-white/8 bg-white/[0.03] text-white/60 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-950'}`}
                                >
                                    <p className={`truncate text-sm font-bold uppercase tracking-[0.14em] ${active ? activeTone.text : ''}`}>{formatLabel(String(shape))}</p>
                                    <p className={`mt-1 truncate text-[11px] font-semibold ${darkMode ? 'text-white/32' : 'text-slate-400'}`}>{shapeStats?.xp?.toLocaleString() ?? 0} XP</p>
                                </button>
                            );
                        })}
                    </div>
                </CardShell>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <CardShell darkMode={darkMode} className="p-4 sm:p-5">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border ${darkMode ? 'border-white/8 bg-black/35' : 'border-slate-200 bg-slate-50'}`}>
                                <ShapePreview type={visibleShape} rarity={ShapeRarity.COMMON} size={46} />
                            </div>
                            <div className="min-w-0">
                                <p className={`vx-mono text-[9px] font-bold uppercase tracking-[0.22em] ${activeTone.softText}`}>Selected Resource</p>
                                <h3 className={`truncate text-2xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{formatLabel(String(visibleShape))}</h3>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <StatPanel label="Base XP" value={base?.xp?.toLocaleString() ?? '0'} darkMode={darkMode} tone={activeTone} />
                            <StatPanel label="Base HP" value={base?.health?.toLocaleString() ?? '0'} darkMode={darkMode} tone={activeTone} />
                            <StatPanel label="Sides" value={String(base?.sides ?? 0)} darkMode={darkMode} tone={activeTone} />
                            <StatPanel label="Damage" value={String(base?.damage ?? 0)} darkMode={darkMode} tone={activeTone} />
                        </div>

                        <div className="mt-4">
                            <QuickIntelList
                                darkMode={darkMode}
                                tone={activeTone}
                                columns="grid-cols-1 sm:grid-cols-3"
                                items={strategies.map((tip, index) => ({
                                    label: index === 0 ? 'Target' : index === 1 ? 'Approach' : 'Reward',
                                    value: tip,
                                }))}
                            />
                        </div>
                    </CardShell>

                    <CardShell darkMode={darkMode} className="overflow-hidden">
                        <div className="vx-table-scroll vx-scrollbar">
                            <div className="vx-table-grid-sm">
                                <div className={`grid grid-cols-[1.1fr_.8fr_.8fr_.7fr] gap-3 border-b px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/40' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                    <span>Rarity</span><span>XP</span><span>HP</span><span>Chance</span>
                                </div>
                                {rarities.map(rarity => {
                                    const config = RARITY_CONFIG[rarity];
                                    if (!base || !config) return null;
                                    const style = getRarityStyle(rarity);
                                    const xpValue = Math.round(base.xp * config.xpMult);
                                    const hpValue = Math.round(base.health * config.hpMult);
                                    const chanceLabel = typeof config.chance === 'number' ? `${config.chance}%` : '???';

                                    return (
                                        <div key={rarity} className={`grid grid-cols-[1.1fr_.8fr_.8fr_.7fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0 ${darkMode ? 'border-white/6 text-white/70' : 'border-slate-200 text-slate-700'}`}>
                                            <span className={`font-bold uppercase tracking-[0.12em] ${style.text}`}>{formatLabel(String(rarity))}</span>
                                            <span className="vx-mono">{xpValue.toLocaleString()}</span>
                                            <span className="vx-mono">{hpValue.toLocaleString()}</span>
                                            <span className="vx-mono">{chanceLabel}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardShell>
                </div>
            </div>
        );
    };

    const renderChassis = () => {
        if (filteredClassRoles.length === 0) return <NoResults query={debouncedSearch} darkMode={darkMode} tone={activeTone} onClear={clearSearch} />;

        return (
            <div className="space-y-4">
                {filteredClassRoles.map(({ role, data }) => {
                    const Icon = data.icon;
                    return (
                        <CardShell key={role} darkMode={darkMode} className="overflow-hidden">
                            <div className="px-4 py-4 sm:px-5">
                                <SectionTitle icon={Icon} title={role} eyebrow={data.label} desc={data.desc} tone={activeTone} darkMode={darkMode} />
                            </div>
                            <div className="vx-table-scroll vx-scrollbar">
                                <div className="vx-table-grid">
                                    <div className={`grid grid-cols-[1.1fr_.55fr_.65fr_1fr] gap-3 border-y px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/40' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                        <span>Class</span><span>Barrels</span><span>Complexity</span><span>Battle Use</span>
                                    </div>
                                    {data.classes.map(tankClass => {
                                        const barrels = TANK_CONFIGS[tankClass]?.length ?? 1;
                                        return (
                                            <div key={tankClass} className={`grid grid-cols-[1.1fr_.55fr_.65fr_1fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0 ${darkMode ? 'border-white/6 text-white/70' : 'border-slate-200 text-slate-700'}`}>
                                                <span className={`font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-white' : 'text-slate-950'}`}>{formatTankName(tankClass)}</span>
                                                <span className="vx-mono">{barrels}</span>
                                                <span className="vx-mono">{getTankComplexity(tankClass)}/5</span>
                                                <span className={darkMode ? 'text-white/56' : 'text-slate-500'}>{getClassBrief(tankClass)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardShell>
                    );
                })}
            </div>
        );
    };

    const renderBosses = () => {
        if (filteredBossRoles.length === 0) return <NoResults query={debouncedSearch} darkMode={darkMode} tone={activeTone} onClear={clearSearch} />;

        return (
            <div className="space-y-4">
                {filteredBossRoles.map(({ role, data }) => {
                    const Icon = data.icon;
                    return (
                        <CardShell key={role} darkMode={darkMode} className="p-4 sm:p-5">
                            <SectionTitle icon={Icon} title={role} eyebrow={data.label} desc={data.desc} tone={activeTone} darkMode={darkMode} />
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                {data.classes.map(tankClass => {
                                    const identity = getBossIdentity(tankClass);
                                    return (
                                    <div key={tankClass} className={`vx-card-hover rounded-xl border p-4 ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-slate-50'}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={`vx-mono text-[9px] font-bold uppercase tracking-[0.22em] ${activeTone.softText}`}>Titan Class</p>
                                                <h4 className={`truncate text-xl font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>{formatTankName(tankClass)}</h4>
                                            </div>
                                            <Crown className={`h-5 w-5 shrink-0 ${activeTone.text}`} />
                                        </div>
                                        <div className="mt-3">
                                            <DataPill tone={activeTone}>{identity.role}</DataPill>
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 gap-2">
                                            {identity.notes.map((note) => (
                                                <div key={note} className={`rounded-lg border px-3 py-2 text-sm font-semibold leading-5 ${darkMode ? 'border-white/8 bg-black/20 text-white/62' : 'border-slate-200 bg-white text-slate-600'}`}>
                                                    {note}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </CardShell>
                    );
                })}
            </div>
        );
    };

    const renderThreats = () => {
        if (filteredBosses.length === 0) return <NoResults query={debouncedSearch} darkMode={darkMode} tone={activeTone} onClear={clearSearch} />;

        return (
            <div className="space-y-4">
                <CardShell darkMode={darkMode} className="overflow-hidden">
                    <div className="px-4 py-4 sm:px-5">
                        <SectionTitle icon={Skull} title="Threat Register" eyebrow="Hostile entities" desc="Boss-tier targets, elite frames, and objective defenders arranged as a quick combat register." tone={activeTone} darkMode={darkMode} />
                    </div>
                    <div className="vx-table-scroll vx-scrollbar">
                        <div className="vx-table-grid">
                            <div className={`grid grid-cols-[1fr_.8fr_.7fr_1.8fr] gap-3 border-y px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/40' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                <span>Threat</span><span>Integrity</span><span>XP</span><span>Combat Read</span>
                            </div>
                            {filteredBosses.map(boss => (
                                <div key={boss.id} className={`grid grid-cols-[1fr_.8fr_.7fr_1.8fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0 ${darkMode ? 'border-white/6 text-white/70' : 'border-slate-200 text-slate-700'}`}>
                                    <div className="min-w-0">
                                        <p className={`truncate font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-white' : 'text-slate-950'}`}>{boss.name}</p>
                                        <p className={`mt-1 text-[10px] font-bold uppercase tracking-[0.16em] ${activeTone.text}`}>{formatLabel(boss.id)}</p>
                                    </div>
                                    <span className="vx-mono">{boss.health.toLocaleString()} HP</span>
                                    <span className="vx-mono">{boss.xp.toLocaleString()}</span>
                                    <div className="space-y-1">
                                        {getThreatProfile(boss).map((item) => (
                                            <div key={`${boss.id}-${item.label}`} className={`text-[12px] leading-5 ${darkMode ? 'text-white/58' : 'text-slate-500'}`}>
                                                <span className={`mr-2 font-bold uppercase tracking-[0.12em] ${activeTone.text}`}>{item.label}</span>
                                                <span>{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardShell>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <CardShell darkMode={darkMode} className="p-4 sm:p-5">
                        <SectionTitle icon={Zap} title="Elite Incursions" eyebrow="Mimic threats" desc="Advanced class variants that punish greedy rotations and weak positioning." tone={TONE.amber} darkMode={darkMode} />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {[TankClass.DESTROYER, TankClass.SNIPER, TankClass.OVERLORD].map(tankClass => (
                                <div key={tankClass} className={`rounded-lg border px-3 py-2 text-sm font-bold uppercase tracking-[0.1em] ${darkMode ? 'border-white/8 bg-black/25 text-white/65' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                    {formatTankName(tankClass)}
                                </div>
                            ))}
                        </div>
                    </CardShell>
                    <CardShell darkMode={darkMode} className="p-4 sm:p-5">
                        <SectionTitle icon={Shield} title="Security Automata" eyebrow="Objective defense" desc="Crasher and alpha frames protect critical zones through contact pressure and area denial." tone={TONE.red} darkMode={darkMode} />
                        <div className="grid grid-cols-2 gap-2">
                            <StatPanel label="Crasher" value="40 HP" darkMode={darkMode} tone={TONE.red} icon={Activity} />
                            <StatPanel label="Alpha" value="250 HP" darkMode={darkMode} tone={TONE.red} icon={Crown} />
                        </div>
                    </CardShell>
                </div>
            </div>
        );
    };

    const renderVoid = () => (
        <div className="space-y-4">
            <CardShell darkMode={darkMode} className="p-4 sm:p-5">
                <SectionTitle icon={Aperture} title="Dimensional Rift" eyebrow="Void research" desc="A readable summary of rift farming without trying to run an entire animated scene inside the modal." tone={activeTone} darkMode={darkMode} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className={`flex h-44 items-center justify-center rounded-xl border ${darkMode ? 'border-white/8 bg-black/35' : 'border-slate-200 bg-slate-50'}`}>
                        <ShapePreview type={VOID_PORTAL_PREVIEW} rarity={ShapeRarity.COMMON} size={112} />
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <StatPanel label="Yield Gain" value="1000%" darkMode={darkMode} tone={activeTone} icon={Zap} />
                            <StatPanel label="Stability" value="Volatile" darkMode={darkMode} tone={activeTone} icon={Activity} />
                            <StatPanel label="Cycle Rate" value="5:00m" darkMode={darkMode} tone={activeTone} icon={Database} />
                        </div>
                        <QuickIntelList
                            darkMode={darkMode}
                            tone={activeTone}
                            columns="grid-cols-1 sm:grid-cols-3"
                            items={[
                                { label: 'Upside', value: 'Rift farming massively boosts yield and rarity quality.' },
                                { label: 'Risk', value: 'Instability, collapses, and enemy rotates punish greed fast.' },
                                { label: 'Priority', value: 'Take speed, escape tools, and route awareness over raw DPS.' },
                            ]}
                        />
                    </div>
                </div>
            </CardShell>
        </div>
    );

    const renderAbilities = () => {
        if (filteredTraits.length === 0) return <NoResults query={debouncedSearch} darkMode={darkMode} tone={activeTone} onClear={clearSearch} />;

        return (
            <div className="space-y-4">
                <CardShell darkMode={darkMode} className="overflow-hidden">
                    <div className="px-4 py-4 sm:px-5">
                        <SectionTitle icon={Cpu} title="Tactical Traits" eyebrow="Ability register" desc="Passives and actives as a clean operations list instead of laggy oversized cards." tone={activeTone} darkMode={darkMode} />
                    </div>
                    <div className="divide-y divide-white/6">
                        {filteredTraits.map(trait => {
                            const Icon = trait.icon;
                            return (
                                <div key={trait.name} className={`grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 lg:grid-cols-[auto_minmax(160px,.65fr)_minmax(0,1fr)] ${darkMode ? 'text-white/70' : 'text-slate-700'}`}>
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${activeTone.bg} ${activeTone.border}`}>
                                        <Icon className={`h-4 w-4 ${activeTone.text}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-white' : 'text-slate-950'}`}>{trait.name}</p>
                                        <p className={`vx-mono mt-1 text-[10px] font-bold uppercase tracking-[0.18em] ${activeTone.softText}`}>{trait.key}</p>
                                    </div>
                                    <div className="col-span-2 lg:col-span-1 space-y-2">
                                        <p className={`text-sm leading-6 ${darkMode ? 'text-white/54' : 'text-slate-500'}`}>{trait.desc}</p>
                                        <DataPill tone={activeTone} className="w-fit max-w-full">{getTraitFocus(trait)}</DataPill>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardShell>

                <CardShell darkMode={darkMode} className="p-4 sm:p-5">
                    <SectionTitle icon={Info} title="Pilot Synergy Protocols" eyebrow="Build discipline" desc="Use a simple stat spine: one fire-rate pick, one projectile pick, one survival or movement pick." tone={activeTone} darkMode={darkMode} />
                    <QuickIntelList
                        darkMode={darkMode}
                        tone={activeTone}
                        columns="grid-cols-1 sm:grid-cols-3"
                        items={[
                            { label: 'Fire Rate', value: formatLabel(String(StatType.RELOAD)) },
                            { label: 'Projectile', value: formatLabel(String(StatType.BULLET_SPEED)) },
                            { label: 'Mobility', value: formatLabel(String(StatType.MOVEMENT_SPEED)) },
                        ]}
                    />
                </CardShell>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeCategory) {
            case 'RESOURCES': return renderResources();
            case 'CHASSIS': return renderChassis();
            case 'BOSSES': return renderBosses();
            case 'THREATS': return renderThreats();
            case 'VOID': return renderVoid();
            case 'ABILITIES': return renderAbilities();
            default: return renderResources();
        }
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: ALMANAC_STYLES }} />
            <motion.div
                className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden p-1 sm:p-4 lg:p-6"
                style={{ background: 'rgba(0,0,0,.86)' }}
                initial={lowMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={lowMotion ? { opacity: 1 } : { opacity: 0 }}
                onMouseDown={onClose}
            >
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="almanac-title"
                    onMouseDown={event => event.stopPropagation()}
                    className={`vx-modal ${performanceMode ? 'vx-perf' : 'vx-grid-bg vx-scanlines'} relative flex h-[calc(100dvh-.5rem)] max-h-[94dvh] w-full max-w-[1640px] min-w-0 overflow-hidden rounded-2xl border shadow-2xl sm:h-[94dvh] ${darkMode ? 'border-white/12 bg-[#030508] text-white shadow-black' : 'border-slate-300 bg-[#f5f2ea] text-slate-950 shadow-slate-900/20'}`}
                    initial={lowMotion ? false : { scale: .985, y: 16, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={lowMotion ? { opacity: 1 } : { scale: .985, y: 12, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 32 }}
                >
                    {!performanceMode && (
                        <div className="pointer-events-none absolute inset-0 overflow-hidden">
                            <div className={`absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-30 ${activeTone.bg}`} />
                            <div className={`absolute -bottom-32 right-8 h-80 w-80 rounded-full blur-3xl opacity-25 ${activeTone.bg}`} />
                        </div>
                    )}

                    <aside className={`relative z-10 hidden w-[92px] shrink-0 flex-col border-r p-3 lg:flex xl:w-[304px] ${darkMode ? 'border-white/8 bg-black/35' : 'border-slate-200 bg-white/60'}`}>
                        <div className={`mb-3 flex min-w-0 items-center gap-3 rounded-xl border p-3 ${darkMode ? 'border-amber-400/20 bg-amber-400/[0.06]' : 'border-amber-300/40 bg-amber-50/70'}`}>
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${darkMode ? 'border-amber-400/25 bg-amber-400/10' : 'border-amber-300/50 bg-amber-100/70'}`}>
                                <Database className="h-5 w-5 text-amber-400" />
                            </div>
                            <div className="hidden min-w-0 xl:block">
                                <h2 className={`vx-mono truncate text-base font-bold uppercase italic tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>VEXTOR_OS</h2>
                                <p className="vx-mono truncate text-[9px] font-bold uppercase tracking-[0.3em] text-amber-400/60">Tactical Database</p>
                            </div>
                        </div>

                        <nav className={`min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 ${darkMode ? 'vx-scrollbar' : 'vx-scrollbar-light'}`} aria-label="Almanac categories">
                            {CATEGORIES.map(category => (
                                <CategoryButton
                                    key={category.id}
                                    category={category}
                                    isActive={activeCategory === category.id}
                                    darkMode={darkMode}
                                    performanceMode={performanceMode}
                                    onClick={() => handleCategoryChange(category.id)}
                                />
                            ))}
                        </nav>

                        <button
                            type="button"
                            onClick={onClose}
                            className={`mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border p-3 transition-colors ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/45 hover:border-red-400/35 hover:bg-red-400/[0.07] hover:text-red-300' : 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500'}`}
                        >
                            <X className="h-4 w-4" />
                            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] xl:block">Close</span>
                        </button>
                    </aside>

                    <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
                        <header className={`shrink-0 border-b px-4 py-3 sm:px-6 ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white/55'}`}>
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                    <div className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border sm:flex ${activeTone.bg} ${activeTone.border}`}>
                                        <ActiveIcon className={`h-6 w-6 ${activeTone.text}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <DataPill tone={activeTone}><Search className="h-3 w-3" /> {activeMeta.shortLabel}</DataPill>
                                        <h1 id="almanac-title" className={`mt-1.5 break-words text-2xl font-bold uppercase italic tracking-tight sm:text-3xl lg:text-4xl ${darkMode ? 'text-white' : 'text-slate-950'}`}>{activeMeta.label}</h1>
                                        <p className={`mt-1 max-w-2xl text-xs font-semibold leading-5 ${darkMode ? 'text-white/40' : 'text-slate-500'}`}>{activeMeta.subtitle}</p>
                                    </div>
                                </div>

                                <div className={`hidden min-w-[260px] max-w-[440px] flex-1 items-center gap-2 rounded-xl border px-3 py-2 xl:flex ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white'}`}>
                                    <Search className={`h-4 w-4 shrink-0 ${activeTone.text}`} />
                                    <input
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChange={event => setSearchQuery(event.target.value)}
                                        placeholder="Search tanks, traits, bosses..."
                                        className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-medium ${darkMode ? 'text-white placeholder:text-white/24' : 'text-slate-900 placeholder:text-slate-400'}`}
                                    />
                                    {searchQuery && (
                                        <button type="button" onClick={clearSearch} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
                                            Clear
                                        </button>
                                    )}
                                    <span className={`vx-mono rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${darkMode ? 'border-white/8 text-white/25' : 'border-slate-200 text-slate-400'}`}>Ctrl K</span>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <div className={`hidden items-center gap-2.5 rounded-xl border px-3 py-2 md:flex ${performanceMode ? darkMode ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-emerald-300/40 bg-emerald-50/70' : darkMode ? 'border-amber-400/20 bg-amber-400/[0.06]' : 'border-amber-300/40 bg-amber-50/70'}`}>
                                        <Activity className={`h-3.5 w-3.5 ${performanceMode ? 'text-emerald-400' : 'text-amber-400'}`} />
                                        <div className="text-right">
                                            <p className={`vx-mono text-[8px] font-bold uppercase tracking-[0.2em] ${darkMode ? 'text-white/28' : 'text-slate-400'}`}>Mode</p>
                                            <p className={`vx-mono text-[9px] font-bold uppercase tracking-[0.2em] ${performanceMode ? 'text-emerald-400' : 'text-amber-400'}`}>{performanceMode ? 'Fast' : 'Visual'}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        aria-label="Close almanac"
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/60 hover:border-red-400/35 hover:bg-red-400/[0.07] hover:text-red-300' : 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500'}`}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2 xl:hidden">
                                <div className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white'}`}>
                                    <Search className={`h-4 w-4 shrink-0 ${activeTone.text}`} />
                                    <input
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChange={event => setSearchQuery(event.target.value)}
                                        placeholder="Search almanac..."
                                        className={`min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-medium ${darkMode ? 'text-white placeholder:text-white/24' : 'text-slate-900 placeholder:text-slate-400'}`}
                                    />
                                    {searchQuery && <button type="button" onClick={clearSearch} className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100">Clear</button>}
                                </div>
                            </div>

                            <div className={`mt-3 h-1 overflow-hidden rounded-full ${darkMode ? 'bg-white/[0.06]' : 'bg-slate-200'}`} aria-hidden="true">
                                <div className={`h-full ${activeTone.bgStrong}`} style={{ width: `${Math.round(scrollProgress * 100)}%`, transition: lowMotion ? 'none' : 'width .12s linear' }} />
                            </div>
                        </header>

                        <nav className={`relative z-20 shrink-0 border-b py-2 lg:hidden ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white/55'}`} aria-label="Almanac categories">
                            <div className="vx-no-scrollbar flex min-w-0 snap-x gap-1.5 overflow-x-auto px-4 py-1">
                                {CATEGORIES.map(category => {
                                    const Icon = category.icon;
                                    const tone = TONE[category.tone];
                                    const active = activeCategory === category.id;
                                    return (
                                        <button
                                            key={category.id}
                                            type="button"
                                            onClick={() => handleCategoryChange(category.id)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${active ? `${tone.bg} ${tone.borderStrong} ${tone.text}` : darkMode ? 'border-white/8 bg-white/[0.03] text-white/42 hover:text-white/75' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'}`}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {category.shortLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </nav>

                        <section
                            ref={contentRef}
                            onScroll={handleContentScroll}
                            className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-7 lg:py-7 ${darkMode ? 'vx-scrollbar' : 'vx-scrollbar-light'}`}
                        >
                            <div className={`mx-auto flex w-full max-w-[1320px] min-w-0 flex-col gap-4 ${compactMode ? 'text-[.94rem]' : ''}`}>
                                <div
                                    className={`sticky top-0 z-20 overflow-hidden transition-all duration-200 ${scrollProgress > 0.015 ? 'pointer-events-none max-h-0 -translate-y-3 opacity-0 mb-0' : 'max-h-40 translate-y-0 opacity-100 mb-1'}`}
                                    aria-hidden={scrollProgress > 0.015}
                                >
                                <div className={`rounded-xl border px-3 py-3 backdrop-blur-xl sm:px-4 ${darkMode ? 'border-white/8 bg-[#030508]/90' : 'border-slate-200/90 bg-[#f5f2ea]/94'}`}>
                                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <DataPill tone={activeTone}><Database className="h-3.5 w-3.5" /> {activeMeta.shortLabel}</DataPill>
                                            <DataPill tone={activeTone} className={darkMode ? 'text-white/75' : 'text-slate-700'}><Info className="h-3.5 w-3.5" /> {visibleEntryCount} visible</DataPill>
                                            {searchQuery && <DataPill tone={activeTone}><Search className="h-3.5 w-3.5" /> {searchQuery}</DataPill>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPerformanceMode(value => !value)}
                                                className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${performanceMode ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : `${activeTone.button} ${activeTone.border} ${activeTone.buttonText}`}`}
                                            >
                                                {performanceMode ? 'Perf On' : 'Visuals On'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDensity(value => value === 'compact' ? 'detailed' : 'compact')}
                                                className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${activeTone.button} ${activeTone.border} ${activeTone.buttonText}`}
                                            >
                                                <span className="inline-flex items-center gap-2"><LayoutGrid className="h-3.5 w-3.5" /> {compactMode ? 'Detailed' : 'Compact'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={scrollToTop}
                                                className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${darkMode ? 'border-white/8 bg-white/[0.03] text-white/55 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-950'}`}
                                            >
                                                <span className="inline-flex items-center gap-2"><ArrowUp className="h-3.5 w-3.5" /> Top</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                </div>

                                {renderOverview()}

                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`${activeCategory}-${density}-${performanceMode ? 'fast' : 'visual'}`}
                                        initial={lowMotion ? false : { opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={lowMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                                        transition={lowMotion ? { duration: 0 } : { duration: .16, ease: 'easeOut' }}
                                        className="min-w-0"
                                    >
                                        {renderContent()}
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {scrollProgress > .18 && (
                                <button
                                    type="button"
                                    onClick={scrollToTop}
                                    className={`sticky bottom-4 ml-auto mr-1 mt-4 flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] shadow-lg transition-colors ${darkMode ? 'border-white/10 bg-black/75 text-white/75 hover:text-white' : 'border-slate-200 bg-white/95 text-slate-700 hover:text-slate-950'}`}
                                >
                                    <ArrowUp className="h-3.5 w-3.5" /> Back To Top
                                </button>
                            )}
                        </section>

                        <footer className={`hidden shrink-0 items-center justify-between gap-4 border-t px-6 py-3 md:flex ${darkMode ? 'border-white/8 bg-black/25' : 'border-slate-200 bg-white/55'}`}>
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${performanceMode ? 'bg-emerald-400' : activeTone.bgStrong} ${performanceMode ? '' : 'vx-pulse-dot'}`} />
                                <span className={`vx-mono truncate text-[9px] font-bold uppercase tracking-[0.24em] ${darkMode ? 'text-white/22' : 'text-slate-400'}`}>Terminal Active</span>
                                <span className={darkMode ? 'text-white/10' : 'text-slate-300'}>/</span>
                                <span className={`vx-mono truncate text-[9px] font-bold italic ${darkMode ? 'text-white/16' : 'text-slate-300'}`}>ALT + 1-6 categories · CTRL + K search</span>
                            </div>
                            <div className={`flex shrink-0 items-center gap-2 vx-mono text-[9px] font-bold uppercase tracking-[0.22em] ${darkMode ? 'text-white/22' : 'text-slate-400'}`}>
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
