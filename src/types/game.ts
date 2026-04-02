// GDD-003, GDD-004, GDD-005, GDD-007 に基づく型定義
// docs/TDD.md の Prisma スキーマと整合性を取った定義

export type ClassCategory = 'PHYSICAL' | 'MAGICAL';
export type Tribe = 'UNDEAD' | 'DEMON' | 'BEAST' | 'HUMANOID';

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

export interface SkillData {
  id: string;
  name: string;
  mpCost: number;
  power: number;
  type: 'PHYSICAL' | 'MAGICAL' | 'HEAL';
  element?: string;
  description: string;
}

export interface ItemData {
  id: string;
  name: string;
  type: 'WEAPON' | 'SUB' | 'HEAD' | 'BODY' | 'ARMS' | 'LEGS' | 'ACC1' | 'ACC2';
  rarity: 'COMMON' | 'UNIQUE';
  stats: Partial<BaseStats>;
  specialEffect?: string;
}

export interface EquipmentSlots {
  weapon: ItemData | null;
  sub: ItemData | null;
  head: ItemData | null;
  body: ItemData | null;
  arms: ItemData | null;
  legs: ItemData | null;
  acc1: ItemData | null;
  acc2: ItemData | null;
}

export interface CharacterData {
  id: string;
  name: string;
  currentJobId: string;
  category: ClassCategory;
  stats: BaseStats;
  passives: PassiveBonuses;
  equipment: EquipmentSlots;
  jobs: UserJobState[];
  isAwakened: boolean;
  clearedStages: string[];
}

// 魂の欠片 (GDD-005)
export interface SoulShardEffect {
  atkBonus: number;
  matkBonus: number;
  specialAbility?: string; // 例: "UNDEAD_SYNERGY_BOOST"
}

export interface SoulShardData {
  id: string;
  originMonsterName: string;
  effect: SoulShardEffect;
}

export interface MonsterData {
  id: string;
  name: string;
  tribe: Tribe; // 種族 (GDD-005)
  cost: number;
  stats: BaseStats;
  equippedShardId?: string;
}

export interface NecroStatus {
  level: number;       // Max: 99
  rank: number;        // Max: 10
  maxCost: number;
  baseStatsBonus: number; // ランクアップで蓄積される基礎ステータス倍率補正
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
