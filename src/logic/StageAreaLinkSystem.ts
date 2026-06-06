export type StageAreaTarget = {
  chapter?: number | null;
  area?: number | null;
};

export type StageIdTarget = StageAreaTarget & {
  nodeType?: string | null;
};

export type StagePosition = {
  x: number;
  y: number;
};

export type StageAreaOption = {
  id: string;
  chapter: number;
  area: number;
  nameJa: string;
  nameEn: string;
  description: string;
  color: string;
  sortOrder?: number;
};

export type AreaDraft = {
  id: string;
  chapter: number;
  area: number;
  sortOrder: number;
};

export type StageDependencyOption = {
  id: string;
  nameJa: string;
  nameEn: string;
  chapter: number;
  area: number;
  nodeType: string;
  difficulty: number;
  position: StagePosition | null;
  unlockRequires: string[];
};

export type StageAreaStageGroup = {
  areaId: string;
  area: StageAreaOption | null;
  stages: StageDependencyOption[];
  sortOrder: number;
};

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toPosition(value: unknown): StagePosition | null {
  if (!value || typeof value !== 'object') return null;
  const position = value as Record<string, unknown>;
  return typeof position.x === 'number' && typeof position.y === 'number'
    ? { x: position.x, y: position.y }
    : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function getStageAreaMasterId(target: StageAreaTarget): string {
  const chapter = toPositiveInt(target.chapter, 1);
  const area = toPositiveInt(target.area, 1);
  return `ch${chapter}_area${area}`;
}

export const getAreaMasterId = getStageAreaMasterId;

export function normalizeStageAreaOption(id: string, raw: Record<string, unknown>): StageAreaOption {
  const chapter = toPositiveInt(raw.chapter, 1);
  const area = toPositiveInt(raw.area, 1);
  return {
    id: toText(raw.id, id),
    chapter,
    area,
    nameJa: toText(raw.nameJa, id),
    nameEn: toText(raw.nameEn, ''),
    description: toText(raw.description, ''),
    color: toText(raw.color, '#8A2BE2'),
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : undefined,
  };
}

export function buildStageAreaOptions(areaRecords: Record<string, Record<string, unknown>>): StageAreaOption[] {
  return Object.entries(areaRecords)
    .map(([id, raw]) => normalizeStageAreaOption(id, raw))
    .sort((a, b) => {
      const aOrder = a.sortOrder ?? a.chapter * 100 + a.area;
      const bOrder = b.sortOrder ?? b.chapter * 100 + b.area;
      return aOrder - bOrder || a.chapter - b.chapter || a.area - b.area || a.id.localeCompare(b.id);
    });
}

export function getNextAreaDraft(areaRecords: Record<string, Record<string, unknown>>): AreaDraft {
  const options = buildStageAreaOptions(areaRecords);
  const last = options[options.length - 1];
  const chapter = last?.chapter ?? 1;
  const area = (last?.area ?? 0) + 1;
  return {
    id: getAreaMasterId({ chapter, area }),
    chapter,
    area,
    sortOrder: chapter * 100 + area,
  };
}

export function resolveStageArea(
  stage: StageAreaTarget,
  areaOptions: StageAreaOption[],
): StageAreaOption | null {
  const id = getStageAreaMasterId(stage);
  return areaOptions.find(option => option.id === id)
    ?? areaOptions.find(option => option.chapter === stage.chapter && option.area === stage.area)
    ?? null;
}

function getStageNodeSlug(nodeType: string | null | undefined): 'safe' | 'boss' | 'node' {
  if (nodeType === 'SAFE') return 'safe';
  if (nodeType === 'BOSS') return 'boss';
  return 'node';
}

function normalizeStageRecord(id: string, raw: Record<string, unknown>): StageDependencyOption {
  return {
    id: toText(raw.id, id),
    nameJa: toText(raw.nameJa, id),
    nameEn: toText(raw.nameEn, ''),
    chapter: toPositiveInt(raw.chapter, 1),
    area: toPositiveInt(raw.area, 1),
    nodeType: toText(raw.nodeType, 'DUNGEON'),
    difficulty: typeof raw.difficulty === 'number' ? raw.difficulty : 0,
    position: toPosition(raw.position),
    unlockRequires: toStringArray(raw.unlockRequires),
  };
}

export function buildStageDependencyOptions(
  stageRecords: Record<string, Record<string, unknown>>,
  excludeId?: string,
): StageDependencyOption[] {
  return Object.entries(stageRecords)
    .map(([id, raw]) => normalizeStageRecord(id, raw))
    .filter(stage => !excludeId || stage.id !== excludeId)
    .sort((a, b) => (
      a.chapter - b.chapter
      || a.area - b.area
      || a.difficulty - b.difficulty
      || a.id.localeCompare(b.id)
    ));
}

export function buildStageAreaStageGroups(
  stageRecords: Record<string, Record<string, unknown>>,
  areaRecords: Record<string, Record<string, unknown>>,
): StageAreaStageGroup[] {
  const areaOptions = buildStageAreaOptions(areaRecords);
  const areaById = new Map(areaOptions.map(area => [area.id, area]));
  const groups = new Map<string, StageAreaStageGroup>();

  areaOptions.forEach(area => {
    groups.set(area.id, {
      areaId: area.id,
      area,
      stages: [],
      sortOrder: area.sortOrder ?? area.chapter * 100 + area.area,
    });
  });

  buildStageDependencyOptions(stageRecords).forEach(stage => {
    const areaId = getAreaMasterId(stage);
    const area = areaById.get(areaId) ?? null;
    if (!groups.has(areaId)) {
      groups.set(areaId, {
        areaId,
        area,
        stages: [],
        sortOrder: area?.sortOrder ?? stage.chapter * 100 + stage.area,
      });
    }
    groups.get(areaId)?.stages.push(stage);
  });

  return [...groups.values()]
    .map(group => ({
      ...group,
      stages: [...group.stages].sort((a, b) => (
        a.difficulty - b.difficulty
        || a.nodeType.localeCompare(b.nodeType)
        || a.id.localeCompare(b.id)
      )),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.areaId.localeCompare(b.areaId));
}

export function generateStageMasterId(
  target: StageIdTarget,
  stageRecords: Record<string, Record<string, unknown>>,
): string {
  const chapter = toPositiveInt(target.chapter, 1);
  const area = toPositiveInt(target.area, 1);
  const slug = getStageNodeSlug(target.nodeType);
  const areaId = getAreaMasterId({ chapter, area });
  const existingStages = buildStageDependencyOptions(stageRecords);
  const existingIds = new Set(existingStages.map(stage => stage.id));
  const sameAreaStages = existingStages.filter(stage => stage.chapter === chapter && stage.area === area);
  const sameKindStages = sameAreaStages.filter(stage => getStageNodeSlug(stage.nodeType) === slug);

  if (slug === 'node') {
    const canonicalPattern = new RegExp(`^${areaId}_node(\\d+)$`);
    const legacyPattern = new RegExp(`^area${area}_node(\\d+)$`);
    const maxNumeric = sameKindStages.reduce((max, stage) => {
      const match = stage.id.match(canonicalPattern) ?? stage.id.match(legacyPattern);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    let index = Math.max(maxNumeric, sameKindStages.length) + 1;
    let nextId = `${areaId}_node${index}`;
    while (existingIds.has(nextId)) {
      index += 1;
      nextId = `${areaId}_node${index}`;
    }
    return nextId;
  }

  const baseId = `${areaId}_${slug}`;
  if (sameKindStages.length === 0 && !existingIds.has(baseId)) return baseId;

  let index = Math.max(2, sameKindStages.length + 1);
  let nextId = `${baseId}${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}${index}`;
  }
  return nextId;
}

export function suggestStagePosition(
  target: StageIdTarget & { id?: string | null; unlockRequires?: string[] | null },
  stageRecords: Record<string, Record<string, unknown>>,
): StagePosition {
  const chapter = toPositiveInt(target.chapter, 1);
  const area = toPositiveInt(target.area, 1);
  const targetId = target.id ?? '';
  const unlockRequires = target.unlockRequires ?? [];
  const existingStages = buildStageDependencyOptions(stageRecords, targetId);
  const stageById = new Map(existingStages.map(stage => [stage.id, stage]));
  const dependencies = unlockRequires
    .map(stageId => stageById.get(stageId))
    .filter((stage): stage is StageDependencyOption => Boolean(stage?.position));
  const bounds = { minX: 64, maxX: 311, minY: 72, maxY: 548 };
  const branchOffsets = [0, -86, 86, -44, 44, -122, 122];
  const verticalStep = target.nodeType === 'BOSS' ? 76 : 86;

  if (dependencies.length > 0) {
    const anchorX = dependencies.reduce((sum, stage) => sum + (stage.position?.x ?? 0), 0) / dependencies.length;
    const anchorY = Math.min(...dependencies.map(stage => stage.position?.y ?? bounds.maxY));
    const primaryDependency = dependencies[dependencies.length - 1];
    const siblingCount = existingStages.filter(stage => stage.unlockRequires.includes(primaryDependency.id)).length;
    const offset = dependencies.length === 1 ? branchOffsets[siblingCount % branchOffsets.length] : 0;

    return {
      x: clamp(anchorX + offset, bounds.minX, bounds.maxX),
      y: clamp(anchorY - verticalStep, bounds.minY, bounds.maxY),
    };
  }

  const sameAreaStages = existingStages.filter(stage => stage.chapter === chapter && stage.area === area && stage.position);
  const safeStage = sameAreaStages.find(stage => stage.nodeType === 'SAFE');
  if (safeStage?.position && target.nodeType !== 'SAFE') {
    const siblingCount = existingStages.filter(stage => stage.unlockRequires.includes(safeStage.id)).length;
    const offset = branchOffsets[siblingCount % branchOffsets.length];
    return {
      x: clamp(safeStage.position.x + offset, bounds.minX, bounds.maxX),
      y: clamp(safeStage.position.y - verticalStep, bounds.minY, bounds.maxY),
    };
  }

  if (sameAreaStages.length > 0) {
    const topMost = sameAreaStages.reduce((best, stage) => {
      if (!best.position || !stage.position) return best;
      return stage.position.y < best.position.y ? stage : best;
    }, sameAreaStages[0]);
    const areaIndex = sameAreaStages.length;
    const offset = branchOffsets[areaIndex % branchOffsets.length] * 0.6;
    return {
      x: clamp((topMost.position?.x ?? 188) + offset, bounds.minX, bounds.maxX),
      y: clamp((topMost.position?.y ?? 508) - verticalStep, bounds.minY, bounds.maxY),
    };
  }

  if (target.nodeType === 'SAFE') {
    return { x: 188, y: 508 };
  }

  const rail = [
    { x: 188, y: 422 },
    { x: 102, y: 326 },
    { x: 246, y: 265 },
    { x: 140, y: 182 },
    { x: 254, y: 94 },
  ];
  const index = Math.max(0, Math.min(rail.length - 1, area - 1));
  return rail[index];
}

export function applyStageAreaSelection<T extends StageAreaTarget>(
  form: T,
  area: StageAreaOption,
): T & { chapter: number; area: number } {
  return {
    ...form,
    chapter: area.chapter,
    area: area.area,
  };
}
