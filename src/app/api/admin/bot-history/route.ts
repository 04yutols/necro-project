import { NextRequest, NextResponse } from 'next/server';
import type { BotBatchReport } from '@/logic/BotSimulation';
import { BotTestHistoryService, type BotHistorySuite } from '@/services/BotTestHistoryService';
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
  const suite = request.nextUrl.searchParams.get('suite') as BotHistorySuite | null;
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
  return NextResponse.json({ history: await BotTestHistoryService.list(Number.isFinite(limit) ? limit : 20, suite ?? undefined) });
}

export async function POST(request: NextRequest) {
  const failure = authorize(request); if (failure) return failure;
  let body: { suite: BotHistorySuite; seed: string; batchId?: string; reports: BotBatchReport[] };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  if (!['chapter1', 'yomi', 'all', 'custom'].includes(body.suite) || typeof body.seed !== 'string'
    || !Array.isArray(body.reports) || body.reports.length > 500
    || body.reports.some(report => report?.version !== 1 || !report?.difficulty || !report?.scenario)) {
    return NextResponse.json({ error: 'Invalid history payload.' }, { status: 400 });
  }
  return NextResponse.json(await BotTestHistoryService.record(body), { status: 201 });
}

