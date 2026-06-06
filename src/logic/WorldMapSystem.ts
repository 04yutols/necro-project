import type { AreaData, StageData } from '../types/game';
import {
  getNextAvailableStage,
  getStageList,
  getStageProgressState,
  type StageProgressState,
} from './DungeonSystem';

export type WorldAreaState = 'CURRENT' | 'AVAILABLE' | 'LOCKED' | 'CLEARED';

export interface WorldAreaView {
  id: string;
  chapter: number;
  area: number;
  nameJa: string;
  nameEn: string;
  description: string;
  color: string;
  position: { x: number; y: number };
  state: WorldAreaState;
  stages: StageData[];
  nextStage: StageData | null;
  clearedCount: number;
  totalCount: number;
  sortOrder: number;
}

export function getAreaKey(area: Pick<AreaData | StageData, 'chapter' | 'area'>): string {
  return `${area.chapter}:${area.area}`;
}

export function getAreaMasterId(area: Pick<AreaData | StageData, 'chapter' | 'area'>): string {
  return `ch${area.chapter}_area${area.area}`;
}

function compareAreaOrder(a: Pick<AreaData, 'chapter' | 'area' | 'sortOrder'>, b: Pick<AreaData, 'chapter' | 'area' | 'sortOrder'>): number {
  const aOrder = a.sortOrder ?? a.chapter * 100 + a.area;
  const bOrder = b.sortOrder ?? b.chapter * 100 + b.area;
  return aOrder - bOrder || a.chapter - b.chapter || a.area - b.area;
}

function fallbackPosition(index: number): { x: number; y: number } {
  const rail = [
    { x: 152, y: 438 },
    { x: 250, y: 292 },
    { x: 318, y: 112 },
    { x: 104, y: 238 },
    { x: 274, y: 472 },
    { x: 188, y: 132 },
  ];
  return rail[index % rail.length];
}

function fallbackAreaFromStage(stage: StageData, index: number): AreaData {
  return {
    id: getAreaMasterId(stage),
    chapter: stage.chapter,
    area: stage.area,
    nameJa: stage.chapterName || `第${stage.chapter}章 Area ${stage.area}`,
    nameEn: `CH${stage.chapter} AREA ${stage.area}`,
    description: stage.description,
    color: '#8A2BE2',
    position: fallbackPosition(index),
    sortOrder: stage.chapter * 100 + stage.area,
  };
}

export function getWorldAreaStages(stages: StageData[], area: Pick<AreaData | WorldAreaView, 'chapter' | 'area'>): StageData[] {
  const areaKey = getAreaKey(area);
  return getStageList(Object.fromEntries(stages.map(stage => [stage.id, stage])))
    .filter(stage => getAreaKey(stage) === areaKey);
}

export function buildStageStates(stages: StageData[], clearedStages: string[]): Record<string, StageProgressState> {
  return Object.fromEntries(stages.map(stage => [stage.id, getStageProgressState(stage, clearedStages)]));
}

export function buildWorldAreas(
  areaRecords: Record<string, AreaData>,
  stages: Record<string, StageData>,
  clearedStages: string[],
): WorldAreaView[] {
  const stageList = getStageList(stages);
  const states = buildStageStates(stageList, clearedStages);
  const nextStage = getNextAvailableStage(stages, clearedStages);

  const areasByKey = new Map<string, AreaData>();
  Object.values(areaRecords).forEach(area => {
    areasByKey.set(getAreaKey(area), area);
  });

  stageList.forEach(stage => {
    const key = getAreaKey(stage);
    if (!areasByKey.has(key)) {
      areasByKey.set(key, fallbackAreaFromStage(stage, areasByKey.size));
    }
  });

  return [...areasByKey.values()].sort(compareAreaOrder).map((area, index) => {
    const areaStages = stageList.filter(stage => getAreaKey(stage) === getAreaKey(area));
    const totalStages = areaStages.filter(stage => stage.nodeType !== 'SAFE');
    const clearedCount = totalStages.filter(stage => clearedStages.includes(stage.id)).length;
    const hasAccessibleNode = areaStages.some(stage => states[stage.id] !== 'LOCKED');
    const areaNextStage = nextStage && getAreaKey(nextStage) === getAreaKey(area)
      ? nextStage
      : areaStages.find(stage => states[stage.id] === 'AVAILABLE') ?? null;
    const isCleared = totalStages.length > 0 && clearedCount === totalStages.length;

    let state: WorldAreaState = 'LOCKED';
    if (areaStages.length === 0) state = 'LOCKED';
    else if (isCleared) state = 'CLEARED';
    else if (areaNextStage) state = 'CURRENT';
    else if (hasAccessibleNode) state = 'AVAILABLE';

    return {
      id: area.id || getAreaMasterId(area),
      chapter: area.chapter,
      area: area.area,
      nameJa: area.nameJa,
      nameEn: area.nameEn,
      description: area.description,
      color: area.color,
      position: area.position ?? fallbackPosition(index),
      state,
      stages: areaStages,
      nextStage: areaNextStage,
      clearedCount,
      totalCount: totalStages.length,
      sortOrder: area.sortOrder ?? area.chapter * 100 + area.area,
    };
  });
}

export function getCurrentWorldArea(worldAreas: WorldAreaView[]): WorldAreaView | null {
  return worldAreas.find(area => area.state === 'CURRENT')
    ?? worldAreas.find(area => area.state === 'AVAILABLE')
    ?? worldAreas[0]
    ?? null;
}
