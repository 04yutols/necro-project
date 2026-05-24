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

  test('Necro rank bonus increases outgoing battle damage', () => {
    const basePlayer: CharacterData = {
      ...mockPlayer,
      stats: { ...mockPlayer.stats, critRate: 0 },
      necroBaseStatsBonus: 1,
    };
    const rankedPlayer: CharacterData = {
      ...basePlayer,
      necroBaseStatsBonus: 2,
    };

    const baseTarget: MonsterData = {
      ...mockTarget,
      stats: { ...mockTarget.stats, hp: 500 },
    };
    const rankedTarget: MonsterData = {
      ...mockTarget,
      stats: { ...mockTarget.stats, hp: 500 },
    };

    const baseLogs = new BattleEngine(basePlayer, []).simulateAction('PHYSICAL_ATTACK', baseTarget);
    const rankedLogs = new BattleEngine(rankedPlayer, []).simulateAction('PHYSICAL_ATTACK', rankedTarget);
    const baseDamage = baseLogs.find(l => l.action === 'PHYSICAL_ATTACK')?.damage ?? 0;
    const rankedDamage = rankedLogs.find(l => l.action === 'PHYSICAL_ATTACK')?.damage ?? 0;

    expect(rankedDamage).toBeGreaterThan(baseDamage);
  });

  test('Necro rank bonus reduces direct incoming damage through final DEF', () => {
    const basePlayer: CharacterData = {
      ...mockPlayer,
      stats: { ...mockPlayer.stats, hp: 500, atk: 1, def: 20, critRate: 0 },
      necroBaseStatsBonus: 1,
    };
    const rankedPlayer: CharacterData = {
      ...basePlayer,
      stats: { ...basePlayer.stats },
      necroBaseStatsBonus: 3,
    };
    const baseEnemy: MonsterData = {
      ...mockTarget,
      stats: { ...mockTarget.stats, hp: 500, atk: 120, def: 0 },
    };
    const rankedEnemy: MonsterData = {
      ...mockTarget,
      stats: { ...mockTarget.stats, hp: 500, atk: 120, def: 0 },
    };

    const baseLogs = new BattleEngine(basePlayer, []).simulateAction('PHYSICAL_ATTACK', baseEnemy);
    const rankedLogs = new BattleEngine(rankedPlayer, []).simulateAction('PHYSICAL_ATTACK', rankedEnemy);
    const baseDamage = baseLogs.find(l => l.action === 'ENEMY_ATTACK')?.damage ?? 0;
    const rankedDamage = rankedLogs.find(l => l.action === 'ENEMY_ATTACK')?.damage ?? 0;

    expect(rankedDamage).toBeLessThan(baseDamage);
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
    expect(shieldedTarget.shieldHp).toBeLessThan(100);
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

  test('REVIVE fires only at HP 0 and restores boss to second phase HP', () => {
    const player: CharacterData = {
      ...mockPlayer,
      stats: { ...mockPlayer.stats, atk: 1000, critRate: 0 },
      currentEnergy: 0,
    };
    const boss: MonsterData = {
      ...mockTarget,
      id: 'revive-boss',
      name: 'Revive Boss',
      tier: 'BOSS',
      stats: { ...mockTarget.stats, hp: 1000, def: 0 },
      gimmicks: [{ trigger: 'HP_BELOW_50', effect: 'REVIVE', value: 1 }],
    };

    const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', boss);

    expect(boss.stats.hp).toBe(500);
    expect(logs.some((log) => log.action === 'BOSS_REVIVE')).toBe(true);
  });

  test('REVIVE does not fire just because boss crosses below 50 percent HP', () => {
    const player: CharacterData = {
      ...mockPlayer,
      stats: { ...mockPlayer.stats, atk: 600, critRate: 0 },
      currentEnergy: 0,
    };
    const boss: MonsterData = {
      ...mockTarget,
      id: 'revive-boss-threshold',
      name: 'Revive Boss',
      tier: 'BOSS',
      stats: { ...mockTarget.stats, hp: 1000, def: 0 },
      gimmicks: [{ trigger: 'HP_BELOW_50', effect: 'REVIVE', value: 1 }],
    };

    const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', boss);

    expect(boss.stats.hp).toBe(400);
    expect(logs.some((log) => log.action === 'BOSS_REVIVE')).toBe(false);
  });

  test('SUMMON_MINIONS fires when spiritual shield breaks', () => {
    const player: CharacterData = {
      ...mockPlayer,
      currentEnergy: 100,
      stats: { ...mockPlayer.stats, critRate: 0 },
    };
    const boss: MonsterData = {
      ...mockTarget,
      id: 'summon-boss',
      name: 'Summon Boss',
      tier: 'BOSS',
      stats: { ...mockTarget.stats, hp: 1000, def: 0 },
      shieldHp: 20,
      maxShieldHp: 20,
      weaknesses: ['FIRE'],
      resistances: { FIRE: -30 },
      gimmicks: [{ trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 2 }],
    };

    const logs = new BattleEngine(player, []).simulateAction('MAGIC_SKILL', boss, 'skill_mage_1');

    expect(boss.shieldBroken).toBe(true);
    expect(logs.some((log) => log.action === 'BOSS_SUMMON')).toBe(true);
  });

  test('SpiritCore atkMultiplier increases party monster follow-up damage', () => {
    const player: CharacterData = {
      ...mockPlayer,
      stats: { ...mockPlayer.stats, atk: 1, critRate: 0 },
      currentEnergy: 0,
    };
    const targetBase: MonsterData = {
      ...mockTarget,
      stats: { ...mockTarget.stats, hp: 1000, def: 0 },
    };
    const targetCore: MonsterData = {
      ...mockTarget,
      stats: { ...mockTarget.stats, hp: 1000, def: 0 },
    };
    const baseMonster: MonsterData = {
      ...mockTarget,
      id: 'ally-base',
      name: 'Base Ally',
      stats: { ...mockTarget.stats, hp: 300, atk: 40, def: 10, critRate: 0 },
    };
    const coreMonster: MonsterData = {
      ...baseMonster,
      id: 'ally-core',
      name: 'Core Ally',
      spiritCore: {
        id: 'core-2x',
        name: '怨霊の霊核',
        atkMultiplier: 2,
      },
    };

    const baseLogs = new BattleEngine({ ...player }, [baseMonster]).simulateAction('PHYSICAL_ATTACK', targetBase);
    const coreLogs = new BattleEngine({ ...player }, [coreMonster]).simulateAction('PHYSICAL_ATTACK', targetCore);
    const baseDamage = baseLogs.find(log => log.action === 'MONSTER_ATTACK')?.damage ?? 0;
    const coreDamage = coreLogs.find(log => log.action === 'MONSTER_ATTACK')?.damage ?? 0;

    expect(baseDamage).toBe(40);
    expect(coreDamage).toBe(80);
    expect(coreLogs.find(log => log.action === 'MONSTER_ATTACK')?.description).toContain('怨霊の霊核');
  });
});
