import { applyEnemyStatScale } from './EnemyScaling';
import type { EnemyData } from '../types/game';

function enemyFixture(): EnemyData {
  return {
    id: 'scaled_enemy',
    name: 'Scaled Enemy',
    nameJa: 'Scaled Enemy',
    nameEn: 'SCALED ENEMY',
    tier: 'ELITE',
    tribe: 'UNDEAD',
    stats: {
      hp: 101,
      atk: 41,
      def: 22,
      spd: 93,
      critRate: 7.5,
      critDmg: 160,
      effectHit: 12,
      effectRes: 18,
    },
    resistances: { DARK: 20, LIGHT: -10 },
    weaknesses: ['LIGHT'],
    shieldHp: 30,
    maxShieldHp: 30,
    gimmicks: [{ trigger: 'TURN_3', effect: 'SUMMON_MINIONS', value: 1 }],
    necromance: {
      captureRate: 0.2,
      allyCost: 4,
      allyStats: {
        hp: 80,
        atk: 25,
        def: 12,
        spd: 90,
        critRate: 5,
        critDmg: 150,
        effectHit: 0,
        effectRes: 0,
      },
      skillIds: ['skill_a'],
    },
    dropTable: [{ type: 'MATERIAL', itemId: 'bone_chip', rate: 0.5 }],
    battle: { color: '#8B00FF', sprite: 'GIANT', size: 0.9 },
    description: 'fixture',
  };
}

describe('applyEnemyStatScale', () => {
  it('clones the enemy and keeps master data immutable', () => {
    const enemy = enemyFixture();
    const scaled = applyEnemyStatScale(enemy, { hp: 1.5, atk: 2, def: 0.5 });

    expect(scaled).not.toBe(enemy);
    expect(scaled.stats).not.toBe(enemy.stats);
    expect(scaled.resistances).not.toBe(enemy.resistances);
    expect(scaled.weaknesses).not.toBe(enemy.weaknesses);
    expect(scaled.dropTable).not.toBe(enemy.dropTable);
    expect(enemy.stats).toEqual(enemyFixture().stats);
  });

  it('treats omitted scale values as 1.0', () => {
    const scaled = applyEnemyStatScale(enemyFixture(), { hp: 2 });

    expect(scaled.stats.hp).toBe(202);
    expect(scaled.stats.atk).toBe(41);
    expect(scaled.stats.def).toBe(22);
  });

  it('uses Math.floor for hp atk and def scaling', () => {
    const scaled = applyEnemyStatScale(enemyFixture(), { hp: 1.25, atk: 1.1, def: 1.9 });

    expect(scaled.stats.hp).toBe(126);
    expect(scaled.stats.atk).toBe(45);
    expect(scaled.stats.def).toBe(41);
  });

  it('does not scale speed percentage stats or resistances', () => {
    const enemy = enemyFixture();
    const scaled = applyEnemyStatScale(enemy, { hp: 2, atk: 2, def: 2 });

    expect(scaled.stats.spd).toBe(enemy.stats.spd);
    expect(scaled.stats.critRate).toBe(enemy.stats.critRate);
    expect(scaled.stats.critDmg).toBe(enemy.stats.critDmg);
    expect(scaled.stats.effectHit).toBe(enemy.stats.effectHit);
    expect(scaled.stats.effectRes).toBe(enemy.stats.effectRes);
    expect(scaled.resistances).toEqual(enemy.resistances);
  });
});
