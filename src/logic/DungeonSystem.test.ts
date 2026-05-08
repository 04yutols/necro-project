import stagesData from '../data/master/stages.json';
import enemiesData from '../data/master/enemies.json';
import {
  getHiddenDropCount,
  getNextAvailableStage,
  getPrimaryWeaknesses,
  getStageProgressState,
  getStageWaveSummaries,
  getVisibleDropTable,
} from './DungeonSystem';
import type { EnemyData, StageData } from '../types/game';

const STAGES = stagesData as Record<string, StageData>;
const ENEMIES = enemiesData as Record<string, EnemyData>;

describe('DungeonSystem', () => {
  test('unlocks first dungeon without prerequisites and locks later boss nodes', () => {
    expect(getStageProgressState(STAGES.area1_node1, [])).toBe('AVAILABLE');
    expect(getStageProgressState(STAGES.area1_boss, [])).toBe('LOCKED');
    expect(getStageProgressState(STAGES.area1_boss, ['area1_node1', 'area1_node2'])).toBe('AVAILABLE');
  });

  test('returns the next uncleared available dungeon in progression order', () => {
    expect(getNextAvailableStage(STAGES, [])?.id).toBe('area1_node1');
    expect(getNextAvailableStage(STAGES, ['area1_node1'])?.id).toBe('area1_node2');
    expect(getNextAvailableStage(STAGES, ['area1_node1', 'area1_node2'])?.id).toBe('area1_boss');
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
      expect.arrayContaining(['LIGHT', 'THUNDER'])
    );
  });
});
