import {
  findScene,
  getAllSceneIds,
  getFlagSceneIds,
  getPrologueSceneIds,
  getStageClearSceneIds,
  getStageEnterSceneIds,
  STORY_SCENES,
} from './index';

describe('Story registry', () => {
  test('contains CH1 TODO 17 scenes: prologue 4 + chapter 1 13', () => {
    expect(STORY_SCENES).toHaveLength(17);
    expect(getPrologueSceneIds()).toEqual(['PROLOGUE_00', 'PROLOGUE_01', 'PROLOGUE_02', 'PROLOGUE_03']);
    expect(STORY_SCENES.filter(scene => scene.archiveChapter === 1)).toHaveLength(13);
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
    expect(getStageClearSceneIds('area1_node1')).toEqual(['CH1_NODE1_AFTER']);
    expect(getStageClearSceneIds('area1_boss')).toEqual(['CH1_BOSS_AFTER']);
    expect(getStageClearSceneIds('area1_node3')).toEqual(['CH1_NODE3_AFTER', 'CH1_CLEAR', 'CH1_AREA2_UNLOCK']);
  });
});
