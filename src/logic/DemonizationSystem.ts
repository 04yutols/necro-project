import type { DemonFormData, DemonRiskType, SkillAttackType } from '../types/game';

export const DEMON_GAUGE_MAX = 100;
export const DEMON_ACTION_LIMIT = 3;

export interface DemonRuntimeState {
  isDemonMode: boolean;
  gauge: number;
  actionsRemaining: number;
  ultimateUsed: boolean;
  form: DemonFormData | null;
}

export function clampDemonGauge(value: number): number {
  return Math.min(DEMON_GAUGE_MAX, Math.max(0, Math.round(value)));
}

export function canActivateDemonMode(gauge: number, isDemonMode: boolean): boolean {
  return !isDemonMode && clampDemonGauge(gauge) >= DEMON_GAUGE_MAX;
}

export function activateDemonMode(form: DemonFormData | null, gauge: number): DemonRuntimeState {
  if (!form || !canActivateDemonMode(gauge, false)) {
    return {
      isDemonMode: false,
      gauge: clampDemonGauge(gauge),
      actionsRemaining: 0,
      ultimateUsed: false,
      form: null,
    };
  }

  return {
    isDemonMode: true,
    gauge: 0,
    actionsRemaining: DEMON_ACTION_LIMIT,
    ultimateUsed: false,
    form,
  };
}

export function consumeDemonAction(state: DemonRuntimeState): DemonRuntimeState {
  if (!state.isDemonMode || state.actionsRemaining <= 0) return state;
  const nextActions = Math.max(0, state.actionsRemaining - 1);
  return {
    ...state,
    isDemonMode: nextActions > 0,
    actionsRemaining: nextActions,
    form: nextActions > 0 ? state.form : null,
  };
}

export function markDemonUltimateUsed(state: DemonRuntimeState): DemonRuntimeState {
  if (!state.isDemonMode) return state;
  return { ...state, ultimateUsed: true };
}

export function getDemonDamageMultiplier(form: DemonFormData | null, attackType: SkillAttackType): number {
  if (!form) return 1;
  const attackBoost = form.effectA.statBoosts.atk ?? 0;
  const critBoost = form.effectA.statBoosts.critDmg ?? 0;
  const isMagic = attackType === 'MAGIC' || attackType === 'SUMMON';
  const magicBoost = isMagic && form.effectA.flags?.includes('MAGIC_OVERDRIVE') ? 0.35 : 0;
  return Math.max(1, 1 + attackBoost + critBoost * 0.35 + magicBoost);
}

export function getDemonActionHitCount(form: DemonFormData | null, attackType: SkillAttackType): number {
  if (!form) return 1;
  const effect = form.effectB.onAttackEffect;
  const isPhysical = attackType === 'SLASH' || attackType === 'STRIKE' || attackType === 'PROJECTILE';
  if (effect === 'TRIPLE_HIT' && isPhysical) return 3;
  if (effect === 'MIRAGE_CHAIN' && isPhysical) return 2;
  return 1;
}

export function getDemonIncomingDamageMultiplier(form: DemonFormData | null): number {
  if (!form || form.effectB.riskType !== 'GLASS_CANNON') return 1;
  return Math.max(1, form.effectB.riskValue ?? 2);
}

export function shouldIgnoreResistance(form: DemonFormData | null): boolean {
  return Boolean(form?.effectA.flags?.includes('IGNORE_RESISTANCE'));
}

export function shouldBypassDefense(form: DemonFormData | null): boolean {
  return Boolean(form?.ultimateSkill.damage.flags?.includes('IGNORE_DEF'));
}

export function getDemonRiskLabel(riskType: DemonRiskType): string {
  switch (riskType) {
    case 'SELF_DAMAGE':
      return '自傷';
    case 'ENERGY_DRAIN':
      return '過剰消費';
    case 'GLASS_CANNON':
      return '紙装甲';
    case 'SETUP_DEPENDENT':
      return '仕込み依存';
    default:
      return 'なし';
  }
}

export function isDemonStatusImmune(state: Pick<DemonRuntimeState, 'isDemonMode' | 'actionsRemaining'>): boolean {
  return state.isDemonMode && state.actionsRemaining > 0;
}
