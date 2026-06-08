/**
 * シミュレータ評価エージェントの「推奨値」設計帯チェック（LLM 不使用の純関数）。
 *
 * 設計書 103: LLM が出した調整推奨（例 power 1.55→1.35）が設計帯（doc19 power 表 / 敵 tier 帯 /
 * エネルギーコスト規約）に収まるかを機械的に検証し、帯外なら警告を付す。
 * 既存 skillBalance / enemyBalance の帯定義を再利用する。
 */

import { POWER_TABLE, classifySkill, findBand } from '../skillBalance';
import { deriveTierBands } from '../enemyBalance';

export type RecTarget = 'skill.power' | 'skill.mpCost' | 'enemy.hp' | 'enemy.def';

export type Recommendation = {
  target: RecTarget;
  current: number;
  suggested: number;
  reason?: string;
};

export type RecCheckContext = {
  /** skill.power / skill.mpCost の判定に使う（スキルの分類と tier）。 */
  skill?: { type: string; targetType: string; mpCost: number; tier: number };
  /** enemy.hp / enemy.def の判定に使う。 */
  enemy?: { tier: string; existingEnemies: Record<string, unknown> };
};

export type RecCheckResult = {
  target: RecTarget;
  suggested: number;
  inBand: boolean;
  band: [number, number] | null;
  note: string;
};

/** 敵 tier 帯チェックの許容率（enemyBalance と同じ思想）。 */
const ENEMY_BAND_TOLERANCE = 0.3;
/** 分類別の最小コスト（skillBalance の POWER_TABLE 先頭 minCost と一致）。 */
function minCostFor(classification: keyof typeof POWER_TABLE): number {
  const bands = POWER_TABLE[classification];
  return bands.length ? bands[0].minCost : 1;
}

export function checkRecommendation(rec: Recommendation, ctx: RecCheckContext): RecCheckResult {
  switch (rec.target) {
    case 'skill.power': {
      if (!ctx.skill) return na(rec, 'スキル情報がないため power 帯を判定できません。');
      const cls = classifySkill(ctx.skill.type, ctx.skill.targetType);
      if (!cls) return na(rec, `分類不明（type=${ctx.skill.type}/${ctx.skill.targetType}）のため判定不可。`);
      const band = findBand(cls, ctx.skill.mpCost);
      if (!band) return na(rec, `mpCost ${ctx.skill.mpCost} が ${cls} のコスト帯に該当しません。`);
      const [lo, hi] = ctx.skill.tier === 2 ? band.t2 : band.t1;
      return verdict(rec, [lo, hi], `${cls} / mpCost ${ctx.skill.mpCost} / Tier${ctx.skill.tier} の power 帯（設計書19）`);
    }

    case 'skill.mpCost': {
      if (!ctx.skill) return na(rec, 'スキル情報がないため mpCost 帯を判定できません。');
      const cls = classifySkill(ctx.skill.type, ctx.skill.targetType);
      if (!cls) return na(rec, `分類不明のため判定不可。`);
      const lo = minCostFor(cls);
      const hi = 30; // 最上位帯の実用上限の目安
      return verdict(rec, [lo, hi], `${cls} のコスト下限（物理4/魔法8）〜実用上限`);
    }

    case 'enemy.hp':
    case 'enemy.def': {
      if (!ctx.enemy) return na(rec, '敵情報がないため tier 帯を判定できません。');
      const stat = rec.target === 'enemy.hp' ? 'hp' : 'def';
      const bands = deriveTierBands(ctx.enemy.existingEnemies)[ctx.enemy.tier];
      const band = bands?.[stat];
      if (!band) return na(rec, `${ctx.enemy.tier} の ${stat} 帯が学習できません（実データ不足）。`);
      const lo = Math.floor(band.min * (1 - ENEMY_BAND_TOLERANCE));
      const hi = Math.ceil(band.max * (1 + ENEMY_BAND_TOLERANCE));
      return verdict(rec, [lo, hi], `${ctx.enemy.tier} の ${stat} 実データ帯（許容込み）`);
    }

    default:
      return na(rec, '未対応の推奨対象です。');
  }
}

export function checkRecommendations(recs: Recommendation[], ctx: RecCheckContext): RecCheckResult[] {
  return recs.map((r) => checkRecommendation(r, ctx));
}

function verdict(rec: Recommendation, band: [number, number], label: string): RecCheckResult {
  const inBand = rec.suggested >= band[0] && rec.suggested <= band[1];
  return {
    target: rec.target,
    suggested: rec.suggested,
    inBand,
    band,
    note: inBand
      ? `${label} ${band[0]}〜${band[1]} 内 OK`
      : `⚠ 推奨値 ${rec.suggested} は ${label} ${band[0]}〜${band[1]} の範囲外です。`,
  };
}
function na(rec: Recommendation, note: string): RecCheckResult {
  return { target: rec.target, suggested: rec.suggested, inBand: true, band: null, note };
}
