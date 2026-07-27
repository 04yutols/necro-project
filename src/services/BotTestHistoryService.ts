import { randomUUID } from 'crypto';
import type { BotBatchReport, BotStageSuiteName } from '../logic/BotSimulation';
import { botListPush, botListRange, botListTrim, botStoreGet, botStoreSet } from './BotTestStorage';

const HISTORY_INDEX = 'bot-test:history';
const HISTORY_LIMIT = 100;
const HISTORY_TTL_SEC = 90 * 24 * 60 * 60;

export type BotHistorySuite = BotStageSuiteName | 'custom';

export interface BotHistoryScenarioSummary {
  stageId: string;
  profile: string;
  policy: string;
  jobId: string;
  clearRate: number;
  roundsP95: number;
  remainingHpPctMean: number;
  warnings: string[];
}

export interface BotTestHistoryEntry {
  id: string;
  batchId?: string;
  suite: BotHistorySuite;
  generatedAt: string;
  seed: string;
  totals: { scenarios: number; simulations: number; wins: number; losses: number; timeouts: number };
  scenarios: BotHistoryScenarioSummary[];
  comparison?: {
    previousId: string;
    clearRateDelta: number;
    roundsP95Delta: number;
    regressions: string[];
  };
}

function historyKey(id: string) {
  return `bot-test:history:${id}`;
}

function scenarioKey(value: BotHistoryScenarioSummary) {
  return `${value.stageId}|${value.profile}|${value.policy}|${value.jobId}`;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export class BotTestHistoryService {
  static async list(limit = 20, suite?: BotHistorySuite): Promise<BotTestHistoryEntry[]> {
    const ids = await botListRange(HISTORY_INDEX, 0, Math.max(limit * 4, HISTORY_LIMIT) - 1);
    const entries = (await Promise.all(ids.map(id => botStoreGet<BotTestHistoryEntry>(historyKey(id)))))
      .filter((entry): entry is BotTestHistoryEntry => Boolean(entry));
    return entries.filter(entry => !suite || entry.suite === suite).slice(0, Math.min(100, Math.max(1, limit)));
  }

  static async record(input: {
    suite: BotHistorySuite;
    seed: string;
    reports: BotBatchReport[];
    batchId?: string;
  }): Promise<BotTestHistoryEntry> {
    const previous = (await this.list(1, input.suite))[0];
    const scenarios = input.reports.map((report): BotHistoryScenarioSummary => ({
      stageId: report.stage.id,
      profile: report.scenario.profile,
      policy: report.scenario.policy,
      jobId: report.scenario.jobId,
      clearRate: report.difficulty.clearRate,
      roundsP95: report.difficulty.rounds.p95,
      remainingHpPctMean: report.difficulty.remainingHpPct.mean,
      warnings: [...report.warnings],
    }));
    const entry: BotTestHistoryEntry = {
      id: randomUUID(),
      batchId: input.batchId,
      suite: input.suite,
      generatedAt: new Date().toISOString(),
      seed: input.seed,
      totals: {
        scenarios: input.reports.length,
        simulations: input.reports.reduce((sum, report) => sum + report.difficulty.runs, 0),
        wins: input.reports.reduce((sum, report) => sum + report.difficulty.wins, 0),
        losses: input.reports.reduce((sum, report) => sum + report.difficulty.losses, 0),
        timeouts: input.reports.reduce((sum, report) => sum + report.difficulty.timeouts, 0),
      },
      scenarios,
    };

    if (previous) {
      const previousByKey = new Map(previous.scenarios.map(value => [scenarioKey(value), value]));
      const pairs = scenarios.flatMap(current => {
        const before = previousByKey.get(scenarioKey(current));
        return before ? [{ current, before }] : [];
      });
      entry.comparison = {
        previousId: previous.id,
        clearRateDelta: average(pairs.map(pair => pair.current.clearRate - pair.before.clearRate)),
        roundsP95Delta: average(pairs.map(pair => pair.current.roundsP95 - pair.before.roundsP95)),
        regressions: pairs
          .filter(pair => pair.current.clearRate < pair.before.clearRate - 0.05 || pair.current.roundsP95 > pair.before.roundsP95 + 2)
          .map(pair => `${scenarioKey(pair.current)}: clear ${(pair.before.clearRate * 100).toFixed(1)}→${(pair.current.clearRate * 100).toFixed(1)}%, p95 ${pair.before.roundsP95}→${pair.current.roundsP95}`),
      };
    }

    await botStoreSet(historyKey(entry.id), entry, HISTORY_TTL_SEC);
    await botListPush(HISTORY_INDEX, entry.id);
    await botListTrim(HISTORY_INDEX, 0, HISTORY_LIMIT - 1);
    return entry;
  }
}

