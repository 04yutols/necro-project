import type { CharacterData, MonsterData, WeaponPassive } from '../types/game';

export interface WeaponPassiveContext {
  trigger:
    | 'ON_ATTACK'
    | 'ON_CRIT'
    | 'ON_SHIELD_BREAK'
    | 'ON_DEMON_ACTIVATE'
    | 'PASSIVE';
  actor: CharacterData;
  target?: MonsterData;
  isCritical?: boolean;
  didBreakShield?: boolean;
  isDemonMode?: boolean;
  currentGauge?: number;
}

export interface WeaponPassiveResult {
  bonusDamage?: number;
  demonGaugeDelta?: number;
  avReduction?: number;
  logDesc?: string;
}

function getWeaponRank(ctx: WeaponPassiveContext): number {
  const rank = ctx.actor.equipment?.weapon?.rank ?? 0;
  if (!Number.isFinite(rank)) return 0;
  return Math.max(0, Math.floor(rank));
}

function getRankedPassiveValue(passive: WeaponPassive, rank: number, fallback: number): number {
  const values = passive.values.filter((value) => Number.isFinite(value));
  if (values.length === 0) return fallback;
  const index = Math.min(Math.max(rank, 1) - 1, values.length - 1);
  return values[index] ?? fallback;
}

function evalSoulShatter(passive: WeaponPassive, ctx: WeaponPassiveContext): WeaponPassiveResult | null {
  if (ctx.trigger !== 'ON_SHIELD_BREAK' || !ctx.didBreakShield) return null;

  const rank = getWeaponRank(ctx);
  const rate = getRankedPassiveValue(passive, rank, 0.3);

  const bonusDamage = Math.floor(ctx.actor.stats.atk * rate);
  return {
    bonusDamage,
    logDesc: `【霊魂砕き追撃】${passive.nameJa}が発動！ 追加 ${bonusDamage} ダメージ。`,
  };
}

function evalActionValue(passive: WeaponPassive, ctx: WeaponPassiveContext): WeaponPassiveResult | null {
  if (!ctx.isCritical && ctx.trigger !== 'ON_CRIT') return null;

  const rank = getWeaponRank(ctx);
  const avRed = Math.floor(getRankedPassiveValue(passive, rank, 1));
  if (avRed <= 0) return null;

  return {
    avReduction: avRed,
    logDesc: `【行動加速】${passive.nameJa}が発動！ 次の行動が ${avRed} ターン早まる。`,
  };
}

function evalDemonMode(passive: WeaponPassive, ctx: WeaponPassiveContext): WeaponPassiveResult | null {
  if (ctx.trigger !== 'ON_ATTACK') return null;

  const rank = getWeaponRank(ctx);
  const gaugeDelta = Math.floor(getRankedPassiveValue(passive, rank, 5));

  if (passive.condition === 'DEMON_ACTIVE') {
    if (!ctx.isDemonMode) return null;
    const dmgBonus = Math.floor(ctx.actor.stats.atk * (gaugeDelta / 100));
    return {
      bonusDamage: dmgBonus,
      logDesc: `【魔神昂揚】${passive.nameJa}が発動！ 追加 ${dmgBonus} ダメージ。`,
    };
  }

  return {
    demonGaugeDelta: gaugeDelta,
    logDesc: `【魂の高揚】${passive.nameJa}が発動！ 魔神化ゲージ +${gaugeDelta}。`,
  };
}

export function evaluateWeaponPassive(
  passive: WeaponPassive | undefined,
  ctx: WeaponPassiveContext,
): WeaponPassiveResult | null {
  if (!passive) return null;

  switch (passive.systemTag) {
    case 'SOUL_SHATTER':  return evalSoulShatter(passive, ctx);
    case 'ACTION_VALUE':  return evalActionValue(passive, ctx);
    case 'DEMON_MODE':    return evalDemonMode(passive, ctx);
    case 'SHIELD_PIERCE': return null;  // 第2章以降
    case 'GIANT_KILLING': return null;  // 第2章以降
    default:              return null;
  }
}
