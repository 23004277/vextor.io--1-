import { GameMode, Team, Vector2 } from '../../types';
import * as Vector from '../MathUtils';

type WeightedForce = {
  force: Vector2;
  weight: number;
};

/**
 * Steering/boid helper used by AISystem.
 *
 * This version is intentionally defensive:
 * - no NaN propagation from zero-length vectors
 * - no broken wall avoidance when world dimensions/padding are weird
 * - smoother arrival/flee behaviour
 * - safer weighted steering composition
 *
 * Keep this class pure. It should never mutate entities directly.
 */
export class MovementSystem {
  private readonly epsilon = 0.000001;
  private readonly tinyDistanceSq = 0.000001;
  private readonly maxReturnedForce = 10;

  blendSteering(base: Vector2, add: Vector2, weight: number): Vector2 {
    const b = this.cleanVector(base);
    const a = this.cleanVector(add);
    const w = this.cleanNumber(weight, 0);

    return this.capExtremeForce({
      x: b.x + a.x * w,
      y: b.y + a.y * w,
    });
  }

  seek(from: Vector2, to: Vector2): Vector2 {
    return this.safeNormalize(Vector.sub(this.cleanVector(to), this.cleanVector(from)));
  }

  seekForce(from: Vector2, to: Vector2): Vector2 {
    return this.seek(from, to);
  }

  fleeForce(from: Vector2, threat: Vector2): Vector2 {
    return this.safeNormalize(Vector.sub(this.cleanVector(from), this.cleanVector(threat)));
  }

  pursuitForce(
    from: Vector2,
    targetPos: Vector2,
    targetVel: Vector2,
    predictionSeconds: number = 0.55,
    maxPredictionSeconds: number = 0.95
  ): Vector2 {
    const start = this.cleanVector(from);
    const target = this.cleanVector(targetPos);
    const velocity = this.cleanVector(targetVel);
    const distance = Math.sqrt(Math.max(this.tinyDistanceSq, Vector.distSq(start, target)));
    const speed = Math.sqrt(Vector.magSq(velocity));
    const prediction = this.clamp(
      this.cleanNumber(predictionSeconds, 0.55) + Math.min(0.22, distance / 2400) + speed * 0.018,
      0,
      Math.max(0, this.cleanNumber(maxPredictionSeconds, 0.95))
    );
    const futureTarget = {
      x: target.x + velocity.x * prediction,
      y: target.y + velocity.y * prediction,
    };
    return this.seekForce(start, futureTarget);
  }

  evadeForce(
    from: Vector2,
    threatPos: Vector2,
    threatVel: Vector2,
    predictionSeconds: number = 0.45,
    maxPredictionSeconds: number = 0.85
  ): Vector2 {
    const start = this.cleanVector(from);
    const threat = this.cleanVector(threatPos);
    const velocity = this.cleanVector(threatVel);
    const distance = Math.sqrt(Math.max(this.tinyDistanceSq, Vector.distSq(start, threat)));
    const speed = Math.sqrt(Vector.magSq(velocity));
    const prediction = this.clamp(
      this.cleanNumber(predictionSeconds, 0.45) + Math.min(0.18, distance / 2600) + speed * 0.016,
      0,
      Math.max(0, this.cleanNumber(maxPredictionSeconds, 0.85))
    );
    const futureThreat = {
      x: threat.x + velocity.x * prediction,
      y: threat.y + velocity.y * prediction,
    };
    return this.fleeForce(start, futureThreat);
  }

  maintainDistanceForce(from: Vector2, target: Vector2, desiredDistance: number, tolerance: number = 32): Vector2 {
    const start = this.cleanVector(from);
    const destination = this.cleanVector(target);
    const desired = Math.max(1, this.cleanNumber(desiredDistance, 1));
    const band = Math.max(0, this.cleanNumber(tolerance, 32));
    const offset = Vector.sub(destination, start);
    const distanceSq = Vector.magSq(offset);
    if (distanceSq <= this.tinyDistanceSq) return this.zero();

    const distance = Math.sqrt(distanceSq);
    const dir = Vector.mult(offset, 1 / distance);
    const delta = distance - desired;

    if (Math.abs(delta) <= band) return this.zero();

    const urgency = this.clamp((Math.abs(delta) - band) / Math.max(24, desired * 0.42), 0, 1);
    const eased = urgency * urgency * (3 - 2 * urgency);
    const sign = delta > 0 ? 1 : -1;
    return this.capExtremeForce({ x: dir.x * eased * sign, y: dir.y * eased * sign });
  }

  orbitForce(
    from: Vector2,
    targetPos: Vector2,
    targetVel: Vector2,
    desiredDistance: number,
    strafeDir: 1 | -1,
    radialWeight: number = 0.78,
    tangentWeight: number = 1
  ): Vector2 {
    const pursuit = this.pursuitForce(from, targetPos, targetVel, 0.42, 0.82);
    const target = this.cleanVector(targetPos);
    const toTarget = this.seekForce(from, target);
    if (Vector.magSq(toTarget) <= this.epsilon) return pursuit;

    const tangent = {
      x: -toTarget.y * (strafeDir === -1 ? -1 : 1),
      y: toTarget.x * (strafeDir === -1 ? -1 : 1),
    };
    const radial = this.maintainDistanceForce(from, target, desiredDistance, Math.max(20, desiredDistance * 0.12));
    return this.composeSteering([tangent, radial, pursuit], [tangentWeight, radialWeight, 0.32], 1.4);
  }

  arrive(from: Vector2, to: Vector2, slowRadius: number): Vector2 {
    const start = this.cleanVector(from);
    const destination = this.cleanVector(to);
    const toTarget = Vector.sub(destination, start);
    const distanceSq = Vector.magSq(toTarget);

    if (distanceSq <= this.tinyDistanceSq) return this.zero();

    const distance = Math.sqrt(distanceSq);
    const dir = Vector.mult(toTarget, 1 / distance);
    const radius = Math.max(1, this.cleanNumber(slowRadius, 1));

    // Smoothstep creates a cleaner braking curve than a raw linear clamp.
    const t = this.clamp(distance / radius, 0, 1);
    const speedScale = t * t * (3 - 2 * t);

    return this.capExtremeForce(Vector.mult(dir, speedScale));
  }

  arriveForce(from: Vector2, to: Vector2, slowRadius: number, stopEpsilon: number = 12): Vector2 {
    const start = this.cleanVector(from);
    const destination = this.cleanVector(to);
    const stop = Math.max(0, this.cleanNumber(stopEpsilon, 12));
    const toTarget = Vector.sub(destination, start);

    if (Vector.magSq(toTarget) <= stop * stop) return this.zero();
    return this.arrive(start, destination, slowRadius);
  }

  /**
   * Deterministic wander helper.
   * The caller controls jitter using a seeded value in [0, 1].
   */
  wanderForce(
    pos: Vector2,
    velocity: Vector2,
    wanderAngle: number,
    circleDistance: number,
    circleRadius: number,
    jitterUnit: number
  ): { force: Vector2; nextAngle: number } {
    const position = this.cleanVector(pos);
    const vel = this.cleanVector(velocity);
    const forward = Vector.magSq(vel) > this.epsilon ? this.safeNormalize(vel) : { x: 1, y: 0 };

    const distance = Math.max(0, this.cleanNumber(circleDistance, 52));
    const radius = Math.max(0, this.cleanNumber(circleRadius, 36));
    const jitter = this.clamp(this.cleanNumber(jitterUnit, 0.5), 0, 1);

    const currentAngle = this.cleanNumber(wanderAngle, 0);
    const jitterDelta = (jitter - 0.5) * 0.7;
    const nextAngle = this.wrapAngle(currentAngle + jitterDelta);

    const circleCenter = Vector.add(position, Vector.mult(forward, distance));
    const displacement = {
      x: Math.cos(nextAngle) * radius,
      y: Math.sin(nextAngle) * radius,
    };

    const target = Vector.add(circleCenter, displacement);
    return {
      force: this.seekForce(position, target),
      nextAngle,
    };
  }

  separation(self: Vector2, allies: Array<{ pos: Vector2 }>, radius: number): Vector2 {
    const origin = this.cleanVector(self);
    const safeRadius = Math.max(1, this.cleanNumber(radius, 1));
    const radiusSq = safeRadius * safeRadius;

    let fx = 0;
    let fy = 0;
    let count = 0;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      if (!ally || !ally.pos) continue;

      const pos = this.cleanVector(ally.pos);
      const dx = origin.x - pos.x;
      const dy = origin.y - pos.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= this.tinyDistanceSq || distanceSq > radiusSq) continue;

      const distance = Math.sqrt(distanceSq);
      const closeness = 1 - this.clamp(distance / safeRadius, 0, 1);
      const weight = closeness / Math.max(distance, 1);

      fx += dx * weight;
      fy += dy * weight;
      count++;
    }

    if (count === 0) return this.zero();
    return this.safeNormalize({ x: fx, y: fy });
  }

  separationForce(self: Vector2, allies: Array<{ pos: Vector2 }>, radius: number): Vector2 {
    return this.separation(self, allies, radius);
  }

  cohesionForce(self: Vector2, allies: Array<{ pos: Vector2 }>, maxRadius: number): Vector2 {
    const origin = this.cleanVector(self);
    const radius = Math.max(1, this.cleanNumber(maxRadius, 1));
    const radiusSq = radius * radius;

    let cx = 0;
    let cy = 0;
    let count = 0;

    for (let i = 0; i < allies.length; i++) {
      const ally = allies[i];
      if (!ally || !ally.pos) continue;

      const pos = this.cleanVector(ally.pos);
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= this.tinyDistanceSq || distanceSq > radiusSq) continue;

      cx += pos.x;
      cy += pos.y;
      count++;
    }

    if (count === 0) return this.zero();
    return this.seekForce(origin, { x: cx / count, y: cy / count });
  }

  alignmentForce(selfVel: Vector2, allyVels: Vector2[]): Vector2 {
    if (allyVels.length === 0) return this.zero();

    let vx = 0;
    let vy = 0;
    let count = 0;

    for (let i = 0; i < allyVels.length; i++) {
      const vel = this.cleanVector(allyVels[i]);
      if (Vector.magSq(vel) <= this.epsilon) continue;

      vx += vel.x;
      vy += vel.y;
      count++;
    }

    if (count === 0) return this.zero();

    const desired = this.safeNormalize({ x: vx / count, y: vy / count });
    const current = Vector.magSq(this.cleanVector(selfVel)) > this.epsilon
      ? this.safeNormalize(selfVel)
      : this.zero();

    const correction = Vector.sub(desired, current);
    return Vector.magSq(correction) > this.epsilon ? this.safeNormalize(correction) : this.zero();
  }

  boundaryAvoidanceForce(
    pos: Vector2,
    velocity: Vector2,
    worldWidth: number,
    worldHeight: number,
    padding: number = 240,
    lookAhead: number = 120
  ): Vector2 {
    const position = this.cleanVector(pos);
    const vel = this.cleanVector(velocity);

    const width = Math.max(1, this.cleanNumber(worldWidth, 1));
    const height = Math.max(1, this.cleanNumber(worldHeight, 1));
    const safePadding = this.clamp(this.cleanNumber(padding, 240), 1, Math.min(width, height) * 0.45);
    const safeLookAhead = Math.max(0, this.cleanNumber(lookAhead, 120));

    const velDir = Vector.magSq(vel) > this.epsilon ? this.safeNormalize(vel) : this.zero();
    const feeler = {
      x: position.x + velDir.x * safeLookAhead,
      y: position.y + velDir.y * safeLookAhead,
    };

    // Blend current position and look-ahead feeler so stationary tanks still avoid walls.
    const currentForce = this.edgeRepulsion(position, width, height, safePadding);
    const futureForce = this.edgeRepulsion(feeler, width, height, safePadding);

    return this.composeSteering(
      [currentForce, futureForce],
      [1.15, Vector.magSq(velDir) > this.epsilon ? 0.9 : 0.25],
      1
    );
  }

  safeZoneAvoidanceForce(
    pos: Vector2,
    team: Team,
    mode: GameMode,
    worldWidth: number,
    safeZoneWidth: number,
    warningRadius: number
  ): Vector2 {
    if (mode !== GameMode.TEAMS || team === Team.NONE) return this.zero();

    const position = this.cleanVector(pos);
    const width = Math.max(1, this.cleanNumber(worldWidth, 1));
    const zoneWidth = this.clamp(this.cleanNumber(safeZoneWidth, 0), 0, width * 0.5);
    const warning = Math.max(1, this.cleanNumber(warningRadius, 1));

    if (zoneWidth <= 0) return this.zero();

    let fx = 0;

    if (team === Team.BLUE) {
      // Blue should avoid pushing too deep into Red's base.
      const redWarningStart = width - zoneWidth - warning;
      if (position.x >= redWarningStart) {
        const t = this.clamp((position.x - redWarningStart) / warning, 0, 1.35);
        fx -= this.easeOut(t);
      }
    } else if (team === Team.RED) {
      // Red should avoid pushing too deep into Blue's base.
      const blueWarningEnd = zoneWidth + warning;
      if (position.x <= blueWarningEnd) {
        const t = this.clamp((blueWarningEnd - position.x) / warning, 0, 1.35);
        fx += this.easeOut(t);
      }
    }

    return Math.abs(fx) > this.epsilon ? this.safeNormalize({ x: fx, y: 0 }) : this.zero();
  }

  composeSteering(forces: Vector2[], weights: number[], maxMagnitude: number): Vector2 {
    let out = this.zero();
    const limit = Math.max(0, this.cleanNumber(maxMagnitude, 0));
    const len = Math.min(forces.length, weights.length);

    for (let i = 0; i < len; i++) {
      out = this.blendSteering(out, forces[i], weights[i]);
    }

    return limit > 0 ? Vector.limit(this.cleanVector(out), limit) : this.zero();
  }

  composeSteeringWithPriority(
    avoid: Vector2,
    separate: Vector2,
    goal: Vector2,
    maxMagnitude: number
  ): Vector2 {
    const avoidance = this.cleanVector(avoid);
    const separation = this.cleanVector(separate);
    const objective = this.cleanVector(goal);
    const avoidStrength = Vector.magSq(avoidance);

    // Emergency avoidance gets first say, but still lets the bot keep a tiny bit of intent.
    if (avoidStrength > 0.75) {
      return this.weightedCompose(
        [
          { force: avoidance, weight: 2.1 },
          { force: separation, weight: 0.8 },
          { force: objective, weight: 0.25 },
        ],
        maxMagnitude
      );
    }

    // Soft avoidance means walls/zones influence movement without making bots look drunk.
    if (avoidStrength > 0.08) {
      return this.weightedCompose(
        [
          { force: avoidance, weight: 1.55 },
          { force: separation, weight: 0.85 },
          { force: objective, weight: 0.65 },
        ],
        maxMagnitude
      );
    }

    return this.weightedCompose(
      [
        { force: avoidance, weight: 0.8 },
        { force: separation, weight: 0.95 },
        { force: objective, weight: 1.0 },
      ],
      maxMagnitude
    );
  }

  private weightedCompose(forces: WeightedForce[], maxMagnitude: number): Vector2 {
    let out = this.zero();

    for (let i = 0; i < forces.length; i++) {
      const item = forces[i];
      if (!item) continue;
      out = this.blendSteering(out, item.force, item.weight);
    }

    const limit = Math.max(0, this.cleanNumber(maxMagnitude, 0));
    return limit > 0 ? Vector.limit(this.cleanVector(out), limit) : this.zero();
  }

  private edgeRepulsion(pos: Vector2, width: number, height: number, padding: number): Vector2 {
    let fx = 0;
    let fy = 0;

    const left = padding;
    const right = width - padding;
    const top = padding;
    const bottom = height - padding;

    if (pos.x < left) {
      const t = this.clamp((left - pos.x) / padding, 0, 1.5);
      fx += this.easeOut(t);
    }

    if (pos.x > right) {
      const t = this.clamp((pos.x - right) / padding, 0, 1.5);
      fx -= this.easeOut(t);
    }

    if (pos.y < top) {
      const t = this.clamp((top - pos.y) / padding, 0, 1.5);
      fy += this.easeOut(t);
    }

    if (pos.y > bottom) {
      const t = this.clamp((pos.y - bottom) / padding, 0, 1.5);
      fy -= this.easeOut(t);
    }

    return Vector.magSq({ x: fx, y: fy }) > this.epsilon
      ? this.safeNormalize({ x: fx, y: fy })
      : this.zero();
  }

  private safeNormalize(v: Vector2): Vector2 {
    const clean = this.cleanVector(v);
    const magSq = Vector.magSq(clean);

    if (magSq <= this.tinyDistanceSq) return this.zero();

    const invMag = 1 / Math.sqrt(magSq);
    return this.capExtremeForce({
      x: clean.x * invMag,
      y: clean.y * invMag,
    });
  }

  private cleanVector(v: Vector2 | null | undefined): Vector2 {
    if (!v) return this.zero();

    return {
      x: this.cleanNumber(v.x, 0),
      y: this.cleanNumber(v.y, 0),
    };
  }

  private cleanNumber(value: number | null | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private capExtremeForce(v: Vector2): Vector2 {
    const clean = this.cleanVectorRaw(v);
    const magSq = clean.x * clean.x + clean.y * clean.y;
    const maxSq = this.maxReturnedForce * this.maxReturnedForce;

    if (magSq <= maxSq) return clean;
    return Vector.limit(clean, this.maxReturnedForce);
  }

  private cleanVectorRaw(v: Vector2): Vector2 {
    return {
      x: this.cleanNumber(v.x, 0),
      y: this.cleanNumber(v.y, 0),
    };
  }

  private zero(): Vector2 {
    return { x: 0, y: 0 };
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(max, Math.max(min, value));
  }

  private easeOut(t: number): number {
    const x = Math.max(0, t);
    return 1 - Math.pow(1 - Math.min(1, x), 2) + Math.max(0, x - 1) * 0.35;
  }

  private wrapAngle(angle: number): number {
    let out = angle;
    const twoPi = Math.PI * 2;

    while (out > Math.PI) out -= twoPi;
    while (out < -Math.PI) out += twoPi;

    return out;
  }
}
