import type { BaseStats, MonsterData, NecroConfigData } from '../types/game';

/**
 * 死霊術（ネクロマンス）Lv/Rank の純数式 — 単一の真実源（docs/設計書/120）。
 *
 * 設計原則:
 *  - React / Prisma / Zustand に非依存の純関数のみ。BattleDamage.ts と同じ「式はここだけ」方針。
 *  - すべての関数は `cfg`（NecroConfigData）を任意引数で受け取り、省略時は DEFAULT_NECRO_CONFIG を使う。
 *    将来 src/data/master/necroConfig.json を MasterDataService 経由で注入する（F6）。
 *  - ネクロLvの成長は主人公を強化しない。味方モンスターのステ加算と軍団コスト上限にのみ寄与する。
 */

export const MAX_NECRO_LEVEL = 500;
export const MAX_NECRO_RANK = 10;
export const LEVELS_PER_RANK = 50;

/** バランス確定値（docs/設計書/120 §2.2/2.3/2.4/2.5）。necroConfig.json 未接続時のフォールバック。 */
export const DEFAULT_NECRO_CONFIG: NecroConfigData = {
  monsterStatMultiplier: { kA: 0.006, kB: 0.0024, k2: 0.05 },
  maxCost: { base: 6, d1: 10, c2: 2 },
  captureRate: { rankMultiplier: 1.1, cap: 0.75 },
  expCurve: { coefficient: 9, necroExpRate: 1.5 },
};

/** ネクロLvに乗算する HP/ATK/DEF/SPD（会心・効果系は対象外）。 */
const NECRO_SCALED_STAT_KEYS: (keyof BaseStats)[] = ['hp', 'atk', 'def', 'spd'];

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** ネクロLvを 1〜MAX_NECRO_LEVEL の整数に正規化する。 */
export function clampNecroLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return clamp(Math.floor(level), 1, MAX_NECRO_LEVEL);
}

/** ネクロLvから Rank を導出する（50Lvごとに自動昇格・転生なし）。`rank = clamp(floor((L-1)/50)+1, 1, 10)`。 */
export function deriveNecroRank(level: number): number {
  const safeLevel = clampNecroLevel(level);
  return clamp(Math.floor((safeLevel - 1) / LEVELS_PER_RANK) + 1, 1, MAX_NECRO_RANK);
}

/** 味方モンスターの HP/ATK/DEF/SPD に掛ける倍率（区分線形）。 */
export function necroMonsterMultiplier(
  level: number,
  cfg: NecroConfigData = DEFAULT_NECRO_CONFIG,
): number {
  const safeLevel = clampNecroLevel(level);
  const rank = deriveNecroRank(safeLevel);
  const { kA, kB, k2 } = cfg.monsterStatMultiplier;
  const headroom = Math.min(safeLevel, LEVELS_PER_RANK);
  const tail = Math.max(0, safeLevel - LEVELS_PER_RANK);
  return 1 + headroom * kA + tail * kB + (rank - 1) * k2;
}

/**
 * モンスターにネクロLv倍率を適用した「実効ステータス版」MonsterData を返す（不変・新オブジェクト）。
 * BattleEngine へ渡す直前の単一注入点でのみ使用する想定（raw stats は保存値のまま据え置き）。
 */
export function applyNecroToMonster(
  monster: MonsterData,
  level: number,
  cfg: NecroConfigData = DEFAULT_NECRO_CONFIG,
): MonsterData {
  const mult = necroMonsterMultiplier(level, cfg);
  const stats: BaseStats = { ...monster.stats };
  for (const key of NECRO_SCALED_STAT_KEYS) {
    stats[key] = Math.round(monster.stats[key] * mult);
  }
  return { ...monster, stats };
}

/** 軍団コスト上限。`base + floor(level/d1) + (rank-1)*c2`。 */
export function calcNecroMaxCost(
  level: number,
  cfg: NecroConfigData = DEFAULT_NECRO_CONFIG,
): number {
  const safeLevel = clampNecroLevel(level);
  const rank = deriveNecroRank(safeLevel);
  const { base, d1, c2 } = cfg.maxCost;
  return base + Math.floor(safeLevel / d1) + (rank - 1) * c2;
}

/** Rank によるネクロマンス成功率の乗算補正。`clamp(baseRate * rankMultiplier^(rank-1), 0, cap)`。 */
export function applyNecroRankToCaptureRate(
  baseRate: number,
  rank: number,
  cfg: NecroConfigData = DEFAULT_NECRO_CONFIG,
): number {
  const safeBase = Number.isFinite(baseRate) && baseRate > 0 ? baseRate : 0;
  const safeRank = clamp(Math.floor(Number.isFinite(rank) ? rank : 1), 1, MAX_NECRO_RANK);
  const { rankMultiplier, cap } = cfg.captureRate;
  const raw = safeBase * Math.pow(rankMultiplier, safeRank - 1);
  return clamp(raw, 0, cap);
}

/**
 * ネクロLv `L` に到達するための累積必要EXP（Lv1 = 0）。necro専用曲線。
 * 職業の expForLevel（MAX_JOB_LEVEL=99 ハードコード）とは分離する（流用すると職業Lv上限が壊れる）。
 */
export function reqNecroExp(
  level: number,
  cfg: NecroConfigData = DEFAULT_NECRO_CONFIG,
): number {
  const safeLevel = clampNecroLevel(level);
  if (safeLevel <= 1) return 0;
  return (safeLevel - 1) * (safeLevel + cfg.expCurve.coefficient);
}

/** 累積EXPからネクロLvを求める（max MAX_NECRO_LEVEL）。 */
export function necroLevelFromExp(
  totalExp: number,
  cfg: NecroConfigData = DEFAULT_NECRO_CONFIG,
): number {
  const safeExp = Number.isFinite(totalExp) ? Math.max(0, Math.floor(totalExp)) : 0;
  let level = 1;
  while (level < MAX_NECRO_LEVEL && reqNecroExp(level + 1, cfg) <= safeExp) {
    level++;
  }
  return level;
}

/**
 * 職業と共有する獲得EXP（expGain）を necro EXP に変換する。
 * `necroExpRate` 倍を掛けて職業より速く育つ独立軸を作る（docs/設計書/120 §2.5）。
 */
export function necroExpFromGain(
  expGain: number,
  cfg: NecroConfigData = DEFAULT_NECRO_CONFIG,
): number {
  const safeGain = Number.isFinite(expGain) ? Math.max(0, Math.floor(expGain)) : 0;
  return Math.floor(safeGain * cfg.expCurve.necroExpRate);
}
