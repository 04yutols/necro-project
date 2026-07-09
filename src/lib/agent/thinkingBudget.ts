/**
 * thinking 予算の動的決定ロジック（LLM 不使用・純関数）。
 *
 * 「難しい生成だけ予算を上げる」方針:
 *   - 要件テキストのヒューリスティックで初期予算を決める（単純=安い / 複合=厚い）。
 *   - リトライ時にエスカレーションする（決定論的ゲートが落とした＝実際に難しい証拠）。
 *
 * langgraph に依存しないため jest からそのままテストできる。
 */

/** 難しさを示すキーワード（ギミック・複合制約など）。 */
export const COMPLEXITY_SIGNALS = [
  '蘇生', '召喚', 'ENRAGE', '激昂', 'REVIVE', 'SUMMON', 'ギミック', 'フェーズ', 'phase',
  '罰', '報い', '反射', 'カウンター', '無効', '吸収', '弱点を突かせ', '編成を',
];

export const MAX_THINKING_BUDGET = 8192;
/** JSON 本体に常に確保する出力枠（thinking とは別に積む）。 */
export const JSON_OUTPUT_RESERVE = 4096;

/**
 * 要件テキストから初期 thinking 予算を見積もる。
 * 単純な要件は安く（512）、複合・ギミック要件は厚く（最大 4096）。
 */
export function estimateBaseThinkingBudget(requirements: string): number {
  const text = requirements;
  let score = 0;

  // BOSS は本質的に設計が重い
  if (/BOSS|ボス/i.test(text)) score += 2;
  // ギミック/複合制約のシグナル
  for (const kw of COMPLEXITY_SIGNALS) {
    if (text.includes(kw)) score += 1;
  }
  // 属性への言及数（弱点/耐性の組み合わせが多いほど難しい）
  const elementMentions = (
    text.match(/火|氷|雷|水|風|地|光|闇|FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK/gi) ?? []
  ).length;
  if (elementMentions >= 3) score += 2;
  else if (elementMentions >= 1) score += 1; // 属性指定は実際の制約なので加点
  // 制約節の数（読点・句点でおおまかに数える）
  const clauses = (text.match(/[、。,.]/g) ?? []).length;
  if (clauses >= 4) score += 2;
  else if (clauses >= 2) score += 1;

  // score → 予算（512 / 1024 / 2048 / 4096）
  if (score >= 5) return 4096;
  if (score >= 3) return 2048;
  if (score >= 1) return 1024;
  return 512;
}

/**
 * 試行回数を加味した実効 thinking 予算。
 * attempt 1,2,3 → base ×1, ×2, ×4（MAX_THINKING_BUDGET で頭打ち）。
 */
export function thinkingBudgetForAttempt(requirements: string, attempt: number): number {
  const base = estimateBaseThinkingBudget(requirements);
  return Math.min(base * 2 ** Math.max(0, attempt - 1), MAX_THINKING_BUDGET);
}
