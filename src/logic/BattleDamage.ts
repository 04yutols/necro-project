import type { BaseStats, ElementType, Resistances } from '../types/game';
import type { SynergyBonus } from './TribeSynergySystem';

export interface BattleDamageInput {
  attackerStats: BaseStats;
  attackerElementBoosts?: Partial<Record<ElementType, number>>;
  defenderStats: BaseStats;
  defenderResistances?: Resistances;
  powerMultiplier?: number;
  element?: ElementType;
  synergyBonus?: SynergyBonus;
  rng?: () => number;
}

export interface BattleDamageResult {
  damage: number;
  isCritical: boolean;
  isWeakness: boolean;
  isResisted: boolean;
}

/**
 * BattleEngine / BattleCanvas 共通のダメージ式。
 *
 * baseDmg = ATK x power
 * defMult = 1 - DEF / (DEF + 200)
 * final   = baseDmg x defMult x (1 + elementBoost + synergyBoost) x resistance
 */
export function calculateBattleDamage({
  attackerStats,
  attackerElementBoosts = {},
  defenderStats,
  defenderResistances = {},
  powerMultiplier = 1.0,
  element = 'NONE',
  synergyBonus = {},
  rng = Math.random,
}: BattleDamageInput): BattleDamageResult {
  let damage = attackerStats.atk * powerMultiplier;

  const defenderDef = Math.max(0, defenderStats.def);
  const defMult = 1 - defenderDef / (defenderDef + 200);
  damage *= defMult;

  const equipElementBoost = (attackerElementBoosts[element] ?? 0) / 100;
  let synergyElementPct = synergyBonus.elementDmgBonus ?? 0;
  if (element === 'DARK') synergyElementPct += synergyBonus.darkDmgBonus ?? 0;
  if (element === 'FIRE' || element === 'DARK') {
    synergyElementPct += synergyBonus.fireDarkDmgBonus ?? 0;
  }
  damage *= 1 + equipElementBoost + synergyElementPct / 100;

  const resistance = defenderResistances[element] ?? 0;
  const isWeakness = resistance < 0;
  const isResisted = resistance > 0;
  damage *= 1 - resistance / 100;

  const effectiveCritRate = Math.max(0, attackerStats.critRate + (synergyBonus.critRateBonus ?? 0));
  const isCritical = rng() * 100 < effectiveCritRate;
  if (isCritical) {
    damage *= Math.max(0, attackerStats.critDmg + (synergyBonus.critDmgBonus ?? 0)) / 100;
  }

  return {
    damage: Math.max(1, Math.floor(damage)),
    isCritical,
    isWeakness,
    isResisted,
  };
}
