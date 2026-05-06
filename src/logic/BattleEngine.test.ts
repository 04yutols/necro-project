import { BattleEngine } from './BattleEngine';
import { CharacterData, MonsterData } from '../types/game';

describe('BattleEngine', () => {
  beforeEach(() => {
    mockPlayer.currentEnergy = 0;
  });

  const mockPlayer: CharacterData = {
    id: '1',
    name: 'Hero',
    currentJobId: 'warrior',
    category: 'PHYSICAL',
    baseStats: {
      hp: 100,
      atk: 50,
      def: 30,
      spd: 100,
      critRate: 10,
      critDmg: 150,
      effectHit: 0,
      effectRes: 0,
    },
    stats: {
      hp: 100,
      atk: 50,
      def: 30,
      spd: 100,
      critRate: 10,
      critDmg: 150,
      effectHit: 0,
      effectRes: 0,
    },
    passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveSpdBonus: 0, passiveCritRateBonus: 0, passiveCritDmgBonus: 0, passiveHpBonus: 0 },
    equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
    baseResistances: {},
    jobs: [],
    isAwakened: false,
    clearedStages: [],
    currentEnergy: 0,
    maxEnergy: 100,
    elementDmgBoosts: {},
  };

  const mockTarget = {
    id: 'goblin-1',
    name: 'Goblin',
    tribe: 'HUMANOID' as const,
    cost: 1,
    stats: {
      hp: 50,
      atk: 10,
      def: 10,
      spd: 80,
      critRate: 0,
      critDmg: 150,
      effectHit: 0,
      effectRes: 0,
    },
    resistances: {},
  };

  test('Damage calculation uses HSR-style defMult', () => {
    const engine = new BattleEngine(mockPlayer, []);
    const logs = engine.simulateAction('PHYSICAL_ATTACK', mockTarget);

    // baseDmg = 50 × 1.0 = 50
    // defMult = 1 - 10/(10+200) = 1 - 0.0476 = 0.952
    // finalDmg = 50 × 0.952 = 47.6 → 47 (non-crit) or × 1.5 (crit)
    const attackLog = logs.find(l => l.action === 'PHYSICAL_ATTACK');
    expect(attackLog?.damage).toBeGreaterThanOrEqual(40);
    expect(attackLog?.damage).toBeLessThanOrEqual(80); // crit ceiling (×1.5)
  });

  test('Energy is gained on attack', () => {
    const engine = new BattleEngine(mockPlayer, []);
    engine.simulateAction('PHYSICAL_ATTACK', mockTarget);
    expect(mockPlayer.currentEnergy).toBe(20); // 0 + 20
  });
});
