export const MAX_JOB_LEVEL = 99;

/**
 * Cumulative EXP required to reach a job level.
 *
 * Lv1 starts at 0 total EXP.
 * Lv2 requires 10, Lv3 requires 22, Lv4 requires 36.
 */
export function expForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  if (safeLevel <= 1) return 0;
  return (safeLevel - 1) * (safeLevel + 8);
}

export function normalizeTotalExp(totalExp: number): number {
  if (!Number.isFinite(totalExp)) return 0;
  return Math.max(0, Math.floor(totalExp));
}

export function levelFromTotalExp(totalExp: number): number {
  const safeExp = normalizeTotalExp(totalExp);
  let level = 1;
  while (level < MAX_JOB_LEVEL && expForLevel(level + 1) <= safeExp) level++;
  return level;
}

export interface JobLevelProgress {
  level: number;
  totalExp: number;
  currentLevelExp: number;
  nextLevelExp: number | null;
  expIntoLevel: number;
  expToNextLevel: number;
  progressRatio: number;
}

export function getJobLevelProgress(totalExp: number): JobLevelProgress {
  const safeExp = normalizeTotalExp(totalExp);
  const level = levelFromTotalExp(safeExp);
  const currentLevelExp = expForLevel(level);
  const nextLevelExp = level >= MAX_JOB_LEVEL ? null : expForLevel(level + 1);
  const span = nextLevelExp === null ? 0 : nextLevelExp - currentLevelExp;
  const expIntoLevel = Math.max(0, safeExp - currentLevelExp);

  return {
    level,
    totalExp: safeExp,
    currentLevelExp,
    nextLevelExp,
    expIntoLevel,
    expToNextLevel: nextLevelExp === null ? 0 : Math.max(0, nextLevelExp - safeExp),
    progressRatio: nextLevelExp === null || span <= 0 ? 1 : Math.max(0, Math.min(1, expIntoLevel / span)),
  };
}
