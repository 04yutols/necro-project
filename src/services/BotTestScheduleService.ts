import { randomUUID } from 'crypto';
import {
  BOT_JOB_IDS, BOT_POLICY_NAMES, BOT_PROFILE_NAMES, BOT_STAGE_SUITE_NAMES,
  type BotJobId, type BotPolicyName, type BotProfileName, type BotStageSuiteName,
} from '../logic/BotSimulation';
import { botStoreGet, botStoreSet } from './BotTestStorage';

const SCHEDULE_KEY = 'bot-test:schedules';

export interface BotTestSchedule {
  id: string;
  name: string;
  enabled: boolean;
  suite: BotStageSuiteName;
  intervalMinutes: number;
  iterations: number;
  profile: BotProfileName;
  policy: BotPolicyName;
  jobId: BotJobId;
  firstClear: boolean;
  lastEnqueuedAt?: string;
}

const DEFAULT_SCHEDULES: BotTestSchedule[] = [
  {
    id: 'yomi-daily', name: '黄泉 日次観測', enabled: false, suite: 'yomi', intervalMinutes: 1440,
    iterations: 100, profile: 'yomi_deep', policy: 'weakness_first', jobId: 'warrior', firstClear: true,
  },
];

export class BotTestScheduleService {
  static async list(): Promise<BotTestSchedule[]> {
    return (await botStoreGet<BotTestSchedule[]>(SCHEDULE_KEY)) ?? DEFAULT_SCHEDULES.map(value => ({ ...value }));
  }

  static async replace(schedules: Omit<BotTestSchedule, 'id'>[] | BotTestSchedule[]): Promise<BotTestSchedule[]> {
    if (!Array.isArray(schedules) || schedules.length > 20) throw new Error('schedules must contain at most 20 entries.');
    for (const schedule of schedules) {
      if (!schedule || typeof schedule.name !== 'string' || schedule.name.length < 1 || schedule.name.length > 100
        || typeof schedule.enabled !== 'boolean' || !BOT_STAGE_SUITE_NAMES.includes(schedule.suite)
        || !BOT_PROFILE_NAMES.includes(schedule.profile) || !BOT_POLICY_NAMES.includes(schedule.policy)
        || !BOT_JOB_IDS.includes(schedule.jobId) || !Number.isFinite(schedule.intervalMinutes)
        || !Number.isFinite(schedule.iterations) || typeof schedule.firstClear !== 'boolean') {
        throw new Error('schedule contains invalid fields.');
      }
    }
    const normalized = schedules.map(schedule => ({
      ...schedule,
      id: 'id' in schedule && schedule.id ? schedule.id : randomUUID(),
      intervalMinutes: Math.max(5, Math.floor(schedule.intervalMinutes)),
      iterations: Math.max(1, Math.min(500, Math.floor(schedule.iterations))),
    }));
    await botStoreSet(SCHEDULE_KEY, normalized, 365 * 24 * 60 * 60);
    return normalized;
  }

  static async due(now = Date.now()): Promise<BotTestSchedule[]> {
    return (await this.list()).filter(schedule => schedule.enabled && (
      !schedule.lastEnqueuedAt || now - Date.parse(schedule.lastEnqueuedAt) >= schedule.intervalMinutes * 60_000
    ));
  }

  static async markEnqueued(id: string, at = new Date().toISOString()): Promise<void> {
    const schedules = await this.list();
    await botStoreSet(SCHEDULE_KEY, schedules.map(schedule => schedule.id === id
      ? { ...schedule, lastEnqueuedAt: at }
      : schedule), 365 * 24 * 60 * 60);
  }
}
