
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ShopItem, TankClass } from '../types';
import { SHOP_ITEMS, COLORS } from '../constants';
import { BackendService } from '../services/BackendService';
import { TankPreview } from './TankPreview';

interface ShopModalProps {
    user: User | null;
    onClose: () => void;
    onUpdateUser: (user: User) => void;
    darkMode: boolean;
    playSound?: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ user, onClose, onUpdateUser, darkMode, playSound }) => {
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'classic' | 'elite'>('classic');
    const [celebrationItem, setCelebrationItem] = useState<ShopItem | null>(null);

    // Handle Escape Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleEquip = async (item: ShopItem) => {
        if (!user) return;
        playSound?.();
        setLoadingId(item.id);
        setError(null);

        const res = await BackendService.equipItem(user.username, item.id);
        
        if (res.success && res.user) {
            onUpdateUser(res.user);
        } else {
            setError(res.error || "Equip failed");
        }
        setLoadingId(null);
    };

    const handlePurchase = async (item: ShopItem) => {
        if (!user) return;
        playSound?.();
        setLoadingId(item.id);
        setError(null);

        const res = await BackendService.purchaseItem(user.username, item.id);
        
        if (res.success && res.user) {
            onUpdateUser(res.user);
            setCelebrationItem(item);
        } else {
            setError(res.error || "Purchase failed");
        }
        setLoadingId(null);
    };

    const eliteSkinsCount = useMemo(() => user?.unlockedEliteSkins?.length || 0, [user]);
    const totalEliteSkins = Object.values(TankClass).length;

    const getRarityColor = (rarity?: string) => {
        switch (rarity) {
            case 'rare': return 'text-cyan-400';
            case 'epic': return 'text-purple-400';
            case 'legendary': return 'text-amber-400';
            case 'elite': return 'text-red-500';
            default: return 'text-gray-400';
        }
    };

    const getRarityGlow = (rarity?: string) => {
        switch (rarity) {
            case 'rare': return 'shadow-[0_0_50px_rgba(34,211,238,0.3)]';
            case 'epic': return 'shadow-[0_0_50px_rgba(192,132,252,0.3)]';
            case 'legendary': return 'shadow-[0_0_50px_rgba(251,191,36,0.3)]';
            case 'elite': return 'shadow-[0_0_50px_rgba(239,68,68,0.3)]';
            default: return 'shadow-[0_0_50px_rgba(255,255,255,0.1)]';
        }
    };

    return (
        <div 
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-4 lg:p-8"
            onClick={onClose}
        >
            <AnimatePresence>
                {celebrationItem && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl overflow-hidden"
                        onClick={(e) => { e.stopPropagation(); setCelebrationItem(null); }}
                    >
                        {/* Background Particles */}
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ 
                                    x: 0, 
                                    y: 0, 
                                    scale: 0,
                                    opacity: 1
                                }}
                                animate={{ 
                                    x: (Math.random() - 0.5) * 1000, 
                                    y: (Math.random() - 0.5) * 1000,
                                    scale: Math.random() * 2,
                                    opacity: 0
                                }}
                                transition={{ 
                                    duration: 2 + Math.random() * 2, 
                                    repeat: Infinity,
                                    ease: "easeOut"
                                }}
                                className={`absolute w-2 h-2 rounded-full ${celebrationItem.rarity === 'legendary' ? 'bg-amber-400' : 'bg-cyan-400'}`}
                            />
                        ))}

                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            className="relative flex flex-col items-center gap-8"
                        >
                            {/* Rotating Rays */}
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className={`absolute -z-10 w-[600px] h-[600px] opacity-20 blur-3xl rounded-full bg-gradient-to-tr from-transparent via-white to-transparent`}
                            />

                            <div className={`w-64 h-64 rounded-[3rem] bg-black/40 border-2 border-white/10 flex items-center justify-center relative ${getRarityGlow(celebrationItem.rarity)}`}>
                                <motion.div
                                    animate={{ 
                                        y: [0, -20, 0],
                                        rotate: [0, 5, -5, 0]
                                    }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <TankPreview tankClass={TankClass.BASIC} color={celebrationItem.value} size={150} />
                                </motion.div>
                                
                                <div className="absolute -top-4 -right-4 px-4 py-1 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-xl">
                                    New_Asset
                                </div>
                            </div>

                            <div className="text-center space-y-2">
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <span className={`text-xs font-black uppercase tracking-[0.5em] ${getRarityColor(celebrationItem.rarity)}`}>
                                        {celebrationItem.rarity || 'Common'}_Unlocked
                                    </span>
                                    <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mt-2">
                                        {celebrationItem.name}
                                    </h2>
                                </motion.div>
                            </div>

                            <motion.button
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCelebrationItem(null)}
                                className="px-12 py-4 bg-white text-black font-black rounded-2xl uppercase tracking-[0.4em] text-xs shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] transition-all"
                            >
                                Claim_Asset
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div 
                className={`
                    w-full max-w-6xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative border-4 transition-colors duration-300
                    ${darkMode ? 'bg-[#121212] border-[#333]' : 'bg-[#f4f4f4] border-white'}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`
                    px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-6 z-10 shadow-sm
                    ${darkMode ? 'bg-[#1a1a1a] border-b border-[#333]' : 'bg-white border-b border-gray-200'}
                `}>
                    <div className="flex items-center gap-6">
                        <h2 className={`text-5xl font-black italic tracking-tighter uppercase ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            Armory
                        </h2>
                        {user && (
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-5 py-2 rounded-full flex items-center gap-2 shadow-lg transform -skew-x-12">
                                <div className="skew-x-12 flex items-center gap-2">
                                    <span className="font-bold text-xs uppercase tracking-widest opacity-90">Credits</span>
                                    <span className="text-2xl font-black">{user.currency.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Mode Toggle */}
                    <div className={`p-1.5 rounded-xl flex gap-1 ${darkMode ? 'bg-black/40' : 'bg-gray-200'}`}>
                        <button 
                            onClick={() => { playSound?.(); setActiveTab('classic'); }}
                            className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'classic' ? 'bg-[#333] text-white shadow-md' : 'text-gray-500 hover:text-gray-400'}`}
                        >
                            Classic
                        </button>
                        <button 
                            onClick={() => { playSound?.(); setActiveTab('elite'); }}
                            className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'elite' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-400'}`}
                        >
                            Elite Variants
                        </button>
                    </div>

                    <button onClick={onClose} className="p-3 rounded-full transition-all duration-200 hover:rotate-90">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={`flex-1 overflow-y-auto p-8 no-scrollbar ${darkMode ? 'bg-[#0f0f0f]' : 'bg-[#ececec]'}`}>
                    {activeTab === 'classic' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {SHOP_ITEMS.map(item => {
                                const isOwned = user?.inventory.includes(item.id);
                                const isEquipped = user?.equippedItem === item.id;
                                const canAfford = (user?.currency || 0) >= item.price;
                                return (
                                    <div key={item.id} className={`group relative rounded-3xl p-4 transition-all duration-300 flex flex-col gap-4 border-[3px] ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'} ${isEquipped ? 'border-blue-500 shadow-blue-500/20' : 'border-transparent'}`}>
                                        <div className={`aspect-square rounded-2xl flex items-center justify-center relative overflow-hidden ${darkMode ? 'bg-black/30' : 'bg-gray-100'}`}>
                                            <TankPreview tankClass={TankClass.BASIC} color={item.value} size={100} />
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <h3 className="text-xl font-black text-white">{item.name}</h3>
                                            <p className="text-xs text-gray-400 mb-4">{item.description}</p>
                                            <button 
                                                disabled={loadingId === item.id || isEquipped}
                                                onClick={() => isOwned ? handleEquip(item) : handlePurchase(item)}
                                                className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest ${isOwned ? (isEquipped ? 'bg-green-600' : 'bg-blue-600') : (canAfford ? 'bg-gray-700' : 'bg-gray-800 opacity-50')}`}
                                            >
                                                {isOwned ? (isEquipped ? 'EQUIPPED' : 'EQUIP') : `BUY: ${item.price}`}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="flex justify-between items-center p-6 bg-red-600/10 border border-red-500/30 rounded-3xl">
                                <div>
                                    <h3 className="text-2xl font-black text-red-500 italic uppercase">Elite Collection</h3>
                                    <p className="text-sm text-gray-400">Defeat Elite Bosses for a chance to unlock these exclusive metallic variants.</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-4xl font-black text-white">{eliteSkinsCount}/{totalEliteSkins}</span>
                                    <div className="w-40 h-2 bg-gray-800 rounded-full mt-2 overflow-hidden">
                                        <div className="h-full bg-red-500" style={{ width: `${(eliteSkinsCount/totalEliteSkins)*100}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                { (Object.values(TankClass) as TankClass[]).map(cls => {
                                    const isUnlocked = user?.unlockedEliteSkins?.includes(cls);
                                    const skinId = `elite_skin_${cls}`;
                                    const isEquipped = user?.equippedItem === skinId;
                                    
                                    return (
                                        <div key={cls} className={`group relative rounded-3xl p-4 border-[3px] transition-all ${isUnlocked ? 'bg-[#1e1e1e] border-red-500/40 opacity-100' : 'bg-black/20 border-white/5 opacity-40 grayscale pointer-events-none'}`}>
                                            <div className="aspect-square rounded-2xl flex items-center justify-center relative overflow-hidden bg-black/40">
                                                {!isUnlocked && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 p-4 text-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                        <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Defeat Elite {cls.replace(' Tank', '')}</span>
                                                    </div>
                                                )}
                                                <div className="drop-shadow-[0_0_15px_rgba(255,0,0,0.4)]">
                                                    <TankPreview tankClass={cls} color="#111" size={100} />
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <h4 className="text-center font-black text-white text-sm uppercase tracking-widest">{cls}</h4>
                                                <button 
                                                    onClick={() => isUnlocked && handleEquip({ id: skinId, name: `Elite ${cls}`, type: 'elite_skin', value: cls as string, price: 0 })}
                                                    className={`w-full mt-3 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isEquipped ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-500'}`}
                                                >
                                                    {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
