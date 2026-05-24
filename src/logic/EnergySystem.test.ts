import jobsData from '../data/master/jobs.json';
import type { JobData } from '../types/game';
import { calculateEnergyState, calculateInitialEnergy, calculateMaxEnergy, getEnergyRegen } from './EnergySystem';

const JOBS = jobsData as Record<string, JobData>;

describe('EnergySystem', () => {
  test('calculates Lv1 initial SP and max SP by job energy curve', () => {
    expect(calculateEnergyState(JOBS.warrior, 1)).toEqual({ maxEnergy: 100, currentEnergy: 40 });
    expect(calculateEnergyState(JOBS.mage, 1)).toEqual({ maxEnergy: 80, currentEnergy: 48 });
    expect(calculateEnergyState(JOBS.dark_knight, 1)).toEqual({ maxEnergy: 110, currentEnergy: 33 });
    expect(calculateEnergyState(JOBS.berserker, 1)).toEqual({ maxEnergy: 120, currentEnergy: 60 });
  });

  test('grows max SP and initial SP with job level', () => {
    expect(calculateMaxEnergy(JOBS.warrior, 20)).toBe(119);
    expect(calculateInitialEnergy(JOBS.warrior, 20)).toBe(47);
    expect(calculateMaxEnergy(JOBS.archmage, 99)).toBe(394);
    expect(calculateInitialEnergy(JOBS.archmage, 99)).toBe(256);
  });

  test('uses configured normal-attack regen and safe defaults', () => {
    expect(getEnergyRegen(JOBS.rogue)).toBe(22);
    expect(getEnergyRegen(JOBS.assassin)).toBe(25);
    expect(calculateEnergyState(null, 1)).toEqual({ maxEnergy: 100, currentEnergy: 40 });
    expect(getEnergyRegen(null)).toBe(20);
  });
});
