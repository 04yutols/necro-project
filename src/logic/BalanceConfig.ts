import type { BaseStats } from '../types/game';

/**
 * Shared level-1 stats before job modifiers.
 * Keep local mock initialization and server character creation on the same scale.
 */
export const INITIAL_PLAYER_BASE_STATS: BaseStats = {
  hp: 30,
  atk: 4,
  def: 4,
  spd: 100,
  critRate: 5,
  critDmg: 150,
  effectHit: 0,
  effectRes: 0,
};
