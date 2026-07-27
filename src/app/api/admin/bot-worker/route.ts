import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { simulateBotScenario } from '@/logic/BotSimulation';
import { BotTestQueueService } from '@/services/BotTestQueueService';
import { canUseBotStorage } from '@/services/BotTestStorage';
import { authorizeBotApiRequest } from '../bot-simulate/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = authorizeBotApiRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canUseBotStorage()) return NextResponse.json({ error: 'Bot Redis is not configured.' }, { status: 503 });
  let body: { workerId?: string; maxJobs?: number } = {};
  try { body = await request.json() as typeof body; } catch { /* empty body is allowed */ }
  const maxJobs = Math.min(10, Math.max(1, Math.floor(body.maxJobs ?? 1)));
  const workerId = body.workerId?.slice(0, 100) || `http-${randomUUID()}`;
  const processed: Array<{ jobId: string; status: 'COMPLETED' | 'FAILED'; error?: string }> = [];
  for (let index = 0; index < maxJobs; index += 1) {
    const job = await BotTestQueueService.claim(workerId);
    if (!job) break;
    try {
      await BotTestQueueService.complete(job.id, simulateBotScenario(job.scenario));
      processed.push({ jobId: job.id, status: 'COMPLETED' });
    } catch (error) {
      await BotTestQueueService.fail(job.id, error);
      processed.push({ jobId: job.id, status: 'FAILED', error: error instanceof Error ? error.message : String(error) });
    }
  }
  return NextResponse.json({ workerId, processed });
}

