/**
 * Agent D: 一括変更エージェント。
 *
 * 設計書 105: LLM は「自然言語 → BulkSpec への翻訳」のみ。値の計算はしない。
 * 生成した BulkSpec を決定論的にスキーマ検証し、不正なら再生成する。
 * 実際の変更（フィルタ抽出・数値演算）は bulkEngine.ts が行う（このエージェントは Spec を返すだけ）。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import { validateBulkSpec, specFindingsToFeedback, type BulkSpec } from './bulk/bulkSpec';

export type BulkAgentInput = {
  instruction: string;
  /** プロンプト用: file → 利用可能フィールド一覧（型付きヒント）。 */
  fieldHints: string;
  maxAttempts?: number;
  model?: string;
};

export type BulkAgentResult = {
  spec: BulkSpec | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  instruction: Annotation<string>,
  fieldHints: Annotation<string>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  spec: Annotation<BulkSpec | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

function buildPrompt(state: State): string {
  const base = `あなたは Necromance Brave のデータ運用担当です。一括変更の自然言語指示を、
構造化スペック(JSON)に「翻訳」してください。あなたは値を計算しません。
指示を filter（条件）と operation（操作）に分解するだけです。

# 指示
${state.instruction}

# 対象ファイルと利用可能フィールド（filter/operation で使えるキー）
${state.fieldHints}

# 出力（このJSONオブジェクトのみ。説明文不要）
{
  "file": "対象ファイル1つ（enemies/skills/stages/jobs/items/materials/monsters/demonForms/areas）",
  "filter": [ {"field":"ドット記法可","op":"== | != | < | <= | > | >= | in | exists","value": 任意（in は配列, exists は不要）} ],
  "operation": [ {"field":"...","op":"set | add | mul | clampMin | clampMax","value": 数値/文字列/真偽} ],
  "note": "この一括変更の意図を1文で"
}

# 厳守（値の翻訳ルール）
- 「N%上げる」→ mul value=${'{'}1+N/100${'}'}（例 10%上げる → mul 1.1）。
- 「N%下げる」→ mul value=${'{'}1-N/100${'}'}（例 10%下げる → mul 0.9）。
- 「X 上げる/下げる」→ add value=±X（例 0.1 下げる → add -0.1）。
- 「Y にする」→ set value=Y。
- file は1つ。filter は AND。**各エンティティへの適用結果は書かない**（係数だけ書く）。`;

  if (state.feedback) {
    return `${base}

# 前回のスペックは検証で不合格でした。必ず直してください。
${state.feedback}`;
  }
  return base;
}

async function generateNode(state: State): Promise<Partial<State>> {
  const attempt = state.attempts + 1;
  const thinkingBudget = thinkingBudgetForAttempt(state.instruction, attempt);
  try {
    const raw = await generateJson<unknown>(buildPrompt(state), {
      model: state.model || DEFAULT_GEMINI_MODEL,
      temperature: state.feedback ? 0.3 : 0.4,
      thinkingBudget,
      maxOutputTokens: thinkingBudget + JSON_OUTPUT_RESERVE,
    });
    const result = validateBulkSpec(raw);
    if (result.ok && result.spec) {
      return {
        spec: result.spec,
        attempts: attempt,
        log: [`Spec 生成 #${attempt}: file=${result.spec.file} / filter ${result.spec.filter.length} / op ${result.spec.operation.length}`],
      };
    }
    return {
      attempts: attempt,
      feedback: specFindingsToFeedback(result.findings),
      log: [`Spec 生成 #${attempt}: スキーマ検証 FAIL`],
    };
  } catch (e) {
    return {
      attempts: attempt,
      errorMsg: e instanceof Error ? e.message : String(e),
      log: [`Spec 生成 #${attempt} 失敗: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

function routeAfterGenerate(state: State): 'regenerate' | typeof END {
  if (state.errorMsg) return END;
  if (state.spec) return END;
  if (state.attempts >= state.maxAttempts) return END;
  return 'regenerate';
}

function createGraph() {
  return new StateGraph(StateAnnotation)
  .addNode('generate', generateNode)
  .addEdge(START, 'generate')
  .addConditionalEdges('generate', routeAfterGenerate, {
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

export async function runBulkAgent(input: BulkAgentInput): Promise<BulkAgentResult> {
  const final = await getGraph().invoke({
    instruction: input.instruction,
    fieldHints: input.fieldHints,
    maxAttempts: input.maxAttempts ?? 3,
    model: input.model ?? DEFAULT_GEMINI_MODEL,
  });
  return { spec: final.spec, attempts: final.attempts, log: final.log, error: final.errorMsg };
}
