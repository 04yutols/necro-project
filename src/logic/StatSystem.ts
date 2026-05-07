import type {
  AbyssalResidueData,
  BaseStats,
  CharacterData,
  ElementType,
  EquipmentSlots,
  ItemData,
  PassiveBonuses,
  SubOption,
} from '../types/game';
import {
  getWeaponEffectiveStats,
  getWeaponEffectiveSubOptions,
  isWeaponSystemItem,
} from './WeaponSystem';

export const COMBAT_STAT_KEYS: (keyof BaseStats)[] = [
  'hp',
  'atk',
  'def',
  'spd',
  'critRate',
  'critDmg',
  'effectHit',
  'effectRes',
];

export const ELEMENT_DAMAGE_KEYS: Exclude<ElementType, 'NONE'>[] = [
  'FIRE',
  'WATER',
  'THUNDER',
  'EARTH',
  'WIND',
  'ICE',
  'LIGHT',
  'DARK',
];

export const STAT_VIEW_META: Record<keyof BaseStats, { label: string; labelJa: string; percent?: boolean; priority: number }> = {
  hp:        { label: 'HP',        labelJa: '最大HP',         priority: 1 },
  atk:       { label: 'ATK',       labelJa: '攻撃力',         priority: 2 },
  def:       { label: 'DEF',       labelJa: '防御力',         priority: 3 },
  spd:       { label: 'SPD',       labelJa: '速度',           priority: 4 },
  critRate:  { label: 'CRIT RATE', labelJa: '会心率',         percent: true, priority: 5 },
  critDmg:   { label: 'CRIT DMG',  labelJa: '会心ダメージ',   percent: true, priority: 6 },
  effectHit: { label: 'EFFECT HIT', labelJa: '効果命中',      percent: true, priority: 7 },
  effectRes: { label: 'EFFECT RES', labelJa: '効果抵抗',      percent: true, priority: 8 },
};

export const ELEMENT_VIEW_META: Record<Exclude<ElementType, 'NONE'>, { label: string; labelJa: string; color: string }> = {
  FIRE:    { label: 'FIRE',    labelJa: '炎', color: '#ff5a1f' },
  WATER:   { label: 'WATER',   labelJa: '水', color: '#38bdf8' },
  THUNDER: { label: 'THUNDER', labelJa: '雷', color: '#fde047' },
  EARTH:   { label: 'EARTH',   labelJa: '土', color: '#a16207' },
  WIND:    { label: 'WIND',    labelJa: '風', color: '#7dd3fc' },
  ICE:     { label: 'ICE',     labelJa: '氷', color: '#93c5fd' },
  LIGHT:   { label: 'LIGHT',   labelJa: '光', color: '#fef3c7' },
  DARK:    { label: 'DARK',    labelJa: '闇', color: '#a855f7' },
};

export interface StatBreakdown {
  job: BaseStats;
  passives: BaseStats;
  equipment: BaseStats;
  residues: BaseStats;
  total: BaseStats;
  elementDmgBoosts: Partial<Record<ElementType, number>>;
}

const ZERO_STATS: BaseStats = {
  hp: 0,
  atk: 0,
  def: 0,
  spd: 0,
  critRate: 0,
  critDmg: 0,
  effectHit: 0,
  effectRes: 0,
};

const OPTION_ALIASES: Record<string, string> = {
  MATK: 'ATK',
  MDEF: 'DEF',
  AGI: 'SPD',
  LUCK: 'CRIT_RATE',
  TEC: 'CRIT_DMG',
  MP: 'ENERGY',
};

const STAT_OPTION_TO_KEY: Record<string, keyof BaseStats> = {
  HP: 'hp',
  ATK: 'atk',
  DEF: 'def',
  SPD: 'spd',
  CRIT_RATE: 'critRate',
  CRIT_DMG: 'critDmg',
  EFFECT_HIT: 'effectHit',
  EFFECT_RES: 'effectRes',
};

function cloneZeroStats(): BaseStats {
  return { ...ZERO_STATS };
}

function addInto(target: BaseStats, source: Partial<BaseStats>) {
  COMBAT_STAT_KEYS.forEach((key) => {
    target[key] += source[key] ?? 0;
  });
}

function normalizeOptionType(type: string): string {
  const upper = type.toUpperCase();
  if (upper.endsWith('_FLAT')) {
    const base = upper.replace('_FLAT', '');
    return `${OPTION_ALIASES[base] ?? base}_FLAT`;
  }
  if (upper.endsWith('%')) {
    const base = upper.replace('%', '');
    return `${OPTION_ALIASES[base] ?? base}%`;
  }
  return OPTION_ALIASES[upper] ?? upper;
}

function roundStats(stats: BaseStats): BaseStats {
  return {
    hp: Math.max(1, Math.round(stats.hp)),
    atk: Math.max(1, Math.round(stats.atk)),
    def: Math.max(0, Math.round(stats.def)),
    spd: Math.max(1, Math.round(stats.spd)),
    critRate: Math.max(0, Number(stats.critRate.toFixed(1))),
    critDmg: Math.max(0, Number(stats.critDmg.toFixed(1))),
    effectHit: Math.max(0, Number(stats.effectHit.toFixed(1))),
    effectRes: Math.max(0, Number(stats.effectRes.toFixed(1))),
  };
}

function addElementBoost(
  boosts: Partial<Record<ElementType, number>>,
  element: ElementType,
  value: number,
) {
  if (element === 'NONE') return;
  boosts[element] = Number(((boosts[element] ?? 0) + value).toFixed(1));
}

export function getCanonicalOptionType(type: string): string {
  return normalizeOptionType(type);
}

export function formatStatValue(key: keyof BaseStats, value: number): string {
  return STAT_VIEW_META[key].percent ? `${value.toFixed(1)}%` : Math.round(value).toLocaleString();
}

export function formatOptionValue(type: string, value: number): string {
  const normalized = normalizeOptionType(type);
  const isFlat = normalized.endsWith('_FLAT');
  if (isFlat) return Math.round(value).toLocaleString();
  return `${value.toFixed(1)}%`;
}

export function getOptionLabel(type: string): string {
  const normalized = normalizeOptionType(type);
  if (normalized.endsWith('_DMG_BOOST')) {
    const element = normalized.replace('_DMG_BOOST', '');
    if (element === 'VOID' || element === 'ALL') return '全属性';
    return `${ELEMENT_VIEW_META[element as Exclude<ElementType, 'NONE'>]?.labelJa ?? element}属性`;
  }
  if (normalized.endsWith('_FLAT')) {
    const key = STAT_OPTION_TO_KEY[normalized.replace('_FLAT', '')];
    return key ? STAT_VIEW_META[key].label : normalized;
  }
  if (normalized.endsWith('%')) {
    const key = STAT_OPTION_TO_KEY[normalized.replace('%', '')];
    return key ? STAT_VIEW_META[key].label : normalized;
  }
  const key = STAT_OPTION_TO_KEY[normalized];
  return key ? STAT_VIEW_META[key].label : normalized;
}

function applyOption(
  stats: BaseStats,
  elementBoosts: Partial<Record<ElementType, number>>,
  option: SubOption,
  baseStats: BaseStats,
) {
  const normalized = normalizeOptionType(option.type);
  const value = option.value ?? 0;

  if (normalized.endsWith('_DMG_BOOST')) {
    const element = normalized.replace('_DMG_BOOST', '');
    if (element === 'VOID' || element === 'ALL') {
      ELEMENT_DAMAGE_KEYS.forEach((key) => addElementBoost(elementBoosts, key, value));
      return;
    }
    if (ELEMENT_DAMAGE_KEYS.includes(element as Exclude<ElementType, 'NONE'>)) {
      addElementBoost(elementBoosts, element as Exclude<ElementType, 'NONE'>, value);
    }
    return;
  }

  if (normalized.endsWith('_FLAT')) {
    const key = STAT_OPTION_TO_KEY[normalized.replace('_FLAT', '')];
    if (key) stats[key] += value;
    return;
  }

  if (normalized.endsWith('%')) {
    const key = STAT_OPTION_TO_KEY[normalized.replace('%', '')];
    if (key) stats[key] += (baseStats[key] * value) / 100;
    return;
  }

  const key = STAT_OPTION_TO_KEY[normalized];
  if (key) stats[key] += value;
}

export function passiveBonusesToStats(passives: PassiveBonuses): BaseStats {
  return {
    hp: passives.passiveHpBonus ?? 0,
    atk: passives.passiveAtkBonus ?? 0,
    def: passives.passiveDefBonus ?? 0,
    spd: passives.passiveSpdBonus ?? 0,
    critRate: passives.passiveCritRateBonus ?? 0,
    critDmg: passives.passiveCritDmgBonus ?? 0,
    effectHit: 0,
    effectRes: 0,
  };
}

export function calculateEquipmentContribution(
  equipment: EquipmentSlots,
  baseStats: BaseStats,
): { stats: BaseStats; elementDmgBoosts: Partial<Record<ElementType, number>> } {
  const stats = cloneZeroStats();
  const elementDmgBoosts: Partial<Record<ElementType, number>> = {};

  Object.values(equipment).forEach((item: ItemData | null) => {
    if (!item) return;
    addInto(stats, isWeaponSystemItem(item) ? getWeaponEffectiveStats(item) : (item.stats ?? {}));
    const options = isWeaponSystemItem(item) ? getWeaponEffectiveSubOptions(item) : (item.subOptions ?? []);
    options.forEach((option) => applyOption(stats, elementDmgBoosts, option, baseStats));
  });

  return { stats: roundStatsForBonus(stats), elementDmgBoosts };
}

export function calculateResidueContribution(
  residues: (AbyssalResidueData | null)[],
  baseStats: BaseStats,
): { stats: BaseStats; elementDmgBoosts: Partial<Record<ElementType, number>> } {
  const stats = cloneZeroStats();
  const elementDmgBoosts: Partial<Record<ElementType, number>> = {};

  residues.forEach((residue) => {
    if (!residue) return;
    applyOption(stats, elementDmgBoosts, residue.mainStat, baseStats);
    residue.subOptions.forEach((option) => applyOption(stats, elementDmgBoosts, option, baseStats));
  });

  return { stats: roundStatsForBonus(stats), elementDmgBoosts };
}

function roundStatsForBonus(stats: BaseStats): BaseStats {
  return {
    hp: Math.round(stats.hp),
    atk: Math.round(stats.atk),
    def: Math.round(stats.def),
    spd: Math.round(stats.spd),
    critRate: Number(stats.critRate.toFixed(1)),
    critDmg: Number(stats.critDmg.toFixed(1)),
    effectHit: Number(stats.effectHit.toFixed(1)),
    effectRes: Number(stats.effectRes.toFixed(1)),
  };
}

export function mergeElementDmgBoosts(
  ...boostSets: Array<Partial<Record<ElementType, number>> | undefined>
): Partial<Record<ElementType, number>> {
  const merged: Partial<Record<ElementType, number>> = {};
  boostSets.forEach((boosts) => {
    if (!boosts) return;
    ELEMENT_DAMAGE_KEYS.forEach((element) => {
      const value = boosts[element] ?? 0;
      if (value !== 0) addElementBoost(merged, element, value);
    });
  });
  return merged;
}

export function hasElementDmgBoosts(boosts: Partial<Record<ElementType, number>> | undefined): boolean {
  return !!boosts && ELEMENT_DAMAGE_KEYS.some((element) => (boosts[element] ?? 0) !== 0);
}

export function calculateCharacterStatProfile(
  character: CharacterData,
  residues: (AbyssalResidueData | null)[] = [],
): StatBreakdown {
  const job = { ...character.stats };
  const passives = passiveBonusesToStats(character.passives);
  const equipment = calculateEquipmentContribution(character.equipment, job);
  const residue = calculateResidueContribution(residues, job);

  const total = cloneZeroStats();
  addInto(total, job);
  addInto(total, passives);
  addInto(total, equipment.stats);
  addInto(total, residue.stats);

  return {
    job: roundStats(job),
    passives: roundStatsForBonus(passives),
    equipment: equipment.stats,
    residues: residue.stats,
    total: roundStats(total),
    elementDmgBoosts: mergeElementDmgBoosts(equipment.elementDmgBoosts, residue.elementDmgBoosts),
  };
}
