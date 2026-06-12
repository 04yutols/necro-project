/**
 * Agent: 魔神化フォーム草案生成。
 *
 * 魔神化フォームは職業に紐づく（key=jobId）。紐付き先の職業（tier / category /
 * baseAttackType）を必須コンテキストとし、設計書16 の Tier ルールに沿って生成する。
 * 検証は demonBalance.ts（Tier ルール + 魔神技 power 基準 + 列挙）が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateDemonFormDraft,
  demonFindingsToFeedback,
  DEMON_ULT_POWER_RANGE,
  type DemonBalanceContext,
  type DemonJobOwner,
  type DemonValidationResult,
  type DemonValidationFinding,
} from './demonBalance';

export type DemonAgentInput = {
  requirements: string;
  owner: DemonJobOwner;
  existingForms: Record<string, unknown>;
  jobIds: string[];
  maxAttempts?: number;
  model?: string;
};

export type DemonAgentResult = {
  draft: Record<string, unknown> | null;
  validation: DemonValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  owner: Annotation<DemonJobOwner>,
  balanceCtx: Annotation<DemonBalanceContext>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<DemonValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

const SCHEMA_HINT = `{
  "jobId": "紐付き先の職業ID",
  "formName": "魔神化フォーム名（日本語・厨二的で可）",
  "tier": "1 または 2（紐付き先職業の tier に合わせる）",
  "concept": "フォームの設計コンセプトを日本語で1〜2文",
  "effectA": {
    "descJa": "常時効果の説明（日本語）",
    "statBoosts": { "atk": 0.8, "def": 0.4 },
    "flags": ["任意のフラグ文字列（例 DARK_EDGE）"]
  },
  "effectB": {
    "descJa": "ギミック/代償の説明（日本語）",
    "riskType": "Tier1=null / Tier2=SELF_DAMAGE|ENERGY_DRAIN|GLASS_CANNON|SETUP_DEPENDENT",
    "riskValue": "Tier2のみ。代償の大きさ（例 2.0）",
    "onAttackEffect": "任意。攻撃時の追加効果フラグ"
  },
  "ultimateSkill": {
    "nameJa": "魔神技名（日本語）",
    "damage": {
      "power": "魔神技の倍率。Tier基準帯に収める",
      "element": "FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK|NONE",
      "targetType": "SINGLE | ALL",
      "attackType": "SLASH|STRIKE|PROJECTILE|MAGIC|SUMMON（紐付き先の基礎攻撃に揃える）",
      "flags": ["任意（例 IGNORE_DEF, SHIELD_REND）"]
    },
    "lingering": {
      "type": "FIELD | PARTY_BUFF | ENEMY_DEBUFF",
      "descJa": "残存する持続効果の説明（Tier2は必須）",
      "duration": "持続行動数（整数。例 3）"
    }
  },
  "visual": { "color": "#RRGGBB", "soft": "rgba(...)", "icon": "☾ 等" }
}`;

function buildPrompt(state: State): string {
  const owner = state.owner;
  const tier = owner.tier === 2 ? 2 : 1;
  const [plo, phi] = DEMON_ULT_POWER_RANGE[tier];

  const tierRule =
    tier === 1
      ? `# Tier1 設計ルール（設計書16）
- 直感的で分かりやすい強さ。純粋なステータスバフ + 扱いやすいギミック。
- リスクは設定しない（effectB.riskType は null）。
- 魔神技は単純な大ダメージ / 汎用自己バフ / フィールド生成。`
      : `# Tier2 設計ルール（設計書16）
- 下位職2つの要素を「悪魔合体」させた尖った設計。
- リスク必須（effectB.riskType を SELF_DAMAGE/ENERGY_DRAIN/GLASS_CANNON/SETUP_DEPENDENT から設定 + riskValue）。
- 魔神技は絶大ダメージ + 戦闘を有利にする持続効果（lingering）を必ず残す。
- 禁止: 単純な火力インフレ（HP1致死など）。ターン制の戦略を壊さない。`;

  const base = `あなたは Necromance Brave のゲームデザイナーです。指定された職業の魔神化フォームを1つ設計してください。

# 紐付き先の職業
「${owner.displayName ?? owner.id}」(id: ${owner.id} / 系統 ${owner.category ?? '?'} / 基礎攻撃 ${owner.baseAttackType ?? '?'} / Tier${tier})

# 要件
${state.requirements}

${tierRule}

# 魔神技 power 基準
Tier${tier} の power は ${plo}〜${phi} に収めること。

# 紐付き先との整合
- jobId は "${owner.id}" にする。
- tier は ${tier} にする。
- 魔神技 attackType は基礎攻撃 ${owner.baseAttackType ?? '?'} に揃える（魔法職は MAGIC でよい）。

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要）
${SCHEMA_HINT}

# 数値規約
- effectA.statBoosts は倍率表記（+80% は 0.8）。0〜1分数やパーセント整数(80)にしない。
- power は ${plo}〜${phi} の範囲。
- lingering.duration は 1 以上の整数。`;

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
      temperature: state.feedback ? 0.4 : 0.8,
      thinkingBudget,
      maxOutputTokens,
    });
    return {
      draft,
      attempts: attempt,
      log: [`草稿生成 #${attempt}（thinking ${thinkingBudget}）: "${String(draft.formName ?? draft.jobId ?? '?')}" を生成`],
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
  const result = validateDemonFormDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: DemonValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: DemonValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : demonFindingsToFeedback(result.findings),
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

export async function runDemonAgent(input: DemonAgentInput): Promise<DemonAgentResult> {
  const balanceCtx: DemonBalanceContext = {
    existingForms: input.existingForms,
    jobIds: new Set(input.jobIds),
    owner: input.owner,
  };

  const final = await getGraph().invoke({
    requirements: input.requirements,
    owner: input.owner,
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
