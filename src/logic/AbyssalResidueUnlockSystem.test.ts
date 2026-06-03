import {
  ABYSSAL_RESIDUE_UNLOCK_STAGE_ID,
  canStageDropAbyssalResidues,
  filterLockedAbyssalResidueDrops,
  getStageDropTableForResidueUnlock,
  isAbyssalResidueUnlocked,
} from './AbyssalResidueUnlockSystem';
import type { DropEntry, StageData } from '../types/game';

const dropTable: DropEntry[] = [
  { type: 'WEAPON', itemId: 'bone_cleaver', rarity: 'R', rate: 1 },
  { type: 'RESIDUE', rarity: 'RARE', rate: 1 },
  { type: 'MATERIAL', itemId: 'ossuary_memory', rarity: 'RARE', rate: 1 },
  { type: 'CONSUMABLE', itemId: 'underworld_potion', quantity: 1, rate: 1 },
];

function stage(chapter: number): Pick<StageData, 'chapter' | 'rewards'> {
  return {
    chapter,
    rewards: {
      baseExp: 0,
      baseGold: 0,
      dropTable,
    },
  };
}

describe('AbyssalResidueUnlockSystem', () => {
  test('深淵の残滓はarea1_node3クリア後に解放される', () => {
    expect(isAbyssalResidueUnlocked([])).toBe(false);
    expect(isAbyssalResidueUnlocked(['area1_node1', 'area1_boss'])).toBe(false);
    expect(isAbyssalResidueUnlocked([ABYSSAL_RESIDUE_UNLOCK_STAGE_ID])).toBe(true);
  });

  test('残滓ドロップは第2章以降かつ解放済みステージ進行でのみ有効になる', () => {
    const cleared = [ABYSSAL_RESIDUE_UNLOCK_STAGE_ID];

    expect(canStageDropAbyssalResidues(stage(1), cleared)).toBe(false);
    expect(canStageDropAbyssalResidues(stage(2), [])).toBe(false);
    expect(canStageDropAbyssalResidues(stage(2), cleared)).toBe(true);
  });

  test('未解放時はRESIDUEと残滓素材をドロップテーブルから除外する', () => {
    expect(filterLockedAbyssalResidueDrops(dropTable, false)).toEqual([
      dropTable[0],
      dropTable[3],
    ]);
    expect(filterLockedAbyssalResidueDrops(dropTable, true)).toEqual(dropTable);
  });

  test('ステージ用フィルタは第1章の残滓を解放後でも残さない', () => {
    const cleared = [ABYSSAL_RESIDUE_UNLOCK_STAGE_ID];

    expect(getStageDropTableForResidueUnlock(stage(1), cleared).some(entry => entry.type === 'RESIDUE')).toBe(false);
    expect(getStageDropTableForResidueUnlock(stage(2), cleared).some(entry => entry.type === 'RESIDUE')).toBe(true);
  });
});
