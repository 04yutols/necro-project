import { calculateBattleDamage } from './BattleDamage';
import type { BaseStats } from '../types/game';

const attacker: BaseStats = {
  hp: 1000,
  atk: 100,
  def: 50,
  spd: 100,
  critRate: 0,
  critDmg: 150,
  effectHit: 0,
  effectRes: 0,
};

const defender: BaseStats = {
  hp: 500,
  atk: 50,
  def: 100,
  spd: 80,
  critRate: 0,
  critDmg: 150,
  effectHit: 0,
  effectRes: 0,
};

describe('calculateBattleDamage', () => {
  test('uses the shared HSR-style ATK x power x DEF formula without crit', () => {
    const result = calculateBattleDamage({
      attackerStats: attacker,
      defenderStats: defender,
      powerMultiplier: 1.5,
      rng: () => 0.99,
    });

    // 100 x 1.5 x (1 - 100 / 300) = 100
    expect(result.damage).toBe(100);
    expect(result.isCritical).toBe(false);
  });

  test('treats critDmg as additive bonus damage, so 100% crit damage doubles the hit', () => {
    const normalHit = calculateBattleDamage({
      attackerStats: { ...attacker, atk: 1000, critRate: 0, critDmg: 100 },
      defenderStats: { ...defender, def: 0 },
      powerMultiplier: 1,
      rng: () => 0.99,
    });
    const critHit = calculateBattleDamage({
      attackerStats: { ...attacker, atk: 1000, critRate: 100, critDmg: 100 },
      defenderStats: { ...defender, def: 0 },
      powerMultiplier: 1,
      rng: () => 0,
    });

    expect(normalHit.damage).toBe(1000);
    expect(critHit.damage).toBe(2000);
    expect(critHit.isCritical).toBe(true);
  });

  describe('defenseReducePct (ORC synergy)', () => {
    const baseInput = {
      attackerStats: attacker,
      defenderStats: defender, // DEF = 100
      powerMultiplier: 1.0,
      rng: () => 0.99, // no crit
    } as const;

    test('0% reduction matches baseline (no synergy)', () => {
      // effectiveDef=100, defMult=1-100/300=0.6667, damage=66
      const result = calculateBattleDamage({ ...baseInput, synergyBonus: { defenseReducePct: 0 } });
      expect(result.damage).toBe(66);
    });

    test('15% reduction (ORC×2 partial)', () => {
      // effectiveDef=85, defMult=1-85/285≈0.7018, damage=70
      const result = calculateBattleDamage({ ...baseInput, synergyBonus: { defenseReducePct: 15 } });
      expect(result.damage).toBe(70);
    });

    test('25% reduction (ORC×3 full)', () => {
      // effectiveDef=75, defMult=1-75/275≈0.7273, damage=72
      const result = calculateBattleDamage({ ...baseInput, synergyBonus: { defenseReducePct: 25 } });
      expect(result.damage).toBe(72);
    });

    test('35% reduction (ORC×3 full + UNDEAD cross-resonance)', () => {
      // effectiveDef=65, defMult=1-65/265≈0.7547, damage=75
      const result = calculateBattleDamage({ ...baseInput, synergyBonus: { defenseReducePct: 35 } });
      expect(result.damage).toBe(75);
    });

    test('100% reduction eliminates DEF entirely', () => {
      // effectiveDef=0, defMult=1.0, damage=100
      const result = calculateBattleDamage({ ...baseInput, synergyBonus: { defenseReducePct: 100 } });
      expect(result.damage).toBe(100);
    });

    test('over-100% is clamped to 100%', () => {
      const result = calculateBattleDamage({ ...baseInput, synergyBonus: { defenseReducePct: 150 } });
      expect(result.damage).toBe(100);
    });

    test('DEF=0 enemy is unaffected by reduction', () => {
      // effectiveDef=0 regardless; defMult=1.0
      const zeroDef = { ...defender, def: 0 };
      const withReduce = calculateBattleDamage({ ...baseInput, defenderStats: zeroDef, synergyBonus: { defenseReducePct: 35 } });
      const withoutReduce = calculateBattleDamage({ ...baseInput, defenderStats: zeroDef });
      expect(withReduce.damage).toBe(withoutReduce.damage);
      expect(withReduce.damage).toBe(100);
    });
  });

  test('applies element boosts, tribe synergy, weakness, and crit in one path', () => {
    const result = calculateBattleDamage({
      attackerStats: { ...attacker, critRate: 100, critDmg: 200 },
      attackerElementBoosts: { FIRE: 25 },
      defenderStats: { ...defender, def: 0 },
      defenderResistances: { FIRE: -20 },
      powerMultiplier: 1,
      element: 'FIRE',
      synergyBonus: { elementDmgBonus: 10, fireDarkDmgBonus: 20 },
      rng: () => 0,
    });

    // 100 x (1 + 0.25 + 0.10 + 0.20) x 1.2 x (1 + 2.0) = 558
    expect(result.damage).toBe(558);
    expect(result.isCritical).toBe(true);
    expect(result.isWeakness).toBe(true);
    expect(result.isResisted).toBe(false);
  });
});
