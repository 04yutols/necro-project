import { CH1_FINAL_NODE_ID } from './YomiFloors';
import { isYomiUnlocked } from './YomiUnlockSystem';

describe('YomiUnlockSystem', () => {
  test('黄泉の階層は第1章最終メインノードのクリア後に解放される', () => {
    expect(isYomiUnlocked([])).toBe(false);
    expect(isYomiUnlocked(['area1_node1', 'area1_boss'])).toBe(false);
    expect(isYomiUnlocked([CH1_FINAL_NODE_ID])).toBe(true);
    expect(isYomiUnlocked(['area1_boss', CH1_FINAL_NODE_ID, 'area2_gate'])).toBe(true);
  });

  test('nullish clearedStages are locked', () => {
    expect(isYomiUnlocked(null)).toBe(false);
    expect(isYomiUnlocked(undefined)).toBe(false);
  });

  test('CH1 final node id stays frozen to the release decision', () => {
    expect(CH1_FINAL_NODE_ID).toBe('area1_node3');
  });
});
