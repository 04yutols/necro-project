/**
 * 一括変更の適用オーケストレーション（保存器を注入する純ロジック）。
 *
 * 設計書 106 R-1: 実保存パス（saveEntry ループ）が未テストだった。
 * 保存処理を Writer として注入することで、テストはモック Writer で
 * 「ループ・部分失敗・savedIds/failedIds 集計」をディスク非依存に検証できる。
 * 本番は Server Action が実 saveEntry をラップして渡す。
 */

import type { BulkChange } from './bulkEngine';

export type ApplyWriter = (id: string, after: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;

export type ApplyResult = {
  savedIds: string[];
  failedIds: { id: string; error?: string }[];
};

/**
 * 各変更を Writer で順次保存し、成功/失敗を集計する。
 * 1 件失敗しても残りは続行する（部分適用を可視化）。
 */
export async function applyChangesWithWriter(changes: BulkChange[], writer: ApplyWriter): Promise<ApplyResult> {
  const savedIds: string[] = [];
  const failedIds: { id: string; error?: string }[] = [];
  for (const c of changes) {
    try {
      const r = await writer(c.id, c.after);
      if (r.success) savedIds.push(c.id);
      else failedIds.push({ id: c.id, error: r.error });
    } catch (e) {
      failedIds.push({ id: c.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { savedIds, failedIds };
}
