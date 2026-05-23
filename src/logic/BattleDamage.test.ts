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

    // 100 x (1 + 0.25 + 0.10 + 0.20) x 1.2 x 2.0 = 372
    expect(result.damage).toBe(372);
    expect(result.isCritical).toBe(true);
    expect(result.isWeakness).toBe(true);
    expect(result.isResisted).toBe(false);
  });
});
