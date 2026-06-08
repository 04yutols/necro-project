/**
 * Agent: 味方魔物草案生成。
 *
 * 味方魔物は cost が戦力（stat budget）を決める。cost を主コンテキストとし、
 * 実データの cost 帯に沿った魔物を生成する。検証は monsterBalance.ts が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateMonsterDraft,
  monsterFindingsToFeedback,
  deriveCostBands,
  type MonsterBalanceContext,
  type MonsterValidationResult,
  type MonsterValidationFinding,
} from './monsterBalance';

export type MonsterAgentInput = {
  requirements: string;
  cost: number;
  existingMonsters: Record<string, unknown>;
  maxAttempts?: number;
  model?: string;
};

export type MonsterAgentResult = {
  draft: Record<string, unknown> | null;
  validation: MonsterValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  cost: Annotation<number>,
  balanceCtx: Annotation<MonsterBalanceContext>,
  costHint: Annotation<string>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<MonsterValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

function buildPrompt(state: State): string {
  const existing = Object.entries(state.balanceCtx.existingMonsters)
    .map(([id, m]) => {
      const mon = m as Record<string, unknown>;
      const s = (mon.stats as Record<string, number>) ?? {};
      return `  ${id} [${mon.tribe}/cost${mon.cost}] hp:${s.hp} atk:${s.atk} def:${s.def} spd:${s.spd} "${mon.name}"`;
    })
    .join('\n');

  const base = `あなたは Necromance Brave のモンスターデザイナーです。プレイヤーが使役する味方魔物を1体設計してください。

# 対象コスト
cost ${state.cost}（編成コスト。高いほど強力）

# 要件
${state.requirements}

# コスト帯の目安
${state.costHint}

# 既存の味方魔物（命名・数値・cost と戦力の釣り合いの参考）
${existing}

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要）
{
  "id": "snake_case_id（マスターキー・既存と重複しない）",
  "name": "魔物名（英語または日本語）",
  "tribe": "UNDEAD | DEMON | BEAST | HUMANOID | DRAGON | ORC",
  "cost": ${state.cost},
  "stats": { "hp": int, "atk": int, "def": int, "spd": int, "critRate": number, "critDmg": number, "effectHit": number, "effectRes": number },
  "resistances": { "FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK": number(負=弱点/正=耐性) }
}

# 数値規約
- cost は ${state.cost}。stats は cost ${state.cost} の帯に収める（コストと戦力の釣り合い）。
- critDmg は%表記（150前後）。critRate/effectHit/effectRes は%の整数。
- resistances は整数%（例: 弱点 FIRE → -20、耐性 EARTH → +10）。0〜1分数にしない。
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
  const result = validateMonsterDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: MonsterValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: MonsterValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : monsterFindingsToFeedback(result.findings),
    log: [`検証: ${result.ok ? 'PASS' : 'FAIL'}（FAIL ${failCount} / WARN ${warnCount}）`],
  };
}

function routeAfterValidate(state: State): 'regenerate' | typeof END {
  if (state.errorMsg) return END;
  if (state.validation?.ok) return END;
  if (state.attempts >= state.maxAttempts) return END;
  return 'regenerate';
}

const graph = new StateGraph(StateAnnotation)
  .addNode('generate', generateDraftNode)
  .addNode('validate', validateNode)
  .addEdge(START, 'generate')
  .addEdge('generate', 'validate')
  .addConditionalEdges('validate', routeAfterValidate, {
    regenerate: 'generate',
    [END]: END,
  })
  .compile();

export async function runMonsterAgent(input: MonsterAgentInput): Promise<MonsterAgentResult> {
  const balanceCtx: MonsterBalanceContext = {
    existingMonsters: input.existingMonsters,
    monsterIds: new Set(Object.keys(input.existingMonsters)),
    expectedCost: input.cost,
  };

  const bands = deriveCostBands(input.existingMonsters)[input.cost];
  const costHint = bands
    ? `cost ${input.cost} の既存帯: ${BAND_STATS.map((s) => `${s} ${bands[s]?.min ?? '?'}〜${bands[s]?.max ?? '?'}`).join(' / ')}`
    : `cost ${input.cost} の既存データが無いため、低コストより明確に強く・高コストより弱くする。`;

  const final = await graph.invoke({
    requirements: input.requirements,
    cost: input.cost,
    balanceCtx,
    costHint,
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

const BAND_STATS = ['hp', 'atk', 'def', 'spd'] as const;
