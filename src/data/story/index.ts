import type { SceneTrigger, StoryScene } from '../../types/story';
import ch1ScenesData from './ch1_scenes.json';

const storyData = ch1ScenesData as { scenes: StoryScene[] };

export const STORY_SCENES: StoryScene[] = [...storyData.scenes].sort((a, b) => {
  const aSeq = a.sequence ?? Number.MAX_SAFE_INTEGER;
  const bSeq = b.sequence ?? Number.MAX_SAFE_INTEGER;
  return aSeq - bSeq;
});

const SCENE_BY_ID = new Map(STORY_SCENES.map(scene => [scene.id, scene]));

function sameTrigger(a: SceneTrigger, b: SceneTrigger): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'GAME_START':
    case 'DEMONIZE_FIRST':
      return true;
    case 'FLAG_SET':
      return b.type === 'FLAG_SET' && a.flagKey === b.flagKey;
    case 'STAGE_CLEAR':
      return b.type === 'STAGE_CLEAR' && a.stageId === b.stageId;
    case 'STAGE_ENTER':
      return b.type === 'STAGE_ENTER' && a.stageId === b.stageId;
    case 'AREA_UNLOCK':
      return b.type === 'AREA_UNLOCK' && a.areaId === b.areaId;
    case 'BOSS_CLEAR':
      return b.type === 'BOSS_CLEAR' && a.bossStageId === b.bossStageId;
    case 'MANUAL':
      return b.type === 'MANUAL' && a.sceneId === b.sceneId;
    default:
      return false;
  }
}

export function findScene(sceneId: string): StoryScene | null {
  return SCENE_BY_ID.get(sceneId) ?? null;
}

export function getAllSceneIds(): string[] {
  return STORY_SCENES.map(scene => scene.id);
}

export function findScenesByTrigger(trigger: SceneTrigger): StoryScene[] {
  return STORY_SCENES.filter(scene => sameTrigger(scene.trigger, trigger));
}

export function getSceneIdsByTrigger(trigger: SceneTrigger): string[] {
  return findScenesByTrigger(trigger).map(scene => scene.id);
}

export function getPrologueSceneIds(): string[] {
  return ['PROLOGUE_00', 'PROLOGUE_01', 'PROLOGUE_02', 'PROLOGUE_03'];
}

export function getStageEnterSceneIds(stageId: string): string[] {
  return getSceneIdsByTrigger({ type: 'STAGE_ENTER', stageId });
}

export function getStageClearSceneIds(stageId: string): string[] {
  const regularScenes = getSceneIdsByTrigger({ type: 'STAGE_CLEAR', stageId });
  const bossScenes = getSceneIdsByTrigger({ type: 'BOSS_CLEAR', bossStageId: stageId });
  const areaUnlockScenes = stageId === 'area1_node3'
    ? getSceneIdsByTrigger({ type: 'AREA_UNLOCK', areaId: 'area2' })
    : [];
  return [...regularScenes, ...bossScenes, ...areaUnlockScenes];
}

export function getFlagSceneIds(flagKey: string): string[] {
  return getSceneIdsByTrigger({ type: 'FLAG_SET', flagKey });
}

export function getDemonizeFirstSceneIds(): string[] {
  return getSceneIdsByTrigger({ type: 'DEMONIZE_FIRST' });
}
