import { createHash, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';

export type RateLimitScope = 'login' | 'signup' | string;

export interface RateLimitOptions {
  scope: RateLimitScope;
  identifier: string;
  limit: number;
  windowSec: number;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

const AUTH_RATE_LIMITS = {
  login: {
    ip: { limit: 20, windowSec: 10 * 60 },
    email: { limit: 10, windowSec: 10 * 60 },
  },
  signup: {
    ip: { limit: 5, windowSec: 60 * 60 },
    email: { limit: 3, windowSec: 60 * 60 },
  },
} as const;

const memoryBuckets = new Map<string, number[]>();

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

function hashIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex').slice(0, 32);
}

function rateLimitKey(scope: string, identifier: string): string {
  return `ratelimit:${scope}:${hashIdentifier(identifier)}`;
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function hitMemoryBucket(key: string, limit: number, windowSec: number, now: number): RateLimitResult {
  const windowMs = windowSec * 1000;
  const cutoff = now - windowMs;
  const kept = (memoryBuckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  kept.push(now);
  memoryBuckets.set(key, kept);

  const allowed = kept.length <= limit;
  const oldest = kept[0] ?? now;
  const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
  return {
    allowed,
    remaining: Math.max(0, limit - kept.length),
    retryAfterSec,
  };
}

async function hitRedisBucket(key: string, limit: number, windowSec: number, now: number): Promise<RateLimitResult | null> {
  const config = redisConfig();
  if (!config) return null;

  const cutoff = now - windowSec * 1000;
  const member = `${now}:${randomUUID()}`;

  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify([
        ['ZREMRANGEBYSCORE', key, 0, cutoff],
        ['ZADD', key, now, member],
        ['ZCARD', key],
        ['EXPIRE', key, windowSec],
      ]),
    });

    if (!response.ok) return null;
    const json = await response.json() as { result?: unknown; error?: string }[];
    if (!Array.isArray(json) || json.some((entry) => entry?.error)) return null;

    const count = Number(json[2]?.result ?? limit + 1);
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterSec: allowed ? 0 : windowSec,
    };
  } catch {
    return null;
  }
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const now = options.now ?? Date.now();
  const safeLimit = Math.max(1, Math.floor(options.limit));
  const safeWindowSec = Math.max(1, Math.floor(options.windowSec));
  const identifier = normalizeIdentifier(options.identifier);
  const key = rateLimitKey(options.scope, identifier || 'anonymous');

  const redisResult = await hitRedisBucket(key, safeLimit, safeWindowSec, now);
  if (redisResult) return redisResult;

  return hitMemoryBucket(key, safeLimit, safeWindowSec, now);
}

export function getClientIp(request: Pick<NextRequest, 'headers'>): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwarded ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function checkAuthRateLimit(
  request: Pick<NextRequest, 'headers'>,
  scope: 'login' | 'signup',
  email: string,
): Promise<RateLimitResult> {
  const limits = AUTH_RATE_LIMITS[scope];
  const ipResult = await checkRateLimit({
    scope: `${scope}:ip`,
    identifier: getClientIp(request),
    ...limits.ip,
  });
  if (!ipResult.allowed) return ipResult;

  const normalizedEmail = normalizeIdentifier(email);
  if (!normalizedEmail) return ipResult;

  const emailResult = await checkRateLimit({
    scope: `${scope}:email`,
    identifier: normalizedEmail,
    ...limits.email,
  });
  return emailResult.allowed ? {
    allowed: true,
    remaining: Math.min(ipResult.remaining, emailResult.remaining),
    retryAfterSec: 0,
  } : emailResult;
}

export function resetRateLimitMemoryForTests(): void {
  memoryBuckets.clear();
}
