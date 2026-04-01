import { NecroService } from './NecroService';
import { MonsterData, NecroStatus } from '../types/game';

describe('NecroService', () => {
  let necroService: NecroService;
  
  const mockMonster = (id: string, cost: number): MonsterData => ({
    id,
    name: `Monster-${id}`,
    tribe: 'UNDEAD',
    cost,
    stats: { hp: 100, mp: 0, atk: 50, def: 20, matk: 10, mdef: 10, agi: 10, luck: 10, tec: 10 }
  });

  const mockNecroStatus: NecroStatus = {
    level: 1,
    rank: 1,
    maxCost: 10,
    baseStatsBonus: 1.0
  };

  beforeEach(() => {
    necroService = new NecroService();
  });

  describe('createSoulShard', () => {
    test('inherits 10% of monster stats', () => {
      const monster = mockMonster('m1', 3);
      const shard = necroService.createSoulShard(monster);
      expect(shard.effect.atkBonus).toBe(5); // 50 * 0.1
    });
  });

  describe('validatePartyFormation', () => {
    test('fails when total cost exceeds maxCost', () => {
      const slots = [mockMonster('m1', 5), mockMonster('m2', 5), mockMonster('m3', 5)];
      expect(() => necroService.validatePartyFormation(mockNecroStatus, slots)).toThrow('コスト超過です');
    });

    test('passes when total cost is within limit', () => {
      const slots = [mockMonster('m1', 3), mockMonster('m2', 3), mockMonster('m3', 3)];
      expect(necroService.validatePartyFormation(mockNecroStatus, slots)).toBe(true);
    });

    test('enforces 3-slot rule', () => {
      const slots = [mockMonster('m1', 3), mockMonster('m2', 3)];
      expect(() => necroService.validatePartyFormation(mockNecroStatus, slots)).toThrow('パーティ編成は3枠固定です。');
    });
  });

  describe('performRankUp', () => {
    test('resets level and increases maxCost', () => {
      const status: NecroStatus = { level: 99, rank: 1, maxCost: 10, baseStatsBonus: 1.0 };
      const nextStatus = necroService.performRankUp(status, true);
      
      expect(nextStatus.level).toBe(1);
      expect(nextStatus.rank).toBe(2);
      expect(nextStatus.maxCost).toBe(15);
      expect(nextStatus.baseStatsBonus).toBe(1.5);
    });

    test('fails if level is below 99', () => {
      const status: NecroStatus = { level: 98, rank: 1, maxCost: 10, baseStatsBonus: 1.0 };
      expect(() => necroService.performRankUp(status, true)).toThrow('Lv.99到達が必要です。');
    });
  });
});
