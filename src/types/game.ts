// GDD-003, GDD-004, GDD-005, GDD-007 に基づく型定義

export type ClassCategory = 'PHYSICAL' | 'MAGICAL';

export interface PermanentStats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  matk: number;
  mdef: number;
  agi: number;
  luck: number;
  tec: number;
}

export interface UserJobState {
  jobId: string;
  level: number;
  exp: number;
}

export interface CharacterData {
  id: string;
  name: string;
  currentJobId: string;
  category: ClassCategory;
  baseStats: PermanentStats; // 基礎ステータス
  passiveBonuses: Partial<PermanentStats>; // 累積パッシブ
  jobs: UserJobState[];
  isAwakened: boolean; // 覚醒状態
}

export interface MonsterData {
  id: string;
  name: string;
  cost: number;
  stats: PermanentStats;
  equippedShardId?: string;
}

export interface BattleState {
  player: CharacterData;
  monsters: (MonsterData | null)[];
  wave: number;
  turn: number;
  areaGimmick?: 'SLIP_DAMAGE' | 'STATUS_AILMENT' | 'NONE';
}

export interface BattleLog {
  turn: number;
  wave: number;
  action: string;
  actorName: string;
  targetName: string;
  damage?: number;
  isCritical?: boolean;
  playerMP: number;
  playerHP: number;
  description: string;
}
