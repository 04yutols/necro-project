/**
 * R-7: enemy 草案のバランス評価レポート（LLM 不使用の純関数）。
 *
 * 敵は「攻撃側を決めないと評価できない」ため、106 §2 の推奨どおり
 * 「代表スキル数種 vs この敵」の形で評価する:
 *   - 代表アタッカー = 全職業の指定レベル時点ステータスの中央値（特定職業に依存しない標準攻撃）
 *   - 代表スキル = power 表の 4 分類ごとに power 中央値のスキルを決定論的に選抜
 * 数値は実バトルと同一の evaluateAgainstTarget で算出し、LLM は解釈のみを担う。
 */

import { classifySkill, POWER_TABLE } from '../skillBalance';
import {
  evaluateAgainstTarget,
  type PerTarget,
  type SimAttacker,
  type SimSkill,
  type SimTarget,
} from './simulationReport';

export type RepresentativeSkill = {
  id: string;
  name?: string;
  classification: keyof typeof POWER_TABLE;
  type: string;
  targetType: 'SINGLE' | 'ALL_ENEMIES';
  element: string;
  power: number;
  mpCost: number;
};

export type EnemyDraftReport = {
  attacker: SimAttacker;
  target: SimTarget;
  rows: { skill: RepresentativeSkill; result: PerTarget }[];
  summary: {
    avgHitsToKill: number;
    minHitsToKill: number;
    maxHitsToKill: number;
    /** 1確（期待ダメージ >= HP）になった代表スキル数。 */
    oneShotCount: number;
    /** 弱点を突けた代表スキル数。 */
    weaknessHitCount: number;
    /** 耐性で軽減された代表スキル数。 */
    resistedCount: number;
  };
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 全職業の同レベル時点ステータスから「代表アタッカー」（中央値）を作る。 */
export function medianAttacker(
  attackers: { atk: number; critRate: number; critDmg: number }[],
): SimAttacker {
  return {
    atk: Math.round(median(attackers.map((a) => a.atk))),
    critRate: median(attackers.map((a) => a.critRate)),
    critDmg: median(attackers.map((a) => a.critDmg)),
  };
}

/**
 * 既存スキルから 4 分類（PHYS/MAGIC × SINGLE/AOE）ごとの代表を決定論的に選抜する。
 * 各分類で power の中央値に最も近いものを選ぶ（同値は id 昇順で安定）。
 */
export function selectRepresentativeSkills(
  skills: Record<string, unknown>,
): RepresentativeSkill[] {
  const byClass = new Map<keyof typeof POWER_TABLE, RepresentativeSkill[]>();

  const ids = Object.keys(skills).sort();
  for (const id of ids) {
    const s = skills[id] as Record<string, unknown> | undefined;
    if (!s) continue;
    const type = typeof s.type === 'string' ? s.type : '';
    const targetType = s.targetType === 'ALL_ENEMIES' ? 'ALL_ENEMIES' : 'SINGLE';
    const cls = classifySkill(type, targetType);
    if (!cls) continue;
    if (typeof s.power !== 'number' || !Number.isFinite(s.power)) continue;
    const entry: RepresentativeSkill = {
      id,
      name: typeof s.name === 'string' ? s.name : undefined,
      classification: cls,
      type,
      targetType,
      element: typeof s.element === 'string' ? s.element : 'NONE',
      power: s.power,
      mpCost: typeof s.mpCost === 'number' ? s.mpCost : 0,
    };
    const list = byClass.get(cls) ?? [];
    list.push(entry);
    byClass.set(cls, list);
  }

  const out: RepresentativeSkill[] = [];
  for (const cls of Object.keys(POWER_TABLE) as (keyof typeof POWER_TABLE)[]) {
    const list = byClass.get(cls);
    if (!list || list.length === 0) continue;
    const med = median(list.map((s) => s.power));
    // 中央値との距離が最小（同距離は id 昇順 = push 順で安定）
    let best = list[0];
    for (const s of list) {
      if (Math.abs(s.power - med) < Math.abs(best.power - med)) best = s;
    }
    out.push(best);
  }
  return out;
}

/** 代表スキル群 × この敵 1 体の決定論レポートを構築する。 */
export function buildEnemyDraftReport(
  attacker: SimAttacker,
  repSkills: RepresentativeSkill[],
  target: SimTarget,
): EnemyDraftReport {
  const rows = repSkills.map((skill) => {
    const simSkill: SimSkill = {
      power: skill.power,
      mpCost: skill.mpCost,
      element: skill.element as SimSkill['element'],
      targetType: skill.targetType,
    };
    return { skill, result: evaluateAgainstTarget(attacker, simSkill, target) };
  });

  const hits = rows.map((r) => r.result.hitsToKill);
  const n = rows.length || 1;
  return {
    attacker,
    target,
    rows,
    summary: {
      avgHitsToKill: Number((hits.reduce((s, h) => s + h, 0) / n).toFixed(2)),
      minHitsToKill: hits.length ? Math.min(...hits) : 0,
      maxHitsToKill: hits.length ? Math.max(...hits) : 0,
      oneShotCount: rows.filter((r) => r.result.oneShot).length,
      weaknessHitCount: rows.filter((r) => r.result.isWeakness).length,
      resistedCount: rows.filter((r) => r.result.isResisted).length,
    },
  };
}

/** レポートを LLM プロンプト用テキストに整形する。 */
export function enemyReportToText(report: EnemyDraftReport): string {
  const a = report.attacker;
  const t = report.target;
  const lines = report.rows.map((r) => {
    const p = r.result;
    const tag = p.isWeakness ? '弱点' : p.isResisted ? '耐性' : '等倍';
    const kill = p.oneShot ? '1確' : `${p.hitsToKill}発`;
    return `  ${r.skill.id}（${r.skill.classification} pow${r.skill.power} mp${r.skill.mpCost} ${r.skill.element}）→ 期待${p.expected} / ${kill} / ${tag}`;
  });
  const su = report.summary;
  return [
    `代表アタッカー（全職業中央値）: atk=${a.atk} / critRate=${a.critRate}% / critDmg=${a.critDmg}%`,
    `評価対象の敵: ${t.id}${t.tier ? ` [${t.tier}]` : ''} HP${t.hp} / DEF${t.def}`,
    '代表スキル別:',
    ...lines,
    `要約: 平均撃破 ${su.avgHitsToKill}発（最短${su.minHitsToKill}〜最長${su.maxHitsToKill}）/ 1確スキル ${su.oneShotCount}/${report.rows.length} / 弱点ヒット ${su.weaknessHitCount} / 耐性ヒット ${su.resistedCount}`,
  ].join('\n');
}
