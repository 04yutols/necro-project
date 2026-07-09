import type { BossGimmick } from '../types/game';
import { calcAVDelay } from './StatusAilmentSystem';

export interface BossGimmickTriggerContext {
  prevHpPct: number;
  newHpPct: number;
  turn: number;
  shieldBroken?: boolean;
}

const DEFAULT_REVIVE_HP_RATIO = 0.5;
const DEFAULT_SUMMON_COUNT = 2;
export const DEFAULT_ENRAGE_MULTIPLIER = 1.5;
export const DEFAULT_BOSS_AV_DELAY = 40;
const SUMMON_POOLS: Record<string, string[]> = {
  blood_mire_queen: ['bloodmire_leech', 'rot_hound'],
  ossuary_wyrm_lord: ['grave_soldier', 'earthbound_grudge'],
  default: ['grave_soldier', 'rot_hound', 'hollow_handmaid'],
};

export function bossGimmickKey(bossId: string | number, gimmick: BossGimmick): string {
  return `${bossId}:${gimmick.trigger}:${gimmick.effect}`;
}

export function shouldTriggerBossGimmick(
  gimmick: BossGimmick,
  context: BossGimmickTriggerContext,
): boolean {
  switch (gimmick.trigger) {
    case 'HP_BELOW_50':
      // REVIVE is an HP0 transition. The HP_BELOW_50 trigger is retained in
      // master data as a compatibility marker, but it must not fire at 50%.
      if (gimmick.effect === 'REVIVE') return false;
      return context.prevHpPct > 50 && context.newHpPct <= 50;
    case 'TURN_3':
      return context.turn === 3;
    case 'ON_SHIELD_BREAK':
      return context.shieldBroken === true;
    case 'ON_REVIVE':
      return false;
    default:
      return false;
  }
}

export function findReviveGimmick(
  gimmicks: BossGimmick[] | undefined,
  bossId: string | number,
  firedGimmicks: Set<string>,
): BossGimmick | undefined {
  return gimmicks?.find((gimmick) =>
    gimmick.effect === 'REVIVE'
    && !firedGimmicks.has(bossGimmickKey(bossId, gimmick))
  );
}

export function getReviveHp(maxHp: number, gimmick: BossGimmick): number {
  const configured = gimmick.value;
  const ratio = configured && configured > 0 && configured < 1
    ? configured
    : DEFAULT_REVIVE_HP_RATIO;
  return Math.max(1, Math.floor(maxHp * ratio));
}

export function getEnrageMultiplier(gimmick: BossGimmick | undefined): number {
  const value = gimmick?.value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_ENRAGE_MULTIPLIER;
  }
  return value;
}

export function resolveSummonMinionIds(
  bossSourceId: string | undefined,
  rawCount: number | undefined,
  availableSlots = Number.POSITIVE_INFINITY,
): string[] {
  const pool = SUMMON_POOLS[bossSourceId ?? ''] ?? SUMMON_POOLS.default;
  const count = Math.max(0, Math.min(
    pool.length,
    availableSlots,
    Number.isFinite(rawCount ?? Number.NaN) ? Math.max(0, Math.floor(rawCount ?? 0)) : DEFAULT_SUMMON_COUNT,
  ));

  if (count === 0) return [];
  return pool.slice(0, count);
}

export function getBossAvDelayBase(gimmick: BossGimmick): number {
  const value = gimmick.value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_BOSS_AV_DELAY;
  }
  return Math.floor(value);
}

export function calculateBossAvDelay(gimmick: BossGimmick, targetEffectRes: number): number {
  return calcAVDelay(getBossAvDelayBase(gimmick), targetEffectRes);
}
