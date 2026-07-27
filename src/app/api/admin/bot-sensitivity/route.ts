import { NextRequest, NextResponse } from 'next/server';
import { simulateBotSensitivity, validateBotSensitivityRequest, type BotSensitivityRequest } from '@/logic/BotSimulation';
import { authorizeBotApiRequest } from '../bot-simulate/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = authorizeBotApiRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: BotSensitivityRequest;
  try { body = await request.json() as BotSensitivityRequest; }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const errors = validateBotSensitivityRequest(body);
  if (errors.length > 0) return NextResponse.json({ error: 'Invalid sensitivity request.', details: errors }, { status: 400 });
  try { return NextResponse.json(simulateBotSensitivity(body), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    console.error('[bot-sensitivity] failed', error);
    return NextResponse.json({ error: 'Sensitivity analysis failed.' }, { status: 500 });
  }
}

