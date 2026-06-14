import type { EnemyData, MonsterData } from '../types/game';

export const DEFAULT_MONSTER_MAX_ENERGY = 30;

function normalizeEnergy(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function resolveMonsterMaxEnergy(monster: Partial<Pick<MonsterData, 'maxEnergy'>>): number {
  return Math.max(1, normalizeEnergy(monster.maxEnergy, DEFAULT_MONSTER_MAX_ENERGY));
}

export function resolveMonsterCurrentEnergy(monster: Partial<Pick<MonsterData, 'currentEnergy' | 'maxEnergy'>>): number {
  const maxEnergy = resolveMonsterMaxEnergy(monster);
  return Math.min(maxEnergy, normalizeEnergy(monster.currentEnergy, maxEnergy));
}

export function hydrateMonsterEnergy<T extends Partial<Pick<MonsterData, 'currentEnergy' | 'maxEnergy'>>>(
  monster: T,
): T & Pick<MonsterData, 'currentEnergy' | 'maxEnergy'> {
  const maxEnergy = resolveMonsterMaxEnergy(monster);
  return {
    ...monster,
    currentEnergy: Math.min(maxEnergy, normalizeEnergy(monster.currentEnergy, maxEnergy)),
    maxEnergy,
  };
}

export function resolveNecromanceMaxEnergy(enemy: Pick<EnemyData, 'necromance'>): number {
  return Math.max(1, normalizeEnergy(enemy.necromance?.allyMaxEnergy, DEFAULT_MONSTER_MAX_ENERGY));
}
