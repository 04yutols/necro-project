'use server';

/**
 * Agent A（コンテンツ生成エージェント）の Server Action。
 *
 * 設計書 100 の役割分担:
 *   - エージェント = 草稿を作る上流工程（このファイル）
 *   - 永続化 = 既存の saveEntry()（admin/actions.ts）— ここでは保存しない
 *   - 正しさの判定 = enemyBalance.ts の決定論的バリデータ
 */

import fs from 'fs';
import path from 'path';
import { getMasterFile } from '../actions';
import { runEnemyAgent, type EnemyAgentResult } from '@/lib/agent/enemyAgent';
import { deriveTierBands } from '@/lib/agent/enemyBalance';
import { runSkillAgent, type SkillAgentResult } from '@/lib/agent/skillAgent';
import type { SkillOwner } from '@/lib/agent/skillBalance';
import { runDemonAgent, type DemonAgentResult } from '@/lib/agent/demonAgent';
import type { DemonJobOwner } from '@/lib/agent/demonBalance';
import { runStageAgent, type StageAgentResult } from '@/lib/agent/stageAgent';
import { runWeaponAgent, type WeaponAgentResult } from '@/lib/agent/weaponAgent';

function assertDev() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Agent actions are only available in development mode.');
  }
}

/** 設計指針コンテキストを構築する（静的ポリシー + 実データから学習した tier 帯）。 */
function buildDesignContext(existingEnemies: Record<string, unknown>): string {
  const bands = deriveTierBands(existingEnemies);
  const bandLines = Object.entries(bands)
    .map(([tier, stats]) => {
      const parts = Object.entries(stats)
        .map(([k, b]) => `${k} ${b.min}〜${b.max}`)
        .join(', ');
      return `  ${tier}: ${parts}`;
    })
    .join('\n');

  // 設計書 15（ワールド・エネミー設計）の方針抜粋を任意で添付
  let docExcerpt = '';
  try {
    const docPath = path.join(process.cwd(), 'docs', '設計書', '15_ワールド・ダンジョン・エネミー設計.md');
    if (fs.existsSync(docPath)) {
      docExcerpt = fs.readFileSync(docPath, 'utf-8').slice(0, 1200);
    }
  } catch {
    // 設計書が読めなくても致命的ではない
  }

  return `## tier 別ステータス帯（現行 enemies.json の実データから算出。これに揃えること）
${bandLines}

## バランス方針
- MINION は露払い、ELITE は中ボス級耐久、BOSS は最大耐久。tier 間の数値が逆転しないこと。
- 弱点は resistances を負の値にすることで表現する（例: weaknesses=["ICE"] なら resistances.ICE < 0）。
- critRate/critDmg/effectHit/effectRes は既存に倣う（多くは critDmg=150、他は控えめ）。

${docExcerpt ? `## 設計書 15 抜粋\n${docExcerpt}` : ''}`.trim();
}

export type GenerateEnemyActionResult = EnemyAgentResult & {
  /** 草稿に既存IDと衝突する id が含まれる場合 true（保存前にユーザーへ警告）。 */
  idCollision?: boolean;
};

/**
 * 自然言語の要件からエネミー草稿を生成する。
 * 草稿はフォームに流し込まれ、ユーザーが確認後に既存 saveEntry で保存する。
 */
export async function generateEnemyDraftAction(
  requirements: string,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateEnemyActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return {
      draft: null,
      validation: null,
      attempts: 0,
      log: [],
      error: '要件を入力してください（4文字以上）。',
    };
  }

  const [enemies, items, materials, skills] = await Promise.all([
    getMasterFile('enemies'),
    getMasterFile('items'),
    getMasterFile('materials'),
    getMasterFile('skills'),
  ]);

  // スキルを素性付きカタログに変換（味方スキル選定 + 属性整合検証に使う）
  const skillCatalog = Object.entries(skills).map(([id, s]) => {
    const sk = s as Record<string, unknown>;
    return {
      id,
      nameJa: typeof sk.name === 'string' ? sk.name : undefined,
      element: typeof sk.element === 'string' ? sk.element : undefined,
      type: typeof sk.type === 'string' ? sk.type : undefined,
      targetType: typeof sk.targetType === 'string' ? sk.targetType : undefined,
      mpCost: typeof sk.mpCost === 'number' ? sk.mpCost : undefined,
    };
  });

  const result = await runEnemyAgent({
    requirements: requirements.trim(),
    existingEnemies: enemies,
    itemIds: Object.keys(items),
    materialIds: Object.keys(materials),
    skills: skillCatalog,
    designContext: buildDesignContext(enemies),
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(enemies).includes(draftId) : false;

  return { ...result, idCollision };
}

// ---------------------------------------------------------------------------
// スキル草案生成（職業 or 魔物に紐づく）
// ---------------------------------------------------------------------------
export type GenerateSkillActionResult = SkillAgentResult & { idCollision?: boolean };

/** 紐付き先の指定。job の場合 jobId、monster の場合 monsterId。 */
export type SkillOwnerSelector =
  | { kind: 'job'; id: string }
  | { kind: 'monster'; id: string };

/** 属性傾向を resistances から導出（負の耐性=弱点は除外し、正の耐性側を傾向とみなす）。 */
function deriveElementAffinity(resistances: unknown): string[] {
  if (typeof resistances !== 'object' || resistances === null) return [];
  const out: string[] = [];
  for (const [el, v] of Object.entries(resistances as Record<string, unknown>)) {
    if (typeof v === 'number' && v > 0) out.push(el);
  }
  return out;
}

export async function generateSkillDraftAction(
  requirements: string,
  owner: SkillOwnerSelector,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateSkillActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }

  const [skills, jobs, monsters] = await Promise.all([
    getMasterFile('skills'),
    getMasterFile('jobs'),
    getMasterFile('monsters'),
  ]);

  // 紐付き先 owner を構築
  let resolvedOwner: SkillOwner;
  if (owner.kind === 'job') {
    const job = jobs[owner.id] as Record<string, unknown> | undefined;
    if (!job) {
      return { draft: null, validation: null, attempts: 0, log: [], error: `職業 "${owner.id}" が存在しません。` };
    }
    resolvedOwner = {
      kind: 'job',
      id: owner.id,
      displayName: (job.displayName as string) ?? (job.name as string) ?? owner.id,
      category: job.category as string | undefined,
      baseAttackType: job.baseAttackType as string | undefined,
      tier: typeof job.tier === 'number' ? job.tier : 1,
    };
  } else {
    const monster = monsters[owner.id] as Record<string, unknown> | undefined;
    if (!monster) {
      return { draft: null, validation: null, attempts: 0, log: [], error: `魔物 "${owner.id}" が存在しません。` };
    }
    resolvedOwner = {
      kind: 'monster',
      id: owner.id,
      displayName: (monster.name as string) ?? owner.id,
      tribe: monster.tribe as string | undefined,
      elementAffinity: deriveElementAffinity(monster.resistances),
    };
  }

  const result = await runSkillAgent({
    requirements: requirements.trim(),
    owner: resolvedOwner,
    existingSkills: skills,
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(skills).includes(draftId) : false;

  return { ...result, idCollision };
}

/** スキル草案パネル用: 紐付き先の選択肢（職業/魔物の id と表示名）。 */
export async function getSkillOwnerOptions(): Promise<{
  jobs: { id: string; label: string }[];
  monsters: { id: string; label: string }[];
}> {
  assertDev();
  const [jobs, monsters] = await Promise.all([getMasterFile('jobs'), getMasterFile('monsters')]);
  return {
    jobs: Object.entries(jobs).map(([id, j]) => {
      const job = j as Record<string, unknown>;
      return { id, label: `${(job.displayName as string) ?? id}（${job.category}/${job.baseAttackType}/T${job.tier ?? 1}）` };
    }),
    monsters: Object.entries(monsters).map(([id, m]) => {
      const mon = m as Record<string, unknown>;
      return { id, label: `${(mon.name as string) ?? id}（${mon.tribe}）` };
    }),
  };
}

// ---------------------------------------------------------------------------
// 魔神化フォーム草案生成（職業に紐づく・key=jobId）
// ---------------------------------------------------------------------------
export type GenerateDemonActionResult = DemonAgentResult & { idCollision?: boolean };

export async function generateDemonFormDraftAction(
  requirements: string,
  jobId: string,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateDemonActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }

  const [demonForms, jobs] = await Promise.all([getMasterFile('demonForms'), getMasterFile('jobs')]);

  const job = jobs[jobId] as Record<string, unknown> | undefined;
  if (!job) {
    return { draft: null, validation: null, attempts: 0, log: [], error: `職業 "${jobId}" が存在しません。` };
  }
  const owner: DemonJobOwner = {
    id: jobId,
    displayName: (job.displayName as string) ?? (job.name as string) ?? jobId,
    category: job.category as string | undefined,
    baseAttackType: job.baseAttackType as string | undefined,
    tier: typeof job.tier === 'number' ? job.tier : 1,
  };

  const result = await runDemonAgent({
    requirements: requirements.trim(),
    owner,
    existingForms: demonForms,
    jobIds: Object.keys(jobs),
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  // demonForms の key は jobId。既に同 jobId のフォームがあれば上書き警告。
  const idCollision = Object.keys(demonForms).includes(jobId);

  return { ...result, idCollision };
}

/** 魔神化パネル用: 職業の選択肢（id と表示名・tier）。 */
export async function getDemonJobOptions(): Promise<{ id: string; label: string }[]> {
  assertDev();
  const jobs = await getMasterFile('jobs');
  return Object.entries(jobs).map(([id, j]) => {
    const job = j as Record<string, unknown>;
    return { id, label: `${(job.displayName as string) ?? id}（${job.category}/T${job.tier ?? 1}）` };
  });
}

// ---------------------------------------------------------------------------
// ステージ草案生成（エリアに紐づく・waves に敵を配置する複合データ）
// ---------------------------------------------------------------------------
export type GenerateStageActionResult = StageAgentResult & { idCollision?: boolean };

export async function generateStageDraftAction(
  requirements: string,
  areaId: string,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateStageActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }

  const [stages, enemies, items, materials, areas] = await Promise.all([
    getMasterFile('stages'),
    getMasterFile('enemies'),
    getMasterFile('items'),
    getMasterFile('materials'),
    getMasterFile('areas'),
  ]);

  const area = areas[areaId] as Record<string, unknown> | undefined;
  if (!area) {
    return { draft: null, validation: null, attempts: 0, log: [], error: `エリア "${areaId}" が存在しません。` };
  }

  // 敵カタログ（tier/種族/弱点付き）
  const enemyCatalog = Object.entries(enemies).map(([id, e]) => {
    const en = e as Record<string, unknown>;
    return {
      id,
      nameJa: typeof en.nameJa === 'string' ? en.nameJa : undefined,
      tier: typeof en.tier === 'string' ? en.tier : undefined,
      tribe: typeof en.tribe === 'string' ? en.tribe : undefined,
      weaknesses: Array.isArray(en.weaknesses) ? (en.weaknesses as string[]) : undefined,
    };
  });

  const result = await runStageAgent({
    requirements: requirements.trim(),
    area: {
      id: areaId,
      chapter: Number(area.chapter),
      area: Number(area.area),
      nameJa: (area.nameJa as string) ?? areaId,
    },
    existingStages: stages,
    enemies: enemyCatalog,
    itemIds: Object.keys(items),
    materialIds: Object.keys(materials),
    areaIds: Object.keys(areas),
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(stages).includes(draftId) : false;

  return { ...result, idCollision };
}

/** ステージパネル用: エリアの選択肢（id と表示名）。 */
export async function getStageAreaOptions(): Promise<{ id: string; label: string }[]> {
  assertDev();
  const areas = await getMasterFile('areas');
  return Object.entries(areas).map(([id, a]) => {
    const area = a as Record<string, unknown>;
    return { id, label: `${(area.nameJa as string) ?? id}（ch${area.chapter}/area${area.area}）` };
  });
}

// ---------------------------------------------------------------------------
// 武器草案生成（レアリティが構成を決める）
// ---------------------------------------------------------------------------
export type GenerateWeaponActionResult = WeaponAgentResult & { idCollision?: boolean };

export async function generateWeaponDraftAction(
  requirements: string,
  rarity: string,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateWeaponActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }
  if (!['R', 'SR', 'SSR', 'UR'].includes(rarity)) {
    return { draft: null, validation: null, attempts: 0, log: [], error: `レアリティ "${rarity}" は不正です。` };
  }

  const items = await getMasterFile('items');

  const result = await runWeaponAgent({
    requirements: requirements.trim(),
    rarity,
    existingItems: items,
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(items).includes(draftId) : false;

  return { ...result, idCollision };
}
