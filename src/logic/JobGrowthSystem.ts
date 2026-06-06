import type { BaseStats, JobData } from '../types/game';
import { INITIAL_PLAYER_BASE_STATS } from './BalanceConfig';

export type GrowthStatKey = 'hp' | 'atk' | 'def';
type StatKey = keyof BaseStats;

export const JOB_BASE_STATS_MIN_LEVEL = 1;
export const JOB_BASE_STATS_MAX_LEVEL = 100;

const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'];

export function clampJobBaseStatsLevel(level: number): number {
  if (!Number.isFinite(level)) return JOB_BASE_STATS_MIN_LEVEL;
  return Math.min(JOB_BASE_STATS_MAX_LEVEL, Math.max(JOB_BASE_STATS_MIN_LEVEL, Math.floor(level)));
}

function roundBaseStats(stats: BaseStats): BaseStats {
  return {
    hp: Math.max(1, Math.round(stats.hp)),
    atk: Math.max(1, Math.round(stats.atk)),
    def: Math.max(0, Math.round(stats.def)),
    spd: Math.max(1, Math.round(stats.spd)),
    critRate: Math.max(0, Number(stats.critRate.toFixed(1))),
    critDmg: Math.max(100, Number(stats.critDmg.toFixed(1))),
    effectHit: Math.max(0, Number(stats.effectHit.toFixed(1))),
    effectRes: Math.max(0, Number(stats.effectRes.toFixed(1))),
  };
}

function hasCompleteBaseStats(stats: Partial<BaseStats> | undefined): stats is BaseStats {
  return !!stats && STAT_KEYS.every((key) => typeof stats[key] === 'number' && Number.isFinite(stats[key]));
}

function calculateFallbackBaseStats(
  job: Pick<JobData, 'statModifiers'> | null | undefined,
  fallbackBaseStats: BaseStats,
): BaseStats {
  return roundBaseStats(STAT_KEYS.reduce((next, key) => {
    next[key] = fallbackBaseStats[key] * (job?.statModifiers?.[key] ?? 1);
    return next;
  }, {} as BaseStats));
}

export function getJobBaseStatsAtLevel(
  job: Pick<JobData, 'baseStatsByLevel' | 'statModifiers'> | null | undefined,
  level: number,
  fallbackBaseStats: BaseStats = INITIAL_PLAYER_BASE_STATS,
): BaseStats {
  const safeLevel = clampJobBaseStatsLevel(level);
  const tableStats = job?.baseStatsByLevel?.[String(safeLevel)];
  if (hasCompleteBaseStats(tableStats)) return roundBaseStats(tableStats);
  return calculateFallbackBaseStats(job, fallbackBaseStats);
}

export function calculateJobBaseStatsDelta(
  job: Pick<JobData, 'baseStatsByLevel' | 'statModifiers'> | null | undefined,
  fromLevel: number,
  toLevel: number,
): Pick<BaseStats, GrowthStatKey> {
  const safeFromLevel = clampJobBaseStatsLevel(fromLevel);
  const safeToLevel = Math.max(safeFromLevel, clampJobBaseStatsLevel(toLevel));
  const before = getJobBaseStatsAtLevel(job, safeFromLevel);
  const after = getJobBaseStatsAtLevel(job, safeToLevel);
  return {
    hp: after.hp - before.hp,
    atk: after.atk - before.atk,
    def: after.def - before.def,
  };
}

export function calculateJobBaseStatsPowerScore(stats: BaseStats): number {
  return Number((
    stats.hp * 0.15 +
    stats.atk * 3 +
    stats.def * 2 +
    stats.spd +
    stats.critRate * 2 +
    stats.critDmg * 0.5 +
    stats.effectHit * 0.8 +
    stats.effectRes * 0.8
  ).toFixed(2));
}
