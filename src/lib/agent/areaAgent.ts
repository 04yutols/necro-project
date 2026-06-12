/**
 * Agent: エリア草案生成。
 *
 * エリアはマップのメタデータ。id 規約（ch{chapter}_area{area}）と既存エリアとの
 * 重複回避・並び順整合を取りつつ生成する。検証は areaBalance.ts が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateAreaDraft,
  areaFindingsToFeedback,
  suggestedSortOrder,
  type AreaBalanceContext,
  type AreaValidationResult,
  type AreaValidationFinding,
} from './areaBalance';

export type AreaAgentInput = {
  requirements: string;
  existingAreas: Record<string, unknown>;
  maxAttempts?: number;
  model?: string;
};

export type AreaAgentResult = {
  draft: Record<string, unknown> | null;
  validation: AreaValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  balanceCtx: Annotation<AreaBalanceContext>,
  slotHint: Annotation<string>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<AreaValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

function buildPrompt(state: State): string {
  const existing = Object.entries(state.balanceCtx.existingAreas)
    .map(([id, a]) => {
      const ar = a as Record<string, unknown>;
      return `  ${id} [ch${ar.chapter}/area${ar.area}] color:${ar.color} sortOrder:${ar.sortOrder} "${ar.nameJa}"`;
    })
    .join('\n');

  const base = `あなたは Necromance Brave のワールドデザイナーです。新しいエリア（マップ領域）を1つ設計してください。

# 要件
${state.requirements}

# 空きスロットの指針
${state.slotHint}

# 既存エリア（重複回避・並び順・配色の参考）
${existing}

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要）
{
  "id": "ch{chapter}_area{area} 形式（例 ch2_area3）",
  "chapter": "整数",
  "area": "整数",
  "nameJa": "日本語のエリア名",
  "nameEn": "英語のエリア名（大文字）",
  "description": "エリアの説明（日本語1〜2文）",
  "color": "#RRGGBB（既存と被らない印象的な色）",
  "position": { "x": 数値, "y": 数値（マップ座標 概ね 0〜400）},
  "sortOrder": "整数（chapter*100 + area）"
}

# 厳守事項
- id は必ず "ch{chapter}_area{area}" 形式で、chapter/area と一致させる。
- chapter/area は既存エリアと重複しない空きスロットにする。
- sortOrder は chapter*100 + area にする。
- color は #RRGGBB。`;

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
      log: [`草稿生成 #${attempt}（thinking ${thinkingBudget}）: "${String(draft.nameJa ?? draft.id ?? '?')}" を生成`],
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
  const result = validateAreaDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: AreaValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: AreaValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : areaFindingsToFeedback(result.findings),
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

export async function runAreaAgent(input: AreaAgentInput): Promise<AreaAgentResult> {
  const balanceCtx: AreaBalanceContext = {
    existingAreas: input.existingAreas,
    areaIds: new Set(Object.keys(input.existingAreas)),
  };

  // 空きスロットのヒント: 既存の最大 chapter を見て次の候補を提示
  const chapters = Object.values(input.existingAreas)
    .map((a) => (isRec(a) ? Number((a as Record<string, unknown>).chapter) : NaN))
    .filter((n) => Number.isFinite(n));
  const maxChapter = chapters.length ? Math.max(...chapters) : 0;
  const usedIds = Object.keys(input.existingAreas).join(', ') || '（なし）';
  const slotHint = `既存ID: ${usedIds}。次章なら chapter ${maxChapter + 1} / area ${maxChapter + 1}（sortOrder ${suggestedSortOrder(maxChapter + 1, maxChapter + 1)}）などが空いています。要件に合うスロットを選んでください。`;

  const final = await getGraph().invoke({
    requirements: input.requirements,
    balanceCtx,
    slotHint,
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

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
