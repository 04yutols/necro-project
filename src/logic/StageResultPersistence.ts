export interface StageResultPersistenceContext {
  hasStageId: boolean;
  requiresCloudSave: boolean;
  isServerBacked: boolean;
  hasStageAttempt: boolean;
}

export const LOCAL_STAGE_RESULT_TIMEOUT_MS = 3500;

export function requiresCloudStageSave(context: StageResultPersistenceContext): boolean {
  return context.hasStageId
    && (context.requiresCloudSave || context.isServerBacked || context.hasStageAttempt);
}

export function canUseLocalStageResultFallback(context: StageResultPersistenceContext): boolean {
  return !requiresCloudStageSave(context);
}

export function getStageResultTimeoutMs(context: StageResultPersistenceContext): number | null {
  return requiresCloudStageSave(context) ? null : LOCAL_STAGE_RESULT_TIMEOUT_MS;
}
