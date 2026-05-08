// GDD-003, GDD-004, GDD-005, GDD-007 に基づく型定義
// docs/TDD.md の Prisma スキーマと整合性を取った定義

export type ClassCategory = 'PHYSICAL' | 'MAGICAL';
export type Tribe = 'UNDEAD' | 'DEMON' | 'BEAST' | 'HUMANOID';
export type ElementType = 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH' | 'WIND' | 'ICE' | 'LIGHT' | 'DARK' | 'NONE';
export type SkillAttackType = 'SLASH' | 'STRIKE' | 'PROJECTILE' | 'MAGIC' | 'SUMMON' | 'HEAL';
export type EnemyTier = 'MINION' | 'ELITE' | 'BOSS';
export type StageNodeType = 'SAFE' | 'DUNGEON' | 'BOSS';

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

export type WeaponRarity = 'R' | 'SR' | 'SSR' | 'UR';
export type WeaponArchetype = 'LOW' | 'MID' | 'HIGH' | 'MYTHIC';
export type WeaponPassiveSystemTag =
  | 'DEMON_MODE'
  | 'SOUL_SHATTER'
  | 'ACTION_VALUE'
  | 'SHIELD_PIERCE'
  | 'GIANT_KILLING';

export interface WeaponPassive {
  id?: string;
  nameJa: string;
  descTemplate: string;
  values: number[];
  condition?: string | null;
  systemTag?: WeaponPassiveSystemTag;
}

export type WeaponMaterialType =
  | 'IDEA_COMMON'
  | 'IDEA_SR'
  | 'IDEA_SSR'
  | 'ABYSSAL_OBSIDIAN';

export interface WeaponMaterialData {
  type: WeaponMaterialType;
  name: string;
  quantity: number;
}

export interface ItemData {
  id: string;
  name: string;
  type: 'WEAPON' | 'SUB' | 'HEAD' | 'BODY' | 'ARMS' | 'LEGS' | 'ACC1' | 'ACC2';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'UNIQUE' | 'HIDDEN_UNIQUE' | 'R' | 'SR' | 'SSR' | 'UR' | 'LR';
  stats: Partial<BaseStats>;
  resistances?: Resistances;
  specialEffect?: string;
  icon?: string;
  flavor?: string;
  
  // 第一発見者システム (GDD-追加要件)
  isUnique: boolean;
  discovererId?: string;
  discovererName?: string;
  serialNo?: number;
  discoveredAt?: string;
  
  // ランダムオプション
  subOptions?: SubOption[];

  // 武器システム (docs/設計書/13_武器システム.md)
  weaponRarity?: WeaponRarity;
  archetype?: WeaponArchetype;
  rank?: number; // 魂の共鳴 0〜5
  ilv?: number;  // 打ち直しで上昇するアイテムレベル 1〜90
  passiveA?: WeaponPassive;
  passiveB?: WeaponPassive;
  subStatCoefficient?: number;
  isUR?: boolean;
  isDecomposed?: boolean;
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
  elementDmgBoost: number;
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
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  mainStat: { type: string; value: number };
  subOptions: SubOption[];
  level: number;
  exp: number;
  maxExp: number;
  residueScore?: number;
  tierHistory?: number[];
}

export interface ResidueMatData {
  id: string;
  name: string;
  quantity: number;
  expValue: number;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
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
  tier?: EnemyTier;
  weaknesses?: ElementType[];
  shieldHp?: number;
  maxShieldHp?: number;
  shieldBroken?: boolean;
  equippedShardId?: string;
  spiritCore?: SpiritCoreData; // 霊核 (GDD-追加要件)
}

export interface DropEntry {
  type?: 'WEAPON' | 'RESIDUE' | 'MATERIAL' | 'MONSTER';
  itemId?: string;
  monsterId?: string;
  rarity?: string;
  rate: number;
  isHidden?: boolean;
}

export interface BossGimmick {
  trigger: 'HP_BELOW_50' | 'TURN_3' | 'ON_SHIELD_BREAK' | 'ON_REVIVE';
  effect: 'ENRAGE' | 'AV_DELAY' | 'REVIVE' | 'SUMMON_MINIONS';
  value?: number;
}

export interface EnemyData {
  id: string;
  name: string;
  nameJa: string;
  nameEn: string;
  tier: EnemyTier;
  tribe: Tribe;
  stats: BaseStats;
  resistances: Resistances;
  weaknesses: ElementType[];
  shieldHp?: number;
  gimmicks?: BossGimmick[];
  dropTable: DropEntry[];
  battle?: {
    color: string;
    sprite: 'WRAITH' | 'GIANT' | 'WYRM';
    size?: number;
  };
  description?: string;
}

export interface StageWaveData {
  label: string;
  role: 'WARMUP' | 'SHIELD' | 'BOSS';
  enemyIds: string[];
  intent: string;
}

export interface StageData {
  id: string;
  name: string;
  nameJa: string;
  nameEn: string;
  chapter: number;
  chapterName: string;
  area: number;
  nodeType: StageNodeType;
  element: ElementType;
  difficulty: number;
  description: string;
  waveCount: number;
  unlockRequires: string[];
  waves: StageWaveData[];
  rewards: {
    baseExp: number;
    baseGold: number;
    dropTable: DropEntry[];
  };
  position: { x: number; y: number };
  isAreaBoss?: boolean;
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
  playerEnergy: number;
  playerMP?: number; // legacy alias for older UI log readers
  playerHP: number;
  description: string;
}
