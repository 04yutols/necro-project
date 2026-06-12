/**
 * Agent: 素材草案生成。
 *
 * 素材はシンプルだが rarity が expValue 帯を決める。rarity を主コンテキストとし、
 * 実データの帯に沿った素材を生成する。検証は materialBalance.ts が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateMaterialDraft,
  materialFindingsToFeedback,
  deriveExpBands,
  type MaterialBalanceContext,
  type MaterialValidationResult,
  type MaterialValidationFinding,
} from './materialBalance';

export type MaterialAgentInput = {
  requirements: string;
  rarity: string;
  existingMaterials: Record<string, unknown>;
  maxAttempts?: number;
  model?: string;
};

export type MaterialAgentResult = {
  draft: Record<string, unknown> | null;
  validation: MaterialValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  rarity: Annotation<string>,
  balanceCtx: Annotation<MaterialBalanceContext>,
  expHint: Annotation<string>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<MaterialValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

function buildPrompt(state: State): string {
  const existing = Object.entries(state.balanceCtx.existingMaterials)
    .map(([id, m]) => {
      const mat = m as Record<string, unknown>;
      return `  ${id} [${mat.rarity}] expValue:${mat.expValue} "${mat.name}"`;
    })
    .join('\n');

  const base = `あなたは Necromance Brave のアイテムデザイナーです。指定レアリティの素材（強化用マテリアル）を1つ設計してください。

# 対象レアリティ
${state.rarity}

# 要件
${state.requirements}

# expValue の目安
${state.expHint}

# 既存素材（命名・数値の参考。id 重複禁止、レアリティ逆転禁止）
${existing}

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要）
{
  "id": "snake_case_id",
  "name": "日本語の素材名",
  "quantity": 1,
  "expValue": "整数（上記レアリティ帯に収める。強化で得られる経験値）",
  "rarity": "${state.rarity}"
}

# 厳守事項
- rarity は "${state.rarity}" にする。
- expValue は上記レアリティ帯に収める（COMMON と RARE 以上で明確に差を付ける）。
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
      temperature: state.feedback ? 0.4 : 0.7,
      thinkingBudget,
      maxOutputTokens,
    });
    return {
      draft,
      attempts: attempt,
      log: [`草稿生成 #${attempt}（thinking ${thinkingBudget}）: "${String(draft.name ?? draft.id ?? '?')}" を生成`],
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
  const result = validateMaterialDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: MaterialValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: MaterialValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : materialFindingsToFeedback(result.findings),
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

export async function runMaterialAgent(input: MaterialAgentInput): Promise<MaterialAgentResult> {
  const balanceCtx: MaterialBalanceContext = {
    existingMaterials: input.existingMaterials,
    materialIds: new Set(Object.keys(input.existingMaterials)),
  };

  const bands = deriveExpBands(input.existingMaterials)[input.rarity];
  const expHint = bands
    ? `${input.rarity} の既存 expValue は ${bands.min}〜${bands.max}。同程度に収める。`
    : `${input.rarity} の既存データが無いため、下位レアリティより明確に高い値にする。`;

  const final = await getGraph().invoke({
    requirements: input.requirements,
    rarity: input.rarity,
    balanceCtx,
    expHint,
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
