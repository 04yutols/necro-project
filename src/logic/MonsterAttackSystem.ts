import type { BaseStats, ElementType, MonsterData } from '../types/game';

export interface MonsterAttackProfile {
  stats: BaseStats;
  element: ElementType;
  spiritCoreName?: string;
  spiritCoreAtkMultiplier: number;
}

export interface MonsterAttackProfileOptions {
  awakened?: boolean;
}

export function getSpiritCoreAtkMultiplier(monster: Pick<MonsterData, 'spiritCore'>): number {
  const multiplier = monster.spiritCore?.atkMultiplier;
  if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier <= 0) {
    return 1;
  }
  return multiplier;
}

export function calculateMonsterAttackProfile(
  monster: MonsterData,
  options: MonsterAttackProfileOptions = {},
): MonsterAttackProfile {
  const coreMultiplier = getSpiritCoreAtkMultiplier(monster);
  const awakenedMultiplier = options.awakened ? 1.5 : 1;
  const atk = Math.max(1, Math.floor(monster.stats.atk * coreMultiplier * awakenedMultiplier));

  return {
    stats: {
      ...monster.stats,
      atk,
    },
    element: monster.spiritCore?.element ?? 'NONE',
    spiritCoreName: monster.spiritCore?.name,
    spiritCoreAtkMultiplier: coreMultiplier,
  };
}
