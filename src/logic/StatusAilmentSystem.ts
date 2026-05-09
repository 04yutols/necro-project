import type { AilmentType, BaseStats, ElementType, SkillAttackType, SkillData, StatusEffect } from '../types/game';

export const BASE_DEBUFF_RATES: Record<AilmentType, number> = {
  BLEED: 0.35,
  POISON: 0.30,
  BURN: 0.25,
  FREEZE: 0.20,
  PARALYSIS: 0.25,
  WEAKEN: 0.30,
};

export const DEFAULT_AILMENT_DURATIONS: Record<AilmentType, number> = {
  BLEED: 3,
  POISON: 3,
  BURN: 2,
  FREEZE: 1,
  PARALYSIS: 2,
  WEAKEN: 2,
};

export const AILMENT_UI: Record<AilmentType, { label: string; icon: string; color: string; soft: string }> = {
  BLEED: { label: '出血', icon: '滴', color: '#FF2244', soft: 'rgba(255,34,68,0.20)' },
  POISON: { label: '毒', icon: '毒', color: '#9900FF', soft: 'rgba(153,0,255,0.20)' },
  BURN: { label: '燃焼', icon: '炎', color: '#FF6600', soft: 'rgba(255,102,0,0.20)' },
  FREEZE: { label: '凍結', icon: '凍', color: '#00CCFF', soft: 'rgba(0,204,255,0.18)' },
  PARALYSIS: { label: '麻痺', icon: '雷', color: '#FFEE00', soft: 'rgba(255,238,0,0.18)' },
  WEAKEN: { label: '衰弱', icon: '弱', color: '#888888', soft: 'rgba(136,136,136,0.20)' },
};

export interface AilmentApplyResult {
  effects: StatusEffect[];
  applied: boolean;
  chance: number;
  resisted: boolean;
  immune: boolean;
}

export interface StatusTick {
  type: AilmentType;
  damage?: number;
  skipped?: boolean;
  expired?: boolean;
}

export interface StatusProcessResult {
  effects: StatusEffect[];
  ticks: StatusTick[];
  totalDamage: number;
  skipAction: boolean;
}

export function calcDebuffChance(
  baseRate: number,
  attackerEffectHit: number,
  targetEffectRes: number,
): number {
  const raw = baseRate * (1 + attackerEffectHit / 100) * (1 - targetEffectRes / 100);
  return Math.max(0, Math.min(1, raw));
}

export function calcAVDelay(baseAVDelay: number, targetEffectRes: number): number {
  return Math.max(0, Math.floor(baseAVDelay * (1 - Math.max(0, targetEffectRes) / 100)));
}

export function inferAilmentForAction(
  element: ElementType = 'NONE',
  attackType: SkillAttackType = 'SLASH',
  skillType?: SkillData['type'],
): AilmentType | null {
  if (element === 'FIRE') return 'BURN';
  if (element === 'ICE' || element === 'WATER') return 'FREEZE';
  if (element === 'THUNDER') return 'PARALYSIS';
  if (element === 'DARK' && attackType === 'SUMMON') return 'WEAKEN';
  if (element === 'DARK' && (attackType === 'MAGIC' || skillType === 'MAGICAL')) return 'POISON';
  if (attackType === 'SLASH' || attackType === 'STRIKE') return 'BLEED';
  return null;
}

export function getSkillAilment(skill: Pick<SkillData, 'ailmentType' | 'element' | 'attackType' | 'type'>): AilmentType | null {
  return skill.ailmentType ?? inferAilmentForAction(skill.element ?? 'NONE', skill.attackType ?? 'SLASH', skill.type);
}

export function applyStatusEffect(
  effects: StatusEffect[] | undefined,
  ailmentId: AilmentType,
  sourceAtk: number,
  duration = DEFAULT_AILMENT_DURATIONS[ailmentId],
): StatusEffect[] {
  const current = cloneEffects(effects);
  const existingIndex = current.findIndex(effect => effect.type === ailmentId);

  if (ailmentId === 'BLEED') {
    const stack = { remainingTurns: duration, sourceAtk };
    if (existingIndex < 0) {
      return [
        ...current,
        { type: 'BLEED', remainingTurns: duration, stackCount: 1, sourceAtk, stacks: [stack] },
      ];
    }
    const existing = current[existingIndex];
    const stacks = [...(existing.stacks ?? [{ remainingTurns: existing.remainingTurns, sourceAtk: existing.sourceAtk ?? sourceAtk }]), stack]
      .sort((a, b) => (b.sourceAtk ?? 0) - (a.sourceAtk ?? 0) || b.remainingTurns - a.remainingTurns)
      .slice(0, 3);
    current[existingIndex] = {
      ...existing,
      remainingTurns: Math.max(...stacks.map(s => s.remainingTurns)),
      stackCount: stacks.length,
      sourceAtk,
      stacks,
    };
    return current;
  }

  const nextEffect: StatusEffect = {
    type: ailmentId,
    remainingTurns: duration,
    stackCount: 1,
    sourceAtk: ailmentId === 'WEAKEN' ? sourceAtk : undefined,
  };
  if (existingIndex < 0) return [...current, nextEffect];
  current[existingIndex] = nextEffect;
  return current;
}

export function tryApplyAilment(
  ailmentId: AilmentType,
  attackerStats: Pick<BaseStats, 'atk' | 'effectHit'>,
  targetStats: Pick<BaseStats, 'effectRes'>,
  currentEffects: StatusEffect[] | undefined,
  options: {
    rng?: () => number;
    baseRate?: number;
    immune?: boolean;
    duration?: number;
  } = {},
): AilmentApplyResult {
  const baseRate = options.baseRate ?? BASE_DEBUFF_RATES[ailmentId];
  const chance = calcDebuffChance(baseRate, attackerStats.effectHit, targetStats.effectRes);
  if (options.immune) {
    return { effects: cloneEffects(currentEffects), applied: false, chance, resisted: false, immune: true };
  }
  const roll = options.rng?.() ?? Math.random();
  if (roll >= chance) {
    return { effects: cloneEffects(currentEffects), applied: false, chance, resisted: true, immune: false };
  }
  return {
    effects: applyStatusEffect(currentEffects, ailmentId, attackerStats.atk, options.duration),
    applied: true,
    chance,
    resisted: false,
    immune: false,
  };
}

export function processStatusEffects(
  effects: StatusEffect[] | undefined,
  target: { maxHp: number },
  rng: () => number = Math.random,
): StatusProcessResult {
  const ticks: StatusTick[] = [];
  let totalDamage = 0;
  let skipAction = false;
  const nextEffects: StatusEffect[] = [];

  for (const effect of cloneEffects(effects)) {
    if (effect.type === 'BLEED') {
      const stacks = (effect.stacks ?? [{ remainingTurns: effect.remainingTurns, sourceAtk: effect.sourceAtk ?? 0 }])
        .map(stack => ({ ...stack, remainingTurns: stack.remainingTurns - 1 }))
        .filter(stack => stack.remainingTurns > 0);
      const damage = Math.floor((effect.stacks ?? [{ remainingTurns: effect.remainingTurns, sourceAtk: effect.sourceAtk ?? 0 }])
        .reduce((sum, stack) => sum + (stack.sourceAtk ?? 0) * 0.05, 0));
      if (damage > 0) {
        totalDamage += damage;
        ticks.push({ type: 'BLEED', damage });
      }
      if (stacks.length > 0) {
        nextEffects.push({
          type: 'BLEED',
          remainingTurns: Math.max(...stacks.map(stack => stack.remainingTurns)),
          stackCount: stacks.length,
          sourceAtk: stacks[0].sourceAtk,
          stacks,
        });
      } else {
        ticks.push({ type: 'BLEED', expired: true });
      }
      continue;
    }

    let damage = 0;
    if (effect.type === 'POISON') damage = Math.floor(target.maxHp * 0.03);
    if (effect.type === 'BURN') damage = Math.floor(target.maxHp * 0.05);
    if (effect.type === 'FREEZE') {
      skipAction = true;
      ticks.push({ type: 'FREEZE', skipped: true });
    }
    if (effect.type === 'PARALYSIS') {
      const skipped = rng() < 0.5;
      skipAction = skipAction || skipped;
      ticks.push({ type: 'PARALYSIS', skipped });
    }
    if (damage > 0) {
      totalDamage += damage;
      ticks.push({ type: effect.type, damage });
    }

    const remainingTurns = effect.remainingTurns - 1;
    if (remainingTurns > 0) {
      nextEffects.push({ ...effect, remainingTurns });
    } else {
      ticks.push({ type: effect.type, expired: true });
    }
  }

  return { effects: nextEffects, ticks, totalDamage, skipAction };
}

export function getAilmentAttackMultiplier(effects: StatusEffect[] | undefined, isDemonized = false): number {
  if (isDemonized) return 1;
  return effects?.some(effect => effect.type === 'WEAKEN') ? 0.7 : 1;
}

export function clearStatusEffectsByDemonize(effects: StatusEffect[] | undefined): { effects: StatusEffect[]; cleared: StatusEffect[] } {
  return { effects: [], cleared: cloneEffects(effects) };
}

function cloneEffects(effects: StatusEffect[] | undefined): StatusEffect[] {
  return (effects ?? []).map(effect => ({
    ...effect,
    stacks: effect.stacks?.map(stack => ({ ...stack })),
  }));
}
