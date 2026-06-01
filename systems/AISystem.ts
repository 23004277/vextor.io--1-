import { GameMode, Vector2 } from '../types';
import type { IAITank, IGameEngine } from '../services/EnemyAITanks';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAIStrategy } from './AIStrategy';
import { TDMAIStrategy } from './TDMAIStrategy';
import { FFAAIStrategy } from './FFAAIStrategy';

export class AISystem {
  private readonly brain: IAIStrategy;

  constructor(private readonly engine: IGameEngine, mode: GameMode, movement?: MovementSystem) {
    const movementSystem = movement ?? new MovementSystem();

    if (mode === GameMode.TEAMS) {
      this.brain = new TDMAIStrategy(engine, movementSystem);
    } else {
      this.brain = new FFAAIStrategy(engine, movementSystem);
    }
  }

  update(bot: IAITank, dt: number): Vector2 {
    return this.brain.update(bot, dt);
  }
}
