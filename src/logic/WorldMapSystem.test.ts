import areasData from '../data/master/areas.json';
import stagesData from '../data/master/stages.json';
import type { AreaData, StageData } from '../types/game';
import {
  buildWorldAreas,
  getAreaKey,
  getAreaMasterId,
  getCurrentWorldArea,
  getWorldAreaStages,
} from './WorldMapSystem';

const AREAS = areasData as Record<string, AreaData>;
const STAGES = stagesData as Record<string, StageData>;

function makeStage(id: string, chapter: number, area: number, unlockRequires: string[] = []): StageData {
  return {
    id,
    name: id,
    nameJa: id,
    nameEn: id.toUpperCase(),
    chapter,
    chapterName: `第${chapter}章`,
    area,
    nodeType: 'DUNGEON',
    element: 'NONE',
    difficulty: 1,
    description: id,
    waveCount: 1,
    areaGimmick: 'NONE',
    unlockRequires,
    waves: [{ label: 'WAVE 1', role: 'WARMUP', enemyIds: [], intent: '' }],
    rewards: { baseExp: 1, baseGold: 1, dropTable: [] },
    position: { x: 100, y: 100 },
  };
}

describe('WorldMapSystem', () => {
  test('uses chapter and area as a composite key', () => {
    expect(getAreaKey({ chapter: 1, area: 1 })).toBe('1:1');
    expect(getAreaKey({ chapter: 2, area: 1 })).toBe('2:1');
    expect(getAreaMasterId({ chapter: 2, area: 1 })).toBe('ch2_area1');
  });

  test('builds current area from existing area and stage masters', () => {
    const worldAreas = buildWorldAreas(AREAS, STAGES, ['area1_node1', 'area1_node2', 'area1_boss', 'area1_node3']);
    const area2 = worldAreas.find(area => area.id === 'ch2_area2');

    expect(area2).toMatchObject({
      chapter: 2,
      area: 2,
      nameJa: '幽霊都市',
      state: 'CURRENT',
      nextStage: expect.objectContaining({ id: 'area2_gate' }),
      totalCount: 1,
    });
  });

  test('does not mix same area number across different chapters', () => {
    const stages = {
      ch1_area1_node: makeStage('ch1_area1_node', 1, 1),
      ch2_area1_node: makeStage('ch2_area1_node', 2, 1),
    };
    const areas = {
      ch1_area1: { ...AREAS.ch1_area1, area: 1 },
      ch2_area1: { ...AREAS.ch2_area2, id: 'ch2_area1', area: 1, sortOrder: 201 },
    };
    const worldAreas = buildWorldAreas(areas, stages, []);

    expect(worldAreas).toHaveLength(2);
    expect(getWorldAreaStages(Object.values(stages), worldAreas[0]).map(stage => stage.id)).toEqual(['ch1_area1_node']);
    expect(getWorldAreaStages(Object.values(stages), worldAreas[1]).map(stage => stage.id)).toEqual(['ch2_area1_node']);
  });

  test('keeps registered areas visible even before stages are added', () => {
    const emptyArea = {
      id: 'ch3_area1',
      chapter: 3,
      area: 1,
      nameJa: '仮エリア',
      nameEn: 'PLACEHOLDER AREA',
      description: 'ステージ未配置',
      color: '#8A2BE2',
      position: { x: 300, y: 120 },
      sortOrder: 301,
    } satisfies AreaData;

    const worldAreas = buildWorldAreas({ ch3_area1: emptyArea }, {}, []);

    expect(worldAreas).toEqual([
      expect.objectContaining({
        id: 'ch3_area1',
        state: 'LOCKED',
        stages: [],
        totalCount: 0,
      }),
    ]);
  });

  test('selects current area before available or locked areas', () => {
    const worldAreas = buildWorldAreas(AREAS, STAGES, []);
    expect(getCurrentWorldArea(worldAreas)?.id).toBe('ch1_area1');
  });
});
