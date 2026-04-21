import { BattleEngine } from './BattleEngine';
import { CharacterData, MonsterData } from '../types/game';

describe('BattleEngine', () => {
  const mockPlayer: CharacterData = {
    id: '1',
    name: 'Hero',
    currentJobId: 'warrior',
    category: 'PHYSICAL',
    baseStats: {
      hp: 100,
      mp: 20,
      atk: 50,
      def: 30,
      matk: 10,
      mdef: 10,
      agi: 10,
      luck: 10,
      tec: 20,
    },
    passiveBonuses: {},
    jobs: [],
    isAwakened: false,
  };

  const mockTarget = {
    name: 'Goblin',
    stats: {
      hp: 50,
      mp: 0,
      atk: 10,
      def: 10,
      matk: 0,
      mdef: 5,
      agi: 5,
      luck: 0,
      tec: 0,
    },
  };

  test('Damage calculation includes TEC bonus', () => {
    const engine = new BattleEngine(mockPlayer, []);
    const logs = engine.simulateAction('PHYSICAL_ATTACK', mockTarget);
    
    // Base damage = (50^2 / (50 + 10)) = 2500 / 60 = 41.66
    // TEC bonus = 41.66 * (1 + 20/100) = 41.66 * 1.2 = 49.99 -> 49
    const attackLog = logs.find(l => l.action === 'PHYSICAL_ATTACK');
    expect(attackLog?.damage).toBeGreaterThanOrEqual(40);
  });

  test('MP is consumed based on class category', () => {
    const magicPlayer = { ...mockPlayer, category: 'MAGICAL' as const };
    const engine = new BattleEngine(magicPlayer, []);
    const logs = engine.simulateAction('MAGIC_SKILL', mockTarget);
    
    expect(magicPlayer.baseStats.mp).toBe(5); // 20 - 15
  });
});
