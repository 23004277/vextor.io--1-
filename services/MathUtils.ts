import { Vector2 } from '../types';

export const add = (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x + v2.x, y: v1.y + v2.y });
export const sub = (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x - v2.x, y: v1.y - v2.y });
export const mult = (v: Vector2, n: number): Vector2 => ({ x: v.x * n, y: v.y * n });
export const div = (v: Vector2, n: number): Vector2 => ({ x: v.x / n, y: v.y / n });
export const mag = (v: Vector2): number => Math.sqrt(v.x * v.x + v.y * v.y);
export const normalize = (v: Vector2): Vector2 => {
  const m = mag(v);
  return m === 0 ? { x: 0, y: 0 } : div(v, m);
};
export const dist = (v1: Vector2, v2: Vector2): number => mag(sub(v1, v2));
export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
export const limit = (v: Vector2, max: number): Vector2 => {
    const m = mag(v);
    if (m > max) {
        return mult(div(v, m), max);
    }
    return v;
};
export const dot = (v1: Vector2, v2: Vector2): number => v1.x * v2.x + v1.y * v2.y;
export const fromAngle = (angle: number): Vector2 => ({ x: Math.cos(angle), y: Math.sin(angle) });
export const magSq = (v: Vector2): number => v.x * v.x + v.y * v.y;
export const distSq = (v1: Vector2, v2: Vector2): number => {
  const dx = v1.x - v2.x;
  const dy = v1.y - v2.y;
  return dx * dx + dy * dy;
};

// Deterministic integer hash and RNG in [0,1), suitable for tick-seeded AI behavior.
export const hashUInt = (x: number): number => {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
};

export const seededRandom01 = (seed: number): number => {
  const h = hashUInt(seed);
  return (h & 0x7fffffff) / 0x80000000;
};

export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
export const randomPos = (width: number, height: number): Vector2 => ({
  x: randomRange(0, width),
  y: randomRange(0, height),
});

export const formatCompactNumber = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) {
    const n = value / 1_000_000_000_000;
    return `${Number(n.toFixed(n >= 10 ? 0 : 1))}t`;
  }
  if (abs >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    return `${Number(n.toFixed(n >= 10 ? 0 : 1))}b`;
  }
  if (abs >= 1_000_000) {
    const n = value / 1_000_000;
    return `${Number(n.toFixed(n >= 10 ? 0 : 1))}m`;
  }
  if (abs >= 1_000) {
    const n = value / 1_000;
    return `${Number(n.toFixed(n >= 10 ? 0 : 1))}k`;
  }
  return `${Math.round(value)}`;
};

export const formatScoreValue = (value: number, compact: boolean): string => {
  if (compact) return formatCompactNumber(value);
  return Math.round(value).toLocaleString();
};
