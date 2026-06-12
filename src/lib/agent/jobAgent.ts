/**
 * Agent: 職業草案生成。
 *
 * 職業は tier が設計思想を決める（Tier1=素直な初期職 / Tier2=尖った上位職）。
 * skills は skills.json を参照し、職業 category と一致する必要がある（スキルカタログを提示）。
 * baseStatsByLevel はフォームが補間するため生成しない。検証は jobBalance.ts が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateJobDraft,
  jobFindingsToFeedback,
  type JobBalanceContext,
  type JobValidationResult,
  type JobValidationFinding,
} from './jobBalance';

export type JobSkillCatalogEntry = { id: string; nameJa?: string; type?: string; element?: string; targetType?: string };

export type JobAgentInput = {
  requirements: string;
  tier: number;
  existingJobs: Record<string, unknown>;
  skills: JobSkillCatalogEntry[];
  maxAttempts?: number;
  model?: string;
};

export type JobAgentResult = {
  draft: Record<string, unknown> | null;
  validation: JobValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  tier: Annotation<number>,
  skills: Annotation<JobSkillCatalogEntry[]>,
  balanceCtx: Annotation<JobBalanceContext>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<JobValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

const SCHEMA_HINT = `{
  "id": "snake_case_id（既存と重複しない）",
  "name": "English Name",
  "displayName": "日本語職業名",
  "nameEn": "ENGLISH NAME（大文字）",
  "title": "二つ名（日本語）",
  "tier": 1 または 2,
  "category": "PHYSICAL | MAGICAL",
  "baseAttackType": "PHYSICAL系は SLASH/STRIKE / MAGICAL系は MAGIC/PROJECTILE/SUMMON",
  "role": "役割の短い説明（例: 高HP・物理火力・耐久型）",
  "description": "職業の説明（日本語1〜2文）",
  "statModifiers": { "hp": 倍率, "atk": 倍率, "def": 倍率, "spd": 倍率, "critRate": 倍率, "critDmg": 倍率, "effectHit": 倍率, "effectRes": 倍率 },
  "energyCurve": { "baseMaxEnergy": 100, "ultimateCost": 100, "spGrowthPerLevel": 1 },
  "levelBonuses": { "10": { "passiveAtkBonus": 1 }, "20": { "passiveAtkBonus": 2 }, "30": { "passiveAtkBonus": 3, "passiveDefBonus": 1 } },
  "skills": [ { "level": 1, "skillId": "既存のスキルID（職業 category と一致する型）" } ]
}`;

function buildPrompt(state: State): string {
  const tier = state.tier === 2 ? 2 : 1;

  // スキルカタログ（type 付き。職業 category に合うものを選ばせる）
  const skillCatalog = state.skills
    .map((s) => `  ${s.id} [${s.type}/${s.element ?? '-'}/${s.targetType ?? '-'}]${s.nameJa ? ' ' + s.nameJa : ''}`)
    .join('\n');

  const existing = Object.entries(state.balanceCtx.existingJobs)
    .map(([id, j]) => {
      const job = j as Record<string, unknown>;
      const sm = (job.statModifiers as Record<string, number>) ?? {};
      return `  ${id} [T${job.tier}/${job.category}/${job.baseAttackType}] atk:${sm.atk} hp:${sm.hp} def:${sm.def} spd:${sm.spd} "${job.role}"`;
    })
    .join('\n');

  const tierRule =
    tier === 1
      ? '# Tier1 設計\n- 素直で扱いやすい初期職。statModifiers は 1.0 前後でバランス良く、極端な尖りは避ける。'
      : '# Tier2 設計\n- 尖った上位職。明確な強みと弱みを statModifiers で表現する（例: 攻撃特化なら atk を高く・def/hp を低く）。全ステータス強化は禁止。';

  const base = `あなたは Necromance Brave のゲームデザイナーです。Tier${tier} の新しい職業を1つ設計してください。

# 要件
${state.requirements}

${tierRule}

# statModifiers の規約
- 各ステータスの倍率（1.0=標準）。既存は概ね 0.72〜1.45。1.0前後で、役割に応じて配分する。
- 全部を高くしない（パワーバジェット）。強みを作るなら別を犠牲にする。

# 既存職業（バランス・命名の参考）
${existing}

# スキルカタログ（skills は category に一致する型から選ぶ）
形式: id [type/element/target] 名前
${skillCatalog}

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要。baseStatsByLevel は出力しない）
${SCHEMA_HINT}

# 厳守事項
- tier は ${tier}。
- category（PHYSICAL/MAGICAL）と baseAttackType を整合させる（PHYSICAL=SLASH/STRIKE, MAGICAL=MAGIC/PROJECTILE/SUMMON）。
- skills.skillId は実在ID。かつスキルの type が職業 category と一致するものを選ぶ。
- 最初のスキルは level 1。
- id は既存と重複しない snake_case。`;

  if (state.feedback) {
    return `${base}

# 前回の草稿は以下の検証で不合格でした。必ず修正してください。
${state.feedback}`;
  }
  return base;
}

async function generateDraftNode(state: State): Promise<Partial<State>> {
  const attempt = state.attempts + 1;
  const thinkingBudget = thinkingBudgetForAttempt(state.requirements, attempt);
  const maxOutputTokens = thinkingBudget + JSON_OUTPUT_RESERVE;
  try {
    const draft = await generateJson<Record<string, unknown>>(buildPrompt(state), {
      model: state.model || DEFAULT_GEMINI_MODEL,
      temperature: state.feedback ? 0.4 : 0.75,
      thinkingBudget,
      maxOutputTokens,
    });
    return {
      draft,
      attempts: attempt,
      log: [`草稿生成 #${attempt}（thinking ${thinkingBudget}）: "${String(draft.displayName ?? draft.id ?? '?')}" を生成`],
    };
  } catch (e) {
    return {
      attempts: attempt,
      errorMsg: e instanceof Error ? e.message : String(e),
      log: [`草稿生成 #${attempt} 失敗: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

function validateNode(state: State): Partial<State> {
  if (!state.draft) return { log: ['検証スキップ: 草稿がありません'] };
  const result = validateJobDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: JobValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: JobValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : jobFindingsToFeedback(result.findings),
    log: [`検証: ${result.ok ? 'PASS' : 'FAIL'}（FAIL ${failCount} / WARN ${warnCount}）`],
  };
}

function routeAfterValidate(state: State): 'regenerate' | typeof END {
  if (state.errorMsg) return END;
  if (state.validation?.ok) return END;
  if (state.attempts >= state.maxAttempts) return END;
  return 'regenerate';
}

function createGraph() {
  return new StateGraph(StateAnnotation)
  .addNode('generate', generateDraftNode)
  .addNode('validate', validateNode)
  .addEdge(START, 'generate')
  .addEdge('generate', 'validate')
  .addConditionalEdges('validate', routeAfterValidate, {
    regenerate: 'generate',
    [END]: END,
  })
  .compile();
}

let graph: ReturnType<typeof createGraph> | null = null;

function getGraph(): ReturnType<typeof createGraph> {
  graph ??= createGraph();
  return graph;
}

export async function runJobAgent(input: JobAgentInput): Promise<JobAgentResult> {
  const skillMeta: Record<string, { type?: string; element?: string }> = {};
  for (const s of input.skills) skillMeta[s.id] = { type: s.type, element: s.element };

  const balanceCtx: JobBalanceContext = {
    existingJobs: input.existingJobs,
    jobIds: new Set(Object.keys(input.existingJobs)),
    skillIds: new Set(input.skills.map((s) => s.id)),
    skillMeta,
  };

  const final = await getGraph().invoke({
    requirements: input.requirements,
    tier: input.tier,
    skills: input.skills,
    balanceCtx,
    maxAttempts: input.maxAttempts ?? 3,
    model: input.model ?? DEFAULT_GEMINI_MODEL,
  });

  return {
    draft: final.draft,
    validation: final.validation,
    attempts: final.attempts,
    log: final.log,
    error: final.errorMsg,
  };
}
