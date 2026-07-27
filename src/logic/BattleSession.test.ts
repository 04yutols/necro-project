import type { EnemyData, StageData } from '../types/game';
import { BattleSession } from './BattleSession';

const stats = { hp: 100, atk: 20, def: 10, spd: 80, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 };
const enemy = (id: string, tier: EnemyData['tier'] = 'MINION'): EnemyData => ({
  id, name: id, nameJa: id, nameEn: id, tribe: 'UNDEAD', tier,
  stats: { ...stats }, resistances: {}, weaknesses: [], dropTable: [],
});
const stage = {
  id: 'test', name: 'test', nameJa: '試験', nameEn: 'test', chapter: 1, chapterName: 'test', area: 1,
  difficulty: 1, nodeType: 'BATTLE', waveCount: 1, areaGimmick: 'NONE', unlockRequires: [],
  waves: [{ label: 'WAVE 1', role: 'ELITE', enemyIds: ['minion', 'boss'], statScale: { hp: 2, atk: 1.5, def: 1.2 } }],
  rewards: { baseExp: 100, baseGold: 40, dropTable: [] }, position: { x: 0, y: 0 },
} satisfies StageData;

describe('BattleSession', () => {
  test('builds scaled waves without mutating master enemies', () => {
    const masters = { minion: enemy('minion'), boss: enemy('boss', 'BOSS') };
    const waves = BattleSession.buildWaves(stage, id => masters[id as keyof typeof masters]);
    expect(waves[0].enemies[0].stats).toMatchObject({ hp: 200, atk: 30, def: 12 });
    expect(masters.minion.stats.hp).toBe(100);
    expect(waves[0].rewards).toEqual({ exp: 25, gold: 10 });
  });

  test('fails fast for an unknown enemy reference', () => {
    expect(() => BattleSession.buildWaves(stage, () => undefined)).toThrow('references unknown enemy');
  });

  test('targets the highest tier then lowest HP deterministically', () => {
    const candidates = [
      { id: 'a', hp: 1, tier: 'MINION' as const },
      { id: 'b', hp: 50, tier: 'BOSS' as const },
      { id: 'c', hp: 20, tier: 'BOSS' as const },
    ];
    expect(BattleSession.pickTarget(candidates, {
      isAlive: value => value.hp > 0,
      getTier: value => value.tier,
      getHp: value => value.hp,
    })?.id).toBe('c');
  });
});

