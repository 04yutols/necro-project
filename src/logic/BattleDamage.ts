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
 * baseDmg      = ATK x power
 * effectiveDef = DEF x (1 - defenseReducePct/100)   ← ORC シナジーで軽減
 * defMult      = 1 - effectiveDef / (effectiveDef + 200)
 * critMult     = 1 + critDmg / 100          ← critDmg=100 なら通常+100%で2.0倍
 * final        = baseDmg x defMult x (1 + elementBoost + synergyBoost) x resistance x critMult
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

  const rawDef = Math.max(0, defenderStats.def);
  const reducePct = Math.min(100, Math.max(0, synergyBonus.defenseReducePct ?? 0));
  const defenderDef = rawDef * (1 - reducePct / 100);
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
    const effectiveCritDmg = Math.max(0, attackerStats.critDmg + (synergyBonus.critDmgBonus ?? 0));
    damage *= 1 + effectiveCritDmg / 100;
  }

  return {
    damage: Math.max(1, Math.floor(damage)),
    isCritical,
    isWeakness,
    isResisted,
  };
}
