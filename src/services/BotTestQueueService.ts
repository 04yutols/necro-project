import { randomUUID } from 'crypto';
import type { BotBatchReport, BotSimulationScenario } from '../logic/BotSimulation';
import { BotTestHistoryService, type BotHistorySuite } from './BotTestHistoryService';
import {
  botListPopRight,
  botListPush,
  botListRange,
  botListTrim,
  botStoreGet,
  botStoreSet,
  botStoreSetNx,
} from './BotTestStorage';

const QUEUE_KEY = 'bot-test:queue';
const BATCH_INDEX = 'bot-test:batches';
const TTL_SEC = 7 * 24 * 60 * 60;

export type BotTestJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface BotTestJob {
  id: string;
  batchId: string;
  status: BotTestJobStatus;
  scenario: BotSimulationScenario;
  createdAt: string;
  updatedAt: string;
  workerId?: string;
  leaseUntil?: string;
  result?: BotBatchReport;
  error?: string;
}

export interface BotTestBatch {
  id: string;
  suite: BotHistorySuite;
  seed: string;
  createdAt: string;
  completedAt?: string;
  historyId?: string;
  jobIds: string[];
}

export interface BotTestBatchView extends BotTestBatch {
  counts: Record<BotTestJobStatus, number>;
  jobs: BotTestJob[];
}

function jobKey(id: string) { return `bot-test:job:${id}`; }
function batchKey(id: string) { return `bot-test:batch:${id}`; }

export class BotTestQueueService {
  static async enqueueBatch(input: {
    suite: BotHistorySuite;
    seed: string;
    scenarios: BotSimulationScenario[];
  }): Promise<BotTestBatchView> {
    if (input.scenarios.length < 1 || input.scenarios.length > 500) {
      throw new Error('A batch must contain between 1 and 500 scenarios.');
    }
    const now = new Date().toISOString();
    const batchId = randomUUID();
    const jobs: BotTestJob[] = input.scenarios.map(scenario => ({
      id: randomUUID(), batchId, status: 'QUEUED', scenario, createdAt: now, updatedAt: now,
    }));
    const batch: BotTestBatch = {
      id: batchId, suite: input.suite, seed: input.seed, createdAt: now, jobIds: jobs.map(job => job.id),
    };
    await botStoreSet(batchKey(batchId), batch, TTL_SEC);
    for (const job of jobs) {
      await botStoreSet(jobKey(job.id), job, TTL_SEC);
      await botListPush(QUEUE_KEY, job.id);
    }
    await botListPush(BATCH_INDEX, batchId);
    await botListTrim(BATCH_INDEX, 0, 99);
    return { ...batch, jobs, counts: { QUEUED: jobs.length, RUNNING: 0, COMPLETED: 0, FAILED: 0 } };
  }

  static async getBatch(batchId: string): Promise<BotTestBatchView | null> {
    const batch = await botStoreGet<BotTestBatch>(batchKey(batchId));
    if (!batch) return null;
    const jobs = (await Promise.all(batch.jobIds.map(id => botStoreGet<BotTestJob>(jobKey(id)))))
      .filter((job): job is BotTestJob => Boolean(job));
    const counts: Record<BotTestJobStatus, number> = { QUEUED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 };
    jobs.forEach(job => { counts[job.status] += 1; });
    return { ...batch, jobs, counts };
  }

  private static async recoverExpiredJobs(now = Date.now()): Promise<void> {
    const batchIds = await botListRange(BATCH_INDEX, 0, 99);
    for (const batchId of batchIds) {
      const batch = await this.getBatch(batchId);
      if (!batch?.jobs.some(job => job.status === 'RUNNING')) continue;
      for (const job of batch.jobs) {
        if (job.status !== 'RUNNING' || !job.leaseUntil || Date.parse(job.leaseUntil) > now) continue;
        const locked = await botStoreSetNx(`bot-test:recover:${job.id}`, now, 30);
        if (!locked) continue;
        const queued: BotTestJob = {
          ...job, status: 'QUEUED', updatedAt: new Date(now).toISOString(), workerId: undefined, leaseUntil: undefined,
        };
        await botStoreSet(jobKey(job.id), queued, TTL_SEC);
        await botListPush(QUEUE_KEY, job.id);
      }
    }
  }

  static async claim(workerId: string, leaseSec = 180): Promise<BotTestJob | null> {
    await this.recoverExpiredJobs();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const id = await botListPopRight(QUEUE_KEY);
      if (!id) return null;
      const job = await botStoreGet<BotTestJob>(jobKey(id));
      if (!job || job.status !== 'QUEUED') continue;
      const now = new Date();
      const claimed: BotTestJob = {
        ...job,
        status: 'RUNNING',
        workerId,
        updatedAt: now.toISOString(),
        leaseUntil: new Date(now.getTime() + Math.max(30, leaseSec) * 1000).toISOString(),
      };
      await botStoreSet(jobKey(id), claimed, TTL_SEC);
      return claimed;
    }
    return null;
  }

  static async complete(jobId: string, result: BotBatchReport): Promise<BotTestJob> {
    const job = await botStoreGet<BotTestJob>(jobKey(jobId));
    if (!job) throw new Error(`Unknown bot job: ${jobId}`);
    const completed: BotTestJob = {
      ...job, status: 'COMPLETED', result, error: undefined, leaseUntil: undefined, updatedAt: new Date().toISOString(),
    };
    await botStoreSet(jobKey(jobId), completed, TTL_SEC);
    await this.finalizeIfTerminal(job.batchId);
    return completed;
  }

  static async fail(jobId: string, error: unknown): Promise<BotTestJob> {
    const job = await botStoreGet<BotTestJob>(jobKey(jobId));
    if (!job) throw new Error(`Unknown bot job: ${jobId}`);
    const failed: BotTestJob = {
      ...job, status: 'FAILED', error: error instanceof Error ? error.message : String(error),
      leaseUntil: undefined, updatedAt: new Date().toISOString(),
    };
    await botStoreSet(jobKey(jobId), failed, TTL_SEC);
    await this.finalizeIfTerminal(job.batchId);
    return failed;
  }

  private static async finalizeIfTerminal(batchId: string): Promise<void> {
    const view = await this.getBatch(batchId);
    if (!view || view.jobs.length !== view.jobIds.length
      || view.jobs.some(job => job.status === 'QUEUED' || job.status === 'RUNNING')) return;
    const locked = await botStoreSetNx(`bot-test:finalize:${batchId}`, true, TTL_SEC);
    if (!locked) return;
    const reports = view.jobs.flatMap(job => job.result ? [job.result] : []);
    const history = await BotTestHistoryService.record({
      suite: view.suite, seed: view.seed, batchId, reports,
    });
    await botStoreSet(batchKey(batchId), {
      id: view.id,
      suite: view.suite,
      seed: view.seed,
      createdAt: view.createdAt,
      jobIds: view.jobIds,
      completedAt: new Date().toISOString(),
      historyId: history.id,
    } satisfies BotTestBatch, TTL_SEC);
  }
}

