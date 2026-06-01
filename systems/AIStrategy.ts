import { Vector2 } from '../types';
import type { IAITank } from '../services/EnemyAITanks';

export interface IAIStrategy {
  update(bot: IAITank, dt: number): Vector2;
}
