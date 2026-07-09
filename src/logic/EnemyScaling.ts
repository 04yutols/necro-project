import type { EnemyData, EnemyStatScale } from '../types/game';

const ENEMY_STAT_SCALE_KEYS = ['hp', 'atk', 'def'] as const;

function scaleFactor(statScale: EnemyStatScale | undefined, key: keyof EnemyStatScale): number {
  const value = statScale?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
}

export function applyEnemyStatScale(enemy: EnemyData, statScale?: EnemyStatScale): EnemyData {
  const stats = { ...enemy.stats };

  for (const key of ENEMY_STAT_SCALE_KEYS) {
    stats[key] = Math.floor(stats[key] * scaleFactor(statScale, key));
  }

  return {
    ...enemy,
    stats,
    resistances: { ...enemy.resistances },
    weaknesses: [...enemy.weaknesses],
    gimmicks: enemy.gimmicks?.map(gimmick => ({ ...gimmick })),
    necromance: enemy.necromance ? {
      ...enemy.necromance,
      allyStats: enemy.necromance.allyStats ? { ...enemy.necromance.allyStats } : undefined,
      skillIds: enemy.necromance.skillIds ? [...enemy.necromance.skillIds] : undefined,
    } : undefined,
    dropTable: enemy.dropTable.map(drop => ({ ...drop })),
    battle: enemy.battle ? { ...enemy.battle } : undefined,
  };
}
