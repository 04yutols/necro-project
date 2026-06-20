import jobsData from '../data/master/jobs.json';
import type { JobData } from '../types/game';
import {
  calculateJobBaseStatsDelta,
  getJobBaseStatsAtLevel,
  JOB_BASE_STATS_MAX_LEVEL,
  JOB_BASE_STATS_MIN_LEVEL,
} from './JobGrowthSystem';

const jobs = jobsData as Record<string, JobData>;

describe('JobGrowthSystem', () => {
  test('jobs no longer define growth modifiers', () => {
    Object.entries(jobs).forEach(([jobId, job]) => {
      expect('growthModifiers' in job).toBe(false);
      void jobId;
    });
  });

  test('all jobs define fixed base stats from Lv1 to Lv100', () => {
    Object.entries(jobs).forEach(([jobId, job]) => {
      expect(job.baseStatsByLevel).toBeTruthy();
      for (let level = JOB_BASE_STATS_MIN_LEVEL; level <= JOB_BASE_STATS_MAX_LEVEL; level += 1) {
        const stats = getJobBaseStatsAtLevel(job, level);
        expect(stats.hp).toBeGreaterThan(0);
        expect(stats.atk).toBeGreaterThan(0);
        expect(stats.def).toBeGreaterThanOrEqual(0);
        expect(stats.spd).toBeGreaterThan(0);
        expect(stats.critDmg).toBeGreaterThanOrEqual(0);
        expect(job.baseStatsByLevel?.[String(level)]).toBeTruthy();
        expect(job.baseStatsByLevel?.[String(level)]?.mp).toBeGreaterThan(0);
      }
      void jobId;
    });
  });

  test('all jobs define fixed base MP from Lv1 to Lv100', () => {
    Object.entries(jobs).forEach(([jobId, job]) => {
      for (let level = JOB_BASE_STATS_MIN_LEVEL; level <= JOB_BASE_STATS_MAX_LEVEL; level += 1) {
        const value = job.baseStatsByLevel?.[String(level)]?.mp;
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      }
      void jobId;
    });
  });

  test('fixed base stats preserve early low-damage scale and job identity', () => {
    const warrior = getJobBaseStatsAtLevel(jobs.warrior, 1);
    const mage = getJobBaseStatsAtLevel(jobs.mage, 1);

    expect(warrior).toMatchObject({ hp: 34, atk: 8, def: 7, spd: 98 });
    expect(mage.hp).toBeLessThan(warrior.hp);
    expect(mage.critDmg).toBeGreaterThan(warrior.critDmg);
  });

  test('fixed table deltas still split the same as a bulk level-up', () => {
    const bulk = calculateJobBaseStatsDelta(jobs.warrior, 1, 4);
    const split = [
      calculateJobBaseStatsDelta(jobs.warrior, 1, 2),
      calculateJobBaseStatsDelta(jobs.warrior, 2, 3),
      calculateJobBaseStatsDelta(jobs.warrior, 3, 4),
    ].reduce((sum, growth) => ({
      hp: sum.hp + growth.hp,
      atk: sum.atk + growth.atk,
      def: sum.def + growth.def,
    }), { hp: 0, atk: 0, def: 0 });

    expect(split).toEqual(bulk);
  });

  test('tier 2 jobs use a larger starting MP budget than tier 1 jobs', () => {
    const tier1MaxStartingMp = Math.max(
      ...Object.values(jobs)
        .filter((job) => job.tier === 1)
        .map((job) => job.baseStatsByLevel?.['1']?.mp ?? 0),
    );

    Object.entries(jobs)
      .filter(([, job]) => job.tier > 1)
      .forEach(([jobId, job]) => {
        expect(job.baseStatsByLevel?.['1']?.mp).toBeGreaterThan(tier1MaxStartingMp);
        void jobId;
      });
  });

  test('magical jobs have a larger max MP growth budget than physical jobs', () => {
    const averageMpGrowth = (category: 'PHYSICAL' | 'MAGICAL') => {
      const matchingJobs = Object.values(jobs).filter((job) => job.category === category);
      return matchingJobs
        .map((job) => (job.baseStatsByLevel?.['100']?.mp ?? 0) - (job.baseStatsByLevel?.['1']?.mp ?? 0))
        .reduce((sum, growth, _, growths) => sum + growth / growths.length, 0);
    };

    expect(averageMpGrowth('MAGICAL')).toBeGreaterThan(averageMpGrowth('PHYSICAL'));
  });
});
