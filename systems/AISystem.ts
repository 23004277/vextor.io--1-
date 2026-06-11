import { GameMode, Vector2 } from '../types';
import type { IAITank, IGameEngine } from '../services/EnemyAITanks';
import { MovementSystem } from '../services/systems/MovementSystem';
import type { IAIStrategy } from './AIStrategy';
import { TDMAIStrategy } from './TDMAIStrategy';
import { FFAAIStrategy } from './FFAAIStrategy';

const ZERO: Vector2 = { x: 0, y: 0 };

/**
 * Thin strategy router for the lightweight per-bot AI strategies.
 *
 * NOTE:
 * Your uploaded GameEngine also references a separate `services/systems/AISystem`
 * with `beginTick/updateBot/cleanupCaches`. Do not overwrite that file with this
 * router unless this is the exact file your import points at.
 */
export class AISystem {
  private brain: IAIStrategy | null = null;
  private engine: IGameEngine | null = null;
  private mode: GameMode | null = null;
  private readonly movement: MovementSystem;

  constructor(engine?: IGameEngine, mode?: GameMode, movement?: MovementSystem) {
    this.movement = movement ?? new MovementSystem();
    if (engine && mode !== undefined) this.configure(engine, mode);
  }

  configure(engine: IGameEngine, mode: GameMode): void {
    const needsNewBrain = this.engine !== engine || this.mode !== mode || this.brain === null;
    this.engine = engine;
    this.mode = mode;
    if (!needsNewBrain) return;

    const dominionMode = (GameMode as unknown as Record<string, GameMode>).DOMINION;
    const useTeamBrain = mode === GameMode.TEAMS || (dominionMode !== undefined && mode === dominionMode);
    this.brain = useTeamBrain
      ? new TDMAIStrategy(engine, this.movement)
      : new FFAAIStrategy(engine, this.movement);
  }

  update(bot: IAITank, dt: number): Vector2 {
    if (!this.brain) {
      bot.aiShooting = false;
      bot.aiTargetId = null;
      return ZERO;
    }
    return this.brain.update(bot, dt);
  }
}
