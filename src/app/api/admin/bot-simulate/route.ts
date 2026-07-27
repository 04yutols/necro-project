import { NextRequest, NextResponse } from 'next/server';
import {
  getBotSimulationCatalog,
  simulateBotScenario,
  validateBotScenario,
  type BotSimulationScenario,
} from '@/logic/BotSimulation';
import { authorizeBotApiRequest, type BotApiAuthResult } from './auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authFailure(result: Exclude<BotApiAuthResult, { ok: true }>) {
  return NextResponse.json({ error: result.error }, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  const authorization = authorizeBotApiRequest(request);
  if (!authorization.ok) return authFailure(authorization);
  return NextResponse.json(getBotSimulationCatalog(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const authorization = authorizeBotApiRequest(request);
  if (!authorization.ok) return authFailure(authorization);

  let body: BotSimulationScenario;
  try {
    body = await request.json() as BotSimulationScenario;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const errors = validateBotScenario(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Invalid simulation request.', details: errors }, { status: 400 });
  }

  try {
    return NextResponse.json(simulateBotScenario(body), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[bot-simulate] simulation failed', error);
    return NextResponse.json({ error: 'Simulation failed.' }, { status: 500 });
  }
}
