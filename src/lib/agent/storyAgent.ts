/**
 * Agent C: ストーリーシーン生成エージェント。
 *
 * 設計書 104: 構造は決定論ゲート（storyValidator）で担保し、物語の質は「多案 → 人間選択」。
 * LLM に良し悪しを判定させない。N 案を生成し、各案を構造検証して妥当案を返す。
 * 全案が構造 FAIL のときのみ再生成する。
 *
 * 2 モード:
 *  - new: 指示 + type/trigger からシーン全体（lines含む）を生成
 *  - complete: 既存シーンの骨子（id/type/trigger/speaker列）を維持し lines を埋める
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateStoryScene,
  type StoryValidationContext,
  type StoryValidationResult,
} from './story/storyValidator';

export type StoryAgentMode = 'new' | 'complete';

export type StoryAgentInput = {
  mode: StoryAgentMode;
  /** 新規: 短い指示。補完: 補完の方向性（任意）。 */
  brief: string;
  /** 骨子（new ではユーザー指定の type/trigger/id 等、complete では既存シーン）。 */
  skeleton: Record<string, unknown>;
  /** プロンプトに添える物語コンテキスト（buildStoryContext の出力）。 */
  storyContext: string;
  /** 構造検証コンテキスト。 */
  validationContext: StoryValidationContext;
  /** 生成する候補数。 */
  candidateCount?: number;
  maxAttempts?: number;
  model?: string;
};

export type StoryCandidate = {
  scene: Record<string, unknown>;
  validation: StoryValidationResult;
};

export type StoryAgentResult = {
  candidates: StoryCandidate[]; // 構造的に妥当なもの（FAIL=0）
  rejected: number; // 構造 FAIL で除外した案の数
  /** 候補が 0 件のとき、なぜ除外されたか（最後に弾いた案の FAIL 内容）。UI で原因表示用。 */
  rejectionReasons: string[];
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  mode: Annotation<StoryAgentMode>,
  brief: Annotation<string>,
  skeleton: Annotation<Record<string, unknown>>,
  storyContext: Annotation<string>,
  validationContext: Annotation<StoryValidationContext>,
  candidateCount: Annotation<number>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  candidates: Annotation<StoryCandidate[]>({ reducer: (_p, n) => n, default: () => [] }),
  rejected: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  rejectionReasons: Annotation<string[]>({ reducer: (_p, n) => n, default: () => [] }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

function buildPrompt(state: State): string {
  const sk = state.skeleton;
  const n = state.candidateCount;

  const common = `あなたは Necromance Brave のシナリオライターです。世界観とキャラの口調を厳守し、
場面の台詞を作成してください。良し悪しの選択は人間が行うため、雰囲気/言い回しの異なる候補を ${n} 案出してください。

${state.storyContext}

# 出力スキーマ（このJSONオブジェクトのみ。${n}案）
{ "candidates": [
  {
    "lines": [
      { "speaker": "characters.json のキー or null（ナレーション）", "text": "日本語台詞", "textEn": "English", "expression": "その speaker の expressions のいずれか（任意）" }
    ]
  }
] }

# 厳守
- speaker は既知キャラのキーか null。expression はその speaker の expressions に含まれる値のみ。
- 固有名詞の表記を統一し、前後シーンと矛盾しない。
- ${n}案はトーン/言い回しを変える（同じ内容の焼き直しにしない）。`;

  if (state.mode === 'complete') {
    return `${common}

# 補完対象シーン（この骨子の lines を埋める。id/type/trigger/speaker構成は尊重）
${JSON.stringify(sk, null, 2)}

# 補完の方向性
${state.brief || '（指定なし。文脈に沿って自然に）'}
${state.feedback ? `\n# 前回の不備（構造検証）。必ず直す:\n${state.feedback}` : ''}`;
  }

  return `${common}

# 場面の骨子（この type/trigger/id を使う）
${JSON.stringify(sk, null, 2)}

# 指示
${state.brief}
${state.feedback ? `\n# 前回の不備（構造検証）。必ず直す:\n${state.feedback}` : ''}`;
}

/** LLM 出力の各案を完全な scene に組み立てる（骨子 + lines）。 */
function assembleScene(skeleton: Record<string, unknown>, candidate: unknown): Record<string, unknown> {
  const lines = candidate && typeof candidate === 'object' && 'lines' in candidate
    ? (candidate as Record<string, unknown>).lines
    : [];
  return { ...skeleton, lines: Array.isArray(lines) ? lines : [] };
}

async function generateNode(state: State): Promise<Partial<State>> {
  const attempt = state.attempts + 1;
  const thinkingBudget = thinkingBudgetForAttempt(state.brief, attempt);
  const maxOutputTokens = thinkingBudget + JSON_OUTPUT_RESERVE + 2048;
  try {
    const raw = await generateJson<{ candidates?: unknown[] }>(buildPrompt(state), {
      model: state.model || DEFAULT_GEMINI_MODEL,
      temperature: 0.85, // 物語は多様性重視
      thinkingBudget,
      maxOutputTokens,
    });
    const rawCandidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    const assembled = rawCandidates.map((c) => assembleScene(state.skeleton, c));

    const valid: StoryCandidate[] = [];
    let rejected = 0;
    let lastRejectionFindings: string[] = [];
    for (const scene of assembled) {
      const validation = validateStoryScene(scene, state.validationContext);
      if (validation.ok) valid.push({ scene, validation });
      else {
        rejected++;
        lastRejectionFindings = validation.findings.filter((f) => f.level === 'FAIL').map((f) => `[${f.field}] ${f.message}`);
      }
    }
    return {
      candidates: valid,
      rejected,
      rejectionReasons: valid.length === 0 ? lastRejectionFindings : [],
      attempts: attempt,
      feedback: valid.length === 0 ? lastRejectionFindings.map((s) => `- ${s}`).join('\n') : '',
      log: [`生成 #${attempt}: ${assembled.length}案中 ${valid.length}案が構造妥当（${rejected}案除外）`],
    };
  } catch (e) {
    return {
      attempts: attempt,
      errorMsg: e instanceof Error ? e.message : String(e),
      log: [`生成 #${attempt} 失敗: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

function routeAfterGenerate(state: State): 'regenerate' | typeof END {
  if (state.errorMsg) return END;
  if (state.candidates.length > 0) return END;
  if (state.attempts >= state.maxAttempts) return END;
  return 'regenerate';
}

const graph = new StateGraph(StateAnnotation)
  .addNode('generate', generateNode)
  .addEdge(START, 'generate')
  .addConditionalEdges('generate', routeAfterGenerate, {
    regenerate: 'generate',
    [END]: END,
  })
  .compile();

export async function runStoryAgent(input: StoryAgentInput): Promise<StoryAgentResult> {
  const final = await graph.invoke({
    mode: input.mode,
    brief: input.brief,
    skeleton: input.skeleton,
    storyContext: input.storyContext,
    validationContext: input.validationContext,
    candidateCount: input.candidateCount ?? 3,
    maxAttempts: input.maxAttempts ?? 3,
    model: input.model ?? DEFAULT_GEMINI_MODEL,
  });

  return {
    candidates: final.candidates,
    rejected: final.rejected,
    rejectionReasons: final.rejectionReasons,
    attempts: final.attempts,
    log: final.log,
    error: final.errorMsg,
  };
}
