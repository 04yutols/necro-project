import { NextRequest } from 'next/server';
import { authorizeBotApiRequest } from './auth';
import { GET, POST } from './route';

describe('/api/admin/bot-simulate', () => {
  const originalToken = process.env.BOT_TEST_API_TOKEN;

  beforeEach(() => {
    delete process.env.BOT_TEST_API_TOKEN;
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.BOT_TEST_API_TOKEN;
    else process.env.BOT_TEST_API_TOKEN = originalToken;
  });

  test('is hidden in production unless explicitly enabled', () => {
    const request = new NextRequest('http://localhost/api/admin/bot-simulate');
    expect(authorizeBotApiRequest(request, { NODE_ENV: 'production' })).toEqual({
      ok: false,
      status: 404,
      error: 'Not found.',
    });
  });

  test('requires the configured bearer token', () => {
    const missing = new NextRequest('http://localhost/api/admin/bot-simulate');
    expect(authorizeBotApiRequest(missing, { NODE_ENV: 'development', BOT_TEST_API_TOKEN: 'secret' }).ok).toBe(false);
    const valid = new NextRequest('http://localhost/api/admin/bot-simulate', {
      headers: { Authorization: 'Bearer secret' },
    });
    expect(authorizeBotApiRequest(valid, { NODE_ENV: 'development', BOT_TEST_API_TOKEN: 'secret' })).toEqual({ ok: true });
  });

  test('returns the catalog without DB access', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/bot-simulate'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.stages.some((stage: { id: string }) => stage.id === 'area1_node1')).toBe(true);
  });

  test('validates input and runs a real simulation', async () => {
    const invalid = await POST(new NextRequest('http://localhost/api/admin/bot-simulate', {
      method: 'POST',
      body: JSON.stringify({ stageId: 'missing' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(invalid.status).toBe(400);

    const valid = await POST(new NextRequest('http://localhost/api/admin/bot-simulate', {
      method: 'POST',
      body: JSON.stringify({
        stageId: 'area1_node1',
        profile: 'starter',
        policy: 'basic_only',
        iterations: 2,
        seed: 'route-test',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(valid.status).toBe(200);
    const payload = await valid.json();
    expect(payload.difficulty.runs).toBe(2);
    expect(payload.version).toBe(1);
  });
});
