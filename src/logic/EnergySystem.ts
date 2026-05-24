import type { JobData } from '../types/game';

export interface EnergyState {
  currentEnergy: number;
  maxEnergy: number;
}

export function calculateMaxEnergy(job: Pick<JobData, 'energyCurve'> | null | undefined, level: number): number {
  const curve = job?.energyCurve;
  const baseMaxEnergy = curve?.baseMaxEnergy ?? 100;
  const growth = curve?.spGrowthPerLevel ?? 0;
  const safeLevel = Math.max(1, Math.floor(level || 1));
  return Math.max(1, Math.floor(baseMaxEnergy + growth * (safeLevel - 1)));
}

export function calculateInitialEnergy(job: Pick<JobData, 'energyCurve'> | null | undefined, level: number): number {
  const maxEnergy = calculateMaxEnergy(job, level);
  const initialSpPct = job?.energyCurve?.initialSpPct ?? 40;
  return Math.max(0, Math.min(maxEnergy, Math.floor(maxEnergy * initialSpPct / 100)));
}

export function calculateEnergyState(job: Pick<JobData, 'energyCurve'> | null | undefined, level: number): EnergyState {
  const maxEnergy = calculateMaxEnergy(job, level);
  return {
    currentEnergy: calculateInitialEnergy(job, level),
    maxEnergy,
  };
}

export function getEnergyRegen(job: Pick<JobData, 'energyCurve'> | null | undefined): number {
  return Math.max(0, Math.floor(job?.energyCurve?.energyRegen ?? 20));
}
