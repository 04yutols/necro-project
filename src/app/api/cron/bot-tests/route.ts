import { NextRequest, NextResponse } from 'next/server';
import { buildBotSuiteScenarios } from '@/logic/BotBatchRequest';
import { BotTestQueueService } from '@/services/BotTestQueueService';
import { BotTestScheduleService } from '@/services/BotTestScheduleService';
import { canUseBotStorage } from '@/services/BotTestStorage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!canUseBotStorage()) return NextResponse.json({ error: 'Bot Redis is not configured.' }, { status: 503 });
  const due = await BotTestScheduleService.due();
  const batches: string[] = [];
  for (const schedule of due) {
    const seed = `schedule:${schedule.id}:${new Date().toISOString().slice(0, 10)}`;
    const requestBody = { ...schedule, seed };
    const batch = await BotTestQueueService.enqueueBatch({
      suite: schedule.suite,
      seed,
      scenarios: buildBotSuiteScenarios(requestBody),
    });
    batches.push(batch.id);
    await BotTestScheduleService.markEnqueued(schedule.id);
  }
  return NextResponse.json({ enqueued: batches.length, batches });
}

