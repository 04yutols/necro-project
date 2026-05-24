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
    expect(expForLevel(2)).toBe(500);
    expect(expForLevel(3)).toBe(1100);
    expect(expForLevel(4)).toBe(1800);
    expect(expForLevel(5)).toBe(2600);
  });

  test('resolves total EXP to level at exact thresholds', () => {
    expect(levelFromTotalExp(0)).toBe(1);
    expect(levelFromTotalExp(499)).toBe(1);
    expect(levelFromTotalExp(500)).toBe(2);
    expect(levelFromTotalExp(1099)).toBe(2);
    expect(levelFromTotalExp(1100)).toBe(3);
  });

  test('normalizes invalid or fractional EXP safely', () => {
    expect(normalizeTotalExp(-100)).toBe(0);
    expect(normalizeTotalExp(Number.NaN)).toBe(0);
    expect(levelFromTotalExp(500.9)).toBe(2);
  });

  test('caps level at max job level', () => {
    expect(levelFromTotalExp(Number.MAX_SAFE_INTEGER)).toBe(MAX_JOB_LEVEL);
  });

  test('reports progress within the current level band', () => {
    expect(getJobLevelProgress(800)).toEqual({
      level: 2,
      totalExp: 800,
      currentLevelExp: 500,
      nextLevelExp: 1100,
      expIntoLevel: 300,
      expToNextLevel: 300,
      progressRatio: 0.5,
    });
  });
});
