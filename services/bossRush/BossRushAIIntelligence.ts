import * as Vector from '../MathUtils';
import { BossRushArena, BossRushAttackSpec, BossRushBossDefinition, BossRushBossEntity, BossRushBossRuntime } from './BossRushTypes';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getBossRushPhase = (definition: BossRushBossDefinition, boss: BossRushBossEntity, awakened: boolean): number => {
  if (definition.phases <= 1) return 1;
  const hpRatio = boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0;
  if (definition.phases === 2) return hpRatio > 0.65 ? 1 : 2;
  if (awakened || hpRatio <= 0.3) return 3;
  return hpRatio > 0.68 ? 1 : 2;
};

export const chooseBossRushAttack = (
  definition: BossRushBossDefinition,
  runtime: BossRushBossRuntime,
  boss: BossRushBossEntity,
  player: any,
  options?: {
    excludeIds?: Set<string>;
    preferNonBasic?: boolean;
  }
): BossRushAttackSpec | null => {
  const distance = Vector.dist(boss.pos, player.pos);
  const phase = getBossRushPhase(definition, boss, runtime.awakened);
  const available = definition.attacks.filter((attack) => {
    if (options?.excludeIds?.has(attack.id)) return false;
    if ((runtime.attackCooldowns[attack.id] || 0) > 0) return false;
    if (attack.minRange != null && distance < attack.minRange) return false;
    if (attack.maxRange != null && distance > attack.maxRange) return false;
    if (attack.phases && !attack.phases.includes(phase)) return false;
    return true;
  });
  if (available.length === 0) return null;

  const filtered = options?.preferNonBasic
    ? available.filter((attack) => attack.id !== 'boss_basic_volley')
    : available;
  const source = filtered.length > 0 ? filtered : available;

  const weighted = source
    .map((attack) => ({ attack, score: (attack.weight || 1) * (0.85 + Math.random() * 0.3) }))
    .sort((a, b) => b.score - a.score);
  return weighted[0].attack;
};

export const updateBossRushMovement = (
  definition: BossRushBossDefinition,
  boss: BossRushBossEntity,
  player: any,
  arena: BossRushArena,
  runtime: BossRushBossRuntime,
  dt: number
) => {
  const toPlayer = Vector.sub(player.pos, boss.pos);
  const distance = Math.max(1, Vector.mag(toPlayer));
  const dir = Vector.normalize(toPlayer);
  const tangent = Vector.normalize({ x: -dir.y, y: dir.x });
  const toAnchor = Vector.sub(definition.arenaAnchor, boss.pos);
  const anchorDist = Vector.mag(toAnchor);
  const anchorPull = anchorDist > 24 ? Vector.mult(Vector.normalize(toAnchor), Math.min(0.26, anchorDist / 1600 * 0.22)) : { x: 0, y: 0 };
  const phase = getBossRushPhase(definition, boss, runtime.awakened);

  let force = { x: 0, y: 0 };
  if (definition.moveStyle === 'ANCHOR') {
    const hold = distance > 820 ? 0.12 : distance < 420 ? -0.14 : 0.02;
    force = Vector.add(anchorPull, Vector.mult(dir, hold));
  } else if (definition.moveStyle === 'STRAFE') {
    const hold = distance > 980 ? 0.22 : distance < 520 ? -0.16 : 0.04;
    force = Vector.add(Vector.mult(dir, hold), Vector.mult(tangent, 0.18 + phase * 0.025));
    force = Vector.add(force, anchorPull);
  } else if (definition.moveStyle === 'ORBIT') {
    const orbitBias = 0.2 + phase * 0.035;
    const hold = distance > 1040 ? 0.18 : distance < 620 ? -0.15 : 0.02;
    force = Vector.add(Vector.mult(tangent, orbitBias), Vector.mult(dir, hold));
    force = Vector.add(force, anchorPull);
  } else if (definition.moveStyle === 'EXECUTION') {
    const hold = distance > 720 ? 0.28 : distance < 300 ? -0.2 : 0.12;
    force = Vector.add(Vector.mult(dir, hold), Vector.mult(tangent, 0.08));
    force = Vector.add(force, anchorPull);
  } else {
    const orbitBias = runtime.awakened ? 0.23 : 0.14;
    const hold = distance > 1120 ? 0.18 : distance < 540 ? -0.18 : 0.03;
    force = Vector.add(Vector.mult(tangent, orbitBias), Vector.mult(dir, hold));
    force = Vector.add(force, anchorPull);
  }

  const accelCap = runtime.awakened ? 0.48 : 0.38;
  boss.acc = Vector.limit(Vector.add(boss.acc, force), accelCap);
  boss.rotation = Math.atan2(dir.y, dir.x);

  const arenaHalfW = arena.width * 0.5;
  const arenaHalfH = arena.height * 0.5;
  const relX = boss.pos.x - arena.center.x;
  const relY = boss.pos.y - arena.center.y;
  const edgeFactorX = Math.max(0, Math.abs(relX) - arenaHalfW * 0.82);
  const edgeFactorY = Math.max(0, Math.abs(relY) - arenaHalfH * 0.82);
  if (edgeFactorX > 0 || edgeFactorY > 0) {
    boss.acc = Vector.add(boss.acc, {
      x: -Math.sign(relX) * clamp(edgeFactorX / 220, 0, 0.32),
      y: -Math.sign(relY) * clamp(edgeFactorY / 220, 0, 0.32),
    });
  }

  boss.vel = Vector.limit(Vector.add(boss.vel, Vector.mult(boss.acc, dt * 60)), runtime.awakened ? 2.2 : 1.82);
};
