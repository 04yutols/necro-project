import { normalizeStageClearMetrics } from './RankingService';

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
