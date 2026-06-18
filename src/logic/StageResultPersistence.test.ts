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
    requiresCloudSave: false,
    isServerBacked: true,
    hasStageAttempt: false,
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

    expect(requiresCloudStageSave(guestNext)).toBe(false);
    expect(canUseLocalStageResultFallback(guestNext)).toBe(true);
    expect(getStageResultTimeoutMs(guestNext)).toBe(LOCAL_STAGE_RESULT_TIMEOUT_MS);
  });

  test('requires cloud save when a stage attempt token exists even before server hydration finishes', () => {
    const cachedLoginState = context({ isServerBacked: false, hasStageAttempt: true });

    expect(requiresCloudStageSave(cachedLoginState)).toBe(true);
    expect(canUseLocalStageResultFallback(cachedLoginState)).toBe(false);
    expect(getStageResultTimeoutMs(cachedLoginState)).toBeNull();
  });

  test('requires cloud save for authenticated clears even when local store is not hydrated', () => {
    const authenticatedNext = context({
      requiresCloudSave: true,
      isServerBacked: false,
      hasStageAttempt: false,
    });

    expect(requiresCloudStageSave(authenticatedNext)).toBe(true);
    expect(canUseLocalStageResultFallback(authenticatedNext)).toBe(false);
    expect(getStageResultTimeoutMs(authenticatedNext)).toBeNull();
  });

  test('does not require cloud save when no stage result can be persisted', () => {
    const noStage = context({ hasStageId: false });

    expect(requiresCloudStageSave(noStage)).toBe(false);
    expect(canUseLocalStageResultFallback(noStage)).toBe(true);
  });
});
