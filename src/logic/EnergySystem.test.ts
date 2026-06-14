import jobsData from '../data/master/jobs.json';
import type { JobData } from '../types/game';
import { calculateEnergyState, calculateInitialEnergy, calculateMaxEnergy } from './EnergySystem';

const JOBS = jobsData as Record<string, JobData>;

describe('EnergySystem', () => {
  test('starts each job with full MP at Lv1', () => {
    expect(calculateEnergyState(JOBS.warrior, 1)).toEqual({ maxEnergy: 100, currentEnergy: 100 });
    expect(calculateEnergyState(JOBS.mage, 1)).toEqual({ maxEnergy: 110, currentEnergy: 110 });
    expect(calculateEnergyState(JOBS.dark_knight, 1)).toEqual({ maxEnergy: 110, currentEnergy: 110 });
    expect(calculateEnergyState(JOBS.berserker, 1)).toEqual({ maxEnergy: 120, currentEnergy: 120 });
  });

  test('grows max MP and keeps initial MP full with job level', () => {
    expect(calculateMaxEnergy(JOBS.warrior, 20)).toBe(110);
    expect(calculateInitialEnergy(JOBS.warrior, 20)).toBe(110);
    expect(calculateMaxEnergy(JOBS.archmage, 99)).toBe(377);
    expect(calculateInitialEnergy(JOBS.archmage, 99)).toBe(377);
  });

  test('uses baseStatsByLevel.mp before legacy energyCurve fallback', () => {
    const job = {
      energyCurve: { baseMaxEnergy: 100, ultimateCost: 100, spGrowthPerLevel: 99 },
      baseStatsByLevel: {
        '1': { hp: 1, mp: 77, atk: 1, def: 0, spd: 1, critRate: 0, critDmg: 0, effectHit: 0, effectRes: 0 },
        '2': { hp: 1, mp: 79, atk: 1, def: 0, spd: 1, critRate: 0, critDmg: 0, effectHit: 0, effectRes: 0 },
      },
    };

    expect(calculateMaxEnergy(job, 1)).toBe(77);
    expect(calculateMaxEnergy(job, 2)).toBe(79);
  });

  test('magical jobs gain more max MP than physical jobs on average', () => {
    const averageGrowth = (category: 'PHYSICAL' | 'MAGICAL') => {
      const matchingJobs = Object.values(JOBS).filter((job) => job.category === category);
      return matchingJobs
        .map((job) => calculateMaxEnergy(job, 100) - calculateMaxEnergy(job, 1))
        .reduce((sum, growth) => sum + growth, 0) / matchingJobs.length;
    };

    expect(averageGrowth('MAGICAL')).toBeGreaterThan(averageGrowth('PHYSICAL'));
  });

  test('uses a full 100 MP safe default when job data is absent', () => {
    expect(calculateEnergyState(null, 1)).toEqual({ maxEnergy: 100, currentEnergy: 100 });
  });
});
