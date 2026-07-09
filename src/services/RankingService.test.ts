import { RankingService, normalizeStageClearMetrics } from './RankingService';

function makeRecordStageClearTx(currentStats: { bestResidueScore: number; bestDungeonFloor: number } | null = null) {
  return {
    stageRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    playerStats: {
      findFirst: jest.fn().mockResolvedValue({ bestResidueScore: 999 }),
      findUnique: jest.fn().mockResolvedValue(currentStats),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('normalizeStageClearMetrics', () => {
  test('rejects impossible or non-finite client metrics', () => {
    expect(normalizeStageClearMetrics({ turnCount: 0 })).toEqual({ ok: false, error: 'INVALID_STAGE_RESULT_META' });
    expect(normalizeStageClearMetrics({ clearTimeSec: 0 })).toEqual({ ok: false, error: 'INVALID_STAGE_RESULT_META' });
    expect(normalizeStageClearMetrics({ totalDamage: -1 })).toEqual({ ok: false, error: 'INVALID_STAGE_RESULT_META' });
    expect(normalizeStageClearMetrics({ totalDamage: Number.POSITIVE_INFINITY })).toEqual({ ok: false, error: 'INVALID_STAGE_RESULT_META' });
  });

  test('clamps ranking metrics to stage-specific caps', () => {
    expect(normalizeStageClearMetrics({
      turnCount: 9999,
      clearTimeSec: 999999,
      totalDamage: Number.MAX_SAFE_INTEGER,
    }, {
      maxTurnCount: 50,
      maxClearTimeSec: 600,
      maxTotalDamage: 2400,
    })).toEqual({
      ok: true,
      turnCount: 50,
      clearTimeSec: 600,
      totalDamage: 2400,
    });
  });
});

describe('RankingService.recordStageClear', () => {
  test('records the cleared Yomi floor as bestDungeonFloor on create', async () => {
    const tx = makeRecordStageClearTx();

    await RankingService.recordStageClear(tx as any, {
      userId: 'user-1',
      stageId: 'yomi_b05',
      turnCount: 10,
      clearTimeSec: 60,
      totalDamage: 100,
    });

    expect(tx.playerStats.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ bestDungeonFloor: 5 }),
      update: expect.objectContaining({ bestDungeonFloor: 5 }),
    }));
  });

  test('keeps bestDungeonFloor monotonic for lower or non-Yomi clears', async () => {
    const tx = makeRecordStageClearTx({ bestResidueScore: 12, bestDungeonFloor: 10 });

    await RankingService.recordStageClear(tx as any, {
      userId: 'user-1',
      stageId: 'yomi_b03',
      turnCount: 10,
      clearTimeSec: 60,
      totalDamage: 100,
    });
    await RankingService.recordStageClear(tx as any, {
      userId: 'user-1',
      stageId: 'area1_node3',
      turnCount: 10,
      clearTimeSec: 60,
      totalDamage: 100,
    });

    expect(tx.playerStats.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      update: expect.objectContaining({ bestDungeonFloor: 10 }),
    }));
    expect(tx.playerStats.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      update: expect.objectContaining({ bestDungeonFloor: 10 }),
    }));
  });
});
