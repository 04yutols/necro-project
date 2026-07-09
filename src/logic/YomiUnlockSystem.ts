import { CH1_FINAL_NODE_ID } from './YomiFloors';

/**
 * 黄泉の階層（専用タブ・B1挑戦）が解放されているかどうかを判定する。
 * 条件: 第1章最終メインノード（CH1_FINAL_NODE_ID = 'area1_node3'）のクリア（U-1決定 2026-07-04）。
 * useStoryStore の CH1_CLEARED 等クライアント専用フラグは参照しない（端末間非同期のため）。
 */
export function isYomiUnlocked(clearedStages: readonly string[] | null | undefined): boolean {
  return Boolean(clearedStages?.includes(CH1_FINAL_NODE_ID));
}
