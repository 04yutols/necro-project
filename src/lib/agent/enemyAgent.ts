/**
 * Agent A: コンテンツ生成エージェント（エネミー）。
 *
 * LangGraph の StateGraph で「生成 → 決定論的検証 → FAILなら再生成」ループを構成する。
 * 設計書 100 の核心思想に従い、検証は LLM ではなく enemyBalance.ts の純関数が担う。
 * エージェントはファイルを書かない。草稿と検証結果を返すのみ。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateEnemyDraft,
  findingsToFeedback,
  type EnemyBalanceContext,
  type EnemyValidationFinding,
  type EnemyValidationResult,
} from './enemyBalance';

export type EnemyAgentInput = {
  /** 自然言語の要件。例:「area1_boss 前座の ICE 弱点 ELITE アンデッド」 */
  requirements: string;
  /** tier 帯学習・参照検証のための既存マスターデータ。 */
  existingEnemies: Record<string, unknown>;
  itemIds: string[];
  materialIds: string[];
  skillIds: string[];
  /** 設計指針の抜粋（呼び出し側で設計書から読み込んで渡す）。 */
  designContext: string;
  /** 最大再生成回数。 */
  maxAttempts?: number;
  model?: string;
};

export type EnemyAgentResult = {
  draft: Record<string, unknown> | null;
  validation: EnemyValidationResult | null;
  attempts: number;
  /** 各ステップのログ（UI ストリーミング表示用）。 */
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  designContext: Annotation<string>,
  balanceCtx: Annotation<EnemyBalanceContext>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  validation: Annotation<EnemyValidationResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  feedback: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  attempts: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  log: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  errorMsg: Annotation<string | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
});

type State = typeof StateAnnotation.State;

const ENEMY_SCHEMA_HINT = `{
  "id": "snake_case_id",
  "name": "English Name",
  "nameJa": "日本語名",
  "nameEn": "ENGLISH NAME (uppercase)",
  "tier": "MINION | ELITE | BOSS",
  "tribe": "UNDEAD | DEMON | BEAST | HUMANOID | DRAGON | ORC",
  "stats": { "hp": int, "atk": int, "def": int, "spd": int, "critRate": number, "critDmg": number, "effectHit": number, "effectRes": number },
  "resistances": { "FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK": number },
  "weaknesses": ["弱点属性（対応する resistances は必ず負の値にする）"],
  "dropTable": [ { "type": "WEAPON|MATERIAL", "itemId": "既存のID", "rarity": "R|SR|SSR|COMMON", "rate": 0〜1 } ],
  "battle": { "color": "#RRGGBB", "sprite": "WRAITH 等", "size": 0.6〜1.0 },
  "shieldHp": "任意・整数。ELITE/BOSS のシールド量（無いなら省略）",
  "maxShieldHp": "任意・整数。shieldHp と同値（shieldHp を設定する場合は必須）",
  "gimmicks": [
    {
      "trigger": "HP_BELOW_50 | TURN_3 | ON_SHIELD_BREAK | ON_REVIVE",
      "effect": "ENRAGE | AV_DELAY | REVIVE | SUMMON_MINIONS",
      "value": "数値（ENRAGE/REVIVE は 1、SUMMON_MINIONS は召喚数、AV_DELAY は遅延量例 40）"
    }
  ],
  "description": "設計意図を日本語で1〜2文",
  "necromance": {
    "captureRate": 0〜1,
    "allyCost": 1以上の整数,
    "allyStats": { "hp": int, "atk": int, "def": int, "spd": int, "critRate": number, "critDmg": number, "effectHit": number, "effectRes": number },
    "skillIds": ["既存のスキルID"]
  }
}`;

function buildPrompt(state: State): string {
  const ctx = state.balanceCtx;
  const existingSummary = Object.entries(ctx.existingEnemies)
    .map(([id, e]) => {
      const en = e as Record<string, unknown>;
      const s = (en.stats as Record<string, number>) ?? {};
      return `  ${id} [${en.tier}/${en.tribe}] hp=${s.hp} atk=${s.atk} def=${s.def} spd=${s.spd}`;
    })
    .join('\n');

  const base = `あなたは Necromance Brave のゲームデザイナーです。要件に合うエネミー1体を、既存データと整合する形で設計してください。

# 要件
${state.requirements}

# 設計指針（抜粋）
${state.designContext}

# 既存エネミー（tier バランスの参考にすること。stats は既存の同 tier 帯に揃える）
${existingSummary}

# 参照可能な ID
- 武器(items): ${[...ctx.itemIds].join(', ') || '（なし）'}
- 素材(materials): ${[...ctx.materialIds].join(', ') || '（なし）'}
- スキル(skills): ${[...ctx.skillIds].slice(0, 40).join(', ')}

# 出力スキーマ（このJSONオブジェクトのみを出力。説明文やマークダウンは不要）
${ENEMY_SCHEMA_HINT}

# 数値スケール（最重要・既存データと同じ表記にすること）
- critRate / effectHit / effectRes: %の整数表記。例: 5% → 5（0.05 ではない）。既存は 0〜30。
- critDmg: %の整数表記。基準 150。例: 150（1.5 ではない）。既存は 150〜175。
- resistances: %の整数表記。弱点は負、耐性は正。例: 弱点 ICE → -30、耐性 FIRE → +20（-0.3 や 0.2 ではない）。既存は -40〜45。
- captureRate と dropTable.rate のみ 0〜1 の小数。例: 0.12, 0.8。

# ギミック設計（重要）
- 「激昂/蘇生/召喚/フェーズ/シールド破壊で〜」のような挙動は、文章(description)だけで済ませず必ず構造化された gimmicks に落とすこと。
  - 「HP半分で激昂」→ { trigger: "HP_BELOW_50", effect: "ENRAGE", value: 1 }
  - 「HP半分で蘇生」→ { trigger: "HP_BELOW_50", effect: "REVIVE", value: 1 }（REVIVE は必ず HP_BELOW_50）
  - 「シールド破壊で雑魚召喚」→ { trigger: "ON_SHIELD_BREAK", effect: "SUMMON_MINIONS", value: 2 }（shieldHp/maxShieldHp も設定）
  - 「3ターン目に行動遅延」→ { trigger: "TURN_3", effect: "AV_DELAY", value: 40 }
- gimmicks は ELITE/BOSS 用。MINION には付けない。ギミック要求がなければ gimmicks は省略してよい。
- trigger/effect は上記の列挙値のみ。独自の文字列は禁止。

# 厳守事項
- dropTable.itemId / necromance.skillIds は上記の参照可能IDから選ぶこと（存在しないIDは禁止）。
- weaknesses に挙げた属性は resistances で必ず負の値（例 -30）にすること。
- stats は既存の同 tier エネミーの数値帯に合わせること（インフレ厳禁）。
- id は既存と重複しない snake_case にすること。`;

  if (state.feedback) {
    return `${base}

# 前回の草稿は以下の検証で不合格でした。必ず修正してください。
${state.feedback}`;
  }
  return base;
}

// --- ノード: 草稿生成 ---
async function generateDraftNode(state: State): Promise<Partial<State>> {
  const attempt = state.attempts + 1;
  // 「難しい生成だけ予算を上げる」: 要件の初期難易度 × リトライ回数で予算をエスカレーション。
  const thinkingBudget = thinkingBudgetForAttempt(state.requirements, attempt);
  // thinking は出力枠を食うので maxOutputTokens を連動させ truncation を防ぐ。
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

// --- ノード: 決定論的検証 ---
function validateNode(state: State): Partial<State> {
  if (!state.draft) {
    return { log: ['検証スキップ: 草稿がありません'] };
  }
  const result = validateEnemyDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: EnemyValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: EnemyValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : findingsToFeedback(result.findings),
    log: [`検証: ${result.ok ? 'PASS' : 'FAIL'}（FAIL ${failCount} / WARN ${warnCount}）`],
  };
}

// --- 条件分岐: 合格 or 試行上限 → 終了 / それ以外 → 再生成 ---
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

/**
 * エネミー草稿を生成する。検証 FAIL の場合は最大 maxAttempts まで自動再生成する。
 */
export async function runEnemyAgent(input: EnemyAgentInput): Promise<EnemyAgentResult> {
  const balanceCtx: EnemyBalanceContext = {
    existingEnemies: input.existingEnemies,
    itemIds: new Set(input.itemIds),
    materialIds: new Set(input.materialIds),
    skillIds: new Set(input.skillIds),
  };

  const final = await graph.invoke({
    requirements: input.requirements,
    designContext: input.designContext,
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
