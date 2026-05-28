import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Box, 
    Shield, 
    Skull, 
    Aperture, 
    Cpu, 
    X, 
    ChevronRight, 
    Info, 
    Zap, 
    Target, 
    Activity,
    Database,
    Lock,
    Eye,
    Crown
} from 'lucide-react';
import { ShapeType, ShapeRarity, TankClass, StatType } from '../types';
import { SHAPE_STATS, RARITY_CONFIG, BOSS_STATS, COLORS, TANK_CONFIGS, CLASS_TREE } from '../constants';
import { ShapePreview } from './ShapePreview';
import { TankPreview } from './TankPreview';

interface AlmanacModalProps {
    onClose: () => void;
    darkMode: boolean;
    playSound?: () => void;
}

type MainCategory = 'RESOURCES' | 'CHASSIS' | 'BOSSES' | 'THREATS' | 'VOID' | 'ABILITIES';

const SHAPE_STRATEGIES: Record<ShapeType, string[]> = {
    [ShapeType.SQUARE]: ["Basic resource", "Easy target for early levels", "Spawns everywhere"],
    [ShapeType.TRIANGLE]: ["Fast drift speed", "Requires basic lead aiming", "Moderate XP yield"],
    [ShapeType.PENTAGON]: ["Highly durable", "Nests in the center", "Primary level 30+ farm"],
    [ShapeType.HEXAGON]: ["Extreme durability", "Emits minor energy pulse", "High tier resource"],
    [ShapeType.OCTAGON]: ["Ancient relic", "Orbital defense lattice", "Massive XP jackpot"]
};

const CLASS_ROLES: Record<string, { label: string, desc: string, classes: TankClass[], icon: any }> = {
    "ASSAULT": {
        label: "Frontline Combatants",
        desc: "High volume of fire designed to overwhelm opponents through sheer bullet density.",
        classes: [TankClass.TWIN, TankClass.TRIPLE_SHOT, TankClass.PENTA_SHOT, TankClass.SPREAD_SHOT, TankClass.TRIPLE_TWIN],
        icon: Zap
    },
    "PRECISION": {
        label: "Long-Range Interceptors",
        desc: "Specialized in high-velocity, single-target strikes from outside standard engagement ranges.",
        classes: [TankClass.SNIPER, TankClass.ASSASSIN, TankClass.RANGER, TankClass.STALKER, TankClass.HUNTER],
        icon: Target
    },
    "IMPACT": {
        label: "Heavy Ordinance",
        desc: "Utilizes massive kinetic projectiles to crush enemy defenses and control space.",
        classes: [TankClass.MACHINE_GUN, TankClass.DESTROYER, TankClass.ANNIHILATOR, TankClass.HYBRID, TankClass.SPRAYER],
        icon: Activity
    },
    "TACTICAL": {
        label: "Advanced Command",
        desc: "Deploys autonomous units or complex turret configurations to dominate the grid.",
        classes: [TankClass.OVERSEER, TankClass.OVERLORD, TankClass.MANAGER, TankClass.OCTO_TANK, TankClass.AUTO_GUNNER],
        icon: Cpu
    }
};

const BOSS_TANK_DATA: Record<string, { label: string, desc: string, classes: TankClass[], icon: any }> = {
    "COMMANDERS": {
        label: "Rebirth Titans",
        desc: "Massive, high-tier tanks unlocked through the Rebirth system at Level 60. They possess overwhelming power but significant mobility drawbacks.",
        classes: [TankClass.COLOSSAL, TankClass.LEVIATHAN, TankClass.WARLORD],
        icon: Crown
    }
};

const TACTICAL_TRAITS = [
    {
        name: "SACRIFICIAL GOAT",
        key: "RMB / RIGHT-CLICK",
        desc: "Standard issue for Overlord/Manager classes. Converts 50% of current health into an adrenaline-fueled combat state. Increases Drone/Mini-tank damage and reload speed by 25-55%.",
        icon: Activity
    },
    {
        name: "GOLIATH RECOIL",
        key: "PASSIVE",
        desc: "Specific to Annihilator and Destroyer classes. Weapon kickback is amplified to 750% of standard levels, allowing for high-speed mobility while firing backwards.",
        icon: Zap
    },
    {
        name: "VOID SYNC",
        key: "DIMENSIONAL",
        desc: "Allows pilots to enter the Void Rift. Inside, rarity rolls for resources are boosted by 10x, but environmental stability is compromised.",
        icon: Aperture
    },
    {
        name: "SIEGE MODE",
        key: "KEY [X]",
        desc: "Exclusive to the Warlord Titan. Anchors the tank to the grid, disabling movement but granting +100% Defense, +50% Damage, and +50% Reload speed.",
        icon: Shield
    },
    {
        name: "SHOCKWAVE",
        key: "PASSIVE / TITAN",
        desc: "Exclusive to the Leviathan Titan. Periodically emits a high-energy pulse that stuns nearby enemies and destroys incoming projectiles.",
        icon: Zap
    },
    {
        name: "REBIRTH PROTOCOL",
        key: "LEVEL 60",
        desc: "Upon reaching Level 60, pilots can initiate the Rebirth Protocol. This resets your level but grants access to a Titan-Class Chassis with overwhelming power.",
        icon: Crown
    }
];

const CATEGORIES: { id: MainCategory; label: string; icon: any; color: string }[] = [
    { id: 'RESOURCES', label: 'Shapes', icon: Box, color: 'cyan' },
    { id: 'CHASSIS', label: 'Chassis', icon: Shield, color: 'blue' },
    { id: 'BOSSES', label: 'Commanders', icon: Crown, color: 'amber' },
    { id: 'THREATS', label: 'Threats', icon: Skull, color: 'red' },
    { id: 'VOID', label: 'Void', icon: Aperture, color: 'purple' },
    { id: 'ABILITIES', label: 'Traits', icon: Cpu, color: 'emerald' }
];

export const AlmanacModal: React.FC<AlmanacModalProps> = ({ onClose, darkMode, playSound }) => {
    const [activeCategory, setActiveCategory] = useState<MainCategory>('RESOURCES');
    const [subTab, setSubTab] = useState<string>('SQUARE');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const getRarityColor = (rarity: ShapeRarity) => {
        switch (rarity) {
            case ShapeRarity.COMMON: return 'text-gray-500';
            case ShapeRarity.UNCOMMON: return 'text-cyan-400';
            case ShapeRarity.RARE: return 'text-green-400';
            case ShapeRarity.EPIC: return 'text-amber-400';
            case ShapeRarity.LEGENDARY: return 'text-orange-500';
            case ShapeRarity.MYTHICAL: return 'text-indigo-400';
            case ShapeRarity.ETERNAL: return 'text-cyan-300';
            case ShapeRarity.TRANSCENDENT: return 'text-white';
            default: return 'text-gray-500';
        }
    };

    const activeCatData = CATEGORIES.find(c => c.id === activeCategory)!;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4 lg:p-8"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`
                    w-full max-w-[1600px] h-[90vh] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col overflow-hidden relative border-2 transition-all duration-500
                    ${darkMode ? 'bg-[#050505] border-white/10' : 'bg-[#f8f8f8] border-black/10'}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Sidebar Navigation */}
                <div className="flex flex-1 overflow-hidden">
                    <div className={`w-24 lg:w-72 shrink-0 border-r flex flex-col ${darkMode ? 'border-white/5 bg-black/40' : 'border-black/5 bg-white/40'}`}>
                        <div className="p-8 lg:p-10 flex items-center gap-4 border-b border-white/5">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                                <Database className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div className="hidden lg:block">
                                <h2 className="text-xl font-black italic tracking-tighter text-white uppercase leading-none">VEXTOR_OS</h2>
                                <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Tactical Database</p>
                            </div>
                        </div>

                        <nav className="flex-1 p-4 lg:p-6 space-y-2 overflow-y-auto no-scrollbar">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => { playSound?.(); setActiveCategory(cat.id); }}
                                    className={`
                                        w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group
                                        ${activeCategory === cat.id 
                                            ? `bg-${cat.color}-500/10 text-${cat.color}-400 border border-${cat.color}-500/20 shadow-lg` 
                                            : 'text-white/30 hover:text-white/60 hover:bg-white/5'}
                                    `}
                                >
                                    <cat.icon className={`w-6 h-6 ${activeCategory === cat.id ? `text-${cat.color}-400` : 'text-current'}`} />
                                    <span className="hidden lg:block text-xs font-black uppercase tracking-[0.2em]">{cat.label}</span>
                                    {activeCategory === cat.id && (
                                        <motion.div 
                                            layoutId="activeTab"
                                            className={`absolute left-0 w-1 h-8 bg-${cat.color}-500 rounded-r-full`}
                                        />
                                    )}
                                </button>
                            ))}
                        </nav>

                        <div className="p-6 border-t border-white/5">
                            <button 
                                onClick={onClose}
                                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-red-500/10 text-white/20 hover:text-red-500 transition-all group"
                            >
                                <X className="w-5 h-5" />
                                <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">Close_Terminal</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header */}
                        <header className="px-10 py-8 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <div className={`px-4 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.3em] bg-${activeCatData.color}-500/10 border-${activeCatData.color}-500/20 text-${activeCatData.color}-400`}>
                                    Section_{activeCategory}
                                </div>
                                <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase">{activeCatData.label}</h1>
                            </div>
                            <div className="flex items-center gap-4 opacity-20 hidden md:flex">
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">System_Status</span>
                                    <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Synchronized</span>
                                </div>
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                        </header>

                        {/* Content Pane */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-10">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeCategory}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="h-full"
                                >
                                    {/* RESOURCES SECTION */}
                                    {activeCategory === 'RESOURCES' && (
                                        <div className="space-y-12">
                                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                                {(Object.values(ShapeType) as ShapeType[]).map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => { playSound?.(); setSubTab(type); }}
                                                        className={`
                                                            group p-6 rounded-[2rem] border-2 flex flex-col items-center gap-4 transition-all relative overflow-hidden
                                                            ${subTab === type 
                                                                ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.2)]' 
                                                                : 'bg-white/5 border-transparent hover:bg-white/10'}
                                                        `}
                                                    >
                                                        <div className="relative z-10">
                                                            <ShapePreview type={type} rarity={ShapeRarity.COMMON} size={64} />
                                                        </div>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest relative z-10 ${subTab === type ? 'text-cyan-400' : 'text-white/30 group-hover:text-white'}`}>{type}</span>
                                                        {subTab === type && (
                                                            <motion.div 
                                                                layoutId="shapeGlow"
                                                                className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent"
                                                            />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {subTab && (
                                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                                    <div className="xl:col-span-1 space-y-6">
                                                        <div className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 flex flex-col items-center gap-8 relative overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                                                            <div className="w-48 h-48 flex items-center justify-center">
                                                                <ShapePreview type={subTab as ShapeType} rarity={ShapeRarity.COMMON} size={160} />
                                                            </div>
                                                            <div className="text-center space-y-2">
                                                                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{subTab}_CORE</h3>
                                                                <p className="text-[10px] font-black text-cyan-400/60 uppercase tracking-[0.4em]">Primary_Resource_Unit</p>
                                                            </div>
                                                            <div className="w-full space-y-2">
                                                                {SHAPE_STRATEGIES[subTab as ShapeType].map((tip, i) => (
                                                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
                                                                        <ChevronRight className="w-3 h-3 text-cyan-500" />
                                                                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{tip}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="xl:col-span-2 space-y-6">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {(Object.values(ShapeRarity) as ShapeRarity[]).map(rarity => {
                                                                const base = SHAPE_STATS[subTab as ShapeType];
                                                                const config = RARITY_CONFIG[rarity];
                                                                if (!base || !config) return null;
                                                                return (
                                                                    <div 
                                                                        key={rarity} 
                                                                        className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center gap-6 group hover:bg-white/[0.05] transition-all"
                                                                    >
                                                                        <div className="w-20 h-20 shrink-0 flex items-center justify-center bg-black/40 rounded-2xl border border-white/5">
                                                                            <ShapePreview type={subTab as ShapeType} rarity={rarity} size={60} />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="flex justify-between items-center mb-2">
                                                                                <span className={`text-sm font-black uppercase tracking-tighter ${getRarityColor(rarity)}`}>{rarity}</span>
                                                                                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Chance: {config.chance}%</span>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                <div className="space-y-1">
                                                                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">XP_Value</span>
                                                                                    <div className="text-xs font-black text-white">{(base.xp * config.xpMult).toLocaleString()}</div>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Integrity</span>
                                                                                    <div className="text-xs font-black text-white">{(base.health * config.hpMult).toLocaleString()}</div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* CHASSIS SECTION */}
                                    {activeCategory === 'CHASSIS' && (
                                        <div className="space-y-16">
                                            {Object.entries(CLASS_ROLES).map(([role, data]) => (
                                                <div key={role} className="space-y-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                            <data.icon className="w-6 h-6 text-blue-400" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">{role}</h3>
                                                            <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.3em]">{data.label}</p>
                                                        </div>
                                                        <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent"></div>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                                                        {data.classes.map(cls => (
                                                            <motion.div 
                                                                key={cls}
                                                                whileHover={{ y: -5 }}
                                                                className="group p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col items-center gap-6 hover:bg-white/[0.05] hover:border-blue-500/30 transition-all shadow-xl"
                                                            >
                                                                <div className="w-24 h-24 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                                                                    <TankPreview tankClass={cls} size={84} />
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-xs font-black text-white uppercase tracking-widest">{cls.replace(' Tank', '')}</span>
                                                                    <div className="mt-3 flex gap-1 justify-center">
                                                                        {[1, 2, 3, 4].map(i => (
                                                                            <div key={i} className={`w-1 h-1 rounded-full ${i <= (cls.includes('Tier 4') ? 4 : cls.includes('Tier 3') ? 3 : 2) ? 'bg-blue-500' : 'bg-white/10'}`} />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* BOSSES SECTION */}
                                    {activeCategory === 'BOSSES' && (
                                        <div className="space-y-16">
                                            {Object.entries(BOSS_TANK_DATA).map(([role, data]) => (
                                                <div key={role} className="space-y-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                            <data.icon className="w-6 h-6 text-amber-400" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">{role}</h3>
                                                            <p className="text-[10px] font-black text-amber-400/60 uppercase tracking-[0.3em]">{data.label}</p>
                                                        </div>
                                                        <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent"></div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                        {data.classes.map(cls => (
                                                            <motion.div 
                                                                key={cls}
                                                                whileHover={{ y: -10, scale: 1.02 }}
                                                                className="group p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 flex flex-col items-center gap-8 hover:bg-amber-500/5 hover:border-amber-500/30 transition-all shadow-2xl relative overflow-hidden"
                                                            >
                                                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                                                    <Crown className="w-32 h-32 text-amber-500" />
                                                                </div>
                                                                <div className="w-40 h-40 flex items-center justify-center transform group-hover:scale-110 transition-transform relative z-10">
                                                                    <TankPreview tankClass={cls} size={140} />
                                                                </div>
                                                                <div className="text-center relative z-10 space-y-4">
                                                                    <div className="space-y-1">
                                                                        <span className="text-2xl font-black text-white italic uppercase tracking-tighter">{cls}</span>
                                                                        <p className="text-[10px] font-black text-amber-400/60 uppercase tracking-widest">Titan_Class_Chassis</p>
                                                                    </div>
                                                                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-[10px] font-bold text-white/40 uppercase leading-relaxed">
                                                                        {cls === TankClass.COLOSSAL && "A massive fortress with 3 Destroyer barrels and 3 Auto-Turrets. Unmatched firepower at the cost of speed."}
                                                                        {cls === TankClass.LEVIATHAN && "Emits periodic shockwaves that stun and damage nearby enemies. High durability and area control."}
                                                                        {cls === TankClass.WARLORD && "Equipped with Repair Drones and Siege Mode. Press 'X' to lock down and gain massive defensive buffs."}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* THREATS SECTION */}
                                    {activeCategory === 'THREATS' && (
                                        <div className="space-y-12">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                {(Object.values(BOSS_STATS) as any[]).map(boss => (
                                                    <div key={boss.id} className="p-10 rounded-[3rem] bg-red-500/5 border border-red-500/20 flex gap-10 items-center relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                                            <Skull className="w-32 h-32 text-red-500" />
                                                        </div>
                                                        <div className="w-48 h-48 bg-black/40 rounded-[2.5rem] border border-white/5 flex items-center justify-center shrink-0 relative z-10">
                                                            <ShapePreview type={boss.id === 'alpha_pentagon' ? 'ALPHA_PENTAGON' : 'GRAND_SINGULARITY'} rarity={ShapeRarity.COMMON} size={180} />
                                                        </div>
                                                        <div className="flex-1 space-y-6 relative z-10">
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="px-3 py-1 rounded-full bg-red-500 text-white text-[8px] font-black uppercase tracking-widest">Class_Omega</span>
                                                                    <span className="text-[10px] font-black text-red-500/60 uppercase tracking-widest">Major_Threat</span>
                                                                </div>
                                                                <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">{boss.name}</h3>
                                                            </div>
                                                            <p className="text-xs text-white/40 leading-relaxed font-bold uppercase italic">"{boss.description}"</p>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                                                    <span className="text-[8px] font-black text-red-500/60 uppercase tracking-widest">Integrity</span>
                                                                    <div className="text-xl font-black text-white mt-1">{boss.health.toLocaleString()} HP</div>
                                                                </div>
                                                                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                                                    <span className="text-[8px] font-black text-red-500/60 uppercase tracking-widest">XP_Payout</span>
                                                                    <div className="text-xl font-black text-white mt-1">{boss.xp.toLocaleString()}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 space-y-8 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500/50"></div>
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">Elite_Incursions</h4>
                                                        <Zap className="w-6 h-6 text-orange-500" />
                                                    </div>
                                                    <p className="text-xs text-white/30 leading-relaxed uppercase font-bold">Spectral mimics of advanced Chassis classes. They manifest randomly with 300% firepower and extreme kinetic energy.</p>
                                                    <div className="flex flex-wrap gap-3">
                                                        {[TankClass.DESTROYER, TankClass.SNIPER, TankClass.OVERLORD].map(cls => (
                                                            <div key={cls} className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center gap-4 group hover:border-orange-500/40 transition-all">
                                                                <TankPreview tankClass={cls} size={32} />
                                                                <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{cls.replace(' Tank', '')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 space-y-8 relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-pink-500/50"></div>
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter">Security_Automata</h4>
                                                        <Shield className="w-6 h-6 text-pink-500" />
                                                    </div>
                                                    <p className="text-xs text-white/30 leading-relaxed uppercase font-bold">Defensive drones that aggregate around major objectives. They prioritize high-value targets and utilize ramming tactics.</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                                                            <span className="text-[9px] font-black text-pink-500/60 uppercase tracking-widest">Crasher</span>
                                                            <span className="text-lg font-black text-white">40 HP</span>
                                                        </div>
                                                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                                                            <span className="text-[9px] font-black text-pink-500/60 uppercase tracking-widest">Alpha</span>
                                                            <span className="text-lg font-black text-white">250 HP</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* VOID SECTION */}
                                    {activeCategory === 'VOID' && (
                                        <div className="h-full flex flex-col items-center justify-center space-y-8 py-10">
                                            <div className="relative scale-90 lg:scale-100 transition-transform">
                                                <motion.div 
                                                    animate={{ 
                                                        scale: [1, 1.05, 1],
                                                        rotate: [0, 5, -5, 0]
                                                    }}
                                                    transition={{ 
                                                        duration: 10, 
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                    className="w-[380px] h-[380px] bg-black rounded-full shadow-[0_0_150px_rgba(168,85,247,0.3)] flex items-center justify-center relative group border-4 border-purple-500/20"
                                                >
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent animate-pulse"></div>
                                                    <ShapePreview type="VOID_PORTAL" rarity={ShapeRarity.COMMON} size={480} />
                                                    
                                                    {/* Decorative Rings */}
                                                    <div className="absolute inset-[-30px] border border-purple-500/10 rounded-full animate-[spin_20s_linear_infinite]"></div>
                                                    <div className="absolute inset-[-60px] border border-purple-500/5 rounded-full animate-[spin_30s_linear_infinite_reverse]"></div>
                                                </motion.div>
                                                
                                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-purple-600 text-white font-black text-[10px] uppercase tracking-[0.5em] shadow-[0_0_40px_rgba(168,85,247,0.6)] border-2 border-white/20 whitespace-nowrap">
                                                    NULL_SPACE_DETECTED
                                                </div>
                                            </div>
                                            
                                            <div className="text-center max-w-2xl space-y-4">
                                                <h3 className="text-5xl lg:text-6xl font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">DIMENSIONAL_RIFT</h3>
                                                <p className="text-xs text-purple-300/60 leading-relaxed uppercase font-bold italic tracking-widest px-4">"A parallel reality where the grid collapses. Resources here are unstable but yield legendary energy levels. Entry is managed through rare dimensional rifts."</p>
                                                <div className="grid grid-cols-3 gap-4 pt-4">
                                                    {[
                                                        { label: 'Yield_Gain', val: '1000%', icon: Zap },
                                                        { label: 'Stability', val: 'VOLATILE', icon: Activity },
                                                        { label: 'Cycle_Rate', val: '5:00m', icon: Database }
                                                    ].map(stat => (
                                                        <div key={stat.label} className="p-4 lg:p-6 rounded-[2rem] bg-purple-500/5 border border-purple-500/20 backdrop-blur-md flex flex-col items-center gap-2">
                                                            <stat.icon className="w-4 h-4 text-purple-400" />
                                                            <span className="text-[8px] font-black text-purple-500/60 uppercase tracking-widest">{stat.label}</span>
                                                            <div className="text-xl font-black text-white">{stat.val}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ABILITIES SECTION */}
                                    {activeCategory === 'ABILITIES' && (
                                        <div className="space-y-12">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {TACTICAL_TRAITS.map(trait => (
                                                    <motion.div 
                                                        key={trait.name}
                                                        whileHover={{ scale: 1.02 }}
                                                        className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all group shadow-xl relative overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                                            <trait.icon className="w-40 h-40 text-emerald-500" />
                                                        </div>
                                                        <div className="flex justify-between items-start mb-8 relative z-10">
                                                            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                                                                <trait.icon className="w-8 h-8 text-emerald-400" />
                                                            </div>
                                                            <div className="px-5 py-2 rounded-xl bg-black/60 border border-white/5 text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">
                                                                {trait.key}
                                                            </div>
                                                        </div>
                                                        <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4 relative z-10">{trait.name}</h4>
                                                        <p className="text-sm text-white/30 leading-relaxed font-bold uppercase tracking-tight relative z-10">{trait.desc}</p>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            <div className="p-12 rounded-[4rem] bg-emerald-500/5 border-2 border-emerald-500/10 flex flex-col lg:flex-row gap-12 items-center relative overflow-hidden">
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent"></div>
                                                <div className="flex-1 space-y-6 relative z-10">
                                                    <div className="flex items-center gap-4">
                                                        <Info className="w-8 h-8 text-emerald-400" />
                                                        <h3 className="text-4xl font-black text-emerald-400 italic uppercase tracking-tighter">Pilot_Synergy_Protocols</h3>
                                                    </div>
                                                    <p className="text-sm text-white/40 leading-relaxed uppercase font-bold italic max-w-2xl">Maximize your chassis potential by synchronizing stat upgrades with class specializations. Precision classes require High Bullet Speed, while Assault units prioritize Reload and Damage.</p>
                                                </div>
                                                <div className="flex gap-4 relative z-10">
                                                    {[StatType.RELOAD, StatType.BULLET_SPEED, StatType.MOVEMENT_SPEED].map(s => (
                                                        <div key={s} className="w-20 h-20 rounded-3xl bg-black/60 border border-white/10 flex items-center justify-center group hover:border-emerald-500/40 transition-all">
                                                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 animate-pulse group-hover:bg-emerald-500/40 transition-colors"></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <footer className="px-10 py-6 border-t border-white/5 bg-black/20 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Terminal_Active</span>
                                </div>
                                <div className="h-4 w-px bg-white/5"></div>
                                <span className="text-[9px] font-black text-white/10 uppercase tracking-widest font-mono italic">REF_ID: 0xDE4B_SYNC</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">Build_09.25 // Vextor_OS</span>
                                <Lock className="w-3 h-3 text-white/10" />
                            </div>
                        </footer>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
