import * as Vector from '../MathUtils';
import { BossRushBossEntity, BossRushEngineBridge, BossRushTelegraph } from './BossRushTypes';
import { EntityType, Team } from '../../types';

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

const getTelegraphImpactShake = (telegraph: BossRushTelegraph) => {
  const base =
    telegraph.type === 'red_circle_impact' ? 2.8 :
    telegraph.type === 'red_square_marker' ? 2.2 :
    telegraph.type === 'red_cone_sweep' ? 3.8 :
    telegraph.type === 'cross_laser_warning' ? 4.1 :
    telegraph.type === 'rotating_danger_arc' ? 4.6 :
    telegraph.type === 'wide_red_lane' ? 4.4 :
    3.3;

  const bossMul =
    telegraph.ownerBossKey === 'grand_singularity' ? 1.28 :
    telegraph.ownerBossKey === 'executioner' ? 1.16 :
    telegraph.ownerBossKey === 'reactor' ? 1.12 :
    telegraph.ownerBossKey === 'gatekeeper' ? 1.08 :
    1;

  return base * bossMul;
};

const spawnChargeCueVfx = (
  engine: BossRushEngineBridge,
  telegraph: BossRushTelegraph,
  palette: ReturnType<typeof getTelegraphPalette>,
  intensity: number,
) => {
  const count = Math.max(4, Math.round(5 + intensity * 5));
  if (telegraph.type === 'red_circle_impact') {
    const radius = telegraph.radius || 0;
    const pulseCount = Math.max(4, Math.round(4 + intensity * 1.5));
    for (let i = 0; i < pulseCount; i += 1) {
      const theta = (i / pulseCount) * Math.PI * 2 + Date.now() * 0.0015;
      engine.spawnParticles(
        {
          x: telegraph.x + Math.cos(theta) * radius * (0.52 + intensity * 0.08),
          y: telegraph.y + Math.sin(theta) * radius * (0.52 + intensity * 0.08),
        },
        palette.particle,
        Math.max(2, Math.round(count * 0.45)),
        3 + intensity,
      );
    }
    return;
  }

  if (telegraph.type === 'cross_laser_warning' || telegraph.type === 'rotating_danger_arc') {
    engine.spawnParticles({ x: telegraph.x, y: telegraph.y }, palette.particle, count, 3 + intensity);
    return;
  }

  if (telegraph.length && telegraph.angle != null) {
    const halfLength = telegraph.length * 0.5;
    const edgeA = {
      x: telegraph.x - Math.cos(telegraph.angle) * halfLength,
      y: telegraph.y - Math.sin(telegraph.angle) * halfLength,
    };
    const edgeB = {
      x: telegraph.x + Math.cos(telegraph.angle) * halfLength,
      y: telegraph.y + Math.sin(telegraph.angle) * halfLength,
    };
    engine.spawnParticles(edgeA, palette.particle, Math.max(2, Math.round(count * 0.5)), 3 + intensity);
    engine.spawnParticles(edgeB, palette.particle, Math.max(2, Math.round(count * 0.5)), 3 + intensity);
    const segmentCount = Math.max(2, Math.round(2 + intensity));
    for (let i = 0; i < segmentCount; i += 1) {
      const t = segmentCount === 1 ? 0.5 : i / (segmentCount - 1);
      engine.spawnParticles(
        {
          x: telegraph.x + Math.cos(telegraph.angle) * ((t - 0.5) * telegraph.length * 0.74),
          y: telegraph.y + Math.sin(telegraph.angle) * ((t - 0.5) * telegraph.length * 0.74),
        },
        palette.particle,
        Math.max(1, Math.round(count * 0.24)),
        2 + intensity * 0.6,
      );
    }
    return;
  }

  engine.spawnParticles({ x: telegraph.x, y: telegraph.y }, palette.particle, count, 3 + intensity);
};

const spawnTelegraphImpactVfx = (
  engine: BossRushEngineBridge,
  telegraph: BossRushTelegraph,
  palette: ReturnType<typeof getTelegraphPalette>,
  boss?: BossRushBossEntity
) => {
  const origin = { x: telegraph.x, y: telegraph.y };
  const accentPos = (x: number, y: number, color: string, count: number, size: number) => {
    engine.spawnParticles({ x, y }, color, count, size);
  };

  if (telegraph.ownerBossKey === 'gatekeeper') {
    accentPos(origin.x, origin.y, '#ffd3aa', 22, 5);
    if (telegraph.type === 'red_circle_impact') {
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2;
        accentPos(origin.x + Math.cos(angle) * 90, origin.y + Math.sin(angle) * 90, '#ff8a5a', 8, 4);
      }
    }
  } else if (telegraph.ownerBossKey === 'splitter') {
    accentPos(origin.x, origin.y, '#ff63b2', 18, 4);
    const length = telegraph.length ?? telegraph.size ?? 180;
    for (let dir = -1; dir <= 1; dir += 2) {
      accentPos(origin.x + dir * length * 0.25, origin.y, '#ffd4f0', 8, 4);
    }
  } else if (telegraph.ownerBossKey === 'reactor') {
    accentPos(origin.x, origin.y, '#ffb24a', 30, 6);
    if (telegraph.radius) {
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        accentPos(origin.x + Math.cos(angle) * telegraph.radius * 0.6, origin.y + Math.sin(angle) * telegraph.radius * 0.6, '#ffe17a', 5, 4);
      }
    }
  } else if (telegraph.ownerBossKey === 'executioner') {
    accentPos(origin.x, origin.y, '#ff7c98', 20, 5);
    if (telegraph.length && telegraph.angle != null) {
      const head = {
        x: origin.x + Math.cos(telegraph.angle) * telegraph.length * 0.45,
        y: origin.y + Math.sin(telegraph.angle) * telegraph.length * 0.45,
      };
      accentPos(head.x, head.y, '#ffd0d8', 12, 5);
    }
  } else if (telegraph.ownerBossKey === 'grand_singularity') {
    accentPos(origin.x, origin.y, '#b69cff', 24, 5);
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + Date.now() * 0.001;
      accentPos(origin.x + Math.cos(angle) * 120, origin.y + Math.sin(angle) * 120, '#e3d8ff', 7, 4);
    }
  } else {
    accentPos(origin.x, origin.y, palette.particle, 16, 5);
  }

  if (boss) {
    accentPos(boss.pos.x, boss.pos.y, palette.particle, 6, 4);
  }
};

const triggerChargeCue = (
  engine: BossRushEngineBridge,
  telegraph: BossRushTelegraph,
  palette: ReturnType<typeof getTelegraphPalette>,
  boss?: BossRushBossEntity,
) => {
  const elapsedRatio = telegraph.elapsedSeconds / Math.max(0.001, telegraph.delaySeconds);
  const stageThresholds = [0.42, 0.78, 0.94];
  const telegraphMeta = telegraph as BossRushTelegraph & { __bossRushCueStage?: number };
  const nextStage = telegraphMeta.__bossRushCueStage ?? 0;
  if (nextStage >= stageThresholds.length || elapsedRatio < stageThresholds[nextStage]) return;

  telegraphMeta.__bossRushCueStage = nextStage + 1;
  const intensity = nextStage + 1;
  spawnChargeCueVfx(engine, telegraph, palette, intensity);
  engine.shakeAmount += (0.2 + intensity * 0.14) * engine.settings.shakeIntensity;
  const spatial = engine.getAudioSpatialOptions(
    boss?.pos ?? { x: telegraph.x, y: telegraph.y },
    nextStage >= 1
  );
  if (telegraph.attackId) {
    engine.sound.playBossRushAbilityChargeTick(
      telegraph.ownerBossKey ?? 'gatekeeper',
      telegraph.attackId,
      telegraph.type,
      nextStage,
      spatial,
      telegraph.audioScale ?? 'standard',
    );
  } else {
    engine.sound.playBossRushTelegraphCharge(
      telegraph.ownerBossKey ?? 'gatekeeper',
      telegraph.type,
      nextStage,
      spatial,
    );
  }
};

const triggerSpawnCue = (
  engine: BossRushEngineBridge,
  telegraph: BossRushTelegraph,
  boss?: BossRushBossEntity,
) => {
  if (telegraph.visualRole === 'hover_marker' || telegraph.visualRole === 'safe_hint') return;
  const telegraphMeta = telegraph as BossRushTelegraph & { __bossRushSpawnCuePlayed?: boolean };
  if (telegraphMeta.__bossRushSpawnCuePlayed) return;
  telegraphMeta.__bossRushSpawnCuePlayed = true;
  const spatial = engine.getAudioSpatialOptions(
    boss?.pos ?? { x: telegraph.x, y: telegraph.y },
    telegraph.type === 'wide_red_lane' || telegraph.type === 'cross_laser_warning'
  );
  if (telegraph.attackId) {
    engine.sound.playBossRushAbilityWarning(
      telegraph.ownerBossKey ?? 'gatekeeper',
      telegraph.attackId,
      telegraph.type,
      spatial,
      telegraph.audioScale ?? 'standard',
    );
  } else {
    engine.sound.playBossRushTelegraphSpawn(
      telegraph.ownerBossKey ?? 'gatekeeper',
      telegraph.type,
      spatial,
    );
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
  if (telegraph.visualRole === 'hover_marker' || telegraph.visualRole === 'safe_hint' || telegraph.type === 'blood_crescent_pressure') {
    return false;
  }
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

const canSandboxTelegraphHitTarget = (_engine: BossRushEngineBridge, telegraph: BossRushTelegraph, victim: any): boolean => {
  if (telegraph.sourceMode !== 'sandbox') return true;
  if (victim.isDead) return false;

  const ownerEntityId = telegraph.ownerEntityId ?? telegraph.ownerBossId;
  if (victim.id === ownerEntityId && telegraph.selfDamage === false) return false;

  if (
    (victim.type === EntityType.PLAYER || victim.type === EntityType.ENEMY || victim.type === EntityType.ELITE_TANK) &&
    telegraph.friendlyFire === false &&
    telegraph.ownerTeam != null &&
    telegraph.ownerTeam !== Team.NONE &&
    victim.team === telegraph.ownerTeam
  ) {
    return false;
  }

  if (
    (victim.type === EntityType.DRONE || victim.type === EntityType.MINI_TANK) &&
    victim.owner &&
    victim.owner.id === ownerEntityId
  ) {
    return false;
  }

  return true;
};

export const updateBossRushTelegraphs = (
  engine: BossRushEngineBridge,
  telegraphs: BossRushTelegraph[],
  dt: number
) => {
  const queuedTelegraphs: BossRushTelegraph[] = [];
  for (const telegraph of telegraphs) {
    telegraph.elapsedSeconds += dt;
    if (telegraph.type === 'blood_crescent_pressure' && !telegraph.executed && telegraph.velocity) {
      telegraph.x += telegraph.velocity.x * dt;
      telegraph.y += telegraph.velocity.y * dt;
      if (telegraph.angle == null) {
        telegraph.angle = Math.atan2(telegraph.velocity.y, telegraph.velocity.x);
      }
      const halfW = 2600 - (telegraph.detonationRadius || telegraph.radius || 180);
      const halfH = 1900 - (telegraph.detonationRadius || telegraph.radius || 180);
      const atArenaEdge =
        telegraph.detonatesOnArenaEdge &&
        (Math.abs(telegraph.x - 5000) >= halfW || Math.abs(telegraph.y - 5000) >= halfH);
      const player = engine.player;
      const nearPlayer =
        telegraph.detonatesOnProximity &&
        player &&
        Vector.dist({ x: telegraph.x, y: telegraph.y }, player.pos) <= (telegraph.triggerRadius || 0) + (player.radius || 0);
      const timedOut = telegraph.elapsedSeconds >= (telegraph.maxTravelSeconds ?? telegraph.delaySeconds);
      if ((atArenaEdge || nearPlayer || timedOut) && !telegraph.childSpawned) {
        telegraph.executed = true;
        telegraph.triggeredAtSeconds = telegraph.elapsedSeconds;
        telegraph.childSpawned = true;
        queuedTelegraphs.push({
          id: `${telegraph.id}-detonation`,
          ownerBossId: telegraph.ownerBossId,
          ownerBossKey: telegraph.ownerBossKey,
          ownerEntityId: telegraph.ownerEntityId,
          ownerTeam: telegraph.ownerTeam,
          friendlyFire: telegraph.friendlyFire,
          selfDamage: telegraph.selfDamage,
          sourceMode: telegraph.sourceMode,
          attackId: telegraph.attackId,
          audioScale: telegraph.audioScale,
          type: 'red_circle_impact',
          x: telegraph.x,
          y: telegraph.y,
          radius: telegraph.detonationRadius || telegraph.radius || 180,
          delaySeconds: telegraph.elapsedSeconds + (telegraph.childDelaySeconds ?? 0.42),
          activeSeconds: 0.22,
          elapsedSeconds: 0,
          damage: telegraph.detonationDamage || 160,
          color: telegraph.color,
          pulseSpeed: 4.6,
          executed: false,
          sequenceId: telegraph.sequenceId,
          wave: telegraph.wave,
        });
      }
    }
    if (!telegraph.executed) {
      const palette = getTelegraphPalette(telegraph);
      const boss = engine.entities.find((entity) => entity.id === telegraph.ownerBossId) as BossRushBossEntity | undefined;
      triggerSpawnCue(engine, telegraph, boss);
      triggerChargeCue(engine, telegraph, palette, boss);
    }
    if (!telegraph.executed && telegraph.elapsedSeconds >= telegraph.delaySeconds) {
      telegraph.executed = true;
      const palette = getTelegraphPalette(telegraph);
      const boss = engine.entities.find((entity) => entity.id === telegraph.ownerBossId) as BossRushBossEntity | undefined;
      const isVisualOnly = telegraph.visualRole === 'hover_marker' || telegraph.visualRole === 'safe_hint';
      if (telegraph.visualRole !== 'hover_marker' && telegraph.visualRole !== 'safe_hint' && telegraph.damage > 0) {
        const victims = engine.entities.filter((entity) =>
          !entity.isDead &&
          (
            entity.type === EntityType.PLAYER ||
            entity.type === EntityType.ENEMY ||
            entity.type === EntityType.ELITE_TANK ||
            entity.type === EntityType.SHAPE ||
            entity.type === EntityType.CRASHER ||
            entity.type === EntityType.BOSS ||
            entity.type === EntityType.DUMMY ||
            entity.type === EntityType.GUARDIAN ||
            entity.type === EntityType.DRONE ||
            entity.type === EntityType.MINI_TANK ||
            entity.type === EntityType.DOMINION_TANK
          )
        );
        for (const victim of victims) {
          if (!canSandboxTelegraphHitTarget(engine, telegraph, victim)) continue;
          if (!intersectsTelegraph(telegraph, victim)) continue;
          victim.takeDamage(telegraph.damage, boss?.id ?? telegraph.ownerBossId, false);
        }
      }
      if (!isVisualOnly) {
        engine.spawnParticles(
          { x: telegraph.x, y: telegraph.y },
          palette.particle,
          telegraph.ownerBossKey === 'reactor' ? 28 : telegraph.ownerBossKey === 'grand_singularity' ? 24 : 18,
          telegraph.ownerBossKey === 'executioner' ? 6 : 5
        );
        if (telegraph.length && telegraph.angle != null && telegraph.type !== 'red_cone_sweep') {
          const burstSegments = telegraph.type === 'wide_red_lane' || telegraph.type === 'cross_laser_warning' ? 5 : 4;
          for (let i = 0; i < burstSegments; i += 1) {
            const t = burstSegments === 1 ? 0 : i / (burstSegments - 1);
            const offset = (t - 0.5) * (telegraph.length || 0) * 0.82;
            engine.spawnParticles(
              {
                x: telegraph.x + Math.cos(telegraph.angle) * offset,
                y: telegraph.y + Math.sin(telegraph.angle) * offset,
              },
              palette.particle,
              telegraph.ownerBossKey === 'grand_singularity' ? 8 : 6,
              telegraph.type === 'wide_red_lane' ? 6 : 4,
            );
          }
        }
        spawnTelegraphImpactVfx(engine, telegraph, palette, boss);
        engine.shakeAmount += getTelegraphImpactShake(telegraph) * engine.settings.shakeIntensity;
        {
          const spatial = engine.getAudioSpatialOptions(
            boss?.pos ?? { x: telegraph.x, y: telegraph.y },
            true
          );
          if (telegraph.attackId) {
            engine.sound.playBossRushAbilityImpact(
              telegraph.ownerBossKey ?? 'gatekeeper',
              telegraph.attackId,
              telegraph.type,
              spatial,
              telegraph.audioScale ?? 'standard',
            );
          } else {
            engine.sound.playBossRushTelegraphImpact(
              telegraph.ownerBossKey ?? 'gatekeeper',
              telegraph.type,
              spatial
            );
          }
          if (boss) {
            engine.sound.playExplosion(true, engine.getAudioSpatialOptions(boss.pos, true));
          }
        }
      }
    }
  }

  if (queuedTelegraphs.length > 0) {
    telegraphs.push(...queuedTelegraphs);
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
    const spawnWindow = Math.min(0.32, Math.max(0.12, telegraph.delaySeconds * 0.22));
    const spawnProgress = telegraph.executed ? 1 : clamp(telegraph.elapsedSeconds / Math.max(0.001, spawnWindow), 0, 1);
    const spawnEase = telegraph.executed ? 1 : 1 - Math.pow(1 - spawnProgress, 3);
    const widthEase = telegraph.executed ? 1 : (0.2 + spawnEase * 0.8);
    const pulse = 0.72 + Math.sin(now * telegraph.pulseSpeed + telegraph.x * 0.001) * 0.16;
    const fillAlpha = telegraph.executed ? 0.28 : (0.08 + warningProgress * 0.16) * pulse * (0.35 + spawnEase * 0.65);
    const strokeAlpha = telegraph.executed ? 0.92 : (0.28 + warningProgress * 0.56) * (0.45 + spawnEase * 0.55);

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

    if (telegraph.type === 'blood_crescent_pressure') {
      const radius = (telegraph.radius || 0) * (telegraph.executed ? 1 : (0.32 + spawnEase * 0.68));
      const innerRadius = (telegraph.innerRadius || radius * 0.62) * (telegraph.executed ? 1 : (0.28 + spawnEase * 0.72));
      const spread = telegraph.spread || Math.PI * 0.8;
      const sweepPulse = 0.82 + Math.sin(now * 5.8 + telegraph.x * 0.0015) * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -spread * 0.5, spread * 0.5);
      ctx.arc(0, 0, innerRadius, spread * 0.5, -spread * 0.5, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.88 + warningProgress * 0.08), -spread * 0.34, spread * 0.34);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = `rgba(${palette.stroke}, ${0.34 + warningProgress * 0.28})`;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255, ${0.1 + spawnEase * 0.18})`;
      ctx.fillRect(radius * 0.12, -Math.max(14, (telegraph.width || 64) * 0.2), Math.max(26, radius * 0.2), Math.max(28, (telegraph.width || 64) * 0.4));
      if (!telegraph.executed) {
        const triggerRadius = telegraph.triggerRadius || innerRadius;
        ctx.beginPath();
        ctx.arc(0, 0, triggerRadius * sweepPulse, 0, Math.PI * 2);
        ctx.lineWidth = 1.6;
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = `rgba(${palette.stroke}, ${0.22 + warningProgress * 0.22})`;
        ctx.stroke();
      }
    } else if (telegraph.type === 'red_circle_impact') {
      const radius = (telegraph.radius || 0) * (telegraph.executed ? 1 : (0.18 + spawnEase * 0.82));
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let ringIndex = 0; ringIndex < 2; ringIndex += 1) {
        const ringRadius = radius * (0.36 + ringIndex * 0.2 + warningProgress * 0.18);
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, now * (1.1 + ringIndex * 0.4), now * (1.1 + ringIndex * 0.4) + Math.PI * 1.25);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(${palette.stroke}, ${0.24 + warningProgress * 0.26})`;
        ctx.stroke();
      }
      if (!telegraph.executed) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(10, radius * (0.1 + spawnEase * 0.3)), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${palette.stroke}, ${0.12 + spawnEase * 0.16})`;
        ctx.fill();
      }
      if (telegraph.ownerBossKey === 'reactor' || telegraph.ownerBossKey === 'grand_singularity') {
        ctx.beginPath();
        ctx.arc(0, 0, radius * (0.55 + warningProgress * 0.15), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${palette.stroke}, ${0.38 + warningProgress * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (telegraph.type === 'red_square_marker') {
      const size = (telegraph.size || 0) * (telegraph.executed ? 1 : (0.26 + spawnEase * 0.74));
      const hoverLift = telegraph.visualRole === 'hover_marker' ? Math.sin(now * 4.2 + telegraph.x * 0.001) * Math.max(6, size * 0.08) : 0;
      if (hoverLift !== 0) {
        ctx.translate(0, -hoverLift);
        ctx.shadowBlur = telegraph.executed ? 32 : 22;
      }
      ctx.beginPath();
      ctx.rect(-size * 0.5, -size * 0.5, size, size);
      ctx.fill();
      ctx.stroke();
      const corner = size * 0.18;
      ctx.beginPath();
      ctx.moveTo(-size * 0.5, -size * 0.5 + corner);
      ctx.lineTo(-size * 0.5, -size * 0.5);
      ctx.lineTo(-size * 0.5 + corner, -size * 0.5);
      ctx.moveTo(size * 0.5 - corner, -size * 0.5);
      ctx.lineTo(size * 0.5, -size * 0.5);
      ctx.lineTo(size * 0.5, -size * 0.5 + corner);
      ctx.moveTo(size * 0.5, size * 0.5 - corner);
      ctx.lineTo(size * 0.5, size * 0.5);
      ctx.lineTo(size * 0.5 - corner, size * 0.5);
      ctx.moveTo(-size * 0.5 + corner, size * 0.5);
      ctx.lineTo(-size * 0.5, size * 0.5);
      ctx.lineTo(-size * 0.5, size * 0.5 - corner);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = `rgba(${palette.stroke}, ${0.45 + warningProgress * 0.28})`;
      ctx.stroke();
      if (telegraph.ownerBossKey === 'splitter') {
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, -size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.5);
        ctx.moveTo(size * 0.5, -size * 0.5);
        ctx.lineTo(-size * 0.5, size * 0.5);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(${palette.stroke}, ${0.45 + warningProgress * 0.22})`;
        ctx.stroke();
      }
      if (telegraph.visualRole === 'hover_marker') {
        ctx.beginPath();
        ctx.moveTo(0, size * 0.5);
        ctx.lineTo(0, size * 0.5 + 18 + Math.abs(hoverLift));
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = `rgba(${palette.stroke}, ${0.26 + warningProgress * 0.24})`;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (telegraph.visualRole === 'safe_hint') {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(200,255,240, ${0.42 + warningProgress * 0.28})`;
        ctx.stroke();
      }
    } else if (telegraph.type === 'red_cone_sweep') {
      const length = (telegraph.length || 0) * (telegraph.executed ? 1 : (0.2 + spawnEase * 0.8));
      const spread = (telegraph.spread || Math.PI / 3) * (telegraph.executed ? 1 : (0.22 + spawnEase * 0.78));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, length, -spread * 0.5, spread * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let bandIndex = 1; bandIndex <= 3; bandIndex += 1) {
        const bandLength = length * (0.22 * bandIndex + warningProgress * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, bandLength, -spread * 0.5, spread * 0.5);
        ctx.closePath();
        ctx.lineWidth = bandIndex === 3 ? 2.2 : 1.4;
        ctx.strokeStyle = `rgba(${palette.stroke}, ${0.16 + bandIndex * 0.08})`;
        ctx.stroke();
      }
      if (telegraph.ownerBossKey === 'executioner') {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(length * 0.9, 0);
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(${palette.stroke}, 0.72)`;
        ctx.stroke();
      }
    } else if (telegraph.type === 'cross_laser_warning') {
      const length = (telegraph.length || 0) * (telegraph.executed ? 1 : (0.12 + spawnEase * 0.88));
      const width = (telegraph.width || 0) * widthEase;
      ctx.fillRect(-length * 0.5, -width * 0.5, length, width);
      ctx.strokeRect(-length * 0.5, -width * 0.5, length, width);
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-length * 0.5, -width * 0.5, length, width);
      ctx.strokeRect(-length * 0.5, -width * 0.5, length, width);
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(width * 0.9, 20 + warningProgress * 18), 0, Math.PI * 2);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = `rgba(${palette.stroke}, ${0.34 + warningProgress * 0.26})`;
      ctx.stroke();
      if (!telegraph.executed) {
        const axisGlow = length * spawnEase * 0.5;
        ctx.fillStyle = `rgba(${palette.stroke}, ${0.14 + spawnEase * 0.22})`;
        ctx.fillRect(-axisGlow, -Math.max(6, width * 0.2), axisGlow * 2, Math.max(12, width * 0.4));
        ctx.save();
        ctx.rotate(Math.PI / 2);
        ctx.fillRect(-axisGlow, -Math.max(6, width * 0.2), axisGlow * 2, Math.max(12, width * 0.4));
        ctx.restore();
      }
    } else if (telegraph.type === 'rotating_danger_arc') {
      const radius = (telegraph.radius || 0) * (telegraph.executed ? 1 : (0.24 + spawnEase * 0.76));
      const innerRadius = (telegraph.innerRadius || 0) * (telegraph.executed ? 1 : (0.16 + spawnEase * 0.84));
      const spread = (telegraph.spread || Math.PI / 3) * (telegraph.executed ? 1 : (0.24 + spawnEase * 0.76));
      ctx.beginPath();
      ctx.arc(0, 0, radius, -spread * 0.5, spread * 0.5);
      ctx.arc(0, 0, innerRadius, spread * 0.5, -spread * 0.5, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (telegraph.ownerBossKey === 'grand_singularity') {
        ctx.beginPath();
        ctx.arc(0, 0, ((telegraph.innerRadius || 0) + (telegraph.radius || 0)) * 0.5, -spread * 0.5, spread * 0.5);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(${palette.stroke}, ${0.35 + warningProgress * 0.25})`;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.78 + warningProgress * 0.08), -spread * 0.42, spread * 0.42);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(${palette.stroke}, ${0.26 + warningProgress * 0.2})`;
      ctx.stroke();
    } else {
      const length = telegraph.length || 0;
      const width = telegraph.width || 0;
      const drawLength = telegraph.executed ? length : length * (0.06 + spawnEase * 0.94);
      const drawWidth = telegraph.executed ? width : width * widthEase;
      ctx.fillRect(-drawLength * 0.5, -drawWidth * 0.5, drawLength, drawWidth);
      ctx.strokeRect(-drawLength * 0.5, -drawWidth * 0.5, drawLength, drawWidth);
      const chevronSpacing = Math.max(44, width * 0.95);
      const chevronTravel = (now * 140) % chevronSpacing;
      const revealHead = -drawLength * 0.5 + drawLength * spawnEase;
      for (let chevronX = -drawLength * 0.5 - chevronSpacing; chevronX <= drawLength * 0.5 + chevronSpacing; chevronX += chevronSpacing) {
        const x = chevronX + chevronTravel;
        const chevronSize = Math.min(18, drawWidth * 0.24);
        ctx.beginPath();
        ctx.moveTo(x - chevronSize, -chevronSize * 0.8);
        ctx.lineTo(x, 0);
        ctx.lineTo(x - chevronSize, chevronSize * 0.8);
        ctx.lineWidth = telegraph.executed ? 2.4 : 1.6;
        ctx.strokeStyle = `rgba(${palette.stroke}, ${telegraph.executed ? 0.4 : 0.18 + warningProgress * 0.16})`;
        ctx.stroke();
      }
      if (!telegraph.executed) {
        const anchorSize = Math.max(10, drawWidth * 0.34);
        ctx.fillStyle = `rgba(${palette.stroke}, ${0.16 + spawnEase * 0.24})`;
        ctx.beginPath();
        ctx.arc(-drawLength * 0.5, 0, anchorSize, 0, Math.PI * 2);
        ctx.arc(drawLength * 0.5, 0, anchorSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255, ${0.08 + spawnEase * 0.22})`;
        ctx.fillRect(revealHead - Math.max(12, drawWidth * 0.2), -drawWidth * 0.5, Math.max(24, drawWidth * 0.4), drawWidth);

        const tracerCount = Math.max(3, Math.round(3 + warningProgress * 5));
        for (let i = 0; i < tracerCount; i += 1) {
          const tracerX = -drawLength * 0.5 + drawLength * Math.max(0, spawnEase - i * 0.08);
          ctx.beginPath();
          ctx.moveTo(tracerX, -drawWidth * 0.46);
          ctx.lineTo(tracerX + drawWidth * 0.4, 0);
          ctx.lineTo(tracerX, drawWidth * 0.46);
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = `rgba(${palette.stroke}, ${0.14 + spawnEase * 0.18 - i * 0.02})`;
          ctx.stroke();
        }
      }
      if (telegraph.executed) {
        ctx.fillStyle = `rgba(255,255,255,0.22)`;
        ctx.fillRect(-drawLength * 0.5, -drawWidth * 0.16, drawLength, drawWidth * 0.32);
      }
      if (telegraph.ownerBossKey === 'gatekeeper' || telegraph.ownerBossKey === 'executioner') {
        const stripeCount = telegraph.ownerBossKey === 'gatekeeper' ? 3 : 1;
        const stripeSpacing = drawWidth / Math.max(2, stripeCount + 1);
        for (let stripeIndex = 0; stripeIndex < stripeCount; stripeIndex += 1) {
          const stripeY = stripeCount === 1 ? 0 : -drawWidth * 0.5 + stripeSpacing * (stripeIndex + 1);
          ctx.beginPath();
          ctx.moveTo(-drawLength * 0.5, stripeY);
          ctx.lineTo(drawLength * 0.5, stripeY);
          ctx.lineWidth = stripeIndex === 1 ? 2.4 : 1.3;
          ctx.strokeStyle = `rgba(${palette.stroke}, ${0.24 + warningProgress * (stripeIndex === 1 ? 0.48 : 0.3)})`;
          ctx.stroke();
        }
        if (telegraph.ownerBossKey === 'gatekeeper' && !telegraph.executed) {
          const sweepX = -drawLength * 0.5 + drawLength * warningProgress;
          ctx.fillStyle = `rgba(${palette.stroke}, ${0.28 + warningProgress * 0.24})`;
          ctx.fillRect(sweepX - 8, -drawWidth * 0.5, 16, drawWidth);
        }
      }
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
      } else if (telegraph.ownerBossKey === 'gatekeeper' && (telegraph.type === 'straight_red_lane' || telegraph.type === 'wide_red_lane')) {
        const previewLength = (telegraph.length || 0) * (0.08 + warningProgress * 0.92);
        const previewWidth = Math.max(10, (telegraph.width || 0) * 0.22);
        ctx.fillStyle = `rgba(${palette.stroke}, ${0.14 + warningProgress * 0.16})`;
        ctx.fillRect(-previewLength * 0.5, -previewWidth * 0.5, previewLength, previewWidth);
      }
      ctx.restore();
    }

    ctx.restore();
  }
};
