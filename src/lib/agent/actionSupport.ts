/**
 * Server Action（admin/agents/actions.ts）から抽出した決定論ヘルパ（R-4）。
 *
 * 'use server' ファイルは dev 環境 + disk 依存で Jest から直接実行しにくいため、
 * アクション内のロジックをここへ集約し、アクション本体は「ガード → 読込 → lib 呼び出し」の
 * 薄いラッパに保つ。fs / LLM には依存しない純関数のみを置く。
 */

import { classifySkill, findBand } from './skillBalance';
import { deriveTierBands } from './enemyBalance';
import type { SimSkill, SimTarget } from './sim/simulationReport';
import type { ElementType } from '@/types/game';

/** 共通入力ガード。問題があればエラーメッセージ、なければ null。 */
export function validateRequirements(requirements: string | null | undefined): string | null {
  if (!requirements || requirements.trim().length < 4) {
    return '要件を入力してください（4文字以上）。';
  }
  return null;
}

/** 属性傾向を resistances から導出（負の耐性=弱点は除外し、正の耐性側を傾向とみなす）。 */
export function deriveElementAffinity(resistances: unknown): string[] {
  if (typeof resistances !== 'object' || resistances === null) return [];
  const out: string[] = [];
  for (const [el, v] of Object.entries(resistances as Record<string, unknown>)) {
    if (typeof v === 'number' && v > 0) out.push(el);
  }
  return out;
}

/** 設計指針コンテキストを構築する（静的ポリシー + 実データから学習した tier 帯）。 */
export function buildEnemyDesignContext(
  existingEnemies: Record<string, unknown>,
  docExcerpt = '',
): string {
  const bands = deriveTierBands(existingEnemies);
  const bandLines = Object.entries(bands)
    .map(([tier, stats]) => {
      const parts = Object.entries(stats)
        .map(([k, b]) => `${k} ${b.min}〜${b.max}`)
        .join(', ');
      return `  ${tier}: ${parts}`;
    })
    .join('\n');

  return `## tier 別ステータス帯（現行 enemies.json の実データから算出。これに揃えること）
${bandLines}

## バランス方針
- MINION は露払い、ELITE は中ボス級耐久、BOSS は最大耐久。tier 間の数値が逆転しないこと。
- 弱点は resistances を負の値にすることで表現する（例: weaknesses=["ICE"] なら resistances.ICE < 0）。
- critRate/critDmg/effectHit/effectRes は既存に倣う（多くは critDmg=150、他は控えめ）。

${docExcerpt ? `## 設計書 15 抜粋\n${docExcerpt}` : ''}`.trim();
}

/** スキルの分類 + tier(owner職業) + mpCost から power 帯テキストを作る。 */
export function powerBandHint(skill: Record<string, unknown>, tier: number): string {
  const cls = classifySkill(String(skill.type), String(skill.targetType));
  if (!cls) return 'power 帯: 分類不明';
  const band = findBand(cls, Number(skill.mpCost));
  if (!band) return `power 帯: ${cls} の mpCost ${skill.mpCost} は帯外`;
  const [lo, hi] = tier === 2 ? band.t2 : band.t1;
  return `${cls} / mpCost ${skill.mpCost} / Tier${tier} の power 帯: ${lo}〜${hi}（設計書19）`;
}

/** 各 file の代表エンティティからフィールドパス一覧（ヒント）を作る。 */
export function buildFieldHints(all: Record<string, Record<string, unknown> | undefined>): string {
  const lines: string[] = [];
  const collect = (obj: unknown, prefix: string, out: Set<string>, depth: number) => {
    if (depth > 2 || typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      const t = Array.isArray(v) ? 'array' : typeof v;
      out.add(`${path}:${t}`);
      if (t === 'object') collect(v, path, out, depth + 1);
    }
  };
  for (const file of Object.keys(all)) {
    const first = Object.values(all[file] ?? {})[0];
    if (!first) continue;
    const fields = new Set<string>();
    collect(first, '', fields, 0);
    lines.push(`## ${file}\n  ${[...fields].slice(0, 30).join(', ')}`);
  }
  return lines.join('\n');
}

/** 監査 finding の同一性キー（baseline との差分検出に使う）。 */
export function findingKey(f: { scope: string; id: string; message: string }): string {
  return `${f.scope}|${f.id}|${f.message}`;
}

/** マスターの敵集合から sim 対象を構築する。ids 未指定なら全件。存在しない id は除外。 */
export function buildSimTargets(
  enemies: Record<string, unknown>,
  ids?: string[],
): SimTarget[] {
  const targetIds = ids && ids.length > 0 ? ids : Object.keys(enemies);
  return targetIds
    .map((id): SimTarget | null => {
      const e = enemies[id] as Record<string, unknown> | undefined;
      if (!e) return null;
      const stats = (e.stats as Record<string, number>) ?? {};
      return {
        id,
        tier: typeof e.tier === 'string' ? e.tier : undefined,
        hp: stats.hp ?? 1,
        def: stats.def ?? 0,
        resistances: (e.resistances as Record<string, number>) ?? {},
      };
    })
    .filter((t): t is SimTarget => t !== null);
}

/** スキル（マスター行 or 草案）から sim 用スキルへ変換する。欠落は安全側デフォルト。 */
export function toSimSkill(src: Record<string, unknown>): SimSkill {
  return {
    power: typeof src.power === 'number' ? src.power : 1.0,
    mpCost: typeof src.mpCost === 'number' ? src.mpCost : 0,
    element: (typeof src.element === 'string' ? src.element : 'NONE') as ElementType,
    targetType: (src.targetType === 'ALL_ENEMIES' ? 'ALL_ENEMIES' : 'SINGLE') as 'SINGLE' | 'ALL_ENEMIES',
  };
}

/** snapshotId（"{file}__{timestamp}.json"）から対象マスターファイル名を取り出す。 */
export function snapshotFileOf(snapshotId: string): string {
  return snapshotId.split('__')[0];
}

/** レベルを 1〜100 にクランプする。falsy は fallback。 */
export function clampLevel(level: number | null | undefined, fallback = 1): number {
  return Math.max(1, Math.min(100, level || fallback));
}
