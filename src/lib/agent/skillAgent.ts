/**
 * Agent: スキル草案生成。
 *
 * スキルは職業（または魔物）に紐づくため、紐付き先（owner）を必須コンテキストとし、
 * その category / baseAttackType / tier に合うスキルを生成する。
 * 検証は skillBalance.ts（設計書19 power 表 + owner-fit）が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateSkillDraft,
  skillFindingsToFeedback,
  classifySkill,
  findBand,
  POWER_TABLE,
  type SkillBalanceContext,
  type SkillOwner,
  type SkillValidationResult,
  type SkillValidationFinding,
} from './skillBalance';

export type SkillAgentInput = {
  requirements: string;
  /** 紐付き先（職業 or 魔物）。 */
  owner: SkillOwner;
  existingSkills: Record<string, unknown>;
  maxAttempts?: number;
  model?: string;
};

export type SkillAgentResult = {
  draft: Record<string, unknown> | null;
  validation: SkillValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  owner: Annotation<SkillOwner>,
  balanceCtx: Annotation<SkillBalanceContext>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<SkillValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

const SKILL_SCHEMA_HINT = `{
  "id": "snake_case_id（規約: skill_<紐付き先>_<名前> 例 skill_warrior_flame_edge）",
  "name": "日本語のスキル名",
  "mpCost": "整数。物理は4以上、魔法は8以上",
  "power": "ダメージ倍率（baseDmg = ATK × power）。設計書19の範囲に収める",
  "type": "PHYSICAL | MAGICAL（紐付き先の系統に一致させる）",
  "element": "FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK|NONE",
  "attackType": "SLASH | STRIKE | PROJECTILE | MAGIC | SUMMON（紐付き先の基礎攻撃に揃える）",
  "targetType": "SINGLE | ALL_ENEMIES",
  "effectKey": "element_attackType の小文字（例 fire_slash, dark_magic）",
  "description": "効果を日本語で1文"
}`;

/** owner と分類に応じた power 表の抜粋を文字列化（プロンプトに具体的な範囲を与える）。 */
function powerTableHint(owner: SkillOwner): string {
  const tier = owner.tier === 2 ? 2 : 1;
  const lines: string[] = [];
  for (const cls of Object.keys(POWER_TABLE)) {
    for (const band of POWER_TABLE[cls]) {
      const [lo, hi] = tier === 2 ? band.t2 : band.t1;
      const costLabel = band.maxCost === Infinity ? `${band.minCost}+` : `${band.minCost}〜${band.maxCost}`;
      lines.push(`  ${cls} / mpCost ${costLabel} → power ${lo}〜${hi}`);
    }
  }
  return `Tier${tier} の power 範囲（設計書19）:\n${lines.join('\n')}`;
}

function buildPrompt(state: State): string {
  const owner = state.owner;
  const ctx = state.balanceCtx;

  // 紐付き先のスキル分布（参考）
  const ownerHint =
    owner.kind === 'job'
      ? `職業「${owner.displayName ?? owner.id}」(${owner.category} / 基礎攻撃 ${owner.baseAttackType} / Tier${owner.tier ?? 1})`
      : `魔物「${owner.displayName ?? owner.id}」(種族 ${owner.tribe ?? '?'} / 属性傾向 ${(owner.elementAffinity ?? []).join('/') || 'なし'})`;

  const existingSummary = Object.entries(ctx.existingSkills)
    .map(([id, s]) => {
      const sk = s as Record<string, unknown>;
      return `  ${id} [${sk.type}/${sk.element}/${sk.attackType}/${sk.targetType}] mp${sk.mpCost} power${sk.power}`;
    })
    .slice(0, 40)
    .join('\n');

  const base = `あなたは Necromance Brave のゲームデザイナーです。指定された紐付き先に合うスキルを1つ設計してください。

# 紐付き先（このスキルの持ち主）
${ownerHint}

# 要件
${state.requirements}

# 紐付き先との整合（厳守）
${
  owner.kind === 'job'
    ? `- type は必ず ${owner.category} にする（紐付き先が ${owner.category} 系のため）。
- attackType は ${owner.baseAttackType} に揃える（職業の基礎攻撃種別）。
- power は下記 Tier${owner.tier ?? 1} の範囲に収める。`
    : `- element は魔物の属性傾向（${(owner.elementAffinity ?? []).join('/') || '任意'}）に合わせる。
- power は下記 Tier1 の範囲に収める。`
}

# power 表
${powerTableHint(owner)}

# 既存スキル（命名・数値分布の参考。インフレ厳禁・id 重複禁止）
${existingSummary}

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要）
${SKILL_SCHEMA_HINT}

# 数値規約
- power は設計書19の範囲内（0.9〜2.5程度の倍率。0〜1の分数や桁誤りは禁止）。
- mpCost は整数。物理は4以上、魔法は8以上。
- effectKey は element_attackType の小文字（例: fire_slash, dark_magic）。
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
  const result = validateSkillDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: SkillValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: SkillValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : skillFindingsToFeedback(result.findings),
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

export async function runSkillAgent(input: SkillAgentInput): Promise<SkillAgentResult> {
  const balanceCtx: SkillBalanceContext = {
    existingSkills: input.existingSkills,
    skillIds: new Set(Object.keys(input.existingSkills)),
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

// classifySkill / findBand を再エクスポート（テスト用途）
export { classifySkill, findBand };
