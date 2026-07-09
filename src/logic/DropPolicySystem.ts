import type { DropEntry } from '../types/game';

export const DROP_ROLL_MODE = 'MULTI_ROLL' as const;

export type DropRollMode = typeof DROP_ROLL_MODE;

export interface DropTableSummary {
  rollMode: DropRollMode;
  entries: DropEntry[];
  expectedDrops: number;
  visibleExpectedDrops: number;
  hiddenCount: number;
  clampedCount: number;
}

export function normalizeDropRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(1, rate));
}

export function normalizeDropEntry(entry: DropEntry): DropEntry {
  return { ...entry, rate: normalizeDropRate(entry.rate) };
}

export function summarizeDropTable(dropTable: readonly DropEntry[]): DropTableSummary {
  const entries = dropTable.map(normalizeDropEntry);
  return entries.reduce<DropTableSummary>((summary, entry, index) => {
    summary.expectedDrops += entry.rate;
    if (entry.isHidden) summary.hiddenCount += 1;
    else summary.visibleExpectedDrops += entry.rate;
    if (entry.rate !== dropTable[index].rate) summary.clampedCount += 1;
    return summary;
  }, {
    rollMode: DROP_ROLL_MODE,
    entries,
    expectedDrops: 0,
    visibleExpectedDrops: 0,
    hiddenCount: 0,
    clampedCount: 0,
  });
}

export function formatDropRate(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  const percent = normalizeDropRate(rate) === rate ? rate * 100 : Math.max(0, rate * 100);
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}
