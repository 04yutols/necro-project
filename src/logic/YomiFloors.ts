/**
 * 黄泉の階層（無限ダンジョン）— ステージ ID / エリア判定の純関数集。
 *
 * 設計原則:
 *  - React / Prisma / Zustand に非依存の純関数のみ。
 *  - 黄泉判定はここに一元化する。呼び出し側で `stageId.startsWith('yomi_')` や
 *    `chapter === 1 && area === 99` を直接書かない（MAP混入防止・ランキング更新漏れ防止）。
 *  - 設計の正: docs/設計書/122_無限ダンジョン設計.md §1・§7 / docs/progress/YOMI_実装計画.md §1
 */

/** 黄泉ステージ ID の正規表現。`yomi_b01`〜`yomi_b20`（ゼロ埋め2桁）を想定するが、桁数・ゼロ埋めの有無は問わない。 */
export const YOMI_STAGE_ID_PATTERN = /^yomi_b(\d+)$/;

/** 黄泉の階層に割り当てる仮想 chapter/area（`areas.json` の `ch1_area99`「黄泉の階層」に対応）。 */
export const YOMI_CHAPTER = 1;
export const YOMI_AREA = 99;

/**
 * 黄泉の階層 B1 の `unlockRequires` が参照する「第1章・最終メインノード」ID。
 * U-1決定（2026-07-04）: Ch1クリア = このノードのクリア（`clearedStages` ベース）で黄泉タブを解放する。
 * `src/logic/AbyssalResidueUnlockSystem.ts` の `ABYSSAL_RESIDUE_UNLOCK_STAGE_ID` と同じ値（同じくCh1最終ノード）
 * だが意味的に別ゲートのため独立した定数として持つ。Ch1の背骨ステージ構成が変わった場合はこの1行だけ追随させる。
 */
export const CH1_FINAL_NODE_ID = 'area1_node3';

/** stageId が黄泉ステージ（`yomi_bNN` 形式）かどうかを判定する。 */
export function isYomiStage(stageId: string | null | undefined): boolean {
  if (!stageId) return false;
  return YOMI_STAGE_ID_PATTERN.test(stageId);
}

/**
 * 黄泉ステージ ID から階層番号（1始まりの整数）を導出する。
 * 黄泉ステージでない・数値化できない・0以下の場合は null を返す。
 */
export function getYomiFloorNumber(stageId: string | null | undefined): number | null {
  if (!stageId) return null;
  const match = YOMI_STAGE_ID_PATTERN.exec(stageId);
  if (!match) return null;
  const floor = Number.parseInt(match[1], 10);
  return Number.isFinite(floor) && floor > 0 ? floor : null;
}

/** chapter/area が黄泉の階層の仮想エリア（`ch1_area99`）かどうかを判定する。MAP除外フィルタ（M3-0）で使用。 */
export function isYomiArea(chapter: number | null | undefined, area: number | null | undefined): boolean {
  return chapter === YOMI_CHAPTER && area === YOMI_AREA;
}

/** 10階刻み（floor%10===0）かつ初回クリアの場合にのみ階層番号を返す。それ以外 null（=配信しない）。 */
export function getYomiMilestoneFloorForFirstClear(
  stageId: string | null | undefined,
  clearedStagesBeforeClear: readonly string[],
): number | null {
  const floor = getYomiFloorNumber(stageId);
  if (floor === null || floor % 10 !== 0) return null;
  if (!stageId || clearedStagesBeforeClear.includes(stageId)) return null;
  return floor;
}
