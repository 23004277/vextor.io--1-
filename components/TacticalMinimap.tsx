
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
      const { markers, mapSize, camera, inVoid } = propsRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const scaleX = w / mapSize.width;
      const scaleY = h / mapSize.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Background Grid
      ctx.fillStyle = inVoid ? '#050505' : '#111';
      ctx.fillRect(0, 0, w, h);
      
      // 1.5. Safe Zones (Teams Mode)
      if (gameMode === GameMode.TEAMS && !inVoid) {
        const zoneW = BASE_ZONE_WIDTH * scaleX;
        
        // Blue Safe Zone
        ctx.fillStyle = 'rgba(0, 150, 255, 0.2)';
        ctx.fillRect(0, 0, zoneW, h);
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(zoneW, 0);
        ctx.lineTo(zoneW, h);
        ctx.stroke();

        // Red Safe Zone
        ctx.fillStyle = 'rgba(255, 50, 50, 0.2)';
        ctx.fillRect(w - zoneW, 0, zoneW, h);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w - zoneW, 0);
        ctx.lineTo(w - zoneW, h);
        ctx.stroke();
      }

      ctx.strokeStyle = inVoid ? '#1a0033' : '#222';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath(); ctx.moveTo(i * (w / 10), 0); ctx.lineTo(i * (w / 10), h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * (h / 10)); ctx.lineTo(w, i * (h / 10)); ctx.stroke();
      }

      // 2. Radar Sweep Effect
      scanAngleRef.current += 0.03;
      const sweepGrad = ctx.createConicGradient(scanAngleRef.current, w / 2, h / 2);
      sweepGrad.addColorStop(0, 'rgba(0, 178, 225, 0.15)');
      sweepGrad.addColorStop(0.1, 'rgba(0, 178, 225, 0)');
      sweepGrad.addColorStop(1, 'rgba(0, 178, 225, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(0, 0, w, h);

      // 3. Viewport Box
      const viewportW = (window.innerWidth / camera.zoom) * scaleX;
      const viewportH = (window.innerHeight / camera.zoom) * scaleY;
      const camX = (camera.x * scaleX) - viewportW / 2;
      const camY = (camera.y * scaleY) - viewportH / 2;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(camX, camY, viewportW, viewportH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(camX, camY, viewportW, viewportH);

      // 4. Render Markers
      markers.forEach(m => {
        const mx = m.pos.x * scaleX;
        const my = m.pos.y * scaleY;

        ctx.save();
        ctx.translate(mx, my);

        if (m.isPlayer) {
          // Large Player Arrow
          ctx.rotate((m.rotation || 0) + Math.PI / 2);
          ctx.fillStyle = COLORS.player;
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
          ctx.fillStyle = m.team === Team.BLUE ? COLORS.player : COLORS.enemy;
          ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
      });

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
