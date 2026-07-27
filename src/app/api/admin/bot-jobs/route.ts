import { NextRequest, NextResponse } from 'next/server';
import { buildBotSuiteScenarios, validateBotSuiteBatchRequest, type BotSuiteBatchRequest } from '@/logic/BotBatchRequest';
import { BotTestQueueService } from '@/services/BotTestQueueService';
import { canUseBotStorage } from '@/services/BotTestStorage';
import { authorizeBotApiRequest } from '../bot-simulate/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorize(request: NextRequest) {
  const auth = authorizeBotApiRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canUseBotStorage()) return NextResponse.json({ error: 'Bot Redis is not configured.' }, { status: 503 });
  return null;
}

export async function GET(request: NextRequest) {
  const failure = authorize(request); if (failure) return failure;
  const batchId = request.nextUrl.searchParams.get('batchId');
  if (!batchId) return NextResponse.json({ error: 'batchId is required.' }, { status: 400 });
  const batch = await BotTestQueueService.getBatch(batchId);
  return batch ? NextResponse.json(batch) : NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const failure = authorize(request); if (failure) return failure;
  let body: BotSuiteBatchRequest;
  try { body = await request.json() as BotSuiteBatchRequest; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const errors = validateBotSuiteBatchRequest(body);
  if (errors.length > 0) return NextResponse.json({ error: 'Invalid batch request.', details: errors }, { status: 400 });
  try {
    const batch = await BotTestQueueService.enqueueBatch({
      suite: body.suite, seed: body.seed, scenarios: buildBotSuiteScenarios(body),
    });
    return NextResponse.json(batch, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to enqueue batch.' }, { status: 400 });
  }
}

