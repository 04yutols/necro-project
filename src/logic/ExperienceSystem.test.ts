import {
  MAX_JOB_LEVEL,
  expForLevel,
  getJobLevelProgress,
  levelFromTotalExp,
  normalizeTotalExp,
} from './ExperienceSystem';

describe('ExperienceSystem', () => {
  test('uses the canonical cumulative job EXP table', () => {
    expect(expForLevel(1)).toBe(0);
    expect(expForLevel(2)).toBe(10);
    expect(expForLevel(3)).toBe(22);
    expect(expForLevel(4)).toBe(36);
    expect(expForLevel(5)).toBe(52);
  });

  test('resolves total EXP to level at exact thresholds', () => {
    expect(levelFromTotalExp(0)).toBe(1);
    expect(levelFromTotalExp(9)).toBe(1);
    expect(levelFromTotalExp(10)).toBe(2);
    expect(levelFromTotalExp(21)).toBe(2);
    expect(levelFromTotalExp(22)).toBe(3);
  });

  test('normalizes invalid or fractional EXP safely', () => {
    expect(normalizeTotalExp(-100)).toBe(0);
    expect(normalizeTotalExp(Number.NaN)).toBe(0);
    expect(levelFromTotalExp(10.9)).toBe(2);
  });

  test('caps level at max job level', () => {
    expect(levelFromTotalExp(Number.MAX_SAFE_INTEGER)).toBe(MAX_JOB_LEVEL);
  });

  test('reports progress within the current level band', () => {
    expect(getJobLevelProgress(16)).toEqual({
      level: 2,
      totalExp: 16,
      currentLevelExp: 10,
      nextLevelExp: 22,
      expIntoLevel: 6,
      expToNextLevel: 6,
      progressRatio: 0.5,
    });
  });
});
