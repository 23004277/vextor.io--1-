
import React, { useEffect } from 'react';
import { Achievement } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface AchievementPopupProps {
    achievements: Achievement[];
    onClose: () => void;
}

export const AchievementPopup: React.FC<AchievementPopupProps> = ({ achievements, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 6000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed top-8 right-8 z-[2000] flex flex-col gap-4 pointer-events-none">
            <AnimatePresence>
                {achievements.map((achievement, idx) => (
                    <motion.div
                        key={achievement.id}
                        initial={{ x: 100, opacity: 0, scale: 0.8 }}
                        animate={{ x: 0, opacity: 1, scale: 1 }}
                        exit={{ x: 100, opacity: 0, scale: 0.8 }}
                        transition={{ delay: idx * 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                        className="w-80 p-5 rounded-3xl bg-black/90 border border-cyan-500/50 backdrop-blur-2xl shadow-[0_0_40px_rgba(6,182,212,0.3)] flex items-center gap-5 pointer-events-auto"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl shrink-0 shadow-lg">
                            {achievement.icon}
                        </div>
                        <div className="flex-1">
                            <span className="block text-[8px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-1 italic">Achievement_Unlocked</span>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight italic leading-none mb-1">{achievement.name}</h4>
                            <p className="text-[10px] text-white/50 font-medium leading-tight">{achievement.description}</p>
                            {achievement.rewardSkinId && (
                                <div className="mt-2 text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
                                    New_Chassis_Awarded
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
