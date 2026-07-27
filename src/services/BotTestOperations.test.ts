import { simulateBotScenario } from '../logic/BotSimulation';
import { BotTestHistoryService } from './BotTestHistoryService';
import { BotTestQueueService } from './BotTestQueueService';
import { BotTestScheduleService } from './BotTestScheduleService';
import { resetBotTestMemoryStorage } from './BotTestStorage';

describe('Bot test operations', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetBotTestMemoryStorage();
  });

  afterAll(() => {
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  test('records suite history and compares the previous matching scenario', async () => {
    const report = simulateBotScenario({
      stageId: 'area1_node1', profile: 'starter', policy: 'basic_only', iterations: 1, seed: 'history',
    });
    const first = await BotTestHistoryService.record({ suite: 'chapter1', seed: 'one', reports: [report] });
    const regressed = structuredClone(report);
    regressed.difficulty.clearRate = Math.max(0, report.difficulty.clearRate - 0.2);
    regressed.difficulty.rounds.p95 += 3;
    const second = await BotTestHistoryService.record({ suite: 'chapter1', seed: 'two', reports: [regressed] });
    expect(second.comparison?.previousId).toBe(first.id);
    expect(second.comparison?.regressions).toHaveLength(1);
    expect((await BotTestHistoryService.list(10, 'chapter1')).map(value => value.id)).toEqual([second.id, first.id]);
  });

  test('claims each queued job once and finalizes a batch into history', async () => {
    const scenario = {
      stageId: 'area1_node1', profile: 'starter' as const, policy: 'basic_only' as const,
      iterations: 1, seed: 'queue',
    };
    const batch = await BotTestQueueService.enqueueBatch({ suite: 'chapter1', seed: 'queue', scenarios: [scenario, scenario] });
    const first = await BotTestQueueService.claim('worker-a');
    const second = await BotTestQueueService.claim('worker-b');
    expect(first?.id).not.toBe(second?.id);
    expect(await BotTestQueueService.claim('worker-c')).toBeNull();
    await BotTestQueueService.complete(first!.id, simulateBotScenario(first!.scenario));
    await BotTestQueueService.fail(second!.id, new Error('intentional'));
    const terminal = await BotTestQueueService.getBatch(batch.id);
    expect(terminal?.counts).toMatchObject({ COMPLETED: 1, FAILED: 1 });
    expect(terminal?.historyId).toBeDefined();
  });

  test('stores schedules and calculates due entries', async () => {
    const saved = await BotTestScheduleService.replace([{
      id: 'fast', name: 'test', enabled: true, suite: 'yomi', intervalMinutes: 5, iterations: 2,
      profile: 'yomi_entry', policy: 'skill_first', jobId: 'mage', firstClear: true,
    }]);
    expect(saved[0].intervalMinutes).toBe(5);
    expect(await BotTestScheduleService.due()).toHaveLength(1);
    await BotTestScheduleService.markEnqueued('fast');
    expect(await BotTestScheduleService.due()).toHaveLength(0);
  });
});

