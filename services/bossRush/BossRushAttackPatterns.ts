import * as Vector from '../MathUtils';
import { BossRushBossDefinition, BossRushBossEntity, BossRushEngineBridge, BossRushTelegraph, BOSS_RUSH_TELEGRAPH_SECONDS, BossRushArena, BossRushAttackId } from './BossRushTypes';

const nextTelegraphId = (() => {
  let counter = 0;
  return () => `boss-rush-tg-${++counter}`;
})();

const lane = (boss: BossRushBossEntity, x: number, y: number, angle: number, length: number, width: number, damage: number, wide = false): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: wide ? 'wide_red_lane' : 'straight_red_lane',
  x,
  y,
  angle,
  length,
  width,
  delaySeconds: BOSS_RUSH_TELEGRAPH_SECONDS,
  activeSeconds: 0.18,
  elapsedSeconds: 0,
  damage,
  color: boss.color,
  pulseSpeed: 4.8,
  executed: false,
});

const square = (boss: BossRushBossEntity, x: number, y: number, size: number, damage: number): BossRushTelegraph => ({
  id: nextTelegraphId(),
  ownerBossId: boss.id,
  ownerBossKey: boss.__bossRushKey,
  type: 'red_square_marker',
  x,
  y,
  size,
  delaySeconds: BOSS_RUSH_TELEGRAPH_SECONDS,
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
    case 'gate_lane':
      return [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 820, boss.pos.y + Math.sin(angleToPlayer) * 820, angleToPlayer, 1900, 170, 165)];
    case 'gate_squares':
      return [-180, -60, 60, 180].map((offset) => {
        const normal = Vector.fromAngle(angleToPlayer + Math.PI / 2);
        return square(boss, target.pos.x + normal.x * offset, target.pos.y + normal.y * offset, 240, 138);
      });
    case 'gate_dash':
      boss.vel = Vector.add(boss.vel, Vector.mult(Vector.fromAngle(angleToPlayer), 4.2));
      return [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 720, boss.pos.y + Math.sin(angleToPlayer) * 720, angleToPlayer, 1600, 150, 188)];

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
    default:
      return [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 800, boss.pos.y + Math.sin(angleToPlayer) * 800, angleToPlayer, 1800, 160, 150)];
  }
};
