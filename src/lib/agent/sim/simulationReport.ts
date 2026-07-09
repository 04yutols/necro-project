/**
 * 決定論的シミュレーションレポート（LLM 不使用の純関数）。
 *
 * 設計書 103 の核心: ダメージ計算は LLM がしない。実バトルと同一の `calculateBattleDamage`
 * を多シナリオで実行し、メトリクスを集計する。LLM はこのレポート「を読んで」解釈するだけ。
 */

import type { BaseStats, ElementType } from '@/types/game';
import { calculateBattleDamage } from '@/logic/BattleDamage';
import { INITIAL_PLAYER_BASE_STATS } from '@/logic/BalanceConfig';

export type SimAttacker = {
  atk: number;
  critRate: number;
  critDmg: number;
  /** 属性ダメージ加成%（装備/残滓相当。任意）。 */
  elementBoostPct?: number;
};

export type SimSkill = {
  power: number;
  mpCost: number;
  element: ElementType;
  targetType: 'SINGLE' | 'ALL_ENEMIES';
};

export type SimTarget = {
  id: string;
  tier?: string;
  hp: number;
  def: number;
  resistances: Record<string, number>;
};

export type PerTarget = {
  id: string;
  tier?: string;
  hp: number;
  normal: number;
  critical: number;
  expected: number;
  oneShot: boolean;
  hitsToKill: number;
  isWeakness: boolean;
  isResisted: boolean;
};

/** R-5: AoE の想定同時ヒット数（WAVE の敵は最大 3 体。doc15）。 */
export const AOE_ASSUMED_TARGETS = 3;

/** R-5: AoE（ALL_ENEMIES）のみ付く合算メトリクス。 */
export type AoeSummary = {
  /** 想定同時ヒット数（= AOE_ASSUMED_TARGETS）。 */
  assumedTargets: number;
  /** 1 回の発動の合算期待ダメージ（avgExpected × assumedTargets）。 */
  totalExpectedPerCast: number;
  /** 合算期待 / mpCost。mpCost=0 は null。 */
  energyEfficiency: number | null;
};

export type SimulationReport = {
  attacker: SimAttacker;
  skill: SimSkill;
  perTarget: PerTarget[];
  summary: {
    /** 代表（平均）期待ダメージ / mpCost。mpCost=0 は通常攻撃扱いで null。 */
    energyEfficiency: number | null;
    /** 1確になった敵の割合（0〜1）。 */
    oneShotRate: number;
    /** 平均撃破発数。 */
    avgHitsToKill: number;
    /** 弱点を突けた敵の割合（0〜1）。 */
    weaknessCoverage: number;
    /** 期待ダメージの平均。 */
    avgExpected: number;
    /** R-5: AoE のみ。複数体同時ヒットの合算評価。 */
    aoe?: AoeSummary;
  };
};

function round(n: number): number {
  return Math.round(n);
}

/** 攻撃側 BaseStats を構築（不足フィールドは基準値で補完）。 */
function attackerBaseStats(a: SimAttacker): BaseStats {
  return { ...INITIAL_PLAYER_BASE_STATS, atk: a.atk, critRate: a.critRate, critDmg: a.critDmg };
}
function targetBaseStats(t: SimTarget): BaseStats {
  return { ...INITIAL_PLAYER_BASE_STATS, hp: t.hp, def: t.def };
}

/**
 * 1 対象への期待ダメージを算出（normal=非会心 / crit=会心 を会心率で加重）。
 * simulate()（SimulatorClient）と同一式。
 */
export function evaluateAgainstTarget(
  attacker: SimAttacker,
  skill: SimSkill,
  target: SimTarget,
): PerTarget {
  const attackerStats = attackerBaseStats(attacker);
  const defenderStats = targetBaseStats(target);
  const defenderResistances = target.resistances ?? {};
  const attackerElementBoosts: Partial<Record<ElementType, number>> = {
    [skill.element]: attacker.elementBoostPct ?? 0,
  };

  const normalRes = calculateBattleDamage({
    attackerStats,
    attackerElementBoosts,
    defenderStats,
    defenderResistances,
    powerMultiplier: skill.power,
    element: skill.element,
    rng: () => 1, // 会心しない
  });
  const critRes = calculateBattleDamage({
    attackerStats,
    attackerElementBoosts,
    defenderStats,
    defenderResistances,
    powerMultiplier: skill.power,
    element: skill.element,
    rng: () => 0, // 必ず会心
  });

  const critRateFrac = Math.min(100, Math.max(0, attacker.critRate)) / 100;
  const expected = round(normalRes.damage * (1 - critRateFrac) + critRes.damage * critRateFrac);
  const hp = Math.max(1, target.hp);

  return {
    id: target.id,
    tier: target.tier,
    hp,
    normal: normalRes.damage,
    critical: critRes.damage,
    expected,
    oneShot: expected >= hp,
    hitsToKill: Math.max(1, Math.ceil(hp / Math.max(1, expected))),
    isWeakness: normalRes.isWeakness,
    isResisted: normalRes.isResisted,
  };
}

/**
 * 攻撃側 × スキル × 対象集合の決定論的レポートを構築する。
 */
export function buildSimulationReport(
  attacker: SimAttacker,
  skill: SimSkill,
  targets: SimTarget[],
): SimulationReport {
  const perTarget = targets.map((t) => evaluateAgainstTarget(attacker, skill, t));

  const n = perTarget.length || 1;
  const avgExpected = round(perTarget.reduce((s, p) => s + p.expected, 0) / n);
  const oneShotRate = perTarget.filter((p) => p.oneShot).length / n;
  const avgHitsToKill = perTarget.reduce((s, p) => s + p.hitsToKill, 0) / n;
  const weaknessCoverage = perTarget.filter((p) => p.isWeakness).length / n;
  const energyEfficiency = skill.mpCost > 0 ? Number((avgExpected / skill.mpCost).toFixed(2)) : null;

  // R-5: AoE は 1 回の発動で複数体に同時ヒットするため、合算メトリクスを別枠で持つ
  const aoe: AoeSummary | undefined =
    skill.targetType === 'ALL_ENEMIES'
      ? {
          assumedTargets: AOE_ASSUMED_TARGETS,
          totalExpectedPerCast: avgExpected * AOE_ASSUMED_TARGETS,
          energyEfficiency:
            skill.mpCost > 0
              ? Number(((avgExpected * AOE_ASSUMED_TARGETS) / skill.mpCost).toFixed(2))
              : null,
        }
      : undefined;

  return {
    attacker,
    skill,
    perTarget,
    summary: {
      energyEfficiency,
      oneShotRate: Number(oneShotRate.toFixed(3)),
      avgHitsToKill: Number(avgHitsToKill.toFixed(2)),
      weaknessCoverage: Number(weaknessCoverage.toFixed(3)),
      avgExpected,
      ...(aoe ? { aoe } : {}),
    },
  };
}

/** レポートを LLM プロンプト用のテキストに整形する。 */
export function reportToText(report: SimulationReport): string {
  const a = report.attacker;
  const s = report.skill;
  const lines = report.perTarget.map((p) => {
    const tag = p.isWeakness ? '弱点' : p.isResisted ? '耐性' : '等倍';
    const kill = p.oneShot ? '1確' : `${p.hitsToKill}発`;
    return `  ${p.id}${p.tier ? ` [${p.tier}]` : ''} HP${p.hp} → 期待${p.expected}（通常${p.normal}/会心${p.critical}）/ ${kill} / ${tag}`;
  });
  const su = report.summary;
  return [
    `攻撃側: atk=${a.atk} / critRate=${a.critRate}% / critDmg=${a.critDmg}%${a.elementBoostPct ? ` / 属性+${a.elementBoostPct}%` : ''}`,
    `スキル: power=${s.power} / mpCost=${s.mpCost} / element=${s.element} / ${s.targetType}`,
    '対象別:',
    ...lines,
    `要約: 1確率 ${Math.round(su.oneShotRate * 100)}% / 平均撃破 ${su.avgHitsToKill}発 / エネルギー効率 ${su.energyEfficiency ?? 'N/A'} / 弱点カバー ${Math.round(su.weaknessCoverage * 100)}% / 平均期待 ${su.avgExpected}`,
    ...(su.aoe
      ? [
          `AoE合算: 想定 ${su.aoe.assumedTargets} 体同時ヒット / 1発動の合算期待 ${su.aoe.totalExpectedPerCast} / 合算エネルギー効率 ${su.aoe.energyEfficiency ?? 'N/A'}（AoE はこの合算効率で判断すること）`,
        ]
      : []),
  ].join('\n');
}
