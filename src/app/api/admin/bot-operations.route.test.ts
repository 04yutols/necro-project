import { NextRequest } from 'next/server';
import { POST as sensitivityPost } from './bot-sensitivity/route';
import { POST as jobsPost, GET as jobsGet } from './bot-jobs/route';
import { POST as workerPost } from './bot-worker/route';
import { GET as historyGet, POST as historyPost } from './bot-history/route';
import { GET as schedulesGet, PUT as schedulesPut } from './bot-schedules/route';
import { POST as cronPost } from '../cron/bot-tests/route';
import { resetBotTestMemoryStorage } from '@/services/BotTestStorage';
import { simulateBotScenario } from '@/logic/BotSimulation';

describe('bot operations API', () => {
  beforeEach(() => {
    delete process.env.BOT_TEST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetBotTestMemoryStorage();
  });

  test('runs sensitivity analysis', async () => {
    const response = await sensitivityPost(new NextRequest('http://localhost/api/admin/bot-sensitivity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: { stageId: 'area1_node1', profile: 'starter', policy: 'basic_only', iterations: 1, seed: 'api' },
        stats: ['atk'], deltasPct: [10],
      }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).variants).toHaveLength(1);
  });

  test('enqueues YOMI jobs, processes a worker job and exposes status/history', async () => {
    const enqueue = await jobsPost(new NextRequest('http://localhost/api/admin/bot-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suite: 'yomi', stageIds: ['yomi_b01'], seed: 'route-queue', iterations: 1,
        profile: 'yomi_deep', policy: 'weakness_first', jobId: 'warrior', firstClear: true,
      }),
    }));
    expect(enqueue.status).toBe(202);
    const batchId = (await enqueue.json()).id;
    const worker = await workerPost(new NextRequest('http://localhost/api/admin/bot-worker', {
      method: 'POST', body: JSON.stringify({ maxJobs: 1 }), headers: { 'Content-Type': 'application/json' },
    }));
    expect((await worker.json()).processed).toHaveLength(1);
    const status = await jobsGet(new NextRequest(`http://localhost/api/admin/bot-jobs?batchId=${batchId}`));
    expect((await status.json()).counts.COMPLETED).toBe(1);
    const history = await historyGet(new NextRequest('http://localhost/api/admin/bot-history?suite=yomi'));
    expect((await history.json()).history).toHaveLength(1);
  });

  test('protects the cron endpoint with CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const denied = await cronPost(new NextRequest('http://localhost/api/cron/bot-tests', { method: 'POST' }));
    expect(denied.status).toBe(401);
    const allowed = await cronPost(new NextRequest('http://localhost/api/cron/bot-tests', {
      method: 'POST', headers: { Authorization: 'Bearer cron-secret' },
    }));
    expect(allowed.status).toBe(200);
    delete process.env.CRON_SECRET;
  });

  test('registers history and updates schedules', async () => {
    const report = simulateBotScenario({
      stageId: 'area1_node1', profile: 'starter', policy: 'basic_only', iterations: 1, seed: 'history-route',
    });
    const history = await historyPost(new NextRequest('http://localhost/api/admin/bot-history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suite: 'chapter1', seed: 'history-route', reports: [report] }),
    }));
    expect(history.status).toBe(201);

    const initial = await schedulesGet(new NextRequest('http://localhost/api/admin/bot-schedules'));
    const schedules = (await initial.json()).schedules;
    schedules[0].enabled = true;
    const updated = await schedulesPut(new NextRequest('http://localhost/api/admin/bot-schedules', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedules }),
    }));
    expect(updated.status).toBe(200);
    expect((await updated.json()).schedules[0].enabled).toBe(true);
  });
});
