import type { AbyssalResidueData } from '../types/game';
import { getCanonicalOptionType } from './StatSystem';

export const RESIDUE_SLOT_ORDER = ['head', 'arms', 'chest', 'waist', 'legs'] as const;

export type ResidueSlotId = typeof RESIDUE_SLOT_ORDER[number];

export interface ResidueSlotMeta {
  id: ResidueSlotId;
  nameJa: string;
  nameEn: string;
  role: string;
  icon: string;
  cost: number;
}

export const RESIDUE_SLOT_META: Record<ResidueSlotId, ResidueSlotMeta> = {
  head: {
    id: 'head',
    nameJa: '思念の兜',
    nameEn: 'MIND CROWN',
    role: 'HP固定',
    icon: '冠',
    cost: 600,
  },
  arms: {
    id: 'arms',
    nameJa: '剛力の籠手',
    nameEn: 'FORCE GAUNTLET',
    role: 'ATK固定',
    icon: '腕',
    cost: 600,
  },
  chest: {
    id: 'chest',
    nameJa: '骸の胸当て',
    nameEn: 'BONE CHEST',
    role: '汎用',
    icon: '胸',
    cost: 800,
  },
  waist: {
    id: 'waist',
    nameJa: '深淵の帯',
    nameEn: 'ABYSS GIRDLE',
    role: '属性特化',
    icon: '帯',
    cost: 2500,
  },
  legs: {
    id: 'legs',
    nameJa: '霊獣の具足',
    nameEn: 'WRAITH GREAVES',
    role: '会心特化',
    icon: '脚',
    cost: 1000,
  },
};

export interface ResidueScoreGrade {
  grade: 'C' | 'B' | 'A' | 'S' | 'SS';
  label: string;
  color: string;
}

const SCORE_GRADE_TABLE: Array<{ min: number; grade: ResidueScoreGrade }> = [
  { min: 65, grade: { grade: 'SS', label: '神器', color: '#ffcf5a' } },
  { min: 50, grade: { grade: 'S', label: '稀少', color: '#ff8cff' } },
  { min: 35, grade: { grade: 'A', label: '優品', color: '#8bb7ff' } },
  { min: 20, grade: { grade: 'B', label: '良品', color: '#8dffbf' } },
  { min: 0, grade: { grade: 'C', label: '普通', color: '#9aa4b4' } },
];

function scoreOption(type: string, value: number): number {
  const normalized = getCanonicalOptionType(type);
  switch (normalized) {
    case 'CRIT_RATE':
    case 'CRIT_RATE%':
      return value * 2;
    case 'CRIT_DMG':
    case 'CRIT_DMG%':
      return value;
    case 'ATK%':
      return value * 1.5;
    case 'HP%':
      return value;
    default:
      return 0;
  }
}

export function calculateResidueScore(residue: AbyssalResidueData): number {
  const main = scoreOption(residue.mainStat.type, residue.mainStat.value);
  const subs = residue.subOptions.reduce((sum, option) => sum + scoreOption(option.type, option.value), 0);
  return Number((main + subs).toFixed(1));
}

export function getResidueScoreGrade(score: number): ResidueScoreGrade {
  return SCORE_GRADE_TABLE.find((row) => score >= row.min)?.grade ?? SCORE_GRADE_TABLE[SCORE_GRADE_TABLE.length - 1].grade;
}

export function getResidueSlotMeta(slotId: string | null | undefined): ResidueSlotMeta {
  if (slotId && RESIDUE_SLOT_ORDER.includes(slotId as ResidueSlotId)) {
    return RESIDUE_SLOT_META[slotId as ResidueSlotId];
  }
  return RESIDUE_SLOT_META.chest;
}

export function getResidueSlotId(residue: Pick<AbyssalResidueData, 'itemId'>): ResidueSlotId {
  if (RESIDUE_SLOT_ORDER.includes(residue.itemId as ResidueSlotId)) {
    return residue.itemId as ResidueSlotId;
  }
  return 'chest';
}

export function isResidueSlotCompatible(residue: AbyssalResidueData, slotIndex: number): boolean {
  return getResidueSlotId(residue) === RESIDUE_SLOT_ORDER[slotIndex];
}
