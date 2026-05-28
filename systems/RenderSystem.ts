import type { Container } from 'pixi.js';
import { EntityManager } from '../services/EntityManager';

export class RenderSystem {
  constructor(private readonly stage: Container) {}

  update(_dt: number, _entities: EntityManager): void {
    // Migration scaffold:
    // Stage-based rendering orchestration lands here while
    // visual parity is ported from Canvas2D in phases.
    void this.stage;
  }
}

