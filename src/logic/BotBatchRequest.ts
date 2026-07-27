import {
  BOT_JOB_IDS,
  BOT_POLICY_NAMES,
  BOT_PROFILE_NAMES,
  BOT_STAGE_SUITE_NAMES,
  getBotSimulationCatalog,
  validateBotScenario,
  type BotJobId,
  type BotBuildOverrides,
  type BotPolicyName,
  type BotProfileName,
  type BotSimulationScenario,
  type BotStageSuiteName,
} from './BotSimulation';

export interface BotSuiteBatchRequest {
  suite: BotStageSuiteName;
  seed: string;
  iterations: number;
  profile: BotProfileName;
  policy: BotPolicyName;
  jobId: BotJobId;
  firstClear?: boolean;
  maxRounds?: number;
  stageIds?: string[];
  build?: BotBuildOverrides;
}

export function validateBotSuiteBatchRequest(input: BotSuiteBatchRequest): string[] {
  if (!input || typeof input !== 'object') return ['Request body must be an object.'];
  const errors: string[] = [];
  if (!BOT_STAGE_SUITE_NAMES.includes(input.suite)) errors.push('suite is invalid.');
  if (!BOT_PROFILE_NAMES.includes(input.profile)) errors.push('profile is invalid.');
  if (!BOT_POLICY_NAMES.includes(input.policy)) errors.push('policy is invalid.');
  if (!BOT_JOB_IDS.includes(input.jobId)) errors.push('jobId is invalid.');
  if (typeof input.seed !== 'string' || input.seed.length < 1 || input.seed.length > 200) errors.push('seed is invalid.');
  if (!Number.isInteger(input.iterations) || input.iterations < 1 || input.iterations > 500) errors.push('iterations must be between 1 and 500.');
  if (input.stageIds !== undefined && (!Array.isArray(input.stageIds) || input.stageIds.length < 1 || input.stageIds.length > 500)) {
    errors.push('stageIds must contain between 1 and 500 entries.');
  }
  return errors;
}

export function buildBotSuiteScenarios(input: BotSuiteBatchRequest): BotSimulationScenario[] {
  const errors = validateBotSuiteBatchRequest(input);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const catalog = getBotSimulationCatalog();
  const allowed = new Set(catalog.suites[input.suite]);
  const stageIds = input.stageIds ?? catalog.suites[input.suite];
  if (stageIds.some(id => !allowed.has(id))) throw new Error('stageIds contains a stage outside the selected suite.');
  const scenarios = stageIds.map(stageId => ({
    stageId,
    profile: input.profile,
    policy: input.policy,
    jobId: input.jobId,
    iterations: input.iterations,
    seed: input.seed,
    firstClear: input.firstClear ?? stageId.startsWith('yomi_'),
    maxRounds: input.maxRounds,
    build: input.build,
  } satisfies BotSimulationScenario));
  const scenarioErrors = scenarios.flatMap(validateBotScenario);
  if (scenarioErrors.length > 0) throw new Error(scenarioErrors.join(' '));
  return scenarios;
}
