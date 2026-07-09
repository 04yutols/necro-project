/**
 * R-6: gimmick.value の入出力正規化（純関数）。
 *
 * BossGimmick.value は number（game.ts）だが、フォームの行状態は入力都合で string。
 * 読込時に number → string、保存時に string → number へ正規化し、
 * 「入力欄を触ると string で保存される」既存フォームの仕様バグを解消する。
 */

export type GimmickRowInput = { trigger: string; effect: string; value: string };
export type GimmickJson = { trigger: string; effect: string; value?: number | string };

/** 読込: マスター上の value（number 想定）をフォーム入力用の string へ。 */
export function gimmickValueToInput(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string') return v;
  return '';
}

/**
 * 保存: フォーム行を JSON へ。
 * - 空文字 → value フィールドを省略（BossGimmick.value は optional）
 * - 有限数値文字列 → number へ正規化
 * - 非数値文字列 → そのまま保持（データ消失防止。バリデータが警告する領域）
 */
export function gimmickRowsToJson(rows: GimmickRowInput[]): GimmickJson[] {
  return rows.map((g) => {
    const trimmed = g.value.trim();
    const base = { trigger: g.trigger, effect: g.effect };
    if (trimmed === '') return base;
    const num = Number(trimmed);
    return Number.isFinite(num) ? { ...base, value: num } : { ...base, value: g.value };
  });
}
