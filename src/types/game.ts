// GDD-003, GDD-004, GDD-005, GDD-007 に基づく型定義
// docs/TDD.md の Prisma スキーマと整合性を取った定義

export type ClassCategory = 'PHYSICAL' | 'MAGICAL';
export type Tribe = 'UNDEAD' | 'DEMON' | 'BEAST' | 'HUMANOID';
export type ElementType = 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH' | 'WIND' | 'ICE' | 'LIGHT' | 'DARK' | 'NONE';
export type SkillAttackType = 'SLASH' | 'STRIKE' | 'PROJECTILE' | 'MAGIC' | 'SUMMON' | 'HEAL';

export interface BaseStats {
  hp:        number;  // 最大HP
  atk:       number;  // 攻撃力（物理・魔法共通）
  def:       number;  // 防御力（物理・魔法共通）
  spd:       number;  // 速度（行動値 = 10000/spd）
  critRate:  number;  // 会心率 %（基礎5.0）
  critDmg:   number;  // 会心ダメージ %（基礎150.0 → 1.5×）
  effectHit: number;  // 効果命中 %
  effectRes: number;  // 効果抵抗 %
}

export type Resistances = Partial<Record<ElementType, number>>;

// 永続パッシブの累積補正 (GDD-004) — 転職後もリセットされない
export interface PassiveBonuses {
  passiveAtkBonus:      number;  // flat ATK
  passiveDefBonus:      number;  // flat DEF
  passiveSpdBonus:      number;  // flat SPD
  passiveCritRateBonus: number;  // % 追加
  passiveCritDmgBonus:  number;  // % 追加
  passiveHpBonus:       number;  // flat HP
}

export interface UserJobState {
  jobId: string;
  level: number;
  exp: number;
}

export interface JobSkillUnlock {
  level: number;
  skillId: string;
}

export interface JobUnlockRequirement {
  jobId: string;
  minLevel: number;
}

export interface JobData {
  id?: string;
  name: string;
  displayName?: string;
  nameEn?: string;
  title?: string;
  tier: number;
  category: ClassCategory;
  role?: string;
  description?: string;
  unlock?: {
    jobs?: JobUnlockRequirement[];
    clearedStageId?: string;
  };
  statModifiers?: Partial<BaseStats>;
  energyCurve: {
    baseMaxEnergy: number;
    energyRegen: number;
    ultimateCost: number;
  };
  mpCurve?: {
    baseMaxMP: number;
    mpGrowth: number;
    skillCost: number;
  };
  levelBonuses: Record<string, Partial<PassiveBonuses>>;
  skills: JobSkillUnlock[];
}

export interface SkillData {
  id: string;
  name: string;
  mpCost: number;       // エネルギーコスト（旧 mpCost の名称を維持）
  power: number;
  type: 'PHYSICAL' | 'MAGICAL' | 'HEAL';
  element?: ElementType;
  attackType?: SkillAttackType;
  targetType?: 'SINGLE' | 'ALL_ENEMIES' | 'SELF' | 'ALLY';
  effectKey?: string;
  isUltimate?: boolean; // 奥義フラグ — true のとき maxEnergy を全消費
  description: string;
}

export interface SubOption {
  type: string;
  value: number;
}

export interface ItemData {
  id: string;
  name: string;
  type: 'WEAPON' | 'SUB' | 'HEAD' | 'BODY' | 'ARMS' | 'LEGS' | 'ACC1' | 'ACC2';
  rarity: 'COMMON' | 'UNIQUE' | 'HIDDEN_UNIQUE';
  stats: Partial<BaseStats>;
  resistances?: Resistances;
  specialEffect?: string;
  
  // 第一発見者システム (GDD-追加要件)
  isUnique: boolean;
  discovererId?: string;
  discovererName?: string;
  serialNo?: number;
  discoveredAt?: string;
  
  // ランダムオプション
  subOptions?: SubOption[];
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
  baseStats?: BaseStats;
  stats: BaseStats;
  passives: PassiveBonuses;
  equipment: EquipmentSlots;
  baseResistances: Resistances;
  jobs: UserJobState[];
  isAwakened: boolean;
  clearedStages: string[];
  // エネルギーシステム（ランタイム状態 — DB非保存）
  currentEnergy: number;
  maxEnergy:     number;
  // 属性ダメージ加成（装備・残滓から集計）
  elementDmgBoosts: Partial<Record<ElementType, number>>;
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

export interface AbyssalResidueData {
  id: string;
  name: string;
  itemId: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  mainStat: { type: string; value: number };
  subOptions: SubOption[];
  level: number;
  exp: number;
  maxExp: number;
}

export interface ResidueMatData {
  id: string;
  name: string;
  quantity: number;
  expValue: number;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
}

export interface SpiritCoreData {
  id: string;
  name: string;
  element?: ElementType;
  skillChangeId?: string;
  atkMultiplier: number;
}

export interface MonsterData {
  id: string;
  name: string;
  tribe: Tribe; // 種族 (GDD-005)
  cost: number;
  stats: BaseStats;
  resistances: Resistances;
  equippedShardId?: string;
  spiritCore?: SpiritCoreData; // 霊核 (GDD-追加要件)
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
  isWeakness?: boolean;
  isResisted?: boolean;
  element?: ElementType;
  attackType?: SkillAttackType;
  playerMP: number;
  playerHP: number;
  description: string;
}
