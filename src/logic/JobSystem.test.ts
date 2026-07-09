import jobsData from '../data/master/jobs.json';
import type { JobData, SkillAttackType } from '../types/game';
import { getBaseAttackType } from './JobSystem';

const JOBS = jobsData as Record<string, JobData>;

const EXPECTED_BASE_ATTACK_TYPES: Record<string, SkillAttackType> = {
  warrior: 'SLASH',
  mage: 'MAGIC',
  dark_priest: 'MAGIC',
  rogue: 'STRIKE',
  dark_knight: 'SLASH',
  berserker: 'SLASH',
  archmage: 'MAGIC',
  sorcerer: 'PROJECTILE',
  warlock: 'MAGIC',
  necromancer: 'SUMMON',
  assassin: 'SLASH',
  trickster: 'PROJECTILE',
};

describe('JobSystem', () => {
  test('resolves configured normal attack types for every job master entry', () => {
    const actual = Object.fromEntries(
      Object.entries(JOBS).map(([jobId, job]) => [jobId, getBaseAttackType(job)]),
    );

    expect(actual).toEqual(EXPECTED_BASE_ATTACK_TYPES);
  });

  test('falls back to slash for legacy jobs without baseAttackType', () => {
    expect(getBaseAttackType(undefined)).toBe('SLASH');
    expect(getBaseAttackType({})).toBe('SLASH');
  });
});
