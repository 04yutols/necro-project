import { makeBaseStats, makeCharacter, makeMonster } from '../../testing/factories';
import type { EnemyData, SkillData, StageData } from '../../types/game';
import { runGameplaySimulation, runStageGameplaySimulation } from './gameplaySimulation';

const aoeSkill: SkillData = {
  id: 'phase2_aoe', name: '試験波動', mpCost: 5, power: 1.5,
  type: 'MAGICAL', element: 'DARK', attackType: 'MAGIC', targetType: 'ALL_ENEMIES',
  description: 'シミュレーション専用草稿。',
};

function config() {
  return {
    player: makeCharacter({ stats: makeBaseStats({ hp: 500, atk: 50, def: 40, critRate: 0 }), currentEnergy: 100, maxEnergy: 100 }),
    party: [null, null, null] as [null, null, null],
    enemies: [
      makeMonster({ id: 'enemy-a', cost: 0, stats: makeBaseStats({ hp: 180, atk: 5, def: 10, critRate: 0 }) }),
      makeMonster({ id: 'enemy-b', cost: 0, stats: makeBaseStats({ hp: 180, atk: 5, def: 10, critRate: 0 }) }),
      makeMonster({ id: 'enemy-c', cost: 0, stats: makeBaseStats({ hp: 180, atk: 5, def: 10, critRate: 0 }) }),
    ],
    skill: aoeSkill,
    targets: {
      ttkTurns: { min: 1, max: 10 }, incomingDamagePct: { min: 0, max: 100 },
      aoeValue: { min: 2.5, max: 3.2 }, partyCost: { min: 0, max: 6 },
    },
  };
}

describe('gameplaySimulation', () => {
  test('runs draft skill through the actual BattleEngine deterministically', () => {
    const first = runGameplaySimulation(config());
    const second = runGameplaySimulation(config());

    expect(first.engine).toBe('BattleEngine');
    expect(first.metrics.aoeValue.value).toBe(3);
    expect(first.actionOrder).toHaveLength(4);
    expect(first.turns).toEqual(second.turns);
    expect(first.overall).toBe('PASS');
  });

  test('marks values far outside their target range as FAIL', () => {
    const input = config();
    input.targets.ttkTurns = { min: 20, max: 30 };
    const report = runGameplaySimulation(input);

    expect(report.metrics.ttkTurns.status).toBe('FAIL');
    expect(report.overall).toBe('FAIL');
  });

  test('aggregates every StageData wave through BattleEngine', () => {
    const base = config();
    const stage = {
      id: 'phase2_stage', waves: [
        { label: 'WAVE 1', role: 'WARMUP', enemyIds: ['stage_enemy'], intent: 'test' },
        { label: 'WAVE 2', role: 'ELITE', enemyIds: ['stage_enemy'], intent: 'test', statScale: { hp: 1.5 } },
      ],
    } as unknown as StageData;
    const source = base.enemies[0];
    const enemy = {
      id: 'stage_enemy', name: 'Stage Enemy', nameJa: '試験敵', nameEn: 'STAGE ENEMY', tier: 'MINION', tribe: source.tribe,
      stats: source.stats, resistances: {}, weaknesses: [], dropTable: [],
    } satisfies EnemyData;
    const report = runStageGameplaySimulation(stage, { stage_enemy: enemy }, {
      player: base.player, party: base.party, skill: aoeSkill,
      targets: { ttkTurns: { min: 1, max: 30 }, incomingDamagePct: { min: 0, max: 200 }, aoeValue: { min: 2.5, max: 3.2 }, partyCost: { min: 0, max: 6 } },
    });

    expect(report.stageId).toBe('phase2_stage');
    expect(report.waves).toHaveLength(2);
    expect(report.metrics.ttkTurns.value).toBe(report.waves[0].report.metrics.ttkTurns.value + report.waves[1].report.metrics.ttkTurns.value);
    expect(report.waves.every(wave => wave.report.engine === 'BattleEngine')).toBe(true);
  });
});
