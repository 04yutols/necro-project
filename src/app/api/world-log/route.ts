import { NextResponse } from 'next/server';
import { getRecentWorldEvents } from '../../../services/WorldEventService';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') ?? 50);
  const events = await getRecentWorldEvents(Number.isFinite(limit) ? limit : 50);
  return NextResponse.json({ events });
}
