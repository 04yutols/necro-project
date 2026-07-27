import { NextRequest, NextResponse } from 'next/server';
import { BotTestScheduleService, type BotTestSchedule } from '@/services/BotTestScheduleService';
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
  return NextResponse.json({ schedules: await BotTestScheduleService.list() });
}

export async function PUT(request: NextRequest) {
  const failure = authorize(request); if (failure) return failure;
  let body: { schedules: BotTestSchedule[] };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  try { return NextResponse.json({ schedules: await BotTestScheduleService.replace(body.schedules) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid schedules.' }, { status: 400 }); }
}

