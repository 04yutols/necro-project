import stagesData from '../data/master/stages.json';
import enemiesData from '../data/master/enemies.json';
import {
  getHiddenDropCount,
  getNextAvailableStage,
  getPrimaryWeaknesses,
  getStageProgressState,
  getStageList,
  getStageWaveSummaries,
  getVisibleDropTable,
} from './DungeonSystem';
import type { EnemyData, StageData } from '../types/game';

const STAGES = stagesData as Record<string, StageData>;
const ENEMIES = enemiesData as Record<string, EnemyData>;

function makeStage(id: string, overrides: Partial<StageData> = {}): StageData {
  return {
    id,
    name: id,
    nameJa: id,
    nameEn: id.toUpperCase(),
    chapter: 1,
    chapterName: '亡国の王都',
    area: 1,
    nodeType: 'DUNGEON',
    element: 'NONE',
    difficulty: 1,
    description: id,
    waveCount: 1,
    areaGimmick: 'NONE',
    unlockRequires: [],
    waves: [{ label: 'WAVE 1', role: 'WARMUP', enemyIds: ['grave_soldier'], intent: 'test' }],
    rewards: { baseExp: 1, baseGold: 1, dropTable: [] },
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('DungeonSystem', () => {
  test('unlocks first dungeon without prerequisites and locks later boss nodes', () => {
    expect(getStageProgressState(STAGES.area1_node1, [])).toBe('AVAILABLE');
    expect(getStageProgressState(STAGES.area1_boss, [])).toBe('LOCKED');
    expect(getStageProgressState(STAGES.area1_boss, [
      'area1_node1',
      'area1_a2',
      'area1_a_mini',
      'area1_node2',
      'area1_b2',
      'area1_b3',
      'area1_c1',
      'area1_c2',
      'area1_c3',
    ])).toBe('AVAILABLE');
  });

  test('returns the next uncleared available dungeon in progression order', () => {
    expect(getNextAvailableStage(STAGES, [])?.id).toBe('area1_node1');
    expect(getNextAvailableStage(STAGES, ['area1_node1'])?.id).toBe('area1_a2');
    expect(getNextAvailableStage(STAGES, [
      'area1_node1',
      'area1_a2',
      'area1_a_mini',
    ])?.id).toBe('area1_node2');
    expect(getNextAvailableStage(STAGES, [
      'area1_node1',
      'area1_a2',
      'area1_a_mini',
      'area1_node2',
      'area1_b2',
      'area1_b3',
      'area1_c1',
      'area1_c2',
      'area1_c3',
    ])?.id).toBe('area1_boss');
  });

  test('orders stages by explicit sortOrder before difficulty and id', () => {
    const stages = {
      late: makeStage('late', { difficulty: 0, sortOrder: 30 }),
      early: makeStage('early', { difficulty: 5, sortOrder: 10 }),
      middle: makeStage('middle', { difficulty: 2, sortOrder: 20 }),
    };

    expect(getStageList(stages).map(stage => stage.id)).toEqual(['early', 'middle', 'late']);
  });

  test('falls back to chapter, difficulty, and id when sortOrder is unset', () => {
    const stages = {
      z_ch1: makeStage('z_ch1', { chapter: 1, difficulty: 2 }),
      a_ch1: makeStage('a_ch1', { chapter: 1, difficulty: 1 }),
      a_ch2: makeStage('a_ch2', { chapter: 2, difficulty: 0 }),
    };

    expect(getStageList(stages).map(stage => stage.id)).toEqual(['a_ch1', 'z_ch1', 'a_ch2']);
  });

  test('keeps sortOrder stages before unset stages, then uses fallback ordering', () => {
    const stages = {
      legacy_late: makeStage('legacy_late', { difficulty: 4 }),
      ordered_second: makeStage('ordered_second', { difficulty: 5, sortOrder: 20 }),
      legacy_early: makeStage('legacy_early', { difficulty: 1 }),
      ordered_first: makeStage('ordered_first', { difficulty: 5, sortOrder: 10 }),
    };

    expect(getStageList(stages).map(stage => stage.id)).toEqual([
      'ordered_first',
      'ordered_second',
      'legacy_early',
      'legacy_late',
    ]);
  });

  test('builds three-wave summaries with elite shield and boss data', () => {
    const waves = getStageWaveSummaries(STAGES.area1_boss, ENEMIES);

    expect(waves).toHaveLength(3);
    expect(waves[1].enemies.some(enemy => enemy.tier === 'ELITE' && Boolean(enemy.shieldHp))).toBe(true);
    expect(waves[2].enemies[0].tier).toBe('BOSS');
  });

  test('hides hidden unique drops from the normal drop preview', () => {
    const visibleDrops = getVisibleDropTable(STAGES.area1_boss, ENEMIES);

    expect(getHiddenDropCount(STAGES.area1_boss, ENEMIES)).toBeGreaterThan(0);
    expect(visibleDrops.some(drop => drop.itemId === 'grudge_manifest')).toBe(false);
    expect(visibleDrops.some(drop => drop.itemId === 'spirit_silver_saber')).toBe(true);
  });

  test('prioritizes boss and elite weaknesses for party preparation', () => {
    expect(getPrimaryWeaknesses(STAGES.area1_boss, ENEMIES)).toEqual(
      expect.arrayContaining(['LIGHT', 'FIRE'])
    );
  });
});
