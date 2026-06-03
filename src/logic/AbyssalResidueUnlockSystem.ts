import type { DropEntry, StageData } from '../types/game';

export const ABYSSAL_RESIDUE_UNLOCK_STAGE_ID = 'area1_node3';
export const ABYSSAL_RESIDUE_UNLOCK_CHAPTER = 2;

const EMPTY_DROP_TABLE: DropEntry[] = [];

export function isAbyssalResidueUnlocked(clearedStages: readonly string[] | null | undefined): boolean {
  return Boolean(clearedStages?.includes(ABYSSAL_RESIDUE_UNLOCK_STAGE_ID));
}

export function canStageDropAbyssalResidues(
  stage: Pick<StageData, 'chapter'> | null | undefined,
  clearedStages: readonly string[] | null | undefined,
): boolean {
  if (!stage) return false;
  return stage.chapter >= ABYSSAL_RESIDUE_UNLOCK_CHAPTER
    && isAbyssalResidueUnlocked(clearedStages);
}

export function filterLockedAbyssalResidueDrops(
  dropTable: readonly DropEntry[] | null | undefined,
  unlocked: boolean,
): DropEntry[] {
  const entries = dropTable ? [...dropTable] : EMPTY_DROP_TABLE;
  if (unlocked) return entries;
  return entries.filter((entry) => entry.type !== 'RESIDUE' && entry.type !== 'MATERIAL');
}

export function getStageDropTableForResidueUnlock(
  stage: Pick<StageData, 'chapter' | 'rewards'> | null | undefined,
  clearedStages: readonly string[] | null | undefined,
): DropEntry[] {
  return filterLockedAbyssalResidueDrops(
    stage?.rewards.dropTable,
    canStageDropAbyssalResidues(stage, clearedStages),
  );
}
