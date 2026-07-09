export type RankingType = 'RESIDUE_SCORE' | 'STAGE_TIME' | 'TOTAL_DAMAGE' | 'BOSS_KILLS' | 'DUNGEON_FLOOR';

export interface RankingEntry {
  rank: number;
  userId: string;
  playerName: string;
  value: number;
  stageId?: string;
  updatedAt?: string;
}

export type WorldEventType =
  | 'UR_DISCOVERED'
  | 'SSR_DISCOVERED'
  | 'BOSS_CLEARED'
  | 'RANKING_UPDATED'
  | 'YOMI_MILESTONE';

export interface WorldLogEntry {
  id: string;
  type: WorldEventType;
  payload: Record<string, unknown>;
  authorId?: string | null;
  createdAt: string;
}

export interface StageResultMeta {
  turnCount?: number;
  clearTimeSec?: number;
  totalDamage?: number;
}

export interface YomiMilestoneEventPayload {
  playerName: string;
  floor: number;
  stageId: string;
  stageName: string;
}

export interface OnlineStageRecordSummary {
  stageId: string;
  turnCount: number;
  clearTimeSec: number;
  totalDamage: number;
  improved: boolean;
}
