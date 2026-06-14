import type { EnemyData, StageData } from '../types/game';
import {
  createNecromancedMonster,
  getNecromanceRateForEnemy,
  getNecromanceRateForTier,
  getOwnedMonsterMasterIds,
  getStageNecromanceCandidateEnemyIds,
  rollStageNecromance,
} from './NecromanceCaptureSystem';

function enemy(id: string, tier: EnemyData['tier']): EnemyData {
  return {
    id,
    name: id,
    nameJa: `${id}-ja`,
    nameEn: id.toUpperCase(),
    tier,
    tribe: tier === 'BOSS' ? 'DRAGON' : 'UNDEAD',
    stats: { hp: 10, atk: 3, def: 2, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
    resistances: { LIGHT: -20 },
    weaknesses: ['LIGHT'],
    dropTable: [],
  };
}

const enemies = {
  minion_a: enemy('minion_a', 'MINION'),
  elite_a: enemy('elite_a', 'ELITE'),
  boss_a: enemy('boss_a', 'BOSS'),
};

function stage(enemyIds: string[]): Pick<StageData, 'waves'> {
  return {
    waves: [
      { label: 'WAVE 1', role: 'WARMUP', enemyIds, intent: '' },
    ],
  };
}

describe('NecromanceCaptureSystem', () => {
  test('defines a very low boss capture rate', () => {
    expect(getNecromanceRateForTier('MINION')).toBe(0.12);
    expect(getNecromanceRateForTier('ELITE')).toBe(0.04);
    expect(getNecromanceRateForTier('BOSS')).toBe(0.001);
  });

  test('deduplicates stage candidates by enemy master id', () => {
    expect(getStageNecromanceCandidateEnemyIds(stage(['minion_a', 'minion_a', 'elite_a']))).toEqual([
      'minion_a',
      'elite_a',
    ]);
  });

  test('skips already owned monster master ids before rolling', () => {
    const results = rollStageNecromance({
      stage: stage(['minion_a', 'elite_a']),
      enemies,
      ownedMonsterMasterIds: ['minion_a'],
      rng: () => 0,
      idFactory: (enemyId) => `owned-test-${enemyId}`,
    });

    expect(results.map((result) => result.enemyId)).toEqual(['elite_a']);
  });

  test('rolls independently by tier and creates MonsterData from EnemyData', () => {
    const rolls = [0.11, 0.039, 0.0009];
    const results = rollStageNecromance({
      stage: stage(['minion_a', 'elite_a', 'boss_a']),
      enemies,
      rng: () => rolls.shift() ?? 1,
      idFactory: (enemyId) => `necro-${enemyId}`,
    });

    expect(results).toHaveLength(3);
    expect(results[0].monster).toMatchObject({
      id: 'necro-minion_a',
      masterId: 'minion_a',
      name: 'minion_a-ja',
      cost: 1,
      tier: 'MINION',
    });
    expect(results[1].monster.cost).toBe(2);
    expect(results[2].monster.cost).toBe(4);
  });

  test('does not capture when roll is equal to or above the rate', () => {
    const results = rollStageNecromance({
      stage: stage(['boss_a']),
      enemies,
      rng: () => 0.001,
      idFactory: (enemyId) => `miss-${enemyId}`,
    });

    expect(results).toHaveLength(0);
  });

  test('uses masterId for owned checks with id fallback for legacy local monsters', () => {
    expect(getOwnedMonsterMasterIds([
      { id: 'legacy-goblin' },
      { id: 'instance-1', masterId: 'grave_soldier' },
    ])).toEqual(['legacy-goblin', 'grave_soldier']);
  });

  test('createNecromancedMonster preserves battle stats and resistances', () => {
    const monster = createNecromancedMonster(enemies.boss_a, (enemyId) => `id-${enemyId}`);

    expect(monster.stats).toEqual(enemies.boss_a.stats);
    expect(monster.resistances).toEqual(enemies.boss_a.resistances);
    expect(monster.weaknesses).toEqual(['LIGHT']);
    expect(monster.tribe).toBe('DRAGON');
  });

  test('enemy necromance config overrides rate, ally cost, stats, and skills', () => {
    const customEnemy: EnemyData = {
      ...enemies.elite_a,
      necromance: {
        captureRate: 0.25,
        allyCost: 5,
        allyStats: { hp: 44, atk: 9, def: 8, spd: 77, critRate: 3, critDmg: 160, effectHit: 6, effectRes: 4 },
        allyMaxEnergy: 44,
        skillIds: ['skill_necromancer_grave_command'],
      },
    };

    expect(getNecromanceRateForEnemy(customEnemy)).toBe(0.25);
    const monster = createNecromancedMonster(customEnemy, (enemyId) => `custom-${enemyId}`);

    expect(monster).toMatchObject({
      id: 'custom-elite_a',
      masterId: 'elite_a',
      cost: 5,
      skillIds: ['skill_necromancer_grave_command'],
      currentEnergy: 44,
      maxEnergy: 44,
      stats: customEnemy.necromance?.allyStats,
    });
  });

  test('custom capture rate is clamped to 0-1', () => {
    expect(getNecromanceRateForEnemy({ ...enemies.minion_a, necromance: { captureRate: 2 } })).toBe(1);
    expect(getNecromanceRateForEnemy({ ...enemies.minion_a, necromance: { captureRate: -0.5 } })).toBe(0);
  });
});
