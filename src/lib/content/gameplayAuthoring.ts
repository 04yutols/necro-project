import {
  deriveTierBands,
  NECROMANCE_TIER_CONVENTION,
  validateEnemyDraft,
} from '../agent/enemyBalance';
import { validateJobDraft } from '../agent/jobBalance';
import { deriveCostBands, validateMonsterDraft } from '../agent/monsterBalance';
import { findBand, classifySkill, validateSkillDraft } from '../agent/skillBalance';
import { validateWeaponDraft } from '../agent/weaponBalance';
import {
  calculateWeaponBaseAttack,
  getWeaponEffectiveSubOptions,
  WEAPON_LV90_BASE_ATK,
} from '../../logic/WeaponSystem';
import { INITIAL_PLAYER_BASE_STATS } from '../../logic/BalanceConfig';
import type {
  AilmentType,
  BaseStats,
  ClassCategory,
  ElementType,
  EnemyTier,
  ItemData,
  JobBaseStatsByLevel,
  JobData,
  Resistances,
  SkillAttackType,
  SkillData,
  Tribe,
  WeaponArchetype,
  WeaponPassiveSystemTag,
  WeaponRarity,
} from '../../types/game';

export const COMBAT_ROLES = ['STRIKER', 'TANK', 'CONTROLLER', 'SUPPORT'] as const;
export const COMBAT_UNIT_KINDS = ['ENEMY', 'MONSTER', 'JOB'] as const;

export type CombatRole = (typeof COMBAT_ROLES)[number];
export type CombatUnitKind = (typeof COMBAT_UNIT_KINDS)[number];
export type GateFinding = { level: 'PASS' | 'WARN' | 'FAIL'; field: string; message: string };

export type NumericRationale = {
  field: string;
  basis: string;
  targetRange: string;
  selected: number | string;
};

export type GameplayAuthoringContext = {
  existingEnemies: Record<string, unknown>;
  existingMonsters: Record<string, unknown>;
  existingSkills: Record<string, unknown>;
  existingItems: Record<string, unknown>;
  existingJobs: Record<string, unknown>;
  existingStages?: Record<string, unknown>;
  materials?: Record<string, unknown>;
};

export type CombatUnitAuthoringRequest = {
  kind: CombatUnitKind;
  id: string;
  name: string;
  nameJa?: string;
  nameEn?: string;
  description: string;
  role: CombatRole;
  level: number;
  tribe?: Tribe;
  element?: ElementType;
  weaknesses?: ElementType[];
  resistances?: ElementType[];
  tier?: EnemyTier;
  cost?: number;
  maxEnergy?: number;
  skillIds?: string[];
  necromance?: boolean;
  category?: ClassCategory;
  baseAttackType?: SkillAttackType;
  jobTier?: 1 | 2;
};

export type CombatUnitAuthoringResult = {
  authoringKind: 'combat-unit';
  scope: 'enemy' | 'monster' | 'job';
  id: string;
  shared: {
    role: CombatRole;
    level: number;
    stats: BaseStats;
    resistances: Resistances;
    maxEnergy: number;
    cost?: number;
    growth: Record<string, BaseStats>;
  };
  variants: {
    enemy?: Record<string, unknown>;
    playableJob?: JobData;
    necromancedMonster?: Record<string, unknown>;
  };
  changeData: Record<string, unknown>;
  rationale: NumericRationale[];
  gate: { ok: boolean; findings: GateFinding[] };
};

type RoleProfile = {
  multipliers: Pick<BaseStats, 'hp' | 'atk' | 'def' | 'spd'>;
  critRateDelta: number;
  critDmgDelta: number;
  effectHitDelta: number;
  effectResDelta: number;
};

const ROLE_PROFILES: Record<CombatRole, RoleProfile> = {
  STRIKER: {
    multipliers: { hp: 0.9, atk: 1.2, def: 0.85, spd: 1.08 },
    critRateDelta: 5,
    critDmgDelta: 10,
    effectHitDelta: 0,
    effectResDelta: 0,
  },
  TANK: {
    multipliers: { hp: 1.25, atk: 0.82, def: 1.3, spd: 0.82 },
    critRateDelta: 0,
    critDmgDelta: 0,
    effectHitDelta: 0,
    effectResDelta: 12,
  },
  CONTROLLER: {
    multipliers: { hp: 0.95, atk: 0.92, def: 0.95, spd: 1.06 },
    critRateDelta: 0,
    critDmgDelta: 0,
    effectHitDelta: 18,
    effectResDelta: 4,
  },
  SUPPORT: {
    multipliers: { hp: 1.08, atk: 0.82, def: 1.08, spd: 1.08 },
    critRateDelta: 0,
    critDmgDelta: 0,
    effectHitDelta: 8,
    effectResDelta: 8,
  },
};

const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function statsMedian(records: unknown[], fallback: BaseStats): BaseStats {
  const values = records
    .map(record => isRecord(record) && isRecord(record.stats) ? record.stats : undefined)
    .filter((stats): stats is Record<string, unknown> => Boolean(stats));
  return Object.fromEntries(STAT_KEYS.map(key => {
    const nums = values.map(value => value[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return [key, nums.length ? median(nums) : fallback[key]];
  })) as unknown as BaseStats;
}

function fallbackEnemyStats(tier: EnemyTier): BaseStats {
  if (tier === 'BOSS') return { hp: 900, atk: 34, def: 28, spd: 92, critRate: 8, critDmg: 165, effectHit: 20, effectRes: 25 };
  if (tier === 'ELITE') return { hp: 150, atk: 16, def: 14, spd: 88, critRate: 5, critDmg: 155, effectHit: 12, effectRes: 12 };
  return { hp: 22, atk: 5, def: 4, spd: 74, critRate: 2, critDmg: 150, effectHit: 5, effectRes: 4 };
}

function fallbackMonsterStats(cost: number): BaseStats {
  return {
    hp: 45 * cost,
    atk: 9 + cost * 5,
    def: 4 + cost * 5,
    spd: 70 + cost * 8,
    critRate: Math.max(0, cost - 1) * 3,
    critDmg: 150 + Math.max(0, cost - 1) * 5,
    effectHit: Math.max(0, cost - 1) * 5,
    effectRes: Math.max(0, cost - 1) * 5,
  };
}

function roleAdjusted(base: BaseStats, role: CombatRole): BaseStats {
  const profile = ROLE_PROFILES[role];
  return {
    hp: Math.max(1, Math.round(base.hp * profile.multipliers.hp)),
    atk: Math.max(1, Math.round(base.atk * profile.multipliers.atk)),
    def: Math.max(0, Math.round(base.def * profile.multipliers.def)),
    spd: Math.max(1, Math.round(base.spd * profile.multipliers.spd)),
    critRate: round(clamp(base.critRate + profile.critRateDelta, 0, 100), 1),
    critDmg: round(Math.max(100, base.critDmg + profile.critDmgDelta), 1),
    effectHit: round(Math.max(0, base.effectHit + profile.effectHitDelta), 1),
    effectRes: round(Math.max(0, base.effectRes + profile.effectResDelta), 1),
  };
}

function levelAdjusted(base: BaseStats, level: number): BaseStats {
  // Existing enemy/monster bands are treated as the Chapter 1 Lv20 anchor.
  const factor = clamp(0.75 + clamp(level, 1, 100) * 0.0125, 0.75, 2);
  return {
    hp: Math.max(1, Math.round(base.hp * factor)),
    atk: Math.max(1, Math.round(base.atk * factor)),
    def: Math.max(0, Math.round(base.def * factor)),
    spd: Math.max(1, Math.round(base.spd * (1 + (factor - 1) * 0.15))),
    critRate: round(clamp(base.critRate + (factor - 1) * 2, 0, 100), 1),
    critDmg: round(Math.max(100, base.critDmg + (factor - 1) * 5), 1),
    effectHit: round(Math.max(0, base.effectHit + (factor - 1) * 5), 1),
    effectRes: round(Math.max(0, base.effectRes + (factor - 1) * 5), 1),
  };
}

function growthCurve(target: BaseStats, targetLevel: number): Record<string, BaseStats> {
  const level = clamp(Math.round(targetLevel), 1, 100);
  const checkpoints = new Set([1, level]);
  for (let n = 10; n < level; n += 10) checkpoints.add(n);
  const progressAt = (n: number) => level === 1 ? 1 : (n - 1) / (level - 1);
  const startRatio: Record<keyof BaseStats, number> = {
    hp: 0.42, atk: 0.38, def: 0.4, spd: 0.9,
    critRate: 0.75, critDmg: 0.94, effectHit: 0.3, effectRes: 0.3,
  };
  return Object.fromEntries([...checkpoints].sort((a, b) => a - b).map(n => {
    const progress = progressAt(n);
    const stats = Object.fromEntries(STAT_KEYS.map(key => {
      const value = target[key] * (startRatio[key] + (1 - startRatio[key]) * progress);
      return [key, ['critRate', 'critDmg', 'effectHit', 'effectRes'].includes(key) ? round(value, 1) : Math.max(1, Math.round(value))];
    })) as unknown as BaseStats;
    return [String(n), stats];
  }));
}

function resistanceProfile(weaknesses: ElementType[] = [], resistances: ElementType[] = []): Resistances {
  const result: Resistances = {};
  for (const element of weaknesses) if (element !== 'NONE') result[element] = -25;
  for (const element of resistances) if (element !== 'NONE' && !weaknesses.includes(element)) result[element] = 20;
  return result;
}

function buildJobStats(role: CombatRole): { modifiers: BaseStats; levels: JobBaseStatsByLevel } {
  const profile = ROLE_PROFILES[role];
  const modifiers: BaseStats = {
    hp: profile.multipliers.hp,
    atk: profile.multipliers.atk,
    def: profile.multipliers.def,
    spd: profile.multipliers.spd,
    critRate: 1 + profile.critRateDelta / 50,
    critDmg: 1 + profile.critDmgDelta / 100,
    effectHit: 1 + profile.effectHitDelta / 50,
    effectRes: 1 + profile.effectResDelta / 50,
  };
  const level100 = roleAdjusted({
    hp: 300, atk: 220, def: 220, spd: 102,
    critRate: 7, critDmg: 165, effectHit: 8, effectRes: 8,
  }, role);
  const curve = growthCurve(level100, 100);
  const levels: JobBaseStatsByLevel = {};
  let last = curve['1'];
  for (let level = 1; level <= 100; level += 1) {
    const progress = (level - 1) / 99;
    last = Object.fromEntries(STAT_KEYS.map(key => {
      const start = roleAdjusted(INITIAL_PLAYER_BASE_STATS, role)[key];
      const end = level100[key];
      const value = start + (end - start) * progress;
      return [key, ['critRate', 'critDmg', 'effectHit', 'effectRes'].includes(key) ? round(value, 1) : Math.max(1, Math.round(value))];
    })) as unknown as BaseStats;
    levels[String(level)] = { ...last, mp: Math.round(20 + progress * 100) };
  }
  return { modifiers, levels };
}

export function authorCombatUnit(
  request: CombatUnitAuthoringRequest,
  ctx: GameplayAuthoringContext,
): CombatUnitAuthoringResult {
  const level = clamp(Math.round(request.level), 1, 100);
  const maxEnergy = Math.max(1, Math.round(request.maxEnergy ?? 30));
  const resistances = resistanceProfile(request.weaknesses, request.resistances);
  let scope: CombatUnitAuthoringResult['scope'];
  let base: BaseStats;
  let preparedJob: ReturnType<typeof buildJobStats> | undefined;

  if (request.kind === 'ENEMY') {
    const tier = request.tier ?? 'MINION';
    const matching = Object.values(ctx.existingEnemies).filter(value => isRecord(value) && value.tier === tier);
    base = statsMedian(matching, fallbackEnemyStats(tier));
    scope = 'enemy';
  } else if (request.kind === 'MONSTER') {
    const cost = Math.max(1, Math.round(request.cost ?? 1));
    const matching = Object.values(ctx.existingMonsters).filter(value => isRecord(value) && value.cost === cost);
    base = statsMedian(matching, fallbackMonsterStats(cost));
    scope = 'monster';
  } else {
    preparedJob = buildJobStats(request.role);
    const atLevel = preparedJob.levels[String(level)];
    base = Object.fromEntries(STAT_KEYS.map(key => [key, atLevel[key]])) as unknown as BaseStats;
    scope = 'job';
  }

  const stats = request.kind === 'JOB' ? base : levelAdjusted(roleAdjusted(base, request.role), level);
  const growth = growthCurve(stats, level);
  const selectedStats = growth[String(level)] ?? stats;
  const tribe = request.tribe ?? 'UNDEAD';
  const skillIds = request.skillIds ?? [];
  const rationale: NumericRationale[] = [
    { field: 'stats', basis: request.kind === 'JOB'
      ? `Aldo基礎値へ${request.role}役割係数を適用したLv${level}テーブル`
      : `${scope}の既存マスター中央値へ${request.role}役割係数とLv20アンカーのlevel係数を適用`, targetRange: `${scope}既存帯 ± validator tolerance`, selected: JSON.stringify(selectedStats) },
    { field: 'growth', basis: 'Lv1から指定レベルまで役割比率を保つ決定論的補間', targetRange: `Lv1〜Lv${level}`, selected: Object.keys(growth).join(',') },
    { field: 'resistances', basis: '弱点=-25%、耐性=+20%の整数%規約', targetRange: '-50〜+50%', selected: JSON.stringify(resistances) },
    { field: 'maxEnergy', basis: '主人公・使役魔物共通MPリソース（legacy名はmpCost）', targetRange: '1以上', selected: maxEnergy },
  ];

  const variants: CombatUnitAuthoringResult['variants'] = {};
  let changeData: Record<string, unknown>;
  let gate: CombatUnitAuthoringResult['gate'];

  if (request.kind === 'ENEMY') {
    const tier = request.tier ?? 'MINION';
    const enemy: Record<string, unknown> = {
      id: request.id,
      name: request.name,
      nameJa: request.nameJa ?? request.name,
      nameEn: request.nameEn ?? request.id.replaceAll('_', ' ').toUpperCase(),
      tier,
      tribe,
      stats: selectedStats,
      resistances,
      weaknesses: request.weaknesses ?? [],
      dropTable: [],
      battle: { color: '#8B00FF', sprite: tier === 'BOSS' ? 'GIANT' : 'WRAITH', size: tier === 'BOSS' ? 1.1 : 0.75 },
      description: request.description,
    };
    if (request.necromance !== false) {
      const convention = NECROMANCE_TIER_CONVENTION[tier];
      const allyCost = Math.max(1, Math.round(request.cost ?? convention.allyCost));
      const allyBase = statsMedian(
        Object.values(ctx.existingMonsters).filter(value => isRecord(value) && value.cost === allyCost),
        fallbackMonsterStats(allyCost),
      );
      const allyStats = roleAdjusted(allyBase, request.role);
      const necromanced = { cost: allyCost, stats: allyStats, maxEnergy, skillIds };
      variants.necromancedMonster = necromanced;
      enemy.necromance = {
        captureRate: convention.captureRate,
        allyCost,
        allyStats,
        allyMaxEnergy: maxEnergy,
        skillIds,
      };
      rationale.push({ field: 'necromance', basis: `${tier}捕獲率・cost規約とmonster側cost帯を使用`, targetRange: `capture=${convention.captureRate}, cost=${convention.allyCost}`, selected: JSON.stringify(necromanced) });
    }
    variants.enemy = enemy;
    changeData = enemy;
    const result = validateEnemyDraft(enemy, {
      existingEnemies: ctx.existingEnemies,
      itemIds: new Set(Object.keys(ctx.existingItems)),
      materialIds: new Set(Object.keys(ctx.materials ?? {})),
      skillIds: new Set(Object.keys(ctx.existingSkills)),
      skillMeta: Object.fromEntries(Object.entries(ctx.existingSkills).map(([id, value]) => [id, isRecord(value) ? value : {}])),
    });
    gate = result;
  } else if (request.kind === 'MONSTER') {
    const cost = Math.max(1, Math.round(request.cost ?? 1));
    changeData = {
      id: request.id,
      name: request.name,
      tribe,
      cost,
      stats: selectedStats,
      resistances,
      skillIds,
      currentEnergy: maxEnergy,
      maxEnergy,
    };
    variants.necromancedMonster = { cost, stats: selectedStats, maxEnergy, skillIds };
    const result = validateMonsterDraft(changeData, {
      existingMonsters: ctx.existingMonsters,
      monsterIds: new Set(Object.keys(ctx.existingMonsters)),
      expectedCost: cost,
    });
    gate = result;
  } else {
    const job = preparedJob ?? buildJobStats(request.role);
    const tier = request.jobTier ?? 1;
    const category = request.category ?? 'PHYSICAL';
    const defaultAttack: SkillAttackType = category === 'MAGICAL' ? 'MAGIC' : 'SLASH';
    const jobData: JobData & { id: string } = {
      id: request.id,
      name: request.nameEn ?? request.id.replaceAll('_', ' '),
      displayName: request.nameJa ?? request.name,
      tier,
      category,
      baseAttackType: request.baseAttackType ?? defaultAttack,
      role: request.role,
      description: request.description,
      statModifiers: job.modifiers,
      energyCurve: { baseMaxEnergy: Math.max(1, Math.round(maxEnergy * 0.2)), ultimateCost: maxEnergy, spGrowthPerLevel: round(maxEnergy / 100, 2) },
      baseStatsByLevel: job.levels,
      levelBonuses: {},
      skills: skillIds.map((skillId, index) => ({ level: index === 0 ? 1 : Math.min(100, 1 + index * 4), skillId })),
    };
    variants.playableJob = jobData;
    changeData = jobData as unknown as Record<string, unknown>;
    const result = validateJobDraft(jobData, {
      existingJobs: ctx.existingJobs,
      jobIds: new Set(Object.keys(ctx.existingJobs)),
      skillIds: new Set(Object.keys(ctx.existingSkills)),
      skillMeta: Object.fromEntries(Object.entries(ctx.existingSkills).map(([id, value]) => [id, isRecord(value) ? value : {}])),
    });
    gate = result;
  }

  return {
    authoringKind: 'combat-unit', scope, id: request.id,
    shared: { role: request.role, level, stats: selectedStats, resistances, maxEnergy, ...(request.cost ? { cost: request.cost } : {}), growth },
    variants, changeData, rationale, gate,
  };
}

export type SkillAuthoringRequest = {
  id: string;
  name: string;
  description: string;
  type: ClassCategory;
  targetType: 'SINGLE' | 'ALL_ENEMIES';
  element: ElementType;
  attackType: Exclude<SkillAttackType, 'HEAL'>;
  ownerKind: 'job' | 'monster';
  ownerId: string;
  tier: 1 | 2;
  potency: 'LOW' | 'MID' | 'HIGH';
  ailmentType?: AilmentType;
  isUltimate?: boolean;
  ultimateCost?: number;
};

export type SkillAuthoringResult = {
  authoringKind: 'skill';
  scope: 'skill';
  id: string;
  changeData: SkillData;
  budget: { classification: string; powerRange: [number, number]; ailmentBudget?: number };
  rationale: NumericRationale[];
  gate: { ok: boolean; findings: GateFinding[] };
};

const POTENCY_POINT = { LOW: 0.25, MID: 0.5, HIGH: 0.75 } as const;

export function authorSkill(request: SkillAuthoringRequest, ctx: GameplayAuthoringContext): SkillAuthoringResult {
  const point = POTENCY_POINT[request.potency];
  let mpCost: number;
  let powerRange: [number, number];
  if (request.isUltimate) {
    mpCost = Math.max(1, Math.round(request.ultimateCost ?? (request.tier === 2 ? 100 : 80)));
    powerRange = request.targetType === 'ALL_ENEMIES'
      ? request.tier === 2 ? [2.5, 3.5] : [2.0, 2.8]
      : request.tier === 2 ? [3.5, 4.8] : [2.8, 3.5];
  } else {
    const costs = request.type === 'PHYSICAL' ? [6, 12, 18] : [10, 15, 21];
    mpCost = costs[request.potency === 'LOW' ? 0 : request.potency === 'MID' ? 1 : 2];
    const classification = classifySkill(request.type, request.targetType);
    const band = classification ? findBand(classification, mpCost) : null;
    if (!band) throw new Error(`No power band for ${request.type}/${request.targetType}/mpCost=${mpCost}`);
    powerRange = request.tier === 2 ? band.t2 : band.t1;
  }
  const power = round(powerRange[0] + (powerRange[1] - powerRange[0]) * point, 2);
  const ailmentBaseRate = request.ailmentType
    ? request.isUltimate
      ? request.ailmentType === 'FREEZE' || request.ailmentType === 'PARALYSIS' ? 0.25 : 0.4
      : round(clamp((60 - power * 10) / 100, request.ailmentType === 'FREEZE' || request.ailmentType === 'PARALYSIS' ? 0.15 : 0.2, request.ailmentType === 'FREEZE' || request.ailmentType === 'PARALYSIS' ? 0.25 : 0.55), 2)
    : undefined;
  const skill: SkillData = {
    id: request.id,
    name: request.name,
    mpCost,
    power,
    type: request.type,
    element: request.element,
    attackType: request.attackType,
    targetType: request.targetType,
    effectKey: `${request.element.toLowerCase()}_${request.attackType.toLowerCase()}`,
    ...(request.isUltimate ? { isUltimate: true } : {}),
    ...(request.ailmentType ? { ailmentType: request.ailmentType, ailmentBaseRate } : {}),
    description: request.description,
  };
  const ownerRaw = request.ownerKind === 'job' ? ctx.existingJobs[request.ownerId] : ctx.existingMonsters[request.ownerId];
  const ownerRecord = isRecord(ownerRaw) ? ownerRaw : {};
  const result = validateSkillDraft(skill, {
    existingSkills: ctx.existingSkills,
    skillIds: new Set(Object.keys(ctx.existingSkills)),
    owner: {
      kind: request.ownerKind,
      id: request.ownerId,
      displayName: typeof ownerRecord.displayName === 'string' ? ownerRecord.displayName : typeof ownerRecord.name === 'string' ? ownerRecord.name : request.ownerId,
      category: typeof ownerRecord.category === 'string' ? ownerRecord.category : request.type,
      baseAttackType: typeof ownerRecord.baseAttackType === 'string' ? ownerRecord.baseAttackType : request.attackType,
      tier: request.tier,
      ultimateCost: request.isUltimate ? mpCost : undefined,
    },
  });
  const classification = request.isUltimate ? 'ULTIMATE' : String(classifySkill(request.type, request.targetType));
  return {
    authoringKind: 'skill', scope: 'skill', id: request.id, changeData: skill,
    budget: { classification, powerRange, ...(!request.isUltimate && ailmentBaseRate !== undefined ? { ailmentBudget: round(power * 10 + ailmentBaseRate * 100, 1) } : {}) },
    rationale: [
      { field: 'mpCost', basis: request.isUltimate ? 'owner maxEnergyを全消費' : '設計書19の系統別コスト帯', targetRange: request.isUltimate ? 'ultimateCostと一致' : request.type === 'PHYSICAL' ? '4〜24' : '8〜24', selected: mpCost },
      { field: 'power', basis: `${classification}/Tier${request.tier}の${request.potency}点`, targetRange: `${powerRange[0]}〜${powerRange[1]}`, selected: power },
      ...(!request.isUltimate && ailmentBaseRate !== undefined ? [{ field: 'ailmentBudget', basis: 'power×10 + rate×100 ≈ 57〜65', targetRange: '57〜65（CCはrate≤0.25）', selected: round(power * 10 + ailmentBaseRate * 100, 1) }] : []),
    ],
    gate: result,
  };
}

export type WeaponAuthoringRequest = {
  id: string;
  name: string;
  flavor: string;
  rarity: WeaponRarity;
  archetype: WeaponArchetype;
  ilv: number;
  subOption: 'ATK%' | 'ATK_FLAT' | 'CRIT_RATE' | 'CRIT_DMG' | 'EFFECT_HIT' | 'EFFECT_RES' | 'DEF%';
  element?: Exclude<ElementType, 'NONE'>;
  passiveA: { nameJa: string; descTemplate: string; baseValue: number; systemTag?: WeaponPassiveSystemTag };
  passiveB: { nameJa: string; descTemplate: string; baseValue: number; systemTag?: WeaponPassiveSystemTag };
};

export type WeaponAuthoringResult = {
  authoringKind: 'weapon'; scope: 'weapon'; id: string; changeData: ItemData;
  baseAtk: { ilv: number; current: number; lv90: number };
  rationale: NumericRationale[];
  gate: { ok: boolean; findings: GateFinding[] };
};

function rankValues(baseValue: number): number[] {
  return [1, 1.2, 1.4, 1.6, 2].map(multiplier => round(baseValue * multiplier, 1));
}

export function authorWeapon(request: WeaponAuthoringRequest, ctx: GameplayAuthoringContext): WeaponAuthoringResult {
  const ilv = clamp(Math.round(request.ilv), 1, 90);
  if (WEAPON_LV90_BASE_ATK[request.rarity][request.archetype] === null) {
    throw new Error(`${request.rarity}/${request.archetype} is not a supported WeaponSystem combination.`);
  }
  const normalValue: Record<WeaponAuthoringRequest['subOption'], number> = {
    'ATK%': 6.2, ATK_FLAT: 8, CRIT_RATE: 5.2, CRIT_DMG: 8.5, EFFECT_HIT: 7, EFFECT_RES: 7, 'DEF%': 6.2,
  };
  const subOptions: Array<{ type: string; value: number }> = [{ type: request.subOption, value: normalValue[request.subOption] }];
  if (request.rarity === 'SSR' || request.rarity === 'UR') {
    if (!request.element) throw new Error(`${request.rarity} weapon authoring requires an element sub option.`);
    subOptions.push({ type: `${request.element}_DMG_BOOST`, value: request.rarity === 'UR' ? 10 : 8 });
  }
  const passive = (value: WeaponAuthoringRequest['passiveA']) => ({
    nameJa: value.nameJa,
    descTemplate: value.descTemplate.includes('{value}') ? value.descTemplate : `${value.descTemplate} {value}%`,
    values: rankValues(value.baseValue),
    ...(value.systemTag ? { systemTag: value.systemTag } : {}),
  });
  const item: ItemData = {
    id: request.id,
    name: request.name,
    type: 'WEAPON',
    rarity: request.rarity,
    weaponRarity: request.rarity,
    archetype: request.archetype,
    rank: 1,
    ilv,
    isUnique: request.rarity === 'UR',
    stats: {},
    subOptions,
    passiveA: passive(request.passiveA),
    passiveB: passive(request.passiveB),
    flavor: request.flavor,
  };
  const current = calculateWeaponBaseAttack(item);
  const lv90 = WEAPON_LV90_BASE_ATK[request.rarity][request.archetype];
  const result = validateWeaponDraft(item, {
    existingItems: ctx.existingItems,
    itemIds: new Set(Object.keys(ctx.existingItems)),
    expectedRarity: request.rarity,
  });
  return {
    authoringKind: 'weapon', scope: 'weapon', id: request.id, changeData: item,
    baseAtk: { ilv, current, lv90: typeof lv90 === 'number' ? lv90 : current },
    rationale: [
      { field: 'baseAtk', basis: 'WeaponSystemのrarity×archetype×ILv式', targetRange: `ILv1〜90`, selected: current },
      { field: 'subOptions', basis: '設計書92の通常1枠＋SSR/UR固定属性1枠', targetRange: `${request.rarity}規約`, selected: JSON.stringify(getWeaponEffectiveSubOptions(item)) },
      { field: 'passiveA/B', basis: '魂の共鳴Rank I〜Vを1.0/1.2/1.4/1.6/2.0倍で生成', targetRange: '5段階', selected: `${item.passiveA?.values.join('/')} | ${item.passiveB?.values.join('/')}` },
    ],
    gate: result,
  };
}

export type ResidueNameAuthoringRequest = {
  id: string; name: string; rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  chapter: number; origin: string; themes: string[];
};

export function authorResidueName(request: ResidueNameAuthoringRequest) {
  return {
    authoringKind: 'residue-name' as const,
    scope: 'residue-name' as const,
    id: request.id,
    changeData: { id: request.id, name: request.name, rarity: request.rarity, chapter: request.chapter, origin: request.origin, tags: request.themes },
    approvalBoundary: {
      creative: 'Content Package human review',
      performance: 'AbyssalResidueService deterministic RNG; no stat fields are authored here',
    },
  };
}
