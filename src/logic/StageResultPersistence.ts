export interface StageResultPersistenceContext {
  hasStageId: boolean;
  isNextRuntime: boolean;
  isServerBacked: boolean;
}

export const LOCAL_STAGE_RESULT_TIMEOUT_MS = 3500;

export function requiresCloudStageSave(context: StageResultPersistenceContext): boolean {
  return context.hasStageId && context.isNextRuntime && context.isServerBacked;
}

export function canUseLocalStageResultFallback(context: StageResultPersistenceContext): boolean {
  return !requiresCloudStageSave(context);
}

export function getStageResultTimeoutMs(context: StageResultPersistenceContext): number | null {
  return requiresCloudStageSave(context) ? null : LOCAL_STAGE_RESULT_TIMEOUT_MS;
}
