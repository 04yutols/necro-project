import { NextResponse } from 'next/server';
import { RankingService } from '../../../services/RankingService';
import type { RankingType } from '../../../types/online';

const RANKING_TYPES: RankingType[] = ['RESIDUE_SCORE', 'STAGE_TIME', 'TOTAL_DAMAGE', 'BOSS_KILLS'];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedType = searchParams.get('type') as RankingType | null;
  const type = requestedType && RANKING_TYPES.includes(requestedType) ? requestedType : 'RESIDUE_SCORE';
  const limit = Number(searchParams.get('limit') ?? 50);
  const stageId = searchParams.get('stageId') ?? undefined;

  const data = await RankingService.getRanking(type, { stageId, limit: Number.isFinite(limit) ? limit : 50 });
  return NextResponse.json({ type, stageId, data });
}
