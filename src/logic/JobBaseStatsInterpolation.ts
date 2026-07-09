import type { JobBaseStats, JobBaseStatsByLevel } from '../types/game';

export type JobBaseStatKey = keyof JobBaseStats;

export const JOB_BASE_STAT_KEYS: JobBaseStatKey[] = [
  'hp',
  'mp',
  'atk',
  'def',
  'spd',
  'critRate',
  'critDmg',
  'effectHit',
  'effectRes',
];

export const JOB_BASE_STATS_INTERPOLATION_MIN_LEVEL = 1;
export const JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL = 100;

const INTEGER_STAT_KEYS = new Set<JobBaseStatKey>(['hp', 'mp', 'atk', 'def', 'spd']);

const FALLBACK_BASE_STATS: JobBaseStats = {
  hp: 1,
  mp: 100,
  atk: 1,
  def: 0,
  spd: 1,
  critRate: 0,
  critDmg: 0,
  effectHit: 0,
  effectRes: 0,
};

export function clampJobBaseStatValue(key: JobBaseStatKey, value: number): number {
  const finiteValue = Number.isFinite(value) ? value : FALLBACK_BASE_STATS[key];
  const rounded = INTEGER_STAT_KEYS.has(key)
    ? Math.round(finiteValue)
    : Number(finiteValue.toFixed(1));

  if (key === 'hp' || key === 'mp' || key === 'atk' || key === 'spd') return Math.max(1, rounded);
  return Math.max(0, rounded);
}

export function clampJobBaseStatsLevel(level: number): number {
  if (!Number.isFinite(level)) return JOB_BASE_STATS_INTERPOLATION_MIN_LEVEL;
  return Math.min(
    JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL,
    Math.max(JOB_BASE_STATS_INTERPOLATION_MIN_LEVEL, Math.floor(level)),
  );
}

export function jobBaseStatsProgressRatio(level: number): number {
  const safeLevel = clampJobBaseStatsLevel(level);
  if (safeLevel <= JOB_BASE_STATS_INTERPOLATION_MIN_LEVEL) return 0;
  if (safeLevel >= JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL) return 1;

  const t = (safeLevel - 1) / (JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL - 1);
  return 0.72 * t + 0.28 * t * t;
}

export function interpolateJobBaseStatValue(
  key: JobBaseStatKey,
  startValue: number,
  finalValue: number,
  level: number,
): number {
  const safeLevel = clampJobBaseStatsLevel(level);
  const start = clampJobBaseStatValue(key, startValue);
  const end = clampJobBaseStatValue(key, finalValue);

  if (safeLevel === JOB_BASE_STATS_INTERPOLATION_MIN_LEVEL) return start;
  if (safeLevel === JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL) return end;

  const ratio = jobBaseStatsProgressRatio(safeLevel);
  return clampJobBaseStatValue(key, start + (end - start) * ratio);
}

function normalizeLevelStats(stats: Partial<JobBaseStats> | undefined): JobBaseStats {
  return JOB_BASE_STAT_KEYS.reduce((next, key) => {
    next[key] = clampJobBaseStatValue(key, stats?.[key] ?? FALLBACK_BASE_STATS[key]);
    return next;
  }, {} as JobBaseStats);
}

export function interpolateJobBaseStatColumn(
  table: JobBaseStatsByLevel,
  key: JobBaseStatKey,
  finalValue: number,
): JobBaseStatsByLevel {
  const startStats = normalizeLevelStats(table[String(JOB_BASE_STATS_INTERPOLATION_MIN_LEVEL)]);
  const normalizedFinalValue = clampJobBaseStatValue(key, finalValue);

  return Object.fromEntries(Array.from({ length: JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL }, (_, index) => {
    const level = index + 1;
    const levelKey = String(level);
    const currentStats = normalizeLevelStats(table[levelKey] ?? startStats);

    return [levelKey, {
      ...currentStats,
      [key]: interpolateJobBaseStatValue(key, startStats[key], normalizedFinalValue, level),
    }];
  })) as JobBaseStatsByLevel;
}

export function interpolateJobBaseStatsByFinalLevel(
  table: JobBaseStatsByLevel,
  finalStats: Partial<JobBaseStats> | undefined = table[String(JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL)],
): JobBaseStatsByLevel {
  return JOB_BASE_STAT_KEYS.reduce((nextTable, key) => {
    const finalValue = finalStats?.[key]
      ?? nextTable[String(JOB_BASE_STATS_INTERPOLATION_MAX_LEVEL)]?.[key]
      ?? nextTable[String(JOB_BASE_STATS_INTERPOLATION_MIN_LEVEL)]?.[key]
      ?? FALLBACK_BASE_STATS[key];
    return interpolateJobBaseStatColumn(nextTable, key, finalValue);
  }, table);
}
