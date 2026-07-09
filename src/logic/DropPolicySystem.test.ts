import {
  DROP_ROLL_MODE,
  formatDropRate,
  normalizeDropRate,
  summarizeDropTable,
} from './DropPolicySystem';
import type { DropEntry } from '../types/game';

describe('DropPolicySystem', () => {
  test('uses multi-roll semantics and allows expected drops over 100%', () => {
    const table: DropEntry[] = [
      { type: 'WEAPON', itemId: 'bone_cleaver', rate: 0.8 },
      { type: 'MATERIAL', itemId: 'bone_chip', rate: 0.5 },
      { type: 'RESIDUE', rarity: 'RARE', rate: 0.2 },
    ];

    const summary = summarizeDropTable(table);

    expect(summary.rollMode).toBe(DROP_ROLL_MODE);
    expect(summary.expectedDrops).toBeCloseTo(1.5);
    expect(summary.visibleExpectedDrops).toBeCloseTo(1.5);
    expect(formatDropRate(summary.expectedDrops)).toBe('150%');
  });

  test('clamps invalid row rates before summarizing', () => {
    const summary = summarizeDropTable([
      { type: 'WEAPON', itemId: 'bone_cleaver', rate: 1.2 },
      { type: 'MATERIAL', itemId: 'bone_chip', rate: -0.1 },
      { type: 'RESIDUE', rarity: 'EPIC', rate: Number.NaN },
    ]);

    expect(summary.entries.map((entry) => entry.rate)).toEqual([1, 0, 0]);
    expect(summary.expectedDrops).toBe(1);
    expect(summary.clampedCount).toBe(3);
  });

  test('separates visible and hidden expected drops', () => {
    const summary = summarizeDropTable([
      { type: 'WEAPON', itemId: 'bone_cleaver', rate: 0.4 },
      { type: 'WEAPON', itemId: 'hidden_blade', rate: 0.3, isHidden: true },
    ]);

    expect(summary.expectedDrops).toBeCloseTo(0.7);
    expect(summary.visibleExpectedDrops).toBeCloseTo(0.4);
    expect(summary.hiddenCount).toBe(1);
  });

  test('normalizes individual rates defensively', () => {
    expect(normalizeDropRate(0.42)).toBe(0.42);
    expect(normalizeDropRate(2)).toBe(1);
    expect(normalizeDropRate(-1)).toBe(0);
    expect(normalizeDropRate(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
