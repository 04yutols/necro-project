/**
 * Agent: ステージ草案生成。
 *
 * ステージはエリア（chapter/area）に紐づき、waves に敵を配置する複合データ。
 * 紐付き先エリアと、利用可能な敵カタログ（tier/属性弱点）・武器/素材・既存ステージ
 * （解放条件にできる）を渡し、参照整合の取れたステージを生成する。
 * 検証は stageBalance.ts が担う。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import {
  validateStageDraft,
  stageFindingsToFeedback,
  deriveRewardBands,
  type StageBalanceContext,
  type StageValidationResult,
  type StageValidationFinding,
} from './stageBalance';

/** 敵カタログ（wave 配置と属性整合に使う）。 */
export type EnemyCatalogEntry = {
  id: string;
  nameJa?: string;
  tier?: string;
  tribe?: string;
  weaknesses?: string[];
};

/** ステージの紐付き先エリア。 */
export type StageAreaTarget = {
  id: string;
  chapter: number;
  area: number;
  nameJa?: string;
};

export type StageAgentInput = {
  requirements: string;
  area: StageAreaTarget;
  existingStages: Record<string, unknown>;
  enemies: EnemyCatalogEntry[];
  itemIds: string[];
  materialIds: string[];
  areaIds: string[];
  maxAttempts?: number;
  model?: string;
};

export type StageAgentResult = {
  draft: Record<string, unknown> | null;
  validation: StageValidationResult | null;
  attempts: number;
  log: string[];
  error?: string;
};

const StateAnnotation = Annotation.Root({
  requirements: Annotation<string>,
  area: Annotation<StageAreaTarget>,
  enemies: Annotation<EnemyCatalogEntry[]>,
  itemIds: Annotation<string[]>,
  materialIds: Annotation<string[]>,
  rewardHint: Annotation<string>,
  balanceCtx: Annotation<StageBalanceContext>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  draft: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  validation: Annotation<StageValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

const SCHEMA_HINT = `{
  "id": "snake_case_id（規約: area{N}_xxx 例 area2_node1）",
  "name": "英語名",
  "nameJa": "日本語名",
  "nameEn": "英語名（大文字）",
  "chapter": "整数（紐付き先エリアに合わせる）",
  "chapterName": "章名（日本語）",
  "area": "整数（紐付き先エリアに合わせる）",
  "nodeType": "SAFE | DUNGEON | BOSS",
  "element": "FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK|NONE",
  "difficulty": "整数（進行に沿って既存より少し高め）",
  "description": "ステージ説明（日本語）",
  "waveCount": "waves の数と一致させる整数",
  "areaGimmick": "SLIP_DAMAGE | STATUS_AILMENT | NONE",
  "unlockRequires": ["解放に必要な既存ステージID（無ければ []）"],
  "waves": [
    { "label": "WAVE 1", "role": "WARMUP|SHIELD|ELITE|BOSS", "enemyIds": ["既存の敵ID"], "intent": "設計意図（日本語）" }
  ],
  "rewards": {
    "baseExp": "整数",
    "baseGold": "整数",
    "dropTable": [ { "type": "WEAPON|MATERIAL|CONSUMABLE", "itemId": "既存ID", "rarity": "R|SR|SSR|COMMON", "rate": 0〜1 } ]
  },
  "position": { "x": 数値, "y": 数値 }
}`;

function buildPrompt(state: State): string {
  const area = state.area;
  const enemyCatalog = state.enemies
    .map((e) => `  ${e.id} [${e.tier ?? '?'}/${e.tribe ?? '?'}${e.weaknesses?.length ? '/弱点:' + e.weaknesses.join(',') : ''}]${e.nameJa ? ' ' + e.nameJa : ''}`)
    .join('\n');

  const existingInArea = Object.entries(state.balanceCtx.existingStages)
    .filter(([, s]) => {
      const st = s as Record<string, unknown>;
      return st.chapter === area.chapter && st.area === area.area;
    })
    .map(([id, s]) => {
      const st = s as Record<string, unknown>;
      return `  ${id} [${st.nodeType}/${st.element}/diff${st.difficulty}] unlock:${JSON.stringify(st.unlockRequires ?? [])}`;
    })
    .join('\n');

  const base = `あなたは Necromance Brave のレベルデザイナーです。指定エリアに新しいステージを1つ設計してください。

# 紐付き先エリア
「${area.nameJa ?? area.id}」(id: ${area.id} / chapter ${area.chapter} / area ${area.area})
→ 生成するステージの chapter は ${area.chapter}、area は ${area.area} にすること。

# 要件
${state.requirements}

# 同エリアの既存ステージ（進行順・難易度・解放条件の参考。続きとして自然に繋ぐ）
${existingInArea || '  （このエリアにはまだステージがありません）'}

# 配置できる敵カタログ（waves.enemyIds はここから選ぶ。存在しないIDは禁止）
形式: id [tier/種族/弱点] 名前
${enemyCatalog}

# ドロップに使える ID
- 武器/消費(items): ${state.itemIds.join(', ') || '（なし）'}
- 素材(materials): ${state.materialIds.join(', ') || '（なし）'}

# 報酬の目安
${state.rewardHint}

# 出力スキーマ（このJSONオブジェクトのみ出力。説明文やマークダウン不要）
${SCHEMA_HINT}

# 厳守事項
- waves[].enemyIds は上記カタログの実在IDのみ。BOSS ノードには BOSS tier の敵を必ず入れる。
- unlockRequires は実在する既存ステージID（通常は同エリアの1つ前のステージ）。自分自身は不可。
- waveCount は waves の数と一致させる。
- dropTable.itemId は実在ID。rate は 0〜1。
- difficulty は既存ステージの流れに沿って設定（飛び級しない）。
- id は area${area.area}_ で始まる snake_case、既存と重複しない。`;

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
  // ステージは JSON が大きめなので出力枠を厚めに確保。
  const maxOutputTokens = thinkingBudget + JSON_OUTPUT_RESERVE + 2048;
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
  const result = validateStageDraft(state.draft, state.balanceCtx);
  const failCount = result.findings.filter((f: StageValidationFinding) => f.level === 'FAIL').length;
  const warnCount = result.findings.filter((f: StageValidationFinding) => f.level === 'WARN').length;
  return {
    validation: result,
    feedback: result.ok ? '' : stageFindingsToFeedback(result.findings),
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

export async function runStageAgent(input: StageAgentInput): Promise<StageAgentResult> {
  const enemyTiers: Record<string, string> = {};
  for (const e of input.enemies) if (e.tier) enemyTiers[e.id] = e.tier;

  const balanceCtx: StageBalanceContext = {
    existingStages: input.existingStages,
    stageIds: new Set(Object.keys(input.existingStages)),
    enemyIds: new Set(input.enemies.map((e) => e.id)),
    enemyTiers,
    itemIds: new Set(input.itemIds),
    materialIds: new Set(input.materialIds),
    areaIds: new Set(input.areaIds),
  };

  const bands = deriveRewardBands(input.existingStages);
  const rewardHint = `既存の baseExp ${bands.exp ? `${bands.exp.min}〜${bands.exp.max}` : '不明'} / baseGold ${bands.gold ? `${bands.gold.min}〜${bands.gold.max}` : '不明'} を目安に、難易度相応で設定。`;

  const final = await getGraph().invoke({
    requirements: input.requirements,
    area: input.area,
    enemies: input.enemies,
    itemIds: input.itemIds,
    materialIds: input.materialIds,
    rewardHint,
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
