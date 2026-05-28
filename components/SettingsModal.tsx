
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameSettings } from '../types';

interface SettingsModalProps {
    settings: GameSettings;
    setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
    onClose: () => void;
    playSound: () => void;
    onVolumeChange: (v: number) => void;
}

type SettingsTab = 'Audio' | 'Video' | 'Gameplay' | 'Controls';

const ControlRow = ({ label, children, desc }: { label: string; children: React.ReactNode; desc?: string }) => (
    <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors gap-4">
        <div className="flex flex-col">
            <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] italic">{label}</span>
            {desc && <span className="text-[9px] font-medium text-white/20 uppercase tracking-widest mt-1">{desc}</span>}
        </div>
        {children}
    </div>
);

const SliderRow = ({ label, value, min, max, step, onChange, unit = "%", scale = 100 }: { 
    label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string; scale?: number 
}) => (
    <div className="space-y-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] italic">{label}</span>
            <span className="text-xs font-black text-cyan-400 tabular-nums">{Math.round(value * scale)}{unit}</span>
        </div>
        <input 
            type="range" min={min} max={max} step={step} value={value} 
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-cyan-500"
        />
    </div>
);

const Toggle = ({ active, onToggle, playSound, id }: { active: boolean; onToggle: () => void; playSound: () => void; id?: string }) => (
    <button 
        id={id}
        onClick={() => { playSound(); onToggle(); }}
        className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 ${active ? 'bg-cyan-500/20 border border-cyan-500/50' : 'bg-white/5 border border-white/10'}`}
    >
        <motion.div 
            animate={{ x: active ? 24 : 0 }}
            className={`w-4 h-4 rounded-full ${active ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'bg-white/20'}`}
        />
    </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    settings, 
    setSettings, 
    onClose, 
    playSound,
    onVolumeChange
}) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('Audio');
    const tabs: SettingsTab[] = ['Audio', 'Video', 'Gameplay', 'Controls'];

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-[40px] animate-in fade-in duration-300 p-4" onClick={onClose}>
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                className="w-full max-w-2xl rounded-[3.5rem] bg-[#050505] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-8 md:p-12 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                            <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.6em] italic">Configuration_Interface</span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-8">System_Settings</h2>

                    {/* Tabs */}
                    <div className="flex gap-2 p-1.5 bg-white/5 rounded-[2rem] border border-white/5">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => { playSound(); setActiveTab(tab); }}
                                className={`flex-1 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                            >
                                {activeTab === tab && (
                                    <motion.div 
                                        layoutId="tabBackground"
                                        className="absolute inset-0 bg-white/10 border border-white/10 rounded-[1.5rem] shadow-xl"
                                    />
                                )}
                                <span className="relative z-10">{tab}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 md:p-12 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="space-y-4"
                        >
                            {activeTab === 'Audio' && (
                                <>
                                    <SliderRow 
                                        label="Master_Volume" 
                                        value={settings.volume} 
                                        min={0} max={0.5} step={0.01} 
                                        onChange={(v) => {
                                            setSettings(prev => ({ ...prev, volume: v }));
                                            onVolumeChange(v);
                                        }}
                                        scale={200}
                                    />
                                    <SliderRow 
                                        label="Music_Atmosphere" 
                                        value={settings.musicVolume} 
                                        min={0} max={1.0} step={0.05} 
                                        onChange={(v) => setSettings(prev => ({ ...prev, musicVolume: v }))}
                                    />
                                    <ControlRow label="Spatial_Effects" desc="3D Sound field virtualization">
                                        <Toggle id="spatial-toggle" active={true} onToggle={() => {}} playSound={playSound} />
                                    </ControlRow>
                                    <ControlRow label="Tactical_Feedback" desc="Haptic audio response for engagement">
                                        <Toggle id="haptic-toggle" active={true} onToggle={() => {}} playSound={playSound} />
                                    </ControlRow>
                                </>
                            )}

                            {activeTab === 'Video' && (
                                <>
                                    <ControlRow label="Dark_Protocol" desc="High contrast ocular safety mode">
                                        <Toggle 
                                            id="dark-mode-toggle"
                                            active={settings.darkMode} 
                                            onToggle={() => setSettings((prev: GameSettings) => ({ ...prev, darkMode: !prev.darkMode }))} 
                                            playSound={playSound}
                                        />
                                    </ControlRow>
                                    <ControlRow label="Structural_Shake" desc="Kinetic camera response to impacts">
                                        <Toggle 
                                            id="shake-toggle"
                                            active={settings.shakeEnabled} 
                                            onToggle={() => setSettings((prev: GameSettings) => ({ ...prev, shakeEnabled: !prev.shakeEnabled }))} 
                                            playSound={playSound}
                                        />
                                    </ControlRow>
                                    {settings.shakeEnabled && (
                                        <SliderRow 
                                            label="Shake_Intensity" 
                                            value={settings.shakeIntensity} 
                                            min={0.1} max={2.0} step={0.1} 
                                            onChange={(v) => setSettings((prev: GameSettings) => ({ ...prev, shakeIntensity: v }))}
                                            scale={100}
                                        />
                                    )}
                                    <ControlRow label="Telemetry_Overlay" desc="Real-time performance metrics">
                                        <Toggle 
                                            id="fps-toggle"
                                            active={settings.showFps} 
                                            onToggle={() => setSettings((prev: GameSettings) => ({ ...prev, showFps: !prev.showFps }))} 
                                            playSound={playSound}
                                        />
                                    </ControlRow>
                                    <div className="flex flex-col p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] italic">Particle_Resolution</span>
                                                <span className="text-[9px] font-medium text-white/20 uppercase tracking-widest mt-1">Impact debris and exhaust density</span>
                                            </div>
                                            <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                                                {[
                                                    { label: 'MIN', val: 0.25 },
                                                    { label: 'MID', val: 0.5 },
                                                    { label: 'MAX', val: 1.0 }
                                                ].map(level => (
                                                    <button
                                                        key={level.label}
                                                        onClick={() => { playSound(); setSettings(prev => ({ ...prev, particleDensity: level.val })); }}
                                                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${settings.particleDensity === level.val ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-white/40 hover:text-white/60'}`}
                                                    >
                                                        {level.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'Gameplay' && (
                                <>
                                    <ControlRow label="Tactical_Minimap" desc="Real-time battlefield sector mapping">
                                        <Toggle 
                                            id="minimap-toggle"
                                            active={settings.showMinimap} 
                                            onToggle={() => setSettings((prev: GameSettings) => ({ ...prev, showMinimap: !prev.showMinimap }))} 
                                            playSound={playSound}
                                        />
                                    </ControlRow>
                                    <ControlRow label="Rank_Leaderboard" desc="Active pilot standing hierarchy">
                                        <Toggle 
                                            id="leaderboard-toggle"
                                            active={settings.showLeaderboard} 
                                            onToggle={() => setSettings((prev: GameSettings) => ({ ...prev, showLeaderboard: !prev.showLeaderboard }))} 
                                            playSound={playSound}
                                        />
                                    </ControlRow>
                                    <SliderRow 
                                        label="Interface_Scale" 
                                        value={settings.uiScale} 
                                        min={0.8} max={1.2} step={0.05} 
                                        onChange={(v) => setSettings((prev: GameSettings) => ({ ...prev, uiScale: v }))}
                                        scale={100}
                                    />
                                    <ControlRow label="Auto_Fire_System" desc="Smart turret engagement protocol">
                                        <Toggle id="autofire-toggle" active={false} onToggle={() => {}} playSound={playSound} />
                                    </ControlRow>
                                </>
                            )}

                            {activeTab === 'Controls' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { key: 'WASD', desc: 'LOCOMOTION' },
                                        { key: 'LMB', desc: 'ENGAGEMENT' },
                                        { key: 'SPACE', desc: 'BURST_EVASION' },
                                        { key: 'SHIFT', desc: 'AUTO_ENGAGE' },
                                        { key: 'C', desc: 'AUTO_GYRO' },
                                        { key: 'K', desc: 'SELF_TERMINATION' },
                                        { key: 'O', desc: 'INTEL_ALMANAC' },
                                        { key: 'P', desc: 'RANK_FEED' },
                                        { key: 'ESC', desc: 'SYS_MENU' },
                                        { key: 'M', desc: 'AUDIO_MUTE' },
                                    ].map(item => (
                                        <div key={item.key} className="flex items-center gap-4 p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
                                            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-cyan-400 font-black text-xs group-hover:scale-110 transition-transform">
                                                {item.key}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest leading-none">{item.desc}</span>
                                                <span className="text-[8px] font-medium text-white/20 uppercase tracking-[0.2em] mt-1.5 leading-none italic">Verified_Protocol</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-8 md:p-10 border-t border-white/5 bg-black/40 shrink-0">
                    <button 
                        onClick={() => { playSound(); onClose(); }}
                        className="w-full py-5 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.4em] italic shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Save_Configurations
                    </button>
                    <p className="text-center mt-6 text-[8px] font-black text-white/10 uppercase tracking-[0.8em] italic">
                        System_Protocol_v4.2.0_Active
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
