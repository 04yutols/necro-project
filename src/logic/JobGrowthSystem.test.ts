import jobsData from '../data/master/jobs.json';
import type { JobData } from '../types/game';
import {
  calculateJobBaseStatsDelta,
  calculateJobBaseStatsPowerScore,
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
      }
      void jobId;
    });
  });

  test('fixed base stats preserve early low-damage scale and job identity', () => {
    const warrior = getJobBaseStatsAtLevel(jobs.warrior, 1);
    const mage = getJobBaseStatsAtLevel(jobs.mage, 1);

    expect(warrior).toMatchObject({ hp: 34, atk: 5, def: 5, spd: 98 });
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

  test('tier 2 jobs have a higher average fixed-stat power score than tier 1 jobs', () => {
    const scoreAtSamples = (job: JobData) => [1, 50, 100]
      .map((level) => calculateJobBaseStatsPowerScore(getJobBaseStatsAtLevel(job, level)))
      .reduce((sum, score) => sum + score, 0) / 3;

    const tier1Average = Object.values(jobs)
      .filter((job) => job.tier === 1)
      .map(scoreAtSamples)
      .reduce((sum, score, _, scores) => sum + score / scores.length, 0);

    Object.entries(jobs)
      .filter(([, job]) => job.tier > 1)
      .forEach(([jobId, job]) => {
        expect(scoreAtSamples(job)).toBeGreaterThan(tier1Average);
        void jobId;
      });
  });
});
