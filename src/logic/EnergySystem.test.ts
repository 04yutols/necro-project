import jobsData from '../data/master/jobs.json';
import type { JobData } from '../types/game';
import { calculateEnergyState, calculateInitialEnergy, calculateMaxEnergy } from './EnergySystem';

const JOBS = jobsData as Record<string, JobData>;

describe('EnergySystem', () => {
  test('starts each job with full MP at Lv1', () => {
    expect(calculateEnergyState(JOBS.warrior, 1)).toEqual({ maxEnergy: 100, currentEnergy: 100 });
    expect(calculateEnergyState(JOBS.mage, 1)).toEqual({ maxEnergy: 80, currentEnergy: 80 });
    expect(calculateEnergyState(JOBS.dark_knight, 1)).toEqual({ maxEnergy: 110, currentEnergy: 110 });
    expect(calculateEnergyState(JOBS.berserker, 1)).toEqual({ maxEnergy: 120, currentEnergy: 120 });
  });

  test('grows max MP and keeps initial MP full with job level', () => {
    expect(calculateMaxEnergy(JOBS.warrior, 20)).toBe(119);
    expect(calculateInitialEnergy(JOBS.warrior, 20)).toBe(119);
    expect(calculateMaxEnergy(JOBS.archmage, 99)).toBe(394);
    expect(calculateInitialEnergy(JOBS.archmage, 99)).toBe(394);
  });

  test('uses a full 100 MP safe default when job data is absent', () => {
    expect(calculateEnergyState(null, 1)).toEqual({ maxEnergy: 100, currentEnergy: 100 });
  });
});
