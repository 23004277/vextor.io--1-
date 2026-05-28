import { Vector2 } from '../../types';
import * as Vector from '../MathUtils';

export class MovementSystem {
  private readonly epsilon = 0.000001;

  blendSteering(base: Vector2, add: Vector2, weight: number): Vector2 {
    return {
      x: base.x + add.x * weight,
      y: base.y + add.y * weight,
    };
  }

  seek(from: Vector2, to: Vector2): Vector2 {
    return Vector.normalize(Vector.sub(to, from));
  }

  seekForce(from: Vector2, to: Vector2): Vector2 {
    return this.seek(from, to);
  }

  fleeForce(from: Vector2, threat: Vector2): Vector2 {
    return Vector.normalize(Vector.sub(from, threat));
  }

  arrive(from: Vector2, to: Vector2, slowRadius: number): Vector2 {
    const toTarget = Vector.sub(to, from);
    const d2 = Vector.magSq(toTarget);
    if (d2 <= this.epsilon) return { x: 0, y: 0 };
    const d = Math.sqrt(d2);
    const dir = Vector.mult(toTarget, 1 / d);
    const speedScale = Math.min(1, d / Math.max(1, slowRadius));
    return Vector.mult(dir, speedScale);
  }

  arriveForce(from: Vector2, to: Vector2, slowRadius: number, stopEpsilon: number = 12): Vector2 {
    const toTarget = Vector.sub(to, from);
    const d2 = Vector.magSq(toTarget);
    if (d2 <= stopEpsilon * stopEpsilon) return { x: 0, y: 0 };
    return this.arrive(from, to, slowRadius);
  }

  // Deterministic wander helper: caller controls jitter via seeded scalar in [0, 1].
  wanderForce(
    pos: Vector2,
    velocity: Vector2,
    wanderAngle: number,
    circleDistance: number,
    circleRadius: number,
    jitterUnit: number
  ): { force: Vector2; nextAngle: number } {
    const dir = Vector.magSq(velocity) > this.epsilon ? Vector.normalize(velocity) : { x: 1, y: 0 };
    const center = Vector.add(pos, Vector.mult(dir, circleDistance));
    const jitterDelta = (jitterUnit - 0.5) * 0.7;
    const nextAngle = wanderAngle + jitterDelta;
    const displacement = {
      x: Math.cos(nextAngle) * circleRadius,
      y: Math.sin(nextAngle) * circleRadius,
    };
    const target = Vector.add(center, displacement);
    return { force: this.seekForce(pos, target), nextAngle };
  }

  separation(self: Vector2, allies: Array<{ pos: Vector2 }>, radius: number): Vector2 {
    const r2 = radius * radius;
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < allies.length; i++) {
      const a = allies[i];
      const dx = self.x - a.pos.x;
      const dy = self.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= this.epsilon || d2 > r2) continue;
      const inv = 1 / d2;
      fx += dx * inv;
      fy += dy * inv;
    }
    const out = { x: fx, y: fy };
    return Vector.magSq(out) > 0 ? Vector.normalize(out) : out;
  }

  separationForce(self: Vector2, allies: Array<{ pos: Vector2 }>, radius: number): Vector2 {
    return this.separation(self, allies, radius);
  }

  boundaryAvoidanceForce(
    pos: Vector2,
    velocity: Vector2,
    worldWidth: number,
    worldHeight: number,
    padding: number = 240,
    lookAhead: number = 120
  ): Vector2 {
    const velDir = Vector.magSq(velocity) > this.epsilon ? Vector.normalize(velocity) : { x: 0, y: 0 };
    const feeler = {
      x: pos.x + velDir.x * lookAhead,
      y: pos.y + velDir.y * lookAhead,
    };

    let fx = 0;
    let fy = 0;
    const leftEdge = padding;
    const rightEdge = worldWidth - padding;
    const topEdge = padding;
    const bottomEdge = worldHeight - padding;

    if (feeler.x < leftEdge) fx += (leftEdge - feeler.x) / Math.max(1, padding);
    if (feeler.x > rightEdge) fx -= (feeler.x - rightEdge) / Math.max(1, padding);
    if (feeler.y < topEdge) fy += (topEdge - feeler.y) / Math.max(1, padding);
    if (feeler.y > bottomEdge) fy -= (feeler.y - bottomEdge) / Math.max(1, padding);

    const out = { x: fx, y: fy };
    return Vector.magSq(out) > this.epsilon ? Vector.normalize(out) : out;
  }

  composeSteering(forces: Vector2[], weights: number[], maxMagnitude: number): Vector2 {
    let out = { x: 0, y: 0 };
    const len = Math.min(forces.length, weights.length);
    for (let i = 0; i < len; i++) {
      out = this.blendSteering(out, forces[i], weights[i]);
    }
    return Vector.limit(out, maxMagnitude);
  }

  composeSteeringWithPriority(
    avoid: Vector2,
    separate: Vector2,
    goal: Vector2,
    maxMagnitude: number
  ): Vector2 {
    const avoidMagSq = Vector.magSq(avoid);
    if (avoidMagSq > 0.15) {
      return this.composeSteering([avoid, separate, goal], [1.65, 0.7, 0.4], maxMagnitude);
    }
    return this.composeSteering([avoid, separate, goal], [1.1, 0.95, 1.0], maxMagnitude);
  }
}
