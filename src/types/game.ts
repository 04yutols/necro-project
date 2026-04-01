// GDD-003, GDD-004, GDD-005, GDD-007 に基づく型定義
// docs/TDD.md の Prisma スキーマと整合性を取った定義

export type ClassCategory = 'PHYSICAL' | 'MAGICAL';

export interface BaseStats {
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

// 永続パッシブの累積補正 (GDD-004)
export interface PassiveBonuses {
  passiveAtkBonus: number;
  passiveDefBonus: number;
  passiveMatkBonus: number;
  passiveMdefBonus: number;
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
  
  // 基礎ステータス (Characterモデルのフィールドに対応)
  stats: BaseStats;
  
  // 累積パッシブ (Characterモデルのフィールドに対応)
  passives: PassiveBonuses;
  
  // 職業リスト
  jobs: UserJobState[];
  
  isAwakened: boolean;
}

export interface MonsterData {
  id: string;
  name: string;
  cost: number;
  stats: BaseStats;
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
