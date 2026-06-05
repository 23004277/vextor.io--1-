
import React, { useEffect, useRef } from 'react';
import { EntityType, Team, Vector2, MinimapMarker, Camera, GameMode } from '../types';
import { COLORS, BASE_ZONE_WIDTH } from '../constants';

interface TacticalMinimapProps {
  markers: MinimapMarker[];
  mapSize: { width: number; height: number };
  camera: Camera;
  inVoid: boolean;
  gameMode?: GameMode;
}

export const TacticalMinimap: React.FC<TacticalMinimapProps> = ({ markers, mapSize, camera, inVoid, gameMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanAngleRef = useRef(0);

  const getTeamColor = (team: Team): string => {
    if (team === Team.BLUE) return COLORS.player;
    if (team === Team.RED) return COLORS.enemy;
    if (team === Team.GREEN) return COLORS.allyGreen;
    if (team === Team.PURPLE) return COLORS.allyPurple;
    return COLORS.dominionNeutral;
  };
  
  // Use refs to store the latest props for the render loop
  const propsRef = useRef({ markers, mapSize, camera, inVoid, gameMode });
  useEffect(() => {
    propsRef.current = { markers, mapSize, camera, inVoid, gameMode };
  }, [markers, mapSize, camera, inVoid, gameMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const { markers, mapSize, camera, inVoid, gameMode } = propsRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const mapW = Math.max(1, mapSize.width);
      const mapH = Math.max(1, mapSize.height);
      const scale = Math.min(w / mapW, h / mapH);
      const drawW = mapW * scale;
      const drawH = mapH * scale;
      const offsetX = (w - drawW) * 0.5;
      const offsetY = (h - drawH) * 0.5;
      const toMiniX = (x: number) => offsetX + x * scale;
      const toMiniY = (y: number) => offsetY + y * scale;

      ctx.clearRect(0, 0, w, h);

      // 1. Background Grid
      ctx.fillStyle = inVoid ? '#050505' : '#111';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(offsetX, offsetY, drawW, drawH);
      ctx.clip();
      
      // 1.5. Safe Zones (Teams Mode)
      if (gameMode === GameMode.TEAMS && !inVoid) {
        const zoneW = BASE_ZONE_WIDTH * scale;
        
        // Blue Safe Zone
        ctx.fillStyle = 'rgba(0, 150, 255, 0.2)';
        ctx.fillRect(offsetX, offsetY, zoneW, drawH);
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(offsetX + zoneW, offsetY);
        ctx.lineTo(offsetX + zoneW, offsetY + drawH);
        ctx.stroke();

        // Red Safe Zone
        ctx.fillStyle = 'rgba(255, 50, 50, 0.2)';
        ctx.fillRect(offsetX + drawW - zoneW, offsetY, zoneW, drawH);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(offsetX + drawW - zoneW, offsetY);
        ctx.lineTo(offsetX + drawW - zoneW, offsetY + drawH);
        ctx.stroke();
      }

      if (gameMode === GameMode.DOMINION && !inVoid) {
        const zoneW = BASE_ZONE_WIDTH * scale;
        const zoneH = BASE_ZONE_WIDTH * scale;
        const drawCornerZone = (x: number, y: number, color: string) => {
          ctx.fillStyle = `${color}33`;
          ctx.fillRect(x, y, zoneW, zoneH);
          ctx.strokeStyle = `${color}aa`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, zoneW, zoneH);
        };
        drawCornerZone(offsetX, offsetY, COLORS.player);
        drawCornerZone(offsetX + drawW - zoneW, offsetY, COLORS.enemy);
        drawCornerZone(offsetX, offsetY + drawH - zoneH, COLORS.allyGreen);
        drawCornerZone(offsetX + drawW - zoneW, offsetY + drawH - zoneH, COLORS.allyPurple);
      }

      ctx.strokeStyle = inVoid ? '#1a0033' : '#222';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath(); ctx.moveTo(offsetX + i * (drawW / 10), offsetY); ctx.lineTo(offsetX + i * (drawW / 10), offsetY + drawH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(offsetX, offsetY + i * (drawH / 10)); ctx.lineTo(offsetX + drawW, offsetY + i * (drawH / 10)); ctx.stroke();
      }

      // 2. Radar Sweep Effect
      scanAngleRef.current += 0.03;
      const sweepGrad = ctx.createConicGradient(scanAngleRef.current, offsetX + drawW / 2, offsetY + drawH / 2);
      sweepGrad.addColorStop(0, 'rgba(0, 178, 225, 0.15)');
      sweepGrad.addColorStop(0.1, 'rgba(0, 178, 225, 0)');
      sweepGrad.addColorStop(1, 'rgba(0, 178, 225, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(0, 0, w, h);

      // 3. Viewport Box
      const viewportW = (window.innerWidth / camera.zoom) * scale;
      const viewportH = (window.innerHeight / camera.zoom) * scale;
      const camX = toMiniX(camera.x) - viewportW / 2;
      const camY = toMiniY(camera.y) - viewportH / 2;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(camX, camY, viewportW, viewportH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(camX, camY, viewportW, viewportH);

      // 4. Render Markers
      markers.forEach(m => {
        const mx = toMiniX(m.pos.x);
        const my = toMiniY(m.pos.y);

        if (m.markerRole === 'DOMINION_ZONE' && m.zoneRadius) {
          ctx.save();
          ctx.strokeStyle = `${getTeamColor(m.team)}aa`;
          ctx.fillStyle = `${getTeamColor(m.team)}18`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(mx, my, m.zoneRadius * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          return;
        }

        ctx.save();
        ctx.translate(mx, my);

        if (m.isPlayer) {
          // Large Player Arrow
          ctx.rotate((m.rotation || 0) + Math.PI / 2);
          ctx.fillStyle = getTeamColor(m.team);
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(4, 4);
          ctx.lineTo(-4, 4);
          ctx.closePath();
          ctx.fill();
          // Glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.player;
          ctx.stroke();
        } else if (m.type === EntityType.DOMINION_TANK) {
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = getTeamColor(m.team);
          ctx.fillRect(-4.5, -4.5, 9, 9);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(-4.5, -4.5, 9, 9);
        } else if (m.type === EntityType.ELITE_TANK) {
          // Hazard Marker (Red pulsing pip)
          const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
          ctx.fillStyle = `rgba(255, 50, 50, ${0.5 + pulse * 0.5})`;
          ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        } else if (m.type === EntityType.BOSS) {
          // Boss Diamond
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#ffcc33';
          ctx.fillRect(-4, -4, 8, 8);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        } else if (m.type === EntityType.VOID_PORTAL) {
          // Portal Vortex
          const t = Date.now() / 500;
          ctx.rotate(t);
          ctx.strokeStyle = COLORS.voidPortal;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 1.5); ctx.stroke();
          ctx.fillStyle = COLORS.voidPortal;
          ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        } else if (m.type === EntityType.SHAPE) {
          // Rare Shape Marker (glowing golden star effect)
          const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
          ctx.fillStyle = '#ffcc00';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ff5e00';
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
              ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * (3.5 + pulse * 1.5), Math.sin((18 + i * 72) * Math.PI / 180) * (3.5 + pulse * 1.5));
              ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (1.5 + pulse * 0.7), Math.sin((54 + i * 72) * Math.PI / 180) * (1.5 + pulse * 0.7));
          }
          ctx.closePath();
          ctx.fill();
          ctx.lineWidth = 0.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        } else {
          // Standard Team Pips
          ctx.fillStyle = getTeamColor(m.team);
          ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Only run once on mount


  return (
    <canvas 
      ref={canvasRef} 
      width={128} 
      height={128} 
      className={`w-full h-full rounded-md border border-white/10 shadow-inner`}
    />
  );
};
