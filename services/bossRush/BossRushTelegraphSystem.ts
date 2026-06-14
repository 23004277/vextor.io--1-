import * as Vector from '../MathUtils';
import { BossRushBossEntity, BossRushEngineBridge, BossRushTelegraph } from './BossRushTypes';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getTelegraphPalette = (telegraph: BossRushTelegraph) => {
  switch (telegraph.ownerBossKey) {
    case 'gatekeeper':
      return {
        fill: '255, 70, 70',
        stroke: '255, 184, 120',
        shadow: 'rgba(255, 96, 96, 0.72)',
        particle: '#ff7655',
        dash: [18, 10],
      };
    case 'splitter':
      return {
        fill: '255, 84, 156',
        stroke: '255, 174, 214',
        shadow: 'rgba(255, 88, 160, 0.72)',
        particle: '#ff63b2',
        dash: [10, 8],
      };
    case 'reactor':
      return {
        fill: '255, 132, 38',
        stroke: '255, 214, 110',
        shadow: 'rgba(255, 154, 56, 0.72)',
        particle: '#ff9f3f',
        dash: [14, 10],
      };
    case 'executioner':
      return {
        fill: '196, 30, 58',
        stroke: '255, 130, 150',
        shadow: 'rgba(222, 40, 68, 0.74)',
        particle: '#d7264f',
        dash: [26, 10],
      };
    case 'grand_singularity':
      return {
        fill: '112, 74, 255',
        stroke: '184, 154, 255',
        shadow: 'rgba(135, 92, 255, 0.76)',
        particle: '#9d7bff',
        dash: [20, 14],
      };
    default:
      return {
        fill: '255, 48, 48',
        stroke: '255, 94, 94',
        shadow: 'rgba(255, 70, 70, 0.65)',
        particle: '#ff4d4d',
        dash: [18, 12],
      };
  }
};

const normalizeAngle = (angle: number) => {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
};

const toLocal = (telegraph: BossRushTelegraph, point: { x: number; y: number }) => {
  const angle = telegraph.angle || 0;
  const dx = point.x - telegraph.x;
  const dy = point.y - telegraph.y;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
};

const intersectsTelegraph = (telegraph: BossRushTelegraph, target: any): boolean => {
  const pad = target.radius || 0;
  if (telegraph.type === 'red_circle_impact') {
    return Vector.dist({ x: telegraph.x, y: telegraph.y }, target.pos) <= (telegraph.radius || 0) + pad;
  }

  if (telegraph.type === 'red_cone_sweep') {
    const delta = Vector.sub(target.pos, { x: telegraph.x, y: telegraph.y });
    const distance = Vector.mag(delta);
    if (distance > (telegraph.length || 0) + pad) return false;
    const angle = Math.atan2(delta.y, delta.x);
    return Math.abs(normalizeAngle(angle - (telegraph.angle || 0))) <= ((telegraph.spread || Math.PI / 4) * 0.5);
  }

  if (telegraph.type === 'cross_laser_warning') {
    const primary = { ...telegraph, type: 'straight_red_lane' as const };
    const secondary = { ...telegraph, type: 'straight_red_lane' as const, angle: (telegraph.angle || 0) + Math.PI / 2 };
    return intersectsTelegraph(primary, target) || intersectsTelegraph(secondary, target);
  }

  if (telegraph.type === 'rotating_danger_arc') {
    const delta = Vector.sub(target.pos, { x: telegraph.x, y: telegraph.y });
    const distance = Vector.mag(delta);
    if (distance > (telegraph.radius || 0) + pad) return false;
    if (distance < (telegraph.innerRadius || 0) - pad) return false;
    const angle = Math.atan2(delta.y, delta.x);
    return Math.abs(normalizeAngle(angle - (telegraph.angle || 0))) <= ((telegraph.spread || Math.PI / 3) * 0.5);
  }

  if (telegraph.type === 'red_square_marker') {
    const local = toLocal(telegraph, target.pos);
    const half = (telegraph.size || 0) * 0.5 + pad;
    return Math.abs(local.x) <= half && Math.abs(local.y) <= half;
  }

  const local = toLocal(telegraph, target.pos);
  const halfLength = (telegraph.length || 0) * 0.5 + pad;
  const halfWidth = (telegraph.width || 0) * 0.5 + pad;
  return Math.abs(local.x) <= halfLength && Math.abs(local.y) <= halfWidth;
};

export const updateBossRushTelegraphs = (
  engine: BossRushEngineBridge,
  telegraphs: BossRushTelegraph[],
  dt: number
) => {
  for (const telegraph of telegraphs) {
    telegraph.elapsedSeconds += dt;
    if (!telegraph.executed && telegraph.elapsedSeconds >= telegraph.delaySeconds) {
      telegraph.executed = true;
      const palette = getTelegraphPalette(telegraph);
      const boss = engine.entities.find((entity) => entity.id === telegraph.ownerBossId) as BossRushBossEntity | undefined;
      const victims = engine.entities.filter((entity) =>
        !entity.isDead &&
        (entity.type === 'PLAYER' || entity.type === 'ENEMY' || entity.type === 'ELITE_TANK')
      );
      for (const victim of victims) {
        if (!intersectsTelegraph(telegraph, victim)) continue;
        victim.takeDamage(telegraph.damage, boss?.id ?? telegraph.ownerBossId, false);
      }
      engine.spawnParticles(
        { x: telegraph.x, y: telegraph.y },
        palette.particle,
        telegraph.ownerBossKey === 'reactor' ? 28 : telegraph.ownerBossKey === 'grand_singularity' ? 24 : 18,
        telegraph.ownerBossKey === 'executioner' ? 6 : 5
      );
      if (boss) {
        engine.sound.playExplosion(true, engine.getAudioSpatialOptions(boss.pos, true));
      }
    }
  }

  for (let i = telegraphs.length - 1; i >= 0; i -= 1) {
    const telegraph = telegraphs[i];
    if (telegraph.elapsedSeconds >= telegraph.delaySeconds + telegraph.activeSeconds) {
      telegraphs.splice(i, 1);
    }
  }
};

export const renderBossRushTelegraphs = (ctx: CanvasRenderingContext2D, telegraphs: BossRushTelegraph[]) => {
  const now = Date.now() * 0.001;
  for (const telegraph of telegraphs) {
    const palette = getTelegraphPalette(telegraph);
    const warningProgress = clamp(telegraph.elapsedSeconds / Math.max(0.001, telegraph.delaySeconds), 0, 1);
    const pulse = 0.72 + Math.sin(now * telegraph.pulseSpeed + telegraph.x * 0.001) * 0.16;
    const fillAlpha = telegraph.executed ? 0.28 : (0.12 + warningProgress * 0.12) * pulse;
    const strokeAlpha = telegraph.executed ? 0.92 : 0.56 + warningProgress * 0.28;

    ctx.save();
    ctx.translate(telegraph.x, telegraph.y);
    ctx.rotate(telegraph.angle || 0);
    ctx.fillStyle = `rgba(${palette.fill}, ${fillAlpha})`;
    ctx.strokeStyle = `rgba(${palette.stroke}, ${strokeAlpha})`;
    ctx.shadowBlur = telegraph.executed ? 28 : 18;
    ctx.shadowColor = palette.shadow;
    ctx.lineWidth = telegraph.executed ? 6 : 4;
    ctx.setLineDash(telegraph.executed ? [] : palette.dash);
    ctx.lineDashOffset = -now * 50;

    if (telegraph.type === 'red_circle_impact') {
      const radius = telegraph.radius || 0;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (telegraph.type === 'red_square_marker') {
      const size = telegraph.size || 0;
      ctx.beginPath();
      ctx.rect(-size * 0.5, -size * 0.5, size, size);
      ctx.fill();
      ctx.stroke();
    } else if (telegraph.type === 'red_cone_sweep') {
      const length = telegraph.length || 0;
      const spread = telegraph.spread || Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, length, -spread * 0.5, spread * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (telegraph.type === 'cross_laser_warning') {
      const length = telegraph.length || 0;
      const width = telegraph.width || 0;
      ctx.fillRect(-length * 0.5, -width * 0.5, length, width);
      ctx.strokeRect(-length * 0.5, -width * 0.5, length, width);
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-length * 0.5, -width * 0.5, length, width);
      ctx.strokeRect(-length * 0.5, -width * 0.5, length, width);
    } else if (telegraph.type === 'rotating_danger_arc') {
      const radius = telegraph.radius || 0;
      const innerRadius = telegraph.innerRadius || 0;
      const spread = telegraph.spread || Math.PI / 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -spread * 0.5, spread * 0.5);
      ctx.arc(0, 0, innerRadius, spread * 0.5, -spread * 0.5, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      const length = telegraph.length || 0;
      const width = telegraph.width || 0;
      ctx.fillRect(-length * 0.5, -width * 0.5, length, width);
      ctx.strokeRect(-length * 0.5, -width * 0.5, length, width);
    }

    if (!telegraph.executed) {
      ctx.save();
      ctx.globalAlpha = 0.22 + warningProgress * 0.16;
      ctx.strokeStyle = `rgba(${palette.stroke}, 0.9)`;
      ctx.lineWidth = 2;
      if (telegraph.type === 'red_circle_impact') {
        const radius = (telegraph.radius || 0) * (0.4 + warningProgress * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (telegraph.type === 'red_cone_sweep') {
        const length = (telegraph.length || 0) * (0.45 + warningProgress * 0.55);
        const spread = telegraph.spread || Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, length, -spread * 0.5, spread * 0.5);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }
};
