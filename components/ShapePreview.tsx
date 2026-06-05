
import React, { useEffect, useRef } from 'react';
import { ShapeType, ShapeRarity } from '../types';
import { COLORS, SHAPE_STATS, RARITY_CONFIG, BOSS_STATS } from '../constants';

interface ShapePreviewProps {
    type: ShapeType | 'ALPHA_PENTAGON' | 'GRAND_SINGULARITY' | 'VOID_PORTAL' | 'DUMMY';
    rarity: ShapeRarity;
    size: number;
    className?: string;
    autoZoom?: boolean; // New prop to normalize size
}

export const ShapePreview: React.FC<ShapePreviewProps> = ({ type, rarity, size, className = "", autoZoom = true }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameIdRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let rotation = 0;
        let pulseTimer = Math.random() * Math.PI * 2;
        let swirlAngle = 0;
        let hueTimer = Math.random() * 360;

        const isBoss = type === 'ALPHA_PENTAGON' || type === 'GRAND_SINGULARITY';
        const isPortal = type === 'VOID_PORTAL';
        const isDummy = type === 'DUMMY';
        
        const stats = isBoss 
            ? BOSS_STATS[type as keyof typeof BOSS_STATS] 
            : isPortal 
                ? { radius: 80, color: COLORS.voidPortal, sides: 0, health: 1, xp: 1 }
                : isDummy
                    ? { radius: 40, color: '#ffbb00', sides: 0, health: 1, xp: 1 }
                    : SHAPE_STATS[type as ShapeType];
                
        const rarityConfig = (isBoss || isPortal || isDummy) 
            ? { sizeMult: 1.0, color: null, hpMult: 1.0, xpMult: 1.0, chance: 0 } 
            : RARITY_CONFIG[rarity];
            
        const effectiveRadius = stats.radius * rarityConfig.sizeMult;
        
        // Visual Normalization Logic
        const targetVisualRadius = isPortal ? (size * 0.25) : (size * 0.38); 
        const renderScale = autoZoom ? (targetVisualRadius / effectiveRadius) : (size * 0.4) / 180;

        // Portal specific ring and particle states
        const rings = [
            { angle: Math.random() * Math.PI * 2, speed: 6.28, radius: 0.9 }, // 1s
            { angle: Math.random() * Math.PI * 2, speed: 3.14, radius: 1.1 }, // 2s
            { angle: Math.random() * Math.PI * 2, speed: 2.09, radius: 1.3 }, // 3s
        ];

        const particles = Array.from({ length: 12 }, () => ({
            angle: Math.random() * Math.PI * 2,
            dist: 60 + Math.random() * 80,
            speed: (Math.random() * 0.5 + 0.5) * (Math.random() > 0.5 ? 1 : -1),
            size: 2 + Math.random() * 3
        }));

        const getShapeAngleOffset = (): number => {
            if (type === ShapeType.DIAMOND) return Math.PI * 0.25;
            if (type === ShapeType.TRIANGLE || type === ShapeType.HEPTAGON) return -Math.PI / 2;
            return 0;
        };

        const traceShape = (ctx: CanvasRenderingContext2D, sides: number, radius: number, angleOffset: number = 0) => {
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = angleOffset + (i * 2 * Math.PI) / sides;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        };

        const drawTranscendentBody = (ctx: CanvasRenderingContext2D, sides: number, radius: number) => {
            const hue = Math.floor(hueTimer % 360);
            const t = Date.now() / 1000;
            const isGlitching = Math.sin(t * 15) > 0.8;
            const glitchOffset = isGlitching ? (Math.random() - 0.5) * 16 : Math.sin(pulseTimer * 18) * 2;

            ctx.save();
            ctx.save(); 
            ctx.translate(-glitchOffset, isGlitching ? glitchOffset/2 : 0); 
            ctx.globalAlpha = 0.6; 
            traceShape(ctx, sides, radius); 
            ctx.lineWidth = 5; ctx.strokeStyle = 'cyan'; ctx.stroke(); 
            ctx.restore();

            ctx.save(); 
            ctx.translate(glitchOffset, isGlitching ? -glitchOffset/2 : 0); 
            ctx.globalAlpha = 0.6; 
            traceShape(ctx, sides, radius); 
            ctx.lineWidth = 5; ctx.strokeStyle = 'magenta'; ctx.stroke(); 
            ctx.restore();

            traceShape(ctx, sides, radius);
            ctx.fillStyle = '#080808'; ctx.fill();
            ctx.save(); ctx.clip();
            
            const scanY = ((t * 3) % 1.5) * radius * 4 - radius * 2;
            ctx.fillStyle = `hsla(${hue}, 100%, 85%, ${isGlitching ? 0.7 : 0.3})`;
            ctx.fillRect(-radius * 2.5, scanY, radius * 5, 4);
            
            const seed = Math.floor(Date.now() / 100);
            const rng = (i: number) => { const x = Math.sin(seed + i) * 10000; return x - Math.floor(x); };
            ctx.fillStyle = `hsl(${hue}, 100%, 75%)`;
            for(let i=0; i < (isGlitching ? 32 : 16); i++) {
                const sx = (rng(i) - 0.5) * radius * 2.4;
                const sy = (rng(i+60) - 0.5) * radius * 2.4;
                const sz = rng(i+120) * 6;
                ctx.fillRect(sx, sy, sz, sz);
            }
            ctx.restore();
            
            ctx.lineWidth = 5;
            ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
            ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
            ctx.shadowBlur = isGlitching ? 50 : 30;
            ctx.stroke();
            ctx.restore();
        };

        const drawAdvancedOctagon = (ctx: CanvasRenderingContext2D, r: number, fillColor: string, strokeColor: string, glowBlur: number, glowColor: string) => {
            const t = Date.now() / 1000;
            if (rarity !== ShapeRarity.COMMON && rarity !== ShapeRarity.UNCOMMON) {
                ctx.save();
                ctx.rotate(-rotation * 2);
                for(let i=0; i<8; i++) {
                    const angle = (i * Math.PI * 2) / 8;
                    const dist = r * 1.5 + Math.sin(t * 2 + i) * 10;
                    ctx.fillStyle = glowColor !== 'transparent' ? glowColor : fillColor;
                    ctx.globalAlpha = 0.6;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
                    ctx.lineTo(Math.cos(angle+0.2) * (dist+15), Math.sin(angle+0.2) * (dist+15));
                    ctx.lineTo(Math.cos(angle-0.2) * (dist+15), Math.sin(angle-0.2) * (dist+15));
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }

            if (glowBlur > 0) { ctx.shadowBlur = glowBlur; ctx.shadowColor = glowColor; }
            traceShape(ctx, 8, r);
            ctx.fillStyle = '#1a1a1a';
            ctx.fill();
            ctx.lineWidth = 6;
            ctx.strokeStyle = strokeColor;
            ctx.stroke();

            ctx.shadowBlur = 0;
            const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.9);
            coreGrad.addColorStop(0, fillColor);
            coreGrad.addColorStop(0.7, '#222');
            coreGrad.addColorStop(1, '#000');
            
            ctx.save();
            traceShape(ctx, 8, r * 0.85);
            ctx.clip();
            ctx.fillStyle = coreGrad;
            ctx.fillRect(-r, -r, r*2, r*2);
            
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2;
            for(let i=0; i<4; i++) {
                ctx.rotate(Math.PI / 4);
                ctx.beginPath();
                ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
                ctx.stroke();
            }
            ctx.restore();

            ctx.save();
            ctx.rotate(rotation * 0.5);
            traceShape(ctx, 8, r * 0.5);
            ctx.strokeStyle = fillColor;
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 15]);
            ctx.stroke();
            ctx.restore();
        };

        const drawAdvancedDiamond = (ctx: CanvasRenderingContext2D, r: number, fillColor: string, strokeColor: string, glowBlur: number, glowColor: string) => {
            if (glowBlur > 0) { ctx.shadowBlur = glowBlur; ctx.shadowColor = glowColor; }
            ctx.rotate(Math.PI * 0.25);
            traceShape(ctx, 4, r);
            const shell = ctx.createLinearGradient(-r, -r, r, r);
            shell.addColorStop(0, 'rgba(255,255,255,0.22)');
            shell.addColorStop(0.45, fillColor);
            shell.addColorStop(1, '#103d37');
            ctx.fillStyle = shell;
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = strokeColor;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.rotate(-rotation * 0.55);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.82);
            ctx.lineTo(0, r * 0.82);
            ctx.moveTo(-r * 0.82, 0);
            ctx.lineTo(r * 0.82, 0);
            ctx.stroke();
            ctx.restore();
        };

        const drawAdvancedHeptagon = (ctx: CanvasRenderingContext2D, r: number, fillColor: string, strokeColor: string, glowBlur: number, glowColor: string) => {
            if (glowBlur > 0) { ctx.shadowBlur = glowBlur; ctx.shadowColor = glowColor; }
            traceShape(ctx, 7, r, -Math.PI / 2);
            const shell = ctx.createRadialGradient(0, -r * 0.18, r * 0.1, 0, 0, r);
            shell.addColorStop(0, 'rgba(255,255,255,0.26)');
            shell.addColorStop(0.42, fillColor);
            shell.addColorStop(1, '#1f1638');
            ctx.fillStyle = shell;
            ctx.fill();
            ctx.lineWidth = 3.2;
            ctx.strokeStyle = strokeColor;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.16)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 7; i++) {
                const angle = -Math.PI / 2 + (i * Math.PI * 2) / 7;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * r * 0.82, Math.sin(angle) * r * 0.82);
                ctx.stroke();
            }
            ctx.restore();
        };

        const render = () => {
            const dt = 0.016;
            pulseTimer += dt * (isBoss ? 2 : 3);
            hueTimer += dt * 120;
            const sides = stats.sides || 0;
            const t = Date.now() / 1000;
            
            rotation += type === ShapeType.OCTAGON ? 0.008 : type === ShapeType.HEPTAGON ? 0.011 : (isBoss ? 0.01 : 0.015);
            swirlAngle += dt * 2;

            ctx.clearRect(0, 0, size, size);
            ctx.save();
            ctx.translate(size/2, size/2);
            ctx.scale(renderScale, renderScale); 

            if (isPortal) {
                const portalScale = 1.0 + Math.sin(t * 3) * 0.05;
                ctx.scale(portalScale, portalScale);

                // Reality Bending Glow
                const glowRadius = 80 * (1.5 + Math.sin(t * 3) * 0.2);
                const glowIntensity = 0.6 + Math.sin(t * 2) * 0.2;
                const grad = ctx.createRadialGradient(0, 0, 40, 0, 0, glowRadius);
                grad.addColorStop(0, `rgba(26, 0, 51, ${glowIntensity})`);
                grad.addColorStop(0.5, `rgba(110, 44, 242, ${glowIntensity * 0.6})`);
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(0, 0, glowRadius, 0, Math.PI * 2); ctx.fill();

                // Core
                ctx.fillStyle = '#1a0033';
                ctx.beginPath(); ctx.arc(0, 0, 80 * 0.8, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#6e2cf2';
                ctx.lineWidth = 4;
                ctx.stroke();

                // Orbital Rings
                rings.forEach((ring, i) => {
                    ring.angle += ring.speed * dt;
                    ctx.save();
                    ctx.rotate(ring.angle);
                    ctx.strokeStyle = i === 0 ? '#ffffff' : i === 1 ? '#a855f7' : '#6e2cf2';
                    ctx.lineWidth = 3 - i * 0.5;
                    ctx.globalAlpha = 0.8;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 80 * ring.radius, 80 * ring.radius * 0.3, (i * Math.PI) / 3, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                });

                // Particles
                particles.forEach(p => {
                    p.angle += p.speed * dt;
                    ctx.fillStyle = '#a855f7';
                    const px = Math.cos(p.angle) * p.dist;
                    const py = Math.sin(p.angle) * p.dist;
                    ctx.beginPath();
                    ctx.arc(px, py, p.size, 0, Math.PI * 2);
                    ctx.fill();
                });
            } else if (type === 'GRAND_SINGULARITY') {
                const auraSize = effectiveRadius * (1.2 + Math.sin(t * 2) * 0.05);
                const grad = ctx.createRadialGradient(0, 0, effectiveRadius * 0.8, 0, 0, auraSize);
                grad.addColorStop(0, 'rgba(0, 85, 255, 0.4)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(0, 0, auraSize, 0, Math.PI * 2); ctx.fill();
                for (let j = 0; j < 2; j++) {
                    ctx.save(); ctx.rotate(j === 0 ? t * 0.5 : -t * 0.8);
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const angle = (i * 2 * Math.PI) / 5;
                        const r = effectiveRadius * (1.1 + j * 0.2);
                        const x = Math.cos(angle) * r;
                        const y = Math.sin(angle) * r;
                        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.lineWidth = 8; ctx.strokeStyle = j === 0 ? 'rgba(0, 178, 225, 0.6)' : 'rgba(118, 141, 252, 0.4)'; ctx.stroke();
                    ctx.restore();
                }
            } else if (isDummy) {
                // Draw Dummy Body
                ctx.beginPath();
                ctx.arc(0, 0, 40, 0, Math.PI * 2);
                ctx.fillStyle = '#ffbb00';
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = COLORS.border;
                ctx.stroke();
                
                // Draw "DPS" text hint
                ctx.font = 'bold 20px Ubuntu';
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('DPS', 0, 0);
            }

            if (!isPortal && !isDummy) {
                if (rarity === ShapeRarity.TRANSCENDENT && !isBoss) {
                    ctx.rotate(rotation);
                    drawTranscendentBody(ctx, sides, effectiveRadius);
                } else {
                    let fillColor = rarityConfig.color || stats.color;
                    let strokeColor = COLORS.border;
                    let glowBlur = 0;
                    let glowColor = 'transparent';

                    switch (rarity) {
                        case ShapeRarity.UNCOMMON: strokeColor = '#4db8ff'; glowColor = '#4db8ff'; glowBlur = 12; break;
                        case ShapeRarity.RARE: strokeColor = '#00ff80'; glowColor = '#00ff80'; glowBlur = 25; break;
                        case ShapeRarity.EPIC: fillColor = '#ffd700'; strokeColor = '#ffaa00'; glowColor = '#ffcc00'; glowBlur = 40; break;
                        case ShapeRarity.LEGENDARY: fillColor = '#ff5e00'; strokeColor = '#ff0000'; glowColor = '#ff5e00'; glowBlur = 55; break;
                        case ShapeRarity.MYTHICAL: fillColor = '#1a002b'; strokeColor = '#a200ff'; glowColor = '#a200ff'; glowBlur = 70; break;
                        case ShapeRarity.ETERNAL: fillColor = '#f0ffff'; strokeColor = '#00ffff'; glowColor = '#00ffff'; glowBlur = 95; break;
                    }

                    if (isBoss) { glowBlur = 30; glowColor = stats.color; }

                    ctx.save();
                    if (type === ShapeType.OCTAGON) {
                        drawAdvancedOctagon(ctx, effectiveRadius, fillColor, strokeColor, glowBlur, glowColor);
                    } else if (type === ShapeType.DIAMOND) {
                        drawAdvancedDiamond(ctx, effectiveRadius, fillColor, strokeColor, glowBlur, glowColor);
                    } else if (type === ShapeType.HEPTAGON) {
                        drawAdvancedHeptagon(ctx, effectiveRadius, fillColor, strokeColor, glowBlur, glowColor);
                    } else {
                        ctx.scale(1.0 + Math.sin(pulseTimer) * 0.04, 1.0 + Math.sin(pulseTimer) * 0.04);
                        if (glowBlur > 0) { ctx.shadowBlur = glowBlur; ctx.shadowColor = glowColor; }
                        ctx.rotate(rotation);
                        traceShape(ctx, sides, effectiveRadius, getShapeAngleOffset());
                        ctx.fillStyle = fillColor; ctx.fill();
                        ctx.lineWidth = isBoss ? 10 : 3; ctx.strokeStyle = strokeColor; ctx.stroke();
                    }
                    ctx.restore();
                }
            }

            if (type === 'GRAND_SINGULARITY') {
                ctx.beginPath(); ctx.arc(0, 0, effectiveRadius * 0.3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.shadowBlur = 20; ctx.shadowColor = '#0ff'; ctx.fill();
            }

            ctx.restore();
            frameIdRef.current = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(frameIdRef.current);
    }, [type, rarity, size, autoZoom]);

    return <canvas ref={canvasRef} width={size} height={size} className={className} />;
};
