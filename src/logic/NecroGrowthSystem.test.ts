import type { BaseStats, MonsterData } from '../types/game';
import {
  applyNecroRankToCaptureRate,
  applyNecroToMonster,
  calcNecroMaxCost,
  clampNecroLevel,
  deriveNecroRank,
  MAX_NECRO_LEVEL,
  necroExpFromGain,
  necroLevelFromExp,
  necroMonsterMultiplier,
  reqNecroExp,
} from './NecroGrowthSystem';

const BASE_STATS: BaseStats = {
  hp: 100,
  atk: 50,
  def: 20,
  spd: 80,
  critRate: 5,
  critDmg: 150,
  effectHit: 10,
  effectRes: 10,
};

function monster(stats: BaseStats = BASE_STATS): MonsterData {
  return {
    id: 'm1',
    masterId: 'grave_soldier',
    name: 'テスト魔物',
    tribe: 'UNDEAD',
    cost: 1,
    stats,
    resistances: { LIGHT: -20 },
    currentEnergy: 10,
    maxEnergy: 10,
  };
}

describe('NecroGrowthSystem', () => {
  describe('clampNecroLevel', () => {
    test('clamps to 1..500 and floors fractional input', () => {
      expect(clampNecroLevel(0)).toBe(1);
      expect(clampNecroLevel(-5)).toBe(1);
      expect(clampNecroLevel(501)).toBe(500);
      expect(clampNecroLevel(12.9)).toBe(12);
      expect(clampNecroLevel(Number.NaN)).toBe(1);
    });
  });

  describe('deriveNecroRank — 50Lvごとに自動昇格', () => {
    test.each([
      [1, 1],
      [50, 1],
      [51, 2],
      [100, 2],
      [101, 3],
      [450, 9],
      [451, 10],
      [500, 10],
      [501, 10],
    ])('Lv%i -> rank %i', (level, rank) => {
      expect(deriveNecroRank(level)).toBe(rank);
    });
  });

  describe('necroMonsterMultiplier — 区分線形', () => {
    test.each([
      [1, 1.006],
      [10, 1.06],
      [30, 1.18],
      [50, 1.3],
      [51, 1.3524],
      [100, 1.47],
      [500, 2.83],
    ])('Lv%i -> mult %f', (level, mult) => {
      expect(necroMonsterMultiplier(level)).toBeCloseTo(mult, 4);
    });
  });

  describe('applyNecroToMonster', () => {
    test('scales HP/ATK/DEF/SPD by mult, leaves crit/effect untouched (Lv10 = x1.06)', () => {
      const result = applyNecroToMonster(monster(), 10);
      expect(result.stats.hp).toBe(106); // round(100 * 1.06)
      expect(result.stats.atk).toBe(53); // round(50 * 1.06)
      expect(result.stats.def).toBe(21); // round(20 * 1.06 = 21.2)
      expect(result.stats.spd).toBe(85); // round(80 * 1.06 = 84.8)
      expect(result.stats.critRate).toBe(5);
      expect(result.stats.critDmg).toBe(150);
      expect(result.stats.effectHit).toBe(10);
      expect(result.stats.effectRes).toBe(10);
    });

    test('Lv1 leaves stats effectively unchanged (mult ~1.006)', () => {
      const result = applyNecroToMonster(monster(), 1);
      expect(result.stats.hp).toBe(101); // round(100 * 1.006 = 100.6)
      expect(result.stats.atk).toBe(50); // round(50 * 1.006 = 50.3)
    });

    test('is immutable — returns a new object and does not mutate the source', () => {
      const source = monster();
      const result = applyNecroToMonster(source, 500);
      expect(result).not.toBe(source);
      expect(result.stats).not.toBe(source.stats);
      expect(source.stats.hp).toBe(100); // 元データは不変
      expect(result.stats.hp).toBe(283); // round(100 * 2.83)
      expect(result.id).toBe(source.id);
    });
  });

  describe('calcNecroMaxCost', () => {
    test.each([
      [1, 6],
      [10, 7],
      [40, 10],
      [50, 11],
      [51, 13], // rank2 で c2=2 が乗る
      [500, 74],
    ])('Lv%i -> maxCost %i', (level, cost) => {
      expect(calcNecroMaxCost(level)).toBe(cost);
    });
  });

  describe('applyNecroRankToCaptureRate', () => {
    test('MINION 0.12 base by rank', () => {
      expect(applyNecroRankToCaptureRate(0.12, 1)).toBeCloseTo(0.12, 4);
      expect(applyNecroRankToCaptureRate(0.12, 5)).toBeCloseTo(0.1757, 4);
      expect(applyNecroRankToCaptureRate(0.12, 10)).toBeCloseTo(0.283, 3);
    });

    test('BOSS 0.001 base stays tiny', () => {
      expect(applyNecroRankToCaptureRate(0.001, 10)).toBeCloseTo(0.00236, 5);
    });

    test('clamps to cap 0.75 for high base x high rank', () => {
      expect(applyNecroRankToCaptureRate(0.4, 10)).toBe(0.75); // raw ~0.943
      expect(applyNecroRankToCaptureRate(0.6, 5)).toBe(0.75); // raw ~0.878
    });

    test('handles invalid base rate as 0', () => {
      expect(applyNecroRankToCaptureRate(-1, 10)).toBe(0);
      expect(applyNecroRankToCaptureRate(Number.NaN, 5)).toBe(0);
    });
  });

  describe('reqNecroExp — necro専用曲線 (L-1)*(L+9)', () => {
    test.each([
      [1, 0],
      [2, 11],
      [50, 2891],
      [100, 10791],
      [500, 253991],
    ])('Lv%i -> cumulative %i', (level, exp) => {
      expect(reqNecroExp(level)).toBe(exp);
    });
  });

  describe('necroLevelFromExp', () => {
    test('maps cumulative exp back to level at boundaries', () => {
      expect(necroLevelFromExp(0)).toBe(1);
      expect(necroLevelFromExp(10)).toBe(1); // reqNecroExp(2)=11 > 10
      expect(necroLevelFromExp(11)).toBe(2);
      expect(necroLevelFromExp(2890)).toBe(49); // reqNecroExp(50)=2891 > 2890
      expect(necroLevelFromExp(2891)).toBe(50);
      expect(necroLevelFromExp(253991)).toBe(MAX_NECRO_LEVEL);
    });

    test('clamps at MAX_NECRO_LEVEL for huge exp', () => {
      expect(necroLevelFromExp(99_999_999)).toBe(MAX_NECRO_LEVEL);
    });

    test('round-trips with reqNecroExp', () => {
      for (const level of [1, 7, 50, 51, 123, 500]) {
        expect(necroLevelFromExp(reqNecroExp(level))).toBe(level);
      }
    });
  });

  describe('necroExpFromGain — necroExpRate 1.5', () => {
    test('applies rate and floors', () => {
      expect(necroExpFromGain(82)).toBe(123); // floor(82 * 1.5 = 123)
      expect(necroExpFromGain(12)).toBe(18);
      expect(necroExpFromGain(0)).toBe(0);
      expect(necroExpFromGain(-10)).toBe(0);
    });
  });
});
