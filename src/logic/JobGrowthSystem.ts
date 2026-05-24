import type { BaseStats, JobData } from '../types/game';

export type GrowthStatKey = 'hp' | 'atk' | 'def';

export const BASE_STAT_GROWTH_PER_LEVEL: Record<GrowthStatKey, number> = {
  hp: 40,
  atk: 6,
  def: 4,
};

const DEFAULT_GROWTH_MODIFIERS: Record<GrowthStatKey, number> = {
  hp: 1,
  atk: 1,
  def: 1,
};

function normalizeModifier(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 1;
  return value;
}

export function normalizeJobGrowthModifiers(job?: Pick<JobData, 'growthModifiers'> | null): Record<GrowthStatKey, number> {
  return {
    hp: normalizeModifier(job?.growthModifiers?.hp ?? DEFAULT_GROWTH_MODIFIERS.hp),
    atk: normalizeModifier(job?.growthModifiers?.atk ?? DEFAULT_GROWTH_MODIFIERS.atk),
    def: normalizeModifier(job?.growthModifiers?.def ?? DEFAULT_GROWTH_MODIFIERS.def),
  };
}

export function calculateJobGrowthIncrements(
  job: Pick<JobData, 'growthModifiers'> | null | undefined,
  levelsGained: number,
): Pick<BaseStats, GrowthStatKey> {
  const gained = Math.max(0, Math.floor(levelsGained));
  const modifiers = normalizeJobGrowthModifiers(job);
  return {
    hp: Math.round(BASE_STAT_GROWTH_PER_LEVEL.hp * modifiers.hp * gained),
    atk: Math.round(BASE_STAT_GROWTH_PER_LEVEL.atk * modifiers.atk * gained),
    def: Math.round(BASE_STAT_GROWTH_PER_LEVEL.def * modifiers.def * gained),
  };
}
