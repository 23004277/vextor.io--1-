
import React from 'react';
import { TankClass } from '../types';
import { COLORS, TANK_CONFIGS } from '../constants';

interface TankPreviewProps {
    tankClass: TankClass;
    color?: string;
    size?: number;
    className?: string;
    turretRotation?: number;
    chassisRotation?: number;
}

export const TankPreview: React.FC<TankPreviewProps> = ({ 
    tankClass, 
    color, 
    size = 60, 
    className = "",
    turretRotation = 0,
    chassisRotation = 0
}) => {
    const config = TANK_CONFIGS[tankClass] || TANK_CONFIGS[TankClass.BASIC];
    const center = size / 2;
    const scale = size / 60;
    const radius = 14 * scale; 
    const strokeWidth = 2 * scale;
    
    const isBossTank = tankClass === TankClass.COLOSSAL || tankClass === TankClass.LEVIATHAN || tankClass === TankClass.WARLORD;
    const isPacifist = tankClass === TankClass.PACIFIST_TRAINEE || tankClass === TankClass.NURSE || tankClass === TankClass.DOCTOR || tankClass === TankClass.PLAGUE_DOCTOR;
    const isDraining = tankClass === TankClass.DRAINER_TRAINEE || tankClass === TankClass.LEECH || tankClass === TankClass.VAMPIRE || tankClass === TankClass.REAPER;
    const isGunner = tankClass === TankClass.GUNNER;
    const isAutoGunner = tankClass === TankClass.AUTO_GUNNER;
    const isGunnerFamily = isGunner || isAutoGunner;
    const isTripleTank = tankClass === TankClass.TRIPLE_TANK;
    const isDroneCommander = tankClass === TankClass.OVERSEER || tankClass === TankClass.OVERLORD || tankClass === TankClass.MANAGER;
    const isMachineGun = tankClass === TankClass.MACHINE_GUN;
    const isHybrid = tankClass === TankClass.HYBRID;
    
    let tankColor = color || COLORS.player;
    if (isBossTank) {
        tankColor = '#9f76fc'; // Purple for commanders
    } else if (isPacifist) {
        tankColor = '#22c55e'; // Green for support
    } else if (isDraining) {
        tankColor = '#dc2626'; // Dark Red for drainers
    }
    
    // Make boss tanks appear larger in the preview
    const effectiveRadius = isBossTank ? radius * 1.4 : radius;

    const crossS = effectiveRadius * 0.585;
    const crossB = crossS * 0.35;
    
    const fangS = effectiveRadius * 0.65;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`drop-shadow-[0_0_15px_rgba(34,211,238,0.2)] filter ${className}`}>
            <defs>
                <linearGradient id="barrelGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#888" />
                    <stop offset="50%" stopColor="#aaa" />
                    <stop offset="100%" stopColor="#888" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <g transform={`translate(${center}, ${center})`}>
                  {/* Chassis / Body Layer */}
                  <g transform={`rotate(${chassisRotation})`}>
                       {/* Healing Aura for Pacifists */}
                        {isPacifist && (
                            <circle cx="0" cy="0" r={effectiveRadius * 1.5} fill="rgba(74, 222, 128, 0.15)" stroke="rgba(34, 197, 94, 0.3)" strokeWidth={strokeWidth} strokeDasharray="4 4">
                                <animate attributeName="r" values={`${effectiveRadius*1.4};${effectiveRadius*1.6};${effectiveRadius*1.4}`} dur="3s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.3;0.6;0.3" dur="3s" repeatCount="indefinite" />
                            </circle>
                        )}

                        {/* Main Tank Body */}
                        {tankClass === TankClass.COLOSSAL ? (
                            <g>
                                <polygon 
                                    points={Array.from({length: 20}).map((_, i) => {
                                        const ang = (i / 20) * Math.PI * 2;
                                        const r = i % 2 === 0 ? effectiveRadius * 1.6 : effectiveRadius * 1.3;
                                        return `${Math.cos(ang) * r},${Math.sin(ang) * r}`;
                                    }).join(' ')} 
                                    stroke="rgba(159, 118, 252, 0.8)" 
                                    strokeWidth={strokeWidth * 1.5} 
                                    fill="none"
                                >
                                    <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="10s" repeatCount="indefinite" />
                                </polygon>
                                <polygon 
                                    points={Array.from({length: 5}).map((_, i) => {
                                        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                                        return `${Math.cos(angle) * effectiveRadius},${Math.sin(angle) * effectiveRadius}`;
                                    }).join(' ')}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <polygon 
                                    points={Array.from({length: 5}).map((_, i) => {
                                        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                                        return `${Math.cos(angle) * effectiveRadius * 0.5},${Math.sin(angle) * effectiveRadius * 0.5}`;
                                    }).join(' ')}
                                    fill="rgba(0,0,0,0.3)" 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                            </g>
                        ) : tankClass === TankClass.LEVIATHAN ? (
                            <g>
                                <g stroke="rgba(0, 178, 225, 0.6)" strokeWidth={strokeWidth * 1.5} fill="none">
                                    <circle cx="0" cy="0" r={effectiveRadius}>
                                        <animate attributeName="r" values={`${effectiveRadius};${effectiveRadius*2.5}`} dur="2s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="0" cy="0" r={effectiveRadius}>
                                        <animate attributeName="r" values={`${effectiveRadius};${effectiveRadius*2.5}`} dur="2s" begin="0.66s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="1;0" dur="2s" begin="0.66s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="0" cy="0" r={effectiveRadius}>
                                        <animate attributeName="r" values={`${effectiveRadius};${effectiveRadius*2.5}`} dur="2s" begin="1.33s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="1;0" dur="2s" begin="1.33s" repeatCount="indefinite" />
                                    </circle>
                                </g>
                                <polygon 
                                    points={Array.from({length: 8}).map((_, i) => {
                                        const angle = (i * 2 * Math.PI) / 8 - Math.PI / 8;
                                        const r = i % 2 === 0 ? effectiveRadius : effectiveRadius * 0.85;
                                        return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                                    }).join(' ')}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                            </g>
                        ) : tankClass === TankClass.WARLORD ? (
                            <g>
                                <g stroke="rgba(241, 78, 84, 0.8)" strokeWidth={strokeWidth * 1.5} fill="none">
                                    <rect x={-effectiveRadius * 1.0} y={-effectiveRadius * 1.5} width={effectiveRadius * 2.0} height={effectiveRadius * 3.0}>
                                        <animate attributeName="width" values={`${effectiveRadius*2.0};${effectiveRadius*2.2};${effectiveRadius*2.0}`} dur="2s" repeatCount="indefinite" />
                                        <animate attributeName="height" values={`${effectiveRadius*3.0};${effectiveRadius*3.3};${effectiveRadius*3.0}`} dur="2s" repeatCount="indefinite" />
                                        <animate attributeName="x" values={`${-effectiveRadius*1.0};${-effectiveRadius*1.1};${-effectiveRadius*1.0}`} dur="2s" repeatCount="indefinite" />
                                        <animate attributeName="y" values={`${-effectiveRadius*1.5};${-effectiveRadius*1.65};${-effectiveRadius*1.5}`} dur="2s" repeatCount="indefinite" />
                                    </rect>
                                    <rect x={-effectiveRadius * 1.2} y={-effectiveRadius * 1.8} width={effectiveRadius * 2.4} height={effectiveRadius * 3.6}>
                                        <animate attributeName="width" values={`${effectiveRadius*2.4};${effectiveRadius*2.6};${effectiveRadius*2.4}`} dur="2s" begin="1s" repeatCount="indefinite" />
                                        <animate attributeName="height" values={`${effectiveRadius*3.6};${effectiveRadius*3.9};${effectiveRadius*3.6}`} dur="2s" begin="1s" repeatCount="indefinite" />
                                        <animate attributeName="x" values={`${-effectiveRadius*1.2};${-effectiveRadius*1.3};${-effectiveRadius*1.2}`} dur="2s" begin="1s" repeatCount="indefinite" />
                                        <animate attributeName="y" values={`${-effectiveRadius*1.8};${-effectiveRadius*1.95};${-effectiveRadius*1.8}`} dur="2s" begin="1s" repeatCount="indefinite" />
                                    </rect>
                                </g>
                                <rect 
                                    x={-effectiveRadius * 0.8} 
                                    y={-effectiveRadius * 1.2} 
                                    width={effectiveRadius * 1.6} 
                                    height={effectiveRadius * 2.4} 
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <rect 
                                    x={-effectiveRadius * 0.4} 
                                    y={-effectiveRadius * 0.6} 
                                    width={effectiveRadius * 0.8} 
                                    height={effectiveRadius * 1.2} 
                                    fill="rgba(0,0,0,0.3)" 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                            </g>
                        ) : tankClass === TankClass.DOCTOR ? (
                            <polygon 
                                points={Array.from({length: 6}).map((_, i) => {
                                    const angle = (i * 2 * Math.PI) / 6;
                                    return `${Math.cos(angle) * effectiveRadius},${Math.sin(angle) * effectiveRadius}`;
                                }).join(' ')}
                                fill={tankColor} 
                                stroke={COLORS.border} 
                                strokeWidth={strokeWidth} 
                            />
                        ) : tankClass === TankClass.PLAGUE_DOCTOR ? (
                            <path 
                                d={`M ${effectiveRadius*1.5} 0 L ${effectiveRadius*0.5} ${effectiveRadius*0.4} L ${-effectiveRadius*0.8} ${effectiveRadius*0.8} L ${-effectiveRadius} 0 L ${-effectiveRadius*0.8} ${-effectiveRadius*0.8} L ${effectiveRadius*0.5} ${-effectiveRadius*0.4} Z`}
                                fill={tankColor} 
                                stroke={COLORS.border} 
                                strokeWidth={strokeWidth} 
                            />
                        ) : tankClass === TankClass.STALKER ? (
                            <g>
                                <circle cx="0" cy="0" r={effectiveRadius} fill={tankColor} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.58} fill="rgba(0,0,0,0.24)" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth * 0.55} />
                            </g>
                        ) : tankClass === TankClass.RANGER ? (
                            <g>
                                <polygon
                                    points={Array.from({length: 8}).map((_, i) => {
                                        const angle = (i * 2 * Math.PI) / 8 - Math.PI / 8;
                                        const r = i % 2 === 0 ? effectiveRadius : effectiveRadius * 0.9;
                                        return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                                    }).join(' ')}
                                    fill={tankColor}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                            </g>
                        ) : tankClass === TankClass.ASSASSIN ? (
                            <g>
                                <circle cx="0" cy="0" r={effectiveRadius} fill={tankColor} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.45} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth={strokeWidth * 0.45} />
                            </g>
                        ) : (
                            <circle cx="0" cy="0" r={effectiveRadius} fill={tankColor} stroke={COLORS.border} strokeWidth={strokeWidth} />
                        )}

                        {/* Emblems Layer */}
                        {isPacifist && (
                            <path 
                                d={`M ${-crossS} ${-crossB} L ${-crossB} ${-crossB} L ${-crossB} ${-crossS} L ${crossB} ${-crossS} L ${crossB} ${-crossB} L ${crossS} ${-crossB} L ${crossS} ${crossB} L ${crossB} ${crossB} L ${crossB} ${crossS} L ${-crossB} ${crossS} L ${-crossB} ${crossB} L ${-crossS} ${crossB} Z`}
                                fill="#ffffff" 
                                stroke="rgba(0,0,0,0.5)"
                                strokeWidth={strokeWidth * 1.25}
                                strokeLinejoin="round"
                            />
                        )}
                        {isDraining && (
                            <g>
                                <path
                                    d={`M ${-fangS * 0.8} ${-fangS * 0.2} Q 0 ${-fangS * 0.6} ${fangS * 0.8} ${-fangS * 0.2} L ${fangS * 0.5} ${fangS * 0.8} L ${fangS * 0.2} 0 Q 0 ${-fangS * 0.2} ${-fangS * 0.2} 0 L ${-fangS * 0.5} ${fangS * 0.8} L ${-fangS * 0.8} ${-fangS * 0.2} Z`}
                                    fill="#ffffff"
                                    stroke="rgba(0,0,0,0.5)"
                                    strokeWidth={strokeWidth * 1.25}
                                    strokeLinejoin="round"
                                />
                                {/* Blood Drips */}
                                <circle cx={fangS * 0.5} cy={fangS * 0.8 + 2} r={fangS * 0.18} fill="#ff0000" />
                                <circle cx={-fangS * 0.5} cy={fangS * 0.8 + 1} r={fangS * 0.12} fill="#ff0000" />
                            </g>
                        )}
                  </g>

                  {/* Turret Layer */}
                  <g transform={`rotate(${turretRotation})`}>
                        {config.map((barrel, i) => {
                            const [length, width, xOff, angleOff, delayMult, yOff = 0, spread = 1] = barrel;
                            const bLen = length * effectiveRadius;
                            const bWid = width * effectiveRadius;
                            const rotation = (angleOff * 180) / Math.PI;

                            const isSniper = tankClass === TankClass.SNIPER;
                            const isAssassin = tankClass === TankClass.ASSASSIN;
                            const isRanger = tankClass === TankClass.RANGER;
                            const isStalker = tankClass === TankClass.STALKER;
                            const isHunter = tankClass === TankClass.HUNTER;
                            const isXHunter = tankClass === TankClass.X_HUNTER;
                            const isAnnihilator = tankClass === TankClass.ANNIHILATOR;

                            if (isAnnihilator) {
                                const endWid = bWid * 0.72;
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        {/* 1. Heavy rear generator block */}
                                        <rect x={0} y={-bWid * 0.55} width={bLen * 0.35} height={bWid * 1.1} fill="#2d3748" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        
                                        {/* central glowing emerald core */}
                                        <rect x={bLen * 0.35} y={-bWid * 0.28} width={bLen * 0.5} height={bWid * 0.56} fill="#10b981" stroke="#34d399" strokeWidth={strokeWidth} />
                                        
                                        {/* Interlocking stabilizer bands */}
                                        <rect x={bLen * 0.45} y={-bWid * 0.45} width={bLen * 0.08} height={bWid * 0.9} fill="#4a5568" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.65} y={-bWid * 0.45} width={bLen * 0.08} height={bWid * 0.9} fill="#4a5568" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        
                                        {/* Heavy support rails */}
                                        <rect x={bLen * 0.35} y={-bWid * 0.5} width={bLen * 0.5} height={bWid * 0.18} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.35} y={bWid * 0.32} width={bLen * 0.5} height={bWid * 0.18} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        
                                        {/* Rivet pins */}
                                        <circle cx={bLen * 0.15} cy={-bWid * 0.35} r={3} fill="#1a202c" />
                                        <circle cx={bLen * 0.15} cy={bWid * 0.35} r={3} fill="#1a202c" />
                                        <circle cx={bLen * 0.28} cy={-bWid * 0.35} r={3} fill="#1a202c" />
                                        <circle cx={bLen * 0.28} cy={bWid * 0.35} r={3} fill="#1a202c" />
                                        
                                        {/* 2. Massively Flared Containment Muzzle */}
                                        <polygon points={`${bLen * 0.85},${-bWid * 0.5} ${bLen},${-endWid} ${bLen},${endWid} ${bLen * 0.85},${bWid * 0.5}`} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        
                                        {/* End muzzle clamp */}
                                        <rect x={bLen * 0.96} y={-endWid - 2} width={bLen * 0.04} height={endWid * 2 + 4} fill="#2d3748" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        
                                        <line x1={bLen} y1={-endWid} x2={bLen} y2={endWid} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isMachineGun) {
                                const flare = bWid * 1.22;
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <path
                                            d={`M 0 ${-bWid * 0.52} L ${bLen * 0.62} ${-flare * 0.5} L ${bLen} ${-bWid * 0.34} L ${bLen} ${bWid * 0.34} L ${bLen * 0.62} ${flare * 0.5} L 0 ${bWid * 0.52} Z`}
                                            fill="url(#barrelGradient)"
                                            stroke={COLORS.border}
                                            strokeWidth={strokeWidth}
                                        />
                                        {[0.2, 0.35, 0.5, 0.65, 0.8].map(slot => (
                                            <line key={slot} x1={bLen * slot} y1={-bWid * 0.44} x2={bLen * slot} y2={bWid * 0.44} stroke="rgba(20,20,20,0.65)" strokeWidth={strokeWidth * 0.6} />
                                        ))}
                                        <line x1={bLen} y1={-bWid * 0.34} x2={bLen} y2={bWid * 0.34} stroke="#222" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isHybrid) {
                                if (i === 0) {
                                    const endWid = bWid * 0.76;
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.56} width={bLen * 0.35} height={bWid * 1.12} fill="#3a3a48" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <rect x={bLen * 0.35} y={-bWid * 0.26} width={bLen * 0.55} height={bWid * 0.52} fill="#8b5cf6" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <rect x={bLen * 0.52} y={-bWid * 0.45} width={bLen * 0.08} height={bWid * 0.9} fill="#4f46e5" stroke={COLORS.border} strokeWidth={strokeWidth * 0.7} />
                                            <polygon points={`${bLen * 0.9},${-bWid * 0.5} ${bLen},${-endWid} ${bLen},${endWid} ${bLen * 0.9},${bWid * 0.5}`} fill="#444" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                }
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.4} width={bLen * 0.9} height={bWid * 0.8} fill="#4338ca" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.8} y={-bWid * 0.22} width={bLen * 0.2} height={bWid * 0.44} fill="#c4b5fd" stroke={COLORS.border} strokeWidth={strokeWidth * 0.7} />
                                        <line x1={bLen} y1={-bWid * 0.22} x2={bLen} y2={bWid * 0.22} stroke="#2b216c" strokeWidth={strokeWidth * 0.8} />
                                    </g>
                                );
                            }

                            if (isSniper) {
                                const endWid = bWid * 0.8;
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.6} width={bLen * 0.45} height={bWid * 1.2} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <polygon points={`0,${-bWid * 0.45} ${bLen * 0.95},${-endWid / 2} ${bLen * 0.95},${endWid / 2} 0,${bWid * 0.45}`} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.95} y={-bWid * 0.55} width={bLen * 0.05} height={bWid * 1.1} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.55} x2={bLen} y2={bWid * 0.55} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isAssassin) {
                                const endWid = bWid * 0.7;
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.65} width={bLen * 0.35} height={bWid * 1.3} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.35} y={-bWid * 0.55} width={bLen * 0.3} height={bWid * 1.1} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <polygon points={`${bLen * 0.65},${-bWid * 0.42} ${bLen * 0.97},${-endWid / 2} ${bLen * 0.97},${endWid / 2} ${bLen * 0.65},${bWid * 0.42}`} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.97} y={-bWid * 0.55} width={bLen * 0.03} height={bWid * 1.1} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.55} x2={bLen} y2={bWid * 0.55} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isRanger) {
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.72} width={bLen * 0.3} height={bWid * 1.44} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.3} y={-bWid * 0.61} width={bLen * 0.35} height={bWid * 1.22} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.65} y={-bWid * 0.4} width={bLen * 0.3} height={bWid * 0.8} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.95} y={-bWid * 0.65} width={bLen * 0.05} height={bWid * 1.3} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.65} x2={bLen} y2={bWid * 0.65} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isStalker) {
                                const riLines = [0.25, 0.37, 0.49, 0.61, 0.73];
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.65} width={bLen * 0.2} height={bWid * 1.3} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.2} y={-bWid * 0.7} width={bLen * 0.65} height={bWid * 1.4} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        {riLines.map((val, idx) => (
                                            <line key={idx} x1={bLen * val} y1={-bWid * 0.7} x2={bLen * val} y2={bWid * 0.7} stroke="#222222" strokeWidth={strokeWidth} />
                                        ))}
                                        <rect x={bLen * 0.85} y={-bWid * 0.37} width={bLen * 0.15} height={bWid * 0.75} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.37} x2={bLen} y2={bWid * 0.37} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isHunter) {
                                if (i === 0) { // Outer
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.55} width={bLen * 0.8} height={bWid * 1.1} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen * 0.8} y1={-bWid * 0.55} x2={bLen * 0.8} y2={bWid * 0.55} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                } else { // Inner
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.35} width={bLen} height={bWid * 0.7} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen} y1={-bWid * 0.35} x2={bLen} y2={bWid * 0.35} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                }
                            }

                            if (isXHunter) {
                                if (i === 0) { // Outer heavy sleeve
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.52} width={bLen * 0.65} height={bWid * 1.04} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen * 0.65} y1={-bWid * 0.52} x2={bLen * 0.65} y2={bWid * 0.52} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                } else if (i === 1) { // Mid segment
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.44} width={bLen * 0.85} height={bWid * 0.88} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen * 0.85} y1={-bWid * 0.44} x2={bLen * 0.85} y2={bWid * 0.44} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                } else { // Inner needle
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.3} width={bLen} height={bWid * 0.6} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen} y1={-bWid * 0.3} x2={bLen} y2={bWid * 0.3} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                }
                            }

                            if (isGunnerFamily) {
                                const conduitColor = isAutoGunner ? 'rgba(80,180,255,0.55)' : 'rgba(110,255,130,0.55)';
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.52} width={bLen} height={bWid * 1.04} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={0} y={-bWid * 0.56} width={bLen * 0.92} height={bWid * 0.14} fill="#1f2935" />
                                        <rect x={0} y={bWid * 0.42} width={bLen * 0.92} height={bWid * 0.14} fill="#1f2935" />
                                        {[0.16, 0.31, 0.46, 0.61, 0.76, 0.91].map(slot => (
                                            <line key={slot} x1={bLen * slot} y1={-bWid * 0.44} x2={bLen * slot} y2={bWid * 0.44} stroke="rgba(15,15,15,0.65)" strokeWidth={strokeWidth * 0.7} />
                                        ))}
                                        <rect x={bLen * 0.22} y={-bWid * 0.08} width={bLen * 0.66} height={bWid * 0.16} fill={conduitColor} />
                                        <line x1={bLen} y1={-bWid / 2} x2={bLen} y2={bWid / 2} stroke="#222" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isTripleTank) {
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <path d={`M 0 ${-bWid * 0.52} L ${bLen * 0.78} ${-bWid * 0.52} L ${bLen} ${-bWid * 0.3} L ${bLen} ${bWid * 0.3} L ${bLen * 0.78} ${bWid * 0.52} L 0 ${bWid * 0.52} Z`} fill="url(#barrelGradient)" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={0} y={-bWid * 0.58} width={bLen * 0.86} height={bWid * 0.12} fill="#212b36" />
                                        <rect x={0} y={bWid * 0.46} width={bLen * 0.86} height={bWid * 0.12} fill="#212b36" />
                                        {[0.18, 0.32, 0.46, 0.60, 0.74].map(slot => (
                                            <line key={slot} x1={bLen * slot} y1={-bWid * 0.42} x2={bLen * slot} y2={bWid * 0.42} stroke="rgba(18,24,30,0.65)" strokeWidth={strokeWidth * 0.6} />
                                        ))}
                                        <line x1={bLen} y1={-bWid * 0.3} x2={bLen} y2={bWid * 0.3} stroke="#222" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isDroneCommander) {
                                const coreColor = tankClass === TankClass.OVERLORD
                                    ? 'rgba(100,200,255,0.55)'
                                    : tankClass === TankClass.MANAGER
                                      ? 'rgba(110,255,220,0.5)'
                                      : 'rgba(130,255,210,0.5)';
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.52} width={bLen * 0.72} height={bWid * 1.04} fill="#2b3440" stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.72} y={-bWid * 0.28} width={bLen * 0.28} height={bWid * 0.56} fill={coreColor} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.2} y={-bWid * 0.08} width={bLen * 0.45} height={bWid * 0.16} fill="rgba(255,255,255,0.22)" />
                                    </g>
                                );
                            }

                            return (
                                <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                    {spread !== 1 ? (
                                        <path 
                                            d={`M 0 ${-bWid/2} L ${bLen} ${(-bWid*spread)/2} L ${bLen} ${(bWid*spread)/2} L 0 ${bWid/2} Z`}
                                            fill="url(#barrelGradient)" 
                                            stroke={COLORS.border} 
                                            strokeWidth={strokeWidth}
                                        />
                                    ) : (
                                        <rect 
                                            x={0} 
                                            y={-bWid / 2} 
                                            width={bLen} 
                                            height={bWid} 
                                            fill="url(#barrelGradient)" 
                                            stroke={COLORS.border} 
                                            strokeWidth={strokeWidth} 
                                        />
                                    )}
                                    <line x1={bLen} y1={- (bWid * (spread || 1)) / 2} x2={bLen} y2={(bWid * (spread || 1)) / 2} stroke="#444" strokeWidth={strokeWidth} />
                                </g>
                            );
                        })}

                        {/* Core reactor visuals */}
                        {isGunner && (
                            <g>
                                <circle cx="0" cy="0" r={effectiveRadius * 0.34} fill="rgba(40,70,45,0.9)" stroke="rgba(35,255,120,0.35)" strokeWidth={strokeWidth * 0.6} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.2} fill="rgba(70,255,130,0.45)" />
                            </g>
                        )}
                        {isAutoGunner && (
                            <g>
                                <circle cx="0" cy="0" r={effectiveRadius * 0.34} fill="rgba(32,58,88,0.95)" stroke="rgba(100,220,255,0.45)" strokeWidth={strokeWidth * 0.6} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.2} fill="rgba(95,200,255,0.55)" />
                            </g>
                        )}

                        {/* Top-mounted Turret for Auto Gunner */}
                        {isAutoGunner && (
                            <g transform="rotate(-40)">
                                <circle cx="0" cy="0" r={effectiveRadius * 0.58} fill="#2f3946" stroke="#1b222b" strokeWidth={strokeWidth * 0.8} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.42} fill="none" stroke="rgba(100,220,255,0.5)" strokeWidth={strokeWidth * 0.6} />
                                <rect x={0} y={-effectiveRadius * 0.2} width={effectiveRadius * 0.98} height={effectiveRadius * 0.4} fill="url(#barrelGradient)" stroke="#1f2933" strokeWidth={strokeWidth * 0.7} />
                                <rect x={effectiveRadius * 0.2} y={-effectiveRadius * 0.06} width={effectiveRadius * 0.48} height={effectiveRadius * 0.12} fill="rgba(120,255,230,0.45)" />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.34} fill="#3d4a59" stroke="#1f2933" strokeWidth={strokeWidth * 0.6} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.2} fill={tankColor} stroke="#1f2933" strokeWidth={strokeWidth * 0.5} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.11} fill="rgba(90,200,255,0.7)" stroke="rgba(170,230,255,0.5)" strokeWidth={strokeWidth * 0.35} />
                                <line x1={effectiveRadius * 0.4} y1={0} x2={effectiveRadius * 1.45} y2={0} stroke="rgba(100,220,255,0.45)" strokeWidth={strokeWidth * 0.45} />
                            </g>
                        )}

                        {/* Central Turret Cap (makes it look like a real turret) */}
                        <circle cx="0" cy="0" r={effectiveRadius * 0.75} fill={tankColor} stroke={COLORS.border} strokeWidth={strokeWidth} />
                        <circle cx="0" cy="0" r={effectiveRadius * 0.4} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth={strokeWidth/2} />
                  </g>
            </g>
        </svg>
    );
};
