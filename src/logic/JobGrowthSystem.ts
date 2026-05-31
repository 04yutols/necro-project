import type { BaseStats, JobData } from '../types/game';

export type GrowthStatKey = 'hp' | 'atk' | 'def';

export const BASE_STAT_GROWTH_PER_LEVEL: Record<GrowthStatKey, number> = {
  hp: 3,
  atk: 0.5,
  def: 0.4,
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

function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.floor(level));
}

export function calculateCumulativeJobGrowth(
  job: Pick<JobData, 'growthModifiers'> | null | undefined,
  level: number,
): Pick<BaseStats, GrowthStatKey> {
  const gained = normalizeLevel(level) - 1;
  const modifiers = normalizeJobGrowthModifiers(job);
  return {
    hp: Math.round(BASE_STAT_GROWTH_PER_LEVEL.hp * modifiers.hp * gained),
    atk: Math.round(BASE_STAT_GROWTH_PER_LEVEL.atk * modifiers.atk * gained),
    def: Math.round(BASE_STAT_GROWTH_PER_LEVEL.def * modifiers.def * gained),
  };
}

export function calculateJobGrowthIncrements(
  job: Pick<JobData, 'growthModifiers'> | null | undefined,
  fromLevel: number,
  toLevel: number,
): Pick<BaseStats, GrowthStatKey> {
  const safeFromLevel = normalizeLevel(fromLevel);
  const safeToLevel = Math.max(safeFromLevel, normalizeLevel(toLevel));
  const before = calculateCumulativeJobGrowth(job, safeFromLevel);
  const after = calculateCumulativeJobGrowth(job, safeToLevel);
  return {
    hp: after.hp - before.hp,
    atk: after.atk - before.atk,
    def: after.def - before.def,
  };
}
