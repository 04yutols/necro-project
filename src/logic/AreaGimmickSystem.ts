import type { AilmentType, AreaGimmickType, StageData, StatusEffect } from '../types/game';
import { applyPlayerDamage } from './PlayerDefeat';
import { applyStatusEffect } from './StatusAilmentSystem';

export const AREA_GIMMICK_META: Record<AreaGimmickType, {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  soft: string;
}> = {
  NONE: {
    label: 'エリア効果なし',
    shortLabel: 'NONE',
    description: 'この戦場に特殊なエリア効果はない。',
    color: '#8b7da8',
    soft: 'rgba(139,125,168,0.12)',
  },
  SLIP_DAMAGE: {
    label: '灼熱瘴気',
    shortLabel: 'SLIP',
    description: '手番開始時、現在HPの5%のスリップダメージを受ける。',
    color: '#fb7185',
    soft: 'rgba(251,113,133,0.18)',
  },
  STATUS_AILMENT: {
    label: '瘴気の沼',
    shortLabel: 'MIASMA',
    description: '手番開始時、確定で毒を付与する。魔神化中は無効化する。',
    color: '#a855f7',
    soft: 'rgba(168,85,247,0.20)',
  },
};

export interface AreaGimmickApplyInput {
  areaGimmick?: AreaGimmickType;
  currentHp: number;
  maxHp: number;
  statusEffects?: StatusEffect[];
  isDemonMode?: boolean;
  defenseReducePct?: number;
}

export interface AreaGimmickApplyResult {
  areaGimmick: AreaGimmickType;
  triggered: boolean;
  damage: number;
  nextHp: number;
  statusEffects: StatusEffect[];
  appliedAilment?: AilmentType;
  immune: boolean;
}

export function resolveStageAreaGimmick(stage?: Pick<StageData, 'areaGimmick'> | null): AreaGimmickType {
  return stage?.areaGimmick ?? 'NONE';
}

export function getAreaGimmickMeta(areaGimmick?: AreaGimmickType) {
  return AREA_GIMMICK_META[areaGimmick ?? 'NONE'];
}

export function applyAreaGimmickToPlayer(input: AreaGimmickApplyInput): AreaGimmickApplyResult {
  const areaGimmick = input.areaGimmick ?? 'NONE';
  const statusEffects = input.statusEffects ?? [];

  if (areaGimmick === 'SLIP_DAMAGE') {
    const rawDamage = Math.floor(Math.max(0, input.currentHp) * 0.05);
    const defenseReduce = Math.max(0, Math.min(100, input.defenseReducePct ?? 0));
    const damage = Math.floor(rawDamage * (1 - defenseReduce / 100));
    return {
      areaGimmick,
      triggered: true,
      damage,
      nextHp: applyPlayerDamage(input.currentHp, damage),
      statusEffects,
      immune: false,
    };
  }

  if (areaGimmick === 'STATUS_AILMENT') {
    if (input.isDemonMode) {
      return {
        areaGimmick,
        triggered: true,
        damage: 0,
        nextHp: input.currentHp,
        statusEffects,
        immune: true,
      };
    }

    return {
      areaGimmick,
      triggered: true,
      damage: 0,
      nextHp: input.currentHp,
      statusEffects: applyStatusEffect(statusEffects, 'POISON', 0),
      appliedAilment: 'POISON',
      immune: false,
    };
  }

  return {
    areaGimmick: 'NONE',
    triggered: false,
    damage: 0,
    nextHp: input.currentHp,
    statusEffects,
    immune: false,
  };
}
