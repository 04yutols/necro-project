import type { JobData } from '../types/game';

export interface EnergyState {
  currentEnergy: number;
  maxEnergy: number;
}

function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.floor(level || 1));
}

function readBaseStatsMp(
  job: Pick<JobData, 'baseStatsByLevel'> | null | undefined,
  level: number,
): number | null {
  const table = job?.baseStatsByLevel;
  if (!table) return null;
  const safeLevel = Math.min(100, normalizeLevel(level));
  const value = table[String(safeLevel)]?.mp;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.floor(value));
}

export function calculateMaxEnergy(
  job: Pick<JobData, 'energyCurve' | 'baseStatsByLevel'> | null | undefined,
  level: number,
): number {
  const baseStatsMp = readBaseStatsMp(job, level);
  if (baseStatsMp !== null) return baseStatsMp;

  const curve = job?.energyCurve;
  const baseMaxEnergy = curve?.baseMaxEnergy ?? 100;
  const growth = curve?.spGrowthPerLevel ?? 0;
  const safeLevel = normalizeLevel(level);
  return Math.max(1, Math.floor(baseMaxEnergy + growth * (safeLevel - 1)));
}

export function calculateInitialEnergy(
  job: Pick<JobData, 'energyCurve' | 'baseStatsByLevel'> | null | undefined,
  level: number,
): number {
  return calculateMaxEnergy(job, level);
}

export function calculateEnergyState(
  job: Pick<JobData, 'energyCurve' | 'baseStatsByLevel'> | null | undefined,
  level: number,
): EnergyState {
  const maxEnergy = calculateMaxEnergy(job, level);
  return {
    currentEnergy: calculateInitialEnergy(job, level),
    maxEnergy,
  };
}
