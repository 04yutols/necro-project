import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type {
  BotBatchReport,
  BotDifficultyReport,
  BotDropObservation,
  BotJobId,
  BotPolicyName,
  BotProfileName,
  BotRunResult,
  BotSimulationCatalog,
  BotBuildOverrides,
  BotStageSuiteName,
  ConfidenceInterval,
  NumberDistribution,
} from '../src/logic/BotSimulation.ts';

type CliArgs = Record<string, string | boolean>;

function loadLocalEnv(): void {
  for (const filename of ['.env', '.env.local']) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
    }
  }
}

interface BatchOutput {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  seed: string;
  config: {
    stages: string[];
    profiles: BotProfileName[];
    policies: BotPolicyName[];
    jobs: BotJobId[];
    iterations: number;
    chunkSize: number;
    maxRounds: number;
    firstClear: boolean;
  };
  totals: {
    scenarios: number;
    simulations: number;
    wins: number;
    losses: number;
    timeouts: number;
  };
  scenarios: BotBatchReport[];
}

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const body = token.slice(2);
    const equals = body.indexOf('=');
    if (equals < 0) result[body] = true;
    else result[body.slice(0, equals)] = body.slice(equals + 1);
  }
  return result;
}

function stringArg(args: CliArgs, key: string, fallback: string): string {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function optionalNumberArg(args: CliArgs, key: string): number | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${key} must be a number.`);
  return parsed;
}

function integerArg(args: CliArgs, key: string, fallback: number): number {
  const parsed = optionalNumberArg(args, key);
  if (parsed === null) return fallback;
  if (!Number.isInteger(parsed)) throw new Error(`--${key} must be an integer.`);
  return parsed;
}

function listArg<T extends string>(args: CliArgs, key: string, fallback: readonly T[]): T[] {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0 || value === 'all') return [...fallback];
  return value.split(',').map(item => item.trim()).filter(Boolean) as T[];
}

function authHeaders(token: string | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(url: string, init: RequestInit, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let payload: unknown;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      if (!response.ok) {
        const detail = typeof payload === 'object' && payload !== null && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : String(payload);
        const error = new Error(`HTTP ${response.status}: ${detail}`);
        if (response.status >= 400 && response.status < 500) throw error;
        lastError = error;
      } else {
        return payload as T;
      }
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith('HTTP 4')) throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function wilson(successes: number, trials: number, z = 1.959963984540054): ConfidenceInterval {
  if (trials <= 0) return { low: 0, high: 0 };
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function distribution(values: number[]): NumberDistribution {
  if (values.length === 0) return { mean: 0, min: 0, max: 0, p50: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q: number) => sorted[Math.floor((sorted.length - 1) * q)];
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: quantile(0.5),
    p95: quantile(0.95),
  };
}

function mergeReports(chunks: BotBatchReport[], requestedIterations: number, sampleLimit: number): BotBatchReport {
  const first = chunks[0];
  const series = {
    outcomes: chunks.flatMap(chunk => chunk.series.outcomes),
    rounds: chunks.flatMap(chunk => chunk.series.rounds),
    actions: chunks.flatMap(chunk => chunk.series.actions),
    remainingHpPct: chunks.flatMap(chunk => chunk.series.remainingHpPct),
    alivePartyMembers: chunks.flatMap(chunk => chunk.series.alivePartyMembers),
    remainingPartyHpPct: chunks.flatMap(chunk => chunk.series.remainingPartyHpPct),
    damageDealt: chunks.flatMap(chunk => chunk.series.damageDealt),
    damageTaken: chunks.flatMap(chunk => chunk.series.damageTaken),
  };
  const wins = series.outcomes.filter(outcome => outcome === 'VICTORY').length;
  const losses = series.outcomes.filter(outcome => outcome === 'DEFEAT').length;
  const timeouts = series.outcomes.filter(outcome => outcome === 'TIMEOUT').length;
  const runs = series.outcomes.length;
  const difficulty: BotDifficultyReport = {
    runs,
    wins,
    losses,
    timeouts,
    clearRate: runs > 0 ? wins / runs : 0,
    clearRate95: wilson(wins, runs),
    rounds: distribution(series.rounds),
    actions: distribution(series.actions),
    remainingHpPct: distribution(series.remainingHpPct),
    alivePartyMembers: distribution(series.alivePartyMembers),
    remainingPartyHpPct: distribution(series.remainingPartyHpPct),
    damageDealt: distribution(series.damageDealt),
    damageTaken: distribution(series.damageTaken),
    criticalHits: chunks.reduce((sum, chunk) => sum + chunk.difficulty.criticalHits, 0),
    weaknessHits: chunks.reduce((sum, chunk) => sum + chunk.difficulty.weaknessHits, 0),
    skillUses: chunks.reduce((sum, chunk) => sum + chunk.difficulty.skillUses, 0),
    demonActivations: chunks.reduce((sum, chunk) => sum + chunk.difficulty.demonActivations, 0),
    demonUltimates: chunks.reduce((sum, chunk) => sum + chunk.difficulty.demonUltimates, 0),
  };

  const dropMap = new Map<string, { configuredRate: number | null; eligibleRuns: number; hitRuns: number; dropCount: number }>();
  for (const chunk of chunks) {
    for (const drop of chunk.drops) {
      const current = dropMap.get(drop.key) ?? {
        configuredRate: drop.configuredRate,
        eligibleRuns: 0,
        hitRuns: 0,
        dropCount: 0,
      };
      current.eligibleRuns += drop.eligibleRuns;
      current.hitRuns += drop.hitRuns;
      current.dropCount += drop.dropCount;
      dropMap.set(drop.key, current);
    }
  }
  const drops = [...dropMap.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]): BotDropObservation => {
    const observedRate = value.eligibleRuns > 0 ? value.hitRuns / value.eligibleRuns : 0;
    const observedRate95 = wilson(value.hitRuns, value.eligibleRuns);
    return {
      key,
      ...value,
      observedRate,
      observedRate95,
      configuredRateInside95: value.configuredRate === null || value.eligibleRuns === 0
        ? null
        : value.configuredRate >= observedRate95.low && value.configuredRate <= observedRate95.high,
    };
  });

  const warnings: string[] = [];
  if (difficulty.clearRate < 0.5) warnings.push(`Low clear rate: ${(difficulty.clearRate * 100).toFixed(1)}%.`);
  if (timeouts > 0) warnings.push(`Timeouts detected: ${timeouts}/${runs}.`);
  for (const drop of drops) {
    if (drop.eligibleRuns >= 30 && drop.configuredRateInside95 === false) {
      warnings.push(`Configured drop rate outside observed 95% interval: ${drop.key}.`);
    }
  }

  return {
    ...first,
    generatedAt: new Date().toISOString(),
    scenario: { ...first.scenario, iterations: requestedIterations },
    difficulty,
    series,
    drops,
    samples: chunks.flatMap(chunk => chunk.samples).slice(0, sampleLimit),
    warnings,
  };
}

function assertKnown<T extends string>(selected: T[], allowed: readonly T[], label: string): void {
  const unknown = selected.filter(value => !allowed.includes(value));
  if (unknown.length > 0) throw new Error(`Unknown ${label}: ${unknown.join(', ')}`);
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]): string {
  return `${rows.map(row => row.map(csvCell).join(',')).join('\n')}\n`;
}

function summaryCsv(reports: BotBatchReport[]): string {
  const rows: unknown[][] = [[
    'stageId', 'stageName', 'chapter', 'difficulty', 'profile', 'jobId', 'policy', 'runs',
    'wins', 'losses', 'timeouts', 'clearRate', 'clearRate95Low', 'clearRate95High',
    'roundsMean', 'roundsP50', 'roundsP95', 'actionsMean', 'actionsP95',
    'playerHpPctMean', 'partyHpPctMean', 'alivePartyMean', 'damageDealtMean', 'damageTakenMean',
    'skillUses', 'demonActivations', 'demonUltimates', 'warnings',
  ]];
  for (const report of reports) {
    const d = report.difficulty;
    rows.push([
      report.stage.id, report.stage.nameJa, report.stage.chapter, report.stage.difficulty,
      report.scenario.profile, report.scenario.jobId, report.scenario.policy,
      d.runs, d.wins, d.losses, d.timeouts, d.clearRate, d.clearRate95.low, d.clearRate95.high,
      d.rounds.mean, d.rounds.p50, d.rounds.p95, d.actions.mean, d.actions.p95,
      d.remainingHpPct.mean, d.remainingPartyHpPct.mean, d.alivePartyMembers.mean,
      d.damageDealt.mean, d.damageTaken.mean, d.skillUses, d.demonActivations, d.demonUltimates,
      report.warnings.join(' | '),
    ]);
  }
  return toCsv(rows);
}

function dropsCsv(reports: BotBatchReport[]): string {
  const rows: unknown[][] = [[
    'stageId', 'profile', 'jobId', 'policy', 'key', 'configuredRate', 'eligibleRuns',
    'hitRuns', 'dropCount', 'observedRate', 'observedRate95Low', 'observedRate95High', 'configuredInside95',
  ]];
  for (const report of reports) {
    for (const drop of report.drops) {
      rows.push([
        report.stage.id, report.scenario.profile, report.scenario.jobId, report.scenario.policy,
        drop.key, drop.configuredRate, drop.eligibleRuns, drop.hitRuns, drop.dropCount,
        drop.observedRate, drop.observedRate95.low, drop.observedRate95.high, drop.configuredRateInside95,
      ]);
    }
  }
  return toCsv(rows);
}

function printHelp(): void {
  console.log(`API-driven balance bot

Usage:
  npm run bot:test -- [options]

Options:
  --base-url=http://localhost:3000
  --token=<BOT_TEST_API_TOKEN>
  --stages=chapter1|yomi|all|area1_node1,area1_node2
  --profiles=starter,ch1_mid,ch1_end,endgame,yomi_entry,yomi_deep
  --policies=basic_only,skill_first,weakness_first
  --jobs=warrior,mage,dark_priest,rogue
  --iterations=100
  --chunk-size=100
  --max-rounds=200
  --sample-runs=1
  --seed=<reproducible-seed>
  --first-clear
  --build=path/to/build.json
  --distributed                 Redis queue + worker APIで実行
  --enqueue-only                distributed batchの投入だけ行う
  --no-history                  集約履歴をAPIへ登録しない
  --min-clear-rate=0.7
  --max-p95-rounds=60
  --out=artifacts/bot-tests/<run-id>
`);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help === true) {
    printHelp();
    return;
  }

  const baseUrl = stringArg(args, 'base-url', process.env.BOT_TEST_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const token = stringArg(args, 'token', process.env.BOT_TEST_API_TOKEN ?? '') || undefined;
  const endpoint = `${baseUrl}/api/admin/bot-simulate`;
  const headers = { ...authHeaders(token), 'Content-Type': 'application/json' };
  const catalog = await fetchJson<BotSimulationCatalog>(endpoint, { method: 'GET', headers });

  const stageArg = stringArg(args, 'stages', 'all');
  const stages = stageArg in catalog.suites
    ? catalog.suites[stageArg as BotStageSuiteName]
    : stageArg.split(',').map(value => value.trim()).filter(Boolean);
  const profiles = listArg(args, 'profiles', catalog.profiles);
  const policies = listArg(args, 'policies', catalog.policies);
  const jobs = listArg(args, 'jobs', catalog.jobs);
  assertKnown(stages, catalog.stages.map(stage => stage.id), 'stage');
  assertKnown(profiles, catalog.profiles, 'profile');
  assertKnown(policies, catalog.policies, 'policy');
  assertKnown(jobs, catalog.jobs, 'job');

  const iterations = integerArg(args, 'iterations', 100);
  const chunkSize = integerArg(args, 'chunk-size', Math.min(100, catalog.limits.maxIterations));
  const maxRounds = integerArg(args, 'max-rounds', 200);
  const sampleRuns = integerArg(args, 'sample-runs', 1);
  if (iterations < 1) throw new Error('--iterations must be at least 1.');
  if (chunkSize < 1 || chunkSize > catalog.limits.maxIterations) {
    throw new Error(`--chunk-size must be between 1 and ${catalog.limits.maxIterations}.`);
  }
  if (maxRounds < catalog.limits.minRounds || maxRounds > catalog.limits.maxRounds) {
    throw new Error(`--max-rounds must be between ${catalog.limits.minRounds} and ${catalog.limits.maxRounds}.`);
  }
  if (sampleRuns < 0 || sampleRuns > catalog.limits.maxSampleRuns) {
    throw new Error(`--sample-runs must be between 0 and ${catalog.limits.maxSampleRuns}.`);
  }

  const seed = stringArg(args, 'seed', new Date().toISOString());
  const firstClear = args['first-clear'] === true;
  const buildPath = typeof args.build === 'string' ? path.resolve(args.build) : null;
  const build = buildPath ? JSON.parse(fs.readFileSync(buildPath, 'utf8')) as BotBuildOverrides : undefined;
  const distributed = args.distributed === true;
  const scenarioCount = stages.length * profiles.length * policies.length * jobs.length;
  const chunksPerScenario = Math.ceil(iterations / chunkSize);
  console.log(`Bot batch: ${scenarioCount} scenarios / ${iterations.toLocaleString()} runs each / ${chunksPerScenario} API chunks each`);

  const reports: BotBatchReport[] = [];
  let scenarioIndex = 0;
  if (distributed) {
    if (iterations > catalog.limits.maxIterations) throw new Error(`--distributed iterations must be <= ${catalog.limits.maxIterations}.`);
    const queueSuite: BotStageSuiteName = stageArg === 'chapter1' || stageArg === 'yomi' || stageArg === 'all' ? stageArg : 'all';
    const batchIds: string[] = [];
    for (const profile of profiles) for (const policy of policies) for (const jobId of jobs) {
      const batch = await fetchJson<{ id: string }>(`${baseUrl}/api/admin/bot-jobs`, {
        method: 'POST', headers, body: JSON.stringify({
          suite: queueSuite, stageIds: stages, seed, iterations, profile, policy, jobId,
          firstClear: firstClear ? true : undefined, maxRounds, build,
        }),
      });
      batchIds.push(batch.id);
    }
    console.log(`Enqueued ${batchIds.length} distributed batches: ${batchIds.join(', ')}`);
    if (args['enqueue-only'] === true) return;
    for (const batchId of batchIds) {
      while (true) {
        await fetchJson(`${baseUrl}/api/admin/bot-worker`, {
          method: 'POST', headers, body: JSON.stringify({ workerId: `cli-${process.pid}`, maxJobs: 10 }),
        });
        const batch = await fetchJson<{ jobs: Array<{ status: string; result?: BotBatchReport }>; counts: Record<string, number> }>(
          `${baseUrl}/api/admin/bot-jobs?batchId=${encodeURIComponent(batchId)}`,
          { method: 'GET', headers },
        );
        const terminal = (batch.counts.COMPLETED ?? 0) + (batch.counts.FAILED ?? 0) === batch.jobs.length;
        if (terminal) {
          reports.push(...batch.jobs.flatMap(job => job.result ? [job.result] : []));
          if ((batch.counts.FAILED ?? 0) > 0) console.warn(`Batch ${batchId}: ${batch.counts.FAILED} failed jobs.`);
          break;
        }
      }
    }
  } else {
    for (const stageId of stages) {
      for (const profile of profiles) {
        for (const policy of policies) {
          for (const jobId of jobs) {
          scenarioIndex += 1;
          const label = `[${scenarioIndex}/${scenarioCount}] ${stageId} / ${profile} / ${jobId} / ${policy}`;
          console.log(`${label} ...`);
          const chunks: BotBatchReport[] = [];
          for (let offset = 0; offset < iterations; offset += chunkSize) {
            const currentIterations = Math.min(chunkSize, iterations - offset);
            const chunk = await fetchJson<BotBatchReport>(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                stageId,
                profile,
                policy,
                jobId,
                iterations: currentIterations,
                seed: `${seed}:offset-${offset}`,
                maxRounds,
                firstClear: firstClear || stageId.startsWith('yomi_'),
                sampleRuns: chunks.length === 0 ? sampleRuns : 0,
                build,
              }),
            });
            chunks.push(chunk);
          }
          const report = mergeReports(chunks, iterations, sampleRuns);
          reports.push(report);
          console.log(`  clear ${(report.difficulty.clearRate * 100).toFixed(1)}% / p95 rounds ${report.difficulty.rounds.p95} / warnings ${report.warnings.length}`);
          }
        }
      }
    }
  }

  const batch: BatchOutput = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    seed,
    config: { stages, profiles, policies, jobs, iterations, chunkSize, maxRounds, firstClear },
    totals: {
      scenarios: reports.length,
      simulations: reports.reduce((sum, report) => sum + report.difficulty.runs, 0),
      wins: reports.reduce((sum, report) => sum + report.difficulty.wins, 0),
      losses: reports.reduce((sum, report) => sum + report.difficulty.losses, 0),
      timeouts: reports.reduce((sum, report) => sum + report.difficulty.timeouts, 0),
    },
    scenarios: reports,
  };

  const runId = batch.generatedAt.replace(/[:.]/g, '-');
  const outputDir = path.resolve(stringArg(args, 'out', path.join('artifacts', 'bot-tests', runId)));
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(batch, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'summary.csv'), summaryCsv(reports));
  fs.writeFileSync(path.join(outputDir, 'drops.csv'), dropsCsv(reports));

  console.log(`Completed: ${batch.totals.simulations.toLocaleString()} simulations`);
  console.log(`Reports: ${outputDir}`);

  if (!distributed && args['no-history'] !== true && reports.length > 0) {
    const suite = (stageArg === 'chapter1' || stageArg === 'yomi' || stageArg === 'all') ? stageArg : 'custom';
    try {
      await fetchJson(`${baseUrl}/api/admin/bot-history`, {
        method: 'POST', headers, body: JSON.stringify({ suite, seed, reports }),
      });
      console.log('History: registered');
    } catch (error) {
      console.warn(`History registration skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const minClearRate = optionalNumberArg(args, 'min-clear-rate');
  const maxP95Rounds = optionalNumberArg(args, 'max-p95-rounds');
  const gateFailures: string[] = [];
  for (const report of reports) {
    const label = `${report.stage.id}/${report.scenario.profile}/${report.scenario.jobId}/${report.scenario.policy}`;
    if (minClearRate !== null && report.difficulty.clearRate < minClearRate) {
      gateFailures.push(`${label}: clearRate ${report.difficulty.clearRate.toFixed(4)} < ${minClearRate}`);
    }
    if (maxP95Rounds !== null && report.difficulty.rounds.p95 > maxP95Rounds) {
      gateFailures.push(`${label}: p95 rounds ${report.difficulty.rounds.p95} > ${maxP95Rounds}`);
    }
  }
  if (gateFailures.length > 0) {
    console.error(`Balance gate failed (${gateFailures.length}):`);
    gateFailures.slice(0, 50).forEach(failure => console.error(`  - ${failure}`));
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
