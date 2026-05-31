import jobsData from '../data/master/jobs.json';
import type { JobData } from '../types/game';
import {
  BASE_STAT_GROWTH_PER_LEVEL,
  calculateCumulativeJobGrowth,
  calculateJobGrowthIncrements,
  normalizeJobGrowthModifiers,
} from './JobGrowthSystem';

const jobs = jobsData as Record<string, JobData>;

describe('JobGrowthSystem', () => {
  test('uses neutral growth when a job has no growthModifiers', () => {
    expect(calculateJobGrowthIncrements(null, 1, 3)).toEqual({
      hp: Math.round(BASE_STAT_GROWTH_PER_LEVEL.hp * 2),
      atk: Math.round(BASE_STAT_GROWTH_PER_LEVEL.atk * 2),
      def: Math.round(BASE_STAT_GROWTH_PER_LEVEL.def * 2),
    });
  });

  test('applies job-specific growth modifiers and rounds total gain', () => {
    const increments = calculateJobGrowthIncrements({
      growthModifiers: { hp: 0.75, atk: 1.25, def: 0.65 },
    }, 1, 4);

    expect(increments).toEqual({
      hp: 7,
      atk: 2,
      def: 1,
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
    const warrior = calculateJobGrowthIncrements(jobs.warrior, 1, 2);
    const mage = calculateJobGrowthIncrements(jobs.mage, 1, 2);

    expect(warrior).toEqual({ hp: 4, atk: 1, def: 0 });
    expect(mage).toEqual({ hp: 2, atk: 1, def: 0 });
    expect(warrior).not.toEqual(mage);
  });

  test('split level-ups match a bulk level-up', () => {
    const bulk = calculateJobGrowthIncrements(jobs.warrior, 1, 4);
    const split = [
      calculateJobGrowthIncrements(jobs.warrior, 1, 2),
      calculateJobGrowthIncrements(jobs.warrior, 2, 3),
      calculateJobGrowthIncrements(jobs.warrior, 3, 4),
    ].reduce((sum, growth) => ({
      hp: sum.hp + growth.hp,
      atk: sum.atk + growth.atk,
      def: sum.def + growth.def,
    }), { hp: 0, atk: 0, def: 0 });

    expect(calculateCumulativeJobGrowth(jobs.warrior, 4)).toEqual({ hp: 11, atk: 2, def: 1 });
    expect(split).toEqual(bulk);
  });
});
