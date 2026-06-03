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

describe('Story registry', () => {
  test('contains registered story packs: prologue, chapter 1, and chapter 2 placeholder', () => {
    expect(STORY_PACKS.map(pack => pack.fileName)).toEqual(['ch1_scenes.json', 'ch2_scenes.json']);
    expect(STORY_SCENES).toHaveLength(21);
    expect(getPrologueSceneIds()).toEqual(['PROLOGUE_00', 'PROLOGUE_01', 'PROLOGUE_02', 'PROLOGUE_03']);
    expect(STORY_SCENES.filter(scene => scene.archiveChapter === 1)).toHaveLength(13);
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
    expect(getStageClearSceneIds('area1_boss')).toEqual(['CH1_BOSS_AFTER']);
    expect(getStageClearSceneIds('area1_node3')).toEqual(['CH1_NODE3_AFTER', 'CH1_CLEAR', 'CH1_AREA2_UNLOCK']);
    expect(getStageClearSceneIds('area2_gate')).toEqual(['CH2_RESIDUE_INTRO', 'CH2_GATE_CLEAR']);
  });

  test('derives area unlock story triggers from stage unlock graph', () => {
    expect(getAreaUnlockIdsForClearedStage('area1_node1')).toEqual([]);
    expect(getAreaUnlockIdsForClearedStage('area1_node3')).toEqual(['area2']);
  });
});
