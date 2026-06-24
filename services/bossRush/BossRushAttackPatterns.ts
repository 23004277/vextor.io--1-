import * as Vector from '../MathUtils';
import { BossRushBossDefinition, BossRushBossEntity, BossRushEngineBridge, BossRushTelegraph, BOSS_RUSH_TELEGRAPH_SECONDS, BossRushArena, BossRushAttackEmission, BossRushAttackId } from './BossRushTypes';

const nextTelegraphId = (() => {
  let counter = 0;
  return () => `boss-rush-tg-${++counter}`;
})();

const nextSequenceId = (() => {
  let counter = 0;
  return (prefix: string) => `${prefix}-${++counter}`;
})();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

const staggerTelegraphs = <T extends BossRushTelegraph>(
  telegraphs: T[],
  startDelay: number,
  stepSeconds: number,
): T[] => telegraphs.map((telegraph, index) => ({
  ...telegraph,
  delaySeconds: startDelay + index * stepSeconds,
}));

const withSequence = <T extends BossRushTelegraph>(
  telegraphs: T[],
  sequenceId: string,
): T[] => telegraphs.map((telegraph, index) => ({
  ...telegraph,
  sequenceId,
  wave: telegraph.wave ?? index + 1,
}));

const getEmissionLockoutSeconds = (telegraphs: BossRushTelegraph[]) => {
  if (telegraphs.length === 0) return 0.6;
  return Math.max(...telegraphs.map((entry) => entry.delaySeconds + entry.activeSeconds)) + 0.08;
};

const emission = (
  telegraphs: BossRushTelegraph[],
  options?: Partial<Omit<BossRushAttackEmission, 'telegraphs'>>
): BossRushAttackEmission => ({
  telegraphs: telegraphs.map((telegraph) => ({
    ...telegraph,
    attackId: options?.attackId ?? telegraph.attackId,
    audioScale: options?.audioScale ?? telegraph.audioScale,
  })),
  lockoutSeconds: options?.lockoutSeconds ?? getEmissionLockoutSeconds(telegraphs),
  suppressPassiveUntil: options?.suppressPassiveUntil,
  allowComboFollowup: options?.allowComboFollowup ?? true,
  attackId: options?.attackId,
  audioScale: options?.audioScale,
});

const getAttackAudioScale = (attackId: BossRushAttackId): NonNullable<BossRushAttackEmission['audioScale']> => {
  switch (attackId) {
    case 'boss_basic_volley':
      return 'light';
    case 'gate_arc_beam':
    case 'gate_hash_lock':
    case 'splitter_corrupted_cascade':
    case 'executioner_falling_axes':
    case 'singularity_gravity_grid':
    case 'singularity_event_horizon':
    case 'reactor_supernova':
    case 'reactor_blood_crescent':
      return attackId === 'singularity_event_horizon' || attackId === 'reactor_supernova' ? 'ultimate' : 'major';
    default:
      return 'standard';
  }
};

const attackEmission = (
  attackId: BossRushAttackId,
  telegraphs: BossRushTelegraph[],
  options?: Partial<Omit<BossRushAttackEmission, 'telegraphs' | 'attackId' | 'audioScale'>>
): BossRushAttackEmission => emission(telegraphs, {
  ...options,
  attackId,
  audioScale: options?.audioScale ?? getAttackAudioScale(attackId),
});

const createLetterZPattern = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  centerPoint: { x: number; y: number },
  angle: number,
  span: number,
  height: number,
  laneWidth: number,
  damage: number,
  delayBase: number,
  wide = true,
): BossRushTelegraph[] => {
  const center = withinArena(arena, centerPoint, 260);
  const along = Vector.fromAngle(angle);
  const normal = Vector.fromAngle(angle + Math.PI / 2);
  const halfHeight = height * 0.5;
  const diagAngle = angle - Math.atan2(height, span);
  const top = {
    x: center.x - normal.x * halfHeight,
    y: center.y - normal.y * halfHeight,
  };
  const bottom = {
    x: center.x + normal.x * halfHeight,
    y: center.y + normal.y * halfHeight,
  };

  return [
    lane(boss, top.x, top.y, angle, span, laneWidth, damage, wide, delayBase),
    lane(boss, center.x, center.y, diagAngle, Math.sqrt(span * span + height * height), laneWidth * 0.88, damage, wide, delayBase + 0.28),
    lane(boss, bottom.x, bottom.y, angle, span, laneWidth, damage, wide, delayBase + 0.56),
  ];
};

const createLetterLPattern = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  cornerPoint: { x: number; y: number },
  angle: number,
  width: number,
  height: number,
  laneWidth: number,
  damage: number,
  delayBase: number,
  addCornerSquare = true,
): BossRushTelegraph[] => {
  const corner = withinArena(arena, cornerPoint, 260);
  const along = Vector.fromAngle(angle);
  const normal = Vector.fromAngle(angle + Math.PI / 2);
  const verticalCenter = {
    x: corner.x + normal.x * (height * 0.5),
    y: corner.y + normal.y * (height * 0.5),
  };
  const footCenter = {
    x: corner.x + along.x * (width * 0.5),
    y: corner.y + along.y * (width * 0.5) + normal.y * height,
  };
  const telegraphs: BossRushTelegraph[] = [
    lane(boss, verticalCenter.x, verticalCenter.y, angle + Math.PI / 2, height, laneWidth, damage, true, delayBase),
    lane(boss, footCenter.x, footCenter.y, angle, width, laneWidth, damage, true, delayBase + 0.32),
  ];
  if (addCornerSquare) {
    telegraphs.push(square(boss, corner.x, corner.y + normal.y * height, laneWidth * 1.35, damage * 0.82, delayBase + 0.48));
  }
  return telegraphs;
};

const createLetterOPattern = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  centerPoint: { x: number; y: number },
  radiusX: number,
  radiusY: number,
  circleRadius: number,
  damage: number,
  delayBase: number,
  count = 8,
): BossRushTelegraph[] => {
  const center = withinArena(arena, centerPoint, Math.max(radiusX, radiusY) + 220);
  const telegraphs: BossRushTelegraph[] = [];
  for (let i = 0; i < count; i += 1) {
    const theta = (i / count) * Math.PI * 2;
    const point = withinArena(arena, {
      x: center.x + Math.cos(theta) * radiusX,
      y: center.y + Math.sin(theta) * radiusY,
    }, circleRadius + 180);
    telegraphs.push(delayedCircle(boss, point.x, point.y, circleRadius, damage, delayBase + i * 0.06));
  }
  return telegraphs;
};

const createRingAroundPoint = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  centerPoint: { x: number; y: number },
  ringRadius: number,
  circleRadius: number,
  damage: number,
  delayBase: number,
  count = 6,
  stagger = 0.08,
  angleOffset = 0,
): BossRushTelegraph[] => {
  const center = withinArena(arena, centerPoint, ringRadius + circleRadius + 180);
  const telegraphs: BossRushTelegraph[] = [];
  for (let i = 0; i < count; i += 1) {
    const theta = angleOffset + (i / count) * Math.PI * 2;
    const point = withinArena(arena, {
      x: center.x + Math.cos(theta) * ringRadius,
      y: center.y + Math.sin(theta) * ringRadius,
    }, circleRadius + 160);
    telegraphs.push(delayedCircle(boss, point.x, point.y, circleRadius, damage, delayBase + i * stagger));
  }
  return telegraphs;
};

const createSequentialCircleTrail = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  centerPoint: { x: number; y: number },
  axisAngle: number,
  count: number,
  spacing: number,
  lateralSwing: number,
  radius: number,
  damage: number,
  delayBase: number,
  delayStep: number,
): BossRushTelegraph[] => {
  const along = Vector.fromAngle(axisAngle);
  const normal = Vector.fromAngle(axisAngle + Math.PI / 2);
  const telegraphs: BossRushTelegraph[] = [];
  for (let i = 0; i < count; i += 1) {
    const lateral = ((i % 2 === 0 ? -1 : 1) * lateralSwing);
    const point = withinArena(arena, {
      x: centerPoint.x + along.x * (i - (count - 1) * 0.5) * spacing + normal.x * lateral,
      y: centerPoint.y + along.y * (i - (count - 1) * 0.5) * spacing + normal.y * lateral,
    }, radius + 180);
    telegraphs.push(delayedCircle(boss, point.x, point.y, radius, damage, delayBase + i * delayStep));
  }
  return telegraphs;
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

const createHoverMarker = (
  boss: BossRushBossEntity,
  telegraph: BossRushTelegraph,
  size: number,
  delayOffset = 0.18,
): BossRushTelegraph => ({
  ...square(boss, telegraph.x, telegraph.y, size, 0, Math.max(0.2, telegraph.delaySeconds - delayOffset)),
  visualRole: 'hover_marker',
  activeSeconds: Math.max(0.5, telegraph.delaySeconds + 0.2),
  pulseSpeed: 3.6,
  sequenceId: telegraph.sequenceId,
});

const createGateBeamGridSequence = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  angleToPlayer: number,
  target: any,
  awakened: boolean,
  attackId: BossRushAttackId,
): BossRushAttackEmission => {
  const sequenceId = nextSequenceId('gate-arc-grid');
  const beamRepeats = awakened ? 3 : 2;
  const beamStart = 1.08;
  const beamSpacing = awakened ? 1.08 : 1.32;
  const beamTelegraphs: BossRushTelegraph[] = [];

  for (let index = 0; index < beamRepeats; index += 1) {
    const swing = (index % 2 === 0 ? -1 : 1) * (awakened ? 0.11 : 0.08);
    beamTelegraphs.push({
      ...lane(
        boss,
        boss.pos.x + Math.cos(angleToPlayer + swing) * 900,
        boss.pos.y + Math.sin(angleToPlayer + swing) * 900,
        angleToPlayer + swing,
        2120,
        awakened ? 154 : 146,
        awakened ? 190 : 178,
        true,
        beamStart + index * beamSpacing,
      ),
      wave: index + 1,
    });
  }

  const gridDelayBase = beamStart + (beamRepeats - 1) * beamSpacing + 0.92;
  const halfWidth = arena.width * 0.5 - 260;
  const halfHeight = arena.height * 0.5 - 240;
  const columns = awakened ? 5 : 4;
  const rows = awakened ? 4 : 3;
  const colStep = (halfWidth * 2) / (columns + 1);
  const rowStep = (halfHeight * 2) / (rows + 1);
  const preferSafeColumn = clamp(Math.round(((target.pos.x - (arena.center.x - halfWidth)) / (halfWidth * 2)) * (columns - 1)), 0, columns - 1);
  const preferSafeRow = clamp(Math.round(((target.pos.y - (arena.center.y - halfHeight)) / (halfHeight * 2)) * (rows - 1)), 0, rows - 1);
  const safeColumn = preferSafeColumn;
  const safeRow = preferSafeRow;
  const gridTelegraphs: BossRushTelegraph[] = [];

  for (let col = 0; col < columns; col += 1) {
    if (col === safeColumn) continue;
    const x = arena.center.x - halfWidth + colStep * (col + 1);
    gridTelegraphs.push({
      ...lane(
        boss,
        x,
        arena.center.y,
        Math.PI / 2,
        arena.height * 0.92,
        awakened ? 104 : 96,
        awakened ? 170 : 158,
        true,
        gridDelayBase + col * 0.11,
      ),
      wave: beamRepeats + col + 1,
    });
  }

  for (let row = 0; row < rows; row += 1) {
    if (row === safeRow) continue;
    const y = arena.center.y - halfHeight + rowStep * (row + 1);
    gridTelegraphs.push({
      ...lane(
        boss,
        arena.center.x,
        y,
        0,
        arena.width * 0.92,
        awakened ? 104 : 96,
        awakened ? 170 : 158,
        true,
        gridDelayBase + 0.24 + row * 0.11,
      ),
      wave: beamRepeats + columns + row + 1,
    });
  }

  const safeHintX = arena.center.x - halfWidth + colStep * (safeColumn + 1);
  const safeHintY = arena.center.y - halfHeight + rowStep * (safeRow + 1);
  gridTelegraphs.push({
    ...square(boss, safeHintX, safeHintY, awakened ? 240 : 220, 0, gridDelayBase + 0.1),
    visualRole: 'safe_hint',
    activeSeconds: 1.12,
    wave: 99,
  });

  const telegraphs = withSequence([...beamTelegraphs, ...gridTelegraphs], sequenceId);
  const lockoutSeconds = getEmissionLockoutSeconds(telegraphs) + 0.12;
  return attackEmission(attackId, telegraphs, {
    lockoutSeconds,
    suppressPassiveUntil: lockoutSeconds,
    allowComboFollowup: false,
  });
};

const createExecutionerXStrike = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  target: any,
  angleToPlayer: number,
  attackId: BossRushAttackId,
): BossRushAttackEmission => {
  const sequenceId = nextSequenceId('executioner-x-strike');
  const center = withinArena(arena, target.pos, 320);
  const safePocketDir = angleToPlayer + Math.PI / 4;
  const safeHint = withinArena(arena, {
    x: center.x + Math.cos(safePocketDir) * 230,
    y: center.y + Math.sin(safePocketDir) * 230,
  }, 250);
  const firstWave = [
    lane(boss, center.x, center.y, Math.PI / 4, 1880, 126, 182, true, 0.92),
    lane(boss, center.x, center.y, -Math.PI / 4, 1880, 126, 182, true, 1.02),
  ].map((entry, index) => ({ ...entry, wave: index + 1 }));
  const secondWave = [
    lane(boss, center.x, center.y - 210, 0, 1320, 112, 194, true, 2.08),
    lane(boss, center.x, center.y + 210, 0, 1320, 112, 194, true, 2.2),
    lane(boss, center.x - 210, center.y, Math.PI / 2, 1320, 112, 194, true, 2.32),
    lane(boss, center.x + 210, center.y, Math.PI / 2, 1320, 112, 194, true, 2.44),
  ].map((entry, index) => ({ ...entry, wave: index + 3 }));
  const safeTelegraph: BossRushTelegraph = {
    ...square(boss, safeHint.x, safeHint.y, 210, 0, 1.4),
    visualRole: 'safe_hint',
    activeSeconds: 1.48,
    wave: 98,
  };
  const telegraphs = withSequence([...firstWave, ...secondWave, safeTelegraph], sequenceId);
  const lockoutSeconds = getEmissionLockoutSeconds(telegraphs) + 0.16;
  return attackEmission(attackId, telegraphs, {
    lockoutSeconds,
    suppressPassiveUntil: lockoutSeconds,
    allowComboFollowup: false,
  });
};

const createReactorBloodCrescent = (
  boss: BossRushBossEntity,
  arena: BossRushArena,
  target: any,
  awakened: boolean,
  attackId: BossRushAttackId,
): BossRushAttackEmission => {
  const sequenceId = nextSequenceId('reactor-blood-crescent');
  const count = awakened ? 3 : 2;
  const telegraphs: BossRushTelegraph[] = [];
  for (let index = 0; index < count; index += 1) {
    const side = index - (count - 1) * 0.5;
    const spawnX = side < 0 ? arena.center.x - arena.width * 0.42 : side > 0 ? arena.center.x + arena.width * 0.42 : arena.center.x;
    const spawnY = clamp(
      target.pos.y + side * 240,
      arena.center.y - arena.height * 0.34,
      arena.center.y + arena.height * 0.34,
    );
    const toTarget = Vector.normalize(Vector.sub(target.pos, { x: spawnX, y: spawnY }));
    telegraphs.push({
      id: nextTelegraphId(),
      ownerBossId: boss.id,
      ownerBossKey: boss.__bossRushKey,
      type: 'blood_crescent_pressure',
      x: spawnX,
      y: spawnY,
      angle: Math.atan2(toTarget.y, toTarget.x),
      radius: awakened ? 188 : 172,
      innerRadius: awakened ? 118 : 108,
      spread: Math.PI * 0.8,
      width: awakened ? 84 : 76,
      delaySeconds: awakened ? 2.8 : 3.15,
      activeSeconds: 0.48,
      elapsedSeconds: 0,
      damage: 0,
      color: boss.color,
      pulseSpeed: 3.2,
      executed: false,
      sequenceId,
      wave: index + 1,
      velocity: { x: toTarget.x * (awakened ? 168 : 152), y: toTarget.y * (awakened ? 168 : 152) },
      triggerRadius: awakened ? 165 : 150,
      detonationRadius: awakened ? 220 : 196,
      detonationDamage: awakened ? 182 : 168,
      maxTravelSeconds: awakened ? 2.85 : 3.2,
      detonatesOnProximity: true,
      detonatesOnArenaEdge: true,
      childDelaySeconds: 0.38 + index * 0.06,
    });
  }
  const lockoutSeconds = Math.max(...telegraphs.map((entry) => entry.delaySeconds + (entry.childDelaySeconds ?? 0) + 0.3)) + 0.1;
  return attackEmission(attackId, telegraphs, {
    lockoutSeconds,
    suppressPassiveUntil: lockoutSeconds,
    allowComboFollowup: false,
  });
};

export const emitBossRushAttack = (
  engine: BossRushEngineBridge,
  arena: BossRushArena,
  definition: BossRushBossDefinition,
  boss: BossRushBossEntity,
  attackId: BossRushAttackId,
  target: any
): BossRushAttackEmission => {
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
      const baseDelay = definition.key === 'gatekeeper' ? 1.1 : 0.7;
      const delayStep = definition.key === 'gatekeeper' ? 0.16 : 0.12;
      return attackEmission(attackId, staggerTelegraphs(spread.map((delta) =>
        lane(
          boss,
          boss.pos.x + Math.cos(angleToPlayer + delta) * 640,
          boss.pos.y + Math.sin(angleToPlayer + delta) * 640,
          angleToPlayer + delta,
          length,
          width,
          damage,
          false,
        )
      ), baseDelay, delayStep));
    }
    case 'gate_lane':
      return attackEmission(attackId, [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 820, boss.pos.y + Math.sin(angleToPlayer) * 820, angleToPlayer, 1900, 170, 165)]);
    case 'gate_arc_beam':
      return createGateBeamGridSequence(boss, arena, angleToPlayer, target, !!boss.__bossRushAwakened, attackId);
    case 'gate_squares':
      return attackEmission(attackId, [-180, -60, 60, 180].map((offset) => {
        const normal = Vector.fromAngle(angleToPlayer + Math.PI / 2);
        return square(boss, target.pos.x + normal.x * offset, target.pos.y + normal.y * offset, 240, 138);
      }));
    case 'gate_corner_crush': {
      const corner = {
        x: target.pos.x - Math.cos(angleToPlayer) * 260 - Math.cos(angleToPlayer + Math.PI / 2) * 180,
        y: target.pos.y - Math.sin(angleToPlayer) * 260 - Math.sin(angleToPlayer + Math.PI / 2) * 180,
      };
      const telegraphs = createLetterLPattern(
        boss,
        arena,
        corner,
        angleToPlayer,
        760,
        820,
        150,
        176,
        0.7,
        true,
      );
      telegraphs.push(
        ...createSequentialCircleTrail(
          boss,
          arena,
          withinArena(arena, target.pos, 260),
          angleToPlayer + Math.PI / 2,
          3,
          220,
          90,
          118,
          160,
          1.08,
          0.22,
        ),
      );
      return attackEmission(attackId, telegraphs);
    }
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
      return attackEmission(attackId, telegraphs);
    }
    case 'gate_cross_grid': {
      const telegraphs: BossRushTelegraph[] = [];
      const baseDistance = 420;
      const anchor = {
        x: target.pos.x + Math.cos(angleToPlayer) * baseDistance,
        y: target.pos.y + Math.sin(angleToPlayer) * baseDistance,
      };
      const normal = Vector.fromAngle(angleToPlayer + Math.PI / 2);
      for (const [index, lateral] of [-290, 0, 290].entries()) {
        telegraphs.push(
          cross(
            boss,
            anchor.x + normal.x * lateral,
            anchor.y + normal.y * lateral,
            angleToPlayer + (lateral === 0 ? Math.PI / 4 : 0),
            1120,
            lateral === 0 ? 116 : 98,
            lateral === 0 ? 166 : 150,
          )
        );
        telegraphs[telegraphs.length - 1].delaySeconds = 0.84 + index * 0.22;
      }
      return attackEmission(attackId, telegraphs);
    }
    case 'gate_rapid_crosshatch': {
      const telegraphs: BossRushTelegraph[] = [];
      const awakened = !!boss.__bossRushAwakened;
      const lineSpacing = awakened ? 215 : 245;
      const shifts = awakened ? [-245, 0, 245] : [-220, 0, 220];
      shifts.forEach((shift, index) => {
        telegraphs.push(
          createOffsetLane(
            boss,
            arena,
            angleToPlayer + Math.PI / 4,
            -180 + index * 75,
            shift,
            1460,
            84,
            awakened ? 160 : 152,
            0.84 + index * 0.28,
            true,
          ),
          createOffsetLane(
            boss,
            arena,
            angleToPlayer - Math.PI / 4,
            160 - index * 70,
            shift - lineSpacing * 0.28,
            1460,
            84,
            awakened ? 160 : 152,
            1.06 + index * 0.28,
            true,
          )
        );
      });
      return attackEmission(attackId, telegraphs);
    }
    case 'gate_dash':
      boss.vel = Vector.add(boss.vel, Vector.mult(Vector.fromAngle(angleToPlayer), 3.15));
      return attackEmission(attackId, [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 680, boss.pos.y + Math.sin(angleToPlayer) * 680, angleToPlayer, 1500, 132, 172)]);
    case 'gate_ring_prison':
      return attackEmission(attackId, [0, 1, 2, 3, 4, 5].map((index) => {
        const angle = angleToPlayer + index * (Math.PI / 3);
        return circle(boss, target.pos.x + Math.cos(angle) * 290, target.pos.y + Math.sin(angle) * 290, 108, 146);
      }));

    case 'splitter_triple_lane':
      return attackEmission(attackId, [-0.28, 0, 0.28].map((delta, index) => lane(
        boss,
        boss.pos.x + Math.cos(angleToPlayer + delta) * 840,
        boss.pos.y + Math.sin(angleToPlayer + delta) * 840,
        angleToPlayer + delta,
        2100,
        150,
        178,
        false,
        0.72 + index * 0.18,
      )));
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
      return attackEmission(attackId, telegraphs);
    }
    case 'splitter_cone':
      return attackEmission(attackId, [cone(boss, angleToPlayer, 1320, Math.PI / 2.4, 172)]);
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
      return attackEmission(attackId, telegraphs);
    }
    case 'splitter_corrupted_cascade': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs = [...emitBossRushAttack(engine, arena, definition, boss, 'splitter_zigzag_lines', target).telegraphs];
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
      return attackEmission(attackId, telegraphs, { lockoutSeconds: getEmissionLockoutSeconds(telegraphs) + 0.12 });
    }
    case 'splitter_pincer':
      return attackEmission(attackId, createLetterZPattern(
        boss,
        arena,
        {
          x: target.pos.x + Math.cos(angleToPlayer) * 260,
          y: target.pos.y + Math.sin(angleToPlayer) * 260,
        },
        angleToPlayer,
        1380,
        760,
        142,
        176,
        0.86,
        true,
      ));
    case 'splitter_x_spread': {
      const centerPoint = withinArena(arena, target.pos, 260);
      const telegraphs = [
        lane(boss, centerPoint.x, centerPoint.y, angleToPlayer + Math.PI / 4, 1820, 120, 178, true, 0.74),
        lane(boss, centerPoint.x, centerPoint.y, angleToPlayer - Math.PI / 4, 1820, 120, 178, true, 0.92),
        lane(boss, centerPoint.x, centerPoint.y, angleToPlayer + Math.PI * 0.75, 1820, 104, 168, false, 1.22),
        lane(boss, centerPoint.x, centerPoint.y, angleToPlayer - Math.PI * 0.75, 1820, 104, 168, false, 1.38),
      ];
      return attackEmission(attackId, telegraphs, { allowComboFollowup: false });
    }
    case 'splitter_orbit_minefield': {
      const telegraphs = [
        ...createRingAroundPoint(
          boss,
          arena,
          withinArena(arena, target.pos, 280),
          290,
          116,
          156,
          0.92,
          6,
          0.12,
          angleToPlayer * 0.5,
        ),
        delayedCircle(boss, target.pos.x, target.pos.y, 108, 148, 1.46),
      ];
      return attackEmission(attackId, telegraphs);
    }
    case 'splitter_tripwire_lattice': {
      const centerPoint = withinArena(arena, target.pos, 280);
      const telegraphs: BossRushTelegraph[] = [];
      const lateralOffsets = [-260, 0, 260];
      lateralOffsets.forEach((offset, index) => {
        telegraphs.push(
          createOffsetLane(boss, arena, 0, centerPoint.x - arena.center.x, centerPoint.y - arena.center.y + offset, arena.width * 0.8, 88, 164, 0.8 + index * 0.18, true),
          createOffsetLane(boss, arena, Math.PI / 2, centerPoint.y - arena.center.y, centerPoint.x - arena.center.x + offset, arena.height * 0.8, 88, 164, 1.02 + index * 0.18, true),
        );
      });
      return attackEmission(attackId, telegraphs);
    }

    case 'reactor_circles':
      return attackEmission(attackId, [
        circle(boss, target.pos.x, target.pos.y, 220, 168),
        circle(boss, center.x, center.y, 300, 172),
        circle(boss, target.pos.x + Math.cos(angleToPlayer) * 260, target.pos.y + Math.sin(angleToPlayer) * 260, 180, 152),
      ]);
    case 'reactor_arc':
      return attackEmission(attackId, [arc(boss, 1180, 380, angleToPlayer, Math.PI / 2.2, 182)]);
    case 'reactor_shuffle': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs = createLetterOPattern(
        boss,
        arena,
        center,
        awakened ? 1080 : 920,
        awakened ? 760 : 620,
        awakened ? 164 : 150,
        awakened ? 186 : 178,
        0.82,
        awakened ? 10 : 8,
      );
      telegraphs.push(delayedCircle(boss, center.x, center.y, awakened ? 220 : 190, awakened ? 166 : 154, 1.36));
      return attackEmission(attackId, telegraphs);
    }
    case 'reactor_supernova':
      return attackEmission(attackId, [
        delayedCircle(boss, center.x, center.y, 540, 190, 0.84),
        {
          ...arc(boss, 1380, 620, angleToPlayer, Math.PI * 1.45, 180),
          delaySeconds: 1.14,
        },
      ], { suppressPassiveUntil: 1.52, allowComboFollowup: false });
    case 'reactor_blood_crescent':
      return createReactorBloodCrescent(boss, arena, target, !!boss.__bossRushAwakened, attackId);
    case 'reactor_quadrant_blast': {
      const centerPoint = withinArena(arena, target.pos, 320);
      const telegraphs: BossRushTelegraph[] = [];
      const offsets = [
        { x: -220, y: -220 },
        { x: 220, y: -220 },
        { x: -220, y: 220 },
        { x: 220, y: 220 },
      ];
      offsets.forEach((offset, index) => {
        telegraphs.push(
          delayedCircle(boss, centerPoint.x + offset.x, centerPoint.y + offset.y, 138, 170, 0.84 + index * 0.14),
        );
      });
      telegraphs.push(delayedCircle(boss, centerPoint.x, centerPoint.y, 148, 176, 1.54));
      return attackEmission(attackId, telegraphs);
    }
    case 'reactor_lane_lattice': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs: BossRushTelegraph[] = [];
      const spacing = awakened ? 230 : 270;
      [-spacing, 0, spacing].forEach((offset, index) => {
        telegraphs.push(
          createOffsetLane(boss, arena, 0, 0, offset, arena.width * 0.86, 96, awakened ? 182 : 170, 0.78 + index * 0.16, true),
          createOffsetLane(boss, arena, Math.PI / 2, 0, offset, arena.height * 0.86, 96, awakened ? 182 : 170, 1 + index * 0.16, true),
        );
      });
      return attackEmission(attackId, telegraphs, { lockoutSeconds: getEmissionLockoutSeconds(telegraphs) + 0.1 });
    }
    case 'reactor_orbit_crush': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs = [
        ...createLetterOPattern(
          boss,
          arena,
          target.pos,
          awakened ? 620 : 560,
          awakened ? 460 : 400,
          112,
          awakened ? 176 : 164,
          0.78,
          awakened ? 10 : 8,
        ),
        {
          ...arc(boss, awakened ? 1340 : 1240, awakened ? 420 : 380, angleToPlayer, Math.PI / 1.85, awakened ? 186 : 176),
          delaySeconds: 1.26,
        },
      ];
      return attackEmission(attackId, telegraphs, { allowComboFollowup: false });
    }
    case 'reactor_meltdown_steps': {
      const telegraphs = createSequentialCircleTrail(
        boss,
        arena,
        withinArena(arena, target.pos, 280),
        angleToPlayer,
        5,
        180,
        120,
        116,
        166,
        0.72,
        0.18,
      );
      telegraphs.push(
        ...createSequentialCircleTrail(
          boss,
          arena,
          withinArena(arena, target.pos, 280),
          angleToPlayer + Math.PI / 2,
          4,
          180,
          80,
          108,
          154,
          1.18,
          0.18,
        ),
      );
      return attackEmission(attackId, telegraphs);
    }

    case 'executioner_cleave':
      return attackEmission(attackId, [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 980, boss.pos.y + Math.sin(angleToPlayer) * 980, angleToPlayer, 2450, 240, 210, true)]);
    case 'executioner_lockon': {
      const baseCorner = {
        x: target.pos.x - Math.cos(angleToPlayer) * 260 - Math.cos(angleToPlayer + Math.PI / 2) * 260,
        y: target.pos.y - Math.sin(angleToPlayer) * 260 - Math.sin(angleToPlayer + Math.PI / 2) * 260,
      };
      return attackEmission(attackId, createLetterLPattern(
        boss,
        arena,
        baseCorner,
        angleToPlayer,
        780,
        920,
        158,
        188,
        0.8,
        true,
      ));
    }
    case 'executioner_cross':
      return createExecutionerXStrike(boss, arena, target, angleToPlayer, attackId);
    case 'executioner_fan_drive':
      return attackEmission(attackId, staggerTelegraphs([-0.34, -0.12, 0.12, 0.34].map((delta) =>
        lane(boss, boss.pos.x + Math.cos(angleToPlayer + delta) * 920, boss.pos.y + Math.sin(angleToPlayer + delta) * 920, angleToPlayer + delta, 2200, 180, 194, true)
      ), 0.7, 0.16));
    case 'executioner_judgement_ring': {
      const telegraphs = createRingAroundPoint(
        boss,
        arena,
        withinArena(arena, target.pos, 320),
        300,
        122,
        176,
        0.84,
        6,
        0.1,
      );
      telegraphs.push(lane(boss, target.pos.x, target.pos.y, angleToPlayer, 1680, 142, 184, true, 1.44));
      return attackEmission(attackId, telegraphs, { allowComboFollowup: false });
    }
    case 'executioner_box_cleave': {
      const telegraphs = createLetterLPattern(
        boss,
        arena,
        {
          x: target.pos.x - 300,
          y: target.pos.y - 260,
        },
        0,
        760,
        760,
        136,
        188,
        0.74,
        false,
      );
      telegraphs.push(
        lane(boss, target.pos.x + 80, target.pos.y - 260, Math.PI / 2, 760, 136, 188, true, 1.06),
        lane(boss, target.pos.x - 300, target.pos.y + 80, 0, 760, 136, 188, true, 1.32),
      );
      return attackEmission(attackId, telegraphs);
    }
    case 'executioner_falling_axes': {
      const awakened = !!boss.__bossRushAwakened;
      const offsets = awakened ? [-360, -180, 0, 180, 360] : [-270, 0, 270, 540];
      return attackEmission(attackId, offsets.map((offset, index) =>
        createOffsetLane(
          boss,
          arena,
          Math.PI / 2,
          0,
          offset,
          arena.height * 0.9,
          awakened ? 102 : 96,
          awakened ? 188 : 178,
          0.74 + index * 0.14,
          true,
        )
      ));
    }
    case 'executioner_pursuit_lines': {
      const telegraphs: BossRushTelegraph[] = [];
      const normal = Vector.fromAngle(angleToPlayer + Math.PI / 2);
      [-180, 0, 180].forEach((offset, index) => {
        telegraphs.push(
          lane(
            boss,
            target.pos.x + normal.x * offset,
            target.pos.y + normal.y * offset,
            angleToPlayer,
            1780,
            96,
            172,
            false,
            0.68 + index * 0.16,
          )
        );
      });
      telegraphs.push(
        lane(boss, target.pos.x, target.pos.y, angleToPlayer + Math.PI / 2, 1480, 90, 162, false, 1.3),
      );
      return attackEmission(attackId, telegraphs);
    }
    case 'executioner_corner_purge': {
      const telegraphs = [
        ...createLetterLPattern(boss, arena, { x: target.pos.x - 340, y: target.pos.y - 320 }, angleToPlayer, 720, 820, 142, 186, 0.78, true),
        ...createLetterLPattern(boss, arena, { x: target.pos.x + 340, y: target.pos.y + 320 }, angleToPlayer + Math.PI, 720, 820, 142, 186, 1.12, true),
      ];
      return attackEmission(attackId, telegraphs, { allowComboFollowup: false });
    }

    case 'singularity_lane_chain':
      return attackEmission(attackId, [-0.34, 0, 0.34].map((delta, index) => lane(
        boss,
        center.x + Math.cos(angleToPlayer + delta) * 220,
        center.y + Math.sin(angleToPlayer + delta) * 220,
        angleToPlayer + delta,
        arena.width * 0.86,
        164,
        192,
        false,
        0.76 + index * 0.18,
      )));
    case 'singularity_gravity':
      target.vel = Vector.add(target.vel, Vector.mult(Vector.normalize(Vector.sub(boss.pos, target.pos)), 4.4));
      return attackEmission(attackId, [
        circle(boss, target.pos.x, target.pos.y, 200, 188),
        circle(boss, target.pos.x + 260, target.pos.y - 160, 160, 158),
        circle(boss, target.pos.x - 260, target.pos.y + 160, 160, 158),
      ]);
    case 'singularity_spiral': {
      const telegraphs: BossRushTelegraph[] = [];
      for (let i = 0; i < 6; i += 1) {
        const theta = angleToPlayer + i * 0.66;
        const distance = 220 + i * 120;
        telegraphs.push(circle(boss, boss.pos.x + Math.cos(theta) * distance, boss.pos.y + Math.sin(theta) * distance, 140 + i * 8, 166));
      }
      return attackEmission(attackId, telegraphs);
    }
    case 'singularity_rapid_chain': {
      const awakened = !!boss.__bossRushAwakened;
      return attackEmission(attackId, [
        ...createLetterZPattern(
          boss,
          arena,
          center,
          angleToPlayer + Math.PI / 8,
          arena.width * (awakened ? 0.82 : 0.74),
          awakened ? 980 : 860,
          awakened ? 154 : 142,
          awakened ? 192 : 184,
          0.72,
          true,
        ),
        {
          ...cone(boss, angleToPlayer, 1440, Math.PI / 1.9, 178),
          delaySeconds: awakened ? 1.18 : 1.32,
        },
      ], { allowComboFollowup: false });
    }
    case 'singularity_event_horizon': {
      const awakened = !!boss.__bossRushAwakened;
      return attackEmission(attackId, [
        {
          ...arc(boss, 1540, 760, angleToPlayer, Math.PI * 1.7, 194),
          delaySeconds: 0.78,
        },
        ...createLetterOPattern(
          boss,
          arena,
          center,
          awakened ? 920 : 780,
          awakened ? 920 : 780,
          awakened ? 144 : 132,
          awakened ? 182 : 170,
          0.88,
          awakened ? 10 : 8,
        ),
        delayedCircle(boss, center.x, center.y, awakened ? 300 : 280, 176, awakened ? 1.54 : 1.68),
      ], { suppressPassiveUntil: awakened ? 2.1 : 1.95, allowComboFollowup: false });
    }
    case 'singularity_cross_maze': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs: BossRushTelegraph[] = [];
      const spacing = awakened ? 220 : 280;
      [-spacing, 0, spacing].forEach((offset, index) => {
        telegraphs.push(
          createOffsetLane(boss, arena, angleToPlayer + Math.PI / 4, 0, offset, 1700, awakened ? 92 : 84, awakened ? 182 : 170, 0.68 + index * 0.16, true),
          createOffsetLane(boss, arena, angleToPlayer - Math.PI / 4, 0, offset, 1700, awakened ? 92 : 84, awakened ? 182 : 170, 0.9 + index * 0.16, true),
        );
      });
      return attackEmission(attackId, telegraphs, { allowComboFollowup: false });
    }
    case 'singularity_orbit_seal': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs = [
        ...createRingAroundPoint(
          boss,
          arena,
          target.pos,
          awakened ? 340 : 300,
          awakened ? 120 : 112,
          awakened ? 182 : 170,
          0.82,
          awakened ? 7 : 6,
          0.08,
          angleToPlayer * 0.4,
        ),
        {
          ...arc(boss, awakened ? 1480 : 1380, awakened ? 640 : 560, angleToPlayer, Math.PI * 1.35, awakened ? 188 : 178),
          delaySeconds: 1.36,
        },
      ];
      return attackEmission(attackId, telegraphs, { allowComboFollowup: false });
    }
    case 'singularity_gravity_grid': {
      const awakened = !!boss.__bossRushAwakened;
      const telegraphs = [
        ...createLetterOPattern(
          boss,
          arena,
          center,
          awakened ? 760 : 640,
          awakened ? 760 : 640,
          awakened ? 116 : 108,
          awakened ? 174 : 164,
          0.8,
          awakened ? 10 : 8,
        ),
        createOffsetLane(boss, arena, 0, 0, 0, arena.width * 0.82, awakened ? 110 : 100, awakened ? 184 : 174, 1.28, true),
        createOffsetLane(boss, arena, Math.PI / 2, 0, 0, arena.height * 0.82, awakened ? 110 : 100, awakened ? 184 : 174, 1.4, true),
      ];
      return attackEmission(attackId, telegraphs, { allowComboFollowup: false });
    }
    case 'singularity_starfall': {
      const telegraphs = [
        ...createSequentialCircleTrail(
          boss,
          arena,
          withinArena(arena, target.pos, 320),
          angleToPlayer,
          6,
          170,
          140,
          112,
          168,
          0.7,
          0.14,
        ),
        delayedCircle(boss, target.pos.x, target.pos.y, 154, 182, 1.42),
      ];
      return attackEmission(attackId, telegraphs);
    }
    default:
      return attackEmission(attackId, [lane(boss, boss.pos.x + Math.cos(angleToPlayer) * 800, boss.pos.y + Math.sin(angleToPlayer) * 800, angleToPlayer, 1800, 160, 150)]);
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
    const sequenceId = nextSequenceId('reactor-passive');
    const telegraphs = withSequence(spawnPassiveHazardField(
      arena,
      boss,
      target,
      awakened ? 5 : 4,
      awakened ? 176 : 160,
      awakened ? 150 : 138,
      awakened ? 4.25 : 4.9,
    ), sequenceId);
    telegraphs.push(
      ...telegraphs.map((entry) => createHoverMarker(boss, entry, 54, 0.18))
    );
    return telegraphs;
  }

  const sequenceId = nextSequenceId('singularity-passive');
  const telegraphs = withSequence(spawnPassiveHazardField(
    arena,
    boss,
    target,
    awakened ? 6 : 5,
    awakened ? 168 : 152,
    awakened ? 164 : 148,
    awakened ? 4.05 : 4.6,
  ), sequenceId);
  telegraphs.push(
    ...telegraphs.map((entry, index) => createHoverMarker(boss, entry, 46 + (index % 2) * 8, 0.16))
  );
  return telegraphs;
};

