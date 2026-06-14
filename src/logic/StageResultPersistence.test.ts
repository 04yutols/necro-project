import {
  LOCAL_STAGE_RESULT_TIMEOUT_MS,
  canUseLocalStageResultFallback,
  getStageResultTimeoutMs,
  requiresCloudStageSave,
  type StageResultPersistenceContext,
} from './StageResultPersistence';

describe('StageResultPersistence', () => {
  const context = (overrides: Partial<StageResultPersistenceContext>): StageResultPersistenceContext => ({
    hasStageId: true,
    isNextRuntime: true,
    isServerBacked: true,
    ...overrides,
  });

  test('requires cloud save for server-backed Next.js stage clears', () => {
    const serverBacked = context({});

    expect(requiresCloudStageSave(serverBacked)).toBe(true);
    expect(canUseLocalStageResultFallback(serverBacked)).toBe(false);
    expect(getStageResultTimeoutMs(serverBacked)).toBeNull();
  });

  test('allows local fallback for guest or UI-only runs', () => {
    const guestNext = context({ isServerBacked: false });
    const viteGuest = context({ isNextRuntime: false, isServerBacked: false });

    expect(requiresCloudStageSave(guestNext)).toBe(false);
    expect(canUseLocalStageResultFallback(guestNext)).toBe(true);
    expect(getStageResultTimeoutMs(guestNext)).toBe(LOCAL_STAGE_RESULT_TIMEOUT_MS);

    expect(requiresCloudStageSave(viteGuest)).toBe(false);
    expect(canUseLocalStageResultFallback(viteGuest)).toBe(true);
    expect(getStageResultTimeoutMs(viteGuest)).toBe(LOCAL_STAGE_RESULT_TIMEOUT_MS);
  });

  test('does not require cloud save when no stage result can be persisted', () => {
    const noStage = context({ hasStageId: false });

    expect(requiresCloudStageSave(noStage)).toBe(false);
    expect(canUseLocalStageResultFallback(noStage)).toBe(true);
  });
});
