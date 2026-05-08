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

  test('Element damage boosts increase matching elemental skill damage', () => {
    const basePlayer: CharacterData = {
      ...mockPlayer,
      currentEnergy: 100,
      stats: { ...mockPlayer.stats, critRate: 0 },
      elementDmgBoosts: {},
    };
    const boostedPlayer: CharacterData = {
      ...basePlayer,
      currentEnergy: 100,
      elementDmgBoosts: { FIRE: 50 },
    };

    const baseLogs = new BattleEngine(basePlayer, []).simulateAction('MAGIC_SKILL', mockTarget, 'skill_mage_1');
    const boostedLogs = new BattleEngine(boostedPlayer, []).simulateAction('MAGIC_SKILL', mockTarget, 'skill_mage_1');
    const baseDamage = baseLogs.find(l => l.action === 'MAGIC_SKILL')?.damage ?? 0;
    const boostedDamage = boostedLogs.find(l => l.action === 'MAGIC_SKILL')?.damage ?? 0;

    expect(boostedDamage).toBeGreaterThan(baseDamage);
  });

  test('Spiritual shield heavily reduces non-weak attacks', () => {
    const player: CharacterData = {
      ...mockPlayer,
      stats: { ...mockPlayer.stats, critRate: 0 },
      currentEnergy: 0,
    };
    const shieldedTarget: MonsterData = {
      ...mockTarget,
      shieldHp: 100,
      maxShieldHp: 100,
      weaknesses: ['FIRE'],
    };

    const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', shieldedTarget);
    const attackLog = logs.find(l => l.action === 'PHYSICAL_ATTACK');

    expect(attackLog?.damage).toBeLessThan(20);
    expect(attackLog?.description).toContain('霊的防壁に阻まれた');
    expect(shieldedTarget.shieldHp).toBe(100);
  });

  test('Weak element breaks spiritual shield and grants extra energy', () => {
    const player: CharacterData = {
      ...mockPlayer,
      currentEnergy: 100,
      maxEnergy: 150,
      stats: { ...mockPlayer.stats, critRate: 0 },
    };
    const shieldedTarget: MonsterData = {
      ...mockTarget,
      shieldHp: 20,
      maxShieldHp: 20,
      weaknesses: ['FIRE'],
      resistances: { FIRE: -30 },
    };

    const logs = new BattleEngine(player, []).simulateAction('MAGIC_SKILL', shieldedTarget, 'skill_mage_1');
    const attackLog = logs.find(l => l.action === 'MAGIC_SKILL');

    expect(shieldedTarget.shieldBroken).toBe(true);
    expect(shieldedTarget.shieldHp).toBe(0);
    expect(attackLog?.description).toContain('霊魂砕き');
    expect(player.currentEnergy).toBe(133);
  });
});
