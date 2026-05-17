import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import type { RankingEntry, RankingType, StageResultMeta } from '../types/online';

const CACHE_TTL_SEC = 300;

function redisBaseUrl() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function redisGet<T>(key: string): Promise<T | null> {
  const config = redisBaseUrl();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json() as { result?: string | null };
    return json.result ? JSON.parse(json.result) as T : null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: unknown): Promise<void> {
  const config = redisBaseUrl();
  if (!config) return;
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    await fetch(`${config.url}/set/${encodeURIComponent(key)}/${encoded}?EX=${CACHE_TTL_SEC}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
    });
  } catch {
    // Redis is an optimization only.
  }
}

async function redisDel(key: string): Promise<void> {
  const config = redisBaseUrl();
  if (!config) return;
  try {
    await fetch(`${config.url}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
    });
  } catch {
    // Redis is an optimization only.
  }
}

function playerName(user: { displayName: string | null; name: string | null; email: string | null }) {
  return user.displayName ?? user.name ?? user.email ?? '名もなき死霊術師';
}

function rank(entries: Omit<RankingEntry, 'rank'>[]): RankingEntry[] {
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export interface StageClearRecordInput extends StageResultMeta {
  userId: string;
  stageId: string;
  isBossStage?: boolean;
  bestResidueScore?: number;
}

export interface StageRecordResult {
  stageId: string;
  turnCount: number;
  clearTimeSec: number;
  totalDamage: number;
  improved: boolean;
  becameTopResidue: boolean;
}

export class RankingService {
  static async getRanking(type: RankingType, options: { stageId?: string; limit?: number } = {}): Promise<RankingEntry[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const key = `ranking:${type}:${options.stageId ?? 'global'}:${limit}`;
    const cached = await redisGet<RankingEntry[]>(key);
    if (cached) return cached;

    let result: RankingEntry[] = [];

    if (type === 'STAGE_TIME') {
      const rows = await prisma.stageRecord.findMany({
        where: options.stageId ? { stageId: options.stageId } : undefined,
        orderBy: [{ turnCount: 'asc' }, { clearTimeSec: 'asc' }],
        take: limit,
        include: { user: true },
      });
      result = rank(rows.map(row => ({
        userId: row.userId,
        playerName: playerName(row.user),
        value: row.turnCount,
        stageId: row.stageId,
        updatedAt: row.updatedAt.toISOString(),
      })));
    } else if (type === 'TOTAL_DAMAGE') {
      const rows = await prisma.playerStats.findMany({
        orderBy: { totalDamage: 'desc' },
        take: limit,
        include: { user: true },
      });
      result = rank(rows.map(row => ({
        userId: row.userId,
        playerName: playerName(row.user),
        value: Number(row.totalDamage),
        updatedAt: row.updatedAt.toISOString(),
      })));
    } else if (type === 'BOSS_KILLS') {
      const rows = await prisma.playerStats.findMany({
        orderBy: { bossKillCount: 'desc' },
        take: limit,
        include: { user: true },
      });
      result = rank(rows.map(row => ({
        userId: row.userId,
        playerName: playerName(row.user),
        value: row.bossKillCount,
        updatedAt: row.updatedAt.toISOString(),
      })));
    } else {
      const rows = await prisma.playerStats.findMany({
        orderBy: { bestResidueScore: 'desc' },
        take: limit,
        include: { user: true },
      });
      result = rank(rows.map(row => ({
        userId: row.userId,
        playerName: playerName(row.user),
        value: row.bestResidueScore,
        updatedAt: row.updatedAt.toISOString(),
      })));
    }

    await redisSet(key, result);
    return result;
  }

  static async getTopResidueScore(tx: Prisma.TransactionClient = prisma): Promise<number> {
    const top = await tx.playerStats.findFirst({
      orderBy: { bestResidueScore: 'desc' },
      select: { bestResidueScore: true },
    });
    return top?.bestResidueScore ?? 0;
  }

  static async recordStageClear(tx: Prisma.TransactionClient, input: StageClearRecordInput): Promise<StageRecordResult> {
    const turnCount = Math.max(1, Math.round(input.turnCount ?? 10));
    const clearTimeSec = Math.max(0, Math.round(input.clearTimeSec ?? turnCount * 5));
    const totalDamage = Math.max(0, Math.round(input.totalDamage ?? 0));
    const bestResidueScore = Math.max(0, input.bestResidueScore ?? 0);
    const existing = await tx.stageRecord.findUnique({
      where: { userId_stageId: { userId: input.userId, stageId: input.stageId } },
    });
    const improved = !existing || turnCount < existing.turnCount || (turnCount === existing.turnCount && clearTimeSec < existing.clearTimeSec);

    if (!existing) {
      await tx.stageRecord.create({
        data: {
          userId: input.userId,
          stageId: input.stageId,
          turnCount,
          clearTimeSec,
          totalDamage,
        },
      });
    } else if (improved) {
      await tx.stageRecord.update({
        where: { userId_stageId: { userId: input.userId, stageId: input.stageId } },
        data: { turnCount, clearTimeSec, totalDamage, clearedAt: new Date() },
      });
    }

    const topResidueBefore = await RankingService.getTopResidueScore(tx);
    const currentStats = await tx.playerStats.findUnique({ where: { userId: input.userId } });
    const nextBestResidueScore = Math.max(currentStats?.bestResidueScore ?? 0, bestResidueScore);
    const becameTopResidue = bestResidueScore > topResidueBefore;

    await tx.playerStats.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        totalDamage,
        bossKillCount: input.isBossStage ? 1 : 0,
        bestResidueScore: nextBestResidueScore,
      },
      update: {
        totalDamage: { increment: totalDamage },
        bossKillCount: { increment: input.isBossStage ? 1 : 0 },
        bestResidueScore: nextBestResidueScore,
      },
    });

    return {
      stageId: input.stageId,
      turnCount,
      clearTimeSec,
      totalDamage,
      improved,
      becameTopResidue,
    };
  }

  static async invalidate(): Promise<void> {
    await Promise.all([
      redisDel('ranking:RESIDUE_SCORE:global:50'),
      redisDel('ranking:TOTAL_DAMAGE:global:50'),
      redisDel('ranking:BOSS_KILLS:global:50'),
    ]);
  }
}
