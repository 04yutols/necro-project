import type { SceneTrigger, StoryScene } from '../../types/story';
import type { StageData } from '../../types/game';
import stagesData from '../master/stages.json';
import { STORY_PACKS, sortStoryScenes } from './packs';
import { isYomiArea } from '../../logic/YomiFloors';

export { STORY_PACKS, getStoryPackSummaries } from './packs';

const STAGES = stagesData as Record<string, StageData>;

export const STORY_SCENES: StoryScene[] = sortStoryScenes(
  STORY_PACKS.flatMap(pack => pack.scenes),
);

function buildSceneMap(scenes: StoryScene[]): Map<string, StoryScene> {
  const map = new Map<string, StoryScene>();
  const duplicates: string[] = [];

  scenes.forEach(scene => {
    if (map.has(scene.id)) {
      duplicates.push(scene.id);
    }
    map.set(scene.id, scene);
  });

  if (duplicates.length > 0) {
    throw new Error(`Duplicate story scene ids: ${[...new Set(duplicates)].join(', ')}`);
  }

  return map;
}

const SCENE_BY_ID = buildSceneMap(STORY_SCENES);

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
  return getSceneIdsByTrigger({ type: 'GAME_START' });
}

export function getStageEnterSceneIds(stageId: string): string[] {
  return getSceneIdsByTrigger({ type: 'STAGE_ENTER', stageId });
}

function isDifferentArea(a: StageData, b: StageData): boolean {
  return a.chapter !== b.chapter || a.area !== b.area;
}

function areaIdForStage(stage: StageData): string {
  return `area${stage.area}`;
}

export function getAreaUnlockIdsForClearedStage(
  stageId: string,
  stages: Record<string, StageData> = STAGES,
): string[] {
  const clearedStage = stages[stageId];
  if (!clearedStage) return [];

  const areaIds = new Set<string>();
  Object.values(stages).forEach(stage => {
    if (!stage.unlockRequires.includes(stageId)) return;
    if (!isDifferentArea(clearedStage, stage)) return;
    if (isYomiArea(stage.chapter, stage.area)) return;
    areaIds.add(areaIdForStage(stage));
  });

  return [...areaIds].sort();
}

export function getStageClearSceneIds(stageId: string): string[] {
  const regularScenes = getSceneIdsByTrigger({ type: 'STAGE_CLEAR', stageId });
  const bossScenes = getSceneIdsByTrigger({ type: 'BOSS_CLEAR', bossStageId: stageId });
  const areaUnlockScenes = getAreaUnlockIdsForClearedStage(stageId).flatMap(areaId =>
    getSceneIdsByTrigger({ type: 'AREA_UNLOCK', areaId }),
  );
  return [...regularScenes, ...bossScenes, ...areaUnlockScenes];
}

export function getFlagSceneIds(flagKey: string): string[] {
  return getSceneIdsByTrigger({ type: 'FLAG_SET', flagKey });
}

export function getDemonizeFirstSceneIds(): string[] {
  return getSceneIdsByTrigger({ type: 'DEMONIZE_FIRST' });
}
