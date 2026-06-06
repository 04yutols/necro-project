import type { JobBaseStatsByLevel } from '../types/game';
import {
  clampJobBaseStatValue,
  interpolateJobBaseStatColumn,
  interpolateJobBaseStatsByFinalLevel,
  interpolateJobBaseStatValue,
  jobBaseStatsProgressRatio,
} from './JobBaseStatsInterpolation';

function makeTable(): JobBaseStatsByLevel {
  return Object.fromEntries(Array.from({ length: 100 }, (_, index) => {
    const level = index + 1;
    return [String(level), {
      hp: 10,
      atk: 5,
      def: 2,
      spd: 90,
      critRate: 5,
      critDmg: 150,
      effectHit: 0,
      effectRes: 0,
    }];
  })) as JobBaseStatsByLevel;
}

describe('JobBaseStatsInterpolation', () => {
  test('uses a bounded, gentle growth ratio from Lv1 to Lv100', () => {
    expect(jobBaseStatsProgressRatio(1)).toBe(0);
    expect(jobBaseStatsProgressRatio(100)).toBe(1);
    expect(jobBaseStatsProgressRatio(50)).toBeGreaterThan(0.35);
    expect(jobBaseStatsProgressRatio(50)).toBeLessThan(0.5);
  });

  test('interpolates a Lv100 final stat through Lv1-Lv99 without jumps', () => {
    const valueAt1 = interpolateJobBaseStatValue('atk', 5, 100, 1);
    const valueAt50 = interpolateJobBaseStatValue('atk', 5, 100, 50);
    const valueAt99 = interpolateJobBaseStatValue('atk', 5, 100, 99);
    const valueAt100 = interpolateJobBaseStatValue('atk', 5, 100, 100);

    expect(valueAt1).toBe(5);
    expect(valueAt50).toBeGreaterThan(valueAt1);
    expect(valueAt99).toBeGreaterThan(valueAt50);
    expect(valueAt100).toBe(100);
  });

  test('updates only the requested stat column when Lv100 is edited', () => {
    const table = makeTable();
    const interpolated = interpolateJobBaseStatColumn(table, 'atk', 100);

    expect(interpolated['1'].atk).toBe(5);
    expect(interpolated['100'].atk).toBe(100);
    expect(interpolated['50'].atk).toBeGreaterThan(5);
    expect(interpolated['50'].atk).toBeLessThan(100);
    expect(interpolated['50'].hp).toBe(10);
    expect(interpolated['50'].critDmg).toBe(150);
  });

  test('interpolates all stat columns from current Lv1 and Lv100 values', () => {
    const table = makeTable();
    table['100'] = {
      hp: 220,
      atk: 45,
      def: 28,
      spd: 118,
      critRate: 12.5,
      critDmg: 180.5,
      effectHit: 15,
      effectRes: 20,
    };

    const interpolated = interpolateJobBaseStatsByFinalLevel(table, table['100']);

    expect(interpolated['1']).toEqual(table['1']);
    expect(interpolated['100']).toEqual(table['100']);
    expect(interpolated['50'].hp).toBeGreaterThan(table['1'].hp);
    expect(interpolated['50'].hp).toBeLessThan(table['100'].hp);
    expect(interpolated['50'].critRate).toBeGreaterThan(table['1'].critRate);
    expect(interpolated['50'].critRate).toBeLessThan(table['100'].critRate);
  });

  test('clamps invalid and minimum-sensitive values consistently', () => {
    expect(clampJobBaseStatValue('hp', 0)).toBe(1);
    expect(clampJobBaseStatValue('atk', 1.6)).toBe(2);
    expect(clampJobBaseStatValue('critRate', 1.234)).toBe(1.2);
    expect(clampJobBaseStatValue('critDmg', 50)).toBe(50);
    expect(clampJobBaseStatValue('critDmg', -10)).toBe(0);
  });
});
