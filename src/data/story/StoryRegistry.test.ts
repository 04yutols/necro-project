import {
  getAreaUnlockIdsForClearedStage,
  findScene,
  getAllSceneIds,
  getFlagSceneIds,
  getPrologueSceneIds,
  getStageClearSceneIds,
  getStageEnterSceneIds,
  STORY_PACKS,
  STORY_SCENES,
} from './index';
import type { StageData } from '../../types/game';

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

describe('Story registry', () => {
  test('contains registered story packs: prologue, chapter 1, and chapter 2 placeholder', () => {
    expect(STORY_PACKS.map(pack => pack.fileName)).toEqual(['ch1_scenes.json', 'ch2_scenes.json']);
    expect(STORY_SCENES).toHaveLength(23);
    expect(getPrologueSceneIds()).toEqual(['PROLOGUE_00', 'PROLOGUE_01', 'PROLOGUE_02', 'PROLOGUE_03']);
    expect(STORY_SCENES.filter(scene => scene.archiveChapter === 1)).toHaveLength(15);
    expect(STORY_SCENES.filter(scene => scene.archiveChapter === 2)).toHaveLength(4);
  });

  test('keeps scene ids unique across registered packs', () => {
    const ids = getAllSceneIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('resolves all registered scene ids', () => {
    for (const sceneId of getAllSceneIds()) {
      expect(findScene(sceneId)?.id).toBe(sceneId);
    }
  });

  test('maps startup, stage enter, stage clear, and flag triggers in chapter order', () => {
    expect(getFlagSceneIds('LINE_DEATH_SEEN')).toEqual(['CH1_TITLE']);
    expect(getFlagSceneIds('CH1_STARTED')).toEqual(['CH1_SAFE_INTRO']);
    expect(getStageEnterSceneIds('area1_node1')).toEqual(['CH1_OPEN']);
    expect(getStageEnterSceneIds('area2_gate')).toEqual(['CH2_TITLE', 'CH2_GATE_ENTER']);
    expect(getStageClearSceneIds('area1_node1')).toEqual(['CH1_NODE1_AFTER']);
    expect(getStageClearSceneIds('area1_a2')).toEqual(['CH1_DEADCITY_ENTRY']);
    expect(getStageClearSceneIds('area1_b3')).toEqual(['CH1_FALLEN_TRUTH']);
    expect(getStageClearSceneIds('area1_boss')).toEqual(['CH1_BOSS_AFTER']);
    expect(getStageClearSceneIds('area1_node3')).toEqual(['CH1_NODE3_AFTER', 'CH1_CLEAR', 'CH1_AREA2_UNLOCK']);
    expect(getStageClearSceneIds('area2_gate')).toEqual(['CH2_RESIDUE_INTRO', 'CH2_GATE_CLEAR']);
  });

  test('keeps chapter 1 story beats in the redesigned flow order', () => {
    const chapterOneIds = STORY_SCENES
      .filter(scene => scene.archiveChapter === 1)
      .map(scene => scene.id);

    expect(chapterOneIds).toEqual([
      'CH1_TITLE',
      'CH1_SAFE_INTRO',
      'CH1_OPEN',
      'CH1_NODE1_AFTER',
      'CH1_DEADCITY_ENTRY',
      'CH1_NODE2_ENTER',
      'CH1_NODE2_AFTER',
      'CH1_FALLEN_TRUTH',
      'CH1_BOSS_ENTER',
      'CH1_BOSS_AFTER',
      'CH1_NODE3_ENTER',
      'CH1_DEMONIZE_FIRST',
      'CH1_NODE3_AFTER',
      'CH1_CLEAR',
      'CH1_AREA2_UNLOCK',
    ]);
  });

  test('derives area unlock story triggers from stage unlock graph', () => {
    expect(getAreaUnlockIdsForClearedStage('area1_node1')).toEqual([]);
    expect(getAreaUnlockIdsForClearedStage('area1_node3')).toEqual(['area2']);
  });

  test('does not expose Yomi area as a story area unlock', () => {
    const stages = {
      area1_node3: makeStage('area1_node3', 1, 1),
      area2_gate: makeStage('area2_gate', 2, 2, ['area1_node3']),
      yomi_b01: makeStage('yomi_b01', 1, 99, ['area1_node3']),
    };

    expect(getAreaUnlockIdsForClearedStage('area1_node3', stages)).toEqual(['area2']);
  });
});
