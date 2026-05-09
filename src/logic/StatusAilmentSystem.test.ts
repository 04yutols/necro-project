import {
  applyStatusEffect,
  calcAVDelay,
  calcDebuffChance,
  clearStatusEffectsByDemonize,
  getAilmentAttackMultiplier,
  inferAilmentForAction,
  processStatusEffects,
  tryApplyAilment,
} from './StatusAilmentSystem';

describe('StatusAilmentSystem', () => {
  test('calculates debuff chance with effectHit and effectRes clamps', () => {
    expect(calcDebuffChance(0.3, 20, 30)).toBeCloseTo(0.252);
    expect(calcDebuffChance(0.35, 40, 0)).toBeCloseTo(0.49);
    expect(calcDebuffChance(0.35, 0, 100)).toBe(0);
    expect(calcDebuffChance(0.9, 80, -20)).toBe(1);
  });

  test('applies and stacks bleed up to three independent stacks', () => {
    let effects = applyStatusEffect([], 'BLEED', 100);
    effects = applyStatusEffect(effects, 'BLEED', 120);
    effects = applyStatusEffect(effects, 'BLEED', 140);
    effects = applyStatusEffect(effects, 'BLEED', 160);

    expect(effects[0].type).toBe('BLEED');
    expect(effects[0].stackCount).toBe(3);
    expect(effects[0].stacks).toHaveLength(3);

    const processed = processStatusEffects(effects, { maxHp: 1000 }, () => 1);
    expect(processed.totalDamage).toBe(21);
    expect(processed.effects[0].stackCount).toBe(3);
    expect(processed.ticks.some(tick => tick.type === 'BLEED' && tick.damage === 21)).toBe(true);
  });

  test('processes poison, burn, freeze, paralysis, and weaken', () => {
    const effects = [
      ...applyStatusEffect([], 'POISON', 0),
      ...applyStatusEffect([], 'BURN', 0),
      ...applyStatusEffect([], 'FREEZE', 0),
      ...applyStatusEffect([], 'PARALYSIS', 0),
      ...applyStatusEffect([], 'WEAKEN', 100),
    ];

    const processed = processStatusEffects(effects, { maxHp: 1000 }, () => 0.25);
    expect(processed.totalDamage).toBe(80);
    expect(processed.skipAction).toBe(true);
    expect(getAilmentAttackMultiplier(processed.effects)).toBe(0.7);
    expect(getAilmentAttackMultiplier(processed.effects, true)).toBe(1);
  });

  test('tryApplyAilment respects immunity and deterministic rolls', () => {
    const immune = tryApplyAilment(
      'POISON',
      { atk: 100, effectHit: 100 },
      { effectRes: 0 },
      [],
      { immune: true, rng: () => 0 },
    );
    expect(immune.applied).toBe(false);
    expect(immune.immune).toBe(true);

    const applied = tryApplyAilment(
      'BURN',
      { atk: 100, effectHit: 0 },
      { effectRes: 0 },
      [],
      { rng: () => 0.1 },
    );
    expect(applied.applied).toBe(true);
    expect(applied.effects[0].type).toBe('BURN');
  });

  test('infers ailments and clears all statuses on demonize', () => {
    expect(inferAilmentForAction('FIRE', 'MAGIC')).toBe('BURN');
    expect(inferAilmentForAction('THUNDER', 'SLASH')).toBe('PARALYSIS');
    expect(inferAilmentForAction('DARK', 'SUMMON')).toBe('WEAKEN');
    expect(inferAilmentForAction('NONE', 'SLASH')).toBe('BLEED');

    const before = applyStatusEffect([], 'POISON', 0);
    const after = clearStatusEffectsByDemonize(before);
    expect(after.cleared).toHaveLength(1);
    expect(after.effects).toHaveLength(0);
  });

  test('calculates AV delay reduced by effectRes', () => {
    expect(calcAVDelay(40, 0)).toBe(40);
    expect(calcAVDelay(40, 5)).toBe(38);
    expect(calcAVDelay(40, 50)).toBe(20);
    expect(calcAVDelay(40, 100)).toBe(0);
  });
});
