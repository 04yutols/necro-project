import { checkRateLimit, resetRateLimitMemoryForTests } from './RateLimitService';

describe('RateLimitService', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetRateLimitMemoryForTests();
  });

  test('allows requests up to the configured limit', async () => {
    await expect(checkRateLimit({ scope: 'test', identifier: 'user@example.com', limit: 2, windowSec: 60, now: 1000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 1 });
    await expect(checkRateLimit({ scope: 'test', identifier: 'user@example.com', limit: 2, windowSec: 60, now: 2000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 0 });
  });

  test('blocks requests over the limit within the same window', async () => {
    await checkRateLimit({ scope: 'login:email', identifier: 'USER@example.com', limit: 2, windowSec: 60, now: 1000 });
    await checkRateLimit({ scope: 'login:email', identifier: 'user@example.com', limit: 2, windowSec: 60, now: 2000 });

    const blocked = await checkRateLimit({ scope: 'login:email', identifier: ' user@example.com ', limit: 2, windowSec: 60, now: 3000 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBe(58);
  });

  test('expires old hits after the sliding window', async () => {
    await checkRateLimit({ scope: 'signup:ip', identifier: '127.0.0.1', limit: 1, windowSec: 10, now: 1000 });

    const allowed = await checkRateLimit({ scope: 'signup:ip', identifier: '127.0.0.1', limit: 1, windowSec: 10, now: 12000 });

    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(0);
  });
});
