import * as Vector from '../MathUtils';
import { BossRushBossDefinition, BossRushBossEntity, BossRushEngineBridge, BossRushTelegraph, BOSS_RUSH_TELEGRAPH_SECONDS, BossRushArena, BossRushAttackId } from './BossRushTypes';

const nextTelegraphId = (() => {
  let counter = 0;
  return () => `boss-rush-tg-${++counter}`;
})();

const lane = (
  boss: BossRushBossEntity,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  damage: number,
  wide = false,
  delaySeconds = BOSS_RUSH_TELEGRAPH_SECONDS,
): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: wide ? 'wide_red_lane' : 'straight_red_lane',
  x,
  y,
  angle,
  length,
  width,
  delaySeconds,
  activeSeconds: 0.18,
  elapsedSeconds: 0,
  damage,
  color: boss.color,
  pulseSpeed: 4.8,
  executed: false,
});

const square = (
  boss: BossRushBossEntity,
  x: number,
  y: number,
  size: number,
  damage: number,
  delaySeconds = BOSS_RUSH_TELEGRAPH_SECONDS,
): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: 'red_square_marker',
  x,
  y,
  size,
  delaySeconds,
  activeSeconds: 0.16,
  elapsedSeconds: 0,
  damage,
  color: boss.color,
  pulseSpeed: 5.2,
  executed: false,
});

const circle = (boss: BossRushBossEntity, x: number, y: number, radius: number, damage: number): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: 'red_circle_impact',
  x,
  y,
  radius,
  delaySeconds: BOSS_RUSH_TELEGRAPH_SECONDS,
  activeSeconds: 0.18,
  elapsedSeconds: 0,
  damage,
  color: boss.color,
  pulseSpeed: 5.1,
  executed: false,
});

const delayedCircle = (
  boss: BossRushBossEntity,
  x: number,
  y: number,
  radius: number,
  damage: number,
  delaySeconds: number,
): BossRushTelegraph => ({
  ...circle(boss, x, y, radius, damage),
  delaySeconds,
});

const cone = (boss: BossRushBossEntity, angle: number, length: number, spread: number, damage: number): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: 'red_cone_sweep',
  x: boss.pos.x,
  y: boss.pos.y,
  angle,
  length,
  spread,
  delaySeconds: BOSS_RUSH_TELEGRAPH_SECONDS,
  activeSeconds: 0.18,
  elapsedSeconds: 0,
  damage,
  color: boss.color,
  pulseSpeed: 4.4,
  executed: false,
});

const cross = (boss: BossRushBossEntity, x: number, y: number, angle: number, length: number, width: number, damage: number): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: 'cross_laser_warning',
  x,
  y,
  angle,
  length,
  width,
  delaySeconds: BOSS_RUSH_TELEGRAPH_SECONDS,
  activeSeconds: 0.2,
  elapsedSeconds: 0,
  damage,
  color: boss.color,
  pulseSpeed: 4.9,
  executed: false,
});

const arc = (boss: BossRushBossEntity, radius: number, innerRadius: number, angle: number, spread: number, damage: number): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: 'rotating_danger_arc',
  x: boss.pos.x,
  y: boss.pos.y,
  radius,
  innerRadius,
  angle,
  spread,
  delaySeconds: BOSS_RUSH_TELEGRAPH_SECONDS,
  activeSeconds: 0.22,
  elapsedSeconds: 0,
  damage,
  color: boss.color,
  pulseSpeed: 4.3,
  executed: false,
});

const withinArena = (arena: BossRushArena, point: { x: number; y: number }, margin = 220) => ({
  x: Math.max(arena.center.x - arena.width * 0.5 + margin, Math.min(arena.center.x + arena.width * 0.5 - margin, point.x)),
  y: Math.max(arena.center.y - arena.height * 0.5 + margin, Math.min(arena.center.y + arena.height * 0.5 - margin, point.y)),
});

const createOffsetLane = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  axisAngle: number,
  offset: number,
  perpendicularShift: number,
  length: number,
  width: number,
  damage: number,
  delaySeconds: number,
  wide = false,
) => {
  const along = Vector.fromAngle(axisAngle);
  const normal = Vector.fromAngle(axisAngle + Math.PI / 2);
  const origin = withinArena(arena, {
    x: arena.center.x + along.x * offset + normal.x * perpendicularShift,
    y: arena.center.y + along.y * offset + normal.y * perpendicularShift,
  });
  return lane(boss, origin.x, origin.y, axisAngle, length, width, damage, wide, delaySeconds);
};

const spawnPassiveHazardField = (
  arena: BossRushArena,
  boss: BossRushBossEntity,
  target: any,
  count: number,
  radius: number,
  damage: number,
  delaySeconds: number,
): BossRushTelegraph[] => {
  const telegraphs: BossRushTelegraph[] = [];
  const placed: { x: number; y: number }[] = [];
  const minGap = radius * 1.85;
  const safeRadius = radius * 1.9;
  const halfW = arena.width * 0.5 - radius - 240;
  const halfH = arena.height * 0.5 - radius - 240;
  let attempts = 0;

  while (telegraphs.length < count && attempts < 80) {
    attempts += 1;
    const candidate = {
      x: arena.center.x + (Math.random() * 2 - 1) * halfW,
      y: arena.center.y + (Math.random() * 2 - 1) * halfH,
    };
    if (Vector.dist(candidate, target.pos) < safeRadius) continue;
    if (placed.some((point) => Vector.dist(point, candidate) < minGap)) continue;
    placed.push(candidate);
    telegraphs.push(delayedCircle(boss, candidate.x, candidate.y, radius, damage, delaySeconds));
  }

  return telegraphs;
};

export const emitBossRushAttack = (
  engine: BossRushEngineBridge,
  arena: BossRushArena,
  definition: BossRushBossDefinition,
  boss: BossRushBossEntity,
  attackId: BossRushAttackId,
  target: any
): BossRushTelegraph[] => {
  const angleToPlayer = Math.atan2(target.pos.y - boss.pos.y, target.pos.x - boss.pos.x);
  const center = arena.center;

  switch (attackId) {
    case 'boss_basic_volley': {
      const spread =
        definition.key === 'gatekeeper' ? [-0.12, 0, 0.12] :
        definition.key === 'splitter' ? [-0.22, 0, 0.22] :
        definition.key === 'reactor' ? [-0.16, 0.16] :
        definition.key === 'executioner' ? [-0.18, 0, 0.18] :
        definition.key === 'grand_singularity' ? [-0.26, 0, 0.26] :
        [0];
      const length = definition.key === 'gatekeeper' ? 1480 : definition.key === 'reactor' ? 1540 : 1680;
      const width = definition.key === 'executioner' ? 112 : 96;
      const damage = definition.key === 'gatekeeper' ? 118 : definition.key === 'reactor' ? 132 : 138;
      return spread.map((delta) =>
        lane(
          boss,
          boss.pos.x + Math.cos(angleToPlayer + delta) * 640,
          boss.pos.y + Math.sin(angleToPlayer + delta) * 640,
          angleToPlayer + delta,
          length,
          width,
          damage,
        )
      );
    }
    case 'gate_lane':
      return [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 820, boss.pos.y + Math.sin(angleToPlayer) * 820, angleToPlayer, 1900, 170, 165)];
    case 'gate_arc_beam': {
      const awakened = !!boss.__bossRushAwakened;
      const repeats = awakened ? 4 : 3;
      const telegraphs: BossRushTelegraph[] = [];
      for (let index = 0; index < repeats; index += 1) {
        const sweep = (index - (repeats - 1) * 0.5) * 0.16;
        telegraphs.push(
          lane(
            boss,
            boss.pos.x + Math.cos(angleToPlayer + sweep) * 880,
            boss.pos.y + Math.sin(angleToPlayer + sweep) * 880,
            angleToPlayer + sweep,
            2080,
            awakened ? 154 : 142,
            awakened ? 188 : 176,
            true,
            1.75 + index * (awakened ? 1.18 : 1.95),
          )
        );
      }
      return telegraphs;
    }
    case 'gate_squares':
      return [-180, -60, 60, 180].map((offset) => {
        const normal = Vector.fromAngle(angleToPlayer + Math.PI / 2);
        return square(boss, target.pos.x + normal.x * offset, target.pos.y + normal.y * offset, 240, 138);
      });
    case 'gate_hash_lock': {
      const telegraphs: BossRushTelegraph[] = [];
      const anchorDistance = 420;
      const anchor = {
        x: target.pos.x + Math.cos(angleToPlayer) * anchorDistance,
        y: target.pos.y + Math.sin(angleToPlayer) * anchorDistance,
      };
      const normal = Vector.fromAngle(angleToPlayer + Math.PI / 2);
      const laneAngle = angleToPlayer;
      const crossAngle = angleToPlayer + Math.PI / 2;

      const hashOffsets = [-180, 0, 180];
      hashOffsets.forEach((offset, index) => {
        telegraphs.push(
          lane(
            boss,
            anchor.x + normal.x * offset,
            anchor.y + normal.y * offset,
            laneAngle,
            1420,
            96,
            168,
            true,
            0.6 + index * 0.22,
          )
        );
      });

      hashOffsets.forEach((offset, index) => {
        telegraphs.push(
          lane(
            boss,
            anchor.x + Math.cos(laneAngle) * offset,
            anchor.y + Math.sin(laneAngle) * offset,
            crossAngle,
            1240,
            96,
            168,
            true,
            1.02 + index * 0.2,
          )
        );
      });

      telegraphs.push(square(boss, anchor.x, anchor.y, 154, 148, 1.58));
      return telegraphs;
    }
    case 'gate_cross_grid': {
      const telegraphs: BossRushTelegraph[] = [];
      const baseDistance = 380;
      const anchor = {
        x: target.pos.x + Math.cos(angleToPlayer) * baseDistance,
        y: target.pos.y + Math.sin(angleToPlayer) * baseDistance,
      };
      const normal = Vector.fromAngle(angleToPlayer + Math.PI / 2);
      for (const [index, lateral] of [-240, 0, 240].entries()) {
        telegraphs.push(
          cross(
            boss,
            anchor.x + normal.x * lateral,
            anchor.y + normal.y * lateral,
            angleToPlayer + (lateral === 0 ? Math.PI / 4 : 0),
            1120,
            lateral === 0 ? 124 : 108,
            lateral === 0 ? 176 : 164,
          )
        );
        telegraphs[telegraphs.length - 1].delaySeconds = 0.72 + index * 0.18;
      }
      return telegraphs;
    }
    case 'gate_rapid_crosshatch': {
      const telegraphs: BossRushTelegraph[] = [];
      const awakened = !!boss.__bossRushAwakened;
      const lineSpacing = awakened ? 170 : 210;
      const shifts = awakened ? [-255, -85, 85, 255] : [-220, 0, 220];
      shifts.forEach((shift, index) => {
        telegraphs.push(
          createOffsetLane(
            boss,
            arena,
            angleToPlayer + Math.PI / 4,
            -180 + index * 75,
            shift,
            1460,
            92,
            awakened ? 174 : 164,
            0.68 + index * 0.22,
            true,
          ),
          createOffsetLane(
            boss,
            arena,
            angleToPlayer - Math.PI / 4,
            160 - index * 70,
            shift - lineSpacing * 0.35,
            1460,
            92,
            awakened ? 174 : 164,
            0.84 + index * 0.22,
            true,
          )
        );
      });
      return telegraphs;
    }
    case 'gate_dash':
      boss.vel = Vector.add(boss.vel, Vector.mult(Vector.fromAngle(angleToPlayer), 4.2));
      return [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 720, boss.pos.y + Math.sin(angleToPlayer) * 720, angleToPlayer, 1600, 150, 188)];
    case 'gate_ring_prison':
      return [0, 1, 2, 3, 4, 5].map((index) => {
        const angle = angleToPlayer + index * (Math.PI / 3);
        return circle(boss, target.pos.x + Math.cos(angle) * 250, target.pos.y + Math.sin(angle) * 250, 120, 158);
      });

    case 'splitter_triple_lane':
      return [-0.28, 0, 0.28].map((delta) => lane(boss, boss.pos.x + Math.cos(angleToPlayer + delta) * 840, boss.pos.y + Math.sin(angleToPlayer + delta) * 840, angleToPlayer + delta, 2100, 150, 178));
    case 'splitter_checker': {
      const telegraphs: BossRushTelegraph[] = [];
      const baseX = target.pos.x - 360;
      const baseY = target.pos.y - 360;
      for (let gx = 0; gx < 3; gx += 1) {
        for (let gy = 0; gy < 3; gy += 1) {
          if ((gx + gy) % 2 === 0) {
            telegraphs.push(square(boss, baseX + gx * 360, baseY + gy * 360, 230, 148));
          }
        }
      }
      return telegraphs;
    }
    case 'splitter_cone':
      return [cone(boss, angleToPlayer, 1320, Math.PI / 2.4, 172)];
    case 'splitter_zigzag_lines': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs: BossRushTelegraph[] = [];
      const columns = awakened ? 6 : 5;
      const spacing = arena.width * 0.11;
      const amplitude = awakened ? 340 : 280;
      for (let index = 0; index < columns; index += 1) {
        const offset = (index - (columns - 1) * 0.5) * spacing;
        const perpendicularShift = (index % 2 === 0 ? -1 : 1) * amplitude;
        telegraphs.push(
          createOffsetLane(
            boss,
            arena,
            angleToPlayer + (index % 2 === 0 ? 0.68 : -0.68),
            offset,
            perpendicularShift,
            1540,
            awakened ? 106 : 96,
            awakened ? 184 : 172,
            1.08 + index * 0.16,
            true,
          )
        );
      }
      return telegraphs;
    }
    case 'splitter_corrupted_cascade': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs = emitBossRushAttack(engine, arena, definition, boss, 'splitter_zigzag_lines', target);
      const circleCount = awakened ? 6 : 5;
      for (let index = 0; index < circleCount; index += 1) {
        const strafeDir = index % 2 === 0 ? 1 : -1;
        const forward = 120 + index * 105;
        const side = strafeDir * (awakened ? 180 : 150);
        const x = target.pos.x + Math.cos(angleToPlayer) * forward + Math.cos(angleToPlayer + Math.PI / 2) * side;
        const y = target.pos.y + Math.sin(angleToPlayer) * forward + Math.sin(angleToPlayer + Math.PI / 2) * side;
        const clamped = withinArena(arena, { x, y }, 210);
        telegraphs.push(delayedCircle(boss, clamped.x, clamped.y, awakened ? 135 : 122, awakened ? 164 : 152, 1.5 + index * 0.32));
      }
      return telegraphs;
    }
    case 'splitter_pincer':
      return [
        lane(boss, target.pos.x + Math.cos(angleToPlayer + Math.PI / 2) * 620, target.pos.y + Math.sin(angleToPlayer + Math.PI / 2) * 620, angleToPlayer + Math.PI, 1500, 150, 176),
        lane(boss, target.pos.x + Math.cos(angleToPlayer - Math.PI / 2) * 620, target.pos.y + Math.sin(angleToPlayer - Math.PI / 2) * 620, angleToPlayer, 1500, 150, 176),
      ];

    case 'reactor_circles':
      return [
        circle(boss, target.pos.x, target.pos.y, 220, 168),
        circle(boss, center.x, center.y, 300, 172),
        circle(boss, target.pos.x + Math.cos(angleToPlayer) * 260, target.pos.y + Math.sin(angleToPlayer) * 260, 180, 152),
      ];
    case 'reactor_arc':
      return [arc(boss, 1180, 380, angleToPlayer, Math.PI / 2.2, 182)];
    case 'reactor_shuffle':
      return [
        circle(boss, center.x - 950, center.y - 620, 360, 178),
        circle(boss, center.x + 950, center.y - 620, 360, 178),
        circle(boss, center.x - 950, center.y + 620, 360, 178),
        circle(boss, center.x + 950, center.y + 620, 360, 178),
      ];
    case 'reactor_supernova':
      return [
        circle(boss, center.x, center.y, 540, 190),
        arc(boss, 1380, 620, angleToPlayer, Math.PI * 1.45, 180),
      ];

    case 'executioner_cleave':
      return [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 980, boss.pos.y + Math.sin(angleToPlayer) * 980, angleToPlayer, 2450, 240, 210, true)];
    case 'executioner_lockon':
      return [
        square(boss, target.pos.x, target.pos.y, 280, 188),
        square(boss, target.pos.x + 320, target.pos.y, 220, 172),
        square(boss, target.pos.x - 320, target.pos.y, 220, 172),
      ];
    case 'executioner_cross':
      return [cross(boss, target.pos.x, target.pos.y, angleToPlayer, 2100, 170, 204)];
    case 'executioner_fan_drive':
      return [-0.34, -0.12, 0.12, 0.34].map((delta) =>
        lane(boss, boss.pos.x + Math.cos(angleToPlayer + delta) * 920, boss.pos.y + Math.sin(angleToPlayer + delta) * 920, angleToPlayer + delta, 2200, 180, 194, true)
      );

    case 'singularity_lane_chain':
      return [-0.34, 0, 0.34].map((delta) => lane(boss, center.x + Math.cos(angleToPlayer + delta) * 220, center.y + Math.sin(angleToPlayer + delta) * 220, angleToPlayer + delta, arena.width * 0.86, 164, 192));
    case 'singularity_gravity':
      target.vel = Vector.add(target.vel, Vector.mult(Vector.normalize(Vector.sub(boss.pos, target.pos)), 4.4));
      return [
        circle(boss, target.pos.x, target.pos.y, 200, 188),
        circle(boss, target.pos.x + 260, target.pos.y - 160, 160, 158),
        circle(boss, target.pos.x - 260, target.pos.y + 160, 160, 158),
      ];
    case 'singularity_spiral': {
      const telegraphs: BossRushTelegraph[] = [];
      for (let i = 0; i < 6; i += 1) {
        const theta = angleToPlayer + i * 0.66;
        const distance = 220 + i * 120;
        telegraphs.push(circle(boss, boss.pos.x + Math.cos(theta) * distance, boss.pos.y + Math.sin(theta) * distance, 140 + i * 8, 166));
      }
      return telegraphs;
    }
    case 'singularity_rapid_chain':
      return [
        lane(boss, center.x, center.y, angleToPlayer, arena.width * 0.82, 150, 184),
        cross(boss, center.x, center.y, angleToPlayer + Math.PI / 4, 1900, 140, 172),
        cone(boss, angleToPlayer, 1440, Math.PI / 1.9, 178),
      ];
    case 'singularity_event_horizon':
      return [
        arc(boss, 1540, 760, angleToPlayer, Math.PI * 1.7, 194),
        circle(boss, target.pos.x, target.pos.y, 210, 170),
        circle(boss, center.x, center.y, 280, 176),
      ];
    default:
      return [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 800, boss.pos.y + Math.sin(angleToPlayer) * 800, angleToPlayer, 1800, 160, 150)];
  }
};

export const emitBossRushPassiveHazards = (
  arena: BossRushArena,
  definition: BossRushBossDefinition,
  boss: BossRushBossEntity,
  target: any,
): BossRushTelegraph[] => {
  if (definition.key !== 'reactor' && definition.key !== 'grand_singularity') {
    return [];
  }

  const awakened = !!boss.__bossRushAwakened;
  if (definition.key === 'reactor') {
    const telegraphs = spawnPassiveHazardField(
      arena,
      boss,
      target,
      awakened ? 5 : 4,
      awakened ? 176 : 160,
      awakened ? 150 : 138,
      awakened ? 2.05 : 2.6,
    );
    telegraphs.push(
      ...telegraphs.map((entry) => square(boss, entry.x, entry.y, 54, 0, entry.delaySeconds - 0.14))
    );
    return telegraphs;
  }

  const telegraphs = spawnPassiveHazardField(
    arena,
    boss,
    target,
    awakened ? 6 : 5,
    awakened ? 168 : 152,
    awakened ? 164 : 148,
    awakened ? 1.85 : 2.35,
  );
  telegraphs.push(
    ...telegraphs.map((entry, index) => square(boss, entry.x, entry.y, 46 + (index % 2) * 8, 0, entry.delaySeconds - 0.12))
  );
  return telegraphs;
};
