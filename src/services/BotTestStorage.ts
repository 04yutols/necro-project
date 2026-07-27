type RedisResult<T> = { result?: T; error?: string };

type MemoryState = {
  values: Map<string, string>;
  lists: Map<string, string[]>;
};

const globalStorage = globalThis as typeof globalThis & { __botTestMemoryStorage?: MemoryState };
const memory = globalStorage.__botTestMemoryStorage ?? { values: new Map(), lists: new Map() };
globalStorage.__botTestMemoryStorage = memory;

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function redisCommand<T>(command: Array<string | number>): Promise<T | null> {
  const config = redisConfig();
  if (!config) return null;
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Bot Redis command failed: HTTP ${response.status}`);
  const payload = await response.json() as RedisResult<T>;
  if (payload.error) throw new Error(`Bot Redis command failed: ${payload.error}`);
  return payload.result ?? null;
}

export function hasBotRedis(): boolean {
  return redisConfig() !== null;
}

export function canUseBotStorage(): boolean {
  return hasBotRedis() || process.env.NODE_ENV !== 'production';
}

export async function botStoreGet<T>(key: string): Promise<T | null> {
  if (hasBotRedis()) {
    const value = await redisCommand<string>(['GET', key]);
    return value ? JSON.parse(value) as T : null;
  }
  const value = memory.values.get(key);
  return value ? JSON.parse(value) as T : null;
}

export async function botStoreSet(key: string, value: unknown, ttlSec = 7 * 24 * 60 * 60): Promise<void> {
  const encoded = JSON.stringify(value);
  if (hasBotRedis()) {
    await redisCommand(['SET', key, encoded, 'EX', ttlSec]);
    return;
  }
  memory.values.set(key, encoded);
}

export async function botStoreSetNx(key: string, value: unknown, ttlSec = 60): Promise<boolean> {
  const encoded = JSON.stringify(value);
  if (hasBotRedis()) {
    const result = await redisCommand<string>(['SET', key, encoded, 'NX', 'EX', ttlSec]);
    return result === 'OK';
  }
  if (memory.values.has(key)) return false;
  memory.values.set(key, encoded);
  return true;
}

export async function botStoreDelete(key: string): Promise<void> {
  if (hasBotRedis()) {
    await redisCommand(['DEL', key]);
    return;
  }
  memory.values.delete(key);
}

export async function botListPush(key: string, value: string): Promise<void> {
  if (hasBotRedis()) {
    await redisCommand(['LPUSH', key, value]);
    return;
  }
  memory.lists.set(key, [value, ...(memory.lists.get(key) ?? [])]);
}

export async function botListPopRight(key: string): Promise<string | null> {
  if (hasBotRedis()) return redisCommand<string>(['RPOP', key]);
  const list = memory.lists.get(key) ?? [];
  const value = list.pop() ?? null;
  memory.lists.set(key, list);
  return value;
}

export async function botListRange(key: string, start = 0, stop = -1): Promise<string[]> {
  if (hasBotRedis()) return (await redisCommand<string[]>(['LRANGE', key, start, stop])) ?? [];
  const list = memory.lists.get(key) ?? [];
  const end = stop < 0 ? list.length : stop + 1;
  return list.slice(start, end);
}

export async function botListTrim(key: string, start: number, stop: number): Promise<void> {
  if (hasBotRedis()) {
    await redisCommand(['LTRIM', key, start, stop]);
    return;
  }
  const list = memory.lists.get(key) ?? [];
  const end = stop < 0 ? list.length : stop + 1;
  memory.lists.set(key, list.slice(start, end));
}

export function resetBotTestMemoryStorage(): void {
  memory.values.clear();
  memory.lists.clear();
}

