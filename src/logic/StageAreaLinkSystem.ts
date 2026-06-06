export type StageAreaTarget = {
  chapter?: number | null;
  area?: number | null;
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

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function getStageAreaMasterId(target: StageAreaTarget): string {
  const chapter = toPositiveInt(target.chapter, 1);
  const area = toPositiveInt(target.area, 1);
  return `ch${chapter}_area${area}`;
}

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

export function resolveStageArea(
  stage: StageAreaTarget,
  areaOptions: StageAreaOption[],
): StageAreaOption | null {
  const id = getStageAreaMasterId(stage);
  return areaOptions.find(option => option.id === id)
    ?? areaOptions.find(option => option.chapter === stage.chapter && option.area === stage.area)
    ?? null;
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
