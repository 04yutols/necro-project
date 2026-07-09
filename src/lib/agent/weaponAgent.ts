/**
 * Agent: 武器草案生成。
 *
 * 武器はレアリティが構成（サブオプション枠・パッシブ複雑度）を決めるため、
 * 対象レアリティを必須コンテキストとし、設計書13/92 のルールに沿って生成する。
 * 検証は weaponBalance.ts が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateWeaponDraft,
  weaponFindingsToFeedback,
  RARITY_SUBOPTION_SLOTS,
  NORMAL_SUBOPTION_TYPES,
  ELEMENT_SUBOPTION_TYPES,
  VALID_SYSTEM_TAGS,
  type WeaponBalanceContext,
  type WeaponValidationResult,
  type WeaponValidationFinding,
} from './weaponBalance';

export type WeaponAgentInput = {
  requirements: string;
  /** 対象レアリティ（R/SR/SSR/UR）。構成を決める主コンテキスト。 */
  rarity: string;
  existingItems: Record<string, unknown>;
  maxAttempts?: number;
  model?: string;
};

export type WeaponAgentResult = {
  draft: Record<string, unknown> | null;
  validation: WeaponValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  rarity: Annotation<string>,
  balanceCtx: Annotation<WeaponBalanceContext>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<WeaponValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

const RARITY_RANK: Record<string, number> = { R: 1, SR: 3, SSR: 4, UR: 5 };
const RARITY_ARCHETYPE_HINT: Record<string, string> = {
  R: 'LOW / MID / HIGH', SR: 'LOW / MID / HIGH', SSR: 'LOW / MID / HIGH', UR: 'MYTHIC',
};

function schemaHint(rarity: string): string {
  const slots = RARITY_SUBOPTION_SLOTS[rarity] ?? { normal: 1, element: 0 };
  const subDesc =
    slots.element > 0
      ? `通常枠 ${slots.normal} 個（${NORMAL_SUBOPTION_TYPES.join('/')} から）+ 固定属性枠 ${slots.element} 個（${ELEMENT_SUBOPTION_TYPES.join('/')} から）`
      : `通常枠 ${slots.normal} 個のみ（${NORMAL_SUBOPTION_TYPES.join('/')} から。属性枠は付けない）`;
  return `{
  "id": "snake_case_id",
  "name": "日本語の武器名",
  "type": "WEAPON",
  "rarity": "${rarity}",
  "weaponRarity": "${rarity}",
  "archetype": "${RARITY_ARCHETYPE_HINT[rarity] ?? 'MID'} のいずれか",
  "rank": ${RARITY_RANK[rarity] ?? 1},
  "ilv": "整数（R=1, SR/SSR=70前後, UR=90前後）",
  "isUnique": ${rarity === 'UR' ? 'true 推奨' : 'false'},
  "stats": {},
  "subOptions": [ ${subDesc} の { "type": "...", "value": 数値(%) } ],
  "passiveA": {
    "nameJa": "パッシブ名", "descTemplate": "効果文（必ず {value} を含む）",
    "values": [v1,v2,v3,v4,v5], "condition": "任意の発動条件", "systemTag": "任意: ${VALID_SYSTEM_TAGS.join('/')}"
  },
  "passiveB": {
    "nameJa": "パッシブ名（深淵の理）", "descTemplate": "効果文（{value} を含む）",
    "values": [v1,v2,v3,v4,v5], "systemTag": "任意: ${VALID_SYSTEM_TAGS.join('/')}"
  },
  "flavor": "フレーバーテキスト（日本語）"
}`;
}

function buildPrompt(state: State): string {
  const rarity = state.rarity;
  const slots = RARITY_SUBOPTION_SLOTS[rarity] ?? { normal: 1, element: 0 };

  const existingSummary = Object.entries(state.balanceCtx.existingItems)
    .filter(([, it]) => (it as Record<string, unknown>).type === 'WEAPON')
    .map(([id, it]) => {
      const w = it as Record<string, unknown>;
      const subs = Array.isArray(w.subOptions) ? (w.subOptions as Record<string, unknown>[]).map((s) => `${s.type}:${s.value}`).join(',') : '';
      return `  ${id} [${w.rarity}/${w.archetype}] sub:[${subs}]`;
    })
    .join('\n');

  const base = `あなたは Necromance Brave の武器デザイナーです。指定レアリティの武器を1つ設計してください。

# 対象レアリティ
${rarity}

# 要件
${state.requirements}

# レアリティ別ルール（設計書13/92・厳守）
- サブオプション枠: 通常枠 ${slots.normal} 個${slots.element > 0 ? ` + 固定属性枠 ${slots.element} 個（属性 DMG_BOOST）` : '（属性枠なし）'}。
- ${rarity === 'R' ? 'R: 単一条件+単一効果のシンプルなパッシブ。' : ''}${rarity === 'SR' ? 'SR: 特定条件+強力な単一効果。' : ''}${rarity === 'SSR' ? 'SSR: 属性一致時にSRを超えるビルド特化。属性枠を活かす。' : ''}${rarity === 'UR' ? 'UR: 規格外の最終装備。MYTHICアーキタイプ、isUnique=true、コアシステム干渉のパッシブ。' : ''}
- パッシブは Effect A（武器の理）+ Effect B（深淵の理）の2スロット必須。values はランクⅠ〜Ⅴの5要素。

# 既存武器（命名・数値の参考。インフレ厳禁・id重複禁止）
${existingSummary}

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要）
${schemaHint(rarity)}

# 数値規約
- subOptions.value は%表記（例 ATK% 6.2 / CRIT_DMG 16 / DARK_DMG_BOOST 13）。0〜1分数や桁誤り禁止。
- passive.descTemplate は必ず {value} を含める。values は5要素の昇順が自然。
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
  const result = validateWeaponDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: WeaponValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: WeaponValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : weaponFindingsToFeedback(result.findings),
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

export async function runWeaponAgent(input: WeaponAgentInput): Promise<WeaponAgentResult> {
  const balanceCtx: WeaponBalanceContext = {
    existingItems: input.existingItems,
    itemIds: new Set(Object.keys(input.existingItems)),
    expectedRarity: input.rarity,
  };

  const final = await getGraph().invoke({
    requirements: input.requirements,
    rarity: input.rarity,
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
