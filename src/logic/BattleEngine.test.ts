import { BattleEngine } from './BattleEngine';
import { CharacterData, MonsterData, SkillAttackType } from '../types/game';

describe('BattleEngine', () => {
  beforeEach(() => {
    mockPlayer.currentEnergy = 0;
    enemySeq = 0;
  });

  let enemySeq = 0;

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

  const createPlayer = (
    stats: Partial<CharacterData['stats']> = {},
    extra: Partial<CharacterData> = {},
  ): CharacterData => ({
    ...mockPlayer,
    ...extra,
    baseStats: { ...mockPlayer.baseStats, ...stats },
    stats: { ...mockPlayer.stats, ...stats },
    equipment: { ...mockPlayer.equipment },
    passives: { ...mockPlayer.passives },
    jobs: [...mockPlayer.jobs],
    statusEffects: extra.statusEffects,
    currentEnergy: extra.currentEnergy ?? 0,
    maxEnergy: extra.maxEnergy ?? mockPlayer.maxEnergy,
    elementDmgBoosts: { ...mockPlayer.elementDmgBoosts, ...extra.elementDmgBoosts },
  });

  const createEnemy = (stats: Partial<MonsterData['stats']> = {}): MonsterData => ({
    ...mockTarget,
    id: `enemy-${enemySeq++}`,
    stats: { ...mockTarget.stats, ...stats },
  });

  const expectedBaseAttackTypes: Record<string, SkillAttackType> = {
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

  test('tracks enemy current HP without mutating shared enemy stats', () => {
    const player = createPlayer({ hp: 500, atk: 50, def: 30, critRate: 0 });
    const enemy = createEnemy({ hp: 500, atk: 1, def: 0 });
    const originalStats = enemy.stats;
    const engine = new BattleEngine(player, []);

    const firstLogs = engine.simulateAction('PHYSICAL_ATTACK', enemy);
    const firstDamage = firstLogs.find(log => log.action === 'PHYSICAL_ATTACK')?.damage ?? 0;

    expect(enemy.stats).toBe(originalStats);
    expect(enemy.stats.hp).toBe(500);
    expect(engine.getEnemyCurrentHp(enemy.id)).toBe(500 - firstDamage);

    const secondLogs = engine.simulateAction('PHYSICAL_ATTACK', enemy);
    const secondDamage = secondLogs.find(log => log.action === 'PHYSICAL_ATTACK')?.damage ?? 0;

    expect(enemy.stats).toBe(originalStats);
    expect(enemy.stats.hp).toBe(500);
    expect(engine.getEnemyCurrentHp(enemy.id)).toBe(500 - firstDamage - secondDamage);
  });

  test('Energy is gained on attack', () => {
    const engine = new BattleEngine(mockPlayer, []);
    engine.simulateAction('PHYSICAL_ATTACK', mockTarget);
    expect(mockPlayer.currentEnergy).toBe(20); // 0 + 20
  });

  test('normal attack SP gain uses current job energyRegen', () => {
    const roguePlayer: CharacterData = {
      ...mockPlayer,
      currentJobId: 'rogue',
      currentEnergy: 0,
      maxEnergy: 90,
    };
    const engine = new BattleEngine(roguePlayer, []);

    engine.simulateAction('PHYSICAL_ATTACK', mockTarget);

    expect(roguePlayer.currentEnergy).toBe(22);
  });

  test.each(Object.entries(expectedBaseAttackTypes))(
    'normal attack log uses %s base attack type',
    (jobId, expectedAttackType) => {
      const player = createPlayer(
        { hp: 500, atk: 50, def: 999, critRate: 0 },
        { currentJobId: jobId },
      );
      const enemy = createEnemy({ hp: 500, atk: 1, def: 0, effectRes: 100 });

      const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', enemy);

      expect(logs.find(log => log.action === 'PHYSICAL_ATTACK')?.attackType).toBe(expectedAttackType);
    },
  );

  test('normal attack log falls back to slash for unknown legacy jobs', () => {
    const player = createPlayer(
      { hp: 500, atk: 50, def: 999, critRate: 0 },
      { currentJobId: 'legacy_job_without_master' },
    );
    const enemy = createEnemy({ hp: 500, atk: 1, def: 0, effectRes: 100 });

    const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', enemy);

    expect(logs.find(log => log.action === 'PHYSICAL_ATTACK')?.attackType).toBe('SLASH');
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

  test('ALL_ENEMIES skills damage every alive enemy candidate with one energy payment', () => {
    const player = createPlayer(
      { hp: 500, atk: 120, def: 999, critRate: 0 },
      { currentEnergy: 50, maxEnergy: 100 },
    );
    const enemyA = createEnemy({ hp: 500, atk: 1, def: 0 });
    const enemyB = createEnemy({ hp: 500, atk: 1, def: 0 });
    const enemyC = createEnemy({ hp: 500, atk: 1, def: 0 });
    enemyA.name = 'Enemy-A';
    enemyB.name = 'Enemy-B';
    enemyC.name = 'Enemy-C';

    const engine = new BattleEngine(player, []);
    const logs = engine.simulateAction(
      'MAGIC_SKILL',
      enemyA,
      'skill_warrior_wind_slash',
      [enemyA, enemyB, enemyC],
    );
    const skillLogs = logs.filter(log => log.action === 'MAGIC_SKILL');

    expect(skillLogs.map(log => log.targetName)).toEqual(['Enemy-A', 'Enemy-B', 'Enemy-C']);
    expect(skillLogs.every(log => log.description.includes('敵全体'))).toBe(true);
    expect(engine.getEnemyCurrentHp(enemyA.id)).toBeLessThan(500);
    expect(engine.getEnemyCurrentHp(enemyB.id)).toBeLessThan(500);
    expect(engine.getEnemyCurrentHp(enemyC.id)).toBeLessThan(500);
    expect(player.currentEnergy).toBe(61);
  });

  test('single target skills keep damaging only the selected enemy even with enemy candidates', () => {
    const player = createPlayer(
      { hp: 500, atk: 120, def: 999, critRate: 0 },
      { currentEnergy: 50, maxEnergy: 100 },
    );
    const enemyA = createEnemy({ hp: 500, atk: 1, def: 0 });
    const enemyB = createEnemy({ hp: 500, atk: 1, def: 0 });
    const enemyC = createEnemy({ hp: 500, atk: 1, def: 0 });
    enemyA.name = 'Enemy-A';
    enemyB.name = 'Enemy-B';
    enemyC.name = 'Enemy-C';

    const engine = new BattleEngine(player, []);
    const logs = engine.simulateAction(
      'MAGIC_SKILL',
      enemyA,
      'skill_mage_1',
      [enemyA, enemyB, enemyC],
    );
    const skillLogs = logs.filter(log => log.action === 'MAGIC_SKILL');

    expect(skillLogs.map(log => log.targetName)).toEqual(['Enemy-A']);
    expect(engine.getEnemyCurrentHp(enemyA.id)).toBeLessThan(500);
    expect(engine.getEnemyCurrentHp(enemyB.id)).toBeUndefined();
    expect(engine.getEnemyCurrentHp(enemyC.id)).toBeUndefined();
    expect(player.currentEnergy).toBe(53);
  });

  test('drain skill restores HP from actual HP damage dealt', () => {
    const player = createPlayer(
      { hp: 100, atk: 120, def: 999, critRate: 0 },
      { currentJobId: 'dark_priest', category: 'MAGICAL', currentEnergy: 100, maxEnergy: 100 },
    );
    const ally = createEnemy({ hp: 300, atk: 0, def: 999, critRate: 0 });
    const enemy = createEnemy({ hp: 1000, atk: 1, def: 0 });
    const engine = new BattleEngine(player, [ally]);
    player.stats.hp = 50;

    const logs = engine.simulateAction('MAGIC_SKILL', enemy, 'skill_darkpriest_1');
    const attackLog = logs.find(log => log.action === 'MAGIC_SKILL');
    const healLog = logs.find(log => log.action === 'HEAL');
    const expectedHeal = Math.floor((attackLog?.damage ?? 0) * 0.3);

    expect(healLog?.damage).toBe(expectedHeal);
    expect(healLog?.description).toContain('ドレイン');
    expect(healLog?.playerHP).toBe(50 + expectedHeal);
    expect(player.stats.hp).toBe(50 + expectedHeal);
  });

  test('drain skill healing is capped by battle-start player max HP', () => {
    const player = createPlayer(
      { hp: 100, atk: 120, def: 999, critRate: 0 },
      { currentJobId: 'dark_priest', category: 'MAGICAL', currentEnergy: 100, maxEnergy: 100 },
    );
    const ally = createEnemy({ hp: 300, atk: 0, def: 999, critRate: 0 });
    const enemy = createEnemy({ hp: 1000, atk: 1, def: 0 });
    const engine = new BattleEngine(player, [ally]);
    player.stats.hp = 95;

    const logs = engine.simulateAction('MAGIC_SKILL', enemy, 'skill_darkpriest_1');
    const healLog = logs.find(log => log.action === 'HEAL');

    expect(healLog?.damage).toBe(5);
    expect(healLog?.playerHP).toBe(100);
    expect(player.stats.hp).toBe(100);
  });

  test('drain skill ignores overkill damage when calculating healing', () => {
    const player = createPlayer(
      { hp: 100, atk: 120, def: 999, critRate: 0 },
      { currentJobId: 'dark_priest', category: 'MAGICAL', currentEnergy: 100, maxEnergy: 100 },
    );
    const ally = createEnemy({ hp: 300, atk: 0, def: 999, critRate: 0 });
    const enemy = createEnemy({ hp: 10, atk: 1, def: 0 });
    const engine = new BattleEngine(player, [ally]);
    player.stats.hp = 10;

    const logs = engine.simulateAction('MAGIC_SKILL', enemy, 'skill_darkpriest_1');
    const attackLog = logs.find(log => log.action === 'MAGIC_SKILL');
    const healLog = logs.find(log => log.action === 'HEAL');

    expect(attackLog?.damage).toBeGreaterThan(10);
    expect(healLog?.damage).toBe(3);
    expect(healLog?.playerHP).toBe(13);
    expect(player.stats.hp).toBe(13);
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

  test('direct enemy damage can defeat the player when no party monsters remain', () => {
    const player = createPlayer({ hp: 30, atk: 1, def: 0, critRate: 0 });
    const enemy = createEnemy({ hp: 500, atk: 90, def: 999 });

    const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', enemy);

    expect(player.stats.hp).toBe(0);
    expect(logs.find(log => log.action === 'ENEMY_ATTACK' && log.targetName === player.name)?.playerHP).toBe(0);
    expect(logs.find(log => log.action === 'PLAYER_DEFEATED')?.description).toContain('倒れた');
  });

  test('player runtime HP mutations use CharacterData.stats without touching baseStats', () => {
    const player = createPlayer({ hp: 30, atk: 1, def: 0, critRate: 0 });
    player.baseStats = { ...player.baseStats!, hp: 999 };
    const enemy = createEnemy({ hp: 500, atk: 90, def: 999 });

    const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', enemy);

    expect(player.stats.hp).toBe(0);
    expect(player.baseStats?.hp).toBe(999);
    expect(logs.find(log => log.action === 'PLAYER_DEFEATED')?.playerHP).toBe(0);
  });

  test('lethal player status damage stops the action and emits defeat log', () => {
    const player = createPlayer(
      { hp: 10, atk: 50, def: 30, critRate: 0 },
      {
        statusEffects: [{
          type: 'BLEED',
          remainingTurns: 2,
          stackCount: 1,
          sourceAtk: 300,
          stacks: [{ remainingTurns: 2, sourceAtk: 300 }],
        }],
      },
    );
    const enemy = createEnemy({ hp: 500, atk: 10, def: 10 });

    const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', enemy);

    expect(player.stats.hp).toBe(0);
    expect(logs.some(log => log.action === 'AILMENT_TICK')).toBe(true);
    expect(logs.some(log => log.action === 'PHYSICAL_ATTACK')).toBe(false);
    expect(logs.find(log => log.action === 'PLAYER_DEFEATED')?.description).toContain('状態異常');
  });

  test('player poison damage uses battle-start max HP instead of current HP', () => {
    const player = createPlayer({ hp: 1000, atk: 1, def: 999, critRate: 0 });
    const ally = createEnemy({ hp: 500, atk: 1, def: 999, critRate: 0 });
    const enemy = createEnemy({ hp: 500, atk: 1, def: 999 });
    const engine = new BattleEngine(player, [ally]);

    player.stats.hp = 100;
    player.statusEffects = [{
      type: 'POISON',
      remainingTurns: 2,
      stackCount: 1,
    }];

    const logs = engine.simulateAction('PHYSICAL_ATTACK', enemy);
    const tick = logs.find(log => log.action === 'AILMENT_TICK' && log.ailmentTick === 'POISON');

    expect(tick?.damage).toBe(30);
    expect(player.stats.hp).toBe(70);
  });

  test('paralysis skip loses only the player action while enemy counterattack still resolves', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.25);
    const player = createPlayer(
      { hp: 200, atk: 50, def: 0, critRate: 0 },
      {
        statusEffects: [{
          type: 'PARALYSIS',
          remainingTurns: 2,
          stackCount: 1,
        }],
      },
    );
    const enemy = createEnemy({ hp: 500, atk: 60, def: 10 });

    try {
      const logs = new BattleEngine(player, []).simulateAction('PHYSICAL_ATTACK', enemy);

      expect(logs.some(log => log.action === 'AILMENT_SKIP')).toBe(true);
      expect(logs.some(log => log.action === 'STATUS_SKIP')).toBe(true);
      expect(logs.some(log => log.action === 'PHYSICAL_ATTACK')).toBe(false);
      expect(logs.some(log => log.action === 'MONSTER_ATTACK')).toBe(false);
      expect(logs.some(log => log.action === 'ENEMY_ATTACK')).toBe(true);
      expect(player.stats.hp).toBeLessThan(200);
      expect(player.currentEnergy).toBe(0);
      expect(player.statusEffects?.[0]?.remainingTurns).toBe(1);
    } finally {
      randomSpy.mockRestore();
    }
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

    const engine = new BattleEngine(player, []);
    const logs = engine.simulateAction('PHYSICAL_ATTACK', boss);

    expect(engine.getEnemyCurrentHp(boss.id)).toBe(500);
    expect(boss.stats.hp).toBe(1000);
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

    const engine = new BattleEngine(player, []);
    const logs = engine.simulateAction('PHYSICAL_ATTACK', boss);

    expect(engine.getEnemyCurrentHp(boss.id)).toBe(400);
    expect(boss.stats.hp).toBe(1000);
    expect(logs.some((log) => log.action === 'BOSS_REVIVE')).toBe(false);
  });

  test('SUMMON_MINIONS materializes minions when spiritual shield breaks', () => {
    const player: CharacterData = {
      ...mockPlayer,
      currentEnergy: 100,
      stats: { ...mockPlayer.stats, critRate: 0 },
    };
    const boss: MonsterData = {
      ...mockTarget,
      id: 'blood_mire_queen',
      name: 'Bloodmire Queen',
      tier: 'BOSS',
      stats: { ...mockTarget.stats, hp: 1000, def: 0 },
      shieldHp: 20,
      maxShieldHp: 20,
      weaknesses: ['FIRE'],
      resistances: { FIRE: -30 },
      gimmicks: [{ trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 2 }],
    };

    const engine = new BattleEngine(player, []);
    const logs = engine.simulateAction('MAGIC_SKILL', boss, 'skill_mage_1');
    const summoned = engine.getSummonedEnemies();

    expect(boss.shieldBroken).toBe(true);
    expect(logs.some((log) => log.action === 'BOSS_SUMMON')).toBe(true);
    expect(summoned.map(enemy => enemy.name)).toEqual(['血沼の蛭', '腐敗猟犬']);
    expect(engine.getPendingSummons()).toEqual(summoned.map(enemy => enemy.id));
    expect(engine.consumePendingSummons()).toEqual(summoned.map(enemy => enemy.id));
    expect(engine.getPendingSummons()).toEqual([]);
    expect(summoned.every(enemy => engine.getEnemyCurrentHp(enemy.id) === enemy.stats.hp)).toBe(true);
  });

  test('summoned minions join later player AoE and follow-up target candidates', () => {
    const player = createPlayer(
      { hp: 500, atk: 120, def: 999, critRate: 0 },
      { currentEnergy: 100, maxEnergy: 100 },
    );
    const boss: MonsterData = {
      ...mockTarget,
      id: 'blood_mire_queen',
      name: 'Bloodmire Queen',
      tier: 'BOSS',
      stats: { ...mockTarget.stats, hp: 1000, atk: 1, def: 0 },
      shieldHp: 20,
      maxShieldHp: 20,
      weaknesses: ['FIRE'],
      resistances: { FIRE: -30 },
      gimmicks: [{ trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 2 }],
    };
    const ally1 = createEnemy({ hp: 300, atk: 30, def: 10, critRate: 0 });
    const ally2 = createEnemy({ hp: 300, atk: 30, def: 10, critRate: 0 });
    const engine = new BattleEngine(player, [ally1, ally2]);

    engine.simulateAction('MAGIC_SKILL', boss, 'skill_mage_1');
    const summoned = engine.getSummonedEnemies();
    expect(summoned).toHaveLength(2);

    const logs = engine.simulateAction('MAGIC_SKILL', boss, 'skill_warrior_wind_slash');
    const skillTargets = logs
      .filter(log => log.action === 'MAGIC_SKILL')
      .map(log => log.targetName);
    const followUpTargets = logs
      .filter(log => log.action === 'MONSTER_ATTACK')
      .map(log => log.targetName);

    expect(skillTargets).toEqual(['Bloodmire Queen', '血沼の蛭', '腐敗猟犬']);
    expect(followUpTargets).toEqual(['Bloodmire Queen', '血沼の蛭']);
  });

  test('party follow-ups spread across alive enemy candidates', () => {
    const player = createPlayer({ hp: 500, atk: 1, def: 999, critRate: 0 });
    const enemyA = createEnemy({ hp: 500, atk: 1, def: 0 });
    const enemyB = createEnemy({ hp: 500, atk: 1, def: 0 });
    const enemyC = createEnemy({ hp: 500, atk: 1, def: 0 });
    const ally1 = createEnemy({ hp: 300, atk: 40, def: 10, critRate: 0 });
    const ally2 = createEnemy({ hp: 300, atk: 40, def: 10, critRate: 0 });
    const ally3 = createEnemy({ hp: 300, atk: 40, def: 10, critRate: 0 });
    ally1.name = 'Ally-1';
    ally2.name = 'Ally-2';
    ally3.name = 'Ally-3';
    enemyA.name = 'Enemy-A';
    enemyB.name = 'Enemy-B';
    enemyC.name = 'Enemy-C';

    const logs = new BattleEngine(player, [ally1, ally2, ally3])
      .simulateAction('PHYSICAL_ATTACK', enemyA, undefined, [enemyA, enemyB, enemyC]);
    const followUps = logs.filter(log => log.action === 'MONSTER_ATTACK');

    expect(followUps.map(log => log.targetName)).toEqual(['Enemy-A', 'Enemy-B', 'Enemy-C']);
  });

  test('party follow-ups retarget alive enemies after the preferred target falls', () => {
    const player = createPlayer({ hp: 500, atk: 1000, def: 999, critRate: 0 });
    const defeatedTarget = createEnemy({ hp: 20, atk: 1, def: 0 });
    const aliveTarget = createEnemy({ hp: 500, atk: 1, def: 0 });
    const ally1 = createEnemy({ hp: 300, atk: 40, def: 10, critRate: 0 });
    const ally2 = createEnemy({ hp: 300, atk: 40, def: 10, critRate: 0 });
    defeatedTarget.name = 'Fallen Target';
    aliveTarget.name = 'Alive Target';

    const engine = new BattleEngine(player, [ally1, ally2]);
    const logs = engine.simulateAction(
      'PHYSICAL_ATTACK',
      defeatedTarget,
      undefined,
      [defeatedTarget, aliveTarget],
    );
    const followUps = logs.filter(log => log.action === 'MONSTER_ATTACK');

    expect(engine.getEnemyCurrentHp(defeatedTarget.id)).toBe(0);
    expect(followUps).toHaveLength(2);
    expect(followUps.every(log => log.targetName === 'Alive Target')).toBe(true);
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
