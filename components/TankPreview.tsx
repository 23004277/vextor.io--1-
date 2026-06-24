
import React, { useEffect, useId, useRef } from 'react';
import { TankClass } from '../types';
import { COLORS, TANK_CONFIGS } from '../constants';
import { getSandboxBossForm } from '../services/sandbox/SandboxBossForms';

interface TankPreviewProps {
    tankClass: TankClass;
    bossRushKey?: 'gatekeeper' | 'splitter' | 'reactor' | 'executioner' | 'grand_singularity';
    barrels?: number[][];
    color?: string;
    size?: number;
    className?: string;
    turretRotation?: number;
    chassisRotation?: number;
    showArenaVfx?: boolean;
    renderMode?: 'legacy' | 'ingame';
    previewVariant?: 'default' | 'bossProtocol';
}

const tracePolygon = (ctx: CanvasRenderingContext2D, points: Array<[number, number]>) => {
    if (!points.length) return;
    ctx.beginPath();
    points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
};

const fillAndStroke = (ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, stroke = COLORS.border, lineWidth = 2) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.fill();
    ctx.stroke();
};

const drawRegularPreviewBody = (
    ctx: CanvasRenderingContext2D,
    tankClass: TankClass,
    radius: number,
    bodyColor: string
) => {
    ctx.lineWidth = Math.max(1.8, radius * 0.13);
    ctx.strokeStyle = COLORS.border;
    ctx.fillStyle = bodyColor;

    if (tankClass === TankClass.COLOSSAL) {
        const grad = ctx.createLinearGradient(-radius, -radius, radius * 1.1, radius);
        grad.addColorStop(0, '#4a1039');
        grad.addColorStop(0.45, '#db2777');
        grad.addColorStop(1, '#fbcfe8');
        tracePolygon(ctx, [
            [radius * 1.02, 0],
            [radius * 0.5, -radius * 0.88],
            [-radius * 0.4, -radius * 0.98],
            [-radius * 1.04, -radius * 0.34],
            [-radius * 1.04, radius * 0.34],
            [-radius * 0.4, radius * 0.98],
            [radius * 0.5, radius * 0.88],
        ]);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.2, radius * 0.12));
        return;
    }

    if (tankClass === TankClass.LEVIATHAN) {
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        grad.addColorStop(0, '#082f49');
        grad.addColorStop(0.5, '#0ea5e9');
        grad.addColorStop(1, '#bfdbfe');
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 12; i += 1) {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const rr = i % 3 === 0 ? radius * 1.02 : i % 2 === 0 ? radius * 0.66 : radius * 0.34;
            points.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
        }
        tracePolygon(ctx, points);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.2, radius * 0.12));
        return;
    }

    if (tankClass === TankClass.WARLORD) {
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        grad.addColorStop(0, '#3f1d2e');
        grad.addColorStop(0.45, '#be123c');
        grad.addColorStop(1, '#fecaca');
        tracePolygon(ctx, [
            [radius * 1.02, 0],
            [radius * 0.18, -radius * 0.58],
            [-radius * 0.24, -radius * 0.96],
            [-radius * 0.84, -radius * 0.54],
            [-radius * 0.84, radius * 0.54],
            [-radius * 0.24, radius * 0.96],
            [radius * 0.18, radius * 0.58],
        ]);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.2, radius * 0.12));
        return;
    }

    if (tankClass === TankClass.CELESTIAL) {
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        grad.addColorStop(0, '#2e1065');
        grad.addColorStop(0.45, '#7e22ce');
        grad.addColorStop(1, '#ddd6fe');
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 10; i += 1) {
            const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
            const rr = i % 2 === 0 ? radius * 0.98 : radius * 0.58;
            points.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
        }
        tracePolygon(ctx, points);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.2, radius * 0.12));
        return;
    }

    if (tankClass === TankClass.OBLITERATOR) {
        const grad = ctx.createLinearGradient(-radius * 1.2, -radius, radius * 1.2, radius);
        grad.addColorStop(0, '#1a0b33');
        grad.addColorStop(0.42, '#6d28d9');
        grad.addColorStop(0.72, '#a855f7');
        grad.addColorStop(1, '#f5d0fe');
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 16; i += 1) {
            const angle = -Math.PI / 2 + (i / 16) * Math.PI * 2;
            const rr = i % 2 === 0 ? radius * 1.02 : radius * 0.72;
            points.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
        }
        tracePolygon(ctx, points);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.2, radius * 0.12));
        return;
    }

    if (tankClass === TankClass.PACIFIST_TRAINEE) {
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 5; i += 1) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
        }
        tracePolygon(ctx, points);
        fillAndStroke(ctx, bodyColor);
        return;
    }

    if (tankClass === TankClass.DRAINER_TRAINEE) {
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 3; i += 1) {
            const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
            points.push([Math.cos(angle) * radius * 1.1, Math.sin(angle) * radius * 1.1]);
        }
        tracePolygon(ctx, points);
        fillAndStroke(ctx, bodyColor);
        return;
    }

    if (tankClass === TankClass.NURSE || tankClass === TankClass.DOCTOR) {
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 6; i += 1) {
            const angle = (i * Math.PI) / 3;
            const rr = tankClass === TankClass.DOCTOR ? radius * 1.08 : radius * 0.98;
            points.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
        }
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        grad.addColorStop(0, bodyColor);
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, bodyColor);
        tracePolygon(ctx, points);
        fillAndStroke(ctx, grad);
        return;
    }

    if (tankClass === TankClass.PLAGUE_DOCTOR) {
        tracePolygon(ctx, [
            [radius * 1.8, 0],
            [radius * 0.5, radius * 0.6],
            [-radius * 0.8, radius * 1.0],
            [-radius * 1.3, radius * 0.4],
            [-radius * 1.3, -radius * 0.4],
            [-radius * 0.8, -radius * 1.0],
            [radius * 0.5, -radius * 0.6],
        ]);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.8);
        grad.addColorStop(0, bodyColor);
        grad.addColorStop(0.8, '#1a1a1a');
        grad.addColorStop(1, '#000000');
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.4, radius * 0.14));
        return;
    }

    if (tankClass === TankClass.LEECH) {
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 8; i += 1) {
            const angle = (i / 8) * Math.PI * 2;
            const rr = i % 2 === 0 ? radius * 1.3 : radius * 0.75;
            points.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
        }
        const grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.12, radius * 0.15, 0, 0, radius * 1.45);
        grad.addColorStop(0, '#fecaca');
        grad.addColorStop(0.22, '#ef4444');
        grad.addColorStop(0.62, '#450a0a');
        grad.addColorStop(1, '#120304');
        tracePolygon(ctx, points);
        fillAndStroke(ctx, grad, 'rgba(255, 205, 205, 0.52)', Math.max(2.2, radius * 0.12));
        return;
    }

    if (tankClass === TankClass.VAMPIRE) {
        tracePolygon(ctx, [
            [radius * 1.5, 0],
            [radius * 0.3, radius * 1.25],
            [-radius * 1.1, radius * 0.95],
            [-radius * 0.6, 0],
            [-radius * 1.1, -radius * 0.95],
            [radius * 0.3, -radius * 1.25],
        ]);
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        grad.addColorStop(0, '#500');
        grad.addColorStop(0.5, bodyColor);
        grad.addColorStop(1, '#500');
        fillAndStroke(ctx, grad);
        return;
    }

    if (tankClass === TankClass.REAPER) {
        ctx.beginPath();
        ctx.moveTo(radius * 1.45, 0);
        ctx.bezierCurveTo(radius * 1.05, radius * 1.3, -radius * 0.95, radius * 1.58, -radius * 1.35, 0);
        ctx.bezierCurveTo(-radius * 0.95, -radius * 1.58, radius * 1.05, -radius * 1.3, radius * 1.45, 0);
        ctx.closePath();
        const grad = ctx.createRadialGradient(radius * 0.12, -radius * 0.08, radius * 0.15, 0, 0, radius * 1.62);
        grad.addColorStop(0, '#fca5a5');
        grad.addColorStop(0.34, '#ef4444');
        grad.addColorStop(0.72, '#3f0a0a');
        grad.addColorStop(1, '#090303');
        fillAndStroke(ctx, grad, 'rgba(255, 185, 185, 0.62)', Math.max(2.6, radius * 0.14));
        return;
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    fillAndStroke(ctx, bodyColor);
};

const drawBossRushPreviewBody = (
    ctx: CanvasRenderingContext2D,
    bossKey: NonNullable<TankPreviewProps['bossRushKey']>,
    radius: number,
    variant: NonNullable<TankPreviewProps['previewVariant']> = 'default'
) => {
    const accent =
        bossKey === 'gatekeeper' ? '#fca5a5' :
        bossKey === 'splitter' ? '#fecdd3' :
        bossKey === 'reactor' ? '#fdba74' :
        bossKey === 'executioner' ? '#fca5a5' :
        '#c4b5fd';
    const low =
        bossKey === 'gatekeeper' ? '#3f1118' :
        bossKey === 'splitter' ? '#4b1327' :
        bossKey === 'reactor' ? '#51210c' :
        bossKey === 'executioner' ? '#3a0c12' :
        '#23103f';
    const mid =
        bossKey === 'gatekeeper' ? '#b91c1c' :
        bossKey === 'splitter' ? '#e11d48' :
        bossKey === 'reactor' ? '#ea580c' :
        bossKey === 'executioner' ? '#dc2626' :
        '#7c3aed';
    const high =
        bossKey === 'gatekeeper' ? '#fecaca' :
        bossKey === 'splitter' ? '#ffe4ea' :
        bossKey === 'reactor' ? '#ffedd5' :
        bossKey === 'executioner' ? '#ffe4e6' :
        '#ede9fe';

    const aura = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.9);
    aura.addColorStop(0, `${accent}55`);
    aura.addColorStop(0.45, `${mid}30`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.9, 0, Math.PI * 2);
    ctx.fill();

    if (variant === 'bossProtocol') {
        ctx.save();
        ctx.strokeStyle = `${accent}88`;
        ctx.lineWidth = Math.max(1.5, radius * 0.07);
        for (let ring = 0; ring < 2; ring += 1) {
            ctx.beginPath();
            ctx.ellipse(
                0,
                0,
                radius * (1.18 + ring * 0.18),
                radius * (0.48 + ring * 0.08),
                ring === 0 ? -0.28 : 0.24,
                0,
                Math.PI * 2
            );
            ctx.stroke();
        }
        ctx.restore();
    }

    if (bossKey === 'gatekeeper') {
        tracePolygon(ctx, [
            [-radius * 0.78, -radius * 0.94],
            [radius * 0.78, -radius * 0.94],
            [radius * 1.02, -radius * 0.24],
            [radius * 1.02, radius * 0.24],
            [radius * 0.78, radius * 0.94],
            [-radius * 0.78, radius * 0.94],
            [-radius * 1.02, radius * 0.24],
            [-radius * 1.02, -radius * 0.24],
        ]);
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        grad.addColorStop(0, high);
        grad.addColorStop(0.34, accent);
        grad.addColorStop(0.68, mid);
        grad.addColorStop(1, low);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.2, radius * 0.12));
        return;
    }

    if (bossKey === 'splitter') {
        const left = new Path2D(`M ${radius * 0.08} ${-radius * 0.94} Q ${-radius * 0.92} ${-radius * 0.16} ${-radius * 0.26} ${radius * 0.94} L ${radius * 0.18} ${radius * 0.52} L ${radius * 0.22} ${-radius * 0.46} Z`);
        const right = new Path2D(`M ${-radius * 0.08} ${-radius * 0.94} Q ${radius * 0.92} ${-radius * 0.16} ${radius * 0.26} ${radius * 0.94} L ${-radius * 0.18} ${radius * 0.52} L ${-radius * 0.22} ${-radius * 0.46} Z`);
        const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 1.3);
        grad.addColorStop(0, high);
        grad.addColorStop(0.34, accent);
        grad.addColorStop(0.72, mid);
        grad.addColorStop(1, low);
        ctx.save();
        ctx.translate(-radius * 0.18, 0);
        ctx.rotate(-0.17);
        ctx.fillStyle = grad;
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = Math.max(2.1, radius * 0.11);
        ctx.fill(left);
        ctx.stroke(left);
        ctx.restore();
        ctx.save();
        ctx.translate(radius * 0.18, 0);
        ctx.rotate(0.17);
        ctx.fillStyle = grad;
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = Math.max(2.1, radius * 0.11);
        ctx.fill(right);
        ctx.stroke(right);
        ctx.restore();
        return;
    }

    if (bossKey === 'reactor') {
        const points: Array<[number, number]> = [];
        for (let i = 0; i < 8; i += 1) {
            const angle = -Math.PI / 2 + (i * Math.PI) / 4;
            const rr = radius * (i % 2 === 0 ? 0.98 : 0.72);
            points.push([Math.cos(angle) * rr, Math.sin(angle) * rr]);
        }
        const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 1.2);
        grad.addColorStop(0, high);
        grad.addColorStop(0.26, accent);
        grad.addColorStop(0.68, mid);
        grad.addColorStop(1, low);
        tracePolygon(ctx, points);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.1, radius * 0.11));
        return;
    }

    if (bossKey === 'executioner') {
        tracePolygon(ctx, [
            [-radius * 0.84, -radius * 0.38],
            [radius * 0.02, -radius * 0.94],
            [radius * 0.94, 0],
            [radius * 0.02, radius * 0.94],
            [-radius * 0.84, radius * 0.38],
        ]);
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        grad.addColorStop(0, low);
        grad.addColorStop(0.35, mid);
        grad.addColorStop(0.7, accent);
        grad.addColorStop(1, high);
        fillAndStroke(ctx, grad, COLORS.border, Math.max(2.2, radius * 0.12));
        return;
    }

    const rings = [1, 0.7, 0.42];
    rings.forEach((multiplier, index) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius * multiplier, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius * multiplier);
        grad.addColorStop(0, index === 2 ? '#f5f3ff' : high);
        grad.addColorStop(0.55, index === 0 ? accent : mid);
        grad.addColorStop(1, low);
        fillAndStroke(ctx, grad, index === 0 ? `${accent}99` : `${high}66`, Math.max(1.6, radius * 0.08));
    });
};

const drawPreviewBarrel = (
    ctx: CanvasRenderingContext2D,
    options: {
        barrel: number[];
        radius: number;
        baseGradient: CanvasGradient;
        bossRushKey?: NonNullable<TankPreviewProps['bossRushKey']>;
        previewVariant?: NonNullable<TankPreviewProps['previewVariant']>;
    }
) => {
    const { barrel, radius, baseGradient, bossRushKey, previewVariant = 'default' } = options;
    const [length, width = 0.8, xOff = 0, angleOff = 0, , yOff = 0] = barrel;
    const barrelLen = length * radius;
    const barrelWid = Math.max(3, width * radius);
    const barrelX = xOff * radius;
    const barrelY = yOff * radius;
    const isBossProtocol = !!bossRushKey && previewVariant === 'bossProtocol';

    ctx.save();
    ctx.rotate(angleOff);
    ctx.translate(barrelX, barrelY);

    if (bossRushKey === 'gatekeeper' && isBossProtocol) {
        const shell = ctx.createLinearGradient(0, -barrelWid, barrelLen, barrelWid);
        shell.addColorStop(0, '#3f1118');
        shell.addColorStop(0.5, '#fca5a5');
        shell.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = shell;
        ctx.strokeStyle = '#3f1118';
        ctx.lineWidth = Math.max(1.1, radius * 0.06);
        ctx.beginPath();
        ctx.roundRect(0, -barrelWid * 0.44, barrelLen, barrelWid * 0.88, barrelWid * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(barrelLen * 0.12, -barrelWid * 0.14, barrelLen * 0.56, barrelWid * 0.12);
        ctx.strokeStyle = 'rgba(254,202,202,0.42)';
        ctx.strokeRect(barrelLen * 0.28, -barrelWid * 0.3, barrelLen * 0.24, barrelWid * 0.6);
        ctx.restore();
        return;
    }

    if (bossRushKey === 'splitter' && isBossProtocol) {
        ctx.fillStyle = '#4b1327';
        ctx.strokeStyle = '#fecdd3';
        ctx.lineWidth = Math.max(1.05, radius * 0.055);
        ctx.beginPath();
        ctx.moveTo(0, -barrelWid * 0.35);
        ctx.lineTo(barrelLen * 0.7, -barrelWid * 0.48);
        ctx.lineTo(barrelLen, 0);
        ctx.lineTo(barrelLen * 0.7, barrelWid * 0.48);
        ctx.lineTo(0, barrelWid * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(barrelLen * 0.16, -barrelWid * 0.08, barrelLen * 0.42, barrelWid * 0.16);
        ctx.restore();
        return;
    }

    if (bossRushKey === 'reactor' && isBossProtocol) {
        const shell = ctx.createLinearGradient(0, -barrelWid, barrelLen, barrelWid);
        shell.addColorStop(0, '#51210c');
        shell.addColorStop(0.44, '#fdba74');
        shell.addColorStop(1, '#7c2d12');
        ctx.fillStyle = shell;
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = Math.max(1.05, radius * 0.055);
        ctx.beginPath();
        ctx.roundRect(0, -barrelWid * 0.42, barrelLen * 0.82, barrelWid * 0.84, barrelWid * 0.24);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(barrelLen * 0.88, 0, barrelWid * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = '#fdba74';
        ctx.fill();
        ctx.strokeStyle = '#ffedd5';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,237,213,0.26)';
        ctx.fillRect(barrelLen * 0.18, -barrelWid * 0.12, barrelLen * 0.4, barrelWid * 0.24);
        ctx.restore();
        return;
    }

    if (bossRushKey === 'executioner' && isBossProtocol) {
        ctx.fillStyle = '#3a0c12';
        ctx.strokeStyle = '#ffe4e6';
        ctx.lineWidth = Math.max(1.05, radius * 0.055);
        ctx.beginPath();
        ctx.moveTo(0, -barrelWid * 0.3);
        ctx.lineTo(barrelLen * 0.78, -barrelWid * 0.42);
        ctx.lineTo(barrelLen, 0);
        ctx.lineTo(barrelLen * 0.78, barrelWid * 0.42);
        ctx.lineTo(0, barrelWid * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(barrelLen * 0.18, -barrelWid * 0.08, barrelLen * 0.45, barrelWid * 0.16);
        ctx.restore();
        return;
    }

    if (bossRushKey === 'grand_singularity' && isBossProtocol) {
        const shell = ctx.createLinearGradient(0, -barrelWid, barrelLen, barrelWid);
        shell.addColorStop(0, '#23103f');
        shell.addColorStop(0.35, '#7c3aed');
        shell.addColorStop(0.7, '#c4b5fd');
        shell.addColorStop(1, '#312e81');
        ctx.fillStyle = shell;
        ctx.strokeStyle = '#23103f';
        ctx.lineWidth = Math.max(1.15, radius * 0.06);
        ctx.beginPath();
        ctx.roundRect(0, -barrelWid * 0.44, barrelLen * 0.86, barrelWid * 0.88, barrelWid * 0.24);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(barrelLen * 0.94, 0, barrelWid * 0.38, 0, Math.PI * 2);
        const core = ctx.createRadialGradient(barrelLen * 0.94, 0, barrelWid * 0.04, barrelLen * 0.94, 0, barrelWid * 0.38);
        core.addColorStop(0, '#f5f3ff');
        core.addColorStop(0.35, '#c4b5fd');
        core.addColorStop(1, '#312e81');
        ctx.fillStyle = core;
        ctx.fill();
        ctx.strokeStyle = '#ddd6fe';
        ctx.stroke();
        ctx.restore();
        return;
    }

    ctx.fillStyle = baseGradient;
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = Math.max(1.1, radius * 0.06);
    ctx.beginPath();
    ctx.roundRect(0, -barrelWid / 2, barrelLen, barrelWid, barrelWid * 0.28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barrelLen * 0.18, -barrelWid * 0.24, barrelLen * 0.6, barrelWid * 0.18);
    ctx.restore();
};

const InGameTankPreviewCanvas: React.FC<TankPreviewProps> = ({
    tankClass,
    bossRushKey,
    barrels,
    color,
    size = 60,
    className = '',
    turretRotation = 0,
    chassisRotation = 0,
    showArenaVfx = false,
    previewVariant = 'default',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        const sandboxBossForm = getSandboxBossForm(tankClass);
        const resolvedBossKey = bossRushKey ?? sandboxBossForm?.bossKey;
        const isBossTank =
            tankClass === TankClass.COLOSSAL ||
            tankClass === TankClass.LEVIATHAN ||
            tankClass === TankClass.WARLORD ||
            tankClass === TankClass.CELESTIAL ||
            tankClass === TankClass.OBLITERATOR ||
            !!resolvedBossKey;
        const isPacifist = tankClass === TankClass.PACIFIST_TRAINEE || tankClass === TankClass.NURSE || tankClass === TankClass.DOCTOR || tankClass === TankClass.PLAGUE_DOCTOR;
        const isDraining = tankClass === TankClass.DRAINER_TRAINEE || tankClass === TankClass.LEECH || tankClass === TankClass.VAMPIRE || tankClass === TankClass.REAPER;

        let bodyColor = color || COLORS.player;
        if (isBossTank && !resolvedBossKey) bodyColor = '#9f76fc';
        else if (isPacifist) bodyColor = '#22c55e';
        else if (isDraining) bodyColor = '#dc2626';

        const resolvedBarrels = barrels ?? sandboxBossForm?.barrels ?? TANK_CONFIGS[tankClass] ?? TANK_CONFIGS[TankClass.BASIC];
        const radius = (size / 60) * (isBossTank ? 20 : 14);
        const center = size / 2;
        const barrelGradient = ctx.createLinearGradient(0, -radius, 0, radius);
        barrelGradient.addColorStop(0, '#7b8794');
        barrelGradient.addColorStop(0.5, '#b5bec7');
        barrelGradient.addColorStop(1, '#6b7280');

        if (showArenaVfx && isBossTank) {
            const glow = ctx.createRadialGradient(center, center, radius * 0.25, center, center, radius * 2.2);
            glow.addColorStop(0, resolvedBossKey ? 'rgba(255,255,255,0.12)' : 'rgba(125,211,252,0.12)');
            glow.addColorStop(0.6, resolvedBossKey ? 'rgba(236,72,153,0.10)' : 'rgba(56,189,248,0.10)');
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(center, center, radius * 2.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.save();
        ctx.translate(center, center);

        ctx.save();
        ctx.rotate((chassisRotation * Math.PI) / 180);
        if (resolvedBossKey) drawBossRushPreviewBody(ctx, resolvedBossKey, radius, previewVariant);
        else drawRegularPreviewBody(ctx, tankClass, radius, bodyColor);
        ctx.restore();

        ctx.save();
        ctx.rotate((turretRotation * Math.PI) / 180);
        resolvedBarrels.forEach((barrel) => {
            drawPreviewBarrel(ctx, {
                barrel,
                radius,
                baseGradient: barrelGradient,
                bossRushKey: resolvedBossKey,
                previewVariant,
            });
        });

        if (resolvedBossKey) {
            const coreGrad = ctx.createRadialGradient(-radius * 0.14, -radius * 0.1, radius * 0.08, 0, 0, radius * 0.7);
            coreGrad.addColorStop(0, '#ffffff');
            coreGrad.addColorStop(0.28, resolvedBossKey === 'reactor' ? '#fdba74' : resolvedBossKey === 'grand_singularity' ? '#c4b5fd' : '#fca5a5');
            coreGrad.addColorStop(1, 'rgba(20,20,28,0.32)');
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
            fillAndStroke(ctx, coreGrad, 'rgba(255,255,255,0.28)', Math.max(1.2, radius * 0.06));
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2);
            fillAndStroke(ctx, bodyColor, COLORS.border, Math.max(2, radius * 0.1));
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.fill();
        }
        ctx.restore();

        ctx.restore();
    }, [barrels, bossRushKey, chassisRotation, color, previewVariant, showArenaVfx, size, tankClass, turretRotation]);

    return <canvas ref={canvasRef} width={size} height={size} className={`block ${className}`} />;
};

const isTrapperBranchClass = (tankClass: TankClass) =>
    tankClass === TankClass.TRAPPER ||
    tankClass === TankClass.DUAL_TRAPPER ||
    tankClass === TankClass.MACHINE_GUN_TRAPPER ||
    tankClass === TankClass.OCTO_TRAPPER ||
    tankClass === TankClass.TRIPLE_TRAPPER;

const TankPreviewComponent: React.FC<TankPreviewProps> = ({ 
    tankClass, 
    bossRushKey,
    barrels,
    color, 
    size = 60, 
    className = "",
    turretRotation = 0,
    chassisRotation = 0,
    showArenaVfx = false,
    renderMode = 'legacy',
    previewVariant = 'default',
}) => {
    const previewId = useId().replace(/:/g, '');

    if (renderMode === 'ingame') {
        return (
            <InGameTankPreviewCanvas
                tankClass={tankClass}
                bossRushKey={bossRushKey}
                barrels={barrels}
                color={color}
                size={size}
                className={className}
                turretRotation={turretRotation}
                chassisRotation={chassisRotation}
                showArenaVfx={showArenaVfx}
                previewVariant={previewVariant}
            />
        );
    }
    const config = barrels || TANK_CONFIGS[tankClass] || TANK_CONFIGS[TankClass.BASIC];
    const center = size / 2;
    const scale = size / 60;
    const radius = 14 * scale; 
    const strokeWidth = 2 * scale;
    
    const isBossTank =
        tankClass === TankClass.COLOSSAL ||
        tankClass === TankClass.LEVIATHAN ||
        tankClass === TankClass.WARLORD ||
        tankClass === TankClass.CELESTIAL ||
        tankClass === TankClass.OBLITERATOR ||
        tankClass === TankClass.AEGIS_GATEKEEPER ||
        tankClass === TankClass.VANTA_SPLITTER ||
        tankClass === TankClass.PYRE_REACTOR ||
        tankClass === TankClass.IRON_EXECUTIONER ||
        tankClass === TankClass.GRAND_SINGULARITY;
    const isPacifist = tankClass === TankClass.PACIFIST_TRAINEE || tankClass === TankClass.NURSE || tankClass === TankClass.DOCTOR || tankClass === TankClass.PLAGUE_DOCTOR;
    const isDraining = tankClass === TankClass.DRAINER_TRAINEE || tankClass === TankClass.LEECH || tankClass === TankClass.VAMPIRE || tankClass === TankClass.REAPER;
    const isGunner = tankClass === TankClass.GUNNER;
    const isAutoGunner = tankClass === TankClass.AUTO_GUNNER;
    const isGunnerFamily = isGunner || isAutoGunner;
    const isTripleShot = tankClass === TankClass.TRIPLE_SHOT;
    const isTripleTank = tankClass === TankClass.TRIPLE_TANK;
    const isDroneCommander = tankClass === TankClass.OVERSEER || tankClass === TankClass.OVERLORD || tankClass === TankClass.MANAGER;
    const isMachineGun = tankClass === TankClass.MACHINE_GUN;
    const isHybrid = tankClass === TankClass.HYBRID;
    const isTrapperBranch = isTrapperBranchClass(tankClass);
    
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
                <linearGradient id={`${previewId}-gatekeeperShell`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fecaca" />
                    <stop offset="22%" stopColor="#fca5a5" />
                    <stop offset="60%" stopColor="#b91c1c" />
                    <stop offset="100%" stopColor="#3f1118" />
                </linearGradient>
                <radialGradient id={`${previewId}-splitterShell`} cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#ffe4ea" />
                    <stop offset="22%" stopColor="#fecdd3" />
                    <stop offset="62%" stopColor="#e11d48" />
                    <stop offset="100%" stopColor="#4b1327" />
                </radialGradient>
                <radialGradient id={`${previewId}-reactorShell`} cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#ffedd5" />
                    <stop offset="22%" stopColor="#fdba74" />
                    <stop offset="62%" stopColor="#ea580c" />
                    <stop offset="100%" stopColor="#51210c" />
                </radialGradient>
                <radialGradient id={`${previewId}-executionerShell`} cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#ffe4e6" />
                    <stop offset="22%" stopColor="#fca5a5" />
                    <stop offset="62%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#3a0c12" />
                </radialGradient>
                <radialGradient id={`${previewId}-singularityShell`} cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#ede9fe" />
                    <stop offset="22%" stopColor="#c4b5fd" />
                    <stop offset="62%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#23103f" />
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
                        {bossRushKey === 'gatekeeper' ? (
                            <g>
                                <polygon
                                    points={[
                                        `${-effectiveRadius * 0.72},${-effectiveRadius * 0.88}`,
                                        `${effectiveRadius * 0.72},${-effectiveRadius * 0.88}`,
                                        `${effectiveRadius * 0.94},${-effectiveRadius * 0.24}`,
                                        `${effectiveRadius * 0.94},${effectiveRadius * 0.24}`,
                                        `${effectiveRadius * 0.72},${effectiveRadius * 0.88}`,
                                        `${-effectiveRadius * 0.72},${effectiveRadius * 0.88}`,
                                        `${-effectiveRadius * 0.94},${effectiveRadius * 0.24}`,
                                        `${-effectiveRadius * 0.94},${-effectiveRadius * 0.24}`,
                                    ].join(' ')}
                                    fill={`url(#${previewId}-gatekeeperShell)`}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <polygon
                                    points={[
                                        `${-effectiveRadius * 0.28},${-effectiveRadius * 0.52}`,
                                        `${effectiveRadius * 0.28},${-effectiveRadius * 0.52}`,
                                        `${effectiveRadius * 0.16},${-effectiveRadius * 0.08}`,
                                        `${-effectiveRadius * 0.16},${-effectiveRadius * 0.08}`,
                                    ].join(' ')}
                                    fill="rgba(28,12,18,0.85)"
                                />
                                <polygon
                                    points={[
                                        `${-effectiveRadius * 0.28},${effectiveRadius * 0.52}`,
                                        `${effectiveRadius * 0.28},${effectiveRadius * 0.52}`,
                                        `${effectiveRadius * 0.16},${effectiveRadius * 0.08}`,
                                        `${-effectiveRadius * 0.16},${effectiveRadius * 0.08}`,
                                    ].join(' ')}
                                    fill="rgba(28,12,18,0.85)"
                                />
                            </g>
                        ) : bossRushKey === 'splitter' ? (
                            <g>
                                <path
                                    d={`M ${effectiveRadius * 0.08} ${-effectiveRadius * 0.94} Q ${-effectiveRadius * 0.92} ${-effectiveRadius * 0.16} ${-effectiveRadius * 0.26} ${effectiveRadius * 0.94} L ${effectiveRadius * 0.18} ${effectiveRadius * 0.52} L ${effectiveRadius * 0.22} ${-effectiveRadius * 0.46} Z`}
                                    fill={`url(#${previewId}-splitterShell)`}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                    transform={`translate(${-effectiveRadius * 0.18} 0) rotate(-10)`}
                                />
                                <path
                                    d={`M ${-effectiveRadius * 0.08} ${-effectiveRadius * 0.94} Q ${effectiveRadius * 0.92} ${-effectiveRadius * 0.16} ${effectiveRadius * 0.26} ${effectiveRadius * 0.94} L ${-effectiveRadius * 0.18} ${effectiveRadius * 0.52} L ${-effectiveRadius * 0.22} ${-effectiveRadius * 0.46} Z`}
                                    fill={`url(#${previewId}-splitterShell)`}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                    transform={`translate(${effectiveRadius * 0.18} 0) rotate(10)`}
                                />
                                <rect
                                    x={-effectiveRadius * 0.18}
                                    y={-effectiveRadius * 0.44}
                                    width={effectiveRadius * 0.36}
                                    height={effectiveRadius * 0.88}
                                    rx={effectiveRadius * 0.14}
                                    fill="rgba(38,10,26,0.8)"
                                    stroke="rgba(254,205,211,0.65)"
                                    strokeWidth={strokeWidth * 0.8}
                                />
                            </g>
                        ) : bossRushKey === 'reactor' ? (
                            <g>
                                <polygon
                                    points={Array.from({ length: 8 }).map((_, i) => {
                                        const angle = -Math.PI / 2 + (i * Math.PI) / 4;
                                        const rr = effectiveRadius * (i % 2 === 0 ? 0.98 : 0.72);
                                        return `${Math.cos(angle) * rr},${Math.sin(angle) * rr}`;
                                    }).join(' ')}
                                    fill={`url(#${previewId}-reactorShell)`}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={effectiveRadius * 0.46}
                                    fill="rgba(54,24,9,0.8)"
                                    stroke="rgba(255,237,213,0.55)"
                                    strokeWidth={strokeWidth * 0.8}
                                />
                            </g>
                        ) : bossRushKey === 'executioner' ? (
                            <g>
                                <polygon
                                    points={[
                                        `${-effectiveRadius * 0.84},${-effectiveRadius * 0.38}`,
                                        `${effectiveRadius * 0.02},${-effectiveRadius * 0.94}`,
                                        `${effectiveRadius * 0.94},0`,
                                        `${effectiveRadius * 0.02},${effectiveRadius * 0.94}`,
                                        `${-effectiveRadius * 0.84},${effectiveRadius * 0.38}`,
                                    ].join(' ')}
                                    fill={`url(#${previewId}-executionerShell)`}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <polygon
                                    points={[
                                        `${-effectiveRadius * 0.32},${-effectiveRadius * 0.26}`,
                                        `${effectiveRadius * 0.56},0`,
                                        `${-effectiveRadius * 0.32},${effectiveRadius * 0.26}`,
                                    ].join(' ')}
                                    fill="rgba(45,10,16,0.78)"
                                />
                            </g>
                        ) : bossRushKey === 'grand_singularity' ? (
                            <g>
                                <polygon
                                    points={Array.from({ length: 10 }).map((_, i) => {
                                        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
                                        const rr = effectiveRadius * (i % 2 === 0 ? 0.94 : 0.68);
                                        return `${Math.cos(angle) * rr},${Math.sin(angle) * rr}`;
                                    }).join(' ')}
                                    fill={`url(#${previewId}-singularityShell)`}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={effectiveRadius * 0.54}
                                    fill="rgba(28,12,46,0.78)"
                                    stroke="rgba(237,233,254,0.5)"
                                    strokeWidth={strokeWidth * 0.8}
                                />
                            </g>
                        ) : tankClass === TankClass.COLOSSAL ? (
                            <g>
                                <polygon 
                                    points={[
                                        `${effectiveRadius * 1.02},0`,
                                        `${effectiveRadius * 0.5},${-effectiveRadius * 0.88}`,
                                        `${-effectiveRadius * 0.4},${-effectiveRadius * 0.98}`,
                                        `${-effectiveRadius * 1.04},${-effectiveRadius * 0.34}`,
                                        `${-effectiveRadius * 1.04},${effectiveRadius * 0.34}`,
                                        `${-effectiveRadius * 0.4},${effectiveRadius * 0.98}`,
                                        `${effectiveRadius * 0.5},${effectiveRadius * 0.88}`,
                                    ].join(' ')}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <polygon 
                                    points={[
                                        `${effectiveRadius * 0.54},0`,
                                        `${effectiveRadius * 0.14},${-effectiveRadius * 0.5}`,
                                        `${-effectiveRadius * 0.46},${-effectiveRadius * 0.56}`,
                                        `${-effectiveRadius * 0.7},0`,
                                        `${-effectiveRadius * 0.46},${effectiveRadius * 0.56}`,
                                        `${effectiveRadius * 0.14},${effectiveRadius * 0.5}`,
                                    ].join(' ')}
                                    fill="rgba(0,0,0,0.3)" 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                            </g>
                        ) : tankClass === TankClass.LEVIATHAN ? (
                            <g>
                                <polygon 
                                    points={Array.from({length: 12}).map((_, i) => {
                                        const angle = (i * 2 * Math.PI) / 12 - Math.PI / 2;
                                        const r = i % 3 === 0 ? effectiveRadius * 1.02 : i % 2 === 0 ? effectiveRadius * 0.66 : effectiveRadius * 0.34;
                                        return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                                    }).join(' ')}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <polygon
                                  points={[
                                      `0,${-effectiveRadius * 0.64}`,
                                      `${effectiveRadius * 0.56},${-effectiveRadius * 0.14}`,
                                      `${effectiveRadius * 0.42},${effectiveRadius * 0.56}`,
                                      `${-effectiveRadius * 0.42},${effectiveRadius * 0.56}`,
                                      `${-effectiveRadius * 0.56},${-effectiveRadius * 0.14}`,
                                  ].join(' ')}
                                  fill="rgba(0,0,0,0.24)"
                                  stroke={COLORS.border}
                                  strokeWidth={strokeWidth}
                                />
                            </g>
                        ) : tankClass === TankClass.WARLORD ? (
                            <g>
                                <polygon
                                    points={[
                                        `${effectiveRadius * 1.02},0`,
                                        `${effectiveRadius * 0.18},${-effectiveRadius * 0.58}`,
                                        `${-effectiveRadius * 0.24},${-effectiveRadius * 0.96}`,
                                        `${-effectiveRadius * 0.84},${-effectiveRadius * 0.54}`,
                                        `${-effectiveRadius * 0.84},${effectiveRadius * 0.54}`,
                                        `${-effectiveRadius * 0.24},${effectiveRadius * 0.96}`,
                                        `${effectiveRadius * 0.18},${effectiveRadius * 0.58}`,
                                    ].join(' ')}
                                    fill={tankColor} 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <rect
                                    x={-effectiveRadius * 0.3}
                                    y={-effectiveRadius * 0.34}
                                    width={effectiveRadius * 0.68}
                                    height={effectiveRadius * 0.68}
                                    rx={effectiveRadius * 0.1}
                                    fill="rgba(0,0,0,0.3)" 
                                    stroke={COLORS.border} 
                                    strokeWidth={strokeWidth} 
                                />
                                <polygon
                                    points={`${effectiveRadius * 0.38},0 ${-effectiveRadius * 0.02},${-effectiveRadius * 0.22} ${-effectiveRadius * 0.02},${effectiveRadius * 0.22}`}
                                    fill="rgba(255,255,255,0.12)"
                                />
                            </g>
                        ) : tankClass === TankClass.CELESTIAL ? (
                            <g>
                                <polygon
                                    points={Array.from({ length: 10 }).map((_, i) => {
                                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 10;
                                        const rr = i % 2 === 0 ? effectiveRadius * 0.98 : effectiveRadius * 0.58;
                                        return `${Math.cos(a) * rr},${Math.sin(a) * rr}`;
                                    }).join(' ')}
                                    fill={tankColor}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <polygon
                                    points={Array.from({ length: 5 }).map((_, i) => {
                                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                                        return `${Math.cos(a) * effectiveRadius * 1.14},${Math.sin(a) * effectiveRadius * 1.14}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke="rgba(192,132,252,0.75)"
                                    strokeWidth={strokeWidth * 1.2}
                                />
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={effectiveRadius * 0.42}
                                    fill="rgba(0,0,0,0.25)"
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth * 0.85}
                                />
                            </g>
                        ) : tankClass === TankClass.OBLITERATOR ? (
                            <g>
                                <polygon
                                    points={Array.from({ length: 16 }).map((_, i) => {
                                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 16;
                                        const rr = i % 2 === 0 ? effectiveRadius * 1.02 : effectiveRadius * 0.72;
                                        return `${Math.cos(a) * rr},${Math.sin(a) * rr}`;
                                    }).join(' ')}
                                    fill={tankColor}
                                    stroke={COLORS.border}
                                    strokeWidth={strokeWidth}
                                />
                                <polygon
                                  points={Array.from({ length: 8 }).map((_, i) => {
                                      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 8;
                                      const rr = i % 2 === 0 ? effectiveRadius * 0.68 : effectiveRadius * 0.52;
                                      return `${Math.cos(a) * rr},${Math.sin(a) * rr}`;
                                  }).join(' ')}
                                  fill="rgba(30,10,60,0.28)"
                                  stroke="rgba(233,213,255,0.42)"
                                  strokeWidth={strokeWidth * 0.85}
                                />
                                <circle
                                    cx="0"
                                    cy="0"
                                    r={effectiveRadius * 0.36}
                                    fill="rgba(255,255,255,0.08)"
                                    stroke="rgba(233,213,255,0.42)"
                                    strokeWidth={strokeWidth * 0.7}
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

                            if (isTrapperBranch) {
                                const isMachineTrapper = tankClass === TankClass.MACHINE_GUN_TRAPPER;
                                const isHeavyTrapper = tankClass === TankClass.DUAL_TRAPPER || tankClass === TankClass.OCTO_TRAPPER || tankClass === TankClass.TRIPLE_TRAPPER;
                                const shellLen = bLen * (isMachineTrapper ? 1.16 : isHeavyTrapper ? 1.22 : 1.12);
                                const shellWid = bWid * (isMachineTrapper ? 1.08 : isHeavyTrapper ? 1.22 : 1.14);
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <defs>
                                            <linearGradient id={`${previewId}-trapper-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor={isMachineTrapper ? '#1f2937' : '#202b38'} />
                                                <stop offset="34%" stopColor="#e2e8f0" />
                                                <stop offset="66%" stopColor="#8e9aab" />
                                                <stop offset="100%" stopColor="#2b3645" />
                                            </linearGradient>
                                        </defs>
                                        <path
                                            d={`M ${-shellLen * 0.04} ${-shellWid * 0.46}
                                                L ${shellLen * 0.54} ${-shellWid * 0.46}
                                                L ${shellLen * 0.68} ${-shellWid * 0.6}
                                                L ${shellLen * 0.88} ${-shellWid * 0.6}
                                                L ${shellLen} ${-shellWid * 0.24}
                                                L ${shellLen} ${shellWid * 0.24}
                                                L ${shellLen * 0.88} ${shellWid * 0.6}
                                                L ${shellLen * 0.68} ${shellWid * 0.6}
                                                L ${shellLen * 0.54} ${shellWid * 0.46}
                                                L ${-shellLen * 0.04} ${shellWid * 0.46} Z`}
                                            fill={`url(#${previewId}-trapper-${i})`}
                                            stroke={COLORS.border}
                                            strokeWidth={strokeWidth}
                                        />
                                        <rect x={shellLen * 0.56} y={-shellWid * 0.46} width={shellLen * 0.08} height={shellWid * 0.92} fill="rgba(15,23,42,0.82)" />
                                        <rect x={shellLen * 0.78} y={-shellWid * 0.54} width={shellLen * 0.07} height={shellWid * 1.08} fill="rgba(15,23,42,0.82)" />
                                        {isMachineTrapper ? (
                                            <>
                                                {[0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88].map((slot) => (
                                                    <rect key={slot} x={shellLen * slot} y={-shellWid * 0.32} width={shellLen * 0.026} height={shellWid * 0.64} fill="rgba(15,23,42,0.78)" />
                                                ))}
                                                <rect x={shellLen * 0.08} y={-shellWid * 0.08} width={shellLen * 0.44} height={shellWid * 0.16} fill="rgba(255,255,255,0.1)" />
                                            </>
                                        ) : isHeavyTrapper ? (
                                            <>
                                                <rect x={shellLen * 0.12} y={-shellWid * 0.28} width={shellLen * 0.34} height={shellWid * 0.1} fill="rgba(255,255,255,0.14)" />
                                                <rect x={shellLen * 0.12} y={shellWid * 0.18} width={shellLen * 0.34} height={shellWid * 0.1} fill="rgba(255,255,255,0.14)" />
                                                <rect x={shellLen * 0.18} y={-shellWid * 0.56} width={shellLen * 0.18} height={shellWid * 0.2} fill="none" stroke="rgba(15,23,42,0.82)" strokeWidth={strokeWidth * 0.7} />
                                                <rect x={shellLen * 0.18} y={shellWid * 0.36} width={shellLen * 0.18} height={shellWid * 0.2} fill="none" stroke="rgba(15,23,42,0.82)" strokeWidth={strokeWidth * 0.7} />
                                            </>
                                        ) : null}
                                        <path
                                            d={`M ${shellLen * 0.06} ${-shellWid * 0.18}
                                                L ${shellLen * 0.46} ${-shellWid * 0.18}
                                                L ${shellLen * 0.52} 0
                                                L ${shellLen * 0.46} ${shellWid * 0.18}
                                                L ${shellLen * 0.06} ${shellWid * 0.18} Z`}
                                            fill="rgba(96,165,250,0.5)"
                                        />
                                        <line x1={shellLen * 0.94} y1={-shellWid * 0.15} x2={shellLen * 0.94} y2={shellWid * 0.15} stroke="rgba(15,23,42,0.88)" strokeWidth={strokeWidth * 0.8} />
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

                            if (isTripleShot) {
                                const isCenterBarrel = Math.abs(angleOff) < 0.01;
                                const shellLen = bLen * (isCenterBarrel ? 0.98 : 0.92);
                                const shellWid = bWid * (isCenterBarrel ? 1.02 : 0.94);
                                return (
                                    <g key={i} transform={`rotate(${rotation}) translate(${xOff * effectiveRadius}, ${yOff * effectiveRadius})`}>
                                        <rect
                                            x={0}
                                            y={-shellWid * 0.5}
                                            width={shellLen}
                                            height={shellWid}
                                            rx={shellWid * 0.08}
                                            fill="#7f7f84"
                                            stroke={COLORS.border}
                                            strokeWidth={strokeWidth}
                                        />
                                        <rect
                                            x={shellLen * 0.12}
                                            y={-shellWid * 0.34}
                                            width={shellLen * 0.72}
                                            height={shellWid * 0.68}
                                            fill="rgba(255,255,255,0.32)"
                                        />
                                        <line
                                            x1={shellLen}
                                            y1={-shellWid * 0.5}
                                            x2={shellLen}
                                            y2={shellWid * 0.5}
                                            stroke={isCenterBarrel ? '#52525b' : '#5b5b63'}
                                            strokeWidth={strokeWidth}
                                        />
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

export const TankPreview = React.memo(TankPreviewComponent);


