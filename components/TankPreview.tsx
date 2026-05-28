
import React, { useId } from 'react';
import { TankClass } from '../types';
import { COLORS, TANK_CONFIGS } from '../constants';

interface TankPreviewProps {
    tankClass: TankClass;
    color?: string;
    size?: number;
    className?: string;
    turretRotation?: number;
    chassisRotation?: number;
    showArenaVfx?: boolean;
}

export const TankPreview: React.FC<TankPreviewProps> = ({ 
    tankClass, 
    color, 
    size = 60, 
    className = "",
    turretRotation = 0,
    chassisRotation = 0,
    showArenaVfx = false,
}) => {
    const previewId = useId().replace(/:/g, '');
    const config = TANK_CONFIGS[tankClass] || TANK_CONFIGS[TankClass.BASIC];
    const center = size / 2;
    const scale = size / 60;
    const radius = 14 * scale; 
    const strokeWidth = 2 * scale;
    
    const isBossTank = tankClass === TankClass.COLOSSAL || tankClass === TankClass.LEVIATHAN || tankClass === TankClass.WARLORD || tankClass === TankClass.CELESTIAL || tankClass === TankClass.OBLITERATOR;
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
    const viewPad = isBossTank && showArenaVfx ? size * 0.22 : 0;
    const barrelGradientId = `barrelGradient-${previewId}`;
    const glowFilterId = `glow-${previewId}`;
    const rebirthAuraBlueId = `rebirthAuraBlue-${previewId}`;
    const rebirthAuraRedId = `rebirthAuraRed-${previewId}`;
    const barrelFill = `url(#${barrelGradientId})`;

    return (
        <svg
            width={size}
            height={size}
            viewBox={`${-viewPad} ${-viewPad} ${size + viewPad * 2} ${size + viewPad * 2}`}
            className={`drop-shadow-[0_0_15px_rgba(34,211,238,0.2)] filter ${className}`}
        >
            <defs>
                <linearGradient id={barrelGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#888" />
                    <stop offset="50%" stopColor="#aaa" />
                    <stop offset="100%" stopColor="#888" />
                </linearGradient>
                <filter id={glowFilterId}>
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <radialGradient id={rebirthAuraBlueId} cx="50%" cy="50%" r="65%">
                    <stop offset="0%" stopColor="rgba(125,211,252,0.35)" />
                    <stop offset="60%" stopColor="rgba(56,189,248,0.16)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
                <radialGradient id={rebirthAuraRedId} cx="50%" cy="50%" r="65%">
                    <stop offset="0%" stopColor="rgba(251,113,133,0.34)" />
                    <stop offset="60%" stopColor="rgba(239,68,68,0.16)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
            </defs>
            <g transform={`translate(${center}, ${center})`}>
                  {/* Chassis / Body Layer */}
                  <g transform={`rotate(${chassisRotation})`}>
                        {isBossTank && showArenaVfx && (
                            <g>
                                <circle cx="0" cy="0" r={effectiveRadius * 1.95} fill={tankClass === TankClass.WARLORD ? `url(#${rebirthAuraRedId})` : `url(#${rebirthAuraBlueId})`} />
                                <circle cx="0" cy="0" r={effectiveRadius * 1.55} fill="none" stroke={tankClass === TankClass.WARLORD ? 'rgba(239,68,68,0.45)' : tankClass === TankClass.OBLITERATOR ? 'rgba(232,121,249,0.55)' : 'rgba(56,189,248,0.5)'} strokeWidth={strokeWidth * 0.9}>
                                    <animate attributeName="r" values={`${effectiveRadius*1.45};${effectiveRadius*1.65};${effectiveRadius*1.45}`} dur="2.6s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.6s" repeatCount="indefinite" />
                                </circle>
                            </g>
                        )}
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
                                    points={`${effectiveRadius * 0.95},0 0,${-effectiveRadius * 0.9} ${-effectiveRadius * 0.95},0 0,${effectiveRadius * 0.9}`}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <polygon 
                                    points={`${effectiveRadius * 0.58},0 0,${-effectiveRadius * 0.52} ${-effectiveRadius * 0.58},0 0,${effectiveRadius * 0.52}`}
                                    fill="rgba(0,0,0,0.3)" 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                            </g>
                        ) : tankClass === TankClass.LEVIATHAN ? (
                            <g>
                                <polygon 
                                    points={Array.from({length: 10}).map((_, i) => {
                                        const angle = (i * 2 * Math.PI) / 10 - Math.PI / 2;
                                        const r = i % 2 === 0 ? effectiveRadius * 0.95 : effectiveRadius * 0.44;
                                        return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                                    }).join(' ')}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <polygon
                                  points={Array.from({length: 10}).map((_, i) => {
                                      const angle = (i * 2 * Math.PI) / 10 - Math.PI / 2;
                                      const r = i % 2 === 0 ? effectiveRadius * 0.52 : effectiveRadius * 0.24;
                                      return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                                  }).join(' ')}
                                  fill="rgba(0,0,0,0.24)"
                                  stroke={COLORS.border}
                                  strokeWidth={strokeWidth}
                                />
                            </g>
                        ) : tankClass === TankClass.WARLORD ? (
                            <g>
                                <polygon
                                    points={`${effectiveRadius * 1.0},0 ${-effectiveRadius * 0.7},${-effectiveRadius * 0.9} ${-effectiveRadius * 0.7},${effectiveRadius * 0.9}`}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <polygon
                                    points={`${effectiveRadius * 0.55},0 ${-effectiveRadius * 0.35},${-effectiveRadius * 0.45} ${-effectiveRadius * 0.35},${effectiveRadius * 0.45}`}
                                    fill="rgba(0,0,0,0.3)" 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                            </g>
                        ) : tankClass === TankClass.CELESTIAL ? (
                            <g>
                                <polygon
                                    points={Array.from({ length: 5 }).map((_, i) => {
                                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                                        return `${Math.cos(a) * effectiveRadius * 1.1},${Math.sin(a) * effectiveRadius * 1.1}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="rgba(192,132,252,0.75)"
                                    strokeWidth={strokeWidth * 1.2}
                                />
                                <polygon
                                    points={Array.from({ length: 5 }).map((_, i) => {
                                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                                        return `${Math.cos(a) * effectiveRadius * 0.9},${Math.sin(a) * effectiveRadius * 0.9}`;
                                    }).join(' ')}
                                    fill={tankColor}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <polygon
                                    points={Array.from({ length: 5 }).map((_, i) => {
                                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                                        return `${Math.cos(a) * effectiveRadius * 0.5},${Math.sin(a) * effectiveRadius * 0.5}`;
                                    }).join(' ')}
                                    fill="rgba(0,0,0,0.25)"
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                            </g>
                        ) : tankClass === TankClass.OBLITERATOR ? (
                            <g>
                                <polygon
                                    points={Array.from({ length: 16 }).map((_, i) => {
                                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 16;
                                        const rr = i % 2 === 0 ? effectiveRadius * 1.03 : effectiveRadius * 0.6;
                                        return `${Math.cos(a) * rr},${Math.sin(a) * rr}`;
                                    }).join(' ')}
                                    fill={tankColor}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={effectiveRadius * 0.58}
                                    fill="rgba(30,10,60,0.28)"
                                    stroke="rgba(233,213,255,0.42)"
                                    strokeWidth={strokeWidth * 0.85}
                                />
                            </g>
                        ) : tankClass === TankClass.REAPER ? (
                            <g>
                                <path
                                  d={`M ${effectiveRadius*1.42} 0 C ${effectiveRadius*0.98} ${effectiveRadius*1.22}, ${-effectiveRadius*0.88} ${effectiveRadius*1.48}, ${-effectiveRadius*1.28} 0 C ${-effectiveRadius*0.88} ${-effectiveRadius*1.48}, ${effectiveRadius*0.98} ${-effectiveRadius*1.22}, ${effectiveRadius*1.42} 0 Z`}
                                  fill="#7f1d1d"
                                  stroke="rgba(255,185,185,0.72)"
                                  strokeWidth={strokeWidth}
                                />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.62} fill="rgba(20,5,5,0.88)" stroke="rgba(248,113,113,0.7)" strokeWidth={strokeWidth * 0.75} />
                                <path
                                  d={`M ${-effectiveRadius*0.92} ${-effectiveRadius*0.18} A ${effectiveRadius*1.05} ${effectiveRadius*0.72} 0 0 1 ${effectiveRadius*0.78} ${-effectiveRadius*0.82}`}
                                  fill="none"
                                  stroke="rgba(248,113,113,0.7)"
                                  strokeWidth={strokeWidth * 0.85}
                                  strokeLinecap="round"
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
                        {isDraining && tankClass !== TankClass.REAPER && (
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
                            if (tankClass === TankClass.LEVIATHAN && i === config.length - 1) return null;
                            let bLen = length * effectiveRadius;
                            let bWid = width * effectiveRadius;
                            if (isBossTank) {
                                bLen = Math.min(bLen, effectiveRadius * 1.02);
                                bWid = Math.min(bWid, effectiveRadius * 0.46);
                            }
                            const rotation = (angleOff * 180) / Math.PI;

                            const isSniper = tankClass === TankClass.SNIPER;
                            const isAssassin = tankClass === TankClass.ASSASSIN;
                            const isRanger = tankClass === TankClass.RANGER;
                            const isStalker = tankClass === TankClass.STALKER;
                            const isHunter = tankClass === TankClass.HUNTER;
                            const isXHunter = tankClass === TankClass.X_HUNTER;
                            const isAnnihilator = tankClass === TankClass.ANNIHILATOR;
                            const isReaper = tankClass === TankClass.REAPER;

                            if (isReaper) {
                                const hook = i === 1 ? -1 : 1;
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        {i === 0 ? (
                                            <path
                                              d={`M 0 ${-bWid*0.48} L ${bLen*0.8} ${-bWid*0.3} L ${bLen} 0 L ${bLen*0.8} ${bWid*0.3} L 0 ${bWid*0.48} Z`}
                                              fill="#7f1d1d"
                                              stroke="rgba(20,8,8,0.95)"
                                              strokeWidth={strokeWidth}
                                            />
                                        ) : (
                                            <path
                                              d={`M 0 ${-bWid*0.42} Q ${bLen*0.44} ${-hook*bWid*0.82} ${bLen*0.9} ${-hook*bWid*0.22} L ${bLen} 0 Q ${bLen*0.5} ${hook*bWid*0.44} 0 ${bWid*0.42} Z`}
                                              fill="#991b1b"
                                              stroke="rgba(20,8,8,0.95)"
                                              strokeWidth={strokeWidth}
                                            />
                                        )}
                                        <line x1={bLen} y1={-bWid * 0.24} x2={bLen} y2={bWid * 0.24} stroke="rgba(255,210,210,0.65)" strokeWidth={strokeWidth * 0.7} />
                                    </g>
                                );
                            }

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
                                        <rect x={bLen * 0.35} y={-bWid * 0.5} width={bLen * 0.5} height={bWid * 0.18} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.35} y={bWid * 0.32} width={bLen * 0.5} height={bWid * 0.18} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        
                                        {/* Rivet pins */}
                                        <circle cx={bLen * 0.15} cy={-bWid * 0.35} r={3} fill="#1a202c" />
                                        <circle cx={bLen * 0.15} cy={bWid * 0.35} r={3} fill="#1a202c" />
                                        <circle cx={bLen * 0.28} cy={-bWid * 0.35} r={3} fill="#1a202c" />
                                        <circle cx={bLen * 0.28} cy={bWid * 0.35} r={3} fill="#1a202c" />
                                        
                                        {/* 2. Massively Flared Containment Muzzle */}
                                        <polygon points={`${bLen * 0.85},${-bWid * 0.5} ${bLen},${-endWid} ${bLen},${endWid} ${bLen * 0.85},${bWid * 0.5}`} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        
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
                                            fill={barrelFill}
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
                                        <rect x={0} y={-bWid * 0.6} width={bLen * 0.45} height={bWid * 1.2} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <polygon points={`0,${-bWid * 0.45} ${bLen * 0.95},${-endWid / 2} ${bLen * 0.95},${endWid / 2} 0,${bWid * 0.45}`} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.95} y={-bWid * 0.55} width={bLen * 0.05} height={bWid * 1.1} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.55} x2={bLen} y2={bWid * 0.55} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isAssassin) {
                                const endWid = bWid * 0.7;
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.65} width={bLen * 0.35} height={bWid * 1.3} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.35} y={-bWid * 0.55} width={bLen * 0.3} height={bWid * 1.1} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <polygon points={`${bLen * 0.65},${-bWid * 0.42} ${bLen * 0.97},${-endWid / 2} ${bLen * 0.97},${endWid / 2} ${bLen * 0.65},${bWid * 0.42}`} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.97} y={-bWid * 0.55} width={bLen * 0.03} height={bWid * 1.1} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.55} x2={bLen} y2={bWid * 0.55} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isRanger) {
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.72} width={bLen * 0.3} height={bWid * 1.44} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.3} y={-bWid * 0.61} width={bLen * 0.35} height={bWid * 1.22} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.65} y={-bWid * 0.4} width={bLen * 0.3} height={bWid * 0.8} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.95} y={-bWid * 0.65} width={bLen * 0.05} height={bWid * 1.3} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.65} x2={bLen} y2={bWid * 0.65} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isStalker) {
                                const riLines = [0.25, 0.37, 0.49, 0.61, 0.73];
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.65} width={bLen * 0.2} height={bWid * 1.3} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <rect x={bLen * 0.2} y={-bWid * 0.7} width={bLen * 0.65} height={bWid * 1.4} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        {riLines.map((val, idx) => (
                                            <line key={idx} x1={bLen * val} y1={-bWid * 0.7} x2={bLen * val} y2={bWid * 0.7} stroke="#222222" strokeWidth={strokeWidth} />
                                        ))}
                                        <rect x={bLen * 0.85} y={-bWid * 0.37} width={bLen * 0.15} height={bWid * 0.75} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                        <line x1={bLen} y1={-bWid * 0.37} x2={bLen} y2={bWid * 0.37} stroke="#444" strokeWidth={strokeWidth} />
                                    </g>
                                );
                            }

                            if (isHunter) {
                                if (i === 0) { // Outer
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.55} width={bLen * 0.8} height={bWid * 1.1} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen * 0.8} y1={-bWid * 0.55} x2={bLen * 0.8} y2={bWid * 0.55} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                } else { // Inner
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.35} width={bLen} height={bWid * 0.7} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen} y1={-bWid * 0.35} x2={bLen} y2={bWid * 0.35} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                }
                            }

                            if (isXHunter) {
                                if (i === 0) { // Outer heavy sleeve
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.52} width={bLen * 0.65} height={bWid * 1.04} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen * 0.65} y1={-bWid * 0.52} x2={bLen * 0.65} y2={bWid * 0.52} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                } else if (i === 1) { // Mid segment
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.44} width={bLen * 0.85} height={bWid * 0.88} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen * 0.85} y1={-bWid * 0.44} x2={bLen * 0.85} y2={bWid * 0.44} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                } else { // Inner needle
                                    return (
                                        <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                            <rect x={0} y={-bWid * 0.3} width={bLen} height={bWid * 0.6} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
                                            <line x1={bLen} y1={-bWid * 0.3} x2={bLen} y2={bWid * 0.3} stroke="#444" strokeWidth={strokeWidth} />
                                        </g>
                                    );
                                }
                            }

                            if (isGunnerFamily) {
                                const conduitColor = isAutoGunner ? 'rgba(80,180,255,0.55)' : 'rgba(110,255,130,0.55)';
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect x={0} y={-bWid * 0.52} width={bLen} height={bWid * 1.04} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
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
                                        <path d={`M 0 ${-bWid * 0.52} L ${bLen * 0.78} ${-bWid * 0.52} L ${bLen} ${-bWid * 0.3} L ${bLen} ${bWid * 0.3} L ${bLen * 0.78} ${bWid * 0.52} L 0 ${bWid * 0.52} Z`} fill={barrelFill} stroke={COLORS.border} strokeWidth={strokeWidth} />
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
                                            fill={barrelFill} 
                                            stroke={COLORS.border} 
                                            strokeWidth={strokeWidth}
                                        />
                                    ) : (
                                        <rect 
                                            x={0} 
                                            y={-bWid / 2} 
                                            width={bLen} 
                                            height={bWid} 
                                            fill={barrelFill} 
                                            stroke={COLORS.border} 
                                            strokeWidth={strokeWidth} 
                                        />
                                    )}
                                    <line x1={bLen} y1={- (bWid * (spread || 1)) / 2} x2={bLen} y2={(bWid * (spread || 1)) / 2} stroke="#444" strokeWidth={strokeWidth} />
                                </g>
                            );
                        })}

                        {isBossTank && (
                            <g>
                                {Array.from({ length: tankClass === TankClass.CELESTIAL ? 6 : tankClass === TankClass.LEVIATHAN ? 5 : tankClass === TankClass.OBLITERATOR ? 4 : 3 }).map((_, i) => {
                                    const n = tankClass === TankClass.CELESTIAL ? 6 : tankClass === TankClass.LEVIATHAN ? 5 : tankClass === TankClass.OBLITERATOR ? 4 : 3;
                                    const a = (i / n) * Math.PI * 2 + (tankClass === TankClass.COLOSSAL ? Math.PI / 6 : 0);
                                    const d = effectiveRadius * (tankClass === TankClass.CELESTIAL ? 0.55 : tankClass === TankClass.OBLITERATOR ? 0.58 : 0.5);
                                    const x = Math.cos(a) * d;
                                    const y = Math.sin(a) * d;
                                    return (
                                        <g key={`rt-${i}`} transform={`translate(${x}, ${y}) rotate(${(i / n) * 360})`} opacity={0.95}>
                                            <circle cx="0" cy="0" r={effectiveRadius * 0.12} fill="rgba(17,24,39,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth={strokeWidth * 0.5} />
                                            <rect x={-effectiveRadius * 0.03} y={-effectiveRadius * 0.03} width={effectiveRadius * 0.28} height={effectiveRadius * 0.06} rx={effectiveRadius * 0.02} fill="rgba(226,232,240,0.85)" stroke="rgba(15,23,42,0.8)" strokeWidth={strokeWidth * 0.35} />
                                        </g>
                                    );
                                })}
                            </g>
                        )}

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
                                <rect x={0} y={-effectiveRadius * 0.2} width={effectiveRadius * 0.98} height={effectiveRadius * 0.4} fill={barrelFill} stroke="#1f2933" strokeWidth={strokeWidth * 0.7} />
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
                        {tankClass === TankClass.LEVIATHAN && (
                            <g transform={`translate(${effectiveRadius * 0.08}, 0)`}>
                                <rect x={0} y={-effectiveRadius * 0.11} width={effectiveRadius * 0.7} height={effectiveRadius * 0.22} rx={effectiveRadius * 0.08} fill="#0b2b3a" stroke="rgba(186,230,253,0.72)" strokeWidth={strokeWidth * 0.65} />
                                <rect x={effectiveRadius * 0.48} y={-effectiveRadius * 0.19} width={effectiveRadius * 0.2} height={effectiveRadius * 0.38} rx={effectiveRadius * 0.06} fill="rgba(224,242,254,0.42)" stroke="rgba(15,23,42,0.8)" strokeWidth={strokeWidth * 0.45} />
                                <circle cx="0" cy="0" r={effectiveRadius * 0.13} fill="rgba(56,189,248,0.78)" stroke="rgba(255,255,255,0.6)" strokeWidth={strokeWidth * 0.45} />
                            </g>
                        )}
                  </g>
            </g>
        </svg>
    );
};


