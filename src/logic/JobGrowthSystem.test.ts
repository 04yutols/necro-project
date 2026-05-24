import jobsData from '../data/master/jobs.json';
import type { JobData } from '../types/game';
import {
  BASE_STAT_GROWTH_PER_LEVEL,
  calculateJobGrowthIncrements,
  normalizeJobGrowthModifiers,
} from './JobGrowthSystem';

const jobs = jobsData as Record<string, JobData>;

describe('JobGrowthSystem', () => {
  test('uses neutral growth when a job has no growthModifiers', () => {
    expect(calculateJobGrowthIncrements(null, 2)).toEqual({
      hp: BASE_STAT_GROWTH_PER_LEVEL.hp * 2,
      atk: BASE_STAT_GROWTH_PER_LEVEL.atk * 2,
      def: BASE_STAT_GROWTH_PER_LEVEL.def * 2,
    });
  });

  test('applies job-specific growth modifiers and rounds total gain', () => {
    const increments = calculateJobGrowthIncrements({
      growthModifiers: { hp: 0.75, atk: 1.25, def: 0.65 },
    }, 3);

    expect(increments).toEqual({
      hp: 90,
      atk: 23,
      def: 8,
    });
  });

  test('normalizes invalid modifiers to neutral values', () => {
    expect(normalizeJobGrowthModifiers({
      growthModifiers: { hp: 0, atk: Number.NaN, def: -1 },
    })).toEqual({ hp: 1, atk: 1, def: 1 });
  });

  test('all jobs define growth modifiers', () => {
    Object.entries(jobs).forEach(([jobId, job]) => {
      if (!job.growthModifiers) throw new Error(`${jobId} growthModifiers is missing`);
      expect(job.growthModifiers.hp).toBeGreaterThan(0);
      expect(job.growthModifiers.atk).toBeGreaterThan(0);
      expect(job.growthModifiers.def).toBeGreaterThan(0);
    });
  });

  test('different jobs produce different permanent stat growth', () => {
    const warrior = calculateJobGrowthIncrements(jobs.warrior, 1);
    const mage = calculateJobGrowthIncrements(jobs.mage, 1);

    expect(warrior).toEqual({ hp: 48, atk: 7, def: 5 });
    expect(mage).toEqual({ hp: 30, atk: 7, def: 3 });
    expect(warrior).not.toEqual(mage);
  });
});
