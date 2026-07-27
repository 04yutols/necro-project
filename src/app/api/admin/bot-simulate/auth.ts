import type { NextRequest } from 'next/server';

export type BotApiAuthResult = { ok: true } | { ok: false; status: number; error: string };
type BotApiEnv = {
  NODE_ENV?: string;
  BOT_TEST_API_ENABLED?: string;
  BOT_TEST_API_TOKEN?: string;
};

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function bearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

export function authorizeBotApiRequest(
  request: NextRequest,
  env: BotApiEnv = process.env,
): BotApiAuthResult {
  const production = env.NODE_ENV === 'production';
  if (production && env.BOT_TEST_API_ENABLED !== 'true') {
    return { ok: false, status: 404, error: 'Not found.' };
  }

  const expectedToken = env.BOT_TEST_API_TOKEN?.trim();
  if (production && !expectedToken) {
    return { ok: false, status: 503, error: 'Bot simulation API is not configured.' };
  }
  if (expectedToken) {
    const actualToken = bearerToken(request);
    if (!actualToken || !constantTimeEqual(actualToken, expectedToken)) {
      return { ok: false, status: 401, error: 'Unauthorized.' };
    }
  }
  return { ok: true };
}
