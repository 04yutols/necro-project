import type { BossGimmick } from '../types/game';
import {
  bossGimmickKey,
  findReviveGimmick,
  getReviveHp,
  resolveSummonMinionIds,
  shouldTriggerBossGimmick,
} from './BossGimmickSystem';

describe('BossGimmickSystem', () => {
  const revive: BossGimmick = { trigger: 'HP_BELOW_50', effect: 'REVIVE', value: 1 };

  test('does not trigger REVIVE when HP merely crosses 50%', () => {
    expect(shouldTriggerBossGimmick(revive, {
      prevHpPct: 80,
      newHpPct: 40,
      turn: 1,
      shieldBroken: false,
    })).toBe(false);
  });

  test('finds REVIVE only once per boss gimmick key', () => {
    const fired = new Set<string>();

    expect(findReviveGimmick([revive], 'boss-1', fired)).toBe(revive);
    fired.add(bossGimmickKey('boss-1', revive));
    expect(findReviveGimmick([revive], 'boss-1', fired)).toBeUndefined();
  });

  test('restores 50% HP for legacy value=1 revive data', () => {
    expect(getReviveHp(1120, revive)).toBe(560);
    expect(getReviveHp(1120, { ...revive, value: 0.35 })).toBe(392);
  });

  test('triggers summon minions on shield break and resolves boss-specific pool', () => {
    const summon: BossGimmick = { trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 2 };

    expect(shouldTriggerBossGimmick(summon, {
      prevHpPct: 100,
      newHpPct: 80,
      turn: 1,
      shieldBroken: true,
    })).toBe(true);
    expect(resolveSummonMinionIds('blood_mire_queen', 2, 2)).toEqual(['bloodmire_leech', 'rot_hound']);
    expect(resolveSummonMinionIds('blood_mire_queen', 2, 1)).toEqual(['bloodmire_leech']);
  });
});
