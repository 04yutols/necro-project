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
import { getMasterFile, getAllMasterData, getEntry, auditMasterData, type AuditFinding } from '../actions';
import { runEnemyAgent, type EnemyAgentResult } from '@/lib/agent/enemyAgent';
import { deriveTierBands } from '@/lib/agent/enemyBalance';
import { runSkillAgent, type SkillAgentResult } from '@/lib/agent/skillAgent';
import type { SkillOwner } from '@/lib/agent/skillBalance';
import { runDemonAgent, type DemonAgentResult } from '@/lib/agent/demonAgent';
import type { DemonJobOwner } from '@/lib/agent/demonBalance';
import { runStageAgent, type StageAgentResult } from '@/lib/agent/stageAgent';
import { runWeaponAgent, type WeaponAgentResult } from '@/lib/agent/weaponAgent';
import { runMaterialAgent, type MaterialAgentResult } from '@/lib/agent/materialAgent';
import { runJobAgent, type JobAgentResult } from '@/lib/agent/jobAgent';
import { runAreaAgent, type AreaAgentResult } from '@/lib/agent/areaAgent';
import { runMonsterAgent, type MonsterAgentResult } from '@/lib/agent/monsterAgent';
import { runAuditFixAgent, type AuditFixResult } from '@/lib/agent/auditFixAgent';
import { getScopeEntry, type MasterData } from '@/lib/agent/auditFix/scopeRegistry';
import { runSimEvalAgent, type SimEvalResult } from '@/lib/agent/simEvalAgent';
import { runStoryAgent, type StoryAgentResult } from '@/lib/agent/storyAgent';
import { runBulkAgent } from '@/lib/agent/bulkAgent';
import type { BulkSpec } from '@/lib/agent/bulk/bulkSpec';
import { applyBulkSpec, buildPatchedCollection, selectMatchedIds, auditMutationFields, type BulkChange } from '@/lib/agent/bulk/bulkEngine';
import { saveEntry } from '../actions';
import { buildStoryContext } from '@/lib/agent/story/storyContext';
import type { StoryValidationContext } from '@/lib/agent/story/storyValidator';
import { getStoryScenes, getStoryScenesForPack, getStoryScene, getStoryCharacters, getStoryPackSummaries } from '../actions';
import { buildSimulationReport, type SimTarget, type SimulationReport } from '@/lib/agent/sim/simulationReport';
import { POWER_TABLE, classifySkill, findBand } from '@/lib/agent/skillBalance';
import { getJobBaseStatsAtLevel } from '@/logic/JobGrowthSystem';
import type { ElementType } from '@/types/game';

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

// ---------------------------------------------------------------------------
// 素材草案生成（rarity が expValue 帯を決める）
// ---------------------------------------------------------------------------
export type GenerateMaterialActionResult = MaterialAgentResult & { idCollision?: boolean };

export async function generateMaterialDraftAction(
  requirements: string,
  rarity: string,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateMaterialActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }
  if (!['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].includes(rarity)) {
    return { draft: null, validation: null, attempts: 0, log: [], error: `レアリティ "${rarity}" は不正です。` };
  }

  const materials = await getMasterFile('materials');

  const result = await runMaterialAgent({
    requirements: requirements.trim(),
    rarity,
    existingMaterials: materials,
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(materials).includes(draftId) : false;

  return { ...result, idCollision };
}

// ---------------------------------------------------------------------------
// 職業草案生成（tier が設計思想を決める / skills は category 一致）
// ---------------------------------------------------------------------------
export type GenerateJobActionResult = JobAgentResult & { idCollision?: boolean };

export async function generateJobDraftAction(
  requirements: string,
  tier: number,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateJobActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }
  const tierNum = tier === 2 ? 2 : 1;

  const [jobs, skills] = await Promise.all([getMasterFile('jobs'), getMasterFile('skills')]);

  const skillCatalog = Object.entries(skills).map(([id, s]) => {
    const sk = s as Record<string, unknown>;
    return {
      id,
      nameJa: typeof sk.name === 'string' ? sk.name : undefined,
      type: typeof sk.type === 'string' ? sk.type : undefined,
      element: typeof sk.element === 'string' ? sk.element : undefined,
      targetType: typeof sk.targetType === 'string' ? sk.targetType : undefined,
    };
  });

  const result = await runJobAgent({
    requirements: requirements.trim(),
    tier: tierNum,
    existingJobs: jobs,
    skills: skillCatalog,
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(jobs).includes(draftId) : false;

  return { ...result, idCollision };
}

// ---------------------------------------------------------------------------
// エリア草案生成（マップメタデータ。id=ch{chapter}_area{area}）
// ---------------------------------------------------------------------------
export type GenerateAreaActionResult = AreaAgentResult & { idCollision?: boolean };

export async function generateAreaDraftAction(
  requirements: string,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateAreaActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }

  const areas = await getMasterFile('areas');

  const result = await runAreaAgent({
    requirements: requirements.trim(),
    existingAreas: areas,
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(areas).includes(draftId) : false;

  return { ...result, idCollision };
}

// ---------------------------------------------------------------------------
// 味方魔物草案生成（cost が戦力を決める）
// ---------------------------------------------------------------------------
export type GenerateMonsterActionResult = MonsterAgentResult & { idCollision?: boolean };

export async function generateMonsterDraftAction(
  requirements: string,
  cost: number,
  options?: { maxAttempts?: number; model?: string },
): Promise<GenerateMonsterActionResult> {
  assertDev();

  if (!requirements || requirements.trim().length < 4) {
    return { draft: null, validation: null, attempts: 0, log: [], error: '要件を入力してください（4文字以上）。' };
  }
  const costNum = Number.isInteger(cost) && cost >= 1 ? cost : 1;

  const monsters = await getMasterFile('monsters');

  const result = await runMonsterAgent({
    requirements: requirements.trim(),
    cost: costNum,
    existingMonsters: monsters,
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  const draftId = result.draft && typeof result.draft.id === 'string' ? result.draft.id : null;
  const idCollision = draftId ? Object.keys(monsters).includes(draftId) : false;

  return { ...result, idCollision };
}

// ---------------------------------------------------------------------------
// Agent B: 監査修正（既存エンティティの FAIL を最小変更で修正）
// ---------------------------------------------------------------------------
export type FixAuditActionResult = AuditFixResult & {
  scope: string;
  entityId: string;
  targetFindings: AuditFinding[];
};

function failKeyOf(f: AuditFinding): string {
  return `${f.scope}|${f.id}|${f.message}`;
}

/**
 * 指定エンティティの監査 FAIL を AI に修正させ、二層ゲートで検証した結果を返す。
 * 保存はしない（UI で diff 確認 → 既存 saveEntry で適用）。
 */
export async function fixAuditFindingAction(
  scope: string,
  entityId: string,
  options?: { maxAttempts?: number; model?: string },
): Promise<FixAuditActionResult> {
  assertDev();

  const entry = getScopeEntry(scope);
  if (!entry) {
    return {
      scope, entityId, targetFindings: [],
      patched: null, diff: [], perContent: null, audit: null, ok: false, attempts: 0, log: [],
      error: `未対応の scope: ${scope}`,
    };
  }

  const [all, currentEntity, baseline] = await Promise.all([
    getAllMasterData(),
    getEntry(scope as never, entityId),
    auditMasterData(),
  ]);

  if (!currentEntity) {
    return {
      scope, entityId, targetFindings: [],
      patched: null, diff: [], perContent: null, audit: null, ok: false, attempts: 0, log: [],
      error: `エンティティ "${scope}/${entityId}" が見つかりません。`,
    };
  }

  const targetFindings = baseline.filter(
    (f) => f.level === 'FAIL' && f.scope === scope && f.id === entityId,
  );
  if (targetFindings.length === 0) {
    return {
      scope, entityId, targetFindings: [],
      patched: null, diff: [], perContent: null, audit: null, ok: true, attempts: 0,
      log: ['このエンティティに FAIL はありません。'],
    };
  }

  const baselineFailKeys = new Set(baseline.filter((f) => f.level === 'FAIL').map(failKeyOf));

  const result = await runAuditFixAgent({
    scope,
    entityId,
    findings: targetFindings,
    currentEntity,
    all: all as unknown as MasterData,
    auditFn: (override) => auditMasterData(override as never),
    baselineFailKeys,
    maxAttempts: options?.maxAttempts ?? 3,
    model: options?.model,
  });

  return { ...result, scope, entityId, targetFindings };
}

/** 監査全体の FAIL を (scope,id) 単位でグルーピングして返す（バッチUI用）。 */
export async function getAuditFailGroupsAction(): Promise<{ scope: string; id: string; count: number }[]> {
  assertDev();
  const findings = await auditMasterData();
  const map = new Map<string, { scope: string; id: string; count: number }>();
  for (const f of findings) {
    if (f.level !== 'FAIL') continue;
    const key = `${f.scope}|${f.id}`;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { scope: f.scope, id: f.id, count: 1 });
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Agent E: シミュレータ連携（バランス評価）
//   ダメージ計算は calculateBattleDamage（決定論）。LLM はレポートを解釈するだけ。
// ---------------------------------------------------------------------------
export type EvaluateBalanceActionResult = SimEvalResult & {
  report: SimulationReport | null;
};

/** スキルの分類 + tier(owner職業) + mpCost から power 帯テキストを作る。 */
function powerBandHint(skill: Record<string, unknown>, tier: number): string {
  const cls = classifySkill(String(skill.type), String(skill.targetType));
  if (!cls) return 'power 帯: 分類不明';
  const band = findBand(cls, Number(skill.mpCost));
  if (!band) return `power 帯: ${cls} の mpCost ${skill.mpCost} は帯外`;
  const [lo, hi] = tier === 2 ? band.t2 : band.t1;
  return `${cls} / mpCost ${skill.mpCost} / Tier${tier} の power 帯: ${lo}〜${hi}（設計書19）`;
}

/**
 * 職業 × スキル × 敵集合 を決定論的にシミュレートし、LLM の評定を返す。
 * enemyIds 未指定なら全エネミーを対象にする。
 */
export async function evaluateBalanceAction(
  jobId: string,
  skillId: string,
  level: number,
  enemyIds?: string[],
  options?: { model?: string },
): Promise<EvaluateBalanceActionResult> {
  assertDev();

  const [jobs, skills, enemies] = await Promise.all([
    getMasterFile('jobs'),
    getMasterFile('skills'),
    getMasterFile('enemies'),
  ]);

  const job = jobs[jobId] as Record<string, unknown> | undefined;
  const skill = skills[skillId] as Record<string, unknown> | undefined;
  if (!job) return { report: null, evaluation: null, recChecks: [], log: [], error: `職業 "${jobId}" が存在しません。` };
  if (!skill) return { report: null, evaluation: null, recChecks: [], log: [], error: `スキル "${skillId}" が存在しません。` };

  // 攻撃側ステータス（ジョブのレベル別基礎値）
  const jobStats = getJobBaseStatsAtLevel(
    { baseStatsByLevel: job.baseStatsByLevel as never, statModifiers: job.statModifiers as never },
    Math.max(1, Math.min(100, level || 1)),
  );

  const tier = typeof job.tier === 'number' ? job.tier : 1;
  const attacker = { atk: Math.round(jobStats.atk), critRate: jobStats.critRate, critDmg: jobStats.critDmg };
  const simSkill = {
    power: typeof skill.power === 'number' ? skill.power : 1.0,
    mpCost: typeof skill.mpCost === 'number' ? skill.mpCost : 0,
    element: (typeof skill.element === 'string' ? skill.element : 'NONE') as ElementType,
    targetType: (skill.targetType === 'ALL_ENEMIES' ? 'ALL_ENEMIES' : 'SINGLE') as 'SINGLE' | 'ALL_ENEMIES',
  };

  const ids = enemyIds && enemyIds.length > 0 ? enemyIds : Object.keys(enemies);
  const targets: SimTarget[] = ids
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

  if (targets.length === 0) {
    return { report: null, evaluation: null, recChecks: [], log: [], error: '対象の敵がありません。' };
  }

  // 決定論レポート（LLM 不使用）
  const report = buildSimulationReport(attacker, simSkill, targets);

  const designContext = [
    powerBandHint(skill, tier),
    'エネルギー効率の目安: 1 EN あたり 20〜35。',
    '1確率が高すぎる（MINIONを軒並み1確）場合は power 過剰の疑い。',
  ].join('\n');

  const result = await runSimEvalAgent({
    report,
    designContext,
    recCheckContext: {
      skill: { type: String(skill.type), targetType: String(skill.targetType), mpCost: Number(skill.mpCost), tier },
    },
    model: options?.model,
  });

  return { ...result, report };
}

/** シミュレータ評価パネル用の選択肢（職業 / スキル / 敵）。 */
export async function getSimSelectorOptions(): Promise<{
  jobs: { id: string; label: string }[];
  skills: { id: string; label: string }[];
  enemies: { id: string; label: string }[];
}> {
  assertDev();
  const [jobs, skills, enemies] = await Promise.all([
    getMasterFile('jobs'),
    getMasterFile('skills'),
    getMasterFile('enemies'),
  ]);
  return {
    jobs: Object.entries(jobs).map(([id, j]) => ({ id, label: `${(j as Record<string, unknown>).displayName ?? id}` })),
    skills: Object.entries(skills).map(([id, s]) => {
      const sk = s as Record<string, unknown>;
      return { id, label: `${sk.name ?? id}（${sk.type}/${sk.element}/mp${sk.mpCost}/pow${sk.power}）` };
    }),
    enemies: Object.entries(enemies).map(([id, e]) => ({ id, label: `${(e as Record<string, unknown>).nameJa ?? id}（${(e as Record<string, unknown>).tier}）` })),
  };
}

// ---------------------------------------------------------------------------
// Agent E（E-5）: 生成直後のスキル草案をバランス評価（保存前）
// ---------------------------------------------------------------------------
/**
 * スキル草案（未保存）を、指定職業の atk で全エネミーに対しシミュレートし評定する。
 * 草案パネルの「バランス評価」導線で使う。
 */
export async function evaluateSkillDraftAction(
  draft: Record<string, unknown>,
  jobId: string,
  level = 60,
  options?: { model?: string },
): Promise<EvaluateBalanceActionResult> {
  assertDev();

  const [jobs, enemies] = await Promise.all([getMasterFile('jobs'), getMasterFile('enemies')]);
  const job = jobs[jobId] as Record<string, unknown> | undefined;
  if (!job) return { report: null, evaluation: null, recChecks: [], log: [], error: `職業 "${jobId}" が存在しません。` };

  const jobStats = getJobBaseStatsAtLevel(
    { baseStatsByLevel: job.baseStatsByLevel as never, statModifiers: job.statModifiers as never },
    Math.max(1, Math.min(100, level || 60)),
  );
  const tier = typeof job.tier === 'number' ? job.tier : 1;
  const attacker = { atk: Math.round(jobStats.atk), critRate: jobStats.critRate, critDmg: jobStats.critDmg };
  const simSkill = {
    power: typeof draft.power === 'number' ? draft.power : 1.0,
    mpCost: typeof draft.mpCost === 'number' ? draft.mpCost : 0,
    element: (typeof draft.element === 'string' ? draft.element : 'NONE') as ElementType,
    targetType: (draft.targetType === 'ALL_ENEMIES' ? 'ALL_ENEMIES' : 'SINGLE') as 'SINGLE' | 'ALL_ENEMIES',
  };

  const targets: SimTarget[] = Object.entries(enemies)
    .map(([id, e]): SimTarget | null => {
      const en = e as Record<string, unknown>;
      const stats = (en.stats as Record<string, number>) ?? {};
      return { id, tier: typeof en.tier === 'string' ? en.tier : undefined, hp: stats.hp ?? 1, def: stats.def ?? 0, resistances: (en.resistances as Record<string, number>) ?? {} };
    })
    .filter((t): t is SimTarget => t !== null);
  if (targets.length === 0) return { report: null, evaluation: null, recChecks: [], log: [], error: '対象の敵がありません。' };

  const report = buildSimulationReport(attacker, simSkill, targets);
  const designContext = [
    powerBandHint(draft, tier),
    'エネルギー効率の目安: 1 EN あたり 20〜35。',
    '1確率が高すぎる場合は power 過剰の疑い。',
  ].join('\n');

  const result = await runSimEvalAgent({
    report,
    designContext,
    recCheckContext: { skill: { type: String(draft.type), targetType: String(draft.targetType), mpCost: Number(draft.mpCost), tier } },
    model: options?.model,
  });

  return { ...result, report };
}

// ---------------------------------------------------------------------------
// Agent C: ストーリーシーン生成（構造=決定論ゲート / 物語=多案→人間選択）
// ---------------------------------------------------------------------------
export type StorySceneActionResult = StoryAgentResult;

async function buildStoryValidationContext(excludeSceneId?: string): Promise<StoryValidationContext> {
  const [characters, allScenes, stages, areas] = await Promise.all([
    getStoryCharacters(),
    getStoryScenes(),
    getMasterFile('stages'),
    getMasterFile('areas'),
  ]);
  const existingSceneIds = new Set(
    allScenes.map((s) => s.id).filter((id): id is string => typeof id === 'string' && id !== excludeSceneId),
  );
  return {
    characters,
    stageIds: new Set(Object.keys(stages)),
    areaIds: new Set(Object.keys(areas)),
    existingSceneIds,
  };
}

async function buildContextText(packId: string | undefined, insertAfterId: string | null): Promise<string> {
  const [characters, allScenes] = await Promise.all([getStoryCharacters(), getStoryScenes()]);
  const packScenes = packId ? (await getStoryScenesForPack(packId)) ?? allScenes : allScenes;
  return buildStoryContext({ characters, allScenes, packScenes, insertAfterId });
}

/**
 * 新規シーンを生成する（type/trigger/id 等の骨子 + 指示 → lines 含む 3 案）。
 */
export async function generateStorySceneAction(
  brief: string,
  skeleton: Record<string, unknown>,
  context: { packId?: string; insertAfterId?: string | null },
  options?: { candidateCount?: number; model?: string },
): Promise<StorySceneActionResult> {
  assertDev();
  if (!brief || brief.trim().length < 4) {
    return { candidates: [], rejected: 0, rejectionReasons: [], attempts: 0, log: [], error: '指示を入力してください（4文字以上）。' };
  }
  const validationContext = await buildStoryValidationContext(typeof skeleton.id === 'string' ? skeleton.id : undefined);
  const storyContext = await buildContextText(context.packId, context.insertAfterId ?? null);
  return runStoryAgent({
    mode: 'new',
    brief: brief.trim(),
    skeleton,
    storyContext,
    validationContext,
    candidateCount: options?.candidateCount ?? 3,
    model: options?.model,
  });
}

/**
 * 既存シーンの lines を補完/磨く（骨子は維持、lines を 3 案）。
 */
export async function completeSceneLinesAction(
  sceneId: string,
  brief: string,
  context: { packId?: string },
  options?: { candidateCount?: number; model?: string },
): Promise<StorySceneActionResult> {
  assertDev();
  const scene = await getStoryScene(sceneId);
  if (!scene) {
    return { candidates: [], rejected: 0, rejectionReasons: [], attempts: 0, log: [], error: `シーン "${sceneId}" が見つかりません。` };
  }
  const validationContext = await buildStoryValidationContext(sceneId);
  const storyContext = await buildContextText(context.packId, sceneId);
  // 骨子は lines を除いた既存シーン
  const { lines: _lines, ...skeleton } = scene as unknown as Record<string, unknown>;
  void _lines;
  return runStoryAgent({
    mode: 'complete',
    brief: brief.trim(),
    skeleton,
    storyContext,
    validationContext,
    candidateCount: options?.candidateCount ?? 3,
    model: options?.model,
  });
}

/** ストーリー生成パネル用の選択肢（パック / キャラ / シーン）。 */
export async function getStoryAgentOptions(): Promise<{
  packs: { id: string; label: string }[];
  characters: { id: string; label: string }[];
}> {
  assertDev();
  const [packs, characters] = await Promise.all([getStoryPackSummaries(), getStoryCharacters()]);
  return {
    packs: packs.map((p) => ({ id: p.id, label: `${p.label}（${p.sceneCount}シーン）` })),
    characters: Object.entries(characters).map(([id, c]) => ({ id, label: (c as { nameJa?: string }).nameJa || id })),
  };
}

// ---------------------------------------------------------------------------
// Agent D: 一括変更フロー（LLM=NL→Spec翻訳 / 変更=決定論エンジン / ゲート=per-content+監査）
//   previewBulkChangeAction は非破壊（ディスクに書かない）。
// ---------------------------------------------------------------------------
export type BulkChangeValidation = { id: string; ok: boolean; fails: string[]; warns: string[] };
export type BulkPreviewResult = {
  spec: BulkSpec | null;
  changes: { id: string; diff: BulkChange['diff'] }[];
  validations: BulkChangeValidation[];
  /** 監査: パッチ適用で新規に出た FAIL（[scope/id] message）。 */
  newAuditFails: string[];
  /** 一致エンティティに存在しない operation フィールド（typo/幻覚の疑い）。 */
  missingFields: string[];
  ok: boolean;
  attempts: number;
  log: string[];
  error?: string;
};

/** 各 file の代表エンティティからフィールドパス一覧（ヒント）を作る。 */
function buildFieldHints(all: MasterData): string {
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

const FILE_LABEL: Record<string, string> = {
  enemies: 'enemies', skills: 'skills', stages: 'stages', jobs: 'jobs',
  items: 'items', materials: 'materials', monsters: 'monsters', demonForms: 'demonForms', areas: 'areas',
};

function failKeyOfFinding(f: AuditFinding): string {
  return `${f.scope}|${f.id}|${f.message}`;
}

/**
 * 一括変更をプレビューする（非破壊）。NL→Spec→決定論適用→二層ゲート検証。
 * ディスクには一切書かない。
 */
export async function previewBulkChangeAction(instruction: string): Promise<BulkPreviewResult> {
  assertDev();
  if (!instruction || instruction.trim().length < 4) {
    return { spec: null, changes: [], validations: [], newAuditFails: [], missingFields: [], ok: false, attempts: 0, log: [], error: '指示を入力してください（4文字以上）。' };
  }

  const all = (await getAllMasterData()) as unknown as MasterData;

  const agentRes = await runBulkAgent({ instruction: instruction.trim(), fieldHints: buildFieldHints(all) });
  if (!agentRes.spec) {
    return { spec: null, changes: [], validations: [], newAuditFails: [], missingFields: [], ok: false, attempts: agentRes.attempts, log: agentRes.log, error: agentRes.error ?? 'Spec を生成できませんでした。' };
  }
  const spec = agentRes.spec;

  const file = FILE_LABEL[spec.file];
  const entities = (all[file] ?? {}) as Record<string, Record<string, unknown>>;
  const changes = applyBulkSpec(entities, spec);

  if (changes.length === 0) {
    return { spec, changes: [], validations: [], newAuditFails: [], missingFields: [], ok: false, attempts: agentRes.attempts, log: [...agentRes.log, '条件に一致する対象がありません。'], error: '条件に一致する対象がありません。' };
  }

  // 層1: per-content バリデータ（scopeRegistry）
  const scopeEntry = getScopeEntry(spec.file);
  const validations: BulkChangeValidation[] = [];
  if (scopeEntry) {
    for (const c of changes) {
      const ctx = scopeEntry.buildContext(all, c.id, c.after);
      const v = scopeEntry.validate(c.after, ctx);
      validations.push({
        id: c.id,
        ok: v.ok,
        fails: v.findings.filter((f) => f.level === 'FAIL').map((f) => `${f.field}: ${f.message}`),
        warns: v.findings.filter((f) => f.level === 'WARN').map((f) => `${f.field}: ${f.message}`),
      });
    }
  }

  // 層2: in-memory 監査（全変更を override して新規 FAIL を検出）
  const baseline = await auditMasterData();
  const baselineFailKeys = new Set(baseline.filter((f) => f.level === 'FAIL').map(failKeyOfFinding));
  const patchedCollection = buildPatchedCollection(entities, changes);
  const auditAfter = await auditMasterData({ [spec.file]: patchedCollection } as never);
  const newAuditFails = auditAfter
    .filter((f) => f.level === 'FAIL' && !baselineFailKeys.has(failKeyOfFinding(f)))
    .map((f) => `[${f.scope}/${f.id}] ${f.message}`);

  // operation の field が一致エンティティに存在しないもの（typo/幻覚）を検出
  const matchedIds = selectMatchedIds(entities, spec.filter);
  const matchedEntities = matchedIds.map((id) => entities[id]);
  const missingFields = auditMutationFields(matchedEntities, spec.operation);

  const perContentOk = validations.every((v) => v.ok);
  const ok = perContentOk && newAuditFails.length === 0;

  return {
    spec,
    changes: changes.map((c) => ({ id: c.id, diff: c.diff })),
    validations,
    newAuditFails,
    missingFields,
    ok,
    attempts: agentRes.attempts,
    log: [...agentRes.log, `対象 ${changes.length} 件 / per-content ${perContentOk ? 'PASS' : 'FAIL'} / 新規監査FAIL ${newAuditFails.length}${missingFields.length ? ` / 不在フィールド ${missingFields.length}` : ''}`],
  };
}

/**
 * 一括変更を適用する（承認後のみ。各 entity を saveEntry で保存）。
 * preview と同じ spec を渡して再適用 → 保存 → 再監査結果を返す。
 */
export async function applyBulkChangeAction(spec: BulkSpec): Promise<{ savedIds: string[]; failedIds: string[]; audit: { fail: number; warn: number }; error?: string }> {
  assertDev();
  const all = (await getAllMasterData()) as unknown as MasterData;
  const file = FILE_LABEL[spec.file];
  const entities = (all[file] ?? {}) as Record<string, Record<string, unknown>>;
  const changes = applyBulkSpec(entities, spec);
  if (changes.length === 0) {
    return { savedIds: [], failedIds: [], audit: { fail: 0, warn: 0 }, error: '対象がありません。' };
  }

  const savedIds: string[] = [];
  const failedIds: string[] = [];
  for (const c of changes) {
    const r = await saveEntry(spec.file as never, c.id, c.after);
    if (r.success) savedIds.push(c.id);
    else failedIds.push(c.id);
  }

  const audit = await auditMasterData();
  return {
    savedIds,
    failedIds,
    audit: {
      fail: audit.filter((f) => f.level === 'FAIL').length,
      warn: audit.filter((f) => f.level === 'WARN').length,
    },
  };
}
