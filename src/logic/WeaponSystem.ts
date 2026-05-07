import type {
  BaseStats,
  ItemData,
  SubOption,
  WeaponArchetype,
  WeaponMaterialData,
  WeaponMaterialType,
  WeaponPassive,
  WeaponRarity,
} from '../types/game';

export const WEAPON_MAX_ILV = 90;
export const WEAPON_MAX_RANK = 5;

export const WEAPON_LV90_BASE_ATK: Record<WeaponRarity, Record<WeaponArchetype, number | null>> = {
  R:   { LOW: 354, MID: 401, HIGH: 448, MYTHIC: null },
  SR:  { LOW: 454, MID: 510, HIGH: 565, MYTHIC: null },
  SSR: { LOW: 542, MID: 608, HIGH: 674, MYTHIC: null },
  UR:  { LOW: null, MID: null, HIGH: null, MYTHIC: 780 },
};

export const WEAPON_SUBSTAT_COEFFICIENT: Record<WeaponArchetype, number> = {
  LOW: 1.2,
  MID: 1,
  HIGH: 0.8,
  MYTHIC: 1.25,
};

export const WEAPON_RARITY_LABEL: Record<WeaponRarity, string> = {
  R: '凡庸',
  SR: '業物',
  SSR: '遺物',
  UR: '理外の呪装',
};

export const WEAPON_ARCHETYPE_LABEL: Record<WeaponArchetype, string> = {
  LOW: '低ベース型',
  MID: '中ベース型',
  HIGH: '高ベース型',
  MYTHIC: '規格外',
};

const LEGACY_RARITY_MAP: Record<string, WeaponRarity> = {
  COMMON: 'R',
  RARE: 'SR',
  EPIC: 'SSR',
  LEGENDARY: 'SSR',
  UNIQUE: 'SSR',
  HIDDEN_UNIQUE: 'UR',
  LR: 'UR',
};

const MATERIAL_NAMES: Record<WeaponMaterialType, string> = {
  IDEA_COMMON: '凡骨のイデア',
  IDEA_SR: '業物のイデア',
  IDEA_SSR: '英雄のイデア',
  ABYSSAL_OBSIDIAN: '深淵の黒鋼',
};

const MATERIAL_RARITY: Record<WeaponRarity, WeaponMaterialType | null> = {
  R: 'IDEA_COMMON',
  SR: 'IDEA_SR',
  SSR: 'IDEA_SSR',
  UR: null,
};

const RANK_UP_COSTS: Record<WeaponRarity, number[]> = {
  R: [0, 4, 8, 12, 16, 24],
  SR: [0, 3, 6, 9, 12, 18],
  SSR: [0, 2, 4, 6, 8, 12],
  UR: [0, 0, 0, 0, 0, 0],
};

const REFORGE_TIERS = [
  { from: 1, to: 40, obsidian: 10 },
  { from: 40, to: 60, obsidian: 25 },
  { from: 60, to: 80, obsidian: 50 },
  { from: 80, to: 90, obsidian: 100 },
];

export interface WeaponAttackBreakdown {
  characterBaseAtk: number;
  weaponBaseAtk: number;
  atkBonusPercent: number;
  flatAtk: number;
  finalAtk: number;
}

export interface WeaponCost {
  type: WeaponMaterialType;
  name: string;
  quantity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeOptionType(type: string): string {
  const upper = type.toUpperCase();
  if (upper === 'MATK') return 'ATK';
  if (upper === 'MATK%') return 'ATK%';
  if (upper === 'MATK_FLAT') return 'ATK_FLAT';
  return upper;
}

export function isWeaponSystemItem(item: ItemData | null | undefined): boolean {
  if (!item || item.type !== 'WEAPON') return false;
  return Boolean(item.weaponRarity || item.archetype || item.passiveA || item.passiveB || typeof item.ilv === 'number' || item.isUR);
}

export function getWeaponRarity(item: ItemData): WeaponRarity {
  if (item.weaponRarity) return item.weaponRarity;
  return LEGACY_RARITY_MAP[item.rarity] ?? 'R';
}

export function getWeaponArchetype(item: ItemData): WeaponArchetype {
  if (item.archetype) return item.archetype;
  return getWeaponRarity(item) === 'UR' ? 'MYTHIC' : 'MID';
}

export function getWeaponRank(item: ItemData): number {
  return clamp(Math.round(item.rank ?? 0), 0, WEAPON_MAX_RANK);
}

export function getWeaponIlv(item: ItemData): number {
  return clamp(Math.round(item.ilv ?? WEAPON_MAX_ILV), 1, WEAPON_MAX_ILV);
}

export function getWeaponLv90BaseAttack(item: ItemData): number {
  const rarity = getWeaponRarity(item);
  const archetype = getWeaponArchetype(item);
  const base = WEAPON_LV90_BASE_ATK[rarity][archetype];
  if (typeof base === 'number') return base;
  return WEAPON_LV90_BASE_ATK[rarity].MID ?? WEAPON_LV90_BASE_ATK.UR.MYTHIC ?? 780;
}

export function calculateWeaponBaseAttack(item: ItemData): number {
  if (!isWeaponSystemItem(item)) return Math.round(item.stats.atk ?? 0);

  const ilv = getWeaponIlv(item);
  const lv90Base = getWeaponLv90BaseAttack(item);
  const ilvScale = 0.58 + (ilv / WEAPON_MAX_ILV) * 0.42;

  return Math.round(lv90Base * ilvScale);
}

export function getWeaponSubStatCoefficient(item: ItemData): number {
  if (typeof item.subStatCoefficient === 'number') return item.subStatCoefficient;
  return WEAPON_SUBSTAT_COEFFICIENT[getWeaponArchetype(item)];
}

export function getWeaponEffectiveStats(item: ItemData): Partial<BaseStats> {
  if (!isWeaponSystemItem(item)) return item.stats ?? {};
  return {
    ...(item.stats ?? {}),
    atk: calculateWeaponBaseAttack(item),
  };
}

export function getWeaponEffectiveSubOptions(item: ItemData): SubOption[] {
  const options = item.subOptions ?? [];
  if (!isWeaponSystemItem(item)) return options;

  const coefficient = getWeaponSubStatCoefficient(item);
  return options.map((option) => ({
    ...option,
    value: Number((option.value * coefficient).toFixed(1)),
  }));
}

export function describeWeaponPassive(passive: WeaponPassive | undefined, rank: number): string {
  if (!passive) return 'パッシブ未設定';
  const activeRank = clamp(Math.max(1, rank), 1, WEAPON_MAX_RANK);
  const value = passive.values[Math.min(activeRank - 1, passive.values.length - 1)] ?? passive.values[0] ?? 0;
  return passive.descTemplate.replace(/\{value\}/g, Number(value.toFixed(1)).toString());
}

export function calculateWeaponAttackBreakdown(
  characterBaseAtk: number,
  weapon: ItemData | null | undefined,
  bonuses: { atkBonusPercent?: number; flatAtk?: number } = {},
): WeaponAttackBreakdown {
  const weaponBaseAtk = weapon ? calculateWeaponBaseAttack(weapon) : 0;
  const atkBonusPercent = bonuses.atkBonusPercent ?? 0;
  const flatAtk = bonuses.flatAtk ?? 0;
  const finalAtk = Math.round((characterBaseAtk + weaponBaseAtk) * (1 + atkBonusPercent / 100) + flatAtk);

  return {
    characterBaseAtk,
    weaponBaseAtk,
    atkBonusPercent,
    flatAtk,
    finalAtk,
  };
}

export function collectWeaponAttackBonuses(options: SubOption[] = []): { atkBonusPercent: number; flatAtk: number } {
  return options.reduce((acc, option) => {
    const type = normalizeOptionType(option.type);
    if (type === 'ATK%' || type === 'ATK_BONUS') acc.atkBonusPercent += option.value;
    if (type === 'ATK_FLAT' || type === 'ATK') acc.flatAtk += option.value;
    return acc;
  }, { atkBonusPercent: 0, flatAtk: 0 });
}

export function getRankUpCost(item: ItemData): WeaponCost | null {
  const rarity = getWeaponRarity(item);
  const materialType = MATERIAL_RARITY[rarity];
  if (!materialType) return null;
  const nextRank = getWeaponRank(item) + 1;
  if (nextRank > WEAPON_MAX_RANK) return null;
  return {
    type: materialType,
    name: MATERIAL_NAMES[materialType],
    quantity: RANK_UP_COSTS[rarity][nextRank],
  };
}

export function getNextReforgeTargetIlv(item: ItemData): number | null {
  const ilv = getWeaponIlv(item);
  const tier = REFORGE_TIERS.find((candidate) => ilv < candidate.to);
  return tier?.to ?? null;
}

export function getReforgeCost(item: ItemData): WeaponCost[] {
  const target = getNextReforgeTargetIlv(item);
  if (!target) return [];
  const current = getWeaponIlv(item);
  const tier = REFORGE_TIERS.find((candidate) => current < candidate.to && target === candidate.to);
  if (!tier) return [];

  const costs: WeaponCost[] = [{
    type: 'ABYSSAL_OBSIDIAN',
    name: MATERIAL_NAMES.ABYSSAL_OBSIDIAN,
    quantity: tier.obsidian,
  }];

  if (target === WEAPON_MAX_ILV && getWeaponRarity(item) === 'SSR') {
    costs.push({ type: 'IDEA_SSR', name: MATERIAL_NAMES.IDEA_SSR, quantity: 1 });
  }

  return costs;
}

export function calculateReforgedWeapon(item: ItemData, targetIlv: number): ItemData {
  const next = {
    ...item,
    ilv: clamp(targetIlv, 1, WEAPON_MAX_ILV),
  };
  return {
    ...next,
    stats: {
      ...(next.stats ?? {}),
      atk: calculateWeaponBaseAttack(next),
    },
  };
}

export function calculateDismantleRewards(item: ItemData): WeaponCost[] {
  const rarity = getWeaponRarity(item);
  if (rarity === 'UR' || item.isUR) return [];
  const type = MATERIAL_RARITY[rarity];
  if (!type) return [];
  const quantity = rarity === 'R' ? 8 : rarity === 'SR' ? 5 : 3;
  return [{ type, name: MATERIAL_NAMES[type], quantity }];
}

export function hasEnoughWeaponMaterials(materials: WeaponMaterialData[], costs: WeaponCost[]): boolean {
  return costs.every((cost) => (materials.find((mat) => mat.type === cost.type)?.quantity ?? 0) >= cost.quantity);
}

export function getWeaponSortScore(item: ItemData): number {
  const rarityWeight: Record<WeaponRarity, number> = { UR: 4, SSR: 3, SR: 2, R: 1 };
  return rarityWeight[getWeaponRarity(item)] * 100000 + calculateWeaponBaseAttack(item) * 100 + getWeaponRank(item) * 10 + getWeaponIlv(item);
}
